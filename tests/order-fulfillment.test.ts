import {describe,it,expect} from 'vitest';
import {actor,Simulation,type Customer} from '../src/game/sim';
import {POINTS} from '../src/game/config';
import {nextAction} from '../src/game/guide';
const step=(g:Simulation,s:number)=>{for(let i=0;i<s*30;i++)g.step(1/30);};
function guest(g:Simulation,id:number,kind:'espresso'|'latte',seat:number):Customer{return {...actor(g.seatPoint(seat)),id,kind,seat,state:'waiting',patience:27,maxPatience:27,timer:0,paid:false,tint:0};}
function office(){const g=new Simulation();g.s.coins=10000;g.b.mastery=1;expect(g.switchBranch(1)).toBe(true);g.b.spawn=100;g.b.menu='latte';g.s.player=actor({x:0,z:5});return g;}
describe('order quantities and physical tray recovery',()=>{
 it('serves available lattes before patience expires even when the waiter carries old espresso',()=>{
  const g=office();g.hire('waiter');g.b.workers.waiter=actor(POINTS.machine);g.b.workers.waiter.cups=[{kind:'espresso',quality:2,born:0},{kind:'espresso',quality:1,born:0}];
  g.b.ready=[{kind:'latte',quality:0,born:0},{kind:'latte',quality:0,born:0}];g.b.customers=[guest(g,1,'latte',0),guest(g,2,'latte',1)];step(g,20);
  expect(g.b.served).toBe(2);expect(g.b.lost).toBe(0);expect(g.b.ready.filter(c=>c.kind==='espresso')).toEqual(expect.arrayContaining([{kind:'espresso',quality:2,born:0},{kind:'espresso',quality:1,born:0}]));
 });
 it('counts each available cup once and brews the missing second espresso',()=>{
  const g=office();g.s.player=actor(POINTS.machine);g.b.customers=[guest(g,1,'espresso',0),guest(g,2,'espresso',1),{...guest(g,3,'latte',0),seat:-1,state:'queue'}];g.b.ready=[{kind:'espresso',quality:0,born:0},{kind:'latte',quality:0,born:0}];g.step(1/30);expect(g.b.brewing).toBe('espresso');
 });
 it('guides a player with wrong products back to exchange, preserving their age and quality',()=>{
  const g=office();g.s.coins=0;g.b.customers=[guest(g,1,'latte',0)];g.s.player.cups=[{kind:'espresso',quality:2,born:0},{kind:'espresso',quality:0,born:0}];g.b.ready=[{kind:'latte',quality:0,born:0}];
  const a=nextAction(g);expect(a.id).toBe('return-tray');expect(a.target).toEqual(POINTS.machine);g.go(a.target!);step(g,7);
  expect(g.s.player.cups.some(c=>c.kind==='latte')).toBe(true);expect(g.b.ready.filter(c=>c.kind==='espresso')).toHaveLength(2);expect(g.b.ready.every(c=>c.born===0)).toBe(true);expect(g.b.waste).toBe(0);
 });
 it('can swap a wrong tray against a matching product even when the shelf is full',()=>{
  const g=office();g.s.player=actor(POINTS.machine);g.s.player.cups=[{kind:'espresso',quality:2,born:0},{kind:'espresso',quality:1,born:0}];g.b.stock=0;g.b.customers=[guest(g,1,'latte',0)];g.b.ready=Array.from({length:5},()=>({kind:'latte' as const,quality:0,born:0}));g.step(1/30);
  expect(g.s.player.cups.some(c=>c.kind==='latte')).toBe(true);expect(g.b.ready.length).toBe(5);expect([...g.b.ready,...g.s.player.cups]).toHaveLength(7);expect(g.b.waste).toBe(0);
 });
 it('continues an in-flight espresso after the menu changes',()=>{
  const g=new Simulation();g.b.spawn=100;g.b.customers=[guest(g,1,'espresso',0)];g.s.player=actor(POINTS.machine);step(g,1);expect(g.b.brew).toBeGreaterThan(0);g.setMenu('latte');const stock=g.b.stock;step(g,2);expect([...g.s.player.cups,...g.b.ready].some(c=>c.kind==='espresso')).toBe(true);expect(g.b.stock).toBe(stock-1);
 });
});

describe('production waits for an actual seated order',()=>{
 it('does not brew while a guest is walking in, then starts after seating',()=>{
  const g=new Simulation();g.b.spawn=100;g.s.player=actor(POINTS.machine);const c=guest(g,1,'espresso',0);Object.assign(c,actor(POINTS.entry));c.state='walking';c.path=g.route(c,g.seatApproach(0),0);g.b.customers=[c];const stock=g.b.stock;
  step(g,2);expect(c.state).toBe('walking');expect(g.b.brew).toBe(0);expect(g.b.stock).toBe(stock);expect(g.b.ready).toHaveLength(0);
  step(g,10);expect(c.state).toBe('waiting');expect(g.b.stock).toBe(stock-1);expect([...g.s.player.cups,...g.b.ready]).toHaveLength(1);
 });
 it('stops an unfinished recipe when the only ordering guest leaves, without consuming ingredients',()=>{
  const g=new Simulation();g.b.spawn=100;g.s.player=actor(POINTS.machine);const c=guest(g,1,'espresso',0);c.patience=.5;g.b.customers=[c];const stock=g.b.stock;
  step(g,.2);expect(g.b.brew).toBeGreaterThan(0);step(g,1);expect(g.b.brew).toBe(0);expect(g.b.stock).toBe(stock);expect(g.b.ready).toHaveLength(0);expect(g.s.player.cups).toHaveLength(0);expect(g.b.lost).toBe(1);
 });
});
