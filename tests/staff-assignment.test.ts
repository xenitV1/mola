import {TABLE_TYPES} from '../src/game/table-layout';
import {describe,it,expect} from 'vitest';
import {Simulation,actor,type Customer} from '../src/game/sim';
import {POINTS} from '../src/game/config';
import {validateSave} from '../src/game/save';
const guest=(g:Simulation,seat:number):Customer=>({...actor(g.seatPoint(seat)),id:seat+1,seat,state:'waiting',kind:'espresso',patience:70,maxPatience:70,timer:0,paid:false,tint:0});
function setup(){const g=new Simulation();g.s.coins=10000;g.s.totalServed=40;g.s.milestone=7;g.b.spawn=100;g.s.player=actor({x:0,z:3});return g;}
const claims=(g:Simulation,role:'waiter'|'cleaner')=>g.roleActors(role).map(a=>a.task).filter((t):t is string=>!!t&&t.startsWith(role==='waiter'?'serve-':'clean-'));
const uniqueClaims=(g:Simulation,role:'waiter'|'cleaner')=>{const active=claims(g,role);expect(new Set(active).size).toBe(active.length);};
describe('staff claim physical tables instead of duplicating each other’s jobs',()=>{
 it('assigns two servers different tables and preserves cups and sale credits',()=>{
  const g=setup();g.upgrade('table');g.hire('waiter');g.hireMore('waiter');g.b.customers=[guest(g,0),guest(g,2)];for(const a of g.roleActors('waiter')){Object.assign(a,actor(POINTS.machine));a.cups=[{kind:'espresso',quality:0,born:0}];}
  const coins=g.s.coins;g.step(1/30);expect(new Set(claims(g,'waiter'))).toEqual(new Set(['serve-0','serve-1']));
  for(let i=0;i<20*30;i++){g.step(1/30);uniqueClaims(g,'waiter');const inventory=g.b.ready.length+g.s.player.cups.length+g.roleActors('waiter').reduce((n,a)=>n+a.cups.length,0);expect(inventory+g.b.served+g.b.waste).toBe(2);}
  expect(g.b.served).toBe(2);expect(g.b.lost).toBe(0);expect(g.s.coins-coins).toBe(g.b.earned);expect(validateSave(g.s)).toBe(true);
 });
 it('does not send two servers to the same table even when its two guests order at once',()=>{
  const g=setup();g.hire('waiter');g.hireMore('waiter');g.b.customers=[guest(g,0),guest(g,1)];for(const a of g.roleActors('waiter')){Object.assign(a,actor(POINTS.machine));a.cups=[{kind:'espresso',quality:0,born:0}];}
  g.step(1/30);expect(claims(g,'waiter')).toEqual(['serve-0']);for(let i=0;i<25*30;i++){g.step(1/30);uniqueClaims(g,'waiter');const destination=g.servicePoint(0);expect(g.roleActors('waiter').filter(a=>a.path.length&&Math.hypot(a.path.at(-1)!.x-destination.x,a.path.at(-1)!.z-destination.z)<.01).length).toBeLessThanOrEqual(1);}expect(g.b.served).toBe(2);expect(g.b.lost).toBe(0);expect(g.b.waste).toBe(0);
 });
 it('releases an invalid server claim and resumes service when a new table needs it',()=>{
  const g=setup();g.upgrade('table');g.hire('waiter');const worker=g.b.workers.waiter!;Object.assign(worker,actor(POINTS.machine));worker.task='serve-0';worker.cups=[{kind:'espresso',quality:0,born:0}];g.b.customers=[guest(g,2)];g.step(1/30);expect(worker.task).toBe('serve-1');for(let i=0;i<15*30;i++)g.step(1/30);expect(g.b.served).toBe(1);expect(worker.task).not.toBe('serve-1');
 });
 it('assigns cleaners distinct dirty tables and moves every dirty dish once',()=>{
  const g=setup();g.upgrade('table');g.hire('cleaner');g.hireMore('cleaner');g.b.cleanDishes=33;g.b.dirtyTables={0:2,1:1};const coins=g.s.coins;
  g.step(1/30);expect(new Set(claims(g,'cleaner'))).toEqual(new Set(['clean-0','clean-1']));
  for(let i=0;i<15*30;i++){g.step(1/30);uniqueClaims(g,'cleaner');expect(g.b.cleanDishes+g.b.dirtyDishes+Object.values(g.b.dirtyTables).reduce((a,b)=>a+b,0)).toBe(36);}
  expect(g.b.dirtyTables).toEqual({});expect(g.b.dirtyDishes).toBe(3);expect(g.s.coins).toBe(coins);expect(validateSave(g.s)).toBe(true);
 });
 it('keeps one cleaner idle for a single dirty table, then releases claims after cleanup',()=>{
  const g=setup();g.hire('cleaner');g.hireMore('cleaner');g.b.cleanDishes=35;g.b.dirtyTables={0:1};g.step(1/30);expect(claims(g,'cleaner')).toEqual(['clean-0']);for(let i=0;i<12*30;i++){g.step(1/30);uniqueClaims(g,'cleaner');}expect(g.b.dirtyDishes).toBe(1);expect(claims(g,'cleaner')).toHaveLength(0);
 });
});
it('treats an extra seat on a ten-seat table as the same physical table for server ownership',()=>{
 const g=setup();g.s.coins+=TABLE_TYPES.reduce((n,t)=>n+t.cost,0);g.upgrade('space');g.upgrade('space');for(let tier=0;tier<3;tier++)expect(g.upgradeTable(0)).toBe(true);g.hire('waiter');g.hireMore('waiter');g.b.customers=[guest(g,0),guest(g,12)];for(const a of g.roleActors('waiter')){Object.assign(a,actor(POINTS.machine));a.cups=[{kind:'espresso',quality:0,born:0}];}
 g.step(1/30);expect(claims(g,'waiter')).toEqual(['serve-0']);for(let i=0;i<25*30;i++){g.step(1/30);uniqueClaims(g,'waiter');}expect(g.b.served).toBe(2);expect(g.b.lost).toBe(0);expect(validateSave(g.s)).toBe(true);
});
