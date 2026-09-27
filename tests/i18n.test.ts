import {describe,it,expect,vi} from 'vitest';
import {setLocale,t,translations,cups} from '../src/game/i18n';
import {freshSave} from '../src/game/sim';
import {DECOR} from '../src/game/decor';
import {MENU,STAFF,BRANCHES,UPGRADES} from '../src/game/config';
vi.stubGlobal('document',{documentElement:{lang:'en'}});
describe('English-first localization',()=>{
 it('uses English even before any language choice',()=>expect(freshSave().settings.locale).toBe('en'));
 it('translates every content catalog name and description',()=>{setLocale('en');const keys=[...Object.values(DECOR).flatMap(v=>[v.name,v.description]),...Object.values(UPGRADES).flatMap(v=>[v.name,v.description]),...Object.values(STAFF).flatMap(v=>[v.name,v.description]),...BRANCHES.flatMap(v=>[v.name,v.subtitle,v.insight]),...Object.values(MENU).map(v=>v.name)];for(const key of keys)if(!['Espresso','Latte','Barista'].includes(key))expect(translations[key],key).toBeTruthy();});
 it('localizes dynamic events without Turkish fragments',()=>{setLocale('en');expect(t('Yeni masa hazır!')).toBe('New table is ready!');expect(t('Kahve & pasta menüye alındı.')).toBe('Coffee & cake is on the menu.');expect(t('Ece iş başında!')).toBe('Ece is on the team!');expect(t('3 mutlu mola! +35 altın')).toBe('3 happy breaks! +35 coins');});
 it('uses natural counted cup labels in both languages',()=>{setLocale('en');expect(cups(1)).toBe('1 cup');expect(cups(3)).toBe('3 cups');setLocale('tr');expect(cups(1)).toBe('1 fincan');expect(cups(3)).toBe('3 fincan');});
 it('restores all Turkish source strings when selected',()=>{setLocale('tr');expect(t('Yeni masa')).toBe('Yeni masa');expect(t('Ece iş başında!')).toBe('Ece iş başında!');});
});
