"use client";

import { useState, useEffect, useCallback } from "react";
import { motion } from "framer-motion";
import { ArrowLeft, Inbox, Trash2 } from "lucide-react";
import Link from "next/link";
import { getTasksByType, deleteTask, captureToTask } from "@/lib/db";
import { showToast } from "@/components/ui/Toast";
import type { Task } from "@/lib/types";

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

  const load = useCallback(async () => {
    setLoading(true);
    const all = await getTasksByType("daily");
    const unclassified = all.filter(t => t.status === "active" && !t.projectId);
    setTasks(unclassified);
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

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

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-50 to-white dark:from-gray-950 dark:to-gray-900">
      <div className="mx-auto max-w-3xl px-5 py-8 pb-24 md:px-8 md:py-10">
        <div className="flex items-center gap-3 mb-6">
          <Link href="/planner" className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800">
            <ArrowLeft className="w-5 h-5 text-gray-400" />
          </Link>
          <div className="w-10 h-10 rounded-xl bg-gray-100 dark:bg-gray-800 flex items-center justify-center">
            <Inbox className="w-5 h-5 text-gray-400" />
          </div>
          <div>
            <h1 className="text-lg font-bold text-gray-900 dark:text-white">未分类</h1>
            <p className="text-xs text-gray-400">暂无归属的想法</p>
          </div>
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
            {tasks.map((task) => (
              <motion.div
                key={task.id}
                initial={{ opacity: 0, y: -4 }}
                animate={{ opacity: 1, y: 0 }}
                className="bg-white dark:bg-gray-900 rounded-xl border border-gray-100 dark:border-gray-800 p-3"
              >
                <p className="text-sm text-gray-800 dark:text-gray-200 mb-2">{task.title}</p>
                <div className="flex items-center gap-2">
                  <span className="text-xs text-gray-400">{relativeTime(task.createdAt)}</span>
                  <div className="flex-1" />
                  <button onClick={() => handleQuickToday(task.id!)} className="px-2 py-1 text-xs bg-amber-50 dark:bg-amber-900/20 text-amber-600 rounded-lg hover:bg-amber-100">今日</button>
                  <button onClick={() => handleQuickTomorrow(task.id!)} className="px-2 py-1 text-xs bg-blue-50 dark:bg-blue-900/20 text-blue-600 rounded-lg hover:bg-blue-100">明天</button>
                  <button onClick={() => handleDelete(task.id!)} className="px-2 py-1 text-xs bg-red-50 dark:bg-red-900/20 text-red-500 rounded-lg hover:bg-red-100">删除</button>
                </div>
              </motion.div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
