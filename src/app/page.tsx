"use client";

import { useMemo, useCallback } from "react";
import Link from "next/link";
import { motion } from "framer-motion";
import { useLiveQuery } from "dexie-react-hooks";
import {
  PlusCircle, Droplets, Moon, TrendingUp,
  CheckSquare, Wallet, Flame, Timer, CalendarCheck,
} from "lucide-react";
import { getScheduleTasksByDate, getAllScheduleTasks, updateScheduleTask } from "@/lib/db/efficiency.db";
import type { ScheduleTask } from "@/lib/db/efficiency.db";
import { getTransactionsByDate } from "@/lib/db/accounting.db";
import type { Transaction } from "@/lib/db/accounting.db";
import { getWaterLogsByDate, getWaterGoal, getWorkoutSessionByDate, getSleepLogByDate } from "@/lib/db/health.db";
import type { WaterLog, SleepLog } from "@/lib/db/health.db";
import { getHabits, toggleHabitDay } from "@/lib/db/life.db";
import type { Habit } from "@/lib/db/life.db";

// ============================================================
// 首页仪表盘 — H5 结构 + lifeflow 数据
// ============================================================

function todayStr(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function formatDateCN(): string {
  const d = new Date();
  const weekDays = ["日", "一", "二", "三", "四", "五", "六"];
  return `${d.getFullYear()}年${d.getMonth() + 1}月${d.getDate()}日 星期${weekDays[d.getDay()]}`;
}

function formatYuan(fen: number): string {
  return Math.round(fen / 100).toLocaleString("zh-CN");
}

function fmtCompact(fen: number): string {
  const yuan = fen / 100;
  return yuan.toLocaleString("zh-CN", { minimumFractionDigits: fen % 100 === 0 ? 0 : 2, maximumFractionDigits: 2 });
}

// ─── H5 图标到 lucide 映射 ───────────────────────────────────

const HABIT_ICON_MAP: Record<string, string> = {
  "🌅": "Sunrise",
  "📖": "BookOpen",
  "🏃": "Footprints",
  "🧘": "Sparkles",
  "💧": "Droplets",
};

// ════════════════════════════════════════════════════════════

export default function HomePage() {
  const today = todayStr();

  // ─── 数据订阅 ──────────────────────────────────────────────

  const todayTasks = useLiveQuery(() => getScheduleTasksByDate(today), [today], [] as ScheduleTask[]);
  const allTasks = useLiveQuery(() => getAllScheduleTasks(), [], [] as ScheduleTask[]);
  const todayTxs = useLiveQuery(() => getTransactionsByDate(today), [today], [] as Transaction[]);
  const todayWaterLogs = useLiveQuery(() => getWaterLogsByDate(today), [today], []);
  const waterGoal = useLiveQuery(() => getWaterGoal(), [], undefined);
  const todayWorkout = useLiveQuery(() => getWorkoutSessionByDate(today), [today], undefined);
  const todaySleep = useLiveQuery(() => getSleepLogByDate(today), [today], undefined);
  const habits = useLiveQuery(() => getHabits(), [], [] as Habit[]);

  // ─── 聚合计算 ──────────────────────────────────────────────

  const incompleteTasks = (todayTasks ?? []).filter((t) => !t.isCompleted);
  const q1Count = (allTasks ?? []).filter((t) => !t.isCompleted && t.quadrant === "q1").length;
  const q2Count = (allTasks ?? []).filter((t) => !t.isCompleted && (!t.quadrant || t.quadrant === "q2")).length;

  const todayExpense = (todayTxs ?? []).filter((t) => t.type === "expense").reduce((s, t) => s + t.amount, 0);
  const todayIncome = (todayTxs ?? []).filter((t) => t.type === "income").reduce((s, t) => s + t.amount, 0);

  const waterTotal = (todayWaterLogs ?? []).reduce((s, l) => s + l.amount, 0);
  const waterTarget = waterGoal?.dailyTarget ?? 2000;
  const waterPct = waterTarget > 0 ? Math.min(100, Math.round((waterTotal / waterTarget) * 100)) : 0;
  const sleepHours = todaySleep ? `${Math.floor(timeToMinutes(todaySleep.actualTime) / 60)}h` : "--";
  const trained = !!todayWorkout;

  const healthScore = Math.round(
    (waterPct + (trained ? 100 : 0) + (todaySleep ? (todaySleep.isOnTime ? 100 : 50) : 0)) / 3
  );

  // ─── 切换任务 ──────────────────────────────────────────────

  const toggleTask = useCallback(async (task: ScheduleTask) => {
    await updateScheduleTask(task.id, { isCompleted: !task.isCompleted });
  }, []);

  const toggleHabit = useCallback(async (habit: Habit) => {
    await toggleHabitDay(habit.id, today);
  }, [today]);

  // ─── 问候 ──────────────────────────────────────────────────

  const hour = new Date().getHours();
  const greeting = hour < 6 ? "凌晨好" : hour < 9 ? "早上好" : hour < 12 ? "上午好" : hour < 14 ? "中午好" : hour < 18 ? "下午好" : "晚上好";

  // ════════════════════════════════════════════════════════════

  return (
    <div className="px-4 pt-5 pb-6 flex flex-col gap-4">
      {/* ===== 问候 ===== */}
      <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
        className="rounded-2xl p-5 text-white" style={{ background: "linear-gradient(135deg, #6366F1, #8B5CF6)" }}>
        <div className="text-[15px] opacity-90">{greeting} 👋</div>
        <div className="text-[28px] font-bold mt-1">三条线，一张网</div>
        <div className="text-[13px] opacity-80 mt-1">{formatDateCN()}</div>
      </motion.div>

      {/* ===== 统计四宫格 ===== */}
      <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.04 }}
        className="grid grid-cols-2 gap-3">
        {[
          { label: "今日待办", value: `${incompleteTasks.length} 件`, color: "#6366F1", href: "/tasks" },
          { label: "今日支出", value: `¥${formatYuan(todayExpense)}`, color: todayExpense > 0 ? "#FF3B30" : "#000", href: "/accounting" },
          { label: "重要紧急", value: `${q1Count} 件`, color: "#FF3B30", href: "/tasks" },
          { label: "健康完成", value: `${healthScore}%`, color: "#FF9500", href: "/health" },
        ].map((item) => (
          <Link key={item.label} href={item.href}>
            <div className="rounded-xl bg-white p-4 shadow-[0_1px_4px_rgba(0,0,0,0.04)]">
              <div className="text-[13px] mb-1" style={{ color: "#8E8E93" }}>{item.label}</div>
              <div className="text-[22px] font-bold" style={{ color: item.color }}>{item.value}</div>
            </div>
          </Link>
        ))}
      </motion.div>

      {/* ===== 快捷操作 ===== */}
      <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.08 }}
        className="flex gap-3">
        {[
          { icon: CheckSquare, label: "添加事项", href: "/tasks", bg: "#6366F1" },
          { icon: Wallet, label: "记一笔", href: "/accounting/record", bg: "#34C759" },
          { icon: Timer, label: "专注", href: "/more/focus", bg: "#FF9500" },
          { icon: CalendarCheck, label: "打卡", href: "/more/habits", bg: "#AF52DE" },
        ].map((item) => (
          <Link key={item.label} href={item.href}
            className="flex-1 flex flex-col items-center gap-1 py-3 rounded-xl bg-white shadow-[0_1px_4px_rgba(0,0,0,0.04)]">
            <div className="w-9 h-9 rounded-full flex items-center justify-center" style={{ background: `${item.bg}16` }}>
              <item.icon className="w-5 h-5" style={{ color: item.bg }} />
            </div>
            <span className="text-[12px] font-medium" style={{ color: "#8E8E93" }}>{item.label}</span>
          </Link>
        ))}
      </motion.div>

      {/* ===== 今日事项 ===== */}
      <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.12 }}
        className="rounded-xl bg-white p-4 shadow-[0_1px_4px_rgba(0,0,0,0.04)]">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <CheckSquare className="w-5 h-5" style={{ color: "#6366F1" }} />
            <span className="text-[17px] font-semibold">今日事项</span>
          </div>
          <Link href="/tasks" className="text-[13px]" style={{ color: "#6366F1" }}>查看全部 →</Link>
        </div>
        {incompleteTasks.length === 0 ? (
          <div className="text-center py-6">
            <div className="text-3xl mb-2">🎉</div>
            <div className="text-[15px]" style={{ color: "#8E8E93" }}>今天没有待办事项</div>
          </div>
        ) : (
          <div className="flex flex-col">
            {incompleteTasks.slice(0, 5).map((t) => (
              <button key={t.id} type="button" onClick={() => toggleTask(t)}
                className="flex items-center gap-3 py-2.5 w-full text-left"
                style={{ borderBottom: "0.5px solid #E5E5EA" }}>
                <div className="w-5 h-5 rounded-full border-2 border-[#C7C7CC] shrink-0" />
                <span className="flex-1 text-[15px] truncate" style={{ color: "#000" }}>{t.title}</span>
                <span className="text-[11px] px-1.5 py-0.5 rounded font-medium shrink-0"
                  style={{
                    background: getQuadrantBg(t.quadrant),
                    color: getQuadrantColor(t.quadrant),
                  }}>
                  {getQuadrantLabel(t.quadrant)}
                </span>
              </button>
            ))}
          </div>
        )}
      </motion.div>

      {/* ===== 今日收支 ===== */}
      <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.16 }}
        className="rounded-xl bg-white p-4 shadow-[0_1px_4px_rgba(0,0,0,0.04)]">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <Wallet className="w-5 h-5" style={{ color: "#34C759" }} />
            <span className="text-[17px] font-semibold">今日收支</span>
          </div>
          <Link href="/accounting" className="text-[13px]" style={{ color: "#34C759" }}>查看全部 →</Link>
        </div>
        <div className="flex gap-4">
          <div className="flex-1 rounded-lg p-3" style={{ background: "#34C75910" }}>
            <div className="text-[13px]" style={{ color: "#8E8E93" }}>收入</div>
            <div className="text-[20px] font-bold mt-1" style={{ color: "#007AFF" }}>¥{fmtCompact(todayIncome)}</div>
          </div>
          <div className="flex-1 rounded-lg p-3" style={{ background: "#FF3B3010" }}>
            <div className="text-[13px]" style={{ color: "#8E8E93" }}>支出</div>
            <div className="text-[20px] font-bold mt-1" style={{ color: "#FF3B30" }}>¥{fmtCompact(todayExpense)}</div>
          </div>
        </div>
      </motion.div>

      {/* ===== 健康概览 ===== */}
      <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }}
        className="rounded-xl bg-white p-4 shadow-[0_1px_4px_rgba(0,0,0,0.04)]">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <Heart className="w-5 h-5" style={{ color: "#FF9500" }} />
            <span className="text-[17px] font-semibold">健康概览</span>
          </div>
          <Link href="/health" className="text-[13px]" style={{ color: "#FF9500" }}>详情 →</Link>
        </div>
        <div className="flex gap-3">
          <div className="flex-1 rounded-lg p-3 text-center" style={{ background: "#007AFF10" }}>
            <Droplets className="w-5 h-5 mx-auto mb-1" style={{ color: "#007AFF" }} />
            <div className="text-[15px] font-bold" style={{ color: "#007AFF" }}>{waterPct}%</div>
            <div className="text-[12px]" style={{ color: "#8E8E93" }}>饮水</div>
          </div>
          <div className="flex-1 rounded-lg p-3 text-center" style={{ background: "#5856D610" }}>
            <Moon className="w-5 h-5 mx-auto mb-1" style={{ color: "#5856D6" }} />
            <div className="text-[15px] font-bold" style={{ color: "#5856D6" }}>{sleepHours}</div>
            <div className="text-[12px]" style={{ color: "#8E8E93" }}>睡眠</div>
          </div>
          <div className="flex-1 rounded-lg p-3 text-center" style={{ background: "#FF950010" }}>
            <Flame className="w-5 h-5 mx-auto mb-1" style={{ color: trained ? "#FF9500" : "#C7C7CC" }} />
            <div className="text-[15px] font-bold" style={{ color: trained ? "#FF9500" : "#C7C7CC" }}>{trained ? "✓" : "--"}</div>
            <div className="text-[12px]" style={{ color: "#8E8E93" }}>训练</div>
          </div>
        </div>
      </motion.div>

      {/* ===== 习惯打卡 ===== */}
      {habits && habits.length > 0 && (
        <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.24 }}
          className="rounded-xl bg-white p-4 shadow-[0_1px_4px_rgba(0,0,0,0.04)]">
          <div className="flex items-center justify-between mb-3">
            <span className="text-[17px] font-semibold">习惯打卡</span>
            <Link href="/more/habits" className="text-[13px]" style={{ color: "#8E8E93" }}>详情 →</Link>
          </div>
          <div className="flex gap-3">
            {habits.slice(0, 5).map((h) => {
              const done = h.days[today];
              return (
                <button key={h.id} type="button" onClick={() => toggleHabit(h)}
                  className="flex-1 flex flex-col items-center gap-1 py-2 rounded-lg"
                  style={{ background: `${h.color}10` }}>
                  <div className={`w-8 h-8 rounded-full flex items-center justify-center text-lg ${done ? "opacity-100" : "opacity-40"}`}
                    style={{ background: done ? h.color : "transparent", border: done ? "none" : `2px solid ${h.color}40` }}>
                    <span>{getHabitEmoji(h.name)}</span>
                  </div>
                  <span className="text-[11px] font-medium" style={{ color: done ? "#000" : "#C7C7CC" }}>{h.name}</span>
                </button>
              );
            })}
          </div>
        </motion.div>
      )}
    </div>
  );
}

// ─── 工具 ────────────────────────────────────────────────────

function timeToMinutes(t: string): number {
  const [h, m] = t.split(":").map(Number);
  return h * 60 + m;
}

function getQuadrantLabel(q?: string): string {
  switch (q) {
    case "q1": return "紧急重要";
    case "q2": return "重要不紧急";
    case "q3": return "不重要紧急";
    case "q4": return "不重要不紧急";
    default: return "未分类";
  }
}

function getQuadrantColor(q?: string): string {
  switch (q) {
    case "q1": return "#FF3B30";
    case "q2": return "#007AFF";
    case "q3": return "#FF9500";
    case "q4": return "#8E8E93";
    default: return "#8E8E93";
  }
}

function getQuadrantBg(q?: string): string {
  return `${getQuadrantColor(q)}16`;
}

function getHabitEmoji(name: string): string {
  const map: Record<string, string> = {
    "早起6:30": "🌅", "阅读30分钟": "📖", "运动": "🏃", "冥想10分钟": "🧘", "喝水8杯": "💧",
  };
  return map[name] || "✅";
}

function Heart(props: { className?: string; style?: React.CSSProperties }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" {...props}>
      <path d="M19 14c1.49-1.46 3-3.21 3-5.5A5.5 5.5 0 0 0 16.5 3c-1.76 0-3 .5-4.5 2-1.5-1.5-2.74-2-4.5-2A5.5 5.5 0 0 0 2 8.5c0 2.3 1.5 4.05 3 5.5l7 7Z" />
    </svg>
  );
}
