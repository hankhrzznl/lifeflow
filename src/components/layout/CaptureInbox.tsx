"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import {
  Inbox, Trash2, X, Mountain,
  CalendarDays, ClipboardList, CheckSquare, XCircle,
  ChevronRight, Zap, Sun, Sunrise, CalendarRange,
} from "lucide-react";
import { createTask, deleteTask, restoreTask, updateTask, createSection, updateSection, getTasksByType, getAllProjectsV2, getBoardsByProject, getSectionsByBoard, captureToTask } from "@/lib/db";
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
] as const;

type ClassificationType = (typeof CLASSIFICATION_OPTIONS)[number]["key"];

const GOAL_TYPES: { type: GoalViewType; label: string; desc: string; icon: typeof Mountain; color: string }[] = [
  { type: "long-term", label: "长期目标", desc: "成为一个更大目标的里程碑", icon: Mountain, color: "text-indigo-600" },
  { type: "short-term", label: "短期事件", desc: "作为独立事件执行", icon: CalendarDays, color: "text-blue-600" },
  { type: "daily-trivial", label: "日常琐事", desc: "转为每天重复的待办", icon: ClipboardList, color: "text-green-600" },
];

// ==================== 主组件 ====================

export default function CaptureInbox({ visible, onRefresh }: { visible: boolean; onRefresh?: () => void }) {
  const router = useRouter();
  const [items, setItems] = useState<Task[]>([]);
  const allActiveRef = useRef<Task[]>([]);
  const [hasMore, setHasMore] = useState(false);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [loaded, setLoaded] = useState(false);

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
  }>({ title: "", priority: "not-urgent-important", projectId: null, boardId: null, sectionId: null, note: "", dueDate: "", successCriteria: "" });

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
    setLoaded(true);
  }, []);

  const loadMore = useCallback(async () => {
    if (isLoadingMore || !hasMore || items.length === 0) return;
    setIsLoadingMore(true);
    const nextSlice = allActiveRef.current.slice(items.length, items.length + 20);
    setItems((prev) => [...prev, ...nextSlice]);
    setHasMore(items.length + nextSlice.length < allActiveRef.current.length);
    setIsLoadingMore(false);
  }, [isLoadingMore, hasMore, items]);

  // 展开时加载，外界刷新时重载
  useEffect(() => {
    if (visible) { loadItems(); onRefresh?.(); }
  }, [visible, loadItems, onRefresh]);

  const handleDelete = async (id: number) => {
    try {
      await deleteTask(id);
      showToast({ message: "已移入回收站", type: "info", undoAction: async () => { await restoreTask(id); await loadItems(); } });
      await loadItems();
    } catch { /* ignore */ }
  };

  // 快速操作：今日
  const handleQuickToday = useCallback(async (id: number) => {
    try {
      const today = new Date();
      const start = new Date(today.getFullYear(), today.getMonth(), today.getDate()).getTime();
      const end = start + 24 * 60 * 60 * 1000;
      await captureToTask(id, { startTime: start, endTime: end });
      showToast({ message: "已添加到今日", type: "success" });
      await loadItems();
    } catch { showToast({ message: "操作失败", type: "error" }); }
  }, [loadItems]);

  // 快速操作：明天
  const handleQuickTomorrow = useCallback(async (id: number) => {
    try {
      const tomorrow = new Date();
      tomorrow.setDate(tomorrow.getDate() + 1);
      const start = new Date(tomorrow.getFullYear(), tomorrow.getMonth(), tomorrow.getDate()).getTime();
      const end = start + 24 * 60 * 60 * 1000;
      await captureToTask(id, { startTime: start, endTime: end });
      showToast({ message: "已添加到明天", type: "success" });
      await loadItems();
    } catch { showToast({ message: "操作失败", type: "error" }); }
  }, [loadItems]);

  // 快速操作：本周
  const handleQuickWeek = useCallback(async (id: number) => {
    try {
      const now = new Date();
      const dayOfWeek = now.getDay();
      const daysUntilEndOfWeek = dayOfWeek === 0 ? 0 : 7 - dayOfWeek;
      const endOfWeek = new Date(now);
      endOfWeek.setDate(now.getDate() + daysUntilEndOfWeek);
      endOfWeek.setHours(23, 59, 59, 999);
      const start = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
      await captureToTask(id, { startTime: start, endTime: endOfWeek.getTime() });
      showToast({ message: "已添加到本周", type: "success" });
      await loadItems();
    } catch { showToast({ message: "操作失败", type: "error" }); }
  }, [loadItems]);

  // 快速操作：完整安排（跳转到安排页处理中状态）
  const handleFullSchedule = useCallback((id: number, title: string) => {
    router.push(`/planner?tab=pending&captureId=${id}&captureTitle=${encodeURIComponent(title)}`);
  }, [router]);

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
    });
  }, []);

  const handleClassifySelect = useCallback(async (classification: ClassificationType) => {
    setSelectedClassification(classification);
    setFlowPhase("taskForm");
    const fetchedProjects = await getAllProjectsV2().catch(() => [] as ProjectV2[]);
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
      "short-term": "shortterm", "daily-trivial": "daily",
    };
    try {
      await createTask({
        title: taskDraft.title,
        type: typeMap[c],
        classification: c as Task["classification"],
        status: "active",
        priority: taskDraft.priority,
        sectionId: taskDraft.sectionId ?? undefined,
        note: taskDraft.note || undefined,
        successCriteria: taskDraft.successCriteria || undefined,
        dueDate: taskDraft.dueDate ? new Date(taskDraft.dueDate).getTime() : undefined,
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
      const taskType = targetType === "long-term" ? "longterm" : targetType === "short-term" ? "shortterm" : "daily";
      await createTask({ title: item.title, type: taskType, status: "active", tags: item.tags, classification: targetType as Task["classification"] });
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

  if (!visible) return null;

  return (
    <>
      <motion.div
        initial={{ opacity: 0, height: 0 }}
        animate={{ opacity: 1, height: "auto" }}
        exit={{ opacity: 0, height: 0 }}
        transition={{ duration: 0.25 }}
        className="mt-3 overflow-hidden"
      >
        <div className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-200 dark:border-gray-700 shadow-sm p-4">
          <div className="flex items-center gap-2 mb-3">
            <Zap className="w-4 h-4 text-violet-500" strokeWidth={2} />
            <span className="text-sm font-semibold text-gray-700 dark:text-gray-300">收件箱</span>
            <span className="text-xs text-gray-400 ml-auto">{items.length} 项</span>
          </div>

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

          <div className="max-h-[360px] overflow-y-auto scrollbar-hide -mx-1 px-1">
            <AnimatePresence mode="popLayout">
              {!loaded ? (
                <div className="flex justify-center py-8">
                  <div className="w-6 h-6 border-2 border-violet-400 border-t-transparent rounded-full animate-spin" />
                </div>
              ) : items.length === 0 ? (
                <motion.div key="empty" initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex flex-col items-center justify-center py-10 text-center">
                  <div className="w-14 h-14 rounded-2xl bg-gray-100 dark:bg-gray-800 flex items-center justify-center mb-3">
                    <Inbox className="w-7 h-7 text-gray-400 dark:text-gray-500" />
                  </div>
                  <p className="text-sm text-gray-500 dark:text-gray-400">还没有任何想法</p>
                  <p className="text-xs text-gray-400 mt-1">用上方捕捉栏快速记录</p>
                </motion.div>
              ) : (
                items.map((item) => (
                  <motion.div key={item.id} layout initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, x: -20 }} transition={{ type: "spring", stiffness: 500, damping: 35 }} className="mb-2">
                    <div
                      className="bg-gray-50 dark:bg-gray-800 border border-gray-100 dark:border-gray-700 rounded-xl p-3 relative cursor-pointer transition-colors hover:bg-gray-100 dark:hover:bg-gray-750"
                      onMouseDown={() => handleLongPressStart(item.id!)}
                      onMouseUp={handleLongPressEnd}
                      onMouseLeave={handleLongPressEnd}
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
                      <div className="flex items-center justify-between mt-2">
                        <div className="flex items-center gap-2">
                          {(item.tags ?? []).slice(0, 3).map((tag) => (
                            <span key={tag} className="text-xs text-indigo-500 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-900/20 px-2 py-0.5 rounded-md">#{tag}</span>
                          ))}
                          <span className="text-xs text-gray-400 dark:text-gray-500">{relativeTime(item.createdAt)}</span>
                        </div>
                        <div className="flex items-center gap-1.5">
                          <button
                            onClick={(e) => { e.stopPropagation(); handleQuickToday(item.id!); }}
                            className="text-xs text-amber-600 dark:text-amber-400 font-medium hover:text-amber-700 active:scale-[0.97] transition-transform min-w-[36px] min-h-[28px] flex items-center justify-center bg-amber-50 dark:bg-amber-900/20 rounded-lg px-2"
                            title="今日"
                          >
                            <Sun className="w-3 h-3" />
                          </button>
                          <button
                            onClick={(e) => { e.stopPropagation(); handleQuickTomorrow(item.id!); }}
                            className="text-xs text-blue-600 dark:text-blue-400 font-medium hover:text-blue-700 active:scale-[0.97] transition-transform min-w-[36px] min-h-[28px] flex items-center justify-center bg-blue-50 dark:bg-blue-900/20 rounded-lg px-2"
                            title="明天"
                          >
                            <Sunrise className="w-3 h-3" />
                          </button>
                          <button
                            onClick={(e) => { e.stopPropagation(); handleQuickWeek(item.id!); }}
                            className="text-xs text-purple-600 dark:text-purple-400 font-medium hover:text-purple-700 active:scale-[0.97] transition-transform min-w-[36px] min-h-[28px] flex items-center justify-center bg-purple-50 dark:bg-purple-900/20 rounded-lg px-2"
                            title="本周"
                          >
                            <CalendarRange className="w-3 h-3" />
                          </button>
                          <button
                            onClick={(e) => { e.stopPropagation(); handleFullSchedule(item.id!, item.title); }}
                            className="text-xs text-violet-600 dark:text-violet-400 font-medium hover:text-violet-700 active:scale-[0.97] transition-transform min-w-[36px] min-h-[28px] flex items-center justify-center bg-violet-50 dark:bg-violet-900/20 rounded-lg px-2"
                            title="完整安排"
                          >
                            <ChevronRight className="w-3.5 h-3.5" />
                          </button>
                          <button
                            onClick={(e) => { e.stopPropagation(); handleDelete(item.id!); }}
                            className="text-xs text-red-400 font-medium hover:text-red-500 active:scale-[0.97] transition-transform min-w-[36px] min-h-[28px] flex items-center justify-center bg-red-50 dark:bg-red-900/20 rounded-lg px-2"
                            title="删除"
                          >
                            <Trash2 className="w-3 h-3" />
                          </button>
                        </div>
                      </div>
                    </div>
                  </motion.div>
                ))
              )}
              {hasMore && (
                <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex justify-center py-3">
                  <button onClick={loadMore} disabled={isLoadingMore} className="text-sm text-violet-500 hover:text-violet-600 dark:text-violet-400 font-medium transition-colors disabled:opacity-50">{isLoadingMore ? "加载中..." : "加载更多"}</button>
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          {/* 跳转规划页 */}
          {items.length > 0 && (
            <div className="mt-3 pt-3 border-t border-gray-100 dark:border-gray-700">
              <button
                onClick={() => router.push("/planner?tab=pending")}
                className="w-full flex items-center justify-center gap-2 py-2 text-xs font-medium text-violet-600 dark:text-violet-400 hover:bg-violet-50 dark:hover:bg-violet-900/20 rounded-lg transition-colors"
              >
                在规划页中分类安排 <ChevronRight className="w-3.5 h-3.5" />
              </button>
            </div>
          )}
        </div>
      </motion.div>

      {/* Sheets — same as capture page */}
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
                  <input type="text" value={taskDraft.title} onChange={(e) => setTaskDraft((d) => ({ ...d, title: e.target.value }))} placeholder="输入目标名称" className="w-full px-4 py-2.5 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-sm text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500 placeholder-gray-400" maxLength={200} />
                </div>
                <div>
                  <label className="text-xs font-medium text-gray-500 dark:text-gray-400 mb-1 block">成功标准</label>
                  <textarea value={taskDraft.successCriteria} onChange={(e) => setTaskDraft((d) => ({ ...d, successCriteria: e.target.value }))} placeholder="如何判断这个目标已完成？" rows={2} className="w-full px-4 py-3 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-sm text-gray-900 dark:text-gray-100 resize-none focus:outline-none focus:ring-2 focus:ring-blue-500 placeholder-gray-400" maxLength={500} />
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
                    <button key={opt.key} onClick={() => handleClassifySelect(opt.key)} className="w-full flex items-center gap-3 px-4 py-3.5 rounded-xl hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors text-left active:scale-[0.98]">
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
                </h3>
                <div>
                  <label className="text-xs font-medium text-gray-500 dark:text-gray-400 mb-1 block">标题</label>
                  <input type="text" value={taskDraft.title} onChange={(e) => setTaskDraft((d) => ({ ...d, title: e.target.value }))} placeholder="输入标题" className="w-full px-4 py-2.5 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-sm text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500 placeholder-gray-400" maxLength={200} />
                </div>
                <div>
                  <label className="text-xs font-medium text-gray-500 dark:text-gray-400 mb-1 block">优先级</label>
                  <div className="grid grid-cols-2 gap-2">
                    {PRIORITY_CONFIG.map((opt) => (
                      <button key={opt.key} onClick={() => setTaskDraft((d) => ({ ...d, priority: opt.key }))} className={`py-2.5 rounded-xl text-xs font-medium border transition-all ${taskDraft.priority === opt.key ? `${opt.bg} ${opt.color} border-2 border-current` : "border-gray-200 dark:border-gray-700 text-gray-500 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-800"}`}>
                        <span className="inline-block w-2 h-2 rounded-full mr-1.5" style={{ backgroundColor: opt.hex }} />
                        {opt.label}
                      </button>
                    ))}
                  </div>
                </div>
                {(selectedClassification === "short-term" || selectedClassification === "daily-trivial") && (
                  <div className="grid grid-cols-2 gap-3" />
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
    </>
  );
}
