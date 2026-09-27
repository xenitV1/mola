import {afterEach,beforeEach,describe,expect,it,vi} from 'vitest';
const native=vi.hoisted(()=>({enabled:true,removeFails:false,listeners:new Map<string,Set<()=>void>>(),removed:[] as string[]}));
const build=vi.hoisted(()=>({getAdConfiguration:vi.fn()}));
const sdk=vi.hoisted(()=>({requestConsentInfo:vi.fn(),showConsentForm:vi.fn(),initialize:vi.fn(),prepareRewardVideoAd:vi.fn(),showRewardVideoAd:vi.fn(),prepareInterstitial:vi.fn(),showInterstitial:vi.fn(),showPrivacyOptionsForm:vi.fn(),addListener:vi.fn()}));
vi.mock('@capacitor/core',()=>({Capacitor:{isNativePlatform:()=>native.enabled},registerPlugin:()=>build}));
vi.mock('@capacitor-community/admob',()=>({AdMob:sdk,AdmobConsentStatus:{REQUIRED:'REQUIRED'},RewardAdPluginEvents:{Rewarded:'reward',Showed:'showed',Dismissed:'dismiss',FailedToShow:'fail'},InterstitialAdPluginEvents:{Showed:'i-showed',Dismissed:'i-dismiss',FailedToShow:'i-fail'}}));
import {RewardedAds,AD_LOAD_TIMEOUT_MS} from '../src/platform/ads';
const allowed={status:'NOT_REQUIRED',canRequestAds:true,isConsentFormAvailable:false,privacyOptionsRequirementStatus:'NOT_REQUIRED'};
const deferred=<T=unknown>()=>{let resolve!:(value:T)=>void,reject!:(reason:unknown)=>void;const promise=new Promise<T>((r,j)=>{resolve=r;reject=j;});return {promise,resolve,reject};};
const flush=async()=>{for(let i=0;i<40;i++)await Promise.resolve();};
const event=(name:string)=>{for(const listener of native.listeners.get(name)??[])listener();};
beforeEach(()=>{
 vi.useFakeTimers();vi.resetAllMocks();native.enabled=true;native.removeFails=false;native.listeners.clear();native.removed=[];
 build.getAdConfiguration.mockResolvedValue({test:true,appId:'ca-app-pub-3940256099942544~3347511713',rewarded:{coins:'ca-app-pub-3940256099942544/5224354917',tips:'ca-app-pub-3940256099942544/5224354917',stock:'ca-app-pub-3940256099942544/5224354917'}});
 sdk.requestConsentInfo.mockResolvedValue({...allowed});sdk.initialize.mockResolvedValue(undefined);
 sdk.prepareRewardVideoAd.mockResolvedValue({});sdk.showRewardVideoAd.mockImplementation(()=>new Promise(()=>{}));
 sdk.showPrivacyOptionsForm.mockResolvedValue(undefined);
 sdk.addListener.mockImplementation(async(name:string,callback:()=>void)=>{
  if(!native.listeners.has(name))native.listeners.set(name,new Set());native.listeners.get(name)!.add(callback);
  return {remove:async()=>{native.removed.push(name);if(native.removeFails)throw new Error('bridge closed');native.listeners.get(name)?.delete(callback);}};
 });
});
afterEach(()=>vi.useRealTimers());
describe('rewarded ad lifecycle against a controlled native bridge',()=>{
 it('refreshes privacy entry eligibility once per app launch without loading an ad',async()=>{
  sdk.requestConsentInfo.mockResolvedValue({...allowed,privacyOptionsRequirementStatus:'REQUIRED'});
  const ads=new RewardedAds();await Promise.all([ads.startSession(),ads.startSession()]);
  expect(ads.privacyRequired).toBe(true);expect(sdk.requestConsentInfo).toHaveBeenCalledTimes(1);
  expect(sdk.initialize).not.toHaveBeenCalled();expect(sdk.prepareRewardVideoAd).not.toHaveBeenCalled();expect(sdk.showConsentForm).not.toHaveBeenCalled();expect(ads.ownsScreen).toBe(false);
 });
 it('does not block play on a failed launch check and retries consent before an ad',async()=>{
  sdk.requestConsentInfo.mockRejectedValueOnce(new Error('offline'));const ads=new RewardedAds();await ads.startSession();
  expect(ads.busy).toBe(false);const result=ads.show('coins',vi.fn());await flush();
  expect(sdk.requestConsentInfo).toHaveBeenCalledTimes(2);event('dismiss');expect(await result).toBe('cancelled');
 });
 it('quarantines a timed-out launch check without showing a late form or ad',async()=>{
  const request=deferred();sdk.requestConsentInfo.mockReturnValueOnce(request.promise);const ads=new RewardedAds();const session=ads.startSession();
  await vi.advanceTimersByTimeAsync(AD_LOAD_TIMEOUT_MS+1);await session;
  expect(ads.ownsScreen).toBe(false);expect(await ads.show('coins',vi.fn())).toBe('unavailable');
  request.resolve({...allowed,status:'REQUIRED',isConsentFormAvailable:true});await flush();
  expect(ads.busy).toBe(false);expect(sdk.showConsentForm).not.toHaveBeenCalled();expect(sdk.prepareRewardVideoAd).not.toHaveBeenCalled();
 });
 it('uses the native build configuration and selected reward placement',async()=>{
  const units={coins:'ca-app-pub-1234567890123456/1278515507',tips:'ca-app-pub-1234567890123456/1817676757',stock:'ca-app-pub-1234567890123456/2866929346'};
  build.getAdConfiguration.mockResolvedValue({test:false,appId:'ca-app-pub-1234567890123456~8303194055',rewarded:units});
  const ads=new RewardedAds();const result=ads.show('stock',vi.fn());await flush();
  expect(sdk.initialize).toHaveBeenCalledWith({initializeForTesting:false});
  expect(sdk.prepareRewardVideoAd).toHaveBeenCalledWith({adId:units.stock,isTesting:false});event('dismiss');await result;
 });
 it('does not request ads when native configuration is missing or malformed',async()=>{
  build.getAdConfiguration.mockResolvedValue({test:false,appId:'missing',rewarded:{}});
  const ads=new RewardedAds();expect(await ads.show('coins',vi.fn())).toBe('unavailable');
  expect(sdk.initialize).not.toHaveBeenCalled();expect(sdk.prepareRewardVideoAd).not.toHaveBeenCalled();
 });
 it('does not invent browser ads or rewards',async()=>{native.enabled=false;const ads=new RewardedAds(),grant=vi.fn();expect(await ads.show('coins',grant)).toBe('web');expect(grant).not.toHaveBeenCalled();expect(sdk.requestConsentInfo).not.toHaveBeenCalled();});
 it('grants once from reward callbacks and remains paused until dismissal',async()=>{
  const ads=new RewardedAds(),grant=vi.fn();const result=ads.show('coins',grant);await flush();
  expect(ads.ownsScreen).toBe(true);event('reward');event('reward');
  expect(grant).toHaveBeenCalledTimes(1);expect(grant).toHaveBeenCalledWith(expect.any(String),'coins');
  expect(ads.ownsScreen).toBe(true);expect(ads.cancelLoading()).toBe(false);
  event('dismiss');expect(await result).toBe('rewarded');await flush();expect(ads.busy).toBe(false);expect(native.removed).toHaveLength(4);
 });
 it('does not use a resolved show promise as proof of reward',async()=>{
  sdk.showRewardVideoAd.mockResolvedValue({amount:1});const ads=new RewardedAds(),grant=vi.fn();
  const result=ads.show('tips',grant);await flush();expect(grant).not.toHaveBeenCalled();event('dismiss');expect(await result).toBe('cancelled');
 });
 it('recovers when loading fails without affecting the economy',async()=>{
  sdk.prepareRewardVideoAd.mockRejectedValue(new Error('no fill'));const ads=new RewardedAds(),grant=vi.fn();
  expect(await ads.show('stock',grant)).toBe('unavailable');expect(ads.busy).toBe(false);expect(grant).not.toHaveBeenCalled();expect(sdk.showRewardVideoAd).not.toHaveBeenCalled();
 });
 it('recovers from show rejection and FailedToShow',async()=>{
  const ads=new RewardedAds(),grant=vi.fn();sdk.showRewardVideoAd.mockRejectedValueOnce(new Error('activity not available'));
  expect(await ads.show('coins',grant)).toBe('unavailable');await flush();
  const retry=ads.show('coins',grant);await flush();event('fail');expect(await retry).toBe('unavailable');expect(ads.busy).toBe(false);expect(grant).not.toHaveBeenCalled();
 });
 it('never initializes or requests an ad when UMP cannot request ads',async()=>{
  sdk.requestConsentInfo.mockResolvedValue({...allowed,canRequestAds:false,privacyOptionsRequirementStatus:'REQUIRED'});
  const ads=new RewardedAds();expect(await ads.show('coins',vi.fn())).toBe('unavailable');expect(ads.privacyRequired).toBe(true);expect(sdk.initialize).not.toHaveBeenCalled();expect(sdk.prepareRewardVideoAd).not.toHaveBeenCalled();
 });
 it('gives the person time to answer consent and honors the returned eligibility',async()=>{
  const form=deferred();sdk.requestConsentInfo.mockResolvedValue({...allowed,status:'REQUIRED',isConsentFormAvailable:true,canRequestAds:false});sdk.showConsentForm.mockReturnValue(form.promise);
  const ads=new RewardedAds();const result=ads.show('coins',vi.fn());await flush();expect(ads.ownsScreen).toBe(true);
  await vi.advanceTimersByTimeAsync(AD_LOAD_TIMEOUT_MS*4);expect(ads.ownsScreen).toBe(true);expect(ads.cancelLoading()).toBe(false);
  form.resolve({...allowed,canRequestAds:false});expect(await result).toBe('unavailable');expect(ads.busy).toBe(false);expect(sdk.prepareRewardVideoAd).not.toHaveBeenCalled();
 });
 it('stops before SDK initialization when ads are disabled during consent',async()=>{
  const form=deferred();sdk.requestConsentInfo.mockResolvedValue({...allowed,status:'REQUIRED',isConsentFormAvailable:true,canRequestAds:false});sdk.showConsentForm.mockReturnValue(form.promise);
  const ads=new RewardedAds(),grant=vi.fn();const result=ads.show('coins',grant);await flush();
  expect(ads.ownsScreen).toBe(true);ads.setForeground(false);
  expect(ads.ownsScreen).toBe(true);form.resolve({...allowed});
  expect(await result).toBe('unavailable');expect(ads.busy).toBe(false);
  expect(sdk.initialize).not.toHaveBeenCalled();expect(sdk.prepareRewardVideoAd).not.toHaveBeenCalled();expect(grant).not.toHaveBeenCalled();
 });
 it('does not load a reward if ads are disabled while SDK initialization is pending',async()=>{
  const initialization=deferred();sdk.initialize.mockReturnValue(initialization.promise);
  const ads=new RewardedAds(),grant=vi.fn();const result=ads.show('coins',grant);await flush();
  expect(sdk.initialize).toHaveBeenCalledTimes(1);ads.setForeground(false);initialization.resolve(undefined);
  await result;await flush();expect(sdk.prepareRewardVideoAd).not.toHaveBeenCalled();expect(sdk.showRewardVideoAd).not.toHaveBeenCalled();expect(grant).not.toHaveBeenCalled();
 });
 it('times out a hung native load, quarantines it, and never auto-shows its late result',async()=>{
  const load=deferred();sdk.prepareRewardVideoAd.mockReturnValueOnce(load.promise);const ads=new RewardedAds(),grant=vi.fn();
  const result=ads.show('coins',grant);await flush();await vi.advanceTimersByTimeAsync(AD_LOAD_TIMEOUT_MS+1);
  expect(await result).toBe('unavailable');expect(ads.ownsScreen).toBe(false);expect(ads.cancelLoading()).toBe(true);
  expect(await ads.show('tips',grant)).toBe('unavailable');expect(sdk.prepareRewardVideoAd).toHaveBeenCalledTimes(1);
  load.resolve({});await flush();expect(ads.busy).toBe(false);expect(sdk.showRewardVideoAd).not.toHaveBeenCalled();
  const retry=ads.show('stock',grant);await flush();event('reward');event('dismiss');expect(await retry).toBe('rewarded');expect(grant).toHaveBeenCalledTimes(1);expect(grant.mock.calls[0][1]).toBe('stock');
 });
 it('lets the player cancel a load while guarding later native completion',async()=>{
  const load=deferred();sdk.prepareRewardVideoAd.mockReturnValue(load.promise);const ads=new RewardedAds(),grant=vi.fn();
  const result=ads.show('coins',grant);await flush();expect(ads.cancelLoading()).toBe(true);expect(await result).toBe('cancelled');
  load.resolve({});await flush();expect(sdk.showRewardVideoAd).not.toHaveBeenCalled();expect(grant).not.toHaveBeenCalled();expect(ads.busy).toBe(false);
 });
 it('does not lock the café or grant late events if removing native listeners fails',async()=>{
  native.removeFails=true;const ads=new RewardedAds(),grant=vi.fn();const result=ads.show('coins',grant);await flush();
  event('dismiss');expect(await result).toBe('cancelled');await flush();event('reward');expect(grant).not.toHaveBeenCalled();expect(ads.busy).toBe(false);expect(native.removed).toHaveLength(4);
 });
 it('ignores simultaneous watch requests and serializes privacy UI',async()=>{
  const ads=new RewardedAds(),grant=vi.fn();const result=ads.show('coins',grant);expect(await ads.show('tips',grant)).toBe('unavailable');await flush();
  await ads.privacy();expect(sdk.showPrivacyOptionsForm).not.toHaveBeenCalled();event('dismiss');await result;
  const form=deferred();sdk.showPrivacyOptionsForm.mockReturnValue(form.promise);const privacy=ads.privacy();expect(ads.ownsScreen).toBe(true);
  expect(await ads.show('coins',grant)).toBe('unavailable');form.resolve(undefined);await privacy;expect(ads.busy).toBe(false);
 });
});

describe('preloaded interstitials share consent and fullscreen ownership',()=>{
 beforeEach(()=>{
  build.getAdConfiguration.mockResolvedValue({test:true,appId:'ca-app-pub-3940256099942544~3347511713',interstitial:'ca-app-pub-3940256099942544/1033173712',rewarded:{coins:'ca-app-pub-3940256099942544/5224354917',tips:'ca-app-pub-3940256099942544/5224354917',stock:'ca-app-pub-3940256099942544/5224354917'}});
  sdk.prepareInterstitial.mockResolvedValue({});sdk.showInterstitial.mockResolvedValue(undefined);
 });
 it('never loads or waits at a natural break if no ad is already ready',async()=>{
  const ads=new RewardedAds();expect(await ads.showInterstitial()).toBe('unavailable');expect(sdk.requestConsentInfo).not.toHaveBeenCalled();expect(sdk.prepareInterstitial).not.toHaveBeenCalled();
 });
 it('preloads without showing, counts actual visibility once, and owns the screen until dismissal',async()=>{
  const ads=new RewardedAds(),shown=vi.fn();ads.onAdShown=shown;expect(await ads.preloadInterstitial()).toBe(true);expect(ads.interstitialReady).toBe(true);expect(ads.ownsScreen).toBe(false);expect(sdk.showInterstitial).not.toHaveBeenCalled();
  const result=ads.showInterstitial();expect(sdk.showInterstitial).toHaveBeenCalledTimes(1);await flush();expect(ads.ownsScreen).toBe(true);expect(shown).not.toHaveBeenCalled();event('i-showed');event('i-showed');expect(shown).toHaveBeenCalledTimes(1);expect(ads.cancelLoading()).toBe(false);
  event('i-dismiss');expect(await result).toBe('shown');await flush();expect(ads.busy).toBe(false);expect(ads.interstitialReady).toBe(false);expect(native.removed).toHaveLength(3);expect(await ads.showInterstitial()).toBe('unavailable');
 });
 it('does not reset pacing on a show rejection or failed-to-show event',async()=>{
  const ads=new RewardedAds(),shown=vi.fn();ads.onAdShown=shown;await ads.preloadInterstitial();sdk.showInterstitial.mockRejectedValueOnce(new Error('no activity'));
  expect(await ads.showInterstitial()).toBe('unavailable');expect(ads.busy).toBe(false);await ads.preloadInterstitial();const result=ads.showInterstitial();event('i-fail');expect(await result).toBe('unavailable');expect(shown).not.toHaveBeenCalled();expect(ads.interstitialReady).toBe(false);
 });
 it('cancels background loading and cannot use a late native completion to show',async()=>{
  const load=deferred();sdk.prepareInterstitial.mockReturnValueOnce(load.promise);const ads=new RewardedAds(),task=ads.preloadInterstitial();await flush();ads.setForeground(false);expect(await task).toBe(false);ads.setForeground(true);expect(ads.busy).toBe(true);
  load.resolve({});await flush();expect(ads.busy).toBe(false);expect(ads.interstitialReady).toBe(false);expect(await ads.showInterstitial()).toBe('unavailable');expect(sdk.showInterstitial).not.toHaveBeenCalled();
 });
 it('invalidates ready ads on background but lets an already visible ad dismiss normally',async()=>{
  const ads=new RewardedAds();await ads.preloadInterstitial();ads.setForeground(false);ads.setForeground(true);expect(ads.interstitialReady).toBe(false);await ads.preloadInterstitial();const result=ads.showInterstitial();event('i-showed');ads.setForeground(false);expect(ads.ownsScreen).toBe(true);event('i-dismiss');expect(await result).toBe('shown');expect(ads.busy).toBe(false);
 });
 it('removes a listener whose registration completes only after cancellation',async()=>{
  const registration=deferred<{remove:()=>Promise<void>}>(),remove=vi.fn().mockResolvedValue(undefined);sdk.addListener.mockReturnValueOnce(registration.promise);const ads=new RewardedAds(),task=ads.preloadInterstitial();await flush();ads.setForeground(false);expect(await task).toBe(false);
  registration.resolve({remove});await flush();expect(remove).toHaveBeenCalledTimes(1);ads.setForeground(true);expect(ads.interstitialReady).toBe(false);expect(await ads.showInterstitial()).toBe('unavailable');expect(sdk.showInterstitial).not.toHaveBeenCalled();
 });
 it('quarantines a timed-out preload and cleans up even when native listener removal fails',async()=>{
  const load=deferred();sdk.prepareInterstitial.mockReturnValueOnce(load.promise);const ads=new RewardedAds(),shown=vi.fn();ads.onAdShown=shown;const task=ads.preloadInterstitial();await flush();await vi.advanceTimersByTimeAsync(AD_LOAD_TIMEOUT_MS+1);expect(await task).toBe(false);expect(await ads.preloadInterstitial()).toBe(false);
  load.resolve({});await flush();await ads.preloadInterstitial();native.removeFails=true;const result=ads.showInterstitial();event('i-dismiss');expect(await result).toBe('cancelled');event('i-showed');expect(shown).not.toHaveBeenCalled();expect(ads.busy).toBe(false);
 });
 it('does not open a consent form during background preload; permits it only at an explicit safe startup',async()=>{
  sdk.requestConsentInfo.mockResolvedValue({...allowed,status:'REQUIRED',canRequestAds:false,isConsentFormAvailable:true});const ads=new RewardedAds();expect(await ads.preloadInterstitial()).toBe(false);expect(sdk.showConsentForm).not.toHaveBeenCalled();expect(sdk.prepareInterstitial).not.toHaveBeenCalled();
  const form=deferred();sdk.showConsentForm.mockReturnValueOnce(form.promise);const task=ads.preloadInterstitial({allowConsentForm:true});await flush();expect(ads.ownsScreen).toBe(true);await vi.advanceTimersByTimeAsync(AD_LOAD_TIMEOUT_MS*3);expect(ads.ownsScreen).toBe(true);form.resolve({...allowed});expect(await task).toBe(true);expect(ads.ownsScreen).toBe(false);
 });
 it('does not preload when consent denies ads, the production unit is absent, or on web',async()=>{
  const ads=new RewardedAds();sdk.requestConsentInfo.mockResolvedValueOnce({...allowed,canRequestAds:false});expect(await ads.preloadInterstitial()).toBe(false);expect(sdk.initialize).not.toHaveBeenCalled();
  build.getAdConfiguration.mockResolvedValueOnce({test:false,appId:'ca-app-pub-1234567890123456~8303194055',interstitial:'',rewarded:{coins:'ca-app-pub-1234567890123456/1278515507',tips:'ca-app-pub-1234567890123456/1817676757',stock:'ca-app-pub-1234567890123456/2866929346'}});expect(await ads.preloadInterstitial()).toBe(false);expect(sdk.prepareInterstitial).not.toHaveBeenCalled();
  native.enabled=false;expect(await ads.preloadInterstitial()).toBe(false);expect(await ads.showInterstitial()).toBe('web');expect(sdk.showInterstitial).not.toHaveBeenCalled();
 });
 it('serializes rewarded and interstitial fullscreen, counting either format from actual Showed only',async()=>{
  const ads=new RewardedAds(),shown=vi.fn(),grant=vi.fn();ads.onAdShown=shown;await ads.preloadInterstitial();const reward=ads.show('coins',grant);await flush();expect(await ads.showInterstitial()).toBe('unavailable');event('showed');event('showed');expect(shown).toHaveBeenCalledTimes(1);event('reward');event('dismiss');expect(await reward).toBe('rewarded');
  const interstitial=ads.showInterstitial();expect(await ads.show('stock',grant)).toBe('unavailable');await ads.privacy();expect(sdk.showPrivacyOptionsForm).not.toHaveBeenCalled();event('i-showed');event('i-dismiss');expect(await interstitial).toBe('shown');expect(shown).toHaveBeenCalledTimes(2);expect(grant).toHaveBeenCalledTimes(1);
 });
 it('requires renewed eligibility after privacy choices and drops ads before their one-hour expiry',async()=>{
  const ads=new RewardedAds();await ads.preloadInterstitial();await ads.privacy();expect(ads.interstitialReady).toBe(false);await ads.preloadInterstitial();await vi.advanceTimersByTimeAsync(55*60_000);expect(ads.interstitialReady).toBe(false);expect(await ads.showInterstitial()).toBe('unavailable');expect(sdk.showInterstitial).not.toHaveBeenCalled();
 });
});
