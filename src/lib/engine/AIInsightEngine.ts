// ============================================================
// 目标拆解引擎 — AIInsightEngine
// 纯本地计算，基于用户数据自动生成个性化洞察和建议
// 无需调用外部 AI API
// ============================================================

import { engineDB } from './db';
import { evolutionService } from './EvolutionService';
import type { HealthReport } from './EvolutionService';

// ============================================================
// 类型
// ============================================================

export interface Insight {
  icon: string;
  title: string;
  content: string;
  color: string;
}

export interface Suggestion {
  type: 'urgent' | 'warning' | 'tip';
  title: string;
  description: string;
  action: string;
}

interface WindowResult {
  start: number;
  end: number;
  rate: number;
}

interface DayResult {
  day: string;
  rate: number;
}

// ============================================================
// 工具
// ============================================================

const WEEKDAYS = ['周日', '周一', '周二', '周三', '周四', '周五', '周六'];

function toDateStr(d: Date): string {
  return d.toISOString().slice(0, 10);
}

function getMonday(date: Date): Date {
  const d = new Date(date);
  const day = d.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  d.setDate(d.getDate() + diff);
  d.setHours(0, 0, 0, 0);
  return d;
}

// ============================================================
// AIInsightEngine
// ============================================================

export class AIInsightEngine {
  // ==========================================================
  // W9-T1: 4个洞察方法
  // ==========================================================

  /**
   * 最佳时间分析 — 找出完成率最高的连续2小时窗口
   */
  async findBestTime(goalId: string): Promise<string> {
    const hourlyStats = await this.getHourlyCompletionStats(goalId);
    if (hourlyStats.size === 0) return '数据不足，还无法分析最佳时间';

    const bestWindow = this.findBestWindow(hourlyStats);
    const period = bestWindow.start < 12 ? '上午' : bestWindow.start < 18 ? '下午' : '晚上';
    return `${period}${bestWindow.start}-${bestWindow.end}点效率最高，完成率达${bestWindow.rate}%`;
  }

  /**
   * 阻力画像分析 — 找出完成率最低的天
   */
  async findBottleneck(goalId: string): Promise<string> {
    const weekdayStats = await this.getWeekdayCompletionStats(goalId);
    if (weekdayStats.size === 0) return '数据不足，还无法分析瓶颈';

    const worstDay = this.findWorstDay(weekdayStats);
    return `${worstDay.day}完成率仅${worstDay.rate}%，可能是工作疲劳导致，建议适当减少当天任务量`;
  }

  /**
   * 速度趋势分析 — 最近4周线性趋势
   */
  async analyzeSpeedTrend(goalId: string): Promise<string> {
    const weeklyRates = await this.getWeeklyRates(goalId, 4);
    if (weeklyRates.length < 2) return '至少需要2周数据才能分析趋势';

    const trend = this.calculateTrend(weeklyRates);
    if (trend > 10) return `近两周速度提升${trend}%，保持这个节奏！`;
    if (trend < -10) return `近两周速度下降${Math.abs(trend)}%，建议调整计划`;
    return '速度保持稳定，持续努力';
  }

  /**
   * 冲突提醒 — 检测同一天不同目标的时间冲突
   */
  async generateConflictWarning(goalId: string): Promise<string | null> {
    const conflicts = await this.findTimeConflicts(goalId);
    if (conflicts.length === 0) return null;
    const c = conflicts[0];
    return `${c.day}下午"${c.goals.join('"和"')}"时间冲突，建议错峰安排`;
  }

  // ==========================================================
  // W9-T2: 智能建议引擎
  // ==========================================================

  /**
   * 根据健康度和洞察生成具体改进建议
   */
  async generateSmartSuggestions(goalId: string): Promise<Suggestion[]> {
    const suggestions: Suggestion[] = [];

    // 1. 获取健康度报告
    let health: HealthReport;
    try {
      health = await evolutionService.checkGoalHealth(goalId);
    } catch {
      return suggestions;
    }

    // 2. urgent：红色健康度
    if (health.status === 'red') {
      suggestions.push({
        type: 'urgent',
        title: '进度严重落后',
        description: `完成率仅${health.completionRate}%，落后${Math.abs(health.aheadBehind)}天。建议减少任务量或延长期限`,
        action: 'reduce_scope',
      });
    }

    // 3. warning：逾期堆积
    if (health.overdueCount > 3) {
      suggestions.push({
        type: 'warning',
        title: '逾期任务堆积',
        description: `有${health.overdueCount}个任务已逾期，建议本周集中清理`,
        action: 'clear_backlog',
      });
    }

    if (health.status === 'yellow' && health.overdueCount <= 3 && health.overdueCount > 0) {
      suggestions.push({
        type: 'warning',
        title: '小幅落后',
        description: `有${health.overdueCount}项逾期，${Math.abs(health.aheadBehind)}天偏离轨道`,
        action: 'catch_up',
      });
    }

    // 4. tip：最佳时间
    try {
      const bestTime = await this.findBestTime(goalId);
      if (!bestTime.includes('数据不足')) {
        suggestions.push({
          type: 'tip',
          title: '最佳时间调整',
          description: bestTime,
          action: 'reschedule',
        });
      }
    } catch { /* 洞察失败不影响建议生成 */ }

    // 5. tip：趋势下降时
    if (health.trend === 'declining') {
      suggestions.push({
        type: 'warning',
        title: '速度持续下降',
        description: '近两周完成率持续下滑，建议检视是否有外部阻碍因素',
        action: 'review_blockers',
      });
    }

    return suggestions;
  }

  // ==========================================================
  // 辅助方法：数据查询
  // ==========================================================

  /**
   * 按小时分组统计完成率
   */
  private async getHourlyCompletionStats(goalId: string): Promise<Map<number, { total: number; completed: number }>> {
    // 获取该目标所有已完成的原子项（通过 completedAt 推断完成时间）
    const milestones = await engineDB.milestones.where('goalId').equals(goalId).toArray();
    const stats = new Map<number, { total: number; completed: number }>();

    for (const ms of milestones) {
      const tasks = await engineDB.weeklyTasks.where('milestoneId').equals(ms.id).toArray();
      for (const task of tasks) {
        const atoms = await engineDB.dailyAtoms.where('weeklyTaskId').equals(task.id).toArray();
        for (const atom of atoms) {
          // 用 scheduledDate 的 "早上/下午" 判断 + completedAt 的实际时间
          const completedAt = atom.completedAt;
          const hour = completedAt ? new Date(completedAt).getHours() : -1;
          if (hour < 0 || hour > 23) continue;

          if (!stats.has(hour)) stats.set(hour, { total: 0, completed: 0 });
          const s = stats.get(hour)!;
          s.total++;
          if (atom.isCompleted) s.completed++;
        }
      }
    }

    return stats;
  }

  /**
   * 按星期几分组统计完成率
   */
  private async getWeekdayCompletionStats(goalId: string): Promise<Map<number, { total: number; completed: number }>> {
    const milestones = await engineDB.milestones.where('goalId').equals(goalId).toArray();
    const stats = new Map<number, { total: number; completed: number }>();

    for (const ms of milestones) {
      const tasks = await engineDB.weeklyTasks.where('milestoneId').equals(ms.id).toArray();
      for (const task of tasks) {
        const atoms = await engineDB.dailyAtoms.where('weeklyTaskId').equals(task.id).toArray();
        for (const atom of atoms) {
          if (!atom.scheduledDate) continue;
          const d = new Date(atom.scheduledDate + 'T00:00:00');
          const wd = d.getDay();

          if (!stats.has(wd)) stats.set(wd, { total: 0, completed: 0 });
          const s = stats.get(wd)!;
          s.total++;
          if (atom.isCompleted) s.completed++;
        }
      }
    }

    return stats;
  }

  /**
   * 获取最近 N 周的完成率
   */
  private async getWeeklyRates(goalId: string, weeks: number): Promise<number[]> {
    const rates: number[] = [];
    const now = new Date();

    for (let i = weeks - 1; i >= 0; i--) {
      const monday = getMonday(now);
      monday.setDate(monday.getDate() - i * 7);
      const start = toDateStr(monday);
      const endDate = new Date(monday);
      endDate.setDate(endDate.getDate() + 6);
      const end = toDateStr(endDate);

      const milestones = await engineDB.milestones.where('goalId').equals(goalId).toArray();
      let total = 0;
      let completed = 0;

      for (const ms of milestones) {
        const tasks = await engineDB.weeklyTasks.where('milestoneId').equals(ms.id).toArray();
        for (const task of tasks) {
          const atoms = await engineDB.dailyAtoms
            .where('weeklyTaskId').equals(task.id)
            .filter((a) => a.scheduledDate >= start && a.scheduledDate <= end)
            .toArray();
          total += atoms.length;
          completed += atoms.filter((a) => a.isCompleted).length;
        }
      }

      rates.push(total > 0 ? Math.round((completed / total) * 100) : 0);
    }

    return rates;
  }

  /**
   * 检测时间冲突：同一天 2小时窗口内多个目标的原子项重叠
   */
  private async findTimeConflicts(goalId: string): Promise<Array<{ day: string; goals: string[] }>> {
    const conflicts: Array<{ day: string; goals: string[] }> = [];
    const goal = await engineDB.goals.get(goalId);
    if (!goal) return conflicts;

    const allGoals = await engineDB.goals.where('status').equals('active').toArray();
    const dateGoalMap = new Map<string, Set<string>>();

    for (const g of allGoals) {
      const milestones = await engineDB.milestones.where('goalId').equals(g.id).toArray();
      for (const ms of milestones) {
        const tasks = await engineDB.weeklyTasks.where('milestoneId').equals(ms.id).toArray();
        for (const task of tasks) {
          const atoms = await engineDB.dailyAtoms
            .where('weeklyTaskId').equals(task.id)
            .filter((a) => !a.isCompleted)
            .toArray();
          for (const atom of atoms) {
            if (!atom.scheduledDate) continue;
            if (!dateGoalMap.has(atom.scheduledDate)) dateGoalMap.set(atom.scheduledDate, new Set());
            dateGoalMap.get(atom.scheduledDate)!.add(g.title);
          }
        }
      }
    }

    // 找出同一天有2个以上不同目标的原子项的日期
    for (const [date, titles] of dateGoalMap) {
      if (titles.size >= 2 && titles.has(goal.title)) {
        const d = new Date(date + 'T00:00:00');
        const dayLabel = `${d.getMonth() + 1}/${d.getDate()} ${WEEKDAYS[d.getDay()]}`;
        const others = Array.from(titles).filter((t) => t !== goal.title);
        if (others.length > 0) {
          conflicts.push({ day: dayLabel, goals: others });
        }
      }
    }

    return conflicts;
  }

  // ==========================================================
  // 纯算法：最佳窗口 / 最差日 / 趋势计算
  // ==========================================================

  /**
   * 找出完成率最高的连续2小时窗口
   */
  private findBestWindow(
    hourlyStats: Map<number, { total: number; completed: number }>
  ): WindowResult {
    let best: WindowResult = { start: 8, end: 10, rate: 0 };

    for (let start = 0; start <= 22; start++) {
      const end = start + 2;
      let total = 0;
      let completed = 0;

      for (let h = start; h < end; h++) {
        const s = hourlyStats.get(h);
        if (s) {
          total += s.total;
          completed += s.completed;
        }
      }

      const rate = total > 0 ? Math.round((completed / total) * 100) : 0;
      if (rate > best.rate) {
        best = { start, end, rate };
      }
    }

    return best;
  }

  /**
   * 找出完成率最低的1天
   */
  private findWorstDay(
    weekdayStats: Map<number, { total: number; completed: number }>
  ): DayResult {
    let worst: DayResult = { day: '周一', rate: 100 };

    for (const [wd, s] of weekdayStats) {
      if (s.total === 0) continue;
      const rate = Math.round((s.completed / s.total) * 100);
      if (rate < worst.rate) {
        worst = { day: WEEKDAYS[wd], rate };
      }
    }

    return worst;
  }

  /**
   * 简单线性回归计算趋势斜率
   * 斜率 > 0 = 上升, < 0 = 下降
   * 返回近似百分比变化
   */
  private calculateTrend(rates: number[]): number {
    if (rates.length < 2) return 0;

    const n = rates.length;
    // 计算均值和协方差
    let sumX = 0, sumY = 0, sumXY = 0, sumX2 = 0;
    for (let i = 0; i < n; i++) {
      sumX += i;
      sumY += rates[i];
      sumXY += i * rates[i];
      sumX2 += i * i;
    }

    const denominator = n * sumX2 - sumX * sumX;
    if (denominator === 0) return 0;

    const slope = (n * sumXY - sumX * sumY) / denominator;

    // 斜率 × (n-1) 近似总变化量（百分比点）
    return Math.round(slope * (n - 1));
  }
}

/** 单例导出 */
export const aiInsightEngine = new AIInsightEngine();
