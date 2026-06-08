"use client";

import { useState, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Check, Clock, ChevronDown } from "lucide-react";
import { db, updateTask } from "@/lib/db";
import type { Task } from "@/lib/types";
import { showToast } from "@/components/ui/Toast";

function getTodayRange() {
  const now = new Date();
  const start = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  const end = start + 24 * 60 * 60 * 1000;
  return { start, end };
}

function formatTime(ts: number): string {
  const d = new Date(ts);
  return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
}

function getTagColor(tag: string): string {
  const map: Record<string, string> = {
    "考公": "bg-orange-100 text-orange-700",
    "毕业": "bg-violet-100 text-violet-700",
    "运动": "bg-pink-100 text-pink-700",
    "睡眠": "bg-indigo-100 text-indigo-700",
    "体态": "bg-teal-100 text-teal-700",
  };
  return map[tag] ?? "bg-gray-100 text-gray-600";
}

export default function TodayTimeline() {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [completedIds, setCompletedIds] = useState<Set<number>>(new Set());
  const [expandedId, setExpandedId] = useState<number | null>(null);

  const loadTasks = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const { start, end } = getTodayRange();
      const all = await db.tasks
        .where("startTime")
        .between(start, end)
        .toArray();
      const active = all.filter((t) => t.status !== "archived");
      setTasks(active);
    } catch (err) {
      console.error("TodayTimeline loadTasks error:", err);
      setError("加载时间线失败，请刷新页面重试");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadTasks();
  }, [loadTasks]);

  const handleComplete = useCallback(async (task: Task) => {
    const id = task.id;
    if (!id) return;
    setCompletedIds((prev) => new Set(prev).add(id));
    try {
      await updateTask(id, { status: "done" });
      showToast({ message: "已标记完成", type: "success" });
    } catch {
      setCompletedIds((prev) => {
        const next = new Set(prev);
        next.delete(id);
        return next;
      });
      showToast({ message: "操作失败", type: "error" });
    }
  }, []);

  const toggleExpand = useCallback((id: number) => {
    setExpandedId((prev) => (prev === id ? null : id));
  }, []);

  // Group tasks by hour
  const tasksByHour: Task[][] = Array.from({ length: 24 }, () => []);
  for (const task of tasks) {
    if (task.startTime) {
      const hour = new Date(task.startTime).getHours();
      if (hour >= 0 && hour < 24) {
        tasksByHour[hour].push(task);
      }
    }
  }
  // Sort each hour's tasks by startTime
  for (const arr of tasksByHour) {
    arr.sort((a, b) => (a.startTime || 0) - (b.startTime || 0));
    // Limit to 4 per hour
    if (arr.length > 4) arr.splice(4);
  }

  const currentHour = new Date().getHours();
  const totalScheduled = tasks.filter((t) => t.status !== "done" && t.id && !completedIds.has(t.id)).length;

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-12">
        <div className="w-6 h-6 border-2 border-gray-300 border-t-gray-600 rounded-full animate-spin" />
        <span className="text-sm text-gray-400 mt-2">加载中...</span>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center py-12 bg-white rounded-2xl border border-red-100">
        <div className="w-10 h-10 rounded-full bg-red-50 flex items-center justify-center mb-2">
          <Clock className="w-5 h-5 text-red-400" />
        </div>
        <span className="text-sm text-red-500">{error}</span>
        <button
          onClick={() => loadTasks()}
          className="mt-3 text-xs text-blue-500 hover:text-blue-600 underline"
        >
          点击重试
        </button>
      </div>
    );
  }

  return (
    <div>
      {/* Header */}
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <Clock className="w-4 h-4 text-gray-500" />
          <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wider">
            今日时间线
          </h2>
          {totalScheduled > 0 && (
            <span className="text-xs text-gray-400 bg-gray-100 px-1.5 py-0.5 rounded-full">
              {totalScheduled}
            </span>
          )}
        </div>
        <span className="text-xs text-gray-400">00:00 — 24:00</span>
      </div>

      {/* Timeline grid */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
        <div className="max-h-[600px] overflow-y-auto">
          {tasksByHour.map((hourTasks, hour) => {
            const isCurrent = hour === currentHour;
            const label = `${String(hour).padStart(2, "0")}:00`;

            return (
              <div
                key={hour}
                className={`flex border-b border-gray-50 last:border-b-0 min-h-[64px] ${
                  isCurrent
                    ? "bg-purple-50/50"
                    : hour % 2 === 0
                    ? "bg-gray-50/30"
                    : ""
                }`}
              >
                {/* Hour label - left column */}
                <div className="w-16 flex-shrink-0 flex items-start justify-center pt-4 border-r border-gray-100">
                  <span
                    className={`text-xs font-mono font-medium ${
                      isCurrent ? "text-purple-600" : "text-gray-400"
                    }`}
                  >
                    {label}
                  </span>
                </div>

                {/* Tasks cell */}
                <div className="flex-1 min-w-0 p-2">
                  {hourTasks.length === 0 ? (
                    <div className="h-8 flex items-center">
                      <span className="text-[10px] text-gray-300">—</span>
                    </div>
                  ) : (
                    <div className="flex flex-col gap-1">
                      {hourTasks.map((task) => {
                        const tid = task.id;
                        if (!tid) return null;
                        const isDone = task.status === "done" || completedIds.has(tid);
                        const isExpanded = expandedId === tid;
                        const startTime = task.startTime ? formatTime(task.startTime) : "";
                        const endTime = task.endTime ? formatTime(task.endTime) : "";

                        return (
                          <div key={tid}>
                            {/* Task row */}
                            <div
                              className={`flex items-center gap-2 rounded-lg px-2 py-1.5 cursor-pointer group transition-colors ${
                                isDone
                                  ? "opacity-50"
                                  : "hover:bg-white/60"
                              }`}
                              onClick={() => toggleExpand(tid)}
                            >
                              {/* Complete checkbox */}
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  if (!isDone) handleComplete(task);
                                }}
                                disabled={isDone}
                                className={`w-4 h-4 rounded-full border-2 flex items-center justify-center flex-shrink-0 transition-colors ${
                                  isDone
                                    ? "bg-emerald-500 border-emerald-500"
                                    : "border-gray-300 hover:border-emerald-400"
                                }`}
                              >
                                {isDone && <Check className="w-2.5 h-2.5 text-white" />}
                              </button>

                              {/* Time */}
                              {startTime && (
                                <span className="text-[11px] font-mono text-gray-400 flex-shrink-0 w-11">
                                  {startTime}
                                </span>
                              )}

                              {/* Title */}
                              <span
                                className={`text-sm flex-1 min-w-0 truncate ${
                                  isDone
                                    ? "line-through text-gray-400"
                                    : "text-gray-700"
                                }`}
                              >
                                {task.title}
                              </span>

                              {/* Duration */}
                              {endTime && (
                                <span className="text-[10px] text-gray-400 flex-shrink-0 hidden sm:inline">
                                  — {endTime}
                                </span>
                              )}

                              {/* Expand arrow */}
                              <ChevronDown
                                className={`w-3.5 h-3.5 text-gray-300 flex-shrink-0 transition-transform ${
                                  isExpanded ? "rotate-180" : ""
                                }`}
                              />
                            </div>

                            {/* Expanded detail */}
                            <AnimatePresence>
                              {isExpanded && (
                                <motion.div
                                  initial={{ height: 0, opacity: 0 }}
                                  animate={{ height: "auto", opacity: 1 }}
                                  exit={{ height: 0, opacity: 0 }}
                                  transition={{ duration: 0.2 }}
                                  className="overflow-hidden"
                                >
                                  <div className="ml-10 mr-2 mb-2 p-3 rounded-lg bg-white/80 border border-gray-100">
                                    {/* Time range */}
                                    {(startTime || endTime) && (
                                      <div className="flex items-center gap-1.5 mb-2">
                                        <Clock className="w-3 h-3 text-gray-400" />
                                        <span className="text-xs text-gray-500">
                                          {startTime} — {endTime || "..."}
                                        </span>
                                      </div>
                                    )}

                                    {/* Tags */}
                                    {task.tags && task.tags.length > 0 && (
                                      <div className="flex flex-wrap gap-1 mb-2">
                                        {task.tags.map((tag) => (
                                          <span
                                            key={tag}
                                            className={`text-[10px] font-medium px-1.5 py-0.5 rounded-full ${getTagColor(tag)}`}
                                          >
                                            {tag}
                                          </span>
                                        ))}
                                      </div>
                                    )}

                                    {/* Note */}
                                    {task.note && (
                                      <p className="text-xs text-gray-500">
                                        {task.note}
                                      </p>
                                    )}

                                    {!task.note && !task.tags?.length && !startTime && (
                                      <p className="text-xs text-gray-400">暂无详情</p>
                                    )}
                                  </div>
                                </motion.div>
                              )}
                            </AnimatePresence>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
