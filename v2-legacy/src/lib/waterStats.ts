"use client";

import { db } from "@/lib/db";
import type { DailyWaterRecord, UserSettings } from "@/lib/types";

// ==================== 饮水统计 ====================

/** 获取指定日期范围内的饮水记录 */
export async function getWaterRecordsByRange(start: string, end: string): Promise<DailyWaterRecord[]> {
  return db.dailyWaterRecords
    .where("date")
    .between(start, end, true, true)
    .toArray();
}

/** 饮水统计结果 */
export interface WaterStats {
  totalMl: number;
  avgDailyMl: number;
  targetMilestones: number;
  longestStreak: number;
  dailyBreakdown: { date: string; ml: number; target: number; reached: boolean }[];
  hourlyDistribution: { hour: number; ml: number }[];
  achievements: WaterAchievement[];
}

export interface WaterAchievement {
  label: string;
  threshold: number;
  unlocked: boolean;
  icon: string;
}

const WATER_ACHIEVEMENTS: Omit<WaterAchievement, "unlocked">[] = [
  { label: "初入水滴", threshold: 500, icon: "💧" },
  { label: "涓涓细流", threshold: 1000, icon: "🌊" },
  { label: "饮水达人", threshold: 1500, icon: "🏆" },
  { label: "健康守护", threshold: 2000, icon: "🛡️" },
  { label: "生命之泉", threshold: 2500, icon: "🌟" },
  { label: "终极水神", threshold: 3000, icon: "👑" },
];

export async function getWaterStats(
  records: DailyWaterRecord[],
  targetMl: number = 2000
): Promise<WaterStats> {
  const totalMl = records.reduce((sum, r) => sum + r.totalMl, 0);
  const days = records.length || 1;
  const avgDailyMl = Math.round(totalMl / days);

  // 达标天数
  const targetMilestones = records.filter((r) => r.totalMl >= targetMl).length;

  // 最长连续达标
  let longestStreak = 0;
  let currentStreak = 0;
  const sortedRecords = [...records].sort((a, b) => a.date.localeCompare(b.date));
  for (const r of sortedRecords) {
    if (r.totalMl >= targetMl) {
      currentStreak++;
      longestStreak = Math.max(longestStreak, currentStreak);
    } else {
      currentStreak = 0;
    }
  }

  // 每日明细
  const dailyBreakdown = records.map((r) => ({
    date: r.date,
    ml: r.totalMl,
    target: targetMl,
    reached: r.totalMl >= targetMl,
  }));

  // 时段分布（按小时）
  const hourlyMap: Record<number, number> = {};
  for (const r of records) {
    for (const entry of r.entries) {
      const hour = new Date(entry.timestamp).getHours();
      hourlyMap[hour] = (hourlyMap[hour] || 0) + entry.ml;
    }
  }
  const hourlyDistribution = Array.from({ length: 24 }, (_, hour) => ({
    hour,
    ml: hourlyMap[hour] || 0,
  }));

  // 成就
  const achievements: WaterAchievement[] = WATER_ACHIEVEMENTS.map((a) => ({
    ...a,
    unlocked: avgDailyMl >= a.threshold || targetMilestones > 0,
  }));

  return {
    totalMl,
    avgDailyMl,
    targetMilestones,
    longestStreak,
    dailyBreakdown,
    hourlyDistribution,
    achievements,
  };
}

/** 获取用户饮水目标 */
export async function getUserWaterTarget(): Promise<number> {
  try {
    const settings = await db.userSettings.toArray();
    if (settings.length > 0) {
      const s = settings[0] as UserSettings & { waterTarget?: number };
      if (s.waterTarget) return s.waterTarget;
      // 按体重推荐：每kg × 30ml
      if (s.weight) return Math.round(s.weight * 30);
    }
  } catch {}
  return 2000;
}
