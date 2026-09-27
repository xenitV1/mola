import {TUNING} from './config';
import type {Simulation} from './sim';
import type {RewardKind} from '../platform/ads';
export const LIFETIME_BONUS=50_000;
export const LEGACY_LIFETIME_BONUS=300_000;
export function isLifetimeBonusAmount(value:unknown):value is number{return value===LIFETIME_BONUS||value===LEGACY_LIFETIME_BONUS;}
export const REWARD_COOLDOWN:Record<RewardKind,number>={coins:60,tips:120,stock:60};
export type MonetizationSave={bonusGrants:string[];rewardReadyAt:Partial<Record<RewardKind,number>>};
const initial=():MonetizationSave=>({bonusGrants:[],rewardReadyAt:{}});
/** Ownership comes from the verified native purchase, never from this save. */
export function creditLifetimeBonus(game:Simulation,owned:boolean,grantId:string,commit:()=>boolean,amount=LIFETIME_BONUS):'credited'|'recorded'|'unavailable'|'wallet-full'|'save-failed'{
 if(!owned||!/^lifetime_no_ads:[a-f0-9]{64}$/.test(grantId)||!isLifetimeBonusAmount(amount))return 'unavailable';
 return creditBonus(game,grantId,commit,amount);
}
export function creditReviewBonus(game:Simulation,active:boolean,grantId:string,commit:()=>boolean,amount=LIFETIME_BONUS){
 if(!active||!/^review:[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/.test(grantId)||!isLifetimeBonusAmount(amount))return 'unavailable';
 return creditBonus(game,grantId,commit,amount);
}
function creditBonus(game:Simulation,grantId:string,commit:()=>boolean,amount:number):'credited'|'recorded'|'unavailable'|'wallet-full'|'save-failed'{
 const previous=game.s.monetization;
 if(previous?.bonusGrants.includes(grantId))return 'recorded';
 if((previous?.bonusGrants.length??0)>=20)return 'unavailable';
 if(game.s.coins>TUNING.maxMoney-amount)return 'wallet-full';
 const coins=game.s.coins;
 game.s.monetization={bonusGrants:[...(previous?.bonusGrants??[]),grantId],rewardReadyAt:{...previous?.rewardReadyAt}};
 game.s.coins+=amount;
 if(!commit()){game.s.coins=coins;game.s.monetization=previous;return 'save-failed';}
 return 'credited';
}
export function rewardWait(game:Simulation,kind:RewardKind,now=Date.now()){
 return Math.max(0,Math.ceil(((game.s.monetization?.rewardReadyAt[kind]??0)-now)/1000));
}
export function claimAdFreeReward(game:Simulation,owned:boolean,kind:RewardKind,now=Date.now()){
 if(!owned||!Object.hasOwn(REWARD_COOLDOWN,kind)||rewardWait(game,kind,now)>0||game.rewardAmount(kind)<=0)return false;
 const state=game.s.monetization??=initial();
 if(!game.reward(crypto.randomUUID(),kind))return false;
 state.rewardReadyAt[kind]=now+REWARD_COOLDOWN[kind]*1000;return true;
}
