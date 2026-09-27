import {describe,expect,it,vi} from 'vitest';
import {CameraGestures} from '../src/view/camera-gestures';

// Capture loss is dispatched synchronously, so these tests also exercise the
// re-entrant event a browser may produce while a gesture releases its pointers.
class CanvasHarness {
 private listeners=new Map<string,Array<(event:any)=>void>>();
 readonly captured=new Set<number>();
 addEventListener(type:string,listener:(event:any)=>void){
  this.listeners.set(type,[...this.listeners.get(type)??[],listener]);
 }
 setPointerCapture(id:number){this.captured.add(id);}
 hasPointerCapture(id:number){return this.captured.has(id);}
 releasePointerCapture(id:number){
  if(this.captured.delete(id))this.emit('lostpointercapture',{pointerId:id});
 }
 emit(type:string,event:Record<string,unknown>){
  for(const listener of this.listeners.get(type)??[])listener(event);
 }
 pointer(type:string,id:number,x:number,y:number,button=0){
  this.emit(type,{pointerId:id,clientX:x,clientY:y,button});
 }
}

function setup(zoom=1,rotation=0){
 const canvas=new CanvasHarness();
 const scene={camera:{zoom},rotation,zoomAt:vi.fn((next:number,_x:number,_y:number)=>{scene.camera.zoom=next;}),rotateTo:vi.fn((angle:number)=>{scene.rotation=angle;})};
 let enabled=true;
 const tap=vi.fn();
 const gestures=new CameraGestures(canvas as unknown as HTMLCanvasElement,scene,()=>enabled,tap);
 return {canvas,scene,tap,gestures,disable:()=>{enabled=false;},enable:()=>{enabled=true;}};
}

describe('camera gestures',()=>{
 it('zooms around the finger midpoint and uses the original span throughout a pinch',()=>{
  const {canvas,scene}=setup(1.5);
  canvas.pointer('pointerdown',1,100,100);
  canvas.pointer('pointerdown',2,200,100);
  canvas.pointer('pointermove',2,300,100);
  expect(scene.zoomAt).toHaveBeenLastCalledWith(3,200,100);
  canvas.pointer('pointermove',2,250,100);
  expect(scene.zoomAt).toHaveBeenLastCalledWith(2.25,175,100);
  canvas.pointer('pointermove',2,150,100);
  expect(scene.zoomAt).toHaveBeenLastCalledWith(.75,125,100);
 });

 it('allows widening and twisting the same pinch without losing the starting camera rotation',()=>{
  const {canvas,scene}=setup(1.2,.3);
  canvas.pointer('pointerdown',1,100,100);
  canvas.pointer('pointerdown',2,200,100);
  canvas.pointer('pointermove',2,100,300);
  expect(scene.zoomAt).toHaveBeenLastCalledWith(2.4,100,200);
  expect(scene.rotateTo.mock.lastCall?.[0]).toBeCloseTo(.3-Math.PI/2);
  // Returning the fingers also returns to the original view, without drift.
  canvas.pointer('pointermove',2,200,100);
  expect(scene.zoomAt).toHaveBeenLastCalledWith(1.2,150,100);
  expect(scene.rotateTo.mock.lastCall?.[0]).toBeCloseTo(.3);
 });

 it('crosses the signed angle boundary with a small rotation instead of a full revolution',()=>{
  const {canvas,scene}=setup(1,.4);
  const degrees=(angle:number)=>angle*Math.PI/180;
  canvas.pointer('pointerdown',1,200,200);
  canvas.pointer('pointerdown',2,200+100*Math.cos(degrees(179)),200+100*Math.sin(degrees(179)));
  canvas.pointer('pointermove',2,200+100*Math.cos(degrees(-179)),200+100*Math.sin(degrees(-179)));
  expect(scene.rotateTo.mock.lastCall?.[0]).toBeCloseTo(.4-degrees(2));
  expect(scene.camera.zoom).toBeCloseTo(1);
 });

 it('never turns either finger release after a pinch into an action tap',()=>{
  const {canvas,tap}=setup();
  canvas.pointer('pointerdown',1,100,100);
  canvas.pointer('pointerdown',2,200,100);
  canvas.pointer('pointermove',2,220,100);
  canvas.pointer('pointerup',2,220,100);
  canvas.pointer('pointermove',1,101,100);
  canvas.pointer('pointerup',1,101,100);
  expect(tap).not.toHaveBeenCalled();
  expect(canvas.captured.size).toBe(0);
  // A subsequent independent tap must still work.
  canvas.pointer('pointerdown',3,40,50);
  canvas.pointer('pointerup',3,40,50);
  expect(tap).toHaveBeenCalledExactlyOnceWith(40,50);
 });

 it.each(['pointercancel','lostpointercapture'])('clears the entire gesture on %s and ignores stale movement/releases',event=>{
  const {canvas,scene,tap}=setup();
  canvas.pointer('pointerdown',1,100,100);
  canvas.pointer('pointerdown',2,200,100);
  canvas.emit(event,{pointerId:1});
  expect(canvas.captured.size).toBe(0);
  canvas.pointer('pointermove',2,400,100);
  canvas.pointer('pointerup',2,400,100);
  canvas.pointer('pointerup',1,100,100);
  expect(scene.zoomAt).not.toHaveBeenCalled();
  expect(tap).not.toHaveBeenCalled();
  canvas.pointer('pointerdown',3,20,30);
  canvas.pointer('pointerup',3,20,30);
  expect(tap).toHaveBeenCalledExactlyOnceWith(20,30);
 });

 it('preserves a normal tap with a little finger jitter, while excluding drags and right clicks',()=>{
  const {canvas,tap}=setup();
  canvas.pointer('pointerdown',1,100,100);
  canvas.pointer('pointermove',1,104,104);
  canvas.pointer('pointerup',1,105,104);
  expect(tap).toHaveBeenCalledExactlyOnceWith(105,104);
  canvas.pointer('pointerdown',2,100,100);
  canvas.pointer('pointermove',2,140,100);
  canvas.pointer('pointermove',2,100,100);
  canvas.pointer('pointerup',2,100,100);
  canvas.pointer('pointerdown',3,100,100,2);
  canvas.pointer('pointerup',3,100,100,2);
  expect(tap).toHaveBeenCalledTimes(1);
 });

 it('ignores gestures while a modal disables the world and cancels a gesture disabled midway',()=>{
  const {canvas,scene,tap,disable,enable}=setup();
  disable();
  canvas.pointer('pointerdown',1,100,100);
  canvas.pointer('pointerup',1,100,100);
  expect(canvas.captured.size).toBe(0);
  expect(tap).not.toHaveBeenCalled();
  enable();
  canvas.pointer('pointerdown',2,100,100);
  canvas.pointer('pointerdown',3,200,100);
  disable();
  canvas.pointer('pointermove',3,300,100);
  expect(canvas.captured.size).toBe(0);
  expect(scene.zoomAt).not.toHaveBeenCalled();
  enable();
  canvas.pointer('pointerup',3,300,100);
  canvas.pointer('pointerup',2,100,100);
  expect(tap).not.toHaveBeenCalled();
 });

 it('ignores an almost coincident pair of fingers instead of generating extreme zoom',()=>{
  const {canvas,scene}=setup();
  canvas.pointer('pointerdown',1,100,100);
  canvas.pointer('pointerdown',2,102,100);
  canvas.pointer('pointermove',2,300,100);
  expect(scene.zoomAt).not.toHaveBeenCalled();
  expect(scene.rotateTo).not.toHaveBeenCalled();
 });
});
