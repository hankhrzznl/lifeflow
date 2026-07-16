// ============================================================
// 目标拆解引擎 — SnapshotService
// 自动/手动快照 + 历史对比
// ============================================================

import { engineDB } from './db';
import type { EngineProgressSnapshot, EngineSnapshotType } from './types';
import { dailyAtomService } from './DailyAtomService';

// ============================================================
// 辅助
// ============================================================

function getISOWeekNumber(date: Date): number {
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  const dayNum = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  return Math.ceil(((d.getTime() - yearStart.getTime()) / 86400000 + 1) / 7);
}

function addDays(dateStr: string, days: number): string {
  const d = new Date(dateStr + 'T00:00:00');
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
}

// ============================================================
// Service
// ============================================================

export class SnapshotService {
  /**
   * 为所有活跃目标创建周快照
   */
  async createWeeklySnapshot(): Promise<number> {
    const now = new Date();
    const year = now.getFullYear();
    const weekNumber = getISOWeekNumber(now);
    const today = now.toISOString().slice(0, 10);
    const weekStart = (() => {
      const d = new Date(now);
      d.setDate(d.getDate() - ((d.getDay() + 6) % 7));
      return d.toISOString().slice(0, 10);
    })();
    const weekEnd = addDays(weekStart, 6);

    const goals = await engineDB.goals.toArray();
    let count = 0;

    await engineDB.transaction('rw', [engineDB.progressSnapshots], async () => {
      for (const goal of goals) {
        // 本周统计
        const weekAtoms = await dailyAtomService.listByDateRange(weekStart, weekEnd);
        const goalMsIds = (await engineDB.milestones.where('goalId').equals(goal.id).toArray())
          .map((m) => m.id);
        const goalWtIds: string[] = [];
        for (const msId of goalMsIds) {
          const wts = await engineDB.weeklyTasks.where('milestoneId').equals(msId).toArray();
          goalWtIds.push(...wts.map((t) => t.id));
        }
        const goalAtoms = weekAtoms.filter((a) => goalWtIds.includes(a.weeklyTaskId));
        const completedAtoms = goalAtoms.filter((a) => a.isCompleted).length;

        const id = `snap_${goal.id}_${year}w${weekNumber}`;

        // 幂等：已存在则跳过
        const existing = await engineDB.progressSnapshots.get(id);
        if (existing) continue;

        await engineDB.progressSnapshots.add({
          id,
          goalId: goal.id,
          year, weekNumber,
          progress: goal.progress,
          totalAtoms: goalAtoms.length,
          completedAtoms,
          snapshotDate: now.toISOString(),
          type: 'weekly',
        });
        count++;
      }
    });

    return count;
  }

  /**
   * 手动触发快照
   */
  async createManualSnapshot(goalId: string): Promise<string> {
    const goal = await engineDB.goals.get(goalId);
    if (!goal) throw new Error('目标不存在');

    const now = new Date();
    const id = `snap_${goalId}_manual_${now.getTime()}`;

    await engineDB.progressSnapshots.add({
      id,
      goalId,
      year: now.getFullYear(),
      weekNumber: getISOWeekNumber(now),
      progress: goal.progress,
      totalAtoms: 0,
      completedAtoms: 0,
      snapshotDate: now.toISOString(),
      type: 'manual',
    });

    return id;
  }

  /**
   * 里程碑完成后创建快照
   */
  async createMilestoneSnapshot(goalId: string): Promise<string> {
    const goal = await engineDB.goals.get(goalId);
    if (!goal) throw new Error('目标不存在');

    const now = new Date();
    const id = `snap_${goalId}_ms_${now.getTime()}`;

    await engineDB.progressSnapshots.add({
      id,
      goalId,
      year: now.getFullYear(),
      weekNumber: getISOWeekNumber(now),
      progress: goal.progress,
      totalAtoms: 0,
      completedAtoms: 0,
      snapshotDate: now.toISOString(),
      type: 'milestone',
    });

    return id;
  }

  /**
   * 获取指定目标的历史快照列表
   */
  async getHistory(goalId: string): Promise<EngineProgressSnapshot[]> {
    return engineDB.progressSnapshots
      .where('goalId').equals(goalId)
      .reverse()
      .sortBy('snapshotDate');
  }

  /**
   * 获取最近 N 个快照（跨目标聚合）
   */
  async getRecentSnapshots(limit: number = 10): Promise<EngineProgressSnapshot[]> {
    const all = await engineDB.progressSnapshots.toArray();
    return all
      .sort((a, b) => b.snapshotDate.localeCompare(a.snapshotDate))
      .slice(0, limit);
  }

  /**
   * 检查是否需要创建周快照（周日 23:59）
   */
  shouldTakeWeeklySnapshot(): boolean {
    const now = new Date();
    return now.getDay() === 0 && now.getHours() === 23 && now.getMinutes() === 59;
  }
}

export const snapshotService = new SnapshotService();
