/**
 * PlannerBrain — 目标拆解引擎
 * 将高层级目标分解为每日任务/原子计划
 */

import type { ScheduleTask } from "@/lib/db/efficiency.db";

// ---- 已有类型 ----

export interface GoalBreakdownParams {
  /** 拆解粒度：fine(日) | medium(周) | coarse(月) */
  granularity?: "fine" | "medium" | "coarse";
  /** 是否由 AI 辅助拆解 */
  aiAssisted?: boolean;
  /** 最多生成多少个原子任务 */
  maxTasks?: number;
}

export interface GoalInput {
  id?: number;
  name: string;
  description?: string;
  type?: string;
  deadline?: number;
}

export interface DailyAtom {
  title: string;
  type: "daily" | "habit" | "shortterm";
  weight: number;
  estimatedMinutes: number;
  planName: string;
}

export interface BreakdownResult {
  plans: { name: string; weight: number; order: number }[];
  atoms: DailyAtom[];
}

// ---- 新增类型 ----

export type StrategyType = 'exam' | 'fitness' | 'habit' | 'savings' | 'generic';

export interface StrategyResult {
  type: StrategyType;
  label: string;           // "备考策略"
  confidence: number;      // 0-100
  milestones: string[];    // 阶段名称列表
  totalWeeks: number;
}

// ---- 辅助函数 ----

function dateStr(start: Date, daysFromStart: number): string {
  const d = new Date(start);
  d.setDate(d.getDate() + daysFromStart);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

// ---- 关键词匹配 ----

function matchKeywords(title: string, keywords: string[]): boolean {
  const t = title.toLowerCase();
  return keywords.some(kw => t.includes(kw));
}

// ---- PlannerBrain ----

export class PlannerBrain {
  /**
   * 将单个目标拆解为 Plan + Task 树
   */
  breakdown(goal: GoalInput, params: GoalBreakdownParams = {}): BreakdownResult {
    // TODO: 实际逻辑 — 根据目标描述、截止日期、粒度参数生成 plan 层级结构
    // 优先调用 AI 拆解（aiAssisted=true），回退到模板匹配
    const { granularity = "fine" } = params;

    return {
      plans: [],
      atoms: [],
    };
  }

  /**
   * 分析目标标题，检测匹配的策略类型
   */
  analyze(title: string): StrategyResult {
    // Exam 策略
    const examKeywords = ['考研', '考试', '学习', '备考', '复习', '高考', '证书', '雅思', '托福', '笔试'];
    if (matchKeywords(title, examKeywords)) {
      return {
        type: 'exam',
        label: '备考策略',
        confidence: 85,
        milestones: ['准备阶段', '基础复习', '强化训练', '冲刺模拟'],
        totalWeeks: 16,
      };
    }

    // Fitness 策略
    const fitnessKeywords = ['减肥', '健身', '运动', '跑步', '瑜伽', '减脂', '增肌', '训练'];
    if (matchKeywords(title, fitnessKeywords)) {
      return {
        type: 'fitness',
        label: '健身策略',
        confidence: 85,
        milestones: ['适应期', '减脂期', '塑形期'],
        totalWeeks: 12,
      };
    }

    // Habit 策略
    const habitKeywords = ['习惯', '早起', '阅读', '冥想', '日记', '打卡', '每天'];
    if (matchKeywords(title, habitKeywords)) {
      return {
        type: 'habit',
        label: '习惯养成策略',
        confidence: 80,
        milestones: ['刻意期', '磨合期', '巩固期'],
        totalWeeks: 9,
      };
    }

    // Savings 策略
    const savingsKeywords = ['存款', '储蓄', '攒钱', '理财', '买房', '基金'];
    if (matchKeywords(title, savingsKeywords)) {
      return {
        type: 'savings',
        label: '储蓄策略',
        confidence: 80,
        milestones: ['预算制定', '减少非必要开支', '定期检查'],
        totalWeeks: 8,
      };
    }

    // Generic 默认策略
    return {
      type: 'generic',
      label: '通用策略',
      confidence: 60,
      milestones: ['规划阶段', '执行阶段', '复盘阶段'],
      totalWeeks: 6,
    };
  }

  /**
   * 根据策略生成具体的排程任务
   */
  generateTasks(strategy: StrategyResult, goalId: string, startDate?: string): Omit<ScheduleTask, 'id' | 'createdAt'>[] {
    const date = startDate || new Date().toISOString().slice(0, 10);
    const start = new Date(date + 'T00:00:00');

    switch (strategy.type) {
      case 'exam':
        return this.generateExamTasks(goalId, start);
      case 'fitness':
        return this.generateFitnessTasks(goalId, start);
      case 'habit':
        return this.generateHabitTasks(goalId, start);
      case 'savings':
        return this.generateSavingsTasks(goalId, start);
      default:
        return this.generateGenericTasks(goalId, start);
    }
  }

  // ---- Exam 策略 ----

  private generateExamTasks(goalId: string, start: Date): Omit<ScheduleTask, 'id' | 'createdAt'>[] {
    return [
      {
        title: "确定目标院校和专业", type: "single", goalId,
        date: dateStr(start, 0), isCompleted: false, plannedTime: 60, actualTime: 0,
        isImportant: true, note: "调研目标院校分数线、专业排名、报录比", progressType: "normal",
      },
      {
        title: "收集考试科目和资料", type: "multi_day", goalId, date: null,
        startDate: dateStr(start, 0), endDate: dateStr(start, 7),
        isCompleted: false, plannedTime: 120, actualTime: 0,
        isImportant: true, note: "收集教材、真题、笔记等资料", progressType: "normal",
      },
      {
        title: "制定复习计划表", type: "single", goalId,
        date: dateStr(start, 7), isCompleted: false, plannedTime: 90, actualTime: 0,
        isImportant: true, note: "制定每日/每周复习计划", progressType: "normal",
      },
      {
        title: "英语词汇第一轮", type: "multi_day", goalId, date: null,
        startDate: dateStr(start, 0), endDate: dateStr(start, 21),
        isCompleted: false, plannedTime: 60, actualTime: 0,
        isImportant: false, note: "每日背50个单词", progressType: "progress",
        taskDays: "everyday", targetValue: 2000, targetUnit: "词", startValue: 0, dailyMin: 50,
      },
      {
        title: "数学基础复习", type: "multi_day", goalId, date: null,
        startDate: dateStr(start, 0), endDate: dateStr(start, 35),
        isCompleted: false, plannedTime: 90, actualTime: 0,
        isImportant: false, note: "高数、线代、概率论基础", progressType: "normal",
      },
      {
        title: "专业课第一轮", type: "multi_day", goalId, date: null,
        startDate: dateStr(start, 14), endDate: dateStr(start, 42),
        isCompleted: false, plannedTime: 120, actualTime: 0,
        isImportant: false, note: "通读教材，做第一遍笔记", progressType: "progress",
        taskDays: "workday", targetValue: 100, targetUnit: "页", startValue: 0, dailyMin: 10,
      },
      {
        title: "政治基础学习", type: "multi_day", goalId, date: null,
        startDate: dateStr(start, 21), endDate: dateStr(start, 56),
        isCompleted: false, plannedTime: 60, actualTime: 0,
        isImportant: false, note: "马原、毛中特、史纲", progressType: "normal",
      },
      {
        title: "真题模拟训练", type: "multi_day", goalId, date: null,
        startDate: dateStr(start, 42), endDate: dateStr(start, 70),
        isCompleted: false, plannedTime: 180, actualTime: 0,
        isImportant: true, note: "每周做一套完整真题", progressType: "normal",
      },
    ];
  }

  // ---- Fitness 策略 ----

  private generateFitnessTasks(goalId: string, start: Date): Omit<ScheduleTask, 'id' | 'createdAt'>[] {
    return [
      // 适应期（第0-2周）
      {
        title: "体能评估与目标设定", type: "single", goalId,
        date: dateStr(start, 0), isCompleted: false, plannedTime: 30, actualTime: 0,
        isImportant: true, note: "测量体重、体脂、围度，设定目标值", progressType: "normal",
      },
      {
        title: "制定饮食计划", type: "single", goalId,
        date: dateStr(start, 1), isCompleted: false, plannedTime: 45, actualTime: 0,
        isImportant: true, note: "计算TDEE，制定每日热量与营养素配比", progressType: "normal",
      },
      {
        title: "低强度有氧训练", type: "multi_day", goalId, date: null,
        startDate: dateStr(start, 0), endDate: dateStr(start, 14),
        isCompleted: false, plannedTime: 30, actualTime: 0,
        isImportant: false, note: "快步走/慢跑30分钟，激活身体", progressType: "progress",
        taskDays: "everyday", targetValue: 14, targetUnit: "次", startValue: 0, dailyMin: 1,
      },
      {
        title: "基础力量入门", type: "multi_day", goalId, date: null,
        startDate: dateStr(start, 7), endDate: dateStr(start, 14),
        isCompleted: false, plannedTime: 40, actualTime: 0,
        isImportant: false, note: "自重训练：深蹲、俯卧撑、平板支撑", progressType: "normal",
      },
      // 减脂期（第2-8周）
      {
        title: "HIIT高强度间歇训练", type: "multi_day", goalId, date: null,
        startDate: dateStr(start, 14), endDate: dateStr(start, 56),
        isCompleted: false, plannedTime: 45, actualTime: 0,
        isImportant: true, note: "每周4次HIIT，每次30-45分钟", progressType: "normal",
      },
      {
        title: "力量训练分化", type: "multi_day", goalId, date: null,
        startDate: dateStr(start, 14), endDate: dateStr(start, 56),
        isCompleted: false, plannedTime: 60, actualTime: 0,
        isImportant: false, note: "推拉腿分化，每周3次", progressType: "normal",
      },
      {
        title: "每日热量追踪", type: "multi_day", goalId, date: null,
        startDate: dateStr(start, 14), endDate: dateStr(start, 56),
        isCompleted: false, plannedTime: 10, actualTime: 0,
        isImportant: false, note: "记录每餐热量摄入", progressType: "progress",
        taskDays: "everyday", targetValue: 42, targetUnit: "天", startValue: 0, dailyMin: 1,
      },
      // 塑形期（第8-12周）
      {
        title: "增肌塑形训练", type: "multi_day", goalId, date: null,
        startDate: dateStr(start, 56), endDate: dateStr(start, 84),
        isCompleted: false, plannedTime: 75, actualTime: 0,
        isImportant: true, note: "逐步增加重量，8-12RM训练", progressType: "normal",
      },
      {
        title: "体测与调整", type: "single", goalId,
        date: dateStr(start, 70), isCompleted: false, plannedTime: 30, actualTime: 0,
        isImportant: false, note: "重新测量身体数据，调整训练计划", progressType: "normal",
      },
    ];
  }

  // ---- Habit 策略 ----

  private generateHabitTasks(goalId: string, start: Date): Omit<ScheduleTask, 'id' | 'createdAt'>[] {
    return [
      // 刻意期（第0-3周）—— 刻意提醒、每天打卡
      {
        title: "设定习惯目标与触发点", type: "single", goalId,
        date: dateStr(start, 0), isCompleted: false, plannedTime: 30, actualTime: 0,
        isImportant: true, note: "明确习惯内容、时间、地点、前置触发动作", progressType: "normal",
      },
      {
        title: "每日打卡执行", type: "multi_day", goalId, date: null,
        startDate: dateStr(start, 0), endDate: dateStr(start, 21),
        isCompleted: false, plannedTime: 20, actualTime: 0,
        isImportant: true, note: "每天固定时间执行，用闹钟/APP提醒", progressType: "progress",
        taskDays: "everyday", targetValue: 21, targetUnit: "天", startValue: 0, dailyMin: 1,
      },
      {
        title: "移除环境阻力", type: "single", goalId,
        date: dateStr(start, 2), isCompleted: false, plannedTime: 60, actualTime: 0,
        isImportant: false, note: "清除干扰物、准备所需工具，降低执行门槛", progressType: "normal",
      },
      // 磨合期（第3-6周）
      {
        title: "习惯持续执行", type: "multi_day", goalId, date: null,
        startDate: dateStr(start, 21), endDate: dateStr(start, 42),
        isCompleted: false, plannedTime: 20, actualTime: 0,
        isImportant: false, note: "继续每日执行，感受变化", progressType: "progress",
        taskDays: "everyday", targetValue: 21, targetUnit: "天", startValue: 0, dailyMin: 1,
      },
      {
        title: "周度回顾调整", type: "multi_day", goalId, date: null,
        startDate: dateStr(start, 21), endDate: dateStr(start, 42),
        isCompleted: false, plannedTime: 15, actualTime: 0,
        isImportant: false, note: "每周回顾执行情况，微调时间或方式", progressType: "normal",
      },
      // 巩固期（第6-9周）
      {
        title: "习惯自动化执行", type: "multi_day", goalId, date: null,
        startDate: dateStr(start, 42), endDate: dateStr(start, 63),
        isCompleted: false, plannedTime: 15, actualTime: 0,
        isImportant: true, note: "逐步降低刻意提醒频率，让习惯自然融入生活", progressType: "progress",
        taskDays: "everyday", targetValue: 21, targetUnit: "天", startValue: 0, dailyMin: 1,
      },
      {
        title: "升级习惯难度", type: "single", goalId,
        date: dateStr(start, 49), isCompleted: false, plannedTime: 30, actualTime: 0,
        isImportant: false, note: "适当增加习惯强度或时长，挑战进阶版本", progressType: "normal",
      },
    ];
  }

  // ---- Savings 策略 ----

  private generateSavingsTasks(goalId: string, start: Date): Omit<ScheduleTask, 'id' | 'createdAt'>[] {
    return [
      // 预算制定
      {
        title: "盘点收入与固定支出", type: "single", goalId,
        date: dateStr(start, 0), isCompleted: false, plannedTime: 60, actualTime: 0,
        isImportant: true, note: "列出所有收入来源和每月固定支出项", progressType: "normal",
      },
      {
        title: "设定储蓄目标与预算上限", type: "single", goalId,
        date: dateStr(start, 1), isCompleted: false, plannedTime: 45, actualTime: 0,
        isImportant: true, note: "确定每月储蓄金额，制定分类预算上限", progressType: "normal",
      },
      {
        title: "开设专用储蓄账户", type: "single", goalId,
        date: dateStr(start, 3), isCompleted: false, plannedTime: 30, actualTime: 0,
        isImportant: false, note: "开通独立储蓄账户，设置自动转账", progressType: "normal",
      },
      // 减少非必要开支
      {
        title: "每日记账", type: "multi_day", goalId, date: null,
        startDate: dateStr(start, 0), endDate: dateStr(start, 56),
        isCompleted: false, plannedTime: 10, actualTime: 0,
        isImportant: true, note: "记录每一笔支出", progressType: "progress",
        taskDays: "everyday", targetValue: 56, targetUnit: "天", startValue: 0, dailyMin: 1,
      },
      {
        title: "审视订阅与固定支出", type: "single", goalId,
        date: dateStr(start, 7), isCompleted: false, plannedTime: 45, actualTime: 0,
        isImportant: false, note: "取消不必要的订阅服务，优化固定账单", progressType: "normal",
      },
      {
        title: "减少外食与冲动消费", type: "multi_day", goalId, date: null,
        startDate: dateStr(start, 7), endDate: dateStr(start, 35),
        isCompleted: false, plannedTime: 15, actualTime: 0,
        isImportant: false, note: "每周外食不超过2次，购物前冷静24小时", progressType: "normal",
      },
      // 定期检查
      {
        title: "月度财务复盘", type: "multi_day", goalId, date: null,
        startDate: dateStr(start, 28), endDate: dateStr(start, 56),
        isCompleted: false, plannedTime: 45, actualTime: 0,
        isImportant: true, note: "对比预算与实际支出，调整下月计划", progressType: "normal",
      },
      {
        title: "季度储蓄成果检验", type: "single", goalId,
        date: dateStr(start, 56), isCompleted: false, plannedTime: 60, actualTime: 0,
        isImportant: false, note: "检查累计储蓄金额是否达到阶段目标", progressType: "normal",
      },
    ];
  }

  // ---- Generic 策略 ----

  private generateGenericTasks(goalId: string, start: Date): Omit<ScheduleTask, 'id' | 'createdAt'>[] {
    const totalWeeks = 6;
    return [
      // 规划阶段（第1-2周）
      {
        title: "明确目标范围与定义", type: "single", goalId,
        date: dateStr(start, 0), isCompleted: false, plannedTime: 45, actualTime: 0,
        isImportant: true, note: "把目标具体化、可量化，写出SMART目标", progressType: "normal",
      },
      {
        title: "收集资源与信息", type: "multi_day", goalId, date: null,
        startDate: dateStr(start, 0), endDate: dateStr(start, 7),
        isCompleted: false, plannedTime: 60, actualTime: 0,
        isImportant: true, note: "搜集相关资料、工具、教程", progressType: "normal",
      },
      {
        title: "制定阶段计划", type: "single", goalId,
        date: dateStr(start, 7), isCompleted: false, plannedTime: 60, actualTime: 0,
        isImportant: true, note: "分阶段拆解目标，设定里程碑和截止日期", progressType: "normal",
      },
      // 执行阶段（第3-4周）
      {
        title: "第一阶段执行", type: "multi_day", goalId, date: null,
        startDate: dateStr(start, 14), endDate: dateStr(start, 28),
        isCompleted: false, plannedTime: 60, actualTime: 0,
        isImportant: false, note: "按计划推进，专注完成第一阶段任务", progressType: "progress",
        taskDays: "everyday", targetValue: 14, targetUnit: "天", startValue: 0, dailyMin: 1,
      },
      {
        title: "中期检查与调整", type: "single", goalId,
        date: dateStr(start, 21), isCompleted: false, plannedTime: 45, actualTime: 0,
        isImportant: false, note: "评估进度，根据实际情况微调后续计划", progressType: "normal",
      },
      // 复盘阶段（第5-6周）
      {
        title: "持续执行冲刺", type: "multi_day", goalId, date: null,
        startDate: dateStr(start, 28), endDate: dateStr(start, 42),
        isCompleted: false, plannedTime: 60, actualTime: 0,
        isImportant: false, note: "保持节奏，向最终目标冲刺", progressType: "normal",
      },
      {
        title: "复盘总结", type: "single", goalId,
        date: dateStr(start, 38), isCompleted: false, plannedTime: 60, actualTime: 0,
        isImportant: true, note: "总结完成情况、经验教训，沉淀方法论", progressType: "normal",
      },
    ];
  }
}

export const plannerBrain = new PlannerBrain();
