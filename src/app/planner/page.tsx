"use client";

import { useState, useEffect, useCallback, useRef, Suspense } from "react";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import {
  LayoutDashboard, FolderKanban, Inbox,
  Plus, X, ChevronDown, Target, CalendarDays, ClipboardList,
  MoreHorizontal, Play, Pause, Archive, Trash2, Filter, ArrowUpDown, EyeOff, Eye,
  Circle, CheckCircle2, CheckSquare, Square, Lock, AlertTriangle
} from "lucide-react";
import { useSearchParams } from "next/navigation";
import {
  getAllProjectsV2, createProjectV2, updateProjectV2, deleteProjectV2,
  getTasksByType, deleteGoal, deletePlan, updateGoal, updatePlan, assignTasksToPlan,
  getAllGoals, getAllPlans, createGoal, createPlan
} from "@/lib/db";
import { completeTask, uncompleteTask, batchCompleteTasks, batchDeleteTasks } from "@/lib/linkage";
import { showToast } from "@/components/ui/Toast";
import ActionSheet from "@/components/ui/ActionSheet";
import TodayTab from "./TodayTab";
import type { ProjectV2, Goal, Plan, Task, GoalStatus, Priority } from "@/lib/types";
import { PRIORITY_CONFIG } from "@/lib/types";

const COLORS = ["#007AFF", "#34C759", "#FF9500", "#FF3B30", "#AF52DE", "#5856D6"];

type PlannerTab = "pending" | "today";

const PLANNER_TABS: { key: PlannerTab; label: string; desc: string; icon: typeof LayoutDashboard }[] = [
  { key: "pending", label: "安排", desc: "项目列表 · 分类处理任务", icon: FolderKanban },
  { key: "today", label: "今日", desc: "今天要做的事", icon: LayoutDashboard },
];

const STATUS_FILTERS = [
  { value: "all", label: "全部" },
  { value: "active", label: "进行中" },
  { value: "paused", label: "已暂停" },
  { value: "completed", label: "已完成" },
];

const PRIORITY_FILTERS = [
  { value: "all", label: "全部" },
  { value: "urgent-important", label: "重要且紧急" },
  { value: "not-urgent-important", label: "重要不紧急" },
  { value: "urgent-not-important", label: "不重要但紧急" },
  { value: "not-urgent-not-important", label: "不重要不紧急" },
];

const SORT_OPTIONS = [
  { value: "created", label: "创建时间" },
  { value: "deadline", label: "截止日期" },
  { value: "progress", label: "进度" },
];

function getPriorityLabel(priority: Priority): string {
  const config = PRIORITY_CONFIG.find(p => p.key === priority);
  return config?.label || "未设置";
}

function getPriorityColor(priority: Priority): string {
  const config = PRIORITY_CONFIG.find(p => p.key === priority);
  return config ? `${config.bg} ${config.color}` : "bg-gray-100 dark:bg-gray-800 text-gray-600";
}

function getStatusStyle(status: GoalStatus): string {
  const map: Record<string, string> = {
    active: "border-gray-200 dark:border-gray-700",
    completed: "border-green-200 dark:border-green-800",
    paused: "border-gray-300 dark:border-gray-600 opacity-60",
    archived: "border-gray-300 dark:border-gray-600 opacity-50",
  };
  return map[status] || map.active;
}

function getStatusBadge(status: GoalStatus): string {
  const map: Record<string, string> = {
    active: "bg-green-50 dark:bg-green-900/20 text-green-600",
    completed: "bg-green-100 dark:bg-green-900/30 text-green-700",
    paused: "bg-gray-100 dark:bg-gray-800 text-gray-600",
    archived: "bg-gray-200 dark:bg-gray-700 text-gray-500",
  };
  return map[status] || map.active;
}

function getStatusLabel(status: GoalStatus): string {
  const map: Record<string, string> = {
    active: "进行中",
    completed: "已完成",
    paused: "已暂停",
    archived: "已归档",
  };
  return map[status] || map.active;
}

interface GoalWithPlans {
  goal: Goal;
  plans: PlanWithTasks[];
}

interface PlanWithTasks {
  plan: Plan;
  tasks: Task[];
}

/** 移动端(粗指针)检测:触屏无 hover,⋯ 菜单需改用 ActionSheet */
function useIsCoarsePointer(): boolean {
  const [isCoarse, setIsCoarse] = useState(false);
  useEffect(() => {
    const mql = window.matchMedia("(pointer: coarse)");
    // eslint-disable-next-line react-hooks/set-state-in-effect -- 订阅媒体查询前需先同步一次当前匹配值,属必要
    setIsCoarse(mql.matches);
    const handler = (e: MediaQueryListEvent) => setIsCoarse(e.matches);
    mql.addEventListener("change", handler);
    return () => mql.removeEventListener("change", handler);
  }, []);
  return isCoarse;
}

/** 项目筛选条 chip:颜色点 + 名称;桌面端悬浮 ⋯ / 右键打开操作,移动端小图标常驻 */
function ProjectChip({
  project,
  active,
  showMenuButton,
  onClick,
  onMenu,
}: {
  project: ProjectV2;
  active: boolean;
  showMenuButton: boolean;
  onClick: () => void;
  onMenu: () => void;
}) {
  return (
    <div
      onContextMenu={(e) => { e.preventDefault(); onMenu(); }}
      className={`group flex items-center shrink-0 rounded-full border transition-colors ${
        active
          ? "border-indigo-300 dark:border-indigo-700 bg-indigo-50 dark:bg-indigo-900/20"
          : "border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 hover:border-gray-300 dark:hover:border-gray-600"
      }`}
    >
      <button
        onClick={onClick}
        className={`flex items-center gap-1.5 pl-3 pr-1 py-1.5 text-xs ${
          active ? "text-indigo-700 dark:text-indigo-300 font-medium" : "text-gray-700 dark:text-gray-300"
        }`}
      >
        <span className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: project.color || "#9CA3AF" }} />
        <span className="max-w-[120px] truncate">{project.name}</span>
      </button>
      <button
        onClick={(e) => { e.stopPropagation(); onMenu(); }}
        aria-label="项目操作"
        className={`pr-2 py-1.5 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-opacity ${
          showMenuButton ? "" : "opacity-0 group-hover:opacity-100"
        }`}
      >
        <MoreHorizontal className="w-3.5 h-3.5" />
      </button>
    </div>
  );
}

function TaskItem({
  task,
  onToggle,
  planStatus,
  batchMode,
  isSelected,
  onToggleSelect,
}: {
  task: Task;
  onToggle: (id: number) => void;
  planStatus: GoalStatus;
  batchMode?: boolean;
  isSelected?: boolean;
  onToggleSelect?: () => void;
}) {
  const isPaused = planStatus === "paused";

  return (
    <div
      className={`flex items-start gap-2.5 px-3 py-2 rounded-xl ${
        isPaused ? "opacity-60" : "hover:bg-gray-50 dark:hover:bg-gray-800"
      }`}
    >
      {batchMode && (
        <button
          onClick={(e) => { e.stopPropagation(); onToggleSelect?.(); }}
          className="mt-0.5 shrink-0"
        >
          {isSelected ? (
            <CheckSquare className="w-5 h-5 text-indigo-500" />
          ) : (
            <Square className="w-5 h-5 text-gray-400" />
          )}
        </button>
      )}
      <button
        onClick={() => !isPaused && onToggle(task.id!)}
        className={`mt-0.5 shrink-0 ${isPaused ? "cursor-not-allowed" : ""}`}
      >
        {task.status === "done" ? (
          <CheckCircle2 className="w-4 h-4 text-green-500" />
        ) : (
          <Circle className="w-4 h-4 text-gray-300 dark:text-gray-600" />
        )}
      </button>
      <div className="flex-1 min-w-0">
        <p className={`text-sm ${task.status === "done" ? "text-gray-400 line-through" : "text-gray-800 dark:text-gray-200"}`}>
          {task.title}
        </p>
        {task.dueDate && (
          <span className="text-[10px] text-gray-400">{new Date(task.dueDate).toLocaleDateString("zh-CN")}</span>
        )}
      </div>
      {task.priority && (
        <span className={`text-[10px] px-1.5 py-0.5 rounded ${getPriorityColor(task.priority)}`}>
          {getPriorityLabel(task.priority)}
        </span>
      )}
    </div>
  );
}

function PlanCard({
  planWithTasks,
  goalStatus,
  onToggleTask,
  onEdit,
  onDelete,
  onToggleStatus,
  onArchive,
  isExpanded,
  onToggleExpand,
  batchMode,
  selectedTaskIds,
  onToggleTaskSelection,
  onEnterBatchMode,
  onExitBatchMode,
  onBatchComplete,
  onBatchDelete,
}: {
  planWithTasks: PlanWithTasks;
  goalStatus: GoalStatus;
  onToggleTask: (id: number) => void;
  onEdit: () => void;
  onDelete: () => void;
  onToggleStatus: () => void;
  onArchive: () => void;
  isExpanded: boolean;
  onToggleExpand: () => void;
  batchMode?: boolean;
  selectedTaskIds?: Set<number>;
  onToggleTaskSelection?: (taskId: number) => void;
  onEnterBatchMode?: () => void;
  onExitBatchMode?: () => void;
  onBatchComplete?: () => void;
  onBatchDelete?: () => void;
}) {
  const { plan, tasks } = planWithTasks;
  const isPaused = goalStatus === "paused" || plan.status === "paused";
  const doneCount = tasks.filter(t => t.status === "done").length;
  const progress = tasks.length > 0 ? Math.round((doneCount / tasks.length) * 100) : 0;
  const isUnlocked = plan.isUnlocked !== false;

  return (
    <motion.div
      initial={{ opacity: 0, y: 4 }}
      animate={{ opacity: 1, y: 0 }}
      className={`bg-white dark:bg-gray-900 rounded-xl border ${getStatusStyle(plan.status)} ${isPaused ? "opacity-60" : ""} ${!isUnlocked ? "opacity-60 grayscale" : ""}`}
    >
      <div className="p-3">
        <div className="flex items-center gap-2">
          <button
            onClick={onToggleExpand}
            className="p-1 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg"
          >
            <ChevronDown className={`w-4 h-4 text-gray-400 transition-transform ${isExpanded ? "rotate-180" : ""}`} />
          </button>

          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <span className="text-sm font-medium text-gray-800 dark:text-gray-200 truncate">{plan.name}</span>
              <span className={`text-[10px] px-1.5 py-0.5 rounded ${getStatusBadge(plan.status)}`}>
                {getStatusLabel(plan.status)}
              </span>
            </div>

            {!isUnlocked && (
              <div className="flex items-center gap-1 text-xs text-amber-500 mt-1">
                <Lock className="w-3 h-3" /> 待解锁 — 需完成前置计划
              </div>
            )}

            <div className="flex items-center gap-3 mt-1.5">
              <span className="text-xs text-gray-400">
                {plan.startDate && plan.endDate
                  ? `${plan.startDate} - ${plan.endDate}`
                  : "无日期"}
              </span>
            </div>

            <div className="mt-2">
              <div className="flex items-center justify-between mb-1">
                <span className="text-xs text-gray-400">进度</span>
                <span className="text-xs font-medium text-gray-600 dark:text-gray-400">{progress}%</span>
              </div>
              <div className="h-1.5 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
                <motion.div
                  initial={{ width: 0 }}
                  animate={{ width: `${progress}%` }}
                  transition={{ duration: 0.5 }}
                  className="h-full rounded-full bg-indigo-500"
                />
              </div>
            </div>
          </div>

          <button className="p-1.5 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg relative group">
            <MoreHorizontal className="w-4 h-4 text-gray-400" />
            <div className="absolute right-0 top-full mt-1 w-32 bg-white dark:bg-gray-800 rounded-lg shadow-lg border border-gray-100 dark:border-gray-700 opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all z-10">
              <button onClick={onEdit} className="w-full px-3 py-2 text-xs text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 flex items-center gap-2">
                <EditIcon className="w-3 h-3" /> 编辑
              </button>
              <button onClick={onToggleStatus} className="w-full px-3 py-2 text-xs text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 flex items-center gap-2">
                {plan.status === "active" ? <Pause className="w-3 h-3" /> : <Play className="w-3 h-3" />}
                {plan.status === "active" ? "暂停" : "恢复"}
              </button>
              <button onClick={onArchive} className="w-full px-3 py-2 text-xs text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 flex items-center gap-2">
                <Archive className="w-3 h-3" /> 归档
              </button>
              <div className="border-t border-gray-100 dark:border-gray-700 my-1" />
              <button onClick={onDelete} className="w-full px-3 py-2 text-xs text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 flex items-center gap-2">
                <Trash2 className="w-3 h-3" /> 删除
              </button>
            </div>
          </button>
        </div>
      </div>

      <AnimatePresence>
        {isExpanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="overflow-hidden border-t border-gray-100 dark:border-gray-800"
          >
            <div className="p-3 pt-1 space-y-1">
              {/* 批量操作工具栏 */}
              <div className="flex justify-end mb-1">
                {!batchMode ? (
                  <button
                    onClick={() => onEnterBatchMode?.()}
                    className="text-xs text-gray-400 hover:text-indigo-500 transition-colors"
                  >
                    批量操作
                  </button>
                ) : (
                  <div className="flex items-center gap-2">
                    <button onClick={() => onExitBatchMode?.()} className="text-xs text-gray-400">取消</button>
                    <span className="text-xs text-gray-500">已选 {selectedTaskIds?.size || 0}</span>
                    {(selectedTaskIds?.size ?? 0) > 0 && (
                      <>
                        <button onClick={() => onBatchComplete?.()} className="text-xs px-2 py-1 bg-green-100 text-green-700 rounded-lg">完成</button>
                        <button onClick={() => onBatchDelete?.()} className="text-xs px-2 py-1 bg-red-100 text-red-700 rounded-lg">删除</button>
                      </>
                    )}
                  </div>
                )}
              </div>
              {tasks.length > 0 ? (
                tasks.map(task => (
                  <TaskItem
                    key={task.id}
                    task={task}
                    onToggle={onToggleTask}
                    planStatus={plan.status}
                    batchMode={batchMode}
                    isSelected={selectedTaskIds?.has(task.id!)}
                    onToggleSelect={() => onToggleTaskSelection?.(task.id!)}
                  />
                ))
              ) : (
                <p className="text-xs text-gray-400 py-2 text-center">暂无任务</p>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}

const EditIcon = ({ className }: { className?: string }) => (
  <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
    <path d="M17 3a2.85 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z" />
    <path d="m15 5 4 4" />
  </svg>
);

function GoalCard({
  goalWithPlans,
  project,
  onToggleTask,
  onEdit,
  onDelete,
  onToggleStatus,
  onArchive,
  isExpanded,
  onToggleExpand,
  onTagClick,
  onMoreClick,
  onEditPlan,
  onDeletePlan,
  onTogglePlanStatus,
  onArchivePlan,
  expandedPlanIds,
  onTogglePlanExpand,
  onAddPlan,
  batchMode,
  selectedTaskIds,
  onToggleTaskSelection,
  onEnterBatchMode,
  onExitBatchMode,
  onBatchComplete,
  onBatchDelete,
}: {
  goalWithPlans: GoalWithPlans;
  project?: ProjectV2;
  onToggleTask: (id: number) => void;
  onEdit: () => void;
  onDelete: () => void;
  onToggleStatus: () => void;
  onArchive: () => void;
  isExpanded: boolean;
  onToggleExpand: () => void;
  onTagClick: () => void;
  /** 提供时 ⋯ 按钮改为点击回调(移动端 ActionSheet);缺省保持桌面下拉 */
  onMoreClick?: () => void;
  batchMode?: boolean;
  selectedTaskIds?: Set<number>;
  onToggleTaskSelection?: (taskId: number) => void;
  onEnterBatchMode?: () => void;
  onExitBatchMode?: () => void;
  onBatchComplete?: () => void;
  onBatchDelete?: () => void;
  onEditPlan: (plan: Plan) => void;
  onDeletePlan: (planId: number) => void;
  onTogglePlanStatus: (planId: number) => void;
  onArchivePlan: (planId: number) => void;
  expandedPlanIds: Set<number>;
  onTogglePlanExpand: (planId: number) => void;
  onAddPlan: (goalId: number) => void;
}) {
  const { goal, plans } = goalWithPlans;
  const isPaused = goal.status === "paused";

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      className={`bg-white dark:bg-gray-900 rounded-xl border ${getStatusStyle(goal.status)} ${isPaused ? "opacity-60" : ""}`}
    >
      <div className="p-4">
        <div className="flex items-center gap-3">
          <button
            onClick={onToggleExpand}
            className="p-1.5 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg"
          >
            <ChevronDown className={`w-5 h-5 text-gray-400 transition-transform ${isExpanded ? "rotate-180" : ""}`} />
          </button>

          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <span className="text-sm font-semibold text-gray-800 dark:text-gray-200 truncate">{goal.name}</span>
              {goal.warningLevel === "danger" && <AlertTriangle className="w-3 h-3 text-red-500" />}
              {goal.warningLevel === "warning" && <AlertTriangle className="w-3 h-3 text-amber-500" />}
              <span className={`text-[10px] px-1.5 py-0.5 rounded ${getStatusBadge(goal.status)}`}>
                {getStatusLabel(goal.status)}
              </span>
              {goal.priority && (
                <span className={`text-[10px] px-1.5 py-0.5 rounded ${getPriorityColor(goal.priority)}`}>
                  {getPriorityLabel(goal.priority)}
                </span>
              )}
            </div>

            <div className="flex items-center gap-3 mt-1.5">
              {goal.deadline && (
                <span className="text-xs text-gray-400 flex items-center gap-1">
                  <CalendarDays className="w-3 h-3" />
                  截止 {new Date(goal.deadline).toLocaleDateString("zh-CN")}
                </span>
              )}
              <span className="text-xs text-gray-400">权重: {goal.weight}</span>
              {goal.progressLocked && (
                <span className="text-xs px-1.5 py-0.5 rounded bg-amber-50 dark:bg-amber-900/20 text-amber-600">
                  进度锁定
                </span>
              )}
            </div>

            <div className="mt-2.5">
              <div className="flex items-center justify-between mb-1">
                <span className="text-xs text-gray-400">进度</span>
                <span className="text-xs font-medium text-gray-600 dark:text-gray-400">{goal.progress}%</span>
              </div>
              <div className="h-2 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
                <motion.div
                  initial={{ width: 0 }}
                  animate={{ width: `${goal.progress}%` }}
                  transition={{ duration: 0.5 }}
                  className="h-full rounded-full bg-indigo-500"
                />
              </div>
            </div>

            <div className="flex items-center gap-2 mt-2">
              <button
                onClick={(e) => { e.stopPropagation(); onTagClick(); }}
                title="更换所属项目"
                className="flex items-center gap-1.5 text-[10px] px-2 py-0.5 rounded-full bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors"
              >
                <span className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: project?.color || "#9CA3AF" }} />
                {project?.name || "无项目"}
              </button>
              <span className="text-xs text-gray-400">{plans.length} 个计划</span>
            </div>
          </div>

          {onMoreClick ? (
            <button
              onClick={onMoreClick}
              className="p-2 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg"
              aria-label="更多操作"
            >
              <MoreHorizontal className="w-4 h-4 text-gray-400" />
            </button>
          ) : (
          <button className="p-2 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg relative group">
            <MoreHorizontal className="w-4 h-4 text-gray-400" />
            <div className="absolute right-0 top-full mt-1 w-32 bg-white dark:bg-gray-800 rounded-lg shadow-lg border border-gray-100 dark:border-gray-700 opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all z-10">
              <button onClick={onEdit} className="w-full px-3 py-2 text-xs text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 flex items-center gap-2">
                <EditIcon className="w-3 h-3" /> 编辑
              </button>
              <button onClick={onToggleStatus} className="w-full px-3 py-2 text-xs text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 flex items-center gap-2">
                {goal.status === "active" ? <Pause className="w-3 h-3" /> : <Play className="w-3 h-3" />}
                {goal.status === "active" ? "暂停" : "恢复"}
              </button>
              <button onClick={onArchive} className="w-full px-3 py-2 text-xs text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 flex items-center gap-2">
                <Archive className="w-3 h-3" /> 归档
              </button>
              <div className="border-t border-gray-100 dark:border-gray-700 my-1" />
              <button onClick={onDelete} className="w-full px-3 py-2 text-xs text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 flex items-center gap-2">
                <Trash2 className="w-3 h-3" /> 删除
              </button>
            </div>
          </button>
          )}
        </div>
      </div>

      <AnimatePresence>
        {isExpanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="overflow-hidden border-t border-gray-100 dark:border-gray-800"
          >
            <div className="p-4 pt-2 space-y-2">
              {plans.length > 0 ? (
                plans.map(pwt => (
                  <PlanCard
                    key={pwt.plan.id}
                    planWithTasks={pwt}
                    goalStatus={goal.status}
                    onToggleTask={onToggleTask}
                    onEdit={() => onEditPlan(pwt.plan)}
                    onDelete={() => onDeletePlan(pwt.plan.id!)}
                    onToggleStatus={() => onTogglePlanStatus(pwt.plan.id!)}
                    onArchive={() => onArchivePlan(pwt.plan.id!)}
                    isExpanded={expandedPlanIds.has(pwt.plan.id!)}
                    onToggleExpand={() => onTogglePlanExpand(pwt.plan.id!)}
                    batchMode={batchMode}
                    selectedTaskIds={selectedTaskIds}
                    onToggleTaskSelection={onToggleTaskSelection}
                    onEnterBatchMode={onEnterBatchMode}
                    onExitBatchMode={onExitBatchMode}
                    onBatchComplete={onBatchComplete}
                    onBatchDelete={onBatchDelete}
                  />
                ))
              ) : (
                <p className="text-xs text-gray-400 py-2 text-center">暂无计划</p>
              )}

              {goal.status !== "paused" && goal.status !== "archived" && (
                <button
                  onClick={() => onAddPlan(goal.id!)}
                  className="w-full flex items-center justify-center gap-1 py-2 text-xs text-indigo-500 hover:text-indigo-600 transition-colors"
                >
                  <Plus className="w-3 h-3" />
                  快速添加计划
                </button>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}

function UnclassifiedPanel({
  tasks,
  onToggleTask,
  onAssign,
  isExpanded,
  onToggleExpand,
}: {
  tasks: Task[];
  onToggleTask: (id: number) => void;
  onAssign: (taskId: number) => void;
  isExpanded: boolean;
  onToggleExpand: () => void;
}) {
  return (
    <div className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-100 dark:border-gray-800 shadow-sm overflow-hidden">
      <button
        onClick={onToggleExpand}
        className="w-full flex items-center gap-4 p-4 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors"
      >
        <div className="w-12 h-12 rounded-xl bg-gray-100 dark:bg-gray-800 flex items-center justify-center">
          <Inbox className="w-6 h-6 text-gray-400" />
        </div>
        <div className="flex-1 text-left">
          <p className="text-sm font-semibold text-gray-900 dark:text-white">未分类任务</p>
          <p className="text-xs text-gray-400">暂无归属的任务 ({tasks.length})</p>
        </div>
        {tasks.length > 0 && (
          <span className="inline-flex items-center justify-center min-w-[22px] h-[22px] px-1.5 text-[11px] font-bold text-white bg-violet-500 rounded-full">
            {tasks.length}
          </span>
        )}
        <ChevronDown className={`w-4 h-4 text-gray-300 transition-transform ${isExpanded ? "rotate-180" : ""}`} />
      </button>

      <AnimatePresence>
        {isExpanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="overflow-hidden border-t border-gray-100 dark:border-gray-800"
          >
            <div className="p-4 space-y-2">
              {tasks.length > 0 ? (
                tasks.map(task => (
                  <div key={task.id} className="flex items-start gap-3 p-3 bg-gray-50 dark:bg-gray-800 rounded-xl">
                    <button onClick={() => onToggleTask(task.id!)} className="mt-0.5">
                      {task.status === "done" ? (
                        <CheckCircle2 className="w-4 h-4 text-green-500" />
                      ) : (
                        <Circle className="w-4 h-4 text-gray-300 dark:text-gray-600" />
                      )}
                    </button>
                    <div className="flex-1 min-w-0">
                      <p className={`text-sm ${task.status === "done" ? "text-gray-400 line-through" : "text-gray-800 dark:text-gray-200"}`}>
                        {task.title}
                      </p>
                    </div>
                    <button
                      onClick={() => onAssign(task.id!)}
                      className="p-1.5 text-xs bg-indigo-50 dark:bg-indigo-900/20 text-indigo-600 rounded-lg hover:bg-indigo-100"
                    >
                      分配
                    </button>
                  </div>
                ))
              ) : (
                <p className="text-xs text-gray-400 py-4 text-center">暂无未分类任务</p>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

function GanttView({
  goals, projects, ganttPeriod, setGanttPeriod,
}: {
  goals: GoalWithPlans[]; projects: ProjectV2[]; ganttPeriod: "week" | "month"; setGanttPeriod: (p: "week" | "month") => void;
}) {
  const daysToShow = ganttPeriod === "week" ? 7 : 30;
  const today = new Date();
  const startDate = new Date(today.getFullYear(), today.getMonth(), today.getDate() - 3);

  const dates: Date[] = [];
  for (let i = 0; i < daysToShow; i++) {
    const d = new Date(startDate);
    d.setDate(startDate.getDate() + i);
    dates.push(d);
  }

  const cellWidth = ganttPeriod === "week" ? 44 : 18;

  const getBarStyle = (goal: Goal, plan?: Plan) => {
    const planStart = plan?.startDate ? new Date(plan.startDate + "T00:00:00") : new Date(goal.createdAt);
    const planEnd = plan?.endDate ? new Date(plan.endDate + "T23:59:59") : goal.deadline ? new Date(goal.deadline) : new Date(today.getTime() + 14 * 24 * 60 * 60 * 1000);
    
    const totalDays = Math.max(1, Math.ceil((planEnd.getTime() - planStart.getTime()) / (24 * 60 * 60 * 1000)));
    const startOffset = Math.max(0, Math.ceil((planStart.getTime() - startDate.getTime()) / (24 * 60 * 60 * 1000)));
    const width = Math.max(1, Math.ceil((planEnd.getTime() - planStart.getTime()) / (24 * 60 * 60 * 1000)));
    
    return { startOffset, width, totalDays };
  };

  return (
    <div className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-100 dark:border-gray-800 shadow-sm overflow-hidden">
      <div className="flex items-center justify-between p-3 border-b border-gray-100 dark:border-gray-800">
        <span className="text-sm font-semibold text-gray-700 dark:text-gray-300">时间线视图</span>
        <select value={ganttPeriod} onChange={(e) => setGanttPeriod(e.target.value as "week" | "month")} className="text-xs bg-gray-100 dark:bg-gray-800 rounded-lg px-2 py-1">
          <option value="week">周视图</option>
          <option value="month">月视图</option>
        </select>
      </div>
      <div className="overflow-x-auto">
        <div style={{ minWidth: dates.length * cellWidth + 120 }}>
          {/* Date header */}
          <div className="flex border-b border-gray-100 dark:border-gray-800">
            <div className="w-[120px] shrink-0 p-2 text-xs text-gray-400">项目/目标</div>
            {dates.map((d, i) => (
              <div key={i} className="text-center text-[10px] text-gray-400 py-2 border-l border-gray-50 dark:border-gray-800" style={{ width: cellWidth }}>
                {ganttPeriod === "week" ? ["日","一","二","三","四","五","六"][d.getDay()] : d.getDate()}
              </div>
            ))}
          </div>
          {/* 按项目分组展示目标行(仅显示,分组来自平铺列表派生) */}
          {([
            ...projects
              .map(p => ({ name: p.name, color: p.color, goals: goals.filter(g => g.goal.projectId === p.id) }))
              .filter(g => g.goals.length > 0),
            ...(goals.some(g => g.goal.projectId == null)
              ? [{ name: "无项目", color: "#9CA3AF", goals: goals.filter(g => g.goal.projectId == null) }]
              : []),
          ]).map(group => (
            <div key={group.name}>
              <div className="flex bg-gray-50 dark:bg-gray-800/50 border-b border-gray-100 dark:border-gray-800">
                <div className="w-[120px] shrink-0 p-2 text-xs font-medium text-gray-700 dark:text-gray-300 truncate flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: group.color || "#9CA3AF" }} />
                  {group.name}
                </div>
                <div style={{ width: dates.length * cellWidth }} />
              </div>
              {group.goals.map(gwp => {
                const goal = gwp.goal;
                const bar = getBarStyle(goal);
                return (
                  <div key={goal.id} className="flex border-b border-gray-50 dark:border-gray-800/50 hover:bg-gray-50 dark:hover:bg-gray-800/30">
                    <div className="w-[120px] shrink-0 p-1.5 pl-4 text-xs text-gray-600 dark:text-gray-400 truncate">{goal.name}</div>
                    <div className="relative" style={{ width: dates.length * cellWidth, height: 28 }}>
                      {bar.startOffset < dates.length && (
                        <div
                          className="absolute top-1 h-6 rounded-md flex items-center px-1.5"
                          style={{
                            left: Math.max(0, bar.startOffset * cellWidth),
                            width: Math.max(cellWidth, bar.width * cellWidth),
                            backgroundColor: goal.progress >= 100 ? "#10B981" : "#6366F1",
                            opacity: goal.status === "paused" ? 0.4 : 0.85,
                          }}
                        >
                          {bar.width * cellWidth > 60 && (
                            <span className="text-[10px] text-white truncate">{goal.progress}%</span>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          ))}
          {goals.length === 0 && (
            <div className="p-8 text-center text-xs text-gray-400">暂无目标数据</div>
          )}
        </div>
      </div>
    </div>
  );
}

function FadeInUp({ children, delay = 0, className }: { children: React.ReactNode; delay?: number; className?: string }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, delay, ease: [0.25, 0.46, 0.45, 0.94] }}
      className={className}
    >
      {children}
    </motion.div>
  );
}

function PlannerPageInner() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const isCoarse = useIsCoarsePointer();
  const [activeTab, setActiveTab] = useState<PlannerTab>("pending");
  const [todayKey, setTodayKey] = useState(0);
  const [projects, setProjects] = useState<ProjectV2[]>([]);
  const [goalList, setGoalList] = useState<GoalWithPlans[]>([]);
  const [unclassifiedTasks, setUnclassifiedTasks] = useState<Task[]>([]);
  // 渲染期安全副本:与 allPlansRef 同步,供 ActionSheet 等在 JSX 中读取
  const [planList, setPlanList] = useState<Plan[]>([]);
  const [showNewProject, setShowNewProject] = useState(false);
  const [newProjectName, setNewProjectName] = useState("");
  const [newProjectColor, setNewProjectColor] = useState(COLORS[0]);
  const [editingProject, setEditingProject] = useState<ProjectV2 | null>(null);
  const [editProjectName, setEditProjectName] = useState("");
  const [editProjectColor, setEditProjectColor] = useState(COLORS[0]);
  const [projectSheet, setProjectSheet] = useState<ProjectV2 | null>(null);
  const [projectFilter, setProjectFilter] = useState<"all" | "none" | number>("all");
  const [expandedGoalIds, setExpandedGoalIds] = useState<Set<number>>(new Set());
  const [actionGoal, setActionGoal] = useState<GoalWithPlans | null>(null);
  const [projectPickerGoal, setProjectPickerGoal] = useState<GoalWithPlans | null>(null);
  const [assignTaskId, setAssignTaskId] = useState<number | null>(null);
  const [showArchive, setShowArchive] = useState(false);
  const [statusFilter, setStatusFilter] = useState("all");
  const [priorityFilter, setPriorityFilter] = useState("all");
  const [sortBy, setSortBy] = useState("deadline");
  const [batchMode, setBatchMode] = useState(false);
  const [selectedTaskIds, setSelectedTaskIds] = useState<Set<number>>(new Set());
  const [viewMode, setViewMode] = useState<"list" | "gantt">("list");
  const [ganttPeriod, setGanttPeriod] = useState<"week" | "month">("week");
  const [expandedPlanIds, setExpandedPlanIds] = useState<Set<number>>(new Set());
  const allTasksRef = useRef<Task[]>([]);
  const allPlansRef = useRef<Plan[]>([]);
  const allGoalsRef = useRef<Goal[]>([]);

  // 创建目标
  const [showNewGoal, setShowNewGoal] = useState(false);
  const [newGoalProjectId, setNewGoalProjectId] = useState<number | null>(null);
  const [newGoalName, setNewGoalName] = useState("");
  const [newGoalPriority, setNewGoalPriority] = useState<Priority>("not-urgent-important");

  // 快速创建计划
  const [showNewPlan, setShowNewPlan] = useState(false);
  const [newPlanGoalId, setNewPlanGoalId] = useState<number | null>(null);
  const [newPlanName, setNewPlanName] = useState("");

  const loadData = useCallback(async () => {
    const allProjects = await getAllProjectsV2();
    const allGoals = await getAllGoals();
    const allPlans = await getAllPlans();
    allPlansRef.current = allPlans;
    allGoalsRef.current = allGoals;
    const [shortterm, daily, longterm, habit] = await Promise.all([
      getTasksByType("shortterm"),
      getTasksByType("daily"),
      getTasksByType("longterm"),
      getTasksByType("habit"),
    ]);
    const allTasks = [...shortterm, ...daily, ...longterm, ...habit];
    allTasksRef.current = allTasks;

    // Build maps
    const plansByGoal = new Map<number, Plan[]>();
    allPlans.forEach(p => {
      const list = plansByGoal.get(p.goalId) || [];
      list.push(p);
      plansByGoal.set(p.goalId, list);
    });
    const tasksByPlan = new Map<number, Task[]>();
    allTasks.forEach(t => {
      if (t.planId) {
        const list = tasksByPlan.get(t.planId) || [];
        list.push(t);
        tasksByPlan.set(t.planId, list);
      }
    });

    // 目标平铺列表(含无项目目标)
    let list: GoalWithPlans[] = allGoals.map(g => ({
      goal: g,
      plans: (plansByGoal.get(g.id!) || []).map(p => ({
        plan: p,
        tasks: tasksByPlan.get(p.id!) || [],
      })),
    }));

    // Filter
    list = list.filter(gwp => {
      if (statusFilter !== "all" && gwp.goal.status !== statusFilter) return false;
      if (priorityFilter !== "all" && gwp.goal.priority !== priorityFilter) return false;
      if (!showArchive && gwp.goal.status === "archived") return false;
      if (projectFilter === "none" && gwp.goal.projectId != null) return false;
      if (typeof projectFilter === "number" && gwp.goal.projectId !== projectFilter) return false;
      return true;
    });

    // Sort(默认按截止日期,无截止日期排最后)
    if (sortBy === "deadline") {
      list = [...list].sort((a, b) => (a.goal.deadline || Infinity) - (b.goal.deadline || Infinity));
    } else if (sortBy === "progress") {
      list = [...list].sort((a, b) => a.goal.progress - b.goal.progress);
    }

    setProjects(allProjects);
    setPlanList(allPlans);
    setGoalList(list);

    const unclassified = allTasks.filter(t => t.status === "active" && (!t.projectId && !t.planId));
    setUnclassifiedTasks(unclassified);
  }, [statusFilter, priorityFilter, sortBy, showArchive, projectFilter]);

  const handleCreateProject = useCallback(async () => {
    if (!newProjectName.trim()) return;
    await createProjectV2(newProjectName.trim(), newProjectColor);
    setNewProjectName("");
    setShowNewProject(false);
    await loadData();
  }, [newProjectName, newProjectColor, loadData]);

  const handleOpenEditProject = useCallback((project: ProjectV2) => {
    setEditingProject(project);
    setEditProjectName(project.name);
    setEditProjectColor(project.color || COLORS[0]);
  }, []);

  const handleUpdateProject = useCallback(async () => {
    if (!editingProject?.id || !editProjectName.trim()) return;
    await updateProjectV2(editingProject.id, { name: editProjectName.trim(), color: editProjectColor });
    setEditingProject(null);
    showToast({ message: "项目已更新", type: "success" });
    await loadData();
  }, [editingProject, editProjectName, editProjectColor, loadData]);

  const handleDeleteProject = useCallback(async (project: ProjectV2) => {
    const count = allGoalsRef.current.filter(g => g.projectId === project.id).length;
    const confirmed = confirm(`删除项目「${project.name}」？删除后其下 ${count} 个目标将变为无项目。`);
    if (!confirmed) return;
    await deleteProjectV2(project.id!);
    if (projectFilter === project.id) setProjectFilter("all");
    showToast({ message: "项目已删除", type: "success" });
    await loadData();
  }, [projectFilter, loadData]);

  const handleChangeGoalProject = useCallback(async (goalId: number, projectId?: number) => {
    await updateGoal(goalId, { projectId });
    showToast({ message: "已更新所属项目", type: "success" });
    await loadData();
  }, [loadData]);

  // eslint-disable-next-line react-hooks/set-state-in-effect -- 异步数据加载:从 Dexie 拉取规划页数据是外部系统同步,effect 中触发属必要
  useEffect(() => { loadData(); }, [loadData]);

  useEffect(() => {
    const tab = searchParams.get("tab");
    // eslint-disable-next-line react-hooks/set-state-in-effect -- 将 URL 查询参数(?tab/?project)同步为初始 UI 状态,属外部系统同步
    if (tab === "today") setActiveTab("today");
    if (tab === "pending") setActiveTab("pending");
    // 旧链接重定向携带 ?project=[id],作为初始项目筛选
    const proj = searchParams.get("project");
    if (proj) {
      const n = Number(proj);
      if (!Number.isNaN(n)) setProjectFilter(n);
    }
  }, [searchParams]);

  const handleTodayUpdate = useCallback(() => setTodayKey((k) => k + 1), []);

  const handleToggleGoalExpand = (goalId: number) => {
    setExpandedGoalIds(prev => {
      const next = new Set(prev);
      if (next.has(goalId)) next.delete(goalId);
      else next.add(goalId);
      return next;
    });
  };

  const handleToggleTask = async (taskId: number) => {
    const task = allTasksRef.current.find(t => t.id === taskId);
    if (task) {
      if (task.status === "done") {
        await uncompleteTask(taskId);
      } else {
        await completeTask(taskId);
      }
      await loadData();
    }
  };

  const handleEditGoal = (goal: Goal) => {
    router.push(`/goals/${goal.id}`);
  };

  const handleDeleteGoal = async (goalId: number) => {
    const confirmed = confirm("删除目标？下属任务将移入未分类。");
    if (confirmed) {
      await deleteGoal(goalId, true);
      showToast({ message: "目标已删除", type: "success" });
      await loadData();
    }
  };

  const handleToggleGoalStatus = async (goalId: number) => {
    const goal = allGoalsRef.current.find(g => g.id === goalId);
    if (goal) {
      const newStatus: GoalStatus = goal.status === "active" ? "paused" : "active";
      await updateGoal(goalId, { status: newStatus });
      showToast({ message: newStatus === "paused" ? "目标已暂停" : "目标已恢复", type: "success" });
      await loadData();
    }
  };

  const handleArchiveGoal = async (goalId: number) => {
    const confirmed = confirm("归档目标？目标将被隐藏，可在筛选中显示。");
    if (confirmed) {
      await updateGoal(goalId, { status: "archived" });
      showToast({ message: "目标已归档", type: "success" });
      await loadData();
    }
  };

  const handleDeletePlan = async (planId: number) => {
    const confirmed = confirm("删除计划？下属任务将移入未分类。");
    if (confirmed) {
      await deletePlan(planId, true);
      showToast({ message: "计划已删除", type: "success" });
      await loadData();
    }
  };

  const handleArchivePlan = async (planId: number) => {
    await updatePlan(planId, { status: "archived" });
    showToast({ message: "计划已归档", type: "success" });
    await loadData();
  };

  const handleTogglePlanStatus = async (planId: number) => {
    const plan = allPlansRef.current.find(p => p.id === planId);
    if (plan) {
      const newStatus: GoalStatus = plan.status === "active" ? "paused" : "active";
      await updatePlan(planId, { status: newStatus });
      showToast({ message: newStatus === "paused" ? "计划已暂停" : "计划已恢复", type: "success" });
      await loadData();
    }
  };

  const handleEditPlan = (plan: Plan) => {
    router.push(`/plans/${plan.id}`);
  };

  const handleTogglePlanExpand = (planId: number) => {
    setExpandedPlanIds(prev => {
      const next = new Set(prev);
      if (next.has(planId)) next.delete(planId);
      else next.add(planId);
      return next;
    });
  };

  const handleOpenNewGoal = () => {
    // 项目筛选条选中具体项目时,新建目标默认挂在该项目下
    setNewGoalProjectId(typeof projectFilter === "number" ? projectFilter : null);
    setNewGoalName("");
    setNewGoalPriority("not-urgent-important");
    setShowNewGoal(true);
  };

  const handleCreateGoal = async () => {
    if (!newGoalName.trim()) return;
    await createGoal({
      ...(newGoalProjectId != null ? { projectId: newGoalProjectId } : {}),
      name: newGoalName.trim(),
      type: "task",
      priority: newGoalPriority,
      status: "active",
      progress: 0,
      progressLocked: false,
      weight: 1,
    });
    setShowNewGoal(false);
    showToast({ message: "目标已创建", type: "success" });
    await loadData();
  };

  const handleOpenNewPlan = (goalId: number) => {
    setNewPlanGoalId(goalId);
    setNewPlanName("");
    setShowNewPlan(true);
  };

  const handleCreatePlan = async () => {
    if (!newPlanName.trim() || !newPlanGoalId) return;
    await createPlan({
      goalId: newPlanGoalId,
      name: newPlanName.trim(),
      weight: 1,
      status: "active",
      progress: 0,
      order: 0,
    });
    setShowNewPlan(false);
    showToast({ message: "计划已创建", type: "success" });
    await loadData();
  };

  const handleAssignTask = (taskId: number) => {
    setAssignTaskId(taskId);
  };

  const handleAssignToPlan = async (planId: number) => {
    if (assignTaskId == null) return;
    await assignTasksToPlan([assignTaskId], planId);
    showToast({ message: "已分配到计划", type: "success" });
    await loadData();
  };

  const toggleTaskSelection = (taskId: number) => {
    setSelectedTaskIds(prev => {
      const next = new Set(prev);
      if (next.has(taskId)) next.delete(taskId); else next.add(taskId);
      return next;
    });
  };

  const handleBatchComplete = async () => {
    const ids = [...selectedTaskIds];
    await batchCompleteTasks(ids);
    setSelectedTaskIds(new Set());
    setBatchMode(false);
    showToast({ message: `已完成 ${ids.length} 个任务`, type: "success" });
    await loadData();
  };

  const handleBatchDelete = async () => {
    const ids = [...selectedTaskIds];
    if (!confirm(`确定删除 ${ids.length} 个任务？`)) return;
    await batchDeleteTasks(ids);
    setSelectedTaskIds(new Set());
    setBatchMode(false);
    showToast({ message: `已删除 ${ids.length} 个任务`, type: "success" });
    await loadData();
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-50 to-white dark:from-gray-950 dark:to-gray-900">
      <div className="mx-auto max-w-3xl px-5 py-6 pb-24">
        <FadeInUp delay={0} className="mb-5">
          <h1 className="text-xl font-bold text-gray-900 dark:text-white">规划</h1>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
            {activeTab === "pending" ? "所有目标，统一安排" : "今天要做的事"}
          </p>
        </FadeInUp>

        <FadeInUp delay={0.08} className="mb-5">
          <div className="relative grid grid-cols-2 gap-1 bg-gray-100 dark:bg-gray-800 rounded-xl p-1">
            <motion.div
              layoutId="planner-tab-indicator"
              className="absolute top-1 bottom-1 rounded-lg bg-white dark:bg-gray-700 shadow-sm"
              style={{ width: "calc(50% - 4px)" }}
              animate={{ left: activeTab === "pending" ? "4px" : "calc(50% + 0px)" }}
              transition={{ duration: 0.25, ease: [0.4, 0, 0.2, 1] }}
            />
            {PLANNER_TABS.map((tab) => (
              <button
                key={tab.key}
                onClick={() => setActiveTab(tab.key)}
                className={`relative z-10 flex flex-col items-center py-2.5 rounded-lg text-sm transition-colors ${
                  activeTab === tab.key ? "text-gray-900 dark:text-white" : "text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300"
                }`}
              >
                <div className="flex items-center gap-2">
                  <tab.icon className="w-[18px] h-[18px]" strokeWidth={2} />
                  <span className={activeTab === tab.key ? "font-semibold" : "font-medium"}>{tab.label}</span>
                </div>
                {activeTab === tab.key && (
                  <span className="text-[10px] text-gray-400 dark:text-gray-500 mt-0.5">{tab.desc}</span>
                )}
              </button>
            ))}
          </div>
        </FadeInUp>

        <FadeInUp delay={0.16}>
          <AnimatePresence mode="wait">
            <motion.div
              key={activeTab}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.25 }}
            >
              {activeTab === "pending" && (
                <div className="space-y-4">
                  <div className="flex flex-wrap items-center gap-2">
                    <div className="relative">
                      <Filter className="w-3.5 h-3.5 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
                      <select
                        value={statusFilter}
                        onChange={(e) => setStatusFilter(e.target.value)}
                        className="w-24 pl-8 pr-8 py-2 text-xs bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl appearance-none focus:outline-none focus:ring-2 focus:ring-indigo-500"
                      >
                        {STATUS_FILTERS.map(f => (
                          <option key={f.value} value={f.value}>{f.label}</option>
                        ))}
                      </select>
                      <ChevronDown className="w-3.5 h-3.5 text-gray-400 absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                    </div>

                    <div className="relative">
                      <select
                        value={priorityFilter}
                        onChange={(e) => setPriorityFilter(e.target.value)}
                        className="w-32 pl-3 pr-8 py-2 text-xs bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl appearance-none focus:outline-none focus:ring-2 focus:ring-indigo-500"
                      >
                        {PRIORITY_FILTERS.map(f => (
                          <option key={f.value} value={f.value}>{f.label}</option>
                        ))}
                      </select>
                      <ChevronDown className="w-3.5 h-3.5 text-gray-400 absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                    </div>

                    <div className="relative">
                      <ArrowUpDown className="w-3.5 h-3.5 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
                      <select
                        value={sortBy}
                        onChange={(e) => setSortBy(e.target.value)}
                        className="w-24 pl-8 pr-8 py-2 text-xs bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl appearance-none focus:outline-none focus:ring-2 focus:ring-indigo-500"
                      >
                        {SORT_OPTIONS.map(s => (
                          <option key={s.value} value={s.value}>{s.label}</option>
                        ))}
                      </select>
                      <ChevronDown className="w-3.5 h-3.5 text-gray-400 absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                    </div>

                    <button
                      onClick={() => setShowArchive(!showArchive)}
                      className={`flex items-center gap-1.5 px-3 py-2 text-xs rounded-xl transition-colors ${
                        showArchive
                          ? "bg-indigo-100 dark:bg-indigo-900/20 text-indigo-600"
                          : "bg-gray-100 dark:bg-gray-800 text-gray-500"
                      }`}
                    >
                      {showArchive ? <Eye className="w-3.5 h-3.5" /> : <EyeOff className="w-3.5 h-3.5" />}
                      {showArchive ? "隐藏归档" : "显示归档"}
                    </button>

                    <div className="flex items-center gap-1 bg-gray-100 dark:bg-gray-800 rounded-lg p-0.5 ml-auto">
                      {(["list", "gantt"] as const).map(m => (
                        <button key={m} onClick={() => setViewMode(m)} className={`px-3 py-1 text-xs rounded-md transition-colors ${viewMode === m ? "bg-white dark:bg-gray-700 shadow-sm font-medium" : "text-gray-500"}`}>
                          {m === "list" ? "列表" : "甘特图"}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* 项目筛选条:全部 / 各项目(颜色点) / 无项目 / +新建 */}
                  <div className="flex items-center gap-2 overflow-x-auto pb-1 -mx-1 px-1">
                    <button
                      onClick={() => setProjectFilter("all")}
                      className={`shrink-0 px-3 py-1.5 text-xs rounded-full border transition-colors ${
                        projectFilter === "all"
                          ? "border-indigo-300 dark:border-indigo-700 bg-indigo-50 dark:bg-indigo-900/20 text-indigo-700 dark:text-indigo-300 font-medium"
                          : "border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 text-gray-600 dark:text-gray-400 hover:border-gray-300 dark:hover:border-gray-600"
                      }`}
                    >
                      全部
                    </button>
                    {projects.map(p => (
                      <ProjectChip
                        key={p.id}
                        project={p}
                        active={projectFilter === p.id}
                        showMenuButton={isCoarse}
                        onClick={() => setProjectFilter(p.id!)}
                        onMenu={() => setProjectSheet(p)}
                      />
                    ))}
                    <button
                      onClick={() => setProjectFilter("none")}
                      className={`shrink-0 flex items-center gap-1.5 px-3 py-1.5 text-xs rounded-full border transition-colors ${
                        projectFilter === "none"
                          ? "border-indigo-300 dark:border-indigo-700 bg-indigo-50 dark:bg-indigo-900/20 text-indigo-700 dark:text-indigo-300 font-medium"
                          : "border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 text-gray-600 dark:text-gray-400 hover:border-gray-300 dark:hover:border-gray-600"
                      }`}
                    >
                      <span className="w-2 h-2 rounded-full bg-gray-300 dark:bg-gray-600" />
                      无项目
                    </button>
                    <button
                      onClick={() => { setNewProjectName(""); setNewProjectColor(COLORS[0]); setShowNewProject(true); }}
                      className="shrink-0 flex items-center gap-1 px-3 py-1.5 text-xs rounded-full border border-dashed border-gray-300 dark:border-gray-600 text-gray-500 dark:text-gray-400 hover:border-indigo-300 hover:text-indigo-600 transition-colors"
                    >
                      <Plus className="w-3 h-3" />
                      新建
                    </button>
                  </div>

                  <UnclassifiedPanel
                    tasks={unclassifiedTasks}
                    onToggleTask={handleToggleTask}
                    onAssign={handleAssignTask}
                    isExpanded={true}
                    onToggleExpand={() => {}}
                  />

                  {viewMode === "gantt" ? (
                    <GanttView goals={goalList} projects={projects} ganttPeriod={ganttPeriod} setGanttPeriod={setGanttPeriod} />
                  ) : (
                    <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <span className="text-xs text-gray-400">{goalList.length} 个目标</span>
                      <button
                        onClick={handleOpenNewGoal}
                        className="flex items-center gap-1 text-xs text-indigo-500 hover:text-indigo-600 transition-colors"
                      >
                        <Plus className="w-3.5 h-3.5" />
                        新建目标
                      </button>
                    </div>
                    {goalList.map(gwp => (
                      <GoalCard
                        key={gwp.goal.id}
                        goalWithPlans={gwp}
                        project={projects.find(p => p.id === gwp.goal.projectId)}
                        onToggleTask={handleToggleTask}
                        onEdit={() => handleEditGoal(gwp.goal)}
                        onDelete={() => handleDeleteGoal(gwp.goal.id!)}
                        onToggleStatus={() => handleToggleGoalStatus(gwp.goal.id!)}
                        onArchive={() => handleArchiveGoal(gwp.goal.id!)}
                        isExpanded={expandedGoalIds.has(gwp.goal.id!)}
                        onToggleExpand={() => handleToggleGoalExpand(gwp.goal.id!)}
                        onTagClick={() => setProjectPickerGoal(gwp)}
                        onMoreClick={isCoarse ? () => setActionGoal(gwp) : undefined}
                        onEditPlan={handleEditPlan}
                        onDeletePlan={handleDeletePlan}
                        onTogglePlanStatus={handleTogglePlanStatus}
                        onArchivePlan={handleArchivePlan}
                        expandedPlanIds={expandedPlanIds}
                        onTogglePlanExpand={handleTogglePlanExpand}
                        onAddPlan={handleOpenNewPlan}
                        batchMode={batchMode}
                        selectedTaskIds={selectedTaskIds}
                        onToggleTaskSelection={toggleTaskSelection}
                        onEnterBatchMode={() => setBatchMode(true)}
                        onExitBatchMode={() => { setBatchMode(false); setSelectedTaskIds(new Set()); }}
                        onBatchComplete={handleBatchComplete}
                        onBatchDelete={handleBatchDelete}
                      />
                    ))}

                    {goalList.length === 0 && (
                      <div className="text-center py-12">
                        <Target className="w-10 h-10 text-gray-300 mx-auto mb-3" />
                        <p className="text-sm text-gray-400">暂无目标</p>
                        <button
                          onClick={handleOpenNewGoal}
                          className="mt-3 inline-flex items-center gap-1.5 px-4 py-2 text-xs font-medium text-indigo-600 bg-indigo-50 dark:bg-indigo-900/20 rounded-xl hover:bg-indigo-100 transition-colors"
                        >
                          <Plus className="w-3.5 h-3.5" />
                          创建第一个目标
                        </button>
                      </div>
                    )}

                    <button
                      onClick={handleOpenNewGoal}
                      className="w-full flex items-center justify-center gap-2 py-3 text-sm text-gray-500 hover:text-gray-700 bg-white dark:bg-gray-900 rounded-2xl border border-dashed border-gray-200 dark:border-gray-700 hover:border-gray-300 transition-colors"
                    >
                      <Plus className="w-4 h-4" />
                      新建目标
                    </button>
                  </div>
                  )}
                </div>
              )}
              {activeTab === "today" && (
                <TodayTab key={todayKey} onUpdate={handleTodayUpdate} />
              )}
            </motion.div>
          </AnimatePresence>
        </FadeInUp>
      </div>

      <AnimatePresence>
        {showNewProject && (
          <motion.div
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 bg-black/40 flex items-end justify-center"
            style={{ paddingBottom: "var(--bottom-nav-height)" }}
            onClick={() => setShowNewProject(false)}
          >
            <motion.div
              initial={{ y: "100%" }} animate={{ y: 0 }} exit={{ y: "100%" }}
              transition={{ type: "spring", stiffness: 400, damping: 40 }}
              onClick={(e) => e.stopPropagation()}
              className="w-full max-w-lg bg-white dark:bg-gray-900 rounded-t-2xl p-6"
            >
              <div className="w-10 h-1 bg-gray-300 dark:bg-gray-700 rounded-full mx-auto mb-4" />
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-semibold text-gray-900 dark:text-white">新建项目</h3>
                <button onClick={() => setShowNewProject(false)} className="p-1 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg">
                  <X className="w-5 h-5 text-gray-400" />
                </button>
              </div>
              <input
                type="text"
                value={newProjectName}
                onChange={(e) => setNewProjectName(e.target.value)}
                placeholder="项目名称"
                className="w-full px-4 py-3 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-sm text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500 mb-4"
                autoFocus
                onKeyDown={(e) => e.key === "Enter" && handleCreateProject()}
              />
              <p className="text-xs text-gray-400 mb-2">项目颜色</p>
              <div className="flex items-center gap-2.5 mb-5">
                {COLORS.map(c => (
                  <button
                    key={c}
                    onClick={() => setNewProjectColor(c)}
                    aria-label={`选择颜色 ${c}`}
                    className={`w-7 h-7 rounded-full transition-transform ${newProjectColor === c ? "ring-2 ring-offset-2 ring-indigo-500 dark:ring-offset-gray-900 scale-110" : "hover:scale-105"}`}
                    style={{ backgroundColor: c }}
                  />
                ))}
              </div>
              <div className="flex gap-3">
                <button onClick={() => setShowNewProject(false)} className="flex-1 py-3 rounded-xl border border-gray-200 dark:border-gray-700 text-sm text-gray-500">
                  取消
                </button>
                <button
                  onClick={handleCreateProject}
                  disabled={!newProjectName.trim()}
                  className="flex-1 py-3 rounded-xl bg-indigo-600 text-white text-sm font-medium hover:bg-indigo-700 disabled:opacity-40"
                >
                  创建
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {editingProject && (
          <motion.div
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 bg-black/40 flex items-end justify-center"
            style={{ paddingBottom: "var(--bottom-nav-height)" }}
            onClick={() => setEditingProject(null)}
          >
            <motion.div
              initial={{ y: "100%" }} animate={{ y: 0 }} exit={{ y: "100%" }}
              transition={{ type: "spring", stiffness: 400, damping: 40 }}
              onClick={(e) => e.stopPropagation()}
              className="w-full max-w-lg bg-white dark:bg-gray-900 rounded-t-2xl p-6"
            >
              <div className="w-10 h-1 bg-gray-300 dark:bg-gray-700 rounded-full mx-auto mb-4" />
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-semibold text-gray-900 dark:text-white">编辑项目</h3>
                <button onClick={() => setEditingProject(null)} className="p-1 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg">
                  <X className="w-5 h-5 text-gray-400" />
                </button>
              </div>
              <input
                type="text"
                value={editProjectName}
                onChange={(e) => setEditProjectName(e.target.value)}
                placeholder="项目名称"
                className="w-full px-4 py-3 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-sm text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500 mb-4"
                autoFocus
                onKeyDown={(e) => e.key === "Enter" && handleUpdateProject()}
              />
              <p className="text-xs text-gray-400 mb-2">项目颜色</p>
              <div className="flex items-center gap-2.5 mb-5">
                {COLORS.map(c => (
                  <button
                    key={c}
                    onClick={() => setEditProjectColor(c)}
                    aria-label={`选择颜色 ${c}`}
                    className={`w-7 h-7 rounded-full transition-transform ${editProjectColor === c ? "ring-2 ring-offset-2 ring-indigo-500 dark:ring-offset-gray-900 scale-110" : "hover:scale-105"}`}
                    style={{ backgroundColor: c }}
                  />
                ))}
              </div>
              <div className="flex gap-3">
                <button onClick={() => setEditingProject(null)} className="flex-1 py-3 rounded-xl border border-gray-200 dark:border-gray-700 text-sm text-gray-500">
                  取消
                </button>
                <button
                  onClick={handleUpdateProject}
                  disabled={!editProjectName.trim()}
                  className="flex-1 py-3 rounded-xl bg-indigo-600 text-white text-sm font-medium hover:bg-indigo-700 disabled:opacity-40"
                >
                  保存
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {showNewGoal && (
          <motion.div
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 bg-black/40 flex items-end justify-center"
            style={{ paddingBottom: "var(--bottom-nav-height)" }}
            onClick={() => setShowNewGoal(false)}
          >
            <motion.div
              initial={{ y: "100%" }} animate={{ y: 0 }} exit={{ y: "100%" }}
              transition={{ type: "spring", stiffness: 400, damping: 40 }}
              onClick={(e) => e.stopPropagation()}
              className="w-full max-w-lg bg-white dark:bg-gray-900 rounded-t-2xl p-6"
            >
              <div className="w-10 h-1 bg-gray-300 dark:bg-gray-700 rounded-full mx-auto mb-4" />
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">创建目标</h3>
              <input
                type="text"
                value={newGoalName}
                onChange={(e) => setNewGoalName(e.target.value)}
                placeholder="目标名称"
                className="w-full px-4 py-3 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-sm text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500 mb-3"
                autoFocus
                onKeyDown={(e) => e.key === "Enter" && handleCreateGoal()}
              />
              <p className="text-xs text-gray-400 mb-2">所属项目(可选)</p>
              <div className="flex flex-wrap gap-2 mb-4">
                <button
                  onClick={() => setNewGoalProjectId(null)}
                  className={`flex items-center gap-1.5 px-3 py-1.5 text-xs rounded-full border transition-colors ${
                    newGoalProjectId === null
                      ? "border-indigo-300 dark:border-indigo-700 bg-indigo-50 dark:bg-indigo-900/20 text-indigo-700 dark:text-indigo-300 font-medium"
                      : "border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-400 hover:border-gray-300"
                  }`}
                >
                  <span className="w-2 h-2 rounded-full bg-gray-300 dark:bg-gray-600" />
                  无项目
                </button>
                {projects.map(p => (
                  <button
                    key={p.id}
                    onClick={() => setNewGoalProjectId(p.id!)}
                    className={`flex items-center gap-1.5 px-3 py-1.5 text-xs rounded-full border transition-colors ${
                      newGoalProjectId === p.id
                        ? "border-indigo-300 dark:border-indigo-700 bg-indigo-50 dark:bg-indigo-900/20 text-indigo-700 dark:text-indigo-300 font-medium"
                        : "border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-400 hover:border-gray-300"
                    }`}
                  >
                    <span className="w-2 h-2 rounded-full" style={{ backgroundColor: p.color || "#9CA3AF" }} />
                    {p.name}
                  </button>
                ))}
              </div>
              <div className="flex gap-3">
                <button onClick={() => setShowNewGoal(false)} className="flex-1 py-3 rounded-xl border border-gray-200 dark:border-gray-700 text-sm text-gray-500">
                  取消
                </button>
                <button onClick={handleCreateGoal} disabled={!newGoalName.trim()} className="flex-1 py-3 rounded-xl bg-indigo-600 text-white text-sm font-medium hover:bg-indigo-700 disabled:opacity-40">
                  创建
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {showNewPlan && (
          <motion.div
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 bg-black/40 flex items-end justify-center"
            style={{ paddingBottom: "var(--bottom-nav-height)" }}
            onClick={() => setShowNewPlan(false)}
          >
            <motion.div
              initial={{ y: "100%" }} animate={{ y: 0 }} exit={{ y: "100%" }}
              transition={{ type: "spring", stiffness: 400, damping: 40 }}
              onClick={(e) => e.stopPropagation()}
              className="w-full max-w-lg bg-white dark:bg-gray-900 rounded-t-2xl p-6"
            >
              <div className="w-10 h-1 bg-gray-300 dark:bg-gray-700 rounded-full mx-auto mb-4" />
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">快速添加计划</h3>
              <input
                type="text"
                value={newPlanName}
                onChange={(e) => setNewPlanName(e.target.value)}
                placeholder="计划名称"
                className="w-full px-4 py-3 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-sm text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500 mb-3"
                autoFocus
                onKeyDown={(e) => e.key === "Enter" && handleCreatePlan()}
              />
              <div className="flex gap-3">
                <button onClick={() => setShowNewPlan(false)} className="flex-1 py-3 rounded-xl border border-gray-200 dark:border-gray-700 text-sm text-gray-500">
                  取消
                </button>
                <button onClick={handleCreatePlan} disabled={!newPlanName.trim()} className="flex-1 py-3 rounded-xl bg-indigo-600 text-white text-sm font-medium hover:bg-indigo-700 disabled:opacity-40">
                  创建
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* 移动端目标 ⋯ 更多菜单(桌面端为卡片内下拉) */}
      <ActionSheet
        open={actionGoal != null}
        onClose={() => setActionGoal(null)}
        title={actionGoal?.goal.name}
        actions={actionGoal ? [
          { label: "编辑", icon: <EditIcon className="w-4 h-4" />, onClick: () => handleEditGoal(actionGoal.goal) },
          {
            label: actionGoal.goal.status === "active" ? "暂停" : "恢复",
            icon: actionGoal.goal.status === "active" ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4" />,
            onClick: () => handleToggleGoalStatus(actionGoal.goal.id!),
          },
          { label: "归档", icon: <Archive className="w-4 h-4" />, onClick: () => handleArchiveGoal(actionGoal.goal.id!) },
          { label: "删除", icon: <Trash2 className="w-4 h-4" />, danger: true, onClick: () => handleDeleteGoal(actionGoal.goal.id!) },
        ] : []}
      />

      {/* 目标卡片项目标签:更换所属项目 */}
      <ActionSheet
        open={projectPickerGoal != null}
        onClose={() => setProjectPickerGoal(null)}
        title="选择所属项目"
        actions={projectPickerGoal ? [
          {
            label: "无项目",
            icon: <span className="w-2.5 h-2.5 rounded-full bg-gray-300 dark:bg-gray-600" />,
            onClick: () => handleChangeGoalProject(projectPickerGoal.goal.id!, undefined),
          },
          ...projects.map(p => ({
            label: p.name,
            icon: <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: p.color || "#9CA3AF" }} />,
            onClick: () => handleChangeGoalProject(projectPickerGoal.goal.id!, p.id),
          })),
        ] : []}
      />

      {/* 筛选条项目 chip 的编辑/删除入口 */}
      <ActionSheet
        open={projectSheet != null}
        onClose={() => setProjectSheet(null)}
        title={projectSheet?.name}
        actions={projectSheet ? [
          { label: "编辑", icon: <EditIcon className="w-4 h-4" />, onClick: () => handleOpenEditProject(projectSheet) },
          { label: "删除", icon: <Trash2 className="w-4 h-4" />, danger: true, onClick: () => handleDeleteProject(projectSheet) },
        ] : []}
      />

      {/* 未分类任务分配到计划 */}
      <ActionSheet
        open={assignTaskId != null}
        onClose={() => setAssignTaskId(null)}
        title="分配到计划"
        actions={planList
          .filter(p => p.status === "active")
          .map(p => ({
            label: p.name,
            icon: <ClipboardList className="w-4 h-4" />,
            onClick: () => handleAssignToPlan(p.id!),
          }))}
      />

    </div>
  );
}

function PlannerLoading() {
  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-50 to-white dark:from-gray-950 dark:to-gray-900 flex items-center justify-center">
      <div className="flex flex-col items-center gap-3">
        <div className="w-8 h-8 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin" />
        <span className="text-sm text-gray-400">加载中...</span>
      </div>
    </div>
  );
}

export default function PlannerPage() {
  return (
    <Suspense fallback={<PlannerLoading />}>
      <PlannerPageInner />
    </Suspense>
  );
}