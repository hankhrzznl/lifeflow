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

const ICON_MAP: Record<string, React.ComponentType<{ className?: string; style?: React.CSSProperties }>> = {
  GraduationCap, Heart, ClipboardList, Target, Gamepad2, FolderOpen,
  Clock, Wallet, Droplets, Moon, Dumbbell, Pill, StretchHorizontal,
  Utensils, Flower2, FolderKanban,
};

const COLORS = ["#5856D6", "#007AFF", "#34C759", "#FF9500", "#FF3B30", "#AF52DE", "#5AC8FA", "#FF2D55", "#FFCC00", "#00C7BE"];

export default function ProjectsPage() {
  const router = useRouter();

  const allProjects = useLiveQuery(() => getAllProjects(), [], [] as Project[]);

  const bigProjects = allProjects.filter(p => p.projectType === 'big');
  const smallProjects = allProjects.filter(p => p.projectType === 'small');

  const [activeBigId, setActiveBigId] = useState<string>("");

  // ─── Create form ───
  const [showCreate, setShowCreate] = useState(false);
  const [newName, setNewName] = useState("");
  const [newColor, setNewColor] = useState(COLORS[0]);
  const [saving, setSaving] = useState(false);

  // ─── Edit form ───
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState("");
  const [editColor, setEditColor] = useState(COLORS[0]);
  const [editDesc, setEditDesc] = useState("");
  const [editBigId, setEditBigId] = useState("");

  const closeCreate = useCallback(() => {
    setShowCreate(false);
    setNewName("");
    setNewColor(COLORS[0]);
  }, []);

  const closeEdit = useCallback(() => {
    setEditingId(null);
  }, []);

  const openEdit = useCallback((p: Project) => {
    setEditingId(p.id);
    setEditName(p.name);
    setEditColor(p.color);
    setEditDesc(p.description);
    setEditBigId(p.parentProjectId || "");
  }, []);

  const handleCreate = useCallback(async () => {
    if (!newName.trim()) {
      showToast({ type: "warning", message: "请输入项目名称" });
      return;
    }
    setSaving(true);
    try {
      await addProject({
        name: newName.trim(),
        color: newColor,
        icon: "FolderKanban",
        description: "",
        sortOrder: 0,
      });
      showToast({ type: "success", message: "项目已创建" });
      closeCreate();
    } finally {
      setSaving(false);
    }
  }, [newName, newColor, closeCreate]);

  const handleEdit = useCallback(async () => {
    if (!editingId) return;
    if (!editName.trim()) {
      showToast({ type: "warning", message: "请输入项目名称" });
      return;
    }
    await updateProject(editingId, {
      name: editName.trim(),
      color: editColor,
      description: editDesc.trim(),
      parentProjectId: editBigId || undefined,
    } as any);
    showToast({ type: "success", message: "项目已更新" });
    closeEdit();
  }, [editingId, editName, editColor, editDesc, editBigId, closeEdit]);

  const handleDelete = useCallback(async (p: Project) => {
    if (p.isDefault) return;
    if (!window.confirm(`确定删除「${p.name}」？`)) return;
    await deleteProject(p.id);
    showToast({ type: "success", message: `「${p.name}」已删除` });
    if (editingId === p.id) closeEdit();
  }, [editingId, closeEdit]);

  const navigateTo = useCallback((p: Project) => {
    if (p.moreRoute) router.push(p.moreRoute);
  }, [router]);

  const getIcon = (name: string) => ICON_MAP[name] || FolderKanban;

  const filteredSmall = activeBigId
    ? smallProjects.filter(p => p.parentProjectId === activeBigId)
    : smallProjects;
  const defaultSmall = filteredSmall.filter(p => p.isDefault);
  const customSmall = filteredSmall.filter(p => !p.isDefault);

  return (
    <div className="pb-[120px]">
      {/* Header */}
      <div className="flex items-center justify-between px-4 pt-[var(--safe-area-top)] pb-2">
        <button
          type="button" onClick={() => router.push("/")}
          className="inline-flex h-8 w-8 items-center justify-center rounded-lg"
          style={{ background: "var(--color-surface-secondary)" }}
        >
          <ChevronLeft className="w-5 h-5" style={{ color: "var(--color-text-primary)" }} />
        </button>
        <h1 className="text-title-nav mx-2 truncate" style={{ color: "var(--color-text-primary)" }}>项目管理</h1>
        <div className="w-8" />
      </div>

      <div className="px-4 pt-4">
        {/* Big Project Tags */}
        <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="mb-5">
          <p className="text-[12px] font-medium mb-2.5" style={{ color: "var(--color-text-disabled)" }}>项目分类</p>
          <div className="flex gap-2 flex-wrap">
            <button
              onClick={() => setActiveBigId("")}
              className="h-9 px-4 rounded-full text-[13px] font-medium transition-colors"
              style={{
                background: !activeBigId ? "var(--lifeflow-primary)" : "var(--color-surface-secondary)",
                color: !activeBigId ? "var(--lifeflow-primary-foreground)" : "var(--color-text-secondary)",
              }}
            >全部</button>
            {bigProjects.map(bp => {
              const Icon = getIcon(bp.icon);
              return (
                <button key={bp.id} onClick={() => setActiveBigId(activeBigId === bp.id ? "" : bp.id)}
                  className="h-9 px-3.5 rounded-full text-[13px] font-medium transition-colors flex items-center gap-1.5"
                  style={{
                    background: activeBigId === bp.id ? bp.color : "var(--color-surface-secondary)",
                    color: activeBigId === bp.id ? "#fff" : "var(--color-text-secondary)",
                    border: activeBigId !== bp.id ? "1px solid var(--lifeflow-border)" : "none",
                  }}
                ><Icon className="w-3.5 h-3.5" />{bp.name}</button>
              );
            })}
          </div>
        </motion.div>

        {/* Default Small Projects */}
        {defaultSmall.length > 0 && (
          <div className="mb-5">
            <p className="text-[12px] font-medium mb-2.5" style={{ color: "var(--color-text-disabled)" }}>功能模块</p>
            <div className="grid grid-cols-2 gap-2.5">
              {defaultSmall.map((p, i) => {
                const Icon = getIcon(p.icon);
                return (
                  <motion.button key={p.id} initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: i * 0.03 }}
                    onClick={() => navigateTo(p)}
                    className="p-3.5 rounded-[16px] flex items-center gap-3 text-left active:scale-[0.98] transition-transform"
                    style={{ background: "var(--color-surface-card)", boxShadow: "var(--shadow-card)" }}
                  >
                    <div className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0" style={{ background: `${p.color}20` }}>
                      <Icon className="w-5 h-5" style={{ color: p.color }} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="text-[14px] font-semibold truncate" style={{ color: "var(--color-text-primary)" }}>{p.name}</div>
                    </div>
                    <ExternalLink className="w-3.5 h-3.5 flex-shrink-0" style={{ color: "var(--color-text-disabled)" }} />
                  </motion.button>
                );
              })}
            </div>
          </div>
        )}

        {/* Custom Small Projects */}
        <div className="mb-5">
          <div className="flex items-center justify-between mb-2.5">
            <p className="text-[12px] font-medium" style={{ color: "var(--color-text-disabled)" }}>自定义项目</p>
            {customSmall.length > 0 && (
              <button onClick={() => setShowCreate(true)} className="w-6 h-6 rounded-full flex items-center justify-center" style={{ background: "var(--lifeflow-primary)" }}>
                <Plus className="w-3.5 h-3.5 text-white" />
              </button>
            )}
          </div>

          {customSmall.length === 0 ? (
            <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
              className="py-8 flex flex-col items-center text-center rounded-[20px]"
              style={{ background: "var(--color-surface-card)", boxShadow: "var(--shadow-card)" }}
            >
              <div className="w-12 h-12 rounded-full flex items-center justify-center mb-3" style={{ background: "var(--lifeflow-brand-50)" }}>
                <FolderKanban className="w-6 h-6" style={{ color: "var(--lifeflow-primary)" }} />
              </div>
              <p className="text-[14px] font-medium" style={{ color: "var(--color-text-secondary)" }}>暂无自定义项目</p>
              <button onClick={() => setShowCreate(true)}
                className="mt-3 inline-flex items-center gap-1.5 px-4 py-2 rounded-full text-[13px] font-medium text-white"
                style={{ background: "var(--lifeflow-primary)" }}
              ><Plus className="w-3.5 h-3.5" />新建项目</button>
            </motion.div>
          ) : (
            <div className="flex flex-col gap-2">
              {customSmall.map((p, i) => {
                const Icon = getIcon(p.icon);
                const parentBig = bigProjects.find(b => b.id === p.parentProjectId);
                return (
                  <motion.div key={p.id} initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: i * 0.04 }}
                    className="p-3 rounded-[16px] flex items-center gap-3"
                    style={{ background: "var(--color-surface-card)", boxShadow: "var(--shadow-card)" }}
                  >
                    <div className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0" style={{ background: `${p.color}20` }}>
                      <Icon className="w-5 h-5" style={{ color: p.color }} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="text-[14px] font-semibold truncate" style={{ color: "var(--color-text-primary)" }}>{p.name}</div>
                      {p.description && <div className="text-[11px] truncate" style={{ color: "var(--color-text-disabled)" }}>{p.description}</div>}
                      {parentBig && (
                        <span className="text-[10px] px-1.5 py-0.5 rounded-full mt-1 inline-block" style={{ background: `${parentBig.color}15`, color: parentBig.color }}>{parentBig.name}</span>
                      )}
                    </div>
                    <div className="flex items-center gap-1 flex-shrink-0">
                      <button onClick={() => openEdit(p)} className="w-8 h-8 flex items-center justify-center rounded-lg">
                        <Pencil className="w-4 h-4" style={{ color: "var(--color-text-secondary)" }} />
                      </button>
                      <button onClick={() => handleDelete(p)} className="w-8 h-8 flex items-center justify-center rounded-lg">
                        <Trash2 className="w-4 h-4" style={{ color: "var(--color-text-disabled)" }} />
                      </button>
                    </div>
                  </motion.div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* ===== Create Modal ===== */}
      <AnimatePresence>
        {showCreate && (
          <CreateProjectModal
            name={newName} onName={setNewName}
            color={newColor} onColor={setNewColor}
            onSave={handleCreate}
            onClose={closeCreate}
            saving={saving}
          />
        )}
      </AnimatePresence>

      {/* ===== Edit Modal ===== */}
      <AnimatePresence>
        {editingId && (
          <ProjectFormModal
            title="编辑项目"
            name={editName} onName={setEditName}
            desc={editDesc} onDesc={setEditDesc}
            color={editColor} onColor={setEditColor}
            bigId={editBigId} onBigId={setEditBigId}
            bigProjects={bigProjects}
            onSave={handleEdit}
            onClose={closeEdit}
          />
        )}
      </AnimatePresence>
    </div>
  );
}

// ────────────── Create Modal (简化版：仅名称+颜色) ──────────────

function CreateProjectModal({
  name, onName, color, onColor, onSave, onClose, saving,
}: {
  name: string; onName: (v: string) => void;
  color: string; onColor: (v: string) => void;
  onSave: () => void;
  onClose: () => void;
  saving?: boolean;
}) {
  return (
    <>
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
        className="fixed inset-0 z-40" style={{ background: "rgba(0,0,0,0.35)" }}
        onClick={onClose}
      />
      <motion.div
        initial={{ opacity: 0, scale: 0.92 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.92 }}
        transition={{ duration: 0.2 }}
        className="fixed inset-x-4 top-[25%] z-50 p-5 rounded-[24px] mx-auto"
        style={{ background: "var(--color-surface-card)", boxShadow: "0 8px 32px rgba(0,0,0,0.18)", maxWidth: 380 }}
      >
        <h3 className="text-[17px] font-bold mb-4" style={{ color: "var(--color-text-primary)" }}>新建项目</h3>

        <input value={name} onChange={e => onName(e.target.value)}
          placeholder="项目名称" autoFocus
          className="w-full h-11 rounded-xl px-3 text-[15px] outline-none mb-4"
          style={{
            background: "var(--color-surface-secondary)",
            border: "1px solid var(--lifeflow-border)",
            color: "var(--color-text-primary)",
          }}
        />

        {/* Color picker */}
        <p className="text-[12px] mb-2" style={{ color: "var(--color-text-secondary)" }}>颜色</p>
        <div className="flex gap-2 flex-wrap mb-5">
          {COLORS.map(c => (
            <button key={c} onClick={() => onColor(c)}
              className="w-7 h-7 rounded-full transition-all"
              style={{
                background: c,
                boxShadow: color === c ? `0 0 0 3px ${c}40` : "none",
                transform: color === c ? "scale(1.15)" : "scale(1)",
              }}
            />
          ))}
        </div>

        <div className="flex gap-2">
          <button onClick={onClose}
            className="flex-1 h-11 rounded-xl text-[15px] font-medium"
            style={{ background: "var(--color-surface-secondary)", color: "var(--color-text-secondary)" }}
          >取消</button>
          <button onClick={onSave} disabled={saving || !name.trim()}
            className="flex-1 h-11 rounded-xl text-[15px] font-semibold text-white"
            style={{ background: name.trim() ? "var(--lifeflow-primary)" : "var(--lifeflow-border)" }}
          >{saving ? "保存中..." : "保存"}</button>
        </div>
      </motion.div>
    </>
  );
}

// ────────────── Edit Form Modal ──────────────

function ProjectFormModal({
  title, name, onName, desc, onDesc, color, onColor, bigId, onBigId, bigProjects, onSave, onClose, saving,
}: {
  title: string;
  name: string; onName: (v: string) => void;
  desc: string; onDesc: (v: string) => void;
  color: string; onColor: (v: string) => void;
  bigId: string; onBigId: (v: string) => void;
  bigProjects: Project[];
  onSave: () => void;
  onClose: () => void;
  saving?: boolean;
}) {
  return (
    <>
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
        className="fixed inset-0 z-40" style={{ background: "rgba(0,0,0,0.35)" }}
        onClick={onClose}
      />
      <motion.div
        initial={{ opacity: 0, scale: 0.92 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.92 }}
        transition={{ duration: 0.2 }}
        className="fixed inset-x-4 top-[20%] z-50 p-5 rounded-[24px] mx-auto"
        style={{ background: "var(--color-surface-card)", boxShadow: "0 8px 32px rgba(0,0,0,0.18)", maxWidth: 380 }}
      >
        <h3 className="text-[17px] font-bold mb-4" style={{ color: "var(--color-text-primary)" }}>{title}</h3>

        <input value={name} onChange={e => onName(e.target.value)}
          placeholder="项目名称" autoFocus
          className="w-full h-11 rounded-xl px-3 text-[15px] outline-none mb-3"
          style={{
            background: "var(--color-surface-secondary)",
            border: "1px solid var(--lifeflow-border)",
            color: "var(--color-text-primary)",
          }}
        />
        <input value={desc} onChange={e => onDesc(e.target.value)}
          placeholder="描述（可选）"
          className="w-full h-11 rounded-xl px-3 text-[14px] outline-none mb-3"
          style={{ background: "var(--color-surface-secondary)", border: "1px solid var(--lifeflow-border)", color: "var(--color-text-primary)" }}
        />

        {/* Big tag selector */}
        <p className="text-[12px] mb-2" style={{ color: "var(--color-text-secondary)" }}>分类标签</p>
        <div className="flex gap-2 flex-wrap mb-3">
          {bigProjects.map(bp => (
            <button key={bp.id} onClick={() => onBigId(bigId === bp.id ? "" : bp.id)}
              className="h-7 px-2.5 rounded-full text-[11px] font-medium transition-colors"
              style={{
                background: bigId === bp.id ? bp.color : "var(--color-surface-secondary)",
                color: bigId === bp.id ? "#fff" : "var(--color-text-disabled)",
              }}
            >{bp.name}</button>
          ))}
        </div>

        {/* Color picker */}
        <p className="text-[12px] mb-2" style={{ color: "var(--color-text-secondary)" }}>颜色</p>
        <div className="flex gap-2 flex-wrap mb-5">
          {COLORS.map(c => (
            <button key={c} onClick={() => onColor(c)}
              className="w-7 h-7 rounded-full transition-all"
              style={{
                background: c,
                boxShadow: color === c ? `0 0 0 3px ${c}40` : "none",
                transform: color === c ? "scale(1.15)" : "scale(1)",
              }}
            />
          ))}
        </div>

        <div className="flex gap-2">
          <button onClick={onClose}
            className="flex-1 h-11 rounded-xl text-[15px] font-medium"
            style={{ background: "var(--color-surface-secondary)", color: "var(--color-text-secondary)" }}
          >取消</button>
          <button onClick={onSave} disabled={saving || !name.trim()}
            className="flex-1 h-11 rounded-xl text-[15px] font-semibold text-white"
            style={{ background: name.trim() ? "var(--lifeflow-primary)" : "var(--lifeflow-border)" }}
          >{saving ? "保存中..." : "保存"}</button>
        </div>
      </motion.div>
    </>
  );
}
