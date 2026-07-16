// ============================================================
// 目标拆解引擎 — 场景化模板引擎
// 4 大模板：备考 / 运动减脂 / 习惯养成 / 存款记账
// 特性：艾宾浩斯复习间隔、难度自适应调节
// ============================================================

import type {
  TemplateParams,
  TemplateResult,
  Goal,
  Milestone,
  WeeklyTask,
  DailyAtom,
  GoalCategory,
  TemplateMeta,
} from '@/types/goal';
import { EBBINGHAUS_INTERVALS, TEMPLATE_DEFAULTS } from '@/types/goal';

// ============================================================
// 工具函数
// ============================================================

/** 生成 UUID v4 */
function uuid(): string {
  return crypto.randomUUID();
}

/** 日期加法：dateStr + days → 新日期字符串 */
function addDays(dateStr: string, days: number): string {
  const d = new Date(dateStr + 'T00:00:00');
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
}

/** 计算两个日期之间的天数差 */
function daysBetween(start: string, end: string): number {
  const s = new Date(start + 'T00:00:00');
  const e = new Date(end + 'T00:00:00');
  return Math.ceil((e.getTime() - s.getTime()) / (1000 * 60 * 60 * 24));
}

/** 获取日期的 ISO 周号 */
function getISOWeekNumber(dateStr: string): { year: number; week: number } {
  const d = new Date(dateStr + 'T00:00:00');
  const dayNum = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  const weekNo = Math.ceil(
    ((d.getTime() - yearStart.getTime()) / 86400000 + 1) / 7
  );
  return { year: d.getUTCFullYear(), week: weekNo };
}

/** 周一到周日的中文标签 */
const WEEKDAY_LABELS = ['周一', '周二', '周三', '周四', '周五', '周六', '周日'];

// ============================================================
// 模板元数据存储
// ============================================================

const TEMPLATE_METAS: TemplateMeta[] = [
  {
    id: 'template_exam',
    name: '备考计划',
    description: '适用于考研/考公/考证，自动生成基础→强化→冲刺→模考四阶段计划',
    category: 'exam',
    icon: '📚',
    usageCount: 0,
  },
  {
    id: 'template_fitness',
    name: '运动减脂',
    description: '适用于减肥/增肌/体能训练，渐进式四阶段训练方案',
    category: 'fitness',
    icon: '💪',
    usageCount: 0,
  },
  {
    id: 'template_habit',
    name: '习惯养成',
    description: '适用于早起/阅读/冥想，21天三阶段习惯养成法',
    category: 'habit',
    icon: '🌱',
    usageCount: 0,
  },
  {
    id: 'template_finance',
    name: '存款记账',
    description: '适用于储蓄/旅行基金/购房，每月分阶段储蓄方案',
    category: 'finance',
    icon: '💰',
    usageCount: 0,
  },
];

// ============================================================
// 备考模板：艾宾浩斯复习间隔引擎
// ============================================================

/**
 * 备考模板生成器
 *
 * 算法设计：
 * 1. 根据考试日期和当前日期计算总天数
 * 2. 按比例划分4个阶段（基础35% / 强化30% / 冲刺25% / 模考10%）
 * 3. 每个阶段按周拆分，每周根据用户每日学习时长分配原子项
 * 4. 在学习原子项创建后的第 1/2/4/7/15 天插入艾宾浩斯复习原子项
 *
 * 艾宾浩斯实现方式：
 * - 为每个"新学习"原子项计算复习日期
 * - 在对应的 scheduledDate 上叠加复习任务
 * - 复习任务的 title 前缀 "[复习]" 以区别于新学习
 */
function generateExamTemplate(params: TemplateParams): TemplateResult {
  const today = new Date().toISOString().slice(0, 10);
  const totalDays = Math.max(7, daysBetween(today, params.deadline));
  const dailyHours = params.dailyStudyHours ?? 4;

  const config = TEMPLATE_DEFAULTS.exam;
  const milestones: TemplateResult['milestones'] = [];
  const weeklyTasks: TemplateResult['weeklyTasks'] = [];
  const dailyAtoms: TemplateResult['dailyAtoms'] = [];

  let dayCursor = 0;

  for (let i = 0; i < config.milestoneCount; i++) {
    const msId = uuid();
    const msDays = Math.floor((totalDays * config.weights[i]) / 100);
    const msStart = addDays(today, dayCursor);
    const msEnd = addDays(today, dayCursor + msDays - 1);

    milestones.push({
      title: `${config.labels[i]}（${msStart} ~ ${msEnd}）`,
      description: `${params.examSubject ?? '考试'} - ${config.labels[i]}`,
      startDate: msStart,
      deadline: msEnd,
      weight: config.weights[i],
      deliverable: getExamDeliverable(i),
      acceptanceCriteria: getExamAcceptanceCriteria(i),
      dependencies: i > 0 ? [milestones[i - 1]?.title ?? ''] : [],
      sortOrder: i,
    });

    // 按周拆分
    const weeksInMS = Math.ceil(msDays / 7);
    for (let w = 0; w < weeksInMS; w++) {
      const wtId = uuid();
      const wtStart = addDays(msStart, w * 7);
      const wtEnd = addDays(msStart, Math.min((w + 1) * 7 - 1, msDays - 1));
      const { year, week } = getISOWeekNumber(wtStart);

      // 每周量化目标 = 每日学习时长 × 每日任务数 × 7
      // 每个学习session 约 45 分钟，所以每日任务数 ≈ dailyHours / 0.75
      const dailySessions = Math.max(1, Math.round(dailyHours / 0.75));
      const weeklySessions = dailySessions * 7;

      weeklyTasks.push({
        title: `${config.labels[i]} · 第${w + 1}周`,
        weekNumber: week,
        year,
        plannedStart: wtStart,
        plannedEnd: wtEnd,
        quantityTarget: weeklySessions,
        quantityUnit: '节',
        weight: Math.round(100 / weeksInMS),
        sortOrder: w,
      });

      // 按日拆分原子项（仅排在学习日，周末留弹性）
      const studyDays = Math.min(5, daysBetween(wtStart, wtEnd) + 1);
      const newLearningAtoms: Array<{ date: string; title: string }> = [];

      for (let d = 0; d < studyDays; d++) {
        const atomDate = addDays(wtStart, d);
        const weekday = new Date(atomDate + 'T00:00:00').getDay();
        // 跳过周末（周六=6, 周日=0）
        if (weekday === 0 || weekday === 6) continue;

        for (let s = 0; s < dailySessions; s++) {
          const atomTitle = s === 0
            ? `学习${params.examSubject ?? '新内容'}（第${dayCursor + 1}天）`
            : `习题练习 ${s + 1}（${params.examSubject ?? ''}）`;

          dailyAtoms.push({
            title: atomTitle,
            scheduledDate: atomDate,
            quantity: 1,
            estimatedDuration: 45,
            sortOrder: s,
          });

          // 记录新学习原子项用于插艾宾浩斯复习
          if (s === 0) {
            newLearningAtoms.push({ date: atomDate, title: atomTitle });
          }
        }
      }

      // 艾宾浩斯复习：为每个新学习原子项插入复习任务
      for (const learning of newLearningAtoms) {
        for (const interval of EBBINGHAUS_INTERVALS) {
          const reviewDate = addDays(learning.date, interval);
          // 只在截止日期前插入复习
          if (reviewDate <= params.deadline) {
            dailyAtoms.push({
              title: `[复习] ${params.examSubject ?? '内容'}回顾（${interval}天前学习）`,
              scheduledDate: reviewDate,
              quantity: 1,
              estimatedDuration: 20, // 复习比新学耗时少
              sortOrder: 99, // 复习排在同日最后
            });
          }
        }
      }

      dayCursor += 7;
    }
  }

  return {
    goal: {
      title: params.goalTitle,
      description: params.goalDescription ?? `${params.examSubject ?? '考试'}备考计划`,
      category: 'exam',
      priority: params.priority ?? 'p2',
      deadline: params.deadline,
      templateId: 'template_exam',
      successCriteria: params.targetScore
        ? `${params.examSubject ?? '考试'}达到 ${params.targetScore} 分`
        : undefined,
    },
    milestones,
    weeklyTasks,
    dailyAtoms,
  };
}

/** 获取各阶段交付物描述 */
function getExamDeliverable(index: number): string {
  const deliverables = [
    '完成全部章节基础知识学习',
    '完成近15年真题分类训练',
    '完成10套全真模拟考试',
    '完成考前最后3套押题卷',
  ];
  return deliverables[index] ?? '';
}

/** 获取各阶段验收标准 */
function getExamAcceptanceCriteria(index: number): string {
  const criteria = [
    '章节测试平均正确率 ≥ 60%',
    '真题正确率 ≥ 75%',
    '模考稳定在目标分数 ±5 分',
    '押题卷全部过线',
  ];
  return criteria[index] ?? '';
}

// ============================================================
// 运动减脂模板
// ============================================================

function generateFitnessTemplate(params: TemplateParams): TemplateResult {
  const today = new Date().toISOString().slice(0, 10);
  const totalDays = Math.max(7, daysBetween(today, params.deadline));
  const weeklyWorkouts = params.weeklyWorkouts ?? 4;

  const config = TEMPLATE_DEFAULTS.fitness;
  const milestones: TemplateResult['milestones'] = [];
  const weeklyTasks: TemplateResult['weeklyTasks'] = [];
  const dailyAtoms: TemplateResult['dailyAtoms'] = [];

  let dayCursor = 0;

  for (let i = 0; i < config.milestoneCount; i++) {
    const msId = uuid();
    const msDays = Math.floor((totalDays * config.weights[i]) / 100);
    const msStart = addDays(today, dayCursor);
    const msEnd = addDays(today, dayCursor + msDays - 1);

    milestones.push({
      title: config.labels[i],
      description: getFitnessDescription(i),
      startDate: msStart,
      deadline: msEnd,
      weight: config.weights[i],
      deliverable: getFitnessDeliverable(i, params),
      sortOrder: i,
    });

    const weeksInMS = Math.ceil(msDays / 7);
    for (let w = 0; w < weeksInMS; w++) {
      const wtId = uuid();
      const wtStart = addDays(msStart, w * 7);
      const wtEnd = addDays(msStart, Math.min((w + 1) * 7 - 1, msDays - 1));
      const { year, week } = getISOWeekNumber(wtStart);

      weeklyTasks.push({
        title: `${config.labels[i]} · 第${w + 1}周`,
        weekNumber: week,
        year,
        plannedStart: wtStart,
        plannedEnd: wtEnd,
        quantityTarget: weeklyWorkouts,
        quantityUnit: '次',
        weight: Math.round(100 / weeksInMS),
        sortOrder: w,
      });

      // 均匀分配训练日（周一、周三、周五、周日）
      const workoutDayOffsets = [0, 2, 4, 6].slice(0, weeklyWorkouts);
      for (let d = 0; d < workoutDayOffsets.length; d++) {
        const atomDate = addDays(wtStart, workoutDayOffsets[d]);
        const workoutTypes = getWorkoutTypes(i);
        dailyAtoms.push({
          title: `${workoutTypes[d % workoutTypes.length]}（${WEEKDAY_LABELS[workoutDayOffsets[d]]}）`,
          scheduledDate: atomDate,
          quantity: 1,
          estimatedDuration: 60,
          sortOrder: d,
        });
      }
    }

    dayCursor += msDays;
  }

  return {
    goal: {
      title: params.goalTitle,
      description: params.goalDescription ?? '运动减脂训练计划',
      category: 'fitness',
      priority: params.priority ?? 'p2',
      deadline: params.deadline,
      templateId: 'template_fitness',
      successCriteria: params.targetWeightKg
        ? `体重降至 ${params.targetWeightKg}kg`
        : undefined,
    },
    milestones,
    weeklyTasks,
    dailyAtoms,
  };
}

function getFitnessDescription(index: number): string {
  const descs = [
    '建立运动习惯，适应基本训练节奏',
    '提高训练强度，进入快速减脂期',
    '优化肌肉线条，提升基础代谢',
    '保持运动习惯，防止反弹',
  ];
  return descs[index] ?? '';
}

function getFitnessDeliverable(index: number, params: TemplateParams): string {
  const target = params.targetWeightKg ? `体重降至 ${params.targetWeightKg}kg` : '完成训练目标';
  const deliverables = [
    `完成${target}的适应期准备`,
    `${target}进度达50%`,
    '完成身体成分优化',
    `${target}完成并建立长期习惯`,
  ];
  return deliverables[index] ?? '';
}

function getWorkoutTypes(phaseIndex: number): string[] {
  const types = [
    ['快走30分钟', '核心训练', '拉伸瑜伽', '有氧操'],
    ['HIIT间歇训练', '力量训练', '跑步5km', '游泳'],
    ['功能性训练', '高强度有氧', '普拉提', '骑行'],
    ['综合训练', '团体课', '户外运动', '柔韧训练'],
  ];
  return types[phaseIndex] ?? types[0];
}

// ============================================================
// 习惯养成模板
// ============================================================

function generateHabitTemplate(params: TemplateParams): TemplateResult {
  const today = new Date().toISOString().slice(0, 10);

  const config = TEMPLATE_DEFAULTS.habit;
  const milestones: TemplateResult['milestones'] = [];
  const weeklyTasks: TemplateResult['weeklyTasks'] = [];
  const dailyAtoms: TemplateResult['dailyAtoms'] = [];

  // 习惯养成固定 21 天
  const totalDays = 21;
  const dayAllocations = [7, 7, 7]; // 3个7天阶段

  let dayCursor = 0;

  for (let i = 0; i < config.milestoneCount; i++) {
    const msId = uuid();
    const msStart = addDays(today, dayCursor);
    const msEnd = addDays(today, dayCursor + dayAllocations[i] - 1);

    milestones.push({
      title: config.labels[i],
      description: getHabitDescription(i, params.habitType),
      startDate: msStart,
      deadline: msEnd,
      weight: config.weights[i],
      deliverable: `连续 ${dayAllocations[i]} 天完成习惯`,
      sortOrder: i,
    });

    const { year, week } = getISOWeekNumber(msStart);

    weeklyTasks.push({
      title: `${config.labels[i]} · 第${i + 1}周`,
      weekNumber: week,
      year,
      plannedStart: msStart,
      plannedEnd: msEnd,
      quantityTarget: 7,
      quantityUnit: '天',
      weight: Math.round(100 / config.milestoneCount),
      sortOrder: i,
    });

    // 每日一个习惯原子项
    for (let d = 0; d < dayAllocations[i]; d++) {
      const atomDate = addDays(msStart, d);
      dailyAtoms.push({
        title: params.habitType ?? params.goalTitle,
        scheduledDate: atomDate,
        quantity: 1,
        estimatedDuration: 15,
        sortOrder: 0,
      });
    }

    dayCursor += dayAllocations[i];
  }

  return {
    goal: {
      title: params.goalTitle,
      description: params.goalDescription ?? `养成 ${params.habitType ?? '新习惯'} 的21天计划`,
      category: 'habit',
      priority: params.priority ?? 'p2',
      deadline: addDays(today, totalDays),
      templateId: 'template_habit',
      successCriteria: `连续21天完成 ${params.habitType ?? '习惯'}`,
    },
    milestones,
    weeklyTasks,
    dailyAtoms,
  };
}

function getHabitDescription(index: number, habitType?: string): string {
  const type = habitType ?? '新习惯';
  const descs = [
    `有意识地每天执行${type}，借助外部提醒`,
    `减少提醒依赖，让${type}成为日常自然行为`,
    `${type}已成为自动化习惯，无需刻意坚持`,
  ];
  return descs[index] ?? '';
}

// ============================================================
// 存款记账模板
// ============================================================

function generateFinanceTemplate(params: TemplateParams): TemplateResult {
  const today = new Date().toISOString().slice(0, 10);
  const totalMonths = Math.max(
    1,
    Math.ceil(daysBetween(today, params.deadline) / 30)
  );
  const monthlyTarget = params.monthlyTarget ?? 2000;

  const milestones: TemplateResult['milestones'] = [];
  const weeklyTasks: TemplateResult['weeklyTasks'] = [];
  const dailyAtoms: TemplateResult['dailyAtoms'] = [];

  const weightPerMonth = Math.round(100 / totalMonths);

  for (let m = 0; m < totalMonths; m++) {
    const msId = uuid();
    const msStart = addDays(today, m * 30);
    const msEnd = addDays(today, (m + 1) * 30 - 1);

    milestones.push({
      title: `第${m + 1}月储蓄`,
      description: `月储蓄目标 ¥${monthlyTarget.toLocaleString()}`,
      startDate: msStart,
      deadline: msEnd,
      weight: weightPerMonth,
      deliverable: `月储蓄 ¥${monthlyTarget.toLocaleString()}`,
      sortOrder: m,
    });

    // 每周记账任务
    const weeksInMonth = 4;
    for (let w = 0; w < weeksInMonth; w++) {
      const wtId = uuid();
      const wtStart = addDays(msStart, w * 7);
      const wtEnd = addDays(msStart, Math.min((w + 1) * 7 - 1, 29));
      const { year, week } = getISOWeekNumber(wtStart);

      weeklyTasks.push({
        title: `第${m + 1}月 · 第${w + 1}周记账`,
        weekNumber: week,
        year,
        plannedStart: wtStart,
        plannedEnd: wtEnd,
        quantityTarget: 7,
        quantityUnit: '天',
        weight: 25,
        sortOrder: w,
      });

      // 每日记账原子项
      for (let d = 0; d < 7; d++) {
        const atomDate = addDays(wtStart, d);
        if (atomDate <= params.deadline) {
          dailyAtoms.push({
            title: '每日记账',
            scheduledDate: atomDate,
            quantity: 1,
            estimatedDuration: 5,
            sortOrder: 0,
          });
        }
      }
    }
  }

  return {
    goal: {
      title: params.goalTitle,
      description: params.goalDescription ?? `储蓄目标：月存 ¥${monthlyTarget.toLocaleString()}`,
      category: 'finance',
      priority: params.priority ?? 'p2',
      deadline: params.deadline,
      templateId: 'template_finance',
      successCriteria: `累计储蓄 ¥${(monthlyTarget * totalMonths).toLocaleString()}`,
    },
    milestones,
    weeklyTasks,
    dailyAtoms,
  };
}

// ============================================================
// 公共 API
// ============================================================

/**
 * 获取所有可用模板的元数据列表
 */
export function getTemplateMetas(): TemplateMeta[] {
  return TEMPLATE_METAS;
}

/**
 * 获取单个模板元数据
 */
export function getTemplateMeta(templateId: string): TemplateMeta | undefined {
  return TEMPLATE_METAS.find((t) => t.id === templateId);
}

/**
 * 应用模板生成四级拆解结构
 *
 * 设计思路：
 * - 根据模板类别路由到不同的生成器
 * - 返回不包含数据库 ID 的纯数据结构
 * - 调用方负责写入数据库（通过 GoalEngine.createFromTemplate）
 *
 * @param category - 目标类别（决定使用哪个模板引擎）
 * @param params - 用户输入的模板参数
 * @returns 完整的四级拆解结构（ID 待分配）
 */
export function generateTemplate(
  category: GoalCategory,
  params: TemplateParams
): TemplateResult {
  // 递增模板使用计数
  const meta = TEMPLATE_METAS.find((t) => t.category === category);
  if (meta) meta.usageCount++;

  switch (category) {
    case 'exam':
      return generateExamTemplate(params);
    case 'fitness':
      return generateFitnessTemplate(params);
    case 'habit':
      return generateHabitTemplate(params);
    case 'finance':
      return generateFinanceTemplate(params);
    case 'custom':
      // 自定义目标使用通用等分算法
      return generateGenericTemplate(params);
    default: {
      const _exhaustive: never = category;
      throw new Error(`Unknown template category: ${_exhaustive}`);
    }
  }
}

/**
 * 通用模板（自定义目标）
 * 策略：等分时间段，每个里程碑权重相等
 */
function generateGenericTemplate(params: TemplateParams): TemplateResult {
  const today = new Date().toISOString().slice(0, 10);
  const totalDays = Math.max(7, daysBetween(today, params.deadline));
  const msCount = totalDays <= 30 ? 2 : totalDays <= 90 ? 3 : 4;
  const daysPerMS = Math.floor(totalDays / msCount);
  const weightPerMS = Math.round(100 / msCount);

  const milestones: TemplateResult['milestones'] = [];
  const weeklyTasks: TemplateResult['weeklyTasks'] = [];
  const dailyAtoms: TemplateResult['dailyAtoms'] = [];

  for (let i = 0; i < msCount; i++) {
    const msStart = addDays(today, i * daysPerMS);
    const msEnd = addDays(today, Math.min((i + 1) * daysPerMS - 1, totalDays - 1));

    milestones.push({
      title: `阶段${i + 1}（${msStart} ~ ${msEnd}）`,
      description: `第${i + 1}阶段执行`,
      startDate: msStart,
      deadline: msEnd,
      weight: i === msCount - 1
        ? 100 - weightPerMS * (msCount - 1) // 最后一个补足 100
        : weightPerMS,
      sortOrder: i,
    });

    const weeksInMS = Math.ceil(Math.min(daysPerMS, daysBetween(msStart, msEnd) + 1) / 7);
    for (let w = 0; w < weeksInMS; w++) {
      const wtStart = addDays(msStart, w * 7);
      const wtEnd = addDays(msStart, Math.min((w + 1) * 7 - 1, daysBetween(msStart, msEnd)));
      const { year, week } = getISOWeekNumber(wtStart);

      weeklyTasks.push({
        title: `阶段${i + 1} · 第${w + 1}周`,
        weekNumber: week,
        year,
        plannedStart: wtStart,
        plannedEnd: wtEnd,
        quantityTarget: 5,
        quantityUnit: '次',
        weight: Math.round(100 / weeksInMS),
        sortOrder: w,
      });

      // 每个工作日一个原子项
      for (let d = 0; d < 5; d++) {
        const atomDate = addDays(wtStart, d);
        if (atomDate <= params.deadline) {
          dailyAtoms.push({
            title: `${params.goalTitle} - 每日执行`,
            scheduledDate: atomDate,
            quantity: 1,
            estimatedDuration: 30,
            sortOrder: d,
          });
        }
      }
    }
  }

  return {
    goal: {
      title: params.goalTitle,
      description: params.goalDescription ?? '',
      category: 'custom',
      priority: params.priority ?? 'p2',
      deadline: params.deadline,
      templateId: undefined,
    },
    milestones,
    weeklyTasks,
    dailyAtoms,
  };
}

// ============================================================
// 难度自适应调节
// ============================================================

/**
 * 难度自适应调节
 *
 * 设计思路：
 * - 连续 3 天超额完成（actualQuantity > quantity 且完成所有原子项）
 *   → 每日目标量 +10%
 * - 连续 3 天未完成任何原子项
 *   → 每日目标量 -20%
 * - 变化幅度设上下限：不低于原始的 30%，不高于原始的 200%
 *
 * 该函数由演化引擎定期调用，而非每次回算触发
 *
 * @param goalId - 目标 ID
 * @returns 调整后的目标值变化描述
 */
export async function applyAdaptiveDifficulty(
  goalId: string
): Promise<{ adjusted: boolean; message: string }> {
  const { goalDB } = await import('./schema');

  const goal = await goalDB.goals.get(goalId);
  if (!goal) return { adjusted: false, message: '目标不存在' };

  const milestones = await goalDB.milestones
    .where('goalId')
    .equals(goalId)
    .toArray();

  if (milestones.length === 0) return { adjusted: false, message: '目标无里程碑' };

  // 获取最近活跃里程碑中的原子项
  const activeMS = milestones.find((m) => m.status === 'active') ?? milestones[0];

  // 查询最近 6 天的原子项完成情况
  const today = new Date().toISOString().slice(0, 10);
  const sixDaysAgo = addDays(today, -5);

  const recentAtoms = await goalDB.dailyAtoms
    .where('scheduledDate')
    .between(sixDaysAgo, today, true, true)
    .toArray();

  if (recentAtoms.length < 6) return { adjusted: false, message: '数据不足（需至少6天记录）' };

  // 统计连续趋势
  let consecutiveOver = 0;
  let consecutiveUnder = 0;

  const sortedDays = [...new Set(recentAtoms.map((a) => a.scheduledDate).sort())];
  for (const day of sortedDays) {
    const dayAtoms = recentAtoms.filter((a) => a.scheduledDate === day);
    const allCompleted = dayAtoms.every((a) => a.isCompleted);
    const allOverCompleted = dayAtoms.every(
      (a) => a.isCompleted && safeNum(a.actualQuantity, a.quantity) > a.quantity
    );

    if (allOverCompleted) {
      consecutiveOver++;
      consecutiveUnder = 0;
    } else if (!allCompleted && dayAtoms.every((a) => !a.isCompleted)) {
      consecutiveUnder++;
      consecutiveOver = 0;
    } else {
      consecutiveOver = 0;
      consecutiveUnder = 0;
    }

    if (consecutiveOver >= 3) {
      // 上调 10%
      const current = recentAtoms[0]?.quantity ?? 1;
      const newQty = Math.min(Math.round(current * 1.1 * 10) / 10, current * 2);

      // 更新活跃里程碑下的原子项计划量
      const taskIds = new Set(
        (await goalDB.weeklyTasks.where('milestoneId').equals(activeMS.id).toArray())
          .map((t) => t.id)
      );
      const futureAtoms = await goalDB.dailyAtoms
        .where('scheduledDate')
        .above(today)
        .toArray();

      for (const atom of futureAtoms) {
        if (taskIds.has(atom.weeklyTaskId) && !atom.isCompleted) {
          await goalDB.dailyAtoms.update(atom.id, {
            quantity: newQty,
            updatedAt: new Date().toISOString(),
          });
        }
      }

      return { adjusted: true, message: `连续超额完成，每日量已从 ${current} 上调至 ${newQty}` };
    }

    if (consecutiveUnder >= 3) {
      const current = recentAtoms[0]?.quantity ?? 1;
      const newQty = Math.max(Math.round(current * 0.8 * 10) / 10, current * 0.3);

      const taskIds = new Set(
        (await goalDB.weeklyTasks.where('milestoneId').equals(activeMS.id).toArray())
          .map((t) => t.id)
      );
      const futureAtoms = await goalDB.dailyAtoms
        .where('scheduledDate')
        .above(today)
        .toArray();

      for (const atom of futureAtoms) {
        if (taskIds.has(atom.weeklyTaskId) && !atom.isCompleted) {
          await goalDB.dailyAtoms.update(atom.id, {
            quantity: newQty,
            updatedAt: new Date().toISOString(),
          });
        }
      }

      return { adjusted: true, message: `连续未完成，每日量已从 ${current} 下调至 ${newQty}` };
    }
  }

  return { adjusted: false, message: '无需调整' };
}

function safeNum(value: number | undefined | null, fallback: number): number {
  if (value == null || isNaN(value) || value < 0) return fallback;
  return value;
}
