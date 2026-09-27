import {freshFinances,recordFinanceSale,advanceFinances,type Finances,type FinanceSettlement} from './finances';
import {developmentGold} from './gold-prices';
import {diamondPrice,freshDiamonds,type Currency,type Purchase,type DiamondState} from './diamonds';
import {freshCleanliness,DIRT_LIMITS,DIRT_TRAVEL,dirtExposure,dirtSeconds,type CleanlinessState,type DirtPatch} from './cleanliness';
import {TABLE_TYPES,tableOfSeat,tableSeats,seatOffset,seatLocalApproach,tableBounds,sofaBlocks} from './table-layout';
import {PRICING,freshPrices,type PriceMode} from './pricing';
import {freshVenue,staffLimit,type MusicMode} from './venue';
import {choosePersona,evaluateReview,type Persona,type GuestReview} from './guests';
import {contractOffers} from './contracts';
import {freshOperations,type OperationsState} from './operations-state';
import {operationsNote} from './operations';
import {SEATING,easeSeat} from './layout';
import { ROOM,ROLES,INGREDIENTS,type Ingredient, TAKEAWAY, BRANCHES, MENU, POINTS, MAX_CAFE_CUSTOMERS, QUEUE_LINE, TABLES, TUNING, UPGRADES, STAFF, type Menu, type Role, type Upgrade } from './config';
import {masteryGoals} from './mastery';
import {DECOR,FLOOR_ENDS,decorComfort,freshDecoration,type Decoration,type DecorId} from './decor';
export type ServicePolicy='balanced'|'cash';
export type Vec = {x:number;z:number};
export type Cup = {kind:Menu;quality:number;born:number};
export type Actor = Vec & {angle:number;path:Vec[];cups:Cup[];beans:number;action:number;moving:boolean;cargo?:Partial<Record<Ingredient,number>>;task?:string};
export type Visit={comfort?:number;seconds:number;dirty:number;crowding:number;noise:number;music:number;waitFraction:number;freshness:number;quality:number};
export type Customer = Actor & {persona?:Persona;review?:GuestReview;quotedPrice?:number;seatAngle?:number;seatComfort?:number;visit?:Visit;id:number;kind:Menu;takeaway?:boolean;state:'pickup-walking'|'pickup-waiting'|'pickup-done'|'queue'|'walking'|'sitting'|'waiting'|'drinking'|'standing'|'leaving';seat:number;patience:number;maxPatience:number;timer:number;paid:boolean;specialId?:number;tint:number};
export type Branch = OperationsState & ReturnType<typeof freshVenue> & {cleanliness?:CleanlinessState;tableLevels:number[];priceModes:Record<Menu,PriceMode>;helpers:{role:Role;actor:Actor}[];takeaway:{owned:boolean;open:boolean;cash:number;served:number};level:Record<Upgrade,number>;staff:Record<Role,number>;menu:Menu;prep:number;stock:number;ready:Cup[];customers:Customer[];workers:Partial<Record<Role,Actor>>;cash:Record<number,number>;brew:number;brewing:Menu;rating:number;served:number;lost:number;waste:number;spawn:number;time:number;earned:number;losses:{seat:number;service:number;stock:number};theme:number;mastery:number;signatureServed:number;servicePolicy:ServicePolicy;decor:Decoration};
export type Save = {version:7;finances?:Finances;diamonds?:DiamondState;monetization?:{bonusGrants:string[];rewardReadyAt:Partial<Record<'coins'|'tips'|'stock',number>>};coins:number;active:number;branches:Record<number,Branch>;player:Actor;totalServed:number;milestone:number;rewardIds:string[];boostSeconds:number;energySeconds?:number;savedAt:number;seed:number;settings:{sound:boolean;music:boolean;motion:boolean;assist:boolean;helpSeen:boolean;locale:'en'|'tr'}};
export type GameEvent = {type:'toast'|'coin'|'serve'|'brew'|'upgrade'|'lost'|'waste'|'branch'|'finance';text:string;at?:Vec;value?:number;settlement?:FinanceSettlement};
const clamp=(n:number,a:number,b:number)=>Math.min(b,Math.max(a,n));
export const distance=(a:Vec,b:Vec)=>Math.hypot(a.x-b.x,a.z-b.z);
export const actor=(p:Vec):Actor=>({...p,angle:0,path:[],cups:[],beans:0,action:0,moving:false});
export function newBranch():Branch{return {...freshOperations(),...freshVenue(),cleanliness:freshCleanliness(),tableLevels:Array(6).fill(0),priceModes:freshPrices(),helpers:[],takeaway:{owned:false,open:false,cash:0,served:0},level:{space:0,table:1,machine:1,tray:2,quality:0,stock:0,storage:0,wash:0,speakers:0,stage:0,soundproof:0},staff:{barista:0,waiter:0,supplier:0,cleaner:0,dishwasher:0},menu:'espresso',prep:1,stock:TUNING.startingStock,ready:[],customers:[],workers:{},cash:{},brew:0,brewing:'espresso',rating:3.8,served:0,lost:0,waste:0,spawn:1,time:0,earned:0,losses:{seat:0,service:0,stock:0},theme:0,mastery:0,signatureServed:0,servicePolicy:'balanced',decor:freshDecoration()};}
export function freshSave(now=Date.now()):Save{return {version:7,coins:TUNING.startingCoins,active:0,branches:{0:newBranch()},player:actor({x:-.8,z:1}),totalServed:0,milestone:0,rewardIds:[],boostSeconds:0,savedAt:now,seed:431,settings:{sound:true,music:true,motion:true,assist:false,helpSeen:false,locale:'en'}};}
export class Simulation {
  s:Save; events:GameEvent[]=[]; move:Vec={x:0,z:0}; private id=1; private quiet=false; private backgroundTime=0;
  private navigation=new Map<string,{cells:Int8Array;edges:Map<number,boolean>}>();
  private wasteTimes=new WeakMap<Branch,number[]>();private waitCauses=new WeakMap<Customer,{total:number;stock:number}>();
  get recentWaste(){const times=(this.wasteTimes.get(this.b)??[]).filter(time=>this.b.time-time>=0&&this.b.time-time<=120);this.wasteTimes.set(this.b,times);return times.length;}
  constructor(save=freshSave()){this.s=save;this.s.diamonds??=freshDiamonds();this.s.finances??=freshFinances();for(const b of Object.values(save.branches))b.cleanliness??=freshCleanliness();this.id=1+Math.max(0,...Object.values(save.branches).flatMap(b=>b.customers.map(c=>c.id)));this.settleLegacyPayments();
    const active=this.s.active,player=this.s.player;
    try{for(const key of Object.keys(this.s.branches)){this.s.active=Number(key);this.s.player=this.s.active===active?player:actor(POINTS.entry);this.refreshLayoutRoutes();}}
    finally{this.s.active=active;this.s.player=player;}
  }
  get b(){return this.s.branches[this.s.active];}
  get def(){return BRANCHES[this.s.active];}
  get stockCap(){return TUNING.baseStockCap+this.b.level.stock*12;}
  get queue(){return this.b.customers.filter(c=>c.state==='queue');}
  get waiting(){const list=this.b.customers.filter(c=>c.state==='waiting'||c.state==='pickup-waiting');return this.b.priority?list.sort((a,b)=>Number(b.specialId===this.b.special?.id&&!!b.specialId)-Number(a.specialId===this.b.special?.id&&!!a.specialId)):list;}
  get pendingOrders(){return this.b.customers.filter(c=>c.state==='waiting'||c.state==='pickup-waiting');}
  unfilledOrders(inventory:Cup[]){const counts=new Map<Menu,number>();for(const cup of inventory)counts.set(cup.kind,(counts.get(cup.kind)??0)+1);return this.pendingOrders.filter(order=>{const count=counts.get(order.kind)??0;if(!count)return true;counts.set(order.kind,count-1);return false;});}
  get maxSpace(){return 2;}
  get maxTables(){return Math.min(2+this.b.level.space*2,this.def.seats/2);}
  private payFor(p:Purchase,gold:number,currency:Currency){if(currency==='gold'){if(this.s.coins<gold)return false;this.s.coins-=gold;return true;}if(currency!=='diamonds')return false;const price=diamondPrice(this,p),wallet=this.s.diamonds;if(price===null||!wallet||wallet.balance<price)return false;wallet.balance-=price;return true;}
  tableCapacity(index:number){return TABLE_TYPES[this.b.tableLevels[index]??0].seats;}
  tableComfort(index:number){return TABLE_TYPES[this.b.tableLevels[index]??0].comfort;}
  get seatingCapacity(){return this.b.tableLevels.slice(0,this.b.level.table).reduce((n,level)=>n+TABLE_TYPES[level].seats,0);}
  get seatIds(){return this.b.tableLevels.slice(0,this.b.level.table).flatMap((level,index)=>tableSeats(index,level));}
  tableUpgradePrice(index:number){return TABLE_TYPES[(this.b.tableLevels[index]??0)+1]?.cost??0;}
  canUpgradeTable(index:number){const next=TABLE_TYPES[(this.b.tableLevels[index]??0)+1];return Number.isInteger(index)&&index>=0&&index<this.b.level.table&&!!next&&this.b.level.space>=next.space;}
  upgradeTable(index:number,currency:Currency='gold'){if(!this.canUpgradeTable(index)||!this.payFor({kind:'table-type',id:String(index)},this.tableUpgradePrice(index),currency))return false;this.b.tableLevels[index]++;this.refreshLayoutRoutes();this.emit('upgrade','Yeni oturma grubun hazır, kafen daha konforlu');return true;}
  get queueCapacity(){return clamp(Math.round(TUNING.queueLimit+this.seatingCapacity*.35+Math.max(0,this.b.rating-3.6)*5),TUNING.queueLimit,QUEUE_LINE.rows*QUEUE_LINE.perRow);}
  setPriceMode(kind:Menu,mode:PriceMode){if(!Object.hasOwn(MENU,kind)||!Object.hasOwn(PRICING,mode)||!this.b.catalog[kind])return false;this.b.priceModes[kind]=mode;this.emit('toast','Yeni fiyatlar sonraki siparişlerde geçerli');return true;}
  get floorEnd(){return FLOOR_ENDS[this.b.level.space];}
  get comfort(){return decorComfort(this.b.decor);}
  upgradeCap(k:Upgrade){return k==='space'?this.maxSpace:k==='table'?this.maxTables:UPGRADES[k].max;}
  decorate(id:DecorId,currency:Currency='gold'){if(!Object.hasOwn(DECOR,id))return false;const choice=DECOR[id],decor=this.b.decor;
   if(!decor.owned.includes(id)){if(!this.payFor({kind:'decor',id},choice.cost,currency))return false;decor.owned.push(id);}
   if(choice.slot==='floor')decor.floor=id as Decoration['floor'];else if(choice.slot==='furniture')decor.furniture=id as Decoration['furniture'];else decor.plants=id as Decoration['plants'];
   this.emit('upgrade',`${choice.name} hazır!`);return true;
  }
  get brewTime(){return MENU[this.b.brewing].brew/(1+(this.b.level.machine-1)*.38)*(1+this.b.level.quality*.08);}
  get takeawayActive(){return this.s.active===1&&this.b.takeaway.open&&this.b.offered.some(k=>MENU[k].category!=='Tatlı');}
  menuDemand(menu:Menu){return this.def.demand[menu]*PRICING[this.b.priceModes[menu]].demand*(this.s.active===1&&this.b.takeaway.open&&MENU[menu].category!=='Tatlı'?TAKEAWAY.traffic:1);}
  get demand(){return this.b.offered.reduce((n,k)=>n+this.menuDemand(k),0)/this.b.offered.length;}
  orderPoint(c:Customer){return c.takeaway?TAKEAWAY.service:this.servicePoint(c.seat);}
  buyTakeaway(){if(this.s.active!==1||this.b.mastery<1||this.b.takeaway.owned||this.s.coins<TAKEAWAY.cost)return false;this.s.coins-=TAKEAWAY.cost;this.b.takeaway.owned=true;this.b.takeaway.open=true;this.emit('upgrade','Paket servis hazır!');return true;}
  setTakeaway(open:boolean){if(this.s.active!==1||!this.b.takeaway.owned||typeof open!=='boolean')return false;this.b.takeaway.open=open;return true;}
  get learningService(){return this.s.totalServed<2&&this.s.active===0&&this.b.level.table===1&&Object.keys(this.s.branches).length===1;}
  get autoReady(){return Object.values(this.b.staff).every(n=>n>0);}
  random(){this.s.seed=(Math.imul(this.s.seed,1664525)+1013904223)>>>0;return this.s.seed/4294967296;}
  emit(type:GameEvent['type'],text:string,at?:Vec,value?:number){if(this.quiet)return;this.events.push({type,text,at,value});if(this.events.length>80)this.events.shift();}
  price(k:Upgrade){const l=this.b.level[k];if(k==='table'&&l===1)return 90;const baseLevel=k==='table'||k==='machine'?1:k==='tray'?2:0;const next=l+1,late=k==='machine'||k==='tray'?(next>=5?4:next===4?2.5:1):k==='stock'?(next>=4?4:next===3?2.5:1):['quality','storage','wash','soundproof'].includes(k)&&next===3?2.5:1;return developmentGold(Math.round(Math.round(UPGRADES[k].base*UPGRADES[k].growth**(l-baseLevel))*late),late>1);}
  upgrade(k:Upgrade,currency:Currency='gold'){const b=this.b, cap=this.upgradeCap(k);if(b.level[k]>=cap)return false;const price=this.price(k);if(!this.payFor({kind:'upgrade',id:k},price,currency))return false;b.level[k]++;if(k==='space'||k==='table'||k==='stage')this.refreshLayoutRoutes();if(k==='speakers'||k==='stage'){b.musicMode=k==='stage'?'live':'playlist';b.volume=1;}this.emit('upgrade',`${UPGRADES[k].name} hazır!`);return true;}
  staffPrice(role:Role){return developmentGold(Math.round(Math.round(STAFF[role].base*1.85**this.b.staff[role])*(this.b.staff[role]>=2?2.5:1)),this.b.staff[role]>=2);}
  hire(role:Role,currency:Currency='gold'){if(this.b.staff[role]>=3||!this.payFor({kind:'staff',id:role},this.staffPrice(role),currency))return false;this.b.staff[role]++;if(!this.b.workers[role])this.b.workers[role]=actor({x:-.6,z:3});this.emit('upgrade',`${STAFF[role].person} ${this.b.staff[role]>1?'daha hızlı çalışıyor!':'iş başında!'}`);return true;}
  roleActors(role:Role){return [...(this.b.workers[role]?[this.b.workers[role]!]:[]),...this.b.helpers.filter(h=>h.role===role).map(h=>h.actor)];}
  staffCount(role:Role){return this.roleActors(role).length;}
  staffLimit(role:Role){return staffLimit(role);}
  additionalStaffPrice(role:Role){return developmentGold(Math.round(STAFF[role].base*1.65**this.staffCount(role)));}
  hireMore(role:Role,currency:Currency='gold'){if(!this.b.staff[role])return this.hire(role,currency);if(this.staffCount(role)>=staffLimit(role)||!this.payFor({kind:'helper',id:role},this.additionalStaffPrice(role),currency))return false;this.b.helpers.push({role,actor:actor({x:.1,z:2.6})});this.emit('upgrade','Yeni çalışan ekibe katıldı');return true;}
  // A wider floor and roomier seating carry more guests before the place feels
  // packed, so filling a café the player actually enlarged is not punished.
  get crowding(){const guests=this.b.customers.filter(c=>['waiting','drinking','sitting'].includes(c.state)).length;const extra=this.b.tableLevels.slice(0,this.b.level.table).reduce((n,l)=>n+TABLE_TYPES[l].seats-2,0);const room=(this.maxTables*2+extra*.65)*(1+this.b.level.space*.2)+this.comfort*2+6;return clamp(guests/room,0,1);}
  get musicIntensity(){return this.b.musicMode==='off'?0:this.b.volume/3*(this.b.musicMode==='live'?1:.65);}
  get indoorNoise(){return clamp(.12+.42*this.crowding+.65*this.musicIntensity-this.b.level.soundproof*.1,0,1);}
  get outsideNoise(){return clamp(this.musicIntensity*(1-this.b.level.soundproof*.24)+this.crowding*.10,0,1);}
  // Rises smoothly from 3.6 upward instead of doing nothing below four stars and
  // exploding above it, so every rating the player actually reaches is worth something.
  get reputationDemand(){const rating=this.b.rating,above=Math.max(0,rating-3.6);return clamp(.35+(rating-1)*.28+above*above*2.4,.45,8);}
  // Keeps a busy café inside a frame budget phones can still animate.
  get crowdCap(){return Math.min(MAX_CAFE_CUSTOMERS,this.seatingCapacity+this.queueCapacity+26);}
  // Guests come for the café they can see: seats, comfort and earned stars pull
  // their own traffic, so growth is felt as a real crowd. Menu width is left to
  // the per-recipe demand weights, or a focused menu would draw fewer guests.
  get capacityDraw(){return clamp(.90+this.seatingCapacity*.052+this.comfort*.10+this.b.mastery*.16,.85,6);}
  setMusic(mode:MusicMode){if(!['off','playlist','live'].includes(mode)||mode==='playlist'&&!this.b.level.speakers||mode==='live'&&!this.b.level.stage)return false;this.b.musicMode=mode;return true;}
  setVolume(n:number){if(!Number.isInteger(n)||n<0||n>3)return false;this.b.volume=n;return true;}
  private advanceNoise(dt:number){if(this.quiet)return;const b=this.b;b.patrolSeconds=Math.max(0,b.patrolSeconds-dt);b.fineCooldown=Math.max(0,b.fineCooldown-dt);
    if(this.outsideNoise<=.62){b.noiseConcern=Math.max(0,b.noiseConcern-dt*4);if(b.warningSeconds>0){b.warningSeconds=0;this.emit('toast','Ses azaldı. Komşu şikâyeti çözüldü.');}return;}
    if(b.fineCooldown>0)return;
    if(b.warningSeconds>0){b.warningSeconds=Math.max(0,b.warningSeconds-dt);if(b.warningSeconds===0){const fine=Math.min(this.s.coins,80+b.fineCount*40,200);this.s.coins-=fine;b.lastFine=fine;b.totalFines+=fine;b.fineCount++;b.patrolSeconds=18;b.fineCooldown=90;b.noiseConcern=0;this.emit('toast','Gürültü cezası yazıldı',POINTS.entry,fine);}return;}
    b.noiseConcern=Math.min(100,b.noiseConcern+(this.outsideNoise-.62)*dt*8);if(b.noiseConcern>=60){b.warningSeconds=30;this.emit('toast','Komşular sesten rahatsız. Sesi kıs veya yalıtım yap.');}
  }
  private newVisit():Visit{return {comfort:0,seconds:0,dirty:0,crowding:0,noise:0,music:0,waitFraction:0,freshness:1,quality:0};}
  private observeVisit(c:Customer,dt:number){if(c.review||!['queue','sitting','waiting','drinking','pickup-waiting'].includes(c.state))return;const v=c.visit??this.newVisit();c.visit=v;v.seconds+=dt;const dirt=c.seat>=0?Math.min(1,(this.b.dirtyTables[tableOfSeat(c.seat)]??0)/this.tableCapacity(tableOfSeat(c.seat))):Math.min(1,Object.values(this.b.dirtyTables).reduce((a,b)=>a+b,0)/Math.max(1,this.seatingCapacity))*.45;v.dirty+=Math.min(1,dirt+dirtExposure(this.cleanliness.patches,c,c.z>this.floorEnd))*dt;v.crowding+=this.crowding*dt;v.noise+=this.indoorNoise*dt;v.music+=this.musicIntensity*dt;v.comfort=(v.comfort??Math.max(0,v.seconds-dt)*this.comfort/4)+(this.comfort/4+(c.seat>=0?this.tableComfort(tableOfSeat(c.seat))/4:0))*dt;}
  private reviewGuest(c:Customer,failed?:'seat'|'service'|'stock'){if(c.review)return;const v=c.visit??this.newVisit(),seconds=Math.max(v.seconds,.01);const review=evaluateReview({id:c.id,persona:c.persona??choosePersona((c.id*.618)%1,this.s.active),time:this.b.time,waitFraction:v.waitFraction,freshness:v.freshness,quality:v.quality,dirty:v.dirty/seconds,crowding:v.crowding/seconds,noise:v.noise/seconds,music:v.music/seconds,comfort:clamp(v.comfort===undefined?this.comfort/4:v.comfort/seconds,0,2.5),failed});c.review=review;this.b.reviews.push(review);this.b.reviews=this.b.reviews.slice(-12);this.b.reviewCount++;this.b.rating=clamp(this.b.rating*.85+review.score*.15,1,5);}
  get chainComplete(){return BRANCHES.every((_,i)=>this.s.branches[i]?.mastery===3);}
  mastery(index=this.s.active){return masteryGoals(this.s.branches[index],index);}
  claimMastery(){const goal=this.mastery()[this.b.mastery];if(!goal?.ready)return false;this.b.mastery++;this.s.coins=clamp(this.s.coins+goal.reward,0,TUNING.maxMoney);this.emit('upgrade',goal.title);return true;}
  setMenu(menu:Menu){if(!(menu in MENU)||!this.b.catalog[menu])return;if(this.b.special?.status==='active'&&this.b.special.kind!==menu)return;this.b.menu=menu;this.b.offered=[menu];this.emit('toast',`${MENU[menu].name} menüye alındı.`);}
  branchUnlocked(index:number){return Number.isInteger(index)&&!!BRANCHES[index]&&(!!this.s.branches[index]||index===0||(this.s.branches[index-1]?.mastery??0)>=1);}
  switchBranch(index:number){if(!Number.isInteger(index)||!BRANCHES[index])return false;if(!this.s.branches[index]){if(!this.branchUnlocked(index)||this.s.coins<BRANCHES[index].cost)return false;this.s.coins-=BRANCHES[index].cost;this.s.branches[index]=newBranch();}if(index===this.s.active)return true;for(const [k,n] of Object.entries(this.s.player.cargo??{beans:this.s.player.beans})){if(k==='beans')this.b.stock=Math.min(this.stockCap,this.b.stock+n);else this.b.ingredients[k as Exclude<Ingredient,'beans'>]=Math.min(this.ingredientCap,this.b.ingredients[k as Exclude<Ingredient,'beans'>]+n);}this.s.player.beans=0;delete this.s.player.cargo;this.b.ready.push(...this.s.player.cups);this.s.active=index;this.s.player=actor({x:-.8,z:1});this.move={x:0,z:0};this.refreshLayoutRoutes();this.emit('branch',`${this.def.name}'na hoş geldin.`);return true;}
  get energyMultiplier(){return (this.s.energySeconds??0)>0?1.5:1;}
  // Keep the historical stock placement ID so installed ad units remain valid.
  // Its reward is now a work-speed boost, not free ingredients.
  rewardAmount(kind:'coins'|'tips'|'stock'){return kind==='coins'?Math.max(0,Math.min(500,Math.floor(TUNING.maxMoney-this.s.coins))):kind==='stock'?((this.s.energySeconds??0)>0?0:120):120;}
  reward(id:string,kind:'coins'|'tips'|'stock'){const amount=this.rewardAmount(kind);if(!id||this.s.rewardIds.includes(id)||amount<=0)return false;this.s.rewardIds.push(id);this.s.rewardIds=this.s.rewardIds.slice(-100);if(kind==='coins')this.s.coins=clamp(this.s.coins+amount,0,TUNING.maxMoney);if(kind==='tips')this.s.boostSeconds=Math.max(0,this.s.boostSeconds)+amount;if(kind==='stock')this.s.energySeconds=amount;this.emit('upgrade','Ödülün hazır. İyi molalar!');return true;}
  seatPoint(seat:number):Vec{const i=tableOfSeat(seat),t=TABLES[i],p=seatOffset(seat,this.b.tableLevels[i]);return {x:t.x+p.x,z:t.z+p.z};}
  servicePoint(seat:number):Vec{const i=tableOfSeat(seat),t=TABLES[i],tier=this.b.tableLevels[i];if(!tier)return {x:t.x-.65,z:t.z+.65};const b=tableBounds(tier);return {x:t.x+(tier>=2?1:-1)*(b.halfWidth+.25),z:t.z+b.halfDepth+.30};}
  seatApproach(seat:number):Vec{const i=tableOfSeat(seat),t=TABLES[i],p=seatLocalApproach(seat,this.b.tableLevels[i]);return {x:t.x+p.x,z:t.z+p.z};}
  private applySeatComfort(c:Customer){const comfort=this.tableComfort(tableOfSeat(c.seat)),extra=Math.max(0,comfort-(c.seatComfort??0));c.patience+=extra;c.maxPatience+=extra;c.seatComfort=comfort;}
  private facing(c:Customer){return seatOffset(c.seat,this.b.tableLevels[tableOfSeat(c.seat)]).angle;}
  blocked(p:Vec,person=true,allowedSeat=-1){if(p.x < -3.65||p.x>ROOM.walkRight||p.z< -4.4||p.z>14.6)return true;if(this.b.level.stage&&p.x>3.85&&p.x<6.75&&p.z< -2.3&&p.z> -4.4)return true;if(p.x< -1.60&&p.z<.55)return true;if(p.x< -1.79&&p.z>.46&&p.z<2.23)return true;if(p.x< -1.95&&p.z>2.95&&p.z<4.18)return true;if(p.x> -1.23&&Math.abs(p.z-(this.floorEnd-.35))<.36)return true;
   for(let i=0;i<this.b.level.table;i++){const tier=this.b.tableLevels[i],t=TABLES[i],bounds=tableBounds(tier);if(tier===0?distance(p,t)<(person?SEATING.tableClearance:.5):Math.abs(p.x-t.x)<bounds.halfWidth+(person?.14:0)&&Math.abs(p.z-t.z)<bounds.halfDepth+(person?.14:0))return true;if(person){for(const sofa of sofaBlocks(tier)){const allowed=allowedSeat>=0&&tableOfSeat(allowedSeat)===i&&distance(p,this.seatPoint(allowedSeat))<.55;if(!allowed&&Math.abs(p.x-t.x-sofa.x)<sofa.width/2+.08&&Math.abs(p.z-t.z-sofa.z)<sofa.depth/2+.08)return true;}for(const seat of tableSeats(i,tier)){if(seat!==allowedSeat&&distance(p,this.seatPoint(seat))<SEATING.chairClearance)return true;}}}return false;
  }
  private refreshLayoutRoutes(){
    for(const patch of this.cleanliness.patches){if(this.blocked(patch)){const free=this.route(patch,patch).at(-1);if(free){patch.x=free.x;patch.z=free.z;}}patch.zone=patch.z>this.floorEnd?'front':'floor';}
    this.cleanliness.patches=this.cleanliness.patches.filter((patch,i,list)=>list.slice(0,i).filter(p=>p.zone===patch.zone).length<DIRT_LIMITS[patch.zone]);
    for(const a of [this.s.player,...Object.values(this.b.workers),...this.b.helpers.map(h=>h.actor)]){
      if(!a)continue;const destination=a.path.at(-1);
      if(this.blocked(a)){const free=this.route(a,a).at(-1);if(free)Object.assign(a,free);}
      a.path=destination?this.route(a,destination):[];a.moving=false;
    }
    // Old saves used different seat offsets. Keep their orders, timers and money.
    for(const c of this.b.customers){
      if(c.state==='waiting'||c.state==='drinking'){this.applySeatComfort(c);Object.assign(c,this.seatPoint(c.seat));c.angle=c.seatAngle=this.facing(c);c.path=[];c.moving=false;}
      else if(c.state==='pickup-walking')c.path=this.route(c,TAKEAWAY.guest);
      else if(c.state==='pickup-waiting'||c.state==='pickup-done'){Object.assign(c,TAKEAWAY.guest);c.path=[];c.moving=false;}
      else if(c.state==='walking')c.path=this.route(c,this.seatApproach(c.seat),c.seat);
      else if(c.state==='leaving')c.path=this.route(c,POINTS.entry,c.seat);
      else if(c.state==='queue')c.path=[];
    }
  }
  segmentClear(from:Vec,to:Vec,allowedSeat=-1){const count=Math.max(1,Math.ceil(distance(from,to)/.06));for(let i=1;i<=count;i++){const t=i/count;if(this.blocked({x:from.x+(to.x-from.x)*t,z:from.z+(to.z-from.z)*t},true,allowedSeat))return false;}return true;}
  route(from:Vec,to:Vec,allowedSeat=-1):Vec[]{
    if(!this.blocked(from,true,allowedSeat)&&this.segmentClear(from,to,allowedSeat))return [{...to}];
    // Bounded A*, then line-of-sight smoothing with the same physical clearance.
    const step=.35, cols=40,rows=56,origin={x:-3.6,z:-4.4};
    const pos=(id:number)=>({x:origin.x+(id%cols)*step,z:origin.z+Math.floor(id/cols)*step});
    const blocked=(v:Vec)=>this.blocked(v,true,allowedSeat);
    const key=(v:Vec)=>clamp(Math.round((v.z-origin.z)/step),0,rows-1)*cols+clamp(Math.round((v.x-origin.x)/step),0,cols-1);
    const layout=`${this.b.level.space}:${this.b.level.table}:${this.b.level.stage}:${this.b.tableLevels.join(",")}:${allowedSeat}`;
    let grid=this.navigation.get(layout);if(!grid){if(this.navigation.size>=96)this.navigation.clear();grid={cells:new Int8Array(cols*rows),edges:new Map()};this.navigation.set(layout,grid);}
    const cellBlocked=(id:number)=>{if(!grid.cells[id])grid.cells[id]=blocked(pos(id))?1:2;return grid.cells[id]===1;};
    const edgeClear=(a:number,b:number)=>{const id=Math.min(a,b)*cols*rows+Math.max(a,b);let clear=grid.edges.get(id);if(clear===undefined){clear=this.segmentClear(pos(a),pos(b),allowedSeat);grid.edges.set(id,clear);}return clear;};
    let start=key(from),goal=key(to);
    const nearest=(v:Vec)=>{let best=Infinity,found=-1;for(let n=0;n<cols*rows;n++){const p=pos(n),d=distance(p,v);if(!cellBlocked(n)&&d<best){found=n;best=d;}}return found;};
    if(cellBlocked(start))start=nearest(from);if(cellBlocked(goal))goal=nearest(to);if(start<0||goal<0)return [];
    const open=new Set([start]),g=new Map([[start,0]]),f=new Map([[start,distance(pos(start),pos(goal))]]),prev=new Map<number,number>();
    for(let iter=0;open.size&&iter<cols*rows;iter++){let current=-1,best=Infinity;for(const n of open){if((f.get(n)??Infinity)<best){current=n;best=f.get(n)!;}}if(current===goal){const path:Vec[]=[];let n=current;while(n!==start){path.unshift(pos(n));n=prev.get(n)!;}if(blocked(from))path.unshift(pos(start));if(!blocked(to))path.push({...to});else if(!path.length)path.push(pos(goal));
      const smooth:Vec[]=[];let anchor=from,index=0;while(index<path.length){let last=index;for(let j=path.length-1;j>=index;j--){if(this.segmentClear(anchor,path[j],allowedSeat)){last=j;break;}}smooth.push(path[last]);anchor=path[last];index=last+1;}return smooth;}
      open.delete(current);for(const [dx,dz] of [[1,0],[-1,0],[0,1],[0,-1]]){const x=current%cols+dx,z=Math.floor(current/cols)+dz;if(x<0||x>=cols||z<0||z>=rows)continue;const n=z*cols+x;if(cellBlocked(n)||!edgeClear(current,n))continue;const tentative=g.get(current)!+step;if(tentative<(g.get(n)??Infinity)){prev.set(n,current);g.set(n,tentative);f.set(n,tentative+distance(pos(n),pos(goal)));open.add(n);}}}
    return [];
  }
  private rise(c:Customer){const progress=c.state==='sitting'?1-c.timer/SEATING.sitSeconds:1;c.state='standing';c.timer=SEATING.standSeconds*progress;c.path=[];c.moving=false;}
  go(to:Vec){this.s.player.path=this.route(this.s.player,to);}
  private walk(a:Actor,dt:number,speed:number){a.moving=false;let budget=dt*speed;while(a.path.length&&budget>0){const t=a.path[0],d=distance(a,t);if(d<.015){a.path.shift();continue;}const step=Math.min(d,budget);a.angle=Math.atan2(t.x-a.x,t.z-a.z);a.x+=(t.x-a.x)/d*step;a.z+=(t.z-a.z)/d*step;budget-=step;a.moving=true;if(step===d)a.path.shift();}}
  private target(a:Actor,p:Vec){const last=a.path.at(-1);if(distance(a,p)>.22&&(!last||distance(last,p)>.25))a.path=this.route(a,p);}
  private serve(a:Actor,table?:number){for(const c of this.waiting){if(table!==undefined&&(c.takeaway?-1:tableOfSeat(c.seat))!==table)continue;if(distance(a,this.orderPoint(c))>1.12||this.b.cleanDishes<1)continue;const index=a.cups.findIndex(cup=>cup.kind===c.kind);if(index<0)continue;const [cup]=a.cups.splice(index,1);c.state=c.takeaway?'pickup-done':'drinking';c.timer=c.takeaway?TAKEAWAY.handoff:MENU[c.kind].sit*(this.s.active===1?.7:1)*(1+(c.seat>=0?this.tableComfort(tableOfSeat(c.seat)):0)*.16+this.comfort*.05);const fraction=c.patience/c.maxPatience;if(c.kind===this.def.preference&&((this.s.active===0&&fraction>=.5)||(this.s.active===1&&fraction>=.6)||(this.s.active===2&&cup.quality>=2)))this.b.signatureServed++;const pref=this.def.preference===c.kind?1.15:1;const tips= fraction>.55?1.15:1;const boost=this.s.boostSeconds>0?2:1;const price=Math.round((c.quotedPrice??this.recipePrice(c.kind))*(1+cup.quality*.15)*pref*tips*boost*(c.takeaway?TAKEAWAY.price:1));c.action=price;this.b.cleanDishes--;const visit=c.visit??this.newVisit();visit.waitFraction=1-fraction;visit.freshness=clamp(1-(this.b.time-cup.born)/MENU[c.kind].freshness,0,1);visit.quality=cup.quality;c.visit=visit;if(c.takeaway){c.cups=[cup];this.b.cleanDishes++;}this.completeOrder(c);this.emit('serve',c.takeaway?'Paketin hazır!':'Afiyet olsun!',c);}}
  private completeOrder(c:Customer,b=this.b){
    if(c.paid)return;c.paid=true;
    this.s.coins=clamp(this.s.coins+c.action,0,TUNING.maxMoney);recordFinanceSale(this.s,c.action);
    if(c.takeaway)b.takeaway.served++;
    b.earned+=c.action;b.served++;this.s.totalServed++;const order=b.special;if(order?.status==='active'&&c.specialId===order.id&&c.kind===order.kind){order.fulfilled++;if(order.fulfilled>=order.target){order.status='ready';if(b===this.b)this.emit('upgrade','Özel sipariş tamamlandı');}}
    if(b===this.b)this.emit('coin',`+${c.action}`,c,c.action);
  }
  private settleLegacyPayments(){
    // Shipped saves may contain already-counted table/counter cash, or a
    // delivered drink whose sale was previously deferred until the guest left.
    // Clearing cash and marking delivered orders paid makes reload idempotent.
    for(const b of Object.values(this.s.branches)){
      this.s.coins=clamp(this.s.coins+Object.values(b.cash).reduce((a,n)=>a+n,0)+b.takeaway.cash,0,TUNING.maxMoney);
      b.cash={};b.takeaway.cash=0;b.servicePolicy='balanced';
      for(const c of b.customers)if(c.state==='drinking'&&!c.paid)this.completeOrder(c,b);
    }
  }
  private pickup(a:Actor,capacity:number){
    if(a.beans||distance(a,POINTS.machine)>.85)return;
    const other=[this.s.player,...this.roleActors('waiter')].filter(actor=>actor!==a).flatMap(actor=>actor.cups);
    const needed=new Map<Menu,number>();
    if(this.pendingOrders.length){for(const order of this.unfilledOrders(other))needed.set(order.kind,(needed.get(order.kind)??0)+1);}

    const surplus:Cup[]=[];for(const cup of a.cups){const n=needed.get(cup.kind)??0;if(n)needed.set(cup.kind,n-1);else surplus.push(cup);}
    // Exchange at the real machine. Old products retain their kind, age and quality.
    // Swapping works even with a full shelf; no cup is silently discarded.
    let exchanged=false;
    for(const old of surplus){const at=a.cups.indexOf(old),index=this.b.ready.findIndex(c=>(needed.get(c.kind)??0)>0);
      if(index>=0){const fresh=this.b.ready[index];this.b.ready[index]=old;a.cups[at]=fresh;needed.set(fresh.kind,needed.get(fresh.kind)!-1);exchanged=true;}
      else if(this.b.ready.length<5){a.cups.splice(at,1);this.b.ready.push(old);exchanged=true;}
    }
    if(a.cups.length<capacity){const index=this.b.ready.findIndex(c=>(needed.get(c.kind)??0)>0);if(index>=0)a.cups.push(this.b.ready.splice(index,1)[0]);}
    if(exchanged&&a===this.s.player)this.emit('toast','Tepsin siparişlere göre düzenlendi. Eski ürünler rafta.');
  }
  acceptContract(kind:Menu){if(this.b.special&&this.b.special.status!=='failed')return false;const offer=contractOffers(this).find(o=>o.kind===kind);if(!offer||!this.b.staff.waiter)return false;this.b.special={kind:offer.kind,target:offer.target,seconds:offer.seconds,reward:offer.reward,id:++this.b.contractSerial,fulfilled:0,status:'active'};if(!this.b.offered.includes(kind))this.b.offered.push(kind);this.emit('upgrade','Özel sipariş başladı');return true;}
  claimContract(){const order=this.b.special;if(order?.status!=='ready')return false;this.s.coins=clamp(this.s.coins+order.reward,0,TUNING.maxMoney);this.b.contractsCompleted++;this.b.special=null;this.emit('upgrade','Özel sipariş ödülü alındı');return true;}
  get ingredientCap(){return 24+this.b.level.stock*12;}
  get depotCap(){return 60+this.b.level.storage*20;}
  ingredient(k:Ingredient){return k==='beans'?this.b.stock:this.b.ingredients[k];}
  get needsSupply(){return (Object.keys(INGREDIENTS) as Ingredient[]).some(k=>this.ingredient(k)<(k==='beans'?this.stockCap:this.ingredientCap)-4);}
  get supplyAvailable(){return (Object.keys(INGREDIENTS) as Ingredient[]).some(k=>this.b.depot[k]>0&&this.ingredient(k)<(k==='beans'?this.stockCap:this.ingredientCap));}
  canPrepare(kind:Menu){return (Object.keys(INGREDIENTS) as Ingredient[]).every(k=>this.ingredient(k)>=MENU[kind].recipe[k]);}
  recipePrice(kind:Menu){return Math.round(MENU[kind].price*(1+Math.max(0,this.b.catalog[kind]-1)*.1)*PRICING[this.b.priceModes[kind]].price);}
  recipeUpgradeCost(kind:Menu){const level=this.b.catalog[kind];if(!level)return MENU[kind].unlock;const trained=developmentGold(Math.round((80+MENU[kind].price*3)*1.8**(level-1))*(level>=2?3:1),level>=2);return Math.max(trained,Math.ceil(MENU[kind].unlock*(level===1?1.1:1.8)/5)*5);}
  upgradeRecipe(kind:Menu,currency:Currency='gold'){if(!Object.hasOwn(MENU,kind)||this.b.catalog[kind]>=3)return false;const price=this.recipeUpgradeCost(kind);if(!this.payFor({kind:'recipe',id:kind},price,currency))return false;const unlocked=!this.b.catalog[kind];this.b.catalog[kind]++;if(unlocked)this.b.offered.push(kind);this.emit('upgrade',`${MENU[kind].name} hazır!`);return true;}
  toggleRecipe(kind:Menu){if(!Object.hasOwn(MENU,kind)||!this.b.catalog[kind])return false;const i=this.b.offered.indexOf(kind);if(i>=0){if(this.b.offered.length===1||(this.b.special?.status==='active'&&this.b.special.kind===kind))return false;this.b.offered.splice(i,1);}else this.b.offered.push(kind);this.b.menu=this.b.offered[0];return true;}
  private workAt(a:Actor,task:string,dt:number,seconds:number){if(a.task!==task){a.task=task;a.action=0;}a.action+=dt;if(a.action<seconds)return false;a.action=0;return true;}
  private incoming(k:Ingredient){return [this.s.player,...this.roleActors('supplier')].reduce((n,a)=>n+(a.cargo?.[k]??(k==='beans'&&!a.cargo?a.beans:0)),0);}
  private supply(a:Actor,dt:number){
    if(distance(a,POINTS.supply)<.85&&!a.beans&&!a.cups.length&&this.needsSupply&&this.supplyAvailable&&this.workAt(a,'supply',dt,.65)){
      a.cargo={};for(const k of Object.keys(INGREDIENTS) as Ingredient[]){const amount=Math.max(0,Math.min(this.b.depot[k],Math.round((8+this.b.level.stock*4)*(1+this.b.level.storage*.25)),(k==='beans'?this.stockCap:this.ingredientCap)-this.ingredient(k)-this.incoming(k)));if(amount){a.cargo[k]=amount;this.b.depot[k]-=amount;}}
      a.beans=Object.values(a.cargo).reduce((n,v)=>n+v,0);if(a===this.s.player)this.emit('toast','Malzemeler hazır. Hazırlık tezgâhına taşı.');
    }
    if(a.beans&&distance(a,POINTS.machine)<.85){const cargo=a.cargo??{beans:a.beans};for(const k of Object.keys(cargo) as Ingredient[]){const amount=Math.min(cargo[k]??0,(k==='beans'?this.stockCap:this.ingredientCap)-this.ingredient(k));if(k==='beans')this.b.stock+=amount;else this.b.ingredients[k]+=amount;cargo[k]=(cargo[k]??0)-amount;}a.cargo=cargo;a.beans=Object.values(cargo).reduce((n,v)=>n+(v??0),0);if(!a.beans)delete a.cargo;a.task=undefined;a.action=0;if(a===this.s.player)this.emit('toast','Hazırlık tezgâhının malzemeleri doldu.');}
  }
  get cleanliness(){return this.b.cleanliness??=freshCleanliness();}
  get premisesDirtCounts(){const patches=this.cleanliness.patches;return {floor:patches.filter(p=>p.zone==='floor').length,front:patches.filter(p=>p.zone==='front').length};}
  get cleanlinessScore(){return Math.round(100*(1-Math.min(.6,this.cleanliness.patches.length*.03)));}
  nearestDirt(at:Vec=this.s.player){return this.cleanliness.patches.filter(p=>!this.blocked(p)).sort((a,b)=>distance(at,a)-distance(at,b))[0];}
  private trackFootTraffic(at:Vec,meters:number){if(!Number.isFinite(meters)||meters<=0||meters>2)return;const state=this.cleanliness,zone=at.z>this.floorEnd?'front':'floor',key=zone==='floor'?'floorTravel':'frontTravel';state[key]=Math.min(DIRT_TRAVEL[zone]+2,state[key]+meters);if(this.b.served<2||state[key]<DIRT_TRAVEL[zone])return;if(this.blocked(at)||state.patches.some(p=>distance(p,at)<.8))return;state[key]-=DIRT_TRAVEL[zone];if(state.patches.filter(p=>p.zone===zone).length>=DIRT_LIMITS[zone])return;const id=++state.serial;state.patches.push({id,x:at.x,z:at.z,zone,kind:zone==='front'||id%3===0?'litter':'spill',work:0});}
  private sweep(a:Actor,patch:DirtPatch,dt:number){if(a.beans||a.moving||distance(a,patch)>.7)return false;const task=`sweep-${patch.id}`;if(a.task!==task){a.task=task;a.action=0;}a.angle=Math.atan2(patch.x-a.x,patch.z-a.z);patch.work=Math.min(dirtSeconds(patch),patch.work+dt);a.action=patch.work;if(patch.work<dirtSeconds(patch))return false;this.cleanliness.patches=this.cleanliness.patches.filter(p=>p.id!==patch.id);this.cleanliness.cleaned++;this.clearClaim(a);this.emit('brew',patch.zone==='floor'?'Zemin temizlendi':'Dükkân önü temizlendi',patch);return true;}
  private workerSweep(a:Actor,dt:number){const patches=this.cleanliness.patches,others=this.roleActors('cleaner').filter(other=>other!==a),claimed=new Set(others.map(other=>other.task));const current=a.task?.startsWith('sweep-')?patches.find(p=>a.task===`sweep-${p.id}`):undefined;
   const patch=current&&!claimed.has(`sweep-${current.id}`)&&!this.blocked(current)?current:patches.filter(p=>!claimed.has(`sweep-${p.id}`)&&!this.blocked(p)).sort((x,y)=>distance(a,x)-distance(a,y))[0];
   if(!patch){if(a.task?.startsWith('sweep-'))this.clearClaim(a);return false;}if(a.task!==`sweep-${patch.id}`){a.task=`sweep-${patch.id}`;a.action=0;a.path=[];}if(distance(a,patch)>.65)this.target(a,patch);else{a.path=[];a.moving=false;this.sweep(a,patch,dt);}return true;
  }
  dirtyTable(){return Object.keys(this.b.dirtyTables).map(Number).find(i=>this.b.dirtyTables[i]>0);}
  private care(a:Actor,dt:number,washOnly=false,cleanOnly=false,assignedTable?:number){
    if(a.beans)return;
    if(!cleanOnly&&this.b.dirtyDishes>0&&distance(a,POINTS.wash)<1){if(this.workAt(a,'wash',dt,2.2/(1+this.b.level.wash*.35))){const n=Math.min(4,this.b.dirtyDishes);this.b.dirtyDishes-=n;this.b.cleanDishes+=n;this.emit('brew','Fincanlar tertemiz',POINTS.wash);}return;}
    if(!washOnly)for(const key of Object.keys(this.b.dirtyTables)){const table=Number(key);if(assignedTable!==undefined&&assignedTable!==table)continue;if(distance(a,this.servicePoint(table*2))<1.2){if(this.workAt(a,`clean-${table}`,dt,1)){this.b.dirtyDishes+=this.b.dirtyTables[table];delete this.b.dirtyTables[table];this.emit('brew','Masa temizlendi',TABLES[table]);}return;}}
    if(!washOnly&&!cleanOnly){const patch=this.nearestDirt(a);if(patch&&distance(a,patch)<.7){this.sweep(a,patch,dt);return;}}
    if(!cleanOnly&&(a.task?.startsWith('clean')||a.task?.startsWith('sweep-')||a.task==='wash')){a.task=undefined;a.action=0;}
  }
  private claimed(role:Role,table:number,except:Actor){const task=`${role==='cleaner'?'clean':'serve'}-${table}`;return this.roleActors(role).some(a=>a!==except&&a.task===task);}
  private clearClaim(a:Actor){a.task=undefined;a.action=0;a.path=[];}
  private validateClaims(){const dirtUsed=new Set<number>();for(const a of this.roleActors('cleaner'))if(a.task?.startsWith('sweep-')){const id=Number(a.task.slice(6));if(dirtUsed.has(id)||!this.cleanliness.patches.some(p=>p.id===id))this.clearClaim(a);else dirtUsed.add(id);}
   for(const role of ['cleaner','waiter'] as const){const used=new Set<number>();for(const a of this.roleActors(role)){const prefix=role==='cleaner'?'clean-':'serve-';if(!a.task?.startsWith(prefix))continue;const table=Number(a.task.slice(prefix.length));const valid=role==='cleaner'?this.b.dirtyTables[table]>0:this.waiting.some(c=>(c.takeaway?-1:tableOfSeat(c.seat))===table&&a.cups.some(cup=>cup.kind===c.kind));if(!valid||used.has(table))this.clearClaim(a);else used.add(table);}}}
  private worker(role:Role,a:Actor,dt:number,slot=0){const b=this.b;this.walk(a,dt,TUNING.workerSpeed*(1+(b.staff[role]-1)*.22));
    if(role==='cleaner'){
      if(slot>0&&this.cleanliness.patches.length>=4&&this.workerSweep(a,dt*(1+(b.staff.cleaner-1)*.25)))return;
      const old=a.task?.startsWith('clean-')?Number(a.task.slice(6)):undefined;
      const table=old!==undefined&&b.dirtyTables[old]>0&&!this.claimed(role,old,a)?old:Object.keys(b.dirtyTables).map(Number).find(i=>!this.claimed(role,i,a));
      if(table===undefined){if(a.task?.startsWith('clean-'))this.clearClaim(a);if(this.workerSweep(a,dt*(1+(b.staff.cleaner-1)*.25)))return;this.target(a,{x:-.45+slot*.7,z:2.8});return;}
      if(a.task!==`clean-${table}`){a.task=`clean-${table}`;a.action=0;a.path=[];}
      this.care(a,dt*(1+(b.staff.cleaner-1)*.25),false,true,table);
      if(!b.dirtyTables[table]){this.clearClaim(a);return;}this.target(a,this.servicePoint(table*2));return;
    }
    if(role==='dishwasher'){this.care(a,dt*(1+(b.staff.dishwasher-1)*.25),true);this.target(a,slot?{x:-.9,z:2.85}:POINTS.wash);return;}
    if(role==='barista'){this.target(a,{x:-1.3,z:-3.6+slot*2});return;}
    if(role==='supplier'){this.supply(a,dt);this.target(a,a.beans?POINTS.machine:this.needsSupply?POINTS.supply:{x:-1.5+slot*.7,z:1.3});return;}
    this.pickup(a,b.level.tray);
    // Take every ready cup the floor still needs before walking out. Leaving the
    // machine with a single cup, not the number of waiters, is what capped service.
    // Never idle for a brew: a slow recipe must not delay the order already in hand.
    if(a.cups.length<b.level.tray&&distance(a,POINTS.machine)<.85){
      const open=this.unfilledOrders([this.s.player,...this.roleActors('waiter')].flatMap(actor=>actor.cups));
      if(b.ready.some(cup=>open.some(order=>order.kind===cup.kind))){this.target(a,POINTS.machine);return;}
    }
    const current=a.task?.startsWith('serve-')?Number(a.task.slice(6)):undefined;
    const matches=this.waiting.filter(c=>a.cups.some(cup=>cup.kind===c.kind)&&!this.claimed('waiter',c.takeaway?-1:tableOfSeat(c.seat),a));
    const customer=matches.find(c=>(c.takeaway?-1:tableOfSeat(c.seat))===current)??matches[0];
    if(customer){const table=customer.takeaway?-1:tableOfSeat(customer.seat);if(a.task!==`serve-${table}`){a.task=`serve-${table}`;a.action=0;a.path=[];}this.serve(a,table);if(this.waiting.some(c=>(c.takeaway?-1:tableOfSeat(c.seat))===table&&a.cups.some(cup=>cup.kind===c.kind)))this.target(a,this.orderPoint(customer));else this.clearClaim(a);return;}
    if(a.task?.startsWith('serve-'))this.clearClaim(a);
    if(a.cups.length&&!this.waiting.length){this.target(a,{x:-.45+slot*.65,z:-1});return;}this.target(a,POINTS.machine);
  }
  private expire(cups:Cup[]){const b=this.b;for(let i=cups.length-1;i>=0;i--){if(b.time-cups[i].born>MENU[cups[i].kind].freshness){cups.splice(i,1);b.waste++;const times=this.wasteTimes.get(b)??[];times.push(b.time);this.wasteTimes.set(b,times.slice(-80));this.emit('waste','Bir ürün soğudu.');}}}
  private spawn(){const b=this.b;if(this.learningService&&b.customers.filter(c=>c.state!=='leaving').length>=2)return;const offered=this.b.offered,weight=offered.reduce((n,k)=>n+this.menuDemand(k),0);let choice=this.random()*weight,kind=offered[0];for(const item of offered){choice-=this.menuDemand(item);if(choice<=0){kind=item;break;}}if(this.learningService&&offered.includes('espresso'))kind='espresso';const special=b.special;const assigned=special?.status==='active'&&special.fulfilled+b.customers.filter(c=>c.specialId===special.id&&!c.paid&&c.state!=='leaving'&&c.state!=='standing').length<special.target&&this.random()<.7;if(assigned)kind=special.kind;const patience=((this.learningService?70:this.def.patience)+this.comfort)*(this.s.settings.assist?1.6:1);const c:Customer={...actor(POINTS.entry),persona:choosePersona((Math.imul(++b.guestSerial,2654435761)>>>0)/4294967296,this.s.active),visit:this.newVisit(),id:this.id++,kind,specialId:assigned?special!.id:undefined,takeaway:this.takeawayActive&&MENU[kind].category!=='Tatlı'&&this.random()<TAKEAWAY.share,state:'queue',seat:-1,patience,maxPatience:patience,timer:0,paid:false,tint:Math.floor(this.random()*6)};const line=this.queue.length,share=line/this.queueCapacity;
    if(line>=this.queueCapacity||b.customers.length>=this.crowdCap||(share>.5&&this.random()<(share-.5)*1.6)){b.lost++;b.losses[c.takeaway?'service':'seat']++;this.emit('lost',line>=this.queueCapacity?'Sıra dolu · bir misafir ayrıldı.':'Sıra uzun · bir misafir vazgeçti.',POINTS.entry);return;}b.customers.push(c);}
  step(dt:number){
    if(!Number.isFinite(dt)||dt<=0)return;dt=Math.min(dt,.1);
    this.s.boostSeconds=Math.max(0,this.s.boostSeconds-dt);this.s.energySeconds=Math.max(0,(this.s.energySeconds??0)-dt);this.stepLocal(dt);
    this.backgroundTime+=dt;
    while(this.backgroundTime>=.1-1e-9){this.backgroundTime=Math.max(0,this.backgroundTime-.1);for(const key of Object.keys(this.s.branches)){const index=Number(key);if(index!==this.s.active)this.unattended(index,.1);}}
    this.awardMilestones();const settlement=advanceFinances(this.s,dt);if(settlement)this.events.push({type:'finance',text:'',value:-settlement.paid,settlement});
  }
  private unattended(index:number,dt:number){
    const branch=this.s.branches[index];if(!Object.values(branch.staff).every(n=>n>0))return;
    const active=this.s.active,player=this.s.player,move=this.move,quiet=this.quiet;
    try{this.s.active=index;this.s.player=actor(POINTS.entry);this.move={x:0,z:0};this.quiet=true;this.stepLocal(dt);}
    finally{this.s.active=active;this.s.player=player;this.move=move;this.quiet=quiet;}
  }
  private stepLocal(dt:number){const b=this.b;b.time+=dt;const p=this.s.player,workDt=dt*this.energyMultiplier;this.advanceNoise(dt);
    if(b.special?.status==='active'){b.special.seconds=Math.max(0,b.special.seconds-dt);if(b.special.seconds===0){b.special.status='failed';this.emit('toast','Özel siparişin süresi doldu. Normal satış kazancın sende.');}}
    b.deliveryIn-=dt;if(b.deliveryIn<=0){b.deliveryIn+=60;for(const k of Object.keys(INGREDIENTS) as Ingredient[])b.depot[k]=this.depotCap;}
    if(Math.hypot(this.move.x,this.move.z)>.08){p.path=[];const oldX=p.x,oldZ=p.z,m=Math.max(1,Math.hypot(this.move.x,this.move.z)),dx=this.move.x/m*workDt*TUNING.moveSpeed,dz=this.move.z/m*workDt*TUNING.moveSpeed;if(!this.blocked({x:p.x+dx,z:p.z}))p.x+=dx;if(!this.blocked({x:p.x,z:p.z+dz}))p.z+=dz;p.angle=Math.atan2(dx,dz);p.moving=Math.hypot(p.x-oldX,p.z-oldZ)>.00001;}else this.walk(p,workDt,TUNING.moveSpeed);
    this.serve(p);this.supply(p,workDt);this.pickup(p,b.level.tray);this.care(p,workDt);
    this.validateClaims();
    for(const role of Object.keys(b.workers) as Role[])this.worker(role,b.workers[role]!,workDt);
    for(const role of ROLES){const helpers=b.helpers.filter(h=>h.role===role);helpers.forEach((h,i)=>this.worker(role,h.actor,workDt,i+1));}
    const staffedCount=this.roleActors('barista').filter((a,i)=>distance(a,{x:-1.3,z:-3.6+i*2})<.4).length;const staffed=staffedCount>0;const manual=distance(p,POINTS.machine)<.85&&!p.beans&&p.cups.length<b.level.tray;
    const inventory=[...b.ready,...p.cups,...this.roleActors('waiter').flatMap(a=>a.cups)],unfilled=this.unfilledOrders(inventory);
    if(b.brew>0&&(!unfilled.some(c=>c.kind===b.brewing)||!this.canPrepare(b.brewing)))b.brew=0;const recipe=b.brew>0?b.brewing:unfilled.find(c=>this.canPrepare(c.kind))?.kind;
    if(recipe&&(manual||staffed)&&this.canPrepare(recipe)&&b.ready.length<Math.min(5,b.prep)&&unfilled.length>0){
      if(b.brew===0)b.brewing=recipe;
      b.brew+=workDt*(staffed?(1+(b.staff.barista-1)*.18)*(1+(staffedCount-1)*.55):1);if(b.brew>=this.brewTime){b.brew=0;for(const k of Object.keys(INGREDIENTS) as Ingredient[]){if(k==='beans')b.stock-=MENU[b.brewing].recipe[k];else b.ingredients[k]-=MENU[b.brewing].recipe[k];}b.ready.push({kind:b.brewing,quality:b.level.quality,born:b.time});this.emit('brew','Taze kahve',POINTS.machine);}
    }
    this.expire(b.ready);this.expire(p.cups);for(const waiter of this.roleActors('waiter'))this.expire(waiter.cups);
    b.spawn-=dt;if(b.spawn<=0){this.spawn();const rush=1+Math.floor(b.time/75)%3*.18;b.spawn=Math.max(.5,this.def.arrival/(this.demand*rush*this.reputationDemand*this.capacityDraw*(1+this.musicIntensity*.18)));}
    let pickupOccupied=b.customers.some(c=>['pickup-walking','pickup-waiting','pickup-done'].includes(c.state));const occupied=new Set(b.customers.filter(c=>c.seat>=0&&c.state!=='leaving').map(c=>c.seat));let qi=0;
    const usedAt=new Map<number,number>();for(const seat of occupied)usedAt.set(tableOfSeat(seat),(usedAt.get(tableOfSeat(seat))??0)+1);
    for(const c of b.customers){const previous={x:c.x,z:c.z};if(c.state==='waiting'||c.state==='drinking')this.applySeatComfort(c);this.observeVisit(c,dt);if(c.state==='queue'){let seat=-1;if(c.takeaway&&!pickupOccupied){pickupOccupied=true;c.state='pickup-walking';c.path=this.route(c,TAKEAWAY.guest);}if(!c.takeaway)for(const i of this.seatIds){const table=tableOfSeat(i);if(!occupied.has(i)&&(usedAt.get(table)??0)+(b.dirtyTables[table]??0)<this.tableCapacity(table)){seat=i;break;}}if(seat>=0){occupied.add(seat);usedAt.set(tableOfSeat(seat),(usedAt.get(tableOfSeat(seat))??0)+1);c.seat=seat;c.state='walking';c.path=this.route(c,this.seatApproach(seat));}else if(c.state==='queue'){const q={x:QUEUE_LINE.x+(qi%QUEUE_LINE.perRow)*QUEUE_LINE.step,z:QUEUE_LINE.z+Math.floor(qi/QUEUE_LINE.perRow)*QUEUE_LINE.rowGap};this.target(c,q);qi++;}}
      if(['queue','sitting','waiting','pickup-waiting'].includes(c.state)){const cause=this.waitCauses.get(c)??{total:0,stock:0};if(c.state!=='queue'){cause.total+=dt;const available=[...b.ready,...p.cups,...this.roleActors('waiter').flatMap(a=>a.cups)].some(cup=>cup.kind===c.kind)||(b.brew>0&&b.brewing===c.kind);if(!this.canPrepare(c.kind)&&!available)cause.stock+=dt;this.waitCauses.set(c,cause);}c.patience-=dt;if(c.patience<=0){const reason=c.state==='queue'&&!c.takeaway?'seat':cause.stock>=5&&cause.stock>cause.total*.5?'stock':'service';b.losses[reason]++;b.lost++;this.reviewGuest(c,reason);if(c.state==='waiting'||c.state==='sitting')this.rise(c);else {c.state='leaving';c.path=this.route(c,POINTS.entry);}this.emit('lost',reason==='seat'?'Masa yok · misafir ayrıldı':reason==='stock'?'Çekirdek yok · sipariş bekledi':'Sipariş yetişmedi · misafir ayrıldı',c);}}
      if(c.state==='drinking'){c.timer-=dt;if(c.timer<=0){this.completeOrder(c);this.reviewGuest(c);this.rise(c);}}
      if(c.state==='pickup-done'){c.timer=Math.max(0,c.timer-dt);if(c.timer===0){this.reviewGuest(c);c.state='leaving';c.path=this.route(c,POINTS.entry);}}
      if(c.state==='sitting'||c.state==='standing'){
        const sitting=c.state==='sitting';c.timer=Math.max(0,c.timer-dt);const blend=easeSeat(sitting?1-c.timer/SEATING.sitSeconds:c.timer/SEATING.standSeconds),seat=this.seatPoint(c.seat);
        const approach=this.seatApproach(c.seat);c.x=seat.x+(approach.x-seat.x)*(1-blend);c.z=seat.z+(approach.z-seat.z)*(1-blend);c.angle=c.seatAngle=this.facing(c);c.moving=false;
        if(c.timer===0){if(sitting){c.state='waiting';this.applySeatComfort(c);c.quotedPrice??=this.recipePrice(c.kind);}else {if(c.paid){if(b.served>=6)b.dirtyTables[tableOfSeat(c.seat)]=(b.dirtyTables[tableOfSeat(c.seat)]??0)+1;else b.cleanDishes++;}c.state='leaving';c.path=this.route(c,POINTS.entry,c.seat);}}
      }else if(!['waiting','drinking','pickup-waiting','pickup-done'].includes(c.state))this.walk(c,dt,TUNING.customerSpeed);
      if(c.state==='pickup-walking'&&!c.path.length){if(distance(c,TAKEAWAY.guest)<.08){c.state='pickup-waiting';c.quotedPrice??=this.recipePrice(c.kind);c.angle=-Math.PI/2;c.moving=false;}else{c.state='queue';c.moving=false;}}
      if(c.moving)this.trackFootTraffic(c,distance(previous,c));
      if(c.state==='walking'&&!c.path.length){if(distance(c,this.seatApproach(c.seat))<.08){c.state='sitting';c.timer=SEATING.sitSeconds;c.moving=false;}else {c.state='queue';c.seat=-1;c.moving=false;}}

    }
    b.customers=b.customers.filter(c=>c.state!=='leaving'||distance(c,POINTS.entry)>.25);
  }
  private awardMilestones(){
    const goals=[3,10,25,60,120,250,500];while(this.s.milestone<goals.length&&this.s.totalServed>=goals[this.s.milestone]){const award=Math.min([35,65,100,150,250,400,650][this.s.milestone],Math.floor(TUNING.maxMoney-this.s.coins));this.s.milestone++;this.s.coins=clamp(this.s.coins+award,0,TUNING.maxMoney);this.emit('upgrade',`${this.s.totalServed} mutlu mola! +${award} altın`);}
  }
  offline(now:number,paidAccess=false,activatedAt=0){
    if(!Number.isFinite(now))return {amount:0,seconds:0,served:0};
    const elapsed=clamp((now-Math.max(this.s.savedAt,Number.isFinite(activatedAt)?activatedAt:now))/1000,0,TUNING.offlineCap),before=this.s.coins,served=this.s.totalServed;
    // Access is supplied by the native verified purchase layer, never by a save flag.
    if(paidAccess!==true||!Number.isFinite(activatedAt)||activatedAt<0){this.s.savedAt=Math.max(this.s.savedAt,now);return {amount:0,seconds:elapsed,served:0};}
    // A quiet shift uses actual orders and staff. No imaginary sales or signature stars.
    const boost=this.s.boostSeconds,energy=this.s.energySeconds,quiet=this.quiet;this.s.boostSeconds=0;this.s.energySeconds=0;this.quiet=true;
    try{for(let remaining=elapsed*TUNING.offlineWorkRate;remaining>1e-8;){const dt=Math.min(.1,remaining);for(const index of Object.keys(this.s.branches))this.unattended(Number(index),dt);remaining-=dt;}this.expire(this.s.player.cups);this.awardMilestones();}
    finally{this.s.boostSeconds=boost;this.s.energySeconds=energy;this.quiet=quiet;}
    this.s.savedAt=Math.max(this.s.savedAt,now);
    return {amount:this.s.coins-before,seconds:elapsed,served:this.s.totalServed-served};
  }
  branchNote(index:number){const active=this.s.active,player=this.s.player;try{this.s.active=index;if(index!==active)this.s.player=actor(POINTS.entry);return this.bottleneck();}finally{this.s.active=active;this.s.player=player;}}
  bottleneck(){return operationsNote(this);}
  objective():{title:string;text:string;target:Vec;panel?:'staff'|'menu'|'upgrade'|'branches'|'mastery'|'takeaway'}{if(this.s.totalServed===0)return {title:'İlk kahvenin kokusu',text:'Makineye dokun. Yanında durunca kahve hazırlar, tepsiye alırsın.',target:POINTS.machine};if(this.s.totalServed<3)return {title:'İlk müdavimlerin',text:'Kahveyi servis et. Kazancın anında cüzdanına eklenir.',target:TABLES[0]};if(this.b.level.table===1)return {title:'Bir masa daha, daha çok misafir',text:'Geliştir → Yeni masa: iki kişiye daha yer aç.',target:TABLES[1]};if(!this.b.staff.barista)return {title:'Birlikte daha güzel',text:'İlk baristanı işe al. Kahveleri Ece hazırlasın.',target:POINTS.machine};if(!this.b.staff.waiter)return {title:'Servisi devret, büyümeye bak',text:'Garson Can siparişleri teslim eder, sen kafeni büyütürsün.',target:TABLES[0]};if(!this.b.staff.supplier)return {title:'Stoğu ekibine bırak',text:'Ada çekirdekleri taşısın. Sen işletmenin büyümesine odaklan.',target:POINTS.supply,panel:'staff'};
    if(this.mastery()[this.b.mastery]?.ready)return {title:'Yeni yıldızın hazır',text:'Ekibinin başarısını kalıcı bir yıldıza dönüştür.',target:POINTS.entry,panel:'mastery'};
    if(this.s.active===1&&this.b.mastery>=1&&!this.b.takeaway.owned)return {title:'Ofiste yeni bir servis yolu',text:'Paket tezgâhına yatırım yap veya bir sonraki semt için biriktir.',target:TAKEAWAY.service,panel:'takeaway'};
    const next=BRANCHES.findIndex((_,i)=>!this.s.branches[i]);
    if(next>0&&this.branchUnlocked(next))return {title:'Büyümek için iki yol',text:'Bu kafeye yatırım yapabilir veya yeni semtte bir şube açabilirsin.',target:POINTS.entry,panel:'branches'};
    if(next>0&&this.s.active===next-1&&this.b.mastery===0)return {title:'İlk yıldız, yeni bir semt',text:'40 servis, iki masa ve üç farklı çalışan. İlk yıldızın yeni şubenin yolunu açar.',target:POINTS.entry,panel:'mastery'};
    if(this.b.level.table>=this.maxTables&&this.b.level.space<this.maxSpace)return {title:'Dükkâna sığmıyoruz',text:'Kafeyi büyüt, yeni oturma alanına bir masa ekle.',target:TABLES[this.b.level.table],panel:'upgrade'};
    if(this.b.menu!==this.def.preference)return {title:'Semtin damak tadını keşfet',text:this.def.insight,target:POINTS.machine,panel:'menu'};
    if(this.s.active===2&&this.b.level.quality<2)return {title:'Sahilde özenli bir mola',text:'Çekirdek kalitesini artır. Sahil misafirleri özeni puanlarına yansıtır.',target:POINTS.machine,panel:'upgrade'};
    if(Object.keys(this.s.branches).length<BRANCHES.length)return {title:'Bir kafeden bir kahve zincirine',text:'Darboğazı çöz, yeni semtte kendi molanı aç.',target:POINTS.entry,panel:'branches'};
    if(!this.chainComplete)return {title:'Her şubeyi bir yıldıza dönüştür',text:'Semtin hedeflerini tamamla, kafene kalıcı yıldızlar kazandır.',target:POINTS.entry,panel:'mastery'};
    return {title:'Üç semt, senin kahve zincirin',text:'Her şubenin ritmini bul. Ekibini eğit, misafirlerini mutlu tut.',target:POINTS.entry,panel:'branches'};}
}
