"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Inbox,
  Calendar,
  Timer,
  CheckCircle,
  Clock,
  Zap,
  Coffee,

  Play,
  Lightbulb,
  ArrowRight,
  PartyPopper,
} from "lucide-react";
import Link from "next/link";
import {
  getTasksByTimeRange,
  getTodayTasks,
  getFocusLogsByTimeRange,
} from "@/lib/db";
import type { Task, FocusLog } from "@/lib/types";
import EmptyState from "@/components/ui/EmptyState";

const WEEK_DAY_NAMES = ["周日", "周一", "周二", "周三", "周四", "周五", "周六"];
const INITIAL_NOW = Date.now();

function getTodayRange() {
  const now = new Date();
  const start = new Date(
    now.getFullYear(),
    now.getMonth(),
    now.getDate()
  ).getTime();
  const end = start + 24 * 60 * 60 * 1000;
  return { start, end };
}

function formatChineseDate(date: Date): string {
  const month = date.getMonth() + 1;
  const day = date.getDate();
  const weekDay = WEEK_DAY_NAMES[date.getDay()];
  return `${month}月${day}日 ${weekDay}`;
}

function formatTime(timestamp: number): string {
  const d = new Date(timestamp);
  return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
}

function formatCountdown(ms: number): string {
  if (ms <= 0) return "00:00";
  const totalSeconds = Math.floor(ms / 1000);
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  if (hours > 0) {
    return `${hours}:${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
  }
  return `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
}

function minutesToDisplay(minutes: number): string {
  if (minutes < 60) {
    return `${minutes} 分钟`;
  }
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return m > 0 ? `${h} 小时 ${m} 分钟` : `${h} 小时`;
}

interface IdleHint {
  text: string;
  variant: "tight" | "spacious" | "normal";
}

function getIdleHint(minutesUntilNext: number): IdleHint {
  if (minutesUntilNext < 15) {
    return {
      text: `即将在 ${minutesUntilNext} 分钟后开始，不适合长时间专注`,
      variant: "tight",
    };
  }
  if (minutesUntilNext > 240) {
    return {
      text: "大块空闲时间，适合深度工作",
      variant: "spacious",
    };
  }
  return {
    text: "利用这段时间专注",
    variant: "normal",
  };
}

const containerVariants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: { staggerChildren: 0.07 },
  },
};

const itemVariants = {
  hidden: { opacity: 0, y: 16 },
  visible: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.35 },
  },
};

function DashboardSkeleton() {
  return (
    <div className="max-w-2xl mx-auto p-4 md:p-6 space-y-6 animate-pulse">
      <div className="space-y-2">
        <div className="skeleton h-8 w-36 rounded-lg" />
        <div className="skeleton h-4 w-28 rounded-lg" />
      </div>

      <div className="bg-[var(--card-bg)] border border-[var(--card-border)] rounded-2xl p-5 space-y-3">
        <div className="skeleton h-5 w-24 rounded-lg" />
        <div className="skeleton h-4 w-48 rounded-lg" />
      </div>

      <div className="grid grid-cols-2 gap-3">
        {Array.from({ length: 4 }).map((_, i) => (
          <div
            key={i}
            className="bg-[var(--card-bg)] border border-[var(--card-border)] rounded-2xl p-4 space-y-3"
          >
            <div className="skeleton w-8 h-8 rounded-xl" />
            <div className="skeleton h-3 w-16 rounded-lg" />
            <div className="skeleton h-6 w-12 rounded-lg" />
          </div>
        ))}
      </div>

      <div className="bg-[var(--card-bg)] border border-[var(--card-border)] rounded-2xl p-5 space-y-4">
        <div className="skeleton h-5 w-24 rounded-lg" />
        {Array.from({ length: 3 }).map((_, i) => (
          <div key={i} className="flex items-center gap-3">
            <div className="skeleton w-12 h-4 rounded-lg flex-shrink-0" />
            <div className="skeleton h-px flex-1 rounded-full" />
            <div className="skeleton w-32 h-4 rounded-lg" />
          </div>
        ))}
      </div>
    </div>
  );
}

interface StatCardProps {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: string | number;
  color: string;
  bgColor: string;
}

function StatCard({
  icon: Icon,
  label,
  value,
  color,
  bgColor,
}: StatCardProps) {
  return (
    <motion.div
      variants={itemVariants}
      className="bg-[var(--card-bg)] border border-[var(--card-border)] rounded-2xl p-4 hover:shadow-md transition-shadow"
    >
      <div
        className="w-9 h-9 rounded-xl flex items-center justify-center mb-3"
        style={{ backgroundColor: bgColor, color }}
      >
        <Icon className="w-[18px] h-[18px]" />
      </div>
      <p className="text-xs text-[var(--muted-foreground)] mb-0.5">{label}</p>
      <p className="text-xl font-bold text-[var(--foreground)]">{value}</p>
    </motion.div>
  );
}

export default function DashboardPage() {
  const [loading, setLoading] = useState(true);
  const [inboxCount, setInboxCount] = useState(0);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [focusLogs, setFocusLogs] = useState<FocusLog[]>([]);
  const [now, setNow] = useState(INITIAL_NOW);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const tickRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const cancelledRef = useRef(false);

  const fetchData = useCallback(async () => {
    try {
      const { start, end } = getTodayRange();
      const [todayTasks, evts, logs] = await Promise.all([
        getTodayTasks(),
        getTasksByTimeRange(start, end),
        getFocusLogsByTimeRange(start, end),
      ]);
      if (cancelledRef.current) return;
      setInboxCount(todayTasks.length);
      setTasks(evts);
      setFocusLogs(logs);
    } catch (err) {
      if (cancelledRef.current) return;
      console.error("Dashboard fetch failed:", err);
    } finally {
      if (!cancelledRef.current) setLoading(false);
    }
  }, []);

  useEffect(() => {
    cancelledRef.current = false;

    const initialTimer = setTimeout(() => {
      fetchData();
    }, 0);

    pollRef.current = setInterval(() => {
      setNow(Date.now());
      fetchData();
    }, 60000);

    return () => {
      cancelledRef.current = true;
      clearTimeout(initialTimer);
      if (pollRef.current) {
        clearInterval(pollRef.current);
        pollRef.current = null;
      }
      if (tickRef.current) {
        clearInterval(tickRef.current);
        tickRef.current = null;
      }
    };
  }, [fetchData]);

  const completedFocusLogs = focusLogs.filter((fl) => fl.completed);
  const totalFocusMs = completedFocusLogs.reduce(
    (sum, fl) => sum + fl.duration,
    0
  );
  const totalFocusMinutes = Math.round(totalFocusMs / 60000);

  const completedTaskIds = new Set(completedFocusLogs.map((fl) => fl.eventId));
  const completedTasksCount = tasks.filter(
    (t) => t.id !== undefined && completedTaskIds.has(t.id)
  ).length;
  const completionRate =
    tasks.length > 0
      ? Math.round((completedTasksCount / tasks.length) * 100)
      : 0;

  const activeFocusSession = focusLogs.find((fl) => !fl.completed);
  const activeTask =
    activeFocusSession !== undefined
      ? tasks.find((t) => t.id === activeFocusSession.eventId)
      : undefined;

  const remainingTasks = tasks
    .filter((t) => t.endTime && t.endTime > now)
    .sort((a, b) => a.startTime! - b.startTime!);

  const upcomingTasks = remainingTasks.slice(0, 5);
  const plannedTasksCount = tasks.filter((t) => t.planned).length;
  const allTodayTasksCount = tasks.length;

  const activeCountdown =
    activeTask && activeTask.endTime && activeTask.endTime > now ? activeTask.endTime - now : 0;

  useEffect(() => {
    if (activeTask && activeTask.endTime && activeTask.endTime > now) {
      tickRef.current = setInterval(() => {
        setNow(Date.now());
      }, 1000);
      return () => {
        if (tickRef.current) {
          clearInterval(tickRef.current);
          tickRef.current = null;
        }
      };
    }
  }, [activeTask, now]);

  let statusTitle: string;
  let statusDescription: string;
  let StatusIcon: React.ComponentType<{ className?: string }>;
  let statusVariant: "active" | "idle-upcoming" | "idle-empty" | "no-task";
  let idleHint: IdleHint | null = null;

  if (activeTask) {
    statusTitle = "进行中";
    statusDescription = activeTask.title;
    StatusIcon = Zap;
    statusVariant = "active";
  } else if (allTodayTasksCount > 0) {
    if (remainingTasks.length > 0) {
      const nextTaskMinutes = Math.round(
        (remainingTasks[0].startTime! - now) / 60000
      );
      statusTitle = "空闲";
      statusDescription = `下一个: ${remainingTasks[0].title} ${formatTime(remainingTasks[0].startTime!)}`;
      StatusIcon = Coffee;
      statusVariant = "idle-upcoming";
      idleHint = getIdleHint(nextTaskMinutes);
    } else {
      statusTitle = "今天没有更多安排了";
      statusDescription = "辛苦了，回顾一下今天的成果吧";
      StatusIcon = PartyPopper;
      statusVariant = "idle-empty";
    }
  } else {
    statusTitle = "今天还没有安排";
    statusDescription = "规划你的一天，让时间更有价值";
    StatusIcon = Coffee;
    statusVariant = "no-task";
  }

  const today = new Date();

  if (loading) {
    return <DashboardSkeleton />;
  }

  return (
    <div className="max-w-2xl mx-auto p-4 md:p-6">
      <motion.div
        variants={containerVariants}
        initial="hidden"
        animate="visible"
        className="space-y-5"
      >
        <motion.div variants={itemVariants}>
          <h1 className="text-2xl font-bold text-[var(--foreground)] tracking-tight">
            今日概览
          </h1>
          <p className="text-sm text-[var(--muted-foreground)] mt-1">
            {formatChineseDate(today)}
          </p>
        </motion.div>

        <motion.div
          variants={itemVariants}
          className={`rounded-2xl p-5 ${
            statusVariant === "active"
              ? "bg-indigo-50/60 dark:bg-indigo-950/30 border border-indigo-200 dark:border-indigo-800 ring-2 ring-indigo-100 dark:ring-indigo-900"
              : statusVariant === "idle-upcoming"
                ? "bg-[var(--card-bg)] border border-dashed border-[var(--card-border)]"
                : "bg-[var(--card-bg)] border border-[var(--card-border)]"
          }`}
        >
          <div className="flex items-start gap-4">
            <div
              className={`w-11 h-11 rounded-xl flex items-center justify-center flex-shrink-0 ${
                statusVariant === "active"
                  ? "bg-indigo-500 text-white"
                  : statusVariant === "idle-upcoming"
                    ? "bg-blue-100 text-blue-600 dark:bg-blue-900/40 dark:text-blue-400"
                    : statusVariant === "idle-empty"
                      ? "bg-emerald-100 text-emerald-600 dark:bg-emerald-900/40 dark:text-emerald-400"
                      : "bg-gray-100 text-gray-500 dark:bg-gray-800 dark:text-gray-400"
              }`}
            >
              <StatusIcon className="w-5 h-5" />
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2">
                <p
                  className={`text-sm font-medium ${
                    statusVariant === "active"
                      ? "text-indigo-600 dark:text-indigo-400"
                      : "text-[var(--muted-foreground)]"
                  }`}
                >
                  {statusTitle}
                </p>
                {statusVariant === "active" && (
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-indigo-100 dark:bg-indigo-900/40 text-indigo-600 dark:text-indigo-400 text-[11px] font-semibold animate-pulse">
                    <span className="relative flex h-1.5 w-1.5">
                      <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-indigo-400 opacity-75" />
                      <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-indigo-500" />
                    </span>
                    LIVE
                  </span>
                )}
              </div>
              <p className="text-lg font-semibold text-[var(--foreground)] mt-0.5 truncate">
                {statusDescription}
              </p>

              {statusVariant === "active" && (
                <div className="mt-2 flex items-center gap-2">
                  <Clock className="w-4 h-4 text-indigo-500" />
                  <span className="text-2xl font-mono font-bold text-indigo-600 dark:text-indigo-400 tabular-nums">
                    {formatCountdown(activeCountdown)}
                  </span>
                  <span className="text-xs text-[var(--muted-foreground)]">
                    剩余
                  </span>
                </div>
              )}

              {idleHint && (
                <div className="mt-2 flex items-start gap-2 text-xs">
                  <Lightbulb className="w-3.5 h-3.5 flex-shrink-0 mt-0.5 text-amber-500" />
                  <span
                    className={`${
                      idleHint.variant === "tight"
                        ? "text-amber-600 dark:text-amber-400"
                        : idleHint.variant === "spacious"
                          ? "text-emerald-600 dark:text-emerald-400"
                          : "text-[var(--muted-foreground)]"
                    }`}
                  >
                    {idleHint.text}
                  </span>
                </div>
              )}
            </div>
          </div>

          {statusVariant === "active" && (
            <div className="mt-4 pt-4 border-t border-indigo-100 dark:border-indigo-900/50">
              <div className="flex items-center gap-2 text-xs text-[var(--muted-foreground)]">
                <Clock className="w-3.5 h-3.5" />
                <span>
                  {formatTime(activeTask!.startTime!)} -{" "}
                  {formatTime(activeTask!.endTime!)}
                </span>
              </div>
            </div>
          )}

          {statusVariant === "idle-upcoming" && (
            <div className="mt-4 pt-4 border-t border-[var(--card-border)]">
              <Link
                href="/focus"
                className="inline-flex items-center gap-2 text-sm font-medium text-indigo-600 dark:text-indigo-400 hover:text-indigo-700 dark:hover:text-indigo-300 transition-colors"
              >
                <Play className="w-4 h-4" />
                进入专注模式
                <ArrowRight className="w-3.5 h-3.5" />
              </Link>
            </div>
          )}

          {(statusVariant === "idle-empty" ||
            statusVariant === "no-task") && (
            <div className="mt-4 pt-4 border-t border-[var(--card-border)] flex gap-3">
              <Link
                href="/capture"
                className="inline-flex items-center gap-2 text-sm font-medium text-indigo-600 dark:text-indigo-400 hover:text-indigo-700 dark:hover:text-indigo-300 transition-colors"
              >
                <Inbox className="w-4 h-4" />
                捕捉想法
                <ArrowRight className="w-3.5 h-3.5" />
              </Link>
              {(statusVariant === "idle-empty"
                ? (
                  <Link
                    href="/review"
                    className="inline-flex items-center gap-2 text-sm font-medium text-emerald-600 dark:text-emerald-400 hover:text-emerald-700 dark:hover:text-emerald-300 transition-colors"
                  >
                    <CheckCircle className="w-4 h-4" />
                    查看回顾
                    <ArrowRight className="w-3.5 h-3.5" />
                  </Link>
                )
                : (
                  <Link
                    href="/planner"
                    className="inline-flex items-center gap-2 text-sm font-medium text-violet-600 dark:text-violet-400 hover:text-violet-700 dark:hover:text-violet-300 transition-colors"
                  >
                    <Calendar className="w-4 h-4" />
                    开始规划
                    <ArrowRight className="w-3.5 h-3.5" />
                  </Link>
                ))}
            </div>
          )}
        </motion.div>

        <motion.div variants={itemVariants} className="grid grid-cols-2 gap-3">
          <StatCard
            icon={Inbox}
            label="捕捉想法"
            value={inboxCount}
            color="#6366f1"
            bgColor="#eef2ff"
          />
          <StatCard
            icon={Calendar}
            label="今日任务"
            value={plannedTasksCount}
            color="#f59e0b"
            bgColor="#fffbeb"
          />
          <StatCard
            icon={Timer}
            label="专注时长"
            value={minutesToDisplay(totalFocusMinutes)}
            color="#10b981"
            bgColor="#ecfdf5"
          />
          <StatCard
            icon={CheckCircle}
            label="完成率"
            value={`${completionRate}%`}
            color="#8b5cf6"
            bgColor="#f5f3ff"
          />
        </motion.div>

        <motion.div
          variants={itemVariants}
          className="bg-[var(--card-bg)] border border-[var(--card-border)] rounded-2xl p-5"
        >
          <h2 className="text-sm font-semibold text-[var(--foreground)] mb-4">
            今日时间线
          </h2>

          {upcomingTasks.length === 0 ? (
            <EmptyState
              icon={Calendar}
              title="暂无待办事项"
              description="今天的日程还是空的，规划一下你的一天吧"
            />
          ) : (
            <div className="space-y-0">
              <AnimatePresence mode="popLayout">
                {upcomingTasks.map((task, index) => {
                  const isCurrent =
                    task.startTime! <= now && task.endTime != null && task.endTime > now;
                  const isPast = task.endTime != null && task.endTime <= now;
                  return (
                    <motion.div
                      key={task.id ?? index}
                      initial={{ opacity: 0, x: -8 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: index * 0.06, duration: 0.3 }}
                      className="relative flex items-start gap-4 pl-5 pb-4 last:pb-0"
                    >
                      <div className="absolute left-0 top-2 w-px h-full bg-[var(--card-border)] last:hidden" />
                      <div
                        className={`absolute left-[-3px] top-1.5 w-[7px] h-[7px] rounded-full border-2 ${
                          isCurrent
                            ? "bg-amber-400 border-amber-400 animate-pulse"
                            : isPast
                              ? "bg-gray-300 border-gray-300 dark:bg-gray-600 dark:border-gray-600"
                              : "bg-indigo-500 border-indigo-500"
                        }`}
                      />
                      <span
                        className={`text-xs font-mono flex-shrink-0 w-12 pt-0.5 ${
                          isCurrent
                            ? "text-amber-600 font-semibold dark:text-amber-400"
                            : isPast
                              ? "text-[var(--muted-foreground)]"
                              : "text-[var(--muted-foreground)]"
                        }`}
                      >
                        {formatTime(task.startTime!)}
                      </span>
                      <div className="flex-1 min-w-0">
                        <p
                          className={`text-sm font-medium truncate ${
                            isCurrent
                              ? "text-amber-700 dark:text-amber-300"
                              : isPast
                                ? "text-[var(--muted-foreground)] line-through"
                                : "text-[var(--foreground)]"
                          }`}
                        >
                          {task.title}
                        </p>
                        <p className="text-xs text-[var(--muted-foreground)] mt-0.5">
                          {formatTime(task.startTime!)} -{" "}
                          {task.endTime ? formatTime(task.endTime) : "..."}
                          {task.tags && task.tags.length > 0 && (
                            <span className="ml-2">
                              {task.tags.map((tag) => (
                                <span
                                  key={tag}
                                  className="inline-block bg-[var(--card-border)] rounded-full px-1.5 py-px text-[10px] mr-1"
                                >
                                  {tag}
                                </span>
                              ))}
                            </span>
                          )}
                        </p>
                      </div>
                    </motion.div>
                  );
                })}
              </AnimatePresence>
            </div>
          )}

          {upcomingTasks.length > 0 && remainingTasks.length > 5 && (
            <p className="text-xs text-[var(--muted-foreground)] text-center mt-4 pt-3 border-t border-[var(--card-border)]">
              还有 {remainingTasks.length - upcomingTasks.length} 项任务未显示
            </p>
          )}
        </motion.div>
      </motion.div>
    </div>
  );
}
