// ============================================================
// 统计计算 — 健身统计
// ============================================================

import { db } from '@/lib/db';
import type { MuscleRecord } from '@/lib/types';

export interface FitnessStats {
  totalWorkouts: number;
  totalSets: number;
  byType: Record<string, { count: number; sets: number }>;
  streak: number;
  recentRecords: MuscleRecord[];
}

/** 获取用户最近连续的训练天数 */
async function getWorkoutStreak(username?: string): Promise<number> {
  const allRecords = await db.muscleRecords.orderBy('date').reverse().toArray();
  if (allRecords.length === 0) return 0;

  const dates = [...new Set(allRecords.map((r) => r.date))].sort().reverse();
  if (dates.length === 0) return 0;

  let streak = 1;
  for (let i = 1; i < dates.length; i++) {
    const prev = new Date(dates[i - 1] + 'T00:00:00');
    const curr = new Date(dates[i] + 'T00:00:00');
    const diff = (prev.getTime() - curr.getTime()) / 86400000;
    if (diff <= 1) streak++;
    else break;
  }
  return streak;
}

/**
 * 计算健身统计
 */
export async function calculateFitnessStats(
  range: { start: string; end: string },
): Promise<FitnessStats> {
  const allRecords = await db.muscleRecords.toArray();
  const records = allRecords.filter((r) => r.date >= range.start && r.date <= range.end);

  const totalWorkouts = new Set(records.map((r) => r.date)).size;
  const totalSets = records.reduce((s, r) => s + (r.sets || 0), 0);

  const byType: Record<string, { count: number; sets: number }> = {};
  for (const r of records) {
    const key = r.exerciseName || 'unknown';
    if (!byType[key]) byType[key] = { count: 0, sets: 0 };
    byType[key].count++;
    byType[key].sets += r.sets || 0;
  }

  const streak = await getWorkoutStreak();

  return {
    totalWorkouts,
    totalSets,
    byType,
    streak,
    recentRecords: records.slice(-10),
  };
}
