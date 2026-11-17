/* =========================================================
   Звуки, синтезовані через Web Audio API (без аудіофайлів):
   тріскіт барабана, «клац» при зупинці, напруга перед рідкісним
   номером і мелодія виграшу для кожної рідкості.
   ========================================================= */
(function (global) {
  'use strict';

  const LS_KEY = 'uaplates_sound';
  let enabled = true;
  try { enabled = global.localStorage.getItem(LS_KEY) !== 'off'; } catch (e) {}

  let ctx = null, master = null, noiseBuf = null;
  let spinTimer = null, spinRemaining = 0;
  let riser = null;

  function unlock() {
    if (!ctx) {
      const AC = global.AudioContext || global.webkitAudioContext;
      if (!AC) return;
      ctx = new AC();
      master = ctx.createGain();
      master.gain.value = 0.55;
      const comp = ctx.createDynamicsCompressor();
      comp.threshold.value = -14; comp.ratio.value = 4;
      master.connect(comp).connect(ctx.destination);
      noiseBuf = ctx.createBuffer(1, ctx.sampleRate * 0.5, ctx.sampleRate);
      const d = noiseBuf.getChannelData(0);
      for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
    }
    if (ctx.state === 'suspended') ctx.resume();
  }
  const ready = () => enabled && ctx && ctx.state !== 'closed';
  const now = () => ctx.currentTime;

  // ---------- Базові «інструменти» ----------
  function tone(freq, t, dur, { type = 'sine', vol = 0.3, attack = 0.005, slideTo = null, filter = null, dest = master } = {}) {
    const o = ctx.createOscillator();
    const g = ctx.createGain();
    o.type = type;
    o.frequency.setValueAtTime(freq, t);
    if (slideTo) o.frequency.exponentialRampToValueAtTime(slideTo, t + dur);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(vol, t + attack);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    let node = o;
    if (filter) {
      const f = ctx.createBiquadFilter();
      f.type = 'lowpass'; f.frequency.value = filter; f.Q.value = 1;
      o.connect(f); node = f;
    }
    node.connect(g).connect(dest);
    o.start(t); o.stop(t + dur + 0.05);
  }
  function noise(t, dur, { vol = 0.2, freq = 3000, q = 1, type = 'bandpass' } = {}) {
    const s = ctx.createBufferSource();
    s.buffer = noiseBuf;
    const f = ctx.createBiquadFilter();
    f.type = type; f.frequency.value = freq; f.Q.value = q;
    const g = ctx.createGain();
    g.gain.setValueAtTime(vol, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    s.connect(f).connect(g).connect(master);
    s.start(t, Math.random() * 0.3); s.stop(t + dur + 0.02);
  }
  // Ноти: 0 = C5
  const N = (semi) => 523.25 * Math.pow(2, semi / 12);

  // ---------- Барабан ----------
  function tick() {
    if (!ready()) return;
    const t = now();
    noise(t, 0.025, { vol: 0.22, freq: 2600 + Math.random() * 800, q: 3 });
    tone(1900 + Math.random() * 200, t, 0.02, { type: 'square', vol: 0.025 });
  }
  function startSpin(reels) {
    stopSpin();
    spinRemaining = reels;
    const loop = () => {
      if (spinRemaining <= 0) return;
      tick();
      // що менше барабанів крутиться, то рідше тріскіт
      const interval = 38 + (8 - spinRemaining) * 14 + Math.random() * 10;
      spinTimer = setTimeout(loop, interval);
    };
    loop();
  }
  function stopSpin() { clearTimeout(spinTimer); spinTimer = null; spinRemaining = 0; }

  function land(isLast) {
    if (spinRemaining > 0) spinRemaining--;
    if (!ready()) return;
    const t = now();
    tone(isLast ? 150 : 190, t, 0.14, { type: 'sine', vol: isLast ? 0.5 : 0.35, slideTo: 60 });
    noise(t, 0.05, { vol: 0.3, freq: 1400, q: 1.5 });
    tone(isLast ? 880 : 1320, t, 0.06, { type: 'triangle', vol: 0.06 });
  }

  // ---------- Напруга перед рідкісним номером ----------
  function suspense() {
    if (!ready()) return;
    stopSuspense();
    const t = now();
    const o = ctx.createOscillator(), o2 = ctx.createOscillator();
    const f = ctx.createBiquadFilter(), g = ctx.createGain();
    o.type = 'sawtooth'; o2.type = 'sawtooth';
    o.frequency.setValueAtTime(110, t); o.frequency.exponentialRampToValueAtTime(440, t + 3);
    o2.frequency.setValueAtTime(111.5, t); o2.frequency.exponentialRampToValueAtTime(446, t + 3);
    f.type = 'lowpass'; f.Q.value = 6;
    f.frequency.setValueAtTime(300, t); f.frequency.exponentialRampToValueAtTime(3500, t + 3);
    g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(0.12, t + 0.6);
    o.connect(f); o2.connect(f); f.connect(g).connect(master);
    o.start(t); o2.start(t);
    riser = { o, o2, g };
  }
  function stopSuspense() {
    if (!riser || !ctx) return;
    const t = now();
    riser.g.gain.cancelScheduledValues(t);
    riser.g.gain.setValueAtTime(riser.g.gain.value, t);
    riser.g.gain.exponentialRampToValueAtTime(0.0001, t + 0.12);
    riser.o.stop(t + 0.15); riser.o2.stop(t + 0.15);
    riser = null;
  }

  // ---------- Мелодії виграшу ----------
  function sparkle(t, count, spread) {
    const pent = [0, 2, 4, 7, 9, 12, 14, 16, 19, 21, 24];
    for (let i = 0; i < count; i++) {
      const st = t + Math.random() * spread;
      tone(N(pent[(Math.random() * pent.length) | 0] + 12), st, 0.25, { type: 'sine', vol: 0.05 });
    }
  }
  function chord(t, semis, dur, vol, type = 'triangle', filter = null) {
    semis.forEach(s => tone(N(s), t, dur, { type, vol, attack: 0.02, filter }));
  }
  function boom(t) {
    tone(90, t, 0.9, { type: 'sine', vol: 0.6, slideTo: 35 });
    noise(t, 0.4, { vol: 0.25, freq: 400, q: 0.7, type: 'lowpass' });
  }

  function win(tierIndex) {
    stopSuspense();
    if (!ready()) return;
    const t = now() + 0.02;
    switch (tierIndex) {
      case 0: // Common
        tone(N(0), t, 0.18, { type: 'triangle', vol: 0.18 });
        tone(N(4), t + 0.09, 0.25, { type: 'triangle', vol: 0.18 });
        break;
      case 1: // Uncommon
        [0, 4, 7].forEach((s, i) => tone(N(s), t + i * 0.08, 0.3, { type: 'triangle', vol: 0.2 }));
        sparkle(t + 0.2, 4, 0.3);
        break;
      case 2: // Rare
        [0, 4, 7, 12].forEach((s, i) => tone(N(s), t + i * 0.08, 0.4, { type: 'triangle', vol: 0.22 }));
        chord(t + 0.32, [0, 4, 7, 12], 0.8, 0.07, 'sine');
        sparkle(t + 0.3, 8, 0.6);
        break;
      case 3: // Epic
        [0, 3, 7, 10, 12, 15].forEach((s, i) => tone(N(s - 12), t + i * 0.06, 0.35, { type: 'sawtooth', vol: 0.09, filter: 2200 }));
        chord(t + 0.38, [-12, 3, 7, 12], 1.4, 0.08, 'sawtooth', 1800);
        sparkle(t + 0.4, 14, 1.0);
        boom(t + 0.38);
        break;
      case 4: // Legendary — фанфари
      case 5: { // Mythic — фанфари + дзвіночки
        const mythic = tierIndex === 5;
        const fan = [[0, 0.0, 0.16], [0, 0.17, 0.16], [0, 0.34, 0.16], [4, 0.51, 0.5], [2, 0.9, 0.16], [4, 1.07, 0.16], [7, 1.24, 0.9]];
        fan.forEach(([s, d, len]) => {
          tone(N(s - 12), t + d, len + 0.1, { type: 'sawtooth', vol: 0.12, attack: 0.02, filter: 2600 });
          tone(N(s), t + d, len + 0.1, { type: 'square', vol: 0.035, attack: 0.02, filter: 3200 });
        });
        boom(t + 0.51);
        boom(t + 1.24);
        chord(t + 1.24, [-24, -12, -5, 0, 4, 7], 2.2, 0.06, 'sawtooth', 2400);
        sparkle(t + 1.2, mythic ? 30 : 16, mythic ? 2.2 : 1.4);
        if (mythic) {
          // каскад дзвіночків донизу і знову вгору
          [24, 21, 19, 16, 14, 12, 14, 16, 19, 21, 24, 28, 31].forEach((s, i) =>
            tone(N(s), t + 1.5 + i * 0.07, 0.6, { type: 'sine', vol: 0.07 }));
          chord(t + 2.45, [12, 16, 19, 24], 2.0, 0.05, 'sine');
        }
        break;
      }
    }
  }

  function uiTick() {
    if (!ready()) return;
    tone(1200, now(), 0.04, { type: 'sine', vol: 0.05 });
  }

  function setEnabled(v) {
    enabled = v;
    try { global.localStorage.setItem(LS_KEY, v ? 'on' : 'off'); } catch (e) {}
    if (!v) { stopSpin(); stopSuspense(); }
    else unlock();
  }

  global.Sound = {
    unlock, startSpin, stopSpin, land, suspense, stopSuspense, win, uiTick, setEnabled,
    get enabled() { return enabled; },
  };
})(window);
