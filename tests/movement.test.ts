import {describe,it,expect} from 'vitest';
import * as T from 'three';
import {Simulation,actor,distance,type Customer} from '../src/game/sim';
import {POINTS,TUNING} from '../src/game/config';
import {SEATING,seatFacing} from '../src/game/layout';
import {validateSave} from '../src/game/save';
import type {Person} from '../src/view/models';
import {animatePose,footBottom} from '../src/view/pose';
const advance=(g:Simulation,n:number)=>{for(let i=0;i<n*30;i++)g.step(1/30);};
describe('physical guest and worker movement',()=>{
 it('reaches every chair approach and service station without crossing furniture in every floor layout',()=>{
  const g=new Simulation();g.s.coins=1e6;g.b.mastery=1;expect(g.switchBranch(1)).toBe(true);
  for(let space=0;space<=2;space++){g.b.level.space=space;g.b.level.table=2+space*2;
   const destinations=[POINTS.machine,POINTS.supply,POINTS.wash,{x:-1.3,z:-3.6}];
   for(let seat=0;seat<g.b.level.table*2;seat++)destinations.push(g.seatApproach(seat),g.servicePoint(seat));
   for(const from of [POINTS.entry,POINTS.machine,POINTS.supply])for(const to of destinations){if(distance(from,to)<.01)continue;const route=g.route(from,to);expect(route.at(-1),JSON.stringify({space,from,to,route})).toEqual(to);let previous=from;for(const p of route){expect(g.segmentClear(previous,p),JSON.stringify({space,from,to,previous,p})).toBe(true);previous=p;}}
  }
 });
 it('actually arrives, sits while waiting, stands before leaving and never pays twice',()=>{
  const g=new Simulation();advance(g,15);const c=g.b.customers[0];expect(c.state).toBe('waiting');expect(distance(c,g.seatPoint(c.seat))).toBeLessThan(.001);expect(c.moving).toBe(false);
  g.s.player=actor(g.servicePoint(c.seat));g.s.player.cups=[{kind:c.kind,quality:0,born:g.b.time}];advance(g,1);expect(c.state).toBe('drinking');for(let i=0;i<210&&c.state==='drinking';i++)g.step(1/30);expect(c.state).toBe('standing');expect(g.s.totalServed).toBe(1);expect(validateSave(g.s)).toBe(true);advance(g,1);expect(c.state).toBe('leaving');expect(g.s.totalServed).toBe(1);
 });
 it('does not animate walking when the joystick pushes against a solid counter',()=>{
  const g=new Simulation();g.s.player=actor({x:-1.60,z:-2});g.move={x:-1,z:0};advance(g,1);expect(g.s.player.x).toBe(-1.60);expect(g.s.player.moving).toBe(false);
 });
 it('moves at the configured rate, independently of simulation frame size',()=>{
  for(const dt of [1/30,1/60]){const g=new Simulation();g.s.player=actor({x:-.7,z:1});g.move={x:0,z:-1};for(let i=0;i<1/dt;i++)g.step(dt);expect(distance(g.s.player,{x:-.7,z:1})).toBeCloseTo(TUNING.moveSpeed,5);}
 });
 it('reconciles old seated saves without losing orders, money, or drinking timers',()=>{
  const g=new Simulation();advance(g,15);const c=g.b.customers[0];c.x+=.18;c.state='drinking';c.timer=4;c.action=21;const restored=new Simulation(structuredClone(g.s));expect(restored.b.customers[0].x).toBe(restored.seatPoint(c.seat).x);expect(restored.b.customers[0].timer).toBe(4);expect(restored.s.coins).toBe(g.s.coins+21);expect(restored.b.customers[0].paid).toBe(true);
 });
 it('aligns both sides of all tables, keeps shoes on the ground, and freezes poses when paused',()=>{
  const g=new Simulation(),p:Person={root:new T.Group(),body:new T.Group(),head:new T.Group(),eyes:new T.Group(),legs:[new T.Group(),new T.Group()],knees:[new T.Group(),new T.Group()],arms:[new T.Group(),new T.Group()],tray:new T.Group(),bag:new T.Group(),crate:new T.Group(),cupHolders:[]};
  expect(footBottom(0,0)).toBeCloseTo(SEATING.standingFootBottom,5);
  for(let seat=0;seat<12;seat++)for(const cushions of [false,true]){
   const c:Customer={...actor(g.seatPoint(seat)),id:1,state:'waiting',seat,kind:'espresso',patience:20,maxPatience:40,timer:0,paid:false,tint:0};
   for(let frame=0;frame<30;frame++)animatePose(p,c,'customer',seat*3+frame/30,0,cushions,true,0,c);
   expect(Math.cos(p.root.rotation.y-seatFacing(seat))).toBeCloseTo(1,4);
   expect(p.body.position.y+SEATING.hipHeight-SEATING.thighHalfDepth).toBeCloseTo(cushions?SEATING.cushionTop:SEATING.seatTop,5);
  }
  const a=actor({x:0,z:1});a.moving=true;animatePose(p,a,'player',30,0,false,true,0);a.x=.08;animatePose(p,a,'player',30.033,0,false,true,0);
  const snapshot=JSON.stringify({body:p.body.position.toArray(),leg:p.legs[0].rotation.toArray(),head:p.head.rotation.toArray(),position:p.root.position.toArray()});
  for(let i=0;i<10;i++)animatePose(p,a,'player',30.033,0,false,true,0);
  expect(JSON.stringify({body:p.body.position.toArray(),leg:p.legs[0].rotation.toArray(),head:p.head.rotation.toArray(),position:p.root.position.toArray()})).toBe(snapshot);
 });
});
