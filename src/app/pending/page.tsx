"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import { motion } from "framer-motion";
import {
  ArrowLeft, Clock, ListTodo, ChevronRight,
  Calendar, Minus, Plus, Check, CheckCircle,
} from "lucide-react";
import Link from "next/link";
import {
  initBuiltInPlugins, getActiveSchedulableTasks, getTimeSegments,
  updateTask,
} from "@/lib/db";
import { showToast } from "@/components/ui/Toast";
import TaskDetail from "@/components/ui/TaskDetail";
import type { Task, TimeSegment } from "@/lib/types";

type PendingTab = "pending" | "scheduled";

const TYPE_LABELS: Record<string, { label: string; color: string; bg: string }> = {
  shortterm: { label: "短期事件", color: "text-blue-600", bg: "bg-blue-100 dark:bg-blue-900/30" },
  daily: { label: "日常琐事", color: "text-green-600", bg: "bg-green-100 dark:bg-green-900/30" },
  habit: { label: "习惯", color: "text-orange-600", bg: "bg-orange-100 dark:bg-orange-900/30" },
  longterm: { label: "长期目标", color: "text-indigo-600", bg: "bg-indigo-100 dark:bg-indigo-900/30" },
};

const SEG_SIZE_OPTIONS = [
  { key: "small", label: "小", range: "1-2", min: 1, max: 2 },
  { key: "medium", label: "中", range: "3-5", min: 3, max: 5 },
  { key: "large", label: "大", range: "6+", min: 6, max: 6 },
] as const;

function formatDate(ts?: number): string {
  if (!ts) return "未设置";
  const d = new Date(ts);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function getCountdownDays(dueDate?: number): number | null {
  if (!dueDate) return null;
  return Math.ceil((dueDate - Date.now()) / (1000 * 60 * 60 * 24));
}

function isPending(task: Task, segmentsCount: number): boolean {
  if (segmentsCount === 0) return true;
  if (task.requiredSegments && segmentsCount < task.requiredSegments) return true;
  return false;
}

export default function PendingPage() {
  const [loading, setLoading] = useState(true);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [segmentsMap, setSegmentsMap] = useState<Map<number, TimeSegment[]>>(new Map());
  const [tab, setTab] = useState<PendingTab>("pending");
  const [detailTaskId, setDetailTaskId] = useState<number | null>(null);
  const [expandedTaskId, setExpandedTaskId] = useState<number | null>(null);

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      await initBuiltInPlugins();
      const all = await getActiveSchedulableTasks();
      setTasks(all);

      const segMap = new Map<number, TimeSegment[]>();
      await Promise.all(
        all.map(async (t) => {
          const segs = await getTimeSegments(t.id!);
          segMap.set(t.id!, segs);
        })
      );
      setSegmentsMap(segMap);
    } catch { /* ignore */ }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { loadData(); }, [loadData]);

  const pendingTasks = useMemo(() => {
    return tasks.filter((t) => {
      const segCount = segmentsMap.get(t.id!)?.length ?? 0;
      return isPending(t, segCount);
    });
  }, [tasks, segmentsMap]);

  const scheduledTasks = useMemo(() => {
    return tasks.filter((t) => {
      const segCount = segmentsMap.get(t.id!)?.length ?? 0;
      return !isPending(t, segCount);
    });
  }, [tasks, segmentsMap]);

  const handleUpdateSegments = async (task: Task, requiredSegments: number) => {
    try {
      await updateTask(task.id!, { requiredSegments, segmentReminderDays: task.segmentReminderDays ?? 3 });
      showToast({ message: "已保存", type: "success" });
      await loadData();
    } catch {
      showToast({ message: "保存失败", type: "error" });
    }
  };

  const handleUpdateReminderDays = async (task: Task, days: number) => {
    try {
      await updateTask(task.id!, { segmentReminderDays: days, requiredSegments: task.requiredSegments ?? undefined });
      await loadData();
    } catch {
      showToast({ message: "保存失败", type: "error" });
    }
  };

  const handleMarkDone = async (task: Task) => {
    try {
      await updateTask(task.id!, { status: "done" });
      showToast({ message: "已标记完成", type: "success" });
      await loadData();
    } catch {
      showToast({ message: "操作失败", type: "error" });
    }
  };

  const handleSegSizeSelect = (task: Task, option: typeof SEG_SIZE_OPTIONS[number]) => {
    const val = option.min;
    handleUpdateSegments(task, val);
  };

  const handleSegCountChange = (task: Task, delta: number) => {
    const current = task.requiredSegments ?? 1;
    const next = Math.max(1, current + delta);
    handleUpdateSegments(task, next);
  };

  const handleReminderChange = (task: Task, delta: number) => {
    const current = task.segmentReminderDays ?? 3;
    const next = Math.max(1, Math.min(180, current + delta));
    handleUpdateReminderDays(task, next);
  };

  if (loading) {
    return (
      <div className="flex flex-col h-full max-w-2xl mx-auto px-4 pt-6 pb-24">
        <h1 className="text-xl font-bold text-gray-900 dark:text-gray-100 mb-5">安排事项</h1>
        <div className="space-y-3">
          {[1, 2, 3].map((i) => <div key={i} className="skeleton h-20 rounded-xl" />)}
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full max-w-2xl mx-auto px-4 pt-6 pb-24">
      <div className="flex items-center gap-3 mb-4">
        <Link href="/projects" className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800">
          <ArrowLeft className="w-5 h-5 text-gray-500" />
        </Link>
        <h1 className="text-xl font-bold text-gray-900 dark:text-gray-100">安排事项</h1>
      </div>

      <div className="flex border-b border-gray-200 dark:border-gray-800 mb-4">
        <button
          onClick={() => setTab("pending")}
          className={`flex-1 py-2.5 text-sm font-medium border-b-2 transition-colors ${
            tab === "pending" ? "text-orange-600 border-orange-600" : "text-gray-500 border-transparent hover:text-gray-700"
          }`}
        >
          待安排 ({pendingTasks.length})
        </button>
        <button
          onClick={() => setTab("scheduled")}
          className={`flex-1 py-2.5 text-sm font-medium border-b-2 transition-colors ${
            tab === "scheduled" ? "text-emerald-600 border-emerald-600" : "text-gray-500 border-transparent hover:text-gray-700"
          }`}
        >
          已安排 ({scheduledTasks.length})
        </button>
      </div>

      <div className="flex-1 overflow-y-auto space-y-3">
        {tab === "pending" && pendingTasks.length === 0 && (
          <div className="flex flex-col items-center justify-center py-16 text-center">
            <ListTodo className="w-12 h-12 text-gray-300 dark:text-gray-600 mb-4" />
            <p className="text-gray-500 dark:text-gray-400">暂无待安排事项</p>
            <p className="text-xs text-gray-400 dark:text-gray-500 mt-1">所有任务都已安排好时间段</p>
          </div>
        )}

        {tab === "scheduled" && scheduledTasks.length === 0 && (
          <div className="flex flex-col items-center justify-center py-16 text-center">
            <CheckCircle className="w-12 h-12 text-gray-300 dark:text-gray-600 mb-4" />
            <p className="text-gray-500 dark:text-gray-400">暂无已安排事项</p>
            <p className="text-xs text-gray-400 dark:text-gray-500 mt-1">去"待安排"页面为任务添加时间段吧</p>
          </div>
        )}

        {tab === "pending" && pendingTasks.map((task) => {
          const segCount = segmentsMap.get(task.id!)?.length ?? 0;
          const typeInfo = TYPE_LABELS[task.type] || TYPE_LABELS.daily;
          const countdown = getCountdownDays(task.dueDate);
          const reminderDays = task.segmentReminderDays ?? 3;
          const isOverdue = countdown !== null && countdown < 0;
          const needsAttention = countdown !== null && countdown >= 0 && countdown <= reminderDays;
          const expanded = expandedTaskId === task.id;

          return (
            <div
              key={task.id}
              className={`bg-white dark:bg-gray-900 rounded-2xl border shadow-sm overflow-hidden ${
                isOverdue ? "border-red-200 dark:border-red-800" : needsAttention ? "border-amber-200 dark:border-amber-800" : "border-gray-100 dark:border-gray-800"
              }`}
            >
              <div
                className="flex items-center gap-3 px-4 py-3 cursor-pointer"
                onClick={() => setExpandedTaskId(expanded ? null : task.id!)}
              >
                <div className="flex-1 min-w-0">
                  <p className="text-sm text-gray-700 dark:text-gray-300 truncate">{task.title}</p>
                  <div className="flex items-center gap-2 mt-0.5">
                    <span className={`text-[10px] font-medium px-1.5 py-0.5 rounded-md ${typeInfo.bg} ${typeInfo.color}`}>
                      {typeInfo.label}
                    </span>
                    <span className={`flex items-center gap-0.5 text-[10px] ${
                      isOverdue ? "text-red-500" : needsAttention ? "text-amber-500" : "text-gray-400"
                    }`}>
                      <Calendar className="w-3 h-3" />
                      {formatDate(task.dueDate)}
                      {countdown !== null && countdown >= 0 && ` · 剩余${countdown}天`}
                      {isOverdue && ` · 已逾期${Math.abs(countdown)}天`}
                    </span>
                  </div>
                </div>
                <div className="flex items-center gap-2 flex-shrink-0">
                  {segCount > 0 && (
                    <span className="text-xs text-gray-400">{segCount} 时段</span>
                  )}
                  {task.requiredSegments && (
                    <span className={`text-xs font-medium ${
                      segCount >= task.requiredSegments ? "text-emerald-500" : "text-orange-500"
                    }`}>
                      {segCount}/{task.requiredSegments}
                    </span>
                  )}
                  <ChevronRight className="w-4 h-4 text-gray-300" />
                </div>
              </div>

              {expanded && (
                <div className="px-4 pb-4 border-t border-gray-50 dark:border-gray-800 pt-3 space-y-3">
                  <div>
                    <p className="text-xs font-medium text-gray-500 dark:text-gray-400 mb-1.5">需要几个时间段?</p>
                    <div className="flex items-center gap-2 flex-wrap">
                      {SEG_SIZE_OPTIONS.map((opt) => {
                        const current = task.requiredSegments;
                        const isSelected = current
                          ? (opt.key === "small" && current >= 1 && current <= 2)
                            || (opt.key === "medium" && current >= 3 && current <= 5)
                            || (opt.key === "large" && current >= 6)
                          : false;
                        return (
                          <button
                            key={opt.key}
                            onClick={() => handleSegSizeSelect(task, opt)}
                            className={`px-3 py-1.5 rounded-xl text-xs font-medium border transition-colors ${
                              isSelected
                                ? "bg-indigo-100 dark:bg-indigo-900/30 text-indigo-600 border-indigo-300 dark:border-indigo-800"
                                : "bg-gray-50 dark:bg-gray-800 text-gray-500 dark:text-gray-400 border-gray-200 dark:border-gray-700 hover:bg-gray-100"
                            }`}
                          >
                            {opt.label} ({opt.range})
                          </button>
                        );
                      })}
                    </div>
                    {task.requiredSegments && (
                      <div className="flex items-center gap-2 mt-2">
                        <span className="text-xs text-gray-400">微调：</span>
                        <button
                          onClick={() => handleSegCountChange(task, -1)}
                          className="w-7 h-7 flex items-center justify-center rounded-lg bg-gray-100 dark:bg-gray-800 text-gray-500 hover:bg-gray-200"
                        >
                          <Minus className="w-3.5 h-3.5" />
                        </button>
                        <span className="text-sm font-semibold text-gray-700 dark:text-gray-300 w-6 text-center">{task.requiredSegments}</span>
                        <button
                          onClick={() => handleSegCountChange(task, 1)}
                          className="w-7 h-7 flex items-center justify-center rounded-lg bg-gray-100 dark:bg-gray-800 text-gray-500 hover:bg-gray-200"
                        >
                          <Plus className="w-3.5 h-3.5" />
                        </button>
                        <span className="text-xs text-gray-400">个</span>
                      </div>
                    )}
                  </div>

                  <div>
                    <p className="text-xs font-medium text-gray-500 dark:text-gray-400 mb-1.5">截止前多久提醒?</p>
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => handleReminderChange(task, -1)}
                        className="w-7 h-7 flex items-center justify-center rounded-lg bg-gray-100 dark:bg-gray-800 text-gray-500 hover:bg-gray-200"
                      >
                        <Minus className="w-3.5 h-3.5" />
                      </button>
                      <span className="text-sm font-semibold text-gray-700 dark:text-gray-300">{reminderDays}</span>
                      <button
                        onClick={() => handleReminderChange(task, 1)}
                        className="w-7 h-7 flex items-center justify-center rounded-lg bg-gray-100 dark:bg-gray-800 text-gray-500 hover:bg-gray-200"
                      >
                        <Plus className="w-3.5 h-3.5" />
                      </button>
                      <span className="text-xs text-gray-400">天前</span>
                    </div>
                  </div>

                  <div className="flex gap-2">
                    <button
                      onClick={() => setDetailTaskId(task.id!)}
                      className="flex-1 py-2 rounded-xl bg-blue-500 text-white text-xs font-medium hover:bg-blue-600 transition-colors"
                    >
                      打开详情
                    </button>
                    <button
                      onClick={() => handleMarkDone(task)}
                      className="flex items-center gap-1 px-4 py-2 rounded-xl bg-emerald-500 text-white text-xs font-medium hover:bg-emerald-600 transition-colors"
                    >
                      <Check className="w-3.5 h-3.5" />
                      完成
                    </button>
                  </div>
                </div>
              )}
            </div>
          );
        })}

        {tab === "scheduled" && scheduledTasks.map((task) => {
          const segCount = segmentsMap.get(task.id!)?.length ?? 0;
          const typeInfo = TYPE_LABELS[task.type] || TYPE_LABELS.daily;
          const expanded = expandedTaskId === task.id;

          return (
            <div
              key={task.id}
              className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-100 dark:border-gray-800 shadow-sm overflow-hidden"
            >
              <div
                className="flex items-center gap-3 px-4 py-3 cursor-pointer"
                onClick={() => setExpandedTaskId(expanded ? null : task.id!)}
              >
                <div className="w-6 h-6 rounded-full bg-emerald-100 dark:bg-emerald-900/30 flex items-center justify-center flex-shrink-0">
                  <Check className="w-3.5 h-3.5 text-emerald-500" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm text-gray-700 dark:text-gray-300 truncate">{task.title}</p>
                  <div className="flex items-center gap-2 mt-0.5">
                    <span className={`text-[10px] font-medium px-1.5 py-0.5 rounded-md ${typeInfo.bg} ${typeInfo.color}`}>
                      {typeInfo.label}
                    </span>
                    <span className="text-[10px] text-emerald-500">
                      已安排 {segCount}/{task.requiredSegments || segCount} 时段
                    </span>
                  </div>
                </div>
                <ChevronRight className="w-4 h-4 text-gray-300" />
              </div>

              {expanded && (
                <div className="px-4 pb-4 border-t border-gray-50 dark:border-gray-800 pt-3 space-y-2">
                  <div>
                    <p className="text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">预计 {task.requiredSegments || segCount} 个时间段</p>
                  </div>
                  <div className="flex gap-2">
                    <button
                      onClick={() => setDetailTaskId(task.id!)}
                      className="flex-1 py-2 rounded-xl bg-blue-500 text-white text-xs font-medium hover:bg-blue-600 transition-colors"
                    >
                      管理时间段
                    </button>
                    <button
                      onClick={() => handleMarkDone(task)}
                      className="flex items-center gap-1 px-4 py-2 rounded-xl bg-emerald-500 text-white text-xs font-medium hover:bg-emerald-600 transition-colors"
                    >
                      <Check className="w-3.5 h-3.5" />
                      完成
                    </button>
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {detailTaskId !== null && (
        <TaskDetail
          taskId={detailTaskId}
          onClose={() => setDetailTaskId(null)}
          onUpdate={loadData}
        />
      )}
    </div>
  );
}
