import { db } from "./db";
import { callAIStructured } from "./aiClient";
import { createTask } from "./db";
import type { ReviewRecord, Task } from "./types";

// ==================== AI 复盘分析 ====================

interface AIReviewResult {
  summary: string;
  problems: string[];
  improvements: string[];
}

interface ImprovementItem {
  text: string;
  converted: boolean;
  taskId?: number;
}

/**
 * 聚合周期数据供AI分析
 */
async function aggregatePeriodData(start: number, end: number): Promise<{
  taskStats: string;
  goalProgress: string;
  healthData: string;
}> {
  const allTasks = await db.tasks.toArray();
  const periodTasks = allTasks.filter(t => 
    (t.startTime && t.startTime >= start && t.startTime <= end) ||
    (t.createdAt >= start && t.createdAt <= end)
  );

  const done = periodTasks.filter(t => t.status === "done").length;
  const total = periodTasks.length;
  const overdue = periodTasks.filter(t => t.dueDate && t.dueDate < Date.now() && t.status === "active").length;

  const taskStats = `周期内任务: 共${total}个, 完成${done}个(${total > 0 ? Math.round(done/total*100) : 0}%), 逾期${overdue}个`;

  const activeGoals = await db.goals.where("status").equals("active").toArray();
  const goalProgress = activeGoals.map(g => 
    `目标"${g.name}": 进度${g.progress}%, 类型${g.type}, 截止${g.deadline ? new Date(g.deadline).toLocaleDateString("zh-CN") : "无"}`
  ).join("; ");

  // 简单健康数据
  let healthData = "";
  try {
    const waterRecords = await db.dailyWaterRecords
      .where("date")
      .between(
        new Date(start).toISOString().slice(0, 10),
        new Date(end).toISOString().slice(0, 10)
      ).toArray();
    const avgWater = waterRecords.length > 0 
      ? Math.round(waterRecords.reduce((s, r) => s + (r.totalMl || 0), 0) / waterRecords.length) 
      : 0;
    healthData = `日均饮水: ${avgWater}ml`;
  } catch { healthData = "健康数据暂无"; }

  return { taskStats, goalProgress, healthData };
}

/**
 * AI分析复盘数据
 */
export async function analyzeReview(
  start: number,
  end: number,
  currentHighlights: string[],
  currentProblems: string[]
): Promise<AIReviewResult> {
  const { taskStats, goalProgress, healthData } = await aggregatePeriodData(start, end);

  const system = `你是一个专业的复盘分析助手。根据提供的周期数据，给出结构化的复盘分析。

输出格式（严格JSON）：
{
  "summary": "本周期整体表现总结（2-3句话）",
  "problems": ["问题1", "问题2", "问题3"],
  "improvements": ["具体可执行的改进建议1", "建议2", "建议3"]
}

规则：
- summary: 结合完成率、目标进度、健康数据，给出客观总结
- problems: 识别2-3个核心问题，要有数据支撑
- improvements: 给出2-3条具体、可执行、可量化的改进建议
- 如果用户已有手动记录的高亮/问题，请参考并补充，不重复
- 所有输出使用简洁中文`;

  const user = `【周期数据】
${taskStats}
${goalProgress}
${healthData}

【用户已有记录】
亮点: ${currentHighlights.filter(Boolean).join("; ") || "无"}
问题: ${currentProblems.filter(Boolean).join("; ") || "无"}

请分析并给出复盘建议。`;

  const result = await callAIStructured<AIReviewResult>({
    systemPrompt: system,
    userPrompt: user,
    temperature: 0.7,
  });

  return {
    summary: result.summary || "AI分析完成",
    problems: result.problems || [],
    improvements: result.improvements || [],
  };
}

/**
 * 一键采纳改进建议 → 生成任务
 */
export async function adoptImprovements(
  improvements: Array<{ text: string; goalId?: number; planId?: number }>
): Promise<number[]> {
  const taskIds: number[] = [];

  for (const item of improvements) {
    const taskId = await createTask({
      title: `[AI改进] ${item.text}`,
      type: "shortterm",
      status: "active",
      priority: "not-urgent-important",
      tags: ["AI建议", "改进"],
      goalId: item.goalId,
      planId: item.planId,
    } as any);
    taskIds.push(taskId);
  }

  return taskIds;
}
