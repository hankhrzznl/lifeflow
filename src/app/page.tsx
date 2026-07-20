"use client";

import { useEffect, useState, useMemo } from "react";
import Link from "next/link";
import { motion } from "framer-motion";
import { useLiveQuery } from "dexie-react-hooks";
import { Target, Wallet, Heart, ChevronRight, Check } from "lucide-react";
import { efficiencyDB, getScheduleTasksByDate } from "@/lib/db/efficiency.db";
import type { Goal, ScheduleTask } from "@/lib/db/efficiency.db";
import { accountingDB } from "@/lib/db/accounting.db";
import type { Transaction } from "@/lib/db/accounting.db";
import { healthDB, getWaterGoal } from "@/lib/db/health.db";
import type { WaterLog, WaterGoal } from "@/lib/db/health.db";

// ============================================================

function todayStr(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function formatDateChinese(date: Date): string {
  const weekDays = ["日", "一", "二", "三", "四", "五", "六"];
  return `${date.getMonth() + 1}月${date.getDate()}日 周${weekDays[date.getDay()]}`;
}

// ============================================================

export default function HomePage() {
  const today = todayStr();
  const now = new Date();

  // ── Data queries ──
  const todayTasks = useLiveQuery(() => getScheduleTasksByDate(today), [today], [] as ScheduleTask[]);
  const goals = useLiveQuery(() => efficiencyDB.goals.toArray(), [], [] as Goal[]);
  const transactions = useLiveQuery(
    () => accountingDB.transactions.where("date").equals(today).toArray(),
    [today],
    [] as Transaction[],
  );
  const waterLogs = useLiveQuery(
    () => healthDB.waterLogs.where("date").equals(today).toArray(),
    [today],
    [] as WaterLog[],
  );
  const [waterGoal, setWaterGoal] = useState<WaterGoal>({ dailyTarget: 2000, reminderInterval: 0, nightMode: false, createdAt: 0, updatedAt: 0 });
  useEffect(() => {
    getWaterGoal().then((g) => setWaterGoal(g)).catch(() => {});
  }, []);

  // ── Derived ──
  const totalGoals = goals.length;
  const completedGoals = goals.filter((g) => g.status === "completed").length;

  const totalExpense = transactions.filter((t) => t.type === "expense").reduce((s, t) => s + t.amount, 0);
  const totalIncome = transactions.filter((t) => t.type === "income").reduce((s, t) => s + t.amount, 0);
  const netIncome = Math.round((totalIncome - totalExpense) / 100);

  const waterTotal = waterLogs.reduce((s, l) => s + l.amount, 0);
  const waterTarget = waterGoal?.dailyTarget ?? 2000;

  // Tasks: today's incomplete tasks
  const incompleteTasks = useMemo(() => {
    return todayTasks.filter((t) => !t.isCompleted).slice(0, 4);
  }, [todayTasks]);

  // Done tasks
  const completedTasks = useMemo(() => {
    return todayTasks.filter((t) => t.isCompleted).slice(0, 2);
  }, [todayTasks]);

  // Future/upcoming tasks (tomorrow)
  const upcomingTasks = useMemo(() => {
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    const tomorrowStr = `${tomorrow.getFullYear()}-${String(tomorrow.getMonth() + 1).padStart(2, "0")}-${String(tomorrow.getDate()).padStart(2, "0")}`;
    return []; // We'll show static upcoming items for now
  }, []);

  // Get goal name by id
  const goalMap = useMemo(() => {
    const map: Record<string, Goal> = {};
    goals.forEach((g) => { map[g.id] = g; });
    return map;
  }, [goals]);

  function getPriorityLabel(quadrant?: string, isImportant?: boolean) {
    if (quadrant === "q1" || isImportant) return { text: "高优先级", color: "var(--state-warning)" };
    if (quadrant === "q2") return { text: "中优先级", color: "var(--color-text-secondary)" };
    return { text: "普通", color: "var(--color-text-secondary)" };
  }

  return (
    <main className="px-4 pt-14 pb-[100px] max-w-[430px] mx-auto">
      {/* Header */}
      <header className="flex items-center justify-between mb-1">
        <h1 className="text-title-nav" style={{ color: "var(--color-text-primary)" }}>LifeFlow</h1>
        <button
          className="w-10 h-10 rounded-full border flex items-center justify-center"
          style={{ borderColor: "var(--lifeflow-border)", background: "var(--color-surface-card)" }}
        >
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="var(--color-text-secondary)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/>
          </svg>
        </button>
      </header>
      <p className="text-label mb-6">{formatDateChinese(now)}</p>

      {/* Today Overview Cards — horizontal scroll */}
      <div className="flex flex-nowrap overflow-x-auto gap-3 mb-6 no-scrollbar">
        {/* Today Goals */}
        <Link href="/efficiency" className="flex-shrink-0 w-[156px] rounded-[20px] p-4 flex flex-col gap-2" style={{ background: "var(--color-surface-card)", boxShadow: "var(--shadow-card)" }}>
          <div className="flex items-center justify-between">
            <div className="w-9 h-9 rounded-full flex items-center justify-center" style={{ background: "var(--lifeflow-brand-50)" }}>
              <Target className="w-[18px] h-[18px]" style={{ color: "var(--lifeflow-primary)" }} />
            </div>
            <ChevronRight className="w-4 h-4" style={{ color: "var(--color-text-disabled)" }} />
          </div>
          <div>
            <p className="text-caption">今日目标</p>
            <p className="text-amount-small" style={{ color: "var(--color-text-primary)" }}>{completedGoals}/{totalGoals}</p>
          </div>
        </Link>

        {/* Today Income/Expense */}
        <Link href="/more/accounting" className="flex-shrink-0 w-[156px] rounded-[20px] p-4 flex flex-col gap-2" style={{ background: "var(--color-surface-card)", boxShadow: "var(--shadow-card)" }}>
          <div className="flex items-center justify-between">
            <div className="w-9 h-9 rounded-full flex items-center justify-center" style={{ background: "var(--lifeflow-brand-50)" }}>
              <Wallet className="w-[18px] h-[18px]" style={{ color: "var(--lifeflow-primary)" }} />
            </div>
            <ChevronRight className="w-4 h-4" style={{ color: "var(--color-text-disabled)" }} />
          </div>
          <div>
            <p className="text-caption">今日收支</p>
            <p className="text-amount-small" style={{ color: "var(--color-text-primary)" }}>
              {netIncome >= 0 ? "+" : ""}{netIncome}
            </p>
          </div>
        </Link>

        {/* Today Health */}
        <Link href="/more" className="flex-shrink-0 w-[156px] rounded-[20px] p-4 flex flex-col gap-2" style={{ background: "var(--color-surface-card)", boxShadow: "var(--shadow-card)" }}>
          <div className="flex items-center justify-between">
            <div className="w-9 h-9 rounded-full flex items-center justify-center" style={{ background: "var(--lifeflow-brand-50)" }}>
              <Heart className="w-[18px] h-[18px]" style={{ color: "var(--lifeflow-primary)" }} />
            </div>
            <ChevronRight className="w-4 h-4" style={{ color: "var(--color-text-disabled)" }} />
          </div>
          <div>
            <p className="text-caption">今日健康</p>
            <p className="text-amount-small" style={{ color: "var(--color-text-primary)" }}>
              {waterTotal >= 1000 ? `${(waterTotal / 1000).toFixed(1)}L` : `${waterTotal}ml`}
            </p>
          </div>
        </Link>
      </div>

      {/* Task List Section */}
      <div className="mb-6">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <h2 className="text-[18px] font-semibold tracking-[-0.018em]" style={{ color: "var(--color-text-primary)" }}>今日任务</h2>
            <span className="text-[12px] font-semibold px-2 py-0.5 rounded-full" style={{ background: "var(--lifeflow-brand-50)", color: "var(--lifeflow-primary)" }}>
              {todayTasks.length}
            </span>
          </div>
          <Link href="/tasks" className="text-[13px] font-medium" style={{ color: "var(--lifeflow-primary)" }}>查看全部</Link>
        </div>

        {incompleteTasks.length === 0 && completedTasks.length === 0 ? (
          <div className="rounded-[20px] p-8 flex flex-col items-center gap-2" style={{ background: "var(--color-surface-card)", boxShadow: "var(--shadow-card)" }}>
            <div className="w-12 h-12 rounded-full flex items-center justify-center" style={{ background: "var(--lifeflow-muted)" }}>
              <Target className="w-6 h-6" style={{ color: "var(--color-text-disabled)" }} />
            </div>
            <p className="text-[14px]" style={{ color: "var(--color-text-secondary)" }}>暂无任务</p>
            <Link href="/efficiency/create" className="text-[14px] font-medium" style={{ color: "var(--lifeflow-primary)" }}>
              + 创建任务
            </Link>
          </div>
        ) : (
          <div className="flex flex-col gap-3">
            {incompleteTasks.map((task) => {
              const priority = getPriorityLabel(task.quadrant, task.isImportant);
              const taskGoal = task.goalId ? goalMap[task.goalId] : null;
              return (
                <div key={task.id} className="rounded-[20px] p-4 flex items-center gap-3" style={{ background: "var(--color-surface-card)", boxShadow: "var(--shadow-card)" }}>
                  <div className="w-[22px] h-[22px] rounded-full border-2 flex items-center justify-center flex-shrink-0" style={{ borderColor: "var(--lifeflow-primary)" }}>
                    <div className="w-[10px] h-[10px] rounded-full" style={{ background: "var(--lifeflow-primary)" }} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-[15px] font-medium truncate" style={{ color: "var(--color-text-primary)" }}>{task.title}</p>
                    {taskGoal && <p className="text-[12px] truncate" style={{ color: "var(--color-text-secondary)" }}>{taskGoal.title}</p>}
                  </div>
                  <div className="flex-shrink-0 text-right">
                    {task.plannedTime > 0 && (
                      <p className="text-[13px] font-medium whitespace-nowrap" style={{ color: "var(--color-text-secondary)" }}>{task.plannedTime}min</p>
                    )}
                    <p className="text-[11px] font-medium whitespace-nowrap" style={{ color: priority.color }}>{priority.text}</p>
                  </div>
                </div>
              );
            })}

            {/* Completed tasks */}
            {completedTasks.map((task) => (
              <div key={task.id} className="rounded-[20px] p-4 flex items-center gap-3" style={{ background: "var(--color-surface-card)", boxShadow: "var(--shadow-card)", opacity: 0.6 }}>
                <div className="w-[22px] h-[22px] rounded-full border-2 flex items-center justify-center flex-shrink-0" style={{ borderColor: "var(--color-text-disabled)" }}>
                  <Check className="w-[14px] h-[14px]" style={{ color: "var(--color-text-disabled)" }} />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-[15px] font-medium truncate line-through" style={{ color: "var(--color-text-disabled)" }}>{task.title}</p>
                  <p className="text-[12px] truncate" style={{ color: "var(--color-text-disabled)" }}>已完成</p>
                </div>
                <div className="flex-shrink-0 text-right">
                  <p className="text-[11px] font-medium whitespace-nowrap" style={{ color: "var(--color-text-disabled)" }}>已完成</p>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Upcoming Section */}
      <div className="mb-20">
        <div className="flex items-center gap-2 mb-3">
          <h2 className="text-[18px] font-semibold tracking-[-0.018em]" style={{ color: "var(--color-text-primary)" }}>即将开始</h2>
        </div>

        <div className="flex flex-col gap-3">
          <div className="rounded-[20px] p-4 flex items-center gap-3" style={{ background: "var(--color-surface-card)", boxShadow: "var(--shadow-card)" }}>
            <div className="w-[22px] h-[22px] rounded-full border-2 flex items-center justify-center flex-shrink-0" style={{ borderColor: "var(--lifeflow-primary)" }} />
            <div className="flex-1 min-w-0">
              <p className="text-[15px] font-medium truncate" style={{ color: "var(--color-text-primary)" }}>查看明天日程</p>
              <p className="text-[12px] truncate" style={{ color: "var(--color-text-secondary)" }}>规划明天的任务和安排</p>
            </div>
            <div className="flex-shrink-0 text-right">
              <Link href="/efficiency/schedule" className="inline-block text-[11px] font-medium px-2 py-0.5 rounded-full whitespace-nowrap" style={{ background: "var(--lifeflow-brand-50)", color: "var(--lifeflow-primary)" }}>
                日程
              </Link>
            </div>
          </div>
        </div>
      </div>
    </main>
  );
}
