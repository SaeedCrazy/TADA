// TADA loader: the entrance, the snap, the star that opens the page
// ------------------------------------------------------------------
// The previous site's loader, now with the mark as the designer drew it on the glass.
// One pen draws the hand along the brand's own centerlines (each stroke reveals the
// designer's outlined mark beneath it, so what is drawn is never a redraw), writes
// «تادا» and «TADA», and the hand snaps: wind-up, a 70 ms release, the hit, the three
// sparkles popping, an elastic return to the exact mark. Then the lowest sparkle opens:
// it grows, glowing, until its points have swept the screen, and what it reveals is the
// page. The hand and the wordmarks fly into the door on the glass.
//
// Only transform, opacity and stroke-dashoffset animate, with two exceptions noted
// inline (the flight resizes boxes; the star is an SVG mask transform).
// Classic script; exposes window.TadaLoader.

(function () {
  'use strict';

  const NS = 'http://www.w3.org/2000/svg';
  const el = (name, attrs = {}, parent) => { const n = document.createElementNS(NS, name); for (const k in attrs) n.setAttribute(k, attrs[k]); if (parent) parent.appendChild(n); return n; };
  const ART = TADA_ART, H = ART.hand, FA = ART.wordFa, EN = ART.wordEn;
  const T0 = H.line.t;                                    // the kit's centerline space → the mark's
  const P = (x, y) => ({ x: x + T0[0], y: y + T0[1] });
  // pivots of the snap, from the kit (same hand)
  const C = P(487.5, 404), K_MID = P(543, 496), K_THUMB = P(396.5, 671.5), K_WRIST = P(555, 890), K_RING = P(543, 496), K_PINKY = P(669, 509);
  const HW = H.vb[2], HH = H.vb[3];

  function box(d) {
    const n = d.match(/-?[\d.]+/g).map(Number); const xs = [], ys = [];
    for (let i = 0; i + 1 < n.length; i += 2) { xs.push(n[i]); ys.push(n[i + 1]); }
    const x0 = Math.min(...xs), x1 = Math.max(...xs), y0 = Math.min(...ys), y1 = Math.max(...ys);
    return { cx: (x0 + x1) / 2, cy: (y0 + y1) / 2, r: Math.max(x1 - x0, y1 - y0) / 2 };
  }
  const STARS = H.p.map((p, i) => (H.groups[i] === 'star' ? { i, d: p[0], ...box(p[0]) } : null)).filter(Boolean);
  const LOW = STARS.slice().sort((a, b) => b.cy - a.cy)[0];   // the lowest sparkle: the magic itself

  let uid = 0;
  /**
   * The mark, ready to be drawn and to snap: the designer's outlined pieces in the
   * finger groups of the snap, the three sparkles, and (optionally) the pen: a mask of
   * the brand's centerlines that reveals the mark as they are drawn.
   */
  function buildHand({ cls = '', pen = true } = {}) {
    const id = ++uid;
    const svg = el('svg', { viewBox: `0 0 ${HW} ${HH}`, class: `tada-hand ${cls}`.trim(), 'aria-hidden': 'true', focusable: 'false' });
    const defs = el('defs', {}, svg);
    // one piece of the mark runs the whole middle finger: its tip half turns in the snap
    const clipA = el('clipPath', { id: `hcA${id}`, clipPathUnits: 'userSpaceOnUse' }, defs);
    el('rect', { x: -400, y: -400, width: HW + 800, height: K_MID.y + 400 }, clipA);
    const clipB = el('clipPath', { id: `hcB${id}`, clipPathUnits: 'userSpaceOnUse' }, defs);
    el('rect', { x: -400, y: K_MID.y, width: HW + 800, height: HH + 800 }, clipB);
    const pens = {};
    let maskG = null;
    if (pen) {
      const m = el('mask', { id: `hm${id}`, maskUnits: 'userSpaceOnUse', x: -400, y: -400, width: HW + 800, height: HH + 800 }, defs);
      maskG = el('g', { transform: `translate(${T0[0]} ${T0[1]})` }, m);
      H.line.strokes.forEach(s => { pens[s.id] = el('path', { d: s.d, fill: 'none', stroke: '#fff', 'stroke-width': 36, 'stroke-linecap': 'round', 'stroke-linejoin': 'round' }, maskG); });
    }
    const root = el('g', { class: 'hand-root' }, svg);
    const ink = el('g', { class: 'hand-ink' }, root);
    if (pen) ink.setAttribute('mask', `url(#hm${id})`);
    const gThumb = el('g', {}, ink), gMid = el('g', {}, ink), gRing = el('g', {}, ink), gPinky = el('g', {}, ink), gRest = el('g', {}, ink);
    const G = { thumb: gThumb, mid: gMid, ring: gRing, pinky: gPinky, root: gRest };
    const gStars = el('g', { class: 'hand-stars' }, root);
    const stars = [];
    H.p.forEach(([d], i) => {
      const g = H.groups[i];
      if (g === 'star') { stars.push(el('path', { d, class: 'hand-star' }, gStars)); return; }
      if (g === 'split') {
        el('path', { d, class: 'hand-part', 'clip-path': `url(#hcA${id})` }, gMid);
        el('path', { d, class: 'hand-part', 'clip-path': `url(#hcB${id})` }, gRest);
        return;
      }
      el('path', { d, class: 'hand-part' }, G[g]);
    });
    const starInfo = STARS.map(s => s);
    const low = stars[STARS.indexOf(LOW)];
    return { svg, root, ink, gThumb, gMid, gRing, gPinky, stars, starInfo, low, pens, maskId: `hm${id}`, unmask: () => ink.removeAttribute('mask'), remask: () => pen && ink.setAttribute('mask', `url(#hm${id})`) };
  }

  /** The two wordmarks of the door, as the designer set them (fa over en), as strokes. */
  function buildWords({ cls = '' } = {}) {
    const x0 = Math.min(FA.at[0], EN.at[0]), y0 = FA.at[1];
    const x1 = Math.max(FA.at[0] + FA.vb[2], EN.at[0] + EN.vb[2]), y1 = EN.at[1] + EN.vb[3];
    const svg = el('svg', { viewBox: `${x0} ${y0} ${x1 - x0} ${y1 - y0}`, class: `tada-words ${cls}`.trim(), 'aria-hidden': 'true', focusable: 'false' });
    const strokes = [];
    const add = (piece, dir) => {
      const g = el('g', { transform: `translate(${piece.at[0]} ${piece.at[1]})` }, svg);
      const parts = [];
      piece.p.forEach(([d, k, w]) => d.split(/(?=M)/).forEach(sub => {
        const p = el('path', { d: sub, class: 'word-stroke', 'stroke-width': (9.85 * (w || 1)).toFixed(2) }, g);
        const b = p.getBBox ? null : null;
        parts.push(p);
      }));
      return parts.map(p => ({ p, x: box(p.getAttribute('d')).cx })).sort((a, b) => dir * (a.x - b.x)).map(o => o.p);
    };
    strokes.push(...add(FA, -1), ...add(EN, 1));   // تادا right to left, then TADA left to right
    return { svg, strokes, box: { x: x0, y: y0, w: x1 - x0, h: y1 - y0 } };
  }

  // helper strokes for the snap
  function addSnapHelpers(hand) {
    const smear = el('g', { class: 'g-smear' }, hand.root);
    [...hand.gMid.children].forEach(n => smear.appendChild(n.cloneNode(true)));
    const burst = el('g', { class: 'g-burst' }, hand.root);
    const burstLines = [[-110, 34], [-85, 44], [-60, 52], [-35, 44], [-10, 34]].map(([a, len]) => {
      const r = (a * Math.PI) / 180, r0 = 24;
      return el('path', {
        d: `M${C.x + Math.cos(r) * r0} ${C.y + Math.sin(r) * r0} l${Math.cos(r) * len} ${Math.sin(r) * len}`,
        class: 'burst-line', 'stroke-dasharray': `${len} ${2 * len + 2}`, 'stroke-dashoffset': len + 1, 'data-len': len,
      }, burst);
    });
    return { smear, burst, burstLines };
  }
  function prepSnap(gsap, hand, fx) {
    gsap.set(hand.gMid, { svgOrigin: `${K_MID.x} ${K_MID.y}` });
    gsap.set(fx.smear, { svgOrigin: `${K_MID.x} ${K_MID.y}`, opacity: 0 });
    gsap.set(fx.burst, { opacity: 0 });
    gsap.set(hand.gThumb, { svgOrigin: `${K_THUMB.x} ${K_THUMB.y}` });
    gsap.set(hand.gRing, { svgOrigin: `${K_RING.x} ${K_RING.y}` });
    gsap.set(hand.gPinky, { svgOrigin: `${K_PINKY.x} ${K_PINKY.y}` });
    gsap.set(hand.root, { svgOrigin: `${K_WRIST.x} ${K_WRIST.y}` });
    hand.stars.forEach((st, i) => gsap.set(st, { svgOrigin: `${hand.starInfo[i].cx} ${hand.starInfo[i].cy}` }));
  }
  /**
   * The snap at time A: wind-up, 70 ms release, hit (burst, wrist jolt, sparkles
   * popping lowest first), 160 ms hold, elastic return to identity. Returns key times.
   */
  function addSnap(tl, hand, fx, A, { stars = true } = {}) {
    const { gMid, gThumb, gRing, gPinky, root } = hand, { smear, burst, burstLines } = fx;
    tl.to(gMid, { rotation: 3.5, duration: 0.28, ease: 'power2.in' }, A);
    tl.to(gThumb, { rotation: 2.5, duration: 0.28, ease: 'power2.in' }, A);
    tl.to(root, { rotation: -3, y: 7, duration: 0.28, ease: 'power2.in' }, A);
    tl.to([gRing, gPinky], { rotation: -1.5, duration: 0.28, ease: 'power2.in' }, A);
    const R = A + 0.28;
    tl.set(smear, { opacity: 0.35, rotation: 3.5 }, R);
    tl.to(gMid, { rotation: -52, y: 8, duration: 0.07, ease: 'none' }, R);
    tl.to(smear, { rotation: -52, y: 8, duration: 0.07, ease: 'none' }, R + 0.035);
    tl.to(gThumb, { rotation: -14, duration: 0.07, ease: 'none' }, R);
    tl.to(root, { rotation: 2, y: -4, duration: 0.12, ease: 'back.out(2)' }, R);
    const HIT = R + 0.07;
    tl.set(burst, { opacity: 1 }, HIT);
    tl.to(burstLines, { strokeDashoffset: 0, duration: 0.11, ease: 'none', stagger: 0.014 }, HIT);
    tl.to(burstLines, { strokeDashoffset: (i, e) => -(+e.dataset.len + 1), duration: 0.18, ease: 'power1.in', stagger: 0.014 }, HIT + 0.11);
    tl.set(burst, { opacity: 0 }, HIT + 0.36);
    tl.to(root, { x: 3, duration: 0.033, ease: 'none' }, HIT)
      .to(root, { x: -2, duration: 0.033, ease: 'none' }, HIT + 0.033)
      .to(root, { x: 0, duration: 0.033, ease: 'none' }, HIT + 0.066);
    tl.to(smear, { opacity: 0, duration: 0.12, ease: 'none' }, HIT);
    if (stars) {
      const order = hand.stars.map((s, i) => [s, hand.starInfo[i].cy]).sort((a, b) => b[1] - a[1]).map(a => a[0]);
      order.forEach((s, k) => {
        const at = HIT + 0.04 + k * 0.08;
        tl.to(s, { opacity: 1, duration: 0.08, ease: 'none' }, at);
        tl.fromTo(s, { scale: 0, rotation: -20 }, { scale: 1, rotation: 0, duration: 0.3, ease: 'back.out(3)' }, at);
      });
    }
    const S = HIT + 0.16;
    tl.to(gMid, { rotation: 0, y: 0, duration: 0.55, ease: 'elastic.out(1, 0.55)' }, S);
    tl.to(gThumb, { rotation: 0, duration: 0.55, ease: 'elastic.out(1, 0.55)' }, S);
    tl.to(root, { rotation: 0, y: 0, duration: 0.55, ease: 'elastic.out(1, 0.55)' }, S);
    tl.to(gRing, { rotation: 2.5, duration: 0.1, ease: 'power1.out' }, S + 0.04).to(gRing, { rotation: 0, duration: 0.45, ease: 'elastic.out(1, 0.55)' }, S + 0.14);
    tl.to(gPinky, { rotation: 4, duration: 0.1, ease: 'power1.out' }, S + 0.08).to(gPinky, { rotation: 0, duration: 0.45, ease: 'elastic.out(1, 0.55)' }, S + 0.18);
    return { R, HIT, S, END: S + 0.55 };
  }

  // The night with a star-shaped hole: the lowest sparkle, scaled about its own centre.
  function buildVeil(bgEl) {
    bgEl.replaceChildren();
    const id = ++uid;
    const svg = el('svg', { class: 'ld-veil', preserveAspectRatio: 'none', 'aria-hidden': 'true' }, bgEl);
    const defs = el('defs', {}, svg);
    const mask = el('mask', { id: `ldm${id}`, maskUnits: 'userSpaceOnUse' }, defs);
    const white = el('rect', { fill: '#fff' }, mask);
    const hole = el('g', {}, mask);
    el('path', { d: LOW.d, fill: '#000' }, hole);
    const grad = el('radialGradient', { id: `ldg${id}`, cx: '50%', cy: '50%', r: '50%' }, defs);
    el('stop', { offset: '0', 'stop-color': '#C9B3CF', 'stop-opacity': '0' }, grad);
    el('stop', { offset: '0.62', 'stop-color': '#C9B3CF', 'stop-opacity': '0.05' }, grad);
    el('stop', { offset: '1', 'stop-color': '#C9B3CF', 'stop-opacity': '0.45' }, grad);
    const night = el('rect', { class: 'ld-night', mask: `url(#ldm${id})` }, svg);
    const edge = el('g', { class: 'ld-edge' }, svg);
    const fill = el('path', { d: LOW.d, class: 'ld-edge-fill' }, edge);
    el('path', { d: LOW.d, class: 'ld-edge-glow', fill: `url(#ldg${id})` }, edge);
    [[54, .06], [26, .14], [10, .32], [1.8, 1]].forEach(([w, o]) =>
      el('path', { d: LOW.d, class: 'ld-edge-line', 'stroke-width': w, 'stroke-opacity': o, 'vector-effect': 'non-scaling-stroke' }, edge));
    // the star's waist: its outline must pass the farthest screen corner for the veil to be gone
    let waist = LOW.r;
    const probe = hole.firstChild, L = probe.getTotalLength();
    for (let i = 0; i <= 200; i++) { const p = probe.getPointAtLength((L * i) / 200); waist = Math.min(waist, Math.hypot(p.x - LOW.cx, p.y - LOW.cy)); }
    const size = (w, h) => { svg.setAttribute('viewBox', `0 0 ${w} ${h}`); for (const r of [white, night]) { r.setAttribute('width', w); r.setAttribute('height', h); } };
    const place = (sx, sy, k, open) => {
      const t = `translate(${sx} ${sy}) scale(${k}) translate(${-LOW.cx} ${-LOW.cy})`;
      edge.setAttribute('transform', t);
      hole.setAttribute('transform', open ? t : `translate(${sx} ${sy}) scale(0)`);
    };
    return { svg, size, place, fill, edge, waist };
  }

  /**
   * Plays the loader.
   *   root          .loader (contains .ld-bg, .ld-stage, .ld-word, .ld-skip)
   *   opts.slots()  { hand: DOMRect, words: DOMRect }: where the mark lands in the door
   *   opts.sfx      sound hooks; opts.tip(x, y, on) moves the glowing pen tip
   *   opts.onReveal(), opts.onLanded(), opts.onDone()
   */
  function playLoader(root, opts = {}) {
    const gsap = window.gsap;
    const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
    const bg = root.querySelector('.ld-bg'), stage = root.querySelector('.ld-stage'), wordEl = root.querySelector('.ld-word'), skip = root.querySelector('.ld-skip');
    const sfx = opts.sfx || {};
    const play = (name, a) => { try { sfx[name] && sfx[name](a); } catch {} };
    const tip = opts.tip || (() => {});

    const hand = buildHand({ cls: 'ld-hand' });
    stage.replaceChildren(hand.svg);
    const fx = addSnapHelpers(hand);
    const veil = buildVeil(bg);
    root.classList.add('is-ready');
    const words = buildWords({ cls: 'ld-words' });
    wordEl.replaceChildren(words.svg);
    const wordLens = words.strokes.map(p => p.getTotalLength());
    const penLens = Object.fromEntries(H.line.strokes.map(s => [s.id, hand.pens[s.id].getTotalLength()]));
    const lock = document.documentElement.style.overflow;
    document.documentElement.style.overflow = 'hidden';

    let finished = false, revealed = false, landed = false;
    const finish = () => {
      if (finished) return; finished = true;
      tip(0, 0, false); play('ink', 0);
      root.classList.add('is-done'); root.setAttribute('aria-hidden', 'true');
      document.documentElement.style.overflow = lock;
      removeEventListener('resize', layout);
      opts.onDone && opts.onDone();
    };
    const land = () => {
      if (landed) return; landed = true;
      stage.style.visibility = 'hidden'; wordEl.style.visibility = 'hidden';
      opts.onLanded && opts.onLanded();
    };

    prepSnap(gsap, hand, fx);
    gsap.set(hand.stars, { scale: 0, opacity: 0 });
    for (const id in hand.pens) gsap.set(hand.pens[id], { strokeDasharray: `${penLens[id]} ${penLens[id] + 40}`, strokeDashoffset: penLens[id] + 1 });
    words.strokes.forEach((p, i) => gsap.set(p, { strokeDasharray: `${wordLens[i]} ${wordLens[i] + 4}`, strokeDashoffset: wordLens[i] + 1, opacity: 0 }));
    gsap.set(veil.edge, { opacity: 0 });

    // a centred stack: the hand above, the wordmarks below
    const geo = { sx: 0, sy: 0, k: 1, sMax: 1, flying: false, open: false };
    const layout = () => {
      if (geo.flying) return;
      const vw = innerWidth, vh = innerHeight;
      veil.size(vw, vh);
      const ww = Math.min(vw * 0.5, 300), wh = (ww * words.box.h) / words.box.w;
      const gap = Math.max(18, vh * 0.035);
      const room = vh - 2 * Math.max(48, vh * 0.1) - wh - gap;
      const h = Math.max(120, Math.min(vh * 0.38, 360, room)), w = (h * HW) / HH;
      const top = (vh - (h + gap + wh)) / 2;
      Object.assign(wordEl.style, { left: `${(vw - ww) / 2}px`, top: `${top + h + gap}px`, width: `${ww}px`, height: `${wh}px` });
      const left = (vw - w) / 2;
      Object.assign(stage.style, { left: `${left}px`, top: `${top}px`, width: `${w}px`, height: `${h}px` });
      geo.k = h / HH; geo.left = left; geo.top = top;
      geo.sx = left + LOW.cx * geo.k; geo.sy = top + LOW.cy * geo.k;
      const dx = Math.max(geo.sx, vw - geo.sx), dy = Math.max(geo.sy, vh - geo.sy);
      geo.sMax = (Math.hypot(dx, dy) + 8) / (veil.waist * geo.k);
      veil.place(geo.sx, geo.sy, geo.k, geo.open);
    };
    layout();
    addEventListener('resize', layout, { passive: true });
    // the pen tip on screen, from a point in the hand's own space
    const handPt = (p) => ({ x: geo.left + p.x * geo.k, y: geo.top + p.y * geo.k });

    const tl = gsap.timeline({ paused: true, onComplete: finish });
    if (reduce) {
      for (const id in hand.pens) gsap.set(hand.pens[id], { strokeDashoffset: 0 });
      gsap.set(hand.stars, { scale: 1, opacity: 1 });
      gsap.set(words.strokes, { strokeDashoffset: 0, opacity: 1 });
      tl.to(root, { opacity: 0, duration: 0.6, delay: 0.6, onStart: () => opts.onReveal && opts.onReveal() });
      tl.add(land);
    } else {
      // ---- 1. the hand, one unhurried pen, lifted only where a hand would lift it
      const order = [['thumb', 0.15, 0.24], ['thumbtop', 0.42, 0.2], ['middle_a', 0.64, 0.13], ['middle_b', 0.77, 0.24], ['outer', 1.05, 1.05], ['pinky', 2.14, 0.24], ['ring', 2.4, 0.28], ['midtip', 2.7, 0.2]];
      tl.add(() => play('introDraw'), 0.15);
      for (const [id, at, dur] of order) {
        const p = hand.pens[id], L = penLens[id], pr = { f: 0 };
        tl.add(() => play('pen'), at);
        tl.to(pr, {
          f: 1, duration: dur, ease: 'power1.inOut',
          onUpdate() { p.style.strokeDashoffset = (L * (1 - pr.f)).toFixed(2); const q = p.getPointAtLength(L * pr.f); const s = handPt({ x: q.x + T0[0], y: q.y + T0[1] }); tip(s.x, s.y, true); play('ink', 0.75); },
        }, at);
      }
      // ---- 2. the wordmarks: تادا right to left, then TADA, paced by length
      let t = 3.05;
      const speed = 2600;   // units per second
      const wordPt = (p, len) => { const q = p.getPointAtLength(len), m = p.getScreenCTM(); return m ? { x: m.a * q.x + m.c * q.y + m.e, y: m.b * q.x + m.d * q.y + m.f } : null; };
      words.strokes.forEach((p, i) => {
        if (i === FA.p.length) t += 0.14;
        const L = wordLens[i], dur = Math.max(0.1, L / speed), pr = { f: 0 };
        tl.set(p, { opacity: 1 }, t);
        tl.add(() => play('pen'), t);
        tl.to(pr, { f: 1, duration: dur, ease: 'power1.inOut', onUpdate() { p.style.strokeDashoffset = (L * (1 - pr.f) + 1).toFixed(2); const s = wordPt(p, L * pr.f); if (s) tip(s.x, s.y, true); play('ink', 0.75); } }, t);
        t += dur + 0.045;
      });
      tl.add(() => { tip(0, 0, false); play('ink', 0); }, t);
      // the pen is done: the mark stands on its own outline
      tl.add(() => hand.unmask(), t);
      // ---- 3. a breath, then the snap
      const snap = addSnap(tl, hand, fx, t + 0.3);
      tl.add(() => play('snap'), snap.R);
      // ---- 4. the star opens: it swells once, then it is the growing star
      const O = snap.S + 0.45;
      const low = hand.low;
      tl.to(low, { scale: 1.45, duration: 0.3, ease: 'power2.inOut' }, O - 0.3);
      const grow = { u: 0 }, s0 = 1.45;
      tl.add(() => { geo.open = true; revealed = true; play('starOpen'); opts.onReveal && opts.onReveal(); }, O);
      tl.set(veil.edge, { opacity: 1 }, O);
      tl.set(low, { opacity: 0 }, O);
      tl.set(skip, { visibility: 'hidden', pointerEvents: 'none' }, O);
      tl.to(veil.fill, { opacity: 0, duration: 0.6, ease: 'power1.in' }, O + 0.15);
      tl.to(grow, { u: 1, duration: 1.7, ease: 'power1.in', onUpdate() { veil.place(geo.sx, geo.sy, geo.k * s0 * Math.pow(geo.sMax / s0, grow.u), true); } }, O);
      tl.to(veil.edge, { opacity: 0, duration: 0.3, ease: 'power1.in' }, O + 1.5);
      // ---- 5. the flight into the door. Not a transform: a scaled-down raster of the mark
      // drops its fine strokes, so the boxes shrink and the svg is drawn crisp every frame.
      const Fl = O + 0.7;
      const slots = () => (opts.slots ? opts.slots() : null);
      tl.to(stage, {
        left: () => slots().hand.left, top: () => slots().hand.top, width: () => slots().hand.width, height: () => slots().hand.height,
        duration: 1.15, ease: 'power3.inOut', onStart: () => { geo.flying = true; },
      }, Fl);
      tl.to(wordEl, {
        left: () => slots().words.left, top: () => slots().words.top, width: () => slots().words.width, height: () => slots().words.height,
        duration: 1.15, ease: 'power3.inOut', onComplete: land,
      }, Fl + 0.1);
      tl.set(low, { scale: 1 }, Fl + 0.4);
      tl.to(low, { opacity: 1, duration: 0.3, ease: 'none' }, Fl + 0.4);
      tl.add(() => play('land'), Fl + 1.2);
      tl.to({}, { duration: 0.3 });
    }

    if (skip) {
      gsap.set(skip, { opacity: 0 });
      tl.to(skip, { opacity: 1, duration: 0.5 }, 0.5);
      skip.addEventListener('click', () => {
        if (finished || revealed) return;
        revealed = true; tl.pause(); tip(0, 0, false); play('ink', 0);
        gsap.to(root, { opacity: 0, duration: 0.4, ease: 'power2.out', onStart: () => opts.onReveal && opts.onReveal(), onComplete: () => { land(); finish(); } });
      }, { once: true });
    }
    tl.play();
    return tl;
  }

  /** The loader plays once per browser session. */
  function shouldPlayLoader() {
    try { if (sessionStorage.getItem('tada.intro') === '1') return false; sessionStorage.setItem('tada.intro', '1'); return true; } catch { return true; }
  }

  window.TadaLoader = { buildHand, buildWords, addSnapHelpers, prepSnap, addSnap, playLoader, shouldPlayLoader, LOW, STARS, C, el };
})();
