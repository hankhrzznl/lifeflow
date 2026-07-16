// ============================================================
// 目标拆解引擎 — GoalService
// L1 目标 CRUD + 级联删除
// ============================================================

import { engineDB } from './db';
import type {
  EngineGoal,
  EngineGoalCategory,
  EngineGoalPriority,
  EngineGoalStatus,
  EngineWeeklyTask,
} from './types';

// ============================================================
// 查询参数
// ============================================================

/** 列表查询筛选条件 */
export interface GoalListFilter {
  status?: EngineGoalStatus;
  category?: EngineGoalCategory;
  priority?: EngineGoalPriority;
}

/** 列表查询排序选项 */
export interface GoalListSort {
  field: 'deadline' | 'priority' | 'progress' | 'createdAt';
  direction: 'asc' | 'desc';
}

/** 列表查询参数 */
export interface GoalListOptions {
  filter?: GoalListFilter;
  sort?: GoalListSort;
  limit?: number;
  offset?: number;
}

// ============================================================
// GoalService
// ============================================================

export class GoalService {
  /**
   * 创建目标
   * @param data - 目标数据（不含 id/progress/status/createdAt/updatedAt）
   * @returns 新创建的目标 ID（UUID）
   */
  async create(
    data: Omit<EngineGoal, 'id' | 'progress' | 'status' | 'healthStatus' | 'createdAt' | 'updatedAt'>
  ): Promise<string> {
    const now = new Date().toISOString();
    const id = crypto.randomUUID();

    await engineDB.goals.add({
      ...data,
      id,
      progress: 0,
      status: 'active',
      healthStatus: undefined,
      createdAt: now,
      updatedAt: now,
    });

    return id;
  }

  /**
   * 根据 ID 获取目标
   */
  async getById(id: string): Promise<EngineGoal | undefined> {
    return engineDB.goals.get(id);
  }

  /**
   * 列表查询
   * 支持按 status/category/priority 筛选，按 deadline/priority/progress/createdAt 排序
   */
  async list(options: GoalListOptions = {}): Promise<EngineGoal[]> {
    let collection = engineDB.goals.toCollection();

    // 应用筛选（优先使用最高选择性的索引）
    const f = options.filter;
    if (f) {
      if (f.status) {
        collection = collection.filter((g) => g.status === f.status);
      }
      if (f.category) {
        collection = collection.filter((g) => g.category === f.category);
      }
      if (f.priority) {
        collection = collection.filter((g) => g.priority === f.priority);
      }
    }

    // 排序
    const sort = options.sort ?? { field: 'createdAt', direction: 'desc' };
    const records = await collection.toArray();

    const priorityOrder: Record<EngineGoalPriority, number> = {
      p1: 0, p2: 1, p3: 2, p4: 3,
    };

    records.sort((a, b) => {
      let cmp: number;
      switch (sort.field) {
        case 'deadline':
          cmp = a.deadline.localeCompare(b.deadline);
          break;
        case 'priority':
          cmp = (priorityOrder[a.priority] ?? 99) - (priorityOrder[b.priority] ?? 99);
          break;
        case 'progress':
          cmp = a.progress - b.progress;
          break;
        case 'createdAt':
        default:
          cmp = a.createdAt.localeCompare(b.createdAt);
          break;
      }
      return sort.direction === 'desc' ? -cmp : cmp;
    });

    // 分页
    if (options.offset) {
      return records.slice(options.offset, options.offset + (options.limit ?? records.length));
    }
    if (options.limit) {
      return records.slice(0, options.limit);
    }

    return records;
  }

  /**
   * 部分更新目标
   * @param id - 目标 ID
   * @param updates - 更新字段
   */
  async update(
    id: string,
    updates: Partial<Pick<EngineGoal, 'title' | 'description' | 'category' | 'priority' | 'deadline' | 'successCriteria' | 'status'>>
  ): Promise<void> {
    await engineDB.goals.update(id, {
      ...updates,
      updatedAt: new Date().toISOString(),
    });
  }

  /**
   * 级联删除目标
   * 在一个 Dexie 事务中删除目标及其所有 Milestone → WeeklyTask → DailyAtom
   * @param id - 目标 ID
   */
  async delete(id: string): Promise<void> {
    await engineDB.transaction(
      'rw',
      [engineDB.goals, engineDB.milestones, engineDB.weeklyTasks, engineDB.dailyAtoms, engineDB.progressSnapshots],
      async () => {
        // 1. 收集所有里程碑
        const milestones = await engineDB.milestones
          .where('goalId')
          .equals(id)
          .toArray();

        // 2. 收集所有周任务
        const msIds = milestones.map((m) => m.id);
        const allTasks: EngineWeeklyTask[] = [];
        for (const msId of msIds) {
          const tasks = await engineDB.weeklyTasks
            .where('milestoneId')
            .equals(msId)
            .toArray();
          allTasks.push(...tasks);
        }

        // 3. 删除所有原子项
        const taskIds = allTasks.map((t) => t.id);
        for (const taskId of taskIds) {
          await engineDB.dailyAtoms.where('weeklyTaskId').equals(taskId).delete();
        }

        // 4. 删除所有周任务
        for (const msId of msIds) {
          await engineDB.weeklyTasks.where('milestoneId').equals(msId).delete();
        }

        // 5. 删除所有里程碑
        await engineDB.milestones.where('goalId').equals(id).delete();

        // 6. 删除进度快照
        await engineDB.progressSnapshots.where('goalId').equals(id).delete();

        // 7. 删除目标
        await engineDB.goals.delete(id);
      }
    );
  }

  /**
   * 批量更新目标状态
   * @param ids - 目标 ID 列表
   * @param status - 新状态
   */
  async batchUpdateStatus(ids: string[], status: EngineGoalStatus): Promise<void> {
    const now = new Date().toISOString();
    await engineDB.transaction('rw', [engineDB.goals], async () => {
      for (const id of ids) {
        await engineDB.goals.update(id, { status, updatedAt: now });
      }
    });
  }

  /**
   * 获取目标统计信息
   */
  async getStats(): Promise<{
    total: number;
    active: number;
    completed: number;
    paused: number;
  }> {
    const all = await engineDB.goals.toArray();
    return {
      total: all.length,
      active: all.filter((g) => g.status === 'active').length,
      completed: all.filter((g) => g.status === 'completed').length,
      paused: all.filter((g) => g.status === 'paused').length,
    };
  }
}

/** 单例导出 */
export const goalService = new GoalService();
