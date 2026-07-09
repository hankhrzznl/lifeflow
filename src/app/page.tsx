"use client";

import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import {
  ArrowRight, FolderKanban, ChevronLeft, ChevronDown, ChevronRight, CheckCircle2,
} from "lucide-react";
import type { ProjectV2, Board, Section, Task } from "@/lib/types";
import { getAllProjectsV2, getBoardsByProject, getSectionsByBoard, getTasksBySection, updateTask } from "@/lib/db";
import OverviewHeader from "@/components/layout/OverviewHeader";
import QuickCaptureBar from "@/components/layout/QuickCaptureBar";
import CaptureInbox from "@/components/layout/CaptureInbox";
import TodayTimeline from "@/components/schedule/TodayTimeline";
import CharacterFrame from "@/components/CharacterFrame";

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
  onClick,
}: {
  project: ProjectV2;
  index: number;
  boardCount: number;
  boardNames: string[];
  onClick: () => void;
}) {
  const gradient = getProjectGradient(index);

  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.08, duration: 0.4, ease: "easeOut" }}
      onClick={onClick}
      className={`group relative overflow-hidden rounded-3xl bg-gradient-to-br ${gradient} p-6 md:p-7 text-white shadow-lg shadow-slate-200/60 min-h-[200px] md:min-h-[240px] flex flex-col cursor-pointer hover:scale-[1.02] transition-transform`}
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

        <div className="mt-auto flex items-center gap-1.5 text-sm font-medium text-white/90">
          <span>点击查看大模块</span>
          <ArrowRight className="w-4 h-4" strokeWidth={2} />
        </div>
      </div>
    </motion.div>
  );
}

// ==================== 大模块卡片 ====================

function BoardCard({
  board,
  index,
  onClick,
}: {
  board: Board;
  index: number;
  onClick: () => void;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.05, duration: 0.35 }}
      onClick={onClick}
      className="bg-white dark:bg-gray-900 border border-gray-100 dark:border-gray-800 rounded-2xl p-5 cursor-pointer hover:shadow-md hover:border-indigo-200 dark:hover:border-indigo-800 transition-all"
    >
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-bold text-gray-900 dark:text-white">{board.name}</h3>
          {board.stages && board.stages.length > 0 && (
            <p className="text-xs text-gray-400 mt-1">
              {board.stages.length} 个阶段
            </p>
          )}
        </div>
        <ChevronRight className="w-4 h-4 text-gray-300" />
      </div>
    </motion.div>
  );
}

// ==================== 主页面 ====================

export default function HomePage() {
  const [projects, setProjects] = useState<ProjectV2[]>([]);
  const [projectBoards, setProjectBoards] = useState<Record<number, Board[]>>({});
  const [loading, setLoading] = useState(true);
  const [inboxExpanded, setInboxExpanded] = useState(false);

  // drill-down state
  const [view, setView] = useState<"projects" | "boards" | "detail">("projects");
  const [selectedProject, setSelectedProject] = useState<ProjectV2 | null>(null);
  const [selectedBoard, setSelectedBoard] = useState<Board | null>(null);
  const [detailSections, setDetailSections] = useState<(Section & { tasks: Task[] })[]>([]);

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

  const handleProjectClick = (proj: ProjectV2) => {
    setSelectedProject(proj);
    setView("boards");
  };

  const handleBoardClick = async (board: Board) => {
    setSelectedBoard(board);
    try {
      const sections = await getSectionsByBoard(board.id!);
      const withTasks = await Promise.all(
        sections.map(async (s) => {
          const tasks = await getTasksBySection(s.id!);
          return { ...s, tasks: tasks.filter((t) => t.status === "active") };
        })
      );
      setDetailSections(withTasks);
    } catch (err) {
      console.error("Failed to load board detail:", err);
      setDetailSections([]);
    }
    setView("detail");
  };

  const handleBack = () => {
    if (view === "detail") {
      setView("boards");
    } else if (view === "boards") {
      setView("projects");
    }
  };

  const handleToggleTask = async (task: Task) => {
    const newStatus = task.status === "done" ? "active" : "done";
    await updateTask(task.id!, { status: newStatus });
    setDetailSections((prev) =>
      prev.map((s) => ({
        ...s,
        tasks: s.tasks.map((t) =>
          t.id === task.id ? { ...t, status: newStatus } : t
        ),
      }))
    );
  };

  // 按 stageIndex 分组 sections
  const groupedByStage = (() => {
    if (!selectedBoard?.stages) return [];
    const stages = selectedBoard.stages;
    return stages.map((stage, si) => ({
      stage,
      sections: detailSections.filter((s) => (s.stageIndex ?? 0) === si),
    }));
  })();

  const noStageSections = detailSections.filter((s) => s.stageIndex === undefined || s.stageIndex === null);

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-50 to-white dark:from-gray-950 dark:to-gray-900 text-slate-900 dark:text-white">
      <div className="mx-auto max-w-5xl px-5 pt-8 pb-24 md:px-8 md:pt-10">
        {/* 非项目列表视图时的返回按钮 */}
        {view !== "projects" && (
          <button
            onClick={handleBack}
            className="flex items-center gap-1 text-sm text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 mb-4 transition-colors"
          >
            <ChevronLeft className="w-4 h-4" />
            {view === "boards" ? "返回项目列表" : `返回 ${selectedProject?.name}`}
          </button>
        )}

        <OverviewHeader />

        {/* 人物框 */}
        <div className="mt-6 mb-6">
          <CharacterFrame />
        </div>

        {/* === 视图切换 === */}

        {view === "projects" && (
          <>
            {loading ? (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-5 md:gap-6">
                {[1, 2, 3, 4].map((i) => (
                  <div key={i} className="skeleton h-[240px] rounded-3xl" />
                ))}
              </div>
            ) : projects.length === 0 ? (
              <div className="text-center py-16">
                <FolderKanban className="w-10 h-10 text-gray-300 mx-auto mb-3" strokeWidth={1.5} />
                <p className="text-sm text-gray-500 mb-1">暂无项目</p>
                <p className="text-xs text-gray-400">
                  在规划页中创建项目，它们将自动显示在这里
                </p>
              </div>
            ) : (
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
                      onClick={() => handleProjectClick(proj)}
                    />
                  );
                })}
              </div>
            )}
          </>
        )}

        {view === "boards" && selectedProject && (
          <>
            <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-4">{selectedProject.name}</h2>
            {(() => {
              const boards = projectBoards[selectedProject.id!] || [];
              if (boards.length === 0) {
                return (
                  <div className="text-center py-12">
                    <FolderKanban className="w-8 h-8 text-gray-300 mx-auto mb-2" strokeWidth={1.5} />
                    <p className="text-sm text-gray-400">暂无大模块</p>
                  </div>
                );
              }
              return (
                <div className="space-y-3">
                  {boards.map((board, i) => (
                    <BoardCard
                      key={board.id}
                      board={board}
                      index={i}
                      onClick={() => handleBoardClick(board)}
                    />
                  ))}
                </div>
              );
            })()}
          </>
        )}

        {view === "detail" && selectedBoard && (
          <div>
            <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-1">{selectedBoard.name}</h2>
            <p className="text-xs text-gray-400 mb-5">{selectedProject?.name}</p>

            {/* 有阶段：按阶段分组 */}
            {groupedByStage.length > 0 && groupedByStage.map(({ stage, sections }, si) => (
              <div key={si} className="mb-5">
                <div className="flex items-center gap-2 mb-2">
                  <span className="w-1.5 h-5 rounded-full bg-indigo-400" />
                  <h3 className="text-sm font-bold text-gray-700 dark:text-gray-300">{stage.name}</h3>
                </div>
                {sections.length === 0 ? (
                  <p className="text-xs text-gray-400 pl-3.5">暂无子模块</p>
                ) : (
                  <div className="space-y-2 pl-3.5">
                    {sections.map((section) => (
                      <TaskSectionBlock key={section.id} section={section} onToggleTask={handleToggleTask} />
                    ))}
                  </div>
                )}
              </div>
            ))}

            {/* 无阶段的子模块 */}
            {groupedByStage.length === 0 && noStageSections.length > 0 && noStageSections.map((section) => (
              <TaskSectionBlock key={section.id} section={section} onToggleTask={handleToggleTask} />
            ))}
            {groupedByStage.length === 0 && noStageSections.length === 0 && detailSections.length === 0 && (
              <p className="text-center text-sm text-gray-400 py-8">暂无子模块和任务</p>
            )}
          </div>
        )}

        {/* 快速捕捉栏 */}
        <div className="mt-8">
          <QuickCaptureBar
            inboxExpanded={inboxExpanded}
            onToggleInbox={() => setInboxExpanded((v) => !v)}
          />
          <CaptureInbox visible={inboxExpanded} />
        </div>

        {/* 日程时间线 */}
        <div className="mt-8">
          <h2 className="text-lg font-bold text-gray-900 dark:text-white mb-3">今日日程</h2>
          <TodayTimeline />
        </div>
      </div>
    </div>
  );
}

// ==================== 子模块+任务块 ====================

function TaskSectionBlock({
  section,
  onToggleTask,
}: {
  section: Section & { tasks: Task[] };
  onToggleTask: (task: Task) => void;
}) {
  const [expanded, setExpanded] = useState(false);

  return (
    <div className="bg-white dark:bg-gray-900 border border-gray-100 dark:border-gray-800 rounded-xl overflow-hidden">
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full flex items-center justify-between px-4 py-3 hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors"
      >
        <div className="text-left">
          <span className="text-sm font-medium text-gray-800 dark:text-gray-200">{section.name}</span>
          <span className="text-xs text-gray-400 ml-2">{section.tasks.length} 个任务</span>
        </div>
        <ChevronDown className={`w-4 h-4 text-gray-300 transition-transform ${expanded ? "rotate-180" : ""}`} />
      </button>

      {expanded && (
        <div className="border-t border-gray-100 dark:border-gray-800">
          {section.tasks.length === 0 ? (
            <p className="px-4 py-3 text-xs text-gray-400">暂无任务</p>
          ) : (
            section.tasks.map((task) => (
              <div
                key={task.id}
                className="flex items-center gap-3 px-4 py-2.5 border-b border-gray-50 dark:border-gray-800/50 last:border-b-0"
              >
                <button
                  onClick={() => onToggleTask(task)}
                  className="flex-shrink-0"
                >
                  <CheckCircle2
                    className={`w-4 h-4 ${
                      task.status === "done"
                        ? "text-green-400 fill-green-400"
                        : "text-gray-300 dark:text-gray-600"
                    }`}
                  />
                </button>
                <span
                  className={`text-sm flex-1 ${
                    task.status === "done"
                      ? "line-through text-gray-400"
                      : "text-gray-700 dark:text-gray-300"
                  }`}
                >
                  {task.title}
                </span>
              </div>
            ))
          )}
        </div>
      )}
    </div>
  );
}
