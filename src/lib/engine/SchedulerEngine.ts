/**
 * 调度师 —— 智能任务排序 + 时段推荐
 * 紧急度 × 难度 × 高效时段 = 最优顺序
 */

import type { EngineDailyAtom, EngineGoal } from "./types";
import { DateMath } from "./PlannerEngine";
import type { TimePattern } from "./InsightEngine";

export interface ScheduledTask {
  atomId: string;
  title: string;
  score: number;
  reason: string;
  suggestedSlot: "morning" | "afternoon" | "evening" | "night";
  urgency: number;
  difficulty: number;
}

export class SchedulerEngine {
  schedule(atoms: EngineDailyAtom[], goals: EngineGoal[], timePattern: TimePattern): ScheduledTask[] {
    const now = new Date().toISOString().split("T")[0];

    return atoms
      .filter((a) => !a.isCompleted && a.scheduledDate <= now)
      .map((atom) => {
        const goal = this.findGoal(atom, goals);
        const urgency = this.calcUrgency(atom, goal);
        const difficulty = this.calcDifficulty(atom);
        const score = urgency * 10 + difficulty * 5 + (goal?.category === "habit" ? 15 : 0);

        return {
          atomId: atom.id,
          title: atom.title,
          score,
          reason: urgency >= 8 ? "截止日临近" : difficulty >= 7 ? "难度较高" : "常规任务",
          suggestedSlot: this.suggestSlot(urgency, difficulty, timePattern),
          urgency,
          difficulty,
        };
      })
      .sort((a, b) => b.score - a.score);
  }

  private findGoal(atom: EngineDailyAtom, goals: EngineGoal[]): EngineGoal | undefined {
    return goals.find(
      (g) => g.status === "active" && atom.title.includes(g.title.substring(0, 5))
    );
  }

  private calcUrgency(atom: EngineDailyAtom, goal?: EngineGoal): number {
    if (!goal) return 5;
    const daysLeft = DateMath.daysBetween(
      new Date().toISOString().split("T")[0],
      goal.deadline
    );
    return daysLeft < 3 ? 10 : daysLeft < 7 ? 8 : daysLeft < 14 ? 6 : daysLeft < 30 ? 4 : 2;
  }

  private calcDifficulty(atom: EngineDailyAtom): number {
    return atom.quantity > 5 ? 8 : atom.quantity > 2 ? 5 : 3;
  }

  private suggestSlot(
    urgency: number,
    difficulty: number,
    pattern: TimePattern
  ): "morning" | "afternoon" | "evening" | "night" {
    const bh = pattern.bestHour;
    if (difficulty >= 7 && urgency >= 7)
      return bh < 12 ? "morning" : bh < 18 ? "afternoon" : "evening";
    if (difficulty >= 7) return "morning";
    if (urgency >= 8) return "afternoon";
    return "evening";
  }
}

export const schedulerEngine = new SchedulerEngine();
