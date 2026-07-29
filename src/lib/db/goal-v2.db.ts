import Dexie, { type Table } from 'dexie';

// ============================================================
// GoalV2 — 五层拆解目标系统
// ============================================================

// ── 第一层：目标（Goal） ──

export interface GoalV2 {
  id: string;
  title: string;
  vision: string;         // 愿景画面
  color: string;
  status: 'active' | 'completed' | 'paused';
  progress: number;       // 0-100，由引擎自动计算
  createdAt: number;       // Unix 毫秒
}

// ── 第二层：关键结果（KeyResult） ──

export interface KeyResultV2 {
  id: string;
  goalId: string;
  description: string;    // "体脂率降至 22% 以下"
  targetValue: number;    // 22
  currentValue: number;   // 28（用户手动更新）
  unit: string;           // "%" / "cm" / "次"
  deadline: string;       // YYYY-MM-DD
  sortOrder: number;
}

// ── 第三层：策略（Strategy） ──

export interface StrategyV2 {
  id: string;
  goalId: string;
  name: string;           // "饮食控制"
  description: string;    // "通过控制热量摄入..."
  sortOrder: number;
}

// ── 第四层：周任务（WeeklyTask） ──

export interface WeeklyTaskV2 {
  id: string;
  strategyId: string;
  goalId: string;
  title: string;           // "本周学会看营养成分表"
  weekStart: string;       // ISO 周起始日期 YYYY-MM-DD（周日）
  deliverable: string;     // 本周必须交付的成果
  isCompleted: boolean;
  sortOrder: number;
}

// ── 第五层：每日行动（DailyAction） ──

export interface DailyActionV2 {
  id: string;
  weeklyTaskId: string;
  strategyId: string;
  goalId: string;
  date: string;           // YYYY-MM-DD
  title: string;          // "早餐：鸡蛋+豆浆+全麦面包"
  time: string;           // "08:00"
  duration: number;       // 分钟
  isCompleted: boolean;
  sortOrder: number;
  itemId?: string;        // 同步写入 Item 表的 id
}

// ============================================================
// DB 定义
// ============================================================

class GoalV2DB extends Dexie {
  goalV2Goals!: Table<GoalV2, string>;
  goalV2KeyResults!: Table<KeyResultV2, string>;
  goalV2Strategies!: Table<StrategyV2, string>;
  goalV2WeeklyTasks!: Table<WeeklyTaskV2, string>;
  goalV2DailyActions!: Table<DailyActionV2, string>;

  constructor() {
    super('LifeFlowGoalV2');
    this.version(1).stores({
      goalV2Goals: 'id, status, createdAt',
      goalV2KeyResults: 'id, goalId, sortOrder',
      goalV2Strategies: 'id, goalId, sortOrder',
      goalV2WeeklyTasks: 'id, strategyId, goalId, weekStart',
      goalV2DailyActions: 'id, weeklyTaskId, strategyId, goalId, date, isCompleted',
    });
  }
}

export const goalV2DB = new GoalV2DB();

// ============================================================
// CRUD — Goal
// ============================================================

export async function addGoalV2(g: Omit<GoalV2, 'id' | 'createdAt' | 'progress'>): Promise<string> {
  const id = crypto.randomUUID();
  await goalV2DB.goalV2Goals.add({ ...g, id, progress: 0, createdAt: Date.now() });
  return id;
}

export async function getGoalV2(id: string): Promise<GoalV2 | undefined> {
  return goalV2DB.goalV2Goals.get(id);
}

export async function getAllGoalsV2(): Promise<GoalV2[]> {
  return goalV2DB.goalV2Goals.orderBy('createdAt').reverse().toArray();
}

export async function updateGoalV2(id: string, updates: Partial<GoalV2>): Promise<void> {
  await goalV2DB.goalV2Goals.update(id, updates);
}

export async function deleteGoalV2(id: string): Promise<void> {
  // 级联删除
  await goalV2DB.goalV2KeyResults.where('goalId').equals(id).delete();
  await goalV2DB.goalV2Strategies.where('goalId').equals(id).delete();
  await goalV2DB.goalV2WeeklyTasks.where('goalId').equals(id).delete();
  await goalV2DB.goalV2DailyActions.where('goalId').equals(id).delete();
  await goalV2DB.goalV2Goals.delete(id);
}

// ============================================================
// CRUD — KeyResult
// ============================================================

export async function addKeyResultV2(kr: Omit<KeyResultV2, 'id'>): Promise<string> {
  const id = crypto.randomUUID();
  await goalV2DB.goalV2KeyResults.add({ ...kr, id });
  return id;
}

export async function getKeyResultsV2(goalId: string): Promise<KeyResultV2[]> {
  return goalV2DB.goalV2KeyResults.where('goalId').equals(goalId).sortBy('sortOrder');
}

export async function updateKeyResultV2(id: string, updates: Partial<KeyResultV2>): Promise<void> {
  await goalV2DB.goalV2KeyResults.update(id, updates);
}

export async function deleteKeyResultV2(id: string): Promise<void> {
  await goalV2DB.goalV2KeyResults.delete(id);
}

// ============================================================
// CRUD — Strategy
// ============================================================

export async function addStrategyV2(s: Omit<StrategyV2, 'id'>): Promise<string> {
  const id = crypto.randomUUID();
  await goalV2DB.goalV2Strategies.add({ ...s, id });
  return id;
}

export async function getStrategiesV2(goalId: string): Promise<StrategyV2[]> {
  return goalV2DB.goalV2Strategies.where('goalId').equals(goalId).sortBy('sortOrder');
}

export async function updateStrategyV2(id: string, updates: Partial<StrategyV2>): Promise<void> {
  await goalV2DB.goalV2Strategies.update(id, updates);
}

export async function deleteStrategyV2(id: string): Promise<void> {
  await goalV2DB.goalV2WeeklyTasks.where('strategyId').equals(id).delete();
  await goalV2DB.goalV2DailyActions.where('strategyId').equals(id).delete();
  await goalV2DB.goalV2Strategies.delete(id);
}

// ============================================================
// CRUD — WeeklyTask
// ============================================================

export async function addWeeklyTaskV2(wt: Omit<WeeklyTaskV2, 'id'>): Promise<string> {
  const id = crypto.randomUUID();
  await goalV2DB.goalV2WeeklyTasks.add({ ...wt, id });
  return id;
}

export async function getWeeklyTasksV2(strategyId: string): Promise<WeeklyTaskV2[]> {
  return goalV2DB.goalV2WeeklyTasks.where('strategyId').equals(strategyId).sortBy('sortOrder');
}

export async function getWeeklyTasksByGoalV2(goalId: string): Promise<WeeklyTaskV2[]> {
  return goalV2DB.goalV2WeeklyTasks.where('goalId').equals(goalId).toArray();
}

export async function updateWeeklyTaskV2(id: string, updates: Partial<WeeklyTaskV2>): Promise<void> {
  await goalV2DB.goalV2WeeklyTasks.update(id, updates);
}

export async function deleteWeeklyTaskV2(id: string): Promise<void> {
  await goalV2DB.goalV2DailyActions.where('weeklyTaskId').equals(id).delete();
  await goalV2DB.goalV2WeeklyTasks.delete(id);
}

// ============================================================
// CRUD — DailyAction
// ============================================================

export async function addDailyActionV2(da: Omit<DailyActionV2, 'id'>): Promise<string> {
  const id = crypto.randomUUID();
  await goalV2DB.goalV2DailyActions.add({ ...da, id });
  return id;
}

export async function getDailyActionsV2(weeklyTaskId: string): Promise<DailyActionV2[]> {
  return goalV2DB.goalV2DailyActions.where('weeklyTaskId').equals(weeklyTaskId).sortBy('sortOrder');
}

export async function getDailyActionsByDateV2(date: string): Promise<DailyActionV2[]> {
  return goalV2DB.goalV2DailyActions.where('date').equals(date).toArray();
}

export async function updateDailyActionV2(id: string, updates: Partial<DailyActionV2>): Promise<void> {
  await goalV2DB.goalV2DailyActions.update(id, updates);
}

export async function deleteDailyActionV2(id: string): Promise<void> {
  await goalV2DB.goalV2DailyActions.delete(id);
}
