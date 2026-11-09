# Quality pass: overflow, reverse scroll, menu snap, language switch, reduced motion, phone performance.
import sys, json
from playwright.sync_api import sync_playwright
URL = 'http://127.0.0.1:8090/'
O = r'C:/Users/SAEED/AppData/Local/Temp/claude/29abb69cf93759cc/2d2b5d55-f9ae-46fd-a4b7-9159d8fce938/scratchpad/qa_'
READY = 'window.__tada && window.__tada.chains.length > 5'


def page(b, W, H, reduce=False, lang='fa'):
    ctx = b.new_context(viewport={'width': W, 'height': H}, is_mobile=W < 768, has_touch=W < 768, reduced_motion='reduce' if reduce else 'no-preference')
    pg = ctx.new_page(); errs = []
    pg.on('pageerror', lambda e: errs.append('PAGEERROR ' + str(e)[:300]))
    pg.on('console', lambda m: errs.append('CONSOLE ' + m.text[:200]) if m.type == 'error' else None)
    pg.add_init_script(f"try{{localStorage.setItem('tada.lang','{lang}')}}catch(e){{}}")
    pg.goto(URL); pg.wait_for_function(READY, timeout=30000); pg.wait_for_timeout(600)
    return ctx, pg, errs


STATE = """(() => { const c = window.__tada.chains; const ps = c.map(x => +x.p.toFixed(3));
  const k = ps.findIndex(p => p < 1); const ok = ps.every((p, i) => (k < 0) || (i < k ? p === 1 : i > k ? p === 0 : true));
  return { ps, ok, sw: document.documentElement.scrollWidth, cw: document.documentElement.clientWidth }; })()"""

with sync_playwright() as p:
    b = p.chromium.launch()
    # 1. overflow + reverse scroll, phone and desktop
    for W, H in ((390, 844), (1440, 900), (768, 1024)):
        ctx, pg, errs = page(b, W, H)
        total = pg.evaluate('document.documentElement.scrollHeight') - H
        bad, over = 0, 0
        ys = [int(total * i / 16) for i in range(17)]
        for y in ys + ys[::-1]:
            pg.evaluate(f'window.scrollTo(0,{y})'); pg.wait_for_timeout(700)
            s = pg.evaluate(STATE)
            bad += 0 if s['ok'] else 1
            over += 1 if s['sw'] > s['cw'] else 0
        pg.evaluate('window.scrollTo(0,0)'); pg.wait_for_timeout(3000)
        s = pg.evaluate(STATE)
        print(f'{W}x{H}: broken states {bad}, overflow frames {over}, back at top ps {s["ps"][:3]}', errs or 'no errors')
        ctx.close()
    # 2. menu snap (desktop): stop half way between two flavors, it settles on one
    ctx, pg, errs = page(b, 1440, 900)
    pg.evaluate("document.querySelector('#menu').scrollIntoView()"); pg.wait_for_timeout(1500)
    st = pg.evaluate("ScrollTrigger.getAll().filter(t => t.vars.pin).map(t => [Math.round(t.start), Math.round(t.end)])[0]")
    a, e = st; n = 5; step = (e - a) / (n - 1)
    pg.evaluate(f'window.scrollTo(0,{int(a + step * 1.45)})'); pg.wait_for_timeout(2600)
    y = pg.evaluate('scrollY'); snaps = [round(a + step * i) for i in range(n)]
    front = pg.evaluate("[...document.querySelectorAll('#menuTrack .card')].findIndex(c => c.classList.contains('is-front'))")
    print('menu snap: rest', y, 'snaps', snaps, 'nearest', min(abs(y - s) for s in snaps), 'front', front)
    # arrows and keys
    pg.keyboard.press('ArrowLeft'); pg.wait_for_timeout(1800)
    front2 = pg.evaluate("[...document.querySelectorAll('#menuTrack .card')].findIndex(c => c.classList.contains('is-front'))")
    print('after ArrowLeft (fa: next) front', front2, errs or 'no errors')
    # 3. language switch mid-page
    pg.evaluate('window.scrollTo(0, document.querySelector("#branches").getBoundingClientRect().top + scrollY)'); pg.wait_for_timeout(2000)
    pg.click('#langToggle'); pg.wait_for_timeout(2500)
    s = pg.evaluate(STATE)
    print('lang switch: lang', pg.evaluate('document.documentElement.lang'), 'ok', s['ok'], 'ps', s['ps'], errs or 'no errors')
    pg.screenshot(path=O + 'lang.png')
    ctx.close()
    # 4. reduced motion
    ctx, pg, errs = page(b, 390, 844, reduce=True)
    waiting = pg.evaluate("document.querySelectorAll('.is-waiting').length")
    pg.screenshot(path=O + 'reduce_top.png')
    pg.evaluate("document.querySelector('#bar').scrollIntoView()"); pg.wait_for_timeout(400); pg.screenshot(path=O + 'reduce_bar.png')
    print('reduced motion: waiting', waiting, 'chains', pg.evaluate("window.__tada.chains.map(c => c.p)"), errs or 'no errors')
    ctx.close()
    # 5. phone performance under a 4x slower CPU
    ctx, pg, errs = page(b, 390, 844)
    cdp = ctx.new_cdp_session(pg); cdp.send('Emulation.setCPUThrottlingRate', {'rate': 4})
    pg.evaluate("""window.__ft = []; (function f(t){ if (window.__last) window.__ft.push(t - window.__last); window.__last = t; if (window.__ft.length < 2000) requestAnimationFrame(f); })(performance.now())""")
    total = pg.evaluate('document.documentElement.scrollHeight') - 844
    for i in range(1, 60):
        pg.mouse.wheel(0, 0)
        pg.evaluate(f'window.scrollTo(0,{int(total * i / 60)})'); pg.wait_for_timeout(120)
    pg.wait_for_timeout(1500)
    ft = pg.evaluate('window.__ft.slice(5)')
    ft.sort()
    avg = sum(ft) / len(ft)
    print(f'phone 4x CPU: frames {len(ft)}, avg {avg:.1f} ms, p95 {ft[int(len(ft) * 0.95)]:.1f} ms', errs or 'no errors')
    ctx.close()
    b.close()
