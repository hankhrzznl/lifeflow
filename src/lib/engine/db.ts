// ============================================================
// 四级拆解引擎 — EngineDatabase 定义
// 
// 独立 Dexie 实例（DB名: LifeFlowEngine），与主库 LifeFlowDB 完全隔离。
// 
// 设计决策：
// 1. 独立 DB 实例 → 引擎升级不影响主库版本链
// 2. UUID 主键 → 支持离线创建，无需自增冲突
// 3. 结构映射迁移 → 主库 Goal/Plan/Task → 引擎四级模型
// ============================================================

import Dexie, { type Table } from 'dexie';
import { db as mainDB } from '../db';
import type {
  EngineGoal,
  EngineMilestone,
  EngineWeeklyTask,
  EngineDailyAtom,
  EngineProgressSnapshot,
} from './types';

// ============================================================
// EngineDatabase 类
// ============================================================

export class EngineDatabase extends Dexie {
  goals!: Table<EngineGoal, string>;
  milestones!: Table<EngineMilestone, string>;
  weeklyTasks!: Table<EngineWeeklyTask, string>;
  dailyAtoms!: Table<EngineDailyAtom, string>;
  progressSnapshots!: Table<EngineProgressSnapshot, string>;

  constructor() {
    super('LifeFlowEngine');

    this.version(1).stores({
      // ── L1 目标 ───────────────────────────────────────────
      // 查询场景：按状态/类别/优先级/截止日期/健康度筛选
      goals: `
        id,
        status,
        category,
        priority,
        deadline,
        healthStatus
      `,

      // ── L2 里程碑 ─────────────────────────────────────────
      // 查询场景：某目标下的里程碑（按排序/状态筛选）
      milestones: `
        id,
        goalId,
        status,
        deadline,
        [goalId+status],
        [goalId+sortOrder]
      `,

      // ── L3 周任务 ───────────────────────────────────────
      // 查询场景：某里程碑下的周任务（按周号/排序筛选）
      weeklyTasks: `
        id,
        milestoneId,
        status,
        weekNumber,
        [milestoneId+weekNumber],
        [milestoneId+sortOrder]
      `,

      // ── L4 原子项 ─────────────────────────────────────────
      // 查询场景：今日所有原子项（跨目标聚合，最高频查询）
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
      // 查询场景：某目标的历史进度趋势
      progressSnapshots: `
        id,
        goalId,
        [goalId+year+weekNumber]
      `,
    });
  }
}

/** 单例导出 */
export const engineDB = new EngineDatabase();

// ============================================================
// 生命周期管理
// ============================================================

/** 初始化引擎数据库 */
export async function initializeEngineDB(): Promise<{ success: boolean; error?: string }> {
  try {
    await engineDB.open();
    return { success: true };
  } catch (err) {
    const error = err as Error;
    if (error.name === 'VersionError') {
      return { success: false, error: '引擎数据库版本不匹配，建议清除后重试' };
    }
    if (error.name === 'QuotaExceededError') {
      return { success: false, error: '存储空间已满，请清理后重试' };
    }
    return { success: false, error: error.message || '数据库初始化失败' };
  }
}

// ============================================================
// 辅助类型映射函数
// ============================================================

/** 主库 GoalType → 引擎 GoalCategory */
function mapGoalTypeToCategory(type: string): EngineGoal['category'] {
  switch (type) {
    case 'task':    return 'custom';
    case 'fitness': return 'fitness';
    case 'sleep':   return 'habit';
    case 'water':   return 'habit';
    case 'finance': return 'finance';
    default:        return 'custom';
  }
}

/** 主库 Priority → 引擎 GoalPriority */
function mapPriority(priority?: string): EngineGoal['priority'] {
  switch (priority) {
    case 'urgent-important':       return 'p1';
    case 'not-urgent-important':   return 'p2';
    case 'urgent-not-important':   return 'p3';
    default:                       return 'p4';
  }
}

/** 主库 GoalStatus → 引擎 GoalStatus */
function mapGoalStatus(status: string): EngineGoal['status'] {
  if (status === 'active' || status === 'completed' || status === 'paused' || status === 'archived') {
    return status;
  }
  return 'active';
}

/** 时间戳 → ISO date string (YYYY-MM-DD) */
function tsToDateStr(ts: number): string {
  return new Date(ts).toISOString().slice(0, 10);
}

/** 时间戳 → ISO datetime string */
function tsToISODate(ts: number): string {
  return new Date(ts).toISOString();
}

/** 生成 UUID v4 */
function uuid(): string {
  return crypto.randomUUID();
}

/** 获取 ISO 周号 */
function getISOWeekNumber(ts: number): { year: number; week: number } {
  const d = new Date(ts);
  const dayNum = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  const weekNo = Math.ceil(((d.getTime() - yearStart.getTime()) / 86400000 + 1) / 7);
  return { year: d.getUTCFullYear(), week: weekNo };
}

// ============================================================
// 从主库迁移数据
// ============================================================

/**
 * 将主库 goals/plans/tasks 迁移到引擎四级模型
 * 
 * 迁移策略：
 * 1. 主库 Goal → 引擎 Goal（字段映射）
 * 2. 主库 Plan → 引擎 Milestone（字段映射 + 权重分配）
 * 3. 主库 Task → 引擎 WeeklyTask + DailyAtom
 *    - 有 planId 的 task：按 plan 分组 → 每 plan 一个 WeeklyTask
 *    - 每个 task 生成一个 DailyAtom
 * 
 * 约束：
 * - 不删除主库任何数据
 * - 已迁移的数据会跳过（幂等）
 * - 迁移结果记录在 localStorage
 */
export async function migrateFromMainDB(): Promise<{
  goals: number;
  milestones: number;
  weeklyTasks: number;
  dailyAtoms: number;
}> {
  const now = new Date().toISOString();
  const stats = { goals: 0, milestones: 0, weeklyTasks: 0, dailyAtoms: 0 };

  // 检查是否已迁移
  const markerKey = 'lifeflow_engine_migrated_v1';
  if (localStorage.getItem(markerKey)) {
    return stats;
  }

  // 加载主库数据
  const mainGoals = await mainDB.goals.toArray();
  const mainPlans = await mainDB.plans.toArray();
  const mainTasks = await mainDB.tasks
    .filter(t => t.status === 'active' || t.status === 'done')
    .toArray();

  if (mainGoals.length === 0) {
    // 无数据可迁移，标记完成
    localStorage.setItem(markerKey, '1');
    return stats;
  }

  await engineDB.transaction(
    'rw',
    [engineDB.goals, engineDB.milestones, engineDB.weeklyTasks, engineDB.dailyAtoms],
    async () => {
      // ── Step 1: 迁移 Goals ──
      for (const mg of mainGoals) {
        const existing = await engineDB.goals
          .where('title')
          .equals(mg.name)
          .filter(g => g.category === mapGoalTypeToCategory(mg.type))
          .first();

        if (existing) continue; // 跳过重复

        const goalId = uuid();
        await engineDB.goals.add({
          id: goalId,
          title: mg.name,
          description: mg.description || '',
          category: mapGoalTypeToCategory(mg.type),
          priority: mapPriority(mg.priority),
          deadline: mg.deadline ? tsToDateStr(mg.deadline) : tsToDateStr(Date.now() + 90 * 86400000),
          progress: mg.progress || 0,
          status: mapGoalStatus(mg.status),
          successCriteria: undefined,
          createdAt: tsToISODate(mg.createdAt),
          updatedAt: now,
        });
        stats.goals++;

        // ── Step 2: 迁移 Plans → Milestones ──
        const goalPlans = mainPlans.filter(p => p.goalId === mg.id);

        if (goalPlans.length > 0) {
          const weightPerMS = Math.round(100 / goalPlans.length);

          for (let i = 0; i < goalPlans.length; i++) {
            const mp = goalPlans[i];
            const msId = uuid();

            await engineDB.milestones.add({
              id: msId,
              goalId,
              title: mp.name,
              description: undefined,
              startDate: mp.startDate || tsToDateStr(mp.createdAt),
              deadline: mp.endDate || tsToDateStr(mp.createdAt + 30 * 86400000),
              weight: i === goalPlans.length - 1
                ? 100 - weightPerMS * (goalPlans.length - 1)
                : weightPerMS,
              progress: mp.progress || 0,
              status: mp.status === 'completed' ? 'completed' : 'active',
              sortOrder: i,
              createdAt: tsToISODate(mp.createdAt),
              updatedAt: now,
            });
            stats.milestones++;

            // ── Step 3: 迁移 Tasks → WeeklyTask + DailyAtom ──
            const planTasks = mainTasks.filter(t => t.planId === mp.id);
            if (planTasks.length === 0) continue;

            // 每个 Plan 生成一个 WeeklyTask
            const { year, week } = getISOWeekNumber(mp.createdAt);
            const wtId = uuid();

            await engineDB.weeklyTasks.add({
              id: wtId,
              milestoneId: msId,
              title: `${mp.name} · 任务清单`,
              weekNumber: week,
              year,
              plannedStart: mp.startDate || tsToDateStr(mp.createdAt),
              plannedEnd: mp.endDate || tsToDateStr(mp.createdAt + 7 * 86400000),
              quantityTarget: planTasks.length,
              quantityUnit: '项',
              weight: 100,
              progress: planTasks.length > 0
                ? Math.round((planTasks.filter(t => t.status === 'done').length / planTasks.length) * 100)
                : 0,
              status: mp.status === 'completed' ? 'completed' : 'active',
              sortOrder: 0,
              createdAt: now,
              updatedAt: now,
            });
            stats.weeklyTasks++;

            // 每个 Task 生成一个 DailyAtom
            for (let j = 0; j < planTasks.length; j++) {
              const mt = planTasks[j];
              const atomDate = mt.startTime
                ? tsToDateStr(mt.startTime)
                : tsToDateStr(mt.createdAt);
              const isCompleted = mt.status === 'done';

              await engineDB.dailyAtoms.add({
                id: uuid(),
                weeklyTaskId: wtId,
                title: mt.title,
                scheduledDate: atomDate,
                quantity: 1,
                actualQuantity: isCompleted ? 1 : undefined,
                estimatedDuration: undefined,
                isCompleted,
                completedAt: isCompleted ? now : undefined,
                status: isCompleted ? 'completed' :
                        (new Date(atomDate) < new Date(tsToDateStr(Date.now())) ? 'overdue' : 'pending'),
                sortOrder: j,
                createdAt: tsToISODate(mt.createdAt),
                updatedAt: now,
              });
              stats.dailyAtoms++;
            }
          }
        } else {
          // ── 无 Plan 的直挂 Tasks ──
          const directTasks = mainTasks.filter(t =>
            t.goalId === mg.id && (t.planId === undefined || t.planId === null)
          );

          if (directTasks.length === 0) continue;

          // 创建默认里程碑
          const msId = uuid();
          await engineDB.milestones.add({
            id: msId,
            goalId,
            title: '默认阶段',
            description: '从主库任务自动迁移',
            startDate: tsToDateStr(Math.min(...directTasks.map(t => t.createdAt))),
            deadline: tsToDateStr(Date.now() + 90 * 86400000),
            weight: 100,
            progress: Math.round(
              (directTasks.filter(t => t.status === 'done').length / directTasks.length) * 100
            ),
            status: 'active',
            sortOrder: 0,
            createdAt: now,
            updatedAt: now,
          });
          stats.milestones++;

          // 创建默认 WeeklyTask
          const { year, week } = getISOWeekNumber(Date.now());
          const wtId = uuid();
          await engineDB.weeklyTasks.add({
            id: wtId,
            milestoneId: msId,
            title: `${mg.name} · 任务清单`,
            weekNumber: week,
            year,
            plannedStart: tsToDateStr(Date.now()),
            plannedEnd: tsToDateStr(Date.now() + 7 * 86400000),
            quantityTarget: directTasks.length,
            quantityUnit: '项',
            weight: 100,
            progress: directTasks.length > 0
              ? Math.round((directTasks.filter(t => t.status === 'done').length / directTasks.length) * 100)
              : 0,
            status: 'active',
            sortOrder: 0,
            createdAt: now,
            updatedAt: now,
          });
          stats.weeklyTasks++;

          for (let j = 0; j < directTasks.length; j++) {
            const mt = directTasks[j];
            const atomDate = mt.startTime ? tsToDateStr(mt.startTime) : tsToDateStr(mt.createdAt);
            const isCompleted = mt.status === 'done';

            await engineDB.dailyAtoms.add({
              id: uuid(),
              weeklyTaskId: wtId,
              title: mt.title,
              scheduledDate: atomDate,
              quantity: 1,
              actualQuantity: isCompleted ? 1 : undefined,
              estimatedDuration: undefined,
              isCompleted,
              completedAt: isCompleted ? now : undefined,
              status: isCompleted ? 'completed' : 'pending',
              sortOrder: j,
              createdAt: tsToISODate(mt.createdAt),
              updatedAt: now,
            });
            stats.dailyAtoms++;
          }
        }
      }
    }
  );

  // 标记迁移完成
  localStorage.setItem(markerKey, '1');

  return stats;
}

/** 清空引擎数据库（危险操作） */
export async function clearEngineDB(): Promise<void> {
  await engineDB.transaction(
    'rw',
    [engineDB.goals, engineDB.milestones, engineDB.weeklyTasks, engineDB.dailyAtoms, engineDB.progressSnapshots],
    async () => {
      await engineDB.dailyAtoms.clear();
      await engineDB.weeklyTasks.clear();
      await engineDB.milestones.clear();
      await engineDB.progressSnapshots.clear();
      await engineDB.goals.clear();
    }
  );
  // 清除迁移标记
  localStorage.removeItem('lifeflow_engine_migrated_v1');
}
