"use client";

import { useMemo, useCallback } from "react";
import Link from "next/link";
import { motion } from "framer-motion";
import {
  CheckCircle2, Wallet, HeartPulse, LayoutDashboard, ChevronRight,
  TrendingUp, ListTodo, Circle,
} from "lucide-react";
import { useLiveQuery } from "dexie-react-hooks";
import { getTransactionsByDate } from "@/lib/db/accounting.db";
import type { Transaction } from "@/lib/db/accounting.db";
import { getScheduleTasksByDate, updateScheduleTask } from "@/lib/db/efficiency.db";
import type { ScheduleTask } from "@/lib/db/efficiency.db";
import {
  getWaterLogsByDate, getWaterGoal, getWorkoutSessionByDate,
} from "@/lib/db/health.db";
import { showToast } from "@/components/ui/Toast";

// ============================================================
// 设计稿基准: lifeflow-health/pages/dashboard.html
// 品牌橙 #FF9500
// ============================================================

const BRAND = "#FF9500";
const BG = "#F2F2F7";
const MUTED = "#8E8E93";
const TERTIARY = "#C7C7CC";
const BORDER = "#E5E5EA";
const INFO = "#007AFF";
const SUCCESS = "#34C759";
const SHADOW_CARD = "0 1px 4px rgba(0,0,0,0.04)";

// ─── 格式化 ──────────────────────────────────────────────────

function fmtCompact(fen: number): string {
  const yuan = fen / 100;
  return yuan.toLocaleString("zh-CN", {
    minimumFractionDigits: fen % 100 === 0 ? 0 : 2,
    maximumFractionDigits: 2,
  });
}

function todayStr(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function fmtDate(): string {
  const d = new Date();
  const weekMap = ["日", "一", "二", "三", "四", "五", "六"];
  return `${d.getFullYear()}年${d.getMonth() + 1}月${d.getDate()}日 星期${weekMap[d.getDay()]}`;
}

// ─── 本周日期列表 ────────────────────────────────────────────

function getWeekDates(): string[] {
  const now = new Date();
  const dayOfWeek = now.getDay(); // 0=周日
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

// 数据点坐标：y = 140 - clamp(pct, 0, 100) / 100 * 130
function yFromPct(pct: number): number {
  return 140 - Math.min(Math.max(pct, 0), 100) / 100 * 130;
}

// SVG 线 x 坐标
const LINE_X = [25, 66, 108, 149, 191, 233, 275];

// ============================================================
// 页面
// ============================================================

export default function HealthPage() {
  const today = todayStr();
  const weekDates = useMemo(() => getWeekDates(), []);

  // ─── 今日数据 ──────────────────────────────────────────────

  const todayTxs = useLiveQuery(() => getTransactionsByDate(today), [today], [] as Transaction[]);
  const todayTasks = useLiveQuery(() => getScheduleTasksByDate(today), [today], [] as ScheduleTask[]);
  const todayWaterLogs = useLiveQuery(() => getWaterLogsByDate(today), [today], []);
  const waterGoal = useLiveQuery(() => getWaterGoal(), [], undefined);
  const todayWorkout = useLiveQuery(() => getWorkoutSessionByDate(today), [today], undefined);

  // ─── 本周趋势数据 ──────────────────────────────────────────

  // 效率：每天任务完成率
  const weekTasks = useLiveQuery(
    () => Promise.all(weekDates.map((d) => getScheduleTasksByDate(d))),
    [weekDates],
    [] as ScheduleTask[][],
  );

  // 饮水：每天总量
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

  // 支出：每天支出总额（分）
  const weekExpense = useLiveQuery(
    async () => {
      const results: number[] = [];
      for (const d of weekDates) {
        const txs = await getTransactionsByDate(d);
        const exp = txs.filter((t) => t.type === "expense").reduce((s, t) => s + t.amount, 0);
        results.push(exp);
      }
      return results;
    },
    [weekDates],
    [] as number[],
  );

  // ─── 今日汇总计算 ──────────────────────────────────────────

  const efficiencyStats = useMemo(() => {
    const tasks = todayTasks ?? [];
    const done = tasks.filter((t) => t.isCompleted).length;
    const total = tasks.length;
    const rate = total > 0 ? Math.round((done / total) * 100) : 0;
    return { done, total, rate };
  }, [todayTasks]);

  const accountingStats = useMemo(() => {
    const txs = todayTxs ?? [];
    let exp = 0, inc = 0, incCount = 0;
    for (const t of txs) {
      if (t.type === "expense") exp += t.amount;
      else { inc += t.amount; incCount++; }
    }
    return { expense: exp, income: inc, incomeCount: incCount };
  }, [todayTxs]);

  const healthStats = useMemo(() => {
    const total = (todayWaterLogs ?? []).reduce((s, l) => s + l.amount, 0);
    const target = waterGoal?.dailyTarget ?? 2000;
    const pct = target > 0 ? Math.round((total / target) * 100) : 0;
    const met = total >= target;
    const trained = !!todayWorkout;
    return { total, target, pct, met, trained };
  }, [todayWaterLogs, waterGoal, todayWorkout]);

  // ─── 本周趋势线计算 ────────────────────────────────────────

  const trendLines = useMemo(() => {
    const taskPcts = (weekTasks ?? []).map((tasks) => {
      const done = tasks.filter((t) => t.isCompleted).length;
      return tasks.length > 0 ? (done / tasks.length) * 100 : 0;
    });

    const target = waterGoal?.dailyTarget ?? 2000;
    const waterPcts = (weekWater ?? []).map((v) =>
      target > 0 ? Math.min((v / target) * 100, 100) : 0,
    );

    const maxExp = Math.max(...(weekExpense ?? []), 0);
    const expensePcts = (weekExpense ?? []).map((v) =>
      maxExp > 0 ? (v / maxExp) * 100 : 0,
    );

    return { taskPcts, waterPcts, expensePcts };
  }, [weekTasks, weekWater, weekExpense, waterGoal]);

  // ─── 待办排序 ──────────────────────────────────────────────

  const sortedTasks = useMemo(() => {
    const tasks = todayTasks ?? [];
    const incomplete = tasks.filter((t) => !t.isCompleted);
    const completed = tasks.filter((t) => t.isCompleted);
    return [...incomplete, ...completed];
  }, [todayTasks]);

  const incompleteCount = (todayTasks ?? []).filter((t) => !t.isCompleted).length;

  // ─── 点击切换待办完成态 ────────────────────────────────────

  const toggleTask = useCallback(async (task: ScheduleTask) => {
    await updateScheduleTask(task.id, { isCompleted: !task.isCompleted });
  }, []);

  // ============================================================
  // 渲染
  // ============================================================

  return (
    <div className="px-4 flex flex-col gap-[12px]">
      {/* ===== ① 页头 ===== */}
      <div className="pt-[12px] pb-[8px]">
        <h1 className="text-[34px] font-bold tracking-[-0.02em] leading-tight" style={{ color: "#000000" }}>
          今日概览
        </h1>
        <p className="mt-1 text-[15px]" style={{ color: MUTED }}>
          {fmtDate()}
        </p>
      </div>

      {/* ===== ② 总览卡片横滑 ===== */}
      <div
        className="flex gap-[12px] overflow-x-auto snap-x snap-mandatory mx-[-16px] px-[16px]"
        style={{ scrollbarWidth: "none" }}
      >
        <style>{`.snap-mandatory::-webkit-scrollbar { display: none }`}</style>

        {/* 效率卡 */}
        <Link href="/efficiency" className="shrink-0 snap-center w-[280px]">
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            whileTap={{ scale: 0.98 }}
            className="rounded-[12px] p-[16px] flex flex-col"
            style={{ background: "#FFF", boxShadow: SHADOW_CARD }}
          >
            <div className="flex items-center gap-2">
              <CheckCircle2 className="w-6 h-6" style={{ color: INFO }} />
              <span className="text-[17px] font-semibold" style={{ color: "#000" }}>效率</span>
            </div>
            {efficiencyStats.total > 0 ? (
              <>
                <span className="mt-2 text-[34px] font-bold leading-none" style={{ color: INFO }}>
                  {efficiencyStats.rate}%
                </span>
                <div className="mt-1 flex items-baseline gap-2">
                  <span className="text-[13px]" style={{ color: MUTED }}>任务完成</span>
                  <span className="text-[13px]" style={{ color: MUTED }}>
                    {efficiencyStats.done}/{efficiencyStats.total} 任务
                  </span>
                </div>
              </>
            ) : (
              <>
                <span className="mt-2 text-[34px] font-bold leading-none" style={{ color: INFO }}>—</span>
                <div className="mt-1">
                  <span className="text-[13px]" style={{ color: MUTED }}>今日暂无任务</span>
                </div>
              </>
            )}
          </motion.div>
        </Link>

        {/* 记账卡 */}
        <Link href="/accounting" className="shrink-0 snap-center w-[280px]">
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.03 }}
            whileTap={{ scale: 0.98 }}
            className="rounded-[12px] p-[16px] flex flex-col"
            style={{ background: "#FFF", boxShadow: SHADOW_CARD }}
          >
            <div className="flex items-center gap-2">
              <Wallet className="w-6 h-6" style={{ color: SUCCESS }} />
              <span className="text-[17px] font-semibold" style={{ color: "#000" }}>记账</span>
            </div>
            {(todayTxs ?? []).length > 0 ? (
              <>
                <span className="mt-2 text-[28px] font-bold leading-none" style={{ color: SUCCESS }}>
                  ¥{fmtCompact(accountingStats.expense)}
                </span>
                <div className="mt-1 flex items-baseline gap-2">
                  <span className="text-[13px]" style={{ color: MUTED }}>今日支出</span>
                  <span className="text-[13px]" style={{ color: MUTED }}>
                    {accountingStats.incomeCount}笔收入 ¥{fmtCompact(accountingStats.income)}
                  </span>
                </div>
              </>
            ) : (
              <>
                <span className="mt-2 text-[28px] font-bold leading-none" style={{ color: SUCCESS }}>¥0</span>
                <div className="mt-1">
                  <span className="text-[13px]" style={{ color: MUTED }}>今日暂无收支</span>
                </div>
              </>
            )}
          </motion.div>
        </Link>

        {/* 健康卡 */}
        <Link href="/health/water" className="shrink-0 snap-center w-[280px]">
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.06 }}
            whileTap={{ scale: 0.98 }}
            className="rounded-[12px] p-[16px] flex flex-col"
            style={{ background: "#FFF", boxShadow: SHADOW_CARD }}
          >
            <div className="flex items-center gap-2">
              <HeartPulse className="w-6 h-6" style={{ color: BRAND }} />
              <span className="text-[17px] font-semibold" style={{ color: "#000" }}>健康</span>
            </div>
            <span className="mt-2 text-[17px] font-semibold leading-none" style={{ color: BRAND }}>
              {healthStats.total.toLocaleString()}ml
            </span>
            <div className="mt-1 flex items-baseline gap-2">
              {healthStats.total > 0 ? (
                <>
                  {healthStats.met ? (
                    <span className="text-[13px]" style={{ color: SUCCESS }}>✓ 达标</span>
                  ) : (
                    <span className="text-[13px]" style={{ color: MUTED }}>{healthStats.pct}%</span>
                  )}
                </>
              ) : (
                <span className="text-[13px]" style={{ color: MUTED }}>0%</span>
              )}
              <span className="text-[13px]" style={{ color: MUTED }}>
                {healthStats.trained ? "今日已训练" : "今日未训练"}
              </span>
            </div>
          </motion.div>
        </Link>
      </div>

      {/* ===== ③ 快捷入口 ===== */}
      <div className="flex flex-col gap-[8px]">
        {[
          { icon: LayoutDashboard, color: INFO, title: "效率中心", sub: "任务管理·番茄钟·习惯追踪", href: "/efficiency" },
          { icon: Wallet, color: SUCCESS, title: "记账中心", sub: "收支记录·预算管理·资产分析", href: "/accounting" },
          { icon: HeartPulse, color: BRAND, title: "健康中心", sub: "饮水·睡眠·力量训练", href: "/health/water" },
        ].map((item, i) => (
          <Link key={item.href} href={item.href}>
            <motion.div
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.1 + i * 0.05 }}
              whileTap={{ scale: 0.98 }}
              className="h-[60px] flex items-center rounded-[12px] px-[16px]"
              style={{ background: "#FFF", boxShadow: SHADOW_CARD }}
            >
              <item.icon className="w-6 h-6" style={{ color: item.color }} />
              <div className="ml-3 flex-1 min-w-0">
                <p className="text-[17px] font-semibold truncate" style={{ color: "#000" }}>{item.title}</p>
                <p className="text-[13px] truncate" style={{ color: MUTED }}>{item.sub}</p>
              </div>
              <ChevronRight className="w-5 h-5 ml-2" style={{ color: TERTIARY }} />
            </motion.div>
          </Link>
        ))}
      </div>

      {/* ===== ④ 本周趋势 ===== */}
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.15 }}
        className="rounded-[16px] p-[16px]"
        style={{ background: "#FFF", boxShadow: SHADOW_CARD }}
      >
        {/* 标题 */}
        <div className="flex items-center gap-2 mb-3">
          <TrendingUp className="w-5 h-5" style={{ color: BRAND }} />
          <span className="text-[20px] font-semibold" style={{ color: "#000" }}>本周趋势</span>
        </div>

        {/* 图表区 */}
        <div className="relative rounded-[8px]" style={{ background: BG, padding: "8px 4px 8px 32px" }}>
          {/* Y 轴标签 */}
          <div className="absolute left-1 top-2 flex flex-col justify-between" style={{ height: 140 }}>
            {["100%", "75%", "50%", "25%", "0%"].map((v) => (
              <span key={v} className="text-[11px] leading-none" style={{ color: MUTED }}>{v}</span>
            ))}
          </div>

          {/* SVG 趋势图 */}
          <svg viewBox="0 0 280 150" className="w-full" style={{ height: 150 }} preserveAspectRatio="none">
            {/* 网格线 */}
            {[10, 45, 80, 115].map((y) => (
              <line key={`grid-${y}`} x1={25} y1={y} x2={275} y2={y} stroke="#E5E5EA" strokeWidth={0.5} strokeDasharray="3,3" />
            ))}
            <line x1={25} y1={140} x2={275} y2={140} stroke="#E5E5EA" strokeWidth={0.5} />

            {/* 任务完成率 */}
            <polyline
              fill="none" stroke={INFO} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"
              points={LINE_X.map((x, i) => `${x},${yFromPct(trendLines.taskPcts[i] ?? 0)}`).join(" ")}
            />
            {LINE_X.map((x, i) => (
              <circle key={`task-${i}`} cx={x} cy={yFromPct(trendLines.taskPcts[i] ?? 0)} r={3.5} fill="#FFF" stroke={INFO} strokeWidth={2} />
            ))}

            {/* 饮水 */}
            <polyline
              fill="none" stroke={BRAND} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" strokeDasharray="6,3"
              points={LINE_X.map((x, i) => `${x},${yFromPct(trendLines.waterPcts[i] ?? 0)}`).join(" ")}
            />
            {LINE_X.map((x, i) => (
              <circle key={`water-${i}`} cx={x} cy={yFromPct(trendLines.waterPcts[i] ?? 0)} r={3.5} fill="#FFF" stroke={BRAND} strokeWidth={2} />
            ))}

            {/* 支出 */}
            <polyline
              fill="none" stroke={SUCCESS} strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" strokeDasharray="2,4"
              points={LINE_X.map((x, i) => `${x},${yFromPct(trendLines.expensePcts[i] ?? 0)}`).join(" ")}
            />
            {LINE_X.map((x, i) => (
              <circle key={`exp-${i}`} cx={x} cy={yFromPct(trendLines.expensePcts[i] ?? 0)} r={3.5} fill="#FFF" stroke={SUCCESS} strokeWidth={1.5} />
            ))}
          </svg>

          {/* X 轴标签 */}
          <div className="flex justify-between" style={{ paddingLeft: 30, paddingRight: 2 }}>
            {["一", "二", "三", "四", "五", "六", "日"].map((d) => (
              <span key={d} className="text-[11px] text-center w-[36px]" style={{ color: MUTED }}>{d}</span>
            ))}
          </div>
        </div>

        {/* 图例 */}
        <div className="flex flex-wrap items-center gap-4 mt-3">
          <div className="flex items-center gap-1.5">
            <div className="w-2 h-2 rounded-full" style={{ background: INFO }} />
            <span className="text-[12px]" style={{ color: MUTED }}>任务完成率</span>
          </div>
          <div className="flex items-center gap-1.5">
            <div className="w-2 h-2 rounded-full" style={{ background: BRAND }} />
            <span className="text-[12px]" style={{ color: MUTED }}>饮水</span>
          </div>
          <div className="flex items-center gap-1.5">
            <div className="w-2 h-2 rounded-full" style={{ background: SUCCESS }} />
            <span className="text-[12px]" style={{ color: MUTED }}>支出</span>
          </div>
        </div>
      </motion.div>

      {/* ===== ⑤ 今日待办 ===== */}
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.2 }}
        className="rounded-[12px] p-[16px]"
        style={{ background: "#FFF", boxShadow: SHADOW_CARD }}
      >
        <div className="flex items-center gap-2 mb-1">
          <ListTodo className="w-5 h-5" style={{ color: "#000" }} />
          <span className="text-[20px] font-semibold" style={{ color: "#000" }}>今日待办</span>
          <span className="ml-auto text-[13px]" style={{ color: MUTED }}>
            {incompleteCount}项待完成
          </span>
        </div>

        {sortedTasks.length === 0 ? (
          <div className="h-[48px] flex items-center justify-center">
            <span className="text-[15px]" style={{ color: MUTED }}>今日暂无待办</span>
          </div>
        ) : (
          <div className="mt-1">
            {sortedTasks.map((task, i) => (
              <button
                key={task.id}
                type="button"
                onClick={() => toggleTask(task)}
                className="h-[48px] flex items-center w-full"
                style={{
                  borderBottom: i < sortedTasks.length - 1 ? "1px solid #E5E5EA" : "none",
                }}
              >
                {task.isCompleted ? (
                  <CheckCircle2 className="w-5 h-5" style={{ color: SUCCESS }} />
                ) : (
                  <Circle className="w-5 h-5" style={{ color: MUTED }} />
                )}
                <span
                  className="ml-3 flex-1 min-w-0 truncate text-[17px] text-left"
                  style={{
                    color: task.isCompleted ? TERTIARY : "#000",
                    textDecoration: task.isCompleted ? "line-through" : "none",
                  }}
                >
                  {task.title}
                </span>
              </button>
            ))}
          </div>
        )}
      </motion.div>
    </div>
  );
}
