import {developmentGold} from './gold-prices';
/** Shared furniture dimensions and stable seat identity. Tier upgrades change
 * placement/capacity, never reuse an existing guest's ID for another table. */
export const TABLE_TYPES = [
 {name:'İki kişilik bistro masası',comfort:0,tableTop:.95,seats:2,cost:0,space:0,width:1.38,depth:1.38},
 {name:'Dört kişilik koltuk grubu',comfort:2,tableTop:.85,seats:4,cost:developmentGold(1200,true),space:0,width:1.4,depth:1.4},
 {name:'Altı kişilik L koltuk',comfort:4,tableTop:.74,seats:6,cost:developmentGold(4800,true),space:1,width:1.45,depth:2},
 {name:'On kişilik salon grubu',comfort:6,tableTop:.74,seats:10,cost:developmentGold(18000,true),space:2,width:1.65,depth:2.7},
] as const;
const tierIndex=(tier:number)=>Math.max(0,Math.min(3,Math.floor(tier)));
export const tableOfSeat=(id:number)=>id<12?Math.floor(id/2):Math.floor((id-12)/8);
export const localSeat=(id:number)=>id<12?id%2:2+(id-12)%8;
export const seatId=(table:number,local:number)=>local<2?table*2+local:12+table*8+(local-2);
export const tableSeats=(table:number,tier:number)=>Array.from({length:TABLE_TYPES[tierIndex(tier)].seats},(_,local)=>seatId(table,local));
const offsets = [
 [[-1,0],[1,0]],
 [[-1.05,0],[1.05,0],[0,-1.05],[0,1.05]],
 [[-1.15,-.65],[1.15,-.65],[-1.15,.65],[1.15,.65],[0,-1.55],[0,1.55]],
 [[-1.3,0],[1.3,0],[-1.3,-1],[1.3,-1],[-1.3,1],[1.3,1],[-.52,-1.9],[.52,-1.9],[-.52,1.9],[.52,1.9]],
] as const;
export function seatOffset(id:number,tier:number){
 const t=tierIndex(tier),local=localSeat(id),point=offsets[t][local];
 if(!point)throw new RangeError(`Seat ${id} does not exist at table tier ${t}`);
 const [x,z]=point;
 const end=t===1?local>=2:t===2?local>=4:t===3?local>=6:false;
 return {x,z,angle:end?(z<0?0:Math.PI):(x<0?Math.PI/2:-Math.PI/2)};
}
export function seatLocalApproach(id:number,tier:number){
 const seat=seatOffset(id,tier);
 // Preserve the original sideways two-seat approach for existing saves.
 return tierIndex(tier)===0?{x:seat.x,z:seat.z+.60}:{x:seat.x-Math.sin(seat.angle)*.60,z:seat.z-Math.cos(seat.angle)*.60};
}
export function tableBounds(tier:number){const {width,depth}=TABLE_TYPES[tierIndex(tier)];return {width,depth,halfWidth:width/2,halfDepth:depth/2};}
export function dishOffset(local:number,tier:number){
 const t=tierIndex(tier);if(t===0)return {x:local===0?-.28:.28,z:0};
 const seat=seatOffset(seatId(0,local),t),bounds=tableBounds(t);
 return Math.abs(Math.sin(seat.angle))>.5?{x:Math.sign(seat.x)*(bounds.halfWidth-.25),z:t===3?(local===0?-.255:local===1?.255:seat.z*.655):seat.z}:{x:seat.x,z:Math.sign(seat.z)*(t===3?1.055:bounds.halfDepth-.25)};
}

/** Continuous L-sofa footprint: left bank plus south bank. South keeps the
 * north-row seating clear of the permanent stage. Bounds include padded backs. */
export function sofaBlocks(tier:number):{x:number;z:number;width:number;depth:number}[]{
 if(tier<2)return [];const left=tier===2?-1.15:-1.3,top=tier===2?-.65:-1,bottom=tier===2?1.55:1.9,right=tier===2?0:.52;
 return [{x:left,z:(top+bottom)/2,width:.8,depth:bottom-top+.8},{x:(left+right)/2,z:bottom,width:right-left+.8,depth:.8}];
}
