import {it,expect} from 'vitest';
import {Simulation,actor,newBranch,type Customer} from '../src/game/sim';
import {ROLES} from '../src/game/config';
import {contractOffers} from '../src/game/contracts';
import {validateSave} from '../src/game/save';
const advance=(g:Simulation,n:number)=>{for(let i=0;i<n*10;i++)g.step(.1);};
it('offers distinct optional goals and accepts only one unlocked order at a time',()=>{
 const g=new Simulation();expect(contractOffers(g).map(o=>o.kind)).toEqual(['espresso','cake']);expect(g.acceptContract('espresso')).toBe(false);g.s.coins=5000;g.hire('waiter');const coins=g.s.coins;expect(g.acceptContract('iced')).toBe(false);expect(g.acceptContract('cake')).toBe(true);expect(g.acceptContract('espresso')).toBe(false);expect(g.s.coins).toBe(coins);expect(validateSave(g.s)).toBe(true);
});
it('counts only delivered designated orders and credits the bonus once',()=>{
 const g=new Simulation();g.s.coins=5000;g.hire('waiter');g.acceptContract('espresso');g.b.special!.target=1;g.b.spawn=100;g.s.player=actor(g.servicePoint(0));const c:Customer={...actor(g.seatPoint(0)),id:99,seat:0,state:'waiting',kind:'espresso',patience:120,maxPatience:120,timer:0,paid:false,tint:0,specialId:g.b.special!.id};g.b.customers=[c];g.s.player.cups=[{kind:'espresso',born:0,quality:0}];const reward=g.b.special!.reward;advance(g,.1);expect(g.b.special!.status).toBe('ready');const coins=g.s.coins;expect(g.claimContract()).toBe(true);expect(g.s.coins).toBe(coins+reward);expect(g.claimContract()).toBe(false);expect(g.b.contractsCompleted).toBe(1);expect(validateSave(g.s)).toBe(true);
});
it('an expired optional order preserves normal earnings and permits a new choice',()=>{
 const g=new Simulation();g.s.coins=5000;g.hire('waiter');g.acceptContract('espresso');g.b.special!.seconds=.1;const coins=g.s.coins;advance(g,.1);expect(g.b.special!.status).toBe('failed');expect(g.s.coins).toBe(coins);expect(g.claimContract()).toBe(false);expect(g.acceptContract('cake')).toBe(true);
});
it('completes a real marked-customer batch through staffed production and service',()=>{
 const g=new Simulation();g.s.coins=100000;g.upgrade('table');for(const role of ROLES)g.hire(role);g.b.level.machine=2;g.b.prep=2;g.s.totalServed=10;g.s.player=actor({x:0,z:3});g.acceptContract('espresso');g.b.priority=true;advance(g,120);expect(g.b.special!.status).toBe('ready');expect(g.b.special!.fulfilled).toBe(g.b.special!.target);expect(g.b.served).toBeGreaterThanOrEqual(g.b.special!.target);expect(validateSave(g.s)).toBe(true);
});

it('keeps the promised recipe available during an active order and releases it after expiry',()=>{
 const g=new Simulation();g.s.coins=5000;g.hire('waiter');g.acceptContract('espresso');
 expect(g.toggleRecipe('espresso')).toBe(false);g.setMenu('latte');expect(g.b.offered).toContain('espresso');
 expect(g.toggleRecipe('cake')).toBe(true);g.b.special!.seconds=.1;g.step(.1);
 expect(g.toggleRecipe('espresso')).toBe(true);expect(g.b.offered).toEqual(['latte']);
});

it('makes later rush orders depend on menu and capacity allocation while retaining a forgiving choice in every neighbourhood',()=>{
 for(const completed of [1,7])for(const index of [0,1,2])for(const seed of [431,2026,18]){
  const shift=(focused:boolean)=>{const g=new Simulation();g.s.seed=seed;g.s.active=index;g.s.branches[index]=newBranch();g.s.coins=100000;g.upgrade('table');for(const role of ROLES)g.hire(role);g.s.totalServed=40;g.b.served=40;g.b.contractsCompleted=completed;g.s.player=actor({x:0,z:3});
   const offers=contractOffers(g);expect(offers.some(o=>!o.rush&&o.seconds>=100)).toBe(true);const rush=offers.find(o=>o.rush)!;expect(rush.kind).toBe(g.def.preference);
   if(focused){g.setMenu(rush.kind);if(index===2){const budget=g.s.coins;expect(g.upgrade('space')).toBe(true);expect(g.upgrade('table')).toBe(true);expect(g.upgrade('table')).toBe(true);expect(g.upgrade('machine')).toBe(true);expect(budget-g.s.coins).toBe(1090);}}g.acceptContract(rush.kind);advance(g,rush.seconds+1);return g.b.special!;};
  expect(shift(false).status,`mixed ${index}/${seed}`).toBe('failed');expect(shift(true).status,`focused ${index}/${seed}`).toBe('ready');
 }
},20000);
