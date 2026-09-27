import type {Save} from './sim';

export const MAX_CHAIN_SCORE = 4_000_500;
const bounded=(value:number,max:number)=>Number.isFinite(value)?Math.max(0,Math.min(max,value)):0;

/** Casual local progression score, not an authoritative proof of gameplay. */
export function chainScore(save:Pick<Save,'branches'>){
 const branches=[0,1,2].map(id=>save.branches[id]).filter(b=>!!b);
 const stars=branches.reduce((sum,b)=>sum+Math.floor(bounded(b.mastery,3)),0);
 const services=Math.min(10_000,branches.reduce((sum,b)=>sum+Math.floor(bounded(b.served,10_000)),0));
 const rated=branches.filter(b=>Number.isFinite(b.served)&&b.served>=20);
 const weight=rated.reduce((sum,b)=>sum+bounded(b.served,10_000),0);
 const ratingPoints=weight?Math.round(rated.reduce((sum,b)=>sum+bounded(b.rating,5)*bounded(b.served,10_000),0)/weight*100):0;
 return {branches:branches.length,stars,services,ratingPoints,total:branches.length*1_000_000+stars*100_000+services*10+ratingPoints};
}
