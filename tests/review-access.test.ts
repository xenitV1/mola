import {afterEach,beforeEach,describe,it,expect,vi} from 'vitest';
import {ReviewAccess,type ReviewAccessPort,type ReviewAccessState} from '../src/platform/review-access';
import {reviewAccessPanel} from '../src/ui/review-access';
import {setLocale} from '../src/game/i18n';

const grantId='review:12345678-1234-1234-1234-123456789abc';
const state=(active=false):ReviewAccessState=>({available:true,active,activatedAt:active?1234:0,grantId:active?grantId:''});
function setup(){
 let current=state();
 const port:ReviewAccessPort={getCached:vi.fn(async()=>current),activate:vi.fn(async({code})=>{const accepted=code==='test-credential';if(accepted)current={...state(true),activatedAt:current.activatedAt||1234,grantId:current.grantId||grantId};return {accepted,state:current};}),disable:vi.fn(async()=>current={...current,active:false})};
 return {port,access:new ReviewAccess(port)};
}
beforeEach(()=>vi.stubGlobal('document',{documentElement:{lang:'en'}}));
afterEach(()=>{setLocale('en');vi.unstubAllGlobals();});
describe('explicit review access remains separate from purchases',()=>{
 it('does not grant on the web or a missing bridge',async()=>{const access=new ReviewAccess(null);await access.loadCached();expect(await access.activate('test-credential')).toBe(false);expect(access.state.active).toBe(false);expect(access.state.available).toBe(false);});
 it('requires successful native authorization and keeps one grant across disabling, reenabling and reload',async()=>{
  const {port,access}=setup();await access.loadCached();expect(await access.activate('wrong')).toBe(false);expect(access.state.active).toBe(false);
  expect(await access.activate('test-credential')).toBe(true);const granted={...access.state};
  expect(await access.disable()).toBe(true);expect(access.state).toEqual({...granted,active:false});
  expect(await access.activate('test-credential')).toBe(true);expect(access.state).toEqual(granted);
  const restored=new ReviewAccess(port);await restored.loadCached();expect(restored.state).toEqual(granted);
 });
 it.each([{active:true,activatedAt:0},{active:true,grantId:'lifetime_no_ads:fake'},{active:true,available:false}])('rejects malformed native grant %j',async(patch)=>{
  const {port}=setup();port.getCached=async()=>({...state(true),...patch});const access=new ReviewAccess(port);await access.loadCached();expect(access.state.active).toBe(false);expect(access.state.grantId).toBe('');
 });
 it('retains the current access if a disabling request fails',async()=>{const {port,access}=setup();await access.activate('test-credential');port.disable=async()=>{throw Error('storage failed');};expect(await access.disable()).toBe(false);expect(access.state.active).toBe(true);});
 it('never sends oversized codes to native',async()=>{const {port,access}=setup();expect(await access.activate('x'.repeat(129))).toBe(false);expect(port.activate).not.toHaveBeenCalled();});
 it('does not expose credentials in either language and explains added gold before activation',()=>{
  for(const locale of ['en','tr'] as const){setLocale(locale);const html=reviewAccessPanel(state());expect(html).toContain('type="password"');expect(html).toContain(locale==='en'?'50,000':'50.000');expect(html).toContain('data-review-action="activate"');expect(html).not.toContain('test-credential');expect(reviewAccessPanel(state(true))).toContain('data-review-action="disable"');}
 });
});
