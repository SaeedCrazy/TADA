// TADA loader
// ----------
// One pen draws the hand mark from its real centerline strokes and lands on the
// contact point; the same pen then writes the TADA logotype (fa, then en) below
// it. The hand winds up, snaps (70 ms release, 160 ms hold, elastic return to the
// exact kit geometry) and the three sparkles pop. Then the lowest sparkle itself
// opens: it grows, glowing, until its four points have swept the screen, and what
// it reveals is the page. The hand flies into its slot in the nav; the logotype
// stays where it was written and becomes the hero title, and the site's travelling
// line is born from the last stroke of that logotype (see main.js).
//
// Only transform, opacity and stroke-dashoffset are animated; the flight and the
// star mask are the two exceptions (box size and an SVG mask transform), each for
// a reason noted inline. No path is ever edited: groups move and return to
// identity, so the final frame is the kit mark. Nothing that is not drawing is
// ever painted: round caps on an undrawn dashed path render as dots, so every
// helper stroke is opacity 0 until it is used.
//
// Classic script (no modules) so the site also opens from the file system.
// Exposes window.TadaLoader.

(function () {
  'use strict';

  const NS = 'http://www.w3.org/2000/svg';
  const H = BRAND.hand;
  const W = BRAND.wordmark;
  const [VX, VY, VW, VH] = H.viewBox;           // 296 128 470 792
  const HAND_VIEWBOX = `${VX} ${VY} ${VW} ${VH}`;
  const WORD_VIEWBOX = `0 0 ${W.w} ${W.h}`;

  // Pivots, in the mark's coordinate space.
  const C = { x: 487.5, y: 404 };         // contact: middle fingertip on the thumb
  const K_MID = { x: 543, y: 496 };       // middle-finger joint (start of `ring`, on `middle`)
  const K_THUMB = { x: 396.5, y: 671.5 }; // thumb root (start of `thumb`)
  const K_WRIST = { x: 555, y: 890 };     // bottom of the fist
  const DRIP = { x: 555, y: 898.8 };      // lowest point of `outer`: where the ink drips from
  const LOW_STAR = H.stars.reduce((a, b) => (b.cy > a.cy ? b : a)); // the star that opens

  function el(name, attrs = {}, parent) {
    const n = document.createElementNS(NS, name);
    for (const k in attrs) n.setAttribute(k, attrs[k]);
    if (parent) parent.appendChild(n);
    return n;
  }

  /**
   * Builds a hand SVG from the stroke data. Used by the loader, the nav mark and
   * the footer, so the mark is always the same geometry.
   */
  function buildHandSvg({ className = '', strokeWidth = H.stroke } = {}) {
    const svg = el('svg', { viewBox: HAND_VIEWBOX, class: `tada-hand ${className}`.trim(), 'aria-hidden': 'true' });
    const g = el('g', { class: 'hand-root' }, svg);
    const byId = Object.fromEntries(H.strokes.map(s => [s.id, s]));

    const gThumb = el('g', { class: 'g-thumb' }, g);
    const gMid = el('g', { class: 'g-mid' }, g);
    const gRing = el('g', { class: 'g-ring' }, g);
    const gPinky = el('g', { class: 'g-pinky' }, g);
    const parentFor = { thumb: gThumb, thumbtop: gThumb, midtip: gMid, middle_a: gMid, ring: gRing, pinky: gPinky };

    const strokes = {};
    for (const s of H.strokes) {
      strokes[s.id] = el('path', { d: s.d, class: 'hand-stroke', 'data-id': s.id, 'stroke-width': strokeWidth }, parentFor[s.id] || g);
    }
    const gStars = el('g', { class: 'g-stars' }, g);
    const stars = H.stars.map(st => el('path', { d: st.d, class: 'hand-star' }, gStars));
    return { svg, root: g, strokes, stars, gThumb, gMid, gRing, gPinky, gStars, byId };
  }

  /**
   * Builds the stacked logotype (fa over en) as line strokes, from the kit's
   * centerline data. Used by the loader (written on) and by the hero/footer.
   * A letter with several subpaths is split into one path per subpath: browsers
   * restart the dash pattern at every subpath, so a dashed multi-subpath letter
   * would draw all its parts at once (and show a dot at each part's start).
   */
  function buildWordmarkSvg({ className = '', strokeWidth = W.stroke } = {}) {
    const svg = el('svg', { viewBox: WORD_VIEWBOX, class: `tada-word ${className}`.trim(), 'aria-hidden': 'true' });
    const g = el('g', { class: 'word-root' }, svg);
    const strokes = [];
    // Pen order inside a letter. The «A» ends on its right foot: the last point the
    // pen writes is the bottom corner of the logotype, where the Tada magic is born.
    const ORDER = { A: [0, 2, 3, 1] };
    for (const s of [...W.fa, ...W.en]) {
      const parts = s.d.split(/(?=M)/).map(d => d.trim()).filter(Boolean);
      (ORDER[s.id] || parts.map((_, i) => i)).forEach(i => {
        strokes.push(el('path', { d: parts[i], class: 'word-stroke', 'data-id': `${s.id}.${i}`, 'stroke-width': strokeWidth }, g));
      });
    }
    return { svg, root: g, strokes };
  }

  // Helper strokes for the snap, added to a built hand.
  function addSnapHelpers(hand) {
    const { root } = hand;
    // Smear: a ghost copy of the fingertip that trails the release by one frame.
    const smear = el('g', { class: 'g-smear ld-helper' }, root);
    smear.appendChild(hand.strokes.midtip.cloneNode(true));
    smear.appendChild(hand.strokes.middle_a.cloneNode(true));
    // Burst: five fan lines from the contact point toward the sparkles. The dash gap
    // is longer than the line and the offsets overshoot by 1, so no dash end (and no
    // round-cap dot) ever sits on the path while the line is idle.
    const burst = el('g', { class: 'g-burst ld-helper' }, root);
    const burstLines = [[-110, 34], [-85, 44], [-60, 52], [-35, 44], [-10, 34]].map(([a, len]) => {
      const r = (a * Math.PI) / 180, r0 = 24;
      return el('path', {
        d: `M${C.x + Math.cos(r) * r0} ${C.y + Math.sin(r) * r0} l${Math.cos(r) * len} ${Math.sin(r) * len}`,
        class: 'burst-line', 'stroke-dasharray': `${len} ${2 * len + 2}`, 'stroke-dashoffset': len + 1, 'data-len': len,
      }, burst);
    });
    return { smear, burst, burstLines };
  }

  // Sets the pivots and the hidden state of the helpers. Call once per built hand.
  function prepSnap(gsap, hand, helpers) {
    gsap.set(hand.gMid, { svgOrigin: `${K_MID.x} ${K_MID.y}` });
    gsap.set(helpers.smear, { svgOrigin: `${K_MID.x} ${K_MID.y}`, opacity: 0 });
    gsap.set(helpers.burst, { opacity: 0 });
    gsap.set(hand.gThumb, { svgOrigin: `${K_THUMB.x} ${K_THUMB.y}` });
    gsap.set(hand.gRing, { svgOrigin: '543 496' });
    gsap.set(hand.gPinky, { svgOrigin: '669 509' });
    gsap.set(hand.root, { svgOrigin: `${K_WRIST.x} ${K_WRIST.y}` });
    hand.stars.forEach((st, i) => gsap.set(st, { svgOrigin: `${H.stars[i].cx} ${H.stars[i].cy}` }));
  }

  /**
   * Adds the snap to a timeline at time A: wind-up, 70 ms release, hit (burst, wrist
   * jolt, sparkles popping nearest-first), 160 ms hold, elastic return to identity.
   * Shared by the loader and the footer hand. Returns the key times.
   */
  function addSnap(tl, hand, helpers, A, { stars = true } = {}) {
    const { gMid, gThumb, gRing, gPinky, root: handRoot } = hand;
    const { smear, burst, burstLines } = helpers;

    // Wind-up: fingertip presses the thumb, the thumb pushes back, the wrist drops and turns.
    tl.to(gMid, { rotation: 3.5, duration: 0.28, ease: 'power2.in' }, A);
    tl.to(gThumb, { rotation: 2.5, duration: 0.28, ease: 'power2.in' }, A);
    tl.to(handRoot, { rotation: -3, y: 7, duration: 0.28, ease: 'power2.in' }, A);
    tl.to([gRing, gPinky], { rotation: -1.5, duration: 0.28, ease: 'power2.in' }, A);

    // Release: 70 ms, four frames, linear. The fingertip slides off the thumb into
    // the palm (counter-clockwise on screen); the thumb kicks up and away.
    const R = A + 0.28;
    tl.set(smear, { opacity: 0.35, rotation: 3.5 }, R);
    tl.to(gMid, { rotation: -52, y: 8, duration: 0.07, ease: 'none' }, R);
    tl.to(smear, { rotation: -52, y: 8, duration: 0.07, ease: 'none' }, R + 0.035);
    tl.to(gThumb, { rotation: -14, duration: 0.07, ease: 'none' }, R);
    tl.to(handRoot, { rotation: 2, y: -4, duration: 0.12, ease: 'back.out(2)' }, R);

    // Hit: burst head-then-tail (painted only while it exists), wrist jolt, smear fades.
    const HIT = R + 0.07;
    tl.set(burst, { opacity: 1 }, HIT);
    tl.to(burstLines, { strokeDashoffset: 0, duration: 0.11, ease: 'none', stagger: 0.014 }, HIT);
    tl.to(burstLines, { strokeDashoffset: (i, e) => -(+e.dataset.len + 1), duration: 0.18, ease: 'power1.in', stagger: 0.014 }, HIT + 0.11);
    tl.set(burst, { opacity: 0 }, HIT + 0.36);
    tl.to(handRoot, { x: 3, duration: 0.033, ease: 'none' }, HIT)
      .to(handRoot, { x: -2, duration: 0.033, ease: 'none' }, HIT + 0.033)
      .to(handRoot, { x: 0, duration: 0.033, ease: 'none' }, HIT + 0.066);
    tl.to(smear, { opacity: 0, duration: 0.12, ease: 'none' }, HIT);
    if (stars) {
      [2, 1, 0].forEach((i, k) => {
        const at = HIT + 0.04 + k * 0.08;
        tl.to(hand.stars[i], { opacity: 1, duration: 0.08, ease: 'none' }, at);
        tl.fromTo(hand.stars[i], { scale: 0, rotation: -20 }, { scale: 1, rotation: 0, duration: 0.3, ease: 'back.out(3)' }, at);
      });
    }

    // Hold the open pose (160 ms), then re-cock: everything returns to identity with
    // one damped bounce; the loose fingers settle last.
    const S = HIT + 0.16;
    tl.to(gMid, { rotation: 0, y: 0, duration: 0.55, ease: 'elastic.out(1, 0.55)' }, S);
    tl.to(gThumb, { rotation: 0, duration: 0.55, ease: 'elastic.out(1, 0.55)' }, S);
    tl.to(handRoot, { rotation: 0, y: 0, duration: 0.55, ease: 'elastic.out(1, 0.55)' }, S);
    tl.to(gRing, { rotation: 2.5, duration: 0.1, ease: 'power1.out' }, S + 0.04).to(gRing, { rotation: 0, duration: 0.45, ease: 'elastic.out(1, 0.55)' }, S + 0.14);
    tl.to(gPinky, { rotation: 4, duration: 0.1, ease: 'power1.out' }, S + 0.08).to(gPinky, { rotation: 0, duration: 0.45, ease: 'elastic.out(1, 0.55)' }, S + 0.18);
    return { R, HIT, S, END: S + 0.55 };
  }

  // The night surface with a star-shaped hole, all SVG so the mask is a real path.
  // The hole and the glowing star share one transform: the star's own geometry,
  // scaled about its centre. The glow is a radial gradient inside the star (lilac at
  // the rim, clear at the heart) plus four stroke bands of fixed px width.
  function buildVeil(bgEl) {
    bgEl.replaceChildren();
    const uid = Math.floor(Math.random() * 1e9).toString(36);
    const svg = el('svg', { class: 'ld-veil', preserveAspectRatio: 'none', 'aria-hidden': 'true' }, bgEl);
    const defs = el('defs', {}, svg);
    const mask = el('mask', { id: `ld-mask-${uid}`, maskUnits: 'userSpaceOnUse' }, defs);
    const white = el('rect', { fill: '#fff' }, mask);
    const hole = el('g', {}, mask);
    el('path', { d: LOW_STAR.d, fill: '#000' }, hole);
    const grad = el('radialGradient', { id: `ld-glow-${uid}`, cx: '50%', cy: '50%', r: '50%' }, defs);
    el('stop', { offset: '0', 'stop-color': '#C9B3CF', 'stop-opacity': '0' }, grad);
    el('stop', { offset: '0.62', 'stop-color': '#C9B3CF', 'stop-opacity': '0.05' }, grad);
    el('stop', { offset: '1', 'stop-color': '#C9B3CF', 'stop-opacity': '0.45' }, grad);
    const night = el('rect', { class: 'ld-night', mask: `url(#ld-mask-${uid})` }, svg);
    const edge = el('g', { class: 'ld-edge' }, svg);
    const fill = el('path', { d: LOW_STAR.d, class: 'ld-edge-fill' }, edge);
    el('path', { d: LOW_STAR.d, class: 'ld-edge-glow', fill: `url(#ld-glow-${uid})` }, edge);
    [[54, .06], [26, .14], [10, .32], [1.8, 1]].forEach(([w, o]) =>
      el('path', { d: LOW_STAR.d, class: 'ld-edge-line', 'stroke-width': w, 'stroke-opacity': o, 'vector-effect': 'non-scaling-stroke' }, edge));
    // The star's waist: the closest its outline comes to its centre. It must pass
    // the farthest screen corner for the veil to be gone.
    let waist = LOW_STAR.r;
    const probe = hole.firstChild, L = probe.getTotalLength();
    for (let i = 0; i <= 200; i++) {
      const p = probe.getPointAtLength((L * i) / 200);
      waist = Math.min(waist, Math.hypot(p.x - LOW_STAR.cx, p.y - LOW_STAR.cy));
    }
    const size = (w, h) => {
      svg.setAttribute('viewBox', `0 0 ${w} ${h}`);
      for (const r of [white, night]) { r.setAttribute('width', w); r.setAttribute('height', h); }
    };
    const place = (sx, sy, k, open) => { // star centre in px, k = px per mark unit
      const t = `translate(${sx} ${sy}) scale(${k}) translate(${-LOW_STAR.cx} ${-LOW_STAR.cy})`;
      edge.setAttribute('transform', t);
      hole.setAttribute('transform', open ? t : `translate(${sx} ${sy}) scale(0)`); // no hole until the star opens
    };
    return { svg, size, place, fill, edge, waist };
  }

  /**
   * Plays the loader.
   * root            .loader element (contains .ld-bg, .ld-stage, .ld-word, .ld-skip)
   * opts.gsap       gsap instance
   * opts.navMark    element the hand flies to (the mark slot in the nav); optional.
   *                 On landing the very same SVG node is moved into it: no swap, no jump.
   * opts.wordSlot   element the logotype is written over (the hero title slot); optional.
   *                 The logotype is drawn exactly on it and moved into it on reveal.
     * opts.onReveal() called when the star starts opening
   * opts.onLanded() called the instant the hand is inside the nav slot
   * opts.sfx       optional sound hooks: introDraw, pen, snap, starOpen, land
   * opts.onDone()   called when the loader is gone
   * Returns the timeline (with tl.destroy()).
   */
  function playLoader(root, opts = {}) {
    const gsap = opts.gsap || window.gsap;
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const bg = root.querySelector('.ld-bg');
    const stage = root.querySelector('.ld-stage');
    const wordEl = root.querySelector('.ld-word');
    const skip = root.querySelector('.ld-skip');
    const navMark = opts.navMark || null;
    const wordSlot = opts.wordSlot || null;
    const sfx = opts.sfx || {};
    const play = name => { try { sfx[name] && sfx[name](); } catch {} };

    const P = buildHandSvg({ className: 'ld-hand' });
    stage.replaceChildren(P.svg);
    const FX = addSnapHelpers(P);
    const { strokes, stars, gThumb, gMid, gRing, gPinky, byId, root: handRoot } = P;
    const veil = buildVeil(bg);
    root.classList.add('is-ready');
    const word = buildWordmarkSvg({ className: 'ld-wordmark' });
    wordEl.replaceChildren(word.svg);
    const wordLens = word.strokes.map(p => p.getTotalLength());
    const scrollLock = document.documentElement.style.overflow;
    document.documentElement.style.overflow = 'hidden';

    let finished = false, revealed = false;
    const finish = () => {
      if (finished) return;
      finished = true;
      root.classList.add('is-done');
      root.setAttribute('aria-hidden', 'true');
      document.documentElement.style.overflow = scrollLock;
      removeEventListener('resize', layout);
      opts.onDone && opts.onDone();
    };

    // Moves the loader's hand into the nav slot and the logotype into the hero slot
    // as they are. Same nodes, same geometry.
    let landed = false;
    const land = () => {
      if (landed) return;
      landed = true;
      if (navMark) {
        FX.smear.remove(); FX.burst.remove();
        P.svg.classList.remove('ld-hand');
        gsap.set([handRoot, gThumb, gMid, gRing, gPinky, ...stars, ...Object.values(strokes)], { clearProps: 'all' });
        for (const id in strokes) strokes[id].removeAttribute('style');
        navMark.replaceChildren(P.svg);
        stage.style.visibility = 'hidden';
      }
      if (wordSlot) {
        word.svg.classList.remove('ld-wordmark');
        gsap.set(word.strokes, { clearProps: 'all' });
        word.strokes.forEach(p => p.removeAttribute('style'));
        wordSlot.replaceChildren(word.svg);
        wordEl.style.visibility = 'hidden';
      }
      opts.onLanded && opts.onLanded();
    };

    // --- initial state
    prepSnap(gsap, P, FX);
    gsap.set(stars, { scale: 0, opacity: 0 });
    for (const id in strokes) gsap.set(strokes[id], { strokeDasharray: byId[id].len, strokeDashoffset: byId[id].len, opacity: 0 });
    word.strokes.forEach((p, i) => gsap.set(p, { strokeDasharray: wordLens[i], strokeDashoffset: wordLens[i], opacity: 0 }));
    gsap.set(veil.edge, { opacity: 0 });

    // --- layout (px). A centred stack: the hand above, the logotype below. Both fly to
    // their slots at the end. Re-done on resize until the flight starts.
    const geo = { sx: 0, sy: 0, k: 1, sMax: 1, flying: false, open: false };
    const layout = () => {
      if (geo.flying) return;
      const vw = innerWidth, vh = innerHeight;
      veil.size(vw, vh);
      const ww = Math.min(vw * 0.62, 520), wh = (ww * W.h) / W.w;
      const gap = Math.max(20, vh * 0.04);
      const room = vh - 2 * Math.max(48, vh * 0.08) - wh - gap;
      const h = Math.max(120, Math.min(vh * 0.4, 400, room));
      const w = (h * VW) / VH;
      const top = (vh - (h + gap + wh)) / 2;
      const wordRect = { left: (vw - ww) / 2, top: top + h + gap, width: ww, height: wh };
      Object.assign(wordEl.style, { left: `${wordRect.left}px`, top: `${wordRect.top}px`, width: `${wordRect.width}px`, height: `${wordRect.height}px` });
      const left = (vw - w) / 2;
      Object.assign(stage.style, { left: `${left}px`, top: `${top}px`, width: `${w}px`, height: `${h}px` });
      geo.k = h / VH;
      geo.sx = left + (LOW_STAR.cx - VX) * geo.k;
      geo.sy = top + (LOW_STAR.cy - VY) * geo.k;
      const dx = Math.max(geo.sx, vw - geo.sx), dy = Math.max(geo.sy, vh - geo.sy);
      geo.sMax = (Math.hypot(dx, dy) + 8) / (veil.waist * geo.k);
      veil.place(geo.sx, geo.sy, geo.k, geo.open);
    };
    layout();
    addEventListener('resize', layout, { passive: true });

    const tl = gsap.timeline({ paused: true, onComplete: finish });

    if (reduce) {
      for (const id in strokes) gsap.set(strokes[id], { strokeDashoffset: 0, opacity: 1 });
      gsap.set(stars, { scale: 1, opacity: 1 });
      gsap.set(word.strokes, { strokeDashoffset: 0, opacity: 1 });
      tl.to(root, { opacity: 0, duration: 0.6, delay: 0.8, onStart: () => opts.onReveal && opts.onReveal() });
      tl.add(land);
    } else {
      // ---- 1. Draw-on (0 → 2.7 s). One unhurried pen, lifted only where a hand would
      // lift it, ending on the contact point.
      const pen = [
        ['thumb', 0.15, 0.22, 'power1.inOut'],
        ['thumbtop', 0.40, 0.18, 'power1.inOut'],
        ['middle_a', 0.59, 0.11, 'power1.in'],
        ['middle_b', 0.70, 0.22, 'power1.inOut'],
        ['outer', 0.98, 0.98, 'power1.inOut'],
        ['pinky', 2.00, 0.22, 'power1.inOut'],
        ['ring', 2.25, 0.26, 'power1.inOut'],
        ['midtip', 2.52, 0.18, 'power2.out'],
      ];
      tl.add(() => play('introDraw'), 0.15);
      for (const [id, at, dur, ease] of pen) {
        tl.set(strokes[id], { opacity: 1 }, at);
        tl.add(() => play('pen'), at);
        tl.to(strokes[id], { strokeDashoffset: 0, duration: dur, ease }, at);
      }

      // ---- 2. The logotype (2.9 → ~5.3 s): the same pen writes تادا right-to-left,
      // then TADA left-to-right. Paced by length, so every letter moves at one speed.
      let t = 2.9;
      const speed = 3200; // units per second
      word.strokes.forEach((p, i) => {
        if (p.dataset.id === 'T.0') t += 0.12; // lift between the two lines
        const dur = Math.max(0.12, wordLens[i] / speed);
        tl.set(p, { opacity: 1 }, t);
        tl.add(() => play('pen'), t);
        tl.to(p, { strokeDashoffset: 0, duration: dur, ease: 'power1.inOut' }, t);
        t += dur + 0.05;
      });

      // ---- 3. A breath, then the snap.
      const snap = addSnap(tl, P, FX, t + 0.3);
      tl.add(() => play('snap'), snap.R);

      // ---- 4. The star opens. The lowest sparkle swells once, then it *is* the
      // growing star: it leaves the mark glowing, loses its fill and grows (exponentially,
      // since perceived size is logarithmic) until its points pass the screen corners.
      const O = snap.S + 0.45;
      const low = stars[H.stars.indexOf(LOW_STAR)];
      tl.to(low, { scale: 1.45, duration: 0.3, ease: 'power2.inOut' }, O - 0.3);
      const grow = { u: 0 }, s0 = 1.45;
      tl.add(() => { geo.open = true; revealed = true; play('starOpen'); opts.onReveal && opts.onReveal(); }, O);
      tl.set(veil.edge, { opacity: 1 }, O);
      tl.set(low, { opacity: 0 }, O);
      tl.set(skip, { visibility: 'hidden', pointerEvents: 'none' }, O);
      tl.to(veil.fill, { opacity: 0, duration: 0.6, ease: 'power1.in' }, O + 0.15);
      tl.to(grow, {
        u: 1, duration: 1.7, ease: 'power1.in',
        onUpdate() { veil.place(geo.sx, geo.sy, geo.k * s0 * Math.pow(geo.sMax / s0, grow.u), true); },
      }, O);
      tl.to(veil.edge, { opacity: 0, duration: 0.3, ease: 'power1.in' }, O + 1.5);

      if (navMark) {
        // ---- 5. The flight. Not a transform: a scaled-down raster of the hand drops its
        // thin strokes (texture minification), so the box itself shrinks and the SVG is
        // re-rendered crisp every frame. One absolutely positioned element: cheap.
        const F = O + 0.7;
        const navRect = () => navMark.getBoundingClientRect();
        tl.to(stage, {
          left: () => navRect().left, top: () => navRect().top, width: () => navRect().width, height: () => navRect().height,
          duration: 1.1, ease: 'power3.inOut', onStart: () => { geo.flying = true; }, onComplete: land,
        }, F);
        if (wordSlot) {
          // the logotype takes its place in the hero the same way, a breath later
          const slotRect = () => wordSlot.getBoundingClientRect();
          tl.to(wordEl, {
            left: () => slotRect().left, top: () => slotRect().top, width: () => slotRect().width, height: () => slotRect().height,
            duration: 1.1, ease: 'power3.inOut',
          }, F + 0.1);
        }
        tl.set(low, { scale: 1 }, F + 0.4);
        tl.to(low, { opacity: 1, duration: 0.3, ease: 'none' }, F + 0.4); // the mark is whole again before it lands
        tl.add(() => play('land'), F + 1.1);
        tl.to({}, { duration: 0.35 }); // a breath after landing, then the page is yours
      } else {
        tl.to(stage, { opacity: 0, duration: 0.5, ease: 'power2.in' }, O + 0.9);
        tl.add(land, O + 1.7);
      }
    }

    if (skip) {
      gsap.set(skip, { opacity: 0 });
      tl.to(skip, { opacity: 1, duration: 0.5 }, 0.5);
      skip.addEventListener('click', () => {
        if (finished || revealed) return;
        revealed = true;
        tl.pause();
        gsap.to(root, { opacity: 0, duration: 0.4, ease: 'power2.out', onStart: () => opts.onReveal && opts.onReveal(), onComplete: () => { land(); finish(); } });
      }, { once: true });
    }

    tl.destroy = () => { tl.kill(); finished = true; document.documentElement.style.overflow = scrollLock; removeEventListener('resize', layout); };
    opts.onTimeline && opts.onTimeline(tl);
    if (opts.autoplay !== false) tl.play();
    return tl;
  }

  /** Play once per browser session. */
  function shouldPlayLoader() {
    try {
      if (sessionStorage.getItem('tada.intro') === '1') return false;
      sessionStorage.setItem('tada.intro', '1');
      return true;
    } catch { return true; }
  }

  window.TadaLoader = { buildHandSvg, buildWordmarkSvg, addSnapHelpers, prepSnap, addSnap, playLoader, shouldPlayLoader, HAND: H, HAND_VIEWBOX, DRIP, el };
})();
