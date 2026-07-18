"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import { motion, AnimatePresence, type PanInfo } from "framer-motion";
import {
  Plus, Check, Trash2, Clock, CalendarDays, AlertCircle, RefreshCw,
  Calendar, RotateCcw, ChevronRight, ChevronDown, TrendingUp, AlertTriangle,
} from "lucide-react";
import { useEfficiencyStore } from "@/lib/store/efficiencyStore";
import type { ScheduleTask } from "@/lib/db/efficiency.db";
import { showToast } from "@/components/ui/Toast";

// ============================================================
// 设计稿基准: lifeflow-goals/pages/schedule-empty.html
//            lifeflow-goals/pages/create-task-normal.html
//            lifeflow-goals/pages/create-task-progress.html
// ============================================================

const FONT =
  "-apple-system,BlinkMacSystemFont,'SF Pro Display','SF Pro Text','Segoe UI',sans-serif";
const BRAND = "#5856D6";
const MUTED = "#8E8E93";
const BORDER = "#E5E5EA";
const STRONG = "#C7C7CC";
const CARD_SHADOW = "0 1px 2px rgba(0,0,0,0.04), 0 4px 8px rgba(0,0,0,0.02)";
const NO_END_DATE = "9999-12-31"; // 结束日期"不设置"哨兵值

const WEEK_DAYS = ["日", "一", "二", "三", "四", "五", "六"]; // 设计稿：周日起始

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

function getWeekSunday(baseDate: Date, weekOffset: number): Date {
  return addDays(addDays(baseDate, -baseDate.getDay()), weekOffset * 7);
}

function getMonthLabel(dates: Date[]): string {
  const months = Array.from(new Set(dates.map((d) => d.getMonth() + 1))).sort((a, b) => a - b);
  return months.map((m) => `${m}月`).join("/");
}

function formatCnDate(dateStr: string): string {
  if (!dateStr || dateStr === NO_END_DATE) return "不设置";
  const [y, m, d] = dateStr.split("-").map(Number);
  return `${y}年${m}月${d}日`;
}

function formatSlashDate(dateStr: string): string {
  if (!dateStr) return "";
  return dateStr.replace(/-/g, "/");
}

// ============================================================
// 表单
// ============================================================

interface FormData {
  title: string;
  note: string;
  startDate: string;
  endDate: string; // NO_END_DATE 表示"不设置"
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
    title: "",
    note: "",
    startDate: selectedDate,
    endDate: selectedDate,
    repeat: "none",
    isImportant: false,
    isProgressTask: false,
    progressReset: "none",
    targetValue: 100,
    unit: "",
    startValue: 0,
    taskDays: "everyday",
    dailyMin: 0,
    progressCalc: "sum",
    hasSubtasks: false,
  };
}

function mapFormToTask(form: FormData): Omit<ScheduleTask, "id" | "createdAt"> {
  const effectiveEnd = form.endDate || form.startDate;
  const base: Omit<ScheduleTask, "id" | "createdAt"> = {
    goalId: null,
    title: form.title.trim(),
    type: form.repeat !== "none" ? "recurring" : form.startDate === effectiveEnd ? "single" : "multi_day",
    date: form.startDate === effectiveEnd ? form.startDate : null,
    startDate: form.startDate,
    endDate: effectiveEnd,
    recurringDays:
      form.repeat === "daily"
        ? [0, 1, 2, 3, 4, 5, 6]
        : form.repeat === "weekly"
          ? [new Date(form.startDate).getDay()]
          : undefined,
    isCompleted: false,
    plannedTime: 0,
    actualTime: 0,
    isImportant: form.isImportant,
    note: form.note,
  };

  if (form.isProgressTask) {
    return {
      ...base,
      progressType: "progress",
      progressPeriod: form.progressReset,
      targetValue: form.targetValue,
      targetUnit: form.unit,
      startValue: form.startValue,
      taskDays: form.taskDays,
      dailyMin: form.dailyMin,
      progressCalc: form.progressCalc,
      hasSubTasks: form.hasSubtasks,
    };
  }

  return { ...base, progressType: "normal" };
}

// ============================================================
// 主组件
// ============================================================

export default function SchedulePage() {
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

  // ─── 周日历 ───
  const weekDates = useMemo(
    () => WEEK_DAYS.map((_, i) => addDays(getWeekSunday(today, weekOffset), i)),
    [today, weekOffset],
  );
  const monthLabel = useMemo(() => getMonthLabel(weekDates), [weekDates]);

  useEffect(() => {
    loadScheduleTasks(selectedDate);
  }, [selectedDate, loadScheduleTasks]);

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

  // ─── 交互 ───

  const handleSelectDay = useCallback(
    (d: Date) => {
      const ds = toDateStr(d);
      setSelectedDate(ds);
    },
    [setSelectedDate],
  );

  const goToday = useCallback(() => {
    setWeekOffset(0);
    setSelectedDate(todayStr);
  }, [setSelectedDate, todayStr]);

  // 左右滑动切换周
  const handleDragEnd = useCallback(
    (_: unknown, info: PanInfo) => {
      if (info.offset.x < -60) setWeekOffset((w) => w + 1);
      else if (info.offset.x > 60) setWeekOffset((w) => w - 1);
    },
    [],
  );

  const handleToggle = useCallback(
    async (taskId: string) => {
      await toggleScheduleTask(taskId);
    },
    [toggleScheduleTask],
  );

  const handleDelete = useCallback(
    async (taskId: string) => {
      setIsDeleting(true);
      try {
        await removeScheduleTask(taskId);
        setDeleteTarget(null);
        showToast({ type: "success", message: "任务已删除" });
      } catch {
        showToast({ type: "error", message: "删除失败" });
      } finally {
        setIsDeleting(false);
      }
    },
    [removeScheduleTask],
  );

  // ─── 渲染 ───

  return (
    <div style={{ fontFamily: FONT }}>
      {/* ===== 1. Header（设计稿: 34pt 月份 + calendar-days） ===== */}
      <div className="flex items-center justify-between px-[16pt] shrink-0" style={{ height: "56pt" }}>
        <h1 className="text-[34pt] font-bold leading-[41pt] text-black">{monthLabel}</h1>
        <button
          type="button"
          onClick={goToday}
          aria-label="回到今天"
          className="w-[24pt] h-[24pt] flex items-center justify-center shrink-0"
        >
          <CalendarDays className="w-[24pt] h-[24pt]" style={{ color: BRAND }} />
        </button>
      </div>

      {/* ===== 2. 星期行（设计稿: 日一二三四五六 / 28pt） ===== */}
      <div className="grid grid-cols-7 px-[16pt] shrink-0" style={{ height: "28pt" }}>
        {WEEK_DAYS.map((w) => (
          <div key={w} className="flex items-center justify-center">
            <span className="text-[13pt] leading-[18pt]" style={{ color: MUTED }}>{w}</span>
          </div>
        ))}
      </div>

      {/* ===== 3. 日期行（设计稿: 60pt / 选中 44pt 品牌色方块） ===== */}
      <motion.div
        className="grid grid-cols-7 px-[16pt] shrink-0 cursor-grab active:cursor-grabbing"
        style={{ height: "60pt" }}
        drag="x"
        dragConstraints={{ left: 0, right: 0 }}
        dragElastic={0.2}
        onDragEnd={handleDragEnd}
      >
        {weekDates.map((d) => {
          const ds = toDateStr(d);
          const isSel = ds === selectedDate;
          const isTdy = ds === todayStr;
          return (
            <div key={ds} className="flex items-center justify-center">
              <button
                type="button"
                onClick={() => handleSelectDay(d)}
                className="flex items-center justify-center"
                style={
                  isSel
                    ? { width: "44pt", height: "44pt", background: BRAND, borderRadius: "12pt" }
                    : { width: "44pt", height: "44pt" }
                }
              >
                <span
                  className="text-[20pt] font-medium leading-[24pt]"
                  style={{ color: isSel ? "#FFFFFF" : isTdy ? BRAND : "#000000" }}
                >
                  {d.getDate()}
                </span>
              </button>
            </div>
          );
        })}
      </motion.div>

      {/* ===== 4. 任务列表 / 空状态 ===== */}
      <div className="px-[16pt] mt-[12pt] flex flex-col gap-[12pt]">
        {storeLoading ? (
          <>
            <TaskSkeleton />
            <TaskSkeleton />
          </>
        ) : sortedTasks.length === 0 ? (
          <motion.div
            key="empty"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4, delay: 0.15, ease: [0.32, 0.72, 0, 1] }}
            className="flex flex-col items-center justify-center pt-[48pt]"
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src="/assets/schedule-empty-illustration.jpg"
              alt="空状态插图"
              className="w-[170pt] h-[170pt] object-contain"
            />
            <p
              className="mt-[16pt] text-center text-[17pt] leading-[22pt] tracking-[-0.41pt]"
              style={{ color: MUTED }}
            >
              {isToday ? "今天你没有任务哦，嗷～" : "这一天没有任务哦，嗷～"}
            </p>
          </motion.div>
        ) : (
          sortedTasks.map((task, i) => (
            <TaskCard
              key={task.id}
              task={task}
              index={i}
              onToggle={() => handleToggle(task.id)}
              onDeleteRequest={() => setDeleteTarget(task.id)}
            />
          ))
        )}
      </div>

      {/* ===== 5. FAB（设计稿: 纯色品牌色 / right 20pt / bottom 107pt） ===== */}
      <button
        type="button"
        aria-label="创建任务"
        onClick={() => setSheetOpen(true)}
        className="fixed flex items-center justify-center z-40"
        style={{
          right: "calc(50% - 215px + 20pt)",
          bottom: "107pt",
          width: "56pt",
          height: "56pt",
          background: BRAND,
          borderRadius: "28pt",
          boxShadow: "0 4px 12px rgba(88, 86, 214, 0.4)",
        }}
      >
        <Plus className="w-[24pt] h-[24pt]" style={{ color: "#FFFFFF" }} />
      </button>

      {/* ===== 6. 创建任务表单（全屏 Sheet，按设计稿 1:1） ===== */}
      <CreateTaskSheet
        open={sheetOpen}
        selectedDate={selectedDate}
        onClose={() => setSheetOpen(false)}
        onSubmit={async (form) => {
          await addScheduleTask(mapFormToTask(form));
          showToast({ type: "success", message: "任务已保存" });
        }}
      />

      {/* ===== 7. 删除确认 ===== */}
      <AnimatePresence>
        {deleteTarget && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center"
            style={{ background: "rgba(0,0,0,0.4)" }}
            onClick={() => setDeleteTarget(null)}
          >
            <motion.div
              initial={{ scale: 0.92, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.92, opacity: 0 }}
              onClick={(e) => e.stopPropagation()}
              className="bg-white w-[300px] p-6 shadow-xl"
              style={{ borderRadius: "16pt" }}
            >
              <div className="flex flex-col items-center text-center">
                <div className="w-12 h-12 rounded-full bg-red-50 flex items-center justify-center mb-3">
                  <AlertCircle className="w-6 h-6 text-red-400" />
                </div>
                <h3 className="text-[17pt] font-semibold text-black mb-1">确认删除</h3>
                <p className="text-[13pt] mb-5" style={{ color: MUTED }}>
                  删除后将无法恢复，确定要删除这个任务吗？
                </p>
                <div className="flex gap-3 w-full">
                  <button
                    onClick={() => setDeleteTarget(null)}
                    className="flex-1 h-[36pt] rounded-[10pt] border text-[15pt] font-medium"
                    style={{ borderColor: BORDER, color: MUTED }}
                  >
                    取消
                  </button>
                  <button
                    onClick={() => handleDelete(deleteTarget)}
                    disabled={isDeleting}
                    className="flex-1 h-[36pt] rounded-[10pt] bg-[#FF3B30] text-[15pt] font-medium text-white flex items-center justify-center gap-1.5 disabled:opacity-60"
                  >
                    {isDeleting ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}
                    删除
                  </button>
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

// ============================================================
// TaskCard（设计稿无任务卡，按同一设计语言绘制）
// ============================================================

function TaskCard({
  task,
  index,
  onToggle,
  onDeleteRequest,
}: {
  task: ScheduleTask;
  index: number;
  onToggle: () => void;
  onDeleteRequest: () => void;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.04, duration: 0.3, ease: [0.32, 0.72, 0, 1] }}
      className="bg-white rounded-[12pt] p-[12pt] flex items-start gap-[10pt] group"
      style={{ boxShadow: CARD_SHADOW }}
    >
      {/* 勾选 */}
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          onToggle();
        }}
        aria-label="完成"
        className="w-[22pt] h-[22pt] rounded-full border-2 flex-shrink-0 flex items-center justify-center mt-[1pt] transition-colors"
        style={{
          borderColor: task.isCompleted ? BRAND : STRONG,
          background: task.isCompleted ? BRAND : "#FFFFFF",
        }}
      >
        {task.isCompleted && <Check className="w-[12pt] h-[12pt]" style={{ color: "#FFF" }} strokeWidth={3} />}
      </button>

      {/* 内容 */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-[6pt]">
          <p
            className="text-[17pt] leading-[22pt] truncate"
            style={{
              color: task.isCompleted ? STRONG : "#000000",
              textDecoration: task.isCompleted ? "line-through" : "none",
            }}
          >
            {task.title}
          </p>
          {task.isImportant && !task.isCompleted && (
            <span className="w-[6pt] h-[6pt] rounded-full flex-shrink-0" style={{ background: BRAND }} />
          )}
        </div>
        <div className="flex items-center gap-[8pt] mt-[4pt]">
          {task.plannedTime > 0 && (
            <span
              className="inline-flex items-center gap-[3pt] text-[11pt] px-[6pt] py-[2pt] rounded-[6pt]"
              style={{ color: MUTED, background: "#F5F5F7" }}
            >
              <Clock className="w-[10pt] h-[10pt]" />
              {task.plannedTime}分钟
            </span>
          )}
          {task.progressType === "progress" && task.targetValue ? (
            <span
              className="inline-flex items-center gap-[3pt] text-[11pt] px-[6pt] py-[2pt] rounded-[6pt]"
              style={{ color: BRAND, background: "rgba(88,86,214,0.12)" }}
            >
              <TrendingUp className="w-[10pt] h-[10pt]" />
              目标 {task.targetValue}
              {task.targetUnit || ""}
            </span>
          ) : null}
          {task.note && (
            <p className="text-[13pt] leading-[18pt] truncate" style={{ color: MUTED }}>
              {task.note}
            </p>
          )}
        </div>
      </div>

      {/* 删除 */}
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          onDeleteRequest();
        }}
        aria-label="删除"
        className="w-[24pt] h-[24pt] rounded-[6pt] flex items-center justify-center flex-shrink-0 opacity-40 hover:opacity-100 hover:bg-red-50 transition-opacity"
      >
        <Trash2 className="w-[14pt] h-[14pt]" style={{ color: "#FF3B30" }} />
      </button>
    </motion.div>
  );
}

function TaskSkeleton() {
  return (
    <div className="bg-white rounded-[12pt] p-[12pt] flex items-start gap-[10pt] animate-pulse" style={{ boxShadow: CARD_SHADOW }}>
      <div className="w-[22pt] h-[22pt] rounded-full bg-[#F5F5F7] flex-shrink-0" />
      <div className="flex-1">
        <div className="h-[22pt] w-3/5 bg-[#F5F5F7] rounded-[8pt]" />
        <div className="h-[18pt] w-2/5 bg-[#F5F5F7] rounded-[8pt] mt-[4pt]" />
      </div>
    </div>
  );
}

// ============================================================
// 创建任务 Sheet（设计稿 create-task-normal / create-task-progress）
// ============================================================

function CreateTaskSheet({
  open,
  selectedDate,
  onClose,
  onSubmit,
}: {
  open: boolean;
  selectedDate: string;
  onClose: () => void;
  onSubmit: (form: FormData) => Promise<void>;
}) {
  const [form, setForm] = useState<FormData>(getDefaultForm(selectedDate));
  const [tab, setTab] = useState<"normal" | "progress">("normal");
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    if (open) {
      setForm(getDefaultForm(selectedDate));
      setTab("normal");
      setIsSaving(false);
    }
  }, [open, selectedDate]);

  const canSubmit = form.title.trim().length > 0;

  const patch = useCallback((p: Partial<FormData>) => {
    setForm((prev) => ({ ...prev, ...p }));
  }, []);

  const handleAdd = useCallback(async () => {
    if (!canSubmit || isSaving) return;
    setIsSaving(true);
    try {
      await onSubmit(form);
      onClose();
    } catch {
      showToast({ type: "error", message: "保存失败" });
    } finally {
      setIsSaving(false);
    }
  }, [canSubmit, isSaving, form, onSubmit, onClose]);

  const suggestedDailyMin = form.targetValue > 0 ? form.targetValue : 100;

  return (
    <AnimatePresence>
      {open && (
        <>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[55]"
            style={{ background: "rgba(0,0,0,0.25)" }}
            onClick={onClose}
          />
          <motion.div
            initial={{ y: "100%" }}
            animate={{ y: 0 }}
            exit={{ y: "100%" }}
            transition={{ duration: 0.4, ease: [0.32, 0.72, 0, 1] }}
            className="fixed inset-x-0 bottom-0 top-[14pt] z-[60] flex flex-col mx-auto w-full max-w-[430px] overflow-hidden"
            style={{
              background: "#F5F5F7",
              borderRadius: "24pt 24pt 0 0",
              fontFamily: FONT,
            }}
          >
            {/* ===== 导航栏（设计稿: 56pt / 取消 · 创建任务 · 添加；下拉关闭） ===== */}
            <motion.div
              className="flex items-center justify-between shrink-0 px-[16pt] relative cursor-grab active:cursor-grabbing"
              style={{ height: "56pt", borderBottom: `0.5pt solid ${BORDER}` }}
              drag="y"
              dragConstraints={{ top: 0, bottom: 0 }}
              dragElastic={{ top: 0, bottom: 0.6 }}
              onDragEnd={(_, info) => {
                if (info.offset.y > 80) onClose();
              }}
            >
              <button type="button" onClick={onClose} className="text-[17pt] leading-[22pt]" style={{ color: BRAND }}>
                取消
              </button>
              <span className="absolute left-1/2 -translate-x-1/2 text-[17pt] font-semibold leading-[22pt] text-black">
                创建任务
              </span>
              <button
                type="button"
                onClick={handleAdd}
                disabled={!canSubmit || isSaving}
                className="text-[17pt] font-semibold leading-[22pt]"
                style={{ color: canSubmit && !isSaving ? BRAND : STRONG }}
              >
                {isSaving ? "保存中…" : "添加"}
              </button>
            </motion.div>

            {/* ===== 滚动内容 ===== */}
            <div className="flex-1 overflow-y-auto px-[16pt] pt-[16pt] pb-[40pt] flex flex-col gap-[12pt]">
              {/* 2. 输入卡（任务名称 + 备注，各 54pt） */}
              <div className="bg-white rounded-[12pt] overflow-hidden" style={{ boxShadow: CARD_SHADOW }}>
                <input
                  type="text"
                  value={form.title}
                  onChange={(e) => patch({ title: e.target.value })}
                  placeholder="任务名称"
                  autoFocus
                  className="block w-full h-[54pt] px-[16pt] border-none outline-none text-[17pt] text-black bg-transparent placeholder:text-[#8E8E93]"
                  style={{ caretColor: BRAND }}
                />
                <div style={{ height: "0.5pt", background: BORDER, margin: "0 16pt" }} />
                <input
                  type="text"
                  value={form.note}
                  onChange={(e) => patch({ note: e.target.value })}
                  placeholder="备注"
                  className="block w-full h-[54pt] px-[16pt] border-none outline-none text-[17pt] text-black bg-transparent placeholder:text-[#8E8E93]"
                  style={{ caretColor: BRAND }}
                />
              </div>

              {/* 3. 类型切换（36pt 分段控件） */}
              <div
                className="flex shrink-0"
                style={{ height: "36pt", background: BORDER, borderRadius: "18pt", padding: "2pt" }}
              >
                {(
                  [
                    { key: "normal", label: "普通任务" },
                    { key: "progress", label: "进度条任务" },
                  ] as const
                ).map((t) => {
                  const active = tab === t.key;
                  return (
                    <button
                      key={t.key}
                      type="button"
                      onClick={() => {
                        setTab(t.key);
                        patch({
                          isProgressTask: t.key === "progress",
                          // 进度任务默认"不设置"结束日期；切回普通任务恢复为开始日期
                          endDate:
                            t.key === "progress"
                              ? NO_END_DATE
                              : form.endDate === NO_END_DATE
                                ? form.startDate
                                : form.endDate,
                        });
                      }}
                      className="flex-1 flex items-center justify-center text-[15pt]"
                      style={{
                        borderRadius: "16pt",
                        background: active ? "#FFFFFF" : "transparent",
                        boxShadow: active ? "0 1px 3px rgba(0,0,0,0.08)" : "none",
                        color: active ? "#000000" : MUTED,
                        fontWeight: active ? 600 : 400,
                      }}
                    >
                      {t.label}
                    </button>
                  );
                })}
              </div>

              {tab === "normal" ? (
                <NormalFields form={form} patch={patch} />
              ) : (
                <ProgressFields form={form} patch={patch} suggestedDailyMin={suggestedDailyMin} />
              )}

              {/* 收起键盘提示（设计稿） */}
              <div className="flex items-center justify-center gap-[4pt] pt-[4pt] pb-[8pt]">
                <span className="text-[13pt] leading-[18pt]" style={{ color: MUTED }}>
                  收起键盘
                </span>
                <ChevronDown className="w-[14pt] h-[14pt]" style={{ color: MUTED }} />
              </div>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}

// ============================================================
// 普通任务字段（设计稿 create-task-normal.html）
// ============================================================

function NormalFields({
  form,
  patch,
}: {
  form: FormData;
  patch: (p: Partial<FormData>) => void;
}) {
  return (
    <>
      {/* 4. 选择日期卡 */}
      <div className="bg-white rounded-[12pt] p-[16pt]" style={{ boxShadow: CARD_SHADOW }}>
        <div className="flex items-center justify-between mb-[12pt]">
          <div className="flex items-center gap-[8pt]">
            <Calendar className="w-[20pt] h-[20pt]" style={{ color: "#FF6B6B" }} />
            <span className="text-[15pt] text-black">选择日期</span>
          </div>
          <button
            type="button"
            onClick={() => patch({ endDate: form.startDate })}
            className="text-[15pt]"
            style={{ color: BRAND }}
          >
            清除
          </button>
        </div>
        <div className="flex gap-[12pt]">
          <DateTile
            label="开始日期"
            value={form.startDate}
            display={formatSlashDate(form.startDate)}
            onChange={(v) => {
              const next: Partial<FormData> = { startDate: v };
              if (form.endDate !== NO_END_DATE && form.endDate < v) next.endDate = v;
              patch(next);
            }}
          />
          <DateTile
            label="结束日期"
            value={form.endDate === NO_END_DATE ? form.startDate : form.endDate}
            display={formatSlashDate(form.endDate === NO_END_DATE ? form.startDate : form.endDate)}
            min={form.startDate}
            onChange={(v) => patch({ endDate: v })}
          />
        </div>
      </div>

      {/* 5. 循环 */}
      <OptionRow
        icon={<RotateCcw className="w-[20pt] h-[20pt]" style={{ color: MUTED }} />}
        label="循环"
        value={form.repeat}
        options={REPEAT_OPTIONS}
        onChange={(v) => {
          if (v === "custom") {
            showToast({ type: "info", message: "自定义循环开发中" });
            return;
          }
          patch({ repeat: v as FormData["repeat"] });
        }}
      />

      {/* 5. 时间和提醒 */}
      <ConfigRow
        icon={<Clock className="w-[20pt] h-[20pt]" style={{ color: MUTED }} />}
        label="时间和提醒"
        onClick={() => showToast({ type: "info", message: "功能开发中" })}
      />

      {/* 6. 重要 */}
      <ImportantRow
        value={form.isImportant}
        onChange={(v) => patch({ isImportant: v })}
      />
    </>
  );
}

// ============================================================
// 进度条任务字段（设计稿 create-task-progress.html）
// ============================================================

function ProgressFields({
  form,
  patch,
  suggestedDailyMin,
}: {
  form: FormData;
  patch: (p: Partial<FormData>) => void;
  suggestedDailyMin: number;
}) {
  const noEnd = form.endDate === NO_END_DATE;
  return (
    <>
      {/* 4. 开始/结束日期行 */}
      <div className="bg-white rounded-[12pt] overflow-hidden" style={{ boxShadow: CARD_SHADOW }}>
        <DateRowField
          label="开始日期"
          display={formatCnDate(form.startDate)}
          value={form.startDate}
          onChange={(v) => patch({ startDate: v })}
        />
        <div style={{ height: "0.5pt", background: BORDER, margin: "0 16pt" }} />
        <div className="flex items-center h-[56pt] px-[16pt]">
          <span className="text-[17pt] leading-[22pt] text-black shrink-0">结束日期</span>
          <button
            type="button"
            onClick={() => patch({ endDate: noEnd ? form.startDate : NO_END_DATE })}
            className="ml-auto text-[15pt] leading-[20pt]"
            style={{ color: noEnd ? BRAND : MUTED }}
          >
            {noEnd ? "不设置" : formatCnDate(form.endDate)}
          </button>
          {noEnd ? (
            <ChevronRight className="w-[16pt] h-[16pt] ml-[8pt] shrink-0" style={{ color: STRONG }} />
          ) : (
            <DateRowPicker
              value={form.endDate}
              min={form.startDate}
              onChange={(v) => patch({ endDate: v })}
            />
          )}
        </div>
      </div>

      {/* 5. 进度重置周期 */}
      <OptionRow
        icon={<TrendingUp className="w-[20pt] h-[20pt]" style={{ color: MUTED }} />}
        label="进度重置周期"
        value={form.progressReset}
        options={PROGRESS_RESET_OPTIONS}
        onChange={(v) => patch({ progressReset: v as FormData["progressReset"] })}
      />

      {/* 目标值 + 单位 */}
      <div className="bg-white rounded-[12pt] flex items-center h-[56pt] px-[16pt]" style={{ boxShadow: CARD_SHADOW }}>
        <span className="text-[17pt] leading-[22pt] text-black">目标值</span>
        <div className="flex-1 flex items-center justify-end gap-[8pt]">
          <NumberBox
            value={form.targetValue}
            onChange={(v) => patch({ targetValue: v })}
          />
          <input
            type="text"
            value={form.unit}
            onChange={(e) => patch({ unit: e.target.value })}
            placeholder="单位"
            className="w-[40pt] border-none outline-none bg-transparent text-[15pt] leading-[20pt] placeholder:text-[#8E8E93]"
            style={{ color: MUTED, caretColor: BRAND }}
          />
        </div>
      </div>

      {/* 开始值 */}
      <div className="bg-white rounded-[12pt] flex items-center h-[56pt] px-[16pt]" style={{ boxShadow: CARD_SHADOW }}>
        <span className="text-[17pt] leading-[22pt] text-black">开始值</span>
        <div className="flex-1 flex items-center justify-end">
          <NumberBox value={form.startValue} onChange={(v) => patch({ startValue: v })} />
        </div>
      </div>

      {/* 任务日 */}
      <OptionRow
        label="任务日"
        value={form.taskDays}
        options={TASK_DAYS_OPTIONS}
        onChange={(v) => {
          if (v === "custom") {
            showToast({ type: "info", message: "自定义任务日开发中" });
            return;
          }
          patch({ taskDays: v as FormData["taskDays"] });
        }}
      />

      {/* 每日最低完成量 */}
      <div className="bg-white rounded-[12pt] px-[16pt]" style={{ boxShadow: CARD_SHADOW }}>
        <div className="flex items-center h-[44pt]">
          <span className="text-[17pt] leading-[22pt] text-black">每日最低完成量</span>
          <div className="flex-1 flex items-center justify-end">
            <NumberBox value={form.dailyMin} onChange={(v) => patch({ dailyMin: v })} />
          </div>
        </div>
        <div className="pb-[16pt]">
          <button
            type="button"
            onClick={() => patch({ dailyMin: suggestedDailyMin })}
            className="text-[13pt] leading-[18pt]"
            style={{ color: BRAND }}
          >
            系统建议值：{suggestedDailyMin}，点击应用
          </button>
        </div>
      </div>

      {/* 进度计算方式 */}
      <OptionRow
        label="进度计算方式"
        value={form.progressCalc}
        options={PROGRESS_CALC_OPTIONS}
        onChange={(v) => patch({ progressCalc: v as FormData["progressCalc"] })}
      />

      {/* 关联子任务（PRO） */}
      <div className="bg-white rounded-[12pt] px-[16pt]" style={{ boxShadow: CARD_SHADOW }}>
        <div className="flex items-center h-[44pt]">
          <span className="text-[17pt] leading-[22pt] text-black mr-[6pt]">关联子任务</span>
          <span
            className="text-white text-[11pt] font-bold leading-[15pt] rounded-[6pt] px-[6pt] py-[2pt]"
            style={{ background: "#FF9500" }}
          >
            PRO
          </span>
          <div className="flex-1" />
          <IOSToggle value={form.hasSubtasks} onChange={(v) => patch({ hasSubtasks: v })} />
        </div>
        <div className="pb-[16pt]">
          <span className="text-[13pt] leading-[18pt]" style={{ color: MUTED }}>
            开启后子任务的进度会自动算入本任务
          </span>
        </div>
      </div>

      {/* 时间和提醒 */}
      <ConfigRow
        icon={<Clock className="w-[20pt] h-[20pt]" style={{ color: MUTED }} />}
        label="时间和提醒"
        onClick={() => showToast({ type: "info", message: "功能开发中" })}
      />

      {/* 重要 */}
      <ImportantRow value={form.isImportant} onChange={(v) => patch({ isImportant: v })} />
    </>
  );
}

// ============================================================
// 通用小组件
// ============================================================

/** 日期瓦片（普通任务卡内，80pt） */
function DateTile({
  label,
  value,
  display,
  min,
  onChange,
}: {
  label: string;
  value: string;
  display: string;
  min?: string;
  onChange: (v: string) => void;
}) {
  return (
    <div className="flex-1 h-[80pt] rounded-[10pt] p-[12pt] flex flex-col justify-between relative overflow-hidden" style={{ background: "#F5F5F7" }}>
      <span className="text-[13pt]" style={{ color: MUTED }}>{label}</span>
      <span className="text-[17pt] text-black">{display}</span>
      <input
        type="date"
        value={value}
        min={min}
        onChange={(e) => e.target.value && onChange(e.target.value)}
        className="absolute inset-0 opacity-0 cursor-pointer w-full h-full"
      />
    </div>
  );
}

/** 日期行字段（进度任务，56pt 行内选择） */
function DateRowField({
  label,
  display,
  value,
  onChange,
}: {
  label: string;
  display: string;
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <div className="flex items-center h-[56pt] px-[16pt] relative">
      <span className="text-[17pt] leading-[22pt] text-black shrink-0">{label}</span>
      <span className="flex-1 text-right text-[15pt] leading-[20pt]" style={{ color: MUTED }}>
        {display}
      </span>
      <ChevronRight className="w-[16pt] h-[16pt] ml-[8pt] shrink-0" style={{ color: STRONG }} />
      <input
        type="date"
        value={value}
        onChange={(e) => e.target.value && onChange(e.target.value)}
        className="absolute inset-0 opacity-0 cursor-pointer w-full h-full"
      />
    </div>
  );
}

/** 结束日期的小 picker（已设置状态下点击可改） */
function DateRowPicker({
  value,
  min,
  onChange,
}: {
  value: string;
  min?: string;
  onChange: (v: string) => void;
}) {
  return (
    <span className="relative ml-[8pt] shrink-0 inline-flex">
      <ChevronRight className="w-[16pt] h-[16pt]" style={{ color: STRONG }} />
      <input
        type="date"
        value={value}
        min={min}
        onChange={(e) => e.target.value && onChange(e.target.value)}
        className="absolute inset-0 opacity-0 cursor-pointer w-full h-full"
      />
    </span>
  );
}

/** 通用配置行（56pt，右侧 chevron） */
function ConfigRow({
  icon,
  label,
  onClick,
}: {
  icon?: React.ReactNode;
  label: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="bg-white rounded-[12pt] flex items-center h-[56pt] px-[16pt] w-full text-left"
      style={{ boxShadow: CARD_SHADOW }}
    >
      {icon && <span className="mr-[8pt] flex-shrink-0">{icon}</span>}
      <span className="text-[17pt] leading-[22pt] text-black">{label}</span>
      <span className="flex-1" />
      <ChevronRight className="w-[16pt] h-[16pt] shrink-0" style={{ color: STRONG }} />
    </button>
  );
}

/** 选项行：点击展开内联选项（56pt 行 + 手风琴选项） */
function OptionRow<T extends string>({
  icon,
  label,
  value,
  options,
  onChange,
}: {
  icon?: React.ReactNode;
  label: string;
  value: T;
  options: { value: T; label: string }[];
  onChange: (v: T) => void;
}) {
  const [open, setOpen] = useState(false);
  const current = options.find((o) => o.value === value);
  return (
    <div className="bg-white rounded-[12pt] overflow-hidden" style={{ boxShadow: CARD_SHADOW }}>
      <button
        type="button"
        onClick={() => setOpen((p) => !p)}
        className="flex items-center h-[56pt] px-[16pt] w-full text-left"
      >
        {icon && <span className="mr-[8pt] flex-shrink-0">{icon}</span>}
        <span className="text-[17pt] leading-[22pt] text-black">{label}</span>
        <span className="flex-1 text-right text-[15pt] leading-[20pt]" style={{ color: MUTED }}>
          {current?.label}
        </span>
        <ChevronDown
          className="w-[16pt] h-[16pt] ml-[8pt] shrink-0 transition-transform"
          style={{ color: STRONG, transform: open ? "rotate(180deg)" : "none" }}
        />
      </button>
      <AnimatePresence initial={false}>
        {open && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.25, ease: [0.32, 0.72, 0, 1] }}
            className="overflow-hidden"
          >
            <div className="flex gap-[8pt] px-[16pt] pb-[12pt] flex-wrap">
              {options.map((opt) => {
                const active = opt.value === value;
                return (
                  <button
                    key={opt.value}
                    type="button"
                    onClick={() => {
                      onChange(opt.value);
                      setOpen(false);
                    }}
                    className="h-[30pt] px-[12pt] rounded-[15pt] text-[13pt]"
                    style={{
                      background: active ? BRAND : "#F5F5F7",
                      color: active ? "#FFFFFF" : MUTED,
                    }}
                  >
                    {opt.label}
                  </button>
                );
              })}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

/** 数字输入框（80pt × 36pt，右对齐） */
function NumberBox({ value, onChange }: { value: number; onChange: (v: number) => void }) {
  return (
    <div
      className="flex items-center justify-end px-[12pt] shrink-0"
      style={{ width: "80pt", height: "36pt", background: "#F2F2F7", borderRadius: "10pt" }}
    >
      <input
        type="number"
        value={Number.isNaN(value) ? "" : value}
        onChange={(e) => onChange(e.target.value === "" ? 0 : Number(e.target.value))}
        className="w-full border-none outline-none bg-transparent text-[17pt] text-black text-right"
        style={{ caretColor: BRAND }}
      />
    </div>
  );
}

/** iOS 开关（51pt × 31pt） */
function IOSToggle({ value, onChange }: { value: boolean; onChange: (v: boolean) => void }) {
  return (
    <button
      type="button"
      onClick={() => onChange(!value)}
      className="shrink-0 relative"
      style={{
        width: "51pt",
        height: "31pt",
        borderRadius: "15.5pt",
        background: value ? "#34C759" : BORDER,
        transition: "background 200ms",
      }}
    >
      <motion.span
        className="absolute bg-white rounded-full"
        style={{
          top: "2pt",
          width: "27pt",
          height: "27pt",
          boxShadow: "0 1px 3px rgba(0,0,0,0.15)",
        }}
        animate={{ left: value ? "22pt" : "2pt" }}
        transition={{ type: "spring", stiffness: 500, damping: 30 }}
      />
    </button>
  );
}

/** 重要行（72pt：图标 + 开关 + 说明） */
function ImportantRow({ value, onChange }: { value: boolean; onChange: (v: boolean) => void }) {
  return (
    <div className="bg-white rounded-[12pt] px-[16pt] pt-[16pt] pb-[12pt]" style={{ boxShadow: CARD_SHADOW }}>
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-[8pt]">
          <AlertTriangle className="w-[20pt] h-[20pt]" style={{ color: "#FF9500" }} />
          <span className="text-[17pt] leading-[22pt] text-black">重要</span>
        </div>
        <IOSToggle value={value} onChange={onChange} />
      </div>
      <div className="mt-[4pt]">
        <span className="text-[13pt] leading-[18pt]" style={{ color: MUTED }}>
          开启后任务将优先显示
        </span>
      </div>
    </div>
  );
}
