/**
 * SchedulerBrain — 任务调度引擎
 * 基于紧急度/重要性矩阵优化任务排序
 */

import type { ScheduleTask } from "@/lib/db/efficiency.db";

export interface SchedulableTask {
  id?: number;
  title: string;
  priority?: "urgent-important" | "not-urgent-important" | "urgent-not-important" | "not-urgent-not-important";
  dueDate?: number;
  estimatedMinutes?: number;
  status: string;
}

export interface OptimizedSlot {
  taskId?: number;
  title: string;
  suggestedStart: string; // "HH:mm"
  suggestedEnd: string; // "HH:mm"
  reason: string;
}

export interface OptimizedResult {
  slots: OptimizedSlot[];
  unscheduled: SchedulableTask[];
  totalEstimatedMinutes: number;
}

export class SchedulerBrain {
  /**
   * 对任务列表进行排序和时段分配
   */
  optimize(tasks: SchedulableTask[]): OptimizedResult {
    // TODO: 实际逻辑 — 艾森豪威尔矩阵 + 时间块分配
    // 1. 按 priority 分组：urgent-important > not-urgent-important > urgent-not-important
    // 2. 考虑 dueDate 距离，越近越靠前
    // 3. 检测冲突和溢出
    // 4. 为每个任务分配合适的时间块
    return {
      slots: [],
      unscheduled: tasks,
      totalEstimatedMinutes: 0,
    };
  }

  /**
   * 对 ScheduleTask 列表排序：
   * 1. isImportant=true 始终排最前
   * 2. 按 deadline 距离（越近越前）
   * 3. 按 plannedTime（短任务优先，快速收尾）
   */
  rank(tasks: ScheduleTask[]): ScheduleTask[] {
    const now = new Date();
    const today = now.toISOString().slice(0, 10); // YYYY-MM-DD

    return [...tasks].sort((a, b) => {
      // 1. isImportant 优先
      if (a.isImportant && !b.isImportant) return -1;
      if (!a.isImportant && b.isImportant) return 1;

      // 2. 按 deadline 距离（越近越前）
      const aDeadline = this.getClosestDate(a, today);
      const bDeadline = this.getClosestDate(b, today);
      if (aDeadline !== bDeadline) {
        return aDeadline.localeCompare(bDeadline);
      }

      // 3. 按 plannedTime（短任务优先）
      return a.plannedTime - b.plannedTime;
    });
  }

  /**
   * 根据任务属性返回推荐执行时段
   * - plannedTime > 90 → "上午"（深度工作）
   * - plannedTime 30-90 → "下午"
   * - plannedTime < 30 → "晚上"（快任务）
   * - 重要任务 → 始终 "上午"
   */
  getTimeRecommendation(task: ScheduleTask): string {
    if (task.isImportant) return "上午";
    if (task.plannedTime > 90) return "上午";
    if (task.plannedTime >= 30) return "下午";
    return "晚上";
  }

  /**
   * 取任务最接近今天的日期（用于排序）
   * multi_day 有 startDate/endDate，single 有 date
   */
  private getClosestDate(task: ScheduleTask, today: string): string {
    // 对于 single 任务，取其 date
    if (task.type === "single" && task.date) {
      return task.date;
    }
    // 对于 multi_day，取 endDate（截止日期）
    if (task.endDate) {
      return task.endDate;
    }
    // fallback
    return task.startDate || task.date || today;
  }
}

export const schedulerBrain = new SchedulerBrain();
