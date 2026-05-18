"use client";

import { useState, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  ArrowLeft, Check, CheckCircle, Circle, ChevronDown, ChevronRight,
  Clock, ListTodo, Target,
} from "lucide-react";
import Link from "next/link";
import { getPluginMeta, initBuiltInPlugins, getTasksForInbox, updateTask } from "@/lib/db";
import { showToast } from "@/components/ui/Toast";
import TaskDetail from "@/components/ui/TaskDetail";
import type { Task } from "@/lib/types";

const TYPE_LABELS: Record<string, { label: string; color: string; bg: string }> = {
  shortterm: { label: "短期事件", color: "text-blue-600", bg: "bg-blue-100 dark:bg-blue-900/30" },
  daily: { label: "日常琐事", color: "text-green-600", bg: "bg-green-100 dark:bg-green-900/30" },
  habit: { label: "习惯", color: "text-orange-600", bg: "bg-orange-100 dark:bg-orange-900/30" },
};

function formatDateHeader(ts: number): { day: string; weekday: string; dateStr: string } {
  const d = new Date(ts);
  const weekdays = ["周日", "周一", "周二", "周三", "周四", "周五", "周六"];
  return {
    day: `${d.getMonth() + 1}月${d.getDate()}日`,
    weekday: weekdays[d.getDay()],
    dateStr: `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`,
  };
}

function formatTime(ts: number): string {
  const d = new Date(ts);
  return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
}

export default function TaskInboxPluginPage() {
  const [active, setActive] = useState(false);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [doneTasks, setDoneTasks] = useState<Task[]>([]);
  const [showDone, setShowDone] = useState(false);
  const [detailTaskId, setDetailTaskId] = useState<number | null>(null);

  useEffect(() => {
    getPluginMeta("task-inbox").then((p) => setActive(p?.status === "active"));
  }, []);

  const loadTasks = useCallback(async () => {
    await initBuiltInPlugins();
    const all = await getTasksForInbox();
    setTasks(all.filter((t) => t.status === "active"));
    setDoneTasks(all.filter((t) => t.status === "done"));
  }, []);

  useEffect(() => {
    if (active) loadTasks();
  }, [active, loadTasks]);

  const handleToggleDone = useCallback(async (task: Task) => {
    try {
      const newStatus = task.status === "done" ? "active" : "done";
      await updateTask(task.id!, { status: newStatus });
      await loadTasks();
    } catch {
      showToast({ message: "操作失败", type: "error" });
    }
  }, [loadTasks]);

  if (!active) {
    return (
      <div className="flex flex-col items-center justify-center py-20 px-4 text-center">
        <ListTodo className="w-12 h-12 text-gray-400 mb-4" />
        <h2 className="text-lg font-semibold text-gray-700 dark:text-gray-200">任务清单插件未启用</h2>
        <p className="text-sm text-gray-500 dark:text-gray-400 mt-1 mb-6">请在插件管理中启用此插件</p>
        <Link href="/plugins" className="text-indigo-600 text-sm font-medium">前往插件管理</Link>
      </div>
    );
  }

  const grouped = tasks.reduce<{ label: string; dateStr: string; items: Task[] }[]>((acc, t) => {
    const header = formatDateHeader(t.startTime!);
    const last = acc[acc.length - 1];
    if (last && last.dateStr === header.dateStr) {
      last.items.push(t);
    } else {
      acc.push({ label: `${header.day} ${header.weekday}`, dateStr: header.dateStr, items: [t] });
    }
    return acc;
  }, []);

  const doneGrouped = doneTasks.reduce<{ label: string; dateStr: string; items: Task[] }[]>((acc, t) => {
    const header = formatDateHeader(t.startTime!);
    const last = acc[acc.length - 1];
    if (last && last.dateStr === header.dateStr) {
      last.items.push(t);
    } else {
      acc.push({ label: `${header.day} ${header.weekday}`, dateStr: header.dateStr, items: [t] });
    }
    return acc;
  }, []);

  return (
    <div className="flex flex-col h-full max-w-2xl mx-auto px-4 pt-6 pb-24">
      <div className="flex items-center gap-3 mb-5">
        <Link href="/plugins" className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800">
          <ArrowLeft className="w-5 h-5 text-gray-500" />
        </Link>
        <h1 className="text-xl font-bold text-gray-900 dark:text-gray-100">任务清单</h1>
        <span className="text-xs text-gray-400 dark:text-gray-500 ml-auto">
          {tasks.length} 待办 · {doneTasks.length} 完成
        </span>
      </div>

      <div className="flex-1 overflow-y-auto space-y-4">
        {grouped.length === 0 && doneGrouped.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-center">
            <ListTodo className="w-12 h-12 text-gray-300 dark:text-gray-600 mb-4" />
            <p className="text-gray-500 dark:text-gray-400">暂无待办任务</p>
            <p className="text-xs text-gray-400 dark:text-gray-500 mt-1">
              从捕捉箱中把想法转换为带时间的任务后，会出现在这里
            </p>
          </div>
        ) : (
          <>
            {grouped.map(({ label, dateStr, items }) => (
              <div key={dateStr}>
                <h3 className="text-sm font-semibold text-gray-500 dark:text-gray-400 mb-2 px-1">{label}</h3>
                <div className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-100 dark:border-gray-800 overflow-hidden">
                  {items.map((task) => {
                    const typeInfo = TYPE_LABELS[task.type] || TYPE_LABELS.daily;
                    return (
                      <div
                        key={task.id}
                        className="flex items-center gap-3 px-4 py-3 border-b border-gray-50 dark:border-gray-800/50 last:border-0 group"
                      >
                        <button
                          onClick={() => handleToggleDone(task)}
                          className="flex-shrink-0 w-5 h-5 rounded border-2 border-gray-300 dark:border-gray-600 flex items-center justify-center hover:border-indigo-400 transition-colors"
                        >
                          {task.status === "done" && <Check className="w-3 h-3 text-indigo-500" />}
                        </button>
                        <div className="flex-1 min-w-0 cursor-pointer" onClick={() => setDetailTaskId(task.id!)}>
                          <p className="text-sm text-gray-700 dark:text-gray-300 truncate">
                            {task.title}
                          </p>
                          <div className="flex items-center gap-2 mt-0.5">
                            {task.startTime && (
                              <span className="flex items-center gap-0.5 text-[10px] text-gray-400">
                                <Clock className="w-3 h-3" />
                                {formatTime(task.startTime)}
                                {task.endTime && ` - ${formatTime(task.endTime)}`}
                              </span>
                            )}
                            <span className={`text-[10px] font-medium px-1.5 py-0.5 rounded-md ${typeInfo.bg} ${typeInfo.color}`}>
                              {typeInfo.label}
                            </span>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            ))}

            {doneGrouped.length > 0 && (
              <div className="mt-4">
                <button
                  onClick={() => setShowDone(!showDone)}
                  className="flex items-center gap-2 text-sm font-medium text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 transition-colors w-full py-2"
                >
                  {showDone ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
                  已完成 ({doneTasks.length})
                </button>
                <AnimatePresence>
                  {showDone && (
                    <motion.div initial={{ height: 0 }} animate={{ height: "auto" }} exit={{ height: 0 }} className="overflow-hidden">
                      <div className="space-y-3 pt-2">
                        {doneGrouped.map(({ label, dateStr, items }) => (
                          <div key={`done-${dateStr}`}>
                            <h3 className="text-xs font-medium text-gray-400 dark:text-gray-500 mb-1.5 px-1">{label}</h3>
                            <div className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-100 dark:border-gray-800 overflow-hidden opacity-60">
                              {items.map((task) => {
                                const typeInfo = TYPE_LABELS[task.type] || TYPE_LABELS.daily;
                                return (
                                  <div
                                    key={task.id}
                                    className="flex items-center gap-3 px-4 py-3 border-b border-gray-50 dark:border-gray-800/50 last:border-0"
                                  >
                                    <button
                                      onClick={() => handleToggleDone(task)}
                                      className="flex-shrink-0 w-5 h-5 rounded border-2 bg-emerald-500 border-emerald-500 flex items-center justify-center"
                                    >
                                      <Check className="w-3 h-3 text-white" />
                                    </button>
                                    <div className="flex-1 min-w-0 cursor-pointer" onClick={() => setDetailTaskId(task.id!)}>
                                      <p className="text-sm text-gray-400 dark:text-gray-500 truncate line-through">
                                        {task.title}
                                      </p>
                                      <div className="flex items-center gap-2 mt-0.5">
                                        {task.startTime && (
                                          <span className="flex items-center gap-0.5 text-[10px] text-gray-400">
                                            <Clock className="w-3 h-3" />
                                            {formatTime(task.startTime)}
                                            {task.endTime && ` - ${formatTime(task.endTime)}`}
                                          </span>
                                        )}
                                        <span className={`text-[10px] font-medium px-1.5 py-0.5 rounded-md ${typeInfo.bg} ${typeInfo.color}`}>
                                          {typeInfo.label}
                                        </span>
                                      </div>
                                    </div>
                                  </div>
                                );
                              })}
                            </div>
                          </div>
                        ))}
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            )}
          </>
        )}
      </div>

      {detailTaskId !== null && (
        <TaskDetail
          taskId={detailTaskId}
          onClose={() => setDetailTaskId(null)}
          onUpdate={loadTasks}
        />
      )}
    </div>
  );
}
