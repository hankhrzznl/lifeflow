import Dexie, { type Table } from 'dexie';

// ─── Types ───────────────────────────────────────────────────

export interface Habit {
  id: string;            // uuid
  name: string;
  icon: string;          // lucide icon name, e.g. "Sunrise"
  color: string;         // "#F59E0B"
  days: Record<string, boolean>;  // date "YYYY-MM-DD" → completed
  streak: number;
  createdAt: number;
}

export interface Countdown {
  id: string;            // uuid
  name: string;
  date: string;          // YYYY-MM-DD
  icon: string;          // lucide icon name
  type: 'annual' | 'once';
  createdAt: number;
}

export interface Note {
  id: string;            // uuid
  title: string;
  content: string;
  date: string;          // YYYY-MM-DD
  createdAt: number;
  updatedAt: number;
}

export interface FocusSession {
  id: string;            // uuid
  date: string;          // YYYY-MM-DD
  duration: number;      // 分钟
  type: 'focus' | 'break';
  completed: boolean;
  startedAt: number;     // timestamp ms
  endedAt?: number;
}

export interface DietLog {
  id?: number;
  name: string;
  mealType: 'breakfast' | 'lunch' | 'dinner' | 'snack';
  date: string;          // YYYY-MM-DD
  createdAt: number;
}

export interface WellnessLog {
  id?: number;
  name: string;
  type: 'gongfa' | 'tigang';
  duration?: number;     // 分钟，功法可选时长
  date: string;          // YYYY-MM-DD
  createdAt: number;
}

export interface CheatDay {
  id?: number;
  date: string;          // YYYY-MM-DD
  createdAt: number;
}

// ─── Database ────────────────────────────────────────────────

export class LifeDB extends Dexie {
  habits!: Table<Habit, string>;
  countdowns!: Table<Countdown, string>;
  notes!: Table<Note, string>;
  focusSessions!: Table<FocusSession, string>;
  dietLogs!: Table<DietLog, number>;
  wellnessLogs!: Table<WellnessLog, number>;
  cheatDays!: Table<CheatDay, number>;

  constructor() {
    super('LifeFlowLife');
    this.version(1).stores({
      habits: '&id, name',
      countdowns: '&id, name',
      notes: '&id, date',
      focusSessions: '&id, date',
    });
    this.version(2).stores({
      habits: '&id, name',
      countdowns: '&id, name, date',
      notes: '&id, date',
      focusSessions: '&id, date',
    });
    this.version(3).stores({
      habits: '&id, name, createdAt',
      countdowns: '&id, name, date, createdAt',
      notes: '&id, date, createdAt',
      focusSessions: '&id, date, startedAt',
    });
    this.version(4).stores({
      habits: '&id, name, createdAt',
      countdowns: '&id, name, date, createdAt',
      notes: '&id, date, createdAt',
      focusSessions: '&id, date, startedAt',
      dietLogs: '++id, date, mealType',
      wellnessLogs: '++id, date, type',
    });
    this.version(5).stores({
      habits: '&id, name, createdAt',
      countdowns: '&id, name, date, createdAt',
      notes: '&id, date, createdAt',
      focusSessions: '&id, date, startedAt',
      dietLogs: '++id, date, mealType',
      wellnessLogs: '++id, date, type',
      cheatDays: '++id, date',
    });
  }
}

export const lifeDB = new LifeDB();

export async function initializeLifeDB(): Promise<{ success: boolean; error?: string }> {
  try {
    await lifeDB.open();
    return { success: true };
  } catch (err) {
    return { success: false, error: (err as Error).message };
  }
}

// ─── Habits CRUD ─────────────────────────────────────────────

export async function addHabit(h: Omit<Habit, 'id' | 'createdAt'>): Promise<string> {
  const id = crypto.randomUUID();
  await lifeDB.habits.add({ ...h, id, createdAt: Date.now() });
  return id;
}

export async function updateHabit(id: string, updates: Partial<Habit>): Promise<void> {
  await lifeDB.habits.update(id, updates);
}

export async function deleteHabit(id: string): Promise<void> {
  await lifeDB.habits.delete(id);
}

export async function getHabits(): Promise<Habit[]> {
  return lifeDB.habits.toArray();
}

export async function toggleHabitDay(id: string, dateStr: string): Promise<void> {
  const habit = await lifeDB.habits.get(id);
  if (!habit) return;
  const days = { ...habit.days };
  if (days[dateStr]) {
    delete days[dateStr];
  } else {
    days[dateStr] = true;
  }
  // 计算连续打卡天数
  let streak = 0;
  const today = new Date();
  for (let i = 0; i < 365; i++) {
    const d = new Date(today);
    d.setDate(d.getDate() - i);
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
    if (days[key]) streak++;
    else break;
  }
  await lifeDB.habits.update(id, { days, streak });
}

// ─── Countdowns CRUD ─────────────────────────────────────────

export async function addCountdown(c: Omit<Countdown, 'id' | 'createdAt'>): Promise<string> {
  const id = crypto.randomUUID();
  await lifeDB.countdowns.add({ ...c, id, createdAt: Date.now() });
  return id;
}

export async function updateCountdown(id: string, updates: Partial<Countdown>): Promise<void> {
  await lifeDB.countdowns.update(id, updates);
}

export async function deleteCountdown(id: string): Promise<void> {
  await lifeDB.countdowns.delete(id);
}

export async function getCountdowns(): Promise<Countdown[]> {
  return lifeDB.countdowns.orderBy('date').toArray();
}

// ─── Notes CRUD ──────────────────────────────────────────────

export async function addNote(n: Omit<Note, 'id' | 'createdAt' | 'updatedAt'>): Promise<string> {
  const id = crypto.randomUUID();
  const now = Date.now();
  await lifeDB.notes.add({ ...n, id, createdAt: now, updatedAt: now });
  return id;
}

export async function updateNote(id: string, updates: Partial<Note>): Promise<void> {
  await lifeDB.notes.update(id, { ...updates, updatedAt: Date.now() });
}

export async function deleteNote(id: string): Promise<void> {
  await lifeDB.notes.delete(id);
}

export async function getNotes(): Promise<Note[]> {
  return lifeDB.notes.orderBy('createdAt').reverse().toArray();
}

// ─── Focus Sessions CRUD ─────────────────────────────────────

export async function addFocusSession(s: Omit<FocusSession, 'id'>): Promise<string> {
  const id = crypto.randomUUID();
  await lifeDB.focusSessions.add({ ...s, id });
  return id;
}

export async function getTodayFocusSessions(date: string): Promise<FocusSession[]> {
  return lifeDB.focusSessions.where('date').equals(date).toArray();
}

export async function getRecentFocusSessions(days: number = 7): Promise<FocusSession[]> {
  const dates: string[] = [];
  for (let i = 0; i < days; i++) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    dates.push(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`);
  }
  return lifeDB.focusSessions.where('date').anyOf(dates).toArray();
}

export async function getTotalFocusMinutes(date: string): Promise<number> {
  const sessions = await lifeDB.focusSessions
    .where('date').equals(date)
    .filter(s => s.type === 'focus' && s.completed)
    .toArray();
  return sessions.reduce((sum, s) => sum + s.duration, 0);
}

// ─── Diet Logs CRUD ───────────────────────────────────────────

export async function addDietLog(log: Omit<DietLog, 'id' | 'createdAt'>): Promise<number> {
  return lifeDB.dietLogs.add({ ...log, createdAt: Date.now() });
}

export async function deleteDietLog(id: number): Promise<void> {
  await lifeDB.dietLogs.delete(id);
}

export async function getDietLogsByDate(date: string): Promise<DietLog[]> {
  return lifeDB.dietLogs.where('date').equals(date).toArray();
}

export async function getDietLogsByDateRange(startDate: string, endDate: string): Promise<DietLog[]> {
  return lifeDB.dietLogs
    .where('date')
    .between(startDate, endDate, true, true)
    .toArray();
}

// ─── Cheat Days CRUD ──────────────────────────────────────────

export async function addCheatDay(date: string): Promise<number> {
  const existing = await lifeDB.cheatDays.where('date').equals(date).first();
  if (existing) return existing.id!;
  return lifeDB.cheatDays.add({ date, createdAt: Date.now() });
}

export async function removeCheatDay(date: string): Promise<void> {
  await lifeDB.cheatDays.where('date').equals(date).delete();
}

export async function isCheatDay(date: string): Promise<boolean> {
  const record = await lifeDB.cheatDays.where('date').equals(date).first();
  return !!record;
}

export async function getCheatDaysInRange(startDate: string, endDate: string): Promise<CheatDay[]> {
  return lifeDB.cheatDays
    .where('date')
    .between(startDate, endDate, true, true)
    .toArray();
}

// ─── Wellness Logs CRUD ───────────────────────────────────────

export async function addWellnessLog(log: Omit<WellnessLog, 'id' | 'createdAt'>): Promise<number> {
  return lifeDB.wellnessLogs.add({ ...log, createdAt: Date.now() });
}

export async function deleteWellnessLog(id: number): Promise<void> {
  await lifeDB.wellnessLogs.delete(id);
}

export async function getWellnessLogsByDate(date: string): Promise<WellnessLog[]> {
  return lifeDB.wellnessLogs.where('date').equals(date).toArray();
}

export async function getWellnessLogsByDateRange(startDate: string, endDate: string): Promise<WellnessLog[]> {
  return lifeDB.wellnessLogs
    .where('date')
    .between(startDate, endDate, true, true)
    .toArray();
}
