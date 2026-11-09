import sys
from playwright.sync_api import sync_playwright
from PIL import Image
O = r'C:/Users/SAEED/AppData/Local/Temp/claude/29abb69cf93759cc/2d2b5d55-f9ae-46fd-a4b7-9159d8fce938/scratchpad/door/'
import os; os.makedirs(O, exist_ok=True)
W, H = int(sys.argv[1]), int(sys.argv[2])
with sync_playwright() as p:
    b = p.chromium.launch(); pg = b.new_page(viewport={'width': W, 'height': H}, is_mobile=W < 768, has_touch=W < 768)
    errs = []; pg.on('pageerror', lambda e: errs.append(str(e)))
    pg.goto('http://127.0.0.1:8090/')
    shots = []
    for i in range(12):
        pg.wait_for_timeout(600); f = O + f'd{i:02d}.png'; pg.screenshot(path=f); shots.append(f)
    pg.evaluate('window.scrollTo(0, innerHeight * 0.45)'); pg.wait_for_timeout(2500); pg.screenshot(path=O + 'd_scrolled.png'); shots.append(O + 'd_scrolled.png')
    ims = [Image.open(f).resize((W // 4, H // 4)) for f in shots]
    sh = Image.new('RGB', ((W // 4 + 6) * 7, (H // 4 + 6) * 2), 'white')
    for i, im in enumerate(ims): sh.paste(im, ((i % 7) * (W // 4 + 6), (i // 7) * (H // 4 + 6)))
    sh.save(O + 'seq.png'); print(errs or 'no errors')
    b.close()
