import {expect,it,vi} from 'vitest';
import {CameraGestures} from '../src/view/camera-gestures';
function setup(){
 const listeners=new Map<string,((e:any)=>void)[]>(),capture=new Set<number>();
 const canvas={addEventListener:(n:string,f:(e:any)=>void)=>listeners.set(n,[...listeners.get(n)??[],f]),setPointerCapture:(n:number)=>capture.add(n),hasPointerCapture:(n:number)=>capture.has(n),releasePointerCapture:(n:number)=>capture.delete(n)};
 const scene={camera:{zoom:1},rotation:0,zoomAt:vi.fn((z:number)=>scene.camera.zoom=z),rotateTo:vi.fn((r:number)=>scene.rotation=r)},tap=vi.fn();
 new CameraGestures(canvas as unknown as HTMLCanvasElement,scene,()=>true,tap);
 const pointer=(type:string,id:number,x:number,y:number,pointerType='touch')=>listeners.get(type)?.forEach(f=>f({pointerId:id,clientX:x,clientY:y,button:0,pointerType}));
 return {pointer,scene,tap};
}
it('parallel horizontal two-finger drag rotates without leaving zoom changed or triggering a walk',()=>{
 const {pointer,scene,tap}=setup();pointer('pointerdown',1,100,100);pointer('pointerdown',2,200,100);pointer('pointermove',1,150,100);pointer('pointermove',2,250,100);
 expect(scene.rotation).toBeCloseTo(-.3);expect(scene.camera.zoom).toBeCloseTo(1);pointer('pointerup',1,150,100);pointer('pointerup',2,250,100);expect(tap).not.toHaveBeenCalled();
});
it('mouse drag rotates, a click still walks, and one-finger mobile drag does not rotate',()=>{
 const {pointer,scene,tap}=setup();pointer('pointerdown',1,100,100,'mouse');pointer('pointerup',1,101,101,'mouse');expect(tap).toHaveBeenCalledOnce();
 pointer('pointerdown',2,100,100,'mouse');pointer('pointermove',2,200,100,'mouse');pointer('pointerup',2,200,100,'mouse');expect(scene.rotation).toBeCloseTo(-.6);expect(tap).toHaveBeenCalledOnce();
 pointer('pointerdown',3,100,100);pointer('pointermove',3,200,100);pointer('pointerup',3,200,100);expect(scene.rotation).toBeCloseTo(-.6);
});
