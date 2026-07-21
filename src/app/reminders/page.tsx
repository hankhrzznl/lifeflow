"use client";

import { useState, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { ArrowLeft, Bell, Clock, Check, X, Clock10, AlertCircle, Calendar, Flame } from "lucide-react";
import Link from "next/link";
import {
  getPendingReminders,
  updateReminderStatus,
  addReminderLog,
  getTask,
} from "@/lib/db";
import { showToast } from "@/components/ui/Toast";
import type { Reminder, Task } from "@/lib/types";

interface ReminderWithTask extends Reminder {
  task?: Task;
}

export default function RemindersPage() {
  const [reminders, setReminders] = useState<ReminderWithTask[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedReminder, setSelectedReminder] = useState<ReminderWithTask | null>(null);
  const [showSnoozeModal, setShowSnoozeModal] = useState(false);
  const [snoozeMinutes, setSnoozeMinutes] = useState(15);

  const loadReminders = useCallback(async () => {
    try {
      const pending = await getPendingReminders();
      const withTasks = await Promise.all(
        pending.map(async (r) => {
          const task = await getTask(r.taskId);
          return { ...r, task };
        })
      );
      setReminders(withTasks.sort((a, b) => a.triggerTime - b.triggerTime));
    } catch (err) {
      console.error("Failed to load reminders:", err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadReminders();
    const interval = setInterval(loadReminders, 5 * 60 * 1000);
    return () => clearInterval(interval);
  }, [loadReminders]);

  const handleDismiss = async (reminder: ReminderWithTask) => {
    try {
      await updateReminderStatus(reminder.id!, "dismissed");
      await addReminderLog(reminder.id!, "dismissed");
      showToast({ message: "提醒已忽略", type: "info" });
      setReminders((prev) => prev.filter((r) => r.id !== reminder.id));
    } catch {
      showToast({ message: "操作失败", type: "error" });
    }
  };

  const handleComplete = async (reminder: ReminderWithTask) => {
    try {
      await updateReminderStatus(reminder.id!, "completed");
      await addReminderLog(reminder.id!, "completed");
      showToast({ message: "已标记完成", type: "success" });
      setReminders((prev) => prev.filter((r) => r.id !== reminder.id));
    } catch {
      showToast({ message: "操作失败", type: "error" });
    }
  };

  const handleSnooze = async () => {
    if (!selectedReminder) return;
    try {
      const snoozeUntil = Date.now() + snoozeMinutes * 60 * 1000;
      await updateReminderStatus(selectedReminder.id!, "snoozed", snoozeUntil);
      await addReminderLog(selectedReminder.id!, "snoozed");
      showToast({ message: `已延迟 ${snoozeMinutes} 分钟`, type: "info" });
      setReminders((prev) => prev.filter((r) => r.id !== selectedReminder.id));
      setShowSnoozeModal(false);
      setSelectedReminder(null);
      setSnoozeMinutes(15);
    } catch {
      showToast({ message: "操作失败", type: "error" });
    }
  };

  const formatTime = (ts: number) => {
    const d = new Date(ts);
    return d.toLocaleTimeString("zh-CN", { hour: "2-digit", minute: "2-digit" });
  };

  const formatDate = (ts: number) => {
    const d = new Date(ts);
    const now = new Date();
    const diff = Math.floor((d.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
    if (diff === 0) return "今天";
    if (diff === 1) return "明天";
    return d.toLocaleDateString("zh-CN", { month: "short", day: "numeric" });
  };

  const getReminderIcon = (type: Reminder["type"]) => {
    switch (type) {
      case "deadline":
        return <Clock className="w-4 h-4" />;
      case "habit":
        return <Flame className="w-4 h-4" />;
      case "event":
        return <Calendar className="w-4 h-4" />;
      default:
        return <AlertCircle className="w-4 h-4" />;
    }
  };

  const getReminderColor = (type: Reminder["type"]) => {
    switch (type) {
      case "deadline":
        return "text-blue-500 bg-blue-50 dark:bg-blue-900/30";
      case "habit":
        return "text-orange-500 bg-orange-50 dark:bg-orange-900/30";
      case "event":
        return "text-purple-500 bg-purple-50 dark:bg-purple-900/30";
      default:
        return "text-gray-500 bg-gray-50 dark:bg-gray-800";
    }
  };

  if (loading) {
    return (
      <div className="flex flex-col h-full max-w-2xl mx-auto px-4 pt-6 pb-24">
        <div className="flex items-center gap-3 mb-6">
          <Link href="/more" className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800">
            <ArrowLeft className="w-5 h-5 text-gray-500" />
          </Link>
          <div className="flex items-center gap-2">
            <Bell className="w-6 h-6 text-blue-500" />
            <h1 className="text-xl font-bold text-gray-900 dark:text-white">提醒中心</h1>
          </div>
        </div>
        <div className="space-y-3">
          {[1, 2, 3].map((i) => (
            <div key={i} className="skeleton h-20 rounded-xl" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full max-w-2xl mx-auto px-4 pt-6 pb-24">
      <div className="flex items-center gap-3 mb-6">
        <Link href="/today" className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800">
          <ArrowLeft className="w-5 h-5 text-gray-500" />
        </Link>
        <div className="flex items-center gap-2">
          <Bell className="w-6 h-6 text-blue-500" />
          <h1 className="text-xl font-bold text-gray-900 dark:text-white">提醒中心</h1>
          {reminders.length > 0 && (
            <span className="px-2 py-0.5 rounded-full bg-red-100 dark:bg-red-900/30 text-red-600 text-xs font-medium">
              {reminders.length}
            </span>
          )}
        </div>
      </div>

      {reminders.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 text-center">
          <div className="w-16 h-16 rounded-2xl bg-blue-50 dark:bg-blue-900/30 flex items-center justify-center mb-4">
            <Bell className="w-8 h-8 text-blue-400" />
          </div>
          <p className="text-gray-500 dark:text-gray-400">暂无待处理的提醒</p>
          <p className="text-xs text-gray-400 dark:text-gray-500 mt-1">设置任务截止日期或习惯打卡提醒</p>
        </div>
      ) : (
        <div className="space-y-3">
          {reminders.map((reminder) => (
            <motion.div
              key={reminder.id}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-100 dark:border-gray-800 overflow-hidden"
            >
              <div className="p-4">
                <div className="flex items-start gap-3">
                  <div className={`w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 ${getReminderColor(reminder.type)}`}>
                    {getReminderIcon(reminder.type)}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-gray-700 dark:text-gray-300">{reminder.message}</p>
                    {reminder.task && (
                      <p className="text-xs text-gray-400 mt-0.5">关联任务：{reminder.task.title}</p>
                    )}
                    <div className="flex items-center gap-2 mt-1.5">
                      <span className="text-[10px] text-gray-400">
                        {formatDate(reminder.triggerTime)} · {formatTime(reminder.triggerTime)}
                      </span>
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-2 mt-4 pt-3 border-t border-gray-100 dark:border-gray-800">
                  <button
                    onClick={() => handleComplete(reminder)}
                    className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-xl bg-emerald-50 dark:bg-emerald-900/30 text-emerald-600 text-sm font-medium hover:bg-emerald-100 transition-colors"
                  >
                    <Check className="w-4 h-4" />
                    完成
                  </button>
                  <button
                    onClick={() => {
                      setSelectedReminder(reminder);
                      setShowSnoozeModal(true);
                    }}
                    className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-xl bg-amber-50 dark:bg-amber-900/30 text-amber-600 text-sm font-medium hover:bg-amber-100 transition-colors"
                  >
                    <Clock10 className="w-4 h-4" />
                    延迟
                  </button>
                  <button
                    onClick={() => handleDismiss(reminder)}
                    className="w-9 h-9 flex items-center justify-center rounded-xl bg-gray-100 dark:bg-gray-800 text-gray-500 hover:bg-gray-200 transition-colors"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
              </div>
            </motion.div>
          ))}
        </div>
      )}

      <AnimatePresence>
        {showSnoozeModal && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-6"
            onClick={() => setShowSnoozeModal(false)}
          >
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              onClick={(e) => e.stopPropagation()}
              className="bg-white dark:bg-gray-900 rounded-3xl p-6 max-w-sm w-full shadow-xl"
            >
              <div className="flex items-center gap-3 mb-4">
                <div className="w-10 h-10 rounded-xl bg-amber-100 dark:bg-amber-900/30 flex items-center justify-center">
                  <Clock10 className="w-5 h-5 text-amber-500" />
                </div>
                <div>
                  <h3 className="text-base font-semibold text-gray-900 dark:text-white">延迟提醒</h3>
                  <p className="text-xs text-gray-500 dark:text-gray-400">选择延迟时间</p>
                </div>
              </div>

              <div className="grid grid-cols-4 gap-2 mb-6">
                {[5, 15, 30, 60].map((mins) => (
                  <button
                    key={mins}
                    onClick={() => setSnoozeMinutes(mins)}
                    className={`py-2.5 rounded-xl text-sm font-medium transition-colors ${
                      snoozeMinutes === mins
                        ? "bg-amber-100 text-amber-600 border-2 border-amber-300"
                        : "bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400 border border-gray-200 dark:border-gray-700"
                    }`}
                  >
                    {mins === 60 ? "1小时" : `${mins}分钟`}
                  </button>
                ))}
              </div>

              <div className="flex gap-3">
                <button
                  onClick={() => setShowSnoozeModal(false)}
                  className="flex-1 py-2.5 rounded-xl border border-gray-200 dark:border-gray-700 text-sm text-gray-500 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors"
                >
                  取消
                </button>
                <button
                  onClick={handleSnooze}
                  className="flex-1 py-2.5 rounded-xl bg-amber-500 text-white text-sm font-medium hover:bg-amber-600 transition-colors"
                >
                  确认延迟
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
