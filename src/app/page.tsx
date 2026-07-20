"use client";

import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import { motion } from "framer-motion";
import { useLiveQuery } from "dexie-react-hooks";
import { Droplets, Moon, Wallet, Flame } from "lucide-react";
import { getTransactionsByDate } from "@/lib/db/accounting.db";
import type { Transaction } from "@/lib/db/accounting.db";
import { getWaterLogsByDate, getWaterGoal, getWorkoutSessionByDate, getSleepLogByDate } from "@/lib/db/health.db";
import { getHabits, toggleHabitDay } from "@/lib/db/life.db";
import type { Habit } from "@/lib/db/life.db";

// ============================================================
// 首页仪表盘 — 精简版：问候 + 收支 + 健康 + 习惯
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

  const toggleHabit = useCallback(async (habit: Habit) => {
    await toggleHabitDay(habit.id, today);
  }, [today]);

  const hour = new Date().getHours();
  const greeting = hour < 6 ? "凌晨好" : hour < 9 ? "早上好" : hour < 12 ? "上午好" : hour < 14 ? "中午好" : hour < 18 ? "下午好" : "晚上好";

  return (
    <div className="px-4 pt-5 pb-6 flex flex-col gap-4">
      {/* ===== 问候（缩小） ===== */}
      <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
        className="rounded-2xl px-5 py-4 text-white" style={{ background: "linear-gradient(135deg, #6366F1, #8B5CF6)" }}>
        <div className="flex items-center justify-between">
          <div>
            <span className="text-[15px] opacity-90">{greeting}</span>
            <span className="text-[13px] opacity-70 ml-2">三条线，一张网</span>
          </div>
          <span className="text-[13px] opacity-60">{today}</span>
        </div>
      </motion.div>

      {/* ===== 今日收支 ===== */}
      <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.05 }}
        className="rounded-xl bg-white p-4 shadow-[0_1px_4px_rgba(0,0,0,0.04)]">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <Wallet className="w-5 h-5" style={{ color: "#34C759" }} />
            <span className="text-[17px] font-semibold">今日收支</span>
          </div>
          <Link href="/more/accounting" className="text-[13px]" style={{ color: "#34C759" }}>查看全部 →</Link>
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
      <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}
        className="rounded-xl bg-white p-4 shadow-[0_1px_4px_rgba(0,0,0,0.04)]">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <Heart className="w-5 h-5" style={{ color: "#FF9500" }} />
            <span className="text-[17px] font-semibold">健康概览</span>
          </div>
          <Link href="/more" className="text-[13px]" style={{ color: "#FF9500" }}>详情 →</Link>
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
        <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.15 }}
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

      {(!habits || habits.length === 0) && (
        <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.15 }}
          className="rounded-xl bg-white p-4 shadow-[0_1px_4px_rgba(0,0,0,0.04)] text-center">
          <p className="text-[15px]" style={{ color: "#AEAEB2" }}>还没有习惯，去添加一个吧</p>
          <Link href="/more/habits" className="text-[13px] mt-1 inline-block" style={{ color: "#6366F1" }}>前往设置 →</Link>
        </motion.div>
      )}
    </div>
  );
}

// ─── 工具 ────────────────────────────────────────────────────

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
