/* =========================================================
   Збереження колекції.
   Основне сховище: Telegram CloudStorage (хмара Telegram, прив'язана
   до користувача і бота, працює на всіх його пристроях).
   Резерв: localStorage (коли відкрито просто в браузері).
   Запис колекції: "АА7777АА.lq3x9k1z" (номер + час у base36),
   записи розбиті на шматки по 200 штук (ліміт 4096 символів на ключ).
   ========================================================= */
(function (global) {
  'use strict';

  const PER_CHUNK = 200;
  const LS_KEY = 'uaplates_v1';
  const tg = global.Telegram && global.Telegram.WebApp;
  const cloud = tg && tg.CloudStorage && tg.isVersionAtLeast && tg.isVersionAtLeast('6.9') ? tg.CloudStorage : null;

  let entries = [];           // [{ key, t }]
  let stats = { spins: 0 };
  const dirty = new Set();    // номери шматків, які треба дописати в хмару
  let flushTimer = null;

  const enc = (e) => e.key + '.' + e.t.toString(36);
  const dec = (s) => { const [key, t] = s.split('.'); return { key, t: parseInt(t, 36) || 0 }; };

  function cloudCall(method, ...args) {
    return new Promise((resolve) => {
      try {
        cloud[method](...args, (err, res) => resolve(err ? null : res));
      } catch (e) { resolve(null); }
    });
  }

  function readLocal() {
    try {
      const raw = global.localStorage.getItem(LS_KEY);
      if (!raw) return null;
      return JSON.parse(raw);
    } catch (e) { return null; }
  }
  function writeLocal() {
    try {
      global.localStorage.setItem(LS_KEY, JSON.stringify({ e: entries.map(enc), s: stats }));
    } catch (e) { /* немає місця або заборонено — не страшно */ }
  }

  async function readCloud() {
    if (!cloud) return null;
    const keys = await cloudCall('getKeys');
    if (!keys) return null;
    const chunkKeys = keys.filter(k => /^col_\d+$/.test(k))
      .sort((a, b) => parseInt(a.slice(4), 10) - parseInt(b.slice(4), 10));
    const want = chunkKeys.concat(keys.includes('stats') ? ['stats'] : []);
    if (!want.length) return { e: [], s: null };
    const vals = await cloudCall('getItems', want);
    if (!vals) return null;
    const e = [];
    chunkKeys.forEach(k => { if (vals[k]) e.push(...vals[k].split(',').filter(Boolean)); });
    let s = null;
    try { s = vals.stats ? JSON.parse(vals.stats) : null; } catch (err) { s = null; }
    return { e, s };
  }

  async function load() {
    const local = readLocal();
    const remote = await readCloud();
    // Об'єднуємо обидва джерела, щоб нічого не загубити
    const seen = new Set();
    const merged = [];
    [remote && remote.e, local && local.e].forEach(list => {
      (list || []).forEach(s => { if (!seen.has(s)) { seen.add(s); merged.push(s); } });
    });
    entries = merged.map(dec).filter(x => x.key && x.key.length === 8).sort((a, b) => a.t - b.t);
    stats = {
      spins: Math.max((remote && remote.s && remote.s.spins) || 0, (local && local.s && local.s.spins) || 0, entries.length),
    };
    // Якщо локально було більше, ніж у хмарі, синхронізуємо все
    if (cloud && remote && remote.e.length !== entries.length) {
      for (let i = 0; i * PER_CHUNK < entries.length; i++) dirty.add(i);
      scheduleFlush();
    }
    writeLocal();
    return { entries, stats };
  }

  function scheduleFlush() {
    if (!cloud) return;
    clearTimeout(flushTimer);
    flushTimer = setTimeout(flush, 600);
  }
  async function flush() {
    if (!cloud) return;
    const chunks = Array.from(dirty);
    dirty.clear();
    for (const i of chunks) {
      const part = entries.slice(i * PER_CHUNK, (i + 1) * PER_CHUNK).map(enc).join(',');
      const ok = await cloudCall('setItem', 'col_' + i, part);
      if (ok === null) dirty.add(i); // спробуємо пізніше
    }
    await cloudCall('setItem', 'stats', JSON.stringify(stats));
  }

  function add(key) {
    const e = { key, t: Math.floor(Date.now() / 1000) };
    entries.push(e);
    stats.spins += 1;
    dirty.add(Math.floor((entries.length - 1) / PER_CHUNK));
    writeLocal();
    scheduleFlush();
    return e;
  }

  global.Store = {
    load, add,
    get entries() { return entries; },
    get stats() { return stats; },
    get usesCloud() { return !!cloud; },
  };
})(window);
