/**
 * GuideBrain — 新手引导引擎
 * 逐步式用户 onboarding 流程，进度持久化到 localStorage
 */

export interface GuideStep {
  id: string;
  title: string;
  description: string;
  order: number;
  completed: boolean;
}

const STORAGE_KEY = "lifeflow_guide_progress";

const DEFAULT_STEPS: Omit<GuideStep, "completed">[] = [
  { id: "welcome", title: "欢迎", description: "了解 LifeFlow 的核心功能", order: 0 },
  { id: "create_project", title: "创建项目", description: "设置你的第一个项目", order: 1 },
  { id: "create_goal", title: "设定目标", description: "创建你的第一个目标", order: 2 },
  { id: "add_task", title: "添加任务", description: "在目标下添加第一个任务", order: 3 },
  { id: "first_focus", title: "开始专注", description: "体验番茄钟专注模式", order: 4 },
  { id: "first_review", title: "首次回顾", description: "查看你的进度总结", order: 5 },
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
