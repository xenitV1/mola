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
import java.util.Collections;
import java.util.List;
import java.util.UUID;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;

/** Only Google Play purchases verified by our configured server unlock this plugin's product. */
@CapacitorPlugin(name = "CafeBilling")
public class CafeBillingPlugin extends Plugin implements PurchasesUpdatedListener {
    protected final Handler main = new Handler(Looper.getMainLooper());
    private final ExecutorService worker = Executors.newSingleThreadExecutor();
    private BillingClient client;
    protected SharedPreferences prefs;
    private String installId, status = "unavailable", price = "", offerToken = "";
    private boolean busy, opening, pending, hasPurchase, owned, destroyed, restoring;
    private long activatedAt;
    private String bonusGrantId = "";
    private long bonusAmount;
    private ProductDetails product;
    private int generation;
    private final BillingRecovery recovery = new BillingRecovery(new BillingRecovery.Scheduler() {
        public void post(Runnable task, long delay) { main.postDelayed(task, delay); }
        public void remove(Runnable task) { main.removeCallbacks(task); }
    }, () -> busy || opening, () -> refreshOwned(false));
    protected String productId() { return BuildConfig.BILLING_PRODUCT_ID; }
    protected String preferenceName() { return "cafe_billing"; }
    protected String verificationUrl() { return BuildConfig.BILLING_VERIFICATION_URL; }

    @Override public void load() {
        prefs = getContext().getSharedPreferences(preferenceName(), Context.MODE_PRIVATE);
        installId = prefs.getString("installation", "");
        if (installId.isEmpty()) { installId = UUID.randomUUID().toString(); if (!prefs.edit().putString("installation", installId).commit()) installId = ""; }
        readReceipt();
    }
    private boolean configured() {
        if (installId == null || installId.isEmpty()) return false;
        try { URL url = new URL(verificationUrl());
            return "https".equals(url.getProtocol()) && url.getUserInfo() == null && !url.getHost().isEmpty()
                && !BuildConfig.BILLING_PUBLIC_KEY.isEmpty();
        } catch (Exception invalid) { return false; }
    }
    private boolean validReceipt(String payload, String signature) {
        try {
            if (!ReceiptSignature.verify(Base64.decode(BuildConfig.BILLING_PUBLIC_KEY, Base64.DEFAULT), payload.getBytes(StandardCharsets.UTF_8), Base64.decode(signature, Base64.DEFAULT))) return false;
            JSONObject r = new JSONObject(payload);
            return r.getInt("version") == 1 && r.getBoolean("owned") && productId().equals(r.getString("productId"))
                && getContext().getPackageName().equals(r.getString("packageName")) && installId.equals(r.getString("installationId"))
                && r.getLong("activatedAt") > 0 && r.getLong("verifiedAt") >= r.getLong("activatedAt");
        } catch (Exception invalid) { return false; }
    }
    private void readReceipt() {
        String payload = prefs.getString("receipt", ""), signature = prefs.getString("signature", "");
        owned = validReceipt(payload, signature); activatedAt = 0; bonusGrantId = ""; bonusAmount = 0;
        if (owned) try { JSONObject receipt = new JSONObject(payload); activatedAt = receipt.getLong("activatedAt");
            bonusGrantId = BonusGrant.id(productId(), receipt.optString("purchaseHash", ""), receipt.optBoolean("bonusEligible", false), receipt.optLong("bonusAmount", 0));
            if (!bonusGrantId.isEmpty()) bonusAmount = receipt.getLong("bonusAmount");
        } catch (Exception ignored) { owned = false; }
        status = owned ? "owned" : "unavailable";
    }
    private void revoke() { owned = false; hasPurchase = false; activatedAt = 0; bonusGrantId = ""; bonusAmount = 0; prefs.edit().remove("receipt").remove("signature").apply(); }
    protected JSObject state() {
        JSObject r = new JSObject(); r.put("owned", owned); r.put("activatedAt", activatedAt); r.put("status", status);
        r.put("bonusGrantId", bonusGrantId); r.put("bonusAmount", bonusAmount);
        r.put("bonusPending", owned && !bonusGrantId.isEmpty() && !prefs.getBoolean("bonus_claimed:" + bonusGrantId, false));
        r.put("price", price); r.put("canPurchase", configured() && product != null && !price.isEmpty() && !owned && !busy && !opening && !pending && !hasPurchase);
        return r;
    }
    protected void emit() { if (!destroyed) notifyListeners("stateChanged", state()); }
    private void finish(String next) {
        busy = false; status = owned ? "owned" : next; emit();
        recovery.finished(pending || "verification_failed".equals(next) || "unavailable".equals(next));
    }
    private void ensureClient() {
        if (client != null) return;
        client = BillingClient.newBuilder(getContext()).setListener(this)
            .enablePendingPurchases(PendingPurchasesParams.newBuilder().enableOneTimeProducts().build())
            .enableAutoServiceReconnection().build();
    }
    /** Receipt-derived id only; web code cannot invent an entitlement or bonus. */
    @PluginMethod public void acknowledgeBonus(PluginCall call) { main.post(() -> {
        String requested = call.getString("grantId", "");
        boolean acknowledged = false;
        if (owned && !bonusGrantId.isEmpty() && bonusGrantId.equals(requested)) {
            acknowledged = prefs.getBoolean("bonus_claimed:" + bonusGrantId, false)
                || prefs.edit().putBoolean("bonus_claimed:" + bonusGrantId, true).commit();
        }
        JSObject result = new JSObject(); result.put("acknowledged", acknowledged); result.put("state", state());
        call.resolve(result); if (acknowledged) emit();
    }); }
    @PluginMethod public void getCached(PluginCall call) { main.post(() -> call.resolve(state())); }
    @PluginMethod public void refresh(PluginCall call) { main.post(() -> {
        refreshOwned(call.getBoolean("restore", false));
        call.resolve(state());
    }); }
    private void refreshOwned(boolean restore) {
        if (!configured() || destroyed) return;
        if (busy || opening) { recovery.request(); return; }
        restoring = restore;
        busy = true; status = "loading"; emit(); int request = ++generation;
        main.postDelayed(() -> { if (request == generation && busy) { generation++; finish("unavailable"); } }, 20000);
        ensureClient();
        Runnable query = () -> queryOwned(request);
        if (client.isReady()) query.run();
        else client.startConnection(new BillingClientStateListener() {
            @Override public void onBillingSetupFinished(BillingResult result) { main.post(() -> {
                if (request != generation || destroyed) return;
                if (result.getResponseCode() == BillingClient.BillingResponseCode.OK) query.run(); else finish("unavailable");
            }); }
            @Override public void onBillingServiceDisconnected() { /* Automatic reconnect on next request. */ }
        });
    }
    private Purchase matchingPurchase(List<Purchase> purchases) {
        return BillingRecovery.preferred(purchases, p -> p.getProducts().contains(productId())
            && getContext().getPackageName().equals(p.getPackageName()),
            p -> p.getPurchaseState() == Purchase.PurchaseState.PURCHASED, Purchase::getPurchaseTime);
    }
    private void queryOwned(int request) {
        client.queryPurchasesAsync(QueryPurchasesParams.newBuilder().setProductType(BillingClient.ProductType.INAPP).build(), (result, purchases) -> main.post(() -> {
            if (request != generation || destroyed) return;
            if (result.getResponseCode() != BillingClient.BillingResponseCode.OK) { finish("unavailable"); return; }
            Purchase found = matchingPurchase(purchases);
            if (found == null) { pending = false; revoke(); queryProduct(request); }
            else process(found, request);
        }));
    }
    private void queryProduct(int request) {
        QueryProductDetailsParams.Product item = QueryProductDetailsParams.Product.newBuilder().setProductId(productId()).setProductType(BillingClient.ProductType.INAPP).build();
        client.queryProductDetailsAsync(QueryProductDetailsParams.newBuilder().setProductList(Collections.singletonList(item)).build(), (result, details) -> main.post(() -> {
            if (request != generation || destroyed) return;
            product = null; price = ""; offerToken = "";
            if (result.getResponseCode() == BillingClient.BillingResponseCode.OK) for (ProductDetails p : details.getProductDetailsList()) {
                if (!productId().equals(p.getProductId())) continue;
                // Console contract: exactly one full-price permanent buy option, no rental/offer ambiguity.
                List<ProductDetails.OneTimePurchaseOfferDetails> offers = p.getOneTimePurchaseOfferDetailsList();
                if (offers != null && offers.size() == 1 && offers.get(0).getRentalDetails() == null) {
                    product = p; price = offers.get(0).getFormattedPrice(); offerToken = offers.get(0).getOfferToken();
                }
            }
            finish(product == null ? "unavailable" : restoring ? "not_owned" : "ready");
        }));
    }
    @PluginMethod public void purchase(PluginCall call) { main.post(() -> {
        if (!state().optBoolean("canPurchase") || client == null || !client.isReady()) { call.resolve(state()); return; }
        // Refresh before opening the store. Never silently change the displayed price.
        String displayedPrice = price; product = null; busy = true; status = "loading"; emit(); int request = ++generation;
        QueryProductDetailsParams.Product item = QueryProductDetailsParams.Product.newBuilder().setProductId(productId()).setProductType(BillingClient.ProductType.INAPP).build();
        main.postDelayed(() -> { if (request == generation && busy) { generation++; finish("unavailable"); } }, 20000);
        client.queryProductDetailsAsync(QueryProductDetailsParams.newBuilder().setProductList(Collections.singletonList(item)).build(), (result, details) -> main.post(() -> {
            if (request != generation || destroyed) return;
            if (result.getResponseCode() != BillingClient.BillingResponseCode.OK || details.getProductDetailsList().size() != 1) { finish("unavailable"); return; }
            ProductDetails p = details.getProductDetailsList().get(0);
            List<ProductDetails.OneTimePurchaseOfferDetails> offers = p.getOneTimePurchaseOfferDetailsList();
            if (!productId().equals(p.getProductId()) || offers == null || offers.size() != 1 || offers.get(0).getRentalDetails() != null) { finish("unavailable"); return; }
            product = p; price = offers.get(0).getFormattedPrice(); offerToken = offers.get(0).getOfferToken();
            if (!price.equals(displayedPrice)) { finish("price_changed"); return; }
            if ("lifetime_no_ads".equals(productId()) && !prefs.edit().putLong("bonus_offer_opened_at", System.currentTimeMillis()).commit()) { finish("unavailable"); return; }
            busy = false; opening = true; status = "opening"; emit();
            BillingFlowParams.ProductDetailsParams params = BillingFlowParams.ProductDetailsParams.newBuilder().setProductDetails(product).setOfferToken(offerToken).build();
            BillingResult launched = client.launchBillingFlow(getActivity(), BillingFlowParams.newBuilder().setProductDetailsParamsList(Collections.singletonList(params)).build());
            if (launched.getResponseCode() != BillingClient.BillingResponseCode.OK) { prefs.edit().remove("bonus_offer_opened_at").commit(); opening = false; finish("error"); }
            main.postDelayed(() -> { if (opening && request == generation) { opening = false; finish("error"); } }, 180000);
        }));
        call.resolve(state());
    }); }
    @Override public void onPurchasesUpdated(BillingResult result, List<Purchase> purchases) { main.post(() -> {
        if (destroyed) return;
        int code = result.getResponseCode();
        Purchase matching = matchingPurchase(purchases);
        if (!BillingRecovery.handlesUpdate(code == BillingClient.BillingResponseCode.OK, matching != null, opening)) return;
        if (busy) { recovery.request(); return; }
        opening = false; int request = ++generation;
        if (code == BillingClient.BillingResponseCode.USER_CANCELED) { prefs.edit().remove("bonus_offer_opened_at").commit(); finish("cancelled"); return; }
        if (code == BillingClient.BillingResponseCode.ITEM_ALREADY_OWNED) { prefs.edit().remove("bonus_offer_opened_at").commit(); busy = true; main.postDelayed(() -> { if (request == generation && busy) { generation++; finish("unavailable"); } }, 20000); queryOwned(request); return; }
        if (code == BillingClient.BillingResponseCode.OK && matching != null) { process(matching, request); return; }
        finish("error");
    }); }
    private void process(Purchase purchase, int request) {
        hasPurchase = true;
        // Tag only flows opened by this version; restored old/pending purchases keep their original offer.
        long openedAt = prefs.getLong("bonus_offer_opened_at", 0);
        if ("lifetime_no_ads".equals(productId()) && openedAt > 0) {
            SharedPreferences.Editor offer = prefs.edit().remove("bonus_offer_opened_at");
            if (BonusGrant.openedForPurchase(openedAt, purchase.getPurchaseTime())) offer.putInt(BonusGrant.offerKey(purchase.getPurchaseToken()), 2);
            if (!offer.commit()) { finish("verification_failed"); return; }
        }
        final int bonusOfferVersion = prefs.getInt(BonusGrant.offerKey(purchase.getPurchaseToken()), 0);
        pending = purchase.getPurchaseState() == Purchase.PurchaseState.PENDING;
        if (pending) { revoke(); hasPurchase = true; finish("pending"); return; }
        if (purchase.getPurchaseState() != Purchase.PurchaseState.PURCHASED || !getContext().getPackageName().equals(purchase.getPackageName())) { finish("error"); return; }
        busy = true; status = "verifying"; emit();
        main.postDelayed(() -> { if (request == generation && busy) { generation++; finish("verification_failed"); } }, 20000);
        worker.execute(() -> {
            String payload = null, signature = null; boolean revoked = false;
            HttpURLConnection connection = null;
            try {
                connection = (HttpURLConnection) new URL(verificationUrl()).openConnection();
                connection.setConnectTimeout(6000); connection.setReadTimeout(10000); connection.setInstanceFollowRedirects(false);
                connection.setRequestMethod("POST"); connection.setDoOutput(true); connection.setRequestProperty("Content-Type", "application/json");
                JSONObject body = new JSONObject(); body.put("purchaseToken", purchase.getPurchaseToken()); body.put("installationId", installId);
                if ("lifetime_no_ads".equals(productId()) && bonusOfferVersion == 2) body.put("bonusOfferVersion", 2);
                byte[] bytes = body.toString().getBytes(StandardCharsets.UTF_8); connection.setFixedLengthStreamingMode(bytes.length);
                try (java.io.OutputStream output = connection.getOutputStream()) { output.write(bytes); }
                if (connection.getResponseCode() == 200) {
                    ByteArrayOutputStream buffer = new ByteArrayOutputStream();
                    try (InputStream input = connection.getInputStream()) { byte[] chunk = new byte[2048]; int n; while ((n = input.read(chunk)) != -1) { if (buffer.size() + n > 16384) throw new java.io.IOException("Receipt too large"); buffer.write(chunk, 0, n); } }
                    JSONObject response = new JSONObject(buffer.toString("UTF-8"));
                    payload = response.getString("payload"); signature = response.getString("signature");
                    // Both grants and revocations must be signed for this installation/product.
                    if (ReceiptSignature.verify(Base64.decode(BuildConfig.BILLING_PUBLIC_KEY, Base64.DEFAULT), payload.getBytes(StandardCharsets.UTF_8), Base64.decode(signature, Base64.DEFAULT))) {
                        JSONObject r = new JSONObject(payload);
                        revoked = !r.getBoolean("owned") && installId.equals(r.getString("installationId")) && productId().equals(r.getString("productId")) && getContext().getPackageName().equals(r.getString("packageName"));
                    }
                }
            } catch (Exception unavailable) { /* Retain a previously verified receipt on transient failures. Never log tokens. */ }
            finally { if (connection != null) connection.disconnect(); }
            final String data = payload, sig = signature; final boolean remove = revoked;
            main.post(() -> {
                if (request != generation || destroyed) return;
                if (remove) { revoke(); pending = false; finish("revoked"); return; }
                if (data != null && sig != null && validReceipt(data, sig)) {
                    if (!prefs.edit().putString("receipt", data).putString("signature", sig).commit()) { finish("verification_failed"); return; }
                    readReceipt(); pending = false; finish("owned");
                } else finish("verification_failed");
            });
        });
    }
    @Override protected void handleOnResume() { super.handleOnResume(); recovery.resume(); }
    @Override protected void handleOnPause() { recovery.pause(); super.handleOnPause(); }
    @Override protected void handleOnDestroy() { recovery.destroy(); destroyed = true; generation++; main.removeCallbacksAndMessages(null); if (client != null) client.endConnection(); worker.shutdownNow(); super.handleOnDestroy(); }
}
