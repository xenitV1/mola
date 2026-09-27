import {expect,it,vi} from 'vitest';
import * as T from 'three';
import {CafeCity} from '../src/view/city';

// Geometry and layout can be checked without a canvas or WebGL renderer.
vi.mock('../src/view/materials',()=>({woodGrain:()=>null,plasterGrain:()=>null,contactShadow:()=>new T.Group()}));

it('keeps the complete forecourt bench together and outside the expanded café and pedestrian lane',()=>{
 const city=new CafeCity(new T.Scene());
 const bench=city.root.getObjectByName('forecourt-bench');
 expect(bench).toBeDefined();
 const bounds=new T.Box3().setFromObject(bench!),size=bounds.getSize(new T.Vector3());
 expect(size.x).toBeCloseTo(1.35,3);
 expect(size.z).toBeLessThan(.5);
 expect(size.y).toBeGreaterThan(1);
 expect(bounds.min.z).toBeGreaterThan(12.5+.4);
 expect(bounds.max.z).toBeLessThan(14.52-.4);
 expect(bounds.min.x).toBeGreaterThan(1);
});
