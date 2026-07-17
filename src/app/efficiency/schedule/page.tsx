"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Plus, ChevronLeft, ChevronRight, Inbox, Check, Trash2, Clock, Calendar, AlertCircle, RefreshCw } from "lucide-react";
import { useEfficiencyStore } from "@/lib/store/efficiencyStore";
import type { ScheduleTask } from "@/lib/db/efficiency.db";
import { getAllScheduleTasks } from "@/lib/db/efficiency.db";
import BottomSheet from "@/components/common/BottomSheet";
import { showToast } from "@/components/ui/Toast";

// ============================================================
// 常量
// ============================================================

const WEEK_DAYS = ["一", "二", "三", "四", "五", "六", "日"];
const BRAND_COLOR = "#5856D6";
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

// ============================================================
// 工具函数
// ============================================================

function toDateStr(d: Date): string {
  return d.toISOString().slice(0, 10);
}

function addDays(date: Date, days: number): Date {
  const d = new Date(date);
  d.setDate(d.getDate() + days);
  return d;
}

function isSameDay(a: Date, b: Date): boolean {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
}

function formatDateDisplay(dateStr: string): string {
  if (!dateStr) return "";
  const [y, m, d] = dateStr.split("-").map(Number);
  return `${m}月${d}日`;
}

function getWeekMonday(baseDate: Date, weekOffset: number): Date {
  const day = baseDate.getDay();
  const diffToMonday = day === 0 ? -6 : 1 - day;
  const monday = addDays(baseDate, diffToMonday);
  return addDays(monday, weekOffset * 7);
}

function getMonthLabel(monday: Date, dates: Date[]): string {
  const months = new Set(dates.map((d) => d.getMonth() + 1));
  return Array.from(months)
    .sort()
    .map((m) => `${m}月`)
    .join("/");
}

// ============================================================
// 表单默认值
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
    title: "",
    note: "",
    startDate: selectedDate,
    endDate: selectedDate,
    repeat: "none",
    isImportant: false,
    isProgressTask: false,
    progressReset: "none",
    targetValue: 0,
    unit: "",
    startValue: 0,
    taskDays: "everyday",
    dailyMin: 0,
    progressCalc: "sum",
    hasSubtasks: false,
  };
}

function mapFormToTask(form: FormData): Omit<ScheduleTask, "id" | "createdAt"> {
  const base: Omit<ScheduleTask, "id" | "createdAt"> = {
    goalId: null,
    title: form.title,
    type: form.repeat !== "none" ? "recurring" : form.startDate === form.endDate ? "single" : "multi_day",
    date: form.startDate === form.endDate ? form.startDate : null,
    startDate: form.startDate,
    endDate: form.endDate,
    recurringDays: form.repeat === "daily" ? [0, 1, 2, 3, 4, 5, 6] : form.repeat === "weekly" ? [new Date(form.startDate).getDay()] : undefined,
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
// 骨架屏
// ============================================================

function TaskSkeleton() {
  return (
    <div className="space-y-3 animate-pulse">
      {[1, 2, 3].map((i) => (
        <div key={i} className="bg-white rounded-xl p-4 flex items-start gap-3">
          <div className="w-6 h-6 rounded-full bg-gray-100 flex-shrink-0" />
          <div className="flex-1 space-y-2">
            <div className="h-4 bg-gray-100 rounded w-3/5" />
            <div className="h-3 bg-gray-50 rounded w-2/5" />
          </div>
        </div>
      ))}
    </div>
  );
}

// ============================================================
// 组件
// ============================================================

export default function SchedulePage() {
  // ─── store ───
  const scheduleTasks = useEfficiencyStore((s) => s.scheduleTasks);
  const selectedDate = useEfficiencyStore((s) => s.selectedDate);
  const storeLoading = useEfficiencyStore((s) => s.loading);
  const loadScheduleTasks = useEfficiencyStore((s) => s.loadScheduleTasks);
  const addScheduleTask = useEfficiencyStore((s) => s.addScheduleTask);
  const toggleScheduleTask = useEfficiencyStore((s) => s.toggleScheduleTask);
  const removeScheduleTask = useEfficiencyStore((s) => s.removeScheduleTask);
  const setSelectedDate = useEfficiencyStore((s) => s.setSelectedDate);

  // ─── local state ───
  const today = useMemo(() => new Date(), []);
  const todayStr = useMemo(() => toDateStr(today), [today]);

  const [weekOffset, setWeekOffset] = useState(0);
  const [weekDotDates, setWeekDotDates] = useState<Set<string>>(new Set());
  const [isLoadingDots, setIsLoadingDots] = useState(false);

  // bottom sheet
  const [sheetOpen, setSheetOpen] = useState(false);
  const [formTab, setFormTab] = useState<"normal" | "progress">("normal");
  const [form, setForm] = useState<FormData>(getDefaultForm(selectedDate));
  // delete confirmation
  const [deleteTarget, setDeleteTarget] = useState<string | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  // saving state
  const [isSaving, setIsSaving] = useState(false);

  // ─── calendar dates ───
  const weekDates = useMemo(() => {
    const monday = getWeekMonday(today, weekOffset);
    return WEEK_DAYS.map((_, i) => addDays(monday, i));
  }, [today, weekOffset]);

  const monthLabel = useMemo(() => getMonthLabel(weekDates[0], weekDates), [weekDates]);

  // ─── load tasks on mount & date change ───
  useEffect(() => {
    loadScheduleTasks(selectedDate);
  }, [selectedDate, loadScheduleTasks]);

  // ─── load dot indicators for visible week ───
  const loadWeekDots = useCallback(async () => {
    setIsLoadingDots(true);
    try {
      const all = await getAllScheduleTasks();
      const start = toDateStr(weekDates[0]);
      const end = toDateStr(weekDates[6]);
      const dotSet = new Set<string>();
      for (const task of all) {
        if (task.type === "single" && task.date && task.date >= start && task.date <= end) {
          dotSet.add(task.date);
        } else if (task.type === "multi_day" && task.startDate && task.endDate) {
          const taskStart = task.startDate;
          const taskEnd = task.endDate;
          for (const d of weekDates) {
            const ds = toDateStr(d);
            if (ds >= taskStart && ds <= taskEnd) dotSet.add(ds);
          }
        } else if (task.type === "recurring" && task.startDate && task.endDate) {
          const taskStart = task.startDate;
          const taskEnd = task.endDate;
          for (const d of weekDates) {
            const ds = toDateStr(d);
            if (ds >= taskStart && ds <= taskEnd && task.recurringDays?.includes(d.getDay())) {
              dotSet.add(ds);
            }
          }
        }
      }
      setWeekDotDates(dotSet);
    } catch {
      // silently fail
    } finally {
      setIsLoadingDots(false);
    }
  }, [weekDates]);

  useEffect(() => {
    loadWeekDots();
  }, [loadWeekDots]);

  // ─── derived task list ───
  const sortedTasks = useMemo(() => {
    const copy = [...scheduleTasks];
    copy.sort((a, b) => {
      if (a.isImportant !== b.isImportant) return a.isImportant ? -1 : 1;
      return 0;
    });
    return copy;
  }, [scheduleTasks]);

  const isToday = selectedDate === todayStr;

  // ─── handlers ───

  const handleSelectDay = useCallback(
    (d: Date) => {
      const ds = toDateStr(d);
      setSelectedDate(ds);
      loadScheduleTasks(ds);
    },
    [setSelectedDate, loadScheduleTasks]
  );

  const handleToggle = useCallback(
    async (taskId: string) => {
      await toggleScheduleTask(taskId);
    },
    [toggleScheduleTask]
  );

  const handleDelete = useCallback(
    async (taskId: string) => {
      setIsDeleting(true);
      try {
        await removeScheduleTask(taskId);
        setDeleteTarget(null);
        loadWeekDots();
        showToast({ type: "success", message: "任务已删除" });
      } catch {
        showToast({ type: "error", message: "删除失败" });
      } finally {
        setIsDeleting(false);
      }
    },
    [removeScheduleTask, loadWeekDots]
  );

  const openCreateSheet = useCallback(() => {
    setForm(getDefaultForm(selectedDate));
    setFormTab("normal");
    setSheetOpen(true);
  }, [selectedDate]);

  const handleCreate = useCallback(async () => {
    if (!form.title.trim()) {
      showToast({ type: "warning", message: "请输入任务名称" });
      return;
    }
    setIsSaving(true);
    try {
      const taskData = mapFormToTask(form);
      await addScheduleTask(taskData);
      setSheetOpen(false);
      loadWeekDots();
      showToast({ type: "success", message: "任务已保存" });
    } catch {
      showToast({ type: "error", message: "保存失败" });
    } finally {
      setIsSaving(false);
    }
  }, [form, addScheduleTask, loadWeekDots]);

  // ─── render ───

  return (
    <div className="min-h-screen bg-[#F5F5F7] pb-28">
      <div className="max-w-2xl mx-auto px-5 pt-8">
        {/* ── Header ── */}
        <div className="flex items-center justify-between mb-5">
          <h1 className="text-2xl font-bold text-gray-900">日程</h1>
          <div className="flex items-center gap-3">
            <span className="text-sm font-semibold text-gray-500">{monthLabel}</span>
            <div className="flex items-center gap-1">
              <button
                onClick={() => setWeekOffset((w) => w - 1)}
                className="w-8 h-8 rounded-full bg-white shadow-sm flex items-center justify-center hover:bg-gray-50 transition-colors"
              >
                <ChevronLeft className="w-4 h-4 text-gray-500" />
              </button>
              <span className="text-xs font-medium text-gray-400 px-1 min-w-[28px] text-center">
                {weekOffset === 0 ? "本周" : weekOffset === -1 ? "上周" : weekOffset > 0 ? "下周" : `${Math.abs(-weekOffset)}周前`}
              </span>
              <button
                onClick={() => setWeekOffset((w) => w + 1)}
                className="w-8 h-8 rounded-full bg-white shadow-sm flex items-center justify-center hover:bg-gray-50 transition-colors"
              >
                <ChevronRight className="w-4 h-4 text-gray-500" />
              </button>
            </div>
          </div>
        </div>

        {/* ── Week Day Selector ── */}
        <div className="flex gap-2 mb-6">
          {weekDates.map((d, i) => {
            const ds = toDateStr(d);
            const isSel = ds === selectedDate;
            const isTdy = ds === todayStr;
            const hasTasks = weekDotDates.has(ds);

            return (
              <motion.button
                key={ds}
                whileTap={{ scale: 0.93 }}
                onClick={() => handleSelectDay(d)}
                className="flex-1 flex flex-col items-center gap-1 py-2.5 rounded-2xl transition-all duration-200"
                style={{
                  backgroundColor: isSel ? BRAND_COLOR : "white",
                  color: isSel ? "white" : "#4B5563",
                  boxShadow: isSel ? `0 4px 12px ${BRAND_COLOR}33` : "0 1px 3px rgba(0,0,0,0.06)",
                }}
              >
                <span className="text-[11px] opacity-70 font-medium">{WEEK_DAYS[i]}</span>
                <span
                  className={`text-base font-bold ${isTdy && !isSel ? "text-[#5856D6]" : ""}`}
                >
                  {d.getDate()}
                </span>
                {hasTasks && (
                  <span
                    className="w-1 h-1 rounded-full mt-0.5"
                    style={{ backgroundColor: isSel ? "white" : BRAND_COLOR, opacity: isSel ? 0.9 : 0.6 }}
                  />
                )}
              </motion.button>
            );
          })}
        </div>

        {/* ── Task List ── */}
        <AnimatePresence mode="wait">
          {storeLoading ? (
            <motion.div key="skeleton" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
              <TaskSkeleton />
            </motion.div>
          ) : sortedTasks.length === 0 ? (
            <motion.div
              key="empty"
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -12 }}
              className="flex flex-col items-center justify-center py-16 text-center"
            >
              <div className="w-16 h-16 rounded-full bg-gray-100 flex items-center justify-center mb-4">
                <Inbox className="w-7 h-7 text-gray-300" />
              </div>
              <p className="text-gray-400 font-medium text-sm">
                {isToday ? "今天还没有任务哦" : "当天暂无任务"}
              </p>
              <p className="text-gray-300 text-xs mt-1">点击右下角按钮添加任务</p>
            </motion.div>
          ) : (
            <motion.div
              key="tasks"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="space-y-3"
            >
              {sortedTasks.map((task) => (
                <TaskCard
                  key={task.id}
                  task={task}
                  onToggle={() => handleToggle(task.id)}
                  onDeleteRequest={() => setDeleteTarget(task.id)}
                />
              ))}
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* ── FAB ── */}
      <motion.button
        whileTap={{ scale: 0.9 }}
        whileHover={{ scale: 1.05 }}
        onClick={openCreateSheet}
        className="fixed bottom-8 right-6 w-14 h-14 rounded-2xl flex items-center justify-center shadow-lg z-30"
        style={{
          background: `linear-gradient(135deg, ${BRAND_COLOR}, #7C3AED)`,
          boxShadow: `0 8px 24px ${BRAND_COLOR}44`,
        }}
      >
        <Plus className="w-6 h-6 text-white" />
      </motion.button>

      {/* ── Create BottomSheet ── */}
      <BottomSheet open={sheetOpen} onClose={() => setSheetOpen(false)} title="添加任务">
        {/* Tabs */}
        <div className="flex bg-gray-100 rounded-xl p-1 mb-5">
          <button
            onClick={() => {
              setFormTab("normal");
              setForm((prev) => ({ ...prev, isProgressTask: false }));
            }}
            className="flex-1 py-2 text-sm font-medium rounded-lg transition-all"
            style={{
              backgroundColor: formTab === "normal" ? "white" : "transparent",
              color: formTab === "normal" ? BRAND_COLOR : "#9CA3AF",
              boxShadow: formTab === "normal" ? "0 1px 3px rgba(0,0,0,0.08)" : "none",
            }}
          >
            普通任务
          </button>
          <button
            onClick={() => {
              setFormTab("progress");
              setForm((prev) => ({ ...prev, isProgressTask: true }));
            }}
            className="flex-1 py-2 text-sm font-medium rounded-lg transition-all"
            style={{
              backgroundColor: formTab === "progress" ? "white" : "transparent",
              color: formTab === "progress" ? BRAND_COLOR : "#9CA3AF",
              boxShadow: formTab === "progress" ? "0 1px 3px rgba(0,0,0,0.08)" : "none",
            }}
          >
            进度条任务
          </button>
        </div>

        {/* Tab 1: 普通任务 */}
        <FormFields form={form} setForm={setForm} />

        {/* Tab 2: 进度条任务额外字段 */}
        <AnimatePresence>
          {formTab === "progress" && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: "auto" }}
              exit={{ opacity: 0, height: 0 }}
              className="overflow-hidden"
            >
              <div className="border-t border-gray-100 pt-4 mt-1 space-y-4">
                <FormSelect
                  label="进度重置周期"
                  value={form.progressReset}
                  onChange={(v) => setForm((prev) => ({ ...prev, progressReset: v as FormData["progressReset"] }))}
                  options={PROGRESS_RESET_OPTIONS}
                />

                <div className="flex gap-3">
                  <div className="flex-1">
                    <label className="text-xs font-medium text-gray-500 mb-1.5 block">目标值</label>
                    <input
                      type="number"
                      value={form.targetValue || ""}
                      onChange={(e) => setForm((prev) => ({ ...prev, targetValue: Number(e.target.value) }))}
                      placeholder="100"
                      className="w-full px-3 py-2.5 rounded-xl border border-gray-200 text-sm focus:outline-none focus:border-[#5856D6]"
                    />
                  </div>
                  <div className="flex-1">
                    <label className="text-xs font-medium text-gray-500 mb-1.5 block">单位</label>
                    <input
                      type="text"
                      value={form.unit}
                      onChange={(e) => setForm((prev) => ({ ...prev, unit: e.target.value }))}
                      placeholder="次/个"
                      className="w-full px-3 py-2.5 rounded-xl border border-gray-200 text-sm focus:outline-none focus:border-[#5856D6]"
                    />
                  </div>
                </div>

                <div>
                  <label className="text-xs font-medium text-gray-500 mb-1.5 block">开始值</label>
                  <input
                    type="number"
                    value={form.startValue || ""}
                    onChange={(e) => setForm((prev) => ({ ...prev, startValue: Number(e.target.value) }))}
                    placeholder="0"
                    className="w-full px-3 py-2.5 rounded-xl border border-gray-200 text-sm focus:outline-none focus:border-[#5856D6]"
                  />
                </div>

                <FormSelect
                  label="任务日选择"
                  value={form.taskDays}
                  onChange={(v) => setForm((prev) => ({ ...prev, taskDays: v as FormData["taskDays"] }))}
                  options={TASK_DAYS_OPTIONS}
                />

                <div>
                  <label className="text-xs font-medium text-gray-500 mb-1.5 block">
                    每日最低完成量{" "}
                    <span className="text-[#5856D6] font-normal">· 系统建议值: 120</span>
                  </label>
                  <input
                    type="number"
                    value={form.dailyMin || ""}
                    onChange={(e) => setForm((prev) => ({ ...prev, dailyMin: Number(e.target.value) }))}
                    placeholder="0"
                    className="w-full px-3 py-2.5 rounded-xl border border-gray-200 text-sm focus:outline-none focus:border-[#5856D6]"
                  />
                </div>

                <FormSelect
                  label="进度计算方式"
                  value={form.progressCalc}
                  onChange={(v) => setForm((prev) => ({ ...prev, progressCalc: v as "sum" | "average" }))}
                  options={[
                    { value: "sum" as const, label: "求和" },
                    { value: "average" as const, label: "平均值" },
                  ]}
                />

                <div className="flex items-center justify-between py-1">
                  <span className="text-sm text-gray-700">关联子任务</span>
                  <button
                    onClick={() => setForm((prev) => ({ ...prev, hasSubtasks: !prev.hasSubtasks }))}
                    className={`w-11 h-6 rounded-full transition-colors relative ${form.hasSubtasks ? "bg-[#5856D6]" : "bg-gray-200"}`}
                  >
                    <motion.span
                      className="absolute top-0.5 w-5 h-5 bg-white rounded-full shadow"
                      animate={{ left: form.hasSubtasks ? 22 : 2 }}
                      transition={{ type: "spring", stiffness: 500, damping: 30 }}
                    />
                  </button>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Save Button */}
        <button
          onClick={handleCreate}
          disabled={isSaving}
          className="w-full py-3 rounded-xl text-white font-semibold text-sm mt-5 flex items-center justify-center gap-2 transition-opacity disabled:opacity-60"
          style={{ backgroundColor: BRAND_COLOR }}
        >
          {isSaving ? (
            <>
              <RefreshCw className="w-4 h-4 animate-spin" />
              保存中...
            </>
          ) : (
            "保存任务"
          )}
        </button>
      </BottomSheet>

      {/* ── Delete Confirmation Modal ── */}
      <AnimatePresence>
        {deleteTarget && (
          <motion.div
            key="delete-modal"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/40"
            onClick={() => setDeleteTarget(null)}
          >
            <motion.div
              initial={{ scale: 0.92, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.92, opacity: 0 }}
              onClick={(e) => e.stopPropagation()}
              className="bg-white rounded-2xl w-[300px] p-6 shadow-xl"
            >
              <div className="flex flex-col items-center text-center">
                <div className="w-12 h-12 rounded-full bg-red-50 flex items-center justify-center mb-3">
                  <AlertCircle className="w-6 h-6 text-red-400" />
                </div>
                <h3 className="text-base font-semibold text-gray-900 mb-1">确认删除</h3>
                <p className="text-sm text-gray-500 mb-5">删除后将无法恢复，确定要删除这个任务吗？</p>
                <div className="flex gap-3 w-full">
                  <button
                    onClick={() => setDeleteTarget(null)}
                    className="flex-1 py-2.5 rounded-xl border border-gray-200 text-sm font-medium text-gray-600"
                  >
                    取消
                  </button>
                  <button
                    onClick={() => handleDelete(deleteTarget)}
                    disabled={isDeleting}
                    className="flex-1 py-2.5 rounded-xl bg-red-500 text-sm font-medium text-white flex items-center justify-center gap-1.5 disabled:opacity-60"
                  >
                    {isDeleting ? (
                      <RefreshCw className="w-4 h-4 animate-spin" />
                    ) : (
                      <Trash2 className="w-4 h-4" />
                    )}
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
// TaskCard 子组件
// ============================================================

function TaskCard({
  task,
  onToggle,
  onDeleteRequest,
}: {
  task: ScheduleTask;
  onToggle: () => void;
  onDeleteRequest: () => void;
}) {
  const [isPressed, setIsPressed] = useState(false);

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      whileTap={{ scale: 0.985 }}
      onMouseDown={() => setIsPressed(true)}
      onMouseUp={() => setIsPressed(false)}
      onMouseLeave={() => setIsPressed(false)}
      className="bg-white rounded-xl p-4 flex items-start gap-3 shadow-sm group relative"
    >
      {/* Checkbox */}
      <button
        onClick={(e) => {
          e.stopPropagation();
          onToggle();
        }}
        className="w-6 h-6 rounded-full border-2 flex-shrink-0 flex items-center justify-center transition-colors mt-0.5"
        style={{
          borderColor: task.isCompleted ? "#22C55E" : "#D1D5DB",
          backgroundColor: task.isCompleted ? "#22C55E" : "white",
        }}
      >
        {task.isCompleted && <Check className="w-3.5 h-3.5 text-white" strokeWidth={3} />}
      </button>

      {/* Content */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <p
            className={`text-sm font-medium truncate ${task.isCompleted ? "text-gray-300 line-through" : "text-gray-800"}`}
          >
            {task.title}
          </p>
          {task.isImportant && !task.isCompleted && (
            <span className="w-1.5 h-1.5 rounded-full bg-[#5856D6] flex-shrink-0" />
          )}
        </div>

        <div className="flex items-center gap-2 mt-1.5">
          {task.plannedTime > 0 && (
            <span className="inline-flex items-center gap-1 text-[11px] text-gray-400 bg-gray-50 px-1.5 py-0.5 rounded-md">
              <Clock className="w-3 h-3" />
              {task.plannedTime}分钟
            </span>
          )}
          {task.note && (
            <p className="text-xs text-gray-300 truncate">{task.note}</p>
          )}
        </div>
      </div>

      {/* Long-press delete trigger (desktop hover) */}
      <button
        onClick={(e) => {
          e.stopPropagation();
          onDeleteRequest();
        }}
        className="w-7 h-7 rounded-lg flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0 hover:bg-red-50"
      >
        <Trash2 className="w-3.5 h-3.5 text-red-300" />
      </button>
    </motion.div>
  );
}

// ============================================================
// FormFields 子组件（Tab 1 通用字段）
// ============================================================

function FormFields({
  form,
  setForm,
}: {
  form: FormData;
  setForm: React.Dispatch<React.SetStateAction<FormData>>;
}) {
  return (
    <div className="space-y-4">
      {/* 任务名称 */}
      <div>
        <label className="text-xs font-medium text-gray-500 mb-1.5 block">
          任务名称 <span className="text-red-400">*</span>
        </label>
        <input
          type="text"
          value={form.title}
          onChange={(e) => setForm((prev) => ({ ...prev, title: e.target.value }))}
          placeholder="输入任务名称"
          className="w-full px-3 py-2.5 rounded-xl border border-gray-200 text-sm focus:outline-none focus:border-[#5856D6]"
        />
      </div>

      {/* 备注 */}
      <div>
        <label className="text-xs font-medium text-gray-500 mb-1.5 block">备注</label>
        <input
          type="text"
          value={form.note}
          onChange={(e) => setForm((prev) => ({ ...prev, note: e.target.value }))}
          placeholder="添加备注..."
          className="w-full px-3 py-2.5 rounded-xl border border-gray-200 text-sm focus:outline-none focus:border-[#5856D6]"
        />
      </div>

      {/* 日期设置 */}
      <div>
        <label className="text-xs font-medium text-gray-500 mb-1.5 block">日期设置</label>
        <div className="bg-gray-50 rounded-xl p-3 flex items-center gap-3">
          <Calendar className="w-4 h-4 text-[#FF6B6B] flex-shrink-0" />
          <div className="flex-1 flex items-center gap-2 text-sm">
            <input
              type="date"
              value={form.startDate}
              onChange={(e) =>
                setForm((prev) => ({ ...prev, startDate: e.target.value }))
              }
              className="bg-transparent text-gray-700 text-sm focus:outline-none"
            />
            {form.startDate !== form.endDate && (
              <>
                <span className="text-gray-300">—</span>
                <input
                  type="date"
                  value={form.endDate}
                  onChange={(e) =>
                    setForm((prev) => ({ ...prev, endDate: e.target.value }))
                  }
                  className="bg-transparent text-gray-700 text-sm focus:outline-none"
                />
              </>
            )}
          </div>
        </div>
      </div>

      {/* 循环设置 */}
      <FormSelect
        label="循环设置"
        value={form.repeat}
        onChange={(v) => setForm((prev) => ({ ...prev, repeat: v as FormData["repeat"] }))}
        options={REPEAT_OPTIONS}
      />

      {/* 重要标记 */}
      <div className="flex items-center justify-between py-1">
        <span className="text-sm text-gray-700">重要标记</span>
        <button
          onClick={() => setForm((prev) => ({ ...prev, isImportant: !prev.isImportant }))}
          className={`w-11 h-6 rounded-full transition-colors relative ${form.isImportant ? "bg-[#5856D6]" : "bg-gray-200"}`}
        >
          <motion.span
            className="absolute top-0.5 w-5 h-5 bg-white rounded-full shadow"
            animate={{ left: form.isImportant ? 22 : 2 }}
            transition={{ type: "spring", stiffness: 500, damping: 30 }}
          />
        </button>
      </div>
    </div>
  );
}

// ============================================================
// FormSelect 通用下拉子组件
// ============================================================

function FormSelect({
  label,
  value,
  onChange,
  options,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  options: { value: string; label: string }[];
}) {
  return (
    <div>
      <label className="text-xs font-medium text-gray-500 mb-1.5 block">{label}</label>
      <div className="flex bg-gray-100 rounded-xl p-1">
        {options.map((opt) => (
          <button
            key={opt.value}
            onClick={() => onChange(opt.value)}
            className="flex-1 py-1.5 text-xs font-medium rounded-lg transition-all"
            style={{
              backgroundColor: value === opt.value ? "white" : "transparent",
              color: value === opt.value ? "#5856D6" : "#9CA3AF",
              boxShadow: value === opt.value ? "0 1px 3px rgba(0,0,0,0.08)" : "none",
            }}
          >
            {opt.label}
          </button>
        ))}
      </div>
    </div>
  );
}
