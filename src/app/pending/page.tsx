"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  ArrowLeft, Clock, ListTodo, ChevronRight,
  Calendar, Minus, Plus, Check, CheckCircle,
  Target, FolderKanban, Layers, GripVertical,
} from "lucide-react";
import Link from "next/link";
import {
  initBuiltInPlugins, getActiveSchedulableTasks, getTimeSegments,
  updateTask, getAllProjectsV2, getBoardsByProject, getSectionsByBoard,
} from "@/lib/db";
import { showToast } from "@/components/ui/Toast";
import TaskDetail from "@/components/ui/TaskDetail";
import { PRIORITY_CONFIG } from "@/lib/types";
import type { Task, TimeSegment, ProjectV2, Board, Section } from "@/lib/types";

type PendingTab = "pending" | "process" | "scheduled";

const TYPE_LABELS: Record<string, { label: string; color: string; bg: string }> = {
  shortterm: { label: "短期事件", color: "text-blue-600", bg: "bg-blue-100 dark:bg-blue-900/30" },
  daily: { label: "日常琐事", color: "text-green-600", bg: "bg-green-100 dark:bg-green-900/30" },
  habit: { label: "习惯", color: "text-orange-600", bg: "bg-orange-100 dark:bg-orange-900/30" },
  longterm: { label: "长期目标", color: "text-indigo-600", bg: "bg-indigo-100 dark:bg-indigo-900/30" },
};

const SEG_SIZE_OPTIONS = [
  { key: "small", label: "小", range: "1-2", min: 1, max: 2 },
  { key: "medium", label: "中", range: "3-5", min: 3, max: 5 },
  { key: "large", label: "大", range: "6+", min: 6, max: 6 },
] as const;

const TASK_TYPES: { key: Task["type"]; label: string }[] = [
  { key: "shortterm", label: "短期事件" },
  { key: "daily", label: "日常琐事" },
  { key: "habit", label: "习惯" },
  { key: "longterm", label: "长期目标" },
];

function formatDate(ts?: number): string {
  if (!ts) return "未设置";
  const d = new Date(ts);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function getCountdownDays(dueDate?: number): number | null {
  if (!dueDate) return null;
  return Math.ceil((dueDate - Date.now()) / (1000 * 60 * 60 * 24));
}

function getReminderTimeline(dueDate: number, reminderDays: number, requiredSegments: number) {
  const now = Date.now();
  const totalMs = dueDate - now;
  const reminderStart = dueDate - reminderDays * 24 * 60 * 60 * 1000;
  const nowDate = new Date(now);
  const stages: { label: string; date: Date; active: boolean; key: string }[] = [];
  stages.push({ label: "安静期", date: nowDate, active: true, key: "quiet" });
  if (reminderStart > now) {
    stages.push({ label: "规划启动 📋", date: new Date(reminderStart), active: false, key: "planning" });
    const midPoints: number[] = [];
    for (let i = 1; i < requiredSegments; i++) {
      midPoints.push(reminderStart + ((dueDate - reminderStart) * i) / requiredSegments);
    }
    for (let i = 0; i < midPoints.length; i++) {
      stages.push({ label: `第${i + 1}次催更 ⚠️`, date: new Date(midPoints[i]), active: false, key: `mid-${i}` });
    }
  }
  stages.push({ label: "最后通牒 🔴", date: new Date(dueDate - 24 * 60 * 60 * 1000), active: false, key: "final" });
  stages.push({ label: "截止日期", date: new Date(dueDate), active: false, key: "deadline" });
  return stages;
}

function isPending(task: Task, _segmentsCount: number): boolean {
  if (!task.requiredSegments) return true;
  return false;
}

export default function PendingPage() {
  const [loading, setLoading] = useState(true);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [segmentsMap, setSegmentsMap] = useState<Map<number, TimeSegment[]>>(new Map());
  const [tab, setTab] = useState<PendingTab>("pending");
  const [detailTaskId, setDetailTaskId] = useState<number | null>(null);
  const [expandedTaskId, setExpandedTaskId] = useState<number | null>(null);

  const [processStep, setProcessStep] = useState(1);
  const [draftType, setDraftType] = useState<Task["type"]>("shortterm");
  const [draftPriority, setDraftPriority] = useState<Task["priority"]>("not-urgent-important");
  const [draftDueDate, setDraftDueDate] = useState("");
  const [draftProjectId, setDraftProjectId] = useState<number | null>(null);
  const [draftBoardId, setDraftBoardId] = useState<number | null>(null);
  const [draftStageIdx, setDraftStageIdx] = useState<number | null>(null);
  const [draftSectionId, setDraftSectionId] = useState<number | null>(null);
  const [draftSegments, setDraftSegments] = useState(1);
  const [draftReminderDays, setDraftReminderDays] = useState(3);
  const [projects, setProjects] = useState<ProjectV2[]>([]);
  const [boards, setBoards] = useState<Board[]>([]);
  const [sections, setSections] = useState<Section[]>([]);

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      await initBuiltInPlugins();
      const all = await getActiveSchedulableTasks();
      setTasks(all);

      const segMap = new Map<number, TimeSegment[]>();
      await Promise.all(
        all.map(async (t) => {
          const segs = await getTimeSegments(t.id!);
          segMap.set(t.id!, segs);
        })
      );
      setSegmentsMap(segMap);
    } catch { /* ignore */ }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { loadData(); }, [loadData]);

  const pendingTasks = useMemo(() => tasks.filter((t) => isPending(t, segmentsMap.get(t.id!)?.length ?? 0)), [tasks, segmentsMap]);
  const scheduledTasks = useMemo(() => tasks.filter((t) => !isPending(t, segmentsMap.get(t.id!)?.length ?? 0)), [tasks, segmentsMap]);
  const currentTask = pendingTasks[0] ?? null;

  const loadProjects = useCallback(async () => {
    const p = await getAllProjectsV2().catch(() => [] as ProjectV2[]);
    setProjects(p);
  }, []);

  const loadBoards = useCallback(async (projectId: number) => {
    const b = await getBoardsByProject(projectId).catch(() => [] as Board[]);
    setBoards(b);
  }, []);

  const loadSections = useCallback(async (boardId: number) => {
    const s = await getSectionsByBoard(boardId).catch(() => [] as Section[]);
    setSections(s);
  }, []);

  const selectTask = useCallback((task: Task) => {
    setExpandedTaskId(task.id!);
    setDraftType(task.type);
    setDraftPriority(task.priority || "not-urgent-important");
    setDraftDueDate(task.dueDate ? new Date(task.dueDate).toISOString().slice(0, 16) : "");
    setDraftProjectId(task.sectionId ? null : null);
    setDraftBoardId(null);
    setDraftStageIdx(null);
    setDraftSectionId(task.sectionId ?? null);
    setDraftSegments(task.requiredSegments ?? 1);
    setDraftReminderDays(task.segmentReminderDays ?? 3);
    setProcessStep(1);
    setProjects([]);
    setBoards([]);
    setSections([]);
    if (!task.sectionId) loadProjects();
  }, [loadProjects]);

  const handleQuickType = async (task: Task, type: Task["type"]) => {
    try {
      await updateTask(task.id!, { type });
      showToast({ message: `已设为${TYPE_LABELS[type]?.label || type}`, type: "success" });
      await loadData();
    } catch {
      showToast({ message: "操作失败", type: "error" });
    }
  };

  const handleSaveStep1 = async () => {
    if (!currentTask) return;
    try {
      await updateTask(currentTask.id!, {
        type: draftType,
        priority: draftPriority,
        dueDate: draftDueDate ? new Date(draftDueDate).getTime() : undefined,
      });
      showToast({ message: "分类已保存", type: "success" });
      setProcessStep(2);
      await loadProjects();
    } catch {
      showToast({ message: "保存失败", type: "error" });
    }
  };

  const handleProjectChange = (projectId: number | null) => {
    setDraftProjectId(projectId);
    setDraftBoardId(null);
    setDraftStageIdx(null);
    setDraftSectionId(null);
    setBoards([]);
    setSections([]);
    if (projectId) loadBoards(projectId);
  };

  const handleBoardChange = (boardId: number | null) => {
    setDraftBoardId(boardId);
    setDraftStageIdx(null);
    setDraftSectionId(null);
    setSections([]);
    if (boardId) loadSections(boardId);
  };

  const handleSaveStep2 = async () => {
    if (!currentTask) return;
    try {
      await updateTask(currentTask.id!, { sectionId: draftSectionId ?? undefined, boardId: draftBoardId ?? undefined });
      showToast({ message: "归属已保存", type: "success" });
      setProcessStep(3);
    } catch {
      showToast({ message: "保存失败", type: "error" });
    }
  };

  const handleSegSizeSelect = (option: typeof SEG_SIZE_OPTIONS[number]) => {
    setDraftSegments(option.min);
  };

  const handleSaveStep3 = async () => {
    if (!currentTask) return;
    try {
      await updateTask(currentTask.id!, {
        requiredSegments: draftSegments,
        segmentReminderDays: draftReminderDays,
        reminderStage: "none",
        lastReminderAt: undefined,
      });
      showToast({ message: "安排已保存", type: "success" });
      setExpandedTaskId(null);
      setProcessStep(1);
      await loadData();
    } catch {
      showToast({ message: "保存失败", type: "error" });
    }
  };

  const handleMarkDone = async (task: Task) => {
    try {
      await updateTask(task.id!, { status: "done" });
      showToast({ message: "已标记完成", type: "success" });
      await loadData();
    } catch {
      showToast({ message: "操作失败", type: "error" });
    }
  };

  const boardStages = boards.find((b) => b.id === draftBoardId)?.stages || [];

  if (loading) {
    return (
      <div className="flex flex-col h-full max-w-2xl mx-auto px-4 pt-6 pb-24">
        <h1 className="text-xl font-bold text-gray-900 dark:text-gray-100 mb-5">安排事项</h1>
        <div className="space-y-3">
          {[1, 2, 3].map((i) => <div key={i} className="skeleton h-20 rounded-xl" />)}
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full max-w-2xl mx-auto px-4 pt-6 pb-24">
      <div className="flex items-center gap-3 mb-4">
        <Link href="/projects" className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800">
          <ArrowLeft className="w-5 h-5 text-gray-500" />
        </Link>
        <h1 className="text-xl font-bold text-gray-900 dark:text-gray-100">安排事项</h1>
      </div>

      <div className="flex border-b border-gray-200 dark:border-gray-800 mb-4">
        <button onClick={() => { setTab("pending"); setExpandedTaskId(null); }}
          className={`flex-1 py-2.5 text-sm font-medium border-b-2 transition-colors ${tab === "pending" ? "text-orange-600 border-orange-600" : "text-gray-500 border-transparent hover:text-gray-700"}`}>
          待安排 ({pendingTasks.length})
        </button>
        <button onClick={() => { setTab("process"); if (!expandedTaskId && pendingTasks.length > 0) selectTask(pendingTasks[0]); }}
          className={`flex-1 py-2.5 text-sm font-medium border-b-2 transition-colors ${tab === "process" ? "text-indigo-600 border-indigo-600" : "text-gray-500 border-transparent hover:text-gray-700"}`}>
          处理中
        </button>
        <button onClick={() => { setTab("scheduled"); setExpandedTaskId(null); }}
          className={`flex-1 py-2.5 text-sm font-medium border-b-2 transition-colors ${tab === "scheduled" ? "text-emerald-600 border-emerald-600" : "text-gray-500 border-transparent hover:text-gray-700"}`}>
          已安排 ({scheduledTasks.length})
        </button>
      </div>

      <div className="flex-1 overflow-y-auto space-y-3">
        {tab === "pending" && pendingTasks.length === 0 && (
          <div className="flex flex-col items-center justify-center py-16 text-center">
            <ListTodo className="w-12 h-12 text-gray-300 dark:text-gray-600 mb-4" />
            <p className="text-gray-500 dark:text-gray-400">暂无待安排事项</p>
            <p className="text-xs text-gray-400 dark:text-gray-500 mt-1">所有任务都已安排好时间段</p>
          </div>
        )}

        {tab === "pending" && pendingTasks.map((task) => {
          const segCount = segmentsMap.get(task.id!)?.length ?? 0;
          const typeInfo = TYPE_LABELS[task.type] || TYPE_LABELS.daily;
          const countdown = getCountdownDays(task.dueDate);
          const isOverdue = countdown !== null && countdown < 0;
          const isSelected = expandedTaskId === task.id;

          return (
            <div key={task.id} className={`bg-white dark:bg-gray-900 rounded-2xl border shadow-sm overflow-hidden ${isOverdue ? "border-red-200 dark:border-red-800" : isSelected ? "border-indigo-200 dark:border-indigo-800" : "border-gray-100 dark:border-gray-800"}`}>
              <div className="flex items-center gap-3 px-4 py-3 cursor-pointer" onClick={() => { setTab("process"); selectTask(task); }}>
                <div className="flex-1 min-w-0">
                  <p className="text-sm text-gray-700 dark:text-gray-300 truncate">{task.title}</p>
                  <div className="flex items-center gap-2 mt-0.5">
                    <span className={`text-[10px] font-medium px-1.5 py-0.5 rounded-md ${typeInfo.bg} ${typeInfo.color}`}>{typeInfo.label}</span>
                    <span className={`flex items-center gap-0.5 text-[10px] ${isOverdue ? "text-red-500" : "text-gray-400"}`}>
                      <Calendar className="w-3 h-3" />
                      {formatDate(task.dueDate)}
                      {countdown !== null && countdown >= 0 && ` · 剩余${countdown}天`}
                      {isOverdue && ` · 已逾期${Math.abs(countdown)}天`}
                    </span>
                  </div>
                </div>
                <div className="flex items-center gap-1 flex-shrink-0">
                  {TASK_TYPES.filter((t) => t.key !== task.type).map(({ key, label }) => (
                    <button key={key} onClick={(e) => { e.stopPropagation(); handleQuickType(task, key); }}
                      className="text-[10px] px-1.5 py-0.5 rounded-md bg-gray-100 dark:bg-gray-800 text-gray-500 hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors">
                      {label.slice(0, 2)}
                    </button>
                  ))}
                  <ChevronRight className="w-4 h-4 text-gray-300" />
                </div>
              </div>
            </div>
          );
        })}

        {tab === "process" && !currentTask && (
          <div className="flex flex-col items-center justify-center py-16 text-center">
            <Target className="w-12 h-12 text-gray-300 dark:text-gray-600 mb-4" />
            <p className="text-gray-500 dark:text-gray-400">没有待处理的任务</p>
            <p className="text-xs text-gray-400 dark:text-gray-500 mt-1">去待安排列表选择一个任务开始处理</p>
          </div>
        )}

        {tab === "process" && currentTask && (
          <div className="space-y-4">
            <div className="flex items-center gap-4 mb-2">
              {[1, 2, 3].map((s) => (
                <button key={s} onClick={() => setProcessStep(s)}
                  className={`flex items-center gap-1.5 text-sm font-medium transition-colors ${processStep === s ? "text-indigo-600" : "text-gray-400"}`}>
                  <span className={`w-5 h-5 rounded-full flex items-center justify-center text-xs border-2 ${processStep >= s ? "border-indigo-500 bg-indigo-500 text-white" : "border-gray-300 text-gray-400"}`}>
                    {processStep > s ? "✓" : s}
                  </span>
                  {s === 1 ? "分类" : s === 2 ? "归属" : "安排"}
                </button>
              ))}
            </div>

            {processStep === 1 && (
              <div className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-100 dark:border-gray-800 p-4 space-y-4">
                <div className="p-3 bg-gray-50 dark:bg-gray-800 rounded-xl">
                  <p className="text-sm font-medium text-gray-700 dark:text-gray-300 truncate">📌 {currentTask.title}</p>
                </div>
                <div>
                  <p className="text-xs font-medium text-gray-500 dark:text-gray-400 mb-2">类型</p>
                  <div className="grid grid-cols-2 gap-2">
                    {TASK_TYPES.map(({ key, label }) => (
                      <button key={key} onClick={() => setDraftType(key)}
                        className={`py-2.5 rounded-xl text-xs font-medium border transition-colors ${draftType === key ? "bg-indigo-100 dark:bg-indigo-900/30 text-indigo-600 border-indigo-300" : "bg-gray-50 dark:bg-gray-800 text-gray-500 border-gray-200 dark:border-gray-700 hover:bg-gray-100"}`}>
                        {label}
                      </button>
                    ))}
                  </div>
                </div>
                <div>
                  <p className="text-xs font-medium text-gray-500 dark:text-gray-400 mb-2">优先级</p>
                  <div className="grid grid-cols-2 gap-2">
                    {PRIORITY_CONFIG.map((opt) => (
                      <button key={opt.key} onClick={() => setDraftPriority(opt.key)}
                        className={`py-2.5 rounded-xl text-xs font-medium border transition-colors ${draftPriority === opt.key ? `${opt.bg} ${opt.color} border-2 border-current` : "bg-gray-50 dark:bg-gray-800 text-gray-500 border-gray-200 dark:border-gray-700"}`}>
                        <span className="inline-block w-2 h-2 rounded-full mr-1.5" style={{ backgroundColor: opt.hex }} />{opt.label}
                      </button>
                    ))}
                  </div>
                </div>
                <div>
                  <p className="text-xs font-medium text-gray-500 dark:text-gray-400 mb-2">截止日期</p>
                  <input type="datetime-local" value={draftDueDate}
                    onChange={(e) => setDraftDueDate(e.target.value)}
                    className="w-full px-4 py-2.5 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-sm text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500" />
                </div>
                <div className="flex gap-3">
                  <button onClick={() => setExpandedTaskId(null)} className="flex-1 py-2.5 rounded-xl border border-gray-200 dark:border-gray-700 text-sm text-gray-500">跳过</button>
                  <button onClick={handleSaveStep1}
                    className="flex-1 py-2.5 rounded-xl bg-indigo-600 text-white text-sm font-medium hover:bg-indigo-700 transition-colors">
                    保存并继续
                  </button>
                </div>
              </div>
            )}

            {processStep === 2 && (
              <div className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-100 dark:border-gray-800 p-4 space-y-4">
                <div>
                  <p className="text-xs font-medium text-gray-500 dark:text-gray-400 mb-2">项目</p>
                  <select value={draftProjectId ?? ""} onChange={(e) => handleProjectChange(e.target.value ? parseInt(e.target.value) : null)}
                    className="w-full px-4 py-2.5 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-sm text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500">
                    <option value="">不归属项目</option>
                    {projects.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
                  </select>
                </div>
                {boards.length > 0 && (
                  <div>
                    <p className="text-xs font-medium text-gray-500 dark:text-gray-400 mb-2">大模块</p>
                    <select value={draftBoardId ?? ""} onChange={(e) => handleBoardChange(e.target.value ? parseInt(e.target.value) : null)}
                      className="w-full px-4 py-2.5 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-sm text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500">
                      <option value="">不归大模块</option>
                      {boards.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
                    </select>
                  </div>
                )}
                {sections.length > 0 && (
                  <div>
                    <p className="text-xs font-medium text-gray-500 dark:text-gray-400 mb-2">子模块</p>
                    <select value={draftSectionId ?? ""} onChange={(e) => setDraftSectionId(e.target.value ? parseInt(e.target.value) : null)}
                      className="w-full px-4 py-2.5 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-sm text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500">
                      <option value="">不归子模块</option>
                      {sections.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
                    </select>
                  </div>
                )}
                <div className="flex gap-3">
                  <button onClick={() => setProcessStep(1)} className="flex-1 py-2.5 rounded-xl border border-gray-200 dark:border-gray-700 text-sm text-gray-500">上一步</button>
                  <button onClick={handleSaveStep2}
                    className="flex-1 py-2.5 rounded-xl bg-indigo-600 text-white text-sm font-medium hover:bg-indigo-700 transition-colors">
                    保存并继续
                  </button>
                </div>
              </div>
            )}

            {processStep === 3 && (
              <div className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-100 dark:border-gray-800 p-4 space-y-4">
                <div>
                  <p className="text-xs font-medium text-gray-500 dark:text-gray-400 mb-2">需要几个时间段?</p>
                  <div className="flex items-center gap-2 flex-wrap mb-2">
                    {SEG_SIZE_OPTIONS.map((opt) => {
                      const isSelected = draftSegments >= opt.min && draftSegments <= opt.max;
                      return (
                        <button key={opt.key} onClick={() => handleSegSizeSelect(opt)}
                          className={`px-3 py-1.5 rounded-xl text-xs font-medium border transition-colors ${isSelected ? "bg-indigo-100 dark:bg-indigo-900/30 text-indigo-600 border-indigo-300" : "bg-gray-50 dark:bg-gray-800 text-gray-500 border-gray-200 dark:border-gray-700 hover:bg-gray-100"}`}>
                          {opt.label} ({opt.range})
                        </button>
                      );
                    })}
                  </div>
                  <div className="flex items-center gap-2">
                    <button onClick={() => setDraftSegments(Math.max(1, draftSegments - 1))}
                      className="w-7 h-7 flex items-center justify-center rounded-lg bg-gray-100 dark:bg-gray-800 text-gray-500"><Minus className="w-3.5 h-3.5" /></button>
                    <span className="text-sm font-semibold text-gray-700 dark:text-gray-300 w-6 text-center">{draftSegments}</span>
                    <button onClick={() => setDraftSegments(draftSegments + 1)}
                      className="w-7 h-7 flex items-center justify-center rounded-lg bg-gray-100 dark:bg-gray-800 text-gray-500"><Plus className="w-3.5 h-3.5" /></button>
                    <span className="text-xs text-gray-400">个</span>
                  </div>
                </div>

                <div>
                  <p className="text-xs font-medium text-gray-500 dark:text-gray-400 mb-2">截止前多久提醒?</p>
                  <div className="flex items-center gap-2">
                    <button onClick={() => setDraftReminderDays(Math.max(1, draftReminderDays - 1))}
                      className="w-7 h-7 flex items-center justify-center rounded-lg bg-gray-100 dark:bg-gray-800 text-gray-500"><Minus className="w-3.5 h-3.5" /></button>
                    <span className="text-sm font-semibold text-gray-700 dark:text-gray-300">{draftReminderDays}</span>
                    <button onClick={() => setDraftReminderDays(Math.min(180, draftReminderDays + 1))}
                      className="w-7 h-7 flex items-center justify-center rounded-lg bg-gray-100 dark:bg-gray-800 text-gray-500"><Plus className="w-3.5 h-3.5" /></button>
                    <span className="text-xs text-gray-400">天前</span>
                  </div>
                </div>

                {draftDueDate && (
                  <div className="p-3 bg-gray-50 dark:bg-gray-800 rounded-xl">
                    <p className="text-xs font-medium text-gray-500 dark:text-gray-400 mb-2">安排计划预览</p>
                    <div className="space-y-1">
                      {getReminderTimeline(new Date(draftDueDate).getTime(), draftReminderDays, draftSegments).map((s, i) => (
                        <div key={s.key} className="flex items-center gap-2">
                          <div className={`w-1.5 h-1.5 rounded-full ${s.active ? "bg-indigo-500" : "bg-gray-300"}`} />
                          <span className={`text-[10px] ${s.active ? "text-indigo-600 font-medium" : "text-gray-400"}`}>
                            {s.label} · {s.date.toLocaleDateString("zh-CN", { month: "short", day: "numeric" })}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                <div className="flex gap-3">
                  <button onClick={() => setProcessStep(2)} className="flex-1 py-2.5 rounded-xl border border-gray-200 dark:border-gray-700 text-sm text-gray-500">上一步</button>
                  <button onClick={handleSaveStep3}
                    className="flex-1 py-2.5 rounded-xl bg-emerald-600 text-white text-sm font-medium hover:bg-emerald-700 transition-colors">
                    完成安排
                  </button>
                </div>
              </div>
            )}
          </div>
        )}

        {tab === "scheduled" && scheduledTasks.length === 0 && (
          <div className="flex flex-col items-center justify-center py-16 text-center">
            <CheckCircle className="w-12 h-12 text-gray-300 dark:text-gray-600 mb-4" />
            <p className="text-gray-500 dark:text-gray-400">暂无已安排事项</p>
            <p className="text-xs text-gray-400 dark:text-gray-500 mt-1">完成三段流程后任务会出现在这里</p>
          </div>
        )}

        {tab === "scheduled" && scheduledTasks.map((task) => {
          const segCount = segmentsMap.get(task.id!)?.length ?? 0;
          const typeInfo = TYPE_LABELS[task.type] || TYPE_LABELS.daily;
          const fullyArranged = task.requiredSegments ? segCount >= task.requiredSegments : segCount > 0;
          return (
            <div key={task.id} className={`bg-white dark:bg-gray-900 rounded-2xl border shadow-sm overflow-hidden ${fullyArranged ? "border-emerald-100 dark:border-emerald-800" : "border-amber-100 dark:border-amber-800"}`}>
              <div className="flex items-center gap-3 px-4 py-3">
                <div className={`w-6 h-6 rounded-full flex items-center justify-center flex-shrink-0 ${fullyArranged ? "bg-emerald-100 dark:bg-emerald-900/30" : "bg-amber-100 dark:bg-amber-900/30"}`}>
                  {fullyArranged ? <Check className="w-3.5 h-3.5 text-emerald-500" /> : <Clock className="w-3.5 h-3.5 text-amber-500" />}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm text-gray-700 dark:text-gray-300 truncate">{task.title}</p>
                  <div className="flex items-center gap-2 mt-0.5">
                    <span className={`text-[10px] font-medium px-1.5 py-0.5 rounded-md ${typeInfo.bg} ${typeInfo.color}`}>{typeInfo.label}</span>
                    <span className={`text-[10px] ${fullyArranged ? "text-emerald-500" : "text-amber-500"}`}>
                      {segCount}/{task.requiredSegments || segCount} 时段
                      {segCount === 0 ? " · 待添加" : ""}
                    </span>
                  </div>
                </div>
                <div className="flex items-center gap-1">
                  <button onClick={() => setDetailTaskId(task.id!)}
                    className="px-2.5 py-1.5 rounded-lg bg-blue-50 dark:bg-blue-900/20 text-blue-600 text-xs font-medium hover:bg-blue-100">管理</button>
                  <button onClick={() => handleMarkDone(task)}
                    className="w-7 h-7 flex items-center justify-center rounded-lg bg-emerald-50 dark:bg-emerald-900/20 text-emerald-500 hover:bg-emerald-100">
                    <Check className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {detailTaskId !== null && (
        <TaskDetail taskId={detailTaskId} onClose={() => setDetailTaskId(null)} onUpdate={loadData} />
      )}
    </div>
  );
}
