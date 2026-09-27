import {SEATING,easeSeat,seatFacing} from '../game/layout';
import type {Actor,Customer} from '../game/sim';
import {setProduct,type Person} from './models';

type Motion={time:number;x:number;z:number;phase:number;stride:number};
const motions=new WeakMap<Person,Motion>();
export function seatedAmount(c?:Customer){
  if(!c)return 0;
  if(c.state==='waiting'||c.state==='drinking')return 1;
  if(c.state==='sitting')return easeSeat(1-c.timer/SEATING.sitSeconds);
  if(c.state==='standing')return easeSeat(c.timer/SEATING.standSeconds);
  return 0;
}
// Lowest corner of each shoe after hip and knee rotation, in body space.
export function footBottom(hip:number,knee:number){const angle=hip+knee;return SEATING.hipHeight-.18*Math.cos(hip)-.217*Math.cos(angle)-.055*Math.sin(angle)-.045*Math.abs(Math.cos(angle))-.17*Math.abs(Math.sin(angle));}
export function animatePose(p:Person,a:Actor,role:string,time:number,floor:number,cushions:boolean,motion:boolean,tint:number,c?:Customer,working=false){
  let state=motions.get(p);const reset=!state||time<state.time||Math.hypot(a.x-state.x,a.z-state.z)>3;
  if(reset){state={time,x:a.x,z:a.z,phase:0,stride:role==='customer'?.95:role==='player'?1.25:1.15};motions.set(p,state);p.root.position.set(a.x,floor,a.z);p.root.rotation.y=a.angle;}
  const m=state!,dt=Math.max(0,Math.min(.12,time-m.time)),travel=Math.hypot(a.x-m.x,a.z-m.z);
  const seat=seatedAmount(c);if(dt>0&&a.moving&&seat===0)m.phase+=travel/m.stride*Math.PI*2;
  const easing=reset?1:1-Math.exp(-20*dt);
  p.root.position.x+=(a.x-p.root.position.x)*easing;p.root.position.z+=(a.z-p.root.position.z)*easing;p.root.position.y=floor;
  const angle=c&&['sitting','waiting','drinking','standing'].includes(c.state)?(c.seatAngle??seatFacing(c.seat)):working?-Math.PI/2:a.angle;
  const delta=Math.atan2(Math.sin(angle-p.root.rotation.y),Math.cos(angle-p.root.rotation.y));p.root.rotation.y+=Math.max(-dt*10,Math.min(dt*10,delta));
  const walking=a.moving&&seat===0;
  for(let i=0;i<2;i++){
    const wave=Math.sin(m.phase+i*Math.PI),hip=walking?wave*.62:0,knee=walking?Math.max(0,-wave)*.55:0;
    p.legs[i].rotation.x=hip*(1-seat)-Math.PI/2*seat;p.knees[i].rotation.x=knee*(1-seat)+Math.PI/2*seat;
    const arm=a.cups.length||a.beans?-1.1:walking?-wave*.36:working?-.8+Math.sin(time*5+i)*.12:0;
    p.arms[i].rotation.x=arm*(1-seat)+(c?.state==='drinking'?-.95:-.42)*seat;
  }
  const ground=SEATING.floorSurface-Math.min(footBottom(p.legs[0].rotation.x*(1-seat),p.knees[0].rotation.x*(1-seat)),footBottom(p.legs[1].rotation.x*(1-seat),p.knees[1].rotation.x*(1-seat)));
  const chair=(cushions?SEATING.cushionTop:SEATING.seatTop)-SEATING.hipHeight+SEATING.thighHalfDepth;
  p.body.position.y=ground*(1-seat)+chair*seat;
  p.bag.visible=!!c?.takeaway&&c.paid&&a.cups.length>0;p.tray.visible=a.cups.length>0&&!p.bag.visible;p.crate.visible=a.beans>0;p.cupHolders.forEach((v,i)=>{const item=a.cups[i];v.visible=!!item;if(item){setProduct(v,item.kind);const count=a.cups.length,r=count===1?0:count===2?.16:.23,angle=i*Math.PI*2/count-Math.PI/2;v.position.x=Math.cos(angle)*r;v.position.z=Math.sin(angle)*r;}});
  p.head.rotation.z=motion?Math.sin(time*1.4+tint)*.025:0;const blink=(time+tint*.73)%4.7;p.eyes.scale.y=motion&&blink<.12?.12:1;
  m.time=time;m.x=a.x;m.z=a.z;
}
