// TADA sound
// ----------
// A small Web Audio synthesiser: no audio files, nothing to download. Reverse-
// engineered from the reference app's sound module (see REVERSE-ENGINEERING.md):
// one AudioContext → master gain → compressor → destination, a generated-noise
// convolver for reverb, a white-noise buffer for swept "air", tone/noise helpers
// with exponential envelopes, a per-sound throttle and a pentatonic scale. The
// presets are TADA's own: the snap, the sparkles, the star opening, the ink.
//
// Browsers only let audio start after a user gesture: the engine is created on
// the first pointer/key event (or when the user turns sound on). Until then every
// call is a silent no-op. Preference is remembered in localStorage ('tada.sound').
//
// Some browsers let a site sound before any gesture (the visitor allowed it, or has
// played here before): probe() asks quietly, and the entrance plays from the start
// when the answer is yes. iOS only opens audio inside touchend or click, so those
// unlock too.
//
// Exposes window.TadaSound = { enabled(), setEnabled(v), toggle(), unlock(), probe(), sfx, bind() }.

(function () {
  'use strict';

  const KEY = 'tada.sound';
  let wanted = true;
  try { wanted = localStorage.getItem(KEY) !== 'off'; } catch {}
  const listeners = new Set();

  let ctx = null, master = null, verb = null, noise = null;

  // Exponentially decaying stereo noise: a small room without a sample.
  function impulse(c, seconds, decay) {
    const n = Math.floor(c.sampleRate * seconds), buf = c.createBuffer(2, n, c.sampleRate);
    for (let ch = 0; ch < 2; ch++) {
      const d = buf.getChannelData(ch);
      for (let i = 0; i < n; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / n, decay);
    }
    return buf;
  }

  let gestured = false;   // browsers refuse audio before the first user gesture
  function engine() {
    if (!wanted || !gestured) return null;
    if (!ctx) {
      if (typeof AudioContext === 'undefined') return null;
      ctx = new AudioContext();
      const comp = ctx.createDynamicsCompressor();
      comp.threshold.value = -16; comp.ratio.value = 5;
      ctx.addEventListener('statechange', () => heardNow());
      comp.connect(ctx.destination);
      master = ctx.createGain(); master.gain.value = 0.9; master.connect(comp);
      const conv = ctx.createConvolver(); conv.buffer = impulse(ctx, 1.8, 3);
      verb = ctx.createGain(); verb.gain.value = 0.22; verb.connect(conv).connect(master);
      noise = ctx.createBuffer(1, ctx.sampleRate * 2, ctx.sampleRate);
      const d = noise.getChannelData(0);
      for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
    }
    if (ctx.state === 'suspended') ctx.resume().then(heardNow, () => {});
    return ctx;
  }

  function out(c, node, reverb, pan) {
    let n = node;
    if (pan) { const p = c.createStereoPanner(); p.pan.value = pan; n.connect(p); n = p; }
    n.connect(master);
    if (reverb) n.connect(verb);
  }

  // A tone with an exponential attack/decay envelope, optional pitch slide.
  function tone(freq, dur, o = {}) {
    const c = engine(); if (!c) return;
    const { type = 'sine', gain = 0.05, attack = 0.004, slideTo, delay = 0, reverb = false, pan = 0 } = o;
    const t = c.currentTime + delay;
    const osc = c.createOscillator(), g = c.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, t);
    if (slideTo) osc.frequency.exponentialRampToValueAtTime(slideTo, t + dur);
    g.gain.setValueAtTime(1e-4, t);
    g.gain.exponentialRampToValueAtTime(gain, t + attack);
    g.gain.exponentialRampToValueAtTime(1e-4, t + dur);
    osc.connect(g); out(c, g, reverb, pan);
    osc.start(t); osc.stop(t + dur + 0.05);
  }

  // Filtered noise with a sweeping centre frequency: air, cracks, whooshes.
  function air(dur, o = {}) {
    const c = engine(); if (!c || !noise) return;
    const { gain = 0.04, from = 800, to = 3000, q = 0.8, delay = 0, reverb = false, filter = 'bandpass' } = o;
    const t = c.currentTime + delay;
    const src = c.createBufferSource(); src.buffer = noise;
    const f = c.createBiquadFilter(); f.type = filter; f.Q.value = q;
    f.frequency.setValueAtTime(from, t);
    f.frequency.exponentialRampToValueAtTime(to, t + dur);
    const g = c.createGain();
    g.gain.setValueAtTime(1e-4, t);
    g.gain.exponentialRampToValueAtTime(gain, t + Math.max(0.005, dur * 0.25));
    g.gain.exponentialRampToValueAtTime(1e-4, t + dur);
    src.connect(f).connect(g); out(c, g, reverb, 0);
    src.start(t, Math.random()); src.stop(t + dur + 0.05);
  }

  const last = new Map();
  const every = (key, ms) => { const n = performance.now(); if (n - (last.get(key) ?? -Infinity) < ms) return false; last.set(key, n); return true; };
  const note = n => 523.25 * Math.pow(2, n / 12);           // C5 + semitones
  const PENTA = [0, 2, 4, 7, 9];

  // Tiny high blips with random pan: the sparkle.
  function sparkles(delay = 0, count = 3, gain = 0.008) {
    for (let i = 0; i < count; i++) tone(2800 + Math.random() * 2600, 0.09, { gain, delay: delay + Math.random() * 0.07, reverb: true, pan: Math.random() * 1.2 - 0.6 });
  }
  function arp(notes, { gap = 0.07, gain = 0.04, type = 'triangle' } = {}) {
    notes.forEach((n, i) => tone(note(n), 0.35, { type, gain, delay: i * gap, reverb: true }));
  }

  const sfx = {
    // UI
    hover() { if (every('hover', 45)) tone(2300 + Math.random() * 200, 0.03, { gain: 0.007 }); },
    tap() { if (every('tap', 30)) { tone(1400, 0.045, { type: 'triangle', gain: 0.03, slideTo: 950 }); air(0.02, { gain: 0.01, from: 5000, to: 4000 }); } },
    nav() { tone(880, 0.07, { gain: 0.028, reverb: true }); tone(1318.5, 0.09, { gain: 0.022, delay: 0.035, reverb: true }); },
    toggle() { tone(1200, 0.03, { type: 'triangle', gain: 0.03 }); tone(1800, 0.035, { type: 'triangle', gain: 0.025, delay: 0.035 }); },
    enable() { arp([7, 12], { gap: 0.08, gain: 0.035, type: 'sine' }); },
    // Brand moments
    introDraw() { air(1.1, { gain: 0.01, from: 4000, to: 8000, reverb: true }); tone(220, 1.2, { gain: 0.025, slideTo: 440, attack: 0.3, reverb: true }); },
    pen() { if (every('pen', 90)) air(0.08, { gain: 0.006, from: 3000 + Math.random() * 1500, to: 6000, q: 1.2 }); },
    snap() {
      tone(120, 0.2, { gain: 0.14, slideTo: 55 });                        // the thump of the palm
      air(0.07, { gain: 0.07, from: 2600, to: 700, q: 0.5 });              // the crack
      tone(3200, 0.03, { type: 'triangle', gain: 0.02 });                  // the click
      sparkles(0.1, 4, 0.01);
    },
    starOpen() {
      air(0.9, { gain: 0.045, from: 400, to: 3200, reverb: true });        // the star sweeps out
      tone(note(0), 1.1, { gain: 0.03, slideTo: note(12), attack: 0.25, reverb: true });
      arp([0, 7, 12, 16], { gap: 0.09, gain: 0.03 });
      sparkles(0.35, 5, 0.009);
    },
    land() { tone(988, 0.3, { type: 'triangle', gain: 0.035, reverb: true }); tone(1245, 0.45, { type: 'triangle', gain: 0.03, delay: 0.09, reverb: true }); },
    chapter() { if (every('chapter', 300)) tone(1046.5, 0.14, { gain: 0.022, reverb: true }); },
    tada() { arp([0, 4, 7, 12], { gap: 0.07, gain: 0.035 }); sparkles(0.25, 4); },
    tile(i) { if (every('tile', 40)) tone(note(PENTA[i % 5] + 12 * Math.floor(i / 5)), 0.3, { gain: 0.026, reverb: true }); },
    bubble() { if (every('bubble', 60)) tone(600 + Math.random() * 300, 0.07, { gain: 0.022, slideTo: 1100 + Math.random() * 300 }); },
    // The entrance: a soft note for each stretch of the filling light, then the door opens
    gateNote(i) {
      tone(note(PENTA[i % 5]), 1.1, { gain: 0.018, attack: 0.05, reverb: true });
      tone(note(PENTA[i % 5] + 12), 0.8, { gain: 0.006, attack: 0.08, delay: 0.04, reverb: true });
      sparkles(0.08, 1, 0.005);
    },
    welcome() {
      arp([0, 7, 12], { gap: 0.1, gain: 0.022, type: 'sine' });
      sparkles(0.22, 3, 0.006);
    },
    gateOpen() {
      air(1.3, { gain: 0.028, from: 500, to: 4200, reverb: true });
      arp([0, 7, 12, 19], { gap: 0.12, gain: 0.026, type: 'sine' });
      sparkles(0.45, 4, 0.007);
    },
  };

  function setEnabled(v) {
    wanted = !!v; gestured = true;   // toggling is itself a gesture
    try { localStorage.setItem(KEY, wanted ? 'on' : 'off'); } catch {}
    if (wanted) { engine(); sfx.enable(); } else if (ctx && ctx.state === 'running') ctx.suspend();
    listeners.forEach(fn => fn(wanted));
  }
  const unlock = () => { gestured = true; if (wanted) engine(); };
  // call fn once, the first moment sound can actually be heard
  const firstSound = [];
  function onFirstSound(fn) {
    if (ctx && ctx.state === 'running') return;          // already heard: nothing to greet
    firstSound.push(fn);
  }
  function heardNow() {
    if (!ctx || ctx.state !== 'running' || !firstSound.length) return;
    const fns = firstSound.splice(0); setTimeout(() => fns.forEach(f => f()), 60);
  }
  // Ask, without a gesture, whether this browser already lets the site sound.
  function probe() {
    if (!wanted || typeof AudioContext === 'undefined') return Promise.resolve(false);
    if (matchMedia('(pointer: coarse)').matches && !gestured) return Promise.resolve(false);   // phones and tablets never allow it
    if (gestured && ctx && ctx.state === 'running') return Promise.resolve(true);
    const was = gestured; gestured = true;
    const c = engine(); gestured = was;
    if (!c) return Promise.resolve(false);
    return new Promise(r => setTimeout(() => { const ok = c.state === 'running'; if (ok) gestured = true; r(ok); }, 90));
  }

  // Global bindings: hover/tap on interactive elements, like the reference.
  const SEL = 'button, a[href], [role="button"], summary';
  let hovered = null;
  function bind() {
    document.addEventListener('pointerover', e => {
      if (e.pointerType !== 'mouse') return;
      const t = e.target.closest ? e.target.closest(SEL) : null;
      if (t === hovered) return;
      hovered = t;
      if (t && !t.matches(':disabled') && t.dataset.sfx !== 'none') sfx.hover();
    }, { passive: true });
    document.addEventListener('pointerdown', e => {
      if (e.button > 0) return;
      unlock();
      const t = e.target.closest ? e.target.closest(SEL) : null;
      if (!t || t.matches(':disabled')) return;
      const k = t.dataset.sfx;
      if (k === 'none') return;
      if (k && sfx[k]) return sfx[k]();
      (t.closest('.nav-links') ? sfx.nav : sfx.tap)();
    }, { passive: true });
    document.addEventListener('keydown', unlock, { passive: true, once: true });
    document.addEventListener('touchend', unlock, { passive: true });   // iOS opens audio here
    document.addEventListener('click', unlock, { passive: true });
  }

  window.TadaSound = { enabled: () => wanted, setEnabled, toggle: () => setEnabled(!wanted), unlock, probe, onFirstSound, sfx, bind, onChange: fn => listeners.add(fn) };
})();
