import {expect,it} from 'vitest';
import {ROLES} from '../src/game/config';
import {nextAction} from '../src/game/guide';
import {Simulation,actor} from '../src/game/sim';

it('does not demand beans for an available recipe that does not use beans',()=>{
 const g=new Simulation();g.s.coins=5000;g.upgradeRecipe('lemonade');g.setMenu('lemonade');g.b.stock=0;
 expect(g.canPrepare('lemonade')).toBe(true);
 expect(g.bottleneck().action).toBe('grow');
 g.b.ingredients.cold=0;
 expect(g.bottleneck().action).toBe('stock');
});

it('still warns about low beans for a recipe that needs them',()=>{
 const g=new Simulation();g.b.stock=2;
 expect(g.canPrepare('espresso')).toBe(true);
 expect(g.bottleneck().action).toBe('stock');
});

it('offers the next management choice again when an optional order expires',()=>{
 const g=new Simulation();g.s.coins=10000;g.upgrade('table');
 for(const role of ROLES)g.hire(role);
 g.s.totalServed=10;g.s.player=actor({x:0,z:3});
 expect(g.acceptContract('espresso')).toBe(true);
 g.b.special!.seconds=.1;g.step(.1);
 expect(g.b.special!.status).toBe('failed');
 expect(nextAction(g)).toMatchObject({id:'choose-contract',panel:'contracts'});
 expect(g.acceptContract('cake')).toBe(true);
 expect(nextAction(g).id).not.toBe('choose-contract');
});

it('keeps earned stars and affordable new branches ahead of repeat side orders',()=>{
 const g=new Simulation();g.s.coins=10000;g.upgrade('table');for(const role of ROLES)g.hire(role);g.s.totalServed=40;g.b.served=40;
 expect(nextAction(g)).toMatchObject({id:'ready-star',panel:'mastery'});expect(g.claimMastery()).toBe(true);
 expect(nextAction(g)).toMatchObject({id:'expand-chain',panel:'branches'});expect(g.acceptContract('cake')).toBe(true);
 expect(nextAction(g).id).not.toBe('expand-chain');
});
