"use client";

import { useState, useEffect, useCallback, useMemo, useRef } from "react";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence, type PanInfo } from "framer-motion";
import {
  ChevronLeft, ChevronRight, Plus, Check, Trash2, Clock, CalendarDays,
  AlertCircle, RefreshCw, Calendar, RotateCcw, ChevronDown, TrendingUp, AlertTriangle,
} from "lucide-react";
import { useEfficiencyStore } from "@/lib/store/efficiencyStore";
import type { ScheduleTask } from "@/lib/db/efficiency.db";
import { getScheduleTasksByDate } from "@/lib/db/efficiency.db";
import { showToast } from "@/components/ui/Toast";

// ============================================================
// 设计令牌（Apple 简约风）
// ============================================================
const ACCENT = "#5865F2";
const MUTED = "#86868B";
const BORDER = "#EBEBEB";
const STRONG = "#C7C7CC";
const DANGER = "#FF3B30";
const WARNING = "#FF9500";
const NO_END_DATE = "9999-12-31";

// ── 周一起始 ──
const WEEK_DAYS = ["一", "二", "三", "四", "五", "六", "日"];

const REPEAT_OPTIONS = [
  { value: "none" as const, label: "无循环" },
  { value: "daily" as const, label: "每天" },
  { value: "weekly" as const, label: "每周" },
  { value: "custom" as const, label: "自定义" },
];
const PROGRESS_RESET_OPTIONS = [
  { value: "none" as const, label: "不重置" },
  { value: "daily" as const, label: "每天" },
  { value: "weekly" as const, label: "每周" },
  { value: "monthly" as const, label: "每月" },
];
const TASK_DAYS_OPTIONS = [
  { value: "everyday" as const, label: "每天" },
  { value: "workday" as const, label: "工作日" },
  { value: "weekend" as const, label: "周末" },
  { value: "custom" as const, label: "自定义" },
];
const PROGRESS_CALC_OPTIONS = [
  { value: "sum" as const, label: "求和" },
  { value: "average" as const, label: "平均值" },
];

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
/** 获取周一 */
function getWeekMonday(baseDate: Date, weekOffset: number): Date {
  const dow = baseDate.getDay();
  const mondayOffset = dow === 0 ? -6 : 1 - dow; // Sun=0 → Mon offset, Mon=1 → 0
  return addDays(addDays(baseDate, mondayOffset), weekOffset * 7);
}
function formatSlashDate(dateStr: string): string {
  if (!dateStr) return "";
  return dateStr.replace(/-/g, "/");
}
function formatCnDate(dateStr: string): string {
  if (!dateStr || dateStr === NO_END_DATE) return "不设置";
  const [y, m, d] = dateStr.split("-").map(Number);
  return `${y}年${m}月${d}日`;
}

// ============================================================
// 表单
// ============================================================
interface FormData {
  title: string;
  note: string;
  startDate: string;
  endDate: string;
  repeat: "none" | "daily" | "weekly" | "custom";
  isImportant: boolean;
  isProgressTask: boolean;
  progressReset: "none" | "daily" | "weekly" | "monthly";
  targetValue: number;
  unit: string;
  startValue: number;
  taskDays: "everyday" | "workday" | "weekend" | "custom";
  dailyMin: number;
  progressCalc: "sum" | "average";
  hasSubtasks: boolean;
}

function getDefaultForm(selectedDate: string): FormData {
  return {
    title: "", note: "",
    startDate: selectedDate, endDate: selectedDate,
    repeat: "none", isImportant: false, isProgressTask: false,
    progressReset: "none", targetValue: 100, unit: "", startValue: 0,
    taskDays: "everyday", dailyMin: 0, progressCalc: "sum", hasSubtasks: false,
  };
}

function mapFormToTask(form: FormData): Omit<ScheduleTask, "id" | "createdAt"> {
  const effectiveEnd = form.endDate || form.startDate;
  const base: Omit<ScheduleTask, "id" | "createdAt"> = {
    goalId: null, title: form.title.trim(),
    type: form.repeat !== "none" ? "recurring" : form.startDate === effectiveEnd ? "single" : "multi_day",
    date: form.startDate === effectiveEnd ? form.startDate : null,
    startDate: form.startDate, endDate: effectiveEnd,
    recurringDays: form.repeat === "daily" ? [0, 1, 2, 3, 4, 5, 6]
      : form.repeat === "weekly" ? [new Date(form.startDate).getDay()] : undefined,
    isCompleted: false, plannedTime: 0, actualTime: 0,
    isImportant: form.isImportant, note: form.note,
  };
  if (form.isProgressTask) {
    return { ...base, progressType: "progress", progressPeriod: form.progressReset,
      targetValue: form.targetValue, targetUnit: form.unit, startValue: form.startValue,
      taskDays: form.taskDays, dailyMin: form.dailyMin, progressCalc: form.progressCalc,
      hasSubTasks: form.hasSubtasks };
  }
  return { ...base, progressType: "normal" };
}

// ============================================================
// 主组件
// ============================================================
export default function SchedulePage() {
  const router = useRouter();
  const scheduleTasks = useEfficiencyStore((s) => s.scheduleTasks);
  const selectedDate = useEfficiencyStore((s) => s.selectedDate);
  const storeLoading = useEfficiencyStore((s) => s.loading);
  const loadScheduleTasks = useEfficiencyStore((s) => s.loadScheduleTasks);
  const addScheduleTask = useEfficiencyStore((s) => s.addScheduleTask);
  const toggleScheduleTask = useEfficiencyStore((s) => s.toggleScheduleTask);
  const removeScheduleTask = useEfficiencyStore((s) => s.removeScheduleTask);
  const setSelectedDate = useEfficiencyStore((s) => s.setSelectedDate);

  const today = useMemo(() => new Date(), []);
  const todayStr = useMemo(() => toDateStr(today), [today]);

  const [weekOffset, setWeekOffset] = useState(0);
  const [sheetOpen, setSheetOpen] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<string | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  // 长按删除
  const pressTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const startLongPress = useCallback((taskId: string) => {
    if (pressTimer.current) clearTimeout(pressTimer.current);
    pressTimer.current = setTimeout(() => setDeleteTarget(taskId), 500);
  }, []);
  const cancelLongPress = useCallback(() => {
    if (pressTimer.current) clearTimeout(pressTimer.current);
  }, []);

  // ─── 周日历（周一起始）───
  const weekDates = useMemo(
    () => WEEK_DAYS.map((_, i) => addDays(getWeekMonday(today, weekOffset), i)),
    [today, weekOffset],
  );

  useEffect(() => { loadScheduleTasks(selectedDate); }, [selectedDate, loadScheduleTasks]);

  const sortedTasks = useMemo(() => {
    const copy = [...scheduleTasks];
    copy.sort((a, b) => {
      if (a.isCompleted !== b.isCompleted) return a.isCompleted ? 1 : -1;
      if (a.isImportant !== b.isImportant) return a.isImportant ? -1 : 1;
      return a.createdAt - b.createdAt;
    });
    return copy;
  }, [scheduleTasks]);

  const isToday = selectedDate === todayStr;

  // ── 「即将到来」数据 ──
  const [upcomingTasks, setUpcomingTasks] = useState<ScheduleTask[]>([]);
  const [upcomingDate, setUpcomingDate] = useState<string | null>(null);

  const refreshUpcoming = useCallback(async (fromDate: string) => {
    for (let i = 1; i <= 7; i++) {
      const d = addDays(new Date(fromDate + "T00:00:00"), i);
      const ds = toDateStr(d);
      const tasks = await getScheduleTasksByDate(ds);
      if (tasks.length > 0) {
        tasks.sort((a, b) => {
          if (a.isCompleted !== b.isCompleted) return a.isCompleted ? 1 : -1;
          if (a.isImportant !== b.isImportant) return a.isImportant ? -1 : 1;
          return a.createdAt - b.createdAt;
        });
        setUpcomingTasks(tasks.slice(0, 3));
        setUpcomingDate(ds);
        return;
      }
    }
    setUpcomingTasks([]);
    setUpcomingDate(null);
  }, []);

  useEffect(() => {
    refreshUpcoming(selectedDate);
  }, [selectedDate, refreshUpcoming, scheduleTasks]);

  // ─── 交互 ───
  const handleSelectDay = useCallback((d: Date) => {
    setSelectedDate(toDateStr(d));
  }, [setSelectedDate]);

  const goToday = useCallback(() => {
    setWeekOffset(0);
    setSelectedDate(todayStr);
  }, [setSelectedDate, todayStr]);

  const handleDragEnd = useCallback((_: unknown, info: PanInfo) => {
    if (info.offset.x < -60) setWeekOffset((w) => w + 1);
    else if (info.offset.x > 60) setWeekOffset((w) => w - 1);
  }, []);

  const handleToggle = useCallback(async (taskId: string) => {
    await toggleScheduleTask(taskId);
  }, [toggleScheduleTask]);

  const handleDelete = useCallback(async (taskId: string) => {
    setIsDeleting(true);
    try {
      await removeScheduleTask(taskId);
      setDeleteTarget(null);
      showToast({ type: "success", message: "任务已删除" });
    } catch {
      showToast({ type: "error", message: "删除失败" });
    } finally { setIsDeleting(false); }
  }, [removeScheduleTask]);

  const selectedDateObj = new Date(selectedDate + "T00:00:00");

  // ─── 渲染 ───
  return (
    <div className="min-h-screen bg-[#FAFAFA]">
      {/* ===== Header ===== */}
      <div className="flex items-center justify-between px-4 h-14">
        <button type="button" onClick={() => router.push("/efficiency")} className="w-8 h-8 -ml-1 flex items-center justify-center">
          <ChevronLeft className="w-6 h-6 text-[#1D1D1F]" />
        </button>
        <span className="text-[18px] font-semibold text-[#1D1D1F] absolute left-1/2 -translate-x-1/2">
          日程
        </span>
        <button type="button" onClick={() => setSheetOpen(true)} className="w-8 h-8 -mr-1 flex items-center justify-center">
          <Plus className="w-6 h-6 text-[#5865F2]" />
        </button>
      </div>

      {/* ===== 周条 ===== */}
      <div className="px-4">
        {/* 星期行 + 周切换 */}
        <div className="relative flex items-center h-7">
          <button onClick={() => setWeekOffset((w) => w - 1)} className="absolute left-0 w-8 h-8 flex items-center justify-center">
            <ChevronLeft className="w-4 h-4 text-[#AEAEB2]" />
          </button>
          <div className="grid grid-cols-7 w-full">
            {WEEK_DAYS.map((w) => (
              <div key={w} className="flex items-center justify-center">
                <span className="text-[13px] text-[#86868B]">{w}</span>
              </div>
            ))}
          </div>
          <button onClick={() => setWeekOffset((w) => w + 1)} className="absolute right-0 w-8 h-8 flex items-center justify-center">
            <ChevronRight className="w-4 h-4 text-[#AEAEB2]" />
          </button>
        </div>

        {/* 日期行 */}
        <motion.div
          className="grid grid-cols-7 h-[52px] cursor-grab active:cursor-grabbing"
          drag="x" dragConstraints={{ left: 0, right: 0 }} dragElastic={0.2} onDragEnd={handleDragEnd}
        >
          {weekDates.map((d) => {
            const ds = toDateStr(d);
            const isSel = ds === selectedDate;
            const isTdy = ds === todayStr;
            return (
              <div key={ds} className="flex items-center justify-center">
                <button
                  type="button" onClick={() => handleSelectDay(d)}
                  className="flex items-center justify-center"
                >
                  {isSel ? (
                    <span className="relative w-9 h-9 flex items-center justify-center">
                      <span className="absolute w-9 h-9 rounded-full bg-[#EEF2FF]" />
                      <span className="absolute w-7 h-7 rounded-full bg-[#5865F2] flex items-center justify-center">
                        <span className="text-[17px] font-medium text-white">{d.getDate()}</span>
                      </span>
                    </span>
                  ) : (
                    <span className="w-9 h-9 flex items-center justify-center">
                      <span className={`text-[17px] font-medium ${isTdy ? "text-[#5865F2]" : "text-[#1D1D1F]"}`}>
                        {d.getDate()}
                      </span>
                    </span>
                  )}
                </button>
              </div>
            );
          })}
        </motion.div>
      </div>

      {/* ===== 日期标题行 ===== */}
      <div className="flex items-center justify-between px-4 mt-5">
        <span className="text-[16px] font-bold text-[#1D1D1F]">
          {selectedDateObj.getMonth() + 1}月{selectedDateObj.getDate()}日 周{WEEK_DAYS[selectedDateObj.getDay() === 0 ? 6 : selectedDateObj.getDay() - 1]}
        </span>
        {(weekOffset !== 0 || !isToday) && (
          <button type="button" onClick={goToday} className="text-[13px] text-[#5865F2]">
            回到今天
          </button>
        )}
      </div>

      {/* ===== 当日任务卡 ===== */}
      <div className="mx-4 mt-3 bg-white rounded-2xl border border-[#F0F0F0] overflow-hidden">
        {storeLoading ? (
          <div className="p-4 space-y-3 animate-pulse">
            {[1, 2].map((i) => (
              <div key={i} className="flex items-center gap-3 min-h-[54px]">
                <div className="w-6 h-6 rounded-full bg-[#F5F5F5] flex-shrink-0" />
                <div className="flex-1"><div className="h-5 w-3/5 bg-[#F5F5F5] rounded" /></div>
              </div>
            ))}
          </div>
        ) : sortedTasks.length === 0 ? (
          <div className="flex flex-col items-center py-16">
            <CalendarDays className="w-10 h-10 text-[#E5E5E5]" />
            <p className="text-[15px] text-[#86868B] mt-3">
              {isToday ? "今天没有任务" : "这一天没有任务"}
            </p>
          </div>
        ) : (
          sortedTasks.map((task, i) => (
            <motion.div
              key={task.id}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.04, duration: 0.3 }}
              className="relative flex items-center gap-3 px-4 py-2 min-h-[54px]"
              onPointerDown={() => startLongPress(task.id)}
              onPointerUp={cancelLongPress}
              onPointerLeave={cancelLongPress}
              onContextMenu={(e) => { e.preventDefault(); setDeleteTarget(task.id); }}
            >
              {i > 0 && <div className="absolute left-[52px] right-0 top-0" style={{ borderTop: "0.5px solid #EBEBEB" }} />}
              {/* 勾选圆 */}
              <button
                type="button"
                onClick={(e) => { e.stopPropagation(); handleToggle(task.id); }}
                className="w-6 h-6 rounded-full flex-shrink-0 flex items-center justify-center transition-colors"
                style={{
                  border: task.isCompleted ? "none" : "2px solid #C7C7CC",
                  background: task.isCompleted ? ACCENT : "#FFFFFF",
                }}
              >
                {task.isCompleted && <Check className="w-[14px] h-[14px] text-white" strokeWidth={3} />}
              </button>
              {/* 内容 */}
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-1.5">
                  <p
                    className="text-[17px] truncate"
                    style={{
                      color: task.isCompleted ? "#AEAEB2" : "#1D1D1F",
                      textDecoration: task.isCompleted ? "line-through" : "none",
                    }}
                  >
                    {task.title}
                  </p>
                  {task.isImportant && !task.isCompleted && (
                    <span className="w-[6px] h-[6px] rounded-full flex-shrink-0 bg-[#5865F2]" />
                  )}
                </div>
                <div className="flex items-center gap-2 mt-1">
                  {task.plannedTime > 0 && (
                    <span className="inline-flex items-center gap-1 text-[11px] px-1.5 py-0.5 rounded-md bg-[#F5F5F5] text-[#86868B]">
                      <Clock className="w-3 h-3" />{task.plannedTime}分钟
                    </span>
                  )}
                  {task.progressType === "progress" && task.targetValue ? (
                    <span className="inline-flex items-center gap-1 text-[11px] px-1.5 py-0.5 rounded-md bg-[#EEF2FF] text-[#5865F2]">
                      <TrendingUp className="w-3 h-3" />目标 {task.targetValue}{task.targetUnit || ""}
                    </span>
                  ) : null}
                  {task.note && (
                    <p className="text-[13px] text-[#86868B] truncate">{task.note}</p>
                  )}
                </div>
              </div>
            </motion.div>
          ))
        )}
      </div>

      {/* ===== 「即将到来」区 ===== */}
      {upcomingDate && upcomingTasks.length > 0 && (
        <>
          <p className="px-4 mt-6 mb-2 text-[18px] font-semibold text-[#86868B]">即将到来</p>
          <div className="mx-4 bg-white rounded-2xl border border-[#F0F0F0] overflow-hidden">
            <div className="min-h-[44px] flex items-center px-4">
              <span className="text-[13px] text-[#86868B]">
                {(() => {
                  const d = new Date(upcomingDate + "T00:00:00");
                  return `${d.getMonth() + 1}月${d.getDate()}日 周${WEEK_DAYS[d.getDay() === 0 ? 6 : d.getDay() - 1]}`;
                })()}
              </span>
            </div>
            <div className="mx-4 h-0" style={{ borderTop: "0.5px solid #EBEBEB" }} />
            {upcomingTasks.map((task, i) => (
              <motion.div
                key={task.id}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.04, duration: 0.3 }}
                className="flex items-center gap-3 px-4 py-2 min-h-[54px]"
                onPointerDown={() => startLongPress(task.id)}
                onPointerUp={cancelLongPress}
                onPointerLeave={cancelLongPress}
                onContextMenu={(e) => { e.preventDefault(); setDeleteTarget(task.id); }}
              >
                {i > 0 && <div className="absolute left-0 right-0 h-0" />}
                <button
                  type="button"
                  onClick={(e) => { e.stopPropagation(); handleToggle(task.id); }}
                  className="w-6 h-6 rounded-full flex-shrink-0 flex items-center justify-center"
                  style={{
                    border: task.isCompleted ? "none" : "2px solid #C7C7CC",
                    background: task.isCompleted ? ACCENT : "#FFFFFF",
                  }}
                >
                  {task.isCompleted && <Check className="w-[14px] h-[14px] text-white" strokeWidth={3} />}
                </button>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-1.5">
                    <p className="text-[17px] truncate text-[#1D1D1F]">{task.title}</p>
                    {task.isImportant && (
                      <span className="w-[6px] h-[6px] rounded-full flex-shrink-0 bg-[#5865F2]" />
                    )}
                  </div>
                  <div className="flex items-center gap-2 mt-1">
                    {task.plannedTime > 0 && (
                      <span className="inline-flex items-center gap-1 text-[11px] px-1.5 py-0.5 rounded-md bg-[#F5F5F5] text-[#86868B]">
                        <Clock className="w-3 h-3" />{task.plannedTime}分钟
                      </span>
                    )}
                    {task.note && <p className="text-[13px] text-[#86868B] truncate">{task.note}</p>}
                  </div>
                </div>
              </motion.div>
            ))}
          </div>
        </>
      )}

      {/* ===== 删除确认弹窗 ===== */}
      <AnimatePresence>
        {deleteTarget && (
          <motion.div
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/40"
            onClick={() => setDeleteTarget(null)}
          >
            <motion.div
              initial={{ scale: 0.92, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.92, opacity: 0 }}
              onClick={(e) => e.stopPropagation()}
              className="bg-white w-[300px] p-6 rounded-2xl shadow-xl"
            >
              <div className="flex flex-col items-center text-center">
                <div className="w-12 h-12 rounded-full bg-red-50 flex items-center justify-center mb-3">
                  <AlertCircle className="w-6 h-6 text-red-400" />
                </div>
                <h3 className="text-[17px] font-semibold text-[#1D1D1F] mb-1">确认删除</h3>
                <p className="text-[13px] text-[#86868B] mb-5">删除后将无法恢复，确定要删除这个任务吗？</p>
                <div className="flex gap-3 w-full">
                  <button
                    onClick={() => setDeleteTarget(null)}
                    className="flex-1 h-9 rounded-[10px] border text-[15px] font-medium"
                    style={{ borderColor: BORDER, color: MUTED }}
                  >取消</button>
                  <button
                    onClick={() => handleDelete(deleteTarget)}
                    disabled={isDeleting}
                    className="flex-1 h-9 rounded-[10px] bg-[#FF3B30] text-[15px] font-medium text-white flex items-center justify-center gap-1.5 disabled:opacity-60"
                  >{isDeleting ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}删除</button>
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ===== 创建任务 Sheet ===== */}
      <CreateTaskSheet
        open={sheetOpen}
        selectedDate={selectedDate}
        onClose={() => setSheetOpen(false)}
        onSubmit={async (form) => {
          await addScheduleTask(mapFormToTask(form));
          showToast({ type: "success", message: "任务已保存" });
        }}
      />
    </div>
  );
}

// ============================================================
// 创建任务 Sheet
// ============================================================
function CreateTaskSheet({
  open, selectedDate, onClose, onSubmit,
}: {
  open: boolean; selectedDate: string; onClose: () => void; onSubmit: (form: FormData) => Promise<void>;
}) {
  const [form, setForm] = useState<FormData>(getDefaultForm(selectedDate));
  const [tab, setTab] = useState<"normal" | "progress">("normal");
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    if (open) { setForm(getDefaultForm(selectedDate)); setTab("normal"); setIsSaving(false); }
  }, [open, selectedDate]);

  const canSubmit = form.title.trim().length > 0;
  const patch = useCallback((p: Partial<FormData>) => setForm((prev) => ({ ...prev, ...p })), []);

  const handleAdd = useCallback(async () => {
    if (!canSubmit || isSaving) return;
    setIsSaving(true);
    try { await onSubmit(form); onClose(); } catch {
      showToast({ type: "error", message: "保存失败" });
    } finally { setIsSaving(false); }
  }, [canSubmit, isSaving, form, onSubmit, onClose]);

  const suggestedDailyMin = form.targetValue > 0 ? form.targetValue : 100;

  return (
    <AnimatePresence>
      {open && (
        <>
          <motion.div
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 z-[55] bg-black/25" onClick={onClose}
          />
          <motion.div
            initial={{ y: "100%" }} animate={{ y: 0 }} exit={{ y: "100%" }}
            transition={{ duration: 0.4, ease: [0.32, 0.72, 0, 1] }}
            className="fixed inset-x-0 bottom-0 top-[14px] z-[60] flex flex-col mx-auto w-full max-w-[430px] overflow-hidden bg-[#FAFAFA]"
            style={{ borderRadius: "24px 24px 0 0" }}
          >
            {/* 导航栏 + 下拉关闭 */}
            <motion.div
              className="flex items-center justify-between shrink-0 px-4 h-14 cursor-grab active:cursor-grabbing"
              style={{ borderBottom: `0.5px solid ${BORDER}` }}
              drag="y" dragConstraints={{ top: 0, bottom: 0 }} dragElastic={{ top: 0, bottom: 0.6 }}
              onDragEnd={(_, info) => { if (info.offset.y > 80) onClose(); }}
            >
              <button type="button" onClick={onClose} className="text-[17px] text-[#5865F2]">取消</button>
              <span className="absolute left-1/2 -translate-x-1/2 text-[17px] font-semibold text-[#1D1D1F]">创建任务</span>
              <button
                type="button" onClick={handleAdd}
                disabled={!canSubmit || isSaving}
                className="text-[17px] font-semibold"
                style={{ color: canSubmit && !isSaving ? ACCENT : STRONG }}
              >{isSaving ? "保存中…" : "添加"}</button>
            </motion.div>

            {/* 滚动内容 */}
            <div className="flex-1 overflow-y-auto px-4 pt-4 pb-10 flex flex-col gap-3">
              {/* 输入卡 */}
              <div className="bg-white rounded-xl border border-[#EBEBEB] overflow-hidden">
                <input type="text" value={form.title} onChange={(e) => patch({ title: e.target.value })}
                  placeholder="任务名称" autoFocus
                  className="block w-full h-[54px] px-4 border-none outline-none text-[17px] text-[#1D1D1F] bg-transparent placeholder-[#86868B]"
                  style={{ caretColor: ACCENT }} />
                <div style={{ height: "0.5px", background: BORDER, margin: "0 16px" }} />
                <input type="text" value={form.note} onChange={(e) => patch({ note: e.target.value })}
                  placeholder="备注"
                  className="block w-full h-[54px] px-4 border-none outline-none text-[17px] text-[#1D1D1F] bg-transparent placeholder-[#86868B]"
                  style={{ caretColor: ACCENT }} />
              </div>

              {/* 类型切换 */}
              <div className="flex shrink-0 h-9 rounded-[18px] bg-[#EBEBEB] p-0.5">
                {([{ key: "normal", label: "普通任务" }, { key: "progress", label: "进度条任务" }] as const).map((t) => {
                  const active = tab === t.key;
                  return (
                    <button key={t.key} type="button" onClick={() => {
                      setTab(t.key);
                      patch({ isProgressTask: t.key === "progress",
                        endDate: t.key === "progress" ? NO_END_DATE
                          : form.endDate === NO_END_DATE ? form.startDate : form.endDate });
                    }}
                      className="flex-1 flex items-center justify-center rounded-[16px] text-[15px]"
                      style={{
                        background: active ? "#FFFFFF" : "transparent",
                        boxShadow: active ? "0 1px 3px rgba(0,0,0,0.08)" : "none",
                        color: active ? "#1D1D1F" : MUTED, fontWeight: active ? 600 : 400,
                      }}>{t.label}</button>
                  );
                })}
              </div>

              {tab === "normal" ? <NormalFields form={form} patch={patch} /> : <ProgressFields form={form} patch={patch} suggestedDailyMin={suggestedDailyMin} />}

              {/* 收起键盘 */}
              <div className="flex items-center justify-center gap-1 pt-1 pb-2">
                <span className="text-[13px] text-[#86868B]">收起键盘</span>
                <ChevronDown className="w-[14px] h-[14px] text-[#86868B]" />
              </div>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}

// ============================================================
// 普通任务字段
// ============================================================
function NormalFields({ form, patch }: { form: FormData; patch: (p: Partial<FormData>) => void }) {
  return (
    <>
      <div className="bg-white rounded-xl border border-[#EBEBEB] p-4">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <Calendar className="w-5 h-5 text-[#86868B]" />
            <span className="text-[15px] text-[#1D1D1F]">选择日期</span>
          </div>
          <button type="button" onClick={() => patch({ endDate: form.startDate })} className="text-[15px] text-[#5865F2]">清除</button>
        </div>
        <div className="flex gap-3">
          <DateTile label="开始日期" value={form.startDate} display={formatSlashDate(form.startDate)}
            onChange={(v) => { const next: Partial<FormData> = { startDate: v }; if (form.endDate !== NO_END_DATE && form.endDate < v) next.endDate = v; patch(next); }} />
          <DateTile label="结束日期" value={form.endDate === NO_END_DATE ? form.startDate : form.endDate}
            display={formatSlashDate(form.endDate === NO_END_DATE ? form.startDate : form.endDate)}
            min={form.startDate} onChange={(v) => patch({ endDate: v })} />
        </div>
      </div>

      <OptionRow icon={<RotateCcw className="w-5 h-5 text-[#86868B]" />} label="循环" value={form.repeat}
        options={REPEAT_OPTIONS} onChange={(v) => { if (v === "custom") { showToast({ type: "info", message: "自定义循环开发中" }); return; } patch({ repeat: v as FormData["repeat"] }); }} />

      <ConfigRow icon={<Clock className="w-5 h-5 text-[#86868B]" />} label="时间和提醒"
        onClick={() => showToast({ type: "info", message: "功能开发中" })} />

      <ImportantRow value={form.isImportant} onChange={(v) => patch({ isImportant: v })} />
    </>
  );
}

// ============================================================
// 进度条任务字段
// ============================================================
function ProgressFields({ form, patch, suggestedDailyMin }: { form: FormData; patch: (p: Partial<FormData>) => void; suggestedDailyMin: number }) {
  const noEnd = form.endDate === NO_END_DATE;
  return (
    <>
      <div className="bg-white rounded-xl border border-[#EBEBEB] overflow-hidden">
        <DateRowField label="开始日期" display={formatCnDate(form.startDate)} value={form.startDate}
          onChange={(v) => patch({ startDate: v })} />
        <div style={{ height: "0.5px", background: BORDER, margin: "0 16px" }} />
        <div className="flex items-center h-14 px-4">
          <span className="text-[17px] text-[#1D1D1F] shrink-0">结束日期</span>
          <button type="button" onClick={() => patch({ endDate: noEnd ? form.startDate : NO_END_DATE })}
            className="ml-auto text-[15px]" style={{ color: noEnd ? ACCENT : MUTED }}>
            {noEnd ? "不设置" : formatCnDate(form.endDate)}</button>
          {noEnd ? <ChevronRight className="w-4 h-4 ml-2 shrink-0 text-[#AEAEB2]" />
            : <DateRowPicker value={form.endDate} min={form.startDate} onChange={(v) => patch({ endDate: v })} />}
        </div>
      </div>

      <OptionRow icon={<TrendingUp className="w-5 h-5 text-[#86868B]" />} label="进度重置周期" value={form.progressReset}
        options={PROGRESS_RESET_OPTIONS} onChange={(v) => patch({ progressReset: v as FormData["progressReset"] })} />

      <div className="bg-white rounded-xl border border-[#EBEBEB] flex items-center h-14 px-4">
        <span className="text-[17px] text-[#1D1D1F]">目标值</span>
        <div className="flex-1 flex items-center justify-end gap-2">
          <NumberBox value={form.targetValue} onChange={(v) => patch({ targetValue: v })} />
          <input type="text" value={form.unit} onChange={(e) => patch({ unit: e.target.value })}
            placeholder="单位" className="w-10 border-none outline-none bg-transparent text-[15px] placeholder-[#86868B] text-[#86868B]"
            style={{ caretColor: ACCENT }} />
        </div>
      </div>
      <div className="bg-white rounded-xl border border-[#EBEBEB] flex items-center h-14 px-4">
        <span className="text-[17px] text-[#1D1D1F]">开始值</span>
        <div className="flex-1 flex items-center justify-end"><NumberBox value={form.startValue} onChange={(v) => patch({ startValue: v })} /></div>
      </div>

      <OptionRow label="任务日" value={form.taskDays} options={TASK_DAYS_OPTIONS}
        onChange={(v) => { if (v === "custom") { showToast({ type: "info", message: "自定义任务日开发中" }); return; } patch({ taskDays: v as FormData["taskDays"] }); }} />

      <div className="bg-white rounded-xl border border-[#EBEBEB] px-4">
        <div className="flex items-center h-11">
          <span className="text-[17px] text-[#1D1D1F]">每日最低完成量</span>
          <div className="flex-1 flex items-center justify-end"><NumberBox value={form.dailyMin} onChange={(v) => patch({ dailyMin: v })} /></div>
        </div>
        <div className="pb-4"><button type="button" onClick={() => patch({ dailyMin: suggestedDailyMin })}
          className="text-[13px] text-[#5865F2]">系统建议值：{suggestedDailyMin}，点击应用</button></div>
      </div>

      <OptionRow label="进度计算方式" value={form.progressCalc} options={PROGRESS_CALC_OPTIONS}
        onChange={(v) => patch({ progressCalc: v as FormData["progressCalc"] })} />

      <div className="bg-white rounded-xl border border-[#EBEBEB] px-4">
        <div className="flex items-center h-11">
          <span className="text-[17px] text-[#1D1D1F] mr-1.5">关联子任务</span>
          <span className="text-white text-[11px] font-bold leading-[15px] rounded-md px-1.5 py-0.5 bg-[#FF9500]">PRO</span>
          <div className="flex-1" />
          <IOSToggle value={form.hasSubtasks} onChange={(v) => patch({ hasSubtasks: v })} />
        </div>
        <div className="pb-4"><span className="text-[13px] text-[#86868B]">开启后子任务的进度会自动算入本任务</span></div>
      </div>

      <ConfigRow icon={<Clock className="w-5 h-5 text-[#86868B]" />} label="时间和提醒"
        onClick={() => showToast({ type: "info", message: "功能开发中" })} />

      <ImportantRow value={form.isImportant} onChange={(v) => patch({ isImportant: v })} />
    </>
  );
}

// ============================================================
// 通用小组件
// ============================================================
function DateTile({ label, value, display, min, onChange }: { label: string; value: string; display: string; min?: string; onChange: (v: string) => void }) {
  return (
    <div className="flex-1 h-20 rounded-[10px] p-3 bg-[#F5F5F5] flex flex-col justify-between relative overflow-hidden">
      <span className="text-[13px] text-[#86868B]">{label}</span>
      <span className="text-[17px] text-[#1D1D1F]">{display}</span>
      <input type="date" value={value} min={min} onChange={(e) => e.target.value && onChange(e.target.value)}
        className="absolute inset-0 opacity-0 cursor-pointer w-full h-full" />
    </div>
  );
}
function DateRowField({ label, display, value, onChange }: { label: string; display: string; value: string; onChange: (v: string) => void }) {
  return (
    <div className="flex items-center h-14 px-4 relative">
      <span className="text-[17px] text-[#1D1D1F] shrink-0">{label}</span>
      <span className="flex-1 text-right text-[15px] text-[#86868B]">{display}</span>
      <ChevronRight className="w-4 h-4 ml-2 shrink-0 text-[#AEAEB2]" />
      <input type="date" value={value} onChange={(e) => e.target.value && onChange(e.target.value)}
        className="absolute inset-0 opacity-0 cursor-pointer w-full h-full" />
    </div>
  );
}
function DateRowPicker({ value, min, onChange }: { value: string; min?: string; onChange: (v: string) => void }) {
  return (
    <span className="relative ml-2 shrink-0 inline-flex">
      <ChevronRight className="w-4 h-4 text-[#AEAEB2]" />
      <input type="date" value={value} min={min} onChange={(e) => e.target.value && onChange(e.target.value)}
        className="absolute inset-0 opacity-0 cursor-pointer w-full h-full" />
    </span>
  );
}
function ConfigRow({ icon, label, onClick }: { icon?: React.ReactNode; label: string; onClick: () => void }) {
  return (
    <button type="button" onClick={onClick}
      className="bg-white rounded-xl border border-[#EBEBEB] flex items-center h-14 px-4 w-full text-left">
      {icon && <span className="mr-2 flex-shrink-0">{icon}</span>}
      <span className="text-[17px] text-[#1D1D1F]">{label}</span>
      <span className="flex-1" />
      <ChevronRight className="w-4 h-4 shrink-0 text-[#AEAEB2]" />
    </button>
  );
}
function OptionRow<T extends string>({ icon, label, value, options, onChange }: { icon?: React.ReactNode; label: string; value: T; options: { value: T; label: string }[]; onChange: (v: T) => void }) {
  const [open, setOpen] = useState(false);
  const current = options.find((o) => o.value === value);
  return (
    <div className="bg-white rounded-xl border border-[#EBEBEB] overflow-hidden">
      <button type="button" onClick={() => setOpen((p) => !p)} className="flex items-center h-14 px-4 w-full text-left">
        {icon && <span className="mr-2 flex-shrink-0">{icon}</span>}
        <span className="text-[17px] text-[#1D1D1F]">{label}</span>
        <span className="flex-1 text-right text-[15px] text-[#86868B]">{current?.label}</span>
        <ChevronDown className="w-4 h-4 ml-2 shrink-0 text-[#AEAEB2] transition-transform" style={{ transform: open ? "rotate(180deg)" : "none" }} />
      </button>
      <AnimatePresence initial={false}>
        {open && (
          <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.25, ease: [0.32, 0.72, 0, 1] }} className="overflow-hidden">
            <div className="flex gap-2 px-4 pb-3 flex-wrap">
              {options.map((opt) => {
                const active = opt.value === value;
                return (
                  <button key={opt.value} type="button" onClick={() => { onChange(opt.value); setOpen(false); }}
                    className="h-[30px] px-3 rounded-[15px] text-[13px]"
                    style={{ background: active ? ACCENT : "#F5F5F5", color: active ? "#FFFFFF" : MUTED }}>{opt.label}</button>
                );
              })}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
function NumberBox({ value, onChange }: { value: number; onChange: (v: number) => void }) {
  return (
    <div className="flex items-center justify-end px-3 w-20 h-9 bg-[#F2F2F7] rounded-[10px] shrink-0">
      <input type="number" value={Number.isNaN(value) ? "" : value} onChange={(e) => onChange(e.target.value === "" ? 0 : Number(e.target.value))}
        className="w-full border-none outline-none bg-transparent text-[17px] text-[#1D1D1F] text-right" style={{ caretColor: ACCENT }} />
    </div>
  );
}
function IOSToggle({ value, onChange }: { value: boolean; onChange: (v: boolean) => void }) {
  return (
    <button type="button" onClick={() => onChange(!value)} className="shrink-0 relative"
      style={{ width: 51, height: 31, borderRadius: 15.5, background: value ? ACCENT : "#E5E5E5", transition: "background 200ms" }}>
      <motion.span className="absolute bg-white rounded-full"
        style={{ top: 2, width: 27, height: 27, boxShadow: "0 1px 3px rgba(0,0,0,0.15)" }}
        animate={{ left: value ? 22 : 2 }} transition={{ type: "spring", stiffness: 500, damping: 30 }} />
    </button>
  );
}
function ImportantRow({ value, onChange }: { value: boolean; onChange: (v: boolean) => void }) {
  return (
    <div className="bg-white rounded-xl border border-[#EBEBEB] px-4 pt-4 pb-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <AlertTriangle className="w-5 h-5 text-[#FF9500]" />
          <span className="text-[17px] text-[#1D1D1F]">重要</span>
        </div>
        <IOSToggle value={value} onChange={onChange} />
      </div>
      <div className="mt-1"><span className="text-[13px] text-[#86868B]">开启后任务将优先显示</span></div>
    </div>
  );
}
