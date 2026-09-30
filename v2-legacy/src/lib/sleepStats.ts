"use client";

import { db } from "@/lib/db";

// ==================== 睡眠统计 ====================

export interface SleepLog {
  date: string;
  sleepTime: number; // minutes from midnight
  label: string;
}

export interface SleepStats {
  avgSleepTime: number;
  avgSleepLabel: string;
  targetMetDays: number;
  totalDays: number;
  targetMetRate: number;
  longestStreak: number;
  lateDays: number;
  weeklyTrend: (SleepLog & { timeLabel: string })[];
  monthlyHeatmap: (SleepLog | null)[];
  monthlyTimeline: { date: string; sleepTime: number; timeLabel: string }[];
}

function getLocalDate(d: Date = new Date()): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function shiftDate(date: string, days: number): string {
  const d = new Date(date + "T00:00:00");
  d.setDate(d.getDate() + days);
  return getLocalDate(d);
}

function formatTime(minutes: number): string {
  const h = Math.floor(minutes / 60);
  const m = Math.round(minutes % 60);
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}

function parseTargetTime(target: string): number {
  const [h, m] = target.split(":").map(Number);
  return h * 60 + m;
}

/** 加载睡眠日志（过去N天） */
export async function loadSleepLogs(days: number = 30): Promise<SleepLog[]> {
  const results: SleepLog[] = [];
  const today = getLocalDate();
  for (let i = days - 1; i >= 0; i--) {
    const date = shiftDate(today, -i);
    const ds = await db.daySchedules?.where("date").equals(date).first();
    if (!ds?.events) continue;

    let sleepMinutes = 0;
    let isNight = false;
    for (const ev of ds.events) {
      if (!ev.title?.includes("睡")) continue;
      const start = ev.actualStartTime || ev.startTime;
      if (!start) continue;
      const [sh, sm] = start.split(":").map(Number);
      const startMin = sh * 60 + sm;
      if (startMin >= 18 * 60 || startMin < 6 * 60) {
        sleepMinutes = startMin;
        isNight = true;
      }
    }
    if (isNight) {
      const d = new Date(date + "T00:00:00");
      const label = `${d.getMonth() + 1}/${d.getDate()}`;
      results.push({ date, sleepTime: sleepMinutes, label });
    }
  }
  return results;
}

export async function getSleepStats(
  logs: SleepLog[],
  targetTime: string = "23:30"
): Promise<SleepStats> {
  const targetMin = parseTargetTime(targetTime);

  // 平均入睡时间
  const avgMin = logs.length > 0
    ? logs.reduce((sum, l) => sum + l.sleepTime, 0) / logs.length
    : 0;
  const avgSleepLabel = formatTime(avgMin);

  // 达标天数（早于目标时间入睡）
  const targetMetDays = logs.filter((l) => l.sleepTime <= targetMin).length;
  const totalDays = logs.length || 1;
  const targetMetRate = Math.round((targetMetDays / totalDays) * 100);

  // 最长连续早睡
  let longestStreak = 0;
  let currentStreak = 0;
  for (const l of logs) {
    if (l.sleepTime <= targetMin) {
      currentStreak++;
      longestStreak = Math.max(longestStreak, currentStreak);
    } else {
      currentStreak = 0;
    }
  }

  // 晚睡天数（超过目标30分钟以上）
  const lateDays = logs.filter((l) => l.sleepTime > targetMin + 30).length;

  // 周趋势
  const weeklyTrend = logs.slice(-7).map((l) => ({
    ...l,
    timeLabel: formatTime(l.sleepTime),
  }));

  // 月度热力图
  const today = getLocalDate();
  const monthlyHeatmap: (SleepLog | null)[] = [];
  for (let i = 29; i >= 0; i--) {
    const date = shiftDate(today, -i);
    const found = logs.find((l) => l.date === date);
    monthlyHeatmap.push(found || null);
  }

  // 月度时间线
  const monthlyTimeline = logs.map((l) => ({
    date: l.date,
    sleepTime: l.sleepTime,
    timeLabel: formatTime(l.sleepTime),
  }));

  return {
    avgSleepTime: avgMin,
    avgSleepLabel,
    targetMetDays,
    totalDays,
    targetMetRate,
    longestStreak,
    lateDays,
    weeklyTrend,
    monthlyHeatmap,
    monthlyTimeline,
  };
}

export { formatTime, getLocalDate, shiftDate, parseTargetTime };
