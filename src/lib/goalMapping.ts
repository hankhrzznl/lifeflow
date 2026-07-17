// ============================================================
// 主库 ↔ 引擎执行树 映射模块
//
// 映射规则（引擎定位落地阶段的语义核心）：
//
// 主库 Plan            → 引擎 Milestone
//   id          → mainPlanId          1:1 挂接
//   goalId      → goalId              String(goalId)
//   name        → title               直拷
//   startDate   → startDate           缺省 = 当日(本地)
//   endDate     → deadline            缺省 = 主库 Goal.deadline 转本地日期;再无则 startDate+30天
//   weight      → weight              同 goal 内按 plan.weight 归一化到总和 100;单 plan 时 = 100
//   order       → sortOrder           直拷
//   status      → (不同步)            milestone.status 由引擎按日期/回算自维护
//   progress    → ← 回写方向          milestone.progress → plan.progress, progressLocked 时跳过
//
// 主库 Task            → 引擎 DailyAtom
//   id          → mainTaskId          1:1 挂接
//   title       → title               直拷
//   dueDate??startTime → scheduledDate 本地时区格式化;两者都无 → 不生成 atom
//   status='done' → isCompleted=true  completedAt=updateAt ISO, 同步时对齐
//   (无对应)    → quantity=1         estimatedDuration=30, sortOrder 递增
//   (无对应)    → WeeklyTask         引擎内部"周容器":按(milestoneId,year,weekNumber)自动创建/复用
// ============================================================

import type { GoalCategory, Priority as EnginePriority } from "@/types/goal";
import type { Priority as MainPriority, GoalType } from "./types";

// ============================================================
// 日期工具（本地时区，严禁 toISOString 切割）
// ============================================================

/** 本地时区格式化 YYYY-MM-DD */
export function toLocalDateStr(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

/** 获取今天本地日期字符串 */
export function todayLocal(): string {
  return toLocalDateStr(new Date());
}

/** N 天前的本地日期字符串 */
export function daysAgoLocal(n: number): string {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return toLocalDateStr(d);
}

// ============================================================
// 类别映射
// ============================================================

/** 引擎 category → 主库 GoalType */
export function engineCategoryToGoalType(c: GoalCategory | string): GoalType {
  const map: Record<string, GoalType> = {
    exam: "task",
    fitness: "fitness",
    habit: "task",
    finance: "finance",
    custom: "task",
  };
  return map[c] ?? "task";
}

/** 主库 GoalType → 引擎 category */
export function goalTypeToEngineCategory(t: GoalType | string): GoalCategory {
  const map: Record<string, GoalCategory> = {
    task: "custom",
    fitness: "fitness",
    finance: "finance",
    sleep: "habit",
    water: "habit",
  };
  return (map[t] ?? "custom") as GoalCategory;
}

// ============================================================
// 优先级映射
// ============================================================

const PRIORITY_TO_ENGINE: Record<string, EnginePriority> = {
  "urgent-important": "p1",
  "not-urgent-important": "p2",
  "urgent-not-important": "p3",
  "not-urgent-not-important": "p4",
};

const PRIORITY_TO_MAIN: Record<string, MainPriority> = {
  p1: "urgent-important",
  p2: "not-urgent-important",
  p3: "urgent-not-important",
  p4: "not-urgent-not-important",
};

/** 主库 Priority → 引擎 Priority */
export function mainPriorityToEngine(p?: MainPriority): EnginePriority {
  return (p && PRIORITY_TO_ENGINE[p]) || "p2";
}

/** 引擎 Priority → 主库 Priority */
export function enginePriorityToMain(p: EnginePriority): MainPriority {
  return PRIORITY_TO_MAIN[p] ?? "not-urgent-not-important";
}

// ============================================================
// 截止日期映射
// ============================================================

/** 引擎 deadline (YYYY-MM-DD) → 主库时间戳 (当日 23:59:59) */
export function engineDeadlineToTs(s: string): number {
  return new Date(s + "T23:59:59").getTime();
}

/** 主库时间戳 → 本地日期字符串 */
export function tsToLocalDateStr(ts?: number): string | undefined {
  if (!ts) return undefined;
  return toLocalDateStr(new Date(ts));
}

// ============================================================
// ID 映射
// ============================================================

/** 主库 goalId (number) → 引擎 goalId (string) */
export function mainGoalKey(goalId: number): string {
  return String(goalId);
}

/** 引擎 goalId (string) → 主库 goalId (number)，非纯数字串返回 null */
export function parseMainGoalId(key: string): number | null {
  if (/^\d+$/.test(key)) return parseInt(key, 10);
  return null;
}

// ============================================================
// 状态（两侧同为 'active'|'completed'|'paused'|'archived'，直拷）
// 无需映射函数，仅在此注释声明。
// ============================================================

// ============================================================
// 主库 → 引擎 生成辅助
// ============================================================

/** 计算 ISO week number */
export function getISOWeekNumber(d: Date): { year: number; weekNumber: number } {
  const date = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
  date.setUTCDate(date.getUTCDate() + 4 - (date.getUTCDay() || 7));
  const yearStart = new Date(Date.UTC(date.getUTCFullYear(), 0, 1));
  const weekNumber = Math.ceil(((date.getTime() - yearStart.getTime()) / 86400000 + 1) / 7);
  return { year: date.getUTCFullYear(), weekNumber };
}

/** 获取所在周的周一本地日期 */
export function getMondayOfWeek(dateStr: string): string {
  const d = new Date(dateStr + "T00:00:00");
  const day = d.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  d.setDate(d.getDate() + diff);
  return toLocalDateStr(d);
}
