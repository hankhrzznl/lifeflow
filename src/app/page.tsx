"use client";

import { useEffect, useState, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  LayoutGrid, ArrowRight, FolderKanban, ChevronRight,
  CheckCircle, Circle, ChevronDown,
} from "lucide-react";
import { db } from "@/lib/db";
import type { Task, ProjectV2, Board, Section } from "@/lib/types";
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

// ==================== 全展开项目视图 ====================

type BoardData = {
  board: Board;
  sections: Section[];
  tasksBySection: Map<number, Task[]>;
};

function ProjectExpandView({
  project,
  projectIndex,
  onBack,
}: {
  project: ProjectV2;
  projectIndex: number;
  onBack: () => void;
}) {
  const gradient = getProjectGradient(projectIndex);
  const projectId = project.id!;
  const [boardsData, setBoardsData] = useState<BoardData[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedSections, setExpandedSections] = useState<Set<number>>(new Set());

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      try {
        const boards = await getBoardsByProject(projectId);
        console.log("[ProjectExpandView] projectId:", projectId, "boards:", boards.length);
        const data: BoardData[] = [];

        for (const board of boards) {
          const sections = await getSectionsByBoard(board.id!);
          const tasksBySection = new Map<number, Task[]>();

          for (const sec of sections) {
            const tasks = await getTasksBySection(sec.id!);
            tasks.sort((a, b) => {
              if (a.status === "done" && b.status !== "done") return 1;
              if (a.status !== "done" && b.status === "done") return -1;
              return (b.createdAt || 0) - (a.createdAt || 0);
            });
            tasksBySection.set(sec.id!, tasks);
          }

          data.push({ board, sections, tasksBySection });
        }

        setBoardsData(data);
      } catch (err) {
        console.error("Failed to load project data:", err);
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [projectId]);

  const handleToggleTask = useCallback(async (task: Task) => {
    if (!task.id) return;
    const newStatus: Task["status"] = task.status === "done" ? "active" : "done";
    await db.tasks.update(task.id, { status: newStatus, updatedAt: Date.now() });
    showToast({
      message: newStatus === "done" ? "任务已完成" : "任务已恢复",
      type: newStatus === "done" ? "success" : "info",
    });
    setBoardsData((prev) =>
      prev.map((bd) => ({
        ...bd,
        tasksBySection: new Map(
          [...bd.tasksBySection].map(([sid, taskList]) => [
            sid,
            taskList.map((t) => (t.id === task.id ? { ...t, status: newStatus } : t)),
          ])
        ),
      }))
    );
  }, []);

  const toggleSection = (sectionId: number) => {
    setExpandedSections((prev) => {
      const next = new Set(prev);
      if (next.has(sectionId)) next.delete(sectionId);
      else next.add(sectionId);
      return next;
    });
  };

  // Count totals
  let totalSections = 0;
  let totalTasks = 0;
  for (const bd of boardsData) {
    totalSections += bd.sections.length;
    for (const taskList of bd.tasksBySection.values()) {
      totalTasks += taskList.length;
    }
  }

  return (
    <div>
      {/* Back + title */}
      <div className="flex items-center gap-3 mb-5">
        <button onClick={onBack} className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-gray-100 transition-colors">
          <ChevronRight className="w-5 h-5 text-gray-400 rotate-180" />
        </button>
        <div>
          <h1 className="text-xl font-bold text-gray-900">{project.name}</h1>
        </div>
      </div>

      {/* Project summary header */}
      <div className={`rounded-2xl bg-gradient-to-br ${gradient} p-5 mb-5 shadow-sm`}>
        <h3 className="text-xl font-bold text-white">{project.name}</h3>
        <p className="text-sm text-white/70 mt-1">
          {boardsData.length} 个大模块 · {totalSections} 个子模块 · {totalTasks} 个任务
        </p>
      </div>

      {loading ? (
        <div className="space-y-4">
          {[1, 2, 3].map((i) => (
            <div key={i} className="skeleton h-32 rounded-2xl" />
          ))}
        </div>
      ) : boardsData.length === 0 ? (
        <div className="text-center py-16">
          <FolderKanban className="w-10 h-10 text-gray-300 mx-auto mb-3" strokeWidth={1.5} />
          <p className="text-sm text-gray-500 mb-1">暂无大模块</p>
          <p className="text-xs text-gray-400">在规划页中为该项目添加大模块</p>
        </div>
      ) : (
        /* Boards fully expanded */
        <div className="space-y-5">
          {boardsData.map(({ board, sections, tasksBySection }, bi) => {
            const stages = board.stages || [];
            const hasStages = stages.length > 0;

            return (
              <div key={board.id} className="rounded-2xl bg-white border border-gray-100 overflow-hidden">
                {/* Board header */}
                <div className="flex items-center gap-3 px-4 py-3.5 bg-gray-50/70 border-b border-gray-100">
                  <div className="w-3 h-3 rounded-full flex-shrink-0" style={{ backgroundColor: project.color || "#007AFF" }} />
                  <FolderKanban className="w-4 h-4 text-blue-500 flex-shrink-0" strokeWidth={1.5} />
                  <span className="flex-1 text-sm font-semibold text-gray-900">{board.name}</span>
                  <span className="text-xs text-gray-400">
                    {sections.length} 子模块 · {hasStages ? `${stages.length} 阶段` : ""}
                  </span>
                </div>

                {sections.length === 0 ? (
                  <p className="px-4 py-3 pl-10 text-xs text-gray-400">暂无子模块</p>
                ) : hasStages ? (
                  /* By stage */
                  <div>
                    {stages.map((stage, stageIdx) => {
                      const stageSections = sections.filter((s) => (s.stageIndex ?? 0) === stageIdx);
                      return (
                        <div key={stageIdx}>
                          {/* Stage header */}
                          <div className="flex items-center gap-2 px-4 py-2 bg-indigo-50/50 border-b border-indigo-100">
                            <ChevronDown className="w-3.5 h-3.5 text-indigo-400 flex-shrink-0" />
                            <span className="text-xs font-semibold text-indigo-600">{stage.name}</span>
                            <span className="text-xs text-indigo-400">{stageSections.length} 子模块</span>
                          </div>
                          {stageSections.length === 0 ? (
                            <p className="px-4 py-2 pl-10 text-xs text-gray-400">暂无子模块</p>
                          ) : (
                            stageSections.map((section) => {
                              const sectionTasks = tasksBySection.get(section.id!) || [];
                              const isExpanded = expandedSections.has(section.id!);
                              return (
                                <div key={section.id}>
                                  {/* Section row with expand toggle */}
                                  <button
                                    onClick={() => toggleSection(section.id!)}
                                    className="w-full flex items-center gap-3 px-4 py-2.5 pl-10 hover:bg-gray-50 transition-colors border-b border-gray-50"
                                  >
                                    {isExpanded ? (
                                      <ChevronDown className="w-3.5 h-3.5 text-gray-400 flex-shrink-0" />
                                    ) : (
                                      <ChevronRight className="w-3.5 h-3.5 text-gray-400 flex-shrink-0" />
                                    )}
                                    <LayoutGrid className="w-3.5 h-3.5 text-amber-400 flex-shrink-0" />
                                    <span className="flex-1 text-xs font-medium text-gray-700 text-left">{section.name}</span>
                                    <span className="text-xs text-gray-400">{sectionTasks.length} 任务</span>
                                  </button>
                                  {/* Task list when expanded */}
                                  <AnimatePresence>
                                    {isExpanded && (
                                      <motion.div
                                        initial={{ height: 0 }}
                                        animate={{ height: "auto" }}
                                        exit={{ height: 0 }}
                                        className="overflow-hidden"
                                      >
                                        {sectionTasks.length === 0 ? (
                                          <p className="px-4 py-2 pl-16 text-xs text-gray-400">暂无任务</p>
                                        ) : (
                                          sectionTasks.map((task) => (
                                            <motion.button
                                              key={task.id}
                                              whileTap={{ scale: 0.98 }}
                                              onClick={() => handleToggleTask(task)}
                                              className={`w-full flex items-center gap-3 px-4 py-2 pl-16 text-left transition-colors border-b border-gray-50 ${
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
                                              {task.dueDate && task.status !== "done" && (
                                                <span className="text-xs text-gray-400 flex-shrink-0">
                                                  {new Date(task.dueDate).toLocaleDateString("zh-CN", { month: "short", day: "numeric" })}
                                                </span>
                                              )}
                                            </motion.button>
                                          ))
                                        )}
                                      </motion.div>
                                    )}
                                  </AnimatePresence>
                                </div>
                              );
                            })
                          )}
                        </div>
                      );
                    })}
                    {/* Unassigned sections */}
                    {(() => {
                      const unassigned = sections.filter((s) => (s.stageIndex ?? 0) >= stages.length);
                      if (unassigned.length === 0) return null;
                      return (
                        <div>
                          <div className="flex items-center gap-2 px-4 py-2 bg-gray-100 border-b border-gray-200">
                            <span className="text-xs text-gray-400">未归属阶段</span>
                            <span className="text-xs text-gray-400">{unassigned.length} 子模块</span>
                          </div>
                          {unassigned.map((section) => {
                            const sectionTasks = tasksBySection.get(section.id!) || [];
                            const isExpanded = expandedSections.has(section.id!);
                            return (
                              <div key={section.id}>
                                <button
                                  onClick={() => toggleSection(section.id!)}
                                  className="w-full flex items-center gap-3 px-4 py-2.5 pl-10 hover:bg-gray-50 transition-colors border-b border-gray-50"
                                >
                                  {isExpanded ? (
                                    <ChevronDown className="w-3.5 h-3.5 text-gray-400 flex-shrink-0" />
                                  ) : (
                                    <ChevronRight className="w-3.5 h-3.5 text-gray-400 flex-shrink-0" />
                                  )}
                                  <LayoutGrid className="w-3.5 h-3.5 text-amber-400 flex-shrink-0" />
                                  <span className="flex-1 text-xs font-medium text-gray-700 text-left">{section.name}</span>
                                  <span className="text-xs text-gray-400">{sectionTasks.length} 任务</span>
                                </button>
                                <AnimatePresence>
                                  {isExpanded && (
                                    <motion.div initial={{ height: 0 }} animate={{ height: "auto" }} exit={{ height: 0 }} className="overflow-hidden">
                                      {sectionTasks.map((task) => (
                                        <motion.button
                                          key={task.id}
                                          whileTap={{ scale: 0.98 }}
                                          onClick={() => handleToggleTask(task)}
                                          className={`w-full flex items-center gap-3 px-4 py-2 pl-16 text-left transition-colors border-b border-gray-50 ${
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
                                    </motion.div>
                                  )}
                                </AnimatePresence>
                              </div>
                            );
                          })}
                        </div>
                      );
                    })()}
                  </div>
                ) : (
                  /* No stages — flat sections */
                  sections.map((section) => {
                    const sectionTasks = tasksBySection.get(section.id!) || [];
                    const isExpanded = expandedSections.has(section.id!);
                    return (
                      <div key={section.id}>
                        <button
                          onClick={() => toggleSection(section.id!)}
                          className="w-full flex items-center gap-3 px-4 py-2.5 pl-8 hover:bg-gray-50 transition-colors border-b border-gray-50"
                        >
                          {isExpanded ? (
                            <ChevronDown className="w-3.5 h-3.5 text-gray-400 flex-shrink-0" />
                          ) : (
                            <ChevronRight className="w-3.5 h-3.5 text-gray-400 flex-shrink-0" />
                          )}
                          <LayoutGrid className="w-3.5 h-3.5 text-amber-400 flex-shrink-0" />
                          <span className="flex-1 text-xs font-medium text-gray-700 text-left">{section.name}</span>
                          <span className="text-xs text-gray-400">{sectionTasks.length} 任务</span>
                        </button>
                        <AnimatePresence>
                          {isExpanded && (
                            <motion.div initial={{ height: 0 }} animate={{ height: "auto" }} exit={{ height: 0 }} className="overflow-hidden">
                              {sectionTasks.length === 0 ? (
                                <p className="px-4 py-2 pl-14 text-xs text-gray-400">暂无任务</p>
                              ) : (
                                sectionTasks.map((task) => (
                                  <motion.button
                                    key={task.id}
                                    whileTap={{ scale: 0.98 }}
                                    onClick={() => handleToggleTask(task)}
                                    className={`w-full flex items-center gap-3 px-4 py-2 pl-14 text-left transition-colors border-b border-gray-50 ${
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
                                ))
                              )}
                            </motion.div>
                          )}
                        </AnimatePresence>
                      </div>
                    );
                  })
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
              key="expand-view"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              transition={{ duration: 0.25 }}
            >
              <ProjectExpandView
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
