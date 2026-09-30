"use client";

// ============================================================
// 今日执行 · 单一数据源
// 首页「今日待办单卡」与目标页「今日焦点」共用同一份合并流：
//   目标日行动（GoalV2 DailyAction，未同步为 Item 的）+ 当日日程待办（Item）
// 勾选在首页/目标页任一处完成，另一处自动联动（乐观更新 + Dexie 实时订阅）。
// 不修改任何数据表结构，仅做读取/完成状态更新。
// ============================================================

import { useCallback, useMemo, useState } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import { getItemsByDate, updateItem, type Item } from "@/lib/db/daylog.db";
import { updateDailyActionV2, goalV2DB } from "@/lib/db/goal-v2.db";
import { recalculateGoalProgress } from "@/lib/goal-v2-engine";
import { showToast } from "@/components/ui/Toast";

export interface TodayAction {
  key: string;
  id: string;
  isGoal: boolean;
  title: string;
  time: string;
  endTime: string;
  isCompleted: boolean;
  color: string;
  sourceId: string;
  sourceType?: string; // 仅 Item 有
  tag?: string;        // 展示用标签（如「省考」「四级」「习惯」）
  /** T22.5：理想日规划项所在块 id（点击跳转定位用） */
  blockId?: string;
}

const SOURCE_TYPE_LABEL: Record<string, string> = {
  task: "任务",
  habit: "习惯",
  course: "课程",
  routine: "作息",
  manual: "手动",
  medication: "吃药",
  fitness: "训练",
  wellness: "养生",
  diet: "饮食",
  water: "饮水",
  goal: "目标",
  ideal: "理想日",
  posture: "拉伸",
};

function todayStr(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

/** 展示标签（自动截短），用于待办流右侧小标签 */
function tagFor(title: string | undefined, fallback: string): string {
  if (!title) return fallback;
  const t = title.replace(/^目标[:：]?\s*/i, "");
  if (t.length <= 4) return t;
  return fallback;
}

export function useTodayExecution() {
  const today = todayStr();

  // ── 当日日程待办（Item 表，唯一事实来源） ──
  const allTodayItems = useLiveQuery(
    () => getItemsByDate(today),
    [today],
    [] as Item[],
  );

  // ── 目标日行动（GoalV2） ──
  const todayGoalActions = useLiveQuery(
    () => goalV2DB.goalV2DailyActions.where("date").equals(today).toArray(),
    [today],
    [],
  );

  // 目标日行动若已同步为日程 Item（sourceType='goal'），从合并流中排除避免重复
  const goalItemIds = useMemo(
    () => new Set((allTodayItems ?? []).map((i) => i.id)),
    [allTodayItems],
  );

  // ── 目标标题映射（用于目标类行动的小标签） ──
  const goals = useLiveQuery(() => goalV2DB.goalV2Goals.toArray(), [], []);
  const goalTitleMap = useMemo(() => {
    const map = new Map<string, string>();
    for (const g of goals ?? []) map.set(g.id, g.title);
    return map;
  }, [goals]);

  // ── 合并流（单一数据源） ──
  const mergedActions = useMemo<TodayAction[]>(() => {
    const goalActs: TodayAction[] = (todayGoalActions ?? [])
      .filter((a) => !a.itemId || !goalItemIds.has(a.itemId))
      .map((a) => ({
        key: `goal-${a.id}`,
        id: a.id,
        isGoal: true,
        title: a.title,
        time: a.time || "09:00",
        endTime: "",
        isCompleted: a.isCompleted,
        color: "#6366F1",
        sourceId: a.id,
        tag: tagFor(goalTitleMap.get(a.goalId), "目标"),
      }));
    const items: TodayAction[] = (allTodayItems ?? []).map((i) => ({
      key: `item-${i.id}`,
      id: i.id!,
      isGoal: false,
      title: i.title,
      time: i.plannedStart,
      endTime: i.plannedEnd,
      isCompleted: i.isCompleted,
      color: i.color,
      sourceId: i.sourceId,
      sourceType: i.sourceType,
      tag: SOURCE_TYPE_LABEL[i.sourceType] ?? "",
      // T22.5：理想日规划项解析块 id（ideal-plan-{blockId}-{feature}）
      blockId: i.sourceType === "ideal" && i.sourceId?.startsWith("ideal-plan-") ? i.sourceId.match(/^ideal-plan-(.+)-([a-z]+)$/)?.[1] : undefined,
    }));
    return [...goalActs, ...items].sort((a, b) =>
      a.isCompleted !== b.isCompleted ? (a.isCompleted ? 1 : -1) : a.time.localeCompare(b.time),
    );
  }, [todayGoalActions, allTodayItems, goalItemIds, goalTitleMap]);

  // ── 未矫正事项 ──
  const uncorrected = useMemo(
    () => (allTodayItems ?? []).filter((i) => i.isCorrected === false && i.isCompleted === false),
    [allTodayItems],
  );

  // ── 勾选切换（乐观更新 + 错误回退；目标来源回写 DailyAction 驱动进度） ──
  const [optimistic, setOptimistic] = useState<Set<string>>(new Set());
  const toggle = useCallback(async (act: TodayAction) => {
    const newState = !act.isCompleted;
    setOptimistic((prev) => { const next = new Set(prev); next.add(act.id); return next; });
    try {
      if (act.isGoal) {
        await updateDailyActionV2(act.id, { isCompleted: newState });
        const da = await goalV2DB.goalV2DailyActions.get(act.id);
        if (da?.goalId) await recalculateGoalProgress(da.goalId);
      } else {
        await updateItem(act.id, { isCompleted: newState });
        if (act.sourceType === "goal" && act.sourceId) {
          await updateDailyActionV2(act.sourceId, { isCompleted: newState });
          const da = await goalV2DB.goalV2DailyActions.get(act.sourceId);
          if (da?.goalId) await recalculateGoalProgress(da.goalId);
        }
        // T22.5：理想日规划项勾选 → 反向回写 userSettings.idealDayPlans（首页→理想日闭环）
        if (act.sourceType === "ideal" && act.sourceId?.startsWith("ideal-plan-") && act.blockId) {
          const m = act.sourceId.match(/^ideal-plan-(.+)-([a-z]+)$/);
          const feature = m?.[2];
          if (feature) {
            const { getIdealDayPlans, saveIdealDayPlans } = await import("@/lib/ideal-day-templates");
            const plans = await getIdealDayPlans(todayStr());
            const next = plans.map((p) =>
              p.blockId === act.blockId && p.feature === feature ? { ...p, isCompleted: newState } : p,
            );
            await saveIdealDayPlans(todayStr(), next);
          }
        }
      }
    } catch {
      setOptimistic((prev) => { const next = new Set(prev); next.delete(act.id); return next; });
      showToast({ type: "error", message: "操作失败，请重试" });
    }
  }, []);

  const isDone = useCallback(
    (act: TodayAction) => act.isCompleted || optimistic.has(act.id),
    [optimistic],
  );

  // ── 完成统计（含乐观更新） ──
  const total = mergedActions.length;
  const done = mergedActions.filter((a) => a.isCompleted || optimistic.has(a.id)).length;

  return { mergedActions, total, done, uncorrected, toggle, isDone };
}
