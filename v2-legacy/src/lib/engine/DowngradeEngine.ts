/**
 * 降级策略 —— 用户低谷期自动减负
 * 当完成率持续低迷时，主动建议暂停部分目标，聚焦最重要的
 */

import type { Goal, DailyAtom } from "@/types/goal";

export interface DowngradeSuggestion {
  shouldDowngrade: boolean;
  reason: string;
  keepGoals: string[];
  pauseGoals: string[];
  suggestedAction: string;
}

export class DowngradeEngine {
  analyze(
    goals: Goal[],
    _recentAtoms: DailyAtom[],
    history: { weekStart: string; completionRate: number }[]
  ): DowngradeSuggestion {
    const activeGoals = goals.filter((g) => g.status === "active");

    // 场景1：完成率连续2周低于30%
    const lowWeeks = history.filter((h) => h.completionRate < 30);
    if (lowWeeks.length >= 2 && activeGoals.length > 1) {
      return this.buildSuggestion(activeGoals, "连续两周完成率低于30%，同时推进多个目标容易导致每个都做不好。");
    }

    // 场景2：有目标严重滞后
    const severelyBehind = activeGoals.filter((g) => {
      const elapsed = Date.now() - new Date(g.createdAt).getTime();
      const total = new Date(g.deadline).getTime() - new Date(g.createdAt).getTime();
      const tp = total > 0 ? (elapsed / total) * 100 : 0;
      return g.progress < tp * 0.5;
    });
    if (severelyBehind.length > 0 && activeGoals.length > 1) {
      return this.buildSuggestion(
        activeGoals,
        `「${severelyBehind[0].title}」进度严重滞后，同时推进太多目标会分散精力。`
      );
    }

    // 场景3：目标数量过多
    if (activeGoals.length > 5) {
      return this.buildSuggestion(activeGoals, `同时有${activeGoals.length}个进行中的目标，建议精简到3个以内。`);
    }

    return { shouldDowngrade: false, reason: "", keepGoals: [], pauseGoals: [], suggestedAction: "" };
  }

  private buildSuggestion(activeGoals: Goal[], reason: string): DowngradeSuggestion {
    const sorted = [...activeGoals].sort((a, b) => {
      const po: Record<string, number> = { p1: 4, p2: 3, p3: 2, p4: 1 };
      const pa = po[a.priority] || 1;
      const pb = po[b.priority] || 1;
      if (pa !== pb) return pb - pa;
      return b.progress - a.progress;
    });

    const keepCount = Math.min(2, sorted.length);
    const keepGoals = sorted.slice(0, keepCount).map((g) => g.id);
    const pauseGoals = sorted.slice(keepCount).map((g) => g.id);

    return {
      shouldDowngrade: true,
      reason,
      keepGoals,
      pauseGoals,
      suggestedAction: `建议保留「${sorted.slice(0, keepCount).map((g) => g.title).join("」和「")}」，暂停其余${pauseGoals.length}个目标。等状态恢复后再逐步启动。`,
    };
  }

  generatePauseBatch(goalIds: string[]): Array<{ type: "pause"; goalId: string; reason: string }> {
    return goalIds.map((id) => ({
      type: "pause" as const,
      goalId: id,
      reason: "自动降级：完成率低迷，建议聚焦核心目标后再恢复",
    }));
  }
}

export const downgradeEngine = new DowngradeEngine();
