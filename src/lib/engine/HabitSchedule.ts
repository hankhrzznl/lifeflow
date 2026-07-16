// ============================================================
// 习惯时间段设定
// localStorage 存储：时段选择 + 提醒时间 + 执行日期
// ============================================================

// ============================================================
// 类型
// ============================================================

export interface HabitSchedule {
  habitId: string;
  preferredSegment: 'morning' | 'afternoon' | 'evening' | 'night';
  reminderTime?: string;      // "07:00" 格式
  daysOfWeek: number[];        // [1,3,5] = 周一三五 (0=周日)
}

// ============================================================
// API
// ============================================================

/** 设置习惯的时间段 */
export function setHabitSchedule(habitId: string, schedule: Omit<HabitSchedule, 'habitId'>): void {
  if (typeof window === 'undefined') return;
  const full: HabitSchedule = { habitId, ...schedule };
  localStorage.setItem(`lf_habit_schedule_${habitId}`, JSON.stringify(full));
}

/** 获取习惯的时间段 */
export function getHabitSchedule(habitId: string): HabitSchedule | null {
  if (typeof window === 'undefined') return null;
  const stored = localStorage.getItem(`lf_habit_schedule_${habitId}`);
  if (!stored) return null;
  try { return JSON.parse(stored); } catch { return null; }
}

/** 删除习惯的时间段设定 */
export function removeHabitSchedule(habitId: string): void {
  if (typeof window === 'undefined') return;
  localStorage.removeItem(`lf_habit_schedule_${habitId}`);
}

/** 获取今天需要执行的习惯ID列表 */
export function getTodayHabitIds(allHabitIds: string[]): string[] {
  const today = new Date().getDay(); // 0=周日
  return allHabitIds.filter((id) => {
    const schedule = getHabitSchedule(id);
    if (!schedule) return true; // 无设定的默认每天
    return schedule.daysOfWeek.includes(today);
  });
}

/** 时段选项（供UI使用） */
export const SEGMENT_OPTIONS = [
  { id: 'morning' as const,   label: '早晨', icon: '🌅', range: '6-12时' },
  { id: 'afternoon' as const, label: '下午', icon: '☀️', range: '12-18时' },
  { id: 'evening' as const,   label: '晚上', icon: '🌆', range: '18-22时' },
  { id: 'night' as const,     label: '深夜', icon: '🌙', range: '22-6时' },
];

/** 星期选项 */
export const DAY_OPTIONS = [
  { value: 0, label: '日' },
  { value: 1, label: '一' },
  { value: 2, label: '二' },
  { value: 3, label: '三' },
  { value: 4, label: '四' },
  { value: 5, label: '五' },
  { value: 6, label: '六' },
];
