import {ROOM} from '../game/config';
import * as T from 'three';
import {box,cyl,sphere,plant,mat,mergeParts,gold,COLORS as C} from './models';
import {FLOOR_ENDS,type Decoration} from '../game/decor';
// Modules are created once. Buying floor space reveals real floor, wall and
// frontage sections; revisiting branches does not rebuild GPU resources.
export class CafeInterior {
 bands:T.Group[]=[];floors:T.Group[][]=[];fronts:T.Group[]=[];frontPlants:T.Group[]=[];stars:T.Mesh[][]=[];garden=new T.Group();greenery=new T.Group();flowers=new T.Group();reading=new T.Group();sideboard=new T.Group();
 constructor(parent:T.Group){
  const starShape=new T.Shape();for(let i=0;i<10;i++){const a=Math.PI/2+i*Math.PI/5,r=i%2?.075:.155;const x=Math.cos(a)*r,y=Math.sin(a)*r;i?starShape.lineTo(x,y):starShape.moveTo(x,y);}starShape.closePath();const starGeometry=new T.ShapeGeometry(starShape);
  for(let index=0;index<3;index++){
   const begin=index?FLOOR_ENDS[index-1]:-4.9,end=FLOOR_ENDS[index],depth=end-begin,center=(begin+end)/2;
   const band=new T.Group();band.name=`room-band-${index}`;parent.add(band);this.bands.push(band);
   box(band,ROOM.center,-.22,center,ROOM.width+.3,.40,depth,C.bark,.045);
   box(band,-4.15,.55,center,.20,1.3,depth,C.cream,.035);box(band,-4.02,.45,center,.08,.92,depth-.04,'#697044',.015);
   for(let z=begin+.20;z<end;z+=.48)box(band,-3.96,.43,z,.05,.82,.035,'#485434',0);
   box(band,-3.96,.94,center,.12,.12,depth,C.bark,.012);box(band,-4,1.24,center,.25,.20,depth,C.bark,.015);
   const railStart=Math.max(begin,-1);if(end>railStart)box(band,ROOM.right-.13,.4,(railStart+end)/2,.18,.70,end-railStart,C.sageDark,.035);
   mergeParts(band);
   const wood=new T.Group(),tile=new T.Group(),concrete=new T.Group(),terracotta=new T.Group();concrete.name=`concrete-floor-${index}`;terracotta.name=`terracotta-floor-${index}`;wood.name=`oak-floor-${index}`;tile.name=`tile-floor-${index}`;parent.add(wood,tile,concrete,terracotta);this.floors.push([wood,tile,concrete,terracotta]);
   box(concrete,ROOM.center,.03,center,ROOM.width,.08,depth,'#b5af9e',0);
   box(terracotta,ROOM.center,.03,center,ROOM.width,.08,depth,'#e5d4b1',0);
   let stoneRow=0;for(let z=begin+.16;z<end-.16;z+=.88,stoneRow++)for(let x=-3.9,col=0;x<ROOM.right-.16;x+=.9,col++){const w=Math.min(.88,ROOM.right-.16-x),h=Math.min(.86,end-.16-z);if(w>.02&&h>.02)box(terracotta,x+w/2,.077,z+h/2,w,.012,h,['#b76b4d','#c88661','#cf9570'][(col+stoneRow*2)%3],0);}
   mergeParts(terracotta,true);
   box(wood,ROOM.center,-.02,center,ROOM.width,.08,depth,'#986232',0);
   const woods=['#b78049','#bc8851','#c08d55','#b5844c','#bd8b54'];let row=0;
   for(let start=begin;start<end;start+=.42,row++){
    const h=Math.min(.42,end-start),offset=(row%2)*1.019;
    for(let col=0;col<9;col++){const left=Math.max(-4.075,-4.075+col*2.038-offset),right=Math.min(ROOM.right-.025,-4.075+(col+1)*2.038-offset);if(right-left>.03)box(wood,(left+right)/2,.027,start+h/2,right-left-.013,.065,h-.011,woods[(row*3+col*2)%5],.005);}
   }
   box(tile,ROOM.center,.03,center,ROOM.width,.055,depth,'#bfb599',0);row=0;
   for(let z=begin;z<end;z+=.52,row++)for(let col=0;col<29;col++){const left=-4.075+col*.51,w=Math.min(.499,ROOM.right-.025-left),h=Math.min(.52,end-z)-.013;box(tile,left+w/2,.057,z+h/2,w,.011,h,(col+row)%2?'#eee4cd':'#abb991',0);}
   mergeParts(wood);mergeParts(tile,true);
   const front=new T.Group();front.name=`frontage-${index}`;parent.add(front);this.fronts.push(front);
   box(front,-1.6,.077,end-.65,1.45,.055,.83,C.sage,.035);
   const frontHeight=index===0?.44:.70;
   box(front,4.55,.07+frontHeight/2,end-.35,11.1,frontHeight,.30,C.sageDark,.035);
   box(front,4.55,index===0?.30:.49,end-.16,1.75,index===0?.30:.46,.075,C.bark,.04);mergeParts(front);
   const stars:T.Mesh[]=[];for(let i=0;i<3;i++){const star=new T.Mesh(starGeometry,mat('#786340'));star.position.set(4.1+i*.45,index===0?.30:.49,end-.102);front.add(star);stars.push(star);}this.stars.push(stars);
   const pots=new T.Group();pots.name=`front-plants-${index}`;front.add(pots);this.frontPlants.push(pots);for(let x=-.4;x<10.1;x+=1.5)plant(pots,x,frontHeight-.09,end-.37,index===0?.4:.55);
   if(index>0){plant(pots,9.65,0,end-.95,1.2);plant(pots,-3.48,0,end-2.25,.9);}mergeParts(pots,true);
  }
  parent.add(this.garden);this.garden.name='hanging-garden';
  for(const [x,z] of [[9.45,-4.10],[-3.57,.28],[9.85,1.15]]){
   cyl(this.garden,x,3.17,z,.014,.014,.60,'#a48859',8);cyl(this.garden,x,2.83,z,.24,.16,.30,'#b88452',14);
   for(let i=0;i<7;i++){const a=i*2.4;const leaf=sphere(this.garden,x+Math.sin(a)*.18,2.62-(i%3)*.14,z+Math.cos(a)*.16,.105,.23,.08,i%2?'#8ba452':'#56793a');leaf.rotation.z=Math.sin(a)*.4;}
   for(let i=0;i<3;i++)sphere(this.garden,x+Math.sin(i*2)*.17,2.86,z+Math.cos(i*2)*.17,.065,.060,.065,'#e5b76f');
  }
  mergeParts(this.garden,true);
  this.greenery.name='potted-greenery';this.flowers.name='flower-boxes';this.reading.name='reading-shelf';this.sideboard.name='tea-sideboard';parent.add(this.greenery,this.flowers,this.reading,this.sideboard);
  plant(this.greenery,2.45,1.1,-4.03,.6);plant(this.greenery,-.1,1.1,-4,.5);plant(this.greenery,8.2,1.1,-4.03,.55);plant(this.greenery,9.55,0,-3.6,1.4);mergeParts(this.greenery,true);
  for(const x of [1.35,7.15]){
   box(this.flowers,x,1.22,-4.02,2.45,.29,.38,'#b76b4d',.035);box(this.flowers,x,1.37,-4.02,2.30,.025,.29,'#544533',0);
   for(let i=0;i<9;i++){const xx=x-1+i*.25,y=1.65+(i%3)*.08;cyl(this.flowers,xx,1.52,-4.02,.012,.012,.35,'#56793a',6);sphere(this.flowers,xx+.045,1.49,-3.99,.1,.055,.035,'#7b9444');for(let j=0;j<5;j++){const a=j*Math.PI*2/5;sphere(this.flowers,xx+Math.cos(a)*.07,y,-4.02+Math.sin(a)*.07,.066,.036,.066,i%2?'#edb1a0':'#e9c666');}sphere(this.flowers,xx,y+.025,-4.02,.04,.025,.04,'#a96334');}
  }mergeParts(this.flowers,true);
  // Wall-side accents stay behind the dining route and add no invisible seats.
  box(this.reading,9.65,1.35,-4.24,.92,2.55,.34,C.bark,.025);
  for(const y of [.32,1.08,1.84,2.55])box(this.reading,9.65,y,-4.01,1.02,.09,.60,C.woodLight,.015);
  for(let row=0;row<3;row++)for(let i=0;i<5;i++)box(this.reading,9.3+i*.16,.61+row*.76,-3.98,.12,.42+(i%2)*.1,.32,['#6d8b79','#bb7755','#d1b47a'][i%3],.01);
  cyl(this.reading,8.91,1.63,-4.02,.023,.03,.95,'#b69a58',10);cyl(this.reading,8.91,2.08,-4.02,.12,.29,.28,'#d6b57d',16);mergeParts(this.reading,true);
  box(this.sideboard,9.3,.58,-4.08,1.60,1.05,.61,'#64857a',.045);box(this.sideboard,9.3,1.15,-4.08,1.76,.12,.72,C.woodLight,.035);
  for(const x of [8.91,9.69]){box(this.sideboard,x,.61,-3.755,.64,.76,.035,'#91ac98',.025);cyl(this.sideboard,x,.75,-3.718,.03,.03,.055,'#d8b875',8);}
  cyl(this.sideboard,9.25,1.24,-4.05,.40,.40,.035,'#d6b57d',20);sphere(this.sideboard,9.25,1.40,-4.05,.18,.17,.15,'#f3d8ac');cyl(this.sideboard,9.25,1.57,-4.05,.07,.1,.045,'#64857a',12);
  for(const x of [8.82,9.67]){cyl(this.sideboard,x,1.25,-4.02,.13,.13,.025,'#f3d8ac',16);cyl(this.sideboard,x,1.33,-4.02,.085,.065,.13,'#f3d8ac',16);}mergeParts(this.sideboard,true);
 }
 update(space:number,decor:Decoration,mastery:number){
  this.bands.forEach((band,i)=>band.visible=i<=space);this.fronts.forEach((front,i)=>front.visible=i===space);
  this.floors.forEach((styles,i)=>styles.forEach((group,style)=>group.visible=i<=space&&style===({oak:0,tile:1,concrete:2,terracotta:3}[decor.floor])));
  this.stars.forEach(stars=>stars.forEach((star,i)=>star.material=i<mastery?gold:mat('#786340')));this.garden.visible=decor.plants==='lush';this.greenery.visible=decor.plants==='simple'||decor.plants==='lush';this.frontPlants.forEach(g=>g.visible=decor.plants!=='none');this.flowers.visible=decor.plants==='flowers';this.reading.visible=decor.furniture==='reading';this.sideboard.visible=decor.furniture==='sideboard';
 }
}
