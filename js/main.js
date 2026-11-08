// TADA Lounge — site script
// -------------------------
// Language (fa/en), the loader hand-off, the scroll-scrubbed hero film, the menu
// track, the nav, sound, the cursor, and the Tada magic: one continuous line with a
// glowing head that is born from the logotype's last foot, draws the shippo lattice,
// star beads and the menu shelf, and at the very end draws the footer hand, which
// snaps and takes the magic back as its lowest sparkle.
//
// Classic script; depends on gsap, ScrollTrigger, (Lenis), BRAND, SITE, CONTENT,
// TadaLoader, TadaSound.

(function () {
  'use strict';

  const { buildHandSvg, buildWordmarkSvg, addSnapHelpers, prepSnap, addSnap, playLoader, shouldPlayLoader, HAND, el } = window.TadaLoader;
  const SND = window.TadaSound;
  const sfx = SND.sfx;
  const [VX, VY, VW, VH] = HAND.viewBox;
  const WORD = BRAND.wordmark;
  const LOW = HAND.stars[2];                 // the lowest (and smallest) sparkle: the magic itself
  const C = { x: 487.5, y: 404 };            // contact point of the snap
  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => [...r.querySelectorAll(s)];
  const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const small = () => innerWidth < 768;
  const fine = matchMedia('(pointer: fine)').matches;   // a mouse: the costly extras are for it only
  const vh = () => innerHeight;
  gsap.registerPlugin(ScrollTrigger);
  ScrollTrigger.config({ ignoreMobileResize: true });

  // ======================================================================
  // Language and content
  // ======================================================================
  let lang = 'fa';
  try { lang = localStorage.getItem('tada.lang') || 'fa'; } catch {}
  if (!CONTENT[lang]) lang = 'fa';
  const T = () => CONTENT[lang];
  const RTL = () => T().dir === 'rtl';
  const SGN = () => (RTL() ? -1 : 1);        // +x toward the far edge of the reading direction
  const num = v => (lang === 'fa' ? faDigits(v) : String(v));
  const get = (obj, path) => path.split('.').reduce((o, k) => (o == null ? o : o[k]), obj);

  function paintSound() {
    $$('.sound-toggle').forEach(b => { b.textContent = SND.enabled() ? T().sound.on : T().sound.off; b.setAttribute('aria-pressed', String(SND.enabled())); });
  }

  // a kit sparkle as a tiny standalone svg (for labels)
  const sparkSvg = (cls, star = HAND.stars[1]) =>
    `<svg class="${cls}" viewBox="${star.cx - star.r} ${star.cy - star.r} ${2 * star.r} ${2 * star.r}" aria-hidden="true"><path d="${star.d}"/></svg>`;
  const tileSvg = () => `<svg viewBox="0 0 100 100" aria-hidden="true"><path fill-rule="evenodd" d="${BRAND.patternTile.d}"/></svg>`;

  function applyLang() {
    const t = T();
    document.documentElement.lang = lang;
    document.documentElement.dir = t.dir;
    document.title = lang === 'fa' ? 'تادا لانژ' : 'Tada Lounge';
    $$('[data-t]').forEach(n => { const v = get(t, n.dataset.t); if (typeof v === 'string') n.textContent = v; });
    $('#langToggle').lang = lang === 'fa' ? 'en' : 'fa';
    $('#langToggle').textContent = t.langSwitch;

    // hero overlays
    const caps = $('#heroCaptions'); caps.replaceChildren();
    t.hero.chapters.forEach((c, i) => {
      const d = document.createElement('div');
      d.className = 'hero-cap' + (i === t.hero.chapters.length - 1 ? ' is-tada' : '');
      d.innerHTML = '<b></b><span></span>';
      d.firstChild.textContent = c.t; d.lastChild.textContent = c.s;
      caps.appendChild(d);
    });

    buildMenu();

    // collaboration
    const ci = $('#collabItems'); ci.replaceChildren();
    t.collab.items.forEach(it => {
      const dt = document.createElement('dt'), dd = document.createElement('dd');
      dt.textContent = it.t; dd.textContent = it.s; ci.append(dt, dd);
    });

    // branches
    const rows = $('#branchRows'); rows.replaceChildren();
    t.branches.list.forEach(b => {
      const li = document.createElement('li');
      li.innerHTML = '<span class="row-name"></span><span class="row-addr"></span><a class="link row-route" target="_blank" rel="noopener"></a>';
      li.children[0].textContent = b.name; li.children[1].textContent = b.addr;
      li.children[2].textContent = t.branches.route; li.children[2].href = b.map;
      rows.appendChild(li);
    });
    const hours = $('#branchHours');
    if (t.branches.hours) hours.textContent = t.branches.hours;
    else hours.innerHTML = '<span class="placeholder">[[CITY]]</span> · <span class="placeholder">[[HOURS]]</span>'; // TODO: client data

    // footer
    const fl = $('#footerLinks'); fl.replaceChildren();
    t.footer.links.forEach(l => {
      const li = document.createElement('li'); const a = document.createElement('a');
      a.className = 'link'; a.href = l.href; a.rel = 'noopener'; a.textContent = l.t; li.appendChild(a); fl.appendChild(li);
    });
    $('#year').textContent = num(new Date().getFullYear());
    $('#footerLockup').innerHTML = '<img src="assets/brand/tada-wordmark-tagline_purple.svg" alt="" width="240" height="177">';
    paintSound();
  }

  // ---------- the menu track: labels in the kit palette ----------
  // the ring of the label in front lights up as the menu slides
  let dotOn = -1;
  function setDot(p) {
    const dots = $$('#menuDots i'); if (!dots.length) return;
    const k = Math.round(Math.min(1, Math.max(0, p)) * (dots.length - 1));
    if (k === dotOn && dots[k].classList.contains('is-on')) return;
    dotOn = k; dots.forEach((d, i) => d.classList.toggle('is-on', i === k));
  }
  function buildMenu() {
    const t = T(), track = $('#menuTrack');
    $$('.label', track).forEach(n => n.remove());
    $('#menuDots').innerHTML = '<i></i>'.repeat(t.menu.items.length);
    dotOn = -1; setDot(0);
    t.menu.items.forEach(it => {
      const lab = document.createElement('article');
      lab.className = 'label';
      lab.dataset.tone = it.tone;
      if (it.kind === 'pack') {
        const p = t.product;
        lab.innerHTML = `<div class="pack-grid"><svg class="pouch" viewBox="0 0 320 440" aria-hidden="true"></svg><div class="pack-text">
          <h3 class="label-name"></h3><p class="label-sub"></p>
          <dl class="specs"></dl><p class="pack-note flag"></p><div class="rulers"></div>
          <p class="pack-cta"><a class="link" href="${SITE.shop}" rel="noopener"></a></p></div></div>`;
        $('.label-name', lab).textContent = p.title;
        $('.label-sub', lab).textContent = p.size;
        $('.pack-note', lab).textContent = p.profileFlag;
        $('.pack-note', lab).title = p.profileNote;
        $('.pack-cta a', lab).textContent = p.cta;
        const specs = $('.specs', lab);
        p.specs.forEach(([k, v]) => { const dt = document.createElement('dt'), dd = document.createElement('dd'); dt.textContent = k; dd.textContent = v; specs.append(dt, dd); });
        const rulers = $('.rulers', lab);
        p.profile.forEach(([label, v]) => {
          const row = document.createElement('div'); row.className = 'ruler';
          const idx = Math.min(9, Math.max(0, Math.round(v / 10) - 1));
          row.innerHTML = `<span></span><span class="ruler-scale" aria-hidden="true">${'<i></i>'.repeat(10)}</span><span class="ruler-val"></span>`;
          row.firstChild.textContent = label; row.lastChild.textContent = num(v);
          row.querySelectorAll('i')[idx].classList.add('is-val');
          row.setAttribute('aria-label', `${label} ${v}`);
          rulers.appendChild(row);
        });
        buildPouch($('.pouch', lab));
      } else {
        lab.innerHTML = `${sparkSvg('label-spark')}<h3 class="label-name"></h3><p class="label-sub"></p><p class="label-note"></p><div class="label-band" aria-hidden="true">${tileSvg().repeat(6)}</div>`;
        $('.label-name', lab).textContent = it.name;
        $('.label-sub', lab).textContent = it.sub;
        $('.label-note', lab).textContent = it.note;
      }
      dressLabel(lab);
      track.appendChild(lab);
    });
  }

  // the 1 kg pouch: kit lockup on a white label, and a shippo band that lights up
  function buildPouch(svg) {
    svg.replaceChildren();
    const g = el('g', {}, svg);
    el('path', { d: 'M40 62 L280 62 L286 400 Q286 420 266 420 L54 420 Q34 420 34 400 Z', fill: '#662482' }, g);
    el('path', { d: 'M40 40 H280 V62 H40 Z', fill: '#35084C' }, g);
    [70, 110, 150, 190, 230].forEach(x => el('path', { d: `M${x} 44 V58`, stroke: '#662482', 'stroke-width': 2, 'stroke-linecap': 'round' }, g));
    el('path', { d: 'M54 400 Q160 412 266 400', fill: 'none', stroke: '#35084C', 'stroke-width': 2 }, g);
    el('rect', { x: 70, y: 110, width: 180, height: 240, rx: 6, fill: '#FFFFFF' }, g);
    el('image', { href: 'assets/brand/tada-lockup-horizontal_purple.svg', x: 90, y: 122, width: 140, height: 100, preserveAspectRatio: 'xMidYMid meet' }, g);
    const band = el('g', { class: 'pouch-band' }, g);
    for (let i = 0; i < 6; i++) {
      const tile = el('svg', { x: 70 + i * 30, y: 236, width: 30, height: 30, viewBox: '0 0 100 100', class: 'pouch-tile' }, band);
      el('path', { d: BRAND.patternTile.d, 'fill-rule': 'evenodd', fill: '#662482' }, tile);
      tile.style.opacity = reduce ? 1 : 0;
      tile.style.transition = 'opacity .6s cubic-bezier(.16,1,.3,1)';
    }
    el('rect', { x: 70, y: 282, width: 180, height: 68, fill: '#678438' }, g);
    const p = T().product.pack;
    const tx = (y, size, w, s) => { const n = el('text', { x: 160, y, 'text-anchor': 'middle', 'font-size': size, 'font-weight': w }, g); n.textContent = s; };
    tx(304, 14, 500, p.label); tx(325, 12.5, 300, p.sub); tx(345, 12.5, 400, p.weight);
  }

  // ======================================================================
  // The Tada magic: geometry
  // ======================================================================
  const R0 = 22;                                   // corner radius of every turn
  const beadR = () => (small() ? 9 : 12);          // star beads threaded on the line
  const H_BUDGET = len => Math.max(48, len * 0.16); // scroll px per px of sideways ink

  // A pen that lays a chain of links on an svg, each link starting exactly where the
  // previous one ended, so the line can never break. Headings: S (down), F (toward
  // the far edge), B (back toward the start edge).
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
        if (dist <= 0.5) return api;
        const [vx, vy] = V[h], x2 = x + vx * dist, y2 = y + vy * dist;
        push([part(mk(`M${x} ${y}L${x2} ${y2}`))], budget ?? auto(vx, dist), extra);
        x = x2; y = y2; return api;
      },
      turn(to, budget, r = R0) {
        const [hx, hy] = V[h], [nx, ny] = V[to];
        const x2 = x + hx * r + nx * r, y2 = y + hy * r + ny * r;
        const sweep = hx * ny - hy * nx > 0 ? 1 : 0;
        push([part(mk(`M${x} ${y}A${r} ${r} 0 0 ${sweep} ${x2} ${y2}`))], budget ?? r * 1.2);
        x = x2; y = y2; h = to; return api;
      },
      // A hollow kit-style sparkle threaded on the line: the pen splits around it.
      bead(budget, r = beadR()) {
        const [dx, dy] = V[h], px = -dy, py = dx, w = r * 0.8, k = 0.58;
        const A = [x, y], O = [x + dx * r, y + dy * r], B = [x + dx * 2 * r, y + dy * 2 * r];
        const half = s => {
          const S = [O[0] + px * w * s, O[1] + py * w * s];
          const c = (P, f) => [P[0] + (O[0] - P[0]) * f, P[1] + (O[1] - P[1]) * f];
          const [a1, a2, b1, b2] = [c(A, k), c(S, k), c(S, k), c(B, k)];
          return `M${A[0]} ${A[1]}C${a1[0]} ${a1[1]} ${a2[0]} ${a2[1]} ${S[0]} ${S[1]}C${b1[0]} ${b1[1]} ${b2[0]} ${b2[1]} ${B[0]} ${B[1]}`;
        };
        push([part(mk(half(1), 'ink-link ink-bead')), part(mk(half(-1)))], budget ?? auto(dx, 2 * r));
        x = B[0]; y = B[1]; return api;
      },
      // A row of semicircles alternating over and under the line: the edge of the shippo tiles.
      shippo(n, D, budget, extra) {
        if (n <= 0) return api;
        const [vx] = V[h]; const r = D / 2; let d = `M${x} ${y}`, cx = x;
        for (let i = 0; i < n; i++) { cx += vx * D; const over = i % 2 === 0; d += `A${r} ${r} 0 0 ${over === (vx > 0) ? 1 : 0} ${cx} ${y}`; }
        push([part(mk(d))], budget ?? H_BUDGET(n * D), extra);
        x = cx; return api;
      },
      // The shippo lattice (overlapping circles, the kit pattern) drawn as one stroke:
      // rows of circles traced under-then-over, joined by quarter arcs. Enters and leaves
      // heading down at the same x, so it threads onto a vertical run without a seam.
      lattice(rows, n, r, budget) {
        const x0 = x, y0 = y, X = u => x0 + sgn * u;
        let d = `M${x} ${y}`;
        const semi = (u1, u2, yy, over) => { const dir = Math.sign(sgn * (u2 - u1)); d += `A${r} ${r} 0 0 ${over === (dir > 0) ? 1 : 0} ${X(u2)} ${yy}`; };
        const quarter = (pu, py, qu, qy, cu, cy) => {
          const ax = X(pu) - X(cu), ay = py - cy, bx = X(qu) - X(cu), by = qy - cy;
          d += `A${r} ${r} 0 0 ${ax * by - ay * bx > 0 ? 1 : 0} ${X(qu)} ${qy}`;
        };
        for (let k = 0; k < rows; k++) {
          const odd = k % 2, yk = y0 + r * k, count = n - odd, us = r * odd;
          for (let i = 0; i < count; i++) semi(us + 2 * r * i, us + 2 * r * (i + 1), yk, false);
          for (let i = count; i > 0; i--) semi(us + 2 * r * i, us + 2 * r * (i - 1), yk, true);
          if (k < rows - 1) {
            if (!odd) quarter(0, yk, r, yk + r, r, yk);
            else quarter(r, yk, 0, yk + r, r, yk + r);
          }
        }
        push([part(mk(d))], budget);
        y = y0 + r * (rows - 1); h = 'S'; return api;
      },
      cubic(c1, c2, end, budget, nextHeading) {
        const p = mk(`M${x} ${y}C${c1[0]} ${c1[1]} ${c2[0]} ${c2[1]} ${end[0]} ${end[1]}`);
        push([part(p)], budget ?? p.getTotalLength());
        x = end[0]; y = end[1]; if (nextHeading) h = nextHeading; return api;
      },
      // pen in the air: the head travels, no ink is laid
      hop(end, budget) {
        const mx = (x + end[0]) / 2, my = (y + end[1]) / 2 - Math.max(10, Math.hypot(end[0] - x, end[1] - y) * 0.35);
        const p = mk(`M${x} ${y}Q${mx} ${my} ${end[0]} ${end[1]}`, 'ink-ghost');
        push([part(p)], budget ?? p.getTotalLength() * 0.3);
        x = end[0]; y = end[1]; return api;
      },
      // an existing stroke (the footer hand), drawn forward or reversed
      stroke(p, ulen, reverse, budget, end) {
        push([part(p, reverse, ulen)], budget);
        x = end[0]; y = end[1]; return api;
      },
      to(y2, budget, extra) { return api.line(Math.abs(y2 - y), budget, extra); },
    };
    return api;
  }

  // ======================================================================
  // The Tada magic: drawing, the head and its sparkles
  // ======================================================================
  const chains = [];          // in page order: { name, links, p, dark, host }
  let parked = false, birthDone = false, siteReady = false;

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
      pt.el.__rev = !!pt.reverse;
      pt.el.style.strokeDasharray = pt.ulen + 'px';
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

  // where the pen is now: the first unfinished chain decides
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

  // the head
  const magic = $('#magic');
  magic.innerHTML = `<svg viewBox="0 0 44 44"><defs><radialGradient id="mg"><stop offset="0" stop-color="currentColor" stop-opacity=".6"/><stop offset=".45" stop-color="currentColor" stop-opacity=".2"/><stop offset="1" stop-color="currentColor" stop-opacity="0"/></radialGradient></defs>
    <circle class="m-glow" cx="22" cy="22" r="21" fill="url(#mg)"/>
    <g class="m-spin"><path class="m-star" d="${LOW.d}" transform="translate(22 22) scale(.42) translate(${-LOW.cx} ${-LOW.cy})"/></g>
    <circle class="m-core" cx="22" cy="22" r="1.6"/></svg>`;
  const headState = { x: -100, y: -100, shown: false, lastLX: null, lastLY: null, lastEl: null, idle: 0 };

  // the sparkles it sheds: a canvas over the page, particles anchored to the path they came from
  const dust = $('#magicDust'), ctx = dust.getContext('2d');
  const starPath = new Path2D(LOW.d);
  let dpr = 1, particles = [];
  function sizeDust() { const de = document.documentElement; dpr = Math.min(fine ? 2 : 1.5, devicePixelRatio || 1); dust.width = Math.round(de.clientWidth * dpr); dust.height = Math.round(de.clientHeight * dpr); }
  sizeDust();
  // el: the path a particle belongs to (it then scrolls with the page); null = screen space
  function spawn(elm, lx, ly, dark, burst = 1, o = {}) {
    const { spread = 6, speed = 26, sizeMin = 2, sizeMax = 4.6, bigChance = 0.25, life = 0.8, rise = 8, radial = false } = o;
    for (let i = 0; i < burst; i++) {
      if (particles.length > 120) particles.shift();
      const big = Math.random() < bigChance;
      const a = radial ? (i / burst) * Math.PI * 2 + Math.random() * 0.6 : 0;
      particles.push({
        el: elm, lx: lx + (Math.random() - 0.5) * spread, ly: ly + (Math.random() - 0.5) * spread,
        dx: 0, dy: 0,
        vx: radial ? Math.cos(a) * speed * (0.6 + Math.random() * 0.6) : (Math.random() - 0.5) * speed,
        vy: radial ? Math.sin(a) * speed * (0.6 + Math.random() * 0.6) - rise : -rise - Math.random() * speed,
        size: big ? sizeMax + 1 + Math.random() * 3 : sizeMin + Math.random() * (sizeMax - sizeMin), rot: Math.random() * 6.28, vr: (Math.random() - 0.5) * 3,
        life: 0, max: life + Math.random() * 0.9 * life, dark, hue: Math.random() < 0.5, keep: !!o.keep,
      });
    }
  }
  // ---------- the logo stays the kit's own: no loose sparkles around it ----------
  // Free sparkles (the head's, the motes, the twinkles) vanish inside these zones, so the
  // footer hand shows exactly the mark with its three sparkles, and the logotype stays clean.
  let zones = [];
  function zoneRects() {
    zones = [];
    for (const s of ['#footerHand', '#heroWord', '#navMark']) {
      const n = $(s); if (!n) continue;
      const r = n.getBoundingClientRect();
      if (r.width && r.bottom > -40 && r.top < innerHeight + 40) zones.push([r.left - 20, r.top - 20, r.right + 20, r.bottom + 20]);
    }
  }
  const inZone = (x, y) => zones.some(z => x > z[0] && x < z[2] && y > z[1] && y < z[3]);
  // sparkles shed on the line stay on the line
  const HUG = { spread: 1.5, speed: 7, rise: 2.5, sizeMin: 1.6, sizeMax: 3.4, bigChance: 0.12, life: 0.75 };
  // the cursor, for the line's response and the parallax
  const mouse = { x: -1e4, y: -1e4, on: false };
  addEventListener('pointermove', e => { if (e.pointerType !== 'mouse') return; mouse.x = e.clientX; mouse.y = e.clientY; mouse.on = true; }, { passive: true });
  document.documentElement.addEventListener('mouseleave', () => { mouse.on = false; });

  // ---------- product labels: the magic frames them ----------
  // When the pen reaches a label, a thin frame draws itself around it, the label lifts off
  // the paper with a sweep of light, four kit sparkles open at the corners, and it settles.
  const starMini = cls => `<svg class="${cls}" viewBox="${LOW.cx - LOW.r} ${LOW.cy - LOW.r} ${2 * LOW.r} ${2 * LOW.r}" aria-hidden="true"><path d="${LOW.d}"/></svg>`;
  function dressLabel(lab) {
    lab.insertAdjacentHTML('beforeend',
      `<svg class="label-frame" aria-hidden="true"><rect x="0" y="0" width="100%" height="100%" pathLength="1"/></svg>` +
      `<span class="label-light" aria-hidden="true"><i class="label-sheen"></i><i class="label-glare"></i></span>` +
      ['ts', 'te', 'bs', 'be'].map(c => `<span class="label-corner is-${c}" aria-hidden="true">${starMini('')}</span>`).join(''));
    gsap.set($$('.label-corner', lab), { scale: 0, opacity: 0 });
    if (reduce || !matchMedia('(pointer: fine)').matches) return;
    // the label leans toward the cursor and a soft light follows it
    gsap.set(lab, { transformPerspective: 1000 });
    const rx = gsap.quickTo(lab, 'rotationX', { duration: 0.7, ease: 'power3.out' });
    const ry = gsap.quickTo(lab, 'rotationY', { duration: 0.7, ease: 'power3.out' });
    lab.addEventListener('pointermove', e => {
      const r = lab.getBoundingClientRect(), u = (e.clientX - r.left) / r.width - 0.5, v = (e.clientY - r.top) / r.height - 0.5;
      rx(-v * 6); ry(u * 6);
      lab.style.setProperty('--gx', `${(u + 0.5) * 100}%`); lab.style.setProperty('--gy', `${(v + 0.5) * 100}%`);
      lab.classList.add('is-hover');
    });
    lab.addEventListener('pointerleave', () => { rx(0); ry(0); lab.classList.remove('is-hover'); });
  }
  const restShadow = '0 22px 50px -32px rgba(53, 8, 76, .38), 0 0 0 1px rgba(102, 36, 130, .12)';
  function frameLabel(lab, on) {
    const rect = $('.label-frame rect', lab), corners = $$('.label-corner', lab), sheen = $('.label-sheen', lab);
    if (!rect) return;
    if (lab.__ftl) lab.__ftl.kill();
    lab.classList.toggle('is-framed', on);
    if (reduce) { gsap.set(rect, { strokeDashoffset: on ? 0 : 1 }); gsap.set(corners, { scale: on ? 1 : 0, opacity: on ? 1 : 0 }); return; }
    const tl = lab.__ftl = gsap.timeline();
    // slow and calm: the frame draws, the label lifts with a sweep of light, settles
    const lift = fine ? { y: -12, scale: 1.025, boxShadow: '0 48px 90px -34px rgba(53, 8, 76, .5), 0 0 0 1px rgba(102, 36, 130, .2)' } : { y: -8, scale: 1.02 };
    const rest = fine ? { y: 0, scale: 1, boxShadow: restShadow } : { y: 0, scale: 1 };
    if (on) {
      tl.to(rect, { strokeDashoffset: 0, duration: 1.9, ease: 'power2.inOut' }, 0)
        .to(lab, { ...lift, duration: 1.0, ease: 'power2.out' }, 0.15)
        .fromTo(sheen, { xPercent: -140, opacity: 1 }, { xPercent: 260, duration: 1.9, ease: 'power1.inOut' }, 0.25)
        .fromTo(corners, { scale: 0, rotation: -45, opacity: 0 }, { scale: 1, rotation: 0, opacity: 1, duration: 0.9, stagger: 0.14, ease: 'back.out(2)' }, 1.0)
        .add(() => { const fr = $('.label-frame', lab); spawn(fr, 0, 0, false, fine ? 4 : 2, { radial: true, speed: 18, spread: 2, life: 0.9, rise: 0 }); }, 1.05)
        .to(lab, { ...rest, duration: 1.5, ease: 'power2.inOut' }, 1.4);
    } else {
      tl.to(corners, { scale: 0, opacity: 0, duration: 0.4, ease: 'power2.in' }, 0)
        .to(rect, { strokeDashoffset: 1, duration: 0.8, ease: 'power2.inOut' }, 0)
        .to(lab, { y: 0, scale: 1, duration: 0.6 }, 0)
        .set(lab, { clearProps: 'boxShadow' });
    }
  }
  // the pen has passed the label and the label is fully on screen: only then it is framed
  function checkLabels() {
    const vw = document.documentElement.clientWidth, H = innerHeight;
    for (const lab of document.querySelectorAll('#menuTrack .label')) {
      const want = !!lab.__want;
      if (want === !!lab.__shown) continue;
      if (want) {
        const r = lab.getBoundingClientRect();
        if (r.left < -2 || r.right > vw + 2 || r.top < 0 || r.bottom > H) continue;
      }
      lab.__shown = want;
      frameLabel(lab, want);
      if (want) sfx.tile(lab.__i || 0);
    }
  }

  // ---------- the cursor wakes the pattern ----------
  // Under the mouse, the shippo pattern of the section lights up in a soft halo; a second,
  // slower halo trails behind, so the place the cursor left fades out gently.
  const AURA_HOSTS = ['#heroStage', '#story', '#menu', '#branches', '#collab', '#footer'];
  let auras = [], auraMoved = 0;
  function buildAuras() {
    if (reduce || !fine) return;
    auras = AURA_HOSTS.map(sel => {
      const host = $(sel); if (!host) return null;
      const n = document.createElement('div');
      n.className = 'bg-aura'; n.setAttribute('aria-hidden', 'true');
      host.prepend(n);
      return { host, n, ax: 0, ay: 0, bx: 0, by: 0, o: 0, seen: false, vis: false, max: sel === '#heroStage' ? 0.34 : 0.46 };
    }).filter(Boolean);
    addEventListener('pointermove', e => { if (e.pointerType === 'mouse') auraMoved = performance.now(); }, { passive: true });
  }
  function auraStep(dt, now) {
    if (!auras.length) return;
    const moving = now - auraMoved < 160;
    for (const a of auras) {
      const r = a.host.getBoundingClientRect();
      if (r.bottom < 0 || r.top > innerHeight) { if (a.vis) { a.n.style.opacity = 0; a.vis = false; a.o = 0; } continue; }
      const inside = mouse.on && mouse.x >= r.left && mouse.x <= r.right && mouse.y >= r.top && mouse.y <= r.bottom;
      const tx = mouse.x - r.left, ty = mouse.y - r.top;
      if (inside) {
        if (!a.seen) { a.ax = a.bx = tx; a.ay = a.by = ty; a.seen = true; }
        const k1 = 1 - Math.exp(-dt * 8), k2 = 1 - Math.exp(-dt * 1.4);
        a.ax += (tx - a.ax) * k1; a.ay += (ty - a.ay) * k1;
        a.bx += (tx - a.bx) * k2; a.by += (ty - a.by) * k2;
      }
      const target = inside ? (moving ? 1 : 0.5) : 0;
      a.o += (target - a.o) * (1 - Math.exp(-dt * (target > a.o ? 2.6 : 0.65)));   // wakes softly, fades slowly
      if (a.o < 0.004) { if (a.vis) { a.n.style.opacity = 0; a.vis = false; } if (!inside) a.seen = false; continue; }
      a.vis = true;
      const st = a.n.style;
      st.opacity = (a.o * a.max).toFixed(3);
      st.setProperty('--ax', a.ax.toFixed(1) + 'px'); st.setProperty('--ay', a.ay.toFixed(1) + 'px');
      st.setProperty('--bx', a.bx.toFixed(1) + 'px'); st.setProperty('--by', a.by.toFixed(1) + 'px');
    }
  }

  // ---------- quiet brand motifs behind the sections ----------
  // A cloud of the shippo pattern and a few hollow kit sparkles, very faint, slowly turning;
  // they drift a little against the cursor (depth = how far).
  const MOTIFS = {
    hero:     { cloud: [12, 74, 520], stars: [[20, 24, 96, 0.6], [7, 50, 44, 1], [64, 88, 60, 0.8]] },
    story:    { cloud: [86, 78, 480], stars: [[6, 16, 124, 0.5], [44, 90, 52, 0.9]] },
    branches: { cloud: [10, 32, 440], stars: [[86, 84, 84, 0.6], [30, 10, 40, 1]] },
    collab:   { cloud: [80, 22, 420], stars: [[12, 72, 112, 0.5], [58, 90, 44, 0.9]] },
  };
  // the mark's three sparkles, as they sit in the kit
  const trio = (() => {
    const S = HAND.stars, x0 = Math.min(...S.map(t => t.cx - t.r)), y0 = Math.min(...S.map(t => t.cy - t.r));
    const x1 = Math.max(...S.map(t => t.cx + t.r)), y1 = Math.max(...S.map(t => t.cy + t.r));
    return `<svg viewBox="${x0} ${y0} ${x1 - x0} ${y1 - y0}" aria-hidden="true">${S.map(t => `<path d="${t.d}"/>`).join('')}</svg>`;
  })();
  function buildMotifs() {
    for (const id in MOTIFS) {
      const host = id === 'hero' ? $('#heroStage') : $('#' + id); if (!host) continue;
      const m = MOTIFS[id], box = document.createElement('div');
      box.className = 'bg-motif'; box.setAttribute('aria-hidden', 'true');
      box.innerHTML = `<i class="motif-layer motif-cloud" data-depth="0.35" style="inset-inline-start:${m.cloud[0]}%;top:${m.cloud[1]}%;--s:${m.cloud[2]}px"></i>` +
        m.stars.map(([x, y, s, d], i) => `<span class="motif-layer motif-star" data-depth="${d}" style="inset-inline-start:${x}%;top:${y}%;--s:${Math.round(s * 1.5)}px;--spin:${11 + i * 3}s">${trio}</span>`).join('');
      host.prepend(box);
    }
    if (reduce || !matchMedia('(pointer: fine)').matches) return;
    const layers = $$('.motif-layer').map(n => ({ d: +n.dataset.depth, x: gsap.quickTo(n, 'x', { duration: 1.4, ease: 'power3.out' }), y: gsap.quickTo(n, 'y', { duration: 1.4, ease: 'power3.out' }) }));
    addEventListener('pointermove', e => {
      if (e.pointerType !== 'mouse') return;
      const u = e.clientX / innerWidth - 0.5, v = e.clientY / innerHeight - 0.5;
      for (const l of layers) { l.x(-u * 34 * l.d); l.y(-v * 24 * l.d); }
    }, { passive: true });
  }

  // ---------- the living ink ----------
  // Everything the magic has made stays alive: glints of light run inside the drawn
  // strokes the way the pen went (the line, beads, shippo, the lattice, the logotype,
  // the cup, the footer hand), shedding motes that lift off and fade, and the kit
  // stars and beads twinkle. Only what is drawn and on screen is used; the drawn part
  // of each stroke is read from its own dash, so it follows the pen exactly.
  const LIVE_SEL = '.ink path.ink-link, #heroScene path.sc:not(.sc-markline)';
  const TWINKLE_SEL = '#heroScene .sc-star, .label-band.is-lit svg, .label-spark, .ink path.ink-bead';
  const live = { src: [], tw: [], total: 0, at: -1e9, acc: 0, tacc: 0, nG: 0, ms: 0 };
  let flows = [];
  const opCache = new Map();
  function effOpacity(n) {
    let o = 1;
    for (let k = n; k && k !== document.body; k = k.parentElement) {
      let v = opCache.get(k);
      if (v === undefined) {
        const cs = getComputedStyle(k);
        v = cs.display === 'none' || cs.visibility === 'hidden' ? 0 : parseFloat(cs.opacity);
        opCache.set(k, v);
      }
      o *= v; if (o < 0.05) return 0;
    }
    return o;
  }
  // the drawn stretch [a, b] of a stroke, read from its dash pattern
  function drawnRange(p, L) {
    const cs = getComputedStyle(p);
    if (cs.stroke === 'none' || !(parseFloat(cs.strokeWidth) > 0)) return null;
    const da = cs.strokeDasharray;
    if (!da || da === 'none') return [0, L];
    const nums = da.split(/[\s,]+/).map(parseFloat).filter(n => !isNaN(n));
    if (!nums.length) return [0, L];
    const D = nums[0], P = D + (nums.length > 1 ? nums[1] : nums[0]);
    if (!(P > 0)) return [0, L];
    const o = parseFloat(cs.strokeDashoffset) || 0;
    let best = null;
    for (let k = Math.floor(o / P) - 1; k <= Math.ceil((L + o) / P) + 1; k++) {
      const a = Math.max(0, k * P - o), b = Math.min(L, k * P - o + D);
      if (b - a > (best ? best[1] - best[0] : 0.5)) best = [a, b];
    }
    return best;
  }
  const onScreen = (r, m = 24) => r.width + r.height > 1 && r.bottom > -m && r.top < innerHeight + m && r.right > -m && r.left < innerWidth + m;
  const isDark = n => { const h = n.closest('[data-surface]'); return !!h && h.dataset.surface === 'dark'; };
  function refreshLive(now) {
    live.at = now; opCache.clear();
    const src = [], tw = []; let total = 0;
    for (const p of document.querySelectorAll(LIVE_SEL)) {
      if (!onScreen(p.getBoundingClientRect()) || effOpacity(p) < 0.25) continue;
      const L = p.__len || (p.__len = p.getTotalLength()); if (L < 4) continue;
      const rg = drawnRange(p, L); if (!rg || rg[1] - rg[0] < 3) continue;
      const m = p.getScreenCTM(); if (!m) continue;
      const sc = Math.hypot(m.a, m.b), w = (rg[1] - rg[0]) * sc;
      p.__live = { a: rg[0], b: rg[1], sc, dark: isDark(p), dir: p.__rev ? -1 : 1, line: p.classList.contains('ink-link') };
      src.push({ el: p, w }); total += w;
    }
    for (const n of document.querySelectorAll(TWINKLE_SEL)) {
      if (!onScreen(n.getBoundingClientRect(), 0) || effOpacity(n) < 0.3) continue;
      let cx, cy, r;
      if (n.classList.contains('ink-bead')) {           // a bead: its centre, once fully drawn
        const L = n.__len || (n.__len = n.getTotalLength()), rg = drawnRange(n, L);
        if (!rg || rg[1] - rg[0] < L - 1) continue;
        const A = n.getPointAtLength(0), B = n.getPointAtLength(L);
        cx = (A.x + B.x) / 2; cy = (A.y + B.y) / 2; r = 4.5;
      } else {
        const bb = n.getBBox(), m = n.getScreenCTM(); if (!m || !bb.width) continue;
        cx = bb.x + bb.width / 2; cy = bb.y + bb.height / 2;
        r = Math.min(7, Math.max(3, bb.width * Math.hypot(m.a, m.b) * 0.32));
      }
      tw.push({ el: n, cx, cy, r, dark: isDark(n) });
    }
    live.src = src; live.tw = tw; live.total = total;
    live.inkW = parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--ink-w')) || 3;
  }
  // a long pen path (shippo rows, the lattice) split into one helper per segment, so a
  // point lookup measures a single arc instead of walking the whole path
  let segHost = null;
  function segs(p) {
    if (p.__segs !== undefined) return p.__segs;
    p.__segs = null;
    const d = p.getAttribute('d') || '';
    if (!/^[MLACQ\d\s.,eE+\-]+$/.test(d)) return null;
    const cmds = d.match(/[MLACQ][^MLACQ]*/g);
    if (!cmds || cmds.length < 6) return null;
    if (!segHost) { segHost = document.createElementNS('http://www.w3.org/2000/svg', 'svg'); segHost.setAttribute('aria-hidden', 'true'); segHost.style.cssText = 'position:absolute;width:0;height:0;overflow:hidden;visibility:hidden'; document.body.appendChild(segHost); }
    const out = []; let cur = null, cum = 0;
    for (const c of cmds) {
      const nums = c.slice(1).trim().split(/[\s,]+/).map(Number);
      if (c[0] !== 'M' && cur) {
        const e = document.createElementNS('http://www.w3.org/2000/svg', 'path');
        e.setAttribute('d', `M${cur[0]} ${cur[1]}${c}`); segHost.appendChild(e);
        const L = e.getTotalLength(); out.push({ e, a: cum, L }); cum += L;
      }
      cur = [nums[nums.length - 2], nums[nums.length - 1]];
    }
    p.__segs = out.length ? out : null;
    return p.__segs;
  }
  // a point on a stroke, cached per unit of length: walking a long shippo or lattice
  // path every frame is what costs, so each point is measured once
  function pathPt(p, s) {
    const L = p.__len || (p.__len = p.getTotalLength()), n = Math.ceil(L);
    let c = p.__pc; if (!c) c = p.__pc = new Float32Array((n + 1) * 2).fill(NaN);
    const i = Math.max(0, Math.min(n, Math.round(s)));
    if (Number.isNaN(c[2 * i])) {
      const sg = segs(p); let q;
      if (sg) {                                          // find the one segment, measure only it
        let lo = 0, hi = sg.length - 1;
        while (lo < hi) { const mid = (lo + hi + 1) >> 1; if (sg[mid].a <= i) lo = mid; else hi = mid - 1; }
        q = sg[lo].e.getPointAtLength(Math.max(0, Math.min(sg[lo].L, i - sg[lo].a)));
      } else q = p.getPointAtLength(Math.min(L, i));
      c[2 * i] = q.x; c[2 * i + 1] = q.y;
    }
    return { x: c[2 * i], y: c[2 * i + 1] };
  }
  function pickSource() {
    let x = Math.random() * live.total;
    for (const s of live.src) { x -= s.w; if (x <= 0) return s.el; }
    return live.src.length ? live.src[live.src.length - 1].el : null;
  }
  function liveStep(dt, now, M) {
    zoneRects();
    if (now - live.at > (small() ? 420 : 220)) refreshLive(now);
    const S = small(), maxFlows = S ? 24 : 110;
    // glints: as many as the ink on screen can carry
    const rate = Math.min(S ? 3 : 9, live.total * (S ? 0.004 : 0.007));
    live.acc += dt * rate;
    while (live.acc >= 1) {
      live.acc -= 1;
      if (live.nG >= (S ? 6 : 20) || !live.src.length) continue;
      live.nG++;
      const elm = pickSource(), L = elm && elm.__live; if (!L) continue;
      const speed = 20 + Math.random() * 24;
      flows.push({ k: 'g', el: elm, s: L.a + Math.random() * (L.b - L.a), v: speed / L.sc, life: 0, max: 2.6 + Math.random() * 2.2, trail: [], shed: Math.random() * 0.1, big: Math.random() < 0.22, edge: 0 });
    }
    // twinkles on the kit stars and beads
    live.tacc += dt * (live.tw.length ? (S ? 0.4 : 0.9) : 0);
    while (live.tacc >= 1) {
      live.tacc -= 1;
      if (!live.tw.length || flows.length >= maxFlows + 12) continue;
      const t = live.tw[(Math.random() * live.tw.length) | 0];
      flows.push({ k: 't', el: t.el, lx: t.cx, ly: t.cy, r: t.r * (0.8 + Math.random() * 0.5), dark: t.dark, life: 0, max: 0.8 + Math.random() * 0.5, rot: Math.random() * 0.8 });
    }
    const add = []; live.nG = 0;
    flows = flows.filter(f => {
      f.life += dt;
      if (f.life >= f.max) return false;
      if (f.k !== 'g') return true;
      const L = f.el.__live; if (!L) return false;
      f.s += L.dir * f.v * dt;
      const left = (L.dir > 0 ? L.b - f.s : f.s - L.a) * L.sc;
      if (left <= 0 || f.s < L.a - 1 || f.s > L.b + 1) return false;
      f.edge = Math.min(1, left / 16, ((L.dir > 0 ? f.s - L.a : L.b - f.s) * L.sc + 4) / 12);
      const pt = pathPt(f.el, f.s);
      f.trail.push(pt.x, pt.y); if (f.trail.length > 52) f.trail.splice(0, 2);
      live.nG++;
      f.shed -= dt;
      if (!S && f.shed <= 0 && flows.length + add.length < maxFlows) {                                 // a mote lifts off the current
        f.shed = 0.2 + Math.random() * 0.25;
        const a = Math.random() * 6.283, sp = 1.5 + Math.random() * 3.5;
        add.push({ k: 'm', el: f.el, lx: pt.x, ly: pt.y, ox: 0, oy: 0, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp - 1.5, r: 0.7 + Math.random() * 0.95, dark: L.dark, life: 0, max: 0.6 + Math.random() * 0.8, hue: Math.random() < 0.5 });
      }
      return true;
    });
    if (add.length) flows.push(...add);
    // draw
    for (const f of flows) {
      const m = M(f.el); if (!m) continue;
      const X = (x, y) => m.a * x + m.c * y + m.e, Y = (x, y) => m.b * x + m.d * y + m.f;
      const t = f.life / f.max;
      if (f.k === 'g') {
        const dark = f.el.__live.dark;
        const a = Math.sin(Math.PI * Math.min(1, t * 1.15)) * f.edge * (0.75 + 0.25 * Math.sin(now / 90 + f.max * 9));
        const tr = f.trail, n = tr.length / 2;
        if (a <= 0.01 || !n) continue;
        ctx.globalCompositeOperation = dark ? 'lighter' : 'source-over';
        ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
        ctx.lineCap = 'round';
        ctx.strokeStyle = '#FFFFFF';
        for (let i = 1; i < n; i++) {                     // the streak: a pulse of light inside the stroke
          const q = i / (n - 1);
          ctx.globalAlpha = a * q * (dark ? 0.62 : 0.72);
          ctx.lineWidth = (f.big ? 2.4 : 1.7) * (0.3 + 0.7 * q);
          ctx.beginPath();
          ctx.moveTo(X(tr[2 * i - 2], tr[2 * i - 1]), Y(tr[2 * i - 2], tr[2 * i - 1]));
          ctx.lineTo(X(tr[2 * i], tr[2 * i + 1]), Y(tr[2 * i], tr[2 * i + 1]));
          ctx.stroke();
        }
        const hx = X(tr[tr.length - 2], tr[tr.length - 1]), hy = Y(tr[tr.length - 2], tr[tr.length - 1]);
        ctx.globalAlpha = a * (dark ? 0.4 : 0.3);
        ctx.fillStyle = dark ? '#C9B3CF' : '#926D8F';
        ctx.beginPath(); ctx.arc(hx, hy, f.big ? 8 : 5.5, 0, 6.283); ctx.fill();
        if (f.big) {                                     // the brightest ones carry a tiny kit star
          const sc = 3.2 / LOW.r, rot = now / 700 + f.max * 5, c = Math.cos(rot) * sc * dpr, s = Math.sin(rot) * sc * dpr;
          ctx.globalAlpha = a; ctx.fillStyle = dark ? '#FFFFFF' : '#662482';
          ctx.setTransform(c, s, -s, c, hx * dpr - (c * LOW.cx - s * LOW.cy), hy * dpr - (s * LOW.cx + c * LOW.cy));
          ctx.fill(starPath);
        }
      } else if (f.k === 'm') {
        f.ox += f.vx * dt; f.oy += f.vy * dt; f.vx *= 0.97; f.vy *= 0.97;
        const x = X(f.lx, f.ly) + f.ox, y = Y(f.lx, f.ly) + f.oy;
        if (inZone(x, y)) { f.life = f.max; continue; }
        ctx.globalCompositeOperation = f.dark ? 'lighter' : 'source-over';
        ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
        ctx.globalAlpha = Math.sin(Math.PI * t) * (f.dark ? 0.95 : 0.8);
        ctx.fillStyle = f.dark ? (f.hue ? '#FFFFFF' : '#C9B3CF') : (f.hue ? '#662482' : '#926D8F');
        ctx.beginPath(); ctx.arc(x, y, f.r, 0, 6.283); ctx.fill();
      } else {                                           // twinkle: a kit star flashes in place
        const x = X(f.lx, f.ly), y = Y(f.lx, f.ly), e = Math.sin(Math.PI * t);
        if (inZone(x, y)) { f.life = f.max; continue; }
        ctx.globalCompositeOperation = f.dark ? 'lighter' : 'source-over';
        ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
        ctx.globalAlpha = e * 0.28; ctx.fillStyle = f.dark ? '#C9B3CF' : '#926D8F';
        ctx.beginPath(); ctx.arc(x, y, Math.max(0.1, f.r * 1.9 * e), 0, 6.283); ctx.fill();
        const sc = (f.r * (0.4 + 0.6 * e)) / LOW.r, rot = f.rot + t * 0.9, c = Math.cos(rot) * sc * dpr, s = Math.sin(rot) * sc * dpr;
        ctx.globalAlpha = e * 0.95; ctx.fillStyle = f.dark ? '#FFFFFF' : '#662482';
        ctx.setTransform(c, s, -s, c, x * dpr - (c * LOW.cx - s * LOW.cy), y * dpr - (s * LOW.cx + c * LOW.cy));
        ctx.fill(starPath);
      }
    }
    ctx.globalAlpha = 1; ctx.globalCompositeOperation = 'source-over';
  }
  // a thin ring that opens where you click
  let rings = [];
  const ring = (x, y, dark, r = 18) => { if (rings.length < 8) rings.push({ x, y, dark, r, life: 0, max: 0.55 }); };
  let lastT = performance.now();
  function tick() {
    const now = performance.now(), dt = Math.min(0.05, (now - lastT) / 1000); lastT = now;
    if (siteReady) checkLabels();
    if (!siteReady || reduce) return;
    auraStep(dt, now);
    // head
    const fr = parked ? null : frontier();
    if (fr && birthDone) {
      const sp = screenPoint(fr.at.el, fr.at.len);
      headState.x = sp.x; headState.y = sp.y;
      magic.style.transform = `translate3d(${sp.x}px, ${sp.y}px, 0)`;
      magic.classList.toggle('on-dark', !!fr.chain.dark);
      if (!headState.shown) { headState.shown = true; gsap.to(magic, { opacity: 1, duration: 0.6, ease: 'power2.out' }); }
      // shed sparkles where the pen has travelled (measured along the path, not the screen)
      if (headState.lastEl === fr.at.el && headState.lastLX != null) {
        const d = Math.hypot(sp.lx - headState.lastLX, sp.ly - headState.lastLY) * sp.s;
        if (d > 7) { spawn(fr.at.el, sp.lx, sp.ly, fr.chain.dark, d > 30 ? 2 : 1, HUG); headState.lastLX = sp.lx; headState.lastLY = sp.ly; }
      } else { headState.lastEl = fr.at.el; headState.lastLX = sp.lx; headState.lastLY = sp.ly; }
      headState.idle += dt;
      if (headState.idle > 0.55) { headState.idle = 0; spawn(fr.at.el, sp.lx, sp.ly, fr.chain.dark, 1, HUG); }
    }
    // particles
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, dust.width, dust.height);
    const ctm = new Map();
    const M = e => { let m = ctm.get(e); if (m === undefined) { m = e.getScreenCTM(); ctm.set(e, m); } return m; };
    const t0 = performance.now(); liveStep(dt, now, M); live.ms = live.ms * 0.9 + (performance.now() - t0) * 0.1;
    if (!particles.length && !rings.length) return;
    rings = rings.filter(r => (r.life += dt) < r.max);
    for (const r of rings) {
      const t = r.life / r.max, e = 1 - Math.pow(1 - t, 3);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.globalAlpha = 0.55 * (1 - t);
      ctx.strokeStyle = r.dark ? '#EFE9F2' : '#662482';
      ctx.lineWidth = 1;
      ctx.beginPath(); ctx.arc(r.x, r.y, 3 + r.r * e, 0, Math.PI * 2); ctx.stroke();
    }
    particles = particles.filter(p => (p.life += dt) < p.max);
    for (const p of particles) {
      let m = null;
      if (p.el) { m = M(p.el); if (!m) continue; }
      p.dx += p.vx * dt; p.dy += p.vy * dt; p.vy += 10 * dt; p.vx *= 0.985; p.rot += p.vr * dt;
      const x = m ? m.a * p.lx + m.c * p.ly + m.e + p.dx : p.lx + p.dx, y = m ? m.b * p.lx + m.d * p.ly + m.f + p.dy : p.ly + p.dy;
      if (!p.keep && inZone(x, y)) { p.life = p.max; continue; }
      const t = p.life / p.max, a = Math.sin(Math.PI * Math.min(1, t * 1.4)) * (0.65 + 0.35 * Math.sin(now / 60 + p.size * 7));
      const sc = (p.size / LOW.r) * (1 - t * 0.6);
      ctx.globalCompositeOperation = p.dark ? 'lighter' : 'source-over';
      ctx.globalAlpha = Math.max(0, a);
      ctx.fillStyle = p.dark ? (p.hue ? '#FFFFFF' : '#C9B3CF') : (p.hue ? '#662482' : '#926D8F');
      const c = Math.cos(p.rot) * sc * dpr, s = Math.sin(p.rot) * sc * dpr;
      ctx.setTransform(c, s, -s, c, x * dpr - (c * LOW.cx - s * LOW.cy), y * dpr - (s * LOW.cx + c * LOW.cy));
      ctx.fill(starPath);
    }
    ctx.globalAlpha = 1; ctx.globalCompositeOperation = 'source-over';
  }
  gsap.ticker.add(tick);
  window.__tada = { chains, frontier, startOf, endOf, screenPoint, live: () => ({ flows: flows.length, glints: flows.filter(f => f.k === 'g').length, twinkles: flows.filter(f => f.k === 't').length, src: live.src.length, tw: live.tw.length, ink: Math.round(live.total), ms: +live.ms.toFixed(2) }) }; // inspection hook (read-only use)

  // ======================================================================
  // The Tada magic: the route through the page
  // ======================================================================
  const triggers = [];
  let heroPin = null, menuPin = null, menuTween = null, footer = null;
  let heroVideo = null;

  function inkX() {
    const c = $('#story .container').getBoundingClientRect(), vw = document.documentElement.clientWidth;
    const pad = parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--pad')) || 64;
    const off = Math.max(14, Math.min(pad * 0.55, 44));
    return RTL() ? Math.min(vw - 10, c.right - pad + off) : Math.max(10, c.left + pad - off);
  }
  function sizeSvg(svg, w, h) {
    svg.setAttribute('width', w); svg.setAttribute('height', h);
    svg.setAttribute('viewBox', `0 0 ${w} ${h}`);
    svg.replaceChildren();
  }
  const rel = (r, o) => ({ x: r.left - o.left, y: r.top - o.top, w: r.width, h: r.height, r: r.right - o.left, b: r.bottom - o.top });

  function addChain(name, host, pen, extra = {}) {
    const c = { name, host, links: pen.links, p: 0, tip: null, dark: host.dataset.surface === 'dark', ...extra };
    c.links.forEach(primeLink);
    chains.push(c);
    return c;
  }
  // Every chain has its own scrubbed trigger, and smoothing can let two of them be
  // in motion at once. The resolver keeps the line honest: the furthest chain that
  // has started decides, every chain before it is complete, every chain after it empty.
  // So the line can never have a hole, and the head is always on its tip.
  function resolve() {
    let k = -1;
    chains.forEach((c, i) => { if ((c.raw || 0) > 0) k = i; });
    chains.forEach((c, i) => {
      const want = i < k ? 1 : i > k ? 0 : c.raw;
      if (want !== c.p) draw(c, want);
    });
    footerCheck();
  }
  function lineTrigger(c, opts) {
    const proxy = { p: 0 };
    if (reduce) return gsap.to(proxy, { p: 1, duration: 0, paused: true });
    const tw = gsap.to(proxy, {
      p: 1, ease: 'none',
      scrollTrigger: { trigger: c.host, scrub: 1, invalidateOnRefresh: true, ...opts },
      onUpdate: () => { c.raw = proxy.p; resolve(); },
    });
    triggers.push(tw);
    return tw;
  }
  // a vertical run with star beads at the given fractions
  function runWithBeads(pen, y2, fracs, budgetScale = 1) {
    const y1 = pen.y, len = y2 - y1, r = beadR();
    let at = y1;
    for (const f of fracs) {
      const by = y1 + len * f - r;
      if (by - at < 8 || by + 2 * r > y2 - 4) continue;
      pen.line(by - at, (by - at) * budgetScale);
      pen.bead(2 * r * budgetScale);
      at = by + 2 * r;
    }
    pen.line(y2 - at, (y2 - at) * budgetScale);
  }

  function killRoute() {
    triggers.forEach(t => { if (t.scrollTrigger) t.scrollTrigger.kill(true); t.kill(); });
    triggers.length = 0;
    chains.length = 0;
    heroPin = menuPin = menuTween = null;
    gsap.set('#menuTrack', { x: 0 });
    particles = []; flows = []; live.src = []; live.tw = []; live.total = 0;
    if (segHost) segHost.replaceChildren();
    if (footer && footer.snapTl) footer.snapTl.kill();
    footer = null; parked = false;
  }

  function buildRoute() {
    killRoute();
    // the line is the A's own stroke, continued: same weight on screen, nothing thinner or thicker
    const wp = $('#heroWord path');
    if (wp) { const m = wp.getScreenCTM(), px = m && parseFloat(getComputedStyle(wp).strokeWidth) * Math.hypot(m.a, m.b);
      if (px > 0.5) document.documentElement.style.setProperty('--ink-w', px.toFixed(2) + 'px'); }
    const sgn = SGN(), vw = document.documentElement.clientWidth, H = vh();
    const xs = inkX(), xf = vw - xs;
    const heroDist = (small() ? 1.5 : 3) * H;     // the guide: 400–500vh desktop, 250vh on small screens
    const menuTravel = () => { const tr = $('#menuTrack'); return Math.max(0, tr.scrollWidth - document.documentElement.clientWidth); };

    // ---------------- hero: born on the logotype's last foot ----------------
    {
      const host = $('#hero'), stage = $('#heroStage'), svg = $('.ink[data-ink="hero"]');
      const sr = stage.getBoundingClientRect(); sizeSvg(svg, sr.width, sr.height);
      const wr = rel($('#heroWord').getBoundingClientRect(), sr);
      // fa: the right foot of «A» (the pen's last point in the loader); en: the left foot of «T»
      const foot = RTL() ? [1141, 538] : [68, 538];
      const bx = wr.x + (foot[0] / WORD.w) * wr.w, by = wr.y + (foot[1] / WORD.h) * wr.h;
      const pen = makePen(svg, bx, by, 'B', sgn);
      const run = Math.abs(xs - bx);
      const r = Math.max(6, Math.min(R0, run - 2));
      pen.line(run - r, 0.05 * heroDist).turn('S', 0.03 * heroDist, r);
      const y60 = 0.6 * sr.height;
      const scale = (0.92 * heroDist) / Math.max(1, y60 - pen.y);
      runWithBeads(pen, y60, [0.28, 0.58, 0.86], scale);
      pen.line(sr.height - pen.y, 0.4 * H);
      const c = addChain('hero', host, pen);
      c.birth = { el: c.links[0].parts[0].el };
    }

    // ---------------- story: the shippo lattice ----------------
    {
      const host = $('#story'), svg = $('.ink[data-ink="story"]');
      const lat = $('#storyLattice');
      const n = small() ? 6 : 7, rows = 5;
      const rr = small() ? Math.min(22, (vw - 2 * Math.min(xs, xf) - 8) / (2 * n)) : 34;
      const latW = 2 * rr * n, latH = rr * (rows + 1);
      const padPx = parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--pad')) || 64;
      const cr = $('#story .container').getBoundingClientRect();
      const inside = Math.abs(xs - (RTL() ? cr.right - padPx : cr.left + padPx));
      lat.style.setProperty('--lat-w', `${Math.max(40, latW - inside)}px`);
      lat.style.setProperty('--lat-h', `${latH}px`);
      const hr = host.getBoundingClientRect(); sizeSvg(svg, hr.width, hr.height);
      const lr = rel(lat.getBoundingClientRect(), hr);
      const y0 = lr.y + rr;                           // row 0 centre line
      const pen = makePen(svg, xs, 0, 'S', sgn);
      pen.line(y0);
      pen.lattice(rows, n, rr, (latH * 1.7 + 160) * 2.6);   // slow and calm: the pattern takes its time
      runWithBeads(pen, hr.height, [0.55]);
      addChain('story', host, pen);
    }

    // ---------------- menu: pinned; the magic stays put and draws the shelf ----------------
    {
      const host = $('#menu'), track = $('#menuTrack'), tsvg = $('.ink[data-ink="menu-track"]'), svg = $('.ink[data-ink="menu"]');
      const hr = host.getBoundingClientRect();
      sizeSvg(svg, hr.width, hr.height);
      const trr = track.getBoundingClientRect();
      const tLeft = trr.left - hr.left, tTop = trr.top - hr.top;   // track is reset to x: 0 by killRoute
      sizeSvg(tsvg, track.scrollWidth, trr.height);
      const toT = (x, y) => [x - tLeft, y - tTop];
      const labels = $$('.label', track).map(lab => ({ lab, r: rel(lab.getBoundingClientRect(), hr) }));
      const panelBottom = Math.max(...labels.map(l => l.r.b));
      const shelfY = panelBottom + (small() ? 28 : 40);
      const travel = menuTravel();
      const U = x => (sgn > 0 ? x : vw - x);                         // distance from the start edge
      const Xat = u => (sgn > 0 ? u : vw - u);
      const uS = U(xs), uF = U(xf), uEnd = uF + travel;
      const pre = H * 0.35 / Math.max(1, uF - uS - R0);              // scroll px per sideways px before the pin
      const budgetFor = (u1, u2) => { const a = Math.min(u1, u2), b = Math.max(u1, u2); const before = Math.max(0, Math.min(b, uF) - a), after = Math.max(0, b - Math.max(a, uF)); return before * pre + after; };
      const [sx, sy] = toT(xs, 0);
      const pen = makePen(tsvg, sx, sy, 'S', sgn);
      pen.line(shelfY - R0, H * 0.18).turn('F', H * 0.07);
      const D = small() ? 22 : 28, r = beadR();
      const lights = [];
      const items = labels.map(l => ({ ua: Math.min(U(l.r.x), U(l.r.r)), ub: Math.max(U(l.r.x), U(l.r.r)), lab: l.lab })).sort((a, b) => a.ua - b.ua);
      let u = uS + R0;
      const straight = (u2, withBead) => {
        const gap = u2 - u;
        if (gap <= 0.5) return;
        if (withBead && gap > 2 * r + 24) {
          const half = (gap - 2 * r) / 2;
          pen.line(half, budgetFor(u, u + half)); pen.bead(budgetFor(u + half, u + half + 2 * r)); pen.line(half, budgetFor(u + half + 2 * r, u2));
        } else pen.line(gap, budgetFor(u, u2));
        u = u2;
      };
      items.forEach((it, i) => {
        straight(it.ua, i > 0);
        const n = Math.max(2, Math.floor((it.ub - it.ua) / D));
        const m = (it.ub - it.ua - n * D) / 2;
        straight(it.ua + m, false);
        const tiles = $$('.label-band svg, .pouch-tile', it.lab);
        const lit = { on: false };
        pen.shippo(n, D, budgetFor(u, u + n * D), {
          onProgress(f) {
            it.lab.__want = f >= 0.97; it.lab.__i = i;
            const on = f > 0.5;
            if (on === lit.on) return;
            lit.on = on;
            const band = $('.label-band', it.lab); if (band) band.classList.toggle('is-lit', on);
            tiles.forEach(t => { if (t.classList.contains('pouch-tile')) t.style.opacity = on || reduce ? 1 : 0; });
          },
        });
        u += n * D;
        straight(it.ub, false);
      });
      straight(uEnd - R0, true);
      pen.turn('S', R0);
      // exit: fixed in the section, from where the track's end comes to rest
      const ex = makePen(svg, xf, shelfY + R0, 'S', sgn);
      ex.line(hr.height - (shelfY + R0), 0.4 * H);
      const c = addChain('menu', host, { links: [...pen.links, ...ex.links] });
      c.travel = menuTravel;
    }

    // ---------------- branches: boustrophedon from the far side ----------------
    {
      const host = $('#branches'), svg = $('.ink[data-ink="branches"]');
      const hr = host.getBoundingClientRect(); sizeSvg(svg, hr.width, hr.height);
      const rows = $$('#branchRows li').map(li => rel(li.getBoundingClientRect(), hr));
      const pen = makePen(svg, xf, 0, 'S', sgn);
      let onFar = true;
      const r = beadR();
      rows.forEach(row => {
        const y = row.b - 6;
        pen.to(y - R0);
        pen.turn(onFar ? 'B' : 'F');
        const span = Math.abs(xf - xs) - 2 * R0, half = (span - 2 * r) / 2;
        pen.line(half).bead().line(half);
        pen.turn('S');
        onFar = !onFar;
      });
      pen.to(hr.height);
      addChain('branches', host, pen);
    }

    // ---------------- collaboration: quiet ----------------
    {
      const host = $('#collab'), svg = $('.ink[data-ink="collab"]');
      const hr = host.getBoundingClientRect(); sizeSvg(svg, hr.width, hr.height);
      const pen = makePen(svg, xs, 0, 'S', sgn);
      runWithBeads(pen, hr.height, [0.5]);
      addChain('collab', host, pen);
    }

    // ---------------- footer: the line becomes the hand, the hand snaps ----------------
    {
      const host = $('#footer'), svg = $('.ink[data-ink="footer"]');
      const hr = host.getBoundingClientRect(); sizeSvg(svg, hr.width, hr.height);
      const slot = rel($('#footerHand').getBoundingClientRect(), hr);
      const hand = buildHandSvg();
      hand.svg.setAttribute('x', slot.x); hand.svg.setAttribute('y', slot.y);
      hand.svg.setAttribute('width', slot.w); hand.svg.setAttribute('height', slot.h);
      svg.appendChild(hand.svg);
      const fx = addSnapHelpers(hand);
      prepSnap(gsap, hand, fx);
      gsap.set(hand.stars, { scale: reduce ? 1 : 0, opacity: reduce ? 1 : 0 });
      const k = slot.h / VH;
      const P = (px, py) => [slot.x + (px - VX) * k, slot.y + (py - VY) * k];
      const ends = id => { const s = hand.strokes[id], L = hand.byId[id].len; const a = s.getPointAtLength(0), b = s.getPointAtLength(L); return { a: [a.x, a.y], b: [b.x, b.y], L }; };
      // stroke order: entered from the line's side, ends on the snap's contact point
      const order = RTL()
        ? [['outer', 1], ['thumb', 1], ['thumbtop', 0], ['middle_a', 0], ['ring', 0], ['pinky', 0], ['middle_b', 1], ['midtip', 0]]
        : [['outer', 0], ['pinky', 1], ['ring', 1], ['middle_b', 0], ['thumb', 0], ['thumbtop', 0], ['middle_a', 0], ['midtip', 0]];
      const first = ends(order[0][0]);
      const E = P(...(order[0][1] ? first.b : first.a));
      const pen = makePen(svg, xs, 0, 'S', sgn);
      const yIn = Math.max(40, E[1] - Math.max(160, hr.height * 0.28));
      pen.to(yIn);
      // tangent of the first stroke where the pen meets it
      const s0 = hand.strokes[order[0][0]], L0 = hand.byId[order[0][0]].len;
      const q1 = s0.getPointAtLength(order[0][1] ? L0 : 0), q2 = s0.getPointAtLength(order[0][1] ? L0 - 6 : 6);
      const tx = (q2.x - q1.x), ty = (q2.y - q1.y), tl = Math.hypot(tx, ty) || 1;
      pen.cubic([xs, yIn + (E[1] - yIn) * 0.5], [E[0] - (tx / tl) * 90, E[1] - (ty / tl) * 90], E);
      const handScale = 0.45;    // scroll px per screen px of hand ink
      order.forEach(([id, rev], i) => {
        const e = ends(id);
        const start = P(...(rev ? e.b : e.a)), end = P(...(rev ? e.a : e.b));
        if (i > 0 && Math.hypot(start[0] - pen.x, start[1] - pen.y) > 2) pen.hop(start, Math.hypot(start[0] - pen.x, start[1] - pen.y) * 0.35);
        pen.stroke(hand.strokes[id], e.L, !!rev, e.L * k * handScale, end);
      });
      const c = addChain('footer', host, pen);
      footer = { hand, fx, k, slot, chain: c, snapTl: null };
    }

    // ---------------- triggers, in page order ----------------
    const heroChain = chains[0], storyChain = chains[1], menuChain = chains[2];
    const heroProxy = { p: 0 };
    if (!reduce) {
      const heroTw = gsap.to(heroProxy, {
        p: 1, ease: 'none', onUpdate: () => heroUpdate(heroProxy.p),
        scrollTrigger: { trigger: '#hero', start: 'top top', end: () => '+=' + heroDist, pin: true, scrub: 0.35, anticipatePin: 1, invalidateOnRefresh: true },
      });
      triggers.push(heroTw); heroPin = heroTw.scrollTrigger;
    } else heroUpdate(1);
    lineTrigger(heroChain, { trigger: '#hero', start: 0, end: () => (heroPin ? heroPin.end : 0) + 0.4 * vh() });
    lineTrigger(storyChain, { start: 'top 60%', end: 'bottom 60%' });

    menuTween = gsap.to('#menuTrack', {
      x: () => -SGN() * menuTravel(), ease: 'none',
      scrollTrigger: { trigger: '#menu', start: 'top top', end: () => '+=' + menuTravel(), pin: true, scrub: 1, anticipatePin: 1, invalidateOnRefresh: true, onUpdate: st => setDot(st.progress) },
    });
    triggers.push(menuTween); menuPin = menuTween.scrollTrigger;
    lineTrigger(menuChain, { trigger: '#menu', start: () => menuPin.start - 0.6 * vh(), end: () => menuPin.end + 0.4 * vh() });
    lineTrigger(chains[3], { start: 'top 60%', end: 'bottom 60%' });
    lineTrigger(chains[4], { start: 'top 60%', end: 'bottom 60%' });
    lineTrigger(chains[5], { start: 'top 60%', end: () => ScrollTrigger.maxScroll(window) - (small() ? 140 : 8) });

    // the nav takes the ink of the surface under it
    triggers.push(gsap.to({}, { scrollTrigger: { trigger: '#story', start: 'top 48px', onEnter: () => ($('#nav').dataset.ink = 'dark'), onLeaveBack: () => ($('#nav').dataset.ink = 'light') } }));

    if (reduce) chains.forEach(c => { c.raw = 1; draw(c, 1); });
    else chains.forEach(c => { c.raw = 0; draw(c, 0); });
  }

  // ---------- the ending: the hand snaps, the magic takes its place ----------
  function footerCheck() {
    if (!footer || reduce) return;
    const p = footer.chain.p;
    if (p >= 0.999 && !parked) park();
    else if (p < 0.985 && parked) unpark();
  }
  function park() {
    parked = true;
    const { hand, fx } = footer;
    const tl = gsap.timeline();
    footer.snapTl = tl;
    const keys = addSnap(tl, hand, fx, 0.05, { stars: false });
    tl.add(() => sfx.snap(), keys.R);
    tl.add(() => {
      // the release launches the magic from the fingertips into its own place
      const bb = hand.stars[2].getBoundingClientRect();
      gsap.fromTo(magic, { x: headState.x, y: headState.y, scale: 1 }, {
        x: bb.left + bb.width / 2, y: bb.top + bb.height / 2,
        scale: Math.max(0.2, bb.width / 19.6), duration: 0.34, ease: 'power3.out',
        onComplete: () => {
          gsap.to(magic, { opacity: 0, duration: 0.2 });
          headState.shown = false;
          gsap.fromTo(hand.stars[2], { opacity: 1, scale: 1.7 }, { scale: 1, duration: 0.5, ease: 'back.out(3)' });
          sfx.land();
        },
      });
    }, keys.HIT);
    [1, 0].forEach((i, n) => {
      const at = keys.HIT + 0.42 + n * 0.1;
      tl.to(hand.stars[i], { opacity: 1, duration: 0.08, ease: 'none' }, at);
      tl.fromTo(hand.stars[i], { scale: 0, rotation: -20 }, { scale: 1, rotation: 0, duration: 0.34, ease: 'back.out(3)' }, at);
    });
    tl.add(() => sfx.tada(), keys.HIT + 0.42);
  }
  function unpark() {
    parked = false;
    const { hand } = footer;
    if (footer.snapTl) footer.snapTl.kill();
    gsap.killTweensOf(magic);
    gsap.set(magic, { clearProps: 'transform' });
    headState.shown = false;
    gsap.set(hand.stars, { opacity: 0, scale: 0 });
    gsap.set([hand.root, hand.gMid, hand.gThumb, hand.gRing, hand.gPinky], { rotation: 0, x: 0, y: 0 });
  }
  function replaySnap() {
    if (!parked || !footer || reduce) return;
    const tl = gsap.timeline();
    const keys = addSnap(tl, footer.hand, footer.fx, 0.02, { stars: false });
    tl.add(() => sfx.snap(), keys.R);
    footer.hand.stars.forEach((s, n) => tl.fromTo(s, { scale: 0.4 }, { scale: 1, duration: 0.34, ease: 'back.out(3)' }, keys.HIT + n * 0.06));
  }

  // ======================================================================
  // Hero: the film (Golestan method), and the line-drawn cup until it arrives
  // ======================================================================
  // The cup from the first design: drawn, poured with ube, iced, given the arched
  // Tada sticker, then the three kit sparkles. Scrubbed by the same progress as the film.
  let scene = null;
  function buildScene() {
    const svg = $('#heroScene'); svg.replaceChildren();
    const defs = el('defs', {}, svg);
    const clip = el('clipPath', { id: 'cup-in' }, defs);
    el('path', { d: 'M46 92L74 384Q76 404 98 404H202Q224 404 226 384L254 92Z' }, clip);
    const pour = el('path', { class: 'sc sc-pour', d: 'M168 -170V300' }, svg);
    const liquidG = el('g', { 'clip-path': 'url(#cup-in)' }, svg);
    const liquid = el('rect', { class: 'sc-liquid', x: 30, y: 400, width: 240, height: 300 }, liquidG);
    // ice: each cube sits in its own float group, so it can bob on the surface while the
    // scroll timeline drops it in and draws it
    const floats = [];
    const ice = [[92, 118, -8], [140, 104, 10], [186, 122, -4]].map(([x, y, r]) => {
      const fg = el('g', { class: 'sc-float' }, svg);
      floats.push({ g: fg, cx: x + 19, cy: y + 19 });
      return el('rect', { class: 'sc', x, y, width: 38, height: 38, rx: 9, transform: `rotate(${r} ${x + 19} ${y + 19})` }, fg);
    });
    const cup = [
      el('path', { class: 'sc', d: 'M34 80H266' }, svg),
      el('path', { class: 'sc', d: 'M42 80L72 386Q74 410 100 410H200Q226 410 228 386L258 80' }, svg),
      el('path', { class: 'sc sc-thin', d: 'M38 92H262' }, svg),
    ];
    const arch = el('path', { class: 'sc sc-sticker', d: 'M100 384V268A50 50 0 0 1 200 268V384Z' }, svg);
    arch.style.fill = '#35084C'; arch.style.fillOpacity = 0;   // the sticker: a night label the mark glows on
    // the whole TADA mark (hand and its three sparkles), uniformly scaled, glowing
    const glowF = el('filter', { id: 'mark-glow', x: '-60%', y: '-60%', width: '220%', height: '220%' }, defs);
    const blur = el('feGaussianBlur', { in: 'SourceGraphic', stdDeviation: 1.6, result: 'b' }, glowF);
    const merge = el('feMerge', {}, glowF);
    for (let k = 0; k < 3; k++) el('feMergeNode', { in: 'b' }, merge);
    el('feMergeNode', { in: 'SourceGraphic' }, merge);
    const hs = 126 / VH;
    const markWrap = el('g', fine ? { class: 'sc-mark', filter: 'url(#mark-glow)' } : { class: 'sc-mark' }, svg);
    const mark = el('g', { transform: `translate(${150 - (VW * hs) / 2 - VX * hs} ${314 - (VH * hs) / 2 - VY * hs}) scale(${hs})` }, markWrap);
    const markStrokes = HAND.strokes.map(st => el('path', { class: 'sc sc-markline', d: st.d, 'stroke-width': HAND.stroke }, mark));
    const markStars = HAND.stars.map(st => {
      const pth = el('path', { class: 'sc-mark-star', d: st.d }, mark);
      gsap.set(pth, { svgOrigin: `${st.cx} ${st.cy}`, scale: 0 });
      return pth;
    });
    // the three kit sparkles above the rim
    const sparks = HAND.stars.map((st, i) => {
      const at = [[262, 30, 0.42], [292, 66, 0.3], [24, 150, 0.36]][i];
      const g = el('g', { transform: `translate(${at[0]} ${at[1]}) scale(${at[2]}) translate(${-st.cx} ${-st.cy})` }, svg);
      const pth = el('path', { class: 'sc-star', d: st.d }, g);
      gsap.set(pth, { svgOrigin: `${st.cx} ${st.cy}`, scale: 0, rotation: -90 });
      return pth;
    });
    const dash = els => els.forEach(p => { const L = p.getTotalLength(); p.style.strokeDasharray = `${L} ${L + 2}`; p.style.strokeDashoffset = L + 1; p.dataset.len = L; });
    dash([pour, ...ice, ...cup, arch, ...markStrokes]);
    const off = p => +p.dataset.len + 1;
    const tl = gsap.timeline({ paused: true, defaults: { ease: 'none' } });
    tl.to(cup, { strokeDashoffset: 0, duration: 0.22, stagger: 0.03 }, 0.02);
    tl.to(pour, { strokeDashoffset: 0, duration: 0.14 }, 0.2);
    tl.fromTo(liquid, { attr: { y: 400 } }, { attr: { y: 150 }, duration: 0.34, ease: 'power1.inOut' }, 0.28);
    tl.fromTo(ice, { y: -30 }, { y: 0, duration: 0.14, stagger: 0.04 }, 0.42);
    tl.to(ice, { strokeDashoffset: 0, duration: 0.14, stagger: 0.04 }, 0.42);
    tl.to(pour, { strokeDashoffset: (i, p) => -off(p), duration: 0.1 }, 0.6);
    tl.to([arch, ...markStrokes], { strokeDashoffset: 0, duration: 0.14, stagger: 0.02 }, 0.66);
    tl.fromTo(arch, { fillOpacity: 0 }, { fillOpacity: 0.82, duration: 0.12 }, 0.7);
    tl.to(markStars, { scale: 1, duration: 0.06, stagger: 0.02, ease: 'back.out(3)' }, 0.8);
    tl.to(sparks, { scale: 1, rotation: 0, duration: 0.08, stagger: 0.025, ease: 'back.out(3)' }, 0.84);
    tl.to({}, { duration: 0.06 }, 0.94);
    // alive while the hero is on screen: the ice floats, the mark's glow breathes
    if (!reduce) {
      const idle = gsap.timeline({ paused: true });
      const R = (a, b) => a + Math.random() * (b - a);
      floats.forEach(({ g, cx, cy }, i) => {
        gsap.set(g, { svgOrigin: `${cx} ${cy}` });
        const parts = [
          gsap.to(g, { y: R(-2.6, -1.6), duration: R(2.3, 3.1), ease: 'sine.inOut', yoyo: true, repeat: -1 }),
          gsap.to(g, { rotation: (i % 2 ? 1 : -1) * R(2.5, 4.5), duration: R(3.4, 4.6), ease: 'sine.inOut', yoyo: true, repeat: -1 }),
          gsap.to(g, { x: (i % 2 ? -1 : 1) * R(1.2, 2.2), duration: R(4.2, 5.8), ease: 'sine.inOut', yoyo: true, repeat: -1 }),
        ];
        parts.forEach(t => { t.totalTime(Math.random() * t.duration() * 2); idle.add(t, 0); });
      });
      if (fine) idle.add(gsap.to(blur, { attr: { stdDeviation: 3.4 }, duration: 2.6, ease: 'sine.inOut', yoyo: true, repeat: -1 }), 0);
      new IntersectionObserver(([en]) => (en.isIntersecting ? idle.play() : idle.pause())).observe(svg);
    }
    return tl;
  }

  const RANGES = [[0.12, 0.33], [0.35, 0.58], [0.60, 0.83], [0.85, 1.01]];   // each holds until just before the next
  let capShown = -1;
  function heroUpdate(p) {
    if (heroVideo) heroVideo(p);
    if (scene && $('#heroMedia').dataset.mode !== 'video') scene.progress(p);
    const caps = $$('#heroCaptions .hero-cap');
    let active = -1;
    caps.forEach((c, i) => {
      const [a, b] = RANGES[i] || [2, 2];
      const fin = Math.min(1, Math.max(0, (p - a) / 0.04));
      const fout = i === caps.length - 1 ? 1 : Math.min(1, Math.max(0, (b - p) / 0.04));
      const o = reduce ? 1 : fin * fout;
      c.style.opacity = o;
      if (o > 0.5) active = i;
    });
    $('.hero-line').style.opacity = reduce ? 1 : 1 - Math.min(1, Math.max(0, (p - 0.08) / 0.05));
    if (active !== capShown) { if (active >= 0 && capShown !== -2) (active === caps.length - 1 ? sfx.tada : sfx.chapter)(); capShown = active; }
  }
  function setupHeroVideo() {
    const box = $('#heroMedia'), H = SITE.hero || {};
    box.replaceChildren(); box.dataset.mode = 'none';
    const src = small() && H.videoMobile ? H.videoMobile : H.video;
    if (reduce) {
      if (H.poster) { const img = document.createElement('img'); img.src = H.poster; img.alt = ''; box.appendChild(img); box.dataset.mode = 'poster'; }
      return null;
    }
    if (!src) return null;
    const v = document.createElement('video');
    v.muted = true; v.defaultMuted = true; v.playsInline = true; v.preload = 'auto';
    v.setAttribute('muted', ''); v.setAttribute('playsinline', ''); v.setAttribute('aria-hidden', 'true');
    if (H.poster) v.poster = H.poster;
    if (H.videoWebm && !small()) { const s = document.createElement('source'); s.src = H.videoWebm; s.type = 'video/webm'; v.appendChild(s); }
    const s2 = document.createElement('source'); s2.src = src; s2.type = 'video/mp4'; v.appendChild(s2);
    box.appendChild(v);
    v.load(); // iOS Safari needs an explicit load before the first seek
    v.addEventListener('loadedmetadata', () => { if (v.duration > 0) box.dataset.mode = 'video'; });
    v.addEventListener('error', () => { box.dataset.mode = 'none'; });
    let want = 0, busy = false;
    return p => {
      if (!v.duration) return;
      want = Math.min(v.duration - 0.04, p * v.duration);
      if (busy) return;
      busy = true;
      requestAnimationFrame(() => { busy = false; if (v.paused && Math.abs(v.currentTime - want) > 0.01) v.currentTime = want; });
    };
  }

  // ======================================================================
  // Lenis, nav, cursor, sound
  // ======================================================================
  let lenis = null;
  function setupLenis() {
    if (!window.Lenis || reduce || !matchMedia('(pointer: fine)').matches) return;
    lenis = new Lenis({ lerp: 0.09, smoothWheel: true, syncTouch: false });
    lenis.on('scroll', ScrollTrigger.update);
    gsap.ticker.add(t => lenis.raf(t * 1000));
    gsap.ticker.lagSmoothing(0);
    // the head is placed after Lenis has scrolled in the same frame, so it never trails the line
    gsap.ticker.remove(tick); gsap.ticker.add(tick);
  }
  function goTo(id) {
    const target = $(id); if (!target) return;
    const y = id === '#top' ? 0 : target.getBoundingClientRect().top + scrollY - 8;
    if (lenis) lenis.scrollTo(y, { duration: 1.4 }); else scrollTo({ top: y, behavior: reduce ? 'auto' : 'smooth' });
  }
  $$('.nav-links a, .nav-mark').forEach(a => a.addEventListener('click', e => {
    const id = a.getAttribute('href'); if (!id || !id.startsWith('#')) return;
    e.preventDefault();
    if (a.classList.contains('nav-mark') && small()) { openMenu(a); return; }   // on phones the mark opens the menu
    goTo(id);
  }));

  // ---------- phone menu ----------
  // Opens as a circle from the mark or the «فهرست» button, with a snap and a burst of
  // sparkles; the page behind is inert while it is open.
  const mm = $('#mMenu'), menuBtn = $('#menuBtn');
  let mmOpener = null, mmTl = null;
  const starSvg = `<svg viewBox="${LOW.cx - LOW.r} ${LOW.cy - LOW.r} ${2 * LOW.r} ${2 * LOW.r}" aria-hidden="true"><path d="${LOW.d}"/></svg>`;
  $$('.mmenu-links a', mm).forEach(a => a.insertAdjacentHTML('afterbegin', starSvg));
  const outside = () => [$('main'), $('footer'), $('#nav')];
  const centre = n => { const r = n.getBoundingClientRect(); return [r.left + r.width / 2, r.top + r.height / 2]; };
  function openMenu(from) {
    if (!mm.hidden) return;
    mmOpener = from || menuBtn;
    const [cx, cy] = centre(mmOpener);
    mm.hidden = false; menuBtn.setAttribute('aria-expanded', 'true');
    outside().forEach(n => { n.inert = true; });
    document.documentElement.style.overflow = 'hidden';
    if (lenis) lenis.stop();
    sfx.snap();
    if (mmTl) mmTl.kill();
    const parts = $$('.mmenu-links a, .mmenu-tools', mm);
    if (reduce) { gsap.set(mm, { clearProps: 'clipPath' }); gsap.set(parts, { opacity: 1, y: 0 }); }
    else {
      mmTl = gsap.timeline()
        .fromTo(mm, { clipPath: `circle(0px at ${cx}px ${cy}px)` }, { clipPath: `circle(${Math.hypot(innerWidth, innerHeight) * 1.05}px at ${cx}px ${cy}px)`, duration: 0.75, ease: 'power3.inOut' })
        .fromTo(parts, { opacity: 0, y: 18 }, { opacity: 1, y: 0, duration: 0.7, stagger: 0.06, ease: 'power3.out' }, 0.22);
      spawn(null, cx, cy, true, 10, { radial: true, speed: 60, spread: 4, life: 0.7, rise: 0 });
    }
    $('.mmenu-links a', mm).focus({ preventScroll: true });
  }
  function closeMenu(then) {
    if (mm.hidden) return;
    const done = () => {
      mm.hidden = true; menuBtn.setAttribute('aria-expanded', 'false');
      outside().forEach(n => { n.inert = false; });
      document.documentElement.style.overflow = '';
      if (lenis) lenis.start();
      if (then) then(); else if (mmOpener) mmOpener.focus({ preventScroll: true });
    };
    if (mmTl) mmTl.kill();
    if (reduce) { done(); return; }
    const [cx, cy] = centre(mmOpener || menuBtn);
    mmTl = gsap.to(mm, { clipPath: `circle(0px at ${cx}px ${cy}px)`, duration: 0.55, ease: 'power3.inOut', onComplete: done });
  }
  menuBtn.addEventListener('click', () => openMenu(menuBtn));
  $('.skip-link').addEventListener('click', e => {
    e.preventDefault(); goTo('#story');
    const h = $('#story .h2'); h.setAttribute('tabindex', '-1'); h.focus({ preventScroll: true });
  });
  $('.mmenu-close', mm).addEventListener('click', () => closeMenu());
  $$('.mmenu-links a', mm).forEach(a => a.addEventListener('click', e => {
    e.preventDefault();
    const id = a.getAttribute('href');
    closeMenu(() => goTo(id));
  }));
  $('.mmenu-lang', mm).addEventListener('click', () => $('#langToggle').click());
  addEventListener('keydown', e => { if (e.key === 'Escape' && !mm.hidden) closeMenu(); });
  addEventListener('resize', () => { if (!small() && !mm.hidden) closeMenu(() => {}); });
  addEventListener('scroll', () => $('#nav').classList.toggle('is-scrolled', scrollY > 12), { passive: true });

  // The pointer keeps its native cursor. Moving it leaves a rare, tiny sparkle; a click
  // opens a thin ring and a few sparkles; on a link or a button the burst is richer and
  // the control itself glows for a moment.
  const isDarkAt = t => {
    const surf = t && t.closest ? t.closest('.label, [data-surface]') : null;
    return !!surf && (surf.dataset.surface === 'dark' || ['ube', 'matcha', 'night', 'purple'].includes(surf.dataset.tone));
  };
  function setupPointerMagic() {
    if (reduce) return;
    let lx = -999, ly = -999, lt = 0;
    addEventListener('pointermove', e => {
      if (e.pointerType !== 'mouse' || !siteReady) return;
      const now = performance.now();
      if (Math.hypot(e.clientX - lx, e.clientY - ly) < 34 || now - lt < 90) return;
      lx = e.clientX; ly = e.clientY; lt = now;
      if (Math.random() < 0.55) spawn(null, e.clientX, e.clientY, isDarkAt(e.target), 1, { spread: 4, speed: 10, sizeMin: 1.4, sizeMax: 2.6, bigChance: 0, life: 0.5, rise: 6 });
    }, { passive: true });
    addEventListener('pointerdown', e => {
      if (e.button > 0 || !siteReady || e.pointerType === 'touch') return;
      const ctrl = e.target.closest && e.target.closest('a, button, [role="button"], .footer-hand, .label');
      const dark = isDarkAt(e.target);
      ring(e.clientX, e.clientY, dark, ctrl ? 22 : 15);
      spawn(null, e.clientX, e.clientY, dark, ctrl ? 9 : 5, { spread: 2, speed: ctrl ? 70 : 46, sizeMin: 1.6, sizeMax: 3.4, bigChance: ctrl ? 0.3 : 0.1, life: 0.55, rise: 4, radial: true });
      if (ctrl && !ctrl.classList.contains('label')) {
        ctrl.classList.remove('is-magic'); void ctrl.offsetWidth; ctrl.classList.add('is-magic');
        setTimeout(() => ctrl.classList.remove('is-magic'), 900);
      }
    }, { passive: true });
  }

  SND.bind();
  SND.onChange(paintSound);
  $$('.sound-toggle').forEach(b => b.addEventListener('click', () => { SND.toggle(); if (SND.enabled()) sfx.toggle(); }));
  $('#footerHand').addEventListener('click', replaySnap);
  $('#footerHand').addEventListener('keydown', e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); replaySnap(); } });
  $('#footerHand').tabIndex = 0;

  // ======================================================================
  // Boot
  // ======================================================================
  applyLang();
  buildMotifs();
  buildAuras();
  scene = buildScene();
  heroVideo = setupHeroVideo();
  const navMark = $('#navMark'), heroWord = $('#heroWord');

  let started = false;
  async function startSite() {
    if (started) return; started = true;
    await document.fonts.ready;
    setupLenis();
    setupPointerMagic();
    buildRoute();
    ScrollTrigger.refresh();
    siteReady = true;
    // the birth of the magic: it appears on the logotype's last foot
    if (!reduce) {
      birthDone = true;
      gsap.fromTo(magic, { scale: 0 }, { scale: 1, duration: 0.7, ease: 'back.out(2.5)', delay: 0.05 });
      const b = chains[0] && startOf(chains[0]);
      if (b) { const sp = screenPoint(b.el, b.len); spawn(b.el, sp.lx, sp.ly, true, 6, { keep: true }); }
      sfx.bubble();
    }
  }

  // ---------- the entrance: everything loads, then one tap lets the sound in ----------
  // Fonts, the page's own files and (once it exists) the whole hero film are loaded
  // before anyone enters; the film is fetched in full so scrubbing never waits.
  function fetchWithProgress(url, onP) {
    return fetch(url).then(async res => {
      if (!res.ok || !res.body) throw new Error('fetch');
      const total = +res.headers.get('content-length') || 0, reader = res.body.getReader(), chunks = [];
      let got = 0;
      for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        chunks.push(value); got += value.length;
        if (total) onP(Math.min(0.99, got / total));
      }
      return URL.createObjectURL(new Blob(chunks, { type: res.headers.get('content-type') || 'video/mp4' }));
    });
  }
  function preload(onProgress) {
    const parts = {};
    const set = (k, v) => { parts[k] = v; const ks = Object.keys(parts); onProgress(ks.reduce((a, q) => a + parts[q], 0) / ks.length); };
    const jobs = [];
    set('fonts', 0); jobs.push(document.fonts.ready.then(() => set('fonts', 1)));
    if (document.readyState === 'complete') set('page', 1);
    else { set('page', 0); jobs.push(new Promise(r => addEventListener('load', () => { set('page', 1); r(); }, { once: true }))); }
    const H = SITE.hero || {}, src = !reduce && (small() && H.videoMobile ? H.videoMobile : H.video);
    if (src && location.protocol !== 'file:') {
      set('film', 0);
      jobs.push(fetchWithProgress(src, f => set('film', f)).then(url => {
        set('film', 1);
        const v = $('#heroMedia video');
        if (v) { v.replaceChildren(); v.src = url; v.load(); }
      }).catch(() => set('film', 1)));
    }
    return Promise.all(jobs);
  }
  // The entrance: the star breathes, a bar of light fills as the site loads, then the
  // site opens by itself. Browsers keep sound off until the first tap or click, so the
  // TADA notes join from the visitor's first touch.
  function entrance() {
    return new Promise(resolve => {
      const g = $('#ldGate');
      if (!g) { resolve(); return; }
      const barBox = $('.ld-gate-bar', g), bar = $('i', barBox);
      $('.ld-gate-star', g).innerHTML = `<svg viewBox="${LOW.cx - LOW.r} ${LOW.cy - LOW.r} ${2 * LOW.r} ${2 * LOW.r}"><path d="${LOW.d}"/></svg>`;
      const lockWas = document.documentElement.style.overflow;
      document.documentElement.style.overflow = 'hidden';
      const shown = { v: 0 };
      const render = () => {
        bar.style.transform = `scaleX(${shown.v})`;
        barBox.style.setProperty('--p', shown.v.toFixed(4));
        barBox.setAttribute('aria-valuenow', Math.round(shown.v * 100));
      };
      const t0 = performance.now();
      let target = 0;
      preload(f => { if (f > target) { target = f; gsap.to(shown, { v: target * 0.94, duration: 0.45, ease: 'power2.out', overwrite: true, onUpdate: render }); } })
        .then(() => {
          const wait = Math.max(0, 500 - (performance.now() - t0)) / 1000;   // never a flash
          gsap.to(shown, { v: 1, duration: 0.4, delay: wait, ease: 'power2.inOut', overwrite: true, onUpdate: render, onComplete: () => {
            document.documentElement.style.overflow = lockWas;
            gsap.to(g, { opacity: 0, duration: 0.55, delay: 0.12, ease: 'power2.inOut', onComplete: () => g.remove() });
            setTimeout(resolve, 240);
          } });
        });
    });
  }

  const loaderEl = $('#loader');
  const firstVisit = shouldPlayLoader();
  if (firstVisit) { navMark.style.opacity = 0; heroWord.style.opacity = 0; }
  else { navMark.replaceChildren(buildHandSvg().svg); heroWord.replaceChildren(buildWordmarkSvg().svg); }
  entrance().then(() => {
    if (firstVisit) {
      playLoader(loaderEl, {
        gsap, navMark, wordSlot: heroWord, sfx,
        onLanded: () => { navMark.style.opacity = 1; heroWord.style.opacity = 1; },
        onDone: () => startSite(),
      });
    } else {
      startSite();
      gsap.to(loaderEl, { opacity: 0, duration: 0.6, ease: 'power2.out', onComplete: () => { loaderEl.classList.add('is-done'); loaderEl.setAttribute('aria-hidden', 'true'); } });
    }
  });

  // ---------- language toggle, resize ----------
  async function rebuild() {
    if (!started) return;
    buildRoute();
    ScrollTrigger.refresh();
  }
  $('#langToggle').addEventListener('click', async () => {
    lang = lang === 'fa' ? 'en' : 'fa';
    try { localStorage.setItem('tada.lang', lang); } catch {}
    killRoute();
    applyLang();
    await document.fonts.ready;
    rebuild();
  });
  let rz, lastW = innerWidth;
  addEventListener('resize', () => {
    sizeDust();
    if (Math.abs(innerWidth - lastW) < 2 && small()) return;   // mobile URL-bar resizes: ignore
    lastW = innerWidth;
    clearTimeout(rz); rz = setTimeout(rebuild, 220);
  });
})();
