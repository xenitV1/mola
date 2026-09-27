import {describe,it,expect} from 'vitest';
import {Simulation} from '../src/game/sim';
import {load,persist,SAVE_KEY,validateSave} from '../src/game/save';
import {POINTS} from '../src/game/config';
describe('physical floor growth and decoration',()=>{
 it('requires a real floor extension before buying a third table',()=>{
  const g=new Simulation();g.s.coins=10000;expect(g.maxTables).toBe(2);expect(g.floorEnd).toBe(4.5);
  g.upgrade('table');const before=g.s.coins;expect(g.upgrade('table')).toBe(false);expect(g.s.coins).toBe(before);
  expect(g.upgrade('space')).toBe(true);expect(g.floorEnd).toBe(8.5);expect(g.maxTables).toBe(4);expect(g.b.level.table).toBe(2);
  expect(g.upgrade('table')).toBe(true);expect(g.upgrade('space')).toBe(true);expect(g.upgrade('space')).toBe(false);
  g.b.mastery=1;expect(g.switchBranch(1)).toBe(true);expect(g.floorEnd).toBe(4.5);g.upgrade('space');g.upgrade('space');expect(g.floorEnd).toBe(12.5);expect(g.maxTables).toBe(6);
 });
 it('owns each decoration once and changes styles freely without cross-branch leaks',()=>{
  const g=new Simulation();expect(g.decorate('tile')).toBe(false);expect(g.b.decor.floor).toBe('concrete');g.s.coins=1000;
  expect(g.decorate('tile')).toBe(true);expect(g.s.coins).toBe(670);expect(g.b.decor.floor).toBe('tile');
  g.decorate('concrete');g.decorate('tile');expect(g.s.coins).toBe(670);expect(g.b.decor.owned.filter(x=>x==='tile')).toHaveLength(1);
  g.s.coins=5000;g.b.mastery=1;expect(g.switchBranch(1)).toBe(true);expect(g.b.decor.floor).toBe('concrete');expect(g.b.decor.owned).not.toContain('tile');g.switchBranch(0);expect(g.b.decor.floor).toBe('tile');
 });
 it('comfortable furniture and greenery give new guests the stated extra patience',()=>{
  const g=new Simulation();g.s.totalServed=3;g.s.coins=1000;g.decorate('cushions');g.decorate('lush');expect(g.comfort).toBe(4);
  for(let i=0;i<35;i++)g.step(1/30);expect(g.b.customers[0].maxPatience).toBe(g.def.patience+4);
  g.decorate('classic');expect(g.comfort).toBe(2);expect(g.b.customers[0].maxPatience).toBe(g.def.patience+4);
 });
 it('preserves v2 purchased tables and mastery when migrating to expandable rooms',()=>{
  const g=new Simulation();g.s.coins=9000;g.b.mastery=1;expect(g.switchBranch(1)).toBe(true);g.b.level.table=4;g.b.mastery=2;
  const old:any=structuredClone(g.s);old.version=2;for(const b of Object.values(old.branches) as any[]){delete b.decor;delete b.level.space;}
  const values=new Map([[SAVE_KEY,JSON.stringify(old)]]),storage={getItem:(k:string)=>values.get(k)??null,setItem:(k:string,v:string)=>{values.set(k,v);},removeItem:(k:string)=>{values.delete(k);}};
  const migrated=load(storage);expect(migrated.status).toBe('ok');expect(migrated.save.version).toBe(7);expect(migrated.save.branches[1].level.space).toBe(2);expect(migrated.save.branches[1].mastery).toBe(2);
  expect(migrated.save.coins).toBe(g.s.coins);expect(persist(migrated.save,storage)).toBe(true);
  const bad=structuredClone(migrated.save);bad.branches[1].decor.floor='tile';expect(validateSave(bad)).toBe(false);
 });
 it('keeps the moving frontage solid while preserving the entrance and active routes',()=>{
  const g=new Simulation();g.s.coins=1000;
  expect(g.blocked({x:1,z:4.15})).toBe(true);expect(g.blocked({x:-1.5,z:4.15})).toBe(false);
  g.s.player.x=1;g.s.player.z=8.15;g.go(POINTS.machine);g.upgrade('space');
  expect(g.blocked(g.s.player)).toBe(false);expect(g.s.player.path.length).toBeGreaterThan(0);
  expect(g.s.player.path.every(p=>!g.blocked(p))).toBe(true);
  expect(g.blocked({x:1,z:4.15})).toBe(false);expect(g.blocked({x:1,z:8.15})).toBe(true);
 });
 it('routes supply and guests around the cash desk instead of through its model',()=>{
  const g=new Simulation();for(const [start,end] of [[POINTS.supply,POINTS.machine],[POINTS.entry,g.servicePoint(0)]]){
   const route=g.route(start,end);expect(route.length).toBeGreaterThan(1);expect(route.every(p=>!g.blocked(p))).toBe(true);expect(route.at(-1)).toEqual(end);
  }
 });
});
