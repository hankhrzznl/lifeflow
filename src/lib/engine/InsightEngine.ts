/**
 * 洞察师 —— 纯本地计算AI洞察
 * 趋势分析、模式识别、建议生成，全部数学计算
 */

import type { EngineDailyAtom, EngineGoal, EngineWeeklyTask } from "./types";
import { DateMath } from "./PlannerEngine";

export interface Insight {
  type: "pattern" | "trend" | "suggestion" | "warning" | "celebration";
  title: string;
  description: string;
  confidence: number;
  actionable?: boolean;
  action?: string;
}

export interface TimePattern {
  bestHour: number;
  bestDay: number;
  completionByHour: number[];
  completionByDay: number[];
}

export class InsightEngine {
  analyzeTimePattern(atoms: EngineDailyAtom[]): TimePattern {
    const byHour = Array(24)
      .fill(0)
      .map(() => ({ t: 0, d: 0 }));
    const byDay = Array(7)
      .fill(0)
      .map(() => ({ t: 0, d: 0 }));

    atoms.forEach((a) => {
      const day = new Date(a.scheduledDate + "T00:00:00").getDay();
      byDay[day].t++;
      if (a.isCompleted) {
        byDay[day].d++;
        if (a.completedAt) {
          byHour[new Date(a.completedAt).getHours()].t++;
          byHour[new Date(a.completedAt).getHours()].d++;
        }
      }
    });

    const cbh = byHour.map((h) => (h.t > 0 ? (h.d / h.t) * 100 : 0));
    const cbd = byDay.map((d) => (d.t > 0 ? (d.d / d.t) * 100 : 0));
    return {
      bestHour: cbh.indexOf(Math.max(...cbh)),
      bestDay: cbd.indexOf(Math.max(...cbd)),
      completionByHour: cbh,
      completionByDay: cbd,
    };
  }

  generateInsights(goals: EngineGoal[], atoms: EngineDailyAtom[], _tasks: EngineWeeklyTask[] = []): Insight[] {
    const insights: Insight[] = [];
    const pattern = this.analyzeTimePattern(atoms);

    if (pattern.bestHour >= 0) {
      insights.push({
        type: "pattern",
        title: "你的高效时段",
        description: `你在${pattern.bestHour}:00-${pattern.bestHour + 1}:00之间完成率最高，建议把重要任务安排在这个时段。`,
        confidence: 85,
        actionable: true,
        action: "在设置中开启「智能时段推荐」",
      });
    }

    goals
      .filter((g) => g.status === "active")
      .forEach((goal) => {
        const elapsed = Date.now() - new Date(goal.createdAt).getTime();
        const total = new Date(goal.deadline).getTime() - new Date(goal.createdAt).getTime();
        const tp = total > 0 ? (elapsed / total) * 100 : 0;
        const gap = goal.progress - tp;

        if (gap < -20) {
          insights.push({
            type: "warning",
            title: `「${goal.title}」进度滞后`,
            description: `进度${goal.progress}%，但时间已过去${Math.round(tp)}%，落后约${Math.round(Math.abs(gap))}%。建议重新评估计划。`,
            confidence: 90,
            actionable: true,
            action: "进入目标详情，使用「再规划」功能调整",
          });
        } else if (gap > 10) {
          insights.push({
            type: "celebration",
            title: `「${goal.title}」进度超前`,
            description: `进度${goal.progress}%，领先时间线约${Math.round(gap)}%，很棒！`,
            confidence: 90,
          });
        }
      });

    const streak = this.calcStreak(atoms);
    if (streak >= 7) {
      insights.push({
        type: "celebration",
        title: `连续打卡${streak}天！`,
        description: "习惯正在稳固形成，这种坚持的力量很强大。",
        confidence: 95,
      });
    } else if (streak >= 3) {
      insights.push({
        type: "trend",
        title: `连续${streak}天打卡`,
        description: "连续打卡的记录正在积累，再坚持几天就会进入自动化阶段。",
        confidence: 80,
        actionable: true,
        action: "保持当前节奏，不要中断",
      });
    }

    const bottleneck = this.findBottleneck(atoms);
    if (bottleneck) {
      insights.push({
        type: "warning",
        title: "瓶颈识别",
        description: bottleneck,
        confidence: 75,
        actionable: true,
        action: "尝试将大任务拆成更小的一步",
      });
    }

    const suggestion = this.genSuggestion(atoms, pattern);
    if (suggestion) {
      insights.push({
        type: "suggestion",
        title: "小织建议",
        description: suggestion,
        confidence: 70,
        actionable: true,
      });
    }

    return insights.sort((a, b) => b.confidence - a.confidence);
  }

  predictCompletion(goal: EngineGoal, atoms: EngineDailyAtom[]): { predictedDate: string; confidence: number } | null {
    if (goal.progress <= 0 || goal.progress >= 100) return null;
    const elapsed = Date.now() - new Date(goal.createdAt).getTime();
    const rate = goal.progress / 100 / elapsed;
    const remaining = (1 - goal.progress / 100) / rate;
    return {
      predictedDate: new Date(Date.now() + remaining).toISOString().split("T")[0],
      confidence: 40,
    };
  }

  private calcStreak(atoms: EngineDailyAtom[]): number {
    const sorted = [...new Set(atoms.filter((a) => a.isCompleted).map((a) => a.scheduledDate))]
      .sort()
      .reverse();
    let s = 0;
    for (const d of sorted) {
      if (atoms.some((a) => a.scheduledDate === d && a.isCompleted)) s++;
      else break;
    }
    return s;
  }

  private findBottleneck(atoms: EngineDailyAtom[]): string | null {
    const last7 = atoms.filter((a) => {
      const diff = (Date.now() - new Date(a.scheduledDate).getTime()) / 86400000;
      return diff <= 7;
    });
    const rate = last7.length > 0 ? (last7.filter((a) => a.isCompleted).length / last7.length) * 100 : 100;
    if (rate < 30)
      return "最近7天完成率偏低，可能是任务量过大或生活有变化。建议暂停部分目标，聚焦最重要的一个。";
    return null;
  }

  private genSuggestion(atoms: EngineDailyAtom[], pattern: TimePattern): string | null {
    const total = atoms.length;
    const completed = atoms.filter((a) => a.isCompleted).length;
    const rate = total > 0 ? (completed / total) * 100 : 0;
    if (rate > 80)
      return "你的完成率很高，试试增加一点挑战？比如提前半天完成任务，或者同时推进两个目标。";
    if (rate < 40 && total > 10)
      return "完成率偏低，建议用「两分钟法则」：每个任务只要求自己做两分钟，做完再想是否继续。";
    if (pattern.bestHour >= 9 && pattern.bestHour <= 11)
      return "你上午效率最高，建议把最难的任务放在9-11点，下午安排轻松一些的。";
    if (pattern.bestHour >= 20)
      return "你是夜猫子型！晚上效率最高，但要注意休息，别熬太晚哦。";
    return null;
  }
}

export const insightEngine = new InsightEngine();
