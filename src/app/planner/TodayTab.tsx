"use client";

import { useState, useEffect, useCallback } from "react";
import { motion } from "framer-motion";
import { Check, Calendar, Inbox } from "lucide-react";
import { db, updateTask } from "@/lib/db";
import type { Task, Priority } from "@/lib/types";
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

function getPriorityDot(priority?: Priority): string {
  if (priority === "urgent-important") return "bg-red-500";
  if (priority === "not-urgent-important") return "bg-amber-500";
  return "bg-green-500";
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
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);
  const [completedIds, setCompletedIds] = useState<Set<number>>(new Set());

  const loadTasks = useCallback(async () => {
    setLoading(true);
    try {
      const { start, end } = getTodayRange();
      const all = await db.tasks.where("startTime").between(start, end).toArray();
      const active = all.filter((t) => t.status === "active");
      setTasks(active);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadTasks();
  }, [loadTasks]);

  const handleComplete = useCallback(
    async (task: Task) => {
      const id = task.id;
      if (!id) return;
      setCompletedIds((prev) => new Set(prev).add(id));
      try {
        await updateTask(id, { status: "done" });
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

  const activeTasks = tasks.filter((t) => t.id != null && !completedIds.has(t.id));

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
      {/* Section header */}
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center">
          <h2 className="text-base font-semibold text-gray-900">今日待办</h2>
          <span className="bg-blue-100 text-blue-700 text-xs font-medium px-2 py-0.5 rounded-full ml-2">
            {activeTasks.length}
          </span>
        </div>
        <button className="text-sm text-blue-600 hover:text-blue-700 transition-colors">
          + 从捕捉添加
        </button>
      </div>

      {tasks.length === 0 ? (
        /* Empty state */
        <div className="flex flex-col items-center justify-center py-16">
          <Inbox className="w-12 h-12 text-gray-300" />
          <p className="text-base font-medium text-gray-500 mt-3">暂无今日待办</p>
          <p className="text-sm text-gray-400 mt-1">在捕捉页面勾选「转为任务」</p>
        </div>
      ) : (
        /* Task cards */
        <motion.div
          variants={containerVariants}
          initial="hidden"
          animate="show"
        >
          {tasks.map((task) => {
            const tid = task.id;
            if (tid == null) return null;
            const isDone = completedIds.has(tid);
            return (
              <motion.div
                key={tid}
                variants={itemVariants}
                className={`bg-white rounded-xl shadow-sm border border-gray-100 p-4 flex items-start gap-3 mb-3 transition-shadow hover:shadow-md ${
                  isDone ? "opacity-60" : ""
                }`}
              >
                {/* Left: Checkbox */}
                <button
                  onClick={() => !isDone && handleComplete(task)}
                  disabled={isDone}
                  className={`w-6 h-6 rounded-full border-2 flex items-center justify-center flex-shrink-0 mt-0.5 transition-colors ${
                    isDone
                      ? "bg-blue-500 border-blue-500"
                      : "border-gray-300 bg-transparent hover:border-blue-400"
                  }`}
                >
                  {isDone && <Check className="w-3.5 h-3.5 text-white" />}
                </button>

                {/* Center: Title + Tags */}
                <div className="flex-1 min-w-0">
                  <p
                    className={`text-base font-medium text-gray-900 ${
                      isDone ? "line-through" : ""
                    }`}
                  >
                    {task.title}
                  </p>
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
                    {/* Priority dot */}
                    {task.priority && (
                      <div
                        className={`w-2 h-2 rounded-full flex-shrink-0 ${getPriorityDot(task.priority)}`}
                      />
                    )}
                    {/* Date */}
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

                {/* Right: Complete button */}
                <motion.button
                  whileTap={isDone ? undefined : { scale: 0.92 }}
                  onClick={() => !isDone && handleComplete(task)}
                  disabled={isDone}
                  className={`text-xs font-medium px-3 py-1.5 rounded-full border flex-shrink-0 transition-colors ${
                    isDone
                      ? "text-gray-400 bg-gray-50 border-gray-200 cursor-default"
                      : "text-emerald-600 bg-emerald-50 hover:bg-emerald-100 border-emerald-200"
                  }`}
                >
                  {isDone ? "已完成" : "完成"}
                </motion.button>
              </motion.div>
            );
          })}
        </motion.div>
      )}
    </div>
  );
}
