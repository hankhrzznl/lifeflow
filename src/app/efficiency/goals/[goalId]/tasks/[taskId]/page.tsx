"use client";

import { useState, useCallback } from "react";
import { useRouter, useParams } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { ChevronLeft, Plus, Calendar, Clock } from "lucide-react";
import { useLiveQuery } from "dexie-react-hooks";
import { efficiencyDB, addScheduleTask, type ScheduleTask } from "@/lib/db/efficiency.db";
import { addManualItem } from "@/lib/db/daylog.db";
import { showToast } from "@/components/ui/Toast";

function todayStr(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

const PRESET_COLORS = ["#6366F1", "#FF9500", "#34C759", "#FF3B30", "#007AFF", "#5856D6"];

export default function TaskDetailPage() {
  const router = useRouter();
  const params = useParams();
  const goalId = params.goalId as string;
  const taskId = params.taskId as string;

  const task = useLiveQuery(() => efficiencyDB.scheduleTasks.get(taskId), [taskId]);
  const goal = useLiveQuery(() => efficiencyDB.goals.get(goalId), [goalId]);

  const [showCreate, setShowCreate] = useState(false);
  const [itemTitle, setItemTitle] = useState("");
  const [itemStart, setItemStart] = useState("09:00");
  const [itemEnd, setItemEnd] = useState("09:30");
  const [itemNote, setItemNote] = useState("");
  const [itemColor, setItemColor] = useState(PRESET_COLORS[0]);
  const [submitting, setSubmitting] = useState(false);

  const handleCreateItem = useCallback(async () => {
    if (!itemTitle.trim()) { showToast({ type: "warning", message: "标题还没填" }); return; }
    setSubmitting(true);
    try {
      await addManualItem({
        date: todayStr(),
        plannedStart: itemStart,
        plannedEnd: itemEnd,
        title: itemTitle.trim(),
        note: itemNote || undefined,
        color: itemColor,
        projectId: goal?.projectId || undefined,
      });
      showToast({ type: "success", message: "已添加" });
      setShowCreate(false);
      setItemTitle("");
      setItemNote("");
    } catch {
      showToast({ type: "error", message: "没有添加成功，再试一次？" });
    } finally {
      setSubmitting(false);
    }
  }, [itemTitle, itemStart, itemEnd, itemNote, itemColor, goal]);

  if (!task) {
    return (
      <div className="min-h-screen bg-[#FAFAFA]" style={{ maxWidth: 430, margin: "0 auto" }}>
        <div className="flex items-center h-14 px-4" style={{ paddingTop: "var(--safe-area-top)" }}>
          <button onClick={() => router.push(`/efficiency/goals/${goalId}`)} className="w-8 h-8 -ml-1 flex items-center justify-center">
            <ChevronLeft className="w-6 h-6" style={{ color: "#1D1D1F" }} />
          </button>
          <p className="text-[17px] font-semibold mx-2" style={{ color: "#AEAEB2" }}>任务不存在</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#FAFAFA]" style={{ maxWidth: 430, margin: "0 auto" }}>
      {/* Header */}
      <div className="flex items-center h-14 px-4" style={{ paddingTop: "var(--safe-area-top)", borderBottom: "0.5px solid #EBEBEB" }}>
        <button onClick={() => router.push(`/efficiency/goals/${goalId}`)} className="w-8 h-8 -ml-1 flex items-center justify-center">
          <ChevronLeft className="w-6 h-6" style={{ color: "#1D1D1F" }} />
        </button>
        <div className="flex-1 min-w-0 mx-2">
          <p className="text-[17px] font-semibold truncate" style={{ color: "#1D1D1F" }}>{task.title}</p>
        </div>
      </div>

      {/* Task Info */}
      <div className="px-4 pt-4 pb-2">
        <div className="rounded-xl p-4" style={{ background: "#fff", border: "1px solid #EBEBEB" }}>
          {task.note && (
            <p className="text-[14px] mb-3" style={{ color: "var(--color-text-secondary)" }}>{task.note}</p>
          )}
          <div className="flex items-center gap-4 text-[13px]" style={{ color: "var(--color-text-disabled)" }}>
            {task.startDate && (
              <span className="flex items-center gap-1">
                <Calendar className="w-3.5 h-3.5" />
                {task.startDate}{task.endDate && task.endDate !== task.startDate ? ` ~ ${task.endDate}` : ""}
              </span>
            )}
            {task.progressType === "progress" && task.targetValue !== undefined && (
              <span>目标 {task.targetValue}{task.targetUnit || "次"}</span>
            )}
          </div>
        </div>
      </div>

      {/* Create Item Button */}
      <div className="px-4 pt-3">
        <button
          onClick={() => setShowCreate(true)}
          className="w-full py-3 rounded-xl text-[14px] font-semibold flex items-center justify-center gap-1.5 active:opacity-90"
          style={{ background: "#6366F1", color: "#fff" }}
        >
          <Plus className="w-4 h-4" />
          创建事项
        </button>
        <p className="text-[12px] mt-1.5 text-center" style={{ color: "var(--color-text-disabled)" }}>
          为这个任务添加今天要做的事项，它会出现在日程时间轴里
        </p>
      </div>

      {/* Create Item BottomSheet */}
      <AnimatePresence>
        {showCreate && (
          <>
            <motion.div
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              className="fixed inset-0 z-50" style={{ background: "rgba(0,0,0,0.3)" }}
              onClick={() => setShowCreate(false)}
            />
            <motion.div
              initial={{ y: "100%" }} animate={{ y: 0 }} exit={{ y: "100%" }}
              transition={{ type: "spring", damping: 30, stiffness: 300 }}
              className="fixed bottom-0 left-0 right-0 z-50 w-full max-w-[430px] mx-auto px-4 pt-4 rounded-t-[24px]"
              style={{ paddingBottom: "calc(24px + env(safe-area-inset-bottom))", background: "#fff", boxShadow: "0 -4px 20px rgba(0,0,0,0.1)" }}
            >
              <div className="w-8 h-1 rounded-full mx-auto mb-4" style={{ background: "var(--lifeflow-border)" }} />
              <h3 className="text-[17px] font-bold mb-4" style={{ color: "#1D1D1F" }}>
                创建事项 · {task.title}
              </h3>

              <input
                value={itemTitle} onChange={e => setItemTitle(e.target.value)}
                className="w-full h-11 rounded-xl px-3 text-[15px] outline-none mb-3"
                style={{ background: "#F5F5F7", border: "1px solid #EBEBEB", color: "#1D1D1F" }}
                placeholder="事项名称"
                autoFocus
              />

              <div className="flex gap-3 mb-3">
                <div className="flex-1">
                  <label className="text-[13px] mb-1 block" style={{ color: "var(--color-text-secondary)" }}>开始</label>
                  <input
                    type="time" value={itemStart} onChange={e => setItemStart(e.target.value)}
                    className="w-full h-11 rounded-xl px-3 text-[15px] outline-none"
                    style={{ background: "#F5F5F7", border: "1px solid #EBEBEB", color: "#1D1D1F" }}
                  />
                </div>
                <div className="flex-1">
                  <label className="text-[13px] mb-1 block" style={{ color: "var(--color-text-secondary)" }}>结束</label>
                  <input
                    type="time" value={itemEnd} onChange={e => setItemEnd(e.target.value)}
                    className="w-full h-11 rounded-xl px-3 text-[15px] outline-none"
                    style={{ background: "#F5F5F7", border: "1px solid #EBEBEB", color: "#1D1D1F" }}
                  />
                </div>
              </div>

              <input
                value={itemNote} onChange={e => setItemNote(e.target.value)}
                className="w-full h-11 rounded-xl px-3 text-[15px] outline-none mb-4"
                style={{ background: "#F5F5F7", border: "1px solid #EBEBEB", color: "#1D1D1F" }}
                placeholder="备注（可选）"
              />

              <div className="flex items-center gap-2 mb-4">
                <span className="text-[13px]" style={{ color: "var(--color-text-secondary)" }}>颜色</span>
                <div className="flex gap-1.5">
                  {PRESET_COLORS.map(c => (
                    <button
                      key={c}
                      onClick={() => setItemColor(c)}
                      className="w-7 h-7 rounded-full transition-transform"
                      style={{
                        background: c,
                        transform: itemColor === c ? "scale(1.15)" : "scale(1)",
                        boxShadow: itemColor === c ? `0 0 0 2px #fff, 0 0 0 4px ${c}` : "none",
                      }}
                    />
                  ))}
                </div>
              </div>

              <button
                onClick={handleCreateItem}
                disabled={submitting}
                className="w-full py-3.5 rounded-full text-[16px] font-semibold text-white disabled:opacity-50"
                style={{ background: "#6366F1" }}
              >
                {submitting ? "处理中..." : "创建事项"}
              </button>
            </motion.div>
          </>
        )}
      </AnimatePresence>

      <div className="h-10" />
    </div>
  );
}
