import {describe,it,expect} from 'vitest';
import {Simulation,actor,type Customer} from '../src/game/sim';
import {POINTS} from '../src/game/config';
import {translations} from '../src/game/i18n';
function guest(g:Simulation,id:number,seat:number,state:Customer['state']='waiting'):Customer{return {...actor(seat<0?POINTS.entry:g.seatPoint(seat)),id,seat,state,kind:'espresso',patience:44,maxPatience:44,timer:0,paid:false,tint:0};}
function setup(){const g=new Simulation();g.s.coins=10000;g.s.totalServed=10;g.b.spawn=100;g.b.customers=[guest(g,1,0),guest(g,2,1)];return g;}
describe('actionable operating causes',()=>{
 it('does not make legacy table cash block an empty chair',()=>{const g=setup();g.b.cash[0]=21;g.b.customers=[{...guest(g,1,0,'drinking'),timer:10,action:21},guest(g,2,-1,'queue')];const restored=new Simulation(g.s);expect(restored.bottleneck().action).not.toBe('cash');restored.step(.1);expect(restored.b.customers[1].seat).toBe(1);});
 it('recognizes matching coffee being carried even with zero beans',()=>{const g=setup();g.hire('waiter');g.b.workers.waiter!.cups=[{kind:'espresso',born:0,quality:0}];g.b.stock=0;expect(g.bottleneck().action).toBe('waiter');expect(g.bottleneck().panel).toBe('staff');});
 it('distinguishes beans in transit from a dry supply chain',()=>{const g=setup();g.b.stock=0;g.hire('supplier');g.b.workers.supplier!.beans=8;expect(g.bottleneck().action).toBe('delivery');g.b.workers.supplier!.beans=0;expect(g.bottleneck().action).toBe('stock');});
 it('offers free help when the supplier is already fully trained',()=>{const g=setup();g.b.stock=0;g.hire('supplier');g.b.staff.supplier=3;expect(g.bottleneck().target).toEqual(POINTS.supply);});
 it('sends a manually carried order straight to its guest',()=>{const g=setup();g.s.player.cups=[{kind:'espresso',born:0,quality:0}];expect(g.bottleneck().target).toEqual(g.servicePoint(0));});
 it('offers another menu at the maximum table and production levels',()=>{const g=setup();g.b.level.space=2;g.b.level.table=6;g.b.tableLevels.fill(3);g.b.customers=[guest(g,1,-1,'queue'),guest(g,2,-1,'queue')];expect(g.bottleneck().action).toBe('menu');expect(g.bottleneck().panel).toBe('menu');});
 it('identifies missing production and avoids offering a capped machine upgrade',()=>{const g=setup();g.hire('barista');expect(g.bottleneck().action).toBe('machine');expect(g.bottleneck().panel).toBe('upgrade');g.b.level.machine=5;expect(g.bottleneck().panel).toBe('staff');g.b.staff.barista=3;expect(g.bottleneck().panel).toBe('menu');});
 it('does not call lifetime waste a current problem, but observes newly expired cups',()=>{const g=setup();g.b.customers=[];g.b.waste=100;g.b.prep=5;expect(g.bottleneck().action).toBe('grow');g.b.time=40;g.b.ready=Array.from({length:3},()=>({kind:'espresso' as const,born:0,quality:0}));g.step(1/30);expect(g.bottleneck().action).toBe('menu');g.b.time+=121;expect(g.bottleneck().action).toBe('grow');});
 it('does not attribute lost service to empty beans while matching cups are already available',()=>{const g=setup();g.b.stock=0;g.b.customers[0].patience=.01;g.b.ready=[{kind:'espresso',born:0,quality:0}];g.step(1/30);expect(g.b.losses.service).toBe(1);expect(g.b.losses.stock).toBe(0);});
 it('records sustained observed bean shortage as a stock-related loss',()=>{const g=setup();g.b.stock=0;g.b.customers=[guest(g,1,0)];for(let i=0;i<45*30;i++)g.step(1/30);expect(g.b.losses.stock).toBe(1);});
 it('localizes each selected note and action',()=>{const g=setup();const cases=[];cases.push(g.bottleneck());g.b.stock=0;cases.push(g.bottleneck());g.s.player.beans=8;cases.push(g.bottleneck());g.b.stock=14;g.s.player.beans=0;g.b.customers=[];cases.push(g.bottleneck());for(const note of cases)for(const text of [note.title,note.text,note.button])expect(translations[text],text).toBeTruthy();});
});
it('recognizes prepared coffee carried by an additional server before blaming unavailable ingredients',()=>{
 const g=setup();g.hire('waiter');g.hireMore('waiter');g.b.stock=0;g.roleActors('waiter')[1].cups=[{kind:'espresso',quality:0,born:0}];expect(g.bottleneck().action).toBe('waiter');expect(g.bottleneck().panel).toBe('staff');
});
