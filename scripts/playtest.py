import json, pathlib, os
from playwright.sync_api import sync_playwright
out=pathlib.Path('artifacts');out.mkdir(exist_ok=True)
with sync_playwright() as p:
 browser=p.chromium.launch(headless=True,args=['--no-sandbox','--enable-unsafe-swiftshader'])
 page=browser.new_page(viewport={'width':390,'height':844},device_scale_factor=1,is_mobile=True,has_touch=True)
 errors=[]
 page.on('pageerror',lambda e:errors.append(str(e)))
 page.on('response',lambda r:errors.append(f'HTTP {r.status}: {r.url}') if r.status>=400 else None)
 page.on('console',lambda msg:errors.append(msg.text) if msg.type=='error' else None)
 page.goto(os.environ.get('CAFE_TEST_URL','http://localhost:5173'),wait_until='networkidle')
 page.screenshot(path=str(out/'01-opening.png'))
 print('BUTTONS',page.get_by_role('button').all_text_contents())
 page.get_by_role('button',name='Open my café',exact=True).click()
 page.wait_for_timeout(300)
 page.screenshot(path=str(out/'02-first-cafe.png'))
 print('STATE',page.evaluate('({started:__cafe.started, stock:__cafe.game.b.stock, calls:__cafe.scene.renderer.info.render.calls, triangles:__cafe.scene.renderer.info.render.triangles})'))
 page.get_by_role('button',name='Brew coffee',exact=True).click()
 page.wait_for_function('__cafe.game.s.player.cups.length>0',timeout=45000)
 print('BREWED',page.evaluate('({stock:__cafe.game.b.stock,cups:__cafe.game.s.player.cups.length,player:__cafe.game.s.player})'))
 page.get_by_role('button',name='Serve a table',exact=True).click()
 try:
  page.wait_for_function('__cafe.game.b.served>0',timeout=60000)
 except Exception:
  page.screenshot(path=str(out/'FAIL-serve.png'))
  print('FAILED_STATE',page.evaluate('JSON.stringify(__cafe.game.s)'))
  raise
 page.get_by_role('button',name='Serve a table',exact=True).click()
 page.wait_for_function('__cafe.game.s.coins>35',timeout=30000)
 page.screenshot(path=str(out/'03-first-sale.png'))
 print('SERVED',page.evaluate('({served:__cafe.game.b.served,coins:__cafe.game.s.coins})'))
 page.get_by_role('button',name='Brew coffee',exact=True).click()
 page.wait_for_function('__cafe.game.s.player.cups.length>0',timeout=45000)
 page.get_by_role('button',name='Serve a table',exact=True).click()
 page.wait_for_function('__cafe.game.b.served>=2',timeout=60000)
 page.get_by_role('button',name='Serve a table',exact=True).click()
 page.wait_for_function('__cafe.game.s.coins>=70',timeout=30000)
 page.get_by_role('button',name='Upgrade',exact=True).click()
 page.screenshot(path=str(out/'04-upgrade.png'))
 # A real affordable upgrade must persist through language changes and reloads.
 page.locator('[data-buy="table"]').click()
 state=page.evaluate('({coins:__cafe.game.s.coins,tables:__cafe.game.b.level.table,served:__cafe.game.b.served})')
 assert state['tables']==2,state
 page.get_by_role('button',name='Close',exact=True).click()
 page.get_by_role('button',name='Settings',exact=True).click()
 page.get_by_role('button',name='Türkçe',exact=True).click()
 assert page.locator('html').get_attribute('lang')=='tr'
 assert page.get_by_role('heading',name='Ayarlar',exact=True).is_visible()
 assert page.evaluate('__cafe.started')
 assert page.evaluate('__cafe.game.b.level.table')==2
 page.screenshot(path=str(out/'05-turkish-settings.png'))
 page.reload(wait_until='networkidle')
 assert page.locator('html').get_attribute('lang')=='tr'
 assert page.get_by_role('button',name='Oyna',exact=True).is_visible()
 assert page.evaluate('__cafe.game.b.level.table')==2
 page.get_by_role('button',name='English',exact=True).click()
 assert page.get_by_role('button',name='Open my café',exact=True).is_visible()
 assert page.locator('html').get_attribute('lang')=='en'
 assert page.evaluate('__cafe.game.b.served')==state['served']
 print('LANGUAGE_SAVE',state)
 page.get_by_role('button',name='Open my café',exact=True).click()
 page.get_by_role('button',name='A little optional boost',exact=True).click()
 before_ad=page.evaluate('__cafe.game.s.coins')
 page.get_by_role('button',name='Watch ad · Investment boost',exact=True).click()
 page.wait_for_function('__cafe.modal==="reward" && document.querySelector("#toast").textContent.includes("Android")')
 assert page.evaluate('__cafe.game.s.coins')==before_ad
 page.get_by_role('button',name='Close',exact=True).click()
 assert page.evaluate('__cafe.modal')==''
 assert not page.locator('.gear').evaluate('(el)=>el.inert || el.closest("[inert]")!==null')
 print('WEB_AD_FALLBACK','no reward, dismisses, controls restored')
 print('ERRORS',errors)
 assert not errors,errors
 browser.close()
