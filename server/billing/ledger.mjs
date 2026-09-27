import fs from 'node:fs/promises';
import path from 'node:path';
import {PRODUCT,NO_ADS_PRODUCT,BONUS_GOLD,LEGACY_BONUS_GOLD} from './verify.mjs';

/** Single-process durable ledger, serialized per token by createVerifier. */
export function createFileLedger(directory){
 const fileFor=hash=>{if(!/^[a-f0-9]{64}$/.test(hash))throw Error('invalid_ledger_key');return path.join(directory,hash+'.json');};
 const read=async file=>{try{return JSON.parse(await fs.readFile(file,'utf8'));}catch(error){if(error.code!=='ENOENT')throw error;return null;}};
 const write=async(file,record)=>{
  const handle=await fs.open(file+'.tmp','w',0o600);try{await handle.writeFile(JSON.stringify(record));await handle.sync();}finally{await handle.close();}
  await fs.rename(file+'.tmp',file);
  const dir=await fs.open(directory,'r');try{await dir.sync();}finally{await dir.close();}
 };
 return {
  async readDiamond(hash){return read(fileFor(hash));},
  async reserveDiamond(hash,token,at,productId,installationId,amount){
   const file=fileFor(hash),prior=await read(file);
   if(prior?.productId&&prior.productId!==productId)throw Error("invalid_ledger_product");
   const record={...prior,purchaseToken:token,productId,activatedAt:prior?.activatedAt??at,deliveryInstallationId:prior?.deliveryInstallationId??installationId,amount,revoked:false,consumed:prior?.consumed===true};
   await write(file,record);return record;
  },
  async completeDiamond(hash,installationId){
   const file=fileFor(hash),record=await read(file);
   if(!record||record.deliveryInstallationId!==installationId)throw Error("invalid_purchase");
   record.consumed=true;await write(file,record);
  },
  async grant(hash,token,at,{productId=PRODUCT,installationId='',bonusGold=0}={}){
   const file=fileFor(hash),existing=await read(file);
   if(existing?.productId&&existing.productId!==productId)throw Error('invalid_ledger_product');
   const record={...existing,purchaseToken:token,productId,activatedAt:existing?.activatedAt??at,revoked:false};
   // First successful verification reserves this purchase's one gold grant.
   // Another installation may restore the entitlement but cannot multiply gold.
   if(productId===NO_ADS_PRODUCT&&[BONUS_GOLD,LEGACY_BONUS_GOLD].includes(bonusGold)){
    if(existing?.bonusGold!==undefined&&![BONUS_GOLD,LEGACY_BONUS_GOLD].includes(existing.bonusGold))throw Error('invalid_ledger_bonus');
    record.bonusInstallationId=existing?.bonusInstallationId??installationId;
    record.bonusGold=existing?.bonusGold??(existing?LEGACY_BONUS_GOLD:bonusGold);
   }
   await write(file,record);return record;
  },
  async revoke(hash){const file=fileFor(hash),record=await read(file);if(record){record.revoked=true;await write(file,record);}}
 };
}
