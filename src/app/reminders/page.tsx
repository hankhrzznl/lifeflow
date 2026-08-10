"use client";

import { useState, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  ArrowLeft,
  Bell,
  Clock,
  Check,
  X,
  Clock10,
  AlertCircle,
  Calendar,
  Flame,
  BellRing,
  Moon,
  BedDouble,
  Sunrise,
} from "lucide-react";
import Link from "next/link";
import {
  getPendingReminders,
  updateReminderStatus,
  addReminderLog,
  getTask,
} from "@/lib/db";
import { showToast } from "@/components/ui/Toast";
import type { Reminder, Task } from "@/lib/types";
import type { Item } from "@/lib/db/daylog.db";
import { daylogDB } from "@/lib/db/daylog.db";

interface ReminderWithTask extends Reminder {
  task?: Task;
  item?: Item;
}

/** 渐进式早睡（睡前仪式）阶段 —— 画布视觉：23:30 起步 → 23:00 当前 → 22:30 目标 */
const RITUAL_STAGES = [
  { time: "23:30", label: "起步", active: false },
  { time: "23:00", label: "当前", active: true },
  { time: "22:30", label: "目标", active: false },
];

export default function RemindersPage() {
  const [reminders, setReminders] = useState<ReminderWithTask[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedReminder, setSelectedReminder] = useState<ReminderWithTask | null>(null);
  const [showSnoozeModal, setShowSnoozeModal] = useState(false);
  const [snoozeMinutes, setSnoozeMinutes] = useState(15);

  // 睡前仪式（渐进式早睡）展示状态 —— 仅前端视觉，不写 reminders 表
  const [ritualOn, setRitualOn] = useState(true);
  const [envTime, setEnvTime] = useState("22:00");
  const [prepTime, setPrepTime] = useState("22:30");
  const [sleepTime, setSleepTime] = useState("23:00");

  const loadReminders = useCallback(async () => {
    try {
      const pending = await getPendingReminders();
      const withTasks = await Promise.all(
        pending.map(async (r) => {
          // 如果 moduleType='item'，从 daylogDB 读取 Item 信息
          if (r.moduleType === "item" && r.linkedModuleId) {
            const item = await daylogDB.items.get(r.linkedModuleId);
            if (item) return { ...r, item };
          }
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
      <div className="flex flex-col h-full max-w-md mx-auto px-4 pt-6 pb-24">
        <div className="flex items-center gap-3 mb-6">
          <Link href="/" className="w-9 h-9 flex items-center justify-center rounded-full bg-white dark:bg-gray-900 border border-gray-100 dark:border-gray-800 shadow-sm">
            <ArrowLeft className="w-5 h-5 text-gray-500" />
          </Link>
          <div className="flex items-center gap-2">
            <Bell className="w-5 h-5 text-blue-500" />
            <h1 className="text-xl font-bold text-gray-900 dark:text-white">提醒与仪式</h1>
          </div>
        </div>
        <div className="space-y-3">
          {[1, 2, 3].map((i) => (
            <div key={i} className="skeleton h-20 rounded-2xl" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col min-h-dvh max-w-md mx-auto px-4 pt-[var(--safe-area-top)] pb-24">
      {/* 顶部：返回 + 标题 + 默认提醒设置 */}
      <header className="flex items-center gap-2.5 mb-4">
        <Link
          href="/"
          aria-label="返回"
          className="w-9 h-9 shrink-0 flex items-center justify-center rounded-full bg-white dark:bg-gray-900 border border-gray-100 dark:border-gray-800 shadow-sm hover:opacity-85 active:scale-90 transition"
        >
          <ArrowLeft className="w-5 h-5 text-gray-500" />
        </Link>
        <div className="flex items-center gap-2 flex-1 min-w-0">
          <span className="w-8 h-8 shrink-0 rounded-[10px] bg-blue-50 dark:bg-blue-900/30 flex items-center justify-center">
            <Bell className="w-4 h-4 text-blue-500" />
          </span>
          <h1 className="text-[20px] font-bold text-gray-900 dark:text-white truncate">提醒与仪式</h1>
          {reminders.length > 0 && (
            <span className="px-2 py-0.5 rounded-full bg-red-100 dark:bg-red-900/30 text-red-600 dark:text-red-400 text-xs font-medium shrink-0">
              {reminders.length}
            </span>
          )}
        </div>
        <Link
          href="/more/reminder-settings"
          className="shrink-0 text-xs font-medium text-blue-500 hover:text-blue-600 dark:text-blue-400"
        >
          默认提醒设置
        </Link>
      </header>

      {/* 睡前仪式（渐进式早睡）—— 对齐画布视觉 */}
      <section className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-100 dark:border-gray-800 shadow-[var(--shadow-card)] px-4 pt-3.5 pb-4 mb-3">
        <h2 className="text-[17px] font-bold text-gray-900 dark:text-white">睡前仪式</h2>

        {/* 时间设置行 */}
        <div className="mt-1 divide-y divide-gray-100 dark:divide-gray-800">
          <div className="flex items-center gap-3 py-3">
            <span className="w-9 h-9 shrink-0 rounded-[10px] bg-indigo-50 dark:bg-indigo-900/30 text-indigo-500 dark:text-indigo-400 flex items-center justify-center">
              <Sunrise className="w-[17px] h-[17px]" />
            </span>
            <div className="flex-1 min-w-0">
              <p className="text-[15px] font-medium text-gray-800 dark:text-gray-200">环境营造</p>
              <p className="text-xs text-gray-400 mt-px">调暗灯光 · 收起手机</p>
            </div>
            <input
              type="time"
              value={envTime}
              onChange={(e) => setEnvTime(e.target.value)}
              aria-label="环境营造时间"
              className="w-[92px] h-9 shrink-0 rounded-[10px] border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 text-center font-mono text-sm text-gray-800 dark:text-gray-200 outline-none focus:border-indigo-400"
            />
          </div>
          <div className="flex items-center gap-3 py-3">
            <span className="w-9 h-9 shrink-0 rounded-[10px] bg-indigo-50 dark:bg-indigo-900/30 text-indigo-500 dark:text-indigo-400 flex items-center justify-center">
              <Moon className="w-[17px] h-[17px]" />
            </span>
            <div className="flex-1 min-w-0">
              <p className="text-[15px] font-medium text-gray-800 dark:text-gray-200">倒计时开始</p>
              <p className="text-xs text-gray-400 mt-px">进入入睡准备</p>
            </div>
            <input
              type="time"
              value={prepTime}
              onChange={(e) => setPrepTime(e.target.value)}
              aria-label="倒计时开始时间"
              className="w-[92px] h-9 shrink-0 rounded-[10px] border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 text-center font-mono text-sm text-gray-800 dark:text-gray-200 outline-none focus:border-indigo-400"
            />
          </div>
          <div className="flex items-center gap-3 py-3">
            <span className="w-9 h-9 shrink-0 rounded-[10px] bg-indigo-50 dark:bg-indigo-900/30 text-indigo-500 dark:text-indigo-400 flex items-center justify-center">
              <BedDouble className="w-[17px] h-[17px]" />
            </span>
            <div className="flex-1 min-w-0">
              <p className="text-[15px] font-medium text-gray-800 dark:text-gray-200">入睡打卡</p>
              <p className="text-xs text-gray-400 mt-px">记录实际入睡</p>
            </div>
            <input
              type="time"
              value={sleepTime}
              onChange={(e) => setSleepTime(e.target.value)}
              aria-label="入睡打卡时间"
              className="w-[92px] h-9 shrink-0 rounded-[10px] border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 text-center font-mono text-sm text-gray-800 dark:text-gray-200 outline-none focus:border-indigo-400"
            />
          </div>
        </div>

        {/* 渐进式早睡开关行 */}
        <div className="flex items-center justify-between gap-3 pt-3 border-t border-gray-100 dark:border-gray-800">
          <div className="min-w-0">
            <p className="text-[15px] font-medium text-gray-800 dark:text-gray-200">渐进式早睡</p>
            <p className="text-xs text-gray-400 mt-px">每周提前 30 分钟</p>
          </div>
          <button
            type="button"
            role="switch"
            aria-checked={ritualOn}
            aria-label="渐进式早睡开关"
            onClick={() => setRitualOn((v) => !v)}
            className={`relative w-12 h-7 shrink-0 rounded-full transition-colors ${ritualOn ? "bg-green-500" : "bg-gray-200 dark:bg-gray-700"}`}
          >
            <span
              className={`absolute top-0.5 left-0.5 w-6 h-6 rounded-full bg-white shadow transition-transform ${ritualOn ? "translate-x-5" : ""}`}
            />
          </button>
        </div>

        {/* 阶段卡片 + 进度（开关开启时展开） */}
        <AnimatePresence initial={false}>
          {ritualOn && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: "auto" }}
              exit={{ opacity: 0, height: 0 }}
              transition={{ duration: 0.28, ease: [0.32, 0.72, 0, 1] }}
              className="overflow-hidden"
            >
              <div>
                <p className="text-[13px] leading-relaxed text-gray-500 dark:text-gray-400 mt-3">
                  从 23:30 起步，每周提前 30 分钟，目标 22:30 入睡
                </p>
                {/* 阶段卡片 23:30 / 23:00 / 22:30 */}
                <div className="grid grid-cols-3 gap-2 mt-3">
                  {RITUAL_STAGES.map((s) => (
                    <div
                      key={s.time}
                      className={`rounded-xl border px-2 py-2 text-center transition-colors ${
                        s.active
                          ? "bg-indigo-50 dark:bg-indigo-900/30 border-indigo-300 dark:border-indigo-700 text-indigo-600 dark:text-indigo-300"
                          : "bg-gray-50 dark:bg-gray-800 border-gray-200 dark:border-gray-700 text-gray-500 dark:text-gray-400"
                      }`}
                    >
                      <div className="font-mono text-sm font-semibold leading-none">{s.time}</div>
                      <div className="text-[11px] mt-1 opacity-80">{s.label}</div>
                    </div>
                  ))}
                </div>
                {/* 当前进度 */}
                <div className="flex items-baseline justify-between gap-2 mt-4">
                  <span className="text-xs font-semibold text-gray-500 dark:text-gray-400">当前进度</span>
                  <span className="font-mono text-xs font-semibold text-indigo-500 dark:text-indigo-400 whitespace-nowrap">
                    第 3 周 · 目标 23:00
                  </span>
                </div>
                <div
                  className="h-1 mt-2 rounded-full bg-gray-100 dark:bg-gray-800 overflow-hidden"
                  role="progressbar"
                  aria-valuemin={0}
                  aria-valuemax={100}
                  aria-valuenow={33}
                  aria-label="渐进式早睡进度 33%"
                >
                  <div className="h-full rounded-full bg-indigo-500 transition-all duration-500" style={{ width: "33%" }} />
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </section>

      {/* 待处理提醒（画布列表行视觉，保留提醒逻辑） */}
      <section className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-100 dark:border-gray-800 shadow-[var(--shadow-card)] overflow-hidden">
        <div className="px-4 pt-3.5 pb-1.5">
          <h2 className="text-[17px] font-bold text-gray-900 dark:text-white">待处理提醒</h2>
        </div>

        {reminders.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 text-center px-6">
            <div className="w-14 h-14 rounded-2xl bg-blue-50 dark:bg-blue-900/30 flex items-center justify-center mb-3">
              <Bell className="w-7 h-7 text-blue-400" />
            </div>
            <p className="text-sm text-gray-500 dark:text-gray-400">暂无待处理的提醒</p>
            <p className="text-xs text-gray-400 dark:text-gray-500 mt-1">设置任务截止日期或习惯打卡提醒</p>
          </div>
        ) : (
          <div className="divide-y divide-gray-100 dark:divide-gray-800">
            {reminders.map((reminder) => (
              <motion.div
                key={reminder.id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
              >
                <div className="px-4 pt-3.5 flex items-start gap-3">
                  {reminder.item ? (
                    <div
                      className="w-9 h-9 rounded-[10px] flex items-center justify-center flex-shrink-0"
                      style={{ background: `${reminder.item.color}20` }}
                    >
                      <BellRing className="w-4 h-4" style={{ color: reminder.item.color }} />
                    </div>
                  ) : (
                    <div className={`w-9 h-9 rounded-[10px] flex items-center justify-center flex-shrink-0 ${getReminderColor(reminder.type)}`}>
                      {getReminderIcon(reminder.type)}
                    </div>
                  )}
                  <div className="flex-1 min-w-0">
                    <p className="text-[15px] font-medium text-gray-800 dark:text-gray-200 break-words">{reminder.message}</p>
                    {reminder.item && (
                      <p className="text-xs text-gray-400 mt-0.5">
                        {reminder.item.plannedStart} · {reminder.item.sourceType === "water" ? "饮水" : reminder.item.sourceType}
                      </p>
                    )}
                    {!reminder.item && reminder.task && (
                      <p className="text-xs text-gray-400 mt-0.5">关联任务：{reminder.task.title}</p>
                    )}
                    <p className="text-[11px] font-mono text-gray-400 mt-1.5">
                      {formatDate(reminder.triggerTime)} · {formatTime(reminder.triggerTime)}
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-2 px-4 pb-3.5 mt-3">
                  <button
                    onClick={() => handleComplete(reminder)}
                    className="flex-1 flex items-center justify-center gap-1.5 h-9 rounded-xl bg-emerald-50 dark:bg-emerald-900/30 text-emerald-600 dark:text-emerald-400 text-[13px] font-medium hover:bg-emerald-100 transition-colors"
                  >
                    <Check className="w-4 h-4" />
                    完成
                  </button>
                  <button
                    onClick={() => {
                      setSelectedReminder(reminder);
                      setShowSnoozeModal(true);
                    }}
                    className="flex-1 flex items-center justify-center gap-1.5 h-9 rounded-xl bg-amber-50 dark:bg-amber-900/30 text-amber-600 dark:text-amber-400 text-[13px] font-medium hover:bg-amber-100 transition-colors"
                  >
                    <Clock10 className="w-4 h-4" />
                    延迟
                  </button>
                  <button
                    onClick={() => handleDismiss(reminder)}
                    aria-label="忽略提醒"
                    className="w-9 h-9 flex items-center justify-center rounded-xl bg-gray-100 dark:bg-gray-800 text-gray-500 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
              </motion.div>
            ))}
          </div>
        )}
      </section>

      {/* 延迟提醒 BottomSheet */}
      <AnimatePresence>
        {showSnoozeModal && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-end justify-center bg-black/40"
            onClick={() => setShowSnoozeModal(false)}
          >
            <motion.div
              initial={{ y: "100%" }}
              animate={{ y: 0 }}
              exit={{ y: "100%" }}
              transition={{ type: "spring", stiffness: 380, damping: 40 }}
              onClick={(e) => e.stopPropagation()}
              className="w-full max-w-md bg-white dark:bg-gray-900 rounded-t-3xl px-6 pt-3 pb-[calc(18px+env(safe-area-inset-bottom))]"
            >
              <div className="w-9 h-1 mx-auto rounded-full bg-gray-200 dark:bg-gray-700 mb-5" />
              <div className="flex items-center gap-3 mb-4">
                <div className="w-10 h-10 rounded-xl bg-amber-100 dark:bg-amber-900/30 flex items-center justify-center">
                  <Clock10 className="w-5 h-5 text-amber-500" />
                </div>
                <div>
                  <h3 className="text-[17px] font-bold text-gray-900 dark:text-white">延迟提醒</h3>
                  <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">选择延迟时间</p>
                </div>
              </div>

              <div className="grid grid-cols-4 gap-2 mb-6">
                {[5, 15, 30, 60].map((mins) => (
                  <button
                    key={mins}
                    onClick={() => setSnoozeMinutes(mins)}
                    className={`py-2.5 rounded-xl text-sm font-medium transition-colors ${
                      snoozeMinutes === mins
                        ? "bg-amber-100 dark:bg-amber-900/30 text-amber-600 dark:text-amber-400 border-2 border-amber-300 dark:border-amber-700"
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
