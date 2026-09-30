/**
 * 记忆师 —— 长期模式挖掘引擎
 * 从几个月的数据中提炼规律：周三效率低、出差周下降、季节变化等
 * 统计学方法：相关性分析、周期性检测、趋势计算
 */

import type { DailyAtom } from "@/types/goal";
import type { Goal } from "@/lib/types";

export interface WeeklyPattern {
  type: "low_day" | "high_day" | "low_week" | "momentum";
  day?: number;
  description: string;
  confidence: number;
}

export interface AnomalyWeek {
  weekStart: string;
  type: "high" | "low";
  description: string;
}

export interface QuarterReport {
  totalGoalsCompleted: number;
  avgCompletionRate: number;
  trend: "up" | "stable" | "down";
  bestWeek: { weekStart: string; rate: number } | null;
  worstWeek: { weekStart: string; rate: number } | null;
  patterns: WeeklyPattern[];
  anomalies: AnomalyWeek[];
  summary: string;
}

interface WeekSummary {
  weekStart: string;
  completionRate: number;
  totalAtoms: number;
  completedAtoms: number;
}

export class MemoryEngine {
  findPatterns(atoms: DailyAtom[]): WeeklyPattern[] {
    const patterns: WeeklyPattern[] = [];
    if (atoms.length < 21) return patterns;

    const byDay: DailyAtom[][] = Array(7)
      .fill(null)
      .map(() => []);
    atoms.forEach((a) => {
      const day = new Date(a.scheduledDate + "T00:00:00").getDay();
      byDay[day].push(a);
    });

    const dayNames = ["周日", "周一", "周二", "周三", "周四", "周五", "周六"];
    const rates = byDay.map((list) => {
      const total = list.length;
      return total > 0 ? (list.filter((a) => a.isCompleted).length / total) * 100 : 0;
    });
    // 只对数据的日子取平均，避免无任务日计0拉偏均值
    const validRates = rates.filter((_, day) => byDay[day].length > 0);
    const avgRate = validRates.length > 0
      ? validRates.reduce((a, b) => a + b, 0) / validRates.length
      : 0;

    // avgRate为0时全零数据不产出日模式
    if (avgRate > 0) {
      rates.forEach((rate, day) => {
      if (rate < avgRate * 0.75 && byDay[day].length >= 3) {
        patterns.push({
          type: "low_day", day,
          description: `每逢${dayNames[day]}效率明显下降（完成率${Math.round(rate)}%，平均${Math.round(avgRate)}%），建议${dayNames[day]}安排轻松任务。`,
          confidence: Math.round((1 - rate / avgRate) * 100),
        });
      }
      if (rate > avgRate * 1.3 && byDay[day].length >= 3) {
        patterns.push({
          type: "high_day", day,
          description: `每逢${dayNames[day]}状态特别好（完成率${Math.round(rate)}%），建议把重要任务安排在${dayNames[day]}。`,
          confidence: Math.round((rate / avgRate - 1) * 100),
        });
      }
    });
    }

    const momentum = this.calcMomentum(atoms);
    if (momentum.streakBoost > 20) {
      patterns.push({
        type: "momentum",
        description: `连续打卡后的第二天完成率提升${Math.round(momentum.streakBoost)}%，维持连续性是提高效率的关键。`,
        confidence: Math.min(90, Math.round(momentum.streakBoost * 2)),
      });
    }

    return patterns.sort((a, b) => b.confidence - a.confidence);
  }

  findAnomalies(weeklyData: WeekSummary[]): AnomalyWeek[] {
    if (weeklyData.length < 4) return [];
    const rates = weeklyData.map((w) => w.completionRate);
    const mean = rates.reduce((a, b) => a + b, 0) / rates.length;
    const std = Math.sqrt(
      rates.reduce((sq, n) => sq + Math.pow(n - mean, 2), 0) / rates.length
    );

    return weeklyData
      .filter((w) => Math.abs(w.completionRate - mean) > std * 1.2)
      .map((w) => ({
        weekStart: w.weekStart,
        type: (w.completionRate > mean ? "high" : "low") as "high" | "low",
        description:
          w.completionRate > mean
            ? `${w.weekStart}这一周表现超常（${Math.round(w.completionRate)}%），回想一下是什么帮助了你`
            : `${w.weekStart}这一周有些困难（${Math.round(w.completionRate)}%），发生了什么事吗？`,
      }));
  }

  generateQuarterReport(quarterData: WeekSummary[], atoms: DailyAtom[], goals: Goal[]): QuarterReport {
    const completedGoals = goals.filter((g) => g.status === "completed").length;
    const avgRate =
      quarterData.length > 0
        ? quarterData.reduce((s, w) => s + w.completionRate, 0) / quarterData.length
        : 0;
    const trend = this.calcTrend(quarterData.map((w) => w.completionRate));

    const sortedByRate = [...quarterData].sort((a, b) => b.completionRate - a.completionRate);
    const bestWeek = sortedByRate[0] || null;
    const worstWeek = sortedByRate[sortedByRate.length - 1] || null;

    const patterns = this.findPatterns(atoms);
    const anomalies = this.findAnomalies(quarterData);

    const summaries = [
      `这季度完成了${completedGoals}个目标，平均完成率${Math.round(avgRate)}%。`,
      trend === "up"
        ? "整体呈上升趋势，你在变得越来越好。"
        : trend === "down"
          ? "近期有所回落，但每个低谷都是调整的契机。"
          : "保持稳定的节奏，坚持就是关键。",
      patterns.length > 0 ? `小织发现了${patterns.length}个有趣的模式：${patterns[0].description}` : "",
    ];

    return {
      totalGoalsCompleted: completedGoals,
      avgCompletionRate: Math.round(avgRate * 10) / 10,
      trend,
      bestWeek: bestWeek ? { weekStart: bestWeek.weekStart, rate: Math.round(bestWeek.completionRate) } : null,
      worstWeek: worstWeek ? { weekStart: worstWeek.weekStart, rate: Math.round(worstWeek.completionRate) } : null,
      patterns,
      anomalies,
      summary: summaries.filter(Boolean).join(""),
    };
  }

  private calcMomentum(atoms: DailyAtom[]): { streakBoost: number } {
    const byDate = new Map<string, boolean>();
    atoms.forEach((a) => {
      byDate.set(a.scheduledDate, byDate.get(a.scheduledDate) || a.isCompleted);
    });

    const dates = [...byDate.keys()].sort();
    let afterStreak = 0, afterStreakTotal = 0;
    let afterMiss = 0, afterMissTotal = 0;

    for (let i = 1; i < dates.length; i++) {
      const prevDone = byDate.get(dates[i - 1]);
      if (prevDone) { afterStreakTotal++; if (byDate.get(dates[i])) afterStreak++; }
      else { afterMissTotal++; if (byDate.get(dates[i])) afterMiss++; }
    }

    const streakRate = afterStreakTotal > 0 ? (afterStreak / afterStreakTotal) * 100 : 0;
    const missRate = afterMissTotal > 0 ? (afterMiss / afterMissTotal) * 100 : 0;
    return { streakBoost: streakRate - missRate };
  }

  private calcTrend(values: number[]): "up" | "stable" | "down" {
    if (values.length < 4) return "stable";
    const half = Math.floor(values.length / 2);
    const first = values.slice(0, half).reduce((a, b) => a + b, 0) / half;
    const second = values.slice(half).reduce((a, b) => a + b, 0) / (values.length - half);
    const change = first > 0 ? (second - first) / first : 0;
    return change > 0.1 ? "up" : change < -0.1 ? "down" : "stable";
  }
}

export const memoryEngine = new MemoryEngine();
