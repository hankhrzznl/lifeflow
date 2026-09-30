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
  recalculateAllForGoal as recalcEngine,
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
import { getGoal as dbGetGoal, getAllGoals as dbGetAllGoals } from "@/lib/db";
import { parseMainGoalId, mainGoalKey } from "@/lib/goalMapping";
import type {
  Milestone,
  WeeklyTask,
  DailyAtom,
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

  // ==================== Goal 读取（主库） ====================

  /** 获取目标（从主库读取） */
  static async getGoal(goalId: number): Promise<import("@/lib/types").Goal | undefined> {
    return dbGetGoal(goalId);
  }

  /** 获取所有目标（从主库读取，内存筛选） */
  static async getAllGoals(filter?: { status?: string; type?: string }): Promise<import("@/lib/types").Goal[]> {
    const all = await dbGetAllGoals();
    if (!filter) return all;
    return all.filter((g) => {
      if (filter.status !== undefined && g.status !== filter.status) return false;
      if (filter.type !== undefined && g.type !== filter.type) return false;
      return true;
    });
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
    goal: import("@/lib/types").Goal;
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

    // 从里程碑的 goalId 解析主库 goalId
    const mainGoalIds: number[] = [];
    for (const ms of milestones) {
      const mgId = parseMainGoalId(ms.goalId);
      if (mgId !== null) {
        mainGoalIds.push(mgId);
      } else {
        console.warn(`[GoalEngine] 里程碑 ${ms.id} 的 goalId "${ms.goalId}" 不是纯数字，跳过`);
      }
    }

    // 从主库读取 Goal
    const { db } = await import("@/lib/db");
    const mainGoals = await db.goals.bulkGet(mainGoalIds);
    const mainGoalMap = new Map(mainGoals.filter(Boolean).map(g => [String(g!.id), g!]));

    return atoms
      .map((atom) => {
        const task = taskMap.get(atom.weeklyTaskId);
        const ms = task ? msMap.get(task.milestoneId) : undefined;
        if (!task || !ms) return null;
        const goal = ms ? mainGoalMap.get(ms.goalId) : undefined;
        if (!goal) return null;
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

  /** 获取完整的目标四级树（从主库读 Goal，从引擎读执行树） */
  static async getGoalTree(goalId: number): Promise<{ goal: import("@/lib/types").Goal; milestones: MilestoneWithChildren[] } | null> {
    const goal = await dbGetGoal(goalId);
    if (!goal) return null;

    const engineKey = mainGoalKey(goalId);
    const milestones = await goalDB.milestones
      .where('goalId')
      .equals(engineKey)
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

  /** 全量重算目标（engine goalId），返回主库 goalId 供回写 */
  static async recalculateAllForGoal(goalId: string): Promise<{ goalProgress: number; mainGoalId: number | null; milestonesUpdated: number; tasksUpdated: number }> {
    const result = await recalcEngine(goalId);
    const mainGoalId = parseMainGoalId(goalId);
    return { ...result, mainGoalId };
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
