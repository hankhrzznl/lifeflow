// ============================================================
// 备考模板 — 四阶段拆解 + 艾宾浩斯复习 + 难度自适应
// ============================================================

import { templateEngine, TemplateDefinition } from '../TemplateEngine';
import type { EngineGoal, EngineMilestone, EngineWeeklyTask, EngineDailyAtom } from '../types';
import { EBBINGHAUS_INTERVALS } from '../types';

// ============================================================
// 参数类型
// ============================================================

interface ExamParams {
  examDate: string;             // ISO date, 考试日期
  subjects: string[];           // 科目数组 ['数学','英语','政治']
  dailyStudyHours: number;      // 每日学习时长（默认6）
  difficulty: 'easy' | 'medium' | 'hard';
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

function daysBetween(d1: string, d2: string): number {
  const a = new Date(d1 + 'T00:00:00');
  const b = new Date(d2 + 'T00:00:00');
  return Math.ceil((b.getTime() - a.getTime()) / 86400000);
}

/** ISO date → YYYY-MM-DD */
function toDateStr(d: Date): string {
  return d.toISOString().slice(0, 10);
}

// ============================================================
// 备考模板定义
// ============================================================

const PHASE_CONFIG = [
  { label: '基础期', ratio: 0.40, weight: 35 },
  { label: '强化期', ratio: 0.30, weight: 30 },
  { label: '冲刺期', ratio: 0.20, weight: 25 },
  { label: '模考期', ratio: 0.10, weight: 10 },
] as const;

const DIFFICULTY_MODIFIER: Record<string, number> = {
  easy: 0.8,
  medium: 1.0,
  hard: 1.2,
};

export const examTemplate: TemplateDefinition = {
  id: 'exam',
  name: '备考冲刺',
  description: '四阶段备考计划：基础→强化→冲刺→模考，含艾宾浩斯遗忘曲线复习',
  icon: 'graduation-cap',
  category: 'exam',
  parameters: [
    { key: 'examDate', label: '考试日期', type: 'date', required: true, hint: 'Y/M/D' },
    { key: 'subjects', label: '考试科目', type: 'multi-select', required: true,
      options: [
        { value: '数学', label: '数学' }, { value: '英语', label: '英语' },
        { value: '政治', label: '政治' }, { value: '专业课一', label: '专业课一' },
        { value: '专业课二', label: '专业课二' }, { value: '语文', label: '语文' },
      ],
      hint: '可多选' },
    { key: 'dailyStudyHours', label: '每日学习时长(小时)', type: 'number', required: false,
      defaultValue: 6, placeholder: '6', hint: '建议 4-8 小时' },
    { key: 'difficulty', label: '目标难度', type: 'select', required: false,
      options: [
        { value: 'easy', label: '轻松（量 ×0.8）' },
        { value: 'medium', label: '标准（默认）' },
        { value: 'hard', label: '地狱模式（量 ×1.2）' },
      ],
      defaultValue: 'medium', hint: '影响每日任务量' },
  ],

  generateBlueprint(params: Record<string, unknown>) {
    const p = params as unknown as ExamParams;
    const today = toDateStr(new Date());
    const totalDays = daysBetween(today, p.examDate);
    const hours = p.dailyStudyHours || 6;
    const modifier = DIFFICULTY_MODIFIER[p.difficulty] ?? 1.0;
    const subjects = p.subjects || ['默认科目'];

    // ── 1. Goal ──
    const goal: GoalData = {
      title: `${subjects.join('、')}备考`,
      description: `${p.subjects.join('、')}备考计划，距考试${totalDays}天，每日${hours}小时`,
      category: 'exam',
      priority: 'p1',
      deadline: p.examDate,
      templateId: 'exam',
      successCriteria: `各科目完成四阶段备考，通过${p.examDate}考试`,
    };

    // ── 2. Milestones ──
    const milestones: MsData[] = [];
    const phaseWeeks: number[] = [];

    for (const phase of PHASE_CONFIG) {
      const phaseDays = Math.round(totalDays * phase.ratio);
      const weeks = Math.max(1, Math.ceil(phaseDays / 7));
      phaseWeeks.push(weeks);

      const startIdx = milestones.length === 0 ? 0 :
        milestones.reduce((s, m, i) => {
          return s + (phaseWeeks[i - 1] ?? 0) * 7;
        }, 0);

      milestones.push({
        goalId: '', // 占位，实际创建时填充
        title: phase.label,
        description: `${phase.label}：${weeks}周`,
        startDate: addDays(today, milestones.length === 0 ? 0 :
          phaseWeeks.slice(0, milestones.length).reduce((a, b) => a + b, 0) * 7 - phaseWeeks[milestones.length - 1] * 7),
        deadline: addDays(today, Math.min(
          phaseWeeks.slice(0, milestones.length + 1).reduce((a, b) => a + b, 0) * 7 - 1,
          totalDays
        )),
        weight: phase.weight,
        sortOrder: milestones.length,
      });
    }

    // ── 3. WeeklyTasks + 4. DailyAtoms ──
    const weeklyTasks: WtData[] = [];
    const dailyAtoms: AtomData[][] = [];

    for (let pi = 0; pi < PHASE_CONFIG.length; pi++) {
      const weeks = phaseWeeks[pi];
      let phaseStart = addDays(today, 0);
      if (pi > 0) {
        phaseStart = addDays(today, phaseWeeks.slice(0, pi).reduce((a, b) => a + b, 0) * 7);
      }

      for (let w = 0; w < weeks; w++) {
        const weekStart = addDays(phaseStart, w * 7);
        const weekEnd = addDays(weekStart, 6);

        for (const subject of subjects) {
          const atoms: AtomData[] = [];
          const subjectTaskTitle = `${PHASE_CONFIG[pi].label} W${w + 1} - ${subject}`;

          // 每日主学习任务
          let sortOrder = 0;
          const dayCount = pi === PHASE_CONFIG.length - 1
            ? Math.min(7, daysBetween(weekStart, p.examDate) + 1)
            : 7;

          for (let d = 0; d < dayCount; d++) {
            const date = addDays(weekStart, d);
            // 基础期内每科目每天1-2节；后期增加
            const dailyLessons = Math.round(
              (pi === 0 ? 1.5 : pi === 1 ? 2 : pi === 2 ? 2.5 : 2) * modifier
            );

            atoms.push({
              weeklyTaskId: '',
              title: `${subject} 第${Math.ceil((w * 7 + d + 1) / 7)}周-day${d + 1} (${dailyLessons}节)`,
              scheduledDate: date,
              quantity: dailyLessons,
              estimatedDuration: Math.round(hours * 60 / subjects.length),
              sortOrder: sortOrder++,
            });

            // 艾宾浩斯复习任务（向前回溯复习已学内容的日期）
            for (const interval of EBBINGHAUS_INTERVALS) {
              const reviewDate = addDays(date, interval);
              if (reviewDate <= p.examDate) {
                atoms.push({
                  weeklyTaskId: '',
                  title: `${subject} 艾宾浩斯复习 (D+${interval})`,
                  scheduledDate: reviewDate,
                  quantity: 1,
                  estimatedDuration: Math.round(hours * 60 / subjects.length * 0.3),
                  sortOrder: sortOrder++,
                });
              }
            }
          }

          const taskQuantity = dayCount * Math.round(
            (pi === 0 ? 1.5 : pi === 1 ? 2 : pi === 2 ? 2.5 : 2) * modifier
          );

          weeklyTasks.push({
            milestoneId: '',
            title: subjectTaskTitle,
            plannedStart: weekStart,
            plannedEnd: weekEnd,
            quantityTarget: taskQuantity,
            quantityUnit: '节',
            weight: Math.round(100 / subjects.length),
            sortOrder: weeklyTasks.length,
          });

          dailyAtoms.push(atoms);
        }
      }
    }

    return { goal, milestones, weeklyTasks, dailyAtoms };
  },
};

// 注册到引擎
templateEngine.register(examTemplate);
