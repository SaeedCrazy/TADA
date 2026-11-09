# The one live text on the glass («وبسایت», Doran) as outlines, appended to assets/art/mural.svg.
import sys, pathlib, re
import uharfbuzz as hb
FONT = pathlib.Path(r'C:/Users/SAEED/AppData/Local/Microsoft/Windows/Fonts/Doran-VF.ttf')
SVG = pathlib.Path(r'C:/Users/SAEED/Downloads/TADA/TADA SITE FINAL/assets/art/mural.svg')
TEXT, SIZE, BOX = 'وبسایت', 126.0, (5924.0, 3268.0, 6323.0, 3473.0)
WGHT = float(sys.argv[1]) if len(sys.argv) > 1 else 700

blob = hb.Blob(FONT.read_bytes()); face = hb.Face(blob); font = hb.Font(face)
font.set_variations({'wght': WGHT})
upem = face.upem
buf = hb.Buffer(); buf.add_str(TEXT); buf.guess_segment_properties()
hb.shape(font, buf, {})
k = SIZE / upem
ext = font.get_font_extents('ltr')
asc = ext.ascender
# glyph outlines through a small pen
cmds = []
class Pen:
    def __init__(self, ox, oy): self.ox, self.oy = ox, oy
    def P(self, x, y): return f'{self.ox + x * k:.1f} {self.oy - y * k:.1f}'
def draw(gid, ox, oy):
    d = []
    funcs = hb.DrawFuncs()
    pen = Pen(ox, oy)
    funcs.set_move_to_func(lambda x, y, u: d.append('M' + pen.P(x, y)))
    funcs.set_line_to_func(lambda x, y, u: d.append('L' + pen.P(x, y)))
    funcs.set_quadratic_to_func(lambda cx, cy, x, y, u: d.append('Q' + pen.P(cx, cy) + ' ' + pen.P(x, y)))
    funcs.set_cubic_to_func(lambda c1x, c1y, c2x, c2y, x, y, u: d.append('C' + pen.P(c1x, c1y) + ' ' + pen.P(c2x, c2y) + ' ' + pen.P(x, y)))
    funcs.set_close_path_func(lambda u: d.append('Z'))
    font.draw_glyph(gid, funcs, None)
    return ''.join(d)
infos, pos = buf.glyph_infos, buf.glyph_positions
width = sum(p.x_advance for p in pos) * k
x = BOX[2] - width                      # right aligned in its box, as set
base = BOX[1] + asc * k
paths = []
for i, p in zip(infos, pos):
    paths.append(draw(i.codepoint, x + p.x_offset * k, base - p.y_offset * k))
    x += p.x_advance * k
d = ''.join(paths)
s = SVG.read_text(encoding='utf-8')
s = re.sub(r'<path class="t"[^>]*/>', '', s)
s = s.replace('</svg>', f'<path class="t" d="{d}"/></svg>')
SVG.write_text(s, encoding='utf-8')
print('width', round(width), 'box', BOX[2] - BOX[0], 'asc', asc, 'upem', upem)
