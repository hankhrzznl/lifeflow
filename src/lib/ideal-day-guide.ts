// ============================================================
// T19-3 执行引导（理想日）：块前提醒 + 执行意图弹窗 + 娱乐配额超时
// 纯页面内轮询引导，不依赖后台通知调度
// ============================================================

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { Item } from "@/lib/db/daylog.db";
import { getIdealDayConfig } from "@/lib/ideal-day";
import type { IdealDayConfig } from "@/lib/types";
import { showToast } from "@/components/ui/Toast";

const INTENTION_KEY = "lifeflow_ideal_day_intention";

function todayStr(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function nowTimeStr(): string {
  const d = new Date();
  return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
}

function timeToMinutes(time: string): number {
  const [h, m] = time.split(":").map(Number);
  return h * 60 + m;
}

/** 读取某日执行意图（localStorage，无 DB 改动） */
export function getTodayIntention(dateStr: string): string | null {
  if (typeof window === "undefined") return null;
  try { return localStorage.getItem(`${INTENTION_KEY}_${dateStr}`); } catch { return null; }
}

/** 写入某日执行意图 */
export function setTodayIntention(dateStr: string, intention: string): void {
  try { localStorage.setItem(`${INTENTION_KEY}_${dateStr}`, intention); } catch { /* ignore */ }
}

function isDismissed(dateStr: string): boolean {
  if (typeof window === "undefined") return false;
  try { return localStorage.getItem(`${INTENTION_KEY}_${dateStr}_dismissed`) === "1"; } catch { return false; }
}

function dismissIntention(dateStr: string): void {
  try { localStorage.setItem(`${INTENTION_KEY}_${dateStr}_dismissed`, "1"); } catch { /* ignore */ }
}

/** 是否理想日「学习/训练」块（用于块前提醒与横幅） */
function isStudyOrWorkout(item: Item): boolean {
  return item.sourceType === "ideal" && (item.sourceId?.startsWith("ideal-study") || item.sourceId === "ideal-workout");
}

export interface IdealDayGuidance {
  enabled: boolean;
  /** 10 分钟内即将开始的学习/训练块（块前提醒横幅） */
  upcomingBlock: { item: Item; minutesLeft: number } | null;
  /** 自由时间块进行中（娱乐配额可追踪） */
  inLeisureBlock: boolean;
  leisureItem: Item | null;
  /** 是否应弹执行意图弹窗 */
  showIntentionModal: boolean;
  todayIntention: string | null;
  commitIntention: (intention: string) => void;
  dismissIntentionModal: () => void;
  /** 娱乐配额超时（自由块已过结束时间且未完成） */
  leisureOverdue: boolean;
  /** 配额剩余分钟（超时后为负） */
  leisureMinutesLeft: number;
}

export function useIdealDayGuidance(dateStr: string, items: Item[]): IdealDayGuidance {
  const [config, setConfig] = useState<IdealDayConfig | null>(null);
  const [nowTime, setNowTime] = useState<string>(() => nowTimeStr());
  const notifiedRef = useRef<Set<string>>(new Set());

  useEffect(() => {
    getIdealDayConfig().then(setConfig);
  }, []);

  // 每分钟刷新当前时间（块前提醒/配额判定依赖）
  useEffect(() => {
    const t = setInterval(() => setNowTime(nowTimeStr()), 60000);
    return () => clearInterval(t);
  }, []);

  const enabled = config?.enabled ?? false;

  const todayItems = useMemo(() => items.filter((i) => i.date === dateStr), [items, dateStr]);
  const isToday = dateStr === todayStr();
  const nowM = timeToMinutes(nowTime);

  // ── 1) 块前提醒：学习/训练块开始前 10 分钟 toast（每项每天一次） ──
  useEffect(() => {
    if (!enabled || !isToday) return;
    for (const item of todayItems) {
      if (item.isCompleted || !isStudyOrWorkout(item)) continue;
      if (notifiedRef.current.has(item.id)) continue;
      const diff = timeToMinutes(item.plannedStart) - nowM;
      if (diff > 0 && diff <= 10) {
        notifiedRef.current.add(item.id);
        showToast({ type: "info", message: `⏰ ${Math.ceil(diff)} 分钟后开始：${item.title}` });
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enabled, isToday, todayItems, nowTime]);

  // 即将开始横幅（仅 10 分钟内）
  const upcomingBlock = useMemo(() => {
    if (!enabled || !isToday) return null;
    const next = todayItems
      .filter((i) => !i.isCompleted && isStudyOrWorkout(i) && timeToMinutes(i.plannedStart) > nowM)
      .sort((a, b) => a.plannedStart.localeCompare(b.plannedStart))[0];
    if (!next) return null;
    const diff = timeToMinutes(next.plannedStart) - nowM;
    if (diff > 10) return null;
    return { item: next, minutesLeft: diff };
  }, [enabled, isToday, todayItems, nowM]);

  // ── 2) 执行意图弹窗：自由时间块开始后、未提交且未关闭时弹出 ──
  const leisureItem = useMemo<Item | null>(
    () => todayItems.find((i) => i.sourceType === "ideal" && i.sourceId === "ideal-leisure") ?? null,
    [todayItems],
  );
  const quotaTrack = config?.quotaTrackEnabled ?? false;
  const inLeisureBlock = !!leisureItem && quotaTrack && !leisureItem.isCompleted
    && nowM >= timeToMinutes(leisureItem.plannedStart)
    && nowM < timeToMinutes(leisureItem.plannedEnd);

  const todayIntention = isToday ? getTodayIntention(dateStr) : null;
  const showIntentionModal = inLeisureBlock && !todayIntention && !isDismissed(dateStr);

  const commitIntention = useCallback((intention: string) => {
    const v = intention.trim();
    if (v) setTodayIntention(dateStr, v);
  }, [dateStr]);

  const dismissIntentionModal = useCallback(() => {
    dismissIntention(dateStr);
  }, [dateStr]);

  // ── 3) 娱乐配额超时：自由块已过结束时间且未完成 → 飘红 ──
  const leisureOverdue = !!leisureItem && quotaTrack && !leisureItem.isCompleted && nowM >= timeToMinutes(leisureItem.plannedEnd);
  const leisureMinutesLeft = leisureItem ? timeToMinutes(leisureItem.plannedEnd) - nowM : 0;

  return {
    enabled,
    upcomingBlock,
    inLeisureBlock,
    leisureItem,
    showIntentionModal,
    todayIntention,
    commitIntention,
    dismissIntentionModal,
    leisureOverdue,
    leisureMinutesLeft,
  };
}
