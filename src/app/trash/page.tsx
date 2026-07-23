"use client";

import { useState, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Trash2, RotateCcw, AlertTriangle, Inbox, Calendar, Folder, Target } from "lucide-react";
import { getTrashItems, restoreFromTrash, purgeFromTrash, autoCleanupTrash } from "@/lib/db";
import { showToast } from "@/components/ui/Toast";
import type { TrashItem } from "@/lib/types";

const TABLE_CONFIG: Record<string, { label: string; icon: typeof Folder; color: string }> = {
  projects: { label: "项目", icon: Folder, color: "text-blue-500 bg-blue-50 dark:bg-blue-900/20" },
  tasks: { label: "任务", icon: Target, color: "text-purple-500 bg-purple-50 dark:bg-purple-900/20" },
  capture: { label: "收集", icon: Inbox, color: "text-amber-500 bg-amber-50 dark:bg-amber-900/20" },
  boards: { label: "看板", icon: Calendar, color: "text-emerald-500 bg-emerald-50 dark:bg-emerald-900/20" },
  sections: { label: "分区", icon: Target, color: "text-orange-500 bg-orange-50 dark:bg-orange-900/20" },
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
  if (days < 30) return `${Math.floor(days / 7)}周前`;
  return new Date(timestamp).toLocaleDateString("zh-CN");
}

function getItemTitle(item: TrashItem): string {
  const data = item.data;
  if (!data) return "未知项目";
  return (data.name as string) || (data.title as string) || (data.content as string) || "未命名";
}

export default function TrashPage() {
  const [items, setItems] = useState<TrashItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [purgeConfirm, setPurgeConfirm] = useState<number | "all" | null>(null);
  const [purging, setPurging] = useState(false);
  const [restoring, setRestoring] = useState<Set<number>>(new Set());

  const loadItems = useCallback(async () => {
    try {
      setError(null);
      const result = await getTrashItems();
      setItems(result);
    } catch {
      setError("加载回收站数据失败");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    autoCleanupTrash(30);
    const load = async () => { await loadItems(); };
    load();
  }, [loadItems]);

  async function handleRestore(trashId: number) {
    setRestoring((prev) => new Set(prev).add(trashId));
    try {
      await restoreFromTrash(trashId);
      await loadItems();
      showToast({ message: "已恢复", type: "success", duration: 2000 });
    } catch {
      showToast({ message: "恢复失败，请重试", type: "error", duration: 3000 });
    } finally {
      setRestoring((prev) => {
        const next = new Set(prev);
        next.delete(trashId);
        return next;
      });
    }
  }

  async function handlePurge(trashId: number) {
    setPurging(true);
    try {
      await purgeFromTrash(trashId);
      await loadItems();
      showToast({ message: "已永久删除", type: "info", duration: 2000 });
    } catch {
      showToast({ message: "删除失败，请重试", type: "error", duration: 3000 });
    } finally {
      setPurging(false);
      setPurgeConfirm(null);
    }
  }

  async function handlePurgeAll() {
    setPurging(true);
    try {
      for (const item of items) {
        await purgeFromTrash(item.id!);
      }
      await loadItems();
      showToast({ message: "回收站已清空", type: "info", duration: 2000 });
    } catch {
      showToast({ message: "清空失败，请重试", type: "error", duration: 3000 });
    } finally {
      setPurging(false);
      setPurgeConfirm(null);
    }
  }

  const isEmpty = items.length === 0;

  return (
    <div className="flex-1 flex flex-col h-full bg-[var(--bg-primary)]">
      <div className="flex items-center justify-between px-5 pt-[var(--safe-area-top)] pb-3">
        <div>
          <h1 className="text-xl font-bold text-[var(--text-primary)]">回收站</h1>
          <p className="text-sm text-[var(--text-secondary)] mt-1">
            {isEmpty ? "回收站为空" : `${items.length} 个项目等待清理`}
          </p>
        </div>
        {!isEmpty && (
          <motion.button
            whileTap={{ scale: 0.97 }}
            onClick={() => setPurgeConfirm("all")}
            disabled={purging}
            className="px-3 py-2 rounded-xl text-sm font-medium text-danger-500 border border-danger-500/30 hover:bg-danger-50 dark:hover:bg-danger-900/20 transition-colors disabled:opacity-50"
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
        ) : error ? (
          <div className="flex flex-col items-center justify-center py-20 gap-4">
            <div className="w-12 h-12 rounded-full bg-danger-100 dark:bg-danger-900/30 flex items-center justify-center">
              <AlertTriangle className="w-6 h-6 text-danger-500" />
            </div>
            <p className="text-sm text-[var(--text-secondary)]">{error}</p>
            <button
              onClick={loadItems}
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-primary-500 text-white text-sm font-medium hover:bg-primary-600 transition-colors"
            >
              <RotateCcw className="w-4 h-4" />
              重试
            </button>
          </div>
        ) : isEmpty ? (
          <div className="flex flex-col items-center justify-center py-20 text-[var(--text-secondary)]">
            <Trash2 className="w-12 h-12 mb-4 opacity-30" />
            <p className="text-sm">回收站为空</p>
            <p className="text-xs text-[var(--text-secondary)] mt-1 opacity-60">
              超过30天的内容将自动清理
            </p>
          </div>
        ) : (
          <AnimatePresence mode="popLayout">
            {items.map((item) => {
              const config = TABLE_CONFIG[item.originalTable] ?? TABLE_CONFIG.tasks;
              const Icon = config.icon;
              return (
                <motion.div
                  key={`trash-${item.id}`}
                  layout
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: 20 }}
                  className="flex items-center gap-3 px-4 py-3 rounded-2xl bg-[var(--bg-secondary)] mb-2"
                >
                  <div className={`w-8 h-8 rounded-xl flex items-center justify-center flex-shrink-0 ${config.color}`}>
                    <Icon className="w-4 h-4" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="text-sm font-medium text-[var(--text-primary)] truncate">
                        {getItemTitle(item)}
                      </p>
                      <span className="flex-shrink-0 text-xs px-1.5 py-0.5 rounded-md font-medium bg-gray-100 dark:bg-gray-800 text-[var(--text-secondary)]">
                        {config.label}
                      </span>
                    </div>
                    <p className="text-xs text-[var(--text-secondary)] mt-0.5">
                      {relativeTime(item.deletedAt)}删除
                    </p>
                  </div>
                  <div className="flex items-center gap-2 flex-shrink-0">
                    <motion.button
                      whileTap={{ scale: 0.95 }}
                      onClick={() => handleRestore(item.id!)}
                      disabled={restoring.has(item.id!)}
                      className="p-2 rounded-xl bg-emerald-100 dark:bg-emerald-900/20 text-emerald-600 dark:text-emerald-400 hover:bg-emerald-200 dark:hover:bg-emerald-900/40 transition-colors disabled:opacity-50"
                    >
                      <RotateCcw className="w-4 h-4" />
                    </motion.button>
                    <motion.button
                      whileTap={{ scale: 0.95 }}
                      onClick={() => setPurgeConfirm(item.id!)}
                      className="p-2 rounded-xl bg-danger-100 dark:bg-danger-900/20 text-danger-500 hover:bg-danger-200 dark:hover:bg-danger-900/40 transition-colors"
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
                <div className="w-12 h-12 rounded-full bg-danger-100 dark:bg-danger-900/30 flex items-center justify-center">
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
