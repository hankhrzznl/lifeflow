// ============================================================
// 统计计算 — 饮水统计
// ============================================================

import { db } from '@/lib/db';
import type { DailyWaterRecord } from '@/lib/types';

export interface WaterStats {
  avgDaily: number;       // 平均每日 ml
  goalRate: number;       // 达标率 百分比
  streak: number;         // 连续达标天数
  total: number;          // 总饮水量 ml
  totalDays: number;
}

/** 获取连续达标天数 */
async function getWaterStreak(): Promise<number> {
  const allRecords = await db.dailyWaterRecords.orderBy('date').reverse().toArray();
  if (allRecords.length === 0) return 0;

  const waterGoal = parseInt(
    typeof window !== 'undefined' ? localStorage.getItem('lf_water_goal') || '2000' : '2000',
    10
  );

  const dates = [...allRecords].sort((a, b) => b.date.localeCompare(a.date));
  let streak = 0;

  for (const record of dates) {
    if (record.totalMl >= waterGoal) streak++;
    else break;
  }

  return streak;
}

/**
 * 计算饮水统计
 */
export async function calculateWaterStats(
  range: { start: string; end: string },
): Promise<WaterStats> {
  const allRecords = await db.dailyWaterRecords.toArray();
  const records = allRecords.filter((r) => r.date >= range.start && r.date <= range.end);

  if (records.length === 0) {
    return { avgDaily: 0, goalRate: 0, streak: 0, total: 0, totalDays: 0 };
  }

  const total = records.reduce((s, r) => s + (r.totalMl || 0), 0);
  const totalDays = records.length;
  const avgDaily = Math.round(total / totalDays);

  const waterGoal = parseInt(
    typeof window !== 'undefined' ? localStorage.getItem('lf_water_goal') || '2000' : '2000',
    10
  );
  const goalMet = records.filter((r) => r.totalMl >= waterGoal).length;
  const goalRate = Math.round((goalMet / totalDays) * 100);

  const streak = await getWaterStreak();

  return {
    avgDaily,
    goalRate,
    streak,
    total,
    totalDays,
  };
}
