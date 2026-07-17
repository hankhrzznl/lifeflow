"use client";

import { useMemo } from "react";
import Link from "next/link";
import { motion } from "framer-motion";
import { useLiveQuery } from "dexie-react-hooks";
import {
  Target, Wallet, Heart, ArrowRight, CheckCircle, Clock,
  Droplets, Moon, Dumbbell, Sparkles,
  TrendingUp, TrendingDown, PiggyBank,
} from "lucide-react";
import { efficiencyDB } from "@/lib/db/efficiency.db";
import type { Goal, ScheduleTask } from "@/lib/db/efficiency.db";
import { accountingDB } from "@/lib/db/accounting.db";
import type { Transaction } from "@/lib/db/accounting.db";
import { healthDB } from "@/lib/db/health.db";
import type { WaterLog, SleepRecord, WorkoutSession } from "@/lib/db/health.db";

// ============================================================
// 工具
// ============================================================

function todayStr(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function monthPrefix(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

function formatDate(date: Date): string {
  const weekDays = ["日", "一", "二", "三", "四", "五", "六"];
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  const w = weekDays[date.getDay()];
  return `${y}年${m}月${d}日 星期${w}`;
}

function fmtYuan(fen: number): string {
  return `￥${(fen / 100).toLocaleString("zh-CN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

// ============================================================
// 进度条
// ============================================================

function ProgressBar({ pct, color }: { pct: number; color: string }) {
  const clampedPct = Math.min(100, Math.max(0, pct));
  return (
    <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
      <motion.div
        initial={{ width: 0 }}
        animate={{ width: `${clampedPct}%` }}
        transition={{ duration: 0.6, ease: "easeOut" }}
        className="h-full rounded-full"
        style={{ backgroundColor: color }}
      />
    </div>
  );
}

// ============================================================
// 空状态
// ============================================================

function EmptyState({ href, label, brandColor }: { href: string; label: string; brandColor: string }) {
  return (
    <div className="text-center py-4">
      <p className="text-sm text-gray-400 mb-3">暂无数据，快去记录吧</p>
      <Link href={href}>
        <span
          className="inline-block px-4 py-1.5 rounded-full text-xs font-medium transition-colors hover:opacity-80"
          style={{ backgroundColor: `${brandColor}18`, color: brandColor }}
        >
          {label}
        </span>
      </Link>
    </div>
  );
}

// ============================================================
// 概览卡片框架
// ============================================================

function CardFrame({
  brandColor,
  icon: Icon,
  title,
  href,
  children,
}: {
  brandColor: string;
  icon: React.ComponentType<{ className?: string; style?: React.CSSProperties }>;
  title: string;
  href: string;
  children: React.ReactNode;
}) {
  const bg = brandColor === "#5856D6" ? "#ECECFC"
    : brandColor === "#34C759" ? "#E6F9EC"
    : "#FFF2E0";

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      className="bg-white rounded-2xl shadow-sm overflow-hidden"
    >
      <div className="h-1" style={{ backgroundColor: brandColor }} />
      <div className="p-5">
        {/* 标题行 */}
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <div
              className="w-8 h-8 rounded-xl flex items-center justify-center"
              style={{ backgroundColor: bg }}
            >
              <Icon className="w-4 h-4" style={{ color: brandColor }} />
            </div>
            <h2 className="font-semibold text-gray-900">{title}</h2>
          </div>
        </div>

        {/* 内容 */}
        {children}

        {/* 查看详情 */}
        <Link href={href} className="flex items-center gap-1 mt-4 pt-3 border-t border-gray-50 group">
          <span className="text-xs text-gray-400 group-hover:text-gray-600 transition-colors">查看详情</span>
          <ArrowRight className="w-3 h-3 text-gray-300 group-hover:text-gray-500 transition-colors" />
        </Link>
      </div>
    </motion.div>
  );
}

// ============================================================
// 快捷入口
// ============================================================

function QuickLink({
  href, icon: Icon, label, color, bg,
}: {
  href: string; icon: React.ComponentType<{ className?: string; style?: React.CSSProperties }>; label: string; color: string; bg: string;
}) {
  return (
    <Link
      href={href}
      className="flex flex-col items-center gap-2 p-5 bg-white rounded-2xl shadow-sm hover:shadow-md transition-shadow"
    >
      <div className="w-14 h-14 rounded-2xl flex items-center justify-center" style={{ backgroundColor: bg }}>
        <Icon className="w-7 h-7" style={{ color }} />
      </div>
      <span className="text-sm font-semibold" style={{ color }}>{label}</span>
      <span className="text-[11px] text-gray-400">进入子站</span>
    </Link>
  );
}

// ============================================================
// 主页
// ============================================================

export default function DashboardPage() {
  const today = todayStr();
  const mPrefix = monthPrefix();

  // ─── 效率数据 ────────────────────────────────────────────

  const efficiencyData = useLiveQuery(async () => {
    const [goals, scheduleTasks] = await Promise.all([
      efficiencyDB.goals.toArray(),
      efficiencyDB.scheduleTasks.toArray(),
    ]);
    return { goals, scheduleTasks };
  }, [], { goals: [] as Goal[], scheduleTasks: [] as ScheduleTask[] });

  const { activeGoals, todayTasks, todayCompleted, completionPct } = useMemo(() => {
    if (!efficiencyData) return { activeGoals: 0, todayTasks: 0, todayCompleted: 0, completionPct: 0 };
    const actGoals = efficiencyData.goals.filter((g) => g.status === "active").length;
    const tTasks = efficiencyData.scheduleTasks.filter((t) => {
      if (t.date === today) return true;
      if (t.type === "multi_day" && t.startDate && t.endDate) {
        return t.startDate <= today && t.endDate >= today;
      }
      return false;
    });
    const completed = tTasks.filter((t) => t.isCompleted).length;
    const pct = tTasks.length > 0 ? Math.round((completed / tTasks.length) * 100) : 0;
    return { activeGoals: actGoals, todayTasks: tTasks.length, todayCompleted: completed, completionPct: pct };
  }, [efficiencyData, today]);

  // ─── 记账数据 ────────────────────────────────────────────

  const accountingData = useLiveQuery(async () => {
    const allTxs = await accountingDB.transactions.toArray();
    return allTxs;
  }, [], [] as Transaction[]);

  const { todayExpense, todayIncome, monthBalance } = useMemo(() => {
    if (!accountingData) return { todayExpense: 0, todayIncome: 0, monthBalance: 0 };
    const todayTxs = accountingData.filter((t) => t.date === today);
    const monthTxs = accountingData.filter((t) => t.date.startsWith(mPrefix));
    const tExpense = todayTxs.filter((t) => t.type === "expense").reduce((s, t) => s + t.amount, 0);
    const tIncome = todayTxs.filter((t) => t.type === "income").reduce((s, t) => s + t.amount, 0);
    const mIncome = monthTxs.filter((t) => t.type === "income").reduce((s, t) => s + t.amount, 0);
    const mExpense = monthTxs.filter((t) => t.type === "expense").reduce((s, t) => s + t.amount, 0);
    return { todayExpense: tExpense, todayIncome: tIncome, monthBalance: mIncome - mExpense };
  }, [accountingData, today, mPrefix]);

  // ─── 健康数据 ────────────────────────────────────────────

  const healthData = useLiveQuery(async () => {
    const [waterLogs, sleepRecords, workoutSessions] = await Promise.all([
      healthDB.waterLogs.toArray(),
      healthDB.sleepRecords.toArray(),
      healthDB.workoutSessions.toArray(),
    ]);
    return { waterLogs, sleepRecords, workoutSessions };
  }, [], {
    waterLogs: [] as WaterLog[],
    sleepRecords: [] as SleepRecord[],
    workoutSessions: [] as WorkoutSession[],
  });

  const { waterMl, waterGoal, waterPct, sleepStatus, lastWorkoutDate } = useMemo(() => {
    if (!healthData) return { waterMl: 0, waterGoal: 2000, waterPct: 0, sleepStatus: "暂无", lastWorkoutDate: "" };
    const todayLogs = healthData.waterLogs.filter((l) => l.date === today);
    const wMl = todayLogs.reduce((s, l) => s + l.amount, 0);
    const wGoal = 2000;
    const wPct = Math.round((wMl / wGoal) * 100);

    const lastSleep = healthData.sleepRecords
      .sort((a, b) => b.date.localeCompare(a.date))[0];
    const sleepOk = lastSleep
      ? lastSleep.quality >= 3 && lastSleep.duration >= 7
      : false;
    const sStatus = lastSleep
      ? (sleepOk ? "已达标" : "未达标")
      : "暂无";

    const sessions = [...healthData.workoutSessions].sort((a, b) => b.date.localeCompare(a.date));
    const lastW = sessions[0]?.date ?? "";

    return { waterMl: wMl, waterGoal: wGoal, waterPct: wPct, sleepStatus: sStatus, lastWorkoutDate: lastW };
  }, [healthData, today]);

  // ─── 今日待办 ────────────────────────────────────────────

  const pendingTasks = useMemo(() => {
    if (!efficiencyData) return [];
    return efficiencyData.scheduleTasks
      .filter((t) => {
        if (t.isCompleted) return false;
        if (t.date === today) return true;
        if (t.type === "multi_day" && t.startDate && t.endDate) {
          return t.startDate <= today && t.endDate >= today;
        }
        return false;
      })
      .slice(0, 3);
  }, [efficiencyData, today]);

  // ─── 数据就绪标记 ─────────────────────────────────────────

  const isReady = efficiencyData && accountingData.length >= 0 && healthData;

  // ============================================================
  // 渲染
  // ============================================================

  return (
    <div className="min-h-screen bg-[#F5F5F7]">
      <div className="mx-auto max-w-2xl px-5 pt-10 pb-28 space-y-5">

        {/* ===== 头部 ===== */}
        <motion.div initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }}>
          <h1 className="text-[34px] font-bold text-gray-900 tracking-tight">LifeFlow</h1>
          <p className="text-sm text-gray-400 mt-1">{formatDate(new Date())}</p>
        </motion.div>

        {/* ===== 效率概览卡片 ===== */}
        <CardFrame brandColor="#5856D6" icon={Target} title="效率" href="/efficiency">
          {!isReady ? (
            <div className="h-20 flex items-center justify-center">
              <div className="w-5 h-5 border-2 border-gray-200 border-t-gray-400 rounded-full animate-spin" />
            </div>
          ) : activeGoals === 0 && todayTasks === 0 ? (
            <EmptyState href="/efficiency" label="去创建目标" brandColor="#5856D6" />
          ) : (
            <>
              <div className="grid grid-cols-2 gap-3 mb-4">
                <div className="bg-gray-50 rounded-xl p-3 text-center">
                  <div className="text-2xl font-bold text-gray-900">
                    {todayCompleted}<span className="text-base text-gray-400 font-normal">/{todayTasks}</span>
                  </div>
                  <div className="text-xs text-gray-500 mt-0.5">今日任务完成</div>
                </div>
                <div className="bg-gray-50 rounded-xl p-3 text-center">
                  <div className="text-2xl font-bold text-[#5856D6]">{activeGoals}</div>
                  <div className="text-xs text-gray-500 mt-0.5">进行中的目标</div>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <div className="flex-1">
                  <ProgressBar pct={completionPct} color="#5856D6" />
                </div>
                <span className="text-sm font-bold text-[#5856D6] w-10 text-right">{completionPct}%</span>
              </div>
            </>
          )}
        </CardFrame>

        {/* ===== 记账概览卡片 ===== */}
        <CardFrame brandColor="#34C759" icon={Wallet} title="记账" href="/accounting">
          {!isReady ? (
            <div className="h-20 flex items-center justify-center">
              <div className="w-5 h-5 border-2 border-gray-200 border-t-gray-400 rounded-full animate-spin" />
            </div>
          ) : todayExpense === 0 && todayIncome === 0 ? (
            <EmptyState href="/accounting" label="去记一笔" brandColor="#34C759" />
          ) : (
            <>
              <div className="grid grid-cols-2 gap-3 mb-4">
                <div className="bg-gray-50 rounded-xl p-3 text-center">
                  <div className="flex items-center justify-center gap-1 mb-0.5">
                    <TrendingDown className="w-3.5 h-3.5 text-[#FF3B30]" />
                    <span className="text-xs text-gray-500">今日支出</span>
                  </div>
                  <div className="text-xl font-bold text-[#FF3B30]">{fmtYuan(todayExpense)}</div>
                </div>
                <div className="bg-gray-50 rounded-xl p-3 text-center">
                  <div className="flex items-center justify-center gap-1 mb-0.5">
                    <TrendingUp className="w-3.5 h-3.5 text-[#34C759]" />
                    <span className="text-xs text-gray-500">今日收入</span>
                  </div>
                  <div className="text-xl font-bold text-[#34C759]">{fmtYuan(todayIncome)}</div>
                </div>
              </div>
              <div className="bg-gray-50 rounded-xl p-3 flex items-center justify-center gap-2">
                <PiggyBank className="w-4 h-4 text-gray-400" />
                <span className="text-sm text-gray-500">本月结余</span>
                <span
                  className="text-sm font-bold"
                  style={{ color: monthBalance >= 0 ? "#34C759" : "#FF3B30" }}
                >
                  {fmtYuan(monthBalance)}
                </span>
              </div>
            </>
          )}
        </CardFrame>

        {/* ===== 健康概览卡片 ===== */}
        <CardFrame brandColor="#FF9500" icon={Heart} title="健康" href="/health">
          {!isReady ? (
            <div className="h-20 flex items-center justify-center">
              <div className="w-5 h-5 border-2 border-gray-200 border-t-gray-400 rounded-full animate-spin" />
            </div>
          ) : waterMl === 0 && sleepStatus === "暂无" && !lastWorkoutDate ? (
            <EmptyState href="/health" label="去记录健康" brandColor="#FF9500" />
          ) : (
            <>
              <div className="grid grid-cols-2 gap-3 mb-4">
                <div className="bg-gray-50 rounded-xl p-3">
                  <div className="flex items-center gap-1.5 mb-2">
                    <Droplets className="w-3.5 h-3.5 text-[#007AFF]" />
                    <span className="text-xs text-gray-500">饮水进度</span>
                  </div>
                  <div className="text-lg font-bold text-gray-900">
                    {waterMl}<span className="text-sm text-gray-400 font-normal">/{waterGoal}ml</span>
                  </div>
                  <div className="mt-2">
                    <ProgressBar pct={waterPct} color="#007AFF" />
                  </div>
                </div>
                <div className="bg-gray-50 rounded-xl p-3">
                  <div className="flex items-center gap-1.5 mb-2">
                    <Moon className="w-3.5 h-3.5 text-[#AF52DE]" />
                    <span className="text-xs text-gray-500">睡眠状态</span>
                  </div>
                  <div
                    className="text-lg font-bold"
                    style={{ color: sleepStatus === "已达标" ? "#34C759" : sleepStatus === "未达标" ? "#FF9500" : "#8E8E93" }}
                  >
                    {sleepStatus}
                  </div>
                  <div className="text-xs text-gray-400 mt-1">
                    {lastWorkoutDate ? `最近训练: ${lastWorkoutDate.slice(5)}` : "暂无训练"}
                  </div>
                </div>
              </div>
            </>
          )}
        </CardFrame>

        {/* ===== 今日待办 ===== */}
        {pendingTasks.length > 0 && (
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.15 }}
            className="bg-white rounded-2xl shadow-sm overflow-hidden"
          >
            <div className="p-5">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-xl flex items-center justify-center bg-[#FFF0E8]">
                    <Clock className="w-4 h-4 text-[#FF9500]" />
                  </div>
                  <h2 className="font-semibold text-gray-900">今日待办</h2>
                </div>
                <Link href="/efficiency/schedule" className="text-xs text-gray-400 hover:text-gray-600 transition-colors">
                  查看更多
                </Link>
              </div>
              <div className="space-y-2">
                {pendingTasks.map((task) => (
                  <div key={task.id} className="flex items-center gap-3 py-1.5">
                    <div
                      className="w-2 h-2 rounded-full flex-shrink-0"
                      style={{ backgroundColor: task.isImportant ? "#FF3B30" : "#D1D5DB" }}
                    />
                    <span className="text-sm text-gray-700 truncate flex-1">{task.title}</span>
                    {task.isImportant && (
                      <span className="text-[10px] text-[#FF3B30] bg-[#FFF0F0] px-2 py-0.5 rounded-full flex-shrink-0">
                        重要
                      </span>
                    )}
                  </div>
                ))}
              </div>
            </div>
          </motion.div>
        )}

        {/* ===== 快捷入口 ===== */}
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="grid grid-cols-3 gap-3"
        >
          <QuickLink href="/efficiency" icon={Target} label="效率" color="#5856D6" bg="#ECECFC" />
          <QuickLink href="/accounting" icon={Wallet} label="记账" color="#34C759" bg="#E6F9EC" />
          <QuickLink href="/health" icon={Heart} label="健康" color="#FF9500" bg="#FFF2E0" />
        </motion.div>

      </div>
    </div>
  );
}
