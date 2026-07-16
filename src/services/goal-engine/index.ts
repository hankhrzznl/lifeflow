// ============================================================
// 目标拆解引擎 — 模块总导出
// 使用方法：
//   import { GoalEngine } from '@/services/goal-engine';
//   await GoalEngine.initialize();
//   const tree = await GoalEngine.getGoalTree(goalId);
// ============================================================

export { GoalEngine } from './GoalEngine';
export { goalDB, initializeGoalDB, clearGoalDB } from './schema';
export {
  rollupFromAtom,
  completeAtom,
  uncompleteAtom,
  recalculateAllForGoal,
  detectCycle,
  validateDependencies,
} from './RecalculationService';
export {
  getTemplateMetas,
  getTemplateMeta,
  generateTemplate,
  applyAdaptiveDifficulty,
} from './TemplateEngine';
export {
  checkGoalHealth,
  checkAllActiveGoalsHealth,
  generateSuggestions,
  detectConflicts,
  createProgressSnapshot,
  createAllSnapshots,
  getProgressTrend,
} from './EvolutionService';

// 类型重导出
export type {
  Goal,
  Milestone,
  WeeklyTask,
  DailyAtom,
  GoalProgressSnapshot,
  GoalTree,
  MilestoneWithChildren,
  WeeklyTaskWithChildren,
  TemplateParams,
  TemplateResult,
  TemplateMeta,
  RollupResult,
  RollupMetric,
  HealthScore,
  HealthStatus,
  AdjustmentSuggestion,
  ConflictReport,
  GoalCategory,
  GoalStatus,
  MilestoneStatus,
  WeeklyTaskStatus,
  AtomStatus,
  Priority,
} from '@/types/goal';

export {
  PRIORITY_LABELS,
  EBBINGHAUS_INTERVALS,
  TEMPLATE_DEFAULTS,
} from '@/types/goal';
