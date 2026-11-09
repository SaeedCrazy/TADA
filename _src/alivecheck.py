from playwright.sync_api import sync_playwright
from PIL import Image, ImageChops
O = r'C:/Users/SAEED/AppData/Local/Temp/claude/29abb69cf93759cc/2d2b5d55-f9ae-46fd-a4b7-9159d8fce938/scratchpad/alive_'
GATE = "!document.querySelector('#ldGate') || document.querySelector('#ldGate').classList.contains('is-waiting')"
with sync_playwright() as p:
    b = p.chromium.launch(); ctx = b.new_context(viewport={'width': 1440, 'height': 900}); ctx.add_init_script("sessionStorage.setItem('tada.intro','1')")
    pg = ctx.new_page(); errs = []; pg.on('pageerror', lambda e: errs.append(str(e)[:200]))
    pg.goto('http://127.0.0.1:8090/'); pg.wait_for_function(GATE, timeout=30000)
    if pg.query_selector('#ldGate'): pg.mouse.click(720, 450)
    pg.wait_for_function('window.__tada && window.__tada.chains.length > 5', timeout=40000); pg.wait_for_timeout(600)
    def go(sel, off=0.35, wait=5200):
        y = pg.evaluate(f"document.querySelector('{sel}').getBoundingClientRect().top + scrollY - innerHeight * {off}")
        # walk there so the line passes every station on the way
        cur = pg.evaluate('scrollY')
        for k in range(1, 9): pg.evaluate(f'window.scrollTo(0,{int(cur + (y - cur) * k / 8)})'); pg.wait_for_timeout(350)
        pg.wait_for_timeout(wait)
    for name, sel, off in (('order', '#road', 0.6), ('morning', '#morning .art-col', 0.15), ('cup', '#menu', 0)):
        go(sel, off)
        if name == 'cup':
            pg.evaluate("window.scrollTo(0, ScrollTrigger.getAll().find(t => t.vars.pin).start + (ScrollTrigger.getAll().find(t => t.vars.pin).end - ScrollTrigger.getAll().find(t => t.vars.pin).start) * 0.5)"); pg.wait_for_timeout(5000)
        pg.screenshot(path=O + name + '_a.png'); pg.wait_for_timeout(450); pg.screenshot(path=O + name + '_b.png')
        a, c = Image.open(O + name + '_a.png').convert('L'), Image.open(O + name + '_b.png').convert('L')
        print(name, 'moving pixels', sum(1 for v in ImageChops.difference(a, c).getdata() if v > 30))
    print(errs or 'no errors'); b.close()
