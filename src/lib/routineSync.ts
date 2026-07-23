/**
 * 作息→日程联动引擎 + CBT-I 早睡计算
 *
 * RoutineSync:
 *   当 sleep/wake/nap 类型的 RoutineTemplate 创建/更新/切换开关时，
 *   自动生成或更新对应日期的 ScheduleTask（sourceModule='routine'）
 *
 * EarlySleep:
 *   每晚提醒时间 = max(目标入睡, 前一晚实际入睡 - 步长)
 */

import { efficiencyDB, addScheduleTask, type ScheduleTask } from "./db/efficiency.db";
import type { RoutineTemplate } from "./db/daylog.db";
import { healthDB, type SleepLog, type SleepGoalV2 } from "./db/health.db";

// ============================================================
// 作息 → ScheduleTask 联动
// ============================================================

/** 将 RoutineTemplate 同步到今天及未来的 ScheduleTask */
export async function syncRoutineToSchedule(routine: RoutineTemplate): Promise<void> {
  const today = todayStr();

  if (routine.type === 'custom') return; // 自定义模板不同步

  const taskTitle = routine.name;        // "起床" / "午睡" / "入睡"
  const category = 'habit' as const;

  // 查询今天是否已存在此类型的固定任务
  const existing = await efficiencyDB.scheduleTasks
    .where('date').equals(today)
    .and(t => t.sourceModule === 'routine' && t.title === taskTitle)
    .first();

  if (routine.isActive) {
    const baseTask: Partial<ScheduleTask> = {
      title: taskTitle,
      date: today,
      category,
      sourceModule: 'routine',
      isImportant: false,
      isCompleted: false,
      plannedTime: timeDiffMinutes(routine.startTime, routine.endTime),
      actualTime: 0,
      note: '',
      type: 'single',
      quadrant: 'q2',
      goalId: null,
      projectId: undefined,
      reminderTimes: routine.type === 'sleep'
        ? undefined  // 早睡提醒由CBT-I逻辑单独处理
        : [routine.startTime],
    };

    if (existing) {
      await efficiencyDB.scheduleTasks.update(existing.id, baseTask);
    } else {
      await addScheduleTask(baseTask as any);
    }
  } else {
    // isActive=false → 删除今天的该任务
    if (existing) {
      await efficiencyDB.scheduleTasks.delete(existing.id);
    }
  }
}

// ============================================================
// CBT-I 早睡渐进提醒
// ============================================================

/**
 * 计算今晚的渐进入睡目标时间 (HH:mm)
 *
 * 逻辑：
 *   targetTime = 作息模板中的入睡时间（如 "22:30"）
 *   lastNightActual = 前一晚实际入睡时间（如 "01:00"）
 *   step = earlySleepStepMinutes（默认15）
 *
 *   tonightTarget = max(targetTime, lastNightActual - step)
 *
 * 例：target=22:30, last=01:00, step=15 → 今晚目标 00:45
 */
export function calcTonightTarget(args: {
  routineTargetTime: string;      // 作息模板入睡时间 "22:30"
  lastNightActual: string | null; // 前一晚实际入睡 "01:00" 或 null
  stepMinutes: number;            // 15 或 30
}): string {
  const target = timeToMinutes(args.routineTargetTime);
  if (!args.lastNightActual) return args.routineTargetTime;

  const lastActual = timeToMinutes(args.lastNightActual);
  const progressive = lastActual - args.stepMinutes;

  // 不能早于目标时间（防止反向）
  const tonightMinutes = Math.max(target, progressive);
  return minutesToTime(tonightMinutes);
}

/**
 * 获取前一晚的实际入睡时间
 * 注意：前一晚的日期 = today的前一天
 */
export async function getLastNightActual(todayDate: string): Promise<string | null> {
  const yesterday = dateAddDays(todayDate, -1);
  const log = await healthDB.sleepLogs.where('date').equals(yesterday).first();
  return log?.actualTime ?? null;
}

/**
 * 获取当前早睡目标（从作息模板 type='sleep' 读取）
 */
export {};

// ============================================================
// 工具函数
// ============================================================

function timeToMinutes(t: string): number {
  const [h, m] = t.split(':').map(Number);
  return h * 60 + m;
}

function minutesToTime(m: number): string {
  const h = Math.floor(m / 60) % 24;
  const min = m % 60;
  return `${String(h).padStart(2, '0')}:${String(min).padStart(2, '0')}`;
}

function timeDiffMinutes(start: string, end: string): number {
  return Math.max(0, timeToMinutes(end) - timeToMinutes(start));
}

function dateAddDays(dateStr: string, days: number): string {
  const d = new Date(dateStr + 'T00:00:00');
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
}

function todayStr(): string {
  return new Date().toISOString().slice(0, 10);
}
