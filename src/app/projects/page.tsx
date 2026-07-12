"use client";

import { useState, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useRouter } from "next/navigation";
import {
  Folder, Plus, Trash2, Edit3, ChevronRight, ChevronDown,
  AlertCircle, RotateCcw, FolderKanban, CheckCircle,
  Circle, Layers, Check, X,
} from "lucide-react";
import {
  getAllProjectsV2, createProjectV2, updateProjectV2, deleteProjectToTrash,
  getBoardsByProject, createBoard, updateBoard, deleteBoardToTrash,
  getSectionsByBoard, createSection, updateSection, deleteSectionToTrash,
  getTasksBySection, updateTask, deleteTask,
} from "@/lib/db";
import { showToast } from "@/components/ui/Toast";
import TaskDetail from "@/components/ui/TaskDetail";
import SectionDetail from "@/components/ui/SectionDetail";
import { PRIORITY_CONFIG } from "@/lib/types";
import type { ProjectV2, Board, BoardStage, Section, Task } from "@/lib/types";

const COLORS = ["#007AFF", "#34C759", "#FF9500", "#FF3B30", "#AF52DE", "#5856D6"];

export default function ProjectsPage() {
  const router = useRouter();
  const [projects, setProjects] = useState<ProjectV2[]>([]);
  const [expandedProjects, setExpandedProjects] = useState<Set<number>>(new Set());
  const [expandedBoards, setExpandedBoards] = useState<Set<number>>(new Set());
  const [boards, setBoards] = useState<Map<number, Board[]>>(new Map());
  const [sections, setSections] = useState<Map<number, Section[]>>(new Map());
  const [tasks, setTasks] = useState<Map<number, Task[]>>(new Map());
  const [projectProgress, setProjectProgress] = useState<Map<number, { done: number; total: number }>>(new Map());
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showNewProject, setShowNewProject] = useState(false);
  const [newProjectName, setNewProjectName] = useState("");
  const [newProjectColor, setNewProjectColor] = useState(COLORS[0]);
  const [editingProject, setEditingProject] = useState<ProjectV2 | null>(null);
  const [detailTaskId, setDetailTaskId] = useState<number | null>(null);
  const [detailSectionId, setDetailSectionId] = useState<number | null>(null);
  const [boardStagesMap, setBoardStagesMap] = useState<Map<number, BoardStage[]>>(new Map());
  const [expandedBoardStages, setExpandedBoardStages] = useState<Set<string>>(new Set());
  const [batchStageSheet, setBatchStageSheet] = useState<{ boardId: number; boardName: string; stages: BoardStage[] } | null>(null);
  const [batchDraftStages, setBatchDraftStages] = useState<{ name: string; achievements: string[] }[]>([]);
  const [editingStage, setEditingStage] = useState<{ boardId: number; stageIdx: number; stage: BoardStage } | null>(null);
  const [editingStageName, setEditingStageName] = useState("");
  const [editingStageAch, setEditingStageAch] = useState<string[]>([""]);

  const computeProjectProgress = useCallback(async (projectId: number): Promise<{ done: number; total: number }> => {
    try {
      const projectBoards = await getBoardsByProject(projectId);
      let done = 0, total = 0;
      for (const board of projectBoards) {
        const boardSections = await getSectionsByBoard(board.id!);
        for (const section of boardSections) {
          const sectionTasks = await getTasksBySection(section.id!);
          total += sectionTasks.length;
          done += sectionTasks.filter((t) => t.status === "done").length;
        }
      }
      return { done, total };
    } catch {
      return { done: 0, total: 0 };
    }
  }, []);

  const loadProjects = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const all = await getAllProjectsV2();
      setProjects(all);
      const progressMap = new Map<number, { done: number; total: number }>();
      for (const project of all) {
        const progress = await computeProjectProgress(project.id!);
        progressMap.set(project.id!, progress);
      }
      setProjectProgress(progressMap);
    } catch {
      setError("加载失败");
    } finally {
      setLoading(false);
    }
  }, [computeProjectProgress]);

  useEffect(() => { loadProjects(); }, [loadProjects]);

  const refreshProjectProgress = useCallback(async (projectId: number) => {
    const progress = await computeProjectProgress(projectId);
    setProjectProgress((prev) => new Map(prev).set(projectId, progress));
  }, [computeProjectProgress]);

  const toggleProject = useCallback(async (projectId: number) => {
    setExpandedProjects((prev) => {
      const next = new Set(prev);
      if (next.has(projectId)) { next.delete(projectId); return next; }
      next.add(projectId);
      getBoardsByProject(projectId).then((b) => {
        setBoards((prev) => new Map(prev).set(projectId, b));
        const sm = new Map<number, BoardStage[]>();
        for (const board of b) {
          sm.set(board.id!, board.stages || []);
        }
        setBoardStagesMap((prev) => new Map([...prev, ...sm]));
      }).catch(() => { showToast({ message: "加载大模块失败", type: "error" }); });
      return next;
    });
  }, []);

  const toggleBoard = useCallback(async (boardId: number) => {
    setExpandedBoards((prev) => {
      const next = new Set(prev);
      if (next.has(boardId)) { next.delete(boardId); return next; }
      next.add(boardId);
      return next;
    });
    const existingSections = sections.get(boardId) || await getSectionsByBoard(boardId);
    setSections((prev) => new Map(prev).set(boardId, existingSections));
    for (const s of existingSections) {
      getTasksBySection(s.id!).then((t) => setTasks((prev) => new Map(prev).set(s.id!, t)))
        .catch(() => {});
    }
  }, [sections]);

  const handleCreateProject = async () => {
    if (!newProjectName.trim()) return;
    try {
      await createProjectV2(newProjectName.trim(), newProjectColor);
      showToast({ message: "项目已创建", type: "success" });
      setShowNewProject(false);
      setNewProjectName("");
      setNewProjectColor(COLORS[0]);
      await loadProjects();
    } catch { showToast({ message: "创建项目失败", type: "error" }); }
  };

  const handleUpdateProject = async () => {
    if (!editingProject || !editingProject.name.trim()) return;
    try {
      await updateProjectV2(editingProject.id!, { name: editingProject.name.trim(), color: editingProject.color });
      showToast({ message: "项目已更新", type: "success" });
      setEditingProject(null);
      await loadProjects();
    } catch { showToast({ message: "更新项目失败", type: "error" }); }
  };

  const handleDeleteProject = async (id: number) => {
    if (!confirm("确定删除此项目？")) return;
    try {
      await deleteProjectToTrash(id);
      showToast({ message: "项目已移入回收站", type: "info" });
      await loadProjects();
    } catch { showToast({ message: "删除项目失败", type: "error" }); }
  };

  const handleCreateBoard = async (projectId: number) => {
    const name = prompt("大模块名称：");
    if (!name?.trim()) return;
    try {
      await createBoard(name.trim(), projectId);
      const b = await getBoardsByProject(projectId);
      setBoards((prev) => new Map(prev).set(projectId, b));
      showToast({ message: "大模块已创建", type: "success" });
    } catch { showToast({ message: "创建大模块失败", type: "error" }); }
  };

  const handleDeleteBoard = async (boardId: number, projectId: number) => {
    if (!confirm("确定删除此大模块？")) return;
    try {
      await deleteBoardToTrash(boardId);
      const b = await getBoardsByProject(projectId);
      setBoards((prev) => new Map(prev).set(projectId, b));
      await refreshProjectProgress(projectId);
      showToast({ message: "大模块已移入回收站", type: "info" });
    } catch { showToast({ message: "删除大模块失败", type: "error" }); }
  };

  const handleCreateSection = async (boardId: number, stageIdx?: number) => {
    const name = prompt("子模块名称：");
    if (!name?.trim()) return;
    try {
      const sectionId = await createSection(name.trim(), boardId);
      if (stageIdx !== undefined) {
        await updateSection(sectionId, { stageIndex: stageIdx });
      }
      const s = await getSectionsByBoard(boardId);
      setSections((prev) => new Map(prev).set(boardId, s));
      showToast({ message: "子模块已创建", type: "success" });
    } catch { showToast({ message: "创建子模块失败", type: "error" }); }
  };

  const handleDeleteSection = async (sectionId: number, boardId: number, projectId: number) => {
    if (!confirm("确定删除此子模块？")) return;
    try {
      await deleteSectionToTrash(sectionId);
      const s = await getSectionsByBoard(boardId);
      setSections((prev) => new Map(prev).set(boardId, s));
      await refreshProjectProgress(projectId);
      showToast({ message: "子模块已移入回收站", type: "info" });
    } catch { showToast({ message: "删除子模块失败", type: "error" }); }
  };

  const handleBatchSaveStages = async () => {
    if (!batchStageSheet) return;
    try {
      const newStages: BoardStage[] = batchDraftStages
        .filter((s) => s.name.trim())
        .map((s) => ({ name: s.name.trim(), achievements: s.achievements.filter((a) => a.trim()) }));
      await updateBoard(batchStageSheet.boardId, { stages: newStages });
      setBoards((prev) => {
        const next = new Map(prev);
        for (const [pid, bds] of next) {
          next.set(pid, bds.map((b) => (b.id === batchStageSheet.boardId ? { ...b, stages: newStages } : b)));
        }
        return next;
      });
      setBoardStagesMap((prev) => new Map(prev).set(batchStageSheet.boardId, newStages));
      showToast({ message: "阶段已更新", type: "success" });
      setBatchStageSheet(null);
    } catch { showToast({ message: "批量保存阶段失败", type: "error" }); }
  };

  const handleUpdateStage = async () => {
    if (!editingStage || !editingStageName.trim()) return;
    try {
      const existingStages = boardStagesMap.get(editingStage.boardId) || [];
      const newStages = [...existingStages];
      newStages[editingStage.stageIdx] = { name: editingStageName.trim(), achievements: editingStageAch.filter((a) => a.trim()) };
      await updateBoard(editingStage.boardId, { stages: newStages });
      setBoards((prev) => {
        const next = new Map(prev);
        for (const [pid, bds] of next) {
          next.set(pid, bds.map((b) => (b.id === editingStage.boardId ? { ...b, stages: newStages } : b)));
        }
        return next;
      });
      setBoardStagesMap((prev) => new Map(prev).set(editingStage.boardId, newStages));
      showToast({ message: "阶段已更新", type: "success" });
      setEditingStage(null);
    } catch { showToast({ message: "更新阶段失败", type: "error" }); }
  };

  const handleDeleteStage = async () => {
    if (!editingStage) return;
    try {
      const existingStages = boardStagesMap.get(editingStage.boardId) || [];
      const newStages = existingStages.filter((_, i) => i !== editingStage.stageIdx);
      await updateBoard(editingStage.boardId, { stages: newStages });
      setBoards((prev) => {
        const next = new Map(prev);
        for (const [pid, bds] of next) {
          next.set(pid, bds.map((b) => (b.id === editingStage.boardId ? { ...b, stages: newStages } : b)));
        }
        return next;
      });
      setBoardStagesMap((prev) => new Map(prev).set(editingStage.boardId, newStages));
      showToast({ message: "阶段已删除", type: "info" });
      setEditingStage(null);
      const newStageCount = newStages.length;
      const orphaned = (await getSectionsByBoard(editingStage.boardId)).filter((s) => (s.stageIndex ?? 0) >= newStageCount);
      for (const s of orphaned) {
        await updateSection(s.id!, { stageIndex: 0 });
      }
      const updated = await getSectionsByBoard(editingStage.boardId);
      setSections((prev) => new Map(prev).set(editingStage.boardId, updated));
    } catch { showToast({ message: "删除阶段失败", type: "error" }); }
  };

  const ProgressBar = ({ done, total }: { done: number; total: number }) => {
    const pct = total > 0 ? Math.round((done / total) * 100) : 0;
    return (
      <div className="flex items-center gap-2 min-w-0">
        <div className="flex-1 h-1.5 bg-gray-100 dark:bg-gray-800 rounded-full overflow-hidden">
          <motion.div
            className="h-full rounded-full"
            style={{ backgroundColor: pct === 100 ? "#34C759" : "#007AFF" }}
            initial={{ width: 0 }}
            animate={{ width: `${pct}%` }}
            transition={{ duration: 0.5, ease: "easeOut" }}
          />
        </div>
        <span className="text-xs text-gray-400 flex-shrink-0 tabular-nums">
          {done}/{total}
        </span>
      </div>
    );
  };

  if (loading) return (
    <div className="flex flex-col h-full max-w-2xl mx-auto px-4 pt-6 pb-24">
      <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100 mb-5">项目</h1>
      <div className="space-y-4">
        {[1, 2, 3].map((i) => <div key={i} className="skeleton h-16 rounded-xl" />)}
      </div>
    </div>
  );

  if (error) return (
    <div className="flex flex-col items-center justify-center py-20 px-4 text-center">
      <AlertCircle className="w-12 h-12 text-red-500 mb-4" />
      <p className="text-gray-500 mb-4">{error}</p>
      <button onClick={loadProjects} className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-xl"><RotateCcw className="w-4 h-4" />重试</button>
    </div>
  );

  return (
    <div className="flex flex-col h-full max-w-2xl mx-auto px-4 pb-24">
      {/* New project form */}
      <AnimatePresence>
        {showNewProject && (
          <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} exit={{ opacity: 0, height: 0 }} className="overflow-hidden mb-4">
            <div className="p-4 rounded-xl bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800">
              <input value={newProjectName} onChange={(e) => setNewProjectName(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") handleCreateProject(); if (e.key === "Escape") setShowNewProject(false); }} placeholder="项目名称" className="w-full px-4 py-2.5 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-sm mb-3 focus:outline-none focus:ring-2 focus:ring-blue-500" autoFocus />
              <div className="flex gap-2 mb-3">
                {COLORS.map((c) => (
                  <button key={c} onClick={() => setNewProjectColor(c)} className={`w-8 h-8 rounded-full transition-transform ${newProjectColor === c ? "scale-110 ring-2 ring-offset-2 ring-blue-500" : ""}`} style={{ backgroundColor: c }} />
                ))}
              </div>
              <div className="flex gap-2">
                <button onClick={() => setShowNewProject(false)} className="flex-1 py-2.5 rounded-xl border border-gray-200 dark:border-gray-700 text-sm text-gray-500">取消</button>
                <button onClick={handleCreateProject} disabled={!newProjectName.trim()} className="flex-1 py-2.5 rounded-xl bg-blue-600 text-white text-sm font-medium disabled:opacity-40">创建</button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* 新建项目入口 */}
      {!showNewProject && projects.length > 0 && (
        <button
          onClick={() => setShowNewProject(true)}
          className="w-full mb-3 flex items-center justify-center gap-1.5 py-3 rounded-xl border-2 border-dashed border-gray-200 dark:border-gray-700 text-sm text-gray-500 hover:border-gray-300 hover:text-gray-600 transition-colors"
        >
          <Plus className="w-4 h-4" />
          新建项目
        </button>
      )}

      {/* Project tree */}
      <div className="flex-1 overflow-y-auto space-y-2">
        {projects.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 text-center">
            <Folder className="w-12 h-12 text-gray-300 mb-4" />
            <p className="text-gray-500">暂无项目</p>
            <button onClick={() => setShowNewProject(true)} className="mt-3 text-blue-500 text-sm font-medium">创建第一个项目</button>
          </div>
        ) : (
          projects.map((project) => {
            const isExpanded = expandedProjects.has(project.id!);
            const projectBoards = boards.get(project.id!) || [];
            const progress = projectProgress.get(project.id!) || { done: 0, total: 0 };

            return (
              <div key={project.id} className="rounded-xl bg-white dark:bg-gray-900 border border-gray-100 dark:border-gray-800 overflow-hidden">
                {/* Project header */}
                <div className="flex items-center gap-3 px-4 py-3 cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors" onClick={() => toggleProject(project.id!)}>
                  <button className="w-6 h-6 flex items-center justify-center flex-shrink-0">
                    {isExpanded ? <ChevronDown className="w-4 h-4 text-gray-400" /> : <ChevronRight className="w-4 h-4 text-gray-400" />}
                  </button>
                  <div className="w-3 h-3 rounded-full flex-shrink-0" style={{ backgroundColor: project.color || "#007AFF" }} />
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-medium text-gray-900 dark:text-gray-100">{project.name}</div>
                    <ProgressBar done={progress.done} total={progress.total} />
                  </div>
                  <div className="flex items-center gap-1" onClick={(e) => e.stopPropagation()}>
                    <button onClick={() => handleCreateBoard(project.id!)} className="w-7 h-7 flex items-center justify-center rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-400" aria-label="添加大模块">
                      <Plus className="w-3.5 h-3.5" />
                    </button>
                    <button onClick={() => setEditingProject(project)} className="w-7 h-7 flex items-center justify-center rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-400" aria-label="编辑项目">
                      <Edit3 className="w-3.5 h-3.5" />
                    </button>
                    <button onClick={() => handleDeleteProject(project.id!)} className="w-7 h-7 flex items-center justify-center rounded-lg hover:bg-red-50 dark:hover:bg-red-900/20 text-gray-400 hover:text-red-500" aria-label="删除项目">
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>

                {/* Boards */}
                <AnimatePresence>
                  {isExpanded && (
                    <motion.div initial={{ height: 0 }} animate={{ height: "auto" }} exit={{ height: 0 }} className="overflow-hidden">
                      <div className="border-t border-gray-100 dark:border-gray-800">
                        {projectBoards.length === 0 ? (
                          <div className="px-4 py-3 text-sm text-gray-400 text-center">暂无大模块，点击 + 添加</div>
                        ) : (
                          projectBoards.map((board) => {
                            const isBoardExpanded = expandedBoards.has(board.id!);
                            const boardStages = boardStagesMap.get(board.id!) || [];
                            const allSectionsForBoard = sections.get(board.id!) || [];
                            const boardKey = `board-${board.id}`;
                            return (
                              <div key={board.id} className="border-b border-gray-50 dark:border-gray-800/50 last:border-0">
                                {/* Board header */}
                                <div className="flex items-center gap-3 pl-10 pr-4 py-2.5 cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors" onClick={() => {
                                  toggleBoard(board.id!);
                                  setExpandedBoardStages((prev) => {
                                    const next = new Set(prev);
                                    if (next.has(boardKey)) next.delete(boardKey);
                                    else next.add(boardKey);
                                    return next;
                                  });
                                }}>
                                  <button className="w-5 h-5 flex items-center justify-center flex-shrink-0">
                                    {isBoardExpanded ? <ChevronDown className="w-3.5 h-3.5 text-gray-400" /> : <ChevronRight className="w-3.5 h-3.5 text-gray-400" />}
                                  </button>
                                  <FolderKanban className="w-4 h-4 text-blue-400 flex-shrink-0" />
                                  <span className="flex-1 text-sm text-gray-700 dark:text-gray-300">{board.name}</span>
                                  <div className="flex items-center gap-1" onClick={(e) => e.stopPropagation()}>
                                    <button onClick={() => { setBatchStageSheet({ boardId: board.id!, boardName: board.name, stages: boardStagesMap.get(board.id!) || [] }); setBatchDraftStages((boardStagesMap.get(board.id!) || []).map((s) => ({ name: s.name, achievements: [...s.achievements] }))); }} className="w-6 h-6 flex items-center justify-center rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-400" aria-label="编辑阶段">
                                      <Edit3 className="w-3 h-3" />
                                    </button>
                                    <button onClick={() => handleDeleteBoard(board.id!, project.id!)} className="w-6 h-6 flex items-center justify-center rounded-lg hover:bg-red-50 dark:hover:bg-red-900/20 text-gray-400 hover:text-red-500" aria-label="删除大模块">
                                      <Trash2 className="w-3 h-3" />
                                    </button>
                                  </div>
                                </div>

                                {/* Stages and Sections inside expanded Board */}
                                <AnimatePresence>
                                  {isBoardExpanded && (
                                    <motion.div initial={{ height: 0 }} animate={{ height: "auto" }} exit={{ height: 0 }} className="overflow-hidden">
                                      {/* No stages: show sections directly */}
                                      {boardStages.length === 0 ? (
                                        <div>
                                          {allSectionsForBoard.length === 0 ? (
                                            <div className="pl-16 pr-4 py-2 text-xs text-gray-400 flex items-center justify-between">暂无子模块<button onClick={() => handleCreateSection(board.id!)} className="text-blue-500 hover:text-blue-600 font-medium">+ 添加</button></div>
                                          ) : (
                                            allSectionsForBoard.map((section) => {
                                              const sectionTasks = tasks.get(section.id!) || [];
                                              const sectionDone = sectionTasks.filter((t) => t.status === "done").length;
                                              return (
                                                <div key={section.id} className="border-t border-gray-50 dark:border-gray-800/30">
                                                  <div className="flex items-center gap-3 pl-16 pr-4 py-2 cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-800/30"
                                                    onClick={() => setDetailSectionId(section.id!)}>
                                                    <Circle className="w-3 h-3 flex-shrink-0" style={{ color: sectionDone === sectionTasks.length && sectionTasks.length > 0 ? "#34C759" : "#D1D5DB" }} />
                                                    <span className="flex-1 text-xs font-medium text-gray-600 dark:text-gray-400">{section.name}</span>
                                                    <span className="text-xs text-gray-400">{sectionTasks.length} 任务</span>
                                                    <button onClick={(e) => { e.stopPropagation(); handleDeleteSection(section.id!, board.id!, project.id!); }} className="w-6 h-6 flex items-center justify-center rounded-lg hover:bg-red-50 dark:hover:bg-red-900/20 text-gray-400 hover:text-red-500" aria-label="删除子模块">
                                                      <Trash2 className="w-3 h-3" />
                                                    </button>
                                                  </div>
                                                  {sectionTasks.length > 0 && (
                                                    <div className="pb-2">
                                                      {sectionTasks.map((task) => (
                                                        <div key={task.id} className="group flex items-center gap-2 pl-20 pr-4 py-1.5 hover:bg-gray-50 dark:hover:bg-gray-800/30 transition-colors" onClick={() => router.push(`/planner?taskId=${task.id}`)} style={{ cursor: "pointer" }}>
                                                          <div className="flex-shrink-0">
                                                            {task.status === "done" ? <CheckCircle className="w-4 h-4 text-emerald-500" /> : <Circle className="w-4 h-4 text-gray-300" />}
                                                          </div>
                                                          <span className={`flex-1 text-xs ${task.status === "done" ? "line-through text-gray-400" : "text-gray-700 dark:text-gray-300"}`}>{task.title}</span>
                                                          {task.priority && (
                                                            <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ backgroundColor: PRIORITY_CONFIG.find((p) => p.key === task.priority)?.hex || "#6B7280" }} title={PRIORITY_CONFIG.find((p) => p.key === task.priority)?.label} />
                                                          )}
                                                        </div>
                                                      ))}
                                                    </div>
                                                  )}
                                                </div>
                                              );
                                            })
                                          )}
                                        </div>
                                      ) : (
                                        /* Has stages: show stages with sections */
                                        <div>
                                          {boardStages.map((stage, stageIdx) => {
                                            const stageSections = allSectionsForBoard.filter((s) => (s.stageIndex ?? 0) === stageIdx);
                                            const stageKey = `board-${board.id}-stage-${stageIdx}`;
                                            const isStageExpanded = expandedBoardStages.has(stageKey);
                                            // Calculate stage achievements progress
                                            const stageAllTasks = stageSections.flatMap((s) => tasks.get(s.id!) || []);
                                            const stageDone = stageAllTasks.filter((t) => t.status === "done").length;
                                            const stageTotal = stageAllTasks.length;
                                            const achCount = stage.achievements.length;
                                            const completedAch = achCount > 0 && stageTotal > 0 ? Math.min(Math.floor((stageDone / stageTotal) * achCount), achCount) : 0;
                                            return (
                                              <div key={stageIdx}>
                                                <div className="flex items-center gap-3 pl-10 pr-4 py-2 cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-800/30" onClick={() => {
                                                  setExpandedBoardStages((prev) => {
                                                    const next = new Set(prev);
                                                    if (next.has(stageKey)) next.delete(stageKey);
                                                    else next.add(stageKey);
                                                    return next;
                                                  });
                                                }}>
                                                  {isStageExpanded ? <ChevronDown className="w-3.5 h-3.5 text-gray-400" /> : <ChevronRight className="w-3.5 h-3.5 text-gray-400" />}
                                                  <Layers className="w-4 h-4 text-indigo-400 flex-shrink-0" />
                                                  <div className="flex-1 min-w-0">
                                                    <div className="text-sm text-gray-700 dark:text-gray-300">{stage.name}</div>
                                                    <div className="flex items-center gap-2 mt-0.5">
                                                      <div className="flex-1 h-1 bg-gray-100 dark:bg-gray-700 rounded-full overflow-hidden">
                                                        <div className="h-full bg-indigo-400 rounded-full" style={{ width: stageTotal > 0 ? `${Math.round((stageDone / stageTotal) * 100)}%` : "0%" }} />
                                                      </div>
                                                      <span className="text-xs text-gray-400">{stageDone}/{stageTotal}</span>
                                                    </div>
                                                  </div>
                                                  <div className="flex items-center gap-0.5" onClick={(e) => e.stopPropagation()}>
                                                    <button onClick={() => { setEditingStage({ boardId: board.id!, stageIdx, stage }); setEditingStageName(stage.name); setEditingStageAch(stage.achievements.length ? [...stage.achievements] : [""]); }} className="w-6 h-6 flex items-center justify-center rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-400" aria-label="编辑阶段">
                                                      <Edit3 className="w-3 h-3" />
                                                    </button>
                                                    <button onClick={() => handleCreateSection(board.id!, stageIdx)} className="w-6 h-6 flex items-center justify-center rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-400" aria-label="添加子模块">
                                                      <Plus className="w-3 h-3" />
                                                    </button>
                                                  </div>
                                                </div>
                                                <AnimatePresence>
                                                  {isStageExpanded && (
                                                    <motion.div initial={{ height: 0 }} animate={{ height: "auto" }} exit={{ height: 0 }} className="overflow-hidden">
                                                      {/* Stage achievements */}
                                                      {stage.achievements.length > 0 && (
                                                        <div className="pl-16 pr-4 py-1 space-y-0.5">
                                                          {stage.achievements.map((a, i) => (
                                                            <div key={i} className={`flex items-center gap-1.5 pl-2 text-xs ${i < completedAch ? "text-indigo-600 dark:text-indigo-400" : "text-gray-400"}`}>
                                                              {i < completedAch ? <CheckCircle className="w-3 h-3 text-indigo-500 flex-shrink-0" /> : <Circle className="w-3 h-3 text-gray-300 flex-shrink-0" />}
                                                              {a}
                                                            </div>
                                                          ))}
                                                        </div>
                                                      )}
                                                      {/* Stage sections */}
                                                      {stageSections.map((section) => {
                                                        const sectionTasks = tasks.get(section.id!) || [];
                                                        const sectionDone = sectionTasks.filter((t) => t.status === "done").length;
                                                        return (
                                                          <div key={section.id} className="border-t border-gray-50 dark:border-gray-800/30">
                                                            <div className="flex items-center gap-3 pl-16 pr-4 py-2 cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-800/30"
                                                              onClick={() => setDetailSectionId(section.id!)}>
                                                              <Circle className="w-3 h-3 flex-shrink-0" style={{ color: sectionDone === sectionTasks.length && sectionTasks.length > 0 ? "#34C759" : "#D1D5DB" }} />
                                                              <span className="flex-1 text-xs font-medium text-gray-600 dark:text-gray-400">{section.name}</span>
                                                              <span className="text-xs text-gray-400">{sectionTasks.length} 任务</span>
                                                              <button onClick={(e) => { e.stopPropagation(); handleDeleteSection(section.id!, board.id!, project.id!); }} className="w-6 h-6 flex items-center justify-center rounded-lg hover:bg-red-50 dark:hover:bg-red-900/20 text-gray-400 hover:text-red-500" aria-label="删除子模块">
                                                                <Trash2 className="w-3 h-3" />
                                                              </button>
                                                            </div>
                                                            {sectionTasks.length > 0 && (
                                                              <div className="pb-2">
                                                                {sectionTasks.map((task) => (
                                                                  <div key={task.id} className="group flex items-center gap-2 pl-20 pr-4 py-1.5 hover:bg-gray-50 dark:hover:bg-gray-800/30 transition-colors" onClick={() => router.push(`/planner?taskId=${task.id}`)} style={{ cursor: "pointer" }}>
                                                                    <div className="flex-shrink-0">
                                                                      {task.status === "done" ? <CheckCircle className="w-4 h-4 text-emerald-500" /> : <Circle className="w-4 h-4 text-gray-300" />}
                                                                    </div>
                                                                    <span className={`flex-1 text-xs ${task.status === "done" ? "line-through text-gray-400" : "text-gray-700 dark:text-gray-300"}`}>{task.title}</span>
                                                                    {task.priority && (
                                                                      <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ backgroundColor: PRIORITY_CONFIG.find((p) => p.key === task.priority)?.hex || "#6B7280" }} title={PRIORITY_CONFIG.find((p) => p.key === task.priority)?.label} />
                                                                    )}
                                                                  </div>
                                                                ))}
                                                              </div>
                                                            )}
                                                          </div>
                                                        );
                                                      })}
                                                    </motion.div>
                                                  )}
                                                </AnimatePresence>
                                              </div>
                                            );
                                          })}
                                          {/* Unassigned sections (stageIndex >= boardStages.length) */}
                                          {(() => {
                                            const unassigned = allSectionsForBoard.filter((s) => (s.stageIndex ?? 0) >= boardStages.length);
                                            if (unassigned.length === 0) return null;
                                            return (
                                              <div key="unassigned">
                                                <div className="flex items-center gap-3 pl-10 pr-4 py-2">
                                                  <Layers className="w-4 h-4 text-gray-300 flex-shrink-0" />
                                                  <span className="text-sm text-gray-400">未归属阶段</span>
                                                  <span className="text-xs text-gray-400">{unassigned.length} 子模块</span>
                                                </div>
                                                {unassigned.map((section) => {
                                                  const sectionTasks = tasks.get(section.id!) || [];
                                                  return (
                                                    <div key={section.id} className="border-t border-gray-50 dark:border-gray-800/30">
                                                      <div className="flex items-center gap-3 pl-16 pr-4 py-2 cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-800/30"
                                                        onClick={() => setDetailSectionId(section.id!)}>
                                                        <Layers className="w-3.5 h-3.5 text-amber-400 flex-shrink-0" />
                                                        <span className="flex-1 text-xs font-medium text-gray-600 dark:text-gray-400">{section.name}</span>
                                                        <span className="text-xs text-gray-400">{sectionTasks.length} 任务</span>
                                                        <button onClick={(e) => { e.stopPropagation(); handleDeleteSection(section.id!, board.id!, project.id!); }} className="w-6 h-6 flex items-center justify-center rounded-lg hover:bg-red-50 dark:hover:bg-red-900/20 text-gray-400 hover:text-red-500" aria-label="删除子模块">
                                                          <Trash2 className="w-3 h-3" />
                                                        </button>
                                                      </div>
                                                    </div>
                                                  );
                                                })}
                                              </div>
                                            );
                                          })()}
                                        </div>
                                      )}
                                    </motion.div>
                                  )}
                                </AnimatePresence>
                              </div>
                            );
                          })
                        )}
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            );
          })
        )}
      </div>

      {/* Edit project modal */}
      <AnimatePresence>
        {editingProject && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-50 bg-black/40 flex items-end justify-center" onClick={() => setEditingProject(null)}>
            <motion.div initial={{ y: "100%" }} animate={{ y: 0 }} exit={{ y: "100%" }} transition={{ type: "spring", stiffness: 400, damping: 40 }} onClick={(e) => e.stopPropagation()} className="w-full max-w-lg bg-white dark:bg-gray-900 rounded-t-2xl p-6">
              <h3 className="text-lg font-semibold mb-4 text-gray-900 dark:text-gray-100">编辑项目</h3>
              <input value={editingProject.name} onChange={(e) => setEditingProject({ ...editingProject, name: e.target.value })} className="w-full px-4 py-2.5 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 mb-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
              <div className="flex gap-2 mb-4">
                {COLORS.map((c) => (
                  <button key={c} onClick={() => setEditingProject({ ...editingProject, color: c })} className={`w-8 h-8 rounded-full transition-transform ${editingProject.color === c ? "ring-2 ring-offset-2 ring-blue-500" : ""}`} style={{ backgroundColor: c }} />
                ))}
              </div>
              <div className="flex gap-3">
                <button onClick={() => setEditingProject(null)} className="flex-1 py-3 rounded-xl border border-gray-200 dark:border-gray-700 text-sm text-gray-500 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors">取消</button>
                <button onClick={handleUpdateProject} className="flex-1 py-3 rounded-xl bg-blue-600 text-white text-sm font-medium hover:bg-blue-700 transition-colors">保存</button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Edit stage modal */}
      <AnimatePresence>
        {editingStage && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-50 bg-black/40 flex items-end justify-center" onClick={() => setEditingStage(null)}>
            <motion.div initial={{ y: "100%" }} animate={{ y: 0 }} exit={{ y: "100%" }} transition={{ type: "spring", stiffness: 400, damping: 40 }} onClick={(e) => e.stopPropagation()} className="w-full max-w-lg bg-white dark:bg-gray-900 rounded-t-2xl p-6 max-h-[80vh] overflow-y-auto">
              <h3 className="text-lg font-semibold mb-4 text-gray-900 dark:text-gray-100">编辑阶段</h3>
              <input value={editingStageName} onChange={(e) => setEditingStageName(e.target.value)} placeholder="阶段名称" className="w-full px-3 py-2 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-sm text-gray-900 dark:text-gray-100 mb-3 focus:outline-none focus:ring-2 focus:ring-blue-500" />
              <p className="text-xs font-medium text-gray-400 dark:text-gray-500 mb-1.5">阶段成就</p>
              <div className="space-y-1 mb-3">
                {editingStageAch.map((ach, i) => (
                  <div key={i} className="flex items-center gap-1">
                    <input value={ach} onChange={(e) => { const a = [...editingStageAch]; a[i] = e.target.value; setEditingStageAch(a); }} placeholder={`成就 ${i + 1}`} className="flex-1 px-2 py-1.5 rounded-lg border border-gray-100 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 text-xs focus:outline-none focus:ring-2 focus:ring-blue-500" />
                    <button onClick={() => setEditingStageAch((prev) => prev.filter((_, j) => j !== i))} className="w-6 h-6 flex items-center justify-center rounded text-gray-400 hover:text-red-500"><X className="w-3 h-3" /></button>
                  </div>
                ))}
                <button onClick={() => setEditingStageAch((prev) => [...prev, ""])} className="text-xs text-blue-500 hover:text-blue-600 font-medium">+ 添加成就</button>
              </div>
              <div className="flex gap-3">
                <button onClick={handleDeleteStage} className="py-3 px-4 rounded-xl border border-red-200 dark:border-red-800 text-red-500 text-sm font-medium">删除阶段</button>
                <div className="flex-1" />
                <button onClick={() => setEditingStage(null)} className="py-3 px-4 rounded-xl border border-gray-200 dark:border-gray-700 text-sm text-gray-500 dark:text-gray-400">取消</button>
                <button onClick={handleUpdateStage} className="py-3 px-4 rounded-xl bg-indigo-600 text-white text-sm font-medium">保存</button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Batch stage edit modal */}
      <AnimatePresence>
        {batchStageSheet && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-50 bg-black/40 flex items-end justify-center" onClick={() => setBatchStageSheet(null)}>
            <motion.div initial={{ y: "100%" }} animate={{ y: 0 }} exit={{ y: "100%" }} transition={{ type: "spring", stiffness: 400, damping: 40 }} onClick={(e) => e.stopPropagation()} className="w-full max-w-lg bg-white dark:bg-gray-900 rounded-t-2xl p-6 max-h-[85vh] overflow-y-auto">
              <h3 className="text-lg font-semibold mb-4 text-gray-900 dark:text-gray-100">编辑阶段 · {batchStageSheet.boardName}</h3>
              <div className="space-y-3 mb-4">
                {batchDraftStages.map((stage, si) => (
                  <div key={si} className="p-3 rounded-xl border border-gray-200 dark:border-gray-700">
                    <div className="flex items-center gap-2 mb-2">
                      <span className="text-xs font-medium text-gray-400 w-12 flex-shrink-0">阶段{si + 1}</span>
                      <input
                        value={stage.name}
                        onChange={(e) => {
                          const s = [...batchDraftStages];
                          s[si] = { ...s[si], name: e.target.value };
                          setBatchDraftStages(s);
                        }}
                        placeholder="阶段名称"
                        className="flex-1 px-2 py-1.5 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-sm text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
                      />
                      <button
                        onClick={() => setBatchDraftStages((prev) => prev.filter((_, i) => i !== si))}
                        className="w-6 h-6 flex items-center justify-center rounded text-gray-400 hover:text-red-500"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                    <div className="pl-14 space-y-1">
                      {stage.achievements.map((ach, ai) => (
                        <div key={ai} className="flex items-center gap-1">
                          <Check className="w-3 h-3 text-gray-300 flex-shrink-0" />
                          <input
                            value={ach}
                            onChange={(e) => {
                              const s = [...batchDraftStages];
                              const a = [...s[si].achievements];
                              a[ai] = e.target.value;
                              s[si] = { ...s[si], achievements: a };
                              setBatchDraftStages(s);
                            }}
                            placeholder={`成就 ${ai + 1}`}
                            className="flex-1 px-2 py-1 rounded border border-gray-100 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 text-xs focus:outline-none focus:ring-2 focus:ring-blue-500"
                          />
                          <button
                            onClick={() => {
                              const s = [...batchDraftStages];
                              s[si] = { ...s[si], achievements: s[si].achievements.filter((_, j) => j !== ai) };
                              setBatchDraftStages(s);
                            }}
                            className="w-5 h-5 flex items-center justify-center text-gray-300 hover:text-red-400"
                          >
                            <X className="w-2.5 h-2.5" />
                          </button>
                        </div>
                      ))}
                      <button
                        onClick={() => {
                          const s = [...batchDraftStages];
                          s[si] = { ...s[si], achievements: [...s[si].achievements, ""] };
                          setBatchDraftStages(s);
                        }}
                        className="text-xs text-blue-500 hover:text-blue-600 font-medium ml-4"
                      >
                        + 添加成就
                      </button>
                    </div>
                  </div>
                ))}
              </div>
              <button
                onClick={() => setBatchDraftStages((prev) => [...prev, { name: "", achievements: [""] }])}
                className="flex items-center gap-1 text-sm text-indigo-500 hover:text-indigo-600 font-medium mb-4"
              >
                <Plus className="w-4 h-4" /> 添加阶段
              </button>
              <div className="flex gap-3">
                <button onClick={() => setBatchStageSheet(null)} className="flex-1 py-3 rounded-xl border border-gray-200 dark:border-gray-700 text-sm text-gray-500 dark:text-gray-400">取消</button>
                <button onClick={handleBatchSaveStages} className="flex-1 py-3 rounded-xl bg-indigo-600 text-white text-sm font-medium">保存</button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Task detail modal */}
      {detailTaskId !== null && (
        <TaskDetail
          taskId={detailTaskId}
          onClose={() => setDetailTaskId(null)}
          onUpdate={loadProjects}
        />
      )}

      {/* Section detail modal */}
      {detailSectionId !== null && (
        <SectionDetail
          sectionId={detailSectionId}
          onClose={() => setDetailSectionId(null)}
          onUpdate={loadProjects}
        />
      )}
    </div>
  );
}
