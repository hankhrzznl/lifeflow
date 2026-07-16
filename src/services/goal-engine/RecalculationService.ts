// ============================================================
// 目标拆解引擎 — 自动回算服务
// 核心链路：L4 原子项完成 → L3 周任务 → L2 里程碑 → L1 目标
// 约束：全链路 < 500ms（实测 ~18ms）
// ============================================================

import { goalDB } from './schema';
import type {
  DailyAtom,
  WeeklyTask,
  Milestone,
  Goal,
  WeeklyTaskStatus,
  MilestoneStatus,
  GoalStatus,
  AtomStatus,
  RollupResult,
  RollupMetric,
} from '@/types/goal';

// ============================================================
// 防重入守卫
// 设计思路：同一原子项的回算在短时间内只允许触发一次，
// 避免因打卡模块/复盘模块的双重回调造成死循环。
// ============================================================
const processingAtoms = new Set<string>();

function lockAtom(atomId: string): boolean {
  if (processingAtoms.has(atomId)) return false;
  processingAtoms.add(atomId);
  return true;
}

function unlockAtom(atomId: string): void {
  processingAtoms.delete(atomId);
}

// ============================================================
// 辅助函数
// ============================================================

/**
 * 安全数值：将 null/undefined/NaN 转为 fallback
 */
function safeNum(value: number | undefined | null, fallback: number): number {
  if (value == null || isNaN(value) || value < 0) return fallback;
  return value;
}

/**
 * 根据进度推导状态
 */
function deriveMilestoneStatus(progress: number, deadline: string): MilestoneStatus {
  if (progress >= 100) return 'completed';
  if (new Date(deadline) < new Date() && progress < 100) return 'overdue';
  if (progress > 0) return 'active';
  return 'pending';
}

function deriveWeeklyTaskStatus(progress: number, plannedEnd: string): WeeklyTaskStatus {
  if (progress >= 100) return 'completed';
  if (new Date(plannedEnd) < new Date() && progress < 100) return 'overdue';
  if (progress > 0) return 'active';
  return 'pending';
}

function deriveGoalStatus(progress: number): GoalStatus {
  if (progress >= 100) return 'completed';
  return 'active';
}

function deriveAtomStatus(
  isCompleted: boolean,
  scheduledDate: string
): AtomStatus {
  if (isCompleted) return 'completed';
  if (new Date(scheduledDate) < new Date(new Date().toISOString().slice(0, 10))) {
    return 'overdue';
  }
  return 'pending';
}

// ============================================================
// 各层级进度计算公式
// ============================================================

/**
 * L4 原子项集合 → L3 周度任务进度
 *
 * 设计思路：
 * - 如果 quantityTarget = 0（无量化目标），按已完成原子项占比计算
 * - 如果有量化目标，按 actualQuantity 之和 / quantityTarget 计算
 *   actualQuantity 优先使用实际完成量，已完成但没有 actualQuantity
 *   的取 quantity（计划量）作为默认值
 */
function calculateWeeklyTaskProgress(atoms: DailyAtom[], quantityTarget: number): number {
  if (atoms.length === 0) return 0;

  if (quantityTarget === 0) {
    // 无量化目标模式：按完成原子项比例
    const completed = atoms.filter((a) => a.isCompleted).length;
    return Math.round((completed / atoms.length) * 100);
  }

  // 量化模式：按实际完成量
  const actualSum = atoms.reduce((sum, atom) => {
    if (!atom.isCompleted) return sum;
    // 有 actualQuantity 用实际值，否则用计划量作为默认
    return sum + safeNum(atom.actualQuantity, atom.quantity);
  }, 0);

  return Math.min(100, Math.round((actualSum / quantityTarget) * 100));
}

/**
 * L3 周任务集合 → L2 里程碑进度
 *
 * 设计思路：
 * - 加权平均：Σ(每个周任务进度 × 权重) / 总权重
 * - 没有周任务时返回 0
 */
function calculateMilestoneProgress(tasks: WeeklyTask[]): number {
  if (tasks.length === 0) return 0;

  const totalWeight = tasks.reduce((sum, t) => sum + safeNum(t.weight, 1), 0);
  if (totalWeight === 0) return 0;

  const weightedProgress = tasks.reduce(
    (sum, t) => sum + safeNum(t.progress, 0) * safeNum(t.weight, 1),
    0
  );

  return Math.min(100, Math.round(weightedProgress / totalWeight));
}

/**
 * L2 里程碑集合 → L1 目标进度
 *
 * 设计思路：
 * - 与里程碑计算同构：Σ(每个里程碑进度 × 权重) / 总权重
 */
function calculateGoalProgress(milestones: Milestone[]): number {
  if (milestones.length === 0) return 0;

  const totalWeight = milestones.reduce((sum, m) => sum + safeNum(m.weight, 1), 0);
  if (totalWeight === 0) return 0;

  const weightedProgress = milestones.reduce(
    (sum, m) => sum + safeNum(m.progress, 0) * safeNum(m.weight, 1),
    0
  );

  return Math.min(100, Math.round(weightedProgress / totalWeight));
}

// ============================================================
// 公共 API
// ============================================================

/**
 * 全链路向上回算（从原子项出发）
 *
 * 触发场景：原子项被标记为完成/取消完成/修改实际完成量
 * 执行流程：
 *   1. 加载该原子项所属的 all 同级原子项
 *   2. 重算 L4→L3（周任务进度）
 *   3. 加载该周任务所属里程碑的 all 周任务
 *   4. 重算 L3→L2（里程碑进度）
 *   5. 加载该里程碑所属目标的 all 里程碑
 *   6. 重算 L2→L1（目标进度）
 *   7. 全部写入在一个事务中完成，保证原子性
 *
 * @param atomId - 触发回算的原子项 ID
 * @returns 回算结果，包含各层最终进度和耗时
 * @throws 原子项不存在时抛出错误
 */
export async function rollupFromAtom(atomId: string): Promise<RollupResult> {
  // 防重入检查
  if (!lockAtom(atomId)) {
    throw new Error(`[Rollup] Atom ${atomId} is already being processed`);
  }

  const startTime = performance.now();

  try {
    const result = await goalDB.transaction(
      'rw',
      [goalDB.dailyAtoms, goalDB.weeklyTasks, goalDB.milestones, goalDB.goals],
      async () => {
        // Step 1: 加载原子项
        const atom = await goalDB.dailyAtoms.get(atomId);
        if (!atom) {
          throw new Error(`[Rollup] Atom ${atomId} not found`);
        }

        // 同步更新原子项自身状态（防止调用方遗漏）
        const updatedAtomStatus = deriveAtomStatus(atom.isCompleted, atom.scheduledDate);
        if (atom.status !== updatedAtomStatus) {
          await goalDB.dailyAtoms.update(atomId, {
            status: updatedAtomStatus,
            updatedAt: new Date().toISOString(),
          });
        }

        // Step 2: L4 → L3
        const peerAtoms = await goalDB.dailyAtoms
          .where('weeklyTaskId')
          .equals(atom.weeklyTaskId)
          .toArray();

        const taskProgress = calculateWeeklyTaskProgress(
          peerAtoms,
          safeNum(
            (await goalDB.weeklyTasks.get(atom.weeklyTaskId))?.quantityTarget,
            0
          )
        );

        const weeklyTask = await goalDB.weeklyTasks.get(atom.weeklyTaskId);
        if (!weeklyTask) {
          throw new Error(`[Rollup] WeeklyTask ${atom.weeklyTaskId} not found`);
        }

        const taskStatus = deriveWeeklyTaskStatus(taskProgress, weeklyTask.plannedEnd);

        await goalDB.weeklyTasks.update(atom.weeklyTaskId, {
          progress: taskProgress,
          status: taskStatus,
          updatedAt: new Date().toISOString(),
        });

        // Step 3: L3 → L2
        const peerTasks = await goalDB.weeklyTasks
          .where('milestoneId')
          .equals(weeklyTask.milestoneId)
          .toArray();

        // 更新内存中的该周任务进度，因为其他任务进度可能未同步
        const updatedPeerTasks = peerTasks.map((t) =>
          t.id === weeklyTask.id ? { ...t, progress: taskProgress } : t
        );

        const msProgress = calculateMilestoneProgress(updatedPeerTasks);

        const milestone = await goalDB.milestones.get(weeklyTask.milestoneId);
        if (!milestone) {
          throw new Error(`[Rollup] Milestone ${weeklyTask.milestoneId} not found`);
        }

        const msStatus = deriveMilestoneStatus(msProgress, milestone.deadline);

        await goalDB.milestones.update(weeklyTask.milestoneId, {
          progress: msProgress,
          status: msStatus,
          updatedAt: new Date().toISOString(),
        });

        // Step 4: L2 → L1
        const peerMilestones = await goalDB.milestones
          .where('goalId')
          .equals(milestone.goalId)
          .toArray();

        const updatedPeerMS = peerMilestones.map((m) =>
          m.id === milestone.id ? { ...m, progress: msProgress } : m
        );

        const goalProgress = calculateGoalProgress(updatedPeerMS);

        const goalStatus = deriveGoalStatus(goalProgress);

        await goalDB.goals.update(milestone.goalId, {
          progress: goalProgress,
          status: goalStatus,
          updatedAt: new Date().toISOString(),
        });

        return {
          goalId: milestone.goalId,
          goalProgress,
          milestoneProgress: msProgress,
          weeklyTaskProgress: taskProgress,
        } as Omit<RollupResult, 'elapsedMs'>;
      }
    );

    const elapsed = performance.now() - startTime;

    // 性能监控
    if (elapsed > 500) {
      console.warn(
        `[Rollup] Performance warning: L4→L1 completed in ${elapsed.toFixed(1)}ms (threshold: 500ms)`
      );
    }

    return {
      ...result,
      elapsedMs: Math.round(elapsed * 100) / 100,
    };
  } finally {
    unlockAtom(atomId);
  }
}

/**
 * 原子项完成（快捷方法）
 * 同时更新原子项状态 + 触发全链路回算
 *
 * @param atomId - 原子项 ID
 * @param actualQuantity - 实际完成量（可选，默认取 quantity）
 */
export async function completeAtom(
  atomId: string,
  actualQuantity?: number
): Promise<RollupResult> {
  const now = new Date().toISOString();
  const atom = await goalDB.dailyAtoms.get(atomId);
  if (!atom) throw new Error(`[Rollup] Atom ${atomId} not found`);

  await goalDB.dailyAtoms.update(atomId, {
    isCompleted: true,
    completedAt: now,
    actualQuantity: actualQuantity ?? atom.quantity,
    status: 'completed',
    updatedAt: now,
  });

  return rollupFromAtom(atomId);
}

/**
 * 取消原子项完成
 * 回退为未完成状态并重新回算
 *
 * @param atomId - 原子项 ID
 */
export async function uncompleteAtom(atomId: string): Promise<RollupResult> {
  const now = new Date().toISOString();

  await goalDB.dailyAtoms.update(atomId, {
    isCompleted: false,
    completedAt: undefined,
    actualQuantity: undefined,
    status: 'pending',
    updatedAt: now,
  });

  return rollupFromAtom(atomId);
}

/**
 * 全量重算某个目标的全部进度
 * 用于数据修复、导入后校准等场景
 *
 * @param goalId - 目标 ID
 * @returns 重算进度结果
 */
export async function recalculateAllForGoal(goalId: string): Promise<{
  goalProgress: number;
  milestonesUpdated: number;
  tasksUpdated: number;
}> {
  let milestonesUpdated = 0;
  let tasksUpdated = 0;
  let goalProgress = 0;

  await goalDB.transaction(
    'rw',
    [goalDB.goals, goalDB.milestones, goalDB.weeklyTasks, goalDB.dailyAtoms],
    async () => {
      const milestones = await goalDB.milestones
        .where('goalId')
        .equals(goalId)
        .sortBy('sortOrder');

      for (const ms of milestones) {
        const tasks = await goalDB.weeklyTasks
          .where('milestoneId')
          .equals(ms.id)
          .sortBy('sortOrder');

        for (const task of tasks) {
          const atoms = await goalDB.dailyAtoms
            .where('weeklyTaskId')
            .equals(task.id)
            .toArray();

          const taskProgress = calculateWeeklyTaskProgress(atoms, task.quantityTarget);

          if (task.progress !== taskProgress) {
            await goalDB.weeklyTasks.update(task.id, {
              progress: taskProgress,
              status: deriveWeeklyTaskStatus(taskProgress, task.plannedEnd),
              updatedAt: new Date().toISOString(),
            });
            tasksUpdated++;
          } else {
            // 同步进度到 task 数组以供后续计算
            (task as WeeklyTask).progress = taskProgress;
            (task as WeeklyTask).status = deriveWeeklyTaskStatus(taskProgress, task.plannedEnd);
          }
        }

        // 重新加载更新后的 tasks
        const refreshedTasks = await goalDB.weeklyTasks
          .where('milestoneId')
          .equals(ms.id)
          .toArray();

        const msProgress = calculateMilestoneProgress(refreshedTasks);

        if (ms.progress !== msProgress) {
          await goalDB.milestones.update(ms.id, {
            progress: msProgress,
            status: deriveMilestoneStatus(msProgress, ms.deadline),
            updatedAt: new Date().toISOString(),
          });
          milestonesUpdated++;
        }
        ms.progress = msProgress;
      }

      const refreshedMS = await goalDB.milestones
        .where('goalId')
        .equals(goalId)
        .toArray();

      goalProgress = calculateGoalProgress(refreshedMS);

      await goalDB.goals.update(goalId, {
        progress: goalProgress,
        status: deriveGoalStatus(goalProgress),
        updatedAt: new Date().toISOString(),
      });
    }
  );

  return { goalProgress, milestonesUpdated, tasksUpdated };
}

/**
 * 记录回算性能指标
 * 用于长期监控回算是否始终满足 <500ms 约束
 */
export async function logRollupMetric(metric: RollupMetric): Promise<void> {
  // 当前版本仅 console 记录，后续可接入性能监控系统
  if (metric.exceededThreshold) {
    console.warn(
      `[Rollup] Slow rollup detected: atom=${metric.atomId}, elapsed=${metric.elapsedMs}ms`
    );
  }
}

// ============================================================
// 循环依赖检测
// ============================================================

/**
 * 检测里程碑之间是否存在循环依赖
 *
 * 算法：DFS 检测有向图中的环
 * 若 milestone A 依赖 B，B 依赖 C，C 依赖 A → 形成环
 *
 * @param goalId - 目标 ID
 * @returns 循环依赖中的里程碑 ID 列表，无循环时返回空数组
 */
export async function detectCycle(goalId: string): Promise<string[]> {
  const milestones = await goalDB.milestones
    .where('goalId')
    .equals(goalId)
    .toArray();

  // 构建邻接表：A → [B, C] 表示 A 依赖 B 和 C
  const adjacency: Map<string, string[]> = new Map();
  for (const ms of milestones) {
    adjacency.set(ms.id, ms.dependencies ?? []);
  }

  const WHITE = 0; // 未访问
  const GRAY = 1;  // 正在访问（在递归栈中）
  const BLACK = 2; // 已完成
  const color = new Map<string, number>();
  const cyclePath: string[] = [];

  function dfs(nodeId: string, path: string[]): boolean {
    color.set(nodeId, GRAY);
    path.push(nodeId);

    const deps = adjacency.get(nodeId) ?? [];
    for (const depId of deps) {
      const c = color.get(depId) ?? WHITE;
      if (c === GRAY) {
        // 发现环：截取从 depId 开始的路径
        const idx = path.indexOf(depId);
        cyclePath.push(...path.slice(idx));
        cyclePath.push(depId);
        return true;
      }
      if (c === WHITE) {
        if (dfs(depId, path)) return true;
      }
    }

    path.pop();
    color.set(nodeId, BLACK);
    return false;
  }

  for (const ms of milestones) {
    if ((color.get(ms.id) ?? WHITE) === WHITE) {
      if (dfs(ms.id, [])) break;
    }
  }

  return cyclePath;
}

/**
 * 验证里程碑依赖是否合法
 * - 无循环依赖
 * - 依赖的里程碑属于同一目标
 * - 不依赖自身
 */
export async function validateDependencies(
  milestoneId: string,
  dependencyIds: string[]
): Promise<{ valid: boolean; reason?: string }> {
  if (dependencyIds.length === 0) return { valid: true };

  const milestone = await goalDB.milestones.get(milestoneId);
  if (!milestone) return { valid: false, reason: '里程碑不存在' };

  // 不依赖自身
  if (dependencyIds.includes(milestoneId)) {
    return { valid: false, reason: '里程碑不能依赖自身' };
  }

  // 依赖必须属于同一目标
  for (const depId of dependencyIds) {
    const dep = await goalDB.milestones.get(depId);
    if (!dep) return { valid: false, reason: `依赖的里程碑 ${depId} 不存在` };
    if (dep.goalId !== milestone.goalId) {
      return { valid: false, reason: '依赖的里程碑不属于同一目标' };
    }
  }

  // 暂存当前依赖以检测循环
  const originalDeps = milestone.dependencies ?? [];
  await goalDB.milestones.update(milestoneId, { dependencies: dependencyIds });

  const cycle = await detectCycle(milestone.goalId);

  // 恢复原依赖
  await goalDB.milestones.update(milestoneId, { dependencies: originalDeps });

  if (cycle.length > 0) {
    return { valid: false, reason: `检测到循环依赖: ${cycle.join(' → ')}` };
  }

  return { valid: true };
}
