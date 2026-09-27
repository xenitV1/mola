import {BRANCHES,TAKEAWAY,MENU,POINTS,TABLES,type Role} from './config';
import {distance,type Simulation,type Vec} from './sim';
import {dirtSeconds} from './cleanliness';
export type Guide={id:string;step:0|1|2|3;title:string;detail:string;button:string;icon:string;target?:Vec;panel?:'upgrade'|'staff'|'branches'|'menu'|'notebook'|'mastery'|'takeaway'|'inventory'|'contracts';buy?:'table';hire?:Role;price?:number;progress?:number;waiting?:boolean};
export const teaching=(g:Simulation)=>g.s.totalServed<3&&g.b.level.table===1&&Object.keys(g.s.branches).length===1;
export const basicGuideComplete=(g:Simulation)=>g.s.totalServed>=3&&(g.s.branches[0]?.level.table??0)>=2;
export function nextAction(g:Simulation):Guide{
 const b=g.b,p=g.s.player;
 if(p.beans)return {id:'deliver-beans',step:0,title:'Malzemeleri hazırlık tezgâhına götür',detail:'Süt, çekirdek ve diğer malzemeler tezgahta yerlerine konur.',button:'Makineye götür',icon:'box',target:POINTS.machine};
 if(b.level.table===1&&g.s.coins>=g.price('table'))return {id:'first-table',step:3,title:'Bir masaya daha yetecek kazancın var',detail:'İki yeni sandalye, iki misafire daha yer.',button:'Yeni masa ekle',icon:'chair',buy:'table',price:g.price('table'),target:TABLES[b.level.table]};
 const dirty=g.dirtyTable();
 if(b.dirtyDishes>0&&(!b.staff.dishwasher||b.cleanDishes<1))return {id:'wash',step:2,title:'Temiz fincanları yenile',detail:'Yıkama alanında durunca fincanlar temizlenir.',button:'Fincanları yıka',icon:'coffee',target:POINTS.wash};
 if(dirty!==undefined&&!b.staff.cleaner)return {id:'clean',step:2,title:'Boşalan masayı temizle',detail:'Masaya yaklaş. Bulaşıklar yıkama alanına taşınır.',button:'Masayı temizle',icon:'leaf',target:g.servicePoint(dirty*2)};
 const customer=b.customers.find(c=>['waiting','walking','sitting','pickup-waiting','pickup-walking'].includes(c.state)&&p.cups.some(cup=>cup.kind===c.kind));
 if(customer)return {id:'serve',step:1,title:'Kahven hazır!',detail:customer.takeaway?'Teslim noktasına git. Paketi verince kazanç hemen eklenir.':'Masaya git. Servis ve ödeme otomatik gerçekleşir.',button:customer.takeaway?'Paketi teslim et':'Masaya servis',icon:'tray',target:g.orderPoint(customer)};
 if(p.cups.length&&g.pendingOrders.length&&!g.pendingOrders.some(order=>p.cups.some(cup=>cup.kind===order.kind)))return {id:'return-tray',step:0,title:'Tepsinde eski siparişler var',detail:'Makineye dön. Eski ürünleri bırak, doğru siparişi al.',button:'Tepsini değiştir',icon:'tray',target:POINTS.machine};
 if(b.level.table>=2&&!b.staff.barista&&g.s.coins>=g.staffPrice('barista'))return {id:'first-worker',step:3,title:'Kahveyi artık Ece hazırlasın',detail:'Sen servis yaparken baristan üretime devam eder.',button:'Baristayı incele',icon:'team',hire:'barista',price:g.staffPrice('barista')};
 if(b.staff.barista&&!b.staff.waiter&&g.s.coins>=g.staffPrice('waiter'))return {id:'first-server',step:3,title:'Servisi Can devralsın',detail:'Kahveleri taşır. Her teslimatta kazanç otomatik eklenir.',button:'Garsonu incele',icon:'team',hire:'waiter',price:g.staffPrice('waiter')};
 if(b.staff.waiter&&!b.staff.supplier&&g.s.coins>=g.staffPrice('supplier'))return {id:'first-supplier',step:3,title:'Çekirdekleri Ada taşısın',detail:'Makineyi dolu tutar. Sen kafeni geliştirebilirsin.',button:'Tedarikçiyi incele',icon:'team',hire:'supplier',price:g.staffPrice('supplier')};
 if(b.staff.supplier&&!b.staff.cleaner&&g.s.coins>=g.staffPrice('cleaner'))return {id:'first-cleaner',step:3,title:'Masaları Deniz temizlesin',detail:'Temizlikçi masaları yeni misafirler için hazırlar.',button:'Temizlikçiyi incele',icon:'team',hire:'cleaner',price:g.staffPrice('cleaner')};
 if(b.staff.cleaner&&!b.staff.dishwasher&&g.s.coins>=g.staffPrice('dishwasher'))return {id:'first-dishwasher',step:3,title:'Yıkamayı Mert devralsın',detail:'Bulaşıkçı temiz fincanları sürekli hazır tutar.',button:'Bulaşıkçıyı incele',icon:'team',hire:'dishwasher',price:g.staffPrice('dishwasher')};
 const needed=g.unfilledOrders([...b.ready,...p.cups,...g.roleActors('waiter').flatMap(a=>a.cups)])[0]?.kind??b.menu;
 if(!g.canPrepare(needed)&&!p.cups.length&&!b.ready.length)return {id:'get-beans',step:0,title:'Malzeme gerekiyor',detail:'Depodan ücretsiz al, hazırlık tezgâhına taşı.',button:'Malzeme al',icon:'box',target:POINTS.supply};
 const sweepTask=p.task?.startsWith('sweep-')?g.cleanliness.patches.find(patch=>p.task===`sweep-${patch.id}`&&!g.blocked(patch)):undefined;
 const pathTarget=p.path.at(-1);const pathPatch=!sweepTask&&pathTarget?g.cleanliness.patches.find(patch=>!g.blocked(patch)&&distance(pathTarget,patch)<=.7):undefined;
 const dirt=sweepTask??pathPatch??g.nearestDirt();
 if(dirt&&!teaching(g)&&(sweepTask||pathPatch||(!b.staff.cleaner&&!g.pendingOrders.length&&!p.cups.length&&!b.ready.length))){
  const working=p.task===`sweep-${dirt.id}`&&!p.moving&&distance(p,dirt)<=.7;
  return {id:`clean-dirt-${dirt.id}`,step:2,title:working?'Temizleniyor':dirt.zone==='front'?'Dükkân önünü temizle':'Zemini temizle',detail:'Kirli noktaya yaklaşıp durarak sen de temizleyebilirsin.',button:working?'Temizleniyor':dirt.zone==='front'?'Dükkân önünü temizle':'Zemini temizle',icon:'leaf',target:dirt,progress:working?dirt.work/dirtSeconds(dirt):undefined,waiting:working};
 }
 if(b.staff.waiter&&b.special?.status==='ready')return {id:'contract-reward',step:3,title:'Özel sipariş tamamlandı',detail:'Ekibinin başarısı yeni yatırımını hızlandırsın.',button:'Sipariş ödülünü gör',icon:'coin',panel:'contracts'};
 if(g.autoReady&&g.mastery()[b.mastery]?.ready){const objective=g.objective();return {id:'ready-star',step:3,title:objective.title,detail:objective.text,button:'Kafenin yıldızları',icon:'star',panel:'mastery'};}
 if(g.chainComplete)return {id:'freeplay',step:3,title:'Üç şube, dokuz yıldız!',detail:'Kendi kahve zincirini kurdun. Şubelerin sende kalır; istediğin gibi işletmeye devam edebilirsin.',button:'İşletmene bak',icon:'grow',panel:'notebook'};
 const nextBranch=BRANCHES.findIndex((_,i)=>!g.s.branches[i]);
 if(g.autoReady&&(!b.special||b.special.status==='failed')&&nextBranch>0&&g.branchUnlocked(nextBranch)&&g.s.coins>=BRANCHES[nextBranch].cost){const objective=g.objective();return {id:'expand-chain',step:3,title:objective.title,detail:objective.text,button:'Şubeler',icon:'shop',panel:'branches'};}
 if(g.autoReady&&(!b.special||b.special.status==='failed'))return {id:'choose-contract',step:3,title:'Ekibine yeni bir hedef seç',detail:'Hızlı kahveler mi, tatlı siparişi mi? Kapasitene göre seç.',button:'Özel siparişleri gör',icon:'menu',panel:'contracts'};
 if(g.autoReady){const note=g.bottleneck(),objective=g.objective();return {id:'manage',step:3,title:note.action==='grow'?objective.title:note.title,detail:note.action==='grow'?objective.text:note.text,button:'İşletmene bak',icon:'grow',panel:note.action==='grow'?(objective.panel??'notebook'):note.target?'notebook':note.panel};}
 const pickupOrder=g.pendingOrders.find(c=>c.takeaway&&p.cups.some(cup=>cup.kind===c.kind));
 if(pickupOrder)return {id:'pickup-order',step:1,title:'Tepsin hazır',detail:'Teslim noktasına git. Paketi verince kazanç hemen eklenir.',button:'Paketi teslim et',icon:'tray',target:TAKEAWAY.service};
 if(p.cups.length&&(!b.customers.some(c=>['waiting','walking','sitting','queue'].includes(c.state))||p.cups.length>=b.level.tray))return {id:'wait-for-order',step:1,title:'Tepsin hazır',detail:'Misafirin oturunca kahvesini masaya götür.',button:'Masaya git',icon:'tray',target:g.servicePoint(b.customers.find(c=>c.seat>=0&&c.state!=='leaving')?.seat??0)};
 if(!g.pendingOrders.length)return {id:'welcome-guest',step:0,title:'Önce misafirin otursun',detail:'Sipariş, misafir masasına oturunca gelir. Hazırlık tezgâhına geçebilirsin.',button:'Hazırlık tezgâhına git',icon:'coffee',target:POINTS.machine};
 const near=distance(p,POINTS.machine)<.85,ready=b.ready.length>0;
 if(near&&!ready&&b.brew>0)return {id:'brewing',step:0,title:'Kahven hazırlanıyor',detail:'Hazır olunca tepsine otomatik alınır.',button:'Hazırlanıyor',icon:'coffee',target:POINTS.machine,waiting:true,progress:b.brew/g.brewTime};
 return {id:'brew',step:0,title:ready?'Hazır kahveyi al':'Bir kahve hazırlayalım',detail:ready?'Makinenin yanına git, tepsine al.':'Makineye git. Yanında durunca kahve hazır olur.',button:'Kahve hazırla',icon:'coffee',target:POINTS.machine};
}
