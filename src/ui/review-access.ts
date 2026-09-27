import {getLocale} from '../game/i18n';
import type {ReviewAccessState} from '../platform/review-access';

export function reviewAccessPanel(state:ReviewAccessState){
 const en=getLocale()==='en';
 const intro=en?'Free access for app reviewers. Enter the access code provided in Play Console to enable the paid benefits without a purchase.':'Uygulama incelemecileri için ücretsiz erişim. Ücretli özellikleri satın alma yapmadan açmak için Play Console’da verilen erişim kodunu gir.';
 const benefits=en?'This enables ad removal and the offline manager, and adds 50,000 gold once to this café. Your existing progress is kept.':'Tüm reklamları kaldırır, çevrimdışı yöneticiyi açar ve bu kafeye bir kez 50.000 altın ekler. Mevcut ilerlemen korunur.';
 const disable=en?'You can disable review access to inspect the normal game. Disabling does not remove a genuine purchase or the gold already added.':'Normal oyunu incelemek için bu erişimi kapatabilirsin. Kapatmak gerçek satın alma hakkını veya eklenen altını geri almaz.';
 if(!state.available)return `<p class="sheet-intro">${en?'Review access is unavailable in this build.':'Bu sürümde inceleme erişimi kullanılamıyor.'}</p>`;
 return `<p class="sheet-intro">${intro}</p><p class="sheet-intro">${benefits}</p><p class="sheet-intro">${disable}</p>${state.active?`<p class="purchase-status" role="status">${en?'Review access is active. No purchase was made.':'İnceleme erişimi etkin. Satın alma yapılmadı.'}</p><button class="primary" data-review-action="disable">${en?'Disable review access':'İnceleme erişimini kapat'}</button>`:`<label class="setting-block" for="review-access-code">${en?'Review access code':'İnceleme erişim kodu'}<input id="review-access-code" type="password" inputmode="text" autocomplete="off" autocapitalize="none" spellcheck="false" maxlength="128" aria-label="${en?'Review access code':'İnceleme erişim kodu'}"></label><button class="primary" data-review-action="activate">${en?'Enable free review access':'Ücretsiz inceleme erişimini aç'}</button>`}`;
}
