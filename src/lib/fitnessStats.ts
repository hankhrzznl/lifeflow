"use client";

import { db } from "@/lib/db";
import type { MuscleRecord, MuscleGroup, SubMuscle } from "@/lib/types";

// ==================== 健身统计 ====================

export interface FitnessStats {
  totalWorkouts: number;
  totalVolume: number;
  personalBests: number;
  muscleGroupsCovered: number;
  dailyVolume: { date: string; volume: number }[];
  muscleGroupLoad: { name: string; color: string; volume: number; pct: number }[];
  ctlTrend: { date: string; ctl: number }[];
  recentBests: MuscleRecord[];
  weeklyComparison: { thisWeek: number; lastWeek: number; changePct: number };
}

/** 获取指定日期范围内的训练记录 */
export async function getFitnessRecordsByRange(start: string, end: string): Promise<MuscleRecord[]> {
  return db.muscleRecords
    .where("date")
    .between(start, end, true, true)
    .reverse()
    .sortBy("timestamp");
}

export async function getFitnessStats(
  records: MuscleRecord[],
  muscleGroups: MuscleGroup[],
  subMuscles: SubMuscle[]
): Promise<FitnessStats> {
  const totalWorkouts = records.length;
  const personalBests = records.filter((r) => r.isPersonalBest).length;

  // 总训练容量
  const totalVolume = records.reduce((sum, r) => sum + (r.weight * r.sets * r.reps), 0);

  // 覆盖肌群数量
  const muscleGroupIds = new Set<number>();
  for (const r of records) {
    const sm = subMuscles.find((s) => s.id === r.subMuscleId);
    if (sm) muscleGroupIds.add(sm.muscleGroupId);
  }
  const muscleGroupsCovered = muscleGroupIds.size;

  // 每日容量
  const dailyMap: Record<string, number> = {};
  for (const r of records) {
    dailyMap[r.date] = (dailyMap[r.date] || 0) + r.weight * r.sets * r.reps;
  }
  const dailyVolume = Object.entries(dailyMap)
    .map(([date, volume]) => ({ date, volume }))
    .sort((a, b) => a.date.localeCompare(b.date));

  // 肌群负荷
  const muscleGroupLoadMap: Record<number, number> = {};
  for (const r of records) {
    const sm = subMuscles.find((s) => s.id === r.subMuscleId);
    if (sm) {
      muscleGroupLoadMap[sm.muscleGroupId] = (muscleGroupLoadMap[sm.muscleGroupId] || 0) + r.weight * r.sets * r.reps;
    }
  }
  const totalLoad = Object.values(muscleGroupLoadMap).reduce((a, b) => a + b, 0) || 1;
  const muscleGroupLoad = Object.entries(muscleGroupLoadMap)
    .map(([gid, volume]) => {
      const group = muscleGroups.find((g) => g.id === Number(gid));
      return {
        name: group?.name || "未知",
        color: group?.color || "#6366F1",
        volume,
        pct: Math.round((volume / totalLoad) * 100),
      };
    })
    .sort((a, b) => b.volume - a.volume);

  // CTL 趋势（慢性训练负荷简化为7天移动平均）
  const ctlTrend: { date: string; ctl: number }[] = [];
  for (let i = 0; i < dailyVolume.length; i++) {
    const window = dailyVolume.slice(Math.max(0, i - 6), i + 1);
    const avg = window.reduce((sum, d) => sum + d.volume, 0) / window.length;
    ctlTrend.push({ date: dailyVolume[i].date, ctl: Math.round(avg) });
  }

  // 近期最佳
  const recentBests = records
    .filter((r) => r.isPersonalBest)
    .slice(0, 10);

  // 周对比
  const mid = Math.floor(dailyVolume.length / 2);
  const firstWeek = dailyVolume.slice(0, mid).reduce((sum, d) => sum + d.volume, 0);
  const secondWeek = dailyVolume.slice(mid).reduce((sum, d) => sum + d.volume, 0);
  const changePct = firstWeek > 0 ? Math.round(((secondWeek - firstWeek) / firstWeek) * 100) : 0;

  return {
    totalWorkouts,
    totalVolume,
    personalBests,
    muscleGroupsCovered,
    dailyVolume,
    muscleGroupLoad,
    ctlTrend,
    recentBests,
    weeklyComparison: { thisWeek: secondWeek, lastWeek: firstWeek, changePct },
  };
}
