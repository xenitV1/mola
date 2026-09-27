import {Capacitor,registerPlugin,type PluginListenerHandle} from '@capacitor/core';
import {isLifetimeBonusAmount} from '../game/monetization';
export type PurchaseStatus='unavailable'|'loading'|'ready'|'opening'|'pending'|'verifying'|'owned'|'cancelled'|'error'|'verification_failed'|'price_changed'|'revoked'|'not_owned';
export type PurchaseState={owned:boolean;activatedAt:number;status:PurchaseStatus;price:string;canPurchase:boolean;bonusGrantId?:string;bonusAmount?:number;bonusPending?:boolean};
export interface PurchasePort {
 getCached():Promise<PurchaseState>;
 refresh(options?:{restore:boolean}):Promise<PurchaseState>;
 purchase():Promise<PurchaseState>;
 addListener(event:'stateChanged',listener:(state:PurchaseState)=>void):Promise<PluginListenerHandle>;
}
const unavailable=():PurchaseState=>({owned:false,activatedAt:0,status:'unavailable',price:'',canPurchase:false});
const native=registerPlugin<PurchasePort>('CafeBilling');
export interface NoAdsPurchasePort extends PurchasePort {acknowledgeBonus(options:{grantId:string}):Promise<{acknowledged:boolean;state:PurchaseState}>;}
const noAdsNative=registerPlugin<NoAdsPurchasePort>('CafeNoAdsBilling');
export class OfflinePass {
 state=unavailable();onChange:()=>void=()=>{};private listenerReady?:Promise<PluginListenerHandle>;private sequence=0;
 constructor(protected port:PurchasePort|null=Capacitor.getPlatform()==='android'?native:null){}
 get owned(){return this.state.owned;}
 get activatedAt(){return this.state.activatedAt;}
 get busy(){return ['loading','opening','verifying'].includes(this.state.status);}
 protected apply(value:PurchaseState){
  if(!value||typeof value.owned!=='boolean'||!Number.isFinite(value.activatedAt)||typeof value.status!=='string')return;
  this.state={...value,owned:value.owned&&value.activatedAt>0,price:typeof value.price==='string'?value.price:'',canPurchase:value.canPurchase===true&&!value.owned};this.onChange();
 }
 async loadCached(){
  if(!this.port)return;
  let timer:ReturnType<typeof setTimeout>|undefined;
  try{const value=await Promise.race([this.port.getCached(),new Promise<null>(resolve=>{timer=setTimeout(()=>resolve(null),3000);})]);if(value)this.apply(value);}catch{/* No entitlement on a missing/broken platform plugin. */}finally{clearTimeout(timer);}
 }
 async refresh(restore=false){
  if(!this.port)return;
  try{
   const firstListener=!this.listenerReady;
   this.listenerReady??=this.port.addListener('stateChanged',value=>{this.sequence++;this.apply(value);});
   try{await this.listenerReady;}catch(error){this.listenerReady=undefined;throw error;}
   if(firstListener&&this.busy){const request=this.sequence,cached=await this.port.getCached();if(request===this.sequence)this.apply(cached);}
   if(this.busy)return;
   const request=this.sequence;const value=await this.port.refresh({restore});if(request===this.sequence)this.apply(value);
  }catch{this.state={...this.state,status:this.owned?'owned':'unavailable',canPurchase:false};this.onChange();}
 }
 async purchase(){
  if(!this.port||!this.state.canPurchase||this.busy)return;
  this.state={...this.state,status:'opening',canPurchase:false};this.onChange();
  try{const request=this.sequence;const value=await this.port.purchase();if(request===this.sequence)this.apply(value);}
  catch{this.state={...this.state,status:'error',canPurchase:false};this.onChange();}
 }
}

/** Full Unlock includes ad removal and paid offline simulation. */
export class LifetimeNoAds extends OfflinePass {
 constructor(private noAdsPort:NoAdsPurchasePort|null=Capacitor.getPlatform()==='android'?noAdsNative:null){super(noAdsPort);}
 protected override apply(value:PurchaseState){
  const valid=value?.owned===true&&value.activatedAt>0&&typeof value.bonusGrantId==='string'&&/^lifetime_no_ads:[a-f0-9]{64}$/.test(value.bonusGrantId)&&isLifetimeBonusAmount(value.bonusAmount);
  super.apply({...value,bonusGrantId:valid?value.bonusGrantId:'',bonusAmount:valid?value.bonusAmount:0,bonusPending:valid&&value.bonusPending===true});
 }
 /** Call only after persisting the save containing the matching credited grant ID.
  * Retry after process death is safe: the game save and native ledger each dedupe. */
 async acknowledgeBonus(grantId:string):Promise<boolean>{
  if(!this.noAdsPort||!this.owned||this.state.bonusGrantId!==grantId)return false;
  try{const result=await this.noAdsPort.acknowledgeBonus({grantId});if(result.state)this.apply(result.state);return result.acknowledged===true;}catch{return false;}
 }
}

export const DIAMOND_PACKS={diamonds_100:100,diamonds_500:500,diamonds_5000:5000,diamonds_10000:10000} as const;
export type DiamondProductId=keyof typeof DIAMOND_PACKS;
export type DiamondGrant={grantId:string;productId:DiamondProductId;amount:number};
export type DiamondProduct={productId:DiamondProductId;amount:number;price:string;canPurchase:boolean};
export type DiamondState={status:PurchaseStatus;products:DiamondProduct[];grants:DiamondGrant[]};
export type DiamondStoreState=DiamondState;
export interface DiamondPurchasePort {
 getCached():Promise<DiamondState>;refresh():Promise<DiamondState>;
 purchase(options:{productId:DiamondProductId}):Promise<DiamondState>;
 acknowledgeGrant(options:{grantId:string}):Promise<{acknowledged:boolean;state:DiamondState}>;
 addListener(event:'stateChanged',listener:(state:DiamondState)=>void):Promise<PluginListenerHandle>;
}
const diamondNative=registerPlugin<DiamondPurchasePort>('CafeDiamondBilling');
const emptyDiamondState=():DiamondState=>({status:'unavailable',products:Object.entries(DIAMOND_PACKS).map(([productId,amount])=>({productId:productId as DiamondProductId,amount,price:'',canPurchase:false})),grants:[]});
export class DiamondStore {
 state=emptyDiamondState();onChange:()=>void=()=>{};private sequence=0;private listener?:Promise<PluginListenerHandle>;
 constructor(private port:DiamondPurchasePort|null=Capacitor.getPlatform()==='android'?diamondNative:null){}
 get busy(){return ['loading','opening','verifying'].includes(this.state.status);}
 private apply(value:DiamondState){
  if(!value||!Array.isArray(value.products)||!Array.isArray(value.grants))return;
  const products=emptyDiamondState().products.map(item=>{const found=value.products.find(p=>p.productId===item.productId);return {...item,price:typeof found?.price==='string'?found.price:'',canPurchase:found?.canPurchase===true&&typeof found.price==='string'&&found.price.length>0};});
  const seen=new Set<string>();const grants=value.grants.filter(g=>g&&Object.hasOwn(DIAMOND_PACKS,g.productId)&&g.amount===DIAMOND_PACKS[g.productId]&&/^diamonds:[a-f0-9]{64}$/.test(g.grantId)&&!seen.has(g.grantId)&&!!seen.add(g.grantId));
  this.state={status:value.status,products,grants};this.onChange();
 }
 async loadCached(){if(!this.port)return;let timer:ReturnType<typeof setTimeout>|undefined;try{const state=await Promise.race([this.port.getCached(),new Promise<null>(resolve=>{timer=setTimeout(()=>resolve(null),3000);})]);if(state)this.apply(state);}catch{}finally{clearTimeout(timer);}}
 async refresh(){if(!this.port)return;try{const firstListener=!this.listener;this.listener??=this.port.addListener('stateChanged',s=>{this.sequence++;this.apply(s);});try{await this.listener;}catch(error){this.listener=undefined;throw error;}if(firstListener&&this.busy){const seq=this.sequence,cached=await this.port.getCached();if(seq===this.sequence)this.apply(cached);}if(this.busy)return;const seq=this.sequence,state=await this.port.refresh();if(seq===this.sequence)this.apply(state);}catch{this.state={...this.state,status:'unavailable',products:this.state.products.map(p=>({...p,canPurchase:false}))};this.onChange();}}
 async purchase(productId:DiamondProductId){if(!this.port||this.busy||!this.state.products.some(p=>p.productId===productId&&p.canPurchase))return;this.state={...this.state,status:'opening'};this.onChange();try{const seq=this.sequence,state=await this.port.purchase({productId});if(seq===this.sequence)this.apply(state);}catch{this.state={...this.state,status:'error'};this.onChange();}}
 /** The caller must persist wallet + grant ID before this. Native persists ack,
  * then server consumes; an outage retries consumption without crediting again. */
 async acknowledgeGrant(grantId:string):Promise<boolean>{if(!this.port||!this.state.grants.some(g=>g.grantId===grantId))return false;try{const seq=this.sequence,result=await this.port.acknowledgeGrant({grantId});if(result.state&&seq===this.sequence)this.apply(result.state);return result.acknowledged===true;}catch{return false;}}
}
