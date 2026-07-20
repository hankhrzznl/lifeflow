"use client";

import { useEffect, useState, useCallback, useMemo } from "react";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { ChevronLeft, ChevronRight, Minus, Plus } from "lucide-react";
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
      .map((d, i) => {
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
      <div className="min-h-screen bg-[#FAFAFA]">
        <header className="sticky top-0 z-20 bg-white border-b border-[#EBEBEB] h-11 flex items-center">
          <button
            onClick={() => router.push("/more")}
            className="ml-4 w-6 h-6 flex items-center justify-center"
          >
            <ChevronLeft className="w-6 h-6 text-[#515154]" />
          </button>
        </header>
        <div className="px-5 pt-5 flex flex-col gap-4">
          {[1, 2, 3].map((i) => (
            <div key={i} className="bg-white rounded-[10px] border border-[#EBEBEB] p-5 animate-pulse">
              <div className="h-5 w-1/3 rounded bg-[#F5F5F7]" />
              <div className="h-8 w-2/3 mt-3 rounded bg-[#F5F5F7]" />
            </div>
          ))}
        </div>
      </div>
    );
  }

  /* ────────── Render ────────── */

  return (
    <div className="min-h-screen bg-[#FAFAFA] pb-10">
      {/* ─── Header ─── */}
      <header className="sticky top-0 z-20 bg-white border-b border-[#EBEBEB] h-11 flex items-center relative">
        <button
          onClick={() => router.push("/more")}
          className="ml-4 w-6 h-6 flex items-center justify-center"
          aria-label="返回"
        >
          <ChevronLeft className="w-6 h-6 text-[#515154]" />
        </button>
        <h1 className="absolute left-1/2 -translate-x-1/2 text-[18px] font-semibold text-[#1D1D1F]">
          睡眠
        </h1>
      </header>

      <div className="px-5 pt-4 flex flex-col gap-4">
        {/* ─── Card 1 — Sleep Time Scale ─── */}
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.35, ease: [0.32, 0.72, 0, 1] }}
          className="bg-white rounded-[10px] border border-[#EBEBEB] px-5 pt-6 pb-6"
        >
          {/* 2 columns */}
          <div className="flex items-center justify-center gap-0">
            <div className="flex flex-col items-center flex-1">
              <span className="text-[13px] text-[#86868B] mb-1">昨晚入睡</span>
              <span className="text-[26px] font-bold text-[#1D1D1F] leading-none">
                {actualTime ?? "--:--"}
              </span>
            </div>
            <div className="w-px h-[51px] bg-[#EBEBEB]" />
            <div className="flex flex-col items-center flex-1">
              <span className="text-[13px] text-[#86868B] mb-1">目标入睡</span>
              <span className="text-[26px] font-bold text-[#D2D2D7] leading-none">
                {targetTime}
              </span>
            </div>
          </div>

          {/* Time scale track */}
          <div className="mt-6">
            <div className="relative h-[6px] rounded-full bg-[#EBEBED]">
              {/* target dashed line */}
              {(() => {
                const targetPct = ((targetNorm - windowStart) / (windowEnd - windowStart)) * 100;
                return (
                  <div
                    className="absolute top-0 h-full w-px"
                    style={{
                      left: `${targetPct}%`,
                      background: "repeating-linear-gradient(to bottom, #5865F2 0px, #5865F2 3px, transparent 3px, transparent 6px)",
                    }}
                  />
                );
              })()}
              {/* Actual dot */}
              {actualTime && (
                <div
                  className="absolute top-1/2 -translate-y-1/2 -translate-x-1/2 w-[12px] h-[12px] rounded-full bg-[#5865F2] shadow-[0_0_0_3px_white]"
                  style={{
                    left: `${((normalizeMinutes(actualTime) - windowStart) / (windowEnd - windowStart)) * 100}%`,
                  }}
                />
              )}
            </div>

            {/* Labels */}
            <div className="mt-2 flex justify-between">
              <span className="text-[13px] text-[#AEAEB2]">
                {minutesToTime(windowStart)}
              </span>
              <span className="text-[13px] text-[#AEAEB2]">
                {minutesToTime(windowEnd)}
              </span>
            </div>
          </div>

          {/* Status */}
          {actualTime ? (
            <p className="mt-4 text-[13px] text-[#86868B] text-center">
              {minutesDiff! > 0
                ? `比目标晚 ${minutesDiff} 分钟`
                : minutesDiff! < 0
                  ? `比目标早 ${Math.abs(minutesDiff!)} 分钟`
                  : "正好达标"}
            </p>
          ) : (
            <div className="mt-4 flex flex-col items-center gap-3">
              <p className="text-[13px] text-[#86868B]">暂无昨晚入睡记录</p>
              <button
                type="button"
                onClick={handleLogSleep}
                disabled={isSaving}
                className="w-full h-11 rounded-full bg-[#5865F2] text-white text-[16px] font-medium"
              >
                {isSaving ? "记录中…" : "记录入睡时间"}
              </button>
            </div>
          )}
        </motion.div>

        {/* ─── Card 2 — Consecutive Days ─── */}
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.05, duration: 0.35, ease: [0.32, 0.72, 0, 1] }}
          className="bg-white rounded-[10px] border border-[#EBEBEB] px-5 pt-6 pb-6"
        >
          <p className="text-[17px] font-bold text-[#1D1D1F] text-center">
            连续 {consecutiveDays} 天达成目标
          </p>
          <p className="text-[13px] text-[#86868B] text-center mt-1">
            {consecutiveDays > 0 ? "保持好习惯" : "从今天开始吧"}
          </p>

          {/* Week dots */}
          <div className="mt-5 flex justify-center gap-2">
            {weekDots.map((dot, i) => (
              <div key={i} className="flex flex-col items-center gap-1">
                <div
                  className={`w-6 h-6 rounded-full flex items-center justify-center text-[12px] font-medium ${
                    dot.type === "on-time"
                      ? "bg-[#5865F2] text-white"
                      : dot.type === "today-no-record"
                        ? "bg-white border-2 border-[#5865F2] text-[#5865F2]"
                        : "bg-[#EBEBED] text-[#AEAEB2]"
                  }`}
                >
                  {dot.type === "on-time" ? "✓" : ""}
                </div>
                <span className="text-[11px] text-[#AEAEB2]">{dot.label}</span>
              </div>
            ))}
          </div>
        </motion.div>

        {/* ─── Card 3 — Sleep Target ─── */}
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1, duration: 0.35, ease: [0.32, 0.72, 0, 1] }}
          className="bg-white rounded-[10px] border border-[#EBEBEB] px-5 pt-6 pb-6"
        >
          <h2 className="text-[18px] font-bold text-[#1D1D1F]">入睡目标</h2>

          {/* Stepper */}
          <div className="mt-5 flex items-center justify-center gap-6">
            <button
              type="button"
              onClick={() => handleStepTarget(-5)}
              className="w-8 h-8 rounded-full border-2 border-[#5865F2] bg-white flex items-center justify-center"
            >
              <Minus className="w-4 h-4 text-[#5865F2]" />
            </button>
            <span className="text-[34px] font-bold text-[#1D1D1F] leading-none tabular-nums">
              {targetTime}
            </span>
            <button
              type="button"
              onClick={() => handleStepTarget(5)}
              className="w-8 h-8 rounded-full border-2 border-[#5865F2] bg-white flex items-center justify-center"
            >
              <Plus className="w-4 h-4 text-[#5865F2]" />
            </button>
          </div>

          {/* Reminder advance */}
          <div className="mt-6">
            <div className="flex items-center justify-between">
              <span className="text-[13px] text-[#86868B]">提醒提前量</span>
              {/* iOS-style toggle switch */}
              <button
                type="button"
                onClick={() =>
                  updateSleepGoalV2({
                    reminderEnabled: !sleepGoalV2.reminderEnabled,
                  })
                }
                className={`relative w-[51px] h-[31px] rounded-full transition-colors ${
                  sleepGoalV2.reminderEnabled ? "bg-[#5865F2]" : "bg-[#D2D2D7]"
                }`}
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
                    className={`h-9 px-4 rounded-full text-[13px] transition-colors ${
                      sleepGoalV2.reminderAdvance === val
                        ? "bg-[#EEF0FF] text-[#5865F2] font-medium"
                        : "bg-[#F5F5F7] text-[#86868B]"
                    }`}
                  >
                    {val}分钟
                  </button>
                ))}
              </div>
            )}
          </div>
        </motion.div>

        {/* ─── Card 4 — 30 Day Trend ─── */}
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.15, duration: 0.35, ease: [0.32, 0.72, 0, 1] }}
          className="bg-white rounded-[10px] border border-[#EBEBEB] px-5 pt-6 pb-6"
        >
          <h2 className="text-[18px] font-bold text-[#1D1D1F]">30 天趋势</h2>

          <div className="mt-6 flex">
            {/* Y-axis labels */}
            <div className="flex flex-col justify-between h-[180px] pr-2" style={{ paddingBottom: 20 }}>
              <span className="text-[11px] text-[#AEAEB2] leading-none">{trendChart.yAbove}</span>
              <span className="text-[11px] text-[#5865F2] leading-none font-medium">{trendChart.yTargetLabel}</span>
              <span className="text-[11px] text-[#AEAEB2] leading-none">{trendChart.yBelow}</span>
            </div>

            {/* Plot area */}
            <div className="flex-1 relative" style={{ height: 180, paddingBottom: 20 }}>
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
                  stroke="#CDD1FC"
                  strokeWidth="1"
                  strokeDasharray="4 4"
                />

                {/* Polyline */}
                {trendChart.points.length > 1 && (
                  <polyline
                    points={trendChart.polylinePoints}
                    fill="none"
                    stroke="#5865F2"
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
                    fill="#5865F2"
                  />
                ))}
              </svg>
            </div>
          </div>

          {/* X-axis labels */}
          <div className="flex justify-between mt-1">
            <span className="text-[11px] text-[#AEAEB2]">{trendChart.firstDate}</span>
            <span className="text-[11px] text-[#AEAEB2]">{trendChart.midDate}</span>
            <span className="text-[11px] text-[#AEAEB2]">{trendChart.lastDate}</span>
          </div>
        </motion.div>

        {/* ─── Bottom — Manual Calibrate ─── */}
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2, duration: 0.35, ease: [0.32, 0.72, 0, 1] }}
          className="mt-8 mb-4"
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
            <span className="text-[17px] text-[#AEAEB2]">手动校准</span>
            <ChevronRight className="w-5 h-5 text-[#AEAEB2]" />
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
              className="fixed bottom-0 left-0 right-0 z-50 bg-white rounded-t-[20px] px-5 pt-6 pb-10"
              style={{ maxWidth: 430, margin: "0 auto" }}
            >
              <div className="w-9 h-1 rounded-full bg-[#D2D2D7] mx-auto mb-5" />
              <h3 className="text-[18px] font-bold text-[#1D1D1F] mb-5">手动校准</h3>

              {/* Date */}
              <label className="text-[13px] text-[#86868B] mb-1.5 block">日期</label>
              <input
                type="date"
                value={calDate}
                onChange={(e) => setCalDate(e.target.value)}
                className="w-full h-11 px-4 rounded-[10px] border border-[#EBEBEB] text-[16px] text-[#1D1D1F] bg-[#F5F5F7] mb-4 outline-none focus:border-[#5865F2]"
              />

              {/* Time */}
              <label className="text-[13px] text-[#86868B] mb-1.5 block">入睡时间</label>
              <div className="flex items-center gap-2 mb-6">
                <input
                  type="number"
                  min={0}
                  max={23}
                  value={calHour}
                  onChange={(e) => setCalHour(e.target.value.padStart(2, "0").slice(0, 2))}
                  className="w-16 h-11 text-center rounded-[10px] border border-[#EBEBEB] text-[16px] text-[#1D1D1F] bg-[#F5F5F7] outline-none focus:border-[#5865F2]"
                />
                <span className="text-[16px] text-[#1D1D1F] font-bold">:</span>
                <input
                  type="number"
                  min={0}
                  max={59}
                  value={calMin}
                  onChange={(e) => setCalMin(e.target.value.padStart(2, "0").slice(0, 2))}
                  className="w-16 h-11 text-center rounded-[10px] border border-[#EBEBEB] text-[16px] text-[#1D1D1F] bg-[#F5F5F7] outline-none focus:border-[#5865F2]"
                />
              </div>

              <button
                type="button"
                onClick={handleCalibrateSave}
                className="w-full h-11 rounded-full bg-[#5865F2] text-white text-[16px] font-medium"
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
