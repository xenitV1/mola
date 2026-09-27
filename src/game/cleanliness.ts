/** Real customer movement creates bounded maintenance jobs; idle time does not. */
export type DirtZone='floor'|'front';
export type DirtPatch={id:number;x:number;z:number;zone:DirtZone;kind:'spill'|'litter';work:number};
export type CleanlinessState={patches:DirtPatch[];serial:number;floorTravel:number;frontTravel:number;cleaned:number};
export const DIRT_LIMITS={floor:12,front:8} as const;
export const DIRT_TRAVEL={floor:65,front:90} as const;
export const freshCleanliness=():CleanlinessState=>({patches:[],serial:0,floorTravel:0,frontTravel:0,cleaned:0});
export const dirtSeconds=(p:DirtPatch)=>p.kind==='spill'?2:1.5;
export function dirtExposure(patches:DirtPatch[],point:{x:number;z:number},outside:boolean){
 const local=patches.filter(p=>p.zone===(outside?'front':'floor'));
 const nearby=local.reduce((n,p)=>n+Math.max(0,1-Math.hypot(point.x-p.x,point.z-p.z)/3.5),0);
 return Math.min(.6,local.length*.022+nearby*.12);
}
