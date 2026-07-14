"use client";

import { useState, useEffect, useCallback, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import {
  ArrowLeft,
  Flame,
  Check,
  Plus,
  Minus,
  Edit2,
  Trash2,
  Calendar,
  Target,
  X,
} from "lucide-react";
import Link from "next/link";
import { showToast } from "@/components/ui/Toast";
import type { Task, HabitLog } from "@/lib/types";

const HABIT_FREQUENCIES = [
  { key: "daily", label: "每天" },
  { key: "weekly", label: "每周" },
  { key: "monthly", label: "每月" },
] as const;

function getLocalDateStr(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function HabitHeatmap({ logs, taskId }: { logs: HabitLog[]; taskId: number }) {
  const [dates, setDates] = useState<Set<string>>(new Set());
  const [counts, setCounts] = useState<Map<string, number>>(new Map());

  useEffect(() => {
    const dateSet = new Set<string>();
    const countMap = new Map<string, number>();
    logs.forEach((log) => {
      const dateStr = log.date || new Date(log.createdAt).toISOString().slice(0, 10);
      dateSet.add(dateStr);
      countMap.set(dateStr, (countMap.get(dateStr) || 0) + log.count);
    });
    setDates(dateSet);
    setCounts(countMap);
  }, [logs]);

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
  const MONTH_HEIGHT = 14;

  const cells: { date?: Date; dateStr: string; checked: boolean; isToday: boolean; isFuture: boolean; count?: number }[][] = Array(ROWS)
    .fill(null)
    .map(() => Array(COLS).fill(null));

  let cellDate = new Date(startDate);
  cellDate.setDate(startDate.getDate() - cellDate.getDay());

  for (let col = 0; col < COLS; col++) {
    for (let row = 0; row < ROWS; row++) {
      const isFuture = cellDate > today;
      const dateStr = getLocalDateStr(cellDate);
      cells[row][col] = {
        date: isFuture ? undefined : new Date(cellDate),
        dateStr,
        checked: dates.has(dateStr),
        isToday: dateStr === todayStr,
        isFuture,
        count: counts.get(dateStr),
      };
      cellDate.setDate(cellDate.getDate() + 1);
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

  const getIntensityClass = (cell: typeof cells[0][0]) => {
    if (!cell.checked) {
      return cell.isToday ? "fill-amber-200 dark:fill-amber-800" : "fill-gray-100 dark:fill-gray-800";
    }
    const count = cell.count || 1;
    if (count >= 5) return "fill-emerald-500";
    if (count >= 3) return "fill-emerald-400";
    if (count >= 2) return "fill-emerald-300";
    return "fill-amber-500";
  };

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

      <text
        x="0"
        y={MONTH_HEIGHT + 6}
        className="fill-gray-400 dark:fill-gray-500"
        fontSize="8"
        textAnchor="start"
        style={{ writingMode: "vertical-rl" }}
      >
        周
      </text>

      {cells.map((row, rowIdx) =>
        row.map((cell, colIdx) => (
          <g key={`${rowIdx}-${colIdx}`}>
            {cell.date && (
              <rect
                x={LABEL_WIDTH + colIdx * (CELL_SIZE + GAP)}
                y={MONTH_HEIGHT + rowIdx * (CELL_SIZE + GAP)}
                width={CELL_SIZE}
                height={CELL_SIZE}
                rx="2"
                className={getIntensityClass(cell)}
              >
                <title>
                  {cell.dateStr}
                  {cell.checked ? ` 已打卡${cell.count ? ` (${cell.count}次)` : ""}` : ""}
                </title>
              </rect>
            )}
          </g>
        ))
      )}
    </svg>
  );
}

function CalendarView({ logs }: { logs: HabitLog[] }) {
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [logMap, setLogMap] = useState<Map<string, HabitLog>>(new Map());

  useEffect(() => {
    const map = new Map<string, HabitLog>();
    logs.forEach((log) => {
      const dateStr = log.date || new Date(log.createdAt).toISOString().slice(0, 10);
      map.set(dateStr, log);
    });
    setLogMap(map);
  }, [logs]);

  const year = currentMonth.getFullYear();
  const month = currentMonth.getMonth();

  const firstDay = new Date(year, month, 1);
  const lastDay = new Date(year, month + 1, 0);
  const startDay = firstDay.getDay();
  const daysInMonth = lastDay.getDate();

  const prevMonth = () => {
    setCurrentMonth(new Date(year, month - 1, 1));
  };

  const nextMonth = () => {
    setCurrentMonth(new Date(year, month + 1, 1));
  };

  const today = new Date();
  const todayStr = getLocalDateStr(today);

  const days = [];
  for (let i = 0; i < startDay; i++) {
    days.push(null);
  }
  for (let i = 1; i <= daysInMonth; i++) {
    days.push(i);
  }

  return (
    <div className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-100 dark:border-gray-800 p-4">
      <div className="flex items-center justify-between mb-4">
        <button
          onClick={prevMonth}
          className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800"
        >
          <ArrowLeft className="w-4 h-4 text-gray-500" />
        </button>
        <h3 className="text-sm font-medium text-gray-700 dark:text-gray-300">
          {year}年{month + 1}月
        </h3>
        <button
          onClick={nextMonth}
          className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800"
        >
          <ArrowLeft className="w-4 h-4 text-gray-500 rotate-180" />
        </button>
      </div>

      <div className="grid grid-cols-7 gap-1 text-center mb-2">
        {["日", "一", "二", "三", "四", "五", "六"].map((day) => (
          <div key={day} className="text-xs text-gray-400 py-1">
            {day}
          </div>
        ))}
      </div>

      <div className="grid grid-cols-7 gap-1">
        {days.map((day, idx) => {
          if (day === null) {
            return <div key={`empty-${idx}`} className="aspect-square" />;
          }
          const dateStr = `${year}-${String(month + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
          const log = logMap.get(dateStr);
          const isToday = dateStr === todayStr;
          const isFuture = new Date(dateStr) > today;

          return (
            <div
              key={day}
              className={`aspect-square flex items-center justify-center rounded-lg text-xs relative ${
                isToday
                  ? "bg-orange-100 dark:bg-orange-900/30 text-orange-600 font-medium"
                  : log
                  ? "bg-emerald-100 dark:bg-emerald-900/30 text-emerald-600"
                  : isFuture
                  ? "text-gray-300 dark:text-gray-600"
                  : "text-gray-600 dark:text-gray-400"
              }`}
            >
              {day}
              {log && (
                <span className="absolute bottom-0.5 left-1/2 -translate-x-1/2 w-1 h-1 bg-emerald-500 rounded-full" />
              )}
            </div>
          );
        })}
      </div>

      <div className="mt-3 flex items-center justify-center gap-4 text-xs text-gray-400">
        <span className="flex items-center gap-1">
          <span className="w-2 h-2 bg-emerald-500 rounded-full" /> 已打卡
        </span>
        <span className="flex items-center gap-1">
          <span className="w-2 h-2 bg-orange-100 dark:bg-orange-900/30 rounded-full" /> 今天
        </span>
      </div>
    </div>
  );
}

interface HabitWithStats extends Task {
  streak?: number;
  bestStreak?: number;
  logsCount?: number;
  completionRate?: number;
  logs?: HabitLog[];
}

function HabitDetailContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const habitId = searchParams.get("id");

  const [habit, setHabit] = useState<HabitWithStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [showEdit, setShowEdit] = useState(false);
  const [editTitle, setEditTitle] = useState("");
  const [editFrequency, setEditFrequency] = useState<"daily" | "weekly" | "monthly">("daily");
  const [editGoal, setEditGoal] = useState(1);
  const [todayCount, setTodayCount] = useState(0);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [activeTab, setActiveTab] = useState<"heatmap" | "calendar">("heatmap");

  const loadHabit = useCallback(async () => {
    if (!habitId) return;

    try {
      const { db } = await import("@/lib/db");
      const task = await db.tasks.get(Number(habitId));

      if (!task) {
        showToast({ message: "习惯不存在", type: "error" });
        router.push("/plugins/habit");
        return;
      }

      const logs = await db.habit_logs
        .where("taskId")
        .equals(Number(habitId))
        .toArray();

      const sortedLogs = logs.sort((a: HabitLog, b: HabitLog) => b.createdAt - a.createdAt);

      let streak = 0;
      let bestStreak = 0;
      const dateGroups = new Map<string, number>();
      sortedLogs.forEach((log: HabitLog) => {
        const dateKey = log.date || new Date(log.createdAt).toISOString().slice(0, 10);
        dateGroups.set(dateKey, (dateGroups.get(dateKey) || 0) + log.count);
      });

      const sortedDates = Array.from(dateGroups.keys()).sort().reverse();
      let expectedDate = new Date();
      expectedDate.setHours(0, 0, 0, 0);

      for (const dateStr of sortedDates) {
        const logDate = new Date(dateStr);
        logDate.setHours(0, 0, 0, 0);
        const diffDays = Math.round((expectedDate.getTime() - logDate.getTime()) / (1000 * 60 * 60 * 24));

        if (diffDays <= 1) {
          streak++;
          expectedDate = logDate;
          expectedDate.setDate(expectedDate.getDate() - 1);
        } else {
          break;
        }
      }

      let tempStreak = 0;
      for (let i = 0; i < sortedDates.length; i++) {
        if (i === 0) {
          tempStreak = 1;
        } else {
          const prev = new Date(sortedDates[i - 1]);
          const curr = new Date(sortedDates[i]);
          const diff = Math.round((prev.getTime() - curr.getTime()) / (1000 * 60 * 60 * 24));
          if (diff === 1) {
            tempStreak++;
          } else {
            tempStreak = 1;
          }
        }
        bestStreak = Math.max(bestStreak, tempStreak);
      }

      const totalDays = task.createdAt ? Math.floor((Date.now() - task.createdAt) / (1000 * 60 * 60 * 24)) : 0;
      const completionRate = totalDays > 0 ? Math.round((dateGroups.size / totalDays) * 100) : 0;

      const today = new Date().toISOString().slice(0, 10);
      const todayLog = await db.habit_logs
        .where(["taskId", "date"])
        .equals([Number(habitId), today])
        .first();

      setHabit({
        ...task,
        streak,
        bestStreak,
        logsCount: logs.length,
        completionRate,
        logs,
      });

      setTodayCount(todayLog?.count || 0);
      setEditTitle(task.title);
      setEditFrequency((task.frequency as "daily" | "weekly" | "monthly") || "daily");
      setEditGoal(task.requiredSegments || 1);
    } catch (err) {
      console.error("Failed to load habit:", err);
      showToast({ message: "加载失败", type: "error" });
    } finally {
      setLoading(false);
    }
  }, [habitId, router]);

  useEffect(() => {
    loadHabit();
  }, [loadHabit]);

  const handleCheckIn = async () => {
    if (!habit) return;

    try {
      const { db } = await import("@/lib/db");
      const today = new Date().toISOString().slice(0, 10);

      const existingLog = await db.habit_logs
        .where(["taskId", "date"])
        .equals([habit.id!, today])
        .first();

      if (existingLog) {
        await db.habit_logs.update(existingLog.id!, {
          count: existingLog.count + 1,
        });
        showToast({ message: `打卡成功！今日第${existingLog.count + 1}次`, type: "success" });
      } else {
        await db.habit_logs.add({
          taskId: habit.id!,
          date: today,
          count: 1,
          createdAt: Date.now(),
        });
        showToast({ message: "打卡成功！", type: "success" });
      }

      loadHabit();
    } catch {
      showToast({ message: "打卡失败", type: "error" });
    }
  };

  const handleUpdateHabit = async () => {
    if (!habit || !editTitle.trim()) {
      showToast({ message: "请输入习惯名称", type: "error" });
      return;
    }

    try {
      const { db } = await import("@/lib/db");
      await db.tasks.update(habit.id!, {
        title: editTitle.trim(),
        frequency: editFrequency,
        requiredSegments: editGoal,
        updatedAt: Date.now(),
      });
      showToast({ message: "更新成功", type: "success" });
      setShowEdit(false);
      loadHabit();
    } catch {
      showToast({ message: "更新失败", type: "error" });
    }
  };

  const handleDeleteHabit = async () => {
    if (!habit) return;

    try {
      const { db } = await import("@/lib/db");
      await db.tasks.delete(habit.id!);
      await db.habit_logs.where("taskId").equals(habit.id!).delete();
      showToast({ message: "习惯已删除", type: "success" });
      router.push("/plugins/habit");
    } catch {
      showToast({ message: "删除失败", type: "error" });
    }
  };

  if (loading) {
    return (
      <div className="flex flex-col h-full max-w-2xl mx-auto px-4 pt-6">
        <div className="skeleton h-64 rounded-2xl" />
      </div>
    );
  }

  if (!habit) {
    return null;
  }

  const goal = habit.requiredSegments || 1;
  const completed = todayCount >= goal;

  return (
    <div className="flex flex-col h-full max-w-2xl mx-auto px-4 pt-6 pb-24">
      <div className="flex items-center gap-3 mb-6">
        <Link href="/plugins/habit" className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800">
          <ArrowLeft className="w-5 h-5 text-gray-500" />
        </Link>
        <div className="flex items-center gap-2">
          <Flame className="w-6 h-6 text-orange-500" />
          <h1 className="text-xl font-bold text-gray-900 dark:text-white">习惯详情</h1>
        </div>
        <div className="ml-auto flex items-center gap-2">
          <button
            onClick={() => setShowEdit(true)}
            className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 text-gray-500"
          >
            <Edit2 className="w-4 h-4" />
          </button>
          <button
            onClick={() => setShowDeleteConfirm(true)}
            className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-red-50 dark:hover:bg-red-900/20 text-gray-500 hover:text-red-500"
          >
            <Trash2 className="w-4 h-4" />
          </button>
        </div>
      </div>

      <div className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-100 dark:border-gray-800 p-5 mb-4">
        <div className="flex items-start gap-4">
          <div className="flex-1">
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">{habit.title}</h2>
            <div className="flex items-center gap-3 text-sm text-gray-500 dark:text-gray-400">
              <span className="flex items-center gap-1">
                <Target className="w-4 h-4" />
                {goal}次/{habit.frequency === "daily" ? "天" : habit.frequency === "weekly" ? "周" : "月"}
              </span>
              <span className="flex items-center gap-1">
                <Calendar className="w-4 h-4" />
                {HABIT_FREQUENCIES.find((f) => f.key === habit.frequency)?.label || "每天"}
              </span>
            </div>
          </div>
          <button
            onClick={handleCheckIn}
            className={`w-14 h-14 rounded-2xl flex flex-col items-center justify-center transition-colors ${
              completed
                ? "bg-emerald-100 dark:bg-emerald-900/30"
                : "bg-orange-100 dark:bg-orange-900/30"
            }`}
          >
            {completed ? (
              <Check className="w-6 h-6 text-emerald-500" />
            ) : (
              <Flame className="w-6 h-6 text-orange-500" />
            )}
            <span className={`text-[10px] mt-0.5 ${completed ? "text-emerald-500" : "text-orange-500"}`}>
              {completed ? "已完成" : "打卡"}
            </span>
          </button>
        </div>

        <div className="mt-4">
          <div className="flex items-center justify-between text-xs text-gray-400 mb-1">
            <span>今日进度</span>
            <span>{todayCount}/{goal}</span>
          </div>
          <div className="h-2 bg-gray-100 dark:bg-gray-800 rounded-full overflow-hidden">
            <div
              className={`h-full rounded-full transition-all ${completed ? "bg-emerald-500" : "bg-orange-500"}`}
              style={{ width: `${Math.min(100, (todayCount / goal) * 100)}%` }}
            />
          </div>
        </div>
      </div>

      <div className="grid grid-cols-4 gap-3 mb-6">
        <div className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-100 dark:border-gray-800 p-4 text-center">
          <p className="text-2xl font-bold text-orange-500">{habit.streak || 0}</p>
          <p className="text-xs text-gray-400 mt-1">连续天数</p>
        </div>
        <div className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-100 dark:border-gray-800 p-4 text-center">
          <p className="text-2xl font-bold text-amber-500">{habit.bestStreak || 0}</p>
          <p className="text-xs text-gray-400 mt-1">最佳连续</p>
        </div>
        <div className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-100 dark:border-gray-800 p-4 text-center">
          <p className="text-2xl font-bold text-blue-500">{habit.logsCount || 0}</p>
          <p className="text-xs text-gray-400 mt-1">总打卡</p>
        </div>
        <div className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-100 dark:border-gray-800 p-4 text-center">
          <p className="text-2xl font-bold text-cyan-500">{habit.completionRate || 0}%</p>
          <p className="text-xs text-gray-400 mt-1">完成率</p>
        </div>
      </div>

      <div className="flex gap-2 mb-4">
        <button
          onClick={() => setActiveTab("heatmap")}
          className={`flex-1 py-2 rounded-xl text-sm font-medium transition-colors ${
            activeTab === "heatmap"
              ? "bg-orange-100 dark:bg-orange-900/30 text-orange-600"
              : "bg-gray-100 dark:bg-gray-800 text-gray-500"
          }`}
        >
          热力图
        </button>
        <button
          onClick={() => setActiveTab("calendar")}
          className={`flex-1 py-2 rounded-xl text-sm font-medium transition-colors ${
            activeTab === "calendar"
              ? "bg-orange-100 dark:bg-orange-900/30 text-orange-600"
              : "bg-gray-100 dark:bg-gray-800 text-gray-500"
          }`}
        >
          日历
        </button>
      </div>

      <div className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-100 dark:border-gray-800 p-4 overflow-x-auto">
        {habit.logs && (
          activeTab === "heatmap" ? (
            <HabitHeatmap logs={habit.logs} taskId={habit.id!} />
          ) : (
            <CalendarView logs={habit.logs} />
          )
        )}
      </div>

      <AnimatePresence>
        {showEdit && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 bg-black/50 flex items-end justify-center"
            style={{ paddingBottom: "var(--bottom-nav-height)" }}
            onClick={() => setShowEdit(false)}
          >
            <motion.div
              initial={{ y: "100%" }}
              animate={{ y: 0 }}
              exit={{ y: "100%" }}
              transition={{ type: "spring", damping: 25, stiffness: 300 }}
              className="bg-white dark:bg-gray-900 rounded-t-3xl w-full max-w-2xl p-6"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-center justify-between mb-6">
                <h3 className="text-lg font-semibold text-gray-900 dark:text-white">编辑习惯</h3>
                <button
                  onClick={() => setShowEdit(false)}
                  className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800"
                >
                  <X className="w-5 h-5 text-gray-500" />
                </button>
              </div>

              <div className="space-y-4">
                <div>
                  <label className="text-xs font-medium text-gray-500 dark:text-gray-400 mb-1.5 block">习惯名称</label>
                  <input
                    type="text"
                    value={editTitle}
                    onChange={(e) => setEditTitle(e.target.value)}
                    placeholder="习惯名称"
                    className="w-full px-4 py-2.5 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-sm text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-orange-500"
                  />
                </div>

                <div>
                  <label className="text-xs font-medium text-gray-500 dark:text-gray-400 mb-1.5 block">频率</label>
                  <div className="grid grid-cols-3 gap-2">
                    {HABIT_FREQUENCIES.map(({ key, label }) => (
                      <button
                        key={key}
                        onClick={() => setEditFrequency(key)}
                        className={`py-2.5 rounded-xl text-sm font-medium border transition-colors ${
                          editFrequency === key
                            ? "bg-orange-100 dark:bg-orange-900/30 text-orange-600 border-orange-300"
                            : "bg-gray-50 dark:bg-gray-800 text-gray-500 border-gray-200 dark:border-gray-700"
                        }`}
                      >
                        {label}
                      </button>
                    ))}
                  </div>
                </div>

                <div>
                  <label className="text-xs font-medium text-gray-500 dark:text-gray-400 mb-1.5 block">
                    目标次数/{editFrequency === "daily" ? "天" : editFrequency === "weekly" ? "周" : "月"}
                  </label>
                  <div className="flex items-center gap-4">
                    <button
                      onClick={() => setEditGoal(Math.max(1, editGoal - 1))}
                      className="w-10 h-10 flex items-center justify-center rounded-xl bg-gray-100 dark:bg-gray-800 text-gray-500 hover:bg-gray-200"
                    >
                      <Minus className="w-5 h-5" />
                    </button>
                    <span className="text-2xl font-bold text-gray-700 dark:text-gray-300 w-12 text-center">{editGoal}</span>
                    <button
                      onClick={() => setEditGoal(editGoal + 1)}
                      className="w-10 h-10 flex items-center justify-center rounded-xl bg-gray-100 dark:bg-gray-800 text-gray-500 hover:bg-gray-200"
                    >
                      <Plus className="w-5 h-5" />
                    </button>
                  </div>
                </div>

                <div className="flex gap-3 pt-2">
                  <button
                    onClick={() => setShowEdit(false)}
                    className="flex-1 py-3 rounded-xl border border-gray-200 dark:border-gray-700 text-sm text-gray-500 hover:bg-gray-50 dark:hover:bg-gray-800"
                  >
                    取消
                  </button>
                  <button
                    onClick={handleUpdateHabit}
                    className="flex-1 py-3 rounded-xl bg-orange-500 text-white text-sm font-medium hover:bg-orange-600 transition-colors"
                  >
                    保存
                  </button>
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {showDeleteConfirm && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4"
            onClick={() => setShowDeleteConfirm(false)}
          >
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="bg-white dark:bg-gray-900 rounded-2xl w-full max-w-sm p-6"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="w-12 h-12 rounded-full bg-red-100 dark:bg-red-900/30 flex items-center justify-center mx-auto mb-4">
                <Trash2 className="w-6 h-6 text-red-500" />
              </div>
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white text-center mb-2">删除习惯</h3>
              <p className="text-sm text-gray-500 dark:text-gray-400 text-center mb-6">
                确定要删除习惯「{habit.title}」吗？此操作不可恢复，打卡记录也将被删除。
              </p>
              <div className="flex gap-3">
                <button
                  onClick={() => setShowDeleteConfirm(false)}
                  className="flex-1 py-2.5 rounded-xl border border-gray-200 dark:border-gray-700 text-sm text-gray-500"
                >
                  取消
                </button>
                <button
                  onClick={handleDeleteHabit}
                  className="flex-1 py-2.5 rounded-xl bg-red-500 text-white text-sm font-medium hover:bg-red-600"
                >
                  删除
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

export default function HabitDetailPage() {
  return (
    <Suspense fallback={<div className="flex flex-col h-full max-w-2xl mx-auto px-4 pt-6"><div className="skeleton h-64 rounded-2xl" /></div>}>
      <HabitDetailContent />
    </Suspense>
  );
}
