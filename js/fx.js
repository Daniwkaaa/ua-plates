/* Частинки: іскри та конфеті для рідкісних номерів */
(function (global) {
  'use strict';
  const canvas = document.getElementById('fx');
  const ctx = canvas.getContext('2d');
  let parts = [];
  let running = false;
  let dpr = 1;

  function resize() {
    dpr = Math.min(global.devicePixelRatio || 1, 2);
    canvas.width = innerWidth * dpr;
    canvas.height = innerHeight * dpr;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }
  addEventListener('resize', resize);
  resize();

  const R = (a, b) => a + Math.random() * (b - a);

  function burst({ x, y, colors, count = 40, confetti = false, power = 1 }) {
    for (let i = 0; i < count; i++) {
      const ang = R(0, Math.PI * 2);
      const sp = R(2, 9) * power;
      parts.push({
        x, y,
        vx: Math.cos(ang) * sp,
        vy: Math.sin(ang) * sp - (confetti ? R(2, 6) : 1),
        life: 0, max: R(50, 100) * (confetti ? 1.6 : 1),
        size: confetti ? R(5, 10) : R(1.5, 3.5),
        color: colors[(Math.random() * colors.length) | 0],
        rot: R(0, 6), vr: R(-0.3, 0.3),
        confetti,
      });
    }
    if (!running) { running = true; requestAnimationFrame(tick); }
  }

  // Дощ конфеті згори
  function rain({ colors, count = 90 }) {
    for (let i = 0; i < count; i++) {
      parts.push({
        x: R(0, innerWidth), y: R(-innerHeight * 0.6, -10),
        vx: R(-1, 1), vy: R(2, 5),
        life: 0, max: R(160, 240), size: R(6, 11),
        color: colors[(Math.random() * colors.length) | 0],
        rot: R(0, 6), vr: R(-0.2, 0.2), confetti: true, sway: R(0, 6),
      });
    }
    if (!running) { running = true; requestAnimationFrame(tick); }
  }

  function tick() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    parts = parts.filter(p => p.life < p.max && p.y < innerHeight + 40);
    for (const p of parts) {
      p.life++;
      if (p.confetti) {
        p.vy += 0.12; p.vx *= 0.985; p.vy *= 0.985;
        if (p.sway !== undefined) p.x += Math.sin((p.life + p.sway * 10) / 12) * 0.8;
      } else {
        p.vy += 0.06; p.vx *= 0.96; p.vy *= 0.96;
      }
      p.x += p.vx; p.y += p.vy; p.rot += p.vr;
      const a = 1 - p.life / p.max;
      ctx.globalAlpha = Math.max(0, Math.min(1, a * 1.5));
      ctx.fillStyle = p.color;
      if (p.confetti) {
        ctx.save();
        ctx.translate(p.x, p.y);
        ctx.rotate(p.rot);
        ctx.scale(1, Math.cos(p.life / 6 + p.rot));
        ctx.fillRect(-p.size / 2, -p.size / 4, p.size, p.size / 2);
        ctx.restore();
      } else {
        ctx.shadowBlur = 10; ctx.shadowColor = p.color;
        ctx.beginPath(); ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2); ctx.fill();
        ctx.shadowBlur = 0;
      }
    }
    ctx.globalAlpha = 1;
    if (parts.length) requestAnimationFrame(tick);
    else { running = false; ctx.clearRect(0, 0, canvas.width, canvas.height); }
  }

  global.FX = { burst, rain };
})(window);
