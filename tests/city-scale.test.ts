import {it,expect} from 'vitest';
import * as T from 'three';
import {car} from '../src/view/city';
it('fits a human-scale compact car inside each street lane in both orientations',()=>{
 const model=car(new T.Group(),'#ca9171'),size=new T.Box3().setFromObject(model).getSize(new T.Vector3());
 expect(size.z/1.808).toBeGreaterThan(2);expect(size.z/1.808).toBeLessThan(2.3);
 expect(size.y).toBeGreaterThan(1.4);expect(size.y).toBeLessThan(1.6);expect(size.x).toBeGreaterThan(1.7);expect(size.x).toBeLessThan(2.1);
 for(const x of [7.5,9.6]){model.position.set(x,-.207,-2.1);model.rotation.y=0;const b=new T.Box3().setFromObject(model);expect(b.min.x).toBeGreaterThan(6.45);expect(b.max.x).toBeLessThan(10.65);expect(b.min.y).toBeCloseTo(-.207,5);}
 for(const z of [8.63,10.73]){model.position.set(0,-.207,z);model.rotation.y=Math.PI/2;const b=new T.Box3().setFromObject(model);expect(b.min.z).toBeGreaterThan(7.58);expect(b.max.z).toBeLessThan(11.78);}
});
