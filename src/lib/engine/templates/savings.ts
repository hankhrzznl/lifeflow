// ============================================================
// 存款记账模板 — 三种策略 + 季度里程碑
// ============================================================

import { templateEngine, TemplateDefinition } from '../TemplateEngine';
import type { EngineGoal, EngineMilestone, EngineWeeklyTask, EngineDailyAtom } from '../types';

// ============================================================
// 参数类型
// ============================================================

interface SavingsParams {
  targetAmount: number;       // 目标金额
  currentAmount: number;      // 当前金额
  deadline: string;           // 截止日期
  strategy: 'equal' | 'accelerating' | 'decelerating';
}

type GoalData = Omit<EngineGoal, 'id' | 'progress' | 'status' | 'healthStatus' | 'createdAt' | 'updatedAt'>;
type MsData = Omit<EngineMilestone, 'id' | 'progress' | 'status' | 'createdAt' | 'updatedAt'>;
type WtData = Omit<EngineWeeklyTask, 'id' | 'weekNumber' | 'year' | 'progress' | 'status' | 'createdAt' | 'updatedAt'>;
type AtomData = Omit<EngineDailyAtom, 'id' | 'isCompleted' | 'completedAt' | 'actualQuantity' | 'checkInId' | 'status' | 'createdAt' | 'updatedAt'>;

// ============================================================
// 辅助函数
// ============================================================

function addDays(dateStr: string, days: number): string {
  const d = new Date(dateStr + 'T00:00:00');
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
}

function toDateStr(d: Date): string {
  return d.toISOString().slice(0, 10);
}

function daysBetween(d1: string, d2: string): number {
  const a = new Date(d1 + 'T00:00:00');
  const b = new Date(d2 + 'T00:00:00');
  return Math.ceil((b.getTime() - a.getTime()) / 86400000);
}

/**
 * 计算每月储蓄额（按策略）
 *
 * @param remaining - 还需储蓄的金额
 * @param totalMonths - 总月数
 * @param monthIdx - 当前月序号 (0-based)
 * @param strategy - 策略
 */
function calculateMonthlyAmount(
  remaining: number,
  totalMonths: number,
  monthIdx: number,
  strategy: 'equal' | 'accelerating' | 'decelerating',
): number {
  if (strategy === 'equal') {
    return Math.round(remaining / (totalMonths - monthIdx));
  }

  // 构建总权重数组
  const weights: number[] = [];
  for (let i = 0; i < totalMonths; i++) {
    if (strategy === 'accelerating') {
      // 前期少后期多：线性递增
      weights.push(i + 1);
    } else {
      // 前期多后期少：线性递减
      weights.push(totalMonths - i);
    }
  }

  const totalWeight = weights.reduce((a, b) => a + b, 0);
  const remainingWeights = weights.slice(monthIdx).reduce((a, b) => a + b, 0);

  if (remainingWeights <= 0) return 0;
  return Math.round(remaining * weights[monthIdx] / remainingWeights);
}

// ============================================================
// 策略标签
// ============================================================

const STRATEGY_LABELS: Record<string, string> = {
  equal: '等额存款',
  accelerating: '渐进加速（前期少后期多）',
  decelerating: '前紧后松（前期多后期少）',
};

// ============================================================
// 模板定义
// ============================================================

export const savingsTemplate: TemplateDefinition = {
  id: 'finance',
  name: '存款计划',
  description: '三种存款策略：等额/加速/减速，按季度里程碑追踪',
  icon: 'piggy-bank',
  category: 'finance',
  parameters: [
    { key: 'targetAmount', label: '目标金额(元)', type: 'number', required: true, placeholder: '50000' },
    { key: 'currentAmount', label: '当前已存(元)', type: 'number', required: true, placeholder: '0' },
    { key: 'deadline', label: '截止日期', type: 'date', required: true },
    { key: 'strategy', label: '存款策略', type: 'select', required: false,
      options: [
        { value: 'equal', label: '等额存款' },
        { value: 'accelerating', label: '渐进加速' },
        { value: 'decelerating', label: '前紧后松' },
      ],
      defaultValue: 'equal',
      hint: '等额=每月存相同金额；加速=前期少后期多；前紧后松=前期多后期少' },
  ],

  generateBlueprint(params: Record<string, unknown>) {
    const p = params as unknown as SavingsParams;
    const today = toDateStr(new Date());
    const targetAmount = p.targetAmount;
    const currentAmount = p.currentAmount;
    const remaining = targetAmount - currentAmount;

    const totalDays = daysBetween(today, p.deadline);
    const totalMonths = Math.max(1, Math.ceil(totalDays / 30));

    // ── 1. Goal ──
    const goal: GoalData = {
      title: `存款 ${targetAmount.toLocaleString()}元`,
      description: `${STRATEGY_LABELS[p.strategy]}计划，${totalMonths}个月存${remaining.toLocaleString()}元，月均${Math.round(remaining / totalMonths).toLocaleString()}元`,
      category: 'finance',
      priority: 'p2',
      deadline: p.deadline,
      templateId: 'finance',
      successCriteria: `存款达到${targetAmount.toLocaleString()}元`,
    };

    // ── 2. Milestones（按季度或按25%分割）
    //    每 maximal(4, totalMonths) 个里程碑
    const msCount = Math.min(totalMonths, Math.max(2, Math.ceil(totalMonths / 3)));
    const monthsPerMs = Math.ceil(totalMonths / msCount);
    const msWeights = msCount === 2 ? [45, 55] :
      msCount === 3 ? [35, 35, 30] :
      msCount === 4 ? [25, 25, 25, 25] :
      [50, 50];

    const milestones: MsData[] = [];
    for (let m = 0; m < msCount; m++) {
      const startMon = m * monthsPerMs + 1;
      const endMon = Math.min((m + 1) * monthsPerMs, totalMonths);
      const startDate = addDays(today, m * monthsPerMs * 30);
      const endDate = m === msCount - 1
        ? p.deadline
        : addDays(today, (m + 1) * monthsPerMs * 30 - 1);

      milestones.push({
        goalId: '',
        title: `第${m + 1}阶段 (月${startMon}-${endMon})`,
        description: `第${startMon}到第${endMon}个月`,
        startDate,
        deadline: endDate,
        weight: msWeights[m],
        sortOrder: m,
      });
    }

    // ── 3. WeeklyTasks + 4. DailyAtoms ──
    const weeklyTasks: WtData[] = [];
    const dailyAtoms: AtomData[][] = [];
    let globalWeek = 0;
    let currentRemaining = remaining;

    for (let m = 0; m < milestones.length; m++) {
      const msMonths = m === milestones.length - 1
        ? totalMonths - m * monthsPerMs
        : monthsPerMs;
      const msWeeks = msMonths * 4;

      for (let w = 0; w < msWeeks; w++) {
        globalWeek++;
        const weekStart = addDays(today, globalWeek * 7 - 7);
        const weekEnd = addDays(weekStart, 6);

        // 该月应当储蓄的金额
        const monthlyAmount = calculateMonthlyAmount(
          remaining,
          totalMonths,
          Math.min(m * monthsPerMs + Math.floor(w / 4), totalMonths - 1),
          p.strategy,
        );
        const weeklyAmount = Math.round(monthlyAmount / 4);

        currentRemaining -= weeklyAmount;

        const atoms: AtomData[] = [];
        let sortOrder = 0;

        // 每天提醒 + 每周回顾
        for (let d = 0; d < 7; d++) {
          const date = addDays(weekStart, d);
          const dayName = ['周一', '周二', '周三', '周四', '周五', '周六', '周日'][d];

          atoms.push({
            weeklyTaskId: '',
            title: d === 6
              ? `本周储蓄回顾 (${weeklyAmount}元已存，余额${Math.max(0, currentRemaining).toLocaleString()}元)`
              : `${dayName}：存入 ${Math.round(weeklyAmount / 5).toLocaleString()}元`,
            scheduledDate: date,
            quantity: 1,
            estimatedDuration: d === 6 ? 10 : 3,
            sortOrder: sortOrder++,
          });
        }

        weeklyTasks.push({
          milestoneId: '',
          title: `第${globalWeek}周存款 (目标 ${weeklyAmount.toLocaleString()}元)`,
          plannedStart: weekStart,
          plannedEnd: weekEnd,
          quantityTarget: weeklyAmount,
          quantityUnit: '元',
          weight: Math.round(100 / msWeeks),
          sortOrder: globalWeek - 1,
        });

        dailyAtoms.push(atoms);
      }
    }

    return { goal, milestones, weeklyTasks, dailyAtoms };
  },
};

templateEngine.register(savingsTemplate);
