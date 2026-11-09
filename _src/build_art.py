# The designer's mural (outside glass tada big one1.ai, centerline strokes) -> art pieces.
# js/art-data.js : named pieces, each { vb:[x,y,w,h], p:[[d, kind, wf], ...] }
#   kind 0 = stroke, 1 = fill; wf = stroke width / the mural's line (9.85)
# assets/art/mural.svg : the whole glass, for the ending.
import pymupdf, json, pathlib, sys
SRC = r'C:/Users/SAEED/Downloads/TADA/GRAPHIC DESIGN/outside glass tada big one1.ai'
ROOT = pathlib.Path(r'C:/Users/SAEED/Downloads/TADA/TADA SITE FINAL')
TMP = r'C:/Users/SAEED/AppData/Local/Temp/claude/29abb69cf93759cc/2d2b5d55-f9ae-46fd-a4b7-9159d8fce938/scratchpad/gd/'
page = pymupdf.open(SRC)[0]
DR = [d for d in page.get_drawings() if not (d['type'] == 'f' and d.get('fill') and d['fill'][0] < 0.5)]   # drop the grey glass
LINE = 9.85

# name: (x0, y0, x1, y1) in mural units; a drawing belongs to a piece when it lies inside
PIECES = {
    'hand':      (3740, 2240, 4250, 3020),
    'wordFa':    (3610, 3095, 4405, 3290),
    'wordEn':    (3610, 3400, 4410, 3590),
    'arch':      (3330, 2010, 4690, 3740),
    'tagline':   (1400, 2440, 3260, 2860),
    'title':     (4180, 210, 7900, 505),
    'lounge':    (4400, 515, 7900, 750),
    'insta':     (1340, 2940, 3260, 3262),
    'tadaIr':    (4990, 3260, 5770, 3430),
    'sun':       (1265, 1470, 2065, 2245),
    'kettle':    (150, 2040, 1110, 3070),
    'espresso':  (100, 3320, 1255, 4140),
    'glass':     (780, 3770, 1070, 4172),
    'grinder':   (470, 4290, 1110, 5625),
    'vine':      (110, 4290, 400, 5460),
    'leaf':      (130, 4520, 380, 4830),
    'coffeePath': (2420, 150, 3765, 1410),
    'citrus':    (290, 350, 1265, 1345),
    'pitaya':    (2170, 1410, 2730, 1970),
    'lemonArch': (2770, 1330, 3225, 2060),
    'cup':       (5275, 770, 6295, 1585),
    'hat':       (6800, 780, 7490, 1505),
    'wheat':     (4890, 780, 5305, 1505),
    'lemon':     (4490, 780, 4900, 1505),
    'music':     (4840, 1990, 7905, 2905),
    'notes':     (6600, 2020, 7905, 2430),
    'croissant': (2540, 3590, 2945, 4035),
    'biscuit':   (3040, 4040, 3340, 4270),
    'coffeeCup': (3290, 4140, 3620, 4530),
    'icedCup':   (3590, 4430, 3870, 4810),
    'glass2':    (4140, 4990, 4500, 5370),
    'cookie':    (3860, 4815, 4150, 5075),
    'teapot':    (5240, 4170, 5880, 5435),
    'scooter':   (6560, 3830, 7470, 4165),
    'palm':      (7340, 3370, 7925, 4115),
    'citrus3':   (6190, 4190, 7610, 4405),
    'cookies':   (4550, 4870, 5230, 5445),
    'pear':      (6140, 4470, 6690, 5130),
    'map':       (6490, 5205, 7865, 5625),
    'lozenge':   (3530, 3690, 4630, 3965),
    'dotRow':    (3540, 3955, 4530, 4065),
    'beans':     (3880, 1520, 4980, 1965),
}


def f1(v):
    r = round(v, 1)
    return str(int(r)) if r == int(r) else ('%.1f' % r)


def path_d(x, ox, oy):
    d, last = [], None
    for it in x['items']:
        k = it[0]
        if k == 're':
            r = it[1]
            d.append(f'M{f1(r.x0-ox)} {f1(r.y0-oy)}H{f1(r.x1-ox)}V{f1(r.y1-oy)}H{f1(r.x0-ox)}Z'); last = None; continue
        if k == 'qu':
            q = it[1]
            d.append('M' + 'L'.join(f'{f1(v.x-ox)} {f1(v.y-oy)}' for v in (q.ul, q.ur, q.lr, q.ll)) + 'Z'); last = None; continue
        a = it[1]
        if last is None or abs(last.x - a.x) > .05 or abs(last.y - a.y) > .05:
            d.append(f'M{f1(a.x-ox)} {f1(a.y-oy)}')
        if k == 'l':
            b = it[2]
            if abs(a.x - b.x) < .05: d.append(f'V{f1(b.y-oy)}')
            elif abs(a.y - b.y) < .05: d.append(f'H{f1(b.x-ox)}')
            else: d.append(f'L{f1(b.x-ox)} {f1(b.y-oy)}')
            last = b
        elif k == 'c':
            c1, c2, e = it[2], it[3], it[4]
            if abs(c1.x - a.x) < .05 and abs(c1.y - a.y) < .05 and abs(c2.x - e.x) < .05 and abs(c2.y - e.y) < .05:
                d.append(f'L{f1(e.x-ox)} {f1(e.y-oy)}')
            else:
                d.append(f'C{f1(c1.x-ox)} {f1(c1.y-oy)} {f1(c2.x-ox)} {f1(c2.y-oy)} {f1(e.x-ox)} {f1(e.y-oy)}')
            last = e
    if x.get('closePath'): d.append('Z')
    return ''.join(d)


def kind(x):
    return 1 if x['type'] in ('f', 'fs') else 0


def inside(r, box, tol=3):
    return r.x0 >= box[0] - tol and r.y0 >= box[1] - tol and r.x1 <= box[2] + tol and r.y1 <= box[3] + tol


art = {}
for name, box in PIECES.items():
    ds = [x for x in DR if inside(x['rect'], box)]
    if name == 'arch': ds = [x for x in ds if x['rect'].width > 1000]          # the door alone
    if name == 'coffeePath': ds = [x for x in ds if not (x['rect'].y0 > 950 and (x['rect'].width > 600 or x['rect'].x1 < 3300))]   # not the tart below
    if name == 'hand': ds.sort(key=lambda x: x['type'] != 'f')                 # sparkles first, then the hand
    if not ds:
        print('EMPTY', name); continue
    # the piece's own bounds (with half a line of air)
    x0 = min(x['rect'].x0 for x in ds) - LINE; y0 = min(x['rect'].y0 for x in ds) - LINE
    x1 = max(x['rect'].x1 for x in ds) + LINE; y1 = max(x['rect'].y1 for x in ds) + LINE
    # drawing order: top to bottom, then from the reading start (right)
    if name != 'hand': ds.sort(key=lambda x: (round((x['rect'].y0 + x['rect'].y1) / 2 / 40), -x['rect'].x1))
    ps = []
    for x in ds:
        w = x.get('width') or LINE
        wf = round(w / LINE, 2)
        item = [path_d(x, x0, y0), kind(x)]
        if kind(x) == 0 and abs(wf - 1) > 0.02: item.append(wf)
        ps.append(item)
    art[name] = {'vb': [0, 0, round(x1 - x0, 1), round(y1 - y0, 1)], 'at': [round(x0, 1), round(y0, 1)], 'p': ps}

import json as _j
_old = _j.load(open(r'C:/Users/SAEED/Downloads/TADA/هویت بصری/_work/hand_anim.json', encoding='utf-8'))
_h = art['hand']; _dx, _dy = 3481.7 - 4 - _h['at'][0], 2103.2 - 3 - _h['at'][1]
_h['mask'] = {'t': [round(_dx, 1), round(_dy, 1)], 'p': [s['d'] for s in _old['strokes']]}

js = ('// The Tada glass: pieces of the designer\'s mural (outside glass tada big one1.ai), as drawn.\n'
      '// Generated by _src/build_art.py. p = [d, kind (0 stroke, 1 fill), width factor?]; at = place on the glass.\n'
      'const TADA_ART = ' + json.dumps(art, ensure_ascii=False, separators=(',', ':')) + ';\n')
(ROOT / 'js').mkdir(exist_ok=True)
(ROOT / 'js/art-data.js').write_text(js, encoding='utf-8')
print('pieces', len(art), 'bytes', len(js.encode()))
for n, a in art.items():
    print(f'  {n:14s} paths {len(a["p"]):4d}  size {a["vb"][2]:.0f}x{a["vb"][3]:.0f}  bytes {len(json.dumps(a)):6d}')

# the whole glass, one file, for the ending
W, H = page.rect.width, page.rect.height
parts = []
for x in DR:
    d = path_d(x, 0, 0)
    if kind(x): parts.append(f'<path d="{d}"/>' if x['type'] == 'f' else f'<path class="s" d="{d}"/>')
    else:
        w = x.get('width') or LINE
        parts.append(f'<path class="l" d="{d}"' + (f' stroke-width="{f1(w)}"' if abs(w - LINE) > .2 else '') + '/>')
svg = (f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {f1(W)} {f1(H)}">'
       f'<style>path{{fill:#F4EEF7}}.l{{fill:none;stroke:#F4EEF7;stroke-width:{LINE};stroke-linejoin:miter}}.s{{stroke:#F4EEF7;stroke-width:6.57}}</style>'
       + ''.join(parts) + '</svg>')
(ROOT / 'assets/art').mkdir(parents=True, exist_ok=True)
(ROOT / 'assets/art/mural.svg').write_text(svg, encoding='utf-8')
print('mural.svg bytes', len(svg.encode()), 'paths', len(parts))
import runpy
runpy.run_path(str(ROOT / '_src/mural_text.py'), run_name='__main__')   # the glass's one live word
