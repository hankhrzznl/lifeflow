// ============================================================
// 目标拆解引擎 — EvolutionService
// 让目标从"静态拆解"进化为"动态生长"
// 健康度检查 + 批量检测 + 月度/季度回顾 + 冲突检测 + 自动调整
// ============================================================

import { engineDB } from './db';
import { goalService } from './GoalService';
import { dailyAtomService } from './DailyAtomService';
import type { EngineGoal, EngineProgressSnapshot, EngineDailyAtom, EngineSnapshotType } from './types';

// ============================================================
// 类型定义
// ============================================================

export interface HealthReport {
  goalId: string;
  goalTitle: string;
  status: 'green' | 'yellow' | 'red';
  completionRate: number;
  overdueCount: number;
  aheadBehind: number;         // 正=领先天数, 负=落后天数
  trend: 'improving' | 'stable' | 'declining';
  lastWeekRate: number;
  thisWeekRate: number;
  recommendation: string;
}

export interface Conflict {
  type: 'time_overlap' | 'capacity_overflow' | 'deadline_clash';
  description: string;
  severity: 'low' | 'medium' | 'high';
  involvedGoalIds: string[];
  suggestion: string;
}

export interface Adjustment {
  type: 'extend_deadline' | 'reduce_scope' | 'increase_pace' | 'pause_goal';
  targetId: string;
  reason: string;
  currentValue: unknown;
  suggestedValue: unknown;
}

export interface MonthlyReport {
  year: number;
  month: number;
  avgCompletionRate: number;
  totalAtoms: number;
  completedAtoms: number;
  suggestion: 'reduce' | 'maintain' | 'increase';
  adjustmentPercent: number;
  summary: string;
}

export interface QuarterlyReport {
  year: number;
  quarter: number;
  avgCompletionRate: number;
  trend: 'improving' | 'stable' | 'declining';
  goalSnapshots: Array<{
    goalId: string;
    goalTitle: string;
    startProgress: number;
    endProgress: number;
    change: number;
  }>;
  longTermDeviation: 'on_track' | 'slightly_off' | 'off_track';
  summary: string;
}

// ============================================================
// 工具函数
// ============================================================

/** 日期 → ISO date string */
function toDateStr(d: Date): string {
  return d.toISOString().slice(0, 10);
}

/** 获取某周的周一 */
function getMonday(date: Date): Date {
  const d = new Date(date);
  const day = d.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  d.setDate(d.getDate() + diff);
  d.setHours(0, 0, 0, 0);
  return d;
}

/** 计算 weekNumber (ISO) */
function getWeekNumber(d: Date): number {
  const target = new Date(d.valueOf());
  const dayNr = (d.getDay() + 6) % 7;
  target.setDate(target.getDate() - dayNr + 3);
  const firstThursday = new Date(target.getFullYear(), 0, 4);
  const diff = target.getTime() - firstThursday.getTime();
  return 1 + Math.round(diff / (7 * 86400000));
}

// ============================================================
// EvolutionService
// ============================================================

export class EvolutionService {
  // ==========================================================
  // W8-T1: 框架
  // ==========================================================

  /**
   * 检查单个目标的健康度
   */
  async checkGoalHealth(goalId: string): Promise<HealthReport> {
    const goal = await goalService.getById(goalId);
    if (!goal) throw new Error(`Goal not found: ${goalId}`);

    const { thisWeekRate, lastWeekRate } = await this.getWeeklyRates(goalId);
    const overdueCount = await this.countOverdueAtoms(goalId);
    const aheadBehind = await this.calculateAheadBehind(goalId);

    // 判定健康度
    let status: HealthReport['status'];
    if (thisWeekRate >= 80 && overdueCount === 0 && aheadBehind >= 0) {
      status = 'green';
    } else if (thisWeekRate >= 50 && overdueCount <= 3) {
      status = 'yellow';
    } else {
      status = 'red';
    }

    // 判定趋势
    let trend: HealthReport['trend'];
    if (thisWeekRate > lastWeekRate + 10) trend = 'improving';
    else if (thisWeekRate < lastWeekRate - 10) trend = 'declining';
    else trend = 'stable';

    const recommendation = this.generateRecommendation(status, trend, overdueCount, aheadBehind);

    return {
      goalId,
      goalTitle: goal.title,
      status,
      completionRate: goal.progress,
      overdueCount,
      aheadBehind,
      trend,
      lastWeekRate,
      thisWeekRate,
      recommendation,
    };
  }

  // ==========================================================
  // W8-T2: 健康度辅助方法
  // ==========================================================

  /** 获取本周和上周的完成率 */
  private async getWeeklyRates(goalId: string): Promise<{ thisWeekRate: number; lastWeekRate: number }> {
    const now = new Date();
    const thisMonday = getMonday(now);
    const lastMonday = new Date(thisMonday);
    lastMonday.setDate(lastMonday.getDate() - 7);

    const thisWeekEnd = new Date(thisMonday);
    thisWeekEnd.setDate(thisWeekEnd.getDate() + 6);
    const lastWeekEnd = new Date(lastMonday);
    lastWeekEnd.setDate(lastWeekEnd.getDate() + 6);

    // 查询该目标本周的原子项
    const goal = await goalService.getById(goalId);
    if (!goal) return { thisWeekRate: 0, lastWeekRate: 0 };

    // 通过目标 → 里程碑 → 周任务 → 原子项链获取
    const milestones = await engineDB.milestones.where('goalId').equals(goalId).toArray();
    const weeklyTaskIds: string[] = [];
    for (const ms of milestones) {
      const tasks = await engineDB.weeklyTasks.where('milestoneId').equals(ms.id).toArray();
      weeklyTaskIds.push(...tasks.map((t) => t.id));
    }

    if (weeklyTaskIds.length === 0) return { thisWeekRate: 0, lastWeekRate: 0 };

    // 本周
    const thisWeekAtoms = await engineDB.dailyAtoms
      .where('weeklyTaskId')
      .anyOf(weeklyTaskIds)
      .filter((a) => a.scheduledDate >= toDateStr(thisMonday) && a.scheduledDate <= toDateStr(thisWeekEnd))
      .toArray();

    const thisWeekCompleted = thisWeekAtoms.filter((a) => a.isCompleted).length;
    const thisWeekTotal = thisWeekAtoms.length;
    const thisWeekRate = thisWeekTotal > 0 ? Math.round((thisWeekCompleted / thisWeekTotal) * 100) : 0;

    // 上周
    const lastWeekAtoms = await engineDB.dailyAtoms
      .where('weeklyTaskId')
      .anyOf(weeklyTaskIds)
      .filter((a) => a.scheduledDate >= toDateStr(lastMonday) && a.scheduledDate <= toDateStr(lastWeekEnd))
      .toArray();

    const lastWeekCompleted = lastWeekAtoms.filter((a) => a.isCompleted).length;
    const lastWeekTotal = lastWeekAtoms.length;
    const lastWeekRate = lastWeekTotal > 0 ? Math.round((lastWeekCompleted / lastWeekTotal) * 100) : 0;

    return { thisWeekRate, lastWeekRate };
  }

  /** 统计逾期原子项数 */
  private async countOverdueAtoms(goalId: string): Promise<number> {
    const milestones = await engineDB.milestones.where('goalId').equals(goalId).toArray();
    let count = 0;
    for (const ms of milestones) {
      const tasks = await engineDB.weeklyTasks.where('milestoneId').equals(ms.id).toArray();
      for (const task of tasks) {
        const overdue = await engineDB.dailyAtoms
          .where('weeklyTaskId').equals(task.id)
          .filter((a) => a.status === 'overdue' && !a.isCompleted)
          .count();
        count += overdue;
      }
    }
    return count;
  }

  /** 计算 aheadBehind：实际 vs 计划进度的天数差 */
  private async calculateAheadBehind(goalId: string): Promise<number> {
    const goal = await goalService.getById(goalId);
    if (!goal) return 0;

    const now = new Date();
    const today = toDateStr(now);

    // 累计已完成的原子项
    const milestones = await engineDB.milestones.where('goalId').equals(goalId).toArray();
    let completedCount = 0;
    let totalCount = 0;

    for (const ms of milestones) {
      const tasks = await engineDB.weeklyTasks.where('milestoneId').equals(ms.id).toArray();
      for (const task of tasks) {
        const atoms = await engineDB.dailyAtoms.where('weeklyTaskId').equals(task.id).toArray();
        totalCount += atoms.length;
        completedCount += atoms.filter((a) => a.isCompleted).length;
      }
    }

    if (totalCount === 0) return 0;

    // 计划完成率 = 已过天数 / 总天数
    if (!goal.deadline) return 0;
    const deadline = new Date(goal.deadline + 'T00:00:00');
    const createdAt = goal.createdAt ? new Date(goal.createdAt) : new Date();
    createdAt.setHours(0, 0, 0, 0);
    const totalDays = Math.max(1, (deadline.getTime() - createdAt.getTime()) / 86400000);
    const elapsedDays = Math.max(0, (now.getTime() - createdAt.getTime()) / 86400000);
    const plannedProgress = Math.min(100, Math.round((elapsedDays / totalDays) * 100));
    const actualProgress = totalCount > 0 ? Math.round((completedCount / totalCount) * 100) : 0;

    // 领先/落后 = (实际进度 - 计划进度) / 每天应有进度
    const dailyTarget = 100 / totalDays;
    return Math.round((actualProgress - plannedProgress) / dailyTarget);
  }

  /** 生成健康度建议 */
  private generateRecommendation(
    status: HealthReport['status'],
    trend: HealthReport['trend'],
    overdueCount: number,
    aheadBehind: number
  ): string {
    const parts: string[] = [];

    if (status === 'green') {
      parts.push('目标进展顺利，保持当前节奏');
    } else if (status === 'yellow') {
      parts.push('目标需要关注');
      if (overdueCount > 0) parts.push(`有${overdueCount}项逾期待处理`);
      if (aheadBehind < 0) parts.push(`进度落后${Math.abs(aheadBehind)}天`);
      if (trend === 'declining') parts.push('趋势在下滑');
    } else {
      parts.push('目标严重落后，建议立即调整');
      if (overdueCount > 3) parts.push(`大量逾期(${overdueCount}项)`);
      if (aheadBehind < -7) parts.push(`进度落后超${Math.abs(aheadBehind)}天，考虑缩减范围或延长期限`);
    }

    return parts.join('；');
  }

  // ==========================================================
  // W8-T3: 批量健康度检查
  // ==========================================================

  /**
   * 批量检查所有活跃目标的健康度
   * @returns Map<goalId, HealthReport>，red/yellow 排前
   */
  async checkAllGoalsHealth(): Promise<Map<string, HealthReport>> {
    const activeGoals = await goalService.list({ filter: { status: 'active' } });
    const reports = new Map<string, HealthReport>();

    for (const goal of activeGoals) {
      try {
        const report = await this.checkGoalHealth(goal.id);
        reports.set(goal.id, report);
      } catch (err) {
        console.error(`[EvolutionService] 健康度检查失败 (${goal.id}):`, err);
      }
    }

    // 按健康度排序到新 Map（red → yellow → green）
    const sorted = new Map<string, HealthReport>();
    const priority: Array<HealthReport['status']> = ['red', 'yellow', 'green'];
    for (const s of priority) {
      for (const [id, report] of reports) {
        if (report.status === s) sorted.set(id, report);
      }
    }

    return sorted;
  }

  // ==========================================================
  // W8-T4: 月度再规划
  // ==========================================================

  /**
   * 月度再规划：检查上月完成率，生成调整建议
   * 每月1号自动触发
   */
  async monthlyReview(): Promise<MonthlyReport> {
    const now = new Date();
    const year = now.getFullYear();
    const month = now.getMonth(); // 0-based → 上月
    const actualYear = month === 0 ? year - 1 : year;
    const actualMonth = month === 0 ? 12 : month;

    const firstDay = `${actualYear}-${String(actualMonth).padStart(2, '0')}-01`;
    const lastDay = new Date(actualYear, actualMonth, 0);
    const lastDayStr = toDateStr(lastDay);

    // 获取上月所有活跃目标
    const goals = await goalService.list({ filter: { status: 'active' } });
    let totalAtoms = 0;
    let completedAtoms = 0;

    for (const goal of goals) {
      const milestones = await engineDB.milestones.where('goalId').equals(goal.id).toArray();
      for (const ms of milestones) {
        const tasks = await engineDB.weeklyTasks.where('milestoneId').equals(ms.id).toArray();
        for (const task of tasks) {
          const atoms = await engineDB.dailyAtoms
            .where('weeklyTaskId').equals(task.id)
            .filter((a) => a.scheduledDate >= firstDay && a.scheduledDate <= lastDayStr)
            .toArray();
          totalAtoms += atoms.length;
          completedAtoms += atoms.filter((a) => a.isCompleted).length;
        }
      }
    }

    const avgCompletionRate = totalAtoms > 0 ? Math.round((completedAtoms / totalAtoms) * 100) : 0;

    // 判定建议
    let suggestion: MonthlyReport['suggestion'];
    let adjustmentPercent = 0;
    if (avgCompletionRate < 70) {
      suggestion = 'reduce';
      adjustmentPercent = -20;
    } else if (avgCompletionRate > 90) {
      suggestion = 'increase';
      adjustmentPercent = 10;
    } else {
      suggestion = 'maintain';
      adjustmentPercent = 0;
    }

    const summary = suggestion === 'reduce'
      ? `上月完成率${avgCompletionRate}% (< 70%)，建议减少下月任务量20%以回归健康节奏`
      : suggestion === 'increase'
        ? `上月完成率${avgCompletionRate}% (> 90%)，可适当增加10%挑战量`
        : `上月完成率${avgCompletionRate}%，节奏稳定，保持即可`;

    // 保存到快照
    const reportId = `monthly_${actualYear}_${String(actualMonth).padStart(2, '0')}`;
    await engineDB.progressSnapshots.put({
      id: reportId,
      goalId: 'global_monthly',
      year: actualYear,
      weekNumber: actualMonth,
      progress: avgCompletionRate,
      totalAtoms,
      completedAtoms,
      snapshotDate: toDateStr(now),
      type: 'manual',
    });

    console.log(`[EvolutionService] 月度报告 (${actualYear}/${actualMonth}): ${summary}`);
    return { year: actualYear, month: actualMonth, avgCompletionRate, totalAtoms, completedAtoms, suggestion, adjustmentPercent, summary };
  }

  // ==========================================================
  // W8-T5: 季度回顾
  // ==========================================================

  /**
   * 季度回顾：汇总3个月数据，生成趋势报告
   * 每季度第一天自动触发（1/1, 4/1, 7/1, 10/1）
   */
  async quarterlyReview(): Promise<QuarterlyReport> {
    const now = new Date();
    const currentMonth = now.getMonth();
    const currentQuarter = Math.floor(currentMonth / 3) + 1;
    const year = now.getFullYear();

    // 上一季度
    const prevQuarter = currentQuarter === 1 ? 4 : currentQuarter - 1;
    const prevYear = currentQuarter === 1 ? year - 1 : year;
    const quarterStartMonth = (prevQuarter - 1) * 3;

    const firstDay = `${prevYear}-${String(quarterStartMonth + 1).padStart(2, '0')}-01`;
    const lastDayOfQuarter = new Date(prevYear, quarterStartMonth + 3, 0);
    const lastDayStr = toDateStr(lastDayOfQuarter);

    // 获取季度内所有活跃目标的原子项
    const goals = await goalService.list({ filter: { status: 'active' } });
    const goalSnapshots: QuarterlyReport['goalSnapshots'] = [];
    let totalAtoms = 0;
    let completedAtoms = 0;

    for (const goal of goals) {
      const milestones = await engineDB.milestones.where('goalId').equals(goal.id).toArray();
      let gTotal = 0;
      let gCompleted = 0;

      for (const ms of milestones) {
        const tasks = await engineDB.weeklyTasks.where('milestoneId').equals(ms.id).toArray();
        for (const task of tasks) {
          const atoms = await engineDB.dailyAtoms
            .where('weeklyTaskId').equals(task.id)
            .filter((a) => a.scheduledDate >= firstDay && a.scheduledDate <= lastDayStr)
            .toArray();
          gTotal += atoms.length;
          gCompleted += atoms.filter((a) => a.isCompleted).length;
        }
      }

      totalAtoms += gTotal;
      completedAtoms += gCompleted;

      if (gTotal > 0) {
        // 取季度初和季度末的快照对比
        const startSnapshots = await engineDB.progressSnapshots
          .where('goalId').equals(goal.id)
          .filter((s) => s.snapshotDate >= firstDay)
          .sortBy('snapshotDate');

        const endProgress = gTotal > 0 ? Math.round((gCompleted / gTotal) * 100) : goal.progress;
        const startProgress = startSnapshots.length > 0 ? startSnapshots[0].progress : 0;

        goalSnapshots.push({
          goalId: goal.id,
          goalTitle: goal.title,
          startProgress,
          endProgress,
          change: endProgress - startProgress,
        });
      }
    }

    const avgCompletionRate = totalAtoms > 0 ? Math.round((completedAtoms / totalAtoms) * 100) : 0;

    // 趋势判定
    let trend: QuarterlyReport['trend'] = 'stable';
    const totalChange = goalSnapshots.reduce((s, g) => s + g.change, 0);
    if (totalChange > 15) trend = 'improving';
    else if (totalChange < -15) trend = 'declining';

    // 长期目标偏离检查
    let longTermDeviation: QuarterlyReport['longTermDeviation'] = 'on_track';
    const avgChange = goalSnapshots.length > 0 ? totalChange / goalSnapshots.length : 0;
    if (avgChange < -10) longTermDeviation = 'off_track';
    else if (avgChange < -5) longTermDeviation = 'slightly_off';

    const summary = `Q${prevQuarter} 季度完成率${avgCompletionRate}%，${
      trend === 'improving' ? '上升趋势' : trend === 'declining' ? '下降趋势' : '趋于稳定'
    }，长期目标${longTermDeviation === 'on_track' ? '在轨' : longTermDeviation === 'slightly_off' ? '轻微偏离' : '严重偏离'}`;

    // 保存季度快照
    const reportId = `quarterly_${prevYear}_Q${prevQuarter}`;
    await engineDB.progressSnapshots.put({
      id: reportId,
      goalId: 'global_quarterly',
      year: prevYear,
      weekNumber: prevQuarter * 13,
      progress: avgCompletionRate,
      totalAtoms,
      completedAtoms,
      snapshotDate: toDateStr(now),
      type: 'manual',
    });

    console.log(`[EvolutionService] 季度报告 (${prevYear} Q${prevQuarter}): ${summary}`);
    return { year: prevYear, quarter: prevQuarter, avgCompletionRate, trend, goalSnapshots, longTermDeviation, summary };
  }

  // ==========================================================
  // 冲突检测 (框架)
  // ==========================================================

  /**
   * 检测目标冲突（deadline 碰撞 / 容量溢出）
   */
  async detectConflicts(goalId: string): Promise<Conflict[]> {
    const conflicts: Conflict[] = [];
    const goal = await goalService.getById(goalId);
    if (!goal || !goal.deadline) return conflicts;

    const allGoals = await goalService.list({ filter: { status: 'active' } });

    // deadline 冲突检测：同日截止且优先级相同
    for (const other of allGoals) {
      if (other.id === goalId || !other.deadline) continue;
      if (other.deadline === goal.deadline && other.priority === goal.priority) {
        conflicts.push({
          type: 'deadline_clash',
          description: `"${goal.title}" 和 "${other.title}" 截止日期相同 (${goal.deadline})`,
          severity: 'medium',
          involvedGoalIds: [goalId, other.id],
          suggestion: '建议错开截止日期，或对不同目标设定不同优先级',
        });
      }
    }

    return conflicts;
  }

  // ==========================================================
  // 自动调整建议
  // ==========================================================

  /**
   * 为目标生成自动调整建议
   */
  async generateAdjustments(goalId: string): Promise<Adjustment[]> {
    const adjustments: Adjustment[] = [];
    const health = await this.checkGoalHealth(goalId);
    const goal = await goalService.getById(goalId);
    if (!goal) return adjustments;

    if (health.status === 'red') {
      // 大量逾期 → 建议延长期限或暂停
      if (health.overdueCount > 5) {
        adjustments.push({
          type: 'extend_deadline',
          targetId: goalId,
          reason: `当前${health.overdueCount}项逾期，进度落后${Math.abs(health.aheadBehind)}天`,
          currentValue: goal.deadline,
          suggestedValue: '建议延后2周',
        });
      }

      if (health.aheadBehind < -14) {
        adjustments.push({
          type: 'reduce_scope',
          targetId: goalId,
          reason: `进度严重落后超过2周`,
          currentValue: goal.progress,
          suggestedValue: '建议缩减目标范围或降低目标量',
        });
      }
    } else if (health.status === 'yellow') {
      if (health.aheadBehind < 0) {
        adjustments.push({
          type: 'increase_pace',
          targetId: goalId,
          reason: `进度略落后${Math.abs(health.aheadBehind)}天`,
          currentValue: health.overdueCount,
          suggestedValue: '建议本周内补齐逾期任务',
        });
      }
    }

    if (health.trend === 'declining') {
      adjustments.push({
        type: 'increase_pace',
        targetId: goalId,
        reason: '完成率连续下滑',
        currentValue: health.thisWeekRate,
        suggestedValue: '建议检查是否有外部阻碍因素',
      });
    }

    return adjustments;
  }

  // ==========================================================
  // 进度快照
  // ==========================================================

  /**
   * 为目标创建进度快照
   */
  async takeProgressSnapshot(goalId: string, type: EngineSnapshotType): Promise<void> {
    const now = new Date();
    const weekNumber = getWeekNumber(now);
    const year = now.getFullYear();

    const goal = await goalService.getById(goalId);
    if (!goal) return;

    // 统计该目标原子项
    const milestones = await engineDB.milestones.where('goalId').equals(goalId).toArray();
    let totalAtoms = 0;
    let completedAtoms = 0;
    for (const ms of milestones) {
      const tasks = await engineDB.weeklyTasks.where('milestoneId').equals(ms.id).toArray();
      for (const task of tasks) {
        const count = await engineDB.dailyAtoms.where('weeklyTaskId').equals(task.id).count();
        const completed = await engineDB.dailyAtoms
          .where('weeklyTaskId').equals(task.id)
          .filter((a) => a.isCompleted)
          .count();
        totalAtoms += count;
        completedAtoms += completed;
      }
    }

    const snapshotId = `snap_${goalId}_${year}w${weekNumber}`;

    await engineDB.progressSnapshots.put({
      id: snapshotId,
      goalId,
      year,
      weekNumber,
      progress: goal.progress,
      totalAtoms,
      completedAtoms,
      snapshotDate: toDateStr(now),
      type,
    });
  }
}

/** 单例导出 */
export const evolutionService = new EvolutionService();
