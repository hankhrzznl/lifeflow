import type { Transaction } from "dexie";
import { db } from "./db";
import type { Task, Plan, Goal, GoalStatus, GoalType, Priority } from "./types";
import { cascadeLock, cascadeUnlock } from "./planDependency";

// ==================== 防抖机制 ====================

const debounceTimers = new Map<string, number>();

function debounce(key: string, fn: () => Promise<void>, delay: number = 120): void {
  const existing = debounceTimers.get(key);
  if (existing) clearTimeout(existing);
  const id = window.setTimeout(async () => {
    debounceTimers.delete(key);
    try { await fn(); } catch (err) { console.error("[Linkage] 防抖操作失败:", err); }
  }, delay);
  debounceTimers.set(key, id);
}

// ==================== 辅助函数 ====================

function getTargetStatus(progress: number): GoalStatus {
  if (progress >= 100) return "completed";
  return "active";
}

function safeNumber(v: number | undefined | null, fallback: number): number {
  if (v == null || isNaN(v) || v < 0) return fallback;
  return v;
}

async function getTasksInPlan(planId: number, tx: Transaction): Promise<Task[]> {
  return tx.table("tasks").where("planId").equals(planId).toArray();
}

async function getSubTasks(taskId: number, tx: Transaction): Promise<Task[]> {
  return tx.table("tasks").where("parentTaskId").equals(taskId).toArray();
}

async function calculateTaskProgress(task: Task, tx: Transaction, visited: Set<number>): Promise<number> {
  if (visited.has(task.id!)) return 0;
  visited.add(task.id!);

  const subTasks = await getSubTasks(task.id!, tx);

  if (subTasks.length === 0) {
    return task.status === "done" ? 100 : 0;
  }

  const totalWeight = subTasks.reduce((sum, st) => sum + safeNumber(st.weight, 1), 0);
  if (totalWeight === 0) return 0;

  let weightedProgress = 0;
  for (const subTask of subTasks) {
    const subProgress = await calculateTaskProgress(subTask, tx, visited);
    weightedProgress += (subProgress * safeNumber(subTask.weight, 1)) / totalWeight;
  }

  return Math.round(weightedProgress);
}

async function recalculatePlanProgressInternal(planId: number, tx: Transaction): Promise<void> {
  const visited = new Set<number>();

  const tasks = await getTasksInPlan(planId, tx);
  if (tasks.length === 0) {
    await tx.table("plans").update(planId, { progress: 0 });
    return;
  }

  const totalWeight = tasks.reduce((sum, t) => sum + safeNumber(t.weight, 1), 0);
  if (totalWeight === 0) {
    await tx.table("plans").update(planId, { progress: 0 });
    return;
  }

  let weightedProgress = 0;
  for (const task of tasks) {
    const taskProgress = await calculateTaskProgress(task, tx, visited);
    weightedProgress += (taskProgress * safeNumber(task.weight, 1)) / totalWeight;
  }

  const plan = await tx.table("plans").get(planId);
  if (!plan) return;

  if (!plan.progressLocked) {
    const progress = Math.min(100, Math.round(weightedProgress));
    const settings = await tx.table("userSettings").toArray();
    const autoSyncStatus = settings[0]?.linkageSettings?.autoSyncStatus ?? true;

    const wasCompleted = plan.status === "completed";
    const updates: Partial<Plan> = { progress };
    if (autoSyncStatus) {
      updates.status = getTargetStatus(progress);
    }
    updates.updatedAt = Date.now();

    await tx.table("plans").update(planId, updates);

    // 计划刚完成时级联解锁后置计划
    if (!wasCompleted && progress >= 100) {
      await cascadeUnlock(planId, tx);
    }
    // 计划从完成回退时级联回锁后置计划
    if (wasCompleted && progress < 100) {
      await cascadeLock(planId, tx);
    }

    await recalculateGoalProgressInternal(plan.goalId, tx);
  }
}

// ==================== 量化目标进度计算 ====================

async function calcTaskGoalProgress(goal: Goal, tx: Transaction): Promise<number> {
  const plans = await tx.table("plans").where("goalId").equals(goal.id!).toArray();
  const directTasks = await tx.table("tasks")
    .where("goalId")
    .equals(goal.id!)
    .filter((t: Task) => t.planId === undefined || t.planId === null)
    .toArray();

  if (plans.length === 0 && directTasks.length === 0) return 0;

  let weightedProgress = 0;
  let totalWeight = 0;

  for (const plan of plans) {
    totalWeight += safeNumber(plan.weight, 1);
    weightedProgress += (plan.progress || 0) * safeNumber(plan.weight, 1);
  }

  const visited = new Set<number>();
  for (const task of directTasks) {
    const weight = safeNumber(task.weight, 1);
    totalWeight += weight;
    const taskProgress = await calculateTaskProgress(task, tx, visited);
    weightedProgress += taskProgress * weight;
  }

  if (totalWeight === 0) return 0;
  return Math.min(100, Math.round(weightedProgress / totalWeight));
}

async function calcFitnessGoalProgress(goal: Goal, tx: Transaction): Promise<number> {
  const targetValue = safeNumber(goal.targetValue, 0);
  if (targetValue <= 0) return 0;

  if (!goal.deadline) {
    const records = await tx.table("workouts").toArray();
    const count = records.filter((r: any) => r.goalId === goal.id!).length;
    return Math.min(100, Math.round((count / targetValue) * 100));
  }

  const now = Date.now();
  const startTime = goal.createdAt || (goal.deadline - 30 * 24 * 60 * 60 * 1000);
  if (now > goal.deadline) return 0;

  const records = await tx.table("workouts").toArray();
  const count = records.filter((r: any) =>
    r.goalId === goal.id! &&
    r.startTime >= startTime &&
    r.startTime <= goal.deadline!
  ).length;

  return Math.min(100, Math.round((count / targetValue) * 100));
}

async function calcSleepGoalProgress(goal: Goal, tx: Transaction): Promise<number> {
  const targetTime = typeof window !== "undefined" ? localStorage.getItem("sleep_target") : null;
  if (!targetTime) return 0;

  const [th, tm] = targetTime.split(":").map(Number);
  const targetMinutes = th * 60 + tm;

  if (!goal.deadline) {
    const logs = await tx.table("sleepRecords").toArray();
    const total = logs.length;
    if (total === 0) return 0;
    const met = logs.filter((l: any) => {
      const sleepMin = l.sleepTime ? parseInt(l.sleepTime.split(":")[0]) * 60 + parseInt(l.sleepTime.split(":")[1]) : Infinity;
      return sleepMin <= targetMinutes;
    }).length;
    return Math.min(100, Math.round((met / total) * 100));
  }

  const now = Date.now();
  const startTime = goal.createdAt || (goal.deadline - 30 * 24 * 60 * 60 * 1000);
  if (now > goal.deadline) return 0;

  const logs = await tx.table("sleepRecords").toArray();
  const periodLogs = logs.filter((l: any) => {
    const d = new Date(l.date + "T00:00:00").getTime();
    return d >= startTime && d <= goal.deadline!;
  });

  if (periodLogs.length === 0) return 0;

  const met = periodLogs.filter((l: any) => {
    const sleepMin = l.sleepTime ? parseInt(l.sleepTime.split(":")[0]) * 60 + parseInt(l.sleepTime.split(":")[1]) : Infinity;
    return sleepMin <= targetMinutes;
  }).length;

  return Math.min(100, Math.round((met / periodLogs.length) * 100));
}

async function calcWaterGoalProgress(goal: Goal, tx: Transaction): Promise<number> {
  const targetValue = safeNumber(goal.targetValue, 2000);
  if (targetValue <= 0) return 0;

  if (!goal.deadline) {
    const records = await tx.table("dailyWaterRecords").toArray();
    const total = records.reduce((sum: number, r: any) => sum + (r.totalMl || 0), 0);
    const days = Math.max(1, records.length);
    return Math.min(100, Math.round((total / days / targetValue) * 100));
  }

  const now = Date.now();
  const startTime = goal.createdAt || (goal.deadline - 30 * 24 * 60 * 60 * 1000);
  if (now > goal.deadline) return 0;

  const records = await tx.table("dailyWaterRecords").toArray();
  const periodRecords = records.filter((r: any) => {
    const d = new Date(r.date + "T00:00:00").getTime();
    return d >= startTime && d <= goal.deadline!;
  });

  if (periodRecords.length === 0) return 0;
  const total = periodRecords.reduce((sum: number, r: any) => sum + (r.totalMl || 0), 0);
  const days = Math.max(1, periodRecords.length);
  return Math.min(100, Math.round((total / days / targetValue) * 100));
}

async function calcFinanceGoalProgress(goal: Goal, tx: Transaction): Promise<number> {
  const targetValue = safeNumber(goal.targetValue, 0);
  if (targetValue <= 0) return 0;

  if (!goal.deadline) {
    const records = await tx.table("finRecords").toArray();
    const totalExpense = records
      .filter((r: any) => r.type === "expense")
      .reduce((sum: number, r: any) => sum + (r.amount || 0), 0);
    if (totalExpense <= targetValue) return 100;
    const overBudget = totalExpense - targetValue;
    return Math.max(0, Math.round((1 - overBudget / targetValue) * 100));
  }

  const now = Date.now();
  const startTime = goal.createdAt || (goal.deadline - 30 * 24 * 60 * 60 * 1000);
  if (now > goal.deadline) return 0;

  const records = await tx.table("finRecords").toArray();
  const periodRecords = records.filter((r: any) => {
    const d = new Date(r.date + "T00:00:00").getTime();
    return d >= startTime && d <= goal.deadline!;
  });

  const totalExpense = periodRecords
    .filter((r: any) => r.type === "expense")
    .reduce((sum: number, r: any) => sum + (r.amount || 0), 0);

  if (totalExpense <= targetValue) return 100;
  const overBudget = totalExpense - targetValue;
  return Math.max(0, Math.round((1 - overBudget / targetValue) * 100));
}

// ==================== 统一入口：根据目标类型计算进度 ====================

export async function calculateGoalProgress(goalId: number): Promise<number> {
  const goal = await db.goals.get(goalId);
  if (!goal || !goal.id) return 0;

  let progress = 0;

  await db.transaction("rw", [db.goals, db.plans, db.tasks, db.workouts, db.sleepRecords, db.dailyWaterRecords, db.finRecords, db.userSettings], async (tx) => {
    switch (goal.type) {
      case "task":
        progress = await calcTaskGoalProgress(goal, tx);
        break;
      case "fitness":
        progress = await calcFitnessGoalProgress(goal, tx);
        break;
      case "sleep":
        progress = await calcSleepGoalProgress(goal, tx);
        break;
      case "water":
        progress = await calcWaterGoalProgress(goal, tx);
        break;
      case "finance":
        progress = await calcFinanceGoalProgress(goal, tx);
        break;
      default:
        progress = 0;
    }
  });

  return Math.max(0, Math.min(100, safeNumber(progress, 0)));
}

// ==================== (内部) 目标进度重算 ====================

async function recalculateGoalProgressInternal(goalId: number, tx: Transaction): Promise<void> {
  const goal = await tx.table("goals").get(goalId);
  if (!goal) return;

  if (goal.progressLocked) return;

  let progress = 0;

  switch (goal.type) {
    case "task":
      progress = await calcTaskGoalProgress(goal, tx);
      break;
    case "fitness":
      progress = await calcFitnessGoalProgress(goal, tx);
      break;
    case "sleep":
      progress = await calcSleepGoalProgress(goal, tx);
      break;
    case "water":
      progress = await calcWaterGoalProgress(goal, tx);
      break;
    case "finance":
      progress = await calcFinanceGoalProgress(goal, tx);
      break;
    default:
      progress = 0;
  }

  progress = Math.max(0, Math.min(100, safeNumber(progress, 0)));

  const settings = await tx.table("userSettings").toArray();
  const autoSyncStatus = settings[0]?.linkageSettings?.autoSyncStatus ?? true;

  const updates: Partial<Goal> = { progress };
  if (autoSyncStatus) {
    updates.status = getTargetStatus(progress);
  }
  updates.updatedAt = Date.now();

  await tx.table("goals").update(goalId, updates);
}

// ==================== 公开 API：计划/目标进度重算 ====================

export async function recalculatePlanProgress(planId: number, tx?: Transaction): Promise<void> {
  if (tx) {
    await recalculatePlanProgressInternal(planId, tx);
  } else {
    debounce(`plan-${planId}`, async () => {
      await db.transaction("rw", [db.plans, db.goals, db.tasks, db.userSettings, db.workouts, db.sleepRecords, db.dailyWaterRecords, db.finRecords], async (innerTx) => {
        await recalculatePlanProgressInternal(planId, innerTx);
      });
    });
  }
}

export async function recalculateGoalProgress(goalId: number, tx?: Transaction): Promise<void> {
  if (tx) {
    await recalculateGoalProgressInternal(goalId, tx);
  } else {
    debounce(`goal-${goalId}`, async () => {
      await db.transaction("rw", [db.goals, db.plans, db.tasks, db.userSettings, db.workouts, db.sleepRecords, db.dailyWaterRecords, db.finRecords], async (innerTx) => {
        await recalculateGoalProgressInternal(goalId, innerTx);
      });
    });
  }
}

// ==================== 任务操作 ====================

export async function completeTask(taskId: number): Promise<void> {
  await db.transaction("rw", [db.tasks, db.plans, db.goals, db.userSettings, db.workouts, db.sleepRecords, db.dailyWaterRecords, db.finRecords], async (tx) => {
    const task = await tx.table("tasks").get(taskId);
    if (!task || task.status === "done") return;

    // 检查任务所属计划是否已解锁
    if (task.planId) {
      const plan = await tx.table("plans").get(task.planId);
      if (plan && plan.isUnlocked === false) {
        throw new Error("请先完成所有前置计划");
      }
    }

    await tx.table("tasks").update(taskId, {
      status: "done" as const,
      updatedAt: Date.now(),
    });

    if (task.planId) {
      await recalculatePlanProgressInternal(task.planId, tx);
    } else if (task.goalId) {
      await recalculateGoalProgressInternal(task.goalId, tx);
    }

    if (task.parentTaskId) {
      const parent = await tx.table("tasks").get(task.parentTaskId);
      if (parent) {
        if (parent.planId) {
          await recalculatePlanProgressInternal(parent.planId, tx);
        } else if (parent.goalId) {
          await recalculateGoalProgressInternal(parent.goalId, tx);
        }
      }
    }
  });
}

export async function uncompleteTask(taskId: number): Promise<void> {
  await db.transaction("rw", [db.tasks, db.plans, db.goals, db.userSettings, db.workouts, db.sleepRecords, db.dailyWaterRecords, db.finRecords], async (tx) => {
    const task = await tx.table("tasks").get(taskId);
    if (!task || task.status !== "done") return;

    await tx.table("tasks").update(taskId, {
      status: "active" as const,
      updatedAt: Date.now(),
    });

    if (task.planId) {
      await recalculatePlanProgressInternal(task.planId, tx);
    } else if (task.goalId) {
      await recalculateGoalProgressInternal(task.goalId, tx);
    }

    if (task.parentTaskId) {
      const parent = await tx.table("tasks").get(task.parentTaskId);
      if (parent) {
        if (parent.planId) {
          await recalculatePlanProgressInternal(parent.planId, tx);
        } else if (parent.goalId) {
          await recalculateGoalProgressInternal(parent.goalId, tx);
        }
      }
    }
  });
}

export async function moveTaskToPlan(taskId: number, targetPlanId: number): Promise<void> {
  await db.transaction("rw", [db.tasks, db.plans, db.goals, db.userSettings, db.workouts, db.sleepRecords, db.dailyWaterRecords, db.finRecords], async (tx) => {
    const task = await tx.table("tasks").get(taskId);
    if (!task) return;

    const sourcePlanId = task.planId;

    await tx.table("tasks").update(taskId, {
      planId: targetPlanId,
      updatedAt: Date.now(),
    });

    const targetPlan = await tx.table("plans").get(targetPlanId);
    if (targetPlan) {
      await tx.table("tasks").update(taskId, {
        goalId: targetPlan.goalId,
      });
    }

    if (sourcePlanId) {
      await recalculatePlanProgressInternal(sourcePlanId, tx);
    }

    await recalculatePlanProgressInternal(targetPlanId, tx);
  });
}

export async function deleteTask(taskId: number): Promise<void> {
  await db.transaction("rw", [db.tasks, db.plans, db.goals, db.userSettings], async (tx) => {
    const task = await tx.table("tasks").get(taskId);
    if (!task) return;

    const planId = task.planId;
    const goalId = task.goalId;

    await tx.table("tasks").delete(taskId);

    if (planId) {
      await recalculatePlanProgressInternal(planId, tx);
    } else if (goalId) {
      await recalculateGoalProgressInternal(goalId, tx);
    }
  });
}

// ==================== 批量操作 ====================

export async function batchCompleteTasks(taskIds: number[]): Promise<void> {
  if (taskIds.length === 0) return;

  await db.transaction("rw", [db.tasks, db.plans, db.goals, db.userSettings, db.workouts, db.sleepRecords, db.dailyWaterRecords, db.finRecords], async (tx) => {
    const affectedPlanIds = new Set<number>();
    const affectedGoalIds = new Set<number>();

    for (const taskId of taskIds) {
      const task = await tx.table("tasks").get(taskId);
      if (!task || task.status === "done") continue;

      await tx.table("tasks").update(taskId, {
        status: "done" as const,
        updatedAt: Date.now(),
      });

      if (task.planId) affectedPlanIds.add(task.planId);
      else if (task.goalId) affectedGoalIds.add(task.goalId);

      if (task.parentTaskId) {
        const parent = await tx.table("tasks").get(task.parentTaskId);
        if (parent?.planId) affectedPlanIds.add(parent.planId);
        else if (parent?.goalId) affectedGoalIds.add(parent.goalId);
      }
    }

    for (const pid of affectedPlanIds) {
      await recalculatePlanProgressInternal(pid, tx);
    }
    for (const gid of affectedGoalIds) {
      await recalculateGoalProgressInternal(gid, tx);
    }
  });
}

export async function batchMoveTasks(taskIds: number[], targetPlanId: number): Promise<void> {
  if (taskIds.length === 0) return;

  await db.transaction("rw", [db.tasks, db.plans, db.goals, db.userSettings, db.workouts, db.sleepRecords, db.dailyWaterRecords, db.finRecords], async (tx) => {
    const sourcePlanIds = new Set<number>();

    const targetPlan = await tx.table("plans").get(targetPlanId);

    for (const taskId of taskIds) {
      const task = await tx.table("tasks").get(taskId);
      if (!task) continue;

      if (task.planId) sourcePlanIds.add(task.planId);

      await tx.table("tasks").update(taskId, {
        planId: targetPlanId,
        goalId: targetPlan?.goalId,
        updatedAt: Date.now(),
      });
    }

    for (const pid of sourcePlanIds) {
      await recalculatePlanProgressInternal(pid, tx);
    }
    await recalculatePlanProgressInternal(targetPlanId, tx);
  });
}

export async function batchDeleteTasks(taskIds: number[]): Promise<void> {
  if (taskIds.length === 0) return;

  await db.transaction("rw", [db.tasks, db.plans, db.goals, db.userSettings], async (tx) => {
    const affectedPlanIds = new Set<number>();
    const affectedGoalIds = new Set<number>();

    for (const taskId of taskIds) {
      const task = await tx.table("tasks").get(taskId);
      if (!task) continue;
      if (task.planId) affectedPlanIds.add(task.planId);
      else if (task.goalId) affectedGoalIds.add(task.goalId);
      await tx.table("tasks").delete(taskId);
    }

    for (const pid of affectedPlanIds) {
      await recalculatePlanProgressInternal(pid, tx);
    }
    for (const gid of affectedGoalIds) {
      await recalculateGoalProgressInternal(gid, tx);
    }
  });
}

// ==================== 全量重算 ====================

export async function recalculateAllProgress(): Promise<{ plans: number; goals: number }> {
  let planCount = 0;
  let goalCount = 0;

  await db.transaction("rw", [db.plans, db.goals, db.tasks, db.userSettings, db.workouts, db.sleepRecords, db.dailyWaterRecords, db.finRecords], async (tx) => {
    const allPlans = await tx.table("plans").toArray();
    for (const plan of allPlans) {
      await recalculatePlanProgressInternal(plan.id!, tx);
      planCount++;
    }

    const allGoals = await tx.table("goals").toArray();
    for (const goal of allGoals) {
      await recalculateGoalProgressInternal(goal.id!, tx);
      goalCount++;
    }
  });

  return { plans: planCount, goals: goalCount };
}

// ==================== 数据一致性校验 ====================

export async function validateDataConsistency(): Promise<{ valid: boolean; issues: string[] }> {
  const issues: string[] = [];

  try {
    await db.transaction("r", [db.goals, db.plans, db.tasks, db.workouts, db.sleepRecords, db.dailyWaterRecords, db.finRecords], async (tx) => {
      const allGoals = await tx.table("goals").toArray();
      for (const goal of allGoals) {
        if (goal.progress < 0 || goal.progress > 100 || isNaN(goal.progress)) {
          issues.push(`目标 "${goal.name}" 进度异常: ${goal.progress}`);
        }
        if (goal.status === "completed" && goal.progress < 100 && !goal.progressLocked) {
          issues.push(`目标 "${goal.name}" 状态为已完成但进度不足100%`);
        }
        if (goal.status === "active" && goal.progress >= 100 && !goal.progressLocked) {
          issues.push(`目标 "${goal.name}" 进度已达100%但状态为活跃`);
        }
      }

      const allPlans = await tx.table("plans").toArray();
      for (const plan of allPlans) {
        if (plan.progress < 0 || plan.progress > 100 || isNaN(plan.progress)) {
          issues.push(`计划 "${plan.name}" 进度异常: ${plan.progress}`);
        }
        const goal = await tx.table("goals").get(plan.goalId);
        if (!goal) {
          issues.push(`计划 "${plan.name}" 关联的目标不存在 (goalId=${plan.goalId})`);
        }
      }

      const allTasks = await tx.table("tasks").toArray();
      for (const task of allTasks) {
        if (task.planId) {
          const plan = await tx.table("plans").get(task.planId);
          if (!plan) {
            issues.push(`任务 "${task.title}" 关联的计划不存在 (planId=${task.planId})`);
          }
        }
      }
    });

    if (issues.length === 0) {
      return { valid: true, issues: [] };
    }

    await db.transaction("rw", [db.plans, db.goals, db.tasks, db.userSettings, db.workouts, db.sleepRecords, db.dailyWaterRecords, db.finRecords], async (tx) => {
      const allGoals = await tx.table("goals").toArray();
      for (const goal of allGoals) {
        if (!goal.progressLocked) {
          await recalculateGoalProgressInternal(goal.id!, tx);
        }
      }

      const allPlans = await tx.table("plans").toArray();
      for (const plan of allPlans) {
        if (!plan.progressLocked) {
          await recalculatePlanProgressInternal(plan.id!, tx);
        }
      }
    });

    return { valid: true, issues: [`自动修复了 ${issues.length} 项数据问题`] };
  } catch (err) {
    return { valid: false, issues: [`校验过程异常: ${String(err)}`] };
  }
}

// ==================== 业务记录触发目标重算 ====================

export async function notifyGoalProgressUpdate(goalId: number): Promise<void> {
  debounce(`goal-${goalId}`, async () => {
    await recalculateGoalProgress(goalId);
  });
}

// ==================== 模板生成 ====================

export async function applyGoalTemplate(
  templateId: number,
  projectId: number,
  startDate: string,
  previewOnly: boolean = false
): Promise<{
  goal: Partial<Goal>;
  plans: Array<{
    plan: Partial<Plan>;
    tasks: Array<Partial<Task>>;
  }>;
}> {
  const template = await db.goalTemplates.get(templateId);
  if (!template) throw new Error("模板不存在");

  const startTimestamp = new Date(startDate + "T00:00:00").getTime();
  const deadlineTimestamp = startTimestamp + template.deadlineDays * 24 * 60 * 60 * 1000;

  // 构建目标数据
  const goal: Partial<Goal> = {
    projectId,
    name: template.name,
    description: template.description,
    type: template.type,
    deadline: deadlineTimestamp,
    priority: "not-urgent-important",
    status: "active",
    progress: 0,
    progressLocked: false,
    weight: template.plans.reduce((sum, p) => sum + p.weight, 0),
  };

  // 构建计划与任务数据
  const plansWithTasks = template.plans.map((tp, idx) => {
    const planStart = startTimestamp + tp.daysOffset * 24 * 60 * 60 * 1000;
    const planEnd = idx < template.plans.length - 1
      ? startTimestamp + template.plans[idx + 1].daysOffset * 24 * 60 * 60 * 1000 - 1
      : deadlineTimestamp;

    const plan: Partial<Plan> = {
      goalId: 0, // 将在写入后赋值
      name: tp.name,
      weight: tp.weight,
      status: "active",
      progress: 0,
      order: idx,
      startDate: new Date(planStart).toISOString().slice(0, 10),
      endDate: new Date(planEnd).toISOString().slice(0, 10),
      predecessorPlanIds: idx > 0 ? [] : [], // 第一个计划无前置
      isUnlocked: idx === 0, // 只有第一个计划默认解锁
    };

    // 设置计划间依赖：每个计划的前置是上一个计划
    if (idx > 0) {
      plan.predecessorPlanIds = []; // 实际写入时根据前一个 plan 的 ID 填充
    }

    const tasks = tp.tasks.map((tt, ti) => ({
      title: tt.title,
      type: tt.type as Task["type"],
      status: "active" as const,
      priority: "not-urgent-important" as Priority,
      weight: tt.weight,
      order: ti,
      projectId,
    }));

    return { plan, tasks };
  });

  if (previewOnly) {
    return { goal, plans: plansWithTasks };
  }

  // 写入数据库
  return await db.transaction("rw", [db.goals, db.plans, db.tasks], async (tx) => {
    const goalId = await tx.table("goals").add({
      ...goal,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    });

    const createdPlans: Array<{ plan: Partial<Plan>; tasks: Array<Partial<Task>> }> = [];
    let previousPlanId: number | null = null;

    for (const [idx, pw] of plansWithTasks.entries()) {
      const predecessorIds = idx > 0 && previousPlanId ? [previousPlanId] : [];
      const planId = await tx.table("plans").add({
        ...pw.plan,
        goalId,
        predecessorPlanIds: predecessorIds,
        isUnlocked: idx === 0,
        createdAt: Date.now(),
        updatedAt: Date.now(),
      });

      for (const task of pw.tasks) {
        await tx.table("tasks").add({
          ...task,
          goalId,
          planId,
          createdAt: Date.now(),
          updatedAt: Date.now(),
        } as any);
      }

      createdPlans.push({ plan: { ...pw.plan, goalId, predecessorPlanIds: predecessorIds, isUnlocked: idx === 0 }, tasks: pw.tasks.map(t => ({ ...t, goalId, planId })) });
      previousPlanId = planId;
    }

    return { goal: { ...goal, id: goalId }, plans: createdPlans };
  });
}
