import {it,expect} from 'vitest';
import {Simulation,actor,type Customer} from '../src/game/sim';
import {migrateSave,validateSave} from '../src/game/save';
import {tableOfSeat,localSeat,TABLE_TYPES} from '../src/game/table-layout';
import {QUEUE_LINE} from '../src/game/config';
it('upgrades selected furniture while preserving table count and rejects unavailable purchases without spending',()=>{
 const g=new Simulation();const coins=g.s.coins;expect(g.upgradeTable(0)).toBe(false);expect(g.s.coins).toBe(coins);g.s.coins=10000+TABLE_TYPES.reduce((n,t)=>n+t.cost,0);expect(g.upgradeTable(1)).toBe(false);expect(g.upgradeTable(-1)).toBe(false);expect(g.upgradeTable(.5)).toBe(false);expect(g.upgradeTable(0)).toBe(true);expect(g.b.level.table).toBe(1);expect(g.tableCapacity(0)).toBe(4);expect(g.seatingCapacity).toBe(4);const before=g.s.coins;expect(g.upgradeTable(0)).toBe(false);expect(g.s.coins).toBe(before);
 g.upgrade('space');expect(g.upgradeTable(0)).toBe(true);expect(g.tableCapacity(0)).toBe(6);expect(g.upgradeTable(0)).toBe(false);g.upgrade('space');expect(g.upgradeTable(0)).toBe(true);expect(g.tableCapacity(0)).toBe(10);expect(g.upgradeTable(0)).toBe(false);expect(validateSave(g.s)).toBe(true);
});
it('full floor saturation has a second investment path up to sixty real seats',()=>{
 const g=new Simulation();g.s.coins=10000+6*TABLE_TYPES.reduce((n,t)=>n+t.cost,0);g.upgrade('space');g.upgrade('space');while(g.b.level.table<6)g.upgrade('table');expect(g.seatingCapacity).toBe(12);expect(g.upgrade('table')).toBe(false);
 for(let i=0;i<6;i++)for(let tier=0;tier<3;tier++)expect(g.upgradeTable(i)).toBe(true);expect(g.seatingCapacity).toBe(60);expect(new Set(g.seatIds).size).toBe(60);expect(g.seatIds.every(id=>tableOfSeat(id)<6&&localSeat(id)<10)).toBe(true);expect(validateSave(g.s)).toBe(true);
});
it('a higher rating creates a real arrival surge and a queue that stays on the pavement',()=>{
 const run=(rating:number)=>{const g=new Simulation();g.s.totalServed=40;for(let i=0;i<30*30;i++){g.b.rating=rating;g.step(1/30);}return {arrivals:g.b.guestSerial,queue:g.queue.length,capacity:g.queueCapacity,positions:g.queue.map(c=>c.path.at(-1)??c),multiplier:g.reputationDemand};};
 const normal=run(4),popular=run(5);expect(popular.arrivals).toBeGreaterThanOrEqual(normal.arrivals*2);expect(popular.queue).toBeGreaterThanOrEqual(8);
 expect(popular.capacity).toBeGreaterThan(normal.capacity);expect(popular.capacity).toBeLessThanOrEqual(QUEUE_LINE.rows*QUEUE_LINE.perRow);
 expect(popular.multiplier).toBeGreaterThan(4);
 const lastRow=QUEUE_LINE.z+(QUEUE_LINE.rows-1)*QUEUE_LINE.rowGap;
 expect(popular.positions.every(p=>p.z>=QUEUE_LINE.z&&p.z<=lastRow&&p.x>=QUEUE_LINE.x&&p.x<=QUEUE_LINE.x+(QUEUE_LINE.perRow-1)*QUEUE_LINE.step)).toBe(true);
 const poor=new Simulation();poor.b.rating=1;expect(poor.reputationDemand).toBe(.45);
});
it('demand climbs smoothly through the four to five star band instead of jumping at one point',()=>{
 const g=new Simulation();const at=(rating:number)=>{g.b.rating=rating;return g.reputationDemand;};
 const steps=[3.6,3.8,4,4.2,4.4,4.6,4.8,5].map(at);
 for(let i=1;i<steps.length;i++)expect(steps[i]).toBeGreaterThan(steps[i-1]);
 // No single .2 star step may more than double demand: the old 4.0 cliff made
 // every rating below it feel identical and everything above it explode.
 for(let i=1;i<steps.length;i++)expect(steps[i]).toBeLessThan(steps[i-1]*2);
 expect(at(4.5)).toBeGreaterThan(at(4)*1.5);
 const arrivals=(rating:number)=>{const s=new Simulation();s.s.totalServed=40;for(let i=0;i<20*30;i++){s.b.rating=rating;s.step(1/30);}return s.b.guestSerial;};
 expect(arrivals(4.5)).toBeGreaterThan(arrivals(4));expect(arrivals(5)).toBeGreaterThan(arrivals(4.5));
});
it('v6 migration preserves reviews, helpers, stage, warning, cash and old seat identities',()=>{
 const g=new Simulation();g.s.coins=10000;g.s.settings.helpSeen=true;g.upgrade('table');g.hire('waiter');g.hireMore('waiter');g.upgrade('stage');g.setVolume(3);g.b.warningSeconds=18;g.b.reviews=[{id:90,persona:'social',score:4,reasons:['music'],time:0}];g.b.reviewCount=1;
 const customer:Customer={...actor(g.seatPoint(2)),id:91,seat:2,state:'waiting',kind:'espresso',patience:30,maxPatience:44,timer:0,paid:false,tint:0};g.b.customers=[customer];const old:any=structuredClone(g.s);old.version=6;delete old.branches[0].tableLevels;delete old.branches[0].priceModes;
 const migrated=migrateSave(old) as typeof g.s;expect(validateSave(migrated)).toBe(true);expect(migrated.version).toBe(7);expect(migrated.coins).toBe(g.s.coins);expect(migrated.settings.helpSeen).toBe(true);expect(migrated.branches[0].helpers).toHaveLength(1);expect(migrated.branches[0].level.stage).toBe(1);expect(migrated.branches[0].warningSeconds).toBe(18);expect(migrated.branches[0].reviews).toEqual(g.b.reviews);expect(migrated.branches[0].customers[0].seat).toBe(2);expect(migrated.branches[0].customers[0].quotedPrice).toBe(18);expect(migrated.branches[0].tableLevels).toEqual([0,0,0,0,0,0]);
});
it('rejects seats that do not exist at a table tier and unknown saved prices',()=>{
 const g=new Simulation();const c:Customer={...actor(g.seatPoint(0)),id:22,seat:12,state:'waiting',kind:'espresso',patience:30,maxPatience:44,timer:0,paid:false,tint:0};g.b.customers=[c];expect(validateSave(g.s)).toBe(false);g.s.coins=TABLE_TYPES[1].cost;g.b.customers=[];g.upgradeTable(0);g.b.customers=[c];expect(validateSave(g.s)).toBe(true);const bad:any=structuredClone(g.s);bad.branches[0].priceModes.espresso='unlimited';expect(validateSave(bad)).toBe(false);
});
