import {describe,expect,it,vi} from 'vitest';
import * as T from 'three';
import {TABLE_TYPES,tableOfSeat,localSeat,seatId,tableSeats,seatOffset,seatLocalApproach,tableBounds,dishOffset,sofaBlocks} from '../src/game/table-layout';
import {table} from '../src/view/models';
vi.mock('../src/view/materials',()=>({woodGrain:()=>null,plasterGrain:()=>null,contactShadow:()=>new T.Group()}));

describe('real per-table capacity geometry',()=>{
 it('preserves the twelve original IDs and gives all sixty seats stable unique IDs',()=>{
  const all:number[]=[];
  for(let t=0;t<6;t++)for(let local=0;local<10;local++){const id=seatId(t,local);all.push(id);expect(tableOfSeat(id)).toBe(t);expect(localSeat(id)).toBe(local);if(local<2)expect(id).toBe(t*2+local);}
  expect(new Set(all).size).toBe(60);expect(Math.max(...all)).toBe(59);
  for(let tier=0;tier<3;tier++)expect(tableSeats(4,tier+1)).toEqual(expect.arrayContaining(tableSeats(4,tier)));
 });
 it('retains original two-seat dimensions, facing, product placement and approach',()=>{
  expect(seatOffset(0,0)).toEqual({x:-1,z:0,angle:Math.PI/2});expect(seatOffset(1,0)).toEqual({x:1,z:0,angle:-Math.PI/2});expect(seatLocalApproach(0,0)).toEqual({x:-1,z:.6});expect(dishOffset(1,0)).toEqual({x:.28,z:0});
 });
 it.each([1,2,3])('creates exactly the tier %s chairs, matching the simulation offsets and inward facing',tier=>{
  const model=table(new T.Group(),0,0,tier),chairs=model.children.filter(g=>g.name.startsWith('chair-')&&g.name!=='chair-cushions');
  expect(chairs).toHaveLength(TABLE_TYPES[tier].seats);
  for(const id of tableSeats(0,tier)){const chair=model.getObjectByName(`chair-${id}`)!,seat=seatOffset(id,tier);expect(chair.position.x).toBe(seat.x);expect(chair.position.z).toBe(seat.z);expect(chair.rotation.y).toBe(seat.angle);expect(chair.children.some(child=>child instanceof T.Mesh)).toBe(true);}
  const size=new T.Box3().setFromObject(model).getSize(new T.Vector3());expect(size.x).toBeLessThan(4.8);expect(size.z).toBeLessThan(5);
 });
 it.each([1,2,3])('keeps tier %s chairs, radial approaches and individual dish places clear',tier=>{
  const seats=tableSeats(0,tier),bounds=tableBounds(tier);
  for(const id of seats){const s=seatOffset(id,tier),approach=seatLocalApproach(id,tier),dish=dishOffset(localSeat(id),tier);
   expect(Math.hypot(approach.x-s.x,approach.z-s.z)).toBeCloseTo(.6);expect(Math.abs(dish.x)+.18).toBeLessThanOrEqual(bounds.halfWidth);expect(Math.abs(dish.z)+.18).toBeLessThanOrEqual(bounds.halfDepth);
   for(const other of seats.filter(other=>other!==id)){const o=seatOffset(other,tier),otherDish=dishOffset(localSeat(other),tier);expect(Math.hypot(s.x-o.x,s.z-o.z)).toBeGreaterThan(.98);expect(Math.hypot(approach.x-o.x,approach.z-o.z)).toBeGreaterThan(.49);expect(Math.hypot(dish.x-otherDish.x,dish.z-otherDish.z)).toBeGreaterThan(.39);}
  }
 });
 it('keeps the accessible service corner outside the tabletop and every chair',()=>{
  for(const tier of [1,2,3]){const b=tableBounds(tier),point={x:(tier>=2?1:-1)*(b.halfWidth+.25),z:b.halfDepth+.30};for(const id of tableSeats(0,tier)){const seat=seatOffset(id,tier);expect(Math.hypot(point.x-seat.x,point.z-seat.z)).toBeGreaterThan(.49);}}
 });
 it('makes comfort and furniture silhouettes change, with permanent upholstered seats',()=>{
  expect(TABLE_TYPES.map(t=>t.comfort)).toEqual([0,2,4,6]);
  for(const tier of [1,2,3]){const model=table(new T.Group(),0,0,tier);expect(!!model.getObjectByName('l-sofa')).toBe(tier>=2);expect(model.getObjectByName('chair-cushions')!.visible).toBe(true);expect(model.children.filter(g=>g.name.startsWith('coffee-surface')).length).toBe(tier===3?2:1);expect(TABLE_TYPES[tier].tableTop).toBeLessThan(TABLE_TYPES[0].tableTop);}
 });
 it.each([2,3])('matches tier %s visible continuous sofa footprint to collision bounds',tier=>{
  const model=table(new T.Group(),0,0,tier),sofa=model.getObjectByName('l-sofa')!,bounds=new T.Box3().setFromObject(sofa),blocks=sofaBlocks(tier);
  expect(bounds.min.x).toBeCloseTo(Math.min(...blocks.map(b=>b.x-b.width/2)),2);expect(bounds.max.x).toBeLessThanOrEqual(Math.max(...blocks.map(b=>b.x+b.width/2))+.001);expect(bounds.min.z).toBeGreaterThanOrEqual(Math.min(...blocks.map(b=>b.z-b.depth/2))-.001);expect(bounds.max.z).toBeCloseTo(Math.max(...blocks.map(b=>b.z+b.depth/2)),2);
  for(const id of tableSeats(0,tier)){const a=seatLocalApproach(id,tier);expect(blocks.some(b=>Math.abs(a.x-b.x)<b.width/2+.08&&Math.abs(a.z-b.z)<b.depth/2+.08)).toBe(false);}
 });
 it('keeps every salon product supported by one of the two actual coffee surfaces',()=>{
  for(let local=0;local<10;local++){const dish=dishOffset(local,3);expect([-.66,.66].some(z=>Math.abs(dish.z-z)+.18<=1.18/2&&Math.abs(dish.x)+.18<=1.65/2)).toBe(true);}
 });

});
