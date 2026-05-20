"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { ArrowLeft, Plus, Minus, Check, Flame, Target } from "lucide-react";
import Link from "next/link";
import { showToast } from "@/components/ui/Toast";
import type { Task, HabitLog } from "@/lib/types";

const HABIT_FREQUENCIES = [
  { key: "daily", label: "每天", unit: "天" },
  { key: "weekly", label: "每周", unit: "周" },
  { key: "monthly", label: "每月", unit: "月" },
] as const;

interface HabitWithStats extends Task {
  streak?: number;
  bestStreak?: number;
  logsCount?: number;
  completionRate?: number;
}

export default function HabitPluginPage() {
  const router = useRouter();
  const [habits, setHabits] = useState<HabitWithStats[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAdd, setShowAdd] = useState(false);
  const [newTitle, setNewTitle] = useState("");
  const [newFrequency, setNewFrequency] = useState<"daily" | "weekly" | "monthly">("daily");
  const [newGoal, setNewGoal] = useState(1);

  const loadHabits = useCallback(async () => {
    try {
      const { db } = await import("@/lib/db");
      const allTasks = await db.tasks
        .filter((t) => t.type === "habit" && t.status === "active")
        .toArray();

      const habitsWithStats = await Promise.all(
        allTasks.map(async (habit) => {
          const logs = await db.habit_logs
            .where("taskId")
            .equals(habit.id!)
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

          const totalDays = habit.createdAt ? Math.floor((Date.now() - habit.createdAt) / (1000 * 60 * 60 * 24)) : 0;
          const completionRate = totalDays > 0 ? Math.round((dateGroups.size / totalDays) * 100) : 0;

          return {
            ...habit,
            streak,
            bestStreak,
            logsCount: logs.length,
            completionRate,
          };
        })
      );

      setHabits(habitsWithStats.sort((a, b) => b.createdAt - a.createdAt));
    } catch (err) {
      console.error("Failed to load habits:", err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadHabits();
  }, [loadHabits]);

  const handleCreateHabit = async () => {
    if (!newTitle.trim()) {
      showToast({ message: "请输入习惯名称", type: "error" });
      return;
    }

    try {
      const { db } = await import("@/lib/db");
      await db.tasks.add({
        title: newTitle.trim(),
        type: "habit",
        status: "active",
        frequency: newFrequency,
        requiredSegments: newGoal,
        createdAt: Date.now(),
        updatedAt: Date.now(),
      });
      showToast({ message: "习惯创建成功", type: "success" });
      setNewTitle("");
      setNewFrequency("daily");
      setNewGoal(1);
      setShowAdd(false);
      loadHabits();
    } catch {
      showToast({ message: "创建失败", type: "error" });
    }
  };

  const handleCheckIn = async (habit: HabitWithStats) => {
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

      loadHabits();
    } catch {
      showToast({ message: "打卡失败", type: "error" });
    }
  };

  const [todayCounts, setTodayCounts] = useState<Map<number, number>>(new Map());

  useEffect(() => {
    const loadTodayCounts = async () => {
      const { db } = await import("@/lib/db");
      const counts = new Map<number, number>();
      const today = new Date().toISOString().slice(0, 10);
      for (const habit of habits) {
        if (habit.id) {
          const log = await db.habit_logs
            .where(["taskId", "date"])
            .equals([habit.id, today])
            .first();
          counts.set(habit.id, log?.count || 0);
        }
      }
      setTodayCounts(counts);
    };
    if (habits.length > 0) {
      loadTodayCounts();
    }
  }, [habits]);

  if (loading) {
    return (
      <div className="flex flex-col h-full max-w-2xl mx-auto px-4 pt-6 pb-24">
        <div className="space-y-3">
          {[1, 2, 3].map((i) => (
            <div key={i} className="skeleton h-24 rounded-2xl" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full max-w-2xl mx-auto px-4 pt-6 pb-24">
      <div className="flex items-center gap-3 mb-6">
        <Link href="/plugins" className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800">
          <ArrowLeft className="w-5 h-5 text-gray-500" />
        </Link>
        <div className="flex items-center gap-2">
          <Flame className="w-6 h-6 text-orange-500" />
          <h1 className="text-xl font-bold text-gray-900 dark:text-white">习惯</h1>
        </div>
        <button
          onClick={() => setShowAdd(!showAdd)}
          className="ml-auto w-9 h-9 flex items-center justify-center rounded-xl bg-orange-500 text-white hover:bg-orange-600 transition-colors"
        >
          <Plus className="w-5 h-5" />
        </button>
      </div>

      <AnimatePresence>
        {showAdd && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            className="overflow-hidden mb-6"
          >
            <div className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-100 dark:border-gray-800 p-4 space-y-4">
              <div>
                <input
                  type="text"
                  value={newTitle}
                  onChange={(e) => setNewTitle(e.target.value)}
                  placeholder="习惯名称，例如：每天读书"
                  className="w-full px-4 py-2.5 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-sm text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-orange-500"
                />
              </div>
              <div>
                <p className="text-xs font-medium text-gray-500 dark:text-gray-400 mb-2">频率</p>
                <div className="grid grid-cols-3 gap-2">
                  {HABIT_FREQUENCIES.map(({ key, label }) => (
                    <button
                      key={key}
                      onClick={() => setNewFrequency(key)}
                      className={`py-2 rounded-xl text-xs font-medium border transition-colors ${
                        newFrequency === key
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
                <p className="text-xs font-medium text-gray-500 dark:text-gray-400 mb-2">目标次数/{newFrequency === "daily" ? "天" : newFrequency === "weekly" ? "周" : "月"}</p>
                <div className="flex items-center gap-3">
                  <button
                    onClick={() => setNewGoal(Math.max(1, newGoal - 1))}
                    className="w-8 h-8 flex items-center justify-center rounded-lg bg-gray-100 dark:bg-gray-800 text-gray-500 hover:bg-gray-200"
                  >
                    <Minus className="w-4 h-4" />
                  </button>
                  <span className="text-xl font-bold text-gray-700 dark:text-gray-300 w-8 text-center">{newGoal}</span>
                  <button
                    onClick={() => setNewGoal(newGoal + 1)}
                    className="w-8 h-8 flex items-center justify-center rounded-lg bg-gray-100 dark:bg-gray-800 text-gray-500 hover:bg-gray-200"
                  >
                    <Plus className="w-4 h-4" />
                  </button>
                </div>
              </div>
              <div className="flex gap-3">
                <button
                  onClick={() => setShowAdd(false)}
                  className="flex-1 py-2.5 rounded-xl border border-gray-200 dark:border-gray-700 text-sm text-gray-500"
                >
                  取消
                </button>
                <button
                  onClick={handleCreateHabit}
                  className="flex-1 py-2.5 rounded-xl bg-orange-500 text-white text-sm font-medium hover:bg-orange-600 transition-colors"
                >
                  创建习惯
                </button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <div className="space-y-3">
        {habits.length === 0 && !showAdd && (
          <div className="flex flex-col items-center justify-center py-16 text-center">
            <Flame className="w-12 h-12 text-gray-300 dark:text-gray-600 mb-4" />
            <p className="text-gray-500 dark:text-gray-400">暂无习惯</p>
            <p className="text-xs text-gray-400 dark:text-gray-500 mt-1">点击右上角 + 按钮创建新习惯</p>
          </div>
        )}

        {habits.map((habit) => {
          const todayCount = todayCounts.get(habit.id!) || 0;
          const goal = habit.requiredSegments || 1;
          const completed = todayCount >= goal;

          return (
            <div
              key={habit.id}
              className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-100 dark:border-gray-800 overflow-hidden cursor-pointer hover:border-orange-200 dark:hover:border-orange-800 transition-colors"
              onClick={() => router.push(`/plugins/habit/detail?id=${habit.id}`)}
            >
              <div className="p-4">
                <div className="flex items-start gap-3">
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-gray-700 dark:text-gray-300">{habit.title}</p>
                    <div className="flex items-center gap-3 mt-1.5">
                      <span className="flex items-center gap-1 text-[10px] text-orange-500">
                        <Target className="w-3 h-3" />
                        {goal}次/{habit.frequency === "daily" ? "天" : habit.frequency === "weekly" ? "周" : "月"}
                      </span>
                      {habit.streak !== undefined && habit.streak > 0 && (
                        <span className="flex items-center gap-1 text-[10px] text-amber-500">
                          <Flame className="w-3 h-3" />
                          连续{habit.streak}天
                        </span>
                      )}
                    </div>
                  </div>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      handleCheckIn(habit);
                    }}
                    className={`w-10 h-10 rounded-xl flex items-center justify-center transition-colors ${
                      completed
                        ? "bg-emerald-100 dark:bg-emerald-900/30 text-emerald-500"
                        : "bg-orange-100 dark:bg-orange-900/30 text-orange-500 hover:bg-orange-200"
                    }`}
                  >
                    {completed ? <Check className="w-5 h-5" /> : <Flame className="w-5 h-5" />}
                  </button>
                </div>

                <div className="mt-3">
                  <div className="flex items-center justify-between text-xs text-gray-400 mb-1">
                    <span>今日进度</span>
                    <span>{todayCount}/{goal}</span>
                  </div>
                  <div className="h-1.5 bg-gray-100 dark:bg-gray-800 rounded-full overflow-hidden">
                    <div
                      className={`h-full rounded-full transition-all ${completed ? "bg-emerald-500" : "bg-orange-500"}`}
                      style={{ width: `${Math.min(100, (todayCount / goal) * 100)}%` }}
                    />
                  </div>
                </div>
              </div>

              <div className="px-4 py-3 bg-gray-50 dark:bg-gray-800/50 border-t border-gray-100 dark:border-gray-800">
                <div className="grid grid-cols-4 gap-2 text-center">
                  <div>
                    <p className="text-lg font-bold text-orange-500">{habit.streak || 0}</p>
                    <p className="text-[10px] text-gray-400">连续天数</p>
                  </div>
                  <div>
                    <p className="text-lg font-bold text-amber-500">{habit.bestStreak || 0}</p>
                    <p className="text-[10px] text-gray-400">最佳连续</p>
                  </div>
                  <div>
                    <p className="text-lg font-bold text-blue-500">{habit.logsCount || 0}</p>
                    <p className="text-[10px] text-gray-400">总打卡</p>
                  </div>
                  <div>
                    <p className="text-lg font-bold text-cyan-500">{habit.completionRate || 0}%</p>
                    <p className="text-[10px] text-gray-400">完成率</p>
                  </div>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
