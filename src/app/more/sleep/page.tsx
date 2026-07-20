"use client";

import { useEffect, useState, useCallback, useMemo, useRef } from "react";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { ChevronLeft, ChevronRight, Minus, Plus } from "lucide-react";
import { useHealthStore } from "@/lib/store/healthStore";
import { getSleepLogs, getSleepLogByDate } from "@/lib/db/health.db";
import type { SleepLog, SleepGoalV2 } from "@/lib/db/health.db";
import { showToast } from "@/components/ui/Toast";

// ============================================================
// 设计令牌
// ============================================================
const ACCENT = "#6366F1";
const INK = "#1D1D1F";
const MUTED = "#86868B";
const FAINT = "#AEAEB2";
const TARGET_GRAY = "#D2D2D7";
const TRACK = "#EBEBED";
const SOFT = "#EEF0FF";
const LINE_SOFT = "#CDD1FC";
const PILL_BG = "#F5F5F7";
const CARD_BORDER = "#EBEBEB";

// ─── 时间工具（复用旧实现）──────────────────────────────────
function localTodayStr(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}
function timeToMinutes(t: string): number {
  const [h, m] = t.split(":").map(Number);
  return h * 60 + m;
}
function minutesToTime(m: number): string {
  const h = Math.floor(m / 60) % 24;
  const min = m % 60;
  return `${String(h).padStart(2, "0")}:${String(min).padStart(2, "0")}`;
}
function normalizeMinutes(t: string): number {
  const raw = timeToMinutes(t);
  return raw < 720 ? raw + 1440 : raw;
}
function denormalizeDisplay(m: number): string {
  const raw = m >= 1440 ? m - 1440 : m;
  const h = Math.floor(raw / 60);
  const min = raw % 60;
  return `${String(h).padStart(2, "0")}:${String(min).padStart(2, "0")}`;
}
function subtractMinutes(time: string, mins: number): string {
  const wrapped = ((timeToMinutes(time) - mins) % 1440 + 1440) % 1440;
  return minutesToTime(wrapped);
}
function getDateNDaysAgo(n: number): string {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

// ─── iOS Switch ─────────────────────────────────────────────
function ToggleSwitch({ checked, onChange }: { checked: boolean; onChange: () => void }) {
  return (
    <button type="button" onClick={onChange} className="relative shrink-0 cursor-pointer"
      style={{ width: 51, height: 31, borderRadius: 15.5, background: checked ? ACCENT : "#E5E5E5", transition: "background 0.2s" }}>
      <motion.div className="absolute rounded-full bg-white"
        animate={{ x: checked ? 22 : 2 }}
        transition={{ type: "spring", stiffness: 500, damping: 30 }}
        style={{ width: 27, height: 27, top: 2, boxShadow: "0 1px 3px rgba(0,0,0,0.15)" }} />
    </button>
  );
}

// ============================================================
// 页面
// ============================================================
export default function SleepPage() {
  const router = useRouter();
  const { todaySleepLog, sleepGoalV2, loadSleepData, saveSleepLog, updateSleepGoalV2 } = useHealthStore();

  const [allLogs, setAllLogs] = useState<SleepLog[]>([]);
  const hasLoadedStore = useRef(false);
  const [loading, setLoading] = useState(true);
  const [calibrateOpen, setCalibrateOpen] = useState(false);
  const [calDate, setCalDate] = useState(() => localTodayStr());
  const [calTime, setCalTime] = useState("23:30");
  const [isSaving, setIsSaving] = useState(false);

  // ─── 加载数据 ──────────────────────────────────────────────
  useEffect(() => {
    if (!hasLoadedStore.current) {
      hasLoadedStore.current = true;
      (async () => {
        await loadSleepData();
        const logs = await getSleepLogs(365);
        setAllLogs(logs);
        setLoading(false);
      })();
    }
  }, [loadSleepData]);

  useEffect(() => {
    (async () => {
      const logs = await getSleepLogs(365);
      setAllLogs(logs);
    })();
  }, [todaySleepLog]);

  const targetTime = sleepGoalV2.targetTime;
  const targetNorm = normalizeMinutes(targetTime);

  // ─── 连续达标 ─────────────────────────────────────────────
  const consecutiveDays = useMemo(() => {
    if (allLogs.length === 0) return 0;
    const today = localTodayStr();
    let count = 0;
    for (let i = 0; i < 365; i++) {
      const dateStr = getDateNDaysAgo(i);
      if (dateStr > today) continue;
      const log = allLogs.find((l) => l.date === dateStr);
      if (dateStr === today && !log) continue;
      if (log && log.isOnTime) count++;
      else break;
    }
    return count;
  }, [allLogs]);

  // ─── 周圆数据（最近7天）───────────────────────────────────
  const weekCircles = useMemo(() => {
    const circles: { label: string; date: string; state: "hit" | "miss" | "empty" }[] = [];
    const today = localTodayStr();
    for (let i = 6; i >= 0; i--) {
      const dateStr = getDateNDaysAgo(i);
      const d = new Date(dateStr);
      const weekLabels = ["日", "一", "二", "三", "四", "五", "六"];
      const log = allLogs.find((l) => l.date === dateStr);
      let state: "hit" | "miss" | "empty";
      if (log && log.isOnTime) state = "hit";
      else if (dateStr === today && !log) state = "empty";
      else state = "miss";
      circles.push({ label: weekLabels[d.getDay()], date: dateStr, state });
    }
    return circles;
  }, [allLogs]);

  // ─── 30天趋势 ─────────────────────────────────────────────
  const trendData = useMemo(() => {
    const points: { date: string; label: string; normMin: number | null }[] = [];
    for (let i = 29; i >= 0; i--) {
      const dateStr = getDateNDaysAgo(i);
      const log = allLogs.find((l) => l.date === dateStr);
      const d = new Date(dateStr);
      points.push({ date: dateStr, label: `${d.getMonth() + 1}/${d.getDate()}`, normMin: log ? normalizeMinutes(log.actualTime) : null });
    }
    return points;
  }, [allLogs]);

  // ─── 标尺窗口 ─────────────────────────────────────────────
  const rulerStartNorm = targetNorm - 60;
  const rulerEndNorm = targetNorm + 120;
  const rulerRange = rulerEndNorm - rulerStartNorm; // 180

  const actualNorm = todaySleepLog ? normalizeMinutes(todaySleepLog.actualTime) : null;
  const actualPct = actualNorm != null ? Math.max(0, Math.min(100, ((actualNorm - rulerStartNorm) / rulerRange) * 100)) : 0;
  const targetPct = ((targetNorm - rulerStartNorm) / rulerRange) * 100; // ~33.3%

  const diffText = todaySleepLog
    ? (todaySleepLog.minutesDiff > 0 ? `比目标晚 ${todaySleepLog.minutesDiff} 分钟` : todaySleepLog.minutesDiff < 0 ? `比目标早 ${Math.abs(todaySleepLog.minutesDiff)} 分钟` : "正好达标")
    : "暂无昨晚入睡记录";

  // ─── 30天趋势 Y轴 ─────────────────────────────────────────
  const trendWindowStart = targetNorm - 120;
  const trendWindowEnd = targetNorm + 180;
  const trendYLabels = [
    denormalizeDisplay(targetNorm + 180),
    denormalizeDisplay(targetNorm),
    denormalizeDisplay(targetNorm - 120),
  ];

  // ─── 操作 ──────────────────────────────────────────────────
  const handleLogSleep = useCallback(async () => {
    const now = new Date();
    const actualTime = `${String(now.getHours()).padStart(2, "0")}:${String(now.getMinutes()).padStart(2, "0")}`;
    const actualNorm = normalizeMinutes(actualTime);
    const diff = actualNorm - targetNorm;
    const isOnTime = diff <= 0;
    setIsSaving(true);
    try {
      const existing = await getSleepLogByDate(localTodayStr());
      await saveSleepLog({
        ...(existing ? { id: existing.id } : {}),
        date: localTodayStr(), targetTime, actualTime, isOnTime, minutesDiff: diff,
      });
      showToast({ type: "success", message: "已记录入睡时间" });
    } catch { showToast({ type: "error", message: "记录失败" }); }
    finally { setIsSaving(false); }
  }, [saveSleepLog, targetNorm, targetTime]);

  const handleCalibrate = useCallback(async () => {
    const actualNorm = normalizeMinutes(calTime);
    const diff = actualNorm - targetNorm;
    const isOnTime = diff <= 0;
    setIsSaving(true);
    try {
      const existing = await getSleepLogByDate(calDate);
      await saveSleepLog({
        ...(existing ? { id: existing.id } : {}),
        date: calDate, targetTime, actualTime: calTime, isOnTime, minutesDiff: diff,
      });
      setCalibrateOpen(false);
      showToast({ type: "success", message: "校准已保存" });
    } catch { showToast({ type: "error", message: "保存失败" }); }
    finally { setIsSaving(false); }
  }, [saveSleepLog, calDate, calTime, targetNorm, targetTime]);

  const handleGoalStep = useCallback((delta: number) => {
    const m = timeToMinutes(targetTime);
    const clamped = Math.max(20 * 60, Math.min(26 * 60, m + delta));
    updateSleepGoalV2({ targetTime: minutesToTime(clamped) });
  }, [targetTime, updateSleepGoalV2]);

  const reminderEnabled = sleepGoalV2.reminderEnabled;
  const reminderAdvance = sleepGoalV2.reminderAdvance;

  // ════════════════════════════════════════════════════════════
  // 渲染
  // ════════════════════════════════════════════════════════════
  if (loading) {
    return (
      <div>
        <div className="sticky top-0 z-20 bg-white border-b border-[#EBEBEB]">
          <div className="h-11 px-4 flex items-center max-w-[430px] mx-auto">
            <ChevronLeft className="w-6 h-6 text-[#515154]" />
          </div>
        </div>
        <div className="px-4 pt-3 pb-4 flex flex-col gap-6">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="bg-white rounded-xl px-5 pt-6 pb-6 animate-pulse" style={{ boxShadow: "0 1px 4px rgba(0,0,0,0.04)" }}>
              <div className="h-6 w-1/3 bg-[#F5F5F5] rounded mb-3" />
              <div className="h-8 w-2/3 bg-[#F5F5F5] rounded" />
            </div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div>
      {/* ===== 页头 ===== */}
      <div className="sticky top-0 z-20 bg-white border-b border-[#EBEBEB]">
        <div className="h-11 px-4 flex items-center justify-center relative max-w-[430px] mx-auto">
          <button type="button" onClick={() => router.push("/more")}
            className="absolute left-4 w-10 h-10 -ml-2 flex items-center justify-center">
            <ChevronLeft className="w-6 h-6 text-[#515154]" />
          </button>
          <span className="text-[18px] font-semibold text-[#1D1D1F]">睡眠</span>
        </div>
      </div>

      <div className="px-4 pt-3 pb-4 flex flex-col gap-6">

        {/* ===== 卡片 1 · 入睡标尺 ===== */}
        <motion.div
          initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}
          className="bg-white rounded-xl px-5 pt-6 pb-6" style={{ boxShadow: "0 1px 4px rgba(0,0,0,0.04)" }}
        >
          {/* 双列 */}
          <div className="flex items-center">
            <div className="flex-1 text-center">
              <span className="text-[11px] text-[#86868B]">昨晚入睡</span>
              <div className="mt-1 text-[26px] font-bold tabular-nums text-[#1D1D1F]">
                {todaySleepLog ? todaySleepLog.actualTime : "--:--"}
              </div>
            </div>
            <div className="w-px h-[51px] self-center bg-[#EBEBEB]" />
            <div className="flex-1 text-center">
              <span className="text-[11px] text-[#86868B]">目标入睡</span>
              <div className="mt-1 text-[26px] font-bold tabular-nums text-[#D2D2D7]">{targetTime}</div>
            </div>
          </div>

          {/* 标尺 */}
          <div className="mt-6 relative h-[6px] rounded-full w-full bg-[#EBEBED]">
            {/* 右段（浅靛） */}
            <div className="absolute rounded-full h-full bg-[#EEF0FF]"
              style={{ left: `${targetPct}%`, right: 0 }} />
            {/* 目标虚线 */}
            <div className="absolute top-1/2 -translate-y-1/2"
              style={{ left: `${targetPct}%`, transform: "translate(-50%, -50%)" }}>
              <div style={{ width: 1, height: 24, backgroundImage: `repeating-linear-gradient(to bottom, ${ACCENT} 0, ${ACCENT} 4px, transparent 4px, transparent 8px)` }} />
            </div>
            {/* 实际圆点 */}
            {actualNorm != null && (
              <motion.div
                initial={false}
                animate={{ left: `${actualPct}%` }}
                transition={{ duration: 0.4, ease: "easeOut" }}
                className="absolute top-1/2 -translate-x-1/2 -translate-y-1/2 w-3 h-3 rounded-full bg-[#6366F1] ring-[3px] ring-white z-10"
              />
            )}
          </div>

          {/* 刻度 */}
          <div className="mt-2 flex justify-between text-[13px] text-[#AEAEB2]">
            <span>{denormalizeDisplay(rulerStartNorm)}</span>
            <span>{denormalizeDisplay(rulerEndNorm)}</span>
          </div>

          {/* 状态 */}
          <div className="mt-4 text-center text-[13px] text-[#86868B]">
            {diffText}
          </div>

          {/* 无记录态按钮 */}
          {!todaySleepLog && (
            <button type="button" onClick={handleLogSleep} disabled={isSaving}
              className="mt-3 w-full h-11 rounded-full text-[15px] font-semibold text-white bg-[#6366F1] disabled:opacity-60">
              {isSaving ? "记录中…" : "记录入睡时间"}
            </button>
          )}
        </motion.div>

        {/* ===== 卡片 2 · 连续达标 ===== */}
        <motion.div
          initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.05 }}
          className="bg-white rounded-xl px-5 pt-6 pb-6" style={{ boxShadow: "0 1px 4px rgba(0,0,0,0.04)" }}
        >
          <div className="text-center">
            <span className="text-[17px] font-bold text-[#1D1D1F]">连续 {consecutiveDays} 天达成目标</span>
            <div className="mt-1 text-[13px] text-[#86868B]">
              {consecutiveDays > 0 ? "保持好习惯" : "从今天开始吧"}
            </div>
          </div>
          <div className="mt-5 flex justify-center gap-2">
            {weekCircles.map((c, i) => (
              <div key={i}
                className="w-6 h-6 rounded-full flex items-center justify-center text-[12px]"
                style={{
                  background: c.state === "hit" ? ACCENT : c.state === "empty" ? "white" : TRACK,
                  color: c.state === "hit" ? "white" : c.state === "empty" ? ACCENT : FAINT,
                  border: c.state === "empty" ? `2px solid ${ACCENT}` : undefined,
                }}
              >{c.label}</div>
            ))}
          </div>
        </motion.div>

        {/* ===== 卡片 3 · 入睡目标 ===== */}
        <motion.div
          initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="bg-white rounded-xl px-5 pt-6 pb-6" style={{ boxShadow: "0 1px 4px rgba(0,0,0,0.04)" }}
        >
          <h2 className="text-[18px] font-bold text-[#1D1D1F]">入睡目标</h2>

          {/* 步进行 */}
          <div className="mt-5 flex items-center justify-center gap-8">
            <button type="button" onClick={() => handleGoalStep(-5)}
              className="w-8 h-8 rounded-full border-2 border-[#6366F1] bg-white flex items-center justify-center">
              <Minus className="w-4 h-4 text-[#6366F1]" />
            </button>
            <span className="text-[34px] font-bold tabular-nums text-[#1D1D1F]">{targetTime}</span>
            <button type="button" onClick={() => handleGoalStep(5)}
              className="w-8 h-8 rounded-full border-2 border-[#6366F1] bg-white flex items-center justify-center">
              <Plus className="w-4 h-4 text-[#6366F1]" />
            </button>
          </div>

          {/* 提醒开关 */}
          <div className="mt-6 flex items-center justify-between">
            <span className="text-[13px] text-[#86868B]">提醒提前量</span>
            <ToggleSwitch checked={reminderEnabled}
              onChange={() => updateSleepGoalV2({ reminderEnabled: !reminderEnabled })} />
          </div>

          {/* 胶囊行 */}
          <div className="mt-3 flex gap-2" style={{ opacity: reminderEnabled ? 1 : 0.5, pointerEvents: reminderEnabled ? "auto" : "none" }}>
            {[15, 30, 45, 60].map((v) => {
              const active = reminderAdvance === v;
              return (
                <button key={v} type="button"
                  onClick={() => updateSleepGoalV2({ reminderAdvance: v })}
                  className="flex-1 h-9 rounded-full text-[13px]"
                  style={{
                    background: active ? SOFT : PILL_BG,
                    color: active ? ACCENT : MUTED,
                    fontWeight: active ? 500 : 400,
                  }}>
                  {v === 60 ? "1小时" : `${v}分钟`}
                </button>
              );
            })}
          </div>
        </motion.div>

        {/* ===== 卡片 4 · 30天趋势 ===== */}
        <motion.div
          initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.15 }}
          className="bg-white rounded-xl px-5 pt-6 pb-6" style={{ boxShadow: "0 1px 4px rgba(0,0,0,0.04)" }}
        >
          <h2 className="text-[18px] font-bold text-[#1D1D1F]">30 天趋势</h2>
          <div className="mt-6 flex">
            {/* Y轴 */}
            <div className="flex flex-col justify-between items-end pr-2 w-7" style={{ height: 135 }}>
              {[trendYLabels[0], denormalizeDisplay(targetNorm), trendYLabels[2]].map((v) => (
                <span key={v} className="text-[11px] leading-none"
                  style={{ color: v === denormalizeDisplay(targetNorm) ? ACCENT : FAINT }}>{v}</span>
              ))}
            </div>
            {/* 绘图区 */}
            <div className="flex-1 relative" style={{ height: 135 }}>
              {/* 目标虚线 */}
              <div className="absolute left-0 right-0 border-t border-dashed border-[#CDD1FC]"
                style={{ top: `${40}%` }} />
              {trendData.filter(p => p.normMin !== null).length > 0 ? (
                <svg className="absolute inset-0 w-full h-full" preserveAspectRatio="none" viewBox="0 0 300 135">
                  {/* 折线 */}
                  {(() => {
                    const valids = trendData.filter(p => p.normMin !== null);
                    if (valids.length === 0) return null;
                    const xStep = 300 / 29;
                    const points = valids.map((p) => {
                      const idx = trendData.indexOf(p);
                      const x = idx * xStep;
                      const y = 135 - ((p.normMin! - trendWindowStart) / (trendWindowEnd - trendWindowStart)) * 135;
                      return `${x},${Math.max(0, Math.min(135, y))}`;
                    }).join(" ");
                    return <polyline points={points} fill="none" stroke={LINE_SOFT} strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" />;
                  })()}
                  {/* 数据点 */}
                  {trendData.filter(p => p.normMin !== null).map((p) => {
                    const idx = trendData.indexOf(p);
                    const x = (idx / 29) * 300;
                    const y = 135 - ((p.normMin! - trendWindowStart) / (trendWindowEnd - trendWindowStart)) * 135;
                    return <circle key={idx} cx={x} cy={Math.max(0, Math.min(135, y))} r={2.5} fill={ACCENT} />;
                  })}
                </svg>
              ) : (
                <div className="flex items-center justify-center h-full">
                  <span className="text-[13px] text-[#AEAEB2]">暂无数据</span>
                </div>
              )}
            </div>
          </div>
          {/* X轴 */}
          <div className="mt-1 flex justify-between text-[12px] text-[#AEAEB2]">
            <span>{trendData[0]?.label}</span>
            <span>{trendData[14]?.label}</span>
            <span>{trendData[29]?.label}</span>
          </div>
        </motion.div>

        {/* ===== 底部 · 手动校准 ===== */}
        <div className="mt-2 flex items-center justify-between px-1 py-3 cursor-pointer"
          onClick={() => setCalibrateOpen(true)}>
          <span className="text-[17px] text-[#AEAEB2]">手动校准</span>
          <ChevronRight className="w-5 h-5 text-[#AEAEB2]" />
        </div>

        {/* ===== 校准弹层 ===== */}
        <AnimatePresence>
          {calibrateOpen && (
            <>
              <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                className="fixed inset-0 z-50 bg-black/30" onClick={() => setCalibrateOpen(false)} />
              <motion.div
                initial={{ y: "100%" }} animate={{ y: 0 }} exit={{ y: "100%" }}
                transition={{ duration: 0.4, ease: [0.32, 0.72, 0, 1] }}
                className="fixed left-1/2 bottom-0 w-full max-w-[430px] bg-white z-[60] -translate-x-1/2 rounded-t-[16px] p-5"
                style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
              >
                <h3 className="text-[17px] font-semibold text-[#1D1D1F]">手动校准入睡时间</h3>
                <p className="mt-1 text-[13px] text-[#86868B]">若某天未能准确记录实际入睡时间，可在此手动校准。</p>
                <div className="mt-4 flex flex-col gap-1.5">
                  <span className="text-[13px] text-[#86868B]">日期</span>
                  <input type="date" value={calDate} onChange={(e) => setCalDate(e.target.value)} max={localTodayStr()}
                    className="w-full h-10 rounded-[10px] px-3 text-[15px] border-0 outline-none bg-[#F5F5F7] text-[#1D1D1F]" />
                </div>
                <div className="mt-4 flex flex-col gap-1.5">
                  <span className="text-[13px] text-[#86868B]">入睡时间</span>
                  <input type="time" value={calTime} onChange={(e) => setCalTime(e.target.value)}
                    className="w-full h-10 rounded-[10px] px-3 text-[15px] border-0 outline-none bg-[#F5F5F7] text-[#1D1D1F]" />
                </div>
                <button type="button" onClick={handleCalibrate} disabled={isSaving}
                  className="mt-4 w-full h-11 rounded-full text-[15px] font-semibold text-white bg-[#6366F1] disabled:opacity-60">
                  {isSaving ? "保存中…" : "保存校准"}
                </button>
              </motion.div>
            </>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
