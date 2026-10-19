/* ============================================================
   执灯人 · 灯焰内核（方向规格 v2.0）
   ------------------------------------------------------------
   一天一盏灯：D = .30·d体 + .25·d情 + .25·d思 + .20·d志
   D > +2 涨一档（+1 光）· D < −8 缩一档（floor = 本级起点）· 其余持平
   单日最多 ±1 光，等级永不下降。

   判定只用整数：差分放大 10 倍取整后比较，阈值同倍放大（+20 / −80）。
   注意两个不同口径，历史上混淆过两次：
     dOf(Δ)   → 规格里的 D 本身（浮点，用于界面显示 +2.1 这种）
     d10Of(Δ) → 10·D 取整（用于和阈值比较）
   权重按 ×1000 存（300/250/250/200），Δ 再 ×10 取整，所以
     累计值 = 10000·D，d10 = 累计/1000 = 10·D。

   本文件是唯一实现：index.html（手机端）与 desktop.html（电脑端）都引用它。
   纯函数、无 DOM、无状态，可直接在 node 里测。
   ============================================================ */
(function (root) {
  'use strict';

  /* 36 级，每级所需光 */
  var LIGHT_REQ = [4, 5, 5, 6, 6, 7, 8, 8, 9,
                   10, 11, 12, 13, 14, 15, 16, 18, 19,
                   21, 23, 25, 27, 30, 33, 36, 39, 42,
                   46, 50, 55, 60, 65, 71, 77, 84, 92];

  /* 累计光：CUM[0]=0，CUM[n]=升到第 n+1 级所需的累计光 */
  var CUM = (function () {
    var o = [0];
    for (var i = 0; i < LIGHT_REQ.length; i++) o.push(o[o.length - 1] + LIGHT_REQ[i]);
    return o;
  })();

  var TIERS = ['拾光', '凝露', '悬河', '鉴台'];
  var TIER_SPAN = [[1, 9], [10, 18], [19, 27], [28, 36]];
  var TIER_LIGHT = [58, 128, 276, 600];   /* = CUM[9] / CUM[18]-CUM[9] / ... */

  /* 四账户权重 ×1000 */
  var W_PM = { body: 300, bond: 250, mind: 250, means: 200 };

  var UP_D10 = 20;    /* D >  +2 */
  var DOWN_D10 = -80; /* D <  −8 */

  /* 第 light 光对应的等级（1 起步，36 级封顶） */
  function levelOf(light) {
    var lv = 1;
    for (var i = 0; i < LIGHT_REQ.length; i++) {
      if (light >= CUM[i]) lv = i + 1; else break;
    }
    return lv;
  }

  /* 第 lv 级属于哪个段位下标（0..3） */
  function tierIndex(lv) { return Math.min(3, ((lv - 1) / 9) | 0); }

  /* 第 lv 级属于哪个段位名 */
  function tierOf(lv) { return TIERS[tierIndex(lv)]; }

  /* 四账户变化量：delta[a] = 当前 - 基线 */
  function deltaOf(cur, base) {
    var d = {};
    for (var a in W_PM) d[a] = (cur[a] || 0) - (base[a] || 0);
    return d;
  }

  /* 加权累计值 = 10000·D（整数） */
  function pmSum(delta) {
    var s = 0;
    for (var a in W_PM) s += W_PM[a] * Math.round((delta[a] || 0) * 10);
    return s;
  }

  /* 10·D，取整 —— 判定用的口径 */
  function d10Of(delta) { return Math.round(pmSum(delta) / 1000); }

  /* D 本身 —— 显示用的口径 */
  function dOf(delta) { return pmSum(delta) / 10000; }

  /* 'up' | 'down' | 'flat' */
  function judge(d10) {
    if (d10 > UP_D10) return 'up';
    if (d10 < DOWN_D10) return 'down';
    return 'flat';
  }

  /* 落到 ±1 档；今日已落过档就不再叠加（规格 §2 不变量） */
  function stepOf(d10, alreadyApplied) {
    if (alreadyApplied) return 0;
    var v = judge(d10);
    return v === 'up' ? 1 : (v === 'down' ? -1 : 0);
  }

  /* 缩档时的地板：本级起点。等级永不下降 */
  function floorOf(light) {
    var lv = levelOf(light);
    return CUM[Math.max(0, lv - 1)];
  }

  /* 一次完整结算：返回 { d10, D, step, light, level, tier, appliedStep }
     纯函数——不写任何存储，调用方自己决定落盘 */
  function settle(light, level, delta, alreadyApplied) {
    var d10 = d10Of(delta);
    var step = stepOf(d10, alreadyApplied);
    var next = light;
    if (step > 0) next = light + 1;
    else if (step < 0) next = Math.max(floorOf(light), light - 1);
    var lv = levelOf(next);
    return {
      d10: d10, D: dOf(delta), step: step,
      light: next, level: lv, tier: tierOf(lv), appliedStep: step
    };
  }

  root.LightCore = {
    LIGHT_REQ: LIGHT_REQ,
    CUM: CUM,
    TIERS: TIERS,
    TIER_SPAN: TIER_SPAN,
    TIER_LIGHT: TIER_LIGHT,
    W_PM: W_PM,
    UP_D10: UP_D10,
    DOWN_D10: DOWN_D10,
    levelOf: levelOf,
    tierIndex: tierIndex,
    tierOf: tierOf,
    deltaOf: deltaOf,
    pmSum: pmSum,
    d10Of: d10Of,
    dOf: dOf,
    judge: judge,
    stepOf: stepOf,
    floorOf: floorOf,
    settle: settle
  };
})(typeof window !== 'undefined' ? window : globalThis);
