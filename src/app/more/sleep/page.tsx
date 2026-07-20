"use client";

import { useEffect, useState, useCallback, useMemo } from "react";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { ChevronLeft, ChevronRight, Minus, Plus, Moon, BarChart3 } from "lucide-react";
import { useHealthStore } from "@/lib/store/healthStore";
import {
  getSleepLogs,
  getSleepLogByDate,
} from "@/lib/db/health.db";
import type { SleepLog } from "@/lib/db/health.db";
import { showToast } from "@/components/ui/Toast";

/* ────────── Helpers ────────── */

function localTodayStr(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function timeToMinutes(t: string): number {
  const [h, m] = t.split(":").map(Number);
  return h * 60 + m;
}

function normalizeMinutes(t: string): number {
  const raw = timeToMinutes(t);
  return raw < 720 ? raw + 1440 : raw;
}

function minutesToTime(m: number): string {
  const normalized = ((m % 1440) + 1440) % 1440;
  const h = Math.floor(normalized / 60);
  const min = normalized % 60;
  return `${String(h).padStart(2, "0")}:${String(min).padStart(2, "0")}`;
}

const REMINDER_OPTIONS = [15, 30, 45, 60] as const;

const DAY_LABELS = ["一", "二", "三", "四", "五", "六", "日"];

/* ────────── Component ────────── */

export default function SleepPage() {
  const router = useRouter();

  const {
    todaySleepLog,
    sleepGoalV2,
    sleepLogs,
    loadSleepData,
    saveSleepLog,
    updateSleepGoalV2,
  } = useHealthStore();

  const [loading, setLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);

  /* manual calibrate bottom sheet */
  const [showCalibrate, setShowCalibrate] = useState(false);
  const [calDate, setCalDate] = useState(localTodayStr());
  const [calHour, setCalHour] = useState("23");
  const [calMin, setCalMin] = useState("00");

  /* 30-day trend */
  const [trendData, setTrendData] = useState<SleepLog[]>([]);

  useEffect(() => {
    (async () => {
      await loadSleepData();
      /* also load 30 days for trend */
      try {
        const logs = await getSleepLogs(30);
        setTrendData(logs);
      } catch { /* ignore */ }
      setLoading(false);
    })();
  }, [loadSleepData]);

  /* ─── target / norm ─── */

  const targetTime = sleepGoalV2?.targetTime || "23:30";
  const targetNorm = normalizeMinutes(targetTime);

  /* window for time scale: target-60min → target+120min */
  const windowStart = targetNorm - 60;
  const windowEnd = targetNorm + 120;

  /* ─── Actual sleep ─── */

  const actualTime = todaySleepLog?.actualTime ?? null;
  const isOnTime = todaySleepLog?.isOnTime ?? null;
  const minutesDiff = todaySleepLog?.minutesDiff ?? null;

  /* ─── Record sleep ─── */

  const handleLogSleep = useCallback(async () => {
    const now = new Date();
    const nowTime = `${String(now.getHours()).padStart(2, "0")}:${String(now.getMinutes()).padStart(2, "0")}`;
    const nowNorm = normalizeMinutes(nowTime);
    const diff = nowNorm - targetNorm;
    const onTime = diff <= 0;
    setIsSaving(true);
    try {
      const existing = await getSleepLogByDate(localTodayStr());
      await saveSleepLog({
        ...(existing ? { id: existing.id } : {}),
        date: localTodayStr(),
        targetTime,
        actualTime: nowTime,
        isOnTime: onTime,
        minutesDiff: diff,
      });
      showToast({ type: "success", message: "已记录入睡时间" });
    } catch {
      showToast({ type: "error", message: "记录失败" });
    } finally {
      setIsSaving(false);
    }
  }, [saveSleepLog, targetNorm, targetTime]);

  /* ─── Consecutive days ─── */

  const consecutiveDays = useMemo(() => {
    if (sleepLogs.length === 0) return 0;
    const sorted = [...sleepLogs].sort((a, b) => b.date.localeCompare(a.date));
    let count = 0;
    const start = new Date();
    for (let i = 0; i < sorted.length; i++) {
      const expected = new Date(start);
      expected.setDate(expected.getDate() - i);
      const ed = `${expected.getFullYear()}-${String(expected.getMonth() + 1).padStart(2, "0")}-${String(expected.getDate()).padStart(2, "0")}`;
      const log = sorted.find((l) => l.date === ed);
      if (log && log.isOnTime) count++;
      else break;
    }
    return count;
  }, [sleepLogs]);

  /* ─── Week dots ─── */

  const weekDots = useMemo(() => {
    const today = new Date();
    const dow = today.getDay(); // 0=Sun, ..., 6=Sat
    const monday = new Date(today);
    monday.setDate(today.getDate() - (dow === 0 ? 6 : dow - 1));
    const result: { label: string; type: "on-time" | "missed" | "today-no-record"; dayOfWeek: number }[] = [];
    for (let i = 0; i < 7; i++) {
      const d = new Date(monday);
      d.setDate(monday.getDate() + i);
      const dateStr = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
      const log = sleepLogs.find((l) => l.date === dateStr);
      const dayNum = d.getDay();
      const isToday = dateStr === localTodayStr();
      if (!log) {
        result.push({ label: DAY_LABELS[i], type: isToday ? "today-no-record" : "missed", dayOfWeek: dayNum });
      } else if (log.isOnTime) {
        result.push({ label: DAY_LABELS[i], type: "on-time", dayOfWeek: dayNum });
      } else {
        result.push({ label: DAY_LABELS[i], type: "missed", dayOfWeek: dayNum });
      }
    }
    return result;
  }, [sleepLogs]);

  /* ─── Stepper ─── */

  const handleStepTarget = useCallback(
    (delta: number) => {
      const [h, m] = targetTime.split(":").map(Number);
      let total = h * 60 + m + delta;
      if (total < 0) total += 1440;
      total = ((total % 1440) + 1440) % 1440;
      /* clamp: 20:00 (1200) to 02:00 (120) */
      const min = 20 * 60; /* 1200 */
      const max = 26 * 60; /* 1560 = 02:00 next day */
      if (total < min && total < 120) total += 1440; /* wrap past midnight */
      if (total < min || total > max) return;
      const newH = Math.floor((total % 1440) / 60);
      const newM = total % 60;
      updateSleepGoalV2({ targetTime: `${String(newH).padStart(2, "0")}:${String(newM).padStart(2, "0")}` });
    },
    [targetTime, updateSleepGoalV2],
  );

  const handleReminderChange = useCallback(
    (val: number) => {
      updateSleepGoalV2({ reminderAdvance: val });
    },
    [updateSleepGoalV2],
  );

  /* ─── Manual calibrate ─── */

  const handleCalibrateSave = useCallback(async () => {
    const t = `${String(calHour).padStart(2, "0")}:${String(calMin).padStart(2, "0")}`;
    const actualNorm = normalizeMinutes(t);
    const diff = actualNorm - targetNorm;
    const onTime = diff <= 0;
    try {
      const existing = await getSleepLogByDate(calDate);
      await saveSleepLog({
        ...(existing ? { id: existing.id } : {}),
        date: calDate,
        targetTime,
        actualTime: t,
        isOnTime: onTime,
        minutesDiff: diff,
      });
      showToast({ type: "success", message: "已校准" });
      setShowCalibrate(false);
    } catch {
      showToast({ type: "error", message: "校准失败" });
    }
  }, [calDate, calHour, calMin, targetNorm, targetTime, saveSleepLog]);

  /* ─── 30-day trend chart ─── */

  const trendChart = useMemo(() => {
    const today = localTodayStr();
    /* build 30-day array with filled data */
    const days: { date: string; actualTime: string | null; isOnTime: boolean | null }[] = [];
    const logMap = new Map(trendData.map((l) => [l.date, l]));
    for (let i = 29; i >= 0; i--) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      const ds = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
      const log = logMap.get(ds);
      days.push({
        date: ds,
        actualTime: log?.actualTime ?? null,
        isOnTime: log?.isOnTime ?? null,
      });
    }

    /* Y-axis range: target-2h to target+3h */
    const yMin = targetNorm - 120;
    const yMax = targetNorm + 180;
    const yRange = yMax - yMin;

    const points = days
      .filter((d) => d.actualTime !== null)
      .map((d) => {
        const idx = days.indexOf(d);
        return {
          x: (idx / 29) * 100,
          y: 100 - ((normalizeMinutes(d.actualTime!) - yMin) / yRange) * 100,
        };
      });

    /* date labels */
    const firstDate = days[0]?.date;
    const midDate = days[14]?.date;
    const lastDate = days[29]?.date;
    const fmtDate = (ds: string) => {
      if (!ds) return "";
      const [y, m, d] = ds.split("-");
      return `${parseInt(m)}/${parseInt(d)}`;
    };

    /* polyline */
    const polylinePoints = points.map((p) => `${p.x},${p.y}`).join(" ");

    /* target dash line Y */
    const targetY = 100 - ((targetNorm - yMin) / yRange) * 100;

    /* Y-axis labels */
    const yTargetLabel = targetTime;
    const yBelow = minutesToTime(targetNorm - 120);
    const yAbove = minutesToTime(targetNorm + 180);

    return {
      days,
      points,
      polylinePoints,
      targetY,
      yBelow,
      yAbove,
      yTargetLabel,
      firstDate: fmtDate(firstDate),
      midDate: fmtDate(midDate),
      lastDate: fmtDate(lastDate),
    };
  }, [trendData, targetNorm, targetTime]);

  /* ─── Loading skeleton ─── */

  if (loading) {
    return (
      <div className="min-h-screen" style={{ background: "var(--lifeflow-background)" }}>
        <header className="sticky top-0 z-30 flex items-center gap-3 px-4 py-3" style={{ background: "var(--lifeflow-background)" }}>
          <div className="inline-flex h-8 w-8 items-center justify-center rounded-lg" style={{ background: "var(--color-surface-card)", border: "1px solid var(--lifeflow-border)" }} />
        </header>
        <div className="px-4 pt-1 pb-10 space-y-4">
          {[1, 2, 3].map((i) => (
            <div key={i} className="animate-pulse p-5" style={{ background: "var(--color-surface-card)", borderRadius: "20px", boxShadow: "var(--shadow-card)" }}>
              <div className="h-5 w-1/3 rounded" style={{ background: "var(--lifeflow-muted)" }} />
              <div className="h-8 w-2/3 mt-3 rounded" style={{ background: "var(--lifeflow-muted)" }} />
            </div>
          ))}
        </div>
      </div>
    );
  }

  /* ────────── Render ────────── */

  return (
    <div className="min-h-screen pb-10" style={{ background: "var(--lifeflow-background)" }}>
      {/* ─── Header ─── */}
      <header className="sticky top-0 z-30 flex items-center gap-3 px-4 py-3" style={{ background: "var(--lifeflow-background)" }}>
        <button
          onClick={() => router.push("/more")}
          className="inline-flex h-8 w-8 items-center justify-center rounded-lg shrink-0"
          style={{ background: "var(--color-surface-card)", border: "1px solid var(--lifeflow-border)" }}
          aria-label="返回"
        >
          <ChevronLeft className="h-4 w-4" style={{ color: "var(--color-text-primary)" }} />
        </button>
        <h1 className="flex-1 text-center text-[17px] font-semibold tracking-[-0.018em]" style={{ color: "var(--color-text-primary)", marginRight: "32px" }}>
          睡眠
        </h1>
      </header>

      <div className="px-4 pt-1 pb-10 space-y-4">
        {/* ─── Sleep Stats Card ─── */}
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.35, ease: [0.32, 0.72, 0, 1] }}
          className="p-5"
          style={{ background: "var(--color-surface-card)", borderRadius: "20px", boxShadow: "var(--shadow-card)" }}
        >
          <div className="flex items-center gap-4">
            {/* Moon Icon */}
            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full" style={{ background: "var(--lifeflow-brand-50)" }}>
              <Moon className="h-6 w-6" style={{ color: "var(--lifeflow-primary)" }} />
            </div>
            {/* Sleep Data */}
            <div className="min-w-0 flex-1">
              <p className="text-[13px] font-medium" style={{ color: "var(--color-text-secondary)", letterSpacing: "-0.01em" }}>
                昨晚睡眠
              </p>
              <p className="text-[17px] font-semibold truncate leading-[1.3]" style={{ color: actualTime ? "var(--color-text-primary)" : "var(--color-text-secondary)" }}>
                {actualTime ? `${actualTime} 入睡` : "暂无记录"}
              </p>
            </div>
            {/* Target */}
            <div className="shrink-0 text-right">
              <p className="text-[13px] font-medium" style={{ color: "var(--color-text-secondary)", letterSpacing: "-0.01em" }}>目标</p>
              <p className="text-[20px] font-bold" style={{ color: "var(--color-text-primary)" }}>8h</p>
            </div>
          </div>

          {/* Time scale track */}
          <div className="mt-5">
            <div className="relative h-[6px] rounded-full" style={{ background: "var(--lifeflow-muted)" }}>
              {/* target dashed line */}
              {(() => {
                const targetPct = ((targetNorm - windowStart) / (windowEnd - windowStart)) * 100;
                return (
                  <div
                    className="absolute top-0 h-full w-px"
                    style={{
                      left: `${targetPct}%`,
                      background: `repeating-linear-gradient(to bottom, var(--lifeflow-primary) 0px, var(--lifeflow-primary) 3px, transparent 3px, transparent 6px)`,
                    }}
                  />
                );
              })()}
              {/* Actual dot */}
              {actualTime && (
                <div
                  className="absolute top-1/2 -translate-y-1/2 -translate-x-1/2 w-[12px] h-[12px] rounded-full shadow-[0_0_0_3px_white]"
                  style={{
                    left: `${((normalizeMinutes(actualTime) - windowStart) / (windowEnd - windowStart)) * 100}%`,
                    background: "var(--lifeflow-primary)",
                  }}
                />
              )}
            </div>

            {/* Labels */}
            <div className="mt-2 flex justify-between">
              <span className="text-[13px]" style={{ color: "var(--color-text-disabled)" }}>
                {minutesToTime(windowStart)}
              </span>
              <span className="text-[13px]" style={{ color: "var(--color-text-disabled)" }}>
                {minutesToTime(windowEnd)}
              </span>
            </div>
          </div>

          {/* Status */}
          {actualTime ? (
            <p className="mt-4 text-[13px] text-center" style={{ color: "var(--color-text-secondary)" }}>
              {minutesDiff! > 0
                ? `比目标晚 ${minutesDiff} 分钟`
                : minutesDiff! < 0
                  ? `比目标早 ${Math.abs(minutesDiff!)} 分钟`
                  : "正好达标"}
            </p>
          ) : null}
        </motion.div>

        {/* ─── Record Sleep Button ─── */}
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.05, duration: 0.35, ease: [0.32, 0.72, 0, 1] }}
        >
          <button
            type="button"
            onClick={handleLogSleep}
            disabled={isSaving}
            className="w-full py-3.5 rounded-full text-white text-base font-semibold tracking-[-0.018em] active:opacity-90 transition-opacity disabled:opacity-50"
            style={{ background: "var(--lifeflow-primary)" }}
          >
            {isSaving ? "记录中…" : actualTime ? "更新入睡时间" : "记录睡眠"}
          </button>
        </motion.div>

        {/* ─── 早睡分析 Card ─── */}
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1, duration: 0.35, ease: [0.32, 0.72, 0, 1] }}
        >
          <h2 className="text-base font-semibold mb-3 px-0.5" style={{ color: "var(--color-text-primary)" }}>早睡分析</h2>
          <div className="p-6 flex flex-col items-center justify-center" style={{ background: "var(--color-surface-card)", borderRadius: "20px", boxShadow: "var(--shadow-card)", minHeight: "160px" }}>
            {trendChart.points.length > 1 ? (
              <div className="w-full">
                <div className="flex">
                  {/* Y-axis labels */}
                  <div className="flex flex-col justify-between h-[140px] pr-2" style={{ paddingBottom: 20 }}>
                    <span className="text-[11px] leading-none" style={{ color: "var(--color-text-disabled)" }}>{trendChart.yAbove}</span>
                    <span className="text-[11px] leading-none font-medium" style={{ color: "var(--lifeflow-primary)" }}>{trendChart.yTargetLabel}</span>
                    <span className="text-[11px] leading-none" style={{ color: "var(--color-text-disabled)" }}>{trendChart.yBelow}</span>
                  </div>
                  {/* Plot area */}
                  <div className="flex-1 relative" style={{ height: 140, paddingBottom: 20 }}>
                    <svg
                      className="absolute inset-0 w-full h-full overflow-visible"
                      preserveAspectRatio="none"
                    >
                      {/* Target dashed line */}
                      <line
                        x1="0"
                        y1={`${trendChart.targetY}%`}
                        x2="100%"
                        y2={`${trendChart.targetY}%`}
                        stroke="var(--lifeflow-brand-200)"
                        strokeWidth="1"
                        strokeDasharray="4 4"
                      />
                      {/* Polyline */}
                      {trendChart.points.length > 1 && (
                        <polyline
                          points={trendChart.polylinePoints}
                          fill="none"
                          stroke="var(--lifeflow-primary)"
                          strokeWidth="2"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                        />
                      )}
                      {/* Data dots */}
                      {trendChart.points.map((p, i) => (
                        <circle
                          key={i}
                          cx={`${p.x}%`}
                          cy={`${p.y}%`}
                          r="2.5"
                          fill="var(--lifeflow-primary)"
                        />
                      ))}
                    </svg>
                  </div>
                </div>
                {/* X-axis labels */}
                <div className="flex justify-between mt-1">
                  <span className="text-[11px]" style={{ color: "var(--color-text-disabled)" }}>{trendChart.firstDate}</span>
                  <span className="text-[11px]" style={{ color: "var(--color-text-disabled)" }}>{trendChart.midDate}</span>
                  <span className="text-[11px]" style={{ color: "var(--color-text-disabled)" }}>{trendChart.lastDate}</span>
                </div>
              </div>
            ) : (
              <>
                <BarChart3 className="h-10 w-10 mb-3" style={{ color: "var(--color-text-disabled)" }} />
                <p className="text-[13px] font-medium text-center" style={{ color: "var(--color-text-secondary)" }}>暂无睡眠数据</p>
                <p className="text-[12px] mt-1 text-center" style={{ color: "var(--color-text-disabled)" }}>记录几晚睡眠后，查看入睡趋势分析</p>
              </>
            )}
          </div>
        </motion.div>

        {/* ─── Consecutive Days Card ─── */}
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.12, duration: 0.35, ease: [0.32, 0.72, 0, 1] }}
          className="p-5"
          style={{ background: "var(--color-surface-card)", borderRadius: "20px", boxShadow: "var(--shadow-card)" }}
        >
          <p className="text-[17px] font-bold text-center" style={{ color: "var(--color-text-primary)" }}>
            连续 {consecutiveDays} 天达成目标
          </p>
          <p className="text-[13px] text-center mt-1" style={{ color: "var(--color-text-secondary)" }}>
            {consecutiveDays > 0 ? "保持好习惯" : "从今天开始吧"}
          </p>

          {/* Week dots */}
          <div className="mt-5 flex justify-center gap-2">
            {weekDots.map((dot, i) => (
              <div key={i} className="flex flex-col items-center gap-1">
                <div
                  className={`w-6 h-6 rounded-full flex items-center justify-center text-[12px] font-medium ${
                    dot.type === "on-time"
                      ? ""
                      : dot.type === "today-no-record"
                        ? ""
                        : ""
                  }`}
                  style={
                    dot.type === "on-time"
                      ? { background: "var(--lifeflow-primary)", color: "#fff" }
                      : dot.type === "today-no-record"
                        ? { background: "#fff", border: "2px solid var(--lifeflow-primary)", color: "var(--lifeflow-primary)" }
                        : { background: "var(--lifeflow-muted)", color: "var(--color-text-disabled)" }
                  }
                >
                  {dot.type === "on-time" ? "✓" : ""}
                </div>
                <span className="text-[11px]" style={{ color: "var(--color-text-disabled)" }}>{dot.label}</span>
              </div>
            ))}
          </div>
        </motion.div>

        {/* ─── Sleep Target Card ─── */}
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.14, duration: 0.35, ease: [0.32, 0.72, 0, 1] }}
          className="p-5"
          style={{ background: "var(--color-surface-card)", borderRadius: "20px", boxShadow: "var(--shadow-card)" }}
        >
          <h2 className="text-[17px] font-semibold" style={{ color: "var(--color-text-primary)" }}>入睡目标</h2>

          {/* Stepper */}
          <div className="mt-5 flex items-center justify-center gap-6">
            <button
              type="button"
              onClick={() => handleStepTarget(-5)}
              className="w-8 h-8 rounded-full border-2 flex items-center justify-center"
              style={{ borderColor: "var(--lifeflow-primary)", background: "var(--color-surface-card)" }}
            >
              <Minus className="w-4 h-4" style={{ color: "var(--lifeflow-primary)" }} />
            </button>
            <span className="text-[34px] font-bold leading-none tabular-nums" style={{ color: "var(--color-text-primary)" }}>
              {targetTime}
            </span>
            <button
              type="button"
              onClick={() => handleStepTarget(5)}
              className="w-8 h-8 rounded-full border-2 flex items-center justify-center"
              style={{ borderColor: "var(--lifeflow-primary)", background: "var(--color-surface-card)" }}
            >
              <Plus className="w-4 h-4" style={{ color: "var(--lifeflow-primary)" }} />
            </button>
          </div>

          {/* Reminder advance */}
          <div className="mt-6">
            <div className="flex items-center justify-between">
              <span className="text-[13px]" style={{ color: "var(--color-text-secondary)" }}>提醒提前量</span>
              {/* iOS-style toggle switch */}
              <button
                type="button"
                onClick={() =>
                  updateSleepGoalV2({
                    reminderEnabled: !sleepGoalV2.reminderEnabled,
                  })
                }
                className="relative w-[51px] h-[31px] rounded-full transition-colors"
                style={{ background: sleepGoalV2.reminderEnabled ? "var(--lifeflow-primary)" : "var(--color-text-disabled)" }}
              >
                <motion.div
                  className="absolute top-[2px] w-[27px] h-[27px] rounded-full bg-white shadow-sm"
                  animate={{ left: sleepGoalV2.reminderEnabled ? 22 : 2 }}
                  transition={{ type: "spring", stiffness: 500, damping: 30 }}
                />
              </button>
            </div>
            {sleepGoalV2.reminderEnabled && (
              <div className="mt-3 flex gap-2">
                {REMINDER_OPTIONS.map((val) => (
                  <button
                    key={val}
                    type="button"
                    onClick={() => handleReminderChange(val)}
                    className="h-9 px-4 rounded-full text-[13px] transition-colors"
                    style={
                      sleepGoalV2.reminderAdvance === val
                        ? { background: "var(--lifeflow-brand-50)", color: "var(--lifeflow-primary)", fontWeight: 500 }
                        : { background: "var(--lifeflow-muted)", color: "var(--color-text-secondary)" }
                    }
                  >
                    {val}分钟
                  </button>
                ))}
              </div>
            )}
          </div>
        </motion.div>

        {/* ─── Manual Calibrate ─── */}
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.16, duration: 0.35, ease: [0.32, 0.72, 0, 1] }}
          className="mt-4 mb-4"
        >
          <button
            type="button"
            onClick={() => {
              const now = new Date();
              setCalDate(localTodayStr());
              setCalHour(String(now.getHours()).padStart(2, "0"));
              setCalMin(String(now.getMinutes()).padStart(2, "0"));
              setShowCalibrate(true);
            }}
            className="w-full flex items-center justify-between py-2"
          >
            <span className="text-[17px]" style={{ color: "var(--color-text-disabled)" }}>手动校准</span>
            <ChevronRight className="w-5 h-5" style={{ color: "var(--color-text-disabled)" }} />
          </button>
        </motion.div>
      </div>

      {/* ─── Calibrate Bottom Sheet ─── */}
      <AnimatePresence>
        {showCalibrate && (
          <>
            {/* Backdrop */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 bg-black/30 z-40"
              onClick={() => setShowCalibrate(false)}
            />
            {/* Sheet */}
            <motion.div
              initial={{ y: "100%" }}
              animate={{ y: 0 }}
              exit={{ y: "100%" }}
              transition={{ type: "spring", stiffness: 400, damping: 40 }}
              className="fixed bottom-0 left-0 right-0 z-50 rounded-t-[20px] px-5 pt-6 pb-10"
              style={{ maxWidth: 430, margin: "0 auto", background: "var(--color-surface-card)" }}
            >
              <div className="w-9 h-1 rounded-full mx-auto mb-5" style={{ background: "var(--lifeflow-muted)" }} />
              <h3 className="text-[17px] font-semibold mb-5" style={{ color: "var(--color-text-primary)" }}>手动校准</h3>

              {/* Date */}
              <label className="text-[13px] mb-1.5 block" style={{ color: "var(--color-text-secondary)" }}>日期</label>
              <input
                type="date"
                value={calDate}
                onChange={(e) => setCalDate(e.target.value)}
                className="w-full h-11 px-4 rounded-[12px] text-[16px] outline-none mb-4 transition-colors"
                style={{
                  border: "1px solid var(--lifeflow-border)",
                  color: "var(--color-text-primary)",
                  background: "var(--lifeflow-input)",
                }}
              />

              {/* Time */}
              <label className="text-[13px] mb-1.5 block" style={{ color: "var(--color-text-secondary)" }}>入睡时间</label>
              <div className="flex items-center gap-2 mb-6">
                <input
                  type="number"
                  min={0}
                  max={23}
                  value={calHour}
                  onChange={(e) => setCalHour(e.target.value.padStart(2, "0").slice(0, 2))}
                  className="w-16 h-11 text-center rounded-[12px] text-[16px] outline-none transition-colors"
                  style={{
                    border: "1px solid var(--lifeflow-border)",
                    color: "var(--color-text-primary)",
                    background: "var(--lifeflow-input)",
                  }}
                />
                <span className="text-[16px] font-bold" style={{ color: "var(--color-text-primary)" }}>:</span>
                <input
                  type="number"
                  min={0}
                  max={59}
                  value={calMin}
                  onChange={(e) => setCalMin(e.target.value.padStart(2, "0").slice(0, 2))}
                  className="w-16 h-11 text-center rounded-[12px] text-[16px] outline-none transition-colors"
                  style={{
                    border: "1px solid var(--lifeflow-border)",
                    color: "var(--color-text-primary)",
                    background: "var(--lifeflow-input)",
                  }}
                />
              </div>

              <button
                type="button"
                onClick={handleCalibrateSave}
                className="w-full h-11 rounded-full text-white text-[16px] font-medium"
                style={{ background: "var(--lifeflow-primary)" }}
              >
                保存
              </button>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  );
}
