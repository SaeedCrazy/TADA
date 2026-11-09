import sys
from playwright.sync_api import sync_playwright
from PIL import Image
W, H = int(sys.argv[1]), int(sys.argv[2])
O = r'C:/Users/SAEED/AppData/Local/Temp/claude/29abb69cf93759cc/2d2b5d55-f9ae-46fd-a4b7-9159d8fce938/scratchpad/ride_%d_' % W
GATE = "!document.querySelector('#ldGate') || document.querySelector('#ldGate').classList.contains('is-waiting')"
with sync_playwright() as p:
    b = p.chromium.launch(); ctx = b.new_context(viewport={'width': W, 'height': H}, is_mobile=W < 768, has_touch=W < 768); ctx.add_init_script("sessionStorage.setItem('tada.intro','1')")
    pg = ctx.new_page(); errs = []; pg.on('pageerror', lambda e: errs.append(str(e)[:200]))
    pg.goto('http://127.0.0.1:8090/'); pg.wait_for_function(GATE, timeout=30000)
    if pg.query_selector('#ldGate'): pg.mouse.click(W // 2, H // 2)
    pg.wait_for_function('window.__tada && window.__tada.chains.length > 5', timeout=40000); pg.wait_for_timeout(800)
    st = pg.evaluate("(() => { const t = ScrollTrigger.getAll().filter(t => t.vars.pin && t.trigger && t.trigger.id === 'road')[0]; return t ? [Math.round(t.start), Math.round(t.end)] : null; })()")
    print('ride pin', st, '--ink-w', pg.evaluate("getComputedStyle(document.documentElement).getPropertyValue('--ink-w')"))
    a, e = st
    shots, xs = [], []
    # walk in through the order section, then along the ride
    for y in range(a - H, a, 120): pg.evaluate(f'window.scrollTo(0,{y})'); pg.wait_for_timeout(120)
    for i in range(7):
        y = int(a + (e - a) * i / 6)
        pg.evaluate(f'window.scrollTo(0,{y})'); pg.wait_for_timeout(1900)
        xs.append(pg.evaluate("Math.round(gsap.getProperty(document.querySelector('.art-scooter'), 'x'))"))
        f = O + f'{i}.png'; pg.screenshot(path=f); shots.append(f)
    print('scooter x along the ride:', xs, errs or 'no errors')
    ims = [Image.open(f).resize((W // 3, H // 3)) for f in shots]
    sh = Image.new('RGB', ((W // 3 + 6) * 4, (H // 3 + 6) * 2), 'white')
    for i, im in enumerate(ims): sh.paste(im, ((i % 4) * (W // 3 + 6), (i // 4) * (H // 3 + 6)))
    sh.save(O + 'sheet.png'); b.close()
