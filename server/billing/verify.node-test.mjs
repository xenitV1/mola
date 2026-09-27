import test from 'node:test';
import assert from 'node:assert/strict';
import {generateKeyPairSync,verify} from 'node:crypto';
import {createVerifier,PRODUCT,PACKAGE} from './verify.mjs';
const keys=generateKeyPairSync('rsa',{modulusLength:2048}),request={purchaseToken:'unit-test-purchase-token',installationId:'12345678-1234-1234-1234-123456789abc'};
function setup(purchase={purchaseState:0,consumptionState:0,acknowledgementState:0,purchaseTimeMillis:'100',productId:PRODUCT}){
 let acknowledgments=0,at=1000;const rows=new Map();
 const google={get:async()=>purchase,acknowledge:async()=>{acknowledgments++;purchase.acknowledgementState=1;}};
 const ledger={grant:async(hash,token,now)=>{if(!rows.has(hash))rows.set(hash,{activatedAt:now});return rows.get(hash);},revoke:async hash=>rows.delete(hash)};
 return {verify:createVerifier({google,ledger,privateKey:keys.privateKey,now:()=>at}),google,rows,setTime:v=>at=v,acks:()=>acknowledgments};
}
test('verified non-consumable signs product/install-bound receipt and acknowledges once across concurrent retries',async()=>{const s=setup();const results=await Promise.all([s.verify(request),s.verify(request)]);assert.equal(s.acks(),1);assert.equal(s.rows.size,1);for(const r of results){assert(verify('RSA-SHA256',Buffer.from(r.payload),keys.publicKey,Buffer.from(r.signature,'base64')));const data=JSON.parse(r.payload);assert.equal(data.owned,true);assert.equal(data.productId,PRODUCT);assert.equal(data.packageName,PACKAGE);assert.equal(data.installationId,request.installationId);assert(!r.payload.includes(request.purchaseToken));}s.setTime(9000);assert.equal(JSON.parse((await s.verify(request)).payload).activatedAt,1000);});
test('pending and invalid purchases never grant or acknowledge',async()=>{for(const purchase of [{purchaseState:2},{purchaseState:0,consumptionState:1},{purchaseState:0,consumptionState:0,productId:'wrong'},{purchaseState:0,consumptionState:0,quantity:2},{purchaseState:0,consumptionState:0,refundableQuantity:0}]){const s=setup(purchase);await assert.rejects(s.verify(request));assert.equal(s.acks(),0);assert.equal(s.rows.size,0);}});
test('refund and removed purchase return signed revocation instead of an entitlement',async()=>{for(const purchase of [{purchaseState:1},{notFound:true}]){const s=setup(purchase),r=await s.verify(request);assert.equal(JSON.parse(r.payload).owned,false);assert(verify('RSA-SHA256',Buffer.from(r.payload),keys.publicKey,Buffer.from(r.signature,'base64')));assert.equal(s.acks(),0);}});
test('Google or acknowledgment outage never returns an unverified successful receipt',async()=>{const s=setup();s.google.get=async()=>{throw Error('network');};await assert.rejects(s.verify(request));const retry=setup();retry.google.acknowledge=async()=>{throw Error('timeout');};await assert.rejects(retry.verify(request));assert.equal(retry.rows.size,1);retry.setTime(2000);retry.google.acknowledge=async()=>{};assert.equal(JSON.parse((await retry.verify(request)).payload).activatedAt,1000);});
test('restore binds a new signed receipt to the new installation while keeping activation',async()=>{const s=setup();await s.verify(request);s.setTime(2000);const restored=JSON.parse((await s.verify({...request,installationId:'abcdef12-1234-1234-1234-123456789abc'})).payload);assert.equal(restored.activatedAt,1000);assert.notEqual(restored.installationId,request.installationId);assert.equal(s.acks(),1);});
test('rejects malformed requests before contacting Google',async()=>{const s=setup();s.google.get=()=>{throw Error('must not contact Google');};for(const input of [{},{...request,installationId:'../bad'},{...request,purchaseToken:'x'.repeat(5000)}])await assert.rejects(s.verify(input),/invalid_request/);});

import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import {NO_ADS_PRODUCT,BONUS_GOLD,LEGACY_BONUS_GOLD} from './verify.mjs';
import {createFileLedger} from './ledger.mjs';
test('lifetime purchase restores entitlement across devices but reserves gold once in the durable ledger',async()=>{
 const directory=await fs.mkdtemp(path.join(os.tmpdir(),'cafe-billing-test-'));
 try {
  const purchase={purchaseState:0,consumptionState:0,acknowledgementState:0,purchaseTimeMillis:'100',productId:NO_ADS_PRODUCT};let acks=0;
  const google={get:async(_token,id)=>{assert.equal(id,NO_ADS_PRODUCT);return purchase;},acknowledge:async()=>{acks++;purchase.acknowledgementState=1;}};
  const build=()=>createVerifier({productId:NO_ADS_PRODUCT,google,ledger:createFileLedger(directory),privateKey:keys.privateKey,now:()=>1000});
  const verifier=build();const results=await Promise.all([verifier(request),verifier(request)]);
  const first=JSON.parse(results[0].payload);assert.equal(first.owned,true);assert.equal(first.bonusEligible,true);assert.equal(first.bonusAmount,LEGACY_BONUS_GOLD);assert.equal(acks,1);
  assert(verify('RSA-SHA256',Buffer.from(results[0].payload),keys.publicKey,Buffer.from(results[0].signature,'base64')));
  const restarted=build(),same=JSON.parse((await restarted(request)).payload);assert.equal(same.purchaseHash,first.purchaseHash);assert.equal(same.bonusEligible,true);
  const other=JSON.parse((await restarted({...request,installationId:'abcdef12-1234-1234-1234-123456789abc'})).payload);assert.equal(other.owned,true);assert.equal(other.bonusEligible,false);assert.equal(other.bonusAmount,0);assert.equal(other.activatedAt,first.activatedAt);
  purchase.purchaseState=1;const revoked=JSON.parse((await restarted(request)).payload);assert.equal(revoked.owned,false);assert(!revoked.bonusEligible);
  const file=path.join(directory,first.purchaseHash+'.json');assert.equal(JSON.parse(await fs.readFile(file,'utf8')).revoked,true);
  assert.equal((await fs.stat(file)).mode&0o777,0o600);
 } finally {await fs.rm(directory,{recursive:true,force:true});}
});
test('the two products use isolated ledger keys and reject a receipt for the other product',async()=>{
 const seen=[];const ledger={grant:async(hash,_token,at,meta)=>{seen.push(hash);return {activatedAt:at,bonusInstallationId:meta.installationId,bonusGold:meta.bonusGold};},revoke:async hash=>seen.push(hash)};
 const good=id=>({purchaseState:0,consumptionState:0,acknowledgementState:1,purchaseTimeMillis:'100',productId:id});
 const offline=createVerifier({google:{get:async()=>good(PRODUCT)},ledger,privateKey:keys.privateKey,now:()=>1000});
 const lifetime=createVerifier({productId:NO_ADS_PRODUCT,google:{get:async()=>good(NO_ADS_PRODUCT)},ledger,privateKey:keys.privateKey,now:()=>1000});
 assert(!JSON.parse((await offline(request)).payload).bonusEligible);assert(JSON.parse((await lifetime(request)).payload).bonusEligible);assert.notEqual(seen[0],seen[1]);
 const wrong=createVerifier({productId:NO_ADS_PRODUCT,google:{get:async()=>good(PRODUCT)},ledger,privateKey:keys.privateKey});await assert.rejects(wrong(request),/invalid_purchase/);
 assert.throws(()=>createVerifier({productId:'client_invented',google:{},ledger,privateKey:keys.privateKey}),/unsupported_product/);
});
test('lifetime pending, consumption and acknowledgment failure do not issue successful bonus receipts',async()=>{
 for(const purchase of [{purchaseState:2},{purchaseState:0,consumptionState:1,productId:NO_ADS_PRODUCT},{purchaseState:0,consumptionState:0,acknowledgementState:0,purchaseTimeMillis:'100',productId:NO_ADS_PRODUCT}]){
  const verifier=createVerifier({productId:NO_ADS_PRODUCT,google:{get:async()=>purchase,acknowledge:async()=>{throw Error('ack_outage');}},ledger:{grant:async()=>({activatedAt:1000,bonusInstallationId:request.installationId})},privateKey:keys.privateKey});await assert.rejects(verifier(request));
 }
});

test('50k offers persist through retry, restart and legacy restore without changing an older 300k grant',async t=>{
 const directory=await fs.mkdtemp(path.join(os.tmpdir(),'cafe-bonus-version-'));t.after(()=>fs.rm(directory,{recursive:true,force:true}));
 let failAck=true;
 const google={get:async()=>({purchaseState:0,consumptionState:0,acknowledgementState:0,purchaseTimeMillis:'100',productId:NO_ADS_PRODUCT}),acknowledge:async()=>{if(failAck)throw Error('ack_outage');}};
 const build=()=>createVerifier({productId:NO_ADS_PRODUCT,google,ledger:createFileLedger(directory),privateKey:keys.privateKey,now:()=>1000});
 const modern={...request,bonusOfferVersion:2};
 await assert.rejects(build()(modern),/ack_outage/);failAck=false;
 const fresh=JSON.parse((await build()(modern)).payload);assert.equal(fresh.bonusAmount,50000);assert.equal(fresh.bonusAmount,BONUS_GOLD);
 const legacyRestore=JSON.parse((await build()(request)).payload);assert.equal(legacyRestore.bonusAmount,50000);assert.equal(legacyRestore.purchaseHash,fresh.purchaseHash);
 const old={...request,purchaseToken:'another-old-purchase-token'};
 const before=JSON.parse((await build()(old)).payload);assert.equal(before.bonusAmount,300000);
 const after=JSON.parse((await build()({...old,bonusOfferVersion:2})).payload);assert.equal(after.bonusAmount,300000);assert.equal(after.purchaseHash,before.purchaseHash);
 const other=JSON.parse((await build()({...modern,installationId:'abcdef12-1234-1234-1234-123456789abc'})).payload);assert.equal(other.bonusEligible,false);assert.equal(other.bonusAmount,0);
 for(const invalid of [0,1,3,'2',null])await assert.rejects(build()({...request,bonusOfferVersion:invalid}),/invalid_request/);
});
