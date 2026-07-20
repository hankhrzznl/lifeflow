"use client";

import { useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { ChevronLeft, Plus, Trash2, Pencil, Target, Check, X } from "lucide-react";
import { useLiveQuery } from "dexie-react-hooks";
import { getAllProjects, addProject, updateProject, deleteProject } from "@/lib/db/efficiency.db";
import { getAllGoalsV2 } from "@/lib/db/efficiency.db";
import type { Project, Goal } from "@/lib/db/efficiency.db";
import { showToast } from "@/components/ui/Toast";

const COLORS = ["#5856D6", "#007AFF", "#34C759", "#FF9500", "#FF3B30", "#AF52DE", "#5AC8FA", "#FF2D55", "#FFCC00"];

export default function ProjectsPage() {
  const router = useRouter();

  const projects = useLiveQuery(() => getAllProjects(), [], [] as Project[]);
  const goals = useLiveQuery(() => getAllGoalsV2(), [], [] as Goal[]);

  const [editingId, setEditingId] = useState<string | null>(null);
  const [adding, setAdding] = useState(false);

  // Form state
  const [formName, setFormName] = useState("");
  const [formColor, setFormColor] = useState(COLORS[0]);
  const [formDescription, setFormDescription] = useState("");

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
    (projectId: string): number => {
      return goals.filter((g) => g.projectId === projectId).length;
    },
    [goals]
  );

  const handleSave = useCallback(async () => {
    if (!formName.trim()) {
      showToast({ type: "warning", message: "请输入项目名称" });
      return;
    }

    const data = {
      name: formName.trim(),
      color: formColor,
      icon: "Folder",
      description: formDescription.trim(),
      sortOrder: 0,
    };

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
    window.scrollTo({ top: 0, behavior: "smooth" });
  }, [populateForm]);

  const handleDelete = useCallback(
    async (p: Project) => {
      const goalCount = getGoalCountForProject(p.id);
      const confirmMsg =
        goalCount > 0
          ? `"${p.name}" 下有 ${goalCount} 个目标，确定删除？`
          : `确定删除项目 "${p.name}"？`;

      if (!window.confirm(confirmMsg)) return;

      await deleteProject(p.id);
      showToast({ type: "success", message: `项目 "${p.name}" 已删除` });
      if (editingId === p.id) resetForm();
    },
    [editingId, resetForm, getGoalCountForProject]
  );

  const handleCancelEdit = useCallback(() => {
    resetForm();
  }, [resetForm]);

  const showForm = adding || editingId !== null;

  return (
    <div className="px-4 pt-5 pb-6">
      {/* 页头 */}
      <div className="flex items-center gap-2 mb-4">
        <button
          type="button"
          onClick={() => router.push("/more")}
          className="w-8 h-8 -ml-1 flex items-center justify-center"
        >
          <ChevronLeft className="w-6 h-6" />
        </button>
        <h1 className="text-[34px] font-bold tracking-[-0.02em] leading-tight flex-1">
          项目管理
        </h1>
      </div>
      <p className="text-[15px] mb-4" style={{ color: "#8E8E93" }}>
        管理目标分类项目
      </p>

      {/* 添加 / 编辑表单 */}
      <AnimatePresence mode="wait">
        {showForm ? (
          <motion.div
            key="form"
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            className="rounded-xl bg-white p-4 mb-4 shadow-[0_1px_4px_rgba(0,0,0,0.04)] overflow-hidden"
          >
            {/* 项目名称 */}
            <input
              type="text"
              value={formName}
              onChange={(e) => setFormName(e.target.value)}
              placeholder="项目名称（如：学习、健身）"
              autoFocus
              className="w-full text-[17px] outline-none mb-3 py-1"
            />

            {/* 描述 */}
            <input
              type="text"
              value={formDescription}
              onChange={(e) => setFormDescription(e.target.value)}
              placeholder="项目描述（可选）"
              className="w-full h-10 rounded-lg px-3 text-[15px] outline-none border mb-3"
              style={{ borderColor: "#E5E5E5" }}
            />

            {/* 颜色选择 */}
            <div className="mb-3">
              <p className="text-[13px] mb-2" style={{ color: "#8E8E93" }}>
                颜色
              </p>
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

            {/* 操作按钮 */}
            <div className="flex gap-2">
              <button
                onClick={handleCancelEdit}
                className="flex-1 h-10 rounded-lg text-[15px]"
                style={{ background: "#F2F2F7", color: "#8E8E93" }}
              >
                取消
              </button>
              <button
                onClick={handleSave}
                className="flex-1 h-10 rounded-lg text-[15px] font-semibold text-white"
                style={{ background: "#6366F1" }}
              >
                {editingId ? "更新" : "添加"}
              </button>
            </div>
          </motion.div>
        ) : (
          <button
            onClick={() => setAdding(true)}
            className="w-full h-11 flex items-center justify-center gap-2 rounded-xl mb-4 text-[15px] font-medium"
            style={{
              background: "#6366F110",
              color: "#6366F1",
              border: "1px dashed #6366F140",
            }}
          >
            <Plus className="w-4 h-4" />
            添加项目
          </button>
        )}
      </AnimatePresence>

      {/* 项目列表 */}
      <div className="flex flex-col gap-3">
        {(projects ?? []).map((p, i) => {
          const goalCount = getGoalCountForProject(p.id);
          return (
            <motion.div
              key={p.id}
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.04 }}
              className="rounded-xl bg-white p-4 shadow-[0_1px_4px_rgba(0,0,0,0.04)]"
            >
              <div className="flex items-center gap-3">
                {/* 颜色圆点 */}
                <div
                  className="w-3.5 h-3.5 rounded-full flex-shrink-0"
                  style={{ background: p.color }}
                />

                {/* 名称 + 描述 */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <h3 className="text-[17px] font-semibold truncate">
                      {p.name}
                    </h3>
                    {p.description && (
                      <span
                        className="text-[13px] truncate"
                        style={{ color: "#AEAEB2" }}
                      >
                        {p.description}
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-1 mt-0.5">
                    <Target className="w-3.5 h-3.5" style={{ color: "#8E8E93" }} />
                    <span className="text-[13px]" style={{ color: "#8E8E93" }}>
                      {goalCount} 个目标
                    </span>
                  </div>
                </div>

                {/* 操作按钮 */}
                <div className="flex items-center gap-1 flex-shrink-0">
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      handleEdit(p);
                    }}
                    className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-gray-50"
                  >
                    <Pencil className="w-4 h-4" style={{ color: "#8E8E93" }} />
                  </button>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      handleDelete(p);
                    }}
                    className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-gray-50"
                  >
                    <Trash2 className="w-4 h-4" style={{ color: "#C7C7CC" }} />
                  </button>
                </div>
              </div>
            </motion.div>
          );
        })}
      </div>

      {/* 空状态 */}
      {(projects ?? []).length === 0 && !showForm && (
        <div className="text-center py-12">
          <p className="text-[34px] mb-3">📁</p>
          <p className="text-[17px] font-semibold mb-1">还没有项目</p>
          <p className="text-[15px]" style={{ color: "#8E8E93" }}>
            创建项目来分类管理你的目标
          </p>
        </div>
      )}
    </div>
  );
}
