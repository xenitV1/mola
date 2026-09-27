import {expect,it,vi} from 'vitest';
import * as T from 'three';
import {CafeCity} from '../src/view/city';
vi.mock('../src/view/materials',()=>({woodGrain:()=>null,plasterGrain:()=>null,contactShadow:()=>new T.Group()}));
it('keeps a bounded cast of animals and pedestrians outside every café expansion',()=>{
 const city=new CafeCity(new T.Scene());expect(city.walkers).toHaveLength(10);expect(city.cars).toHaveLength(5);
 expect(city.animals.map(a=>a.kind)).toEqual(['cat','cat','dog','bird','bird','bird']);
 const nodes=city.root.children.length;
 for(let time=0;time<120;time+=2){city.update(0,time,true);for(const actor of [...city.animals.map(a=>a.root),...city.walkers.map(p=>p.root),...city.cars]){
  expect(actor.position.x>=-4.1&&actor.position.x<=10.3&&actor.position.z>=-4.9&&actor.position.z<=12.5).toBe(false);
 }}
 expect(city.root.children.length).toBe(nodes);
});
it('reduced motion freezes neighbourhood travel and animal motion',()=>{
 const city=new CafeCity(new T.Scene());city.update(0,10,true);const positions=city.animals.map(a=>a.root.position.clone());city.update(0,90,false);
 city.animals.forEach((pet,i)=>{expect(pet.root.position.equals(positions[i])).toBe(true);expect(pet.legs.every(leg=>leg.rotation.x===0)).toBe(true);expect(pet.wings.every(wing=>wing.rotation.z===0)).toBe(true);});
});
