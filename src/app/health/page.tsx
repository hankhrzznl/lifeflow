"use client";

import { useMemo, useCallback, useState } from "react";
import Link from "next/link";
import { motion } from "framer-motion";
import { useLiveQuery } from "dexie-react-hooks";
import { Droplets, Moon, Activity } from "lucide-react";
import {
  getWaterLogsByDate, getWaterGoal, addWaterLog,
  getSleepLogByDate, getSleepLogs, getSleepGoal,
  getWorkoutSessionByDate,
} from "@/lib/db/health.db";
import type { WaterLog } from "@/lib/db/health.db";

// ============================================================
// 设计令牌
// ============================================================
const ACCENT = "#5865F2";
const MUTED = "#86868B";

// ─── 工具函数 ──────────────────────────────────────────────
function todayStr(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}
function getWeekDates(): string[] {
  const now = new Date();
  const dayOfWeek = now.getDay();
  const monday = new Date(now);
  monday.setDate(now.getDate() - (dayOfWeek === 0 ? 6 : dayOfWeek - 1));
  const dates: string[] = [];
  for (let i = 0; i < 7; i++) {
    const d = new Date(monday);
    d.setDate(monday.getDate() + i);
    dates.push(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`);
  }
  return dates;
}
function fmtNum(n: number): string {
  return n.toLocaleString("zh-CN");
}
function fmtMinutes(minDiff: number): string {
  if (minDiff > 0) return `比目标晚 ${minDiff} 分钟`;
  if (minDiff < 0) return `比目标早 ${Math.abs(minDiff)} 分钟`;
  return "准点入睡";
}
function localDateStr(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

// ============================================================
// 主页
// ============================================================
export default function HealthPage() {
  const today = todayStr();
  const weekDates = useMemo(() => getWeekDates(), []);

  // ─── 今日数据 ────────────────────────────────────────────
  const todayWaterLogs = useLiveQuery(() => getWaterLogsByDate(today), [today], [] as WaterLog[]);
  const waterGoal = useLiveQuery(() => getWaterGoal(), [], { dailyTarget: 2000 });
  const todaySleepLog = useLiveQuery(() => getSleepLogByDate(today), [today], undefined);
  const todayWorkout = useLiveQuery(() => getWorkoutSessionByDate(today), [today], undefined);
  const sleepGoal = useLiveQuery(() => getSleepGoal(), [], { targetTime: "23:30" });

  // 本周饮水
  const weekWater = useLiveQuery(
    async () => {
      const results: number[] = [];
      for (const d of weekDates) {
        const logs = await getWaterLogsByDate(d);
        results.push(logs.reduce((s, l) => s + l.amount, 0));
      }
      return results;
    },
    [weekDates],
    [] as number[],
  );

  // 连续准点天数（直接查近 7 日 sleepLogs 计算）
  const consecutiveDays = useLiveQuery(async () => {
    const logs = await getSleepLogs(7);
    const sorted = [...logs].sort((a, b) => b.date.localeCompare(a.date));
    let count = 0;
    const startDate = new Date(today);
    for (let i = 0; i < sorted.length; i++) {
      const expected = new Date(startDate);
      expected.setDate(expected.getDate() - i);
      const expectedDate = localDateStr(expected);
      const log = sorted.find((l) => l.date === expectedDate);
      if (log && log.isOnTime) count++;
      else break;
    }
    return count;
  }, [today], 0);

  // ─── 派生 ────────────────────────────────────────────────
  const waterTotal = (todayWaterLogs ?? []).reduce((s, l) => s + l.amount, 0);
  const waterTarget = waterGoal?.dailyTarget ?? 2000;
  const waterPct = waterTarget > 0 ? Math.min(100, Math.round((waterTotal / waterTarget) * 100)) : 0;

  const sleepActual = todaySleepLog?.actualTime || null;
  const sleepTarget = todaySleepLog?.targetTime || sleepGoal?.targetTime || "23:30";
  const sleepIsOnTime = todaySleepLog?.isOnTime ?? false;
  const sleepMinDiff = todaySleepLog?.minutesDiff ?? 0;

  const workoutSets = todayWorkout ? todayWorkout.exercises.reduce((s, e) => s + e.sets.length, 0) : 0;
  const workoutExercises = todayWorkout?.exercises ?? [];

  // 健康指数
  const score = useMemo(() => {
    const W = waterTarget > 0 ? Math.min(waterTotal / waterTarget, 1) : 0;
    const S = !sleepActual ? 0 : sleepIsOnTime ? 1 : Math.max(0, 1 - sleepMinDiff / 120);
    const T = Math.min(workoutSets / 3, 1);
    return Math.round((W + S + T) / 3 * 100);
  }, [waterTotal, waterTarget, sleepActual, sleepIsOnTime, sleepMinDiff, workoutSets]);

  // 睡眠进度条
  const sleepBarPct = sleepMinDiff <= 0 ? 100 : Math.max(0, 100 - (sleepMinDiff / 60) * 100);

  // ─── 写入 ────────────────────────────────────────────────
  const [addingMl, setAddingMl] = useState<number | null>(null);
  const addWater = useCallback(async (ml: number) => {
    if (addingMl !== null) return;
    setAddingMl(ml);
    try {
      await addWaterLog({ date: today, amount: ml, timestamp: Date.now() });
    } finally {
      setAddingMl(null);
    }
  }, [today, addingMl]);

  // ============================================================
  // 渲染
  // ============================================================
  const cardAnim = (delay: number) => ({
    initial: { opacity: 0, y: 12 },
    animate: { opacity: 1, y: 0 },
    transition: { delay, duration: 0.35, ease: "easeOut" as const },
  });

  // 本周饮水柱状图
  const maxWeekWater = Math.max(...(weekWater ?? []), 0);

  return (
    <div className="px-4 pt-6 flex flex-col gap-7">
      {/* ===== 卡片 1 · 健康指数环卡 ===== */}
      <motion.div {...cardAnim(0)}
        className="bg-white rounded-[24px] border border-[#EBEBEB] p-5"
      >
        {/* 环形图 */}
        <div className="w-[150px] h-[150px] mx-auto relative">
          <svg viewBox="0 0 150 150" className="w-full h-full -rotate-90">
            <circle cx="75" cy="75" r="68" fill="none" stroke="#F5F5F5" strokeWidth={14} />
            <motion.circle
              cx="75" cy="75" r="68" fill="none" stroke={ACCENT} strokeWidth={14}
              strokeLinecap="round" pathLength={100}
              initial={{ strokeDasharray: "0 100" }}
              animate={{ strokeDasharray: `${score} 100` }}
              transition={{ duration: 0.6, ease: "easeOut" }}
            />
          </svg>
          {/* 中心文字 */}
          <div className="absolute inset-0 flex flex-col items-center justify-center">
            <span className="text-[56px] font-bold leading-none text-[#1D1D1F]">{score}</span>
            <span className="text-[15px] text-[#86868B] mt-1">健康指数</span>
          </div>
        </div>

        {/* 三指标行 */}
        <div className="mt-6 flex items-center justify-around">
          <div className="flex flex-col items-center">
            <span className="text-[20px] font-bold text-[#1D1D1F]">{fmtNum(waterTotal)}ml</span>
            <span className="text-[13px] text-[#86868B] mt-0.5">饮水</span>
          </div>
          <div className="w-px self-stretch bg-[#EBEBEB]" />
          <div className="flex flex-col items-center">
            <span className="text-[20px] font-bold text-[#1D1D1F]">
              {sleepActual || "--:--"}
            </span>
            <span className="text-[13px] text-[#86868B] mt-0.5">睡眠</span>
          </div>
          <div className="w-px self-stretch bg-[#EBEBEB]" />
          <div className="flex flex-col items-center">
            <span className="text-[20px] font-bold text-[#1D1D1F]">{workoutSets}组</span>
            <span className="text-[13px] text-[#86868B] mt-0.5">训练</span>
          </div>
        </div>
      </motion.div>

      {/* ===== 卡片 2 · 饮水卡 ===== */}
      <motion.div {...cardAnim(0.05)}
        className="bg-white rounded-[24px] border border-[#EBEBEB] p-5"
      >
        <Link href="/health/water">
          <motion.div whileTap={{ scale: 0.98 }} className="flex items-center justify-between cursor-pointer">
            <div className="flex items-center gap-2.5">
              <Droplets className="w-5 h-5 text-[#5865F2]" />
              <span className="text-[24px] font-bold text-[#1D1D1F]">饮水</span>
            </div>
            <div>
              <span className="text-[24px] font-bold text-[#5865F2]">{fmtNum(waterTotal)}</span>
              <span className="text-[15px] font-semibold text-[#5865F2]"> / {fmtNum(waterTarget)} ml</span>
            </div>
          </motion.div>
        </Link>

        {/* 进度条 */}
        <div className="mt-4 h-[6px] rounded-full bg-[#F5F5F5] w-full overflow-hidden">
          <motion.div
            initial={{ width: 0 }}
            animate={{ width: `${waterPct}%` }}
            transition={{ duration: 0.6, ease: "easeOut" }}
            className="h-[6px] rounded-full bg-[#5865F2]"
          />
        </div>

        {/* 快捷喝水 */}
        <div className="mt-4 flex gap-2 overflow-x-auto scrollbar-hide">
          {[100, 200, 300, 500].map((ml) => (
            <motion.button
              key={ml}
              type="button"
              whileTap={{ scale: 0.95 }}
              disabled={addingMl !== null}
              onClick={() => addWater(ml)}
              className="h-8 px-5 rounded-full bg-[#F5F5F5] text-[15px] text-[#1D1D1F] flex-shrink-0 disabled:opacity-50"
            >
              +{ml}ml
            </motion.button>
          ))}
        </div>
      </motion.div>

      {/* ===== 卡片 3 · 睡眠卡 ===== */}
      <motion.div {...cardAnim(0.1)}
        className="bg-white rounded-[24px] border border-[#EBEBEB] p-5"
      >
        <Link href="/health/sleep">
          <motion.div whileTap={{ scale: 0.98 }} className="flex items-center justify-between cursor-pointer">
            <div className="flex items-center gap-2.5">
              <Moon className="w-5 h-5 text-[#5865F2]" />
              <span className="text-[18px] font-bold text-[#1D1D1F]">睡眠</span>
            </div>
            <span className="text-[20px] font-bold text-[#1D1D1F]">
              {sleepActual || "--:--"}
            </span>
          </motion.div>
        </Link>

        {sleepActual ? (
          <>
            {/* 进度行 */}
            <div className="mt-4 flex items-center gap-3">
              <span className="text-[13px] text-[#86868B] shrink-0">昨晚 {sleepActual}</span>
              <div className="flex-1 h-[6px] rounded-full bg-[#F5F5F5] overflow-hidden">
                <motion.div
                  initial={{ width: 0 }}
                  animate={{ width: `${sleepBarPct}%` }}
                  transition={{ duration: 0.6, ease: "easeOut" }}
                  className="h-[6px] rounded-full bg-[#5865F2]"
                />
              </div>
              <span className="text-[13px] text-[#86868B] shrink-0">目标 {sleepTarget}</span>
            </div>
            {/* 附注行 */}
            <div className="mt-3 flex items-center justify-between">
              <span className="text-[13px] text-[#86868B]">{fmtMinutes(sleepMinDiff)}</span>
              <span className="text-[13px] text-[#86868B]">连续准点 · {consecutiveDays} 天</span>
            </div>
          </>
        ) : (
          <div className="py-2 text-[15px] text-[#86868B]">昨晚未记录睡眠</div>
        )}
      </motion.div>

      {/* ===== 卡片 4 · 训练卡 ===== */}
      <motion.div {...cardAnim(0.15)}
        className="bg-white rounded-[24px] border border-[#EBEBEB] p-5"
      >
        <Link href="/health/fitness">
          <motion.div whileTap={{ scale: 0.98 }} className="flex items-center justify-between cursor-pointer">
            <div className="flex items-center gap-2.5">
              <Activity className="w-5 h-5 text-[#5865F2]" />
              <span className="text-[18px] font-bold text-[#1D1D1F]">训练</span>
            </div>
            <span className="text-[20px] font-bold text-[#1D1D1F]">
              {todayWorkout ? `${workoutSets} 组` : "--"}
            </span>
          </motion.div>
        </Link>

        <p className="mt-1 text-[15px] text-[#86868B]">
          {todayWorkout
            ? `今日训练 · ${workoutExercises.length} 个动作`
            : "今日暂无训练记录"}
        </p>

        {todayWorkout && workoutExercises.length > 0 && (
          <div className="mt-3">
            {workoutExercises.map((ex, i) => {
              const firstSet = ex.sets[0];
              return (
                <div key={i} className="flex items-center h-7">
                  <div className="w-2 h-2 rounded-full flex-shrink-0 bg-[#5865F2]" />
                  <span className="ml-2.5 text-[15px] font-medium text-[#1D1D1F] truncate">{ex.exerciseName}</span>
                  <span className="ml-auto text-[15px] text-[#86868B] flex-shrink-0">
                    {ex.sets.length}组×{firstSet.weight}kg RPE {firstSet.rpe}
                  </span>
                </div>
              );
            })}
          </div>
        )}
      </motion.div>

      {/* ===== 区块 5 · 本周趋势 ===== */}
      <motion.div {...cardAnim(0.2)}>
        <h2 className="text-[24px] font-bold text-[#1D1D1F] mb-4">本周趋势</h2>
        <div className="bg-white rounded-[24px] border border-[#EBEBEB] p-5">
          <div className="h-[120px] flex items-end justify-between px-2">
            {(weekWater ?? []).map((v, i) => (
              <motion.div
                key={i}
                initial={{ height: 0 }}
                animate={{
                  height: maxWeekWater > 0 ? `${Math.max(4, Math.round((v / maxWeekWater) * 112))}px` : 0,
                }}
                transition={{ duration: 0.5, delay: i * 0.05 }}
                className="w-[20px] rounded-[6px] bg-[#5865F2] flex-shrink-0"
              />
            ))}
          </div>
          <div className="mt-2 flex justify-between px-2">
            {["一", "二", "三", "四", "五", "六", "日"].map((d) => (
              <span key={d} className="w-[20px] text-center text-[13px] text-[#86868B]">{d}</span>
            ))}
          </div>
        </div>
      </motion.div>
    </div>
  );
}
