"use client";

import { useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { ChevronLeft, Plus, Trash2, Target, Pencil, FolderKanban } from "lucide-react";
import { useLiveQuery } from "dexie-react-hooks";
import { getAllProjects, addProject, updateProject, deleteProject } from "@/lib/db/efficiency.db";
import { getAllGoalsV2 } from "@/lib/db/efficiency.db";
import type { Project, Goal } from "@/lib/db/efficiency.db";
import { showToast } from "@/components/ui/Toast";

const COLORS = ["#5856D6", "#007AFF", "#34C759", "#FF9500", "#FF3B30", "#AF52DE", "#5AC8FA", "#FF2D55", "#FFCC00"];

const FILTERS = [
  { key: "", label: "全部" },
  { key: "学习", label: "学习" },
  { key: "工作", label: "工作" },
  { key: "个人", label: "个人" },
  { key: "生活", label: "生活" },
  { key: "旅行", label: "旅行" },
] as const;

export default function ProjectsPage() {
  const router = useRouter();

  const projects = useLiveQuery(() => getAllProjects(), [], [] as Project[]);
  const goals = useLiveQuery(() => getAllGoalsV2(), [], [] as Goal[]);

  const [activeFilter, setActiveFilter] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [adding, setAdding] = useState(false);
  const [formName, setFormName] = useState("");
  const [formColor, setFormColor] = useState(COLORS[0]);
  const [formDescription, setFormDescription] = useState("");

  const filteredProjects = activeFilter
    ? (projects ?? []).filter((p) => p.name.includes(activeFilter))
    : (projects ?? []);

  const resetForm = useCallback(() => {
    setFormName("");
    setFormColor(COLORS[0]);
    setFormDescription("");
    setEditingId(null);
    setAdding(false);
  }, []);

  const populateForm = useCallback((p: Project) => {
    setFormName(p.name);
    setFormColor(p.color);
    setFormDescription(p.description);
  }, []);

  const getGoalCountForProject = useCallback(
    (projectId: string) => goals.filter((g) => g.projectId === projectId).length,
    [goals]
  );

  const handleSave = useCallback(async () => {
    if (!formName.trim()) {
      showToast({ type: "warning", message: "请输入项目名称" });
      return;
    }
    const data = { name: formName.trim(), color: formColor, icon: "Folder", description: formDescription.trim(), sortOrder: 0 };
    if (editingId) {
      await updateProject(editingId, data);
      showToast({ type: "success", message: "项目已更新" });
    } else {
      await addProject(data);
      showToast({ type: "success", message: "项目已添加" });
    }
    resetForm();
  }, [formName, formColor, formDescription, editingId, resetForm]);

  const handleEdit = useCallback((p: Project) => {
    setEditingId(p.id);
    populateForm(p);
    setAdding(false);
  }, [populateForm]);

  const handleDelete = useCallback(
    async (p: Project) => {
      const goalCount = getGoalCountForProject(p.id);
      const msg = goalCount > 0 ? `"${p.name}" 下有 ${goalCount} 个目标，确定删除？` : `确定删除项目 "${p.name}"？`;
      if (!window.confirm(msg)) return;
      await deleteProject(p.id);
      showToast({ type: "success", message: `项目 "${p.name}" 已删除` });
      if (editingId === p.id) resetForm();
    },
    [editingId, resetForm, getGoalCountForProject]
  );

  const showForm = adding || editingId !== null;

  return (
    <div className="pb-[100px]">
      {/* Header */}
      <div className="flex items-center justify-between px-4 pt-3 pb-2">
        <button
          type="button"
          onClick={() => router.push("/more")}
          className="inline-flex h-8 w-8 items-center justify-center rounded-lg"
          style={{
            background: "var(--color-surface-secondary)",
          }}
        >
          <ChevronLeft className="w-5 h-5" style={{ color: "var(--color-text-primary)" }} />
        </button>
        <h1 className="text-title-nav mx-2 truncate" style={{ color: "var(--color-text-primary)" }}>
          项目管理
        </h1>
        <button
          type="button"
          onClick={() => setAdding(true)}
          className="inline-flex h-8 w-8 items-center justify-center rounded-lg"
          style={{
            background: "var(--lifeflow-primary)",
          }}
        >
          <Plus className="w-5 h-5" style={{ color: "var(--lifeflow-primary-foreground)" }} />
        </button>
      </div>

      <div className="px-4 pt-5">
        {/* Filter pills */}
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          className="flex gap-2 mb-4 overflow-x-auto no-scrollbar"
        >
          {FILTERS.map((f) => (
            <button
              key={f.key}
              type="button"
              onClick={() => setActiveFilter(f.key)}
              className="h-9 px-4 rounded-full text-[14px] font-medium whitespace-nowrap shrink-0 transition-colors"
              style={{
                background: activeFilter === f.key ? "var(--lifeflow-primary)" : "var(--color-surface-secondary)",
                color: activeFilter === f.key ? "var(--lifeflow-primary-foreground)" : "var(--color-text-secondary)",
              }}
            >
              {f.label}
            </button>
          ))}
        </motion.div>

        {/* Add / Edit form */}
        <AnimatePresence mode="wait">
          {showForm ? (
            <motion.div
              key="form"
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: "auto" }}
              exit={{ opacity: 0, height: 0 }}
              className="card-standard p-4 mb-4 overflow-hidden"
            >
              <input
                type="text" value={formName} onChange={(e) => setFormName(e.target.value)}
                placeholder="项目名称（如：学习、健身）" autoFocus
                className="w-full text-[16px] outline-none bg-transparent mb-3"
                style={{ color: "var(--color-text-primary)" }}
              />
              <input
                type="text" value={formDescription} onChange={(e) => setFormDescription(e.target.value)}
                placeholder="项目描述（可选）"
                className="w-full h-10 rounded-lg px-3 text-[15px] outline-none mb-3"
                style={{ background: "var(--color-surface-secondary)", border: "1px solid var(--lifeflow-border)" }}
              />
              <div className="mb-3">
                <p className="text-[13px] mb-2" style={{ color: "var(--color-text-secondary)" }}>颜色</p>
                <div className="flex gap-2.5 flex-wrap">
                  {COLORS.map((c) => (
                    <button
                      key={c}
                      type="button"
                      onClick={() => setFormColor(c)}
                      className="w-7 h-7 rounded-full transition-all"
                      style={{
                        background: c,
                        boxShadow: formColor === c ? `0 0 0 3px ${c}40` : "none",
                        transform: formColor === c ? "scale(1.15)" : "scale(1)",
                      }}
                    />
                  ))}
                </div>
              </div>
              <div className="flex gap-2">
                <button
                  onClick={resetForm}
                  className="flex-1 h-10 rounded-lg text-[15px]"
                  style={{ background: "var(--color-surface-secondary)", color: "var(--color-text-secondary)" }}
                >
                  取消
                </button>
                <button
                  onClick={handleSave}
                  className="flex-1 h-10 rounded-lg text-[15px] font-semibold text-white"
                  style={{ background: "var(--lifeflow-primary)" }}
                >
                  {editingId ? "更新" : "添加"}
                </button>
              </div>
            </motion.div>
          ) : (
            <button
              onClick={() => setAdding(true)}
              className="w-full h-11 flex items-center justify-center gap-2 rounded-[20px] mb-4 text-[15px] font-medium"
              style={{
                background: "var(--lifeflow-brand-50)",
                color: "var(--lifeflow-primary)",
                border: "1px dashed var(--lifeflow-brand-200)",
              }}
            >
              <Plus className="w-4 h-4" />
              添加项目
            </button>
          )}
        </AnimatePresence>

        {/* Project list */}
        <div className="flex flex-col gap-3">
          {filteredProjects.map((p, i) => {
            const goalCount = getGoalCountForProject(p.id);
            return (
              <motion.div
                key={p.id}
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.04 }}
                className="card-standard p-4"
              >
                <div className="flex items-center gap-3">
                  <div className="w-3.5 h-3.5 rounded-full flex-shrink-0" style={{ background: p.color }} />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <h3 className="text-[16px] font-semibold truncate" style={{ color: "var(--color-text-primary)" }}>
                        {p.name}
                      </h3>
                      {p.description && (
                        <span className="text-[13px] truncate" style={{ color: "var(--color-text-disabled)" }}>
                          {p.description}
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-1 mt-0.5">
                      <Target className="w-3.5 h-3.5" style={{ color: "var(--color-text-secondary)" }} />
                      <span className="text-[13px]" style={{ color: "var(--color-text-secondary)" }}>
                        {goalCount} 个目标
                      </span>
                    </div>
                  </div>
                  <div className="flex items-center gap-1 flex-shrink-0">
                    <button
                      onClick={(e) => { e.stopPropagation(); handleEdit(p); }}
                      className="w-8 h-8 flex items-center justify-center rounded-lg"
                    >
                      <Pencil className="w-4 h-4" style={{ color: "var(--color-text-secondary)" }} />
                    </button>
                    <button
                      onClick={(e) => { e.stopPropagation(); handleDelete(p); }}
                      className="w-8 h-8 flex items-center justify-center rounded-lg"
                    >
                      <Trash2 className="w-4 h-4" style={{ color: "var(--color-text-disabled)" }} />
                    </button>
                  </div>
                </div>
              </motion.div>
            );
          })}
        </div>

        {/* Empty state */}
        {(projects ?? []).length === 0 && !showForm && (
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            className="flex flex-1 flex-col items-center justify-center px-4"
          >
            <div
              className="w-full max-w-sm flex flex-col items-center text-center p-8"
              style={{
                backgroundColor: "var(--color-surface-card)",
                borderRadius: 20,
                boxShadow: "var(--shadow-card)",
              }}
            >
              <div className="w-16 h-16 rounded-full flex items-center justify-center mb-4" style={{ backgroundColor: "var(--lifeflow-brand-50)" }}>
                <FolderKanban className="w-8 h-8" style={{ color: "var(--lifeflow-primary)" }} />
              </div>
              <p className="text-[17px] mb-1" style={{ color: "var(--color-text-primary)", letterSpacing: "-0.022em" }}>
                暂无项目
              </p>
              <p className="text-[13px] font-medium mb-6" style={{ color: "var(--color-text-secondary)", letterSpacing: "-0.01em" }}>
                创建你的第一个项目，开始管理任务
              </p>
              <button
                onClick={() => setAdding(true)}
                className="inline-flex items-center justify-center rounded-full h-10 px-6 text-[14px] font-medium"
                style={{
                  backgroundColor: "var(--lifeflow-primary)",
                  color: "var(--lifeflow-primary-foreground)",
                }}
              >
                创建项目
              </button>
            </div>
          </motion.div>
        )}
      </div>
    </div>
  );
}
