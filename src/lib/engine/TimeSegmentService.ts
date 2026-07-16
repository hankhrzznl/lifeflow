// ============================================================
// 目标拆解引擎 — TimeSegmentService
// 每日时段管理：4时段定义 + 容量设定 + 建议类别
// ============================================================

import { engineDB } from './db';

// ============================================================
// 类型
// ============================================================

export interface TimeSegment {
  id: string;
  name: string;
  start: number;
  end: number;
  icon: string;
  color: string;
}

// ============================================================
// TimeSegmentService
// ============================================================

export class TimeSegmentService {
  /** 4个默认时段定义 */
  static readonly SEGMENTS: readonly TimeSegment[] = [
    { id: 'morning',   name: '早晨',  start: 6,  end: 12, icon: '🌅', color: '#F5C542' },
    { id: 'afternoon', name: '下午',  start: 12, end: 18, icon: '☀️', color: '#E88D67' },
    { id: 'evening',   name: '晚上',  start: 18, end: 22, icon: '🌆', color: '#7BA3C7' },
    { id: 'night',     name: '深夜',  start: 22, end: 6,  icon: '🌙', color: '#8B6F5E' },
  ];

  /** 获取当前时段ID */
  getCurrentSegment(): string {
    const hour = new Date().getHours();
    return this.getSegmentForHour(hour);
  }

  /** 获取指定小时所属的时段 */
  getSegmentForHour(hour: number): string {
    if (hour >= 6 && hour < 12) return 'morning';
    if (hour >= 12 && hour < 18) return 'afternoon';
    if (hour >= 18 && hour < 22) return 'evening';
    return 'night';
  }

  /** 获取某时段的建议任务类别 */
  getSuggestedCategories(segmentId: string): string[] {
    const suggestions: Record<string, string[]> = {
      morning:   ['study', 'habit', 'career'],
      afternoon: ['fitness', 'life', 'career'],
      evening:   ['study', 'habit', 'finance'],
      night:     ['habit', 'life'],
    };
    return suggestions[segmentId] ?? [];
  }

  /** 获取某时段的容量设定 */
  getSegmentCapacity(segmentId: string): number {
    if (typeof window === 'undefined') return this.getDefaultCapacity(segmentId);
    const stored = localStorage.getItem(`lf_segment_capacity_${segmentId}`);
    if (stored) return parseInt(stored, 10);
    return this.getDefaultCapacity(segmentId);
  }

  /** 设置某时段的容量 */
  setSegmentCapacity(segmentId: string, capacity: number): void {
    if (typeof window === 'undefined') return;
    localStorage.setItem(`lf_segment_capacity_${segmentId}`, String(capacity));
  }

  /** 获取某时段已安排的任务数（当前日期） */
  async getScheduledCount(segmentId: string, dateStr: string): Promise<number> {
    const segment = TimeSegmentService.SEGMENTS.find((s) => s.id === segmentId);
    if (!segment) return 0;

    const allAtoms = await engineDB.dailyAtoms.toArray();
    const todayAtoms = allAtoms.filter((a) => a.scheduledDate === dateStr);

    // 通过目标类别匹配建议时段来判断任务归属于哪个时段
    let count = 0;
    for (const atom of todayAtoms) {
      const wt = await engineDB.weeklyTasks.get(atom.weeklyTaskId);
      if (!wt) continue;
      const ms = await engineDB.milestones.get(wt.milestoneId);
      if (!ms) continue;
      const goal = await engineDB.goals.get(ms.goalId);
      const category = goal?.category ?? 'custom';
      const suggested = this.getSuggestedCategories(segmentId);
      if (suggested.includes(category)) count++;
    }

    return count;
  }

  private getDefaultCapacity(segmentId: string): number {
    const defaults: Record<string, number> = {
      morning: 3, afternoon: 3, evening: 2, night: 1,
    };
    return defaults[segmentId] ?? 2;
  }
}

export const timeSegmentService = new TimeSegmentService();
