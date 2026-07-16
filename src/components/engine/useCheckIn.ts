// ============================================================
// useCheckIn — 打卡流程 Hook
// 封装 markComplete → engineRollupFromAtom → Toast 通知
// ============================================================

import { useState, useCallback } from "react";
import { dailyAtomService } from "@/lib/engine/DailyAtomService";
import {
  engineRollupFromAtom,
  getGoalPrevProgress,
  checkProgressMilestones,
} from "@/lib/engine/EngineRecalculationService";

// ============================================================
// 类型
// ============================================================

export interface CheckInData {
  score?: number;
  actualQuantity?: number;
  note?: string;
  checkInTime?: string;
}

export interface CheckInState {
  loading: boolean;
  error: string | null;
}

export interface MilestoneInfo {
  threshold: number;
  goalId: string;
  goalTitle: string;
}

// ============================================================
// Hook
// ============================================================

export function useCheckIn() {
  const [state, setState] = useState<CheckInState>({ loading: false, error: null });
  const [animatingAtomId, setAnimatingAtomId] = useState<string | null>(null);
  const [milestones, setMilestones] = useState<MilestoneInfo[]>([]);

  /**
   * 执行完整打卡流程
   *
   * 1. 记录回算前目标进度
   * 2. 调用 DailyAtomService.markComplete 写入评分/备注/完成量
   * 3. 触发 engineRollupFromAtom 全链路回算
   * 4. 检查进度阈值成就
   * 5. 播放完成动画
   */
  const checkIn = useCallback(
    async (atomId: string, data: CheckInData): Promise<{
      goalId: string;
      goalProgress: number;
      newMilestones: MilestoneInfo[];
    }> => {
      setState({ loading: true, error: null });
      setMilestones([]);

      try {
        // 1. 先获取当前原子项，用于确定 goalId
        const atom = await dailyAtomService.getById(atomId);
        if (!atom) throw new Error("原子项不存在");

        // 通过 weeklyTask → milestone → goal 获取 goalId
        const { engineDB } = await import("@/lib/engine/db");
        const wt = await engineDB.weeklyTasks.get(atom.weeklyTaskId);
        if (!wt) throw new Error("周任务不存在");

        const ms = await engineDB.milestones.get(wt.milestoneId);
        if (!ms) throw new Error("里程碑不存在");

        const prevProgress = await getGoalPrevProgress(ms.goalId);

        // 2. 标记完成
        await dailyAtomService.markComplete(
          atomId,
          data.actualQuantity,
          data.score,
          data.note,
          data.checkInTime
        );

        // 3. 动画
        setAnimatingAtomId(atomId);
        setTimeout(() => setAnimatingAtomId(null), 2000);

        // 4. 回算
        const result = await engineRollupFromAtom(atomId);

        // 5. 检查进度里程碑
        const hit = checkProgressMilestones(prevProgress, result.goalProgress);
        const newMilestones: MilestoneInfo[] = [];
        if (hit.length > 0) {
          const goal = await engineDB.goals.get(ms.goalId);
          for (const t of hit) {
            newMilestones.push({
              threshold: t,
              goalId: ms.goalId,
              goalTitle: goal?.title ?? "目标",
            });
          }
        }
        setMilestones(newMilestones);

        setState({ loading: false, error: null });
        return {
          goalId: result.goalId,
          goalProgress: result.goalProgress,
          newMilestones,
        };
      } catch (err) {
        const msg = err instanceof Error ? err.message : "打卡失败";
        setState({ loading: false, error: msg });
        throw err;
      }
    },
    []
  );

  const clearError = useCallback(() => {
    setState((s) => ({ ...s, error: null }));
    setMilestones([]);
  }, []);

  return {
    ...state,
    checkIn,
    clearError,
    animatingAtomId,
    milestones,
  };
}
