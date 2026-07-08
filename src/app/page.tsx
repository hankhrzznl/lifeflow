"use client";

import { useEffect, useState, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  LayoutGrid, ArrowRight, FolderKanban, ChevronRight,
  CheckCircle, Circle, ListChecks, Layers, ChevronDown,
} from "lucide-react";
import { db } from "@/lib/db";
import type { Task, ProjectV2, Board, BoardStage, Section } from "@/lib/types";
import { getAllProjectsV2, getBoardsByProject, getSectionsByBoard, getTasksBySection } from "@/lib/db";
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
  boardCount,
  boardNames,
  onEnter,
}: {
  project: ProjectV2;
  index: number;
  boardCount: number;
  boardNames: string[];
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
      <div className="absolute -top-12 -right-12 w-44 h-44 rounded-full bg-white/15 blur-2xl pointer-events-none" />
      <div className="absolute top-0 right-0 w-32 h-32 bg-gradient-to-bl from-white/20 to-transparent rounded-bl-full pointer-events-none" />

      <div className="relative z-10 flex flex-col h-full">
        <div className="w-12 h-12 md:w-14 md:h-14 rounded-2xl bg-white/25 backdrop-blur-sm flex items-center justify-center mb-5">
          <FolderKanban className="w-6 h-6 md:w-7 md:h-7 text-white" strokeWidth={1.8} />
        </div>

        <h2 className="text-2xl md:text-3xl font-bold mb-1.5">{project.name}</h2>
        <p className="text-white/80 text-sm md:text-base mb-4">
          {boardCount > 0 ? `${boardCount} 个大模块` : "暂无大模块"}
        </p>

        {boardNames.length > 0 && (
          <div className="flex flex-wrap gap-2 mb-5">
            {boardNames.slice(0, 4).map((name) => (
              <span
                key={name}
                className="px-3 py-1 rounded-full text-xs font-medium bg-white/20 backdrop-blur-sm border border-white/20"
              >
                {name}
              </span>
            ))}
            {boardNames.length > 4 && (
              <span className="px-3 py-1 rounded-full text-xs font-medium bg-white/20 backdrop-blur-sm border border-white/20">
                +{boardNames.length - 4}
              </span>
            )}
          </div>
        )}

        <div className="mt-auto flex items-center gap-1.5 text-sm font-medium text-white/90 group-hover:translate-x-1 transition-transform">
          <span>进入</span>
          <ArrowRight className="w-4 h-4" strokeWidth={2} />
        </div>
      </div>
    </motion.button>
  );
}

// ==================== 大模块列表视图 ====================

function BoardListView({
  project,
  projectIndex,
  onBack,
}: {
  project: ProjectV2;
  projectIndex: number;
  onBack: () => void;
}) {
  const [boards, setBoards] = useState<Board[]>([]);
  const [selectedBoard, setSelectedBoard] = useState<Board | null>(null);
  const [loading, setLoading] = useState(true);
  const gradient = getProjectGradient(projectIndex);

  useEffect(() => {
    getBoardsByProject(project.id!).then((list) => {
      setBoards(list);
      setLoading(false);
    });
  }, [project.id]);

  if (selectedBoard) {
    return (
      <BoardDetailView
        board={selectedBoard}
        projectColor={project.color || "#007AFF"}
        gradient={gradient}
        onBack={() => setSelectedBoard(null)}
      />
    );
  }

  return (
    <div>
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
      ) : boards.length === 0 ? (
        <div className="text-center py-16">
          <FolderKanban className="w-10 h-10 text-gray-300 mx-auto mb-3" strokeWidth={1.5} />
          <p className="text-sm text-gray-500 mb-1">暂无大模块</p>
          <p className="text-xs text-gray-400">在规划页中为该项目添加大模块</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-5 md:gap-6">
          {boards.map((board, i) => (
            <motion.button
              key={board.id}
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.06, duration: 0.35 }}
              whileTap={{ scale: 0.98 }}
              onClick={() => setSelectedBoard(board)}
              className={`group relative overflow-hidden rounded-3xl bg-gradient-to-br ${gradient} p-6 md:p-7 text-left text-white shadow-lg shadow-slate-200/60 min-h-[180px] md:min-h-[200px] flex flex-col`}
            >
              <div className="absolute -top-12 -right-12 w-44 h-44 rounded-full bg-white/15 blur-2xl pointer-events-none" />
              <div className="absolute top-0 right-0 w-32 h-32 bg-gradient-to-bl from-white/20 to-transparent rounded-bl-full pointer-events-none" />

              <div className="relative z-10 flex flex-col h-full">
                <div className="w-12 h-12 md:w-14 md:h-14 rounded-2xl bg-white/25 backdrop-blur-sm flex items-center justify-center mb-4">
                  <FolderKanban className="w-6 h-6 md:w-7 md:h-7 text-white" strokeWidth={1.8} />
                </div>
                <h2 className="text-2xl md:text-3xl font-bold mb-1.5">{board.name}</h2>
                <p className="text-white/80 text-sm md:text-base">
                  {(board.stages || []).length > 0 ? `${(board.stages || []).length} 个阶段` : "暂无阶段"}
                </p>
                <div className="mt-auto pt-4 flex items-center gap-1.5 text-sm font-medium text-white/90 group-hover:translate-x-1 transition-transform">
                  <span>查看详情</span>
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

// ==================== 大模块详情视图（阶段 → 子模块 → 任务） ====================

function BoardDetailView({
  board,
  projectColor,
  gradient,
  onBack,
}: {
  board: Board;
  projectColor: string;
  gradient: string;
  onBack: () => void;
}) {
  const [sections, setSections] = useState<Section[]>([]);
  const [tasksBySection, setTasksBySection] = useState<Map<number, Task[]>>(new Map());
  const [loading, setLoading] = useState(true);
  const [expandedStages, setExpandedStages] = useState<Set<number>>(new Set());

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      try {
        const secs = await getSectionsByBoard(board.id!);
        setSections(secs);

        const taskMap = new Map<number, Task[]>();
        for (const sec of secs) {
          const tasks = await getTasksBySection(sec.id!);
          tasks.sort((a, b) => {
            if (a.status === "done" && b.status !== "done") return 1;
            if (a.status !== "done" && b.status === "done") return -1;
            return (b.createdAt || 0) - (a.createdAt || 0);
          });
          taskMap.set(sec.id!, tasks);
        }
        setTasksBySection(taskMap);

        // Auto-expand first stage
        const stages = board.stages || [];
        if (stages.length > 0) {
          setExpandedStages(new Set([0]));
        }
      } catch (err) {
        console.error("Failed to load board detail:", err);
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [board.id]);

  const handleToggleTask = useCallback(async (task: Task) => {
    if (!task.id) return;
    const newStatus: Task["status"] = task.status === "done" ? "active" : "done";
    await db.tasks.update(task.id, { status: newStatus, updatedAt: Date.now() });
    showToast({
      message: newStatus === "done" ? "任务已完成" : "任务已恢复",
      type: newStatus === "done" ? "success" : "info",
    });
    setTasksBySection((prev) => {
      const next = new Map(prev);
      for (const [sid, taskList] of next) {
        next.set(
          sid,
          taskList.map((t) => (t.id === task.id ? { ...t, status: newStatus } : t))
        );
      }
      return next;
    });
  }, []);

  const toggleStage = (stageIdx: number) => {
    setExpandedStages((prev) => {
      const next = new Set(prev);
      if (next.has(stageIdx)) next.delete(stageIdx);
      else next.add(stageIdx);
      return next;
    });
  };

  const stages = board.stages || [];
  const hasStages = stages.length > 0;

  // Count total tasks
  let totalTasks = 0;
  for (const taskList of tasksBySection.values()) {
    totalTasks += taskList.length;
  }

  return (
    <div>
      <button onClick={onBack}
        className="flex items-center gap-2 text-sm text-gray-500 hover:text-gray-700 mb-4 transition-colors">
        <ChevronRight className="w-4 h-4 rotate-180" />
        <span>返回大模块列表</span>
      </button>

      <div className={`rounded-2xl bg-gradient-to-br ${gradient} p-5 mb-5 shadow-sm`}>
        <h3 className="text-xl font-bold text-white">{board.name}</h3>
        <p className="text-sm text-white/70 mt-1">
          {sections.length} 个子模块 · {totalTasks} 个任务
          {hasStages ? ` · ${stages.length} 个阶段` : ""}
        </p>
      </div>

      {loading ? (
        <div className="space-y-3">
          {[1, 2, 3].map((i) => (
            <div key={i} className="skeleton h-24 rounded-2xl" />
          ))}
        </div>
      ) : sections.length === 0 ? (
        <div className="text-center py-16">
          <Layers className="w-10 h-10 text-gray-300 mx-auto mb-3" strokeWidth={1.5} />
          <p className="text-sm text-gray-500 mb-1">暂无子模块</p>
          <p className="text-xs text-gray-400">在规划页中为该大模块添加子模块</p>
        </div>
      ) : hasStages ? (
        /* Grouped by stage */
        <div className="space-y-4">
          {stages.map((stage, stageIdx) => {
            const stageSections = sections.filter((s) => (s.stageIndex ?? 0) === stageIdx);
            const isExpanded = expandedStages.has(stageIdx);

            return (
              <div key={stageIdx} className="rounded-2xl bg-white border border-gray-100 overflow-hidden">
                <button
                  onClick={() => toggleStage(stageIdx)}
                  className="w-full flex items-center gap-3 px-4 py-3 hover:bg-gray-50 transition-colors"
                >
                  {isExpanded ? (
                    <ChevronDown className="w-4 h-4 text-gray-400 flex-shrink-0" />
                  ) : (
                    <ChevronRight className="w-4 h-4 text-gray-400 flex-shrink-0" />
                  )}
                  <div
                    className="w-3 h-3 rounded-full flex-shrink-0"
                    style={{ backgroundColor: projectColor }}
                  />
                  <span className="flex-1 text-sm font-semibold text-gray-900 text-left">{stage.name}</span>
                  <span className="text-xs text-gray-400">{stageSections.length} 子模块</span>
                </button>

                <AnimatePresence>
                  {isExpanded && (
                    <motion.div
                      initial={{ height: 0 }}
                      animate={{ height: "auto" }}
                      exit={{ height: 0 }}
                      className="overflow-hidden"
                    >
                      {stage.achievements.length > 0 && (
                        <div className="px-4 pb-2 space-y-0.5">
                          {stage.achievements.map((ach, ai) => (
                            <div key={ai} className="flex items-center gap-2 pl-8 text-xs text-indigo-500">
                              <CheckCircle className="w-3.5 h-3.5 flex-shrink-0" />
                              {ach}
                            </div>
                          ))}
                        </div>
                      )}

                      {stageSections.length === 0 ? (
                        <p className="px-4 pb-3 pl-12 text-xs text-gray-400">暂无子模块</p>
                      ) : (
                        <div className="border-t border-gray-50">
                          {stageSections.map((section) => {
                            const sectionTasks = tasksBySection.get(section.id!) || [];
                            return (
                              <div key={section.id} className="border-b border-gray-50 last:border-0">
                                <div className="flex items-center gap-3 px-4 py-2.5 pl-12 bg-gray-50/50">
                                  <Layers className="w-3.5 h-3.5 text-amber-400 flex-shrink-0" />
                                  <span className="text-xs font-medium text-gray-700">{section.name}</span>
                                  <span className="text-xs text-gray-400">{sectionTasks.length} 任务</span>
                                </div>
                                {sectionTasks.length > 0 && (
                                  <div className="pb-1">
                                    {sectionTasks.map((task) => (
                                      <motion.button
                                        key={task.id}
                                        whileTap={{ scale: 0.98 }}
                                        onClick={() => handleToggleTask(task)}
                                        className={`w-full flex items-center gap-3 px-4 py-2 pl-16 text-left transition-colors ${
                                          task.status === "done"
                                            ? "text-gray-400"
                                            : "hover:bg-gray-50"
                                        }`}
                                      >
                                        {task.status === "done" ? (
                                          <CheckCircle className="w-4 h-4 text-emerald-500 flex-shrink-0" strokeWidth={1.5} />
                                        ) : (
                                          <Circle className="w-4 h-4 text-gray-300 flex-shrink-0" strokeWidth={1.5} />
                                        )}
                                        <span className={`flex-1 text-xs ${task.status === "done" ? "line-through" : "text-gray-700"}`}>
                                          {task.title}
                                        </span>
                                        {task.dueDate && task.status !== "done" && (
                                          <span className="text-xs text-gray-400 flex-shrink-0">
                                            {new Date(task.dueDate).toLocaleDateString("zh-CN", { month: "short", day: "numeric" })}
                                          </span>
                                        )}
                                      </motion.button>
                                    ))}
                                  </div>
                                )}
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            );
          })}

          {/* Unassigned sections */}
          {(() => {
            const unassigned = sections.filter((s) => (s.stageIndex ?? 0) >= stages.length);
            if (unassigned.length === 0) return null;
            return (
              <div className="rounded-2xl bg-white border border-gray-100 overflow-hidden">
                <div className="flex items-center gap-3 px-4 py-3">
                  <Layers className="w-4 h-4 text-gray-300 flex-shrink-0" />
                  <span className="text-sm text-gray-400">未归属阶段</span>
                  <span className="text-xs text-gray-400">{unassigned.length} 子模块</span>
                </div>
                <div className="border-t border-gray-50">
                  {unassigned.map((section) => {
                    const sectionTasks = tasksBySection.get(section.id!) || [];
                    return (
                      <div key={section.id} className="border-b border-gray-50 last:border-0">
                        <div className="flex items-center gap-3 px-4 py-2.5 pl-12 bg-gray-50/50">
                          <Layers className="w-3.5 h-3.5 text-amber-400 flex-shrink-0" />
                          <span className="text-xs font-medium text-gray-700">{section.name}</span>
                          <span className="text-xs text-gray-400">{sectionTasks.length} 任务</span>
                        </div>
                        {sectionTasks.map((task) => (
                          <motion.button
                            key={task.id}
                            whileTap={{ scale: 0.98 }}
                            onClick={() => handleToggleTask(task)}
                            className={`w-full flex items-center gap-3 px-4 py-2 pl-16 text-left transition-colors ${
                              task.status === "done" ? "text-gray-400" : "hover:bg-gray-50"
                            }`}
                          >
                            {task.status === "done" ? (
                              <CheckCircle className="w-4 h-4 text-emerald-500 flex-shrink-0" strokeWidth={1.5} />
                            ) : (
                              <Circle className="w-4 h-4 text-gray-300 flex-shrink-0" strokeWidth={1.5} />
                            )}
                            <span className={`flex-1 text-xs ${task.status === "done" ? "line-through" : "text-gray-700"}`}>
                              {task.title}
                            </span>
                          </motion.button>
                        ))}
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })()}
        </div>
      ) : (
        /* No stages — flat list */
        <div className="space-y-2">
          {sections.map((section) => {
            const sectionTasks = tasksBySection.get(section.id!) || [];
            return (
              <div key={section.id} className="rounded-2xl bg-white border border-gray-100 overflow-hidden">
                <div className="flex items-center gap-3 px-4 py-3 bg-gray-50/50">
                  <Layers className="w-4 h-4 text-amber-400 flex-shrink-0" />
                  <span className="flex-1 text-sm font-semibold text-gray-900">{section.name}</span>
                  <span className="text-xs text-gray-400">{sectionTasks.length} 任务</span>
                </div>
                {sectionTasks.length === 0 ? (
                  <p className="px-4 py-3 pl-12 text-xs text-gray-400">暂无任务</p>
                ) : (
                  <div>
                    {sectionTasks.map((task) => (
                      <motion.button
                        key={task.id}
                        whileTap={{ scale: 0.98 }}
                        onClick={() => handleToggleTask(task)}
                        className={`w-full flex items-center gap-3 px-4 py-2.5 pl-12 text-left transition-colors border-t border-gray-50 ${
                          task.status === "done" ? "text-gray-400" : "hover:bg-gray-50"
                        }`}
                      >
                        {task.status === "done" ? (
                          <CheckCircle className="w-4 h-4 text-emerald-500 flex-shrink-0" strokeWidth={1.5} />
                        ) : (
                          <Circle className="w-4 h-4 text-gray-300 flex-shrink-0" strokeWidth={1.5} />
                        )}
                        <span className={`flex-1 text-sm ${task.status === "done" ? "line-through" : "text-gray-700"}`}>
                          {task.title}
                        </span>
                        {task.dueDate && task.status !== "done" && (
                          <span className="text-xs text-gray-400 flex-shrink-0">
                            {new Date(task.dueDate).toLocaleDateString("zh-CN", { month: "short", day: "numeric" })}
                          </span>
                        )}
                      </motion.button>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ==================== 主页面 ====================

export default function HomePage() {
  const [projects, setProjects] = useState<ProjectV2[]>([]);
  const [projectBoards, setProjectBoards] = useState<Record<number, Board[]>>({});
  const [loading, setLoading] = useState(true);
  const [selectedProject, setSelectedProject] = useState<ProjectV2 | null>(null);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [inboxExpanded, setInboxExpanded] = useState(false);

  useEffect(() => {
    const load = async () => {
      try {
        const list = await getAllProjectsV2();
        setProjects(list);

        // Preload board names for each project (for badge display)
        const map: Record<number, Board[]> = {};
        for (const proj of list) {
          const bds = await getBoardsByProject(proj.id!);
          map[proj.id!] = bds;
        }
        setProjectBoards(map);
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
        <OverviewHeader />

        {loading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-5 md:gap-6">
            {[1, 2, 3, 4].map((i) => (
              <div key={i} className="skeleton h-[240px] rounded-3xl" />
            ))}
          </div>
        ) : selectedProject ? (
          <AnimatePresence mode="wait">
            <motion.div
              key="board-view"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              transition={{ duration: 0.25 }}
            >
              <BoardListView
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
                  const boards = projectBoards[proj.id!] || [];
                  return (
                    <ProjectCard
                      key={proj.id}
                      project={proj}
                      index={i}
                      boardCount={boards.length}
                      boardNames={boards.map((b) => b.name)}
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

        {!selectedProject && !loading && projects.length > 0 && (
          <p className="mt-8 text-center text-sm text-slate-400 dark:text-gray-500">
            选择一个项目，开始管理你的生活
          </p>
        )}

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
