// ============================================================
// 运动减脂模板 — 四阶段训练 + 每周计划 + 线性减重
// ============================================================

import { templateEngine, TemplateDefinition } from '../TemplateEngine';
import type { EngineGoal, EngineMilestone, EngineWeeklyTask, EngineDailyAtom } from '../types';

// ============================================================
// 参数类型
// ============================================================

interface FitnessParams {
  targetWeight: number;     // 目标体重(kg)
  currentWeight: number;    // 当前体重(kg)
  weeks: number;            // 总周数（默认12）
  workoutDays: number[];    // 锻炼日 [1,3,5] = 周一三五
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

function getDayOfWeekIdx(dateStr: string): number {
  const d = new Date(dateStr + 'T00:00:00');
  return d.getDay() === 0 ? 7 : d.getDay(); // 1=Mon, 7=Sun
}

// ============================================================
// 阶段配置
// ============================================================

interface PhaseConfig {
  label: string;
  weight: number;
  weekRatio: number;       // 占总周数的比例
  cardioRatio: number;     // 有氧占比
  strengthRatio: number;   // 力量占比
  hiitRatio: number;       // 高强度间歇占比
}

function getPhaseConfigs(totalWeeks: number): PhaseConfig[] {
  if (totalWeeks <= 4) {
    return [
      { label: '适应期', weight: 50, weekRatio: 0.5, cardioRatio: 0.6, strengthRatio: 0.3, hiitRatio: 0.1 },
      { label: '减脂期', weight: 50, weekRatio: 0.5, cardioRatio: 0.5, strengthRatio: 0.3, hiitRatio: 0.2 },
    ];
  }

  const adaptWeeks = Math.max(2, Math.round(totalWeeks * 0.2));
  const burnWeeks = Math.round(totalWeeks * 0.5);
  const plateauWeeks = Math.max(2, Math.round(totalWeeks * 0.15));
  const sustainWeeks = totalWeeks - adaptWeeks - burnWeeks - plateauWeeks;

  return [
    { label: '适应期', weight: 20, weekRatio: adaptWeeks / totalWeeks, cardioRatio: 0.7, strengthRatio: 0.2, hiitRatio: 0.1 },
    { label: '减脂期', weight: 40, weekRatio: burnWeeks / totalWeeks, cardioRatio: 0.5, strengthRatio: 0.3, hiitRatio: 0.2 },
    { label: '平台突破期', weight: 25, weekRatio: plateauWeeks / totalWeeks, cardioRatio: 0.3, strengthRatio: 0.3, hiitRatio: 0.4 },
    { label: '巩固期', weight: 15, weekRatio: sustainWeeks / totalWeeks, cardioRatio: 0.5, strengthRatio: 0.4, hiitRatio: 0.1 },
  ];
}

/** 将阶段配置拆分为每周周数 */
function splitWeeks(totalWeeks: number, configs: PhaseConfig[]): number[] {
  const result: number[] = [];
  let remaining = totalWeeks;
  for (let i = 0; i < configs.length - 1; i++) {
    const w = Math.max(1, Math.round(totalWeeks * configs[i].weekRatio));
    result.push(Math.min(w, remaining - (configs.length - 1 - i)));
    remaining -= result[result.length - 1];
  }
  result.push(Math.max(1, remaining));
  return result;
}

// ============================================================
// 预设训练动作
// ============================================================

const CARDIO_EXERCISES = ['跑步30分钟', '跳绳15分钟', '游泳30分钟', '骑行40分钟', '椭圆机30分钟'];
const STRENGTH_EXERCISES = ['深蹲 4×12', '卧推 4×10', '硬拉 4×8', '引体向上 3×Max', '俯卧撑 3×15', '划船 4×12'];
const HIIT_EXERCISES = ['Tabata 20分钟', '波比跳 10分钟', '冲刺间歇 15分钟', '壶铃摇摆 4×20', '战绳 15分钟'];
const REST_EXERCISE = '休息日 - 拉伸放松';

// ============================================================
// 模板定义
// ============================================================

export const fitnessTemplate: TemplateDefinition = {
  id: 'fitness',
  name: '运动减脂',
  description: '四阶段减脂计划：适应→减脂→平台突破→巩固，含有氧/力量/HIIT配比',
  icon: 'dumbbell',
  category: 'fitness',
  parameters: [
    { key: 'targetWeight', label: '目标体重(kg)', type: 'number', required: true, placeholder: '60' },
    { key: 'currentWeight', label: '当前体重(kg)', type: 'number', required: true, placeholder: '70' },
    { key: 'weeks', label: '计划周数', type: 'number', required: false, defaultValue: 12, hint: '建议 8-16 周' },
    { key: 'workoutDays', label: '锻炼日', type: 'multi-select', required: false,
      options: [
        { value: '1', label: '周一' }, { value: '2', label: '周二' }, { value: '3', label: '周三' },
        { value: '4', label: '周四' }, { value: '5', label: '周五' }, { value: '6', label: '周六' },
        { value: '7', label: '周日' },
      ],
      defaultValue: ['1', '3', '5'],
      hint: '默认周一三五' },
  ],

  generateBlueprint(params: Record<string, unknown>) {
    const p = params as unknown as FitnessParams;
    const today = toDateStr(new Date());
    const totalWeeks = p.weeks || 12;
    const targetWt = p.targetWeight;
    const currentWt = p.currentWeight;
    const weightToLose = Math.max(0, currentWt - targetWt);
    const workoutDays = p.workoutDays || [1, 3, 5];

    // ── 1. Goal ──
    const deadline = addDays(today, totalWeeks * 7 - 1);
    const goal: GoalData = {
      title: `减脂 ${currentWt}kg → ${targetWt}kg`,
      description: `${totalWeeks}周减脂计划，目标减重${weightToLose}kg，训练日${workoutDays.join('、')}`,
      category: 'fitness',
      priority: 'p2',
      deadline,
      templateId: 'fitness',
      successCriteria: `体重降至${targetWt}kg，体脂率下降≥3%`,
    };

    // ── 2. Milestones ──
    const milestones: MsData[] = [];
    const configs = getPhaseConfigs(totalWeeks);
    const phaseWeekCounts = splitWeeks(totalWeeks, configs);

    let cursor = today;
    for (let pi = 0; pi < configs.length; pi++) {
      const cfg = configs[pi];
      const pw = phaseWeekCounts[pi];
      const msEnd = addDays(cursor, pw * 7 - 1);

      milestones.push({
        goalId: '',
        title: cfg.label,
        description: `${cfg.label} (${pw}周)`,
        startDate: cursor,
        deadline: msEnd,
        weight: cfg.weight,
        sortOrder: pi,
      });

      cursor = addDays(msEnd, 1);
    }

    // ── 3. WeeklyTasks + 4. DailyAtoms ──
    const weeklyTasks: WtData[] = [];
    const dailyAtoms: AtomData[][] = [];
    let globalWeekNum = 0;

    cursor = today;
    for (let pi = 0; pi < configs.length; pi++) {
      const cfg = configs[pi];
      const pw = phaseWeekCounts[pi];

      for (let w = 0; w < pw; w++) {
        globalWeekNum++;
        const weekStart = addDays(cursor, w * 7);
        const weekEnd = addDays(weekStart, 6);
        const weekLoss = weightToLose > 0
          ? (weightToLose * cfg.weight / 100 / pw).toFixed(1)
          : '0';

        const atoms: AtomData[] = [];
        let sortOrder = 0;

        // 7天循环
        for (let d = 0; d < 7; d++) {
          const date = addDays(weekStart, d);
          const dow = getDayOfWeekIdx(date);
          const isWorkoutDay = workoutDays.includes(dow);

          let title: string;
          if (!isWorkoutDay) {
            title = REST_EXERCISE;
          } else {
            // 按阶段配比随机选动作类型
            const rand = Math.random();
            if (rand < cfg.cardioRatio) {
              title = CARDIO_EXERCISES[(globalWeekNum + d) % CARDIO_EXERCISES.length];
            } else if (rand < cfg.cardioRatio + cfg.strengthRatio) {
              title = STRENGTH_EXERCISES[(globalWeekNum + d) % STRENGTH_EXERCISES.length];
            } else {
              title = HIIT_EXERCISES[(globalWeekNum + d) % HIIT_EXERCISES.length];
            }
          }

          atoms.push({
            weeklyTaskId: '',
            title,
            scheduledDate: date,
            quantity: 1,
            estimatedDuration: isWorkoutDay ? 45 : 15,
            sortOrder: sortOrder++,
          });
        }

        const wtTitle = `${cfg.label} W${globalWeekNum} (目标−${weekLoss}kg)`;
        weeklyTasks.push({
          milestoneId: '',
          title: wtTitle,
          plannedStart: weekStart,
          plannedEnd: weekEnd,
          quantityTarget: workoutDays.length,
          quantityUnit: '天/周',
          weight: Math.round(100 / pw),
          sortOrder: globalWeekNum - 1,
        });

        dailyAtoms.push(atoms);
      }

      cursor = addDays(cursor, pw * 7);
    }

    return { goal, milestones, weeklyTasks, dailyAtoms };
  },
};

templateEngine.register(fitnessTemplate);
