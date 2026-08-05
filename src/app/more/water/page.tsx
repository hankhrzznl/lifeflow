"use client";

import { useState, useMemo, useCallback } from "react";
import { useRouter } from "next/navigation";
import { useLiveQuery } from "dexie-react-hooks";
import { motion } from "framer-motion";
import { ChevronLeft, Droplets, Check, ChevronRight, Plus } from "lucide-react";
import {
  healthDB,
  getWaterGoal,
  updateWaterGoal,
  addWaterCup,
  getWaterPeriods,
  getWaterMlByPeriod,
  getWaterPeriodOfTime,
} from "@/lib/db/health.db";
import type { WaterGoal } from "@/lib/db/health.db";
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
    [],
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
    [],
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

  /* ─── 记录一杯水 ─── */
  const [adding, setAdding] = useState(false);
  const handleAddCup = useCallback(async () => {
    if (adding) return;
    setAdding(true);
    try {
      const cup = goal?.cupSize || 200;
      await addWaterCup(today);
      showToast({ type: "success", message: `已记录 ${cup}ml` });
    } catch {
      showToast({ type: "error", message: "记录失败，请重试" });
    } finally {
      setAdding(false);
    }
  }, [adding, goal, today]);

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

  /* ─── SVG Ring measurements ─── */
  const ringSize = 196;
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
          <div className="animate-pulse h-32 rounded-[20px]" style={{ background: "var(--lifeflow-muted)" }} />
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
          onClick={() => router.push("/more/projects")}
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

      {/* ─── Progress Ring Card ─── */}
      <div className="px-4 pt-4">
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.35, ease: [0.32, 0.72, 0, 1] }}
          className="flex flex-col items-center p-6"
          style={{
            background: "var(--color-surface-card)",
            borderRadius: "20px",
            boxShadow: "var(--shadow-card)",
          }}
        >
          <div className="relative flex items-center justify-center" style={{ width: 196, height: 196 }}>
            <svg
              width="196"
              height="196"
              viewBox="0 0 196 196"
              style={{ transform: "rotate(-90deg)" }}
            >
              <circle
                cx="98" cy="98" r="86"
                fill="none" stroke="var(--lifeflow-muted)" strokeWidth="10"
              />
              <circle
                cx="98" cy="98" r="86"
                fill="none" stroke="var(--lifeflow-primary)" strokeWidth="10"
                strokeDasharray={circumference}
                strokeDashoffset={dashOffset}
                strokeLinecap="round"
                style={{ transition: "stroke-dashoffset 0.6s cubic-bezier(0.32, 0.72, 0, 1)" }}
              />
            </svg>
            <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
              <Droplets className="h-9 w-9" style={{ color: "var(--lifeflow-primary)" }} />
              <span className="text-[13px] font-medium" style={{ color: "var(--color-text-secondary)" }}>
                {todayWaterMl} / {dailyTarget} ml
              </span>
            </div>
          </div>

          {/* ── 快速录入 ── */}
          <motion.button
            type="button"
            whileTap={{ scale: 0.96 }}
            onClick={handleAddCup}
            disabled={adding}
            className="mt-5 w-full h-11 rounded-xl text-[15px] font-semibold text-white disabled:opacity-50 flex items-center justify-center gap-2"
            style={{ background: "var(--lifeflow-primary)" }}
          >
            <Plus className="w-4 h-4" />
            {adding ? "记录中..." : `喝了一杯（${goal.cupSize || 200}ml）`}
          </motion.button>
        </motion.div>
      </div>

      {/* ─── 三时段进度卡（T15） ─── */}
      <div className="px-4 pt-4">
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
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-[17px] font-semibold" style={{ color: "var(--color-text-primary)" }}>
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
                      <span className="text-[12px]" style={{ color: "var(--color-text-secondary)" }}>
                        {drunk}/{p.target} ml
                      </span>
                    </div>
                    <div className="mt-2 h-[6px] rounded-full overflow-hidden" style={{ background: "var(--lifeflow-background)" }}>
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
      </div>

      {/* ─── Settings Card ─── */}
      <div className="px-4 pt-4">
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1, duration: 0.35, ease: [0.32, 0.72, 0, 1] }}
          className="p-4"
          style={{
            background: "var(--color-surface-card)",
            borderRadius: "20px",
            boxShadow: "var(--shadow-card)",
          }}
        >
          <h2 className="text-[17px] font-semibold mb-3" style={{ color: "var(--color-text-primary)" }}>
            饮水设置
          </h2>

          <div className="flex items-center justify-between h-10">
            <span className="text-[15px]" style={{ color: "var(--color-text-primary)" }}>起床时间</span>
            <input
              type="time"
              value={goal.wakeStart || "08:00"}
              onChange={(e) => handleSaveSettings({ wakeStart: e.target.value })}
              className="h-8 px-3 rounded-lg text-[14px] font-medium outline-none"
              style={{ background: "var(--lifeflow-muted)", color: "var(--color-text-primary)", border: "1px solid var(--lifeflow-border)" }}
            />
          </div>

          <div className="flex items-center justify-between h-10 mt-1">
            <span className="text-[15px]" style={{ color: "var(--color-text-primary)" }}>入睡时间</span>
            <input
              type="time"
              value={goal.wakeEnd || "22:00"}
              onChange={(e) => handleSaveSettings({ wakeEnd: e.target.value })}
              className="h-8 px-3 rounded-lg text-[14px] font-medium outline-none"
              style={{ background: "var(--lifeflow-muted)", color: "var(--color-text-primary)", border: "1px solid var(--lifeflow-border)" }}
            />
          </div>

          <div className="flex items-center justify-between h-10 mt-1">
            <span className="text-[15px]" style={{ color: "var(--color-text-primary)" }}>杯量（+一杯）</span>
            <div className="flex items-center gap-3">
              <motion.button
                type="button" whileTap={{ scale: 0.9 }}
                onClick={() => handleSaveSettings({ cupSize: Math.max(50, (goal.cupSize || 200) - 50) })}
                className="w-7 h-7 rounded-full border-[1.5px] flex items-center justify-center"
                style={{ borderColor: "var(--lifeflow-primary)", background: "var(--color-surface-card)" }}
              >
                <MinusIcon className="w-3.5 h-3.5" style={{ color: "var(--lifeflow-primary)" }} />
              </motion.button>
              <span className="text-[16px] font-bold min-w-[56px] text-center" style={{ color: "var(--color-text-primary)" }}>
                {goal.cupSize || 200}ml
              </span>
              <motion.button
                type="button" whileTap={{ scale: 0.9 }}
                onClick={() => handleSaveSettings({ cupSize: Math.min(500, (goal.cupSize || 200) + 50) })}
                className="w-7 h-7 rounded-full border-[1.5px] flex items-center justify-center"
                style={{ borderColor: "var(--lifeflow-primary)", background: "var(--color-surface-card)" }}
              >
                <PlusIcon className="w-3.5 h-3.5" style={{ color: "var(--lifeflow-primary)" }} />
              </motion.button>
            </div>
          </div>

          <div className="my-3" style={{ height: "0.5px", background: "var(--lifeflow-border)" }} />

          <div className="flex items-center justify-between h-10">
            <span className="text-[15px]" style={{ color: "var(--color-text-primary)" }}>每日目标</span>
            <div className="flex items-center gap-4">
              <motion.button
                type="button" whileTap={{ scale: 0.9 }}
                onClick={() => handleSaveSettings({ dailyTarget: Math.max(100, dailyTarget - 100) })}
                className="w-7 h-7 rounded-full border-[1.5px] flex items-center justify-center"
                style={{ borderColor: "var(--lifeflow-primary)", background: "var(--color-surface-card)" }}
              >
                <MinusIcon className="w-3.5 h-3.5" style={{ color: "var(--lifeflow-primary)" }} />
              </motion.button>
              <span className="text-[16px] font-bold min-w-[60px] text-center" style={{ color: "var(--color-text-primary)" }}>
                {dailyTarget}ml
              </span>
              <motion.button
                type="button" whileTap={{ scale: 0.9 }}
                onClick={() => handleSaveSettings({ dailyTarget: dailyTarget + 100 })}
                className="w-7 h-7 rounded-full border-[1.5px] flex items-center justify-center"
                style={{ borderColor: "var(--lifeflow-primary)", background: "var(--color-surface-card)" }}
              >
                <PlusIcon className="w-3.5 h-3.5" style={{ color: "var(--lifeflow-primary)" }} />
              </motion.button>
            </div>
          </div>

          <div className="my-3" style={{ height: "0.5px", background: "var(--lifeflow-border)" }} />

          {/* ── 时段占比（晚上自动补齐） ── */}
          <p className="text-[13px] font-medium mb-2" style={{ color: "var(--color-text-primary)" }}>
            时段目标占比
          </p>
          <div className="flex items-center justify-between h-10">
            <span className="text-[15px]" style={{ color: "var(--color-text-primary)" }}>上午</span>
            <div className="flex items-center gap-3">
              <motion.button
                type="button" whileTap={{ scale: 0.9 }}
                onClick={() => handlePercentAdjust("morningPercent", -5)}
                className="w-7 h-7 rounded-full border-[1.5px] flex items-center justify-center"
                style={{ borderColor: "var(--lifeflow-primary)", background: "var(--color-surface-card)" }}
              >
                <MinusIcon className="w-3.5 h-3.5" style={{ color: "var(--lifeflow-primary)" }} />
              </motion.button>
              <span className="text-[16px] font-bold min-w-[40px] text-center" style={{ color: "var(--color-text-primary)" }}>
                {goal.morningPercent ?? 35}%
              </span>
              <motion.button
                type="button" whileTap={{ scale: 0.9 }}
                onClick={() => handlePercentAdjust("morningPercent", 5)}
                className="w-7 h-7 rounded-full border-[1.5px] flex items-center justify-center"
                style={{ borderColor: "var(--lifeflow-primary)", background: "var(--color-surface-card)" }}
              >
                <PlusIcon className="w-3.5 h-3.5" style={{ color: "var(--lifeflow-primary)" }} />
              </motion.button>
            </div>
          </div>
          <div className="flex items-center justify-between h-10">
            <span className="text-[15px]" style={{ color: "var(--color-text-primary)" }}>下午</span>
            <div className="flex items-center gap-3">
              <motion.button
                type="button" whileTap={{ scale: 0.9 }}
                onClick={() => handlePercentAdjust("afternoonPercent", -5)}
                className="w-7 h-7 rounded-full border-[1.5px] flex items-center justify-center"
                style={{ borderColor: "var(--lifeflow-primary)", background: "var(--color-surface-card)" }}
              >
                <MinusIcon className="w-3.5 h-3.5" style={{ color: "var(--lifeflow-primary)" }} />
              </motion.button>
              <span className="text-[16px] font-bold min-w-[40px] text-center" style={{ color: "var(--color-text-primary)" }}>
                {goal.afternoonPercent ?? 40}%
              </span>
              <motion.button
                type="button" whileTap={{ scale: 0.9 }}
                onClick={() => handlePercentAdjust("afternoonPercent", 5)}
                className="w-7 h-7 rounded-full border-[1.5px] flex items-center justify-center"
                style={{ borderColor: "var(--lifeflow-primary)", background: "var(--color-surface-card)" }}
              >
                <PlusIcon className="w-3.5 h-3.5" style={{ color: "var(--lifeflow-primary)" }} />
              </motion.button>
            </div>
          </div>
          <div className="flex items-center justify-between h-10">
            <span className="text-[15px]" style={{ color: "var(--color-text-primary)" }}>晚上（睡前2h前）</span>
            <span className="text-[16px] font-bold min-w-[40px] text-right" style={{ color: "var(--color-text-secondary)" }}>
              {100 - (goal.morningPercent ?? 35) - (goal.afternoonPercent ?? 40)}%
            </span>
          </div>
          <p className="text-[11px] mt-1" style={{ color: "var(--color-text-disabled)" }}>
            晚上占比自动补齐（总和 100%）；睡前 2 小时内不计入目标
          </p>
        </motion.div>
      </div>

      {/* ─── 饮水历史记录 ─── */}
      <div className="px-4 pt-4">
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.15, duration: 0.35, ease: [0.32, 0.72, 0, 1] }}
          className="p-4"
          style={{
            background: "var(--color-surface-card)",
            borderRadius: "20px",
            boxShadow: "var(--shadow-card)",
          }}
        >
          <h2 className="text-[17px] font-semibold mb-3" style={{ color: "var(--color-text-primary)" }}>
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
                      <div className="flex-1 h-2 rounded-full overflow-hidden" style={{ background: "var(--lifeflow-muted)" }}>
                        <div
                          className="h-full rounded-full transition-all"
                          style={{
                            width: `${Math.min(100, dayPct)}%`,
                            background: "var(--lifeflow-primary)",
                            opacity: day.amount === 0 ? 0.3 : 0.7,
                          }}
                        />
                      </div>
                      <span className="text-[12px] font-medium min-w-[70px] text-right" style={{ color: "var(--color-text-secondary)" }}>
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
                                <span className="text-[12px]" style={{ color: "var(--color-text-secondary)" }}>
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

/* ────────── Inline Icons ────────── */

function MinusIcon({ className, style }: { className?: string; style?: React.CSSProperties }) {
  return (
    <svg className={className} style={style} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M20 12H4" />
    </svg>
  );
}

function PlusIcon({ className, style }: { className?: string; style?: React.CSSProperties }) {
  return (
    <svg className={className} style={style} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
    </svg>
  );
}
