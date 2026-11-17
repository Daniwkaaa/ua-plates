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
      `<span class="cell${i < 2 || i > 5 ? ' L' : ''}${i === 2 || i === 6 ? ' gap' : ''}">${c}</span>`).join('');
    return `<div class="plate"><div class="plate-flag"><span class="flag"></span><span class="ua">UA</span></div>` +
      `<div class="plate-chars">${cells}</div><div class="shine"></div></div>`;
  }

  // ---------- Номер з барабанами (головний екран і «Мій номер») ----------
  function createReelPlate(container, initial) {
    let current = initial.split('');
    const reels = current.map((c, i) => {
      const cell = document.createElement('span');
      cell.className = 'cell reel' + (i < 2 || i > 5 ? ' L' : '') + (i === 2 || i === 6 ? ' gap' : '');
      cell.dataset.i = i;
      cell.innerHTML = `<div class="strip"><span>${c}</span></div>`;
      container.appendChild(cell);
      return cell;
    });
    // Показати символ без анімації (для вводу); null — порожнє місце
    function setChar(i, ch) {
      current[i] = ch || (i < 2 || i > 5 ? 'А' : '0');
      reels[i].firstElementChild.innerHTML = ch ? `<span>${ch}</span>` : `<span class="ph">_</span>`;
    }
    function spin(target, suspense, onDigitsDone) {
      return spinReels(reels, current, target, suspense, onDigitsDone).then(() => { current = target.split(''); });
    }
    return { reels, setChar, spin };
  }

  const plateEl = $('plate');
  const wrap = $('plate-wrap');
  const mainPlate = createReelPlate($('plate-chars'), 'ХХ0000ХХ');

  function spinReels(reels, current, target, suspense, onDigitsDone) {
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
        strip.style.transform = `translateY(-${(chars.length - 1) * 1.3}em)`;
        reel.classList.remove('landed');
        reel.classList.add('blur');
        setTimeout(() => reel.classList.remove('blur'), dur * 650);

        // Зупинка барабана: по закінченню анімації або по таймеру
        // (якщо вкладка прихована, браузер може не завершити анімацію)
        let finished = false;
        const finish = () => {
          if (finished) return;
          finished = true;
          clearTimeout(fallback);
          ac.abort();
          strip.style.transition = 'none';
          strip.style.transform = 'none';
          strip.innerHTML = `<span>${target[i]}</span>`;
          reel.classList.add('landed');
          haptic.tick();
          landedCount++;
          Sound.land(landedCount === reels.length);
          if (i === 5 && onDigitsDone) onDigitsDone();
          if (landedCount === reels.length) resolve();
        };
        const fallback = setTimeout(finish, dur * 1000 + 120);
        const ac = new AbortController();
        strip.addEventListener('transitionend', (e) => { if (e.target === strip) { ac.abort(); finish(); } }, { signal: ac.signal });
      });
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

  function plateCenter(el = plateEl) {
    const r = el.getBoundingClientRect();
    return { x: r.left + r.width / 2, y: r.top + r.height / 2 };
  }

  let raysTimer = null;
  const RAINBOW =['#ff4fd8', '#ffd43b', '#4fffb0', '#4fc3ff', '#a855f7', '#ffffff'];

  function reveal(p) {
    const tier = p.tier;
    lastMainPlate = p;
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
    playTierFx(tier, plateEl);
  }

  // Ефекти, звук і вібрація для рідкості
  function playTierFx(tier, el) {
    Sound.win(tier.index);
    const c = plateCenter(el);
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
        if (tier.id === 'mythic') setTimeout(() => FX.burst({ ...plateCenter(el), colors, count: 90, confetti: true, power: 2 }), 900);
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
    Sound.unlock();
    Sound.startSpin(8);

    const p = Plates.spin();
    const suspense = p.tier.index >= 3 || (p.tier.index === 2 && Math.random() < 0.25);

    rays.className = 'rays';
    wrap.className = 'plate-wrap';
    result.classList.remove('show');
    regionEl.innerHTML = '&nbsp;';
    hint.textContent = 'Крутимо…';
    document.documentElement.style.setProperty('--tier', '#9aa7b8');

    await mainPlate.spin(Plates.keyOf(p), suspense, () => {
      if (suspense) {
        wrap.classList.add('charging');
        hint.textContent = 'Щось особливе…';
        hint.classList.add('suspense');
        haptic.impact('rigid');
        Sound.suspense();
      }
    });
    Sound.stopSpin();
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
    sheetPlate = p;
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
    Sound.uiTick();
    document.querySelectorAll('.tab').forEach(t => t.classList.toggle('active', t === b));
    document.querySelectorAll('.view').forEach(v => v.classList.toggle('active', v.id === 'view-' + b.dataset.view));
    rays.classList.remove('on');
    if (b.dataset.view === 'collection' && collectionDirty) renderCollection();
    window.scrollTo(0, 0);
  });

  // ---------- Мій номер ----------
  const checkPlateEl = $('check-plate');
  const checkWrap = $('check-wrap');
  const checkPlate = createReelPlate($('check-chars'), 'АА0000АА');
  const kbd = $('kbd'), checkBtn = $('check-btn'), checkInput = $('check-input'), checkResult = $('check-result');
  const checkLead = $('check-lead');
  const LEAD_TEXT = checkLead.textContent;
  const typed = Array(8).fill(null);
  let cursor = 0, checkMode = 'input', checking = false;
  const isLetterPos = (i) => i < 2 || i > 5;
  for (let i = 0; i < 8; i++) checkPlate.setChar(i, null);

  function renderKbd() {
    const letters = isLetterPos(cursor);
    const label = letters ? (cursor < 2 ? 'Код регіону' : 'Серія (літери)') : 'Цифри';
    const keys = letters ? LETTERS : '1234567890'.split('');
    kbd.className = 'kbd ' + (letters ? 'letters' : 'digits');
    kbd.innerHTML = `<div class="kbd-label">${label}</div>` +
      keys.map(k => `<button class="key" data-k="${k}" type="button">${k}</button>`).join('') +
      `<button class="key wide" data-k="clear" type="button">Очистити</button>` +
      `<button class="key wide" data-k="back" type="button">⌫ Стерти</button>`;
  }
  function updateCheck() {
    checkBtn.disabled = !typed.every(Boolean);
    const pre = typed[0] && typed[1] ? typed[0] + typed[1] : null;
    $('check-region').textContent = pre ? '📍 ' + Plates.regionName(pre) : ' ';
    checkPlate.reels.forEach((r, i) => r.classList.toggle('caret', checkMode === 'input' && i === cursor));
    renderKbd();
  }
  function wrongKey() {
    const r = checkPlate.reels[cursor];
    r.classList.remove('bad'); void r.offsetWidth; r.classList.add('bad');
    try { inTg && tg.HapticFeedback.notificationOccurred('error'); } catch (e) {}
  }
  function typeKey(k) {
    if (checkMode !== 'input') return;
    if (k === 'back') {
      if (!typed[cursor] && cursor > 0) cursor--;
      typed[cursor] = null; checkPlate.setChar(cursor, null);
    } else if (k === 'clear') {
      typed.fill(null);
      for (let i = 0; i < 8; i++) checkPlate.setChar(i, null);
      cursor = 0;
    } else {
      const ch = isLetterPos(cursor) ? Plates.normalizeLetter(k) : (/^\d$/.test(k) ? k : null);
      if (!ch) { wrongKey(); return; }
      typed[cursor] = ch; checkPlate.setChar(cursor, ch);
      if (cursor < 7) cursor++;
    }
    haptic.tick();
    Sound.unlock(); Sound.uiTick();
    updateCheck();
  }
  kbd.addEventListener('click', (e) => { const b = e.target.closest('.key'); if (b) typeKey(b.dataset.k); });
  $('check-chars').addEventListener('click', (e) => {
    const c = e.target.closest('.cell'); if (!c || checkMode !== 'input') return;
    cursor = +c.dataset.i; haptic.tick(); updateCheck();
  });
  // Фізична клавіатура (Telegram на комп'ютері)
  document.addEventListener('keydown', (e) => {
    if (!$('view-check').classList.contains('active') || checkMode !== 'input' || e.ctrlKey || e.metaKey || e.altKey) return;
    if (e.key === 'Backspace') { e.preventDefault(); typeKey('back'); }
    else if (e.key === 'Enter') { e.preventDefault(); doCheck(); }
    else if (e.key === 'ArrowLeft') { cursor = Math.max(0, cursor - 1); updateCheck(); }
    else if (e.key === 'ArrowRight') { cursor = Math.min(7, cursor + 1); updateCheck(); }
    else if (e.key.length === 1 && e.key !== ' ') { e.preventDefault(); typeKey(e.key); }
  });

  async function doCheck() {
    if (checking || !typed.every(Boolean)) return;
    checking = true;
    checkMode = 'result';
    const key = typed.join('');
    const p = Plates.fromKey(key);
    checkInput.classList.add('hidden');
    checkResult.classList.remove('show');
    checkWrap.className = 'plate-wrap';
    checkLead.textContent = 'Перевіряємо твій номер…';
    document.documentElement.style.setProperty('--tier', '#9aa7b8');
    updateCheck();
    haptic.impact('medium');
    Sound.unlock(); Sound.startSpin(8);
    const suspense = p.tier.index >= 3;
    await checkPlate.spin(key, suspense, () => {
      if (!suspense) return;
      checkWrap.classList.add('charging');
      checkLead.textContent = 'Ого, тут щось особливе…';
      haptic.impact('rigid');
      Sound.suspense();
    });
    Sound.stopSpin();
    checkWrap.classList.remove('charging');
    revealCheck(p);
    checking = false;
  }
  checkBtn.addEventListener('click', doCheck);

  function revealCheck(p) {
    const tier = p.tier;
    document.documentElement.style.setProperty('--tier', tier.color);
    checkWrap.className = 'plate-wrap revealed t-' + tier.id;
    checkPlateEl.classList.remove('shining'); void checkPlateEl.offsetWidth; checkPlateEl.classList.add('shining');
    checkLead.textContent = ['Звичайний номер, зате твій 🙂', 'Непоганий номер!', 'Гарний номер!', 'Оце так номер! 😮',
      'Це справжній скарб! 🔥', 'Легенда! Таких номерів одиниці 👑'][tier.index];

    const badgeEl = $('check-badge');
    badgeEl.textContent = tier.name;
    badgeEl.className = 'tier-badge' + (tier.id === 'mythic' ? ' mythic' : '');
    countUp($('check-price'), p.price, tier.index >= 4 ? 1800 : 900);

    const pct = Plates.percentile(p.price);
    $('check-pct').innerHTML = pct < 1
      ? 'Таких номерів найбільше, і це нормально 😉'
      : `Кращий, ніж <b>${Plates.formatPercent(pct)}</b> номерів в Україні`;
    lastCheckPlate = p;

    $('check-features').innerHTML = p.features.length
      ? p.features.map((f, i) => `<span class="chip" style="animation-delay:${0.35 + i * 0.08}s">${f.label}<b>+${f.pts}</b></span>`).join('')
      : `<span class="chip" style="animation-delay:.35s">Звичайна комбінація</span>`;

    const sim = Plates.similarBetter(p);
    $('check-similar').innerHTML = sim.length
      ? `<h3>Схожі, але дорожчі</h3><p>Ось як міг би виглядати твій номер у тому ж регіоні</p>` +
        sim.map((s, i) =>
          `<div class="sim" style="--tier:${s.tier.color};animation-delay:${0.6 + i * 0.12}s">${plateHTML(Plates.keyOf(s))}` +
          `<div class="sim-meta"><span class="sim-tier">${s.tier.name}</span><span class="sim-price">${Plates.formatPrice(s.price)}</span>` +
          `<span class="sim-diff">+${Plates.formatPrice(s.price - p.price)}</span></div></div>`).join('')
      : `<h3>Кращого майже не буває 👑</h3><p>Твій номер уже на самій вершині.</p>`;

    checkResult.classList.add('show');
    playTierFx(tier, checkPlateEl);
  }

  $('check-again').addEventListener('click', () => {
    checkMode = 'input';
    checkResult.classList.remove('show');
    checkInput.classList.remove('hidden');
    checkWrap.className = 'plate-wrap';
    checkLead.textContent = LEAD_TEXT;
    rays.classList.remove('on');
    document.documentElement.style.setProperty('--tier', '#9aa7b8');
    cursor = 7;
    haptic.tick(); Sound.uiTick();
    updateCheck();
    window.scrollTo({ top: 0, behavior: 'smooth' });
  });
  updateCheck();

  // ---------- Поділитися ----------
  const BOT_USERNAME = 'Nomercraftbot';
  const APP_LINK = `https://t.me/${BOT_USERNAME}?startapp`;
  let lastMainPlate = null, lastCheckPlate = null, sheetPlate = null, toastTimer = null;

  function toast(text) {
    let el = document.querySelector('.toast');
    if (!el) { el = document.createElement('div'); el.className = 'toast'; document.body.appendChild(el); }
    el.textContent = text;
    el.classList.add('show');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => el.classList.remove('show'), 2200);
  }

  function sharePlate(p) {
    if (!p) return;
    haptic.impact('light');
    Sound.uiTick();
    const pct = Plates.percentile(p.price);
    const plate = fmtPlate(p);
    // 1) Telegram: вибір чату + гарна картка від бота (inline-режим)
    if (inTg && tg.isVersionAtLeast('6.7')) {
      try {
        tg.switchInlineQuery(pct >= 1 ? `${plate} ${Plates.formatPercent(pct)}` : plate, ['users', 'groups', 'channels']);
        return;
      } catch (e) { /* inline-режим вимкнено — нижче запасний варіант */ }
    }
    // 2) Запасний варіант: звичайне повідомлення з посиланням
    const text = `🚗 ${plate} — ${p.tier.name}, ${Plates.formatPrice(p.price).replace(/ /g, ' ')}! А який номер у тебе?`;
    const shareUrl = `https://t.me/share/url?url=${encodeURIComponent(APP_LINK)}&text=${encodeURIComponent(text)}`;
    if (inTg) { tg.openTelegramLink(shareUrl); return; }
    if (navigator.share) { navigator.share({ text, url: APP_LINK }).catch(() => {}); return; }
    try {
      navigator.clipboard.writeText(`${text} ${APP_LINK}`).then(() => toast('Скопійовано! Встав у чат 😉'), () => window.open(shareUrl, '_blank'));
    } catch (e) { window.open(shareUrl, '_blank'); }
  }
  $('share-main').addEventListener('click', () => sharePlate(lastMainPlate));
  $('share-check').addEventListener('click', () => sharePlate(lastCheckPlate));
  $('share-sheet').addEventListener('click', () => sharePlate(sheetPlate));

  // ---------- Звук увімк./вимк. ----------
  const soundBtn = $('sound-btn');
  const renderSoundBtn = () => {
    soundBtn.classList.toggle('off', !Sound.enabled);
    soundBtn.setAttribute('aria-label', Sound.enabled ? 'Вимкнути звук' : 'Увімкнути звук');
  };
  soundBtn.addEventListener('click', () => {
    Sound.setEnabled(!Sound.enabled);
    renderSoundBtn();
    haptic.tick();
    Sound.uiTick();
  });
  renderSoundBtn();

  // ---------- Старт ----------
  buildFilters();
  renderOdds();
  updateStats();
  Store.load().then(() => {
    // Прибираємо номери з кодами регіонів, яких більше немає в грі (серії 2021 року)
    const removed = Store.prune((key) => !!Plates.REGIONS[key.slice(0, 2)]);
    if (removed) {
      const n10 = removed % 10, n100 = removed % 100;
      const form = n10 === 1 && n100 !== 11 ? 'нереалістичний номер'
        : n10 >= 2 && n10 <= 4 && (n100 < 12 || n100 > 14) ? 'нереалістичні номери' : 'нереалістичних номерів';
      setTimeout(() => toast(`Колекцію оновлено: прибрано ${removed} ${form}`), 600);
    }
    evalCache.clear(); updateStats(); collectionDirty = true; renderCollection();
  });
})();
