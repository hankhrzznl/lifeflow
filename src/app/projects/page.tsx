"use client";

import { useState, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Folder, Plus, Trash2, Edit3, ChevronRight, ChevronDown,
  AlertCircle, RotateCcw, FolderKanban, CheckCircle,
  Circle, Layers, Check, X,
} from "lucide-react";
import {
  getAllProjectsV2, createProjectV2, updateProjectV2, deleteProjectToTrash,
  getBoardsByProject, createBoard, updateBoard, deleteBoardToTrash,
  getSectionsByBoard, createSection, updateSection, deleteSectionToTrash,
  getTasksBySection, updateTask,
} from "@/lib/db";
import { showToast } from "@/components/ui/Toast";
import TaskDetail from "@/components/ui/TaskDetail";
import SectionDetail from "@/components/ui/SectionDetail";
import { PRIORITY_CONFIG } from "@/lib/types";
import type { ProjectV2, Board, BoardStage, Section, Task } from "@/lib/types";

const COLORS = ["#007AFF", "#34C759", "#FF9500", "#FF3B30", "#AF52DE", "#5856D6"];

export default function ProjectsPage() {
  const [projects, setProjects] = useState<ProjectV2[]>([]);
  const [expandedProjects, setExpandedProjects] = useState<Set<number>>(new Set());
  const [expandedBoards, setExpandedBoards] = useState<Set<number>>(new Set());
  const [boards, setBoards] = useState<Map<number, Board[]>>(new Map());
  const [sections, setSections] = useState<Map<number, Section[]>>(new Map());
  const [tasks, setTasks] = useState<Map<number, Task[]>>(new Map());
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
  const [stageSheet, setStageSheet] = useState<{ boardId: number; boardName: string } | null>(null);
  const [newStageName, setNewStageName] = useState("");
  const [newStageAch, setNewStageAch] = useState<string[]>([""]);
  const [editingStage, setEditingStage] = useState<{ boardId: number; stageIdx: number; stage: BoardStage } | null>(null);
  const [editingStageName, setEditingStageName] = useState("");
  const [editingStageAch, setEditingStageAch] = useState<string[]>([""]);

  const loadProjects = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const all = await getAllProjectsV2();
      setProjects(all);
    } catch { setError("加载失败"); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { const load = async () => { await loadProjects(); }; load(); }, [loadProjects]);

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
        setBoardStagesMap(prev => new Map([...prev, ...sm]));
      });
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
      getTasksBySection(s.id!).then((t) => setTasks((prev) => new Map(prev).set(s.id!, t)));
    }
  }, [sections]);

  const handleCreateProject = async () => {
    if (!newProjectName.trim()) return;
    await createProjectV2(newProjectName.trim(), newProjectColor);
    setNewProjectName("");
    setShowNewProject(false);
    await loadProjects();
    showToast({ message: "项目已创建", type: "success" });
  };

  const handleUpdateProject = async () => {
    if (!editingProject || !editingProject.name.trim()) return;
    await updateProjectV2(editingProject.id!, { name: editingProject.name.trim(), color: editingProject.color });
    setEditingProject(null);
    await loadProjects();
  };

  const handleDeleteProject = async (id: number) => {
    await deleteProjectToTrash(id);
    await loadProjects();
    showToast({ message: "项目已移入回收站", type: "info" });
  };

  const handleCreateBoard = async (projectId: number) => {
    const name = prompt("大模块名称：");
    if (!name?.trim()) return;
    await createBoard(name.trim(), projectId);
    const b = await getBoardsByProject(projectId);
    setBoards((prev) => new Map(prev).set(projectId, b));
    showToast({ message: "大模块已创建", type: "success" });
  };

  const handleDeleteBoard = async (boardId: number, projectId: number) => {
    if (!confirm("确定删除此大模块？")) return;
    await deleteBoardToTrash(boardId);
    const b = await getBoardsByProject(projectId);
    setBoards((prev) => new Map(prev).set(projectId, b));
    showToast({ message: "大模块已移入回收站", type: "info" });
  };

  const handleAddStage = async () => {
    if (!stageSheet || !newStageName.trim()) return;
    const board = (boards.get(stageSheet.boardId) || []).find((b) => b.id === stageSheet.boardId);
    if (!board) return;
    const newStages = [...(board.stages || []), { name: newStageName.trim(), achievements: newStageAch.filter((a) => a.trim()) }];
    await updateBoard(stageSheet.boardId, { stages: newStages });
    setBoards((prev) => {
      const next = new Map(prev);
      for (const [pid, bds] of next) {
        next.set(pid, bds.map((b) => (b.id === stageSheet.boardId ? { ...b, stages: newStages } : b)));
      }
      return next;
    });
    setBoardStagesMap((prev) => new Map(prev).set(stageSheet.boardId, newStages));
    showToast({ message: "阶段已添加", type: "success" });
    setStageSheet(null);
    setNewStageName("");
    setNewStageAch([""]);
  };

  const handleUpdateStage = async () => {
    if (!editingStage || !editingStageName.trim()) return;
    const board = (boards.get(editingStage.boardId) || []).find((b) => b.id === editingStage.boardId);
    if (!board || !board.stages) return;
    const newStages = [...board.stages];
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
  };

  const handleDeleteStage = async () => {
    if (!editingStage) return;
    const board = (boards.get(editingStage.boardId) || []).find((b) => b.id === editingStage.boardId);
    if (!board || !board.stages) return;
    const newStages = board.stages.filter((_, i) => i !== editingStage.stageIdx);
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
  };

  const handleCreateSection = async (boardId: number, stageIdx?: number) => {
    const name = prompt("子模块名称：");
    if (!name?.trim()) return;
    const sectionId = await createSection(name.trim(), boardId);
    if (stageIdx !== undefined) {
      await updateSection(sectionId, { stageIndex: stageIdx });
    }
    const s = await getSectionsByBoard(boardId);
    setSections((prev) => new Map(prev).set(boardId, s));
    showToast({ message: "子模块已创建", type: "success" });
  };

  const handleDeleteSection = async (sectionId: number, boardId: number) => {
    if (!confirm("确定删除此子模块？")) return;
    await deleteSectionToTrash(sectionId);
    const s = await getSectionsByBoard(boardId);
    setSections((prev) => new Map(prev).set(boardId, s));
    showToast({ message: "子模块已移入回收站", type: "info" });
  };

  const handleToggleTask = async (task: Task) => {
    const newStatus = task.status === "done" ? "active" : "done";
    await updateTask(task.id!, { status: newStatus });
    setTasks((prev) => {
      const next = new Map(prev);
      for (const [sid, taskList] of next) {
        next.set(sid, taskList.map((t) => t.id === task.id ? { ...t, status: newStatus } : t));
      }
      return next;
    });
  };

  if (loading) return (
    <div className="flex flex-col h-full max-w-2xl mx-auto px-4 pt-6 pb-24">
      <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100 mb-5">项目</h1>
      <div className="space-y-4">
        {[1,2,3].map((i) => <div key={i} className="skeleton h-16 rounded-xl" />)}
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
    <div className="flex flex-col h-full max-w-2xl mx-auto px-4 pt-6 pb-24">
      <div className="flex items-center justify-between mb-5">
        <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">项目</h1>
        <button onClick={() => setShowNewProject(true)} className="w-9 h-9 flex items-center justify-center rounded-xl bg-blue-500 text-white hover:bg-blue-600 transition-colors" aria-label="新建项目">
          <Plus className="w-5 h-5" />
        </button>
      </div>

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
            return (
              <div key={project.id} className="rounded-xl bg-white dark:bg-gray-900 border border-gray-100 dark:border-gray-800 overflow-hidden">
                {/* Project header */}
                <div className="flex items-center gap-3 px-4 py-3 cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors" onClick={() => toggleProject(project.id!)}>
                  <button className="w-6 h-6 flex items-center justify-center flex-shrink-0">
                    {isExpanded ? <ChevronDown className="w-4 h-4 text-gray-400" /> : <ChevronRight className="w-4 h-4 text-gray-400" />}
                  </button>
                  <div className="w-3 h-3 rounded-full flex-shrink-0" style={{ backgroundColor: project.color || "#007AFF" }} />
                  <span className="flex-1 text-sm font-medium text-gray-900 dark:text-gray-100">{project.name}</span>
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
                            return (
                              <div key={board.id} className="border-b border-gray-50 dark:border-gray-800/50 last:border-0">
                                {/* Board header */}
                                <div className="flex items-center gap-3 pl-10 pr-4 py-2.5 cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors" onClick={() => toggleBoard(board.id!)}>
                                  <button className="w-5 h-5 flex items-center justify-center flex-shrink-0">
                                    {isBoardExpanded ? <ChevronDown className="w-3.5 h-3.5 text-gray-400" /> : <ChevronRight className="w-3.5 h-3.5 text-gray-400" />}
                                  </button>
                                  <FolderKanban className="w-4 h-4 text-blue-400 flex-shrink-0" />
                                  <span className="flex-1 text-sm text-gray-700 dark:text-gray-300">{board.name}</span>
                                  <div className="flex items-center gap-1" onClick={(e) => e.stopPropagation()}>
                                    <button onClick={() => { setStageSheet({ boardId: board.id!, boardName: board.name }); setNewStageName(""); setNewStageAch([""]); }} className="w-6 h-6 flex items-center justify-center rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-400" aria-label="添加阶段">
                                      <Plus className="w-3 h-3" />
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
                                      {boardStages.length === 0 ? (
                                        <div>
                                          {allSectionsForBoard.length === 0 ? (
                                            <div className="pl-16 pr-4 py-2 text-xs text-gray-400">暂无子模块</div>
                                          ) : (
                                            allSectionsForBoard.map((section) => {
                                              const sectionTasks = tasks.get(section.id!) || [];
                                              return (
                                                <div key={section.id} className="border-t border-gray-50 dark:border-gray-800/30">
                                                  <div className="flex items-center gap-3 pl-16 pr-4 py-2 cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-800/30"
                                                    onClick={() => setDetailSectionId(section.id!)}>
                                                    <Layers className="w-3.5 h-3.5 text-amber-400 flex-shrink-0" />
                                                    <span className="flex-1 text-xs font-medium text-gray-600 dark:text-gray-400">{section.name}</span>
                                                    <span className="text-xs text-gray-400">{sectionTasks.length} 任务</span>
                                                    <button onClick={(e) => { e.stopPropagation(); handleDeleteSection(section.id!, board.id!); }} className="w-6 h-6 flex items-center justify-center rounded-lg hover:bg-red-50 dark:hover:bg-red-900/20 text-gray-400 hover:text-red-500" aria-label="删除子模块">
                                                      <Trash2 className="w-3 h-3" />
                                                    </button>
                                                  </div>
                                                  {sectionTasks.length > 0 && (
                                                    <div className="pb-2">
                                                      {sectionTasks.map((task) => (
                                                        <div key={task.id} className="flex items-center gap-2 pl-20 pr-4 py-1.5 hover:bg-gray-50 dark:hover:bg-gray-800/30 transition-colors" onClick={() => setDetailTaskId(task.id!)} style={{ cursor: "pointer" }}>
                                                          <button onClick={(e) => { e.stopPropagation(); handleToggleTask(task); }} className="flex-shrink-0">
                                                            {task.status === "done" ? <CheckCircle className="w-4 h-4 text-emerald-500" /> : <Circle className="w-4 h-4 text-gray-300" />}
                                                          </button>
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
                                        <div>
                                          {boardStages.map((stage, stageIdx) => {
                                            const stageSections = allSectionsForBoard.filter(s => (s.stageIndex ?? 0) === stageIdx);
                                            const stageKey = `board-${board.id}-stage-${stageIdx}`;
                                            const isStageExpanded = expandedBoardStages.has(stageKey);
                                            return (
                                              <div key={stageIdx}>
                                                <div className="flex items-center gap-3 pl-10 pr-4 py-2 cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-800/30" onClick={() => {
                                                  setExpandedBoardStages(prev => {
                                                    const next = new Set(prev);
                                                    if (next.has(stageKey)) next.delete(stageKey);
                                                    else next.add(stageKey);
                                                    return next;
                                                  });
                                                }}>
                                                  {isStageExpanded ? <ChevronDown className="w-3.5 h-3.5 text-gray-400" /> : <ChevronRight className="w-3.5 h-3.5 text-gray-400" />}
                                                  <Layers className="w-4 h-4 text-indigo-400 flex-shrink-0" />
                                                  <span className="flex-1 text-sm text-gray-700 dark:text-gray-300">{stage.name}</span>
                                                  <span className="text-xs text-gray-400">{stageSections.length} 子模块 · {stage.achievements.length} 成就</span>
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
                                                      {stage.achievements.length > 0 && (
                                                        <div className="pl-16 pr-4 py-1 space-y-0.5">
                                                          {stage.achievements.map((a, i) => (
                                                            <div key={i} className="flex items-center gap-1.5 pl-2 text-xs text-gray-500">
                                                              <Check className="w-3 h-3 text-indigo-400 flex-shrink-0" />{a}
                                                            </div>
                                                          ))}
                                                        </div>
                                                      )}
                                                      {stageSections.map((section) => {
                                                        const sectionTasks = tasks.get(section.id!) || [];
                                                        return (
                                                          <div key={section.id} className="border-t border-gray-50 dark:border-gray-800/30">
                                                            <div className="flex items-center gap-3 pl-16 pr-4 py-2 cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-800/30"
                                                              onClick={() => setDetailSectionId(section.id!)}>
                                                              <Layers className="w-3.5 h-3.5 text-amber-400 flex-shrink-0" />
                                                              <span className="flex-1 text-xs font-medium text-gray-600 dark:text-gray-400">{section.name}</span>
                                                              <span className="text-xs text-gray-400">{sectionTasks.length} 任务</span>
                                                              <button onClick={(e) => { e.stopPropagation(); handleDeleteSection(section.id!, board.id!); }} className="w-6 h-6 flex items-center justify-center rounded-lg hover:bg-red-50 dark:hover:bg-red-900/20 text-gray-400 hover:text-red-500" aria-label="删除子模块">
                                                                <Trash2 className="w-3 h-3" />
                                                              </button>
                                                            </div>
                                                            {sectionTasks.length > 0 && (
                                                              <div className="pb-2">
                                                                {sectionTasks.map((task) => (
                                                                  <div key={task.id} className="flex items-center gap-2 pl-20 pr-4 py-1.5 hover:bg-gray-50 dark:hover:bg-gray-800/30 transition-colors" onClick={() => setDetailTaskId(task.id!)} style={{ cursor: "pointer" }}>
                                                                    <button onClick={(e) => { e.stopPropagation(); handleToggleTask(task); }} className="flex-shrink-0">
                                                                      {task.status === "done" ? <CheckCircle className="w-4 h-4 text-emerald-500" /> : <Circle className="w-4 h-4 text-gray-300" />}
                                                                    </button>
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

      <AnimatePresence>
        {stageSheet && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-50 bg-black/40 flex items-end justify-center" onClick={() => setStageSheet(null)}>
          <motion.div initial={{ y: "100%" }} animate={{ y: 0 }} exit={{ y: "100%" }} transition={{ type: "spring", stiffness: 400, damping: 40 }} onClick={(e) => e.stopPropagation()} className="w-full max-w-lg bg-white dark:bg-gray-900 rounded-t-2xl p-6 max-h-[80vh] overflow-y-auto">
            <h3 className="text-lg font-semibold mb-4 text-gray-900 dark:text-gray-100">添加阶段 · {stageSheet.boardName}</h3>
            <input value={newStageName} onChange={(e) => setNewStageName(e.target.value)} placeholder="阶段名称" className="w-full px-3 py-2 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-sm text-gray-900 dark:text-gray-100 mb-3 focus:outline-none focus:ring-2 focus:ring-blue-500" />
            <p className="text-xs font-medium text-gray-400 dark:text-gray-500 mb-1.5">阶段成就</p>
            <div className="space-y-1 mb-3">
              {newStageAch.map((ach, i) => (
                <div key={i} className="flex items-center gap-1">
                  <input value={ach} onChange={(e) => { const a = [...newStageAch]; a[i] = e.target.value; setNewStageAch(a); }} placeholder={`成就 ${i + 1}`} className="flex-1 px-2 py-1.5 rounded-lg border border-gray-100 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 text-xs focus:outline-none focus:ring-2 focus:ring-blue-500" />
                  <button onClick={() => setNewStageAch((prev) => prev.filter((_, j) => j !== i))} className="w-6 h-6 flex items-center justify-center rounded text-gray-400 hover:text-red-500"><X className="w-3 h-3" /></button>
                </div>
              ))}
              <button onClick={() => setNewStageAch((prev) => [...prev, ""])} className="text-xs text-blue-500 hover:text-blue-600 font-medium">+ 添加成就</button>
            </div>
            <div className="flex gap-3">
              <button onClick={() => setStageSheet(null)} className="flex-1 py-3 rounded-xl border border-gray-200 dark:border-gray-700 text-sm text-gray-500 dark:text-gray-400">取消</button>
              <button onClick={handleAddStage} className="flex-1 py-3 rounded-xl bg-indigo-600 text-white text-sm font-medium">添加</button>
            </div>
          </motion.div>
        </motion.div>
        )}
      </AnimatePresence>

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

      {detailTaskId !== null && (
        <TaskDetail
          taskId={detailTaskId}
          onClose={() => setDetailTaskId(null)}
          onUpdate={loadProjects}
        />
      )}
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
