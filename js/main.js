// TADA Lounge — the glass
// ----------------------
// The entrance and the snap of the previous site, with the mark as the designer drew it on
// the glass; the door; and one line with a glowing head that runs through the page. Every
// illustration of the glass is drawn by a pen, stroke after stroke, and then lives (leaves
// sway, steam rises, the scooter rides). The menu hangs on a shelf the line draws as the
// flavors pass; the branches sit beside a route; at the end the line draws the hand on
// the whole glass, and the hand snaps.
//
// Classic script; depends on gsap, ScrollTrigger, (Lenis), TADA_GLYPHS/TadaType,
// TADA_ART, TadaLoader, SITE, CONTENT, TadaSound.

(function () {
  'use strict';

  const SND = window.TadaSound, sfx = SND.sfx, TL = window.TadaLoader;
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

  // the brand's four-point sparkle, exactly as on the glass (unit size, centred)
  const STAR_D = 'M0 -1C0.17 -0.54 0.52 -0.18 1 0C0.52 0.18 0.17 0.54 0 1C-0.17 0.54 -0.52 0.18 -1 0C-0.52 -0.18 -0.17 -0.54 0 -1Z';
  const starPath = new Path2D(STAR_D);
  const dataSvg = s => `url("data:image/svg+xml,${encodeURIComponent(s)}")`;
  document.documentElement.style.setProperty('--star-mask', dataSvg(`<svg xmlns='http://www.w3.org/2000/svg' viewBox='-1 -1 2 2'><path d='${STAR_D}'/></svg>`));
  // the lozenge of the glass, as a pattern tile, in both lights
  {
    const t = TADA_ART.tile, tile = c => dataSvg(`<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 ${t.s} ${t.s}'><g fill='none' stroke='${c}' stroke-width='7'><path d='${t.p[0]}'/><path d='${t.p[1]}'/></g></svg>`);
    document.documentElement.style.setProperty('--tile-night', tile('#E9DDF0'));
    document.documentElement.style.setProperty('--tile-day', tile('#662482'));
  }

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

  let siteReady = false, quiet = false, started = false, parked = false;

  // ======================================================================
  // The art of the glass: drawn by one pen, then alive
  // ======================================================================
  const ART = TADA_ART;
  function artSvg(name) {
    const a = ART[name]; if (!a) return null;
    const svg = el('svg', { viewBox: a.vb.join(' '), class: 'art', 'aria-hidden': 'true', focusable: 'false' });
    const paths = [];
    for (const [d, k, wf] of a.p) {
      const p = el('path', { d, class: k ? 'f' : 's' }, svg);
      if (!k && wf) p.style.strokeWidth = `calc(var(--sw) * ${wf})`;
      paths.push(p);
    }
    svg.__art = { name, paths, strokes: paths.filter(p => p.classList.contains('s')), fills: paths.filter(p => p.classList.contains('f')), w: a.vb[2], drawn: false };
    return svg;
  }
  function inkPx() { return parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--ink-w')) || 2; }
  function fitArt(svg) {
    const A = svg.__art; if (!A || !A.w) return;
    const w = svg.getBoundingClientRect().width; if (!w) return;
    svg.style.setProperty('--sw', (inkPx() / (w / A.w)).toFixed(2));
  }
  const fitAll = () => $$('svg.art').forEach(fitArt);

  function prepDraw(svg) {
    const A = svg && svg.__art; if (!A || A.drawn || A.prepped) return;
    A.prepped = true;
    svg.classList.add('is-waiting');
  }

  // the pen's glowing tip, one per drawing in progress
  let inking = 0;
  function makeQuill() {
    const q = document.createElement('div');
    q.className = 'quill'; q.setAttribute('aria-hidden', 'true');
    q.innerHTML = `<svg viewBox="-12 -12 24 24"><circle r="11" class="q-glow"/><path class="q-star" d="${STAR_D}" transform="scale(4.4)"/><circle r="1.1" class="q-core"/></svg>`;
    document.body.appendChild(q);
    return q;
  }
  const ptOf = (p, len) => { const q = p.getPointAtLength(len), m = p.getScreenCTM(); return m ? { x: m.a * q.x + m.c * q.y + m.e, y: m.b * q.x + m.d * q.y + m.f, lx: q.x, ly: q.y } : null; };
  const isDark = n => { const s = n.closest && n.closest('[data-surface]'); return !s || s.dataset.surface === 'night'; };

  /**
   * The magic touches a piece: one pen draws it, stroke after stroke, lifting only between
   * strokes (always the nearest next), its tip glowing and shedding sparkles; filled shapes
   * are traced round, then filled. o.ordered keeps the given order (letters as written).
   */
  function drawArt(svg, o = {}) {
    const A = svg && svg.__art; if (!A || A.drawn) return;
    A.drawn = true;
    svg.classList.remove('is-waiting');
    const quick = o.instant || reduce || quiet || !A.prepped;
    if (quick) { alive(svg); return; }
    const m = svg.getScreenCTM(); const k = m ? Math.hypot(m.a, m.b) : 1;    // px per unit
    const items = A.paths.map(p => {
      const L = p.getTotalLength();
      return { p, L, fill: p.classList.contains('f') || p.classList.contains('tt-f'), a: p.getPointAtLength(0), b: p.getPointAtLength(L) };
    });
    let order = items;
    if (!o.ordered) {
      const vb = svg.viewBox.baseVal;
      let at = { x: RTL() ? vb.x + vb.width : vb.x, y: vb.y };
      const left = items.slice(); order = [];
      while (left.length) {
        let bi = 0, bd = Infinity, rev = false;
        left.forEach((it, i) => {
          const da = Math.hypot(it.a.x - at.x, it.a.y - at.y), db = it.fill ? Infinity : Math.hypot(it.b.x - at.x, it.b.y - at.y);
          if (da < bd) { bd = da; bi = i; rev = false; }
          if (db < bd) { bd = db; bi = i; rev = true; }
        });
        const it = left.splice(bi, 1)[0]; it.rev = rev; order.push(it);
        at = rev ? it.a : it.b;
      }
    }
    const totalPx = items.reduce((s, it) => s + it.L, 0) * k;
    const target = Math.max(1.1, Math.min(o.max || 3.4, totalPx / 700));
    const speed = Math.max(380, totalPx / target);                             // px per second
    const quill = makeQuill(); inking++;
    const dark = isDark(svg);
    const tl = gsap.timeline({ delay: o.delay || 0, onComplete: () => { quill.remove(); inking--; alive(svg); } });
    for (const it of items) {
      if (it.fill) { it.p.style.fillOpacity = 0; it.p.style.stroke = 'currentColor'; it.p.style.strokeWidth = (1.3 / k).toFixed(2); }
      it.p.style.strokeDasharray = `${it.L + 0.5} ${it.L + 2}`;
      it.p.style.strokeDashoffset = it.rev ? -(it.L + 0.5) : it.L + 0.5;
    }
    let t = 0, last = null;
    order.forEach(it => {
      const start = it.rev ? it.b : it.a;
      if (last) t += Math.min(0.14, Math.hypot(start.x - last.x, start.y - last.y) * k / 2600);
      const dur = Math.max(0.05, (it.L * k) / speed), pr = { f: 0 };
      tl.add(() => sound('pen'), t);
      tl.to(pr, {
        f: 1, duration: dur, ease: it.L * k > 140 ? 'power1.inOut' : 'none',
        onUpdate() {
          const d = it.L * pr.f;
          it.p.style.strokeDashoffset = it.rev ? -(it.L + 0.5 - d) : it.L + 0.5 - d;
          const s = ptOf(it.p, it.rev ? it.L - d : d);
          if (s) { quill.style.transform = `translate3d(${s.x.toFixed(1)}px, ${s.y.toFixed(1)}px, 0)`; quill.classList.toggle('on-dark', dark); if (Math.random() < 0.18) spawn(it.p, s.lx, s.ly, dark, 1, HUG); }
        },
      }, t);
      if (it.fill) tl.to(it.p.style, { fillOpacity: 1, duration: 0.35, ease: 'power1.out' }, t + dur * 0.7);
      t += dur;
      last = it.rev ? it.a : it.b;
    });
    tl.to(quill, { opacity: 0, duration: 0.3 }, t);
    tl.add(() => items.forEach(it => { it.p.style.strokeDasharray = ''; it.p.style.strokeDashoffset = ''; if (it.fill) { it.p.style.stroke = ''; it.p.style.strokeWidth = ''; it.p.style.fillOpacity = ''; } }), t);
  }

  // ---------- life: each piece of the glass breathes in its own way ----------
  // Indices are the pieces' paths as drawn by the designer (see _src/build_art.py).
  const LIFE = {
    palm: { sway: { idx: [0, 1, 2, 3, 4, 5, 6], at: [262, 266], amp: 2.4, dur: 2.6 } },
    leaf: { sway: { idx: 'all', at: [142, 172], amp: 3.5, dur: 3.2 } },
    scooter: { wind: [2, 5, 6], ride: [0, 1, 3, 4, 7, 8, 9, 10, 11] },
    kettle: { flow: [7] },
    espresso: { flow: [2, 8] },
    coffeeCup: { steam: [0, 1, 2] },
    cup: { steam: [0, 1, 2, 3, 4, 5] },
    hat: { sway: { idx: [0, 2], at: [24, 22], amp: 5, dur: 1.8 }, twinkle: [1, 3, 4] },
    glass: { twinkle: [3] }, glass2: { twinkle: [3] }, icedCup: { twinkle: [6] }, croissant: { twinkle: [1] },
    coffeePath: { flow: [8, 13, 11], bob: [[20, 21], [23, 24]] },
    sun: { shimmer: true },
    tagline: { twinkle: [1, 2, 13] },
    lozenge: { twinkleSmall: true },
    dotRow: { pulse: true },
  };
  const living = new Map();   // svg → tweens, played only while on screen
  const lifeIO = 'IntersectionObserver' in window ? new IntersectionObserver(es => es.forEach(e => {
    const tws = living.get(e.target); if (!tws) return;
    tws.forEach(t => (e.isIntersecting ? t.play() : t.pause()));
  }), { rootMargin: '80px' }) : null;
  function alive(svg) {
    const A = svg.__art; if (!A || reduce || living.has(svg)) return;
    const L = LIFE[A.name]; if (!L) return;
    const P = A.paths, tws = [];
    const pick = idx => (idx === 'all' ? P : idx.map(i => P[i]).filter(Boolean));
    const loop = v => { const t = gsap.to(v.t, { ...v.to, repeat: -1, yoyo: v.yoyo !== false, ease: v.ease || 'sine.inOut', paused: true }); tws.push(t); return t; };
    if (L.sway) pick(L.sway.idx).forEach((p, i) => {
      gsap.set(p, { svgOrigin: `${L.sway.at[0]} ${L.sway.at[1]}`, rotation: -L.sway.amp * 0.5 });
      loop({ t: p, to: { rotation: L.sway.amp * (0.7 + (i % 3) * 0.15), duration: L.sway.dur + (i % 4) * 0.22, delay: i * 0.09 } });
    });
    const flow = (p, dir = 1, seg = 0.16, gap = 0.1, dur) => {
      const len = p.getTotalLength(), per = len * (seg + gap);
      p.style.strokeDasharray = `${(len * seg).toFixed(1)} ${(len * gap).toFixed(1)}`;
      const t = gsap.fromTo(p, { strokeDashoffset: 0 }, { strokeDashoffset: -dir * per, duration: dur || Math.max(0.6, per / 90), ease: 'none', repeat: -1, paused: true });
      tws.push(t);
    };
    // a stream runs down: from its higher end to its lower one
    const downward = p => { const n = p.getTotalLength(), a = p.getPointAtLength(0), b = p.getPointAtLength(n); return a.y <= b.y ? 1 : -1; };
    if (L.flow) pick(L.flow).forEach(p => flow(p, downward(p), 0.2, 0.12));
    if (L.steam) pick(L.steam).forEach((p, i) => { flow(p, -downward(p), 0.3, 0.2, 2.4 + (i % 3) * 0.4); loop({ t: p, to: { opacity: 0.45, duration: 1.6 + (i % 3) * 0.3, delay: i * 0.2 } }); });
    if (L.wind) pick(L.wind).forEach((p, i) => {
      // the air streams back from the scooter
      const n = p.getTotalLength(), a = p.getPointAtLength(0), b = p.getPointAtLength(n);
      flow(p, a.x < b.x ? 1 : -1, 0.34, 0.22, 0.55 + i * 0.12);
      loop({ t: p, to: { opacity: 0.35, duration: 0.3 + i * 0.07 } });
    });
    if (L.ride) loop({ t: pick(L.ride), to: { y: -5, duration: 0.32 } });
    if (L.twinkle) pick(L.twinkle).forEach((p, i) => { gsap.set(p, { transformOrigin: '50% 50%' }); loop({ t: p, to: { scale: 1.14, rotation: 8, duration: 1.3 + i * 0.27, delay: i * 0.4 } }); });
    if (L.bob) L.bob.forEach((ids, i) => loop({ t: ids.map(n => P[n]).filter(Boolean), to: { y: -7, duration: 1.4 + i * 0.3, delay: i * 0.5 } }));
    if (L.shimmer) {
      // a light runs round the sun's crown of ticks; its rays breathe
      const ticks = P.filter(p => { const b = p.getBBox(); return b.width < 30 && b.height < 30 && b.y < 380; });
      const rays = P.filter(p => { const b = p.getBBox(); return b.y > 400 && b.width < 120 && b.height < 140; });
      ticks.sort((a, b) => a.getBBox().x - b.getBBox().x);
      const tl = gsap.timeline({ repeat: -1, paused: true });
      ticks.forEach((p, i) => tl.to(p, { opacity: 0.25, duration: 0.25, yoyo: true, repeat: 1, ease: 'sine.inOut' }, i * 0.06));
      tl.to({}, { duration: 1.2 });
      tws.push(tl);
      rays.forEach((p, i) => loop({ t: p, to: { opacity: 0.4, duration: 1.8, delay: i * 0.15 } }));
    }
    if (L.twinkleSmall) P.forEach((p, i) => { const b = p.getBBox(); if (b.width < 160 && b.height < 160) { gsap.set(p, { transformOrigin: '50% 50%' }); loop({ t: p, to: { scale: 0.82, duration: 1.6, delay: (i % 8) * 0.2 } }); } });
    if (L.pulse) P.forEach((p, i) => { gsap.set(p, { transformOrigin: '50% 50%' }); loop({ t: p, to: { scale: 0.7, opacity: 0.6, duration: 1.1, delay: i * 0.12 } }); });
    living.set(svg, tws);
    if (lifeIO) lifeIO.observe(svg); else tws.forEach(t => t.play());
  }

  // ---------- Tada letters ----------
  const headSize = () => (small() ? 30 : narrow() ? 44 : 56);
  function letters(text, size, cls) {
    const svg = TadaType.svg(text, { size, weight: 0.064, cls });
    const paths = $$('path', svg);
    svg.__art = { name: 'letters', paths, drawn: false };
    return svg;
  }
  function buildHeadline(h) {
    const text = get(T(), h.dataset.tt) || '';
    h.replaceChildren();
    if (lang === 'fa') {
      const sr = document.createElement('span'); sr.className = 'sr'; sr.textContent = text.replace(/ـ/g, '');
      h.append(sr, letters(text, headSize()));
    } else h.textContent = text;
  }
  function writeHeadline(h) {
    if (h.__drawn) return;
    h.__drawn = true;
    const svg = $('svg.tt', h);
    if (svg) drawArt(svg, { ordered: true, max: 2.4 });
    else if (!reduce && !quiet) gsap.fromTo(h, { opacity: 0, y: 10 }, { opacity: 1, y: 0, duration: 1.1, ease: 'power2.out', clearProps: 'all' });
  }

  // ---------- the glass's chamfered panel ----------
  const frameRO = 'ResizeObserver' in window ? new ResizeObserver(es => es.forEach(e => paintFrame(e.target))) : null;
  function frameIt(node, cut) {
    let svg = $(':scope > .frame', node);
    if (!svg) { svg = el('svg', { class: 'frame', 'aria-hidden': 'true' }); el('path', { class: 'fr-base' }, svg); node.prepend(svg); }
    node.__cut = cut; paintFrame(node); frameRO && frameRO.observe(node);
  }
  const octagon = (w, h, c, i = 0.6) => `M${c} ${i}H${w - c}L${w - i} ${c}V${h - c}L${w - c} ${h - i}H${c}L${i} ${h - c}V${c}Z`;
  function paintFrame(node) {
    const svg = $(':scope > .frame', node); if (!svg) return;
    const w = node.offsetWidth, h = node.offsetHeight; if (!w || !h) return;
    const c = Math.min(node.__cut, h / 2.6, w / 4);
    svg.setAttribute('viewBox', `0 0 ${w} ${h}`);
    $$('.fr-base, .fr-on', svg).forEach(p => p.setAttribute('d', octagon(w, h, c)));
    // the four magic triangles that complete the frame (cards)
    const pts = [[[0, 0], [c, 0], [0, c]], [[w, 0], [w - c, 0], [w, c]], [[w, h], [w - c, h], [w, h - c]], [[0, h], [c, h], [0, h - c]]];
    $$('.fr-tri', svg).forEach((p, i) => { p.setAttribute('d', `M${pts[i].map(q => q.join(' ')).join('L')}Z`); p.dataset.ox = pts[i][0][0]; p.dataset.oy = pts[i][0][1]; });
  }
  function frameAll() { $$('.btn:not(.btn-quiet)').forEach(b => frameIt(b, 12)); }

  // ---------- opening hours, in Tehran ----------
  function tehranNow() {
    try {
      const parts = new Intl.DateTimeFormat('en-GB', { timeZone: SITE.timeZone, hour: 'numeric', minute: 'numeric', hour12: false }).formatToParts(new Date());
      return (+parts.find(p => p.type === 'hour').value % 24) + (+parts.find(p => p.type === 'minute').value) / 60;
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

  // ---------- content pieces ----------
  function buildPack() {
    const P = T().bar.pack, box = $('#pack');
    box.innerHTML = `<p class="pack-title">${P.title}</p><p class="pack-name">${P.name}</p><p class="pack-size">${P.size}</p>
      <p class="pack-intro">${P.intro}</p>
      <dl class="specs">${P.specs.map(([a, b]) => `<dt>${a}</dt><dd>${b}</dd>`).join('')}</dl>
      <p class="profile-title">${P.profileTitle}</p>
      <ul class="profile">${P.profile.map(([a, v]) => `<li><span>${a}</span><span class="bar" role="img" aria-label="${a}: ${num(v)}"><i style="--v:${v}"></i></span></li>`).join('')}</ul>
      <p class="profile-note">${P.profileNote}</p>
      <a class="btn btn-line" href="${SITE.shop}" rel="noopener">${P.cta}</a>`;
    frameIt(box, 26);
  }
  const chevron = toRight => `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="${toRight ? 'M9 4.5L16.5 12L9 19.5' : 'M15 4.5L7.5 12L15 19.5'}"/></svg>`;
  function buildMenu() {
    const M = T().menu, track = $('#menuTrack'), dots = $('#menuDots'), rtl = RTL();
    $$('.card', track).forEach(n => n.remove());
    dots.replaceChildren();
    M.items.forEach((it, i) => {
      const li = document.createElement('article');
      li.className = 'card'; li.__i = i;
      li.setAttribute('role', 'listitem'); li.setAttribute('aria-roledescription', 'slide');
      li.setAttribute('aria-label', `${num(i + 1)} / ${num(M.items.length)}`);
      li.innerHTML = `<span class="card-light" aria-hidden="true"><i class="card-sheen"></i><i class="card-glare"></i></span>
        <div class="card-art"><span class="art-slot" data-art="${it.art}"></span></div>
        <h3 class="card-name"><span class="${lang === 'fa' ? 'sr' : ''}">${it.name}</span></h3>
        <p class="card-sub">${it.sub}</p><p class="card-note">${it.note}</p>
        <button class="card-arrow is-prev" type="button" data-dir="-1" data-sfx="none" aria-label="${M.prev}" tabindex="-1">${chevron(rtl)}</button>
        <button class="card-arrow is-next" type="button" data-dir="1" data-sfx="none" aria-label="${M.next}" tabindex="-1">${chevron(!rtl)}</button>`;
      if (lang === 'fa') $('.card-name', li).appendChild(letters(it.name, small() ? 28 : 34));
      track.appendChild(li);
      dots.appendChild(document.createElement('i'));
      dressCard(li);
    });
    fillSlots(track);
    menuActive = -1;
  }
  function buildRows() {
    const B = T().branches, ol = $('#branchRows');
    ol.innerHTML = B.list.map(b => `<li class="row"><span class="row-art"><span class="art-slot" data-art="${b.art}"></span></span>
      <span class="row-name">${b.name}</span><span class="row-addr">${b.addr}</span>
      <a class="row-route" href="${b.map}" target="_blank" rel="noopener">${B.route}</a></li>`).join('');
    fillSlots(ol);
  }
  function buildCollab() {
    $('#collabItems').innerHTML = T().collab.items.map(it => `<div><dt>${it.t}</dt><dd>${it.s}</dd></div>`).join('');
    $('#footerLinks').innerHTML = T().glass.links.map(l => `<li><a class="btn btn-quiet" href="${l.href}" rel="noopener">${l.t}</a></li>`).join('');
    $('#year').textContent = num(new Date().getFullYear());
  }
  function fillSlots(root = document) {
    $$('.art-slot[data-art]', root).forEach(slot => { if ($('svg.art', slot)) return; const svg = artSvg(slot.dataset.art); if (svg) slot.appendChild(svg); });
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
    $('#muralImg').alt = t.glass.alt;
    if (door.arch) door.arch.setAttribute('d', archD());
    $$('.tt-h[data-tt]').forEach(buildHeadline);
    buildPack(); buildMenu(); buildRows(); buildCollab();
    paintStatus(); paintSound(); frameAll();
    requestAnimationFrame(fitAll);
  }

  // ======================================================================
  // The door: the arch, and the mark that lands in it
  // ======================================================================
  const door = { svg: null, arch: null, hand: null, words: null };
  function archD() {
    // drawn from the bottom corner on the far side: up, over, down, the threshold last,
    // so it ends where the line of the page begins
    return RTL()
      ? 'M9.8 1718.2V710.9C9.8 323.7 306.8 9.8 673.1 9.8C1039.4 9.8 1336.3 323.7 1336.3 710.9L1342.9 1718.2H9.8'
      : 'M1342.9 1718.2L1336.3 710.9C1336.3 323.7 1039.4 9.8 673.1 9.8C306.8 9.8 9.8 323.7 9.8 710.9V1718.2H1342.9';
  }
  function buildDoor() {
    const A = ART.arch, H = ART.hand;
    const svg = el('svg', { viewBox: A.vb.join(' '), 'aria-hidden': 'true', focusable: 'false', class: 'door-svg' });
    door.arch = el('path', { d: archD(), class: 's', 'stroke-width': 9.85 }, svg);
    // the mark and the wordmarks sit in the door as on the glass, each in its own box
    const hand = TL.buildHand({ pen: false, cls: 'door-hand' });
    hand.svg.setAttribute('x', (H.at[0] - A.at[0]).toFixed(1)); hand.svg.setAttribute('y', (H.at[1] - A.at[1]).toFixed(1));
    hand.svg.setAttribute('width', H.vb[2]); hand.svg.setAttribute('height', H.vb[3]);
    svg.appendChild(hand.svg);
    const words = TL.buildWords({ cls: 'door-words' });
    const wb = words.box;
    words.svg.setAttribute('x', (wb.x - A.at[0]).toFixed(1)); words.svg.setAttribute('y', (wb.y - A.at[1]).toFixed(1));
    words.svg.setAttribute('width', wb.w); words.svg.setAttribute('height', wb.h);
    svg.appendChild(words.svg);
    $('#door').prepend(svg);
    Object.assign(door, { svg, hand, words });
    $('#navMark').appendChild(TL.buildHand({ pen: false, cls: 'nav-hand' }).svg);
  }
  const doorSlots = () => ({ hand: door.hand.svg.getBoundingClientRect(), words: door.words.svg.getBoundingClientRect() });
  function showLockup(on) { gsap.set([door.hand.svg, door.words.svg], { opacity: on ? 1 : 0 }); }
  // the arch draws itself round the mark; the line will begin at its last point
  function drawArch(dur) {
    return new Promise(res => {
      const p = door.arch, L = p.getTotalLength();
      if (reduce || !dur) { p.style.strokeDasharray = ''; p.style.strokeDashoffset = ''; res(); return; }
      p.style.strokeDasharray = `${L} ${L + 4}`; p.style.strokeDashoffset = L;
      const q = makeQuill(), pr = { f: 0 }; inking++;
      q.classList.add('on-dark');
      sound0('pen');
      gsap.to(pr, {
        f: 1, duration: dur, ease: 'power1.inOut',
        onUpdate() { p.style.strokeDashoffset = L * (1 - pr.f); const s = ptOf(p, L * pr.f); if (s) { q.style.transform = `translate3d(${s.x}px, ${s.y}px, 0)`; if (Math.random() < 0.25) spawn(null, s.x, s.y, true, 1, HUG); } },
        onComplete() { q.remove(); inking--; p.style.strokeDasharray = ''; p.style.strokeDashoffset = ''; res(); },
      });
    });
  }

  // ======================================================================
  // The line: a pen that never lifts, the chains it lays in each part
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
        if (r <= 0) { h = to; return api; }
        const x2 = x + hx * r + nx * r, y2 = y + hy * r + ny * r;
        const sweep = hx * ny - hy * nx > 0 ? 1 : 0;
        push([part(mk(`M${x} ${y}A${r} ${r} 0 0 ${sweep} ${x2} ${y2}`))], budget ?? r * 1.2);
        x = x2; y = y2; h = to; return api;
      },
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
      station(onReach, budget) {
        let on = false;
        api.bead(budget, beadR(), { onProgress: f => { const v = f >= 0.5; if (v === on) return; on = v; onReach(v); } });
        return api;
      },
      // the lozenges of the glass in one stroke: over each circle, back under it, over again
      lozenges(n, D, budget, extra) {
        if (n <= 0) return api;
        const [vx] = V[h], r = D / 2, sw = vx > 0 ? 1 : 0;
        let d = `M${x} ${y}`, cx = x;
        for (let i = 0; i < n; i++) {
          const nx = cx + vx * D;
          d += `A${r} ${r} 0 0 ${sw} ${nx} ${y}A${r} ${r} 0 0 ${sw} ${cx} ${y}A${r} ${r} 0 0 ${sw} ${nx} ${y}`;
          cx = nx;
        }
        push([part(mk(d))], budget ?? H_BUDGET(n * D), extra);
        x = cx; return api;
      },
      cubic(c1, c2, end, budget, nextHeading) {
        const p = mk(`M${x} ${y}C${c1[0]} ${c1[1]} ${c2[0]} ${c2[1]} ${end[0]} ${end[1]}`);
        push([part(p)], budget ?? p.getTotalLength());
        x = end[0]; y = end[1]; if (nextHeading) h = nextHeading; return api;
      },
      hop(end, budget) {   // pen in the air: the head travels, no ink
        const mx = (x + end[0]) / 2, my = (y + end[1]) / 2 - Math.max(10, Math.hypot(end[0] - x, end[1] - y) * 0.35);
        const p = mk(`M${x} ${y}Q${mx} ${my} ${end[0]} ${end[1]}`, 'ink-ghost');
        push([part(p)], budget ?? p.getTotalLength() * 0.3);
        x = end[0]; y = end[1]; return api;
      },
      stroke(parts, budget, end) { push(parts, budget); x = end[0]; y = end[1]; return api; },
      to(y2, budget, extra) { return api.line(Math.abs(y2 - y), budget, extra); },
      toX(x2, budget, extra) { return api.line(Math.abs(x2 - x), budget, extra); },
    };
    return api;
  }

  const chains = [];
  function setLink(l, f) {
    if (f === l.f) return;
    l.f = f;
    for (const pt of l.parts) {
      const drawn = f * pt.ulen;
      pt.el.style.strokeDashoffset = (pt.reverse ? -(pt.ulen - drawn) : pt.ulen - drawn) + 'px';
      if (!pt.keepOpacity) pt.el.style.opacity = f > 0 ? 1 : 0;
    }
    l.onProgress && l.onProgress(f);
  }
  function primeLink(l) {
    for (const pt of l.parts) {
      pt.el.style.strokeDasharray = pt.ulen + 'px ' + (pt.ulen + 2) + 'px';
      pt.el.style.strokeDashoffset = (pt.reverse ? -pt.ulen : pt.ulen) + 'px';
      if (!pt.keepOpacity) pt.el.style.opacity = 0;
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
  // the furthest chain that has started decides: every chain before it whole, after it empty
  function resolve() {
    let k = -1;
    chains.forEach((c, i) => { if ((c.raw || 0) > 0) k = i; });
    chains.forEach((c, i) => { const want = i < k ? 1 : i > k ? 0 : c.raw; if (want !== c.p) draw(c, want); });
    endingCheck();
  }
  const triggers = [];
  function lineTrigger(c, opts) {
    const proxy = { p: 0 };
    if (reduce) { c.raw = 1; resolve(); return null; }
    const tw = gsap.to(proxy, {
      p: 1, ease: 'none',
      scrollTrigger: { trigger: c.host, scrub: fine ? 1.1 : 1.6, invalidateOnRefresh: true, ...opts },
      onUpdate: () => { c.raw = proxy.p; resolve(); },
    });
    triggers.push(tw);
    return tw;
  }
  const READ = 0.62;   // the head rides at this height of the screen
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
  function rails() {
    const box = $('#morning .container'), c = box.getBoundingClientRect(), W = vw();
    const pad = parseFloat(getComputedStyle(box).paddingLeft) || 64;
    const off = Math.max(10, Math.min(pad * 0.42, 30));
    const left = Math.max(10, c.left + off), right = Math.min(W - 10, c.right - off);
    return RTL() ? { S: right, E: left } : { S: left, E: right };
  }
  function skyGradient(svg, id, h, from, to) {
    const g = el('linearGradient', { id, gradientUnits: 'userSpaceOnUse', x1: 0, y1: 0, x2: 0, y2: h }, el('defs', {}, svg));
    [[0, from], [0.36, from], [0.7, to], [1, to]].forEach(([o, c]) => el('stop', { offset: o, 'stop-color': c }, g));
    svg.classList.add('has-sky');
    svg.style.setProperty('--sky-id', `url(#${id})`);
  }
  const CREAM = '#F6F0F8', PURPLE = '#662482';

  // ======================================================================
  // The head of the line, its sparkles, its sound
  // ======================================================================
  const magic = $('#magic');
  magic.innerHTML = `<svg viewBox="0 0 44 44"><defs><radialGradient id="mg"><stop offset="0" stop-color="currentColor" stop-opacity=".55"/><stop offset=".45" stop-color="currentColor" stop-opacity=".18"/><stop offset="1" stop-color="currentColor" stop-opacity="0"/></radialGradient></defs>
    <circle class="m-glow" cx="22" cy="22" r="21" fill="url(#mg)"/>
    <g class="m-spin"><path class="m-star" d="${STAR_D}" transform="translate(22 22) scale(7.2)"/></g>
    <circle class="m-core" cx="22" cy="22" r="1.5"/></svg>`;
  const headState = { x: -100, y: -100, shown: false, lastLX: null, lastLY: null, lastEl: null, idle: 0, px: null, py: null, v: 0 };
  const dust = $('#magicDust'), ctx = dust.getContext('2d');
  let dpr = 1, particles = [], rings = [];
  function sizeDust() { dpr = Math.min(fine ? 2 : 1.5, devicePixelRatio || 1); dust.width = Math.round(vw() * dpr); dust.height = Math.round(innerHeight * dpr); }
  sizeDust();
  function spawn(elm, lx, ly, dark, burst = 1, o = {}) {
    const { spread = 6, speed = 26, sizeMin = 2, sizeMax = 4.4, bigChance = 0.22, life = 0.8, rise = 8, radial = false } = o;
    for (let i = 0; i < burst; i++) {
      if (particles.length > 140) particles.shift();
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
  const ring = (x, y, dark, r = 18) => { if (rings.length < 8) rings.push({ x, y, dark, r, life: 0, max: 0.55 }); };
  // the logo stays exactly the designer's: no loose sparkles over it
  let zones = [];
  function zoneRects() {
    zones = [];
    for (const n of [door.hand && door.hand.svg, door.words && door.words.svg, $('#navMark'), ending && ending.hand && ending.hand.svg]) {
      if (!n) continue;
      const r = n.getBoundingClientRect();
      if (r.width && r.bottom > -40 && r.top < innerHeight + 40) zones.push([r.left - 12, r.top - 12, r.right + 12, r.bottom + 12]);
    }
  }
  const inZone = (x, y) => zones.some(z => x > z[0] && x < z[2] && y > z[1] && y < z[3]);
  const HUG = { spread: 1.5, speed: 7, rise: 2.5, sizeMin: 1.5, sizeMax: 3.2, bigChance: 0.1, life: 0.75 };

  let lastT = performance.now(), zoneT = 0;
  function tick() {
    const now = performance.now(), dt = Math.min(0.05, (now - lastT) / 1000); lastT = now;
    if (siteReady) checkCards();
    let level = inking > 0 ? 0.7 : 0;
    if (siteReady && !reduce) {
      if ((zoneT += dt) > 0.25) { zoneT = 0; zoneRects(); }
      const fr = parked ? null : frontier();
      if (fr) {
        const sp = screenPoint(fr.at.el, fr.at.len);
        // the sound of the line follows how fast its head moves along it
        if (headState.px != null && headState.lastEl === fr.at.el) { const d = Math.hypot(sp.lx - headState.px, sp.ly - headState.py) * sp.s; headState.v = headState.v * 0.8 + (d / Math.max(dt, 0.008)) * 0.2; }
        else headState.v *= 0.8;
        headState.px = sp.lx; headState.py = sp.ly;
        level = Math.max(level, Math.min(1, headState.v / 520));
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
    }
    if (!reduce) sfx.ink(level);
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, dust.width, dust.height);
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
  // The menu: the flavors pass on a shelf the line draws; the one in front wakes
  // ======================================================================
  let menuActive = -1, menuPin = null, menuTween = null, menuGeom = null;
  const $menu = $('#menu');
  // a card: the octagon of the glass, a frame that draws itself, four magic triangles that
  // complete it, a sweep of light, and (mouse) a lean toward the cursor
  function dressCard(card) {
    frameIt(card, small() ? 20 : 28);
    const svg = $(':scope > .frame', card);
    el('path', { class: 'fr-on', pathLength: 1 }, svg);
    for (let i = 0; i < 4; i++) el('path', { class: 'fr-tri' }, svg);
    paintFrame(card);
    $$('.fr-tri', svg).forEach(p => gsap.set(p, { svgOrigin: `${p.dataset.ox} ${p.dataset.oy}`, smoothOrigin: false, scale: 0, opacity: 0 }));
    if (reduce || !fine) return;
    gsap.set(card, { transformPerspective: 1000 });
    const rx = gsap.quickTo(card, 'rotationX', { duration: 0.7, ease: 'power3.out' }), ry = gsap.quickTo(card, 'rotationY', { duration: 0.7, ease: 'power3.out' });
    card.addEventListener('pointermove', e => {
      const r = card.getBoundingClientRect(), u = (e.clientX - r.left) / r.width - 0.5, v = (e.clientY - r.top) / r.height - 0.5;
      rx(-v * 6); ry(u * 6);
      card.style.setProperty('--gx', `${(u + 0.5) * 100}%`); card.style.setProperty('--gy', `${(v + 0.5) * 100}%`);
      card.classList.add('is-hover');
    });
    card.addEventListener('pointerleave', () => { rx(0); ry(0); card.classList.remove('is-hover'); });
  }
  const restShadow = '0 22px 50px -32px rgba(53, 8, 76, .3)';
  function frameCard(card, on) {
    const svg = $(':scope > .frame', card); if (!svg) return;
    const ln = $('.fr-on', svg), tri = $$('.fr-tri', svg), sheen = $('.card-sheen', card);
    if (card.__ftl) card.__ftl.kill();
    card.classList.toggle('is-framed', on);
    paintFrame(card);
    tri.forEach(p => gsap.set(p, { svgOrigin: `${p.dataset.ox} ${p.dataset.oy}`, smoothOrigin: false }));
    if (reduce) { gsap.set(ln, { strokeDashoffset: on ? 0 : 1 }); gsap.set(tri, { scale: on ? 1 : 0, opacity: on ? 1 : 0 }); return; }
    const tl = card.__ftl = gsap.timeline();
    if (on) {
      tl.fromTo(ln, { strokeDashoffset: 1 }, { strokeDashoffset: 0, duration: 1.9, ease: 'power2.inOut' }, 0)
        .to(card, { y: fine ? -12 : -8, scale: fine ? 1.025 : 1.02, boxShadow: '0 48px 90px -34px rgba(53, 8, 76, .42)', duration: 1.0, ease: 'power2.out' }, 0.15)
        .fromTo(sheen, { xPercent: -140, opacity: 1 }, { xPercent: 260, duration: 1.9, ease: 'power1.inOut' }, 0.25)
        // the magic completes the frame: a filled triangle grows into each cut corner
        .to(tri, { scale: 1, opacity: 1, duration: 0.9, stagger: 0.14, ease: 'back.out(1.8)' }, 1.05)
        .add(() => tri.forEach(p => { const b = p.getBBox(); spawn(p, b.x + b.width / 2, b.y + b.height / 2, false, fine ? 4 : 2, { radial: true, speed: 20, spread: 2, life: 0.9, rise: 0 }); }), 1.15)
        .to(card, { y: 0, scale: 1, boxShadow: restShadow, duration: 1.5, ease: 'power2.inOut' }, 1.5);
    } else {
      tl.to(tri, { scale: 0, opacity: 0, duration: 0.4, ease: 'power2.in' }, 0)
        .to(ln, { strokeDashoffset: 1, duration: 0.8, ease: 'power2.inOut' }, 0)
        .to(card, { y: 0, scale: 1, duration: 0.6 }, 0)
        .set(card, { clearProps: 'boxShadow' });
    }
  }
  function checkCards() {
    const hr = $menu.getBoundingClientRect(), H = innerHeight;
    if (hr.bottom < 0 || hr.top > H) {   // off screen: a frame only goes when the line has gone back past it
      for (const c of $$('#menuTrack .card.is-framed')) if (c.__shown && !c.__want) { c.__shown = false; frameCard(c, false); }
      return;
    }
    const cards = $$('#menuTrack .card'); if (!cards.length) return;
    const cx = vw() / 2;
    let best = 0, bd = Infinity;
    const rs = cards.map((c, i) => { const r = c.getBoundingClientRect(), d = Math.abs((r.left + r.right) / 2 - cx); if (d < bd) { bd = d; best = i; } return r; });
    if (best !== menuActive) {
      menuActive = best;
      $$('#menuDots i').forEach((d, i) => d.classList.toggle('is-on', i === best));
      cards.forEach((c, i) => {
        const on = i === best;
        c.classList.toggle('is-front', on);
        $$('.card-arrow', c).forEach(b => { const end = (b.classList.contains('is-prev') && i === 0) || (b.classList.contains('is-next') && i === cards.length - 1); b.hidden = end; b.tabIndex = on ? 0 : -1; });
      });
    }
    cards.forEach((c, i) => {
      const r = rs[i], d = Math.abs((r.left + r.right) / 2 - cx);
      const upright = r.bottom <= H + 2 && r.bottom > 0;
      const arrive = i === best && d < Math.max(24, r.width * 0.06);
      const stay = !!c.__shown && i === best && d < r.width * 0.3;
      const on = !!c.__want && ((upright && arrive) || stay);
      if (on === !!c.__shown) return;
      c.__shown = on;
      frameCard(c, on);
      if (on) sound('tile', c.__i + 2);
    });
  }
  function menuSnapsY() {
    if (!menuGeom || !menuPin) return [];
    const a = menuPin.start, b = menuPin.end;
    return menuGeom.ps.map(p => a + p * (b - a));
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
  let ending = null, snapped = false;
  function killRoute() {
    triggers.forEach(t => { if (t && t.scrollTrigger) t.scrollTrigger.kill(true); if (t && t.kill) t.kill(); });
    triggers.length = 0; chains.length = 0;
    if (menuTween) menuTween.kill();
    menuPin = menuTween = null;
    gsap.set('#menuTrack', { x: 0 });
    particles = []; parked = false;
    if (ending && ending.snapTl) ending.snapTl.kill();
    ending = null; snapped = false;
  }

  function buildRoute() {
    killRoute();
    const sgn = RTL() ? -1 : 1, H = vh(), W = vw();
    const { S, E } = rails();
    const R = id => { const n = $(id), r = n.getBoundingClientRect(); return { n, r }; };

    // ---------------- hero: from the end of the threshold ----------------
    {
      const { n: host, r: hr } = R('#hero'), svg = $('.ink', host);
      sizeSvg(svg, hr.width, hr.height);
      const p = door.arch, L = p.getTotalLength(), end = p.getPointAtLength(L), m = p.getScreenCTM();
      const fx = m.a * end.x + m.c * end.y + m.e - hr.left, fy = m.b * end.x + m.d * end.y + m.f - hr.top;
      const doorW = 9.85 * Math.hypot(m.a, m.b), ex = E - hr.left;
      const pen = makePen(svg, fx, fy, 'F', sgn);
      if (Math.abs(ex - fx) > R0 * 2 + 4) { pen.toX(ex - sgn * R0); svg.lastChild.style.strokeWidth = doorW.toFixed(2) + 'px'; pen.turn('S'); }
      else pen.turn('S', undefined, 0);
      pen.to(hr.height);
      const c = addChain('hero', host, pen);
      lineTrigger(c, { start: () => `top+=${Math.round(Math.max(0, fy - H * READ))} top`, end: chainRange(c).end });
    }

    // ---------------- morning ----------------
    {
      const { n: host, r: hr } = R('#morning'), svg = $('.ink', host);
      sizeSvg(svg, hr.width, hr.height);
      const skyH = $('.sky', host).offsetHeight;
      const pen = makePen(svg, E - hr.left, 0, 'S', sgn);
      const h2 = $('.tt-h', host), sun = $('.art-sun svg', host), kettle = $('.art-kettle svg', host);
      stations(pen, [
        [rel(h2.getBoundingClientRect(), hr).y, () => writeHeadline(h2)],
        [rel(sun.getBoundingClientRect(), hr).y + 10, () => { drawArt(sun); sound('chapter'); }],
        [rel(kettle.getBoundingClientRect(), hr).y + 10, () => drawArt(kettle)],
      ], hr.height);
      skyGradient(svg, 'skyMorning', skyH, CREAM, PURPLE);
      const c = addChain('morning', host, pen, { sky: { dark: 'top', at: skyH * 0.55 } });
      const rr = chainRange(c); lineTrigger(c, { start: rr.start, end: rr.end });
    }

    // ---------------- bar, then across to the start side for the menu ----------------
    {
      const { n: host, r: hr } = R('#bar'), svg = $('.ink', host);
      sizeSvg(svg, hr.width, hr.height);
      const pen = makePen(svg, E - hr.left, 0, 'S', sgn);
      const h2 = $('.tt-h', host), path = $('.art-path svg', host), esp = $('.art-espresso svg', host), pack = $('#pack');
      const sweep = Math.min(hr.height * 0.4, Math.max(220, Math.abs(S - E) * 0.32));
      const packB = rel(pack.getBoundingClientRect(), hr).b;
      stations(pen, [
        [rel(h2.getBoundingClientRect(), hr).y, () => writeHeadline(h2)],
        [rel(path.getBoundingClientRect(), hr).y + 10, () => drawArt(path, { max: 3.6 })],
        [rel(esp.getBoundingClientRect(), hr).y + 10, () => drawArt(esp)],
      ], Math.max(packB + 20, hr.height - sweep));
      const y0 = pen.y, y1 = hr.height, k = (y1 - y0) * 0.6, xs = S - hr.left;
      pen.cubic([pen.x, y0 + k], [xs, y1 - k], [xs, y1], undefined, 'S');
      const c = addChain('bar', host, pen);
      const rr = chainRange(c); lineTrigger(c, { start: rr.start, end: rr.end });
    }

    // ---------------- menu: pinned; the head stays and the shelf passes under it ----------------
    {
      const host = $menu, track = $('#menuTrack'), tsvg = $('.ink-track', track), svg = $('.ink[data-ink="menu"]', host);
      const travel = () => Math.max(0, track.scrollWidth - vw());
      if (!reduce) {
        menuTween = gsap.to(track, { x: () => (RTL() ? 1 : -1) * travel(), ease: 'none' });
        const st = ScrollTrigger.create({ trigger: host, start: 'top top', end: () => `+=${Math.round(travel())}`, pin: true, pinSpacing: true, animation: menuTween, scrub: 1, invalidateOnRefresh: true, anticipatePin: 1 });
        menuPin = st; triggers.push({ scrollTrigger: st, kill: () => {} });
      }
      const hr = host.getBoundingClientRect();
      sizeSvg(svg, hr.width, hr.height);
      const trr = track.getBoundingClientRect();
      const tLeft = trr.left - hr.left, tTop = trr.top - hr.top;
      sizeSvg(tsvg, track.scrollWidth, trr.height + 140);
      tsvg.style.top = '0px';
      const cards = $$('.card', track).map(card => ({ card, r: rel(card.getBoundingClientRect(), hr) }));
      const shelfY = Math.max(...cards.map(c => c.r.b)) + (small() ? 30 : 40);
      const U = x => (sgn > 0 ? x : W - x), xs = S, xf = E;
      const uS = U(xs), uF = U(xf), T_ = travel(), uEnd = uF + T_;
      const pre = H * 0.35 / Math.max(1, uF - uS - R0);
      const budgetFor = (u1, u2) => { const a = Math.min(u1, u2), b = Math.max(u1, u2); const before = Math.max(0, Math.min(b, uF) - a), after = Math.max(0, b - Math.max(a, uF)); return before * pre + after; };
      // track space: its x is measured from the track's own left edge (it slides, the shelf goes with it)
      const toT = (x, y) => [x - tLeft, y - tTop];
      const h2 = $('.tt-h', host);
      const hy = rel(h2.getBoundingClientRect(), hr).y;
      // the line comes down the start side, past the headline, to the shelf
      const enter = makePen(svg, xs - hr.left, 0, 'S', sgn);
      enter.to(Math.max(2, hy - beadR()), H * 0.12);
      enter.station(on => on && writeHeadline(h2), 1);
      enter.to(trr.top - hr.top, H * 0.08);
      const [sx, sy] = toT(xs, trr.top - hr.top);
      const pen = makePen(tsvg, sx, sy, 'S', sgn);
      pen.to(toT(0, shelfY)[1] - R0, H * 0.1).turn('F', H * 0.07);
      const D = small() ? 22 : 28, r = beadR();
      const items = cards.map(c => ({ ua: Math.min(U(c.r.x), U(c.r.r)), ub: Math.max(U(c.r.x), U(c.r.r)), card: c.card })).sort((a, b) => a.ua - b.ua);
      let u = uS + R0;
      const straight = (u2, withBead) => {
        const gap = u2 - u; if (gap <= 0.5) return;
        if (withBead && gap > 2 * r + 24) { const half = (gap - 2 * r) / 2; pen.line(half, budgetFor(u, u + half)); pen.bead(budgetFor(u + half, u + half + 2 * r)); pen.line(half, budgetFor(u + half + 2 * r, u2)); }
        else pen.line(gap, budgetFor(u, u2));
        u = u2;
      };
      items.forEach((it, i) => {
        straight(it.ua, i > 0);
        const n = Math.max(2, Math.floor((it.ub - it.ua) / D) - 1);
        const m = (it.ub - it.ua - n * D) / 2;
        straight(it.ua + m, false);
        // a star in each circle, as on the glass, once its circle is drawn
        const stars = [];
        for (let k = 0; k < n; k++) {
          const cxU = u + (k + 0.5) * D, [tx, ty] = toT(sgn > 0 ? cxU : W - cxU, shelfY);
          const s = el('path', { d: STAR_D, class: 'shelf-star', transform: `translate(${tx.toFixed(1)} ${ty.toFixed(1)}) scale(${(D * 0.3).toFixed(2)})` }, tsvg);
          s.style.opacity = 0; stars.push(s);
        }
        let woke = false;
        pen.lozenges(n, D, budgetFor(u, u + n * D), {
          onProgress(f) {
            stars.forEach((s, k) => { s.style.opacity = f >= (k + 1) / n ? 1 : 0; });
            it.card.__want = f >= 0.97; it.card.__i = i;
            // the pen has passed under the card: its picture and its name are drawn
            if (f > 0.4 && !woke) { woke = true; const a = $('.card-art svg.art', it.card), nm = $('.card-name svg.tt', it.card); if (a) drawArt(a, { max: 2.2 }); if (nm) drawArt(nm, { ordered: true, max: 1.2, delay: 0.3 }); }
          },
        });
        u += n * D;
        straight(it.ub, false);
      });
      straight(uEnd - R0, true);
      pen.turn('S', R0);
      menuGeom = { ps: items.map(it => Math.min(1, Math.max(0, ((it.ua + it.ub) / 2 - W / 2) / Math.max(1, T_)))) };
      menuActive = -1;
      // the exit: down from where the end of the shelf comes to rest
      const ex = makePen(svg, xf - hr.left, shelfY + R0, 'S', sgn);
      ex.line(hr.height - (shelfY + R0), 0.4 * H);
      const c = addChain('menu', host, { links: [...enter.links, ...pen.links, ...ex.links] });
      lineTrigger(c, { start: () => (menuPin ? menuPin.start : 0) - 0.6 * vh(), end: () => (menuPin ? menuPin.end : 0) + 0.4 * vh() });
    }

    // ---------------- evening: dusk, the magician's hat ----------------
    {
      const { n: host, r: hr } = R('#evening'), svg = $('.ink', host);
      sizeSvg(svg, hr.width, hr.height);
      const skyH = $('.sky', host).offsetHeight;
      const pen = makePen(svg, E - hr.left, 0, 'S', sgn);
      const h2 = $('.tt-h', host), hat = $('.art-hat svg', host);
      stations(pen, [
        [rel(h2.getBoundingClientRect(), hr).y, () => writeHeadline(h2)],
        [rel(hat.getBoundingClientRect(), hr).y + 20, () => { drawArt(hat, { max: 2.6 }); tadaBurst(hat); }],
      ], hr.height);
      skyGradient(svg, 'skyEvening', skyH, PURPLE, CREAM);
      const c = addChain('evening', host, pen, { sky: { dark: 'bottom', at: skyH * 0.45 } });
      const rr = chainRange(c); lineTrigger(c, { start: rr.start, end: rr.end });
    }

    // ---------------- branches: a route, a station at each branch ----------------
    {
      const host = $('#branches'), svg = $('.ink', host);
      host.style.paddingBottom = '';
      let hr = host.getBoundingClientRect();
      const lis = $$('#branchRows li');
      const hoursB = rel($('.rows-hours', host).getBoundingClientRect(), hr).b;
      const want = Math.abs(S - E) * 0.3 + 60, room = hr.height - hoursB;
      if (room < want) { host.style.paddingBottom = `calc(var(--gap) + ${Math.ceil(want - room)}px)`; hr = host.getBoundingClientRect(); }
      sizeSvg(svg, hr.width, hr.height);
      const pen = makePen(svg, E - hr.left, 0, 'S', sgn);
      const h2 = $('.tt-h', host);
      pen.to(Math.max(2, rel(h2.getBoundingClientRect(), hr).y - beadR()));
      pen.station(on => on && writeHeadline(h2));
      lis.forEach((li, i) => {
        const row = rel(li.getBoundingClientRect(), hr);
        pen.to(Math.max(pen.y + 2, row.y + row.h / 2 - beadR()));
        pen.station(on => { li.classList.toggle('is-reached', on); if (on) { drawArt($('svg.art', li), { max: 1.6 }); sound('tile', i + 2); } });
      });
      const y0 = Math.max(pen.y + 20, hoursB + 24), y1 = hr.height, k = (y1 - y0) * 0.62, xs = S - hr.left;
      pen.to(y0);
      pen.cubic([pen.x, y0 + k], [xs, y1 - k], [xs, y1], undefined, 'S');
      const c = addChain('branches', host, pen);
      const rr = chainRange(c); lineTrigger(c, { start: rr.start, end: rr.end });
    }

    // ---------------- order: the road ----------------
    {
      const { n: host, r: hr } = R('#order'), svg = $('.ink', host);
      sizeSvg(svg, hr.width, hr.height);
      const pen = makePen(svg, S - hr.left, 0, 'S', sgn);
      const h2 = $('.tt-h', host), road = $('#road'), rr0 = rel(road.getBoundingClientRect(), hr);
      const scooter = $('.art-scooter', road), palm = $('.art-palm svg', road);
      pen.to(Math.max(2, rel(h2.getBoundingClientRect(), hr).y - beadR()));
      pen.station(on => on && writeHeadline(h2));
      pen.to(rr0.b + 1 - R0);
      pen.turn('F');
      const span = Math.abs((E - hr.left) - sgn * R0 - pen.x);
      const sw = scooter.offsetWidth, roadW = road.offsetWidth, palmW = $('.art-palm', road).offsetWidth;
      const drive = Math.max(0, roadW - sw - palmW - 30);
      pen.line(span, Math.max(280, span * 0.6), {
        onProgress: f => {
          if (f > 0.01) drawArt($('svg.art', scooter), { max: 1.6 });
          if (f > 0.6) drawArt(palm, { max: 1.8 });
          gsap.set(scooter, { x: sgn * drive * Math.min(1, f * 1.05) });
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
      const pen = makePen(svg, E - hr.left, 0, 'S', sgn);
      const h2 = $('.tt-h', host);
      pen.to(Math.max(2, rel(h2.getBoundingClientRect(), hr).y - beadR()));
      pen.station(on => on && writeHeadline(h2));
      pen.to(hr.height);
      const c = addChain('collab', host, pen);
      const rr = chainRange(c); lineTrigger(c, { start: rr.start, end: rr.end });
    }

    // ---------------- the glass: the line draws the hand on it, the hand snaps ----------------
    {
      const { n: host, r: hr } = R('#glass'), svg = $('.ink', host);
      sizeSvg(svg, hr.width, hr.height);
      const img = $('#muralImg'), ir = img.getBoundingClientRect(), MW = 8022, Hd = ART.hand;
      const k = ir.width / MW;
      const box = { x: ir.left - hr.left + Hd.at[0] * k, y: ir.top - hr.top + Hd.at[1] * k, w: Hd.vb[2] * k, h: Hd.vb[3] * k };
      const hand = TL.buildHand({ pen: true, cls: 'glass-hand' });
      ['x', 'y'].forEach(q => hand.svg.setAttribute(q, box[q].toFixed(1)));
      hand.svg.setAttribute('width', box.w.toFixed(1)); hand.svg.setAttribute('height', box.h.toFixed(1));
      svg.appendChild(hand.svg);
      const fx = TL.addSnapHelpers(hand);
      TL.prepSnap(gsap, hand, fx);
      gsap.set(hand.stars, { scale: reduce ? 1 : 0, opacity: reduce ? 1 : 0 });
      // guides: the centerlines in the visible tree, for the head to ride
      const t0 = Hd.line.t, gG = el('g', { transform: `translate(${t0[0]} ${t0[1]})`, class: 'hand-guides' }, hand.svg);
      const guide = {}; Hd.line.strokes.forEach(s => { guide[s.id] = el('path', { d: s.d, class: 'hand-guide' }, gG); });
      const P = (px, py) => [box.x + (px + t0[0]) * k, box.y + (py + t0[1]) * k];
      const ends = id => { const g = guide[id], L = g.getTotalLength(), a = g.getPointAtLength(0), b = g.getPointAtLength(L); return { a: [a.x, a.y], b: [b.x, b.y], L }; };
      const fromLeft = (E - hr.left) < box.x + box.w / 2;
      const order = fromLeft
        ? [['outer', 0], ['pinky', 1], ['ring', 1], ['middle_b', 0], ['thumb', 0], ['thumbtop', 0], ['middle_a', 0], ['midtip', 0]]
        : [['outer', 1], ['thumb', 1], ['thumbtop', 0], ['middle_a', 0], ['ring', 0], ['pinky', 0], ['middle_b', 1], ['midtip', 0]];
      const first = ends(order[0][0]);
      const Ept = P(...(order[0][1] ? first.b : first.a));
      // the line reaches the glass along its top edge and comes down through the arch
      const pen = makePen(svg, E - hr.left, 0, 'S', sgn);
      const fr0 = rel($('#muralFrame').getBoundingClientRect(), hr);
      const yTop = Math.max(30, fr0.y - 28), xMid = box.x + box.w / 2, dir = Math.sign(xMid - pen.x) || 1;
      pen.to(yTop - R0);
      pen.turn(dir === sgn ? 'F' : 'B');
      pen.toX(xMid - dir * R0);
      pen.turn('S');
      const yDown = Math.max(pen.y + 10, box.y - box.h * 0.12);
      pen.to(yDown);
      const g0 = guide[order[0][0]], L0 = first.L;
      const q1 = g0.getPointAtLength(order[0][1] ? L0 : 0), q2 = g0.getPointAtLength(order[0][1] ? L0 - 6 : 6);
      const tx = q2.x - q1.x, ty = q2.y - q1.y, tl = Math.hypot(tx, ty) || 1;
      const reach = Math.max(30, Math.min(90, box.h * 0.3));
      pen.cubic([pen.x, yDown + (Ept[1] - yDown) * 0.55], [Ept[0] - (tx / tl) * reach, Ept[1] - (ty / tl) * reach], Ept);
      const scale = 0.5;   // scroll px per screen px of the hand's ink
      order.forEach(([id, rev], i) => {
        const e = ends(id);
        const start = P(...(rev ? e.b : e.a)), end = P(...(rev ? e.a : e.b));
        if (i > 0 && Math.hypot(start[0] - pen.x, start[1] - pen.y) > 2) pen.hop(start, Math.hypot(start[0] - pen.x, start[1] - pen.y) * 0.3);
        pen.stroke([{ el: guide[id], ulen: e.L, reverse: !!rev }, { el: hand.pens[id], ulen: e.L, reverse: !!rev, keepOpacity: true }], e.L * k * scale, end);
      });
      // the approach (everything before the hand's first stroke) leaves once the hand has snapped
      const approach = pen.links.slice().map(l => l.parts[0].el);
      const c = addChain('glass', host, pen, { last: true });
      c.approach = approach.slice(0, approach.indexOf(guide[order[0][0]]));
      lineTrigger(c, { start: () => `top ${Math.round(READ * 100)}%`, end: () => 'bottom bottom' });
      ending = { hand, fx, chain: c, snapTl: null };
      const frame = $('#muralFrame');
      triggers.push(gsap.fromTo(frame, { '--r': 0 }, { '--r': 100, ease: 'none', scrollTrigger: { trigger: frame, start: 'top 92%', end: 'center 55%', scrub: 1.2, invalidateOnRefresh: true } }));
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
    placeAuras();
  }
  const navH = () => $('#nav').offsetHeight || 72;
  function stations(pen, stops, bottom) {
    stops.sort((a, b) => a[0] - b[0]);
    for (const [y, fn] of stops) {
      const at = Math.max(pen.y + 2, y - beadR());
      if (at + 2 * beadR() > bottom - 4) continue;
      pen.to(at);
      pen.station(on => on && fn());
    }
    pen.to(bottom);
  }
  function sound(name, arg) { if (siteReady && !quiet && sfx[name]) sfx[name](arg); }
  function sound0(name, arg) { if (!reduce && sfx[name]) sfx[name](arg); }
  function tadaBurst(svg) {
    if (reduce || quiet) return;
    setTimeout(() => {
      sound('tada');
      const r = svg.getBoundingClientRect();
      spawn(null, r.left + r.width * 0.75, r.top + r.height * 0.28, true, 16, { radial: true, speed: 60, spread: 6, life: 1, rise: 6, sizeMax: 5 });
    }, 1400);
  }

  // ---------- the ending: the line has drawn the hand; the hand snaps ----------
  function endingCheck() {
    if (!ending || reduce) return;
    const p = ending.chain.p;
    if (p >= 0.999 && !snapped) park();
    else if (p < 0.985 && snapped) unpark();
  }
  function park() {
    snapped = true; parked = true;
    const { hand, fx } = ending;
    hand.unmask();
    const tl = gsap.timeline();
    ending.snapTl = tl;
    const keys = TL.addSnap(tl, hand, fx, 0.05, { stars: false });
    tl.add(() => sound('snap'), keys.R);
    tl.add(() => {
      // the release launches the magic from the fingertips into its own place
      const bb = hand.low.getBoundingClientRect(), from = { x: headState.x, y: headState.y };
      gsap.to(from, {
        x: bb.left + bb.width / 2, y: bb.top + bb.height / 2, duration: 0.34, ease: 'power3.out',
        onUpdate() { magic.style.transform = `translate3d(${from.x}px, ${from.y}px, 0)`; },
        onComplete: () => {
          gsap.to(magic, { opacity: 0, duration: 0.2 });
          headState.shown = false;
          gsap.fromTo(hand.low, { opacity: 1, scale: 1.7 }, { scale: 1, duration: 0.5, ease: 'back.out(3)' });
          sound('land');
        },
      });
    }, keys.HIT);
    hand.stars.filter(s => s !== hand.low).forEach((s, n) => {
      const at = keys.HIT + 0.42 + n * 0.1;
      tl.to(s, { opacity: 1, duration: 0.08, ease: 'none' }, at);
      tl.fromTo(s, { scale: 0, rotation: -20 }, { scale: 1, rotation: 0, duration: 0.34, ease: 'back.out(3)' }, at);
    });
    tl.add(() => sound('tada'), keys.HIT + 0.42);
    // the thread that brought the magic here goes quiet: the glass is left as drawn
    tl.to(ending.chain.approach || [], { opacity: 0, duration: 1.4, ease: 'power1.inOut' }, keys.HIT + 0.8);
  }
  function unpark() {
    snapped = false; parked = false;
    const { hand } = ending;
    if (ending.snapTl) ending.snapTl.kill();
    gsap.killTweensOf(magic);
    headState.shown = false; gsap.set(magic, { opacity: 0 });
    gsap.set(hand.stars, { opacity: 0, scale: 0 });
    gsap.set([hand.root, hand.gMid, hand.gThumb, hand.gRing, hand.gPinky], { rotation: 0, x: 0, y: 0 });
    hand.remask();
    // the thread comes back with the line (setLink sets each link's opacity again)
    ending.chain.links.forEach(l => (l.f = -1));
    draw(ending.chain, ending.chain.p);
  }
  function replaySnap() {
    if (!snapped || !ending || reduce) return;
    const tl = gsap.timeline();
    const keys = TL.addSnap(tl, ending.hand, ending.fx, 0.02, { stars: false });
    tl.add(() => sfx.snap(), keys.R);
    ending.hand.stars.forEach((s, n) => tl.fromTo(s, { scale: 0.4 }, { scale: 1, duration: 0.34, ease: 'back.out(3)' }, keys.HIT + n * 0.06));
  }
  $('#glass').addEventListener('click', e => {
    if (!ending) return;
    const r = ending.hand.svg.getBoundingClientRect();
    if (e.clientX > r.left && e.clientX < r.right && e.clientY > r.top && e.clientY < r.bottom) replaySnap();
  });

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
    e.preventDefault(); goTo(id);
  }));
  addEventListener('scroll', () => $('#nav').classList.toggle('is-scrolled', scrollY > 40), { passive: true });

  const mm = $('#mMenu');
  const outside = () => [$('main'), $('footer'), $('.nav-links'), $('.nav-mark')];
  function openMenu() {
    mm.hidden = false; $('#menuBtn').setAttribute('aria-expanded', 'true');
    outside().forEach(n => n && (n.inert = true));
    lenis && lenis.stop(); document.documentElement.style.overflow = 'hidden';
    if (!reduce) { gsap.fromTo(mm, { opacity: 0 }, { opacity: 1, duration: 0.45, ease: 'power2.out' }); gsap.fromTo($$('.mmenu-links a', mm), { opacity: 0, y: 14 }, { opacity: 1, y: 0, duration: 0.6, stagger: 0.05, ease: 'power2.out', delay: 0.05 }); }
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

  SND.bind();
  SND.onChange(paintSound);
  $$('.sound-toggle').forEach(b => b.addEventListener('click', () => { SND.toggle(); paintSound(); }));

  // ---------- the cursor's magic (mouse only) ----------
  // the glass's lozenges show where the cursor passes, a softer halo trails it, it sheds a
  // sparkle now and then, and a click opens a ring with a little burst
  const auras = [];
  function placeAuras() {
    auras.length = 0;
    $$('main > section, #glass').forEach(sec => {
      let a = $(':scope > .aura', sec);
      if (!a) { a = document.createElement('div'); a.className = 'aura'; a.setAttribute('aria-hidden', 'true'); sec.prepend(a); }
      const r = sec.getBoundingClientRect(), top = r.top + scrollY, Tz = parseFloat(getComputedStyle(a).getPropertyValue('--tile')) || 46;
      a.style.backgroundPosition = `${(-(r.left % Tz)).toFixed(1)}px ${(-(top % Tz)).toFixed(1)}px`;
      auras.push({ sec, a });
    });
  }
  function setupPointerMagic() {
    if (reduce || !fine) return;
    const m = { x: -999, y: -999, bx: -999, by: -999, on: false };
    let lx = -999, ly = -999, lt = 0;
    addEventListener('pointermove', e => {
      if (e.pointerType !== 'mouse') return;
      m.x = e.clientX; m.y = e.clientY; m.on = true;
      if (!siteReady) return;
      const now = performance.now();
      if (Math.hypot(e.clientX - lx, e.clientY - ly) < 34 || now - lt < 90) return;
      lx = e.clientX; ly = e.clientY; lt = now;
      if (Math.random() < 0.55) spawn(null, e.clientX, e.clientY, isDark(e.target), 1, { spread: 4, speed: 10, sizeMin: 1.4, sizeMax: 2.6, bigChance: 0, life: 0.5, rise: 6 });
    }, { passive: true });
    document.documentElement.addEventListener('mouseleave', () => { m.on = false; });
    addEventListener('pointerdown', e => {
      if (e.button > 0 || !siteReady || e.pointerType === 'touch') return;
      const ctrl = e.target.closest && e.target.closest('a, button, [role="button"], .card');
      const dark = isDark(e.target);
      ring(e.clientX, e.clientY, dark, ctrl ? 22 : 15);
      spawn(null, e.clientX, e.clientY, dark, ctrl ? 9 : 5, { spread: 2, speed: ctrl ? 70 : 46, sizeMin: 1.6, sizeMax: 3.4, bigChance: ctrl ? 0.3 : 0.1, life: 0.55, rise: 4, radial: true });
      if (ctrl && !ctrl.classList.contains('card')) { ctrl.classList.remove('is-magic'); void ctrl.offsetWidth; ctrl.classList.add('is-magic'); setTimeout(() => ctrl.classList.remove('is-magic'), 900); }
    }, { passive: true });
    gsap.ticker.add(() => {
      if (!siteReady) return;
      m.bx += (m.x - m.bx) * 0.08; m.by += (m.y - m.by) * 0.08;
      for (const { sec, a } of auras) {
        const r = sec.getBoundingClientRect();
        const near = m.on && m.y > r.top - 260 && m.y < r.bottom + 260;
        if (!near) { if (a.__on) { a.__on = false; a.classList.remove('is-on'); } continue; }
        if (!a.__on) { a.__on = true; a.classList.add('is-on'); }
        a.style.setProperty('--ax', `${(m.x - r.left).toFixed(0)}px`); a.style.setProperty('--ay', `${(m.y - r.top).toFixed(0)}px`);
        a.style.setProperty('--bx', `${(m.bx - r.left).toFixed(0)}px`); a.style.setProperty('--by', `${(m.by - r.top).toFixed(0)}px`);
      }
    });
  }

  // ======================================================================
  // The entrance: everything loads, then one touch lets the sound in
  // ======================================================================
  function preload(onProgress) {
    const parts = {};
    const set = (k, v) => { parts[k] = v; const ks = Object.keys(parts); onProgress(ks.reduce((a, q) => a + parts[q], 0) / ks.length); };
    const jobs = [];
    set('fonts', 0); jobs.push(document.fonts.ready.then(() => set('fonts', 1)));
    if (document.readyState === 'complete') set('page', 1);
    else { set('page', 0); jobs.push(new Promise(r => addEventListener('load', () => { set('page', 1); r(); }, { once: true }))); }
    set('glass', 0); jobs.push(new Promise(r => { const i = new Image(); i.onload = i.onerror = () => { set('glass', 1); r(); }; i.src = $('#muralImg').getAttribute('src'); }));
    return Promise.all(jobs);
  }
  // The star breathes and a bar of light fills as the site loads. Where the browser lets
  // the site sound, it opens by itself; otherwise the full bar waits for one touch, so the
  // drawing, the snap and every note after it are heard.
  function entrance() {
    return new Promise(resolve => {
      const g = $('#ldGate');
      if (!g) { resolve(); return; }
      const barBox = $('.ld-gate-bar', g), bar = $('i', barBox), label = $('.ld-gate-label', g);
      $('.ld-gate-star', g).innerHTML = `<svg viewBox="-1 -1 2 2"><path d="${STAR_D}"/></svg>`;
      const lockWas = document.documentElement.style.overflow;
      document.documentElement.style.overflow = 'hidden';
      let heard = false, notes = 0, waiting = false, done = false;
      SND.probe().then(ok => { if (ok) heard = true; });
      const shown = { v: 0 };
      const render = () => {
        bar.style.transform = `scaleX(${shown.v})`;
        barBox.style.setProperty('--p', shown.v.toFixed(4));
        barBox.setAttribute('aria-valuenow', Math.round(shown.v * 100));
        while (heard && SND.enabled() && notes < 4 && shown.v >= 0.18 + notes * 0.24) sfx.gateNote(notes++);
      };
      const open = () => {
        if (done) return; done = true;
        removeEventListener('click', onTouch, true); removeEventListener('keydown', onTouch, true);
        if (SND.enabled()) sfx.gateOpen();
        document.documentElement.style.overflow = lockWas;
        g.classList.remove('is-waiting'); g.removeAttribute('role'); g.removeAttribute('tabindex');
        if (!reduce) spawn(null, innerWidth / 2, $('.ld-gate-star', g).getBoundingClientRect().top + 15, true, 12, { radial: true, speed: 70, spread: 4, life: 0.9, rise: 0 });
        gsap.to(g, { opacity: 0, duration: 0.6, delay: 0.15, ease: 'power2.inOut', onComplete: () => g.remove() });
        setTimeout(resolve, 300);
      };
      function onTouch(e) {
        if (e.type === 'keydown' && (e.metaKey || e.ctrlKey || e.altKey || e.key === 'Tab' || e.key === 'Shift')) return;
        SND.unlock(); heard = true;
        if (waiting) { e.preventDefault(); open(); }
      }
      addEventListener('click', onTouch, true); addEventListener('keydown', onTouch, true);
      const ready = () => {
        if (heard || !SND.enabled() || reduce) { open(); return; }
        waiting = true;
        const text = T().gate.tap;
        g.setAttribute('role', 'button'); g.tabIndex = 0; g.setAttribute('aria-label', text);
        gsap.to(barBox, { opacity: 0, scaleX: 0.6, duration: 0.6, ease: 'power2.inOut' });
        gsap.to(label, { opacity: 0, duration: 0.3, ease: 'power1.in', onComplete: () => { label.textContent = text; g.classList.add('is-waiting'); gsap.fromTo(label, { opacity: 0 }, { opacity: 0.92, duration: 0.7, ease: 'power1.out', clearProps: 'opacity' }); } });
        g.focus({ preventScroll: true });
      };
      const t0 = performance.now();
      let target = 0;
      preload(f => { if (f > target) { target = f; gsap.to(shown, { v: target * 0.94, duration: 0.45, ease: 'power2.out', overwrite: true, onUpdate: render }); } })
        .then(() => {
          const wait = Math.max(0, 500 - (performance.now() - t0)) / 1000;
          gsap.to(shown, { v: 1, duration: 0.4, delay: wait, ease: 'power2.inOut', overwrite: true, onUpdate: render, onComplete: () => setTimeout(ready, 120) });
        });
    });
  }

  // ======================================================================
  // Start
  // ======================================================================
  const sides = () => [$('.sill'), $('.hero-words'), $('.hero-hours'), $('.hero-cue'), $('#nav')];
  function prepWaiting() {
    $$('main svg.art').forEach(s => { if (!s.closest('.hero-door')) prepDraw(s); });
    $$('.sill svg.art').forEach(prepDraw);
    $$('.tt-h svg.tt').forEach(s => { if (!s.closest('.tt-h').__drawn) prepDraw(s); });
  }
  // after the mark has landed: the arch draws round it, the door's sides arrive, the line begins
  function openDoor(quick) {
    showLockup(true);
    const tagline = $('.hero-tagline svg.art'), insta = $('#heroInsta svg.art'), tadaIr = $('.order-link svg.art'), sill = $$('.sill svg.art');
    const tl = gsap.timeline();
    tl.to(sides(), { opacity: 1, duration: quick ? 0.6 : 1.1, stagger: 0.12, ease: 'power2.out' }, quick ? 0 : 0.5);
    tl.add(() => { drawArt(tagline, { max: 2 }); sill.forEach((s, i) => drawArt(s, { max: 1.6, delay: i * 0.3 })); }, quick ? 0 : 0.6);
    tl.add(() => { drawArt(insta, { max: 1.4 }); drawArt(tadaIr, { max: 1.2 }); }, quick ? 0.2 : 1.1);
    return drawArch(quick ? 0.7 : 1.5);
  }
  function startSite() {
    siteReady = true; started = true;
    setupLenis();
    setupPointerMagic();
    quiet = true;
    buildRoute();
    ScrollTrigger.refresh();
    quiet = false;
    if (reduce) {
      gsap.set('.hero-cue', { opacity: 0.85 });
      $$('svg.art, svg.tt').forEach(s => drawArt(s, { instant: true }));
      $$('.tt-h').forEach(h => (h.__drawn = true));
      chains.forEach(c => draw(c, 1));
      return;
    }
    // the birth of the magic, at the end of the threshold
    gsap.fromTo(magic, { scale: 0 }, { scale: 1, duration: 0.7, ease: 'back.out(2.5)', delay: 0.05 });
    const b = chains[0] && startOf(chains[0]);
    if (b) { const sp = screenPoint(b.el, b.len); spawn(b.el, sp.lx, sp.ly, true, 6, { keep: true }); }
    sound('bubble');
  }
  // the loader's pen tip: the magic itself, before the page is open
  let loaderTip = null;
  function tipAt(x, y, on) {
    if (!loaderTip) { loaderTip = makeQuill(); loaderTip.classList.add('is-loader', 'on-dark'); }
    loaderTip.style.opacity = on ? 1 : 0;
    if (on) { loaderTip.style.transform = `translate3d(${x.toFixed(1)}px, ${y.toFixed(1)}px, 0)`; if (Math.random() < 0.3) spawn(null, x, y, true, 1, HUG); }
  }

  buildDoor();
  fillSlots();
  applyLang();
  fitAll();
  const loaderEl = $('#loader');
  if (reduce) {
    showLockup(true); drawArch(0);
    $$('svg.art, svg.tt').forEach(s => drawArt(s, { instant: true }));
    entrance().then(() => { loaderEl.classList.add('is-done'); loaderEl.setAttribute('aria-hidden', 'true'); startSite(); });
  } else {
    prepWaiting();
    showLockup(false);
    door.arch.style.strokeDasharray = '0 99999';
    gsap.set(sides(), { opacity: 0 });
    const first = TL.shouldPlayLoader();
    entrance().then(() => {
      if (first) {
        TL.playLoader(loaderEl, {
          sfx, slots: doorSlots, tip: tipAt,
          onLanded: () => showLockup(true),
          onDone: () => openDoor(false).then(startSite),
        });
      } else {
        gsap.to(loaderEl, { opacity: 0, duration: 0.5, ease: 'power2.out', onComplete: () => { loaderEl.classList.add('is-done'); loaderEl.setAttribute('aria-hidden', 'true'); } });
        openDoor(true).then(startSite);
      }
    });
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
    const drawn = new Set($$('.tt-h').filter(h => h.__drawn).map(h => h.dataset.tt));
    applyLang();
    $$('.tt-h').forEach(h => { const s = $('svg.tt', h); if (drawn.has(h.dataset.tt)) { h.__drawn = true; if (s) drawArt(s, { instant: true }); } else if (s) prepDraw(s); });
    $$('#menuTrack svg.art, #menuTrack svg.tt, #branchRows svg.art').forEach(s => prepDraw(s));
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
    if (Math.abs(innerWidth - lastW) < 2 && !fine) return;
    lastW = innerWidth;
    clearTimeout(rz); rz = setTimeout(rebuild, 220);
  });
})();
