"""Builds tada.html: the whole site in one self-contained file.

Everything is inlined: the stylesheet, the Doran font (base64), the glass (mural.svg),
the brand icons, the site scripts and the vendor libraries (gsap, ScrollTrigger, lenis),
so the file works offline and can be sent or uploaded as a single file. Run from this folder:

    python build-single.py

Output: tada.html next to this script. Re-run after any change to the site.
"""
import base64
import pathlib
import re
from urllib.parse import quote

ROOT = pathlib.Path(__file__).resolve().parent
OUT = ROOT / "tada.html"
MIME = {".woff2": "font/woff2", ".svg": "image/svg+xml", ".png": "image/png", ".jpg": "image/jpeg"}
SCRIPTS = ("letters-data.js", "letters.js", "art-data.js", "content.js", "sound.js", "main.js")


def data_uri(path: pathlib.Path) -> str:
    raw = path.read_bytes()
    if path.suffix == ".svg":  # svg stays readable and small as utf-8 text; double quotes encoded
        return "data:image/svg+xml;charset=utf-8," + quote(raw.decode("utf-8"), safe=" =:/'-_.,;()")
    return f"data:{MIME[path.suffix]};base64," + base64.b64encode(raw).decode("ascii")


def inline_css(css_path: pathlib.Path) -> str:
    css = css_path.read_text(encoding="utf-8")

    def repl(m):
        target = (css_path.parent / m.group(2)).resolve()
        return f'url("{data_uri(target)}")'

    return re.sub(r"url\((['\"]?)(\.\./assets/[^'\")]+)\1\)", repl, css)


def safe_js(js: str) -> str:
    return js.replace("</script", "<\\/script")   # an inline script must never close itself


def main():
    html = (ROOT / "index.html").read_text(encoding="utf-8")
    html = re.sub(r'\?v=[\w.-]+"', '"', html)   # cache-busting stamps (stamp.py) are not needed here
    html = html.replace('<link rel="stylesheet" href="css/site.css">', f"<style>\n{inline_css(ROOT / 'css/site.css')}\n</style>")
    for ref in ("assets/brand/favicon.svg", "assets/brand/apple-touch-icon.png", "assets/art/mural.svg"):
        html = html.replace(f'"{ref}"', f'"{data_uri(ROOT / ref)}"')
    html = re.sub(r'<link rel="preload" href="assets/fonts/[^"]+"[^>]*>\n', "", html)
    # vendor libraries: drop the CDN tags and their fallbacks, inline the local copies
    html = re.sub(r'<script src="https://[^"]+"></script>\n', "", html)
    html = re.sub(r"<script>window\.\w+ \|\| document\.write\([^\n]*\)</script>\n", "", html)
    vendor = "".join(f"<script>\n{safe_js((ROOT / 'assets/vendor' / f).read_text(encoding='utf-8'))}\n</script>\n"
                     for f in ("gsap.min.js", "ScrollTrigger.min.js", "lenis.min.js"))
    scripts = ""
    for f in SCRIPTS:
        scripts += f"<script>\n{safe_js((ROOT / 'js' / f).read_text(encoding='utf-8'))}\n</script>\n"
        html = html.replace(f'<script src="js/{f}"></script>\n', "")
    html = html.replace("</body>", vendor + scripts + "</body>")
    leftovers = [m for m in re.findall(r'(?:src|href)="(?!data:|#|https?:)[^"]+"', html) if '${' not in m]
    if leftovers:
        raise SystemExit(f"unresolved local references: {leftovers}")
    OUT.write_text(html, encoding="utf-8")
    print(f"wrote {OUT.name}: {OUT.stat().st_size / 1024:.0f} KB")


if __name__ == "__main__":
    main()
