// ============================================================
// 目标拆解引擎 — WeeklyTaskService
// L3 周任务 CRUD + 量化目标 + 周编号自增 + 级联删除
// ============================================================

import { engineDB } from './db';
import type { EngineWeeklyTask, EngineMilestoneStatus } from './types';

// ============================================================
// WeeklyTaskService
// ============================================================

export class WeeklyTaskService {
  /**
   * 创建周任务
   * weekNumber 自动递增：同一里程碑下取最大 weekNumber + 1
   *
   * @param data - 周任务数据（不含 id/weekNumber/progress/status/createdAt/updatedAt）
   * @returns 新周任务 ID（UUID）
   */
  async create(
    data: Omit<EngineWeeklyTask, 'id' | 'weekNumber' | 'year' | 'progress' | 'status' | 'createdAt' | 'updatedAt'>
  ): Promise<string> {
    const now = new Date().toISOString();
    const id = crypto.randomUUID();

    // 计算下一个 weekNumber
    const existingTasks = await engineDB.weeklyTasks
      .where('milestoneId')
      .equals(data.milestoneId)
      .toArray();

    const maxWeek = existingTasks.reduce(
      (max, t) => Math.max(max, t.weekNumber),
      0
    );
    const nextWeek = maxWeek + 1;

    // 从 plannedStart 推导 year
    const year = new Date(data.plannedStart + 'T00:00:00').getFullYear();

    await engineDB.weeklyTasks.add({
      ...data,
      id,
      weekNumber: nextWeek,
      year,
      progress: 0,
      status: 'pending',
      createdAt: now,
      updatedAt: now,
    });

    return id;
  }

  /**
   * 根据 ID 获取周任务
   */
  async getById(id: string): Promise<EngineWeeklyTask | undefined> {
    return engineDB.weeklyTasks.get(id);
  }

  /**
   * 获取指定里程碑下的所有周任务（按 weekNumber 排序）
   * 使用复合索引 [milestoneId+weekNumber]
   */
  async listByMilestone(milestoneId: string): Promise<EngineWeeklyTask[]> {
    return engineDB.weeklyTasks
      .where('[milestoneId+weekNumber]')
      .between([milestoneId, 1], [milestoneId, 99], true, true)
      .toArray();
  }

  /**
   * 按指定周号查询某里程碑的周任务
   */
  async getByWeek(milestoneId: string, weekNumber: number): Promise<EngineWeeklyTask | undefined> {
    return engineDB.weeklyTasks
      .where('[milestoneId+weekNumber]')
      .equals([milestoneId, weekNumber])
      .first();
  }

  /**
   * 按年份 + 周号查询跨里程碑的周任务（用于周视图汇总）
   */
  async listByWeekNumber(year: number, weekNumber: number): Promise<EngineWeeklyTask[]> {
    return engineDB.weeklyTasks
      .where('weekNumber')
      .equals(weekNumber)
      .filter((t) => t.year === year)
      .toArray();
  }

  /**
   * 部分更新周任务
   */
  async update(
    id: string,
    updates: Partial<Pick<EngineWeeklyTask, 'title' | 'plannedStart' | 'plannedEnd' | 'quantityTarget' | 'quantityUnit' | 'weight' | 'sortOrder'>>
  ): Promise<void> {
    await engineDB.weeklyTasks.update(id, {
      ...updates,
      updatedAt: new Date().toISOString(),
    });
  }

  /**
   * 级联删除周任务
   * 删除周任务及其所有原子项
   */
  async delete(id: string): Promise<void> {
    await engineDB.transaction(
      'rw',
      [engineDB.weeklyTasks, engineDB.dailyAtoms],
      async () => {
        await engineDB.dailyAtoms.where('weeklyTaskId').equals(id).delete();
        await engineDB.weeklyTasks.delete(id);
      }
    );
  }

  /**
   * 批量创建周任务（按指定周数范围）
   * 用于模板引擎一次性生成多周任务
   *
   * @param milestoneId - 父里程碑 ID
   * @param weeks - 周任务数据数组（不含 milestoneId）
   * @returns 创建的周任务 ID 列表
   */
  async batchCreate(
    milestoneId: string,
    weeks: Array<Omit<EngineWeeklyTask, 'id' | 'milestoneId' | 'weekNumber' | 'year' | 'progress' | 'status' | 'createdAt' | 'updatedAt'>>
  ): Promise<string[]> {
    const now = new Date().toISOString();
    const ids: string[] = [];

    await engineDB.transaction('rw', [engineDB.weeklyTasks], async () => {
      for (const week of weeks) {
        const id = crypto.randomUUID();
        const year = new Date(week.plannedStart + 'T00:00:00').getFullYear();

        await engineDB.weeklyTasks.add({
          ...week,
          id,
          milestoneId,
          weekNumber: 1,
          year,
          progress: 0,
          status: 'pending',
          createdAt: now,
          updatedAt: now,
        });
        ids.push(id);
      }
    });

    return ids;
  }

  /**
   * 更新周任务状态
   */
  async updateStatus(id: string, status: EngineMilestoneStatus): Promise<void> {
    await engineDB.weeklyTasks.update(id, {
      status,
      updatedAt: new Date().toISOString(),
    });
  }
}

/** 单例导出 */
export const weeklyTaskService = new WeeklyTaskService();
