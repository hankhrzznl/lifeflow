import Dexie, { type Table } from 'dexie';

// ─── Types ───────────────────────────────────────────────────

export interface Goal {
  id: string;           // uuid, primary key
  projectId?: string;      // FK → Project，null=未分类
  title: string;
  color: string;        // hex color like "#5856D6"
  deadline: string;     // ISO date YYYY-MM-DD
  progress: number;     // 0-100
  status: 'active' | 'completed' | 'paused' | 'archived';
  completedAt?: number; // 完成时间戳(ms)，status→completed 时写入
  goalType?: 'count' | 'habit';   // 目标类型，默认 'count'
  targetCount?: number;           // 完成 N 次，默认 5
  note?: string;                  // 备注，默认 ''
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
  date: string | null;      // YYYY-MM-DD
  startDate?: string;
  endDate?: string;
  recurringDays?: number[]; // [0-6]
  quadrant?: 'q1' | 'q2' | 'q3' | 'q4';  // 四象限: q1=重要紧急 q2=重要不紧急 q3=不重要紧急 q4=不重要不紧急
  isCompleted: boolean;
  plannedTime: number;      // 分钟
  actualTime: number;
  isImportant: boolean;
  note: string;
  // 进度条任务扩展字段
  progressType?: 'normal' | 'progress';  // 任务类型
  progressPeriod?: 'none' | 'daily' | 'weekly' | 'monthly';
  targetValue?: number;
  targetUnit?: string;
  startValue?: number;
  taskDays?: 'everyday' | 'workday' | 'weekend' | 'custom';
  dailyMin?: number;
  progressCalc?: 'sum' | 'average';
  hasSubTasks?: boolean;
  progressCurrent?: number;   // 当前进度值（手动更新）
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
        { name: "工作", color: "#6366F1", icon: "Briefcase", description: "", sortOrder: 0 },
        { name: "学习", color: "#FF9500", icon: "BookOpen", description: "", sortOrder: 1 },
        { name: "生活", color: "#34C759", icon: "Heart", description: "", sortOrder: 2 },
        { name: "健康", color: "#FF3B30", icon: "Activity", description: "", sortOrder: 3 },
      ];
      for (const p of defaults) {
        await addProject(p);
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

export async function addProject(p: Omit<Project, 'id' | 'createdAt'>): Promise<string> {
  const id = crypto.randomUUID();
  await efficiencyDB.projects.add({ ...p, id, createdAt: Date.now() });
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
