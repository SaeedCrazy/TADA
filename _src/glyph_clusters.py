# Cluster the alphabet sheet's strokes into glyphs and draw a labelled contact sheet per row.
import pymupdf, json, sys
from PIL import Image, ImageDraw, ImageFont
SRC = r'C:/Users/SAEED/Downloads/TADA/GRAPHIC DESIGN/tada alphabet.pdf'
OUT = r'C:/Users/SAEED/AppData/Local/Temp/claude/29abb69cf93759cc/2d2b5d55-f9ae-46fd-a4b7-9159d8fce938/scratchpad/gd/'
d = pymupdf.open(SRC); p = d[0]
dr = p.get_drawings()
ROWS = [(380, 1050), (1050, 1600), (1600, 2150), (2150, 2800)]
GAP = float(sys.argv[1]) if len(sys.argv) > 1 else 18
clusters = []
for ri, (y0, y1) in enumerate(ROWS):
    items = [i for i, x in enumerate(dr) if y0 <= (x['rect'].y0 + x['rect'].y1) / 2 < y1]
    items.sort(key=lambda i: dr[i]['rect'].x0)
    cur = None
    for i in items:
        r = dr[i]['rect']
        if cur and r.x0 <= cur['x1'] + GAP:
            cur['ids'].append(i); cur['x1'] = max(cur['x1'], r.x1)
        else:
            cur = {'row': ri, 'ids': [i], 'x0': r.x0, 'x1': r.x1}; clusters.append(cur)
for c in clusters:
    rr = pymupdf.Rect(dr[c['ids'][0]]['rect'])
    for i in c['ids']: rr |= dr[i]['rect']
    c['bbox'] = [round(v, 1) for v in rr]
json.dump(clusters, open(OUT + 'clusters.json', 'w'))
print(len(clusters), 'clusters', [sum(1 for c in clusters if c['row'] == r) for r in range(4)])
# contact sheet: each cluster rendered in a cell with its index, ordered right-to-left per row
font = ImageFont.load_default()
for ri in range(4):
    cs = [(k, c) for k, c in enumerate(clusters) if c['row'] == ri]
    cs.sort(key=lambda kc: -kc[1]['x0'])
    cw, chh, per = 170, 190, 12
    rows = (len(cs) + per - 1) // per
    sheet = Image.new('RGB', (cw * per, chh * rows), 'white'); dw = ImageDraw.Draw(sheet)
    y0, y1 = ROWS[ri]
    for n, (k, c) in enumerate(cs):
        x0, x1 = c['x0'] - 30, c['x1'] + 30
        clip = pymupdf.Rect(x0, y0, x1, y1)
        z = min((cw - 10) / clip.width, (chh - 30) / clip.height)
        pix = p.get_pixmap(matrix=pymupdf.Matrix(z, z), clip=clip, alpha=False)
        im = Image.frombytes('RGB', (pix.width, pix.height), pix.samples)
        col, row = per - 1 - (n % per), n // per   # right to left
        sheet.paste(im, (col * cw + 5, row * chh + 25))
        dw.rectangle([col * cw, row * chh, col * cw + cw - 1, row * chh + chh - 1], outline=(220, 220, 220))
        dw.text((col * cw + 6, row * chh + 4), str(k), fill=(200, 0, 0), font=font)
    sheet.save(OUT + f'cs_row{ri}.png')
