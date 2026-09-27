import {describe,it,expect} from 'vitest';
import {Simulation,newBranch} from '../src/game/sim';
import {nextAction} from '../src/game/guide';
import {BRANCHES,MENU,ROLES,TAKEAWAY,TUNING,UPGRADES,type Menu,type Upgrade} from '../src/game/config';
import {DIAMOND_COSTS} from '../src/game/diamonds';
import {staffLimit} from '../src/game/venue';
import {validateSave} from '../src/game/save';

describe('larger stars fund a growing café without requiring ads',()=>{
 it('pays every permanent star once and retains claimed stars on reload',()=>{
  for(let branch=0;branch<3;branch++){
   let g=new Simulation();g.s.active=branch;g.s.branches[branch]=newBranch();
   g.b.served=250;g.b.signatureServed=100;g.b.rating=4.5;g.b.level.table=6;
   g.b.staff.barista=2;g.b.staff.waiter=2;g.b.staff.supplier=1;
   const earned=[];
   for(const reward of [1000,4000,12000]){
    const before=g.s.coins;expect(g.mastery()[g.b.mastery].reward).toBe(reward);
    expect(g.claimMastery()).toBe(true);earned.push(g.s.coins-before);
    g=new Simulation(structuredClone(g.s));expect(g.b.mastery).toBe(earned.length);
   }
   expect(earned).toEqual([1000,4000,12000]);expect(g.s.coins).toBe(17020);
   expect(g.claimMastery()).toBe(false);expect(g.s.coins).toBe(17020);
  }
 });
 it('keeps the second table, core team, first star and next branch reachable through real no-ad service',()=>{
  const g=new Simulation();expect(g.s.coins).toBe(20);
  let tableAt=Infinity,starAt=Infinity,branchAt=Infinity,starIncome=0;
  for(let frame=0;frame<18000;frame++){
   if(frame%2===0){
    if(g.mastery()[g.b.mastery]?.ready){const before=g.s.coins;expect(g.claimMastery()).toBe(true);starIncome+=g.s.coins-before;starAt=frame/10;}
    if(g.b.mastery>=1&&g.autoReady&&g.s.coins>=BRANCHES[1].cost){expect(g.switchBranch(1)).toBe(true);branchAt=frame/10;break;}
    const action=nextAction(g);
    if(!action.waiting){
     if(action.buy){const before=g.s.coins,price=g.price(action.buy);expect(g.upgrade(action.buy)).toBe(true);expect(g.s.coins).toBe(before-price);tableAt=frame/10;}
     else if(action.hire){const before=g.s.coins,price=g.staffPrice(action.hire);expect(g.hire(action.hire)).toBe(true);expect(g.s.coins).toBe(before-price);}
     else if(action.target)g.go(action.target);
    }
   }
   g.step(.1);expect(g.s.coins).toBeGreaterThanOrEqual(0);
  }
  expect(tableAt).toBeLessThan(90);expect(starAt).toBeLessThan(600);expect(branchAt).toBeLessThan(1800);
  expect(starIncome).toBe(1000);expect(g.s.active).toBe(1);expect(g.s.totalServed).toBeGreaterThanOrEqual(40);
  expect(ROLES.every(role=>g.s.branches[0].staff[role]===1)).toBe(true);
  expect(g.s.rewardIds).toEqual([]);expect(g.s.boostSeconds).toBe(0);expect(validateSave(g.s)).toBe(true);
 },20000);
 it('raises every entry equipment/staff category while preserving sale economy and higher branch prices',()=>{
  const g=new Simulation();
  const entry:Record<Upgrade,number>={table:90,machine:145,tray:100,quality:195,stock:135,storage:240,wash:315,space:390,soundproof:285,speakers:210,stage:630};
  for(const key of Object.keys(UPGRADES) as Upgrade[])expect(g.price(key),key).toBe(entry[key]);
  expect(ROLES.map(role=>g.staffPrice(role))).toEqual([270,360,315,420,480]);
  expect(TAKEAWAY.cost).toBe(1350);expect(TUNING.startingCoins).toBe(20);
  expect(Object.values(MENU).map(item=>item.price)).toEqual([18,29,42,22,36,28,49]);
  expect(BRANCHES.map(branch=>branch.cost)).toEqual([0,4500,18000]);
  expect(g.branchUnlocked(1)).toBe(false);g.b.mastery=1;expect(g.branchUnlocked(1)).toBe(true);
  expect(DIAMOND_COSTS.furniture).toEqual([40,180,500]);
 });
 it('charges successively larger positive integer gold prices across every equipment, staff, helper and recipe tier',()=>{
  const g=new Simulation();g.s.coins=1e8;g.b.level.space=2;
  for(const key of Object.keys(UPGRADES) as Upgrade[]){
   const base=key==='table'||key==='machine'?1:key==='tray'?2:0;g.b.level[key]=base;
   let previous=0;
   while(g.b.level[key]<UPGRADES[key].max){const price=g.price(key),before=g.s.coins;expect(price,key).toBeGreaterThan(previous);expect(price%5).toBe(0);expect(g.upgrade(key),key).toBe(true);expect(g.s.coins).toBe(before-price);previous=price;}
  }
  for(const role of ROLES){
   let previous=0;
   while(g.b.staff[role]<3){const price=g.staffPrice(role),before=g.s.coins;expect(price).toBeGreaterThan(previous);expect(g.hire(role)).toBe(true);expect(g.s.coins).toBe(before-price);previous=price;}
   previous=0;
   while(g.staffCount(role)<staffLimit(role)){const price=g.additionalStaffPrice(role),before=g.s.coins;expect(price).toBeGreaterThan(previous);expect(price%5).toBe(0);expect(g.hireMore(role)).toBe(true);expect(g.s.coins).toBe(before-price);previous=price;}
  }
  for(const kind of Object.keys(MENU) as Menu[]){
   let previous=0;
   while(g.b.catalog[kind]<3){const price=g.recipeUpgradeCost(kind),before=g.s.coins;expect(price,kind).toBeGreaterThan(previous);expect(price%5).toBe(0);expect(g.upgradeRecipe(kind)).toBe(true);expect(g.s.coins).toBe(before-price);previous=price;}
  }
 });
});
