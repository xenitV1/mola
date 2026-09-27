import {it,expect} from 'vitest';
import {Simulation,actor,type Customer} from '../src/game/sim';
import {MENU,POINTS,ROLES,ROOM,type Menu} from '../src/game/config';
import {load,persist,validateSave,SAVE_KEY} from '../src/game/save';
import {nextAction} from '../src/game/guide';
const advance=(g:Simulation,n:number)=>{for(let i=0;i<n*10;i++)g.step(.1);};
const guest=(g:Simulation,kind:Menu,seat=0):Customer=>({...actor(g.seatPoint(seat)),id:seat+1,seat,state:'waiting',kind,patience:120,maxPatience:120,timer:0,paid:false,tint:0});
it('starts with three active products and offers real mixed orders after initial practice',()=>{
 const g=new Simulation();expect(g.b.offered).toEqual(['espresso','latte','cake']);g.s.totalServed=3;const seen=new Set<Menu>();for(let i=0;i<1800;i++){g.step(.1);g.b.customers.forEach(c=>seen.add(c.kind));}expect([...seen].sort()).toEqual(['cake','espresso','latte']);
});
it('unlocks and trains products through real coin costs, without closing existing recipes',()=>{
 const g=new Simulation();const initial=[...g.b.offered];expect(g.upgradeRecipe('iced')).toBe(false);g.s.coins=10000;const before=g.s.coins;expect(g.upgradeRecipe('iced')).toBe(true);expect(g.s.coins).toBe(before-MENU.iced.unlock);expect(g.b.offered).toEqual([...initial,'iced']);const price=g.recipePrice('iced');g.upgradeRecipe('iced');expect(g.recipePrice('iced')).toBeGreaterThan(price);g.upgradeRecipe('iced');const coins=g.s.coins;expect(g.upgradeRecipe('iced')).toBe(false);expect(g.s.coins).toBe(coins);expect(validateSave(g.s)).toBe(true);
});
it('never closes the last recipe or changes an already placed order',()=>{
 const g=new Simulation();g.b.customers=[guest(g,'latte')];g.toggleRecipe('cake');g.toggleRecipe('latte');expect(g.b.customers[0].kind).toBe('latte');expect(g.toggleRecipe('espresso')).toBe(false);expect(g.toggleRecipe('iced')).toBe(false);expect(g.b.offered).toEqual(['espresso']);
});
it('uses actual recipe ingredients and can brew espresso while milk is missing',()=>{
 const g=new Simulation();g.b.spawn=100;g.s.totalServed=6;g.b.ingredients.milk=0;g.b.customers=[guest(g,'latte'),guest(g,'espresso',1)];g.s.player=actor(POINTS.machine);const before=g.b.stock;advance(g,3.5);expect(g.s.player.cups.some(c=>c.kind==='espresso')).toBe(true);expect(g.s.player.cups.some(c=>c.kind==='latte')).toBe(false);expect(g.b.stock).toBe(before-1);expect(g.b.ingredients.milk).toBe(0);
});
it('moves finite warehouse ingredients in a crate, then refills the warehouse on its real timer',()=>{
 const g=new Simulation();g.b.stock=0;g.b.ingredients={milk:0,pastry:0,cold:0};g.s.player=actor(POINTS.supply);advance(g,.8);expect(g.s.player.cargo).toEqual({beans:8,milk:8,pastry:8,cold:8});expect(g.b.depot.beans).toBe(52);g.s.player.x=POINTS.machine.x;g.s.player.z=POINTS.machine.z;advance(g,.1);expect(g.b.stock).toBe(8);expect(g.b.ingredients.milk).toBe(8);expect(g.s.player.cargo).toBeUndefined();g.b.deliveryIn=.1;advance(g,.1);expect(g.b.depot.beans).toBe(60);expect(validateSave(g.s)).toBe(true);
});
it('cleans actual used tables and washes their dishes, preserving the finite cup total',()=>{
 const g=new Simulation();g.b.spawn=100;g.b.served=6;g.s.totalServed=6;g.b.cleanDishes=35;g.b.customers=[{...guest(g,'espresso'),state:'drinking',paid:true,action:21,timer:.1}];g.s.player=actor({x:0,z:2});advance(g,1);expect(g.b.dirtyTables[0]).toBe(1);const coins=g.s.coins;g.s.player=actor(g.servicePoint(0));advance(g,1.2);expect(g.b.dirtyTables).toEqual({});expect(g.b.dirtyDishes).toBe(1);g.s.player=actor(POINTS.wash);advance(g,2.5);expect(g.b.cleanDishes).toBe(36);expect(g.b.dirtyDishes).toBe(0);expect(g.s.coins).toBe(coins);
});
it('keeps a staffed multi-product café operating beyond the initial cup buffer',()=>{
 const g=new Simulation();g.s.coins=100000;g.upgrade('table');for(const r of ROLES)g.hire(r);g.s.player=actor({x:0,z:3});let sawWashing=false;for(let elapsed=0;elapsed<450&&g.b.served<40;elapsed++){advance(g,1);sawWashing ||= g.b.workers.dishwasher?.task==='wash';}expect(g.b.served).toBeGreaterThan(36);expect(g.b.cleanDishes).toBeGreaterThan(0);expect(validateSave(g.s)).toBe(true);expect(g.b.workers.cleaner).toBeTruthy();expect(sawWashing).toBe(true);
});
it('migrates the shipped v4 save with money, staff and language intact',()=>{
 const g=new Simulation();g.s.coins=5000;g.hire('waiter');g.s.settings.locale='tr';const old:any=structuredClone(g.s);old.version=4;for(const b of Object.values(old.branches) as any[]){for(const k of ['catalog','offered','ingredients','depot','deliveryIn','cleanDishes','dirtyDishes','dirtyTables','special','contractSerial','contractsCompleted','priority'])delete b[k];delete b.staff.cleaner;delete b.staff.dishwasher;delete b.level.storage;delete b.level.wash;}
 const map=new Map([[SAVE_KEY,JSON.stringify(old)]]),store={getItem:(k:string)=>map.get(k)??null,setItem:(k:string,v:string)=>{map.set(k,v)},removeItem:(k:string)=>{map.delete(k)}};const {save,status}=load(store);expect(status).toBe('ok');expect(save.version).toBe(7);expect(save.coins).toBe(g.s.coins);expect(save.settings.locale).toBe('tr');expect(save.branches[0].staff.waiter).toBe(1);expect(save.branches[0].offered).toHaveLength(3);expect(persist(save,store)).toBe(true);expect(load(store).save).toEqual(save);
});
it('rejects malformed new inventory and product fields instead of overwriting them',()=>{
 const g=new Simulation();g.b.offered=[];expect(validateSave(g.s)).toBe(false);g.b.offered=['espresso'];g.b.depot.milk=-1;expect(validateSave(g.s)).toBe(false);g.b.depot.milk=0;g.b.catalog.iced=99;expect(validateSave(g.s)).toBe(false);
});
it('migrates v5 without losing bought recipes, selected menu, cleaning staff or an active contract',()=>{
 const g=new Simulation();g.s.coins=5000;g.hire('waiter');g.hire('cleaner');g.hire('dishwasher');g.upgradeRecipe('iced');g.upgradeRecipe('iced');g.toggleRecipe('latte');g.acceptContract('cake');g.b.special!.fulfilled=2;g.b.depot.milk=17;g.b.ingredients.pastry=7;g.s.settings.locale='tr';
 const old:any=structuredClone(g.s);old.version=5;delete old.settings.helpSeen;for(const b of Object.values(old.branches) as any[]){for(const key of ['helpers','musicMode','volume','noiseConcern','warningSeconds','patrolSeconds','fineCooldown','fineCount','lastFine','totalFines','reviews','reviewCount','guestSerial'])delete b[key];for(const key of ['speakers','stage','soundproof'])delete b.level[key];}
 const map=new Map([[SAVE_KEY,JSON.stringify(old)]]),store={getItem:(key:string)=>map.get(key)??null,setItem:(key:string,value:string)=>{map.set(key,value)},removeItem:(key:string)=>{map.delete(key)}};const restored=load(store);expect(restored.status).toBe('ok');expect(restored.save.version).toBe(7);const branch=restored.save.branches[0];
 expect(restored.save.coins).toBe(g.s.coins);expect(restored.save.settings.locale).toBe('tr');expect(branch.catalog).toEqual(g.b.catalog);expect(branch.offered).toEqual(g.b.offered);expect(branch.staff).toEqual(g.b.staff);expect(branch.special).toEqual(g.b.special);expect(branch.depot.milk).toBe(17);expect(branch.ingredients.pastry).toBe(7);expect(branch.helpers).toEqual([]);expect(branch.reviews).toEqual([]);expect(branch.musicMode).toBe('off');expect(validateSave(restored.save)).toBe(true);
});
