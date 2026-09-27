"""Capture playable room composition and district changes from an explicit QA save."""
import json,pathlib,os
from playwright.sync_api import sync_playwright
out=pathlib.Path(os.environ.get('CAFE_PLAYTEST_OUTPUT','artifacts'));out.mkdir(exist_ok=True);fixture=json.loads(pathlib.Path('artifacts/qa/chain-save.json').read_text())
with sync_playwright() as p:
 browser=p.chromium.launch(headless=True,args=['--no-sandbox','--enable-unsafe-swiftshader'])
 page=browser.new_page(viewport={'width':390,'height':844},is_mobile=True,has_touch=True)
 errors=[]
 page.on('pageerror',lambda e:errors.append(str(e)))
 page.on('console',lambda m:errors.append(m.text) if m.type=='error' else None)
 page.on('response',lambda r:errors.append(f'HTTP {r.status}: {r.url}') if r.status>=400 else None)
 fixture['active']=0
 page.add_init_script('const seed='+json.dumps(fixture)+';seed.savedAt=Date.now();localStorage.setItem("minik-mola.save.v1",JSON.stringify(seed));')
 page.goto(os.environ.get('CAFE_TEST_URL','http://127.0.0.1:4174'),wait_until='networkidle')
 page.get_by_role('button',name='Open my café',exact=True).click()
 stats=[]
 for branch in [0,1,2]:
  if branch:
   page.locator('.bottom [data-panel="branches"]').click();page.locator(f'[data-branch="{branch}"]').click()
  page.wait_for_function(f'__cafe.scene.districts[{branch}].visible')
  page.wait_for_timeout(1500)
  page.screenshot(path=str(out/f'visual-district-{branch}.png'))
  info=page.evaluate('''(()=>{const s=__cafe.scene,g=__cafe.game;return {branch:g.s.active,visibleThemes:s.districts.filter(v=>v.visible).map(v=>v.name),calls:s.renderer.info.render.calls,triangles:s.renderer.info.render.triangles,geometries:s.renderer.info.memory.geometries,textures:s.renderer.info.memory.textures,player:s.project(g.s.player,1),machine:s.project({x:-1.25,z:-2.85},1),storage:s.project({x:-2.7,z:2.45},.3),tables:s.tableGroups.filter(v=>v.visible).length,workers:Object.keys(g.b.workers).length};})()''')
  assert len(info['visibleThemes'])==1,info
  assert info['tables']==[3,4,4][branch],info
  for target in ['machine','storage']:
   assert 0<=info[target]['x']<=390 and 120<=info[target]['y']<=690,(target,info)
  stats.append(info)
 # Return across the same rooms: resources must not be rebuilt on every visit.
 before=stats[-1]
 page.locator('.bottom [data-panel="branches"]').click();page.locator('[data-branch="0"]').click()
 page.wait_for_function('__cafe.scene.districts[0].visible')
 after=page.evaluate('({geometries:__cafe.scene.renderer.info.memory.geometries,textures:__cafe.scene.renderer.info.memory.textures})')
 assert after['textures']<=before['textures']+1,(before,after)
 assert not errors,errors
 (out/'visual-evidence.json').write_text(json.dumps({'scenario':'bot-earned QA save; not store or new-player evidence','stats':stats,'afterReturn':after,'errors':errors},indent=2))
 print('VISUAL',json.dumps(stats),'errors',errors)
 browser.close()
