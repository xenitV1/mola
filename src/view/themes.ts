import * as T from 'three';
import {box,sphere,cyl,plant,mesh,mat,mergeParts,COLORS} from './models';

function disc(parent:T.Group,x:number,y:number,z:number,r:number,color:string){
 return mesh(new T.CircleGeometry(r,24),mat(color),x,y,z,parent);
}
function flower(parent:T.Group,x:number,y:number,z:number,color:string){
 for(let i=0;i<5;i++){const a=i*Math.PI*2/5;sphere(parent,x+Math.cos(a)*.065,y,z+Math.sin(a)*.065,.055,.032,.055,color);}
 sphere(parent,x,y+.015,z,.035,.035,.035,'#e9b947');
}

/** Original district set dressing, outside the shared traversable service aisles. */
export function districtDecorations(parent:T.Group){
 return ['mahalle','ofis','sahil'].map((id,index)=>{
  const group=new T.Group();group.name=`district-${id}`;parent.add(group);
  // A miniature view beyond the real window, framed by its existing wood mullions.
  box(group,1.35,2.12,-4.38,2.91,2.07,.015,['#c9d6a5','#bdd5d9','#b2dadd'][index],0);
  if(index===0){
   box(group,1.35,1.47,-4.355,2.9,.77,.02,'#8baf67',0);
   for(const [x,c] of [[.3,'#e9c28e'],[1.36,'#deb68b'],[2.39,'#dfc9a0']] as const){
    box(group,x,1.87,-4.34,.72,.73,.025,c,.015);
    const roof=box(group,x,2.32,-4.33,.62,.62,.024,'#a57654',.01);roof.rotation.z=Math.PI/4;
    for(const dx of [-.17,.17])box(group,x+dx,1.99,-4.30,.12,.20,.03,'#6f8c7d',.01);
   }
   // Botanical frame and a small shelf of books beside the till.
   box(group,-.85,2.29,-4.37,.86,1.18,.06,COLORS.wood,.02);
   box(group,-.85,2.29,-4.33,.70,1.02,.025,'#f5dfb9',.01);
   for(let i=0;i<5;i++){const leaf=sphere(group,-.85+(i%2?.13:-.13),2.02+i*.105,-4.30,.16,.08,.023,i%2?'#8b9e58':'#536d40');leaf.rotation.z=i%2?.5:-.5;}
   for(let i=0;i<4;i++)box(group,-3.50,1.24+i*.065,1.27,.42,.058,.54,['#a65b3a','#e2c388','#6b825e','#c59c66'][i],.012);
  }else if(index===1){
   box(group,1.35,1.3,-4.35,2.9,.43,.02,'#a6b9ad',0);
   for(let i=0;i<6;i++){
    const x=.18+i*.45,height=.68+(i%3)*.25;
    box(group,x,1.43+height/2,-4.33,.38,height,.025,i%2?'#839b9b':'#91a9a5',.015);
    for(let row=0;row<3;row++)for(const dx of [-.08,.08])box(group,x+dx,1.67+row*.22,-4.30,.055,.09,.02,'#e8e7be',0);
   }
   // A readable clock silhouette identifies the morning-rush café without words.
   disc(group,-.85,2.63,-4.37,.40,'#746047');disc(group,-.85,2.63,-4.34,.345,'#f6e9c9');
   for(let i=0;i<12;i++){const a=i*Math.PI/6;sphere(group,-.85+Math.sin(a)*.285,2.63+Math.cos(a)*.285,-4.31,.02,.02,.008,'#615340');}
   box(group,-.85,2.74,-4.30,.028,.23,.025,'#534936',.009);
   const hand=box(group,-.76,2.67,-4.29,.20,.025,.028,'#534936',.008);hand.rotation.z=.45;
   // Takeaway cups and a little teal desk organiser.
   box(group,-3.48,1.32,1.3,.45,.35,.48,'#527f7a',.03);
   for(let i=0;i<3;i++){cyl(group,-3.46,1.59+i*.035,1.3,.12,.095,.12,'#f5e7c4',12);}
  }else{
   box(group,1.35,1.68,-4.35,2.9,1.15,.02,'#79babb',0);
   box(group,1.35,1.35,-4.33,2.9,.39,.02,'#e5ca95',0);
   disc(group,2.26,2.78,-4.34,.19,'#fff0b1');
   for(let i=0;i<5;i++)box(group,.26+i*.52,1.80+(i%2)*.16,-4.31,.34,.025,.02,'#b9e0d2',.01);
   const ring=mesh(new T.TorusGeometry(.30,.085,8,32),mat('#e5c693'),-.85,2.61,-4.32,group);
   for(let i=0;i<4;i++){const patch=mesh(new T.TorusGeometry(.30,.088,8,8,Math.PI/5),mat('#b56f48'),-.85,2.61,-4.30,group);patch.rotation.z=i*Math.PI/2;}
   // Palm at the outside corner; fronds stay above the route, trunk stays beyond it.
   cyl(group,3.47,.88,4.3,.11,.17,1.76,'#a57d4d',12);
   for(let i=0;i<7;i++){const a=i*Math.PI*2/7;const leaf=sphere(group,3.47+Math.sin(a)*.35,1.94,4.3+Math.cos(a)*.35,.15,.10,.66,i%2?'#628545':'#819d55');leaf.rotation.y=a;leaf.rotation.x=.22;}
   cyl(group,3.47,.25,4.3,.30,.24,.5,'#c39c66');
   for(let i=0;i<8;i++)flower(group,-.6+i*.53,1.0,6.15,i%2?'#f6d99e':'#e69b68');
  }
  // The welcoming mat changes with each district but does not change collisions.
  box(group,-2.65,.115,5.36,1.82,.018,1.06,['#7e9659','#638984','#b9a272'][index],.02);
  box(group,-2.65,.129,5.36,1.59,.006,.84,['#8ba066','#729b96','#ccb989'][index],.01);
  const bean=sphere(group,-2.65,.143,5.36,.15,.018,.24,'#f5e3ba');bean.rotation.y=-.5;
  mergeParts(group,true);group.visible=false;return group;
 });
}
