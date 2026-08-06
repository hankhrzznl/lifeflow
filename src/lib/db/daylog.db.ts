import Dexie, { type Table } from 'dexie';

// ============================================================
// 日程引擎 DaylogDB — Item + Course + RoutineTemplate
// ============================================================

// ─── Types ───────────────────────────────────────────────────

export type SourceType = "task" | "habit" | "course" | "routine" | "manual" | "medication" | "fitness" | "wellness" | "diet" | "water" | "goal";

export interface Item {
  id: string;              // uuid
  taskId?: string;         // FK → ScheduleTask.id（tasks 拆解出的事项）
  phaseId?: string;        // FK → Phase.id
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
  repeat?: 'none' | 'daily' | 'weekdays' | 'weekly';  // 事项循环模式
  repeatGroupId?: string;  // 同名事项折叠分组ID
  sortOrder: number;       // 同时间段内的排序
  createdAt: number;
  updatedAt: number;

  // v6: 提醒功能
  reminderEnabled?: boolean;  // 是否启用提醒
  reminderMinutes?: number;   // 提前多少分钟，0=到点提醒
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

export type RoutineType = 'custom' | 'wake' | 'sleep' | 'nap' | 'focus';

export interface RoutineTemplateGroup {
  id: string;
  name: string;           // "默认模板" / "工作日"
  isDefault: boolean;
  sortOrder: number;
  createdAt: number;
  enabled: boolean;       // 模板组开关
  daysOfWeek: number[];   // 生效星期几，0=周日~6=周六
}

export interface RoutineTemplate {
  id: string;              // uuid
  type: RoutineType;       // sleep/wake/nap/custom
  templateId?: string;     // FK → RoutineTemplateGroup.id
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
  routineTemplateGroups!: Table<RoutineTemplateGroup, string>;

  constructor() {
    super('LifeFlowDaylog');
    this.version(1).stores({
      items: '&id, date, sourceType, sourceId, taskId, goalId',
      courses: '&id, name',
      routineTemplates: '&id, name',
    });
    // v2: add type field to routineTemplates
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
      // NOTE: 不再自动播种默认起床/午睡/入睡模板，用户应自行设置作息
    });
    // v3: add routineTemplateGroups + templateId on routineTemplates
    this.version(3).stores({
      routineTemplateGroups: '&id, isDefault, sortOrder',
      routineTemplates: '&id, name, type, templateId',
    }).upgrade(async (tx) => {
      const now = Date.now();
      // Seed default template group
      await tx.table('routineTemplateGroups').add({
        id: 'default',
        name: '默认模板',
        isDefault: true,
        sortOrder: 0,
        createdAt: now,
      });
      // Seed 6 default child routines
      const defaults: Omit<RoutineTemplate, 'id' | 'createdAt'>[] = [
        { type: 'wake', templateId: 'default', name: '起床', startTime: '07:00', endTime: '07:30', color: '#FF9500', icon: 'Sunrise', isActive: true, sortOrder: 0 },
        { type: 'custom', templateId: 'default', name: '早饭', startTime: '08:00', endTime: '08:30', color: '#34C759', icon: 'UtensilsCrossed', isActive: true, sortOrder: 1 },
        { type: 'custom', templateId: 'default', name: '午饭', startTime: '12:00', endTime: '12:30', color: '#007AFF', icon: 'Sandwich', isActive: true, sortOrder: 2 },
        { type: 'nap', templateId: 'default', name: '午睡', startTime: '13:00', endTime: '13:30', color: '#5856D6', icon: 'CloudSun', isActive: true, sortOrder: 3 },
        { type: 'custom', templateId: 'default', name: '晚饭', startTime: '18:00', endTime: '18:30', color: '#FF9500', icon: 'ChefHat', isActive: true, sortOrder: 4 },
        { type: 'sleep', templateId: 'default', name: '入睡', startTime: '22:30', endTime: '23:00', color: '#1E293B', icon: 'Moon', isActive: true, sortOrder: 5 },
      ];
      for (const d of defaults) {
        await tx.table('routineTemplates').add({ ...d, id: crypto.randomUUID(), createdAt: now });
      }
    });
    // v4: 模板组增加 enabled/daysOfWeek + 预置工作日/周末模板
    this.version(4).stores({
      routineTemplateGroups: '&id, isDefault, sortOrder',
      routineTemplates: '&id, name, type, templateId',
    }).upgrade(async (tx) => {
      // 全量删除历史作息事项
      await tx.table('items').where('sourceType').equals('routine').delete();

      // 获取旧默认模板组
      const oldGroup = await tx.table('routineTemplateGroups').get('default');
      if (!oldGroup) return;

      const now = Date.now();

      // 旧默认模板 → 工作日模板
      await tx.table('routineTemplateGroups').update('default', {
        name: '工作日模板',
        isDefault: false,
        enabled: true,
        daysOfWeek: [1, 2, 3, 4, 5], // 周一~周五
      });

      // 创建周末模板组
      const weekendId = crypto.randomUUID();
      await tx.table('routineTemplateGroups').add({
        id: weekendId,
        name: '周末模板',
        isDefault: false,
        sortOrder: 1,
        createdAt: now,
        enabled: true,
        daysOfWeek: [0, 6], // 周日、周六
      });

      // 克隆作息子项，时间 +30 分钟
      const defaultRoutines = await tx.table('routineTemplates')
        .where('templateId').equals('default')
        .toArray() as RoutineTemplate[];

      for (const r of defaultRoutines) {
        const { id, createdAt, ...rest } = r;
        const newStart = _addMinutes(rest.startTime, 30);
        const newEnd = _addMinutes(rest.endTime, 30);
        await tx.table('routineTemplates').add({
          ...rest,
          id: crypto.randomUUID(),
          templateId: weekendId,
          startTime: newStart,
          endTime: newEnd,
          createdAt: now,
        });
      }
    });
    // v5: 全量清空作息事项 + generateRoutineItems 增加 createdAt 边界
    this.version(5).stores({
      routineTemplateGroups: '&id, isDefault, sortOrder',
      routineTemplates: '&id, name, type, templateId',
    }).upgrade(async (tx) => {
      // 全量删除所有作息事项
      await tx.table('items').where('sourceType').equals('routine').delete();
      // 注：业务代码初始化时 (page load) 会为未来 7 天调用 generateRoutineItems 补全
    });
    // v6: Item 增加 reminderEnabled / reminderMinutes
    this.version(6).stores({
      items: '&id, date, sourceType, sourceId, taskId, goalId',
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
  // 联动清理关联 Reminder（moduleType='item'），避免孤儿提醒残留
  const { removeItemReminder } = await import("@/lib/reminderDefaults");
  await removeItemReminder(id);
  await daylogDB.items.delete(id);
}

export async function deleteItemsByDate(dateStr: string): Promise<void> {
  const targets = await daylogDB.items.where('date').equals(dateStr).toArray();
  if (targets.length === 0) return;
  const { removeItemReminders } = await import("@/lib/reminderDefaults");
  await removeItemReminders(targets.map(i => i.id));
  await daylogDB.items.bulkDelete(targets.map(i => i.id));
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

// ─── RoutineTemplateGroup CRUD ───────────────────────────────

export async function getRoutineGroups(): Promise<RoutineTemplateGroup[]> {
  return daylogDB.routineTemplateGroups.orderBy('sortOrder').toArray();
}

export async function addRoutineGroup(name: string, daysOfWeek?: number[]): Promise<string> {
  const id = crypto.randomUUID();
  await daylogDB.routineTemplateGroups.add({
    id, name, isDefault: false, sortOrder: Date.now(), createdAt: Date.now(),
    enabled: true,
    daysOfWeek: daysOfWeek ?? [1, 2, 3, 4, 5],  // 新建模板默认周一~周五
  });
  return id;
}

export async function deleteRoutineGroup(id: string): Promise<void> {
  // Also delete all child routines
  await daylogDB.routineTemplates.where('templateId').equals(id).delete();
  await daylogDB.routineTemplateGroups.delete(id);
}

export async function getRoutinesForGroup(groupId: string): Promise<RoutineTemplate[]> {
  return daylogDB.routineTemplates.where('templateId').equals(groupId).toArray();
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

/** 为指定日期从作息模板生成 Item（跳过已有同源同日Item）
 *  使用内存级防重入锁，避免 React Strict Mode double-invoke 产生重复事项 */
const _generatingRoutineDates = new Set<string>();

// ─── T15：课堂节奏（45+5）切分工具 ───────────────────────────

function addMinutesTime(time: string, mins: number): string {
  const [h, m] = time.split(':').map(Number);
  const total = h * 60 + m + mins;
  const nh = Math.floor(total / 60) % 24;
  const nm = total % 60;
  return `${String(nh).padStart(2, '0')}:${String(nm).padStart(2, '0')}`;
}

function minutesBetween(start: string, end: string): number {
  const [hs, ms] = start.split(':').map(Number);
  const [he, me] = end.split(':').map(Number);
  return he * 60 + me - (hs * 60 + ms);
}

/** 专注块按「45 分钟上课 + 5 分钟休息」切分；末尾不足 45 分钟作为最后一节上课 */
export function splitFocusSlots(start: string, end: string): { start: string; end: string; kind: 'class' | 'break' }[] {
  const slots: { start: string; end: string; kind: 'class' | 'break' }[] = [];
  let cursor = start;
  let remaining = minutesBetween(cursor, end);
  let guard = 0;
  while (remaining > 0 && guard < 60) {
    guard++;
    if (remaining >= 45) {
      slots.push({ start: cursor, end: addMinutesTime(cursor, 45), kind: 'class' });
      cursor = addMinutesTime(cursor, 45);
      remaining = minutesBetween(cursor, end);
      if (remaining >= 5) {
        slots.push({ start: cursor, end: addMinutesTime(cursor, 5), kind: 'break' });
        cursor = addMinutesTime(cursor, 5);
        remaining = minutesBetween(cursor, end);
      }
    } else {
      slots.push({ start: cursor, end, kind: 'class' });
      break;
    }
  }
  return slots;
}

export async function generateRoutineItems(dateStr: string): Promise<void> {
  if (_generatingRoutineDates.has(dateStr)) return;
  _generatingRoutineDates.add(dateStr);
  try {
    const [routines, groups] = await Promise.all([getRoutines(), getRoutineGroups()]);
    if (routines.length === 0) return;

    const groupMap = new Map(groups.map(g => [g.id, g]));
    const dayOfWeek = new Date(dateStr + 'T00:00:00').getDay(); // 0=Sun

    // 在事务内读取 + 创建，避免并发快照重复
    await daylogDB.transaction('rw', daylogDB.items, async () => {
      const existing = await daylogDB.items
        .where('date').equals(dateStr)
        .filter(item => item.sourceType === 'routine')
        .toArray();
      const existingSourceIds = new Set(existing.map(i => i.sourceId));

      for (const r of routines) {
        // 条件1：子项启用
        if (!r.isActive) continue;
        // 条件2：模板组启用
        const group = r.templateId ? groupMap.get(r.templateId) : null;
        if (!group || !group.enabled) continue;
        // 条件3：模板组日期匹配
        if (!group.daysOfWeek.includes(dayOfWeek)) continue;
        // 条件4：创建日期边界 — dateStr 必须 >= 组创建日期
        const groupCreatedDate = _timestampToDateStr(group.createdAt);
        if (dateStr < groupCreatedDate) continue;

        if (r.type === 'focus') {
          // T15：课堂节奏 — 45 分钟上课 + 5 分钟休息自动切分（sourceId 序号化去重）
          const slots = splitFocusSlots(r.startTime, r.endTime);
          for (let i = 0; i < slots.length; i++) {
            const s = slots[i];
            const sourceId = `${r.id}#${i}`;
            // 条件5：未重复生成
            if (existingSourceIds.has(sourceId)) continue;
            await addItem({
              date: dateStr,
              sourceType: 'routine',
              sourceId,
              title: s.kind === 'break' ? '起身活动 · 顺便喝水' : r.name,
              color: s.kind === 'break' ? '#34C759' : r.color,
              icon: s.kind === 'break' ? 'Coffee' : (r.icon || 'Zap'),
              plannedStart: s.start,
              plannedEnd: s.end,
              actualStart: s.start,
              actualEnd: s.end,
              isCorrected: false,
              isCompleted: false,
              sortOrder: timeToSort(s.start),
            });
          }
          continue;
        }

        // 条件5：未重复生成
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
    });
  } finally {
    _generatingRoutineDates.delete(dateStr);
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

// ─── 模块事项自动生成 ──────────────────────────────────────

/** 确保某日存在指定来源模块的事项（幂等：已存在同名同源则跳过） */
export async function ensureModuleItem(params: {
  date: string;
  sourceType: SourceType;
  sourceId: string;
  title: string;
  plannedStart: string;
  plannedEnd: string;
  color?: string;
  icon?: string;
  projectId?: string;
  isCompleted?: boolean;
}): Promise<string | null> {
  const existing = await daylogDB.items
    .where('date').equals(params.date)
    .filter(i => i.sourceType === params.sourceType && i.sourceId === params.sourceId)
    .first();
  if (existing) return existing.id;

  return addItem({
    date: params.date,
    sourceType: params.sourceType,
    sourceId: params.sourceId,
    title: params.title,
    color: params.color || '#6366F1',
    icon: params.icon || 'CheckSquare',
    plannedStart: params.plannedStart,
    plannedEnd: params.plannedEnd,
    actualStart: params.plannedStart,
    actualEnd: params.plannedEnd,
    isCorrected: false,
    projectId: params.projectId,
    isCompleted: params.isCompleted ?? true,
    sortOrder: timeToSort(params.plannedStart),
  });
}

/** 删除某日指定来源的事项（用于撤回/修正），联动清理关联 Reminder */
export async function removeModuleItems(date: string, sourceType: SourceType, sourceId: string): Promise<void> {
  const targets = await daylogDB.items
    .where('date').equals(date)
    .filter(i => i.sourceType === sourceType && i.sourceId === sourceId)
    .toArray();
  if (targets.length === 0) return;
  const { removeItemReminders } = await import("@/lib/reminderDefaults");
  await removeItemReminders(targets.map(i => i.id));
  await daylogDB.items.bulkDelete(targets.map(i => i.id));
}

// ─── RoutineTemplateGroup CRUD v4 ──────────────────────────

/** 将日期字符串转为星期几（0=周日） */
export function getDayOfWeek(dateStr: string): number {
  return new Date(dateStr + 'T00:00:00').getDay();
}

/** 更新模板组 */
export async function updateRoutineGroup(id: string, updates: Partial<RoutineTemplateGroup>): Promise<void> {
  await daylogDB.routineTemplateGroups.update(id, updates);
}

/** 删除某模板组今天及未来所有已生成的事项 */
export async function deleteRoutineItemsForGroup(groupId: string): Promise<void> {
  const routines = await getRoutinesForGroup(groupId);
  const routineIds = routines.map(r => r.id);
  if (routineIds.length === 0) return;

  const today = new Date();
  const todayStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}-${String(today.getDate()).padStart(2, "0")}`;

  const toDelete = await daylogDB.items
    .filter(item =>
      item.sourceType === 'routine' &&
      routineIds.includes(item.sourceId) &&
      item.date >= todayStr
    )
    .toArray();
  const ids = toDelete.map(i => i.id);
  if (ids.length > 0) await daylogDB.items.bulkDelete(ids);
}

/** 删除某模板组今天及未来某星期几的所有已生成事项 */
export async function deleteRoutineItemsForGroupDays(groupId: string, daysOfWeek: number[]): Promise<void> {
  const routines = await getRoutinesForGroup(groupId);
  const routineIds = routines.map(r => r.id);
  if (routineIds.length === 0) return;

  const today = new Date();
  const todayStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}-${String(today.getDate()).padStart(2, "0")}`;

  const daysSet = new Set(daysOfWeek);
  const toDelete = await daylogDB.items
    .filter(item => {
      if (item.sourceType !== 'routine' || !routineIds.includes(item.sourceId)) return false;
      if (item.date < todayStr) return false;
      const d = new Date(item.date + 'T00:00:00');
      return daysSet.has(d.getDay());
    })
    .toArray();
  const ids = toDelete.map(i => i.id);
  if (ids.length > 0) await daylogDB.items.bulkDelete(ids);
}

// ─── 工具 ────────────────────────────────────────────────────

export function timeToSort(time: string): number {
  const [h, m] = time.split(':').map(Number);
  return h * 60 + m;
}

export function formatTime(hhmm: string): string {
  const [h, m] = hhmm.split(':');
  return `${h}:${m}`;
}

/** 给时间字符串加上指定分钟数，用于 v4 升级推导周末模板时间 */
function _addMinutes(time: string, mins: number): string {
  const [h, m] = time.split(':').map(Number);
  const total = h * 60 + m + mins;
  const nh = Math.floor(total / 60) % 24;
  const nm = total % 60;
  return `${String(nh).padStart(2, '0')}:${String(nm).padStart(2, '0')}`;
}

/** 将 Unix 毫秒时间戳转为 YYYY-MM-DD 字符串 */
function _timestampToDateStr(ts: number): string {
  const d = new Date(ts);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}
