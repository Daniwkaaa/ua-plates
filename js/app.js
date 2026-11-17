(function () {
  'use strict';

  const { TIERS, TIER_BY_ID, LETTERS } = Plates;
  const DIGITS = '0123456789'.split('');
  const $ = (id) => document.getElementById(id);

  // ---------- Telegram ----------
  const tg = window.Telegram && window.Telegram.WebApp;
  const inTg = !!(tg && tg.initData !== undefined && tg.platform && tg.platform !== 'unknown');
  if (tg) {
    try {
      tg.ready();
      tg.expand();
      if (tg.isVersionAtLeast('6.1')) { tg.setHeaderColor('#070a14'); tg.setBackgroundColor('#070a14'); }
      if (tg.isVersionAtLeast('7.7') && tg.disableVerticalSwipes) tg.disableVerticalSwipes();
    } catch (e) { /* старий клієнт */ }
  }
  const haptic = {
    tick() { try { inTg && tg.HapticFeedback.selectionChanged(); } catch (e) {} },
    impact(s) { try { inTg && tg.HapticFeedback.impactOccurred(s); } catch (e) {} },
    ok() { try { inTg && tg.HapticFeedback.notificationOccurred('success'); } catch (e) {} },
  };

  const fmtPlate = (p) => `${p.prefix} ${p.digits} ${p.suffix}`;
  const setTier = (el, tier) => el.style.setProperty('--tier', tier.color);

  // Статичний номер (для колекції, шансів, шторки)
  function plateHTML(key) {
    const cells = key.split('').map((c, i) =>
      `<span class="cell${i === 2 || i === 6 ? ' gap' : ''}">${c}</span>`).join('');
    return `<div class="plate"><div class="plate-flag"><span class="flag"></span><span class="ua">UA</span></div>` +
      `<div class="plate-chars">${cells}</div><div class="shine"></div></div>`;
  }

  // ---------- Головний номер з барабанами ----------
  const plateChars = $('plate-chars');
  const plateEl = $('plate');
  const wrap = $('plate-wrap');
  let current = 'ХХ0000ХХ'.split('');
  const reels = current.map((c, i) => {
    const cell = document.createElement('span');
    cell.className = 'cell reel' + (i === 2 || i === 6 ? ' gap' : '');
    cell.innerHTML = `<div class="strip"><span>${c}</span></div>`;
    plateChars.appendChild(cell);
    return cell;
  });

  function spinReels(target, suspense, onDigitsDone) {
    return new Promise((resolve) => {
      let landedCount = 0;
      reels.forEach((reel, i) => {
        const strip = reel.firstElementChild;
        const pool = i < 2 || i > 5 ? LETTERS : DIGITS;
        const extra = suspense && i >= 6 ? 10 + (i - 5) * 8 : 0;
        const n = 12 + i * 3 + extra;
        const chars = [current[i]];
        for (let k = 0; k < n; k++) chars.push(pool[(Math.random() * pool.length) | 0]);
        chars.push(target[i]);
        strip.innerHTML = chars.map(c => `<span>${c}</span>`).join('');
        strip.style.transition = 'none';
        strip.style.transform = 'translateY(0)';
        void strip.offsetHeight;
        const dur = 0.9 + i * 0.16 + (suspense && i >= 6 ? 1.1 + (i - 6) * 0.9 : 0);
        strip.style.transition = `transform ${dur}s cubic-bezier(.12,.75,.2,1)`;
        strip.style.transform = `translateY(-${(chars.length - 1) * 1.15}em)`;
        reel.classList.remove('landed');
        reel.classList.add('blur');
        setTimeout(() => reel.classList.remove('blur'), dur * 650);

        strip.addEventListener('transitionend', () => {
          strip.style.transition = 'none';
          strip.style.transform = 'none';
          strip.innerHTML = `<span>${target[i]}</span>`;
          reel.classList.add('landed');
          haptic.tick();
          landedCount++;
          if (i === 5 && onDigitsDone) onDigitsDone();
          if (landedCount === reels.length) resolve();
        }, { once: true });
      });
      current = target.split('');
    });
  }

  // ---------- Результат ----------
  const hint = $('hint');
  const result = $('result');
  const badge = $('tier-badge');
  const priceEl = $('price');
  const featuresEl = $('features');
  const regionEl = $('region');
  const rays = $('rays');
  const flash = $('flash');
  const spinBtn = $('spin-btn');

  function countUp(el, to, ms) {
    const start = performance.now();
    const ease = (t) => 1 - Math.pow(1 - t, 4);
    (function step(now) {
      const t = Math.min(1, (now - start) / ms);
      el.textContent = Plates.formatPrice(Math.round(to * ease(t) / 10) * 10 || 0);
      if (t < 1) requestAnimationFrame(step);
      else el.textContent = Plates.formatPrice(to);
    })(start);
  }

  function plateCenter() {
    const r = plateEl.getBoundingClientRect();
    return { x: r.left + r.width / 2, y: r.top + r.height / 2 };
  }

  let raysTimer = null;
  const RAINBOW =['#ff4fd8', '#ffd43b', '#4fffb0', '#4fc3ff', '#a855f7', '#ffffff'];

  function reveal(p) {
    const tier = p.tier;
    document.documentElement.style.setProperty('--tier', tier.color);
    wrap.className = 'plate-wrap revealed t-' + tier.id;
    plateEl.classList.remove('shining'); void plateEl.offsetWidth; plateEl.classList.add('shining');
    hint.classList.remove('suspense');
    hint.textContent = tier.index >= 4 ? 'Неймовірно! Це справжній скарб!' :
      tier.index === 3 ? 'Оце так номер!' : tier.index === 2 ? 'Гарна комбінація!' : 'Твій новий номер';
    regionEl.textContent = '📍 ' + Plates.regionName(p.prefix);

    badge.textContent = tier.name;
    badge.className = 'tier-badge' + (tier.id === 'mythic' ? ' mythic' : '');
    featuresEl.innerHTML = p.features.length
      ? p.features.map((f, i) => `<span class="chip" style="animation-delay:${0.35 + i * 0.08}s">${f.label}<b>+${f.pts}</b></span>`).join('')
      : `<span class="chip" style="animation-delay:.35s">Звичайна комбінація</span>`;
    result.classList.remove('show'); void result.offsetWidth; result.classList.add('show');
    countUp(priceEl, p.price, tier.index >= 4 ? 1800 : 900);

    const c = plateCenter();
    const col = tier.color;
    switch (tier.id) {
      case 'common':
        haptic.impact('light');
        break;
      case 'uncommon':
        haptic.impact('medium');
        FX.burst({ ...c, colors: [col, '#ffffff'], count: 20, power: 0.7 });
        break;
      case 'rare':
        haptic.ok();
        FX.burst({ ...c, colors: [col, '#9cc2ff', '#ffffff'], count: 45 });
        break;
      case 'epic':
        haptic.ok(); haptic.impact('heavy');
        FX.burst({ ...c, colors: [col, '#d8b4fe', '#ffffff'], count: 50 });
        FX.burst({ ...c, colors: [col, '#d8b4fe', '#ffd43b'], count: 40, confetti: true, power: 1.2 });
        break;
      case 'legendary':
      case 'mythic': {
        const colors = tier.id === 'mythic' ? RAINBOW : [col, '#ffe07a', '#ffffff', '#ffb703'];
        flash.classList.remove('go'); void flash.offsetWidth; flash.classList.add('go');
        rays.className = 'rays on' + (tier.id === 'mythic' ? ' mythic' : '');
        clearTimeout(raysTimer);
        raysTimer = setTimeout(() => rays.classList.remove('on'), tier.id === 'mythic' ? 6000 : 4500);
        haptic.ok();
        [0, 180, 360].forEach(d => setTimeout(() => haptic.impact('heavy'), d));
        FX.burst({ ...c, colors, count: 80, power: 1.4 });
        FX.burst({ ...c, colors, count: 70, confetti: true, power: 1.6 });
        setTimeout(() => FX.rain({ colors, count: tier.id === 'mythic' ? 160 : 90 }), 250);
        if (tier.id === 'mythic') setTimeout(() => FX.burst({ ...plateCenter(), colors, count: 90, confetti: true, power: 2 }), 900);
        break;
      }
    }
  }

  let spinning = false;
  async function doSpin() {
    if (spinning) return;
    spinning = true;
    spinBtn.disabled = true;
    haptic.impact('medium');

    const p = Plates.spin();
    const suspense = p.tier.index >= 3 || (p.tier.index === 2 && Math.random() < 0.25);

    rays.className = 'rays';
    wrap.className = 'plate-wrap';
    result.classList.remove('show');
    regionEl.innerHTML = '&nbsp;';
    hint.textContent = 'Крутимо…';
    document.documentElement.style.setProperty('--tier', '#9aa7b8');

    await spinReels(Plates.keyOf(p), suspense, () => {
      if (suspense) {
        wrap.classList.add('charging');
        hint.textContent = 'Щось особливе…';
        hint.classList.add('suspense');
        haptic.impact('rigid');
      }
    });
    wrap.classList.remove('charging');

    Store.add(Plates.keyOf(p));
    reveal(p);
    updateStats();
    collectionDirty = true;

    setTimeout(() => { spinning = false; spinBtn.disabled = false; }, 450);
  }
  spinBtn.addEventListener('click', doSpin);

  // Легкий 3D-нахил номера за пальцем
  const stage = document.querySelector('.stage');
  stage.addEventListener('pointermove', (e) => {
    const r = wrap.getBoundingClientRect();
    const dx = (e.clientX - (r.left + r.width / 2)) / r.width;
    const dy = (e.clientY - (r.top + r.height / 2)) / (r.height * 4);
    wrap.style.transform = `rotateY(${dx * 14}deg) rotateX(${-dy * 14}deg)`;
  });
  stage.addEventListener('pointerleave', () => { wrap.style.transform = ''; });

  // ---------- Статистика ----------
  function totals() {
    let value = 0, best = null;
    for (const e of Store.entries) {
      const p = cache(e.key);
      value += p.price;
      if (!best || p.price > best.price) best = p;
    }
    return { value, best, count: Store.entries.length };
  }
  const evalCache = new Map();
  function cache(key) {
    let p = evalCache.get(key);
    if (!p) { p = Plates.fromKey(key); evalCache.set(key, p); }
    return p;
  }
  function updateStats() {
    const t = totals();
    $('top-value').textContent = Plates.formatPrice(t.value);
    $('spins-count').textContent = 'Спроб: ' + Store.stats.spins;
    $('sum-count').textContent = t.count;
    $('sum-value').textContent = Plates.formatPrice(t.value);
    $('sum-best').textContent = t.best ? fmtPlate(t.best) : '—';
  }

  // ---------- Колекція ----------
  let filter = 'all', sort = 'rarity', shown = 40, collectionDirty = true;
  const grid = $('grid');

  function buildFilters() {
    const items = [{ id: 'all', name: 'Усі', color: '#ffffff' }].concat(TIERS);
    $('filters').innerHTML = items.map(t =>
      `<button class="filter${t.id === filter ? ' active' : ''}" data-f="${t.id}" type="button">` +
      `<span class="dot" style="background:${t.id === 'mythic' ? 'linear-gradient(135deg,#ff4fd8,#ffd43b,#4fc3ff)' : t.color}"></span>${t.name}</button>`).join('');
  }
  $('filters').addEventListener('click', (e) => {
    const b = e.target.closest('.filter'); if (!b) return;
    filter = b.dataset.f; shown = 40; haptic.tick();
    buildFilters(); renderCollection();
  });
  document.querySelector('.sort-row').addEventListener('click', (e) => {
    const b = e.target.closest('.sort-btn'); if (!b) return;
    sort = b.dataset.sort; shown = 40; haptic.tick();
    document.querySelectorAll('.sort-btn').forEach(x => x.classList.toggle('active', x === b));
    renderCollection();
  });
  $('more-btn').addEventListener('click', () => { shown += 40; renderCollection(); });

  function renderCollection() {
    const groups = new Map();
    for (const e of Store.entries) {
      const g = groups.get(e.key);
      if (g) { g.count++; g.t = Math.max(g.t, e.t); }
      else groups.set(e.key, { key: e.key, count: 1, t: e.t, first: e.t, p: cache(e.key) });
    }
    let list = Array.from(groups.values());
    if (filter !== 'all') list = list.filter(g => g.p.tier.id === filter);
    list.sort(sort === 'new' ? (a, b) => b.t - a.t
      : sort === 'price' ? (a, b) => b.p.price - a.p.price
      : (a, b) => b.p.tier.index - a.p.tier.index || b.p.price - a.p.price);

    $('empty').classList.toggle('show', list.length === 0);
    $('more-btn').classList.toggle('show', list.length > shown);
    grid.innerHTML = list.slice(0, shown).map((g, i) =>
      `<button class="card t-${g.p.tier.id}" data-key="${g.key}" type="button" style="--tier:${g.p.tier.color};animation-delay:${Math.min(i, 12) * 0.03}s">` +
      (g.count > 1 ? `<span class="card-count">×${g.count}</span>` : '') +
      plateHTML(g.key) +
      `<div class="card-meta"><span class="card-tier">${g.p.tier.name}</span><span class="card-price">${Plates.formatPrice(g.p.price)}</span></div>` +
      `</button>`).join('');
    collectionDirty = false;
  }
  grid.addEventListener('click', (e) => {
    const c = e.target.closest('.card'); if (!c) return;
    haptic.impact('light');
    openSheet(c.dataset.key);
  });

  // ---------- Шторка з деталями ----------
  const sheet = $('sheet'), backdrop = $('sheet-backdrop');
  function openSheet(key) {
    const p = cache(key);
    const mine = Store.entries.filter(e => e.key === key);
    const first = new Date(Math.min(...mine.map(e => e.t)) * 1000);
    sheet.style.setProperty('--tier', p.tier.color);
    $('sheet-body').innerHTML =
      plateHTML(key) +
      `<div class="tier-badge${p.tier.id === 'mythic' ? ' mythic' : ''}" style="--tier:${p.tier.color}">${p.tier.name}</div>` +
      `<div class="price">${Plates.formatPrice(p.price)}</div>` +
      `<div class="meta">📍 ${Plates.regionName(p.prefix)} · отримано ${first.toLocaleDateString('uk-UA')}${mine.length > 1 ? ' · копій: ' + mine.length : ''}</div>` +
      `<div class="features" style="--tier:${p.tier.color}">` +
      (p.features.length ? p.features.map((f, i) => `<span class="chip" style="animation-delay:${i * 0.06}s">${f.label}<b>+${f.pts}</b></span>`).join('')
        : '<span class="chip">Звичайна комбінація</span>') + `</div>`;
    sheet.classList.add('open'); backdrop.classList.add('open');
    const pl = sheet.querySelector('.plate');
    setTimeout(() => pl.classList.add('shining'), 250);
    if (inTg && tg.isVersionAtLeast('6.1')) tg.BackButton.show();
  }
  function closeSheet() {
    sheet.classList.remove('open'); backdrop.classList.remove('open');
    if (inTg && tg.isVersionAtLeast('6.1')) tg.BackButton.hide();
  }
  $('sheet-close').addEventListener('click', closeSheet);
  backdrop.addEventListener('click', closeSheet);
  if (inTg && tg.isVersionAtLeast('6.1')) tg.BackButton.onClick(closeSheet);

  // ---------- Рідкості ----------
  function renderOdds() {
    const total = TIERS.reduce((s, t) => s + t.weight, 0);
    const examples = { common: 'ВС4821КМ', uncommon: 'АІ1221ВК', rare: 'КА1234МР', epic: 'ВН7777ОК', legendary: 'ВС1111ВС', mythic: 'АА0001АА' };
    $('odds').innerHTML = TIERS.map(t => {
      const pct = t.weight / total * 100;
      const chance = pct >= 1 ? pct.toFixed(1).replace('.0', '') + '%' : pct.toFixed(1) + '%';
      return `<div class="odd" style="--tier:${t.color}">` +
        `<div><div class="odd-name${t.id === 'mythic' ? ' mythic' : ''}">${t.name}</div>` +
        `<div class="odd-price">${Plates.formatPrice(t.price[0])} – ${Plates.formatPrice(t.price[1])}</div></div>` +
        `<div class="odd-chance">${chance}</div>` +
        `<div class="bar"><i style="width:${Math.max(pct, 1.5)}%"></i></div>` +
        plateHTML(examples[t.id]) + `</div>`;
    }).join('');
  }

  // ---------- Навігація ----------
  document.querySelector('.tabbar').addEventListener('click', (e) => {
    const b = e.target.closest('.tab'); if (!b || b.classList.contains('active')) return;
    haptic.tick();
    document.querySelectorAll('.tab').forEach(t => t.classList.toggle('active', t === b));
    document.querySelectorAll('.view').forEach(v => v.classList.toggle('active', v.id === 'view-' + b.dataset.view));
    rays.classList.remove('on');
    if (b.dataset.view === 'collection' && collectionDirty) renderCollection();
    window.scrollTo(0, 0);
  });

  // ---------- Старт ----------
  buildFilters();
  renderOdds();
  updateStats();
  Store.load().then(() => { evalCache.clear(); updateStats(); collectionDirty = true; renderCollection(); });
})();
