import {describe,it,expect} from 'vitest';
import {Simulation,actor} from '../src/game/sim';
import {basicGuideComplete,nextAction,teaching,type Guide} from '../src/game/guide';
import {POINTS} from '../src/game/config';
import {translations} from '../src/game/i18n';
import {validateSave} from '../src/game/save';
import {dirtSeconds} from '../src/game/cleanliness';

function tick(g:Simulation,seconds:number){for(let i=0;i<seconds*30;i++)g.step(1/30);}
function follow(g:Simulation,a:Guide){if(a.waiting)return;if(a.buy)g.upgrade(a.buy);else if(a.hire)g.hire(a.hire);else if(a.target)g.go(a.target);}
describe('first-play guidance follows real café state',()=>{
 it('marks the opening quest complete from durable service and table progress',()=>{
  const g=new Simulation();g.s.totalServed=3;g.s.coins=1000;expect(basicGuideComplete(g)).toBe(false);
  expect(g.upgrade('table')).toBe(true);expect(basicGuideComplete(g)).toBe(true);
  const restored=new Simulation(structuredClone(g.s));expect(basicGuideComplete(restored)).toBe(true);
 });

 it('shows freeplay after a mature chain while keeping direct service guidance first',()=>{
  const g=new Simulation();g.s.totalServed=3;g.s.coins=1000;g.upgrade('table');
  for(const role of ['barista','waiter','supplier','cleaner','dishwasher'] as const)g.hire(role);
  for(const index of [1,2])g.s.branches[index]={...structuredClone(g.s.branches[0])};
  for(const branch of Object.values(g.s.branches))branch.mastery=3;
  expect(g.chainComplete).toBe(true);expect(nextAction(g).id).toBe('freeplay');
  g.b.spawn=100;g.b.customers=[{...actor(g.seatPoint(0)),id:7,seat:0,state:'waiting',kind:'espresso',patience:70,maxPatience:70,timer:0,paid:false,tint:0}];g.s.player.cups=[{kind:'espresso',quality:0,born:g.b.time}];
  expect(nextAction(g).id).toBe('serve');
 });

 it('reaches a paid second table using only suggested actions, without gifts or ads',()=>{
  const g=new Simulation(),seen=new Set<string>();let purchases=0;
  for(let i=0;i<900&&g.b.level.table===1;i++){
   const a=nextAction(g);seen.add(a.id);
   for(const key of [a.title,a.detail,a.button])expect(translations[key],key).toBeTruthy();
   if(a.buy){expect(g.s.coins).toBeGreaterThanOrEqual(a.price!);purchases++;}
   follow(g,a);tick(g,.1);
  }
  expect(g.b.level.table).toBe(2);expect(purchases).toBe(1);expect(g.b.earned).toBeGreaterThanOrEqual(36);
  expect(g.s.totalServed).toBeGreaterThanOrEqual(3);expect(g.s.rewardIds).toHaveLength(0);expect(g.b.lost).toBe(0);
  for(const stage of ['welcome-guest','brewing','serve','first-table'])expect(seen.has(stage),stage).toBe(true);
  expect(seen.has('collect')).toBe(false);expect(seen.has('first-payment')).toBe(false);expect(teaching(g)).toBe(false);expect(validateSave(g.s)).toBe(true);
 });
 it('offers free stock recovery and ready cups before unnecessary supply trips',()=>{
  const g=new Simulation();g.b.stock=0;expect(nextAction(g).id).toBe('get-beans');g.s.player=actor(POINTS.supply);tick(g,2);
  expect(nextAction(g).id).toBe('deliver-beans');follow(g,nextAction(g));tick(g,6);expect(g.b.stock).toBeGreaterThan(0);
  g.b.stock=0;g.s.player.cups=[];g.b.ready=[{kind:'espresso',quality:0,born:g.b.time}];expect(nextAction(g).id).toBe('brew');
 });
 it('keeps guidance useful when loading an existing save halfway through a delivery',()=>{
  const g=new Simulation();tick(g,12);g.s.player.cups=[{kind:'espresso',quality:0,born:12}];
  const restored=new Simulation(structuredClone(g.s));expect(nextAction(restored).id).toBe('serve');expect(restored.s.totalServed).toBe(0);
 });
 it('protects initial practice without removing experienced business pressure',()=>{
  const beginner=new Simulation();tick(beginner,60);expect(beginner.b.customers).toHaveLength(2);expect(beginner.b.lost).toBe(0);expect(beginner.b.customers.every(c=>c.maxPatience===70)).toBe(true);
  const experienced=new Simulation();experienced.s.totalServed=3;tick(experienced,110);expect(experienced.b.lost).toBeGreaterThan(0);expect(experienced.b.losses.seat+experienced.b.losses.service).toBeGreaterThan(0);
 });
 it('introduces each real staff role and switches to management after hiring',()=>{
  const g=new Simulation();g.s.coins=2000;g.upgrade('table');
  for(const role of ['barista','waiter','supplier','cleaner','dishwasher'] as const){const a=nextAction(g);expect(a.hire).toBe(role);for(const key of [a.title,a.detail,a.button])expect(translations[key],key).toBeTruthy();const before=g.s.coins;follow(g,a);expect(g.b.workers[role]).toBeTruthy();expect(g.s.coins).toBe(before-a.price!);}
  expect(nextAction(g).id).toBe('choose-contract');
 });
 it('takes a fully staffed café to the relevant bottleneck controls',()=>{
  const g=new Simulation();g.s.coins=5000;g.upgrade('table');g.hire('barista');g.hire('waiter');g.hire('supplier');g.hire('cleaner');g.hire('dishwasher');g.s.coins=0;g.b.stock=12;
  const action=nextAction(g);expect(action.id).toBe('choose-contract');expect(action.panel).toBeTruthy();
 });
 it('guides the player to a dirt patch, reports progress, and returns to normal flow after cleaning',()=>{
  const g=new Simulation();g.s.totalServed=3;g.cleanliness.patches.push({id:++g.cleanliness.serial,x:7,z:2.8,zone:'floor',kind:'spill',work:0});
  const patch=g.cleanliness.patches[0];const beforeDishes=g.b.cleanDishes;const first=nextAction(g);
  expect(first.id).toBe(`clean-dirt-${patch.id}`);expect(first.target?.x).toBe(7);expect(first.target?.z).toBe(2.8);expect(first.progress).toBeUndefined();
  g.go(first.target!);let working:Guide|undefined;for(let i=0;i<300&&g.cleanliness.patches.includes(patch);i++){g.step(1/30);const candidate=nextAction(g);if(candidate.waiting){working=candidate;break;}}
  expect(working?.id).toBe(`clean-dirt-${patch.id}`);expect(working?.waiting).toBe(true);expect(working?.progress).toBeGreaterThan(0);expect(working?.progress).toBeLessThan(1);const stableCoins=g.s.coins;
  for(let i=0;i<120;i++)g.step(1/30);expect(g.cleanliness.patches).toHaveLength(0);expect(g.s.coins).toBe(stableCoins);expect(g.b.cleanDishes).toBe(beforeDishes);expect(nextAction(g).id).not.toBe(`clean-dirt-${patch.id}`);expect(validateSave(g.s)).toBe(true);expect(dirtSeconds(patch)).toBe(2);
 });
 it('uses zone-specific copy and preserves an active dirt walk when an order arrives',()=>{
  const copy=new Simulation();copy.s.totalServed=3;copy.cleanliness.patches.push({id:++copy.cleanliness.serial,x:8,z:7,zone:'front',kind:'litter',work:0});const first=nextAction(copy);
  expect(first.title).toBe('Dükkân önünü temizle');expect(first.button).toBe('Dükkân önünü temizle');expect(translations[first.title]).toBe('Clean the shop front');expect(translations[first.button]).toBe('Clean the shop front');
  const g=new Simulation();g.s.totalServed=3;g.s.coins=1000;g.upgrade('space');g.s.coins=0;g.b.spawn=0;tick(g,12);const patch={id:++g.cleanliness.serial,x:0,z:14,zone:'front' as const,kind:'litter' as const,work:0};g.cleanliness.patches.push(patch);g.go(patch);expect(g.pendingOrders.length).toBeGreaterThan(0);expect(g.s.player.path.at(-1)?.z).toBeCloseTo(14,1);const duringWalk=nextAction(g);expect(duringWalk.id).toBe(`clean-dirt-${patch.id}`);expect(duringWalk.target?.z).toBe(14);
 });
 it.each([
  ['first-three-services',(g:Simulation)=>{g.s.totalServed=0}],
  ['cleaner-employed',(g:Simulation)=>{g.s.totalServed=3;g.s.coins=1000;expect(g.hire('cleaner')).toBe(true);expect(g.b.staff.cleaner).toBe(1);g.s.coins=0}],
  ['beans-in-hand',(g:Simulation)=>{g.s.totalServed=3;g.s.player.beans=1}],
  ['stock-empty',(g:Simulation)=>{g.s.totalServed=3;g.b.stock=0}],
  ['ready-on-counter',(g:Simulation)=>{g.s.totalServed=3;g.b.ready=[{kind:'espresso',quality:0,born:0}]}],
  ['dirty-dishes',(g:Simulation)=>{g.s.totalServed=3;g.b.dirtyDishes=1}],
  ['cup-in-hand',(g:Simulation)=>{g.s.totalServed=3;g.s.player.cups=[{kind:'espresso',quality:0,born:0}]}],
 ] as const)('does not start a new floor job for %s',(_,setup)=>{
  const g=new Simulation();setup(g);g.cleanliness.patches.push({id:++g.cleanliness.serial,x:7,z:2.8,zone:'floor',kind:'spill',work:0});
  expect(nextAction(g).id).not.toMatch(/^clean-dirt-/);
 });
});
