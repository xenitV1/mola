type Point={x:number;y:number};
type CameraControl={camera:{zoom:number};rotation?:number;rotateTo?:(angle:number)=>void;zoomAt:(zoom:number,x:number,y:number)=>void};
export class CameraGestures {
 private fingers=new Map<number,Point>();private start:Point|null=null;private pinched=false;private span=0;private zoom=1;private twist=0;private rotation=0;private pinchOrigins:Point[]=[];private mouseOrigin:Point|null=null;private mouseRotation=0;
 constructor(private canvas:HTMLCanvasElement,private scene:CameraControl,private enabled:()=>boolean,private tap:(x:number,y:number)=>void){
  canvas.addEventListener('pointerdown',e=>{
   if(!enabled()||e.button!==0)return;
   this.fingers.set(e.pointerId,{x:e.clientX,y:e.clientY});canvas.setPointerCapture(e.pointerId);
   if(this.fingers.size===1){this.start={x:e.clientX,y:e.clientY};this.pinched=false;this.mouseOrigin=e.pointerType==='mouse'?{x:e.clientX,y:e.clientY}:null;this.mouseRotation=scene.rotation??0;}
   if(this.fingers.size>=2){this.pinched=true;this.start=null;this.beginPinch();}
  });
  canvas.addEventListener('pointermove',e=>{
   if(!this.fingers.has(e.pointerId))return;if(!enabled()){this.cancel();return;}
   this.fingers.set(e.pointerId,{x:e.clientX,y:e.clientY});
   if(this.fingers.size>=2){const [a,b]=[...this.fingers.values()];const span=Math.hypot(a.x-b.x,a.y-b.y);if(this.span>8){scene.zoomAt(this.zoom*span/this.span,(a.x+b.x)/2,(a.y+b.y)/2);const angle=Math.atan2(b.y-a.y,b.x-a.x)-this.twist;const dxA=a.x-this.pinchOrigins[0].x,dxB=b.x-this.pinchOrigins[1].x;const parallel=dxA*dxB>0?Math.sign(dxA)*Math.min(Math.abs(dxA),Math.abs(dxB)):0;scene.rotateTo?.(this.rotation-Math.atan2(Math.sin(angle),Math.cos(angle))-parallel*.006);}}
   else {if(this.start&&Math.hypot(e.clientX-this.start.x,e.clientY-this.start.y)>15)this.start=null;if(this.mouseOrigin&&!this.start&&!this.pinched)scene.rotateTo?.(this.mouseRotation-(e.clientX-this.mouseOrigin.x)*.006);}
  });
  canvas.addEventListener('pointerup',e=>{
   if(!this.fingers.has(e.pointerId))return;
   const isTap=!this.pinched&&this.fingers.size===1&&this.start&&Math.hypot(e.clientX-this.start.x,e.clientY-this.start.y)<=15;
   this.fingers.delete(e.pointerId);if(canvas.hasPointerCapture(e.pointerId))canvas.releasePointerCapture(e.pointerId);
   if(isTap&&enabled())tap(e.clientX,e.clientY);
   if(this.fingers.size>=2)this.beginPinch();if(!this.fingers.size)this.cancel();
  });
  canvas.addEventListener('pointercancel',()=>this.cancel());
  canvas.addEventListener('lostpointercapture',e=>{if(this.fingers.has(e.pointerId))this.cancel();});
  canvas.addEventListener('wheel',e=>{if(!enabled())return;e.preventDefault();scene.zoomAt(scene.camera.zoom*Math.exp(-e.deltaY*.0015),e.clientX,e.clientY);},{passive:false});
 }
 private beginPinch(){const [a,b]=[...this.fingers.values()];this.pinchOrigins=[{...a},{...b}];this.span=Math.hypot(a.x-b.x,a.y-b.y);this.zoom=this.scene.camera.zoom;this.twist=Math.atan2(b.y-a.y,b.x-a.x);this.rotation=this.scene.rotation??0;}
 cancel(){const ids=[...this.fingers.keys()];this.fingers.clear();this.start=null;this.mouseOrigin=null;this.pinched=false;for(const id of ids)if(this.canvas.hasPointerCapture(id))this.canvas.releasePointerCapture(id);}
}
