import {describe,it,expect} from 'vitest';
import {DECOR,decorComfort,freshDecoration,legacyDecoration,type DecorId} from '../src/game/decor';
import {Simulation} from '../src/game/sim';
import {load,persist,SAVE_KEY,validateSave} from '../src/game/save';
const storage=()=>{const values=new Map<string,string>();return {getItem:(k:string)=>values.get(k)??null,setItem:(k:string,v:string)=>{values.set(k,v);},removeItem:(k:string)=>{values.delete(k);}};};
describe('earned decoration catalogue',()=>{
 it('opens a new café with structural basics only',()=>{
  const g=new Simulation();expect(g.b.decor).toEqual(freshDecoration());expect(g.b.decor.owned).toEqual(['concrete','classic','none']);expect(g.comfort).toBe(0);
  expect(['floor','furniture','plants'].map(slot=>Object.values(DECOR).filter(d=>d.slot===slot).length)).toEqual([4,4,4]);
  for(const [id,d] of Object.entries(DECOR))expect(d.cost===0).toBe(g.b.decor.owned.includes(id as DecorId));
 });
 it('round trips ownership of the complete larger catalogue and never charges twice',()=>{
  const g=new Simulation(),s=storage();g.s.coins=10000;
  for(const id of Object.keys(DECOR) as DecorId[]){const before=g.s.coins,owned=g.b.decor.owned.includes(id);expect(g.decorate(id)).toBe(true);expect(g.s.coins).toBe(before-(owned?0:DECOR[id].cost));}
  expect(g.b.decor.owned).toHaveLength(12);const remaining=g.s.coins;
  for(const id of Object.keys(DECOR) as DecorId[])expect(g.decorate(id)).toBe(true);
  expect(g.s.coins).toBe(remaining);expect(persist(g.s,s)).toBe(true);const restored=load(s);expect(restored.status).toBe('ok');expect(restored.save.branches[0].decor).toEqual(g.b.decor);
 });
 it('keeps a pre-catalogue v7 save and all six previous styles without buying them again',()=>{
  const g=new Simulation(),s=storage();g.b.decor={...legacyDecoration(),owned:['oak','tile','classic','cushions','simple','lush'],floor:'tile',furniture:'cushions',plants:'lush'};
  s.setItem(SAVE_KEY,JSON.stringify(g.s));const loaded=load(s);expect(loaded.status).toBe('ok');const restored=new Simulation(loaded.save),before=restored.s.coins;
  for(const id of g.b.decor.owned)expect(restored.decorate(id)).toBe(true);
  expect(restored.s.coins).toBe(before);expect(restored.b.decor.owned).toEqual(g.b.decor.owned);
 });
 it('preserves the original oak and potted plants when migrating a pre-v3 save',()=>{
  const g=new Simulation(),s=storage(),old:any=structuredClone(g.s);old.version=2;delete old.branches[0].decor;delete old.branches[0].level.space;s.setItem(SAVE_KEY,JSON.stringify(old));
  const loaded=load(s);expect(loaded.status).toBe('ok');expect(loaded.save.branches[0].decor).toEqual(legacyDecoration());
 });
 it('rejects unowned selections, wrong slots, unknown IDs and duplicate ownership',()=>{
  for(const mutate of [(d:any)=>d.floor='terracotta',(d:any)=>d.floor='classic',(d:any)=>d.owned.push('fake'),(d:any)=>d.owned.push('classic')]){const g=new Simulation();mutate(g.b.decor);expect(validateSave(g.s)).toBe(false);}
 });
 it('new styles use the existing comfort path and remain alternatives without stacking',()=>{
  const g=new Simulation();g.s.coins=10000;g.s.totalServed=3;
  for(const id of ['cushions','reading','sideboard'] as const){g.decorate(id);expect(g.comfort).toBe(2);}
  g.decorate('flowers');expect(g.comfort).toBe(4);expect(decorComfort(g.b.decor)).toBe(4);
  for(let i=0;i<35;i++)g.step(1/30);expect(g.b.customers[0].maxPatience).toBe(g.def.patience+4);
  g.decorate('classic');g.decorate('none');expect(g.comfort).toBe(0);
 });
});
