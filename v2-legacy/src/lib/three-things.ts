// ============================================================
// T21-4 今日三件事：每日自动生成「今天最重要的事」+ 手动可调
// - 自动生成：省考今日课时、四级今日内容（来自备考引擎），补手动空位凑 3 行
// - 手动可调：点击 ✎ 编辑文案（编辑后转为手动项）
// - 完成联动：自动项打勾 → 联动完成该考试今日全部未完成课时（驱动备考进度）
// - 存储：localStorage（无 DB 改动，数据不丢）
// ============================================================

import { useCallback, useEffect, useState } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import {
  getExamLessons, getProgressMap, computeTodayTasks, toggleLesson,
  formatTodayTaskSummary, type ExamPlanId,
} from "@/lib/exam-plan";

export const THREE_THINGS_KEY = "lifeflow_three_things";
const THREE_THINGS_COUNT = 3;

export interface ThreeThingItem {
  id: string;
  text: string;
  auto: ExamPlanId | null; // 自动项来源（省考/四级）；手动项为 null
  done: boolean;
}

export interface ThreeThingsStore {
  date: string;
  items: ThreeThingItem[];
}

function todayStrOf(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

/** 从今日任务生成三件事（省考/四级自动项 + 手动空位凑 3 行）——纯函数可测试 */
export function buildItemsFromTasks(tasks: ReturnType<typeof computeTodayTasks>): ThreeThingItem[] {
  const items: ThreeThingItem[] = [];
  const province = tasks.filter((t) => t.planId === "province");
  if (province.length > 0) {
    items.push({ id: "auto-province", text: formatTodayTaskSummary("province", province), auto: "province", done: false });
  }
  const cet4 = tasks.filter((t) => t.planId === "cet4");
  if (cet4.length > 0) {
    items.push({ id: "auto-cet4", text: formatTodayTaskSummary("cet4", cet4), auto: "cet4", done: false });
  }
  while (items.length < THREE_THINGS_COUNT) {
    items.push({ id: `manual-${items.length}`, text: "", auto: null, done: false });
  }
  return items;
}

/** 按当天备考任务自动生成三件事（省考/四级自动项 + 手动空位凑 3 行） */
export async function generateAutoItems(dateStr: string): Promise<ThreeThingItem[]> {
  const lessons = getExamLessons();
  const progress = await getProgressMap();
  const tasks = computeTodayTasks(lessons, progress, dateStr);
  return buildItemsFromTasks(tasks);
}

export function saveThreeThingsStore(store: ThreeThingsStore): void {
  try { localStorage.setItem(THREE_THINGS_KEY, JSON.stringify(store)); } catch { /* ignore */ }
}

/** 读取当天三件事；若当天尚未生成则自动生成并保存 */
export async function loadThreeThingsStore(dateStr: string): Promise<ThreeThingsStore> {
  if (typeof window === "undefined") return { date: dateStr, items: [] };
  try {
    const raw = localStorage.getItem(THREE_THINGS_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as ThreeThingsStore;
      if (parsed.date === dateStr && Array.isArray(parsed.items)) return parsed;
    }
  } catch { /* 损坏则重新生成 */ }
  const items = await generateAutoItems(dateStr);
  const store: ThreeThingsStore = { date: dateStr, items };
  saveThreeThingsStore(store);
  return store;
}

// ─── Hook ────────────────────────────────────────────────────

export interface ThreeThingsState {
  store: ThreeThingsStore | null;
  doneCount: number;
  allDone: boolean;
  toggle: (itemId: string) => Promise<void>;
  updateText: (itemId: string, text: string) => void;
}

export function useThreeThings(): ThreeThingsState {
  const today = todayStrOf();
  const [store, setStore] = useState<ThreeThingsStore | null>(null);
  // 实时进度：自动项打勾联动课时后，进度条/备考页自动刷新
  const progress = useLiveQuery(() => getProgressMap(), [], new Map<string, boolean>());

  useEffect(() => {
    loadThreeThingsStore(today).then(setStore).catch(() => {});
  }, [today]);

  const toggle = useCallback(async (itemId: string) => {
    if (!store) return;
    const item = store.items.find((i) => i.id === itemId);
    if (!item) return;
    const nextDone = !item.done;

    // 自动项完成 → 联动完成该考试今日全部未完成课时（驱动备考进度）
    if (item.auto && nextDone && !item.done) {
      try {
        const lessons = getExamLessons();
        const todayTasks = computeTodayTasks(lessons, progress, today);
        const pending = todayTasks.filter(
          (t) => t.planId === item.auto && t.type === "study" && t.lessonId && !progress.get(t.lessonId),
        );
        for (const t of pending) await toggleLesson(t.lessonId!, true);
      } catch { /* 联动失败不影响三件事本身标记 */ }
    }

    const next: ThreeThingsStore = {
      ...store,
      items: store.items.map((i) => (i.id === itemId ? { ...i, done: nextDone } : i)),
    };
    saveThreeThingsStore(next);
    setStore(next);
  }, [store, today, progress]);

  const updateText = useCallback((itemId: string, text: string) => {
    if (!store) return;
    const trimmed = text.trim();
    const next: ThreeThingsStore = {
      ...store,
      items: store.items.map((i) => (i.id === itemId ? { ...i, text: trimmed, auto: null } : i)),
    };
    saveThreeThingsStore(next);
    setStore(next);
  }, [store]);

  const doneCount = store ? store.items.filter((i) => i.done).length : 0;

  return { store, doneCount, allDone: store ? doneCount === store.items.length && store.items.length > 0 : false, toggle, updateText };
}
