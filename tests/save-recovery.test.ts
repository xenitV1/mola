import {describe,it,expect} from 'vitest';
import {actor,freshSave,Simulation,type Customer} from '../src/game/sim';
import {validateSave,load,SAVE_KEY,BACKUP_KEY} from '../src/game/save';

const guest=(seat=0):Customer=>({...actor({x:0,z:0}),id:1,kind:'espresso',state:'waiting',seat,patience:44,maxPatience:44,timer:0,paid:false,tint:0});
function memory(values:Record<string,string>){return {getItem:(key:string)=>values[key]??null,setItem:(key:string,value:string)=>{values[key]=value;},removeItem:(key:string)=>{delete values[key];}};}
describe('save recovery and runtime invariants',()=>{
 it('recovers the known-good backup even when the primary key is missing',()=>{const s=freshSave();s.coins=321;const result=load(memory({[BACKUP_KEY]:JSON.stringify(s)}));expect(result.status).toBe('recovered');expect(result.save.coins).toBe(321);});
 it('rejects a seated guest without a seat and falls back before the simulation can crash',()=>{
  const s=freshSave();s.branches[0].customers=[guest(-1)];expect(validateSave(s)).toBe(false);
  const good=freshSave();good.coins=654;const store=memory({[SAVE_KEY]:JSON.stringify(s),[BACKUP_KEY]:JSON.stringify(good)}),restored=load(store);
  expect(restored.status).toBe('recovered');expect(restored.save.coins).toBe(654);expect(()=>new Simulation(restored.save).step(1/30)).not.toThrow();
 });
 it('accepts unseated queue and leaving guests, but rejects duplicate occupied seats',()=>{
  const s=freshSave();s.branches[0].customers=[{...guest(-1),state:'queue'},{...guest(-1),id:2,state:'leaving'}];expect(validateSave(s)).toBe(true);
  s.branches[0].customers=[guest(),{...guest(),id:2}];expect(validateSave(s)).toBe(false);
 });
 it.each(['-1','1','0.5','bad'])('rejects cash at non-existing table %s',key=>{const s=freshSave();s.branches[0].cash={[key]:21};expect(validateSave(s)).toBe(false);});
 it('rejects missing counters and orphan workers that would produce NaN or crash',()=>{
  const s=freshSave();delete (s.branches[0].losses as Partial<typeof s.branches[0]['losses']>).stock;expect(validateSave(s)).toBe(false);
  const orphan=freshSave();orphan.branches[0].workers.waiter=actor({x:0,z:0});expect(validateSave(orphan)).toBe(false);
 });
 it('rejects inherited catalog keys as menu items',()=>{
  const s=freshSave();(s.branches[0] as unknown as {menu:string}).menu='toString';expect(validateSave(s)).toBe(false);
  const c=freshSave();(c.player.cups as unknown[]).push({kind:'constructor',quality:0,born:0});expect(validateSave(c)).toBe(false);
 });
 it('retains an invalid backup when it is the only surviving source',()=>{
  const store=memory({[BACKUP_KEY]:'{broken'});expect(load(store).status).toBe('corrupt');expect(store.getItem(BACKUP_KEY+'.corrupt')).toBe('{broken');
 });
 it('still recovers readable backup when storage cannot archive the invalid primary',()=>{
  const good=freshSave();good.coins=888;const store={...memory({[SAVE_KEY]:'bad',[BACKUP_KEY]:JSON.stringify(good)}),setItem:()=>{throw new Error('Quota exceeded');}};const restored=load(store);expect(restored.status).toBe('recovered');expect(restored.save.coins).toBe(888);
 });
});
