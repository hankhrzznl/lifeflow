import Dexie, { type Table } from 'dexie';

// ─── Types ───────────────────────────────────────────────────

export interface WaterRecord {
  id?: number;
  date: string;
  amount: number;
  goal: number;
  unit: string;
  createdAt: number;
}

export interface WaterLog {
  id: string;            // uuid
  date: string;          // YYYY-MM-DD
  amount: number;        // ml (单次饮水量)
  timestamp: number;     // Unix ms
}

export interface WaterGoal {
  id?: number;
  dailyTarget: number;       // 每日目标ml (default 2000)
  reminderInterval: number;  // 提醒间隔分钟 (30/60/90/120, 0=关闭)
  nightMode: boolean;        // 夜间免打扰
  cupSize?: number;          // 杯量 ml (default 200)
  createdAt: number;
  updatedAt: number;
}

export interface SleepRecord {
  id?: number;
  date: string;
  bedTime: string;
  wakeTime: string;
  duration: number;
  quality: 1 | 2 | 3 | 4 | 5;
  note?: string;
  createdAt: number;
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
  createdAt: number;
  updatedAt: number;
}

export interface FitnessRecord {
  id?: number;
  date: string;
  exerciseId: number;
  sets: number;
  reps: number;
  weight: number;
  duration?: number;
  note?: string;
  createdAt: number;
}

export interface Exercise {
  id?: number;
  name: string;
  muscleGroupId: number;
  type: string;
}

export interface MuscleGroup {
  id?: number;
  name: string;
}

export interface WeeklyStats {
  sessionCount: number;
  muscleGroupsCovered: number;
  personalBestCount: number;
  totalVolumeKg: number;
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
  goalId?: string;               // FK → Goal
  active: boolean;
  createdAt: number;
}

// ─── Database ────────────────────────────────────────────────

export class HealthDB extends Dexie {
  waterRecords!: Table<WaterRecord, number>;
  waterLogs!: Table<WaterLog, string>;
  waterGoals!: Table<WaterGoal, number>;
  sleepRecords!: Table<SleepRecord, number>;
  sleepLogs!: Table<SleepLog, string>;
  sleepGoals!: Table<SleepGoalV2, number>;
  fitnessRecords!: Table<FitnessRecord, number>;
  exercises!: Table<Exercise, number>;
  muscleGroups!: Table<MuscleGroup, number>;
  muscleGroupsV2!: Table<MuscleGroupV2, string>;
  exercisesV2!: Table<ExerciseV2, string>;
  workoutSessions!: Table<WorkoutSession, string>;
  stretchLogs!: Table<StretchLog, number>;
  trainingPlans!: Table<TrainingPlan, string>;

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

// ─── Water Records CRUD ──────────────────────────────────────

export async function addWaterRecord(record: Omit<WaterRecord, 'id' | 'createdAt'>): Promise<number> {
  return healthDB.waterRecords.add({ ...record, createdAt: Date.now() });
}

export async function updateWaterRecord(id: number, updates: Partial<WaterRecord>): Promise<void> {
  await healthDB.waterRecords.update(id, updates);
}

export async function deleteWaterRecord(id: number): Promise<void> {
  await healthDB.waterRecords.delete(id);
}

export async function getAllWaterRecords(): Promise<WaterRecord[]> {
  return healthDB.waterRecords.toArray();
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

// ─── Water Goal CRUD ─────────────────────────────────────────

const DEFAULT_WATER_GOAL: Omit<WaterGoal, 'id'> = {
  dailyTarget: 2000,
  reminderInterval: 0,
  nightMode: false,
  cupSize: 200,
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

export async function saveWaterGoal(goal: Omit<WaterGoal, 'id' | 'createdAt' | 'updatedAt'>): Promise<void> {
  const now = Date.now();
  // Delete all existing goals (should be only one)
  await healthDB.waterGoals.clear();
  await healthDB.waterGoals.add({
    ...goal,
    createdAt: now,
    updatedAt: now,
  });
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

// ─── Sleep Records CRUD ──────────────────────────────────────

export async function addSleepRecord(record: Omit<SleepRecord, 'id' | 'createdAt'>): Promise<number> {
  return healthDB.sleepRecords.add({ ...record, createdAt: Date.now() });
}

export async function updateSleepRecord(id: number, updates: Partial<SleepRecord>): Promise<void> {
  await healthDB.sleepRecords.update(id, updates);
}

export async function deleteSleepRecord(id: number): Promise<void> {
  await healthDB.sleepRecords.delete(id);
}

export async function getAllSleepRecords(): Promise<SleepRecord[]> {
  return healthDB.sleepRecords.toArray();
}

// ─── Fitness Records CRUD ────────────────────────────────────

export async function addFitnessRecord(record: Omit<FitnessRecord, 'id' | 'createdAt'>): Promise<number> {
  return healthDB.fitnessRecords.add({ ...record, createdAt: Date.now() });
}

export async function updateFitnessRecord(id: number, updates: Partial<FitnessRecord>): Promise<void> {
  await healthDB.fitnessRecords.update(id, updates);
}

export async function deleteFitnessRecord(id: number): Promise<void> {
  await healthDB.fitnessRecords.delete(id);
}

export async function getAllFitnessRecords(): Promise<FitnessRecord[]> {
  return healthDB.fitnessRecords.toArray();
}

// ─── Exercises CRUD ──────────────────────────────────────────

export async function addExercise(exercise: Omit<Exercise, 'id'>): Promise<number> {
  return healthDB.exercises.add(exercise);
}

export async function updateExercise(id: number, updates: Partial<Exercise>): Promise<void> {
  await healthDB.exercises.update(id, updates);
}

export async function deleteExercise(id: number): Promise<void> {
  await healthDB.exercises.delete(id);
}

export async function getAllExercises(): Promise<Exercise[]> {
  return healthDB.exercises.toArray();
}

// ─── Muscle Groups CRUD ──────────────────────────────────────

export async function addMuscleGroup(group: Omit<MuscleGroup, 'id'>): Promise<number> {
  return healthDB.muscleGroups.add(group);
}

export async function updateMuscleGroup(id: number, updates: Partial<MuscleGroup>): Promise<void> {
  await healthDB.muscleGroups.update(id, updates);
}

export async function deleteMuscleGroup(id: number): Promise<void> {
  await healthDB.muscleGroups.delete(id);
}

export async function getAllMuscleGroups(): Promise<MuscleGroup[]> {
  return healthDB.muscleGroups.toArray();
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
