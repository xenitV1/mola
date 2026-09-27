import {getLocale,number,t} from '../game/i18n';
import {ROLES,STAFF} from '../game/config';
import {financeSummary,monthlyRoleWage} from '../game/finances';
import type {Save} from '../game/sim';
import './finances.css';

export function financesPanel(save:Pick<Save,'coins'|'branches'|'finances'>){
 const tr=getLocale()==='tr',f=financeSummary(save);
 const copy=tr?{
  month:'İşletme ayı',clock:'Bir oyun ayı 20 dakika aktif oyundur. Menülerde, reklamlarda ve uygulama kapalıyken ay ilerlemez.',
  left:'Ay sonuna',sales:'Bu ayki satışlar',wages:'Biriken maaşlar',tax:'Satış vergisi · %8',net:'Bu ayın işletme sonucu',due:'Şu ana kadar toplam yükümlülük',debt:'Önceki aydan kalan borç',
  payroll:'Ekibin aylık maaşları',rate:'Mevcut ekip aynı şekilde tam ay çalışırsa',people:'kişi',level:'Tüm şubeler · eğitim ve ilave çalışanlar dahil',empty:'Henüz çalışan maaşı yok.',
  rules:'Maaşlar çalışılan aktif süreye göre birikir. Vergi yalnız gerçek kafe satışlarından hesaplanır; yıldız, reklam, özel sipariş bonusu ve satın alma hediyeleri vergilendirilmez.',
  offline:'Çevrimdışı çalışma ayı veya maaşı ilerletmez. Çevrimdışı gerçekleşen satışların vergisi sonraki ay sonu hesabına eklenir.',
  settle:'Ay sonunda mevcut altından ödeme alınır. Yetmeyen tutar faizsiz borç olarak taşınır; çalışanların ve geliştirmelerin korunur.',
  pay:'Önceki borcu öde',payPart:'Mevcut altınla kısmen öde',last:'Son ay sonu hesabı',paid:'Ödenen',carried:'Önceki borç',remaining:'Kalan borç',back:'Kafeme dön',gold:'altın',minute:'dk',second:'sn',
 }:{
  month:'Business month',clock:'One game month is 20 minutes of active play. Menus, ads and time away do not advance the month.',
  left:'Until month end',sales:'Sales this month',wages:'Wages accrued',tax:'Sales tax · 8%',net:'Operating result this month',due:'Total accrued obligations',debt:'Debt from a previous month',
  payroll:'Monthly team wages',rate:'If the current team works a full month',people:'people',level:'All cafés · training and extra staff included',empty:'No staff wages yet.',
  rules:'Wages accrue in proportion to active time worked. Tax applies only to actual café sales; stars, ads, special-order bonuses and purchase gifts are excluded.',
  offline:'Offline work does not advance the month or wages. Tax on actual offline sales joins the next month-end bill.',
  settle:'At month end, payment uses your available gold. Any unpaid amount carries forward without interest; you keep your staff and upgrades.',
  pay:'Pay previous debt',payPart:'Pay what I can now',last:'Last month-end account',paid:'Paid',carried:'Previous debt',remaining:'Debt remaining',back:'Back to my café',gold:'gold',minute:'min',second:'sec',
 };
 const amount=(n:number)=>`${n<0?'−':''}${number(Math.abs(n))}`;
 const row=(label:string,n:number)=>`<div class="finance-row"><span>${label}</span><b>${amount(n)}</b></div>`;
 const seconds=Math.ceil(f.remainingSeconds),time=`${Math.floor(seconds/60)} ${copy.minute} ${seconds%60} ${copy.second}`;
 const payroll=ROLES.map(role=>{
  let count=0,wage=0;for(const branch of Object.values(save.branches)){if(!branch.staff[role])continue;const people=1+branch.helpers.filter(helper=>helper.role===role).length;count+=people;wage+=monthlyRoleWage(role,branch.staff[role])*people;}
  return count?row(`${t(STAFF[role].name)} · ${count} ${copy.people}`,wage):'';
 }).join('');
 const last=f.lastSettlement;
 return `<div class="finance-month"><strong>${copy.month} ${number(f.month)}</strong><span>${copy.left} · ${time}</span><progress max="1200" value="${f.elapsedSeconds}" aria-label="${copy.month} ${number(f.month)}"></progress></div><p class="sheet-intro">${copy.clock}</p><div class="finance-ledger">${row(copy.sales,f.sales)}${row(copy.wages,f.wagesDue)}${row(copy.tax,f.taxDue)}<div class="finance-row finance-net" data-negative="${f.netIncome<0}"><span>${copy.net}</span><b>${amount(f.netIncome)}</b></div>${f.debt>0?row(copy.debt,f.debt):''}<div class="finance-row finance-total"><span>${copy.due}</span><b>${amount(f.totalDue)} ${copy.gold}</b></div></div><p class="sheet-intro">${copy.rules}</p><section class="finance-payroll"><h3>${copy.payroll}</h3><p>${copy.level}</p>${payroll||`<p>${copy.empty}</p>`}${row(copy.rate,f.monthlyPayroll)}</section><p class="sheet-intro">${copy.offline}</p><p class="sheet-intro">${copy.settle}</p>${f.debt>0?`<button class="primary" data-finance-pay-debt ${Math.floor(save.coins)<1?'disabled':''}>${save.coins>=f.debt?copy.pay:copy.payPart} · ${number(Math.min(Math.floor(save.coins),f.debt))} ${copy.gold}</button>`:''}${last?`<section class="finance-last"><h3>${copy.last} · ${number(last.month)}</h3>${row(copy.sales,last.sales)}${row(copy.wages,last.wages)}${row(copy.tax,last.tax)}${last.carriedDebt?row(copy.carried,last.carriedDebt):''}${row(copy.paid,last.paid)}${row(copy.remaining,last.debt)}</section>`:''}<button class="link-button" data-close>${copy.back}</button>`;
}
