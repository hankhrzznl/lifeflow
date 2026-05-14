"use client";

import { useState, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { FolderKanban, Plus, Trash2, Pencil, X, Hash, Palette } from "lucide-react";
import {
  createProject,
  getAllProjects,
  updateProject,
  deleteProject,
  getProjectEventCount,
} from "@/lib/db";
import type { Project } from "@/lib/types";

const PROJECT_COLORS = [
  "#6366f1",
  "#8b5cf6",
  "#ec4899",
  "#f43f5e",
  "#f97316",
  "#eab308",
  "#22c55e",
  "#14b8a6",
  "#06b6d4",
  "#3b82f6",
  "#64748b",
  "#78716c",
];

type ProjectWithCount = Project & { eventCount: number };

export default function ProjectsPage() {
  const [projects, setProjects] = useState<ProjectWithCount[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editingProject, setEditingProject] = useState<Project | null>(null);
  const [formName, setFormName] = useState("");
  const [formColor, setFormColor] = useState(PROJECT_COLORS[0]);
  const [saving, setSaving] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);

  const loadProjects = useCallback(async () => {
    const all = await getAllProjects();
    const withCounts = await Promise.all(
      all.map(async (p) => ({
        ...p,
        eventCount: await getProjectEventCount(p.id),
      }))
    );
    setProjects(withCounts);
    setLoading(false);
  }, []);

  useEffect(() => {
    queueMicrotask(() => loadProjects());
  }, [loadProjects]);

  function openCreateModal() {
    setEditingProject(null);
    setFormName("");
    setFormColor(PROJECT_COLORS[0]);
    setShowModal(true);
  }

  function openEditModal(project: Project) {
    setEditingProject(project);
    setFormName(project.name);
    setFormColor(project.color);
    setShowModal(true);
  }

  function closeModal() {
    setShowModal(false);
    setEditingProject(null);
  }

  async function handleSave() {
    if (!formName.trim()) return;
    setSaving(true);
    try {
      if (editingProject) {
        await updateProject(editingProject.id, {
          name: formName.trim(),
          color: formColor,
        });
      } else {
        await createProject(formName.trim(), formColor);
      }
      await loadProjects();
      closeModal();
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(id: string) {
    await deleteProject(id);
    await loadProjects();
    setDeleteConfirm(null);
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="flex flex-col items-center gap-3">
          <div className="w-8 h-8 border-2 border-primary-500 border-t-transparent rounded-full animate-spin" />
          <span className="text-sm text-[var(--muted-foreground)]">加载中...</span>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full max-h-screen">
      <header className="flex-shrink-0 flex items-center justify-between px-4 py-3 border-b border-[var(--card-border)] bg-[var(--card-bg)]">
        <div className="flex items-center gap-2">
          <FolderKanban className="w-5 h-5 text-primary-500" />
          <h1 className="text-lg font-semibold text-[var(--foreground)]">项目管理</h1>
        </div>
        <motion.button
          whileTap={{ scale: 0.95 }}
          onClick={openCreateModal}
          className="flex items-center gap-1.5 bg-primary-500 text-white px-4 py-2 rounded-xl text-sm font-medium hover:bg-primary-600 transition-colors shadow-sm"
        >
          <Plus className="w-4 h-4" />
          新建项目
        </motion.button>
      </header>

      <div className="flex-1 overflow-y-auto overscroll-contain px-4 py-4">
        {projects.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-center">
            <div className="w-20 h-20 rounded-full bg-gradient-to-br from-primary-100 to-primary-200 dark:from-primary-900/30 dark:to-primary-800/20 flex items-center justify-center mb-5">
              <FolderKanban className="w-10 h-10 text-primary-400" />
            </div>
            <h2 className="text-xl font-bold text-[var(--foreground)] mb-2">
              还没有项目
            </h2>
            <p className="text-sm text-[var(--muted-foreground)] max-w-xs mb-6">
              创建项目来组织你的事件，让规划更有条理
            </p>
            <button
              onClick={openCreateModal}
              className="bg-primary-500 text-white px-6 py-2.5 rounded-xl font-medium hover:bg-primary-600 transition-colors text-sm"
            >
              创建第一个项目
            </button>
          </div>
        ) : (
          <div className="flex flex-col gap-3">
            {projects.map((project, index) => (
              <motion.div
                key={project.id}
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: index * 0.05 }}
                className="flex items-center gap-3 px-4 py-3.5 rounded-2xl bg-[var(--card-bg)] border border-[var(--card-border)] hover:border-primary-300 transition-colors group"
              >
                <div
                  className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0"
                  style={{ backgroundColor: project.color + "20" }}
                >
                  <Hash
                    className="w-5 h-5"
                    style={{ color: project.color }}
                  />
                </div>

                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-[var(--foreground)] truncate">
                    {project.name}
                  </p>
                  <p className="text-xs text-[var(--muted-foreground)]">
                    {project.eventCount} 个关联事件
                  </p>
                </div>

                <div
                  className="w-3 h-3 rounded-full flex-shrink-0 ring-1 ring-black/10"
                  style={{ backgroundColor: project.color }}
                />

                <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                  <button
                    onClick={() => openEditModal(project)}
                    className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
                  >
                    <Pencil className="w-4 h-4 text-[var(--muted-foreground)]" />
                  </button>
                  <button
                    onClick={() => setDeleteConfirm(project.id)}
                    className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-danger-50 transition-colors"
                  >
                    <Trash2 className="w-4 h-4 text-danger-400" />
                  </button>
                </div>
              </motion.div>
            ))}
          </div>
        )}
      </div>

      <AnimatePresence>
        {showModal && (
          <>
            <motion.div
              className="fixed inset-0 bg-black/40 z-50"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={closeModal}
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
                  {editingProject ? "编辑项目" : "新建项目"}
                </h2>
                <button
                  onClick={closeModal}
                  className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
                >
                  <X className="w-5 h-5 text-[var(--muted-foreground)]" />
                </button>
              </div>

              <div className="px-5 py-4 flex flex-col gap-4">
                <div className="flex flex-col gap-1.5">
                  <label className="text-sm font-medium text-[var(--foreground)]">
                    项目名称
                  </label>
                  <input
                    type="text"
                    value={formName}
                    onChange={(e) => setFormName(e.target.value)}
                    placeholder="例如：工作、学习、个人"
                    autoFocus
                    className="w-full px-3 py-2.5 rounded-xl border border-[var(--card-border)] bg-[var(--background)] text-sm text-[var(--foreground)] placeholder:text-[var(--muted)] focus:outline-none focus:ring-2 focus:ring-primary-500/30 focus:border-primary-500 transition-colors"
                  />
                </div>

                <div className="flex flex-col gap-2">
                  <label className="text-sm font-medium text-[var(--foreground)] flex items-center gap-1.5">
                    <Palette className="w-4 h-4" />
                    颜色
                  </label>
                  <div className="flex flex-wrap gap-2">
                    {PROJECT_COLORS.map((color) => (
                      <button
                        key={color}
                        onClick={() => setFormColor(color)}
                        className={`w-8 h-8 rounded-lg transition-all ${
                          formColor === color
                            ? "ring-2 ring-offset-2 ring-primary-500 scale-110"
                            : "hover:scale-105"
                        }`}
                        style={{ backgroundColor: color }}
                      />
                    ))}
                  </div>
                </div>
              </div>

              <div className="flex gap-3 px-5 py-4 border-t border-[var(--card-border)]">
                <button
                  onClick={closeModal}
                  className="flex-1 px-4 py-2.5 rounded-xl text-sm font-medium text-[var(--foreground)] border border-[var(--card-border)] hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors"
                >
                  取消
                </button>
                <motion.button
                  whileTap={{ scale: 0.97 }}
                  onClick={handleSave}
                  disabled={saving || !formName.trim()}
                  className="flex-1 px-4 py-2.5 rounded-xl text-sm font-medium bg-primary-500 text-white hover:bg-primary-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {saving ? "保存中..." : "保存"}
                </motion.button>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {deleteConfirm && (
          <>
            <motion.div
              className="fixed inset-0 bg-black/40 z-50"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setDeleteConfirm(null)}
            />
            <motion.div
              className="fixed bottom-0 left-0 right-0 z-50 bg-[var(--card-bg)] rounded-t-2xl shadow-xl md:inset-auto md:top-1/2 md:left-1/2 md:bottom-auto md:right-auto md:w-full md:max-w-sm md:rounded-2xl md:-translate-x-1/2 md:-translate-y-1/2"
              initial={{ y: "100%", opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              exit={{ y: "100%", opacity: 0 }}
              transition={{ type: "spring", stiffness: 400, damping: 30 }}
            >
              <div className="px-5 py-6 text-center">
                <div className="w-14 h-14 rounded-full bg-danger-100 dark:bg-danger-900/30 flex items-center justify-center mx-auto mb-4">
                  <Trash2 className="w-7 h-7 text-danger-500" />
                </div>
                <h3 className="text-lg font-semibold text-[var(--foreground)] mb-2">
                  确认删除
                </h3>
                <p className="text-sm text-[var(--muted-foreground)] mb-6">
                  删除项目后，关联的事件将不再归属于该项目，但不会被删除。
                </p>
                <div className="flex gap-3">
                  <button
                    onClick={() => setDeleteConfirm(null)}
                    className="flex-1 px-4 py-2.5 rounded-xl text-sm font-medium text-[var(--foreground)] border border-[var(--card-border)] hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors"
                  >
                    取消
                  </button>
                  <button
                    onClick={() => handleDelete(deleteConfirm)}
                    className="flex-1 px-4 py-2.5 rounded-xl text-sm font-medium bg-danger-500 text-white hover:bg-danger-600 transition-colors"
                  >
                    确认删除
                  </button>
                </div>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  );
}
