"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter, useParams } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import {
  ArrowLeft, Plus, MoreHorizontal, CheckCircle, Circle, Calendar,
  Clock, Trash2, Edit2, Archive, Play, Pause, Tag, AlertCircle, X,
  ChevronDown, ChevronRight, Target, ListTodo, Lock, Unlock, Link2,
} from "lucide-react";
import { getPlan, getGoal, getProjectV2, updateTask, getTasksByType, createTask, updatePlan, getPlansByGoal } from "@/lib/db";
import { completeTask, uncompleteTask, deleteTask, recalculatePlanProgress } from "@/lib/linkage";
import { addPredecessor, removePredecessor, getPredecessorDetails } from "@/lib/planDependency";
import { showToast } from "@/components/ui/Toast";
import type { Plan, Goal, ProjectV2, Task, Priority, GoalStatus } from "@/lib/types";

const PRIORITY_CONFIG = [
  { key: "urgent-important" as Priority, label: "重要紧急", color: "bg-red-100 text-red-600" },
  { key: "not-urgent-important" as Priority, label: "重要不紧急", color: "bg-blue-100 text-blue-600" },
  { key: "urgent-not-important" as Priority, label: "不重要紧急", color: "bg-amber-100 text-amber-600" },
  { key: "not-urgent-not-important" as Priority, label: "不重要不紧急", color: "bg-gray-100 text-gray-600" },
];

const STATUS_STYLES: Record<string, { bg: string; text: string; badge: string }> = {
  active: { bg: "bg-white/90 dark:bg-gray-900/90", text: "text-gray-900 dark:text-white", badge: "bg-green-100 text-green-600" },
  completed: { bg: "bg-green-50/50 dark:bg-green-900/20", text: "text-gray-400 dark:text-gray-500", badge: "bg-green-500 text-white" },
  paused: { bg: "bg-gray-100/50 dark:bg-gray-800/50", text: "text-gray-400 dark:text-gray-500", badge: "bg-gray-400 text-white" },
  archived: { bg: "bg-gray-50/50 dark:bg-gray-800/30", text: "text-gray-400 dark:text-gray-500", badge: "bg-gray-500 text-white" },
};

function TaskItem({
  task,
  onToggle,
  onDelete,
  onEdit,
  goal,
}: {
  task: Task;
  onToggle: (id: number) => void;
  onDelete: (id: number) => void;
  onEdit: (task: Task) => void;
  goal?: Goal;
}) {
  const isPaused = goal?.status === "paused";
  const isCompleted = task.status === "done";

  const priorityConfig = PRIORITY_CONFIG.find(p => p.key === task.priority);

  return (
    <motion.div
      initial={{ opacity: 0, x: -16 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: 16 }}
      transition={{ duration: 0.2 }}
      className={`group flex items-start gap-3 p-3 rounded-xl ${STATUS_STYLES[isCompleted ? "completed" : "active"].bg} ${isPaused ? "opacity-60" : ""}`}
    >
      <button
        onClick={() => !isPaused && onToggle(task.id!)}
        disabled={isPaused}
        className={`mt-0.5 shrink-0 ${isPaused ? "cursor-not-allowed" : "hover:scale-110 transition-transform"}`}
      >
        {isCompleted ? (
          <CheckCircle className="w-5 h-5 text-green-500" />
        ) : (
          <Circle className="w-5 h-5 text-gray-300 dark:text-gray-600 hover:text-indigo-500 transition-colors" />
        )}
      </button>

      <div className="flex-1 min-w-0">
        <p className={`text-sm font-medium ${isCompleted ? "line-through" : ""} ${STATUS_STYLES[isCompleted ? "completed" : "active"].text}`}>
          {task.title}
        </p>
        <div className="flex flex-wrap items-center gap-2 mt-1.5">
          {priorityConfig && (
            <span className={`text-[10px] px-1.5 py-0.5 rounded ${priorityConfig.color}`}>
              {priorityConfig.label}
            </span>
          )}
          {task.tags && task.tags.length > 0 && (
            <span className="text-[10px] px-1.5 py-0.5 rounded bg-violet-100 text-violet-600 flex items-center gap-0.5">
              <Tag className="w-2.5 h-2.5" /> {task.tags[0]}
            </span>
          )}
          {task.dueDate && (
            <span className="text-[10px] text-gray-400 flex items-center gap-0.5">
              <Calendar className="w-2.5 h-2.5" /> {new Date(task.dueDate).toLocaleDateString("zh-CN")}
            </span>
          )}
        </div>
      </div>

      <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
        <button onClick={() => onEdit(task)} className="p-1.5 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg">
          <Edit2 className="w-4 h-4 text-gray-400" />
        </button>
        <button onClick={() => onDelete(task.id!)} className="p-1.5 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg">
          <Trash2 className="w-4 h-4 text-red-400" />
        </button>
      </div>
    </motion.div>
  );
}

export default function PlanDetailPage() {
  const router = useRouter();
  const params = useParams();
  const projectId = Number(params.projectId);
  const goalId = Number(params.goalId);
  const planId = Number(params.planId);

  const [plan, setPlan] = useState<Plan | null>(null);
  const [goal, setGoal] = useState<Goal | null>(null);
  const [project, setProject] = useState<ProjectV2 | null>(null);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [showAddTask, setShowAddTask] = useState(false);
  const [newTaskTitle, setNewTaskTitle] = useState("");
  const [showEditModal, setShowEditModal] = useState(false);
  const [editingTask, setEditingTask] = useState<Task | null>(null);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [deletingTaskId, setDeletingTaskId] = useState<number | null>(null);
  const [showMoreMenu, setShowMoreMenu] = useState(false);
  const [editingProgress, setEditingProgress] = useState(false);
  const [progressValue, setProgressValue] = useState(0);
  const [showDependencySheet, setShowDependencySheet] = useState(false);
  const [predecessors, setPredecessors] = useState<Array<{ id: number; name: string; status: string; progress: number }>>([]);
  const [availablePlans, setAvailablePlans] = useState<Plan[]>([]);

  const loadData = useCallback(async () => {
    const [p, g, proj] = await Promise.all([
      getPlan(planId),
      getGoal(goalId),
      getProjectV2(projectId),
    ]);
    setPlan(p || null);
    setGoal(g || null);
    setProject(proj || null);

    const [shortterm, daily, longterm, habit] = await Promise.all([
      getTasksByType("shortterm"),
      getTasksByType("daily"),
      getTasksByType("longterm"),
      getTasksByType("habit"),
    ]);
    const allTasks = [...shortterm, ...daily, ...longterm, ...habit];
    const planTasks = allTasks.filter((t: Task) => t.planId === planId);
    setTasks(planTasks);
    const deps = await getPredecessorDetails(planId);
    setPredecessors(deps);
    const allGoalPlans = await getPlansByGoal(goalId);
    setAvailablePlans(allGoalPlans.filter(p => p.id !== planId && !deps.find(d => d.id === p.id)));
    setLoaded(true);
  }, [planId, goalId, projectId]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const handleToggleTask = useCallback(async (taskId: number) => {
    if (!plan) return;
    if (plan.isUnlocked === false) {
      showToast({ message: "请先完成所有前置计划", type: "warning" });
      return;
    }
    const task = tasks.find(t => t.id === taskId);
    if (!task) return;

    if (task.status === "done") {
      await uncompleteTask(taskId);
    } else {
      await completeTask(taskId);
    }
    await loadData();
  }, [tasks, loadData, plan]);

  const handleDeleteTask = useCallback(async (taskId: number) => {
    await deleteTask(taskId);
    setTasks(prev => prev.filter(t => t.id !== taskId));
    await loadData();
  }, [loadData]);

  const handleAddTask = useCallback(async () => {
    if (!newTaskTitle.trim()) return;

    await createTask({
      title: newTaskTitle.trim(),
      type: "daily",
      status: "active",
      planId,
      goalId,
      projectId,
      weight: 1,
    });

    setNewTaskTitle("");
    setShowAddTask(false);
    await loadData();
  }, [newTaskTitle, planId, goalId, projectId, loadData]);

  const handleEditTask = useCallback(async () => {
    if (!editingTask) return;
    await updateTask(editingTask.id!, { ...editingTask, updatedAt: Date.now() });
    setShowEditModal(false);
    setEditingTask(null);
    await loadData();
  }, [editingTask, loadData]);

  const handleStartEditProgress = useCallback(() => {
    if (!plan) return;
    setProgressValue(plan.progress);
    setEditingProgress(true);
  }, [plan]);

  const handleSaveProgress = useCallback(async () => {
    if (!plan) return;
    const v = Math.max(0, Math.min(100, Math.round(progressValue)));
    await updatePlan(plan.id!, { progress: v, progressLocked: true });
    setPlan(prev => prev ? { ...prev, progress: v, progressLocked: true } : null);
    setEditingProgress(false);
  }, [plan, progressValue]);

  const handleUnlockRecalculate = useCallback(async () => {
    if (!plan) return;
    await updatePlan(plan.id!, { progressLocked: false });
    await recalculatePlanProgress(plan.id!);
    const updated = await getPlan(plan.id!);
    setPlan(updated || { ...plan, progressLocked: false });
  }, [plan]);

  const handleUpdateStatus = useCallback(async (status: GoalStatus) => {
    if (!plan) return;
    await updatePlan(plan.id!, { status });
    setPlan(prev => prev ? { ...prev, status } : null);
    setShowMoreMenu(false);
  }, [plan]);

  const handleAddDependency = useCallback(async (predecessorId: number) => {
    try {
      await addPredecessor(planId, predecessorId);
      const deps = await getPredecessorDetails(planId);
      setPredecessors(deps);
      showToast({ message: "依赖已添加", type: "success" });
    } catch (err: any) {
      showToast({ message: err.message || "添加失败", type: "error" });
    }
  }, [planId]);

  const handleRemoveDependency = useCallback(async (predecessorId: number) => {
    await removePredecessor(planId, predecessorId);
    const deps = await getPredecessorDetails(planId);
    setPredecessors(deps);
    showToast({ message: "依赖已移除", type: "success" });
  }, [planId]);

  if (!loaded || !plan || !goal || !project) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-slate-50 to-white dark:from-gray-950 dark:to-gray-900 flex items-center justify-center">
        <div className="w-6 h-6 border-2 border-indigo-400 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  const completedCount = tasks.filter(t => t.status === "done").length;
  const progress = tasks.length > 0 ? Math.round((completedCount / tasks.length) * 100) : 0;

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-50 to-white dark:from-gray-950 dark:to-gray-900">
      <div className="mx-auto max-w-3xl px-5 py-6 pb-24">
        <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="mb-6">
          <button
            onClick={() => router.push(`/projects/${projectId}/goals/${goalId}`)}
            className="flex items-center gap-2 text-sm text-gray-500 hover:text-gray-700 dark:hover:text-gray-300 mb-4"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>返回目标</span>
          </button>

          <h1 className="text-xl font-bold text-gray-900 dark:text-white">{plan.name}</h1>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
            {project.name} · {goal.name}
          </p>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.05 }}
          className="bg-white dark:bg-gray-900 rounded-2xl p-5 mb-5 shadow-sm border border-gray-100 dark:border-gray-800"
        >
          <div className="flex items-start justify-between mb-4">
            <div className="flex-1">
              <div className="flex items-center gap-2 mb-2">
                <span className={`px-2 py-0.5 text-xs font-medium rounded-full ${STATUS_STYLES[plan.status].badge}`}>
                  {plan.status === "active" ? "进行中" : plan.status === "completed" ? "已完成" : plan.status === "paused" ? "已暂停" : "已归档"}
                </span>
                {editingProgress ? (
                  <div className="flex items-center gap-1">
                    <input
                      type="number"
                      min="0"
                      max="100"
                      value={progressValue}
                      onChange={(e) => setProgressValue(Number(e.target.value))}
                      onKeyDown={(e) => { if (e.key === "Enter") handleSaveProgress(); if (e.key === "Escape") setEditingProgress(false); }}
                      className="w-14 px-1.5 py-0.5 text-xs rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-center"
                      autoFocus
                    />
                    <span className="text-xs text-gray-400">%</span>
                    <button onClick={handleSaveProgress} className="px-1.5 py-0.5 text-xs bg-indigo-500 text-white rounded">保存</button>
                    <button onClick={() => setEditingProgress(false)} className="p-0.5 text-gray-400"><X className="w-3 h-3" /></button>
                  </div>
                ) : (
                  <button onClick={handleStartEditProgress} className="text-xs text-gray-400 hover:text-indigo-500 flex items-center gap-0.5">
                    进度 {plan.progress}% <Edit2 className="w-2.5 h-2.5" />
                  </button>
                )}
              </div>
              <div className="h-2 bg-gray-100 dark:bg-gray-800 rounded-full overflow-hidden">
                <motion.div
                  initial={{ width: 0 }}
                  animate={{ width: `${plan.progress}%` }}
                  transition={{ duration: 0.5 }}
                  className="h-full bg-gradient-to-r from-indigo-500 to-purple-500 rounded-full"
                />
              </div>
              {plan.progressLocked && (
                <div className="mt-2 flex items-center gap-2">
                  <span className="text-xs text-amber-600 dark:text-amber-400 flex items-center gap-1">
                    <Lock className="w-3 h-3" /> 已锁定手动值
                  </span>
                  <button
                    onClick={handleUnlockRecalculate}
                    className="text-xs text-indigo-500 hover:text-indigo-700 flex items-center gap-1"
                  >
                    <Unlock className="w-3 h-3" /> 解锁自动计算
                  </button>
                </div>
              )}
              {/* 依赖管理 */}
              <button
                onClick={() => setShowDependencySheet(true)}
                className="mt-3 flex items-center gap-1.5 text-xs text-gray-500 dark:text-gray-400 hover:text-indigo-500 transition-colors"
              >
                <Link2 className="w-3.5 h-3.5" />
                依赖设置 ({predecessors.length})
              </button>

              {predecessors.length > 0 && (
                <div className="mt-2 space-y-1">
                  {predecessors.map(p => (
                    <div key={p.id} className="flex items-center justify-between text-xs">
                      <div className="flex items-center gap-1.5">
                        <span className={`w-1.5 h-1.5 rounded-full ${p.status === "completed" ? "bg-green-500" : "bg-gray-400"}`} />
                        <span className="text-gray-600 dark:text-gray-400">{p.name}</span>
                        <span className="text-gray-400">{p.progress}%</span>
                      </div>
                      <button
                        onClick={() => handleRemoveDependency(p.id)}
                        className="text-red-400 hover:text-red-500"
                      >
                        <X className="w-3 h-3" />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="relative">
              <button
                onClick={() => setShowMoreMenu(!showMoreMenu)}
                className="p-2 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg"
              >
                <MoreHorizontal className="w-5 h-5 text-gray-400" />
              </button>
              <AnimatePresence>
                {showMoreMenu && (
                  <motion.div
                    initial={{ opacity: 0, y: 4 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: 4 }}
                    className="absolute right-0 top-full mt-1 w-32 bg-white dark:bg-gray-900 rounded-xl shadow-lg border border-gray-100 dark:border-gray-800 py-1 z-50"
                  >
                    <button className="w-full flex items-center gap-2 px-3 py-2 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800">
                      <Edit2 className="w-4 h-4" /> 编辑
                    </button>
                    <button
                      onClick={() => handleUpdateStatus(plan.status === "paused" ? "active" : "paused")}
                      className="w-full flex items-center gap-2 px-3 py-2 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800"
                    >
                      {plan.status === "paused" ? <Play className="w-4 h-4" /> : <Pause className="w-4 h-4" />}
                      {plan.status === "paused" ? "恢复" : "暂停"}
                    </button>
                    <button
                      onClick={() => handleUpdateStatus("archived")}
                      className="w-full flex items-center gap-2 px-3 py-2 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800"
                    >
                      <Archive className="w-4 h-4" /> 归档
                    </button>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </div>

          <div className="grid grid-cols-3 gap-3 pt-3 border-t border-gray-100 dark:border-gray-800">
            <div className="text-center">
              <p className="text-xs text-gray-400 mb-1">任务总数</p>
              <p className="text-lg font-bold text-gray-900 dark:text-white">{tasks.length}</p>
            </div>
            <div className="text-center">
              <p className="text-xs text-gray-400 mb-1">已完成</p>
              <p className="text-lg font-bold text-green-500">{completedCount}</p>
            </div>
            <div className="text-center">
              <p className="text-xs text-gray-400 mb-1">权重</p>
              <p className="text-lg font-bold text-gray-900 dark:text-white">{plan.weight}</p>
            </div>
          </div>

          {(plan.startDate || plan.endDate) && (
            <div className="flex items-center gap-4 mt-4 pt-3 border-t border-gray-100 dark:border-gray-800">
              {plan.startDate && (
                <div className="flex items-center gap-1.5 text-xs text-gray-400">
                  <Calendar className="w-3.5 h-3.5" />
                  <span>开始: {plan.startDate}</span>
                </div>
              )}
              {plan.endDate && (
                <div className="flex items-center gap-1.5 text-xs text-gray-400">
                  <Clock className="w-3.5 h-3.5" />
                  <span>结束: {plan.endDate}</span>
                </div>
              )}
            </div>
          )}
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="space-y-3"
        >
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold text-gray-900 dark:text-white flex items-center gap-2">
              <ListTodo className="w-4 h-4 text-indigo-500" />
              任务列表
              <span className="text-xs text-gray-400 font-normal">({completedCount}/{tasks.length})</span>
            </h2>
            <button
              onClick={() => setShowAddTask(true)}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-indigo-600 bg-indigo-50 dark:bg-indigo-900/20 rounded-xl hover:bg-indigo-100 transition-colors"
            >
              <Plus className="w-3.5 h-3.5" />
              添加任务
            </button>
          </div>

          {tasks.length > 0 ? (
            <div className="space-y-2">
              {tasks.map(task => (
                <TaskItem
                  key={task.id}
                  task={task}
                  onToggle={handleToggleTask}
                  onDelete={handleDeleteTask}
                  onEdit={(t) => { setEditingTask(t); setShowEditModal(true); }}
                  goal={goal}
                />
              ))}
            </div>
          ) : (
            <div className="bg-white dark:bg-gray-900 rounded-xl p-6 text-center border border-gray-100 dark:border-gray-800">
              <ListTodo className="w-8 h-8 text-gray-300 mx-auto mb-2" />
              <p className="text-sm text-gray-400">暂无任务</p>
              <button
                onClick={() => setShowAddTask(true)}
                className="mt-2 text-xs text-indigo-500 hover:text-indigo-600"
              >
                添加第一个任务
              </button>
            </div>
          )}
        </motion.div>
      </div>

      <AnimatePresence>
        {showAddTask && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 bg-black/40 flex items-end justify-center"
            onClick={() => setShowAddTask(false)}
          >
            <motion.div
              initial={{ y: "100%" }}
              animate={{ y: 0 }}
              exit={{ y: "100%" }}
              transition={{ type: "spring", stiffness: 400, damping: 40 }}
              onClick={(e) => e.stopPropagation()}
              className="w-full max-w-lg bg-white dark:bg-gray-900 rounded-t-2xl p-6"
            >
              <div className="w-10 h-1 bg-gray-300 dark:bg-gray-700 rounded-full mx-auto mb-4" />
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">添加任务</h3>
              <input
                type="text"
                value={newTaskTitle}
                onChange={(e) => setNewTaskTitle(e.target.value)}
                placeholder="任务名称"
                className="w-full px-4 py-3 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-sm text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500 mb-4"
                autoFocus
                onKeyDown={(e) => e.key === "Enter" && handleAddTask()}
              />
              <div className="flex gap-3">
                <button
                  onClick={() => setShowAddTask(false)}
                  className="flex-1 py-3 rounded-xl border border-gray-200 dark:border-gray-700 text-sm text-gray-500"
                >
                  取消
                </button>
                <button
                  onClick={handleAddTask}
                  disabled={!newTaskTitle.trim()}
                  className="flex-1 py-3 rounded-xl bg-indigo-600 text-white text-sm font-medium hover:bg-indigo-700 disabled:opacity-40"
                >
                  添加
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {showEditModal && editingTask && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 bg-black/40 flex items-end justify-center"
            onClick={() => setShowEditModal(false)}
          >
            <motion.div
              initial={{ y: "100%" }}
              animate={{ y: 0 }}
              exit={{ y: "100%" }}
              transition={{ type: "spring", stiffness: 400, damping: 40 }}
              onClick={(e) => e.stopPropagation()}
              className="w-full max-w-lg bg-white dark:bg-gray-900 rounded-t-2xl p-6"
            >
              <div className="w-10 h-1 bg-gray-300 dark:bg-gray-700 rounded-full mx-auto mb-4" />
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">编辑任务</h3>
              <input
                type="text"
                value={editingTask.title}
                onChange={(e) => setEditingTask({ ...editingTask, title: e.target.value })}
                className="w-full px-4 py-3 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-sm text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500 mb-4"
                autoFocus
              />
              <div className="flex gap-3">
                <button
                  onClick={() => setShowEditModal(false)}
                  className="flex-1 py-3 rounded-xl border border-gray-200 dark:border-gray-700 text-sm text-gray-500"
                >
                  取消
                </button>
                <button
                  onClick={handleEditTask}
                  className="flex-1 py-3 rounded-xl bg-indigo-600 text-white text-sm font-medium hover:bg-indigo-700"
                >
                  保存
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {showDependencySheet && (
          <motion.div
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 bg-black/40 flex items-end justify-center"
            onClick={() => setShowDependencySheet(false)}
          >
            <motion.div
              initial={{ y: "100%" }} animate={{ y: 0 }} exit={{ y: "100%" }}
              transition={{ type: "spring", stiffness: 400, damping: 40 }}
              onClick={(e) => e.stopPropagation()}
              className="w-full max-w-lg bg-white dark:bg-gray-900 rounded-t-2xl p-6 max-h-[60vh] overflow-y-auto"
            >
              <div className="w-10 h-1 bg-gray-300 dark:bg-gray-700 rounded-full mx-auto mb-4" />
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">依赖设置</h3>
              <p className="text-xs text-gray-500 dark:text-gray-400 mb-4">
                设置前置计划后，需先完成前置计划才能解锁当前计划
              </p>

              {predecessors.length > 0 && (
                <div className="mb-4">
                  <p className="text-xs font-medium text-gray-500 mb-2">当前前置计划</p>
                  <div className="space-y-2">
                    {predecessors.map(p => (
                      <div key={p.id} className="flex items-center justify-between p-2 bg-gray-50 dark:bg-gray-800 rounded-lg">
                        <div className="flex items-center gap-2">
                          <span className={`w-2 h-2 rounded-full ${p.status === "completed" ? "bg-green-500" : "bg-gray-400"}`} />
                          <span className="text-sm text-gray-700 dark:text-gray-300">{p.name}</span>
                          <span className="text-xs text-gray-400">{p.progress}%</span>
                        </div>
                        <button onClick={() => handleRemoveDependency(p.id)} className="p-1 text-red-400 hover:text-red-500">
                          <X className="w-4 h-4" />
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {availablePlans.length > 0 && (
                <div>
                  <p className="text-xs font-medium text-gray-500 mb-2">添加前置计划</p>
                  <div className="space-y-1">
                    {availablePlans.map(p => (
                      <button
                        key={p.id}
                        onClick={() => handleAddDependency(p.id!)}
                        className="w-full flex items-center gap-2 p-2 hover:bg-gray-50 dark:hover:bg-gray-800 rounded-lg text-left"
                      >
                        <Plus className="w-4 h-4 text-indigo-500" />
                        <span className="text-sm text-gray-700 dark:text-gray-300">{p.name}</span>
                        <span className="text-xs text-gray-400 ml-auto">{p.progress}%</span>
                      </button>
                    ))}
                  </div>
                </div>
              )}

              <button
                onClick={() => setShowDependencySheet(false)}
                className="mt-4 w-full py-3 rounded-xl border border-gray-200 dark:border-gray-700 text-sm text-gray-500"
              >
                关闭
              </button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}