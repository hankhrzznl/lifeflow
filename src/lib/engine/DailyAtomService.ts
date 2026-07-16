// ============================================================
// 目标拆解引擎 — DailyAtomService
// L4 原子项 CRUD + 批量创建 + 日期查询
// ============================================================

import { engineDB } from './db';
import type { EngineDailyAtom, EngineAtomStatus } from './types';

// ============================================================
// 辅助函数
// ============================================================

/** 日期加法：dateStr + days → ISO date string */
function addDays(dateStr: string, days: number): string {
  const d = new Date(dateStr + 'T00:00:00');
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
}

// ============================================================
// DailyAtomService
// ============================================================

export class DailyAtomService {
  /**
   * 创建单个原子项
   *
   * @param data - 原子项数据（不含 id/isCompleted/status/createdAt/updatedAt）
   * @returns 新原子项 ID（UUID）
   */
  async create(
    data: Omit<EngineDailyAtom, 'id' | 'isCompleted' | 'completedAt' | 'actualQuantity' | 'checkInId' | 'status' | 'createdAt' | 'updatedAt'>
  ): Promise<string> {
    const now = new Date().toISOString();
    const id = crypto.randomUUID();
    const isOverdue = data.scheduledDate < now.slice(0, 10);

    await engineDB.dailyAtoms.add({
      ...data,
      id,
      isCompleted: false,
      status: isOverdue ? 'overdue' : 'pending',
      createdAt: now,
      updatedAt: now,
    });

    return id;
  }

  /**
   * 根据 ID 获取原子项
   */
  async getById(id: string): Promise<EngineDailyAtom | undefined> {
    return engineDB.dailyAtoms.get(id);
  }

  /**
   * 获取指定周任务下的所有原子项（按 scheduledDate + sortOrder 排序）
   */
  async listByWeeklyTask(weeklyTaskId: string): Promise<EngineDailyAtom[]> {
    const atoms = await engineDB.dailyAtoms
      .where('weeklyTaskId')
      .equals(weeklyTaskId)
      .toArray();

    return atoms.sort((a, b) => {
      const dateCmp = a.scheduledDate.localeCompare(b.scheduledDate);
      if (dateCmp !== 0) return dateCmp;
      return a.sortOrder - b.sortOrder;
    });
  }

  /**
   * 查询指定日期的所有原子项（跨目标聚合，最高频查询）
   * 使用复合索引 [scheduledDate+isCompleted]
   */
  async listByDate(date: string): Promise<EngineDailyAtom[]> {
    return engineDB.dailyAtoms
      .where('scheduledDate')
      .equals(date)
      .sortBy('sortOrder');
  }

  /**
   * 查询指定日期的未完成原子项
   */
  async listPendingByDate(date: string): Promise<EngineDailyAtom[]> {
    return engineDB.dailyAtoms
      .where('[scheduledDate+isCompleted]')
      .equals([date, false as unknown as 0])
      .toArray();
  }

  /**
   * 查询日期范围内的所有原子项
   */
  async listByDateRange(startDate: string, endDate: string): Promise<EngineDailyAtom[]> {
    return engineDB.dailyAtoms
      .where('scheduledDate')
      .between(startDate, endDate, true, true)
      .toArray();
  }

  /**
   * 部分更新原子项
   */
  async update(
    id: string,
    updates: Partial<Pick<EngineDailyAtom, 'title' | 'scheduledDate' | 'quantity' | 'estimatedDuration' | 'sortOrder'>>
  ): Promise<void> {
    await engineDB.dailyAtoms.update(id, {
      ...updates,
      updatedAt: new Date().toISOString(),
    });
  }

  /**
   * 删除原子项
   */
  async delete(id: string): Promise<void> {
    await engineDB.dailyAtoms.delete(id);
  }

  /**
   * 标记原子项完成
   * @param id - 原子项 ID
   * @param actualQuantity - 实际完成量（默认取 planQuantity）
   * @param score - 习惯评分（1-10）
   * @param note - 打卡备注
   * @param checkInTime - 实际打卡时间（ISO datetime）
   */
  async markComplete(
    id: string,
    actualQuantity?: number,
    score?: number,
    note?: string,
    checkInTime?: string
  ): Promise<void> {
    const atom = await engineDB.dailyAtoms.get(id);
    if (!atom) throw new Error(`原子项 ${id} 不存在`);

    const now = checkInTime ?? new Date().toISOString();
    const updates: Partial<EngineDailyAtom> = {
      isCompleted: true,
      completedAt: now,
      actualQuantity: actualQuantity ?? atom.quantity,
      status: 'completed',
      updatedAt: now,
    };

    if (score !== undefined) updates.score = score;
    if (note !== undefined) updates.note = note;

    await engineDB.dailyAtoms.update(id, updates);
  }

  /**
   * 取消原子项完成状态
   */
  async markIncomplete(id: string): Promise<void> {
    const atom = await engineDB.dailyAtoms.get(id);
    if (!atom) throw new Error(`原子项 ${id} 不存在`);

    const now = new Date().toISOString();
    const isOverdue = atom.scheduledDate < now.slice(0, 10);

    await engineDB.dailyAtoms.update(id, {
      isCompleted: false,
      completedAt: undefined,
      actualQuantity: undefined,
      status: isOverdue ? 'overdue' : 'pending',
      updatedAt: now,
    });
  }

  /**
   * 批量创建原子项
   * 按日期范围循环，每天生成指定数量的原子项
   *
   * @param weeklyTaskId - 父周任务 ID
   * @param startDate - 开始日期 (ISO date)
   * @param endDate - 结束日期 (ISO date)
   * @param dailyQuantity - 每天创建的原子项数量（默认 1）
   * @param titleTemplate - 标题模板，{day} 替换为日期，{index} 替换为当日序号
   * @param estimatedDuration - 每个原子项的预估耗时（分钟）
   * @returns 创建的原子项 ID 列表
   */
  async batchCreate(
    weeklyTaskId: string,
    startDate: string,
    endDate: string,
    dailyQuantity: number = 1,
    titleTemplate: string = '每日任务',
    estimatedDuration?: number
  ): Promise<string[]> {
    const now = new Date().toISOString();
    const today = now.slice(0, 10);
    const ids: string[] = [];
    let globalSortOrder = 0;

    let cursor = startDate;
    while (cursor <= endDate) {
      for (let i = 0; i < dailyQuantity; i++) {
        const id = crypto.randomUUID();
        const title = titleTemplate
          .replace('{day}', cursor)
          .replace('{index}', String(i + 1));

        const isOverdue = cursor < today;

        await engineDB.dailyAtoms.add({
          id,
          weeklyTaskId,
          title,
          scheduledDate: cursor,
          quantity: 1,
          actualQuantity: undefined,
          estimatedDuration,
          isCompleted: false,
          status: isOverdue ? 'overdue' : 'pending',
          sortOrder: globalSortOrder++,
          createdAt: now,
          updatedAt: now,
        });
        ids.push(id);
      }
      cursor = addDays(cursor, 1);
    }

    return ids;
  }

  /**
   * 批量更新原子项状态
   */
  async batchUpdateStatus(ids: string[], status: EngineAtomStatus): Promise<void> {
    const now = new Date().toISOString();
    await engineDB.transaction('rw', [engineDB.dailyAtoms], async () => {
      for (const id of ids) {
        await engineDB.dailyAtoms.update(id, { status, updatedAt: now });
      }
    });
  }

  /**
   * 获取某日期的原子项统计
   */
  async getDateStats(date: string): Promise<{
    total: number;
    completed: number;
    pending: number;
    overdue: number;
    completionRate: number;
  }> {
    const atoms = await this.listByDate(date);
    const completed = atoms.filter((a) => a.isCompleted).length;
    const overdue = atoms.filter(
      (a) => !a.isCompleted && a.scheduledDate < date
    ).length;

    return {
      total: atoms.length,
      completed,
      pending: atoms.length - completed - overdue,
      overdue,
      completionRate: atoms.length > 0 ? Math.round((completed / atoms.length) * 100) : 0,
    };
  }
}

/** 单例导出 */
export const dailyAtomService = new DailyAtomService();
