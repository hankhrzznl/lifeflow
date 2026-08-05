/**
 * UnifiedReviewer — 统一复盘引擎（v2.2+）
 *
 * 取代旧 dashboard-summary.ts 和旧 ReviewerBrain
 *
 * 能力：
 * 1. 多周期趋势分析（当前 vs 前 3 周期移动平均）
 * 2. 日内/周内模式分析
 * 3. 跨模块关联
 * 4. 优先级评分 + 行动建议
 * 5. 文案变体（同一数据模式随机输出不同表述）
 *
 * 输出结构同时供首页和长期主义页面消费，
 * 两端仅渲染层不同。
 */

import { daylogDB } from "@/lib/db/daylog.db";
import { healthDB, getSleepLogs } from "@/lib/db/health.db";
import { accountingDB } from "@/lib/db/accounting.db";
import { lifeDB } from "@/lib/db/life.db";
import { goalV2DB } from "@/lib/db/goal-v2.db";

// ============================================================
// 类型定义
// ============================================================

export interface DateRange {
  start: string;
  end: string;
}

export type ReviewPeriod = "daily" | "weekly" | "monthly" | "yearly";

export interface ReviewHighlight {
  module: string;
  label: string;
  value: string;
  trend: "up" | "down" | "stable";
  detail?: string;
}

export interface ReviewModuleSummary {
  module: string;
  icon: string;
  label: string;
  stats: Record<string, string | number>;
  highlights: ReviewHighlight[];
}

export interface InsightMetric {
  current: number;
  previous: number;
  changePercent: number;
  unit?: string;
}

export interface ReviewFinding {
  id: string;
  module: string;
  moduleLabel: string;
  type: "improvement" | "decline" | "pattern" | "correlation" | "milestone" | "suggestion";
  title: string;
  description: string;
  metric?: InsightMetric;
  trend: "up" | "down" | "stable";
  priority: number;
  action?: string;
}

export interface ModuleInsight {
  module: string;
  moduleLabel: string;
  icon: string;
  color: string;
  headline: string;
  detail: string;
  trend: "up" | "down" | "stable";
  changePercent: number;
  hasData: boolean;
  findings: ReviewFinding[];
}

export interface ReviewResult {
  period: ReviewPeriod;
  dateRange: DateRange;
  headline: string;
  overviewText: string;
  summaries: ReviewModuleSummary[];
  insights: ModuleInsight[];
  allFindings: ReviewFinding[];
  suggestions: string[];
  hasData: boolean;
}

// ============================================================
// 模块配色
// ============================================================

const MODULE_COLORS: Record<string, string> = {
  water: "#3B82F6",
  sleep: "#6366F1",
  fitness: "#F97316",
  finance: "#10B981",
  diet: "#EC4899",
  wellness: "#EF4444",
  posture: "#8B5CF6",
  schedule: "#007AFF",
  medication: "#5856D6",
  goals: "#FF9500",
};

const MODULE_ICONS: Record<string, string> = {
  water: "Droplets",
  sleep: "Moon",
  fitness: "Dumbbell",
  finance: "Wallet",
  diet: "Utensils",
  wellness: "Heart",
  posture: "StretchHorizontal",
  schedule: "Calendar",
  medication: "Pill",
  goals: "Target",
};

// ============================================================
// 日期工具
// ============================================================

function fmtDate(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function getDateRange(period: ReviewPeriod, offset: number = 0): DateRange {
  const now = new Date();
  switch (period) {
    case "daily": {
      const d = new Date(now);
      d.setDate(d.getDate() - offset);
      const ds = fmtDate(d);
      return { start: ds, end: ds };
    }
    case "weekly": {
      const day = now.getDay();
      const diff = day === 0 ? 6 : day - 1;
      const mon = new Date(now);
      mon.setDate(mon.getDate() - diff - offset * 7);
      const sun = new Date(mon);
      sun.setDate(sun.getDate() + 6);
      return { start: fmtDate(mon), end: fmtDate(sun) };
    }
    case "monthly": {
      const d = new Date(now.getFullYear(), now.getMonth() - offset, 1);
      const end = new Date(now.getFullYear(), now.getMonth() - offset + 1, 0);
      return { start: fmtDate(d), end: fmtDate(end) };
    }
    case "yearly": {
      const year = now.getFullYear() - offset;
      return { start: `${year}-01-01`, end: `${year}-12-31` };
    }
  }
}

function daysInRange(start: string, end: string): number {
  return Math.max(1, Math.round((new Date(end).getTime() - new Date(start).getTime()) / 86400000) + 1);
}

function periodLabel(period: ReviewPeriod): string {
  return period === "daily" ? "今日" : period === "weekly" ? "本周" : period === "monthly" ? "本月" : "今年";
}

function periodLabelPrev(period: ReviewPeriod): string {
  return period === "daily" ? "昨日" : period === "weekly" ? "上周" : period === "monthly" ? "上月" : "去年";
}

// ============================================================
// 文案工具 — 变体模板
// ============================================================

function pick<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

function formatChange(changePercent: number): string {
  const abs = Math.abs(changePercent);
  if (abs < 5) return "基本持平";
  if (abs < 20) return changePercent > 0 ? `提升 ${abs.toFixed(0)}%` : `下降 ${abs.toFixed(0)}%`;
  if (abs < 50) return changePercent > 0 ? `大幅提升 ${abs.toFixed(0)}%` : `明显下降 ${abs.toFixed(0)}%`;
  return changePercent > 0 ? `飙升 ${abs.toFixed(0)}%` : `暴跌 ${abs.toFixed(0)}%`;
}

// ============================================================
// 数据采集层
// ============================================================

interface WaterStats {
  totalMl: number;                        // 区间总 ml
  days: number;                           // 区间天数
  dailyTarget: number;                    // 每日目标 ml（来自 WaterGoal）
  hourlyMl: Record<string, number>;       // 按小时 ml（时段分布）
  dailyMl: Record<string, number>;        // 每日 ml
  dailyRecords: Record<string, number>;   // 每日饮水记录次数
}

async function getWaterData(range: DateRange): Promise<WaterStats> {
  try {
    // T15：饮水复盘统一走唯一流水源 waterLogs（hourly 待办已废弃）
    const logs = await healthDB.waterLogs.where("date").between(range.start, range.end, true, true).toArray();
    const days = daysInRange(range.start, range.end);
    const hourlyMl: Record<string, number> = {};
    const dailyMl: Record<string, number> = {};
    const dailyRecords: Record<string, number> = {};
    let totalMl = 0;
    for (const l of logs) {
      const amount = l.amount || 0;
      totalMl += amount;
      const hh = new Date(l.timestamp).getHours();
      const key = String(hh).padStart(2, "0");
      hourlyMl[key] = (hourlyMl[key] || 0) + amount;
      dailyMl[l.date] = (dailyMl[l.date] || 0) + amount;
      dailyRecords[l.date] = (dailyRecords[l.date] || 0) + 1;
    }
    let dailyTarget = 2000;
    try {
      const goal = await healthDB.waterGoals.toArray();
      if (goal[0]?.dailyTarget) dailyTarget = goal[0].dailyTarget;
    } catch { /* keep default */ }
    return { totalMl, days, dailyTarget, hourlyMl, dailyMl, dailyRecords };
  } catch {
    return { totalMl: 0, days: 1, dailyTarget: 2000, hourlyMl: {}, dailyMl: {}, dailyRecords: {} };
  }
}

interface SleepStats {
  logs: any[];
  recordDays: number;
  onTimeDays: number;
  totalDays: number;
  times: string[];
  timesByDate: Record<string, string>;
}

async function getSleepData(range: DateRange): Promise<SleepStats> {
  try {
    const logs = await healthDB.sleepLogs
      .where("date")
      .between(range.start, range.end, true, true)
      .toArray();
    const times = logs.map((l: any) => l.actualTime).filter(Boolean).sort();
    const timesByDate: Record<string, string> = {};
    for (const l of logs) {
      if (l.actualTime) timesByDate[l.date] = l.actualTime;
    }
    return {
      logs,
      recordDays: logs.length,
      onTimeDays: logs.filter((l: any) => l.isOnTime).length,
      totalDays: daysInRange(range.start, range.end),
      times,
      timesByDate,
    };
  } catch {
    return { logs: [], recordDays: 0, onTimeDays: 0, totalDays: 1, times: [], timesByDate: {} };
  }
}

interface FitnessStats {
  sessions: any[];
  sessionDays: number;
  totalSessions: number;
  days: number;
  byDate: Record<string, number>;
}

async function getFitnessData(range: DateRange): Promise<FitnessStats> {
  try {
    const sessions = await healthDB.workoutSessions
      .where("date")
      .between(range.start, range.end, true, true)
      .toArray();
    const byDate: Record<string, number> = {};
    for (const s of sessions) {
      byDate[s.date] = (byDate[s.date] || 0) + 1;
    }
    return {
      sessions,
      sessionDays: new Set(sessions.map((s: any) => s.date)).size,
      totalSessions: sessions.length,
      days: daysInRange(range.start, range.end),
      byDate,
    };
  } catch {
    return { sessions: [], sessionDays: 0, totalSessions: 0, days: 1, byDate: {} };
  }
}

async function getFinanceData(range: DateRange) {
  try {
    const txns = await accountingDB.transactions
      .where("date")
      .between(range.start, range.end, true, true)
      .toArray();
    const expense = txns.filter((t: any) => t.type === "expense").reduce((s: number, t: any) => s + t.amount, 0);
    const income = txns.filter((t: any) => t.type === "income").reduce((s: number, t: any) => s + t.amount, 0);
    const byDate: Record<string, number> = {};
    for (const t of txns) {
      if (t.type === "expense") byDate[t.date] = (byDate[t.date] || 0) + t.amount;
    }
    return { expense, income, txns, byDate };
  } catch {
    return { expense: 0, income: 0, txns: [], byDate: {} };
  }
}

async function getDietData(range: DateRange) {
  try {
    const logs = await lifeDB.dietLogs
      .where("date")
      .between(range.start, range.end, true, true)
      .toArray();
    const days = daysInRange(range.start, range.end);
    const byDate: Record<string, number> = {};
    const byMealType: Record<string, number> = {};
    for (const l of logs) {
      byDate[l.date] = (byDate[l.date] || 0) + 1;
      if ((l as any).mealType) byMealType[(l as any).mealType] = (byMealType[(l as any).mealType] || 0) + 1;
    }
    return { logs, totalMeals: logs.length, logDays: new Set(logs.map(l => l.date)).size, days, byDate, byMealType };
  } catch {
    return { logs: [], totalMeals: 0, logDays: 0, days: 1, byDate: {}, byMealType: {} };
  }
}

async function getWellnessData(range: DateRange) {
  try {
    const logs = await lifeDB.wellnessLogs
      .where("date")
      .between(range.start, range.end, true, true)
      .toArray();
    return {
      logs,
      gongfa: logs.filter(l => l.type === "gongfa").length,
      tigang: logs.filter(l => l.type === "tigang").length,
      logDays: new Set(logs.map(l => l.date)).size,
      days: daysInRange(range.start, range.end),
    };
  } catch {
    return { logs: [], gongfa: 0, tigang: 0, logDays: 0, days: 1 };
  }
}

async function getPostureData(range: DateRange) {
  try {
    const logs = await healthDB.stretchLogs
      .where("date")
      .between(range.start, range.end, true, true)
      .toArray();
    return {
      logs,
      stretchDays: new Set(logs.map((l: any) => l.date)).size,
      totalSets: logs.reduce((s: number, l: any) => s + (l.sets || 0), 0),
      days: daysInRange(range.start, range.end),
    };
  } catch {
    return { logs: [], stretchDays: 0, totalSets: 0, days: 1 };
  }
}

async function getScheduleData(range: DateRange) {
  try {
    const items = await daylogDB.items
      .where("date")
      .between(range.start, range.end, true, true)
      .toArray();
    const total = items.length;
    const completed = items.filter((i: any) => i.isCompleted).length;
    const corrected = items.filter((i: any) => i.isCorrected).length;
    const byDate: Record<string, { total: number; completed: number }> = {};
    for (const item of items) {
      if (!byDate[item.date]) byDate[item.date] = { total: 0, completed: 0 };
      byDate[item.date].total++;
      if (item.isCompleted) byDate[item.date].completed++;
    }
    return { items, total, completed, corrected, byDate, days: daysInRange(range.start, range.end) };
  } catch {
    return { items: [], total: 0, completed: 0, corrected: 0, byDate: {}, days: 1 };
  }
}

async function getGoalsData(range: DateRange) {
  try {
    const goals = await goalV2DB.goalV2Goals.toArray();
    const activeGoals = goals.filter(g => g.status === "active" || !g.status);
    const dailyActions = await goalV2DB.goalV2DailyActions
      .where("date")
      .between(range.start, range.end, true, true)
      .toArray();
    const totalDA = dailyActions.length;
    const completedDA = dailyActions.filter(a => a.isCompleted).length;
    const daRate = totalDA > 0 ? Math.round((completedDA / totalDA) * 100) : 0;
    const allKRs = await goalV2DB.goalV2KeyResults.toArray();
    let krProgress = 0;
    let krCount = 0;
    for (const kr of allKRs) {
      if (kr.targetValue > 0) {
        krProgress += Math.min(100, Math.round((kr.currentValue / kr.targetValue) * 100));
        krCount++;
      }
    }
    const avgKrProgress = krCount > 0 ? Math.round(krProgress / krCount) : 0;
    return { activeGoals: activeGoals.length, totalDA, completedDA, daRate, avgKrProgress };
  } catch {
    return { activeGoals: 0, totalDA: 0, completedDA: 0, daRate: 0, avgKrProgress: 0 };
  }
}

// ============================================================
// 洞察生成器
// ============================================================

interface FindingBuilder {
  add(finding: ReviewFinding): void;
  getAll(): ReviewFinding[];
  getTop(n: number): ReviewFinding[];
}

function createFindingBuilder(): FindingBuilder {
  const findings: ReviewFinding[] = [];
  let idCounter = 0;
  return {
    add(f) {
      findings.push({ ...f, id: `f_${idCounter++}` });
    },
    getAll() {
      return [...findings].sort((a, b) => b.priority - a.priority);
    },
    getTop(n) {
      return this.getAll().slice(0, n);
    },
  };
}

function trendFromRate(rate: number): "up" | "down" | "stable" {
  if (rate >= 80) return "up";
  if (rate >= 50) return "stable";
  return "down";
}

function trendFromChange(change: number): "up" | "down" | "stable" {
  if (change > 5) return "up";
  if (change < -5) return "down";
  return "stable";
}

// ============================================================
// 统一复盘引擎
// ============================================================

class UnifiedReviewer {
  async generateReview(period: ReviewPeriod = "weekly", offset: number = 0): Promise<ReviewResult> {
    const dateRange = getDateRange(period, offset);
    const prevRange = getDateRange(period, offset + 1);
    const prev2Range = getDateRange(period, offset + 2);
    const prev3Range = getDateRange(period, offset + 3);

    // 采集当前周期数据
    const [
      water, prevWater,
      sleep, prevSleep,
      fitness, prevFitness,
      finance, prevFinance,
      diet, prevDiet,
      wellness, prevWellness,
      posture, prevPosture,
      schedule, prevSchedule,
      goals, prevGoals,
    ] = await this._fetchAllData(dateRange, prevRange);

    // 生成旧格式摘要（向后兼容）
    const summaries = await this._buildSummaries(dateRange);

    // 生成洞察
    const fb = createFindingBuilder();
    this._analyzeWater(fb, water, prevWater, period);
    this._analyzeSleep(fb, sleep, prevSleep, period);
    this._analyzeFitness(fb, fitness, prevFitness, period);
    this._analyzeFinance(fb, finance, prevFinance, period);
    this._analyzeDiet(fb, diet, prevDiet, period);
    this._analyzeWellness(fb, wellness, prevWellness, period);
    this._analyzePosture(fb, posture, prevPosture, period);
    this._analyzeSchedule(fb, schedule, prevSchedule, period);
    this._analyzeGoals(fb, goals, prevGoals, period);

    // 跨模块关联
    this._analyzeCrossModule(fb, { water, sleep, fitness, diet }, period);

    const allFindings = fb.getAll();
    const suggestions = this._generateSuggestions(allFindings, period);
    const insights = this._buildModuleInsights(allFindings, period);
    const headline = this._buildHeadline(allFindings, period);
    const overviewText = this._buildOverview(summaries, period);
    const hasData = allFindings.some(f => f.priority > 0);

    return {
      period,
      dateRange,
      headline,
      overviewText,
      summaries,
      insights,
      allFindings,
      suggestions,
      hasData,
    };
  }

  async getHistoricalReviews(period: ReviewPeriod, count: number = 4): Promise<ReviewResult[]> {
    const results: ReviewResult[] = [];
    for (let i = 0; i < count; i++) {
      results.push(await this.generateReview(period, i));
    }
    return results;
  }

  // ────────────── 数据采集 ──────────────

  private async _fetchAllData(range: DateRange, prevRange: DateRange) {
    return await Promise.all([
      getWaterData(range), getWaterData(prevRange),
      getSleepData(range), getSleepData(prevRange),
      getFitnessData(range), getFitnessData(prevRange),
      getFinanceData(range), getFinanceData(prevRange),
      getDietData(range), getDietData(prevRange),
      getWellnessData(range), getWellnessData(prevRange),
      getPostureData(range), getPostureData(prevRange),
      getScheduleData(range), getScheduleData(prevRange),
      getGoalsData(range), getGoalsData(prevRange),
    ]);
  }

  // ────────────── 模块分析 ──────────────

  private _analyzeWater(
    fb: FindingBuilder, water: WaterStats, prevWater: WaterStats, period: ReviewPeriod,
  ) {
    if (water.totalMl === 0) return;

    // 达标率：每日实际 ml ≥ 每日目标 的天数占比
    const activeDays = Object.keys(water.dailyMl).length;
    const okDays = Object.entries(water.dailyMl).filter(([, ml]) => (ml || 0) >= water.dailyTarget).length;
    const rate = activeDays > 0 ? Math.round((okDays / activeDays) * 100) : 0;
    const prevActiveDays = Object.keys(prevWater.dailyMl).length;
    const prevOkDays = Object.entries(prevWater.dailyMl).filter(([, ml]) => (ml || 0) >= prevWater.dailyTarget).length;
    const prevRate = prevActiveDays > 0 ? Math.round((prevOkDays / prevActiveDays) * 100) : 0;
    const change = rate - prevRate;
    const mlDiff = water.totalMl - prevWater.totalMl;

    // 趋势
    fb.add({
      id: "",
      module: "water",
      moduleLabel: "饮水",
      type: change >= 0 ? "improvement" : "decline",
      title: pick(["饮水达标率", "喝水达标情况", "水分摄入趋势"]),
      description: pick([
        `${periodLabel(period)}饮水达标率 ${rate}%（每日 ${water.dailyTarget}ml）${change !== 0 ? `，${change > 0 ? "比" + periodLabelPrev(period) + "提升" : "比" + periodLabelPrev(period) + "下降"} ${Math.abs(change)}%` : ""}。`,
        `喝水达标 ${rate}%${mlDiff !== 0 ? `，总摄入 ${mlDiff > 0 ? "增加" : "减少"} ${Math.abs(mlDiff)}ml` : "，和上周差不多"}。`,
      ]),
      metric: { current: water.totalMl, previous: prevWater.totalMl, changePercent: mlDiff, unit: "ml" },
      trend: trendFromRate(rate),
      priority: Math.abs(change) + (rate < 50 ? 20 : 0) + (rate >= 80 ? 5 : 0),
    });

    // 饮水薄弱时段（小时摄入显著偏低）
    const hourEntries = Object.entries(water.hourlyMl);
    const avgHourly = water.totalMl / Math.max(1, activeDays * 10);
    const holeHours: string[] = [];
    for (let h = 6; h <= 22; h++) {
      const hh = String(h).padStart(2, "0");
      const ml = water.hourlyMl[hh] || 0;
      if (ml > 0 && avgHourly > 0 && ml / activeDays < avgHourly * 0.3) {
        holeHours.push(`${hh}:00`);
      }
    }
    if (holeHours.length > 0) {
      fb.add({
        id: "",
        module: "water",
        moduleLabel: "饮水",
        type: "pattern",
        title: "饮水薄弱时段",
        description: pick([
          `你容易在 ${holeHours.slice(0, 3).join("、")} 时段忘记喝水，建议在这些时段补充水分。`,
          `${holeHours.slice(0, 3).join("、")} 是你的饮水薄弱时段，试着在这些时刻喝一杯。`,
        ]),
        trend: "down",
        priority: 30 + holeHours.length * 5,
        action: "可在饮水页查看三时段目标，按时段补充饮水",
      });
    }

    // 达标天数偏低
    if (activeDays > 0) {
      const okRate = Math.round((okDays / activeDays) * 100);
      if (okRate < 50) {
        fb.add({
          id: "",
          module: "water",
          moduleLabel: "饮水",
          type: "pattern",
          title: "达标天数偏低",
          description: pick([
            `${activeDays} 天中只有 ${okDays} 天达到 ${water.dailyTarget}ml 目标，需要提高饮水意识。`,
            `喝水的天数还不够，${activeDays} 天里仅 ${okDays} 天达标。`,
          ]),
          trend: "down",
          priority: 25,
          action: "在饮水页按上午/下午/晚上时段目标分时补充",
        });
      }
    }
  }

  private _analyzeSleep(
    fb: FindingBuilder, sleep: SleepStats, prevSleep: SleepStats, period: ReviewPeriod,
  ) {
    if (sleep.recordDays === 0) return;

    const rate = sleep.recordDays > 0 ? Math.round((sleep.onTimeDays / sleep.recordDays) * 100) : 0;
    const prevRate = prevSleep.recordDays > 0 ? Math.round((prevSleep.onTimeDays / prevSleep.recordDays) * 100) : 0;
    const change = rate - prevRate;

    // 趋势
    fb.add({
      id: "",
      module: "sleep",
      moduleLabel: "睡眠",
      type: change >= 0 ? "improvement" : "decline",
      title: pick(["早睡达标率", "入睡时间规律性", "睡眠质量趋势"]),
      description: pick([
        `${periodLabel(period)}早睡达标率 ${rate}%${change !== 0 ? `，${change > 0 ? "比上周进步" : "比上周退步"} ${Math.abs(change)}%` : ""}。`,
        `早睡打卡 ${rate}%${Math.abs(change) > 5 ? `，${change > 0 ? "有进步" : "需要调整"}` : "，和上周基本持平"}。`,
      ]),
      metric: { current: sleep.onTimeDays, previous: prevSleep.onTimeDays, changePercent: change, unit: "天" },
      trend: trendFromRate(rate),
      priority: Math.abs(change) + (rate < 50 ? 20 : 0),
    });

    // 入睡时间波动
    const times = sleep.times;
    if (times.length >= 3) {
      const minutes = times.map(t => {
        const [h, m] = t.split(":").map(Number);
        return h * 60 + m;
      });
      const mean = minutes.reduce((s, v) => s + v, 0) / minutes.length;
      const variance = minutes.reduce((s, v) => s + (v - mean) ** 2, 0) / minutes.length;
      const stddev = Math.sqrt(variance);
      const median = minutes[Math.floor(minutes.length / 2)];
      const medianH = Math.floor(median / 60);
      const medianM = median % 60;
      const medianStr = `${String(medianH).padStart(2, "0")}:${String(medianM).padStart(2, "0")}`;

      // 波动大
      if (stddev > 60) {
        fb.add({
          id: "",
          module: "sleep",
          moduleLabel: "睡眠",
          type: "pattern",
          title: "入睡时间波动较大",
          description: pick([
            `入睡时间标准差 ${Math.round(stddev)} 分钟，波动偏大。中位入睡时间 ${medianStr}，建议固定作息。`,
            `睡觉时间不太规律，有时早有时晚。中位入睡 ${medianStr}，试着固定一个时间。`,
          ]),
          trend: "down",
          priority: 25,
          action: "建议固定每晚的入睡时间",
        });
      } else {
        fb.add({
          id: "",
          module: "sleep",
          moduleLabel: "睡眠",
          type: "pattern",
          title: "入睡时间规律",
          description: pick([
            `入睡时间波动小（标准差 ${Math.round(stddev)} 分钟），作息很规律。中位入睡 ${medianStr}。`,
            `你的作息很规律，每晚入睡时间偏差不到 ${Math.round(stddev)} 分钟。`,
          ]),
          trend: "up",
          priority: 10,
        });
      }
    }

    // 周末 vs 工作日
    if (times.length >= 5) {
      const weekdayMinutes: number[] = [];
      const weekendMinutes: number[] = [];
      for (let i = 0; i < sleep.logs.length; i++) {
        const log: any = sleep.logs[i];
        if (!log.actualTime) continue;
        const d = new Date(log.date + "T00:00:00");
        const day = d.getDay();
        const [h, m] = log.actualTime.split(":").map(Number);
        const mins = h * 60 + m;
        if (day === 0 || day === 6) {
          weekendMinutes.push(mins);
        } else {
          weekdayMinutes.push(mins);
        }
      }
      if (weekdayMinutes.length > 0 && weekendMinutes.length > 0) {
        const wdAvg = weekdayMinutes.reduce((s, v) => s + v, 0) / weekdayMinutes.length;
        const weAvg = weekendMinutes.reduce((s, v) => s + v, 0) / weekendMinutes.length;
        const diff = weAvg - wdAvg;
        if (Math.abs(diff) > 30) {
          const wdH = Math.floor(wdAvg / 60);
          const wdM = Math.round(wdAvg % 60);
          const weH = Math.floor(weAvg / 60);
          const weM = Math.round(weAvg % 60);
          fb.add({
            id: "",
            module: "sleep",
            moduleLabel: "睡眠",
            type: "pattern",
            title: "周末入睡偏晚",
            description: pick([
              `工作日晚 ${String(wdH).padStart(2, "0")}:${String(wdM).padStart(2, "0")} 入睡，周末晚至 ${String(weH).padStart(2, "0")}:${String(weM).padStart(2, "0")}，周末平均晚 ${Math.round(diff)} 分钟。`,
              `社交时差约 ${Math.round(diff)} 分钟——周末比工作日晚睡 ${Math.round(diff)} 分钟。`,
            ]),
            trend: diff > 30 ? "down" : "stable",
            priority: diff > 60 ? 20 : 10,
            action: "周末也尽量保持工作日的作息节奏",
          });
        }
      }
    }
  }

  private _analyzeFitness(
    fb: FindingBuilder, fitness: FitnessStats, prevFitness: FitnessStats, period: ReviewPeriod,
  ) {
    if (fitness.totalSessions === 0) return;

    const change = fitness.sessionDays - prevFitness.sessionDays;
    const targetDays = Math.ceil(fitness.days / 2);
    const rate = Math.min(100, Math.round((fitness.sessionDays / targetDays) * 100));

    fb.add({
      id: "",
      module: "fitness",
      moduleLabel: "训练",
      type: change >= 0 ? "improvement" : "decline",
      title: pick(["训练频次", "运动习惯", "训练天数"]),
      description: pick([
        `${periodLabel(period)}训练 ${fitness.sessionDays} 天，共 ${fitness.totalSessions} 次${change !== 0 ? `，比${periodLabelPrev(period)}${change > 0 ? "多" : "少"} ${Math.abs(change)} 天` : ""}。`,
        `运动 ${fitness.sessionDays}/${targetDays} 天达标${fitness.sessionDays >= targetDays ? "，达标了！" : ""}`,
      ]),
      metric: { current: fitness.sessionDays, previous: prevFitness.sessionDays, changePercent: change / Math.max(1, prevFitness.sessionDays) * 100, unit: "天" },
      trend: trendFromRate(rate),
      priority: Math.abs(change) * 3 + (rate >= 80 ? 10 : 0) + (rate < 40 ? 15 : 0),
    });

    // 训练间隔分析
    const sortedDates = Object.keys(fitness.byDate).sort();
    if (sortedDates.length >= 3) {
      const gaps: number[] = [];
      for (let i = 1; i < sortedDates.length; i++) {
        const d1 = new Date(sortedDates[i - 1] + "T00:00:00");
        const d2 = new Date(sortedDates[i] + "T00:00:00");
        gaps.push((d2.getTime() - d1.getTime()) / 86400000);
      }
      const maxGap = Math.max(...gaps);
      if (maxGap >= 3) {
        fb.add({
          id: "",
          module: "fitness",
          moduleLabel: "训练",
          type: "pattern",
          title: "训练间隔过长",
          description: pick([
            `最长间隔 ${maxGap} 天没有训练，建议保持每 2 天一次的节奏。`,
            `训练间隔最长达 ${maxGap} 天，中间断档太久容易退步。`,
          ]),
          trend: "down",
          priority: 20,
          action: "建议保持每 2 天一次的训练节奏",
        });
      }
    }
  }

  private _analyzeFinance(
    fb: FindingBuilder, finance: any, prevFinance: any, period: ReviewPeriod,
  ) {
    if (finance.txns.length === 0) return;

    const balance = finance.income - finance.expense;
    const prevBalance = prevFinance.income - prevFinance.expense;
    const change = balance - prevBalance;

    fb.add({
      id: "",
      module: "finance",
      moduleLabel: "记账",
      type: balance >= 0 ? "improvement" : "decline",
      title: pick(["财务状况", "收支结余", "消费趋势"]),
      description: pick([
        `${periodLabel(period)}结余 ${balance >= 0 ? "+" : ""}${balance.toFixed(0)} 元${change !== 0 ? `，比${periodLabelPrev(period)}${change > 0 ? "多" : "少"} ${Math.abs(change).toFixed(0)} 元` : ""}。`,
        `收入 ${finance.income.toFixed(0)} 元，支出 ${finance.expense.toFixed(0)} 元，${balance >= 0 ? "收支平衡" : "入不敷出"}。`,
      ]),
      metric: { current: balance, previous: prevBalance, changePercent: prevBalance !== 0 ? ((balance - prevBalance) / Math.abs(prevBalance)) * 100 : 0, unit: "元" },
      trend: balance >= 0 ? "up" : "down",
      priority: Math.abs(change) > 0 ? Math.min(40, Math.abs(change) / 50) : 5,
    });

    // 消费高峰日
    const expenseDays = Object.entries(finance.byDate);
    if (expenseDays.length >= 3) {
      const sorted = expenseDays.sort((a: any, b: any) => b[1] - a[1]);
      const topDay = sorted[0];
      const totalExpense = finance.expense;
      if (totalExpense > 0 && (topDay[1] as number) / totalExpense > 0.4) {
        fb.add({
          id: "",
          module: "finance",
          moduleLabel: "记账",
          type: "pattern",
          title: "单日消费偏高",
          description: pick([
            `${topDay[0]} 消费 ¥${(topDay[1] as number).toFixed(0)}，占 ${periodLabel(period)}总支出的 ${Math.round((topDay[1] as number) / totalExpense * 100)}%。`,
            `某一天消费占比过大：${topDay[0]} 花了 ¥${(topDay[1] as number).toFixed(0)}（占 ${Math.round((topDay[1] as number) / totalExpense * 100)}%）。`,
          ]),
          trend: "down",
          priority: 15,
          action: "注意控制大额消费的频率",
        });
      }
    }
  }

  private _analyzeDiet(
    fb: FindingBuilder, diet: any, prevDiet: any, period: ReviewPeriod,
  ) {
    if (diet.logs.length === 0) return;

    const avgMeals = diet.days > 0 ? (diet.totalMeals / diet.days).toFixed(1) : "0";
    const prevAvg = prevDiet.days > 0 ? (prevDiet.totalMeals / prevDiet.days).toFixed(1) : "0";
    const change = parseFloat(avgMeals) - parseFloat(prevAvg);

    fb.add({
      id: "",
      module: "diet",
      moduleLabel: "饮食",
      type: change >= 0 ? "improvement" : "decline",
      title: pick(["饮食记录", "餐食规律性", "饮食打卡"]),
      description: pick([
        `${periodLabel(period)}日均 ${avgMeals} 餐，记录了 ${diet.logDays}/${diet.days} 天${Math.abs(change) > 0.3 ? `，比${periodLabelPrev(period)}${change > 0 ? "多" : "少"} ${Math.abs(change).toFixed(1)} 餐/天` : ""}。`,
        `饮食记录 ${diet.logDays} 天，共 ${diet.totalMeals} 餐，日均 ${avgMeals} 餐。`,
      ]),
      metric: { current: parseFloat(avgMeals), previous: parseFloat(prevAvg), changePercent: change * 25, unit: "餐/天" },
      trend: parseFloat(avgMeals) >= 2.5 ? "up" : "stable",
      priority: Math.abs(change) * 5,
    });

    // 漏餐模式
    const missingMeals: string[] = [];
    const expected = ["breakfast", "lunch", "dinner"];
    for (const mt of expected) {
      if (!diet.byMealType[mt] || diet.byMealType[mt] < diet.logDays * 0.5) {
        const names: Record<string, string> = { breakfast: "早餐", lunch: "午餐", dinner: "晚餐" };
        missingMeals.push(names[mt] || mt);
      }
    }
    if (missingMeals.length > 0) {
      fb.add({
        id: "",
        module: "diet",
        moduleLabel: "饮食",
        type: "pattern",
        title: "漏餐提醒",
        description: pick([
          `经常漏掉 ${missingMeals.join("和")}，试着固定三餐时间。`,
          `${missingMeals.join("和")}的记录率较低，别忘了按时吃饭。`,
        ]),
        trend: "down",
        priority: missingMeals.length >= 2 ? 20 : 10,
        action: `注意记录 ${missingMeals.join("和")}`,
      });
    }
  }

  private _analyzeWellness(
    fb: FindingBuilder, wellness: any, prevWellness: any, period: ReviewPeriod,
  ) {
    if (wellness.logs.length === 0) return;

    const total = wellness.gongfa + wellness.tigang;
    const prevTotal = prevWellness.gongfa + prevWellness.tigang;
    const change = total - prevTotal;

    fb.add({
      id: "",
      module: "wellness",
      moduleLabel: "养生",
      type: change >= 0 ? "improvement" : "decline",
      title: "养生打卡",
      description: pick([
        `${periodLabel(period)}养生练习 ${total} 次（功法 ${wellness.gongfa} · 提肛 ${wellness.tigang}），${wellness.logDays} 天有记录。`,
        `养生打卡 ${wellness.logDays} 天，共完成 ${total} 次练习。`,
      ]),
      metric: { current: total, previous: prevTotal, changePercent: prevTotal > 0 ? ((total - prevTotal) / prevTotal) * 100 : 0, unit: "次" },
      trend: total > 0 ? "up" : "stable",
      priority: Math.abs(change) * 2 + (total >= 5 ? 5 : 0),
    });
  }

  private _analyzePosture(
    fb: FindingBuilder, posture: any, prevPosture: any, period: ReviewPeriod,
  ) {
    if (posture.stretchDays === 0) return;

    const change = posture.stretchDays - prevPosture.stretchDays;
    const rate = Math.min(100, Math.round((posture.stretchDays / posture.days) * 100));

    fb.add({
      id: "",
      module: "posture",
      moduleLabel: "体态拉伸",
      type: change >= 0 ? "improvement" : "decline",
      title: pick(["拉伸天数", "体态练习", "拉伸习惯"]),
      description: pick([
        `${periodLabel(period)}拉伸 ${posture.stretchDays} 天，共 ${posture.totalSets} 组${change !== 0 ? `，${change > 0 ? "比上周多" : "比上周少"} ${Math.abs(change)} 天` : ""}。`,
        `体态拉伸 ${posture.stretchDays}/${posture.days} 天${rate >= 50 ? "，达标了" : "，还需提升"}。`,
      ]),
      metric: { current: posture.stretchDays, previous: prevPosture.stretchDays, changePercent: change / Math.max(1, prevPosture.stretchDays) * 100, unit: "天" },
      trend: trendFromRate(rate),
      priority: Math.abs(change) * 3 + (rate >= 50 ? 5 : 15),
    });
  }

  private _analyzeSchedule(
    fb: FindingBuilder, schedule: any, prevSchedule: any, period: ReviewPeriod,
  ) {
    if (schedule.total === 0) return;

    const rate = schedule.total > 0 ? Math.round((schedule.completed / schedule.total) * 100) : 0;
    const prevRate = prevSchedule.total > 0 ? Math.round((prevSchedule.completed / prevSchedule.total) * 100) : 0;
    const change = rate - prevRate;

    fb.add({
      id: "",
      module: "schedule",
      moduleLabel: "日程",
      type: change >= 0 ? "improvement" : "decline",
      title: "日程完成率",
      description: pick([
        `${periodLabel(period)}日程完成率 ${rate}%（${schedule.completed}/${schedule.total}）${change !== 0 ? `，${change > 0 ? "比上周提升" : "比上周下降"} ${Math.abs(change)}%` : ""}。`,
        `计划完成 ${schedule.completed}/${schedule.total} 项，完成率 ${rate}%。`,
      ]),
      metric: { current: schedule.completed, previous: prevSchedule.completed, changePercent: change, unit: "项" },
      trend: trendFromRate(rate),
      priority: Math.abs(change) + (rate < 50 ? 20 : 0) + (rate >= 80 ? 10 : 0),
    });

    // 哪一天最拉胯
    const worstDay = Object.entries(schedule.byDate)
      .map(([d, v]: any) => ({ date: d, rate: v.total > 0 ? v.completed / v.total : 1 }))
      .sort((a, b) => a.rate - b.rate)[0];
    if (worstDay && worstDay.rate < 0.5) {
      fb.add({
        id: "",
        module: "schedule",
        moduleLabel: "日程",
        type: "pattern",
        title: "效率低谷日",
        description: pick([
          `${worstDay.date} 完成率仅 ${Math.round(worstDay.rate * 100)}%，是${periodLabel(period)}效率最低的一天。`,
          `某天完成率偏低：${worstDay.date} 只完成了 ${Math.round(worstDay.rate * 100)}% 的计划。`,
        ]),
        trend: "down",
        priority: 15,
        action: "回顾那天是否有特殊情况影响效率",
      });
    }
  }

  private _analyzeGoals(
    fb: FindingBuilder, goals: any, prevGoals: any, period: ReviewPeriod,
  ) {
    if (goals.activeGoals === 0 && goals.totalDA === 0) return;

    const change = goals.daRate - prevGoals.daRate;

    fb.add({
      id: "",
      module: "goals",
      moduleLabel: "目标",
      type: change >= 0 ? "improvement" : "decline",
      title: "目标行动力",
      description: pick([
        `${periodLabel(period)}日行动完成率 ${goals.daRate}%（${goals.completedDA}/${goals.totalDA}）${change !== 0 ? `，${change > 0 ? "比上周进步" : "比上周退步"} ${Math.abs(change)}%` : ""}。`,
        `目标推进：完成 ${goals.completedDA}/${goals.totalDA} 个日行动，${goals.activeGoals} 个进行中的目标。`,
      ]),
      metric: { current: goals.completedDA, previous: prevGoals.completedDA, changePercent: change, unit: "项" },
      trend: trendFromRate(goals.daRate),
      priority: Math.abs(change) + (goals.daRate < 50 ? 20 : 0) + (goals.daRate >= 80 ? 10 : 0) + goals.activeGoals * 3,
    });

    if (goals.avgKrProgress > 0) {
      fb.add({
        id: "",
        module: "goals",
        moduleLabel: "目标",
        type: "milestone",
        title: "关键结果进展",
        description: `关键结果平均进度 ${goals.avgKrProgress}%${goals.avgKrProgress >= 50 ? "，过半了！" : "，还需推进"}。`,
        metric: { current: goals.avgKrProgress, previous: 0, changePercent: 0, unit: "%" },
        trend: goals.avgKrProgress >= 50 ? "up" : "stable",
        priority: 15,
      });
    }
  }

  // ────────────── 跨模块关联 ──────────────

  private _analyzeCrossModule(
    fb: FindingBuilder,
    data: { water: WaterStats; sleep: SleepStats; fitness: FitnessStats; diet: any },
    period: ReviewPeriod,
  ) {
    // 饮水 vs 睡眠：喝水达标日的入睡时间
    const waterOkDates = new Set(
      Object.entries(data.water.dailyMl)
        .filter(([, ml]) => (ml || 0) >= data.water.dailyTarget)
        .map(([d]) => d),
    );
    const waterNotOkDates = new Set(
      Object.entries(data.water.dailyMl)
        .filter(([, ml]) => (ml || 0) > 0 && (ml || 0) < data.water.dailyTarget)
        .map(([d]) => d),
    );

    let okSleepMins: number[] = [];
    let notOkSleepMins: number[] = [];

    for (const [date, time] of Object.entries(data.sleep.timesByDate)) {
      if (!time) continue;
      const [h, m] = time.split(":").map(Number);
      const mins = h * 60 + m;
      if (waterOkDates.has(date)) okSleepMins.push(mins);
      else if (waterNotOkDates.has(date)) notOkSleepMins.push(mins);
    }

    if (okSleepMins.length >= 2 && notOkSleepMins.length >= 2) {
      const okAvg = okSleepMins.reduce((s, v) => s + v, 0) / okSleepMins.length;
      const notOkAvg = notOkSleepMins.reduce((s, v) => s + v, 0) / notOkSleepMins.length;
      const diff = notOkAvg - okAvg;
      if (diff > 20) {
        const okH = Math.floor(okAvg / 60);
        const okM = Math.round(okAvg % 60);
        const notOkH = Math.floor(notOkAvg / 60);
        const notOkM = Math.round(notOkAvg % 60);
        fb.add({
          id: "",
          module: "water",
          moduleLabel: "饮水",
          type: "correlation",
          title: "喝水与睡眠的关联",
          description: pick([
            `喝水达标的日子，入睡时间约 ${String(okH).padStart(2, "0")}:${String(okM).padStart(2, "0")}；喝不够的日子，入睡时间推迟到 ${String(notOkH).padStart(2, "0")}:${String(notOkM).padStart(2, "0")}。多喝水也许有助于早睡。`,
            `发现一个有趣的关联：喝水充足的日子入睡平均早 ${Math.round(diff)} 分钟。`,
          ]),
          trend: diff > 20 ? "down" : "stable",
          priority: 35,
          action: "保持饮水达标可能有助于改善睡眠",
        });
      }
    }
  }

  // ────────────── 行动建议 ──────────────

  private _generateSuggestions(findings: ReviewFinding[], period: ReviewPeriod): string[] {
    const suggestions: string[] = [];
    const lowPriorityFindings = findings.filter(f => f.priority >= 15 && f.type !== "milestone" && f.type !== "improvement");

    for (const f of lowPriorityFindings.slice(0, 5)) {
      if (f.action) {
        suggestions.push(f.action);
      } else {
        switch (f.module) {
          case "water":
            suggestions.push(pick(["每天设置几个固定的喝水时间", "在手机旁放一杯水提醒自己喝水"]));
            break;
          case "sleep":
            suggestions.push(pick(["试着固定每晚的睡觉时间", "睡前 1 小时远离屏幕"]));
            break;
          case "fitness":
            suggestions.push(pick(["保持每 2 天训练一次的节奏", "把训练安排在固定时间段更容易坚持"]));
            break;
          case "finance":
            suggestions.push(pick(["留意大额消费的频率", "每周给自己一个消费额度上限"]));
            break;
          case "diet":
            suggestions.push(pick(["固定三餐时间有助于规律饮食", "提前准备第二天的餐食"]));
            break;
          case "posture":
            suggestions.push(pick(["每小时提醒自己站起来拉伸一下", "设置定时闹钟做体态练习"]));
            break;
          case "schedule":
            suggestions.push(pick(["前一天晚上列好第二天的任务清单", "把最重要的任务放在上午处理"]));
            break;
          case "goals":
            suggestions.push(pick(["每天早晨先完成一个日行动再处理其他事", "把大目标拆成每天可执行的小步骤"]));
            break;
        }
      }
    }

    // 去重
    return [...new Set(suggestions)].slice(0, 4);
  }

  // ────────────── 模块洞察聚合 ──────────────

  private _buildModuleInsights(findings: ReviewFinding[], period: ReviewPeriod): ModuleInsight[] {
    const byModule = new Map<string, ReviewFinding[]>();
    for (const f of findings) {
      const arr = byModule.get(f.module) || [];
      arr.push(f);
      byModule.set(f.module, arr);
    }

    const insights: ModuleInsight[] = [];
    for (const [module, moduleFindings] of byModule) {
      const top = moduleFindings[0];
      const changePct = top.metric ? top.metric.changePercent : 0;
      insights.push({
        module,
        moduleLabel: top.moduleLabel,
        icon: MODULE_ICONS[module] || "Circle",
        color: MODULE_COLORS[module] || "#6B7280",
        headline: top.title + (top.trend === "up" ? " ↑" : top.trend === "down" ? " ↓" : " →"),
        detail: top.description,
        trend: top.trend,
        changePercent: changePct,
        hasData: true,
        findings: moduleFindings,
      });
    }

    // 按最高 priority 排序
    insights.sort((a, b) => {
      const aMax = Math.max(...a.findings.map(f => f.priority), 0);
      const bMax = Math.max(...b.findings.map(f => f.priority), 0);
      return bMax - aMax;
    });

    return insights;
  }

  // ────────────── 大标题 ──────────────

  private _buildHeadline(findings: ReviewFinding[], period: ReviewPeriod): string {
    const label = periodLabel(period);
    const withData = findings.filter(f => f.priority > 0);
    if (withData.length === 0) return `${label}刚开始，一切都有可能。`;

    // 选优先级最高的第一个发现
    const top = withData[0];
    const improvements = withData.filter(f => f.trend === "up" && f.priority >= 10);
    const declines = withData.filter(f => f.trend === "down" && f.priority >= 15);

    if (improvements.length >= 3 && declines.length === 0) {
      return pick([
        `${label}状态非常好，多个模块都在向好发展。`,
        `势头不错！${label}多个维度都看到了进步。`,
      ]);
    }

    if (declines.length >= 2 && improvements.length === 0) {
      return pick([
        `${label}有几个模块需要关注，好在现在调整还来得及。`,
        `${label}一些维度在下滑，看看哪里出了问题。`,
      ]);
    }

    if (improvements.length > 0 && declines.length > 0) {
      return `${label}有亮点也有短板，${improvements[0].moduleLabel}不错，${declines[0].moduleLabel}需要关注。`;
    }

    if (top.trend === "down") {
      return `${label}${top.description.replace(/[。！]/, "").slice(0, 20)}`;
    }

    return `${label}一切如常，保持节奏。`;
  }

  // ────────────── 旧格式（向后兼容） ──────────────

  private async _buildSummaries(range: DateRange): Promise<ReviewModuleSummary[]> {
    const o = new _OldReviewer();
    return await o.generateSummaries(range);
  }

  // ⚠️ 以下方法为旧版 ReviewerBrain 公开 API 的兼容存根，
  // 供 src/app/more/review/finance/page.tsx 等页面使用。
  // 新代码请直接使用 generateReview。

  /** @deprecated 使用 generateReview 替代 */
  async reviewFinance(range: DateRange): Promise<ReviewModuleSummary> {
    const o = new _OldReviewer();
    return await o._reviewFinance(range);
  }

  /** @deprecated 使用 generateReview 替代 */
  async reviewSchedule(range: DateRange): Promise<ReviewModuleSummary> {
    const o = new _OldReviewer();
    return await o._reviewSchedule(range);
  }

  private _buildOverview(summaries: ReviewModuleSummary[], period: string): string {
    const periodLabel = period === "daily" ? "昨日" : period === "weekly" ? "本周" : period === "monthly" ? "本月" : "今年";
    const parts: string[] = [];

    for (const s of summaries) {
      if (!s.stats || Object.keys(s.stats).length === 0) continue;
      switch (s.module) {
        case "goals":
          parts.push(`${s.stats["进行中目标"] || 0} 个目标, 日行动完成率 ${s.stats["完成率"] || "0%"}`);
          break;
        case "finance":
          parts.push(`支出 ${s.stats["支出"] || 0}`);
          break;
        case "water":
          parts.push(`饮水 ${s.stats["达标天数"] || "0/0"}`);
          break;
        case "sleep":
          parts.push(`早睡 ${s.stats["达标率"] || "0%"}`);
          break;
        case "fitness":
          parts.push(`训练 ${s.stats["训练天数"] || "0/0"}`);
          break;
        case "diet":
          parts.push(`饮食 ${s.stats["记录天数"] || "0/0"}`);
          break;
        case "wellness":
          parts.push(`养生 ${s.stats["记录天数"] || "0/0"}`);
          break;
        case "posture":
          parts.push(`拉伸 ${s.stats["拉伸天数"] || "0/0"}`);
          break;
        case "schedule":
          parts.push(`日程完成率 ${s.stats["完成率"] || "0%"}`);
          break;
        case "medication":
          parts.push(`服药 ${s.stats["依从率"] || "0%"}`);
          break;
      }
    }

    if (parts.length === 0) return `${periodLabel}暂无数据。`;
    return `${periodLabel}概况：${parts.join(" · ")}。`;
  }
}

// ════════════════════════════════════════════════════════════════
// 旧 Reviewer — 仅用于向后兼容 _buildSummaries
// ════════════════════════════════════════════════════════════════

class _OldReviewer {
  async generateSummaries(range: DateRange): Promise<ReviewModuleSummary[]> {
    return Promise.all([
      this._reviewGoals(range),
      this._reviewFinance(range),
      this._reviewWater(range),
      this._reviewSleep(range),
      this._reviewFitness(range),
      this._reviewDiet(range),
      this._reviewWellness(range),
      this._reviewPosture(range),
      this._reviewSchedule(range),
      this._reviewMedication(range),
    ]);
  }

  private async _reviewGoals(range: DateRange): Promise<ReviewModuleSummary> {
    try {
      const goals = await goalV2DB.goalV2Goals.toArray();
      const activeGoals = goals.filter(g => g.status === "active" || !g.status);
      const dailyActions = await goalV2DB.goalV2DailyActions
        .where("date").between(range.start, range.end, true, true).toArray();
      const totalDA = dailyActions.length;
      const completedDA = dailyActions.filter(a => a.isCompleted).length;
      const daRate = totalDA > 0 ? Math.round((completedDA / totalDA) * 100) : 0;
      const allKRs = await goalV2DB.goalV2KeyResults.toArray();
      let krProgress = 0, krCount = 0;
      for (const kr of allKRs) {
        if (kr.targetValue > 0) { krProgress += Math.min(100, Math.round((kr.currentValue / kr.targetValue) * 100)); krCount++; }
      }
      const avgKrProgress = krCount > 0 ? Math.round(krProgress / krCount) : 0;
      return {
        module: "goals", icon: "Target", label: "目标",
        stats: { "进行中目标": activeGoals.length, "日行动完成": `${completedDA}/${totalDA}`, "完成率": `${daRate}%`, "关键结果进度": avgKrProgress > 0 ? `${avgKrProgress}%` : "暂无" },
        highlights: [
          { module: "goals", label: "日行动完成率", value: `${daRate}%`, trend: daRate >= 80 ? "up" : daRate >= 50 ? "stable" : "down" },
          ...(avgKrProgress > 0 ? [{ module: "goals" as const, label: "关键结果平均进度" as const, value: `${avgKrProgress}%` as const, trend: (avgKrProgress >= 50 ? "up" : avgKrProgress >= 25 ? "stable" : "down") as "up" | "down" | "stable" }] : []),
        ],
      };
    } catch { return { module: "goals", icon: "Target", label: "目标", stats: {}, highlights: [] }; }
  }

  public async _reviewFinance(range: DateRange): Promise<ReviewModuleSummary> {
    try {
      const txns = await accountingDB.transactions.where("date").between(range.start, range.end, true, true).toArray();
      const income = txns.filter((t: any) => t.type === "income").reduce((s: number, t: any) => s + t.amount, 0);
      const expense = txns.filter((t: any) => t.type === "expense").reduce((s: number, t: any) => s + t.amount, 0);
      return {
        module: "finance", icon: "Wallet", label: "记账",
        stats: { "收入": `¥${income.toFixed(0)}`, "支出": `¥${expense.toFixed(0)}`, "结余": `¥${(income - expense).toFixed(0)}`, "交易笔数": txns.length },
        highlights: [],
      };
    } catch { return { module: "finance", icon: "Wallet", label: "记账", stats: {}, highlights: [] }; }
  }

  private async _reviewWater(range: DateRange): Promise<ReviewModuleSummary> {
    try {
      // T15：饮水统计统一走唯一流水源 waterLogs
      const logs = await healthDB.waterLogs.where("date").between(range.start, range.end, true, true).toArray();
      const days = daysInRange(range.start, range.end);
      const totalMl = logs.reduce((s: number, l: any) => s + (l.amount || 0), 0);
      const avgMl = days > 0 ? Math.round(totalMl / days) : 0;
      const byDate: Record<string, number> = {};
      for (const l of logs) byDate[l.date] = (byDate[l.date] || 0) + (l.amount || 0);
      let target = 2000;
      try {
        const goal = await healthDB.waterGoals.toArray();
        if (goal[0]?.dailyTarget) target = goal[0].dailyTarget;
      } catch { /* keep default */ }
      const okDays = Object.values(byDate).filter(ml => ml >= target).length;
      const rate = days > 0 ? Math.round((okDays / days) * 100) : 0;
      return {
        module: "water", icon: "Droplets", label: "饮水",
        stats: { "总饮水量": `${totalMl}ml`, "日均": `${avgMl}ml`, "达标天数": `${okDays}/${days}`, "达标率": `${rate}%` },
        highlights: [{ module: "water", label: "饮水达标率", value: `${rate}%`, trend: rate >= 80 ? "up" : rate >= 50 ? "stable" : "down" }],
      };
    } catch { return { module: "water", icon: "Droplets", label: "饮水", stats: {}, highlights: [] }; }
  }

  private async _reviewSleep(range: DateRange): Promise<ReviewModuleSummary> {
    try {
      const logs = await healthDB.sleepLogs.where("date").between(range.start, range.end, true, true).toArray();
      const days = daysInRange(range.start, range.end);
      const onTime = logs.filter((l: any) => l.isOnTime).length;
      const rate = logs.length > 0 ? Math.round((onTime / logs.length) * 100) : 0;
      const times = logs.map((l: any) => l.actualTime).filter(Boolean).sort();
      const medianTime = times.length > 0 ? times[Math.floor(times.length / 2)] : "--";
      return {
        module: "sleep", icon: "Moon", label: "睡眠",
        stats: { "记录天数": `${logs.length}/${days}`, "达标次数": onTime, "达标率": `${rate}%`, "中位入睡": medianTime },
        highlights: [{ module: "sleep", label: "早睡达标率", value: `${rate}%`, trend: rate >= 80 ? "up" : rate >= 50 ? "stable" : "down" }],
      };
    } catch { return { module: "sleep", icon: "Moon", label: "睡眠", stats: {}, highlights: [] }; }
  }

  private async _reviewFitness(range: DateRange): Promise<ReviewModuleSummary> {
    try {
      const sessions = await healthDB.workoutSessions.where("date").between(range.start, range.end, true, true).toArray();
      const days = daysInRange(range.start, range.end);
      const sessionDays = new Set(sessions.map((s: any) => s.date)).size;
      const totalSessions = sessions.length;
      return {
        module: "fitness", icon: "Dumbbell", label: "训练",
        stats: { "训练天数": `${sessionDays}/${days}`, "训练次数": totalSessions, "平均 RPE": "--", "最多连续": "--" },
        highlights: totalSessions > 0 ? [{ module: "fitness", label: "训练天数", value: `${sessionDays} 天`, trend: sessionDays >= Math.ceil(days / 2) ? "up" : "stable" }] : [],
      };
    } catch { return { module: "fitness", icon: "Dumbbell", label: "训练", stats: {}, highlights: [] }; }
  }

  private async _reviewDiet(range: DateRange): Promise<ReviewModuleSummary> {
    try {
      const logs = await lifeDB.dietLogs.where("date").between(range.start, range.end, true, true).toArray();
      const days = daysInRange(range.start, range.end);
      const logDays = new Set(logs.map(l => l.date)).size;
      const totalMeals = logs.length;
      return {
        module: "diet", icon: "Utensils", label: "饮食",
        stats: { "记录天数": `${logDays}/${days}`, "总餐数": totalMeals, "日均餐数": days > 0 ? (totalMeals / days).toFixed(1) : "0" },
        highlights: logDays > 0 ? [{ module: "diet", label: "记录天数", value: `${logDays} 天`, trend: logDays >= Math.ceil(days * 0.7) ? "up" : "stable" }] : [],
      };
    } catch { return { module: "diet", icon: "Utensils", label: "饮食", stats: {}, highlights: [] }; }
  }

  private async _reviewWellness(range: DateRange): Promise<ReviewModuleSummary> {
    try {
      const logs = await lifeDB.wellnessLogs.where("date").between(range.start, range.end, true, true).toArray();
      const days = daysInRange(range.start, range.end);
      const logDays = new Set(logs.map(l => l.date)).size;
      const gongfaCount = logs.filter(l => l.type === "gongfa").length;
      const tigangCount = logs.filter(l => l.type === "tigang").length;
      return {
        module: "wellness", icon: "Heart", label: "养生",
        stats: { "记录天数": `${logDays}/${days}`, "功法": gongfaCount, "提肛": tigangCount, "总练习": logs.length },
        highlights: logDays > 0 ? [{ module: "wellness", label: "养生天数", value: `${logDays} 天`, trend: "stable" }] : [],
      };
    } catch { return { module: "wellness", icon: "Heart", label: "养生", stats: {}, highlights: [] }; }
  }

  private async _reviewPosture(range: DateRange): Promise<ReviewModuleSummary> {
    try {
      const logs = await healthDB.stretchLogs.where("date").between(range.start, range.end, true, true).toArray();
      const days = daysInRange(range.start, range.end);
      const stretchDays = new Set(logs.map((l: any) => l.date)).size;
      const totalSets = logs.reduce((s: number, l: any) => s + (l.sets || 0), 0);
      const totalReps = logs.reduce((s: number, l: any) => s + (l.reps || 0), 0);
      return {
        module: "posture", icon: "StretchHorizontal", label: "体态拉伸",
        stats: { "拉伸天数": `${stretchDays}/${days}`, "总组数": totalSets, "总次数": totalReps },
        highlights: stretchDays > 0 ? [{ module: "posture", label: "拉伸天数", value: `${stretchDays} 天`, trend: stretchDays >= Math.ceil(days / 2) ? "up" : "stable" }] : [],
      };
    } catch { return { module: "posture", icon: "StretchHorizontal", label: "体态拉伸", stats: {}, highlights: [] }; }
  }

  public async _reviewSchedule(range: DateRange): Promise<ReviewModuleSummary> {
    try {
      const items = await daylogDB.items.where("date").between(range.start, range.end, true, true).toArray();
      const totalCount = items.length;
      const completedCount = items.filter((i: any) => i.isCompleted).length;
      const corrected = items.filter((i: any) => i.isCorrected).length;
      const uncompleted = totalCount - completedCount;
      return {
        module: "schedule", icon: "Calendar", label: "日程复盘",
        stats: { "总事项数": totalCount, "已完成": completedCount, "完成率": totalCount > 0 ? `${Math.round(completedCount / totalCount * 100)}%` : "0%", "已校准": corrected, "未完成": uncompleted },
        highlights: [],
      };
    } catch { return { module: "schedule", icon: "Calendar", label: "日程复盘", stats: {}, highlights: [] }; }
  }

  private async _reviewMedication(range: DateRange): Promise<ReviewModuleSummary> {
    try {
      const logs = await healthDB.medicineLogs.where("date").between(range.start, range.end, true, true).toArray();
      const medicines = await healthDB.medicines.toArray();
      const activeMeds = medicines.filter((m: any) => m.active);
      const totalCount = logs.length;
      const takenCount = logs.filter((l: any) => l.taken).length;
      const complianceRate = totalCount > 0 ? Math.round((takenCount / totalCount) * 100) : 0;
      return {
        module: "medication", icon: "Pill", label: "用药",
        stats: { "应吃次数": totalCount, "已吃次数": takenCount, "依从率": `${complianceRate}%`, "有效药品数": activeMeds.length },
        highlights: [{ module: "medication", label: "服药依从率", value: `${complianceRate}%`, trend: complianceRate >= 90 ? "up" : complianceRate >= 70 ? "stable" : "down" }],
      };
    } catch { return { module: "medication", icon: "Pill", label: "用药", stats: {}, highlights: [] }; }
  }
}

// ════════════════════════════════════════════════════════════════
// 单例导出
// ════════════════════════════════════════════════════════════════

export const reviewerBrain = new UnifiedReviewer();