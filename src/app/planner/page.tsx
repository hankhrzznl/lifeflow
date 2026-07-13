"use client";

import { useState, useEffect, useCallback, Suspense } from "react";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import {
  CalendarCheck, LayoutDashboard, FolderKanban, ChevronRight, Inbox,
  Plus, X, ChevronDown, Target, CheckCircle, CalendarDays, ClipboardList,
  MoreHorizontal, Play, Pause, Archive, Trash2, Filter, ArrowUpDown, EyeOff, Eye,
  GripVertical, ListTodo, Circle, ChevronLeft, CheckCircle2, CheckSquare, Square, Lock
} from "lucide-react";
import { useSearchParams } from "next/navigation";
import {
  getAllProjectsV2, createProjectV2, getGoalsByProject, getPlansByGoal,
  getTasksByType, deleteGoal, deletePlan, updateGoal, updatePlan, assignTasksToPlan,
  getAllGoals, getAllPlans
} from "@/lib/db";
import { completeTask, uncompleteTask, moveTaskToPlan, batchCompleteTasks, batchDeleteTasks, batchMoveTasks } from "@/lib/linkage";
import { showToast } from "@/components/ui/Toast";
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

interface ProjectWithGoals {
  project: ProjectV2;
  goals: Goal[];
}

interface GoalWithPlans {
  goal: Goal;
  plans: Plan[];
}

interface PlanWithTasks {
  plan: Plan;
  tasks: Task[];
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
  onMoveTask,
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
  onMoveTask: (taskId: number, targetPlanId: number) => void;
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
  const isUnlocked = (plan as any).isUnlocked !== false;

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
  projectId,
  onToggleTask,
  onMoveTask,
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
  goalWithPlans: GoalWithPlans;
  projectId: number;
  onToggleTask: (id: number) => void;
  onMoveTask: (taskId: number, targetPlanId: number) => void;
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
              <span className="text-xs text-gray-400">{plans.length} 个计划</span>
            </div>
          </div>

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
                plans.map(plan => (
                  <PlanCard
                    key={plan.id}
                    planWithTasks={{ plan, tasks: [] }}
                    goalStatus={goal.status}
                    onToggleTask={onToggleTask}
                    onMoveTask={onMoveTask}
                    onEdit={() => {}}
                    onDelete={() => {}}
                    onToggleStatus={() => {}}
                    onArchive={() => {}}
                    isExpanded={false}
                    onToggleExpand={() => {}}
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
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}

function ProjectCard({
  projectWithGoals,
  onToggleTask,
  onMoveTask,
  onEditGoal,
  onDeleteGoal,
  onToggleGoalStatus,
  onArchiveGoal,
  onEditPlan,
  onDeletePlan,
  onTogglePlanStatus,
  onArchivePlan,
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
  projectWithGoals: ProjectWithGoals;
  onToggleTask: (id: number) => void;
  onMoveTask: (taskId: number, targetPlanId: number) => void;
  onEditGoal: (goal: Goal) => void;
  onDeleteGoal: (goalId: number) => void;
  onToggleGoalStatus: (goalId: number) => void;
  onArchiveGoal: (goalId: number) => void;
  onEditPlan: (plan: Plan) => void;
  onDeletePlan: (planId: number) => void;
  onTogglePlanStatus: (planId: number) => void;
  onArchivePlan: (planId: number) => void;
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
  const { project, goals } = projectWithGoals;

  return (
    <div>
      <button
        onClick={onToggleExpand}
        className={`w-full flex items-center gap-4 p-4 bg-white dark:bg-gray-900 border shadow-sm hover:shadow-md transition-all group rounded-2xl ${
          isExpanded
            ? "border-indigo-200 dark:border-indigo-800 rounded-b-none border-b-0"
            : "border-gray-100 dark:border-gray-800"
        }`}
      >
        <div
          className="w-12 h-12 rounded-xl flex items-center justify-center text-xl"
          style={{ backgroundColor: `${project.color}20`, color: project.color }}
        >
          <FolderKanban className="w-6 h-6" />
        </div>
        <div className="flex-1 text-left">
          <p className="text-sm font-semibold text-gray-900 dark:text-white">{project.name}</p>
          <p className="text-xs text-gray-400">{goals.length} 个目标</p>
        </div>
        <ChevronDown
          className={`w-4 h-4 text-gray-300 group-hover:text-gray-500 transition-transform ${isExpanded ? "rotate-180" : ""}`}
        />
      </button>

      <AnimatePresence>
        {isExpanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="overflow-hidden"
          >
            <div className="bg-white dark:bg-gray-900 rounded-b-2xl border border-indigo-200 dark:border-indigo-800 border-t-0 p-4 space-y-3">
              {goals.length > 0 ? (
                goals.map(goal => (
                  <GoalCard
                    key={goal.id}
                    goalWithPlans={{ goal, plans: [] }}
                    projectId={project.id!}
                    onToggleTask={onToggleTask}
                    onMoveTask={onMoveTask}
                    onEdit={() => onEditGoal(goal)}
                    onDelete={() => onDeleteGoal(goal.id!)}
                    onToggleStatus={() => onToggleGoalStatus(goal.id!)}
                    onArchive={() => onArchiveGoal(goal.id!)}
                    isExpanded={false}
                    onToggleExpand={() => {}}
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
                <p className="text-xs text-gray-400 py-4 text-center">暂无目标</p>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
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
  const [activeTab, setActiveTab] = useState<PlannerTab>("pending");
  const [todayKey, setTodayKey] = useState(0);
  const [projects, setProjects] = useState<ProjectWithGoals[]>([]);
  const [unclassifiedTasks, setUnclassifiedTasks] = useState<Task[]>([]);
  const [showNewProject, setShowNewProject] = useState(false);
  const [newProjectName, setNewProjectName] = useState("");
  const [expandedProjectIds, setExpandedProjectIds] = useState<number[]>([]);
  const [showArchive, setShowArchive] = useState(false);
  const [statusFilter, setStatusFilter] = useState("all");
  const [priorityFilter, setPriorityFilter] = useState("all");
  const [sortBy, setSortBy] = useState("created");
  const [batchMode, setBatchMode] = useState(false);
  const [selectedTaskIds, setSelectedTaskIds] = useState<Set<number>>(new Set());
  const [showBatchActions, setShowBatchActions] = useState(false);

  const handleCreateProject = useCallback(async () => {
    if (!newProjectName.trim()) return;
    await createProjectV2(newProjectName.trim(), COLORS[Math.floor(Math.random() * COLORS.length)]);
    setNewProjectName("");
    setShowNewProject(false);
    await loadData();
  }, [newProjectName]);

  const loadData = useCallback(async () => {
    const allProjects = await getAllProjectsV2();
    const allGoals = await getAllGoals();
    const [shortterm, daily, longterm, habit] = await Promise.all([
      getTasksByType("shortterm"),
      getTasksByType("daily"),
      getTasksByType("longterm"),
      getTasksByType("habit"),
    ]);
    const allTasks = [...shortterm, ...daily, ...longterm, ...habit];

    const projectsWithGoals: ProjectWithGoals[] = allProjects.map(project => ({
      project,
      goals: allGoals.filter(g => g.projectId === project.id),
    }));

    let filtered = projectsWithGoals.map(p => ({
      ...p,
      goals: p.goals.filter(g => {
        if (statusFilter !== "all" && g.status !== statusFilter) return false;
        if (priorityFilter !== "all" && g.priority !== priorityFilter) return false;
        if (!showArchive && g.status === "archived") return false;
        return true;
      }),
    })).filter(p => p.goals.length > 0);

    if (sortBy === "deadline") {
      filtered = filtered.map(p => ({
        ...p,
        goals: [...p.goals].sort((a, b) => (a.deadline || Infinity) - (b.deadline || Infinity)),
      }));
    } else if (sortBy === "progress") {
      filtered = filtered.map(p => ({
        ...p,
        goals: [...p.goals].sort((a, b) => a.progress - b.progress),
      }));
    }

    setProjects(filtered);

    const unclassified = allTasks.filter(t => t.status === "active" && (!t.projectId || !t.planId));
    setUnclassifiedTasks(unclassified);
  }, [statusFilter, priorityFilter, sortBy, showArchive]);

  useEffect(() => { loadData(); }, [loadData]);

  useEffect(() => {
    const tab = searchParams.get("tab");
    if (tab === "today") setActiveTab("today");
    if (tab === "pending") setActiveTab("pending");
  }, [searchParams]);

  const handleTodayUpdate = useCallback(() => setTodayKey((k) => k + 1), []);

  const handleToggleProject = (id: number) => {
    setExpandedProjectIds(prev =>
      prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]
    );
  };

  const handleToggleTask = async (taskId: number) => {
    const task = unclassifiedTasks.find(t => t.id === taskId);
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
    router.push(`/projects/${goal.projectId}/goals/${goal.id}`);
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
    const goal = projects.flatMap(p => p.goals).find(g => g.id === goalId);
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

  const handleAssignTask = (taskId: number) => {
    router.push("/projects/unclassified");
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
            {activeTab === "pending" ? "选择项目，分类处理任务" : "今天要做的事"}
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
                  </div>

                  <UnclassifiedPanel
                    tasks={unclassifiedTasks}
                    onToggleTask={handleToggleTask}
                    onAssign={handleAssignTask}
                    isExpanded={true}
                    onToggleExpand={() => {}}
                  />

                  <div className="space-y-3">
                    {projects.map(project => (
                      <ProjectCard
                        key={project.project.id}
                        projectWithGoals={project}
                        onToggleTask={handleToggleTask}
                        onMoveTask={() => {}}
                        onEditGoal={handleEditGoal}
                        onDeleteGoal={handleDeleteGoal}
                        onToggleGoalStatus={handleToggleGoalStatus}
                        onArchiveGoal={handleArchiveGoal}
                        onEditPlan={() => {}}
                        onDeletePlan={handleDeletePlan}
                        onTogglePlanStatus={() => {}}
                        onArchivePlan={handleArchivePlan}
                        isExpanded={expandedProjectIds.includes(project.project.id!)}
                        onToggleExpand={() => handleToggleProject(project.project.id!)}
                        batchMode={batchMode}
                        selectedTaskIds={selectedTaskIds}
                        onToggleTaskSelection={toggleTaskSelection}
                        onEnterBatchMode={() => setBatchMode(true)}
                        onExitBatchMode={() => { setBatchMode(false); setSelectedTaskIds(new Set()); }}
                        onBatchComplete={handleBatchComplete}
                        onBatchDelete={handleBatchDelete}
                      />
                    ))}

                    {projects.length === 0 && (
                      <div className="text-center py-12">
                        <FolderKanban className="w-10 h-10 text-gray-300 mx-auto mb-3" />
                        <p className="text-sm text-gray-400">暂无项目</p>
                        <button
                          onClick={() => { setNewProjectName(""); setShowNewProject(true); }}
                          className="mt-3 inline-flex items-center gap-1.5 px-4 py-2 text-xs font-medium text-indigo-600 bg-indigo-50 dark:bg-indigo-900/20 rounded-xl hover:bg-indigo-100 transition-colors"
                        >
                          <Plus className="w-3.5 h-3.5" />
                          创建第一个项目
                        </button>
                      </div>
                    )}

                    <button
                      onClick={() => { setNewProjectName(""); setShowNewProject(true); }}
                      className="w-full flex items-center justify-center gap-2 py-3 text-sm text-gray-500 hover:text-gray-700 bg-white dark:bg-gray-900 rounded-2xl border border-dashed border-gray-200 dark:border-gray-700 hover:border-gray-300 transition-colors"
                    >
                      <Plus className="w-4 h-4" />
                      新建项目
                    </button>
                  </div>
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