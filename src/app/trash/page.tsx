"use client";

import { useState, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Trash2, RotateCcw, AlertTriangle, Calendar, ClipboardList, Target, Flame } from "lucide-react";
import { getTrashTasks, restoreTask, purgeTask } from "@/lib/db";
import type { Task } from "@/lib/types";

const TYPE_CONFIG: Record<Task["type"], { label: string; icon: typeof Calendar; color: string }> = {
  shortterm: { label: "短期", icon: Calendar, color: "text-blue-500 bg-blue-50" },
  daily: { label: "日常", icon: ClipboardList, color: "text-amber-500 bg-amber-50" },
  longterm: { label: "长期", icon: Target, color: "text-purple-500 bg-purple-50" },
  habit: { label: "习惯", icon: Flame, color: "text-orange-500 bg-orange-50" },
};

function relativeTime(timestamp: number): string {
  const diff = Date.now() - timestamp;
  const seconds = Math.floor(diff / 1000);
  if (seconds < 60) return "刚刚";
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}分钟前`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}小时前`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}天前`;
  return new Date(timestamp).toLocaleDateString("zh-CN");
}

export default function TrashPage() {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);
  const [purgeConfirm, setPurgeConfirm] = useState<number | "all" | null>(null);
  const [purging, setPurging] = useState(false);

  const loadData = useCallback(async () => {
    const items = await getTrashTasks();
    setTasks(items);
    setLoading(false);
  }, []);

  useEffect(() => {
    queueMicrotask(() => loadData());
  }, [loadData]);

  async function handleRestore(id: number) {
    await restoreTask(id);
    await loadData();
  }

  async function handlePurge(id: number) {
    setPurging(true);
    try {
      await purgeTask(id);
      await loadData();
    } finally {
      setPurging(false);
      setPurgeConfirm(null);
    }
  }

  async function handlePurgeAll() {
    setPurging(true);
    try {
      const all = await getTrashTasks();
      await Promise.all(all.map((t) => purgeTask(t.id!)));
      await loadData();
    } finally {
      setPurging(false);
      setPurgeConfirm(null);
    }
  }

  const count = tasks.length;
  const isEmpty = count === 0;

  return (
    <div className="flex-1 flex flex-col h-full bg-[var(--bg-primary)]">
      <div className="flex items-center justify-between px-5 pt-6 pb-3">
        <div>
          <h1 className="text-xl font-bold text-[var(--text-primary)]">回收站</h1>
          <p className="text-sm text-[var(--text-secondary)] mt-1">
            {isEmpty ? "回收站为空" : `${count} 个项目等待清理`}
          </p>
        </div>
        {!isEmpty && (
          <motion.button
            whileTap={{ scale: 0.97 }}
            onClick={() => setPurgeConfirm("all")}
            disabled={purging}
            className="px-3 py-2 rounded-xl text-sm font-medium text-danger-500 border border-danger-500/30 hover:bg-danger-50 transition-colors disabled:opacity-50"
          >
            清空回收站
          </motion.button>
        )}
      </div>

      <div className="flex-1 overflow-y-auto px-5 pb-24">
        {loading ? (
          <div className="flex items-center justify-center py-20">
            <motion.div
              animate={{ rotate: 360 }}
              transition={{ repeat: Infinity, duration: 1, ease: "linear" }}
              className="w-6 h-6 border-2 border-[var(--text-secondary)] border-t-transparent rounded-full"
            />
          </div>
        ) : isEmpty ? (
          <div className="flex flex-col items-center justify-center py-20 text-[var(--text-secondary)]">
            <Trash2 className="w-12 h-12 mb-4 opacity-30" />
            <p className="text-sm">回收站为空</p>
          </div>
        ) : (
          <AnimatePresence mode="popLayout">
            {tasks.map((task) => {
              const config = TYPE_CONFIG[task.type] ?? TYPE_CONFIG.shortterm;
              const Icon = config.icon;
              return (
                <motion.div
                  key={`task-${task.id}`}
                  layout
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: 20 }}
                  className="flex items-center gap-3 px-4 py-3 rounded-2xl bg-[var(--bg-secondary)] mb-2"
                >
                  <div className="w-8 h-8 rounded-xl bg-danger-100 flex items-center justify-center flex-shrink-0">
                    <Icon className="w-4 h-4 text-danger-500" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="text-sm font-medium text-[var(--text-primary)] truncate">
                        {task.title || "未命名"}
                      </p>
                      <span
                        className={`flex-shrink-0 text-xs px-1.5 py-0.5 rounded-md font-medium ${config.color}`}
                      >
                        {config.label}
                      </span>
                    </div>
                    <p className="text-xs text-[var(--text-secondary)] mt-0.5">
                      {relativeTime(task.updatedAt)}删除
                    </p>
                  </div>
                  <div className="flex items-center gap-2 flex-shrink-0">
                    <motion.button
                      whileTap={{ scale: 0.95 }}
                      onClick={() => handleRestore(task.id!)}
                      className="p-2 rounded-xl bg-emerald-100 text-emerald-600 hover:bg-emerald-200 transition-colors"
                      title="恢复"
                    >
                      <RotateCcw className="w-4 h-4" />
                    </motion.button>
                    <motion.button
                      whileTap={{ scale: 0.95 }}
                      onClick={() => setPurgeConfirm(task.id!)}
                      className="p-2 rounded-xl bg-danger-100 text-danger-500 hover:bg-danger-200 transition-colors"
                      title="永久删除"
                    >
                      <Trash2 className="w-4 h-4" />
                    </motion.button>
                  </div>
                </motion.div>
              );
            })}
          </AnimatePresence>
        )}
      </div>

      <AnimatePresence>
        {purgeConfirm !== null && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/40"
            onClick={() => setPurgeConfirm(null)}
          >
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              onClick={(e) => e.stopPropagation()}
              className="bg-[var(--bg-primary)] rounded-3xl p-6 mx-5 max-w-sm w-full shadow-xl"
            >
              <div className="flex flex-col items-center text-center gap-3">
                <div className="w-12 h-12 rounded-full bg-danger-100 flex items-center justify-center">
                  <AlertTriangle className="w-6 h-6 text-danger-500" />
                </div>
                <div>
                  <h3 className="text-lg font-semibold text-[var(--text-primary)]">
                    {purgeConfirm === "all" ? "清空回收站" : "永久删除"}
                  </h3>
                  <p className="text-sm text-[var(--text-secondary)] mt-1">
                    {purgeConfirm === "all"
                      ? "此操作将永久删除回收站中的所有内容，不可撤销。"
                      : "此操作不可撤销，将永久删除该项。"}
                  </p>
                </div>
                <div className="flex gap-3 w-full mt-2">
                  <button
                    onClick={() => setPurgeConfirm(null)}
                    className="flex-1 px-4 py-2.5 rounded-xl text-sm font-medium border border-[var(--card-border)] text-[var(--text-primary)] hover:bg-[var(--bg-secondary)] transition-colors"
                  >
                    取消
                  </button>
                  <motion.button
                    whileTap={{ scale: 0.97 }}
                    disabled={purging}
                    onClick={() => {
                      if (purgeConfirm === "all") {
                        handlePurgeAll();
                      } else {
                        handlePurge(purgeConfirm);
                      }
                    }}
                    className="flex-1 px-4 py-2.5 rounded-xl text-sm font-medium bg-danger-500 text-white hover:bg-danger-600 transition-colors disabled:opacity-50"
                  >
                    {purging ? "处理中..." : "确认删除"}
                  </motion.button>
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
