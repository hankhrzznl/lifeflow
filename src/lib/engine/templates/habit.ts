// ============================================================
// 习惯养成模板 — 21天/66天周期 + 阶段性里程碑
// ============================================================

import { templateEngine, TemplateDefinition } from '../TemplateEngine';
import type { EngineGoal, EngineMilestone, EngineWeeklyTask, EngineDailyAtom } from '../types';

// ============================================================
// 参数类型
// ============================================================

interface HabitParams {
  habitName: string;         // 习惯名称
  duration: 21 | 66;         // 21天 or 66天
  dailyReminder?: string;    // 每日提醒时间 "08:00"
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

// ============================================================
// 阶段配置
// ============================================================

function getHabitPhases(duration: 21 | 66): {
  label: string; weight: number; startDay: number; endDay: number; intensity: string;
}[] {
  if (duration === 21) {
    return [
      { label: '启动期', weight: 40, startDay: 1, endDay: 7, intensity: '轻量（易完成）' },
      { label: '巩固期', weight: 60, startDay: 8, endDay: 21, intensity: '标准量' },
    ];
  }
  return [
    { label: '启动期', weight: 25, startDay: 1, endDay: 7, intensity: '轻量' },
    { label: '巩固期', weight: 30, startDay: 8, endDay: 21, intensity: '标准量' },
    { label: '稳定期', weight: 25, startDay: 22, endDay: 42, intensity: '标准量' },
    { label: '自动化期', weight: 20, startDay: 43, endDay: 66, intensity: '标准量' },
  ];
}

// ============================================================
// 模板定义
// ============================================================

export const habitTemplate: TemplateDefinition = {
  id: 'habit',
  name: '习惯养成',
  description: '科学习惯养成周期：启动→巩固(→稳定→自动化)，支持21天/66天',
  icon: 'repeat',
  category: 'habit',
  parameters: [
    { key: 'habitName', label: '习惯名称', type: 'string', required: true,
      placeholder: '如：每日阅读、早起', hint: '要养成的习惯' },
    { key: 'duration', label: '养成周期', type: 'select', required: false,
      options: [
        { value: '21', label: '21天速成' },
        { value: '66', label: '66天固化' },
      ],
      defaultValue: '21', hint: '习惯形成平均需要66天' },
    { key: 'dailyReminder', label: '每日提醒时间', type: 'string', required: false,
      placeholder: '08:00', hint: '可选' },
  ],

  generateBlueprint(params: Record<string, unknown>) {
    const p = params as unknown as HabitParams;
    const today = toDateStr(new Date());
    const duration: 21 | 66 = (p.duration === 66 ? 66 : 21) as 21 | 66;
    const habitName = p.habitName || '新习惯';

    const phases = getHabitPhases(duration);
    const deadline = addDays(today, duration - 1);

    // ── 1. Goal ──
    const goal: GoalData = {
      title: `养成习惯：${habitName}`,
      description: `${duration}天${habitName}养成计划，分${phases.length}个阶段`,
      category: 'habit',
      priority: 'p2',
      deadline,
      templateId: 'habit',
      successCriteria: `连续${duration}天完成${habitName}，形成自动化习惯`,
    };

    // ── 2. Milestones ──
    const milestones: MsData[] = [];
    for (const phase of phases) {
      milestones.push({
        goalId: '',
        title: phase.label,
        description: `第${phase.startDay}~${phase.endDay}天 · ${phase.intensity}`,
        startDate: addDays(today, phase.startDay - 1),
        deadline: addDays(today, phase.endDay - 1),
        weight: phase.weight,
        sortOrder: milestones.length,
      });
    }

    // ── 3. WeeklyTasks + 4. DailyAtoms ──
    const weeklyTasks: WtData[] = [];
    const dailyAtoms: AtomData[][] = [];
    const totalWeeks = Math.ceil(duration / 7);

    for (let w = 0; w < totalWeeks; w++) {
      const weekStart = addDays(today, w * 7);
      const weekEnd = addDays(weekStart, 6);
      const atoms: AtomData[] = [];
      let sortOrder = 0;

      for (let d = 0; d < 7; d++) {
        const dayOffset = w * 7 + d;
        if (dayOffset >= duration) break;

        const date = addDays(today, dayOffset);
        const dayNum = dayOffset + 1;

        // 查找当前日期属于哪个阶段
        const currentPhase = phases.find(
          (ph) => dayNum >= ph.startDay && dayNum <= ph.endDay
        );
        const intensity = currentPhase?.intensity ?? '标准量';

        const suffix = dayNum === 7 ? '第1周达成' :
          dayNum === 21 ? '21天里程碑' :
          dayNum === 42 ? '42天里程碑' :
          dayNum === 66 ? '66天达成' :
          '';

        const title = suffix ? `${habitName} Day ${dayNum} (${suffix})` : `${habitName} Day ${dayNum}`;

        atoms.push({
          weeklyTaskId: '',
          title,
          scheduledDate: date,
          quantity: 1,
          estimatedDuration: 30,
          sortOrder: sortOrder++,
        });
      }

      const weekStartDay = w * 7 + 1;
      const weekEndDay = Math.min((w + 1) * 7, duration);
      const wtTitle = `${habitName} 第${w + 1}周 (Day ${weekStartDay}-${weekEndDay})`;

      weeklyTasks.push({
        milestoneId: '',
        title: wtTitle,
        plannedStart: weekStart,
        plannedEnd: weekEnd,
        quantityTarget: Math.min(7, duration - w * 7),
        quantityUnit: '天/周',
        weight: Math.round(100 / totalWeeks),
        sortOrder: w,
      });

      dailyAtoms.push(atoms);
    }

    return { goal, milestones, weeklyTasks, dailyAtoms };
  },
};

templateEngine.register(habitTemplate);
