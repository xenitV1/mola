import {validFinances} from './finances';
import {DIRT_LIMITS,dirtSeconds,type DirtPatch} from './cleanliness';
import {DIAMOND_GRANT_ID,DIAMOND_MAX_BALANCE,DIAMOND_MAX_GRANTS} from './diamonds';
import {TABLE_TYPES,tableOfSeat,localSeat} from './table-layout';
import {PRICING,freshPrices} from './pricing';
import {freshVenue,staffLimit} from './venue';
import {PERSONAS,REASONS} from './guests';
import {freshOperations} from './operations-state';
import {freshSave,type Save,type Actor} from './sim';
import {DECOR,legacyDecoration} from './decor';
import {ROLES,INGREDIENTS,BRANCHES, MENU, TUNING, UPGRADES, MAX_CAFE_CUSTOMERS} from './config';
export const SAVE_KEY='minik-mola.save.v1', BACKUP_KEY=SAVE_KEY+'.backup';
const finite=(v:unknown,min=0,max=1e10)=>typeof v==='number'&&Number.isFinite(v)&&v>=min&&v<=max;
const object=(v:unknown):v is Record<string,any>=>!!v&&typeof v==='object'&&!Array.isArray(v);
const cup=(c:any)=>object(c)&&typeof c.kind==='string'&&Object.hasOwn(MENU,c.kind)&&finite(c.quality,0,3)&&finite(c.born);
const actorValid=(a:Actor)=>object(a)&&finite(a.x,-20,20)&&finite(a.z,-20,20)&&finite(a.angle,-100,100)&&finite(a.beans,0,400)&&finite(a.action)&&Array.isArray(a.path)&&a.path.length<1000&&a.path.every(v=>object(v)&&finite(v.x,-20,20)&&finite(v.z,-20,20))&&Array.isArray(a.cups)&&a.cups.length<=8&&a.cups.every(cup)&&typeof a.moving==='boolean'&&(a.task===undefined||typeof a.task==='string'&&a.task.length<50)&&(a.cargo===undefined||object(a.cargo)&&Object.entries(a.cargo).every(([k,n])=>Object.hasOwn(INGREDIENTS,k)&&finite(n,0,100)));
const reviewValid=(r:any)=>object(r)&&Number.isInteger(r.id)&&finite(r.id,1)&&Object.hasOwn(PERSONAS,r.persona)&&Number.isInteger(r.score)&&finite(r.score,1,5)&&finite(r.time)&&Array.isArray(r.reasons)&&r.reasons.length<=3&&r.reasons.every((k:string)=>Object.hasOwn(REASONS,k));
export function validateSave(v:unknown):v is Save{
 if(object(v)&&v.finances!==undefined&&!validFinances(v.finances))return false;
 if(object(v)&&v.energySeconds!==undefined&&!finite(v.energySeconds,0,120))return false;
 if(object(v)&&v.diamonds!==undefined){const d=v.diamonds;if(!object(d)||!Number.isInteger(d.balance)||!finite(d.balance,0,DIAMOND_MAX_BALANCE)||!Array.isArray(d.grants)||d.grants.length>DIAMOND_MAX_GRANTS||!d.grants.every((id:unknown)=>typeof id==='string'&&DIAMOND_GRANT_ID.test(id))||new Set(d.grants).size!==d.grants.length)return false;}
 if(!object(v)||v.version!==7||!finite(v.coins,0,TUNING.maxMoney)||!Number.isInteger(v.active)||!BRANCHES[v.active]||!object(v.branches)||!v.branches[v.active]||!actorValid(v.player)||!finite(v.seed,0,4294967295)||!finite(v.savedAt,0,1e15)||!finite(v.totalServed)||!Number.isInteger(v.milestone)||!finite(v.milestone,0,7)||!finite(v.boostSeconds)||!object(v.settings)||!['en','tr'].includes(v.settings.locale)||!['sound','music','motion','assist','helpSeen'].every(k=>typeof v.settings[k]==='boolean')||!Array.isArray(v.rewardIds)||v.rewardIds.length>100||!v.rewardIds.every((s:unknown)=>typeof s==='string'&&s.length<200))return false;
 if(v.monetization!==undefined&&(!object(v.monetization)||!Array.isArray(v.monetization.bonusGrants)||v.monetization.bonusGrants.length>20||!v.monetization.bonusGrants.every((id:any)=>typeof id==='string'&&id.length<=100)||!object(v.monetization.rewardReadyAt)||!Object.entries(v.monetization.rewardReadyAt).every(([key,n])=>['coins','tips','stock'].includes(key)&&finite(n,0,1e15))))return false;
 for(const [i,b] of Object.entries(v.branches)){if(String(Number(i))!==i||!BRANCHES[Number(i)]||!object(b)||!object(b.level)||!object(b.staff)||!object(b.workers)||!object(b.cash)||!object(b.losses)||!Object.entries(b.cash).every(([key,n])=>String(Number(key))===key&&Number.isInteger(Number(key))&&Number(key)>=0&&Number(key)<b.level.table&&finite(n))||!['seat','service','stock'].every(key=>finite(b.losses[key])))return false;
 if(b.cleanliness!==undefined){const d=b.cleanliness;if(!object(d)||!Array.isArray(d.patches)||d.patches.length>20||!Number.isInteger(d.serial)||!finite(d.serial)||!Number.isInteger(d.cleaned)||!finite(d.cleaned)||!finite(d.floorTravel,0,67)||!finite(d.frontTravel,0,92)||new Set(d.patches.map((p:any)=>p?.id)).size!==d.patches.length||!d.patches.every((p:any)=>object(p)&&Number.isInteger(p.id)&&finite(p.id,1,d.serial)&&finite(p.x,-3.65,9.85)&&finite(p.z,-4.4,14.6)&&['floor','front'].includes(p.zone)&&['spill','litter'].includes(p.kind)&&finite(p.work,0,dirtSeconds(p as DirtPatch)))||(['floor','front'] as const).some(zone=>d.patches.filter((p:any)=>p.zone===zone).length>DIRT_LIMITS[zone]))return false;}
 if(!Array.isArray(b.tableLevels)||b.tableLevels.length!==6||!b.tableLevels.every((l:any,j:number)=>Number.isInteger(l)&&l>=0&&l<=3&&(j<b.level.table?b.level.space>=TABLE_TYPES[l].space:l===0))||!object(b.priceModes)||!Object.keys(MENU).every(k=>Object.hasOwn(PRICING,b.priceModes[k])))return false;
 if(!object(b.decor)||!Array.isArray(b.decor.owned)||b.decor.owned.length>Object.keys(DECOR).length||new Set(b.decor.owned).size!==b.decor.owned.length||!b.decor.owned.every((id:unknown)=>typeof id==='string'&&Object.hasOwn(DECOR,id))||!['floor','furniture','plants'].every(slot=>typeof b.decor[slot]==='string'&&Object.hasOwn(DECOR,b.decor[slot])&&DECOR[b.decor[slot] as keyof typeof DECOR].slot===slot&&b.decor.owned.includes(b.decor[slot])))return false;
 if(!object(b.takeaway)||typeof b.takeaway.owned!=='boolean'||typeof b.takeaway.open!=='boolean'||b.takeaway.open&&!b.takeaway.owned||!b.takeaway.owned&&(b.takeaway.cash>0||b.takeaway.served>0)||!finite(b.takeaway.cash)||!finite(b.takeaway.served)||Number(i)!==1&&(b.takeaway.owned||b.takeaway.open||b.takeaway.cash>0||b.takeaway.served>0))return false;
 if(!Array.isArray(b.helpers)||b.helpers.length>ROLES.reduce((n,role)=>n+staffLimit(role)-1,0)||!b.helpers.every((h:any)=>object(h)&&(ROLES as string[]).includes(h.role)&&b.staff[h.role]>0&&actorValid(h.actor))||!ROLES.every(role=>b.helpers.filter((h:any)=>h.role===role).length<staffLimit(role)))return false;
 if(!Number.isInteger(b.guestSerial)||!finite(b.guestSerial)||!['off','playlist','live'].includes(b.musicMode)||b.musicMode==='playlist'&&!b.level.speakers||b.musicMode==='live'&&!b.level.stage||!Number.isInteger(b.volume)||!finite(b.volume,0,3)||!finite(b.noiseConcern,0,100)||!finite(b.warningSeconds,0,30)||!finite(b.patrolSeconds,0,18)||!finite(b.fineCooldown,0,90)||!Number.isInteger(b.fineCount)||!finite(b.fineCount)||!finite(b.lastFine,0,200)||!finite(b.totalFines)||!Number.isInteger(b.reviewCount)||!finite(b.reviewCount)||!Array.isArray(b.reviews)||b.reviews.length>12||!b.reviews.every(reviewValid))return false;
 if(!Number.isInteger(b.contractSerial)||!finite(b.contractSerial)||!Number.isInteger(b.contractsCompleted)||!finite(b.contractsCompleted)||typeof b.priority!=='boolean')return false;
 if(b.special!==null&&(!object(b.special)||!Number.isInteger(b.special.id)||!finite(b.special.id,1,b.contractSerial)||!Object.hasOwn(MENU,b.special.kind)||!b.catalog?.[b.special.kind]||!finite(b.special.target,1,20)||!finite(b.special.fulfilled,0,b.special.target)||!finite(b.special.seconds,0,1000)||!finite(b.special.reward,0,10000)||!['active','ready','failed'].includes(b.special.status)))return false;
 if(!object(b.catalog)||!Object.keys(MENU).every(k=>Number.isInteger(b.catalog[k])&&finite(b.catalog[k],0,3))||!Array.isArray(b.offered)||b.offered.length<1||b.offered.length>7||new Set(b.offered).size!==b.offered.length||!b.offered.every((k:string)=>Object.hasOwn(MENU,k)&&b.catalog[k]>0))return false;
 if(!object(b.ingredients)||!['milk','pastry','cold'].every(k=>finite(b.ingredients[k],0,100))||!object(b.depot)||!Object.keys(INGREDIENTS).every(k=>finite(b.depot[k],0,200))||!finite(b.deliveryIn,0,60)||!finite(b.cleanDishes,0,1000)||!finite(b.dirtyDishes,0,1000)||!object(b.dirtyTables)||!Object.entries(b.dirtyTables).every(([k,n])=>Number.isInteger(Number(k))&&Number(k)>=0&&Number(k)<b.level.table&&finite(n,1,100)))return false;
 if(!Number.isInteger(b.mastery)||b.mastery<0||b.mastery>3||!finite(b.signatureServed)||!['balanced','cash'].includes(b.servicePolicy))return false;
 for(const [k,u] of Object.entries(UPGRADES)){if(!Number.isInteger(b.level[k])||b.level[k]<(k==='table'||k==='machine'?1:k==='tray'?2:0)||b.level[k]>u.max)return false;}
 if(b.level.space>2||b.level.table>Math.min(2+b.level.space*2,BRANCHES[Number(i)].seats/2))return false;
 if(!ROLES.every(k=>Number.isInteger(b.staff[k])&&b.staff[k]>=0&&b.staff[k]<=3&&(!b.staff[k]||actorValid(b.workers[k]))))return false;
 if(!Object.entries(b.workers).every(([role,a])=>(ROLES as string[]).includes(role)&&b.staff[role]>0&&actorValid(a as Actor)))return false;
 if(typeof b.menu!=='string'||!Object.hasOwn(MENU,b.menu)||typeof b.brewing!=='string'||!Object.hasOwn(MENU,b.brewing)||!finite(b.stock,0,100)||!finite(b.rating,1,5)||!finite(b.prep,1,5)||!finite(b.brew)||!finite(b.time)||!finite(b.spawn,-1,100)||!['served','lost','waste','earned','theme'].every(k=>finite(b[k]))||!Array.isArray(b.ready)||b.ready.length>20||!b.ready.every(cup)||!Array.isArray(b.customers)||b.customers.length>MAX_CAFE_CUSTOMERS)return false;
 if(!b.customers.every((c:any)=>actorValid(c)&&Number.isInteger(c.id)&&finite(c.id,1)&&Number.isInteger(c.seat)&&c.seat>=-1&&(c.seat===-1||tableOfSeat(c.seat)<b.level.table&&localSeat(c.seat)<TABLE_TYPES[b.tableLevels[tableOfSeat(c.seat)]]?.seats)&&['queue','walking','sitting','waiting','drinking','standing','leaving','pickup-walking','pickup-waiting','pickup-done'].includes(c.state)&&typeof c.kind==='string'&&Object.hasOwn(MENU,c.kind)&&finite(c.patience,-1,1000)&&finite(c.maxPatience,1,1000)&&finite(c.timer,-1,1000)&&typeof c.paid==='boolean'&&finite(c.tint,0,5)))return false;
 const occupied=new Set<number>(),ids=new Set<number>();
 let pickupCount=0;for(const c of b.customers){if(c.seatComfort!==undefined&&!finite(c.seatComfort,0,6))return false;if(c.quotedPrice!==undefined&&!finite(c.quotedPrice,1,10000))return false;if(c.seatAngle!==undefined&&!finite(c.seatAngle,-Math.PI,Math.PI))return false;if(c.persona!==undefined&&!Object.hasOwn(PERSONAS,c.persona))return false;if(c.review!==undefined&&(!reviewValid(c.review)||c.review.id!==c.id))return false;if(c.visit!==undefined&&(!object(c.visit)||c.visit.comfort!==undefined&&!finite(c.visit.comfort)||!['seconds','dirty','crowding','noise','music','waitFraction','freshness','quality'].every(k=>finite(c.visit[k]))||c.visit.waitFraction>1||c.visit.freshness>1||c.visit.quality>3))return false;if(c.specialId!==undefined&&(!Number.isInteger(c.specialId)||!finite(c.specialId,1,b.contractSerial)))return false;if(c.takeaway!==undefined&&typeof c.takeaway!=='boolean')return false;if(c.takeaway&&(Number(i)!==1||!b.takeaway.owned||!['queue','pickup-walking','pickup-waiting','pickup-done','leaving'].includes(c.state)||c.seat!==-1))return false;if(c.state.startsWith('pickup-')&&(!c.takeaway||++pickupCount>1))return false;if(c.state==='pickup-done'&&!c.paid)return false;if(ids.has(c.id))return false;ids.add(c.id);if(c.state==='queue'&&c.seat!==-1)return false;if(!['queue','leaving','pickup-walking','pickup-waiting','pickup-done'].includes(c.state)&&c.seat<0)return false;if(!['drinking','standing','leaving','pickup-done'].includes(c.state)&&c.paid)return false;if(c.state!=='leaving'&&c.seat>=0){if(occupied.has(c.seat))return false;occupied.add(c.seat);}}
 }return true;
}
// Keep the storage key stable; the version in its payload drives migration.
export function migrateSave(value:unknown):unknown{
 if(!object(value)||![1,2,3,4,5,6,7].includes(value.version)||!object(value.branches))return value;
 if(value.version===7)return value;
 const migrated=structuredClone(value);
 if(migrated.version===1){migrated.version=2;migrated.boostSeconds=migrated.boostUntil;delete migrated.boostUntil;
  for(const branch of Object.values(migrated.branches)){if(!object(branch))return value;branch.mastery=0;branch.signatureServed=0;branch.servicePolicy='balanced';}
 }
 for(const [index,branch] of Object.entries(migrated.branches)){
  if(!object(branch)||!object(branch.level)||!BRANCHES[Number(index)])return value;
  if(migrated.version<3){branch.level.space=Math.max(0,Math.min(BRANCHES[Number(index)].seats/2-2,branch.level.table-2));branch.decor=legacyDecoration();}
  if(migrated.version<4)branch.takeaway={owned:false,open:false,cash:0,served:0};
  if(migrated.version<5){Object.assign(branch,freshOperations());branch.level.storage=0;branch.level.wash=0;if(object(branch.staff)){branch.staff.cleaner=0;branch.staff.dishwasher=0;}}if(migrated.version<6){Object.assign(branch,freshVenue());branch.helpers=[];branch.level.speakers=0;branch.level.stage=0;branch.level.soundproof=0;}
  branch.tableLevels=Array(6).fill(0);branch.priceModes=freshPrices();
  if(Array.isArray(branch.customers))for(const c of branch.customers)if(object(c)&&Object.hasOwn(MENU,c.kind)&&['waiting','drinking','standing','pickup-waiting','pickup-done'].includes(c.state)){const kind=c.kind as keyof typeof MENU;c.quotedPrice=Math.round(MENU[kind].price*(1+Math.max(0,(branch.catalog?.[kind]??1)-1)*.1));}
 }
 if(migrated.version<6&&object(migrated.settings))migrated.settings.helpSeen=false;migrated.version=7;if(object(migrated.settings)&&!Object.hasOwn(migrated.settings,'music'))migrated.settings.music=migrated.settings.sound===true;return migrated;
}
export type StorageLike=Pick<Storage,'getItem'|'setItem'|'removeItem'>;
export function load(storage:StorageLike):{save:Save;status:'new'|'ok'|'recovered'|'corrupt'|'unavailable'}{
 try{
  const raw=storage.getItem(SAVE_KEY),backup=storage.getItem(BACKUP_KEY);
  if(!raw&&!backup)return {save:freshSave(),status:'new'};
  const archive=(key:string,text:string|null)=>{if(text)try{storage.setItem(key+'.corrupt',text);}catch{/* A full device must not prevent recovery of readable data. */}};
  for(const [key,text] of [[SAVE_KEY,raw],[BACKUP_KEY,backup]] as const){
   try{if(!text||text.length>1_000_000)continue;const parsed=migrateSave(JSON.parse(text));if(validateSave(parsed)){if(key===BACKUP_KEY)archive(SAVE_KEY,raw);return {save:parsed,status:key===SAVE_KEY?'ok':'recovered'};}}catch{/* Try the known-good backup. */}
  }
  archive(SAVE_KEY,raw);archive(BACKUP_KEY,backup);return {save:freshSave(),status:'corrupt'};
 }catch{return {save:freshSave(),status:'unavailable'};}
}
export function persist(s:Save,storage:StorageLike,now=Date.now()){const snapshot={...s,savedAt:Math.max(s.savedAt,now)};if(!validateSave(snapshot))return false;try{const old=storage.getItem(SAVE_KEY);if(old){try{if(validateSave(migrateSave(JSON.parse(old))))storage.setItem(BACKUP_KEY,old);}catch{ /* Preserve corrupt source separately; do not overwrite a good backup. */ }}storage.setItem(SAVE_KEY,JSON.stringify(snapshot));s.savedAt=snapshot.savedAt;return true;}catch{return false;}}
