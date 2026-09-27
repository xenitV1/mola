import {describe,it,expect} from 'vitest';
import {Simulation,actor,type Customer} from '../src/game/sim';
import {MENU,type Menu,type Upgrade,type Role} from '../src/game/config';
import type {DecorId} from '../src/game/decor';
import {buyWithDiamonds,canBuyWithDiamonds,creditDiamonds,diamondBalance,diamondPrice,DIAMOND_MAX_GRANTS,DIAMOND_MAX_BALANCE,DIAMOND_COSTS,type Purchase} from '../src/game/diamonds';
import {load,persist,validateSave,type StorageLike} from '../src/game/save';
const grant=(n:number)=>'diamonds:'+n.toString(16).padStart(64,'0');
function funded(){const g=new Simulation();g.s.coins=500000;g.s.diamonds={balance:100000,grants:[]};return g;}
const storage=():StorageLike=>{const values=new Map<string,string>();return {getItem:k=>values.get(k)??null,setItem:(k,v)=>{values.set(k,v);},removeItem:k=>{values.delete(k);}};};
const goldBuy=(g:Simulation,p:Purchase)=>p.kind==='table-type'?g.upgradeTable(Number(p.id)):p.kind==='staff'?g.hire(p.id as Role):p.kind==='helper'?g.hireMore(p.id as Role):p.kind==='recipe'?g.upgradeRecipe(p.id as Menu):p.kind==='decor'?g.decorate(p.id as DecorId):g.upgrade(p.id as Upgrade);
describe('diamond alternatives use the same real café investments',()=>{
 it('offers every additional staff slot for diamonds, preserves gold, and stops at the role limit',()=>{
  for(const role of ['barista','waiter','supplier','cleaner','dishwasher'] as Role[]){
   const g=funded();expect(g.hire(role)).toBe(true);const gold=g.s.coins;
   while(g.staffCount(role)<g.staffLimit(role)){
    const p:Purchase={kind:'helper',id:role},price=diamondPrice(g,p),before=diamondBalance(g),count=g.staffCount(role);
    expect(price).toBeGreaterThan(0);expect(buyWithDiamonds(g,p)).toBe(true);
    expect(g.staffCount(role)).toBe(count+1);expect(diamondBalance(g)).toBe(before-price!);expect(g.s.coins).toBe(gold);
   }
   const before=diamondBalance(g);expect(buyWithDiamonds(g,{kind:'helper',id:role})).toBe(false);expect(diamondBalance(g)).toBe(before);expect(validateSave(g.s)).toBe(true);
  }
 });
 it('caps the top furniture purchase at 500 and supplies prices for every paid decoration',()=>{
  const g=funded();g.upgrade('space');g.upgrade('space');g.upgradeTable(0);g.upgradeTable(0);
  expect(diamondPrice(g,{kind:'table-type',id:'0'})).toBe(500);g.s.diamonds!.balance=499;
  expect(buyWithDiamonds(g,{kind:'table-type',id:'0'})).toBe(false);expect(diamondBalance(g)).toBe(499);
  g.s.diamonds!.balance=500;expect(buyWithDiamonds(g,{kind:'table-type',id:'0'})).toBe(true);expect(diamondBalance(g)).toBe(0);expect(g.tableCapacity(0)).toBe(10);
  const costs=Object.values(DIAMOND_COSTS).flatMap(group=>Array.isArray(group)?group:Object.values(group).flat());expect(Math.max(...costs)).toBe(500);
  for(const id of ['oak','simple','terracotta','reading','sideboard','flowers'])expect(diamondPrice(g,{kind:'decor',id})).toBeGreaterThan(0);
 });
 it.each<Purchase>([{kind:'upgrade',id:'machine'},{kind:'table-type',id:'0'},{kind:'recipe',id:'iced'},{kind:'staff',id:'barista'},{kind:'helper',id:'waiter'},{kind:'decor',id:'tile'}])('matches gold behavior for $kind/$id without adding or spending gold',p=>{
  const g=funded();if(p.kind==='helper')g.hire('waiter');const gold=new Simulation(structuredClone(g.s)),coins=g.s.coins,balance=diamondBalance(g),price=diamondPrice(g,p)!;
  expect(price).toBeGreaterThan(0);expect(canBuyWithDiamonds(g,p)).toBe(true);expect(buyWithDiamonds(g,p)).toBe(true);expect(goldBuy(gold,p)).toBe(true);expect(g.b).toEqual(gold.b);expect(g.s.player).toEqual(gold.s.player);expect(g.s.coins).toBe(coins);expect(diamondBalance(g)).toBe(balance-price);expect(validateSave(g.s)).toBe(true);
 });
 it('never bypasses physical floor prerequisites, even with ample diamonds',()=>{
  const g=funded();g.upgrade('table');const wallet=diamondBalance(g);expect(buyWithDiamonds(g,{kind:'upgrade',id:'table'})).toBe(false);expect(diamondBalance(g)).toBe(wallet);
  expect(buyWithDiamonds(g,{kind:'table-type',id:'0'})).toBe(true);const after=diamondBalance(g);expect(diamondPrice(g,{kind:'table-type',id:'0'})).toBe(180);expect(buyWithDiamonds(g,{kind:'table-type',id:'0'})).toBe(false);expect(g.b.tableLevels[0]).toBe(1);expect(diamondBalance(g)).toBe(after);
  expect(buyWithDiamonds(g,{kind:'upgrade',id:'space'})).toBe(true);expect(buyWithDiamonds(g,{kind:'table-type',id:'0'})).toBe(true);
 });
 it('refuses maxed, already-owned, missing lead staff and malformed purchases without touching either wallet',()=>{
  const g=funded();g.b.level.machine=5;const coins=g.s.coins,balance=diamondBalance(g);
  for(const p of [{kind:'upgrade',id:'machine'},{kind:'decor',id:'concrete'},{kind:'helper',id:'waiter'},{kind:'table-type',id:'5'},{kind:'table-type',id:'-1'},{kind:'table-type',id:'1.0'},{kind:'recipe',id:'__proto__'},{kind:'branch',id:'1'}] as Purchase[])expect(buyWithDiamonds(g,p)).toBe(false);
  expect(g.s.coins).toBe(coins);expect(diamondBalance(g)).toBe(balance);expect(g.b.helpers).toHaveLength(0);
 });
 it('charges only the explicitly chosen currency and requires its complete balance',()=>{
  const g=funded();g.s.diamonds!.balance=4;expect(g.upgrade('machine','diamonds')).toBe(false);expect(g.b.level.machine).toBe(1);expect(g.s.coins).toBe(500000);g.s.coins=0;g.s.diamonds!.balance=100;expect(g.upgrade('machine')).toBe(false);expect(diamondBalance(g)).toBe(100);expect(buyWithDiamonds(g,{kind:'upgrade',id:'machine'})).toBe(true);expect(diamondBalance(g)).toBe(95);
 });
 it('preserves pending customer quotes while a diamond recipe investment changes later sales',()=>{
  const g=funded(),guest:Customer={...actor(g.seatPoint(0)),id:1,seat:0,state:'waiting',kind:'latte',patience:40,maxPatience:44,timer:0,paid:false,tint:0,quotedPrice:g.recipePrice('latte')};g.b.customers=[guest];expect(buyWithDiamonds(g,{kind:'recipe',id:'latte'})).toBe(true);expect(guest.quotedPrice).toBe(MENU.latte.price);expect(g.recipePrice('latte')).toBeGreaterThan(guest.quotedPrice!);
 });
 it('does not give diamonds to an older v7 save and preserves its ordinary gold progression',()=>{
  const old=new Simulation().s;delete old.diamonds;expect(validateSave(old)).toBe(true);const g=new Simulation(structuredClone(old));expect(diamondBalance(g)).toBe(0);expect(g.s.diamonds?.grants).toEqual([]);g.s.coins=g.price('table');expect(g.upgrade('table')).toBe(true);expect(g.s.coins).toBe(0);expect(diamondBalance(g)).toBe(0);
 });
});
describe('durable diamond purchase grants',()=>{
 it('commits verified supported packs before recording success and never grants a replay twice across reload',()=>{
  const g=new Simulation(),disk=storage();let total=0;
  for(const [i,amount] of [100,500,5000,10000].entries()){expect(creditDiamonds(g,grant(i),amount,()=>persist(g.s,disk))).toBe('credited');total+=amount;}
  const restored=new Simulation(load(disk).save);expect(diamondBalance(restored)).toBe(total);expect(creditDiamonds(restored,grant(2),5000,()=>persist(restored.s,disk))).toBe('recorded');expect(diamondBalance(restored)).toBe(total);expect(restored.s.diamonds!.grants).toHaveLength(4);expect(restored.s.coins).toBe(20);
 });
 it('rolls back the wallet on a failed or throwing durable commit and allows the native purchase retry',()=>{
  const g=new Simulation();delete g.s.diamonds;expect(creditDiamonds(g,grant(1),100,()=>false)).toBe('save-failed');expect(g.s.diamonds).toBeUndefined();expect(creditDiamonds(g,grant(1),100,()=>{throw new Error('full disk');})).toBe('save-failed');expect(diamondBalance(g)).toBe(0);expect(creditDiamonds(g,grant(1),100,()=>true)).toBe('credited');expect(diamondBalance(g)).toBe(100);
 });
 it('rejects invented amounts and malformed grant identifiers without committing',()=>{
  const g=new Simulation();let commits=0;for(const [id,amount] of [['fake',100],[grant(1),300000],[grant(2),-100],[grant(3),100.5]] as const)expect(creditDiamonds(g,id,amount,()=>{commits++;return true;})).toBe('invalid');expect(commits).toBe(0);expect(diamondBalance(g)).toBe(0);
 });
 it('keeps all ten thousand grant identifiers durable instead of deleting old replay protection',()=>{
  const g=new Simulation(),disk=storage();g.s.diamonds={balance:1000000,grants:Array.from({length:DIAMOND_MAX_GRANTS},(_,i)=>grant(i))};expect(validateSave(g.s)).toBe(true);expect(persist(g.s,disk)).toBe(true);const restored=new Simulation(load(disk).save);expect(restored.s.diamonds!.grants).toHaveLength(DIAMOND_MAX_GRANTS);
  expect(creditDiamonds(restored,grant(DIAMOND_MAX_GRANTS),100,()=>true)).toBe('full');expect(creditDiamonds(restored,grant(0),100,()=>true)).toBe('recorded');expect(diamondBalance(restored)).toBe(1000000);expect(restored.s.diamonds!.grants[0]).toBe(grant(0));
 });
 it('rejects invalid wallets and refuses overflow without a partial credit',()=>{
  for(const wallet of [{balance:-1,grants:[]},{balance:1.5,grants:[]},{balance:1,grants:['fake']},{balance:1,grants:[grant(1),grant(1)]},{balance:Infinity,grants:[]}]){const g=new Simulation();g.s.diamonds=wallet;expect(validateSave(g.s)).toBe(false);}
  const g=new Simulation();g.s.diamonds={balance:DIAMOND_MAX_BALANCE,grants:[]};expect(creditDiamonds(g,grant(1),100,()=>true)).toBe('full');expect(diamondBalance(g)).toBe(DIAMOND_MAX_BALANCE);expect(g.s.diamonds.grants).toEqual([]);
 });
});
