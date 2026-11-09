// TADA Lounge — the glass
// ----------------------
// The door draws itself while the site loads (the arch, the snapping hand, its three
// sparkles, the wordmarks: all the designer's own vectors). Its last stroke is where the
// Tada magic begins: one line with a glowing head that runs through the page, writes the
// headlines in Tada's letters, wakes each illustration of the glass as it passes, draws
// the staff of the menu, walks down the stairs to the branches, lays the road for the
// scooter, and at the very end finds the hand on the whole glass and snaps.
//
// Classic script; depends on gsap, ScrollTrigger, (Lenis), TADA_GLYPHS/TadaType,
// TADA_ART, SITE, CONTENT, TadaSound.

(function () {
  'use strict';

  const SND = window.TadaSound, sfx = SND.sfx;
  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => [...r.querySelectorAll(s)];
  const NS = 'http://www.w3.org/2000/svg';
  const el = (tag, attrs = {}, parent) => { const n = document.createElementNS(NS, tag); for (const k in attrs) n.setAttribute(k, attrs[k]); if (parent) parent.appendChild(n); return n; };
  const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const fine = matchMedia('(pointer: fine)').matches;
  const small = () => innerWidth < 768;
  const narrow = () => innerWidth < 1024;
  const vw = () => document.documentElement.clientWidth;
  const vh = () => innerHeight;
  document.documentElement.classList.add('js');
  gsap.registerPlugin(ScrollTrigger);
  ScrollTrigger.config({ ignoreMobileResize: true });

  // the brand's four-point sparkle, exactly as drawn on the glass (unit size, centred)
  const STAR_D = 'M0 -1C0.17 -0.54 0.52 -0.18 1 0C0.52 0.18 0.17 0.54 0 1C-0.17 0.54 -0.52 0.18 -1 0C-0.52 -0.18 -0.17 -0.54 0 -1Z';
  const starPath = new Path2D(STAR_D);
  document.documentElement.style.setProperty('--star-mask', `url("data:image/svg+xml,${encodeURIComponent(`<svg xmlns='http://www.w3.org/2000/svg' viewBox='-1 -1 2 2'><path d='${STAR_D}'/></svg>`)}")`);

  // ======================================================================
  // Language and content
  // ======================================================================
  let lang = 'fa';
  try { lang = localStorage.getItem('tada.lang') || 'fa'; } catch {}
  if (!CONTENT[lang]) lang = 'fa';
  const T = () => CONTENT[lang];
  const RTL = () => T().dir === 'rtl';
  const num = v => (lang === 'fa' ? faDigits(v) : String(v));
  const get = (obj, path) => path.split('.').reduce((o, k) => (o == null ? o : o[k]), obj);

  // ---------- the art of the glass ----------
  const ART = TADA_ART;
  function artSvg(name) {
    const a = ART[name]; if (!a) return null;
    const svg = el('svg', { viewBox: a.vb.join(' '), class: 'art', 'aria-hidden': 'true', focusable: 'false' });
    const strokes = [], fills = [];
    for (const [d, k, wf] of a.p) {
      const p = el('path', { d, class: k ? 'f' : 's' }, svg);
      if (!k && wf) p.style.strokeWidth = `calc(var(--sw) * ${wf})`;
      (k ? fills : strokes).push(p);
    }
    svg.__art = { name, strokes, fills, w: a.vb[2], drawn: false };
    return svg;
  }
  // every illustration is drawn with the one line of the page, at the same weight on screen
  function inkPx() { return parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--ink-w')) || 2; }
  function fitArt(svg) {
    const A = svg.__art; if (!A || !A.w) return;
    const w = svg.getBoundingClientRect().width; if (!w) return;
    svg.style.setProperty('--sw', (inkPx() / (w / A.w)).toFixed(2));
  }
  const fitAll = () => $$('svg.art').forEach(fitArt);

  function prepDraw(svg) {
    const A = svg.__art; if (!A || A.drawn || A.prepped) return;
    A.prepped = true;
    svg.classList.add('is-waiting');
    for (const p of A.strokes) { const L = p.getTotalLength() + 1; p.__L = L; p.style.strokeDasharray = `${L} ${L}`; p.style.strokeDashoffset = L; }
    for (const f of A.fills) { f.style.transformBox = 'fill-box'; f.style.transformOrigin = 'center'; }
  }
  // the magic touches a piece: it draws itself, stroke after stroke, calmly
  function drawArt(svg, o = {}) {
    const A = svg && svg.__art; if (!A || A.drawn) return;
    A.drawn = true;
    const quick = o.instant || reduce || quiet;
    svg.classList.remove('is-waiting');
    if (quick || !A.prepped) {
      for (const p of A.strokes) { p.style.strokeDasharray = ''; p.style.strokeDashoffset = ''; }
      for (const f of A.fills) { f.style.opacity = ''; f.style.transform = ''; }
      return;
    }
    const dur = o.dur ?? Math.min(2.6, 1.1 + A.strokes.length * 0.03);
    const n = A.strokes.length, each = Math.min(1.2, dur * 0.6), stagger = n > 1 ? (dur - each) / (n - 1) : 0;
    A.strokes.forEach((p, i) => gsap.to(p, { strokeDashoffset: 0, duration: each, delay: (o.delay || 0) + i * stagger, ease: 'power1.inOut', onComplete: () => { p.style.strokeDasharray = ''; p.style.strokeDashoffset = ''; } }));
    A.fills.forEach((f, i) => gsap.fromTo(f, { opacity: 0, scale: 0.3 }, { opacity: 1, scale: 1, duration: 0.8, delay: (o.delay || 0) + dur * 0.45 + i * Math.min(0.12, dur * 0.4 / A.fills.length), ease: 'back.out(2.2)', clearProps: 'transform' }));
  }

  // ---------- Tada letters ----------
  const headSize = () => (small() ? 32 : narrow() ? 44 : 56);
  function letters(text, size, cls) {
    const svg = TadaType.svg(text, { size, weight: 0.064, cls });
    svg.__art = { strokes: $$('.tt-s', svg), fills: $$('.tt-f', svg), drawn: false };
    return svg;
  }
  function buildHeadline(h) {
    const text = get(T(), h.dataset.tt) || '';
    h.replaceChildren();
    if (lang === 'fa') {
      const sr = document.createElement('span'); sr.className = 'sr'; sr.textContent = text.replace(/ـ/g, '');
      const svg = letters(text, headSize());
      h.append(sr, svg);
    } else {
      h.textContent = text;
    }
  }
  function writeHeadline(h) {
    if (h.__drawn) return;
    h.__drawn = true;
    const svg = $('svg.tt', h);
    if (svg) drawArt(svg, { dur: Math.min(2.2, 0.9 + svg.__art.strokes.length * 0.05) });
    else if (!reduce && !quiet) gsap.fromTo(h, { opacity: 0, y: 10 }, { opacity: 1, y: 0, duration: 1.1, ease: 'power2.out', clearProps: 'all' });
  }

  // ---------- the glass's chamfered panel, drawn around an element ----------
  const framed = new Set();
  function frameIt(node, cut) {
    let svg = $(':scope > .frame', node);
    if (!svg) { svg = el('svg', { class: 'frame', 'aria-hidden': 'true' }); el('path', {}, svg); node.prepend(svg); }
    node.__cut = cut; framed.add(node); paintFrame(node);
  }
  function paintFrame(node) {
    const svg = $(':scope > .frame', node); if (!svg) return;
    const w = node.offsetWidth, h = node.offsetHeight; if (!w || !h) return;
    const c = Math.min(node.__cut, h / 2.6, w / 4), i = 0.6;
    svg.setAttribute('viewBox', `0 0 ${w} ${h}`);
    svg.firstChild.setAttribute('d', `M${c} ${i}H${w - c}L${w - i} ${c}V${h - c}L${w - c} ${h - i}H${c}L${i} ${h - c}V${c}Z`);
  }
  const frameRO = 'ResizeObserver' in window ? new ResizeObserver(es => es.forEach(e => paintFrame(e.target))) : null;
  function frameAll() {
    $$('.btn:not(.btn-quiet)').forEach(b => { frameIt(b, 12); frameRO && frameRO.observe(b); });
  }

  // ---------- opening hours, in Tehran ----------
  function tehranNow() {
    try {
      const parts = new Intl.DateTimeFormat('en-GB', { timeZone: SITE.timeZone, hour: 'numeric', minute: 'numeric', hour12: false }).formatToParts(new Date());
      const h = +parts.find(p => p.type === 'hour').value % 24, m = +parts.find(p => p.type === 'minute').value;
      return h + m / 60;
    } catch { const d = new Date(); return d.getHours() + d.getMinutes() / 60; }
  }
  function paintStatus() {
    const s = $('#openStatus'); if (!s) return;
    const t = tehranNow(), H = SITE.hours, S = T().status;
    let text, open = false;
    const now = H.find(([a, b]) => t >= a && t < b);
    if (now) { open = true; text = S.open(num(now[1])); }
    else if (t < H[0][0]) text = S.today(num(H[0][0]));
    else { const next = H.find(([a]) => t < a); text = next ? S.gap(num(next[0])) : S.tomorrow(num(H[0][0])); }
    s.textContent = text; s.classList.toggle('is-open', open);
  }
  setInterval(paintStatus, 60000);

  // ---------- the pieces that come from the content ----------
  function buildPack() {
    const P = T().bar.pack, box = $('#pack');
    box.innerHTML = `<p class="pack-title">${P.title}</p><p class="pack-name">${P.name}</p><p class="pack-size">${P.size}</p>
      <p class="pack-intro">${P.intro}</p>
      <dl class="specs">${P.specs.map(([a, b]) => `<dt>${a}</dt><dd>${b}</dd>`).join('')}</dl>
      <p class="profile-title">${P.profileTitle}</p>
      <ul class="profile">${P.profile.map(([a, v]) => `<li><span>${a}</span><span class="bar" role="img" aria-label="${a}: ${num(v)}٪"><i style="--v:${v}"></i></span></li>`).join('')}</ul>
      <p class="profile-note">${P.profileNote}</p>
      <a class="btn btn-line" href="${SITE.shop}" rel="noopener">${P.cta}</a>`;
    frameIt(box, 26); frameRO && frameRO.observe(box);
  }
  const arrowSvg = '<svg viewBox="0 0 14 26" aria-hidden="true"><path d="M2 1L12 13L2 25"/></svg>';
  function buildMenu() {
    const M = T().menu, track = $('#menuTrack'), dots = $('#menuDots');
    track.replaceChildren(); dots.replaceChildren();
    M.items.forEach((it, i) => {
      const li = document.createElement('li');
      li.className = 'card'; li.__i = i;
      li.setAttribute('aria-roledescription', 'slide');
      li.setAttribute('aria-label', `${num(i + 1)} / ${num(M.items.length)}`);
      li.innerHTML = `<div class="card-art"><span class="art-slot" data-art="${it.art}"></span></div>
        <h3 class="card-name"><span class="${lang === 'fa' ? 'sr' : ''}">${it.name}</span></h3>
        <p class="card-sub">${it.sub}</p><p class="card-note">${it.note}</p>
        <button class="card-arrow is-prev" type="button" data-dir="-1" aria-label="${M.prev}" tabindex="-1">${arrowSvg}</button>
        <button class="card-arrow is-next" type="button" data-dir="1" aria-label="${M.next}" tabindex="-1">${arrowSvg}</button>`;
      if (lang === 'fa') $('.card-name', li).appendChild(letters(it.name, small() ? 28 : 34));
      track.appendChild(li);
      dots.appendChild(document.createElement('i'));
      frameIt(li, small() ? 20 : 28);
    });
    fillSlots(track);
    menuActive = -1;
  }
  function buildSteps() {
    const B = T().branches, ol = $('#steps');
    ol.innerHTML = B.list.map((b, i) => `<li class="step"><div class="step-art"><span class="art-slot" data-art="${b.art}"></span></div>
      <h3 class="step-name">${b.name}</h3><p class="step-addr">${b.addr}</p>
      <a class="step-link" href="${b.map}" target="_blank" rel="noopener">${B.route}</a></li>`).join('');
    fillSlots(ol);
  }
  function buildCollab() {
    $('#collabItems').innerHTML = T().collab.items.map(it => `<div><dt>${it.t}</dt><dd>${it.s}</dd></div>`).join('');
    $('#footerLinks').innerHTML = T().glass.links.map(l => `<li><a class="btn btn-quiet" href="${l.href}" rel="noopener">${l.t}</a></li>`).join('');
    $('#year').textContent = num(new Date().getFullYear());
  }

  function fillSlots(root = document) {
    $$('.art-slot[data-art]', root).forEach(slot => {
      if ($('svg.art', slot)) return;
      const svg = artSvg(slot.dataset.art); if (svg) slot.appendChild(svg);
    });
  }

  function paintSound() {
    $$('.sound-toggle').forEach(b => { b.textContent = SND.enabled() ? T().sound.on : T().sound.off; b.setAttribute('aria-pressed', String(SND.enabled())); });
  }
  function applyLang() {
    const t = T();
    document.documentElement.lang = lang;
    document.documentElement.dir = t.dir;
    document.title = lang === 'fa' ? 'تادا لانژ · نُت جادویی طعم' : 'Tada Lounge · The magic note of flavor';
    $$('[data-t]').forEach(n => { const v = get(t, n.dataset.t); if (typeof v === 'string') n.textContent = v; });
    $$('.lang-toggle').forEach(b => { b.lang = lang === 'fa' ? 'en' : 'fa'; b.setAttribute('aria-label', t.langName); });
    $('#door').setAttribute('aria-label', 'تادا، TADA');
    if (door.arch) door.arch.setAttribute('d', archD());
    $('#muralImg').alt = t.glass.alt;
    $$('.tt-h[data-tt]').forEach(buildHeadline);
    buildPack(); buildMenu(); buildSteps(); buildCollab();
    paintStatus(); paintSound(); frameAll();
    requestAnimationFrame(fitAll);
  }

  // ======================================================================
  // The door: the logo of the glass, drawn by its own lines
  // ======================================================================
  const door = { svg: null, arch: null, hand: [], stars: [], words: [], mask: [], foot: null };
  function buildDoor() {
    const A = ART.arch, H = ART.hand, F = ART.wordFa, E = ART.wordEn;
    const svg = el('svg', { viewBox: A.vb.join(' '), 'aria-hidden': 'true', focusable: 'false' });
    const off = p => `translate(${(p.at[0] - A.at[0]).toFixed(1)} ${(p.at[1] - A.at[1]).toFixed(1)})`;
    door.arch = el('path', { d: archD(), class: 's', 'stroke-width': 9.85 }, svg);
    // the hand: its sparkles, and the hand itself shown through its own centerline as it writes
    const defs = el('defs', {}, svg);
    const mask = el('mask', { id: 'handMask', maskUnits: 'userSpaceOnUse', x: -200, y: -200, width: 2000, height: 2200 }, defs);
    const mg = el('g', { transform: `translate(${H.mask.t[0]} ${H.mask.t[1]})` }, mask);
    door.mask = H.mask.p.map(d => el('path', { d, fill: 'none', stroke: '#fff', 'stroke-width': 44, 'stroke-linecap': 'round', 'stroke-linejoin': 'round' }, mg));
    const hg = el('g', { transform: off(H) }, svg);
    const handG = el('g', { mask: 'url(#handMask)' }, hg);
    H.p.forEach(([d, k], i) => {
      if (i < 3) door.stars.push(el('path', { d, class: 'f' }, hg));
      else door.hand.push(el('path', { d, class: 'f' }, handG));
    });
    const wf = el('g', { transform: off(F) }, svg), we = el('g', { transform: off(E) }, svg);
    door.words = [
      ...F.p.map(([d, k, w]) => el('path', { d, class: k ? 'f' : 's', 'stroke-width': 9.85 * (w || 1) }, wf)),
      ...E.p.map(([d, k, w]) => el('path', { d, class: k ? 'f' : 's', 'stroke-width': 9.85 * (w || 1) }, we)),
    ];
    $('#door').prepend(svg);
    door.svg = svg;
    // the lowest sparkle is the magic itself
    door.low = door.stars.slice().sort((a, b) => b.getBBox().y - a.getBBox().y)[0];
    // the nav mark: the same hand, small
    const nm = el('svg', { viewBox: `${-8} ${-8} ${H.vb[2] + 16} ${H.vb[3] + 16}`, 'aria-hidden': 'true' });
    H.p.forEach(([d]) => el('path', { d, class: 'f' }, nm));
    $('#navMark').appendChild(nm);
  }
  // The arch (the designer's: a closed line, its right side a hair off plumb), started at the
  // bottom corner on the far side of the reading direction: up, over, down, and the threshold
  // last, so it ends exactly where the line of the page begins.
  function archD() {
    return RTL()
      ? 'M9.8 1718.2V710.9C9.8 323.7 306.8 9.8 673.1 9.8C1039.4 9.8 1336.3 323.7 1336.3 710.9L1342.9 1718.2H9.8'
      : 'M1342.9 1718.2L1336.3 710.9C1336.3 323.7 1039.4 9.8 673.1 9.8C306.8 9.8 9.8 323.7 9.8 710.9V1718.2H1342.9';
  }
  function archFeet() {
    const p = door.arch, L = p.getTotalLength();
    return { L, end: p.getPointAtLength(L) };
  }
  function dash(p, L, shown) { p.style.strokeDasharray = `${L} ${L}`; p.style.strokeDashoffset = shown ? 0 : L; }

  // ======================================================================
  // The line: a pen that never lifts, and the chains it lays in each part
  // ======================================================================
  const R0 = 18;
  const beadR = () => (small() ? 8 : 11);
  const H_BUDGET = len => Math.max(40, Math.min(220, len * 0.14));
  function makePen(svg, x, y, heading, sgn) {
    const V = { S: [0, 1], N: [0, -1], F: [sgn, 0], B: [-sgn, 0] };
    const links = [];
    let h = heading;
    const mk = (d, cls = 'ink-link') => el('path', { d, class: cls }, svg);
    const part = (p, reverse = false, ulen) => ({ el: p, ulen: ulen ?? p.getTotalLength(), reverse });
    const push = (parts, budget, extra = {}) => { const l = { parts, budget: Math.max(0, budget), onProgress: extra.onProgress || null, f: -1 }; links.push(l); return l; };
    const auto = (vx, dist) => (vx === 0 ? dist : H_BUDGET(dist));
    const api = {
      links, V,
      get x() { return x; }, get y() { return y; }, get h() { return h; },
      line(dist, budget, extra) {
        if (dist <= 0.5) { if (!(budget > 0)) return api; dist = 0.6; }
        const [vx, vy] = V[h], x2 = x + vx * dist, y2 = y + vy * dist;
        push([part(mk(`M${x} ${y}L${x2} ${y2}`))], budget ?? auto(vx, dist), extra);
        x = x2; y = y2; return api;
      },
      turn(to, budget, r = R0) {
        const [hx, hy] = V[h], [nx, ny] = V[to];
        if (r <= 0) { h = to; return api; }       // a square corner: the next run starts here
        const x2 = x + hx * r + nx * r, y2 = y + hy * r + ny * r;
        const sweep = hx * ny - hy * nx > 0 ? 1 : 0;
        push([part(mk(`M${x} ${y}A${r} ${r} 0 0 ${sweep} ${x2} ${y2}`))], budget ?? r * 1.2);
        x = x2; y = y2; h = to; return api;
      },
      // a hollow sparkle threaded on the line: the pen splits around it
      bead(budget, r = beadR(), extra) {
        const [dx, dy] = V[h], px = -dy, py = dx, w = r * 0.8, k = 0.58;
        const A = [x, y], O = [x + dx * r, y + dy * r], B = [x + dx * 2 * r, y + dy * 2 * r];
        const half = s => {
          const S = [O[0] + px * w * s, O[1] + py * w * s];
          const c = (P, f) => [P[0] + (O[0] - P[0]) * f, P[1] + (O[1] - P[1]) * f];
          const [a1, a2, b1, b2] = [c(A, k), c(S, k), c(S, k), c(B, k)];
          return `M${A[0]} ${A[1]}C${a1[0]} ${a1[1]} ${a2[0]} ${a2[1]} ${S[0]} ${S[1]}C${b1[0]} ${b1[1]} ${b2[0]} ${b2[1]} ${B[0]} ${B[1]}`;
        };
        push([part(mk(half(1), 'ink-link ink-bead')), part(mk(half(-1)))], budget ?? auto(dx, 2 * r), extra);
        x = B[0]; y = B[1]; return api;
      },
      // a station: a bead that wakes something when the pen reaches it
      station(onReach, budget) {
        let on = false;
        api.bead(budget, beadR(), { onProgress: f => { const v = f >= 0.5; if (v === on) return; on = v; onReach(v); } });
        return api;
      },
      cubic(c1, c2, end, budget, nextHeading) {
        const p = mk(`M${x} ${y}C${c1[0]} ${c1[1]} ${c2[0]} ${c2[1]} ${end[0]} ${end[1]}`);
        push([part(p)], budget ?? p.getTotalLength());
        x = end[0]; y = end[1]; if (nextHeading) h = nextHeading; return api;
      },
      to(y2, budget, extra) { return api.line(Math.abs(y2 - y), budget, extra); },
      toX(x2, budget, extra) { return api.line(Math.abs(x2 - x), budget, extra); },
    };
    return api;
  }

  const chains = [];
  let parked = false, siteReady = false, quiet = false, started = false;
  function setLink(l, f) {
    if (f === l.f) return;
    l.f = f;
    for (const pt of l.parts) {
      const drawn = f * pt.ulen;
      pt.el.style.strokeDashoffset = (pt.reverse ? -(pt.ulen - drawn) : pt.ulen - drawn) + 'px';
      pt.el.style.opacity = f > 0 ? 1 : 0;
    }
    l.onProgress && l.onProgress(f);
  }
  function primeLink(l) {
    for (const pt of l.parts) {
      pt.el.style.strokeDasharray = pt.ulen + 'px ' + (pt.ulen + 2) + 'px';
      pt.el.style.strokeDashoffset = (pt.reverse ? -pt.ulen : pt.ulen) + 'px';
      pt.el.style.opacity = 0;
    }
  }
  function draw(chain, p) {
    chain.p = p;
    const total = chain.links.reduce((s, l) => s + l.budget, 0) || 1;
    const L = p * total; let cum = 0, lastFull = null; chain.tip = null;
    for (const l of chain.links) {
      const f = l.budget === 0 ? (L >= cum ? 1 : 0) : Math.min(1, Math.max(0, (L - cum) / l.budget));
      setLink(l, f);
      if (!chain.tip && f > 0 && f < 1) { const pt = l.parts[0]; chain.tip = { el: pt.el, len: pt.reverse ? pt.ulen * (1 - f) : pt.ulen * f }; }
      if (f >= 1) { const pt = l.parts[0]; lastFull = { el: pt.el, len: pt.reverse ? 0 : pt.ulen }; }
      cum += l.budget;
    }
    if (!chain.tip && lastFull && p > 0 && p < 1) chain.tip = lastFull;
  }
  const startOf = c => { const pt = c.links[0].parts[0]; return { el: pt.el, len: pt.reverse ? pt.ulen : 0 }; };
  const endOf = c => { const pt = c.links[c.links.length - 1].parts[0]; return { el: pt.el, len: pt.reverse ? 0 : pt.ulen }; };
  function frontier() {
    for (let i = 0; i < chains.length; i++) {
      const c = chains[i];
      if (c.p >= 0.9999) continue;
      if (c.p <= 0) return { at: i > 0 ? endOf(chains[i - 1]) : startOf(c), chain: i > 0 ? chains[i - 1] : c };
      return { at: c.tip || startOf(c), chain: c };
    }
    return chains.length ? { at: endOf(chains[chains.length - 1]), chain: chains[chains.length - 1], done: true } : null;
  }
  const screenPoint = (elm, len) => {
    const p = elm.getPointAtLength(len), m = elm.getScreenCTM();
    return { x: m.a * p.x + m.c * p.y + m.e, y: m.b * p.x + m.d * p.y + m.f, lx: p.x, ly: p.y, s: Math.hypot(m.a, m.b) };
  };
  function addChain(name, host, pen, extra = {}) {
    const c = { name, host, links: pen.links, p: 0, raw: 0, tip: null, dark: host.dataset.surface === 'night', ...extra };
    c.links.forEach(primeLink);
    chains.push(c);
    return c;
  }
  // Two scrubbed chains can be in motion at once; the furthest one that has started
  // decides: every chain before it is whole, every chain after it empty. No holes.
  function resolve() {
    let k = -1;
    chains.forEach((c, i) => { if ((c.raw || 0) > 0) k = i; });
    chains.forEach((c, i) => {
      const want = i < k ? 1 : i > k ? 0 : c.raw;
      if (want !== c.p) draw(c, want);
    });
    endingCheck();
  }
  const triggers = [];
  function lineTrigger(c, opts) {
    const proxy = { p: 0 };
    // reduced motion: the line is simply there, whole and still
    if (reduce) { c.raw = 1; resolve(); return null; }
    const tw = gsap.to(proxy, {
      p: 1, ease: 'none',
      scrollTrigger: { trigger: c.host, scrub: fine ? 1.1 : 1.6, invalidateOnRefresh: true, ...opts },
      onUpdate: () => { c.raw = proxy.p; resolve(); },
    });
    triggers.push(tw);
    return tw;
  }
  // a chain is laid so that its head rides at the reading height (62% of the screen):
  // it starts when its first point reaches that height and lasts its whole budget
  const READ = 0.62;
  const chainRange = (c, y0 = 0) => {
    const total = c.links.reduce((s, l) => s + l.budget, 0);
    return { start: () => `top+=${Math.round(y0)} ${Math.round(READ * 100)}%`, end: () => `+=${Math.round(total)}` };
  };

  function sizeSvg(svg, w, h) {
    svg.setAttribute('width', w); svg.setAttribute('height', h);
    svg.setAttribute('viewBox', `0 0 ${w} ${h}`);
    svg.replaceChildren();
    svg.classList.remove('has-sky');
  }
  const rel = (r, o) => ({ x: r.left - o.left, y: r.top - o.top, w: r.width, h: r.height, r: r.right - o.left, b: r.bottom - o.top });
  // the two rails of the page: S on the reading start side, E on the far side
  function rails() {
    const box = $('#morning .container'), c = box.getBoundingClientRect(), W = vw();
    const pad = parseFloat(getComputedStyle(box).paddingLeft) || 64;
    const off = Math.max(10, Math.min(pad * 0.42, 30));
    const left = Math.max(10, c.left + off), right = Math.min(W - 10, c.right - off);
    return RTL() ? { S: right, E: left } : { S: left, E: right };
  }
  // the line in a sky band goes from one light to the other
  function skyGradient(svg, id, h, from, to) {
    const g = el('linearGradient', { id, gradientUnits: 'userSpaceOnUse', x1: 0, y1: 0, x2: 0, y2: h }, el('defs', {}, svg));
    [[0, from], [0.36, from], [0.7, to], [1, to]].forEach(([o, c]) => el('stop', { offset: o, 'stop-color': c }, g));
    svg.classList.add('has-sky');
    svg.style.setProperty('--sky-id', `url(#${id})`);
  }
  const CREAM = '#F6F0F8', PURPLE = '#662482';

  // ======================================================================
  // The head of the line, and the sparkles it sheds
  // ======================================================================
  const magic = $('#magic');
  magic.innerHTML = `<svg viewBox="0 0 44 44"><defs><radialGradient id="mg"><stop offset="0" stop-color="currentColor" stop-opacity=".55"/><stop offset=".45" stop-color="currentColor" stop-opacity=".18"/><stop offset="1" stop-color="currentColor" stop-opacity="0"/></radialGradient></defs>
    <circle class="m-glow" cx="22" cy="22" r="21" fill="url(#mg)"/>
    <g class="m-spin"><path class="m-star" d="${STAR_D}" transform="translate(22 22) scale(7.2)"/></g>
    <circle class="m-core" cx="22" cy="22" r="1.5"/></svg>`;
  const headState = { x: -100, y: -100, shown: false, lastLX: null, lastLY: null, lastEl: null, idle: 0 };
  const dust = $('#magicDust'), ctx = dust.getContext('2d');
  let dpr = 1, particles = [];
  function sizeDust() { dpr = Math.min(fine ? 2 : 1.5, devicePixelRatio || 1); dust.width = Math.round(vw() * dpr); dust.height = Math.round(innerHeight * dpr); }
  sizeDust();
  function spawn(elm, lx, ly, dark, burst = 1, o = {}) {
    const { spread = 6, speed = 26, sizeMin = 2, sizeMax = 4.4, bigChance = 0.22, life = 0.8, rise = 8, radial = false } = o;
    for (let i = 0; i < burst; i++) {
      if (particles.length > 120) particles.shift();
      const big = Math.random() < bigChance, a = radial ? (i / burst) * Math.PI * 2 + Math.random() * 0.6 : 0;
      particles.push({
        el: elm, lx: lx + (Math.random() - 0.5) * spread, ly: ly + (Math.random() - 0.5) * spread, dx: 0, dy: 0,
        vx: radial ? Math.cos(a) * speed * (0.6 + Math.random() * 0.6) : (Math.random() - 0.5) * speed,
        vy: radial ? Math.sin(a) * speed * (0.6 + Math.random() * 0.6) - rise : -rise - Math.random() * speed,
        size: big ? sizeMax + 1 + Math.random() * 2.5 : sizeMin + Math.random() * (sizeMax - sizeMin), rot: Math.random() * 6.28, vr: (Math.random() - 0.5) * 2.4,
        life: 0, max: life + Math.random() * 0.9 * life, dark, hue: Math.random() < 0.5, keep: !!o.keep,
      });
    }
  }
  // the logo stays exactly the designer's: no loose sparkles around it
  let zones = [];
  function zoneRects() {
    zones = [];
    for (const s of ['#door', '#navMark']) {
      const n = $(s); if (!n) continue;
      const r = n.getBoundingClientRect();
      if (r.width && r.bottom > -40 && r.top < innerHeight + 40) zones.push([r.left - 16, r.top - 16, r.right + 16, r.bottom + 16]);
    }
  }
  const inZone = (x, y) => zones.some(z => x > z[0] && x < z[2] && y > z[1] && y < z[3]);
  const HUG = { spread: 1.5, speed: 7, rise: 2.5, sizeMin: 1.5, sizeMax: 3.2, bigChance: 0.1, life: 0.75 };

  let lastT = performance.now(), zoneT = 0;
  function tick() {
    const now = performance.now(), dt = Math.min(0.05, (now - lastT) / 1000); lastT = now;
    if (siteReady) checkCards();
    if (!siteReady || reduce) return;
    if ((zoneT += dt) > 0.25) { zoneT = 0; zoneRects(); }
    const fr = parked ? null : frontier();
    if (fr) {
      const sp = screenPoint(fr.at.el, fr.at.len);
      headState.x = sp.x; headState.y = sp.y;
      magic.style.transform = `translate3d(${sp.x.toFixed(1)}px, ${sp.y.toFixed(1)}px, 0)`;
      const c = fr.chain;
      const dk = c.sky ? (c.sky.dark === 'top' ? sp.ly < c.sky.at : sp.ly > c.sky.at) : !!c.dark;
      magic.classList.toggle('on-dark', dk);
      if (!headState.shown) { headState.shown = true; gsap.to(magic, { opacity: 1, duration: 0.8, ease: 'power2.out' }); }
      if (headState.lastEl === fr.at.el && headState.lastLX != null) {
        const d = Math.hypot(sp.lx - headState.lastLX, sp.ly - headState.lastLY) * sp.s;
        if (d > 8) { spawn(fr.at.el, sp.lx, sp.ly, dk, d > 30 ? 2 : 1, HUG); headState.lastLX = sp.lx; headState.lastLY = sp.ly; headState.idle = 0; }
      } else { headState.lastEl = fr.at.el; headState.lastLX = sp.lx; headState.lastLY = sp.ly; }
      if ((headState.idle += dt) > 0.6) { headState.idle = 0; spawn(fr.at.el, sp.lx, sp.ly, dk, 1, HUG); }
    }
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, dust.width, dust.height);
    if (!particles.length) return;
    const ctm = new Map();
    const M = e => { let m = ctm.get(e); if (m === undefined) { m = e.getScreenCTM(); ctm.set(e, m); } return m; };
    particles = particles.filter(p => (p.life += dt) < p.max);
    for (const p of particles) {
      let m = null;
      if (p.el) { m = M(p.el); if (!m) continue; }
      p.dx += p.vx * dt; p.dy += p.vy * dt; p.vy += 10 * dt; p.vx *= 0.985; p.rot += p.vr * dt;
      const x = m ? m.a * p.lx + m.c * p.ly + m.e + p.dx : p.lx + p.dx, y = m ? m.b * p.lx + m.d * p.ly + m.f + p.dy : p.ly + p.dy;
      if (!p.keep && inZone(x, y)) { p.life = p.max; continue; }
      const t = p.life / p.max, a = Math.sin(Math.PI * Math.min(1, t * 1.4)) * (0.65 + 0.35 * Math.sin(now / 70 + p.size * 7));
      const sc = p.size * (1 - t * 0.55);
      ctx.globalCompositeOperation = p.dark ? 'lighter' : 'source-over';
      ctx.globalAlpha = Math.max(0, a);
      ctx.fillStyle = p.dark ? (p.hue ? '#FFFFFF' : '#CDB8D8') : (p.hue ? '#662482' : '#926D8F');
      const c = Math.cos(p.rot) * sc * dpr, s = Math.sin(p.rot) * sc * dpr;
      ctx.setTransform(c, s, -s, c, x * dpr, y * dpr);
      ctx.fill(starPath);
    }
    ctx.globalAlpha = 1; ctx.globalCompositeOperation = 'source-over';
  }
  gsap.ticker.add(tick);
  window.__tada = { chains, frontier, screenPoint }; // inspection hook

  // ======================================================================
  // The menu: one flavor at a time
  // ======================================================================
  let menuActive = -1, menuPin = null, menuTween = null;
  const $menu = $('#menu');
  function checkCards() {
    const r = $menu.getBoundingClientRect(); if (r.bottom < 0 || r.top > innerHeight) return;
    const cards = $$('#menuTrack .card'); if (!cards.length) return;
    const cx = vw() / 2;
    let best = 0, bd = Infinity;
    cards.forEach((c, i) => { const b = c.getBoundingClientRect(), d = Math.abs((b.left + b.right) / 2 - cx); if (d < bd) { bd = d; best = i; } });
    if (best === menuActive) return;
    menuActive = best;
    $$('#menuDots i').forEach((d, i) => d.classList.toggle('is-on', i === best));
    cards.forEach((c, i) => {
      const on = i === best;
      c.classList.toggle('is-front', on);
      c.setAttribute('aria-hidden', String(!on));
      $$('.card-arrow', c).forEach(b => {
        const end = (b.classList.contains('is-prev') && i === 0) || (b.classList.contains('is-next') && i === cards.length - 1);
        b.hidden = end; b.tabIndex = on ? 0 : -1;
      });
    });
    const front = cards[best];
    if (menuReached) wakeCard(front);
  }
  let menuReached = false;
  // the flavors draw themselves when the line reaches the menu, the one in front first;
  // each sounds its own note when it comes to the front
  function wakeMenu() {
    const cards = $$('#menuTrack .card'), k = Math.max(0, menuActive);
    cards.map((c, i) => [c, Math.abs(i - k)]).sort((a, b) => a[1] - b[1]).forEach(([c, d]) => {
      const a = $('.card-art svg.art', c), n = $('.card-name svg.tt', c);
      if (a) drawArt(a, { dur: 1.6, delay: d * 0.35 });
      if (n) drawArt(n, { dur: 0.9, delay: 0.25 + d * 0.35 });
    });
  }
  function wakeCard(card) {
    if (!card || card.__woke) return;
    card.__woke = true;
    if (siteReady && !quiet) sfx.tile(card.__i + 2);
  }
  function menuSnapsY() {
    if (!menuPin) return [];
    const n = $$('#menuTrack .card').length, a = menuPin.start, b = menuPin.end;
    return Array.from({ length: n }, (_, i) => a + (n > 1 ? i / (n - 1) : 0) * (b - a));
  }
  let snapTw = null;
  function scrollToY(y, dur) {
    if (snapTw) { snapTw.kill(); snapTw = null; }
    if (lenis) { lenis.scrollTo(y, { duration: dur, easing: t => 1 - Math.pow(1 - t, 3) }); return; }
    const o = { y: scrollY };
    snapTw = gsap.to(o, { y, duration: dur, ease: 'power2.inOut', onUpdate: () => window.scrollTo(0, o.y), onComplete: () => { snapTw = null; } });
  }
  function goMenu(k) {
    const ys = menuSnapsY(); if (!ys.length) return;
    k = Math.max(0, Math.min(ys.length - 1, k));
    const from = menuActive < 0 ? k : menuActive;
    scrollToY(ys[k], reduce ? 0.01 : Math.min(1.5, 0.8 + 0.22 * Math.abs(k - from)));
  }
  // when the scroll comes to rest inside the menu, it settles on one flavor
  let idleT = 0, touching = false, restY = 0;
  function trySnap() {
    if (touching || snapTw || reduce || !menuPin) return;
    const ys = menuSnapsY(), y = scrollY; if (ys.length < 2) return;
    if (y < ys[0] - 1 || y > ys[ys.length - 1] + 1) { restY = y; return; }
    let i = 0; while (i < ys.length - 2 && y > ys[i + 1]) i++;
    const f = (y - ys[i]) / Math.max(1, ys[i + 1] - ys[i]), dir = Math.sign(y - restY);
    const k = dir > 0 ? (f > 0.18 ? i + 1 : i) : dir < 0 ? (f < 0.82 ? i : i + 1) : (f < 0.5 ? i : i + 1);
    restY = ys[k];
    if (Math.abs(ys[k] - y) > 1.5) scrollToY(ys[k], 0.85);
  }
  const armSnap = () => { clearTimeout(idleT); idleT = setTimeout(trySnap, lenis ? 120 : 180); };
  addEventListener('scroll', () => { if (!snapTw) armSnap(); }, { passive: true });
  addEventListener('touchstart', () => { touching = true; if (snapTw) { snapTw.kill(); snapTw = null; } }, { passive: true });
  addEventListener('touchend', () => { touching = false; armSnap(); }, { passive: true });
  addEventListener('touchcancel', () => { touching = false; armSnap(); }, { passive: true });
  addEventListener('wheel', () => { if (snapTw) { snapTw.kill(); snapTw = null; } }, { passive: true });
  {
    const sgn = () => (RTL() ? -1 : 1);
    let x0 = 0, y0 = 0, side = null;
    $menu.addEventListener('touchstart', e => { const t = e.touches[0]; x0 = t.clientX; y0 = t.clientY; side = null; }, { passive: true });
    $menu.addEventListener('touchmove', e => {
      if (side !== null) return;
      const t = e.touches[0], dx = t.clientX - x0, dy = t.clientY - y0;
      if (Math.abs(dx) > 10 || Math.abs(dy) > 10) side = Math.abs(dx) > Math.abs(dy) * 1.15;
    }, { passive: true });
    $menu.addEventListener('touchend', e => {
      if (!side) return;
      const dx = e.changedTouches[0].clientX - x0; side = null;
      if (Math.abs(dx) < 32) return;
      touching = false;
      goMenu(Math.max(0, menuActive) + (dx * sgn() < 0 ? 1 : -1));
    }, { passive: true });
    let acc = 0, lock = 0;
    $menu.addEventListener('wheel', e => {
      if (Math.abs(e.deltaX) <= Math.abs(e.deltaY)) return;
      e.preventDefault(); e.stopPropagation();
      const now = performance.now(); if (now < lock) return;
      acc += e.deltaX; if (Math.abs(acc) < 36) return;
      goMenu(Math.max(0, menuActive) + (acc * sgn() > 0 ? 1 : -1)); acc = 0; lock = now + 650;
    }, { passive: false, capture: true });
    $('#menuTrack').addEventListener('click', e => {
      const b = e.target.closest('.card-arrow'); if (!b) return;
      e.stopPropagation(); sfx.nav();
      goMenu(Math.max(0, menuActive) + Number(b.dataset.dir));
    }, true);
    addEventListener('keydown', e => {
      if (e.key !== 'ArrowLeft' && e.key !== 'ArrowRight') return;
      if (e.altKey || e.ctrlKey || e.metaKey || (e.target.closest && e.target.closest('input, textarea, select, [contenteditable]'))) return;
      const r = $menu.getBoundingClientRect(); if (r.top > 2 || r.bottom < innerHeight - 2) return;
      e.preventDefault();
      goMenu(Math.max(0, menuActive) + ((e.key === 'ArrowRight' ? 1 : -1) * sgn() > 0 ? 1 : -1));
    });
  }

  // ======================================================================
  // The route through the page
  // ======================================================================
  let ending = null;
  function killRoute() {
    triggers.forEach(t => { if (t.scrollTrigger) t.scrollTrigger.kill(true); t.kill(); });
    triggers.length = 0; chains.length = 0;
    if (menuTween) menuTween.kill();
    menuPin = menuTween = null;
    gsap.set('#menuTrack', { x: 0 });
    particles = []; parked = false; ending = null;
  }

  function buildRoute() {
    killRoute();
    const sgn = RTL() ? -1 : 1, H = vh(), W = vw();
    const { S, E } = rails();
    const tops = {};
    const R = id => { const n = $(id), r = n.getBoundingClientRect(); return { n, r }; };

    // ---------------- hero: the line leaves the door from its far foot ----------------
    {
      const { n: host, r: hr } = R('#hero'), svg = $('.ink[data-ink="hero"]', host);
      sizeSvg(svg, hr.width, hr.height);
      const { end } = archFeet(), m = door.arch.getScreenCTM();
      const fx = m.a * end.x + m.c * end.y + m.e - hr.left, fy = m.b * end.x + m.d * end.y + m.f - hr.top;
      // the door's own line weight along the threshold, then the page's
      const doorW = 9.85 * Math.hypot(m.a, m.b);
      const ex = E - hr.left;
      const pen = makePen(svg, fx, fy, 'F', sgn);
      if (Math.abs(ex - fx) > R0 * 2 + 4) {
        pen.toX(ex - sgn * R0);
        svg.lastChild.style.strokeWidth = doorW.toFixed(2) + 'px';
        pen.turn('S');
      } else pen.turn('S', undefined, 0);
      pen.to(hr.height);
      const c = addChain('hero', host, pen);
      const rr = chainRange(c, fy);
      lineTrigger(c, { start: () => `top+=${Math.round(Math.max(0, fy - H * READ))} top`, end: rr.end });
    }

    // ---------------- morning: dawn, the headline, the sun and the kettle ----------------
    {
      const { n: host, r: hr } = R('#morning'), svg = $('.ink', host);
      sizeSvg(svg, hr.width, hr.height);
      const skyH = $('.sky', host).offsetHeight;
      const pen = makePen(svg, E - hr.left, 0, 'S', sgn);
      const h2 = $('.tt-h', host), sun = $('.art-sun svg', host), kettle = $('.art-kettle svg', host);
      const stops = [
        [rel(h2.getBoundingClientRect(), hr).y, () => writeHeadline(h2)],
        [rel(sun.getBoundingClientRect(), hr).y + 10, () => { drawArt(sun); sound('chapter'); }],
        [rel(kettle.getBoundingClientRect(), hr).y + 10, () => { drawArt(kettle); }],
      ].sort((a, b) => a[0] - b[0]);
      stations(pen, stops, hr.height);
      skyGradient(svg, 'skyMorning', skyH, CREAM, PURPLE);
      const c = addChain('morning', host, pen, { sky: { dark: 'top', at: skyH * 0.55 } });
      const rr = chainRange(c); lineTrigger(c, { start: rr.start, end: rr.end });
    }

    // ---------------- bar: from bean to cup ----------------
    {
      const { n: host, r: hr } = R('#bar'), svg = $('.ink', host);
      sizeSvg(svg, hr.width, hr.height);
      const pen = makePen(svg, E - hr.left, 0, 'S', sgn);
      const h2 = $('.tt-h', host), path = $('.art-path svg', host), esp = $('.art-espresso svg', host), pack = $('#pack');
      const stops = [
        [rel(h2.getBoundingClientRect(), hr).y, () => writeHeadline(h2)],
        [rel(path.getBoundingClientRect(), hr).y + 10, () => drawArt(path, { dur: 2.6 })],
        [rel(esp.getBoundingClientRect(), hr).y + 10, () => drawArt(esp)],
        [rel(pack.getBoundingClientRect(), hr).y + 20, () => pack.classList.add('is-on')],
      ].sort((a, b) => a[0] - b[0]);
      stations(pen, stops, hr.height);
      const c = addChain('bar', host, pen);
      const rr = chainRange(c); lineTrigger(c, { start: rr.start, end: rr.end });
    }

    // ---------------- menu: pinned; the line draws the staff the flavors hang from ----------------
    {
      const host = $menu, track = $('#menuTrack'), svg = $('.ink', host);
      const travel = Math.max(0, track.scrollWidth - W);
      const pinLen = Math.max(H * 0.9, travel * 1.25);
      if (!reduce) {
        menuTween = gsap.to(track, { x: () => (RTL() ? 1 : -1) * Math.max(0, track.scrollWidth - vw()), ease: 'none' });
        const st = ScrollTrigger.create({ trigger: host, start: 'top top', end: () => `+=${Math.round(pinLen)}`, pin: true, pinSpacing: true, animation: menuTween, scrub: fine ? 0.6 : 0.4, invalidateOnRefresh: true, anticipatePin: 1 });
        menuPin = st; triggers.push({ scrollTrigger: st, kill: () => {} });
      }
      const hr = host.getBoundingClientRect();
      sizeSvg(svg, hr.width, hr.height);
      const stage = rel($('#menuStage').getBoundingClientRect(), hr);
      const yStaff = stage.y - (small() ? 16 : 24);
      const pen = makePen(svg, E - hr.left, 0, 'S', sgn);
      const h2 = $('.tt-h', host);
      const hy = rel(h2.getBoundingClientRect(), hr).y;
      pen.to(Math.max(2, hy - beadR()), H * READ * 0.4);
      pen.station(on => { if (on) { writeHeadline(h2); menuReached = true; wakeMenu(); } }, 1);
      pen.to(yStaff - R0, H * READ * 0.5);
      pen.turn('B', 30);
      pen.toX(S - hr.left + sgn * R0, reduce ? 200 : pinLen);
      pen.turn('S', 30).to(hr.height, hr.height - yStaff);
      const c = addChain('menu', host, pen);
      const total = c.links.reduce((s, l) => s + l.budget, 0);
      lineTrigger(c, { start: () => `top ${Math.round(READ * 100)}%`, end: () => `+=${Math.round(total)}` });
    }

    // ---------------- evening: dusk, the magician's hat ----------------
    {
      const { n: host, r: hr } = R('#evening'), svg = $('.ink', host);
      sizeSvg(svg, hr.width, hr.height);
      const skyH = $('.sky', host).offsetHeight;
      const pen = makePen(svg, S - hr.left, 0, 'S', -sgn);
      const h2 = $('.tt-h', host), hat = $('.art-hat svg', host);
      const stops = [
        [rel(h2.getBoundingClientRect(), hr).y, () => writeHeadline(h2)],
        [rel(hat.getBoundingClientRect(), hr).y + 20, () => { drawArt(hat, { dur: 2 }); tadaBurst(hat); }],
      ].sort((a, b) => a[0] - b[0]);
      stations(pen, stops, hr.height);
      skyGradient(svg, 'skyEvening', skyH, PURPLE, CREAM);
      const c = addChain('evening', host, pen, { sky: { dark: 'bottom', at: skyH * 0.45 } });
      const rr = chainRange(c); lineTrigger(c, { start: rr.start, end: rr.end });
    }

    // ---------------- branches: three steps down ----------------
    {
      const { n: host, r: hr } = R('#branches'), svg = $('.ink', host);
      sizeSvg(svg, hr.width, hr.height);
      const pen = makePen(svg, S - hr.left, 0, 'S', sgn);
      const h2 = $('.tt-h', host);
      const steps = $$('.step', host);
      const reach = (li, i) => on => {
        li.classList.toggle('is-reached', on);
        if (on) { drawArt($('svg.art', li)); sound('tile', i + 4); }
      };
      pen.to(Math.max(2, rel(h2.getBoundingClientRect(), hr).y - beadR()));
      pen.station(on => on && writeHeadline(h2));
      if (innerWidth > 900) {
        // stairs: a tread under each branch, a riser down to the next
        steps.forEach((li, i) => {
          const r = rel(li.getBoundingClientRect(), hr);
          const yT = r.b, farEdge = RTL() ? r.x : r.r;
          pen.to(yT);
          pen.turn('F', 0);
          const xEnd = i === steps.length - 1 ? E - hr.left : farEdge + sgn * 6;
          const run = Math.abs(xEnd - pen.x);
          // the tread wakes its branch half way along
          pen.line(run * 0.5).station(reach(li, i), 30).line(Math.max(0, run * 0.5 - 2 * beadR()));
          pen.turn('S', 0);
        });
        pen.to(hr.height);
      } else {
        steps.forEach((li, i) => {
          const r = rel(li.getBoundingClientRect(), hr);
          pen.to(Math.max(pen.y + 2, r.y + 6));
          pen.station(reach(li, i));
        });
        // then across to the far side in one long, soft sweep
        const y0 = pen.y + 20, y1 = hr.height, k = (y1 - y0) * 0.6, xe = E - hr.left;
        pen.to(y0);
        pen.cubic([pen.x, y0 + k], [xe, y1 - k], [xe, y1], undefined, 'S');
      }
      const c = addChain('branches', host, pen);
      const rr = chainRange(c); lineTrigger(c, { start: rr.start, end: rr.end });
    }

    // ---------------- order: the road ----------------
    {
      const { n: host, r: hr } = R('#order'), svg = $('.ink', host);
      sizeSvg(svg, hr.width, hr.height);
      const pen = makePen(svg, E - hr.left, 0, 'S', sgn);
      const h2 = $('.tt-h', host), road = $('#road'), rr0 = rel(road.getBoundingClientRect(), hr);
      const scooter = $('.art-scooter', road), palm = $('.art-palm svg', road);
      pen.to(Math.max(2, rel(h2.getBoundingClientRect(), hr).y - beadR()));
      pen.station(on => on && writeHeadline(h2));
      const yRoad = rr0.b + 2;
      pen.to(yRoad - R0);
      pen.turn('B');
      const x0 = pen.x, xEnd = S - hr.left + sgn * R0, span = Math.abs(xEnd - x0);
      const sw = scooter.offsetWidth, roadW = road.offsetWidth, palmW = $('.art-palm', road).offsetWidth;
      const drive = Math.max(0, roadW - sw - palmW - 24);
      pen.line(span, Math.max(260, span * 0.55), {
        onProgress: f => {
          if (f > 0.02) { drawArt($('svg.art', scooter), { dur: 1.2 }); }
          if (f > 0.7) drawArt(palm, { dur: 1.6 });
          gsap.set(scooter, { x: (RTL() ? 1 : -1) * drive * Math.min(1, f * 1.08) });
        },
      });
      pen.turn('S').to(hr.height);
      const c = addChain('order', host, pen);
      const rr = chainRange(c); lineTrigger(c, { start: rr.start, end: rr.end });
    }

    // ---------------- collab ----------------
    {
      const { n: host, r: hr } = R('#collab'), svg = $('.ink', host);
      sizeSvg(svg, hr.width, hr.height);
      const pen = makePen(svg, S - hr.left, 0, 'S', -sgn);
      const h2 = $('.tt-h', host);
      pen.to(Math.max(2, rel(h2.getBoundingClientRect(), hr).y - beadR()));
      pen.station(on => on && writeHeadline(h2));
      pen.to(hr.height);
      const c = addChain('collab', host, pen);
      const rr = chainRange(c); lineTrigger(c, { start: rr.start, end: rr.end });
    }

    // ---------------- the glass: the line finds the hand and snaps ----------------
    {
      const { n: host, r: hr } = R('#glass'), svg = $('.ink', host);
      sizeSvg(svg, hr.width, hr.height);
      const img = $('#muralImg'), ir = img.getBoundingClientRect();
      // the lowest sparkle above the hand, on the glass (mural units)
      const LOW = [3991.3, 2385.2], MW = 8022, MH = 5754;
      const tx = ir.left + (LOW[0] / MW) * ir.width - hr.left, ty = ir.top + (LOW[1] / MH) * ir.height - hr.top;
      const fr = rel($('#muralFrame').getBoundingClientRect(), hr);
      const pen = makePen(svg, S - hr.left, 0, 'S', -sgn);
      const yBend = Math.max(20, fr.y - 30);
      pen.to(yBend);
      const k = (ty - yBend) * 0.55;
      pen.cubic([pen.x, yBend + k], [tx, ty - k * 0.9], [tx, ty], undefined, 'S');
      const c = addChain('glass', host, pen, { last: true });
      const total = c.links.reduce((s, l) => s + l.budget, 0);
      // the line arrives as the glass settles in the middle of the screen
      lineTrigger(c, { start: () => `top ${Math.round(READ * 100)}%`, end: () => `+=${Math.round(total)}` });
      ending = { x: tx, y: ty, host, svg };
      // the glass shows itself around the door as the line comes
      const frame = $('#muralFrame');
      const tw = gsap.fromTo(frame, { '--r': 0 }, { '--r': 100, ease: 'none', scrollTrigger: { trigger: frame, start: 'top 92%', end: 'center 55%', scrub: 1.2, invalidateOnRefresh: true } });
      triggers.push(tw);
      // (on phones the glass stays still around the door: the line must land on the hand)
    }

    // the nav takes the colour of the part under it
    $$('[data-surface]', $('main')).concat([$('#glass')]).forEach(sec => {
      const sky = $(':scope > .sky', sec), at = sky ? sky.offsetHeight * 0.55 : 0;
      const st = ScrollTrigger.create({
        trigger: sec, start: () => `top+=${Math.round(at)} ${Math.round(navH() / 2)}px`, end: () => `bottom ${Math.round(navH() / 2)}px`,
        onToggle: s => { if (s.isActive) $('#nav').dataset.ink = sec.dataset.surface; },
      });
      triggers.push({ scrollTrigger: st, kill: () => {} });
    });
  }
  const navH = () => $('#nav').offsetHeight || 72;
  // stations along a vertical run, then on to the bottom
  function stations(pen, stops, bottom) {
    for (const [y, fn] of stops) {
      const at = Math.max(pen.y + 2, y - beadR());
      if (at + 2 * beadR() > bottom - 4) continue;
      pen.to(at);
      pen.station(on => on && fn());
    }
    pen.to(bottom);
  }
  function sound(name, arg) { if (siteReady && !quiet && sfx[name]) sfx[name](arg); }
  // the hat: «تادا!»
  function tadaBurst(svg) {
    if (reduce || quiet) return;
    sound('tada');
    const r = svg.getBoundingClientRect();
    setTimeout(() => spawn(null, r.left + r.width * 0.72, r.top + r.height * 0.2, true, 14, { radial: true, speed: 60, spread: 6, life: 1, rise: 6, sizeMax: 5 }), 900);
  }

  // ---------- the ending: the hand snaps, the magic takes its place ----------
  let snapped = false;
  function endingCheck() {
    const c = chains[chains.length - 1];
    if (!c || !c.last || !ending) return;
    if (c.p >= 0.999 && !snapped) {
      snapped = true; parked = true;
      gsap.to(magic, { opacity: 0, scale: 0.4, duration: 0.5, ease: 'power2.in' });
      if (!reduce && !quiet) {
        sound('snap');
        const hr = ending.host.getBoundingClientRect();
        spawn(null, hr.left + ending.x, hr.top + ending.y, true, 16, { radial: true, speed: 54, spread: 4, life: 1.1, rise: 4, keep: true });
      }
    } else if (c.p < 0.995 && snapped) {
      snapped = false; parked = false;
      gsap.to(magic, { opacity: 1, scale: 1, duration: 0.5, ease: 'power2.out' });
    }
  }

  // ======================================================================
  // Lenis, nav, phone menu, cursor, sound
  // ======================================================================
  let lenis = null;
  function setupLenis() {
    if (!window.Lenis || reduce || !fine) return;
    lenis = new Lenis({ lerp: 0.085, smoothWheel: true, syncTouch: false });
    lenis.on('scroll', ScrollTrigger.update);
    gsap.ticker.add(t => lenis.raf(t * 1000));
    gsap.ticker.lagSmoothing(0);
    gsap.ticker.remove(tick); gsap.ticker.add(tick);   // the head after the scroll, never behind the line
  }
  function goTo(id) {
    const target = $(id); if (!target) return;
    const y = id === '#top' ? 0 : target.getBoundingClientRect().top + scrollY - (id === '#menu' ? 0 : 6);
    if (lenis) lenis.scrollTo(y, { duration: 1.6 }); else scrollTo({ top: y, behavior: reduce ? 'auto' : 'smooth' });
  }
  $$('.nav-links a, .nav-mark').forEach(a => a.addEventListener('click', e => {
    const id = a.getAttribute('href'); if (!id || !id.startsWith('#')) return;
    e.preventDefault(); sfx.nav(); goTo(id);
  }));
  addEventListener('scroll', () => $('#nav').classList.toggle('is-scrolled', scrollY > 40), { passive: true });

  const mm = $('#mMenu');
  const outside = () => [$('main'), $('footer'), $('.nav-links'), $('.nav-mark')];
  function openMenu() {
    mm.hidden = false; $('#menuBtn').setAttribute('aria-expanded', 'true');
    outside().forEach(n => n && (n.inert = true));
    lenis && lenis.stop(); document.documentElement.style.overflow = 'hidden';
    if (!reduce) gsap.fromTo(mm, { opacity: 0 }, { opacity: 1, duration: 0.45, ease: 'power2.out' });
    if (!reduce) gsap.fromTo($$('.mmenu-links a', mm), { opacity: 0, y: 14 }, { opacity: 1, y: 0, duration: 0.6, stagger: 0.05, ease: 'power2.out', delay: 0.05 });
    sfx.nav();
    $('.mmenu-close', mm).focus();
  }
  function closeMenu(then) {
    const done = () => {
      mm.hidden = true; $('#menuBtn').setAttribute('aria-expanded', 'false');
      outside().forEach(n => n && (n.inert = false));
      document.documentElement.style.overflow = ''; lenis && lenis.start();
      if (then) then(); else $('#menuBtn').focus();
    };
    if (reduce) done(); else gsap.to(mm, { opacity: 0, duration: 0.3, ease: 'power1.in', onComplete: done });
  }
  $('#menuBtn').addEventListener('click', openMenu);
  $('.mmenu-close', mm).addEventListener('click', () => closeMenu());
  mm.addEventListener('keydown', e => {
    if (e.key === 'Escape') { closeMenu(); return; }
    if (e.key !== 'Tab') return;
    const f = $$('a, button', mm).filter(n => !n.hidden && n.offsetParent !== null), a = f[0], b = f[f.length - 1];
    if (e.shiftKey && document.activeElement === a) { e.preventDefault(); b.focus(); }
    else if (!e.shiftKey && document.activeElement === b) { e.preventDefault(); a.focus(); }
  });
  $$('.mmenu-links a', mm).forEach(a => a.addEventListener('click', e => { e.preventDefault(); const id = a.getAttribute('href'); closeMenu(() => goTo(id)); }));

  $$('.sound-toggle').forEach(b => b.addEventListener('click', () => { SND.toggle(); paintSound(); if (SND.enabled()) sfx.enable(); }));
  // sound wakes with the first touch (a browser rule); every link and button answers softly
  const wake = () => SND.unlock();
  addEventListener('pointerdown', wake, { passive: true }); addEventListener('keydown', wake);
  document.addEventListener('click', e => { const b = e.target.closest('a, button'); if (b && !b.classList.contains('sound-toggle')) sfx.tap(); });

  // the cursor shows the dots of the glass where it passes
  const aura = $('#aura');
  if (fine && !reduce) {
    addEventListener('pointermove', e => {
      if (e.pointerType !== 'mouse') return;
      aura.style.setProperty('--mx', e.clientX + 'px'); aura.style.setProperty('--my', e.clientY + 'px');
      if (!aura.classList.contains('is-on') && siteReady) aura.classList.add('is-on');
    }, { passive: true });
    document.documentElement.addEventListener('mouseleave', () => aura.classList.remove('is-on'));
  }

  // ======================================================================
  // The entrance: the door draws itself while the site loads
  // ======================================================================
  function preload(onProgress) {
    const parts = {};
    const set = (k, v) => { parts[k] = v; const ks = Object.keys(parts); onProgress(ks.reduce((a, q) => a + parts[q], 0) / ks.length); };
    const jobs = [];
    set('fonts', 0); jobs.push(document.fonts.ready.then(() => set('fonts', 1)));
    if (document.readyState === 'complete') set('page', 1);
    else { set('page', 0); jobs.push(new Promise(r => addEventListener('load', () => { set('page', 1); r(); }, { once: true }))); }
    return Promise.all(jobs);
  }
  const firstVisit = (() => { try { return !sessionStorage.getItem('tada.door'); } catch { return true; } })();
  const sides = () => [$('.sill'), $('.hero-words'), $('.hero-hours'), $('.hero-cue'), $('#nav')];

  function enterDoor() {
    return new Promise(resolve => {
      const { L } = archFeet();
      door.arch.style.strokeDasharray = `${L} ${L + 2}`;
      door.arch.style.strokeDashoffset = L;
      const maskL = door.mask.map(p => { const l = p.getTotalLength(); dash(p, l, false); return l; });
      const wordL = door.words.map(p => { const l = p.getTotalLength(); dash(p, l, false); return l; });
      gsap.set(door.stars, { opacity: 0, scale: 0, transformOrigin: '50% 50%', transformBox: 'fill-box' });
      gsap.set(sides(), { opacity: 0 });
      const tagline = $('.hero-tagline svg.art'), insta = $('#heroInsta svg.art'), tadaIr = $('.order-link svg.art');
      [tagline, insta, tadaIr].forEach(s => s && prepDraw(s));
      let done = false, tl = null;
      const finish = () => {
        if (done) return; done = true;
        try { sessionStorage.setItem('tada.door', '1'); } catch {}
        removeEventListener('wheel', skip); removeEventListener('touchstart', skip); removeEventListener('keydown', skip);
        document.documentElement.style.overflow = '';
        resolve();
      };
      const skip = () => { if (tl) tl.progress(1); };
      const quick = !firstVisit;
      const k = quick ? 0.42 : 1;
      // the arch: it follows the loading, and never rushes
      const shown = { v: 0 };
      const archAt = v => { door.arch.style.strokeDashoffset = L * (1 - v); };
      const minArch = 1.9 * k;
      const archTw = gsap.to(shown, { v: 0.9, duration: minArch, ease: 'power1.inOut', onUpdate: () => archAt(shown.v) });
      sfx.introDraw && sound0('introDraw');
      document.documentElement.style.overflow = 'hidden';
      Promise.all([preload(() => {}), new Promise(r => setTimeout(r, minArch * 1000))]).then(() => {
        archTw.kill();
        tl = gsap.timeline({ onComplete: finish });
        tl.to(shown, { v: 1, duration: 0.45 * k, ease: 'power2.out', onUpdate: () => archAt(shown.v) });
        // the hand writes itself along its own line
        const handDur = 2.1 * k, total = maskL.reduce((a, b) => a + b, 0);
        let t = 0.1;
        door.mask.forEach((p, i) => { const d = Math.max(0.12, handDur * maskL[i] / total); tl.to(p, { strokeDashoffset: 0, duration: d, ease: 'power1.inOut', onStart: () => sound0('pen') }, i ? '>-0.04' : '>0.05'); t += d; });
        // snap: the three sparkles
        tl.add(() => { sound0('snap'); burstAt(door.low, 10); }, '+=0.05');
        tl.to(door.stars, { opacity: 1, scale: 1, duration: 0.55, stagger: 0.09, ease: 'back.out(2.6)' }, '<');
        // the wordmarks
        tl.to(door.words, { strokeDashoffset: 0, duration: 0.5 * k, stagger: 0.06 * k, ease: 'power1.inOut' }, '+=0.15');
        tl.add(() => sound0('land'));
        tl.add(() => { drawArt(tagline, { dur: 1.6 }); }, '-=0.2');
        tl.to(sides(), { opacity: 1, duration: 1.1 * (quick ? 0.7 : 1), stagger: 0.12, ease: 'power2.out' }, '<');
        tl.add(() => { drawArt(insta, { dur: 1.2 }); drawArt(tadaIr, { dur: 1.2 }); }, '<0.3');
        tl.to('.hero-cue', { opacity: 0.85, duration: 1 }, '<0.4');
        addEventListener('wheel', skip, { passive: true }); addEventListener('touchstart', skip, { passive: true }); addEventListener('keydown', skip);
      });
    });
  }
  function sound0(name) { if (!reduce && sfx[name]) sfx[name](); }
  function burstAt(pathEl, n) {
    if (reduce) return;
    const b = pathEl.getBBox(), m = pathEl.getScreenCTM(); if (!m) return;
    const x = m.a * (b.x + b.width / 2) + m.e, y = m.d * (b.y + b.height / 2) + m.f;
    spawn(null, x, y, true, n, { radial: true, speed: 46, spread: 3, life: 0.9, rise: 2, keep: false });
  }
  function showDoorNow() {
    door.arch.style.strokeDasharray = ''; door.arch.style.strokeDashoffset = '';
    door.mask.forEach(p => { p.style.strokeDasharray = ''; p.style.strokeDashoffset = ''; });
    door.words.forEach(p => { p.style.strokeDasharray = ''; p.style.strokeDashoffset = ''; });
  }

  // ======================================================================
  // Start
  // ======================================================================
  function prepWaiting() {
    // everything the line will wake starts unseen
    $$('main svg.art').forEach(s => { if (!s.closest('#hero')) prepDraw(s); });
    $$('.tt-h svg.tt').forEach(s => { if (!s.closest('.tt-h').__drawn) prepDraw(s); });
  }
  function startSite() {
    siteReady = true; started = true;
    setupLenis();
    quiet = true;
    buildRoute();
    ScrollTrigger.refresh();
    quiet = false;
    if (reduce) {
      gsap.set('.hero-cue', { opacity: 0.85 });
      // nothing waits for the line: every part is whole and still
      $$('svg.art, svg.tt').forEach(s => drawArt(s, { instant: true }));
      $$('.tt-h').forEach(h => (h.__drawn = true));
      chains.forEach(c => draw(c, 1));
    }
  }

  buildDoor();
  fillSlots();
  applyLang();
  frameAll();
  fitAll();
  if (reduce) {
    showDoorNow();
    $$('svg.art, svg.tt').forEach(s => drawArt(s, { instant: true }));
    startSite();
  } else {
    prepWaiting();
    enterDoor().then(startSite);
  }

  // ---------- language, resize ----------
  async function rebuild() {
    if (!started) return;
    quiet = true;
    fitAll();
    buildRoute();
    ScrollTrigger.refresh();
    quiet = false;
  }
  $$('.lang-toggle').forEach(b => b.addEventListener('click', async () => {
    const wasOpen = !mm.hidden;
    lang = lang === 'fa' ? 'en' : 'fa';
    try { localStorage.setItem('tada.lang', lang); } catch {}
    killRoute();
    const drawnHeads = new Set($$('.tt-h').filter(h => h.__drawn).map(h => h.dataset.tt));
    applyLang();
    $$('.tt-h').forEach(h => { if (drawnHeads.has(h.dataset.tt)) { h.__drawn = true; const s = $('svg.tt', h); if (s) drawArt(s, { instant: true }); } else { const s = $('svg.tt', h); if (s) prepDraw(s); } });
    $$('#menuTrack svg.art, #menuTrack svg.tt, #steps svg.art').forEach(s => prepDraw(s));
    if (wasOpen) closeMenu();
    await document.fonts.ready;
    rebuild();
  }));
  if ('ResizeObserver' in window) {
    const seen = new Map();
    const ro = new ResizeObserver(entries => {
      let moved = false;
      for (const en of entries) {
        const w = Math.round(en.contentRect.width), h = Math.round(en.contentRect.height), k = seen.get(en.target);
        if (k && (Math.abs(k[0] - w) > 1 || Math.abs(k[1] - h) > 1)) moved = true;
        seen.set(en.target, [w, h]);
      }
      if (moved && started) { clearTimeout(rz); rz = setTimeout(rebuild, 260); }
    });
    ['#morning .container', '#bar .container', '#menu .menu-head', '#evening .container', '#branches .container', '#order .container', '#collab .container', '#muralFrame'].forEach(s => { const n = $(s); if (n) ro.observe(n); });
  }
  let rz, lastW = innerWidth;
  addEventListener('resize', () => {
    sizeDust(); fitAll();
    if (Math.abs(innerWidth - lastW) < 2 && !fine) return;   // phones: the address bar comes and goes
    lastW = innerWidth;
    clearTimeout(rz); rz = setTimeout(rebuild, 220);
  });
})();
