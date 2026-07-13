import { db } from "./db";
import type { Plan } from "./types";

// ==================== 循环依赖检测 ====================

/**
 * 检查添加 predecessorId 作为 planId 的前置计划是否会形成循环依赖
 * 使用 DFS 遍历依赖图
 */
export async function wouldCreateCycle(
  planId: number,
  predecessorId: number,
  tx?: any
): Promise<boolean> {
  if (planId === predecessorId) return true; // 不能依赖自己

  const visited = new Set<number>();
  
  const check = async (currentId: number): Promise<boolean> => {
    if (currentId === planId) return true; // 形成了回到 planId 的环
    if (visited.has(currentId)) return false;
    visited.add(currentId);

    const table = tx ? tx.table("plans") : db.plans;
    const currentPlan = await table.get(currentId);
    if (!currentPlan || !currentPlan.predecessorPlanIds) return false;

    for (const pid of currentPlan.predecessorPlanIds) {
      if (await check(pid)) return true;
    }
    return false;
  };

  return check(predecessorId);
}

// ==================== 解锁状态计算 ====================

/**
 * 计算计划的解锁状态：所有前置计划均为 completed 时才解锁
 */
export async function calculateUnlockStatus(
  planId: number,
  tx?: any
): Promise<boolean> {
  const table = tx ? tx.table("plans") : db.plans;
  const plan = await table.get(planId);
  if (!plan) return true;

  if (!plan.predecessorPlanIds || plan.predecessorPlanIds.length === 0) {
    return true; // 没有前置依赖，默认解锁
  }

  for (const pid of plan.predecessorPlanIds) {
    const predecessor = await table.get(pid);
    if (!predecessor || predecessor.status !== "completed") {
      return false; // 有未完成的前置计划
    }
  }

  return true;
}

/**
 * 更新单个计划的解锁状态
 */
export async function updatePlanUnlockStatus(
  planId: number,
  tx?: any
): Promise<void> {
  const unlocked = await calculateUnlockStatus(planId, tx);
  const table = tx ? tx.table("plans") : db.plans;
  await table.update(planId, {
    isUnlocked: unlocked,
    updatedAt: Date.now(),
  });
}

// ==================== 级联解锁/加锁 ====================

/**
 * 获取所有将 targetPlanId 作为前置计划的「后置计划」
 */
async function getSuccessorPlans(
  planId: number,
  tx?: any
): Promise<Plan[]> {
  const table = tx ? tx.table("plans") : db.plans;
  const allPlans = await table.toArray();
  return allPlans.filter(
    (p: Plan) => p.predecessorPlanIds && p.predecessorPlanIds.includes(planId)
  );
}

/**
 * 前置计划完成后，级联解锁所有满足条件的后置计划
 */
export async function cascadeUnlock(
  completedPlanId: number,
  tx?: any
): Promise<number[]> {
  const unlockedPlanIds: number[] = [];
  const queue = [completedPlanId];
  const processed = new Set<number>();

  while (queue.length > 0) {
    const currentId = queue.shift()!;
    if (processed.has(currentId)) continue;
    processed.add(currentId);

    const successors = await getSuccessorPlans(currentId, tx);
    for (const successor of successors) {
      if (processed.has(successor.id!)) continue;
      const isUnlocked = await calculateUnlockStatus(successor.id!, tx);
      const table = tx ? tx.table("plans") : db.plans;
      await table.update(successor.id!, {
        isUnlocked,
        updatedAt: Date.now(),
      });
      if (isUnlocked) {
        unlockedPlanIds.push(successor.id!);
        queue.push(successor.id!); // 继续检查该计划的后续
      }
    }
  }

  return unlockedPlanIds;
}

/**
 * 前置计划取消完成时，级联回锁所有后置计划
 */
export async function cascadeLock(
  uncompletedPlanId: number,
  tx?: any
): Promise<number[]> {
  const lockedPlanIds: number[] = [];
  const queue = [uncompletedPlanId];
  const processed = new Set<number>();

  while (queue.length > 0) {
    const currentId = queue.shift()!;
    if (processed.has(currentId)) continue;
    processed.add(currentId);

    const successors = await getSuccessorPlans(currentId, tx);
    for (const successor of successors) {
      if (processed.has(successor.id!)) continue;
      // 只要有一个前置计划未完成，后置计划就应该锁定
      const isUnlocked = await calculateUnlockStatus(successor.id!, tx);
      const table = tx ? tx.table("plans") : db.plans;
      await table.update(successor.id!, {
        isUnlocked,
        updatedAt: Date.now(),
      });
      if (!isUnlocked) {
        lockedPlanIds.push(successor.id!);
        queue.push(successor.id!);
      }
    }
  }

  return lockedPlanIds;
}

// ==================== 依赖关系编辑 ====================

/**
 * 为 planId 添加一个前置计划
 * @throws 如果会形成循环依赖
 */
export async function addPredecessor(
  planId: number,
  predecessorId: number,
  tx?: any
): Promise<void> {
  if (await wouldCreateCycle(planId, predecessorId, tx)) {
    throw new Error("无法设置此依赖关系：会形成循环依赖");
  }

  const table = tx ? tx.table("plans") : db.plans;
  const plan = await table.get(planId);
  if (!plan) throw new Error("计划不存在");

  const currentPredecessors = plan.predecessorPlanIds || [];
  if (currentPredecessors.includes(predecessorId)) {
    return; // 已存在，不重复添加
  }

  await table.update(planId, {
    predecessorPlanIds: [...currentPredecessors, predecessorId],
    updatedAt: Date.now(),
  });

  // 重新计算解锁状态
  await updatePlanUnlockStatus(planId, tx);
}

/**
 * 移除 planId 的一个前置计划
 */
export async function removePredecessor(
  planId: number,
  predecessorId: number,
  tx?: any
): Promise<void> {
  const table = tx ? tx.table("plans") : db.plans;
  const plan = await table.get(planId);
  if (!plan) return;

  const currentPredecessors = plan.predecessorPlanIds || [];
  await table.update(planId, {
    predecessorPlanIds: currentPredecessors.filter((id: number) => id !== predecessorId),
    updatedAt: Date.now(),
  });

  // 重新计算解锁状态
  await updatePlanUnlockStatus(planId, tx);
}

/**
 * 检查计划是否已解锁（可操作任务）
 */
export async function isPlanUnlocked(planId: number): Promise<boolean> {
  const plan = await db.plans.get(planId);
  if (!plan) return true;
  if (plan.isUnlocked !== undefined) return plan.isUnlocked;
  return true;
}

/**
 * 获取计划的所有前置计划详情（含名称、状态）
 */
export async function getPredecessorDetails(planId: number): Promise<Array<{ id: number; name: string; status: string; progress: number }>> {
  const plan = await db.plans.get(planId);
  if (!plan || !plan.predecessorPlanIds || plan.predecessorPlanIds.length === 0) {
    return [];
  }

  const details: Array<{ id: number; name: string; status: string; progress: number }> = [];
  for (const pid of plan.predecessorPlanIds) {
    const predecessor = await db.plans.get(pid);
    if (predecessor) {
      details.push({
        id: pid,
        name: predecessor.name,
        status: predecessor.status,
        progress: predecessor.progress,
      });
    }
  }
  return details;
}
