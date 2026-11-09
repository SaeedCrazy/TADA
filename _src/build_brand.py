# Favicon, home-screen icon and link-preview image, from the designer's door and hand.
import json, re, pathlib
from playwright.sync_api import sync_playwright
ROOT = pathlib.Path(r'C:/Users/SAEED/Downloads/TADA/TADA SITE FINAL')
src = (ROOT / 'js/art-data.js').read_text(encoding='utf-8')
ART = json.loads(src[src.index('{'):src.rindex('}') + 1])
NIGHT, CREAM = '#1C0727', '#F6F0F8'
H = ART['hand']
hand = ''.join(f'<path d="{d}"/>' for d, k, *_ in H['p'])
pad = 70
vb = f'{-pad} {-pad} {H["vb"][2] + 2 * pad} {H["vb"][3] + 2 * pad}'
side = max(H['vb'][2], H['vb'][3]) + 2 * pad
cx, cy = H['vb'][2] / 2, H['vb'][3] / 2
sq = f'{cx - side / 2:.1f} {cy - side / 2:.1f} {side:.1f} {side:.1f}'
fav = (f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="{sq}">'
       f'<rect x="{cx - side / 2:.1f}" y="{cy - side / 2:.1f}" width="{side:.1f}" height="{side:.1f}" rx="{side * 0.22:.1f}" fill="{NIGHT}"/>'
       f'<g fill="{CREAM}">{hand}</g></svg>')
(ROOT / 'assets/brand').mkdir(parents=True, exist_ok=True)
(ROOT / 'assets/brand/favicon.svg').write_text(fav, encoding='utf-8')

# the door with the hand and the wordmarks, as on the glass
A, F, E = ART['arch'], ART['wordFa'], ART['wordEn']
off = lambda p: f'translate({p["at"][0] - A["at"][0]:.1f} {p["at"][1] - A["at"][1]:.1f})'
arch_d = 'M9.8 1718.2V710.9C9.8 323.7 306.8 9.8 673.1 9.8C1039.4 9.8 1336.3 323.7 1336.3 710.9L1342.9 1718.2H9.8'
words = ''.join(f'<path d="{d}" stroke-width="{9.85 * (w[0] if w else 1):.2f}"/>' for d, k, *w in F['p'])
wordsE = ''.join(f'<path d="{d}" stroke-width="{9.85 * (w[0] if w else 1):.2f}"/>' for d, k, *w in E['p'])
door = (f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="{" ".join(map(str, A["vb"]))}" style="height:100%;overflow:visible">'
        f'<path d="{arch_d}" fill="none" stroke="{CREAM}" stroke-width="9.85"/>'
        f'<g transform="{off(H)}" fill="{CREAM}">{hand}</g>'
        f'<g transform="{off(F)}" fill="none" stroke="{CREAM}">{words}</g><g transform="{off(E)}" fill="none" stroke="{CREAM}">{wordsE}</g></svg>')
T = ART['tagline']
tag = ''.join((f'<path d="{d}" fill="{CREAM}"/>' if k else f'<path d="{d}" fill="none" stroke="{CREAM}" stroke-width="{9.85 * (w[0] if w else 1):.2f}"/>') for d, k, *w in T['p'])
tagline = f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="{" ".join(map(str, T["vb"]))}" style="width:100%">{tag}</svg>'
og = f'''<!doctype html><html><body style="margin:0;width:1200px;height:630px;background:{NIGHT};display:flex;align-items:center;justify-content:center;gap:90px;overflow:hidden">
<div style="height:500px">{door}</div></body></html>'''
icon = f'''<!doctype html><html><body style="margin:0;width:180px;height:180px;background:{NIGHT};display:grid;place-items:center">
<svg viewBox="{vb}" style="height:150px">{hand.replace('<path', f'<path fill="{CREAM}"')}</svg></body></html>'''
tmp = ROOT / '_src/_tmp.html'
with sync_playwright() as p:
    b = p.chromium.launch()
    for html, size, out in ((og, (1200, 630), 'og-image.png'), (icon, (180, 180), 'apple-touch-icon.png')):
        tmp.write_text(html, encoding='utf-8')
        pg = b.new_page(viewport={'width': size[0], 'height': size[1]})
        pg.goto(tmp.as_uri()); pg.wait_for_timeout(300)
        pg.screenshot(path=str(ROOT / 'assets/brand' / out)); pg.close()
    b.close()
tmp.unlink()
print('brand ok')
