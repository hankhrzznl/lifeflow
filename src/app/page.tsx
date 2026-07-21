"use client";

import { useEffect, useState, useMemo } from "react";
import Link from "next/link";
import { motion } from "framer-motion";
import { useLiveQuery } from "dexie-react-hooks";
import {
  Target, Wallet, Heart, ChevronRight,
  Check, Moon, Sun,
} from "lucide-react";
import { getTransactionsByDate } from "@/lib/db/accounting.db";
import type { Transaction } from "@/lib/db/accounting.db";
import { getWaterLogsByDate, getWaterGoal, getWorkoutSessionByDate, getSleepLogByDate } from "@/lib/db/health.db";
import { getHabits } from "@/lib/db/life.db";
import type { Habit } from "@/lib/db/life.db";
import { getScheduleTasksByDate, getAllScheduleTasks } from "@/lib/db/efficiency.db";
import type { ScheduleTask } from "@/lib/db/efficiency.db";
import { useTheme } from "@/components/theme/ThemeProvider";

// ============================================================
// 工具函数
// ============================================================

function todayStr(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function fmtCompact(fen: number): string {
  const yuan = fen / 100;
  return yuan.toLocaleString("zh-CN", { minimumFractionDigits: fen % 100 === 0 ? 0 : 2, maximumFractionDigits: 2 });
}

function timeToMinutes(t: string): number {
  const [h, m] = t.split(":").map(Number);
  return h * 60 + m;
}

function formatDateChinese(date: Date): string {
  const weekDays = ["日", "一", "二", "三", "四", "五", "六"];
  return `${date.getMonth() + 1}月${date.getDate()}日 周${weekDays[date.getDay()]}`;
}

function formatDuration(minutes: number): string {
  if (minutes <= 0) return "--";
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return h > 0 ? `${h}h${m > 0 ? m : ""}` : `${m}min`;
}

// ============================================================
// 首页
// ============================================================

export default function HomePage() {
  const today = todayStr();
  const now = new Date();
  const { resolvedTheme, setTheme } = useTheme();

  // ── 数据源 ──
  const todayTxs = useLiveQuery(() => getTransactionsByDate(today), [today], [] as Transaction[]);
  const todayWaterLogs = useLiveQuery(() => getWaterLogsByDate(today), [today], []);
  const [waterGoalData, setWaterGoalData] = useState<{ dailyTarget: number }>({ dailyTarget: 2000 });
  useEffect(() => { getWaterGoal().then((g) => setWaterGoalData(g)).catch(() => {}); }, []);
  const waterGoal = waterGoalData;
  const todayWorkout = useLiveQuery(() => getWorkoutSessionByDate(today), [today], undefined);
  const todaySleep = useLiveQuery(() => getSleepLogByDate(today), [today], undefined);
  const habits = useLiveQuery(() => getHabits(), [], [] as Habit[]);
  const todayScheduleTasks = useLiveQuery(() => getScheduleTasksByDate(today), [today], [] as ScheduleTask[]);
  const allScheduleTasks = useLiveQuery(() => getAllScheduleTasks(), [], [] as ScheduleTask[]);

  // ── 聚合数据 ──
  const todayExpense = (todayTxs ?? []).filter((t) => t.type === "expense").reduce((s, t) => s + t.amount, 0);
  const todayIncome = (todayTxs ?? []).filter((t) => t.type === "income").reduce((s, t) => s + t.amount, 0);
  const netIncome = todayIncome - todayExpense;

  const waterTotal = (todayWaterLogs ?? []).reduce((s, l) => s + l.amount, 0);
  const waterTarget = waterGoal?.dailyTarget ?? 2000;
  const waterPct = waterTarget > 0 ? Math.min(100, Math.round((waterTotal / waterTarget) * 100)) : 0;
  const sleepHours = todaySleep ? `${Math.floor(timeToMinutes(todaySleep.actualTime) / 60)}h` : "--";
  const trained = !!todayWorkout;

  const completedHabits = useMemo(() => {
    if (!habits || habits.length === 0) return 0;
    return habits.filter((h) => h.days[today]).length;
  }, [habits, today]);

  const habitsTotal = habits?.length ?? 0;

  // ── 今日任务 ──
  const todayTasks = useMemo(() => {
    return (todayScheduleTasks ?? []).filter(
      (t) =>
        t.date === today ||
        (t.type === "multi_day" && t.startDate && t.endDate && t.startDate <= today && t.endDate >= today),
    );
  }, [todayScheduleTasks, today]);

  const todayTasksTotal = todayTasks.length;

  // 排序：未完成在上，重要在上
  const sortedTodayTasks = useMemo(() => {
    return [...todayTasks].sort((a, b) => {
      if (a.isCompleted !== b.isCompleted) return a.isCompleted ? 1 : -1;
      if (a.isImportant !== b.isImportant) return a.isImportant ? -1 : 1;
      return a.createdAt - b.createdAt;
    });
  }, [todayTasks]);

  // ── 即将开始（未来 7 天） ──
  const upcomingTasks = useMemo(() => {
    if (!allScheduleTasks) return [];
    const futureTasks: { title: string; subtitle: string; time: string; type: "会议" | "审批" }[] = [];
    const seen = new Set<string>();
    for (const t of allScheduleTasks) {
      if (seen.has(t.title)) continue;
      seen.add(t.title);
      if (t.date && t.date > today) {
        const d = new Date(t.date);
        const label = `${d.getMonth() + 1}/${d.getDate()}`;
        futureTasks.push({
          title: t.title,
          subtitle: t.note || "待办事项",
          time: `${label}`,
          type: t.isImportant ? "审批" : "会议",
        });
      }
    }
    return futureTasks.slice(0, 5);
  }, [allScheduleTasks, today]);

  // ── 统计卡片数据 ──
  const statCards = [
    {
      label: "今日目标",
      icon: Target,
      value: habitsTotal > 0 ? `${completedHabits}/${habitsTotal}` : "暂无",
      href: "/efficiency",
    },
    {
      label: "今日收支",
      icon: Wallet,
      value: `${netIncome >= 0 ? "+" : ""}${fmtCompact(Math.abs(netIncome))}`,
      href: "/more/accounting",
    },
    {
      label: "今日健康",
      icon: Heart,
      value: sleepHours !== "--" ? `${sleepHours}` : waterPct > 0 ? `${waterPct}%` : trained ? "已训练" : "--",
      href: "/more",
    },
  ];

  // ── 暗色模式切换 ──
  const handleToggleTheme = () => {
    setTheme(resolvedTheme === "dark" ? "light" : "dark");
  };

  return (
    <div>
      {/* ===== 1. Header ===== */}
      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.35, ease: "easeOut" }}
        className="px-4 pt-14 mb-1"
      >
        <header className="flex items-center justify-between mb-1">
          <h1
            className="text-[17px] font-semibold"
            style={{ letterSpacing: "-0.018em", color: "var(--color-text-primary)" }}
          >
            LifeFlow
          </h1>
          <button
            type="button"
            onClick={handleToggleTheme}
            aria-label="切换暗色模式"
            className="w-10 h-10 rounded-full flex items-center justify-center"
            style={{
              backgroundColor: "var(--color-surface-card)",
              border: "1px solid var(--lifeflow-border)",
            }}
          >
            {resolvedTheme === "dark" ? (
              <Sun className="w-5 h-5" style={{ color: "var(--color-text-secondary)" }} />
            ) : (
              <Moon className="w-5 h-5" style={{ color: "var(--color-text-secondary)" }} />
            )}
          </button>
        </header>
        <p
          className="text-[13px] font-medium mb-6"
          style={{ color: "var(--color-text-secondary)" }}
        >
          {formatDateChinese(now)}
        </p>
      </motion.div>

      {/* ===== 2. 今日概览（横滑统计卡） ===== */}
      <div className="flex flex-nowrap overflow-x-auto gap-3 mb-6 px-4 no-scrollbar">
        {statCards.map((card, i) => (
          <motion.div
            key={card.label}
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.05 + i * 0.06, duration: 0.35, ease: "easeOut" }}
          >
            <Link href={card.href}>
              <div
                className="flex-shrink-0 w-[156px] rounded-[20px] p-4 flex flex-col gap-2 cursor-pointer"
                style={{
                  backgroundColor: "var(--color-surface-card)",
                  boxShadow: "var(--shadow-card)",
                }}
              >
                <div className="flex items-center justify-between">
                  <div
                    className="w-9 h-9 rounded-full flex items-center justify-center"
                    style={{ backgroundColor: "var(--lifeflow-brand-50)" }}
                  >
                    <card.icon className="w-[18px] h-[18px]" style={{ color: "var(--lifeflow-primary)" }} />
                  </div>
                  <ChevronRight className="w-4 h-4" style={{ color: "var(--color-text-disabled)" }} />
                </div>
                <div>
                  <p className="text-caption">{card.label}</p>
                  <p
                    className="text-[20px] font-bold"
                    style={{ color: "var(--color-text-primary)", letterSpacing: "-0.018em" }}
                  >
                    {card.value}
                  </p>
                </div>
              </div>
            </Link>
          </motion.div>
        ))}
      </div>

      {/* ===== 3. 今日任务列表 ===== */}
      <div className="px-4 mb-6">
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2, duration: 0.35, ease: "easeOut" }}
          className="flex items-center justify-between mb-3"
        >
          <div className="flex items-center gap-2">
            <h2
              className="text-[18px] font-semibold"
              style={{ color: "var(--color-text-primary)", letterSpacing: "-0.018em" }}
            >
              今日任务
            </h2>
            <span
              className="text-[12px] font-semibold px-2 py-0.5 rounded-full"
              style={{ backgroundColor: "var(--lifeflow-brand-50)", color: "var(--lifeflow-primary)" }}
            >
              {todayTasksTotal}
            </span>
          </div>
          <Link
            href="/efficiency/schedule"
            className="text-[13px] font-medium"
            style={{ color: "var(--lifeflow-primary)" }}
          >
            查看全部
          </Link>
        </motion.div>

        <div className="flex flex-col gap-3">
          {sortedTodayTasks.length === 0 && (
            <motion.div
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.25, duration: 0.35 }}
              className="rounded-[20px] p-4 text-center"
              style={{ backgroundColor: "var(--color-surface-card)", boxShadow: "var(--shadow-card)" }}
            >
              <p className="text-[15px]" style={{ color: "var(--color-text-secondary)" }}>
                今天暂无任务
              </p>
            </motion.div>
          )}
          {sortedTodayTasks.slice(0, 5).map((task, i) => {
            const isDone = task.isCompleted;
            const priorityLabel = task.isImportant ? "高优先级" : "普通";
            const priorityColor = task.isImportant
              ? "var(--state-warning)"
              : isDone
                ? "var(--color-text-disabled)"
                : "var(--color-text-secondary)";

            return (
              <motion.div
                key={task.id}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.25 + i * 0.04, duration: 0.3, ease: "easeOut" }}
                className="rounded-[20px] p-4 flex items-center gap-3"
                style={{
                  backgroundColor: "var(--color-surface-card)",
                  boxShadow: "var(--shadow-card)",
                  opacity: isDone ? 0.6 : 1,
                }}
              >
                {/* 复选框 */}
                <div
                  className="w-[22px] h-[22px] rounded-full border-2 flex items-center justify-center flex-shrink-0"
                  style={{
                    borderColor: isDone ? "var(--color-text-disabled)" : "var(--lifeflow-primary)",
                  }}
                >
                  {isDone ? (
                    <Check className="w-[14px] h-[14px]" style={{ color: "var(--color-text-disabled)" }} strokeWidth={2} />
                  ) : (
                    <div className="w-[10px] h-[10px] rounded-full" style={{ backgroundColor: "var(--lifeflow-primary)" }} />
                  )}
                </div>

                {/* 中间文字 */}
                <div className="flex-1 min-w-0">
                  <p
                    className="text-[15px] font-medium truncate"
                    style={{
                      color: isDone ? "var(--color-text-disabled)" : "var(--color-text-primary)",
                      textDecoration: isDone ? "line-through" : "none",
                    }}
                  >
                    {task.title}
                  </p>
                  <p className="text-[12px] truncate" style={{ color: "var(--color-text-secondary)" }}>
                    {task.note || (task.goalId ? "目标关联" : "待办事项")}
                  </p>
                </div>

                {/* 右侧信息 */}
                <div className="flex-shrink-0 text-right">
                  <p className="text-[13px] font-medium whitespace-nowrap" style={{ color: "var(--color-text-secondary)" }}>
                    {task.plannedTime > 0 ? formatDuration(task.plannedTime) : "--"}
                  </p>
                  <p
                    className="text-[11px] font-medium whitespace-nowrap"
                    style={{ color: isDone ? "var(--color-text-disabled)" : priorityColor }}
                  >
                    {isDone ? "已完成" : priorityLabel}
                  </p>
                </div>
              </motion.div>
            );
          })}
        </div>
      </div>

      {/* ===== 4. 即将开始 ===== */}
      <div className="px-4 mb-6">
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.35, duration: 0.35, ease: "easeOut" }}
        >
          <div className="flex items-center gap-2 mb-3">
            <h2
              className="text-[18px] font-semibold"
              style={{ color: "var(--color-text-primary)", letterSpacing: "-0.018em" }}
            >
              即将开始
            </h2>
          </div>
          <div className="flex flex-col gap-3">
            {upcomingTasks.length === 0 && (
              <div
                className="rounded-[20px] p-4 text-center"
                style={{ backgroundColor: "var(--color-surface-card)", boxShadow: "var(--shadow-card)" }}
              >
                <p className="text-[15px]" style={{ color: "var(--color-text-secondary)" }}>
                  暂无即将开始的任务
                </p>
              </div>
            )}
            {upcomingTasks.map((item, i) => (
              <motion.div
                key={i}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.4 + i * 0.05, duration: 0.3, ease: "easeOut" }}
                className="rounded-[20px] p-4 flex items-center gap-3"
                style={{ backgroundColor: "var(--color-surface-card)", boxShadow: "var(--shadow-card)" }}
              >
                <div
                  className="w-[22px] h-[22px] rounded-full border-2 flex items-center justify-center flex-shrink-0"
                  style={{ borderColor: "var(--lifeflow-primary)" }}
                />
                <div className="flex-1 min-w-0">
                  <p className="text-[15px] font-medium truncate" style={{ color: "var(--color-text-primary)" }}>
                    {item.title}
                  </p>
                  <p className="text-[12px] truncate" style={{ color: "var(--color-text-secondary)" }}>
                    {item.subtitle}
                  </p>
                </div>
                <div className="flex-shrink-0 text-right">
                  <p className="text-[13px] font-medium whitespace-nowrap" style={{ color: "var(--color-text-secondary)" }}>
                    {item.time}
                  </p>
                  <span
                    className="inline-block text-[11px] font-medium px-2 py-0.5 rounded-full whitespace-nowrap"
                    style={{
                      backgroundColor: item.type === "会议" ? "var(--lifeflow-brand-50)" : "var(--lifeflow-muted)",
                      color: item.type === "会议" ? "var(--lifeflow-primary)" : "var(--color-text-secondary)",
                    }}
                  >
                    {item.type}
                  </span>
                </div>
              </motion.div>
            ))}
          </div>
        </motion.div>
      </div>
    </div>
  );
}
