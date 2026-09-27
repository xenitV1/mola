import {getLocale,number,t} from '../game/i18n';
import {icon} from '../view/icons';

export type StarCelebration={stars:number;reward:number;branch:string;title:string;chainComplete:boolean};
const escape=(value:string)=>value.replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;').replaceAll('"','&quot;');

/** A single bounded burst; motion preferences suppress particles in CSS. */
export function celebrationPanel(award:StarCelebration){
 const en=getLocale()==='en',final=award.stars===3;
 const count=final?72:award.stars===2?44:32;
 const confetti=Array.from({length:count},(_,i)=>{
  const spread=((i*73)%101)/100;
  return `<i style="--x:${Math.round((spread-.5)*620)}px;--y:${85+(i*43)%250}px;--r:${180+(i*79)%720}deg;--delay:${(i%9)*.055}s;--shade:${i%5};background:${['#e8b843','#82a676','#e99b86','#8eabb9','#f5d982'][i%5]}"></i>`;
 }).join('');
 const stars=[1,2,3].map(n=>`<span class="${n<=award.stars?'earned':''} ${n===award.stars?'new-star':''}" style="--star-delay:${n*.13}s">${icon('star')}</span>`).join('');
 const subtitle=award.chainComplete?(en?'Three cafés. Nine stars. Your own coffee legacy.':'Üç kafe. Dokuz yıldız. Kendi kahve hikâyeni yazdın.'):
  final?(en?'Every star earned. This neighbourhood has a new favourite.':'Üç yıldız da senin. Bu semtin yeni bir favorisi var.'):
  award.stars===2?(en?'Familiar faces, favourite coffees. Your café feels like home.':'Tanıdık yüzler, sevilen kahveler. Kafen artık ikinci bir ev.'):
  (en?'A little café, a big first milestone. This is just the beginning.':'Küçük bir kafe, büyük bir ilk adım. Bu daha başlangıç.');
 return `<div class="star-celebration ${final?'grand-finale':''}" data-stars="${award.stars}">
  <div class="celebration-confetti" aria-hidden="true">${confetti}</div>
  <p class="celebration-eyebrow">${escape(t(award.branch))}</p>
  ${final?`<div class="celebration-medal" aria-hidden="true"><span>${icon('coffee')}</span></div>`:''}
  <div class="celebration-stars" role="img" aria-label="${award.stars} / 3 ${en?'café stars':'kafe yıldızı'}">${stars}</div>
  <p class="celebration-count">${en?`STAR ${award.stars} OF 3`:`${award.stars}. YILDIZ / 3`}</p>
  <h3>${escape(t(award.title))}</h3>
  <p class="celebration-message">${subtitle}</p>
  ${final?`<div class="celebration-ribbon">${en?'NEIGHBOURHOOD FAVOURITE':'SEMTİN YILDIZI'}</div>`:''}
  <div class="celebration-reward"><span>${en?'Star reward · added to your wallet':'Yıldız ödülü · cüzdanına eklendi'}</span><strong>${icon('coin')} +${number(award.reward)} <small>${t('Altın')}</small></strong></div>
  <button class="primary" data-celebration-done>${en?'Back to my café':'Kafeme dön'} ${icon('coffee')}</button>
 </div>`;
}
