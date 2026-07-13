import { db } from "./db";
import type { CorrelationReport } from "./types";

// ==================== 多维度数据关联分析 ====================

interface DailyStats {
  date: string;
  sleepDuration: number;
  exerciseDuration: number;
  waterMl: number;
  taskCompleted: number;
  taskTotal: number;
  completionRate: number;
}

/**
 * 聚合30天日度数据
 */
async function aggregateDailyStats(days: number = 30): Promise<DailyStats[]> {
  const now = Date.now();
  const start = now - days * 24 * 60 * 60 * 1000;
  const result: DailyStats[] = [];

  for (let d = 0; d < days; d++) {
    const dayStart = start + d * 24 * 60 * 60 * 1000;
    const dayEnd = dayStart + 24 * 60 * 60 * 1000;
    const dateStr = new Date(dayStart).toISOString().slice(0, 10);

    // 睡眠数据
    const sleepLogs = await db.sleepRecords
      .where("date").equals(dateStr).toArray();
    const avgSleep = sleepLogs.length > 0
      ? sleepLogs.reduce((s, l) => s + (l.sleepDuration || 0), 0) / sleepLogs.length
      : 0;

    // 运动数据
    const workouts = await db.workouts
      .where("date").equals(dateStr).toArray();
    const totalExercise = workouts.reduce((s, w) => s + (w.duration || 0), 0);

    // 饮水数据
    const waterRec = await db.dailyWaterRecords
      .where("date").equals(dateStr).first();
    const waterMl = waterRec?.totalMl || 0;

    // 任务完成
    const tasksInDay = await db.tasks
      .filter(t => {
        const ut = t.updatedAt || t.createdAt;
        return ut >= dayStart && ut < dayEnd;
      }).toArray();
    const done = tasksInDay.filter(t => t.status === "done").length;
    const total = tasksInDay.length;
    const rate = total > 0 ? done / total : 0;

    result.push({
      date: dateStr,
      sleepDuration: avgSleep,
      exerciseDuration: totalExercise,
      waterMl,
      taskCompleted: done,
      taskTotal: total,
      completionRate: Math.round(rate * 100),
    });
  }

  return result;
}

/**
 * 计算皮尔逊相关系数
 */
function pearsonCorrelation(x: number[], y: number[]): number {
  const n = Math.min(x.length, y.length);
  if (n < 3) return 0;

  const sumX = x.slice(0, n).reduce((s, v) => s + v, 0);
  const sumY = y.slice(0, n).reduce((s, v) => s + v, 0);
  const sumXY = x.slice(0, n).reduce((s, v, i) => s + v * y[i], 0);
  const sumX2 = x.slice(0, n).reduce((s, v) => s + v * v, 0);
  const sumY2 = y.slice(0, n).reduce((s, v) => s + v * v, 0);

  const numerator = n * sumXY - sumX * sumY;
  const denominator = Math.sqrt((n * sumX2 - sumX * sumX) * (n * sumY2 - sumY * sumY));

  if (denominator === 0) return 0;
  return Math.round((numerator / denominator) * 100) / 100;
}

/**
 * 按星期统计
 */
function analyzeWeekdayPatterns(stats: DailyStats[]): string[] {
  const weekdayNames = ["周日", "周一", "周二", "周三", "周四", "周五", "周六"];
  const weekdayRates: number[][] = [[], [], [], [], [], [], []];

  for (const s of stats) {
    const d = new Date(s.date + "T00:00:00").getDay();
    if (s.taskTotal > 0) {
      weekdayRates[d].push(s.completionRate);
    }
  }

  const avgRates = weekdayRates.map((rates, i) => ({
    day: i,
    name: weekdayNames[i],
    avg: rates.length > 0 ? rates.reduce((s, r) => s + r, 0) / rates.length : 0,
    count: rates.length,
  }));

  avgRates.sort((a, b) => b.avg - a.avg);
  const top2 = avgRates.slice(0, 2).map(d => d.name);
  
  return top2;
}

/**
 * 生成分析报告
 */
export async function generateCorrelationReport(dateKey?: string): Promise<CorrelationReport> {
  const key = dateKey || new Date().toISOString().slice(0, 10);
  const stats = await aggregateDailyStats(30);

  // 滤出有任务数据的天
  const valid = stats.filter(s => s.taskTotal >= 3);
  
  const sleepVals = valid.map(s => s.sleepDuration);
  const exerciseVals = valid.map(s => s.exerciseDuration);
  const waterVals = valid.map(s => s.waterMl);
  const rates = valid.map(s => s.completionRate);

  const sleepCorr = pearsonCorrelation(sleepVals, rates);
  const exerciseCorr = pearsonCorrelation(exerciseVals, rates);
  const waterCorr = pearsonCorrelation(waterVals, rates);

  const efficientDays = analyzeWeekdayPatterns(stats);

  // 找高效时段（简化：基于有效数据的时间点）
  const efficientHours: number[] = [9, 10, 15, 16]; // 默认推荐时段

  // 趋势标签
  const recentRates = rates.slice(-7);
  const olderRates = rates.slice(0, 7);
  const recentAvg = recentRates.length > 0 ? recentRates.reduce((s, r) => s + r, 0) / recentRates.length : 0;
  const olderAvg = olderRates.length > 0 ? olderRates.reduce((s, r) => s + r, 0) / olderRates.length : 0;
  const trendDiff = recentAvg - olderAvg;
  const trendLabel = trendDiff > 10 ? "上升期 ↑" : trendDiff < -10 ? "下滑期 ↓" : "平台期 →";

  const suggestions: string[] = [];
  if (sleepCorr > 0.3) suggestions.push(`充足睡眠与任务效率正相关(${sleepCorr})，建议保持7-8小时睡眠`);
  if (exerciseCorr > 0.3) suggestions.push(`规律运动与任务效率正相关(${exerciseCorr})，建议每周3次以上运动`);
  if (waterCorr > 0.3) suggestions.push(`饮水充足与效率正相关(${waterCorr})，提醒每日饮水目标`);
  if (efficientDays.length > 0) suggestions.push(`高效日: ${efficientDays.join("、")}，建议将重要任务安排在这些天`);

  const report: CorrelationReport = {
    dateKey: key,
    sleepCorrelation: sleepCorr,
    exerciseCorrelation: exerciseCorr,
    waterCorrelation: waterCorr,
    efficientDays,
    efficientHours,
    trendLabel,
    suggestions: suggestions.length > 0 ? suggestions : ["数据不足，继续记录后将生成个性化建议"],
    createdAt: Date.now(),
  };

  // 缓存报告
  const existing = await db.correlationReports.where("dateKey").equals(key).first();
  if (existing) {
    const { id: _rid, ...updateFields } = report;
    await db.correlationReports.update(existing.id!, updateFields as any);
    report.id = existing.id;
  } else {
    report.id = await db.correlationReports.add(report);
  }

  return report;
}

/**
 * 获取最新分析报告
 */
export async function getLatestReport(): Promise<CorrelationReport | null> {
  const all = await db.correlationReports.orderBy("createdAt").reverse().limit(1).toArray();
  return all[0] || null;
}
