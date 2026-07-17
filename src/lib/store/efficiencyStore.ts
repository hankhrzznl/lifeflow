import { create } from 'zustand';
import type { Goal, ScheduleTask } from '../db/efficiency.db';
import * as db from '../db/efficiency.db';
import { plannerBrain, type StrategyResult } from '../brains/planner';
import { schedulerBrain } from '../brains/scheduler';

interface EfficiencyState {
  goals: Goal[];
  loading: boolean;
  scheduleTasks: ScheduleTask[];
  selectedDate: string;  // YYYY-MM-DD
  breakdownPreview: { goalId: string; tasks: Omit<ScheduleTask, 'id' | 'createdAt'>[] } | null;

  loadGoals: () => Promise<void>;
  addGoal: (data: Omit<Goal, 'id' | 'createdAt' | 'progress'>) => Promise<string>;
  addGoalWithBreakdown: (data: Omit<Goal, 'id' | 'createdAt' | 'progress'>) => Promise<{ goalId: string; tasks: Omit<ScheduleTask, 'id' | 'createdAt'>[] }>;
  confirmBreakdown: (goalId: string, tasks: Omit<ScheduleTask, 'id' | 'createdAt'>[]) => Promise<void>;
  updateGoalStatus: (id: string, status: Goal['status']) => Promise<void>;
  deleteGoal: (id: string) => Promise<void>;
  refreshProgress: (goalId: string) => Promise<void>;

  loadScheduleTasks: (date: string) => Promise<void>;
  addScheduleTask: (data: Omit<ScheduleTask, 'id' | 'createdAt'>) => Promise<string>;
  toggleScheduleTask: (id: string) => Promise<void>;
  updateScheduleTask: (id: string, updates: Partial<ScheduleTask>) => Promise<void>;
  removeScheduleTask: (id: string) => Promise<void>;
  setSelectedDate: (date: string) => void;
}

export const useEfficiencyStore = create<EfficiencyState>()((set, get) => ({
  goals: [],
  loading: false,
  scheduleTasks: [],
  selectedDate: new Date().toISOString().slice(0, 10),
  breakdownPreview: null,

  loadGoals: async () => {
    set({ loading: true });
    try {
      const goals = await db.getAllGoalsV2();
      set({ goals, loading: false });
    } catch {
      set({ loading: false });
    }
  },

  addGoal: async (data) => {
    const id = await db.addGoal({ ...data, progress: 0 });
    const goals = await db.getAllGoalsV2();
    set({ goals });
    return id;
  },

  addGoalWithBreakdown: async (data) => {
    const id = await db.addGoal({ ...data, progress: 0 });
    const goals = await db.getAllGoalsV2();
    const strategy = plannerBrain.analyze(data.title);
    const tasks = plannerBrain.generateTasks(strategy, id, data.deadline);
    set({ goals, breakdownPreview: { goalId: id, tasks } });
    return { goalId: id, tasks };
  },

  confirmBreakdown: async (goalId, tasks) => {
    for (const task of tasks) {
      await db.addScheduleTask(task);
    }
    const goals = await db.getAllGoalsV2();
    set({ goals, breakdownPreview: null });
  },

  updateGoalStatus: async (id, status) => {
    await db.updateGoal(id, { status });
    const goals = await db.getAllGoalsV2();
    set({ goals });
  },

  deleteGoal: async (id) => {
    const tasks = await db.getTasksByGoalId(id);
    for (const task of tasks) {
      if (task.id !== undefined) {
        await db.deleteTask(task.id);
      }
    }
    await db.deleteGoal(id);
    const goals = await db.getAllGoalsV2();
    set({ goals });
  },

  refreshProgress: async (goalId) => {
    const progress = await db.recalculateGoalProgress(goalId);
    await db.updateGoal(goalId, { progress });
    set((state) => ({
      goals: state.goals.map((g) =>
        g.id === goalId ? { ...g, progress } : g,
      ),
    }));
  },

  loadScheduleTasks: async (date) => {
    const tasks = await db.getScheduleTasksByDate(date);
    const ranked = schedulerBrain.rank(tasks);
    set({ scheduleTasks: ranked, selectedDate: date });
  },

  addScheduleTask: async (data) => {
    const id = await db.addScheduleTask(data);
    const { selectedDate } = get();
    const scheduleTasks = await db.getScheduleTasksByDate(selectedDate);
    set({ scheduleTasks });
    return id;
  },

  toggleScheduleTask: async (id) => {
    const task = (await db.getAllScheduleTasks()).find(t => t.id === id);
    if (task) {
      await db.updateScheduleTask(id, { isCompleted: !task.isCompleted });
    }
    const { selectedDate } = get();
    const scheduleTasks = await db.getScheduleTasksByDate(selectedDate);
    set({ scheduleTasks });
  },

  updateScheduleTask: async (id, updates) => {
    await db.updateScheduleTask(id, updates);
    const { selectedDate } = get();
    const scheduleTasks = await db.getScheduleTasksByDate(selectedDate);
    set({ scheduleTasks });
  },

  removeScheduleTask: async (id) => {
    await db.deleteScheduleTask(id);
    const { selectedDate } = get();
    const scheduleTasks = await db.getScheduleTasksByDate(selectedDate);
    set({ scheduleTasks });
  },

  setSelectedDate: (date) => {
    set({ selectedDate: date });
  },
}));
