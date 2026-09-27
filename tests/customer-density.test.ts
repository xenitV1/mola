import {describe,it,expect} from 'vitest';
import {Simulation,actor,type Customer} from '../src/game/sim';
import {POINTS,QUEUE_LINE,ROOM} from '../src/game/config';
import {tableOfSeat} from '../src/game/table-layout';
import {validateSave} from '../src/game/save';

const guest=(g:Simulation,seat:number,state:Customer['state']='waiting'):Customer=>
 ({...actor(g.seatPoint(seat)),id:seat+1,seat,state,kind:'espresso',patience:70,maxPatience:70,timer:0,paid:false,tint:0});
const advance=(g:Simulation,seconds:number)=>{for(let i=0;i<Math.round(seconds*30);i++)g.step(1/30);};
function cafe(tier:number,tables:number,space:number){
 const g=new Simulation();g.s.coins=1e9;g.s.totalServed=400;
 g.b.level.space=space;g.b.level.table=tables;g.b.tableLevels=Array(6).fill(tier);
 return g;
}

describe('a growing café draws a real crowd',()=>{
 it('pulls more guests as the player adds seats, comfort, menu and stars',()=>{
  const small=cafe(0,2,0),large=cafe(3,6,2);
  expect(large.capacityDraw).toBeGreaterThan(small.capacityDraw*2);
  const arrivals=(g:Simulation)=>{g.s.totalServed=40;for(let i=0;i<30*30;i++){g.b.rating=4.2;g.step(1/30);}return g.b.guestSerial;};
  expect(arrivals(cafe(3,6,2))).toBeGreaterThan(arrivals(cafe(0,2,0))*2);
  // Every investment the player can see must move the draw, not the rating alone.
  const base=cafe(1,4,1),draw=base.capacityDraw;
  base.b.mastery=1;expect(base.capacityDraw).toBeGreaterThan(draw);
 });

 it('keeps the opening minutes of a brand new café calm', ()=>{
  const g=new Simulation();advance(g,120);
  expect(g.seatingCapacity).toBe(2);
  expect(g.queueCapacity).toBeLessThanOrEqual(7);
  expect(g.b.guestSerial).toBeLessThan(20);
 });

 it('grows the outdoor line with the business and keeps it on the pavement',()=>{
  const start=new Simulation(),grown=cafe(3,6,2);
  grown.b.rating=start.b.rating=4.6;
  expect(grown.queueCapacity).toBeGreaterThan(start.queueCapacity*2);
  expect(grown.queueCapacity).toBeLessThanOrEqual(QUEUE_LINE.rows*QUEUE_LINE.perRow);
  const slots=Array.from({length:QUEUE_LINE.rows*QUEUE_LINE.perRow},(_,i)=>
   ({x:QUEUE_LINE.x+(i%QUEUE_LINE.perRow)*QUEUE_LINE.step,z:QUEUE_LINE.z+Math.floor(i/QUEUE_LINE.perRow)*QUEUE_LINE.rowGap}));
  // Outside the widest café floor, inside the pavement, short of the walking lane.
  for(const slot of slots){
   expect(slot.z).toBeGreaterThan(12.5+.4);
   expect(slot.z).toBeLessThan(ROOM.entryZ-.2);
   expect(slot.x).toBeGreaterThan(-5.3+.3);
   expect(slot.x).toBeLessThan(ROOM.walkRight);
  }
 });

 it('lets the on-stage crowd grow with the café but keeps a ceiling phones can draw',()=>{
  const grown=cafe(3,6,2);grown.b.rating=5;
  expect(grown.crowdCap).toBeGreaterThan(new Simulation().crowdCap);
  expect(grown.crowdCap).toBeLessThanOrEqual(112);
 });
});

describe('capacity the player buys actually carries the crowd',()=>{
 it('sends a waiter out with the tray the café paid for instead of a single cup',()=>{
  const load=(tray:number)=>{
   const g=cafe(1,4,1);g.b.level.tray=tray;g.b.spawn=100;g.b.prep=5;g.s.player=actor({x:0,z:6});
   g.hire('waiter');const waiter=g.roleActors('waiter')[0];Object.assign(waiter,actor(POINTS.machine));
   g.b.customers=[guest(g,0),guest(g,1),guest(g,2),guest(g,3),guest(g,4)];
   g.b.ready=Array.from({length:5},()=>({kind:'espresso' as const,quality:0,born:0}));
   for(let i=0;i<20;i++){g.step(1/30);Object.assign(waiter,{x:POINTS.machine.x,z:POINTS.machine.z});}
   return waiter.cups.length;
  };
  expect(load(2)).toBe(2);
  expect(load(5)).toBe(5);
 });

 it('serves visibly more guests per minute once the tray is upgraded',()=>{
  const run=(tray:number)=>{
   const g=cafe(2,6,2);g.b.level.tray=tray;g.b.level.machine=5;g.b.prep=5;g.b.rating=4.6;
   for(const role of ['barista','waiter','supplier','cleaner','dishwasher'] as const){g.hire(role);g.hireMore(role);}
   g.s.player=actor({x:0,z:6});
   const keep=()=>{g.b.stock=Math.max(g.b.stock,12);for(const k of Object.keys(g.b.ingredients) as ('milk'|'pastry'|'cold')[])g.b.ingredients[k]=Math.max(g.b.ingredients[k],12);};
   for(let i=0;i<30*60;i++){keep();g.b.rating=4.6;g.step(1/30);}
   const from=g.b.served;
   for(let i=0;i<30*90;i++){keep();g.b.rating=4.6;g.step(1/30);}
   return g.b.served-from;
  };
  expect(run(5)).toBeGreaterThan(run(2)*1.3);
 },30000);

 it('adds a third cleaner and puts the extra ones on the floor while the first clears tables',()=>{
  const g=cafe(1,4,1);g.b.spawn=100;g.s.player=actor({x:9,z:13});
  expect(g.staffLimit('cleaner')).toBe(3);
  g.hire('cleaner');g.hireMore('cleaner');g.hireMore('cleaner');
  expect(g.staffCount('cleaner')).toBe(3);
  for(let i=0;i<5;i++)g.cleanliness.patches.push({id:++g.cleanliness.serial,x:2+i*.9,z:6,zone:'floor',kind:'spill',work:0});
  g.b.dirtyTables[0]=1;g.b.cleanDishes=30;
  g.step(1/30);
  const tasks=g.roleActors('cleaner').map(a=>a.task??'');
  expect(tasks.some(t=>t.startsWith('clean-'))).toBe(true);
  expect(tasks.filter(t=>t.startsWith('sweep-')).length).toBeGreaterThanOrEqual(1);
  // Both jobs actually finish: the table is cleared and the floor gets swept.
  advance(g,20);
  expect(g.b.dirtyTables[0]).toBeUndefined();
  expect(g.cleanliness.patches.length).toBeLessThan(5);
 });
});

describe('a large table is shared, not blocked, by one guest leaving',()=>{
 it('keeps the remaining places of a ten seat table open',()=>{
  const g=cafe(3,6,2);g.b.spawn=100;
  expect(g.tableCapacity(0)).toBe(10);
  g.b.dirtyTables[0]=1;
  const waiting:Customer={...actor(POINTS.entry),id:99,seat:-1,state:'queue',kind:'espresso',patience:70,maxPatience:70,timer:0,paid:false,tint:0};
  g.b.customers=[waiting];
  advance(g,1);
  expect(waiting.seat).toBeGreaterThanOrEqual(0);
  expect(tableOfSeat(waiting.seat)).toBe(0);
  // Only when every place is taken or waiting to be cleared does the table close.
  const full=cafe(3,6,2);full.b.spawn=100;full.b.dirtyTables={0:10,1:10,2:10,3:10,4:10,5:10};
  const turned:Customer={...actor(POINTS.entry),id:98,seat:-1,state:'queue',kind:'espresso',patience:70,maxPatience:70,timer:0,paid:false,tint:0};
  full.b.customers=[turned];advance(full,1);
  expect(turned.seat).toBe(-1);
  expect(validateSave(g.s)).toBe(true);
 });

 it('charges one uncleared place as a share of the table, not as a filthy café',()=>{
  const big=cafe(3,6,2),small=cafe(0,6,2);big.b.spawn=small.b.spawn=100;
  big.b.dirtyTables[0]=1;small.b.dirtyTables[0]=1;
  const seated=(g:Simulation)=>{const c=guest(g,g.seatIds.filter(id=>tableOfSeat(id)===0)[1],'drinking');c.timer=20;g.b.customers=[c];advance(g,4);return c.visit!.dirty/c.visit!.seconds;};
  const shared=seated(big),bistro=seated(small);
  expect(shared).toBeLessThan(.25);
  expect(bistro).toBeGreaterThan(shared);
 });
});

describe('comfortable seating slows the room down instead of only adding seats',()=>{
 it('keeps a guest at a roomy table longer than at a bistro table',()=>{
  const sitTime=(tier:number)=>{
   const g=cafe(tier,6,2);g.b.spawn=100;g.s.player=actor(POINTS.machine);
   const c=guest(g,0);g.b.customers=[c];g.s.player.cups=[{kind:'espresso',quality:0,born:0}];
   Object.assign(g.s.player,actor(g.servicePoint(0)));g.s.player.cups=[{kind:'espresso',quality:0,born:0}];
   g.step(1/30);
   return c.timer;
  };
  expect(sitTime(3)).toBeGreaterThan(sitTime(0)*1.5);
 });

 it('does not call a filling café crowded once the player enlarged the room',()=>{
  const cramped=cafe(0,6,0),roomy=cafe(3,6,2);
  const fill=(g:Simulation,n:number)=>{g.b.spawn=100;g.b.customers=g.seatIds.slice(0,n).map(seat=>guest(g,seat,'drinking'));return g.crowding;};
  expect(fill(roomy,12)).toBeLessThan(fill(cramped,12));
  expect(fill(roomy,60)).toBeGreaterThan(fill(roomy,12));
 });
});
