"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import {
  CalendarCheck, LayoutDashboard, FolderKanban, ChevronRight, Inbox, Plus, X,
  ChevronDown, Target, CheckCircle, Clock, ExternalLink, ArrowRight,
  CalendarDays, ClipboardList,
} from "lucide-react";
import { useSearchParams } from "next/navigation";
import { getTasksByType, getAllProjectsV2, createProjectV2, captureToTask } from "@/lib/db";
import TodayTab from "./TodayTab";
import { showToast } from "@/components/ui/Toast";
import type { ProjectV2, Task } from "@/lib/types";

const COLORS = ["#007AFF", "#34C759", "#FF9500", "#FF3B30", "#AF52DE", "#5856D6"];

// ==================== Tab 定义 ====================

type PlannerTab = "pending" | "today";

const PLANNER_TABS: { key: PlannerTab; label: string; desc: string; icon: typeof LayoutDashboard }[] = [
  { key: "pending", label: "安排", desc: "项目列表 · 分类处理任务", icon: FolderKanban },
  { key: "today", label: "今日", desc: "今天要做的事", icon: LayoutDashboard },
];

// ==================== 展开项目卡片 ====================

function ExpandedProjectCard({
  project,
  onClose,
  onUpdate,
}: {
  project: ProjectV2;
  onClose: () => void;
  onUpdate: () => void;
}) {
  const router = useRouter();
  const [goals, setGoals] = useState<Task[]>([]);
  const [pendingTasks, setPendingTasks] = useState<Task[]>([]);
  const [arrangedTasks, setArrangedTasks] = useState<Task[]>([]);
  const [loaded, setLoaded] = useState(false);

  // 处理中：点击待安排任务弹出分类
  const [classifyItem, setClassifyItem] = useState<Task | null>(null);

  useEffect(() => {
    (async () => {
      const pid = String(project.id);
      // 目标 = shortterm + daily 中属于该项目的任务
      const [shortterm, daily, allDaily] = await Promise.all([
        getTasksByType("shortterm"),
        getTasksByType("daily"),
        getTasksByType("daily"),
      ]);

      const allGoals = [...shortterm, ...daily].filter((t) => t.projectId === pid);
      setGoals(allGoals);

      // 所有 daily 任务中 active 且属于该项目的是捕捉任务（待安排）
      const pending = allDaily.filter((t) => t.projectId === pid && t.status === "active");
      setPendingTasks(pending);

      // arranged = 已安排的任务（非 active 状态的 daily 任务 + 有 startTime 的）
      const arranged = allDaily.filter(
        (t) => t.projectId === pid && t.status !== "active" && t.startTime
      );
      setArrangedTasks(arranged);

      setLoaded(true);
    })();
  }, [project.id]);

  // 目标进度统计
  const goalStats = (() => {
    const shorttermGoals = goals.filter((g) => g.type === "shortterm");
    const dailyGoals = goals.filter(
      (g) => g.type === "daily" && g.classification === "daily-trivial"
    );

    const stDone = shorttermGoals.filter((g) => g.status === "done").length;
    const stTotal = shorttermGoals.length;
    const stProgress = stTotal > 0 ? Math.round((stDone / stTotal) * 100) : 0;

    // 习惯打卡：检查今日是否完成（简单基于 status）
    const dgDone = dailyGoals.filter((g) => g.status === "done").length;
    const dgTotal = dailyGoals.length;
    const dgProgress = dgTotal > 0 ? Math.round((dgDone / dgTotal) * 100) : 0;

    return { shortterm: { done: stDone, total: stTotal, progress: stProgress }, daily: { done: dgDone, total: dgTotal, progress: dgProgress } };
  })();

  // 处理待安排任务
  const handleClassifyTask = (task: Task) => {
    setClassifyItem(task);
  };

  const handleClassifySubmit = async (type: "short-term" | "daily-trivial") => {
    if (!classifyItem) return;
    try {
      // 更新任务类型和分类
      const { updateTask } = await import("@/lib/db");
      await updateTask(classifyItem.id!, {
        type: type === "short-term" ? "shortterm" : "daily",
        classification: type,
      });
      // 保持 active 状态，但添加默认开始时间
      const today = new Date();
      const start = new Date(today.getFullYear(), today.getMonth(), today.getDate()).getTime();
      await captureToTask(classifyItem.id!, { startTime: start, endTime: start + 86400000 });
      showToast({ message: `已分类为${type === "short-term" ? "短期事件" : "每日习惯"}`, type: "success" });
      setClassifyItem(null);
      onUpdate();
    } catch {
      showToast({ message: "操作失败", type: "error" });
    }
  };

  if (!loaded) {
    return (
      <div className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-200 dark:border-gray-700 p-4 shadow-md">
        <div className="flex justify-center py-8">
          <div className="w-6 h-6 border-2 border-indigo-400 border-t-transparent rounded-full animate-spin" />
        </div>
      </div>
    );
  }

  return (
    <>
      <motion.div
        initial={{ height: 0, opacity: 0 }}
        animate={{ height: "auto", opacity: 1 }}
        exit={{ height: 0, opacity: 0 }}
        className="overflow-hidden"
      >
        <div className="bg-white dark:bg-gray-900 rounded-2xl border border-indigo-200 dark:border-indigo-800 shadow-md overflow-hidden">
          {/* 头部 */}
          <div className="p-4 border-b border-gray-100 dark:border-gray-800 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div
                className="w-9 h-9 rounded-lg flex items-center justify-center"
                style={{ backgroundColor: `${project.color}20`, color: project.color }}
              >
                <FolderKanban className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-sm font-semibold text-gray-900 dark:text-white">{project.name}</h3>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={() => router.push(`/projects/${project.id}`)}
                className="flex items-center gap-1 text-xs text-indigo-600 dark:text-indigo-400 hover:underline"
              >
                <ExternalLink className="w-3 h-3" />
                查看详情
              </button>
              <button onClick={onClose} className="p-1 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg">
                <ChevronDown className="w-5 h-5 text-gray-400" />
              </button>
            </div>
          </div>

          {/* 目标进度 */}
          <div className="px-4 py-4 border-b border-gray-100 dark:border-gray-800">
            <div className="flex items-center gap-2 mb-3">
              <Target className="w-4 h-4 text-indigo-500" />
              <span className="text-sm font-semibold text-gray-700 dark:text-gray-300">目标</span>
            </div>

            {/* 短期事件 */}
            <div className="mb-3">
              <div className="flex items-center justify-between mb-1.5">
                <div className="flex items-center gap-1.5">
                  <CalendarDays className="w-3.5 h-3.5 text-blue-500" />
                  <span className="text-xs text-gray-600 dark:text-gray-400">短期事件</span>
                </div>
                <span className="text-xs text-gray-400">
                  {goalStats.shortterm.done}/{goalStats.shortterm.total}
                </span>
              </div>
              <div className="h-2 bg-gray-100 dark:bg-gray-800 rounded-full overflow-hidden">
                <motion.div
                  initial={{ width: 0 }}
                  animate={{ width: `${goalStats.shortterm.progress}%` }}
                  transition={{ duration: 0.5, ease: "easeOut" }}
                  className="h-full rounded-full"
                  style={{
                    background: goalStats.shortterm.progress >= 80
                      ? "linear-gradient(90deg, #34C759, #30D158)"
                      : goalStats.shortterm.progress >= 40
                      ? "linear-gradient(90deg, #FF9500, #FFB340)"
                      : "linear-gradient(90deg, #007AFF, #5AC8FA)",
                  }}
                />
              </div>
              <p className="text-[10px] text-gray-400 mt-1">
                {goalStats.shortterm.total === 0
                  ? "暂无短期事件"
                  : `${goalStats.shortterm.progress}% 完成`}
              </p>
            </div>

            {/* 日常习惯 */}
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <div className="flex items-center gap-1.5">
                  <ClipboardList className="w-3.5 h-3.5 text-green-500" />
                  <span className="text-xs text-gray-600 dark:text-gray-400">日常习惯</span>
                </div>
                <span className="text-xs text-gray-400">
                  {goalStats.daily.done}/{goalStats.daily.total}
                </span>
              </div>
              <div className="h-2 bg-gray-100 dark:bg-gray-800 rounded-full overflow-hidden">
                <motion.div
                  initial={{ width: 0 }}
                  animate={{ width: `${goalStats.daily.progress}%` }}
                  transition={{ duration: 0.5, ease: "easeOut" }}
                  className="h-full rounded-full"
                  style={{
                    background: goalStats.daily.progress >= 80
                      ? "linear-gradient(90deg, #34C759, #30D158)"
                      : goalStats.daily.progress >= 40
                      ? "linear-gradient(90deg, #FF9500, #FFB340)"
                      : "linear-gradient(90deg, #007AFF, #5AC8FA)",
                  }}
                />
              </div>
              <p className="text-[10px] text-gray-400 mt-1">
                {goalStats.daily.total === 0
                  ? "暂无关卡"
                  : `${goalStats.daily.progress}% 今日打卡`}
              </p>
            </div>

            {/* 目标基本信息列表 */}
            {goals.length > 0 && (
              <div className="mt-3 space-y-1">
                {goals.slice(0, 5).map((goal) => (
                  <div key={goal.id} className="flex items-center gap-2 text-xs py-1">
                    {goal.status === "done" ? (
                      <CheckCircle className="w-3 h-3 text-green-500 shrink-0" />
                    ) : (
                      <Clock className="w-3 h-3 text-gray-400 shrink-0" />
                    )}
                    <span className={`truncate ${goal.status === "done" ? "text-gray-400 line-through" : "text-gray-600 dark:text-gray-400"}`}>
                      {goal.title}
                    </span>
                    <span className="text-[10px] text-gray-400 ml-auto shrink-0">
                      {goal.type === "shortterm" ? "短期" : "习惯"}
                    </span>
                  </div>
                ))}
                {goals.length > 5 && (
                  <p className="text-[10px] text-gray-400 text-center">还有 {goals.length - 5} 个目标...</p>
                )}
              </div>
            )}
          </div>

          {/* 已安排 */}
          <div className="px-4 py-4 border-b border-gray-100 dark:border-gray-800">
            <div className="flex items-center gap-2 mb-3">
              <CheckCircle className="w-4 h-4 text-green-500" />
              <span className="text-sm font-semibold text-gray-700 dark:text-gray-300">已安排</span>
              <span className="text-xs text-gray-400">({arrangedTasks.length})</span>
            </div>
            {arrangedTasks.length > 0 ? (
              <div className="space-y-1.5 max-h-40 overflow-y-auto">
                {arrangedTasks.slice(0, 10).map((task) => (
                  <div key={task.id} className="flex items-center gap-2 text-xs text-gray-600 dark:text-gray-400 py-1">
                    <div className="w-1.5 h-1.5 rounded-full bg-green-400 shrink-0" />
                    <span className="truncate">{task.title}</span>
                  </div>
                ))}
                {arrangedTasks.length > 10 && (
                  <p className="text-[10px] text-gray-400 text-center">还有 {arrangedTasks.length - 10} 条...</p>
                )}
              </div>
            ) : (
              <p className="text-xs text-gray-400 py-2">暂无已安排任务</p>
            )}
          </div>

          {/* 待安排 */}
          <div className="px-4 py-4">
            <div className="flex items-center gap-2 mb-3">
              <Clock className="w-4 h-4 text-amber-500" />
              <span className="text-sm font-semibold text-gray-700 dark:text-gray-300">待安排</span>
              <span className="text-xs text-gray-400">({pendingTasks.length})</span>
            </div>
            {pendingTasks.length > 0 ? (
              <div className="space-y-1.5 max-h-48 overflow-y-auto">
                {pendingTasks.map((task) => (
                  <button
                    key={task.id}
                    onClick={() => handleClassifyTask(task)}
                    className="w-full flex items-center gap-2 p-2 bg-amber-50 dark:bg-amber-900/10 rounded-lg text-xs text-gray-700 dark:text-gray-300 hover:bg-amber-100 dark:hover:bg-amber-900/20 transition-colors text-left group"
                  >
                    <Clock className="w-3.5 h-3.5 text-amber-500 shrink-0" />
                    <span className="truncate flex-1">{task.title}</span>
                    <ArrowRight className="w-3.5 h-3.5 text-amber-400 opacity-0 group-hover:opacity-100 transition-opacity" />
                  </button>
                ))}
              </div>
            ) : (
              <p className="text-xs text-gray-400 py-2">暂无待安排任务</p>
            )}
          </div>
        </div>
      </motion.div>

      {/* 处理中 Sheet */}
      <AnimatePresence>
        {classifyItem && (
          <motion.div
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 bg-black/40 backdrop-blur-sm flex items-end justify-center"
            onClick={() => setClassifyItem(null)}
          >
            <motion.div
              initial={{ y: "100%" }} animate={{ y: 0 }} exit={{ y: "100%" }}
              transition={{ type: "spring", stiffness: 400, damping: 40 }}
              onClick={(e) => e.stopPropagation()}
              className="w-full max-w-lg bg-white dark:bg-gray-900 rounded-t-2xl"
            >
              <div className="w-10 h-1 bg-gray-300 dark:bg-gray-700 rounded-full mx-auto mt-3 mb-1" />
              <div className="px-6 pt-4 pb-6">
                <h3 className="text-base font-semibold text-gray-900 dark:text-gray-100 mb-1">处理中</h3>
                <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">
                  "{classifyItem.title.slice(0, 40)}" 分类为？
                </p>
                <div className="space-y-2">
                  <button
                    onClick={() => handleClassifySubmit("short-term")}
                    className="w-full flex items-center gap-3 px-4 py-3.5 rounded-xl hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors text-left"
                  >
                    <div className="w-10 h-10 rounded-xl bg-blue-50 dark:bg-blue-900/20 flex items-center justify-center">
                      <CalendarDays className="w-5 h-5 text-blue-500" />
                    </div>
                    <div>
                      <p className="text-sm font-medium text-gray-900 dark:text-gray-100">短期事件</p>
                      <p className="text-xs text-gray-400">有截止日期的独立事件</p>
                    </div>
                    <ChevronRight className="w-5 h-5 text-gray-400 ml-auto" />
                  </button>
                  <button
                    onClick={() => handleClassifySubmit("daily-trivial")}
                    className="w-full flex items-center gap-3 px-4 py-3.5 rounded-xl hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors text-left"
                  >
                    <div className="w-10 h-10 rounded-xl bg-green-50 dark:bg-green-900/20 flex items-center justify-center">
                      <ClipboardList className="w-5 h-5 text-green-500" />
                    </div>
                    <div>
                      <p className="text-sm font-medium text-gray-900 dark:text-gray-100">日常习惯</p>
                      <p className="text-xs text-gray-400">每天重复的习惯打卡</p>
                    </div>
                    <ChevronRight className="w-5 h-5 text-gray-400 ml-auto" />
                  </button>
                </div>
                <button
                  onClick={() => setClassifyItem(null)}
                  className="mt-4 w-full py-3 rounded-xl border border-gray-200 dark:border-gray-700 text-sm text-gray-500 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors"
                >
                  取消
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}

// ==================== 项目列表组件 ====================

function ProjectList({
  projects,
  pendingCounts,
  unclassifiedCount,
  onCreateProject,
  onUpdate,
}: {
  projects: ProjectV2[];
  pendingCounts: Record<number, number>;
  unclassifiedCount: number;
  onCreateProject: () => void;
  onUpdate: () => void;
}) {
  const router = useRouter();
  const [expandedId, setExpandedId] = useState<number | null>(null);

  return (
    <div className="space-y-3">
      {/* 未分类入口 */}
      <button
        onClick={() => router.push(`/projects/unclassified`)}
        className="w-full flex items-center gap-4 p-4 bg-white dark:bg-gray-900 rounded-2xl border border-gray-100 dark:border-gray-800 shadow-sm hover:shadow-md transition-shadow group"
      >
        <div className="w-12 h-12 rounded-xl bg-gray-100 dark:bg-gray-800 flex items-center justify-center text-xl">
          <Inbox className="w-6 h-6 text-gray-400" />
        </div>
        <div className="flex-1 text-left">
          <p className="text-sm font-semibold text-gray-900 dark:text-white">未分类</p>
          <p className="text-xs text-gray-400">暂无归属的任务</p>
        </div>
        {unclassifiedCount > 0 && (
          <span className="inline-flex items-center justify-center min-w-[22px] h-[22px] px-1.5 text-[11px] font-bold text-white bg-violet-500 rounded-full">
            {unclassifiedCount}
          </span>
        )}
        <ChevronRight className="w-4 h-4 text-gray-300 group-hover:text-gray-500 transition-colors" />
      </button>

      {/* 项目列表 — 可展开 */}
      {projects.map((project) => {
        const count = pendingCounts[project.id!] || 0;
        const isExpanded = expandedId === project.id;

        return (
          <div key={project.id}>
            <button
              onClick={() => setExpandedId(isExpanded ? null : project.id!)}
              className={`w-full flex items-center gap-4 p-4 bg-white dark:bg-gray-900 border shadow-sm hover:shadow-md transition-all group rounded-2xl ${
                isExpanded
                  ? "border-indigo-200 dark:border-indigo-800 rounded-b-none border-b-0"
                  : "border-gray-100 dark:border-gray-800"
              }`}
            >
              <div
                className="w-12 h-12 rounded-xl flex items-center justify-center text-xl"
                style={{ backgroundColor: `${project.color}20`, color: project.color }}
              >
                <FolderKanban className="w-6 h-6" />
              </div>
              <div className="flex-1 text-left">
                <p className="text-sm font-semibold text-gray-900 dark:text-white">{project.name}</p>
                <p className="text-xs text-gray-400">
                  {count > 0 ? `${count} 条待安排` : "暂无待安排"}
                </p>
              </div>
              {count > 0 && (
                <span className="inline-flex items-center justify-center min-w-[22px] h-[22px] px-1.5 text-[11px] font-bold text-white bg-violet-500 rounded-full">
                  {count}
                </span>
              )}
              <ChevronDown
                className={`w-4 h-4 text-gray-300 group-hover:text-gray-500 transition-transform ${isExpanded ? "rotate-180" : ""}`}
              />
            </button>

            <AnimatePresence>
              {isExpanded && (
                <ExpandedProjectCard
                  project={project}
                  onClose={() => setExpandedId(null)}
                  onUpdate={onUpdate}
                />
              )}
            </AnimatePresence>
          </div>
        );
      })}

      {projects.length === 0 && (
        <div className="text-center py-12">
          <FolderKanban className="w-10 h-10 text-gray-300 mx-auto mb-3" />
          <p className="text-sm text-gray-400">暂无项目</p>
          <button
            onClick={onCreateProject}
            className="mt-3 inline-flex items-center gap-1.5 px-4 py-2 text-xs font-medium text-indigo-600 bg-indigo-50 dark:bg-indigo-900/20 rounded-xl hover:bg-indigo-100 transition-colors"
          >
            <Plus className="w-3.5 h-3.5" />
            创建第一个项目
          </button>
        </div>
      )}

      {/* 新建项目按钮 */}
      <button
        onClick={onCreateProject}
        className="w-full flex items-center justify-center gap-2 py-3 text-sm text-gray-500 hover:text-gray-700 bg-white dark:bg-gray-900 rounded-2xl border border-dashed border-gray-200 dark:border-gray-700 hover:border-gray-300 transition-colors"
      >
        <Plus className="w-4 h-4" />
        新建项目
      </button>
    </div>
  );
}

// ==================== 入场动画 ====================

function FadeInUp({ children, delay = 0, className }: { children: React.ReactNode; delay?: number; className?: string }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, delay, ease: [0.25, 0.46, 0.45, 0.94] }}
      className={className}
    >
      {children}
    </motion.div>
  );
}

// ==================== 主组件 ====================

export default function PlannerPage() {
  const searchParams = useSearchParams();
  const [activeTab, setActiveTab] = useState<PlannerTab>("pending");
  const [todayKey, setTodayKey] = useState(0);
  const [projects, setProjects] = useState<ProjectV2[]>([]);
  const [pendingCounts, setPendingCounts] = useState<Record<number, number>>({});
  const [unclassifiedCount, setUnclassifiedCount] = useState(0);
  const [showNewProject, setShowNewProject] = useState(false);
  const [newProjectName, setNewProjectName] = useState("");

  const handleCreateProject = useCallback(async () => {
    if (!newProjectName.trim()) return;
    await createProjectV2(newProjectName.trim(), COLORS[Math.floor(Math.random() * COLORS.length)]);
    setNewProjectName("");
    setShowNewProject(false);
    await loadProjectData();
  }, [newProjectName]);

  const loadProjectData = useCallback(async () => {
    const allProjects = await getAllProjectsV2();
    setProjects(allProjects);

    const allTasks = await getTasksByType("daily");
    const active = allTasks.filter((t) => t.status === "active");

    // 按项目统计
    const counts: Record<number, number> = {};
    let noProject = 0;
    for (const t of active) {
      if (t.projectId != null) {
        const pid = Number(t.projectId);
        counts[pid] = (counts[pid] || 0) + 1;
      } else {
        noProject++;
      }
    }
    setPendingCounts(counts);
    setUnclassifiedCount(noProject);
  }, []);

  useEffect(() => { loadProjectData(); }, [loadProjectData]);

  // URL 参数
  useEffect(() => {
    const tab = searchParams.get("tab");
    if (tab === "today") setActiveTab("today");
    if (tab === "pending") setActiveTab("pending");
  }, [searchParams]);

  const handleTodayUpdate = useCallback(() => setTodayKey((k) => k + 1), []);
  const handleProjectUpdate = useCallback(() => { loadProjectData(); }, [loadProjectData]);

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-50 to-white dark:from-gray-950 dark:to-gray-900">
      <div className="mx-auto max-w-3xl px-5 py-8 pb-24 md:px-8 md:py-10">
        <FadeInUp delay={0} className="mb-6">
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">规划</h1>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
            {activeTab === "pending" ? "选择项目，分类处理任务" : "今天要做的事"}
          </p>
        </FadeInUp>

        {/* Tab */}
        <FadeInUp delay={0.08} className="mb-6">
          <div className="relative grid grid-cols-2 gap-1 bg-gray-100 dark:bg-gray-800 rounded-xl p-1">
            <motion.div
              layoutId="planner-tab-indicator"
              className="absolute top-1 bottom-1 rounded-lg bg-white dark:bg-gray-700 shadow-sm"
              style={{ width: "calc(50% - 4px)" }}
              animate={{ left: activeTab === "pending" ? "4px" : "calc(50% + 0px)" }}
              transition={{ duration: 0.25, ease: [0.4, 0, 0.2, 1] }}
            />
            {PLANNER_TABS.map((tab) => (
              <button
                key={tab.key}
                onClick={() => setActiveTab(tab.key)}
                className={`relative z-10 flex flex-col items-center py-2.5 rounded-lg text-sm transition-colors ${
                  activeTab === tab.key ? "text-gray-900 dark:text-white" : "text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300"
                }`}
              >
                <div className="flex items-center gap-2">
                  <tab.icon className="w-[18px] h-[18px]" strokeWidth={2} />
                  <span className={activeTab === tab.key ? "font-semibold" : "font-medium"}>{tab.label}</span>
                </div>
                {activeTab === tab.key && (
                  <span className="text-[10px] text-gray-400 dark:text-gray-500 mt-0.5">{tab.desc}</span>
                )}
              </button>
            ))}
          </div>
        </FadeInUp>

        {/* 内容 */}
        <FadeInUp delay={0.16}>
          <AnimatePresence mode="wait">
            <motion.div
              key={activeTab}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.25 }}
            >
              {activeTab === "pending" && (
                <ProjectList
                  projects={projects}
                  pendingCounts={pendingCounts}
                  unclassifiedCount={unclassifiedCount}
                  onCreateProject={() => { setNewProjectName(""); setShowNewProject(true); }}
                  onUpdate={handleProjectUpdate}
                />
              )}
              {activeTab === "today" && (
                <TodayTab key={todayKey} onUpdate={handleTodayUpdate} />
              )}
            </motion.div>
          </AnimatePresence>
        </FadeInUp>
      </div>

      {/* 新建项目弹窗 */}
      <AnimatePresence>
        {showNewProject && (
          <motion.div
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 bg-black/40 flex items-end justify-center"
            onClick={() => setShowNewProject(false)}
          >
            <motion.div
              initial={{ y: "100%" }} animate={{ y: 0 }} exit={{ y: "100%" }}
              transition={{ type: "spring", stiffness: 400, damping: 40 }}
              onClick={(e) => e.stopPropagation()}
              className="w-full max-w-lg bg-white dark:bg-gray-900 rounded-t-2xl p-6"
            >
              <div className="w-10 h-1 bg-gray-300 dark:bg-gray-700 rounded-full mx-auto mb-4" />
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-semibold text-gray-900 dark:text-white">新建项目</h3>
                <button onClick={() => setShowNewProject(false)} className="p-1 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg">
                  <X className="w-5 h-5 text-gray-400" />
                </button>
              </div>
              <input
                type="text"
                value={newProjectName}
                onChange={(e) => setNewProjectName(e.target.value)}
                placeholder="项目名称"
                className="w-full px-4 py-3 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-sm text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500 mb-4"
                autoFocus
                onKeyDown={(e) => e.key === "Enter" && handleCreateProject()}
              />
              <div className="flex gap-3">
                <button onClick={() => setShowNewProject(false)} className="flex-1 py-3 rounded-xl border border-gray-200 dark:border-gray-700 text-sm text-gray-500">
                  取消
                </button>
                <button
                  onClick={handleCreateProject}
                  disabled={!newProjectName.trim()}
                  className="flex-1 py-3 rounded-xl bg-indigo-600 text-white text-sm font-medium hover:bg-indigo-700 disabled:opacity-40"
                >
                  创建
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
