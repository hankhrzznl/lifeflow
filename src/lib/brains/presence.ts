/**
 * PresenceBrain — 活跃感知引擎
 * 追踪用户当日活跃时间和专注会话数
 */

export interface DailyPresenceStats {
  activeMinutes: number;
  focusSessionCount: number;
  lastActiveAt: number | null;
}

export class PresenceBrain {
  private focusSessionCount = 0;
  private activeStart: number | null = null;
  private accumulatedSeconds = 0;
  private lastActivityTimestamp: number | null = null;

  /**
   * 记录一次专注会话开始
   */
  startFocusSession(): void {
    this.focusSessionCount++;
  }

  /**
   * 记录用户活跃事件（页面交互/输入等）
   */
  recordActivity(timestamp: number = Date.now()): void {
    this.lastActivityTimestamp = timestamp;
    if (this.activeStart === null) {
      this.activeStart = timestamp;
    }
    // TODO: 实际逻辑 — 合并间隔 < 5 分钟的连续活跃段
    // 暂用简单累积
    this.accumulatedSeconds += 60; // 假设每次活跃至少 1 分钟
  }

  /**
   * 获取当日统计数据
   */
  getDailyStats(): DailyPresenceStats {
    // TODO: 实际逻辑 — 基于真实时间间隙计算 activeMinutes
    const activeMinutes = Math.round(this.accumulatedSeconds / 60);

    return {
      activeMinutes,
      focusSessionCount: this.focusSessionCount,
      lastActiveAt: this.lastActivityTimestamp,
    };
  }

  /**
   * 重置当日统计（跨天调用）
   */
  resetDaily(): void {
    this.focusSessionCount = 0;
    this.activeStart = null;
    this.accumulatedSeconds = 0;
    this.lastActivityTimestamp = null;
  }
}
