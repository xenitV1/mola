import {describe,it,expect} from 'vitest';
import {Simulation,actor,newBranch} from '../src/game/sim';
import {TUNING} from '../src/game/config';
import {validateSave,load,persist} from '../src/game/save';
function staffed(){const g=new Simulation();g.s.coins=10000;g.s.totalServed=40;g.s.milestone=7;g.b.served=40;g.upgrade('table');for(const role of ['barista','waiter','supplier','cleaner','dishwasher'] as const)g.hire(role);g.s.player=actor({x:0,z:5.8});return g;}
function advance(g:Simulation,seconds:number){for(let i=0;i<seconds*10;i++)g.step(.1);}
describe('owned cafés become a working chain',()=>{
 it('requires a real first star, not just money; no maximum upgrade grind',()=>{
  const g=staffed();expect(g.branchUnlocked(1)).toBe(false);expect(g.switchBranch(1)).toBe(false);expect(g.claimMastery()).toBe(true);
  expect(g.b.level.machine).toBe(1);expect(g.b.level.space).toBe(0);const coins=g.s.coins;
  expect(g.switchBranch(1)).toBe(true);expect(g.s.coins).toBe(coins-4500);expect(g.switchBranch(2)).toBe(false);
  expect(g.switchBranch(0)).toBe(true);expect(g.b.level.table).toBe(2);expect(g.b.mastery).toBe(1);
 });
 it('keeps already purchased branches accessible in shipped saves without new gates',()=>{
  const g=new Simulation();g.s.branches[1]=newBranch();g.s.branches[2]=newBranch();g.s.coins=1;g.s.settings.locale='tr';
  const values=new Map<string,string>(),store={getItem:(k:string)=>values.get(k)??null,setItem:(k:string,v:string)=>{values.set(k,v);},removeItem:(k:string)=>{values.delete(k);}};
  expect(persist(g.s,store)).toBe(true);const restored=new Simulation(load(store).save);
  expect(restored.switchBranch(2)).toBe(true);expect(restored.s.coins).toBe(1);expect(restored.s.settings.locale).toBe('tr');expect(restored.s.branches[0].mastery).toBe(0);
 });
 it('runs the same orders, stock and money in an inactive staffed café',()=>{
  const active=staffed();active.setMenu('latte');active.s.branches[1]=newBranch();const hidden=new Simulation(structuredClone(active.s));hidden.switchBranch(1);hidden.events=[];
  advance(active,90);advance(hidden,90);
  const a=active.s.branches[0],b=hidden.s.branches[0];
  expect(b.served).toBeGreaterThan(40);expect(b.signatureServed).toBeGreaterThan(0);
  expect(b.served).toBe(a.served);expect(b.earned).toBe(a.earned);expect(b.stock).toBe(a.stock);expect(b.signatureServed).toBe(a.signatureServed);
  expect(b.time).toBeCloseTo(a.time);expect(hidden.s.active).toBe(1);expect(hidden.s.player.cups).toHaveLength(0);
  expect(hidden.events.some(e=>e.type==='brew'||e.type==='serve'||e.type==='coin')).toBe(false);expect(validateSave(hidden.s)).toBe(true);
 });
 it('does not invent progress for an incomplete team',()=>{
  const g=new Simulation();g.s.branches[1]=newBranch();g.switchBranch(1);const before=structuredClone(g.s.branches[0]);advance(g,20);expect(g.s.branches[0]).toEqual(before);
 });
 it('advances actual offline goals, caps a return to a few investments, and never reclaims it',()=>{
  const g=staffed();g.setMenu('latte');g.s.savedAt=1000;g.s.coins=0;const before=g.b.served;
  const result=g.offline(1000+24*3600*1000,true);
  expect(result.seconds).toBe(TUNING.offlineCap);expect(g.b.time).toBeCloseTo(360,5);expect(result.served).toBe(g.b.served-before);expect(result.served).toBeGreaterThan(10);
  expect(g.b.signatureServed).toBeGreaterThan(0);expect(result.amount).toBeGreaterThan(200);expect(result.amount).toBeLessThan(3900);
  expect(g.offline(1000+24*3600*1000,true).amount).toBe(0);expect(validateSave(g.s)).toBe(true);
 });
 it('does not spend paid/ad boost time or let an absent player brew or collect',()=>{
  const g=staffed();g.s.boostSeconds=120;g.s.savedAt=1000;g.s.player=actor({x:-1.25,z:-2.85});g.s.player.beans=8;const player=structuredClone(g.s.player);g.events=[];
  g.offline(61000,true);expect(g.s.player).toEqual(player);expect(g.s.boostSeconds).toBe(120);expect(g.events).toHaveLength(0);
 });
 it('expires an absent player’s old tray before the next live service',()=>{
  const g=staffed();g.s.player.cups=[{kind:'espresso',quality:0,born:0}];g.s.savedAt=1000;g.offline(3601000,true);expect(g.s.player.cups).toHaveLength(0);expect(g.b.waste).toBeGreaterThan(0);
 });
 it('does not diagnose another café using the player’s carried stock',()=>{
  const g=staffed();g.s.branches[1]=newBranch();g.switchBranch(1);g.s.branches[0].stock=0;g.s.player.beans=8;const player=g.s.player;
  expect(g.branchNote(0).action).toBe('stock');expect(g.s.active).toBe(1);expect(g.s.player).toBe(player);expect(g.s.player.beans).toBe(8);
 });
 it('does not multiply a boost by the number of owned cafés',()=>{
  const g=staffed();g.s.branches[1]=newBranch();g.s.branches[2]=newBranch();g.s.boostSeconds=120;advance(g,1);expect(g.s.boostSeconds).toBeCloseTo(119);
 });
 it('makes ready stars and branch choice visible without requiring all expansion levels',()=>{
  const g=staffed();expect(g.objective().panel).toBe('mastery');g.claimMastery();expect(g.objective().panel).toBe('branches');
  expect(g.b.level.space).toBe(0);expect(g.branchNote(0).title).toBeTruthy();expect(g.s.active).toBe(0);
 });
});
