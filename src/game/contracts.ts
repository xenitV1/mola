import {MENU,type Menu} from './config';
import type {Simulation} from './sim';
export type SpecialOrder={id:number;kind:Menu;target:number;fulfilled:number;seconds:number;reward:number;status:'active'|'ready'|'failed'};
export function contractOffers(g:Simulation){
 const completed=g.b.contractsCompleted,preferred:Menu=g.def.preference;
 // A forgiving first order teaches the loop. Later, a voluntary rush order
 // rewards focusing on this neighbourhood's taste; a steady choice remains.
 const primary:Menu[]=completed?[preferred==='cake'?'espresso':'cake',preferred]:['espresso','cake'];
 const premium=(['iced','lemonade','cheesecake'] as Menu[]).filter(k=>g.b.catalog[k]>0&&!primary.includes(k)).at(-1);
 return [...primary,...(premium?[premium]:[])].map(kind=>{
  const rush=completed>0&&kind===preferred;
  const target=rush?8:Math.min(6,(MENU[kind].category==='Tatlı'?4:6)+Math.floor(completed/3));
  // Rush windows are set against a busy café: a mixed menu must not carry them.
  const seconds=Math.round(rush?[18,15,22][g.s.active]+target*[6.5,4.6,5.6][g.s.active]:100+MENU[kind].brew*target);
  return {kind,target,seconds,reward:Math.round(MENU[kind].price*target*(rush?1.2:.7)),rush};
 });
}
