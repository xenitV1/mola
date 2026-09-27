import {describe,it,expect} from 'vitest';
import {actor,freshSave,Simulation,type Customer} from '../src/game/sim';
import {load,persist,SAVE_KEY,validateSave} from '../src/game/save';

function crowded(count:number){
 const save=freshSave(),b=save.branches[0];
 save.totalServed=400;b.level.space=2;b.level.table=6;b.tableLevels.fill(3);b.rating=5;
 b.customers=Array.from({length:count},(_,i):Customer=>({...actor({x:0,z:0}),id:i+1,kind:'espresso',state:'leaving',seat:-1,patience:40,maxPatience:40,timer:0,paid:false,tint:0,path:[{x:0,z:15}]}));
 b.guestSerial=count;b.spawn=0;
 return new Simulation(save);
}
function memory(){const values=new Map<string,string>();return {getItem:(key:string)=>values.get(key)??null,setItem:(key:string,value:string)=>{values.set(key,value);},removeItem:(key:string)=>{values.delete(key);}};}

describe('large crowds survive saving',()=>{
 it('persists and reloads when a real simulation step adds the 97th visitor',()=>{
  const g=crowded(96),store=memory();expect(validateSave(g.s)).toBe(true);
  g.step(1/30);expect(g.b.customers).toHaveLength(97);
  expect(persist(g.s,store)).toBe(true);
  const restored=load(store);expect(restored.status).toBe('ok');expect(restored.save.branches[0].customers).toHaveLength(97);
  const resumed=new Simulation(restored.save);resumed.step(1/30);expect(validateSave(resumed.s)).toBe(true);
 });
 it('roundtrips the runtime ceiling and still refuses an oversized or malformed crowd',()=>{
  const g=crowded(0),limit=g.crowdCap,full=crowded(limit),store=memory();
  expect(limit).toBe(112);expect(persist(full.s,store)).toBe(true);
  expect(load(store).save.branches[0].customers).toHaveLength(limit);
  full.step(1/30);expect(full.b.customers).toHaveLength(limit);
  const saved=store.getItem(SAVE_KEY);
  expect(persist(crowded(limit+1).s,store)).toBe(false);expect(store.getItem(SAVE_KEY)).toBe(saved);
  const broken=crowded(limit);broken.b.customers[0].x=NaN;expect(validateSave(broken.s)).toBe(false);
  broken.b.customers[0].x=0;broken.b.customers[1].id=broken.b.customers[0].id;expect(validateSave(broken.s)).toBe(false);
 });
});
