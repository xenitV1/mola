import {describe,it,expect} from 'vitest';
import {Simulation,actor,newBranch,type Customer} from '../src/game/sim';
import {load,persist,SAVE_KEY,validateSave} from '../src/game/save';
const storage=()=>{const values=new Map<string,string>();return {getItem:(k:string)=>values.get(k)??null,setItem:(k:string,v:string)=>{values.set(k,v);},removeItem:(k:string)=>{values.delete(k);}};};
function guest(g:Simulation,kind:Customer['kind'],fraction:number):Customer{return {...actor(g.seatPoint(0)),id:200,kind,state:'waiting',seat:0,patience:40*fraction,maxPatience:40,timer:0,paid:false,tint:0};}
describe('permanent café mastery',()=>{
 it('requires every goal and awards each star only once, across reloads',()=>{
  const g=new Simulation(),s=storage();g.b.served=40;g.b.level.table=2;
  expect(g.claimMastery()).toBe(false);g.s.coins=10000;
  g.hire('barista');g.hire('waiter');g.hire('supplier');const before=g.s.coins;
  expect(g.claimMastery()).toBe(true);expect(g.s.coins).toBe(before+1000);
  expect(g.claimMastery()).toBe(false);expect(persist(g.s,s)).toBe(true);
  const restored=new Simulation(load(s).save);expect(restored.b.mastery).toBe(1);expect(restored.claimMastery()).toBe(false);
  restored.b.signatureServed=50;restored.b.rating=4.2;expect(restored.claimMastery()).toBe(false);
  restored.b.rating=4.3;expect(restored.claimMastery()).toBe(true);
 });
 it.each([[0,'latte',.7,0,true],[0,'latte',.4,0,false],[0,'espresso',.9,3,false],[1,'espresso',.7,0,true],[1,'espresso',.5,0,false],[2,'cake',.4,2,true],[2,'cake',.9,1,false]] as const)('counts actual local signature service in branch %s (%s)',(branch,kind,fraction,quality,counts)=>{
  const g=new Simulation();g.s.active=branch;g.s.branches[branch]=newBranch();g.b.customers=[guest(g,kind,fraction)];
  g.s.player=actor(g.servicePoint(0));g.s.player.cups=[{kind,quality,born:0}];g.step(1/30);
  expect(g.b.customers[0].state).toBe('drinking');expect(g.b.signatureServed).toBe(counts?1:0);
  g.step(1/30);expect(g.b.signatureServed).toBe(counts?1:0);
 });
 it('finishes the chain only when all nine permanent stars are earned',()=>{
  const g=new Simulation();for(let i=0;i<3;i++)g.s.branches[i]={...newBranch(),mastery:3};
  g.s.branches[2].mastery=2;expect(g.chainComplete).toBe(false);g.s.branches[2].mastery=3;expect(g.chainComplete).toBe(true);expect(g.claimMastery()).toBe(false);
 });
 it('always routes the waiter to orders, including a legacy cash priority save',()=>{
  const make=(policy:'balanced'|'cash')=>{const g=new Simulation();g.b.level.table=2;g.b.servicePolicy=policy;g.b.staff.waiter=1;
   g.b.workers.waiter=actor({x:-.5,z:3});g.b.workers.waiter.cups=[{kind:'espresso',quality:0,born:0}];
   g.b.customers=[guest(g,'espresso',1)];g.b.cash[1]=20;g.s.player=actor({x:-2,z:5});g.step(1/30);return g;};
  const service=make('balanced'),cash=make('cash');
  expect(service.b.workers.waiter!.path.at(-1)).toEqual(service.servicePoint(0));
  expect(cash.b.workers.waiter!.path.at(-1)).toEqual(cash.servicePoint(0));
 });
 it('migrates an old save without resetting money, staff, branches, language or boost',()=>{
  const g=new Simulation();g.s.coins=10000;g.hire('barista');g.b.mastery=1;g.switchBranch(1);g.s.settings.locale='tr';g.s.boostSeconds=72;
  const old:any=structuredClone(g.s);old.version=1;old.boostUntil=old.boostSeconds;delete old.boostSeconds;
  for(const b of Object.values(old.branches) as any[]){delete b.mastery;delete b.signatureServed;delete b.servicePolicy;}
  const s=storage();s.setItem(SAVE_KEY,JSON.stringify(old));const result=load(s);
  expect(result.status).toBe('ok');expect(validateSave(result.save)).toBe(true);expect(result.save.coins).toBe(g.s.coins);
  expect(result.save.active).toBe(1);expect(result.save.branches[0].staff.barista).toBe(1);expect(result.save.settings.locale).toBe('tr');expect(result.save.boostSeconds).toBe(72);
  expect(result.save.branches[1].mastery).toBe(0);expect(persist(result.save,s)).toBe(true);expect(load(s).save.version).toBe(7);
  old.coins=-1;s.setItem(SAVE_KEY,JSON.stringify(old));s.removeItem(SAVE_KEY+'.backup');expect(load(s).status).toBe('corrupt');
 });
});
