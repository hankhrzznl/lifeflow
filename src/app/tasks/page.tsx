"use client";

import { useMemo, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import { Plus, Circle, CheckCircle2, GripVertical, CalendarDays, ListTodo } from "lucide-react";
import { useLiveQuery } from "dexie-react-hooks";
import { getAllScheduleTasks, updateScheduleTask, addScheduleTask } from "@/lib/db/efficiency.db";
import type { ScheduleTask } from "@/lib/db/efficiency.db";
import { showToast } from "@/components/ui/Toast";

// ============================================================
// 事项 · 四象限视图
// ============================================================

const QUADRANTS = [
  { key: "q1", label: "重要且紧急", desc: "立即去做", colorBar: "var(--state-error)", color: "#FF3B30" },
  { key: "q2", label: "重要不紧急", desc: "计划去做", colorBar: "var(--lifeflow-primary)", color: "#2563EB" },
  { key: "q3", label: "不重要紧急", desc: "委托他人", colorBar: "var(--state-warning)", color: "#F59E0B" },
  { key: "q4", label: "不重要不紧急", desc: "尽量不做", colorBar: "var(--color-text-disabled)", color: "#C7C7CC" },
] as const;

function todayStr(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

export default function TasksPage() {
  const router = useRouter();
  const [showAdd, setShowAdd] = useState(false);
  const [addQuadrant, setAddQuadrant] = useState<"q1" | "q2" | "q3" | "q4">("q2");
  const [newTitle, setNewTitle] = useState("");
  const [adding, setAdding] = useState(false);

  const allTasks = useLiveQuery(() => getAllScheduleTasks(), [], [] as ScheduleTask[]);
  const today = todayStr();

  // 分组
  const grouped = useMemo(() => {
    const map: Record<string, ScheduleTask[]> = { q1: [], q2: [], q3: [], q4: [] };
    for (const t of allTasks ?? []) {
      if (t.isCompleted) continue;
      const q = t.quadrant || "q2";
      if (map[q]) map[q].push(t);
    }
    return map;
  }, [allTasks]);

  const todayTasks = useMemo(() => {
    return (allTasks ?? []).filter((t) => t.date === today && !t.isCompleted);
  }, [allTasks, today]);

  const completedCount = useMemo(() => {
    return allTasks ? allTasks.filter((t) => t.isCompleted).length : 0;
  }, [allTasks]);

  const toggleTask = useCallback(async (task: ScheduleTask) => {
    await updateScheduleTask(task.id, { isCompleted: !task.isCompleted });
  }, []);

  const changeQuadrant = useCallback(async (task: ScheduleTask, newQuadrant: string) => {
    await updateScheduleTask(task.id, { quadrant: newQuadrant as ScheduleTask["quadrant"] });
  }, []);

  const handleAdd = useCallback(async () => {
    if (!newTitle.trim()) return;
    setAdding(true);
    await addScheduleTask({
      goalId: null,
      title: newTitle.trim(),
      type: "single",
      date: today,
      quadrant: addQuadrant,
      isCompleted: false,
      plannedTime: 30,
      actualTime: 0,
      isImportant: addQuadrant === "q1" || addQuadrant === "q2",
      note: "",
    });
    showToast({ type: "success", message: "已添加" });
    setNewTitle("");
    setShowAdd(false);
    setAdding(false);
  }, [newTitle, addQuadrant, today]);

  return (
    <div className="px-4 pt-8 pb-[100px]">
      {/* ===== Header ===== */}
      <div className="mb-6">
        <h1 className="text-[28px] font-bold tracking-[-0.022em] text-[var(--color-text-primary)]">
          事项
        </h1>
        <p className="text-[14px] font-medium text-[var(--color-text-secondary)] mt-1.5">
          {todayTasks.length} 件待办 · {completedCount} 件已完成
        </p>
      </div>

      {/* ===== 快捷添加 ===== */}
      {showAdd ? (
        <div className="rounded-xl bg-white p-4 mb-4 shadow-[0_1px_4px_rgba(0,0,0,0.04)]">
          <input
            type="text" value={newTitle} onChange={(e) => setNewTitle(e.target.value)}
            placeholder="输入事项标题..."
            autoFocus
            className="w-full text-[17px] outline-none mb-3 bg-transparent text-[var(--color-text-primary)] placeholder:text-[var(--color-text-disabled)]"
            onKeyDown={(e) => { if (e.key === "Enter") handleAdd(); }}
          />
          <div className="flex gap-2 mb-3">
            {QUADRANTS.map((q) => (
              <button key={q.key} type="button"
                onClick={() => setAddQuadrant(q.key)}
                className="px-3 py-1 rounded-full text-[12px] font-medium transition-colors"
                style={{
                  background: addQuadrant === q.key ? q.color : `${q.color}10`,
                  color: addQuadrant === q.key ? "#FFF" : q.color,
                }}>
                {q.label}
              </button>
            ))}
          </div>
          <div className="flex gap-2">
            <button type="button" onClick={() => { setShowAdd(false); setNewTitle(""); }}
              className="flex-1 h-10 rounded-lg text-[15px]" style={{ background: "#F2F2F7", color: "#8E8E93" }}>取消</button>
            <button type="button" onClick={handleAdd} disabled={adding || !newTitle.trim()}
              className="flex-1 h-10 rounded-lg text-[15px] font-semibold text-white" style={{ background: "#6366F1", opacity: newTitle.trim() ? 1 : 0.5 }}>添加</button>
          </div>
        </div>
      ) : (
        <button type="button" onClick={() => setShowAdd(true)}
          className="w-full h-11 flex items-center justify-center gap-2 rounded-xl mb-4 text-[15px] font-medium"
          style={{ background: "#6366F110", color: "#6366F1", border: "1px dashed #6366F140" }}>
          <Plus className="w-4 h-4" />添加事项
        </button>
      )}

      {/* ===== 四象限 2x2 Grid ===== */}
      <div className="grid grid-cols-2 gap-3">
        {QUADRANTS.map((q) => {
          const items = grouped[q.key] || [];
          return (
            <motion.div key={q.key}
              initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}
              transition={{ delay: QUADRANTS.indexOf(q) * 0.05 }}
              className="rounded-[20px] overflow-hidden bg-[var(--color-surface-card)] shadow-[var(--shadow-card)]">
              {/* Color bar */}
              <div className="h-1" style={{ background: q.colorBar }} />
              {/* Inner content */}
              <div className="p-4 flex flex-col items-center justify-center min-h-[142px]">
                <div
                  className="text-[15px] font-semibold mb-1"
                  style={{ color: q.colorBar }}
                >{q.label}</div>
                <div className="text-[12px] font-medium text-[var(--color-text-secondary)] mb-1">
                  {q.desc} · {items.length}件
                </div>
                {items.length === 0 ? (
                  <div className="text-[26px] font-light text-[var(--color-text-disabled)]">空</div>
                ) : (
                  <div className="w-full space-y-0.5 mt-2">
                    {items.map((t) => (
                      <button key={t.id} type="button"
                        className="w-full flex items-center gap-2 px-2 py-1.5 rounded-lg hover:bg-black/5 dark:hover:bg-white/5 transition-colors text-left"
                        onClick={() => toggleTask(t)}>
                        <Circle className="w-3.5 h-3.5 shrink-0" style={{ color: q.colorBar }} />
                        <span className="flex-1 text-[13px] truncate text-[var(--color-text-primary)]">{t.title}</span>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </motion.div>
          );
        })}
      </div>
    </div>
  );
}
