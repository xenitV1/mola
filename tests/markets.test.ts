import {describe,it,expect} from 'vitest';
import {setImmediate} from 'node:timers/promises';
import {Simulation,actor,newBranch} from '../src/game/sim';
import {type Menu} from '../src/game/config';
import {validateSave} from '../src/game/save';
async function run(index:number,menu:Menu,grown=false){
 const g=new Simulation();g.s.active=index;g.s.branches={[index]:newBranch()};g.s.coins=100_000;
 for(const role of ['barista','waiter','supplier','cleaner','dishwasher'] as const)g.hire(role);
 g.b.level.table=3;g.b.level.space=1;g.b.level.machine=2;g.b.level.quality=1;g.b.prep=3;
 // A six seat café is full whichever menu it sells, so only a café with real
 // service capacity can turn a neighbourhood's taste into money.
 if(grown){g.b.level.table=6;g.b.level.space=2;g.b.level.machine=4;g.b.level.tray=4;g.b.prep=5;
  for(const role of ['barista','waiter','supplier','cleaner','dishwasher'] as const)g.hireMore(role);}
 g.setMenu(menu);g.s.player=actor({x:0,z:5.8});
 for(let i=0;i<600*30;i++){
  g.step(1/30);
  if(i%300===299)await setImmediate();
 }
 return g;
}
describe('neighbourhood demand creates distinct operating choices',()=>{
 it('draws far more office guests to quick coffee than to long cake breaks',async()=>{
  const quick=await run(1,'espresso'),slow=await run(1,'cake');
  expect(quick.b.guestSerial).toBeGreaterThan(slow.b.guestSerial*1.7);
  expect(quick.b.served).toBeGreaterThan(slow.b.served*1.5);
  expect(slow.b.waste).toBe(0); // With seated-order production, a high legacy prep target no longer manufactures speculative waste.
  expect(validateSave(quick.s)).toBe(true);expect(validateSave(slow.s)).toBe(true);
 },20000);
 it('turns the office rush into money once the café can actually serve fast',async()=>{
  const quick=await run(1,'espresso',true),slow=await run(1,'cake',true);
  // Floor/front upkeep adds real cleaner travel; the office still rewards fast service.
  expect(quick.b.earned).toBeGreaterThan(slow.b.earned*1.15);
  expect(quick.b.served).toBeGreaterThan(slow.b.served*2);
 },20000);
 it('the seaside reverses that result with guests who come for cake',async()=>{
  const quick=await run(2,'espresso',true),leisure=await run(2,'cake',true);
  expect(leisure.b.earned).toBeGreaterThan(quick.b.earned*2);
  expect(leisure.b.served).toBeGreaterThan(quick.b.served);
  expect(leisure.b.guestSerial).toBeGreaterThan(quick.b.guestSerial);
 },20000);
 it('the neighbourhood rewards latte rather than the most expensive menu',async()=>{
  const latte=await run(0,'latte',true),cake=await run(0,'cake',true);
  expect(latte.b.guestSerial).toBeGreaterThan(cake.b.guestSerial*1.3);
  expect(latte.b.earned).toBeGreaterThan(cake.b.earned*1.1);
 },20000);
 it('cannot express a neighbourhood’s taste until the café can serve faster than it fills',async()=>{
  // Six seats saturate on any menu, so the slow expensive recipe wins on price per
  // seat whatever the district wants. Capacity is what unlocks the local advantage.
  const cramped=await run(0,'cake'),focused=await run(0,'latte');
  expect(cramped.b.served).toBeLessThan(focused.b.served);
  expect(cramped.b.earned).toBeGreaterThan(focused.b.earned);
  const roomy=await run(0,'cake',true),grown=await run(0,'latte',true);
  expect(grown.b.earned).toBeGreaterThan(roomy.b.earned);
 },30000);
 it('post-automation guidance opens relevant management choices',()=>{
  const g=new Simulation();g.s.totalServed=10;g.s.coins=5000;g.upgrade('table');g.hire('barista');g.hire('waiter');
  expect(g.objective().panel).toBe('staff');g.hire('supplier');expect(g.objective().panel).toBe('mastery');g.b.served=40;expect(g.claimMastery()).toBe(true);expect(g.objective().panel).toBe('branches');
  g.setMenu('latte');expect(g.objective().panel).toBe('branches');
 },20000);
});
