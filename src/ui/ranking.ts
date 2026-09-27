import {getLocale,number} from '../game/i18n';
import type {GamesState} from '../platform/play-games';
import {icon} from '../view/icons';

const escape=(value:string)=>value.replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]!));
export function rankingPanel(state:GamesState){
 const en=getLocale()==='en',ranking=state.ranking,connected=state.profile.authenticated;
 const loading=ranking?.status==='loading'||state.status==='loading';
 const entries=ranking?.status==='ready'?ranking.entries.slice(0,50):[];
 let message='';
 if(!connected)message=en?'Connect with Google Play Games to see the café ranking.':'Kafe sıralamasını görmek için Google Play Games ile bağlan.';
 else if(loading)message=en?'Opening the café ranking…':'Kafe sıralaması yükleniyor…';
 else if(ranking?.status==='error')message=en?'The ranking could not be loaded. Check your connection and try again.':'Sıralama yüklenemedi. Bağlantını kontrol edip tekrar dene.';
 else if(ranking?.status==='ready'&&!entries.length)message=en?'No public scores yet. Share your café score from your profile to join.':'Henüz herkese açık puan yok. Katılmak için profilinden kafe puanını paylaş.';
 else if(!ranking||ranking.status==='idle')message=en?'Refresh to load the ranking for this profile.':'Bu profilin sıralamasını yüklemek için yenile.';
 return `<section class="cafe-ranking" aria-busy="${loading}">
 <div class="ranking-hero"><span class="ranking-emblem" aria-hidden="true">${icon('coffee')}</span><div><span class="ranking-eyebrow">MOLA · ${en?'TOP 50':'İLK 50'}</span><h3>${en?'The coffee league':'Kahve ligi'}</h3><p>${en?'Worldwide · All time':'Dünya geneli · Tüm zamanlar'}</p></div></div>
 <p class="ranking-description">${en?'The best café chains, one cup at a time. Public Google Play Games scores, ranked from highest to lowest.':'Her fincanla büyüyen en iyi kahve zincirleri. Herkese açık Google Play Games puanları, yüksekten düşüğe sıralanır.'}</p>
 ${message?`<div class="ranking-message" role="status" aria-live="polite">${message}</div>`:''}
 ${ranking?.stale&&entries.length?`<p class="ranking-message" role="status">${en?'Showing saved Google Play Games results. Refresh when connected for the latest ranking.':'Google Play Games’in önbellekteki sonuçları gösteriliyor. Güncel sıralama için bağlantın varken yenile.'}</p>`:''}
 ${entries.length?`<ol class="ranking-list" aria-label="${en?'Top 50 café players':'İlk 50 kafe oyuncusu'}">${entries.map(e=>`<li class="ranking-row ${e.rank<=3?'ranking-medal medal-'+e.rank:''} ${e.isCurrentPlayer?'ranking-you':''}" value="${e.rank}"><span class="ranking-place" aria-label="${en?'Rank':'Sıra'} ${number(e.rank)}">${number(e.rank)}</span><div class="ranking-player"><b dir="auto">${escape(e.displayName|| (en?'Café owner':'Kafe sahibi'))}</b>${e.isCurrentPlayer?`<span class="ranking-you-label">${en?'You':'Sen'}</span>`:''}</div><div class="ranking-points"><strong>${number(e.score)}</strong><span>${en?'chain points':'zincir puanı'}</span></div></li>`).join('')}</ol><p class="ranking-footnote">${en?'Up to 50 players are shown. Only your highest shared score counts; updates may take a moment.':'En fazla 50 oyuncu gösterilir. Paylaştığın en yüksek puan geçerlidir; güncellemeler kısa bir süre alabilir.'}</p>`:''}
 ${connected?`<button class="primary" data-games="ranking" ${loading?'disabled':''}>${en?'Refresh ranking':'Sıralamayı yenile'}</button>`:''}
 <button class="link-button" data-panel="profile">${en?'My profile and score':'Profilim ve puanım'}</button>
 </section>`;
}
