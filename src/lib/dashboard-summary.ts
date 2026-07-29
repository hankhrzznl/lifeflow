/**
 * DashboardSummary — 首页生活节奏仪表盘的本地智能摘要引擎
 * 
 * 工作方式：
 * 1. 查询当前周期（日/周/月/年）各模块数据
 * 2. 与上一周期对比，计算偏离度
 * 3. 挑偏离度最大的 1-2 个模块作为叙事锚点
 * 4. 生成一句 15-30 字的中文摘要
 */

import { daylogDB } from "@/lib/db/daylog.db";
import { healthDB, getSleepLogs } from "@/lib/db/health.db";
import { accountingDB } from "@/lib/db/accounting.db";
import { lifeDB } from "@/lib/db/life.db";

export type SummaryPeriod = "daily" | "weekly" | "monthly" | "yearly";

// ============================================================
// 日期工具
// ============================================================

function fmtDate(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function getDateRange(period: SummaryPeriod, offset: number = 0): { start: string; end: string } {
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

// ============================================================
// 模块指标
// ============================================================

export interface ModuleMetric {
  key: string;
  label: string;
  /** 当前值 */
  current: number;
  /** 当前值的展示文案 */
  display: string;
  /** 目标值（如果有） */
  target?: number;
  /** 完成率 0-100 */
  rate?: number;
  /** 与上一周期的偏离度 0-100，越大说明变化越大 */
  deviation: number;
  /** 趋势方向 */
  trend: "up" | "down" | "stable";
}

export interface DashboardSummary {
  /** 一句话摘要 */
  headline: string;
  /** 各模块指标 */
  metrics: ModuleMetric[];
  /** 是否有数据 */
  hasData: boolean;
}

// ============================================================
// 数据获取
// ============================================================

async function getWaterData(range: { start: string; end: string }): Promise<{ total: number; completed: number; days: number }> {
  try {
    const items = await daylogDB.items
      .where("date")
      .between(range.start, range.end, true, true)
      .filter((i: any) => i.sourceType === "water")
      .toArray();
    return { total: items.length, completed: items.filter((i: any) => i.isCompleted).length, days: daysInRange(range.start, range.end) };
  } catch {
    return { total: 0, completed: 0, days: 1 };
  }
}

async function getSleepData(range: { start: string; end: string }): Promise<{ recordDays: number; onTimeDays: number; totalDays: number }> {
  try {
    const logs = await healthDB.sleepLogs
      .where("date")
      .between(range.start, range.end, true, true)
      .toArray();
    return {
      recordDays: logs.length,
      onTimeDays: logs.filter((l: any) => l.isOnTime).length,
      totalDays: daysInRange(range.start, range.end),
    };
  } catch {
    return { recordDays: 0, onTimeDays: 0, totalDays: 1 };
  }
}

async function getFitnessData(range: { start: string; end: string }): Promise<{ sessionDays: number; totalSessions: number; days: number }> {
  try {
    const sessions = await healthDB.workoutSessions
      .where("date")
      .between(range.start, range.end, true, true)
      .toArray();
    return {
      sessionDays: new Set(sessions.map((s: any) => s.date)).size,
      totalSessions: sessions.length,
      days: daysInRange(range.start, range.end),
    };
  } catch {
    return { sessionDays: 0, totalSessions: 0, days: 1 };
  }
}

async function getFinanceData(range: { start: string; end: string }): Promise<{ expense: number; income: number }> {
  try {
    const txns = await accountingDB.transactions
      .where("date")
      .between(range.start, range.end, true, true)
      .toArray();
    return {
      expense: txns.filter((t: any) => t.type === "expense").reduce((s: number, t: any) => s + t.amount, 0),
      income: txns.filter((t: any) => t.type === "income").reduce((s: number, t: any) => s + t.amount, 0),
    };
  } catch {
    return { expense: 0, income: 0 };
  }
}

async function getDietData(range: { start: string; end: string }): Promise<{ totalMeals: number; days: number }> {
  try {
    const logs = await lifeDB.dietLogs
      .where("date")
      .between(range.start, range.end, true, true)
      .toArray();
    return { totalMeals: logs.length, days: daysInRange(range.start, range.end) };
  } catch {
    return { totalMeals: 0, days: 1 };
  }
}

async function getWellnessData(range: { start: string; end: string }): Promise<{ gongfa: number; tigang: number; days: number }> {
  try {
    const logs = await lifeDB.wellnessLogs
      .where("date")
      .between(range.start, range.end, true, true)
      .toArray();
    return {
      gongfa: logs.filter(l => l.type === "gongfa").length,
      tigang: logs.filter(l => l.type === "tigang").length,
      days: daysInRange(range.start, range.end),
    };
  } catch {
    return { gongfa: 0, tigang: 0, days: 1 };
  }
}

async function getPostureData(range: { start: string; end: string }): Promise<{ stretchDays: number; days: number }> {
  try {
    const logs = await healthDB.stretchLogs
      .where("date")
      .between(range.start, range.end, true, true)
      .toArray();
    return {
      stretchDays: new Set(logs.map((l: any) => l.date)).size,
      days: daysInRange(range.start, range.end),
    };
  } catch {
    return { stretchDays: 0, days: 1 };
  }
}

// ============================================================
// 叙事引擎
// ============================================================

const PERIOD_LABELS: Record<SummaryPeriod, string> = {
  daily: "今日",
  weekly: "本周",
  monthly: "本月",
  yearly: "今年",
};

function generateHeadline(
  metrics: ModuleMetric[],
  period: SummaryPeriod
): string {
  const label = PERIOD_LABELS[period];
  const withData = metrics.filter(m => m.current > 0);

  if (withData.length === 0) {
    return `${label}刚开始，一切都有可能。`;
  }

  // 找偏离度最大的模块（好事或坏事）
  const sortedByDeviation = [...withData].sort((a, b) => b.deviation - a.deviation);
  const top = sortedByDeviation[0];

  // 找是否有"全部正常"的状态
  const allGood = withData.every(m => {
    if (m.rate !== undefined) return m.rate >= 60;
    if (m.key === "finance") return m.current >= 0; // 结余为正
    return m.current > 0;
  });

  const hasDown = withData.some(m => m.trend === "down");

  if (allGood && !hasDown) {
    // 全部正常
    if (withData.length >= 4) {
      return `一切都在轨道上，${label}节奏很好。`;
    }
    const names = withData.slice(0, 2).map(m => m.label).join("和");
    return `${names}都已安排妥当，${label}状态不错。`;
  }

  // 有亮点
  const ups = withData.filter(m => m.trend === "up").sort((a, b) => b.deviation - a.deviation);
  if (ups.length > 0 && top.trend === "up") {
    if (top.rate !== undefined && top.rate >= 90) {
      return `${label}${top.label}几乎全部达标，状态拉满。`;
    }
    return `${label}${top.label}表现突出，势头很好。`;
  }

  // 有预警
  if (top.trend === "down" || (top.rate !== undefined && top.rate < 50)) {
    if (top.key === "sleep") {
      return `${label}睡得偏晚，白天可能会有点累，重要的事放上午。`;
    }
    if (top.key === "water") {
      return `${label}喝水偏少，现在喝一杯还来得及。`;
    }
    if (top.key === "fitness") {
      return `${label}训练还没开始，抽空动一下有助保持状态。`;
    }
    if (top.key === "finance" && top.current < 0) {
      return `${label}支出有点猛，注意一下消费节奏。`;
    }
    return `${label}${top.label}需要关注一下。`;
  }

  // 混搭：有亮点也有预警
  const downItem = withData.find(m => m.trend === "down");
  const upItem = withData.find(m => m.trend === "up");
  if (downItem && upItem) {
    return `${label}${upItem.label}表现不错，但${downItem.label}还需要加把劲。`;
  }

  // 默认
  return `${label}一切如常，保持节奏。`;
}

// ============================================================
// 主函数
// ============================================================

export async function getDashboardSummary(period: SummaryPeriod): Promise<DashboardSummary> {
  const range = getDateRange(period, 0);
  const prevRange = getDateRange(period, 1);
  const days = daysInRange(range.start, range.end);

  const [
    water, prevWater,
    sleep, prevSleep,
    fitness, prevFitness,
    finance, prevFinance,
    diet, prevDiet,
    wellness, prevWellness,
    posture, prevPosture,
  ] = await Promise.all([
    getWaterData(range), getWaterData(prevRange),
    getSleepData(range), getSleepData(prevRange),
    getFitnessData(range), getFitnessData(prevRange),
    getFinanceData(range), getFinanceData(prevRange),
    getDietData(range), getDietData(prevRange),
    getWellnessData(range), getWellnessData(prevRange),
    getPostureData(range), getPostureData(prevRange),
  ]);

  // ── 单日展示 ──
  if (period === "daily") {
    const metrics: ModuleMetric[] = [];
    const avgWater = Math.max(1, prevWater.total || 1);

    const waterRate = water.total > 0 ? Math.min(100, Math.round((water.completed / water.total) * 100)) : 0;
    const waterDev = Math.abs(water.total - prevWater.total) / avgWater * 100;
    metrics.push({
      key: "water", label: "饮水",
      current: water.completed, display: `${water.completed}/${water.total} 杯`,
      target: water.total, rate: waterRate,
      deviation: waterDev, trend: waterRate >= 80 ? "up" : waterRate >= 50 ? "stable" : "down",
    });

    const sleepRate = sleep.recordDays > 0 ? Math.round((sleep.onTimeDays / sleep.recordDays) * 100) : 0;
    metrics.push({
      key: "sleep", label: "睡眠",
      current: sleep.onTimeDays, display: sleepRate > 0 ? `${sleepRate}%` : "暂无",
      rate: sleepRate,
      deviation: Math.abs(sleep.onTimeDays - prevSleep.onTimeDays) * 25,
      trend: sleepRate >= 80 ? "up" : sleepRate >= 50 ? "stable" : "down",
    });

    const fitDev = Math.abs(fitness.totalSessions - prevFitness.totalSessions) * 20;
    metrics.push({
      key: "fitness", label: "训练",
      current: fitness.totalSessions,
      display: fitness.totalSessions > 0 ? `${fitness.totalSessions} 次` : "暂无",
      deviation: fitDev, trend: fitness.totalSessions > 0 ? "up" : "stable",
    });

    const balance = finance.income - finance.expense;
    const prevBalance = prevFinance.income - prevFinance.expense;
    metrics.push({
      key: "finance", label: "记账",
      current: balance,
      display: balance >= 0 ? `¥${balance.toFixed(0)}` : `-¥${Math.abs(balance).toFixed(0)}`,
      deviation: prevBalance !== 0 ? Math.abs(balance - prevBalance) / Math.abs(prevBalance) * 100 : 0,
      trend: balance >= 0 ? "up" : "down",
    });

    const dietRate = diet.totalMeals > 0 ? Math.round((diet.totalMeals / 4) * 100) : 0;
    metrics.push({
      key: "diet", label: "饮食",
      current: diet.totalMeals, display: `${diet.totalMeals} 餐`,
      target: 4, rate: dietRate,
      deviation: Math.abs(diet.totalMeals - prevDiet.totalMeals) * 25,
      trend: dietRate >= 75 ? "up" : dietRate >= 25 ? "stable" : "down",
    });

    const wellnessTotal = wellness.gongfa + wellness.tigang;
    metrics.push({
      key: "wellness", label: "养生",
      current: wellnessTotal,
      display: wellnessTotal > 0 ? `${wellnessTotal} 次` : "暂无",
      deviation: Math.abs(wellnessTotal - (prevWellness.gongfa + prevWellness.tigang)) * 20,
      trend: wellnessTotal > 0 ? "up" : "stable",
    });

    const postureRate = posture.stretchDays > 0 ? Math.round((posture.stretchDays / 1) * 100) : 0;
    metrics.push({
      key: "posture", label: "体态",
      current: posture.stretchDays,
      display: posture.stretchDays > 0 ? `${posture.stretchDays} 天` : "暂无",
      deviation: Math.abs(posture.stretchDays - prevPosture.stretchDays) * 30,
      trend: postureRate >= 80 ? "up" : "stable",
    });

    const headline = generateHeadline(metrics, period);
    return { headline, metrics, hasData: metrics.some(m => m.current > 0) };
  }

  // ── 周/月/年展示 ──
  const metrics: ModuleMetric[] = [];

  const waterRate = water.total > 0 ? Math.min(100, Math.round((water.completed / water.total) * 100)) : 0;
  const waterAvgPrev = Math.max(1, prevWater.total || 1);
  metrics.push({
    key: "water", label: "饮水",
    current: water.completed, display: `${water.completed}/${water.total} 杯`,
    target: water.total, rate: waterRate,
    deviation: Math.abs(water.total - prevWater.total) / waterAvgPrev * 100,
    trend: waterRate >= 80 ? "up" : waterRate >= 50 ? "stable" : "down",
  });

  const sleepRate = sleep.recordDays > 0 ? Math.round((sleep.onTimeDays / sleep.recordDays) * 100) : 0;
  metrics.push({
    key: "sleep", label: "睡眠",
    current: sleep.onTimeDays, display: `${sleepRate}%`,
    rate: sleepRate,
    deviation: Math.abs(sleepRate - (prevSleep.recordDays > 0 ? Math.round((prevSleep.onTimeDays / prevSleep.recordDays) * 100) : 0)),
    trend: sleepRate >= 80 ? "up" : sleepRate >= 50 ? "stable" : "down",
  });

  const fitDaysTarget = Math.ceil(days / 2);
  const fitRate = Math.min(100, Math.round((fitness.sessionDays / fitDaysTarget) * 100));
  metrics.push({
    key: "fitness", label: "训练",
    current: fitness.sessionDays,
    display: `${fitness.sessionDays} 天`,
    target: fitDaysTarget, rate: fitRate,
    deviation: Math.abs(fitness.sessionDays - prevFitness.sessionDays) * 15,
    trend: fitRate >= 80 ? "up" : fitRate >= 40 ? "stable" : "down",
  });

  const balance = finance.income - finance.expense;
  const prevBalance = prevFinance.income - prevFinance.expense;
  metrics.push({
    key: "finance", label: "记账",
    current: balance,
    display: balance >= 0 ? `¥${balance.toFixed(0)}` : `-¥${Math.abs(balance).toFixed(0)}`,
    deviation: prevBalance !== 0 ? Math.abs(balance - prevBalance) / Math.abs(prevBalance) * 100 : 0,
    trend: balance >= 0 ? "up" : "down",
  });

  const dietAvg = diet.totalMeals > 0 ? Math.round((diet.totalMeals / days) * 10) / 10 : 0;
  metrics.push({
    key: "diet", label: "饮食",
    current: diet.totalMeals, display: `${dietAvg}/天`,
    deviation: Math.abs(diet.totalMeals - prevDiet.totalMeals) / Math.max(1, prevDiet.totalMeals) * 100,
    trend: diet.totalMeals > 0 ? "up" : "stable",
  });

  const wellnessTotal = wellness.gongfa + wellness.tigang;
  metrics.push({
    key: "wellness", label: "养生",
    current: wellnessTotal, display: `${wellnessTotal} 次`,
    deviation: Math.abs(wellnessTotal - (prevWellness.gongfa + prevWellness.tigang)) / Math.max(1, prevWellness.gongfa + prevWellness.tigang) * 100,
    trend: wellnessTotal > 0 ? "up" : "stable",
  });

  const postRate = Math.min(100, Math.round((posture.stretchDays / days) * 100));
  metrics.push({
    key: "posture", label: "体态",
    current: posture.stretchDays, display: `${posture.stretchDays}/${days} 天`,
    target: days, rate: postRate,
    deviation: Math.abs(posture.stretchDays - prevPosture.stretchDays) * 15,
    trend: postRate >= 50 ? "up" : "stable",
  });

  const headline = generateHeadline(metrics, period);
  return { headline, metrics, hasData: metrics.some(m => m.current > 0) };
}
