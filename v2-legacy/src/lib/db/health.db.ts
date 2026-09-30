import Dexie, { type Table } from 'dexie';

// ─── Types ───────────────────────────────────────────────────

export interface WaterLog {
  id: string;            // uuid
  date: string;          // YYYY-MM-DD
  amount: number;        // ml (单次饮水量)
  timestamp: number;     // Unix ms
}

export interface WaterGoal {
  id?: number;
  dailyTarget: number;       // 每日目标ml (default 2000)
  reminderInterval: number;  // 提醒间隔分钟 (30/60/90/120, 0=关闭) — T15 起不再生成 hourly 提醒，保留字段兼容
  nightMode: boolean;        // 夜间免打扰
  cupSize?: number;          // 杯量 ml (default 200)
  wakeStart?: string;        // 起床时间 "08:00"
  wakeEnd?: string;          // 入睡时间 "22:00"
  napStart?: string;         // 午睡开始时间 "13:00"
  napEnd?: string;           // 午睡结束时间 "13:30"
  // T15：三时段目标占比（和=100）。时段边界派生：上午[wakeStart,12:00) 下午[12:00,18:00) 晚上[18:00,wakeEnd-2h)
  morningPercent?: number;   // 上午占比 (default 35)
  afternoonPercent?: number; // 下午占比 (default 40)
  eveningPercent?: number;   // 晚上占比 (default 25)
  createdAt: number;
  updatedAt: number;
}

export interface SleepLog {
  id: string;            // uuid
  date: string;          // YYYY-MM-DD
  targetTime: string;    // HH:mm (e.g. "23:30")
  actualTime: string;    // HH:mm actual bedtime
  isOnTime: boolean;     // whether met target
  minutesDiff: number;   // diff from target (negative = early)
  createdAt: number;
}

export interface SleepGoalV2 {
  id?: number;
  targetTime: string;         // default "23:30"
  reminderAdvance: number;    // default 15, range 5-60
  reminderEnabled: boolean;   // default true
  earlySleepEnabled: boolean;  // CBT-I渐进早睡开关
  earlySleepStepMinutes: number; // 每晚安多少分钟(默认15)
  createdAt: number;
  updatedAt: number;
}

// ─── Stretch Types ────────────────────────────────────────────

export interface StretchLog {
  id?: number;
  exerciseName: string;       // "猫式拉伸"
  sets: number;               // 3
  reps: number;               // 15
  postureIssue?: string;      // "驼背" | "圆肩" | "骨盆前倾" | ...
  note?: string;
  date: string;               // "YYYY-MM-DD"
  createdAt: number;
}

// ─── Posture Settings Types ────────────────────────────────────

export interface PostureSettings {
  id?: number;
  preSleepOffset: number;     // 睡前拉伸提前量（分钟），default 40
  postWakeOffset: number;     // 睡醒拉伸延后量（分钟），default 2
  napExclude: boolean;        // 午睡不触发睡前拉伸，default true
  updatedAt: number;
}

// ─── V2 Types ─────────────────────────────────────────────────

export interface MuscleGroupV2 {
  id: string;            // uuid
  name: string;          // 胸部/背部/腿部/肩部/手臂/核心
  subMuscles: string[];  // e.g. ["胸大肌","胸小肌"]
  icon: string;          // lucide icon name
  order: number;
}

export interface ExerciseV2 {
  id: string;
  muscleGroupId: string;
  name: string;          // e.g. "杠铃卧推"
  isCustom: boolean;
  createdAt: number;
}

export type TrainingType = 'gym_compound' | 'low_cardio' | 'farmer_walk' | 'weighted_rotation' | 'power_training';

export interface WorkoutSession {
  id: string;
  date: string;          // YYYY-MM-DD
  exercises: WorkoutExercise[];
  notes: string;
  trainingType?: TrainingType;  // 训练体系分类
  createdAt: number;
}

export interface WorkoutExercise {
  exerciseId: string;
  exerciseName: string;
  sets: ExerciseSet[];
}

export interface ExerciseSet {
  id: string;
  setNumber: number;
  reps: number;
  weight: number;        // kg
  rpe: number;           // 1-10
  isPR: boolean;
}

export interface TrainingPlan {
  id: string;
  name: string;
  trainingType: TrainingType;
  role: 'staple' | 'rotating';   // 主食=全年固定, 轮换=月度主辅
  frequency: 'weekly' | 'monthly';
  weeklyDays?: number[];         // 周循环: [1,3,5]=周一三五
  monthlyDays?: number[];        // 月计划: [1,15]=每月1号和15号
  exercises: string[];
  goalId?: string;               // FK → Goal（所有训练计划共享同一个「强健体魄」Goal）
  streak?: number;               // 连续打卡天数
  daysLog?: Record<string, boolean>;  // 打卡记录
  active: boolean;
  createdAt: number;
}

export interface MedicineDefinition {
  id: string;            // uuid
  name: string;          // "阿莫西林" / "维生素C"
  dosage: string;        // "500mg" / "1片"
  frequency: string;     // "每天3次" / "饭后"
  deadline?: string;     // YYYY-MM-DD，截止日期
  icon: string;          // "Pill"
  color: string;         // "#DC2626"
  active: boolean;       // 是否正在服用
  createdAt: number;
}

export interface MedicineLog {
  id: string;            // uuid
  medicineId: string;    // FK → MedicineDefinition
  date: string;          // YYYY-MM-DD
  timeSlot: string;      // "morning" | "noon" | "evening" | "bedtime"
  taken: boolean;        // 是否已服用
  note?: string;
  createdAt: number;
}

// ─── Database ────────────────────────────────────────────────

export class HealthDB extends Dexie {
  waterLogs!: Table<WaterLog, string>;
  waterGoals!: Table<WaterGoal, number>;
  sleepLogs!: Table<SleepLog, string>;
  sleepGoals!: Table<SleepGoalV2, number>;
  muscleGroupsV2!: Table<MuscleGroupV2, string>;
  exercisesV2!: Table<ExerciseV2, string>;
  workoutSessions!: Table<WorkoutSession, string>;
  stretchLogs!: Table<StretchLog, number>;
  postureSettings!: Table<PostureSettings, number>;
  trainingPlans!: Table<TrainingPlan, string>;
  medicines!: Table<MedicineDefinition, string>;
  medicineLogs!: Table<MedicineLog, string>;

  constructor() {
    super('LifeFlowHealth');
    this.version(1).stores({
      waterRecords: '++id, date, amount, goal, unit, createdAt',
      sleepRecords: '++id, date, bedTime, wakeTime, duration, quality, note, createdAt',
      fitnessRecords: '++id, date, exerciseId, sets, reps, weight, duration, note, createdAt',
      exercises: '++id, name, muscleGroupId, type',
      muscleGroups: '++id, name',
    });
    this.version(2).stores({
      waterLogs: '&id, date, timestamp',
      waterGoals: '++id',
    });
    this.version(3).stores({
      sleepLogs: '&id, date',
      sleepGoals: '++id',
    });
    this.version(4).stores({
      muscleGroupsV2: '&id, name, order',
      exercisesV2: '&id, muscleGroupId, name',
      workoutSessions: '&id, date',
    }).upgrade(async (tx) => {
      // Seed muscle groups
      const groups: Omit<MuscleGroupV2, 'createdAt'>[] = [
        { id: crypto.randomUUID(), name: '胸部', subMuscles: ['胸大肌','胸小肌','前锯肌','肋间肌'], icon: 'Armchair', order: 0 },
        { id: crypto.randomUUID(), name: '背部', subMuscles: ['背阔肌','斜方肌','竖脊肌'], icon: 'PanelBottom', order: 1 },
        { id: crypto.randomUUID(), name: '腿部', subMuscles: ['股四头肌','腘绳肌','臀大肌'], icon: 'Footprints', order: 2 },
        { id: crypto.randomUUID(), name: '肩部', subMuscles: ['前束','中束','后束'], icon: 'Triangle', order: 3 },
        { id: crypto.randomUUID(), name: '手臂', subMuscles: ['肱二头肌','肱三头肌','前臂'], icon: 'Grip', order: 4 },
        { id: crypto.randomUUID(), name: '核心', subMuscles: ['腹直肌','腹斜肌','下背'], icon: 'Circle', order: 5 },
      ];
      for (const g of groups) await tx.table('muscleGroupsV2').add(g);

      // Seed 12 default exercises
      const now = Date.now();
      const exercises: Omit<ExerciseV2, 'id' | 'createdAt'>[] = [
        { muscleGroupId: groups[0].id, name: '杠铃卧推', isCustom: false },
        { muscleGroupId: groups[0].id, name: '哑铃飞鸟', isCustom: false },
        { muscleGroupId: groups[1].id, name: '引体向上', isCustom: false },
        { muscleGroupId: groups[1].id, name: '杠铃划船', isCustom: false },
        { muscleGroupId: groups[2].id, name: '杠铃深蹲', isCustom: false },
        { muscleGroupId: groups[2].id, name: '罗马尼亚硬拉', isCustom: false },
        { muscleGroupId: groups[3].id, name: '哑铃推举', isCustom: false },
        { muscleGroupId: groups[3].id, name: '侧平举', isCustom: false },
        { muscleGroupId: groups[4].id, name: '杠铃弯举', isCustom: false },
        { muscleGroupId: groups[4].id, name: '绳索下压', isCustom: false },
        { muscleGroupId: groups[5].id, name: '卷腹', isCustom: false },
        { muscleGroupId: groups[5].id, name: '平板支撑', isCustom: false },
      ];
      for (const e of exercises) {
        await tx.table('exercisesV2').add({ ...e, id: crypto.randomUUID(), createdAt: now });
      }
    });

    // v5: 体态拉伸记录表
    this.version(5).stores({
      stretchLogs: "++id, exerciseName, postureIssue, date, createdAt",
    });
    // v6: 训练计划
    this.version(6).stores({
      trainingPlans: "&id, trainingType, active, createdAt",
    });
    // v7: 吃药提醒
    this.version(7).stores({
      medicines: '&id, name',
      medicineLogs: '&id, medicineId, date',
    });
    // v8: 体态拉伸设置
    this.version(8).stores({
      postureSettings: '++id',
    });
    // v12 (T13): 物理删除 deprecated 旧表（T7 已归档只读，记录数核实为 0）。
    // 关键机制：Dexie 每个 version 的 dbschema 是历史全部 stores() 的累积并集，
    // 仅"不再列出"不会让表从累计 schema 消失 → deleteRemovedTables 永不触发。
    // 必须显式声明 `表名: null` 覆盖历史声明，该表才会从本版本 schema 移除并被物理 drop。
    this.version(12).stores({
      waterLogs: '&id, date, timestamp',
      waterGoals: '++id',
      sleepLogs: '&id, date',
      sleepGoals: '++id',
      muscleGroupsV2: '&id, name, order',
      exercisesV2: '&id, muscleGroupId, name',
      workoutSessions: '&id, date',
      stretchLogs: '++id, exerciseName, postureIssue, date, createdAt',
      trainingPlans: '&id, trainingType, active, createdAt',
      medicines: '&id, name',
      medicineLogs: '&id, medicineId, date',
      postureSettings: '++id',
      // 以下 deprecated 旧表显式置 null 强制物理删除
      waterRecords: null,
      sleepRecords: null,
      fitnessRecords: null,
      exercises: null,
      muscleGroups: null,
    });
  }
}

export const healthDB = new HealthDB();

/** 本地时区日期键（YYYY-MM-DD），严禁用 toISOString（UTC 口径会错位一天） */
function localDateStr(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

export async function initializeHealthDB(): Promise<{ success: boolean; error?: string }> {
  try {
    await healthDB.open();
    return { success: true };
  } catch (err) {
    return { success: false, error: (err as Error).message };
  }
}

// ─── Water Log CRUD ──────────────────────────────────────────

export async function addWaterLog(record: Omit<WaterLog, 'id'>): Promise<string> {
  const id = crypto.randomUUID();
  await healthDB.waterLogs.add({ ...record, id });
  return id;
}

export async function getWaterLogsByDate(date: string): Promise<WaterLog[]> {
  return healthDB.waterLogs.where('date').equals(date).toArray();
}

export async function deleteWaterLog(id: string): Promise<void> {
  await healthDB.waterLogs.delete(id);
}

// ─── 统一饮水流水口径（T6）───────────────────────────────────
// 约定：waterLogs 是唯一流水源（实际饮水量 ml）；daylog water items 仅承担"待办"展示。
// 所有页面统计 ml 一律读取本层，禁止再按 daylog 完成杯数 × 杯量推算。

/** 某日实际饮水量（waterLogs 当日流水求和） */
export async function getWaterMlByDate(date: string): Promise<number> {
  const logs = await healthDB.waterLogs.where('date').equals(date).toArray();
  return logs.reduce((sum, l) => sum + (l.amount || 0), 0);
}

/** 日期区间实际饮水量汇总，按天聚合 */
export async function getWaterMlBetween(start: string, end: string): Promise<{ date: string; amount: number }[]> {
  const logs = await healthDB.waterLogs.where('date').between(start, end, true, true).toArray();
  const map = new Map<string, number>();
  for (const l of logs) {
    map.set(l.date, (map.get(l.date) || 0) + (l.amount || 0));
  }
  return Array.from(map.entries()).map(([date, amount]) => ({ date, amount }));
}

/**
 * daylog 饮水"待办"勾选/取消时同步流水。
 * 每杯默认 100ml，与饮水页既有历史口径一致；取消勾选时回退。
 */
export async function syncWaterLogOnToggle(date: string, completed: boolean): Promise<void> {
  const CUP_ML = 100;
  const existing = await healthDB.waterLogs.where('date').equals(date).first();
  const delta = completed ? CUP_ML : -CUP_ML;
  const next = Math.max(0, (existing?.amount || 0) + delta);
  if (next === 0) {
    if (existing?.id) await healthDB.waterLogs.delete(existing.id);
  } else if (existing?.id) {
    await healthDB.waterLogs.update(existing.id, { amount: next, timestamp: Date.now() });
  } else {
    await healthDB.waterLogs.add({
      id: crypto.randomUUID(),
      date,
      amount: next,
      timestamp: Date.now(),
    } as WaterLog);
  }
}

// ─── T15：饮水时段目标制 ────────────────────────────────────
// 时段划分（派生自 wakeStart/wakeEnd）：
//   上午 [wakeStart, 12:00) · 下午 [12:00, 18:00) · 晚上 [18:00, wakeEnd-2h)
//   wakeEnd-2h 之后为夜间（睡前 2 小时，不参与目标）
// 约定：waterLogs 仍为唯一流水源；每次饮水一条独立记录（amount=单次杯量，
// timestamp=时刻），按 timestamp 归属时段聚合。

function todayStr(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function waterMinutesOf(time: string): number {
  const [h, m] = (time || '08:00').split(':').map(Number);
  return h * 60 + (m || 0);
}

function waterTimeOf(minutes: number): string {
  const h = Math.floor(minutes / 60) % 24;
  const m = minutes % 60;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}

export interface WaterPeriodInfo {
  key: 'morning' | 'afternoon' | 'evening';
  label: string;
  start: string;
  end: string;
  target: number; // 时段目标 ml
}

/** 晚间截止时刻 = wakeEnd - 2h（睡前 2 小时）；下限 18:01 避免空时段 */
function eveningCutoff(goal: WaterGoal): number {
  return Math.max(waterMinutesOf(goal.wakeEnd || '22:00') - 120, 18 * 60 + 1);
}

/** 计算三时段时间范围与目标（占比 × 每日目标） */
export function getWaterPeriods(goal: WaterGoal): WaterPeriodInfo[] {
  const daily = goal.dailyTarget || 2000;
  const pcts = {
    morning: goal.morningPercent ?? 35,
    afternoon: goal.afternoonPercent ?? 40,
    evening: goal.eveningPercent ?? 25,
  };
  const raw: WaterPeriodInfo[] = [
    { key: 'morning', label: '上午', start: waterTimeOf(waterMinutesOf(goal.wakeStart || '08:00')), end: '12:00', target: Math.round(daily * pcts.morning / 100) },
    { key: 'afternoon', label: '下午', start: '12:00', end: '18:00', target: Math.round(daily * pcts.afternoon / 100) },
    { key: 'evening', label: '晚上', start: '18:00', end: waterTimeOf(eveningCutoff(goal)), target: Math.round(daily * pcts.evening / 100) },
  ];
  // 过滤无效时段（start >= end），如 wakeStart 晚于 12:00 时上午为空
  return raw.filter(p => waterMinutesOf(p.start) < waterMinutesOf(p.end));
}

/** 判定某时刻归属的时段；睡前 2 小时内返回 'night'（不计入目标） */
export function getWaterPeriodOfTime(timeStr: string, goal: WaterGoal): WaterPeriodInfo['key'] | 'night' {
  const m = waterMinutesOf(timeStr);
  const wakeStart = waterMinutesOf(goal.wakeStart || '08:00');
  if (m >= 18 * 60 && m < eveningCutoff(goal)) return 'evening';
  if (m >= 12 * 60 && m < 18 * 60) return 'afternoon';
  if (m >= wakeStart && m < 12 * 60) return 'morning';
  return 'night';
}

/** 记录一次饮水（「+一杯」直记，逐次流水，按当前时刻归属时段） */
export async function addWaterCup(date?: string, cupMl?: number): Promise<void> {
  const goal = await getWaterGoal();
  const d = date || todayStr();
  await addWaterLog({
    date: d,
    amount: cupMl || goal.cupSize || 200,
    timestamp: Date.now(),
  });
}

/** 某日各时段已饮 ml（按 timestamp 归属；历史「汇总单条」记录按最近时刻尽力归属） */
export async function getWaterMlByPeriod(
  date: string,
  goal: WaterGoal,
): Promise<Record<'morning' | 'afternoon' | 'evening' | 'night', number>> {
  const logs = await healthDB.waterLogs.where('date').equals(date).toArray();
  const result = { morning: 0, afternoon: 0, evening: 0, night: 0 };
  for (const l of logs) {
    const dt = new Date(l.timestamp);
    const timeStr = `${String(dt.getHours()).padStart(2, '0')}:${String(dt.getMinutes()).padStart(2, '0')}`;
    const key = getWaterPeriodOfTime(timeStr, goal);
    result[key] += l.amount || 0;
  }
  return result;
}

// ─── Water Goal CRUD ─────────────────────────────────────────

const DEFAULT_WATER_GOAL: Omit<WaterGoal, 'id'> = {
  dailyTarget: 2000,
  reminderInterval: 0,
  nightMode: false,
  cupSize: 200,
  wakeStart: '08:00',
  wakeEnd: '22:00',
  napStart: '',
  napEnd: '',
  morningPercent: 35,
  afternoonPercent: 40,
  eveningPercent: 25,
  createdAt: Date.now(),
  updatedAt: Date.now(),
};

export async function getWaterGoal(): Promise<WaterGoal> {
  const goals = await healthDB.waterGoals.toArray();
  if (goals.length === 0) {
    const id = await healthDB.waterGoals.add(DEFAULT_WATER_GOAL);
    return { ...DEFAULT_WATER_GOAL, id };
  }
  return goals[0];
}

export async function saveWaterGoal(goal: Partial<WaterGoal> & Pick<WaterGoal, 'dailyTarget' | 'reminderInterval' | 'nightMode'>): Promise<void> {
  const now = Date.now();
  // Merge with existing goal to preserve fields not being updated
  const existing = await healthDB.waterGoals.toArray();
  const merged = { ...DEFAULT_WATER_GOAL, ...(existing[0] || {}), ...goal, createdAt: now, updatedAt: now };
  await healthDB.waterGoals.clear();
  await healthDB.waterGoals.add(merged);
}

export async function updateWaterGoal(updates: Partial<WaterGoal>): Promise<void> {
  const existing = await getWaterGoal();
  if (existing.id !== undefined) {
    await healthDB.waterGoals.update(existing.id, {
      ...existing,
      ...updates,
      updatedAt: Date.now(),
    });
  }
}

// ─── Sleep Log CRUD ──────────────────────────────────────────

export async function addSleepLog(record: Omit<SleepLog, 'id' | 'createdAt'>): Promise<string> {
  const id = crypto.randomUUID();
  await healthDB.sleepLogs.add({ ...record, id, createdAt: Date.now() });
  return id;
}

export async function getSleepLogByDate(date: string): Promise<SleepLog | undefined> {
  return healthDB.sleepLogs.where('date').equals(date).first();
}

export async function getSleepLogs(days: number): Promise<SleepLog[]> {
  const dates: string[] = [];
  for (let i = 0; i < days; i++) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    dates.push(localDateStr(d));
  }
  // Reverse so newest is first
  dates.reverse();
  return healthDB.sleepLogs.where('date').anyOf(dates).toArray();
}

export async function updateSleepLog(id: string, updates: Partial<SleepLog>): Promise<void> {
  await healthDB.sleepLogs.update(id, updates);
}

export async function deleteSleepLog(id: string): Promise<void> {
  await healthDB.sleepLogs.delete(id);
}

// ─── Sleep Goal CRUD ─────────────────────────────────────────

const DEFAULT_SLEEP_GOAL: Omit<SleepGoalV2, 'id'> = {
  targetTime: '23:30',
  reminderAdvance: 15,
  reminderEnabled: true,
  earlySleepEnabled: false,
  earlySleepStepMinutes: 15,
  createdAt: Date.now(),
  updatedAt: Date.now(),
};

export async function getSleepGoal(): Promise<SleepGoalV2> {
  const goals = await healthDB.sleepGoals.toArray();
  if (goals.length === 0) {
    const id = await healthDB.sleepGoals.add(DEFAULT_SLEEP_GOAL);
    return { ...DEFAULT_SLEEP_GOAL, id };
  }
  return goals[0];
}

export async function updateSleepGoalV2(updates: Partial<SleepGoalV2>): Promise<void> {
  const existing = await getSleepGoal();
  if (existing.id !== undefined) {
    await healthDB.sleepGoals.update(existing.id, {
      ...existing,
      ...updates,
      updatedAt: Date.now(),
    });
  }
}

// ─── Muscle Groups V2 CRUD ───────────────────────────────────

export async function getMuscleGroupsV2(): Promise<MuscleGroupV2[]> {
  return healthDB.muscleGroupsV2.orderBy('order').toArray();
}

// ─── Exercises V2 CRUD ───────────────────────────────────────

export async function getExercisesV2(): Promise<ExerciseV2[]> {
  return healthDB.exercisesV2.toArray();
}

export async function getExercisesByMuscle(muscleGroupId: string): Promise<ExerciseV2[]> {
  return healthDB.exercisesV2.where('muscleGroupId').equals(muscleGroupId).toArray();
}

export async function addExerciseV2(ex: Omit<ExerciseV2, 'id' | 'createdAt'>): Promise<string> {
  const id = crypto.randomUUID();
  await healthDB.exercisesV2.add({ ...ex, id, createdAt: Date.now() });
  return id;
}

// ─── Workout Sessions CRUD ───────────────────────────────────

export async function addWorkoutSession(session: Omit<WorkoutSession, 'id' | 'createdAt'>): Promise<string> {
  const id = crypto.randomUUID();
  await healthDB.workoutSessions.add({ ...session, id, createdAt: Date.now() });
  return id;
}

export async function getWorkoutSessions(days?: number): Promise<WorkoutSession[]> {
  if (!days) return healthDB.workoutSessions.orderBy('date').reverse().toArray();

  const dates: string[] = [];
  for (let i = 0; i < days; i++) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    dates.push(localDateStr(d));
  }
  return healthDB.workoutSessions.where('date').anyOf(dates).toArray();
}

export async function getWorkoutSessionByDate(date: string): Promise<WorkoutSession | undefined> {
  return healthDB.workoutSessions.where('date').equals(date).first();
}

export async function deleteWorkoutSession(id: string): Promise<void> {
  await healthDB.workoutSessions.delete(id);
}

// ─── Medicine CRUD ────────────────────────────────────────────

export async function addMedicine(data: Omit<MedicineDefinition, 'id' | 'createdAt'>): Promise<string> {
  const id = crypto.randomUUID();
  await healthDB.medicines.add({ ...data, id, createdAt: Date.now() });
  return id;
}

export async function getMedicines(): Promise<MedicineDefinition[]> {
  return healthDB.medicines.toArray();
}

export async function updateMedicine(id: string, updates: Partial<MedicineDefinition>): Promise<void> {
  await healthDB.medicines.update(id, updates);
}

export async function deleteMedicine(id: string): Promise<void> {
  await healthDB.medicines.delete(id);
}

// ─── Medicine Log CRUD ────────────────────────────────────────

export async function getMedicineLogsByDate(date: string): Promise<MedicineLog[]> {
  return healthDB.medicineLogs.where('date').equals(date).toArray();
}

export async function upsertMedicineLog(log: Omit<MedicineLog, 'id' | 'createdAt'>): Promise<void> {
  const existing = await healthDB.medicineLogs
    .where({ medicineId: log.medicineId, date: log.date, timeSlot: log.timeSlot })
    .first();
  if (existing) {
    await healthDB.medicineLogs.update(existing.id, { ...log });
  } else {
    const id = crypto.randomUUID();
    await healthDB.medicineLogs.add({ ...log, id, createdAt: Date.now() });
  }
}

export async function getMedicineLogsByRange(startDate: string, endDate: string): Promise<MedicineLog[]> {
  return healthDB.medicineLogs
    .where('date')
    .between(startDate, endDate, true, true)
    .toArray();
}

// ─── Posture Settings CRUD ────────────────────────────────────

const DEFAULT_POSTURE_SETTINGS: Omit<PostureSettings, 'id'> = {
  preSleepOffset: 40,
  postWakeOffset: 2,
  napExclude: true,
  updatedAt: Date.now(),
};

export async function getPostureSettings(): Promise<PostureSettings> {
  const all = await healthDB.postureSettings.toArray();
  if (all.length === 0) {
    const id = await healthDB.postureSettings.add(DEFAULT_POSTURE_SETTINGS);
    return { ...DEFAULT_POSTURE_SETTINGS, id };
  }
  return all[0];
}

export async function updatePostureSettings(updates: Partial<PostureSettings>): Promise<void> {
  const existing = await getPostureSettings();
  if (existing.id !== undefined) {
    await healthDB.postureSettings.update(existing.id, {
      ...existing,
      ...updates,
      updatedAt: Date.now(),
    });
  }
}
