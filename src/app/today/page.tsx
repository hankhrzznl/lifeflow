"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import {
  ChevronLeft,
  ChevronRight,
  AlertCircle,
  RotateCcw,
  Zap,
} from "lucide-react";
import {
  getTasksByTimeRange,
  getAllProjects,
} from "@/lib/db";
import type { Task, Project } from "@/lib/types";

const SLOT_HEIGHT = 32;
const MINUTES_PER_SLOT = 15;
const PIXELS_PER_HOUR = (60 / MINUTES_PER_SLOT) * SLOT_HEIGHT;
const CONTAINER_HEIGHT = 24 * PIXELS_PER_HOUR;

function pad(n: number): string {
  return String(n).padStart(2, "0");
}

function getDayStart(ts: number): number {
  const d = new Date(ts);
  return new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
}

function getDayEnd(ts: number): number {
  return getDayStart(ts) + 24 * 60 * 60 * 1000;
}

function formatDateLabel(d: Date): string {
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  const target = new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
  const diff = (target - today) / (1000 * 60 * 60 * 24);

  const weeks = ["日", "一", "二", "三", "四", "五", "六"];
  const dateStr = `${d.getFullYear()}年${d.getMonth() + 1}月${d.getDate()}日 星期${weeks[d.getDay()]}`;

  if (diff === 0) return `今天 · ${dateStr}`;
  if (diff === -1) return `昨天 · ${dateStr}`;
  if (diff === 1) return `明天 · ${dateStr}`;
  return dateStr;
}

function formatTime(ts: number): string {
  const d = new Date(ts);
  return `${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function calculateEventPosition(
  eventStart: number,
  eventEnd: number,
  dayStart: number
): { top: number; height: number } {
  const startMinutes = (eventStart - dayStart) / (1000 * 60);
  const durationMinutes = (eventEnd - eventStart) / (1000 * 60);

  const top = (startMinutes / MINUTES_PER_SLOT) * SLOT_HEIGHT;
  const height = Math.max(durationMinutes / MINUTES_PER_SLOT * SLOT_HEIGHT, SLOT_HEIGHT);

  return { top, height };
}

function calculateCurrentTimePosition(): number {
  const now = new Date();
  const minutesSinceMidnight = now.getHours() * 60 + now.getMinutes();
  return (minutesSinceMidnight / MINUTES_PER_SLOT) * SLOT_HEIGHT;
}

function getDayClippedEvent(
  event: Task,
  targetDay: number
): { startTime: number; endTime: number; isClipped: boolean } {
  const dayStart = getDayStart(targetDay);
  const dayEnd = getDayEnd(targetDay);

  const adjustedStart = Math.max(event.startTime!, dayStart);
  const adjustedEnd = Math.min(event.endTime!, dayEnd);

  const isClipped = adjustedStart !== event.startTime || adjustedEnd !== event.endTime;

  return { startTime: adjustedStart, endTime: adjustedEnd, isClipped };
}

function LoadingSkeleton() {
  return (
    <div className="flex flex-col h-full">
      <div className="px-4 pt-4 pb-2">
        <div className="flex items-center justify-between">
          <div className="skeleton w-8 h-8 rounded-lg" />
          <div className="skeleton h-5 w-48 rounded" />
          <div className="skeleton w-8 h-8 rounded-lg" />
        </div>
      </div>
      <div className="flex-1 px-4 overflow-hidden">
        <div className="flex" style={{ height: CONTAINER_HEIGHT }}>
          <div className="w-14 flex-shrink-0">
            {[...Array(24)].map((_, i) => (
              <div
                key={i}
                className="skeleton w-8 h-3 rounded ml-auto mr-2"
                style={{ marginTop: i === 0 ? 0 : PIXELS_PER_HOUR - 12 }}
              />
            ))}
          </div>
          <div className="flex-1 relative">
            {[...Array(4)].map((_, i) => (
              <div
                key={i}
                className="skeleton absolute rounded-xl"
                style={{
                  top: i * 200 + 40,
                  height: 80 + ((i * 37) % 40),
                  left: 0,
                  right: 0,
                }}
              />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

function ErrorState({ onRetry }: { onRetry: () => void }) {
  return (
    <div className="flex flex-col items-center justify-center py-20 px-4 text-center">
      <div className="w-16 h-16 rounded-2xl bg-red-50 dark:bg-red-900/30 flex items-center justify-center mb-4">
        <AlertCircle className="w-8 h-8 text-red-500" />
      </div>
      <h3 className="text-lg font-semibold text-gray-700 dark:text-gray-200 mb-1">数据加载失败</h3>
      <p className="text-sm text-gray-500 dark:text-gray-400 max-w-xs mb-6">可能是本地数据库暂时不可用</p>
      <button
        onClick={onRetry}
        aria-label="重试加载"
        className="bg-indigo-600 text-white rounded-xl h-12 px-6 font-medium hover:bg-indigo-700 transition-colors text-sm flex items-center gap-2"
      >
        <RotateCcw className="w-4 h-4" />
        重试
      </button>
    </div>
  );
}

function EmptyState() {
  return (
    <div className="flex flex-col items-center justify-center py-20 px-4 text-center">
      <div className="w-20 h-20 rounded-2xl bg-gray-50 dark:bg-gray-800 border-2 border-dashed border-gray-200 dark:border-gray-700 flex items-center justify-center mb-4">
        <svg
          width="40"
          height="40"
          viewBox="0 0 24 24"
          fill="none"
          stroke="#6366f1"
          strokeWidth="1.5"
          className="stroke-indigo-400"
        >
          <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
          <line x1="16" y1="2" x2="16" y2="6" />
          <line x1="8" y1="2" x2="8" y2="6" />
          <line x1="3" y1="10" x2="21" y2="10" />
        </svg>
      </div>
      <h3 className="text-lg font-semibold text-gray-700 dark:text-gray-200 mb-1">暂无安排</h3>
      <p className="text-sm text-gray-500 dark:text-gray-400 max-w-xs mb-6">点击下方按钮快速捕捉想法</p>
      <a
        href="/capture"
        className="bg-indigo-600 text-white rounded-xl h-12 px-6 font-medium hover:bg-indigo-700 transition-colors text-sm flex items-center"
      >
        捕捉想法
      </a>
    </div>
  );
}

function CurrentTimeIndicator({ dayStart }: { dayStart: number }) {
  const [position, setPosition] = useState(() => calculateCurrentTimePosition());

  useEffect(() => {
    const now = new Date();
    const currentDay = getDayStart(Date.now());
    if (currentDay !== dayStart) return;

    requestAnimationFrame(() => {
      setPosition(calculateCurrentTimePosition());
    });

    const msToNextMinute = (60 - now.getSeconds()) * 1000;
    let timeoutId: ReturnType<typeof setTimeout>;

    const schedule = () => {
      timeoutId = setTimeout(() => {
        setPosition(calculateCurrentTimePosition());
        schedule();
      }, 60000);
    };

    timeoutId = setTimeout(schedule, msToNextMinute);

    return () => clearTimeout(timeoutId);
  }, [dayStart]);

  return (
    <div
      className="absolute left-0 right-0 z-20 pointer-events-none flex items-center"
      style={{ top: `${position}px` }}
    >
      <div
        className="absolute w-2 h-2 rounded-full bg-red-500"
        style={{ left: "53px", marginTop: "-1px" }}
      />
      <div
        className="absolute right-0 h-0.5 bg-red-500"
        style={{ left: "56px", opacity: 0.6 }}
      />
    </div>
  );
}

function TimelineEventBlock({
  task,
  dayStart,
  projectColor,
  isHighlighted,
  onClick,
}: {
  task: Task & { _clippedStart?: number; _clippedEnd?: number };
  dayStart: number;
  projectColor?: string;
  isHighlighted?: boolean;
  onClick: () => void;
}) {
  const start = task._clippedStart ?? task.startTime!;
  const end = task._clippedEnd ?? task.endTime!;
  const { top, height } = calculateEventPosition(start, end, dayStart);
  const color = task.status === "done" ? "#10B981" : (projectColor || "#6366f1");

  const typeLabel =
    task.type === "shortterm"
      ? "事件"
      : task.type === "daily"
        ? "琐事"
        : task.type === "longterm"
          ? "目标"
          : "习惯";

  return (
    <div
      id={`event-block-${task.id}`}
      onClick={onClick}
      className={`absolute rounded-xl cursor-pointer transition-all duration-150 hover:brightness-95 hover:shadow-md active:scale-[0.98] overflow-hidden ${
        task.status === "done" ? "opacity-50" : ""
      } ${isHighlighted ? "ring-2 ring-indigo-400 shadow-lg" : ""}`}
      style={{
        top: `${top}px`,
        height: `${Math.max(height, 48)}px`,
        left: "60px",
        right: "16px",
        backgroundColor: `${color}1A`,
        border: `1px solid ${color}4D`,
        padding: "6px 8px",
      }}
    >
      <div className="flex items-center gap-1.5">
        <span
          className="text-[10px] font-medium px-1.5 py-0.5 rounded-md flex-shrink-0"
          style={{ backgroundColor: `${color}33`, color }}
        >
          {typeLabel}
        </span>
        <p
          className="text-xs font-medium truncate flex-1"
          style={{ color }}
        >
          {task.status === "done" && "✓ "}
          {task.title}
        </p>
      </div>
      <p className="text-[10px] text-gray-400 mt-0.5">
        {formatTime(start)} - {formatTime(end)}
      </p>
    </div>
  );
}

function TimelineGridLines() {
  const hours = Array.from({ length: 24 }, (_, i) => i);

  return (
    <div className="absolute inset-0 pointer-events-none">
      {hours.map((hour) => (
        <div
          key={hour}
          className="absolute right-0"
          style={{ top: `${hour * PIXELS_PER_HOUR}px`, left: "56px" }}
        >
          <div className="border-t border-gray-200 dark:border-gray-800 w-full" />
          {[1, 2, 3].map((i) => (
            <div
              key={i}
              className="border-t border-gray-100 dark:border-gray-800/50 border-dashed w-full absolute"
              style={{ top: `${i * SLOT_HEIGHT}px` }}
            />
          ))}
        </div>
      ))}
    </div>
  );
}

function TimeColumn() {
  const hours = Array.from({ length: 24 }, (_, i) => i);

  return (
    <div className="absolute left-0 top-0" style={{ width: "56px" }}>
      {hours.map((hour) => (
        <div
          key={hour}
          className="absolute right-2 text-[11px] text-gray-400 dark:text-gray-500"
          style={{
            top: `${hour * PIXELS_PER_HOUR}px`,
            transform: "translateY(-50%)",
          }}
        >
          {`${pad(hour)}:00`}
        </div>
      ))}
    </div>
  );
}

function TaskListItem({
  task,
  projectColor,
  isHighlighted,
  onClick,
}: {
  task: Task;
  projectColor?: string;
  isHighlighted?: boolean;
  onClick: () => void;
}) {
  const color = projectColor || "#6366f1";

  return (
    <div
      id={`event-list-item-${task.id}`}
      onClick={onClick}
      className={`flex items-center gap-3 px-3 py-2.5 rounded-xl cursor-pointer transition-all ${
        isHighlighted ? "bg-indigo-50 dark:bg-indigo-900/30 ring-2 ring-indigo-100 dark:ring-indigo-800" : "hover:bg-gray-50 dark:hover:bg-gray-900"
      } ${task.status === "done" ? "opacity-50" : ""}`}
    >
      <div
        className="w-1 h-8 rounded-full flex-shrink-0"
        style={{ backgroundColor: color }}
      />
      <div className="flex-1 min-w-0">
        <p className={`text-sm truncate ${task.status === "done" ? "line-through text-gray-400" : "text-gray-900 dark:text-gray-100"}`}>
          {task.title}
        </p>
        {(task.startTime && task.endTime) && (
          <p className="text-xs text-gray-400 dark:text-gray-500">
            {formatTime(task.startTime)} - {formatTime(task.endTime)}
          </p>
        )}
      </div>
      {task.status === "done" && (
        <span className="text-xs font-medium text-emerald-500 bg-emerald-50 dark:bg-emerald-900/20 px-2 py-0.5 rounded-full flex-shrink-0">
          已完成
        </span>
      )}
    </div>
  );
}

export default function TodayPage() {
  const searchParams = useSearchParams();
  const router = useRouter();

  const dateParam = searchParams.get("date");
  const currentDate = useMemo(() => {
    if (dateParam) {
      const [y, m, d] = dateParam.split("-").map(Number);
      if (y && m && d) return new Date(y, m - 1, d);
    }
    return new Date();
  }, [dateParam]);

  const dayStart = getDayStart(currentDate.getTime());
  const dayEnd = getDayEnd(currentDate.getTime());

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [highlightedId, setHighlightedId] = useState<number | null>(null);

  const projectColorMap = useMemo(() => {
    const map = new Map<string, string>();
    for (const p of projects) map.set(p.id, p.color);
    return map;
  }, [projects]);

  const loadData = useCallback(async () => {
    setLoading(true);
    setError(false);
    try {
      const [fetchedTasks, fetchedProjects] = await Promise.all([
        getTasksByTimeRange(dayStart, dayEnd),
        getAllProjects(),
      ]);
      setTasks(fetchedTasks.filter((t) => t.status !== "archived" && t.startTime && t.endTime));
      setProjects(fetchedProjects);
    } catch {
      setError(true);
    } finally {
      setLoading(false);
    }
  }, [dayStart, dayEnd]);

  useEffect(() => {
    const load = async () => { await loadData(); };
    load();
  }, [loadData]);

  const goToDate = useCallback(
    (d: Date) => {
      const formatted = `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
      router.push(`/today?date=${formatted}`);
    },
    [router]
  );

  const goPrevDay = useCallback(() => {
    const prev = new Date(currentDate);
    prev.setDate(prev.getDate() - 1);
    goToDate(prev);
  }, [currentDate, goToDate]);

  const goNextDay = useCallback(() => {
    const next = new Date(currentDate);
    next.setDate(next.getDate() + 1);
    goToDate(next);
  }, [currentDate, goToDate]);

  const goToday = useCallback(() => {
    const today = new Date();
    const formatted = `${today.getFullYear()}-${pad(today.getMonth() + 1)}-${pad(today.getDate())}`;
    router.push(`/today?date=${formatted}`);
  }, [router]);

  const scrollToCurrentTime = useCallback(() => {
    const pos = calculateCurrentTimePosition();
    const scrollContainer = document.querySelector(".today-timeline-scroll");
    if (scrollContainer) {
      const targetScroll = Math.max(0, pos - scrollContainer.clientHeight / 3);
      scrollContainer.scrollTo({ top: targetScroll, behavior: "smooth" });
    }
  }, []);

  useEffect(() => {
    const todayStart = getDayStart(Date.now());
    if (dayStart === todayStart) {
      const timer = setTimeout(scrollToCurrentTime, 300);
      return () => clearTimeout(timer);
    }
  }, [dayStart, scrollToCurrentTime]);

  const handleBlockClick = useCallback((taskId: number) => {
    const listItem = document.getElementById(`event-list-item-${taskId}`);
    if (listItem) {
      listItem.scrollIntoView({ behavior: "smooth", block: "center" });
      setHighlightedId(taskId);
      setTimeout(() => setHighlightedId(null), 2000);
    }
  }, []);

  const handleListItemClick = useCallback((taskId: number) => {
    const block = document.getElementById(`event-block-${taskId}`);
    if (block) {
      block.scrollIntoView({ behavior: "smooth", block: "center" });
      setHighlightedId(taskId);
      setTimeout(() => setHighlightedId(null), 2000);
    }
  }, []);

  const [isToday, setIsToday] = useState(false);
  const [showNewDayBanner, setShowNewDayBanner] = useState(false);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setIsToday(dayStart === getDayStart(Date.now()));
  }, [dayStart]);

  useEffect(() => {
    if (!isToday) return;
    const checkDay = () => {
      if (getDayStart(Date.now()) !== dayStart) {
        setShowNewDayBanner(true);
        setTimeout(() => setShowNewDayBanner(false), 5000);
        goToday();
      }
    };
    const interval = setInterval(checkDay, 60000);
    return () => clearInterval(interval);
  }, [isToday, dayStart, goToday]);

  const clippedTasks = tasks
    .filter((t) => t.type === "shortterm" || t.type === "daily")
    .map((t) => {
      const { startTime, endTime } = getDayClippedEvent(t, dayStart);
      return { ...t, _clippedStart: startTime, _clippedEnd: endTime };
    })
    .sort((a, b) => (a._clippedStart ?? 0) - (b._clippedStart ?? 0));

  const allDone = clippedTasks.length > 0 && clippedTasks.every((t) => t.status === "done");
  const [allDoneBannerShrunk, setAllDoneBannerShrunk] = useState(false);

  useEffect(() => {
    if (allDone) {
      const timer = setTimeout(() => setAllDoneBannerShrunk(true), 5000);
      return () => clearTimeout(timer);
    }
    requestAnimationFrame(() => setAllDoneBannerShrunk(false));
  }, [allDone]);

  if (error) return <ErrorState onRetry={loadData} />;
  if (loading) return <LoadingSkeleton />;

  return (
    <div className="flex flex-col h-full max-h-screen max-w-4xl mx-auto">
      <div className="flex-shrink-0 sticky top-0 z-30 bg-white/95 dark:bg-gray-900/95 backdrop-blur border-b border-gray-100 dark:border-gray-800">
        <div className="flex items-center justify-between px-4 py-3">
          <button
            onClick={goPrevDay}
            aria-label="前一天"
            className="w-9 h-9 flex items-center justify-center rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
          >
            <ChevronLeft className="w-5 h-5 text-gray-600 dark:text-gray-400" />
          </button>

          <div className="text-center">
            <p className="text-base font-semibold text-gray-900 dark:text-gray-100">
              {formatDateLabel(currentDate)}
            </p>
            {!isToday && (
              <button
                onClick={goToday}
                aria-label="回到今天"
                className="text-xs text-indigo-600 dark:text-indigo-400 hover:underline mt-0.5"
              >
                回到今天
              </button>
            )}
          </div>

          <button
            onClick={goNextDay}
            aria-label="后一天"
            className="w-9 h-9 flex items-center justify-center rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
          >
            <ChevronRight className="w-5 h-5 text-gray-600 dark:text-gray-400" />
          </button>
        </div>
      </div>

      <AnimatePresence>
        {showNewDayBanner && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            className="overflow-hidden"
          >
            <div className="px-4 py-2.5 bg-indigo-50 dark:bg-indigo-900/30 border-b border-indigo-100 dark:border-indigo-800 flex items-center gap-2">
              <Zap className="w-4 h-4 text-indigo-500" />
              <span className="text-sm font-medium text-indigo-700 dark:text-indigo-300">
                新的一天开始了
              </span>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {allDone && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            className="overflow-hidden"
          >
            <div className={`px-4 flex items-center gap-2 transition-all duration-500 ${
              allDoneBannerShrunk ? "py-1.5" : "py-2.5"
            } bg-emerald-50 dark:bg-emerald-900/20 border-b border-emerald-100 dark:border-emerald-800`}>
              <span className={`font-medium text-emerald-700 dark:text-emerald-300 transition-all ${
                allDoneBannerShrunk ? "text-xs" : "text-sm"
              }`}>
                {allDoneBannerShrunk ? "🎉" : "🎉 今日任务全部完成！"}
              </span>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {clippedTasks.length === 0 ? (
        <div className="flex-1 overflow-y-auto">
          <EmptyState />
        </div>
      ) : (
        <div className="flex-1 flex flex-col overflow-hidden">
          <div className="flex-1 overflow-y-auto today-timeline-scroll">
            <div className="relative" style={{ height: CONTAINER_HEIGHT }}>
              <TimelineGridLines />
              <TimeColumn />
              {isToday && <CurrentTimeIndicator dayStart={dayStart} />}

              {clippedTasks.map((task) => (
                <TimelineEventBlock
                  key={task.id}
                  task={task}
                  dayStart={dayStart}
                  projectColor={task.projectId ? projectColorMap.get(task.projectId) : undefined}
                  isHighlighted={highlightedId === task.id}
                  onClick={() => handleBlockClick(task.id!)}
                />
              ))}
            </div>
          </div>

          <div className="flex-shrink-0 border-t border-gray-100 dark:border-gray-800 max-h-[40vh] overflow-y-auto bg-white dark:bg-gray-900">
            <div className="px-4 py-2">
              <p className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-2">
                任务列表 ({clippedTasks.length})
              </p>
              <div className="space-y-1">
                {clippedTasks.map((task) => (
                  <TaskListItem
                    key={task.id}
                    task={task}
                    projectColor={task.projectId ? projectColorMap.get(task.projectId) : undefined}
                    isHighlighted={highlightedId === task.id}
                    onClick={() => handleListItemClick(task.id!)}
                  />
                ))}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
