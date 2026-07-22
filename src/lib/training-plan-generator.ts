/**
 * 训练计划自动生成器
 * 五大训练内容 → Goal + ScheduleTask 自动编排
 */

import { healthDB, type TrainingPlan, type TrainingType } from "@/lib/db/health.db";
import { efficiencyDB, type Goal, addScheduleTask } from "@/lib/db/efficiency.db";

// ============================================================
// 五大训练内容定义
// ============================================================

export interface TrainingSystemDef {
  type: TrainingType;
  label: string;
  role: 'staple' | 'rotating';
  exercises: string[];
  color: string;
}

export const TRAINING_SYSTEMS: TrainingSystemDef[] = [
  {
    type: "gym_compound", label: "健身房复合力量", role: "staple",
    exercises: ["杠铃卧推", "高位下拉", "高脚杯深蹲", "坐姿肩推", "杠铃硬拉"], color: "#2563EB",
  },
  {
    type: "low_cardio", label: "低强度有氧", role: "staple",
    exercises: ["快走", "游泳", "骑行", "划船机"], color: "#10B981",
  },
  {
    type: "farmer_walk", label: "农夫行走", role: "rotating",
    exercises: ["双手农夫行走", "单手农夫行走", "壶铃农夫行走", "哑铃农夫行走"], color: "#F59E0B",
  },
  {
    type: "weighted_rotation", label: "负重旋转", role: "rotating",
    exercises: ["壶铃旋转", "绳索旋转", "药球转体砸地"], color: "#8B5CF6",
  },
  {
    type: "power_training", label: "爆发力训练", role: "rotating",
    exercises: ["跳箱", "壶铃摆荡", "短冲刺", "药球抛掷"], color: "#EF4444",
  },
];

// ============================================================
// 月度轮换逻辑
// ============================================================

const ROTATING_TYPES: TrainingType[] = ["farmer_walk", "weighted_rotation", "power_training"];

export function getMonthlyRotation(monthOffset: number = 0): {
  primary: TrainingType;
  secondary: TrainingType[];
  monthIndex: number;
} {
  const now = new Date();
  // Month index from July 2026 as start
  const startYear = 2026;
  const startMonth = 7; // July
  const totalMonths = (now.getFullYear() - startYear) * 12 + (now.getMonth() + 1 - startMonth) + monthOffset;
  const idx = ((totalMonths % 3) + 3) % 3;
  const primary = ROTATING_TYPES[idx];
  const secondary = ROTATING_TYPES.filter((_, i) => i !== idx);
  return { primary, secondary, monthIndex: idx };
}

export function getMonthLabel(): string {
  const { primary } = getMonthlyRotation();
  const sys = TRAINING_SYSTEMS.find(s => s.type === primary);
  return sys?.label ?? "农夫行走";
}

// ============================================================
// 计划初始化（一键创建5个TrainingPlan + 对应Goal + 本周ScheduleTask）
// ============================================================

export async function initializeTrainingPlans(): Promise<{ created: number }> {
  const existing = await healthDB.trainingPlans.count();
  if (existing > 0) return { created: 0 };

  const { primary, secondary } = getMonthlyRotation();
  let created = 0;

  for (const sys of TRAINING_SYSTEMS) {
    const plan: Omit<TrainingPlan, 'id'> = getPlanDefaults(sys, primary, secondary);
    const goal = await createGoalForPlan(plan);
    const planId = crypto.randomUUID();
    await healthDB.trainingPlans.add({
      ...plan, id: planId, goalId: goal.id, active: true, createdAt: Date.now(),
    } as TrainingPlan);
    created++;

    // Generate this week's ScheduleTasks
    await generateScheduleTasksForPlan({ ...plan, id: planId, goalId: goal.id, active: true, createdAt: Date.now() } as TrainingPlan, goal);
  }

  return { created };
}

function getPlanDefaults(sys: TrainingSystemDef, primary: TrainingType, secondary: TrainingType[]): Omit<TrainingPlan, 'id'> {
  const isStaple = sys.role === 'staple';

  if (isStaple) {
    if (sys.type === 'gym_compound') {
      return { name: sys.label, trainingType: sys.type, role: 'staple', frequency: 'weekly', weeklyDays: [1, 3, 5], exercises: sys.exercises, active: true, createdAt: Date.now() };
    }
    // low_cardio
    return { name: sys.label, trainingType: sys.type, role: 'staple', frequency: 'weekly', weeklyDays: [2, 4], exercises: sys.exercises, active: true, createdAt: Date.now() };
  }

  // Rotating
  if (sys.type === primary) {
    return { name: sys.label, trainingType: sys.type, role: 'rotating', frequency: 'weekly', weeklyDays: [1, 3, 5], exercises: sys.exercises, active: true, createdAt: Date.now() };
  }
  // Secondary
  return { name: sys.label, trainingType: sys.type, role: 'rotating', frequency: 'weekly', weeklyDays: [6], exercises: sys.exercises, active: true, createdAt: Date.now() };
}

// ============================================================
// Goal 创建
// ============================================================

async function createGoalForPlan(plan: Omit<TrainingPlan, 'id'>): Promise<Goal> {
  const goalId = crypto.randomUUID();
  const today = localDateStr(new Date());
  const isStaple = plan.role === 'staple';
  const isPrimary = plan.frequency === 'weekly' && (plan.weeklyDays?.length ?? 0) > 2;

  const quadrant = isStaple ? 'q2' : isPrimary ? 'q2' : 'q3';

  await efficiencyDB.goals.add({
    id: goalId,
    title: plan.name,
    deadline: getMonthEnd(),
    progress: 0,
    status: 'active',
    goalType: 'count',
    targetCount: isStaple ? 12 : isPrimary ? 12 : 4,
    note: plan.exercises.join('、'),
    color: '#2563EB',
    quadrant,
    createdAt: Date.now(),
  } as Goal);

  return { id: goalId } as Goal;
}

function getMonthEnd(): string {
  const d = new Date();
  d.setMonth(d.getMonth() + 1);
  d.setDate(0);
  return localDateStr(d);
}

// ============================================================
// 生成本周/本月 ScheduleTask
// ============================================================

export async function generateScheduleTasksForPlan(plan: TrainingPlan, goal: Goal): Promise<void> {
  if (!plan.active) return;

  if (plan.frequency === 'weekly' && plan.weeklyDays) {
    const { start, end } = getCurrentWeek();

    for (const dayOfWeek of plan.weeklyDays) {
      const date = getDateFromDayOfWeek(start, dayOfWeek);
      if (date < localDateStr(new Date())) continue; // Skip past days
      if (date > end) continue;

      // Check if already exists
      const existing = await efficiencyDB.scheduleTasks
        .where({ goalId: goal.id })
        .and(t => t.date === date)
        .count();
      if (existing > 0) continue;

      await addScheduleTask({
        title: plan.name,
        type: 'single',
        date,
        goalId: goal.id,
        quadrant: goal.quadrant || 'q2',
        isCompleted: false,
        plannedTime: 60,
        actualTime: 0,
        isImportant: goal.quadrant === 'q1' || goal.quadrant === 'q2',
        note: plan.exercises.join('、'),
        category: 'task',
        sourceModule: 'training',
        sourceLogId: plan.trainingType,
      });
    }
  } else if (plan.frequency === 'monthly' && plan.monthlyDays) {
    for (const day of plan.monthlyDays) {
      const date = getDateFromMonthDay(day);
      if (date < localDateStr(new Date())) continue;

      const existing = await efficiencyDB.scheduleTasks
        .where({ goalId: goal.id })
        .and(t => t.date === date)
        .count();
      if (existing > 0) continue;

      await addScheduleTask({
        title: plan.name,
        type: 'single',
        date,
        goalId: goal.id,
        quadrant: 'q3',
        isCompleted: false,
        plannedTime: 30,
        actualTime: 0,
        isImportant: false,
        note: plan.exercises.join('、'),
        category: 'task',
        sourceModule: 'training',
        sourceLogId: plan.trainingType,
      });
    }
  }
}

// ============================================================
// 日期工具
// ============================================================

function localDateStr(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function getCurrentWeek(): { start: string; end: string } {
  const now = new Date();
  const dow = now.getDay();
  const mon = new Date(now);
  mon.setDate(now.getDate() - (dow === 0 ? 6 : dow - 1));
  mon.setHours(0, 0, 0, 0);
  const sun = new Date(mon);
  sun.setDate(mon.getDate() + 6);
  return { start: localDateStr(mon), end: localDateStr(sun) };
}

function getDateFromDayOfWeek(weekStart: string, targetDow: number): string {
  const [y, m, d] = weekStart.split('-').map(Number);
  const base = new Date(y, m - 1, d);
  const currentDow = base.getDay() || 7; // Sunday=7
  const offset = targetDow - currentDow;
  base.setDate(base.getDate() + offset);
  return localDateStr(base);
}

function getDateFromMonthDay(day: number): string {
  const now = new Date();
  const date = new Date(now.getFullYear(), now.getMonth(), day);
  if (date <= now) {
    date.setMonth(date.getMonth() + 1);
  }
  return localDateStr(date);
}

// ============================================================
// 获取当前所有训练计划
// ============================================================

export async function getActiveTrainingPlans(): Promise<TrainingPlan[]> {
  return healthDB.trainingPlans.filter(p => p.active).toArray();
}

export async function getTrainingPlansByRole(role: 'staple' | 'rotating'): Promise<TrainingPlan[]> {
  return healthDB.trainingPlans.filter(p => p.active && p.role === role).toArray();
}
