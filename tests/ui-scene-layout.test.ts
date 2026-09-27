import {describe,expect,it} from 'vitest';
import * as T from 'three';
import {uiFrustumCenterOffset} from '../src/view/scene';
import type {PlayArea} from '../src/ui/layout';

describe('scene UI camera projection',()=>{
 it('projects the camera target to the usable area center at every zoom',()=>{
  const area:PlayArea={left:12,right:308,top:104,bottom:420};
  const height=480,width=20.5,worldHeight=width/(height/320);
  for(const zoom of [0.75,1,1.8,3]){
   const camera=new T.OrthographicCamera(-width/2,width/2,worldHeight/2, -worldHeight/2,.1,80);
   const offset=uiFrustumCenterOffset(area,height,worldHeight,zoom);
   camera.top=worldHeight/2+offset;camera.bottom=-worldHeight/2+offset;camera.zoom=zoom;camera.updateProjectionMatrix();
   const projected=new T.Vector3(0,0,0).project(camera);
   const screenY=(-projected.y*.5+.5)*height;
   expect(screenY).toBeCloseTo((area.top+area.bottom)/2,6);
  }
 });
});

it('frames the café corners inside the usable band on phones and both tablet orientations',async()=>{
 const {cafeFrameWidth}=await import('../src/view/scene');
 for(const [w,h,top,bottom] of [[320,480,68,343],[393,873,190,635],[1024,1366,220,1133],[1366,1024,220,791]])for(const floorEnd of [5.4,9.6,13.2]){
  const area={left:12,right:w-12,top,bottom},width=cafeFrameWidth(w,h,area,floorEnd),worldHeight=width*h/w;
  const camera=new T.OrthographicCamera(-width/2,width/2,worldHeight/2,-worldHeight/2,.1,80);
  const offset=uiFrustumCenterOffset(area,h,worldHeight,1);camera.top+=offset;camera.bottom+=offset;
  const centerZ=(floorEnd-4.9)/2+1.8;
  camera.position.set(3.1+Math.sin(.17)*28,30,centerZ+Math.cos(.17)*28);camera.lookAt(3.1,.4,centerZ);camera.updateMatrixWorld();camera.updateProjectionMatrix();
  for(const x of [-4.1,10.3])for(const y of [0,3.6])for(const z of [-4.9,floorEnd]){
   const p=new T.Vector3(x,y,z).project(camera),screenX=(p.x*.5+.5)*w,screenY=(-p.y*.5+.5)*h;
   expect(screenX).toBeGreaterThanOrEqual(area.left);expect(screenX).toBeLessThanOrEqual(area.right);
   expect(screenY).toBeGreaterThanOrEqual(area.top);expect(screenY).toBeLessThanOrEqual(area.bottom);
  }
 }
});
