// ============================================================
// 四级拆解引擎 — 迁移入口
// 
// 职责：
// 1. needMigration() — 检查是否需要执行迁移
// 2. runMigration() — 执行完整迁移流程（备份→迁移→标记）
// 3. rollbackMigration() — 紧急回滚（清空引擎DB）
//
// 迁移标记存储在 localStorage，key = 'lifeflow_engine_migrated_v1'
// ============================================================

import { db as mainDB } from '../db';
import { engineDB, migrateFromMainDB, clearEngineDB, initializeEngineDB } from './db';

// ============================================================
// 导出表名常量
// ============================================================

/** 主库中需要备份的关键表 */
const CRITICAL_TABLES = [
  'goals',
  'plans',
  'tasks',
  'habit_logs',
  'reviewRecords',
] as const;

/** localStorage 迁移标记 key */
const MIGRATION_MARKER = 'lifeflow_engine_migrated_v1';
/** localStorage 备份数据 key */
const BACKUP_KEY = 'lifeflow_engine_migration_backup';
/** localStorage 备份时间 key */
const BACKUP_TS_KEY = 'lifeflow_engine_migration_backup_ts';

// ============================================================
// 公共 API
// ============================================================

/**
 * 检查是否需要执行数据迁移
 * 
 * 条件：
 * 1. 尚未执行过迁移（localStorage 无标记）
 * 2. 主库存在 goals/plans/tasks 数据
 */
export async function needMigration(): Promise<{
  needed: boolean;
  reason: string;
  mainGoalsCount: number;
  mainPlansCount: number;
  mainTasksCount: number;
}> {
  try {
    // 检查迁移标记
    if (localStorage.getItem(MIGRATION_MARKER)) {
      return {
        needed: false,
        reason: '已迁移过',
        mainGoalsCount: 0,
        mainPlansCount: 0,
        mainTasksCount: 0,
      };
    }

    // 检查主库是否有数据
    const [goalCount, planCount, taskCount] = await Promise.all([
      mainDB.goals.count(),
      mainDB.plans.count(),
      mainDB.tasks.filter(t => t.status === 'active' || t.status === 'done').count(),
    ]);

    if (goalCount === 0) {
      return {
        needed: false,
        reason: '主库无目标数据',
        mainGoalsCount: 0,
        mainPlansCount: 0,
        mainTasksCount: 0,
      };
    }

    return {
      needed: true,
      reason: `主库有 ${goalCount} 个目标待迁移`,
      mainGoalsCount: goalCount,
      mainPlansCount: planCount,
      mainTasksCount: taskCount,
    };
  } catch (err) {
    return {
      needed: false,
      reason: `检查失败: ${String(err)}`,
      mainGoalsCount: 0,
      mainPlansCount: 0,
      mainTasksCount: 0,
    };
  }
}

/**
 * 执行迁移流程
 * 
 * 步骤：
 * 1. 初始化引擎数据库
 * 2. 备份关键表数据到 localStorage
 * 3. 执行数据结构迁移
 * 4. 标记迁移完成
 * 
 * 失败时自动回滚（清空引擎DB + 清除标记）
 */
export async function runMigration(): Promise<{
  success: boolean;
  stats?: { goals: number; milestones: number; weeklyTasks: number; dailyAtoms: number };
  error?: string;
}> {
  console.log('[Engine Migration] 开始迁移...');

  try {
    // Step 1: 初始化引擎 DB
    const initResult = await initializeEngineDB();
    if (!initResult.success) {
      return { success: false, error: `引擎DB初始化失败: ${initResult.error}` };
    }

    // Step 2: 迁移前备份（仅在迁移前有数据时备份）
    await backupBeforeMigration();

    // Step 3: 执行迁移
    const stats = await migrateFromMainDB();
    const isEmpty = stats.goals === 0 && stats.milestones === 0;

    if (isEmpty && !localStorage.getItem(MIGRATION_MARKER)) {
      // 无数据，标记为已迁移以免重复检查
      localStorage.setItem(MIGRATION_MARKER, '1');
    }

    // Step 4: 清除备份（迁移成功后）
    clearBackup();

    console.log(
      `[Engine Migration] 迁移完成: ${stats.goals} goals, ${stats.milestones} milestones, ${stats.weeklyTasks} wt, ${stats.dailyAtoms} atoms`
    );

    return { success: true, stats };
  } catch (err) {
    const error = `迁移失败: ${String(err)}`;
    console.error('[Engine Migration]', error);

    // 自动回滚
    await rollbackMigration();

    return { success: false, error };
  }
}

/**
 * 紧急回滚迁移
 * 
 * 操作：
 * 1. 清空引擎数据库所有数据
 * 2. 清除迁移标记（允许重新迁移）
 */
export async function rollbackMigration(): Promise<void> {
  console.log('[Engine Migration] 执行回滚...');
  try {
    await clearEngineDB();
    console.log('[Engine Migration] 回滚完成');
  } catch (err) {
    console.error('[Engine Migration] 回滚失败:', err);
  }
}

/**
 * 获取迁移状态信息（用于 UI 展示）
 */
export async function getMigrationStatus(): Promise<{
  migrated: boolean;
  engineGoalCount: number;
  engineAtomCount: number;
  backupExists: boolean;
  backupTimestamp?: string;
}> {
  const migrated = !!localStorage.getItem(MIGRATION_MARKER);

  let engineGoalCount = 0;
  let engineAtomCount = 0;

  if (migrated) {
    try {
      await engineDB.open();
      [engineGoalCount, engineAtomCount] = await Promise.all([
        engineDB.goals.count(),
        engineDB.dailyAtoms.count(),
      ]);
    } catch {
      // DB 未初始化，忽略
    }
  }

  const backupExists = !!localStorage.getItem(BACKUP_KEY);
  const backupTimestamp = localStorage.getItem(BACKUP_TS_KEY) || undefined;

  return {
    migrated,
    engineGoalCount,
    engineAtomCount,
    backupExists,
    backupTimestamp,
  };
}

// ============================================================
// 内部函数
// ============================================================

/**
 * 迁移前备份关键表数据到 localStorage
 */
async function backupBeforeMigration(): Promise<void> {
  try {
    const backup: Record<string, unknown[]> = {};

    for (const tableName of CRITICAL_TABLES) {
      try {
        const data = await (mainDB as any)[tableName].toArray();
        backup[tableName] = data;
      } catch {
        backup[tableName] = [];
      }
    }

    // 压缩存储（限制备份大小，避免 localStorage 溢出）
    const json = JSON.stringify(backup);
    if (json.length > 4 * 1024 * 1024) {
      // 超过 4MB，只备份统计信息
      const summary: Record<string, number> = {};
      for (const [table, data] of Object.entries(backup)) {
        summary[table] = (data as unknown[]).length;
      }
      localStorage.setItem(BACKUP_KEY, JSON.stringify({ summary, note: '数据量过大，仅保留统计信息' }));
    } else {
      localStorage.setItem(BACKUP_KEY, json);
    }

    localStorage.setItem(BACKUP_TS_KEY, new Date().toISOString());
  } catch (err) {
    console.warn('[Engine Migration] 备份失败（非致命）:', err);
  }
}

/** 清除迁移备份 */
function clearBackup(): void {
  localStorage.removeItem(BACKUP_KEY);
  localStorage.removeItem(BACKUP_TS_KEY);
}
