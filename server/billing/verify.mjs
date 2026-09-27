import {createHash,sign} from 'node:crypto';
export const PRODUCT='offline_cafe_manager', NO_ADS_PRODUCT='lifetime_no_ads', BONUS_GOLD=50000, LEGACY_BONUS_GOLD=300000, PACKAGE='com.example.mola';
export const hashToken=token=>createHash('sha256').update(token).digest('hex');
// Google and ledger are explicit dependencies for deterministic tests, never client-selected endpoints.
export function createVerifier({google,ledger,privateKey,now=Date.now,productId=PRODUCT}){
 if(![PRODUCT,NO_ADS_PRODUCT].includes(productId))throw Error('unsupported_product');
 const inFlight=new Map();
 return async({purchaseToken,installationId,bonusOfferVersion})=>{
  if(typeof purchaseToken!=='string'||purchaseToken.length<10||purchaseToken.length>4096||typeof installationId!=='string'||!/^[0-9a-f-]{36}$/i.test(installationId))throw Error('invalid_request');
  if(bonusOfferVersion!==undefined&&(productId!==NO_ADS_PRODUCT||bonusOfferVersion!==2))throw Error('invalid_request');
  const hash=hashToken(productId===PRODUCT?purchaseToken:`${productId}:${purchaseToken}`);
  const prior=inFlight.get(hash)??Promise.resolve();
  const work=prior.catch(()=>{}).then(async()=>{
   const purchase=await google.get(purchaseToken,productId);
   if(purchase.purchaseState===2)throw Error('pending');
   const verifiedAt=now();
   const signed=fields=>{const payload=JSON.stringify({version:1,productId,packageName:PACKAGE,installationId,purchaseHash:hash,verifiedAt,...fields});return {payload,signature:sign('RSA-SHA256',Buffer.from(payload),privateKey).toString('base64')};};
   if(purchase.purchaseState===1||purchase.notFound===true){await ledger.revoke(hash);return signed({owned:false,activatedAt:0});}
   if(purchase.purchaseState!==0||purchase.consumptionState!==0||(purchase.productId&&purchase.productId!==productId)||(purchase.quantity??1)!==1||(purchase.refundableQuantity??1)!==1)throw Error('invalid_purchase');
   if(!Number.isFinite(Number(purchase.purchaseTimeMillis))||Number(purchase.purchaseTimeMillis)<=0)throw Error('invalid_purchase');
   // Durable, idempotent grant before acknowledgment; retry after process death uses the same activation time.
   const offeredGold=bonusOfferVersion===2?BONUS_GOLD:LEGACY_BONUS_GOLD;
   const entry=await ledger.grant(hash,purchaseToken,verifiedAt,{productId,installationId,bonusGold:productId===NO_ADS_PRODUCT?offeredGold:0});
   if(purchase.acknowledgementState!==1)await google.acknowledge(purchaseToken,productId);
   const bonusEligible=productId===NO_ADS_PRODUCT&&entry.bonusInstallationId===installationId;
   if(bonusEligible&&![BONUS_GOLD,LEGACY_BONUS_GOLD].includes(entry.bonusGold))throw Error('invalid_ledger_bonus');
   return signed({owned:true,activatedAt:entry.activatedAt,...(productId===NO_ADS_PRODUCT?{bonusEligible,bonusAmount:bonusEligible?entry.bonusGold:0}: {})});
  });
  inFlight.set(hash,work);try{return await work;}finally{if(inFlight.get(hash)===work)inFlight.delete(hash);}
 };
}
