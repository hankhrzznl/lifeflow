"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Calendar, ChevronRight, ChevronDown, Clock, TrendingUp,
  AlertTriangle, RotateCcw, ChevronLeft,
} from "lucide-react";
import { showToast } from "@/components/ui/Toast";
import type { ScheduleTask } from "@/lib/db/efficiency.db";

// ============================================================
// 设计令牌
// ============================================================
const ACCENT = "#5865F2";
const MUTED = "#86868B";
const BORDER = "#EBEBEB";
const STRONG = "#C7C7CC";
const NO_END_DATE = "9999-12-31";

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
// 表单类型
// ============================================================
export interface TaskFormData {
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

export function getDefaultTaskForm(startDate: string): TaskFormData {
  return {
    title: "", note: "",
    startDate, endDate: startDate,
    repeat: "none", isImportant: false, isProgressTask: false,
    progressReset: "none", targetValue: 100, unit: "", startValue: 0,
    taskDays: "everyday", dailyMin: 0, progressCalc: "sum", hasSubtasks: false,
  };
}

export function mapFormToScheduleTask(form: TaskFormData, goalId?: string | null): Omit<ScheduleTask, "id" | "createdAt"> {
  const effectiveEnd = form.endDate || form.startDate;
  const base: Omit<ScheduleTask, "id" | "createdAt"> = {
    goalId: goalId ?? null,
    title: form.title.trim(),
    type: form.repeat !== "none" ? "recurring" : form.startDate === effectiveEnd ? "single" : "multi_day",
    date: form.startDate === effectiveEnd ? form.startDate : null,
    startDate: form.startDate,
    endDate: effectiveEnd,
    recurringDays: form.repeat === "daily" ? [0, 1, 2, 3, 4, 5, 6]
      : form.repeat === "weekly" ? [new Date(form.startDate).getDay()] : undefined,
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
      progressCurrent: form.startValue,
    };
  }
  return { ...base, progressType: "normal" };
}

// ============================================================
// Props
// ============================================================
export interface CreateTaskSheetProps {
  open: boolean;
  selectedDate?: string;
  goalId?: string | null;
  onClose: () => void;
  onSubmit: (task: Omit<ScheduleTask, "id" | "createdAt">) => Promise<void>;
  /** 如果为 true，渲染为内联内容（非 sheet 弹窗） */
  inline?: boolean;
  /** 内联模式下的返回按钮回调 */
  onBack?: () => void;
}

// ============================================================
// 主组件
// ============================================================
export function CreateTaskSheet({
  open, selectedDate, goalId, onClose, onSubmit, inline, onBack,
}: CreateTaskSheetProps) {
  const defaultDate = selectedDate || toDateStr(new Date());
  const [form, setForm] = useState<TaskFormData>(getDefaultTaskForm(defaultDate));
  const [tab, setTab] = useState<"normal" | "progress">("normal");
  const [isSaving, setIsSaving] = useState(false);
  const [showTimeSheet, setShowTimeSheet] = useState(false);
  const [reminderTime, setReminderTime] = useState("");

  useEffect(() => {
    if (open) {
      const d = selectedDate || toDateStr(new Date());
      setForm(getDefaultTaskForm(d));
      setTab("normal");
      setIsSaving(false);
    }
  }, [open, selectedDate]);

  const canSubmit = form.title.trim().length > 0;
  const patch = useCallback((p: Partial<TaskFormData>) => setForm((prev) => ({ ...prev, ...p })), []);

  const handleSubmit = useCallback(async () => {
    if (!canSubmit || isSaving) return;
    setIsSaving(true);
    try {
      await onSubmit(mapFormToScheduleTask(form, goalId));
      onClose();
    } catch {
      showToast({ type: "error", message: "保存失败" });
    } finally {
      setIsSaving(false);
    }
  }, [canSubmit, isSaving, form, goalId, onSubmit, onClose]);

  const suggestedDailyMin = form.targetValue > 0 ? form.targetValue : 100;

  // 内联模式（页面嵌入）
  if (inline) {
    return (
      <div className="min-h-screen bg-[#FAFAFA]" style={{ maxWidth: 430, margin: "0 auto" }}>
        {/* 导航栏 */}
        <div className="flex items-center justify-between shrink-0 px-4 h-14" style={{ borderBottom: `0.5px solid ${BORDER}` }}>
          <button type="button" onClick={onBack} className="text-[17px] text-[#5865F2]">取消</button>
          <span className="absolute left-1/2 -translate-x-1/2 text-[17px] font-semibold text-[#1D1D1F]">创建任务</span>
          <button
            type="button" onClick={handleSubmit}
            disabled={!canSubmit || isSaving}
            className="text-[17px] font-semibold"
            style={{ color: canSubmit && !isSaving ? ACCENT : STRONG }}
          >{isSaving ? "保存中…" : "添加"}</button>
        </div>

        {/* 滚动内容 */}
        <div className="flex-1 overflow-y-auto px-4 pt-4 pb-10 flex flex-col gap-3">
          <TaskFormFields form={form} patch={patch} tab={tab} onTabChange={(t) => {
            setTab(t);
            patch({
              isProgressTask: t === "progress",
              endDate: t === "progress" ? NO_END_DATE
                : form.endDate === NO_END_DATE ? form.startDate : form.endDate,
            });
          }} suggestedDailyMin={suggestedDailyMin} onTimeClick={() => setShowTimeSheet(true)} />
          {/* 收起键盘 */}
          <div className="flex items-center justify-center gap-1 pt-1 pb-2">
            <span className="text-[13px] text-[#86868B]">收起键盘</span>
            <ChevronDown className="w-[14px] h-[14px] text-[#86868B]" />
          </div>
        </div>

        {/* 时间提醒 Sheet */}
        <TimeReminderSheet
          open={showTimeSheet}
          reminderTime={reminderTime}
          onChangeTime={setReminderTime}
          onClose={() => setShowTimeSheet(false)}
          onConfirm={() => {
            if (reminderTime) {
              const current = form.note || "";
              const withoutOldTime = current.replace(/^\[\d{2}:\d{2}\]\s*/, "");
              patch({ note: `[${reminderTime}] ${withoutOldTime}`.trim() });
            }
            setShowTimeSheet(false);
          }}
        />
      </div>
    );
  }

  // Sheet 弹窗模式
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
                type="button" onClick={handleSubmit}
                disabled={!canSubmit || isSaving}
                className="text-[17px] font-semibold"
                style={{ color: canSubmit && !isSaving ? ACCENT : STRONG }}
              >{isSaving ? "保存中…" : "添加"}</button>
            </motion.div>

            {/* 滚动内容 */}
            <div className="flex-1 overflow-y-auto px-4 pt-4 pb-10 flex flex-col gap-3">
              <TaskFormFields form={form} patch={patch} tab={tab} onTabChange={(t) => {
                setTab(t);
                patch({
                  isProgressTask: t === "progress",
                  endDate: t === "progress" ? NO_END_DATE
                    : form.endDate === NO_END_DATE ? form.startDate : form.endDate,
                });
              }} suggestedDailyMin={suggestedDailyMin} onTimeClick={() => setShowTimeSheet(true)} />
              {/* 收起键盘 */}
              <div className="flex items-center justify-center gap-1 pt-1 pb-2">
                <span className="text-[13px] text-[#86868B]">收起键盘</span>
                <ChevronDown className="w-[14px] h-[14px] text-[#86868B]" />
              </div>
            </div>
          </motion.div>

          {/* 时间提醒 Sheet */}
          <TimeReminderSheet
            open={showTimeSheet}
            reminderTime={reminderTime}
            onChangeTime={setReminderTime}
            onClose={() => setShowTimeSheet(false)}
            onConfirm={() => {
              if (reminderTime) {
                const current = form.note || "";
                const withoutOldTime = current.replace(/^\[\d{2}:\d{2}\]\s*/, "");
                patch({ note: `[${reminderTime}] ${withoutOldTime}`.trim() });
              }
              setShowTimeSheet(false);
            }}
          />
        </>
      )}
    </AnimatePresence>
  );
}

// ============================================================
// 表单字段区域（共享）
// ============================================================
export function TaskFormFields({
  form, patch, tab, onTabChange, suggestedDailyMin, onTimeClick,
}: {
  form: TaskFormData;
  patch: (p: Partial<TaskFormData>) => void;
  tab: "normal" | "progress";
  onTabChange: (t: "normal" | "progress") => void;
  suggestedDailyMin: number;
  onTimeClick: () => void;
}) {
  return (
    <>
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
            <button key={t.key} type="button" onClick={() => onTabChange(t.key)}
              className="flex-1 flex items-center justify-center rounded-[16px] text-[15px]"
              style={{
                background: active ? "#FFFFFF" : "transparent",
                boxShadow: active ? "0 1px 3px rgba(0,0,0,0.08)" : "none",
                color: active ? "#1D1D1F" : MUTED, fontWeight: active ? 600 : 400,
              }}>{t.label}</button>
          );
        })}
      </div>

      {tab === "normal"
        ? <NormalFields form={form} patch={patch} onTimeClick={onTimeClick} />
        : <ProgressFields form={form} patch={patch} suggestedDailyMin={suggestedDailyMin} onTimeClick={onTimeClick} />
      }
    </>
  );
}

// ============================================================
// 普通任务字段
// ============================================================
function NormalFields({ form, patch, onTimeClick }: { form: TaskFormData; patch: (p: Partial<TaskFormData>) => void; onTimeClick: () => void }) {
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
            onChange={(v) => { const next: Partial<TaskFormData> = { startDate: v }; if (form.endDate !== NO_END_DATE && form.endDate < v) next.endDate = v; patch(next); }} />
          <DateTile label="结束日期" value={form.endDate === NO_END_DATE ? form.startDate : form.endDate}
            display={formatSlashDate(form.endDate === NO_END_DATE ? form.startDate : form.endDate)}
            min={form.startDate} onChange={(v) => patch({ endDate: v })} />
        </div>
      </div>

      <OptionRow icon={<RotateCcw className="w-5 h-5 text-[#86868B]" />} label="循环" value={form.repeat}
        options={REPEAT_OPTIONS} onChange={(v) => { if (v === "custom") { showToast({ type: "info", message: "自定义循环开发中" }); return; } patch({ repeat: v as TaskFormData["repeat"] }); }} />

      <ConfigRow icon={<Clock className="w-5 h-5 text-[#86868B]" />} label="时间和提醒"
        onClick={onTimeClick} />

      <ImportantRow value={form.isImportant} onChange={(v) => patch({ isImportant: v })} />
    </>
  );
}

// ============================================================
// 进度条任务字段
// ============================================================
function ProgressFields({ form, patch, suggestedDailyMin, onTimeClick }: { form: TaskFormData; patch: (p: Partial<TaskFormData>) => void; suggestedDailyMin: number; onTimeClick: () => void }) {
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
        options={PROGRESS_RESET_OPTIONS} onChange={(v) => patch({ progressReset: v as TaskFormData["progressReset"] })} />

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
        onChange={(v) => { if (v === "custom") { showToast({ type: "info", message: "自定义任务日开发中" }); return; } patch({ taskDays: v as TaskFormData["taskDays"] }); }} />

      <div className="bg-white rounded-xl border border-[#EBEBEB] px-4">
        <div className="flex items-center h-11">
          <span className="text-[17px] text-[#1D1D1F]">每日最低完成量</span>
          <div className="flex-1 flex items-center justify-end"><NumberBox value={form.dailyMin} onChange={(v) => patch({ dailyMin: v })} /></div>
        </div>
        <div className="pb-4"><button type="button" onClick={() => patch({ dailyMin: suggestedDailyMin })}
          className="text-[13px] text-[#5865F2]">系统建议值：{suggestedDailyMin}，点击应用</button></div>
      </div>

      <OptionRow label="进度计算方式" value={form.progressCalc} options={PROGRESS_CALC_OPTIONS}
        onChange={(v) => patch({ progressCalc: v as TaskFormData["progressCalc"] })} />

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
        onClick={onTimeClick} />

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

// ============================================================
// 时间提醒 Sheet
// ============================================================
function TimeReminderSheet({
  open, reminderTime, onChangeTime, onClose, onConfirm,
}: {
  open: boolean; reminderTime: string; onChangeTime: (v: string) => void; onClose: () => void; onConfirm: () => void;
}) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-[60] flex items-end justify-center" onClick={onClose}>
      <div className="absolute inset-0 bg-black/30" />
      <motion.div initial={{ y: "100%" }} animate={{ y: 0 }} transition={{ type: "spring", damping: 30, stiffness: 400 }}
        className="relative w-full max-w-[430px] bg-white rounded-t-[20px] pb-[calc(56px+max(16px,env(safe-area-inset-bottom)))]"
        onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between px-5 pt-5 pb-4">
          <button onClick={onClose} className="text-[15px] text-[#86868B]">取消</button>
          <span className="text-[17px] font-semibold text-[#1D1D1F]">设置提醒时间</span>
          <button onClick={onConfirm} className="text-[15px] font-semibold text-[#5865F2]">确定</button>
        </div>
        <div className="px-5 flex justify-center">
          <input type="time" value={reminderTime} onChange={(e) => onChangeTime(e.target.value)}
            className="h-12 px-4 rounded-[12px] bg-[#F5F5F5] text-[17px] text-[#1D1D1F] outline-none w-full text-center" />
        </div>
        <div className="h-4" />
      </motion.div>
    </div>
  );
}
