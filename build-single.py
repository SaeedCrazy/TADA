"""Builds tada.html: the whole site in one self-contained file.

Everything is inlined: CSS, fonts (base64), brand SVGs, the site scripts and the
vendor libraries (gsap, ScrollTrigger, lenis), so the file works offline and can be
sent as a single attachment. Run from this folder:

    python build-single.py

Output: tada.html next to this script. Re-run after any change to the site.
"""
import base64
import pathlib
import re

ROOT = pathlib.Path(__file__).resolve().parent
OUT = ROOT / "tada.html"
MIME = {".woff2": "font/woff2", ".svg": "image/svg+xml", ".png": "image/png", ".jpg": "image/jpeg"}


def data_uri(path: pathlib.Path) -> str:
    raw = path.read_bytes()
    if path.suffix == ".svg":  # svg stays readable and small as utf-8 text
        from urllib.parse import quote
        return "data:image/svg+xml;charset=utf-8," + quote(raw.decode("utf-8"), safe=" =:/'-_.,;()")  # double quotes encoded: the uri sits inside url("...") and src="..."
    return f"data:{MIME[path.suffix]};base64," + base64.b64encode(raw).decode("ascii")


def inline_css(css_path: pathlib.Path) -> str:
    css = css_path.read_text(encoding="utf-8")

    def repl(m):
        ref = m.group(2)
        if ref.startswith("data:"):
            return m.group(0)
        target = (css_path.parent / ref).resolve()
        return f'url("{data_uri(target)}")'

    return re.sub(r"url\((['\"]?)(\.\./assets/[^'\")]+)\1\)", repl, css)


def safe_js(js: str) -> str:
    # an inline script must never contain a closing script tag
    return js.replace("</script", "<\\/script")


def main():
    html = (ROOT / "index.html").read_text(encoding="utf-8")
    html = re.sub(r'\?v=[\w.-]+"', '"', html)   # drop cache-busting stamps (see stamp.py)

    # stylesheets
    for name in ("site", "loader"):
        tag = f'<link rel="stylesheet" href="css/{name}.css">'
        html = html.replace(tag, f"<style>\n{inline_css(ROOT / 'css' / f'{name}.css')}\n</style>")

    # favicon
    html = html.replace('href="assets/brand/favicon.svg"', f'href="{data_uri(ROOT / "assets/brand/favicon.svg")}"')
    html = html.replace('href="assets/brand/apple-touch-icon.png"', f'href="{data_uri(ROOT / "assets/brand/apple-touch-icon.png")}"')
    # fonts are inlined, so their preload hints go
    html = re.sub(r'<link rel="preload" href="assets/fonts/[^"]+"[^>]*>\n', "", html)

    # vendor libraries: drop the CDN tags and their fallbacks, inline the local copies
    html = re.sub(r'<script src="https://[^"]+"></script>\n', "", html)
    html = re.sub(r"<script>window\.\w+ \|\| document\.write\([^\n]*\)</script>\n", "", html)
    vendor = "".join(
        f"<script>\n{safe_js((ROOT / 'assets/vendor' / f).read_text(encoding='utf-8'))}\n</script>\n"
        for f in ("gsap.min.js", "ScrollTrigger.min.js", "lenis.min.js")
    )

    # site scripts, with asset paths turned into data URIs
    assets = {
        "assets/brand/tada-wordmark-tagline_purple.svg": data_uri(ROOT / "assets/brand/tada-wordmark-tagline_purple.svg"),
        "assets/brand/tada-lockup-horizontal_purple.svg": data_uri(ROOT / "assets/brand/tada-lockup-horizontal_purple.svg"),
    }
    scripts = ""
    for f in ("brand-data.js", "content.js", "loader.js", "sound.js", "main.js"):
        js = (ROOT / "js" / f).read_text(encoding="utf-8")
        for k, v in assets.items():
            js = js.replace(k, v)
        scripts += f"<script>\n{safe_js(js)}\n</script>\n"
        html = html.replace(f'<script src="js/{f}"></script>\n', "")

    html = html.replace("</body>", vendor + scripts + "</body>")
    leftovers = [m for m in re.findall(r'(?:src|href)="(?!data:|#|https?:)[^"]+"', html) if '${' not in m]
    if leftovers:
        raise SystemExit(f"unresolved local references: {leftovers}")
    OUT.write_text(html, encoding="utf-8")
    print(f"wrote {OUT.name}: {OUT.stat().st_size / 1024:.0f} KB")


if __name__ == "__main__":
    main()
