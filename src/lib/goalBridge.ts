// ============================================================
// 目标→打卡联动桥接层
// 桥接 GoalEngine DB（四级拆解）与主 LifeFlowDB（打卡/任务）
//
// 设计思路（引擎定位落地 v2）：
// - 主库是目标的唯一事实源；引擎是纯执行层（原子项容器+打卡+回算）
// - 同步方向：
//   ① 主库 → 引擎：syncMainGoalTreeToEngine 将主库 Goal→Plan→Task 物化为引擎树
//   ② 引擎 → 主库：writeBackGoalProgress 将引擎回算进度写回主库 Goal/Plan
//   ③ 打卡对齐：createCheckInForAtom 按 mainTaskId 更新主库任务状态
// - 严禁反向同步：主库任务区勾选不反写引擎原子项，避免双向死循环
// ============================================================

import { GoalEngine, goalDB } from "@/services/goal-engine";
import { db } from "./db";
import {
  createGoal, updateGoal, getGoal, getAllGoals,
  createPlan, updatePlan, getPlan, getPlansByGoal,
  createTask, updateTask, getTask,
} from "./db";
import {
  toLocalDateStr, todayLocal, mainGoalKey, parseMainGoalId,
  goalTypeToEngineCategory, mainPriorityToEngine,
  getISOWeekNumber,
} from "./goalMapping";
import type { GoalCategory, Priority as EnginePriority, TemplateParams, WeeklyTask } from "@/types/goal";
import type { Goal, Plan, Task } from "./types";

// ============================================================
// 打卡对齐（mainTaskId 感知）
// ============================================================

/**
 * 原子项完成时，在主 DB 创建或更新对应的打卡记录
 *
 * - 原子项有 mainTaskId → updateTask(mainTaskId, { status: 'done' })
 * - 无 mainTaskId（手建原子项）→ 新建一条 done 任务
 */
export async function createCheckInForAtom(
  atomId: string,
  actualQuantity?: number
): Promise<number | undefined> {
  try {
    const atom = await GoalEngine.getDailyAtom(atomId);
    if (!atom) return undefined;

    // 检查是否已有关联打卡记录
    if (atom.checkInId) return undefined;

    if (atom.mainTaskId) {
      // 有主库任务映射：直接更新任务状态为 done
      await updateTask(atom.mainTaskId, {
        status: "done",
        updatedAt: Date.now(),
      });
      const checkInId = String(atom.mainTaskId);
      await goalDB.dailyAtoms.update(atomId, { checkInId });
      return atom.mainTaskId;
    }

    // 无 mainTaskId：新建打卡任务
    const taskId = await db.tasks.add({
      title: atom.title,
      type: "daily",
      status: "done",
      priority: "not-urgent-not-important",
      tags: ["目标执行"],
      startTime: new Date(atom.scheduledDate + "T00:00:00").getTime(),
      endTime: new Date(atom.scheduledDate + "T23:59:59").getTime(),
      createdAt: Date.now(),
      updatedAt: Date.now(),
    });

    await goalDB.dailyAtoms.update(atomId, { checkInId: String(taskId) });
    return taskId as number;
  } catch (err) {
    console.error("[GoalBridge] 创建打卡记录失败:", err);
    return undefined;
  }
}

/**
 * 原子项取消完成时，清理关联的打卡记录
 *
 * - 有 mainTaskId → 置回 'active'
 * - 无 mainTaskId → 删除打卡任务
 */
export async function removeCheckInForAtom(atomId: string): Promise<void> {
  try {
    const atom = await GoalEngine.getDailyAtom(atomId);
    if (!atom?.checkInId) return;

    if (atom.mainTaskId) {
      // 有主库映射：恢复为 active
      await updateTask(atom.mainTaskId, {
        status: "active",
        updatedAt: Date.now(),
      });
    } else {
      const taskId = parseInt(atom.checkInId);
      if (!isNaN(taskId)) {
        await db.tasks.delete(taskId);
      }
    }
    await goalDB.dailyAtoms.update(atomId, { checkInId: undefined });
  } catch (err) {
    console.error("[GoalBridge] 清理打卡记录失败:", err);
  }
}

// ============================================================
// 主库 → 引擎 生成侧同步
// ============================================================

/**
 * 将主库 Goal → Plan → Task 物化为引擎四级树
 *
 * 幂等三原则：
 * 1. 按 mainPlanId / mainTaskId 查重，已存在则只更新变化字段
 * 2. 周容器按 (milestoneId, year, weekNumber) 复用
 * 3. 主库已删的 plan/task 对应的引擎节点级联删除
 *
 * paused/archived 的 goal/plan：不为它生成新原子项，已有的未来日期原子项置 skipped
 */
export async function syncMainGoalTreeToEngine(goalId: number): Promise<{
  milestones: number;
  weeklyTasks: number;
  atoms: number;
}> {
  const goal = await getGoal(goalId);
  if (!goal) throw new Error(`[GoalBridge] Goal ${goalId} not found`);

  const plans = await getPlansByGoal(goalId);
  const tasks = await db.tasks.where("goalId").equals(goalId).toArray();
  const isPausedOrArchived = goal.status === "paused" || goal.status === "archived";

  const engineGoalId = mainGoalKey(goalId);
  const now = new Date().toISOString();
  let msCount = 0, wtCount = 0, atomCount = 0;

  // 收集已有引擎节点用于级联清理
  const existingMilestones = await goalDB.milestones
    .where("goalId").equals(engineGoalId).toArray();
  const existingMSIds = new Set(existingMilestones.map((m) => m.id));
  const keptMSIds = new Set<string>();

  // 1. 按 Plan → Milestone 映射
  // 同 goal 内按 plan.weight 归一化到总和 100
  const totalPlanWeight = plans.reduce((s, p) => s + (p.weight || 1), 0) || 1;

  for (const plan of plans.sort((a, b) => (a.order || 0) - (b.order || 0))) {
    const planIsPaused = plan.status === "paused" || plan.status === "archived";
    const normalizedWeight = totalPlanWeight > 0
      ? Math.round(((plan.weight || 1) / totalPlanWeight) * 100)
      : 100 / (plans.length || 1);

    // 计算 deadline：plan.endDate → goal.deadline → startDate+30
    let deadline = plan.endDate || undefined;
    if (!deadline && goal.deadline) {
      deadline = toLocalDateStr(new Date(goal.deadline));
    }
    if (!deadline && plan.startDate) {
      const d = new Date(plan.startDate + "T00:00:00");
      d.setDate(d.getDate() + 30);
      deadline = toLocalDateStr(d);
    }

    const startDate = plan.startDate || todayLocal();

    // 查找已有 milestone（按 mainPlanId）
    const existingMS = await goalDB.milestones
      .where("goalId").equals(engineGoalId)
      .filter((m) => m.mainPlanId === plan.id)
      .first();

    let msId: string;
    if (existingMS) {
      msId = existingMS.id;
      await goalDB.milestones.update(msId, {
        title: plan.name,
        startDate,
        deadline: deadline || existingMS.deadline,
        weight: normalizedWeight,
        sortOrder: plan.order || 0,
        mainPlanId: plan.id,
        updatedAt: now,
      });
    } else {
      msId = crypto.randomUUID();
      await goalDB.milestones.add({
        id: msId,
        goalId: engineGoalId,
        mainPlanId: plan.id,
        title: plan.name,
        startDate,
        deadline: deadline || startDate,
        weight: normalizedWeight,
        progress: plan.progress || 0,
        status: plan.status === "completed" ? "completed"
          : plan.status === "paused" ? "active" /* engine doesn't have paused for ms */
          : "pending",
        sortOrder: plan.order || 0,
        createdAt: now,
        updatedAt: now,
      });
    }
    keptMSIds.add(msId);
    msCount++;

    // 获取该 plan 下的 tasks
    const planTasks = tasks.filter((t) => t.planId === plan.id);
    const existingAtoms = await goalDB.dailyAtoms
      .where("mainTaskId").anyOf(planTasks.map((t) => t.id!).filter(Boolean) as number[])
      .toArray();
    const existingAtomTaskIds = new Set(existingAtoms.map((a) => a.mainTaskId).filter(Boolean));

    // 收集需要删除的 atom（主库已删的 task）
    const planTaskIds = new Set(planTasks.map((t) => t.id!).filter(Boolean));
    for (const atom of existingAtoms) {
      if (atom.mainTaskId && !planTaskIds.has(atom.mainTaskId)) {
        await goalDB.dailyAtoms.delete(atom.id);
      }
    }

    // 2. 按 Task → DailyAtom 映射
    for (const task of planTasks) {
      const scheduledDate = task.endTime
        ? toLocalDateStr(new Date(task.endTime))
        : task.startTime
          ? toLocalDateStr(new Date(task.startTime))
          : null;
      if (!scheduledDate) continue; // 无日期不生成 atom

      // paused/archived 的 goal 或 plan：已有 atom 不更新，未来 atom 不创建
      if ((isPausedOrArchived || planIsPaused) && !existingAtomTaskIds.has(task.id!)) {
        continue;
      }

      const { year, weekNumber } = getISOWeekNumber(new Date(scheduledDate + "T00:00:00"));

      // 查找或创建周容器
      let weeklyTask = await goalDB.weeklyTasks
        .where("[milestoneId+weekNumber]")
        .equals([msId, weekNumber])
        .first();
      if (!weeklyTask) {
        const wtId = crypto.randomUUID();
        await goalDB.weeklyTasks.add({
          id: wtId,
          milestoneId: msId,
          title: `第${weekNumber}周`,
          weekNumber,
          year,
          plannedStart: scheduledDate,
          plannedEnd: scheduledDate,
          quantityTarget: 1,
          quantityUnit: "项",
          weight: 1,
          progress: 0,
          status: "pending",
          sortOrder: weekNumber,
          createdAt: now,
          updatedAt: now,
        });
        weeklyTask = { id: wtId, milestoneId: "" } as WeeklyTask;
        wtCount++;
      }

      // 按 mainTaskId 查重 atom
      const existingAtom = existingAtoms.find((a) => a.mainTaskId === task.id);
      if (existingAtom) {
        await goalDB.dailyAtoms.update(existingAtom.id, {
          title: task.title,
          scheduledDate,
          isCompleted: task.status === "done",
          completedAt: task.status === "done" ? new Date(task.updatedAt || Date.now()).toISOString() : undefined,
          status: task.status === "done" ? "completed" : "pending",
          updatedAt: now,
        });
      } else {
        await goalDB.dailyAtoms.add({
          id: crypto.randomUUID(),
          weeklyTaskId: weeklyTask!.id,
          mainTaskId: task.id,
          title: task.title,
          scheduledDate,
          quantity: 1,
          estimatedDuration: 30,
          isCompleted: task.status === "done",
          completedAt: task.status === "done" ? new Date(task.updatedAt || Date.now()).toISOString() : undefined,
          status: task.status === "done" ? "completed" : "pending",
          sortOrder: task.weight || 1,
          createdAt: now,
          updatedAt: now,
        });
      }
      atomCount++;
    }
  }

  // 3. 清理主库已删的 plan 对应的 milestone 及其子树
  for (const ms of existingMilestones) {
    if (!keptMSIds.has(ms.id)) {
      const wts = await goalDB.weeklyTasks.where("milestoneId").equals(ms.id).toArray();
      for (const wt of wts) {
        await goalDB.dailyAtoms.where("weeklyTaskId").equals(wt.id).delete();
      }
      await goalDB.weeklyTasks.where("milestoneId").equals(ms.id).delete();
      await goalDB.milestones.delete(ms.id);
    }
  }

  return { milestones: msCount, weeklyTasks: wtCount, atoms: atomCount };
}

// ============================================================
// 引擎 → 主库 进度回写
// ============================================================

/**
 * 引擎回算后将 milestone.progress → plan.progress，加权汇总 → goal.progress
 *
 * - 跳过 progressLocked 的 plan/goal
 * - progress >= 100 且 status 为 active → completed（仅允许 active→completed 单向）
 */
export async function writeBackGoalProgress(goalId: number): Promise<void> {
  const engineGoalId = mainGoalKey(goalId);
  const goal = await getGoal(goalId);
  if (!goal) return;

  const milestones = await goalDB.milestones
    .where("goalId").equals(engineGoalId).toArray();

  let weightedSum = 0;
  let totalWeight = 0;

  for (const ms of milestones) {
    if (!ms.mainPlanId) continue;
    const plan = await getPlan(ms.mainPlanId);
    if (!plan) continue;
    // 跳过 progressLocked
    if (plan.progressLocked) {
      weightedSum += (plan.progress || 0) * (ms.weight || 1);
      totalWeight += ms.weight || 1;
      continue;
    }

    await updatePlan(ms.mainPlanId, {
      progress: ms.progress,
      updatedAt: Date.now(),
    });

    weightedSum += ms.progress * (ms.weight || 1);
    totalWeight += ms.weight || 1;
  }

  if (totalWeight > 0 && !goal.progressLocked) {
    const newProgress = Math.min(100, Math.round(weightedSum / totalWeight));

    // progress >= 100 且 active → completed（单向）
    const newStatus = newProgress >= 100 && goal.status === "active"
      ? "completed" as const
      : undefined;

    await updateGoal(goalId, {
      progress: newProgress,
      ...(newStatus ? { status: newStatus } : {}),
      updatedAt: Date.now(),
    });
  }
}

// ============================================================
// 聚合查询（主库目标 + 引擎执行数据）
// ============================================================

/**
 * 获取今日目标执行相关的打卡统计
 * 目标元数据来自主库，原子项来自引擎
 */
export async function getTodayGoalCheckInStats(): Promise<{
  totalAtoms: number;
  completedAtoms: number;
  goals: Array<{ title: string; category: string; progress: number; completed: number; total: number }>;
}> {
  const atoms = await GoalEngine.getTodayAtoms();
  const completedAtoms = atoms.filter((a) => a.isCompleted).length;

  // 收集 milestone 以获取 goalId
  const taskIds = [...new Set(atoms.map((a) => a.weeklyTaskId))];
  const tasks = (await goalDB.weeklyTasks.bulkGet(taskIds)).filter(Boolean);
  const msIds = [...new Set(tasks.map((t) => (t as any).milestoneId as string))];
  const milestones = (await goalDB.milestones.bulkGet(msIds)).filter(Boolean);

  // 收集主库 goalId
  const mainGoalIds = new Set<number>();
  const atomGoalMap = new Map<string, number>(); // atomId → mainGoalId
  for (const ms of milestones) {
    const mgId = parseMainGoalId((ms as any).goalId);
    if (mgId !== null) mainGoalIds.add(mgId);
    // 映射 milestone goalId → mainGoalId
    for (const atom of atoms) {
      const wt = tasks.find((t) => (t as any).id === atom.weeklyTaskId);
      if (wt && (wt as any).milestoneId === (ms as any).id) {
        atomGoalMap.set(atom.id, mgId ?? 0);
      }
    }
  }

  // 从主库读取目标
  const mainGoals = mainGoalIds.size > 0
    ? await db.goals.bulkGet([...mainGoalIds])
    : [];
  const mainGoalMap = new Map(mainGoals.filter(Boolean).map((g) => [g!.id, g!]));

  // 按目标聚合
  const goalMap = new Map<number, {
    title: string;
    category: string;
    progress: number;
    completed: number;
    total: number;
  }>();

  for (const atom of atoms) {
    const mgId = atomGoalMap.get(atom.id) ?? 0;
    if (!goalMap.has(mgId)) {
      const mg = mainGoalMap.get(mgId);
      goalMap.set(mgId, {
        title: mg?.name || atom.title,
        category: mg?.type || "task",
        progress: mg?.progress || 0,
        completed: 0,
        total: 0,
      });
    }
    const entry = goalMap.get(mgId)!;
    entry.total++;
    if (atom.isCompleted) entry.completed++;
  }

  return {
    totalAtoms: atoms.length,
    completedAtoms,
    goals: Array.from(goalMap.values()),
  };
}

/**
 * 获取某周期内的目标打卡数据（用于复盘统计）
 */
export async function getGoalStatsForPeriod(
  startDate: string,
  endDate: string
): Promise<{
  totalAtoms: number;
  completedAtoms: number;
  completionRate: number;
}> {
  const atoms = await GoalEngine.getAtomsByDateRange(startDate, endDate);
  const completed = atoms.filter((a) => a.isCompleted).length;

  return {
    totalAtoms: atoms.length,
    completedAtoms: completed,
    completionRate: atoms.length > 0 ? Math.round((completed / atoms.length) * 100) : 0,
  };
}

// ============================================================
// 从模板创建主库目标
// ============================================================

/**
 * 从模板创建目标（主库 + 引擎树同步）
 *
 * 流程：
 * 1. GoalEngine.generateTemplate 获取蓝图
 * 2. 主库 createGoal → createPlan → createTask
 * 3. syncMainGoalTreeToEngine 物化引擎树
 *
 * 任一失败时级联删除已建主库 goal
 */
export async function createMainGoalFromTemplate(
  category: GoalCategory | string,
  params: TemplateParams
): Promise<number> {
  let mainGoalId: number | null = null;
  try {
    const result = GoalEngine.generateTemplate(category as GoalCategory, params);
    const now = Date.now();

    // 1. 创建主库 Goal
    const deadlineStr = (result.goal as any).deadline as string | undefined;
    mainGoalId = await createGoal({
      name: (result.goal as any).title as string || params.goalTitle,
      description: (result.goal as any).description as string || params.goalDescription || "",
      type: category === "exam" ? "task"
        : category === "fitness" ? "fitness"
        : category === "finance" ? "finance"
        : "task",
      deadline: deadlineStr ? new Date(deadlineStr + "T23:59:59").getTime() : undefined,
      priority: params.priority
        ? (params.priority === "p1" ? "urgent-important"
          : params.priority === "p2" ? "not-urgent-important"
          : params.priority === "p3" ? "urgent-not-important"
          : "not-urgent-not-important") as any
        : "not-urgent-important",
      status: "active",
      progress: 0,
      progressLocked: false,
      weight: 1,
    });

    // 2. 创建 Plans（从 milestones）
    for (let i = 0; i < result.milestones.length; i++) {
      const ms = result.milestones[i];
      await createPlan({
        goalId: mainGoalId,
        name: (ms as any).title as string || `阶段${i + 1}`,
        startDate: (ms as any).startDate as string || toLocalDateStr(new Date()),
        endDate: (ms as any).deadline as string || undefined,
        weight: (ms as any).weight as number || 1,
        status: "active",
        progress: 0,
        order: i,
      });
    }

    // 3. 创建 Tasks（从 dailyAtoms）
    const plans = await getPlansByGoal(mainGoalId);
    for (const atom of result.dailyAtoms) {
      const scheduledDate = (atom as any).scheduledDate as string | undefined;
      if (!scheduledDate) continue;

      // 找到对应的 plan（按日期范围匹配，简化：使用第一个匹配的 plan）
      const matchingPlan = plans.find((p) => {
        if (!p.startDate || !p.endDate) return true;
        return scheduledDate >= p.startDate && scheduledDate <= p.endDate;
      });

      await createTask({
        title: (atom as any).title as string || "每日任务",
        type: "daily",
        status: "active",
        goalId: mainGoalId,
        planId: matchingPlan?.id,
        startTime: new Date(scheduledDate + "T00:00:00").getTime(),
        endTime: new Date(scheduledDate + "T23:59:59").getTime(),
      });
    }

    // 4. 同步到引擎
    await syncMainGoalTreeToEngine(mainGoalId);

    return mainGoalId;
  } catch (err) {
    // 失败时级联清理
    if (mainGoalId !== null) {
      try {
        const { deleteGoal } = await import("./db");
        await deleteGoal(mainGoalId, false);
      } catch (err) { console.error("[GoalBridge] 级联清理失败:", err); }
    }
    throw err;
  }
}
