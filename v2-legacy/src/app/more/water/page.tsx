"use client";

import { useState, useMemo, useCallback } from "react";
import { useRouter } from "next/navigation";
import { useLiveQuery } from "dexie-react-hooks";
import { motion } from "framer-motion";
import {
  ChevronLeft,
  Droplets,
  Check,
  ChevronRight,
  Plus,
  Minus,
  GlassWater,
  Undo2,
  TrendingUp,
  Bell,
  Sunrise,
  Moon,
  Sun,
  MoonStar,
  Target,
} from "lucide-react";
import {
  healthDB,
  getWaterGoal,
  updateWaterGoal,
  addWaterLog,
  deleteWaterLog,
  getWaterPeriods,
  getWaterMlByPeriod,
  getWaterPeriodOfTime,
} from "@/lib/db/health.db";
import type { WaterGoal, WaterLog } from "@/lib/db/health.db";
import { showToast } from "@/components/ui/Toast";

/* ────────── Helpers ────────── */

function todayStr(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function dateAddDays(dateStr: string, days: number): string {
  const d = new Date(dateStr + "T00:00:00");
  d.setDate(d.getDate() + days);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function nowTimeStr(): string {
  const d = new Date();
  return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
}

const DAYS_HISTORY = 30;
const WEEK_LABELS = ["一", "二", "三", "四", "五", "六", "日"];
const HOUR_SLOTS = Array.from({ length: 15 }, (_, i) => 8 + i); // 8:00 - 22:00
const QUICK_AMOUNTS = [250, 500, 750];
const REMINDER_OPTIONS = [
  { minutes: 60, label: "1h" },
  { minutes: 120, label: "2h" },
  { minutes: 180, label: "3h" },
];

/* ────────── Component ────────── */

export default function WaterPage() {
  const router = useRouter();
  const today = todayStr();

  // ─── 配置（实时） ───
  const goal = useLiveQuery(() => getWaterGoal(), [], null as WaterGoal | null);

  /* ─── Live query: 今日实际饮水量（唯一流水源 waterLogs） ─── */
  const todayWaterLogs = useLiveQuery(
    () => healthDB.waterLogs.where("date").equals(today).toArray(),
    [today],
    [] as WaterLog[],
  );
  const todayWaterMl = useMemo(
    () => todayWaterLogs.reduce((s, l) => s + (l.amount || 0), 0),
    [todayWaterLogs],
  );

  /* ─── 三时段派生数据 ─── */
  const periods = useMemo(() => (goal ? getWaterPeriods(goal) : []), [goal]);

  const periodMl = useLiveQuery(
    () => (goal ? getWaterMlByPeriod(today, goal) : Promise.resolve({ morning: 0, afternoon: 0, evening: 0, night: 0 })),
    [today, goal],
    { morning: 0, afternoon: 0, evening: 0, night: 0 },
  );

  const currentPeriod = useMemo(() => (goal ? getWaterPeriodOfTime(nowTimeStr(), goal) : "night"), [goal]);

  /* ─── Live query: last 30 days waterLogs ─── */
  const historyStart = dateAddDays(today, -DAYS_HISTORY + 1);
  const historyWaterLogs = useLiveQuery(
    () => healthDB.waterLogs.where("date").between(historyStart, today, true, true).toArray(),
    [today, historyStart],
    [] as WaterLog[],
  );
  const historyByDay = useMemo(() => {
    const map = new Map<string, { amount: number; logs: { time: string; amount: number; id: string }[] }>();
    for (const l of historyWaterLogs) {
      const entry = map.get(l.date) ?? { amount: 0, logs: [] };
      const dt = new Date(l.timestamp);
      const time = `${String(dt.getHours()).padStart(2, "0")}:${String(dt.getMinutes()).padStart(2, "0")}`;
      entry.amount += l.amount || 0;
      entry.logs.push({ time, amount: l.amount || 0, id: l.id });
      map.set(l.date, entry);
    }
    return Array.from(map.entries())
      .sort(([a], [b]) => b.localeCompare(a))
      .map(([date, v]) => ({ date, ...v }));
  }, [historyWaterLogs]);

  const [expandedDate, setExpandedDate] = useState<string | null>(null);

  /* ─── 记录（唯一流水源 waterLogs 写入；本会话可撤销） ─── */
  const [adding, setAdding] = useState(false);
  const [undoStack, setUndoStack] = useState<string[]>([]);

  const recordWater = useCallback(
    async (amount: number, hour?: number) => {
      if (adding) return;
      setAdding(true);
      try {
        // hour 提供时按该时段时刻写入（与画布"点击时段 +250ml"一致）；
        // 否则按当前时刻写入。始终写入 waterLogs，保持唯一流水源口径。
        const timestamp = hour !== undefined ? new Date(`${today}T${String(hour).padStart(2, "0")}:00`).getTime() : Date.now();
        const id = await addWaterLog({ date: today, amount, timestamp });
        setUndoStack((s) => [...s, id]);
        showToast({ type: "success", message: `已记录 ${amount}ml` });
      } catch {
        showToast({ type: "error", message: "记录失败，请重试" });
      } finally {
        setAdding(false);
      }
    },
    [adding, today],
  );

  /* ─── 撤销上一次记录（仅本会话新增的流水，写入同样走 waterLogs） ─── */
  const handleUndo = useCallback(async () => {
    if (undoStack.length === 0) return;
    const id = undoStack[undoStack.length - 1];
    try {
      await deleteWaterLog(id);
      setUndoStack((s) => s.slice(0, -1));
      showToast({ type: "success", message: "已撤销上次记录" });
    } catch {
      showToast({ type: "error", message: "撤销失败" });
    }
  }, [undoStack]);

  /* ─── 喝一杯（沿用原「+一杯」逻辑，写入 waterLogs） ─── */
  const handleAddCup = useCallback(() => {
    return recordWater(goal?.cupSize || 200);
  }, [recordWater, goal]);

  /* ─── 保存基础设置 ─── */
  const handleSaveSettings = useCallback(
    async (updates: Partial<WaterGoal>) => {
      try {
        await updateWaterGoal(updates);
      } catch {
        // Silently fail
      }
    },
    [],
  );

  /* ─── 时段占比调整（晚上自动补齐，保证总和 100） ─── */
  const handlePercentAdjust = useCallback(
    async (field: "morningPercent" | "afternoonPercent", delta: number) => {
      if (!goal) return;
      const morning = (goal.morningPercent ?? 35) + (field === "morningPercent" ? delta : 0);
      const afternoon = (goal.afternoonPercent ?? 40) + (field === "afternoonPercent" ? delta : 0);
      const m = Math.min(90, Math.max(5, morning));
      const a = Math.min(90, Math.max(5, afternoon));
      if (m + a > 90) {
        showToast({ type: "warning", message: "上午与下午占比合计需 ≤90%" });
        return;
      }
      await handleSaveSettings({ morningPercent: m, afternoonPercent: a, eveningPercent: 100 - m - a });
    },
    [goal, handleSaveSettings],
  );

  /* ─── Derived stats ─── */
  const dailyTarget = goal?.dailyTarget || 2000;
  const percent = dailyTarget > 0 ? Math.min(100, Math.round((todayWaterMl / dailyTarget) * 100)) : 0;

  /* ─── 连续达标天数（自今日回溯，达标=当日≥每日目标） ─── */
  const streakDays = useMemo(() => {
    const map = new Map(historyByDay.map((d) => [d.date, d.amount]));
    let n = 0;
    for (let i = 0; i < DAYS_HISTORY; i++) {
      const d = dateAddDays(today, -i);
      if ((map.get(d) ?? 0) >= dailyTarget) n++;
      else break;
    }
    return n;
  }, [historyByDay, dailyTarget, today]);

  /* ─── 本周趋势（周一→周日，30 天窗口内必含本周） ─── */
  const weekTrend = useMemo(() => {
    const map = new Map(historyByDay.map((d) => [d.date, d.amount]));
    const dow = new Date().getDay();
    const monday = dateAddDays(today, -(dow === 0 ? 6 : dow - 1));
    const days: { label: string; amount: number; isToday: boolean; pct: number }[] = [];
    let sum = 0;
    let count = 0;
    for (let i = 0; i < 7; i++) {
      const d = dateAddDays(monday, i);
      const amount = map.get(d) ?? 0;
      days.push({
        label: WEEK_LABELS[i],
        amount,
        isToday: d === today,
        pct: dailyTarget > 0 ? Math.min(100, Math.round((amount / dailyTarget) * 100)) : 0,
      });
      if (d <= today) {
        sum += amount;
        count++;
      }
    }
    const weekAvg = count > 0 ? Math.round(sum / count) : 0;
    return { days, weekAvg };
  }, [historyByDay, dailyTarget, today]);

  /* ─── 每小时分布（按流水 timestamp 的时点归属） ─── */
  const perHourMl = useMemo(() => {
    const m = new Map<number, number>();
    for (const l of todayWaterLogs) {
      const h = new Date(l.timestamp).getHours();
      m.set(h, (m.get(h) ?? 0) + (l.amount || 0));
    }
    return m;
  }, [todayWaterLogs]);

  /* ─── 提醒（沿用 waterGoals.reminderInterval 字段，0=关闭） ─── */
  const reminderOn = (goal?.reminderInterval ?? 0) > 0;
  const toggleReminder = useCallback(() => {
    handleSaveSettings({ reminderInterval: reminderOn ? 0 : 120 });
  }, [reminderOn, handleSaveSettings]);

  /* ─── SVG Ring measurements ─── */
  const ringSize = 128;
  const ringStroke = 10;
  const ringRadius = (ringSize - ringStroke) / 2;
  const circumference = 2 * Math.PI * ringRadius;
  const dashOffset = circumference * (1 - percent / 100);

  /* ─── Format date for display ─── */
  const formatDate = (dateStr: string): string => {
    const d = new Date(dateStr + "T00:00:00");
    const weekDays = ["日", "一", "二", "三", "四", "五", "六"];
    if (dateStr === today) return "今天";
    const yesterday = dateAddDays(today, -1);
    if (dateStr === yesterday) return "昨天";
    return `${d.getMonth() + 1}/${d.getDate()} 周${weekDays[d.getDay()]}`;
  };

  /* ─── Loading state ─── */
  if (!goal) {
    return (
      <div className="min-h-screen" style={{ background: "var(--lifeflow-background)" }}>
        <header className="flex items-center h-11 px-4">
          <div
            className="inline-flex h-8 w-8 items-center justify-center rounded-lg"
            style={{
              background: "var(--color-surface-card)",
              border: "1px solid var(--lifeflow-border)",
            }}
          />
        </header>
        <div className="px-4 pt-4 flex flex-col gap-4">
          <div className="animate-pulse h-48 rounded-[20px]" style={{ background: "var(--lifeflow-muted)" }} />
          <div className="animate-pulse h-24 rounded-[20px]" style={{ background: "var(--lifeflow-muted)" }} />
          <div className="animate-pulse h-40 rounded-[20px]" style={{ background: "var(--lifeflow-muted)" }} />
        </div>
      </div>
    );
  }

  const periodLabels: Record<string, string> = { morning: "上午", afternoon: "下午", evening: "晚上", night: "夜间" };

  return (
    <div className="min-h-screen pb-12" style={{ background: "var(--lifeflow-background)" }}>
      {/* ─── Header ─── */}
      <header className="flex items-center h-11 px-4">
        <button
          type="button"
          onClick={() => router.push("/more")}
          className="inline-flex h-8 w-8 items-center justify-center rounded-lg shrink-0"
          style={{
            background: "var(--color-surface-card)",
            border: "1px solid var(--lifeflow-border)",
          }}
          aria-label="返回"
        >
          <ChevronLeft className="h-5 w-5" style={{ color: "var(--color-text-primary)" }} />
        </button>
        <h1
          className="flex-1 text-center text-[17px] font-semibold tracking-[-0.018em]"
          style={{ color: "var(--color-text-primary)" }}
        >
          饮水
        </h1>
        <div className="w-8" />
      </header>

      <div className="px-4 pt-2 flex flex-col gap-3">
        {/* ─── 今日进度卡：环形 + 目标进度 + 连续达标 ─── */}
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.35, ease: [0.32, 0.72, 0, 1] }}
          className="p-4"
          style={{
            background: "var(--color-surface-card)",
            borderRadius: "20px",
            boxShadow: "var(--shadow-card)",
          }}
        >
          <div className="flex items-center gap-4">
            <div className="relative flex items-center justify-center shrink-0" style={{ width: ringSize, height: ringSize }}>
              <svg width={ringSize} height={ringSize} viewBox={`0 0 ${ringSize} ${ringSize}`} style={{ transform: "rotate(-90deg)" }}>
                <circle cx={ringSize / 2} cy={ringSize / 2} r={ringRadius} fill="none" stroke="var(--lifeflow-knit-bg)" strokeWidth={ringStroke} />
                <circle
                  cx={ringSize / 2}
                  cy={ringSize / 2}
                  r={ringRadius}
                  fill="none"
                  stroke="var(--lifeflow-primary)"
                  strokeWidth={ringStroke}
                  strokeDasharray={circumference}
                  strokeDashoffset={dashOffset}
                  strokeLinecap="round"
                  style={{ transition: "stroke-dashoffset 0.6s cubic-bezier(0.32, 0.72, 0, 1)" }}
                />
              </svg>
              <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                <span className="text-[26px] font-bold leading-none tabular-nums" style={{ color: "var(--color-text-primary)" }}>
                  {todayWaterMl}
                </span>
                <span className="text-[11px] mt-1 leading-none" style={{ color: "var(--color-text-secondary)" }}>
                  / {dailyTarget}ml
                </span>
              </div>
            </div>

            <div className="flex-1 min-w-0 flex flex-col gap-2.5">
              <p className="text-[12px] font-semibold" style={{ color: "var(--color-text-secondary)" }}>
                今日目标 · <span className="tabular-nums" style={{ color: "var(--lifeflow-primary)" }}>{dailyTarget}ml</span>
              </p>
              <div>
                <div className="flex items-baseline justify-between">
                  <span className="text-[12px] font-semibold" style={{ color: "var(--color-text-primary)" }}>达标</span>
                  <span className="text-[15px] font-bold tabular-nums" style={{ color: "var(--lifeflow-primary)" }}>{percent}%</span>
                </div>
                <div className="mt-1 h-[6px] rounded-full overflow-hidden" style={{ background: "var(--lifeflow-knit-bg)" }}>
                  <div
                    className="h-full rounded-full"
                    style={{ width: `${percent}%`, background: "var(--lifeflow-primary)", transition: "width 0.5s cubic-bezier(0.22, 0.61, 0.36, 1)" }}
                  />
                </div>
              </div>
              {streakDays > 0 && (
                <span
                  className="inline-flex self-start items-center gap-1 px-2.5 py-1 rounded-full text-[12px] font-semibold"
                  style={{ background: "rgba(52,199,89,0.14)", color: "var(--state-success)" }}
                >
                  <Check className="w-3.5 h-3.5" strokeWidth={3} />
                  连续达标 {streakDays} 天
                </span>
              )}
            </div>
          </div>

          {/* 喝一杯（沿用原「+一杯」快捷记录） */}
          <motion.button
            type="button"
            whileTap={{ scale: 0.96 }}
            onClick={handleAddCup}
            disabled={adding}
            className="mt-4 w-full h-11 rounded-xl text-[15px] font-semibold text-white disabled:opacity-50 flex items-center justify-center gap-2"
            style={{ background: "var(--lifeflow-primary)" }}
          >
            <Plus className="w-4 h-4" />
            {adding ? "记录中..." : `喝了一杯（${goal.cupSize || 200}ml）`}
          </motion.button>
        </motion.div>

        {/* ─── 快捷记录行：250 / 500 / 750 + 撤销 ─── */}
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.05, duration: 0.35, ease: [0.32, 0.72, 0, 1] }}
          className="p-4"
          style={{
            background: "var(--color-surface-card)",
            borderRadius: "20px",
            boxShadow: "var(--shadow-card)",
          }}
        >
          <div className="flex items-stretch gap-2">
            <div className="flex-1 grid grid-cols-3 gap-2">
              {QUICK_AMOUNTS.map((v) => (
                <motion.button
                  key={v}
                  type="button"
                  whileTap={{ scale: 0.94 }}
                  onClick={() => recordWater(v)}
                  disabled={adding}
                  className="flex flex-col items-center justify-center gap-1 py-3 rounded-xl disabled:opacity-50"
                  style={{ background: "var(--lifeflow-brand-50)", color: "var(--lifeflow-primary)" }}
                  aria-label={`记录饮水 ${v}ml`}
                >
                  <GlassWater className="w-5 h-5" />
                  <span className="text-[16px] font-bold leading-none tabular-nums">{v}</span>
                  <span className="text-[10px] leading-none opacity-75">ml</span>
                </motion.button>
              ))}
            </div>
            <button
              type="button"
              onClick={handleUndo}
              disabled={undoStack.length === 0}
              className="flex-none self-center flex flex-col items-center justify-center gap-1 h-[60px] px-3.5 rounded-xl text-[11px] font-semibold disabled:opacity-40"
              style={{ background: "var(--lifeflow-muted)", color: "var(--color-text-secondary)" }}
              aria-label="撤销上一次记录"
            >
              <Undo2 className="w-4 h-4" />
              撤销
            </button>
          </div>
        </motion.div>

        {/* ─── 每小时记录条 ─── */}
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.08, duration: 0.35, ease: [0.32, 0.72, 0, 1] }}
          className="p-4"
          style={{
            background: "var(--color-surface-card)",
            borderRadius: "20px",
            boxShadow: "var(--shadow-card)",
          }}
        >
          <div className="flex items-center justify-between">
            <h2 className="text-[15px] font-bold" style={{ color: "var(--color-text-primary)" }}>每小时记录</h2>
            <span className="text-[11px]" style={{ color: "var(--color-text-disabled)" }}>点击时段 +250ml</span>
          </div>
          <div className="mt-3 grid grid-cols-5 gap-1">
            {HOUR_SLOTS.map((h) => {
              const ml = perHourMl.get(h) ?? 0;
              const done = ml >= 250;
              const partial = ml > 0 && ml < 250;
              return (
                <motion.button
                  key={h}
                  type="button"
                  whileTap={{ scale: 0.94 }}
                  onClick={() => recordWater(250, h)}
                  disabled={adding}
                  className="flex flex-col items-center justify-center gap-1.5 py-2.5 rounded-xl disabled:opacity-50"
                  style={{ background: done ? "var(--lifeflow-brand-50)" : "transparent" }}
                  aria-label={`${h}:00${done ? " 已饮" : " 未饮"} · 点击 +250ml`}
                >
                  <span
                    className="text-[10px] leading-none tabular-nums"
                    style={{ color: done || partial ? "var(--lifeflow-primary)" : "var(--color-text-disabled)" }}
                  >
                    {h}:00
                  </span>
                  <span
                    className="w-3 h-3 rounded-full border-[1.5px] transition-colors"
                    style={
                      done
                        ? { background: "var(--lifeflow-primary)", borderColor: "var(--lifeflow-primary)" }
                        : partial
                          ? { background: "var(--lifeflow-brand-50)", borderColor: "var(--lifeflow-primary)" }
                          : { borderColor: "var(--lifeflow-border)" }
                    }
                  />
                </motion.button>
              );
            })}
          </div>
        </motion.div>

        {/* ─── 本周趋势 ─── */}
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.11, duration: 0.35, ease: [0.32, 0.72, 0, 1] }}
          className="p-4"
          style={{
            background: "var(--color-surface-card)",
            borderRadius: "20px",
            boxShadow: "var(--shadow-card)",
          }}
        >
          <div className="flex items-center justify-between">
            <h2 className="text-[15px] font-bold" style={{ color: "var(--color-text-primary)" }}>本周趋势</h2>
            <span className="flex items-center gap-1 text-[11px]" style={{ color: "var(--color-text-disabled)" }}>
              <TrendingUp className="w-3.5 h-3.5" />
              日均 {weekTrend.weekAvg}ml
            </span>
          </div>
          <div className="mt-4">
            <div className="relative" style={{ height: 84 }}>
              <div className="absolute left-0 right-0 flex justify-end pointer-events-none" style={{ top: -12 }}>
                <span className="text-[10px] leading-none px-1" style={{ color: "var(--color-text-disabled)" }}>{dailyTarget}ml</span>
              </div>
              <div className="absolute left-0 right-0 border-t border-dashed pointer-events-none" style={{ borderColor: "var(--lifeflow-border)" }} />
              <div className="absolute inset-0 flex items-end gap-1.5">
                {weekTrend.days.map((d, i) => (
                  <div key={i} className="flex-1 min-w-0 h-full flex items-end justify-center">
                    <motion.div
                      className="w-full rounded-[6px]"
                      style={{ maxWidth: 26, background: d.isToday ? "var(--lifeflow-primary)" : "var(--lifeflow-brand-50)" }}
                      initial={{ height: 0 }}
                      animate={{ height: `${Math.max(4, Math.round((d.pct * 84) / 100))}px` }}
                      transition={{ duration: 0.6, ease: [0.22, 0.61, 0.36, 1] }}
                    />
                  </div>
                ))}
              </div>
            </div>
            <div className="mt-2 flex gap-1.5">
              {weekTrend.days.map((d, i) => (
                <div key={i} className="flex-1 min-w-0 flex flex-col items-center gap-1">
                  <span className="text-[10px] leading-none tabular-nums" style={{ color: "var(--color-text-disabled)" }}>
                    {d.amount > 0 ? d.amount : ""}
                  </span>
                  <span
                    className="text-[11px] leading-none"
                    style={{ color: d.isToday ? "var(--lifeflow-primary)" : "var(--color-text-secondary)", fontWeight: d.isToday ? 700 : 400 }}
                  >
                    {d.label}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </motion.div>

        {/* ─── 饮水提醒行 ─── */}
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.14, duration: 0.35, ease: [0.32, 0.72, 0, 1] }}
          className="p-4"
          style={{
            background: "var(--color-surface-card)",
            borderRadius: "20px",
            boxShadow: "var(--shadow-card)",
          }}
        >
          <div className="flex items-center gap-3">
            <span
              className="w-9 h-9 flex-none rounded-full flex items-center justify-center"
              style={{ background: "var(--lifeflow-brand-50)", color: "var(--lifeflow-primary)" }}
            >
              <Bell className="w-[18px] h-[18px]" />
            </span>
            <div className="flex-1 min-w-0">
              <p className="text-[15px] font-bold" style={{ color: "var(--color-text-primary)" }}>定时提醒</p>
              <p className="text-[11px] mt-0.5" style={{ color: "var(--color-text-disabled)" }}>间隔提醒，保持饮水节奏</p>
            </div>
            <button
              type="button"
              onClick={toggleReminder}
              role="switch"
              aria-checked={reminderOn}
              aria-label="定时提醒开关"
              className="relative w-[46px] h-[28px] flex-none rounded-full transition-colors"
              style={{ background: reminderOn ? "var(--lifeflow-primary)" : "var(--lifeflow-border)" }}
            >
              <motion.div
                className="absolute top-[2px] w-6 h-6 rounded-full bg-white shadow-sm"
                animate={{ left: reminderOn ? 20 : 2 }}
                transition={{ type: "spring", stiffness: 500, damping: 30 }}
              />
            </button>
          </div>
          {reminderOn && (
            <div className="mt-3 flex gap-2">
              {REMINDER_OPTIONS.map((opt) => (
                <button
                  key={opt.minutes}
                  type="button"
                  onClick={() => handleSaveSettings({ reminderInterval: opt.minutes })}
                  className="flex-1 h-9 rounded-lg text-[12px] font-semibold transition-colors"
                  style={
                    (goal.reminderInterval ?? 0) === opt.minutes
                      ? { background: "var(--lifeflow-primary)", color: "#fff" }
                      : { background: "var(--lifeflow-muted)", color: "var(--color-text-secondary)" }
                  }
                >
                  {opt.label}
                </button>
              ))}
            </div>
          )}
        </motion.div>

        {/* ─── 今日时段目标卡 ─── */}
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.17, duration: 0.35, ease: [0.32, 0.72, 0, 1] }}
          className="p-4"
          style={{
            background: "var(--color-surface-card)",
            borderRadius: "20px",
            boxShadow: "var(--shadow-card)",
          }}
        >
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-[15px] font-bold" style={{ color: "var(--color-text-primary)" }}>
              今日时段目标
            </h2>
            {currentPeriod !== "night" && (
              <span className="text-[11px] px-2 py-0.5 rounded-full font-medium" style={{ background: "var(--lifeflow-brand-50)", color: "var(--lifeflow-primary)" }}>
                当前时段 · {periodLabels[currentPeriod]}
              </span>
            )}
          </div>

          {periods.length === 0 ? (
            <p className="text-[12px] py-3" style={{ color: "var(--color-text-disabled)" }}>
              无有效时段，请检查起床/入睡时间设置
            </p>
          ) : (
            <div className="flex flex-col gap-3">
              {periods.map((p) => {
                const drunk = periodMl[p.key];
                const pct = p.target > 0 ? Math.min(100, Math.round((drunk / p.target) * 100)) : 0;
                const isCurrent = currentPeriod === p.key;
                const done = drunk >= p.target;
                return (
                  <div
                    key={p.key}
                    className="rounded-xl p-3"
                    style={{
                      background: isCurrent ? "var(--lifeflow-brand-50)" : "var(--lifeflow-muted)",
                    }}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className="text-[14px] font-semibold" style={{ color: "var(--color-text-primary)" }}>
                          {p.label}
                        </span>
                        {done && <Check className="w-3.5 h-3.5" style={{ color: "#34C759" }} strokeWidth={3} />}
                      </div>
                      <span className="text-[12px] tabular-nums" style={{ color: "var(--color-text-secondary)" }}>
                        {drunk}/{p.target} ml
                      </span>
                    </div>
                    <div className="mt-2 h-[6px] rounded-full overflow-hidden" style={{ background: "var(--lifeflow-knit-bg)" }}>
                      <motion.div
                        className="h-full rounded-full"
                        initial={{ width: 0 }}
                        animate={{ width: `${pct}%` }}
                        transition={{ duration: 0.5, ease: "easeOut" }}
                        style={{ background: done ? "#34C759" : "var(--lifeflow-primary)" }}
                      />
                    </div>
                    <p className="mt-1.5 text-[11px]" style={{ color: "var(--color-text-disabled)" }}>
                      {p.start} - {p.end} · 目标 {pct === 100 ? "达成" : `${100 - pct}% 待完成`}
                    </p>
                  </div>
                );
              })}
              {periodMl.night > 0 && (
                <p className="text-[11px]" style={{ color: "var(--color-text-disabled)" }}>
                  睡前 2 小时内已饮 {periodMl.night}ml（不纳入目标）
                </p>
              )}
            </div>
          )}
        </motion.div>

        {/* ─── Settings Card ─── */}
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2, duration: 0.35, ease: [0.32, 0.72, 0, 1] }}
          className="p-4"
          style={{
            background: "var(--color-surface-card)",
            borderRadius: "20px",
            boxShadow: "var(--shadow-card)",
          }}
        >
          <h2 className="text-[15px] font-bold mb-3" style={{ color: "var(--color-text-primary)" }}>
            饮水设置
          </h2>

          {/* 起床时间 */}
          <div className="flex items-center justify-between rounded-xl px-3 py-2" style={{ background: "var(--lifeflow-muted)" }}>
            <div className="flex items-center gap-2.5 min-w-0">
              <span className="w-8 h-8 flex-none rounded-full flex items-center justify-center" style={{ background: "var(--lifeflow-brand-50)", color: "var(--lifeflow-primary)" }}>
                <Sunrise className="w-4 h-4" />
              </span>
              <span className="text-[13px] font-medium truncate" style={{ color: "var(--color-text-primary)" }}>起床时间</span>
            </div>
            <input
              type="time"
              value={goal.wakeStart || "08:00"}
              onChange={(e) => handleSaveSettings({ wakeStart: e.target.value })}
              className="h-8 px-2.5 rounded-lg text-[13px] font-medium outline-none tabular-nums"
              style={{ background: "var(--color-surface-card)", color: "var(--color-text-primary)", border: "1px solid var(--lifeflow-border)" }}
            />
          </div>

          {/* 入睡时间 */}
          <div className="flex items-center justify-between rounded-xl px-3 py-2 mt-2" style={{ background: "var(--lifeflow-muted)" }}>
            <div className="flex items-center gap-2.5 min-w-0">
              <span className="w-8 h-8 flex-none rounded-full flex items-center justify-center" style={{ background: "var(--lifeflow-brand-50)", color: "var(--lifeflow-primary)" }}>
                <Moon className="w-4 h-4" />
              </span>
              <span className="text-[13px] font-medium truncate" style={{ color: "var(--color-text-primary)" }}>入睡时间</span>
            </div>
            <input
              type="time"
              value={goal.wakeEnd || "22:00"}
              onChange={(e) => handleSaveSettings({ wakeEnd: e.target.value })}
              className="h-8 px-2.5 rounded-lg text-[13px] font-medium outline-none tabular-nums"
              style={{ background: "var(--color-surface-card)", color: "var(--color-text-primary)", border: "1px solid var(--lifeflow-border)" }}
            />
          </div>

          {/* 杯量 */}
          <div className="flex items-center justify-between rounded-xl px-3 py-2 mt-2" style={{ background: "var(--lifeflow-muted)" }}>
            <div className="flex items-center gap-2.5 min-w-0">
              <span className="w-8 h-8 flex-none rounded-full flex items-center justify-center" style={{ background: "var(--lifeflow-brand-50)", color: "var(--lifeflow-primary)" }}>
                <Droplets className="w-4 h-4" />
              </span>
              <span className="text-[13px] font-medium truncate" style={{ color: "var(--color-text-primary)" }}>杯量（+一杯）</span>
            </div>
            <div className="flex items-center gap-3">
              <motion.button
                type="button" whileTap={{ scale: 0.9 }}
                onClick={() => handleSaveSettings({ cupSize: Math.max(50, (goal.cupSize || 200) - 50) })}
                className="w-7 h-7 rounded-full border-[1.5px] flex items-center justify-center"
                style={{ borderColor: "var(--lifeflow-primary)", background: "var(--color-surface-card)" }}
                aria-label="减少杯量"
              >
                <Minus className="w-3.5 h-3.5" style={{ color: "var(--lifeflow-primary)" }} />
              </motion.button>
              <span className="text-[16px] font-bold min-w-[56px] text-center tabular-nums" style={{ color: "var(--color-text-primary)" }}>
                {goal.cupSize || 200}ml
              </span>
              <motion.button
                type="button" whileTap={{ scale: 0.9 }}
                onClick={() => handleSaveSettings({ cupSize: Math.min(500, (goal.cupSize || 200) + 50) })}
                className="w-7 h-7 rounded-full border-[1.5px] flex items-center justify-center"
                style={{ borderColor: "var(--lifeflow-primary)", background: "var(--color-surface-card)" }}
                aria-label="增加杯量"
              >
                <Plus className="w-3.5 h-3.5" style={{ color: "var(--lifeflow-primary)" }} />
              </motion.button>
            </div>
          </div>

          {/* 每日目标 */}
          <div className="flex items-center justify-between rounded-xl px-3 py-2 mt-2" style={{ background: "var(--lifeflow-muted)" }}>
            <div className="flex items-center gap-2.5 min-w-0">
              <span className="w-8 h-8 flex-none rounded-full flex items-center justify-center" style={{ background: "var(--lifeflow-brand-50)", color: "var(--lifeflow-primary)" }}>
                <Target className="w-4 h-4" />
              </span>
              <span className="text-[13px] font-medium truncate" style={{ color: "var(--color-text-primary)" }}>每日目标</span>
            </div>
            <div className="flex items-center gap-3">
              <motion.button
                type="button" whileTap={{ scale: 0.9 }}
                onClick={() => handleSaveSettings({ dailyTarget: Math.max(100, dailyTarget - 100) })}
                className="w-7 h-7 rounded-full border-[1.5px] flex items-center justify-center"
                style={{ borderColor: "var(--lifeflow-primary)", background: "var(--color-surface-card)" }}
                aria-label="减少每日目标"
              >
                <Minus className="w-3.5 h-3.5" style={{ color: "var(--lifeflow-primary)" }} />
              </motion.button>
              <span className="text-[16px] font-bold min-w-[60px] text-center tabular-nums" style={{ color: "var(--color-text-primary)" }}>
                {dailyTarget}ml
              </span>
              <motion.button
                type="button" whileTap={{ scale: 0.9 }}
                onClick={() => handleSaveSettings({ dailyTarget: dailyTarget + 100 })}
                className="w-7 h-7 rounded-full border-[1.5px] flex items-center justify-center"
                style={{ borderColor: "var(--lifeflow-primary)", background: "var(--color-surface-card)" }}
                aria-label="增加每日目标"
              >
                <Plus className="w-3.5 h-3.5" style={{ color: "var(--lifeflow-primary)" }} />
              </motion.button>
            </div>
          </div>

          <div className="my-3" style={{ height: "0.5px", background: "var(--lifeflow-border)" }} />

          {/* ── 时段占比（晚上自动补齐） ── */}
          <p className="text-[13px] font-medium mb-2" style={{ color: "var(--color-text-primary)" }}>
            时段目标占比
          </p>
          <div className="flex items-center justify-between rounded-xl px-3 py-2" style={{ background: "var(--lifeflow-muted)" }}>
            <div className="flex items-center gap-2.5 min-w-0">
              <span className="w-8 h-8 flex-none rounded-full flex items-center justify-center" style={{ background: "var(--lifeflow-brand-50)", color: "var(--lifeflow-primary)" }}>
                <Sunrise className="w-4 h-4" />
              </span>
              <span className="text-[13px] font-medium truncate" style={{ color: "var(--color-text-primary)" }}>上午</span>
            </div>
            <div className="flex items-center gap-3">
              <motion.button
                type="button" whileTap={{ scale: 0.9 }}
                onClick={() => handlePercentAdjust("morningPercent", -5)}
                className="w-7 h-7 rounded-full border-[1.5px] flex items-center justify-center"
                style={{ borderColor: "var(--lifeflow-primary)", background: "var(--color-surface-card)" }}
                aria-label="减少上午占比"
              >
                <Minus className="w-3.5 h-3.5" style={{ color: "var(--lifeflow-primary)" }} />
              </motion.button>
              <span className="text-[16px] font-bold min-w-[40px] text-center tabular-nums" style={{ color: "var(--color-text-primary)" }}>
                {goal.morningPercent ?? 35}%
              </span>
              <motion.button
                type="button" whileTap={{ scale: 0.9 }}
                onClick={() => handlePercentAdjust("morningPercent", 5)}
                className="w-7 h-7 rounded-full border-[1.5px] flex items-center justify-center"
                style={{ borderColor: "var(--lifeflow-primary)", background: "var(--color-surface-card)" }}
                aria-label="增加上午占比"
              >
                <Plus className="w-3.5 h-3.5" style={{ color: "var(--lifeflow-primary)" }} />
              </motion.button>
            </div>
          </div>
          <div className="flex items-center justify-between rounded-xl px-3 py-2 mt-2" style={{ background: "var(--lifeflow-muted)" }}>
            <div className="flex items-center gap-2.5 min-w-0">
              <span className="w-8 h-8 flex-none rounded-full flex items-center justify-center" style={{ background: "var(--lifeflow-brand-50)", color: "var(--lifeflow-primary)" }}>
                <Sun className="w-4 h-4" />
              </span>
              <span className="text-[13px] font-medium truncate" style={{ color: "var(--color-text-primary)" }}>下午</span>
            </div>
            <div className="flex items-center gap-3">
              <motion.button
                type="button" whileTap={{ scale: 0.9 }}
                onClick={() => handlePercentAdjust("afternoonPercent", -5)}
                className="w-7 h-7 rounded-full border-[1.5px] flex items-center justify-center"
                style={{ borderColor: "var(--lifeflow-primary)", background: "var(--color-surface-card)" }}
                aria-label="减少下午占比"
              >
                <Minus className="w-3.5 h-3.5" style={{ color: "var(--lifeflow-primary)" }} />
              </motion.button>
              <span className="text-[16px] font-bold min-w-[40px] text-center tabular-nums" style={{ color: "var(--color-text-primary)" }}>
                {goal.afternoonPercent ?? 40}%
              </span>
              <motion.button
                type="button" whileTap={{ scale: 0.9 }}
                onClick={() => handlePercentAdjust("afternoonPercent", 5)}
                className="w-7 h-7 rounded-full border-[1.5px] flex items-center justify-center"
                style={{ borderColor: "var(--lifeflow-primary)", background: "var(--color-surface-card)" }}
                aria-label="增加下午占比"
              >
                <Plus className="w-3.5 h-3.5" style={{ color: "var(--lifeflow-primary)" }} />
              </motion.button>
            </div>
          </div>
          <div className="flex items-center justify-between rounded-xl px-3 py-2 mt-2" style={{ background: "var(--lifeflow-muted)" }}>
            <div className="flex items-center gap-2.5 min-w-0">
              <span className="w-8 h-8 flex-none rounded-full flex items-center justify-center" style={{ background: "var(--lifeflow-brand-50)", color: "var(--lifeflow-primary)" }}>
                <MoonStar className="w-4 h-4" />
              </span>
              <span className="text-[13px] font-medium truncate" style={{ color: "var(--color-text-primary)" }}>晚上（睡前2h前）</span>
            </div>
            <span className="text-[16px] font-bold min-w-[40px] text-right tabular-nums" style={{ color: "var(--color-text-secondary)" }}>
              {100 - (goal.morningPercent ?? 35) - (goal.afternoonPercent ?? 40)}%
            </span>
          </div>
          <p className="text-[11px] mt-2" style={{ color: "var(--color-text-disabled)" }}>
            晚上占比自动补齐（总和 100%）；睡前 2 小时内不计入目标
          </p>
        </motion.div>

        {/* ─── 饮水历史记录 ─── */}
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.23, duration: 0.35, ease: [0.32, 0.72, 0, 1] }}
          className="p-4"
          style={{
            background: "var(--color-surface-card)",
            borderRadius: "20px",
            boxShadow: "var(--shadow-card)",
          }}
        >
          <h2 className="text-[15px] font-bold mb-3" style={{ color: "var(--color-text-primary)" }}>
            饮水历史（近 {DAYS_HISTORY} 天）
          </h2>

          {historyByDay.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-8">
              <Droplets className="h-10 w-10" style={{ color: "var(--color-text-disabled)" }} />
              <p className="text-[13px] font-medium mt-3" style={{ color: "var(--color-text-secondary)" }}>
                还没有饮水记录
              </p>
              <p className="text-[12px] mt-1" style={{ color: "var(--color-text-disabled)" }}>
                点击上方「喝了一杯」开始记录
              </p>
            </div>
          ) : (
            <div className="flex flex-col max-h-[600px] overflow-y-auto">
              {historyByDay.map((day) => {
                const isExpanded = expandedDate === day.date;
                const dayPct = Math.min(100, Math.round((day.amount / dailyTarget) * 100));
                return (
                  <div key={day.date}>
                    {/* 汇总行 */}
                    <div
                      className="flex items-center gap-3 px-3 py-2.5 rounded-xl cursor-pointer active:opacity-70"
                      style={{ background: day.date === today ? "var(--lifeflow-brand-50)" : "transparent" }}
                      onClick={() => setExpandedDate(isExpanded ? null : day.date)}
                    >
                      <span className="text-[13px] font-medium min-w-[72px]" style={{ color: "var(--color-text-primary)" }}>
                        {formatDate(day.date)}
                      </span>
                      <div className="flex-1 h-2 rounded-full overflow-hidden" style={{ background: "var(--lifeflow-knit-bg)" }}>
                        <div
                          className="h-full rounded-full transition-all"
                          style={{
                            width: `${Math.min(100, dayPct)}%`,
                            background: "var(--lifeflow-primary)",
                            opacity: day.amount === 0 ? 0.3 : 0.7,
                          }}
                        />
                      </div>
                      <span className="text-[12px] font-medium min-w-[70px] text-right tabular-nums" style={{ color: "var(--color-text-secondary)" }}>
                        {day.amount}ml
                      </span>
                      <motion.div
                        animate={{ rotate: isExpanded ? 90 : 0 }}
                        transition={{ duration: 0.2 }}
                      >
                        <ChevronRight className="w-3.5 h-3.5" style={{ color: "var(--color-text-disabled)" }} />
                      </motion.div>
                    </div>

                    {/* 展开详情 */}
                    {isExpanded && (
                      <motion.div
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: "auto", opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        transition={{ duration: 0.2, ease: "easeInOut" }}
                      >
                        <div className="flex flex-col gap-1 pb-2 pl-3">
                          {day.logs.length === 0 ? (
                            <p className="text-[12px] py-2" style={{ color: "var(--color-text-disabled)" }}>
                              该日暂无记录
                            </p>
                          ) : (
                            day.logs.map((log, idx) => (
                              <div
                                key={`${log.id}-${idx}`}
                                className="flex items-center gap-2.5 py-2 px-3 rounded-xl"
                                style={{ background: "var(--lifeflow-muted)" }}
                              >
                                <Droplets className="w-3.5 h-3.5 shrink-0" style={{ color: "var(--lifeflow-primary)" }} />
                                <span className="text-[13px] flex-1" style={{ color: "var(--color-text-primary)" }}>
                                  {log.time}
                                </span>
                                <span className="text-[12px] tabular-nums" style={{ color: "var(--color-text-secondary)" }}>
                                  +{log.amount}ml
                                </span>
                              </div>
                            ))
                          )}
                        </div>
                      </motion.div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </motion.div>
      </div>
    </div>
  );
}
