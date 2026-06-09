"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import {
  Target, Calendar, Timer, BookOpen, Play, ListChecks,
  Focus, X, ChevronRight, ArrowRight, Plus,
  CheckCircle, Circle, FolderKanban,
} from "lucide-react";
import { db } from "@/lib/db";
import type { Task, ProjectV2, Submodule } from "@/lib/types";
import { getProjectsWithSubmodules, getSubmodulesByProject, getTasksBySubmodule } from "@/lib/db";
import { showToast } from "@/components/ui/Toast";

// ==================== 工具函数 ====================

function daysBetween(a: Date, b: Date): number {
  const oneDay = 24 * 60 * 60 * 1000;
  return Math.round((b.getTime() - a.getTime()) / oneDay);
}

const PROJECT_GRADIENTS = [
  "from-indigo-500 via-violet-500 to-purple-600",
  "from-emerald-500 via-teal-500 to-cyan-600",
  "from-rose-500 via-pink-500 to-fuchsia-600",
  "from-amber-500 via-orange-500 to-red-600",
  "from-sky-500 via-blue-500 to-indigo-600",
  "from-teal-500 via-green-500 to-emerald-600",
  "from-fuchsia-500 via-purple-500 to-violet-600",
  "from-blue-500 via-cyan-500 to-teal-600",
];

function getProjectGradient(index: number): string {
  return PROJECT_GRADIENTS[index % PROJECT_GRADIENTS.length];
}

// ==================== 焦点卡片 ====================

function FocusCard({
  focus,
  onClearFocus,
}: {
  focus: Task;
  onClearFocus: () => void;
}) {
  const router = useRouter();

  const now = new Date();
  let progress = 0;
  let countdown = 0;
  let countdownLabel = "";

  if (focus.startTime && focus.dueDate) {
    const totalDays = daysBetween(new Date(focus.startTime), new Date(focus.dueDate));
    const elapsed = daysBetween(new Date(focus.startTime), now);
    progress = totalDays > 0 ? Math.min(100, Math.max(0, Math.round((elapsed / totalDays) * 100))) : 0;
  }

  if (focus.dueDate) {
    countdown = daysBetween(now, new Date(focus.dueDate));
    if (countdown > 0) countdownLabel = `还有 ${countdown} 天`;
    else if (countdown === 0) countdownLabel = "今天截止";
    else countdownLabel = `已过期 ${Math.abs(countdown)} 天`;
  }

  const size = 72;
  const strokeWidth = 5;
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (progress / 100) * circumference;

  return (
    <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-indigo-500 via-violet-500 to-purple-600 shadow-lg shadow-indigo-500/20">
      <div className="absolute -top-12 -right-12 w-44 h-44 rounded-full bg-white/15 blur-2xl pointer-events-none" />
      <div className="absolute top-0 right-0 w-32 h-32 bg-gradient-to-bl from-white/20 to-transparent rounded-bl-full pointer-events-none" />

      <div className="relative z-10 flex items-center justify-between px-5 pt-5 md:px-6 md:pt-6">
        <div className="flex items-center gap-2">
          <Target className="w-4 h-4 text-white/80" strokeWidth={1.5} />
          <span className="text-xs font-medium text-white/80 uppercase tracking-wider">当前焦点</span>
        </div>
        <button onClick={onClearFocus} className="text-xs text-white/70 hover:text-white transition-colors">
          取消焦点
        </button>
      </div>

      <div className="relative z-10 flex flex-col md:flex-row items-start md:items-center gap-5 p-5 md:p-6">
        <div className="flex-1 min-w-0">
          <h2 className="text-xl md:text-2xl font-bold text-white mb-2">{focus.title}</h2>
          {focus.dueDate && (
            <div className="flex items-center gap-2 mb-3">
              <Calendar className="w-4 h-4 text-white/70" strokeWidth={1.5} />
              <span className="text-sm text-white/80">{countdownLabel}</span>
            </div>
          )}
          <div className="flex items-center gap-2">
            <Play className="w-4 h-4 text-white/70" strokeWidth={1.5} />
            <span className="text-sm text-white/80">{focus.note || "继续推进当前目标"}</span>
          </div>
        </div>

        {(focus.startTime && focus.dueDate) ? (
          <div className="relative flex-shrink-0">
            <svg width={size} height={size} className="-rotate-90">
              <circle cx={size / 2} cy={size / 2} r={radius} fill="none"
                stroke="currentColor" className="text-white/20" strokeWidth={strokeWidth} />
              <circle cx={size / 2} cy={size / 2} r={radius} fill="none"
                stroke="currentColor" className="text-white" strokeWidth={strokeWidth}
                strokeLinecap="round" strokeDasharray={circumference} strokeDashoffset={offset} />
            </svg>
            <div className="absolute inset-0 flex items-center justify-center">
              <span className="text-sm font-bold text-white">{progress}%</span>
            </div>
          </div>
        ) : (
          <div className="flex-shrink-0 flex items-center justify-center w-[72px] h-[72px] rounded-full bg-white/15">
            <Focus className="w-6 h-6 text-white/70" strokeWidth={1.5} />
          </div>
        )}
      </div>

      <div className="relative z-10 flex border-t border-white/15 divide-x divide-white/15">
        <button onClick={() => router.push("/focus")}
          className="flex-1 flex items-center justify-center gap-1.5 py-3 text-sm font-medium text-white/80 hover:text-white hover:bg-white/10 transition-colors">
          <Timer className="w-4 h-4" strokeWidth={1.5} /><span>记录专注</span>
        </button>
        <button onClick={() => router.push(`/planner?goalId=${focus.id}`)}
          className="flex-1 flex items-center justify-center gap-1.5 py-3 text-sm font-medium text-white/80 hover:text-white hover:bg-white/10 transition-colors">
          <ListChecks className="w-4 h-4" strokeWidth={1.5} /><span>查看计划</span>
        </button>
        <button onClick={() => router.push("/learning")}
          className="flex-1 flex items-center justify-center gap-1.5 py-3 text-sm font-medium text-white/80 hover:text-white hover:bg-white/10 transition-colors">
          <BookOpen className="w-4 h-4" strokeWidth={1.5} /><span>开始学习</span>
        </button>
      </div>
    </div>
  );
}

function EmptyFocusCard({ onSetFocus }: { onSetFocus: () => void }) {
  return (
    <div className="rounded-2xl bg-gradient-to-br from-indigo-500 via-violet-500 to-purple-600 p-8 md:p-10 flex flex-col items-center text-center shadow-lg shadow-indigo-500/20">
      <div className="w-14 h-14 rounded-full bg-white/20 backdrop-blur-sm flex items-center justify-center mb-4">
        <Target className="w-7 h-7 text-white" strokeWidth={1.5} />
      </div>
      <h3 className="text-lg font-semibold text-white mb-1">尚未设置焦点</h3>
      <p className="text-sm text-white/70 mb-5">选择一个目标作为当前焦点，追踪进度与倒计时</p>
      <button onClick={onSetFocus}
        className="px-5 py-2.5 rounded-xl bg-white text-indigo-600 text-sm font-medium hover:bg-white/90 transition-colors">
        选择焦点目标
      </button>
    </div>
  );
}

function FocusPicker({
  open,
  onClose,
  onSelect,
}: {
  open: boolean;
  onClose: () => void;
  onSelect: (task: Task) => void;
}) {
  const [goals, setGoals] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!open) return;
    const load = async () => {
      const all = await db.tasks
        .where("status").equals("active")
        .filter((t) => t.type === "longterm" || t.type === "shortterm" ||
          t.classification === "long-term" || t.classification === "short-term")
        .toArray();
      setGoals(all);
      setLoading(false);
    };
    load();
  }, [open]);

  const handleSelect = async (task: Task) => {
    const all = await db.tasks.toArray();
    const prevFocus = all.filter((t) => t.isFocus === true);
    for (const t of prevFocus) {
      await db.tasks.update(t.id!, { isFocus: false });
    }
    await db.tasks.update(task.id!, { isFocus: true });
    onSelect(task);
    onClose();
  };

  return (
    <AnimatePresence>
      {open && (
        <>
          <div className="fixed inset-0 bg-black/40 z-50" onClick={onClose} />
          <motion.div initial={{ y: "100%" }} animate={{ y: 0 }} exit={{ y: "100%" }}
            transition={{ type: "spring", stiffness: 400, damping: 40 }}
            className="fixed bottom-0 left-0 right-0 z-50 bg-white max-h-[70vh] flex flex-col rounded-t-2xl pb-[max(24px,env(safe-area-inset-bottom))]">
            <div className="flex items-center justify-between px-5 pt-4 pb-3 border-b border-gray-100">
              <h3 className="text-base font-semibold text-gray-900">选择焦点目标</h3>
              <button onClick={onClose} className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-gray-100">
                <X className="w-5 h-5 text-gray-400" />
              </button>
            </div>
            <div className="flex-1 overflow-y-auto px-3 py-2">
              {loading ? (
                <div className="py-8 text-center text-sm text-gray-400">加载中...</div>
              ) : goals.length === 0 ? (
                <div className="py-12 text-center">
                  <Target className="w-10 h-10 text-gray-300 mx-auto mb-3" strokeWidth={1.5} />
                  <p className="text-sm text-gray-500 mb-3">暂无活跃的长期/短期目标</p>
                  <button onClick={() => { onClose(); window.location.href = "/planner"; }}
                    className="text-sm text-blue-500 hover:text-blue-600">去规划页创建目标</button>
                </div>
              ) : (
                goals.map((goal) => (
                  <button key={goal.id} onClick={() => handleSelect(goal)}
                    className="w-full flex items-center gap-3 px-4 py-3 rounded-xl hover:bg-gray-50 transition-colors text-left">
                    <div className="w-9 h-9 rounded-lg bg-gray-100 flex items-center justify-center flex-shrink-0">
                      <Target className="w-4 h-4 text-gray-500" strokeWidth={1.5} />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium text-gray-900 truncate">{goal.title}</p>
                      <p className="text-xs text-gray-500">
                        {goal.dueDate ? `截止 ${new Date(goal.dueDate).toLocaleDateString("zh-CN")}` : "无截止日期"}
                      </p>
                    </div>
                    <ChevronRight className="w-4 h-4 text-gray-300 flex-shrink-0" />
                  </button>
                ))
              )}
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}

// ==================== 任务列表视图 ====================

function TaskListView({
  submodule,
  projectGradient,
  onBack,
}: {
  submodule: Submodule;
  projectGradient: string;
  onBack: () => void;
}) {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);

  const loadTasks = useCallback(async () => {
    setLoading(true);
    try {
      const list = await getTasksBySubmodule(submodule.id!);
      // Sort: active first, then by createdAt
      list.sort((a, b) => {
        if (a.status === "done" && b.status !== "done") return 1;
        if (a.status !== "done" && b.status === "done") return -1;
        return (b.createdAt || 0) - (a.createdAt || 0);
      });
      setTasks(list);
    } catch (err) {
      console.error("Failed to load tasks:", err);
    } finally {
      setLoading(false);
    }
  }, [submodule.id]);

  useEffect(() => { loadTasks(); }, [loadTasks]);

  const handleToggleTask = async (task: Task) => {
    if (!task.id) return;
    const newStatus: Task["status"] = task.status === "done" ? "active" : "done";
    await db.tasks.update(task.id, { status: newStatus, updatedAt: Date.now() });
    showToast({
      message: newStatus === "done" ? "任务已完成" : "任务已恢复",
      type: newStatus === "done" ? "success" : "info",
    });
    await loadTasks();
  };

  return (
    <div>
      {/* 返回栏 */}
      <button onClick={onBack}
        className="flex items-center gap-2 text-sm text-gray-500 hover:text-gray-700 mb-4 transition-colors">
        <ChevronRight className="w-4 h-4 rotate-180" />
        <span>返回</span>
      </button>

      {/* 子模块标题 */}
      <div className={`rounded-2xl bg-gradient-to-br ${projectGradient} p-4 mb-4 shadow-sm`}>
        <h3 className="text-lg font-bold text-white">{submodule.name}</h3>
        {submodule.description && (
          <p className="text-sm text-white/70 mt-1">{submodule.description}</p>
        )}
      </div>

      {loading ? (
        <div className="space-y-2">
          {[1, 2, 3].map((i) => (
            <div key={i} className="skeleton h-14 rounded-xl" />
          ))}
        </div>
      ) : tasks.length === 0 ? (
        <div className="text-center py-12">
          <ListChecks className="w-10 h-10 text-gray-300 mx-auto mb-3" strokeWidth={1.5} />
          <p className="text-sm text-gray-500 mb-1">暂无任务</p>
          <p className="text-xs text-gray-400">在规划页中将任务关联到此子模块</p>
        </div>
      ) : (
        <div className="space-y-1.5">
          {tasks.map((task) => (
            <motion.button
              key={task.id}
              whileTap={{ scale: 0.98 }}
              onClick={() => handleToggleTask(task)}
              className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl text-left transition-colors ${
                task.status === "done"
                  ? "bg-gray-50 text-gray-400"
                  : "bg-white border border-gray-100 hover:bg-gray-50"
              }`}
            >
              <span className="flex-shrink-0">
                {task.status === "done" ? (
                  <CheckCircle className="w-5 h-5 text-emerald-500" strokeWidth={1.5} />
                ) : (
                  <Circle className="w-5 h-5 text-gray-300" strokeWidth={1.5} />
                )}
              </span>
              <span className={`flex-1 text-sm ${task.status === "done" ? "line-through" : "font-medium text-gray-900"}`}>
                {task.title}
              </span>
              {task.dueDate && task.status !== "done" && (
                <span className="text-xs text-gray-400">
                  {new Date(task.dueDate).toLocaleDateString("zh-CN", { month: "short", day: "numeric" })}
                </span>
              )}
            </motion.button>
          ))}
        </div>
      )}
    </div>
  );
}

// ==================== 主页面 ====================

export default function OverviewPage() {
  const [projects, setProjects] = useState<ProjectV2[]>([]);
  const [submodules, setSubmodules] = useState<Submodule[]>([]);
  const [selectedProjectId, setSelectedProjectId] = useState<number | null>(null);
  const [selectedSubmodule, setSelectedSubmodule] = useState<Submodule | null>(null);
  const [loading, setLoading] = useState(true);

  // 焦点
  const [focus, setFocus] = useState<Task | null>(null);
  const [loadingFocus, setLoadingFocus] = useState(true);
  const [pickerOpen, setPickerOpen] = useState(false);

  // 加载项目列表
  useEffect(() => {
    const load = async () => {
      try {
        const list = await getProjectsWithSubmodules();
        setProjects(list);
        if (list.length > 0) {
          setSelectedProjectId(list[0].id!);
        }
      } catch (err) {
        console.error("Failed to load projects:", err);
      } finally {
        setLoading(false);
      }
    };
    load();
  }, []);

  // 项目变更时加载子模块
  useEffect(() => {
    if (selectedProjectId === null) {
      setSubmodules([]);
      return;
    }
    getSubmodulesByProject(selectedProjectId).then(setSubmodules);
  }, [selectedProjectId]);

  // 加载焦点
  const loadFocus = useCallback(async () => {
    try {
      const all = await db.tasks.toArray();
      const focused = all.filter((t) => t.isFocus === true && t.status !== "archived");
      setFocus(focused[0] || null);
    } catch (err) {
      console.error("Failed to load focus:", err);
    } finally {
      setLoadingFocus(false);
    }
  }, []);

  useEffect(() => { loadFocus(); }, [loadFocus]);

  const handleClearFocus = async () => {
    if (focus?.id) {
      await db.tasks.update(focus.id, { isFocus: false });
      setFocus(null);
    }
  };

  const selectedProject = projects.find((p) => p.id === selectedProjectId) ?? null;
  const projectIndex = projects.findIndex((p) => p.id === selectedProjectId);
  const projectGradient = getProjectGradient(projectIndex >= 0 ? projectIndex : 0);

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="mx-auto max-w-5xl px-5 pt-6 pb-24 md:px-8 md:pt-10">
        {/* 头部 */}
        <div className="mb-6">
          <h1 className="text-xl font-bold text-gray-900">总览</h1>
          <p className="text-sm text-gray-500 mt-1">聚焦当前目标，管理各项目子模块</p>
        </div>

        {/* 焦点卡片 */}
        <div className="mb-8">
          {loadingFocus ? (
            <div className="rounded-2xl bg-white border border-gray-200 p-10 flex items-center justify-center">
              <div className="w-5 h-5 border-2 border-gray-300 border-t-gray-600 rounded-full animate-spin" />
            </div>
          ) : focus ? (
            <FocusCard focus={focus} onClearFocus={handleClearFocus} />
          ) : (
            <EmptyFocusCard onSetFocus={() => setPickerOpen(true)} />
          )}
        </div>

        {/* 项目选项卡 */}
        {loading ? (
          <div className="space-y-4">
            <div className="skeleton h-10 w-full rounded-xl" />
            <div className="grid grid-cols-2 gap-3">
              {[1, 2, 3, 4].map((i) => (
                <div key={i} className="skeleton h-20 rounded-2xl" />
              ))}
            </div>
          </div>
        ) : selectedSubmodule ? (
          /* 任务列表视图 */
          <TaskListView
            submodule={selectedSubmodule}
            projectGradient={projectGradient}
            onBack={() => setSelectedSubmodule(null)}
          />
        ) : (
          <>
            {/* 项目选项卡 */}
            <div className="flex gap-2 overflow-x-auto pb-2 mb-5 scrollbar-hide">
              {projects.map((proj, i) => {
                const grad = getProjectGradient(i);
                const isSelected = selectedProjectId === proj.id;
                return (
                  <button
                    key={proj.id}
                    onClick={() => setSelectedProjectId(proj.id!)}
                    className={`shrink-0 px-4 py-2 text-sm font-medium rounded-xl transition-all ${
                      isSelected
                        ? `bg-gradient-to-r ${grad} text-white shadow-sm`
                        : "bg-gray-100 text-gray-700 hover:bg-gray-200"
                    }`}
                  >
                    <span className="flex items-center gap-1.5">
                      <FolderKanban className="w-3.5 h-3.5" strokeWidth={2} />
                      {proj.name}
                    </span>
                  </button>
                );
              })}
            </div>

            {/* 子模块列表 */}
            {submodules.length === 0 ? (
              <div className="text-center py-16">
                <FolderKanban className="w-10 h-10 text-gray-300 mx-auto mb-3" strokeWidth={1.5} />
                <p className="text-sm text-gray-500 mb-1">暂无子模块</p>
                <p className="text-xs text-gray-400">在设置中为该项目添加子模块</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <AnimatePresence mode="popLayout">
                  {submodules.map((sm) => (
                    <motion.button
                      key={sm.id}
                      layout
                      initial={{ opacity: 0, y: 12 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, scale: 0.95 }}
                      transition={{ duration: 0.25 }}
                      whileTap={{ scale: 0.97 }}
                      onClick={() => setSelectedSubmodule(sm)}
                      className={`group relative overflow-hidden rounded-2xl bg-gradient-to-br ${projectGradient} p-5 text-left text-white shadow-md hover:shadow-lg transition-shadow`}
                    >
                      <div className="absolute top-0 right-0 w-16 h-16 bg-gradient-to-bl from-white/10 to-transparent rounded-bl-full pointer-events-none" />
                      <div className="relative z-10">
                        <h3 className="text-base font-bold">{sm.name}</h3>
                        {sm.description && (
                          <p className="text-sm text-white/65 mt-1">{sm.description}</p>
                        )}
                        <div className="flex items-center gap-1 mt-3 text-white/50 text-xs">
                          <span>查看任务</span>
                          <ArrowRight className="w-3 h-3 group-hover:translate-x-0.5 transition-transform" />
                        </div>
                      </div>
                    </motion.button>
                  ))}
                </AnimatePresence>
              </div>
            )}
          </>
        )}
      </div>

      {/* 焦点选择器 */}
      <FocusPicker open={pickerOpen} onClose={() => setPickerOpen(false)}
        onSelect={(task) => { setFocus(task); }} />
    </div>
  );
}
