import type {Simulation} from './sim';
import {MENU,STAFF,UPGRADES,type Menu,type Role,type Upgrade} from './config';
import {DECOR,type DecorId} from './decor';
export type Purchase={kind:'upgrade'|'staff'|'helper'|'recipe'|'decor'|'table-type';id:string};
export type Currency='gold'|'diamonds';
export type DiamondState={balance:number;grants:string[]};
export const DIAMOND_MAX_GRANTS=10000,DIAMOND_MAX_BALANCE=100000000;
export const DIAMOND_GRANT_ID=/^diamonds:[a-f0-9]{64}$/;
export const DIAMOND_PACK_AMOUNTS=[100,500,5000,10000] as const;
export const DIAMOND_MAX_ITEM_PRICE=500;
export const freshDiamonds=():DiamondState=>({balance:0,grants:[]});
export const diamondBalance=(g:Simulation)=>g.s.diamonds?.balance??0;
// Explicit next-purchase prices: arrays advance with the same levels as gold.
export const DIAMOND_COSTS={
 furniture:[40,180,500],
 upgrades:{table:[4,7,12,23,41],space:[13,36],machine:[5,9,41,121],tray:[5,15,43],quality:[7,13,65],stock:[5,9,37,105],storage:[8,16,80],wash:[11,20,95],speakers:[7],stage:[21],soundproof:[10,19,86]} as Record<Upgrade,readonly number[]>,
 staff:{barista:[9,17,77],waiter:[12,23,103],supplier:[11,20,90],cleaner:[14,26,120],dishwasher:[16,30,137]} as Record<Role,readonly number[]>,
 helpers:{barista:[15],waiter:[20,33],supplier:[18],cleaner:[24,40],dishwasher:[27]} as Record<Role,readonly number[]>,
 recipes:{espresso:[5,7,37],latte:[5,9,46],cake:[5,11,56],tea:[9,8,40],iced:[16,10,51],lemonade:[23,9,45],cheesecake:[33,12,62]} as Record<Menu,readonly number[]>,
 decor:{concrete:0,oak:7,tile:11,terracotta:25,classic:0,cushions:9,reading:16,sideboard:29,none:0,simple:5,lush:10,flowers:22} as Record<DecorId,number>,
} as const;
export function diamondPrice(g:Simulation,p:Purchase):number|null{
 if(!p||typeof p.id!=='string')return null;
 let price:number|undefined;
 if(p.kind==='table-type'){
  if(!/^[0-5]$/.test(p.id))return null;const i=Number(p.id);if(i>=g.b.level.table)return null;price=DIAMOND_COSTS.furniture[g.b.tableLevels[i]];
 }else if(p.kind==='upgrade'){
  if(!Object.hasOwn(UPGRADES,p.id))return null;const k=p.id as Upgrade,base=k==='table'||k==='machine'?1:k==='tray'?2:0;price=DIAMOND_COSTS.upgrades[k][g.b.level[k]-base];
 }else if(p.kind==='staff'||p.kind==='helper'){
  if(!Object.hasOwn(STAFF,p.id))return null;const role=p.id as Role;price=p.kind==='staff'?DIAMOND_COSTS.staff[role][g.b.staff[role]]:DIAMOND_COSTS.helpers[role][g.staffCount(role)-1];
 }else if(p.kind==='recipe'){
  if(!Object.hasOwn(MENU,p.id))return null;const kind=p.id as Menu;price=DIAMOND_COSTS.recipes[kind][g.b.catalog[kind]];
 }else if(p.kind==='decor'){
  if(!Object.hasOwn(DECOR,p.id)||g.b.decor.owned.includes(p.id as DecorId))return null;price=DIAMOND_COSTS.decor[p.id as DecorId];
 }
 return typeof price==='number'&&Number.isInteger(price)&&price>0?Math.min(DIAMOND_MAX_ITEM_PRICE,price):null;
}
export function canBuyWithDiamonds(g:Simulation,p:Purchase){
 const price=diamondPrice(g,p);if(price===null||diamondBalance(g)<price)return false;
 if(p.kind==='table-type')return g.canUpgradeTable(Number(p.id));
 if(p.kind==='upgrade'){const k=p.id as Upgrade;return g.b.level[k]<g.upgradeCap(k);}
 if(p.kind==='helper'){const k=p.id as Role;return g.b.staff[k]>0&&g.staffCount(k)<g.staffLimit(k);}
 if(p.kind==='staff')return g.b.staff[p.id as Role]<3;
 if(p.kind==='recipe')return g.b.catalog[p.id as Menu]<3;
 return p.kind==='decor'&&!g.b.decor.owned.includes(p.id as DecorId);
}
export function buyWithDiamonds(g:Simulation,p:Purchase){
 if(!canBuyWithDiamonds(g,p))return false;
 if(p.kind==='table-type')return g.upgradeTable(Number(p.id),'diamonds');
 if(p.kind==='upgrade')return g.upgrade(p.id as Upgrade,'diamonds');
 if(p.kind==='staff')return g.hire(p.id as Role,'diamonds');
 if(p.kind==='helper')return g.hireMore(p.id as Role,'diamonds');
 if(p.kind==='recipe')return g.upgradeRecipe(p.id as Menu,'diamonds');
 return g.decorate(p.id as DecorId,'diamonds');
}
export type DiamondCreditResult='credited'|'recorded'|'invalid'|'save-failed'|'full';
/** Call only with the verified native purchase result. The host consumes the
 * Play purchase only AFTER this synchronous durable commit has succeeded. */
export function creditDiamonds(g:Simulation,id:string,amount:number,commit:()=>boolean):DiamondCreditResult{
 if(typeof id!=='string'||!DIAMOND_GRANT_ID.test(id)||!(DIAMOND_PACK_AMOUNTS as readonly number[]).includes(amount))return 'invalid';
 const before=g.s.diamonds,wallet=before??freshDiamonds();
 if(wallet.grants.includes(id)){try{return commit()?'recorded':'save-failed';}catch{return 'save-failed';}}
 if(wallet.grants.length>=DIAMOND_MAX_GRANTS||wallet.balance+amount>DIAMOND_MAX_BALANCE)return 'full';
 g.s.diamonds={balance:wallet.balance+amount,grants:[...wallet.grants,id]};
 try{if(commit())return 'credited';}catch{/* Restore the uncommitted wallet; native purchase remains pending. */}
 if(before)g.s.diamonds=before;else delete g.s.diamonds;return 'save-failed';
}
