"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import { motion, AnimatePresence, type PanInfo } from "framer-motion";
import {
  Check, Trash2,
} from "lucide-react";
import { useEfficiencyStore } from "@/lib/store/efficiencyStore";
import type { ScheduleTask } from "@/lib/db/efficiency.db";
import { getScheduleTasksByDate } from "@/lib/db/efficiency.db";
import { showToast } from "@/components/ui/Toast";
import TimelineView from "@/components/efficiency/TimelineView";

// ============================================================
// 设计令牌
// ============================================================
const ACCENT = "#6366F1";

const WEEK_DAYS = ["一", "二", "三", "四", "五", "六", "日"];

// ============================================================
// 工具函数
// ============================================================
function toDateStr(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}
function addDays(date: Date, days: number): Date {
  const d = new Date(date);
  d.setDate(d.getDate() + days);
  return d;
}
function getWeekMonday(baseDate: Date, weekOffset: number): Date {
  const dow = baseDate.getDay();
  const mondayOffset = dow === 0 ? -6 : 1 - dow;
  return addDays(addDays(baseDate, mondayOffset), weekOffset * 7);
}

const todayStr = toDateStr(new Date());

// ============================================================
// Segmented Control
// ============================================================
function SegmentedControl({ selected, onChange }: {
  selected: "timeline" | "tasks";
  onChange: (v: "timeline" | "tasks") => void;
}) {
  return (
    <div className="mx-4 flex bg-[#F2F2F7] rounded-lg p-0.5">
      {(["timeline", "tasks"] as const).map((key) => (
        <button
          key={key}
          type="button"
          onClick={() => onChange(key)}
          className={`flex-1 h-8 rounded-md text-[13px] font-medium transition-all ${
            selected === key
              ? "bg-white text-[#1D1D1F] shadow-sm"
              : "text-[#86868B]"
          }`}
        >
          {key === "timeline" ? "时间轴" : "任务"}
        </button>
      ))}
    </div>
  );
}

// ============================================================
// 主组件
// ============================================================
export default function SchedulePage() {
  const { scheduleTasks, selectedDate, loadScheduleTasks, toggleScheduleTask, removeScheduleTask } = useEfficiencyStore();

  // ── 视图切换 ──
  const [view, setView] = useState<"timeline" | "tasks">("timeline");

  // ── 周日历条 ──
  const [weekOffset, setWeekOffset] = useState(0);
  const weekDates = useMemo(() => {
    const mon = getWeekMonday(new Date(), weekOffset);
    return Array.from({ length: 7 }, (_, i) => addDays(mon, i));
  }, [weekOffset]);

  // 如果 selectedDate 不在当前可见周内，自动切到对应周
  useEffect(() => {
    if (!selectedDate) return;
    const sd = new Date(selectedDate + "T00:00:00");
    const dayOfWeek = sd.getDay();
    const monOffset = dayOfWeek === 0 ? -6 : 1 - dayOfWeek;
    const monday = addDays(sd, monOffset);
    const currentMonday = getWeekMonday(new Date(), weekOffset);
    const diffDays = Math.round((monday.getTime() - currentMonday.getTime()) / 86400000);
    if (diffDays !== 0) {
      const newOffset = weekOffset + Math.round(diffDays / 7);
      setWeekOffset(newOffset);
    }
  }, [selectedDate]);

  const handleSelectDay = useCallback((date: Date) => {
    loadScheduleTasks(toDateStr(date));
  }, [loadScheduleTasks]);

  // 拖拽切周
  const handleDragEnd = useCallback((_ev: MouseEvent | TouchEvent | PointerEvent, info: PanInfo) => {
    if (Math.abs(info.offset.x) > 60) {
      setWeekOffset((o) => o + (info.offset.x > 0 ? -1 : 1));
    }
  }, []);

  // ── 任务列表 ──
  const [deleteTarget, setDeleteTarget] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);

  // 排序：未完成在上，重要在上
  const sortedTasks = useMemo(() => {
    return [...(scheduleTasks ?? [])].sort((a, b) => {
      if (a.isCompleted !== b.isCompleted) return a.isCompleted ? 1 : -1;
      if (a.isImportant !== b.isImportant) return a.isImportant ? -1 : 1;
      return a.createdAt - b.createdAt;
    });
  }, [scheduleTasks]);

  // 即将到来
  const [upcoming, setUpcoming] = useState<{ date: string; tasks: ScheduleTask[] }[]>([]);
  const refreshUpcoming = useCallback(async (fromDate: string) => {
    const result: { date: string; tasks: ScheduleTask[] }[] = [];
    for (let i = 1; i <= 7; i++) {
      const d = addDays(new Date(fromDate + "T00:00:00"), i);
      const ds = toDateStr(d);
      const tasks = await getScheduleTasksByDate(ds);
      if (tasks.length > 0) {
        result.push({ date: ds, tasks });
        if (result.length >= 3) break;
      }
    }
    setUpcoming(result);
  }, []);

  useEffect(() => {
    if (selectedDate) refreshUpcoming(selectedDate);
  }, [selectedDate, refreshUpcoming]);

  // ── 任务操作 ──
  const handleToggle = useCallback(async (task: ScheduleTask) => {
    await toggleScheduleTask(task.id);
  }, [toggleScheduleTask]);

  const handleDeleteConfirm = useCallback(async () => {
    if (!deleteTarget) return;
    await removeScheduleTask(deleteTarget);
    showToast({ type: "success", message: "已删除" });
    setDeleteTarget(null);
    setConfirmDelete(false);
  }, [deleteTarget, removeScheduleTask]);

  const formatDate = (d: Date) => `${d.getMonth() + 1}月${d.getDate()}日`;

  // ── 渲染 ──
  return (
    <div className="min-h-screen bg-[#FAFAFA]" style={{ maxWidth: 430, margin: "0 auto" }}>
      {/* ===== Header ===== */}
      <div className="flex items-center h-14 px-4 justify-center">
        <span className="text-[17px] font-semibold text-[#1D1D1F]">日程</span>
      </div>

      {/* ===== Segmented Control ===== */}
      <SegmentedControl selected={view} onChange={setView} />

      {/* ===== 周日历条 ===== */}
      <motion.div className="px-4 mt-3 select-none" onPanEnd={handleDragEnd}>
        {/* 星期 */}
        <div className="grid grid-cols-7 text-center text-[12px] text-[#86868B] mb-1">
          {WEEK_DAYS.map((d) => <span key={d}>{d}</span>)}
        </div>
        {/* 日期 */}
        <div className="grid grid-cols-7 text-center">
          {weekDates.map((date) => {
            const ds = toDateStr(date);
            const isToday = ds === todayStr;
            const isActive = ds === selectedDate;
            return (
              <button
                key={ds}
                type="button"
                onClick={() => handleSelectDay(date)}
                className="flex flex-col items-center justify-center py-1.5"
              >
                <span
                  className={`w-8 h-8 flex items-center justify-center rounded-full text-[15px] font-medium transition-colors ${
                    isActive
                      ? "bg-[#6366F1] text-white"
                      : isToday
                      ? "text-[#6366F1] font-bold"
                      : "text-[#1D1D1F]"
                  }`}
                >
                  {date.getDate()}
                </span>
              </button>
            );
          })}
        </div>
      </motion.div>

      {/* ===== 内容区 ===== */}
      <div className="px-4 mt-4">
        {view === "timeline" ? (
          <TimelineView date={selectedDate} />
        ) : (
          <>
            {/* 任务列表 */}
            {sortedTasks.length === 0 ? (
              <div className="text-center py-16">
                <p className="text-[15px] text-[#AEAEB2]">当日暂无任务</p>
              </div>
            ) : (
              <div className="flex flex-col gap-2">
                {sortedTasks.map((task) => (
                  <div
                    key={task.id}
                    className="bg-white rounded-xl border border-[#EBEBEB] p-3.5 flex items-center gap-3"
                  >
                    <button
                      type="button"
                      onClick={() => handleToggle(task)}
                      className="w-6 h-6 rounded-full flex-shrink-0 flex items-center justify-center transition-colors"
                      style={{
                        border: task.isCompleted ? "none" : "2px solid #C7C7CC",
                        background: task.isCompleted ? ACCENT : "#FFFFFF",
                      }}
                    >
                      {task.isCompleted && <Check className="w-[14px] h-[14px] text-white" strokeWidth={3} />}
                    </button>
                    <div className="flex-1 min-w-0">
                      <p className={`text-[15px] truncate ${task.isCompleted ? "line-through text-[#AEAEB2]" : "text-[#1D1D1F]"}`}>
                        {task.title}
                      </p>
                      <div className="flex items-center gap-2 mt-0.5">
                        {task.plannedTime > 0 && (
                          <span className="text-[12px] text-[#86868B]">{task.plannedTime}分钟</span>
                        )}
                        {task.isImportant && (
                          <span className="text-[12px] text-[#FF9500]">重要</span>
                        )}
                      </div>
                    </div>
                    <button
                      onClick={() => { setDeleteTarget(task.id); setConfirmDelete(false); }}
                      className="w-7 h-7 flex items-center justify-center"
                    >
                      <Trash2 className="w-4 h-4 text-[#C7C7CC]" />
                    </button>
                  </div>
                ))}
              </div>
            )}

            {/* 即将到来 */}
            {upcoming.length > 0 && (
              <div className="mt-6">
                <h3 className="text-[13px] font-semibold text-[#86868B] mb-2">即将到来</h3>
                <div className="flex flex-col gap-2">
                  {upcoming.map((u) => (
                    <div key={u.date} className="bg-white rounded-xl border border-[#EBEBEB] p-3.5">
                      <p className="text-[13px] text-[#86868B] mb-1">{formatDate(new Date(u.date + "T00:00:00"))}</p>
                      {u.tasks.map((t) => (
                        <p key={t.id} className="text-[15px] text-[#1D1D1F] truncate">{t.title}</p>
                      ))}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </>
        )}
      </div>

      {/* ===== 删除确认弹窗 ===== */}
      <AnimatePresence>
        {deleteTarget && (
          <>
            <motion.div
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              onClick={() => setDeleteTarget(null)}
              className="fixed inset-0 z-50 bg-black/40"
            />
            <motion.div
              initial={{ y: "100%", x: "-50%" }} animate={{ y: 0, x: "-50%" }} exit={{ y: "100%", x: "-50%" }}
              transition={{ duration: 0.4, ease: [0.32, 0.72, 0, 1] }}
              className="fixed left-1/2 bottom-0 w-full max-w-[430px] bg-white z-[60] rounded-t-[24px]"
              style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
            >
              <div className="flex justify-center pt-2 pb-3">
                <div className="w-9 h-1 rounded-full bg-[#D4D4D4]" />
              </div>
              <div className="px-4 pb-6">
                <p className="text-[17px] font-semibold text-[#1D1D1F] mb-4">
                  {confirmDelete ? "确认删除？" : "删除任务"}
                </p>
                {!confirmDelete ? (
                  <button
                    onClick={() => setConfirmDelete(true)}
                    className="w-full py-3 rounded-xl bg-[#FF3B30] text-white text-[15px] font-semibold"
                  >
                    删除
                  </button>
                ) : (
                  <div className="flex gap-3">
                    <button
                      onClick={() => setDeleteTarget(null)}
                      className="flex-1 py-3 rounded-xl bg-[#F2F2F7] text-[#86868B] text-[15px] font-medium"
                    >
                      取消
                    </button>
                    <button
                      onClick={handleDeleteConfirm}
                      className="flex-1 py-3 rounded-xl bg-[#FF3B30] text-white text-[15px] font-semibold"
                    >
                      确认删除
                    </button>
                  </div>
                )}
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>

      <div className="h-4" />
    </div>
  );
}
