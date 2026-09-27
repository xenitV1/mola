import {describe,it,expect} from 'vitest';
import {Simulation} from '../src/game/sim';
import {TUNING} from '../src/game/config';
import {load,persist,validateSave} from '../src/game/save';
function automated(){const g=new Simulation();g.s.coins=10000;for(const role of ['barista','waiter','supplier','cleaner','dishwasher'] as const)g.hire(role);return g;}
function storage(){const map=new Map<string,string>();return {getItem:(k:string)=>map.get(k)??null,setItem:(k:string,v:string)=>{map.set(k,v);},removeItem:(k:string)=>{map.delete(k);}};}
describe('reward value and monotonic offline accounting',()=>{
 it('grants energy without ingredients and does not consume another reward while active',()=>{
  const g=new Simulation(),stock=g.b.stock;expect(g.rewardAmount('stock')).toBe(120);
  expect(g.reward('energy','stock')).toBe(true);expect(g.s.energySeconds).toBe(120);expect(g.b.stock).toBe(stock);expect(g.energyMultiplier).toBe(1.5);
  expect(g.reward('repeat','stock')).toBe(false);expect(g.s.rewardIds).not.toContain('repeat');expect(g.reward('energy','stock')).toBe(false);
 });
 it('preserves energy across saves/offline time and expires it only once per active step',()=>{
  const g=automated(),store=storage();g.reward('energy','stock');g.step(.1);expect(g.s.energySeconds).toBeCloseTo(119.9);
  expect(persist(g.s,store)).toBe(true);const restored=new Simulation(load(store).save);expect(restored.s.energySeconds).toBeCloseTo(119.9);
  restored.offline(restored.s.savedAt+60000,true);expect(restored.s.energySeconds).toBeCloseTo(119.9);
  restored.s.energySeconds=.05;restored.step(.1);expect(restored.energyMultiplier).toBe(1);expect(restored.rewardAmount('stock')).toBe(120);
 });
 it('speeds player movement without speeding the cafe clock',()=>{
  const normal=new Simulation(),energized=new Simulation();energized.reward('energy','stock');normal.move=energized.move={x:1,z:0};
  const origin=normal.s.player.x;normal.step(.1);energized.step(.1);
  expect(energized.s.player.x-origin).toBeCloseTo((normal.s.player.x-origin)*1.5);
  expect(energized.b.time).toBeCloseTo(normal.b.time);
 });
 it('accepts old saves without energy and rejects malformed energy timers',()=>{
  const g=new Simulation();delete g.s.energySeconds;expect(validateSave(g.s)).toBe(true);
  for(const invalid of [-1,121,NaN]){g.s.energySeconds=invalid;expect(validateSave(g.s)).toBe(false);}
 });
 it.each([TUNING.maxMoney-1,TUNING.maxMoney])('coin reward keeps the save valid at %s',coins=>{
  const g=new Simulation();g.s.coins=coins;const amount=g.rewardAmount('coins');expect(amount).toBe(TUNING.maxMoney-coins);expect(g.reward('edge','coins')).toBe(amount>0);expect(g.s.coins).toBe(TUNING.maxMoney);expect(validateSave(g.s)).toBe(true);
 });
 it('milestone awards respect the same currency cap',()=>{const g=new Simulation();g.s.coins=TUNING.maxMoney-1;g.s.totalServed=3;g.step(1/30);expect(g.s.coins).toBe(TUNING.maxMoney);expect(g.s.milestone).toBe(1);expect(validateSave(g.s)).toBe(true);});
 it('rollback, persist, reload, and return to the original time grant no repeated income',()=>{
  const g=automated(),store=storage(),at=10000000;g.s.savedAt=at;const coins=g.s.coins;
  expect(g.offline(at-3600000,true).amount).toBe(0);expect(g.s.savedAt).toBe(at);expect(persist(g.s,store,at-3600000)).toBe(true);
  const restored=new Simulation(load(store).save);expect(restored.s.savedAt).toBe(at);expect(restored.offline(at,true).amount).toBe(0);expect(restored.s.coins).toBe(coins);
  const next=restored.offline(at+3600000,true);expect(next.amount).toBeGreaterThan(0);expect(next.seconds).toBe(3600);expect(restored.offline(at+3600000,true).amount).toBe(0);
 });
 it('offline summary reports the credited amount rather than income discarded at the cap',()=>{const g=automated();g.s.coins=TUNING.maxMoney-1;g.s.savedAt=1000;expect(g.offline(3601000,true).amount).toBe(1);expect(g.s.coins).toBe(TUNING.maxMoney);expect(validateSave(g.s)).toBe(true);});
});
