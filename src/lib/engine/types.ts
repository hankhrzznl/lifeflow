// ============================================================
// 四级拆解引擎 — 核心类型定义
// 
// 数据模型：L1 目标 → L2 里程碑 → L3 周任务 → L4 每日原子项
//
// 注意：所有类型均使用 Engine 前缀，避免与主库 lib/types.ts 
//       中的 Goal/Plan/Task 命名冲突。
// ============================================================

// ==================== 枚举类型 ====================

/** 目标类别 */
export type EngineGoalCategory = 'exam' | 'fitness' | 'habit' | 'finance' | 'custom';

/** 目标优先级 */
export type EngineGoalPriority = 'p1' | 'p2' | 'p3' | 'p4';

/** 目标状态 */
export type EngineGoalStatus = 'active' | 'completed' | 'paused' | 'archived';

/** 里程碑状态 */
export type EngineMilestoneStatus = 'pending' | 'active' | 'completed' | 'overdue';

/** 原子项状态 */
export type EngineAtomStatus = 'pending' | 'completed' | 'overdue' | 'skipped';

/** 快照类型 */
export type EngineSnapshotType = 'weekly' | 'manual' | 'milestone';

// ==================== 核心数据接口 ====================

/**
 * L1 目标
 * 
 * 与主库 Goal 的核心区别：
 * - id 使用 UUID 字符串而非自增 number，支持离线创建与同步
 * - 新增 category / templateId / successCriteria 等拆解专属字段
 * - deadline 使用 ISO 日期字符串，与主库 timestamp(ms) 不同
 * - 不含 projectId（引擎目标独立于项目层级）
 */
export interface EngineGoal {
  id: string;                    // UUID v4
  title: string;
  description: string;
  category: EngineGoalCategory;
  priority: EngineGoalPriority;
  deadline: string;              // ISO date YYYY-MM-DD
  progress: number;              // 0-100，由回算自动维护
  status: EngineGoalStatus;
  templateId?: string;           // 来源模板 ID（用于模板统计）
  successCriteria?: string;      // 成功标准描述
  healthStatus?: 'green' | 'yellow' | 'red';
  createdAt: string;             // ISO datetime
  updatedAt: string;
}

/**
 * L2 里程碑
 * 
 * 对应主库 Plan 的角色，但有本质差异：
 * - 引入 weight（权重）用于加权进度回算
 * - 引入 deliverable / acceptanceCriteria 描述交付物和验收标准
 * - 引入 dependencies 支持里程碑间的依赖关系
 * - startDate/deadline 使用 ISO 日期字符串
 */
export interface EngineMilestone {
  id: string;                    // UUID v4
  goalId: string;                // 父目标 ID
  title: string;
  description?: string;
  startDate: string;             // ISO date
  deadline: string;              // ISO date
  weight: number;                // 1-100，同一 Goal 下所有权重之和 = 100
  progress: number;              // 0-100，由回算自动维护
  status: EngineMilestoneStatus;
  deliverable?: string;          // 交付物描述
  acceptanceCriteria?: string;   // 验收标准
  dependencies?: string[];       // 前置里程碑 ID 列表
  sortOrder: number;
  createdAt: string;
  updatedAt: string;
}

/**
 * L3 周任务
 * 
 * 里程碑下的以周为单位的执行任务。
 * 与主库 Task 的核心区别：
 * - 携带量化目标（quantityTarget + unit）
 * - 按 ISO 周号（weekNumber）组织
 * - 使用 weight 计算在里程碑内的贡献度
 */
export interface EngineWeeklyTask {
  id: string;                    // UUID v4
  milestoneId: string;           // 父里程碑 ID
  title: string;
  weekNumber: number;            // ISO week 1-53
  year: number;                  // 年份
  plannedStart: string;          // ISO date
  plannedEnd: string;            // ISO date
  quantityTarget: number;        // 量化目标总量
  quantityUnit: string;          // 量化单位（"节"、"道"、"次"、"kg"）
  weight: number;                // 在同一 Milestone 内的权重（总和 = 100）
  progress: number;              // 0-100，由回算自动维护
  status: EngineMilestoneStatus; // 复用里程碑状态枚举
  sortOrder: number;
  createdAt: string;
  updatedAt: string;
}

/**
 * L4 每日原子项
 * 
 * 最底层的每日执行单元。
 * 这是四级模型与旧系统的关键差异——旧系统 Task 没有日粒度管理。
 * 
 * 与 checkInId 的关联：
 * - 原子项完成时，引擎通过 migrate 桥接层在主库 tasks 表创建打卡记录
 * - checkInId 存储主库 Task 的 id（number → string），用于双向追溯
 */
export interface EngineDailyAtom {
  id: string;                    // UUID v4
  weeklyTaskId: string;          // 父周任务 ID
  title: string;
  scheduledDate: string;         // ISO date YYYY-MM-DD
  quantity: number;              // 计划量（默认 1）
  actualQuantity?: number;       // 实际完成量（部分完成时填写）
  estimatedDuration?: number;    // 预估耗时（分钟）
  isCompleted: boolean;
  completedAt?: string;          // ISO datetime
  score?: number;                // 习惯评分 1-10（打卡后填写）
  note?: string;                 // 打卡备注
  checkInId?: string;            // 关联的主库打卡记录 ID（linkage 桥接用）
  status: EngineAtomStatus;
  sortOrder: number;
  createdAt: string;
  updatedAt: string;
}

/**
 * 进度快照
 * 
 * 用于复盘环比分析。
 * 快照类型：
 * - weekly: 每周日 23:59 自动快照
 * - milestone: 里程碑完成时手动快照
 * - manual: 用户主动触发
 */
export interface EngineProgressSnapshot {
  id: string;                    // 格式: "snap_{goalId}_{year}w{weekNumber}"
  goalId: string;
  year: number;
  weekNumber: number;
  progress: number;              // 快照时的进度
  totalAtoms: number;            // 当周总原子项数
  completedAtoms: number;        // 当周已完成数
  snapshotDate: string;          // ISO datetime
  reviewId?: string;             // 关联的复盘记录 ID
  type: EngineSnapshotType;
}

// ==================== 模板参数接口 ====================

/** 基础模板参数（所有模板共用） */
export interface EngineTemplateParams {
  goalTitle: string;
  goalDescription?: string;
  deadline: string;              // ISO date
  priority?: EngineGoalPriority;
}

/** 备考模板专属参数 */
export interface EngineExamTemplateParams extends EngineTemplateParams {
  examSubject?: string;          // 考试科目
  dailyStudyHours?: number;      // 每日学习时长（默认4小时）
  baseLevel?: 'beginner' | 'intermediate' | 'advanced';
  targetScore?: string;          // 目标分数
}

/** 运动减脂模板专属参数 */
export interface EngineFitnessTemplateParams extends EngineTemplateParams {
  targetWeightKg?: number;       // 目标体重(kg)
  weeklyWorkouts?: number;       // 每周训练次数（默认4次）
}

/** 习惯养成模板专属参数 */
export interface EngineHabitTemplateParams extends EngineTemplateParams {
  habitType?: string;            // 习惯类型名称（"早起"、"阅读"等）
  totalDays?: number;            // 养成周期天数（默认21天）
}

/** 存款记账模板专属参数 */
export interface EngineSavingsTemplateParams extends EngineTemplateParams {
  monthlyTarget?: number;        // 月度储蓄目标(元)
}

// ==================== 查询/聚合类型 ====================

/** 带子节点的里程碑 */
export interface EngineMilestoneWithChildren extends EngineMilestone {
  weeklyTasks: EngineWeeklyTaskWithChildren[];
}

/** 带子节点的周任务 */
export interface EngineWeeklyTaskWithChildren extends EngineWeeklyTask {
  dailyAtoms: EngineDailyAtom[];
}

/** 完整目标树 */
export interface EngineGoalTree {
  goal: EngineGoal;
  milestones: EngineMilestoneWithChildren[];
}

// ==================== 默认配置 ====================

/** 优先级标签 */
export const ENGINE_PRIORITY_LABELS: Record<EngineGoalPriority, { label: string; color: string }> = {
  p1: { label: '紧急重要', color: '#EF4444' },
  p2: { label: '重要不紧急', color: '#3B82F6' },
  p3: { label: '紧急不重要', color: '#F59E0B' },
  p4: { label: '不紧急不重要', color: '#9CA3AF' },
};

/** 艾宾浩斯复习间隔（天数） */
export const EBBINGHAUS_INTERVALS = [1, 2, 4, 7, 15] as const;

/** 模板默认配置 */
export const ENGINE_TEMPLATE_DEFAULTS = {
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
