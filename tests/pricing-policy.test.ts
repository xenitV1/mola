import {describe,it,expect} from 'vitest';
import {PRICING,freshPrices,type PriceMode} from '../src/game/pricing';
import {MENU} from '../src/game/config';
import {Simulation,actor} from '../src/game/sim';
import {validateSave} from '../src/game/save';
const advance=(g:Simulation,seconds:number)=>{for(let i=0;i<seconds*30;i++)g.step(1/30);};
describe('per-product prices create a visible revenue and demand choice',()=>{
 it('starts every recipe at its normal price and returns independent policy records',()=>{
  const first=freshPrices(),second=freshPrices();expect(Object.keys(first).sort()).toEqual(Object.keys(MENU).sort());expect(Object.values(first).every(mode=>mode==='normal')).toBe(true);first.espresso='cheap';expect(second.espresso).toBe('normal');
  const g=new Simulation();for(const kind of ['espresso','latte','cake'] as const)expect(g.recipePrice(kind)).toBe(MENU[kind].price);
 });
 it('changes the selected product price and traffic without altering other recipes or spending coins',()=>{
  const g=new Simulation(),coins=g.s.coins,lattePrice=g.recipePrice('latte'),baseDemand=g.menuDemand('espresso');
  expect(g.setPriceMode('espresso','cheap')).toBe(true);expect(g.recipePrice('espresso')).toBe(Math.round(MENU.espresso.price*.8));expect(g.menuDemand('espresso')).toBeCloseTo(baseDemand*1.2);expect(g.recipePrice('latte')).toBe(lattePrice);expect(g.b.priceModes.latte).toBe('normal');
  expect(g.setPriceMode('espresso','high')).toBe(true);expect(g.recipePrice('espresso')).toBe(Math.round(MENU.espresso.price*1.3));expect(g.menuDemand('espresso')).toBeCloseTo(baseDemand*.75);expect(g.s.coins).toBe(coins);expect(validateSave(g.s)).toBe(true);
 });
 it('cheap prices cause more actual arrivals and high prices fewer with the same neighbourhood and reputation',()=>{
  const run=(mode:PriceMode)=>{const g=new Simulation();g.s.totalServed=40;g.setMenu('espresso');g.setPriceMode('espresso',mode);g.s.player=actor({x:0,z:3});for(let i=0;i<90*30;i++){g.b.rating=4;g.step(1/30);}return g.b.guestSerial;};
  // Hold reputation fixed to isolate price, while the real spawn timer and guests run.
  const cheap=run('cheap'),normal=run('normal'),high=run('high');expect(cheap).toBeGreaterThan(normal);expect(normal).toBeGreaterThan(high);
 });
 it('honours the price quoted to an existing seated order when prices change before delivery',()=>{
  const g=new Simulation();g.s.totalServed=40;g.s.milestone=7;g.setMenu('espresso');g.setPriceMode('espresso','cheap');g.s.player=actor({x:0,z:3});
  for(let i=0;i<30*30&&!g.waiting.length;i++)g.step(1/30);const customer=g.waiting[0];expect(customer).toBeTruthy();const quote=customer.quotedPrice;expect(quote).toBe(Math.round(MENU.espresso.price*PRICING.cheap.price));
  g.setPriceMode('espresso','high');expect(g.recipePrice('espresso')).toBeGreaterThan(quote!);expect(customer.quotedPrice).toBe(quote);customer.patience=customer.maxPatience*.4;g.s.player=actor(g.orderPoint(customer));g.s.player.cups=[{kind:'espresso',quality:0,born:g.b.time}];const coins=g.s.coins;g.step(1/30);
  expect(customer.paid).toBe(true);expect(g.s.coins-coins).toBe(quote);expect(customer.action).toBe(quote);expect(validateSave(g.s)).toBe(true);
 });
 it('new orders receive the newly selected quote while older quotes remain unchanged',()=>{
  const g=new Simulation();g.s.totalServed=40;g.setMenu('espresso');g.setPriceMode('espresso','normal');advance(g,2);expect(g.b.customers[0].quotedPrice).toBeUndefined();
  for(let i=0;i<30*30&&!g.waiting.length;i++)g.step(1/30);const old=g.waiting[0];expect(old).toBeTruthy();expect(old.quotedPrice).toBe(MENU.espresso.price);
  g.setPriceMode('espresso','high');const oldId=old.id;for(let i=0;i<30*30&&!g.waiting.some(c=>c.id!==oldId);i++)g.step(1/30);const next=g.waiting.find(c=>c.id!==oldId);expect(next).toBeTruthy();expect(next!.quotedPrice).toBe(g.recipePrice('espresso'));expect(old.quotedPrice).toBe(MENU.espresso.price);
 });
});
