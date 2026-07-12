"use client";

import { useState, useEffect, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import {
  ArrowLeft, LayoutDashboard, Inbox, CheckSquare, Trash2, ChevronRight,
  Target, Zap, Sun, CalendarRange, Clock, FolderKanban, Plus,
  ChevronDown, Layers,
} from "lucide-react";
import Link from "next/link";
import { getProjectV2, getBoardsByProject, getSectionsByBoard, getTasksBySection,
  getTasksByType, createTask, updateTask, deleteTask, captureToTask,
} from "@/lib/db";
import { showToast } from "@/components/ui/Toast";
import type { ProjectV2, Board, Task, Section } from "@/lib/types";

type DetailTab = "overview" | "pending" | "arranged";

const TABS: { key: DetailTab; label: string; icon: typeof LayoutDashboard }[] = [
  { key: "overview", label: "概览", icon: LayoutDashboard },
  { key: "pending", label: "待安排", icon: Inbox },
  { key: "arranged", label: "已安排", icon: CheckSquare },
];

function relativeTime(ts: number): string {
  const diff = Date.now() - ts;
  const m = Math.floor(diff / 60000);
  if (m < 60) return `${m}分钟前`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}小时前`;
  return `${Math.floor(h / 24)}天前`;
}

export default function ProjectDetailPage() {
  const params = useParams();
  const router = useRouter();
  const projectId = Number(params.projectId);

  const [project, setProject] = useState<ProjectV2 | null>(null);
  const [activeTab, setActiveTab] = useState<DetailTab>("overview");
  const [loading, setLoading] = useState(true);

  // 概览数据
  const [boards, setBoards] = useState<Board[]>([]);
  const [projectStats, setProjectStats] = useState({ done: 0, total: 0 });

  // 待安排 & 已安排
  const [pendingTasks, setPendingTasks] = useState<Task[]>([]);
  const [arrangedTasks, setArrangedTasks] = useState<Task[]>([]);

  // 展开态：Board → Sections
  const [expandedBoards, setExpandedBoards] = useState<Set<number>>(new Set());
  const [boardSections, setBoardSections] = useState<Map<number, Section[]>>(new Map());

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const p = await getProjectV2(projectId);
      if (!p) { setLoading(false); return; }
      setProject(p);

      // 加载面板和任务
      const b = await getBoardsByProject(projectId);
      setBoards(b);

      let totalDone = 0, totalAll = 0;
      const allArranged: Task[] = [];

      for (const board of b) {
        const sections = await getSectionsByBoard(board.id!);
        for (const section of sections) {
          const tasks = await getTasksBySection(section.id!);
          totalAll += tasks.length;
          totalDone += tasks.filter(t => t.status === "done").length;
          allArranged.push(...tasks);
        }
      }
      setProjectStats({ done: totalDone, total: totalAll });
      setArrangedTasks(allArranged);

      // 待安排 = 属于该项目的 daily 类型 active 任务
      const allDaily = await getTasksByType("daily");
      const pending = allDaily.filter(t =>
        t.status === "active" && t.projectId != null && Number(t.projectId) === projectId
      );
      setPendingTasks(pending);
    } catch (err) {
      console.error("Failed to load project detail:", err);
    } finally {
      setLoading(false);
    }
  }, [projectId]);

  useEffect(() => { loadData(); }, [loadData]);

  // 快速处理待安排任务
  const handleQuickToday = async (taskId: number) => {
    const today = new Date();
    const start = new Date(today.getFullYear(), today.getMonth(), today.getDate()).getTime();
    await captureToTask(taskId, { startTime: start, endTime: start + 86400000 });
    showToast({ message: "已添加到今日", type: "success" });
    await loadData();
  };

  const handleQuickTomorrow = async (taskId: number) => {
    const t = new Date(); t.setDate(t.getDate() + 1);
    const start = new Date(t.getFullYear(), t.getMonth(), t.getDate()).getTime();
    await captureToTask(taskId, { startTime: start, endTime: start + 86400000 });
    showToast({ message: "已添加到明天", type: "success" });
    await loadData();
  };

  const handleDelete = async (taskId: number) => {
    await deleteTask(taskId);
    showToast({ message: "已删除", type: "info" });
    await loadData();
  };

  // 展开/折叠子模块
  const toggleBoard = async (boardId: number) => {
    const next = new Set(expandedBoards);
    if (next.has(boardId)) {
      next.delete(boardId);
      setExpandedBoards(next);
    } else {
      next.add(boardId);
      setExpandedBoards(next);
      if (!boardSections.has(boardId)) {
        const sections = await getSectionsByBoard(boardId);
        setBoardSections((prev) => new Map(prev).set(boardId, sections));
      }
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-slate-50 to-white dark:from-gray-950 dark:to-gray-900 flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-gray-300 border-t-gray-600 rounded-full animate-spin" />
      </div>
    );
  }

  if (!project) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-slate-50 to-white dark:from-gray-950 dark:to-gray-900 flex flex-col items-center justify-center gap-4">
        <p className="text-gray-500">项目不存在</p>
        <Link href="/planner" className="text-sm text-indigo-600 hover:underline">返回规划页</Link>
      </div>
    );
  }

  const progressPct = projectStats.total > 0 ? Math.round((projectStats.done / projectStats.total) * 100) : 0;

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-50 to-white dark:from-gray-950 dark:to-gray-900">
      <div className="mx-auto max-w-3xl px-5 py-8 pb-24 md:px-8 md:py-10">
        {/* 导航 + 项目信息 */}
        <div className="flex items-center gap-3 mb-6">
          <Link href="/planner" className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800">
            <ArrowLeft className="w-5 h-5 text-gray-400" />
          </Link>
          <div
            className="w-10 h-10 rounded-xl flex items-center justify-center text-lg"
            style={{ backgroundColor: `${project.color}20`, color: project.color }}
          >
            <FolderKanban className="w-5 h-5" />
          </div>
          <div className="flex-1">
            <h1 className="text-lg font-bold text-gray-900 dark:text-white">{project.name}</h1>
            <div className="flex items-center gap-2 mt-1">
              <div className="h-2 w-24 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
                <motion.div
                  initial={{ width: 0 }}
                  animate={{ width: `${progressPct}%` }}
                  style={{ backgroundColor: project.color }}
                  className="h-full rounded-full"
                />
              </div>
              <span className="text-xs text-gray-400">{progressPct}%</span>
            </div>
          </div>
        </div>

        {/* Tab 栏 */}
        <div className="relative grid grid-cols-3 gap-1 bg-gray-100 dark:bg-gray-800 rounded-xl p-1 mb-6">
          <motion.div
            layoutId="project-detail-tab"
            className="absolute top-1 bottom-1 rounded-lg bg-white dark:bg-gray-700 shadow-sm"
            style={{ width: `calc((100% - 8px) / 3)` }}
            animate={{
              left: `calc(${TABS.findIndex(t => t.key === activeTab) * (100 / 3)}% + ${TABS.findIndex(t => t.key === activeTab) * 4 / 3}px)`,
            }}
            transition={{ duration: 0.25 }}
          />
          {TABS.map((tab) => (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              className={`relative z-10 flex items-center justify-center gap-1.5 py-2.5 rounded-lg text-sm transition-colors ${
                activeTab === tab.key ? "text-gray-900 dark:text-white font-semibold" : "text-gray-500"
              }`}
            >
              <tab.icon className="w-4 h-4" />
              <span>{tab.label}</span>
            </button>
          ))}
        </div>

        {/* 内容区 */}
        <AnimatePresence mode="wait">
          <motion.div
            key={activeTab}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
          >
            {/* ====== 概览 ====== */}
            {activeTab === "overview" && (
              <div className="space-y-4">
                {/* 进度统计 */}
                <div className="grid grid-cols-2 gap-3">
                  <div className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-100 dark:border-gray-800 p-4">
                    <p className="text-xs text-gray-400">已完成</p>
                    <p className="text-2xl font-bold text-emerald-500">{projectStats.done}</p>
                    <p className="text-xs text-gray-400">个任务</p>
                  </div>
                  <div className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-100 dark:border-gray-800 p-4">
                    <p className="text-xs text-gray-400">待安排</p>
                    <p className="text-2xl font-bold text-violet-500">{pendingTasks.length}</p>
                    <p className="text-xs text-gray-400">条想法</p>
                  </div>
                </div>

                {/* 子模块列表 — 可展开 */}
                <div className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-100 dark:border-gray-800 p-4">
                  <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-3">子模块</h3>
                  {boards.length > 0 ? (
                    <div className="space-y-1">
                      {boards.map((board) => {
                        const isExpanded = expandedBoards.has(board.id!);
                        const sections = boardSections.get(board.id!) || [];
                        return (
                          <div key={board.id}>
                            <button
                              onClick={() => toggleBoard(board.id!)}
                              className="w-full flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-800 rounded-xl hover:bg-gray-100 dark:hover:bg-gray-750 transition-colors"
                            >
                              <div className="flex items-center gap-2">
                                <Layers className="w-4 h-4 text-gray-400" />
                                <span className="text-sm text-gray-700 dark:text-gray-300">{board.name}</span>
                              </div>
                              <ChevronDown className={`w-4 h-4 text-gray-400 transition-transform ${isExpanded ? "rotate-180" : ""}`} />
                            </button>
                            <AnimatePresence>
                              {isExpanded && (
                                <motion.div
                                  initial={{ height: 0, opacity: 0 }}
                                  animate={{ height: "auto", opacity: 1 }}
                                  exit={{ height: 0, opacity: 0 }}
                                  className="overflow-hidden"
                                >
                                  <div className="ml-4 mt-1 space-y-1 pb-1">
                                    {sections.length > 0 ? (
                                      sections.map((section) => (
                                        <Link
                                          key={section.id}
                                          href={`/projects/${projectId}/boards/${board.id}/sections/${section.id}`}
                                          className="flex items-center justify-between p-2.5 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors group"
                                        >
                                          <span className="text-sm text-gray-600 dark:text-gray-400">{section.name}</span>
                                          <ChevronRight className="w-3.5 h-3.5 text-gray-300 group-hover:text-gray-500" />
                                        </Link>
                                      ))
                                    ) : (
                                      <p className="text-xs text-gray-400 py-3 text-center">暂无子模块</p>
                                    )}
                                  </div>
                                </motion.div>
                              )}
                            </AnimatePresence>
                          </div>
                        );
                      })}
                    </div>
                  ) : (
                    <p className="text-xs text-gray-400 py-4 text-center">暂无子模块</p>
                  )}
                </div>
              </div>
            )}

            {/* ====== 待安排 ====== */}
            {activeTab === "pending" && (
              <div className="space-y-2">
                {pendingTasks.length === 0 ? (
                  <div className="text-center py-16">
                    <Inbox className="w-10 h-10 text-gray-300 mx-auto mb-3" />
                    <p className="text-sm text-gray-400">暂无待安排的想法</p>
                    <p className="text-xs text-gray-400 mt-1">在主页捕捉时选择此项目即可</p>
                  </div>
                ) : (
                  pendingTasks.map((task) => (
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
                  ))
                )}
              </div>
            )}

            {/* ====== 已安排 ====== */}
            {activeTab === "arranged" && (
              <div className="space-y-2">
                {arrangedTasks.length === 0 ? (
                  <div className="text-center py-16">
                    <CheckSquare className="w-10 h-10 text-gray-300 mx-auto mb-3" />
                    <p className="text-sm text-gray-400">暂无已安排的任务</p>
                  </div>
                ) : (
                  arrangedTasks.map((task) => (
                    <div
                      key={task.id}
                      className="bg-white dark:bg-gray-900 rounded-xl border border-gray-100 dark:border-gray-800 p-3 flex items-center gap-3"
                    >
                      <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center flex-shrink-0 ${
                        task.status === "done" ? "bg-emerald-500 border-emerald-500" : "border-gray-300"
                      }`}>
                        {task.status === "done" && <CheckSquare className="w-3 h-3 text-white" />}
                      </div>
                      <span className={`text-sm flex-1 ${task.status === "done" ? "text-gray-400 line-through" : "text-gray-800 dark:text-gray-200"}`}>
                        {task.title}
                      </span>
                      <span className="text-xs text-gray-400">{task.startTime ? new Date(task.startTime).toLocaleDateString("zh-CN") : ""}</span>
                    </div>
                  ))
                )}
              </div>
            )}
          </motion.div>
        </AnimatePresence>
      </div>
    </div>
  );
}
