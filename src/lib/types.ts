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
  submoduleId?: number;
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
  isFocus?: boolean;
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
  | 'body_temperature'
  | 'blood_glucose';

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
  blood_glucose: { label: '血糖', unit: 'mg/dL', icon: '💉', color: '#E879F9', bgColor: 'bg-fuchsia-100' },
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

export interface WorkoutRecord {
  id?: number;
  type: string;
  duration: number;
  calories: number;
  heartRateAvg?: number;
  heartRateMax?: number;
  startTime: number;
  endTime: number;
  date: string;
  source: 'manual' | 'imported' | 'device';
  createdAt: number;
  
  // 跑步专属字段
  distance?: number;
  pace?: number;
  elevationGain?: number;
  
  // 力量训练专属字段
  weight?: number;
  reps?: number;
  sets?: number;
  exerciseName?: string;
  
  // 力量训练动作列表（新版）
  planId?: number;
  planDayId?: string;
  exercises?: PlanExercise[];
  
  // 室内爬坡专属字段
  incline?: number;
}

export interface JournalEntry {
  id?: number;
  date: string;
  timestamp: number;
  tags: string[];
  category: 'caffeine' | 'alcohol' | 'exercise' | 'sleep' | 'screen' | 'travel' | 'work' | 'custom';
  note?: string;
  impact?: 'positive' | 'negative' | 'neutral';
  createdAt: number;
}

export interface TrainingPlan {
  id?: number;
  name: string;
  mode: 'AMRAP' | 'EMOM' | 'Interval' | 'Open Gym' | 'For Time';
  duration: number;
  difficulty: 'beginner' | 'intermediate' | 'advanced';
  category: 'HIIT' | 'Hybrid' | 'HYROX' | 'Strength';
  exercises: TrainingExercise[];
  shareCode?: string;
  createdAt: number;
  updatedAt: number;
}

export interface TrainingExercise {
  id?: number;
  planId?: number;
  name: string;
  targetType: 'reps' | 'time' | 'distance';
  targetValue: number;
  sets?: number;
  restTime?: number;
  notes?: string;
  muscleGroup?: string;
  order: number;
}

export interface Exercise {
  id?: number;
  name: string;
  category: string;
  muscleGroups: string[];
  equipment?: string;
  instructions?: string;
  createdAt: number;
}

export interface DailyMetrics {
  id?: number;
  date: string;
  bodyEnergy?: number;
  recovery?: number;
  stress?: number;
  exertion?: number;
  trainingLoad?: number;
  hrv?: number;
  restingHeartRate?: number;
  sleepScore?: number;
  createdAt: number;
  updatedAt: number;
}

export interface PlanExercise {
  id: string;
  name: string;
  sets: number;
  reps: number;
  restTime: number;
  weight?: number;
  description?: string;
}

export interface PlanTrainingDay {
  id: string;
  name: string;
  description?: string;
  duration: number;
  exercises: PlanExercise[];
}

export interface CustomTrainingPlan {
  id?: number;
  name: string;
  type: 'muscle_building' | 'fat_loss' | 'cardio';
  goal: string;
  weeklyFrequency: number;
  sessionDuration: number;
  focusAreas: string[];
  cycleWeeks: number;
  hasDeloadWeek: boolean;
  deloadWeekFrequency?: number;
  trainingDays: PlanTrainingDay[];
  notes?: string;
  createdAt: number;
  updatedAt: number;
}

export const WORKOUT_TYPES = [
  { key: 'running_outdoor', label: '户外跑步', icon: '🏃', category: '跑步' },
  { key: 'running_indoor', label: '室内跑步', icon: '🏃', category: '跑步' },
  { key: 'cycling_outdoor', label: '户外骑行', icon: '🚴', category: '骑行' },
  { key: 'cycling_indoor', label: '室内骑行', icon: '🚴', category: '骑行' },
  { key: 'swimming_pool', label: '泳池游泳', icon: '🏊', category: '游泳' },
  { key: 'swimming_open', label: '开放水域游泳', icon: '🏊', category: '游泳' },
  { key: 'strength', label: '力量训练', icon: '💪', category: '力量' },
  { key: 'hiit', label: 'HIIT', icon: '⚡', category: 'HIIT' },
  { key: 'yoga', label: '瑜伽', icon: '🧘', category: '其他' },
  { key: 'elliptical', label: '椭圆机', icon: '🕹️', category: '其他' },
  { key: 'rowing', label: '划船', icon: '🚣', category: '其他' },
  { key: 'boxing', label: '格斗训练', icon: '🥊', category: '其他' },
  { key: 'basketball', label: '篮球', icon: '🏀', category: '球类' },
  { key: 'tennis', label: '网球', icon: '🎾', category: '球类' },
  { key: 'hiking_indoor', label: '室内爬坡', icon: '⛰️', category: '其他' },
  { key: 'other', label: '其他', icon: '🏋️', category: '其他' },
];

export const JOURNAL_TAGS = {
  caffeine: [
    { key: 'coffee', label: '咖啡', icon: '☕' },
    { key: 'tea', label: '茶', icon: '🍵' },
    { key: 'energy_drink', label: '能量饮料', icon: '⚡' },
  ],
  alcohol: [
    { key: 'beer', label: '啤酒', icon: '🍺' },
    { key: 'wine', label: '红酒', icon: '🍷' },
    { key: 'cocktail', label: '鸡尾酒', icon: '🍸' },
  ],
  exercise: [
    { key: 'workout', label: '锻炼', icon: '💪' },
    { key: 'walk', label: '散步', icon: '🚶' },
    { key: 'standing', label: '久站', icon: '🧍' },
  ],
  sleep: [
    { key: 'late_night', label: '晚睡', icon: '🌙' },
    { key: 'nap', label: '午睡', icon: '😴' },
    { key: 'irregular', label: '不规律', icon: '⏰' },
  ],
  screen: [
    { key: 'late_screen', label: '深夜屏幕', icon: '📱' },
    { key: 'blue_light', label: '蓝光暴露', icon: '🔵' },
  ],
  travel: [
    { key: 'travel', label: '旅行', icon: '✈️' },
    { key: 'timezone', label: '时差', icon: '🌍' },
  ],
  work: [
    { key: 'meeting', label: '重要会议', icon: '📊' },
    { key: 'deadline', label: '截止日期', icon: '📅' },
    { key: 'stressful', label: '工作压力大', icon: '😰' },
  ],
};

export const TRAINING_CATEGORIES = [
  { key: 'HIIT', label: 'HIIT', icon: '⚡', color: '#FF6B6B' },
  { key: 'Hybrid', label: '混合训练', icon: '🏋️', color: '#4ECDC4' },
  { key: 'HYROX', label: 'HYROX', icon: '🏃', color: '#45B7D1' },
  { key: 'Strength', label: '力量训练', icon: '💪', color: '#96CEB4' },
];

export const TRAINING_MODES = [
  { key: 'AMRAP', label: 'AMRAP', fullName: 'As Many Rounds As Possible', description: '固定时间内尽可能完成多轮', icon: '🔄' },
  { key: 'EMOM', label: 'EMOM', fullName: 'Every Minute On the Minute', description: '每分钟完成规定动作', icon: '⏱️' },
  { key: 'Interval', label: '间歇训练', fullName: 'Interval Training', description: '高强度工作和休息交替', icon: '↔️' },
  { key: 'Open Gym', label: '开放训练', fullName: 'Open Gym', description: '最灵活的自定义训练', icon: '🎯' },
  { key: 'For Time', label: '计时完成', fullName: 'For Time', description: '规定训练量下尽可能快完成', icon: '⏰' },
];

// ==================== 肌肉层级管理系统 ====================

// 大肌群
export interface MuscleGroup {
  id?: number;
  name: string;                          // 大肌群名称
  icon: string;                          // 图标
  color: string;                          // 颜色
  description?: string;                   // 描述
  order: number;                          // 排序
  createdAt: number;
  updatedAt: number;
}

// 小肌肉
export interface SubMuscle {
  id?: number;
  muscleGroupId: number;                  // 所属大肌群ID
  name: string;                           // 小肌肉名称
  description?: string;                   // 描述
  order: number;                          // 排序
  createdAt: number;
  updatedAt: number;
}

// 预设动作库
export interface PresetExercise {
  id?: number;
  name: string;                           // 动作名称
  subMuscleId: number;                     // 所属小肌肉ID
  equipment?: string;                      // 需要的器械
  description?: string;                    // 动作描述
  instructions?: string;                   // 动作说明
  isCustom: boolean;                       // 是否自定义动作
  createdAt: number;
}

// 训练记录
export interface MuscleRecord {
  id?: number;
  subMuscleId: number;                     // 小肌肉ID
  exerciseName: string;                    // 动作名称
  sets: number;                            // 组数
  reps: number;                            // 每组次数
  weight: number;                           // 重量(kg)
  rpe: number;                              // RPE 1-10
  restTime: number;                         // 组间休息(秒)
  feeling: 'easy' | 'medium' | 'hard';     // 训练感受
  date: string;                             // 训练日期
  timestamp: number;
  notes?: string;                          // 备注
  isPersonalBest?: boolean;                 // 是否个人最佳
  createdAt: number;
}

// ==================== 身体数据记录 ====================

export interface BodyMetricRecord {
  id?: number;
  type: 'weight' | 'bodyFat' | 'muscleMass' | 'bloodPressure' | 'vitalCapacity' | 'running1000';
  value: number;
  secondaryValue?: number;                  // 例如血压的舒张压
  date: string;
  timestamp: number;
  notes?: string;
  isPersonalBest?: boolean;
  createdAt: number;
}

// 每日健康记录（手动填写）
export interface DailyHealthRecord {
  id?: number;
  date: string;                              // 日期 (YYYY-MM-DD)
  timestamp: number;                         // 时间戳
  
  // 体重
  weight?: number;                            // 体重 (kg)
  
  // 睡眠
  sleepDuration?: number;                    // 睡眠时长 (小时)
  sleepTime?: string;                        // 入睡时间 (HH:mm)
  sleepScore?: number;                        // 睡眠评分 (0-100)
  
  // 心血管
  restingHeartRate?: number;                 // 静息心率 RHR (bpm)
  bloodOxygen?: number;                    // 血氧 SpO2 (%)
  hrv?: number;                             // 心率变异性 HRV (ms)
  vo2Max?: number;                          // 最大摄氧量 (ml/kg/min)
  bloodPressureSystolic?: number;            // 血压高压 (mmHg)
  bloodPressureDiastolic?: number;            // 血压低压 (mmHg)
  
  // 日照
  sunlightTime?: number;                    // 日照下时间 (分钟)
  
  // 压力
  stressLevel?: number;                       // 压力水平 (0-100)
  
  // 身体年龄
  bodyAge?: number;                          // 身体年龄 (岁)
  
  // 运动
  trainingDuration?: number;                 // 训练时长 (分钟)
  caloriesBurned?: number;                   // 消耗卡路里 (kcal)
  trainingFeeling?: 'easy' | 'medium' | 'hard'; // 训练感受
  
  // 元数据
  notes?: string;
  createdAt: number;
  updatedAt: number;
}

// 睡眠记录
export interface SleepRecord {
  id?: number;
  sleepDuration: number;                   // 睡眠时长(小时)
  sleepTime: string;                        // 睡着时间点 (HH:mm)
  wakeTime: string;                         // 起床时间 (HH:mm)
  sleepQuality: number;                     // 睡眠质量 1-10
  deepSleep?: number;                       // 深睡时长(分钟)
  remSleep?: number;                        // REM睡眠时长(分钟)
  date: string;
  timestamp: number;
  notes?: string;
  isPersonalBest?: boolean;
  createdAt: number;
}

// 营养记录
export interface NutritionRecord {
  id?: number;
  calories: number;                        // 卡路里
  protein: number;                         // 蛋白质(g)
  carbs: number;                           // 碳水(g)
  fat: number;                             // 脂肪(g)
  water: number;                           // 水分(ml)
  caffeine?: number;                       // 咖啡因(mg)
  date: string;
  timestamp: number;
  notes?: string;
  createdAt: number;
}

// 恢复记录
export interface RecoveryRecord {
  id?: number;
  fatigue: number;                         // 主观疲劳度 1-10
  doms: 'none' | 'mild' | 'moderate' | 'severe';  // 延迟性酸痛
  domsAreas?: string[];                    // 酸痛部位
  stress: number;                          // 压力水平 1-10
  recoveryFeeling: number;                  // 恢复感受 1-10
  date: string;
  timestamp: number;
  notes?: string;
  createdAt: number;
}

// 耐力测试记录
export interface EnduranceRecord {
  id?: number;
  type: 'pullup' | 'pushup' | 'plank' | 'sitAndReach';
  value: number;                           // 次数或时长(秒)
  date: string;
  timestamp: number;
  notes?: string;
  isPersonalBest?: boolean;
  createdAt: number;
}

// ==================== 预设数据 ====================

export const DEFAULT_MUSCLE_GROUPS = [
  { name: '胸部', icon: '💪', color: '#EF4444', description: '胸大肌、胸小肌', order: 1 },
  { name: '背部', icon: '🔙', color: '#F97316', description: '背阔肌、斜方肌', order: 2 },
  { name: '腿部', icon: '🦵', color: '#EAB308', description: '股四头肌、腘绳肌', order: 3 },
  { name: '肩部', icon: '🏋️', color: '#22C55E', description: '前束、中束、后束', order: 4 },
  { name: '手臂', icon: '💪', color: '#14B8A6', description: '肱二头肌、肱三头肌', order: 5 },
  { name: '核心', icon: '🎯', color: '#3B82F6', description: '腹直肌、腹斜肌', order: 6 },
];

export const DEFAULT_SUB_MUSCLES: Record<string, string[]> = {
  '胸部': ['上胸', '中胸', '下胸', '内侧胸'],
  '背部': ['背阔肌', '斜方肌', '菱形肌'],
  '腿部': ['股四头肌', '腘绳肌', '小腿肌群'],
  '肩部': ['前束', '中束', '后束'],
  '手臂': ['肱二头肌', '肱三头肌', '前臂'],
  '核心': ['腹直肌', '腹斜肌', '下背部'],
};

export const PRESET_EXERCISES: Array<{ name: string; subMuscle: string; muscleGroup: string; equipment?: string }> = [
  // 胸部
  { name: '杠铃卧推', subMuscle: '中胸', muscleGroup: '胸部', equipment: '杠铃' },
  { name: '哑铃卧推', subMuscle: '中胸', muscleGroup: '胸部', equipment: '哑铃' },
  { name: '双杠臂屈伸', subMuscle: '下胸', muscleGroup: '胸部', equipment: '双杠' },
  { name: '上斜杠铃卧推', subMuscle: '上胸', muscleGroup: '胸部', equipment: '杠铃' },
  { name: '上斜哑铃卧推', subMuscle: '上胸', muscleGroup: '胸部', equipment: '哑铃' },
  { name: '下斜杠铃卧推', subMuscle: '下胸', muscleGroup: '胸部', equipment: '杠铃' },
  { name: '绳索夹胸', subMuscle: '内侧胸', muscleGroup: '胸部', equipment: '龙门架' },
  { name: '蝴蝶机夹胸', subMuscle: '内侧胸', muscleGroup: '胸部', equipment: '蝴蝶机' },
  { name: '俯卧撑', subMuscle: '中胸', muscleGroup: '胸部', equipment: '自重' },
  
  // 背部
  { name: '引体向上', subMuscle: '背阔肌', muscleGroup: '背部', equipment: '单杠' },
  { name: '高位下拉', subMuscle: '背阔肌', muscleGroup: '背部', equipment: '器械' },
  { name: '杠铃划船', subMuscle: '背阔肌', muscleGroup: '背部', equipment: '杠铃' },
  { name: '哑铃划船', subMuscle: '背阔肌', muscleGroup: '背部', equipment: '哑铃' },
  { name: '坐姿划船', subMuscle: '背阔肌', muscleGroup: '背部', equipment: '器械' },
  { name: '哑铃耸肩', subMuscle: '斜方肌', muscleGroup: '背部', equipment: '哑铃' },
  { name: '面拉', subMuscle: '后束', muscleGroup: '肩部', equipment: '龙门架' },
  
  // 腿部
  { name: '深蹲', subMuscle: '股四头肌', muscleGroup: '腿部', equipment: '杠铃' },
  { name: '腿举', subMuscle: '股四头肌', muscleGroup: '腿部', equipment: '器械' },
  { name: '腿伸展', subMuscle: '股四头肌', muscleGroup: '腿部', equipment: '器械' },
  { name: '硬拉', subMuscle: '腘绳肌', muscleGroup: '腿部', equipment: '杠铃' },
  { name: '腿弯举', subMuscle: '腘绳肌', muscleGroup: '腿部', equipment: '器械' },
  { name: '罗马尼亚硬拉', subMuscle: '腘绳肌', muscleGroup: '腿部', equipment: '杠铃' },
  { name: '小腿提踵', subMuscle: '小腿肌群', muscleGroup: '腿部', equipment: '器械' },
  { name: '保加利亚深蹲', subMuscle: '股四头肌', muscleGroup: '腿部', equipment: '哑铃' },
  
  // 肩部
  { name: '哑铃肩推', subMuscle: '前束', muscleGroup: '肩部', equipment: '哑铃' },
  { name: '杠铃肩推', subMuscle: '前束', muscleGroup: '肩部', equipment: '杠铃' },
  { name: '侧平举', subMuscle: '中束', muscleGroup: '肩部', equipment: '哑铃' },
  { name: '前平举', subMuscle: '前束', muscleGroup: '肩部', equipment: '哑铃' },
  { name: '俯身侧平举', subMuscle: '后束', muscleGroup: '肩部', equipment: '哑铃' },
  { name: '阿诺德推举', subMuscle: '前束', muscleGroup: '肩部', equipment: '哑铃' },
  
  // 手臂
  { name: '杠铃弯举', subMuscle: '肱二头肌', muscleGroup: '手臂', equipment: '杠铃' },
  { name: '哑铃弯举', subMuscle: '肱二头肌', muscleGroup: '手臂', equipment: '哑铃' },
  { name: '锤式弯举', subMuscle: '肱二头肌', muscleGroup: '手臂', equipment: '哑铃' },
  { name: '集中弯举', subMuscle: '肱二头肌', muscleGroup: '手臂', equipment: '哑铃' },
  { name: '绳索下压', subMuscle: '肱三头肌', muscleGroup: '手臂', equipment: '龙门架' },
  { name: '哑铃臂屈伸', subMuscle: '肱三头肌', muscleGroup: '手臂', equipment: '哑铃' },
  { name: '双杠臂屈伸', subMuscle: '肱三头肌', muscleGroup: '手臂', equipment: '双杠' },
  { name: '过头臂屈伸', subMuscle: '肱三头肌', muscleGroup: '手臂', equipment: '哑铃' },
  
  // 核心
  { name: '卷腹', subMuscle: '腹直肌', muscleGroup: '核心', equipment: '自重' },
  { name: '平板支撑', subMuscle: '腹直肌', muscleGroup: '核心', equipment: '自重' },
  { name: '俄罗斯转体', subMuscle: '腹斜肌', muscleGroup: '核心', equipment: '自重' },
  { name: '悬垂举腿', subMuscle: '腹直肌', muscleGroup: '核心', equipment: '单杠' },
  { name: '山羊挺身', subMuscle: '下背部', muscleGroup: '核心', equipment: '器械' },
  { name: '死虫式', subMuscle: '腹直肌', muscleGroup: '核心', equipment: '自重' },
];

// RPE等级描述
export const RPE_LABELS: Record<number, string> = {
  1: '非常轻松',
  2: '很轻松',
  3: '轻松',
  4: '较轻松',
  5: '中等',
  6: '稍难',
  7: '较难',
  8: '难',
  9: '很难',
  10: '力竭',
};

// 休息时间预设
export const REST_TIME_PRESETS = [30, 60, 90, 120, 180];

// ==================== 子模块管理系统 ====================

export type ParentModuleKey = 'learning' | 'health' | 'growth';

export interface Submodule {
  id?: number;
  projectId: number;
  name: string;
  description: string;
  enabled: boolean;
  order: number;
  createdAt: number;
  updatedAt: number;
}

/**
 * @deprecated Use Submodule interface directly instead.
 */
export const PRESET_SUBMODULES: Omit<Submodule, 'id' | 'createdAt' | 'updatedAt' | 'projectId'>[] = [];

export const PARENT_MODULE_LABELS: Record<ParentModuleKey, string> = {
  learning: '学习',
  health: '健康',
  growth: '成长',
};

/** @deprecated Icons are now inherited from ProjectV2 */
export const AVAILABLE_ICONS = [
  'GraduationCap', 'BookOpen', 'Moon', 'Sparkles', 'Dumbbell',
  'Target', 'Sprout', 'Repeat', 'Heart', 'Brain', 'Zap',
  'Timer', 'BarChart3', 'Settings', 'Calendar', 'List', 'Layers',
  'Inbox', 'Bell', 'Star', 'Trophy', 'TrendingUp', 'Music',
  'Coffee', 'PenTool', 'Camera', 'Map', 'Globe', 'Cloud',
] as const;

/** @deprecated Gradients are now inherited from ProjectV2 */
export const ICON_GRADIENTS: { label: string; from: string; via: string; to: string }[] = [
  { label: '蓝紫', from: 'from-indigo-400', via: 'via-violet-400', to: 'to-purple-500' },
  { label: '青蓝', from: 'from-sky-400', via: 'via-cyan-400', to: 'to-blue-500' },
  { label: '翠绿', from: 'from-emerald-400', via: 'via-teal-400', to: 'to-cyan-500' },
  { label: '粉紫', from: 'from-rose-400', via: 'via-pink-400', to: 'to-fuchsia-500' },
  { label: '橙红', from: 'from-orange-400', via: 'via-red-400', to: 'to-rose-500' },
  { label: '黄橙', from: 'from-yellow-400', via: 'via-amber-400', to: 'to-orange-500' },
  { label: '绿松', from: 'from-teal-400', via: 'via-green-400', to: 'to-emerald-500' },
  { label: '紫粉', from: 'from-violet-400', via: 'via-purple-400', to: 'to-pink-500' },
];
