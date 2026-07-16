// ============================================================
// 目标拆解引擎 — ConflictDetector
// 跨目标冲突检测：时间重叠 / 容量超限 / 截止日冲突
// ============================================================

import { engineDB } from './db';
import type { EngineGoal, EngineDailyAtom } from './types';

// ============================================================
// 类型
// ============================================================

export interface TimeOverlap {
  type: 'time_overlap';
  date: string;
  timeWindow: string;
  involvedGoals: Array<{ goalId: string; goalTitle: string }>;
  severity: 'low' | 'medium' | 'high';
  suggestion: string;
}

export interface CapacityOverflow {
  type: 'capacity_overflow';
  date: string;
  metric: 'task_count' | 'quantity';
  current: number;
  limit: number;
  usage: number;
  severity: 'low' | 'medium' | 'high';
  suggestion: string;
}

export interface DeadlineClash {
  type: 'deadline_clash';
  deadline: string;
  daysUntil: number;
  involvedGoals: Array<{ goalId: string; goalTitle: string }>;
  severity: 'low' | 'medium' | 'high';
  suggestion: string;
}

/** 聚合的冲突类型（供 UI 使用） */
export interface Conflict {
  id: string;
  type: 'time_overlap' | 'capacity_overflow' | 'deadline_clash';
  severity: 'low' | 'medium' | 'high';
  description: string;
  involvedGoals: Array<{ goalId: string; goalTitle: string }>;
  suggestion: string;
}

interface AtomWithGoal {
  atom: EngineDailyAtom;
  goalTitle: string;
  goalId?: string;
}

// ============================================================
// 工具
// ============================================================

function toDateStr(d: Date): string {
  return d.toISOString().slice(0, 10);
}

// ============================================================
// ConflictDetector
// ============================================================

export class ConflictDetector {
  /**
   * W10-T1: 检测时间重叠
   * 同一天有多个不同目标的原子项 → 时间冲突
   */
  async detectTimeOverlaps(date?: Date): Promise<TimeOverlap[]> {
    const checkDate = date ?? new Date();
    const dateStr = toDateStr(checkDate);

    const allAtoms = await engineDB.dailyAtoms.toArray();
    const todayAtoms = allAtoms.filter((a) => a.scheduledDate === dateStr && !a.isCompleted);
    if (todayAtoms.length === 0) return [];

    const atomsWithGoals = await this.enrichWithGoalInfo(todayAtoms);
    const overlaps: TimeOverlap[] = [];

    // 按目标分组
    const goalAtoms = new Map<string, AtomWithGoal[]>();
    for (const a of atomsWithGoals) {
      const gid = a.goalId ?? 'unknown';
      if (!goalAtoms.has(gid)) goalAtoms.set(gid, []);
      goalAtoms.get(gid)!.push(a);
    }

    // 超过1个目标在同一天有任务 → 时间重叠
    const validGoals = Array.from(goalAtoms.keys()).filter((g) => g !== 'unknown');
    if (validGoals.length > 1) {
      const involved = validGoals.map((gid) => ({
        goalId: gid,
        goalTitle: goalAtoms.get(gid)![0].goalTitle,
      }));

      overlaps.push({
        type: 'time_overlap',
        date: dateStr,
        timeWindow: '全天',
        involvedGoals: involved,
        severity: todayAtoms.length > 6 ? 'high' : todayAtoms.length > 4 ? 'medium' : 'low',
        suggestion: `${dateStr} 有${involved.length}个目标的任务重叠，建议按优先级分配时段`,
      });
    }

    return overlaps;
  }

  // ==========================================================
  // W10-T2: 容量超限检测
  // ==========================================================

  async detectCapacityOverflow(date?: Date): Promise<CapacityOverflow[]> {
    const checkDate = date ?? new Date();
    const dateStr = toDateStr(checkDate);

    const allAtoms = await engineDB.dailyAtoms.toArray();
    const todayAtoms = allAtoms.filter((a) => a.scheduledDate === dateStr);

    const totalTasks = todayAtoms.length;
    const dailyCapacity = this.getDailyCapacity();
    const overflows: CapacityOverflow[] = [];

    if (totalTasks > dailyCapacity * 1.2) {
      overflows.push({
        type: 'capacity_overflow',
        date: dateStr,
        metric: 'task_count',
        current: totalTasks,
        limit: dailyCapacity,
        usage: Math.round((totalTasks / dailyCapacity) * 100),
        severity: totalTasks > dailyCapacity * 1.5 ? 'high' : 'medium',
        suggestion: `今日安排了${totalTasks}个任务，超过建议量${dailyCapacity}个。建议减少${Math.max(1, totalTasks - dailyCapacity)}个或推迟到明天。`,
      });
    }

    return overflows;
  }

  async getCategoryBreakdown(date?: Date): Promise<Array<{ category: string; count: number; percentage: number }>> {
    const checkDate = date ?? new Date();
    const dateStr = toDateStr(checkDate);
    const allAtoms = await engineDB.dailyAtoms.toArray();
    const todayAtoms = allAtoms.filter((a) => a.scheduledDate === dateStr);

    const categoryCounts = new Map<string, number>();
    const atomsWithGoals = await this.enrichWithGoalInfo(todayAtoms);

    for (const awg of atomsWithGoals) {
      const gid = awg.goalId;
      if (!gid) continue;
      const goal = await engineDB.goals.get(gid);
      const cat = goal?.category ?? 'unknown';
      categoryCounts.set(cat, (categoryCounts.get(cat) ?? 0) + 1);
    }

    const total = todayAtoms.length;
    return Array.from(categoryCounts.entries()).map(([category, count]) => ({
      category, count,
      percentage: total > 0 ? Math.round((count / total) * 100) : 0,
    }));
  }

  private getDailyCapacity(): number {
    if (typeof window === 'undefined') return 8;
    const stored = localStorage.getItem('lf_daily_capacity');
    return stored ? parseInt(stored, 10) : 8;
  }

  // ==========================================================
  // W10-T3: 截止日期冲突
  // ==========================================================

  async detectDeadlineClashes(): Promise<DeadlineClash[]> {
    const now = new Date();
    const todayStr = toDateStr(now);

    const allGoals = await engineDB.goals.toArray();
    const activeGoals = allGoals.filter((g) => g.status === 'active' && g.deadline);

    const clashes: DeadlineClash[] = [];

    // 按截止日期分组
    const deadlineGroups = new Map<string, EngineGoal[]>();
    for (const goal of activeGoals) {
      if (!goal.deadline) continue;
      const group = deadlineGroups.get(goal.deadline) ?? [];
      group.push(goal);
      deadlineGroups.set(goal.deadline, group);
    }

    // 同一天多个目标截止 → 冲突
    for (const [dateKey, group] of deadlineGroups) {
      if (group.length > 1) {
        const deadlineDate = new Date(dateKey + 'T00:00:00');
        const daysUntil = Math.ceil(
          (deadlineDate.getTime() - new Date(todayStr + 'T00:00:00').getTime()) / 86400000
        );
        clashes.push({
          type: 'deadline_clash',
          deadline: dateKey,
          daysUntil: Math.max(0, daysUntil),
          involvedGoals: group.map((g) => ({ goalId: g.id, goalTitle: g.title })),
          severity: daysUntil <= 3 ? 'high' : daysUntil <= 7 ? 'medium' : 'low',
          suggestion: `${dateKey}有${group.length}个目标截止，建议优先处理进度落后的。`,
        });
      }
    }

    // 7天预警
    for (const goal of activeGoals) {
      if (!goal.deadline) continue;
      const deadlineDate = new Date(goal.deadline + 'T00:00:00');
      const daysUntil = Math.ceil(
        (deadlineDate.getTime() - new Date(todayStr + 'T00:00:00').getTime()) / 86400000
      );
      if (daysUntil <= 7 && daysUntil > 0) {
        const incompleteAtoms = await this.countIncompleteAtoms(goal.id);
        const dailyRequired = Math.ceil(incompleteAtoms / daysUntil);
        if (dailyRequired > this.getDailyCapacity() * 0.5) {
          clashes.push({
            type: 'deadline_clash',
            deadline: goal.deadline,
            daysUntil,
            involvedGoals: [{ goalId: goal.id, goalTitle: goal.title }],
            severity: dailyRequired > this.getDailyCapacity() ? 'high' : 'medium',
            suggestion: `"${goal.title}"需在${daysUntil}天内完成${incompleteAtoms}个任务，平均每天${dailyRequired}个。建议增加每日投入或调整截止日期。`,
          });
        }
      }
    }

    return clashes;
  }

  private async countIncompleteAtoms(goalId: string): Promise<number> {
    const milestones = await engineDB.milestones.where('goalId').equals(goalId).toArray();
    const milestoneIds = milestones.map((m) => m.id);
    if (milestoneIds.length === 0) return 0;

    const weeklyTasks = await engineDB.weeklyTasks.where('milestoneId').anyOf(milestoneIds).toArray();
    const weeklyTaskIds = weeklyTasks.map((w) => w.id);
    if (weeklyTaskIds.length === 0) return 0;

    let count = 0;
    for (const wtId of weeklyTaskIds) {
      count += await engineDB.dailyAtoms.where('weeklyTaskId').equals(wtId)
        .filter((a) => !a.isCompleted).count();
    }
    return count;
  }

  // ==========================================================
  // 聚合：全量冲突检测
  // ==========================================================

  async detectAll(): Promise<Conflict[]> {
    const [timeOverlaps, capacityOverflows, deadlineClashes] = await Promise.all([
      this.detectTimeOverlaps(),
      this.detectCapacityOverflow(),
      this.detectDeadlineClashes(),
    ]);

    const conflicts: Conflict[] = [];

    for (const t of timeOverlaps) {
      conflicts.push({
        id: `time_${t.date}`,
        type: 'time_overlap',
        severity: t.severity,
        description: `${t.date} 有${t.involvedGoals.length}个目标的任务重叠`,
        involvedGoals: t.involvedGoals,
        suggestion: t.suggestion,
      });
    }

    for (const c of capacityOverflows) {
      conflicts.push({
        id: `cap_${c.date}`,
        type: 'capacity_overflow',
        severity: c.severity,
        description: `${c.date} 安排了${c.current}个任务，超出建议上限${c.limit}个`,
        involvedGoals: [],
        suggestion: c.suggestion,
      });
    }

    for (const d of deadlineClashes) {
      conflicts.push({
        id: `deadline_${d.deadline}`,
        type: 'deadline_clash',
        severity: d.severity,
        description: `${d.deadline} 有${d.involvedGoals.length}个目标截止${d.daysUntil > 0 ? `(还剩${d.daysUntil}天)` : ''}`,
        involvedGoals: d.involvedGoals,
        suggestion: d.suggestion,
      });
    }

    return conflicts;
  }

  // ==========================================================
  // 辅助
  // ==========================================================

  private async enrichWithGoalInfo(atoms: EngineDailyAtom[]): Promise<AtomWithGoal[]> {
    const wtCache = new Map<string, string>();
    const msCache = new Map<string, string>();
    const gCache = new Map<string, string>();

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
      if (goal) gCache.set(ms.goalId, goal.title);
    }

    return atoms.map((atom) => {
      const msId = wtCache.get(atom.weeklyTaskId);
      const gId = msId ? msCache.get(msId) : undefined;
      const gTitle = gId ? gCache.get(gId) ?? '未知目标' : '未知目标';
      return { atom, goalId: gId, goalTitle: gTitle };
    });
  }
}

export const conflictDetector = new ConflictDetector();
