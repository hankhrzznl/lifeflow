// ============================================================
// 目标拆解引擎 — EngineRecalculationService
// 核心链路：L4 原子项完成 → L3 周任务 → L2 里程碑 → L1 目标
// 约束：全链路 < 500ms
// ============================================================

import { engineDB } from './db';
import type {
  EngineDailyAtom,
  EngineWeeklyTask,
  EngineMilestone,
  EngineGoal,
  EngineAtomStatus,
  EngineMilestoneStatus,
  EngineGoalStatus,
} from './types';

// ============================================================
// 回算结果
// ============================================================

export interface EngineRollupResult {
  goalId: string;
  goalProgress: number;
  goalStatus: EngineGoalStatus;
  milestoneId: string;
  milestoneProgress: number;
  milestoneStatus: string;
  weeklyTaskProgress: number;
  elapsedMs: number;
}

// ============================================================
// 防重入守卫
// ============================================================

const processingAtoms = new Set<string>();

function lock(atomId: string): boolean {
  if (processingAtoms.has(atomId)) return false;
  processingAtoms.add(atomId);
  return true;
}

function unlock(atomId: string): void {
  processingAtoms.delete(atomId);
}

// ============================================================
// 辅助
// ============================================================

function safeNum(v: number | undefined | null, fallback: number): number {
  if (v == null || isNaN(v) || v < 0) return fallback;
  return v;
}

function deriveAtomStatus(
  isCompleted: boolean,
  scheduledDate: string
): EngineAtomStatus {
  if (isCompleted) return 'completed';
  if (scheduledDate < new Date().toISOString().slice(0, 10)) return 'overdue';
  return 'pending';
}

function deriveStatusFromProgress(
  progress: number,
  deadline: string,
): EngineMilestoneStatus {
  if (progress >= 100) return 'completed';
  if (new Date(deadline + 'T00:00:00') < new Date() && progress < 100) return 'overdue';
  if (progress > 0) return 'active';
  return 'pending';
}

// ============================================================
// 进度计算
// ============================================================

/** L4 → L3：原子项集合 → 周任务进度 */
function calcWeeklyTaskProgress(atoms: EngineDailyAtom[], quantityTarget: number): number {
  if (atoms.length === 0) return 0;
  if (quantityTarget === 0) {
    const done = atoms.filter((a) => a.isCompleted).length;
    return Math.round((done / atoms.length) * 100);
  }
  const actualSum = atoms.reduce((sum, a) =>
    a.isCompleted ? sum + safeNum(a.actualQuantity, a.quantity) : sum, 0
  );
  return Math.min(100, Math.round((actualSum / quantityTarget) * 100));
}

/** L3 → L2：周任务集合 → 里程碑进度 */
function calcMilestoneProgress(tasks: EngineWeeklyTask[]): number {
  if (tasks.length === 0) return 0;
  const totalW = tasks.reduce((s, t) => s + safeNum(t.weight, 1), 0);
  if (totalW === 0) return 0;
  const weighted = tasks.reduce((s, t) => s + safeNum(t.progress, 0) * safeNum(t.weight, 1), 0);
  return Math.min(100, Math.round(weighted / totalW));
}

/** L2 → L1：里程碑集合 → 目标进度 */
function calcGoalProgress(milestones: EngineMilestone[]): number {
  if (milestones.length === 0) return 0;
  const totalW = milestones.reduce((s, m) => s + safeNum(m.weight, 1), 0);
  if (totalW === 0) return 0;
  const weighted = milestones.reduce((s, m) => s + safeNum(m.progress, 0) * safeNum(m.weight, 1), 0);
  return Math.min(100, Math.round(weighted / totalW));
}

// ============================================================
// 公共 API
// ============================================================

/**
 * 全链路向上回算（从原子项出发）
 *
 * 流程：原子项 → 周任务进度 → 里程碑进度 → 目标进度
 * 全部写入在一个 Dexie 事务中完成
 */
export async function engineRollupFromAtom(atomId: string): Promise<EngineRollupResult> {
  if (!lock(atomId)) {
    throw new Error(`[EngineRollup] Atom ${atomId} 正在处理中`);
  }

  const startTime = performance.now();

  try {
    const result = await engineDB.transaction(
      'rw',
      [engineDB.dailyAtoms, engineDB.weeklyTasks, engineDB.milestones, engineDB.goals],
      async () => {
        const atom = await engineDB.dailyAtoms.get(atomId);
        if (!atom) throw new Error(`[EngineRollup] Atom ${atomId} 不存在`);

        // 同步原子项状态
        const atomStatus = deriveAtomStatus(atom.isCompleted, atom.scheduledDate);
        if (atom.status !== atomStatus) {
          await engineDB.dailyAtoms.update(atomId, {
            status: atomStatus,
            updatedAt: new Date().toISOString(),
          });
        }

        // L4 → L3
        const peerAtoms = await engineDB.dailyAtoms
          .where('weeklyTaskId').equals(atom.weeklyTaskId).toArray();
        const wt = await engineDB.weeklyTasks.get(atom.weeklyTaskId);
        if (!wt) throw new Error(`[EngineRollup] WeeklyTask ${atom.weeklyTaskId} 不存在`);

        const wtProgress = calcWeeklyTaskProgress(peerAtoms, wt.quantityTarget);
        const wtStatus = deriveStatusFromProgress(wtProgress, wt.plannedEnd);

        await engineDB.weeklyTasks.update(atom.weeklyTaskId, {
          progress: wtProgress,
          status: wtStatus,
          updatedAt: new Date().toISOString(),
        });

        // L3 → L2
        const peerTasks = await engineDB.weeklyTasks
          .where('milestoneId').equals(wt.milestoneId).toArray();
        const updatedPeerTasks = peerTasks.map((t) =>
          t.id === wt.id ? { ...t, progress: wtProgress } : t
        );
        const msProgress = calcMilestoneProgress(updatedPeerTasks);

        const ms = await engineDB.milestones.get(wt.milestoneId);
        if (!ms) throw new Error(`[EngineRollup] Milestone ${wt.milestoneId} 不存在`);

        const msStatus = deriveStatusFromProgress(msProgress, ms.deadline);
        await engineDB.milestones.update(wt.milestoneId, {
          progress: msProgress,
          status: msStatus,
          updatedAt: new Date().toISOString(),
        });

        // L2 → L1
        const peerMS = await engineDB.milestones
          .where('goalId').equals(ms.goalId).toArray();
        const updatedPeerMS = peerMS.map((m) =>
          m.id === ms.id ? { ...m, progress: msProgress } : m
        );
        const goalProgress = calcGoalProgress(updatedPeerMS);
        const goalStatus = goalProgress >= 100 ? 'completed' as const : 'active' as const;

        await engineDB.goals.update(ms.goalId, {
          progress: goalProgress,
          status: goalStatus,
          updatedAt: new Date().toISOString(),
        });

        return {
          goalId: ms.goalId,
          goalProgress,
          goalStatus,
          milestoneId: wt.milestoneId,
          milestoneProgress: msProgress,
          milestoneStatus: msStatus,
          weeklyTaskProgress: wtProgress,
        };
      }
    );

    const elapsed = performance.now() - startTime;
    if (elapsed > 500) {
      console.warn(`[EngineRollup] 性能警告: ${elapsed.toFixed(0)}ms (阈值 500ms)`);
    }

    return { ...result, elapsedMs: Math.round(elapsed) };
  } finally {
    unlock(atomId);
  }
}

/**
 * 检查目标进度是否跨越里程碑阈值
 * @returns 命中的阈值列表（25/50/75/100）
 */
export function checkProgressMilestones(prevProgress: number, newProgress: number): number[] {
  const thresholds = [25, 50, 75, 100];
  return thresholds.filter((t) => prevProgress < t && newProgress >= t);
}

/**
 * 获取指定目标的前次进度（从 goal 读取当前值，回算前 snapshot）
 */
export async function getGoalPrevProgress(goalId: string): Promise<number> {
  const goal = await engineDB.goals.get(goalId);
  return goal?.progress ?? 0;
}
