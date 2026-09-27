import {expect,it,vi} from 'vitest';
import {LifetimeNoAds,OfflinePass,type NoAdsPurchasePort,type PurchaseState} from '../src/platform/purchases';
const grantId='lifetime_no_ads:'+ 'a'.repeat(64);
const owned=():PurchaseState=>({owned:true,activatedAt:1000,status:'owned',price:'$0.99',canPurchase:false,bonusGrantId:grantId,bonusAmount:300000,bonusPending:true});
function setup(){let claimed=false,listener:(state:PurchaseState)=>void=()=>{};const state=()=>({...owned(),bonusPending:!claimed});const port:NoAdsPurchasePort={getCached:vi.fn(async()=>state()),refresh:vi.fn(async()=>state()),purchase:vi.fn(async()=>state()),addListener:vi.fn(async(_name,fn)=>{listener=fn;return {remove:async()=>{}};}),acknowledgeBonus:vi.fn(async({grantId:id})=>{if(id===grantId)claimed=true;return {acknowledged:claimed,state:state()};})};return {port,emit:(s:PurchaseState)=>listener(s)};}
it('never grants ownership, invents a price or grants currency on the web',async()=>{const pass=new LifetimeNoAds(null);await pass.loadCached();await pass.refresh();await pass.purchase();expect(pass.owned).toBe(false);expect(pass.state.price).toBe('');expect(pass.state.bonusPending).not.toBe(true);expect(await pass.acknowledgeBonus(grantId)).toBe(false);});
it('exposes a stable verified bonus until the game persists and acknowledges it, then stays claimed after wrapper reload',async()=>{const {port}=setup(),pass=new LifetimeNoAds(port);await pass.loadCached();expect(pass.state.bonusGrantId).toBe(grantId);expect(pass.state.bonusPending).toBe(true);expect(await pass.acknowledgeBonus('forged')).toBe(false);expect(port.acknowledgeBonus).not.toHaveBeenCalled();expect(await pass.acknowledgeBonus(grantId)).toBe(true);expect(pass.state.bonusPending).toBe(false);const restored=new LifetimeNoAds(port);await restored.loadCached();expect(restored.owned).toBe(true);expect(restored.state.bonusPending).toBe(false);});
it('accepts a legacy 300k pending native grant and preserves its amount',async()=>{const {port}=setup();port.getCached=async()=>({...owned(),bonusAmount:300000});const pass=new LifetimeNoAds(port);await pass.loadCached();expect(pass.state.bonusAmount).toBe(300000);expect(pass.state.bonusPending).toBe(true);});
it('retains a pending bonus after bridge failure so save-before-ack can recover without granting twice',async()=>{const {port}=setup(),pass=new LifetimeNoAds(port);await pass.loadCached();port.acknowledgeBonus=async()=>{throw Error('bridge disappeared');};expect(await pass.acknowledgeBonus(grantId)).toBe(false);expect(pass.state.bonusPending).toBe(true);});
it('carries ad removal and the offline manager on the one purchase, without repeating the gold gift',async()=>{const {port}=setup();port.getCached=async()=>({...owned(),bonusGrantId:'',bonusAmount:0,bonusPending:false});const pack=new LifetimeNoAds(port);await pack.loadCached();
 expect(pack.owned).toBe(true);expect(pack.state.bonusPending).toBe(false);
 // The pack is the offline entitlement too, so paid offline work reads the same verified state.
 expect(pack).toBeInstanceOf(OfflinePass);expect(pack.activatedAt).toBeGreaterThan(0);
 const web=new LifetimeNoAds(null);await web.loadCached();expect(web.owned).toBe(false);expect(web.activatedAt).toBe(0);});
it('rejects malformed bonus data and clears pending currency after revocation',async()=>{const {port,emit}=setup(),pass=new LifetimeNoAds(port);await pass.refresh();for(const patch of [{bonusAmount:2000000},{bonusGrantId:'offline_cafe_manager:'+ 'a'.repeat(64)},{owned:false},{activatedAt:0}]){emit({...owned(),...patch});expect(pass.state.bonusPending).toBe(false);}emit({...owned(),owned:false,status:'revoked',activatedAt:0});expect(pass.owned).toBe(false);expect(pass.state.bonusGrantId).toBe('');});

it('subscribes when native foreground verification is already busy and receives its completion',async()=>{
 const {port,emit}=setup();port.getCached=async()=>({...owned(),owned:false,activatedAt:0,status:'verifying',bonusPending:false});
 const pass=new LifetimeNoAds(port);await pass.loadCached();await pass.refresh();
 expect(port.addListener).toHaveBeenCalledTimes(1);expect(port.refresh).not.toHaveBeenCalled();
 emit(owned());expect(pass.owned).toBe(true);expect(pass.busy).toBe(false);expect(pass.state.bonusPending).toBe(true);
});
it('recovers completion between initial busy cache and listener attachment',async()=>{
 const {port}=setup();port.getCached=vi.fn().mockResolvedValueOnce({...owned(),owned:false,activatedAt:0,status:'loading'}).mockResolvedValue(owned());
 const pass=new LifetimeNoAds(port);await pass.loadCached();await pass.refresh();
 expect(pass.owned).toBe(true);expect(pass.busy).toBe(false);expect(port.addListener).toHaveBeenCalledTimes(1);
});
it('does not overwrite a new native completion with an older busy cache response',async()=>{
 const {port,emit}=setup();const busy:PurchaseState={...owned(),owned:false,activatedAt:0,status:'loading'};
 port.getCached=vi.fn().mockResolvedValueOnce(busy).mockImplementationOnce(async()=>{emit(owned());return busy;});
 const pass=new LifetimeNoAds(port);await pass.loadCached();await pass.refresh();
 expect(pass.owned).toBe(true);expect(pass.state.status).toBe('owned');
});
