# Walk the page: through the gate and the loader (frames along the way), then down in steps.
# usage: python walk.py URL OUTDIR [W H] [lang] [steps] [loaderframes]
import sys, os
from playwright.sync_api import sync_playwright
url, out = sys.argv[1], sys.argv[2]
W = int(sys.argv[3]) if len(sys.argv) > 3 else 1440
H = int(sys.argv[4]) if len(sys.argv) > 4 else 900
lang = sys.argv[5] if len(sys.argv) > 5 else 'fa'
n = int(sys.argv[6]) if len(sys.argv) > 6 else 14
lf = int(sys.argv[7]) if len(sys.argv) > 7 else 0
os.makedirs(out, exist_ok=True)
mobile = W < 768
GATE = "!document.querySelector('#ldGate') || document.querySelector('#ldGate').classList.contains('is-waiting')"
with sync_playwright() as p:
    b = p.chromium.launch()
    ctx = b.new_context(viewport={'width': W, 'height': H}, device_scale_factor=1, is_mobile=mobile, has_touch=mobile)
    pg = ctx.new_page(); errs = []
    pg.on('pageerror', lambda e: errs.append('PAGEERROR ' + str(e)[:300]))
    pg.on('console', lambda m: errs.append('CONSOLE ' + m.text[:300]) if m.type in ('error', 'warning') else None)
    pg.add_init_script(f"try{{localStorage.setItem('tada.lang','{lang}')}}catch(e){{}}")
    pg.goto(url)
    pg.wait_for_function(GATE, timeout=30000)
    if pg.query_selector('#ldGate'):
        pg.screenshot(path=f'{out}/a0_gate.png')
        if mobile: pg.tap('#ldGate')
        else: pg.mouse.click(W // 2, H // 2)
    for i in range(lf):
        pg.wait_for_timeout(700); pg.screenshot(path=f'{out}/l{i:02d}.png')
    pg.wait_for_function('window.__tada && window.__tada.chains.length > 5', timeout=40000)
    pg.wait_for_timeout(2600); pg.screenshot(path=f'{out}/a2_door_done.png')
    total = pg.evaluate('document.documentElement.scrollHeight')
    print('scrollHeight', total, 'chains', pg.evaluate('window.__tada.chains.map(c => c.name + ":" + c.links.length)'))
    for i in range(1, n + 1):
        y = int((total - H) * i / n)
        pg.evaluate(f'window.scrollTo(0, {y})')
        pg.wait_for_timeout(2800)
        pg.screenshot(path=f'{out}/s{i:02d}.png')
    print('\n'.join(errs) if errs else 'no errors')
    b.close()
