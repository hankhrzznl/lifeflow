"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Inbox, Send, Trash2, Calendar, X, Target, Mountain, CalendarDays, ClipboardList, Flame, CheckSquare, XCircle } from "lucide-react";
import { createTask, deleteTask, restoreTask, updateTask, getTasksByType } from "@/lib/db";
import type { Task, GoalViewType } from "@/lib/types";
import { showToast } from "@/components/ui/Toast";

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

const SWIPE_THRESHOLD = 80;
const SWIPE_MAX = 160;

const GOAL_TYPES: { type: GoalViewType; label: string; desc: string; icon: typeof Mountain; color: string }[] = [
  { type: "longterm", label: "长期目标", desc: "成为一个更大目标的里程碑", icon: Mountain, color: "text-indigo-600" },
  { type: "shortterm", label: "短期事件", desc: "作为独立事件执行", icon: CalendarDays, color: "text-blue-600" },
  { type: "daily", label: "日常琐事", desc: "转为每天重复的待办", icon: ClipboardList, color: "text-green-600" },
  { type: "habits", label: "习惯追踪", desc: "建立一个新的日常习惯", icon: Flame, color: "text-orange-600" },
];

export default function CapturePage() {
  const [content, setContent] = useState("");
  const [tags, setTags] = useState<string[]>([]);
  const [tagInput, setTagInput] = useState("");
  const [items, setItems] = useState<Task[]>([]);
  const allActiveRef = useRef<Task[]>([]);
  const [hasMore, setHasMore] = useState(false);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [swipedId, setSwipedId] = useState<number | null>(null);
  const [swipeOffset, setSwipeOffset] = useState(0);

  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const touchStartXRef = useRef(0);
  const activeSwipeIdRef = useRef<number | null>(null);
  const longPressTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const [assignTargetId, setAssignTargetId] = useState<number | null>(null);
  const [batchMode, setBatchMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());

  const loadItems = useCallback(async () => {
    const all = await getTasksByType("daily");
    const active = all
      .filter((t) => t.status === "active")
      .sort((a, b) => b.createdAt - a.createdAt);
    allActiveRef.current = active;
    setItems(active.slice(0, 20));
    setHasMore(active.length > 20);
  }, []);

  const loadMore = useCallback(async () => {
    if (isLoadingMore || !hasMore || items.length === 0) return;
    setIsLoadingMore(true);
    const nextSlice = allActiveRef.current.slice(items.length, items.length + 20);
    setItems((prev) => [...prev, ...nextSlice]);
    setHasMore(items.length + nextSlice.length < allActiveRef.current.length);
    setIsLoadingMore(false);
  }, [isLoadingMore, hasMore, items]);

  useEffect(() => {
    queueMicrotask(() => loadItems());
    const interval = setInterval(loadItems, 30000);
    return () => clearInterval(interval);
  }, [loadItems]);

  const handleSubmit = async () => {
    const trimmed = content.trim();
    if (!trimmed || isSubmitting) return;

    setIsSubmitting(true);
    try {
      await createTask({
        title: trimmed,
        type: "daily",
        status: "active",
        tags,
      });
      setContent("");
      setTags([]);
      setTagInput("");
      await loadItems();
      setTimeout(() => {
        textareaRef.current?.focus();
      }, 600);
    } catch {
    } finally {
      setTimeout(() => setIsSubmitting(false), 500);
    }
  };

  const handleDelete = async (id: number) => {
    setSwipedId(null);
    setSwipeOffset(0);
    activeSwipeIdRef.current = null;
    try {
      await deleteTask(id);
      showToast({
        message: "已移入回收站",
        type: "info",
        duration: 5000,
        undoAction: async () => {
          await restoreTask(id);
          await loadItems();
        },
      });
      await loadItems();
    } catch {
    }
  };

  const handlePlan = async (id: number) => {
    setSwipedId(null);
    setSwipeOffset(0);
    activeSwipeIdRef.current = null;
    try {
      await updateTask(id, { status: "done" });
      await loadItems();
    } catch {
      // fail silently
    }
  };

  const handleAssignGoal = async (targetType: GoalViewType) => {
    const captureId = assignTargetId;
    if (!captureId) return;
    setAssignTargetId(null);
    setSwipedId(null);
    setSwipeOffset(0);
    activeSwipeIdRef.current = null;

    try {
      const item = allActiveRef.current.find((t) => t.id === captureId);
      if (!item) return;

      const taskType = targetType === "habits" ? "habit" : targetType;
      await createTask({
        title: item.title,
        type: taskType,
        status: "active",
        tags: item.tags,
      });

      await updateTask(captureId, { status: "done" });

      showToast({
        message: `已分配到「${GOAL_TYPES.find((g) => g.type === targetType)?.label}」`,
        type: "success",
      });

      await loadItems();
    } catch {
      showToast({ message: "分配失败，请重试", type: "error" });
    }
  };

  const handleAssignClick = (id: number) => {
    setAssignTargetId(id);
  };

  const toggleBatchSelect = (id: number) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  const enterBatchMode = () => {
    setBatchMode(true);
    setSwipedId(null);
    setSwipeOffset(0);
    activeSwipeIdRef.current = null;
  };

  const exitBatchMode = () => {
    setBatchMode(false);
    setSelectedIds(new Set());
  };

  const handleBatchDelete = async () => {
    if (selectedIds.size === 0) return;
    const ids = [...selectedIds];
    try {
      for (const id of ids) await deleteTask(id);
      showToast({
        message: `已批量删除 ${ids.length} 条`,
        type: "info",
        undoAction: async () => {
          for (const id of ids) await restoreTask(id);
          await loadItems();
        },
      });
      exitBatchMode();
      await loadItems();
    } catch {
      showToast({ message: "批量删除失败", type: "error" });
    }
  };

  const handleLongPressStart = useCallback((id: number) => {
    if (batchMode) return;
    longPressTimerRef.current = setTimeout(() => {
      enterBatchMode();
      setSelectedIds(new Set([id]));
    }, 500);
  }, [batchMode]);

  const handleLongPressEnd = useCallback(() => {
    if (longPressTimerRef.current) {
      clearTimeout(longPressTimerRef.current);
      longPressTimerRef.current = null;
    }
  }, []);

  useEffect(() => {
    return () => {
      if (longPressTimerRef.current) clearTimeout(longPressTimerRef.current);
    };
  }, []);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSubmit();
    }
  };

  const addTag = useCallback(
    (input: string) => {
      const tag = input.replace(/[,，]/g, "").trim();
      if (tag && !tags.includes(tag)) {
        setTags((prev) => [...prev, tag]);
      }
      setTagInput("");
    },
    [tags]
  );

  const removeTag = (tag: string) => {
    setTags((prev) => prev.filter((t) => t !== tag));
  };

  const handleTagInputKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" || e.key === ",") {
      e.preventDefault();
      if (tagInput.trim()) {
        addTag(tagInput);
      }
      return;
    }
    if (e.key === "Backspace" && !tagInput && tags.length > 0) {
      setTags((prev) => prev.slice(0, -1));
    }
  };

  const handleTouchStart = useCallback(
    (id: number, e: React.TouchEvent) => {
      touchStartXRef.current = e.touches[0].clientX;
      activeSwipeIdRef.current = id;
      setSwipedId(id);
      setSwipeOffset(0);
    },
    []
  );

  const handleTouchMove = useCallback((e: React.TouchEvent) => {
    if (activeSwipeIdRef.current === null) return;
    const delta = e.touches[0].clientX - touchStartXRef.current;
    const offset = Math.max(-SWIPE_MAX, Math.min(0, delta));
    setSwipeOffset(offset);
  }, []);

  const handleTouchEnd = useCallback(() => {
    if (swipeOffset < -SWIPE_THRESHOLD) {
      setSwipeOffset(-SWIPE_MAX);
    } else {
      activeSwipeIdRef.current = null;
      setSwipedId(null);
      setSwipeOffset(0);
    }
  }, [swipeOffset]);

  const closeSwipe = useCallback(() => {
    activeSwipeIdRef.current = null;
    setSwipedId(null);
    setSwipeOffset(0);
  }, []);

  const charCount = content.length;

  return (
    <div className="flex flex-col h-full max-w-2xl mx-auto px-4 pt-6 pb-24 md:pb-6">
      <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100 mb-5">
        快速捕捉
      </h1>

      <motion.div
        className="mb-6"
        layout
        transition={{ type: "spring", stiffness: 500, damping: 35 }}
      >
        <motion.div
          className="relative"
          animate={
            isSubmitting
              ? { scaleY: 0.35, opacity: 0.2 }
              : { scaleY: 1, opacity: 1 }
          }
          transition={{ type: "spring", stiffness: 400, damping: 30 }}
          style={{ originY: 0 }}
        >
          <textarea
            ref={textareaRef}
            value={content}
            onChange={(e) => setContent(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="记录任何想法、任务或灵感..."
            rows={4}
            className="w-full p-4 pb-8 rounded-2xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 resize-none focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent placeholder-gray-400 dark:placeholder-gray-500 transition-shadow text-base leading-relaxed"
            autoFocus
          />
          <span className="absolute bottom-3 right-3 text-xs text-gray-400 dark:text-gray-500 tabular-nums select-none">
            {charCount}
          </span>
        </motion.div>

        <div className="mt-3">
          <AnimatePresence>
            {tags.length > 0 && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: "auto" }}
                exit={{ opacity: 0, height: 0 }}
                className="flex flex-wrap gap-2 mb-2"
              >
                {tags.map((tag) => (
                  <motion.span
                    key={tag}
                    initial={{ opacity: 0, scale: 0.7 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.7 }}
                    className="inline-flex items-center gap-1 px-2.5 py-1 bg-indigo-50 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400 rounded-lg text-xs font-medium"
                  >
                    #{tag}
                    <button
                      onClick={() => removeTag(tag)}
                      className="hover:text-indigo-800 dark:hover:text-indigo-200 transition-colors"
                    >
                      <X className="w-3 h-3" />
                    </button>
                  </motion.span>
                ))}
              </motion.div>
            )}
          </AnimatePresence>
          <input
            type="text"
            value={tagInput}
            onChange={(e) => setTagInput(e.target.value)}
            onKeyDown={handleTagInputKeyDown}
            placeholder="添加标签（逗号或回车分隔）"
            className="w-full px-3 py-2 text-sm rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-indigo-500/50 focus:border-transparent placeholder-gray-400 dark:placeholder-gray-500"
          />
        </div>

        <motion.button
          onClick={handleSubmit}
          disabled={!content.trim() || isSubmitting}
          whileTap={{ scale: 0.97 }}
          className="mt-4 w-full py-3 bg-gradient-to-r from-indigo-500 to-violet-600 text-white rounded-2xl font-medium flex items-center justify-center gap-2 hover:from-indigo-600 hover:to-violet-700 disabled:opacity-40 disabled:cursor-not-allowed transition-all shadow-lg shadow-indigo-500/25"
        >
          <Send className="w-4 h-4" />
          捕捉
        </motion.button>
      </motion.div>

      <AnimatePresence>
        {batchMode && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="mb-3 px-4 py-2 bg-indigo-50 dark:bg-indigo-900/30 rounded-xl flex items-center justify-between"
          >
            <span className="text-sm font-medium text-indigo-700 dark:text-indigo-300">
              已选 {selectedIds.size} 项
            </span>
            <div className="flex items-center gap-2">
              <button
                onClick={handleBatchDelete}
                disabled={selectedIds.size === 0}
                className="flex items-center gap-1 text-xs font-medium text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-900/20 px-3 py-1.5 rounded-lg hover:bg-red-100 dark:hover:bg-red-900/40 transition-colors disabled:opacity-40"
              >
                <Trash2 className="w-3.5 h-3.5" />
                删除
              </button>
              <button
                onClick={exitBatchMode}
                className="flex items-center gap-1 text-xs font-medium text-gray-600 dark:text-gray-400 bg-gray-100 dark:bg-gray-800 px-3 py-1.5 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors"
              >
                <XCircle className="w-3.5 h-3.5" />
                取消
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {assignTargetId !== null && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 bg-black/40 backdrop-blur-sm flex items-end justify-center"
            onClick={() => setAssignTargetId(null)}
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
              <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-1">分配目标</h3>
              <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">选择要将这条想法分配到的目标类型</p>
              <div className="space-y-2">
                {GOAL_TYPES.map(({ type, label, desc, icon: Icon, color }) => (
                  <button
                    key={type}
                    onClick={() => handleAssignGoal(type)}
                    className="w-full flex items-center gap-4 p-3 rounded-xl hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors text-left"
                  >
                    <div className={`w-10 h-10 rounded-xl bg-gray-100 dark:bg-gray-800 flex items-center justify-center ${color}`}>
                      <Icon className="w-5 h-5" />
                    </div>
                    <div>
                      <p className="text-sm font-medium text-gray-900 dark:text-gray-100">{label}</p>
                      <p className="text-xs text-gray-500 dark:text-gray-400">{desc}</p>
                    </div>
                  </button>
                ))}
              </div>
              <button
                onClick={() => setAssignTargetId(null)}
                className="mt-4 w-full py-3 rounded-xl border border-gray-200 dark:border-gray-700 text-sm text-gray-500 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors"
              >
                取消
              </button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      <div className="flex-1 overflow-y-auto -mx-4 px-4 scrollbar-hide">
        <AnimatePresence mode="popLayout">
          {items.length === 0 ? (
            <motion.div
              key="empty"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.3 }}
              className="flex flex-col items-center justify-center py-20 text-center"
            >
              <div className="w-20 h-20 rounded-3xl bg-gray-100 dark:bg-gray-800 flex items-center justify-center mb-5">
                <Inbox className="w-10 h-10 text-gray-400 dark:text-gray-500" />
              </div>
              <p className="text-gray-500 dark:text-gray-400 text-base">
                还没有任何想法，开始记录吧
              </p>
            </motion.div>
          ) : (
            items.map((item) => {
              const isSwiped = swipedId === item.id;
              const offset = isSwiped ? swipeOffset : 0;

              return (
                <motion.div
                  key={item.id}
                  layout
                  initial={{ opacity: 0, y: -12, scale: 0.96 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, x: -30 }}
                  transition={{
                    type: "spring",
                    stiffness: 500,
                    damping: 35,
                  }}
                  className="relative mb-3 overflow-hidden rounded-2xl"
                >
                  <div className="absolute inset-y-0 right-0 flex">
                    <button
                      onClick={() => handlePlan(item.id!)}
                      className="w-16 bg-emerald-500 text-white flex items-center justify-center transition-colors hover:bg-emerald-600"
                    >
                      <Calendar className="w-5 h-5" />
                    </button>
                    <button
                      onClick={() => handleAssignClick(item.id!)}
                      className="w-16 bg-indigo-500 text-white flex items-center justify-center transition-colors hover:bg-indigo-600"
                    >
                      <Target className="w-5 h-5" />
                    </button>
                    <button
                      onClick={() => handleDelete(item.id!)}
                      className="w-16 bg-red-500 text-white flex items-center justify-center rounded-r-2xl transition-colors hover:bg-red-600"
                    >
                      <Trash2 className="w-5 h-5" />
                    </button>
                  </div>

                  <motion.div
                    className="p-4 bg-white dark:bg-gray-800 border border-gray-100 dark:border-gray-700 shadow-sm rounded-2xl relative cursor-pointer"
                    animate={{ x: offset }}
                    transition={
                      isSwiped
                        ? { type: "spring", stiffness: 600, damping: 40 }
                        : { type: "spring", stiffness: 500, damping: 35 }
                    }
                    onTouchStart={(e) => {
                      if (batchMode) return;
                      handleTouchStart(item.id!, e);
                      handleLongPressStart(item.id!);
                    }}
                    onTouchMove={(e) => {
                      handleLongPressEnd();
                      if (batchMode) return;
                      handleTouchMove(e);
                    }}
                    onTouchEnd={() => {
                      handleLongPressEnd();
                      if (batchMode) return;
                      handleTouchEnd();
                    }}
                    onMouseDown={() => handleLongPressStart(item.id!)}
                    onMouseUp={handleLongPressEnd}
                    onMouseLeave={handleLongPressEnd}
                    onClick={() => {
                      if (batchMode) {
                        toggleBatchSelect(item.id!);
                        return;
                      }
                      if (isSwiped) closeSwipe();
                    }}
                  >
                    {batchMode && (
                      <div className="flex items-center gap-3 mb-1">
                        <div
                          className={`w-5 h-5 rounded-md border-2 flex items-center justify-center transition-colors ${
                            selectedIds.has(item.id!)
                              ? "bg-indigo-600 border-indigo-600"
                              : "border-gray-300 dark:border-gray-600"
                          }`}
                        >
                          {selectedIds.has(item.id!) && <CheckSquare className="w-3.5 h-3.5 text-white" />}
                        </div>
                      </div>
                    )}
                    <p className="text-gray-800 dark:text-gray-200 text-sm leading-relaxed whitespace-pre-wrap break-words">
                      {item.title}
                    </p>
                    <div className="flex items-center gap-2 mt-2.5">
                      {(item.tags ?? []).map((tag) => (
                        <span
                          key={tag}
                          className="text-xs text-indigo-500 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-900/20 px-2 py-0.5 rounded-md"
                        >
                          #{tag}
                        </span>
                      ))}
                      <span className="text-xs text-gray-400 dark:text-gray-500 ml-auto">
                        {relativeTime(item.createdAt)}
                      </span>
                    </div>
                  </motion.div>
                </motion.div>
              );
            })
          )}
          {hasMore && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="flex justify-center py-4"
            >
              <button
                onClick={loadMore}
                disabled={isLoadingMore}
                className="text-sm text-indigo-500 hover:text-indigo-600 dark:text-indigo-400 font-medium transition-colors disabled:opacity-50"
              >
                {isLoadingMore ? "加载中..." : "加载更多"}
              </button>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
