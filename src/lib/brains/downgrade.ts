/**
 * DowngradeBrain — 倦怠预防引擎
 * 当完成率持续下降时，建议暂停部分目标
 */

export interface GoalSnapshot {
  id?: number;
  name: string;
  status: string;
  progress: number;
}

export interface HistorySnapshot {
  date: string;
  goalId: number;
  completionRate: number; // 0-1
  activeDays: number;
}

export interface DowngradeAdvice {
  shouldDowngrade: boolean;
  reason: string;
  /** 建议暂停的目标 ID 列表 */
  pauseGoalIds: number[];
  /** 建议暂停的目标名称 */
  pauseGoals: string[];
}

export class DowngradeBrain {
  /**
   * 分析目标列表及其历史完成率，判断是否需要降级
   */
  analyze(goals: GoalSnapshot[], history: HistorySnapshot[]): DowngradeAdvice {
    // TODO: 实际逻辑 — 滑动窗口完成率检测
    // 1. 按 goalId 分组最近 N 天的完成率
    // 2. 计算连续下降趋势（连续 5 天下降 → 触发告警）
    // 3. 如果整体完成率 < 40% 且趋势持续下降 → 建议暂停最低进度的目标
    // 4. 生成自然的解释文案
    return {
      shouldDowngrade: false,
      reason: "",
      pauseGoalIds: [],
      pauseGoals: [],
    };
  }
}
