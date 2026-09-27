import {it,expect} from 'vitest';
import {Simulation,actor,newBranch,type Customer} from '../src/game/sim';
import {load,persist,SAVE_KEY,validateSave} from '../src/game/save';
import {TUNING} from '../src/game/config';
const guest=(g:Simulation,seat=0):Customer=>({...actor(g.seatPoint(seat)),id:seat+1,kind:'espresso',state:'waiting',seat,patience:44,maxPatience:44,timer:0,paid:false,tint:0});
const advance=(g:Simulation,seconds:number)=>{for(let i=0;i<seconds*10;i++)g.step(.1);};
it('credits the actual delivery immediately, keeps the seat occupied, and cannot pay twice after reload',()=>{
 const g=new Simulation();g.b.spawn=100;g.b.customers=[guest(g)];g.s.player=actor(g.servicePoint(0));g.s.player.cups=[{kind:'espresso',born:0,quality:0}];
 const coins=g.s.coins;g.step(.1);const c=g.b.customers[0];expect(g.s.coins).toBe(coins+21);expect(c.paid).toBe(true);expect(c.state).toBe('drinking');expect(c.timer).toBeGreaterThan(5);expect(g.b.served).toBe(1);expect(g.b.cash).toEqual({});expect(g.events.some(e=>e.type==='coin'&&e.value===21)).toBe(true);
 const data=new Map<string,string>(),store={getItem:(k:string)=>data.get(k)??null,setItem:(k:string,v:string)=>{data.set(k,v);},removeItem:(k:string)=>{data.delete(k);}};
 expect(persist(g.s,store)).toBe(true);const restored=new Simulation(load(store).save);restored.s.player=actor({x:-2,z:5});advance(restored,20);expect(restored.b.customers).toHaveLength(0);expect(restored.s.coins).toBe(coins+21);expect(restored.s.totalServed).toBe(1);expect(validateSave(restored.s)).toBe(true);
});
it('settles legacy cash and delivered drinks in every branch exactly once without recounting old sales',()=>{
 const g=new Simulation();g.b.cash={0:42};g.b.earned=42;g.b.served=2;g.s.totalServed=2;g.b.customers=[{...guest(g),state:'drinking',action:21,timer:4}];
 g.s.branches[1]=newBranch();const b=g.s.branches[1];b.takeaway={owned:true,open:false,cash:20,served:1};b.earned=20;b.served=1;g.s.totalServed++;
 const coins=g.s.coins;const restored=new Simulation(structuredClone(g.s));expect(restored.s.coins).toBe(coins+83);expect(restored.b.earned).toBe(63);expect(restored.b.served).toBe(3);expect(restored.s.totalServed).toBe(4);expect(restored.s.branches[1].served).toBe(1);expect(restored.b.customers[0].timer).toBe(4);
 const again=new Simulation(structuredClone(restored.s));expect(again.s.coins).toBe(restored.s.coins);expect(again.s.totalServed).toBe(4);expect(validateSave(again.s)).toBe(true);
});
it('does not pay for a missing or wrong product and respects the wallet cap',()=>{
 const g=new Simulation();g.b.spawn=100;g.b.customers=[guest(g)];g.s.player=actor(g.servicePoint(0));const coins=g.s.coins;g.step(.1);expect(g.s.coins).toBe(coins);g.s.player.cups=[{kind:'latte',born:0,quality:0}];g.step(.1);expect(g.s.coins).toBe(coins);expect(g.b.customers[0].paid).toBe(false);
 g.s.player.cups=[{kind:'espresso',born:0,quality:0}];g.s.coins=TUNING.maxMoney-1;g.step(.1);expect(g.s.coins).toBe(TUNING.maxMoney);expect(g.b.served).toBe(1);
});

it('relocates seated legacy guests in inactive branches before unattended service resumes',()=>{
 const g=new Simulation();g.s.branches[1]=newBranch();const c={...guest(g),x:.8,z:-2.5};g.s.branches[1].customers=[c];const active=g.s.active,position={x:g.s.player.x,z:g.s.player.z};
 const restored=new Simulation(g.s);expect(restored.s.branches[1].customers[0].x).toBeCloseTo(restored.seatPoint(0).x);expect(restored.s.active).toBe(active);expect(restored.s.player.x).toBe(position.x);expect(restored.s.player.z).toBe(position.z);
});
