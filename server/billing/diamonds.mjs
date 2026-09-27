import {sign} from 'node:crypto';
import {hashToken,PACKAGE} from './verify.mjs';
export const DIAMOND_PRODUCTS=Object.freeze({diamonds_100:100,diamonds_500:500,diamonds_5000:5000,diamonds_10000:10000});
/** One process serializes verify + consume together; first installation owns delivery. */
export function createDiamondVerifier({google,ledger,privateKey,now=Date.now}){
 const inFlight=new Map();
 return async({purchaseToken,installationId,productId,action='verify'})=>{
  if(!Object.hasOwn(DIAMOND_PRODUCTS,productId)||!['verify','consume'].includes(action)||typeof purchaseToken!=='string'||purchaseToken.length<10||purchaseToken.length>4096||typeof installationId!=='string'||!/^[0-9a-f-]{36}$/i.test(installationId))throw Error('invalid_request');
  const hash=hashToken(`${productId}:${purchaseToken}`),prior=inFlight.get(hash)??Promise.resolve();
  const work=prior.catch(()=>{}).then(async()=>{
   const purchase=await google.get(purchaseToken,productId),at=now();
   const signed=fields=>{const payload=JSON.stringify({version:1,productId,packageName:PACKAGE,installationId,purchaseHash:hash,verifiedAt:at,...fields});return{payload,signature:sign('RSA-SHA256',Buffer.from(payload),privateKey).toString('base64')};};
   let entry=await ledger.readDiamond(hash);
   if(purchase.purchaseState===2)throw Error('pending');
   if(purchase.purchaseState===1||purchase.notFound===true){
    // Google may remove a consumed token from lookup. Only our durable completion
    // proves delivery; a missing unconsumed token is a revocation, never a grant.
    if(purchase.notFound===true&&entry?.consumed)return signed({owned:true,grantPending:false,amount:DIAMOND_PRODUCTS[productId],consumed:true});
    await ledger.revoke(hash);return signed({owned:false,grantPending:false,amount:0,consumed:false});
   }
   if(purchase.purchaseState!==0||(purchase.productId&&purchase.productId!==productId)||(purchase.quantity??1)!==1||(purchase.refundableQuantity??1)!==1||!Number.isFinite(Number(purchase.purchaseTimeMillis))||Number(purchase.purchaseTimeMillis)<=0||![0,1].includes(purchase.consumptionState))throw Error('invalid_purchase');
   if(purchase.consumptionState===1){
    if(!entry)throw Error('invalid_purchase');
    await ledger.completeDiamond(hash,entry.deliveryInstallationId);
    return signed({owned:true,grantPending:false,amount:DIAMOND_PRODUCTS[productId],consumed:true});
   }
   if(action==='consume'){
    if(!entry||entry.deliveryInstallationId!==installationId||entry.productId!==productId||entry.revoked)throw Error('invalid_purchase');
    // Native calls this only after the game persisted credit and native saved ack.
    // Consumption also acknowledges the purchase. No earlier acknowledge call.
    await google.consume(purchaseToken,productId);
    await ledger.completeDiamond(hash,installationId);
    return signed({owned:true,grantPending:false,amount:DIAMOND_PRODUCTS[productId],consumed:true});
   }
   entry=await ledger.reserveDiamond(hash,purchaseToken,at,productId,installationId,DIAMOND_PRODUCTS[productId]);
   return signed({owned:true,grantPending:!entry.consumed&&entry.deliveryInstallationId===installationId,amount:DIAMOND_PRODUCTS[productId],consumed:entry.consumed===true});
  });
  inFlight.set(hash,work);try{return await work;}finally{if(inFlight.get(hash)===work)inFlight.delete(hash);}
 };
}
