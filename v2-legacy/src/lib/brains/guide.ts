/**
 * GuideBrain — 新手引导引擎（T10）
 * 主线路径：目标 → 日程 → 复盘（新用户 3 步理解 Life OS 核心闭环）
 * 进度持久化到 localStorage
 */

export interface GuideStep {
  id: string;
  title: string;
  description: string;
  path: string;   // 主线步骤目标页
  order: number;
  completed: boolean;
}

const STORAGE_KEY = "lifeflow_guide_progress";

const DEFAULT_STEPS: Omit<GuideStep, "completed">[] = [
  { id: "goal", title: "设立目标", description: "用五层拆解，把大目标拆成每天可做的行动", path: "/efficiency-v2", order: 0 },
  { id: "schedule", title: "安排日程", description: "把行动排进时间轴，到点专注执行", path: "/efficiency/schedule", order: 1 },
  { id: "review", title: "复盘成长", description: "每日每周复盘，让进步可见", path: "/longtermism", order: 2 },
];

function loadProgress(): string[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? (JSON.parse(raw) as string[]) : [];
  } catch {
    return [];
  }
}

function saveProgress(completedIds: string[]): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(completedIds));
}

export class GuideBrain {
  private steps: GuideStep[];

  constructor() {
    const completedIds = loadProgress();
    this.steps = DEFAULT_STEPS.map((s) => ({
      ...s,
      completed: completedIds.includes(s.id),
    }));
  }

  /**
   * 获取当前需要引导的步骤（首个未完成的步骤）
   */
  getCurrentStep(): GuideStep | null {
    const next = this.steps.find((s) => !s.completed);
    return next ?? null;
  }

  /**
   * 标记某个步骤为已完成
   */
  markStep(id: string): void {
    const step = this.steps.find((s) => s.id === id);
    if (step && !step.completed) {
      step.completed = true;
      saveProgress(this.steps.filter((s) => s.completed).map((s) => s.id));
    }
  }

  /**
   * 标记全部步骤完成（用户明确关闭引导）
   */
  completeAll(): void {
    this.steps.forEach((s) => (s.completed = true));
    saveProgress(this.steps.map((s) => s.id));
  }

  /**
   * 是否所有步骤都已完成
   */
  isComplete(): boolean {
    return this.steps.every((s) => s.completed);
  }

  /** 获取所有步骤（含完成状态） */
  getAllSteps(): GuideStep[] {
    return [...this.steps];
  }

  /** 重置全部引导进度 */
  reset(): void {
    this.steps.forEach((s) => (s.completed = false));
    saveProgress([]);
  }
}
