// ============================================================
// 目标拆解引擎 — 演化引擎服务
// 功能：每周健康度检查 / 月度再规划 / 冲突检测
// ============================================================

import { goalDB } from './schema';
import type {
  Goal,
  Milestone,
  DailyAtom,
  HealthScore,
  HealthStatus,
  AdjustmentSuggestion,
  ConflictReport,
} from '@/types/goal';

// ============================================================
// 辅助函数
// ============================================================

function safeNum(value: number | undefined | null, fallback: number): number {
  if (value == null || isNaN(value) || value < 0) return fallback;
  return value;
}

function getToday(): string {
  return new Date().toISOString().slice(0, 10);
}

function addDays(dateStr: string, days: number): string {
  const d = new Date(dateStr + 'T00:00:00');
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
}

// ============================================================
// 健康度评分
// ============================================================

/**
 * 计算目标健康度评分
 *
 * 算法设计（五维评分）：
 * 1. 完成率得分（40%）：当前进度 → 线性映射到 0-100
 * 2. 逾期率得分（35%）：逾期原子项越少分越高，逾期50%则0分
 * 3. 趋势得分（25%）：本周完成率 vs 上周完成率，改善则加分
 *
 * 状态判定：
 * - ≥70: green（健康）
 * - 40-69: yellow（预警）
 * - <40: red（危险）
 *
 * @param goalId - 目标 ID
 * @returns 健康度评分
 */
export async function checkGoalHealth(goalId: string): Promise<HealthScore> {
  const goal = await goalDB.goals.get(goalId);
  if (!goal) {
    throw new Error(`[Evolution] Goal ${goalId} not found`);
  }

  const today = getToday();
  const sevenDaysAgo = addDays(today, -6);

  // 1. 完成率得分（40% 权重）
  const completionScore = safeNum(goal.progress, 0);

  // 2. 逾期率得分（35% 权重）
  const recentAtoms = await goalDB.dailyAtoms
    .where('scheduledDate')
    .between(sevenDaysAgo, today, true, true)
    .toArray();

  const totalAtoms = recentAtoms.length;
  const overdueAtoms = recentAtoms.filter(
    (a) => !a.isCompleted && a.scheduledDate < today
  ).length;
  const overdueRate = totalAtoms === 0 ? 0 : overdueAtoms / totalAtoms;
  // 逾期率 50% 时得分为 0，公式: max(0, 100 - rate * 200)
  const overdueScore = Math.max(0, 100 - overdueRate * 200);

  // 3. 趋势得分（25% 权重）
  // 本周 vs 上周完成率
  const thisWeekStart = addDays(today, -6);
  const lastWeekStart = addDays(today, -13);
  const lastWeekEnd = addDays(today, -7);

  const thisWeekAtoms = recentAtoms.filter(
    (a) => a.scheduledDate >= thisWeekStart
  );
  const lastWeekAtoms = await goalDB.dailyAtoms
    .where('scheduledDate')
    .between(lastWeekStart, lastWeekEnd, true, true)
    .toArray();

  const thisWeekCompleted = thisWeekAtoms.filter((a) => a.isCompleted).length;
  const thisWeekRate = thisWeekAtoms.length === 0 ? 0 : thisWeekCompleted / thisWeekAtoms.length;
  const lastWeekCompleted = lastWeekAtoms.filter((a) => a.isCompleted).length;
  const lastWeekRate = lastWeekAtoms.length === 0 ? 0 : lastWeekCompleted / lastWeekAtoms.length;

  const trend = (thisWeekRate - lastWeekRate) * 100;
  const trendScore = Math.min(100, Math.max(0, 50 + trend));

  // 综合得分
  const finalScore = Math.round(
    completionScore * 0.4 + overdueScore * 0.35 + trendScore * 0.25
  );

  // 状态判定
  let overallStatus: HealthStatus;
  if (finalScore >= 70) overallStatus = 'green';
  else if (finalScore >= 40) overallStatus = 'yellow';
  else overallStatus = 'red';

  // 更新目标健康度
  await goalDB.goals.update(goalId, {
    healthStatus: overallStatus,
    updatedAt: new Date().toISOString(),
  });

  // 生成评分明细
  const details: string[] = [
    `完成率得分: ${completionScore.toFixed(0)}/100（权重40%）`,
    `逾期率得分: ${overdueScore.toFixed(0)}/100（逾期率 ${(overdueRate * 100).toFixed(1)}%，权重35%）`,
    `趋势得分: ${trendScore.toFixed(0)}/100（本周完成率 ${(thisWeekRate * 100).toFixed(0)}% vs 上周 ${(lastWeekRate * 100).toFixed(0)}%，权重25%）`,
    `综合得分: ${finalScore}/100 → ${overallStatus === 'green' ? '健康' : overallStatus === 'yellow' ? '预警' : '危险'}`,
  ];

  return {
    goalId,
    overallStatus,
    completionScore,
    overdueScore,
    trendScore,
    finalScore,
    details,
  };
}

// ============================================================
// 批处理：所有活跃目标的健康度检查
// ============================================================

/**
 * 对所有活跃目标执行健康度检查
 * 用于每周定时任务（周一凌晨 03:00）
 *
 * @returns 各目标的健康度评分列表
 */
export async function checkAllActiveGoalsHealth(): Promise<HealthScore[]> {
  const activeGoals = await goalDB.goals.where('status').equals('active').toArray();
  const results: HealthScore[] = [];

  for (const goal of activeGoals) {
    try {
      const score = await checkGoalHealth(goal.id);
      results.push(score);
    } catch (err) {
      console.error(`[Evolution] Health check failed for goal ${goal.id}:`, err);
    }
  }

  return results;
}

// ============================================================
// 调整建议生成
// ============================================================

/**
 * 为目标生成优化建议
 *
 * 触发条件：
 * - 健康度 yellow/red 时
 * - 连续逾期 3 天以上
 * - 进度落后计划 20% 以上
 *
 * @param goalId - 目标 ID
 * @returns 调整建议列表（按紧急程度排序）
 */
export async function generateSuggestions(goalId: string): Promise<AdjustmentSuggestion[]> {
  const goal = await goalDB.goals.get(goalId);
  if (!goal) return [];

  const suggestions: AdjustmentSuggestion[] = [];
  const today = getToday();
  const totalDays = Math.max(
    1,
    Math.ceil(
      (new Date(goal.deadline).getTime() - new Date(goal.createdAt).getTime()) /
        (1000 * 60 * 60 * 24)
    )
  );
  const elapsedDays = Math.max(
    1,
    Math.ceil(
      (new Date(today).getTime() - new Date(goal.createdAt).getTime()) /
        (1000 * 60 * 60 * 24)
    )
  );

  // 预期进度 = 已过天数 / 总天数 × 100
  const expectedProgress = Math.min(100, (elapsedDays / totalDays) * 100);
  const lag = expectedProgress - goal.progress;

  // 建议 1：进度落后 > 20%
  if (lag > 20) {
    suggestions.push({
      id: `${goalId}_lag`,
      goalId,
      type: 'milestone_extend',
      title: '进度严重落后',
      description: `当前进度 ${goal.progress}%，预期进度 ${expectedProgress.toFixed(0)}%，落后 ${lag.toFixed(0)}%`,
      urgency: Math.min(100, Math.round(lag * 2)),
      suggestedAction: '建议延后后续里程碑截止日期，或增加每日任务量',
      autoApplicable: false,
    });
  }

  // 建议 2：检查逾期情况
  const activeMilestones = await goalDB.milestones
    .where('goalId')
    .equals(goalId)
    .filter((m) => m.status === 'active' || m.status === 'overdue')
    .toArray();

  for (const ms of activeMilestones) {
    const overdueMS = ms.status === 'overdue';
    const deadlinePassed = new Date(ms.deadline) < new Date(today);

    if (overdueMS || (deadlinePassed && ms.progress < 100)) {
      suggestions.push({
        id: `${goalId}_ms_${ms.id}`,
        goalId,
        type: 'milestone_extend',
        title: `里程碑「${ms.title}」已逾期`,
        description: `原计划截止 ${ms.deadline}，当前进度 ${ms.progress}%`,
        urgency: ms.progress < 50 ? 80 : 50,
        suggestedAction: ms.progress < 50
          ? '建议将里程碑延期1-2周，并增加每周任务量'
          : '距完成不远，建议延期3-5天即可',
        autoApplicable: false,
      });
    }
  }

  // 建议 3：容量超限检测
  const conflictReport = await detectConflicts(goalId);
  if (conflictReport.length > 0) {
    for (const conflict of conflictReport) {
      suggestions.push({
        id: `${goalId}_conflict_${conflict.type}`,
        goalId,
        type: conflict.type === 'capacity_exceed' ? 'granularity_reduce' : 'priority_reorder',
        title: conflict.description,
        description: conflict.suggestedAction,
        urgency: conflict.severity === 'critical' ? 90 : 60,
        suggestedAction: conflict.suggestedAction,
        autoApplicable: conflict.type === 'capacity_exceed',
      });
    }
  }

  // 建议 4：连续逾期检测
  const sevenDaysAgo = addDays(today, -6);
  const recentOverdueAtoms = await goalDB.dailyAtoms
    .where('scheduledDate')
    .between(sevenDaysAgo, today, true, true)
    .filter((a) => !a.isCompleted && a.scheduledDate < today)
    .toArray();

  if (recentOverdueAtoms.length >= 5) {
    suggestions.push({
      id: `${goalId}_overdue`,
      goalId,
      type: 'granularity_reduce',
      title: `近7天有 ${recentOverdueAtoms.length} 项逾期`,
      description: '任务量可能超出当前能力，建议降低每日任务难度',
      urgency: Math.min(100, recentOverdueAtoms.length * 15),
      suggestedAction: '建议将每日任务量减少20%-30%，或将大型任务进一步拆分',
      autoApplicable: true,
    });
  }

  // 按紧急程度排序，最多返回 3 条
  return suggestions
    .sort((a, b) => b.urgency - a.urgency)
    .slice(0, 3);
}

// ============================================================
// 冲突检测
// ============================================================

/**
 * 单目标内的冲突检测
 *
 * 检测维度：
 * 1. 容量超限：某天原子项超过用户负荷上限（默认6项）
 * 2. 截止日期冲突：同一周内多个里程碑到期
 *
 * @param goalId - 目标 ID
 * @returns 冲突报告列表
 */
export async function detectConflicts(goalId: string): Promise<ConflictReport[]> {
  const conflicts: ConflictReport[] = [];
  const today = getToday();
  const sevenDaysLater = addDays(today, 7);

  // 1. 容量超限检测
  const dailyAtoms = await goalDB.dailyAtoms
    .where('scheduledDate')
    .between(today, sevenDaysLater, true, true)
    .toArray();

  // 按日期分组
  const byDate = new Map<string, DailyAtom[]>();
  for (const atom of dailyAtoms) {
    const list = byDate.get(atom.scheduledDate) ?? [];
    list.push(atom);
    byDate.set(atom.scheduledDate, list);
  }

  const MAX_DAILY_LOAD = 6;
  for (const [date, atoms] of byDate) {
    if (atoms.length > MAX_DAILY_LOAD) {
      conflicts.push({
        type: 'capacity_exceed',
        severity: atoms.length > MAX_DAILY_LOAD * 1.3 ? 'critical' : 'warning',
        description: `${date} 有 ${atoms.length} 个任务，超出每日负荷上限 ${MAX_DAILY_LOAD} 个`,
        suggestedAction: '建议将部分任务延期到弹性日或下周',
      });
    }
  }

  // 2. 同一周里程碑截止日期检测
  const milestones = await goalDB.milestones
    .where('goalId')
    .equals(goalId)
    .filter((m) => m.status !== 'completed')
    .toArray();

  const msThisWeek = milestones.filter((m) => {
    const d = new Date(m.deadline + 'T00:00:00');
    const now = new Date(today);
    const weekEnd = new Date(now);
    weekEnd.setDate(now.getDate() + (7 - now.getDay()));
    return d <= weekEnd;
  });

  if (msThisWeek.length >= 2) {
    conflicts.push({
      type: 'deadline_conflict',
      severity: 'warning',
      description: `本周有 ${msThisWeek.length} 个里程碑到期：${msThisWeek.map((m) => m.title).join('、')}`,
      suggestedAction: '建议将非关键里程碑适当延期，避免压力过大',
    });
  }

  return conflicts;
}

// ============================================================
// 进度快照
// ============================================================

/**
 * 为指定目标创建进度快照
 *
 * 触发时机：
 * - 每周日 23:59 自动快照
 * - 里程碑完成时
 * - 用户触发复盘时
 *
 * @param goalId - 目标 ID
 */
export async function createProgressSnapshot(goalId: string): Promise<void> {
  const goal = await goalDB.goals.get(goalId);
  if (!goal) return;

  const today = getToday();
  const { year, week } = getISOWeekNumber(today);

  const sevenDaysAgo = addDays(today, -6);
  const weekAtoms = await goalDB.dailyAtoms
    .where('scheduledDate')
    .between(sevenDaysAgo, today, true, true)
    .toArray();

  const completedAtoms = weekAtoms.filter((a) => a.isCompleted).length;

  const id = `snap_${goalId}_${year}w${week}`;

  await goalDB.progressSnapshots.put({
    id,
    goalId,
    year,
    weekNumber: week,
    progress: goal.progress,
    totalAtoms: weekAtoms.length,
    completedAtoms,
    snapshotDate: new Date().toISOString(),
  });
}

/**
 * 创建所有活跃目标的进度快照
 * 用于每周定时任务
 */
export async function createAllSnapshots(): Promise<number> {
  const activeGoals = await goalDB.goals.where('status').equals('active').toArray();
  let count = 0;

  for (const goal of activeGoals) {
    try {
      await createProgressSnapshot(goal.id);
      count++;
    } catch (err) {
      console.error(`[Evolution] Snapshot failed for goal ${goal.id}:`, err);
    }
  }

  return count;
}

/**
 * 获取某目标的历史进度趋势
 *
 * @param goalId - 目标 ID
 * @param weeks - 回溯周数（默认12周）
 */
export async function getProgressTrend(
  goalId: string,
  weeks: number = 12
): Promise<Array<{ week: number; progress: number; completedAtoms: number }>> {
  const snapshots = await goalDB.progressSnapshots
    .where('goalId')
    .equals(goalId)
    .sortBy('snapshotDate');

  return snapshots.slice(-weeks).map((s) => ({
    week: s.weekNumber,
    progress: s.progress,
    completedAtoms: s.completedAtoms,
  }));
}

// ============================================================
// 辅助
// ============================================================

function getISOWeekNumber(dateStr: string): { year: number; week: number } {
  const d = new Date(dateStr + 'T00:00:00');
  const dayNum = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  const weekNo = Math.ceil(
    ((d.getTime() - yearStart.getTime()) / 86400000 + 1) / 7
  );
  return { year: d.getUTCFullYear(), week: weekNo };
}
