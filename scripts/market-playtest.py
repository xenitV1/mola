"""UI coverage with an explicitly seeded, bot-earned three-branch QA save.
Screenshots are test evidence, not store screenshots or new-player evidence.
"""
import json, pathlib, os
from playwright.sync_api import sync_playwright
out=pathlib.Path('artifacts');fixture=json.loads((out/'qa/chain-save.json').read_text())
with sync_playwright() as p:
 browser=p.chromium.launch(headless=True,args=['--no-sandbox','--enable-unsafe-swiftshader'])
 for locale,width in [('en',390),('tr',360)]:
  page=browser.new_page(viewport={'width':width,'height':844},is_mobile=True,has_touch=True)
  errors=[]
  page.on('pageerror',lambda e:errors.append(str(e)))
  page.on('console',lambda m:errors.append(m.text) if m.type=='error' else None)
  page.on('response',lambda r:errors.append(f'HTTP {r.status}: {r.url}') if r.status>=400 else None)
  seed={**fixture,'active':0,'settings':{**fixture['settings'],'locale':locale}}
  page.add_init_script('const seed='+json.dumps(seed)+';seed.savedAt=Date.now();localStorage.setItem("minik-mola.save.v1",JSON.stringify(seed));')
  page.goto(os.environ.get('CAFE_TEST_URL','http://127.0.0.1:4174'),wait_until='networkidle')
  page.get_by_role('button',name='Open my café' if locale=='en' else 'Oyna',exact=True).click()
  for branch in [1,2,0]:
   page.locator('.bottom [data-panel="branches"]').click()
   page.locator(f'[data-branch="{branch}"]').click()
   page.wait_for_function(f'__cafe.game.s.active==={branch}')
   page.locator('.cafe-strip [data-panel="menu"]').click()
   expected={0:65,1:38,2:100}[branch]
   assert str(expected)+'%' in page.locator('[data-menu="cake"] .menu-demand').inner_text()
   assert page.locator('.local-favourite').count()==1
   before=page.evaluate('__cafe.game.s.coins')
   preferred=['latte','espresso','cake'][branch]
   page.locator(f'[data-menu="{preferred}"]').click()
   assert page.locator(f'[data-menu="{preferred}"]').get_attribute('aria-pressed')=='true'
   assert page.evaluate('__cafe.game.s.coins')==before
   assert page.evaluate('document.documentElement.scrollWidth <= innerWidth')
   # The scrollable body must retain all three reachable menu controls.
   for kind in ['espresso','latte','cake']:
    element=page.locator(f'[data-menu="{kind}"]');element.scroll_into_view_if_needed()
    box=element.bounding_box();assert box and box['width']>=48 and box['height']>=48
    assert box['x']>=0 and box['x']+box['width']<=width+1
   page.screenshot(path=str(out/f'market-{branch}-{locale}-{width}.png'))
   page.get_by_role('button',name='Close' if locale=='en' else 'Kapat',exact=True).click()
  assert not errors,errors
  print('MARKET_UI',locale,width,'all three branches, choice/price/touch/overflow passed; errors',errors)
  page.close()
 browser.close()
