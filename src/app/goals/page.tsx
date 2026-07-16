"use client";

import { useState, useEffect, useCallback, useMemo, useRef, Suspense } from "react";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import {
  CalendarDays,
  ClipboardList,
  Plus,
  ChevronRight,
  Check,
  Info,
  AlertCircle,
  Trash2,
  Clock,
  RotateCcw,
  Target,
  Layers,
} from "lucide-react";
import Link from "next/link";
import {
  getTasksByType,
  createTask,
  updateTask,
  deleteTask,
} from "@/lib/db";
import { showToast as globalShowToast } from "@/components/ui/Toast";
import TaskDetail from "@/components/ui/TaskDetail";
import { PRIORITY_CONFIG } from "@/lib/types";
import type { Task } from "@/lib/types";
import EngineGoalsView from "./EngineGoalsView";

const TABS: { key: "short-term" | "daily-trivial"; label: string; icon: typeof CalendarDays }[] = [
  { key: "short-term", label: "短期事件", icon: CalendarDays },
  { key: "daily-trivial", label: "日常琐事", icon: ClipboardList },
];

type ShortTermFilter = "全部" | "进行中" | "已完成" | "已逾期" | "本周" | "本月";
type DailyFilter = "全部" | "未完成" | "已完成";

function getLocalDateStr(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
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
  icon: typeof CalendarDays;
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

function CardListSkeleton({ count = 3 }: { count?: number }) {
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

function ErrorStateView({ onRetry }: { onRetry: () => void }) {
  return (
    <div className="flex flex-col items-center justify-center py-16 px-4 text-center">
      <AlertCircle className="w-12 h-12 text-red-400 mb-4" />
      <p className="text-gray-500 dark:text-gray-400 mb-4">加载失败</p>
      <button
        onClick={onRetry}
        className="flex items-center gap-2 px-4 py-2 rounded-xl bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors"
      >
        <RotateCcw className="w-4 h-4" />
        重试
      </button>
    </div>
  );
}

function AddTaskForm({
  placeholder,
  onSubmit,
  onCancel,
}: {
  placeholder: string;
  onSubmit: (title: string) => void;
  onCancel: () => void;
}) {
  const [title, setTitle] = useState("");

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (title.trim()) {
      onSubmit(title.trim());
    }
  };

  return (
    <motion.form
      initial={{ opacity: 0, height: 0 }}
      animate={{ opacity: 1, height: "auto" }}
      exit={{ opacity: 0, height: 0 }}
      className="overflow-hidden"
      onSubmit={handleSubmit}
    >
      <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-100 dark:border-gray-800 p-4 mb-3">
        <input
          type="text"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder={placeholder}
          className="w-full px-4 py-3 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          autoFocus
        />
        <div className="flex gap-3 mt-3">
          <button
            type="button"
            onClick={onCancel}
            className="flex-1 py-2.5 rounded-xl border border-gray-200 dark:border-gray-700 text-sm text-gray-500 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors"
          >
            取消
          </button>
          <button
            type="submit"
            className="flex-1 py-2.5 rounded-xl bg-blue-500 text-white text-sm font-medium hover:bg-blue-600 transition-colors"
          >
            创建
          </button>
        </div>
      </div>
    </motion.form>
  );
}

function ShortTermCard({
  task,
  onToggleDone,
  onAssignToday,
  onDelete,
  onDetailClick,
}: {
  task: Task;
  onToggleDone: (task: Task) => void;
  onAssignToday: (task: Task) => void;
  onDelete: (task: Task) => void;
  onDetailClick?: (taskId: number) => void;
}) {
  const router = useRouter();
  const [expanded, setExpanded] = useState(false);
  const isDone = task.status === "done";
  const isOverdue = useMemo(
    () => !isDone && task.endTime != null && task.endTime < Date.now(),
    [isDone, task.endTime]
  );
  const countdownDays = (() => {
    if (!task.dueDate) return null;
    const diff = task.dueDate - Date.now();
    return Math.ceil(diff / (1000 * 60 * 60 * 24));
  })();

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      className="bg-white dark:bg-gray-900 rounded-xl border border-gray-100 dark:border-gray-800 shadow-sm overflow-hidden"
    >
      <div
        className="p-4 cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors"
        onClick={() => onDetailClick?.(task.id!)}
      >
        <div className="flex items-start gap-3">
          <button
            onClick={(e) => {
              e.stopPropagation();
              onToggleDone(task);
            }}
            className={`w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 transition-colors ${
              isDone
                ? "bg-green-100 dark:bg-green-900/30 text-green-600"
                : "bg-gray-100 dark:bg-gray-800 text-gray-400 hover:bg-gray-200"
            }`}
          >
            <Check className="w-4 h-4" />
          </button>

          <div className="flex-1 min-w-0">
            <p className={`text-sm font-medium ${isDone ? "line-through text-gray-400" : "text-gray-900 dark:text-gray-100"} truncate`}>
              {task.title}
            </p>

            <div className="flex items-center gap-2 mt-1 flex-wrap">
              {task.priority && (
                <span
                  className="w-2 h-2 rounded-full flex-shrink-0"
                  style={{ backgroundColor: PRIORITY_CONFIG.find(p => p.key === task.priority)?.hex || '#6B7280' }}
                  title={PRIORITY_CONFIG.find(p => p.key === task.priority)?.label}
                />
              )}

              {task.dueDate && (
                <span className={`text-xs flex items-center gap-0.5 flex-shrink-0 ${
                  isOverdue ? "text-red-500" : countdownDays === 0 ? "text-amber-500" : "text-gray-400"
                }`}>
                  <Clock className="w-3 h-3" />
                  {isOverdue ? `逾期${Math.abs(countdownDays!)}天` : countdownDays === 0 ? "今天" : `${countdownDays}天后`}
                </span>
              )}

              {task.startTime && (
                <span className="text-xs text-gray-400 flex-shrink-0">
                  {formatDate(task.startTime)} {formatTime(task.startTime)}
                </span>
              )}
            </div>
          </div>
        </div>
      </div>

      <div className="px-4 pb-4">
        <div className="flex items-center gap-2">
          <button
            onClick={() => onAssignToday(task)}
            className="flex-1 flex items-center justify-center gap-1 py-2 rounded-lg bg-blue-50 dark:bg-blue-900/30 text-blue-600 text-xs font-medium hover:bg-blue-100 transition-colors"
          >
            <CalendarDays className="w-3 h-3" />
            今日安排
          </button>
          <button
            onClick={() => router.push("/today")}
            className="flex-1 flex items-center justify-center gap-1 py-2 rounded-lg bg-gray-50 dark:bg-gray-800 text-gray-600 text-xs font-medium hover:bg-gray-100 transition-colors"
          >
            <ClipboardList className="w-3 h-3" />
            查看日程
          </button>
          <button
            onClick={() => onDelete(task)}
            className="w-8 h-8 flex items-center justify-center rounded-lg bg-gray-50 dark:bg-gray-800 text-gray-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/30 transition-colors"
          >
            <Trash2 className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>
    </motion.div>
  );
}

function DailyCard({
  task,
  onToggleDone,
  onDelete,
}: {
  task: Task;
  onToggleDone: (task: Task) => void;
  onDelete: (task: Task) => void;
}) {
  const isDone = task.status === "done";

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      className="flex items-center gap-3 p-3 bg-white dark:bg-gray-900 rounded-xl border border-gray-100 dark:border-gray-800"
    >
      <button
        onClick={() => onToggleDone(task)}
        className={`w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0 transition-colors ${
          isDone
            ? "bg-green-100 dark:bg-green-900/30 text-green-600"
            : "bg-gray-100 dark:bg-gray-800 text-gray-400 hover:bg-gray-200"
        }`}
      >
        <Check className="w-4 h-4" />
      </button>

      <div className="flex-1 min-w-0">
        <p className={`text-sm ${isDone ? "line-through text-gray-400" : "text-gray-900 dark:text-gray-100"} truncate`}>
          {task.title}
        </p>
      </div>

      {task.priority && (
        <span
          className="w-2 h-2 rounded-full flex-shrink-0"
          style={{ backgroundColor: PRIORITY_CONFIG.find(p => p.key === task.priority)?.hex || '#6B7280' }}
          title={PRIORITY_CONFIG.find(p => p.key === task.priority)?.label}
        />
      )}

      <button
        onClick={() => onDelete(task)}
        className="w-7 h-7 flex items-center justify-center rounded-lg text-gray-400 hover:text-red-500 transition-colors"
      >
        <Trash2 className="w-3.5 h-3.5" />
      </button>
    </motion.div>
  );
}

function GoalsContent() {
  const router = useRouter();

  const [currentView, setCurrentView] = useState<"short-term" | "daily-trivial">("short-term");

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [shorttermTasks, setShorttermTasks] = useState<Task[]>([]);
  const [dailyTasks, setDailyTasks] = useState<Task[]>([]);

  const [detailTaskId, setDetailTaskId] = useState<number | null>(null);
  const [toast, setToast] = useState<{ message: string; type: "success" | "error" } | null>(null);
  const toastTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const tabDirection = useRef<number>(0);
  const [tabAnimDir, setTabAnimDir] = useState(0);
  const [shorttermFilter, setShorttermFilter] = useState<ShortTermFilter>("全部");
  const [dailyFilter, setDailyFilter] = useState<DailyFilter>("全部");
  const [shorttermCelebrationShrunk, setShorttermCelebrationShrunk] = useState(false);

  const showToast = useCallback((message: string, type: "success" | "error" = "success") => {
    setToast({ message, type });
    if (toastTimerRef.current) clearTimeout(toastTimerRef.current);
    toastTimerRef.current = setTimeout(() => setToast(null), 3000);
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
      requestAnimationFrame(() => setShorttermCelebrationShrunk(false));
      const timer = setTimeout(() => {
        setShorttermCelebrationShrunk(true);
      }, 5000);
      return () => clearTimeout(timer);
    } else {
      requestAnimationFrame(() => setShorttermCelebrationShrunk(false));
    }
  }, [allShorttermDone]);

  const handleTabClick = useCallback(
    (view: "short-term" | "daily-trivial") => {
      const oldIdx = TABS.findIndex((t) => t.key === currentView);
      const newIdx = TABS.findIndex((t) => t.key === view);
      tabDirection.current = newIdx > oldIdx ? 1 : -1;
      setTabAnimDir(newIdx > oldIdx ? 1 : -1);
      setCurrentView(view);
    },
    [currentView]
  );

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
      const active = data.filter((t) => t.status !== "archived" && t.classification === "daily-trivial");
      setDailyTasks(active);
    } catch {
      setError(true);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const load = async () => {
      switch (currentView) {
        case "short-term":
          await loadShortterm();
          break;
        case "daily-trivial":
          await loadDaily();
          break;
      }
    };
    load();
  }, [currentView, loadShortterm, loadDaily]);

  const handleToggleDone = useCallback(
    async (task: Task) => {
      const newStatus = task.status === "done" ? "active" : "done";
      try {
        await updateTask(task.id!, { status: newStatus });
        switch (currentView) {
          case "short-term":
            await loadShortterm();
            break;
          case "daily-trivial":
            await loadDaily();
            break;
        }
      } catch {
        showToast("操作失败", "error");
      }
    },
    [currentView, loadShortterm, loadDaily, showToast]
  );

  const handleDeleteTask = useCallback(
    async (task: Task) => {
      try {
        await deleteTask(task.id!);
        showToast("已移入回收站", "success");
        switch (currentView) {
          case "short-term":
            await loadShortterm();
            break;
          case "daily-trivial":
            await loadDaily();
            break;
        }
      } catch {
        showToast("删除失败", "error");
      }
    },
    [currentView, loadShortterm, loadDaily, showToast]
  );

  const handleAssignToday = useCallback(
    async (task: Task) => {
      try {
        const today = new Date();
        const start = new Date(today.getFullYear(), today.getMonth(), today.getDate()).getTime();
        const end = start + 24 * 60 * 60 * 1000;
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

  const handleMainAddClick = () => {
    router.push("/planner");
  };

  const filteredShortterm = useMemo(() => {
    let filtered = [...shorttermTasks];
    switch (shorttermFilter) {
      case "进行中":
        filtered = filtered.filter((t) => t.status === "active");
        break;
      case "已完成":
        filtered = filtered.filter((t) => t.status === "done");
        break;
      case "已逾期":
        filtered = filtered.filter((t) => t.status === "active" && t.endTime != null && t.endTime < Date.now());
        break;
      case "本周": {
        const now = new Date();
        const weekStart = new Date(now);
        weekStart.setDate(now.getDate() - now.getDay());
        weekStart.setHours(0, 0, 0, 0);
        const weekEnd = new Date(weekStart);
        weekEnd.setDate(weekEnd.getDate() + 7);
        filtered = filtered.filter((t) => t.startTime != null && t.startTime >= weekStart.getTime() && t.startTime < weekEnd.getTime());
        break;
      }
      case "本月": {
        const now = new Date();
        const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
        const monthEnd = new Date(now.getFullYear(), now.getMonth() + 1, 1);
        filtered = filtered.filter((t) => t.startTime != null && t.startTime >= monthStart.getTime() && t.startTime < monthEnd.getTime());
        break;
      }
    }
    return filtered.sort((a, b) => {
      const priorityOrder = ["urgent-important", "not-urgent-important", "urgent-not-important", "not-urgent-not-important"];
      const pa = priorityOrder.indexOf(a.priority || "not-urgent-not-important");
      const pb = priorityOrder.indexOf(b.priority || "not-urgent-not-important");
      if (pa !== pb) return pa - pb;
      return (a.dueDate || Infinity) - (b.dueDate || Infinity);
    });
  }, [shorttermTasks, shorttermFilter]);

  const filteredDaily = useMemo(() => {
    let filtered = [...dailyTasks];
    switch (dailyFilter) {
      case "未完成":
        filtered = filtered.filter((t) => t.status !== "done");
        break;
      case "已完成":
        filtered = filtered.filter((t) => t.status === "done");
        break;
    }
    return filtered;
  }, [dailyTasks, dailyFilter]);

  const renderShorttermView = () => {
    if (loading) return <CardListSkeleton />;
    if (error) return <ErrorStateView onRetry={loadShortterm} />;

    if (shorttermTasks.length === 0) {
      return (
        <EmptyStateView
          icon={CalendarDays}
          title="规划你的下一步"
          description="将大目标拆解为可执行的短期事件"
          actionLabel="去安排页管理"
          onAction={() => router.push("/planner")}
        />
      );
    }

    const allDone =
      shorttermTasks.length > 0 &&
      shorttermTasks.every((t) => t.status === "done");

    const shorttermCompleted = shorttermTasks.filter(t => t.status === "done").length;
    const shorttermRate = shorttermTasks.length > 0 ? Math.round((shorttermCompleted / shorttermTasks.length) * 100) : 0;

    const filters: ShortTermFilter[] = ["全部", "进行中", "已完成", "已逾期", "本周", "本月"];

    return (
      <div className="px-4 py-4">
        {/* 整体完成率统计 */}
        <div className="mb-4">
          <div className="flex items-center justify-between text-xs mb-1">
            <span className="text-gray-500 dark:text-gray-400">整体完成率</span>
            <span className="font-semibold text-gray-700 dark:text-gray-300">{shorttermCompleted}/{shorttermTasks.length} · {shorttermRate}%</span>
          </div>
          <div className="h-2 bg-gray-100 dark:bg-gray-800 rounded-full overflow-hidden">
            <motion.div
              initial={{ width: 0 }}
              animate={{ width: `${shorttermRate}%` }}
              transition={{ duration: 0.5 }}
              className="h-full bg-gradient-to-r from-indigo-400 to-indigo-600 rounded-full"
            />
          </div>
        </div>

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
                <Link
                    href="/plugins/habit"
                    className="text-xs font-medium text-green-600 dark:text-green-400 hover:text-green-700 dark:hover:text-green-300 underline underline-offset-2 ml-auto flex-shrink-0"
                  >
                    查看习惯追踪
                  </Link>
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
            <ShortTermCard
              key={task.id}
              task={task}
              onToggleDone={handleToggleDone}
              onAssignToday={handleAssignToday}
              onDelete={handleDeleteTask}
              onDetailClick={setDetailTaskId}
            />
          ))}
        </div>

        <button
          onClick={() => router.push("/planner")}
          className="mt-3 w-full flex items-center justify-center gap-1.5 py-3 rounded-xl border-2 border-dashed border-gray-300 dark:border-gray-700 text-sm text-gray-500 dark:text-gray-400 hover:border-indigo-300 dark:hover:border-indigo-700 hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors"
        >
          <CalendarDays className="w-4 h-4" />
          去安排页管理短期事件
        </button>
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
          title="开始日常琐事"
          description="记录每天需要完成的小任务"
          actionLabel="去安排页管理"
          onAction={() => router.push("/planner")}
        />
      );
    }

    const filters: DailyFilter[] = ["全部", "未完成", "已完成"];

    const completedCount = dailyTasks.filter((t) => t.status === "done").length;
    const progress = dailyTasks.length > 0 ? Math.round((completedCount / dailyTasks.length) * 100) : 0;

    return (
      <div className="px-4 py-4">
        <div className="mb-4">
          <div className="flex items-center justify-between text-sm mb-1">
            <span className="text-gray-500 dark:text-gray-400">完成进度</span>
            <span className="font-medium text-gray-700 dark:text-gray-300">{completedCount}/{dailyTasks.length}</span>
          </div>
          <div className="h-2 bg-gray-100 dark:bg-gray-800 rounded-full overflow-hidden">
            <motion.div
              initial={{ width: 0 }}
              animate={{ width: `${progress}%` }}
              transition={{ duration: 0.5 }}
              className="h-full bg-gradient-to-r from-green-400 to-emerald-500 rounded-full"
            />
          </div>
        </div>

        <div className="flex items-center gap-2 mb-4 overflow-x-auto pb-1">
          {filters.map((f) => (
            <button
              key={f}
              onClick={() => setDailyFilter(f)}
              className={`text-xs font-medium px-3 py-1.5 rounded-lg whitespace-nowrap transition-colors ${
                dailyFilter === f
                  ? "bg-indigo-600 text-white"
                  : "bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-700"
              }`}
            >
              {f}
            </button>
          ))}
        </div>

        <div className="space-y-2">
          {filteredDaily.map((task) => (
            <DailyCard
              key={task.id}
              task={task}
              onToggleDone={handleToggleDone}
              onDelete={handleDeleteTask}
            />
          ))}
        </div>

        <button
          onClick={() => router.push("/planner")}
          className="mt-3 w-full flex items-center justify-center gap-1.5 py-3 rounded-xl border-2 border-dashed border-gray-300 dark:border-gray-700 text-sm text-gray-500 dark:text-gray-400 hover:border-emerald-300 dark:hover:border-emerald-700 hover:text-emerald-600 dark:hover:text-emerald-400 transition-colors"
        >
          <ClipboardList className="w-4 h-4" />
          去安排页管理日常琐事
        </button>
      </div>
    );
  };

  return (
    <div className="flex flex-col h-full max-w-4xl mx-auto">

      {/* 子 Tab 栏 — 滑动指示器风格 */}
      <div className="relative grid grid-cols-2 gap-1 bg-gray-100 rounded-xl p-1 mb-4 mx-4">
        <motion.div
          layoutId="goals-subtab-indicator"
          className="absolute top-1 bottom-1 rounded-lg bg-white shadow-sm z-0"
          style={{ width: `calc((100% - 8px) / 2)` }}
          animate={{
            left: `calc(${currentView === "short-term" ? 0 : 50}% + 4px)`,
          }}
          transition={{ duration: 0.25, ease: [0.4, 0, 0.2, 1] }}
        />
        {TABS.map(({ key, label, icon: Icon }) => {
          const active = currentView === key;
          return (
            <button
              key={key}
              onClick={() => handleTabClick(key)}
              className={`relative z-10 flex items-center justify-center gap-1.5 py-2.5 rounded-lg text-sm font-medium transition-colors duration-200 ${
                active ? "text-gray-900 font-semibold" : "text-gray-500 hover:text-gray-700"
              }`}
            >
              <Icon className="w-4 h-4" strokeWidth={2} />
              <span>{label}</span>
            </button>
          );
        })}
      </div>

      <div className="flex-1 overflow-y-auto">
        <AnimatePresence mode="sync" custom={tabAnimDir}>
          <motion.div
            key={currentView}
            custom={tabAnimDir}
            initial={{ opacity: 0, x: tabAnimDir > 0 ? 30 : -30 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: tabAnimDir > 0 ? -30 : 30 }}
            transition={{ duration: 0.25, ease: [0.32, 0.72, 0, 1] }}>
            {currentView === "short-term" && renderShorttermView()}
            {currentView === "daily-trivial" && renderDailyView()}
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

      <button
        onClick={handleMainAddClick}
        className="fixed bottom-24 right-4 z-30 bg-indigo-500 w-14 h-14 rounded-full shadow-lg flex items-center justify-center hover:bg-indigo-600 transition-colors active:scale-95"
        aria-label="前往安排页"
      >
        <CalendarDays className="w-6 h-6 text-white" />
      </button>

      {detailTaskId !== null && (
        <TaskDetail
          taskId={detailTaskId}
          onClose={() => setDetailTaskId(null)}
        />
      )}
    </div>
  );
}

export default function GoalsPage() {
  const [mode, setMode] = useState<"tasks" | "goals">("goals");

  return (
    <Suspense fallback={<div className="flex items-center justify-center h-64"><div className="w-6 h-6 border-2 border-gray-300 border-t-indigo-500 rounded-full animate-spin" /></div>}>
      {/* 顶层模式切换 */}
      <div className="max-w-4xl mx-auto px-4 pt-4">
        <div className="relative grid grid-cols-2 gap-1 rounded-xl p-1 mb-4"
          style={{ backgroundColor: "var(--surface-fabric)" }}>
          <motion.div
            layoutId="goals-mode-indicator"
            className="absolute top-1 bottom-1 rounded-lg bg-white dark:bg-gray-700 shadow-sm z-0"
            style={{ width: "calc(50% - 4px)" }}
            animate={{ left: mode === "goals" ? "4px" : "calc(50% + 0px)" }}
            transition={{ duration: 0.25, ease: [0.4, 0, 0.2, 1] }}
          />
          <button
            onClick={() => setMode("goals")}
            className={`relative z-10 flex items-center justify-center gap-2 py-2.5 rounded-lg text-sm font-medium transition-colors ${
              mode === "goals" ? "text-[var(--text-primary)] font-semibold" : "text-[var(--text-tertiary)]"
            }`}
            style={{ fontFamily: mode === "goals" ? "var(--font-display)" : undefined }}
          >
            <Target className="w-4 h-4" />
            目标拆解
          </button>
          <button
            onClick={() => setMode("tasks")}
            className={`relative z-10 flex items-center justify-center gap-2 py-2.5 rounded-lg text-sm font-medium transition-colors ${
              mode === "tasks" ? "text-[var(--text-primary)] font-semibold" : "text-[var(--text-tertiary)]"
            }`}
            style={{ fontFamily: mode === "tasks" ? "var(--font-display)" : undefined }}
          >
            <Layers className="w-4 h-4" />
            任务管理
          </button>
        </div>
      </div>

      <AnimatePresence mode="wait">
        {mode === "goals" ? (
          <motion.div
            key="goals"
            initial={{ opacity: 0, x: -10 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: 10 }}
            transition={{ duration: 0.2 }}
          >
            <EngineGoalsView />
          </motion.div>
        ) : (
          <motion.div
            key="tasks"
            initial={{ opacity: 0, x: 10 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -10 }}
            transition={{ duration: 0.2 }}
          >
            <GoalsContent />
          </motion.div>
        )}
      </AnimatePresence>
    </Suspense>
  );
}
