import { db } from "./db";
import type { Goal } from "./types";

// ==================== 智能进度预警 ====================

export type WarningLevel = "normal" | "warning" | "danger";

export interface WarningResult {
  level: WarningLevel;
  predictedFinishDate: number | null;
  reason: string;
  suggestions: string[];
}

/**
 * 计算目标进度预警
 */
export async function checkGoalWarning(goalId: number): Promise<WarningResult> {
  const goal = await db.goals.get(goalId);
  if (!goal) return { level: "normal", predictedFinishDate: null, reason: "", suggestions: [] };

  if (goal.status !== "active" || !goal.deadline || goal.progress >= 100) {
    return { level: "normal", predictedFinishDate: null, reason: "", suggestions: [] };
  }

  const now = Date.now();

  // 获取14天内的任务完成数据
  const fourteenDaysAgo = now - 14 * 24 * 60 * 60 * 1000;
  const allTasks = await db.tasks.toArray();
  const recentTasks = allTasks.filter(t => 
    t.goalId === goalId && 
    t.updatedAt >= fourteenDaysAgo
  );

  const doneCount = recentTasks.filter(t => t.status === "done").length;
  const totalCount = recentTasks.length || 1;
  const dailyRate = doneCount / 14; // 日均完成任务数

  // 获取总任务量和剩余任务
  const goalPlans = await db.plans.where("goalId").equals(goalId).toArray();
  const goalPlanIds = new Set(goalPlans.map(p => p.id));
  const allGoalTasks = allTasks.filter(t => 
    t.goalId === goalId || 
    (t.planId != null && goalPlanIds.has(t.planId))
  );

  const remainingTasks = allGoalTasks.filter(t => t.status !== "done" && t.status !== "archived");
  const remainingCount = remainingTasks.length;

  // 预测完成日期
  let predictedFinishDate: number | null = null;
  if (dailyRate > 0 && remainingCount > 0) {
    const daysNeeded = Math.ceil(remainingCount / dailyRate);
    predictedFinishDate = now + daysNeeded * 24 * 60 * 60 * 1000;
  }

  // 判断预警等级
  let level: WarningLevel = "normal";
  let reason = "";
  const suggestions: string[] = [];

  if (goal.deadline && predictedFinishDate) {
    const remainingDays = Math.ceil((goal.deadline - now) / (24 * 60 * 60 * 1000));
    
    if (predictedFinishDate > goal.deadline) {
      const lagPercent = Math.round(((predictedFinishDate - goal.deadline) / (goal.deadline - goal.createdAt + 1)) * 100);
      
      if (lagPercent > 10) {
        level = "danger";
        reason = `预计将滞后${lagPercent}%完成，当前日均完成${dailyRate.toFixed(1)}个任务，无法在截止日期前完成剩余${remainingCount}个任务`;
      } else {
        level = "warning";
        reason = `预计将轻度滞后${lagPercent}%，当前速度需要加快才能按时完成`;
      }
    } else if (goal.progress < (now - goal.createdAt) / (goal.deadline - goal.createdAt) * 100 - 15) {
      level = "warning";
      reason = `进度显著落后于时间进度，当前${goal.progress}%，建议加快执行`;
    }
  } else if (!goal.deadline && goal.progress < 30 && goal.createdAt < now - 30 * 24 * 60 * 60 * 1000) {
    level = "warning";
    reason = "目标已创建超过30天但进度不足30%";
  }

  // 生成建议
  if (level === "danger") {
    suggestions.push(
      `增加每日投入：将日完成量从${dailyRate.toFixed(1)}提升到${Math.ceil(remainingCount / Math.max(1, Math.ceil((goal.deadline! - now) / (24 * 60 * 60 * 1000))))}个`,
      `删减非核心任务：当前有${remainingCount}个待完成任务，考虑移除低优先级项目`,
      `延长截止日期：建议延长${Math.ceil((remainingCount / Math.max(0.1, dailyRate)) - (goal.deadline! - now) / (24 * 60 * 60 * 1000))}天`
    );
  } else if (level === "warning") {
    suggestions.push(
      `适度加快进度：当前日完成${dailyRate.toFixed(1)}个，建议提升到${(dailyRate * 1.2).toFixed(1)}个`,
      `检查逾期任务：关注是否有长期未动的卡点任务`
    );
  }

  // 更新目标的预警信息
  await db.goals.update(goalId, {
    warningLevel: level,
    lastWarningCheck: now,
    predictedFinishDate: predictedFinishDate || undefined,
  });

  return { level, predictedFinishDate, reason, suggestions };
}

/**
 * 批量检测所有活跃目标的预警状态
 */
export async function checkAllGoalsWarnings(): Promise<Map<number, WarningResult>> {
  const activeGoals = await db.goals.where("status").equals("active").toArray();
  const results = new Map<number, WarningResult>();

  for (const goal of activeGoals) {
    const result = await checkGoalWarning(goal.id!);
    if (result.level !== "normal") {
      results.set(goal.id!, result);
    }
  }

  return results;
}

/**
 * 一键应用调整建议
 */
export async function applySuggestion(
  goalId: number,
  suggestionType: "extendDeadline" | "reduceTasks" | "increasePace",
  params?: { days?: number }
): Promise<void> {
  const goal = await db.goals.get(goalId);
  if (!goal) return;

  switch (suggestionType) {
    case "extendDeadline": {
      const days = params?.days || 7;
      const newDeadline = (goal.deadline || Date.now()) + days * 24 * 60 * 60 * 1000;
      await db.goals.update(goalId, { deadline: newDeadline });
      break;
    }
    case "reduceTasks": {
      // 标记最低优先级的1/3任务为归档
      const tasks = await db.tasks.where("goalId").equals(goalId).toArray();
      const lowPriority = tasks
        .filter(t => t.status === "active")
        .sort((a, b) => (a.weight || 1) - (b.weight || 1))
        .slice(0, Math.ceil(tasks.length / 3));
      for (const t of lowPriority) {
        await db.tasks.update(t.id!, { status: "archived" });
      }
      break;
    }
    case "increasePace":
      // 提示性质，无需数据操作
      break;
  }

  // 重新检测更新预警
  await checkGoalWarning(goalId);
}

/**
 * 定时检测（应用启动时调用）
 */
export async function startupWarningCheck(): Promise<Array<{ goalId: number; goalName: string; level: WarningLevel }>> {
  const results = await checkAllGoalsWarnings();
  const warnings: Array<{ goalId: number; goalName: string; level: WarningLevel }> = [];

  for (const [goalId, result] of results) {
    const goal = await db.goals.get(goalId);
    if (goal) {
      warnings.push({ goalId, goalName: goal.name, level: result.level });
    }
  }

  return warnings;
}
