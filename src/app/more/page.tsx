"use client";

import { useState, useMemo, useCallback } from "react";
import Link from "next/link";
import { motion } from "framer-motion";
import { useLiveQuery } from "dexie-react-hooks";
import { Droplets, Moon, Dumbbell } from "lucide-react";
import {
  healthDB,
  getWaterLogsByDate,
  getWaterGoal,
  getSleepLogByDate,
  getSleepLogs,
  getWorkoutSessionByDate,
  addWaterLog,
} from "@/lib/db/health.db";
import type { WaterLog, SleepLog, WorkoutSession } from "@/lib/db/health.db";

/* ────────── Helpers ────────── */

function todayStr(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function clamp(v: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, v));
}

function formatWater(ml: number): string {
  if (ml >= 1000) return (ml / 1000).toFixed(1) + "L";
  return ml + "ml";
}

/* ────────── Constants ────────── */

const PILLS = ["总览", "规划", "回顾", "助手", "统计"] as const;
const QUICK_DRINK_AMOUNTS = [100, 200, 300, 500] as const;

/* ────────── Component ────────── */

export default function HealthOverviewPage() {
  const [activePill, setActivePill] = useState<string>("总览");
  const [addingMap, setAddingMap] = useState<Record<number, boolean>>({});
  const [toastMsg, setToastMsg] = useState<string | null>(null);

  const today = todayStr();
  const now = new Date();
  const dateLabel = `${now.getMonth() + 1}月${now.getDate()}日`;

  /* ─── Live Queries ─── */

  const waterLogs = useLiveQuery(() => getWaterLogsByDate(today), [today], [] as WaterLog[]);
  const waterGoal = useLiveQuery(() => getWaterGoal(), []);
  const sleepLog = useLiveQuery(() => getSleepLogByDate(today), [today]) as SleepLog | undefined;
  const workoutSession = useLiveQuery(
    () => getWorkoutSessionByDate(today),
    [today],
  ) as WorkoutSession | undefined;
  const recentSleepLogs = useLiveQuery(() => getSleepLogs(30), [], [] as SleepLog[]);

  /* ─── Weekly Water ─── */

  const weeklyWater = useLiveQuery(
    async () => {
      const results: { label: string; total: number }[] = [];
      for (let i = 6; i >= 0; i--) {
        const d = new Date();
        d.setDate(d.getDate() - i);
        const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
        const logs = await getWaterLogsByDate(key);
        results.push({
          label: ["日", "一", "二", "三", "四", "五", "六"][d.getDay()],
          total: logs.reduce((s, l) => s + l.amount, 0),
        });
      }
      return results;
    },
    [],
    [] as { label: string; total: number }[],
  );

  /* ─── Derived ─── */

  const dailyTarget = waterGoal?.dailyTarget ?? 2000;
  const waterTotal = (waterLogs ?? []).reduce((s, l) => s + l.amount, 0);

  const workoutSets =
    workoutSession?.exercises?.reduce((s, ex) => s + ex.sets.length, 0) ?? 0;
  const workoutExerciseCount = workoutSession?.exercises?.length ?? 0;

  /* ─── Health Score ─── */

  const healthScore = useMemo(() => {
    const W = clamp(waterTotal / Math.max(dailyTarget, 1), 0, 1);
    let S = 0;
    if (sleepLog) {
      if (sleepLog.isOnTime) S = 1;
      else S = clamp(1 - sleepLog.minutesDiff / 120, 0, 1);
    }
    const T = clamp(workoutSets / 3, 0, 1);
    return Math.round(((W + S + T) / 3) * 100);
  }, [waterTotal, dailyTarget, sleepLog, workoutSets]);

  /* ─── Sleep ─── */

  const sleepProgress = useMemo(() => {
    if (!sleepLog) return 0;
    if (sleepLog.minutesDiff <= 0) return 100;
    return Math.max(0, 100 - (sleepLog.minutesDiff / 60) * 100);
  }, [sleepLog]);

  const consecutiveDays = useMemo(() => {
    const logs = recentSleepLogs ?? [];
    if (logs.length === 0) return 0;
    const sorted = [...logs].sort((a, b) => b.date.localeCompare(a.date));
    let count = 0;
    const start = new Date();
    for (let i = 0; i < sorted.length; i++) {
      const expected = new Date(start);
      expected.setDate(expected.getDate() - i);
      const expectedDate = `${expected.getFullYear()}-${String(expected.getMonth() + 1).padStart(2, "0")}-${String(expected.getDate()).padStart(2, "0")}`;
      const log = sorted.find((l) => l.date === expectedDate);
      if (log && log.isOnTime) count++;
      else break;
    }
    return count;
  }, [recentSleepLogs]);

  /* ─── SVG Ring ─── */

  const ringSize = 150;
  const ringCenter = 75;
  const ringRadius = 68;
  const ringStroke = 14;
  const circumference = 2 * Math.PI * ringRadius;
  const ringDashOffset = circumference * (1 - healthScore / 100);

  /* ─── Bar chart ─── */

  const maxWeeklyWater = useMemo(() => {
    const max = Math.max(...weeklyWater.map((d) => d.total), 1);
    return max;
  }, [weeklyWater]);

  /* ─── Actions ─── */

  const showToast = useCallback((msg: string) => {
    setToastMsg(msg);
    setTimeout(() => setToastMsg(null), 1500);
  }, []);

  const handleQuickDrink = useCallback(
    async (amount: number) => {
      if (addingMap[amount]) return;
      setAddingMap((p) => ({ ...p, [amount]: true }));
      try {
        await addWaterLog({ date: today, amount, timestamp: Date.now() });
      } finally {
        setAddingMap((p) => ({ ...p, [amount]: false }));
      }
    },
    [today, addingMap],
  );

  const handlePillClick = useCallback(
    (pill: string) => {
      if (pill !== "总览") {
        showToast("功能开发中");
        return;
      }
      setActivePill(pill);
    },
    [showToast],
  );

  /* ────────── Render ────────── */

  return (
    <div className="min-h-screen bg-[#FAFAFA] max-w-[430px] mx-auto pb-[100px]">
      {/* Toast overlay */}
      {toastMsg && (
        <motion.div
          initial={{ opacity: 0, y: -8 }}
          animate={{ opacity: 1, y: 0 }}
          className="fixed top-20 left-1/2 -translate-x-1/2 z-50 bg-[#1D1D1F]/80 text-white text-[14px] px-5 py-2.5 rounded-full pointer-events-none"
        >
          {toastMsg}
        </motion.div>
      )}

      {/* ─── Header ─── */}
      <div className="px-4 pt-9">
        <div className="flex items-end justify-between">
          <h1 className="text-[32px] font-bold text-[#1D1D1F]">健康</h1>
          <span className="text-[15px] text-[#86868B]">{dateLabel}</span>
        </div>
      </div>

      {/* ─── Pill Navigation ─── */}
      <div className="mt-4 px-4 flex gap-2">
        {PILLS.map((pill) => (
          <motion.button
            key={pill}
            type="button"
            whileTap={{ scale: 0.95 }}
            onClick={() => handlePillClick(pill)}
            className={`h-8 px-4 rounded-full text-[13px] transition-colors ${
              activePill === pill
                ? "bg-[#5865F2] text-white font-semibold"
                : "bg-[#F5F5F5] text-[#86868B] opacity-50"
            }`}
          >
            {pill}
          </motion.button>
        ))}
      </div>

      {/* ─── Health Index Ring Card ─── */}
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.35, ease: [0.32, 0.72, 0, 1] }}
        className="mx-4 mt-5 bg-white rounded-[24px] border border-[#EBEBEB] p-5"
      >
        {/* Ring */}
        <div className="flex justify-center">
          <div className="relative" style={{ width: ringSize, height: ringSize }}>
            <svg
              width={ringSize}
              height={ringSize}
              className="-rotate-90"
              viewBox={`0 0 ${ringSize} ${ringSize}`}
            >
              <circle
                cx={ringCenter}
                cy={ringCenter}
                r={ringRadius}
                fill="none"
                stroke="#F5F5F5"
                strokeWidth={ringStroke}
                strokeLinecap="round"
              />
              <motion.circle
                cx={ringCenter}
                cy={ringCenter}
                r={ringRadius}
                fill="none"
                stroke="#5865F2"
                strokeWidth={ringStroke}
                strokeLinecap="round"
                strokeDasharray={circumference}
                initial={{ strokeDashoffset: circumference }}
                animate={{ strokeDashoffset: ringDashOffset }}
                transition={{ duration: 0.8, ease: [0.32, 0.72, 0, 1] }}
              />
            </svg>
            <div className="absolute inset-0 flex flex-col items-center justify-center">
              <motion.span
                key={healthScore}
                initial={{ scale: 0.8, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                className="text-[56px] font-bold text-[#1D1D1F] leading-none"
              >
                {healthScore}
              </motion.span>
              <span className="text-[15px] text-[#86868B] mt-1">健康指数</span>
            </div>
          </div>
        </div>

        {/* 3 columns */}
        <div className="mt-6 flex">
          <div className="flex-1 flex flex-col items-center">
            <span className="text-[20px] font-bold text-[#1D1D1F]">
              {formatWater(waterTotal)}
            </span>
            <span className="text-[13px] text-[#86868B] mt-0.5">饮水</span>
          </div>
          <div className="w-px bg-[#EBEBEB]" />
          <div className="flex-1 flex flex-col items-center">
            <span className="text-[20px] font-bold text-[#1D1D1F]">
              {sleepLog?.actualTime ?? "--"}
            </span>
            <span className="text-[13px] text-[#86868B] mt-0.5">睡眠</span>
          </div>
          <div className="w-px bg-[#EBEBEB]" />
          <div className="flex-1 flex flex-col items-center">
            <span className="text-[20px] font-bold text-[#1D1D1F]">
              {workoutSets}组
            </span>
            <span className="text-[13px] text-[#86868B] mt-0.5">训练</span>
          </div>
        </div>
      </motion.div>

      {/* ─── Water Card ─── */}
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.05, duration: 0.35, ease: [0.32, 0.72, 0, 1] }}
        className="mx-4 mt-4"
      >
        <Link href="/more/water">
          <div className="bg-white rounded-[24px] border border-[#EBEBEB] p-5">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Droplets className="w-5 h-5 text-[#5865F2]" />
                <h2 className="text-[24px] font-bold text-[#1D1D1F]">饮水</h2>
              </div>
              <span className="text-[24px] font-bold text-[#5865F2]">
                {waterTotal} / {dailyTarget} ml
              </span>
            </div>
            {/* Progress bar */}
            <div className="mt-4 h-[6px] rounded-full bg-[#F5F5F5] overflow-hidden">
              <motion.div
                className="h-[6px] rounded-full bg-[#5865F2]"
                initial={{ width: 0 }}
                animate={{
                  width: `${Math.min(100, (waterTotal / Math.max(dailyTarget, 1)) * 100)}%`,
                }}
                transition={{ duration: 0.6, ease: [0.32, 0.72, 0, 1] }}
              />
            </div>
            {/* Quick drink pills */}
            <div className="mt-4 flex gap-2">
              {QUICK_DRINK_AMOUNTS.map((amount) => (
                <motion.button
                  key={amount}
                  type="button"
                  whileTap={{ scale: 0.95 }}
                  disabled={addingMap[amount]}
                  onClick={(e) => {
                    e.preventDefault();
                    handleQuickDrink(amount);
                  }}
                  className="h-8 px-5 rounded-full bg-[#F5F5F5] text-[15px] text-[#1D1D1F] disabled:opacity-50"
                >
                  +{amount}ml
                </motion.button>
              ))}
            </div>
          </div>
        </Link>
      </motion.div>

      {/* ─── Sleep Card ─── */}
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1, duration: 0.35, ease: [0.32, 0.72, 0, 1] }}
        className="mx-4 mt-4"
      >
        <Link href="/more/sleep">
          <div className="bg-white rounded-[24px] border border-[#EBEBEB] p-5">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Moon className="w-5 h-5 text-[#5865F2]" />
                <h2 className="text-[18px] font-bold text-[#1D1D1F]">睡眠</h2>
              </div>
              <span className="text-[20px] font-bold text-[#1D1D1F]">
                {sleepLog?.actualTime ?? "--"}
              </span>
            </div>
            <div className="mt-4 flex items-center gap-3">
              <span className="text-[13px] text-[#86868B] flex-shrink-0">
                昨晚 {sleepLog?.actualTime ?? "--"}
              </span>
              <div className="flex-1 h-[6px] rounded-full bg-[#F5F5F5] overflow-hidden">
                <motion.div
                  className="h-[6px] rounded-full bg-[#5865F2]"
                  initial={{ width: 0 }}
                  animate={{ width: `${sleepProgress}%` }}
                  transition={{ duration: 0.6, ease: [0.32, 0.72, 0, 1] }}
                />
              </div>
              <span className="text-[13px] text-[#86868B] flex-shrink-0">
                目标 {sleepLog?.targetTime ?? "--"}
              </span>
            </div>
            <div className="mt-3 flex items-center gap-4">
              {sleepLog && (
                <span className="text-[13px] text-[#86868B]">
                  比目标{sleepLog.minutesDiff > 0 ? "晚" : "早"}{" "}
                  {Math.abs(sleepLog.minutesDiff)} 分钟
                </span>
              )}
              <span className="text-[13px] text-[#86868B]">
                连续准点 · {consecutiveDays} 天
              </span>
            </div>
          </div>
        </Link>
      </motion.div>

      {/* ─── Training Card ─── */}
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.15, duration: 0.35, ease: [0.32, 0.72, 0, 1] }}
        className="mx-4 mt-4"
      >
        <Link href="/more/fitness">
          <div className="bg-white rounded-[24px] border border-[#EBEBEB] p-5">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Dumbbell className="w-5 h-5 text-[#5865F2]" />
                <h2 className="text-[18px] font-bold text-[#1D1D1F]">训练</h2>
              </div>
              <span className="text-[20px] font-bold text-[#1D1D1F]">
                {workoutSets} 组
              </span>
            </div>
            <p className="mt-1 text-[15px] text-[#86868B]">
              今日训练 · {workoutExerciseCount} 个动作
            </p>
            {workoutSession?.exercises && workoutSession.exercises.length > 0 && (
              <div className="mt-3 flex flex-col gap-2">
                {workoutSession.exercises.map((ex, i) => {
                  const firstSet = ex.sets[0];
                  return (
                    <div key={i} className="flex items-center gap-2">
                      <span className="w-2 h-2 rounded-full bg-[#5865F2] flex-shrink-0" />
                      <span className="text-[15px] text-[#1D1D1F] flex-1">
                        {ex.exerciseName}
                      </span>
                      <span className="text-[15px] text-[#86868B]">
                        {ex.sets.length}组
                        {firstSet && firstSet.weight > 0
                          ? `×${firstSet.weight}kg`
                          : ""}
                        {firstSet && firstSet.rpe > 0
                          ? ` RPE ${firstSet.rpe}`
                          : ""}
                      </span>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </Link>
      </motion.div>

      {/* ─── Weekly Trend ─── */}
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.2, duration: 0.35, ease: [0.32, 0.72, 0, 1] }}
        className="mx-4 mt-4"
      >
        <div className="bg-white rounded-[24px] border border-[#EBEBEB] p-5">
          <h2 className="text-[24px] font-bold text-[#1D1D1F] mb-4">本周趋势</h2>
          <div className="flex items-end justify-between h-[120px] gap-2">
            {weeklyWater.map((day, i) => {
              const barH =
                maxWeeklyWater > 0
                  ? Math.max(4, (day.total / maxWeeklyWater) * 110)
                  : 4;
              return (
                <div key={i} className="flex flex-col items-center gap-1 flex-1">
                  <motion.div
                    className="w-[20px] rounded-[6px] bg-[#5865F2]"
                    initial={{ height: 0 }}
                    animate={{ height: barH }}
                    transition={{
                      delay: 0.3 + i * 0.05,
                      duration: 0.5,
                      ease: [0.32, 0.72, 0, 1],
                    }}
                  />
                  <span className="text-[13px] text-[#86868B]">{day.label}</span>
                </div>
              );
            })}
          </div>
        </div>
      </motion.div>
    </div>
  );
}
