"use client";

import { useState, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Check, Calendar, Inbox, Edit3, X, Target } from "lucide-react";
import { useRouter } from "next/navigation";
import { db, updateTask, getTasksByType } from "@/lib/db";
import { completeTask, uncompleteTask } from "@/lib/linkage";
import { PRIORITY_CONFIG } from "@/lib/types";
import type { Task, Priority, Goal } from "@/lib/types";
import { showToast } from "@/components/ui/Toast";

interface TodayTabProps {
  onUpdate?: () => void;
}

function getTodayRange() {
  const now = new Date();
  const start = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  const end = start + 24 * 60 * 60 * 1000;
  return { start, end };
}

const TAG_STYLES: Record<string, string> = {
  "考公": "bg-orange-100 text-orange-700",
  "毕业": "bg-violet-100 text-violet-700",
  "运动": "bg-pink-100 text-pink-700",
  "睡眠": "bg-indigo-100 text-indigo-700",
  "体态": "bg-teal-100 text-teal-700",
};

function getTagStyle(tag: string): string {
  return TAG_STYLES[tag] ?? "bg-gray-100 text-gray-600";
}

function getPriorityLevel(priority?: Priority): number {
  const levels: Record<Priority, number> = {
    "urgent-important": 4,
    "not-urgent-important": 3,
    "urgent-not-important": 2,
    "not-urgent-not-important": 1,
  };
  return priority ? levels[priority] : 0;
}

function formatDate(ts: number): string {
  const d = new Date(ts);
  return `${d.getMonth() + 1}月${d.getDate()}日`;
}

const containerVariants = {
  hidden: {},
  show: {
    transition: { staggerChildren: 0.08 },
  },
};

const itemVariants = {
  hidden: { opacity: 0, x: -12 },
  show: { opacity: 1, x: 0, transition: { duration: 0.35 } },
};

export default function TodayTab({ onUpdate }: TodayTabProps) {
  const router = useRouter();
  const [tasks, setTasks] = useState<Task[]>([]);
  const [goals, setGoals] = useState<Goal[]>([]);
  const [loading, setLoading] = useState(true);
  const [completedIds, setCompletedIds] = useState<Set<number>>(new Set());
  const [editingTaskId, setEditingTaskId] = useState<number | null>(null);
  const [editTitle, setEditTitle] = useState("");
  const [hoveredGoalId, setHoveredGoalId] = useState<number | null>(null);

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const { start, end } = getTodayRange();
      
      const [shortterm, daily, longterm, habit] = await Promise.all([
        getTasksByType("shortterm"),
        getTasksByType("daily"),
        getTasksByType("longterm"),
        getTasksByType("habit"),
      ]);
      
      const allTasks = [...shortterm, ...daily, ...longterm, ...habit];
      const todayTasks = allTasks.filter(t => 
        t.status === "active" && 
        t.startTime != null && 
        t.startTime >= start && 
        t.startTime < end
      );

      const allGoals = await db.goals.toArray();
      setGoals(allGoals);

      const goalPriorityMap: Record<number, number> = {};
      allGoals.forEach(g => {
        if (g.id) {
          goalPriorityMap[g.id] = getPriorityLevel(g.priority);
        }
      });

      const sorted = [...todayTasks].sort((a, b) => {
        const goalPriorityA = a.goalId ? goalPriorityMap[a.goalId] || 0 : 0;
        const goalPriorityB = b.goalId ? goalPriorityMap[b.goalId] || 0 : 0;
        
        if (goalPriorityB !== goalPriorityA) {
          return goalPriorityB - goalPriorityA;
        }
        
        const taskPriorityA = getPriorityLevel(a.priority);
        const taskPriorityB = getPriorityLevel(b.priority);
        if (taskPriorityB !== taskPriorityA) {
          return taskPriorityB - taskPriorityA;
        }
        
        return (a.dueDate || Infinity) - (b.dueDate || Infinity);
      });

      setTasks(sorted);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- 异步数据加载:从 Dexie 拉取今日任务是外部系统同步,effect 中触发属必要
    loadData();
  }, [loadData]);

  const getGoalForTask = (task: Task): Goal | undefined => {
    return goals.find(g => g.id === task.goalId);
  };

  const handleComplete = useCallback(
    async (task: Task) => {
      const id = task.id;
      if (!id) return;
      setCompletedIds((prev) => new Set(prev).add(id));
      try {
        await completeTask(id);
        showToast({ message: "已标记完成", type: "success" });
        onUpdate?.();
      } catch {
        setCompletedIds((prev) => {
          const next = new Set(prev);
          next.delete(id);
          return next;
        });
        showToast({ message: "操作失败，请重试", type: "error" });
      }
    },
    [onUpdate]
  );

  const handleUncomplete = useCallback(
    async (task: Task) => {
      const id = task.id;
      if (!id) return;
      setCompletedIds((prev) => {
        const next = new Set(prev);
        next.delete(id);
        return next;
      });
      try {
        await uncompleteTask(id);
        showToast({ message: "已取消完成", type: "success" });
        onUpdate?.();
      } catch {
        setCompletedIds((prev) => new Set(prev).add(id));
        showToast({ message: "操作失败，请重试", type: "error" });
      }
    },
    [onUpdate]
  );

  const openEdit = useCallback((task: Task) => {
    setEditingTaskId(task.id ?? null);
    setEditTitle(task.title);
  }, []);

  const saveEditTitle = useCallback(async (taskId: number) => {
    if (!editTitle.trim()) return;
    try {
      await updateTask(taskId, { title: editTitle.trim() });
      showToast({ message: "标题已更新", type: "success" });
      setEditingTaskId(null);
      await loadData();
      onUpdate?.();
    } catch {
      showToast({ message: "更新失败", type: "error" });
    }
  }, [editTitle, loadData, onUpdate]);

  const handlePriorityChange = useCallback(async (taskId: number, priority: Priority) => {
    try {
      await updateTask(taskId, { priority });
      showToast({ message: "优先级已更新", type: "success" });
      await loadData();
      onUpdate?.();
    } catch {
      showToast({ message: "更新失败", type: "error" });
    }
  }, [loadData, onUpdate]);

  const handlePostpone = useCallback(async (taskId: number, days: number) => {
    try {
      const target = new Date();
      target.setDate(target.getDate() + days);
      const start = new Date(target.getFullYear(), target.getMonth(), target.getDate()).getTime();
      const end = start + 24 * 60 * 60 * 1000;
      await updateTask(taskId, { startTime: start, endTime: end });
      showToast({ message: `已顺延到${days === 1 ? "明天" : "后天"}`, type: "success" });
      setEditingTaskId(null);
      await loadData();
      onUpdate?.();
    } catch {
      showToast({ message: "操作失败", type: "error" });
    }
  }, [loadData, onUpdate]);

  const activeTasks = tasks.filter((t) => t.id != null && !completedIds.has(t.id));
  const totalCount = tasks.length;
  const doneCount = tasks.length - activeTasks.length;
  const completionRate = totalCount > 0 ? Math.round((doneCount / totalCount) * 100) : 0;

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-16">
        <div className="w-8 h-8 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
        <span className="text-sm text-gray-400 mt-3">加载中...</span>
      </div>
    );
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center">
          <h2 className="text-base font-semibold text-gray-900 dark:text-white">今日待办</h2>
          <span className="bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 text-xs font-medium px-2 py-0.5 rounded-full ml-2">
            {activeTasks.length}
          </span>
        </div>
      </div>

      {totalCount > 0 && (
        <div className="mb-4">
          <div className="flex items-center justify-between text-xs mb-1">
            <span className="text-gray-500 dark:text-gray-400">当日完成率</span>
            <span className="font-semibold text-gray-700 dark:text-gray-300">{doneCount}/{totalCount} · {completionRate}%</span>
          </div>
          <div className="h-2 bg-gray-100 dark:bg-gray-800 rounded-full overflow-hidden">
            <motion.div
              initial={{ width: 0 }}
              animate={{ width: `${completionRate}%` }}
              transition={{ duration: 0.5, ease: "easeOut" }}
              className={`h-full rounded-full ${
                completionRate === 100
                  ? "bg-emerald-500"
                  : completionRate >= 50
                  ? "bg-blue-500"
                  : "bg-amber-500"
              }`}
            />
          </div>
        </div>
      )}

      {tasks.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16">
          <Inbox className="w-12 h-12 text-gray-300" />
          <p className="text-base font-medium text-gray-500 mt-3">暂无今日待办</p>
          <p className="text-sm text-gray-400 mt-1">在收件箱中使用快速操作添加任务</p>
        </div>
      ) : (
        <motion.div
          variants={containerVariants}
          initial="hidden"
          animate="show"
        >
          {tasks.map((task) => {
            const tid = task.id;
            if (tid == null) return null;
            const isDone = completedIds.has(tid);
            const isEditing = editingTaskId === tid;
            const goal = getGoalForTask(task);

            return (
              <motion.div
                key={tid}
                variants={itemVariants}
                className={`bg-white dark:bg-gray-900 rounded-xl shadow-sm border border-gray-100 dark:border-gray-800 p-4 mb-3 transition-shadow hover:shadow-md ${
                  isDone ? "opacity-60" : ""
                }`}
              >
                {isEditing ? (
                  <div className="space-y-3">
                    <div className="flex items-center gap-2">
                      <input
                        type="text"
                        value={editTitle}
                        onChange={(e) => setEditTitle(e.target.value)}
                        onKeyDown={(e) => { if (e.key === "Enter") saveEditTitle(tid); if (e.key === "Escape") setEditingTaskId(null); }}
                        className="flex-1 px-3 py-2 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                        autoFocus
                      />
                      <button
                        onClick={() => saveEditTitle(tid)}
                        className="px-3 py-2 text-xs font-medium bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-colors"
                      >
                        保存
                      </button>
                      <button
                        onClick={() => setEditingTaskId(null)}
                        className="p-2 text-gray-400 hover:text-gray-600 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    </div>
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <span className="text-xs text-gray-400">优先级:</span>
                      {PRIORITY_CONFIG.map((opt) => (
                        <button
                          key={opt.key}
                          onClick={() => handlePriorityChange(tid, opt.key)}
                          className={`text-xs px-2 py-1 rounded-full border transition-colors ${
                            task.priority === opt.key
                              ? `${opt.bg} ${opt.color} border-current`
                              : "border-gray-200 dark:border-gray-700 text-gray-500 hover:bg-gray-50 dark:hover:bg-gray-800"
                          }`}
                        >
                          <span className="inline-block w-1.5 h-1.5 rounded-full mr-1" style={{ backgroundColor: opt.hex }} />
                          {opt.label}
                        </button>
                      ))}
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-gray-400">顺延:</span>
                      <button
                        onClick={() => handlePostpone(tid, 1)}
                        className="text-xs px-2.5 py-1 rounded-lg bg-blue-50 dark:bg-blue-900/20 text-blue-600 hover:bg-blue-100 dark:hover:bg-blue-900/40 transition-colors"
                      >
                        明天
                      </button>
                      <button
                        onClick={() => handlePostpone(tid, 2)}
                        className="text-xs px-2.5 py-1 rounded-lg bg-violet-50 dark:bg-violet-900/20 text-violet-600 hover:bg-violet-100 dark:hover:bg-violet-900/40 transition-colors"
                      >
                        后天
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="flex items-start gap-3">
                    <button
                      onClick={() => isDone ? handleUncomplete(task) : handleComplete(task)}
                      className={`w-6 h-6 rounded-full border-2 flex items-center justify-center flex-shrink-0 mt-0.5 transition-colors ${
                        isDone
                          ? "bg-blue-500 border-blue-500"
                          : "border-gray-300 bg-transparent hover:border-blue-400"
                      }`}
                    >
                      {isDone && <Check className="w-3.5 h-3.5 text-white" />}
                    </button>

                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        {goal && (
                          <div className="relative">
                            <button
                              onMouseEnter={() => setHoveredGoalId(goal.id!)}
                              onMouseLeave={() => setHoveredGoalId(null)}
                              onClick={() => router.push(`/goals/${goal.id}`)}
                              className="w-3 h-3 rounded-full flex-shrink-0"
                              style={{ backgroundColor: PRIORITY_CONFIG.find(p => p.key === goal.priority)?.hex || "#6B7280" }}
                            />
                            <AnimatePresence>
                              {hoveredGoalId === goal.id && (
                                <motion.div
                                  initial={{ opacity: 0, y: -4, scale: 0.95 }}
                                  animate={{ opacity: 1, y: 0, scale: 1 }}
                                  exit={{ opacity: 0, y: -4, scale: 0.95 }}
                                  className="absolute left-0 top-full mt-1 px-2 py-1.5 bg-gray-900 dark:bg-gray-800 text-white text-xs rounded-lg shadow-lg z-10 whitespace-nowrap"
                                >
                                  <div className="flex items-center gap-1">
                                    <Target className="w-3 h-3" />
                                    <span>{goal.name}</span>
                                  </div>
                                  <div className="text-gray-400 mt-0.5">进度: {goal.progress}%</div>
                                </motion.div>
                              )}
                            </AnimatePresence>
                          </div>
                        )}
                        <p
                          className={`text-base font-medium text-gray-900 dark:text-gray-100 ${
                            isDone ? "line-through" : ""
                          }`}
                        >
                          {task.title}
                        </p>
                      </div>
                      {task.tags && task.tags.length > 0 && (
                        <div className="flex flex-wrap gap-1.5 mt-1.5">
                          {task.tags.map((tag) => (
                            <span
                              key={tag}
                              className={`text-xs font-medium px-2 py-0.5 rounded-full ${getTagStyle(tag)}`}
                            >
                              {tag}
                            </span>
                          ))}
                        </div>
                      )}
                      <div className="flex items-center gap-2 mt-1.5">
                        {task.priority && (
                          <div
                            className={`w-2 h-2 rounded-full flex-shrink-0`}
                            style={{ backgroundColor: PRIORITY_CONFIG.find(p => p.key === task.priority)?.hex || "#6B7280" }}
                          />
                        )}
                        {task.startTime && (
                          <div className="flex items-center gap-1">
                            <Calendar className="w-3 h-3 text-gray-400" />
                            <span className="text-xs text-gray-400">
                              {formatDate(task.startTime)}
                            </span>
                          </div>
                        )}
                      </div>
                    </div>

                    <div className="flex items-center gap-1 flex-shrink-0">
                      <button
                        onClick={() => openEdit(task)}
                        className="w-7 h-7 flex items-center justify-center rounded-lg text-gray-400 hover:text-blue-500 hover:bg-blue-50 dark:hover:bg-blue-900/20 transition-colors"
                        title="编辑"
                      >
                        <Edit3 className="w-3.5 h-3.5" />
                      </button>
                      <motion.button
                        whileTap={!isDone ? { scale: 0.92 } : undefined}
                        onClick={() => isDone ? handleUncomplete(task) : handleComplete(task)}
                        className={`text-xs font-medium px-3 py-1.5 rounded-full border transition-colors ${
                          isDone
                            ? "text-blue-600 bg-blue-50 dark:bg-blue-900/20 border-blue-200 dark:border-blue-800 hover:bg-blue-100 dark:hover:bg-blue-900/40"
                            : "text-emerald-600 bg-emerald-50 dark:bg-emerald-900/20 hover:bg-emerald-100 dark:hover:bg-emerald-900/40 border-emerald-200 dark:border-emerald-800"
                        }`}
                      >
                        {isDone ? "撤销" : "完成"}
                      </motion.button>
                    </div>
                  </div>
                )}
              </motion.div>
            );
          })}
        </motion.div>
      )}
    </div>
  );
}