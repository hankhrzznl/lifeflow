"use client";

import { useState, useEffect, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { ArrowLeft, Plus, Layers, Trash2, Edit3, ChevronRight, AlertCircle, RotateCcw } from "lucide-react";
import Link from "next/link";
import { getProjectV2, getBoard, getSectionsByBoard, createSection, updateSection, deleteSectionToTrash } from "@/lib/db";
import { showToast } from "@/components/ui/Toast";
import type { ProjectV2, Board, Section } from "@/lib/types";

export default function BoardSectionListPage() {
  const params = useParams();
  const router = useRouter();
  const projectId = Number(params.projectId);
  const boardId = Number(params.boardId);

  const [project, setProject] = useState<ProjectV2 | null>(null);
  const [board, setBoard] = useState<Board | null>(null);
  const [sections, setSections] = useState<Section[]>([]);
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
      const [p, b, s] = await Promise.all([
        getProjectV2(projectId),
        getBoard(boardId),
        getSectionsByBoard(boardId),
      ]);
      if (!p) {
        setError("项目不存在");
        return;
      }
      if (!b) {
        setError("面板不存在");
        return;
      }
      setProject(p);
      setBoard(b);
      setSections(s);
    } catch {
      setError("加载分区列表失败");
    } finally {
      setLoading(false);
    }
  }, [projectId, boardId]);

  useEffect(() => {
    const load = async () => { await loadData(); };
    load();
  }, [loadData]);

  async function handleCreate() {
    if (!newName.trim()) return;
    setSaving(true);
    try {
      await createSection(newName.trim(), boardId);
      setNewName("");
      setShowForm(false);
      await loadData();
      showToast({ message: `分区"${newName.trim()}"已创建`, type: "success", duration: 3000 });
    } catch {
      showToast({ message: "创建分区失败", type: "error", duration: 3000 });
    } finally {
      setSaving(false);
    }
  }

  function openEdit(section: Section) {
    setEditId(section.id!);
    setEditName(section.name);
  }

  function closeEdit() {
    setEditId(null);
    setEditName("");
  }

  async function handleEdit() {
    if (!editName.trim() || editId === null) return;
    setSaving(true);
    try {
      await updateSection(editId, { name: editName.trim() });
      closeEdit();
      await loadData();
      showToast({ message: "分区已更新", type: "success", duration: 2000 });
    } catch {
      showToast({ message: "更新分区失败", type: "error", duration: 3000 });
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(section: Section) {
    try {
      await deleteSectionToTrash(section.id!);
      await loadData();
      showToast({
        message: `分区"${section.name}"已移至回收站`,
        type: "info",
        duration: 5000,
        undoAction: async () => {
          await createSection(section.name, boardId);
          await loadData();
        },
      });
    } catch {
      showToast({ message: "删除分区失败", type: "error", duration: 3000 });
    }
  }

  if (loading) {
    return (
      <div className="flex flex-col h-full max-h-screen">
        <header className="flex-shrink-0 flex items-center justify-between px-4 py-3 border-b border-[var(--card-border)] bg-[var(--card-bg)]">
          <div className="flex items-center gap-3">
            <button onClick={() => router.push(`/projects/${projectId}`)} className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors">
              <ArrowLeft className="w-4 h-4 text-[var(--muted-foreground)]" />
            </button>
            <div className="flex items-center gap-2">
              <div className="skeleton w-4 h-4 rounded" />
              <div className="skeleton h-4 w-40" />
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

  if (error || !project || !board) {
    return (
      <div className="flex flex-col h-full max-h-screen">
        <header className="flex-shrink-0 flex items-center px-4 py-3 border-b border-[var(--card-border)] bg-[var(--card-bg)]">
          <button onClick={() => router.push(`/projects/${projectId}`)} className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors">
            <ArrowLeft className="w-4 h-4 text-[var(--muted-foreground)]" />
          </button>
          <h1 className="ml-2 text-lg font-semibold text-[var(--foreground)]">分区</h1>
        </header>
        <div className="flex-1 flex flex-col items-center justify-center gap-4 px-4">
          <div className="w-14 h-14 rounded-full bg-danger-100 dark:bg-danger-900/30 flex items-center justify-center">
            <AlertCircle className="w-7 h-7 text-danger-500" />
          </div>
          <p className="text-sm text-[var(--muted-foreground)]">{error || "数据不存在"}</p>
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
            onClick={() => router.push(`/projects/${projectId}`)}
            className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors flex-shrink-0"
          >
            <ArrowLeft className="w-4 h-4 text-[var(--muted-foreground)]" />
          </button>
          <div className="flex items-center gap-2 min-w-0 text-xs text-[var(--muted-foreground)]">
            <Link href={`/projects/${projectId}`} className="hover:text-[var(--foreground)] transition-colors flex-shrink-0">
              项目
            </Link>
            <span className="flex-shrink-0">/</span>
            <Link href={`/projects/${projectId}`} className="hover:text-[var(--foreground)] transition-colors truncate">
              {project.name}
            </Link>
            <span className="flex-shrink-0">/</span>
            <span className="text-[var(--foreground)] font-medium truncate">
              {board.name}
            </span>
          </div>
        </div>
        <motion.button
          whileTap={{ scale: 0.95 }}
          onClick={() => setShowForm(!showForm)}
          className="flex items-center gap-1.5 bg-primary-500 text-white px-4 py-2 rounded-xl text-sm font-medium hover:bg-primary-600 transition-colors shadow-sm flex-shrink-0"
        >
          <Plus className="w-4 h-4" />
          新建分区
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
                    分区名称
                  </label>
                  <input
                    type="text"
                    value={newName}
                    onChange={(e) => setNewName(e.target.value)}
                    placeholder="例如：待办、进行中、已完成"
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

        {sections.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-[60vh] text-center">
            <div className="w-20 h-20 rounded-full bg-gradient-to-br from-primary-100 to-primary-200 dark:from-primary-900/30 dark:to-primary-800/20 flex items-center justify-center mb-5">
              <Layers className="w-10 h-10 text-primary-400" />
            </div>
            <h2 className="text-xl font-bold text-[var(--foreground)] mb-2">
              还没有分区
            </h2>
            <p className="text-sm text-[var(--muted-foreground)] max-w-xs mb-6">
              在面板中创建分区来组织你的任务列表
            </p>
            <motion.button
              whileTap={{ scale: 0.95 }}
              onClick={() => setShowForm(true)}
              className="bg-primary-500 text-white px-6 py-2.5 rounded-xl font-medium hover:bg-primary-600 transition-colors text-sm"
            >
              创建第一个分区
            </motion.button>
          </div>
        ) : (
          <div className="flex flex-col gap-3">
            {sections.map((section, index) => (
              <motion.div
                key={section.id}
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: index * 0.05 }}
                className="group relative"
              >
                <Link
                  href={`/projects/${projectId}/boards/${boardId}/sections/${section.id}`}
                  className="block rounded-2xl bg-[var(--card-bg)] border border-[var(--card-border)] hover:border-primary-300 p-4 transition-colors"
                >
                  <div className="flex items-center gap-3">
                    <div
                      className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0"
                      style={{ backgroundColor: (project.color || "#007AFF") + "20" }}
                    >
                      <Layers
                        className="w-5 h-5"
                        style={{ color: project.color || "#007AFF" }}
                      />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-[var(--foreground)] truncate">
                        {section.name}
                      </p>
                    </div>
                    <ChevronRight className="w-4 h-4 text-[var(--muted-foreground)] flex-shrink-0 opacity-0 group-hover:opacity-100 transition-opacity" />
                  </div>
                </Link>

                <div className="absolute top-3 right-3 flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                  <button
                    onClick={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      openEdit(section);
                    }}
                    className="w-8 h-8 flex items-center justify-center rounded-lg bg-white dark:bg-gray-800 hover:bg-gray-100 dark:hover:bg-gray-700 shadow-sm border border-[var(--card-border)] transition-colors"
                  >
                    <Edit3 className="w-3.5 h-3.5 text-[var(--muted-foreground)]" />
                  </button>
                  <button
                    onClick={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      handleDelete(section);
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
                  编辑分区
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
                    分区名称
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
