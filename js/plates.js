/* =========================================================
   Генератор українських номерних знаків + система рідкості
   Формат: АА 1234 ВВ (стандарт ДСТУ 4278:2019, серія 2013+)
   ========================================================= */
(function (global) {
  'use strict';

  // Лише 12 літер, що дозволені на номерах (збігаються з латиницею)
  const LETTERS = ['А', 'В', 'Е', 'І', 'К', 'М', 'Н', 'О', 'Р', 'С', 'Т', 'Х'];
  const DIGITS = ['0', '1', '2', '3', '4', '5', '6', '7', '8', '9'];

  // Коди регіонів: серії 2004 і 2013 років + нові серії 2021 року (по 2 на регіон).
  // КК у 2013 був кодом Криму, а з 2021 це також код Києва.
  const REGIONS = {
    'АК': 'АР Крим',            'КК': 'м. Київ / АР Крим',
    'ТК': 'АР Крим',            'МК': 'АР Крим',
    'ІМ': 'Вінницька обл.',     'РІ': 'Вінницька обл.',
    'СМ': 'Волинська обл.',     'ТС': 'Волинська обл.',
    'РР': 'Дніпропетровська обл.', 'МІ': 'Дніпропетровська обл.',
    'ТН': 'Донецька обл.',      'МН': 'Донецька обл.',
    'ТМ': 'Житомирська обл.',   'МВ': 'Житомирська обл.',
    'МТ': 'Закарпатська обл.',  'МО': 'Закарпатська обл.',
    'ТР': 'Запорізька обл.',    'МР': 'Запорізька обл.',
    'ТО': 'Івано-Франківська обл.', 'ХС': 'Івано-Франківська обл.',
    'ТІ': 'Київська обл.',      'ЕЕ': 'Київська обл.',
    'ТТ': 'м. Київ',
    'ХА': 'Кіровоградська обл.', 'ЕА': 'Кіровоградська обл.',
    'ЕР': 'Луганська обл.',     'ЕВ': 'Луганська обл.',
    'СС': 'Львівська обл.',     'ЕС': 'Львівська обл.',
    'ХЕ': 'Миколаївська обл.',  'ХН': 'Миколаївська обл.',
    'ОО': 'Одеська обл.',       'ЕН': 'Одеська обл.',
    'ХІ': 'Полтавська обл.',    'ЕІ': 'Полтавська обл.',
    'ХК': 'Рівненська обл.',    'ЕК': 'Рівненська обл.',
    'ХМ': 'Сумська обл.',       'ЕМ': 'Сумська обл.',
    'ХО': 'Тернопільська обл.', 'ЕО': 'Тернопільська обл.',
    'ХХ': 'Харківська обл.',    'ЕХ': 'Харківська обл.',
    'ХТ': 'Херсонська обл.',    'ЕТ': 'Херсонська обл.',
    'ОХ': 'Хмельницька обл.',   'РХ': 'Хмельницька обл.',
    'ОА': 'Черкаська обл.',     'РА': 'Черкаська обл.',
    'ОВ': 'Чернігівська обл.',  'РВ': 'Чернігівська обл.',
    'ОЕ': 'Чернівецька обл.',   'РЕ': 'Чернівецька обл.',
    'ОН': 'м. Севастополь',     'РН': 'м. Севастополь',
    'АВ': 'Вінницька обл.',     'КВ': 'Вінницька обл.',
    'АС': 'Волинська обл.',     'КС': 'Волинська обл.',
    'АЕ': 'Дніпропетровська обл.', 'КЕ': 'Дніпропетровська обл.',
    'АН': 'Донецька обл.',      'КН': 'Донецька обл.',
    'АМ': 'Житомирська обл.',   'КМ': 'Житомирська обл.',
    'АО': 'Закарпатська обл.',  'КО': 'Закарпатська обл.',
    'АР': 'Запорізька обл.',    'КР': 'Запорізька обл.',
    'АТ': 'Івано-Франківська обл.', 'КТ': 'Івано-Франківська обл.',
    'АІ': 'Київська обл.',      'КІ': 'Київська обл.',
    'АА': 'м. Київ',            'КА': 'м. Київ',
    'ВА': 'Кіровоградська обл.', 'НА': 'Кіровоградська обл.',
    'ВВ': 'Луганська обл.',     'НВ': 'Луганська обл.',
    'ВС': 'Львівська обл.',     'НС': 'Львівська обл.',
    'ВЕ': 'Миколаївська обл.',  'НЕ': 'Миколаївська обл.',
    'ВН': 'Одеська обл.',       'НН': 'Одеська обл.',
    'ВІ': 'Полтавська обл.',    'НІ': 'Полтавська обл.',
    'ВК': 'Рівненська обл.',    'НК': 'Рівненська обл.',
    'ВМ': 'Сумська обл.',       'НМ': 'Сумська обл.',
    'ВО': 'Тернопільська обл.', 'НО': 'Тернопільська обл.',
    'АХ': 'Харківська обл.',    'КХ': 'Харківська обл.',
    'ВТ': 'Херсонська обл.',    'НТ': 'Херсонська обл.',
    'ВХ': 'Хмельницька обл.',   'НХ': 'Хмельницька обл.',
    'СА': 'Черкаська обл.',     'ІА': 'Черкаська обл.',
    'СВ': 'Чернігівська обл.',  'ІВ': 'Чернігівська обл.',
    'СЕ': 'Чернівецька обл.',   'ІЕ': 'Чернівецька обл.',
    'СН': 'м. Севастополь',     'ІН': 'м. Севастополь',
  };
  const REGION_CODES = Object.keys(REGIONS);
  const DOUBLE_CODES = REGION_CODES.filter(c => c[0] === c[1]); // АА, КК, ВВ, НН

  // Рідкості (назви англійською, як просили)
  const TIERS = [
    { id: 'common',    name: 'Common',    min: 0,   weight: 55,  color: '#9aa7b8', price: [300, 1500] },
    { id: 'uncommon',  name: 'Uncommon',  min: 12,  weight: 25,  color: '#34d399', price: [2000, 8000] },
    { id: 'rare',      name: 'Rare',      min: 28,  weight: 12,  color: '#3b82f6', price: [10000, 40000] },
    { id: 'epic',      name: 'Epic',      min: 45,  weight: 5.5, color: '#a855f7', price: [50000, 200000] },
    { id: 'legendary', name: 'Legendary', min: 75,  weight: 2,   color: '#f59e0b', price: [250000, 900000] },
    { id: 'mythic',    name: 'Mythic',    min: 100, weight: 0.5, color: '#ff4fd8', price: [1000000, 5000000] },
  ];
  const TIER_BY_ID = Object.fromEntries(TIERS.map((t, i) => [t.id, Object.assign({ index: i }, t)]));

  // ---------- Випадковість ----------
  const rnd = (n) => {
    if (global.crypto && global.crypto.getRandomValues) {
      const a = new Uint32Array(1);
      global.crypto.getRandomValues(a);
      return a[0] % n;
    }
    return Math.floor(Math.random() * n);
  };
  const pick = (arr) => arr[rnd(arr.length)];
  const pad4 = (n) => String(n).padStart(4, '0');

  // ---------- Оцінка цифр ----------
  function scoreDigits(d) {
    const [a, b, c, e] = d;
    const n = parseInt(d, 10);
    const found = [];
    const add = (pts, label) => found.push({ pts, label });

    if (d === '0001') add(75, 'Номер один — 0001');
    else if (d.startsWith('000')) add(60, 'Три нулі на початку');
    else if (a === b && b === c && c === e) {
      add(d === '7777' ? 70 : 55, d === '7777' ? 'Щасливі чотири сімки' : 'Чотири однакові цифри');
    }
    else if (d.endsWith('000')) add(35, 'Кругле число');
    else if ('01234567890'.includes(d)) add(40, 'Послідовність по зростанню');
    else if ('9876543210'.includes(d)) add(36, 'Послідовність по спаданню');
    else if ((a === b && b === c) || (b === c && c === e)) add(24, 'Три однакові цифри поспіль');
    else if (/^0\d00$/.test(d) || /^00\d0$/.test(d)) add(22, 'Кругле число');
    else if (a === b && c === e) add(20, 'Дві пари цифр');
    else if (a === c && b === e) add(20, 'Повтор пари');
    else if (a === e && b === c) add(18, 'Дзеркальні цифри');
    else if (d.startsWith('00')) add(15, 'Два нулі на початку');
    else if (d.endsWith('00')) add(14, 'Сотні');
    else if (a === e && a === b) add(8, 'Майже повтор');

    // Невеликі бонуси, що не залежать від основного патерну
    if (n !== 7777 && d.includes('777') ) add(6, 'Три сімки');
    return found;
  }

  // ---------- Оцінка літер ----------
  function scoreLetters(prefix, suffix) {
    const found = [];
    const add = (pts, label) => found.push({ pts, label });
    const prefDouble = prefix[0] === prefix[1];
    const sufDouble = suffix[0] === suffix[1];

    if (prefix === suffix && prefDouble) add(40, 'Чотири однакові літери');
    else if (prefix === suffix) add(25, 'Однакові серії з обох боків');
    else if (prefix[0] === suffix[1] && prefix[1] === suffix[0]) add(12, 'Дзеркальні літери');
    else if (sufDouble) add(15, 'Подвійні літери серії');
    else if (prefDouble) add(6, 'Подвійний код регіону');
    return found;
  }

  // ---------- Повна оцінка номера ----------
  function evaluate(plate) {
    const { prefix, digits, suffix } = plate;
    const dig = scoreDigits(digits);
    const let_ = scoreLetters(prefix, suffix);
    const digitPts = dig.reduce((s, f) => s + f.pts, 0);
    const letterPts = let_.reduce((s, f) => s + f.pts, 0);
    const features = dig.concat(let_);
    let score = digitPts + letterPts;
    if (digitPts >= 35 && letterPts >= 25) {
      score += 15;
      features.push({ pts: 15, label: 'Ідеальне комбо' });
    }
    let tier = TIERS[0];
    for (const t of TIERS) if (score >= t.min) tier = t;
    const price = priceFor(plate, score, tier);
    return { score, tier: TIER_BY_ID[tier.id], features, price };
  }

  // Детермінована ціна: той самий номер завжди коштує однаково
  function hash(str) {
    let h = 2166136261;
    for (let i = 0; i < str.length; i++) {
      h ^= str.charCodeAt(i);
      h = Math.imul(h, 16777619);
    }
    return (h >>> 0) / 4294967295;
  }
  function priceFor(plate, score, tier) {
    const idx = TIERS.indexOf(tier);
    const next = TIERS[idx + 1];
    const span = next ? next.min - tier.min : 40;
    const pos = Math.min(1, (score - tier.min) / span);
    const jitter = hash(plate.prefix + plate.digits + plate.suffix);
    const t = Math.min(1, pos * 0.7 + jitter * 0.3);
    const [lo, hi] = tier.price;
    const raw = lo * Math.pow(hi / lo, t); // логарифмічна шкала
    const step = raw >= 100000 ? 5000 : raw >= 10000 ? 500 : raw >= 1000 ? 50 : 10;
    return Math.round(raw / step) * step;
  }

  // ---------- Генератори патернів ----------
  const DIGIT_GENS = [
    () => pad4(1 + rnd(9999)),                                   // звичайний
    () => pad4(1 + rnd(9999)),
    () => pad4(1 + rnd(9999)),
    () => { const x = pick(DIGITS); return x === '0' ? '7777' : x.repeat(4); },
    () => '000' + (1 + rnd(9)),
    () => (1 + rnd(9)) + '000',
    () => { const s = 1 + rnd(6); return '0123456789'.substr(s, 4); },
    () => { const s = rnd(6); return '9876543210'.substr(s, 4); },
    () => { const a = pick(DIGITS), b = pick(DIGITS); return a + b + b + a; },
    () => { const a = pick(DIGITS), b = pick(DIGITS); return a + a + b + b; },
    () => { const a = pick(DIGITS), b = pick(DIGITS); return a + b + a + b; },
    () => { const a = pick(DIGITS), b = pick(DIGITS); return rnd(2) ? a + a + a + b : b + a + a + a; },
    () => '00' + pick(DIGITS) + (1 + rnd(9)),
    () => (1 + rnd(9)) + pick(DIGITS) + '00',
  ];
  const LETTER_GENS = [
    () => [pick(REGION_CODES), pick(LETTERS) + pick(LETTERS)],   // звичайні
    () => [pick(REGION_CODES), pick(LETTERS) + pick(LETTERS)],
    () => [pick(REGION_CODES), pick(LETTERS) + pick(LETTERS)],
    () => { const l = pick(LETTERS); return [pick(REGION_CODES), l + l]; },
    () => { const p = pick(REGION_CODES); return [p, p]; },
    () => { const p = pick(DOUBLE_CODES); return [p, p]; },
    () => { const p = pick(REGION_CODES); return [p, p[1] + p[0]]; },
  ];

  function fixDigits(d) { return d === '0000' ? '0001' : d; }

  function randomPlate() {
    return {
      prefix: pick(REGION_CODES),
      digits: pad4(1 + rnd(9999)),
      suffix: pick(LETTERS) + pick(LETTERS),
    };
  }

  function rollTier() {
    const total = TIERS.reduce((s, t) => s + t.weight, 0);
    let r = Math.random() * total;
    for (const t of TIERS) { if ((r -= t.weight) < 0) return t; }
    return TIERS[0];
  }

  // Головна функція: спочатку визначаємо рідкість за шансами,
  // потім підбираємо номер, який справді має таку рідкість.
  function spin() {
    const target = rollTier();
    let best = null;
    for (let i = 0; i < 4000; i++) {
      const plate = target.id === 'common' ? randomPlate() : (() => {
        const [prefix, suffix] = pick(LETTER_GENS)();
        return { prefix, digits: fixDigits(pick(DIGIT_GENS)()), suffix };
      })();
      const ev = evaluate(plate);
      if (ev.tier.id === target.id) return Object.assign(plate, ev);
      if (!best || Math.abs(ev.tier.index - TIER_BY_ID[target.id].index) <
          Math.abs(best.tier.index - TIER_BY_ID[target.id].index)) best = Object.assign(plate, ev);
    }
    return best;
  }

  function fromKey(key) {
    // key: "АА7777АА"
    const plate = { prefix: key.slice(0, 2), digits: key.slice(2, 6), suffix: key.slice(6, 8) };
    return Object.assign(plate, evaluate(plate));
  }
  const keyOf = (p) => p.prefix + p.digits + p.suffix;

  // ---------- «Перевір свій номер» ----------

  // Латиниця й малі літери → дозволені кириличні літери
  const LATIN = { A: 'А', B: 'В', E: 'Е', I: 'І', K: 'К', M: 'М', H: 'Н', O: 'О', P: 'Р', C: 'С', T: 'Т', X: 'Х' };
  function normalizeLetter(ch) {
    const u = String(ch).toUpperCase();
    if (LATIN[u]) return LATIN[u];
    if (u === 'I' || u === 'Ї' || u === 'Й') return 'І';
    return LETTERS.includes(u) ? u : null;
  }

  // «Кращий, ніж X% номерів»: порівнюємо з 60 000 рівномірно випадкових номерів.
  // Генератор з фіксованим зерном, щоб відсоток для номера завжди був однаковий.
  let sortedPrices = null;
  function buildPercentiles() {
    let s = 20240824;
    const r = (n) => { s = (s + 0x6D2B79F5) | 0; let t = Math.imul(s ^ (s >>> 15), 1 | s); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return (((t ^ (t >>> 14)) >>> 0) / 4294967296 * n) | 0; };
    const N = 60000;
    const arr = new Float64Array(N);
    for (let i = 0; i < N; i++) {
      const p = { prefix: REGION_CODES[r(REGION_CODES.length)], digits: pad4(1 + r(9999)), suffix: LETTERS[r(12)] + LETTERS[r(12)] };
      arr[i] = evaluate(p).price;
    }
    sortedPrices = arr.sort();
  }
  function percentile(price) {
    if (!sortedPrices) buildPercentiles();
    let lo = 0, hi = sortedPrices.length;
    while (lo < hi) { const m = (lo + hi) >> 1; if (sortedPrices[m] < price) lo = m + 1; else hi = m; }
    return lo / sortedPrices.length * 100;
  }

  // Схожі, але дорожчі номери в тому ж регіоні
  function similarBetter(plate, limit = 3) {
    const { prefix, digits, suffix } = plate;
    const mine = evaluate(plate).price;
    const digitSet = new Set();
    const uniq = [...new Set(digits.split(''))];
    uniq.forEach(d => { if (d !== '0') digitSet.add(d.repeat(4)); });
    const [a, b] = digits;
    digitSet.add(a + b + b + a).add(a + a + b + b).add(a + b + a + b);
    if (a !== '0') digitSet.add(a + '000');
    if (digits[3] !== '0') digitSet.add('000' + digits[3]);
    digitSet.add('0001');
    const start = parseInt(a, 10);
    if (start >= 1 && start <= 6) digitSet.add('0123456789'.substr(start, 4));
    const letterSet = new Set([prefix, suffix[0] + suffix[0], prefix[1] + prefix[0]]);

    const cands = [];
    digitSet.forEach(d => { if (d !== '0000') cands.push({ prefix, digits: d, suffix }); });
    letterSet.forEach(s => cands.push({ prefix, digits, suffix: s }));
    digitSet.forEach(d => { if (d !== '0000') cands.push({ prefix, digits: d, suffix: prefix }); });

    const seen = new Set([keyOf(plate)]);
    const better = [];
    for (const c of cands) {
      const k = keyOf(c);
      if (seen.has(k)) continue;
      seen.add(k);
      const ev = evaluate(c);
      if (ev.price > mine) better.push(Object.assign(c, ev));
    }
    better.sort((x, y) => x.price - y.price);
    if (better.length <= limit) return better;
    // від найдоступнішого покращення до «номера мрії»
    const pickIdx = [0, Math.floor((better.length - 1) / 2), better.length - 1];
    return pickIdx.map(i => better[i]);
  }

  global.Plates = {
    LETTERS, REGIONS, TIERS, TIER_BY_ID,
    spin, evaluate, fromKey, keyOf, normalizeLetter, percentile, similarBetter,
    regionName: (code) => REGIONS[code] || 'Україна',
    // Однаково працює і в браузері, і в боті на Cloudflare
    formatPrice: (n) => String(Math.round(n)).replace(/\B(?=(\d{3})+(?!\d))/g, ' ') + ' ₴',
    formatPercent: (pct) => (pct >= 99 ? Math.min(pct, 99.99).toFixed(2).replace('.', ',') : String(Math.floor(pct))) + '%',
  };
})(typeof window !== 'undefined' ? window : globalThis);
