// ============================================================
// 目标拆解引擎 — MilestoneService
// L2 里程碑 CRUD + 权重分配 + 依赖管理 + 级联删除
// ============================================================

import { engineDB } from './db';
import type { EngineMilestone, EngineMilestoneStatus } from './types';

// ============================================================
// MilestoneService
// ============================================================

export class MilestoneService {
  /**
   * 创建里程碑
   * @param data - 里程碑数据（不含 id/progress/status/createdAt/updatedAt）
   * @returns 新里程碑 ID（UUID）
   */
  async create(
    data: Omit<EngineMilestone, 'id' | 'progress' | 'status' | 'createdAt' | 'updatedAt'>
  ): Promise<string> {
    const now = new Date().toISOString();
    const id = crypto.randomUUID();

    await engineDB.milestones.add({
      ...data,
      id,
      progress: 0,
      status: 'pending',
      createdAt: now,
      updatedAt: now,
    });

    return id;
  }

  /**
   * 根据 ID 获取里程碑
   */
  async getById(id: string): Promise<EngineMilestone | undefined> {
    return engineDB.milestones.get(id);
  }

  /**
   * 获取指定目标下的所有里程碑（按 sortOrder 排序）
   */
  async listByGoal(goalId: string): Promise<EngineMilestone[]> {
    return engineDB.milestones
      .where('goalId')
      .equals(goalId)
      .sortBy('sortOrder');
  }

  /**
   * 部分更新里程碑
   */
  async update(
    id: string,
    updates: Partial<Pick<EngineMilestone, 'title' | 'description' | 'deadline' | 'weight' | 'deliverable' | 'acceptanceCriteria' | 'sortOrder' | 'dependencies'>>
  ): Promise<void> {
    await engineDB.milestones.update(id, {
      ...updates,
      updatedAt: new Date().toISOString(),
    });
  }

  /**
   * 级联删除里程碑
   * 删除里程碑及其所有周任务和原子项
   */
  async delete(id: string): Promise<void> {
    await engineDB.transaction(
      'rw',
      [engineDB.milestones, engineDB.weeklyTasks, engineDB.dailyAtoms],
      async () => {
        const tasks = await engineDB.weeklyTasks
          .where('milestoneId')
          .equals(id)
          .toArray();

        for (const task of tasks) {
          await engineDB.dailyAtoms.where('weeklyTaskId').equals(task.id).delete();
        }
        await engineDB.weeklyTasks.where('milestoneId').equals(id).delete();
        await engineDB.milestones.delete(id);
      }
    );
  }

  // ============================================================
  // 权重分配
  // ============================================================

  /**
   * 为指定目标下的所有里程碑自动平均分配权重（总和 = 100）
   * 
   * 算法：前 n-1 个取 Math.floor(100/n)，最后一个取余数补足。
   * 例如 3 个里程碑 → [33, 33, 34]
   */
  async calculateDefaultWeights(goalId: string): Promise<void> {
    const milestones = await this.listByGoal(goalId);
    const count = milestones.length;
    if (count === 0) return;

    const baseWeight = Math.floor(100 / count);
    const remainder = 100 - baseWeight * count;
    const now = new Date().toISOString();

    await engineDB.transaction('rw', [engineDB.milestones], async () => {
      for (let i = 0; i < count; i++) {
        const ms = milestones[i];
        const weight = i === count - 1 ? baseWeight + remainder : baseWeight;
        await engineDB.milestones.update(ms.id, { weight, updatedAt: now });
      }
    });
  }

  /**
   * 重新归一化指定目标下所有里程碑的权重，使总和 = 100
   * 
   * 适用场景：手动调整某个里程碑的权重后调用此方法重新分配。
   * 算法：按现有权重比例重新映射到 0-100 范围。
   */
  async renormalizeWeights(goalId: string): Promise<void> {
    const milestones = await this.listByGoal(goalId);
    if (milestones.length === 0) return;

    const totalWeight = milestones.reduce((sum, ms) => sum + (ms.weight || 1), 0);
    if (totalWeight <= 0) return;

    const now = new Date().toISOString();

    await engineDB.transaction('rw', [engineDB.milestones], async () => {
      let allocated = 0;

      for (let i = 0; i < milestones.length - 1; i++) {
        const ms = milestones[i];
        const normalized = Math.round(((ms.weight || 1) / totalWeight) * 100);
        const clamped = Math.max(1, Math.min(100 - allocated - (milestones.length - 1 - i), normalized));
        await engineDB.milestones.update(ms.id, { weight: clamped, updatedAt: now });
        allocated += clamped;
      }

      // 最后一个取余数确保总和 = 100
      const last = milestones[milestones.length - 1];
      await engineDB.milestones.update(last.id, {
        weight: Math.max(1, 100 - allocated),
        updatedAt: now,
      });
    });
  }

  // ============================================================
  // 依赖管理
  // ============================================================

  /**
   * 添加里程碑依赖关系
   * 设置 milestoneId 依赖 dependsOnId（即 dependsOnId 必须先完成）
   * 
   * @param milestoneId - 当前里程碑 ID
   * @param dependsOnId - 依赖的前置里程碑 ID
   */
  async addDependency(milestoneId: string, dependsOnId: string): Promise<void> {
    const ms = await engineDB.milestones.get(milestoneId);
    if (!ms) throw new Error(`里程碑 ${milestoneId} 不存在`);

    const dep = await engineDB.milestones.get(dependsOnId);
    if (!dep) throw new Error(`前置里程碑 ${dependsOnId} 不存在`);
    if (dep.goalId !== ms.goalId) {
      throw new Error('依赖的里程碑必须属于同一目标');
    }
    if (milestoneId === dependsOnId) {
      throw new Error('里程碑不能依赖自身');
    }

    const deps = ms.dependencies ?? [];
    if (deps.includes(dependsOnId)) return; // 已存在

    await engineDB.milestones.update(milestoneId, {
      dependencies: [...deps, dependsOnId],
      updatedAt: new Date().toISOString(),
    });
  }

  /**
   * 移除里程碑依赖关系
   */
  async removeDependency(milestoneId: string, dependsOnId: string): Promise<void> {
    const ms = await engineDB.milestones.get(milestoneId);
    if (!ms) throw new Error(`里程碑 ${milestoneId} 不存在`);

    const deps = ms.dependencies ?? [];
    const idx = deps.indexOf(dependsOnId);
    if (idx === -1) return;

    deps.splice(idx, 1);
    await engineDB.milestones.update(milestoneId, {
      dependencies: deps,
      updatedAt: new Date().toISOString(),
    });
  }

  /**
   * 列出里程碑的所有依赖
   * @returns 前置里程碑 ID 列表
   */
  async listDependencies(milestoneId: string): Promise<string[]> {
    const ms = await engineDB.milestones.get(milestoneId);
    return ms?.dependencies ?? [];
  }

  /**
   * 批量更新里程碑状态
   */
  async updateStatus(milestoneId: string, status: EngineMilestoneStatus): Promise<void> {
    await engineDB.milestones.update(milestoneId, {
      status,
      updatedAt: new Date().toISOString(),
    });
  }
}

/** 单例导出 */
export const milestoneService = new MilestoneService();
