"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Inbox, Send, Trash2, X, Mountain,
  CalendarDays, ClipboardList, Flame, CheckSquare, XCircle,
  ChevronRight,
} from "lucide-react";
import { createTask, deleteTask, restoreTask, updateTask, createSection, updateSection, getTasksByType, getAllProjectsV2, getBoardsByProject, getSectionsByBoard } from "@/lib/db";
import type { Task, GoalViewType, ProjectV2, Board, Section, Priority } from "@/lib/types";
import { PRIORITY_CONFIG } from "@/lib/types";
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

const CLASSIFICATION_OPTIONS = [
  { key: "short-term", label: "短期事件", icon: CalendarDays, color: "text-blue-500", bgColor: "bg-blue-50" },
  { key: "daily-trivial", label: "日常琐事", icon: ClipboardList, color: "text-green-500", bgColor: "bg-green-50" },
  { key: "habits", label: "习惯", icon: Flame, color: "text-orange-500", bgColor: "bg-orange-50" },
] as const;

type ClassificationType = (typeof CLASSIFICATION_OPTIONS)[number]["key"];

const GOAL_TYPES: { type: GoalViewType; label: string; desc: string; icon: typeof Mountain; color: string }[] = [
  { type: "long-term", label: "长期目标", desc: "成为一个更大目标的里程碑", icon: Mountain, color: "text-indigo-600" },
  { type: "short-term", label: "短期事件", desc: "作为独立事件执行", icon: CalendarDays, color: "text-blue-600" },
  { type: "daily-trivial", label: "日常琐事", desc: "转为每天重复的待办", icon: ClipboardList, color: "text-green-600" },
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

  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const [assignTargetId, setAssignTargetId] = useState<number | null>(null);
  const [batchMode, setBatchMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());

  const [classifyTarget, setClassifyTarget] = useState<Task | null>(null);
  const [flowPhase, setFlowPhase] = useState<"idle" | "chooseType" | "moduleForm" | "taskClassify" | "taskForm">("idle");
  const [selectedStages, setSelectedStages] = useState<number | null>(null);
  const [selectedClassification, setSelectedClassification] = useState<ClassificationType | null>(null);
  const [taskDraft, setTaskDraft] = useState<{
    title: string;
    priority: Priority;
    projectId: number | null;
    boardId: number | null;
    sectionId: number | null;
    note: string;
    dueDate: string;
    successCriteria: string;
    startTime: string;
    endTime: string;
    frequency: "daily" | "weekly" | "monthly";
    targetCount: string;
  }>({ title: "", priority: "not-urgent-important", projectId: null, boardId: null, sectionId: null, note: "", dueDate: "", successCriteria: "", startTime: "", endTime: "", frequency: "daily", targetCount: "" });

  const [projects, setProjects] = useState<ProjectV2[]>([]);
  const [boards, setBoards] = useState<Board[]>([]);
  const [sections, setSections] = useState<Section[]>([]);

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
    const load = async () => { await loadItems(); };
    load();
    const interval = setInterval(loadItems, 30000);
    return () => clearInterval(interval);
  }, [loadItems]);

  const handleSubmit = async () => {
    const trimmed = content.trim();
    if (!trimmed || isSubmitting) return;
    setIsSubmitting(true);
    try {
      await createTask({ title: trimmed, type: "daily", status: "active", tags });
      setContent("");
      setTags([]);
      setTagInput("");
      await loadItems();
      setTimeout(() => { textareaRef.current?.focus(); }, 600);
    } catch {
    } finally {
      setTimeout(() => setIsSubmitting(false), 500);
    }
  };

  const handleDelete = async (id: number) => {
    try {
      await deleteTask(id);
      showToast({ message: "已移入回收站", type: "info", undoAction: async () => { await restoreTask(id); await loadItems(); } });
      await loadItems();
    } catch {
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); handleSubmit(); }
  };

  const addTag = useCallback((input: string) => {
    const tag = input.replace(/[,，]/g, "").trim();
    if (tag && !tags.includes(tag)) setTags((prev) => [...prev, tag]);
    setTagInput("");
  }, [tags]);

  const removeTag = (tag: string) => { setTags((prev) => prev.filter((t) => t !== tag)); };

  const handleTagInputKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" || e.key === ",") { e.preventDefault(); if (tagInput.trim()) addTag(tagInput); return; }
    if (e.key === "Backspace" && !tagInput && tags.length > 0) setTags((prev) => prev.slice(0, -1));
  };

  const charCount = content.length;

  const handleNextStep = useCallback(async (item: Task) => {
    setClassifyTarget(item);
    setFlowPhase("chooseType");
    setSelectedStages(null);
    setTaskDraft({
      title: item.title,
      priority: "not-urgent-important",
      projectId: null,
      boardId: null,
      sectionId: null,
      note: "",
      dueDate: "",
      successCriteria: "",
      startTime: "",
      endTime: "",
      frequency: "daily",
      targetCount: "",
    });
  }, []);

  const handleClassifySelect = useCallback(async (classification: ClassificationType) => {
    setSelectedClassification(classification);
    setFlowPhase("taskForm");
    const [fetchedProjects] = await Promise.all([getAllProjectsV2().catch(() => [] as ProjectV2[])]);
    setProjects(fetchedProjects);
    setBoards([]);
    setSections([]);
  }, []);

  const closeFlow = useCallback(() => {
    setClassifyTarget(null);
    setFlowPhase("idle");
    setSelectedClassification(null);
    setSelectedStages(null);
  }, []);

  const handleProjectChange = useCallback(async (projectId: number | null) => {
    setTaskDraft((d) => ({ ...d, projectId, boardId: null, sectionId: null }));
    setBoards([]);
    setSections([]);
    if (projectId) {
      const b = await getBoardsByProject(projectId).catch(() => [] as Board[]);
      setBoards(b);
    }
  }, []);

  const handleBoardChange = useCallback(async (boardId: number | null) => {
    setTaskDraft((d) => ({ ...d, boardId, sectionId: null }));
    setSections([]);
    if (boardId) {
      const s = await getSectionsByBoard(boardId).catch(() => [] as Section[]);
      setSections(s);
    }
  }, []);

  const handleSectionChange = useCallback((sectionId: number | null) => {
    setTaskDraft((d) => ({ ...d, sectionId }));
  }, []);

  const handleTaskCreate = useCallback(async () => {
    if (!classifyTarget || !taskDraft.title.trim() || !selectedClassification) return;
    const c = selectedClassification;
    const typeMap: Record<ClassificationType, Task["type"]> = {
      "short-term": "shortterm", "daily-trivial": "daily", "habits": "habit",
    };
    try {
      await createTask({
        title: taskDraft.title,
        type: typeMap[c],
        classification: (c === "habits" ? "habit" : c) as Task["classification"],
        status: "active",
        priority: taskDraft.priority,
        sectionId: taskDraft.sectionId ?? undefined,
        note: taskDraft.note || undefined,
        successCriteria: taskDraft.successCriteria || undefined,
        dueDate: taskDraft.dueDate ? new Date(taskDraft.dueDate).getTime() : undefined,
        startTime: taskDraft.startTime ? new Date(taskDraft.startTime).getTime() : undefined,
        endTime: taskDraft.endTime ? new Date(taskDraft.endTime).getTime() : undefined,
        frequency: (c === "habits" ? taskDraft.frequency : undefined),
      });
      await updateTask(classifyTarget.id!, { status: "done" });
      showToast({ message: `已创建为「${CLASSIFICATION_OPTIONS.find((o) => o.key === c)?.label}」`, type: "success" });
      closeFlow();
      await loadItems();
    } catch { showToast({ message: "创建失败，请重试", type: "error" }); }
  }, [classifyTarget, taskDraft, selectedClassification, loadItems, closeFlow]);

  const handleCreateModule = async () => {
    if (!classifyTarget || !taskDraft.title.trim() || !taskDraft.boardId) return;
    try {
      const stageIndex = selectedStages != null ? selectedStages : 0;
      const sectionId = await createSection(taskDraft.title, taskDraft.boardId);
      await updateSection(sectionId, {
        note: taskDraft.note || undefined,
        successCriteria: taskDraft.successCriteria || undefined,
        startTime: taskDraft.startTime ? new Date(taskDraft.startTime).getTime() : undefined,
        stageIndex,
      });
      await updateTask(classifyTarget.id!, { status: "done" });
      showToast({ message: "已创建为长期目标（子模块）", type: "success" });
      closeFlow();
      await loadItems();
    } catch { showToast({ message: "创建失败", type: "error" }); }
  };

  const handleAssignGoal = async (targetType: GoalViewType) => {
    const captureId = assignTargetId;
    if (!captureId) return;
    setAssignTargetId(null);
    try {
      const item = allActiveRef.current.find((t) => t.id === captureId);
      if (!item) return;
      const taskType = targetType === "habits" ? "habit" : (targetType === "long-term" ? "longterm" : targetType === "short-term" ? "shortterm" : "daily");
      await createTask({ title: item.title, type: taskType, status: "active", tags: item.tags, classification: (targetType === "habits" ? "habit" : targetType) as Task["classification"] });
      await updateTask(captureId, { status: "done" });
      showToast({ message: `已分配到「${GOAL_TYPES.find((g) => g.type === targetType)?.label}」`, type: "success" });
      await loadItems();
    } catch { showToast({ message: "分配失败，请重试", type: "error" }); }
  };

  const toggleBatchSelect = (id: number) => {
    setSelectedIds((prev) => { const next = new Set(prev); if (next.has(id)) next.delete(id); else next.add(id); return next; });
  };

  const enterBatchMode = () => { setBatchMode(true); };
  const exitBatchMode = () => { setBatchMode(false); setSelectedIds(new Set()); };

  const handleBatchDelete = async () => {
    if (selectedIds.size === 0) return;
    const ids = [...selectedIds];
    try {
      for (const id of ids) await deleteTask(id);
      showToast({ message: `已批量删除 ${ids.length} 条`, type: "info", undoAction: async () => { for (const id of ids) await restoreTask(id); await loadItems(); } });
      exitBatchMode();
      await loadItems();
    } catch { showToast({ message: "批量删除失败", type: "error" }); }
  };

  const longPressTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const handleLongPressStart = useCallback((id: number) => {
    if (batchMode) return;
    longPressTimerRef.current = setTimeout(() => { enterBatchMode(); setSelectedIds(new Set([id])); }, 500);
  }, [batchMode]);

  const handleLongPressEnd = useCallback(() => {
    if (longPressTimerRef.current) { clearTimeout(longPressTimerRef.current); longPressTimerRef.current = null; }
  }, []);

  useEffect(() => { return () => { if (longPressTimerRef.current) clearTimeout(longPressTimerRef.current); }; }, []);

  const isChooseTypeOpen = flowPhase === "chooseType" && classifyTarget !== null;
  const isModuleFormOpen = flowPhase === "moduleForm" && classifyTarget !== null;
  const isTaskClassifyOpen = flowPhase === "taskClassify" && classifyTarget !== null;
  const isTaskFormOpen = flowPhase === "taskForm" && classifyTarget !== null;

  return (
    <div className="flex flex-col h-full max-w-2xl mx-auto px-4 pt-6 pb-24">
      <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100 mb-5">快速捕捉</h1>

      <motion.div className="mb-6" layout transition={{ type: "spring", stiffness: 500, damping: 35 }}>
        <motion.div
          className="relative"
          animate={isSubmitting ? { scaleY: 0.35, opacity: 0.2 } : { scaleY: 1, opacity: 1 }}
          transition={{ type: "spring", stiffness: 400, damping: 30 }}
          style={{ originY: 0 }}
        >
          <textarea
            ref={textareaRef}
            value={content}
            onChange={(e) => setContent(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="脑子里闪过的，先扔进来"
            rows={4}
            className="w-full p-4 pb-8 rounded-2xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 resize-none focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent placeholder-gray-400 dark:placeholder-gray-500 transition-shadow text-base leading-relaxed"
            autoFocus
          />
          <span className="absolute bottom-3 right-3 text-xs text-gray-400 dark:text-gray-500 tabular-nums select-none">{charCount}</span>
        </motion.div>

        <div className="mt-3">
          <AnimatePresence>
            {tags.length > 0 && (
              <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} exit={{ opacity: 0, height: 0 }} className="flex flex-wrap gap-2 mb-2">
                {tags.map((tag) => (
                  <motion.span key={tag} initial={{ opacity: 0, scale: 0.7 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.7 }} className="inline-flex items-center gap-1 px-2.5 py-1 bg-indigo-50 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400 rounded-lg text-xs font-medium">
                    #{tag}
                    <button onClick={() => removeTag(tag)} className="hover:text-indigo-800 dark:hover:text-indigo-200 transition-colors"><X className="w-3 h-3" /></button>
                  </motion.span>
                ))}
              </motion.div>
            )}
          </AnimatePresence>
          <input type="text" value={tagInput} onChange={(e) => setTagInput(e.target.value)} onKeyDown={handleTagInputKeyDown} placeholder="添加标签（逗号或回车分隔）" className="w-full px-3 py-2 text-sm rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-indigo-500/50 focus:border-transparent placeholder-gray-400 dark:placeholder-gray-500" />
        </div>

        <motion.button onClick={handleSubmit} disabled={!content.trim() || isSubmitting} whileTap={{ scale: 0.97 }} className="mt-4 w-full py-3 bg-gradient-to-r from-indigo-500 to-violet-600 text-white rounded-2xl font-medium flex items-center justify-center gap-2 hover:from-indigo-600 hover:to-violet-700 disabled:opacity-40 disabled:cursor-not-allowed transition-all shadow-lg shadow-indigo-500/25">
          <Send className="w-4 h-4" />捕捉
        </motion.button>
      </motion.div>

      <AnimatePresence>
        {batchMode && (
          <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }} className="mb-3 px-4 py-2 bg-indigo-50 dark:bg-indigo-900/30 rounded-xl flex items-center justify-between">
            <span className="text-sm font-medium text-indigo-700 dark:text-indigo-300">已选 {selectedIds.size} 项</span>
            <div className="flex items-center gap-2">
              <button onClick={handleBatchDelete} disabled={selectedIds.size === 0} className="flex items-center gap-1 text-xs font-medium text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-900/20 px-3 py-1.5 rounded-lg hover:bg-red-100 dark:hover:bg-red-900/40 transition-colors disabled:opacity-40"><Trash2 className="w-3.5 h-3.5" />删除</button>
              <button onClick={exitBatchMode} className="flex items-center gap-1 text-xs font-medium text-gray-600 dark:text-gray-400 bg-gray-100 dark:bg-gray-800 px-3 py-1.5 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors"><XCircle className="w-3.5 h-3.5" />取消</button>
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
                    <div className="flex items-center gap-3 mb-2">
                      <div className={`w-5 h-5 rounded-md border-2 flex items-center justify-center transition-colors ${selectedIds.has(item.id!) ? "bg-indigo-600 border-indigo-600" : "border-gray-300 dark:border-gray-600"}`}>
                        {selectedIds.has(item.id!) && <CheckSquare className="w-3.5 h-3.5 text-white" />}
                      </div>
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
                        onClick={(e) => { e.stopPropagation(); handleNextStep(item); }}
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

      {/* Assign Goal Sheet */}
      <AnimatePresence>
        {assignTargetId !== null && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-50 bg-black/40 backdrop-blur-sm flex items-end justify-center" onClick={() => setAssignTargetId(null)}>
            <motion.div initial={{ y: "100%" }} animate={{ y: 0 }} exit={{ y: "100%" }} transition={{ type: "spring", stiffness: 400, damping: 40 }} onClick={(e) => e.stopPropagation()} className="w-full max-w-lg bg-white dark:bg-gray-900 rounded-t-2xl p-6">
              <div className="w-10 h-1 bg-gray-300 dark:bg-gray-700 rounded-full mx-auto mb-4" />
              <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-1">分配目标</h3>
              <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">选择要将这条想法分配到的目标类型</p>
              <div className="space-y-2">
                {GOAL_TYPES.map(({ type, label, desc, icon: Icon, color }) => (
                  <button key={type} onClick={() => handleAssignGoal(type)} className="w-full flex items-center gap-4 p-3 rounded-xl hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors text-left">
                    <div className={`w-10 h-10 rounded-xl bg-gray-100 dark:bg-gray-800 flex items-center justify-center ${color}`}><Icon className="w-5 h-5" /></div>
                    <div><p className="text-sm font-medium text-gray-900 dark:text-gray-100">{label}</p><p className="text-xs text-gray-500 dark:text-gray-400">{desc}</p></div>
                  </button>
                ))}
              </div>
              <button onClick={() => setAssignTargetId(null)} className="mt-4 w-full py-3 rounded-xl border border-gray-200 dark:border-gray-700 text-sm text-gray-500 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors">取消</button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Step 1 Sheet: Choose Type */}
      <AnimatePresence>
        {isChooseTypeOpen && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-50 bg-black/40 backdrop-blur-sm flex items-end justify-center" onClick={closeFlow}>
            <motion.div initial={{ y: "100%" }} animate={{ y: 0 }} exit={{ y: "100%" }} transition={{ type: "spring", stiffness: 400, damping: 40 }} onClick={(e) => e.stopPropagation()} className="w-full max-w-lg bg-white dark:bg-gray-900 rounded-t-2xl">
              <div className="w-10 h-1 bg-gray-300 dark:bg-gray-700 rounded-full mx-auto mt-3 mb-1" />
              <div className="px-6 pt-4 pb-6">
                <h3 className="text-base font-semibold text-gray-900 dark:text-gray-100 mb-1">选择创建类型</h3>
                <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">{`"${classifyTarget!.title.slice(0, 40)}" 要创建为？`}</p>
                <div className="space-y-1">
                  <button
                    onClick={async () => { setFlowPhase("moduleForm"); const [p] = await Promise.all([getAllProjectsV2().catch(() => [] as ProjectV2[])]); setProjects(p); setBoards([]); setSections([]); }}
                    className="w-full flex items-center gap-3 px-4 py-3.5 rounded-xl hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors text-left active:scale-[0.98]"
                  >
                    <div className="w-10 h-10 rounded-xl bg-indigo-50 dark:bg-indigo-900/20 flex items-center justify-center">
                      <Mountain className="w-5 h-5 text-indigo-500" />
                    </div>
                    <span className="flex-1 text-sm font-medium text-gray-900 dark:text-gray-100">子模块（长期目标）</span>
                    <ChevronRight className="w-5 h-5 text-gray-400" />
                  </button>
                  <button
                    onClick={() => { setFlowPhase("taskClassify"); }}
                    className="w-full flex items-center gap-3 px-4 py-3.5 rounded-xl hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors text-left active:scale-[0.98]"
                  >
                    <div className="w-10 h-10 rounded-xl bg-blue-50 dark:bg-blue-900/20 flex items-center justify-center">
                      <CheckSquare className="w-5 h-5 text-blue-500" />
                    </div>
                    <span className="flex-1 text-sm font-medium text-gray-900 dark:text-gray-100">任务</span>
                    <ChevronRight className="w-5 h-5 text-gray-400" />
                  </button>
                </div>
                <button onClick={closeFlow} className="mt-3 w-full py-3 rounded-xl border border-gray-200 dark:border-gray-700 text-sm text-gray-500 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors">取消</button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Module Form: Long-term Goal */}
      <AnimatePresence>
        {isModuleFormOpen && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-50 bg-black/40 backdrop-blur-sm flex items-end justify-center" onClick={closeFlow}>
            <motion.div initial={{ y: "100%" }} animate={{ y: 0 }} exit={{ y: "100%" }} transition={{ type: "spring", stiffness: 400, damping: 40 }} onClick={(e) => e.stopPropagation()} className="w-full max-w-lg bg-white dark:bg-gray-900 rounded-t-2xl">
              <div className="w-10 h-1 bg-gray-300 dark:bg-gray-700 rounded-full mx-auto mt-3 mb-1" />
              <div className="px-6 pt-4 pb-6 space-y-4 max-h-[70vh] overflow-y-auto">

                <h3 className="text-base font-semibold text-gray-900 dark:text-gray-100">创建长期目标</h3>

                <div>
                  <label className="text-xs font-medium text-gray-500 dark:text-gray-400 mb-1 block">标题</label>
                  <input
                    type="text" value={taskDraft.title}
                    onChange={(e) => setTaskDraft((d) => ({ ...d, title: e.target.value }))}
                    placeholder="输入目标名称"
                    className="w-full px-4 py-2.5 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-sm text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500 placeholder-gray-400"
                    maxLength={200}
                  />
                </div>

                <div>
                  <label className="text-xs font-medium text-gray-500 dark:text-gray-400 mb-1 block">成功标准</label>
                  <textarea value={taskDraft.successCriteria} onChange={(e) => setTaskDraft((d) => ({ ...d, successCriteria: e.target.value }))} placeholder="如何判断这个目标已完成？" rows={2} className="w-full px-4 py-3 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-sm text-gray-900 dark:text-gray-100 resize-none focus:outline-none focus:ring-2 focus:ring-blue-500 placeholder-gray-400" maxLength={500} />
                </div>

                <div>
                  <label className="text-xs font-medium text-gray-500 dark:text-gray-400 mb-1 block">开始时间</label>
                  <input type="datetime-local" value={taskDraft.startTime} onChange={(e) => setTaskDraft((d) => ({ ...d, startTime: e.target.value }))} className="w-full px-4 py-2.5 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-sm text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500" />
                </div>

                <div>
                  <label className="text-xs font-medium text-gray-500 dark:text-gray-400 mb-1 block">所属模块 <span className="text-red-400">*</span></label>
                  <div className="space-y-2">
                    <select value={taskDraft.projectId ?? ""} onChange={(e) => handleProjectChange(e.target.value ? parseInt(e.target.value) : null)} className="w-full px-4 py-2.5 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-sm text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500">
                      <option value="">选择项目</option>
                      {projects.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
                    </select>
                    {boards.length > 0 && (
                      <select value={taskDraft.boardId ?? ""} onChange={(e) => handleBoardChange(e.target.value ? parseInt(e.target.value) : null)} className="w-full px-4 py-2.5 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-sm text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500">
                        <option value="">选择大模块</option>
                        {boards.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
                      </select>
                    )}
                    {boards.length > 0 && (
                      <select value={selectedStages ?? ""} onChange={(e) => setSelectedStages(e.target.value ? parseInt(e.target.value) : null)} className="w-full px-4 py-2.5 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-sm text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500">
                        <option value="">选择阶段</option>
                        {boards.find(b => b.id === taskDraft.boardId)?.stages?.map((stage, idx) => (
                          <option key={idx} value={idx}>{stage.name}</option>
                        ))}
                      </select>
                    )}
                  </div>
                </div>

                <div>
                  <label className="text-xs font-medium text-gray-500 dark:text-gray-400 mb-1 block">备注</label>
                  <textarea value={taskDraft.note} rows={2} onChange={(e) => setTaskDraft((d) => ({ ...d, note: e.target.value }))} placeholder="添加备注信息..." className="w-full px-4 py-3 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-sm text-gray-900 dark:text-gray-100 resize-none focus:outline-none focus:ring-2 focus:ring-blue-500 placeholder-gray-400" maxLength={1000} />
                </div>

                <div className="flex gap-3 pt-2">
                  <button onClick={closeFlow} className="flex-1 py-3 rounded-xl border border-gray-200 dark:border-gray-700 text-sm font-medium text-gray-500 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors">取消</button>
                  <button onClick={handleCreateModule} disabled={!taskDraft.title.trim() || !taskDraft.boardId} className="flex-1 py-3 rounded-xl bg-indigo-600 text-white text-sm font-medium hover:bg-indigo-700 transition-colors disabled:opacity-40">创建长期目标</button>
                </div>

              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Step 2 Sheet: Task Classification */}
      <AnimatePresence>
        {isTaskClassifyOpen && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-50 bg-black/40 backdrop-blur-sm flex items-end justify-center" onClick={closeFlow}>
            <motion.div initial={{ y: "100%" }} animate={{ y: 0 }} exit={{ y: "100%" }} transition={{ type: "spring", stiffness: 400, damping: 40 }} onClick={(e) => e.stopPropagation()} className="w-full max-w-lg bg-white dark:bg-gray-900 rounded-t-2xl">
              <div className="w-10 h-1 bg-gray-300 dark:bg-gray-700 rounded-full mx-auto mt-3 mb-1" />
              <div className="px-6 pt-4 pb-6">
                <h3 className="text-base font-semibold text-gray-900 dark:text-gray-100 mb-1">选择任务类型</h3>
                <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">{`"${classifyTarget!.title.slice(0, 40)}" 应该归属为？`}</p>
                <div className="space-y-1">
                  {CLASSIFICATION_OPTIONS.map((opt) => (
                    <button
                      key={opt.key}
                      onClick={() => handleClassifySelect(opt.key)}
                      className="w-full flex items-center gap-3 px-4 py-3.5 rounded-xl hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors text-left active:scale-[0.98]"
                    >
                      <div className={`w-10 h-10 rounded-xl ${opt.bgColor} dark:bg-opacity-20 flex items-center justify-center`}>
                        <opt.icon className={`w-5 h-5 ${opt.color}`} />
                      </div>
                      <span className="flex-1 text-sm font-medium text-gray-900 dark:text-gray-100">{opt.label}</span>
                      <ChevronRight className="w-5 h-5 text-gray-400" />
                    </button>
                  ))}
                </div>
                <button onClick={closeFlow} className="mt-3 w-full py-3 rounded-xl border border-gray-200 dark:border-gray-700 text-sm text-gray-500 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors">取消</button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Task Create Sheet */}
      <AnimatePresence>
        {isTaskFormOpen && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-50 bg-black/40 backdrop-blur-sm flex items-end justify-center" onClick={closeFlow}>
            <motion.div initial={{ y: "100%" }} animate={{ y: 0 }} exit={{ y: "100%" }} transition={{ type: "spring", stiffness: 400, damping: 40 }} onClick={(e) => e.stopPropagation()} className="w-full max-w-lg bg-white dark:bg-gray-900 rounded-t-2xl">
              <div className="w-10 h-1 bg-gray-300 dark:bg-gray-700 rounded-full mx-auto mt-3 mb-1" />
              <div className="px-6 pt-4 pb-6 space-y-4 max-h-[70vh] overflow-y-auto">

                <h3 className="text-base font-semibold text-gray-900 dark:text-gray-100">
                  {selectedClassification === "short-term" && "创建短期事件"}
                  {selectedClassification === "daily-trivial" && "创建日常琐事"}
                  {selectedClassification === "habits" && "创建习惯"}
                </h3>

                <div>
                  <label className="text-xs font-medium text-gray-500 dark:text-gray-400 mb-1 block">标题</label>
                  <input
                    type="text" value={taskDraft.title}
                    onChange={(e) => setTaskDraft((d) => ({ ...d, title: e.target.value }))}
                    placeholder="输入标题"
                    className="w-full px-4 py-2.5 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-sm text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500 placeholder-gray-400"
                    maxLength={200}
                  />
                </div>

                <div>
                  <label className="text-xs font-medium text-gray-500 dark:text-gray-400 mb-1 block">优先级</label>
                  <div className="grid grid-cols-2 gap-2">
                    {PRIORITY_CONFIG.map((opt) => (
                      <button
                        key={opt.key}
                        onClick={() => setTaskDraft((d) => ({ ...d, priority: opt.key }))}
                        className={`py-2.5 rounded-xl text-xs font-medium border transition-all ${
                          taskDraft.priority === opt.key
                            ? `${opt.bg} ${opt.color} border-2 border-current`
                            : "border-gray-200 dark:border-gray-700 text-gray-500 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-800"
                        }`}
                      >
                        <span className="inline-block w-2 h-2 rounded-full mr-1.5" style={{ backgroundColor: opt.hex }} />
                        {opt.label}
                      </button>
                    ))}
                  </div>
                </div>

                {selectedClassification === "short-term" && (
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="text-xs font-medium text-gray-500 dark:text-gray-400 mb-1 block">开始时间 <span className="text-red-400">*</span></label>
                      <input type="datetime-local" value={taskDraft.startTime} onChange={(e) => setTaskDraft((d) => ({ ...d, startTime: e.target.value }))} className="w-full px-3 py-2.5 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-sm text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500" />
                    </div>
                    <div>
                      <label className="text-xs font-medium text-gray-500 dark:text-gray-400 mb-1 block">结束时间 <span className="text-red-400">*</span></label>
                      <input type="datetime-local" value={taskDraft.endTime} onChange={(e) => setTaskDraft((d) => ({ ...d, endTime: e.target.value }))} className="w-full px-3 py-2.5 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-sm text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500" />
                    </div>
                  </div>
                )}

                {selectedClassification === "habits" && (
                  <>
                    <div>
                      <label className="text-xs font-medium text-gray-500 dark:text-gray-400 mb-1 block">频率</label>
                      <div className="flex gap-2">
                        {(["daily", "weekly", "monthly"] as const).map((f) => (
                          <button key={f} onClick={() => setTaskDraft((d) => ({ ...d, frequency: f }))} className={`flex-1 py-2 rounded-xl text-sm font-medium border transition-all ${taskDraft.frequency === f ? "bg-orange-100 text-orange-600 border-orange-300" : "border-gray-200 dark:border-gray-700 text-gray-500 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-800"}`}>
                            {f === "daily" ? "每天" : f === "weekly" ? "每周" : "每月"}
                          </button>
                        ))}
                      </div>
                    </div>
                    <div>
                      <label className="text-xs font-medium text-gray-500 dark:text-gray-400 mb-1 block">目标次数</label>
                      <input type="number" value={taskDraft.targetCount} onChange={(e) => setTaskDraft((d) => ({ ...d, targetCount: e.target.value }))} placeholder={`每${taskDraft.frequency === "daily" ? "天" : taskDraft.frequency === "weekly" ? "周" : "月"}完成次数`} className="w-full px-4 py-2.5 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-sm text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500" />
                    </div>
                  </>
                )}

                {selectedClassification !== "daily-trivial" && (
                  <div>
                    <label className="text-xs font-medium text-gray-500 dark:text-gray-400 mb-1 block">截止日期</label>
                    <input type="date" value={taskDraft.dueDate} onChange={(e) => setTaskDraft((d) => ({ ...d, dueDate: e.target.value }))} className="w-full px-4 py-2.5 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-sm text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500" />
                  </div>
                )}

                <div>
                  <label className="text-xs font-medium text-gray-500 dark:text-gray-400 mb-1 block">所属模块</label>
                  <div className="space-y-2">
                    <select value={taskDraft.projectId ?? ""} onChange={(e) => handleProjectChange(e.target.value ? parseInt(e.target.value) : null)} className="w-full px-4 py-2.5 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-sm text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500">
                      <option value="">选择项目</option>
                      {projects.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
                    </select>
                    {boards.length > 0 && (
                      <select value={taskDraft.boardId ?? ""} onChange={(e) => handleBoardChange(e.target.value ? parseInt(e.target.value) : null)} className="w-full px-4 py-2.5 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-sm text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500">
                        <option value="">选择大模块</option>
                        {boards.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
                      </select>
                    )}
                    {sections.length > 0 && (
                      <select value={taskDraft.sectionId ?? ""} onChange={(e) => handleSectionChange(e.target.value ? parseInt(e.target.value) : null)} className="w-full px-4 py-2.5 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-sm text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500">
                        <option value="">选择子模块</option>
                        {sections.map((s) => {
                          const board = boards.find(b => b.id === s.boardId);
                          const project = projects.find(p => p.id === board?.projectId);
                          const path = [project?.name, board?.name, s.name].filter(Boolean).join(" > ");
                          return <option key={s.id} value={s.id}>{path}</option>;
                        })}
                      </select>
                    )}
                  </div>
                </div>

                <div>
                  <label className="text-xs font-medium text-gray-500 dark:text-gray-400 mb-1 block">备注</label>
                  <textarea value={taskDraft.note} rows={2} onChange={(e) => setTaskDraft((d) => ({ ...d, note: e.target.value }))} placeholder="添加备注信息..." className="w-full px-4 py-3 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-sm text-gray-900 dark:text-gray-100 resize-none focus:outline-none focus:ring-2 focus:ring-blue-500 placeholder-gray-400" maxLength={1000} />
                </div>

                <div className="flex gap-3 pt-2">
                  <button onClick={closeFlow} className="flex-1 py-3 rounded-xl border border-gray-200 dark:border-gray-700 text-sm font-medium text-gray-500 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors">取消</button>
                  <button onClick={handleTaskCreate} disabled={!taskDraft.title.trim()} className="flex-1 py-3 rounded-xl bg-blue-600 text-white text-sm font-medium hover:bg-blue-700 transition-colors disabled:opacity-40">创建任务</button>
                </div>

              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
