// ============================================================
// 目标拆解引擎 — ReviewDataService
// PDCA 复盘数据预加载（2秒内完成）
// ============================================================

import { dailyAtomService } from './DailyAtomService';
import { goalService } from './GoalService';
import { milestoneService } from './MilestoneService';
import { weeklyTaskService } from './WeeklyTaskService';
import { engineDB } from './db';
import type { EngineGoal, EngineDailyAtom } from './types';

// ============================================================
// 类型
// ============================================================

export interface ReviewData {
  weekRange: { start: string; end: string };
  completion: { completed: number; total: number; rate: number };
  goalProgress: Array<{
    goalId: string;
    title: string;
    category: string;
    thisWeek: number;
    lastWeek: number;
    change: number;
  }>;
  timeSpent: Record<string, number>;
  insights: {
    bestTime: string;
    bottleneck: string;
    trend: string;
  };
  /** 本周所有原子项，供 Step2/3/4 使用 */
  atomsInWeek: EngineDailyAtom[];
  /** 本周已完成的任务标题，供亮点/问题导入 */
  completedTitles: string[];
  /** 目标列表 */
  goals: EngineGoal[];
}

// ============================================================
// 辅助
// ============================================================

function addDays(dateStr: string, days: number): string {
  const d = new Date(dateStr + 'T00:00:00');
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
}

// ============================================================
// Service
// ============================================================

export class ReviewDataService {
  /**
   * 加载某一周的全维度复盘数据
   * @param weekStart - 周一日期字符串
   * @returns ReviewData 对象
   */
  async loadWeeklyReviewData(weekStart: string): Promise<ReviewData> {
    const weekEnd = addDays(weekStart, 6);

    // 1. 本周所有原子项
    const atomsInWeek = await dailyAtomService.listByDateRange(weekStart, weekEnd);

    // 2. 完成统计
    const completed = atomsInWeek.filter((a) => a.isCompleted).length;
    const total = atomsInWeek.length;
    const rate = total > 0 ? Math.round((completed / total) * 100) : 0;

    const completedTitles = atomsInWeek
      .filter((a) => a.isCompleted)
      .map((a) => a.title);

    // 3. 时间投入（按类别）
    const timeSpent: Record<string, number> = {};
    for (const atom of atomsInWeek) {
      if (!atom.isCompleted || !atom.estimatedDuration) continue;
      const wt = await engineDB.weeklyTasks.get(atom.weeklyTaskId);
      if (!wt) continue;
      const ms = await engineDB.milestones.get(wt.milestoneId);
      if (!ms) continue;
      const goal = await engineDB.goals.get(ms.goalId);
      if (!goal) continue;
      const cat = goal.category;
      timeSpent[cat] = (timeSpent[cat] ?? 0) + atom.estimatedDuration;
    }

    // 4. 目标进度（本周 vs 上周）
    const goals = await goalService.list({ filter: { status: 'active' } });
    const lastWeekStart = addDays(weekStart, -7);
    const lastWeekEnd = addDays(weekStart, -1);

    const goalProgress = [];
    for (const goal of goals) {
      // 本周进度从目标当前值取
      const thisWeek = goal.progress;

      // 上周进度从快照取
      let lastWeek = 0;
      try {
        const lastSnapshots = await engineDB.progressSnapshots
          .where('goalId').equals(goal.id)
          .toArray();
        const lastSnap = lastSnapshots
          .filter((s) => s.snapshotDate <= lastWeekEnd)
          .sort((a, b) => b.snapshotDate.localeCompare(a.snapshotDate))[0];
        if (lastSnap) lastWeek = lastSnap.progress;
      } catch { /* no snapshot */ }

      goalProgress.push({
        goalId: goal.id,
        title: goal.title,
        category: goal.category,
        thisWeek,
        lastWeek,
        change: thisWeek - lastWeek,
      });
    }

    // 5. AI 洞察
    const insights = this.generateInsights(atomsInWeek, rate, goalProgress);

    return {
      weekRange: { start: weekStart, end: weekEnd },
      completion: { completed, total, rate },
      goalProgress,
      timeSpent,
      insights,
      atomsInWeek,
      completedTitles,
      goals,
    };
  }

  // ============================================================
  // 智能洞察
  // ============================================================

  /**
   * 基于本周数据自动生成洞察
   */
  generateInsights(
    atoms: EngineDailyAtom[],
    rate: number,
    goalProgress: Array<{ goalId: string; title: string; thisWeek: number; change: number }>
  ): ReviewData['insights'] {
    // 最佳时间分析
    const hourBuckets = new Map<number, number>();
    for (const atom of atoms) {
      if (!atom.isCompleted || !atom.completedAt) continue;
      const h = new Date(atom.completedAt).getHours();
      hourBuckets.set(h, (hourBuckets.get(h) ?? 0) + 1);
    }
    let bestHour = 7;
    let maxCount = 0;
    for (const [h, c] of hourBuckets) {
      if (c > maxCount) { maxCount = c; bestHour = h; }
    }
    const period = bestHour < 9 ? '早上' : bestHour < 12 ? '上午' :
      bestHour < 14 ? '中午' : bestHour < 18 ? '下午' : '晚上';
    const bestTime = `${period} ${bestHour}点左右效率最高 (${maxCount}次完成)`;

    // 瓶颈分析（哪天完成率最低）
    const dayBuckets = new Map<number, { total: number; done: number }>();
    for (const atom of atoms) {
      const dayIdx = new Date(atom.scheduledDate + 'T00:00:00').getDay();
      if (!dayBuckets.has(dayIdx)) dayBuckets.set(dayIdx, { total: 0, done: 0 });
      const b = dayBuckets.get(dayIdx)!;
      b.total++;
      if (atom.isCompleted) b.done++;
    }
    let worstDay = 1;
    let worstRate = 1.0;
    for (const [d, b] of dayBuckets) {
      if (b.total === 0) continue;
      const r = b.done / b.total;
      if (r < worstRate) { worstRate = r; worstDay = d; }
    }
    const dayNames = ['日','一','二','三','四','五','六'];
    const bottleneck = `周${dayNames[worstDay]}完成率最低 (${Math.round(worstRate * 100)}%)`;

    // 趋势分析
    const totalChange = goalProgress.reduce((s, g) => s + g.change, 0);
    const trend = totalChange > 0
      ? `整体进度比上周提升 ${totalChange > 10 ? '显著' : ''}（+${totalChange}%）`
      : totalChange < 0
      ? `整体进度比上周下降 ${totalChange}%，需关注`
      : '进度与上周持平';

    return { bestTime, bottleneck, trend };
  }
}

export const reviewDataService = new ReviewDataService();
