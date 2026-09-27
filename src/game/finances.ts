import {ROLES,type Role} from './config';
import type {Save} from './sim';

export const FINANCE_MONTH_SECONDS=20*60;
export const SALES_TAX_RATE=.08;
export const MONTHLY_WAGES:Record<Role,number>={barista:180,waiter:200,supplier:120,cleaner:120,dishwasher:140};
export type FinanceSettlement={month:number;sales:number;wages:number;tax:number;carriedDebt:number;due:number;paid:number;debt:number};
export type Finances={month:number;elapsedSeconds:number;wagesAccrued:number;sales:number;debt:number;lastSettlement?:FinanceSettlement};
type FinanceSave=Pick<Save,'coins'|'branches'|'finances'>;
export const freshFinances=():Finances=>({month:1,elapsedSeconds:0,wagesAccrued:0,sales:0,debt:0});
const ceilGold=(amount:number)=>Math.max(0,Math.ceil(amount-1e-7));
const state=(save:FinanceSave)=>save.finances??=freshFinances();

export function monthlyRoleWage(role:Role,level:number){return level>0?MONTHLY_WAGES[role]*(1+(Math.min(3,level)-1)*.25):0;}

/** Every hired person is paid, including helpers and staff in other branches.
 * Training follows the lead role's level, just as the physical helpers do. */
export function monthlyPayroll(save:Pick<Save,'branches'>){
 return Object.values(save.branches).reduce((sum,branch)=>sum+ROLES.reduce((total,role)=>{
  const level=branch.staff[role];if(!level)return total;
  const people=1+branch.helpers.filter(helper=>helper.role===role).length;
  return total+monthlyRoleWage(role,level)*people;
 },0),0);
}
/** Called only when an actual order is credited. Gifts and grants do not call it. */
export function recordFinanceSale(save:FinanceSave,amount:number){
 if(Number.isSafeInteger(amount)&&amount>0)state(save).sales+=amount;
}
export function financeSummary(save:FinanceSave){
 const f=save.finances??freshFinances(),wagesDue=ceilGold(f.wagesAccrued),taxDue=ceilGold(f.sales*SALES_TAX_RATE);
 return {...f,wagesDue,taxDue,totalDue:wagesDue+taxDue+f.debt,netIncome:f.sales-wagesDue-taxDue,remainingSeconds:Math.max(0,FINANCE_MONTH_SECONDS-f.elapsedSeconds),progress:f.elapsedSeconds/FINANCE_MONTH_SECONDS,monthlyPayroll:monthlyPayroll(save)};
}
/** Only Simulation.step supplies active play time. Offline work records sales,
 * but never advances this clock or accrues a real-world absence as wages. */
export function advanceFinances(save:FinanceSave,seconds:number):FinanceSettlement|undefined{
 if(!Number.isFinite(seconds)||seconds<=0)return;
 const f=state(save),payroll=monthlyPayroll(save);let last:FinanceSettlement|undefined;
 while(seconds>1e-8){
  const span=Math.min(seconds,FINANCE_MONTH_SECONDS-f.elapsedSeconds);
  f.elapsedSeconds+=span;f.wagesAccrued+=payroll*span/FINANCE_MONTH_SECONDS;seconds-=span;
  if(f.elapsedSeconds<FINANCE_MONTH_SECONDS-1e-8)break;
  const wages=ceilGold(f.wagesAccrued),tax=ceilGold(f.sales*SALES_TAX_RATE),carriedDebt=f.debt,due=wages+tax+carriedDebt;
  const paid=Math.min(Math.floor(save.coins),due);save.coins-=paid;
  last={month:f.month,sales:f.sales,wages,tax,carriedDebt,due,paid,debt:due-paid};
  f.month++;f.elapsedSeconds=0;f.wagesAccrued=0;f.sales=0;f.debt=last.debt;f.lastSettlement=last;
 }
 return last;
}
/** Voluntary repayment affects only a previous month's unpaid balance. */
export function payFinanceDebt(save:FinanceSave){
 const f=state(save),paid=Math.min(Math.floor(save.coins),f.debt);save.coins-=paid;f.debt-=paid;return paid;
}
export function validFinances(value:unknown):value is Finances{
 const object=(v:unknown):v is Record<string,unknown>=>!!v&&typeof v==='object'&&!Array.isArray(v);
 const amount=(v:unknown)=>typeof v==='number'&&Number.isFinite(v)&&v>=0&&v<=1e12;
 const integer=(v:unknown)=>amount(v)&&Number.isInteger(v);
 if(!object(value)||!integer(value.month)||Number(value.month)<1||!amount(value.elapsedSeconds)||Number(value.elapsedSeconds)>=FINANCE_MONTH_SECONDS||!amount(value.wagesAccrued)||!integer(value.sales)||!integer(value.debt))return false;
 if(value.lastSettlement!==undefined){
  const last=value.lastSettlement;
  if(!object(last)||!['month','sales','wages','tax','carriedDebt','due','paid','debt'].every(key=>integer(last[key]))||last.month!==Number(value.month)-1||Number(last.month)<1||last.due!==Number(last.wages)+Number(last.tax)+Number(last.carriedDebt)||last.debt!==Number(last.due)-Number(last.paid))return false;
 }
 return true;
}
