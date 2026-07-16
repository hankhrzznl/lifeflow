// ============================================================
// 目标拆解引擎 — 统一门面服务
// 对外暴露所有核心能力：CRUD + 模板 + 回算 + 演化
// 设计意图：调用方只需依赖这一个类，无需了解内部模块划分
// ============================================================

import { goalDB, initializeGoalDB, clearGoalDB } from './schema';
import {
  rollupFromAtom,
  completeAtom,
  uncompleteAtom,
  recalculateAllForGoal,
  detectCycle,
  validateDependencies,
} from './RecalculationService';
import {
  getTemplateMetas,
  getTemplateMeta,
  generateTemplate,
  applyAdaptiveDifficulty,
} from './TemplateEngine';
import {
  checkGoalHealth,
  checkAllActiveGoalsHealth,
  generateSuggestions,
  detectConflicts,
  createProgressSnapshot,
  createAllSnapshots,
  getProgressTrend,
} from './EvolutionService';
import type {
  Goal,
  Milestone,
  WeeklyTask,
  DailyAtom,
  GoalProgressSnapshot,
  GoalTree,
  MilestoneWithChildren,
  WeeklyTaskWithChildren,
  TemplateParams,
  TemplateResult,
  TemplateMeta,
  RollupResult,
  HealthScore,
  AdjustmentSuggestion,
  ConflictReport,
  GoalCategory,
  Priority,
} from '@/types/goal';

// ============================================================
// GoalEngine 统一入口
// ============================================================

export class GoalEngine {
  // ==================== 数据库生命周期 ====================

  /** 初始化数据库 */
  static async initialize(): Promise<{ success: boolean; error?: string }> {
    return initializeGoalDB();
  }

  /** 清空所有数据 */
  static async clear(): Promise<void> {
    return clearGoalDB();
  }

  // ==================== Goal CRUD ====================

  /** 创建目标 */
  static async createGoal(data: Omit<Goal, 'id' | 'progress' | 'status' | 'healthStatus' | 'createdAt' | 'updatedAt'>): Promise<string> {
    const now = new Date().toISOString();
    const id = crypto.randomUUID();
    await goalDB.goals.add({
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

  /** 获取目标 */
  static async getGoal(goalId: string): Promise<Goal | undefined> {
    return goalDB.goals.get(goalId);
  }

  /** 获取所有目标 */
  static async getAllGoals(filter?: { status?: Goal['status']; category?: GoalCategory }): Promise<Goal[]> {
    let collection = goalDB.goals.toCollection();
    if (filter?.status) {
      collection = collection.filter((g) => g.status === filter.status);
    }
    if (filter?.category) {
      collection = collection.filter((g) => g.category === filter.category);
    }
    return collection.sortBy('createdAt');
  }

  /** 更新目标 */
  static async updateGoal(goalId: string, updates: Partial<Pick<Goal, 'title' | 'description' | 'priority' | 'deadline' | 'successCriteria' | 'status'>>): Promise<void> {
    await goalDB.goals.update(goalId, {
      ...updates,
      updatedAt: new Date().toISOString(),
    });
  }

  /** 删除目标（级联删除所有里程碑、周任务、原子项、快照） */
  static async deleteGoal(goalId: string): Promise<void> {
    await goalDB.transaction(
      'rw',
      [goalDB.goals, goalDB.milestones, goalDB.weeklyTasks, goalDB.dailyAtoms, goalDB.progressSnapshots],
      async () => {
        const milestones = await goalDB.milestones.where('goalId').equals(goalId).toArray();
        for (const ms of milestones) {
          const tasks = await goalDB.weeklyTasks.where('milestoneId').equals(ms.id).toArray();
          for (const task of tasks) {
            await goalDB.dailyAtoms.where('weeklyTaskId').equals(task.id).delete();
          }
          await goalDB.weeklyTasks.where('milestoneId').equals(ms.id).delete();
        }
        await goalDB.milestones.where('goalId').equals(goalId).delete();
        await goalDB.progressSnapshots.where('goalId').equals(goalId).delete();
        await goalDB.goals.delete(goalId);
      }
    );
  }

  // ==================== Milestone CRUD ====================

  /** 为指定目标创建里程碑 */
  static async createMilestone(data: Omit<Milestone, 'id' | 'progress' | 'status' | 'createdAt' | 'updatedAt'>): Promise<string> {
    const now = new Date().toISOString();
    const id = crypto.randomUUID();
    await goalDB.milestones.add({
      ...data,
      id,
      progress: 0,
      status: 'pending',
      createdAt: now,
      updatedAt: now,
    });
    return id;
  }

  /** 获取某目标的所有里程碑 */
  static async getMilestones(goalId: string): Promise<Milestone[]> {
    return goalDB.milestones.where('goalId').equals(goalId).sortBy('sortOrder');
  }

  /** 更新里程碑 */
  static async updateMilestone(msId: string, updates: Partial<Pick<Milestone, 'title' | 'description' | 'deadline' | 'weight' | 'deliverable' | 'acceptanceCriteria' | 'dependencies' | 'sortOrder'>>): Promise<void> {
    await goalDB.milestones.update(msId, {
      ...updates,
      updatedAt: new Date().toISOString(),
    });
  }

  /** 删除里程碑（级联删除周任务和原子项） */
  static async deleteMilestone(msId: string): Promise<void> {
    await goalDB.transaction('rw', [goalDB.milestones, goalDB.weeklyTasks, goalDB.dailyAtoms], async () => {
      const tasks = await goalDB.weeklyTasks.where('milestoneId').equals(msId).toArray();
      for (const task of tasks) {
        await goalDB.dailyAtoms.where('weeklyTaskId').equals(task.id).delete();
      }
      await goalDB.weeklyTasks.where('milestoneId').equals(msId).delete();
      await goalDB.milestones.delete(msId);
    });
  }

  // ==================== WeeklyTask CRUD ====================

  /** 为指定里程碑创建周任务 */
  static async createWeeklyTask(data: Omit<WeeklyTask, 'id' | 'progress' | 'status' | 'createdAt' | 'updatedAt'>): Promise<string> {
    const now = new Date().toISOString();
    const id = crypto.randomUUID();
    await goalDB.weeklyTasks.add({
      ...data,
      id,
      progress: 0,
      status: 'pending',
      createdAt: now,
      updatedAt: now,
    });
    return id;
  }

  /** 获取某里程碑的所有周任务 */
  static async getWeeklyTasks(milestoneId: string): Promise<WeeklyTask[]> {
    return goalDB.weeklyTasks.where('milestoneId').equals(milestoneId).sortBy('sortOrder');
  }

  /** 更新周任务 */
  static async updateWeeklyTask(taskId: string, updates: Partial<Pick<WeeklyTask, 'title' | 'quantityTarget' | 'quantityUnit' | 'weight' | 'sortOrder'>>): Promise<void> {
    await goalDB.weeklyTasks.update(taskId, {
      ...updates,
      updatedAt: new Date().toISOString(),
    });
  }

  /** 删除周任务（级联删除原子项） */
  static async deleteWeeklyTask(taskId: string): Promise<void> {
    await goalDB.transaction('rw', [goalDB.weeklyTasks, goalDB.dailyAtoms], async () => {
      await goalDB.dailyAtoms.where('weeklyTaskId').equals(taskId).delete();
      await goalDB.weeklyTasks.delete(taskId);
    });
  }

  // ==================== DailyAtom CRUD ====================

  /** 为指定周任务创建原子项 */
  static async createDailyAtom(data: Omit<DailyAtom, 'id' | 'isCompleted' | 'completedAt' | 'actualQuantity' | 'checkInId' | 'status' | 'createdAt' | 'updatedAt'>): Promise<string> {
    const now = new Date().toISOString();
    const id = crypto.randomUUID();
    const isOverdue = data.scheduledDate < new Date().toISOString().slice(0, 10);
    await goalDB.dailyAtoms.add({
      ...data,
      id,
      isCompleted: false,
      status: isOverdue ? 'overdue' : 'pending',
      createdAt: now,
      updatedAt: now,
    });
    return id;
  }

  /** 获取某周任务的所有原子项 */
  static async getDailyAtoms(weeklyTaskId: string): Promise<DailyAtom[]> {
    return goalDB.dailyAtoms.where('weeklyTaskId').equals(weeklyTaskId).sortBy('sortOrder');
  }

  /** 根据 ID 获取单个原子项 */
  static async getDailyAtom(atomId: string): Promise<DailyAtom | undefined> {
    return goalDB.dailyAtoms.get(atomId);
  }

  /** 获取今日所有原子项（跨目标聚合，Q1 核心场景） */
  static async getTodayAtoms(): Promise<DailyAtom[]> {
    const today = new Date().toISOString().slice(0, 10);
    return goalDB.dailyAtoms.where('scheduledDate').equals(today).sortBy('sortOrder');
  }

  /**
   * 获取今日原子项及其完整上下文（目标→里程碑→周任务→原子项）
   * 用于今日任务页的目标卡片 + 原子项列表展示
   */
  static async getTodayAtomsWithContext(): Promise<Array<{
    goal: Goal;
    milestone: Milestone;
    weeklyTask: WeeklyTask;
    atom: DailyAtom;
  }>> {
    const atoms = await this.getTodayAtoms();
    if (atoms.length === 0) return [];

    // 收集唯一的上级 ID
    const taskIds = [...new Set(atoms.map((a) => a.weeklyTaskId))];
    const tasks = (await goalDB.weeklyTasks.bulkGet(taskIds)).filter(Boolean) as WeeklyTask[];
    const taskMap = new Map(tasks.map((t) => [t.id, t]));

    const msIds = [...new Set(tasks.map((t) => t.milestoneId))];
    const milestones = (await goalDB.milestones.bulkGet(msIds)).filter(Boolean) as Milestone[];
    const msMap = new Map(milestones.map((m) => [m.id, m]));

    const goalIds = [...new Set(milestones.map((m) => m.goalId))];
    const goals = (await goalDB.goals.bulkGet(goalIds)).filter(Boolean) as Goal[];
    const goalMap = new Map(goals.map((g) => [g.id, g]));

    return atoms
      .map((atom) => {
        const task = taskMap.get(atom.weeklyTaskId);
        const ms = task ? msMap.get(task.milestoneId) : undefined;
        const goal = ms ? goalMap.get(ms.goalId) : undefined;
        if (!goal || !ms || !task) return null;
        return { goal, milestone: ms, weeklyTask: task, atom };
      })
      .filter((item): item is NonNullable<typeof item> => item !== null);
  }

  /** 获取指定日期范围的原子项 */
  static async getAtomsByDateRange(startDate: string, endDate: string): Promise<DailyAtom[]> {
    return goalDB.dailyAtoms
      .where('scheduledDate')
      .between(startDate, endDate, true, true)
      .toArray();
  }

  /** 更新原子项 */
  static async updateDailyAtom(atomId: string, updates: Partial<Pick<DailyAtom, 'title' | 'quantity' | 'estimatedDuration' | 'sortOrder'>>): Promise<void> {
    await goalDB.dailyAtoms.update(atomId, {
      ...updates,
      updatedAt: new Date().toISOString(),
    });
  }

  /** 删除原子项 */
  static async deleteDailyAtom(atomId: string): Promise<void> {
    await goalDB.dailyAtoms.delete(atomId);
  }

  // ==================== 完整目标树查询 ====================

  /** 获取完整的目标四级树 */
  static async getGoalTree(goalId: string): Promise<GoalTree | null> {
    const goal = await goalDB.goals.get(goalId);
    if (!goal) return null;

    const milestones = await goalDB.milestones
      .where('goalId')
      .equals(goalId)
      .sortBy('sortOrder');

    const milestonesWithChildren: MilestoneWithChildren[] = [];

    for (const ms of milestones) {
      const tasks = await goalDB.weeklyTasks
        .where('milestoneId')
        .equals(ms.id)
        .sortBy('sortOrder');

      const tasksWithChildren: WeeklyTaskWithChildren[] = [];

      for (const task of tasks) {
        const atoms = await goalDB.dailyAtoms
          .where('weeklyTaskId')
          .equals(task.id)
          .sortBy('sortOrder');

        tasksWithChildren.push({ ...task, dailyAtoms: atoms });
      }

      milestonesWithChildren.push({ ...ms, weeklyTasks: tasksWithChildren });
    }

    return { goal, milestones: milestonesWithChildren };
  }

  // ==================== 回算操作 ====================

  /** 原子项完成并触发全链路回算 */
  static async completeAtom(atomId: string, actualQuantity?: number): Promise<RollupResult> {
    return completeAtom(atomId, actualQuantity);
  }

  /** 取消原子项完成并触发回算 */
  static async uncompleteAtom(atomId: string): Promise<RollupResult> {
    return uncompleteAtom(atomId);
  }

  /** 手动触发回算 */
  static async rollupFromAtom(atomId: string): Promise<RollupResult> {
    return rollupFromAtom(atomId);
  }

  /** 全量重算目标 */
  static async recalculateAllForGoal(goalId: string): Promise<{ goalProgress: number; milestonesUpdated: number; tasksUpdated: number }> {
    return recalculateAllForGoal(goalId);
  }

  // ==================== 依赖管理 ====================

  /** 检测里程碑循环依赖 */
  static async detectCycle(goalId: string): Promise<string[]> {
    return detectCycle(goalId);
  }

  /** 验证依赖合法性 */
  static async validateDependencies(milestoneId: string, dependencyIds: string[]): Promise<{ valid: boolean; reason?: string }> {
    return validateDependencies(milestoneId, dependencyIds);
  }

  // ==================== 模板引擎 ====================

  /** 获取所有模板元数据 */
  static getTemplateMetas(): TemplateMeta[] {
    return getTemplateMetas();
  }

  /** 获取单个模板 */
  static getTemplateMeta(templateId: string): TemplateMeta | undefined {
    return getTemplateMeta(templateId);
  }

  /** 生成模板拆解结果（不写入DB） */
  static generateTemplate(category: GoalCategory, params: TemplateParams): TemplateResult {
    return generateTemplate(category, params);
  }

  /**
   * 从模板创建目标（完整流程：生成 + 写入DB）
   *
   * @param category - 模板类别
   * @param params - 模板参数
   * @returns 创建的 goalId
   */
  static async createFromTemplate(category: GoalCategory, params: TemplateParams): Promise<string> {
    const result = generateTemplate(category, params);
    const now = new Date().toISOString();
    const goalId = crypto.randomUUID();

    // 建立 milestone ID 映射（模板使用的是 title，真实用 UUID）
    const msIdMap = new Map<number, string>();
    const wtIdMap = new Map<number, string>();

    await goalDB.transaction(
      'rw',
      [goalDB.goals, goalDB.milestones, goalDB.weeklyTasks, goalDB.dailyAtoms],
      async () => {
        // 1. 创建 Goal
        await goalDB.goals.add({
          ...result.goal,
          id: goalId,
          progress: 0,
          status: 'active',
          healthStatus: undefined,
          createdAt: now,
          updatedAt: now,
        } as Goal);

        // 2. 创建 Milestones
        for (let i = 0; i < result.milestones.length; i++) {
          const msId = crypto.randomUUID();
          msIdMap.set(i, msId);
          await goalDB.milestones.add({
            ...result.milestones[i],
            id: msId,
            goalId,
            progress: 0,
            status: 'pending',
            createdAt: now,
            updatedAt: now,
          } as Milestone);
        }

        // 3. 创建 WeeklyTasks（需要建立 milestone 索引映射）
        // 我们按里程碑顺序分配。简单方案：将 weeklyTasks 按 milestone 分组
        const taskGroups: Array<Array<typeof result.weeklyTasks[number]>> = [];
        let taskIdx = 0;
        // 根据每阶段的周数分配任务
        const weeksPerMS = result.milestones.map((_, i) => {
          const msDays = Math.ceil(
            (new Date(result.milestones[i].deadline!).getTime() -
              new Date(result.milestones[i].startDate!).getTime()) /
              (1000 * 60 * 60 * 24)
          );
          return Math.max(1, Math.ceil(msDays / 7));
        });

        for (let i = 0; i < result.milestones.length; i++) {
          const group: Array<typeof result.weeklyTasks[number]> = [];
          for (let w = 0; w < weeksPerMS[i]; w++) {
            if (taskIdx < result.weeklyTasks.length) {
              group.push(result.weeklyTasks[taskIdx]);
              taskIdx++;
            }
          }
          taskGroups.push(group);
        }

        let globalTaskIdx = 0;
        for (let i = 0; i < result.milestones.length; i++) {
          const msId = msIdMap.get(i)!;
          for (let w = 0; w < taskGroups[i].length; w++) {
            const wtId = crypto.randomUUID();
            wtIdMap.set(globalTaskIdx, wtId);
            await goalDB.weeklyTasks.add({
              ...taskGroups[i][w],
              id: wtId,
              milestoneId: msId,
              progress: 0,
              status: 'pending',
              createdAt: now,
              updatedAt: now,
            } as WeeklyTask);
            globalTaskIdx++;
          }
        }

        // 4. 创建 DailyAtoms（同样按周任务分组）
        const atomGroups: Array<Array<typeof result.dailyAtoms[number]>> = [];
        // 按计划开始时间分组
        const sortedTasks = [...result.weeklyTasks].sort(
          (a, b) => a.plannedStart!.localeCompare(b.plannedStart!)
        );
        for (let t = 0; t < sortedTasks.length; t++) {
          const taskStart = sortedTasks[t].plannedStart!;
          const taskEnd = sortedTasks[t].plannedEnd!;
          const group: Array<typeof result.dailyAtoms[number]> = [];
          for (const atom of result.dailyAtoms) {
            if (atom.scheduledDate! >= taskStart && atom.scheduledDate! <= taskEnd) {
              group.push(atom);
            }
          }
          atomGroups.push(group);
        }

        for (let t = 0; t < Math.min(atomGroups.length, wtIdMap.size); t++) {
          const wtId = wtIdMap.get(t)!;
          for (const atom of atomGroups[t]) {
            const isOverdue = atom.scheduledDate! < new Date().toISOString().slice(0, 10);
            await goalDB.dailyAtoms.add({
              ...atom,
              id: crypto.randomUUID(),
              weeklyTaskId: wtId,
              isCompleted: false,
              status: isOverdue ? 'overdue' : 'pending',
              createdAt: now,
              updatedAt: now,
            } as DailyAtom);
          }
        }
      }
    );

    return goalId;
  }

  /** 应用难度自适应 */
  static async applyAdaptiveDifficulty(goalId: string): Promise<{ adjusted: boolean; message: string }> {
    return applyAdaptiveDifficulty(goalId);
  }

  // ==================== 演化引擎 ====================

  /** 检查单个目标健康度 */
  static async checkGoalHealth(goalId: string): Promise<HealthScore> {
    return checkGoalHealth(goalId);
  }

  /** 检查所有活跃目标健康度 */
  static async checkAllActiveGoalsHealth(): Promise<HealthScore[]> {
    return checkAllActiveGoalsHealth();
  }

  /** 获取调整建议 */
  static async generateSuggestions(goalId: string): Promise<AdjustmentSuggestion[]> {
    return generateSuggestions(goalId);
  }

  /** 冲突检测 */
  static async detectConflicts(goalId: string): Promise<ConflictReport[]> {
    return detectConflicts(goalId);
  }

  // ==================== 进度快照 ====================

  /** 创建单个目标快照 */
  static async createProgressSnapshot(goalId: string): Promise<void> {
    return createProgressSnapshot(goalId);
  }

  /** 创建所有活跃目标快照 */
  static async createAllSnapshots(): Promise<number> {
    return createAllSnapshots();
  }

  /** 获取历史进度趋势 */
  static async getProgressTrend(goalId: string, weeks?: number): Promise<Array<{ week: number; progress: number; completedAtoms: number }>> {
    return getProgressTrend(goalId, weeks);
  }
}

// 默认导出
export default GoalEngine;
