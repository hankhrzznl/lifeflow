import Dexie, { type Table } from 'dexie';

// ─── Types ───────────────────────────────────────────────────

export interface Goal {
  id: string;           // uuid, primary key
  projectId?: string;      // FK → Project，null=无隶属项目
  title: string;
  deadline: string;     // ISO date YYYY-MM-DD
  progress: number;     // 0-100
  status: 'active' | 'completed' | 'paused' | 'archived';
  completedAt?: number; // 完成时间戳(ms)，status→completed 时写入
  goalType?: 'habit' | 'task';   // habit=习惯(打卡+streak), task=任务(进度条)
  targetCount?: number;           // 完成 N 次，默认 5
  note?: string;                  // 备注，默认 ''
  color?: string;                 // 项目标签颜色，默认 #5865F2
  quadrant?: 'q1' | 'q2' | 'q3' | 'q4';  // 四象限分类，默认 q2
  streak?: number;               // 习惯连续天数，仅 goalType='habit'
  daysLog?: Record<string, boolean>;  // 打卡记录 YYYY-MM-DD → true，仅 goalType='habit'
  createdAt: number;
}

export interface Project {
  id: string;              // uuid
  name: string;
  color: string;           // "#7C3AED"
  icon: string;            // lucide icon name
  description: string;
  sortOrder: number;
  createdAt: number;
  projectType: 'big' | 'small';   // 大项目=分类标签, 小项目=功能模块
  isDefault?: boolean;            // 默认小项目不可删改
  parentProjectId?: string;       // 小项目所属大项目ID（可选）
  moreRoute?: string;             // 关联的更多模块路由（如 /more/water）
}

export interface EfficiencyGoal {
  id?: number;
  name: string;
  type: 'task' | 'fitness' | 'finance' | 'sleep' | 'water';
  status: 'active' | 'completed' | 'paused' | 'archived';
  priority?: string;
  deadline?: number;
  progress: number;
  progressLocked: boolean;
  weight: number;
  createdAt: number;
  updatedAt: number;
  projectId?: number;
  description?: string;
  color?: string;
}

export interface EfficiencyTask {
  id?: number;
  title: string;
  type: 'longterm' | 'shortterm' | 'daily' | 'habit';
  status: 'active' | 'done' | 'archived';
  goalId?: number;
  planId?: number;
  startTime?: number;
  endTime?: number;
  dueDate?: number;
  priority?: string;
  weight?: number;
  createdAt: number;
  updatedAt: number;
  tags?: string[];
}

export interface EfficiencyHabit {
  id?: number;
  title: string;
  goalId?: number;
  streak: number;
  frequency: 'daily' | 'weekly';
  createdAt: number;
  updatedAt: number;
}

export interface ScheduleTask {
  id: string;               // uuid
  goalId: string | null;    // 关联目标ID
  projectId?: string;       // FK → Project（冗余，方便按项目查询）
  title: string;
  type: 'single' | 'multi_day' | 'recurring';
  category?: 'task' | 'habit' | 'chore';  // task=目标任务 habit=习惯 chore=日常琐事
  date: string | null;      // YYYY-MM-DD
  startDate?: string;
  endDate?: string;
  recurringDays?: number[]; // [0-6]
  quadrant?: 'q1' | 'q2' | 'q3' | 'q4';
  isCompleted: boolean;
  plannedTime: number;
  actualTime: number;
  isImportant: boolean;
  note: string;
  reminderTimes?: string[];     // 提醒时间 e.g. ["09:00", "18:00"]
  progressType?: 'normal' | 'progress';
  progressPeriod?: 'none' | 'daily' | 'weekly' | 'monthly';
  targetValue?: number;
  targetUnit?: string;
  startValue?: number;
  taskDays?: 'everyday' | 'workday' | 'weekend' | 'custom';
  dailyMin?: number;
  progressCalc?: 'sum' | 'average';
  hasSubTasks?: boolean;
  progressCurrent?: number;
  // 来源追踪（用于撤回时回滚）
  sourceModule?: string;    // 哪个模块产生的：water/sleep/fitness/stretch/medication/diet/wellness等
  sourceLogId?: string;     // 原始记录ID，用于撤回时定位删除
  createdAt: number;
}

// ─── Database ────────────────────────────────────────────────

export class EfficiencyDB extends Dexie {
  goals!: Table<Goal, string>;
  tasks!: Table<EfficiencyTask, number>;
  habits!: Table<EfficiencyHabit, number>;
  scheduleTasks!: Table<ScheduleTask, string>;
  projects!: Table<Project, string>;

  constructor() {
    super('LifeFlowEfficiency');
    this.version(1).stores({
      goals: '++id, status, type, priority, deadline, projectId',
      tasks: '++id, title, type, status, goalId, planId, startTime, endTime, dueDate',
      habits: '++id, title, goalId, streak, frequency',
    });
    this.version(2).stores({
      goals: '&id, status, deadline',
    }).upgrade(async tx => {
      // Clear old goals data since schema changed (number id → string id)
      await tx.table('goals').clear();
    });
    this.version(3).stores({
      scheduleTasks: '&id, date, goalId, isCompleted, isImportant',
    });
    this.version(4).stores({
      projects: '&id, name',
    });
    this.version(5).stores({
      goals: '&id, status, deadline',
      tasks: '++id, title, type, status, goalId, planId, startTime, endTime, dueDate',
      habits: '++id, title, goalId, streak, frequency',
      scheduleTasks: '&id, date, goalId, isCompleted, isImportant',
      projects: '&id, name',
    }).upgrade(async tx => {
      await tx.table('projects').clear();
    });
    this.version(6).stores({
      goals: '&id, status, deadline',
      tasks: '++id, title, type, status, goalId, planId, startTime, endTime, dueDate',
      habits: '++id, title, goalId, streak, frequency',
      scheduleTasks: '&id, date, goalId, isCompleted, isImportant, category',
      projects: '&id, name',
    });
    this.version(7).stores({
      goals: '&id, status, deadline, quadrant',
      tasks: '++id, title, type, status, goalId, planId, startTime, endTime, dueDate',
      habits: '++id, title, goalId, streak, frequency',
      scheduleTasks: '&id, date, goalId, isCompleted, isImportant, category',
      projects: '&id, name',
    });
    this.version(8).stores({
      goals: '&id, status, deadline, quadrant, goalType, streak',
      tasks: '++id, title, type, status, goalId, planId, startTime, endTime, dueDate',
      habits: '++id, title, goalId, streak, frequency',
      scheduleTasks: '&id, date, goalId, isCompleted, isImportant, category',
      projects: '&id, name',
    });
    // v9: 项目层级结构（大项目+小项目）
    this.version(9).stores({
      projects: '&id, name, projectType, parentProjectId',
    }).upgrade(async (tx) => {
      // Migrate existing projects to 'small' type
      const all = await tx.table('projects').toArray();
      for (const p of all) {
        await tx.table('projects').update(p.id, { projectType: 'small' as any });
      }
      // Seed 6 default big projects
      const bigProjects = [
        { id: crypto.randomUUID(), name: '学习', color: '#2563EB', icon: 'GraduationCap', description: '', sortOrder: 0, projectType: 'big', createdAt: Date.now() },
        { id: crypto.randomUUID(), name: '健康', color: '#10B981', icon: 'Heart', description: '', sortOrder: 1, projectType: 'big', createdAt: Date.now() },
        { id: crypto.randomUUID(), name: '琐事', color: '#F59E0B', icon: 'ClipboardList', description: '', sortOrder: 2, projectType: 'big', createdAt: Date.now() },
        { id: crypto.randomUUID(), name: '长期主义', color: '#8B5CF6', icon: 'Target', description: '', sortOrder: 3, projectType: 'big', createdAt: Date.now() },
        { id: crypto.randomUUID(), name: '娱乐', color: '#EC4899', icon: 'Gamepad2', description: '', sortOrder: 4, projectType: 'big', createdAt: Date.now() },
        { id: crypto.randomUUID(), name: '无项目', color: '#94A3B8', icon: 'FolderOpen', description: '', sortOrder: 5, projectType: 'big', createdAt: Date.now() },
      ];
      for (const bp of bigProjects) {
        await tx.table('projects').add(bp);
      }
    });
    // v10: seed 10 default small projects
    this.version(10).stores({
      projects: '&id, name, projectType, parentProjectId',
    }).upgrade(async (tx) => {
      const defaultSmallProjects = [
        { id: crypto.randomUUID(), name: '课程表', color: '#7C3AED', icon: 'GraduationCap', description: '', sortOrder: 0, projectType: 'small', isDefault: true, moreRoute: '/more/schedule', createdAt: Date.now() },
        { id: crypto.randomUUID(), name: '作息', color: '#6366F1', icon: 'Clock', description: '', sortOrder: 1, projectType: 'small', isDefault: true, moreRoute: '/more/routine', createdAt: Date.now() },
        { id: crypto.randomUUID(), name: '记账', color: '#14B8A6', icon: 'Wallet', description: '', sortOrder: 2, projectType: 'small', isDefault: true, moreRoute: '/more/finance', createdAt: Date.now() },
        { id: crypto.randomUUID(), name: '饮水', color: '#0EA5E9', icon: 'Droplets', description: '', sortOrder: 3, projectType: 'small', isDefault: true, moreRoute: '/more/water', createdAt: Date.now() },
        { id: crypto.randomUUID(), name: '睡眠', color: '#1E293B', icon: 'Moon', description: '', sortOrder: 4, projectType: 'small', isDefault: true, moreRoute: '/more/sleep', createdAt: Date.now() },
        { id: crypto.randomUUID(), name: '训练', color: '#EF4444', icon: 'Dumbbell', description: '', sortOrder: 5, projectType: 'small', isDefault: true, moreRoute: '/more/fitness', createdAt: Date.now() },
        { id: crypto.randomUUID(), name: '饮食', color: '#F97316', icon: 'Utensils', description: '', sortOrder: 6, projectType: 'small', isDefault: true, moreRoute: '/more/diet', createdAt: Date.now() },
        { id: crypto.randomUUID(), name: '养生', color: '#84CC16', icon: 'Flower2', description: '', sortOrder: 7, projectType: 'small', isDefault: true, moreRoute: '/more/wellness', createdAt: Date.now() },
        { id: crypto.randomUUID(), name: '体态拉伸', color: '#06B6D4', icon: 'StretchHorizontal', description: '', sortOrder: 8, projectType: 'small', isDefault: true, moreRoute: '/more/stretch', createdAt: Date.now() },
        { id: crypto.randomUUID(), name: '吃药', color: '#DC2626', icon: 'Pill', description: '', sortOrder: 9, projectType: 'small', isDefault: true, moreRoute: '/more/medication', createdAt: Date.now() },
      ];
      for (const sp of defaultSmallProjects) {
        await tx.table('projects').add(sp);
      }
    });
  }
}

export const efficiencyDB = new EfficiencyDB();

export async function initializeEfficiencyDB(): Promise<{ success: boolean; error?: string }> {
  try {
    await efficiencyDB.open();
    // Seed 默认项目（仅在 projects 表为空时）
    const projectCount = await efficiencyDB.projects.count();
    if (projectCount === 0) {
      const defaults = [
        { name: "学习", color: "#FF9500", icon: "BookOpen", description: "", sortOrder: 0 },
        { name: "健康", color: "#34C759", icon: "Activity", description: "", sortOrder: 1 },
        { name: "琐事", color: "#5856D6", icon: "ClipboardList", description: "", sortOrder: 2 },
        { name: "长期主义", color: "#AF52DE", icon: "Clock", description: "", sortOrder: 3 },
        { name: "娱乐", color: "#FF2D55", icon: "Gamepad2", description: "", sortOrder: 4 },
        { name: "无项目", color: "#FFFFFF", icon: "Circle", description: "", sortOrder: 5 },
      ];
      for (const p of defaults) {
        // Existing defaults from v4 become 'small' type
        await efficiencyDB.projects.add({ ...p, id: crypto.randomUUID(), projectType: 'small' as any, createdAt: Date.now() });
      }
    }
    return { success: true };
  } catch (err) {
    return { success: false, error: (err as Error).message };
  }
}

// ─── Goals CRUD (v2) ────────────────────────────────────────

export async function addGoal(g: Omit<Goal, 'id' | 'createdAt'>): Promise<string> {
  const id = crypto.randomUUID();
  await efficiencyDB.goals.add({ ...g, id, createdAt: Date.now() });
  return id;
}

export async function updateGoal(id: string, updates: Partial<Goal>): Promise<void> {
  await efficiencyDB.goals.update(id, updates);
}

export async function deleteGoal(id: string): Promise<void> {
  await efficiencyDB.goals.delete(id);
}

export async function getGoal(id: string): Promise<Goal | undefined> {
  return efficiencyDB.goals.get(id);
}

export async function getAllGoalsV2(): Promise<Goal[]> {
  return efficiencyDB.goals.toArray();
}

export async function getTasksByGoalId(goalId: string): Promise<EfficiencyTask[]> {
  return efficiencyDB.tasks.where('goalId').equals(goalId as any).toArray();
}

export async function recalculateGoalProgress(goalId: string): Promise<number> {
  const tasks = await efficiencyDB.tasks.where('goalId').equals(goalId as any).toArray();
  if (tasks.length === 0) return 0;
  const done = tasks.filter(t => t.status === 'done').length;
  return Math.round((done / tasks.length) * 100);
}

// ─── Goals CRUD (Legacy) ─────────────────────────────────────

export async function addGoalLegacy(goal: Omit<EfficiencyGoal, 'id' | 'createdAt' | 'updatedAt'>): Promise<number> {
  const now = Date.now();
  return efficiencyDB.tasks.add({} as any) as any; // Deprecated: goals table schema changed to string id
}

export async function updateGoalLegacy(id: number, updates: Partial<EfficiencyGoal>): Promise<void> {
  // Deprecated: goals table schema changed to string id
}

export async function deleteGoalLegacy(id: number): Promise<void> {
  await efficiencyDB.goals.delete(id as any);
}

export async function getAllGoals(): Promise<EfficiencyGoal[]> {
  return efficiencyDB.goals.toArray() as any;
}

// ─── Tasks CRUD ──────────────────────────────────────────────

export async function addTask(task: Omit<EfficiencyTask, 'id' | 'createdAt' | 'updatedAt'>): Promise<number> {
  const now = Date.now();
  return efficiencyDB.tasks.add({ ...task, createdAt: now, updatedAt: now });
}

export async function updateTask(id: number, updates: Partial<EfficiencyTask>): Promise<void> {
  await efficiencyDB.tasks.update(id, { ...updates, updatedAt: Date.now() });
}

export async function deleteTask(id: number): Promise<void> {
  await efficiencyDB.tasks.delete(id);
}

export async function getAllTasks(): Promise<EfficiencyTask[]> {
  return efficiencyDB.tasks.toArray();
}

// ─── Habits CRUD ─────────────────────────────────────────────

export async function addHabit(habit: Omit<EfficiencyHabit, 'id' | 'createdAt' | 'updatedAt'>): Promise<number> {
  const now = Date.now();
  return efficiencyDB.habits.add({ ...habit, createdAt: now, updatedAt: now });
}

export async function updateHabit(id: number, updates: Partial<EfficiencyHabit>): Promise<void> {
  await efficiencyDB.habits.update(id, { ...updates, updatedAt: Date.now() });
}

export async function deleteHabit(id: number): Promise<void> {
  await efficiencyDB.habits.delete(id);
}

export async function getAllHabits(): Promise<EfficiencyHabit[]> {
  return efficiencyDB.habits.toArray();
}

// ─── Projects CRUD ───────────────────────────────────────────

export async function addProject(
  p: Omit<Project, "id" | "createdAt" | "projectType"> & { projectType?: 'big' | 'small' }
): Promise<string> {
  const id = crypto.randomUUID();
  await efficiencyDB.projects.add({
    ...p,
    id,
    projectType: p.projectType || 'small',
    createdAt: Date.now(),
  } as Project);
  return id;
}

export async function updateProject(id: string, updates: Partial<Project>): Promise<void> {
  await efficiencyDB.projects.update(id, updates);
}

export async function deleteProject(id: string): Promise<void> {
  await efficiencyDB.projects.delete(id);
}

export async function getAllProjects(): Promise<Project[]> {
  const all = await efficiencyDB.projects.toArray();
  return all.sort((a, b) => a.sortOrder - b.sortOrder);
}

// ─── Schedule Tasks CRUD ─────────────────────────────────────

export async function addScheduleTask(task: Omit<ScheduleTask, 'id' | 'createdAt'>): Promise<string> {
  const id = crypto.randomUUID();
  await efficiencyDB.scheduleTasks.add({ ...task, id, createdAt: Date.now() });
  return id;
}

export async function updateScheduleTask(id: string, updates: Partial<ScheduleTask>): Promise<void> {
  await efficiencyDB.scheduleTasks.update(id, updates);
}

export async function deleteScheduleTask(id: string): Promise<void> {
  await efficiencyDB.scheduleTasks.delete(id);
}

export async function getScheduleTasksByDate(dateStr: string): Promise<ScheduleTask[]> {
  const all = await efficiencyDB.scheduleTasks.toArray();
  return all.filter(task => {
    // 单日任务：date === dateStr
    if (task.date === dateStr) return true;
    // 多日任务：startDate <= dateStr <= endDate
    if (task.type === 'multi_day' && task.startDate && task.endDate) {
      return task.startDate <= dateStr && task.endDate >= dateStr;
    }
    return false;
  });
}

export async function getAllScheduleTasks(): Promise<ScheduleTask[]> {
  return efficiencyDB.scheduleTasks.toArray();
}
