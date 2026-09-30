// ============================================================
// T21-5 坐姿健康：合并 喝水 + 提肛 + 久坐休息 单一功能
// - 坐姿周期提醒（30/45/60 分钟可调）：到点 Notification + Toast
// - 喝水快捷记录（复用 waterLogs / waterGoals，数据不删）
// - 提肛快捷记录（复用 wellnessLogs type=tigang）
// - 完成休息 → 记录打断轮数 + 生成当日「起身活动」日程事项（日程联动）
// 存储：localStorage（坐姿状态）+ 既有 Dexie 表（喝水/提肛流水）
// ============================================================

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import { addWaterCup, getWaterGoal, healthDB } from "@/lib/db/health.db";
import { addWellnessLog, lifeDB } from "@/lib/db/life.db";
import { ensureModuleItem } from "@/lib/db/daylog.db";
import { sendNotification } from "@/lib/notificationService";
import { showToast } from "@/components/ui/Toast";

export const SIT_STATE_KEY = "lifeflow_sit_state";
export const SIT_INTERVALS = [30, 45, 60] as const;
export const SIT_ACTIVE_START_H = 7;   // 提醒时段 07:00
export const SIT_ACTIVE_END_H = 23;    // 提醒时段 23:00
export const SIT_BREAK_MINUTES = 5;    // 起身活动时长（日程事项）

export interface SitState {
  enabled: boolean;
  intervalMin: number; // 30 / 45 / 60
  nextAt: number;      // 下次提醒时间戳
  date: string;        // 记录日期（跨天重置轮数）
  breakCount: number;  // 当日久坐打断轮数
}

const DEFAULT_SIT_STATE: SitState = {
  enabled: false,
  intervalMin: 45,
  nextAt: 0,
  date: "",
  breakCount: 0,
};

// 模块级去重标记：跨实例共享，避免双实例/StrictMode 重复触发同一次提醒
let lastHandledNextAt = 0;

export function sitTodayStr(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

export function loadSitState(): SitState {
  if (typeof window === "undefined") return { ...DEFAULT_SIT_STATE };
  try {
    const raw = localStorage.getItem(SIT_STATE_KEY);
    if (!raw) return { ...DEFAULT_SIT_STATE };
    return { ...DEFAULT_SIT_STATE, ...(JSON.parse(raw) as Partial<SitState>) };
  } catch {
    return { ...DEFAULT_SIT_STATE };
  }
}

export function saveSitState(state: SitState): void {
  try { localStorage.setItem(SIT_STATE_KEY, JSON.stringify(state)); } catch { /* ignore */ }
}

/** 当前时刻是否处于坐姿提醒时段（07:00-23:00） */
export function isActiveHour(now: number): boolean {
  const h = new Date(now).getHours();
  return h >= SIT_ACTIVE_START_H && h < SIT_ACTIVE_END_H;
}

/** 距下次提醒的剩余分钟（未开启返回 null） */
export function minutesUntilNext(state: SitState, now: number): number | null {
  if (!state.enabled || !state.nextAt) return null;
  return Math.max(0, Math.round((state.nextAt - now) / 60000));
}

/** 是否应触发提醒：已开启 + 到点 + 在时段内 */
export function shouldNotifySit(state: SitState, now: number): boolean {
  return state.enabled && now >= state.nextAt && isActiveHour(now);
}

/** 提醒文案 */
export function sitReminderMessage(interval: number): string {
  return `已连续坐 ${interval} 分钟，该起身了：喝口水 + 提肛 10 次`;
}

function timeOf(now: number, offsetMin: number): string {
  const d = new Date(now + offsetMin * 60000);
  return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
}

// ─── Hook ────────────────────────────────────────────────────

export interface PostureHealthState {
  state: SitState;
  enabled: boolean;
  intervalMin: number;
  minutesLeft: number | null;  // 距下次提醒剩余分钟
  inActiveHours: boolean;      // 当前是否在提醒时段
  todayWaterMl: number;
  waterGoalMl: number;
  cupSize: number;
  tigangCountToday: number;
  setEnabled: (v: boolean) => void;
  setInterval: (min: number) => void;
  addWater: () => Promise<void>;
  addTigang: () => Promise<void>;
  /** 完成休息：打断轮数 +1，并生成当日「起身活动」日程事项 */
  completeBreak: () => Promise<void>;
}

export function usePostureHealth(): PostureHealthState {
  const [state, setState] = useState<SitState>(() => loadSitState());
  const [now, setNow] = useState<number>(() => Date.now());

  // 每 30 秒检查提醒（用 window.setInterval 避免被下方同名的间隔设置函数遮蔽）
  useEffect(() => {
    const t = window.setInterval(() => setNow(Date.now()), 30000);
    return () => window.clearInterval(t);
  }, []);

  const today = sitTodayStr();

  // 跨天重置：轮数归零 + 下一周期从当前时间起算
  useEffect(() => {
    if (state.date !== today) {
      const next: SitState = { ...state, date: today, breakCount: 0, nextAt: Date.now() + state.intervalMin * 60000 };
      setState(next);
      saveSitState(next);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [today]);

  // 到点触发提醒（lastHandledNextAt 为模块级去重标记）
  useEffect(() => {
    if (shouldNotifySit(state, now) && lastHandledNextAt !== state.nextAt) {
      lastHandledNextAt = state.nextAt;
      sendNotification("坐姿提醒", sitReminderMessage(state.intervalMin), "sit-reminder");
      // showToast 在 ToastContainer 未注册时会排队补发，故可直接同步调用
      showToast({ type: "info", message: `💺 ${sitReminderMessage(state.intervalMin)}` });
      const next: SitState = { ...state, nextAt: now + state.intervalMin * 60000 };
      setState(next);
      saveSitState(next);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [now, state.enabled, state.nextAt]);

  const goal = useLiveQuery(() => getWaterGoal(), [], null);
  const todayWaterLogs = useLiveQuery(
    () => healthDB.waterLogs.where("date").equals(today).toArray(),
    [today],
    [],
  );
  const todayTigangLogs = useLiveQuery(
    () => lifeDB.wellnessLogs.where("date").equals(today).filter((l) => l.type === "tigang").toArray(),
    [today],
    [],
  );

  const todayWaterMl = useMemo(() => todayWaterLogs.reduce((s, l) => s + (l.amount || 0), 0), [todayWaterLogs]);
  const waterGoalMl = goal?.dailyTarget || 2000;
  const cupSize = goal?.cupSize || 200;

  const setEnabled = useCallback((v: boolean) => {
    const next: SitState = {
      ...loadSitState(),
      enabled: v,
      date: sitTodayStr(),
      nextAt: Date.now() + (loadSitState().intervalMin || 45) * 60000,
    };
    if (v && typeof window !== "undefined" && "Notification" in window && Notification.permission === "default") {
      Notification.requestPermission().catch(() => {});
    }
    saveSitState(next);
    setState(next);
  }, []);

  const setInterval = useCallback((min: number) => {
    const current = loadSitState();
    const next: SitState = { ...current, intervalMin: min, nextAt: Date.now() + min * 60000 };
    saveSitState(next);
    setState(next);
  }, []);

  const addWater = useCallback(async () => {
    try {
      await addWaterCup(today);
      showToast({ type: "success", message: `已记录 ${cupSize}ml` });
    } catch {
      showToast({ type: "error", message: "记录失败，请重试" });
    }
  }, [today, cupSize]);

  const addTigang = useCallback(async () => {
    try {
      await addWellnessLog({ name: "提肛", type: "tigang", date: today });
      showToast({ type: "success", message: "提肛已完成一组 💪" });
    } catch {
      showToast({ type: "error", message: "记录失败，请重试" });
    }
  }, [today]);

  const completeBreak = useCallback(async () => {
    const current = loadSitState();
    const count = current.breakCount + 1;
    const nowTs = Date.now();
    // 日程联动：生成当日 5 分钟「起身活动」事项（每轮一个，sourceId 按轮数去重）
    try {
      await ensureModuleItem({
        date: today,
        sourceType: "posture",
        sourceId: `sit-break-${today}-${count}`,
        title: "🚶 起身活动 · 喝水 + 提肛",
        plannedStart: timeOf(nowTs, 0),
        plannedEnd: timeOf(nowTs, SIT_BREAK_MINUTES),
        color: "#10B981",
        icon: "Footprints",
        isCompleted: false,
      });
    } catch { /* 日程写入失败不阻塞休息记录 */ }
    const next: SitState = { ...current, date: today, breakCount: count, nextAt: nowTs + current.intervalMin * 60000 };
    saveSitState(next);
    setState(next);
    showToast({ type: "success", message: `已休息，今日打断 ${count} 次` });
  }, [today]);

  return {
    state,
    enabled: state.enabled,
    intervalMin: state.intervalMin,
    minutesLeft: minutesUntilNext(state, now),
    inActiveHours: isActiveHour(now),
    todayWaterMl,
    waterGoalMl,
    cupSize,
    tigangCountToday: todayTigangLogs.length,
    setEnabled,
    setInterval,
    addWater,
    addTigang,
    completeBreak,
  };
}
