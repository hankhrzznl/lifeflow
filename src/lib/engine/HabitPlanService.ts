// ============================================================
// 目标拆解引擎 — HabitPlanService
// 习惯月度计划服务
// ============================================================

import { goalService } from './GoalService';
import { milestoneService } from './MilestoneService';
import { weeklyTaskService } from './WeeklyTaskService';
import { dailyAtomService } from './DailyAtomService';
import type { EngineGoalPriority } from './types';

// ============================================================
// 类型定义
// ============================================================

/** 月度计划配置 */
export interface HabitPlanInput {
  /** 习惯名称 */
  name: string;
  /** 目标截止日期（默认月末） */
  deadline: string;
  /** 起止日期范围 */
  dateRange: { start: string; end: string };
  /** 选中的具体日期（ISO date 数组），优先级高于 weekdays */
  selectedDates?: string[];
  /** 按星期几执行（1=Mon, ..., 7=Sun），默认全部 */
  weekdays?: number[];
  /** 执行时间段描述（如 "07:00-08:00"） */
  timeSlot?: string;
  /** 每日预估耗时（分钟），默认 30 */
  estimatedDuration?: number;
  /** 每日数量，默认 1 */
  quantity?: number;
  /** 优先级，默认 p2 */
  priority?: EngineGoalPriority;
}

export interface HabitPlanResult {
  goalId: string;
  stats: {
    milestones: number;
    weeklyTasks: number;
    dailyAtoms: number;
  };
  dates: string[];
}

// ============================================================
// Service
// ============================================================

export class HabitPlanService {
  /**
   * 根据月度计划配置创建完整的四级拆解
   *
   * 流程：
   * 1. 创建 Goal（习惯养成类）
   * 2. 创建单个 Milestone
   * 3. 按周分组创建 WeeklyTask
   * 4. 按选中日期生成 DailyAtom
   */
  async createPlan(plan: HabitPlanInput): Promise<HabitPlanResult> {
    const dates = this.resolveDates(plan);
    if (dates.length === 0) {
      throw new Error('没有选中的执行日期');
    }

    // 1. Goal
    const goalId = await goalService.create({
      title: `习惯：${plan.name}`,
      description: `${plan.timeSlot ? `时间段 ${plan.timeSlot}` : ''}，${dates.length}次/月`,
      category: 'habit',
      priority: plan.priority ?? 'p2',
      deadline: plan.deadline,
      templateId: 'habit-monthly',
      successCriteria: `完成${dates.length}次${plan.name}打卡`,
    });

    // 2. Milestone
    const msId = await milestoneService.create({
      goalId,
      title: '月度执行',
      description: `${dates.length}天，${plan.timeSlot ?? '全天'}`,
      startDate: dates[0],
      deadline: dates[dates.length - 1],
      weight: 100,
      sortOrder: 0,
    });

    // 3. WeeklyTasks（按 ISO 周分组）
    const weekGroups = this.groupByWeek(dates);
    let taskCount = 0;
    let atomCount = 0;

    for (const [weekKey, weekDates] of weekGroups) {
      const wtId = await weeklyTaskService.create({
        milestoneId: msId,
        title: `${plan.name} 第${weekKey}周`,
        plannedStart: weekDates[0],
        plannedEnd: weekDates[weekDates.length - 1],
        quantityTarget: weekDates.length,
        quantityUnit: '次',
        weight: 100,
        sortOrder: taskCount,
      });
      taskCount++;

      // 4. DailyAtoms
      for (const date of weekDates) {
        const title = plan.timeSlot
          ? `${plan.name} (${plan.timeSlot})`
          : plan.name;

        await dailyAtomService.create({
          weeklyTaskId: wtId,
          title,
          scheduledDate: date,
          quantity: plan.quantity ?? 1,
          estimatedDuration: plan.estimatedDuration ?? 30,
          sortOrder: atomCount,
        });
        atomCount++;
      }
    }

    // 归一化权重
    await milestoneService.renormalizeWeights(goalId);

    return {
      goalId,
      stats: {
        milestones: 1,
        weeklyTasks: taskCount,
        dailyAtoms: atomCount,
      },
      dates,
    };
  }

  /**
   * 解析选中日期
   * 优先使用 selectedDates，否则按 weekdays + dateRange 计算
   */
  resolveDates(plan: HabitPlanInput): string[] {
    if (plan.selectedDates && plan.selectedDates.length > 0) {
      return [...plan.selectedDates].sort();
    }

    const weekdays = plan.weekdays ?? [1, 2, 3, 4, 5, 6, 7];
    const result: string[] = [];
    const cursor = new Date(plan.dateRange.start + 'T00:00:00');
    const end = new Date(plan.dateRange.end + 'T00:00:00');

    while (cursor <= end) {
      const dow = cursor.getDay() === 0 ? 7 : cursor.getDay();
      if (weekdays.includes(dow)) {
        result.push(cursor.toISOString().slice(0, 10));
      }
      cursor.setDate(cursor.getDate() + 1);
    }

    return result;
  }

  /**
   * 按 ISO 周分组日期
   */
  groupByWeek(dates: string[]): Map<string, string[]> {
    const groups = new Map<string, string[]>();
    for (const d of dates) {
      const dt = new Date(d + 'T00:00:00');
      const oneJan = new Date(dt.getFullYear(), 0, 1);
      const weekNum = Math.ceil(
        ((dt.getTime() - oneJan.getTime()) / 86400000 + oneJan.getDay() + 1) / 7
      );
      const key = `${dt.getFullYear()}-W${String(weekNum).padStart(2, '0')}`;
      if (!groups.has(key)) groups.set(key, []);
      groups.get(key)!.push(d);
    }
    return groups;
  }
}

export const habitPlanService = new HabitPlanService();
