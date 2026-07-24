import Dexie, { type Table } from 'dexie';

// ============================================================
// 日程引擎 DaylogDB — Item + Course + RoutineTemplate
// ============================================================

// ─── Types ───────────────────────────────────────────────────

export type SourceType = "task" | "habit" | "course" | "routine" | "manual";

export interface Item {
  id: string;              // uuid
  taskId?: string;         // FK → ScheduleTask.id（tasks 拆解出的事项）
  goalId?: string;         // 冗余 FK，便于过滤
  projectId?: string;      // FK → Project，从 task 继承
  date: string;            // YYYY-MM-DD

  // 计划时间（来自课程/作息模板或用户手动输入）
  plannedStart: string;    // "HH:mm"
  plannedEnd: string;

  // 实际时间（用户可手动矫正，默认等于 planned）
  actualStart: string;
  actualEnd: string;
  isCorrected: boolean;    // actual 是否被手动改过

  sourceType: SourceType;
  sourceId: string;        // 指向来源行的 id（Task/Course/RoutineTemplate/Habit）
  title: string;
  color: string;           // "#FF9500"
  icon: string;            // lucide icon name
  location?: string;       // 上课地点等
  cost?: number;           // 花费（分），>=0
  water?: number;          // 饮水量（毫升）
  sleepQuality?: number;   // 睡眠评分 1-5
  workoutNote?: string;    // 训练备注
  streak?: number;         // 连续打卡天数
  note?: string;

  isCompleted: boolean;
  sortOrder: number;       // 同时间段内的排序
  createdAt: number;
  updatedAt: number;
}

export interface Course {
  id: string;              // uuid
  name: string;            // "高等数学"
  weekday: number[];       // [1,3] = 周一、周三 (0=Sun, 1=Mon...)
  startTime: string;       // "09:00"
  endTime: string;         // "10:30"
  location: string;
  color: string;           // "#007AFF"
  icon: string;            // lucide icon name
  weeks: number[];         // 第几周到第几周，如 [1,2,...16]，空=无限
  createdAt: number;
}

export type RoutineType = 'custom' | 'wake' | 'sleep' | 'nap';

export interface RoutineTemplate {
  id: string;              // uuid
  type: RoutineType;       // sleep/wake/nap/custom
  name: string;            // "午睡"
  startTime: string;       // "12:30"
  endTime: string;         // "13:00"
  color: string;           // "#5856D6"
  icon: string;            // lucide icon name
  isActive: boolean;
  sortOrder: number;
  createdAt: number;
}

// ─── Database ────────────────────────────────────────────────

export class DaylogDB extends Dexie {
  items!: Table<Item, string>;
  courses!: Table<Course, string>;
  routineTemplates!: Table<RoutineTemplate, string>;

  constructor() {
    super('LifeFlowDaylog');
    this.version(1).stores({
      items: '&id, date, sourceType, sourceId, taskId, goalId',
      courses: '&id, name',
      routineTemplates: '&id, name',
    });
    // v2: add type field to routineTemplates + seed default templates
    this.version(2).stores({
      routineTemplates: '&id, name, type',
    }).upgrade(async (tx) => {
      // Migrate existing: set type='custom' for templates without type
      const all = await tx.table('routineTemplates').toArray();
      for (const r of all) {
        if (!r.type) {
          await tx.table('routineTemplates').update(r.id, { type: 'custom' });
        }
      }
      // Seed default sleep/wake/nap templates if not exist
      const defaults: { type: RoutineType; name: string; startTime: string; endTime: string; color: string; icon: string; sortOrder: number }[] = [
        { type: 'wake',   name: '起床', startTime: '07:00', endTime: '07:30', color: '#FF9500', icon: 'Sunrise',      sortOrder: 0 },
        { type: 'nap',    name: '午睡', startTime: '13:00', endTime: '13:30', color: '#5856D6', icon: 'CloudSun',     sortOrder: 1 },
        { type: 'sleep',  name: '入睡', startTime: '22:30', endTime: '23:00', color: '#1E293B', icon: 'Moon',         sortOrder: 2 },
      ];
      for (const d of defaults) {
        const existing = await tx.table('routineTemplates').where('type').equals(d.type).first();
        if (!existing) {
          await tx.table('routineTemplates').add({ ...d, id: crypto.randomUUID(), isActive: true, createdAt: Date.now() });
        }
      }
    });
  }
}

export const daylogDB = new DaylogDB();

// ─── Items CRUD ──────────────────────────────────────────────

export async function getItemsByDate(dateStr: string): Promise<Item[]> {
  return daylogDB.items.where('date').equals(dateStr).sortBy('sortOrder');
}

/** 按 plannedStart 升序返回当日事项 */
export async function getItemsByDateSorted(dateStr: string): Promise<Item[]> {
  return daylogDB.items.where('date').equals(dateStr).sortBy('plannedStart');
}

/** 获取起床时间（从作息模板 type='wake' 读取，默认 07:00） */
export async function getWakeTime(): Promise<string> {
  const wake = await daylogDB.routineTemplates.where('type').equals('wake').first();
  return wake?.startTime || '07:00';
}

/** 按起床时间为日期边界查询事项
 *  例：wakeTime=07:00，查看 7月24日 → 获取 7/24 07:00 ~ 7/25 07:00 的事项
 */
export async function getItemsByScheduleDay(dateStr: string, wakeTime: string): Promise<Item[]> {
  const nextDate = dateAddOne(dateStr);
  const all = await daylogDB.items
    .where('date').equals(dateStr)
    .filter(item => item.plannedStart >= wakeTime)
    .toArray();
  const earlyNext = await daylogDB.items
    .where('date').equals(nextDate)
    .filter(item => item.plannedStart < wakeTime)
    .toArray();
  return [...all, ...earlyNext].sort((a, b) => a.plannedStart.localeCompare(b.plannedStart));
}

function dateAddOne(dateStr: string): string {
  const d = new Date(dateStr + 'T00:00:00');
  d.setDate(d.getDate() + 1);
  return d.toISOString().slice(0, 10);
}

/** 获取当前时间之后的 N 个事项 */
export async function getUpcomingItems(todayStr: string, nowTime: string, limit: number = 6): Promise<Item[]> {
  const all = await daylogDB.items
    .where('date').equals(todayStr)
    .filter(item => item.plannedStart >= nowTime && !item.isCompleted)
    .toArray();
  return all.sort((a, b) => a.plannedStart.localeCompare(b.plannedStart)).slice(0, limit);
}

/** 手动新建事项（sourceType='manual'） */
export async function addManualItem(data: {
  date: string;
  plannedStart: string;
  plannedEnd: string;
  title: string;
  note?: string;
  color?: string;
  icon?: string;
  projectId?: string;
}): Promise<string> {
  return addItem({
    date: data.date,
    plannedStart: data.plannedStart,
    plannedEnd: data.plannedEnd,
    actualStart: data.plannedStart,
    actualEnd: data.plannedEnd,
    isCorrected: false,
    sourceType: 'manual',
    sourceId: crypto.randomUUID(),
    title: data.title,
    color: data.color || '#6366F1',
    icon: data.icon || 'CheckSquare',
    note: data.note,
    projectId: data.projectId,
    isCompleted: false,
    sortOrder: timeToSort(data.plannedStart),
  });
}

export async function getAllItems(): Promise<Item[]> {
  return daylogDB.items.toArray();
}

export async function addItem(item: Omit<Item, 'id' | 'createdAt' | 'updatedAt'>): Promise<string> {
  const id = crypto.randomUUID();
  const now = Date.now();
  await daylogDB.items.add({ ...item, id, createdAt: now, updatedAt: now });
  return id;
}

export async function updateItem(id: string, updates: Partial<Item>): Promise<void> {
  await daylogDB.items.update(id, { ...updates, updatedAt: Date.now() });
}

export async function deleteItem(id: string): Promise<void> {
  await daylogDB.items.delete(id);
}

export async function deleteItemsByDate(dateStr: string): Promise<void> {
  await daylogDB.items.where('date').equals(dateStr).delete();
}

// ─── Courses CRUD ────────────────────────────────────────────

export async function getCourses(): Promise<Course[]> {
  return daylogDB.courses.toArray();
}

export async function addCourse(c: Omit<Course, 'id' | 'createdAt'>): Promise<string> {
  const id = crypto.randomUUID();
  await daylogDB.courses.add({ ...c, id, createdAt: Date.now() });
  return id;
}

export async function updateCourse(id: string, updates: Partial<Course>): Promise<void> {
  await daylogDB.courses.update(id, updates);
}

export async function deleteCourse(id: string): Promise<void> {
  await daylogDB.courses.delete(id);
}

// ─── RoutineTemplate CRUD ────────────────────────────────────

export async function getRoutines(): Promise<RoutineTemplate[]> {
  return daylogDB.routineTemplates.toArray();
}

export async function addRoutine(r: Omit<RoutineTemplate, 'id' | 'createdAt'>): Promise<string> {
  const id = crypto.randomUUID();
  await daylogDB.routineTemplates.add({ ...r, id, createdAt: Date.now() });
  return id;
}

export async function updateRoutine(id: string, updates: Partial<RoutineTemplate>): Promise<void> {
  await daylogDB.routineTemplates.update(id, updates);
}

export async function deleteRoutine(id: string): Promise<void> {
  await daylogDB.routineTemplates.delete(id);
}

// ─── 自动生成 ────────────────────────────────────────────────

/** 为指定日期从课程模板生成 Item（跳过已有同源同日Item） */
export async function generateCourseItems(dateStr: string): Promise<void> {
  const dayOfWeek = new Date(dateStr).getDay(); // 0=Sun
  const courses = await getCourses();
  const existing = await daylogDB.items
    .where('date').equals(dateStr)
    .filter(item => item.sourceType === 'course')
    .toArray();
  const existingSourceIds = new Set(existing.map(i => i.sourceId));

  for (const c of courses) {
    if (!c.weekday.includes(dayOfWeek)) continue;
    if (existingSourceIds.has(c.id)) continue; // 已有（用户可能调休改过）
    await addItem({
      date: dateStr,
      sourceType: 'course',
      sourceId: c.id,
      title: c.name,
      color: c.color,
      icon: c.icon || 'GraduationCap',
      plannedStart: c.startTime,
      plannedEnd: c.endTime,
      actualStart: c.startTime,
      actualEnd: c.endTime,
      isCorrected: false,
      location: c.location,
      isCompleted: false,
      sortOrder: timeToSort(c.startTime),
    });
  }
}

/** 为指定日期从作息模板生成 Item（跳过已有同源同日Item） */
export async function generateRoutineItems(dateStr: string): Promise<void> {
  const routines = await getRoutines();
  if (routines.length === 0) return;
  const existing = await daylogDB.items
    .where('date').equals(dateStr)
    .filter(item => item.sourceType === 'routine')
    .toArray();
  const existingSourceIds = new Set(existing.map(i => i.sourceId));

  for (const r of routines) {
    if (!r.isActive) continue;
    if (existingSourceIds.has(r.id)) continue;
    await addItem({
      date: dateStr,
      sourceType: 'routine',
      sourceId: r.id,
      title: r.name,
      color: r.color,
      icon: r.icon || 'Moon',
      plannedStart: r.startTime,
      plannedEnd: r.endTime,
      actualStart: r.startTime,
      actualEnd: r.endTime,
      isCorrected: false,
      isCompleted: false,
      sortOrder: timeToSort(r.startTime),
    });
  }
}

/** 为指定日期从习惯数据生成 Item */
export async function generateHabitItems(
  dateStr: string,
  habitName: string,
  habitColor: string,
  habitId: string,
  items: Item[],
): Promise<void> {
  // 习惯的时间段较短，默认放早晨或用户自定义
  const existing = items.filter(i => i.sourceType === 'habit' && i.sourceId === habitId && i.date === dateStr);
  if (existing.length > 0) return;

  // 默认生活习惯在早晨 7:00-7:30
  await addItem({
    date: dateStr,
    sourceType: 'habit',
    sourceId: habitId,
    title: habitName,
    color: habitColor,
    icon: 'CheckSquare',
    plannedStart: '07:00',
    plannedEnd: '07:30',
    actualStart: '07:00',
    actualEnd: '07:30',
    isCorrected: false,
    isCompleted: true,
    sortOrder: timeToSort('07:00'),
  });
}

// ─── 工具 ────────────────────────────────────────────────────

function timeToSort(time: string): number {
  const [h, m] = time.split(':').map(Number);
  return h * 60 + m;
}

export function formatTime(hhmm: string): string {
  const [h, m] = hhmm.split(':');
  return `${h}:${m}`;
}
