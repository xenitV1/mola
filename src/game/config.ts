import {developmentGold} from './gold-prices';
export type Menu = 'espresso' | 'latte' | 'cake' | 'tea' | 'iced' | 'lemonade' | 'cheesecake';
export type Role = 'barista' | 'waiter' | 'supplier' | 'cleaner' | 'dishwasher';
export type Ingredient = 'beans'|'milk'|'pastry'|'cold';
export const INGREDIENTS={beans:'Çekirdek',milk:'Süt',pastry:'Tatlı malzemesi',cold:'Çay ve meyve'} as const;
export const MENU = {
 espresso:{name:'Espresso',price:18,brew:2.6,sit:7,freshness:36,icon:'☕',unlock:0,category:'Sıcak içecek',recipe:{beans:1,milk:0,pastry:0,cold:0}},
 latte:{name:'Latte',price:29,brew:4.2,sit:10,freshness:40,icon:'☕',unlock:0,category:'Sıcak içecek',recipe:{beans:1,milk:1,pastry:0,cold:0}},
 cake:{name:'Kahve & pasta',price:42,brew:5.2,sit:15,freshness:30,icon:'🍰',unlock:0,category:'Tatlı',recipe:{beans:1,milk:0,pastry:1,cold:0}},
 tea:{name:'Demleme çay',price:22,brew:2.2,sit:9,freshness:36,icon:'☕',unlock:developmentGold(180),category:'Sıcak içecek',recipe:{beans:0,milk:0,pastry:0,cold:1}},
 iced:{name:'Buzlu latte',price:36,brew:3.8,sit:10,freshness:32,icon:'🥤',unlock:developmentGold(320),category:'Soğuk içecek',recipe:{beans:1,milk:1,pastry:0,cold:0}},
 lemonade:{name:'Ev limonatası',price:28,brew:2.8,sit:8,freshness:36,icon:'🥤',unlock:developmentGold(450),category:'Soğuk içecek',recipe:{beans:0,milk:0,pastry:0,cold:1}},
 cheesecake:{name:'Çilekli cheesecake',price:49,brew:4.6,sit:16,freshness:34,icon:'🍰',unlock:developmentGold(650),category:'Tatlı',recipe:{beans:0,milk:1,pastry:1,cold:0}},
} as const;
export const STARTER_MENU:Menu[]=['espresso','latte','cake'];
export const ROLES:Role[]=['barista','waiter','supplier','cleaner','dishwasher'];
export const ROOM={left:-4.1,right:10.3,center:3.1,width:14.4,walkRight:9.85,entryZ:14.5};
export const BRANCHES = [
  { id: 'mahalle', name: 'Mahalle Mola', subtitle: 'Her güzel hikâye küçük başlar.', cost: 0, arrival: 8, patience: 44, quality: 1, palette: '#647549', preference: 'latte', demand: {espresso:1,latte:1,cake:.65,tea:.8,iced:.85,lemonade:.7,cheesecake:.7}, insight:'Komşular latte için uğrar. Pasta menüsü daha az misafir çeker.', seats: 12 },
  { id: 'ofis', name: 'Ofis Köşesi', subtitle: 'Sabah telaşı. Hızlı kahve, kısa molalar.', cost: 4500, arrival: 4.6, patience: 27, quality: .8, palette: '#607d7d', preference: 'espresso', demand: {espresso:1.15,latte:.75,cake:.38,tea:.7,iced:1,lemonade:.65,cheesecake:.4}, insight:'Ofis çalışanları hızlı kahve ister. Uzun pasta molalarına daha az talep var.', seats: 12 },
  { id: 'sahil', name: 'Sahil Bahçesi', subtitle: 'İyi kahve, bir dilim pasta, uzun sohbetler.', cost: 18000, arrival: 6, patience: 55, quality: 1.4, palette: '#668a60', preference: 'cake', demand: {espresso:.75,latte:.85,cake:1,tea:.65,iced:1.05,lemonade:1.1,cheesecake:1.15}, insight:'Sahilde misafirler pasta ve sohbet için gelir. Masalar daha uzun dolar.', seats: 12 },
] as const;
export const POINTS = { machine: { x: -1.25, z: -2.85 }, supply: { x: -2.7, z: 2.45 }, wash:{x:-1.05,z:3.45}, entry: { x: -2.7, z: 14.5 } };
export const TABLES = [{x:3,z:-1},{x:7.8,z:-1},{x:3,z:4},{x:7.8,z:4},{x:3,z:9},{x:7.8,z:9}];
export const UPGRADES = {
  speakers:{name:'Kafe ses sistemi',description:'Çalma listesi açılır. Ses düzeyini sen seçersin; yüksek ses sakin misafirleri rahatsız eder.',base:140,growth:1,max:1,icon:'music'},
  stage:{name:'Canlı müzik köşesi',description:'Müzisyenler kafende çalar. Sosyal misafirler sever; sesi ve komşuları gözet.',base:420,growth:1,max:1,icon:'music'},
  soundproof:{name:'Akustik yalıtım',description:'Her seviye dışarı taşan müziği %24, içerideki gürültüyü 10 puan azaltır.',base:190,growth:1.9,max:3,icon:'leaf'},
  storage:{name:'Depo rafları',description:'Depo her malzemeden 20 adet daha tutar. Taşıma kasaları %25 büyür.',base:160,growth:2,max:3,icon:'box'},
  wash:{name:'Bulaşık makinesi',description:'Her seviye yıkama süresini kısaltır. Temiz fincanlar daha hızlı döner.',base:210,growth:1.9,max:3,icon:'coffee'},
  space: {name:'Kafeyi büyüt', description:'Dükkân genişler. İki yeni masa için yer açılır.', base:260, growth:2.7, max:2, icon:'shop'},
  table: {name:'Yeni masa', description:'İki yeni sandalye. Sıradaki misafirler oturabilsin.', base:70, growth:1.85, max:6, icon:'chair'},
  machine: {name:'Espresso makinesi', description:'Kahve daha hızlı hazırlanır. Makinen de büyür.', base:95, growth:1.85, max:5, icon:'coffee'},
  tray: {name:'Geniş servis tepsisi', description:'Her turda bir fincan daha taşı.', base:65, growth:1.8, max:5, icon:'tray'},
  quality: {name:'Kaliteli malzemeler', description:'Daha iyi puan ve %15 fazla kazanç. Hazırlık %8 uzar.', base:130, growth:2, max:3, icon:'leaf'},
  stock: {name:'Büyük çekirdek rafı', description:'Depodan her turda daha fazla çekirdek taşı.', base:90, growth:1.8, max:4, icon:'box'},
} as const;
export type Upgrade = keyof typeof UPGRADES;
export const STAFF = { barista:{ name:'Barista',person:'Ece',base:180,description:'Makinenin başına geçer, kahveleri hazırlar.'}, waiter:{name:'Garson',person:'Can',base:240,description:'Kahveleri taşır ve bekleyen misafirlere servis yapar.'}, supplier:{name:'Tedarikçi',person:'Ada',base:210,description:'Depodan tüm malzemeleri taşır, hazırlık tezgâhını dolu tutar.'}, cleaner:{name:'Temizlikçi',person:'Deniz',base:280,description:'Boşalan masaları temizler, bulaşıkları yıkama alanına taşır.'}, dishwasher:{name:'Bulaşıkçı',person:'Mert',base:320,description:'Yıkama alanında kirli fincanları yıkar, temiz stoğuna geri koyar.'} } as const;
export const TUNING = { startingCoins:20, startingStock:14, moveSpeed:4.2, workerSpeed:3.6, customerSpeed:2.6, queueLimit:5, baseStockCap:24, startingTray:2, interactRadius:.85, offlineCap:4*3600, offlineWorkRate:.025, maxMoney:1e9 };

export const MAX_CAFE_CUSTOMERS=112;

// Outdoor line in front of the door. Rows fill left to right, then step back
// towards the street, and must stay clear of the café floor and the pavement lane.
export const QUEUE_LINE={x:-2.8,z:13.1,step:.92,rowGap:.58,perRow:9,rows:3} as const;
export const TAKEAWAY = {cost:developmentGold(900), traffic:1.25, share:.5, price:.85, guest:{x:-1.35,z:1.05}, service:{x:-.35,z:1.05}, handoff:.8} as const;
