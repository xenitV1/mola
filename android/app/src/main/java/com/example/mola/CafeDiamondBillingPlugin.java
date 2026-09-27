package com.example.mola;

import android.content.Context;
import android.content.SharedPreferences;
import android.os.Handler;
import android.os.Looper;
import android.util.Base64;
import com.android.billingclient.api.*;
import com.getcapacitor.*;
import com.getcapacitor.annotation.CapacitorPlugin;
import org.json.JSONObject;
import java.net.HttpURLConnection;
import java.net.URL;
import java.nio.charset.StandardCharsets;
import java.io.ByteArrayOutputStream;
import java.io.InputStream;
import java.util.*;
import java.util.concurrent.*;

/** Consumables are verified first, credited by the persisted game wallet, then consumed server-side. */
@CapacitorPlugin(name="CafeDiamondBilling")
public class CafeDiamondBillingPlugin extends Plugin implements PurchasesUpdatedListener {
 private final Handler main=new Handler(Looper.getMainLooper());
 private final ExecutorService worker=Executors.newSingleThreadExecutor();
 private final Map<String,ProductDetails> products=new HashMap<>();
 private final Map<String,JSONObject> receipts=new HashMap<>();
 private final Set<String> held=new HashSet<>();
 private SharedPreferences prefs; private BillingClient client;
 private String installation,status="unavailable";private boolean busy,opening,destroyed,verificationFailed;private int generation;
 private final BillingRecovery recovery=new BillingRecovery(new BillingRecovery.Scheduler(){
  public void post(Runnable task,long delay){main.postDelayed(task,delay);}
  public void remove(Runnable task){main.removeCallbacks(task);}
 },()->busy||opening,this::refreshOwned);
 @Override public void load(){
  prefs=getContext().getSharedPreferences("cafe_diamond_billing",Context.MODE_PRIVATE);
  installation=prefs.getString("installation","");
  if(installation.isEmpty()){installation=UUID.randomUUID().toString();if(!prefs.edit().putString("installation",installation).commit())installation="";}
  for(String key:prefs.getAll().keySet())if(key.startsWith("receipt:")){
   String id=key.substring(8);JSONObject r=validated(prefs.getString(key,""),prefs.getString("signature:"+id,""));
   if(r!=null&&r.optBoolean("owned")&&r.optBoolean("grantPending"))receipts.put(id,r);
  }
 }
 private boolean configured(){try{URL url=new URL(BuildConfig.BILLING_DIAMOND_VERIFICATION_URL);return !installation.isEmpty()&&"https".equals(url.getProtocol())&&url.getUserInfo()==null&&!url.getHost().isEmpty()&&!BuildConfig.BILLING_PUBLIC_KEY.isEmpty();}catch(Exception e){return false;}}
 private JSONObject validated(String payload,String signature){try{
  if(!ReceiptSignature.verify(Base64.decode(BuildConfig.BILLING_PUBLIC_KEY,Base64.DEFAULT),payload.getBytes(StandardCharsets.UTF_8),Base64.decode(signature,Base64.DEFAULT)))return null;
  JSONObject r=new JSONObject(payload);String product=r.getString("productId");
  if(r.getInt("version")!=1||DiamondGrant.amount(product)==0||!getContext().getPackageName().equals(r.getString("packageName"))||!installation.equals(r.getString("installationId"))||r.getLong("verifiedAt")<=0||!r.getString("purchaseHash").matches("[a-f0-9]{64}"))return null;
  if(r.getBoolean("owned")&&DiamondGrant.id(product,r.getString("purchaseHash"),r.getInt("amount")).isEmpty())return null;
  return r;
 }catch(Exception e){return null;}}
 private String id(JSONObject r){return "diamonds:"+r.optString("purchaseHash");}
 private boolean awaiting(String product){for(JSONObject r:receipts.values())if(product.equals(r.optString("productId")))return true;return held.contains(product);}
 private JSObject state(){
  JSArray items=new JSArray(),grants=new JSArray();
  for(String product:DiamondGrant.PRODUCTS){ProductDetails p=products.get(product);ProductDetails.OneTimePurchaseOfferDetails o=offer(p);JSObject item=new JSObject();item.put("productId",product);item.put("amount",DiamondGrant.amount(product));item.put("price",o==null?"":o.getFormattedPrice());item.put("canPurchase",configured()&&!busy&&!opening&&!awaiting(product)&&o!=null);items.put(item);}
  for(Map.Entry<String,JSONObject> e:receipts.entrySet())if(!prefs.getBoolean("acked:"+e.getKey(),false)){JSObject g=new JSObject();g.put("grantId",e.getKey());g.put("productId",e.getValue().optString("productId"));g.put("amount",e.getValue().optInt("amount"));grants.put(g);}
  JSObject s=new JSObject();s.put("status",status);s.put("products",items);s.put("grants",grants);return s;
 }
 private void emit(){if(!destroyed)notifyListeners("stateChanged",state());}
 private void finish(String next){busy=false;opening=false;status=next;emit();recovery.finished("pending".equals(next)||"verification_failed".equals(next)||"unavailable".equals(next));}
 private ProductDetails.OneTimePurchaseOfferDetails offer(ProductDetails p){if(p==null)return null;List<ProductDetails.OneTimePurchaseOfferDetails> list=p.getOneTimePurchaseOfferDetailsList();return list!=null&&list.size()==1&&list.get(0).getRentalDetails()==null?list.get(0):null;}
 private void ensureClient(){if(client==null)client=BillingClient.newBuilder(getContext()).setListener(this).enablePendingPurchases(PendingPurchasesParams.newBuilder().enableOneTimeProducts().build()).enableAutoServiceReconnection().build();}
 private int begin(String next){busy=true;status=next;int request=++generation;emit();main.postDelayed(()->{if(!destroyed&&request==generation&&busy){generation++;finish("unavailable");}},60000);return request;}
 @PluginMethod public void getCached(PluginCall call){main.post(()->call.resolve(state()));}
 @PluginMethod public void refresh(PluginCall call){main.post(()->{
  refreshOwned();call.resolve(state());
 });}
 private void refreshOwned(){
  if(!configured()||destroyed)return;
  if(busy||opening){recovery.request();return;}
  int request=begin("loading");ensureClient();Runnable query=()->queryOwned(request);
  if(client.isReady())query.run();else client.startConnection(new BillingClientStateListener(){public void onBillingSetupFinished(BillingResult result){main.post(()->{if(request!=generation||destroyed)return;if(result.getResponseCode()==BillingClient.BillingResponseCode.OK)query.run();else finish("unavailable");});}public void onBillingServiceDisconnected(){}});
 }
 private void queryOwned(int request){client.queryPurchasesAsync(QueryPurchasesParams.newBuilder().setProductType(BillingClient.ProductType.INAPP).build(),(result,purchases)->main.post(()->{
  if(request!=generation||destroyed)return;if(result.getResponseCode()!=BillingClient.BillingResponseCode.OK){finish("unavailable");return;}
  verificationFailed=false;held.clear();List<Purchase> ours=new ArrayList<>();boolean pending=false;
  for(Purchase p:purchases)for(String product:p.getProducts())if(DiamondGrant.amount(product)>0){held.add(product);if(p.getPurchaseState()==Purchase.PurchaseState.PENDING)pending=true;else if(p.getPurchaseState()==Purchase.PurchaseState.PURCHASED&&getContext().getPackageName().equals(p.getPackageName()))ours.add(p);}
  final boolean hasPending=pending;Set<String> currentTokens=new HashSet<>();for(Purchase p:purchases)currentTokens.add(p.getPurchaseToken());
  verifyNext(ours,0,request,()->verifyCachedMissing(currentTokens,request,()->{retryAcknowledged();queryProducts(request,verificationFailed?"verification_failed":hasPending?"pending":"ready");}));
 }));}
 private void verifyNext(List<Purchase> purchases,int index,int request,Runnable done){
  if(index>=purchases.size()){done.run();return;}Purchase p=purchases.get(index);String product="";for(String candidate:p.getProducts())if(DiamondGrant.amount(candidate)>0){product=candidate;break;}
  status="verifying";emit();String selected=product;
  requestReceipt(selected,p.getPurchaseToken(),"verify",ok->{if(request!=generation||destroyed)return;verifyNext(purchases,index+1,request,done);});
 }
 private void verifyCachedMissing(Set<String> currentTokens,int request,Runnable done){
  List<String> missing=new ArrayList<>();for(String grant:receipts.keySet())if(!prefs.getBoolean("acked:"+grant,false)&&!currentTokens.contains(prefs.getString("token:"+grant,"")))missing.add(grant);
  verifyMissingNext(missing,0,request,done);
 }
 private void verifyMissingNext(List<String> missing,int index,int request,Runnable done){
  if(index>=missing.size()){done.run();return;}String grant=missing.get(index);JSONObject r=receipts.get(grant);String token=prefs.getString("token:"+grant,"");
  if(r==null||token.isEmpty()){verifyMissingNext(missing,index+1,request,done);return;}
  requestReceipt(r.optString("productId"),token,"verify",ok->{if(request==generation&&!destroyed)verifyMissingNext(missing,index+1,request,done);});
 }
 private void queryProducts(int request,String success){List<QueryProductDetailsParams.Product> list=new ArrayList<>();for(String product:DiamondGrant.PRODUCTS)list.add(QueryProductDetailsParams.Product.newBuilder().setProductId(product).setProductType(BillingClient.ProductType.INAPP).build());
  client.queryProductDetailsAsync(QueryProductDetailsParams.newBuilder().setProductList(list).build(),(result,details)->main.post(()->{if(request!=generation||destroyed)return;products.clear();if(result.getResponseCode()==BillingClient.BillingResponseCode.OK)for(ProductDetails p:details.getProductDetailsList())if(DiamondGrant.amount(p.getProductId())>0&&offer(p)!=null)products.put(p.getProductId(),p);finish(products.isEmpty()?"unavailable":success);}));
 }
 @PluginMethod public void purchase(PluginCall call){main.post(()->{
  String product=call.getString("productId","");ProductDetails.OneTimePurchaseOfferDetails displayed=offer(products.get(product));
  if(!configured()||busy||opening||awaiting(product)||displayed==null||client==null||!client.isReady()){call.resolve(state());return;}
  String price=displayed.getFormattedPrice(),currency=displayed.getPriceCurrencyCode();long micros=displayed.getPriceAmountMicros();int request=begin("loading");
  QueryProductDetailsParams.Product item=QueryProductDetailsParams.Product.newBuilder().setProductId(product).setProductType(BillingClient.ProductType.INAPP).build();
  client.queryProductDetailsAsync(QueryProductDetailsParams.newBuilder().setProductList(Collections.singletonList(item)).build(),(result,details)->main.post(()->{
   if(request!=generation||destroyed)return;ProductDetails p=details.getProductDetailsList().size()==1?details.getProductDetailsList().get(0):null;ProductDetails.OneTimePurchaseOfferDetails o=offer(p);
   if(result.getResponseCode()!=BillingClient.BillingResponseCode.OK||p==null||!product.equals(p.getProductId())||o==null){products.remove(product);finish("unavailable");return;}
   products.put(product,p);if(!DiamondGrant.samePrice(price,currency,micros,o.getFormattedPrice(),o.getPriceCurrencyCode(),o.getPriceAmountMicros())){finish("price_changed");return;}
   busy=false;opening=true;status="opening";emit();BillingFlowParams.ProductDetailsParams params=BillingFlowParams.ProductDetailsParams.newBuilder().setProductDetails(p).setOfferToken(o.getOfferToken()).build();
   BillingResult launched=client.launchBillingFlow(getActivity(),BillingFlowParams.newBuilder().setProductDetailsParamsList(Collections.singletonList(params)).build());if(launched.getResponseCode()!=BillingClient.BillingResponseCode.OK)finish("error");
   main.postDelayed(()->{if(!destroyed&&request==generation&&opening)finish("error");},180000);
  }));call.resolve(state());
 });}
 @Override public void onPurchasesUpdated(BillingResult result,List<Purchase> purchases){main.post(()->{
  if(destroyed)return;int code=result.getResponseCode();boolean matching=false;
  if(purchases!=null)for(Purchase p:purchases)if(getContext().getPackageName().equals(p.getPackageName()))for(String product:p.getProducts())if(DiamondGrant.amount(product)>0)matching=true;
  if(!BillingRecovery.handlesUpdate(code==BillingClient.BillingResponseCode.OK,matching,opening))return;
  if(busy){recovery.request();return;}
  opening=false;if(code==BillingClient.BillingResponseCode.USER_CANCELED){finish("cancelled");return;}
  if(code==BillingClient.BillingResponseCode.OK||code==BillingClient.BillingResponseCode.ITEM_ALREADY_OWNED){int request=begin("verifying");queryOwned(request);}else finish("error");
 });}
 private interface Completed{void accept(boolean ok);}
 private void requestReceipt(String product,String token,String action,Completed done){worker.execute(()->{
  String payload=null,signature=null;JSONObject receipt=null;HttpURLConnection connection=null;
  try{connection=(HttpURLConnection)new URL(BuildConfig.BILLING_DIAMOND_VERIFICATION_URL).openConnection();connection.setConnectTimeout(6000);connection.setReadTimeout(10000);connection.setInstanceFollowRedirects(false);connection.setRequestMethod("POST");connection.setDoOutput(true);connection.setRequestProperty("Content-Type","application/json");
   JSONObject body=new JSONObject();body.put("productId",product);body.put("purchaseToken",token);body.put("installationId",installation);body.put("action",action);byte[] bytes=body.toString().getBytes(StandardCharsets.UTF_8);connection.setFixedLengthStreamingMode(bytes.length);try(java.io.OutputStream out=connection.getOutputStream()){out.write(bytes);}
   if(connection.getResponseCode()==200){ByteArrayOutputStream buffer=new ByteArrayOutputStream();try(InputStream in=connection.getInputStream()){byte[] chunk=new byte[2048];int n;while((n=in.read(chunk))!=-1){if(buffer.size()+n>16384)throw new java.io.IOException("Receipt too large");buffer.write(chunk,0,n);}}JSONObject result=new JSONObject(buffer.toString("UTF-8"));payload=result.getString("payload");signature=result.getString("signature");receipt=validated(payload,signature);if(receipt!=null&&!product.equals(receipt.optString("productId")))receipt=null;}
  }catch(Exception unavailable){/* Retry on foreground. Never log purchase tokens. */}finally{if(connection!=null)connection.disconnect();}
  final JSONObject r=receipt;final String data=payload,sig=signature;
  main.post(()->{if(destroyed)return;boolean ok=false;
   if(r!=null){String grant=id(r);if(r.optBoolean("owned")&&r.optBoolean("grantPending")){
     ok=prefs.edit().putString("receipt:"+grant,data).putString("signature:"+grant,sig).putString("token:"+grant,token).commit();if(ok)receipts.put(grant,r);
    }else{ok=prefs.edit().remove("receipt:"+grant).remove("signature:"+grant).remove("token:"+grant).commit();if(ok){receipts.remove(grant);if(r.optBoolean("consumed")||!r.optBoolean("owned"))held.remove(product);}}
   }else{verificationFailed=true;status="verification_failed";}emit();done.accept(ok);
  });
 });}
 @PluginMethod public void acknowledgeGrant(PluginCall call){main.post(()->{
  String grant=call.getString("grantId","");JSONObject r=receipts.get(grant);boolean ack=r!=null&&(prefs.getBoolean("acked:"+grant,false)||prefs.edit().putBoolean("acked:"+grant,true).commit());
  JSObject result=new JSObject();result.put("acknowledged",ack);result.put("state",state());call.resolve(result);if(ack){emit();consume(grant,r);}
 });}
 private void consume(String grant,JSONObject r){String token=prefs.getString("token:"+grant,"");if(!token.isEmpty()&&configured())requestReceipt(r.optString("productId"),token,"consume",ok->{if(!ok){status="verification_failed";emit();}});}
 private void retryAcknowledged(){for(Map.Entry<String,JSONObject> e:new ArrayList<>(receipts.entrySet()))if(prefs.getBoolean("acked:"+e.getKey(),false))consume(e.getKey(),e.getValue());}
 @Override protected void handleOnResume(){super.handleOnResume();recovery.resume();}
 @Override protected void handleOnPause(){recovery.pause();super.handleOnPause();}
 @Override protected void handleOnDestroy(){recovery.destroy();destroyed=true;generation++;main.removeCallbacksAndMessages(null);if(client!=null)client.endConnection();worker.shutdownNow();super.handleOnDestroy();}
}
