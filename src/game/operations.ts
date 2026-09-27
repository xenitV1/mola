import {TAKEAWAY,POINTS,MENU,type Menu} from './config';
import type {Simulation,Vec} from './sim';
export type OperationsNote={title:string;text:string;action:'clean'|'wash'|'stock'|'delivery'|'table'|'space'|'waiter'|'machine'|'menu'|'grow';button:string;panel:'staff'|'upgrade'|'menu'|'notebook'|'takeaway';target?:Vec};
export function operationsNote(g:Simulation):OperationsNote{
 const b=g.b,waiting=g.waiting,queue=g.queue.filter(c=>!c.takeaway);
 if(b.cleanDishes<4&&b.dirtyDishes>0)return {title:'Temiz fincan azalıyor',text:'Fincanları yıka veya bulaşıkçı işe al. Yıkama makinesini de geliştirebilirsin.',action:'wash',button:'Fincanları yıka',panel:'staff',target:POINTS.wash};
 const dirty=g.dirtyTable();if(dirty!==undefined)return {title:'Masalar temizliği bekliyor',text:'Boşalan masayı temizle veya temizlikçi işe al.',action:'clean',button:b.staff.cleaner?'Çalışanlar':'Masayı temizle',panel:'staff',target:b.staff.cleaner?undefined:g.servicePoint(dirty*2)};
 const carried=[...g.s.player.cups,...g.roleActors('waiter').flatMap(a=>a.cups)],inventory=[...b.ready,...carried];
 const matching=(kind:Menu)=>inventory.some(c=>c.kind===kind);
 const playerOrder=waiting.find(c=>g.s.player.cups.some(cup=>cup.kind===c.kind));
 if(waiting.some(c=>matching(c.kind)))return {title:'Hazır siparişler servisi bekliyor',text:b.staff.waiter?'Ürün hazır. Garsonunu eğiterek servisi hızlandırabilirsin.':'Ürün hazır. Tepsine alıp bekleyen masaya götür.',action:'waiter',button:b.staff.waiter?'Garsonu geliştir':playerOrder?.takeaway?'Paketi teslim et':playerOrder?'Masaya servis':'Kahve hazırla',panel:'staff',target:b.staff.waiter?undefined:playerOrder?g.orderPoint(playerOrder):POINTS.machine};
 const needed=g.unfilledOrders(inventory)[0]?.kind??b.menu;
 if(!g.canPrepare(needed)||(MENU[needed].recipe.beans>0&&b.stock<3)){
  if(g.s.player.beans||g.roleActors('supplier').some(a=>a.beans>0))return {title:'Çekirdekler yolda',text:'Taşınan çekirdekler makineye ulaşınca stok yenilenir.',action:'delivery',button:g.s.player.beans?'Makineye götür':'Çalışanlar',panel:'staff',target:g.s.player.beans?POINTS.machine:undefined};
  const train=b.staff.supplier>0&&b.staff.supplier<3;
  return {title:'Tezgâh malzeme bekliyor',text:'Stok ekranından eksik malzemeyi gör. Depodan getir veya tedarikçini geliştir.',action:'stock',button:train?'Çalışanlar':'Çekirdek al',panel:'staff',target:train?undefined:POINTS.supply};
 }
 if(waiting.length>1&&g.unfilledOrders(inventory).length){
  if(!b.staff.barista)return {title:'Siparişler hazırlanmayı bekliyor',text:'Makinenin yanında kahve hazırla veya bir barista işe al.',action:'machine',button:'Kahve hazırla',panel:'staff',target:POINTS.machine};
  if(b.level.machine<g.upgradeCap('machine'))return {title:'Üretim siparişlere yetişmeye çalışıyor',text:'Hazır ürün eksik. Makineyi geliştirmek hazırlığı hızlandırır.',action:'machine',button:'Geliştir',panel:'upgrade'};
  if(b.staff.barista<3)return {title:'Üretim siparişlere yetişmeye çalışıyor',text:'Makine en iyi seviyede. Baristanı eğiterek hazırlığı hızlandırabilirsin.',action:'machine',button:'Çalışanlar',panel:'staff'};
  return {title:'Üretim kapasitesi dolu',text:'Daha hızlı hazırlanan bir menüyle beklemeyi azaltabilirsin.',action:'menu',button:'Menü',panel:'menu'};
 }
 if(g.queue.filter(c=>c.takeaway).length>=2)return {title:'Paket tesliminde sıra var',text:'Paketler de aynı makine ve garsonu kullanır. Ekibini geliştir veya paket servisi geçici kapat.',action:'waiter',button:'Paket servisi yönet',panel:'takeaway'};
 if(queue.length>=2){
  if(b.level.table<g.maxTables)return {title:'Misafirler ayakta',text:'Yeni masa iki misafire yer açar. Daha kısa molalı menü de masaları hızlandırır.',action:'table',button:'Geliştir',panel:'upgrade'};
  if(b.level.space<g.maxSpace)return {title:'Dükkâna sığmıyoruz',text:'Kafeyi büyüt, yeni oturma alanına bir masa ekle.',action:'space',button:'Geliştir',panel:'upgrade'};
  if(b.tableLevels.slice(0,b.level.table).some((_,i)=>g.canUpgradeTable(i)))return {title:'Masalarını büyütebilirsin',text:'Yeni masa için yer yoksa mevcut masayı daha çok kişilik modele yükselt.',action:'table',button:'Masa türleri',panel:'upgrade'};
  return {title:'Tüm masalar kullanımda',text:'Bu şubede masa alanı doldu. Daha kısa molalı bir menüyü değerlendirebilirsin.',action:'menu',button:'Menü',panel:'menu'};
 }
 if(g.recentWaste>2&&b.prep>1)return {title:'Son molalarda ürünler soğudu',text:'Hazırlık hedefini azaltmayı ve servis akışını kontrol etmeyi dene.',action:'menu',button:'Menü',panel:'menu'};
 return {title:'Her şey yolunda',text:'Bir sonraki yatırımına doğru.',action:'grow',button:'Geliştir',panel:'upgrade'};
}
