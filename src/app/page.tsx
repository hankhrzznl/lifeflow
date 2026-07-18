"use client";

import { useMemo } from "react";
import Link from "next/link";
import { motion } from "framer-motion";
import { useLiveQuery } from "dexie-react-hooks";
import {
  Target, PlusCircle, ChevronRight,
  Droplets, Moon,
} from "lucide-react";
import { efficiencyDB } from "@/lib/db/efficiency.db";
import type { Goal, ScheduleTask } from "@/lib/db/efficiency.db";
import { accountingDB } from "@/lib/db/accounting.db";
import type { Transaction, Category } from "@/lib/db/accounting.db";
import { healthDB } from "@/lib/db/health.db";
import type { WaterLog, SleepRecord } from "@/lib/db/health.db";

// ============================================================
// 工具
// ============================================================

function todayStr(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function greetByHour(hour: number): string {
  if (hour >= 6 && hour < 12) return "早上好";
  if (hour >= 12 && hour < 18) return "下午好";
  return "晚上好";
}

function formatDateCN(date: Date): string {
  const weekDays = ["日", "一", "二", "三", "四", "五", "六"];
  return `${date.getMonth() + 1}月${date.getDate()}日 周${weekDays[date.getDay()]}`;
}

function formatYuan(fen: number): string {
  // 分转元，取整，不带小数位
  const yuan = Math.round(fen / 100);
  if (yuan >= 0) return `¥${yuan.toLocaleString("zh-CN")}`;
  return `-¥${Math.abs(yuan).toLocaleString("zh-CN")}`;
}

function formatSignedYuan(fen: number): string {
  const yuan = Math.round(fen / 100);
  if (yuan >= 0) return `+¥${yuan.toLocaleString("zh-CN")}`;
  return `-¥${Math.abs(yuan).toLocaleString("zh-CN")}`;
}

function formatWater(ml: number): string {
  if (ml >= 1000) return `${(ml / 1000).toFixed(1)}L`;
  return `${ml}ml`;
}

function formatSleep(hours: number): string {
  return `${hours.toFixed(1)}h`;
}

function sleepQualityText(quality: number): string {
  if (quality >= 4) return "良好";
  if (quality === 3) return "一般";
  return "较差";
}

// ============================================================
// 迷你进度条
// ============================================================

function MiniProgressBar({ pct }: { pct: number }) {
  const clamped = Math.min(100, Math.max(0, pct));
  return (
    <div className="h-1 rounded-full bg-[#E5E5E5] overflow-hidden">
      <motion.div
        initial={{ width: 0 }}
        animate={{ width: `${clamped}%` }}
        transition={{ duration: 0.6, ease: "easeOut" }}
        className="h-full rounded-full bg-[#5865F2]"
      />
    </div>
  );
}

// ============================================================
// 迷你圆环
// ============================================================

function MiniRing({ pct, size = 40, strokeWidth = 4 }: { pct: number; size?: number; strokeWidth?: number }) {
  const clamped = Math.min(100, Math.max(0, pct));
  const r = (size - strokeWidth) / 2;
  const circ = 2 * Math.PI * r;
  const center = size / 2;

  return (
    <svg width={size} height={size} className="flex-shrink-0">
      <circle
        cx={center} cy={center} r={r}
        fill="none"
        stroke="#E5E5E5"
        strokeWidth={strokeWidth}
      />
      <motion.circle
        cx={center} cy={center} r={r}
        fill="none"
        stroke="#5865F2"
        strokeWidth={strokeWidth}
        strokeLinecap="round"
        strokeDasharray={circ}
        initial={{ strokeDashoffset: circ }}
        animate={{ strokeDashoffset: circ - (circ * clamped) / 100 }}
        transition={{ duration: 0.8, ease: "easeOut" }}
        style={{ transform: "rotate(-90deg)", transformOrigin: "center" }}
      />
    </svg>
  );
}

// ============================================================
// 主页
// ============================================================

export default function DashboardPage() {
  const today = todayStr();
  const now = new Date();
  const greeting = greetByHour(now.getHours());
  const dateLabel = formatDateCN(now);

  // ─── 效率数据 ────────────────────────────────────────────

  const efficiencyData = useLiveQuery(async () => {
    const [goals, scheduleTasks] = await Promise.all([
      efficiencyDB.goals.toArray(),
      efficiencyDB.scheduleTasks.toArray(),
    ]);
    return { goals, scheduleTasks };
  }, [], { goals: [] as Goal[], scheduleTasks: [] as ScheduleTask[] });

  const {
    todayTaskTotal, todayTaskCompleted, completionPct,
    pendingTasks,
    goalColorMap,
  } = useMemo(() => {
    if (!efficiencyData) return {
      todayTaskTotal: 0, todayTaskCompleted: 0, completionPct: 0,
      pendingTasks: [] as ScheduleTask[],
      goalColorMap: new Map<string, string>(),
    };

    const { goals, scheduleTasks } = efficiencyData;

    const colorMap = new Map<string, string>();
    for (const g of goals) colorMap.set(g.id, g.color);

    const tTasks = scheduleTasks.filter((t) => {
      if (t.isCompleted) return false;
      if (t.date === today) return true;
      if (t.type === "multi_day" && t.startDate && t.endDate) {
        return t.startDate <= today && t.endDate >= today;
      }
      return false;
    });

    const allTodayTasks = scheduleTasks.filter((t) => {
      if (t.date === today) return true;
      if (t.type === "multi_day" && t.startDate && t.endDate) {
        return t.startDate <= today && t.endDate >= today;
      }
      return false;
    });

    const completed = allTodayTasks.filter((t) => t.isCompleted).length;
    const total = allTodayTasks.length;
    const pct = total > 0 ? Math.round((completed / total) * 100) : 0;

    // 未完成任务按日期排序，取前2条
    const pending = tTasks
      .sort((a, b) => (a.date || "").localeCompare(b.date || ""))
      .slice(0, 2);

    return {
      todayTaskTotal: total,
      todayTaskCompleted: completed,
      completionPct: pct,
      pendingTasks: pending,
      goalColorMap: colorMap,
    };
  }, [efficiencyData, today]);

  // ─── 记账数据 ────────────────────────────────────────────

  const accountingData = useLiveQuery(async () => {
    const [txs, cats] = await Promise.all([
      accountingDB.transactions.toArray(),
      accountingDB.categories.toArray(),
    ]);
    return { txs, cats };
  }, [], { txs: [] as Transaction[], cats: [] as Category[] });

  const {
    todayNet, todayExpenseCount, top2Transactions,
    categoryMap,
  } = useMemo(() => {
    if (!accountingData) return {
      todayNet: 0, todayExpenseCount: 0,
      top2Transactions: [] as Transaction[],
      categoryMap: new Map<string, Category>(),
    };

    const { txs, cats } = accountingData;

    const catMap = new Map<string, Category>();
    for (const c of cats) catMap.set(c.id, c);

    const todayTxs = txs.filter((t) => t.date === today);
    const incomeTotal = todayTxs.filter((t) => t.type === "income").reduce((s, t) => s + t.amount, 0);
    const expenseTotal = todayTxs.filter((t) => t.type === "expense").reduce((s, t) => s + t.amount, 0);
    const net = incomeTotal - expenseTotal;
    const expenseCount = todayTxs.filter((t) => t.type === "expense").length;

    const top2 = todayTxs
      .sort((a, b) => b.createdAt - a.createdAt)
      .slice(0, 2);

    return {
      todayNet: net,
      todayExpenseCount: expenseCount,
      top2Transactions: top2,
      categoryMap: catMap,
    };
  }, [accountingData, today]);

  // ─── 健康数据 ────────────────────────────────────────────

  const healthData = useLiveQuery(async () => {
    const [waterLogs, sleepRecords, waterGoals] = await Promise.all([
      healthDB.waterLogs.toArray(),
      healthDB.sleepRecords.toArray(),
      healthDB.waterGoals.toArray(),
    ]);
    const waterGoal = waterGoals.length > 0 ? waterGoals[0] : { dailyTarget: 2000, cupSize: 200 };
    return { waterLogs, sleepRecords, waterGoal };
  }, [], {
    waterLogs: [] as WaterLog[],
    sleepRecords: [] as SleepRecord[],
    waterGoal: { dailyTarget: 2000, cupSize: 200 },
  });

  const {
    waterMl, waterGoal, healthPct,
    lastSleep,
  } = useMemo(() => {
    if (!healthData) return {
      waterMl: 0, waterGoal: 2000, healthPct: 0,
      lastSleep: undefined as SleepRecord | undefined,
    };

    const { waterLogs, sleepRecords, waterGoal } = healthData;

    const todayLogs = waterLogs.filter((l) => l.date === today);
    const wMl = todayLogs.reduce((s, l) => s + l.amount, 0);
    const wGoal = waterGoal.dailyTarget || 2000;
    // 今日健康百分比 = 今日饮水完成度
    const hPct = wGoal > 0 ? Math.min(100, Math.round((wMl / wGoal) * 100)) : 0;

    const sSorted = [...sleepRecords].sort((a, b) => b.date.localeCompare(a.date));
    const lastS = sSorted[0];

    return { waterMl: wMl, waterGoal: wGoal, healthPct: hPct, lastSleep: lastS };
  }, [healthData, today]);

  // ─── 数据就绪标记 ─────────────────────────────────────────

  const isReady = efficiencyData && accountingData && healthData;

  // ─── 卡入场动画 ──────────────────────────────────────────

  const cardAnim = (delay: number) => ({
    initial: { opacity: 0, y: 12 },
    animate: { opacity: 1, y: 0 },
    transition: { delay, duration: 0.35, ease: "easeOut" as const },
  });

  // ============================================================
  // 渲染
  // ============================================================

  return (
    <div className="min-h-screen bg-[#FAFAFA]">
      <div className="mx-auto max-w-[430px] px-4 pt-12 pb-28 flex flex-col gap-4">

        {/* ===== 页头（问候区） ===== */}
        <motion.div {...cardAnim(0)} className="flex flex-col gap-1">
          <span className="text-[13px] text-[#86868B]">{dateLabel}</span>
          <h1 className="text-[34px] font-bold text-[#1D1D1F] tracking-tight">{greeting}</h1>
        </motion.div>

        {/* ===== 装饰分隔（标语区） ===== */}
        <motion.div {...cardAnim(0.03)} className="flex flex-col items-center gap-1 py-2">
          <div className="w-full flex flex-col gap-1">
            <div className="h-px w-full bg-[#E5E5E5]" />
            <div className="h-px w-full bg-[#E5E5E5]" />
            <div className="h-px w-full bg-[#E5E5E5]" />
          </div>
          <span className="text-[13px] text-[#AEAEB2] mt-1">三条线，一张网</span>
        </motion.div>

        {/* ===== 今日概览卡（三指标） ===== */}
        <motion.div
          {...cardAnim(0.06)}
          className="bg-white rounded-[20px] border border-[#F5F5F5] p-5"
        >
          {!isReady ? (
            <div className="grid grid-cols-3 gap-4">
              {[1, 2, 3].map((i) => (
                <div key={i} className="flex flex-col gap-2">
                  <div className="h-4 w-12 bg-[#F5F5F5] rounded animate-pulse" />
                  <div className="h-8 w-16 bg-[#F5F5F5] rounded animate-pulse" />
                  <div className="h-4 w-full bg-[#F5F5F5] rounded animate-pulse" />
                </div>
              ))}
            </div>
          ) : (
            <div className="grid grid-cols-3">
              {/* 今日目标 */}
              <div className="flex flex-col gap-1.5">
                <span className="text-[13px] text-[#86868B]">今日目标</span>
                <span className="text-[28px] font-bold text-[#1D1D1F] leading-none">
                  {todayTaskCompleted}/{todayTaskTotal}
                </span>
                <MiniProgressBar pct={completionPct} />
              </div>

              {/* 今日收支 */}
              <div className="flex flex-col gap-1.5 px-3">
                <span className="text-[13px] text-[#86868B]">今日收支</span>
                <span className="text-[28px] font-bold text-[#1D1D1F] leading-none">
                  {formatYuan(todayNet)}
                </span>
                <span className="text-[12px] text-[#AEAEB2]">
                  支出 {todayExpenseCount} 笔
                </span>
              </div>

              {/* 今日健康 */}
              <div className="flex flex-col gap-1.5">
                <span className="text-[13px] text-[#86868B]">今日健康</span>
                <span className="text-[28px] font-bold text-[#1D1D1F] leading-none">
                  {healthPct}%
                </span>
                <MiniRing pct={healthPct} />
              </div>
            </div>
          )}
        </motion.div>

        {/* ===== 快捷操作行 ===== */}
        <motion.div {...cardAnim(0.09)} className="grid grid-cols-2 gap-3">
          <Link href="/efficiency/create">
            <motion.div
              whileTap={{ scale: 0.97 }}
              className="h-16 rounded-[16px] bg-[#EEF2FF] flex items-center justify-center gap-2 cursor-pointer"
            >
              <Target className="w-[22px] h-[22px] text-[#5865F2]" strokeWidth={2} />
              <span className="text-[15px] font-semibold text-[#5865F2]">添加目标</span>
            </motion.div>
          </Link>
          <Link href="/accounting/record">
            <motion.div
              whileTap={{ scale: 0.97 }}
              className="h-16 rounded-[16px] bg-[#EEF2FF] flex items-center justify-center gap-2 cursor-pointer"
            >
              <PlusCircle className="w-[22px] h-[22px] text-[#5865F2]" strokeWidth={2} />
              <span className="text-[15px] font-semibold text-[#5865F2]">记一笔</span>
            </motion.div>
          </Link>
        </motion.div>

        {/* ===== 效率分区卡 ===== */}
        <motion.div
          {...cardAnim(0.12)}
          className="bg-white rounded-[20px] border border-[#F5F5F5] p-5"
        >
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-[20px] font-bold text-[#1D1D1F]">效率</h2>
            <Link href="/efficiency" className="flex items-center gap-0.5">
              <span className="text-[15px] font-medium text-[#5865F2]">查看全部</span>
              <ChevronRight className="w-4 h-4 text-[#5865F2]" strokeWidth={2} />
            </Link>
          </div>

          {!isReady ? (
            <div className="space-y-3">
              {[1, 2].map((i) => (
                <div key={i} className="h-10 bg-[#F5F5F5] rounded-lg animate-pulse" />
              ))}
            </div>
          ) : pendingTasks.length === 0 ? (
            <div className="py-4 text-center text-[13px] text-[#AEAEB2]">暂无待办事项</div>
          ) : (
            <div className="flex flex-col">
              {pendingTasks.map((task, idx) => {
                const dotColor = task.goalId ? (goalColorMap.get(task.goalId) || "#5865F2") : "#5865F2";
                const dateLabelText = task.date === today
                  ? "今天"
                  : (() => {
                      const d = new Date();
                      d.setDate(d.getDate() + 1);
                      const tomorrow = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
                      if (task.date === tomorrow) return "明天";
                      if (task.date) {
                        const parts = task.date.split("-");
                        return `${parseInt(parts[1])}月${parseInt(parts[2])}日`;
                      }
                      return "";
                    })();
                return (
                  <div
                    key={task.id}
                    className={`flex items-center gap-3 py-2.5 ${idx > 0 ? "border-t border-[#F5F5F5]" : ""}`}
                  >
                    <div
                      className="w-2 h-2 rounded-full flex-shrink-0"
                      style={{ backgroundColor: dotColor }}
                    />
                    <span className="text-[15px] text-[#1D1D1F] truncate flex-1">{task.title}</span>
                    <span className="text-[13px] text-[#AEAEB2] flex-shrink-0">{dateLabelText}</span>
                  </div>
                );
              })}
            </div>
          )}
        </motion.div>

        {/* ===== 记账分区卡 ===== */}
        <motion.div
          {...cardAnim(0.15)}
          className="bg-white rounded-[20px] border border-[#F5F5F5] p-5"
        >
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-[20px] font-bold text-[#1D1D1F]">记账</h2>
            <Link href="/accounting" className="flex items-center gap-0.5">
              <span className="text-[15px] font-medium text-[#5865F2]">查看全部</span>
              <ChevronRight className="w-4 h-4 text-[#5865F2]" strokeWidth={2} />
            </Link>
          </div>

          {!isReady ? (
            <div className="space-y-3">
              {[1, 2].map((i) => (
                <div key={i} className="h-10 bg-[#F5F5F5] rounded-lg animate-pulse" />
              ))}
            </div>
          ) : top2Transactions.length === 0 ? (
            <div className="py-4 text-center text-[13px] text-[#AEAEB2]">今日暂无收支记录</div>
          ) : (
            <div className="flex flex-col">
              {top2Transactions.map((tx, idx) => {
                const cat = tx.categoryId ? categoryMap.get(tx.categoryId) : undefined;
                const label = tx.note || cat?.name || "未命名";
                return (
                  <div
                    key={tx.id}
                    className={`flex items-center justify-between py-3 ${idx > 0 ? "border-t border-[#F5F5F5]" : ""}`}
                  >
                    <span className="text-[15px] text-[#1D1D1F] truncate flex-1 mr-2">{label}</span>
                    <span className="text-[15px] font-semibold text-[#1D1D1F] flex-shrink-0">
                      {formatSignedYuan(tx.type === "income" ? tx.amount : -tx.amount)}
                    </span>
                  </div>
                );
              })}
            </div>
          )}
        </motion.div>

        {/* ===== 健康分区卡 ===== */}
        <motion.div
          {...cardAnim(0.18)}
          className="bg-white rounded-[20px] border border-[#F5F5F5] p-5"
        >
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-[20px] font-bold text-[#1D1D1F]">健康</h2>
            <Link href="/health" className="flex items-center gap-0.5">
              <span className="text-[15px] font-medium text-[#5865F2]">查看全部</span>
              <ChevronRight className="w-4 h-4 text-[#5865F2]" strokeWidth={2} />
            </Link>
          </div>

          {!isReady ? (
            <div className="grid grid-cols-2">
              {[1, 2].map((i) => (
                <div key={i} className="flex flex-col items-center gap-2 py-2">
                  <div className="w-6 h-6 bg-[#F5F5F5] rounded animate-pulse" />
                  <div className="h-4 w-12 bg-[#F5F5F5] rounded animate-pulse" />
                  <div className="h-7 w-16 bg-[#F5F5F5] rounded animate-pulse" />
                  <div className="h-4 w-20 bg-[#F5F5F5] rounded animate-pulse" />
                </div>
              ))}
            </div>
          ) : (
            <div className="grid grid-cols-2">
              {/* 饮水列 */}
              <div className="flex flex-col items-center gap-1 py-2 border-r border-[#F5F5F5]">
                <Droplets className="w-6 h-6 text-[#5865F2]" strokeWidth={2} />
                <span className="text-[13px] text-[#86868B]">今日饮水</span>
                <span className="text-[24px] font-bold text-[#1D1D1F]">
                  {waterMl > 0 ? formatWater(waterMl) : "暂无记录"}
                </span>
                <span className="text-[12px] text-[#AEAEB2]">目标 {formatWater(waterGoal)}</span>
              </div>

              {/* 睡眠列 */}
              <div className="flex flex-col items-center gap-1 py-2">
                <Moon className="w-6 h-6 text-[#5865F2]" strokeWidth={2} />
                <span className="text-[13px] text-[#86868B]">昨晚睡眠</span>
                <span className="text-[24px] font-bold text-[#1D1D1F]">
                  {lastSleep ? formatSleep(lastSleep.duration) : "暂无记录"}
                </span>
                <span className="text-[12px] text-[#AEAEB2]">
                  {lastSleep ? `质量 · ${sleepQualityText(lastSleep.quality)}` : ""}
                </span>
              </div>
            </div>
          )}
        </motion.div>

      </div>
    </div>
  );
}
