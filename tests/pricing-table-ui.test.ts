import {beforeEach,expect,it,vi} from 'vitest';
import {Simulation} from '../src/game/sim';
import {setLocale,translations} from '../src/game/i18n';
import {TABLE_TYPES} from '../src/game/table-layout';
import {PRICING} from '../src/game/pricing';
import {investmentPanel,menuPanel,purchaseInfo,reviewsPanel,furnitureThumbnail,tableUpgradePreview} from '../src/ui/management';
vi.stubGlobal('document',{documentElement:{lang:'en'}});
beforeEach(()=>setLocale('en'));
it('shows independent sale and price controls without nested buttons or hiding the chosen contract product',()=>{
 const g=new Simulation();g.s.coins=10000;g.hire('waiter');g.acceptContract('espresso');
 const html=menuPanel(g);let depth=0;
 for(const tag of html.matchAll(/<\/?button\b[^>]*>/g)){if(tag[0].startsWith('</'))depth--;else depth++;expect(depth).toBeGreaterThanOrEqual(0);expect(depth).toBeLessThanOrEqual(1);}expect(depth).toBe(0);
 expect(html.match(/data-price-product=/g)).toHaveLength(9);
 expect(html).toContain('data-menu="espresso" aria-pressed="true" aria-disabled="true"');
 expect(html).toContain('New prices apply only to new orders.');
 g.setPriceMode('espresso','high');expect(menuPanel(g)).toContain('data-price-product="espresso" data-price-mode="high" aria-pressed="true"');
});
it('recipe training preview includes the selected price mode and matches the actual next recipe price',()=>{
 const g=new Simulation();g.s.coins=10000;g.setPriceMode('espresso','high');const before=g.recipePrice('espresso');const preview=purchaseInfo(g,{kind:'recipe',id:'espresso'});g.upgradeRecipe('espresso');expect(preview.effect).toContain(`${before} → ${g.recipePrice('espresso')}`);
});
it('table and new-table previews show total seats and the real expansion prerequisite',()=>{
 const g=new Simulation();g.s.coins=10000;g.upgrade('table');g.upgradeTable(0);
 expect(g.seatingCapacity).toBe(6);expect(purchaseInfo(g,{kind:'upgrade',id:'table'}).effect).toContain('6 → 8');
 const info=purchaseInfo(g,{kind:'table-type',id:'0'});expect(info.available).toBe(false);expect(info.price).toBe(12000);expect(info.effect).toContain('4 → 6');
 const html=investmentPanel(g,'space');expect(html).toContain('Table 1 · Armchair group for four');expect(html).toContain('Required floor level');expect(html).toContain('data-review-kind="table-type" data-review-id="0"');
});
it('localizes all table and price names and describes the above-four-star demand surge',()=>{
 for(const entry of [...TABLE_TYPES,...Object.values(PRICING)])if(entry.name!=='Normal')expect(translations[entry.name],entry.name).toBeTruthy();
 const g=new Simulation();expect(reviewsPanel(g)).toContain('Demand grows faster above 4 stars');setLocale('tr');expect(menuPanel(g)).toContain('Fiyat tercihi');expect(investmentPanel(g,'space')).toContain('Masa türleri');
});

it('previews every seating upgrade as a distinct style with actual extra patience',()=>{
 const g=new Simulation();g.s.coins=10000+TABLE_TYPES.reduce((n,t)=>n+t.cost,0);g.upgrade('space');g.upgrade('space');
 for(let level=0;level<3;level++){
  const before=g.tableComfort(0),next=TABLE_TYPES[level+1],info=purchaseInfo(g,{kind:'table-type',id:'0'});
  expect(info.effect).toContain(`Comfort / extra patience: +${before}s → +${next.comfort}s`);
  expect(info.description).toContain('improves guest patience and reviews');
  const preview=tableUpgradePreview(g,0);expect(preview).toContain(`data-furniture-tier="${level}"`);expect(preview).toContain(`data-furniture-tier="${level+1}"`);
  expect(g.upgradeTable(0)).toBe(true);expect(g.tableComfort(0)).toBe(next.comfort);
 }
 expect(investmentPanel(g,'space')).toContain('Most comfortable lounge suite');
});
it('illustrates upholstered and L-shaped groups, with two separate coffee tables in the final suite',()=>{
 expect(furnitureThumbnail(0)).toContain('thumb-bistro');
 expect(furnitureThumbnail(1).match(/class="thumb-armchair"/g)).toHaveLength(4);
 expect(furnitureThumbnail(1)).not.toContain('thumb-l-sofa');
 expect(furnitureThumbnail(2)).toContain('thumb-l-sofa');expect(furnitureThumbnail(2).match(/class="thumb-coffee-table"/g)).toHaveLength(1);
 expect(furnitureThumbnail(3)).toContain('thumb-l-sofa');expect(furnitureThumbnail(3).match(/class="thumb-coffee-table"/g)).toHaveLength(2);
});
