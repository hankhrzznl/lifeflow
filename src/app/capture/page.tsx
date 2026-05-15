"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Inbox, Send, Trash2, Calendar, X } from "lucide-react";
import { createTask, deleteTask, restoreTask, updateTask, getTasksByType } from "@/lib/db";
import type { Task } from "@/lib/types";
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
    } catch (err) {
      console.error("添加捕捉失败:", err);
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
    } catch (err) {
      console.error("删除失败:", err);
    }
  };

  const handlePlan = async (id: number) => {
    setSwipedId(null);
    setSwipeOffset(0);
    activeSwipeIdRef.current = null;
    try {
      await updateTask(id, { status: "done" });
      await loadItems();
    } catch (err) {
      console.error("规划失败:", err);
    }
  };

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
                      className="w-20 bg-indigo-500 text-white flex items-center justify-center transition-colors hover:bg-indigo-600"
                    >
                      <Calendar className="w-5 h-5" />
                    </button>
                    <button
                      onClick={() => handleDelete(item.id!)}
                      className="w-20 bg-red-500 text-white flex items-center justify-center rounded-r-2xl transition-colors hover:bg-red-600"
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
                    onTouchStart={(e) => handleTouchStart(item.id!, e)}
                    onTouchMove={handleTouchMove}
                    onTouchEnd={handleTouchEnd}
                    onClick={() => {
                      if (isSwiped) closeSwipe();
                    }}
                  >
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
