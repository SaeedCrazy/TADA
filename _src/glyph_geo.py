# Geometry of each glyph cluster: centerline segments, baseline, free connector ends.
import pymupdf, json, collections
SRC = r'C:/Users/SAEED/Downloads/TADA/GRAPHIC DESIGN/tada alphabet.pdf'
OUT = r'C:/Users/SAEED/AppData/Local/Temp/claude/29abb69cf93759cc/2d2b5d55-f9ae-46fd-a4b7-9159d8fce938/scratchpad/gd/'
d = pymupdf.open(SRC); p = d[0]; dr = p.get_drawings()
cl = json.load(open(OUT + 'clusters.json'))
def pts(it):
    k = it[0]
    if k == 'l': return [it[1], it[2]]
    if k == 'c': return [it[1], it[4]]
    if k == 're': r = it[1]; return [r.tl, r.tr, r.br, r.bl]
    if k == 'qu': q = it[1]; return [q.ul, q.ur, q.lr, q.ll]
    return []
# baseline per row: most common y among horizontal line segments
base = {}
for ri in range(4):
    ys = collections.Counter()
    for c in cl:
        if c['row'] != ri: continue
        for i in c['ids']:
            for it in dr[i]['items']:
                if it[0] == 'l' and abs(it[1].y - it[2].y) < 0.5 and abs(it[1].x - it[2].x) > 20: ys[round(it[1].y)] += abs(it[1].x - it[2].x)
    base[ri] = ys.most_common(3)
print('baselines', base)
res = []
for k, c in enumerate(cl):
    by = base[c['row']][0][0]
    segs = []; xs = []
    for i in c['ids']:
        x = dr[i]
        for it in x['items']:
            ps = pts(it); xs += [q.x for q in ps]
            if it[0] == 'l': segs.append((it[1], it[2]))
    x0, x1 = min(xs), max(xs)
    # endpoints and their degree
    ends = collections.Counter()
    for a, b in segs:
        ends[(round(a.x), round(a.y))] += 1; ends[(round(b.x), round(b.y))] += 1
    # also count curve endpoints
    for i in c['ids']:
        for it in dr[i]['items']:
            if it[0] == 'c': ends[(round(it[1].x), round(it[1].y))] += 1; ends[(round(it[4].x), round(it[4].y))] += 1
    def free_at(xe):
        for (ex, ey), n in ends.items():
            if n == 1 and abs(ex - xe) < 2 and abs(ey - by) < 3:
                # is it the end of a horizontal baseline segment?
                for a, b in segs:
                    if abs(a.y - b.y) < .5 and abs(a.y - by) < 3 and (abs(a.x - xe) < 2 or abs(b.x - xe) < 2): return True
        return False
    L, R = free_at(x0), free_at(x1)
    res.append(dict(k=k, row=c['row'], x0=round(x0, 1), x1=round(x1, 1), w=round(x1 - x0, 1), L=L, R=R, n=len(c['ids']), by=by))
    print(k, 'row', c['row'], 'w', round(x1 - x0), 'L' if L else '-', 'R' if R else '-', 'strokes', len(c['ids']))
json.dump(res, open(OUT + 'geo.json', 'w'))
