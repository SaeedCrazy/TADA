import sys, os
from playwright.sync_api import sync_playwright
from PIL import Image
W, H = int(sys.argv[1]), int(sys.argv[2])
O = r'C:/Users/SAEED/AppData/Local/Temp/claude/29abb69cf93759cc/2d2b5d55-f9ae-46fd-a4b7-9159d8fce938/scratchpad/end_%d/' % W
os.makedirs(O, exist_ok=True)
GATE = "!document.querySelector('#ldGate') || document.querySelector('#ldGate').classList.contains('is-waiting')"
with sync_playwright() as p:
    b = p.chromium.launch(); ctx = b.new_context(viewport={'width': W, 'height': H}, is_mobile=W < 768, has_touch=W < 768)
    ctx.add_init_script("sessionStorage.setItem('tada.intro','1')")
    pg = ctx.new_page(); errs = []; pg.on('pageerror', lambda e: errs.append(str(e)[:200]))
    pg.goto('http://127.0.0.1:8090/'); pg.wait_for_function(GATE, timeout=30000)
    if pg.query_selector('#ldGate'): pg.mouse.click(W // 2, H // 2)
    pg.wait_for_function('window.__tada && window.__tada.chains.length > 5', timeout=40000); pg.wait_for_timeout(800)
    total = pg.evaluate('document.documentElement.scrollHeight') - H
    gtop = pg.evaluate("document.querySelector('#glass').getBoundingClientRect().top + scrollY")
    shots = []
    for i, y in enumerate([int(gtop - H * 0.7 + (total - gtop + H * 0.7) * k / 7) for k in range(8)]):
        pg.evaluate(f'window.scrollTo(0,{min(total, y)})'); pg.wait_for_timeout(2300 if i < 7 else 3200)
        f = O + f'e{i}.png'; pg.screenshot(path=f); shots.append(f)
    print('glass p', pg.evaluate("window.__tada.chains.at(-1).p"), errs or 'no errors')
    ims = [Image.open(f).resize((W // 3, H // 3)) for f in shots]
    sh = Image.new('RGB', ((W // 3 + 6) * 4, (H // 3 + 6) * 2), 'white')
    for i, im in enumerate(ims): sh.paste(im, ((i % 4) * (W // 3 + 6), (i // 4) * (H // 3 + 6)))
    sh.save(O + 'sheet.png')
    b.close()
