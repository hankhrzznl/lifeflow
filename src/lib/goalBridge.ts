// ============================================================
// 目标→打卡联动桥接层
// 桥接 GoalEngine DB（四级拆解）与主 LifeFlowDB（打卡/任务）
//
// 设计思路：
// - 原子项完成 → 在主 DB 创建打卡记录 → 写入 checkInId 回原子项
// - 不创建双向同步（避免死循环），以 GoalEngine 为单一事实源
// - 复盘页通过 goalBridge 查询目标相关的打卡统计
// ============================================================

import { GoalEngine, goalDB } from "@/services/goal-engine";
import { db } from "./db";

/**
 * 原子项完成时，在主 DB 创建对应的打卡记录
 * 
 * @param atomId - 原子项 ID
 * @param actualQuantity - 实际完成量
 * @returns 创建的打卡记录 ID，失败返回 undefined
 */
export async function createCheckInForAtom(
  atomId: string,
  actualQuantity?: number
): Promise<number | undefined> {
  try {
    const atom = await GoalEngine.getDailyAtom(atomId);
    if (!atom) return undefined;

    // 检查是否已有关联打卡记录
    if (atom.checkInId) return undefined;

    const taskId = await db.tasks.add({
      title: atom.title,
      type: "daily",
      status: "done",
      priority: "not-urgent-not-important",
      tags: ["目标执行"],
      startTime: new Date(atom.scheduledDate + "T00:00:00").getTime(),
      endTime: new Date(atom.scheduledDate + "T23:59:59").getTime(),
      createdAt: Date.now(),
      updatedAt: Date.now(),
    });

    // 回写 checkInId 到原子项
    await goalDB.dailyAtoms.update(atomId, { checkInId: String(taskId) });

    return taskId as number;
  } catch (err) {
    console.error("[GoalBridge] 创建打卡记录失败:", err);
    return undefined;
  }
}

/**
 * 原子项取消完成时，清理关联的打卡记录
 */
export async function removeCheckInForAtom(atomId: string): Promise<void> {
  try {
    const atom = await GoalEngine.getDailyAtom(atomId);
    if (!atom?.checkInId) return;

    const taskId = parseInt(atom.checkInId);
    if (!isNaN(taskId)) {
      await db.tasks.delete(taskId);
    }
    await goalDB.dailyAtoms.update(atomId, { checkInId: undefined });
  } catch (err) {
    console.error("[GoalBridge] 清理打卡记录失败:", err);
  }
}

/**
 * 获取今日目标执行相关的打卡统计
 * 用于周复盘页面展示
 */
export async function getTodayGoalCheckInStats(): Promise<{
  totalAtoms: number;
  completedAtoms: number;
  goals: Array<{ title: string; category: string; progress: number; completed: number; total: number }>;
}> {
  const items = await GoalEngine.getTodayAtomsWithContext();
  const completedAtoms = items.filter((i) => i.atom.isCompleted).length;

  // 按目标聚合
  const goalMap = new Map<string, {
    title: string;
    category: string;
    progress: number;
    completed: number;
    total: number;
  }>();

  for (const item of items) {
    const g = item.goal;
    if (!goalMap.has(g.id)) {
      goalMap.set(g.id, {
        title: g.title,
        category: g.category,
        progress: g.progress,
        completed: 0,
        total: 0,
      });
    }
    const entry = goalMap.get(g.id)!;
    entry.total++;
    if (item.atom.isCompleted) entry.completed++;
  }

  return {
    totalAtoms: items.length,
    completedAtoms,
    goals: Array.from(goalMap.values()),
  };
}

/**
 * 获取某周期内的目标打卡数据（用于复盘统计）
 */
export async function getGoalStatsForPeriod(
  startDate: string,
  endDate: string
): Promise<{
  totalAtoms: number;
  completedAtoms: number;
  completionRate: number;
}> {
  const atoms = await GoalEngine.getAtomsByDateRange(startDate, endDate);
  const completed = atoms.filter((a) => a.isCompleted).length;

  return {
    totalAtoms: atoms.length,
    completedAtoms: completed,
    completionRate: atoms.length > 0 ? Math.round((completed / atoms.length) * 100) : 0,
  };
}
