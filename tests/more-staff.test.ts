import {describe,it,expect} from 'vitest';
import {Simulation,actor,type Customer} from '../src/game/sim';
import {POINTS,ROLES} from '../src/game/config';
import {validateSave} from '../src/game/save';
const advance=(g:Simulation,seconds:number)=>{for(let i=0;i<seconds*30;i++)g.step(1/30);};
const guest=(g:Simulation,seat:number):Customer=>({...actor(g.seatPoint(seat)),id:seat+1,seat,state:'waiting',kind:'espresso',patience:70,maxPatience:70,timer:0,paid:false,tint:seat});
function funded(){const g=new Simulation();g.s.coins=10000;g.b.spawn=100;g.s.totalServed=6;g.b.served=6;g.s.player=actor({x:0,z:3});return g;}
describe('headcount is separate from training and preserves real service',()=>{
 it('recruits an independent person without raising team training; training keeps headcount',()=>{
  const g=funded();g.hire('waiter');const lead=g.b.workers.waiter!,recruitCost=g.additionalStaffPrice('waiter'),before=g.s.coins;
  expect(g.hireMore('waiter')).toBe(true);expect(g.s.coins).toBe(before-recruitCost);expect(g.staffCount('waiter')).toBe(2);expect(g.b.staff.waiter).toBe(1);expect(g.roleActors('waiter')[1]).not.toBe(lead);
  const trainCost=g.staffPrice('waiter'),trainingBudget=g.s.coins;expect(g.hire('waiter')).toBe(true);expect(g.s.coins).toBe(trainingBudget-trainCost);expect(g.b.staff.waiter).toBe(2);expect(g.staffCount('waiter')).toBe(2);
 });
 it('enforces role headcount limits without spending money on rejected recruits',()=>{
  const g=funded();for(const role of ROLES){g.s.coins=10000;expect(g.hireMore(role)).toBe(true);for(let n=1;n<g.staffLimit(role);n++)expect(g.hireMore(role)).toBe(true);const coins=g.s.coins;expect(g.hireMore(role)).toBe(false);expect(g.s.coins).toBe(coins);expect(g.staffCount(role)).toBe(g.staffLimit(role));}expect(validateSave(g.s)).toBe(true);
 });
 it('two servers carry independently and conserve cups while delivering four real orders',()=>{
  const g=funded();g.upgrade('table');g.hire('waiter');g.hireMore('waiter');for(const worker of g.roleActors('waiter'))Object.assign(worker,actor(POINTS.machine));
  g.b.customers=Array.from({length:4},(_,i)=>guest(g,i));g.b.ready=Array.from({length:4},()=>({kind:'espresso',quality:0,born:0}));
  const carried=new Set<number>(),start=g.b.served;for(let i=0;i<25*30;i++){g.step(1/30);g.roleActors('waiter').forEach((a,index)=>{if(a.cups.length)carried.add(index);});const inventory=g.b.ready.length+g.s.player.cups.length+g.roleActors('waiter').reduce((n,a)=>n+a.cups.length,0);expect(inventory+(g.b.served-start)+g.b.waste).toBe(4);}
  expect(carried).toEqual(new Set([0,1]));expect(g.b.served-start).toBe(4);expect(g.b.lost).toBe(0);expect(g.b.cleanDishes).toBe(32);expect(validateSave(g.s)).toBe(true);
 });
 it('does not prepare for absent guests even when baristas and preparation capacity are available',()=>{
  const g=funded();g.hire('barista');g.hireMore('barista');g.b.prep=5;g.s.player=actor(POINTS.machine);const stock=g.b.stock;advance(g,20);expect(g.b.brew).toBe(0);expect(g.b.ready).toHaveLength(0);expect(g.s.player.cups).toHaveLength(0);expect(g.b.stock).toBe(stock);
 });
 it('keeps helper cargo, cups and training intact through save/reload',()=>{
  const g=funded();g.hire('supplier');g.hireMore('supplier');g.hire('waiter');g.hireMore('waiter');g.hire('waiter');const supplier=g.roleActors('supplier')[1];supplier.beans=4;supplier.cargo={beans:2,milk:2};g.roleActors('waiter')[1].cups=[{kind:'latte',quality:2,born:0}];const snapshot=structuredClone(g.s);expect(validateSave(snapshot)).toBe(true);const restored=new Simulation(snapshot);expect(restored.staffCount('supplier')).toBe(2);expect(restored.b.staff.waiter).toBe(2);expect(restored.roleActors('supplier')[1].cargo).toEqual({beans:2,milk:2});expect(restored.roleActors('waiter')[1].cups).toEqual([{kind:'latte',quality:2,born:0}]);
 });
});
it('a second barista at the preparation station raises actual output for seated orders',()=>{
 const run=(extra:boolean)=>{const g=funded();g.b.prep=3;g.hire('barista');if(extra)g.hireMore('barista');g.roleActors('barista').forEach((a,i)=>Object.assign(a,actor({x:-1.3,z:-3.6+i*2})));g.b.customers=[guest(g,0),guest(g,1)];const stock=g.b.stock;advance(g,4);return {made:g.b.ready.length,used:stock-g.b.stock};};
 expect(run(false)).toEqual({made:1,used:1});expect(run(true)).toEqual({made:2,used:2});
});
it('two dishwashers return real dirty cups faster without duplicating the finite dish pool',()=>{
 const run=(extra:boolean)=>{const g=funded();g.hire('dishwasher');if(extra)g.hireMore('dishwasher');g.roleActors('dishwasher').forEach((a,i)=>Object.assign(a,actor(i?{x:-.9,z:2.85}:POINTS.wash)));g.b.cleanDishes=28;g.b.dirtyDishes=8;advance(g,2.4);return {clean:g.b.cleanDishes,dirty:g.b.dirtyDishes};};
 expect(run(false)).toEqual({clean:32,dirty:4});expect(run(true)).toEqual({clean:36,dirty:0});
});
it('two suppliers conserve every ingredient when their simultaneous crates exceed the same remaining bin space',()=>{
 const g=funded();g.hire('supplier');g.hireMore('supplier');for(const a of g.roleActors('supplier'))Object.assign(a,actor(POINTS.supply));g.b.stock=19;g.b.ingredients={milk:19,pastry:19,cold:19};
 const count=()=>Object.values(g.b.depot).reduce((a,b)=>a+b,0)+g.b.stock+Object.values(g.b.ingredients).reduce((a,b)=>a+b,0)+g.roleActors('supplier').reduce((n,a)=>n+Object.values(a.cargo??{}).reduce((x,y)=>x+(y??0),0),0);const before=count();advance(g,15);expect(count()).toBe(before);expect(g.b.stock).toBeLessThanOrEqual(g.stockCap);
});
