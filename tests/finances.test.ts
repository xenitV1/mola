import {describe,it,expect,vi,beforeEach} from 'vitest';
import {Simulation,actor,newBranch,type Customer} from '../src/game/sim';
import {ROLES} from '../src/game/config';
import {advanceFinances,financeSummary,freshFinances,monthlyPayroll,monthlyRoleWage,payFinanceDebt,recordFinanceSale,validFinances,FINANCE_MONTH_SECONDS} from '../src/game/finances';
import {validateSave,persist,load,SAVE_KEY} from '../src/game/save';
import {creditLifetimeBonus} from '../src/game/monetization';
import {nextAction} from '../src/game/guide';
import {financesPanel} from '../src/ui/finances';
import {setLocale} from '../src/game/i18n';
vi.stubGlobal('document',{documentElement:{lang:'en'}});
beforeEach(()=>setLocale('en'));
const storage=()=>{const values=new Map<string,string>();return {getItem:(k:string)=>values.get(k)??null,setItem:(k:string,v:string)=>{values.set(k,v)},removeItem:(k:string)=>{values.delete(k)}}};
function staffed(){const g=new Simulation();g.s.coins=10000;g.upgrade('table');for(const role of ROLES)g.hire(role);g.s.player=actor({x:0,z:5.8});return g;}
function realOrder(g:Simulation){
 const customer:Customer={...actor(g.seatPoint(0)),id:400,kind:'espresso',state:'waiting',seat:0,patience:40,maxPatience:40,timer:0,paid:false,tint:0};
 g.b.customers=[customer];g.s.player=actor(g.servicePoint(0));g.s.player.cups=[{kind:'espresso',quality:0,born:g.b.time}];g.step(.1);return customer;
}
describe('monthly café wages and sales tax',()=>{
 it('charges actual order revenue exactly once and excludes ads, stars and purchase gifts',()=>{
  const g=new Simulation(),order=realOrder(g);expect(order.paid).toBe(true);expect(g.s.finances!.sales).toBe(order.action);const sales=order.action;
  for(let i=0;i<100;i++)g.step(.1);expect(g.s.finances!.sales).toBe(sales);
  expect(g.reward('test-coins','coins')).toBe(true);expect(creditLifetimeBonus(g,true,'lifetime_no_ads:'+'a'.repeat(64),()=>true)).toBe('credited');
  g.b.served=40;g.b.level.table=2;for(const role of ['barista','waiter','supplier'] as const)g.hire(role);expect(g.claimMastery()).toBe(true);
  expect(g.acceptContract('espresso')).toBe(true);g.b.special!.status='ready';g.b.special!.fulfilled=g.b.special!.target;expect(g.claimContract()).toBe(true);
  expect(g.s.finances!.sales).toBe(sales);expect(financeSummary(g.s).taxDue).toBe(Math.ceil(sales*.08));
 });
 it('counts every person and prorates hires and training in all owned cafés',()=>{
  const g=new Simulation();g.s.coins=10000;g.hire('waiter');expect(monthlyRoleWage('waiter',0)).toBe(0);expect(monthlyRoleWage('waiter',3)).toBe(300);
  advanceFinances(g.s,600);expect(g.s.finances!.wagesAccrued).toBeCloseTo(100);
  g.hire('waiter');g.hireMore('waiter');g.s.branches[1]=newBranch();g.s.active=1;g.hire('barista');
  expect(monthlyPayroll(g.s)).toBe(680);const before=g.s.coins;
  const last=advanceFinances(g.s,600);expect(last).toMatchObject({month:1,wages:440,tax:0,paid:440,debt:0});expect(g.s.coins).toBe(before-440);expect(g.s.finances!.month).toBe(2);
 });
 it('settles a fractional monthly accrual once, including after saving near the boundary',()=>{
  const g=staffed(),store=storage();recordFinanceSale(g.s,1000);advanceFinances(g.s,1199.9);expect(g.s.finances!.month).toBe(1);expect(persist(g.s,store)).toBe(true);
  const restored=new Simulation(load(store).save),before=restored.s.coins;restored.events=[];restored.step(.1);
  expect(restored.s.finances!.lastSettlement).toMatchObject({month:1,sales:1000,wages:760,tax:80,due:840,paid:840,debt:0});expect(restored.s.coins).toBe(before-840);
  expect(restored.events.filter(e=>e.type==='finance')).toHaveLength(1);expect(restored.events.find(e=>e.type==='finance')?.value).toBe(-840);
  const after=restored.s.coins;expect(persist(restored.s,store)).toBe(true);const again=new Simulation(load(store).save);again.step(.1);expect(again.s.finances!.month).toBe(2);expect(again.s.coins).toBe(after);expect(again.events.filter(e=>e.type==='finance')).toHaveLength(0);
 });
 it('carries unpaid bills without negative gold, interest or removing staff, and permits partial repayment',()=>{
  const g=new Simulation();g.s.coins=1000;g.hire('barista');const staff=structuredClone(g.b.staff);g.s.coins=50;recordFinanceSale(g.s,1000);
  expect(advanceFinances(g.s,1200)).toMatchObject({wages:180,tax:80,due:260,paid:50,debt:210});expect(g.s.coins).toBe(0);expect(g.b.staff).toEqual(staff);
  const stillUnpaid=new Simulation(structuredClone(g.s));expect(advanceFinances(stillUnpaid.s,1200)).toMatchObject({carriedDebt:210,wages:180,tax:0,due:390,paid:0,debt:390});expect(stillUnpaid.b.staff).toEqual(staff);
  expect(payFinanceDebt(g.s)).toBe(0);g.s.coins=75;expect(payFinanceDebt(g.s)).toBe(75);expect(g.s.finances!.debt).toBe(135);expect(g.s.coins).toBe(0);
  const order=realOrder(g);expect(order.paid).toBe(true);expect(g.s.coins).toBeGreaterThan(0);expect(g.b.staff).toEqual(staff);
  const remaining=g.s.finances!.debt;g.s.coins=500;expect(payFinanceDebt(g.s)).toBe(remaining);expect(g.s.finances!.debt).toBe(0);expect(payFinanceDebt(g.s)).toBe(0);
 });
 it('does not count absent time as months or wages, but taxes actual offline sales once',()=>{
  const g=staffed();g.s.savedAt=1000;advanceFinances(g.s,300);const prior=structuredClone(g.s.finances!),earned=g.b.earned;
  const report=g.offline(14401000,true);expect(report.served).toBeGreaterThan(0);expect(g.s.finances!.sales-prior.sales).toBe(g.b.earned-earned);
  expect(g.s.finances!.month).toBe(prior.month);expect(g.s.finances!.elapsedSeconds).toBe(prior.elapsedSeconds);expect(g.s.finances!.wagesAccrued).toBe(prior.wagesAccrued);
  const after=structuredClone(g.s.finances!);expect(g.offline(14401000,true).amount).toBe(0);expect(g.s.finances).toEqual(after);expect(validateSave(g.s)).toBe(true);
 },10000);
 it('advances the shared month once while more than one café is working',()=>{
  const g=staffed();g.s.branches[1]=newBranch();g.s.active=1;for(const role of ROLES)g.hire(role);const payroll=monthlyPayroll(g.s);
  for(let i=0;i<10;i++)g.step(.1);expect(g.s.finances!.elapsedSeconds).toBeCloseTo(1);expect(g.s.finances!.wagesAccrued).toBeCloseTo(payroll/1200);expect(g.s.finances!.month).toBe(1);
 });
 it('starts legacy saves at month one without backdated wages or tax on historical earned totals',()=>{
  const g=staffed();g.b.earned=50000;g.b.time=100000;g.s.savedAt=1;delete g.s.finances;const store=storage();expect(validateSave(g.s)).toBe(true);expect(persist(g.s,store)).toBe(true);
  const restored=new Simulation(load(store).save);expect(restored.s.finances).toEqual(freshFinances());expect(restored.s.coins).toBe(g.s.coins);
 });
 it('rejects corrupt finance values and recovers a valid previous save',()=>{
  const g=new Simulation(),store=storage();expect(persist(g.s,store)).toBe(true);advanceFinances(g.s,300);expect(persist(g.s,store)).toBe(true);
  for(const patch of [{month:0},{elapsedSeconds:1200},{wagesAccrued:-1},{sales:NaN},{debt:-2},{debt:.5},{lastSettlement:{month:0,wages:0,tax:0,paid:0,debt:0}}])expect(validFinances({...freshFinances(),...patch})).toBe(false);
  const corrupt=structuredClone(g.s);corrupt.finances!.debt=-1;store.setItem(SAVE_KEY,JSON.stringify(corrupt));expect(load(store).status).toBe('recovered');
 });
 it('shows truthful EN/TR accrued expenses, losses, repayment and previous settlement',()=>{
  const g=new Simulation();g.s.coins=0;g.s.finances={month:2,elapsedSeconds:600,wagesAccrued:100,sales:20,debt:50,lastSettlement:{month:1,sales:100,wages:60,tax:8,carriedDebt:0,due:68,paid:18,debt:50}};
  const en=financesPanel(g.s);expect(en).toContain('Business month 2');expect(en).toContain('Sales tax · 8%');expect(en).toContain('data-negative="true"');expect(en).toContain('data-finance-pay-debt disabled');expect(en).toContain('−82');
  setLocale('tr');const tr=financesPanel(g.s);expect(tr).toContain('İşletme ayı 2');expect(tr).toContain('Satış vergisi · %8');expect(tr).toContain('faizsiz borç');expect(tr).toContain('Son ay sonu hesabı');
 });
 it('pays the first real month from no-ad café sales without creating a debt trap',()=>{
  const g=new Simulation();
  for(let frame=0;frame<FINANCE_MONTH_SECONDS*10;frame++){
   if(frame%2===0){
    if(g.b.mastery===0&&g.mastery()[0].ready)g.claimMastery();
    const action=nextAction(g);if(!action.waiting){if(action.buy)g.upgrade(action.buy);else if(action.hire)g.hire(action.hire);else if(action.target)g.go(action.target);}
   }
   g.step(.1);
  }
  const last=g.s.finances!.lastSettlement!;expect(last).toBeTruthy();expect(last.month).toBe(1);expect(last.sales).toBeGreaterThan(last.wages+last.tax);expect(last.paid).toBe(last.due);expect(last.debt).toBe(0);
  expect(g.s.coins).toBeGreaterThan(400);expect(g.s.rewardIds).toEqual([]);expect(g.b.mastery).toBe(1);expect(ROLES.every(role=>g.b.staff[role]===1)).toBe(true);expect(validateSave(g.s)).toBe(true);
 },20000);
});
