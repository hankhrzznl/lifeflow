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
    if (!formName.trim()) { showToast({ type: "warning", message: "请输入作息名称" }); return; }
    const data = { name: formName.trim(), startTime: formStartTime, endTime: formEndTime, color: formColor, icon: "Moon", isActive: true, sortOrder: 0 };
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
  }, [populateForm]);

  const handleDelete = useCallback(async (id: string) => {
    await deleteRoutine(id);
    showToast({ type: "success", message: "作息已删除" });
    if (editingId === id) resetForm();
  }, [editingId, resetForm]);

  const handleToggle = useCallback(async (r: RoutineTemplate) => {
    await updateRoutine(r.id, { isActive: !r.isActive });
    showToast({ type: "success", message: r.isActive ? "已停用" : "已启用" });
  }, []);

  const showForm = adding || editingId !== null;

  return (
    <div className="pb-[100px]">
      {/* Header */}
      <div className="flex items-center px-4 pt-3 pb-2">
        <button
          type="button"
          onClick={() => router.push("/more")}
          className="inline-flex h-8 w-8 items-center justify-center rounded-lg"
          style={{
            background: "var(--color-surface-card)",
            border: "1px solid var(--lifeflow-border)",
          }}
        >
          <ChevronLeft className="w-4 h-4" style={{ color: "var(--color-text-primary)" }} />
        </button>
        <h1 className="text-title-nav flex-1 text-center" style={{ color: "var(--color-text-primary)" }}>
          作息
        </h1>
        <div className="w-8" />
      </div>

      <div className="px-4 pt-5">
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
                placeholder="作息名称（如：午睡、晨练）" autoFocus
                className="w-full text-[16px] outline-none bg-transparent mb-3"
                style={{ color: "var(--color-text-primary)" }}
              />
              <div className="mb-3">
                <p className="text-[13px] mb-2" style={{ color: "var(--color-text-secondary)" }}>时间段</p>
                <div className="flex items-center gap-2">
                  <input type="time" value={formStartTime} onChange={(e) => setFormStartTime(e.target.value)}
                    className="flex-1 h-10 rounded-lg px-3 text-[15px] outline-none border"
                    style={{ borderColor: "var(--lifeflow-border)", background: "var(--color-surface-secondary)" }} />
                  <span className="text-[13px]" style={{ color: "var(--color-text-secondary)" }}>至</span>
                  <input type="time" value={formEndTime} onChange={(e) => setFormEndTime(e.target.value)}
                    className="flex-1 h-10 rounded-lg px-3 text-[15px] outline-none border"
                    style={{ borderColor: "var(--lifeflow-border)", background: "var(--color-surface-secondary)" }} />
                </div>
              </div>
              <div className="mb-3">
                <p className="text-[13px] mb-2" style={{ color: "var(--color-text-secondary)" }}>颜色</p>
                <div className="flex gap-2.5 flex-wrap">
                  {COLORS.map((c) => (
                    <button key={c} type="button" onClick={() => setFormColor(c)}
                      className="w-7 h-7 rounded-full transition-all"
                      style={{ background: c, boxShadow: formColor === c ? `0 0 0 3px ${c}40` : "none", transform: formColor === c ? "scale(1.15)" : "scale(1)" }} />
                  ))}
                </div>
              </div>
              <div className="flex gap-2">
                <button onClick={resetForm}
                  className="flex-1 h-10 rounded-lg text-[15px]"
                  style={{ background: "var(--color-surface-secondary)", color: "var(--color-text-secondary)" }}>取消</button>
                <button onClick={handleSave}
                  className="flex-1 h-10 rounded-lg text-[15px] font-semibold text-white"
                  style={{ background: "var(--lifeflow-primary)" }}>{editingId ? "更新" : "添加"}</button>
              </div>
            </motion.div>
          ) : (
            <button
              onClick={() => setAdding(true)}
              className="w-full h-11 flex items-center justify-center gap-2 rounded-[20px] mb-4 text-[15px] font-medium"
              style={{ background: "var(--lifeflow-brand-50)", color: "var(--lifeflow-primary)", border: "1px dashed var(--lifeflow-brand-200)" }}
            >
              <Plus className="w-4 h-4" />添加作息
            </button>
          )}
        </AnimatePresence>

        {/* Routine list */}
        <div className="flex flex-col gap-3">
          {(routines ?? []).map((r, i) => (
            <motion.div
              key={r.id}
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.04 }}
              className="card-standard p-4"
            >
              <div className="flex items-center gap-3">
                <div className="w-1 h-10 rounded-full flex-shrink-0" style={{ background: r.color }} />
                <div className="flex-1 min-w-0" onClick={() => handleEdit(r)} style={{ cursor: "pointer" }}>
                  <h3 className="text-[16px] font-semibold truncate" style={{ color: "var(--color-text-primary)" }}>{r.name}</h3>
                  <div className="flex items-center gap-1 mt-0.5">
                    <Clock className="w-3.5 h-3.5" style={{ color: "var(--color-text-secondary)" }} />
                    <span className="text-[13px]" style={{ color: "var(--color-text-secondary)" }}>{r.startTime} - {r.endTime}</span>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={(e) => { e.stopPropagation(); handleToggle(r); }}
                  className="relative inline-flex h-7 w-12 items-center rounded-full transition-colors flex-shrink-0"
                  style={{ background: r.isActive ? "var(--state-success)" : "var(--lifeflow-border)" }}
                >
                  <span
                    className="inline-block h-5 w-5 rounded-full bg-white shadow-sm transition-transform"
                    style={{ transform: r.isActive ? "translateX(26px)" : "translateX(2px)" }}
                  />
                </button>
                <button
                  onClick={(e) => { e.stopPropagation(); handleDelete(r.id); }}
                  className="w-7 h-7 flex items-center justify-center flex-shrink-0"
                >
                  <Trash2 className="w-4 h-4" style={{ color: "var(--color-text-disabled)" }} />
                </button>
              </div>
            </motion.div>
          ))}
        </div>

        {/* Empty state */}
        {(routines ?? []).length === 0 && !showForm && (
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            className="card-standard p-10 flex flex-col items-center"
          >
            <p className="text-[17px] font-semibold" style={{ color: "var(--color-text-primary)" }}>
              暂无作息模板
            </p>
            <p className="text-[14px] mt-1.5" style={{ color: "var(--color-text-secondary)" }}>
              添加作息模板，每日自动生成日程
            </p>
            <button
              onClick={() => setAdding(true)}
              className="mt-5 h-10 px-6 rounded-full text-[15px] font-semibold text-white"
              style={{ background: "var(--lifeflow-primary)" }}
            >
              创建作息
            </button>
          </motion.div>
        )}
      </div>
    </div>
  );
}
