/**
 * 训练计划自动生成器
 * 五大训练体系 → 统一挂在一个「强健体魄」Goal下作为打卡项
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
  const startYear = 2026;
  const startMonth = 7;
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
// 计划初始化（5个TrainingPlan → 5个独立Goal → ScheduleTask）
// ============================================================

export async function initializeTrainingPlans(): Promise<{ created: number }> {
  const existing = await healthDB.trainingPlans.count();
  if (existing > 0) {
    return await repairPlans();
  }

  const { primary, secondary } = getMonthlyRotation();
  let created = 0;

  for (const sys of TRAINING_SYSTEMS) {
    // Each training system gets its own Goal
    const goal = await createGoalForSystem(sys);
    const planDef = getPlanDefaults(sys, primary, secondary);
    const planId = crypto.randomUUID();
    await healthDB.trainingPlans.add({
      ...planDef, id: planId, goalId: goal.id, streak: 0, daysLog: {}, active: true, createdAt: Date.now(),
    } as TrainingPlan);
    created++;
    await generateScheduleTasksForPlan(
      { ...planDef, id: planId, goalId: goal.id, streak: 0, daysLog: {}, active: true, createdAt: Date.now() } as TrainingPlan,
      goal.id
    );
  }

  return { created };
}

/** Create a Goal for a single training system */
async function createGoalForSystem(sys: TrainingSystemDef): Promise<Goal> {
  const existing = await efficiencyDB.goals.where("title").equals(sys.label).first();
  if (existing) return existing;

  const goalId = crypto.randomUUID();
  await efficiencyDB.goals.add({
    id: goalId,
    title: sys.label,
    deadline: getMonthEnd(),
    progress: 0,
    status: 'active',
    goalType: 'task',
    targetCount: sys.role === 'staple' ? 12 : 6,
    note: sys.exercises.join('、'),
    color: sys.color,
    quadrant: 'q2',
    createdAt: Date.now(),
  } as Goal);

  return { id: goalId } as Goal;
}

/** Repair: ensure each training plan has its own Goal */
async function repairPlans(): Promise<{ created: number }> {
  const plans = await healthDB.trainingPlans.toArray();
  for (const p of plans) {
    const sys = TRAINING_SYSTEMS.find(s => s.type === p.trainingType);
    if (sys) {
      const goal = await createGoalForSystem(sys);
      if (p.goalId !== goal.id) {
        await healthDB.trainingPlans.update(p.id, { goalId: goal.id } as any);
      }
    }
  }
  return { created: 0 };
}



function getPlanDefaults(sys: TrainingSystemDef, primary: TrainingType, secondary: TrainingType[]): Omit<TrainingPlan, 'id'> {
  const isStaple = sys.role === 'staple';

  if (isStaple) {
    if (sys.type === 'gym_compound') {
      return { name: sys.label, trainingType: sys.type, role: 'staple', frequency: 'weekly', weeklyDays: [1, 3, 5], exercises: sys.exercises, active: true, createdAt: Date.now() };
    }
    return { name: sys.label, trainingType: sys.type, role: 'staple', frequency: 'weekly', weeklyDays: [2, 4], exercises: sys.exercises, active: true, createdAt: Date.now() };
  }

  if (sys.type === primary) {
    return { name: sys.label, trainingType: sys.type, role: 'rotating', frequency: 'weekly', weeklyDays: [1, 3, 5], exercises: sys.exercises, active: true, createdAt: Date.now() };
  }
  return { name: sys.label, trainingType: sys.type, role: 'rotating', frequency: 'weekly', weeklyDays: [6], exercises: sys.exercises, active: true, createdAt: Date.now() };
}

// ============================================================
// 生成本周 ScheduleTask
// ============================================================

export async function generateScheduleTasksForPlan(plan: TrainingPlan, masterGoalId: string): Promise<void> {
  if (!plan.active) return;

  if (plan.frequency === 'weekly' && plan.weeklyDays) {
    const { start, end } = getCurrentWeek();

    for (const dayOfWeek of plan.weeklyDays) {
      const date = getDateFromDayOfWeek(start, dayOfWeek);
      if (date < localDateStr(new Date())) continue;
      if (date > end) continue;

      const existing = await efficiencyDB.scheduleTasks
        .where({ goalId: masterGoalId })
        .and(t => t.date === date && t.title === plan.name)
        .count();
      if (existing > 0) continue;

      await addScheduleTask({
        title: plan.name,
        type: 'single',
        date,
        goalId: masterGoalId,
        quadrant: 'q2',
        isCompleted: false,
        plannedTime: plan.role === 'staple' ? 60 : plan.trainingType === plan.trainingType ? 45 : 20,
        actualTime: 0,
        isImportant: true,
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
  const currentDow = base.getDay() || 7;
  const offset = targetDow - currentDow;
  base.setDate(base.getDate() + offset);
  return localDateStr(base);
}

function getMonthEnd(): string {
  const d = new Date();
  d.setMonth(d.getMonth() + 1);
  d.setDate(0);
  return localDateStr(d);
}

// ============================================================
// 查询
// ============================================================

export async function getActiveTrainingPlans(): Promise<TrainingPlan[]> {
  return healthDB.trainingPlans.filter(p => p.active).toArray();
}

export async function getTrainingPlansByRole(role: 'staple' | 'rotating'): Promise<TrainingPlan[]> {
  return healthDB.trainingPlans.filter(p => p.active && p.role === role).toArray();
}
