"""Stamps the stylesheet and script links in index.html with a version (?v=...), so a
browser or GitHub Pages' cache never mixes an old file with a new one after an update.

    python stamp.py            # version = current date and time
"""
import pathlib
import re
import time

ROOT = pathlib.Path(__file__).resolve().parent
p = ROOT / "index.html"
html = p.read_text(encoding="utf-8")
v = time.strftime("%Y%m%d%H%M%S")
html = re.sub(r'((?:href="css|src="js)/[\w.-]+\.(?:css|js))(\?v=[\w.-]+)?"', lambda m: f'{m.group(1)}?v={v}"', html)
p.write_text(html, encoding="utf-8")
print("stamped", v)
