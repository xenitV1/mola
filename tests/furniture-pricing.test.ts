import {describe,it,expect} from 'vitest';
import {Simulation} from '../src/game/sim';
import {TABLE_TYPES} from '../src/game/table-layout';
describe('furniture investments have distinct progression costs',()=>{
 it('keeps the early capacity and machine wins affordable while making luxury furniture aspirational',()=>{
  const g=new Simulation();expect(g.price('table')).toBe(90);expect(g.price('machine')).toBe(145);expect(TABLE_TYPES.map(t=>t.cost)).toEqual([0,3000,12000,45000]);
 });
 it('charges the displayed price exactly once for each selected upgrade and refuses insufficient money',()=>{
  const g=new Simulation();g.s.coins=10000;expect(g.upgrade('space')).toBe(true);expect(g.upgrade('space')).toBe(true);
  // Floors use a fixture budget; furniture then receives exactly its quoted
  // amount to check the affordability boundary and actual debit independently.
  for(const next of TABLE_TYPES.slice(1)){
   expect(g.tableUpgradePrice(0)).toBe(next.cost);g.s.coins=next.cost-1;const level=g.b.tableLevels[0];expect(g.upgradeTable(0)).toBe(false);expect(g.b.tableLevels[0]).toBe(level);expect(g.s.coins).toBe(next.cost-1);
   g.s.coins++;expect(g.upgradeTable(0)).toBe(true);expect(g.s.coins).toBe(0);expect(g.tableCapacity(0)).toBe(next.seats);
  }
 });
 it('lets a new group stay basic instead of forcing every existing group to upgrade',()=>{
  const g=new Simulation();g.s.coins=g.price('table')+TABLE_TYPES[1].cost;expect(g.upgrade('table')).toBe(true);expect(g.upgradeTable(0)).toBe(true);expect(g.b.tableLevels.slice(0,2)).toEqual([1,0]);expect(g.tableUpgradePrice(1)).toBe(3000);expect(g.s.coins).toBe(0);
 });
});
