/* ============================================================
   执灯人 · 四账户与模块目录 accounts.js（v1）
   ------------------------------------------------------------
   四账户：体 body / 情 bond / 思 mind / 志 means
   每个模块先归「类」，再决定要不要进账户：
     kind:'account' → 记录成为当日四账户的一条事实（饮水/睡眠/情绪/记账…）
     kind:'tool'    → 只存事实，不进四账户（备忘录/倒数日/到点提醒/更多）
   工具不是「没有用」，而是不参与「灯」的判定——它们留在生活里，
   但不应该让一个人的灯因为「打开倒数日」而变亮。

   raw value ≠ score：
   每个 account 模块有自己的目标（饮水 2000ml / 睡眠 8h / …），
   normalize() 只返回 0–1 的「当日完成度」；
   dayScores() 给「有记录」的账户一个 0–100 的模块分；
   壳再取 max(任务完成率, 模块分)，避免模块记录把已有任务分稀释掉。
   ============================================================ */
(function (root) {
  'use strict';

  var ALIAS = {
    '训练': '运动',
    '久坐': '休息',
    '情绪': '情绪记录'
  };

  var ACCOUNTS = [
    ['body', '体'],
    ['bond', '情'],
    ['mind', '思'],
    ['means', '志']
  ];

  var MODULES = {
    /* —— 四账户模块（11）—— */
    '情绪记录': { kind: 'account', account: 'bond', label: '情绪', metric: 'tone', rule: { kind: 'latest', map: { good: 1, flat: 0.6, bad: 0.3 } } },
    '睡眠':     { kind: 'account', account: 'body', label: '睡眠', metric: 'hours', target: 8, rule: { kind: 'last', target: 8 } },
    '饮水':     { kind: 'account', account: 'body', label: '饮水', metric: 'ml', target: 2000, rule: { kind: 'ratio', target: 2000 } },
    '运动':     { kind: 'account', account: 'body', label: '训练', metric: 'minutes', target: 30, rule: { kind: 'ratio', target: 30 } },
    '饮食':     { kind: 'account', account: 'body', label: '饮食', metric: 'meals', target: 3, rule: { kind: 'ratio', target: 3 } },
    '休息':     { kind: 'account', account: 'body', label: '久坐', metric: 'breakMinutes', target: 10, rule: { kind: 'ratio', target: 10 } },
    '吃药':     { kind: 'account', account: 'body', label: '吃药', metric: 'doses', target: 3, rule: { kind: 'ratio', target: 3 } },
    '功法养生': { kind: 'account', account: 'body', label: '功法养生', metric: 'minutes', target: 20, rule: { kind: 'ratio', target: 20 } },
    '冥想':     { kind: 'account', account: 'bond', label: '冥想', metric: 'minutes', target: 10, rule: { kind: 'ratio', target: 10 } },
    '记账':     { kind: 'account', account: 'means', label: '记账', metric: 'entries', target: 1, rule: { kind: 'ratio', target: 1 } },
    '穿搭':     { kind: 'account', account: 'means', label: '穿搭', metric: 'worn', target: 1, rule: { kind: 'ratio', target: 1 } },

    /* —— 工具（4）：存事实，不进四账户 —— */
    '备忘录':   { kind: 'tool', account: null, label: '备忘录' },
    '倒数日':   { kind: 'tool', account: null, label: '倒数日' },
    '到点提醒': { kind: 'tool', account: null, label: '到点提醒' },
    '更多':     { kind: 'tool', account: null, label: '更多' }
  };

  function canonical(mod) {
    mod = String(mod == null ? '' : mod);
    return ALIAS[mod] || mod;
  }

  function info(mod) {
    return MODULES[canonical(mod)] || null;
  }

  function isTool(mod) {
    var i = info(mod);
    return !!(i && i.kind === 'tool');
  }

  function accountOf(mod) {
    var i = info(mod);
    return i && i.kind === 'account' ? i.account : null;
  }

  function num(v) {
    var n = typeof v === 'number' ? v : Number(v);
    return isFinite(n) ? n : 0;
  }

  function sum(records, metric) {
    var s = 0;
    (records || []).forEach(function (r) {
      if (!metric || r.metric === metric) s += num(r.value);
    });
    return s;
  }

  /* 返回 0–1；没有可用记录返回 null（不是 0，避免把「没记」当成「失败」） */
  function normalize(mod, records) {
    var name = canonical(mod);
    var i = MODULES[name];
    if (!i || i.kind !== 'account' || !records || !records.length) return null;
    var rule = i.rule || {};

    if (rule.kind === 'latest') {
      var last = records[records.length - 1];
      var v = String(last.value);
      return Object.prototype.hasOwnProperty.call(rule.map, v) ? rule.map[v] : null;
    }

    var target = rule.target || i.target;
    if (!target) return null;
    if (rule.kind === 'last') {
      /* 睡眠是一晚一个值：取最后一条 hours，不能把两次点击的时长相加 */
      var last = null;
      for (var j = records.length - 1; j >= 0; j--) {
        if (records[j].metric === i.metric) { last = records[j]; break; }
      }
      if (!last) return null;
      return Math.max(0, Math.min(1, num(last.value) / target));
    }
    var hasMetric = records.some(function (r) { return r.metric === i.metric; });
    if (!hasMetric) return null;
    var total = sum(records, i.metric);
    return Math.max(0, Math.min(1, total / target));
  }

  /* 按账户聚合当日事实；tools 单独放，不参与判定 */
  function dayFacts(day) {
    var out = { body: [], bond: [], mind: [], means: [], tools: [] };
    if (!day || !day.byMod) return out;
    Object.keys(day.byMod).forEach(function (mod) {
      var recs = day.byMod[mod] || [];
      if (!recs.length) return;
      var i = info(mod);
      if (!i || i.kind === 'tool') {
        out.tools.push({ mod: mod, records: recs });
        return;
      }
      var value = normalize(mod, recs);
      if (value == null) return;
      out[i.account].push({ mod: canonical(mod), value: value, records: recs });
    });
    return out;
  }

  function dayScores(day) {
    var facts = dayFacts(day);
    var scores = { body: null, bond: null, mind: null, means: null };
    ACCOUNTS.forEach(function (pair) {
      var a = pair[0];
      var arr = facts[a];
      if (!arr.length) return;
      var avg = arr.reduce(function (n, x) { return n + x.value; }, 0) / arr.length;
      scores[a] = Math.round(avg * 100);
    });
    return scores;
  }

  root.LightAccounts = {
    ACCOUNTS: ACCOUNTS,
    MODULES: MODULES,
    ALIAS: ALIAS,
    canonical: canonical,
    info: info,
    isTool: isTool,
    accountOf: accountOf,
    normalize: normalize,
    dayFacts: dayFacts,
    dayScores: dayScores
  };
})(typeof window !== 'undefined' ? window : globalThis);
