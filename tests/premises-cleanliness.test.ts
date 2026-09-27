import {describe,it,expect} from 'vitest';
import {Simulation,actor,type Customer} from '../src/game/sim';
import {POINTS,ROLES} from '../src/game/config';
import {DIRT_LIMITS,dirtExposure,dirtSeconds,type DirtPatch} from '../src/game/cleanliness';
import {validateSave} from '../src/game/save';
const advance=(g:Simulation,s:number)=>{for(let i=0;i<s*10;i++)g.step(.1);};
function setup(){const g=new Simulation();g.s.coins=10000;g.s.totalServed=40;g.s.milestone=7;g.b.spawn=100;g.s.player=actor({x:9,z:13});return g;}
function patch(g:Simulation,x:number,z:number,zone:DirtPatch['zone']='floor'){const p:DirtPatch={id:++g.cleanliness.serial,x,z,zone,kind:zone==='front'?'litter':'spill',work:0};expect(g.blocked(p)).toBe(false);g.cleanliness.patches.push(p);return p;}
describe('visible premises cleanliness',()=>{
 it('starts clean and does not dirty an empty cafe just because time passes',()=>{const g=new Simulation();expect(g.cleanliness.patches).toEqual([]);g.b.spawn=100;advance(g,50);expect(g.cleanliness.patches).toEqual([]);expect(g.cleanliness.floorTravel+g.cleanliness.frontTravel).toBe(0);});
 it('real customer traffic creates both zones within a minute and remains bounded',()=>{
  const g=setup();g.b.spawn=0;g.b.served=2;for(const role of ROLES.filter(r=>r!=='cleaner'))g.hire(role);g.upgrade('table');advance(g,60);
  expect(g.premisesDirtCounts.floor).toBeGreaterThan(0);expect(g.premisesDirtCounts.front).toBeGreaterThan(0);expect(g.cleanliness.patches.every(p=>!g.blocked(p))).toBe(true);
  advance(g,240);expect(g.premisesDirtCounts.floor).toBeLessThanOrEqual(DIRT_LIMITS.floor);expect(g.premisesDirtCounts.front).toBeLessThanOrEqual(DIRT_LIMITS.front);expect(validateSave(g.s)).toBe(true);
 });
 it('walks a cleaner to a visible patch and spends time cleaning, then removes it once',()=>{
  const g=setup(),p=patch(g,7,2.8);g.hire('cleaner');const a=g.b.workers.cleaner!;const coins=g.s.coins,dishes=g.b.cleanDishes;g.step(.1);expect(a.task).toBe(`sweep-${p.id}`);expect(a.path.length).toBeGreaterThan(0);expect(p.work).toBe(0);
  let found=false;for(let i=0;i<200;i++){g.step(.1);if(p.work>0&&p.work<dirtSeconds(p)){found=true;expect(Math.hypot(a.x-p.x,a.z-p.z)).toBeLessThan(.7);expect(g.cleanliness.patches).toContain(p);break;}}expect(found).toBe(true);advance(g,3);expect(g.cleanliness.patches).toHaveLength(0);expect(g.cleanliness.cleaned).toBe(1);expect(g.s.coins).toBe(coins);expect(g.b.cleanDishes).toBe(dishes);
 });
 it('assigns two cleaners distinct jobs and preserves dirty-table priority',()=>{
  const g=setup();patch(g,7,2.8);patch(g,8,7,'front');g.hire('cleaner');g.hireMore('cleaner');g.step(.1);expect(new Set(g.roleActors('cleaner').map(a=>a.task)).size).toBe(2);g.b.dirtyTables[0]=1;g.b.cleanDishes--;
  g.step(.1);expect(g.roleActors('cleaner').filter(a=>a.task==='clean-0')).toHaveLength(1);expect(g.roleActors('cleaner').filter(a=>a.task?.startsWith('sweep-'))).toHaveLength(1);
  for(let i=0;i<250;i++){g.step(.1);const active=g.roleActors('cleaner').map(a=>a.task).filter(Boolean);expect(new Set(active).size).toBe(active.length);}expect(g.cleanliness.cleaned).toBe(2);expect(g.b.dirtyTables).toEqual({});expect(g.b.dirtyDishes).toBe(1);expect(validateSave(g.s)).toBe(true);
 });
 it('lets a player stop by a patch and visibly clean without hiring',()=>{const g=setup(),p=patch(g,7,2.8);g.s.player=actor(p);advance(g,.8);expect(g.s.player.task).toBe(`sweep-${p.id}`);expect(p.work).toBeGreaterThan(0);expect(g.cleanliness.patches).toHaveLength(1);advance(g,2);expect(g.cleanliness.cleaned).toBe(1);});
 it('restores partial cleanup and repairs duplicate cleaner claims without losing dirt',()=>{
  const g=setup(),p=patch(g,7,2.8);patch(g,8,7,'front');g.hire('cleaner');g.hireMore('cleaner');p.work=.7;for(const a of g.roleActors('cleaner'))a.task=`sweep-${p.id}`;
  expect(validateSave(g.s)).toBe(true);const restored=new Simulation(structuredClone(g.s));restored.step(.1);expect(new Set(restored.roleActors('cleaner').map(a=>a.task)).size).toBe(2);expect(restored.cleanliness.patches[0].work).toBe(.7);advance(restored,20);expect(restored.cleanliness.cleaned).toBe(2);
 });
 it('keeps old v7 saves valid and rejects malformed dirt and reward bookkeeping',()=>{
  const g=setup();delete g.b.cleanliness;expect(validateSave(g.s)).toBe(true);const restored=new Simulation(structuredClone(g.s));expect(restored.cleanliness.patches).toEqual([]);patch(restored,7,2.8);expect(validateSave(restored.s)).toBe(true);
  for(const mutate of [(p:any)=>p.x=200,(p:any)=>p.work=3,(p:any)=>p.zone='street',(p:any)=>p.id=0]){const s=structuredClone(restored.s);mutate(s.branches[0].cleanliness!.patches[0]);expect(validateSave(s)).toBe(false);}
  restored.s.monetization={bonusGrants:['native-grant-1'],rewardReadyAt:{coins:12345,tips:0}};expect(validateSave(restored.s)).toBe(true);const bad:any=structuredClone(restored.s);bad.monetization.rewardReadyAt.forever=10;expect(validateSave(bad)).toBe(false);bad.monetization.rewardReadyAt={coins:Infinity};expect(validateSave(bad)).toBe(false);bad.monetization.rewardReadyAt={};bad.monetization.bonusGrants=Array(21).fill('x');expect(validateSave(bad)).toBe(false);
 });
 it('exposure is local, moderate, removable and measured in real guest visits',()=>{
  const g=setup(),p=patch(g,-.5,-.7);expect(dirtExposure([p],p,false)).toBeCloseTo(.142);expect(dirtExposure([p],p,true)).toBe(0);expect(dirtExposure([],p,false)).toBe(0);
  const c:Customer={...actor(g.seatPoint(0)),id:77,seat:0,state:'waiting',kind:'espresso',patience:70,maxPatience:70,timer:0,paid:false,tint:0,persona:'tidy'};g.b.customers=[c];advance(g,2);expect(c.visit!.dirty).toBeGreaterThan(0);const before=c.visit!.dirty;g.cleanliness.patches=[];advance(g,2);expect(c.visit!.dirty).toBe(before);
 });
 it('renovating relocates marks under new furniture and updates frontage to floor',()=>{const g=setup();const p=patch(g,8,7,'front');g.upgrade('space');expect(p.zone).toBe('floor');expect(g.blocked(p)).toBe(false);expect(validateSave(g.s)).toBe(true);});
});
