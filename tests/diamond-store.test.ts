import {expect,it,vi} from 'vitest';
import {DiamondStore,DIAMOND_PACKS,type DiamondPurchasePort,type DiamondState} from '../src/platform/purchases';
const grantId='diamonds:'+'a'.repeat(64),grant={grantId,productId:'diamonds_100' as const,amount:100};
const ready=():DiamondState=>({status:'ready',products:Object.entries(DIAMOND_PACKS).map(([productId,amount])=>({productId:productId as keyof typeof DIAMOND_PACKS,amount,price:productId==='diamonds_100'?'$4.99':'€8.99',canPurchase:true})),grants:[]});
function setup(){let listener:(s:DiamondState)=>void=()=>{},s=ready();const port:DiamondPurchasePort={getCached:vi.fn(async()=>s),refresh:vi.fn(async()=>s),purchase:vi.fn(async()=>({...s,status:'pending' as const})),acknowledgeGrant:vi.fn(async()=>{s={...s,grants:[]};return {acknowledged:true,state:s};}),addListener:vi.fn(async(_event,fn)=>{listener=fn;return {remove:async()=>{}};})};return {port,emit:(value:DiamondState)=>{s=value;listener(value);},set:(value:DiamondState)=>{s=value;}};}
it('web exposes all four pack amounts with no invented store prices or purchases',async()=>{const s=new DiamondStore(null);await s.loadCached();await s.refresh();await s.purchase('diamonds_100');expect(s.state.products.map(p=>p.amount)).toEqual([100,500,5000,10000]);expect(s.state.products.every(p=>!p.canPurchase&&!p.price)).toBe(true);expect(s.state.grants).toEqual([]);});
it('only exact signed-contract pack amounts and unique stable grant IDs reach wallet',async()=>{const f=setup(),s=new DiamondStore(f.port);await s.refresh();f.emit({...ready(),grants:[grant,grant,{...grant,grantId:'forged'},{...grant,amount:10001},{...grant,productId:'diamonds_500'}]});expect(s.state.grants).toEqual([grant]);});
it('pending payments and changed-price response do not fabricate wallet grants',async()=>{const f=setup(),s=new DiamondStore(f.port);await s.refresh();await s.purchase('diamonds_100');expect(s.state.status).toBe('pending');expect(s.state.grants).toEqual([]);f.emit({...ready(),status:'price_changed',products:[{productId:'diamonds_100',amount:100,price:'$5.99',canPurchase:true}]});expect(s.state.products[0].price).toBe('$5.99');expect(s.state.status).toBe('price_changed');expect(s.state.grants).toEqual([]);});
it('ack requires pending verified grant and bridge failure leaves recovery possible',async()=>{const f=setup(),s=new DiamondStore(f.port);f.set({...ready(),grants:[grant]});await s.loadCached();expect(await s.acknowledgeGrant('forged')).toBe(false);expect(f.port.acknowledgeGrant).not.toHaveBeenCalled();f.port.acknowledgeGrant=async()=>{throw Error('process died');};expect(await s.acknowledgeGrant(grantId)).toBe(false);expect(s.state.grants).toEqual([grant]);});
it('durable wallet acknowledgement hides pending grant across bridge reload; new token can credit separately',async()=>{const f=setup(),s=new DiamondStore(f.port);f.set({...ready(),grants:[grant]});await s.refresh();expect(await s.acknowledgeGrant(grantId)).toBe(true);const reload=new DiamondStore(f.port);await reload.loadCached();expect(reload.state.grants).toEqual([]);f.emit({...ready(),grants:[{...grant,grantId:'diamonds:'+'b'.repeat(64)}]});expect(s.state.grants[0].grantId).not.toBe(grantId);});
it('new native purchase event wins over an older refresh bridge result',async()=>{const f=setup(),s=new DiamondStore(f.port);f.port.refresh=async()=>{f.emit({...ready(),grants:[grant]});return ready();};await s.refresh();expect(s.state.grants).toEqual([grant]);});

it('acknowledgment result cannot erase a newer native purchase event',async()=>{const f=setup(),s=new DiamondStore(f.port);f.set({...ready(),grants:[grant]});await s.refresh();f.port.acknowledgeGrant=async()=>{f.emit({...ready(),grants:[{...grant,grantId:'diamonds:'+'b'.repeat(64)}]});return {acknowledged:true,state:ready()};};expect(await s.acknowledgeGrant(grantId)).toBe(true);expect(s.state.grants[0].grantId).toBe('diamonds:'+'b'.repeat(64));});

it('subscribes to a cached native loading operation without interrupting it',async()=>{
 const f=setup();f.set({...ready(),status:'loading'});const store=new DiamondStore(f.port);
 await store.loadCached();await store.refresh();expect(f.port.addListener).toHaveBeenCalledTimes(1);expect(f.port.refresh).not.toHaveBeenCalled();
 f.emit({...ready(),grants:[grant]});expect(store.state.grants).toEqual([grant]);expect(store.busy).toBe(false);
});
it('recovers a grant completed before the first listener was attached',async()=>{
 const f=setup();f.set({...ready(),status:'verifying'});const store=new DiamondStore(f.port);await store.loadCached();
 f.set({...ready(),grants:[grant]});await store.refresh();
 expect(store.state.grants).toEqual([grant]);expect(store.busy).toBe(false);
});
it('keeps a newer native grant when the first busy cache read resolves late',async()=>{
 const f=setup(),busy:DiamondState={...ready(),status:'verifying'};f.set(busy);
 const store=new DiamondStore(f.port);await store.loadCached();
 f.port.getCached=async()=>{f.emit({...ready(),grants:[grant]});return busy;};
 await store.refresh();expect(store.state.grants).toEqual([grant]);expect(store.busy).toBe(false);
});
