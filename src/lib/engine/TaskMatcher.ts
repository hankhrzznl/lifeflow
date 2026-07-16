// ============================================================
// 目标拆解引擎 — TaskMatcher
// 任务-时段智能匹配：根据类别自动推荐最佳时段
// ============================================================

import { engineDB } from './db';
import { timeSegmentService, TimeSegmentService } from './TimeSegmentService';
import type { EngineDailyAtom } from './types';

// ============================================================
// 类型
// ============================================================

export interface MatchedTask {
  atomId: string;
  title: string;
  goalTitle: string;
  goalCategory: string;
  isCompleted: boolean;
  quantity?: number;
  actualQuantity?: number;
}

// ============================================================
// TaskMatcher
// ============================================================

export class TaskMatcher {
  /** 类别→推荐时段映射 */
  private static readonly CATEGORY_SEGMENTS: Record<string, string[]> = {
    study:   ['morning', 'evening'],
    fitness: ['afternoon', 'evening'],
    habit:   ['morning', 'evening', 'night'],
    finance: ['evening', 'afternoon'],
    career:  ['morning', 'afternoon'],
    life:    ['afternoon', 'evening'],
    custom:  ['morning', 'afternoon', 'evening'],
  };

  /**
   * 为单个原子项推荐最佳时段
   */
  recommendSegment(goalCategory: string): string {
    const preferred = TaskMatcher.CATEGORY_SEGMENTS[goalCategory] ?? ['morning'];

    for (const segId of preferred) {
      const capacity = timeSegmentService.getSegmentCapacity(segId);
      if (capacity > 0) return segId;
    }

    return this.findMaxCapacitySegment();
  }

  /**
   * 批量匹配一天的所有原子项到时段
   */
  async matchDailyTasks(dateStr: string): Promise<Map<string, MatchedTask[]>> {
    const allAtoms = await engineDB.dailyAtoms.toArray();
    const todayAtoms = allAtoms.filter((a) => a.scheduledDate === dateStr);

    // 获取目标类别
    const atomsWithCategory = await this.enrichAtoms(todayAtoms);

    // 按推荐时段分组
    const matched = new Map<string, MatchedTask[]>();
    for (const seg of TimeSegmentService.SEGMENTS) {
      matched.set(seg.id, []);
    }

    for (const entry of atomsWithCategory) {
      const segId = this.recommendSegment(entry.goalCategory);
      const list = matched.get(segId);
      if (list) {
        list.push({
          atomId: entry.atom.id,
          title: entry.atom.title,
          goalTitle: entry.goalTitle,
          goalCategory: entry.goalCategory,
          isCompleted: entry.atom.isCompleted,
          quantity: entry.atom.quantity,
          actualQuantity: entry.atom.actualQuantity,
        });
      }
    }

    // 按时间排序（未完成在前）
    for (const [, tasks] of matched) {
      tasks.sort((a, b) => (a.isCompleted ? 1 : 0) - (b.isCompleted ? 1 : 0));
    }

    return matched;
  }

  /** 批量富化原子项信息 */
  private async enrichAtoms(atoms: EngineDailyAtom[]): Promise<Array<{
    atom: EngineDailyAtom;
    goalTitle: string;
    goalCategory: string;
  }>> {
    const wtCache = new Map<string, string>();
    const msCache = new Map<string, string>();
    const gCache = new Map<string, { title: string; category: string }>();

    for (const atom of atoms) {
      if (wtCache.has(atom.weeklyTaskId)) continue;
      const wt = await engineDB.weeklyTasks.get(atom.weeklyTaskId);
      if (!wt) continue;
      wtCache.set(atom.weeklyTaskId, wt.milestoneId);

      if (msCache.has(wt.milestoneId)) continue;
      const ms = await engineDB.milestones.get(wt.milestoneId);
      if (!ms) continue;
      msCache.set(wt.milestoneId, ms.goalId);

      if (gCache.has(ms.goalId)) continue;
      const goal = await engineDB.goals.get(ms.goalId);
      if (goal) gCache.set(ms.goalId, { title: goal.title, category: goal.category });
    }

    return atoms.map((atom) => {
      const msId = wtCache.get(atom.weeklyTaskId);
      const gId = msId ? msCache.get(msId) : undefined;
      const gInfo = gId ? gCache.get(gId) : undefined;
      return {
        atom,
        goalTitle: gInfo?.title ?? '未知目标',
        goalCategory: gInfo?.category ?? 'custom',
      };
    });
  }

  /** 找最大容量时段作为 fallback */
  private findMaxCapacitySegment(): string {
    let maxCap = -1;
    let bestSeg = 'morning';
    for (const seg of TimeSegmentService.SEGMENTS) {
      const cap = timeSegmentService.getSegmentCapacity(seg.id);
      if (cap > maxCap) { maxCap = cap; bestSeg = seg.id; }
    }
    return bestSeg;
  }
}

export const taskMatcher = new TaskMatcher();
