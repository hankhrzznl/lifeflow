// ============================================================
// 目标拆解引擎 — Dexie.js 数据库初始化
// 5 张表 + 13 个精确索引，独立 DB 实例避免与主库耦合
// ============================================================

import Dexie, { type Table } from 'dexie';
import type {
  Goal,
  Milestone,
  WeeklyTask,
  DailyAtom,
  GoalProgressSnapshot,
} from '@/types/goal';

/**
 * 目标拆解引擎专用数据库
 *
 * 设计决策：使用独立的 Dexie 实例而非混入主 LifeFlowDB，原因：
 * 1. 独立的版本升级周期，不影响主库
 * 2. 四级模型与主库的 Goal/Plan 模型语义不同，混在一起导致查询歧义
 * 3. 后续可独立迁移到服务端，拆分成本最低
 */
export class GoalEngineDB extends Dexie {
  goals!: Table<Goal, string>;
  milestones!: Table<Milestone, string>;
  weeklyTasks!: Table<WeeklyTask, string>;
  dailyAtoms!: Table<DailyAtom, string>;
  progressSnapshots!: Table<GoalProgressSnapshot, string>;

  constructor() {
    super('LifeFlowGoalEngine');

    // ============================================================
    // v1: 初始版本 — 完整四级模型 + 快照表
    //
    // 索引设计原则：
    // - 每个高频查询场景对应一个精确索引
    // - 复合索引用 [fieldA+fieldB] 语法，Dexie 自动创建
    // - 不创建冗余覆盖索引，保持写入性能
    // ============================================================
    this.version(1).stores({
      // ── L1 目标 ───────────────────────────────────────────
      // 查询场景：
      //   - 按状态筛选列表（active/completed/paused）
      //   - 按类别筛选（exam/fitness/habit/finance）
      //   - 按优先级排序
      //   - 按截止日期排序（即将到期提醒）
      //   - 按健康度筛选（需要关注的目标）
      goals: `
        id,
        status,
        category,
        priority,
        deadline,
        healthStatus
      `,

      // ── L2 里程碑 ─────────────────────────────────────────
      // 查询场景：
      //   - 某目标下全部里程碑（按排序号）
      //   - 某目标下特定状态的里程碑
      //   - 某目标下即将到期的里程碑
      // [goalId+status] 复合索引覆盖了 "某目标下进行中的里程碑"
      milestones: `
        id,
        goalId,
        status,
        deadline,
        [goalId+status],
        [goalId+sortOrder]
      `,

      // ── L3 周度任务 ───────────────────────────────────────
      // 查询场景：
      //   - 某里程碑下全部周任务
      //   - 某里程碑下特定周的任务
      //   - 按周号查询跨里程碑的周任务
      // [milestoneId+weekNumber] 复合索引覆盖周视图查询
      weeklyTasks: `
        id,
        milestoneId,
        status,
        weekNumber,
        [milestoneId+weekNumber],
        [milestoneId+sortOrder]
      `,

      // ── L4 原子项 ─────────────────────────────────────────
      // 查询场景：
      //   - 今日所有原子项（跨目标聚合）— Q1 核心场景
      //   - 今日未完成的原子项
      //   - 某周任务下按日分组的原子项
      // [scheduledDate+isCompleted] 是最高频的索引
      dailyAtoms: `
        id,
        weeklyTaskId,
        scheduledDate,
        isCompleted,
        status,
        [scheduledDate+isCompleted],
        [weeklyTaskId+scheduledDate]
      `,

      // ── 进度快照 ──────────────────────────────────────────
      // 查询场景：
      //   - 某目标的全部历史进度
      //   - 某目标特定周的快照
      // [goalId+year+weekNumber] 三元复合索引覆盖复盘环比
      progressSnapshots: `
        id,
        goalId,
        [goalId+year+weekNumber]
      `,
    });

    // 预留版本升级位置（后续可能需要的变更）：
    // this.version(2).stores({
    //   dailyAtoms: `..., estimatedDuration`,
    // }).upgrade(async (tx) => {
    //   await tx.table('dailyAtoms').toCollection().modify((atom) => {
    //     if (atom.estimatedDuration === undefined) atom.estimatedDuration = 30;
    //   });
    // });
  }
}

/** 单例导出 */
export const goalDB = new GoalEngineDB();

// ============================================================
// 数据库生命周期管理
// ============================================================

/**
 * 初始化目标引擎数据库
 * 应在应用启动时调用，处理可能的版本不兼容等异常
 */
export async function initializeGoalDB(): Promise<{
  success: boolean;
  error?: string;
}> {
  try {
    await goalDB.open();
    return { success: true };
  } catch (err) {
    const error = err as Error;
    if (error.name === 'VersionError') {
      return {
        success: false,
        error: '目标引擎数据库版本不匹配，建议清除后重试',
      };
    }
    if (error.name === 'QuotaExceededError') {
      return {
        success: false,
        error: '存储空间已满，请清理后重试',
      };
    }
    return {
      success: false,
      error: error.message || '数据库初始化失败',
    };
  }
}

/**
 * 清空目标引擎所有数据（危险操作，需用户确认）
 */
export async function clearGoalDB(): Promise<void> {
  await goalDB.transaction(
    'rw',
    [goalDB.goals, goalDB.milestones, goalDB.weeklyTasks, goalDB.dailyAtoms, goalDB.progressSnapshots],
    async () => {
      await goalDB.dailyAtoms.clear();
      await goalDB.weeklyTasks.clear();
      await goalDB.milestones.clear();
      await goalDB.progressSnapshots.clear();
      await goalDB.goals.clear();
    }
  );
}
