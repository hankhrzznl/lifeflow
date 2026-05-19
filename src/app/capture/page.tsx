"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Inbox, Send, Trash2, X,
  ChevronRight, Layers,
} from "lucide-react";
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

export default function CapturePage() {
  const [content, setContent] = useState("");
  const [tags, setTags] = useState<string[]>([]);
  const [tagInput, setTagInput] = useState("");
  const [items, setItems] = useState<Task[]>([]);
  const allActiveRef = useRef<Task[]>([]);
  const [hasMore, setHasMore] = useState(false);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const [batchMode, setBatchMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());
  const [flowTarget, setFlowTarget] = useState<Task | null>(null);
  const [flowSheet, setFlowSheet] = useState(false);
  const [flowLoading, setFlowLoading] = useState(false);

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
    const remaining = allActiveRef.current.slice(items.length, items.length + 20);
    setItems((prev) => [...prev, ...remaining]);
    setHasMore(allActiveRef.current.length > items.length + 20);
    setIsLoadingMore(false);
  }, [isLoadingMore, hasMore, items.length]);

  useEffect(() => { loadItems(); }, [loadItems]);

  const handleSubmit = async () => {
    const val = content.trim();
    if (!val) return;
    setIsSubmitting(true);
    try {
      await createTask({ title: val, type: "daily", status: "active", tags: tags.length > 0 ? tags : undefined });
      setContent("");
      setTags([]);
      setTagInput("");
      showToast({ message: "已捕捉", type: "success" });
      await loadItems();
      requestAnimationFrame(() => {
        textareaRef.current?.focus();
        window.scrollTo({ top: 0, behavior: "smooth" });
      });
    } catch { showToast({ message: "保存失败", type: "error" }); }
    finally { setIsSubmitting(false); }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) {
      e.preventDefault();
      handleSubmit();
    } else if (e.key === "Enter" && tagInput) {
      e.preventDefault();
      const val = tagInput.trim();
      if (val && !tags.includes(val)) setTags((prev) => [...prev, val]);
      setTagInput("");
    }
  };

  const handleDelete = async (id: number) => {
    try {
      await updateTask(id, { status: "archived" });
      setItems((prev) => prev.filter((t) => t.id !== id));
      showToast({ message: "已移除", type: "info" });
    } catch { showToast({ message: "删除失败", type: "error" }); }
  };

  const charCount = content.length;

  const openDispatch = useCallback((item: Task) => {
    setFlowTarget(item);
    setFlowSheet(true);
  }, []);

  const closeFlow = useCallback(() => {
    setFlowTarget(null);
    setFlowSheet(false);
  }, []);

  const handleDispatchTask = useCallback(async (asMilestone: boolean) => {
    if (!flowTarget) return;
    setFlowLoading(true);
    try {
      await createTask({
        title: flowTarget.title,
        type: asMilestone ? "longterm" : "shortterm",
        status: "active",
        priority: "not-urgent-important",
        tags: flowTarget.tags,
      });
      await updateTask(flowTarget.id!, { status: "done" });
      showToast({ message: asMilestone ? "已创建为可拆解事项" : "已送入安排事项", type: "success" });
      closeFlow();
      await loadItems();
    } catch { showToast({ message: "操作失败", type: "error" }); }
    finally { setFlowLoading(false); }
  }, [flowTarget, closeFlow, loadItems]);

  const toggleBatchSelect = (id: number) => {
    setSelectedIds((prev) => { const next = new Set(prev); if (next.has(id)) next.delete(id); else next.add(id); return next; });
  };

  const exitBatchMode = () => { setBatchMode(false); setSelectedIds(new Set()); };

  const handleBatchDelete = async () => {
    for (const id of selectedIds) {
      try { await deleteTask(id); } catch { /* ignore */ }
    }
    showToast({ message: `已删除${selectedIds.size}项`, type: "info" });
    exitBatchMode();
    await loadItems();
  };

  let longPressTimer: ReturnType<typeof setTimeout> | null = null;
  const handleLongPressStart = (id: number) => {
    if (batchMode) return;
    longPressTimer = setTimeout(() => { setBatchMode(true); setSelectedIds(new Set([id])); }, 500);
  };
  const handleLongPressEnd = () => { if (longPressTimer) { clearTimeout(longPressTimer); longPressTimer = null; } };

  return (
    <div className="flex flex-col h-full min-h-0">

      <div className="flex-shrink-0 bg-white dark:bg-gray-800 border border-gray-100 dark:border-gray-700 shadow-sm rounded-2xl p-4 mx-4 mt-2 mb-3">
        <textarea
          ref={textareaRef}
          value={content}
          onChange={(e) => setContent(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="现在在想什么？"
          rows={2}
          maxLength={500}
          className="w-full resize-none bg-transparent text-gray-800 dark:text-gray-200 placeholder-gray-400 dark:placeholder-gray-500 outline-none text-sm"
          autoFocus
        />

        <div className="flex items-center justify-between mt-3">
          <div className="flex items-center gap-2 flex-1 flex-wrap">
            {tags.map((tag) => (
              <span key={tag} className="text-xs text-indigo-500 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-900/20 px-2 py-0.5 rounded-md flex items-center gap-1">
                #{tag}
                <button onClick={() => setTags((prev) => prev.filter((t) => t !== tag))} className="text-indigo-400 hover:text-indigo-600"><X className="w-3 h-3" /></button>
              </span>
            ))}
            <input
              type="text"
              value={tagInput}
              onChange={(e) => setTagInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  const val = tagInput.trim();
                  if (val && !tags.includes(val)) setTags((prev) => [...prev, val]);
                  setTagInput("");
                }
              }}
              placeholder={tags.length === 0 ? "添加标签..." : ""}
              className="w-20 text-xs bg-transparent outline-none text-gray-400 placeholder-gray-300"
            />
          </div>
          <div className="flex items-center gap-3 flex-shrink-0">
            <span className="text-xs text-gray-400">{charCount}/500</span>
            <button
              type="button"
              onClick={handleSubmit}
              disabled={isSubmitting || !content.trim()}
              className="w-10 h-10 rounded-2xl bg-gradient-to-br from-blue-500 to-blue-700 text-white flex items-center justify-center shadow-lg shadow-blue-500/20 hover:shadow-blue-500/40 active:scale-[0.96] transition-all duration-150 disabled:opacity-40 disabled:cursor-not-allowed"
            >
              <Send className="w-5 h-5" strokeWidth={2} />
            </button>
          </div>
        </div>
      </div>

      <AnimatePresence>
        {batchMode && (
          <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }} className="mb-3 px-4 py-2 bg-indigo-50 dark:bg-indigo-900/30 rounded-xl flex items-center justify-between">
            <span className="text-sm font-medium text-indigo-700 dark:text-indigo-300">已选 {selectedIds.size} 项</span>
            <div className="flex items-center gap-2">
              <button onClick={handleBatchDelete} disabled={selectedIds.size === 0} className="flex items-center gap-1 text-xs font-medium text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-900/20 px-3 py-1.5 rounded-lg hover:bg-red-100 dark:hover:bg-red-900/40 transition-colors disabled:opacity-40"><Trash2 className="w-3.5 h-3.5" />删除</button>
              <button onClick={exitBatchMode} className="flex items-center gap-1 text-xs font-medium text-gray-600 dark:text-gray-400 bg-gray-100 dark:bg-gray-800 px-3 py-1.5 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors"><X className="w-3.5 h-3.5" />取消</button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <div className="flex-1 overflow-y-auto -mx-4 px-4 scrollbar-hide">
        <AnimatePresence mode="popLayout">
          {items.length === 0 ? (
            <motion.div key="empty" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} transition={{ duration: 0.3 }} className="flex flex-col items-center justify-center py-20 text-center">
              <div className="w-20 h-20 rounded-3xl bg-gray-100 dark:bg-gray-800 flex items-center justify-center mb-5"><Inbox className="w-10 h-10 text-gray-400 dark:text-gray-500" /></div>
              <p className="text-gray-500 dark:text-gray-400 text-base">还没有任何想法，开始记录吧</p>
            </motion.div>
          ) : (
            items.map((item) => (
              <motion.div key={item.id} layout initial={{ opacity: 0, y: -12, scale: 0.96 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, x: -30 }} transition={{ type: "spring", stiffness: 500, damping: 35 }} className="mb-3">
                <div
                  className="bg-white dark:bg-gray-800 border border-gray-100 dark:border-gray-700 shadow-sm rounded-2xl p-4 relative cursor-pointer"
                  onMouseDown={() => handleLongPressStart(item.id!)} onMouseUp={handleLongPressEnd} onMouseLeave={handleLongPressEnd}
                  onClick={() => { if (batchMode) toggleBatchSelect(item.id!); }}
                >
                  {batchMode && (
                    <div className={`w-5 h-5 rounded-md border-2 flex items-center justify-center transition-colors ${selectedIds.has(item.id!) ? "bg-indigo-600 border-indigo-600" : "border-gray-300 dark:border-gray-600"}`}>
                      {selectedIds.has(item.id!) && <X className="w-3.5 h-3.5 text-white" />}
                    </div>
                  )}
                  <p className="text-gray-800 dark:text-gray-200 text-sm leading-relaxed whitespace-pre-wrap break-words line-clamp-2 pr-2">{item.title}</p>
                  <div className="flex items-center justify-between mt-3">
                    <div className="flex items-center gap-2">
                      {(item.tags ?? []).slice(0, 3).map((tag) => (
                        <span key={tag} className="text-xs text-indigo-500 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-900/20 px-2 py-0.5 rounded-md">#{tag}</span>
                      ))}
                      <span className="text-xs text-gray-400 dark:text-gray-500">{relativeTime(item.createdAt)}</span>
                    </div>
                    <div className="flex items-center gap-3">
                      <button
                        onClick={(e) => { e.stopPropagation(); openDispatch(item); }}
                        className="text-sm text-blue-500 font-medium hover:text-blue-600 active:scale-[0.97] transition-transform duration-120 min-w-[44px] min-h-[44px] flex items-center justify-center px-2"
                      >
                        下一步
                      </button>
                      <button
                        onClick={(e) => { e.stopPropagation(); handleDelete(item.id!); }}
                        className="text-sm text-red-400 font-medium hover:text-red-500 active:scale-[0.97] transition-transform duration-120 min-w-[44px] min-h-[44px] flex items-center justify-center px-2"
                      >
                        删除
                      </button>
                    </div>
                  </div>
                </div>
              </motion.div>
            ))
          )}
          {hasMore && (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex justify-center py-4">
              <button onClick={loadMore} disabled={isLoadingMore} className="text-sm text-indigo-500 hover:text-indigo-600 dark:text-indigo-400 font-medium transition-colors disabled:opacity-50">{isLoadingMore ? "加载中..." : "加载更多"}</button>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Dispatch Sheet */}
      <AnimatePresence>
        {flowSheet && flowTarget && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-50 bg-black/40 backdrop-blur-sm flex items-end justify-center" onClick={closeFlow}>
            <motion.div initial={{ y: "100%" }} animate={{ y: 0 }} exit={{ y: "100%" }} transition={{ type: "spring", stiffness: 400, damping: 40 }} onClick={(e) => e.stopPropagation()} className="w-full max-w-lg bg-white dark:bg-gray-900 rounded-t-2xl">
              <div className="w-10 h-1 bg-gray-300 dark:bg-gray-700 rounded-full mx-auto mt-3 mb-1" />
              <div className="px-6 pt-4 pb-6">
                <h3 className="text-base font-semibold text-gray-900 dark:text-gray-100 mb-1">选择事项类型</h3>
                <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">{`"${flowTarget.title.slice(0, 40)}" 要作为？`}</p>
                <div className="space-y-2">
                  <button
                    onClick={() => handleDispatchTask(false)}
                    disabled={flowLoading}
                    className="w-full flex items-center gap-4 p-4 rounded-xl bg-blue-50 dark:bg-blue-900/20 hover:bg-blue-100 dark:hover:bg-blue-900/40 transition-colors text-left active:scale-[0.98] disabled:opacity-50"
                  >
                    <div className="w-10 h-10 rounded-xl bg-blue-500 text-white flex items-center justify-center">
                      <Send className="w-5 h-5" />
                    </div>
                    <div className="flex-1">
                      <p className="text-sm font-medium text-gray-900 dark:text-gray-100">作为独立事项</p>
                      <p className="text-xs text-gray-500 dark:text-gray-400">直接进入安排流程，设置优先级与截止日期</p>
                    </div>
                    <ChevronRight className="w-5 h-5 text-gray-400" />
                  </button>
                  <button
                    onClick={() => handleDispatchTask(true)}
                    disabled={flowLoading}
                    className="w-full flex items-center gap-4 p-4 rounded-xl bg-indigo-50 dark:bg-indigo-900/20 hover:bg-indigo-100 dark:hover:bg-indigo-900/40 transition-colors text-left active:scale-[0.98] disabled:opacity-50"
                  >
                    <div className="w-10 h-10 rounded-xl bg-indigo-500 text-white flex items-center justify-center">
                      <Layers className="w-5 h-5" />
                    </div>
                    <div className="flex-1">
                      <p className="text-sm font-medium text-gray-900 dark:text-gray-100">作为可拆解事项</p>
                      <p className="text-xs text-gray-500 dark:text-gray-400">在安排流程中拆解为多个子事项逐步完成</p>
                    </div>
                    <ChevronRight className="w-5 h-5 text-gray-400" />
                  </button>
                </div>
                <button onClick={closeFlow} className="mt-3 w-full py-3 rounded-xl border border-gray-200 dark:border-gray-700 text-sm text-gray-500 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors">
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
