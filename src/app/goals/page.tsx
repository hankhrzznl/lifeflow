"use client";

import { useState, useEffect, useCallback, useMemo, useRef } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import {
  Mountain,
  CalendarDays,
  ClipboardList,
  Flame,
  Plus,
  ChevronRight,
  Check,
  Info,
  AlertCircle,
  Trash2,
  Clock,
  RotateCcw,
  Zap,
} from "lucide-react";
import {
  getTaskTree,
  getTasksByType,
  createTask,
  updateTask,
  deleteTask,
  checkInHabit,
  getStreak,
  getHabitLogsByDateRange,
  getAllHabits,
} from "@/lib/db";
import { showToast as globalShowToast } from "@/components/ui/Toast";
import type { Task, GoalViewType } from "@/lib/types";

interface TaskTreeNode extends Task {
  children: TaskTreeNode[];
}

const TABS: { key: GoalViewType; label: string; icon: typeof Mountain }[] = [
  { key: "longterm", label: "长期目标", icon: Mountain },
  { key: "shortterm", label: "短期事件", icon: CalendarDays },
  { key: "daily", label: "日常琐事", icon: ClipboardList },
  { key: "habits", label: "习惯追踪", icon: Flame },
];

type ShortTermFilter = "全部" | "进行中" | "已完成" | "已逾期";

function getLocalDateStr(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function getTodayRange(): { start: number; end: number } {
  const now = new Date();
  const start = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  const end = start + 24 * 60 * 60 * 1000;
  return { start, end };
}

function formatDate(ts: number): string {
  const d = new Date(ts);
  return `${d.getMonth() + 1}月${d.getDate()}日`;
}

function formatTime(ts: number): string {
  const d = new Date(ts);
  return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
}

function EmptyStateView({
  icon: Icon,
  title,
  description,
  actionLabel,
  onAction,
}: {
  icon: typeof Mountain;
  title: string;
  description: string;
  actionLabel: string;
  onAction: () => void;
}) {
  return (
    <div className="flex flex-col items-center justify-center py-20 px-4 text-center">
      <div className="w-16 h-16 rounded-2xl bg-indigo-50 dark:bg-indigo-900/30 flex items-center justify-center mb-4">
        <Icon className="w-12 h-12 stroke-indigo-500" />
      </div>
      <h3 className="text-lg font-semibold text-gray-700 dark:text-gray-200 mb-1">{title}</h3>
      <p className="text-sm text-gray-500 dark:text-gray-400 max-w-xs mb-6">{description}</p>
      <button
        onClick={onAction}
        className="bg-indigo-600 text-white rounded-xl h-12 px-6 font-medium hover:bg-indigo-700 transition-colors text-sm"
      >
        {actionLabel}
      </button>
    </div>
  );
}

function ErrorStateView({ onRetry }: { onRetry: () => void }) {
  return (
    <div className="flex flex-col items-center justify-center py-20 px-4 text-center">
      <div className="w-16 h-16 rounded-2xl bg-red-50 dark:bg-red-900/30 flex items-center justify-center mb-4">
        <AlertCircle className="w-8 h-8 text-red-500" />
      </div>
      <h3 className="text-lg font-semibold text-gray-700 dark:text-gray-200 mb-1">数据加载失败</h3>
      <p className="text-sm text-gray-500 dark:text-gray-400 max-w-xs mb-6">本地数据库暂时无法访问</p>
      <button
        onClick={onRetry}
        className="bg-indigo-600 text-white rounded-xl h-12 px-6 font-medium hover:bg-indigo-700 transition-colors text-sm flex items-center gap-2"
      >
        <RotateCcw className="w-4 h-4" />
        重试
      </button>
    </div>
  );
}

function LongtermSkeleton() {
  return (
    <div className="space-y-3 px-4 py-4">
      {[...Array(3)].map((_, i) => (
        <div key={i} className="bg-white dark:bg-gray-900 rounded-xl border border-gray-100 dark:border-gray-800 p-4">
          <div className="flex items-center gap-3">
            <div className="skeleton w-5 h-5 rounded" />
            <div className="skeleton w-5 h-5 rounded" />
            <div className="skeleton h-5 w-2/3 rounded" />
          </div>
          <div className="ml-12 mt-3 space-y-2">
            {[...Array(2)].map((_, j) => (
              <div key={j} className="flex items-center gap-3">
                <div className="skeleton w-4 h-4 rounded" />
                <div className="skeleton w-5 h-5 rounded" />
                <div className="skeleton h-4 w-1/2 rounded" />
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

function CardListSkeleton({ count = 4 }: { count?: number }) {
  return (
    <div className="space-y-3 px-4 py-4">
      {[...Array(count)].map((_, i) => (
        <div key={i} className="bg-white dark:bg-gray-900 rounded-xl border border-gray-100 dark:border-gray-800 p-4">
          <div className="flex items-center gap-3">
            <div className="skeleton w-5 h-5 rounded" />
            <div className="skeleton h-5 w-3/4 rounded flex-1" />
            <div className="skeleton w-6 h-6 rounded-lg" />
          </div>
        </div>
      ))}
    </div>
  );
}

function HabitListSkeleton({ count = 3 }: { count?: number }) {
  return (
    <div className="space-y-3 px-4 py-4">
      {[...Array(count)].map((_, i) => (
        <div key={i} className="bg-white dark:bg-gray-900 rounded-xl border border-gray-100 dark:border-gray-800 p-4">
          <div className="flex items-center gap-3">
            <div className="skeleton w-8 h-8 rounded-lg" />
            <div className="skeleton h-5 w-2/3 rounded flex-1" />
            <div className="skeleton w-16 h-9 rounded-xl" />
          </div>
        </div>
      ))}
    </div>
  );
}

interface ToastFeedback {
  message: string;
  type: "success" | "error";
}

const TOAST_DURATION = 3000;

function AddTaskForm({
  placeholder,
  onSubmit,
  onCancel,
  typeLabel,
}: {
  placeholder: string;
  onSubmit: (title: string) => void;
  onCancel: () => void;
  typeLabel?: string;
}) {
  const [title, setTitle] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  const handleSubmit = () => {
    const trimmed = title.trim();
    if (!trimmed) return;
    onSubmit(trimmed);
    setTitle("");
  };

  return (
    <motion.div
      initial={{ opacity: 0, height: 0 }}
      animate={{ opacity: 1, height: "auto" }}
      exit={{ opacity: 0, height: 0 }}
      className="overflow-hidden"
    >
      <div className="mx-4 mb-3 bg-white dark:bg-gray-900 rounded-xl border border-indigo-200 dark:border-indigo-800 p-3">
        <div className="flex items-center gap-2">
          {typeLabel && (
            <span className="text-xs font-medium text-indigo-600 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-900/30 px-2 py-0.5 rounded-md">
              {typeLabel}
            </span>
          )}
          <input
            ref={inputRef}
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") handleSubmit();
              if (e.key === "Escape") onCancel();
            }}
            placeholder={placeholder}
            className="flex-1 bg-transparent text-sm text-gray-900 dark:text-gray-100 placeholder:text-gray-400 dark:placeholder:text-gray-500 outline-none"
          />
          <button
            onClick={handleSubmit}
            disabled={!title.trim()}
            className="text-xs font-medium text-indigo-600 dark:text-indigo-400 hover:text-indigo-700 disabled:opacity-40 transition-colors"
          >
            添加
          </button>
          <button
            onClick={onCancel}
            className="text-xs text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-colors"
          >
            取消
          </button>
        </div>
      </div>
    </motion.div>
  );
}

function HabitHeatmap({ taskId }: { taskId: number }) {
  const [dates, setDates] = useState<Set<string>>(new Set());

  useEffect(() => {
    let cancelled = false;
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const startDate = new Date(today);
    startDate.setDate(today.getDate() - 111);
    const startStr = getLocalDateStr(startDate);
    const endStr = getLocalDateStr(today);

    getHabitLogsByDateRange(taskId, startStr, endStr).then((logs) => {
      if (cancelled) return;
      setDates(new Set(logs.map((l) => l.date)));
    });

    return () => {
      cancelled = true;
    };
  }, [taskId]);

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const todayStr = getLocalDateStr(today);
  const startDate = new Date(today);
  startDate.setDate(today.getDate() - 111);

  const CELL_SIZE = 12;
  const GAP = 3;
  const ROWS = 7;
  const COLS = 16;
  const LABEL_WIDTH = 22;
  const MONTH_HEIGHT = 16;

  const startDayOfWeek = startDate.getDay();
  const firstSunday = new Date(startDate);
  firstSunday.setDate(startDate.getDate() - startDayOfWeek);

  const cells: {
    date: Date | null;
    dateStr: string | null;
    checked: boolean;
    isToday: boolean;
    isFuture: boolean;
  }[][] = [];

  for (let row = 0; row < ROWS; row++) {
    cells.push([]);
    for (let col = 0; col < COLS; col++) {
      const dayOffset = col * 7 + row;
      const cellDate = new Date(firstSunday);
      cellDate.setDate(firstSunday.getDate() + dayOffset);

      if (cellDate < startDate || cellDate > today) {
        cells[row][col] = {
          date: null,
          dateStr: null,
          checked: false,
          isToday: false,
          isFuture: false,
        };
      } else {
        const dateStr = getLocalDateStr(cellDate);
        cells[row][col] = {
          date: cellDate,
          dateStr,
          checked: dates.has(dateStr),
          isToday: dateStr === todayStr,
          isFuture: dateStr > todayStr,
        };
      }
    }
  }

  const monthLabels: { label: string; col: number }[] = [];
  let prevMonth = -1;
  for (let col = 0; col < COLS; col++) {
    for (let row = 0; row < ROWS; row++) {
      const cell = cells[row][col];
      if (cell.date) {
        const m = cell.date.getMonth();
        if (m !== prevMonth) {
          monthLabels.push({ label: `${m + 1}月`, col });
          prevMonth = m;
        }
        break;
      }
    }
  }

  const totalWidth = COLS * (CELL_SIZE + GAP) - GAP;
  const totalHeight = ROWS * (CELL_SIZE + GAP) - GAP;
  const svgWidth = LABEL_WIDTH + totalWidth;
  const svgHeight = MONTH_HEIGHT + totalHeight;

  return (
    <svg
      width={svgWidth}
      height={svgHeight}
      viewBox={`0 0 ${svgWidth} ${svgHeight}`}
      className="overflow-visible"
      role="img"
      aria-label="习惯打卡热力图"
    >
      {monthLabels.map((ml, i) => (
        <text
          key={`m-${i}`}
          x={LABEL_WIDTH + ml.col * (CELL_SIZE + GAP)}
          y={11}
          className="fill-gray-400 dark:fill-gray-500"
          fontSize="10"
        >
          {ml.label}
        </text>
      ))}
      {["日", "一", "二", "三", "四", "五", "六"].map((label, i) => (
        <text
          key={`d-${i}`}
          x={LABEL_WIDTH - 4}
          y={MONTH_HEIGHT + i * (CELL_SIZE + GAP) + CELL_SIZE / 2 + 4}
          className="fill-gray-400 dark:fill-gray-500"
          fontSize="9"
          textAnchor="end"
        >
          {label}
        </text>
      ))}
      {cells.map((row, ri) =>
        row.map((cell, ci) => {
          if (!cell.date || !cell.dateStr) return null;
          const x = LABEL_WIDTH + ci * (CELL_SIZE + GAP);
          const y = MONTH_HEIGHT + ri * (CELL_SIZE + GAP);

          let fillClass = "fill-gray-100 dark:fill-gray-800";
          if (cell.checked) {
            fillClass = "fill-emerald-500 dark:fill-emerald-400";
          } else if (cell.isFuture) {
            fillClass = "fill-gray-50 dark:fill-gray-900 opacity-30";
          }

          return (
            <rect
              key={`${ri}-${ci}`}
              x={x}
              y={y}
              width={CELL_SIZE}
              height={CELL_SIZE}
              rx={2}
              className={`${fillClass} ${cell.isToday ? "stroke-indigo-500 dark:stroke-indigo-400" : ""}`}
              strokeWidth={cell.isToday ? 1.5 : 0}
            >
              <title>
                {cell.dateStr}
                {cell.checked ? " ✅已打卡" : ""}
              </title>
            </rect>
          );
        })
      )}
    </svg>
  );
}

function TreeNode({
  node,
  depth,
  onToggleDone,
  onAddChild,
  onDelete,
}: {
  node: TaskTreeNode;
  depth: number;
  onToggleDone: (task: Task) => void;
  onAddChild: (parentId: number) => void;
  onDelete: (task: Task) => void;
}) {
  const [expanded, setExpanded] = useState(depth === 0);
  const isDone = node.status === "done";
  const hasChildren = node.children.length > 0;
  const maxDepthReached = depth >= 3;

  return (
    <div>
      <div
        className={`flex items-center gap-2 py-2.5 px-3 rounded-xl transition-colors group ${
          isDone ? "opacity-60" : ""
        }`}
      >
        {hasChildren ? (
          <button
            onClick={() => setExpanded(!expanded)}
            className="flex-shrink-0 w-6 h-6 flex items-center justify-center rounded-md hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
          >
            <motion.span
              animate={{ rotate: expanded ? 90 : 0 }}
              transition={{ duration: 0.15 }}
            >
              <ChevronRight className="w-4 h-4 text-gray-400" />
            </motion.span>
          </button>
        ) : (
          <div className="w-6 flex-shrink-0" />
        )}

        <button
          onClick={() => onToggleDone(node)}
          className={`flex-shrink-0 w-5 h-5 rounded border-2 flex items-center justify-center transition-colors ${
            isDone
              ? "bg-emerald-500 border-emerald-500"
              : "border-gray-300 dark:border-gray-600 hover:border-indigo-400"
          }`}
        >
          {isDone && <Check className="w-3 h-3 text-white" />}
        </button>

        <span
          className={`flex-1 text-sm ${
            isDone
              ? "line-through text-gray-400 dark:text-gray-500"
              : "text-gray-900 dark:text-gray-100 font-medium"
          }`}
        >
          {node.title}
        </span>

        {node.isMilestone && (
          <span className="text-[10px] font-medium text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-900/30 px-1.5 py-0.5 rounded-md flex-shrink-0">
            里程碑
          </span>
        )}

        {hasChildren && (
          <span className="text-xs text-gray-400 dark:text-gray-500 bg-gray-100 dark:bg-gray-800 px-1.5 py-0.5 rounded-full flex-shrink-0">
            {node.children.length}
          </span>
        )}

        <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
          <button
            onClick={() => {
              if (maxDepthReached) return;
              onAddChild(node.id!);
            }}
            disabled={maxDepthReached}
            className="w-7 h-7 flex items-center justify-center rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors disabled:opacity-30"
            title={maxDepthReached ? "已达最大嵌套层级（3级）" : "添加子任务"}
          >
            <Plus className="w-3.5 h-3.5 text-gray-400" />
          </button>
          <button
            onClick={() => onDelete(node)}
            className="w-7 h-7 flex items-center justify-center rounded-lg hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors"
          >
            <Trash2 className="w-3.5 h-3.5 text-gray-400 hover:text-red-500" />
          </button>
        </div>
      </div>

      <AnimatePresence>
        {expanded && hasChildren && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.2 }}
            className="ml-5 border-l-2 border-gray-100 dark:border-gray-800 overflow-hidden"
          >
            <AnimatePresence>
              {node.children.map((child, i) => (
                <motion.div
                  key={child.id}
                  initial={{ opacity: 0, x: -8 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -8 }}
                  transition={{ delay: i * 0.04, duration: 0.2 }}
                >
                  <TreeNode
                    node={child}
                    depth={depth + 1}
                    onToggleDone={onToggleDone}
                    onAddChild={onAddChild}
                    onDelete={onDelete}
                  />
                </motion.div>
              ))}
            </AnimatePresence>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

function ShortTermCard({
  task,
  onToggleDone,
  onAssignToday,
  onDelete,
}: {
  task: Task;
  onToggleDone: (task: Task) => void;
  onAssignToday: (task: Task) => void;
  onDelete: (task: Task) => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const isDone = task.status === "done";
  const isOverdue = useMemo(
    // eslint-disable-next-line react-hooks/purity
    () => !isDone && task.endTime != null && task.endTime < Date.now(),
    [isDone, task.endTime]
  );

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      className={`bg-white dark:bg-gray-900 rounded-xl border shadow-sm overflow-hidden transition-colors ${
        isDone
          ? "border-gray-100 dark:border-gray-800 opacity-60"
          : isOverdue
          ? "border-red-200 dark:border-red-800/50"
          : "border-gray-100 dark:border-gray-800 hover:border-gray-200 dark:hover:border-gray-700"
      }`}
    >
      <div className="flex items-center gap-3 px-4 py-3">
        <button
          onClick={() => onToggleDone(task)}
          className={`flex-shrink-0 w-5 h-5 rounded border-2 flex items-center justify-center transition-colors ${
            isDone
              ? "bg-emerald-500 border-emerald-500"
              : "border-gray-300 dark:border-gray-600 hover:border-indigo-400"
          }`}
        >
          {isDone && <Check className="w-3 h-3 text-white" />}
        </button>

        <div className="flex-1 min-w-0">
          <p
            className={`text-sm truncate ${
              isDone
                ? "line-through text-gray-400 dark:text-gray-500"
                : "text-gray-900 dark:text-gray-100 font-medium"
            }`}
          >
            {task.title}
          </p>
          {(task.startTime || task.endTime) && (
            <div className="flex items-center gap-2 mt-0.5">
              <Clock className="w-3 h-3 text-gray-400" />
              <span className="text-xs text-gray-500 dark:text-gray-400">
                {task.startTime ? formatTime(task.startTime) : "..."} -{" "}
                {task.endTime ? formatTime(task.endTime) : "..."}
              </span>
              {isOverdue && (
                <span className="text-[10px] font-medium text-red-500 bg-red-50 dark:bg-red-900/20 px-1.5 py-0.5 rounded-md">
                  已逾期
                </span>
              )}
            </div>
          )}
        </div>

        <button
          onClick={() => onAssignToday(task)}
          disabled={isDone}
          className="text-[10px] font-medium text-indigo-600 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-900/30 px-2 py-1 rounded-lg hover:bg-indigo-100 dark:hover:bg-indigo-900/50 transition-colors disabled:opacity-30 flex-shrink-0"
        >
          今日
        </button>
        <button
          onClick={() => setExpanded(!expanded)}
          className="flex-shrink-0"
        >
          <motion.span
            animate={{ rotate: expanded ? 90 : 0 }}
            transition={{ duration: 0.15 }}
          >
            <ChevronRight className="w-4 h-4 text-gray-400" />
          </motion.span>
        </button>
        <button
          onClick={() => onDelete(task)}
          className="flex-shrink-0 opacity-0 group-hover:opacity-100 transition-opacity"
        >
          <Trash2 className="w-3.5 h-3.5 text-gray-400 hover:text-red-500" />
        </button>
      </div>

      <AnimatePresence>
        {expanded && task.note && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            className="px-4 pb-3 overflow-hidden"
          >
            <p className="text-xs text-gray-500 dark:text-gray-400 bg-gray-50 dark:bg-gray-800/50 rounded-lg p-2.5">
              {task.note}
            </p>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}

function DailyTaskItem({
  task,
  onToggleDone,
  isFuture,
}: {
  task: Task;
  onToggleDone: (task: Task) => void;
  isFuture: boolean;
}) {
  const isDone = task.status === "done";

  return (
    <div className="flex items-center gap-3 px-4 py-2.5">
      <button
        onClick={() => {
          if (isFuture) {
            globalShowToast({ message: "未来日期的琐事还不能标记完成哦", type: "warning" });
            return;
          }
          onToggleDone(task);
        }}
        disabled={isFuture}
        title={isFuture ? "未来的任务暂不可操作" : undefined}
        className={`flex-shrink-0 w-5 h-5 rounded border-2 flex items-center justify-center transition-colors ${
          isDone
            ? "bg-emerald-500 border-emerald-500"
            : isFuture
            ? "border-gray-200 dark:border-gray-700 cursor-not-allowed"
            : "border-gray-300 dark:border-gray-600 hover:border-indigo-400"
        }`}
      >
        {isDone && <Check className="w-3 h-3 text-white" />}
      </button>

      <span
        className={`flex-1 text-sm ${
          isDone
            ? "line-through text-gray-400 dark:text-gray-500"
            : isFuture
            ? "text-gray-400 dark:text-gray-500"
            : "text-gray-900 dark:text-gray-100"
        }`}
      >
        {task.title}
      </span>

      {isFuture && (
        <Info className="w-3.5 h-3.5 text-gray-300 dark:text-gray-600" />
      )}
    </div>
  );
}

function HabitCard({
  task,
  streak,
  todayChecked,
  onCheckIn,
  onDelete,
  celebrateIndex,
}: {
  task: Task;
  streak: number;
  todayChecked: boolean;
  onCheckIn: (task: Task) => void;
  onDelete: (task: Task) => void;
  celebrateIndex?: number;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      className="bg-white dark:bg-gray-900 rounded-xl border border-gray-100 dark:border-gray-800 shadow-sm p-4"
    >
      <div className="flex items-center gap-3 mb-3">
        <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-amber-400 to-orange-500 flex items-center justify-center flex-shrink-0">
          <Flame className="w-4 h-4 text-white" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium text-gray-900 dark:text-gray-100 truncate">
            {task.title}
          </p>
          <div className="flex items-center gap-1">
            <Flame className="w-3 h-3 text-orange-500" />
            <span className="text-xs font-semibold text-orange-500">{streak} 天连续</span>
          </div>
        </div>
        {todayChecked ? (
          celebrateIndex !== undefined ? (
            <motion.span
              key={`celebrate-${task.id}`}
              initial={{ scale: 1 }}
              animate={{ scale: [1, 1.3, 1] }}
              transition={{
                delay: celebrateIndex * 0.1,
                duration: 0.4,
                ease: "easeOut",
              }}
              className="flex items-center gap-1 text-xs font-medium text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-900/30 px-2.5 py-1.5 rounded-xl flex-shrink-0"
            >
              <Check className="w-3.5 h-3.5" />
              已打卡
            </motion.span>
          ) : (
            <span className="flex items-center gap-1 text-xs font-medium text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-900/30 px-2.5 py-1.5 rounded-xl flex-shrink-0">
              <Check className="w-3.5 h-3.5" />
              已打卡
            </span>
          )
        ) : (
          <button
            onClick={() => onCheckIn(task)}
            className="text-xs font-medium text-white bg-indigo-600 hover:bg-indigo-700 px-4 py-1.5 rounded-xl transition-colors flex-shrink-0"
          >
            打卡
          </button>
        )}
        <button
          onClick={() => onDelete(task)}
          className="flex-shrink-0 w-7 h-7 flex items-center justify-center rounded-lg hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors"
        >
          <Trash2 className="w-3.5 h-3.5 text-gray-400 hover:text-red-500" />
        </button>
      </div>

      <div className="overflow-x-auto">
        <HabitHeatmap taskId={task.id!} />
      </div>
    </motion.div>
  );
}

function useDayTransitionGuard(): { dayChanged: boolean; dismissOverlay: () => void } {
  const [dayChanged, setDayChanged] = useState(false);
  const todayRef = useRef(getLocalDateStr(new Date()));

  useEffect(() => {
    const check = () => {
      const newToday = getLocalDateStr(new Date());
      if (newToday !== todayRef.current) {
        todayRef.current = newToday;
        setDayChanged(true);
        setTimeout(() => setDayChanged(false), 5000);
      }
    };
    const interval = setInterval(check, 30000);
    return () => clearInterval(interval);
  }, []);

  return { dayChanged, dismissOverlay: () => setDayChanged(false) };
}

export default function GoalsPage() {
  const searchParams = useSearchParams();
  const router = useRouter();

  const viewParam = searchParams.get("view");
  const currentView: GoalViewType =
    viewParam === "longterm" ||
    viewParam === "shortterm" ||
    viewParam === "daily" ||
    viewParam === "habits"
      ? viewParam
      : "longterm";

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [tree, setTree] = useState<TaskTreeNode[]>([]);
  const [shorttermTasks, setShorttermTasks] = useState<Task[]>([]);
  const [dailyTasks, setDailyTasks] = useState<Task[]>([]);
  const [habits, setHabits] = useState<Task[]>([]);
  const [habitStreaks, setHabitStreaks] = useState<Map<number, number>>(new Map());
  const [todayCheckedHabits, setTodayCheckedHabits] = useState<Set<number>>(new Set());

  const [showAddForm, setShowAddForm] = useState(false);
  const [addFormParentId, setAddFormParentId] = useState<number | null>(null);
  const [toast, setToast] = useState<ToastFeedback | null>(null);
  const toastTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const tabDirection = useRef<number>(0);

  const [shorttermFilter, setShorttermFilter] = useState<ShortTermFilter>("全部");
  const [shorttermCelebrationShrunk, setShorttermCelebrationShrunk] = useState(false);

  const { dayChanged, dismissOverlay } = useDayTransitionGuard();

  const showToast = useCallback((message: string, type: "success" | "error" = "success") => {
    setToast({ message, type });
    if (toastTimerRef.current) clearTimeout(toastTimerRef.current);
    toastTimerRef.current = setTimeout(() => setToast(null), TOAST_DURATION);
  }, []);

  useEffect(() => {
    return () => {
      if (toastTimerRef.current) clearTimeout(toastTimerRef.current);
    };
  }, []);

  const allShorttermDone =
    shorttermTasks.length > 0 &&
    shorttermTasks.every((t) => t.status === "done");

  useEffect(() => {
    if (allShorttermDone) {
      setShorttermCelebrationShrunk(false);
      const timer = setTimeout(() => {
        setShorttermCelebrationShrunk(true);
      }, 5000);
      return () => clearTimeout(timer);
    } else {
      setShorttermCelebrationShrunk(false);
    }
  }, [allShorttermDone]);

  const allHabitsDoneToday =
    habits.length > 0 &&
    habits.every((h) => todayCheckedHabits.has(h.id!));

  const prevAllHabitsDoneRef = useRef(false);

  useEffect(() => {
    if (allHabitsDoneToday && !prevAllHabitsDoneRef.current && currentView === "habits") {
      showToast("今日全部完成！");
    }
    prevAllHabitsDoneRef.current = allHabitsDoneToday;
  }, [allHabitsDoneToday, currentView, showToast]);

  const switchView = useCallback(
    (view: GoalViewType) => {
      const oldIdx = TABS.findIndex((t) => t.key === currentView);
      const newIdx = TABS.findIndex((t) => t.key === view);
      tabDirection.current = newIdx > oldIdx ? 1 : -1;
      router.push(`/goals?view=${view}`);
      setShowAddForm(false);
      setAddFormParentId(null);
    },
    [router, currentView]
  );

  const loadLongterm = useCallback(async () => {
    setLoading(true);
    setError(false);
    try {
      const data = await getTaskTree("longterm");
      setTree(data);
    } catch {
      setError(true);
    } finally {
      setLoading(false);
    }
  }, []);

  const loadShortterm = useCallback(async () => {
    setLoading(true);
    setError(false);
    try {
      const data = await getTasksByType("shortterm");
      const active = data.filter((t) => t.status !== "archived");
      setShorttermTasks(active);
    } catch {
      setError(true);
    } finally {
      setLoading(false);
    }
  }, []);

  const loadDaily = useCallback(async () => {
    setLoading(true);
    setError(false);
    try {
      const data = await getTasksByType("daily");
      const active = data.filter((t) => t.status !== "archived");
      setDailyTasks(active);
    } catch {
      setError(true);
    } finally {
      setLoading(false);
    }
  }, []);

  const loadHabits = useCallback(async () => {
    setLoading(true);
    setError(false);
    try {
      const all = await getAllHabits();
      setHabits(all);

      const streaks = new Map<number, number>();
      const checked = new Set<number>();
      const todayStr = getLocalDateStr(new Date());

      for (const h of all) {
        const s = await getStreak(h.id!);
        streaks.set(h.id!, s);

        const logs = await getHabitLogsByDateRange(h.id!, todayStr, todayStr);
        if (logs.length > 0) checked.add(h.id!);
      }

      setHabitStreaks(streaks);
      setTodayCheckedHabits(checked);
    } catch {
      setError(true);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const load = async () => {
      switch (currentView) {
        case "longterm":
          await loadLongterm();
          break;
        case "shortterm":
          await loadShortterm();
          break;
        case "daily":
          await loadDaily();
          break;
        case "habits":
          await loadHabits();
          break;
      }
    };
    load();
  }, [currentView, loadLongterm, loadShortterm, loadDaily, loadHabits]);

  const handleToggleDone = useCallback(
    async (task: Task) => {
      const newStatus = task.status === "done" ? "active" : "done";
      try {
        await updateTask(task.id!, { status: newStatus });
        switch (currentView) {
          case "longterm":
            await loadLongterm();
            break;
          case "shortterm":
            await loadShortterm();
            break;
          case "daily":
            await loadDaily();
            break;
        }
      } catch {
        showToast("操作失败", "error");
      }
    },
    [currentView, loadLongterm, loadShortterm, loadDaily, showToast]
  );

  const handleAddTask = useCallback(
    async (title: string, viewType: GoalViewType, parentTaskId?: number) => {
      try {
        const taskType = viewType === "habits" ? "habit" : viewType;
        const taskData: Omit<Task, "id" | "createdAt" | "updatedAt"> = {
          title,
          type: taskType,
          status: "active",
        };

        if (parentTaskId !== undefined) {
          taskData.parentTaskId = parentTaskId;
        }

        if (viewType === "daily") {
          const { start, end } = getTodayRange();
          taskData.startTime = start;
          taskData.endTime = end;
        }

        await createTask(taskData);
        setShowAddForm(false);
        setAddFormParentId(null);

        switch (viewType) {
          case "longterm":
            await loadLongterm();
            break;
          case "shortterm":
            await loadShortterm();
            break;
          case "daily":
            await loadDaily();
            break;
          case "habits":
            await loadHabits();
            break;
        }
      } catch {
        showToast("添加失败", "error");
      }
    },
    [loadLongterm, loadShortterm, loadDaily, loadHabits, showToast]
  );

  const handleDeleteTask = useCallback(
    async (task: Task) => {
      try {
        await deleteTask(task.id!);
        showToast("已移入回收站", "success");
        switch (currentView) {
          case "longterm":
            await loadLongterm();
            break;
          case "shortterm":
            await loadShortterm();
            break;
          case "daily":
            await loadDaily();
            break;
          case "habits":
            await loadHabits();
            break;
        }
      } catch {
        showToast("删除失败", "error");
      }
    },
    [currentView, loadLongterm, loadShortterm, loadDaily, loadHabits, showToast]
  );

  const handleAssignToday = useCallback(
    async (task: Task) => {
      try {
        const { start, end } = getTodayRange();
        await updateTask(task.id!, {
          startTime: start,
          endTime: end,
        });
        showToast("已分配到今日", "success");
        await loadShortterm();
      } catch {
        showToast("操作失败", "error");
      }
    },
    [loadShortterm, showToast]
  );

  const handleAddChildClick = useCallback(
    (parentId: number, depth: number) => {
      if (depth >= 3) {
        showToast("已达最大嵌套层级（3级）", "error");
        return;
      }
      setAddFormParentId(parentId);
      setShowAddForm(true);
    },
    [showToast]
  );

  const handleCheckIn = useCallback(
    async (task: Task) => {
      try {
        const result = await checkInHabit(task.id!);
        if (result.success) {
          setTodayCheckedHabits((prev) => new Set(prev).add(task.id!));
          const newStreak = await getStreak(task.id!);
          setHabitStreaks((prev) => {
            const next = new Map(prev);
            next.set(task.id!, newStreak);
            return next;
          });
          showToast("打卡成功！", "success");
        } else if (result.alreadyCheckedIn) {
          showToast("今天已经打卡过了", "error");
        } else {
          showToast(result.message, "error");
        }
      } catch {
        showToast("打卡失败", "error");
      }
    },
    [showToast]
  );

  const handleMainAddClick = useCallback(() => {
    setAddFormParentId(null);
    setShowAddForm(true);
  }, []);

  const filteredShortterm = useMemo(() => {
    // eslint-disable-next-line react-hooks/purity
    const now = Date.now();
    if (shorttermFilter === "全部") return shorttermTasks;
    if (shorttermFilter === "进行中") return shorttermTasks.filter((t) => t.status === "active" && (!t.endTime || t.endTime >= now));
    if (shorttermFilter === "已完成") return shorttermTasks.filter((t) => t.status === "done");
    if (shorttermFilter === "已逾期") return shorttermTasks.filter((t) => t.status === "active" && t.endTime != null && t.endTime < now);
    return shorttermTasks;
  }, [shorttermFilter, shorttermTasks]);

  const dailyByDate = (() => {
    const todayStr = getLocalDateStr(new Date());
    const groups: { dateStr: string; label: string; isToday: boolean; tasks: Task[] }[] = [];
    const seen = new Set<string>();

    const todayTasks = dailyTasks.filter((t) => {
      if (!t.startTime) return false;
      const ds = getLocalDateStr(new Date(t.startTime));
      return ds === todayStr;
    });

    if (todayTasks.length > 0 || true) {
      groups.push({ dateStr: todayStr, label: "今天", isToday: true, tasks: todayTasks });
      seen.add(todayStr);
    }

    for (const task of dailyTasks) {
      if (!task.startTime) continue;
      const ds = getLocalDateStr(new Date(task.startTime));
      if (seen.has(ds)) continue;
      seen.add(ds);
      groups.push({ dateStr: ds, label: formatDate(task.startTime), isToday: false, tasks: [task] });
    }

    if (groups.length === 0 || (groups.length === 1 && groups[0].tasks.length === 0)) {
      const todayOnly = groups[0];
      if (todayOnly && todayOnly.tasks.length === 0) {
        return groups;
      }
    }

    return groups;
  })();

  const renderLongtermView = () => {
    if (loading) return <LongtermSkeleton />;
    if (error) return <ErrorStateView onRetry={loadLongterm} />;

    if (tree.length === 0) {
      return (
        <EmptyStateView
          icon={Mountain}
          title="从一座山开始"
          description="设定一个长期目标，逐步攀登到顶峰"
          actionLabel="创建首个长期目标"
          onAction={handleMainAddClick}
        />
      );
    }

    return (
      <div className="px-4 py-4">
        <AnimatePresence>
          {showAddForm && (
            <AddTaskForm
              placeholder={addFormParentId ? "输入子任务名称" : "输入长期目标名称"}
              onSubmit={(title) => handleAddTask(title, "longterm", addFormParentId ?? undefined)}
              onCancel={() => {
                setShowAddForm(false);
                setAddFormParentId(null);
              }}
            />
          )}
        </AnimatePresence>

        <div className="space-y-1">
          {tree.map((node) => (
            <TreeNode
              key={node.id}
              node={node}
              depth={0}
              onToggleDone={handleToggleDone}
              onAddChild={(parentId) => handleAddChildClick(parentId, 1)}
              onDelete={handleDeleteTask}
            />
          ))}
        </div>

        {!showAddForm && (
          <button
            onClick={handleMainAddClick}
            className="mt-3 w-full flex items-center justify-center gap-1.5 py-3 rounded-xl border-2 border-dashed border-gray-300 dark:border-gray-700 text-sm text-gray-500 dark:text-gray-400 hover:border-indigo-300 dark:hover:border-indigo-700 hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors"
          >
            <Plus className="w-4 h-4" />
            添加长期目标
          </button>
        )}
      </div>
    );
  };

  const renderShorttermView = () => {
    if (loading) return <CardListSkeleton />;
    if (error) return <ErrorStateView onRetry={loadShortterm} />;

    if (shorttermTasks.length === 0) {
      return (
        <EmptyStateView
          icon={CalendarDays}
          title="规划你的下一步"
          description="将大目标拆解为可执行的短期事件"
          actionLabel="创建短期事件"
          onAction={handleMainAddClick}
        />
      );
    }

    const allDone =
      shorttermTasks.length > 0 &&
      shorttermTasks.every((t) => t.status === "done");

    const filters: ShortTermFilter[] = ["全部", "进行中", "已完成", "已逾期"];

    return (
      <div className="px-4 py-4">
        <AnimatePresence>
          {showAddForm && (
            <AddTaskForm
              placeholder="输入短期事件名称"
              onSubmit={(title) => handleAddTask(title, "shortterm")}
              onCancel={() => setShowAddForm(false)}
            />
          )}
        </AnimatePresence>

        {allDone && (
          <motion.div
            key={shorttermCelebrationShrunk ? "shrunk" : "full"}
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            className={`bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-xl mb-4 flex items-center gap-2 transition-all ${
              shorttermCelebrationShrunk
                ? "px-2.5 py-1.5 justify-center"
                : "p-3"
            }`}
          >
            {shorttermCelebrationShrunk ? (
              <span className="text-sm">🎉</span>
            ) : (
              <>
                <span className="text-sm font-medium text-green-700 dark:text-green-300">
                  🎉 所有短期事件已完成！
                </span>
                <button
                  onClick={() => router.push("/goals?view=habits")}
                  className="text-xs font-medium text-green-600 dark:text-green-400 hover:text-green-700 dark:hover:text-green-300 underline underline-offset-2 ml-auto flex-shrink-0"
                >
                  查看习惯追踪
                </button>
              </>
            )}
          </motion.div>
        )}

        <div className="flex items-center gap-2 mb-4 overflow-x-auto pb-1">
          {filters.map((f) => (
            <button
              key={f}
              onClick={() => setShorttermFilter(f)}
              className={`text-xs font-medium px-3 py-1.5 rounded-lg whitespace-nowrap transition-colors ${
                shorttermFilter === f
                  ? "bg-indigo-600 text-white"
                  : "bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-700"
              }`}
            >
              {f}
            </button>
          ))}
        </div>

        <div className="space-y-3">
          {filteredShortterm.map((task) => (
            <div key={task.id} className="group">
              <ShortTermCard
                task={task}
                onToggleDone={handleToggleDone}
                onAssignToday={handleAssignToday}
                onDelete={handleDeleteTask}
              />
            </div>
          ))}
        </div>

        {!showAddForm && (
          <button
            onClick={handleMainAddClick}
            className="mt-3 w-full flex items-center justify-center gap-1.5 py-3 rounded-xl border-2 border-dashed border-gray-300 dark:border-gray-700 text-sm text-gray-500 dark:text-gray-400 hover:border-indigo-300 dark:hover:border-indigo-700 hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors"
          >
            <Plus className="w-4 h-4" />
            添加短期事件
          </button>
        )}
      </div>
    );
  };

  const renderDailyView = () => {
    if (loading) return <CardListSkeleton />;
    if (error) return <ErrorStateView onRetry={loadDaily} />;

    if (dailyTasks.length === 0) {
      return (
        <EmptyStateView
          icon={ClipboardList}
          title="日常琐事会出现在这里"
          description="记录每天重复的待办事项"
          actionLabel="添加日常琐事"
          onAction={handleMainAddClick}
        />
      );
    }

    return (
      <div className="px-4 py-4">
        <AnimatePresence>
          {showAddForm && (
            <AddTaskForm
              placeholder="输入日常琐事名称"
              onSubmit={(title) => handleAddTask(title, "daily")}
              onCancel={() => setShowAddForm(false)}
            />
          )}
        </AnimatePresence>

        <div className="space-y-4">
          {dailyByDate.map((group) => (
            <div key={group.dateStr}>
              <div className="flex items-center gap-2 mb-2">
                <h3
                  className={`text-sm font-semibold ${
                    group.isToday
                      ? "text-indigo-600 dark:text-indigo-400"
                      : "text-gray-500 dark:text-gray-400"
                  }`}
                >
                  {group.label}
                </h3>
                {group.isToday && (
                  <span className="text-[10px] font-medium text-indigo-600 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-900/30 px-1.5 py-0.5 rounded-full">
                    今天
                  </span>
                )}
              </div>
              <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-100 dark:border-gray-800 divide-y divide-gray-50 dark:divide-gray-800/50">
                {group.tasks.map((task) => (
                  <DailyTaskItem
                    key={task.id}
                    task={task}
                    onToggleDone={handleToggleDone}
                    isFuture={!group.isToday}
                  />
                ))}
              </div>
            </div>
          ))}
        </div>

        {!showAddForm && (
          <button
            onClick={handleMainAddClick}
            className="mt-4 w-full flex items-center justify-center gap-1.5 py-3 rounded-xl border-2 border-dashed border-gray-300 dark:border-gray-700 text-sm text-gray-500 dark:text-gray-400 hover:border-indigo-300 dark:hover:border-indigo-700 hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors"
          >
            <Plus className="w-4 h-4" />
            添加日常琐事
          </button>
        )}
      </div>
    );
  };

  const renderHabitsView = () => {
    if (loading) return <HabitListSkeleton />;
    if (error) return <ErrorStateView onRetry={loadHabits} />;

    const allDoneToday =
      habits.length > 0 &&
      habits.every((h) => todayCheckedHabits.has(h.id!));

    return (
      <>
        <AnimatePresence>
          {dayChanged && currentView === "habits" && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 z-50 bg-black/20 backdrop-blur-sm flex items-center justify-center"
              onClick={dismissOverlay}
            >
              <motion.div
                initial={{ scale: 0.9, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                exit={{ scale: 0.9, opacity: 0 }}
                className="bg-white dark:bg-gray-900 rounded-2xl p-6 shadow-xl mx-4 max-w-sm text-center"
              >
                <div className="w-12 h-12 rounded-full bg-indigo-100 dark:bg-indigo-900/30 flex items-center justify-center mx-auto mb-3">
                  <Zap className="w-6 h-6 text-indigo-500" />
                </div>
                <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-1">
                  日期已变更
                </h3>
                <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">
                  新的一天开始了，请刷新习惯数据
                </p>
                <button
                  onClick={async () => {
                    dismissOverlay();
                    await loadHabits();
                  }}
                  className="w-full py-2.5 rounded-xl bg-indigo-600 text-white text-sm font-medium hover:bg-indigo-700 transition-colors"
                >
                  刷新数据
                </button>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>
        {habits.length === 0 ? (
          <EmptyStateView
            icon={Flame}
            title="培养一个好习惯"
            description="每天打卡，见证坚持的力量"
            actionLabel="创建新习惯"
            onAction={handleMainAddClick}
          />
        ) : (
          <div className="px-4 py-4">
            <AnimatePresence>
              {showAddForm && (
                <AddTaskForm
                  placeholder="输入习惯名称"
                  onSubmit={(title) => handleAddTask(title, "habits")}
                  onCancel={() => setShowAddForm(false)}
                  typeLabel="习惯"
                />
              )}
            </AnimatePresence>

            <div className="space-y-3">
              {habits.map((habit, i) => (
                <HabitCard
                  key={habit.id}
                  task={habit}
                  streak={habitStreaks.get(habit.id!) ?? 0}
                  todayChecked={todayCheckedHabits.has(habit.id!)}
                  onCheckIn={handleCheckIn}
                  onDelete={handleDeleteTask}
                  celebrateIndex={allDoneToday ? i : undefined}
                />
              ))}
            </div>

            {!showAddForm && (
              <button
                onClick={handleMainAddClick}
                className="mt-3 w-full flex items-center justify-center gap-1.5 py-3 rounded-xl border-2 border-dashed border-gray-300 dark:border-gray-700 text-sm text-gray-500 dark:text-gray-400 hover:border-indigo-300 dark:hover:border-indigo-700 hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors"
              >
                <Plus className="w-4 h-4" />
                添加新习惯
              </button>
            )}
          </div>
        )}
      </>
    );
  };

  return (
    <div className="flex flex-col h-full max-h-screen max-w-4xl mx-auto">
      <div className="flex-shrink-0 sticky top-0 z-30 bg-white/95 dark:bg-gray-900/95 backdrop-blur">
        <div className="flex items-center justify-between px-4 pt-3 pb-2">
          <h1 className="text-lg font-semibold text-gray-900 dark:text-gray-100">目标</h1>
        </div>

        <div className="flex border-b border-gray-200 dark:border-gray-800">
          {TABS.map(({ key, label, icon: Icon }) => {
            const active = currentView === key;
            return (
              <button
                key={key}
                onClick={() => switchView(key)}
                className={`flex-1 flex items-center justify-center gap-1.5 h-12 text-sm font-medium transition-colors relative ${
                  active
                    ? "text-indigo-600 border-b-2 border-indigo-600"
                    : "text-gray-500 border-b-2 border-transparent hover:text-gray-700 dark:hover:text-gray-300"
                }`}
              >
                <Icon className="w-4 h-4" />
                <span className="hidden sm:inline">{label}</span>
              </button>
            );
          })}
        </div>
      </div>

      <div className="flex-1 overflow-y-auto">
        <AnimatePresence mode="wait" custom={tabDirection.current}>
          <motion.div
            key={currentView}
            custom={tabDirection.current}
            initial={{ opacity: 0, x: tabDirection.current > 0 ? 30 : -30 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: tabDirection.current > 0 ? -30 : 30 }}
            transition={{ duration: 0.25, ease: [0.32, 0.72, 0, 1] }}
          >
            {currentView === "longterm" && renderLongtermView()}
            {currentView === "shortterm" && renderShorttermView()}
            {currentView === "daily" && renderDailyView()}
            {currentView === "habits" && renderHabitsView()}
          </motion.div>
        </AnimatePresence>
      </div>

      <AnimatePresence>
        {toast && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 20 }}
            className={`fixed bottom-20 left-1/2 -translate-x-1/2 z-50 px-4 py-2.5 rounded-xl text-sm font-medium shadow-lg ${
              toast.type === "error"
                ? "bg-red-600 text-white"
                : "bg-emerald-600 text-white"
            }`}
          >
            {toast.message}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}