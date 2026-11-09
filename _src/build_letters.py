# Tada alphabet -> js/letters-data.js : every glyph form as centerline strokes.
# Coordinates: x from the glyph's left edge (x0), y from the baseline (up is negative), in sheet units.
import pymupdf, json, pathlib
SRC = r'C:/Users/SAEED/Downloads/TADA/GRAPHIC DESIGN/tada alphabet.pdf'
TMP = r'C:/Users/SAEED/AppData/Local/Temp/claude/29abb69cf93759cc/2d2b5d55-f9ae-46fd-a4b7-9159d8fce938/scratchpad/gd/'
OUT = pathlib.Path(r'C:/Users/SAEED/Downloads/TADA/TADA SITE FINAL/js/letters-data.js')
p = pymupdf.open(SRC)[0]
dr = p.get_drawings()
cl = json.load(open(TMP + 'clusters.json'))
BASE = {0: 876.9, 1: 1389.5, 2: 1922.8, 3: 2435.5}
# cluster -> letter.form   (i init, m medi, f fina, s isol, d digit; alternates get a 2)
MAP = {
    43: 'آ.s', 42: 'ا.s',
    41: 'ب.i', 40: 'ب.m', 39: 'ب.s', 38: 'ب.f',
    37: 'پ.i', 36: 'پ.m', 35: 'پ.s', 34: 'پ.f',
    33: 'ت.i', 32: 'ت.m', 31: 'ت.s', 30: 'ت.f',
    29: 'ث.i', 28: 'ث.m', 27: 'ث.s', 26: 'ث.f',
    25: 'ج.i', 24: 'ج.m', 23: 'ج.f', 22: 'ج.s',
    21: 'چ.i', 20: 'چ.m', 19: 'چ.f', 18: 'چ.s',
    17: 'ح.i', 16: 'ح.m', 15: 'ح.f', 14: 'ح.s',
    13: 'خ.i', 12: 'خ.m', 11: 'خ.f', 10: 'خ.s',
    81: 'د.s2', 80: 'د.s', 79: 'د.f', 78: 'ذ.s2', 77: 'ذ.s', 76: 'ذ.f',
    75: 'ر.s', 74: 'ر.f', 73: 'ز.s', 72: 'ز.f', 71: 'ژ.s', 70: 'ژ.f',
    69: 'س.i', 68: 'س.m', 67: 'س.f', 66: 'س.s',
    65: 'ش.i', 64: 'ش.m', 63: 'ش.f', 62: 'ش.s',
    61: 'ص.i', 60: 'ص.m', 59: 'ص.f', 58: 'ص.s',
    57: 'ض.i', 56: 'ض.m', 55: 'ض.f', 54: 'ض.s',
    114: 'ط.i', 113: 'ط.m', 112: 'ط.s', 111: 'ظ.i', 110: 'ظ.m', 109: 'ظ.s',
    108: 'ع.i', 104: 'ع.m', 103: 'ع.f', 101: 'ع.s', 102: 'ع.f2',
    100: 'غ.i', 99: 'غ.m', 98: 'غ.f', 96: 'غ.s', 97: 'غ.f2',
    107: 'ئ.i', 106: 'ئ.m', 105: 'ء.s',
    95: 'ف.i', 94: 'ف.m', 93: 'ف.f', 92: 'ف.s',
    91: 'ق.i', 90: 'ق.m', 89: 'ق.f', 88: 'ق.s',
    87: 'ک.i', 86: 'ک.m', 85: 'ک.f', 84: 'ک.s',
    155: 'گ.i', 154: 'گ.m', 153: 'گ.f', 152: 'گ.s',
    151: 'ل.i', 150: 'ل.m', 149: 'ل.f', 148: 'ل.s',
    147: 'م.i', 143: 'م.m', 142: 'م.f', 141: 'م.s', 146: 'م.m2', 145: 'م.f2', 144: 'م.s2',
    140: 'ن.i', 139: 'ن.m', 137: 'ن.s2',
    136: 'و.s', 135: 'و.f', 134: 'و.s2', 133: 'و.f2',
    131: 'ه.i', 129: 'ه.m', 128: 'ه.f', 132: 'ه.s', 130: 'ه.f2',
    127: 'ی.i', 126: 'ی.m', 125: 'ی.f', 124: 'ی.s', 123: 'ی.f2',
}
for k, ch in enumerate('0123456789'):
    MAP[k] = ch + '.d'
for k, ch in enumerate('۰۱۲۳۴۵۶۷۸۹'):
    MAP[44 + k] = ch + '.d'
ORN = {117: 'star', 118: 'diamond', 119: 'star8', 120: 'sun', 121: 'dot', 122: 'spark4', 115: 'wand', 116: 'wand2', 82: 'wandL', 83: 'wandL2'}


def f1(v):
    r = round(v, 1)
    return str(int(r)) if r == int(r) else ('%.1f' % r)


def bez(a, b, c, d, t):
    u = 1 - t
    return (u**3 * a.x + 3 * u * u * t * b.x + 3 * u * t * t * c.x + t**3 * d.x,
            u**3 * a.y + 3 * u * u * t * b.y + 3 * u * t * t * c.y + t**3 * d.y)


def strokes_of(ids, ox, by):
    out = []
    for i in ids:
        x = dr[i]
        d, pts, last = [], [], None
        for it in x['items']:
            k = it[0]
            if k == 're':
                r = it[1]
                d.append(f'M{f1(r.x0-ox)} {f1(r.y0-by)}H{f1(r.x1-ox)}V{f1(r.y1-by)}H{f1(r.x0-ox)}Z')
                pts += [(r.x0, r.y0), (r.x1, r.y1)]
                last = None
                continue
            if k == 'qu':
                q = it[1]
                d.append('M' + 'L'.join(f'{f1(v.x-ox)} {f1(v.y-by)}' for v in (q.ul, q.ur, q.lr, q.ll)) + 'Z')
                pts += [(v.x, v.y) for v in (q.ul, q.ur, q.lr, q.ll)]
                last = None
                continue
            a = it[1]
            if last is None or abs(last.x - a.x) > .05 or abs(last.y - a.y) > .05:
                d.append(f'M{f1(a.x-ox)} {f1(a.y-by)}')
                pts.append((a.x, a.y))
            if k == 'l':
                b = it[2]
                if abs(a.x - b.x) < .05:
                    d.append(f'V{f1(b.y-by)}')
                elif abs(a.y - b.y) < .05:
                    d.append(f'H{f1(b.x-ox)}')
                else:
                    d.append(f'L{f1(b.x-ox)} {f1(b.y-by)}')
                pts.append((b.x, b.y))
                last = b
            elif k == 'c':
                c1, c2, e = it[2], it[3], it[4]
                if abs(c1.x - a.x) < .05 and abs(c1.y - a.y) < .05 and abs(c2.x - e.x) < .05 and abs(c2.y - e.y) < .05:
                    d.append(f'L{f1(e.x-ox)} {f1(e.y-by)}')
                else:
                    d.append(f'C{f1(c1.x-ox)} {f1(c1.y-by)} {f1(c2.x-ox)} {f1(c2.y-by)} {f1(e.x-ox)} {f1(e.y-by)}')
                pts += [bez(a, c1, c2, e, t / 8) for t in range(1, 9)]
                last = e
        if x.get('closePath'):
            d.append('Z')
        out.append({'d': ''.join(d), 'fill': x['type'] == 'f', 'pts': pts})
    return out


def glyph(ids, row):
    by = BASE[row]
    st = strokes_of(ids, 0, 0)
    xs = [q[0] for s in st for q in s['pts']]
    x0, x1 = min(xs), max(xs)
    st = strokes_of(ids, x0, by)
    ys = [q[1] for s in st for q in s['pts']]
    g = {'w': round(x1 - x0, 1), 'y': [round(min(ys) - by, 1), round(max(ys) - by, 1)], 'p': [s['d'] for s in st if not s['fill']]}
    fills = [s['d'] for s in st if s['fill']]
    if fills:
        g['fill'] = fills
    return g


data = {}
for k, name in MAP.items():
    c = cl[k]
    data[name] = glyph(c['ids'], c['row'])

# ن isolated and final are drawn side by side in one cluster (138), with an alternate deep bowl
ids = cl[138]['ids']
data['ن.s'] = glyph([i for i in ids if dr[i]['rect'].x1 < 6560 and dr[i]['rect'].y0 < 2600], 3)
data['ن.f'] = glyph([i for i in ids if dr[i]['rect'].x0 > 6590 and dr[i]['rect'].y0 < 2600], 3)

# finals the sheet leaves out (ط ظ): the medial without its left connector stroke
for L in 'طظ':
    k = [kk for kk, v in MAP.items() if v == L + '.m'][0]
    ids = cl[k]['ids']
    xs = [q.x for i in ids for it in dr[i]['items'] for q in it[1:] if hasattr(q, 'x')]
    x0 = min(xs)
    def is_left_connector(i):
        r = dr[i]['rect']
        return r.height < 1 and abs(r.x0 - x0) < 1 and abs(r.y0 - BASE[2]) < 1
    data[L + '.f'] = glyph([i for i in ids if not is_left_connector(i)], 2)

# a looped meem for the start of a word (the sheet's looped medial without its right connector)
m2 = data['م.m2']
data['م.i2'] = {'w': 122.1, 'y': m2['y'], 'p': ['M0 -0.1H61.5', m2['p'][1]]}

orn = {}
for k, name in ORN.items():
    c = cl[k]
    orn[name] = glyph(c['ids'], c['row'])

meta = {'stroke': 14, 'alef': 152.4}
js = ('// Tada alphabet, from the brand designer\'s sheet (tada alphabet.pdf). Generated by _src/build_letters.py.\n'
      '// Each form: w = width, p = centerline strokes (x from the left edge, y from the baseline, up is negative).\n'
      'const TADA_GLYPHS = ' + json.dumps({'meta': meta, 'g': data, 'orn': orn}, ensure_ascii=False, separators=(',', ':')) + ';\n')
OUT.parent.mkdir(parents=True, exist_ok=True)
OUT.write_text(js, encoding='utf-8')
print('forms', len(data), 'bytes', len(js.encode()))
print('ط.f', data['ط.f'])
print('ط.m', data['ط.m'])
missing = [L for L in 'ابپتثجچحخدذرزژسشصضطظعغفقکگلمنوهی' if not any(n.startswith(L + '.') for n in data)]
print('missing letters', missing)
