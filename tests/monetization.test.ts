import {beforeEach,expect,it,vi} from 'vitest';
import {Simulation} from '../src/game/sim';
import {validateSave} from '../src/game/save';
import {TUNING} from '../src/game/config';
import {creditLifetimeBonus,claimAdFreeReward,rewardWait,LIFETIME_BONUS,LEGACY_LIFETIME_BONUS,isLifetimeBonusAmount} from '../src/game/monetization';
import {noAdsPanel} from '../src/ui/monetization';
import {setLocale} from '../src/game/i18n';
vi.stubGlobal('document',{documentElement:{lang:'en'}});
const grant='lifetime_no_ads:'+'a'.repeat(64);
beforeEach(()=>setLocale('en'));
it('credits the verified lifetime gift exactly once and preserves it across reload',()=>{
 const g=new Simulation(),commit=vi.fn(()=>true),before=g.s.coins;
 expect(creditLifetimeBonus(g,false,grant,commit)).toBe('unavailable');expect(commit).not.toHaveBeenCalled();
 expect(creditLifetimeBonus(g,true,grant,commit)).toBe('credited');expect(g.s.coins).toBe(before+LIFETIME_BONUS);expect(LIFETIME_BONUS).toBe(50000);expect(commit).toHaveBeenCalledTimes(1);expect(validateSave(g.s)).toBe(true);
 const restored=new Simulation(structuredClone(g.s));expect(creditLifetimeBonus(restored,true,grant,commit)).toBe('recorded');expect(restored.s.coins).toBe(before+LIFETIME_BONUS);expect(commit).toHaveBeenCalledTimes(1);
});
it('rolls back failed gift persistence so the native grant can be retried without duplication',()=>{
 const g=new Simulation(),before=structuredClone(g.s);
 expect(creditLifetimeBonus(g,true,grant,()=>false)).toBe('save-failed');expect(g.s.coins).toBe(before.coins);expect(g.s.monetization).toBeUndefined();
 expect(creditLifetimeBonus(g,true,grant,()=>true)).toBe('credited');expect(g.s.coins).toBe(before.coins+LIFETIME_BONUS);
});
it('does not lose a gift to the wallet cap or accept arbitrary grant strings',()=>{
 const g=new Simulation();g.s.coins=TUNING.maxMoney-1;expect(creditLifetimeBonus(g,true,grant,()=>true)).toBe('wallet-full');expect(g.s.monetization).toBeUndefined();expect(creditLifetimeBonus(g,true,'fake',()=>true)).toBe('unavailable');
 });
it('accepts the legacy 300k amount for an undelivered purchase exactly once',()=>{
 const g=new Simulation(),before=g.s.coins,commit=vi.fn(()=>true);
 expect(creditLifetimeBonus(g,true,grant,commit,LEGACY_LIFETIME_BONUS)).toBe('credited');
 expect(g.s.coins).toBe(before+LEGACY_LIFETIME_BONUS);
 expect(creditLifetimeBonus(g,true,grant,commit,LEGACY_LIFETIME_BONUS)).toBe('recorded');
 expect(commit).toHaveBeenCalledTimes(1);
});
it('rejects unapproved bonus amounts and rolls back a capped legacy grant',()=>{
 const g=new Simulation();expect(isLifetimeBonusAmount(50_000)).toBe(true);expect(isLifetimeBonusAmount(300_000)).toBe(true);expect(isLifetimeBonusAmount(49_999)).toBe(false);
 expect(creditLifetimeBonus(g,true,grant,()=>true,49_999)).toBe('unavailable');
 g.s.coins=TUNING.maxMoney-1;expect(creditLifetimeBonus(g,true,grant,()=>true,LEGACY_LIFETIME_BONUS)).toBe('wallet-full');expect(g.s.monetization).toBeUndefined();
});
it('paid reward access requires current native ownership, with persisted per-reward cooldowns',()=>{
 const g=new Simulation();expect(claimAdFreeReward(g,false,'coins',100000)).toBe(false);
 expect(claimAdFreeReward(g,true,'coins',100000)).toBe(true);expect(g.s.coins).toBe(520);expect(rewardWait(g,'coins',100000)).toBe(60);
 expect(claimAdFreeReward(g,true,'coins',159999)).toBe(false);expect(claimAdFreeReward(g,true,'tips',100000)).toBe(true);expect(g.s.boostSeconds).toBe(120);
 const restored=new Simulation(structuredClone(g.s));expect(claimAdFreeReward(restored,true,'coins',159999)).toBe(false);expect(claimAdFreeReward(restored,true,'coins',160000)).toBe(true);expect(claimAdFreeReward(restored,false,'stock',160000)).toBe(false);expect(validateSave(restored.s)).toBe(true);
});
it('an active energy reward consumes neither a cooldown nor another reward',()=>{
 const g=new Simulation();g.s.energySeconds=60;expect(claimAdFreeReward(g,true,'stock',100000)).toBe(false);expect(g.s.monetization).toBeUndefined();
});
it('the offer is truthful about the 50k gift and restoration in EN/TR',()=>{
 const unavailable={owned:false,activatedAt:0,status:'unavailable' as const,price:'',canPurchase:false};
 const en=noAdsPanel(unavailable);expect(en).toContain('50,000');expect(en).not.toContain('$0.99');expect(en).toContain('data-noads-action="buy" class="primary" disabled');expect(en).toContain('60 seconds');
 setLocale('tr');const tr=noAdsPanel(unavailable);expect(tr).toContain('50.000');expect(tr).toContain('Altın hediyesi tekrar verilmez');expect(tr).toContain('Abonelik değildir');
});
it('the live localized store price is escaped and only a purchasable store offer enables purchase',()=>{
 expect(noAdsPanel({owned:false,activatedAt:0,status:'ready',price:'₺39,99',canPurchase:true})).toContain('Google Play');
 expect(noAdsPanel({owned:false,activatedAt:0,status:'ready',price:'<script>',canPurchase:true})).not.toContain('<script>');
});

it('diamond shop lists all four configured amounts but cannot sell a fabricated web offer',async()=>{
 const {DiamondStore}=await import('../src/platform/purchases');const {diamondsPanel}=await import('../src/ui/monetization');const store=new DiamondStore(null);const html=diamondsPanel(store.state,500);
 for(const amount of ['100','500','5,000','10,000'])expect(html).toContain(amount);
 expect(html.match(/data-diamond-pack=/g)).toHaveLength(4);expect(html.match(/data-diamond-pack="[^"]+" disabled/g)).toHaveLength(4);expect(html).not.toContain('$4.99');expect(html).toContain('Consumed packs cannot be restored');
 setLocale('tr');expect(diamondsPanel(store.state,500)).toContain('Elmaslar bu cihazdaki kaydına eklenir');
});
