/**
 * 指标单点计算（定稿 §9#6：同一数字在任何屏上必须一样 ⟹ 只在这里算一次）
 *
 * 口径全部来自定稿 §7「两个时间事实」：
 *   连着几天   = 从最近一次记录往前数连续达到标准的天数
 *   近段做到几成 = 跨度内的**有效天数**里，达标的比例
 *
 * 有效天数的口径（定稿 §7原文）：
 *   · 从「承诺开始日到今天」，并且**剔除暂停期**
 *   · 不限期承诺 → 窗口取近 30 天
 *   · 有跨度承诺 → 窗口取**整个跨度**
 *     （否则新建的 7 天承诺第一天只有 3%，用户会以为自己很差）
 *
 * 「稳了」默认判据：近段 ≥ 80% 且无连续 ≥ 5 天中断。**是默认值不是铁律**
 */

import {
  type EntryDoc,
  type RuleDoc,
  daysBetween,
  todayDate,
  addDays,
} from "./db";

export const WINDOW_INDEFINITE = 30; // 不限期承诺的比例窗口
export const SOLID_RATE = 0.8; // 稳了：近段 ≥ 80%
export const SOLID_MAX_GAP = 5; // 稳了：无连续 ≥ 5 天中断
export const STALE_DAYS = 7; // 界面 03「没动」：几天没记

/* ─────────────────────────────────────────────────────────────
   达标判定：某一天算不算达标
   ───────────────────────────────────────────────────────────── */
export function isDayMet(rule: RuleDoc, entries: EntryDoc[], date: string): boolean {
  const ofDay = entries.filter((e) => e.ruleId === rule.id && e.date === date);
  if (!ofDay.length) return false;

  switch (rule.cadence) {
    case "weekly": {
      // 周频率：这一天有记录就算"这天做到了"（比例的粒度仍是天）
      return true;
    }
    default: {
      // 日频率：累计值需达到标准
      if (rule.target == null) return true; // 无标准 = 有记录即达标
      const sum = ofDay.reduce((a, e) => a + (e.value ?? 1), 0);
      return sum >= rule.target;
    }
  }
}

/* ─────────────────────────────────────────────────────────────
   窗口：不限期 → 近 30 天；有跨度 → 整个跨度（截到今天）
   ───────────────────────────────────────────────────────────── */
export function windowOf(rule: RuleDoc, today = todayDate()): { from: string; to: string } {
  const to = today;
  if (rule.start && rule.end) {
    // 有跨度：窗口取整个跨度，但不超过今天（未来天数不参与，否则会拉低）
    const endClamped = daysBetween(today, rule.end) > 0 ? today : rule.end;
    return { from: rule.start, to: endClamped };
  }
  if (rule.start) return { from: rule.start, to };
  return { from: addDays(to, -(WINDOW_INDEFINITE - 1)), to };
}

/* ─────────────────────────────────────────────────────────────
   一条规则的指标
   ───────────────────────────────────────────────────────────── */
export interface RuleMetrics {
  rule: RuleDoc;
  /** 窗口内有效天数（剔除暂停期后仍按天数计，暂停期以 rule.state 粗粒度处理） */
  windowDays: number;
  /** 达标天数 */
  metDays: number;
  /** 达标率 0..1；windowDays=0 时为 0 */
  rate: number;
  /** 连着几天达标 */
  streak: number;
  /** 最长中断（连着几天没达标），用于"稳了"与"掉了"的判据 */
  maxGap: number;
  /** 最近一次有记录的日期，null = 从没记过 */
  lastAt: string | null;
  /** 距今几天没记 */
  idleDays: number | null;
  /** 状态判定（在养/稳了/暂停/归档 之外的派生结论） */
  verdict: "solid" | "slipping" | "stale" | "fresh";
}

export function metricsOf(rule: RuleDoc, allEntries: EntryDoc[], today = todayDate()): RuleMetrics {
  const entries = allEntries.filter((e) => e.ruleId === rule.id);
  const { from, to } = windowOf(rule, today);
  const windowDays = Math.max(0, daysBetween(from, to) + 1);

  let metDays = 0;
  let streak = 0;
  let maxGap = 0;
  let gapRun = 0;
  let countingStreak = true;

  // 从 to 往前逐日走
  for (let i = 0; i < windowDays; i++) {
    const d = addDays(to, -i);
    const met = isDayMet(rule, entries, d);
    if (met) {
      metDays++;
      if (countingStreak) streak++;
      gapRun = 0;
    } else {
      countingStreak = false;
      gapRun++;
      if (gapRun > maxGap) maxGap = gapRun;
    }
  }

  const rate = windowDays ? metDays / windowDays : 0;

  // 最近一次记录
  const lastAt = entries.length
    ? entries.map((e) => e.date).sort().slice(-1)[0]
    : null;
  const idleDays = lastAt ? daysBetween(lastAt, today) : null;

  let verdict: RuleMetrics["verdict"];
  if (rule.state === "paused" || rule.state === "archived") verdict = "fresh";
  else if (idleDays != null && idleDays >= STALE_DAYS) verdict = "stale";
  else if (rule.state === "solid" || (rate >= SOLID_RATE && maxGap < SOLID_MAX_GAP)) verdict = "solid";
  else if (maxGap >= SOLID_MAX_GAP) verdict = "slipping";
  else verdict = "fresh";

  return { rule, windowDays, metDays, rate, streak, maxGap, lastAt, idleDays, verdict };
}

/* ─────────────────────────────────────────────────────────────
   全体：分组（界面 03 的三组）
   ───────────────────────────────────────────────────────────── */
export interface Groups {
  solid: RuleMetrics[];
  slipping: RuleMetrics[];
  stale: RuleMetrics[];
  others: RuleMetrics[];
}

export function groupAll(rules: RuleDoc[], entries: EntryDoc[], today = todayDate()): Groups {
  const g: Groups = { solid: [], slipping: [], stale: [], others: [] };
  for (const r of rules) {
    /* ⚠ 设定与**时期**都不进三组：
       · setting —— 它是开关，不是被追踪的行为
       · period  —— 它是**多因素目标的容器**（A5），进度由它提到的几条规则的合力决定，
                    自己对"每天达标"没有意义。它走 periodSummary() 的「报瓶颈」路径。
       （曾把备考期算成 0/45 掉进"掉了"，那是错的。） */
    if (r.kind === "setting" || r.kind === "period") continue;
    const m = metricsOf(r, entries, today);
    if (r.state === "paused" || r.state === "archived") g.others.push(m);
    else if (m.verdict === "stale") g.stale.push(m);
    else if (m.verdict === "solid") g.solid.push(m);
    else g.slipping.push(m);
  }
  const byRate = (a: RuleMetrics, b: RuleMetrics) => b.rate - a.rate || a.rule.title.localeCompare(b.rule.title);
  g.solid.sort(byRate);
  g.slipping.sort(byRate);
  g.stale.sort((a, b) => (b.idleDays ?? 0) - (a.idleDays ?? 0));
  return g;
}

/* ─────────────────────────────────────────────────────────────
   多因素目标（A5）—— **不做平均，报瓶颈**
   定稿 §8.1：涌现的东西不能用加权平均假装成一个数；瓶颈可行动，平均值不可行动
   ───────────────────────────────────────────────────────────── */
export interface PeriodSummary {
  period: RuleDoc;
  mentioned: RuleMetrics[];
  /** 瓶颈：达标率最低的那一条 */
  bottleneck: RuleMetrics | null;
}

export function periodSummary(
  period: RuleDoc,
  allRules: RuleDoc[],
  entries: EntryDoc[],
  today = todayDate(),
): PeriodSummary {
  const ids = period.mentions ?? [];
  const mentioned = ids
    .map((id) => allRules.find((r) => r.id === id))
    .filter((r): r is RuleDoc => !!r)
    .map((r) => {
      // 时期里的临时标准：收紧/放宽后重新算
      const temp = period.tempTargets?.[r.id];
      const eff = temp != null ? { ...r, target: temp } : r;
      return metricsOf(eff, entries, today);
    });
  const bottleneck =
    mentioned.length > 0
      ? mentioned.reduce((a, b) => (a.rate <= b.rate ? a : b))
      : null;
  return { period, mentioned, bottleneck };
}

/* ─────────────────────────────────────────────────────────────
   界面 02「此刻唯一的一件」—— 优先序（定稿 §7 默认，可改）
   接近截止的时期 > 快稳了的 > 刚建的；相同则按开始时间
   ───────────────────────────────────────────────────────────── */
export function pickTheOne(
  rules: RuleDoc[],
  entries: EntryDoc[],
  today = todayDate(),
): { rule: RuleDoc; metrics: RuleMetrics; why: string } | null {
  const active = rules.filter((r) => r.state === "growing" && r.kind !== "period" && r.kind !== "setting");
  if (!active.length) return null;

  const scored = active.map((r) => {
    const m = metricsOf(r, entries, today);
    let score = 0;
    let why = "";
    // 接近截止的时期里的规则最优先
    const covering = rules.filter(
      (p) =>
        p.kind === "period" &&
        p.state === "growing" &&
        (p.mentions ?? []).includes(r.id) &&
        p.end &&
        daysBetween(today, p.end) >= 0,
    );
    if (covering.length) {
      const nearest = covering.sort((a, b) => daysBetween(today, a.end!) - daysBetween(today, b.end!))[0];
      score += 1000 - daysBetween(today, nearest.end!) * 0.1;
      why = `在「${nearest.title}」里，还剩 ${daysBetween(today, nearest.end!)} 天`;
    }
    // 快稳了的
    if (m.rate >= SOLID_RATE * 0.9) {
      score += 500 + m.rate * 100;
      if (!why) why = `快稳了 · 连着 ${m.streak} 天`;
    }
    // 刚建的（还没形成节奏）
    if (m.windowDays <= 7) {
      score += 200;
      if (!why) why = "刚开始养";
    }
    // 今天已经达标的降权（它不需要再被推）
    if (isDayMet(r, entries, today)) score -= 300;
    if (!why) why = `连着 ${m.streak} 天 · 近段 ${Math.round(m.rate * 100)}%`;
    return { rule: r, metrics: m, score, why };
  });

  scored.sort((a, b) => b.score - a.score || a.rule.title.localeCompare(b.rule.title));
  const top = scored[0];
  return top ? { rule: top.rule, metrics: top.metrics, why: top.why } : null;
}

/* ─────────────────────────────────────────────────────────────
   界面 03「掉了」的成因提示（可行动的下一步）
   ───────────────────────────────────────────────────────────── */
export function whySlipping(m: RuleMetrics): string {
  if (m.idleDays != null && m.idleDays >= STALE_DAYS) return `${m.idleDays} 天没记 —— 入口太远，还是这条不该养？`;
  if (m.maxGap >= SOLID_MAX_GAP) return `连着断了 ${m.maxGap} 天 —— 标准太高？还是时间不对？`;
  if (m.rate < 0.5) return `近段只做到 ${Math.round(m.rate * 100)}% —— 标准可能定高了`;
  return `近段 ${Math.round(m.rate * 100)}% —— 还差一点`;
}

/* ─────────────────────────────────────────────────────────────
   计数辅助
   ───────────────────────────────────────────────────────────── */
export function entriesOfDay(entries: EntryDoc[], date: string): EntryDoc[] {
  return entries.filter((e) => e.date === date).sort((a, b) => a.at.localeCompare(b.at));
}

export function last7(entries: EntryDoc[], today = todayDate()): EntryDoc[][] {
  return Array.from({ length: 7 }, (_, i) => entriesOfDay(entries, addDays(today, -(6 - i))));
}
