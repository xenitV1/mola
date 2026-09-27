import {Capacitor,type PluginListenerHandle} from '@capacitor/core';
import {CafeBuild,type AdConfiguration} from './native-build';
export type {AdConfiguration} from './native-build';
import {AdMob,AdmobConsentStatus,RewardAdPluginEvents,InterstitialAdPluginEvents} from '@capacitor-community/admob';
export type RewardKind='coins'|'tips'|'stock';
export type AdResult='rewarded'|'cancelled'|'unavailable'|'web';
// Native build variants select identity: debug always has Google's sample IDs.
// Web play never asks the plugin for a configuration and never requests an ad.
export const AD_LOAD_TIMEOUT_MS=15_000;
type Attempt={abort:AbortController;ended:boolean};
export type InterstitialResult='shown'|'cancelled'|'unavailable'|'web';
type InterstitialSlot={attempt:Attempt;handles:PluginListenerHandle[];readyAt:number;shown:boolean;finish?:(result:InterstitialResult)=>void};

export class RewardedAds {
 privacyRequired=false;
 onAdShown?:()=>void;
 private foreground=true;
 private interstitial?:InterstitialSlot;
 private sessionRefresh?:Promise<void>;
 private initialized=false;
 private configuration?:AdConfiguration;
 private phase:'idle'|'loading'|'preloading'|'consent'|'showing'|'privacy'='idle';
 private attempt?:Attempt;
 // Capacitor cannot cancel a native load. Do not start another until that call
 // settles: the plugin stores the loaded ad in a single shared native slot.
 private pending=new Set<Promise<unknown>>();
 get busy(){return this.phase!=='idle'||this.pending.size>0;}
 get loading(){return this.phase==='loading';}
 get ownsScreen(){return ['consent','showing','privacy'].includes(this.phase);}
 get interstitialReady(){return !!this.interstitial&&!this.interstitial.attempt.ended&&this.interstitial.readyAt>0&&Date.now()-this.interstitial.readyAt<55*60_000&&this.foreground&&!this.busy;}
 cancelLoading(){if(this.ownsScreen)return false;this.attempt?.abort.abort();return true;}
 setForeground(value:boolean){this.foreground=value;if(!value&&!this.ownsScreen){this.cancelLoading();this.discardInterstitial();}}
 private discardInterstitial(){const slot=this.interstitial;if(!slot)return;slot.attempt.ended=true;slot.attempt.abort.abort();void Promise.allSettled(slot.handles.map(h=>Promise.resolve().then(()=>h.remove())));this.interstitial=undefined;}
 private didShow(){try{this.onAdShown?.();}catch{/* Ad dismissal must remain available if a host callback fails. */}}

 // Check the SDK's current regional entry-point requirement on every launch.
 // This read-only check does not initialize, request or show an ad.
 startSession():Promise<void>{
  if(!Capacitor.isNativePlatform())return Promise.resolve();
  if(this.sessionRefresh)return this.sessionRefresh;
  const attempt:Attempt={abort:new AbortController(),ended:false};
  this.sessionRefresh=(async()=>{
   try{const info=await this.waitNative(AdMob.requestConsentInfo(),attempt);this.privacyRequired=info.privacyOptionsRequirementStatus==='REQUIRED';}
   catch{/* Offline startup must not block café play. An explicit ad attempt retries. */}
   finally{attempt.ended=true;}
  })();
  return this.sessionRefresh;
 }

 private async waitNative<T>(operation:Promise<T>,attempt:Attempt,timeout=AD_LOAD_TIMEOUT_MS):Promise<T>{
  this.pending.add(operation);
  void operation.then(()=>this.pending.delete(operation),()=>this.pending.delete(operation));
  let timer:ReturnType<typeof setTimeout>|undefined;
  let abort:()=>void=()=>{};
  const stopped=new Promise<never>((_,reject)=>{
   abort=()=>reject(new Error('Ad request cancelled'));
   if(attempt.abort.signal.aborted)abort();
   else attempt.abort.signal.addEventListener('abort',abort,{once:true});
   if(timeout)timer=setTimeout(()=>reject(new Error('Ad request timed out')),timeout);
  });
  try{return await Promise.race([operation,stopped]);}
  finally{clearTimeout(timer);attempt.abort.signal.removeEventListener('abort',abort);}
 }

 private async consent(attempt:Attempt,allowConsentForm=true){
  let info=await this.waitNative(AdMob.requestConsentInfo(),attempt);
  this.privacyRequired=info.privacyOptionsRequirementStatus==='REQUIRED';
  if(info.status===AdmobConsentStatus.REQUIRED&&info.isConsentFormAvailable){
   if(!allowConsentForm)return false;
   this.phase='consent';
   // A person's privacy decision must never be cut short by a loading timer.
   info=await this.waitNative(AdMob.showConsentForm(),attempt,0);
   this.phase='loading';
   this.privacyRequired=info.privacyOptionsRequirementStatus==='REQUIRED';
  }
  // Ownership or foreground state can change while the native consent UI is
  // open. Let that UI close normally, then stop before any ad initialization.
  if(!info.canRequestAds||!this.foreground||attempt.abort.signal.aborted)return false;
  if(!this.configuration){
   const configuration=await this.waitNative(CafeBuild.getAdConfiguration(),attempt);
   if(typeof configuration.test!=='boolean'||!/^ca-app-pub-\d{16}~\d{10}$/.test(configuration.appId)||!['coins','tips','stock'].every(kind=>/^ca-app-pub-\d{16}\/\d{10}$/.test(configuration.rewarded?.[kind as RewardKind])))return false;
   this.configuration=configuration;
  }
  if(!this.foreground||attempt.abort.signal.aborted)return false;
  if(!this.initialized){
   await this.waitNative(AdMob.initialize({initializeForTesting:this.configuration!.test}),attempt);
   this.initialized=true;
  }
  return this.foreground&&!attempt.abort.signal.aborted;
 }

 async privacy(){
  if(!Capacitor.isNativePlatform()||this.busy)return;
  this.discardInterstitial();this.phase='privacy';
  try{await AdMob.showPrivacyOptionsForm();}
  finally{this.phase='idle';}
 }

 // Register dismissal callbacks during preload, so a natural break never waits
 // for network, consent, or listener registration before deciding to show.
 async preloadInterstitial(options:{allowConsentForm?:boolean}={}):Promise<boolean>{
  if(!Capacitor.isNativePlatform()||!this.foreground||this.busy)return false;
  if(this.interstitialReady)return true;
  this.discardInterstitial();const attempt:Attempt={abort:new AbortController(),ended:false};
  const slot:InterstitialSlot={attempt,handles:[],readyAt:0,shown:false};this.interstitial=slot;this.attempt=attempt;this.phase='preloading';let ready=false;
  try{
   if(!await this.consent(attempt,options.allowConsentForm===true)||!this.foreground||attempt.abort.signal.aborted)return false;
   const unit=this.configuration?.interstitial;if(!unit||!/^ca-app-pub-\d{16}\/\d{10}$/.test(unit))return false;
   this.phase='preloading';await this.waitNative(AdMob.prepareInterstitial({adId:unit,isTesting:this.configuration!.test}),attempt);
   const listen=async(event:InterstitialAdPluginEvents,callback:()=>void)=>{
    await this.waitNative(AdMob.addListener(event as InterstitialAdPluginEvents.Dismissed,callback).then(async handle=>{
     if(attempt.ended||attempt.abort.signal.aborted)await handle.remove().catch(()=>{});else slot.handles.push(handle);
    }),attempt);
   };
   const live=()=>!attempt.ended&&this.interstitial===slot&&!!slot.finish;
   await listen(InterstitialAdPluginEvents.Showed,()=>{if(live()&&!slot.shown){slot.shown=true;this.didShow();}});
   await listen(InterstitialAdPluginEvents.Dismissed,()=>{if(live())slot.finish!(slot.shown?'shown':'cancelled');});
   await listen(InterstitialAdPluginEvents.FailedToShow,()=>{if(live())slot.finish!(slot.shown?'shown':'unavailable');});
   if(!this.foreground||attempt.abort.signal.aborted)return false;
   slot.readyAt=Date.now();ready=true;return true;
  }catch{return false;}
  finally{this.phase='idle';this.attempt=undefined;if(!ready)this.discardInterstitial();}
 }

 async showInterstitial():Promise<InterstitialResult>{
  if(!Capacitor.isNativePlatform())return 'web';
  if(!this.interstitialReady)return 'unavailable';
  const slot=this.interstitial!;this.phase='showing';let settled=false;
  const closed=new Promise<InterstitialResult>(resolve=>{slot.finish=result=>{if(settled)return;settled=true;resolve(result);};});
  try{
   // AdMob owns its close button and duration. A resolved show promise is not
   // proof of visibility or dismissal; only native fullscreen events are.
   void AdMob.showInterstitial().catch(()=>slot.finish?.(slot.shown?'shown':'unavailable'));
   return await closed;
  }catch{return slot.shown?'shown':'unavailable';}
  finally{this.discardInterstitial();this.phase='idle';}
 }

 async show(kind:RewardKind,grant:(id:string,kind:RewardKind)=>void):Promise<AdResult>{
  if(!Capacitor.isNativePlatform())return 'web';
  if(this.busy||!this.foreground)return 'unavailable';
  const attempt:Attempt={abort:new AbortController(),ended:false};
  this.attempt=attempt;this.phase='loading';
  const handles:PluginListenerHandle[]=[];
  let rewarded=false,settled=false,shown=false;
  const id=crypto.randomUUID();
  try{
   if(!await this.consent(attempt)||!this.foreground||attempt.abort.signal.aborted)return 'unavailable';
   await this.waitNative(AdMob.prepareRewardVideoAd({adId:this.configuration!.rewarded[kind],isTesting:this.configuration!.test}),attempt);
   let finish!:(result:AdResult)=>void;
   const closed=new Promise<AdResult>(resolve=>{finish=result=>{if(settled)return;settled=true;resolve(result);};});
   const listen=async(event:RewardAdPluginEvents,callback:()=>void)=>{
    const registration=AdMob.addListener(event as RewardAdPluginEvents.Rewarded,callback).then(async handle=>{
     if(attempt.ended||attempt.abort.signal.aborted){await handle.remove().catch(()=>{});}
     else handles.push(handle);
    });
    await this.waitNative(registration,attempt);
   };
   await listen(RewardAdPluginEvents.Rewarded,()=>{
    if(!attempt.ended&&!settled&&!rewarded&&this.phase==='showing'){
     rewarded=true;grant(id,kind);
    }
   });
   await listen(RewardAdPluginEvents.Showed,()=>{if(!attempt.ended&&!settled&&!shown&&this.phase==='showing'){shown=true;this.didShow();}});
   await listen(RewardAdPluginEvents.Dismissed,()=>finish(rewarded?'rewarded':'cancelled'));
   await listen(RewardAdPluginEvents.FailedToShow,()=>finish(rewarded?'rewarded':'unavailable'));
   if(attempt.abort.signal.aborted||!this.foreground)return 'cancelled';
   this.phase='showing';
   // The plugin's show promise resolves on reward, not on dismissal, and can
   // remain pending after a skipped ad. Dismissal is the lifecycle authority.
   void AdMob.showRewardVideoAd().catch(()=>finish(rewarded?'rewarded':'unavailable'));
   return await closed;
  }catch{return attempt.abort.signal.aborted?'cancelled':'unavailable';}
  finally{
   attempt.ended=true;
   this.phase='idle';this.attempt=undefined;
   // One failed native listener removal must not leave the café locked.
   void Promise.allSettled(handles.map(h=>Promise.resolve().then(()=>h.remove())));
  }
 }
}
