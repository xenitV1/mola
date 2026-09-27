import {describe,it,expect} from 'vitest';
import {InterstitialTiming,type NaturalAdBreak} from '../src/platform/interstitial-timing';
describe('interstitial active-play pacing',()=>{
 it('becomes due after sixty active seconds but only at an allowed ready natural break',()=>{
  const t=new InterstitialTiming();t.advance(59.9);expect(t.due).toBe(false);t.advance(.1);expect(t.due).toBe(true);
  expect(t.eligible('branch',false)).toBe(false);expect(t.eligible('service' as NaturalAdBreak,true)).toBe(false);
  for(const point of ['branch','special','mastery','upgrade'] as const)expect(t.eligible(point,true)).toBe(true);
 });
 it('waits 180 more active seconds after any actually shown ad, including rewarded',()=>{
  const t=new InterstitialTiming();t.advance(45);t.didShow();t.advance(179);expect(t.due).toBe(false);t.advance(1);expect(t.due).toBe(true);t.didShow();expect(t.due).toBe(false);
 });
 it('does not reset eligibility on skipped/no-fill breaks or create a catch-up queue',()=>{
  const t=new InterstitialTiming();t.advance(100000);expect(t.eligible('special',false)).toBe(false);expect(t.eligible('mastery',true)).toBe(true);t.didShow();t.advance(179.9);expect(t.due).toBe(false);
 });
 it('ignores invalid intervals and changes nothing while no active time is supplied',()=>{
  const t=new InterstitialTiming();for(const dt of [-10,NaN,Infinity,0])t.advance(dt);expect(t.due).toBe(false);t.advance(59);expect(t.due).toBe(false);
 });
 it('shares the cooldown across successive upgrades and other natural breaks',()=>{
  const t=new InterstitialTiming();t.advance(59);expect(t.eligible('upgrade',true)).toBe(false);
  t.advance(1);expect(t.eligible('upgrade',false)).toBe(false);expect(t.eligible('upgrade',true)).toBe(true);
  t.didShow();expect(t.eligible('upgrade',true)).toBe(false);expect(t.eligible('branch',true)).toBe(false);
  t.advance(179);expect(t.eligible('upgrade',true)).toBe(false);t.advance(1);expect(t.eligible('upgrade',true)).toBe(true);
 });
});
