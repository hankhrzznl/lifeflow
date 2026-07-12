"use client";

import { useState, useEffect, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { ArrowLeft, CheckCircle, Clock, ArrowRight, ChevronRight, CalendarDays, ClipboardList, Target } from "lucide-react";
import { getTasksByType, getProjectV2, updateTask, captureToTask } from "@/lib/db";
import { showToast } from "@/components/ui/Toast";
import type { ProjectV2, Task } from "@/lib/types";

export default function GoalDetailPage() {
  const params = useParams();
  const router = useRouter();
  const projectId = Number(params.projectId);
  const goalId = Number(params.goalId);

  const [project, setProject] = useState<ProjectV2 | null>(null);
  const [goal, setGoal] = useState<Task | null>(null);
  const [pendingTasks, setPendingTasks] = useState<Task[]>([]);
  const [arrangedTasks, setArrangedTasks] = useState<Task[]>([]);
  const [loaded, setLoaded] = useState(false);

  // 处理中
  const [classifyItem, setClassifyItem] = useState<Task | null>(null);

  useEffect(() => {
    (async () => {
      const pid = String(projectId);
      const [p, shortterm, daily] = await Promise.all([
        getProjectV2(projectId),
        getTasksByType("shortterm"),
        getTasksByType("daily"),
      ]);

      const allGoals = [...shortterm, ...daily].filter((t) => t.projectId === pid);
      const g = allGoals.find((t) => t.id === goalId) || null;
      setGoal(g);
      setProject(p || null);

      // 待安排：该项目下 active 的 daily 任务
      const pending = daily.filter((t) => t.projectId === pid && t.status === "active");
      setPendingTasks(pending);

      // 已安排：非 active 且有 startTime
      const arranged = daily.filter(
        (t) => t.projectId === pid && t.status !== "active" && t.startTime
      );
      setArrangedTasks(arranged);

      setLoaded(true);
    })();
  }, [projectId, goalId]);

  const handleClassifySubmit = useCallback(async (type: "short-term" | "daily-trivial") => {
    if (!classifyItem) return;
    try {
      await updateTask(classifyItem.id!, {
        type: type === "short-term" ? "shortterm" : "daily",
        classification: type,
      });
      const today = new Date();
      const start = new Date(today.getFullYear(), today.getMonth(), today.getDate()).getTime();
      await captureToTask(classifyItem.id!, { startTime: start, endTime: start + 86400000 });
      showToast({ message: `已分类为${type === "short-term" ? "短期事件" : "每日习惯"}`, type: "success" });
      setClassifyItem(null);
      // 重新加载数据
      const pid = String(projectId);
      const daily = await getTasksByType("daily");
      setPendingTasks(daily.filter((t) => t.projectId === pid && t.status === "active"));
      setArrangedTasks(daily.filter((t) => t.projectId === pid && t.status !== "active" && t.startTime));
    } catch {
      showToast({ message: "操作失败", type: "error" });
    }
  }, [classifyItem, projectId]);

  if (!loaded) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-950 flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-indigo-400 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-50 to-white dark:from-gray-950 dark:to-gray-900">
      <div className="mx-auto max-w-3xl px-5 py-8 pb-24 md:px-8 md:py-10">
        {/* 返回 */}
        <button
          onClick={() => router.back()}
          className="flex items-center gap-2 text-sm text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 mb-6 transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          {project?.name || "返回"}
        </button>

        {/* 目标信息 */}
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-100 dark:border-gray-800 shadow-sm p-5 mb-4"
        >
          <div className="flex items-start gap-3">
            <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${
              goal?.type === "shortterm"
                ? "bg-blue-50 dark:bg-blue-900/20 text-blue-500"
                : "bg-green-50 dark:bg-green-900/20 text-green-500"
            }`}>
              {goal?.type === "shortterm" ? (
                <CalendarDays className="w-5 h-5" />
              ) : (
                <ClipboardList className="w-5 h-5" />
              )}
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-1">
                <span className={`text-[10px] font-medium px-1.5 py-0.5 rounded-md ${
                  goal?.type === "shortterm"
                    ? "bg-blue-50 dark:bg-blue-900/20 text-blue-600"
                    : "bg-green-50 dark:bg-green-900/20 text-green-600"
                }`}>
                  {goal?.type === "shortterm" ? "短期事件" : "日常习惯"}
                </span>
                {goal?.status === "done" && (
                  <span className="text-[10px] font-medium px-1.5 py-0.5 rounded-md bg-green-50 dark:bg-green-900/20 text-green-600">
                    已完成
                  </span>
                )}
              </div>
              <h1 className="text-lg font-semibold text-gray-900 dark:text-white">{goal?.title || "未知目标"}</h1>
              {goal?.note && (
                <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">{goal.note}</p>
              )}
              {goal?.dueDate && (
                <div className="flex items-center gap-1.5 mt-2 text-xs text-gray-400">
                  <CalendarDays className="w-3.5 h-3.5" />
                  截止 {new Date(goal.dueDate).toLocaleDateString("zh-CN")}
                </div>
              )}
              {goal?.successCriteria && (
                <div className="mt-2 p-2 bg-indigo-50 dark:bg-indigo-900/10 rounded-lg">
                  <p className="text-xs text-indigo-700 dark:text-indigo-300">
                    <Target className="w-3 h-3 inline mr-1" />
                    成功标准：{goal.successCriteria}
                  </p>
                </div>
              )}
            </div>
            {goal?.status === "done" && (
              <CheckCircle className="w-6 h-6 text-green-500 shrink-0" />
            )}
          </div>
        </motion.div>

        {/* 已安排 */}
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.05 }}
          className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-100 dark:border-gray-800 shadow-sm p-5 mb-4"
        >
          <div className="flex items-center gap-2 mb-4">
            <CheckCircle className="w-4 h-4 text-green-500" />
            <h2 className="text-sm font-semibold text-gray-700 dark:text-gray-300">已安排</h2>
            <span className="text-xs text-gray-400">({arrangedTasks.length})</span>
          </div>
          {arrangedTasks.length > 0 ? (
            <div className="space-y-1.5 max-h-60 overflow-y-auto">
              {arrangedTasks.map((task) => (
                <div key={task.id} className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-400 py-1.5">
                  <div className="w-1.5 h-1.5 rounded-full bg-green-400 shrink-0" />
                  <span className="truncate">{task.title}</span>
                  {task.startTime && (
                    <span className="text-[10px] text-gray-400 ml-auto shrink-0">
                      {new Date(task.startTime).toLocaleDateString("zh-CN")}
                    </span>
                  )}
                </div>
              ))}
            </div>
          ) : (
            <p className="text-xs text-gray-400 py-4 text-center">暂无已安排任务</p>
          )}
        </motion.div>

        {/* 待安排 */}
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-100 dark:border-gray-800 shadow-sm p-5"
        >
          <div className="flex items-center gap-2 mb-4">
            <Clock className="w-4 h-4 text-amber-500" />
            <h2 className="text-sm font-semibold text-gray-700 dark:text-gray-300">待安排</h2>
            <span className="text-xs text-gray-400">({pendingTasks.length})</span>
          </div>
          {pendingTasks.length > 0 ? (
            <div className="space-y-1.5 max-h-60 overflow-y-auto">
              {pendingTasks.map((task) => (
                <button
                  key={task.id}
                  onClick={() => setClassifyItem(task)}
                  className="w-full flex items-center gap-2 p-2.5 bg-amber-50 dark:bg-amber-900/10 rounded-xl text-sm text-gray-700 dark:text-gray-300 hover:bg-amber-100 dark:hover:bg-amber-900/20 transition-colors text-left group"
                >
                  <Clock className="w-4 h-4 text-amber-500 shrink-0" />
                  <span className="truncate flex-1">{task.title}</span>
                  <ArrowRight className="w-4 h-4 text-amber-400 opacity-0 group-hover:opacity-100 transition-opacity" />
                </button>
              ))}
            </div>
          ) : (
            <p className="text-xs text-gray-400 py-4 text-center">暂无待安排任务</p>
          )}
        </motion.div>
      </div>

      {/* 处理中 Sheet */}
      <AnimatePresence>
        {classifyItem && (
          <motion.div
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 bg-black/40 backdrop-blur-sm flex items-end justify-center"
            onClick={() => setClassifyItem(null)}
          >
            <motion.div
              initial={{ y: "100%" }} animate={{ y: 0 }} exit={{ y: "100%" }}
              transition={{ type: "spring", stiffness: 400, damping: 40 }}
              onClick={(e) => e.stopPropagation()}
              className="w-full max-w-lg bg-white dark:bg-gray-900 rounded-t-2xl"
            >
              <div className="w-10 h-1 bg-gray-300 dark:bg-gray-700 rounded-full mx-auto mt-3 mb-1" />
              <div className="px-6 pt-4 pb-6">
                <h3 className="text-base font-semibold text-gray-900 dark:text-gray-100 mb-1">处理中</h3>
                <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">
                  "{classifyItem.title.slice(0, 40)}" 分类为？
                </p>
                <div className="space-y-2">
                  <button
                    onClick={() => handleClassifySubmit("short-term")}
                    className="w-full flex items-center gap-3 px-4 py-3.5 rounded-xl hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors text-left"
                  >
                    <div className="w-10 h-10 rounded-xl bg-blue-50 dark:bg-blue-900/20 flex items-center justify-center">
                      <CalendarDays className="w-5 h-5 text-blue-500" />
                    </div>
                    <div>
                      <p className="text-sm font-medium text-gray-900 dark:text-gray-100">短期事件</p>
                      <p className="text-xs text-gray-400">有截止日期的独立事件</p>
                    </div>
                    <ChevronRight className="w-5 h-5 text-gray-400 ml-auto" />
                  </button>
                  <button
                    onClick={() => handleClassifySubmit("daily-trivial")}
                    className="w-full flex items-center gap-3 px-4 py-3.5 rounded-xl hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors text-left"
                  >
                    <div className="w-10 h-10 rounded-xl bg-green-50 dark:bg-green-900/20 flex items-center justify-center">
                      <ClipboardList className="w-5 h-5 text-green-500" />
                    </div>
                    <div>
                      <p className="text-sm font-medium text-gray-900 dark:text-gray-100">日常习惯</p>
                      <p className="text-xs text-gray-400">每天重复的习惯打卡</p>
                    </div>
                    <ChevronRight className="w-5 h-5 text-gray-400 ml-auto" />
                  </button>
                </div>
                <button
                  onClick={() => setClassifyItem(null)}
                  className="mt-4 w-full py-3 rounded-xl border border-gray-200 dark:border-gray-700 text-sm text-gray-500 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors"
                >
                  取消
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
