import type {Menu} from '../game/config';
import {SEATING} from '../game/layout';
import {TABLE_TYPES,tableSeats,seatOffset,localSeat} from '../game/table-layout';
import * as T from 'three';
import {woodGrain,plasterGrain,contactShadow} from './materials';
import {RoundedBoxGeometry} from 'three/addons/geometries/RoundedBoxGeometry.js';
import {mergeGeometries} from 'three/addons/utils/BufferGeometryUtils.js';
export const COLORS={cream:'#f3d8ac',sage:'#647345',sageDark:'#364b32',wood:'#b9763e',woodLight:'#dca15e',bark:'#664327',terra:'#b55936',gold:'#ffc54a',skin:'#edb17c',ink:'#302218'};
const woods=new Set(['#b78049','#bc8851','#c08d55','#b5844c','#bd8b54','#b9763e','#dca15e','#664327','#bf854d','#c58e53','#c2925b','#d39a5b','#c1894e','#b89660','#b9955d','#c3a473']);
const mats=new Map<string,T.MeshStandardMaterial>();
export function mat(color:string,roughness=.72){const key=color+roughness;if(!mats.has(key)){const map=woods.has(color)?woodGrain():color===COLORS.cream?plasterGrain():null;mats.set(key,new T.MeshStandardMaterial({color,roughness,map}));}return mats.get(key)!;}
export const gold=new T.MeshStandardMaterial({color:'#f9bc3e',roughness:.33,metalness:.45});
export function mesh(g:T.BufferGeometry,m:T.Material,x=0,y=0,z=0,parent?:T.Object3D){const o=new T.Mesh(g,m);o.position.set(x,y,z);o.castShadow=true;o.receiveShadow=true;parent?.add(o);return o;}
export function box(p:T.Object3D,x:number,y:number,z:number,w:number,h:number,d:number,color:string|T.Material,r=.04){return mesh(r?new RoundedBoxGeometry(w,h,d,Math.max(w,h,d)<.3?1:2,Math.min(r,w/3,h/3,d/3)):new T.BoxGeometry(w,h,d),typeof color==='string'?mat(color):color,x,y,z,p);}
const sphereG=new T.SphereGeometry(1,16,12),smallSphereG=new T.SphereGeometry(1,12,8);
export function sphere(p:T.Object3D,x:number,y:number,z:number,sx:number,sy:number,sz:number,color:string|T.Material){const m=mesh(Math.max(sx,sy,sz)<.14?smallSphereG:sphereG,typeof color==='string'?mat(color):color,x,y,z,p);m.scale.set(sx,sy,sz);return m;}
export function cyl(p:T.Object3D,x:number,y:number,z:number,rt:number,rb:number,h:number,color:string|T.Material,seg=20){return mesh(new T.CylinderGeometry(rt,rb,h,seg),typeof color==='string'?mat(color):color,x,y,z,p);}
const painted=new T.MeshStandardMaterial({vertexColors:true,roughness:.72});
export function mergeParts(group:T.Group,paint=false){
 group.updateMatrixWorld(true);
 const buckets=new Map<T.Material,T.BufferGeometry[]>(),originals:T.Mesh[]=[];
 const inverse=new T.Matrix4().copy(group.matrixWorld).invert();
 group.traverse(o=>{
  if(!(o instanceof T.Mesh)||Array.isArray(o.material))return;
  let material=o.material;
  const geometry=o.geometry.index?o.geometry.toNonIndexed():o.geometry.clone();
  geometry.applyMatrix4(o.matrixWorld).applyMatrix4(inverse);
  if(paint&&material instanceof T.MeshStandardMaterial&&!material.map&&!material.transparent&&!material.metalness&&material.roughness===.72&&material.emissive.getHex()===0){
   if(material!==painted){
    const colors=new Float32Array(geometry.getAttribute('position').count*3);
    for(let i=0;i<colors.length;i+=3){colors[i]=material.color.r;colors[i+1]=material.color.g;colors[i+2]=material.color.b;}
    geometry.setAttribute('color',new T.BufferAttribute(colors,3));
   }
   material=painted;
  }
  const bucket=buckets.get(material)??[];bucket.push(geometry);buckets.set(material,bucket);originals.push(o);
 });
 for(const o of originals)o.removeFromParent();
 for(const [material,geometries] of buckets){const geometry=mergeGeometries(geometries);if(geometry)mesh(geometry,material,0,0,0,group);geometries.forEach(g=>g.dispose());}
}
// Small pooled ground marks. Scale conveys cleaning progress without allocating geometry per frame.
export function premisesDirt(parent:T.Object3D){
 const root=new T.Group(),spill=new T.Group(),litter=new T.Group();parent.add(root);root.add(spill,litter);spill.name='spill';litter.name='litter';
 for(const [x,z,r] of [[0,0,.29],[-.22,.06,.15],[.16,.18,.12],[.26,-.12,.055]])cyl(spill,x,.008,z,r,r,.012,'#79523e',14);
 cyl(spill,-.06,.016,.02,.16,.16,.005,'#a47951',14);
 const napkin=box(litter,-.13,.027,.04,.33,.028,.25,'#f1e3bc',.012);napkin.rotation.y=.45;
 const paper=box(litter,.18,.07,-.08,.15,.14,.23,'#dbc8a2',.022);paper.rotation.set(.3,-.35,.5);box(litter,.18,.14,-.07,.08,.018,.19,'#957559',.004);
 for(let i=0;i<3;i++)sphere(litter,-.23+i*.19,.025,.23-i*.025,.032,.017,.026,'#805b3f');
 mergeParts(spill,true);mergeParts(litter,true);root.traverse(o=>{if(o instanceof T.Mesh)o.castShadow=false;});root.visible=false;return root;
}
export function cup(p:T.Object3D,x:number,y:number,z:number,scale=1,color='#fff3d9',latte=true){const g=new T.Group();g.position.set(x,y,z);g.scale.setScalar(scale);p.add(g);cyl(g,0,.025,0,.23,.20,.04,color);cyl(g,0,.15,0,.15,.12,.23,color);cyl(g,0,.269,0,.132,.132,.008,'#60351d');const handle=mesh(new T.TorusGeometry(.095,.032,6,12),mat(color),.175,.16,0,g);if(latte){for(let i=0;i<4;i++){const milk=mesh(new T.TorusGeometry(.025+i*.019,.008,4,16,Math.PI*1.55),mat('#fbe9bc'),0,.278+i*.0003,-i*.01,g);milk.rotation.x=-Math.PI/2;milk.rotation.z=.7;}}mergeParts(g,true);return g;}
// Shared, recipe-specific presentation. Each order has one visible product model.
const productTemplates=new Map<Menu,T.Group>();
function productTemplate(kind:Menu){
 let template=productTemplates.get(kind);if(template)return template;
 template=new T.Group();
 if(kind==='espresso')cup(template,0,0,0,.86,'#b66b45',false);
 else if(kind==='latte'){
  cup(template,0,0,0,1,'#fff6df',false);
  cyl(template,0,.276,0,.132,.132,.012,'#d9ac74');
  for(let i=0;i<4;i++){const milk=mesh(new T.TorusGeometry(.026+i*.019,.009,4,16,Math.PI*1.55),mat('#fff5dc'),0,.285+i*.0003,-i*.01,template);milk.rotation.x=-Math.PI/2;milk.rotation.z=.7;}
 }else if(kind==='tea'){
  cup(template,0,0,0,.95,'#91ac85',false);cyl(template,0,.255,0,.12,.12,.01,'#b16d37');box(template,.18,.21,0,.08,.07,.008,'#f0d19a',.008);
 }else if(kind==='iced'||kind==='lemonade'){
  cyl(template,0,.19,0,.14,.10,.36,kind==='iced'?'#bd9770':'#ebd06e',16);cyl(template,0,.38,0,.15,.15,.025,'#f9ecc8',16);for(let i=0;i<3;i++)box(template,(i-1)*.07,.36,(i%2)*.06,.075,.06,.07,'#dfede1',.012);const straw=cyl(template,.07,.49,0,.015,.015,.26,kind==='iced'?'#799077':'#b67f61',8);straw.rotation.z=-.15;
 }else if(kind==='cheesecake'){
  cyl(template,0,.025,0,.23,.22,.03,'#f8ebce',20);cyl(template,0,.075,0,.16,.16,.07,'#bd925b',16);cyl(template,0,.155,0,.16,.16,.10,'#fff0c7',16);cyl(template,0,.21,0,.16,.16,.035,'#dc8075',16);sphere(template,.04,.26,.015,.065,.06,.05,'#c65249');
 }else{
  cup(template,-.105,0,-.015,.53,'#fff3d9',false);
  cyl(template,.115,.025,.025,.125,.115,.03,'#f7e4c1',20);
  const wedge=new T.Shape();wedge.moveTo(-.088,-.075);wedge.lineTo(.10,-.075);wedge.lineTo(-.055,.105);wedge.closePath();
  for(const [y,height,color] of [[.045,.035,'#81472d'],[.08,.023,'#f6db9e'],[.103,.035,'#925334'],[.138,.025,'#fff0d0']] as const){const geometry=new T.ExtrudeGeometry(wedge,{depth:height,bevelEnabled:true,bevelSize:.004,bevelThickness:.003,bevelSegments:1,steps:1});geometry.rotateX(-Math.PI/2);mesh(geometry,mat(color),.115,y,.025,template);}
  sphere(template,.10,.187,.04,.027,.034,.023,'#c84b39');sphere(template,.09,.216,.04,.023,.008,.016,'#608347');
 }
 mergeParts(template,true);template.traverse(o=>{if(o instanceof T.Mesh)o.userData.sharedProductGeometry=true;});productTemplates.set(kind,template);return template;
}
export function setProduct(group:T.Group,kind:Menu){if(group.userData.kind===kind)return;group.clear();group.add(productTemplate(kind).clone(true));group.userData.kind=kind;}
export function product(parent:T.Object3D,x:number,y:number,z:number,scale=1,kind:Menu='espresso'){const g=new T.Group();g.position.set(x,y,z);g.scale.setScalar(scale);parent.add(g);setProduct(g,kind);return g;}
export function plant(p:T.Object3D,x:number,y:number,z:number,s=1){const g=new T.Group();g.position.set(x,y,z);g.scale.setScalar(s);p.add(g);cyl(g,0,.2,0,.23,.16,.4,COLORS.terra);cyl(g,0,.405,0,.20,.20,.025,'#483422');for(let i=0;i<7;i++){const a=i*2.4;const leaf=sphere(g,Math.sin(a)*.18,.62+(i%3)*.1,Math.cos(a)*.17,.1,.33,.08,i%2?'#7b9444':'#455e30');leaf.rotation.z=Math.sin(a)*.75;leaf.rotation.x=Math.cos(a)*.65;}mergeParts(g);return g;}
function originalTable(p:T.Object3D,x:number,z:number){const g=new T.Group();g.position.set(x,0,z);p.add(g);cyl(g,0,.89,0,.69,.67,.12,COLORS.wood);cyl(g,0,.47,0,.10,.14,.8,COLORS.bark);for(const a of [0,Math.PI/2]){const b=box(g,0,.11,0,.95,.10,.13,COLORS.bark);b.rotation.y=a;}
for(const dx of [-SEATING.offset,SEATING.offset]){cyl(g,dx,.47,0,.31,.30,.1,COLORS.woodLight);for(const dz of [-.2,.2])for(const sx of [-.18,.18])box(g,dx+sx,.23,dz,.07,.46,.07,COLORS.bark);const back=box(g,dx+(dx<0?-.22:.22),.78,0,.11,.46,.6,COLORS.woodLight,.1);back.rotation.z=dx<0?.08:-.08;}mergeParts(g);const greenery=plant(g,.05,.96,-.03,.35);greenery.name='table-plants';const cushions=new T.Group();cushions.name='chair-cushions';g.add(cushions);for(const dx of [-SEATING.offset,SEATING.offset])cyl(cushions,dx,.555,0,.285,.28,.085,'#7f9b67',20);mergeParts(cushions,true);cushions.visible=false;return g;}
export function table(p:T.Object3D,x:number,z:number,tier=0){
 if(tier===0){const original=originalTable(p,x,z);original.userData.tier=0;original.userData.seats=2;return original;}
 const type=TABLE_TYPES[tier],g=new T.Group();g.position.set(x,0,z);p.add(g);g.userData.tier=tier;g.userData.seats=type.seats;g.userData.comfort=type.comfort;g.name=`table-tier-${tier}`;
 const upholstery=tier===1?'#88a28a':tier===2?'#b97e67':'#75988d',cream='#d8cbb0';
 // Separate low coffee surfaces, leaving the furniture silhouette unmistakably
 // a lounge. Their heights are shared with every visible customer's product.
 for(const zz of tier===3?[-.66,.66]:[0]){
  const surface=new T.Group();surface.name=`coffee-surface-${zz}`;g.add(surface);
  const depth=tier===3?1.18:type.depth;
  box(surface,0,type.tableTop-.055,zz,type.width,.11,depth,COLORS.woodLight,.13);
  for(const xx of [-1,1])for(const dz of [-1,1])box(surface,xx*(type.width/2-.20),(type.tableTop-.11)/2,zz+dz*(depth/2-.20),.085,type.tableTop-.11,.085,COLORS.bark,.02);
  mergeParts(surface,true);const greenery=plant(surface,0,type.tableTop+.015,zz,.23);greenery.name='table-plants';
 }
 if(tier>=2){
  const sofa=new T.Group();sofa.name='l-sofa';g.add(sofa);const left=tier===2?-1.15:-1.3,north=tier===2?-.65:-1,south=tier===2?1.55:1.9,right=tier===2?0:.52;
  // Two padded continuous benches join at a square corner. Individual seatpads
  // below retain the exact stable slot centres used by routing and occupancy.
  box(sofa,left,.34,(north-.38+south-.38)/2,.76,.30,south-north,upholstery,.09);
  box(sofa,(left+right)/2,.34,south,right-left+.76,.30,.76,upholstery,.09);
  box(sofa,left-.33,.79,(north+south)/2,.14,.52,south-north+.76,upholstery,.065);
  box(sofa,(left+right)/2,.79,south+.33,right-left+.76,.52,.14,upholstery,.065);
  // A small visible corner pillow bridges the L without inventing another seat.
  const pillow=box(sofa,left,.66,south,.42,.20,.42,cream,.09);pillow.rotation.y=.25;
  mergeParts(sofa,true);
 }
 const cushions=new T.Group();cushions.name='chair-cushions';cushions.userData.permanent=true;g.add(cushions);
 for(const id of tableSeats(0,tier)){
  const local=localSeat(id),seat=seatOffset(id,tier),sofa=tier===2?[0,2,5].includes(local):tier===3?[0,2,4,8,9].includes(local):false;
  const chair=new T.Group();chair.name=`chair-${id}`;chair.userData.type=sofa?'sofa-place':'armchair';chair.position.set(seat.x,0,seat.z);chair.rotation.y=seat.angle;g.add(chair);
  if(!sofa){
   const color=tier===1?upholstery:cream;
   box(chair,0,.39,0,.65,.23,.60,color,.095);box(chair,0,.82,-.255,.68,.47,.12,color,.09);
   for(const side of [-1,1]){box(chair,side*.30,.67,0,.10,.33,.60,color,.075);for(const zz of [-.22,.22])cyl(chair,side*.25,.18,zz,.037,.045,.28,COLORS.bark,8);}
  }else box(chair,0,.47,0,.63,.035,.61,upholstery,.04);
  const padColor=sofa?(tier===2?'#d8a087':'#a7bdb1'):tier===1?cream:'#e9d9bb';
  box(chair,0,.55,0,.59,.095,.55,padColor,.07);
  mergeParts(chair,true);
 }
 cushions.visible=true;return g;
}
export type Person={root:T.Group;body:T.Group;head:T.Group;eyes:T.Group;legs:T.Group[];knees:T.Group[];arms:T.Group[];tray:T.Group;bag:T.Group;crate:T.Group;cupHolders:T.Group[]};
// Sculpted tapered locks. The cross-section follows the curve so the hair
// reads as swept strands, with pointed ends instead of a row of round beads.
function strand(parent:T.Object3D,points:number[][],width:number,depth:number,color:string){
 const curve=new T.CatmullRomCurve3(points.map(v=>new T.Vector3(...v as [number,number,number])));
 const positions:number[]=[],uv:number[]=[],indices:number[]=[];const steps=10,sides=8;
 for(let i=0;i<=steps;i++){
  const t=i/steps,center=curve.getPoint(t),tangent=curve.getTangent(t).normalize();
  const side=new T.Vector3().crossVectors(tangent,new T.Vector3(0,0,1));if(side.lengthSq()<.001)side.set(1,0,0);side.normalize();
  const front=new T.Vector3().crossVectors(side,tangent).normalize();
  const taper=i===steps?.035:Math.pow(Math.sin((.16+t*.84)*Math.PI),.58);
  for(let j=0;j<=sides;j++){const a=j/sides*Math.PI*2;const v=center.clone().addScaledVector(side,Math.cos(a)*width*taper).addScaledVector(front,Math.sin(a)*depth*taper);positions.push(v.x,v.y,v.z);uv.push(t,j/sides);}
 }
 for(let i=0;i<steps;i++)for(let j=0;j<sides;j++){const a=i*(sides+1)+j,b=a+sides+1;indices.push(a,b,a+1,b,b+1,a+1);}
 const g=new T.BufferGeometry();g.setAttribute('position',new T.Float32BufferAttribute(positions,3));g.setAttribute('uv',new T.Float32BufferAttribute(uv,2));g.setIndex(indices);g.computeVertexNormals();return mesh(g,mat(color),0,0,0,parent);
}
function hairCap(parent:T.Group,color:string){
 const vertices:number[]=[],uv:number[]=[],indices:number[]=[];const around=28,rows=12;
 for(let row=0;row<=rows;row++)for(let col=0;col<=around;col++){
  const a=col/around*Math.PI*2,theta=row/rows*(1.72-.52*Math.cos(a));
  vertices.push(Math.sin(theta)*Math.sin(a)*.397,.065+Math.cos(theta)*.385,-.035+Math.sin(theta)*Math.cos(a)*.353);uv.push(col/around,row/rows);
 }
 for(let row=0;row<rows;row++)for(let col=0;col<around;col++){const a=row*(around+1)+col,b=a+around+1;indices.push(a,b,a+1,b,b+1,a+1);}
 const g=new T.BufferGeometry();g.setAttribute('position',new T.Float32BufferAttribute(vertices,3));g.setAttribute('uv',new T.Float32BufferAttribute(uv,2));g.setIndex(indices);g.computeVertexNormals();mesh(g,mat(color),0,0,0,parent);
}
function cheek(parent:T.Group,direction:number,skin:string){
 const pos:number[]=[],colors:number[]=[],uv:number[]=[],indices:number[]=[];
 const base=new T.Color(skin),pink=new T.Color('#dd8165');const count=16;
 const vertex=(x:number,y:number,strength:number,u:number,v:number)=>{const z=.339*Math.sqrt(Math.max(0,1-(x/.39)**2-(y/.375)**2))+.0015;pos.push(x,y,z);const c=base.clone().lerp(pink,strength);colors.push(c.r,c.g,c.b);uv.push(u,v);};
 vertex(direction*.222,-.132,.52,.5,.5);
 for(let ring=1;ring<=3;ring++)for(let j=0;j<=count;j++){const a=j/count*Math.PI*2,r=ring/3;vertex(direction*.222+Math.cos(a)*.075*r,-.132+Math.sin(a)*.042*r,(1-r)*.52,Math.cos(a)*r*.5+.5,Math.sin(a)*r*.5+.5);}
 for(let j=0;j<count;j++)indices.push(0,1+j,2+j);
 for(let ring=0;ring<2;ring++)for(let j=0;j<count;j++){const a=1+ring*(count+1)+j,b=a+count+1;indices.push(a,b,b+1,a,b+1,a+1);}
 const g=new T.BufferGeometry();g.setAttribute('position',new T.Float32BufferAttribute(pos,3));g.setAttribute('color',new T.Float32BufferAttribute(colors,3));g.setAttribute('uv',new T.Float32BufferAttribute(uv,2));g.setIndex(indices);g.computeVertexNormals();mesh(g,painted,0,0,0,parent);
}
export function person(parent:T.Object3D,tint=0,role='customer'):Person{
 const root=new T.Group();parent.add(root);root.name=`character-${role}-${tint}`;contactShadow(root,1.06,.84);
 const body=new T.Group();root.add(body);const worker=role!=='customer';
 const skin=['#efba89','#dbab80','#e9b68a','#ad7757','#f0c69a','#cb956f'][tint%6];
 const hair=['#59331e','#38271b','#392d24','#704327','#432c20','#292721'][tint%6];
 const hairLight=['#764728','#553721','#514032','#875433','#63412a','#41402c'][tint%6];
 const outfit=worker?(role==='supplier'?'#c29454':'#f5e8cf'):['#51775b','#d7a15e','#536b69','#cf9a3c','#b76038','#638079'][tint%6];
 const trousers=role==='player'?'#354653':['#46473b','#574b39','#354648','#4d4939','#594436','#3f4a44'][tint%6];
 const apronColor=role==='player'?'#a94f2d':role==='barista'?'#526333':role==='cleaner'?'#8e749d':role==='dishwasher'?'#5f939e':'#698343';
 const torso=new T.Group();body.add(torso);
 // Soft shoulders and a rounded waist, with a tailored collar and folded cuffs.
 box(torso,0,.83,0,.56,.61,.40,outfit,.14);
 cyl(torso,0,1.14,0,.105,.12,.16,skin);
 for(const direction of [-1,1]){const collar=box(torso,direction*.092,1.105,.184,.145,.15,.055,worker?'#fff1d8':outfit,.025);collar.rotation.z=direction*.5;}
 if(worker){
  box(torso,0,.74,.209,.423,.59,.057,apronColor,.055);
  box(torso,0,.566,.244,.27,.14,.023,apronColor,.025);
  box(torso,0,.639,.259,.25,.012,.012,'#ccb07a',.005);
  for(const x of [-.145,.145]){const strap=box(torso,x,1.025,.205,.062,.26,.035,apronColor,.012);strap.rotation.z=x<0?-.1:.1;sphere(torso,x,.985,.24,.021,.022,.014,'#d5b36b');}
  box(torso,0,.79,-.206,.54,.045,.025,apronColor,.01);
  for(const direction of [-1,1]){const tie=box(torso,direction*.075,.65,-.229,.065,.28,.022,apronColor,.015);tie.rotation.z=direction*.28;}
 }else{
  for(let i=0;i<3;i++)sphere(torso,0,.99-i*.125,.214,.015,.016,.012,'#d8bd83');
  if(tint===0||tint===5){sphere(torso,0,1.105,-.12,.235,.11,.20,outfit);for(const x of [-.08,.08])box(torso,x,1.035,.205,.014,.14,.018,'#e1cf9d',.006);}
 }
 mergeParts(torso,true);
 const legs:T.Group[]=[],knees:T.Group[]=[];
 for(const x of [-.133,.133]){const leg=new T.Group();leg.position.set(x,.51,0);body.add(leg);
  box(leg,0,-.08,0,.207,.21,.22,trousers,.069);mergeParts(leg,true);
  const knee=new T.Group();knee.position.y=-.18;leg.add(knee);
  box(knee,0,-.073,0,.20,.18,.22,trousers,.053);box(knee,0,-.135,.009,.211,.06,.23,trousers,.02);
  box(knee,0,-.217,.055,.24,.09,.34,'#352c22',.034);sphere(knee,0,-.17,.08,.118,.09,.177,'#64452d');
  box(knee,0,-.15,.19,.085,.014,.024,'#b89156',.006);mergeParts(knee,true);legs.push(leg);knees.push(knee);
 }
 const arms:T.Group[]=[];
 for(const direction of [-1,1]){const arm=new T.Group();arm.position.set(direction*.30,1.035,0);arm.rotation.z=direction*.045;body.add(arm);
  sphere(arm,0,-.09,0,.124,.20,.133,outfit);cyl(arm,0,-.23,.012,.114,.106,.115,worker?'#fff0d3':outfit,12);
  sphere(arm,0,-.325,.025,.102,.123,.107,skin);sphere(arm,-direction*.074,-.307,.085,.048,.064,.045,skin);
  mergeParts(arm,true);arms.push(arm);
 }
 if(role==='cleaner'||role==='player'){const mop=new T.Group();mop.name='cleaning-mop';mop.visible=role==='cleaner';body.add(mop);cyl(mop,.48,.64,.22,.025,.025,1.22,'#b59b77',10);box(mop,.48,.065,.22,.38,.10,.22,'#acb4cc',.045);mergeParts(mop,true);}
 const head=new T.Group();head.position.set(0,1.445,.016);body.add(head);
 // One broad cheek silhouette, a small button nose and a low, rounded chin.
 const faceGeometry=new T.SphereGeometry(1,24,18);const face=mesh(faceGeometry,mat(skin),0,0,0,head);face.scale.set(.39,.375,.339);
 for(const direction of [-1,1]){sphere(head,direction*.363,-.015,-.006,.070,.098,.073,skin);sphere(head,direction*.400,-.025,.02,.026,.047,.029,'#c48962');
  cheek(head,direction,skin);
 }
 sphere(head,0,-.092,.334,.033,.030,.031,skin);
 const smileShape=new T.Shape();smileShape.moveTo(-.047,-.151);smileShape.quadraticCurveTo(0,-.163,.047,-.151);smileShape.quadraticCurveTo(.033,-.203,0,-.204);smileShape.quadraticCurveTo(-.035,-.204,-.047,-.151);
 const smileGeo=new T.ShapeGeometry(smileShape,8),smilePos=smileGeo.getAttribute('position');for(let i=0;i<smilePos.count;i++){const x=smilePos.getX(i),y=smilePos.getY(i);smilePos.setZ(i,.339*Math.sqrt(1-(x/.39)**2-(y/.375)**2)+.002);}smileGeo.computeVertexNormals();mesh(smileGeo,mat('#713927'),0,0,0,head);
 hairCap(head,hair);
 const longHair=!worker&&(tint===1||tint===4),bun=role==='barista'||(!worker&&tint===1);
 if(longHair){
  for(const direction of [-1,1])for(let i=0;i<3;i++)strand(head,[[direction*(.23+i*.035),.24,-.09-i*.055],[direction*(.36+i*.018),-.04,-.04-i*.055],[direction*(.32+i*.025),-.38,-.03-i*.055]],.085,.065,i%2?hairLight:hair);
  sphere(head,0,-.06,-.24,.30,.35,.15,hair);
 }
 // Broad overlapping sweeps turn at their tips, exposing the forehead.
 if(!worker&&tint===4){
  strand(head,[[.19,.22,.25],[.015,.21,.337],[-.17,.075,.31]],.095,.036,hair);
  strand(head,[[.28,.19,.18],[.30,.085,.259],[.21,.015,.283]],.065,.033,hairLight);
 }else{
 strand(head,[[.22,.30,-.10],[.16,.395,.13],[-.12,.29,.306],[-.315,.12,.226]],.116,.059,hairLight);
 strand(head,[[.265,.27,.015],[.225,.345,.196],[.025,.235,.346],[-.14,.14,.325]],.111,.057,hair);
 strand(head,[[.27,.23,.02],[.34,.235,.16],[.315,.14,.246],[.23,.09,.293]],.075,.046,hairLight);
 for(const direction of [-1,1])strand(head,[[direction*.31,.215,.11],[direction*.356,.055,.151],[direction*.323,-.058,.132]],.049,.034,hair);
 for(let i=0;i<3;i++)strand(head,[[.10+i*.06,.275,-.27],[-.09+i*.095,.42,-.08],[-.23+i*.095,.31,.17]],.066,.020,i%2?hair:hairLight);
 }
 if(bun){
  sphere(head,-.16,.30,-.325,.21,.21,.19,hair);
  for(let i=0;i<5;i++){const a=i*Math.PI*.4;const lock=sphere(head,-.16+Math.cos(a)*.102,.31+Math.sin(a)*.12,-.40,.073,.124,.063,i%2?hair:hairLight);lock.rotation.z=-a;}
  const ribbon=mesh(new T.TorusGeometry(.127,.027,6,16),mat('#cf9f38'),-.14,.20,-.292,head);ribbon.rotation.x=Math.PI*.35;
 }else if(!worker&&tint===4){
  // A soft beret sits over the hair instead of intersecting a flat cylinder.
  const beret=sphere(head,.035,.41,-.055,.426,.175,.367,'#b68a57');beret.rotation.z=-.14;
  const band=mesh(new T.TorusGeometry(.325,.033,6,24),mat('#8e6740'),0,.315,-.027,head);band.rotation.x=Math.PI/2;
  sphere(head,.055,.57,-.055,.035,.053,.035,'#8e6740');
 }else if(!worker&&tint===5){
  sphere(head,0,.33,-.055,.404,.17,.354,'#557553');
  sphere(head,0,.275,.30,.32,.038,.24,'#456344');
 }
 for(const direction of [-1,1])strand(head,[[direction*.083,.069,.325],[direction*.139,.092,.326],[direction*.198,.069,.301]],.013,.010,hair);
 if(!worker&&tint===2){
  for(const x of [-.146,.146])mesh(new T.TorusGeometry(.099,.017,6,20),mat('#493226'),x,-.03,.355,head);
  box(head,0,-.021,.355,.096,.025,.02,'#493226',.009);
  for(const direction of [-1,1])box(head,direction*.264,-.015,.23,.023,.026,.24,'#493226',.007);
 }
 mergeParts(head,true);
 const eyes=new T.Group();eyes.position.set(0,-.032,0);head.add(eyes);
 for(const direction of [-1,1]){
  const x=direction*.143;
  if(bun){strand(eyes,[[x-.045,-.01,.32],[x,.025,.343],[x+.045,-.007,.32]],.013,.011,'#3d281e');}
  else {sphere(eyes,x,0,.324,.052,.076,.026,'#312820');sphere(eyes,x,-.019,.346,.030,.036,.008,'#643d23');sphere(eyes,x-.012,.022,.349,.013,.018,.008,'#fff8e8');sphere(eyes,x+.017,-.029,.352,.006,.008,.004,'#f9dfb8');}
 }
 mergeParts(eyes,true);
 const tray=new T.Group();tray.position.set(0,.835,.43);body.add(tray);cyl(tray,0,0,0,.40,.37,.055,'#5c3b24');cyl(tray,0,.028,0,.367,.36,.008,'#a6733b');mergeParts(tray,true);
 const cupHolders:T.Group[]=[];for(let i=0;i<5;i++){const c=product(tray,0,.04,0,.65);c.visible=false;cupHolders.push(c);}tray.visible=false;
 const crate=new T.Group();crate.position.set(0,.80,.39);body.add(crate);box(crate,0,0,0,.50,.40,.32,'#b89660',.055);box(crate,0,0,.168,.30,.19,.012,'#e9d8a7',.01);sphere(crate,0,0,.18,.055,.08,.015,'#674526');mergeParts(crate,true);crate.visible=false;
 const bag=new T.Group();bag.name='takeaway-bag';bag.position.set(0,.91,.43);body.add(bag);
 box(bag,0,0,0,.34,.40,.23,'#d5ad76',.035);box(bag,0,.21,0,.35,.05,.24,'#b78950',.014);box(bag,0,0,.122,.19,.20,.014,'#f5e4bd',.007);sphere(bag,0,.01,.137,.045,.065,.009,'#5d7849');
 for(const x of [-.08,.08])cyl(bag,x,.30,0,.012,.012,.18,'#735532',8);box(bag,0,.39,0,.18,.025,.025,'#735532',.008);mergeParts(bag,true);bag.visible=false;
 return {root,body,head,eyes,legs,knees,arms,tray,bag,crate,cupHolders};
}
