"use client";

import { useEffect, useState, useCallback, useMemo, useRef } from "react";
import { motion } from "framer-motion";
import { Moon, ChevronLeft, TrendingUp, Target, Calendar, Clock } from "lucide-react";
import Link from "next/link";
import { useHealthStore } from "@/lib/store/healthStore";
import type { SleepLog, SleepGoalV2 } from "@/lib/db/health.db";
import { showToast } from "@/components/ui/Toast";
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip,
  ReferenceLine, ResponsiveContainer,
} from "recharts";

// ─── Helpers ─────────────────────────────────────────────────

const todayStr = () => new Date().toISOString().slice(0, 10);

function timeToMinutes(t: string): number {
  const [h, m] = t.split(":").map(Number);
  return h * 60 + m;
}

function minutesToTime(m: number): string {
  const h = Math.floor(m / 60) % 24;
  const min = m % 60;
  return `${String(h).padStart(2, "0")}:${String(min).padStart(2, "0")}`;
}

function subtractMinutes(time: string, mins: number): string {
  return minutesToTime(timeToMinutes(time) - mins);
}

function get7Days(): string[] {
  const dates: string[] = [];
  for (let i = 6; i >= 0; i--) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    dates.push(d.toISOString().slice(0, 10));
  }
  return dates;
}

function get30Days(): string[] {
  const dates: string[] = [];
  for (let i = 29; i >= 0; i--) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    dates.push(d.toISOString().slice(0, 10));
  }
  return dates;
}

// ─── Skeleton ────────────────────────────────────────────────

function SkeletonCard({ className = "" }: { className?: string }) {
  return (
    <div className={`bg-white rounded-2xl shadow-sm p-4 mb-4 animate-pulse ${className}`}>
      <div className="h-4 bg-gray-200 rounded w-1/3 mb-4" />
      <div className="h-6 bg-gray-200 rounded w-2/3 mb-3" />
      <div className="h-3 bg-gray-200 rounded w-1/2" />
    </div>
  );
}

// ─── Main Component ──────────────────────────────────────────

export default function SleepPage() {
  const {
    sleepLogs,
    todaySleepLog,
    sleepGoalV2,
    loading,
    loadSleepData,
    saveSleepLog,
    updateSleepGoalV2,
  } = useHealthStore();

  const [calDate, setCalDate] = useState(todayStr());
  const [calTime, setCalTime] = useState("23:30");
  const [isSaving, setIsSaving] = useState(false);

  const hasLoaded = useRef(false);

  useEffect(() => {
    if (!hasLoaded.current) {
      hasLoaded.current = true;
      loadSleepData();
    }
  }, [loadSleepData]);

  // ─── Derived Data ──────────────────────────────────────────

  const targetMinutes = useMemo(
    () => timeToMinutes(sleepGoalV2.targetTime),
    [sleepGoalV2.targetTime]
  );

  const todayActualMinutes = todaySleepLog
    ? timeToMinutes(todaySleepLog.actualTime)
    : null;

  const todayDiff = todayActualMinutes !== null
    ? todayActualMinutes - targetMinutes
    : null;

  // Progress bar color
  const progressColor = todayDiff !== null
    ? todayDiff <= 0
      ? "#34C759"
      : todayDiff <= 60
        ? "#FF9500"
        : "#FF3B30"
    : "#E5E5EA";

  // Status text
  const statusText = todaySleepLog
    ? todayDiff! <= 0
      ? `比目标早 ${Math.abs(todayDiff!)} 分钟 ✓`
      : `超时 ${todayDiff!} 分钟`
    : "暂无今日记录，点击下方记录入睡时间";

  // Progress bar width (20:00 to 02:00 range as a percentage)
  const progressPercent = todayActualMinutes !== null
    ? Math.min(100, Math.max(0, ((todayActualMinutes - 1200) / 360) * 100))
    : 0;

  // Consecutive days
  const consecutiveDays = useMemo(() => {
    if (sleepLogs.length === 0) return 0;
    const sorted = [...sleepLogs].sort((a, b) => b.date.localeCompare(a.date));
    let count = 0;
    const today = todayStr();
    for (let i = 0; i < 365; i++) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      const dateStr = d.toISOString().slice(0, 10);
      if (dateStr > today) continue;
      const log = sorted.find((l) => l.date === dateStr);
      if (log && log.isOnTime) {
        count++;
      } else if (dateStr === today && !log) {
        continue;
      } else {
        break;
      }
    }
    return count;
  }, [sleepLogs]);

  // 30-day average
  const thirtyDayAvg = useMemo(() => {
    const date30 = get30Days();
    const logsIn30 = sleepLogs.filter((l) => date30.includes(l.date));
    if (logsIn30.length === 0) return null;
    const totalMin = logsIn30.reduce((sum, l) => sum + timeToMinutes(l.actualTime), 0);
    const avgMin = Math.round(totalMin / logsIn30.length);
    return { time: minutesToTime(avgMin), count: logsIn30.length };
  }, [sleepLogs]);

  // Chart data
  const chartData = useMemo(() => {
    const dates = get7Days();
    const logMap = new Map(sleepLogs.map((l) => [l.date, l]));
    return dates.map((date) => {
      const log = logMap.get(date);
      const d = new Date(date);
      const label = `${String(d.getMonth() + 1).padStart(2, "0")}/${String(d.getDate()).padStart(2, "0")}`;
      return {
        date: label,
        actualMinutes: log ? timeToMinutes(log.actualTime) : null,
        targetMinutes,
      };
    });
  }, [sleepLogs, targetMinutes]);

  const hasAnyChartData = chartData.some((d) => d.actualMinutes !== null);

  // Reminder time
  const reminderTime = useMemo(
    () => subtractMinutes(sleepGoalV2.targetTime, sleepGoalV2.reminderAdvance),
    [sleepGoalV2.targetTime, sleepGoalV2.reminderAdvance]
  );

  // ─── Handlers ──────────────────────────────────────────────

  const handleLogSleep = useCallback(async () => {
    const now = new Date();
    const actualTime = `${String(now.getHours()).padStart(2, "0")}:${String(now.getMinutes()).padStart(2, "0")}`;
    const actualMin = timeToMinutes(actualTime);
    const diff = actualMin - targetMinutes;
    const isOnTime = diff <= 0;

    setIsSaving(true);
    try {
      await saveSleepLog({
        date: todayStr(),
        targetTime: sleepGoalV2.targetTime,
        actualTime,
        isOnTime,
        minutesDiff: diff,
      });
      showToast({ message: "已记录入睡时间", type: "success", duration: 2000 });
    } catch {
      showToast({ message: "记录失败", type: "error", duration: 2000 });
    } finally {
      setIsSaving(false);
    }
  }, [saveSleepLog, targetMinutes, sleepGoalV2.targetTime]);

  const handleCalibrate = useCallback(async () => {
    const actualMin = timeToMinutes(calTime);
    const diff = actualMin - targetMinutes;
    const isOnTime = diff <= 0;

    setIsSaving(true);
    try {
      await saveSleepLog({
        date: calDate,
        targetTime: sleepGoalV2.targetTime,
        actualTime: calTime,
        isOnTime,
        minutesDiff: diff,
      });
      showToast({ message: "校准已保存", type: "success", duration: 2000 });
    } catch {
      showToast({ message: "保存失败", type: "error", duration: 2000 });
    } finally {
      setIsSaving(false);
    }
  }, [saveSleepLog, calDate, calTime, targetMinutes, sleepGoalV2.targetTime]);

  const handleGoalTimeChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      updateSleepGoalV2({ targetTime: e.target.value });
    },
    [updateSleepGoalV2]
  );

  const handleReminderAdvanceChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      updateSleepGoalV2({ reminderAdvance: Number(e.target.value) });
    },
    [updateSleepGoalV2]
  );

  // ─── Chart Y-axis ticks ────────────────────────────────────

  const yTicks = useMemo(() => {
    const ticks: number[] = [];
    for (let m = 1260; m <= 1560; m += 60) {
      ticks.push(m);
    }
    return ticks;
  }, []);

  const formatYAxis = (minutes: number) => {
    const h = Math.floor(minutes / 60);
    const m = minutes % 60;
    return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
  };

  const CustomTooltip = ({ active, payload }: any) => {
    if (!active || !payload || payload.length === 0) return null;
    const data = payload[0].payload;
    return (
      <div className="bg-white rounded-xl shadow-lg border border-gray-100 p-3 text-sm">
        <p className="text-gray-500 mb-1">{data.date}</p>
        {data.actualMinutes !== null && (
          <p className="text-[#5856D6] font-semibold">
            入睡: {minutesToTime(data.actualMinutes)}
          </p>
        )}
        <p className="text-[#34C759] font-semibold">
          目标: {minutesToTime(data.targetMinutes)}
        </p>
      </div>
    );
  };

  // ─── Loading State ─────────────────────────────────────────

  if (loading && sleepLogs.length === 0) {
    return (
      <div className="min-h-screen bg-[#F5F5F7] pb-24">
        <div className="max-w-2xl mx-auto px-5 pt-8">
          <div className="flex items-center gap-3 mb-6">
            <Link href="/health">
              <div className="w-9 h-9 rounded-full bg-white shadow-sm flex items-center justify-center">
                <ChevronLeft className="w-5 h-5 text-gray-500" />
              </div>
            </Link>
            <div>
              <div className="h-6 bg-gray-200 rounded w-24" />
              <div className="h-4 bg-gray-200 rounded w-32 mt-1" />
            </div>
          </div>
          <SkeletonCard />
          <SkeletonCard />
          <SkeletonCard />
          <SkeletonCard className="h-52" />
        </div>
      </div>
    );
  }

  // ─── Render ────────────────────────────────────────────────

  return (
    <div className="min-h-screen bg-[#F5F5F7] pb-28">
      <div className="max-w-2xl mx-auto px-5 pt-8">
        {/* Header */}
        <div className="flex items-center gap-3 mb-6">
          <Link href="/health">
            <button className="w-9 h-9 rounded-full bg-white shadow-sm flex items-center justify-center hover:bg-gray-50 transition-colors">
              <ChevronLeft className="w-5 h-5 text-gray-500" />
            </button>
          </Link>
          <div>
            <h1 className="text-2xl font-bold text-gray-900">睡眠追踪</h1>
            <p className="text-sm text-gray-500 mt-0.5">规律作息，早睡早起</p>
          </div>
        </div>

        {/* 1. Today's Sleep Card */}
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-gradient-to-br from-indigo-500 to-purple-600 rounded-2xl shadow-md p-5 mb-4 text-white"
        >
          <div className="flex items-center gap-2 mb-3">
            <Moon className="w-5 h-5" />
            <span className="text-sm font-medium opacity-90">今日入睡</span>
          </div>

          {todaySleepLog ? (
            <>
              <div className="flex items-end justify-between mb-3">
                <div>
                  <div className="text-3xl font-bold">{todaySleepLog.actualTime}</div>
                  <div className="text-sm opacity-70 mt-0.5">
                    目标 {sleepGoalV2.targetTime}
                  </div>
                </div>
                <div
                  className="text-sm font-medium px-3 py-1 rounded-full"
                  style={{
                    backgroundColor:
                      todayDiff !== null && todayDiff <= 0
                        ? "rgba(52,199,89,0.25)"
                        : todayDiff !== null && todayDiff <= 60
                          ? "rgba(255,149,0,0.25)"
                          : "rgba(255,59,48,0.25)",
                  }}
                >
                  {statusText}
                </div>
              </div>

              {/* Progress bar */}
              <div className="relative h-3 bg-white/20 rounded-full overflow-hidden">
                <div
                  className="absolute top-0 left-0 h-full rounded-full transition-all duration-500"
                  style={{
                    width: `${progressPercent}%`,
                    backgroundColor: progressColor,
                  }}
                />
                {/* Target marker */}
                <div
                  className="absolute top-0 h-full w-0.5 bg-white/60"
                  style={{
                    left: `${((targetMinutes - 1200) / 360) * 100}%`,
                  }}
                />
              </div>
              <div className="flex justify-between text-xs opacity-60 mt-1">
                <span>20:00</span>
                <span>目标 {sleepGoalV2.targetTime}</span>
                <span>02:00</span>
              </div>
            </>
          ) : (
            <div className="py-4 text-center">
              <Moon className="w-10 h-10 mx-auto opacity-30 mb-2" />
              <p className="text-sm opacity-70">暂无今日记录，点击下方记录入睡时间</p>
            </div>
          )}
        </motion.div>

        {/* 2. Consecutive Days Card */}
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.04 }}
          className="bg-white rounded-2xl shadow-sm p-4 mb-4"
        >
          <div className="flex items-center gap-2 mb-2">
            <TrendingUp className="w-4 h-4 text-[#34C759]" />
            <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide">连续早睡</h2>
          </div>
          {consecutiveDays > 0 ? (
            <div className="flex items-baseline gap-2">
              <span className="text-3xl font-bold text-[#34C759]">{consecutiveDays}</span>
              <span className="text-lg text-gray-600">天</span>
              <span className="text-sm text-gray-400 ml-1">连续早睡</span>
            </div>
          ) : (
            <div>
              <span className="text-2xl font-bold text-gray-300">0</span>
              <p className="text-sm text-gray-400 mt-1">暂无连续早睡记录，从今天开始吧</p>
            </div>
          )}
        </motion.div>

        {/* 3. Goal Settings Card */}
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.08 }}
          className="bg-white rounded-2xl shadow-sm p-4 mb-4"
        >
          <div className="flex items-center gap-2 mb-4">
            <Target className="w-4 h-4 text-[#FF9500]" />
            <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide">目标设置</h2>
          </div>

          {/* Time picker */}
          <div className="mb-4">
            <label className="text-sm font-medium text-gray-700 block mb-2">目标入睡时间</label>
            <input
              type="time"
              value={sleepGoalV2.targetTime}
              onChange={handleGoalTimeChange}
              className="w-full px-4 py-2.5 rounded-xl border border-gray-200 text-gray-700 text-sm
                         focus:outline-none focus:ring-2 focus:ring-[#FF9500]/30 focus:border-[#FF9500]
                         bg-gray-50 transition-colors"
            />
          </div>

          {/* Reminder slider */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="text-sm font-medium text-gray-700">提前提醒</label>
              <span className="text-sm text-[#5856D6] font-semibold">{sleepGoalV2.reminderAdvance} 分钟</span>
            </div>
            <div className="relative">
              <input
                type="range"
                min={5}
                max={60}
                step={5}
                value={sleepGoalV2.reminderAdvance}
                onChange={handleReminderAdvanceChange}
                className="w-full appearance-none h-2 rounded-full cursor-pointer"
                style={{
                  background: `linear-gradient(to right, #5856D6 0%, #5856D6 ${((sleepGoalV2.reminderAdvance - 5) / 55) * 100}%, #E5E5EA ${((sleepGoalV2.reminderAdvance - 5) / 55) * 100}%, #E5E5EA 100%)`,
                }}
              />
            </div>
            <div className="flex justify-between text-xs text-gray-400 mt-1">
              <span>5分钟</span>
              <span>60分钟</span>
            </div>
          </div>

          {/* Reminder time display */}
          <div className="mt-4 pt-3 border-t border-gray-100">
            <div className="flex items-center gap-2 text-sm">
              <Clock className="w-4 h-4 text-[#5856D6]" />
              <span className="text-gray-500">提醒时间:</span>
              <span className="text-[#5856D6] font-semibold">{reminderTime}</span>
            </div>
          </div>
        </motion.div>

        {/* 4. 30-Day Average Card */}
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.12 }}
          className="bg-white rounded-2xl shadow-sm p-4 mb-4"
        >
          <div className="flex items-center gap-2 mb-2">
            <Calendar className="w-4 h-4 text-[#FF9500]" />
            <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide">30天平均</h2>
          </div>
          {thirtyDayAvg ? (
            <div>
              <span className="text-2xl font-bold text-gray-800">
                30天平均入睡: {thirtyDayAvg.time}
              </span>
              <span className="text-sm text-gray-400 ml-2">({thirtyDayAvg.count}天数据)</span>
            </div>
          ) : (
            <p className="text-sm text-gray-400">暂无数据</p>
          )}
        </motion.div>

        {/* 5. Sleep Trend Chart */}
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.16 }}
          className="bg-white rounded-2xl shadow-sm p-4 mb-4"
        >
          <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-3">近7天入睡趋势</h2>

          {hasAnyChartData ? (
            <div className="h-56">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart
                  data={chartData}
                  margin={{ top: 10, right: 10, left: 0, bottom: 10 }}
                >
                  <CartesianGrid strokeDasharray="3 3" stroke="#F0F0F0" />
                  <XAxis
                    dataKey="date"
                    tick={{ fontSize: 12, fill: "#9CA3AF" }}
                    axisLine={{ stroke: "#E5E5EA" }}
                    tickLine={false}
                  />
                  <YAxis
                    domain={[1560, 1260]}
                    ticks={yTicks}
                    tickFormatter={formatYAxis}
                    tick={{ fontSize: 11, fill: "#9CA3AF" }}
                    axisLine={false}
                    tickLine={false}
                    width={48}
                    reversed
                  />
                  <Tooltip content={<CustomTooltip />} />
                  <ReferenceLine
                    y={targetMinutes}
                    stroke="#34C759"
                    strokeDasharray="6 4"
                    label={{
                      value: `目标 ${sleepGoalV2.targetTime}`,
                      position: "insideBottomRight",
                      fill: "#34C759",
                      fontSize: 11,
                    }}
                  />
                  <Line
                    type="monotone"
                    dataKey="actualMinutes"
                    stroke="#5856D6"
                    strokeWidth={2.5}
                    dot={{
                      r: 4,
                      fill: "#5856D6",
                      stroke: "#fff",
                      strokeWidth: 2,
                    }}
                    activeDot={{
                      r: 6,
                      fill: "#5856D6",
                      stroke: "#fff",
                      strokeWidth: 2,
                    }}
                    connectNulls={false}
                    name="实际入睡"
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
          ) : (
            <div className="flex items-center justify-center h-48">
              <p className="text-sm text-gray-400">暂无数据</p>
            </div>
          )}
        </motion.div>

        {/* 6. Manual Calibration */}
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="bg-white rounded-2xl shadow-sm p-4 mb-4"
        >
          <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-4">手动校准</h2>

          <div className="space-y-3">
            {/* Date picker */}
            <div>
              <label className="text-xs text-gray-500 mb-1 block">日期</label>
              <input
                type="date"
                value={calDate}
                onChange={(e) => setCalDate(e.target.value)}
                max={todayStr()}
                className="w-full px-4 py-2.5 rounded-xl border border-gray-200 text-sm text-gray-700
                           focus:outline-none focus:ring-2 focus:ring-[#FF9500]/30 focus:border-[#FF9500]
                           bg-gray-50 transition-colors"
              />
            </div>

            {/* Time picker */}
            <div>
              <label className="text-xs text-gray-500 mb-1 block">入睡时间</label>
              <input
                type="time"
                value={calTime}
                onChange={(e) => setCalTime(e.target.value)}
                className="w-full px-4 py-2.5 rounded-xl border border-gray-200 text-sm text-gray-700
                           focus:outline-none focus:ring-2 focus:ring-[#FF9500]/30 focus:border-[#FF9500]
                           bg-gray-50 transition-colors"
              />
            </div>

            <button
              onClick={handleCalibrate}
              disabled={isSaving}
              className="w-full py-2.5 rounded-xl bg-[#FF9500] text-white text-sm font-semibold
                         hover:bg-[#E68600] active:scale-[0.98] transition-all duration-200
                         disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isSaving ? "保存中..." : "保存校准"}
            </button>
          </div>
        </motion.div>
      </div>

      {/* 7. FAB Button - "准备睡觉" */}
      <motion.button
        initial={{ opacity: 0, scale: 0.8 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ delay: 0.3 }}
        onClick={handleLogSleep}
        disabled={isSaving || !!todaySleepLog}
        className="fixed bottom-8 right-6 z-50 w-16 h-16 rounded-full shadow-lg
                   bg-gradient-to-br from-indigo-500 to-purple-600
                   flex items-center justify-center
                   hover:shadow-xl hover:scale-105 active:scale-95
                   transition-all duration-200
                   disabled:opacity-60 disabled:cursor-not-allowed disabled:hover:scale-100"
        title="准备睡觉"
      >
        <Moon className="w-7 h-7 text-white" />
      </motion.button>
    </div>
  );
}
