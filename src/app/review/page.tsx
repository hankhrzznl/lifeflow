"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import { motion } from "framer-motion";
import {
  BarChart3, CheckCheck, ListTodo, Flame, Timer, Wallet,
  TrendingUp, Inbox, ClipboardList, Target,
} from "lucide-react";
import {
  initBuiltInPlugins,
  getMonthlyTaskStats, getMonthlyHabitStats, getMonthlyFinanceStats,
  getWeeklyTaskStats, getActiveSchedulableTasks, getReviewRecords,
  createReviewRecord, getReviewRecordByKey,
} from "@/lib/db";
import { showToast } from "@/components/ui/Toast";
import type { ReviewRecord, Task } from "@/lib/types";

type ReviewTab = "daily" | "weekly" | "monthly";

function getTodayStr(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function getWeekKey(d: Date): string {
  const start = new Date(d);
  start.setDate(d.getDate() - d.getDay());
  return `${start.getFullYear()}-W${String(Math.ceil((start.getDate() - 1 + start.getDay()) / 7) + 1).padStart(2, "0")}`;
}

function getMonthKey(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

export default function ReviewPage() {
  const [tab, setTab] = useState<ReviewTab>("daily");
  const [loading, setLoading] = useState(true);

  const [taskStats, setTaskStats] = useState({ completed: 0, active: 0, new: 0 });
  const [habitStats, setHabitStats] = useState({ completed: 0, total: 0, streak: 0 });
  const [financeStats, setFinanceStats] = useState({ income: 0, expense: 0, balance: 0 });
  const [weeklyDone, setWeeklyDone] = useState(0);
  const [weeklyPending, setWeeklyPending] = useState(0);
  const [pendingTasks, setPendingTasks] = useState<Task[]>([]);
  const [summary, setSummary] = useState("");
  const [savedRecord, setSavedRecord] = useState<ReviewRecord | null>(null);
  const [prevMonthRecord, setPrevMonthRecord] = useState<ReviewRecord | null>(null);

  const now = new Date();
  const currentYear = now.getFullYear();
  const currentMonth = now.getMonth() + 1;

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      await initBuiltInPlugins();

      const [monthTasks, monthHabits, monthFinance, weekTasks, pending] =
        await Promise.all([
          getMonthlyTaskStats(currentYear, currentMonth),
          getMonthlyHabitStats(currentYear, currentMonth),
          getMonthlyFinanceStats(currentYear, currentMonth),
          getWeeklyTaskStats(),
          getActiveSchedulableTasks(),
        ]);

      setTaskStats(monthTasks);
      setHabitStats(monthHabits);
      setFinanceStats(monthFinance);
      setWeeklyDone(weekTasks.completed);
      setWeeklyPending(weekTasks.active);
      setPendingTasks(pending.slice(0, 10));

      const todayKey = getTodayStr();
      const existingDaily = await getReviewRecordByKey(todayKey);
      if (existingDaily) {
        setSavedRecord(existingDaily);
        setSummary(existingDaily.summary || "");
      }

      if (tab === "monthly") {
        const prevKey = `${currentMonth === 1 ? currentYear - 1 : currentYear}-${String(currentMonth === 1 ? 12 : currentMonth - 1).padStart(2, "0")}`;
        const prev = await getReviewRecordByKey(prevKey);
        setPrevMonthRecord(prev || null);
      }
    } catch { /* ignore */ }
    finally { setLoading(false); }
  }, [currentYear, currentMonth, tab]);

  useEffect(() => { loadData(); }, [loadData]);

  const handleSaveRecord = async () => {
    try {
      const key = tab === "daily" ? getTodayStr() : tab === "weekly" ? getWeekKey(now) : getMonthKey(now);
      await createReviewRecord({
        type: tab === "weekly" ? "weekly" : tab === "monthly" ? "monthly" : "daily",
        dateKey: key,
        summary: summary || undefined,
        stats: {
          tasksDone: tab === "daily" ? weeklyDone : taskStats.completed,
          tasksPending: tab === "daily" ? weeklyPending : taskStats.active,
          tasksOverdue: 0,
          habitStreaks: habitStats.completed,
          focusMinutes: 0,
          financeIncome: financeStats.income,
          financeExpense: financeStats.expense,
        },
      });
      showToast({ message: "回顾已保存", type: "success" });
      const r = await getReviewRecordByKey(key);
      if (r) setSavedRecord(r);
    } catch {
      showToast({ message: "保存失败", type: "error" });
    }
  };

  if (loading) {
    return (
      <div className="flex flex-col h-full max-w-2xl mx-auto px-4 pt-6 pb-24">
        <h1 className="text-xl font-bold text-gray-900 dark:text-gray-100 mb-5">回顾</h1>
        <div className="space-y-3">{[1,2,3,4].map((i) => <div key={i} className="skeleton h-24 rounded-xl" />)}</div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full max-w-2xl mx-auto px-4 pt-6 pb-24">
      <h1 className="text-xl font-bold text-gray-900 dark:text-gray-100 mb-4">回顾</h1>

      <div className="flex border-b border-gray-200 dark:border-gray-800 mb-4">
        {([
          { key: "daily" as const, label: "日回顾" },
          { key: "weekly" as const, label: "周回顾" },
          { key: "monthly" as const, label: "月复盘" },
        ]).map(({ key, label }) => (
          <button key={key} onClick={() => setTab(key)}
            className={`flex-1 py-2.5 text-sm font-medium border-b-2 transition-colors ${tab === key ? "text-indigo-600 border-indigo-600" : "text-gray-500 border-transparent hover:text-gray-700"}`}>
            {label}
          </button>
        ))}
      </div>

      <div className="flex-1 overflow-y-auto space-y-4">
        {/* Daily Review */}
        {tab === "daily" && (
          <>
            <div className="grid grid-cols-2 gap-3">
              <div className="bg-white dark:bg-gray-900 rounded-2xl p-4 border border-gray-100 dark:border-gray-800">
                <div className="flex items-center gap-2 mb-1">
                  <CheckCheck className="w-4 h-4 text-emerald-500" />
                  <span className="text-xs text-gray-500">本周完成</span>
                </div>
                <p className="text-2xl font-bold text-gray-900 dark:text-gray-100">{weeklyDone}</p>
              </div>
              <div className="bg-white dark:bg-gray-900 rounded-2xl p-4 border border-gray-100 dark:border-gray-800">
                <div className="flex items-center gap-2 mb-1">
                  <ListTodo className="w-4 h-4 text-amber-500" />
                  <span className="text-xs text-gray-500">待办</span>
                </div>
                <p className="text-2xl font-bold text-gray-900 dark:text-gray-100">{weeklyPending}</p>
              </div>
              <div className="bg-white dark:bg-gray-900 rounded-2xl p-4 border border-gray-100 dark:border-gray-800">
                <div className="flex items-center gap-2 mb-1">
                  <Flame className="w-4 h-4 text-orange-500" />
                  <span className="text-xs text-gray-500">习惯打卡</span>
                </div>
                <p className="text-2xl font-bold text-gray-900 dark:text-gray-100">{habitStats.completed}</p>
              </div>
              <div className="bg-white dark:bg-gray-900 rounded-2xl p-4 border border-gray-100 dark:border-gray-800">
                <div className="flex items-center gap-2 mb-1">
                  <Wallet className="w-4 h-4 text-blue-500" />
                  <span className="text-xs text-gray-500">今日支出</span>
                </div>
                <p className="text-2xl font-bold text-red-500">{financeStats.expense.toFixed(0)}</p>
              </div>
            </div>

            {pendingTasks.length > 0 && (
              <div className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-100 dark:border-gray-800 p-4">
                <div className="flex items-center gap-2 mb-3">
                  <Target className="w-4 h-4 text-indigo-500" />
                  <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300">明天待办预览</h3>
                </div>
                <div className="space-y-1">
                  {pendingTasks.slice(0, 5).map((t) => (
                    <div key={t.id} className="text-xs text-gray-500 truncate">· {t.title}</div>
                  ))}
                </div>
              </div>
            )}

            <div className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-100 dark:border-gray-800 p-4">
              <p className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">今日反思</p>
              <textarea
                value={summary}
                onChange={(e) => setSummary(e.target.value)}
                placeholder="今天完成了什么？有什么需要改进？"
                rows={3}
                className="w-full px-3 py-2 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
              <button onClick={handleSaveRecord}
                className="mt-2 w-full py-2.5 rounded-xl bg-indigo-600 text-white text-sm font-medium hover:bg-indigo-700 transition-colors">
                保存日回顾
              </button>
            </div>
          </>
        )}

        {/* Weekly Review */}
        {tab === "weekly" && (
          <>
            <div className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-100 dark:border-gray-800 p-4">
              <div className="flex items-center gap-2 mb-2">
                <Inbox className="w-4 h-4 text-amber-500" />
                <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300">Step 1 · 收件箱清理</h3>
              </div>
              <p className="text-xs text-gray-500 mb-3">本周待安排任务：{taskStats.active} 个</p>
              <a href="/pending" className="inline-block text-xs font-medium text-indigo-600 hover:text-indigo-700">
                前往安排事项 →
              </a>
            </div>

            <div className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-100 dark:border-gray-800 p-4">
              <div className="flex items-center gap-2 mb-2">
                <CheckCheck className="w-4 h-4 text-emerald-500" />
                <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300">Step 2 · 本周概览</h3>
              </div>
              <div className="grid grid-cols-2 gap-3 mt-3">
                <div className="p-3 bg-gray-50 dark:bg-gray-800 rounded-xl">
                  <p className="text-xs text-gray-400">完成任务</p>
                  <p className="text-lg font-bold text-gray-900 dark:text-gray-100">{weeklyDone}</p>
                </div>
                <div className="p-3 bg-gray-50 dark:bg-gray-800 rounded-xl">
                  <p className="text-xs text-gray-400">待办任务</p>
                  <p className="text-lg font-bold text-gray-900 dark:text-gray-100">{weeklyPending}</p>
                </div>
                <div className="p-3 bg-gray-50 dark:bg-gray-800 rounded-xl">
                  <p className="text-xs text-gray-400">习惯打卡</p>
                  <p className="text-lg font-bold text-gray-900 dark:text-gray-100">{habitStats.completed}</p>
                </div>
                <div className="p-3 bg-gray-50 dark:bg-gray-800 rounded-xl">
                  <p className="text-xs text-gray-400">本月收支</p>
                  <p className={`text-lg font-bold ${financeStats.income - financeStats.expense >= 0 ? "text-emerald-500" : "text-red-500"}`}>
                    {(financeStats.income - financeStats.expense).toFixed(0)}
                  </p>
                </div>
              </div>
            </div>

            <div className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-100 dark:border-gray-800 p-4">
              <div className="flex items-center gap-2 mb-2">
                <ClipboardList className="w-4 h-4 text-indigo-500" />
                <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300">Step 3 · 下周计划</h3>
              </div>
              {pendingTasks.length > 0 && (
                <div className="space-y-1 mb-3">
                  {pendingTasks.slice(0, 8).map((t) => (
                    <div key={t.id} className="text-xs text-gray-500 truncate">· {t.title}</div>
                  ))}
                </div>
              )}
              <a href="/pending" className="inline-block text-xs font-medium text-indigo-600 hover:text-indigo-700">
                前往安排下周任务 →
              </a>
            </div>

            <div className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-100 dark:border-gray-800 p-4">
              <p className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">周反思笔记</p>
              <textarea
                value={summary}
                onChange={(e) => setSummary(e.target.value)}
                placeholder="这周完成了什么？有哪些收获和改进？"
                rows={3}
                className="w-full px-3 py-2 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
              <button onClick={handleSaveRecord}
                className="mt-2 w-full py-2.5 rounded-xl bg-indigo-600 text-white text-sm font-medium hover:bg-indigo-700 transition-colors">
                保存周回顾
              </button>
            </div>
          </>
        )}

        {/* Monthly Review */}
        {tab === "monthly" && (
          <>
            <div className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-100 dark:border-gray-800 p-4">
              <div className="flex items-center gap-2 mb-3">
                <TrendingUp className="w-4 h-4 text-indigo-500" />
                <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300">{currentYear}年{currentMonth}月 复盘</h3>
              </div>

              <div className="grid grid-cols-2 gap-3 mb-4">
                <div className="p-3 bg-gray-50 dark:bg-gray-800 rounded-xl">
                  <p className="text-xs text-gray-400">完成任务</p>
                  <p className="text-lg font-bold text-gray-900 dark:text-gray-100">{taskStats.completed}</p>
                  {prevMonthRecord && (
                    <p className="text-[10px] text-gray-400 mt-0.5">
                      {prevMonthRecord.stats.tasksDone > 0 ? `${taskStats.completed > prevMonthRecord.stats.tasksDone ? "↑" : "↓"} 上月 ${prevMonthRecord.stats.tasksDone}` : ""}
                    </p>
                  )}
                </div>
                <div className="p-3 bg-gray-50 dark:bg-gray-800 rounded-xl">
                  <p className="text-xs text-gray-400">新增任务</p>
                  <p className={`text-lg font-bold ${taskStats.new > 0 ? "text-blue-500" : "text-gray-900 dark:text-gray-100"}`}>{taskStats.new}</p>
                </div>
                <div className="p-3 bg-gray-50 dark:bg-gray-800 rounded-xl">
                  <p className="text-xs text-gray-400">习惯打卡</p>
                  <p className="text-lg font-bold text-gray-900 dark:text-gray-100">{habitStats.completed}</p>
                </div>
                <div className="p-3 bg-gray-50 dark:bg-gray-800 rounded-xl">
                  <p className="text-xs text-gray-400">习惯数量</p>
                  <p className="text-lg font-bold text-gray-900 dark:text-gray-100">{habitStats.total}</p>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3 mb-4">
                <div className="p-3 bg-emerald-50 dark:bg-emerald-900/20 rounded-xl">
                  <p className="text-xs text-emerald-600 dark:text-emerald-400">收入</p>
                  <p className="text-lg font-bold text-emerald-600 dark:text-emerald-400">{financeStats.income.toFixed(0)}</p>
                </div>
                <div className="p-3 bg-red-50 dark:bg-red-900/20 rounded-xl">
                  <p className="text-xs text-red-500">支出</p>
                  <p className="text-lg font-bold text-red-500">{financeStats.expense.toFixed(0)}</p>
                </div>
              </div>
            </div>

            <div className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-100 dark:border-gray-800 p-4">
              <p className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">月度反思</p>
              <textarea
                value={summary}
                onChange={(e) => setSummary(e.target.value)}
                placeholder="这个月完成了什么？收入支出如何？有哪些收获和改进？"
                rows={4}
                className="w-full px-3 py-2 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
              <button onClick={handleSaveRecord}
                className="mt-2 w-full py-2.5 rounded-xl bg-indigo-600 text-white text-sm font-medium hover:bg-indigo-700 transition-colors">
                保存月复盘
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
