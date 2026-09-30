// ============================================================
// T21-3 睡前仪式：环境营造提醒 → 倒计时 → 入睡打卡（渐进式目标）
// 纯页面内轮询引导 + localStorage 存储（无 DB 改动，数据不丢）
//
// 机制（GUIDE v2.11+ T21 约定）：
// - 环境营造提醒：目标就寝前 60 分钟（开暖色灯/放手机）
// - 倒计时：目标就寝前 30 分钟
// - 入睡打卡：目标时间后 60 分钟内可打卡，超过记"晚睡"
// - 渐进式目标：从 23:30 起步，连续 7 天达标后提前 30 分钟，
//   直到下限 = 理想日 sleepBedTime（默认 22:30）；禁止一步到位
// ============================================================

import { useCallback, useEffect, useMemo, useState } from "react";
import { getIdealDayConfig } from "@/lib/ideal-day";
import { showToast } from "@/components/ui/Toast";

// ─── 常量 ────────────────────────────────────────────────────

export const RITUAL_KEY = "lifeflow_sleep_ritual";
const RITUAL_DISMISS_KEY = "lifeflow_sleep_ritual_dismiss";
export const RITUAL_START_TARGET = "23:30"; // 渐进式起点（禁止一步到位）
export const RITUAL_STEP_MINUTES = 30;      // 连续达标一周后提前 30 分钟
export const RITUAL_GRACE_MINUTES = 30;     // 达标宽限：目标时间后 30 分钟内算按时
export const RITUAL_WEEK_DAYS = 7;          // 连续达标 7 天 = 提前一周
export const RITUAL_PREPARE_LEAD = 60;      // 环境营造提醒提前 60 分钟
export const RITUAL_COUNTDOWN_LEAD = 30;    // 倒计时提前 30 分钟
export const RITUAL_CHECKIN_WINDOW = 60;    // 打卡窗口：目标后 60 分钟内，超过记晚睡

// ─── 存储结构 ────────────────────────────────────────────────

export interface RitualStore {
  targetBedTime: string;      // 当前阶段就寝目标 "HH:mm"
  consecutiveDays: number;    // 连续达标天数
  lastCheckinDate: string;    // 上次打卡日期 YYYY-MM-DD
  lastCheckinTime: string;    // 上次打卡时间 HH:mm
  lastResult: "onTime" | "late" | null;
}

const DEFAULT_STORE: RitualStore = {
  targetBedTime: RITUAL_START_TARGET,
  consecutiveDays: 0,
  lastCheckinDate: "",
  lastCheckinTime: "",
  lastResult: null,
};

// ─── 基础工具 ────────────────────────────────────────────────

export function ritualTodayStr(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

export function ritualNowTimeStr(): string {
  const d = new Date();
  return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
}

export function ritualTimeToMinutes(time: string): number {
  const [h, m] = time.split(":").map(Number);
  return h * 60 + m;
}

/** "HH:mm" + minutes → "HH:mm"（支持跨天） */
export function ritualAddMinutes(time: string, minutes: number): string {
  const total = ritualTimeToMinutes(time) + minutes;
  const nh = ((Math.floor(total / 60) % 24) + 24) % 24;
  const nm = total % 60;
  return `${String(nh).padStart(2, "0")}:${String(nm).padStart(2, "0")}`;
}

/** dateStr 是否为 today 的昨天 */
export function ritualIsYesterday(dateStr: string, today: string): boolean {
  const d = new Date(dateStr + "T00:00:00");
  d.setDate(d.getDate() + 1);
  const next = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  return next === today;
}

/**
 * 当前时刻相对就寝目标的分钟偏移（正 = 已过目标）。
 * 跨午夜归一化：目标在晚间（≥22:00）而当前是次日凌晨（<5:00）→ 按目标后偏移计算。
 */
export function ritualOffsetFromTarget(nowTime: string, targetBedTime: string): number {
  const nowM = ritualTimeToMinutes(nowTime);
  const targetM = ritualTimeToMinutes(targetBedTime);
  let diff = nowM - targetM;
  if (nowM < 300 && targetM >= 22 * 60) diff += 24 * 60;
  return diff;
}

// ─── 存储读写 ────────────────────────────────────────────────

export function loadRitualStore(): RitualStore {
  if (typeof window === "undefined") return { ...DEFAULT_STORE };
  try {
    const raw = localStorage.getItem(RITUAL_KEY);
    if (!raw) return { ...DEFAULT_STORE };
    const parsed = JSON.parse(raw) as Partial<RitualStore>;
    return { ...DEFAULT_STORE, ...parsed };
  } catch {
    return { ...DEFAULT_STORE };
  }
}

export function saveRitualStore(store: RitualStore): void {
  try { localStorage.setItem(RITUAL_KEY, JSON.stringify(store)); } catch { /* ignore */ }
}

// ─── 入睡打卡（纯函数，可测试） ──────────────────────────────

export interface CheckInOutcome {
  store: RitualStore;
  result: "onTime" | "late";
  advanced: boolean; // 目标是否因连续达标提前
  nextTarget: string | null; // 提前后的新目标
}

/**
 * 执行入睡打卡：
 * - 按时 = 打卡时间 ≤ 目标 + 30min；晚睡 = 超过宽限
 * - 连续达标：昨天也打卡过 → 连续天数 +1；否则重新从 1 计
 * - 晚睡或中断 → 连续清零
 * - 连续 7 天达标 → 目标提前 30 分钟（不低于 floorBedTime），连续清零
 */
export function applyCheckIn(
  store: RitualStore,
  today: string,
  nowTime: string,
  floorBedTime: string,
): CheckInOutcome {
  const targetM = ritualTimeToMinutes(store.targetBedTime);
  const result: "onTime" | "late" = ritualOffsetFromTarget(nowTime, store.targetBedTime) <= RITUAL_GRACE_MINUTES ? "onTime" : "late";

  let consecutive = 0;
  if (result === "onTime") {
    consecutive = store.lastCheckinDate && ritualIsYesterday(store.lastCheckinDate, today)
      ? store.consecutiveDays + 1
      : 1;
  }

  let target = store.targetBedTime;
  let advanced = false;
  let nextTarget: string | null = null;
  if (consecutive >= RITUAL_WEEK_DAYS) {
    const floorM = ritualTimeToMinutes(floorBedTime);
    const candidate = ritualAddMinutes(target, -RITUAL_STEP_MINUTES);
    if (ritualTimeToMinutes(candidate) >= floorM) {
      target = candidate;
      advanced = true;
      nextTarget = candidate;
    } else if (targetM > floorM) {
      target = floorBedTime;
      advanced = true;
      nextTarget = floorBedTime;
    }
    consecutive = 0;
  }

  return {
    store: {
      ...store,
      targetBedTime: target,
      consecutiveDays: consecutive,
      lastCheckinDate: today,
      lastCheckinTime: nowTime,
      lastResult: result,
    },
    result,
    advanced,
    nextTarget,
  };
}

// ─── 仪式阶段 ────────────────────────────────────────────────

export type RitualStage = "idle" | "prepare" | "countdown" | "checkin" | "late" | "done";

export function computeRitualStage(store: RitualStore, today: string, nowTime: string): RitualStage {
  if (store.lastCheckinDate === today) return "done";
  const diff = ritualOffsetFromTarget(nowTime, store.targetBedTime);
  if (diff < -RITUAL_PREPARE_LEAD) return "idle";
  if (diff < -RITUAL_COUNTDOWN_LEAD) return "prepare";
  if (diff < 0) return "countdown";
  if (diff < RITUAL_CHECKIN_WINDOW) return "checkin";
  return "late";
}

// ─── Hook ────────────────────────────────────────────────────

export interface SleepRitualState {
  store: RitualStore;
  stage: RitualStage;
  targetBedTime: string;      // 当前阶段就寝目标
  prepareTime: string;        // 环境营造提醒时间
  countdownTime: string;      // 倒计时时间
  floorBedTime: string;       // 渐进下限（理想日 sleepBedTime）
  lastResult: "onTime" | "late" | null;
  countdownMinutes: number;   // 距目标就寝剩余分钟（prepare/countdown 阶段）
  showPrepareBanner: boolean; // 是否展示环境营造提醒（当天可关闭）
  dismissPrepare: () => void;
  checkIn: () => void;
  /** 渐进进度文案：连续达标 N/7 天 · 下一目标 YY:YY */
  progressLabel: string;
}

export function useSleepRitual(): SleepRitualState {
  const [store, setStore] = useState<RitualStore>(() => loadRitualStore());
  const [nowTime, setNowTime] = useState<string>(() => ritualNowTimeStr());
  const [floorBedTime, setFloorBedTime] = useState<string>("22:30"); // 默认下限，加载配置后覆盖
  const [dismissedDate, setDismissedDate] = useState<string>("");

  // 理想日 sleepBedTime 作为渐进下限（默认 22:30）
  useEffect(() => {
    getIdealDayConfig().then((c) => {
      if (c.sleepBedTime) setFloorBedTime(c.sleepBedTime);
    }).catch(() => {});
  }, []);

  // 每分钟刷新当前时间
  useEffect(() => {
    const t = setInterval(() => setNowTime(ritualNowTimeStr()), 60000);
    return () => clearInterval(t);
  }, []);

  const today = ritualTodayStr();
  const stage = computeRitualStage(store, today, nowTime);
  const targetM = ritualTimeToMinutes(store.targetBedTime);
  const nowM = ritualTimeToMinutes(nowTime);

  // 环境营造提醒当天可关闭
  const dismissedToday = useMemo(() => {
    try { return localStorage.getItem(`${RITUAL_DISMISS_KEY}_${today}`) === "1"; } catch { return false; }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [today, dismissedDate]);
  const showPrepareBanner = stage === "prepare" && !dismissedToday;

  const dismissPrepare = useCallback(() => {
    try { localStorage.setItem(`${RITUAL_DISMISS_KEY}_${today}`, "1"); } catch { /* ignore */ }
    setDismissedDate(today);
  }, [today]);

  const checkIn = useCallback(() => {
    const outcome = applyCheckIn(store, today, nowTime, floorBedTime);
    saveRitualStore(outcome.store);
    setStore(outcome.store);
    if (outcome.advanced && outcome.nextTarget) {
      showToast({ type: "success", message: `🎉 连续 7 天达标，就寝目标提前至 ${outcome.nextTarget}` });
    } else if (outcome.result === "onTime") {
      showToast({ type: "success", message: "入睡打卡成功 ✓ 晚安" });
    } else {
      showToast({ type: "warning", message: "已打卡，但比目标晚了一些，明天加油" });
    }
  }, [store, today, nowTime, floorBedTime]);

  const countdownMinutes = Math.max(0, targetM - nowM);

  // 渐进进度文案
  const progressLabel = useMemo(() => {
    const done = store.consecutiveDays;
    const left = Math.max(0, RITUAL_WEEK_DAYS - done);
    const next = ritualAddMinutes(store.targetBedTime, -RITUAL_STEP_MINUTES);
    const nextLabel = ritualTimeToMinutes(next) >= ritualTimeToMinutes(floorBedTime) ? next : floorBedTime;
    if (done === 0) return `就寝目标 ${store.targetBedTime} · 连续达标 ${RITUAL_WEEK_DAYS} 天提前 30 分钟`;
    return `连续达标 ${done}/${RITUAL_WEEK_DAYS} 天 · 下一目标 ${nextLabel}`;
  }, [store.targetBedTime, store.consecutiveDays, floorBedTime]);

  const prepareTime = ritualAddMinutes(store.targetBedTime, -RITUAL_PREPARE_LEAD);
  const countdownTime = ritualAddMinutes(store.targetBedTime, -RITUAL_COUNTDOWN_LEAD);

  return {
    store,
    stage,
    targetBedTime: store.targetBedTime,
    prepareTime,
    countdownTime,
    floorBedTime,
    lastResult: store.lastCheckinDate === today ? store.lastResult : null,
    countdownMinutes,
    showPrepareBanner,
    dismissPrepare,
    checkIn,
    progressLabel,
  };
}
