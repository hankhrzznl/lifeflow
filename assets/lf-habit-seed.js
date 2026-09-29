/**
 * LifeFlow v3 · 习惯（工具轨 app-tool）· 种子数据的唯一来源
 * ─────────────────────────────────────────────────────────────
 * 为什么单独一个文件：habit / habit-create / habit-detail **三页共用**同一个 key
 * （`lifeflow-habit-items`）。种子如果各页各抄一份，就会出现"谁先打开谁的种子生效"，
 * 实测已经踩到：先打开 habit-create 保存 → 盘里只有那一条新习惯 → habit 列表只剩 1 张卡。
 * 所以把种子放这里，三页都读它；读不到（如离线/路径不对）各页自己退化为"不播种"，
 * 页面仍能正常显示（静态回退值还在标记里）。
 *
 * ⚠ 种子必须**精确复刻改造前写死的静态内容**：
 *    · habit.html 那 3 张卡：阅读 / 推进回顾 / 饮水（顺序、进度条宽度、连续天数、右侧值）
 *    · habit-detail.html 头卡写死展示的「早起 6:30」，以及它的统计 12 / 5 / 26
 *      与打卡热力月历（28 格、15 号是今天）
 *    · entries 一律从空开始 —— 与 focus.html 同一口径：**不伪造历史流水**
 *
 * ⚠ 习惯是**工具轨**（轨道：app-tool，不进七领域养成链）⟹ schema 里没有"领域"字段，
 *    字段严格按 habit-create 表单里真实存在的五项（名称 / 图标 / 落地形态 / 频率 / 提醒时间）。
 */
(function () {
  'use strict';

  function ymd(d) {
    var p = function (x) { return (x < 10 ? '0' : '') + x; };
    return d.getFullYear() + '-' + p(d.getMonth() + 1) + '-' + p(d.getDate());
  }

  /* 打卡热力格：改造前 `.heat-grid` 的 28 格，**逐格照抄**（5 个空格 + 1..23，15 号 is-today）。
     ⚠ 这张表不能手抄：第一次我手抄成"4 个空格 + lv 表"，抄错了两个格（3 号 7 号的等级），
       逐像素立刻报 1.333%（差异集中在 y450~599 的热力卡）。现用 tools/_extract-habit-seed.mjs
       从备份里抽出来核对过：h0×13 / h1×4（1,2,4,8） / h2×5（3,5,7,9,10） / h3×6（6,11..15）。 */
  function heatSeed() {
    var levels = { 1: 1, 2: 1, 3: 2, 4: 1, 5: 2, 6: 3, 7: 2, 8: 1, 9: 2, 10: 2,
                   11: 3, 12: 3, 13: 3, 14: 3, 15: 3 };
    var out = [];
    for (var i = 0; i < 5; i++) { out.push({ d: '', lv: 0, n: '', today: false }); }
    for (var n = 1; n <= 23; n++) {
      out.push({ d: String(n), lv: levels[n] || 0, n: String(n), today: n === 15 });
    }
    return out;
  }

  window.LF_HABIT_SEED = function () {
    var today = ymd(new Date());
    return [
      /* status = 详情页头卡那个状态标签（改造前写死「进行中」）；tag = 列表里的频率标签 */
      { id: 'seed-h1', name: '阅读', icon: 'book-open', tag: '每日', status: '进行中', unit: '分', value: '30 分',
        barPct: 100, seedStreak: 8, seedLongest: 12, seedMonth: 26, seedDate: today,
        freq: '每天', form: '时间块', formSub: '时长 + 灵活 · 到点提醒',
        remindTime: '07:00', remindOn: true, order: 0, heat: [], entries: [] },
      { id: 'seed-h2', name: '推进回顾', icon: 'pen-line', tag: '每日', status: '进行中', unit: '句', value: '3 句',
        barPct: 0, seedStreak: 5, seedLongest: 5, seedMonth: 0, seedDate: today,
        freq: '每天', form: '时间锚点', formSub: '固定时刻 · 到点/渐进提醒',
        remindTime: '07:00', remindOn: true, order: 0, heat: [], entries: [] },
      { id: 'seed-h3', name: '饮水', icon: 'droplets', tag: '每日', status: '进行中', unit: 'ml', value: '2000ml',
        barPct: 60, seedStreak: 12, seedLongest: 12, seedMonth: 0, seedDate: today,
        freq: '每天', form: '当日目标', formSub: '全天分散 · 落后才报',
        remindTime: '07:00', remindOn: true, order: 0, heat: [], entries: [] },
      /* 详情页改造前**写死展示**的那一条：order:1 ⟹ 不进 habit.html 的列表，
         但点开详情（或列表里 none）时要有真实数据可渲染 */
      { id: 'seed-h4', name: '早起 6:30', icon: 'sunrise', tag: '每日', status: '进行中', unit: '', value: '—',
        barPct: 0, seedStreak: 5, seedLongest: 12, seedMonth: 26, seedDate: today,
        freq: '每天', form: '时间锚点', formSub: '固定时刻 · 到点/渐进提醒',
        remindTime: '07:00', remindOn: true, order: 1, heat: heatSeed(), entries: [] }
    ];
  };
})();
