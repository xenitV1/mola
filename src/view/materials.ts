import * as T from 'three';
let grain:T.CanvasTexture|undefined;
let plaster:T.CanvasTexture|undefined;
let contact:T.CanvasTexture|undefined;
let shadowMaterial:T.MeshBasicMaterial|undefined;
// Small original, deterministic material maps, created once and shared.
// These are surface detail, never a replacement for the playable 3D room.
export function woodGrain(){
 if(grain)return grain;
 const canvas=document.createElement('canvas');canvas.width=512;canvas.height=128;
 const ctx=canvas.getContext('2d')!;ctx.fillStyle='#fff8e9';ctx.fillRect(0,0,512,128);
 let seed=814;const rnd=()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/4294967296;};
 for(let i=0;i<180;i++){
  const y=rnd()*128,amplitude=1+rnd()*2,phase=rnd()*Math.PI*2;
  ctx.strokeStyle=`rgba(89,52,24,${.025+rnd()*.09})`;ctx.lineWidth=.3+rnd()*.9;ctx.beginPath();
  for(let x=0;x<=512;x+=8){const yy=y+Math.sin(x/512*Math.PI*4+phase)*amplitude; x?ctx.lineTo(x,yy):ctx.moveTo(x,yy);}
  ctx.stroke();
 }
 grain=new T.CanvasTexture(canvas);grain.colorSpace=T.SRGBColorSpace;grain.wrapS=grain.wrapT=T.RepeatWrapping;return grain;
}
export function plasterGrain(){
 if(plaster)return plaster;
 const canvas=document.createElement('canvas');canvas.width=canvas.height=128;
 const ctx=canvas.getContext('2d')!,data=ctx.createImageData(128,128);
 for(let i=0;i<data.data.length;i+=4){const n=241+((i*17+(i>>8)*13)%15);data.data.set([n,n,n,255],i);}
 ctx.putImageData(data,0,0);plaster=new T.CanvasTexture(canvas);plaster.colorSpace=T.SRGBColorSpace;plaster.wrapS=plaster.wrapT=T.RepeatWrapping;plaster.repeat.set(5,5);return plaster;
}
export function contactShadow(parent:T.Object3D,width:number,depth:number){
 if(!contact){const canvas=document.createElement('canvas');canvas.width=canvas.height=64;const ctx=canvas.getContext('2d')!;const g=ctx.createRadialGradient(32,32,2,32,32,32);g.addColorStop(0,'rgba(45,27,14,.36)');g.addColorStop(.4,'rgba(45,27,14,.22)');g.addColorStop(1,'rgba(45,27,14,0)');ctx.fillStyle=g;ctx.fillRect(0,0,64,64);contact=new T.CanvasTexture(canvas);}
 const material=shadowMaterial??=new T.MeshBasicMaterial({map:contact,transparent:true,depthWrite:false,polygonOffset:true,polygonOffsetFactor:-1});
 const mesh=new T.Mesh(new T.PlaneGeometry(width,depth),material);mesh.rotation.x=-Math.PI/2;mesh.position.y=.065;mesh.renderOrder=1;parent.add(mesh);return mesh;
}
