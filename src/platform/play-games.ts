import {Capacitor,registerPlugin} from '@capacitor/core';
import {MAX_CHAIN_SCORE} from '../game/chain-score';

export type GamesProfile={authenticated:boolean;playerId?:string;displayName?:string};
export type RankingEntry={rank:number;displayName:string;score:number;isCurrentPlayer:boolean};
export type RankingState={status:'idle'|'loading'|'ready'|'error';entries:RankingEntry[];stale:boolean};
export interface GamesBridge {
 getProfile():Promise<GamesProfile>;
 signIn():Promise<GamesProfile>;
 submitScore(options:{score:number;playerId:string}):Promise<{submitted:boolean}>;
 showLeaderboard():Promise<void>;
 getTopScores():Promise<{entries:RankingEntry[];stale:boolean}>;
}
export type GamesStatus='unavailable'|'idle'|'loading'|'signed-out'|'connected'|'submitted'|'error'|'account-changed';
export type GamesState={status:GamesStatus;profile:GamesProfile;native:boolean;ranking?:RankingState};
const nativeGames=registerPlugin<GamesBridge>('CafePlayGames');

/** Transient identity only. Sharing is explicit and never follows an automatic account switch. */
export class CafePlayGames {
 state:GamesState;
 onChange=()=>{};
 private busy=false;
 private refreshPending=false;
 constructor(private bridge:GamesBridge|null=Capacitor.getPlatform()==='android'?nativeGames:null){
  this.state={status:bridge?'idle':'unavailable',profile:{authenticated:false},native:!!bridge};
 }
 private publish(status:GamesStatus,profile=this.state.profile){
  const changed=!profile.authenticated||profile.playerId!==this.state.profile.playerId;
  this.state={...this.state,status,profile,...(changed?{ranking:undefined}:{})};this.onChange();
 }
 private async action(task:()=>Promise<void>){
  if(!this.bridge||this.busy)return;
  this.busy=true;this.publish('loading');
  try{await task();}catch(error){
   const code=(error as {code?:string})?.code;
   this.publish(code==='UNAVAILABLE'?'unavailable':code==='ACCOUNT_CHANGED'?'account-changed':'error',{authenticated:false});
  }finally{
   this.busy=false;
   if(this.refreshPending){this.refreshPending=false;await this.refresh();}
  }
 }
 async refresh(signIn=false){
  // A resume/reopen during native UI must re-read the account after that work settles.
  // Coalesce these refreshes; never queue an interactive sign-in or a score submission.
  if(this.busy){if(!signIn)this.refreshPending=true;return;}
  await this.action(async()=>{
   const value=await (signIn?this.bridge!.signIn():this.bridge!.getProfile());
   const valid=value.authenticated&&typeof value.playerId==='string'&&value.playerId.length>0&&typeof value.displayName==='string';
   this.publish(valid?'connected':'signed-out',valid?{authenticated:true,playerId:value.playerId,displayName:value.displayName}:{authenticated:false});
  });
 }
 async share(score:number){
  const expected=this.state.profile.playerId;
  if(!this.state.profile.authenticated||!expected||!Number.isInteger(score)||score<0||score>MAX_CHAIN_SCORE)return;
  await this.action(async()=>{
   const profile=await this.bridge!.getProfile();
   if(!profile.authenticated||profile.playerId!==expected){this.publish('account-changed',{authenticated:false});return;}
   const result=await this.bridge!.submitScore({score,playerId:expected});
   this.publish(result.submitted?'submitted':'error',profile);
  });
 }
 async showRanking(){
  if(!this.state.profile.authenticated||this.busy)return;
  this.state={...this.state,ranking:{status:'loading',entries:[],stale:false}};
  await this.action(async()=>{
   const expected=this.state.profile.playerId;
   try{
    const result=await this.bridge!.getTopScores();
    const profile=await this.bridge!.getProfile();
    if(!profile.authenticated||profile.playerId!==expected){this.publish('account-changed',{authenticated:false});return;}
    if(!Array.isArray(result.entries))throw new Error('Invalid ranking');
    const entries=result.entries.filter(e=>e&&Number.isSafeInteger(e.rank)&&e.rank>0&&Number.isInteger(e.score)&&e.score>=0&&e.score<=MAX_CHAIN_SCORE&&typeof e.displayName==='string')
     .sort((a,b)=>a.rank-b.rank).slice(0,50).map(e=>({rank:e.rank,score:e.score,displayName:e.displayName.slice(0,200),isCurrentPlayer:e.isCurrentPlayer===true}));
    this.state={...this.state,ranking:{status:'ready',entries,stale:result.stale===true}};
    this.publish('connected',profile);
   }catch(error){
    const code=(error as {code?:string})?.code;
    if(code==='ACCOUNT_CHANGED'||code==='AUTH_REQUIRED'){
     this.publish(code==='ACCOUNT_CHANGED'?'account-changed':'signed-out',{authenticated:false});return;
    }
    this.state={...this.state,ranking:{status:'error',entries:[],stale:false}};
    this.publish('connected');
   }
  });
 }
}
