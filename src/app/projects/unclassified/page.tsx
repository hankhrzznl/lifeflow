"use client";

import { useState, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { ArrowLeft, Inbox, Trash2, CheckCircle, Circle, Plus, X, ChevronDown, Target, ListTodo } from "lucide-react";
import Link from "next/link";
import { getTasksByType, deleteTask, captureToTask, getAllProjectsV2, getGoalsByProject, getPlansByGoal, assignTasksToPlan } from "@/lib/db";
import { showToast } from "@/components/ui/Toast";
import type { Task, ProjectV2, Goal, Plan } from "@/lib/types";

function relativeTime(ts: number): string {
  const diff = Date.now() - ts;
  const m = Math.floor(diff / 60000);
  if (m < 60) return `${m}分钟前`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}小时前`;
  return `${Math.floor(h / 24)}天前`;
}

export default function UnclassifiedPage() {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedIds, setSelectedIds] = useState<number[]>([]);
  const [showAssignModal, setShowAssignModal] = useState(false);
  const [projects, setProjects] = useState<ProjectV2[]>([]);
  const [goals, setGoals] = useState<Goal[]>([]);
  const [plans, setPlans] = useState<Plan[]>([]);
  const [selectedProjectId, setSelectedProjectId] = useState<number | null>(null);
  const [selectedGoalId, setSelectedGoalId] = useState<number | null>(null);
  const [selectedPlanId, setSelectedPlanId] = useState<number | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [shortterm, daily, longterm, habit] = await Promise.all([
        getTasksByType("shortterm"),
        getTasksByType("daily"),
        getTasksByType("longterm"),
        getTasksByType("habit"),
      ]);
      const all = [...shortterm, ...daily, ...longterm, ...habit];
      const unclassified = all.filter(t => t.status === "active" && (!t.projectId || !t.planId));
      setTasks(unclassified);
    } catch (err) {
      console.error("Failed to load unclassified tasks:", err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  useEffect(() => {
    (async () => {
      try {
        const allProjects = await getAllProjectsV2();
        setProjects(allProjects);
      } catch (err) {
        console.error("Failed to load projects:", err);
      }
    })();
  }, []);

  useEffect(() => {
    if (selectedProjectId) {
      (async () => {
        const projectGoals = await getGoalsByProject(selectedProjectId);
        setGoals(projectGoals);
        setSelectedGoalId(null);
        setSelectedPlanId(null);
        setPlans([]);
      })();
    } else {
      setGoals([]);
      setSelectedGoalId(null);
      setSelectedPlanId(null);
      setPlans([]);
    }
  }, [selectedProjectId]);

  useEffect(() => {
    if (selectedGoalId) {
      (async () => {
        const goalPlans = await getPlansByGoal(selectedGoalId);
        setPlans(goalPlans);
        setSelectedPlanId(null);
      })();
    } else {
      setPlans([]);
      setSelectedPlanId(null);
    }
  }, [selectedGoalId]);

  const handleSelect = (id: number) => {
    setSelectedIds(prev => 
      prev.includes(id) 
        ? prev.filter(i => i !== id) 
        : [...prev, id]
    );
  };

  const handleSelectAll = () => {
    if (selectedIds.length === tasks.length) {
      setSelectedIds([]);
    } else {
      setSelectedIds(tasks.map(t => t.id!).filter(Boolean) as number[]);
    }
  };

  const handleQuickToday = async (id: number) => {
    const t = new Date();
    const start = new Date(t.getFullYear(), t.getMonth(), t.getDate()).getTime();
    await captureToTask(id, { startTime: start, endTime: start + 86400000 });
    showToast({ message: "已添加到今日", type: "success" });
    load();
  };

  const handleQuickTomorrow = async (id: number) => {
    const t = new Date(); t.setDate(t.getDate() + 1);
    const start = new Date(t.getFullYear(), t.getMonth(), t.getDate()).getTime();
    await captureToTask(id, { startTime: start, endTime: start + 86400000 });
    showToast({ message: "已添加到明天", type: "success" });
    load();
  };

  const handleDelete = async (id: number) => {
    await deleteTask(id);
    showToast({ message: "已删除", type: "info" });
    load();
  };

  const handleAssign = async () => {
    if (!selectedPlanId || selectedIds.length === 0) return;

    await assignTasksToPlan(selectedIds, selectedPlanId);
    showToast({ message: `已将 ${selectedIds.length} 个任务分配到目标`, type: "success" });
    setShowAssignModal(false);
    setSelectedIds([]);
    setSelectedProjectId(null);
    setSelectedGoalId(null);
    setSelectedPlanId(null);
    load();
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-50 to-white dark:from-gray-950 dark:to-gray-900">
      <div className="mx-auto max-w-3xl px-5 py-6 pb-24">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <Link href="/planner" className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800">
              <ArrowLeft className="w-5 h-5 text-gray-400" />
            </Link>
            <div className="w-10 h-10 rounded-xl bg-gray-100 dark:bg-gray-800 flex items-center justify-center">
              <Inbox className="w-5 h-5 text-gray-400" />
            </div>
            <div>
              <h1 className="text-lg font-bold text-gray-900 dark:text-white">未分类</h1>
              <p className="text-xs text-gray-400">暂无归属的想法 ({tasks.length})</p>
            </div>
          </div>

          {selectedIds.length > 0 && (
            <button
              onClick={() => setShowAssignModal(true)}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-indigo-600 bg-indigo-50 dark:bg-indigo-900/20 rounded-xl hover:bg-indigo-100 transition-colors"
            >
              <Plus className="w-3.5 h-3.5" />
              分配 ({selectedIds.length})
            </button>
          )}
        </div>

        {loading ? (
          <div className="flex justify-center py-20">
            <div className="w-8 h-8 border-2 border-gray-300 border-t-gray-600 rounded-full animate-spin" />
          </div>
        ) : tasks.length === 0 ? (
          <div className="text-center py-20">
            <Inbox className="w-10 h-10 text-gray-300 mx-auto mb-3" />
            <p className="text-sm text-gray-400">暂无未分类的想法</p>
          </div>
        ) : (
          <div className="space-y-2">
            <div className="flex items-center gap-2 p-2 bg-gray-50 dark:bg-gray-800 rounded-xl">
              <button
                onClick={handleSelectAll}
                className="p-1.5 hover:bg-gray-200 dark:hover:bg-gray-700 rounded-lg"
              >
                {selectedIds.length === tasks.length ? (
                  <CheckCircle className="w-4 h-4 text-indigo-500" />
                ) : (
                  <Circle className="w-4 h-4 text-gray-400" />
                )}
              </button>
              <span className="text-xs text-gray-400">全选</span>
            </div>

            {tasks.map((task) => (
              <motion.div
                key={task.id}
                initial={{ opacity: 0, y: -4 }}
                animate={{ opacity: 1, y: 0 }}
                className={`bg-white dark:bg-gray-900 rounded-xl border ${
                  selectedIds.includes(task.id!) 
                    ? "border-indigo-300 dark:border-indigo-700" 
                    : "border-gray-100 dark:border-gray-800"
                } p-3`}
              >
                <div className="flex items-start gap-3">
                  <button
                    onClick={() => handleSelect(task.id!)}
                    className="mt-0.5 p-1.5 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg"
                  >
                    {selectedIds.includes(task.id!) ? (
                      <CheckCircle className="w-4 h-4 text-indigo-500" />
                    ) : (
                      <Circle className="w-4 h-4 text-gray-300 dark:text-gray-600" />
                    )}
                  </button>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm text-gray-800 dark:text-gray-200">{task.title}</p>
                    <div className="flex items-center gap-2 mt-2">
                      <span className="text-xs text-gray-400">{relativeTime(task.createdAt)}</span>
                      {task.projectId && !task.planId && (
                        <span className="text-xs px-1.5 py-0.5 rounded bg-blue-50 dark:bg-blue-900/20 text-blue-600">
                          已分配项目
                        </span>
                      )}
                      {!task.projectId && (
                        <span className="text-xs px-1.5 py-0.5 rounded bg-gray-50 dark:bg-gray-800 text-gray-500">
                          未分配
                        </span>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-1">
                    <button onClick={() => handleQuickToday(task.id!)} className="p-1.5 text-xs bg-amber-50 dark:bg-amber-900/20 text-amber-600 rounded-lg hover:bg-amber-100">今日</button>
                    <button onClick={() => handleQuickTomorrow(task.id!)} className="p-1.5 text-xs bg-blue-50 dark:bg-blue-900/20 text-blue-600 rounded-lg hover:bg-blue-100">明天</button>
                    <button onClick={() => handleDelete(task.id!)} className="p-1.5 text-xs bg-red-50 dark:bg-red-900/20 text-red-500 rounded-lg hover:bg-red-100"><Trash2 className="w-3 h-3" /></button>
                  </div>
                </div>
              </motion.div>
            ))}
          </div>
        )}
      </div>

      <AnimatePresence>
        {showAssignModal && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 bg-black/40 flex items-end justify-center"
            onClick={() => {
              setShowAssignModal(false);
              setSelectedProjectId(null);
              setSelectedGoalId(null);
              setSelectedPlanId(null);
            }}
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
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">分配到目标</h3>
              <p className="text-xs text-gray-400 mb-4">已选择 {selectedIds.length} 个任务</p>

              <div className="space-y-4">
                <div>
                  <label className="text-xs font-medium text-gray-700 dark:text-gray-300 mb-1.5 block flex items-center gap-1">
                    <Target className="w-3.5 h-3.5" />
                    选择项目
                  </label>
                  <div className="relative">
                    <select
                      value={selectedProjectId || ""}
                      onChange={(e) => setSelectedProjectId(e.target.value ? Number(e.target.value) : null)}
                      className="w-full px-4 py-3 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-sm text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500 appearance-none"
                    >
                      <option value="">请选择项目</option>
                      {projects.map(p => (
                        <option key={p.id} value={p.id}>{p.name}</option>
                      ))}
                    </select>
                    <ChevronDown className="w-4 h-4 text-gray-400 absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                  </div>
                </div>

                <div>
                  <label className="text-xs font-medium text-gray-700 dark:text-gray-300 mb-1.5 block flex items-center gap-1">
                    <Target className="w-3.5 h-3.5" />
                    选择目标
                  </label>
                  <div className="relative">
                    <select
                      value={selectedGoalId || ""}
                      onChange={(e) => setSelectedGoalId(e.target.value ? Number(e.target.value) : null)}
                      disabled={!selectedProjectId}
                      className="w-full px-4 py-3 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-sm text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500 appearance-none disabled:opacity-50"
                    >
                      <option value="">请选择目标</option>
                      {goals.map(g => (
                        <option key={g.id} value={g.id}>{g.name}</option>
                      ))}
                    </select>
                    <ChevronDown className="w-4 h-4 text-gray-400 absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                  </div>
                </div>

                <div>
                  <label className="text-xs font-medium text-gray-700 dark:text-gray-300 mb-1.5 block flex items-center gap-1">
                    <ListTodo className="w-3.5 h-3.5" />
                    选择计划
                  </label>
                  <div className="relative">
                    <select
                      value={selectedPlanId || ""}
                      onChange={(e) => setSelectedPlanId(e.target.value ? Number(e.target.value) : null)}
                      disabled={!selectedGoalId}
                      className="w-full px-4 py-3 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-sm text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500 appearance-none disabled:opacity-50"
                    >
                      <option value="">请选择计划</option>
                      {plans.map(p => (
                        <option key={p.id} value={p.id}>{p.name}</option>
                      ))}
                    </select>
                    <ChevronDown className="w-4 h-4 text-gray-400 absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                  </div>
                </div>
              </div>

              <div className="flex gap-3 mt-6">
                <button
                  onClick={() => {
                    setShowAssignModal(false);
                    setSelectedProjectId(null);
                    setSelectedGoalId(null);
                    setSelectedPlanId(null);
                  }}
                  className="flex-1 py-3 rounded-xl border border-gray-200 dark:border-gray-700 text-sm text-gray-500"
                >
                  取消
                </button>
                <button
                  onClick={handleAssign}
                  disabled={!selectedPlanId}
                  className="flex-1 py-3 rounded-xl bg-indigo-600 text-white text-sm font-medium hover:bg-indigo-700 disabled:opacity-40"
                >
                  确认分配
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}