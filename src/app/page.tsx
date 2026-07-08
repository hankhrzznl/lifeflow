"use client";

import { useEffect, useState, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  LayoutGrid, ArrowRight, FolderKanban, ChevronRight,
  CheckCircle, Circle, ListChecks,
} from "lucide-react";
import { db } from "@/lib/db";
import type { Task, ProjectV2, Submodule } from "@/lib/types";
import { getProjectsWithSubmodules, getSubmodulesByProject, getTasksBySubmodule } from "@/lib/db";
import { showToast } from "@/components/ui/Toast";
import OverviewHeader from "@/components/layout/OverviewHeader";
import QuickCaptureBar from "@/components/layout/QuickCaptureBar";
import CaptureInbox from "@/components/layout/CaptureInbox";

// ==================== 工具 ====================

const PROJECT_GRADIENTS = [
  "from-indigo-400 via-violet-400 to-purple-500",
  "from-emerald-400 via-teal-400 to-cyan-500",
  "from-rose-400 via-pink-400 to-fuchsia-500",
  "from-sky-400 via-cyan-400 to-blue-500",
  "from-amber-400 via-orange-400 to-red-500",
  "from-teal-400 via-green-400 to-emerald-500",
  "from-fuchsia-400 via-purple-400 to-violet-500",
  "from-blue-400 via-indigo-400 to-violet-500",
];

function getProjectGradient(index: number): string {
  return PROJECT_GRADIENTS[index % PROJECT_GRADIENTS.length];
}

// ==================== 项目卡片 ====================

function ProjectCard({
  project,
  index,
  submoduleCount,
  submoduleNames,
  onEnter,
}: {
  project: ProjectV2;
  index: number;
  submoduleCount: number;
  submoduleNames: string[];
  onEnter: () => void;
}) {
  const gradient = getProjectGradient(index);

  return (
    <motion.button
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.08, duration: 0.4, ease: "easeOut" }}
      whileTap={{ scale: 0.98 }}
      onClick={onEnter}
      className={`group relative overflow-hidden rounded-3xl bg-gradient-to-br ${gradient} p-6 md:p-7 text-left text-white shadow-lg shadow-slate-200/60 min-h-[200px] md:min-h-[240px] flex flex-col`}
    >
      {/* 右上角装饰光晕 */}
      <div className="absolute -top-12 -right-12 w-44 h-44 rounded-full bg-white/15 blur-2xl pointer-events-none" />
      <div className="absolute top-0 right-0 w-32 h-32 bg-gradient-to-bl from-white/20 to-transparent rounded-bl-full pointer-events-none" />

      <div className="relative z-10 flex flex-col h-full">
        {/* 图标方块 */}
        <div className="w-12 h-12 md:w-14 md:h-14 rounded-2xl bg-white/25 backdrop-blur-sm flex items-center justify-center mb-5">
          <FolderKanban className="w-6 h-6 md:w-7 md:h-7 text-white" strokeWidth={1.8} />
        </div>

        <h2 className="text-2xl md:text-3xl font-bold mb-1.5">{project.name}</h2>
        <p className="text-white/80 text-sm md:text-base mb-4">
          {submoduleCount > 0 ? `${submoduleCount} 个子模块` : "暂无子模块"}
        </p>

        {/* 标签 */}
        {submoduleNames.length > 0 && (
          <div className="flex flex-wrap gap-2 mb-5">
            {submoduleNames.slice(0, 4).map((name) => (
              <span
                key={name}
                className="px-3 py-1 rounded-full text-xs font-medium bg-white/20 backdrop-blur-sm border border-white/20"
              >
                {name}
              </span>
            ))}
            {submoduleNames.length > 4 && (
              <span className="px-3 py-1 rounded-full text-xs font-medium bg-white/20 backdrop-blur-sm border border-white/20">
                +{submoduleNames.length - 4}
              </span>
            )}
          </div>
        )}

        {/* 进入 */}
        <div className="mt-auto flex items-center gap-1.5 text-sm font-medium text-white/90 group-hover:translate-x-1 transition-transform">
          <span>进入</span>
          <ArrowRight className="w-4 h-4" strokeWidth={2} />
        </div>
      </div>
    </motion.button>
  );
}

// ==================== 子模块视图 ====================

function SubmoduleView({
  project,
  projectIndex,
  onBack,
}: {
  project: ProjectV2;
  projectIndex: number;
  onBack: () => void;
}) {
  const [submodules, setSubmodules] = useState<Submodule[]>([]);
  const [selectedSubmodule, setSelectedSubmodule] = useState<Submodule | null>(null);
  const [loading, setLoading] = useState(true);
  const gradient = getProjectGradient(projectIndex);

  useEffect(() => {
    getSubmodulesByProject(project.id!).then((list) => {
      setSubmodules(list);
      setLoading(false);
    });
  }, [project.id]);

  if (selectedSubmodule) {
    return (
      <TaskListView
        submodule={selectedSubmodule}
        gradient={gradient}
        onBack={() => setSelectedSubmodule(null)}
      />
    );
  }

  return (
    <div>
      {/* 返回 + 项目标题 */}
      <div className="flex items-center gap-3 mb-6">
        <button onClick={onBack}
          className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-gray-100 transition-colors">
          <ChevronRight className="w-5 h-5 text-gray-400 rotate-180" />
        </button>
        <div>
          <h1 className="text-xl font-bold text-gray-900">{project.name}</h1>
        </div>
      </div>

      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          {[1, 2].map((i) => (
            <div key={i} className="skeleton h-48 rounded-3xl" />
          ))}
        </div>
      ) : submodules.length === 0 ? (
        <div className="text-center py-16">
          <FolderKanban className="w-10 h-10 text-gray-300 mx-auto mb-3" strokeWidth={1.5} />
          <p className="text-sm text-gray-500 mb-1">暂无子模块</p>
          <p className="text-xs text-gray-400">在设置中为该项目添加子模块</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-5 md:gap-6">
          {submodules.map((sm, i) => (
            <motion.button
              key={sm.id}
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.06, duration: 0.35 }}
              whileTap={{ scale: 0.98 }}
              onClick={() => setSelectedSubmodule(sm)}
              className={`group relative overflow-hidden rounded-3xl bg-gradient-to-br ${gradient} p-6 md:p-7 text-left text-white shadow-lg shadow-slate-200/60 min-h-[180px] md:min-h-[200px] flex flex-col`}
            >
              <div className="absolute -top-12 -right-12 w-44 h-44 rounded-full bg-white/15 blur-2xl pointer-events-none" />
              <div className="absolute top-0 right-0 w-32 h-32 bg-gradient-to-bl from-white/20 to-transparent rounded-bl-full pointer-events-none" />

              <div className="relative z-10 flex flex-col h-full">
                <div className="w-12 h-12 md:w-14 md:h-14 rounded-2xl bg-white/25 backdrop-blur-sm flex items-center justify-center mb-4">
                  <LayoutGrid className="w-6 h-6 md:w-7 md:h-7 text-white" strokeWidth={1.8} />
                </div>
                <h2 className="text-2xl md:text-3xl font-bold mb-1.5">{sm.name}</h2>
                {sm.description && (
                  <p className="text-white/80 text-sm md:text-base">{sm.description}</p>
                )}
                <div className="mt-auto pt-4 flex items-center gap-1.5 text-sm font-medium text-white/90 group-hover:translate-x-1 transition-transform">
                  <span>查看任务</span>
                  <ArrowRight className="w-4 h-4" strokeWidth={2} />
                </div>
              </div>
            </motion.button>
          ))}
        </div>
      )}
    </div>
  );
}

// ==================== 任务列表视图 ====================

function TaskListView({
  submodule,
  gradient,
  onBack,
}: {
  submodule: Submodule;
  gradient: string;
  onBack: () => void;
}) {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);

  const loadTasks = useCallback(async () => {
    setLoading(true);
    try {
      const list = await getTasksBySubmodule(submodule.id!);
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
      {/* 返回按钮 */}
      <button onClick={onBack}
        className="flex items-center gap-2 text-sm text-gray-500 hover:text-gray-700 mb-4 transition-colors">
        <ChevronRight className="w-4 h-4 rotate-180" />
        <span>返回</span>
      </button>

      {/* 标题卡片 */}
      <div className={`rounded-2xl bg-gradient-to-br ${gradient} p-5 mb-5 shadow-sm`}>
        <h3 className="text-xl font-bold text-white">{submodule.name}</h3>
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
        <div className="text-center py-16">
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

export default function HomePage() {
  const [projects, setProjects] = useState<ProjectV2[]>([]);
  const [projectSubmodules, setProjectSubmodules] = useState<Record<number, Submodule[]>>({});
  const [loading, setLoading] = useState(true);
  const [selectedProject, setSelectedProject] = useState<ProjectV2 | null>(null);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [inboxExpanded, setInboxExpanded] = useState(false);

  useEffect(() => {
    const load = async () => {
      try {
        const list = await getProjectsWithSubmodules();
        setProjects(list);

        // 预加载每个项目的子模块名（用于标签展示）
        const map: Record<number, Submodule[]> = {};
        for (const proj of list) {
          const subs = await getSubmodulesByProject(proj.id!);
          map[proj.id!] = subs;
        }
        setProjectSubmodules(map);
      } catch (err) {
        console.error("Failed to load projects:", err);
      } finally {
        setLoading(false);
      }
    };
    load();
  }, []);

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-50 to-white dark:from-gray-950 dark:to-gray-900 text-slate-900 dark:text-white">
      <div className="mx-auto max-w-5xl px-5 pt-8 pb-24 md:px-8 md:pt-10">
        {/* 顶部日期栏 + 图标组 */}
        <OverviewHeader />

        {/* 内容区 */}
        {loading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-5 md:gap-6">
            {[1, 2, 3, 4].map((i) => (
              <div key={i} className="skeleton h-[240px] rounded-3xl" />
            ))}
          </div>
        ) : selectedProject ? (
          <AnimatePresence mode="wait">
            <motion.div
              key="submodule-view"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              transition={{ duration: 0.25 }}
            >
              <SubmoduleView
                project={selectedProject}
                projectIndex={selectedIndex}
                onBack={() => setSelectedProject(null)}
              />
            </motion.div>
          </AnimatePresence>
        ) : projects.length === 0 ? (
          <div className="text-center py-16">
            <FolderKanban className="w-10 h-10 text-gray-300 mx-auto mb-3" strokeWidth={1.5} />
            <p className="text-sm text-gray-500 mb-1">暂无项目</p>
            <p className="text-xs text-gray-400">
              在规划页中创建项目，它们将自动显示在这里
            </p>
          </div>
        ) : (
          <AnimatePresence mode="wait">
            <motion.div
              key="project-grid"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.2 }}
            >
              <div className="grid grid-cols-1 md:grid-cols-2 gap-5 md:gap-6">
                {projects.map((proj, i) => {
                  const subs = projectSubmodules[proj.id!] || [];
                  return (
                    <ProjectCard
                      key={proj.id}
                      project={proj}
                      index={i}
                      submoduleCount={subs.length}
                      submoduleNames={subs.map((s) => s.name)}
                      onEnter={() => {
                        setSelectedProject(proj);
                        setSelectedIndex(i);
                      }}
                    />
                  );
                })}
              </div>
            </motion.div>
          </AnimatePresence>
        )}

        {/* 底部提示 */}
        {!selectedProject && !loading && projects.length > 0 && (
          <p className="mt-8 text-center text-sm text-slate-400 dark:text-gray-500">
            选择一个项目，开始管理你的生活
          </p>
        )}

        {/* 快速捕捉栏 */}
        <div className="mt-6">
          <QuickCaptureBar
            inboxExpanded={inboxExpanded}
            onToggleInbox={() => setInboxExpanded((v) => !v)}
          />
          <CaptureInbox visible={inboxExpanded} />
        </div>
      </div>
    </div>
  );
}
