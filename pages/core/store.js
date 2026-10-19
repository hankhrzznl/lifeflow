/* ============================================================
   执灯人 · 生活记录总线 store.js（v1）
   ------------------------------------------------------------
   职责边界：
   - 模块页只把「今天发生了什么」写成事实：record({mod, date, metric, value})
   - 壳读事实：readDay(date)
   - 四账户怎么算，不在这里——在 core/accounts.js 与壳的 acctScores()/settleDiff()
   - 工具类模块（备忘录 / 倒数日 / 到点提醒 / 更多）也走这里存事实，
     但 accounts.js 会把它们放进 tools，不参与四账户判定

   存储：localStorage['lifeflow-days-v1']
     { v:1, days:{ '2026-10-17': { records:[{id,mod,metric,value,at,source,meta}] } } }

   为什么单独一个 key：
   - 和 zdLight（壳的灯/任务/心情）分开，模块数据不会因为壳重置而丢；
   - 和 v3 页各自的老 key（lifeflow-water-my-cups 等）分开，避免再长出第 N 套数据；
   - 同源下壳与 iframe 都能读写，父窗通过 postMessage 收到变更，壳内即时重算。
   ============================================================ */
(function (root) {
  'use strict';

  var KEY = 'lifeflow-days-v1';
  var VERSION = 1;
  var MAX_RECORDS = 500;

  function dateKey(d) {
    d = d || new Date();
    return d.getFullYear() + '-' + (d.getMonth() + 1) + '-' + d.getDate();
  }

  function empty() {
    return { v: VERSION, days: {} };
  }

  function load() {
    try {
      var raw = root.localStorage && root.localStorage.getItem(KEY);
      if (!raw) return empty();
      var db = JSON.parse(raw);
      if (!db || typeof db !== 'object' || !db.days) return empty();
      db.v = db.v || 1;
      return db;
    } catch (e) {
      return empty();
    }
  }

  function save(db) {
    try {
      if (root.localStorage) {
        root.localStorage.setItem(KEY, JSON.stringify(db));
        return true;
      }
    } catch (e) {}
    return false;
  }

  var subs = [];
  function subscribe(fn) {
    if (typeof fn !== 'function') return function () {};
    subs.push(fn);
    return function () {
      var i = subs.indexOf(fn);
      if (i >= 0) subs.splice(i, 1);
    };
  }

  function notify(action, rec) {
    var payload = {
      type: 'lifeflow:store',
      action: action,
      date: rec && rec.date,
      mod: rec && rec.mod,
      id: rec && rec.id,
      key: KEY
    };
    subs.slice().forEach(function (fn) {
      try { fn(payload); } catch (e) {}
    });
    try {
      if (root.document && root.CustomEvent) {
        root.document.dispatchEvent(new root.CustomEvent('lifeflow:store', { detail: payload }));
      }
    } catch (e) {}
    try {
      if (root.parent && root.parent !== root) root.parent.postMessage(payload, '*');
    } catch (e) {}
  }

  function readDay(date) {
    date = date || dateKey();
    var db = load();
    var d = db.days[date] || { records: [] };
    var records = (d.records || []).slice().sort(function (a, b) {
      return String(a.at || '').localeCompare(String(b.at || ''));
    });
    var byMod = {};
    records.forEach(function (r) {
      (byMod[r.mod] = byMod[r.mod] || []).push(r);
    });
    return { date: date, records: records, byMod: byMod };
  }

  function record(input) {
    input = input || {};
    if (!input.mod) return null;
    var date = input.date || dateKey();
    var db = load();
    var day = db.days[date] || (db.days[date] = { records: [] });
    if (day.records.length >= MAX_RECORDS) day.records.shift();

    var rec = {
      id: Date.now().toString(36) + Math.random().toString(36).slice(2, 6),
      mod: String(input.mod),
      metric: String(input.metric || 'value'),
      // 不把 value 强转成数字：情绪是 'good'，水量才是 250
      value: input.value == null ? '' : input.value,
      at: new Date().toISOString(),
      source: input.source || 'user',
      date: date
    };
    if (input.meta && typeof input.meta === 'object') rec.meta = input.meta;

    day.records.push(rec);
    if (!save(db)) return null;
    notify('record', rec);
    return rec;
  }

  function remove(id) {
    if (!id) return false;
    var db = load();
    var found = null;
    Object.keys(db.days).some(function (date) {
      var recs = db.days[date].records || [];
      for (var i = 0; i < recs.length; i++) {
        if (recs[i].id === id) {
          found = recs.splice(i, 1)[0];
          if (!recs.length) delete db.days[date];
          return true;
        }
      }
      return false;
    });
    if (!found) return false;
    save(db);
    notify('remove', found);
    return true;
  }

  function clearDay(date) {
    date = date || dateKey();
    var db = load();
    if (!db.days[date]) return false;
    var first = (db.days[date].records || [])[0] || { date: date };
    delete db.days[date];
    save(db);
    notify('clear', first);
    return true;
  }

  function listDays() {
    return Object.keys(load().days).sort();
  }

  root.LightStore = {
    KEY: KEY,
    VERSION: VERSION,
    dateKey: dateKey,
    today: dateKey,
    readDay: readDay,
    record: record,
    remove: remove,
    clearDay: clearDay,
    listDays: listDays,
    subscribe: subscribe
  };
})(typeof window !== 'undefined' ? window : globalThis);
