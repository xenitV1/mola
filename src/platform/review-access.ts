import {Capacitor,registerPlugin} from '@capacitor/core';

export type ReviewAccessState={available:boolean;active:boolean;activatedAt:number;grantId:string};
export interface ReviewAccessPort {
 getCached():Promise<ReviewAccessState>;
 activate(options:{code:string}):Promise<{accepted:boolean;state:ReviewAccessState}>;
 disable():Promise<ReviewAccessState>;
}
const native=registerPlugin<ReviewAccessPort>('CafeReviewAccess');
const inactive=():ReviewAccessState=>({available:false,active:false,activatedAt:0,grantId:''});
const validGrant=(id:unknown)=>typeof id==='string'&&/^review:[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/.test(id);

export class ReviewAccess {
 state=inactive();onChange:()=>void=()=>{};busy=false;
 constructor(private port:ReviewAccessPort|null=Capacitor.getPlatform()==='android'?native:null){}
 private apply(value:ReviewAccessState){
  const valid=value?.available===true&&Number.isFinite(value.activatedAt)&&value.activatedAt>0&&validGrant(value.grantId);
  this.state={available:value?.available===true,active:valid&&value.active===true,activatedAt:valid?value.activatedAt:0,grantId:valid?value.grantId:''};
  this.onChange();
 }
 async loadCached(){
  if(!this.port)return;
  let timer:ReturnType<typeof setTimeout>|undefined;
  try{const state=await Promise.race([this.port.getCached(),new Promise<null>(resolve=>{timer=setTimeout(()=>resolve(null),3000);})]);if(state)this.apply(state);}catch{}finally{clearTimeout(timer);}
 }
 async activate(code:string):Promise<boolean>{
  if(!this.port||this.busy||typeof code!=='string'||code.length>128)return false;
  this.busy=true;
  try{const result=await this.port.activate({code});this.apply(result.state);return result.accepted===true&&this.state.active;}catch{return false;}finally{this.busy=false;}
 }
 async disable():Promise<boolean>{
  if(!this.port||this.busy)return false;
  this.busy=true;
  try{this.apply(await this.port.disable());return !this.state.active;}catch{return false;}finally{this.busy=false;}
 }
}
