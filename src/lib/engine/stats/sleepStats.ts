// ============================================================
// 统计计算 — 睡眠统计
// ============================================================

import { db } from '@/lib/db';
import type { SleepRecord } from '@/lib/types';

export interface SleepStats {
  avgDuration: number;    // 小时
  avgQuality: number;     // 1-10
  onTimeRate: number;     // 百分比（在目标时间内入睡的比例）
  trend: Array<{ date: string; duration: number; quality: number }>;
  totalRecords: number;
}

/**
 * 计算睡眠统计
 */
export async function calculateSleepStats(
  range: { start: string; end: string },
): Promise<SleepStats> {
  const allRecords = await db.sleepRecords.toArray();
  const records = allRecords.filter((r) => r.date >= range.start && r.date <= range.end);

  if (records.length === 0) {
    return { avgDuration: 0, avgQuality: 0, onTimeRate: 0, trend: [], totalRecords: 0 };
  }

  const durations = records.map((r) => r.sleepDuration);
  const avgDuration = Math.round((durations.reduce((s, d) => s + d, 0) / durations.length) * 10) / 10;

  const qualities = records.map((r) => r.sleepQuality);
  const avgQuality = Math.round((qualities.reduce((s, q) => s + q, 0) / qualities.length) * 10) / 10;

  // 达标率：默认目标23:00入睡
  const onTimeCount = records.filter((r) => r.sleepTime <= '23:00').length;
  const onTimeRate = Math.round((onTimeCount / records.length) * 100);

  const trend = records.slice(-7).map((r) => ({
    date: r.date,
    duration: r.sleepDuration,
    quality: r.sleepQuality,
  }));

  return {
    avgDuration,
    avgQuality,
    onTimeRate,
    trend,
    totalRecords: records.length,
  };
}
