import pymupdf, json, sys
from PIL import Image, ImageDraw, ImageFont
SRC = r'C:/Users/SAEED/Downloads/TADA/GRAPHIC DESIGN/tada alphabet.pdf'
OUT = r'C:/Users/SAEED/AppData/Local/Temp/claude/29abb69cf93759cc/2d2b5d55-f9ae-46fd-a4b7-9159d8fce938/scratchpad/gd/'
d = pymupdf.open(SRC); p = d[0]
cl = json.load(open(OUT + 'clusters.json'))
ROWS = [(380, 1050), (1050, 1600), (1600, 2150), (2150, 2800)]
ids = [int(a) for a in sys.argv[2].split(',')]
name = sys.argv[1]
cw, chh, per = 330, 300, 6
font = ImageFont.load_default()
n_rows = (len(ids) + per - 1) // per
sheet = Image.new('RGB', (cw * per, chh * n_rows), 'white'); dw = ImageDraw.Draw(sheet)
for n, k in enumerate(ids):
    c = cl[k]; y0, y1 = ROWS[c['row']]
    clip = pymupdf.Rect(c['x0'] - 40, y0 + 150, c['x1'] + 40, y1 - 40)
    z = min((cw - 10) / clip.width, (chh - 30) / clip.height, 0.9)
    pix = p.get_pixmap(matrix=pymupdf.Matrix(z, z), clip=clip, alpha=False)
    im = Image.frombytes('RGB', (pix.width, pix.height), pix.samples)
    col, row = per - 1 - (n % per), n // per
    ox, oy = col * cw + 5, row * chh + 25
    sheet.paste(im, (ox, oy))
    # glyph bbox edges in blue
    bx0 = ox + (c['bbox'][0] - clip.x0) * z; bx1 = ox + (c['bbox'][2] - clip.x0) * z
    dw.line([bx0, oy, bx0, oy + im.height], fill=(120, 160, 255)); dw.line([bx1, oy, bx1, oy + im.height], fill=(120, 160, 255))
    dw.rectangle([col * cw, row * chh, col * cw + cw - 1, row * chh + chh - 1], outline=(220, 220, 220))
    dw.text((col * cw + 6, row * chh + 4), f'{k}  w={c["bbox"][2]-c["bbox"][0]:.0f}', fill=(200, 0, 0), font=font)
sheet.save(OUT + f'big_{name}.png')
