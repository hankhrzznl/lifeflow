"use client";

import { useEffect, useState, useMemo } from "react";
import Link from "next/link";
import { motion } from "framer-motion";
import { useLiveQuery } from "dexie-react-hooks";
import {
  Target,
  PlusCircle,
  ChevronRight,
  Droplets,
  Moon,
} from "lucide-react";
import { efficiencyDB, getScheduleTasksByDate } from "@/lib/db/efficiency.db";
import type { Goal, ScheduleTask } from "@/lib/db/efficiency.db";
import { accountingDB } from "@/lib/db/accounting.db";
import type { Transaction, Category } from "@/lib/db/accounting.db";
import { healthDB, getWaterGoal } from "@/lib/db/health.db";
import type { WaterLog, WaterGoal, SleepLog, WorkoutSession } from "@/lib/db/health.db";

// ============================================================

function todayStr(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function formatDateChinese(date: Date): string {
  const weekDays = ["日", "一", "二", "三", "四", "五", "六"];
  return `${date.getMonth() + 1}月${date.getDate()}日 周${weekDays[date.getDay()]}`;
}

function timeToMinutes(t: string): number {
  const [h, m] = t.split(":").map(Number);
  return h * 60 + m;
}

// ============================================================

export default function HomePage() {
  const today = todayStr();
  const now = new Date();
  const hour = now.getHours();
  const greeting = hour >= 6 && hour < 12 ? "早上好" : hour >= 12 && hour < 18 ? "下午好" : "晚上好";

  // ── Data queries ──

  const todayTasks = useLiveQuery(() => getScheduleTasksByDate(today), [today], [] as ScheduleTask[]);
  const goals = useLiveQuery(() => efficiencyDB.goals.toArray(), [], [] as Goal[]);
  const transactions = useLiveQuery(
    () => accountingDB.transactions.where("date").equals(today).toArray(),
    [today],
    [] as Transaction[],
  );
  const categories = useLiveQuery(() => accountingDB.categories.toArray(), [], [] as Category[]);
  const waterLogs = useLiveQuery(
    () => healthDB.waterLogs.where("date").equals(today).toArray(),
    [today],
    [] as WaterLog[],
  );
  const [waterGoal, setWaterGoal] = useState<WaterGoal>({ dailyTarget: 2000, reminderInterval: 0, nightMode: false, createdAt: 0, updatedAt: 0 });
  useEffect(() => {
    getWaterGoal().then((g) => setWaterGoal(g)).catch(() => {});
  }, []);
  const sleepLogs = useLiveQuery(() => healthDB.sleepLogs.toArray(), [], [] as SleepLog[]);
  const workouts = useLiveQuery(
    () => healthDB.workoutSessions.where("date").equals(today).toArray(),
    [today],
    [] as WorkoutSession[],
  );

  // ── Derived ──

  // Goals progress
  const totalGoals = goals.length;
  const completedGoals = goals.filter((g) => g.status === "completed").length;
  const goalsPct = totalGoals > 0 ? Math.round((completedGoals / totalGoals) * 100) : 0;

  // Accounting
  const totalExpense = transactions.filter((t) => t.type === "expense").reduce((s, t) => s + t.amount, 0);
  const totalIncome = transactions.filter((t) => t.type === "income").reduce((s, t) => s + t.amount, 0);
  const netIncome = Math.round((totalIncome - totalExpense) / 100);
  const expenseCount = transactions.filter((t) => t.type === "expense").length;

  // Water
  const waterTotal = waterLogs.reduce((s, l) => s + l.amount, 0);
  const waterTarget = waterGoal?.dailyTarget ?? 2000;
  const waterPct = waterTarget > 0 ? Math.min(100, Math.round((waterTotal / waterTarget) * 100)) : 0;
  const waterDisplay = waterTotal >= 1000
    ? `${(waterTotal / 1000).toFixed(1)}L`
    : `${waterTotal}ml`;

  // Sleep
  const latestSleep = useMemo(() => {
    if (sleepLogs.length === 0) return null;
    const sorted = [...sleepLogs].sort((a, b) => b.date.localeCompare(a.date));
    return sorted[0];
  }, [sleepLogs]);
  const sleepHours = latestSleep
    ? (() => {
        const sleepMin = timeToMinutes(latestSleep.actualTime);
        const wakeMin = 7 * 60; // assume wake at 7:00
        const diff = sleepMin <= wakeMin ? wakeMin - sleepMin : (wakeMin + 24 * 60) - sleepMin;
        return (diff / 60).toFixed(1) + "h";
      })()
    : "--";
  const sleepQuality = latestSleep
    ? latestSleep.isOnTime
      ? "良好"
      : latestSleep.minutesDiff > 0
        ? "较晚"
        : "较早"
    : "--";

  // Helper: get category name by id
  const catMap = useMemo(() => {
    const map: Record<string, string> = {};
    categories.forEach((c) => { map[c.id] = c.name; });
    return map;
  }, [categories]);

  // Helper: goal color map
  const goalColorMap = useMemo(() => {
    const map: Record<string, string> = {};
    goals.forEach((g) => {
      // Goal doesn't have a color field directly, lookup via project
      // Use default #5865F2 if no color
      map[g.id] = "#5865F2";
    });
    return map;
  }, [goals]);

  // Incomplete today tasks
  const incompleteTasks = useMemo(() => {
    return todayTasks.filter((t) => !t.isCompleted).slice(0, 5);
  }, [todayTasks]);

  // Today transactions (max 2)
  const showTxs = useMemo(() => transactions.slice(0, 2), [transactions]);

  // Ring geometry
  const ringRadius = 19;
  const ringCircumference = 2 * Math.PI * ringRadius;

  return (
    <div className="min-h-screen bg-[#FAFAFA]">
      <div className="mx-auto max-w-[430px] px-4 pt-12 pb-28 flex flex-col gap-4">

        {/* ===== 1. Page Header (Greeting) ===== */}
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, ease: "easeOut" }}
        >
          <div className="text-[13px] text-[#86868B]">{formatDateChinese(now)}</div>
          <h1 className="text-[34px] font-bold text-[#1D1D1F] leading-tight tracking-tight">
            {greeting}
          </h1>
        </motion.div>

        {/* ===== 2. Decorative Separator ===== */}
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.05, duration: 0.4, ease: "easeOut" }}
          className="flex flex-col items-center gap-1"
        >
          <div className="h-px w-full bg-[#E5E5E5]" />
          <div className="h-px w-full bg-[#E5E5E5]" />
          <div className="h-px w-full bg-[#E5E5E5]" />
          <div className="text-[13px] text-[#AEAEB2] mt-1">三条线，一张网</div>
        </motion.div>

        {/* ===== 3. Today Overview Card ===== */}
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1, duration: 0.4, ease: "easeOut" }}
          className="bg-white rounded-[20px] border border-[#F5F5F5] p-5"
        >
          <div className="grid grid-cols-3">
            {/* Column 1 - Today Goals */}
            <div className="flex flex-col items-center gap-1.5">
              <div className="text-[13px] text-[#86868B]">今日目标</div>
              <div className="text-[28px] font-bold text-[#1D1D1F] leading-none">
                {completedGoals}/{totalGoals}
              </div>
              <div className="w-full max-w-[56px] h-1 rounded-full bg-[#E5E5E5] overflow-hidden">
                <motion.div
                  className="h-full rounded-full bg-[#5865F2]"
                  initial={{ width: 0 }}
                  animate={{ width: `${goalsPct}%` }}
                  transition={{ duration: 0.6, ease: "easeOut" }}
                />
              </div>
            </div>

            {/* Column 2 - Today Income/Expense */}
            <div className="flex flex-col items-center gap-1.5">
              <div className="text-[13px] text-[#86868B]">今日收支</div>
              <div className="text-[28px] font-bold text-[#1D1D1F] leading-none">
                ¥{netIncome}
              </div>
              <div className="text-[12px] text-[#AEAEB2]">
                支出 {expenseCount} 笔
              </div>
            </div>

            {/* Column 3 - Today Health */}
            <div className="flex flex-col items-center gap-1.5">
              <div className="text-[13px] text-[#86868B]">今日健康</div>
              <svg width="44" height="44" viewBox="0 0 44 44">
                <circle
                  cx="22"
                  cy="22"
                  r={ringRadius}
                  fill="none"
                  stroke="#E5E5E5"
                  strokeWidth="4"
                />
                <motion.circle
                  cx="22"
                  cy="22"
                  r={ringRadius}
                  fill="none"
                  stroke="#5865F2"
                  strokeWidth="4"
                  strokeLinecap="round"
                  strokeDasharray={ringCircumference}
                  initial={{ strokeDashoffset: ringCircumference }}
                  animate={{
                    strokeDashoffset: ringCircumference - (ringCircumference * waterPct) / 100,
                  }}
                  transition={{ duration: 0.8, ease: "easeOut" }}
                  transform="rotate(-90 22 22)"
                />
              </svg>
            </div>
          </div>
        </motion.div>

        {/* ===== 4. Quick Action Row ===== */}
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.15, duration: 0.4, ease: "easeOut" }}
          className="grid grid-cols-2 gap-3"
        >
          <motion.div whileTap={{ scale: 0.97 }}>
            <Link
              href="/efficiency/create"
              className="bg-[#EEF2FF] h-16 rounded-[16px] flex items-center justify-center gap-2"
            >
              <Target className="w-[22px] h-[22px] text-[#5865F2]" />
              <span className="text-[15px] font-semibold text-[#5865F2]">添加目标</span>
            </Link>
          </motion.div>
          <motion.div whileTap={{ scale: 0.97 }}>
            <Link
              href="/more/accounting/record"
              className="bg-[#EEF2FF] h-16 rounded-[16px] flex items-center justify-center gap-2"
            >
              <PlusCircle className="w-[22px] h-[22px] text-[#5865F2]" />
              <span className="text-[15px] font-semibold text-[#5865F2]">记一笔</span>
            </Link>
          </motion.div>
        </motion.div>

        {/* ===== 5a. Efficiency Card ===== */}
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2, duration: 0.4, ease: "easeOut" }}
          className="bg-white rounded-[20px] border border-[#F5F5F5] p-5"
        >
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-[20px] font-bold text-[#1D1D1F]">效率</h2>
            <Link href="/efficiency" className="flex items-center gap-0.5 text-[15px] text-[#5865F2]">
              查看全部
              <ChevronRight className="w-4 h-4" />
            </Link>
          </div>

          {incompleteTasks.length === 0 ? (
            <div className="text-[14px] text-[#AEAEB2] py-2">暂无待办事项</div>
          ) : (
            <div className="flex flex-col gap-2.5">
              {incompleteTasks.map((task) => {
                const taskGoal = task.goalId ? goals.find((g) => g.id === task.goalId) : null;
                const dotColor = goalColorMap[task.goalId ?? ""] ?? "#5865F2";
                const dateLabel = task.date ?? "";
                return (
                  <div key={task.id} className="flex items-center gap-2.5">
                    <span
                      className="w-2 h-2 rounded-full shrink-0"
                      style={{ backgroundColor: dotColor }}
                    />
                    <span className="flex-1 text-[15px] text-[#1D1D1F] truncate">
                      {task.title}
                    </span>
                    {dateLabel && (
                      <span className="text-[13px] text-[#AEAEB2] shrink-0">{dateLabel}</span>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </motion.div>

        {/* ===== 5b. Accounting Card ===== */}
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.25, duration: 0.4, ease: "easeOut" }}
          className="bg-white rounded-[20px] border border-[#F5F5F5] p-5"
        >
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-[20px] font-bold text-[#1D1D1F]">记账</h2>
            <Link href="/more/accounting" className="flex items-center gap-0.5 text-[15px] text-[#5865F2]">
              查看全部
              <ChevronRight className="w-4 h-4" />
            </Link>
          </div>

          {showTxs.length === 0 ? (
            <div className="text-[14px] text-[#AEAEB2] py-2">今日暂无收支记录</div>
          ) : (
            <div className="flex flex-col gap-2.5">
              {showTxs.map((tx) => {
                const catName = tx.categoryId ? catMap[tx.categoryId] : null;
                const label = tx.note || catName || (tx.type === "income" ? "收入" : "支出");
                return (
                  <div key={tx.id} className="flex items-center justify-between">
                    <span className="text-[15px] text-[#1D1D1F] truncate">{label}</span>
                    <span className="text-[15px] font-semibold text-[#1D1D1F] shrink-0 ml-3">
                      ¥{Math.round(tx.amount / 100)}
                    </span>
                  </div>
                );
              })}
            </div>
          )}
        </motion.div>

        {/* ===== 5c. Health Card ===== */}
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3, duration: 0.4, ease: "easeOut" }}
          className="bg-white rounded-[20px] border border-[#F5F5F5] p-5"
        >
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-[20px] font-bold text-[#1D1D1F]">健康</h2>
            <Link href="/more" className="flex items-center gap-0.5 text-[15px] text-[#5865F2]">
              查看全部
              <ChevronRight className="w-4 h-4" />
            </Link>
          </div>

          <div className="flex items-stretch">
            {/* Water column */}
            <div className="flex-1 flex flex-col items-center gap-1">
              <Droplets className="w-5 h-5 text-[#5865F2] mb-0.5" />
              <div className="text-[13px] text-[#86868B]">今日饮水</div>
              <div className="text-[17px] font-semibold text-[#1D1D1F]">{waterDisplay}</div>
              <div className="text-[12px] text-[#AEAEB2]">
                目标 {(waterTarget >= 1000 ? (waterTarget / 1000).toFixed(1) + "L" : waterTarget + "ml")}
              </div>
            </div>

            {/* Vertical divider */}
            <div className="w-px bg-[#E5E5E5] mx-3" />

            {/* Sleep column */}
            <div className="flex-1 flex flex-col items-center gap-1">
              <Moon className="w-5 h-5 text-[#5865F2] mb-0.5" />
              <div className="text-[13px] text-[#86868B]">昨晚睡眠</div>
              <div className="text-[17px] font-semibold text-[#1D1D1F]">{sleepHours}</div>
              <div className="text-[12px] text-[#AEAEB2]">质量 {sleepQuality}</div>
            </div>
          </div>
        </motion.div>

      </div>
    </div>
  );
}
