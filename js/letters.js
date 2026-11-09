/* Tada letters: writes Persian with the brand alphabet (TADA_GLYPHS, from the designer's
   sheet). Picks each letter's joined form, joins letters on the baseline, and returns an SVG
   of centerline strokes that can be written on stroke by stroke.
   Tatweel (ـ) in the text stretches a join, as the designer does in «تــادا لانژ».     */
const TadaType = (() => {
  const G = TADA_GLYPHS.g, O = TADA_GLYPHS.orn, ALEF = TADA_GLYPHS.meta.alef;
  const DUAL = new Set('بپتثجچحخسشصضطظعغفقکگلمنهیئـ');
  const RIGHT = new Set('اآدذرزژو');
  const NORM = { 'ي': 'ی', 'ى': 'ی', 'ك': 'ک', 'ة': 'ه', 'ۀ': 'ه', 'أ': 'ا', 'إ': 'ا', 'ٱ': 'ا', 'ؤ': 'و', '٠': '۰', '١': '۱', '٢': '۲', '٣': '۳', '٤': '۴', '٥': '۵', '٦': '۶', '٧': '۷', '٨': '۸', '٩': '۹' };
  const MARKS = /[ً-ٰٟؐ-ؚ]/g;   // harakat are left out
  const DIGIT = /[0-9۰-۹]/;
  const KASHIDA = 64, GAP = 38, WORD = 104;
  // the looped meem reads at a glance; the slashed one stays for the designer's own words
  const PREF = { 'م.i': 'م.i2', 'م.m': 'م.m2', 'م.f': 'م.f2', 'م.s': 'م.s2' };
  // where an alef or madda alef takes the join: its stem
  const STEM = { 'ا': 0, 'آ': 37.1 };
  const NS = 'http://www.w3.org/2000/svg';

  const joinsNext = ch => DUAL.has(ch);
  const joinsPrev = ch => DUAL.has(ch) || RIGHT.has(ch);

  function form(ch, prevJ, nextJ) {
    if (DIGIT.test(ch)) return G[ch + '.d'] ? ch + '.d' : null;
    if (ch === 'ـ') return 'ـ';
    const f = prevJ && nextJ ? 'm' : prevJ ? 'f' : nextJ ? 'i' : 's';
    for (const k of [f, f === 'm' ? 'i' : f === 'f' ? 's' : 's']) {
      const n = `${ch}.${k}`, p = PREF[n];
      if (p && G[p]) return p;
      if (G[n]) return n;
    }
    return null;
  }

  /** Lays the text out right to left. Returns glyph placements in sheet units. */
  function shape(text, o = {}) {
    const kash = o.kashida ?? KASHIDA, gap = o.gap ?? GAP, word = o.word ?? WORD;
    const s = [...String(text).normalize('NFC').replace(MARKS, '')].map(c => NORM[c] || c);
    const out = [];
    let x = 0, prevLeftJoin = false, lastLeft = 0;
    let i = 0;
    while (i < s.length) {
      const ch = s[i];
      if (ch === ' ' || ch === ' ') { x = lastLeft - word; prevLeftJoin = false; i++; continue; }
      if (ch === '‌') { x = lastLeft - gap * 0.6; prevLeftJoin = false; i++; continue; }
      if (DIGIT.test(ch)) {                     // numbers read left to right inside the line
        let j = i; while (j < s.length && DIGIT.test(s[j])) j++;
        const run = s.slice(i, j).reverse();
        let cx = (prevLeftJoin ? lastLeft : x) - (out.length ? gap : 0);
        for (const d of run) {
          const name = form(d); if (!name) continue;
          const g = G[name];
          out.push({ name, g, x: cx - g.w }); cx -= g.w + gap * 0.9;
        }
        lastLeft = cx + gap * 0.9; x = lastLeft; prevLeftJoin = false; i = j; continue;
      }
      if (ch === 'ـ') {                         // stretch the join
        if (prevLeftJoin) { out.push({ name: 'ـ', line: kash, x: lastLeft - kash }); lastLeft -= kash; }
        i++; continue;
      }
      const prev = (() => { for (let j = i - 1; j >= 0; j--) { if (s[j] !== 'ـ') return s[j]; } return ''; })();
      const next = (() => { for (let j = i + 1; j < s.length; j++) { if (s[j] !== 'ـ') return s[j]; } return ''; })();
      const pj = prevLeftJoin && joinsPrev(ch);
      const nj = joinsNext(ch) && next && joinsPrev(next) && next !== ' ';
      const name = form(ch, pj, nj);
      if (!name) { i++; continue; }
      const g = G[name];
      let gx;
      if (pj) gx = lastLeft - (ch in STEM ? STEM[ch] : g.w);
      else gx = (out.length ? x - gap : 0) - g.w;
      out.push({ name, g, x: gx });
      lastLeft = gx; x = gx;
      prevLeftJoin = nj;
      i++;
    }
    let min = Infinity, max = -Infinity, top = Infinity, bot = -Infinity;
    for (const q of out) {
      const w = q.g ? q.g.w : q.line, y = q.g ? q.g.y : [0, 0];
      min = Math.min(min, q.x); max = Math.max(max, q.x + w);
      top = Math.min(top, y[0]); bot = Math.max(bot, y[1]);
    }
    return { glyphs: out, x0: min, x1: max, top, bot };
  }

  // the sheet extends stems half a stroke below the baseline to square the corners; at
  // another weight that half stroke changes with it
  function fitBase(d, half) {
    return d.replace(/([MLV])(-?[\d.]+)(?: (-?[\d.]+))?/g, (m, c, a, b) => {
      if (c === 'V') { const y = +a; return y > 0.5 && y < 8 ? `V${half}` : m; }
      const y = +b; return y > 0.5 && y < 8 ? `${c}${a} ${half}` : m;
    });
  }

  function bbox(d) {
    const n = d.match(/[MLHVC]|-?[\d.]+/g); let c = '', x = 0, y = 0;
    const xs = [], ys = [];
    for (let i = 0; i < n.length;) {
      if (/[MLHVC]/.test(n[i])) { c = n[i++]; continue; }
      if (c === 'H') x = +n[i++];
      else if (c === 'V') y = +n[i++];
      else if (c === 'C') { xs.push(+n[i], +n[i + 2]); ys.push(+n[i + 1], +n[i + 3]); x = +n[i + 4]; y = +n[i + 5]; i += 6; }
      else { x = +n[i]; y = +n[i + 1]; i += 2; }
      xs.push(x); ys.push(y);
    }
    const x0 = Math.min(...xs), x1 = Math.max(...xs), y0 = Math.min(...ys), y1 = Math.max(...ys);
    return { x0, x1, y0, y1, w: x1 - x0, h: y1 - y0 };
  }

  /**
   * Writes text as an SVG. o.size = alef height in px; o.weight = stroke as a share of the
   * alef height (the mural uses about 0.06); o.align = 'right' | 'center' | 'left'.
   * Each stroke is a <path class="tt-s">, in writing order.
   */
  function svg(text, o = {}) {
    const L = shape(text, o);
    const weight = o.weight ?? 0.06, sw = weight * ALEF, half = +(sw / 2).toFixed(2);
    const pad = sw;
    const vb = [L.x0 - pad, L.top - pad, L.x1 - L.x0 + pad * 2, L.bot - L.top + pad * 2];
    const el = document.createElementNS(NS, 'svg');
    el.setAttribute('viewBox', vb.map(v => +v.toFixed(1)).join(' '));
    el.setAttribute('class', 'tt' + (o.cls ? ' ' + o.cls : ''));
    el.setAttribute('aria-hidden', 'true');
    el.setAttribute('focusable', 'false');
    el.style.setProperty('--tt-sw', sw.toFixed(2));
    if (o.size) {
      const k = o.size / ALEF;
      el.setAttribute('width', (vb[2] * k).toFixed(1)); el.setAttribute('height', (vb[3] * k).toFixed(1));
    }
    el.dataset.units = (vb[2]).toFixed(1);
    const strokes = [];
    for (const q of L.glyphs) {
      if (q.line) { strokes.push({ d: `M${(q.x + q.line).toFixed(1)} 0H${q.x.toFixed(1)}`, x: q.x + q.line, dot: false }); continue; }
      const g = q.g;
      for (const raw of g.p) {
        const d = fitBase(raw, half);
        const b = bbox(raw);
        const dot = g.p.length > 1 && b.w < 44 && b.h < 26 && (b.y1 < -20 || b.y0 > 20);
        strokes.push({ d, x: q.x + b.x1, dot, tx: q.x });
      }
      for (const f of g.fill || []) strokes.push({ d: f, x: q.x + g.w, fill: true, tx: q.x });
    }
    // writing order: bodies from right to left, then the dots of the word
    const bodies = strokes.filter(s => !s.dot && !s.fill).sort((a, b) => b.x - a.x);
    const dots = strokes.filter(s => s.dot || s.fill).sort((a, b) => b.x - a.x);
    for (const s of [...bodies, ...dots]) {
      const p = document.createElementNS(NS, 'path');
      p.setAttribute('d', s.d);
      if (s.tx !== undefined) p.setAttribute('transform', `translate(${s.tx.toFixed(1)} 0)`);
      p.setAttribute('class', s.fill ? 'tt-f' : s.dot ? 'tt-s tt-dot' : 'tt-s');
      el.appendChild(p);
    }
    return el;
  }

  return { shape, svg, glyphs: G, ornaments: O, ALEF };
})();
