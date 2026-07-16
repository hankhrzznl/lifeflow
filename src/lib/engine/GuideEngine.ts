/**
 * 引导状态机 —— 新用户首次使用的交互式引导
 * 不是ML模型，是状态机。用户完成一步，进入下一步。
 */

export type GuideStepId = "welcome" | "explain" | "demo_assistant" | "create_first" | "checkin_tutorial" | "complete";

export interface GuideStep {
  id: GuideStepId;
  mascotState: "waiting" | "knitting" | "celebrating" | "confused";
  title: string;
  message: string;
  actionType: "none" | "highlight_assistant" | "highlight_fab" | "highlight_checkin" | "auto_open_dialog";
  canSkip: boolean;
  condition?: (ctx: GuideContext) => boolean;
}

export interface GuideContext {
  hasCreatedGoal: boolean;
  hasCheckedIn: boolean;
  assistantDialogUsed: boolean;
  currentPage: string;
}

const STEPS: GuideStep[] = [
  {
    id: "welcome", mascotState: "celebrating", title: "欢迎来到LifeFlow",
    message: "嗨！我是小织，你的人生管理搭档。我会帮你把大目标拆解成每天能做的小事。",
    actionType: "none", canSkip: false,
  },
  {
    id: "explain", mascotState: "waiting", title: "核心理念",
    message: "「把模糊的人生愿望，拆解为今天可以执行的具体动作」。无论是考研、减肥、存钱，我都会帮你一步步拆解。",
    actionType: "none", canSkip: true,
  },
  {
    id: "demo_assistant", mascotState: "knitting", title: "试试跟小织说话",
    message: "你可以直接跟我说「我想3个月后考研」，我就能听懂并帮你创建目标。试试看？",
    actionType: "auto_open_dialog", canSkip: true,
    condition: (ctx) => !ctx.assistantDialogUsed,
  },
  {
    id: "create_first", mascotState: "waiting", title: "创建第一个目标",
    message: "或者点击右下角的「+」按钮，选择一个模板，小织会帮你自动生成完整的计划。",
    actionType: "highlight_fab", canSkip: false,
    condition: (ctx) => !ctx.hasCreatedGoal,
  },
  {
    id: "checkin_tutorial", mascotState: "knitting", title: "每日打卡",
    message: "目标创建后，每天打开「今天」页面，完成任务后点击编织checkbox打卡。进度会自动回算。",
    actionType: "highlight_checkin", canSkip: true,
    condition: (ctx) => ctx.hasCreatedGoal && !ctx.hasCheckedIn,
  },
  {
    id: "complete", mascotState: "celebrating", title: "准备开始",
    message: "你已经准备好了！记住：小织会一直陪着你。遇到困难随时跟我聊~",
    actionType: "none", canSkip: false,
  },
];

export class GuideEngine {
  private STORAGE_KEY = "lifeflow_guide_progress";
  private completedSteps: GuideStepId[] = [];

  constructor() { this.loadProgress(); }

  /** 获取当前应该显示的步骤 */
  getCurrentStep(ctx: GuideContext): GuideStep | null {
    if (ctx.hasCreatedGoal && ctx.hasCheckedIn) return null;
    if (this.completedSteps.includes("complete")) return null;

    for (const step of STEPS) {
      if (this.completedSteps.includes(step.id)) continue;
      if (step.condition && !step.condition(ctx)) {
        this.completedSteps.push(step.id);
        continue;
      }
      return step;
    }
    return null;
  }

  markComplete(stepId: GuideStepId): void {
    if (!this.completedSteps.includes(stepId)) {
      this.completedSteps.push(stepId);
      this.saveProgress();
    }
  }

  isGuiding(ctx: GuideContext): boolean {
    return this.getCurrentStep(ctx) !== null;
  }

  reset(): void {
    this.completedSteps = [];
    localStorage.removeItem(this.STORAGE_KEY);
  }

  private loadProgress(): void {
    try {
      const raw = localStorage.getItem(this.STORAGE_KEY);
      if (raw) this.completedSteps = JSON.parse(raw);
    } catch { /* ignore */ }
  }

  private saveProgress(): void {
    localStorage.setItem(this.STORAGE_KEY, JSON.stringify(this.completedSteps));
  }
}

export const guideEngine = new GuideEngine();
