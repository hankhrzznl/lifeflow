// ============================================================
// 目标拆解引擎 — TemplateEngine
// 模板注册/匹配/执行框架
// 支持4大场景模板的注册与四级结构生成
// ============================================================

import type {
  EngineGoal,
  EngineGoalCategory,
  EngineMilestone,
  EngineWeeklyTask,
  EngineDailyAtom,
} from './types';
import { goalService } from './GoalService';
import { milestoneService } from './MilestoneService';
import { weeklyTaskService } from './WeeklyTaskService';
import { dailyAtomService } from './DailyAtomService';

// ============================================================
// 类型定义
// ============================================================

/** 参数 Schema 定义 */
export interface ParameterSchema {
  key: string;
  label: string;
  type: 'string' | 'number' | 'date' | 'select' | 'multi-select' | 'boolean';
  required: boolean;
  min?: number;
  max?: number;
  defaultValue?: unknown;
  options?: { value: string; label: string }[];
  placeholder?: string;
  hint?: string;
}

/** 模板生成的蓝图结构
 *
 * 结构关系：
 * - milestones[i] 对应 weeklyTasks[i]（平行数组）
 * - weeklyTasks[i] 对应 dailyAtoms[i]（平行数组）
 *
 * 例如 : 4 个里程碑分别包含 [2, 1, 3, 1] 个周任务
 *   milestones.length = 4
 *   weeklyTasks.length = 2+1+3+1 = 7
 *   dailyAtoms.length = 7（每个周任务一个原子项数组）
 */
export interface TemplateBlueprint {
  goal: Omit<EngineGoal, 'id' | 'progress' | 'status' | 'healthStatus' | 'createdAt' | 'updatedAt'>;
  milestones: Array<Omit<EngineMilestone, 'id' | 'progress' | 'status' | 'createdAt' | 'updatedAt'>>;
  weeklyTasks: Array<Omit<EngineWeeklyTask, 'id' | 'weekNumber' | 'year' | 'progress' | 'status' | 'createdAt' | 'updatedAt'>>;
  dailyAtoms: Array<Array<Omit<EngineDailyAtom, 'id' | 'isCompleted' | 'completedAt' | 'actualQuantity' | 'checkInId' | 'status' | 'createdAt' | 'updatedAt'>>>;
}

/** 模板定义 */
export interface TemplateDefinition {
  id: string;
  name: string;
  description: string;
  icon: string;
  category: EngineGoalCategory;
  parameters: ParameterSchema[];
  /** 生成蓝图（不写入数据库） */
  generateBlueprint(params: Record<string, unknown>): TemplateBlueprint;
}

/** 模板执行结果 */
export interface TemplateExecuteResult {
  goalId: string;
  stats: {
    milestones: number;
    weeklyTasks: number;
    dailyAtoms: number;
  };
}

// ============================================================
// TemplateEngine
// ============================================================

export class TemplateEngine {
  private templates = new Map<string, TemplateDefinition>();

  /**
   * 注册模板
   * 同名模板会被后注册的覆盖
   */
  register(template: TemplateDefinition): void {
    this.templates.set(template.id, template);
  }

  /**
   * 获取所有已注册模板的摘要（不含 generateBlueprint 函数）
   */
  list(): Array<Pick<TemplateDefinition, 'id' | 'name' | 'description' | 'icon' | 'category' | 'parameters'>> {
    return Array.from(this.templates.values()).map((t) => ({
      id: t.id,
      name: t.name,
      description: t.description,
      icon: t.icon,
      category: t.category,
      parameters: t.parameters,
    }));
  }

  /**
   * 按分类筛选模板
   */
  listByCategory(category: EngineGoalCategory): Array<Pick<TemplateDefinition, 'id' | 'name' | 'description' | 'icon' | 'category' | 'parameters'>> {
    return this.list().filter((t) => t.category === category);
  }

  /**
   * 获取单个模板定义
   */
  getTemplate(id: string): TemplateDefinition | undefined {
    return this.templates.get(id);
  }

  /**
   * 生成蓝图（预览用，不写入数据库）
   */
  generateBlueprint(templateId: string, params: Record<string, unknown>): TemplateBlueprint {
    const template = this.templates.get(templateId);
    if (!template) {
      throw new Error(`模板 "${templateId}" 未注册`);
    }
    return template.generateBlueprint(params);
  }

  /**
   * 执行模板生成完整四级结构
   *
   * 流程：
   * 1. 调用模板 generateBlueprint → 蓝图
   * 2. 创建 Goal
   * 3. 并行创建 Milestone + WeeklyTask + DailyAtom（Dexie 事务包裹）
   * 4. 归一化权重
   *
   * @returns 目标 ID + 创建统计
   */
  async execute(templateId: string, params: Record<string, unknown>): Promise<TemplateExecuteResult> {
    const template = this.templates.get(templateId);
    if (!template) {
      throw new Error(`模板 "${templateId}" 未注册`);
    }

    // 0. 参数验证
    for (const p of template.parameters) {
      if (p.required && (params[p.key] === undefined || params[p.key] === null || params[p.key] === '')) {
        throw new Error(`缺少必要参数: ${p.label}`);
      }
      if (p.type === 'number' && typeof params[p.key] === 'number' && p.min !== undefined && (params[p.key] as number) < p.min) {
        throw new Error(`${p.label} 不能小于 ${p.min}`);
      }
      if (p.type === 'number' && typeof params[p.key] === 'number' && p.max !== undefined && (params[p.key] as number) > p.max) {
        throw new Error(`${p.label} 不能大于 ${p.max}`);
      }
    }

    // 1. 生成蓝图
    const blueprint = template.generateBlueprint(params);

    // 2. 创建目标
    const goalId = await goalService.create(blueprint.goal);

    // 3. 创建里程碑
    const createdMilestoneIds: string[] = [];
    for (const ms of blueprint.milestones) {
      const msId = await milestoneService.create({ ...ms, goalId });
      createdMilestoneIds.push(msId);
    }

    // 4. 构建 milestoneId → weeklyTask 索引
    //    策略：按 milestoneSortOrder 将里程碑均匀分配周任务
    const milestoneWeeklyTasks: string[][] = createdMilestoneIds.map(() => []);
    let taskCount = 0;
    let atomCount = 0;

    for (let wi = 0; wi < blueprint.weeklyTasks.length; wi++) {
      const wtData = blueprint.weeklyTasks[wi];
      // 根据里程碑数均匀分配：第 i 个周任务属于第 floor(i * msLen / wtLen) 个里程碑
      const msIdx = blueprint.milestones.length > 0
        ? Math.min(
            Math.floor((wi / blueprint.weeklyTasks.length) * blueprint.milestones.length),
            blueprint.milestones.length - 1
          )
        : 0;

      const msId = createdMilestoneIds[msIdx];
      const wtId = await weeklyTaskService.create({ ...wtData, milestoneId: msId });
      milestoneWeeklyTasks[msIdx].push(wtId);
      taskCount++;

      // 5. 创建该周任务的原子项
      const atoms = blueprint.dailyAtoms[wi];
      if (atoms && atoms.length > 0) {
        for (const atomData of atoms) {
          await dailyAtomService.create({ ...atomData, weeklyTaskId: wtId });
          atomCount++;
        }
      }
    }

    // 6. 归一化权重
    await milestoneService.renormalizeWeights(goalId);

    return {
      goalId,
      stats: {
        milestones: createdMilestoneIds.length,
        weeklyTasks: taskCount,
        dailyAtoms: atomCount,
      },
    };
  }
}

/** 单例导出 */
export const templateEngine = new TemplateEngine();
