"use client";

import { useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import {
  ChevronLeft, Plus, Trash2, Pencil, FolderKanban,
  GraduationCap, Heart, ClipboardList, Target, Gamepad2, FolderOpen,
  Clock, Wallet, Droplets, Moon, Dumbbell, Pill, StretchHorizontal,
  Utensils, Flower2, ExternalLink,
} from "lucide-react";
import { useLiveQuery } from "dexie-react-hooks";
import { getAllProjects, addProject, updateProject, deleteProject } from "@/lib/db/efficiency.db";
import type { Project } from "@/lib/db/efficiency.db";
import { showToast } from "@/components/ui/Toast";

// ============================================================
// Icon name → component map
// ============================================================

const ICON_MAP: Record<string, React.ComponentType<{ className?: string; style?: React.CSSProperties }>> = {
  GraduationCap, Heart, ClipboardList, Target, Gamepad2, FolderOpen,
  Clock, Wallet, Droplets, Moon, Dumbbell, Pill, StretchHorizontal,
  Utensils, Flower2, FolderKanban,
};

const COLORS = ["#5856D6", "#007AFF", "#34C759", "#FF9500", "#FF3B30", "#AF52DE", "#5AC8FA", "#FF2D55", "#FFCC00"];

// ============================================================

export default function ProjectsPage() {
  const router = useRouter();

  const allProjects = useLiveQuery(() => getAllProjects(), [], [] as Project[]);

  const bigProjects = allProjects.filter(p => p.projectType === 'big');
  const smallProjects = allProjects.filter(p => p.projectType === 'small');

  // Filter state
  const [activeBigId, setActiveBigId] = useState<string>("");

  // Form state
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [formName, setFormName] = useState("");
  const [formColor, setFormColor] = useState(COLORS[0]);
  const [formDescription, setFormDescription] = useState("");

  // Which big project tag this new small project belongs to (optional)
  const [formBigId, setFormBigId] = useState<string>("");

  const filteredSmall = activeBigId
    ? smallProjects.filter(p => p.parentProjectId === activeBigId)
    : smallProjects;

  // Separate defaults from custom
  const defaultSmall = filteredSmall.filter(p => p.isDefault);
  const customSmall = filteredSmall.filter(p => !p.isDefault);

  const resetForm = useCallback(() => {
    setFormName("");
    setFormColor(COLORS[0]);
    setFormDescription("");
    setEditingId(null);
    setShowForm(false);
    setFormBigId("");
  }, []);

  const handleAddSmall = useCallback(() => {
    resetForm();
    setShowForm(true);
  }, [resetForm]);

  const handleEditSmall = useCallback((p: Project) => {
    setFormName(p.name);
    setFormColor(p.color);
    setFormDescription(p.description);
    setFormBigId(p.parentProjectId || "");
    setEditingId(p.id);
    setShowForm(true);
  }, []);

  const handleSave = useCallback(async () => {
    if (!formName.trim()) {
      showToast({ type: "warning", message: "请输入项目名称" });
      return;
    }
    const data = {
      name: formName.trim(),
      color: formColor,
      icon: "FolderKanban",
      description: formDescription.trim(),
      sortOrder: 0,
      projectType: 'small' as const,
      parentProjectId: formBigId || undefined,
    };
    if (editingId) {
      await updateProject(editingId, data as any);
      showToast({ type: "success", message: "项目已更新" });
    } else {
      await addProject(data);
      showToast({ type: "success", message: "项目已添加" });
    }
    resetForm();
  }, [formName, formColor, formDescription, formBigId, editingId, resetForm]);

  const handleDeleteSmall = useCallback(async (p: Project) => {
    if (p.isDefault) return;
    if (!window.confirm(`确定删除项目「${p.name}」？`)) return;
    await deleteProject(p.id);
    showToast({ type: "success", message: `「${p.name}」已删除` });
    if (editingId === p.id) resetForm();
  }, [editingId, resetForm]);

  const navigateTo = useCallback((p: Project) => {
    if (p.moreRoute) {
      router.push(p.moreRoute);
    }
  }, [router]);

  const getIcon = (iconName: string) => {
    const Icon = ICON_MAP[iconName];
    return Icon || FolderKanban;
  };

  return (
    <div className="pb-[100px]">
      {/* Header */}
      <div className="flex items-center justify-between px-4 pt-[var(--safe-area-top)] pb-2">
        <button
          type="button"
          onClick={() => router.push("/more")}
          className="inline-flex h-8 w-8 items-center justify-center rounded-lg"
          style={{ background: "var(--color-surface-secondary)" }}
        >
          <ChevronLeft className="w-5 h-5" style={{ color: "var(--color-text-primary)" }} />
        </button>
        <h1 className="text-title-nav mx-2 truncate" style={{ color: "var(--color-text-primary)" }}>
          项目管理
        </h1>
        <div className="w-8" />
      </div>

      <div className="px-4 pt-4">
        {/* ─── Big Project Tags ─── */}
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-5"
        >
          <p className="text-[12px] font-medium mb-2.5" style={{ color: "var(--color-text-disabled)" }}>
            项目分类
          </p>
          <div className="flex gap-2 flex-wrap">
            <button
              type="button"
              onClick={() => setActiveBigId("")}
              className="h-9 px-4 rounded-full text-[13px] font-medium transition-colors"
              style={{
                background: activeBigId === "" ? "var(--lifeflow-primary)" : "var(--color-surface-secondary)",
                color: activeBigId === "" ? "var(--lifeflow-primary-foreground)" : "var(--color-text-secondary)",
              }}
            >
              全部
            </button>
            {bigProjects.map(bp => {
              const Icon = getIcon(bp.icon);
              return (
                <button
                  key={bp.id}
                  type="button"
                  onClick={() => setActiveBigId(activeBigId === bp.id ? "" : bp.id)}
                  className="h-9 px-3.5 rounded-full text-[13px] font-medium transition-colors flex items-center gap-1.5"
                  style={{
                    background: activeBigId === bp.id ? bp.color : "var(--color-surface-secondary)",
                    color: activeBigId === bp.id ? "#fff" : "var(--color-text-secondary)",
                    border: activeBigId === bp.id ? "none" : "1px solid var(--lifeflow-border)",
                  }}
                >
                  <Icon className="w-3.5 h-3.5" />
                  {bp.name}
                </button>
              );
            })}
          </div>
        </motion.div>

        {/* ─── Default Small Projects (不可删改) ─── */}
        {defaultSmall.length > 0 && (
          <div className="mb-5">
            <p className="text-[12px] font-medium mb-2.5" style={{ color: "var(--color-text-disabled)" }}>
              功能模块
            </p>
            <div className="grid grid-cols-2 gap-2.5">
              {defaultSmall.map((p, i) => {
                const Icon = getIcon(p.icon);
                return (
                  <motion.button
                    key={p.id}
                    initial={{ opacity: 0, y: 12 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: i * 0.03 }}
                    onClick={() => navigateTo(p)}
                    className="p-3.5 rounded-[16px] flex items-center gap-3 text-left active:scale-[0.98] transition-transform"
                    style={{
                      background: "var(--color-surface-card)",
                      boxShadow: "var(--shadow-card)",
                    }}
                  >
                    <div
                      className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0"
                      style={{ background: `${p.color}20` }}
                    >
                      <Icon className="w-5 h-5" style={{ color: p.color }} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="text-[14px] font-semibold truncate" style={{ color: "var(--color-text-primary)" }}>
                        {p.name}
                      </div>
                    </div>
                    <ExternalLink className="w-3.5 h-3.5 flex-shrink-0" style={{ color: "var(--color-text-disabled)" }} />
                  </motion.button>
                );
              })}
            </div>
          </div>
        )}

        {/* ─── Custom Small Projects (可增删改) ─── */}
        <div className="mb-5">
          <div className="flex items-center justify-between mb-2.5">
            <p className="text-[12px] font-medium" style={{ color: "var(--color-text-disabled)" }}>
              自定义项目
            </p>
            <button onClick={handleAddSmall} className="w-6 h-6 rounded-full flex items-center justify-center" style={{ background: "var(--lifeflow-primary)" }}>
              <Plus className="w-3.5 h-3.5 text-white" />
            </button>
          </div>

          {/* Add/Edit form */}
          <AnimatePresence mode="wait">
            {showForm ? (
              <motion.div
                key="form"
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: "auto" }}
                exit={{ opacity: 0, height: 0 }}
                className="overflow-hidden mb-3"
              >
                <div
                  className="p-4 rounded-[20px]"
                  style={{ background: "var(--color-surface-card)", boxShadow: "var(--shadow-card)" }}
                >
                  <input
                    type="text" value={formName} onChange={(e) => setFormName(e.target.value)}
                    placeholder="项目名称" autoFocus
                    className="w-full text-[15px] outline-none bg-transparent mb-3"
                    style={{ color: "var(--color-text-primary)" }}
                  />
                  <input
                    type="text" value={formDescription} onChange={(e) => setFormDescription(e.target.value)}
                    placeholder="描述（可选）"
                    className="w-full h-10 rounded-lg px-3 text-[14px] outline-none mb-3"
                    style={{ background: "var(--color-surface-secondary)", border: "1px solid var(--lifeflow-border)" }}
                  />
                  {/* Big project tag selector */}
                  <div className="mb-3">
                    <p className="text-[12px] mb-2" style={{ color: "var(--color-text-secondary)" }}>分类标签</p>
                    <div className="flex gap-2 flex-wrap">
                      {bigProjects.map(bp => (
                        <button
                          key={bp.id}
                          type="button"
                          onClick={() => setFormBigId(formBigId === bp.id ? "" : bp.id)}
                          className="h-7 px-2.5 rounded-full text-[11px] font-medium transition-colors"
                          style={{
                            background: formBigId === bp.id ? bp.color : "var(--color-surface-secondary)",
                            color: formBigId === bp.id ? "#fff" : "var(--color-text-disabled)",
                          }}
                        >
                          {bp.name}
                        </button>
                      ))}
                    </div>
                  </div>
                  {/* Color picker */}
                  <div className="mb-3">
                    <p className="text-[12px] mb-2" style={{ color: "var(--color-text-secondary)" }}>颜色</p>
                    <div className="flex gap-2.5 flex-wrap">
                      {COLORS.map(c => (
                        <button
                          key={c} type="button" onClick={() => setFormColor(c)}
                          className="w-6 h-6 rounded-full transition-all"
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
                    <button onClick={resetForm} className="flex-1 h-10 rounded-lg text-[14px]" style={{ background: "var(--color-surface-secondary)", color: "var(--color-text-secondary)" }}>
                      取消
                    </button>
                    <button onClick={handleSave} className="flex-1 h-10 rounded-lg text-[14px] font-semibold text-white" style={{ background: "var(--lifeflow-primary)" }}>
                      {editingId ? "更新" : "添加"}
                    </button>
                  </div>
                </div>
              </motion.div>
            ) : (
              customSmall.length === 0 && !showForm && (
                <motion.div
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="py-8 flex flex-col items-center justify-center text-center rounded-[20px]"
                  style={{ background: "var(--color-surface-card)", boxShadow: "var(--shadow-card)" }}
                >
                  <div className="w-12 h-12 rounded-full flex items-center justify-center mb-3" style={{ background: "var(--lifeflow-brand-50)" }}>
                    <FolderKanban className="w-6 h-6" style={{ color: "var(--lifeflow-primary)" }} />
                  </div>
                  <p className="text-[14px] font-medium" style={{ color: "var(--color-text-secondary)" }}>
                    暂无自定义项目
                  </p>
                  <button
                    onClick={handleAddSmall}
                    className="mt-3 inline-flex items-center gap-1.5 px-4 py-2 rounded-full text-[13px] font-medium text-white"
                    style={{ background: "var(--lifeflow-primary)" }}
                  >
                    <Plus className="w-3.5 h-3.5" />
                    新建项目
                  </button>
                </motion.div>
              )
            )}
          </AnimatePresence>

          {/* Custom project cards */}
          <div className="flex flex-col gap-2">
            {customSmall.map((p, i) => {
              const Icon = getIcon(p.icon);
              const parentBig = bigProjects.find(b => b.id === p.parentProjectId);
              return (
                <motion.div
                  key={p.id}
                  initial={{ opacity: 0, y: 12 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: i * 0.04 }}
                  className="p-3 rounded-[16px] flex items-center gap-3"
                  style={{ background: "var(--color-surface-card)", boxShadow: "var(--shadow-card)" }}
                >
                  <div className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0" style={{ background: `${p.color}20` }}>
                    <Icon className="w-5 h-5" style={{ color: p.color }} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-[14px] font-semibold truncate" style={{ color: "var(--color-text-primary)" }}>
                      {p.name}
                    </div>
                    {p.description && (
                      <div className="text-[11px] truncate" style={{ color: "var(--color-text-disabled)" }}>{p.description}</div>
                    )}
                    {parentBig && (
                      <span className="text-[10px] px-1.5 py-0.5 rounded-full mt-1 inline-block" style={{ background: `${parentBig.color}15`, color: parentBig.color }}>
                        {parentBig.name}
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-1 flex-shrink-0">
                    <button onClick={() => handleEditSmall(p)} className="w-8 h-8 flex items-center justify-center rounded-lg">
                      <Pencil className="w-4 h-4" style={{ color: "var(--color-text-secondary)" }} />
                    </button>
                    <button onClick={() => handleDeleteSmall(p)} className="w-8 h-8 flex items-center justify-center rounded-lg">
                      <Trash2 className="w-4 h-4" style={{ color: "var(--color-text-disabled)" }} />
                    </button>
                  </div>
                </motion.div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
