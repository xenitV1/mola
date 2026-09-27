import * as T from 'three';
import {box,cyl,sphere,mesh,mat,mergeParts,person,type Person} from './models';
import {shopfront,streetDetails} from './street-life';

function tree(parent:T.Group,x:number,z:number,size=1,palm=false){
 const g=new T.Group();g.position.set(x,-.08,z);g.scale.setScalar(size);parent.add(g);
 cyl(g,0,.49,0,.13,.19,.95,'#b69c72',10);cyl(g,0,1.05,0,.072,.11,1.1,'#826143',10);
 if(palm){for(let i=0;i<7;i++){const a=i*Math.PI*2/7;const leaf=sphere(g,Math.cos(a)*.40,1.69,Math.sin(a)*.40,.53,.10,.19,i%2?'#759357':'#5e8051');leaf.rotation.y=-a;leaf.rotation.z=Math.cos(a)*.25;}}
 else{sphere(g,0,1.53,0,.57,.63,.53,'#8aa371');sphere(g,-.29,1.45,.12,.37,.40,.35,'#749360');sphere(g,.24,1.68,-.12,.37,.43,.38,'#98af78');}
}
function lamp(parent:T.Group,x:number,z:number){cyl(parent,x,.95,z,.033,.055,2,'#52635a',10);cyl(parent,x,-.03,z,.17,.20,.15,'#69796a',12);box(parent,x,1.97,z,.22,.33,.22,'#efcc87',.035);cyl(parent,x,2.17,z,.05,.20,.12,'#52635a',10);}
function building(parent:T.Group,x:number,z:number,w:number,d:number,h:number,color:string,urban=false,style=2,rotation=0){
 const g=new T.Group();g.position.set(x,-.18,z);g.rotation.y=rotation;parent.add(g);
 box(g,0,h/2,0,w,h,d,color,.055);box(g,0,.20,0,w+.07,.40,d+.08,'#afbaa0',.02);
 box(g,0,h+.045,0,w+.21,.18,d+.20,urban?'#c1c9b8':'#a56c51',.045);
 if(!urban){for(const direction of [-1,1]){const roof=box(g,direction*w*.25,h+.40,0,w*.60,.10,d+.22,'#b77954',.01);roof.rotation.z=direction*-.48;}}
 const rows=Math.max(0,Math.floor((h-2.60)/1.15)),cols=Math.max(2,Math.floor(w/.9));
 for(let row=0;row<rows;row++)for(let col=0;col<cols;col++){
  const xx=(col-(cols-1)/2)*(w/(cols+.3)),yy=3.05+row*1.13;
  box(g,xx,yy,d/2+.03,.56,.70,.075,'#e7dbc0',0);box(g,xx,yy,d/2+.073,.45,.59,.025,urban?'#7faaa7':'#93aba0',0);
  box(g,xx,yy,d/2+.09,.025,.60,.025,'#d5d3b4',0);
 }
 // Back windows keep the opposite block inhabited when viewed from the café side.
 for(const side of [-1,1]){box(g,side*w*.28,1.25,-d/2-.03,w*.23,.94,.06,'#eadcc0',.015);box(g,side*w*.28,1.25,-d/2-.07,w*.19,.78,.025,'#a7beb0',.01);}
 for(let row=0;row<rows;row++)for(const side of [-1,1])box(g,side*w*.26,3.05+row*1.13,-d/2-.04,.58,.72,.04,'#b3c8b9',.012);
 for(let row=0;row<rows;row++)for(let j=0;j<2;j++){box(g,w/2+.03,3.05+row*1.13,(j-.5)*d*.48,.035,.68,.55,'#d6dfc9',0);box(g,w/2+.053,3.05+row*1.13,(j-.5)*d*.48,.02,.55,.42,'#88aaa1',0);}
 shopfront(g,w,d,style);
}
// Layout changes move street furniture without stretching individual models.
const streetX=(x:number)=>x>8.35?x+8.3:x>5.25?12.45+(x-5.25)*4.2/3.1:x>4.2?x+7.2:x;
function widenStreet(group:T.Group){for(const child of group.children){child.position.x=streetX(child.position.x);if(child.position.z>11.1)child.position.z+=.6;if(child.position.z>6.7)child.position.z+=7.5;}}
export function car(parent:T.Group,color:string){
 const g=new T.Group();parent.add(g);g.name='street-car';
 box(g,0,.55,0,1.66,.58,3.82,color,.22);
 box(g,0,1.06,-.22,1.45,.77,2.10,color,.18);
 box(g,0,1.10,.843,1.19,.48,.035,'#87ada9',.025);
 box(g,0,1.10,-1.285,1.16,.46,.025,'#87ada9',.018);
 for(const direction of [-1,1]){
  box(g,direction*.733,1.10,-.22,.018,.48,1.65,'#739c99',.011);
  box(g,direction*.748,1.10,-.22,.018,.53,.075,color,.006);
  box(g,direction*.88,.98,.62,.17,.13,.22,color,.035);
  for(const z of [-1.18,1.18]){
   const wheel=cyl(g,direction*.78,.285,z,.285,.285,.20,'#3b4945',16);wheel.rotation.z=Math.PI/2;
   const hub=cyl(g,direction*.888,.285,z,.15,.15,.02,'#bac4af',16);hub.rotation.z=Math.PI/2;
  }
  box(g,direction*.52,.61,1.918,.34,.15,.025,'#fff0bc',.025);
  box(g,direction*.52,.59,-1.919,.34,.13,.025,'#b56753',.020);
 }
 box(g,0,.38,1.945,1.10,.10,.06,'#ced0b6',.015);mergeParts(g,true);return g;
}

type StreetAnimal={root:T.Group;legs:T.Group[];wings:T.Group[];kind:'cat'|'dog'|'bird'};
/** Original low-poly neighbourhood animals; no downloaded or generated textures. */
function animal(parent:T.Group,kind:StreetAnimal['kind'],color:string):StreetAnimal{
 const root=new T.Group(),body=new T.Group(),legs:T.Group[]=[],wings:T.Group[]=[];root.name=`street-${kind}`;root.add(body);parent.add(root);
 if(kind==='bird'){
  sphere(body,0,.18,0,.10,.12,.18,color);sphere(body,0,.28,.12,.09,.09,.09,color);box(body,0,.27,.23,.05,.04,.08,'#dba16d',0);
  for(const side of [-1,1]){const wing=new T.Group();root.add(wing);sphere(wing,side*.14,.18,-.03,.14,.035,.12,color);mergeParts(wing,true);wings.push(wing);}
 }else{
  const dog=kind==='dog',size=dog?1.3:1;root.scale.setScalar(size);
  sphere(body,0,.36,0,.18,.20,.38,color);sphere(body,0,.52,.32,.19,.19,.18,color);sphere(body,0,.45,.48,.12,.08,.12,dog?'#ead2ab':'#f1d6b6');
  for(const side of [-1,1]){const ear=box(body,side*.12,dog?.58:.73,.30,.10,dog?.24:.17,.09,color,.025);ear.rotation.z=side*(dog?.15:-.17);sphere(body,side*.077,.56,.477,.017,.023,.012,'#344a3d');}
  const tail=cyl(body,.05,.51,-.40,.035,.065,.42,color,8);tail.rotation.x=-.7;
  for(const x of [-.12,.12])for(const z of [-.22,.24]){const leg=new T.Group();leg.position.set(x,.30,z);root.add(leg);cyl(leg,0,-.12,0,.05,.065,.26,color,8);mergeParts(leg,true);legs.push(leg);}
  if(dog)box(body,0,.40,.30,.37,.075,.08,'#709dac',.02);
 }
 mergeParts(body,true);return {root,legs,wings,kind};
}

export class CafeCity {
 root=new T.Group();districts:T.Group[]=[];cars:T.Group[]=[];walkers:Person[]=[];animals:StreetAnimal[]=[];
 private trafficTime=0;private active=-1;
 constructor(parent:T.Scene){
  this.root.name='neighbourhood';parent.add(this.root);const common=new T.Group();this.root.add(common);
  box(common,0,-.41,0,100,.20,100,'#c2d5a1',0);
  // Pavement meets the café doorstep; the roads remain outside the service floor.
  box(common,3.1,-.23,4.85,16.8,.24,21.2,'#e2dbc3',.04);
  box(common,3.1,-.105,7.02,16.8,.015,1.12,'#efe6ce',0);
  box(common,0,-.275,9.68,70,.12,4.20,'#a0b1a7',0);
  box(common,6.80,-.275,3.0,4.2,.12,35.0,'#a0b1a7',0);
  box(common,9.07,-.22,-1.2,1.42,.20,23,'#e4dfc9',.02);
  box(common,0,-.22,12.65,70,.20,2.75,'#e4dfc9',.02);
  for(let x=-17;x<=17;x+=2.4)box(common,x,-.207,9.68,1.12,.008,.06,'#d8dbbd',0);
  for(let z=-10;z<7;z+=2.3)box(common,6.80,-.207,z,.06,.008,1.08,'#d8dbbd',0);
  for(let i=0;i<6;i++)box(common,-2.65,-.199,7.89+i*.66,1.42,.009,.25,'#eeead0',0);
  const curb=new T.Group();curb.position.z=6.7;common.add(curb);for(let x=-4.7;x<=11.9;x+=.54)box(curb,x,-.085,7.55,.48,.06,.15,'#c1c4ac',.01);
  for(let z=-4.8;z<=6.9;z+=.65)box(common,5.29,-.085,z,.15,.06,.60,'#c1c4ac',.01);
  lamp(common,-4.7,6.7);lamp(common,4.80,5.15);lamp(common,9.03,-4.9);lamp(common,9.03,4.5);
  // Position the complete bench in final street coordinates. Remapping its
  // individual slats around the old z=6.7 boundary tore the bench in half.
  const bench=new T.Group();bench.name='forecourt-bench';bench.position.set(9.6,0,13.5);this.root.add(bench);
  for(let i=0;i<3;i++)box(bench,0,.45,(i-1)*.11,1.3,.07,.085,'#a98c63',.014);
  for(const x of [-.45,.45]){box(bench,x,.13,0,.075,.60,.38,'#5b7466',.01);box(bench,x,.75,.22,.075,.60,.07,'#5b7466',.01);}
  box(bench,0,.84,.23,1.35,.28,.07,'#a98c63',.025);mergeParts(bench,true);
  cyl(common,4.7,.26,6.65,.20,.18,.65,'#7e9980',14);cyl(common,4.7,.60,6.65,.21,.21,.06,'#637d68',14);
  for(const [x,z] of [[-4.8,-3.5],[-4.8,3.9],[4.65,-3.2],[10.3,12.5]])tree(common,x,z,1.05);
  // A clear garden setback keeps neighbouring roofs away from the café silhouette.
  for(const [x,z] of [[-6.1,1.9],[4.65,2.4],[-2.5,-7.2],[2.6,-7.2]]){
   box(common,x,-.08,z,.72,.10,1.5,'#efe3c5',.12);box(common,x,-.015,z,.60,.06,1.36,'#91b779',.1);
   for(let i=0;i<6;i++){const xx=x+(i%2?-.16:.16),zz=z-.5+Math.floor(i/2)*.45;cyl(common,xx,.11,zz,.015,.015,.20,'#72945a',6);sphere(common,xx,.23,zz,.10,.075,.10,i%3===0?'#efaf9a':i%3===1?'#ffe6a4':'#fff2dc');}
  }
  streetDetails(common);widenStreet(common);curb.position.z=7.5;mergeParts(common,true);
  // Connected outer blocks and a small public garden fill the neighbourhood view.
  const outer=new T.Group();outer.name='outer-city-blocks';this.root.add(outer);
  box(outer,-15,-.275,2,4.2,.12,42,'#a0b1a7',0);box(outer,2,-.275,-16,70,.12,4.2,'#a0b1a7',0);
  for(const x of [-18,-12])box(outer,x,-.22,0,1.6,.20,38,'#e4dfc9',0);
  for(const z of [-19,-13])box(outer,1,-.22,z,65,.20,1.6,'#e4dfc9',0);
  for(let z=-14;z<21;z+=3)box(outer,-15,-.207,z,.06,.008,1.2,'#e2dfc7',0);
  for(let x=-30;x<31;x+=3)box(outer,x,-.207,-16,1.2,.008,.06,'#e2dfc7',0);
  for(const [x,z,w,h,color] of [[-23,-8,6,5,'#d5bd9c'],[-23,3,6,4,'#aec5b2'],[-23,14,6,4.7,'#d9bdac'],[-7,-25,7,5,'#a8c2bb'],[4,-25,7,4,'#ddc3a2'],[17,-25,7,5,'#c3c7a9'],[25,-7,7,4.6,'#cbbca8'],[25,7,7,4,'#b7c8b0'],[-20,27,7,5,'#d6c0a3'],[9,27,7,4,'#c9bba7']] as const)building(outer,x,z,w,5,h,color,false,Math.abs(Math.round(x))%3);
  box(outer,-6,-.18,24,10,.2,7,'#c4d5a5',.1);box(outer,-6,-.065,24,1.2,.02,7,'#e9dfbd',0);
  for(const [x,z] of [[-10,22],[-2,22],[-10,26],[-2,26],[-18,-11],[-12,-10],[19,-12],[19,11]])tree(outer,x,z,1.4);
  cyl(outer,-6,.03,24,1.2,1.2,.18,'#e0d0ab',24);cyl(outer,-6,.16,24,.98,.98,.10,'#92bdb7',24);cyl(outer,-6,.46,24,.13,.23,.60,'#d3c6a6',16);sphere(outer,-6,.84,24,.20,.16,.20,'#c0d9d0');
  for(const x of [-8,-4]){box(outer,x,.44,26,1.6,.1,.5,'#bc956d');box(outer,x,.79,26.22,1.6,.4,.08,'#bc956d');}
  mergeParts(outer,true);
  for(let index=0;index<3;index++){
   const g=new T.Group();g.name=['city-neighbourhood','city-business','city-seafront'][index];this.root.add(g);this.districts.push(g);
   if(index===0){
    building(g,-9.1,-3.8,3.2,4,3.25,'#d4b48e',false,0,Math.PI/2);building(g,-2.1,-10.3,4.8,3.3,3.1,'#bac397',false,1);building(g,3.05,-10.2,3.1,3.2,3.65,'#cead89');building(g,11.4,-4.1,3.0,4.5,3.2,'#d5bc91',false,2,-Math.PI/2);
    building(g,-8.65,2.5,3,3.4,2.85,'#e3c5a2',false,2,Math.PI/2);building(g,11.6,3.3,3.2,3.7,2.85,'#b9caae',false,0,-Math.PI/2);
    building(g,1.8,15.1,4,3.3,2.85,'#d6b5a0',false,1,Math.PI);building(g,-8.6,15.0,3.8,3.2,2.85,'#c6cea9',false,0,Math.PI);
    for(const [x,z] of [[9.1,-1.3],[9.1,5.8],[-5,6.2]])tree(g,x,z,1.15);
   }else if(index===1){
    building(g,-9.1,-4.2,3.2,4.6,5.6,'#b1c3b8',true);building(g,-2.1,-10.7,4.7,3.8,4.8,'#c9c9b0',true);building(g,3.1,-10.6,3.6,3.7,6.2,'#9bb9b1',true);building(g,11.1,-4.4,3.1,4.4,5.1,'#b2c7b8',true);
    box(g,9.2,.91,2.6,.15,1.8,2.5,'#788f80',.01);box(g,9.2,1.91,2.6,1.4,.13,2.8,'#879e8d',.03);box(g,9.0,.37,2.6,.40,.12,2.1,'#c2c8ad',.02);
    tree(g,9.1,-1.5,.95);tree(g,-4.8,5.9,.95);
    building(g,-8.7,2.6,3.2,3.6,3.8,'#cbd0b7',true,1,Math.PI/2);building(g,1.8,15.1,4.2,3.2,3.8,'#a8c2bb',true,2,Math.PI);
   }else{
    building(g,-9.1,-4.0,3.2,4.1,2.8,'#e2cfaa');building(g,-1.8,-10.2,4.5,3.2,2.55,'#dce1c7');building(g,3.2,-10.2,3.4,3.1,2.8,'#bcd3bb');
    box(g,16,-.31,-1.4,13,.10,23,'#88bdb9',0);box(g,9.6,-.18,-1.4,.45,.16,23,'#e5dabc',0);
    for(let z=-11;z<10;z+=1.5){cyl(g,9.65,.28,z,.055,.055,.85,'#e5dfc3',8);box(g,9.65,.49,z,.045,.05,1.55,'#d8d7b7',.006);}
    for(let z=-10;z<9;z+=2.5)box(g,11+(z%3)*.3,-.249,z,1.8,.007,.065,'#b4d6cc',0);
    for(const [x,z] of [[9.0,-3.1],[9.0,3.0],[-4.8,5.9]])tree(g,x,z,1.18,true);
    const boat=new T.Group();boat.position.set(10.6,-.18,5.9);g.add(boat);sphere(boat,0,0,0,.42,.21,1.1,'#f2e4be');box(boat,0,.09,0,.51,.035,1.31,'#bc9571',.015);cyl(boat,0,.76,0,.035,.035,1.6,'#f0dfb6',8);
    building(g,-8.7,2.6,3.1,3.5,2.8,'#e8c8af',false,0,Math.PI/2);building(g,1.8,15.1,3.8,3.2,2.8,'#b6d2c1',false,2,Math.PI);
   }
   widenStreet(g);mergeParts(g,true);g.visible=index===0;
  }
  for(const color of ['#ca9171','#8ea9a2','#dec290','#b89592','#8aa7b1'])this.cars.push(car(this.root,color));
  const parked=car(this.root,'#d4b674');parked.position.set(13.50,-.207,-2.1);parked.rotation.y=Math.PI;
  for(let i=0;i<10;i++){const walker=person(this.root,[3,5,1,4,2,0][i%6],'customer');walker.root.scale.setScalar(.96);this.walkers.push(walker);}
  for(const [kind,color] of [['cat','#c49b76'],['cat','#a2a6a0'],['dog','#caa477'],['bird','#8b9fa4'],['bird','#b5b9ab'],['bird','#97a4af']] as const)this.animals.push(animal(this.root,kind,color));
 }
 update(branch:number,time:number,motion:boolean){
  if(branch!==this.active){this.active=branch;this.districts.forEach((g,i)=>g.visible=i===branch);}
  if(motion)this.trafficTime=time;const clock=this.trafficTime;
  this.cars.forEach((car,i)=>{
   if(i===2){car.position.set(15.60,-.207,(clock*1.35)%56-28);car.rotation.y=0;return;}
   if(i===3){car.position.set(-14,-.207,28-(clock*1.25+13)%56);car.rotation.y=Math.PI;return;}
   if(i===4){car.position.set((clock*1.4+10)%62-31,-.207,-17.05);car.rotation.y=Math.PI/2;return;}
   const progress=((clock*1.35+i*29)%62)-31;car.position.set(i?-progress:progress,-.207,i?18.23:16.13);car.rotation.y=i?-Math.PI/2:Math.PI/2;
  });
  this.walkers.forEach((p,i)=>{
   const phase=(clock*.92+i*3.7)%24,forward=phase<12,progress=forward?phase-6:18-phase;
   if(i<2)p.root.position.set(progress,-.185,14.52+i*.20);
   else if(i<4)p.root.position.set(i===2?17.34:-6.03,-.185,progress);
   else if(i<6)p.root.position.set(progress*1.3,-.185,-12.6+(i-4)*.3);
   else if(i<8)p.root.position.set(-11.75+(i-6)*.3,-.185,progress*1.6);
   else p.root.position.set(-6+progress*.45,-.185,22.5+(i-8)*2.7);
   const horizontal=i<2||i===4||i===5||i>=8;p.root.rotation.y=horizontal?(forward?Math.PI/2:-Math.PI/2):(forward?0:Math.PI);
   for(let leg=0;leg<2;leg++){const swing=Math.sin(clock*6+i+leg*Math.PI)*.32;p.legs[leg].rotation.x=motion?swing:0;p.knees[leg].rotation.x=motion?Math.max(0,-swing)*.5:0;p.arms[leg].rotation.x=motion?-swing*.6:0;}
  });
  this.animals.forEach((pet,i)=>{
   const phase=(clock*.55+i*2)%12,forward=phase<6,progress=forward?phase:12-phase;
   if(i===0)pet.root.position.set(-5.1,-.18,1+progress);
   else if(i===1)pet.root.position.set(-8+progress*.45,-.18,25.4);
   else if(i===2)pet.root.position.set(-12.35,-.18,-5+progress*1.5);
   else pet.root.position.set(-.6+(i-3)*.6+Math.sin(clock*.32+i)*.3,-.18,13.4+Math.cos(clock*.27+i)*.23);
   pet.root.rotation.y=i===1?(forward?Math.PI/2:-Math.PI/2):(forward?0:Math.PI);
   pet.legs.forEach((leg,j)=>leg.rotation.x=motion?Math.sin(clock*7+j*Math.PI/2)*.28:0);
   pet.wings.forEach((wing,j)=>wing.rotation.z=motion?Math.sin(clock*4+i)*.12*(j?1:-1):0);
  });
 }
}
