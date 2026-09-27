import {expect,it} from 'vitest';
import {Simulation,actor,type Customer} from '../src/game/sim';
import {POINTS,ROLES} from '../src/game/config';
import {validateSave,migrateSave} from '../src/game/save';
const advance=(g:Simulation,s:number)=>{for(let i=0;i<s*10;i++)g.step(.1);};
const seated=(g:Simulation,persona:Customer['persona']='connoisseur'):Customer=>({...actor(g.seatPoint(0)),id:44,persona,seat:0,state:'waiting',kind:'espresso',patience:40,maxPatience:44,timer:0,paid:false,tint:0});
it('does not brew for an empty cafe or an approaching customer, but starts after seating',()=>{
 const g=new Simulation();g.b.spawn=100;g.s.player=actor(POINTS.machine);const stock=g.b.stock;advance(g,15);expect(g.b.ready).toHaveLength(0);expect(g.b.brew).toBe(0);expect(g.b.stock).toBe(stock);
 const c=seated(g);c.state='walking';c.path=[{x:8,z:10}];g.b.customers=[c];advance(g,1);expect(g.b.brew).toBe(0);
 c.state='waiting';c.path=[];Object.assign(c,g.seatPoint(0));advance(g,4);expect(g.s.player.cups.length+g.b.ready.length).toBe(1);expect(g.b.stock).toBe(stock-1);
});
it('records real freshness complaints and does not penalize quick service as slow',()=>{
 const run=(age:number)=>{const g=new Simulation();g.b.spawn=100;g.b.time=100;g.s.totalServed=10;const c=seated(g);g.b.customers=[c];g.s.player=actor(g.servicePoint(0));g.s.player.cups=[{kind:'espresso',born:100-age,quality:0}];g.step(.1);const coins=g.s.coins;g.s.player=actor(POINTS.entry);advance(g,8);expect(g.s.coins).toBe(coins);expect(g.b.reviews).toHaveLength(1);expect(c.review).toBe(g.b.reviews[0]);expect(validateSave(g.s)).toBe(true);return c.review!;};
 const fresh=run(0),stale=run(30);expect(fresh.score).toBeGreaterThan(stale.score);expect(fresh.reasons).not.toContain('slow');expect(stale.reasons).toContain('stale');
});
it('a tidy guest reacts to dirt experienced during the visit',()=>{
 const g=new Simulation();g.b.spawn=100;g.s.totalServed=10;const c=seated(g,'tidy');g.b.customers=[c];g.s.player=actor(g.servicePoint(0));g.s.player.cups=[{kind:'espresso',born:0,quality:0}];g.step(.1);g.s.player=actor(POINTS.entry);g.b.dirtyTables[0]=1;advance(g,8);expect(c.review!.reasons).toContain('dirty');expect(c.review!.score).toBeLessThanOrEqual(3);
});
it('reputation changes real arrivals while low ratings retain a recovery path',()=>{
 const run=(rating:number)=>{const g=new Simulation();g.s.totalServed=10;g.b.rating=rating;g.b.level.space=2;g.b.level.table=6;advance(g,20);return g.b.customers.length;};expect(run(5)).toBeGreaterThan(run(1));const poor=new Simulation();poor.b.rating=1;expect(poor.reputationDemand).toBeGreaterThan(0);
});
it('warns before a noise fine and lowering volume actually cancels it',()=>{
 const g=new Simulation();g.s.coins=1000;g.b.spawn=100;g.upgrade('stage');g.setVolume(3);const money=g.s.coins;advance(g,25);expect(g.b.warningSeconds).toBeGreaterThan(0);expect(g.b.fineCount).toBe(0);expect(g.s.coins).toBe(money);g.setVolume(1);advance(g,40);expect(g.b.warningSeconds).toBe(0);expect(g.b.fineCount).toBe(0);expect(g.s.coins).toBe(money);
});
it('continued loud music causes one visible affordable fine and insulation reduces risk',()=>{
 const g=new Simulation();g.s.coins=5000;g.b.spawn=100;g.upgrade('stage');g.setVolume(3);const money=g.s.coins;advance(g,55);expect(g.b.fineCount).toBe(1);expect(g.b.lastFine).toBe(80);expect(g.b.totalFines).toBe(80);expect(g.s.coins).toBe(money-80);expect(g.b.patrolSeconds).toBeGreaterThan(0);const outside=g.outsideNoise;g.upgrade('soundproof');g.upgrade('soundproof');expect(g.outsideNoise).toBeLessThan(outside);expect(g.outsideNoise).toBeLessThan(.62);expect(validateSave(g.s)).toBe(true);
});
it('owned stage changes collision routes and hires remain on reachable stations',()=>{
 const g=new Simulation();g.s.coins=10000;const through=g.route({x:3,z:-3.2},{x:7,z:-3.2});expect(through).toHaveLength(1);g.upgrade('stage');expect(g.blocked({x:5,z:-3.2})).toBe(true);const detour=g.route({x:3,z:-3.2},{x:7,z:-3.2});expect(detour.length).toBeGreaterThan(1);let from={x:3,z:-3.2};for(const to of detour){expect(g.segmentClear(from,to)).toBe(true);from=to;}
 for(const role of ROLES){g.hire(role);g.hireMore(role);}advance(g,20);expect(g.b.helpers.every(h=>!g.blocked(h.actor))).toBe(true);
});
it('v5 investments migrate without losing products or existing staff',()=>{
 const g=new Simulation();g.s.coins=10000;g.hire('waiter');g.upgradeRecipe('tea');const old:any=structuredClone(g.s);old.version=5;delete old.settings.helpSeen;const restored:any=migrateSave(old);expect(restored.version).toBe(7);expect(restored.branches[0].catalog.tea).toBe(1);expect(restored.branches[0].staff.waiter).toBe(1);expect(restored.branches[0].helpers).toEqual([]);expect(restored.coins).toBe(g.s.coins);expect(validateSave(restored)).toBe(true);
});

it('crowding follows opened floor capacity, not how few tables were purchased',()=>{
 const g=new Simulation();g.b.customers=[seated(g,'quiet'),{...seated(g,'quiet'),id:45,seat:1}];expect(g.crowding).toBe(.2);
 const before=g.crowding;g.b.level.table=2;expect(g.crowding).toBe(before);g.b.level.space=1;expect(g.crowding).toBeLessThan(before);
});
