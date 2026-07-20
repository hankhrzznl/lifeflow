"use client";

import { useState, useEffect, useCallback, useMemo, useRef } from "react";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence, type PanInfo } from "framer-motion";
import {
  Check, Plus, ChevronLeft, ChevronRight, CalendarDays, Clock,
  TrendingUp, X,
} from "lucide-react";
import { useEfficiencyStore } from "@/lib/store/efficiencyStore";
import type { ScheduleTask } from "@/lib/db/efficiency.db";
import { getScheduleTasksByDate } from "@/lib/db/efficiency.db";
import { showToast } from "@/components/ui/Toast";

// ============================================================
// 常量
// ============================================================
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
// 任务行组件
// ============================================================
function TaskRow({
  task,
  onToggle,
  onLongPress,
}: {
  task: ScheduleTask;
  onToggle: () => void;
  onLongPress: () => void;
}) {
  const longPressTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const handleTouchStart = () => {
    longPressTimer.current = setTimeout(onLongPress, 500);
  };
  const handleTouchEnd = () => {
    if (longPressTimer.current) clearTimeout(longPressTimer.current);
  };

  return (
    <div
      className="flex items-center gap-3 px-4 min-h-[54px] py-2"
      onTouchStart={handleTouchStart}
      onTouchEnd={handleTouchEnd}
      onTouchMove={handleTouchEnd}
      onContextMenu={(e) => { e.preventDefault(); onLongPress(); }}
    >
      {/* 勾选圆 */}
      <button
        type="button"
        onClick={(e) => { e.stopPropagation(); onToggle(); }}
        className="shrink-0"
        while-tap={{ scale: 0.95 } as never}
      >
        {task.isCompleted ? (
          <motion.div
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            className="w-6 h-6 rounded-full flex items-center justify-center"
            style={{ backgroundColor: "var(--lifeflow-primary)" }}
          >
            <Check className="w-[14px] h-[14px] text-white" strokeWidth={3} />
          </motion.div>
        ) : (
          <div className="w-6 h-6 rounded-full border-2 bg-white" style={{ borderColor: "var(--color-text-disabled)" }} />
        )}
      </button>

      {/* 内容 */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-1.5">
          <p
            className="text-[17px] truncate"
            style={{
              color: task.isCompleted ? "var(--color-text-disabled)" : "var(--color-text-primary)",
              textDecoration: task.isCompleted ? "line-through" : "none",
            }}
          >
            {task.title}
          </p>
          {task.isImportant && !task.isCompleted && (
            <span className="w-[6px] h-[6px] rounded-full shrink-0" style={{ backgroundColor: "var(--lifeflow-primary)" }} />
          )}
        </div>
        {(task.plannedTime > 0 || task.progressType === "progress" || task.note) && (
          <div className="mt-1 flex gap-2 flex-wrap">
            {task.plannedTime > 0 && (
              <span
                className="inline-flex items-center gap-1 text-[11px] px-1.5 py-0.5 rounded-md"
                style={{ backgroundColor: "var(--lifeflow-background)", color: "var(--color-text-secondary)" }}
              >
                <Clock className="w-3 h-3" />
                {task.plannedTime}分钟
              </span>
            )}
            {task.progressType === "progress" && task.targetValue != null && (
              <span
                className="inline-flex items-center gap-1 text-[11px] px-1.5 py-0.5 rounded-md"
                style={{ backgroundColor: "var(--lifeflow-brand-50)", color: "var(--lifeflow-primary)" }}
              >
                <TrendingUp className="w-3 h-3" />
                目标 {task.targetValue}{task.targetUnit || ""}
              </span>
            )}
            {task.note && (
              <span className="text-[13px] truncate max-w-[180px]" style={{ color: "var(--color-text-secondary)" }}>{task.note}</span>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

// ============================================================
// 创建任务 Sheet
// ============================================================
function CreateTaskSheet({
  open,
  onClose,
  selectedDate,
}: {
  open: boolean;
  onClose: () => void;
  selectedDate: string;
}) {
  const { addScheduleTask, loadScheduleTasks } = useEfficiencyStore();
  const [title, setTitle] = useState("");
  const [note, setNote] = useState("");
  const [plannedTime, setPlannedTime] = useState(30);
  const [isImportant, setIsImportant] = useState(false);
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    if (!title.trim()) { showToast({ type: "warning", message: "请输入任务名称" }); return; }
    setSaving(true);
    try {
      await addScheduleTask({
        goalId: null,
        title: title.trim(),
        note,
        type: "single",
        date: selectedDate,
        isCompleted: false,
        plannedTime,
        actualTime: 0,
        isImportant,
      });
      await loadScheduleTasks(selectedDate);
      showToast({ type: "success", message: "任务已保存" });
      setTitle(""); setNote(""); setPlannedTime(30); setIsImportant(false);
      onClose();
    } catch {
      showToast({ type: "error", message: "保存失败" });
    }
    setSaving(false);
  };

  return (
    <AnimatePresence>
      {open && (
        <>
          <motion.div
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            onClick={onClose}
            className="fixed inset-0 z-50 bg-black/40"
          />
          <motion.div
            initial={{ y: "100%" }} animate={{ y: 0 }} exit={{ y: "100%" }}
            transition={{ duration: 0.35, ease: [0.32, 0.72, 0, 1] }}
            className="fixed bottom-0 left-0 right-0 z-[60] rounded-t-[20px] max-h-[85vh] overflow-y-auto"
            style={{
              backgroundColor: "var(--color-surface-card)",
              paddingBottom: "env(safe-area-inset-bottom)",
            }}
          >
            <div className="flex justify-center pt-2 pb-1">
              <div className="w-9 h-1 rounded-full bg-[#D4D4D4]" />
            </div>

            {/* 页头 */}
            <div className="flex items-center justify-between px-5 h-12">
              <button onClick={onClose} className="text-[17px]" style={{ color: "var(--color-text-secondary)" }}>取消</button>
              <span className="text-[17px] font-semibold" style={{ color: "var(--color-text-primary)" }}>新建任务</span>
              <button
                onClick={handleSave}
                disabled={saving || !title.trim()}
                className="text-[17px] font-medium"
                style={{
                  color: title.trim() ? "var(--lifeflow-primary)" : "var(--color-text-disabled)",
                  opacity: saving ? 0.5 : 1,
                }}
              >
                保存
              </button>
            </div>

            {/* 表单 */}
            <div className="px-5 pt-2 pb-6 flex flex-col gap-4">
              {/* 任务名称 */}
              <div>
                <label className="text-[13px] mb-1.5 block" style={{ color: "var(--color-text-secondary)" }}>任务名称</label>
                <input
                  type="text"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="输入任务名称"
                  className="w-full h-11 rounded-[10px] px-4 text-[15px] outline-none"
                  style={{
                    backgroundColor: "var(--lifeflow-background)",
                    color: "var(--color-text-primary)",
                  }}
                  autoFocus
                />
              </div>

              {/* 备注 */}
              <div>
                <label className="text-[13px] mb-1.5 block" style={{ color: "var(--color-text-secondary)" }}>备注</label>
                <input
                  type="text"
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                  placeholder="添加备注"
                  className="w-full h-11 rounded-[10px] px-4 text-[15px] outline-none"
                  style={{
                    backgroundColor: "var(--lifeflow-background)",
                    color: "var(--color-text-primary)",
                  }}
                />
              </div>

              {/* 计划时长 */}
              <div>
                <label className="text-[13px] mb-1.5 block" style={{ color: "var(--color-text-secondary)" }}>计划时长（分钟）</label>
                <div className="flex items-center gap-3">
                  <button
                    onClick={() => setPlannedTime((v) => Math.max(5, v - 15))}
                    className="w-8 h-8 rounded-full flex items-center justify-center"
                    style={{ backgroundColor: "var(--lifeflow-primary)" }}
                  >
                    <span className="text-white text-lg leading-none">−</span>
                  </button>
                  <span className="text-[17px] font-semibold min-w-[48px] text-center" style={{ color: "var(--color-text-primary)" }}>{plannedTime}</span>
                  <button
                    onClick={() => setPlannedTime((v) => Math.min(480, v + 15))}
                    className="w-8 h-8 rounded-full flex items-center justify-center"
                    style={{ backgroundColor: "var(--lifeflow-primary)" }}
                  >
                    <span className="text-white text-lg leading-none">+</span>
                  </button>
                </div>
              </div>

              {/* 重要标记 */}
              <button
                onClick={() => setIsImportant(!isImportant)}
                className="flex items-center gap-2 self-start px-4 h-9 rounded-full text-[15px]"
                style={{
                  backgroundColor: isImportant ? "var(--lifeflow-brand-50)" : "var(--lifeflow-background)",
                  color: isImportant ? "var(--lifeflow-primary)" : "var(--color-text-secondary)",
                }}
              >
                <span className="text-lg">!</span> 重要
              </button>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}

// ============================================================
// 主组件
// ============================================================
export default function SchedulePage() {
  const router = useRouter();
  const { scheduleTasks, selectedDate, loadScheduleTasks, toggleScheduleTask, removeScheduleTask } = useEfficiencyStore();

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
    const monday = addDays(sd, sd.getDay() === 0 ? -6 : 1 - sd.getDay());
    const currentMonday = getWeekMonday(new Date(), weekOffset);
    const diffDays = Math.round((monday.getTime() - currentMonday.getTime()) / 86400000);
    if (diffDays !== 0) {
      setWeekOffset((o) => o + Math.round(diffDays / 7));
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

  // ── 任务列表排序 ──
  const sortedTasks = useMemo(() => {
    return [...(scheduleTasks ?? [])].sort((a, b) => {
      if (a.isCompleted !== b.isCompleted) return a.isCompleted ? 1 : -1;
      if (a.isImportant !== b.isImportant) return a.isImportant ? -1 : 1;
      return a.createdAt - b.createdAt;
    });
  }, [scheduleTasks]);

  // ── 即将到来 ──
  const [upcoming, setUpcoming] = useState<{ date: string; tasks: ScheduleTask[] }[]>([]);
  const refreshUpcoming = useCallback(async (fromDate: string) => {
    const result: { date: string; tasks: ScheduleTask[] }[] = [];
    for (let i = 1; i <= 7; i++) {
      const d = addDays(new Date(fromDate + "T00:00:00"), i);
      const ds = toDateStr(d);
      const tasks = await getScheduleTasksByDate(ds);
      if (tasks.length > 0) {
        const sorted = tasks.sort((a, b) => {
          if (a.isCompleted !== b.isCompleted) return a.isCompleted ? 1 : -1;
          return a.createdAt - b.createdAt;
        });
        result.push({ date: ds, tasks: sorted.slice(0, 3) });
        if (result.length >= 1) break;
      }
    }
    setUpcoming(result);
  }, []);

  useEffect(() => {
    if (selectedDate) refreshUpcoming(selectedDate);
  }, [selectedDate, refreshUpcoming]);

  // ── 任务操作 ──
  const handleToggle = useCallback(async (taskId: string) => {
    await toggleScheduleTask(taskId);
  }, [toggleScheduleTask]);

  const handleRefreshAfterOp = useCallback(async () => {
    if (selectedDate) {
      await loadScheduleTasks(selectedDate);
      refreshUpcoming(selectedDate);
    }
  }, [selectedDate, loadScheduleTasks, refreshUpcoming]);

  // ── 删除 ──
  const [deleteTarget, setDeleteTarget] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);

  const handleDeleteConfirm = useCallback(async () => {
    if (!deleteTarget) return;
    await removeScheduleTask(deleteTarget);
    showToast({ type: "success", message: "已删除" });
    setDeleteTarget(null);
    setConfirmDelete(false);
    handleRefreshAfterOp();
  }, [deleteTarget, removeScheduleTask, handleRefreshAfterOp]);

  // ── 创建任务 Sheet ──
  const [showCreateSheet, setShowCreateSheet] = useState(false);

  // ── 格式化 ──
  const formatDateChinese = (date: Date) => {
    const weekDays = ["日", "一", "二", "三", "四", "五", "六"];
    return `${date.getMonth() + 1}月${date.getDate()}日 周${weekDays[date.getDay()]}`;
  };

  const selectedDateObj = selectedDate ? new Date(selectedDate + "T00:00:00") : new Date();
  const isSelectedToday = toDateStr(selectedDateObj) === todayStr;

  return (
    <div className="mx-auto" style={{ maxWidth: 430, minHeight: "100vh", backgroundColor: "var(--lifeflow-background)", paddingBottom: 100 }}>
      {/* ===== Header ===== */}
      <div className="flex items-center justify-between px-4 h-14" style={{ backgroundColor: "var(--lifeflow-background)" }}>
        <button
          type="button"
          onClick={() => router.push("/efficiency")}
          className="w-8 h-8 -ml-1 flex items-center justify-center"
        >
          <ChevronLeft className="w-6 h-6" style={{ color: "var(--color-text-primary)" }} />
        </button>
        <span className="text-[20px] font-bold absolute left-1/2 -translate-x-1/2" style={{ color: "var(--color-text-primary)" }}>
          日程
        </span>
        <button
          type="button"
          onClick={() => setShowCreateSheet(true)}
          className="w-8 h-8 -mr-1 flex items-center justify-center"
        >
          <Plus className="w-6 h-6" style={{ color: "var(--lifeflow-primary)" }} />
        </button>
      </div>

      {/* ===== Week Strip ===== */}
      <motion.div className="px-4 select-none" onPanEnd={handleDragEnd}>
        {/* 星期行 + chevrons */}
        <div className="flex items-center">
          <button
            type="button"
            onClick={() => setWeekOffset((o) => o - 1)}
            className="w-8 h-8 flex items-center justify-center shrink-0"
          >
            <ChevronLeft className="w-4 h-4" style={{ color: "var(--color-text-secondary)" }} />
          </button>
          <div className="grid grid-cols-7 flex-1 h-7">
            {WEEK_DAYS.map((d) => (
              <span key={d} className="text-[13px] text-center self-center" style={{ color: "var(--color-text-secondary)" }}>
                {d}
              </span>
            ))}
          </div>
          <button
            type="button"
            onClick={() => setWeekOffset((o) => o + 1)}
            className="w-8 h-8 flex items-center justify-center shrink-0"
          >
            <ChevronRight className="w-4 h-4" style={{ color: "var(--color-text-secondary)" }} />
          </button>
        </div>

        {/* 日期行 */}
        <div className="grid grid-cols-7 h-[52px]">
          {weekDates.map((date) => {
            const ds = toDateStr(date);
            const isToday = ds === todayStr;
            const isActive = ds === selectedDate;
            return (
              <button
                key={ds}
                type="button"
                onClick={() => handleSelectDay(date)}
                className="flex items-center justify-center"
              >
                {isActive ? (
                  <div className="relative flex items-center justify-center">
                    <span
                      className="absolute w-[36px] h-[36px] rounded-full"
                      style={{ backgroundColor: "var(--lifeflow-brand-50)" }}
                    />
                    <span
                      className="relative w-[28px] h-[28px] rounded-full flex items-center justify-center"
                      style={{ backgroundColor: "var(--lifeflow-primary)" }}
                    >
                      <span className="text-[17px] font-medium text-white">{date.getDate()}</span>
                    </span>
                  </div>
                ) : (
                  <span
                    className="text-[17px] font-medium"
                    style={{ color: isToday ? "var(--lifeflow-primary)" : "var(--color-text-primary)" }}
                  >
                    {date.getDate()}
                  </span>
                )}
              </button>
            );
          })}
        </div>
      </motion.div>

      {/* ===== Date Title Row ===== */}
      <div className="flex items-center justify-between px-4 mt-5">
        <span className="text-[16px] font-bold" style={{ color: "var(--color-text-primary)" }}>
          {formatDateChinese(selectedDateObj)}
        </span>
        {(weekOffset !== 0 || !isSelectedToday) && (
          <button
            onClick={() => {
              setWeekOffset(0);
              loadScheduleTasks(todayStr);
            }}
            className="text-[13px]"
            style={{ color: "var(--lifeflow-primary)" }}
          >
            回到今天
          </button>
        )}
      </div>

      {/* ===== 当日任务分组卡 ===== */}
      <div className="px-4 mt-3">
        {sortedTasks.length === 0 ? (
          <div className="flex flex-col items-center py-16">
            <CalendarDays className="w-10 h-10" style={{ color: "var(--lifeflow-border)" }} />
            <p className="text-[15px] mt-3" style={{ color: "var(--color-text-secondary)" }}>
              当日暂无安排
            </p>
          </div>
        ) : (
          <div
            className="rounded-[20px] overflow-hidden"
            style={{
              backgroundColor: "var(--color-surface-card)",
              border: "1px solid var(--lifeflow-border)",
              boxShadow: "var(--shadow-card)",
            }}
          >
            {sortedTasks.map((task, idx) => (
              <div key={task.id}>
                {idx > 0 && <div className="h-px ml-[52px]" style={{ backgroundColor: "var(--lifeflow-border)" }} />}
                <TaskRow
                  task={task}
                  onToggle={async () => {
                    await handleToggle(task.id);
                    handleRefreshAfterOp();
                  }}
                  onLongPress={() => { setDeleteTarget(task.id); setConfirmDelete(false); }}
                />
              </div>
            ))}
          </div>
        )}
      </div>

      {/* ===== 即将到来 ===== */}
      {upcoming.length > 0 && (
        <div className="px-4 mt-6">
          <h3 className="text-[18px] font-semibold mb-2" style={{ color: "var(--color-text-secondary)" }}>即将到来</h3>
          {upcoming.map((u) => (
            <div
              key={u.date}
              className="rounded-[20px] overflow-hidden"
              style={{
                backgroundColor: "var(--color-surface-card)",
                border: "1px solid var(--lifeflow-border)",
                boxShadow: "var(--shadow-card)",
              }}
            >
              <div className="px-4 min-h-[44px] flex items-center">
                <span className="text-[13px]" style={{ color: "var(--color-text-secondary)" }}>
                  {formatDateChinese(new Date(u.date + "T00:00:00"))}
                </span>
              </div>
              {u.tasks.map((t, i) => (
                <div key={t.id}>
                  <div className="h-px ml-[52px]" style={{ backgroundColor: "var(--lifeflow-border)" }} />
                  <TaskRow
                    task={t}
                    onToggle={async () => {
                      await handleToggle(t.id);
                      handleRefreshAfterOp();
                    }}
                    onLongPress={() => { setDeleteTarget(t.id); setConfirmDelete(false); }}
                  />
                </div>
              ))}
            </div>
          ))}
        </div>
      )}

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
              className="fixed left-1/2 bottom-0 w-full max-w-[430px] z-[60] rounded-t-[20px]"
              style={{
                backgroundColor: "var(--color-surface-card)",
                paddingBottom: "env(safe-area-inset-bottom)",
              }}
            >
              <div className="flex justify-center pt-2 pb-3">
                <div className="w-9 h-1 rounded-full bg-[#D4D4D4]" />
              </div>
              <div className="px-4 pb-6">
                <p className="text-[17px] font-semibold mb-4" style={{ color: "var(--color-text-primary)" }}>
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
                      className="flex-1 py-3 rounded-xl text-[15px] font-medium"
                      style={{ backgroundColor: "var(--lifeflow-background)", color: "var(--color-text-secondary)" }}
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

      {/* ===== 创建任务 Sheet ===== */}
      <CreateTaskSheet
        open={showCreateSheet}
        onClose={() => setShowCreateSheet(false)}
        selectedDate={selectedDate || todayStr}
      />

      <div className="h-4" />
    </div>
  );
}
