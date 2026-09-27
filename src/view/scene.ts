import {animatePose} from './pose';
// Derived from the Three.js skill Vite scaffold; rendering never owns game rules.
import * as T from 'three';
import {GLTFLoader} from 'three/addons/loaders/GLTFLoader.js';
import {COLORS as C,mat,box,sphere,cyl,cup,product,setProduct,table,person,mergeParts,premisesDirt,gold,type Person} from './models';
import {Simulation,distance,type Actor,type Customer,type Vec} from '../game/sim';
import {ROOM,TAKEAWAY,TABLES,POINTS,MENU,STAFF,type Menu,type Role} from '../game/config';
import {t,getLocale} from '../game/i18n';
import {districtDecorations} from './themes';
import {CafeCity} from './city';
import {CafeInterior} from './interior';
import {TABLE_TYPES,tableOfSeat,seatId,seatOffset,dishOffset} from '../game/table-layout';
import {dirtSeconds} from '../game/cleanliness';
import {PERSONAS,REASONS,type Persona,type GuestReview} from '../game/guests';
import type {PlayArea,ScreenRect} from '../ui/layout';
export function uiFrustumCenterOffset(area:PlayArea,height:number,worldHeight:number,zoom:number){return ((area.top+area.bottom)/(2*Math.max(1,height))-.5)*worldHeight/Math.max(Number.EPSILON,zoom);}
export function cafeFrameWidth(width:number,height:number,area:PlayArea,floorEnd:number){
 const centerZ=(floorEnd-4.9)/2+1.8,angle=.17,distance=Math.hypot(28,29.6);
 let horizontal=0,vertical=0;
 for(const x of [ROOM.left,ROOM.right])for(const y of [0,3.6])for(const z of [-4.9,floorEnd]){
  const dx=x-ROOM.center,dz=z-centerZ;
  horizontal=Math.max(horizontal,Math.abs(dx*Math.cos(angle)-dz*Math.sin(angle)));
  vertical=Math.max(vertical,Math.abs((y-.4)*28/distance-(dx*Math.sin(angle)+dz*Math.cos(angle))*29.6/distance));
 }
 return Math.max(16.8,horizontal*2.08*width/Math.max(1,area.right-area.left),vertical*2.08*width/Math.max(1,Math.min(height,area.bottom-area.top)));
}
export class CafeScene {
 private stage=new T.Group();private speakers=new T.Group();private acousticPanels=new T.Group();private musician!:Person;private officer!:Person;private pickupCounter=new T.Group();private guideActive=false;private guidePoint?:Vec;private guideRing=new T.Group();private guideDots=new T.InstancedMesh(new T.RingGeometry(.045,.075,12),new T.MeshBasicMaterial({color:'#ffe29a',side:T.DoubleSide,depthWrite:false}),40);private guideMatrix=new T.Object3D();
 private labelRects=new Map<string,{x:number;y:number;w:number;h:number;secondary:boolean;priority:number}>();
 private uiArea:PlayArea={left:0,right:0,top:0,bottom:0};private uiBlocked:ScreenRect[]=[];private layoutRevision=0;
 rotation=0;private cameraSpace=-1;private dirt:T.Group[]=[];private premisesMarks:T.Group[]=[];private washDishes=new T.Group();
 private cameraShift=new T.Vector2();city:CafeCity;interior!:CafeInterior;overview=false;
 private paintedMaterials:{material:T.MeshStandardMaterial;dark:boolean}[]=[];districts:T.Group[]=[];renderer:T.WebGLRenderer;scene=new T.Scene();camera=new T.OrthographicCamera();world=new T.Group();people=new Map<string,Person>();tableGroups:T.Group[]=[];servedCups:T.Group[][]=[];readyCups:T.Group[]=[];steam:T.Mesh[]=[];machine=new T.Group();markers=new Map<string,HTMLElement>();labels:HTMLElement;pad=new T.Group();private lastBranch=-1;private lastTables=-1;private lastMachine=-1;private locale='';private targetMark=new T.Group();private ray=new T.Raycaster();private plane=new T.Plane(new T.Vector3(0,1,0),0);private pointer=new T.Vector2();private screen=new T.Vector3();private lastCount=0;
 constructor(public host:HTMLElement,public game:Simulation){this.renderer=new T.WebGLRenderer({antialias:true,alpha:false,powerPreference:'high-performance'});this.renderer.setPixelRatio(Math.min(devicePixelRatio,1.6));this.renderer.outputColorSpace=T.SRGBColorSpace;this.renderer.toneMapping=T.ACESFilmicToneMapping;this.renderer.toneMappingExposure=1.08;this.renderer.shadowMap.enabled=true;this.renderer.shadowMap.type=T.PCFShadowMap;host.appendChild(this.renderer.domElement);this.renderer.domElement.setAttribute('aria-label','Interactive three-dimensional café');this.labels=document.createElement('div');this.labels.className='world-labels';host.appendChild(this.labels);this.scene.background=new T.Color('#dce9d0');this.scene.add(new T.HemisphereLight('#fff5e2','#b5c8a6',1.65));const sun=new T.DirectionalLight('#fff0d6',2.7);sun.position.set(-3,10,5);sun.castShadow=true;sun.shadow.mapSize.set(2048,2048);Object.assign(sun.shadow.camera,{left:-9,right:9,top:9,bottom:-9,near:.5,far:30});sun.shadow.normalBias=.035;sun.shadow.bias=-.00015;sun.shadow.radius=3;this.scene.add(sun);const fill=new T.DirectionalLight('#fff0d6',.65);fill.position.set(4,5,10);this.scene.add(fill);this.camera.position.set(3.5,21,21);this.camera.lookAt(0,0.4,.7);this.scene.add(this.world);this.city=new CafeCity(this.scene);this.buildRoom();this.buildAtmosphere();this.districts=districtDecorations(this.world);this.scene.add(this.targetMark);const ring=new T.Mesh(new T.RingGeometry(.22,.26,24),new T.MeshBasicMaterial({color:'#fff2b0',transparent:true,opacity:.8,side:T.DoubleSide}));ring.rotation.x=-Math.PI/2;ring.position.y=.06;this.targetMark.add(ring);this.targetMark.visible=false;const guide=new T.Mesh(new T.RingGeometry(.48,.57,40),new T.MeshBasicMaterial({color:'#ffe29a',side:T.DoubleSide,depthWrite:false}));guide.rotation.x=-Math.PI/2;this.guideRing.add(guide);this.scene.add(this.guideRing,this.guideDots);this.guideRing.visible=false;this.guideDots.count=0;this.guideDots.frustumCulled=false;new ResizeObserver(()=>this.resize()).observe(host);this.resize();}
 private updateFrustum(width:number,aspect:number){const half=width/aspect/2,center=uiFrustumCenterOffset(this.uiArea,this.host.clientHeight,2*half,this.camera.zoom);this.camera.left=-width/2;this.camera.right=width/2;this.camera.top=half+center;this.camera.bottom=-half+center;}
 resize(){const w=this.host.clientWidth,h=this.host.clientHeight;if(!w||!h)return;this.renderer.setPixelRatio(Math.min(devicePixelRatio,1.6));this.renderer.setSize(w,h);const aspect=w/h;if(!this.uiArea.right)this.uiArea={left:0,right:w,top:0,bottom:h};const width=this.overview?Math.max(40,32*aspect):cafeFrameWidth(w,h,this.uiArea,this.game.floorEnd);this.updateFrustum(width,aspect);this.camera.near=.1;this.camera.far=80;this.camera.updateProjectionMatrix();this.aimCamera();}
 public setUiLayout(area:PlayArea,blocked:ScreenRect[]){const w=this.host.clientWidth,h=this.host.clientHeight;this.uiArea={left:T.MathUtils.clamp(area.left,0,w),right:T.MathUtils.clamp(area.right,0,w),top:T.MathUtils.clamp(area.top,0,h),bottom:T.MathUtils.clamp(area.bottom,0,h)};this.uiBlocked=blocked.map(r=>({x:r.x,y:r.y,width:r.width,height:r.height}));this.layoutRevision++;for(const el of this.markers.values()){delete el.dataset.measureKey;delete el.dataset.labelWidth;delete el.dataset.labelHeight;}this.resize();}
 private aimCamera(){const centerX=(this.overview?3:ROOM.center)+this.cameraShift.x,centerZ=(this.overview?3:(this.game.floorEnd-4.9)/2+1.8)+this.cameraShift.y,angle=.17+this.rotation;this.camera.position.set(centerX+Math.sin(angle)*28,30,centerZ+Math.cos(angle)*28);this.camera.lookAt(centerX,.4,centerZ);this.camera.updateMatrixWorld();}
 rotateTo(angle:number){if(!Number.isFinite(angle))return;this.rotation=T.MathUtils.clamp(angle,-Math.PI/2,Math.PI/2);this.aimCamera();}
 rotateBy(delta:number){this.rotateTo(this.rotation+delta);}
 screenDirection(x:number,y:number){const angle=.17+this.rotation;return {x:x*Math.cos(angle)+y*Math.sin(angle),z:-x*Math.sin(angle)+y*Math.cos(angle)};}
 resetCamera(){this.rotation=0;this.camera.zoom=1;this.cameraShift.set(0,0);this.overview=false;this.resize();}
 zoomAt(zoom:number,x:number,y:number){if(!Number.isFinite(zoom))return;const before=this.point(x,y),width=this.camera.right-this.camera.left;this.camera.zoom=T.MathUtils.clamp(zoom,Math.min(1,width/46),width/10);this.updateFrustum(width,this.host.clientWidth/Math.max(1,this.host.clientHeight));this.camera.updateProjectionMatrix();this.host.parentElement?.classList.toggle('city-view',this.overview||this.camera.zoom<.6);const after=this.point(x,y);if(before&&after){this.cameraShift.x=T.MathUtils.clamp(this.cameraShift.x+before.x-after.x,-10,10);this.cameraShift.y=T.MathUtils.clamp(this.cameraShift.y+before.z-after.z,-10,10);this.aimCamera();}}
 toggleView(){this.overview=!this.overview;this.camera.zoom=1;this.cameraShift.set(0,0);this.resize();return this.overview;}
 point(clientX:number,clientY:number):Vec|null{const r=this.renderer.domElement.getBoundingClientRect();this.pointer.set((clientX-r.left)/r.width*2-1,-(clientY-r.top)/r.height*2+1);this.ray.setFromCamera(this.pointer,this.camera);const hit=new T.Vector3();if(!this.ray.ray.intersectPlane(this.plane,hit))return null;return {x:hit.x,z:hit.z};}
 project(p:Vec,height=0){this.screen.set(p.x,height,p.z).project(this.camera);return {x:(this.screen.x*.5+.5)*this.host.clientWidth,y:(-.5*this.screen.y+.5)*this.host.clientHeight};}
 target(p:Vec){this.targetMark.position.set(p.x,p.z>this.game.floorEnd?-.13:.025,p.z);this.targetMark.visible=true;}
 guide(p:Vec|undefined,visible:boolean){this.guideActive=visible;this.guidePoint=visible?p:undefined;}
 private updateGuide(time:number){const p=this.guidePoint;this.guideRing.visible=!!p;this.guideDots.count=0;if(!p)return;this.guideRing.position.set(p.x,p.z>this.game.floorEnd?-.09:.09,p.z);this.guideRing.scale.setScalar(this.game.s.settings.motion?1+Math.sin(time*3)*.05:1);
  let from:Vec=this.game.s.player,n=0,remainder=.22;for(const to of this.game.s.player.path){const length=distance(from,to);for(let d=remainder;d<length&&n<40;d+=.38){const x=from.x+(to.x-from.x)*d/length,z=from.z+(to.z-from.z)*d/length;this.guideMatrix.position.set(x,z>this.game.floorEnd?-.08:.10,z);this.guideMatrix.rotation.set(-Math.PI/2,0,0);this.guideMatrix.updateMatrix();this.guideDots.setMatrixAt(n++,this.guideMatrix.matrix);}remainder=(remainder-length)% .38;if(remainder<0)remainder+=.38;from=to;}this.guideDots.count=n;this.guideDots.instanceMatrix.needsUpdate=true;
 }
 private sign(parent:T.Group,text:string,x:number,y:number,z:number,w:number,h:number,rotation=0,bg='#30432e'){const canvas=document.createElement('canvas');canvas.width=512;canvas.height=Math.round(512*h/w);const ctx=canvas.getContext('2d')!;ctx.fillStyle=bg;ctx.fillRect(0,0,canvas.width,canvas.height);ctx.strokeStyle='#d2ad74';ctx.lineWidth=12;ctx.strokeRect(8,8,canvas.width-16,canvas.height-16);ctx.fillStyle='#fff0ca';ctx.font=`bold ${Math.min(68,canvas.height*.29)}px Georgia`;ctx.textAlign='center';ctx.textBaseline='middle';text.split('\n').forEach((line,i,arr)=>ctx.fillText(line,256,canvas.height/2+(i-(arr.length-1)/2)*canvas.height*.27));const tex=new T.CanvasTexture(canvas);tex.colorSpace=T.SRGBColorSpace;const m=new T.MeshBasicMaterial({map:tex});const sign=new T.Mesh(new T.PlaneGeometry(w,h),m);sign.position.set(x,y,z);sign.rotation.y=rotation;parent.add(sign);return sign;}
 private buildRoom(){const room=new T.Group();this.world.add(room);this.interior=new CafeInterior(this.world);
 box(room,ROOM.center,1.65,-4.77,ROOM.width+.2,3.5,.2,C.cream,.06);box(room,ROOM.center,.5,-4.60,ROOM.width-.1,1,.12,C.sageDark);box(room,ROOM.center,1.04,-4.5,ROOM.width-.1,.12,.2,C.wood);box(room,ROOM.center,3.44,-4.60,ROOM.width+.1,.2,.25,C.bark);
 // Window and awning.
 box(room,1.35,2.05,-4.53,3.3,2.5,.15,C.sageDark);box(room,1.35,2.12,-4.42,2.92,2.09,.10,'#afc9a0');box(room,1.35,2.13,-4.30,.12,2.2,.14,C.woodLight);box(room,1.35,2.15,-4.29,3.05,.1,.14,C.woodLight);box(room,1.35,1.01,-4.15,3.48,.16,.7,C.wood);for(let i=0;i<7;i++){const awning=box(room,-.14+i*.50,3.31,-4.07,.50,.10,.85,i%2?C.cream:C.terra,.018);awning.rotation.x=.34;box(room,-.14+i*.50,3.13,-3.67,.49,.24,.065,i%2?C.cream:C.terra,.025);}
 // A second broad window brings light into the enlarged dining room.
 box(room,7.15,2.12,-4.53,3.6,2.3,.14,C.sageDark);box(room,7.15,2.12,-4.42,3.26,1.98,.08,'#b8d5b6');box(room,7.15,2.12,-4.3,.10,2.05,.12,C.woodLight);box(room,7.15,1.05,-4.1,3.7,.12,.6,C.wood);
 // Dedicated washing counter, separate from the food preparation and storage.
 box(room,-2.87,.53,3.65,1.5,1.0,.88,'#96b6ac',.08);box(room,-2.87,1.08,3.65,1.7,.13,1.02,'#dbe2d4',.07);box(room,-2.87,1.16,3.65,1.0,.06,.62,'#758f87',.08);cyl(room,-3.35,1.36,3.45,.04,.04,.46,'#c9d4c9',12);box(room,-3.15,1.58,3.45,.4,.07,.07,'#c9d4c9',.025);
 this.sign(room,'◉ ≋',-2.87,.65,4.11,.85,.32,0,'#668c83');
 this.world.add(this.washDishes);for(let i=0;i<5;i++)cyl(this.washDishes,-2.7,1.2+i*.045,3.75,.19,.18,.04,'#f4e7ca',16);mergeParts(this.washDishes,true);
 // Counter along the left side, with paneled sage cabinetry.
 box(room,-2.86,.64,-2.15,1.83,1.2,4.65,C.sageDark,.09);box(room,-2.86,1.29,-2.15,2.02,.16,4.82,C.woodLight,.075);for(let z=-4.05;z<.15;z+=.68){box(room,-1.92,.64,z,.08,.9,.60,C.sage,.015);box(room,-1.865,.88,z,.055,.04,.22,'#d6b37a',.009);}
 // Shelf, stacked cups and jars behind the machine.
 box(room,-3.72,2.3,-2.4,.69,.12,3.5,C.wood);for(let i=0;i<8;i++){const z=-3.83+i*.41;cyl(room,-3.61,2.54,z,.12,.11,.34,i%3===0?'#876140':'#d3a775',16);cyl(room,-3.61,2.74,z,.13,.13,.06,C.bark,16);}this.sign(room,'MINIK MOLA\nCOFFEE & CAKE',-2.70,2.65,-4.60,1.80,1.09,0);
 // Display cabinet with pastries visible through a low, clear front.
 box(room,-2.83,1.42,-.33,1.65,.13,1.38,C.bark);box(room,-2.83,1.97,-.33,1.68,.03,1.39,new T.MeshStandardMaterial({color:'#dbecc7',transparent:true,opacity:.10,roughness:.2}),0);for(const dx of [-.78,.78])for(const dz of [-.63,.63])box(room,-2.83+dx,1.72,-.33+dz,.045,.51,.045,C.sageDark,.008);box(room,-2.00,1.7,-.33,.015,.48,1.25,new T.MeshStandardMaterial({color:'#d9eece',transparent:true,opacity:.18,roughness:.1}),0);box(room,-2.83,1.70,-.33,1.48,.035,1.22,'#dfc299',.012);
 // Cash desk and storage are distinct from the brewing station.
 box(room,-2.86,.53,1.33,1.53,1.02,1.3,C.sage,.05);box(room,-2.86,1.10,1.33,1.69,.16,1.48,C.woodLight,.06);box(room,-2.57,1.3,1.3,.48,.24,.35,'#354936');const screen=box(room,-2.58,1.5,1.24,.42,.28,.06,'#344c38');screen.rotation.x=-.3;box(room,-3.35,.31,2.42,.65,.58,.75,'#b9955d',.06);box(room,-3.35,.94,2.42,.74,.65,.57,'#c3a473',.07);
 // Pendant lamps, welcoming doorstep, potted greenery.
 for(const z of [-2.1,1.4]){cyl(room,-.65,3.68,z,.025,.025,.8,C.bark,8);cyl(room,-.65,3.2,z,.11,.38,.25,C.sageDark);cyl(room,-.65,3.065,z,.31,.30,.035,new T.MeshStandardMaterial({color:'#ffe1a2',emissive:'#ffbb55',emissiveIntensity:.6}),20);}

 mergeParts(room);
 room.traverse(o=>{if(o instanceof T.Mesh&&(o.material===mat(C.sage)||o.material===mat(C.sageDark))){const dark=o.material===mat(C.sageDark);const material=(o.material as T.MeshStandardMaterial).clone();o.material=material;this.paintedMaterials.push({material,dark});}});
 this.world.add(this.pickupCounter);this.pickupCounter.name='office-pickup-counter';
 // Permanent retrofit of the existing cashier desk, leaving the aisle clear.
 box(this.pickupCounter,-2.33,1.20,1.32,.48,.09,.65,C.sageDark,.025);
 for(let i=0;i<3;i++){const x=-2.99+i*.21;box(this.pickupCounter,x,1.37,1.24,.18,.34,.19,'#d5ad76',.018);box(this.pickupCounter,x,1.55,1.24,.19,.04,.20,'#b78950',.009);box(this.pickupCounter,x,1.37,1.344,.10,.16,.01,C.cream,.004);}
 box(this.pickupCounter,TAKEAWAY.guest.x,.088,TAKEAWAY.guest.z,.72,.035,.61,'#6a8e70',.04);box(this.pickupCounter,TAKEAWAY.guest.x,.11,TAKEAWAY.guest.z,.31,.009,.07,C.cream,.007);
 mergeParts(this.pickupCounter);this.pickupCounter.visible=false;
 this.world.add(this.machine);this.buildMachine();
 for(let i=0;i<TABLES.length;i++)this.buildTableFurniture(i,0);
 for(const p of TABLES){const dirt=new T.Group();dirt.position.set(p.x,.975,p.z);this.world.add(dirt);for(let j=0;j<2;j++){cyl(dirt,(j-.5)*.48,.02,.10,.16,.15,.035,'#eee0bd',12);cup(dirt,(j-.5)*.48,.04,.10,.55,'#c2a479',false);}mergeParts(dirt,true);this.dirt.push(dirt);}
 for(let i=0;i<20;i++)this.premisesMarks.push(premisesDirt(this.world));
 this.world.add(this.pad);const outline=new T.Mesh(new T.RingGeometry(.78,.81,48),new T.MeshBasicMaterial({color:'#ffe7a9',side:T.DoubleSide,transparent:true,opacity:.8}));outline.rotation.x=-Math.PI/2;outline.position.y=.08;this.pad.add(outline);
 const target=new T.Mesh(new T.RingGeometry(.40,.49,32),new T.MeshBasicMaterial({color:'#a7e1b5',transparent:true,opacity:.72,side:T.DoubleSide}));target.rotation.x=-Math.PI/2;target.position.y=.08;this.world.add(target);target.name='player-ring';
 for(let i=0;i<5;i++){const c=product(this.world,-1.97,1.38,-2.7+i*.36,.90);this.readyCups.push(c);}
 for(let i=0;i<8;i++){const m=sphere(this.world,-2.55,2.1+i*.11,-2.8,.05,.10,.05,new T.MeshBasicMaterial({color:'#fff0d8',transparent:true,opacity:.3}));m.castShadow=false;this.steam.push(m);}this.loadFood();}
 private buildAtmosphere(){
  this.stage.name='live-music-stage';this.stage.position.set(5.3,0,-3.35);this.world.add(this.stage,this.speakers,this.acousticPanels);
  box(this.stage,0,.13,0,2.4,.24,1.6,'#ad865e',.08);box(this.stage,0,.265,0,2.25,.045,1.45,'#b35e48',.025);
  this.musician=person(this.stage,3,'customer');this.musician.root.position.set(-.2,.28,0);this.musician.root.rotation.y=.1;
  const guitar=new T.Group();guitar.position.set(.10,.94,.29);guitar.rotation.z=-.55;this.musician.root.add(guitar);
  sphere(guitar,0,0,0,.23,.31,.08,'#d9a557');sphere(guitar,0,.055,.081,.062,.07,.008,'#644c37');box(guitar,0,.43,0,.09,.66,.06,'#815838',.016);for(const x of [-.018,0,.018])box(guitar,x,.24,.043,.004,.82,.006,'#efd6a4',0);mergeParts(guitar,true);
  cyl(this.stage,.63,.85,.38,.021,.03,1.20,'#526761',8);cyl(this.stage,.63,.29,.38,.18,.2,.04,'#526761',12);const mic=box(this.stage,.63,1.47,.38,.08,.09,.24,'#485b55',.025);mic.rotation.x=-.3;
  for(const x of [3.8,6.8]){box(this.speakers,x,.65,-3.67,.40,.75,.40,'#50685d',.045);for(const y of [.48,.79]){const cone=cyl(this.speakers,x,y,-3.453,.12,.12,.025,'#a4b4a0',16);cone.rotation.x=Math.PI/2;}cyl(this.speakers,x,.23,-3.67,.027,.04,.40,'#526761',8);}
  for(const x of [3.5,4.05,4.6,5.15])box(this.acousticPanels,x,2.15,-4.32,.40,1.9,.15,'#96aaa0',.05);
  mergeParts(this.speakers,true);mergeParts(this.acousticPanels,true);
  this.officer=person(this.world,1,'customer');this.officer.root.name='neighbourhood-officer';box(this.officer.body,0,.89,.19,.50,.42,.08,'#647e9d',.03);box(this.officer.head,0,.30,.02,.57,.12,.40,'#526b88',.04);box(this.officer.body,.13,.98,.238,.065,.075,.02,'#e6c976',.008);
 }
 private updateAtmosphere(time:number){
  const b=this.game.b as typeof this.game.b&{musicMode?:string;volume?:number;patrolSeconds?:number};
  const level=b.level as typeof b.level&{stage?:number;speakers?:number;soundproof?:number};
  this.stage.visible=(level.stage??0)>0;this.speakers.visible=(level.speakers??0)>0;this.acousticPanels.visible=(level.soundproof??0)>0;
  const playing=this.stage.visible&&b.musicMode==='live'&&(b.volume??0)>0;this.musician.root.visible=playing;
  if(playing){this.musician.arms[0].rotation.x=-.9;this.musician.arms[1].rotation.x=-.65+(this.game.s.settings.motion?Math.sin(time*7)*.12:0);this.musician.head.rotation.z=this.game.s.settings.motion?Math.sin(time*2)*.04:0;}
  if(this.stage.visible&&!this.overview&&distance(this.game.s.player,{x:5.3,z:-3.35})<2.2)this.label('music-stage',playing?t('Canlı müzik'):t('Müzik sahnesi'),{x:5.3,z:-3.35},2.25,'station');
  this.officer.root.visible=(b.patrolSeconds??0)>0;
  if(this.officer.root.visible){const phase=Math.min(1,Math.max(0,(12-(b.patrolSeconds??0))/4));this.officer.root.position.set(-4.8+phase*1.2,-.18,14.2);this.officer.root.rotation.y=Math.PI/2;this.officer.arms[1].rotation.x=-.5;this.officer.legs.forEach((leg,i)=>leg.rotation.x=this.game.s.settings.motion&&phase>0&&phase<1?Math.sin(time*6+i*Math.PI)*.28:0);if(!this.overview)this.label('officer',t('Gürültü denetimi'),{x:-3.6,z:14.2},2.05,'station');}
 }
 private buildTableFurniture(index:number,tier:number){
  const old=this.tableGroups[index];if(old){old.traverse(o=>{if(o instanceof T.Mesh)o.geometry.dispose();});old.removeFromParent();}
  for(const cup of this.servedCups[index]??[])cup.removeFromParent();
  const p=TABLES[index];this.tableGroups[index]=table(this.world,p.x,p.z,tier);
  this.servedCups[index]=Array.from({length:TABLE_TYPES[tier].seats},(_,local)=>{const offset=dishOffset(local,tier);return product(this.world,p.x+offset.x,TABLE_TYPES[tier].tableTop+.02,p.z+offset.z,.85);});
 }
 private buildMachine(){for(const child of [...this.machine.children]){child.traverse(o=>{if(o instanceof T.Mesh)o.geometry.dispose();});child.removeFromParent();}const g=this.machine,l=this.game.b.level.machine;box(g,-2.80,1.74,-2.97,1.25, .76,1.52+(l-1)*.1,C.sage,.13);box(g,-2.135,1.64,-2.97,.06,.38,1.26,'#303c32',.02);box(g,-2.11,1.41,-2.97,.47,.08,1.38,'#d4c9a9',.03);for(let i=0;i<2+Math.floor(l/2);i++){const z=-3.37+i*.40;cyl(g,-2.07,1.73,z,.055,.055,.13,'#d6d2bd',10);box(g,-1.95,1.78,z,.32,.07,.09,C.bark,.02);sphere(g,-2.108,1.94,z,.016,.053,.053,'#f8d785');}for(let i=0;i<4;i++)cup(g,-2.78,2.17,-3.47+i*.3,.8);mergeParts(g);this.lastMachine=l;}
 private async loadFood(){const loader=new GLTFLoader();for(const [name,y,z] of [['croissant',1.75,-.65],['muffin',1.48,-.52],['cake',1.75,-.04]] as const){try{const gltf=await loader.loadAsync(`/models/${name}.glb`);const original=gltf.scene;const bounds=new T.Box3().setFromObject(original),size=bounds.getSize(new T.Vector3());const scale=.47/Math.max(size.x,size.z);original.scale.setScalar(scale);const center=bounds.getCenter(new T.Vector3());original.position.set(-2.80-center.x*scale,y-bounds.min.y*scale,z-center.z*scale);original.traverse(o=>{if(o instanceof T.Mesh){o.castShadow=true;o.receiveShadow=true;}});this.world.add(original);}catch(err){console.warn('Food asset unavailable:',name,err);}}}
 private label(key:string,text:string,at:Vec,height:number,kind=''){let el=this.markers.get(key);if(!el){el=document.createElement('div');el.className=`world-label ${kind}`;this.labels.appendChild(el);this.markers.set(key,el);}if(kind.includes('table-orders')){
  if(el.dataset.orders!==`${text}:${getLocale()}`){el.replaceChildren();for(const entry of text.split('|')){const [product,count]=entry.split(':');const kind=product as Menu,row=document.createElement('span'),img=document.createElement('img'),number=document.createElement('b');img.src=`/menu-${kind}.svg`;img.alt=t(MENU[kind].name);img.width=18;img.height=18;img.className='table-order-icon';number.textContent=`×${count}`;row.className='table-order-item';row.append(img,number);el.append(row);}el.dataset.orders=`${text}:${getLocale()}`;}
 }else if(kind.startsWith('patience')){const product=text as Menu;let img=el.querySelector('img');if(!img){img=document.createElement('img');el.replaceChildren(img);}if(el.dataset.product!==product){img.src=`/menu-${product}.svg`;el.dataset.product=product;}const label=t(MENU[product].name);if(img.alt!==label)img.alt=label;}else if(el.textContent!==text)el.textContent=text;const p=this.project(at,height);let x=p.x;
 const width=this.host.clientWidth,hostHeight=this.host.clientHeight,area=this.uiArea.right?this.uiArea:{left:0,right:width,top:0,bottom:hostHeight};
 const measureKey=`${text}:${width}:${hostHeight}:${getLocale()}:${this.layoutRevision}:${this.host.parentElement?.className??''}:${document.documentElement.dataset.largeText??''}`;
 if(el.dataset.measureKey!==measureKey){el.dataset.labelWidth=String(el.offsetWidth);el.dataset.labelHeight=String(el.offsetHeight);el.dataset.measureKey=measureKey;}
 const labelWidth=Number(el.dataset.labelWidth??0),labelHeight=Number(el.dataset.labelHeight??0);
 if(kind.includes('station')&&p.x>=area.left&&p.x<=area.right&&p.y>=area.top&&p.y<=area.bottom){
  const half=Math.min(labelWidth/2,Math.max(0,(area.right-area.left-16)/2));x=T.MathUtils.clamp(p.x,area.left+half+8,area.right-half-8);
 }
 const rect={x:x-labelWidth/2,y:p.y-labelHeight,w:labelWidth,h:labelHeight};
 const onCanvas=rect.x>=0&&rect.x+rect.w<=width&&rect.y>=0&&rect.y+rect.h<=hostHeight;
 const inArea=rect.x>=area.left&&rect.x+rect.w<=area.right&&rect.y>=area.top&&rect.y+rect.h<=area.bottom;
 const blocked=this.uiBlocked.some(r=>rect.x<r.x+r.width&&rect.x+rect.w>r.x&&rect.y<r.y+r.height&&rect.y+rect.h>r.y);
 const visible=onCanvas&&inArea&&!blocked;
 el.style.transform=`translate(${x}px,${p.y}px) translate(-50%,-100%)`;el.style.visibility=visible?'':'hidden';el.dataset.layoutVisible=String(visible);el.dataset.seen='yes';
 const secondary=/worker-role|guest-persona|guest-review/.test(kind);
 const priority=kind.includes('guide')?0:kind.includes('table-orders')?1:kind.includes('build-pad')?2:kind.includes('stock-label')?3:secondary?(kind.includes('guest-review')?10:kind.includes('guest-persona')?11:12):4;
 this.labelRects.set(key,{...rect,secondary,priority});
}
 private resolveLabelCollisions(){
  const entries=[...this.labelRects.entries()].filter(([key,r])=>this.markers.get(key)?.dataset.seen==='yes'&&this.markers.get(key)?.dataset.layoutVisible==='true'&&r.w>0&&r.h>0);
  const occupied:{x:number;y:number;w:number;h:number;secondary:boolean;priority:number}[]=[];
  for(const [key,rect] of entries.sort((a,b)=>a[1].priority-b[1].priority||a[0].localeCompare(b[0]))){
   const collides=occupied.some(r=>rect.x<r.x+r.w+5&&rect.x+rect.w+5>r.x&&rect.y<r.y+r.h+5&&rect.y+rect.h+5>r.y);
   const el=this.markers.get(key)!;el.style.visibility=collides?'hidden':'';
   if(!collides)occupied.push(rect);
  }
 }
 private orderLabelPoint(c:Customer){const tier=(this.game.b as typeof this.game.b&{tableLevels?:number[]}).tableLevels?.[tableOfSeat(c.seat)]??0,seat=seatOffset(c.seat,tier);return {x:c.x+Math.sin(seat.angle)*.65,z:c.z+Math.cos(seat.angle)*.65};}
 private animatePerson(id:string,a:Actor,tint:number,role:string,time:number,customer?:Customer){let p=this.people.get(id);if(!p){p=person(this.world,tint,role);this.people.set(id,p);}p.root.visible=true;const cleaning=!!a.task&&(a.task.startsWith('clean')||a.task.startsWith('sweep-')||a.task==='wash')&&!a.moving;const working=cleaning||this.game.b.brew>0&&!a.moving&&(role==='barista'||role==='player')&&distance(a,POINTS.machine)<1.2;animatePose(p,a,role,time,a.z>this.game.floorEnd?-.16:0,(this.game.b.decor.furniture==='cushions'||!!customer&&customer.seat>=0&&this.game.b.tableLevels[tableOfSeat(customer.seat)]>0),this.game.s.settings.motion,tint,customer,working);const mop=p.root.getObjectByName('cleaning-mop');if(mop){const sweeping=!!a.task?.startsWith('sweep-')&&!a.moving;mop.visible=role==='cleaner'||sweeping;if(sweeping)p.root.rotation.y=a.angle;mop.position.x=sweeping?-.48:0;mop.position.z=sweeping?.33+(this.game.s.settings.motion?Math.sin(time*9)*.12:0):0;mop.rotation.z=sweeping&&this.game.s.settings.motion?Math.sin(time*9)*.08:0;}}
 private updatePremisesDirt(){const patches=this.game.cleanliness.patches;this.premisesMarks.forEach((mark,i)=>{const patch=patches[i];mark.visible=!!patch;if(!patch)return;mark.name=`premises-dirt-${patch.id}`;mark.position.set(patch.x,patch.zone==='floor'?.071:-.135,patch.z);mark.rotation.y=patch.id*2.4;mark.getObjectByName('spill')!.visible=patch.kind==='spill';mark.getObjectByName('litter')!.visible=patch.kind==='litter';mark.scale.setScalar(1-.75*patch.work/dirtSeconds(patch));});}
 update(time:number,poseTime=this.game.b.time){const ratio=Math.min(devicePixelRatio,1.6);if(this.renderer.getPixelRatio()!==ratio)this.renderer.setPixelRatio(ratio);const b=this.game.b;this.updatePremisesDirt();if(this.cameraSpace!==b.level.space){this.cameraSpace=b.level.space;this.resize();}this.dirt.forEach((g,i)=>g.visible=i<b.level.table&&!!b.dirtyTables[i]);this.washDishes.visible=b.dirtyDishes>0;this.city.update(this.game.s.active,b.time,this.game.s.settings.motion);this.interior.update(b.level.space,b.decor,b.mastery);const branchChanged=this.lastBranch!==this.game.s.active;if(branchChanged){for(const p of this.people.values())p.root.visible=false;this.lastBranch=this.game.s.active;this.districts.forEach((g,i)=>g.visible=i===this.lastBranch);const colors=[[C.sage,C.sageDark],['#56817c','#345951'],['#80a88e','#496a50']][this.lastBranch];this.paintedMaterials.forEach(({material,dark})=>material.color.set(colors[dark?1:0]));}if(this.lastMachine!==b.level.machine)this.buildMachine();for(let i=0;i<TABLES.length;i++){const tier=(b as typeof b&{tableLevels?:number[]}).tableLevels?.[i]??0;if(this.tableGroups[i].userData.tier!==tier)this.buildTableFurniture(i,tier);}this.tableGroups.forEach((g,i)=>{g.visible=i<b.level.table;g.traverse(o=>{if(o.name==='table-plants')o.visible=b.decor.plants!=='none';});const cushions=g.getObjectByName('chair-cushions');if(cushions)cushions.visible=b.tableLevels[i]>0||b.decor.furniture==='cushions';this.dirt[i].position.y=TABLE_TYPES[b.tableLevels[i]].tableTop+.025;});for(const p of this.people.values())p.root.visible=false;this.animatePerson('player',this.game.s.player,0,'player',poseTime);for(const [r,a] of Object.entries(b.workers))if(a)this.animatePerson(r,a,r==='barista'?1:r==='waiter'?2:4,r,poseTime);
 for(const el of this.markers.values())el.dataset.seen='no';this.updateAtmosphere(poseTime);
 const helpers=(b as typeof b&{helpers?:{role:Role;actor:Actor}[]}).helpers??[];for(const [i,helper] of helpers.entries()){this.animatePerson(`helper-${i}`,helper.actor,helper.role==='barista'?1:helper.role==='waiter'?2:4,helper.role,poseTime);}
 const detailed=!this.overview&&this.host.clientWidth*this.camera.zoom/(this.camera.right-this.camera.left)>=12;
 if(detailed){
  const nearby=[...Object.entries(b.workers).map(([role,worker])=>({key:`role-${role}`,role:role as Role,actor:worker!})),...helpers.map((h,i)=>({key:`helper-role-${i}`,role:h.role,actor:h.actor}))].filter(h=>distance(h.actor,this.game.s.player)<2.1).sort((a,b)=>distance(a.actor,this.game.s.player)-distance(b.actor,this.game.s.player));
  const nearest=nearby[0];if(nearest)this.label(nearest.key,t(STAFF[nearest.role].name),nearest.actor,2.0,'station worker-role');
 }
 const nearbyGuest=b.customers.filter(c=>distance(c,this.game.s.player)<2.2).sort((a,b)=>distance(a,this.game.s.player)-distance(b,this.game.s.player))[0];
 for(const c of b.customers){this.animatePerson(`c${c.id}`,c,c.tint,'customer',poseTime,c);if(detailed&&(c.state==='pickup-waiting'||c.state==='waiting'&&b.tableLevels[tableOfSeat(c.seat)]===0)){const patience=c.patience/c.maxPatience;this.label(`c${c.id}`,c.kind,c.state==='waiting'?this.orderLabelPoint(c):c,c.state==='waiting'?1.65:2.15,patience<.35?'patience low':'patience');const el=this.markers.get(`c${c.id}`)!;el.style.setProperty('--patience',`${patience*100}%`);el.classList.toggle('low',patience<.35);el.classList.toggle('special-order',!!c.specialId&&c.specialId===b.special?.id&&b.special.status==='active');}
 const guest=c as Customer&{persona?:Persona;review?:GuestReview};
 if(detailed&&c===nearbyGuest&&guest.review){const reason=guest.review.reasons[0];this.label(`review-${c.id}`,`${'★'.repeat(guest.review.score)}${'☆'.repeat(5-guest.review.score)}${reason?' · '+t(REASONS[reason]):''}`,c,2.38,'station guest-review');}
 else if(detailed&&c===nearbyGuest&&guest.persona&&['sitting','waiting','drinking'].includes(c.state)){this.label(`persona-${c.id}`,t(PERSONAS[guest.persona].name),c,c.state==='waiting'?2.30:1.95,'station guest-persona');}}

 if(detailed)for(let i=0;i<b.level.table;i++)if(b.tableLevels[i]>0){
  const waiting=b.customers.filter(c=>c.state==='waiting'&&tableOfSeat(c.seat)===i);if(!waiting.length)continue;
  const counts=new Map<Menu,number>();for(const c of waiting)counts.set(c.kind,(counts.get(c.kind)??0)+1);
  const summary=[...counts].map(([kind,n])=>`${kind}:${n}`).join('|');this.label(`table-orders-${i}`,summary,TABLES[i],1.50,'station table-orders');
  const el=this.markers.get(`table-orders-${i}`)!;el.setAttribute('aria-label',waiting.map(c=>t(MENU[c.kind].name)).join(', '));el.classList.toggle('low',waiting.some(c=>c.patience/c.maxPatience<.35));
 }
 this.pickupCounter.visible=this.game.s.active===1&&b.takeaway.owned;if(this.pickupCounter.visible&&!this.overview&&distance(this.game.s.player,TAKEAWAY.service)<2.2)this.label('pickup',t('Paket teslim'),TAKEAWAY.guest,1.25,'station');
 this.readyCups.forEach((g,i)=>{const item=b.ready[i];g.visible=!!item;if(item)setProduct(g,item.kind);});this.servedCups.forEach((gs,i)=>gs.forEach((g,seat)=>{const customer=b.customers.find(c=>c.seat===seatId(i,seat)&&c.state==='drinking');g.visible=!!customer;if(customer)setProduct(g,customer.kind);}));
 const addTable=b.level.table<this.game.maxTables,expand=b.level.space<this.game.maxSpace;this.pad.visible=!this.guideActive&&(addTable||(expand&&!!b.staff.barista));
 if(this.pad.visible){const p=addTable?TABLES[b.level.table]:{x:1.8,z:this.game.floorEnd+1};this.pad.position.set(p.x,addTable?0:-.16,p.z);this.label('pad',addTable?`＋ ${this.game.price('table')}`:`${t('Yeni alan')} ＋ ${this.game.price('space')}`,p,addTable?.15:0,'build-pad');}
 const stations=[
  {key:'machine',text:`${t('Hazırlama')} · ${b.stock}/${this.game.stockCap} ${t('çekirdek')}${b.brew>0?' ◷':''}`,point:POINTS.machine,at:{x:-3.1,z:-3.7},height:2.50},
  {key:'supply',text:`${t('Malzeme deposu')} · ${Object.values(b.depot).reduce((n,v)=>n+v,0)}`,point:POINTS.supply,at:{x:-3.35,z:2.05},height:1.42},
  {key:'wash',text:`${t('Bulaşık yıkama')} · ${b.dirtyDishes}`,point:POINTS.wash,at:{x:-2.87,z:4.18},height:.68},
  ...Object.keys(b.dirtyTables).map(i=>({key:`dirty-${i}`,text:t('Temizle'),point:this.game.servicePoint(Number(i)*2),at:TABLES[Number(i)],height:1.25}))
 ];
 const focus=this.guidePoint??this.game.s.player,station=stations.filter(s=>distance(s.point,focus)<2.2).sort((a,b)=>distance(a.point,focus)-distance(b.point,focus))[0];
 if(!this.overview&&station)this.label(station.key,station.text,station.at,station.height,'station stock-label');
 const ring=this.world.getObjectByName('player-ring')!;ring.position.x=this.game.s.player.x;ring.position.z=this.game.s.player.z;ring.position.y=this.game.s.player.z>this.game.floorEnd?-.08:.08;this.steam.forEach((m,i)=>{m.visible=b.brew>0;m.position.y=2.08+((poseTime*.35+i*.11)%.85);m.position.x=-2.5+Math.sin(poseTime+i)*.06;});this.updateGuide(poseTime);this.resolveLabelCollisions();for(const [k,el] of this.markers){if(el.dataset.seen==='no'){el.remove();this.markers.delete(k);this.labelRects.delete(k);}}
 if(this.targetMark.visible&&this.game.s.player.path.length===0)this.targetMark.visible=false;
 // Remove departed guests and dispose their unique merged geometry; shared materials stay cached.
 if(time-this.lastCount>5){this.lastCount=time;const ids=new Set(b.customers.map(c=>`c${c.id}`));for(const [id,p] of this.people){if(/^c\d+$/.test(id)&&!ids.has(id)){p.root.traverse(o=>{if(o instanceof T.Mesh&&!o.userData.sharedProductGeometry)o.geometry.dispose();});p.root.removeFromParent();this.people.delete(id);}}}
 if(this.locale!==getLocale()){this.locale=getLocale();this.renderer.domElement.setAttribute('aria-label',getLocale()==='en'?'Interactive three-dimensional café':'Etkileşimli üç boyutlu kafe');}this.renderer.render(this.scene,this.camera);}
}
