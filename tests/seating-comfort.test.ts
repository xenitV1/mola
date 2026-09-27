import {describe,it,expect} from 'vitest';
import {Simulation,actor,type Customer} from '../src/game/sim';
import {TABLE_TYPES} from '../src/game/table-layout';
import {validateSave} from '../src/game/save';
import type {Persona} from '../src/game/guests';
const advance=(g:Simulation,seconds:number)=>{for(let i=0;i<Math.round(seconds*30);i++)g.step(1/30);};
function cafe(tier=0){const g=new Simulation();g.s.coins=10000+TABLE_TYPES.reduce((n,t)=>n+t.cost,0);g.s.totalServed=40;g.s.milestone=7;g.b.spawn=100;g.upgrade('space');g.upgrade('space');g.upgrade('table');for(let i=0;i<tier;i++)expect(g.upgradeTable(0)).toBe(true);g.s.player=actor({x:0,z:6});return g;}
function arriving(g:Simulation,seat:number,persona:Persona='quiet'):Customer{return {...actor(g.seatPoint(seat)),id:seat+1,seat,state:'sitting',kind:'espresso',patience:100,maxPatience:100,timer:.05,paid:false,tint:0,persona};}
describe('different seating furniture provides real per-guest comfort',()=>{
 it('each furniture upgrade adds its own measurable comfort without changing another table',()=>{
  const g=cafe();expect(TABLE_TYPES.map(t=>t.comfort)).toEqual([0,2,4,6]);expect(g.tableComfort(0)).toBe(0);
  for(const expected of [2,4,6]){expect(g.upgradeTable(0)).toBe(true);expect(g.tableComfort(0)).toBe(expected);expect(g.tableComfort(1)).toBe(0);}
 });
 it('only the guest actually seated at the upgraded table receives extra patience',()=>{
  const g=cafe(3),plush=arriving(g,0),basic=arriving(g,2);g.b.customers=[plush,basic];advance(g,.1);
  expect(plush.state).toBe('waiting');expect(basic.state).toBe('waiting');expect(plush.maxPatience).toBe(106);expect(basic.maxPatience).toBe(100);expect(plush.patience-basic.patience).toBeCloseTo(6);expect(plush.seatComfort).toBe(6);expect(basic.seatComfort??0).toBe(0);
 });
 it('does not stack a seat comfort bonus on repeated ticks or save reloads',()=>{
  const g=cafe(3);g.b.customers=[arriving(g,0)];advance(g,.1);const initial=g.b.customers[0].patience;advance(g,2);expect(g.b.customers[0].maxPatience).toBe(106);expect(g.b.customers[0].patience).toBeCloseTo(initial-2);expect(validateSave(g.s)).toBe(true);
  const restored=new Simulation(structuredClone(g.s)),guest=restored.b.customers[0];expect(guest.maxPatience).toBe(106);expect(guest.patience).toBeCloseTo(initial-2);advance(restored,2);expect(guest.maxPatience).toBe(106);expect(guest.patience).toBeCloseTo(initial-4);expect(guest.seatComfort).toBe(6);
 });
 it('grants only the new comfort difference when an occupied table is upgraded',()=>{
  const g=cafe();g.b.customers=[arriving(g,0),arriving(g,2)];advance(g,.1);const guest=g.b.customers[0],other=g.b.customers[1],before=guest.patience;
  for(const extra of [2,4,6]){expect(g.upgradeTable(0)).toBe(true);expect(guest.maxPatience).toBe(100+extra);expect(guest.patience).toBeCloseTo(before+extra);expect(guest.seatComfort).toBe(extra);expect(other.maxPatience).toBe(100);}
 });
 it('accepts an older visit without comfort fields and grants its newly introduced bonus only once',()=>{
  const g=cafe(3),guest=arriving(g,0);guest.state='waiting';guest.visit={seconds:2,dirty:0,crowding:0,noise:0,music:0,waitFraction:0,freshness:1,quality:0};g.b.customers=[guest];
  expect(validateSave(g.s)).toBe(true);const restored=new Simulation(structuredClone(g.s));expect(restored.b.customers[0].maxPatience).toBe(106);expect(restored.b.customers[0].seatComfort).toBe(6);
  advance(restored,1);expect(Number.isFinite(restored.b.customers[0].visit!.comfort)).toBe(true);expect(validateSave(restored.s)).toBe(true);const again=new Simulation(structuredClone(restored.s));expect(again.b.customers[0].maxPatience).toBe(106);expect(again.b.customers[0].patience).toBeCloseTo(105);
 });
 function completedVisit(tier:number,fault?:'dirty'|'noise'){
  const g=cafe(tier);if(fault){g.decorate('cushions');g.decorate('lush');}
  const guest=arriving(g,0,fault==='dirty'?'tidy':'quiet');g.b.customers=[guest];advance(g,.1);guest.patience=guest.maxPatience*.98;
  if(fault==='dirty')g.b.dirtyTables[0]=g.tableCapacity(0);
  if(fault==='noise'){g.upgrade('stage');g.setVolume(3);}
  g.s.player=actor(g.orderPoint(guest));g.s.player.cups=[{kind:'espresso',quality:fault?3:0,born:g.b.time}];g.step(1/30);expect(guest.paid).toBe(true);
  // The player leaves the service area, so a deliberately dirty shared table stays dirty.
  g.s.player=actor({x:0,z:6});advance(g,24);expect(guest.review).toBeTruthy();expect(g.b.reviews).toHaveLength(1);return guest.review!;
 }
 it('raises an actual departed guest review with the same fresh product and prompt service',()=>{
  const basic=completedVisit(0),salon=completedVisit(3);expect(basic.score).toBe(4);expect(salon.score).toBe(5);expect(salon.score).toBeGreaterThan(basic.score);expect(salon.reasons).toContain('comfortable');
 });
 it.each(['dirty','noise'] as const)('luxury furniture and quality cannot hide a severe %s problem from an actual guest',fault=>{
  const review=completedVisit(3,fault);expect(review.score).toBeLessThanOrEqual(3);expect(review.reasons).toContain(fault);
 });
});
