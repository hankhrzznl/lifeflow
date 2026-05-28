/** @deprecated Use Task interface instead (v2.1 unified model) */
export interface CaptureItem {
  id?: number;
  content: string;
  status: "inbox" | "planned" | "trash";
  tags: string[];
  createdAt: number;
  updatedAt: number;
}

/** @deprecated Use Task interface instead (v2.1 unified model) */
export interface CalendarEvent {
  id?: number;
  title: string;
  startTime: number;
  endTime: number;
  planned: boolean;
  projectId?: string;
  tags: string[];
  captureSourceId?: number;
  focusSessions: number[];
  notes?: string;
  createdAt: number;
  updatedAt: number;
  deleted?: boolean;
  deletedAt?: number;
}

export interface FocusLog {
  id?: number;
  eventId: number;
  startTime: number;
  duration: number;
  interruptions: number;
  completed: boolean;
  quality?: "perfect" | "great" | "good" | "interrupted";
  createdAt: number;
}

/** @deprecated Use ProjectV2 interface instead (v2.2) */
export interface LegacyProject {
  id: string;
  name: string;
  color: string;
}

export interface AgentMemory {
  id?: number;
  dateKey: string;
  summary: string;
}

export interface AgentChatMessage {
  role: "user" | "assistant" | "system";
  content: string;
  timestamp: number;
  toolCall?: string;
  isError?: boolean;
}

export interface AgentChatSession {
  id: string;
  messages: AgentChatMessage[];
  createdAt: number;
  updatedAt: number;
}

export interface StorageInfo {
  used: number;
  total: number;
  percentUsed: number;
  remaining: number;
  isWarning: boolean;
  isCritical: boolean;
}

export interface Suggestion {
  captureId: number;
  title: string;
  startTime: number;
  endTime: number;
  tags: string[];
  confidence: number;
}

export interface Task {
  id?: number;
  title: string;
  type: 'longterm' | 'shortterm' | 'daily' | 'habit';
  classification?: 'long-term' | 'short-term' | 'daily-trivial' | 'habit';
  parentTaskId?: number;
  isMilestone?: boolean;
  note?: string;
  status: 'active' | 'done' | 'archived';
  planned?: boolean;
  startTime?: number;
  endTime?: number;
  projectId?: string;
  sectionId?: number;
  boardId?: number;
  dueDate?: number;
  requiredSegments?: number;
  segmentReminderDays?: number;
  reminderStage?: 'none' | 'planning' | 'midpoint' | 'final';
  lastReminderAt?: number;
  successCriteria?: string;
  frequency?: 'daily' | 'weekly' | 'monthly';
  captureSourceId?: number;
  focusSessions?: number[];
  tags?: string[];
  priority?: 'urgent-important' | 'not-urgent-important' | 'urgent-not-important' | 'not-urgent-not-important';
  createdAt: number;
  updatedAt: number;
  order?: number;
}

export interface HabitLog {
  id?: number;
  taskId: number;
  date: string;
  count: number;
  note?: string;
  rating?: number;
  createdAt: number;
}

export interface Reminder {
  id?: number;
  taskId: number;
  type: 'deadline' | 'habit' | 'event' | 'custom';
  triggerTime: number;
  message: string;
  status: 'pending' | 'dismissed' | 'completed' | 'snoozed';
  snoozeUntil?: number;
  createdAt: number;
  updatedAt: number;
}

export interface ReminderLog {
  id?: number;
  reminderId: number;
  action: 'shown' | 'dismissed' | 'completed' | 'snoozed';
  timestamp: number;
}

export interface PluginRegistry {
  id: string;
  name: string;
  version: string;
  description?: string;
  status: 'installed' | 'active' | 'disabled' | 'error';
  config?: Record<string, unknown>;
  installedAt: number;
  updatedAt: number;
}

export interface ProjectV2 {
  id?: number;
  name: string;
  color?: string;
  createdAt: number;
}

export interface Board {
  id?: number;
  name: string;
  projectId?: number;
  stages?: BoardStage[];
  createdAt: number;
}

export interface BoardStage {
  name: string;
  achievements: string[];
}

export interface Section {
  id?: number;
  name: string;
  boardId?: number;
  stageIndex?: number;
  createdAt: number;
  note?: string;
  successCriteria?: string;
  priority?: Priority;
  startTime?: number;
  tags?: string[];
}

export interface TrashItem {
  id?: number;
  originalTable: 'capture' | 'tasks' | 'projects' | 'boards' | 'sections';
  originalId: number;
  data: Record<string, unknown>;
  deletedAt: number;
}

export interface PluginMetadata {
  id?: number;
  name: string;
  version: string;
  description?: string;
  status: 'installed' | 'active' | 'disabled' | 'error';
  isBuiltIn?: boolean;
  code?: string;
  installedAt: number;
  updatedAt: number;
  showInNavbar?: boolean;
}

export type GoalViewType = 'long-term' | 'short-term' | 'daily-trivial' | 'habits';

export type GoalTab = 'long-term' | 'short-term' | 'daily-trivial' | 'habits';

export type Priority = 'urgent-important' | 'not-urgent-important' | 'urgent-not-important' | 'not-urgent-not-important';

export const PRIORITY_CONFIG: { key: Priority; label: string; color: string; bg: string; hex: string }[] = [
  { key: 'urgent-important', label: '重要且紧急', color: 'text-red-600', bg: 'bg-red-100', hex: '#EF4444' },
  { key: 'not-urgent-important', label: '重要不紧急', color: 'text-blue-600', bg: 'bg-blue-100', hex: '#3B82F6' },
  { key: 'urgent-not-important', label: '不重要但紧急', color: 'text-amber-600', bg: 'bg-amber-100', hex: '#F59E0B' },
  { key: 'not-urgent-not-important', label: '不重要不紧急', color: 'text-gray-500', bg: 'bg-gray-100', hex: '#6B7280' },
];

export interface TimeSegment {
  id?: number;
  taskId: number;
  startTime: number;
  endTime: number;
  createdAt: number;
}

export interface FinRecord {
  id?: number;
  type: 'income' | 'expense';
  amount: number;
  category: string;
  date: string;
  note?: string;
  accountId: number;
  createdAt: number;
}

export interface FinAccount {
  id?: number;
  name: string;
  initialBalance: number;
  createdAt: number;
}

export type HealthMetricType =
  | 'water_intake'
  | 'sleep_duration'
  | 'sleep_quality'
  | 'heart_rate'
  | 'blood_pressure_systolic'
  | 'blood_pressure_diastolic'
  | 'weight'
  | 'height'
  | 'bmi'
  | 'steps'
  | 'distance'
  | 'flights_climbed'
  | 'active_energy'
  | 'basal_energy'
  | 'standing_time'
  | 'exercise_duration'
  | 'mood'
  | 'stress_level'
  | 'mindful_minutes'
  | 'oxygen_saturation'
  | 'respiratory_rate'
  | 'body_temperature';

export interface HealthRecord {
  id?: number;
  metricType: HealthMetricType;
  value: number;
  unit: string;
  date: string;
  timestamp: number;
  note?: string;
  source: 'manual' | 'imported' | 'device';
  createdAt: number;
}

export interface HealthDailySummary {
  date: string;
  waterIntake?: number;
  sleepDuration?: number;
  sleepQuality?: number;
  heartRate?: number;
  steps?: number;
  activeEnergy?: number;
  mood?: number;
  stressLevel?: number;
}

export interface HealthWeeklySummary {
  weekStart: string;
  avgWaterIntake: number;
  avgSleepDuration: number;
  avgSleepQuality: number;
  avgHeartRate: number;
  totalSteps: number;
  avgMood: number;
}

export const HEALTH_METRIC_CONFIG: Record<HealthMetricType, { label: string; unit: string; icon: string; color: string; bgColor: string }> = {
  water_intake: { label: '饮水量', unit: 'ml', icon: '💧', color: '#3B82F6', bgColor: 'bg-blue-100' },
  sleep_duration: { label: '睡眠时长', unit: '小时', icon: '😴', color: '#8B5CF6', bgColor: 'bg-purple-100' },
  sleep_quality: { label: '睡眠质量', unit: '分', icon: '⭐', color: '#F59E0B', bgColor: 'bg-amber-100' },
  heart_rate: { label: '心率', unit: 'bpm', icon: '❤️', color: '#EF4444', bgColor: 'bg-red-100' },
  blood_pressure_systolic: { label: '收缩压', unit: 'mmHg', icon: '🩺', color: '#EC4899', bgColor: 'bg-pink-100' },
  blood_pressure_diastolic: { label: '舒张压', unit: 'mmHg', icon: '🩺', color: '#EC4899', bgColor: 'bg-pink-100' },
  weight: { label: '体重', unit: 'kg', icon: '⚖️', color: '#10B981', bgColor: 'bg-emerald-100' },
  height: { label: '身高', unit: 'cm', icon: '📏', color: '#06B6D4', bgColor: 'bg-cyan-100' },
  bmi: { label: 'BMI', unit: '', icon: '📊', color: '#84CC16', bgColor: 'bg-lime-100' },
  steps: { label: '步数', unit: '步', icon: '👣', color: '#F97316', bgColor: 'bg-orange-100' },
  distance: { label: '距离', unit: 'km', icon: '🚶', color: '#6366F1', bgColor: 'bg-indigo-100' },
  flights_climbed: { label: '爬楼', unit: '层', icon: '🏢', color: '#14B8A6', bgColor: 'bg-teal-100' },
  active_energy: { label: '活动能量', unit: 'kcal', icon: '⚡', color: '#FBBF24', bgColor: 'bg-yellow-100' },
  basal_energy: { label: '基础能量', unit: 'kcal', icon: '🔥', color: '#FB923C', bgColor: 'bg-orange-100' },
  standing_time: { label: '站立时间', unit: '分钟', icon: '🦵', color: '#0EA5E9', bgColor: 'bg-sky-100' },
  exercise_duration: { label: '运动时长', unit: '分钟', icon: '🏃', color: '#22C55E', bgColor: 'bg-green-100' },
  mood: { label: '心情', unit: '分', icon: '😊', color: '#A855F7', bgColor: 'bg-violet-100' },
  stress_level: { label: '压力', unit: '分', icon: '😰', color: '#DC2626', bgColor: 'bg-red-100' },
  mindful_minutes: { label: '正念时间', unit: '分钟', icon: '🧘', color: '#6EE7B7', bgColor: 'bg-emerald-100' },
  oxygen_saturation: { label: '血氧', unit: '%', icon: '💨', color: '#34D399', bgColor: 'bg-emerald-100' },
  respiratory_rate: { label: '呼吸频率', unit: '次/分', icon: '🌬️', color: '#60A5FA', bgColor: 'bg-blue-100' },
  body_temperature: { label: '体温', unit: '°C', icon: '🌡️', color: '#F87171', bgColor: 'bg-red-100' },
};

export const FIN_CATEGORIES = {
  expense: [
    { key: 'food', label: '餐饮', icon: '🍽️', color: '#FF6B6B', bg: '#FFF0F0' },
    { key: 'transport', label: '交通', icon: '🚗', color: '#4ECDC4', bg: '#F0FFFE' },
    { key: 'shopping', label: '购物', icon: '🛍️', color: '#FFD93D', bg: '#FFFDE8' },
    { key: 'entertainment', label: '娱乐', icon: '🎮', color: '#A78BFA', bg: '#F3EFFF' },
    { key: 'housing', label: '住房', icon: '🏠', color: '#60A5FA', bg: '#EFF6FF' },
    { key: 'medical', label: '医疗', icon: '💊', color: '#FB7185', bg: '#FFF0F3' },
    { key: 'education', label: '学习', icon: '📚', color: '#818CF8', bg: '#EEF0FF' },
    { key: 'communication', label: '通讯', icon: '📱', color: '#34D399', bg: '#ECFDF5' },
    { key: 'daily', label: '日用', icon: '🧴', color: '#FBBF24', bg: '#FFFBE6' },
    { key: 'social', label: '社交', icon: '🎉', color: '#F472B6', bg: '#FFF0F7' },
    { key: 'pet', label: '宠物', icon: '🐾', color: '#C084FC', bg: '#FAF5FF' },
    { key: 'other', label: '其他', icon: '📋', color: '#9CA3AF', bg: '#F3F4F6' },
  ],
  income: [
    { key: 'salary', label: '薪资', icon: '💰', color: '#10B981', bg: '#ECFDF5' },
    { key: 'parttime', label: '兼职', icon: '💼', color: '#6366F1', bg: '#EEF2FF' },
    { key: 'investment', label: '投资', icon: '📈', color: '#F59E0B', bg: '#FFFBEB' },
    { key: 'gift', label: '礼金', icon: '🎁', color: '#EC4899', bg: '#FDF2F8' },
    { key: 'refund', label: '退款', icon: '↩️', color: '#14B8A6', bg: '#F0FDFA' },
    { key: 'other_income', label: '其他', icon: '📋', color: '#9CA3AF', bg: '#F3F4F6' },
  ],
};

export interface ReviewRecord {
  id?: number;
  type: 'daily' | 'weekly' | 'monthly';
  dateKey: string;
  summary?: string;
  stats: {
    tasksDone: number;
    tasksPending: number;
    tasksOverdue: number;
    habitStreaks: number;
    focusMinutes: number;
    financeIncome: number;
    financeExpense: number;
  };
  createdAt: number;
}
