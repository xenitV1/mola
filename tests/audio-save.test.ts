import {describe,it,expect} from 'vitest';
import {freshSave} from '../src/game/sim';
import {migrateSave,validateSave} from '../src/game/save';
describe('music setting compatibility',()=>{
 it.each([true,false])('keeps old sound choice %s when adding music without losing progress',sound=>{
  const old:any=freshSave();old.version=3;old.coins=627;old.settings.sound=sound;delete old.settings.music;
  const migrated:any=migrateSave(old);expect(validateSave(migrated)).toBe(true);
  expect(migrated.settings.music).toBe(sound);expect(migrated.coins).toBe(627);
  expect(old.settings).not.toHaveProperty('music');
 });
 it('preserves a separate saved music choice and rejects malformed choices',()=>{
  const s=freshSave();s.settings.music=false;expect(migrateSave(s)).toBe(s);expect(validateSave(s)).toBe(true);
  (s.settings as any).music='yes';expect(validateSave(migrateSave(s))).toBe(false);
 });
});
