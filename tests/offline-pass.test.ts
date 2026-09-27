import {describe,it,expect,vi,afterEach} from 'vitest';
import {Simulation,actor,newBranch} from '../src/game/sim';
import {OfflinePass,LifetimeNoAds,type NoAdsPurchasePort,type PurchasePort,type PurchaseState} from '../src/platform/purchases';
const state=(overrides:Partial<PurchaseState>={}):PurchaseState=>({owned:false,activatedAt:0,status:'ready',price:'TEST PRICE',canPurchase:true,...overrides});
function fakePort(){let listener:(s:PurchaseState)=>void=()=>{};const port:PurchasePort={getCached:vi.fn(async()=>state({status:'unavailable',canPurchase:false})),refresh:vi.fn(async()=>state()),purchase:vi.fn(async()=>state({status:'opening',canPurchase:false})),addListener:vi.fn(async(_event,cb)=>{listener=cb;return {remove:async()=>{}};})};return {port,emit:(value:PurchaseState)=>listener(value)};}
function staffed(){const g=new Simulation();g.s.coins=10000;g.s.totalServed=40;g.s.milestone=20;g.b.served=40;g.upgrade('table');for(const role of ['barista','waiter','supplier','cleaner','dishwasher'] as const)g.hire(role);g.s.player=actor({x:0,z:5.8});g.s.savedAt=1000;return g;}
afterEach(()=>vi.useRealTimers());
describe('paid offline work',()=>{
 it('does not progress or award anything without paid access, and consumes the closed interval',()=>{const g=staffed(),coins=g.s.coins,b=structuredClone(g.b);expect(g.offline(3601000).amount).toBe(0);expect(g.b).toEqual(b);expect(g.s.coins).toBe(coins);expect(g.s.savedAt).toBe(3601000);expect(g.offline(3601000,true,3601000).amount).toBe(0);});
 it('only simulates time after activation and does not repeat a return',()=>{const g=staffed();const report=g.offline(3601000,true,1801000);expect(report.seconds).toBe(1800);expect(report.amount).toBeGreaterThan(0);expect(g.offline(3601000,true,1801000).amount).toBe(0);});
 it('ignores a forged save flag and rejects invalid activation times',()=>{const g=staffed();Object.assign(g.s,{offlineOwned:true});expect(g.offline(3601000).amount).toBe(0);expect(g.offline(7201000,true,NaN).amount).toBe(0);});
 it('runs paid offline work from the single unlock pack, not a second purchase',async()=>{
  const grantId='lifetime_no_ads:'+'a'.repeat(64);
  const packState=():PurchaseState=>({owned:true,activatedAt:1801000,status:'owned',price:'$1.99',canPurchase:false,bonusGrantId:grantId,bonusAmount:300000,bonusPending:false});
  const port={getCached:async()=>packState(),refresh:async()=>packState(),purchase:async()=>packState(),acknowledgeBonus:async()=>({acknowledged:true,state:packState()}),addListener:async()=>({remove:async()=>{}})} as unknown as NoAdsPurchasePort;
  const pack=new LifetimeNoAds(port);await pack.loadCached();
  expect(pack.owned).toBe(true);
  const g=staffed(),report=g.offline(3601000,pack.owned,pack.activatedAt);
  expect(report.seconds).toBe(1800);expect(report.amount).toBeGreaterThan(0);
 });
 it('continues other staffed cafés while the app is open without a purchase',()=>{const g=staffed();g.s.branches[1]=newBranch();g.switchBranch(1);const before=g.s.branches[0].served;for(let i=0;i<900;i++)g.step(.1);expect(g.s.branches[0].served).toBeGreaterThan(before);});
});
describe('store state handling with explicit test ports',()=>{
 it('never invents a price or grants ownership on web',async()=>{const pass=new OfflinePass(null);await pass.loadCached();await pass.refresh();await pass.purchase();expect(pass.owned).toBe(false);expect(pass.state.price).toBe('');expect(pass.state.canPurchase).toBe(false);});
 it('keeps paid ownership from verified native cache when the store is offline',async()=>{const {port}=fakePort();port.getCached=async()=>state({owned:true,activatedAt:1000,status:'owned',canPurchase:false});port.refresh=async()=>{throw Error('offline');};const pass=new OfflinePass(port);await pass.loadCached();await pass.refresh();expect(pass.owned).toBe(true);expect(pass.activatedAt).toBe(1000);expect(pass.state.canPurchase).toBe(false);});
 it('does not unlock on opening, pending, cancelled or failed payment',async()=>{const {port,emit}=fakePort();const pass=new OfflinePass(port);await pass.refresh();await pass.purchase();expect(pass.busy).toBe(true);expect(pass.owned).toBe(false);for(const status of ['pending','cancelled','verification_failed'] as const){emit(state({status,canPurchase:false}));expect(pass.owned).toBe(false);}expect(port.purchase).toHaveBeenCalledTimes(1);});
 it('accepts a verified restore once and removes refunded ownership',async()=>{const {port,emit}=fakePort();const pass=new OfflinePass(port);await pass.refresh();emit(state({owned:true,activatedAt:1234,status:'owned',canPurchase:false}));await pass.purchase();expect(port.purchase).not.toHaveBeenCalled();expect(pass.owned).toBe(true);emit(state({status:'revoked',canPurchase:false}));expect(pass.owned).toBe(false);});
 it('prevents double checkout and stale bridge responses from overwriting a completed purchase',async()=>{const {port,emit}=fakePort();const pass=new OfflinePass(port);await pass.refresh();let release!:(s:PurchaseState)=>void;port.purchase=vi.fn(()=>new Promise<PurchaseState>(r=>release=r));const first=pass.purchase();await pass.purchase();emit(state({owned:true,activatedAt:1234,status:'owned',canPurchase:false}));release(state({status:'opening',canPurchase:false}));await first;expect(pass.owned).toBe(true);expect(port.purchase).toHaveBeenCalledTimes(1);});
 it('explicit restore requests reach the platform and can report no previous purchase',async()=>{const {port}=fakePort();port.refresh=vi.fn(async()=>state({status:'not_owned'}));const pass=new OfflinePass(port);await pass.refresh(true);expect(port.refresh).toHaveBeenCalledWith({restore:true});expect(pass.state.status).toBe('not_owned');expect(pass.owned).toBe(false);});
 it('bounds cache loading when a native bridge never answers',async()=>{vi.useFakeTimers();const {port}=fakePort();port.getCached=()=>new Promise(()=>{});const pass=new OfflinePass(port);const loading=pass.loadCached();await vi.advanceTimersByTimeAsync(3000);await loading;expect(pass.owned).toBe(false);});
});
