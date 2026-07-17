/**
 * PDCA 复盘数据预加载服务
 * Stage 5: 切换至主库 Goal 数据源，时间投入改为批量查询
 */

import { goalDB } from "./schema";
import { GoalEngine } from "./GoalEngine";
import { getAllGoals, db } from "@/lib/db";
import { parseMainGoalId } from "@/lib/goalMapping";
import type { Goal } from "@/lib/types";
import type { DailyAtom } from "@/types/goal";

export interface ReviewData {
  weekRange: { start: string; end: string };
  completion: { completed: number; total: number; rate: number };
  goalProgress: Array<{
    goalId: number; title: string; category: string;
    thisWeek: number; lastWeek: number; change: number;
  }>;
  timeSpent: Record<string, number>;
  insights: {
    bestTime: string; bottleneck: string; trend: string;
  };
  atomsInWeek: DailyAtom[];
  completedTitles: string[];
  goals: Goal[];
}

function addDays(dateStr: string, days: number): string {
  const d = new Date(dateStr + "T00:00:00");
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
}

export class ReviewDataService {
  async loadWeeklyReviewData(weekStart: string): Promise<ReviewData> {
    const weekEnd = addDays(weekStart, 6);

    const atomsInWeek = await GoalEngine.getAtomsByDateRange(weekStart, weekEnd);

    const completed = atomsInWeek.filter((a) => a.isCompleted).length;
    const total = atomsInWeek.length;
    const rate = total > 0 ? Math.round((completed / total) * 100) : 0;

    const completedTitles = atomsInWeek.filter((a) => a.isCompleted).map((a) => a.title);

    // 时间投入 — 批量查询替代 N+1
    const timeSpent: Record<string, number> = {};
    const relevantAtoms = atomsInWeek.filter((a) => a.isCompleted && a.estimatedDuration);
    if (relevantAtoms.length > 0) {
      const weeklyTaskIds = [...new Set(relevantAtoms.map((a) => a.weeklyTaskId))];
      const weeklyTasks = await goalDB.weeklyTasks.bulkGet(weeklyTaskIds);
      const milestoneIds = [...new Set(weeklyTasks.filter(Boolean).map((wt) => wt!.milestoneId))];
      const milestones = await goalDB.milestones.bulkGet(milestoneIds);
      const engineGoalIds = [...new Set(milestones.filter(Boolean).map((ms) => ms!.goalId))];
      const mainGoalIds = engineGoalIds.map((id) => parseMainGoalId(id)).filter(Boolean) as number[];
      const mainGoals = await db.goals.bulkGet(mainGoalIds);
      const goalTypeMap = new Map<number, string>();
      for (const g of mainGoals) {
        if (g) goalTypeMap.set(g.id!, g.type);
      }

      const wtMap = new Map(weeklyTasks.filter(Boolean).map((wt) => [wt!.id, wt!]));
      const msMap = new Map(milestones.filter(Boolean).map((ms) => [ms!.id, ms!]));

      for (const atom of relevantAtoms) {
        const wt = wtMap.get(atom.weeklyTaskId);
        if (!wt) continue;
        const ms = msMap.get(wt.milestoneId);
        if (!ms) continue;
        const mainId = parseMainGoalId(ms.goalId);
        if (mainId === null) continue;
        const type = goalTypeMap.get(mainId);
        if (!type) continue;
        timeSpent[type] = (timeSpent[type] ?? 0) + atom.estimatedDuration!;
      }
    }

    // 目标进度 — 从主库 Goal 中读取，快照仍从引擎读取
    const mainGoals = (await getAllGoals()).filter((g) => g.status === "active");
    const lastWeekEnd = addDays(weekStart, -1);

    const goalProgress: ReviewData["goalProgress"] = [];
    for (const goal of mainGoals) {
      const thisWeek = goal.progress;
      let lastWeek = 0;
      let hasSnapshot = false;
      try {
        const lastSnapshots = await goalDB.progressSnapshots
          .where("goalId").equals(String(goal.id)).toArray();
        const lastSnap = lastSnapshots
          .filter((s) => s.snapshotDate <= lastWeekEnd)
          .sort((a, b) => b.snapshotDate.localeCompare(a.snapshotDate))[0];
        if (lastSnap) {
          lastWeek = lastSnap.progress;
          hasSnapshot = true;
        }
      } catch { /* no snapshot */ }

      if (!hasSnapshot) continue;

      goalProgress.push({
        goalId: goal.id!, title: goal.name, category: goal.type,
        thisWeek, lastWeek, change: thisWeek - lastWeek,
      });
    }

    const insights = this.generateInsights(atomsInWeek, rate, goalProgress);

    return {
      weekRange: { start: weekStart, end: weekEnd },
      completion: { completed, total, rate },
      goalProgress, timeSpent, insights,
      atomsInWeek, completedTitles, goals: mainGoals,
    };
  }

  generateInsights(
    atoms: DailyAtom[],
    rate: number,
    goalProgress: Array<{ goalId: number; title: string; thisWeek: number; change: number }>
  ): ReviewData["insights"] {
    const hourBuckets = new Map<number, number>();
    for (const atom of atoms) {
      if (!atom.isCompleted || !atom.completedAt) continue;
      const h = new Date(atom.completedAt).getHours();
      hourBuckets.set(h, (hourBuckets.get(h) ?? 0) + 1);
    }
    let bestHour = 7, maxCount = 0;
    for (const [h, c] of hourBuckets) { if (c > maxCount) { maxCount = c; bestHour = h; } }
    const period = bestHour < 9 ? "早上" : bestHour < 12 ? "上午" : bestHour < 14 ? "中午" : bestHour < 18 ? "下午" : "晚上";
    const bestTime = `${period} ${bestHour}点左右效率最高 (${maxCount}次完成)`;

    const dayBuckets = new Map<number, { total: number; done: number }>();
    for (const atom of atoms) {
      const dayIdx = new Date(atom.scheduledDate + "T00:00:00").getDay();
      if (!dayBuckets.has(dayIdx)) dayBuckets.set(dayIdx, { total: 0, done: 0 });
      const b = dayBuckets.get(dayIdx)!;
      b.total++; if (atom.isCompleted) b.done++;
    }
    let worstDay = 1, worstRate = 1.0;
    for (const [d, b] of dayBuckets) {
      if (b.total === 0) continue;
      const r = b.done / b.total; if (r < worstRate) { worstRate = r; worstDay = d; }
    }
    const dayNames = ["日", "一", "二", "三", "四", "五", "六"];
    const bottleneck = `周${dayNames[worstDay]}完成率最低 (${Math.round(worstRate * 100)}%)`;

    const totalChange = goalProgress.reduce((s, g) => s + g.change, 0);
    const trend = totalChange > 0
      ? `整体进度比上周提升 ${totalChange > 10 ? "显著" : ""}（+${totalChange}%）`
      : totalChange < 0 ? `整体进度比上周下降 ${totalChange}%，需关注` : "进度与上周持平";

    return { bestTime, bottleneck, trend };
  }
}

export const reviewDataService = new ReviewDataService();
