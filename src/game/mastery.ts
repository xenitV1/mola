import {BRANCHES} from './config';
import type {Branch} from './sim';
export type Goal={label:string;current:number;target:number};
export function masteryGoals(branch:Branch,index:number){
 const favourite=[
  'Latteyi sabrının yarısı dolmadan servis et.',
  'Espressoyu sabrının %60’ı dururken servis et.',
  'En az 2. seviye çekirdekle kahve ve pasta servis et.',
 ][index];
 const tiers=[
  {title:'Semtin buluşma noktası',reward:1000,goals:[
   {label:'Tamamlanan servis',current:branch.served,target:40},
   {label:'Çalışan görevleri',current:Object.values(branch.staff).filter(n=>n>0).length,target:3},
   {label:'Masa',current:branch.level.table,target:2},
  ]},
  {title:'Müdavimlerin favorisi',reward:4000,goals:[
   {label:favourite,current:branch.signatureServed,target:50},
   {label:'Puan',current:branch.rating,target:4.3},
  ]},
  {title:'Semtin yıldızı',reward:12000,goals:[
   {label:'Tamamlanan servis',current:branch.served,target:250},
   {label:favourite,current:branch.signatureServed,target:100},
   {label:'Masa',current:branch.level.table,target:BRANCHES[index].seats/2},
   {label:'Barista seviyesi',current:branch.staff.barista,target:2},
   {label:'Garson seviyesi',current:branch.staff.waiter,target:2},
   {label:'Puan',current:branch.rating,target:4.4},
  ]},
 ];
 return tiers.map((tier,i)=>({...tier,claimed:branch.mastery>i,ready:branch.mastery===i&&tier.goals.every(g=>g.current+1e-8>=g.target)}));
}
