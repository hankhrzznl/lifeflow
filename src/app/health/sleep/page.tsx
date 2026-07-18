"use client";

import { useEffect, useState, useCallback, useMemo, useRef } from "react";
import { motion } from "framer-motion";
import {
  ChevronLeft, User, Check, Flame, Moon, ChevronRight,
} from "lucide-react";
import { useRouter } from "next/navigation";
import { useHealthStore } from "@/lib/store/healthStore";
import { getSleepLogs } from "@/lib/db/health.db";
import type { SleepLog, SleepGoalV2 } from "@/lib/db/health.db";
import { showToast } from "@/components/ui/Toast";

// ============================================================
// 设计稿基准: lifeflow-health/pages/sleep.html
// 品牌橙 #FF9500
// ============================================================

const BRAND = "#FF9500";
const BG = "#F2F2F7";
const CARD_BG = "#FFFFFF";
const MUTED = "#8E8E93";
const BORDER = "#E5E5EA";
const SUCCESS = "#34C759";
const INFO = "#007AFF";
const ERROR = "#FF3B30";
const NIGHT_INDIGO = "#5856D6";
const LINK_PURPLE = "#AF52DE";

// ─── 本地时区 todayStr ───────────────────────────────────────

function localTodayStr(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

// ─── 时间工具 ────────────────────────────────────────────────

function timeToMinutes(t: string): number {
  const [h, m] = t.split(":").map(Number);
  return h * 60 + m;
}

function minutesToTime(m: number): string {
  const h = Math.floor(m / 60) % 24;
  const min = m % 60;
  return `${String(h).padStart(2, "0")}:${String(min).padStart(2, "0")}`;
}

/** 跨午夜归一化: <12:00 的加 1440 */
function normalizeMinutes(t: string): number {
  const raw = timeToMinutes(t);
  return raw < 720 ? raw + 1440 : raw;
}

/** 归一化分钟 → 展示 HH:MM（去归一化） */
function denormalizeDisplay(m: number): string {
  const raw = m >= 1440 ? m - 1440 : m;
  const h = Math.floor(raw / 60);
  const min = raw % 60;
  return `${String(h).padStart(2, "0")}:${String(min).padStart(2, "0")}`;
}

/** 差值分钟 → HH:MM 格式 */
function diffToHM(diff: number): string {
  const sign = diff < 0 ? "-" : "+";
  const abs = Math.abs(diff);
  const h = Math.floor(abs / 60);
  const m = abs % 60;
  return `${sign}${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}

/** 目标时间减去提前量 */
function subtractMinutes(time: string, mins: number): string {
  return minutesToTime(timeToMinutes(time) - mins);
}

// ─── 日期列表工具 ────────────────────────────────────────────

function getDateNDaysAgo(n: number): string {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

// ============================================================
// 页面
// ============================================================

export default function SleepPage() {
  const router = useRouter();

  const {
    todaySleepLog,
    sleepGoalV2,
    loadSleepData,
    saveSleepLog,
    updateSleepGoalV2,
  } = useHealthStore();

  // 历史数据（30 天 + 365 天用于连续天数）
  const [allLogs, setAllLogs] = useState<SleepLog[]>([]);
  const hasLoadedStore = useRef(false);
  const [loading, setLoading] = useState(true);

  // 校准
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

  // 也监听 store 变化刷新历史
  useEffect(() => {
    (async () => {
      const logs = await getSleepLogs(365);
      setAllLogs(logs);
    })();
  }, [todaySleepLog]);

  const targetTime = sleepGoalV2.targetTime;
  const targetNorm = normalizeMinutes(targetTime);

  // ─── 卡片 1: 今日达标 ──────────────────────────────────────

  const todayData = useMemo(() => {
    if (!todaySleepLog) return null;
    const actualNorm = normalizeMinutes(todaySleepLog.actualTime);
    const diff = actualNorm - targetNorm; // 负=提前
    return { actualTime: todaySleepLog.actualTime, diff };
  }, [todaySleepLog, targetNorm]);

  const todayStatusColor = todayData
    ? todayData.diff <= 0
      ? SUCCESS
      : todayData.diff <= 60
        ? BRAND
        : ERROR
    : MUTED;

  const todayStatusText = todayData
    ? todayData.diff <= 0
      ? `已达标  比目标早 ${denormalizeDisplay(targetNorm + todayData.diff)}`
    : `比目标晚 ${diffToHM(todayData.diff).replace("+", "")}`
    : "暂无今日记录";

  const todayProgressWidth = todayData
    ? todayData.diff <= 0
      ? 100
      : Math.min(100, Math.round((targetNorm / (targetNorm + todayData.diff)) * 100))
    : 0;

  // ─── 卡片 2: 连续早睡 ──────────────────────────────────────

  const consecutiveDays = useMemo(() => {
    if (allLogs.length === 0) return 0;
    const today = localTodayStr();
    let count = 0;
    // 从今天往回扫
    for (let i = 0; i < 365; i++) {
      const dateStr = getDateNDaysAgo(i);
      if (dateStr > today) continue;
      const log = allLogs.find((l) => l.date === dateStr);
      if (dateStr === today && !log) {
        continue; // 今天无记录，跳过继续看昨天
      }
      if (log && log.isOnTime) {
        count++;
      } else {
        break;
      }
    }
    return count;
  }, [allLogs]);

  // ─── 卡片 3: 入睡目标 ──────────────────────────────────────

  const reminderEnabled = sleepGoalV2.reminderEnabled;
  const reminderAdvance = sleepGoalV2.reminderAdvance;
  const reminderTime = subtractMinutes(targetTime, reminderAdvance);
  const sliderPct = ((reminderAdvance - 5) / (60 - 5)) * 100;

  // ─── 卡片 4: 30 天平均 ─────────────────────────────────────

  const thirtyDayAvg = useMemo(() => {
    const cutoff = getDateNDaysAgo(30);
    const recent = allLogs.filter((l) => l.date >= cutoff);
    if (recent.length === 0) return null;
    const total = recent.reduce((s, l) => s + normalizeMinutes(l.actualTime), 0);
    const avg = Math.round(total / recent.length);
    return { time: denormalizeDisplay(avg), count: recent.length };
  }, [allLogs]);

  // ─── 卡片 5: 7 天趋势 ──────────────────────────────────────

  const trendData = useMemo(() => {
    const points: { date: string; label: string; normMin: number | null }[] = [];
    for (let i = 6; i >= 0; i--) {
      const dateStr = getDateNDaysAgo(i);
      const log = allLogs.find((l) => l.date === dateStr);
      const d = new Date(dateStr);
      points.push({
        date: dateStr,
        label: `${d.getMonth() + 1}/${d.getDate()}`,
        normMin: log ? normalizeMinutes(log.actualTime) : null,
      });
    }
    return points;
  }, [allLogs]);

  const hasTrendData = trendData.some((p) => p.normMin !== null);

  const trendPolyPoints = useMemo(() => {
    const valid = trendData.filter((p) => p.normMin !== null);
    if (valid.length === 0) return "";
    // x 映射: 20, 63, 107, 150, 193, 237, 280
    const xVals = [20, 63, 107, 150, 193, 237, 280];
    return valid.map((p, i) => {
      const idx = trendData.indexOf(p);
      const x = xVals[idx];
      // y: 21:00(1260)→200, 26:00(1560)→0
      const y = 200 - ((p.normMin! - 1260) / 300) * 200;
      return `${x},${y}`;
    }).join(" ");
  }, [trendData]);

  const trendDots = useMemo(() => {
    const xVals = [20, 63, 107, 150, 193, 237, 280];
    return trendData
      .map((p, i) => ({ ...p, x: xVals[i] }))
      .filter((p) => p.normMin !== null)
      .map((p) => ({
        x: p.x,
        y: 200 - ((p.normMin! - 1260) / 300) * 200,
      }));
  }, [trendData]);

  // ─── 操作 ──────────────────────────────────────────────────

  const handleLogSleep = useCallback(async () => {
    const now = new Date();
    const actualTime = `${String(now.getHours()).padStart(2, "0")}:${String(now.getMinutes()).padStart(2, "0")}`;
    const actualNorm = normalizeMinutes(actualTime);
    const diff = actualNorm - targetNorm;
    const isOnTime = diff <= 0;

    setIsSaving(true);
    try {
      await saveSleepLog({
        date: localTodayStr(),
        targetTime,
        actualTime,
        isOnTime,
        minutesDiff: diff,
      });
      showToast({ type: "success", message: "已记录入睡时间" });
    } catch {
      showToast({ type: "error", message: "记录失败" });
    } finally {
      setIsSaving(false);
    }
  }, [saveSleepLog, targetNorm, targetTime]);

  const handleCalibrate = useCallback(async () => {
    const actualNorm = normalizeMinutes(calTime);
    const diff = actualNorm - targetNorm;
    const isOnTime = diff <= 0;

    setIsSaving(true);
    try {
      await saveSleepLog({
        date: calDate,
        targetTime,
        actualTime: calTime,
        isOnTime,
        minutesDiff: diff,
      });
      showToast({ type: "success", message: "校准已保存" });
    } catch {
      showToast({ type: "error", message: "保存失败" });
    } finally {
      setIsSaving(false);
    }
  }, [saveSleepLog, calDate, calTime, targetNorm, targetTime]);

  const handleGoalTimeChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      updateSleepGoalV2({ targetTime: e.target.value });
    },
    [updateSleepGoalV2],
  );

  const handleReminderAdvanceChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      updateSleepGoalV2({ reminderAdvance: Number(e.target.value) });
    },
    [updateSleepGoalV2],
  );

  const toggleReminderEnabled = useCallback(() => {
    updateSleepGoalV2({ reminderEnabled: !reminderEnabled });
  }, [updateSleepGoalV2, reminderEnabled]);

  // ════════════════════════════════════════════════════════════

  return (
    <div>
      {/* ===== Slider CSS ===== */}
      <style>{`
        .slider-custom::-webkit-slider-thumb {
          -webkit-appearance: none; appearance: none;
          width: 24px; height: 24px; border-radius: 50%;
          background: #FFFFFF;
          box-shadow: 0 1px 4px rgba(0,0,0,0.12);
          border: 0.5px solid rgba(0,0,0,0.08);
          cursor: pointer;
        }
        .slider-custom::-moz-range-thumb {
          width: 24px; height: 24px; border-radius: 50%;
          background: #FFFFFF;
          box-shadow: 0 1px 4px rgba(0,0,0,0.12);
          border: 0.5px solid rgba(0,0,0,0.08);
          cursor: pointer;
        }
        .slider-custom:focus-visible { outline: none; }
        .slider-custom:focus-visible::-webkit-slider-thumb {
          box-shadow: 0 0 0 3px rgba(255,149,0,0.25), 0 1px 4px rgba(0,0,0,0.12);
        }
      `}</style>

      {/* ===== 页头 91px sticky ===== */}
      <header
        className="sticky top-0 z-20 bg-white border-b"
        style={{ borderColor: BORDER }}
      >
        <div className="flex flex-col justify-center" style={{ height: 91 }}>
          <div className="flex items-center gap-1 px-4">
            <button
              type="button"
              onClick={() => router.push("/health")}
              className="inline-flex items-center justify-center w-8 h-8 -ml-1 shrink-0"
              aria-label="返回"
            >
              <ChevronLeft className="w-6 h-6" style={{ color: "#000000" }} />
            </button>
            <span className="text-[18px] font-semibold truncate" style={{ color: "#000000", textWrap: "balance", wordBreak: "keep-all" }}>
              早睡分析
            </span>
          </div>
          <p className="text-[13px] px-4 mt-0.5 truncate" style={{ color: MUTED }}>
            基于日程校准的入睡时间
          </p>
        </div>
      </header>

      {/* ===== 内容区 ===== */}
      <div className="flex flex-col px-4 pt-3 pb-4" style={{ gap: 12 }}>
        {/* ===== 卡片 1: 今日睡眠达标 ===== */}
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          className="rounded-[12px] border p-4"
          style={{ background: CARD_BG, borderColor: BORDER, borderWidth: 1 }}
        >
          <div className="flex items-center gap-2 mb-3">
            <User className="w-5 h-5" style={{ color: INFO }} />
            <span className="text-[17px] font-semibold truncate" style={{ color: "#000000" }}>
              今日睡眠达标
            </span>
          </div>
          <div className="flex items-center justify-between mb-2">
            <span className="text-[13px]" style={{ color: MUTED }}>目标: {targetTime}</span>
            <span className="text-[13px]" style={{ color: MUTED }}>
              实际: {todaySleepLog ? todaySleepLog.actualTime : "--:--"}
            </span>
          </div>
          <div className="w-full h-2 rounded-full mb-2" style={{ background: BORDER }}>
            <div
              className="h-full rounded-full"
              style={{
                width: `${todayProgressWidth}%`,
                background: todayStatusColor,
                transition: "width 0.5s",
              }}
            />
          </div>
          {todaySleepLog ? (
            <div className="flex items-center gap-1">
              {todayData && todayData.diff <= 0 && (
                <Check className="w-3.5 h-3.5 shrink-0" style={{ color: SUCCESS }} />
              )}
              <span className="text-[13px] truncate" style={{ color: todayStatusColor }}>
                {todayStatusText}
              </span>
            </div>
          ) : (
            <div className="mt-1">
              <p className="text-[13px] mb-3" style={{ color: MUTED }}>暂无今日记录</p>
              <button
                type="button"
                onClick={handleLogSleep}
                disabled={isSaving}
                className="w-full h-11 rounded-[20px] text-[17px] font-semibold text-white"
                style={{ background: BRAND, opacity: isSaving ? 0.6 : 1 }}
              >
                {isSaving ? "记录中..." : "记录入睡时间"}
              </button>
            </div>
          )}
        </motion.div>

        {/* ===== 卡片 2: 连续早睡 ===== */}
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.04 }}
          className="rounded-[12px] border p-4"
          style={{ background: CARD_BG, borderColor: BORDER, borderWidth: 1 }}
        >
          <div className="flex items-center gap-2 mb-3">
            <Flame className="w-5 h-5 shrink-0" style={{ color: BRAND }} />
            <span className="text-[17px] font-semibold truncate" style={{ color: "#000000" }}>
              连续早睡
            </span>
          </div>
          <div className="flex items-baseline mb-1">
            <span
              className="text-[34px] font-bold leading-none"
              style={{ color: BRAND, fontVariantNumeric: "tabular-nums" }}
            >
              {consecutiveDays}
            </span>
            <span className="text-[15px] ml-1" style={{ color: "#000000" }}>天</span>
          </div>
          <p className="text-[13px] truncate" style={{ color: MUTED }}>
            {consecutiveDays > 0
              ? "继续保持，别让链条断掉"
              : "暂无连续早睡记录，从今天开始吧"}
          </p>
        </motion.div>

        {/* ===== 卡片 3: 入睡目标 ===== */}
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.08 }}
          className="rounded-[12px] border p-4"
          style={{ background: CARD_BG, borderColor: BORDER, borderWidth: 1 }}
        >
          <div className="flex items-center gap-2 mb-3">
            <Moon className="w-5 h-5 shrink-0" style={{ color: NIGHT_INDIGO }} />
            <span className="text-[17px] font-semibold truncate" style={{ color: "#000000" }}>
              入睡目标
            </span>
            <button
              type="button"
              onClick={toggleReminderEnabled}
              className="shrink-0 text-[12px] rounded-lg px-2 py-0.5 whitespace-nowrap"
              style={{ background: BG, color: MUTED }}
            >
              提醒{reminderEnabled ? "已开" : "已关"}
            </button>
          </div>
          <div className="flex items-center gap-3 mb-3">
            <input
              type="time"
              value={targetTime}
              onChange={handleGoalTimeChange}
              className="text-[15px] font-semibold rounded-lg px-3 py-1.5 shrink-0 whitespace-nowrap border-0 outline-none"
              style={{ background: BG, color: "#000000" }}
            />
            <span className="text-[13px] truncate" style={{ color: MUTED }}>
              提前{reminderAdvance}分钟提醒
            </span>
            <span
              className="text-[15px] shrink-0 ml-auto whitespace-nowrap"
              style={{ color: INFO }}
            >
              提醒时间: {reminderTime}
            </span>
          </div>
          <div className="border-t mb-4" style={{ borderColor: BORDER }} />
          <div className="flex items-center justify-between mb-2">
            <span className="text-[13px]" style={{ color: MUTED }}>提醒提前时长</span>
            <span
              className="text-[15px] whitespace-nowrap"
              style={{ color: "#000000", fontVariantNumeric: "tabular-nums" }}
            >
              {reminderAdvance} 分钟
            </span>
          </div>
          <input
            type="range"
            min={5}
            max={60}
            step={5}
            value={reminderAdvance}
            onChange={handleReminderAdvanceChange}
            className="slider-custom w-full h-1 rounded-full appearance-none cursor-pointer outline-none"
            style={{
              background: `linear-gradient(to right, ${BRAND} 0%, ${BRAND} ${sliderPct}%, ${BORDER} ${sliderPct}%, ${BORDER} 100%)`,
              WebkitAppearance: "none",
            }}
          />
        </motion.div>

        {/* ===== 卡片 4: 30天平均入睡时间 ===== */}
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.12 }}
          className="rounded-[12px] border p-4"
          style={{ background: CARD_BG, borderColor: BORDER, borderWidth: 1 }}
        >
          <div className="flex items-center justify-between mb-2">
            <span className="text-[17px] font-semibold truncate" style={{ color: "#000000" }}>
              30天平均入睡时间
            </span>
          </div>
          <div className="flex items-baseline gap-2">
            <span
              className="text-[28px] font-bold leading-none"
              style={{ color: BRAND, fontVariantNumeric: "tabular-nums" }}
            >
              {thirtyDayAvg ? thirtyDayAvg.time : "--:--"}
            </span>
            <span className="text-[13px]" style={{ color: MUTED }}>
              {thirtyDayAvg ? `${thirtyDayAvg.count} 天数据` : "暂无数据"}
            </span>
          </div>
        </motion.div>

        {/* ===== 卡片 5: 入睡时间趋势 ===== */}
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.16 }}
          className="rounded-[12px] border p-4"
          style={{ background: CARD_BG, borderColor: BORDER, borderWidth: 1 }}
        >
          <span className="text-[17px] font-semibold block mb-3 truncate" style={{ color: "#000000" }}>
            入睡时间趋势（最近7天）
          </span>
          <div className="w-full rounded-lg p-3" style={{ background: BG }}>
            {hasTrendData ? (
              <div className="flex" style={{ height: 200 }}>
                {/* Y 轴 */}
                <div className="flex flex-col justify-between items-end pr-2 shrink-0" style={{ width: 38 }}>
                  {["26:00", "25:00", "00:00", "23:00", "22:00", "21:00"].map((v) => (
                    <span key={v} className="text-[11px] leading-none" style={{ color: MUTED }}>{v}</span>
                  ))}
                </div>
                {/* 图区 */}
                <div className="flex-1 relative min-w-0">
                  <svg className="absolute inset-0 w-full h-full" preserveAspectRatio="none" viewBox="0 0 280 200">
                    {[0, 40, 80, 120, 160, 200].map((y) => (
                      <line key={y} x1={0} y1={y} x2={280} y2={y} stroke={BORDER} strokeWidth={0.5} />
                    ))}
                    {trendPolyPoints && (
                      <polyline
                        points={trendPolyPoints}
                        fill="none" stroke={INFO} strokeWidth={2}
                        strokeLinecap="round" strokeLinejoin="round"
                      />
                    )}
                    {trendDots.map((d, i) => (
                      <circle key={i} cx={d.x} cy={d.y} r={3} fill={INFO} />
                    ))}
                  </svg>
                </div>
              </div>
            ) : (
              <div className="flex items-center justify-center" style={{ height: 200 }}>
                <span className="text-[13px]" style={{ color: MUTED }}>暂无数据</span>
              </div>
            )}
            {/* X 轴 */}
            <div className="text-center mt-1">
              <span className="text-[11px]" style={{ color: MUTED }}>
                {trendData[trendData.length - 1]?.label}
              </span>
            </div>
          </div>
        </motion.div>

        {/* ===== 卡片 6: 手动校准入睡时间 ===== */}
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="rounded-[12px] border p-4"
          style={{ background: CARD_BG, borderColor: BORDER, borderWidth: 1 }}
        >
          <span className="text-[17px] font-semibold block mb-1 truncate" style={{ color: "#000000" }}>
            手动校准入睡时间
          </span>
          <p className="text-[13px] mb-4" style={{ color: MUTED }}>
            若某天日程未能准确反映实际入睡时间，可在此手动校准。
          </p>
          <div className="flex flex-col gap-3 mb-4">
            <div className="flex flex-col gap-1.5">
              <span className="text-[13px]" style={{ color: MUTED }}>日期</span>
              <input
                type="date"
                value={calDate}
                onChange={(e) => setCalDate(e.target.value)}
                max={localTodayStr()}
                className="w-full h-10 rounded-lg px-3 text-[15px] border-0 outline-none"
                style={{ background: BG, color: "#000000" }}
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <span className="text-[13px]" style={{ color: MUTED }}>入睡时间</span>
              <input
                type="time"
                value={calTime}
                onChange={(e) => setCalTime(e.target.value)}
                className="w-full h-10 rounded-lg px-3 text-[15px] border-0 outline-none"
                style={{ background: BG, color: "#000000" }}
              />
            </div>
          </div>
          <button
            type="button"
            onClick={handleCalibrate}
            disabled={isSaving}
            className="w-full h-11 rounded-[20px] text-[17px] font-semibold text-white active:opacity-90 transition-opacity duration-150"
            style={{ background: BRAND, opacity: isSaving ? 0.6 : 1 }}
          >
            {isSaving ? "保存中..." : "保存校准"}
          </button>
        </motion.div>

        {/* ===== 底部链接 ===== */}
        <div className="flex justify-center py-2">
          <button
            type="button"
            onClick={() => showToast({ type: "info", message: "功能开发中" })}
            className="text-[15px] font-medium inline-flex items-center gap-1 transition-opacity duration-150 hover:opacity-80"
            style={{ color: LINK_PURPLE }}
          >
            <span className="truncate">查看完整睡眠作息统计</span>
            <ChevronRight className="w-4 h-4 shrink-0" />
          </button>
        </div>

        {/* ===== 底部导航不实现（由 07 layout 提供） ===== */}
      </div>
    </div>
  );
}
