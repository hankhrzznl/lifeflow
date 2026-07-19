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
  { key: "q1", label: "重要且紧急", desc: "立即去做", color: "#FF3B30", bg: "#FF3B3010" },
  { key: "q2", label: "重要不紧急", desc: "计划去做", color: "#007AFF", bg: "#007AFF10" },
  { key: "q3", label: "不重要紧急", desc: "委托他人", color: "#FF9500", bg: "#FF950010" },
  { key: "q4", label: "不重要不紧急", desc: "尽量不做", color: "#8E8E93", bg: "#8E8E9310" },
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
  const [expandedQuadrant, setExpandedQuadrant] = useState<string | null>("q1");

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
    <div className="px-4 pt-5 pb-6">
      {/* ===== 页头 ===== */}
      <div className="flex items-center justify-between mb-4">
        <div>
          <h1 className="text-[34px] font-bold tracking-[-0.02em] leading-tight">事项</h1>
          <p className="text-[15px] mt-1" style={{ color: "#8E8E93" }}>
            {todayTasks.length} 件待办 · {allTasks ? allTasks.filter((t) => t.isCompleted).length : 0} 件已完成
          </p>
        </div>
      </div>

      {/* ===== 快捷添加 ===== */}
      {showAdd ? (
        <div className="rounded-xl bg-white p-4 mb-4 shadow-[0_1px_4px_rgba(0,0,0,0.04)]">
          <input
            type="text" value={newTitle} onChange={(e) => setNewTitle(e.target.value)}
            placeholder="输入事项标题..."
            autoFocus
            className="w-full text-[17px] outline-none mb-3"
            onKeyDown={(e) => { if (e.key === "Enter") handleAdd(); }}
          />
          <div className="flex gap-2 mb-3">
            {QUADRANTS.map((q) => (
              <button key={q.key} type="button"
                onClick={() => setAddQuadrant(q.key)}
                className="px-3 py-1 rounded-full text-[12px] font-medium"
                style={{
                  background: addQuadrant === q.key ? q.color : q.bg,
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

      {/* ===== 四象限网格 ===== */}
      <div className="grid grid-cols-2 gap-3">
        {QUADRANTS.map((q) => {
          const items = grouped[q.key] || [];
          return (
            <motion.div key={q.key}
              initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}
              transition={{ delay: QUADRANTS.indexOf(q) * 0.05 }}
              className="rounded-xl overflow-hidden" style={{ background: q.bg }}>
              {/* 区头 */}
              <button type="button" onClick={() => setExpandedQuadrant(expandedQuadrant === q.key ? null : q.key)}
                className="w-full flex items-center justify-between px-3 py-3" style={{ background: `${q.color}20` }}>
                <div className="text-left">
                  <div className="text-[14px] font-semibold" style={{ color: q.color }}>{q.label}</div>
                  <div className="text-[11px]" style={{ color: q.color, opacity: 0.7 }}>{q.desc} · {items.length}件</div>
                </div>
              </button>
              {/* 事项列表 */}
              <div className="px-2 pb-2">
                {items.length === 0 ? (
                  <div className="py-4 text-center text-[13px]" style={{ color: "#8E8E93" }}>空</div>
                ) : (
                  items.map((t) => (
                    <button key={t.id} type="button"
                      className="w-full flex items-center gap-2 px-2 py-2.5 rounded-lg hover:bg-white/50 transition-colors text-left"
                      onClick={() => toggleTask(t)}>
                      <Circle className="w-4 h-4 shrink-0" style={{ color: q.color }} />
                      <span className="flex-1 text-[14px] truncate" style={{ color: "#000" }}>{t.title}</span>
                    </button>
                  ))
                )}
              </div>
            </motion.div>
          );
        })}
      </div>
    </div>
  );
}
