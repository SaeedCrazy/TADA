from playwright.sync_api import sync_playwright
O = r'C:/Users/SAEED/AppData/Local/Temp/claude/29abb69cf93759cc/2d2b5d55-f9ae-46fd-a4b7-9159d8fce938/scratchpad/gp_'
with sync_playwright() as p:
    b = p.chromium.launch(); ctx = b.new_context(viewport={'width': 390, 'height': 844}, is_mobile=True, has_touch=True); pg = ctx.new_page(); errs = []
    pg.on('pageerror', lambda e: errs.append(str(e)))
    pg.goto('http://127.0.0.1:8090/'); pg.wait_for_function('window.__tada && window.__tada.chains.length > 5', timeout=30000); pg.wait_for_timeout(500)
    y = pg.evaluate("document.querySelector('#branches').getBoundingClientRect().bottom + scrollY - 844")
    for i, dy in enumerate((0, 300)):
        pg.evaluate(f'window.scrollTo(0,{int(y + dy)})'); pg.wait_for_timeout(2600); pg.screenshot(path=O + f'br{i}.png')
    total = pg.evaluate('document.documentElement.scrollHeight') - 844
    pg.evaluate(f'window.scrollTo(0,{total - 300})'); pg.wait_for_timeout(3000); pg.screenshot(path=O + 'glass.png')
    print(pg.evaluate("window.__tada.chains.map(c => +c.p.toFixed(2))"), errs or 'no errors')
    b.close()
