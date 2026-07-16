// ============================================================
// 目标拆解引擎 — 完整 TypeScript 类型定义
// 对应四级数据模型：Goal → Milestone → WeeklyTask → DailyAtom
// ============================================================

// ==================== 枚举类型 ====================

/** 目标类别 */
export type GoalCategory = 'exam' | 'fitness' | 'habit' | 'finance' | 'custom';

/** 优先级 */
export type Priority = 'p1' | 'p2' | 'p3' | 'p4';

/** 目标状态 */
export type GoalStatus = 'active' | 'completed' | 'paused' | 'archived';

/** 里程碑状态 */
export type MilestoneStatus = 'pending' | 'active' | 'completed' | 'overdue';

/** 周度任务状态 */
export type WeeklyTaskStatus = 'pending' | 'active' | 'completed' | 'overdue' | 'paused';

/** 原子项状态 */
export type AtomStatus = 'pending' | 'completed' | 'overdue' | 'skipped';

/** 目标健康度 */
export type HealthStatus = 'green' | 'yellow' | 'red';

/** 模板类别（与 GoalCategory 对应） */
export type TemplateCategory = GoalCategory;

// ==================== 核心数据模型接口 ====================

/**
 * L1 总目标
 * 代表用户的一个长期目标，如"考研数学 120 分"、"减脂 10 斤"
 */
export interface Goal {
  id: string;
  title: string;
  description: string;
  category: GoalCategory;
  priority: Priority;
  deadline: string;           // ISO date YYYY-MM-DD
  progress: number;           // 0-100，由回算自动维护
  status: GoalStatus;
  templateId?: string;        // 来源模板 ID
  successCriteria?: string;   // 成功标准
  healthStatus?: HealthStatus; // 由演化引擎自动维护
  createdAt: string;          // ISO datetime
  updatedAt: string;          // ISO datetime
}

/**
 * L2 里程碑
 * 目标的阶段性节点，有明确的交付物和验收标准
 */
export interface Milestone {
  id: string;
  goalId: string;
  title: string;
  description?: string;
  startDate: string;          // ISO date
  deadline: string;           // ISO date
  weight: number;             // 1-100，同一 Goal 下所有 Milestone 权重之和 = 100
  progress: number;           // 0-100，由回算自动维护
  status: MilestoneStatus;
  deliverable?: string;       // 交付物描述
  acceptanceCriteria?: string;// 验收标准
  dependencies?: string[];    // 前置里程碑 ID 列表（循环依赖检测用）
  sortOrder: number;
  createdAt: string;
  updatedAt: string;
}

/**
 * L3 周度任务
 * 里程碑下的以周为单位的执行任务，携带量化目标和单位
 */
export interface WeeklyTask {
  id: string;
  milestoneId: string;
  title: string;
  weekNumber: number;         // ISO week 1-53
  year: number;               // 年份
  plannedStart: string;       // ISO date
  plannedEnd: string;         // ISO date
  quantityTarget: number;     // 量化目标总量
  quantityUnit: string;       // 量化单位（"节", "道", "次", "kg"）
  weight: number;             // 在该 Milestone 内所占权重（同一 Milestone 下总和 = 100）
  progress: number;           // 0-100，由回算自动维护
  status: WeeklyTaskStatus;
  sortOrder: number;
  createdAt: string;
  updatedAt: string;
}

/**
 * L4 原子项
 * 每日执行的最小粒度任务，是最底层的执行单元
 */
export interface DailyAtom {
  id: string;
  weeklyTaskId: string;
  title: string;
  scheduledDate: string;      // ISO date YYYY-MM-DD
  quantity: number;           // 计划量（默认 1）
  actualQuantity?: number;    // 实际完成量
  estimatedDuration?: number; // 预估耗时（分钟）
  isCompleted: boolean;
  completedAt?: string;       // ISO datetime
  checkInId?: string;         // 关联的打卡记录 ID
  status: AtomStatus;
  sortOrder: number;
  createdAt: string;
  updatedAt: string;
}

/**
 * 目标进度快照
 * 每周日 23:59 自动快照，用于周复盘环比分析
 */
export interface GoalProgressSnapshot {
  id: string;                 // 格式: "snap_{goalId}_{year}w{weekNumber}"
  goalId: string;
  year: number;
  weekNumber: number;
  progress: number;           // 快照时的进度
  totalAtoms: number;         // 本周总原子项数
  completedAtoms: number;     // 本周已完成数
  snapshotDate: string;       // ISO datetime
  reviewId?: string;          // 关联的复盘记录 ID
}

// ==================== 模板相关类型 ====================

/** 模板元数据 */
export interface TemplateMeta {
  id: string;
  name: string;
  description: string;
  category: TemplateCategory;
  icon: string;
  usageCount: number;         // 模板使用次数
}

/** 模板参数（用户输入） */
export interface TemplateParams {
  goalTitle: string;
  goalDescription?: string;
  deadline: string;           // ISO date
  priority?: Priority;
  // 备考模板专属
  examSubject?: string;
  dailyStudyHours?: number;
  baseLevel?: 'beginner' | 'intermediate' | 'advanced';
  targetScore?: string;
  // 运动模板专属
  targetWeightKg?: number;
  weeklyWorkouts?: number;
  // 习惯模板专属
  habitType?: string;
  // 存款模板专属
  monthlyTarget?: number;
}

/** 模板生成结果 */
export interface TemplateResult {
  goal: Omit<Goal, 'id' | 'progress' | 'status' | 'healthStatus' | 'createdAt' | 'updatedAt'>;
  milestones: Omit<Milestone, 'id' | 'goalId' | 'progress' | 'status' | 'createdAt' | 'updatedAt'>[];
  weeklyTasks: Omit<WeeklyTask, 'id' | 'milestoneId' | 'progress' | 'status' | 'createdAt' | 'updatedAt'>[];
  dailyAtoms: Omit<DailyAtom, 'id' | 'weeklyTaskId' | 'isCompleted' | 'status' | 'createdAt' | 'updatedAt'>[];
}

// ==================== 回算相关类型 ====================

/** 回算结果 */
export interface RollupResult {
  goalId: string;
  goalProgress: number;
  milestoneProgress: number;
  weeklyTaskProgress: number;
  elapsedMs: number;          // 实际耗时（用于性能监控）
}

/** 回算性能记录 */
export interface RollupMetric {
  atomId: string;
  elapsedMs: number;
  exceededThreshold: boolean; // 是否超过 500ms
  timestamp: string;
}

// ==================== 演化引擎相关类型 ====================

/** 健康度评分 */
export interface HealthScore {
  goalId: string;
  overallStatus: HealthStatus;
  completionScore: number;    // 完成率得分 0-100
  overdueScore: number;       // 逾期率得分 0-100
  trendScore: number;         // 趋势得分 0-100
  finalScore: number;         // 综合得分 0-100
  details: string[];          // 评分明细描述
}

/** 调整建议 */
export interface AdjustmentSuggestion {
  id: string;
  goalId: string;
  type: 'granularity_reduce' | 'priority_reorder' | 'milestone_extend' | 'accelerate' | 'flex_day';
  title: string;
  description: string;
  urgency: number;            // 0-100，越高越紧急
  suggestedAction: string;
  autoApplicable: boolean;    // 是否支持一键应用
}

/** 冲突检测结果 */
export interface ConflictReport {
  type: 'time_overlap' | 'capacity_exceed' | 'deadline_conflict';
  severity: 'warning' | 'critical';
  description: string;
  suggestedAction: string;
}

// ==================== 查询相关类型 ====================

/** 完整目标树 */
export interface GoalTree {
  goal: Goal;
  milestones: MilestoneWithChildren[];
}

/** 带子节点的里程碑 */
export interface MilestoneWithChildren extends Milestone {
  weeklyTasks: WeeklyTaskWithChildren[];
}

/** 带子节点的周度任务 */
export interface WeeklyTaskWithChildren extends WeeklyTask {
  dailyAtoms: DailyAtom[];
}

// ==================== 优先级配置 ====================

export const PRIORITY_LABELS: Record<Priority, { label: string; color: string }> = {
  p1: { label: '紧急重要', color: '#EF4444' },
  p2: { label: '重要不紧急', color: '#3B82F6' },
  p3: { label: '紧急不重要', color: '#F59E0B' },
  p4: { label: '不紧急不重要', color: '#9CA3AF' },
};

/** 艾宾浩斯复习间隔（天数） */
export const EBBINGHAUS_INTERVALS = [1, 2, 4, 7, 15] as const;

/** 模板默认配置 */
export const TEMPLATE_DEFAULTS = {
  exam: {
    milestoneCount: 4,
    weights: [35, 30, 25, 10],
    labels: ['基础阶段', '强化阶段', '冲刺阶段', '模考阶段'],
  },
  fitness: {
    milestoneCount: 4,
    weights: [15, 45, 25, 15],
    labels: ['适应期', '减脂期', '塑形期', '维持期'],
  },
  habit: {
    milestoneCount: 3,
    weights: [40, 30, 30],
    labels: ['刻意期', '磨合期', '巩固期'],
  },
  finance: {
    defaultMonths: 4,
    label: '第{n}月储蓄',
  },
} as const;
