import { db } from "./db";
import { callAIStructured } from "./aiClient";
import type { Goal, Plan, Task } from "./types";

// ==================== AI 目标拆解 ====================

interface AIGeneratedGoal {
  goalName: string;
  goalDescription: string;
  goalType: Goal["type"];
  plans: Array<{
    planName: string;
    planWeight: number;
    daysOffset: number;
    tasks: Array<{
      taskTitle: string;
      taskType: Task["type"];
      taskWeight: number;
    }>;
  }>;
}

function buildDecomposePrompt(
  description: string,
  deadlineDate: string,
  granularity: "rough" | "normal" | "detailed"
): { system: string; user: string } {
  const planCounts = { rough: "2-3", normal: "3-4", detailed: "4-5" };
  const taskCounts = { rough: "2-3", normal: "3-5", detailed: "5-8" };

  const system = `你是一个专业的目标管理助手。你需要根据用户的目标描述，将目标拆解为分阶段的执行计划。

输出格式（严格JSON，不要markdown标记）：
{
  "goalName": "目标名称（精简，10字以内）",
  "goalDescription": "目标描述（一句话概括）",
  "goalType": "task" | "fitness" | "sleep" | "water" | "finance",
  "plans": [
    {
      "planName": "阶段名称",
      "planWeight": 数字(1-5，越大越重要),
      "daysOffset": 数字(该阶段相对开始的偏移天数),
      "tasks": [
        {
          "taskTitle": "任务名称（精简）",
          "taskType": "daily" | "shortterm" | "habit" | "longterm",
          "taskWeight": 数字(1-3)
        }
      ]
    }
  ]
}

规则：
- 计划数量：${planCounts[granularity]}个阶段
- 每个阶段任务：${taskCounts[granularity]}个
- planWeight总和应当反映阶段重要性，第一个阶段通常较小
- daysOffset: 第一个计划为0，后续计划均匀分布在截止日期内
- goalType判断：学习/考试→task，运动/跑步→fitness，睡眠/作息→sleep，饮水→water，储蓄/预算→finance
- 所有名称使用简洁中文`;

  const user = `目标描述：${description}
截止日期：${deadlineDate}
颗粒度：${granularity === "rough" ? "粗略" : granularity === "normal" ? "适中" : "详细"}`;

  return { system, user };
}

/**
 * 预览模式：生成目标结构但不写入数据库
 */
export async function previewGoalDecompose(
  description: string,
  deadlineDate: string,
  granularity: "rough" | "normal" | "detailed" = "normal"
): Promise<AIGeneratedGoal> {
  const { system, user } = buildDecomposePrompt(description, deadlineDate, granularity);

  const result = await callAIStructured<AIGeneratedGoal>({
    systemPrompt: system,
    userPrompt: user,
    temperature: 0.7,
  });

  // 校验和补全
  if (!result.goalName) result.goalName = description.slice(0, 10);
  if (!result.goalType) result.goalType = "task";
  result.plans = result.plans || [];
  result.plans.forEach((p, pi) => {
    if (!p.planName) p.planName = `阶段${pi + 1}`;
    if (!p.planWeight || p.planWeight < 1) p.planWeight = 1;
    if (p.daysOffset === undefined) p.daysOffset = pi * Math.ceil(30 / (result.plans.length || 1));
    p.tasks = p.tasks || [];
    p.tasks.forEach((t, ti) => {
      if (!t.taskTitle) t.taskTitle = `任务${ti + 1}`;
      if (!t.taskType) t.taskType = "daily";
      if (!t.taskWeight || t.taskWeight < 1) t.taskWeight = 1;
    });
  });

  return result;
}

/**
 * 确认生成：写入数据库
 */
export async function applyGoalDecompose(
  projectId: number,
  description: string,
  deadlineDate: string,
  granularity: "rough" | "normal" | "detailed" = "normal"
): Promise<Goal> {
  const preview = await previewGoalDecompose(description, deadlineDate, granularity);

  const startTimestamp = new Date(deadlineDate + "T00:00:00").getTime() 
    - 30 * 24 * 60 * 60 * 1000;
  const deadlineTimestamp = new Date(deadlineDate + "T23:59:59").getTime();

  return await db.transaction("rw", [db.goals, db.plans, db.tasks], async (tx) => {
    const goalId = await tx.table("goals").add({
      projectId,
      name: preview.goalName,
      description: preview.goalDescription || description,
      type: preview.goalType as Goal["type"],
      deadline: deadlineTimestamp,
      priority: "not-urgent-important",
      status: "active",
      progress: 0,
      progressLocked: false,
      weight: preview.plans.reduce((s, p) => s + (p.planWeight || 1), 0),
      isAiGenerated: true,
      aiPrompt: description,
      warningLevel: "normal",
      lastWarningCheck: 0,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    } as any);

    let previousPlanId: number | null = null;

    for (const [idx, pt] of preview.plans.entries()) {
      const planStart = startTimestamp + (pt.daysOffset || 0) * 24 * 60 * 60 * 1000;
      const planEnd = idx < preview.plans.length - 1
        ? startTimestamp + (preview.plans[idx + 1].daysOffset || 0) * 24 * 60 * 60 * 1000 - 1
        : deadlineTimestamp;

      const predecessorIds = idx > 0 && previousPlanId ? [previousPlanId] : [];
      const planId = await tx.table("plans").add({
        goalId,
        name: pt.planName,
        weight: pt.planWeight || 1,
        status: "active",
        progress: 0,
        order: idx,
        startDate: new Date(planStart).toISOString().slice(0, 10),
        endDate: new Date(planEnd).toISOString().slice(0, 10),
        predecessorPlanIds: predecessorIds,
        isUnlocked: idx === 0,
        isAiGenerated: true,
        createdAt: Date.now(),
        updatedAt: Date.now(),
      } as any);

      for (const tt of pt.tasks || []) {
        await tx.table("tasks").add({
          title: tt.taskTitle,
          type: tt.taskType,
          status: "active",
          priority: "not-urgent-important",
          weight: tt.taskWeight || 1,
          goalId,
          planId,
          projectId,
          isAiGenerated: true,
          createdAt: Date.now(),
          updatedAt: Date.now(),
        } as any);
      }

      previousPlanId = planId;
    }

    const goal = await tx.table("goals").get(goalId);
    return goal!;
  });
}

/**
 * 基于现有目标，AI 补充任务
 */
export async function aiSupplementTasks(
  goalId: number,
  goalName: string,
  existingPlanNames: string[]
): Promise<Array<{ planIndex: number; taskTitle: string; taskType: string; taskWeight: number }>> {
  const system = `你是一个目标管理助手。请根据当前目标的已有计划，补充建议缺失的任务。

输出格式（严格JSON）：
{
  "supplements": [
    { "planIndex": 0, "taskTitle": "任务名", "taskType": "daily", "taskWeight": 1 }
  ]
}

planIndex: 对应已有计划的索引（从0开始），可对多个计划补充任务`;

  const user = `目标: ${goalName}
已有计划: ${existingPlanNames.map((n, i) => `${i}. ${n}`).join(", ")}
请为这些计划补充2-4个建议任务。`;

  const result = await callAIStructured<{
    supplements: Array<{ planIndex: number; taskTitle: string; taskType: string; taskWeight: number }>;
  }>({
    systemPrompt: system,
    userPrompt: user,
    temperature: 0.7,
  });

  return result.supplements || [];
}
