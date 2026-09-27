import {describe,it,expect} from 'vitest';
import {Simulation,actor,newBranch,type Customer} from '../src/game/sim';
import {TAKEAWAY,POINTS} from '../src/game/config';
import {validateSave,migrateSave,load,persist} from '../src/game/save';
import {nextAction} from '../src/game/guide';
import {seatedAmount} from '../src/view/pose';
function office(){const g=new Simulation();g.s.coins=10000;g.b.mastery=1;g.switchBranch(1);g.b.mastery=1;g.b.level.table=2;g.s.totalServed=40;g.s.milestone=7;g.setMenu('espresso');g.s.player=actor({x:0,z:5.8});return g;}
function guest(g:Simulation,state:Customer['state']='pickup-waiting'):Customer{return {...actor(TAKEAWAY.guest),id:999,kind:'espresso',state,takeaway:true,seat:-1,patience:27,maxPatience:27,timer:0,paid:false,tint:0};}
function advance(g:Simulation,seconds:number){for(let i=0;i<seconds*10;i++)g.step(.1);}
describe('office counter creates a distinct service route',()=>{
 it('requires the office first star and charges once; reopening stays free',()=>{
  const g=new Simulation();g.s.coins=10000;g.b.mastery=1;expect(g.buyTakeaway()).toBe(false);g.switchBranch(1);expect(g.buyTakeaway()).toBe(false);g.b.mastery=1;
  const before=g.s.coins;expect(g.buyTakeaway()).toBe(true);expect(g.s.coins).toBe(before-TAKEAWAY.cost);expect(g.buyTakeaway()).toBe(false);
  expect(g.setTakeaway(false)).toBe(true);expect(g.setTakeaway(true)).toBe(true);expect(g.s.coins).toBe(before-TAKEAWAY.cost);
 });
 it('takes a real matching cup, pays only once at the counter, and uses no seat',()=>{
  const g=office();g.buyTakeaway();const c=guest(g);g.b.customers=[c];g.b.spawn=100;g.s.player=actor(TAKEAWAY.service);g.s.player.cups=[{kind:'espresso',quality:0,born:0}];const before=g.s.coins;
  g.step(.1);expect(c.state).toBe('pickup-done');expect(c.seat).toBe(-1);expect(seatedAmount(c)).toBe(0);expect(c.paid).toBe(true);expect(c.cups).toHaveLength(1);expect(g.s.player.cups).toHaveLength(0);
  expect(g.s.coins).toBe(before+20);expect(g.b.takeaway.cash).toBe(0);expect(g.b.takeaway.served).toBe(1);expect(g.b.served).toBe(1);expect(g.b.cash).toEqual({});expect(validateSave(g.s)).toBe(true);
  advance(g,1);expect(g.s.coins).toBe(before+20);expect(g.b.takeaway.cash).toBe(0);expect(g.b.served).toBe(1);expect(c.state).toBe('leaving');
 });
 it('does not hand over the wrong menu item and guides to the actual pickup point',()=>{
  const g=office();g.buyTakeaway();g.b.spawn=100;g.b.customers=[guest(g)];g.s.player=actor(TAKEAWAY.service);g.s.player.cups=[{kind:'latte',quality:0,born:0}];g.step(.1);expect(g.b.takeaway.served).toBe(0);
  g.s.player.cups=[{kind:'espresso',quality:0,born:0}];expect(nextAction(g).target).toEqual(TAKEAWAY.service);expect(nextAction(g).button).toBe('Paketi teslim et');
 });
 it('keeps both pickup and delivery routes clear in every office floor size',()=>{
  const g=office();g.buyTakeaway();for(const space of [0,1,2]){g.b.level.space=space;g.b.level.table=2+space*2;expect(g.blocked(TAKEAWAY.guest)).toBe(false);expect(g.blocked(TAKEAWAY.service)).toBe(false);
   for(const [from,to] of [[POINTS.entry,TAKEAWAY.guest],[POINTS.machine,TAKEAWAY.service]]){const path=g.route(from,to);expect(path.at(-1)).toEqual(to);let p=from;for(const q of path){expect(g.segmentClear(p,q)).toBe(true);p=q;}}
  }
 });
 it('a full worker team finishes existing pickup orders after closing the mode',()=>{
  const g=office();g.buyTakeaway();for(const role of ['barista','waiter','supplier','cleaner','dishwasher'] as const)g.hire(role);g.b.customers=[{...guest(g,'queue'),...actor(POINTS.entry)}];g.b.spawn=100;g.setTakeaway(false);advance(g,55);
  expect(g.b.takeaway.served).toBe(1);expect(g.b.takeaway.cash).toBe(0);expect(g.b.customers).toHaveLength(0);expect(validateSave(g.s)).toBe(true);
 });
 it('adds coffee demand, but never makes cake a takeaway order',()=>{
  const g=office(),base=g.demand;g.buyTakeaway();expect(g.demand).toBeCloseTo(base*1.25);g.setMenu('cake');expect(g.takeawayActive).toBe(false);advance(g,20);expect(g.b.customers.every(c=>!c.takeaway)).toBe(true);
 });
 it('migrates shipped v3 cafés without loss and preserves a v4 paid handoff on reload',()=>{
  const g=office();const old:any=structuredClone(g.s);old.version=3;old.settings.locale='tr';for(const b of Object.values(old.branches) as any[])delete b.takeaway;
  const migrated:any=migrateSave(old);expect(validateSave(migrated)).toBe(true);expect(migrated.version).toBe(7);expect(migrated.coins).toBe(g.s.coins);expect(migrated.branches[1].mastery).toBe(1);expect(migrated.settings.locale).toBe('tr');expect(migrated.branches[1].takeaway.owned).toBe(false);
  g.buyTakeaway();const c={...guest(g,'pickup-done'),paid:true,timer:.5,cups:[{kind:'espresso' as const,quality:0,born:0}]};g.b.customers=[c];g.b.takeaway.cash=20;g.b.takeaway.served=1;
  const data=new Map<string,string>(),store={getItem:(k:string)=>data.get(k)??null,setItem:(k:string,v:string)=>{data.set(k,v);},removeItem:(k:string)=>{data.delete(k);}};
  expect(persist(g.s,store)).toBe(true);const restored=new Simulation(load(store).save);advance(restored,2);expect(restored.b.takeaway.cash).toBe(0);expect(restored.s.coins).toBe(g.s.coins+20);expect(restored.b.takeaway.served).toBe(1);expect(validateSave(restored.s)).toBe(true);
 });
 it('rejects orphan pickup states, duplicate pickup positions, and unavailable projects',()=>{
  const g=office();g.b.customers=[guest(g)];expect(validateSave(g.s)).toBe(false);g.b.customers=[];g.b.takeaway.cash=20;expect(validateSave(g.s)).toBe(false);g.b.takeaway.cash=0;g.b.customers=[guest(g)];g.buyTakeaway();expect(validateSave(g.s)).toBe(true);g.b.customers.push({...guest(g),id:1000});expect(validateSave(g.s)).toBe(false);
  const home=new Simulation();home.b.takeaway.owned=true;expect(validateSave(home.s)).toBe(false);
 });
 it('attributes a full pickup queue to service rather than missing tables',()=>{
  const g=office();g.buyTakeaway();g.random=()=>.1;g.b.spawn=0;g.b.customers=Array.from({length:5},(_,i)=>({...guest(g,'queue'),...actor(POINTS.entry),id:i+1}));g.step(.1);expect(g.b.losses.service).toBe(1);expect(g.b.losses.seat).toBe(0);expect(validateSave(g.s)).toBe(true);
 });
 it('continues takeaway through unattended and offline work using the same payments',()=>{
  const g=office();g.buyTakeaway();for(const role of ['barista','waiter','supplier','cleaner','dishwasher'] as const)g.hire(role);g.b.level.table=2;g.s.savedAt=1000;const before=g.s.coins;
  g.offline(3601000,true);expect(g.b.takeaway.served).toBeGreaterThan(0);expect(g.s.coins).toBeGreaterThan(before);expect(validateSave(g.s)).toBe(true);
  g.switchBranch(0);const served=g.s.branches[1].takeaway.served;advance(g,80);expect(g.s.branches[1].takeaway.served).toBeGreaterThan(served);expect(validateSave(g.s)).toBe(true);
 });
});

describe('takeaway has a real capacity tradeoff',()=>{
 const shift=(quality:number,open:boolean)=>{const g=office();for(const role of ['barista','waiter','supplier','cleaner','dishwasher'] as const)g.hire(role);g.b.level.quality=quality;g.buyTakeaway();g.setTakeaway(open);advance(g,450);return g.b;};
 it('earns more with spare brewing capacity',()=>{const tables=shift(0,false),mixed=shift(0,true);expect(mixed.earned).toBeGreaterThan(tables.earned);expect(mixed.takeaway.served).toBeGreaterThan(0);},20000);
 it('extra demand loses more guests when premium beans overload the entry machine',()=>{const tables=shift(3,false),mixed=shift(3,true);expect(mixed.takeaway.served).toBeGreaterThan(0);expect(mixed.lost).toBeGreaterThan(tables.lost);},20000);
});
