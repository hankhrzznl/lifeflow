"use client";

import { useState, useEffect, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import {
  ArrowLeft, ChevronRight, Target, Plus, MoreHorizontal, Edit2, Archive,
  Play, Pause, Lock, Unlock, AlertCircle, X,
  Tag, Trash2, Bookmark, Sparkles, AlertTriangle,
} from "lucide-react";
import { getProjectV2, getGoal, getPlansByGoal, createPlan, updateGoal, deleteGoal, deletePlan, db } from "@/lib/db";
import { recalculateGoalProgress } from "@/lib/linkage";
import { showToast } from "@/components/ui/Toast";
import { HeatmapGrid } from "@/components/HeatmapGrid";
import type { ProjectV2, Goal, Plan, Priority, GoalStatus, GoalTemplate, Task } from "@/lib/types";
import { isAIEnabled, isOnline } from "@/lib/aiClient";
import { checkGoalWarning, applySuggestion } from "@/lib/goalWarning";
import type { WarningResult } from "@/lib/goalWarning";

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

function PlanCard({
  plan,
  onView,
  onEdit,
  onDelete,
  goalStatus,
}: {
  plan: Plan;
  onView: (id: number) => void;
  onEdit: (plan: Plan) => void;
  onDelete: (id: number) => void;
  goalStatus: GoalStatus;
}) {
  const isPaused = goalStatus === "paused";

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      className={`bg-white dark:bg-gray-900 rounded-xl p-4 border border-gray-100 dark:border-gray-800 ${isPaused ? "opacity-60" : ""}`}
    >
      <div className="flex items-start justify-between">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <span className={`px-2 py-0.5 text-xs font-medium rounded-full ${STATUS_STYLES[plan.status].badge}`}>
              {plan.status === "active" ? "进行中" : plan.status === "completed" ? "已完成" : plan.status === "paused" ? "已暂停" : "已归档"}
            </span>
            <span className="text-xs text-gray-400">进度 {plan.progress}%</span>
          </div>
          <h3 className="text-sm font-semibold text-gray-900 dark:text-white truncate">{plan.name}</h3>
          <div className="h-1.5 bg-gray-100 dark:bg-gray-800 rounded-full mt-2 overflow-hidden">
            <motion.div
              initial={{ width: 0 }}
              animate={{ width: `${plan.progress}%` }}
              transition={{ duration: 0.5 }}
              className="h-full bg-gradient-to-r from-indigo-500 to-purple-500 rounded-full"
            />
          </div>
          <div className="flex items-center gap-4 mt-3 text-xs text-gray-400">
            <span>权重: {plan.weight}</span>
            {plan.startDate && <span>开始: {plan.startDate}</span>}
            {plan.endDate && <span>结束: {plan.endDate}</span>}
          </div>
        </div>
        <div className="flex items-center gap-1 ml-3">
          <button
            onClick={() => onView(plan.id!)}
            className="p-1.5 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg"
          >
            <ChevronRight className="w-4 h-4 text-gray-400" />
          </button>
          <button
            onClick={() => onEdit(plan)}
            className="p-1.5 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg"
          >
            <Edit2 className="w-4 h-4 text-gray-400" />
          </button>
          <button
            onClick={() => onDelete(plan.id!)}
            className="p-1.5 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg"
          >
            <Trash2 className="w-4 h-4 text-red-400" />
          </button>
        </div>
      </div>
    </motion.div>
  );
}

export default function GoalDetailPage() {
  const params = useParams();
  const router = useRouter();
  const goalId = Number(params.goalId);

  const [project, setProject] = useState<ProjectV2 | null>(null);
  const [goal, setGoal] = useState<Goal | null>(null);
  const [plans, setPlans] = useState<Plan[]>([]);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [showAddPlan, setShowAddPlan] = useState(false);
  const [newPlanName, setNewPlanName] = useState("");
  const [showEditModal, setShowEditModal] = useState(false);
  const [showMoreMenu, setShowMoreMenu] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [editingProgress, setEditingProgress] = useState(false);
  const [progressValue, setProgressValue] = useState(0);

  const [warning, setWarning] = useState<WarningResult | null>(null);
  // AI 补充任务面板暂未实装,仅保留入口按钮,故不读取 showAiSheet
  const [, setShowAiSheet] = useState(false);

  // 编辑信息表单
  const [editName, setEditName] = useState("");
  const [editPriority, setEditPriority] = useState<Priority>("not-urgent-important");
  const [editDeadline, setEditDeadline] = useState("");
  const [editWeight, setEditWeight] = useState(1);

  const loadData = useCallback(async () => {
    const g = await getGoal(goalId);
    setGoal(g || null);

    // 项目已降级为目标上的可选标签,以 goal.projectId 为准,兼容为空
    const p = g?.projectId != null ? await getProjectV2(g.projectId) : undefined;
    setProject(p || null);

    const goalPlans = await getPlansByGoal(goalId);
    setPlans(goalPlans);

    const goalTasks = await db.tasks.where("goalId").equals(goalId).toArray();
    setTasks(goalTasks);
    setLoaded(true);
    if (g && isAIEnabled() && isOnline()) {
      checkGoalWarning(goalId).then(result => {
        if (result.level !== "normal") setWarning(result);
      }).catch(() => {});
    }
  }, [goalId]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- 异步数据加载:从 Dexie 拉取目标详情是外部系统同步,effect 中触发属必要
    loadData();
  }, [loadData]);

  const handleAddPlan = useCallback(async () => {
    if (!newPlanName.trim() || !goal) return;

    await createPlan({
      goalId: goal.id!,
      name: newPlanName.trim(),
      weight: 1,
      status: "active",
      progress: 0,
      order: plans.length,
    });

    setNewPlanName("");
    setShowAddPlan(false);
    showToast({ message: "计划已创建", type: "success" });
    await loadData();
  }, [newPlanName, goal, plans.length, loadData]);

  const handleToggleProgressLock = useCallback(async () => {
    if (!goal) return;
    await updateGoal(goal.id!, { progressLocked: !goal.progressLocked });
    setGoal(prev => prev ? { ...prev, progressLocked: !prev.progressLocked } : null);
    showToast({ 
      message: goal.progressLocked ? "进度锁已解除" : "进度锁已启用", 
      type: "success" 
    });
  }, [goal]);

  const handleOpenEdit = useCallback(() => {
    if (!goal) return;
    setEditName(goal.name);
    setEditPriority(goal.priority || "not-urgent-important");
    setEditDeadline(goal.deadline ? new Date(goal.deadline).toISOString().slice(0, 10) : "");
    setEditWeight(goal.weight);
    setShowEditModal(true);
  }, [goal]);

  const handleSaveEdit = useCallback(async () => {
    if (!goal || !editName.trim()) return;
    await updateGoal(goal.id!, {
      name: editName.trim(),
      priority: editPriority,
      deadline: editDeadline ? new Date(editDeadline).getTime() : undefined,
      weight: editWeight,
    });
    setShowEditModal(false);
    showToast({ message: "目标信息已更新", type: "success" });
    await loadData();
  }, [goal, editName, editPriority, editDeadline, editWeight, loadData]);

  const handleStartEditProgress = useCallback(() => {
    if (!goal) return;
    setProgressValue(goal.progress);
    setEditingProgress(true);
  }, [goal]);

  const handleSaveProgress = useCallback(async () => {
    if (!goal) return;
    const v = Math.max(0, Math.min(100, Math.round(progressValue)));
    await updateGoal(goal.id!, { progress: v, progressLocked: true });
    setGoal(prev => prev ? { ...prev, progress: v, progressLocked: true } : null);
    setEditingProgress(false);
    showToast({ message: `进度已更新为 ${v}%（已锁定）`, type: "success" });
  }, [goal, progressValue]);

  const handleUnlockRecalculate = useCallback(async () => {
    if (!goal) return;
    await updateGoal(goal.id!, { progressLocked: false });
    await recalculateGoalProgress(goal.id!);
    const updated = await getGoal(goal.id!);
    setGoal(updated || { ...goal, progressLocked: false });
    showToast({ message: "已解锁，进度已自动重算", type: "success" });
  }, [goal]);

  const handleUpdateStatus = useCallback(async (status: GoalStatus) => {
    if (!goal) return;
    await updateGoal(goal.id!, { status });
    setGoal(prev => prev ? { ...prev, status } : null);
    setShowMoreMenu(false);
    showToast({ 
      message: status === "paused" ? "目标已暂停" : status === "active" ? "目标已恢复" : "目标已归档", 
      type: "success" 
    });
    await loadData();
  }, [goal, loadData]);

  const handleDeleteGoal = useCallback(async () => {
    if (!goal) return;
    await deleteGoal(goal.id!, true);
    showToast({ message: "目标已删除", type: "success" });
    router.push(`/planner`);
  }, [goal, router]);

  const handleSaveAsTemplate = useCallback(async () => {
    if (!goal) return;
    try {
      const plans = await getPlansByGoal(goal.id!);
      const templatePlans = await Promise.all(plans.map(async (plan) => {
        const tasks = await (() => {
          return db.tasks.where("planId").equals(plan.id!).toArray();
        })();
        return {
          name: plan.name,
          weight: plan.weight,
          daysOffset: 0,
          tasks: tasks.map(t => ({
            title: t.title,
            weight: t.weight || 1,
            type: t.type,
          })),
        };
      }));

      const template: GoalTemplate = {
        name: goal.name,
        description: goal.description || "",
        category: "custom",
        type: goal.type,
        icon: "📋",
        deadlineDays: goal.deadline ? Math.ceil((goal.deadline - goal.createdAt) / (24 * 60 * 60 * 1000)) : 30,
        plans: templatePlans,
        isBuiltIn: false,
        createdAt: Date.now(),
        updatedAt: Date.now(),
      };

      await db.goalTemplates.add(template);
      showToast({ message: "已保存为模板", type: "success" });
    } catch {
      showToast({ message: "保存失败", type: "error" });
    }
  }, [goal]);

  if (loaded && !goal) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-950 flex flex-col items-center justify-center gap-3">
        <Target className="w-8 h-8 text-gray-300" />
        <p className="text-sm text-gray-400">目标不存在或已删除</p>
        <button
          onClick={() => router.push("/planner")}
          className="text-xs text-indigo-500 hover:text-indigo-600"
        >
          返回规划
        </button>
      </div>
    );
  }

  if (!loaded || !goal) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-950 flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-indigo-400 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  const priorityConfig = PRIORITY_CONFIG.find(p => p.key === goal.priority);

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-50 to-white dark:from-gray-950 dark:to-gray-900">
      <div className="mx-auto max-w-3xl px-5 py-6 pb-24">
        <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="mb-6">
          <button
            onClick={() => router.push(`/planner`)}
            className="flex items-center gap-2 text-sm text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 mb-4"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>返回规划</span>
          </button>

          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-xl font-bold text-gray-900 dark:text-white">{goal.name}</h1>
              {project && (
                <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">{project.name}</p>
              )}
            </div>
            <div className="flex items-center">
              <button
                onClick={handleSaveAsTemplate}
                className="mr-1 p-2 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg"
                title="保存为模板"
              >
                <Bookmark className="w-5 h-5 text-gray-400" />
              </button>
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
                    className="absolute right-0 top-full mt-1 w-36 bg-white dark:bg-gray-900 rounded-xl shadow-lg border border-gray-100 dark:border-gray-800 py-1 z-50"
                  >
                    <button
                      onClick={() => { setShowMoreMenu(false); handleOpenEdit(); }}
                      className="w-full flex items-center gap-2 px-3 py-2 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800"
                    >
                      <Edit2 className="w-4 h-4" /> 编辑信息
                    </button>
                    <button
                      onClick={() => handleUpdateStatus(goal.status === "paused" ? "active" : "paused")}
                      className="w-full flex items-center gap-2 px-3 py-2 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800"
                    >
                      {goal.status === "paused" ? <Play className="w-4 h-4" /> : <Pause className="w-4 h-4" />}
                      {goal.status === "paused" ? "恢复" : "暂停"}
                    </button>
                    <button
                      onClick={() => handleUpdateStatus("archived")}
                      className="w-full flex items-center gap-2 px-3 py-2 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800"
                    >
                      <Archive className="w-4 h-4" /> 归档
                    </button>
                    <div className="border-t border-gray-100 dark:border-gray-800 my-1" />
                    <button
                      onClick={() => { setShowMoreMenu(false); setShowDeleteConfirm(true); }}
                      className="w-full flex items-center gap-2 px-3 py-2 text-sm text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20"
                    >
                      <Trash2 className="w-4 h-4" /> 删除目标
                    </button>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
            </div>
          </div>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.05 }}
          className="bg-white dark:bg-gray-900 rounded-2xl p-5 mb-5 shadow-sm border border-gray-100 dark:border-gray-800"
        >
          <div className="flex items-center gap-2 mb-4">
            <span className={`px-2 py-0.5 text-xs font-medium rounded-full ${STATUS_STYLES[goal.status].badge}`}>
              {goal.status === "active" ? "进行中" : goal.status === "completed" ? "已完成" : goal.status === "paused" ? "已暂停" : "已归档"}
            </span>
            {priorityConfig && (
              <span className={`px-2 py-0.5 text-xs font-medium rounded-full ${priorityConfig.color}`}>
                {priorityConfig.label}
              </span>
            )}
            <button
              onClick={handleToggleProgressLock}
              className={`flex items-center gap-1 px-2 py-0.5 text-xs rounded-full ${
                goal.progressLocked 
                  ? "bg-orange-100 text-orange-600" 
                  : "bg-gray-100 text-gray-500"
              }`}
            >
              {goal.progressLocked ? <Lock className="w-3 h-3" /> : <Unlock className="w-3 h-3" />}
              {goal.progressLocked ? "进度锁定" : "进度自动"}
            </button>
          </div>

          <div className="mb-4">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm font-medium text-gray-700 dark:text-gray-300">目标进度</span>
              {editingProgress ? (
                <div className="flex items-center gap-1">
                  <input
                    type="number"
                    min="0"
                    max="100"
                    value={progressValue}
                    onChange={(e) => setProgressValue(Number(e.target.value))}
                    onKeyDown={(e) => { if (e.key === "Enter") handleSaveProgress(); if (e.key === "Escape") setEditingProgress(false); }}
                    className="w-16 px-2 py-0.5 text-sm rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-center"
                    autoFocus
                  />
                  <span className="text-xs text-gray-400">%</span>
                  <button onClick={handleSaveProgress} className="px-2 py-0.5 text-xs bg-indigo-500 text-white rounded-md">保存</button>
                  <button onClick={() => setEditingProgress(false)} className="p-0.5 text-gray-400"><X className="w-3.5 h-3.5" /></button>
                </div>
              ) : (
                <button
                  onClick={handleStartEditProgress}
                  className="text-sm font-bold text-indigo-600 hover:text-indigo-800 cursor-pointer flex items-center gap-1"
                >
                  {goal.progress}%
                  <Edit2 className="w-3 h-3 text-gray-400" />
                </button>
              )}
            </div>
            <div className="h-3 bg-gray-100 dark:bg-gray-800 rounded-full overflow-hidden">
              <motion.div
                initial={{ width: 0 }}
                animate={{ width: `${goal.progress}%` }}
                transition={{ duration: 0.5 }}
                className="h-full bg-gradient-to-r from-indigo-500 to-purple-500 rounded-full"
              />
            </div>
            {goal.progressLocked && (
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
          </div>

          {goal.description && (
            <div className="mb-4 p-3 bg-gray-50 dark:bg-gray-800 rounded-xl">
              <p className="text-sm text-gray-600 dark:text-gray-400">{goal.description}</p>
            </div>
          )}

          <div className="grid grid-cols-2 gap-3">
            <div className="bg-gray-50 dark:bg-gray-800 rounded-xl p-3">
              <p className="text-xs text-gray-400 mb-1">权重</p>
              <p className="text-lg font-bold text-gray-900 dark:text-white">{goal.weight}</p>
            </div>
            {goal.deadline && (
              <div className="bg-gray-50 dark:bg-gray-800 rounded-xl p-3">
                <p className="text-xs text-gray-400 mb-1">截止日期</p>
                <p className="text-sm font-medium text-gray-900 dark:text-white">
                  {new Date(goal.deadline).toLocaleDateString("zh-CN")}
                </p>
              </div>
            )}
          </div>

          {goal.tags && goal.tags.length > 0 && (
            <div className="flex flex-wrap gap-2 mt-4">
              {goal.tags.map(tag => (
                <span key={tag} className="text-xs px-2 py-1 rounded-full bg-violet-100 text-violet-600 flex items-center gap-1">
                  <Tag className="w-3 h-3" /> {tag}
                </span>
              ))}
            </div>
          )}

          {/* 完成热力图 */}
          {(() => {
            const last3Months = new Date();
            last3Months.setMonth(last3Months.getMonth() - 3);
            const taskDates = tasks.filter(t => t.status === "done").map(t => {
              const d = new Date(t.updatedAt || t.createdAt);
              return d.toISOString().slice(0, 10);
            });
            const dateCounts = taskDates.reduce((acc: Record<string, number>, d) => { acc[d] = (acc[d] || 0) + 1; return acc; }, {});
            const maxCount = Math.max(1, ...Object.values(dateCounts));
            const heatmapData = Object.entries(dateCounts).map(([date, count]) => ({ date, count, maxCount }));
            
            return heatmapData.length > 0 ? (
              <div className="mt-4 pt-4 border-t border-gray-100 dark:border-gray-800">
                <p className="text-xs font-medium text-gray-500 dark:text-gray-400 mb-2">完成热力图</p>
                <HeatmapGrid data={heatmapData} months={3} />
              </div>
            ) : null;
          })()}
        </motion.div>

        {warning && (
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.08 }}
            className={`p-3 rounded-xl mb-4 ${
              warning.level === "danger" ? "bg-red-50 dark:bg-red-900/20" : "bg-amber-50 dark:bg-amber-900/20"
            }`}
          >
            <div className="flex items-center gap-2 mb-1">
              <AlertTriangle className={`w-4 h-4 ${warning.level === "danger" ? "text-red-500" : "text-amber-500"}`} />
              <span className={`text-sm font-medium ${warning.level === "danger" ? "text-red-700 dark:text-red-400" : "text-amber-700 dark:text-amber-400"}`}>
                {warning.level === "danger" ? "严重滞后预警" : "进度预警"}
              </span>
            </div>
            <p className="text-xs text-gray-600 dark:text-gray-400 mb-2">{warning.reason}</p>
            {warning.suggestions.slice(0, 2).map((s, i) => (
              <button
                key={i}
                onClick={() => {
                  if (s.includes("延长截止日期")) applySuggestion(goalId, "extendDeadline", { days: 7 });
                  else applySuggestion(goalId, "increasePace");
                  checkGoalWarning(goalId).then(r => setWarning(r.level !== "normal" ? r : null));
                }}
                className="block w-full text-left text-xs text-indigo-600 dark:text-indigo-400 hover:underline mt-1"
              >
                ⚡ {s}
              </button>
            ))}
          </motion.div>
        )}

        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
        >
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-sm font-semibold text-gray-900 dark:text-white flex items-center gap-2">
              <Target className="w-4 h-4 text-indigo-500" />
              计划列表
              <span className="text-xs text-gray-400 font-normal">({plans.length})</span>
            </h2>
            <button
              onClick={() => setShowAddPlan(true)}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-indigo-600 bg-indigo-50 dark:bg-indigo-900/20 rounded-xl hover:bg-indigo-100 transition-colors"
            >
              <Plus className="w-3.5 h-3.5" />
              添加计划
            </button>
            {isAIEnabled() && isOnline() && (
              <button
                onClick={() => setShowAiSheet(true)}
                className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-violet-600 bg-violet-50 dark:bg-violet-900/20 rounded-xl hover:bg-violet-100 transition-colors"
              >
                <Sparkles className="w-3.5 h-3.5" />
                AI 补充任务
              </button>
            )}
          </div>

          {plans.length > 0 ? (
            <div className="space-y-3">
              {plans.map((plan) => (
                <PlanCard
                  key={plan.id}
                  plan={plan}
                  onView={(id) => router.push(`/plans/${id}`)}
                  onEdit={() => {}}
                  onDelete={async (id) => {
                    await deletePlan(id, true);
                    showToast({ message: "计划已删除", type: "success" });
                    await loadData();
                  }}
                  goalStatus={goal.status}
                />
              ))}
            </div>
          ) : (
            <div className="bg-white dark:bg-gray-900 rounded-xl p-6 text-center border border-gray-100 dark:border-gray-800">
              <Target className="w-8 h-8 text-gray-300 mx-auto mb-2" />
              <p className="text-sm text-gray-400">暂无计划</p>
              <button
                onClick={() => setShowAddPlan(true)}
                className="mt-2 text-xs text-indigo-500 hover:text-indigo-600"
              >
                创建第一个计划
              </button>
            </div>
          )}
        </motion.div>
      </div>

      <AnimatePresence>
        {showAddPlan && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 bg-black/40 flex items-end justify-center"
            style={{ paddingBottom: "var(--bottom-nav-height)" }}
            onClick={() => setShowAddPlan(false)}
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
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">添加计划</h3>
              <input
                type="text"
                value={newPlanName}
                onChange={(e) => setNewPlanName(e.target.value)}
                placeholder="计划名称"
                className="w-full px-4 py-3 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-sm text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500 mb-4"
                autoFocus
                onKeyDown={(e) => e.key === "Enter" && handleAddPlan()}
              />
              <div className="flex gap-3">
                <button onClick={() => setShowAddPlan(false)} className="flex-1 py-3 rounded-xl border border-gray-200 dark:border-gray-700 text-sm text-gray-500">
                  取消
                </button>
                <button
                  onClick={handleAddPlan}
                  disabled={!newPlanName.trim()}
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
        {showEditModal && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 bg-black/40 flex items-end justify-center"
            style={{ paddingBottom: "var(--bottom-nav-height)" }}
            onClick={() => setShowEditModal(false)}
          >
            <motion.div
              initial={{ y: "100%" }}
              animate={{ y: 0 }}
              exit={{ y: "100%" }}
              transition={{ type: "spring", stiffness: 400, damping: 40 }}
              onClick={(e) => e.stopPropagation()}
              className="w-full max-w-lg bg-white dark:bg-gray-900 rounded-t-2xl p-6 max-h-[80vh] overflow-y-auto"
            >
              <div className="w-10 h-1 bg-gray-300 dark:bg-gray-700 rounded-full mx-auto mb-4" />
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">编辑目标信息</h3>

              <div className="space-y-4">
                <div>
                  <label className="block text-sm text-gray-500 mb-1">目标名称</label>
                  <input
                    type="text"
                    value={editName}
                    onChange={(e) => setEditName(e.target.value)}
                    className="w-full px-4 py-3 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    autoFocus
                    onKeyDown={(e) => e.key === "Enter" && handleSaveEdit()}
                  />
                </div>

                <div>
                  <label className="block text-sm text-gray-500 mb-1">优先级</label>
                  <div className="grid grid-cols-2 gap-2">
                    {PRIORITY_CONFIG.map(p => (
                      <button
                        key={p.key}
                        onClick={() => setEditPriority(p.key)}
                        className={`px-3 py-2 text-xs rounded-xl border transition-colors ${
                          editPriority === p.key
                            ? `${p.color} border-current font-medium`
                            : "border-gray-200 dark:border-gray-700 text-gray-500"
                        }`}
                      >
                        {p.label}
                      </button>
                    ))}
                  </div>
                </div>

                <div>
                  <label className="block text-sm text-gray-500 mb-1">截止日期</label>
                  <input
                    type="date"
                    value={editDeadline}
                    onChange={(e) => setEditDeadline(e.target.value)}
                    className="w-full px-4 py-3 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                </div>

                <div>
                  <label className="block text-sm text-gray-500 mb-1">权重 ({editWeight})</label>
                  <input
                    type="range"
                    min="1"
                    max="10"
                    value={editWeight}
                    onChange={(e) => setEditWeight(Number(e.target.value))}
                    className="w-full accent-indigo-500"
                  />
                </div>
              </div>

              <div className="flex gap-3 mt-6">
                <button onClick={() => setShowEditModal(false)} className="flex-1 py-3 rounded-xl border border-gray-200 dark:border-gray-700 text-sm text-gray-500">
                  取消
                </button>
                <button
                  onClick={handleSaveEdit}
                  disabled={!editName.trim()}
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
        {showDeleteConfirm && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4"
          >
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="w-full max-w-sm bg-white dark:bg-gray-900 rounded-2xl p-6"
            >
              <div className="w-12 h-12 rounded-full bg-red-100 dark:bg-red-900/20 flex items-center justify-center mx-auto mb-4">
                <AlertCircle className="w-6 h-6 text-red-500" />
              </div>
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white text-center mb-2">确认删除</h3>
              <p className="text-sm text-gray-500 dark:text-gray-400 text-center mb-6">
                删除后，下属计划和任务将移入未分类。确定要继续吗？
              </p>
              <div className="flex gap-3">
                <button
                  onClick={() => setShowDeleteConfirm(false)}
                  className="flex-1 py-3 rounded-xl border border-gray-200 dark:border-gray-700 text-sm text-gray-500"
                >
                  取消
                </button>
                <button
                  onClick={handleDeleteGoal}
                  className="flex-1 py-3 rounded-xl bg-red-500 text-white text-sm font-medium hover:bg-red-600"
                >
                  删除
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
