"use client";

import { useState, useEffect, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { ArrowLeft, Plus, FolderKanban, Trash2, Edit3, ChevronRight, AlertCircle, RotateCcw } from "lucide-react";
import Link from "next/link";
import { getProjectV2, getBoardsByProject, createBoard, updateBoard, deleteBoardToTrash, getSectionsByBoard } from "@/lib/db";
import { showToast } from "@/components/ui/Toast";
import type { ProjectV2, Board } from "@/lib/types";

type BoardWithCount = Board & { sectionCount: number };

export default function ProjectBoardListPage() {
  const params = useParams();
  const router = useRouter();
  const projectId = Number(params.projectId);

  const [project, setProject] = useState<ProjectV2 | null>(null);
  const [boards, setBoards] = useState<BoardWithCount[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [newName, setNewName] = useState("");
  const [saving, setSaving] = useState(false);
  const [editId, setEditId] = useState<number | null>(null);
  const [editName, setEditName] = useState("");

  const loadData = useCallback(async () => {
    try {
      setError(null);
      const [p, b] = await Promise.all([
        getProjectV2(projectId),
        getBoardsByProject(projectId),
      ]);
      if (!p) {
        setError("项目不存在");
        return;
      }
      setProject(p);
      const withCounts = await Promise.all(
        b.map(async (board) => ({
          ...board,
          sectionCount: (await getSectionsByBoard(board.id!)).length,
        }))
      );
      setBoards(withCounts);
    } catch {
      setError("加载面板列表失败");
    } finally {
      setLoading(false);
    }
  }, [projectId]);

  useEffect(() => {
    const load = async () => { await loadData(); };
    load();
  }, [loadData]);

  async function handleCreate() {
    if (!newName.trim()) return;
    setSaving(true);
    try {
      await createBoard(newName.trim(), projectId);
      setNewName("");
      setShowForm(false);
      await loadData();
      showToast({ message: `面板"${newName.trim()}"已创建`, type: "success", duration: 3000 });
    } catch {
      showToast({ message: "创建面板失败", type: "error", duration: 3000 });
    } finally {
      setSaving(false);
    }
  }

  function openEdit(board: BoardWithCount) {
    setEditId(board.id!);
    setEditName(board.name);
  }

  function closeEdit() {
    setEditId(null);
    setEditName("");
  }

  async function handleEdit() {
    if (!editName.trim() || editId === null) return;
    setSaving(true);
    try {
      await updateBoard(editId, { name: editName.trim() });
      closeEdit();
      await loadData();
      showToast({ message: "面板已更新", type: "success", duration: 2000 });
    } catch {
      showToast({ message: "更新面板失败", type: "error", duration: 3000 });
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(board: BoardWithCount) {
    try {
      await deleteBoardToTrash(board.id!);
      await loadData();
      showToast({
        message: `面板"${board.name}"已移至回收站`,
        type: "info",
        duration: 5000,
        undoAction: async () => {
          await createBoard(board.name, projectId);
          await loadData();
        },
      });
    } catch {
      showToast({ message: "删除面板失败", type: "error", duration: 3000 });
    }
  }

  if (loading) {
    return (
      <div className="flex flex-col h-full max-h-screen">
        <header className="flex-shrink-0 flex items-center justify-between px-4 py-3 border-b border-[var(--card-border)] bg-[var(--card-bg)]">
          <div className="flex items-center gap-3">
            <button onClick={() => router.push("/projects")} className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors">
              <ArrowLeft className="w-4 h-4 text-[var(--muted-foreground)]" />
            </button>
            <div className="flex items-center gap-2">
              <div className="skeleton w-5 h-5 rounded" />
              <div className="skeleton h-5 w-32" />
            </div>
          </div>
        </header>
        <div className="flex-1 overflow-y-auto px-4 py-4">
          <div className="flex flex-col gap-3">
            {Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className="rounded-2xl bg-[var(--card-bg)] border border-[var(--card-border)] p-4 space-y-3">
                <div className="flex items-center gap-3">
                  <div className="skeleton w-8 h-8 rounded-lg" />
                  <div className="skeleton h-4 w-28" />
                </div>
                <div className="skeleton h-3 w-16" />
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  if (error || !project) {
    return (
      <div className="flex flex-col h-full max-h-screen">
        <header className="flex-shrink-0 flex items-center px-4 py-3 border-b border-[var(--card-border)] bg-[var(--card-bg)]">
          <button onClick={() => router.push("/projects")} className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors">
            <ArrowLeft className="w-4 h-4 text-[var(--muted-foreground)]" />
          </button>
          <h1 className="ml-2 text-lg font-semibold text-[var(--foreground)]">项目</h1>
        </header>
        <div className="flex-1 flex flex-col items-center justify-center gap-4 px-4">
          <div className="w-14 h-14 rounded-full bg-danger-100 dark:bg-danger-900/30 flex items-center justify-center">
            <AlertCircle className="w-7 h-7 text-danger-500" />
          </div>
          <p className="text-sm text-[var(--muted-foreground)]">{error || "项目不存在"}</p>
          <button
            onClick={loadData}
            className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-primary-500 text-white text-sm font-medium hover:bg-primary-600 transition-colors"
          >
            <RotateCcw className="w-4 h-4" />
            重试
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full max-h-screen">
      <header className="flex-shrink-0 flex items-center justify-between px-4 py-3 border-b border-[var(--card-border)] bg-[var(--card-bg)]">
        <div className="flex items-center gap-3 min-w-0">
          <button
            onClick={() => router.push("/projects")}
            className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors flex-shrink-0"
          >
            <ArrowLeft className="w-4 h-4 text-[var(--muted-foreground)]" />
          </button>
          <div className="flex items-center gap-2 min-w-0">
            <div className="text-xs text-[var(--muted-foreground)] flex-shrink-0">项目</div>
            <span className="text-[var(--muted-foreground)] flex-shrink-0">/</span>
            <div className="flex items-center gap-1.5 min-w-0">
              <div
                className="w-3 h-3 rounded-full flex-shrink-0"
                style={{ backgroundColor: project.color || "#007AFF" }}
              />
              <h1 className="text-lg font-semibold text-[var(--foreground)] truncate">
                {project.name}
              </h1>
            </div>
          </div>
        </div>
        <motion.button
          whileTap={{ scale: 0.95 }}
          onClick={() => setShowForm(!showForm)}
          className="flex items-center gap-1.5 bg-primary-500 text-white px-4 py-2 rounded-xl text-sm font-medium hover:bg-primary-600 transition-colors shadow-sm flex-shrink-0"
        >
          <Plus className="w-4 h-4" />
          新建面板
        </motion.button>
      </header>

      <div className="flex-1 overflow-y-auto overscroll-contain px-4 py-4">
        <AnimatePresence>
          {showForm && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: "auto" }}
              exit={{ opacity: 0, height: 0 }}
              transition={{ duration: 0.2 }}
              className="overflow-hidden"
            >
              <div className="rounded-2xl bg-[var(--card-bg)] border border-[var(--card-border)] p-4 mb-4 space-y-3">
                <div className="flex flex-col gap-1.5">
                  <label className="text-sm font-medium text-[var(--foreground)]">
                    面板名称
                  </label>
                  <input
                    type="text"
                    value={newName}
                    onChange={(e) => setNewName(e.target.value)}
                    placeholder="例如：需求池、开发中、已完成"
                    autoFocus
                    onKeyDown={(e) => {
                      if (e.key === "Enter") handleCreate();
                      if (e.key === "Escape") setShowForm(false);
                    }}
                    className="w-full px-3 py-2.5 rounded-xl border border-[var(--card-border)] bg-[var(--background)] text-sm text-[var(--foreground)] placeholder:text-[var(--muted)] focus:outline-none focus:ring-2 focus:ring-primary-500/30 focus:border-primary-500 transition-colors"
                  />
                </div>

                <div className="flex gap-3 pt-1">
                  <button
                    onClick={() => setShowForm(false)}
                    className="flex-1 px-4 py-2 rounded-xl text-sm font-medium text-[var(--foreground)] border border-[var(--card-border)] hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors"
                  >
                    取消
                  </button>
                  <motion.button
                    whileTap={{ scale: 0.97 }}
                    onClick={handleCreate}
                    disabled={saving || !newName.trim()}
                    className="flex-1 px-4 py-2 rounded-xl text-sm font-medium bg-primary-500 text-white hover:bg-primary-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {saving ? "创建中..." : "创建"}
                  </motion.button>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {boards.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-[60vh] text-center">
            <div className="w-20 h-20 rounded-full bg-gradient-to-br from-primary-100 to-primary-200 dark:from-primary-900/30 dark:to-primary-800/20 flex items-center justify-center mb-5">
              <FolderKanban className="w-10 h-10 text-primary-400" />
            </div>
            <h2 className="text-xl font-bold text-[var(--foreground)] mb-2">
              还没有面板
            </h2>
            <p className="text-sm text-[var(--muted-foreground)] max-w-xs mb-6">
              在项目中创建面板来组织你的分区和任务
            </p>
            <motion.button
              whileTap={{ scale: 0.95 }}
              onClick={() => setShowForm(true)}
              className="bg-primary-500 text-white px-6 py-2.5 rounded-xl font-medium hover:bg-primary-600 transition-colors text-sm"
            >
              创建第一个面板
            </motion.button>
          </div>
        ) : (
          <div className="flex flex-col gap-3">
            {boards.map((board, index) => (
              <motion.div
                key={board.id}
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: index * 0.05 }}
                className="group relative"
              >
                <Link
                  href={`/projects/${projectId}/boards/${board.id}`}
                  className="block rounded-2xl bg-[var(--card-bg)] border border-[var(--card-border)] hover:border-primary-300 p-4 transition-colors"
                >
                  <div className="flex items-center gap-3 mb-2">
                    <div
                      className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0"
                      style={{ backgroundColor: (project.color || "#007AFF") + "20" }}
                    >
                      <FolderKanban
                        className="w-5 h-5"
                        style={{ color: project.color || "#007AFF" }}
                      />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-[var(--foreground)] truncate">
                        {board.name}
                      </p>
                    </div>
                    <ChevronRight className="w-4 h-4 text-[var(--muted-foreground)] flex-shrink-0 opacity-0 group-hover:opacity-100 transition-opacity" />
                  </div>
                  <p className="text-xs text-[var(--muted-foreground)] ml-[52px]">
                    {board.sectionCount} 个分区
                  </p>
                </Link>

                <div className="absolute top-3 right-3 flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                  <button
                    onClick={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      openEdit(board);
                    }}
                    className="w-8 h-8 flex items-center justify-center rounded-lg bg-white dark:bg-gray-800 hover:bg-gray-100 dark:hover:bg-gray-700 shadow-sm border border-[var(--card-border)] transition-colors"
                  >
                    <Edit3 className="w-3.5 h-3.5 text-[var(--muted-foreground)]" />
                  </button>
                  <button
                    onClick={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      handleDelete(board);
                    }}
                    className="w-8 h-8 flex items-center justify-center rounded-lg bg-white dark:bg-gray-800 hover:bg-danger-50 dark:hover:bg-danger-900/20 shadow-sm border border-[var(--card-border)] transition-colors"
                  >
                    <Trash2 className="w-3.5 h-3.5 text-danger-400" />
                  </button>
                </div>
              </motion.div>
            ))}
          </div>
        )}
      </div>

      <AnimatePresence>
        {editId !== null && (
          <>
            <motion.div
              className="fixed inset-0 bg-black/40 z-50"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={closeEdit}
            />
            <motion.div
              className="fixed bottom-0 left-0 right-0 z-50 bg-[var(--card-bg)] rounded-t-2xl shadow-xl md:inset-auto md:top-1/2 md:left-1/2 md:bottom-auto md:right-auto md:w-full md:max-w-sm md:rounded-2xl md:-translate-x-1/2 md:-translate-y-1/2"
              initial={{ y: "100%", opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              exit={{ y: "100%", opacity: 0 }}
              transition={{ type: "spring", stiffness: 400, damping: 30 }}
            >
              <div className="flex items-center justify-between px-5 py-4 border-b border-[var(--card-border)]">
                <h2 className="text-lg font-semibold text-[var(--foreground)]">
                  编辑面板
                </h2>
                <button
                  onClick={closeEdit}
                  className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
                >
                  <Edit3 className="w-5 h-5 text-[var(--muted-foreground)]" />
                </button>
              </div>

              <div className="px-5 py-4 space-y-4">
                <div className="flex flex-col gap-1.5">
                  <label className="text-sm font-medium text-[var(--foreground)]">
                    面板名称
                  </label>
                  <input
                    type="text"
                    value={editName}
                    onChange={(e) => setEditName(e.target.value)}
                    autoFocus
                    onKeyDown={(e) => {
                      if (e.key === "Enter") handleEdit();
                      if (e.key === "Escape") closeEdit();
                    }}
                    className="w-full px-3 py-2.5 rounded-xl border border-[var(--card-border)] bg-[var(--background)] text-sm text-[var(--foreground)] placeholder:text-[var(--muted)] focus:outline-none focus:ring-2 focus:ring-primary-500/30 focus:border-primary-500 transition-colors"
                  />
                </div>
              </div>

              <div className="flex gap-3 px-5 py-4 border-t border-[var(--card-border)]">
                <button
                  onClick={closeEdit}
                  className="flex-1 px-4 py-2.5 rounded-xl text-sm font-medium text-[var(--foreground)] border border-[var(--card-border)] hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors"
                >
                  取消
                </button>
                <motion.button
                  whileTap={{ scale: 0.97 }}
                  onClick={handleEdit}
                  disabled={saving || !editName.trim()}
                  className="flex-1 px-4 py-2.5 rounded-xl text-sm font-medium bg-primary-500 text-white hover:bg-primary-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {saving ? "保存中..." : "保存"}
                </motion.button>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  );
}
