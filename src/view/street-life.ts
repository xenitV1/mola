import * as T from 'three';
import {box,cyl,sphere,mesh,mat} from './models';

// Original, wordless storefronts remain readable in either game language.
export function shopfront(g:T.Group,w:number,d:number,style:number){
 const z=d/2,ink=['#657d65','#718c91','#bb8367'][style%3];
 box(g,0,1.03,z+.08,w-.25,1.90,.10,ink,.02);
 for(const side of [-1,1]){
  box(g,side*w*.30,1.11,z+.14,w*.26,1.38,.035,'#a8c9bc',.008);
  box(g,side*w*.30,.48,z+.17,w*.25,.07,.045,'#e9ce98',.01);
  for(let i=0;i<3;i++){
   const x=side*w*.30+(i-1)*w*.065;
   if(style===0){cyl(g,x,.34,z+.28,.09,.065,.17,'#ba805d',10);cyl(g,x,.53,z+.28,.015,.015,.24,'#6c8d61',6);sphere(g,x,.67,z+.28,.11,.10,.065,['#efa7a1','#f3d189','#e9d6bc'][i]);}
   else if(style===1){box(g,x,.64,z+.18,w*.065,.25,.07,['#e8b57f','#f2dfae','#93a294'][i],.006);}
   else{sphere(g,x,.58,z+.20,w*.08,.075,.065,'#edc28a');}
  }
 }
 box(g,0,.95,z+.17,.90,1.90,.06,'#50685e',.012);box(g,0,1.21,z+.21,.72,.98,.025,'#c1d8c8',.006);sphere(g,.32,.85,z+.25,.025,.025,.025,'#edd399');
 box(g,0,2.39,z+.12,w*.76,.29,.10,ink,.025);
 // Illustrated shop emblem: a flower, open book, or golden loaf.
 if(style===0){for(let i=0;i<5;i++){const a=i*Math.PI*2/5;sphere(g,Math.cos(a)*.08,2.39+Math.sin(a)*.08,z+.19,.06,.06,.022,'#f5d7a4');}sphere(g,0,2.39,z+.22,.04,.04,.016,'#cc8f5e');}
 else if(style===1){for(const s of [-1,1]){const book=box(g,s*.09,2.39,z+.20,.16,.18,.025,'#f6e4bd',.006);book.rotation.z=s*.10;}}
 else{sphere(g,0,2.39,z+.20,.23,.095,.026,'#f6d293');for(const x of [-.1,0,.1]){const cut=box(g,x,2.40,z+.23,.018,.10,.012,'#c4905f',.006);cut.rotation.z=-.35;}}
 for(let i=0;i<7;i++){const awning=box(g,(i-3)*w/7,2.13,z+.38,w/7,.08,.75,i%2?'#fff0d2':ink,.01);awning.rotation.x=.13;box(g,(i-3)*w/7,2.04,z+.76,w/7,.16,.05,i%2?'#fff0d2':ink,.012);}
}

function bar(g:T.Group,a:T.Vector3,b:T.Vector3,r:number,color:string){const delta=b.clone().sub(a);const m=mesh(new T.CylinderGeometry(r,r,delta.length(),8),mat(color),0,0,0,g);m.position.copy(a).add(b).multiplyScalar(.5);m.quaternion.setFromUnitVectors(new T.Vector3(0,1,0),delta.normalize());}
export function bicycle(parent:T.Group,x:number,z:number,color:string,angle=0){
 const g=new T.Group();g.position.set(x,-.12,z);g.scale.setScalar(1.4);g.rotation.y=angle;parent.add(g);
 for(const xx of [-.40,.40]){mesh(new T.TorusGeometry(.25,.028,6,18),mat('#52665d'),xx,.25,0,g);for(let i=0;i<4;i++){const a=i*Math.PI/4;bar(g,new T.Vector3(xx-Math.cos(a)*.23,.25-Math.sin(a)*.23,0),new T.Vector3(xx+Math.cos(a)*.23,.25+Math.sin(a)*.23,0),.006,'#b8c6b2');}}
 const points=[[-.4,.25,0],[-.13,.60,0],[0,.25,0],[.29,.60,0],[.4,.25,0]].map(v=>new T.Vector3(...v as [number,number,number]));
 for(const [a,b] of [[0,1],[1,2],[2,0],[1,3],[3,2],[3,4]])bar(g,points[a],points[b],.025,color);
 box(g,-.14,.67,0,.20,.05,.11,'#755b45',.02);bar(g,points[3],new T.Vector3(.26,.78,0),.018,color);box(g,.25,.79,0,.055,.035,.30,'#586f64',.01);
 box(g,.41,.65,0,.22,.18,.22,'#d7b888',.025);
}

export function streetDetails(g:T.Group){
 // Connected sidewalks and a visible corner establish a street block, not isolated houses.
 box(g,-6.03,-.22,-.1,1.4,.20,24,'#e4dfc9',.02);
 box(g,0,-.22,-7.52,12.4,.20,1.35,'#e4dfc9',.02);
 box(g,-12,-.22,12.05,8,.20,1.55,'#e4dfc9',.02);
 for(let x=-16;x<17;x+=1.1){box(g,x,-.112,12.05,.012,.006,1.45,'#c8c8ae',0);}
 for(let z=-10;z<7;z+=1.1){box(g,9.07,-.112,z,1.3,.006,.012,'#c8c8ae',0);box(g,-6.03,-.112,z,1.3,.006,.012,'#c8c8ae',0);}
 for(let i=0;i<5;i++)box(g,5.55+i*.57,-.198,6.48,.27,.01,1.18,'#f0e9cd',0);
 // Raised planted islands break the junction's large grey surface.
 for(const x of [-5.9,9.05]){box(g,x,-.065,7.15,.8,.12,.9,'#e8dcc3',.13);box(g,x,.01,7.15,.65,.07,.72,'#8ba875',.11);sphere(g,x,.22,7.15,.36,.23,.37,'#8eae77');}
 bicycle(g,-4.65,4.95,'#b98764',Math.PI/2);bicycle(g,9.1,.3,'#729c98',Math.PI/2);
 // Shop-side parcel crate and corner postbox are outside all café routes.
 box(g,-5.92,.43,5.6,.43,.86,.40,'#b87961',.07);box(g,-5.92,.62,5.81,.27,.045,.025,'#584e40',.008);
 box(g,10.2,.12,5.5,.52,.48,.42,'#bd9c71',.03);box(g,10.25,.43,5.5,.44,.14,.34,'#dfc394',.025);
 // A small kiosk across the road gives the café an inhabited opposite frontage.
 box(g,-3.5,.47,12.9,1.8,1.16,1.15,'#82977b',.07);box(g,-3.5,1.10,12.9,2,.13,1.34,'#f2d5a5',.04);
 box(g,-3.5,.67,12.29,1.4,.52,.035,'#b8d1bb',.012);
 for(let i=0;i<5;i++)box(g,-4.03+i*.27,.67,12.25,.20,.35,.025,['#e6c78e','#edbaa4','#c7d4b1'][i%3],.006);
}
