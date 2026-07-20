"use client";

import { useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { ChevronLeft, Plus, Trash2, Clock } from "lucide-react";
import { useLiveQuery } from "dexie-react-hooks";
import { getRoutines, addRoutine, updateRoutine, deleteRoutine } from "@/lib/db/daylog.db";
import type { RoutineTemplate } from "@/lib/db/daylog.db";
import { showToast } from "@/components/ui/Toast";

const COLORS = ["#5856D6", "#007AFF", "#34C759", "#FF9500", "#FF3B30", "#AF52DE", "#5AC8FA", "#FF2D55"];

export default function RoutinesPage() {
  const router = useRouter();

  const routines = useLiveQuery(() => getRoutines(), [], [] as RoutineTemplate[]);

  const [editingId, setEditingId] = useState<string | null>(null);
  const [adding, setAdding] = useState(false);

  // Form state
  const [formName, setFormName] = useState("");
  const [formStartTime, setFormStartTime] = useState("07:00");
  const [formEndTime, setFormEndTime] = useState("07:30");
  const [formColor, setFormColor] = useState(COLORS[0]);

  const resetForm = useCallback(() => {
    setFormName("");
    setFormStartTime("07:00");
    setFormEndTime("07:30");
    setFormColor(COLORS[0]);
    setEditingId(null);
    setAdding(false);
  }, []);

  const populateForm = useCallback((r: RoutineTemplate) => {
    setFormName(r.name);
    setFormStartTime(r.startTime);
    setFormEndTime(r.endTime);
    setFormColor(r.color);
  }, []);

  const handleSave = useCallback(async () => {
    if (!formName.trim()) {
      showToast({ type: "warning", message: "请输入作息名称" });
      return;
    }

    const data = {
      name: formName.trim(),
      startTime: formStartTime,
      endTime: formEndTime,
      color: formColor,
      icon: "Moon",
      isActive: true,
      sortOrder: 0,
    };

    if (editingId) {
      await updateRoutine(editingId, data);
      showToast({ type: "success", message: "作息已更新" });
    } else {
      await addRoutine(data);
      showToast({ type: "success", message: "作息已添加" });
    }
    resetForm();
  }, [formName, formStartTime, formEndTime, formColor, editingId, resetForm]);

  const handleEdit = useCallback((r: RoutineTemplate) => {
    setEditingId(r.id);
    populateForm(r);
    setAdding(false);
    window.scrollTo({ top: 0, behavior: "smooth" });
  }, [populateForm]);

  const handleDelete = useCallback(async (id: string) => {
    await deleteRoutine(id);
    showToast({ type: "success", message: "作息已删除" });
    if (editingId === id) resetForm();
  }, [editingId, resetForm]);

  const handleToggle = useCallback(async (r: RoutineTemplate) => {
    await updateRoutine(r.id, { isActive: !r.isActive });
    showToast({
      type: "success",
      message: r.isActive ? "已停用" : "已启用",
    });
  }, []);

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
          作息
        </h1>
      </div>
      <p className="text-[15px] mb-4" style={{ color: "#8E8E93" }}>
        管理日常作息模板，自动生成日程
      </p>

      {/* 添加按钮 / 编辑表单 */}
      <AnimatePresence mode="wait">
        {showForm ? (
          <motion.div
            key="form"
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            className="rounded-xl bg-white p-4 mb-4 shadow-[0_1px_4px_rgba(0,0,0,0.04)] overflow-hidden"
          >
            {/* 作息名称 */}
            <input
              type="text"
              value={formName}
              onChange={(e) => setFormName(e.target.value)}
              placeholder="作息名称（如：午睡、晨练）"
              autoFocus
              className="w-full text-[17px] outline-none mb-3 py-1"
            />

            {/* 时间段 */}
            <div className="mb-3">
              <p className="text-[13px] mb-2" style={{ color: "#8E8E93" }}>
                时间段
              </p>
              <div className="flex items-center gap-2">
                <input
                  type="time"
                  value={formStartTime}
                  onChange={(e) => setFormStartTime(e.target.value)}
                  className="flex-1 h-10 rounded-lg px-3 text-[15px] outline-none border"
                  style={{ borderColor: "#E5E5E5" }}
                />
                <span className="text-[13px]" style={{ color: "#8E8E93" }}>
                  至
                </span>
                <input
                  type="time"
                  value={formEndTime}
                  onChange={(e) => setFormEndTime(e.target.value)}
                  className="flex-1 h-10 rounded-lg px-3 text-[15px] outline-none border"
                  style={{ borderColor: "#E5E5E5" }}
                />
              </div>
            </div>

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
            添加作息
          </button>
        )}
      </AnimatePresence>

      {/* 作息列表 */}
      <div className="flex flex-col gap-3">
        {(routines ?? []).map((r, i) => (
          <motion.div
            key={r.id}
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.04 }}
            className="rounded-xl bg-white p-4 shadow-[0_1px_4px_rgba(0,0,0,0.04)]"
          >
            <div className="flex items-center gap-3">
              {/* 颜色条 */}
              <div
                className="w-1 h-10 rounded-full flex-shrink-0"
                style={{ background: r.color }}
              />

              {/* 名称 + 时间 */}
              <div className="flex-1 min-w-0" onClick={() => handleEdit(r)} style={{ cursor: "pointer" }}>
                <h3 className="text-[17px] font-semibold truncate">
                  {r.name}
                </h3>
                <div className="flex items-center gap-1 mt-0.5">
                  <Clock className="w-3.5 h-3.5" style={{ color: "#8E8E93" }} />
                  <span className="text-[13px]" style={{ color: "#8E8E93" }}>
                    {r.startTime} - {r.endTime}
                  </span>
                </div>
              </div>

              {/* 开关 */}
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  handleToggle(r);
                }}
                className="relative inline-flex h-7 w-12 items-center rounded-full transition-colors flex-shrink-0"
                style={{
                  background: r.isActive ? "#34C759" : "#E5E5E5",
                }}
              >
                <span
                  className="inline-block h-5 w-5 rounded-full bg-white shadow-sm transition-transform"
                  style={{
                    transform: r.isActive ? "translateX(26px)" : "translateX(2px)",
                  }}
                />
              </button>

              {/* 删除 */}
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  handleDelete(r.id);
                }}
                className="w-7 h-7 flex items-center justify-center flex-shrink-0"
              >
                <Trash2 className="w-4 h-4" style={{ color: "#C7C7CC" }} />
              </button>
            </div>
          </motion.div>
        ))}
      </div>

      {/* 空状态 */}
      {(routines ?? []).length === 0 && !showForm && (
        <div className="text-center py-12">
          <p className="text-[34px] mb-3">⏰</p>
          <p className="text-[17px] font-semibold mb-1">还没有作息模板</p>
          <p className="text-[15px]" style={{ color: "#8E8E93" }}>
            添加作息模板，每日自动生成日程
          </p>
        </div>
      )}
    </div>
  );
}
