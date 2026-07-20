"use client";

import { useEffect, useState, useMemo } from "react";
import Link from "next/link";
import { motion } from "framer-motion";
import { useLiveQuery } from "dexie-react-hooks";
import {
  Wallet,
  Target, ChevronRight, CheckSquare, Calendar, Heart,
  CheckCircle, Timer, CalendarDays, StickyNote, LayoutGrid
} from "lucide-react";
import { getTransactionsByDate } from "@/lib/db/accounting.db";
import type { Transaction } from "@/lib/db/accounting.db";
import { getWaterLogsByDate, getWaterGoal, getWorkoutSessionByDate, getSleepLogByDate } from "@/lib/db/health.db";
import { getHabits } from "@/lib/db/life.db";
import type { Habit } from "@/lib/db/life.db";

// ============================================================
// 首页仪表盘 — 问候 + 今日摘要 + 快捷功能入口
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

// ============================================================

const QUICK_MODULES = [
  { label: "目标管理", icon: Target, href: "/efficiency" },
  { label: "事项清单", icon: CheckSquare, href: "/tasks" },
  { label: "日程安排", icon: Calendar, href: "/efficiency/schedule" },
  { label: "记账", icon: Wallet, href: "/more/accounting" },
  { label: "健康", icon: Heart, href: "/more" },
  { label: "习惯打卡", icon: CheckCircle, href: "/more/habits" },
  { label: "专注计时", icon: Timer, href: "/focus" },
  { label: "倒数日", icon: CalendarDays, href: "/more/countdown" },
  { label: "备忘录", icon: StickyNote, href: "/more/notes" },
  { label: "更多工具", icon: LayoutGrid, href: "/more" },
];

// ============================================================

export default function HomePage() {
  const today = todayStr();

  // ── 数据 ──
  const todayTxs = useLiveQuery(() => getTransactionsByDate(today), [today], [] as Transaction[]);
  const todayWaterLogs = useLiveQuery(() => getWaterLogsByDate(today), [today], []);
  const [waterGoalData, setWaterGoalData] = useState<{ dailyTarget: number }>({ dailyTarget: 2000 });
  useEffect(() => { getWaterGoal().then((g) => setWaterGoalData(g)).catch(() => {}); }, []);
  const waterGoal = waterGoalData;
  const todayWorkout = useLiveQuery(() => getWorkoutSessionByDate(today), [today], undefined);
  const todaySleep = useLiveQuery(() => getSleepLogByDate(today), [today], undefined);
  const habits = useLiveQuery(() => getHabits(), [], [] as Habit[]);

  // ── 聚合 ──
  const todayExpense = (todayTxs ?? []).filter((t) => t.type === "expense").reduce((s, t) => s + t.amount, 0);
  const todayIncome = (todayTxs ?? []).filter((t) => t.type === "income").reduce((s, t) => s + t.amount, 0);

  const waterTotal = (todayWaterLogs ?? []).reduce((s, l) => s + l.amount, 0);
  const waterTarget = waterGoal?.dailyTarget ?? 2000;
  const waterPct = waterTarget > 0 ? Math.min(100, Math.round((waterTotal / waterTarget) * 100)) : 0;
  const sleepHours = todaySleep ? `${Math.floor(timeToMinutes(todaySleep.actualTime) / 60)}h` : "--";
  const trained = !!todayWorkout;

  const completedHabits = useMemo(() => {
    if (!habits || habits.length === 0) return 0;
    return habits.filter((h) => h.days[today]).length;
  }, [habits, today]);

  const now = new Date();
  const hour = now.getHours();
  const greeting = hour < 6 ? "凌晨好" : hour < 9 ? "早上好" : hour < 12 ? "上午好" : hour < 14 ? "中午好" : hour < 18 ? "下午好" : "晚上好";

  // ── Section 2 摘要数据 ──
  const summaryStrips = [
    {
      label: "今日目标",
      icon: Target,
      value: habits && habits.length > 0
        ? `${completedHabits}/${habits.length} 完成`
        : "暂无目标",
      href: "/efficiency",
    },
    {
      label: "今日收支",
      icon: Wallet,
      value: `收入 ¥${fmtCompact(todayIncome)} · 支出 ¥${fmtCompact(todayExpense)}`,
      href: "/more/accounting",
    },
    {
      label: "今日健康",
      icon: Heart,
      value: `睡眠 ${sleepHours} · 饮水 ${waterPct}% · 训练${trained ? "✓" : "--"}`,
      href: "/more",
    },
  ];

  return (
    <div>
      {/* ===== Section 1: Header / Date Greeting ===== */}
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, ease: "easeOut" }}
        className="px-5 pt-4 pb-6"
      >
        <div className="text-label">{formatDateChinese(now)}</div>
        <h1 className="text-title-large" style={{ color: "var(--color-text-primary)" }}>
          {greeting}
        </h1>
      </motion.div>

      {/* ===== Section 2: Today's Summary Strips ===== */}
      <div className="flex flex-col gap-3 px-5 pb-8">
        {summaryStrips.map((strip, i) => (
          <motion.div
            key={strip.label}
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 + i * 0.05, duration: 0.4, ease: "easeOut" }}
          >
            <Link href={strip.href} className="block">
              <div className="card-standard flex items-center gap-3 px-5 py-4">
                <div
                  className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0"
                  style={{ background: "var(--lifeflow-brand-50)" }}
                >
                  <strip.icon className="w-5 h-5" style={{ color: "var(--lifeflow-brand)" }} />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-[15px] font-medium" style={{ color: "var(--color-text-primary)" }}>
                    {strip.label}
                  </div>
                  <div
                    className="text-[13px] truncate"
                    style={{ color: "var(--color-text-secondary)" }}
                  >
                    {strip.value}
                  </div>
                </div>
                <ChevronRight className="w-5 h-5 shrink-0" style={{ color: "var(--color-text-disabled)" }} />
              </div>
            </Link>
          </motion.div>
        ))}
      </div>

      {/* ===== Section 3: Quick Module Grid ===== */}
      <div className="grid grid-cols-2 gap-3 px-5 pb-16">
        {QUICK_MODULES.map((mod, i) => (
          <motion.div
            key={mod.label}
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 + i * 0.04, duration: 0.4, ease: "easeOut" }}
          >
            <Link href={mod.href} className="block">
              <div className="card-standard flex flex-col items-start justify-center px-4 h-[72px]">
                <mod.icon className="h-5 w-5 mb-1.5" style={{ color: "var(--lifeflow-brand)" }} />
                <span className="text-[15px] font-medium" style={{ color: "var(--color-text-primary)" }}>
                  {mod.label}
                </span>
              </div>
            </Link>
          </motion.div>
        ))}
      </div>
    </div>
  );
}
