import {describe,it,expect} from 'vitest';
import {Simulation} from '../src/game/sim';
import {creditLifetimeBonus,creditReviewBonus} from '../src/game/monetization';
import {load,persist} from '../src/game/save';
const grant='review:12345678-1234-4234-8234-123456789abc';
describe('free review grant stays separate from Play purchases',()=>{
 it('persists once, survives reopening, and cannot be used as a paid receipt',()=>{
  const data=new Map<string,string>();const storage={getItem:(k:string)=>data.get(k)??null,setItem:(k:string,v:string)=>{data.set(k,v);},removeItem:(k:string)=>{data.delete(k);}};
  const game=new Simulation(),before=game.s.coins;
  expect(creditReviewBonus(game,false,grant,()=>persist(game.s,storage))).toBe('unavailable');
  expect(creditLifetimeBonus(game,true,grant,()=>persist(game.s,storage))).toBe('unavailable');
  expect(creditReviewBonus(game,true,grant,()=>persist(game.s,storage))).toBe('credited');
  const restored=new Simulation(load(storage).save);
  expect(restored.s.coins).toBe(before+50000);
  expect(creditReviewBonus(restored,true,grant,()=>persist(restored.s,storage))).toBe('recorded');
  expect(restored.s.coins).toBe(before+50000);
 });
 it('does not re-credit an existing legacy review grant',()=>{
  const game=new Simulation();game.s.monetization={bonusGrants:[grant],rewardReadyAt:{}};const before=game.s.coins;
  expect(creditReviewBonus(game,true,grant,()=>true,300000)).toBe('recorded');expect(game.s.coins).toBe(before);
 });
 it('rolls back a failed save and rejects untrusted grant identifiers',()=>{
  const game=new Simulation(),before=game.s.coins;
  expect(creditReviewBonus(game,true,grant,()=>false)).toBe('save-failed');
  expect(game.s.coins).toBe(before);expect(game.s.monetization).toBeUndefined();
  expect(creditReviewBonus(game,true,'lifetime_no_ads:'+'a'.repeat(64),()=>true)).toBe('unavailable');
  expect(creditReviewBonus(game,true,'review:forged',()=>true)).toBe('unavailable');
 });
});
