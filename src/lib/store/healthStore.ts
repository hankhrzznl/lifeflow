import { create } from 'zustand';
import {
  db,
  addSleepRecord,
  deleteSleepRecord,
  addWorkoutRecord,
  deleteWorkoutRecord,
  getAllExercises,
  getAllMuscleGroups,
} from '../db';
import type {
  SleepRecord,
  WorkoutRecord,
  Exercise,
  MuscleGroup,
} from '../types';
import {
  addWaterLog,
  getWaterLogsByDate,
  deleteWaterLog,
  getWaterGoal,
  updateWaterGoal,
  addSleepLog,
  getSleepLogByDate,
  getSleepLogs,
  updateSleepLog,
  getSleepGoal as getSleepGoalV2,
  updateSleepGoalV2 as updateSleepGoalV2DB,
} from '../db/health.db';
import type {
  WaterLog,
  WaterGoal,
  SleepLog,
  SleepGoalV2,
  MuscleGroupV2,
  ExerciseV2,
  WorkoutSession,
} from '../db/health.db';
import {
  getMuscleGroupsV2,
  getExercisesV2,
  addExerciseV2,
  addWorkoutSession,
  getWorkoutSessions,
  deleteWorkoutSession,
} from '../db/health.db';

// ─── Helpers ─────────────────────────────────────────────────

const todayStr = () => new Date().toISOString().slice(0, 10);

const defaultWaterGoal: WaterGoal = {
  dailyTarget: 2000,
  reminderInterval: 0,
  nightMode: false,
  createdAt: Date.now(),
  updatedAt: Date.now(),
};

const defaultSleepGoal: SleepGoalV2 = {
  targetTime: '23:30',
  reminderAdvance: 15,
  reminderEnabled: true,
  createdAt: Date.now(),
  updatedAt: Date.now(),
};

// ─── Types ───────────────────────────────────────────────────

export type WaterRecord = WaterLog;
export type FitnessRecord = WorkoutRecord;

interface HealthState {
  // Water
  waterLogs: WaterLog[];
  waterGoal: WaterGoal;
  todayWaterTotal: number;

  // Sleep
  sleepRecords: SleepRecord[];
  sleepLogs: SleepLog[];
  sleepGoalV2: SleepGoalV2;
  todaySleepLog: SleepLog | null;

  // Fitness
  fitnessRecords: FitnessRecord[];
  exercises: Exercise[];
  muscleGroups: MuscleGroup[];

  // Fitness V2
  muscleGroupsV2: MuscleGroupV2[];
  exercisesV2: ExerciseV2[];
  workoutSessions: WorkoutSession[];
  weeklyStats: { sessions: number; muscles: number; prs: number; totalVolume: number };

  loading: boolean;

  // Water actions
  loadWaterData: () => Promise<void>;
  addWater: (ml: number) => Promise<void>;
  deleteWaterLog: (id: string) => Promise<void>;
  updateWaterGoal: (updates: Partial<WaterGoal>) => Promise<void>;

  // Sleep actions
  loadSleepRecords: (limit?: number) => Promise<void>;
  addSleep: (record: Omit<SleepRecord, 'id' | 'createdAt' | 'isPersonalBest'>) => Promise<void>;
  deleteSleep: (id: number) => Promise<void>;

  // Sleep V2 actions
  loadSleepData: () => Promise<void>;
  saveSleepLog: (record: Omit<SleepLog, 'id' | 'createdAt'> & { id?: string }) => Promise<void>;
  updateSleepGoalV2: (updates: Partial<SleepGoalV2>) => Promise<void>;
  getConsecutiveDays: () => number;

  // Fitness actions
  loadFitnessRecords: (limit?: number) => Promise<void>;
  addFitness: (record: Omit<FitnessRecord, 'id' | 'createdAt'>) => Promise<void>;
  deleteFitness: (id: number) => Promise<void>;
  loadExercises: () => Promise<void>;
  loadMuscleGroups: () => Promise<void>;

  // Fitness V2 actions
  loadFitnessDataV2: () => Promise<void>;
  addWorkoutSessionV2: (session: Omit<WorkoutSession, 'id' | 'createdAt'>) => Promise<void>;
  deleteWorkoutSessionV2: (id: string) => Promise<void>;

  loadAll: () => Promise<void>;
}

// ─── Store ───────────────────────────────────────────────────

export const useHealthStore = create<HealthState>()((set, get) => ({
  waterLogs: [],
  waterGoal: defaultWaterGoal,
  todayWaterTotal: 0,
  sleepRecords: [],
  sleepLogs: [],
  sleepGoalV2: defaultSleepGoal,
  todaySleepLog: null,
  fitnessRecords: [],
  exercises: [],
  muscleGroups: [],
  muscleGroupsV2: [],
  exercisesV2: [],
  workoutSessions: [],
  weeklyStats: { sessions: 0, muscles: 0, prs: 0, totalVolume: 0 },
  loading: false,

  // ─── Water ────────────────────────────────────────────────

  loadWaterData: async () => {
    try {
      const date = todayStr();
      const [logs, goal] = await Promise.all([
        getWaterLogsByDate(date),
        getWaterGoal(),
      ]);
      const todayWaterTotal = logs.reduce((sum, l) => sum + l.amount, 0);
      set({
        waterLogs: logs,
        waterGoal: goal,
        todayWaterTotal,
      });
    } catch {
      // ignore
    }
  },

  addWater: async (ml) => {
    const date = todayStr();
    await addWaterLog({
      date,
      amount: ml,
      timestamp: Date.now(),
    });
    await get().loadWaterData();
  },

  deleteWaterLog: async (id) => {
    await deleteWaterLog(id);
    await get().loadWaterData();
  },

  updateWaterGoal: async (updates) => {
    await updateWaterGoal(updates);
    set((state) => ({
      waterGoal: { ...state.waterGoal, ...updates },
    }));
  },

  // ─── Sleep (legacy) ────────────────────────────────────────

  loadSleepRecords: async (limit = 30) => {
    set({ loading: true });
    try {
      const records = await db.sleepRecords
        .orderBy('timestamp')
        .reverse()
        .limit(limit)
        .toArray();
      set({ sleepRecords: records, loading: false });
    } catch {
      set({ loading: false });
    }
  },

  addSleep: async (record) => {
    await addSleepRecord({ ...record, isPersonalBest: false });
    await get().loadSleepRecords();
  },

  deleteSleep: async (id) => {
    await deleteSleepRecord(id);
    await get().loadSleepRecords();
  },

  // ─── Sleep V2 ──────────────────────────────────────────────

  loadSleepData: async () => {
    try {
      const date = todayStr();
      const [todayLog, goal, recentLogs] = await Promise.all([
        getSleepLogByDate(date),
        getSleepGoalV2(),
        getSleepLogs(7),
      ]);
      set({
        todaySleepLog: todayLog ?? null,
        sleepGoalV2: goal,
        sleepLogs: recentLogs,
      });
    } catch {
      // ignore
    }
  },

  saveSleepLog: async (record) => {
    if (record.id) {
      const { id, ...updates } = record;
      await updateSleepLog(id, updates);
    } else {
      const { id: _, ...newRecord } = record;
      await addSleepLog(newRecord);
    }
    await get().loadSleepData();
  },

  updateSleepGoalV2: async (updates) => {
    await updateSleepGoalV2DB(updates);
    set((state) => ({
      sleepGoalV2: { ...state.sleepGoalV2, ...updates },
    }));
  },

  getConsecutiveDays: () => {
    const { sleepLogs } = get();
    if (sleepLogs.length === 0) return 0;

    // Sort by date descending
    const sorted = [...sleepLogs].sort((a, b) => b.date.localeCompare(a.date));
    const today = todayStr();

    // Check if today's log exists and is on time
    let consecutive = 0;
    const startDate = new Date(today);

    for (let i = 0; i < sorted.length; i++) {
      const expected = new Date(startDate);
      expected.setDate(expected.getDate() - i);
      const expectedDate = expected.toISOString().slice(0, 10);
      const log = sorted.find((l) => l.date === expectedDate);
      if (log && log.isOnTime) {
        consecutive++;
      } else {
        break;
      }
    }
    return consecutive;
  },

  // ─── Fitness ──────────────────────────────────────────────

  loadFitnessRecords: async (limit = 30) => {
    set({ loading: true });
    try {
      const records = await db.workouts
        .orderBy('startTime')
        .reverse()
        .limit(limit)
        .toArray();
      set({ fitnessRecords: records, loading: false });
    } catch {
      set({ loading: false });
    }
  },

  addFitness: async (record) => {
    await addWorkoutRecord(record);
    await get().loadFitnessRecords();
  },

  deleteFitness: async (id) => {
    await deleteWorkoutRecord(id);
    await get().loadFitnessRecords();
  },

  loadExercises: async () => {
    try {
      const exercises = await getAllExercises();
      set({ exercises });
    } catch {
      // ignore
    }
  },

  loadMuscleGroups: async () => {
    try {
      const muscleGroups = await getAllMuscleGroups();
      set({ muscleGroups });
    } catch {
      // ignore
    }
  },

  // ─── Fitness V2 ──────────────────────────────────────────

  loadFitnessDataV2: async () => {
    try {
      const [mg, ex, sessions] = await Promise.all([
        getMuscleGroupsV2(),
        getExercisesV2(),
        getWorkoutSessions(30),
      ]);

      // Calculate weekly stats (Mon-Sun)
      const now = new Date();
      const dayOfWeek = now.getDay(); // 0=Sun, 1=Mon...
      const monday = new Date(now);
      monday.setDate(now.getDate() - ((dayOfWeek + 6) % 7));
      monday.setHours(0, 0, 0, 0);
      const sunday = new Date(monday);
      sunday.setDate(monday.getDate() + 6);
      sunday.setHours(23, 59, 59, 999);

      const weekSessions = sessions.filter((s) => {
        const d = new Date(s.date);
        return d >= monday && d <= sunday;
      });

      const uniqueDates = new Set(weekSessions.map((s) => s.date));
      const uniqueMuscles = new Set<string>();
      let prs = 0;
      let totalVolume = 0;

      for (const s of weekSessions) {
        for (const ex of s.exercises) {
          uniqueMuscles.add(ex.exerciseName);
          for (const set of ex.sets) {
            if (set.isPR) prs++;
            totalVolume += set.reps * set.weight;
          }
        }
      }

      set({
        muscleGroupsV2: mg,
        exercisesV2: ex,
        workoutSessions: sessions,
        weeklyStats: {
          sessions: uniqueDates.size,
          muscles: uniqueMuscles.size,
          prs,
          totalVolume,
        },
      });
    } catch {
      // ignore
    }
  },

  addWorkoutSessionV2: async (session) => {
    await addWorkoutSession(session);
    await get().loadFitnessDataV2();
  },

  deleteWorkoutSessionV2: async (id) => {
    await deleteWorkoutSession(id);
    await get().loadFitnessDataV2();
  },

  // ─── Load All ─────────────────────────────────────────────

  loadAll: async () => {
    set({ loading: true });
    try {
      const date = todayStr();
      const [logs, goal, sleepRecords, fitnessRecords, exercises, muscleGroups, todayLog, sleepGoal, recentLogs] =
        await Promise.all([
          getWaterLogsByDate(date),
          getWaterGoal(),
          db.sleepRecords.orderBy('timestamp').reverse().limit(30).toArray(),
          db.workouts.orderBy('startTime').reverse().limit(30).toArray(),
          getAllExercises(),
          getAllMuscleGroups(),
          getSleepLogByDate(date),
          getSleepGoalV2(),
          getSleepLogs(7),
        ]);
      const todayWaterTotal = logs.reduce((sum, l) => sum + l.amount, 0);
      set({
        waterLogs: logs,
        waterGoal: goal,
        todayWaterTotal,
        sleepRecords,
        fitnessRecords,
        exercises,
        muscleGroups,
        todaySleepLog: todayLog ?? null,
        sleepGoalV2: sleepGoal,
        sleepLogs: recentLogs,
        loading: false,
      });
    } catch {
      set({ loading: false });
    }
  },
}));
