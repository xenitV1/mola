import {developmentGold} from './gold-prices';
// Stable IDs keep every previously owned style usable after the catalogue grows.
export const DECOR={
 concrete:{slot:'floor',name:'Sade beton',description:'İlk günün sade zemini. Yeni stilleri yatırımlardan aç.',cost:0,icon:'map',comfort:0},
 oak:{slot:'floor',name:'Sıcak meşe',description:'Kafenin doğal ahşap zemini.',cost:developmentGold(140),icon:'leaf',comfort:0},
 tile:{slot:'floor',name:'Pastel karolar',description:'Krem ve adaçayı yeşili, yeni bir zemin.',cost:developmentGold(220),icon:'map',comfort:0},
 terracotta:{slot:'floor',name:'Akdeniz taşları',description:'Geniş toprak rengi taşlar ve krem kenarlık.',cost:developmentGold(400,true),icon:'map',comfort:0},
 classic:{slot:'furniture',name:'Ahşap sandalyeler',description:'Sade ve sıcak kafe mobilyaları.',cost:0,icon:'chair',comfort:0},
 cushions:{slot:'furniture',name:'Yumuşak minderler',description:'Yeşil minderler. Misafir sabrına +2 saniye.',cost:developmentGold(180),icon:'chair',comfort:2},
 reading:{slot:'furniture',name:'Okuma rafı',description:'Kitaplık ve pirinç okuma lambası. Misafir sabrına +2 saniye.',cost:developmentGold(300),icon:'chair',comfort:2},
 sideboard:{slot:'furniture',name:'Çay konsolu',description:'Oymalı konsol ve seramik çay takımı. Misafir sabrına +2 saniye.',cost:developmentGold(460,true),icon:'chair',comfort:2},
 none:{slot:'plants',name:'Bitkisiz başlangıç',description:'Boş pencere önleri. İlk saksılarını kendin seç.',cost:0,icon:'leaf',comfort:0},
 simple:{slot:'plants',name:'Birkaç yeşil dost',description:'Pencere, masa ve giriş için saksı bitkileri.',cost:developmentGold(100),icon:'leaf',comfort:0},
 lush:{slot:'plants',name:'Asma bahçesi',description:'Sarkan bitkiler ve çiçekler. Misafir sabrına +2 saniye.',cost:developmentGold(200),icon:'leaf',comfort:2},
 flowers:{slot:'plants',name:'Çiçekli pencere',description:'Uzun çiçek kasaları ve renkli demetler. Misafir sabrına +2 saniye.',cost:developmentGold(340,true),icon:'leaf',comfort:2},
} as const;
export type DecorId=keyof typeof DECOR;
type InSlot<S extends string>={[K in DecorId]:typeof DECOR[K]['slot'] extends S?K:never}[DecorId];
export type Decoration={owned:DecorId[];floor:InSlot<'floor'>;furniture:InSlot<'furniture'>;plants:InSlot<'plants'>};
export const freshDecoration=():Decoration=>({owned:['concrete','classic','none'],floor:'concrete',furniture:'classic',plants:'none'});
export const legacyDecoration=():Decoration=>({owned:['oak','classic','simple'],floor:'oak',furniture:'classic',plants:'simple'});
export const decorComfort=(d:Decoration)=>DECOR[d.furniture].comfort+DECOR[d.plants].comfort;
export const FLOOR_ENDS=[4.5,8.5,12.5] as const;
