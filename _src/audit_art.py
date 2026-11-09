# Every art piece next to the same box of the original glass, for a by-eye check.
import json, re, pathlib, sys, pymupdf
from PIL import Image, ImageDraw, ImageFont
ROOT = pathlib.Path(r'C:/Users/SAEED/Downloads/TADA/TADA SITE FINAL')
OUT = r'C:/Users/SAEED/AppData/Local/Temp/claude/29abb69cf93759cc/2d2b5d55-f9ae-46fd-a4b7-9159d8fce938/scratchpad/audit_'
page = pymupdf.open(r'C:/Users/SAEED/Downloads/TADA/GRAPHIC DESIGN/outside glass tada big one1.ai')[0]
src = (ROOT / 'js/art-data.js').read_text(encoding='utf-8'); ART = json.loads(src[src.index('{'):src.rindex('}') + 1])
names = sys.argv[1].split(',') if len(sys.argv) > 1 else list(ART)
from playwright.sync_api import sync_playwright
cells = []
with sync_playwright() as pw:
    b = pw.chromium.launch(); pg = b.new_page(viewport={'width': 300, 'height': 300})
    for n in names:
        a = ART[n]; x0, y0 = a['at']; w, h = a['vb'][2], a['vb'][3]
        pad = 40
        clip = pymupdf.Rect(x0 - pad, y0 - pad, x0 + w + pad, y0 + h + pad)
        z = 280 / max(clip.width, clip.height)
        pix = page.get_pixmap(matrix=pymupdf.Matrix(z, z), clip=clip, alpha=False)
        orig = Image.frombytes('RGB', (pix.width, pix.height), pix.samples)
        paths = ''.join(f'<path d="{d}" fill="#fff"/>' if k else f'<path d="{d}" fill="none" stroke="#fff" stroke-width="{9.85 * (wf[0] if wf else 1)}"/>' for d, k, *wf in a['p'])
        html = f'<body style="margin:0;background:#666"><svg viewBox="{-pad} {-pad} {w + 2 * pad} {h + 2 * pad}" width="{clip.width * z}" height="{clip.height * z}">{paths}</svg></body>'
        pg.set_content(html); pg.set_viewport_size({'width': max(10, int(clip.width * z)), 'height': max(10, int(clip.height * z))}); pg.wait_for_timeout(60)
        f = OUT + '_tmp.png'; pg.screenshot(path=f); mine = Image.open(f).convert('RGB')
        cell = Image.new('RGB', (600, 310), 'white'); cell.paste(orig, (0, 22)); cell.paste(mine, (300, 22))
        ImageDraw.Draw(cell).text((4, 4), f'{n}  original | extracted', fill=(200, 0, 0))
        cells.append(cell)
    b.close()
per = 3
for k in range(0, len(cells), per * 4):
    chunk = cells[k:k + per * 4]
    sheet = Image.new('RGB', (600 * per, 310 * ((len(chunk) + per - 1) // per)), 'white')
    for i, c in enumerate(chunk): sheet.paste(c, ((i % per) * 600, (i // per) * 310))
    sheet.save(OUT + f'{k // (per * 4)}.png')
print('sheets', (len(cells) + per * 4 - 1) // (per * 4))
