import {describe,expect,it} from 'vitest';
import {Simulation,actor,distance,type Customer,type Vec} from '../src/game/sim';
import {POINTS} from '../src/game/config';
import {TABLE_TYPES,tableSeats,tableOfSeat,seatId} from '../src/game/table-layout';

function cafe(tier:number){const g=new Simulation();g.s.coins=10000+6*TABLE_TYPES.reduce((n,t)=>n+t.cost,0);g.upgrade('space');g.upgrade('space');while(g.b.level.table<6)g.upgrade('table');for(let table=0;table<6;table++)for(let t=0;t<tier;t++)expect(g.upgradeTable(table)).toBe(true);g.upgrade('stage');g.s.player=actor(POINTS.entry);g.b.spawn=100;g.s.totalServed=10;return g;}
function clearRoute(g:Simulation,target:Vec,context:string){
 expect(g.blocked(target),`${context}: target blocked`).toBe(false);
 const path=g.route(POINTS.entry,target);expect(path.length,`${context}: empty route`).toBeGreaterThan(0);expect(path.at(-1),`${context}: wrong endpoint`).toEqual(target);
 let from=POINTS.entry;for(const to of path){expect(g.segmentClear(from,to),`${context}: segment ${JSON.stringify(from)} → ${JSON.stringify(to)}`).toBe(true);from=to;}
}
describe('table navigation and active guest compatibility',()=>{
 it.each([0,1,2,3])('routes to every tier %s seat and service area among six tables and a stage',tier=>{
  const g=cafe(tier);
  for(let table=0;table<6;table++)for(const seat of tableSeats(table,tier)){
   clearRoute(g,g.seatApproach(seat),`tier${tier}/table${table}/seat${seat}`);
   clearRoute(g,g.servicePoint(seat),`tier${tier}/table${table}/service${seat}`);
  }
 },20000);
 it.each([0,5])('walks ten distinct arriving guests to actual seats on table %s',table=>{
  const g=cafe(3);for(let i=0;i<6;i++)if(i!==table)g.b.dirtyTables[i]=g.tableCapacity(i);
  g.b.customers=Array.from({length:10},(_,i):Customer=>({...actor(POINTS.entry),id:100+i,seat:-1,state:'queue',kind:'espresso',patience:1000,maxPatience:1000,timer:0,paid:false,tint:i%6}));
  for(let i=0;i<350;i++)g.step(.1);
  expect(g.b.customers).toHaveLength(10);expect(g.b.customers.every(c=>c.state==='waiting')).toBe(true);
  expect(new Set(g.b.customers.map(c=>c.seat))).toEqual(new Set(tableSeats(table,3)));
  for(const c of g.b.customers){expect(tableOfSeat(c.seat)).toBe(table);expect(distance(c,g.seatPoint(c.seat))).toBeLessThan(.001);}
 },20000);
 it('seats all sixty arriving guests on distinct physical places in a fully upgraded cafe',()=>{
  const g=cafe(3);g.b.customers=Array.from({length:60},(_,i):Customer=>({...actor(POINTS.entry),id:200+i,seat:-1,state:'queue',kind:'espresso',patience:1000,maxPatience:1000,timer:0,paid:false,tint:i%6}));
  for(let i=0;i<350;i++)g.step(.1);
  expect(g.b.customers).toHaveLength(60);expect(g.b.customers.every(c=>c.state==='waiting')).toBe(true);expect(new Set(g.b.customers.map(c=>c.seat)).size).toBe(60);
  for(const c of g.b.customers)expect(distance(c,g.seatPoint(c.seat))).toBeLessThan(.001);
 },20000);
 it('upgrades an occupied table without losing seated guest IDs, payment, drink timer or orders',()=>{
  const g=cafe(0);const waiting:Customer={...actor(g.seatPoint(0)),id:70,seat:0,state:'waiting',kind:'latte',patience:20,maxPatience:44,timer:0,paid:false,tint:1};
  const drinking:Customer={...actor(g.seatPoint(1)),id:71,seat:1,state:'drinking',kind:'cake',patience:30,maxPatience:44,timer:12.25,paid:true,tint:2};g.b.customers=[waiting,drinking];
  for(let tier=1;tier<=3;tier++){expect(g.upgradeTable(0)).toBe(true);expect(waiting).toMatchObject({id:70,seat:seatId(0,0),kind:'latte',state:'waiting',paid:false,patience:20+TABLE_TYPES[tier].comfort});expect(drinking).toMatchObject({id:71,seat:seatId(0,1),kind:'cake',state:'drinking',paid:true,timer:12.25});expect(distance(waiting,g.seatPoint(0))).toBe(0);expect(distance(drinking,g.seatPoint(1))).toBe(0);expect(g.b.customers).toHaveLength(2);}
 });
});
