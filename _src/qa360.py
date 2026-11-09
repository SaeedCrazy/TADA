from playwright.sync_api import sync_playwright
O = r'C:/Users/SAEED/AppData/Local/Temp/claude/29abb69cf93759cc/2d2b5d55-f9ae-46fd-a4b7-9159d8fce938/scratchpad/q360_'
with sync_playwright() as p:
    b = p.chromium.launch(); ctx = b.new_context(viewport={'width': 360, 'height': 740}, is_mobile=True, has_touch=True); pg = ctx.new_page(); errs = []
    pg.on('pageerror', lambda e: errs.append(str(e)))
    pg.add_init_script("sessionStorage.setItem('tada.intro','1')")
    pg.goto('http://127.0.0.1:8090/')
    pg.wait_for_function("!document.querySelector('#ldGate') || document.querySelector('#ldGate').classList.contains('is-waiting')", timeout=30000)
    if pg.query_selector('#ldGate'): pg.tap('#ldGate')
    pg.wait_for_function('window.__tada && window.__tada.chains.length > 5', timeout=40000); pg.wait_for_timeout(900)
    # every written headline and every art fits inside the screen
    print(pg.evaluate("""[...document.querySelectorAll('svg.tt, svg.art, .btn, .card, .row, .hours-card')].filter(e => !e.closest('#menuTrack')).map(e => { const r = e.getBoundingClientRect(); return [e.closest('[id]').id + ' ' + (e.getAttribute('class')||''), Math.round(r.left), Math.round(r.right)]; }).filter(a => a[1] < 0 || a[2] > 360)"""))
    pg.tap('#menuBtn'); pg.wait_for_timeout(800)
    print('menu open', pg.evaluate("!document.querySelector('#mMenu').hidden"), pg.evaluate("document.activeElement.className"))
    pg.screenshot(path=O + 'menu.png')
    pg.tap('.mmenu-links a[href="#branches"]'); pg.wait_for_timeout(2500)
    print('menu closed', pg.evaluate("document.querySelector('#mMenu').hidden"), 'branches top', pg.evaluate("Math.round(document.querySelector('#branches').getBoundingClientRect().top)"))
    pg.screenshot(path=O + 'branches.png')
    # a sideways swipe in the menu moves one flavor
    pg.evaluate("window.scrollTo(0, ScrollTrigger.getAll().find(t => t.vars.pin).start + 2)"); pg.wait_for_timeout(1800)
    f0 = pg.evaluate("[...document.querySelectorAll('#menuTrack .card')].findIndex(c => c.classList.contains('is-front'))")
    cdp = ctx.new_cdp_session(pg)
    def swipe(x0, x1, y):
        cdp.send('Input.dispatchTouchEvent', {'type': 'touchStart', 'touchPoints': [{'x': x0, 'y': y}]})
        for i in range(1, 9): cdp.send('Input.dispatchTouchEvent', {'type': 'touchMove', 'touchPoints': [{'x': x0 + (x1 - x0) * i / 8, 'y': y}]})
        cdp.send('Input.dispatchTouchEvent', {'type': 'touchEnd', 'touchPoints': []})
    swipe(100, 300, 500); pg.wait_for_timeout(1800)
    f1 = pg.evaluate("[...document.querySelectorAll('#menuTrack .card')].findIndex(c => c.classList.contains('is-front'))")
    pg.screenshot(path=O + 'swipe.png')
    print('swipe right (fa: next):', f0, '->', f1, errs or 'no errors')
    b.close()
