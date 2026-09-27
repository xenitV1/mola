import {describe,it,expect} from 'vitest';
import {Simulation} from '../src/game/sim';
import {diamondPrice,DIAMOND_COSTS} from '../src/game/diamonds';
import {TABLE_TYPES} from '../src/game/table-layout';
describe('advanced investment gold prices preserve early progress',()=>{
 it('balances entry equipment and makes professional levels larger investments',()=>{
  const g=new Simulation();g.s.coins=100000;expect(g.price('table')).toBe(90);
  for(const price of [145,265,2035,6020]){expect(g.price('machine')).toBe(price);const before=g.s.coins;expect(g.upgrade('machine')).toBe(true);expect(g.s.coins).toBe(before-price);}
  const before=g.s.coins;expect(g.upgrade('machine')).toBe(false);expect(g.s.coins).toBe(before);
 });
 it('raises all quality and staff prices, with a larger final-tier increase',()=>{
  const g=new Simulation();g.s.coins=100000;
  for(const price of [195,390,3250]){expect(g.price('quality')).toBe(price);expect(g.upgrade('quality')).toBe(true);}
  for(const price of [270,500,3850]){expect(g.staffPrice('barista')).toBe(price);expect(g.hire('barista')).toBe(true);}
 });
 it('raises product unlocks and both recipe training steps',()=>{
  const g=new Simulation();g.s.coins=100000;expect(g.recipeUpgradeCost('tea')).toBe(270);expect(g.recipeUpgradeCost('iced')).toBe(480);expect(g.recipeUpgradeCost('latte')).toBe(255);g.upgradeRecipe('latte');expect(g.recipeUpgradeCost('latte')).toBe(2260);expect(g.upgradeRecipe('latte')).toBe(true);expect(g.upgradeRecipe('latte')).toBe(false);
 });
 it('raises furniture gold prices while retaining the explicit diamond alternative',()=>{
  const g=new Simulation();expect(TABLE_TYPES.map(t=>t.cost)).toEqual([0,3000,12000,45000]);expect(diamondPrice(g,{kind:'table-type',id:'0'})).toBe(40);expect(DIAMOND_COSTS.furniture).toEqual([40,180,500]);expect(18*DIAMOND_COSTS.furniture.reduce((n,c)=>n+c,0)).toBe(12960);
 });
});
