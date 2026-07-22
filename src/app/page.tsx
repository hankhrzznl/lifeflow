"use client";

import { useEffect, useState, useMemo } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import { useLiveQuery } from "dexie-react-hooks";
import {
  Zap, Check, Bell, Flame,
  Calendar, Droplets, Moon, Dumbbell, Pill,
} from "lucide-react";
import { getScheduleTasksByDate, getAllScheduleTasks } from "@/lib/db/efficiency.db";
import type { ScheduleTask } from "@/lib/db/efficiency.db";
import { getPendingReminders } from "@/lib/db";
import type { Reminder } from "@/lib/types";
import { useAgent } from "@/components/agent/AgentProvider";

// ============================================================
// 工具函数
// ============================================================

function todayStr(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function formatDateChinese(date: Date): string {
  const weekDays = ["日", "一", "二", "三", "四", "五", "六"];
  return `${date.getMonth() + 1}月${date.getDate()}日 周${weekDays[date.getDay()]}`;
}

function formatDuration(minutes: number): string {
  if (minutes <= 0) return "--";
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return h > 0 ? `${h}h${m > 0 ? m : ""}` : `${m}min`;
}

function greeting(): string {
  const h = new Date().getHours();
  if (h < 6) return "夜深了";
  if (h < 9) return "早上好";
  if (h < 12) return "上午好";
  if (h < 14) return "中午好";
  if (h < 18) return "下午好";
  return "晚上好";
}

// ============================================================
// AI 快捷指令
// ============================================================

const QUICK_PROMPTS = [
  { label: "今天有什么提醒？", icon: Bell },
  { label: "帮我排一下日程", icon: Calendar },
  { label: "复盘一下这周", icon: Flame },
];

// 提醒图标映射
const REMINDER_ICONS: Record<string, React.ComponentType<any>> = {
  water: Droplets,
  sleep: Moon,
  fitness: Dumbbell,
  medication: Pill,
};

// ============================================================
// 首页
// ============================================================

export default function HomePage() {
  const today = todayStr();
  const now = new Date();
  const { sendAndNavigate } = useAgent();
  const router = useRouter();

  // ── 数据源 ──
  const todayScheduleTasks = useLiveQuery(() => getScheduleTasksByDate(today), [today], [] as ScheduleTask[]);
  const allScheduleTasks = useLiveQuery(() => getAllScheduleTasks(), [], [] as ScheduleTask[]);
  const [pendingReminders, setPendingReminders] = useState<Reminder[]>([]);
  useEffect(() => { getPendingReminders().then((r) => setPendingReminders(r.slice(0, 3))).catch(() => {}); }, []);

  // ── 核心待办（今日 q1 第一条，fallback → q2 第一条） ──
  const coreTask = useMemo(() => {
    const uncompleted = (todayScheduleTasks ?? []).filter((t) => !t.isCompleted);
    const q1 = uncompleted.find((t) => t.quadrant === "q1");
    if (q1) return q1;
    const q2 = uncompleted.find((t) => t.quadrant === "q2");
    if (q2) return q2;
    return null;
  }, [todayScheduleTasks]);

  // ── 今日任务 ──
  const todayTasks = useMemo(() => {
    return (todayScheduleTasks ?? []).filter(
      (t) =>
        t.date === today ||
        (t.type === "multi_day" && t.startDate && t.endDate && t.startDate <= today && t.endDate >= today),
    );
  }, [todayScheduleTasks, today]);

  const todayTasksTotal = todayTasks.length;

  const sortedTodayTasks = useMemo(() => {
    return [...todayTasks].sort((a, b) => {
      if (a.isCompleted !== b.isCompleted) return a.isCompleted ? 1 : -1;
      if (a.isImportant !== b.isImportant) return a.isImportant ? -1 : 1;
      return a.createdAt - b.createdAt;
    });
  }, [todayTasks]);

  // ── 即将开始（未来 7 天） ──
  const upcomingTasks = useMemo(() => {
    if (!allScheduleTasks) return [];
    const futureTasks: { title: string; subtitle: string; time: string; type: "会议" | "审批" }[] = [];
    const seen = new Set<string>();
    for (const t of allScheduleTasks) {
      if (seen.has(t.title)) continue;
      seen.add(t.title);
      if (t.date && t.date > today) {
        const d = new Date(t.date);
        const label = `${d.getMonth() + 1}/${d.getDate()}`;
        futureTasks.push({
          title: t.title,
          subtitle: t.note || "待办事项",
          time: `${label}`,
          type: t.isImportant ? "审批" : "会议",
        });
      }
    }
    return futureTasks.slice(0, 5);
  }, [allScheduleTasks, today]);

  // ────────── Render ──────────

  return (
    <div className="min-h-screen pb-[90px]">
      {/* ===== 精简 Header ===== */}
      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.35, ease: "easeOut" }}
        className="px-4 pt-12 pb-3"
      >
        <p className="text-[13px] font-medium" style={{ color: "var(--color-text-secondary)" }}>
          {greeting()} · {formatDateChinese(now)}
        </p>
      </motion.div>

      {/* ===== 核心待办高亮卡 ===== */}
      <div className="px-4 mb-4">
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.05, duration: 0.35, ease: "easeOut" }}
          className="p-5"
          style={{ background: "var(--color-surface-card)", borderRadius: "20px", boxShadow: "var(--shadow-card)" }}
        >
          <div className="flex items-center gap-2 mb-3">
            <div className="w-7 h-7 rounded-lg flex items-center justify-center" style={{ background: "var(--lifeflow-brand-50)" }}>
              <Zap className="w-4 h-4" style={{ color: "var(--lifeflow-primary)" }} />
            </div>
            <span className="text-[13px] font-semibold" style={{ color: "var(--lifeflow-primary)" }}>今日核心</span>
          </div>

          {coreTask ? (
            <>
              <p className="text-[20px] font-bold mb-1.5" style={{ color: "var(--color-text-primary)", letterSpacing: "-0.018em" }}>
                {coreTask.title}
              </p>
              <div className="flex items-center gap-3 text-[13px]" style={{ color: "var(--color-text-secondary)" }}>
                {coreTask.plannedTime > 0 && <span>预计 {formatDuration(coreTask.plannedTime)}</span>}
                <span className="px-2 py-0.5 rounded-md text-[11px]" style={{ background: "var(--lifeflow-brand-50)", color: "var(--lifeflow-primary)" }}>
                  {coreTask.quadrant === "q1" ? "重要紧急" : "重要不紧急"}
                </span>
              </div>
              <div className="flex gap-2 mt-4">
                <button
                  onClick={() => router.push("/focus")}
                  className="flex-1 py-2.5 rounded-full text-white text-[14px] font-semibold active:opacity-90"
                  style={{ background: "var(--lifeflow-primary)" }}
                >
                  开始专注
                </button>
                <Link
                  href="/tasks"
                  className="py-2.5 px-4 rounded-full text-[14px] font-medium active:opacity-70"
                  style={{ background: "var(--lifeflow-muted)", color: "var(--color-text-secondary)" }}
                >
                  查看全部
                </Link>
              </div>
            </>
          ) : (
            <>
              <p className="text-[17px] font-semibold mb-1.5" style={{ color: "var(--color-text-primary)" }}>
                今天还没有核心任务
              </p>
              <p className="text-[13px] mb-4" style={{ color: "var(--color-text-secondary)" }}>
                去事项页规划一个，或者问 AI 帮你安排
              </p>
              <div className="flex gap-2">
                <Link
                  href="/tasks"
                  className="flex-1 py-2.5 rounded-full text-center text-[14px] font-semibold text-white active:opacity-90"
                  style={{ background: "var(--lifeflow-primary)" }}
                >
                  去事项页
                </Link>
                <button
                  onClick={() => { sendAndNavigate("帮我安排今天的重要任务"); }}
                  className="py-2.5 px-4 rounded-full text-[14px] font-medium active:opacity-70"
                  style={{ background: "var(--lifeflow-muted)", color: "var(--color-text-secondary)" }}
                >
                  问 AI
                </button>
              </div>
            </>
          )}
        </motion.div>
      </div>

      {/* ===== AI 快捷指令 ===== */}
      <div className="px-4 mb-4">
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.08, duration: 0.35, ease: "easeOut" }}
        >
          <div className="flex gap-2">
            {QUICK_PROMPTS.map((p) => (
              <button
                key={p.label}
                onClick={() => { sendAndNavigate(p.label); }}
                className="flex-1 py-2.5 px-2 rounded-full text-[12px] font-medium flex items-center justify-center gap-1.5 active:opacity-70 transition-opacity"
                style={{ background: "var(--color-surface-card)", boxShadow: "var(--shadow-card)", color: "var(--color-text-primary)" }}
              >
                <p.icon className="w-3.5 h-3.5 flex-shrink-0" style={{ color: "var(--lifeflow-primary)" }} />
                {p.label}
              </button>
            ))}
          </div>
        </motion.div>
      </div>

      {/* ===== 今日提醒条 ===== */}
      {pendingReminders.length > 0 && (
        <div className="px-4 mb-4">
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.11, duration: 0.35, ease: "easeOut" }}
          >
            <Link
              href="/reminders"
              className="flex items-center gap-2 px-4 py-3 rounded-[20px] active:opacity-70"
              style={{ background: "var(--color-surface-card)", boxShadow: "var(--shadow-card)" }}
            >
              <Bell className="w-4 h-4 flex-shrink-0" style={{ color: "var(--lifeflow-primary)" }} />
              <div className="flex-1 min-w-0 flex items-center gap-2 overflow-hidden">
                {pendingReminders.map((r, i) => {
                  const Icon = REMINDER_ICONS[r.moduleType || ""];
                  return (
                    <span key={i} className="flex items-center gap-1 text-[12px] whitespace-nowrap" style={{ color: "var(--color-text-secondary)" }}>
                      {Icon && <Icon className="w-3 h-3" />}
                      {r.message || r.type}
                      {i < pendingReminders.length - 1 && (
                        <span style={{ color: "var(--color-text-disabled)" }}>·</span>
                      )}
                    </span>
                  );
                })}
              </div>
              <span className="text-[12px] font-medium whitespace-nowrap" style={{ color: "var(--lifeflow-primary)" }}>
                {pendingReminders.length} 条
              </span>
            </Link>
          </motion.div>
        </div>
      )}

      {/* ===== 今日任务列表 ===== */}
      <div className="px-4 mb-6">
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.14, duration: 0.35, ease: "easeOut" }}
          className="flex items-center justify-between mb-3"
        >
          <div className="flex items-center gap-2">
            <h2 className="text-[18px] font-semibold" style={{ color: "var(--color-text-primary)", letterSpacing: "-0.018em" }}>
              今日任务
            </h2>
            <span className="text-[12px] font-semibold px-2 py-0.5 rounded-full" style={{ backgroundColor: "var(--lifeflow-brand-50)", color: "var(--lifeflow-primary)" }}>
              {todayTasksTotal}
            </span>
          </div>
          <Link href="/tasks" className="text-[13px] font-medium" style={{ color: "var(--lifeflow-primary)" }}>
            查看全部
          </Link>
        </motion.div>

        <div className="flex flex-col gap-3">
          {sortedTodayTasks.length === 0 && (
            <motion.div
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.18, duration: 0.35 }}
              className="rounded-[20px] p-4 text-center"
              style={{ backgroundColor: "var(--color-surface-card)", boxShadow: "var(--shadow-card)" }}
            >
              <p className="text-[15px]" style={{ color: "var(--color-text-secondary)" }}>
                今天暂无任务
              </p>
            </motion.div>
          )}
          {sortedTodayTasks.slice(0, 5).map((task, i) => {
            const isDone = task.isCompleted;
            const priorityLabel = task.isImportant ? "高优先级" : "普通";
            const priorityColor = task.isImportant
              ? "var(--state-warning)"
              : isDone ? "var(--color-text-disabled)" : "var(--color-text-secondary)";

            return (
              <motion.div
                key={task.id}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.18 + i * 0.04, duration: 0.3, ease: "easeOut" }}
                className="rounded-[20px] p-4 flex items-center gap-3"
                style={{ backgroundColor: "var(--color-surface-card)", boxShadow: "var(--shadow-card)", opacity: isDone ? 0.6 : 1 }}
              >
                <div
                  className="w-[22px] h-[22px] rounded-full border-2 flex items-center justify-center flex-shrink-0"
                  style={{ borderColor: isDone ? "var(--color-text-disabled)" : "var(--lifeflow-primary)" }}
                >
                  {isDone ? (
                    <Check className="w-[14px] h-[14px]" style={{ color: "var(--color-text-disabled)" }} strokeWidth={2} />
                  ) : (
                    <div className="w-[10px] h-[10px] rounded-full" style={{ backgroundColor: "var(--lifeflow-primary)" }} />
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-[15px] font-medium truncate" style={{ color: isDone ? "var(--color-text-disabled)" : "var(--color-text-primary)", textDecoration: isDone ? "line-through" : "none" }}>
                    {task.title}
                  </p>
                  <p className="text-[12px] truncate" style={{ color: "var(--color-text-secondary)" }}>
                    {task.note || (task.goalId ? "目标关联" : "待办事项")}
                  </p>
                </div>
                <div className="flex-shrink-0 text-right">
                  <p className="text-[13px] font-medium whitespace-nowrap" style={{ color: "var(--color-text-secondary)" }}>
                    {task.plannedTime > 0 ? formatDuration(task.plannedTime) : "--"}
                  </p>
                  <p className="text-[11px] font-medium whitespace-nowrap" style={{ color: isDone ? "var(--color-text-disabled)" : priorityColor }}>
                    {isDone ? "已完成" : priorityLabel}
                  </p>
                </div>
              </motion.div>
            );
          })}
        </div>
      </div>

      {/* ===== 即将开始 ===== */}
      {upcomingTasks.length > 0 && (
        <div className="px-4 mb-6">
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.35, duration: 0.35, ease: "easeOut" }}
          >
            <div className="flex items-center gap-2 mb-3">
              <h2 className="text-[18px] font-semibold" style={{ color: "var(--color-text-primary)", letterSpacing: "-0.018em" }}>
                即将开始
              </h2>
            </div>
            <div className="flex flex-col gap-3">
              {upcomingTasks.map((item, i) => (
                <motion.div
                  key={i}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.4 + i * 0.05, duration: 0.3, ease: "easeOut" }}
                  className="rounded-[20px] p-4 flex items-center gap-3"
                  style={{ backgroundColor: "var(--color-surface-card)", boxShadow: "var(--shadow-card)" }}
                >
                  <div className="w-[22px] h-[22px] rounded-full border-2 flex items-center justify-center flex-shrink-0" style={{ borderColor: "var(--lifeflow-primary)" }} />
                  <div className="flex-1 min-w-0">
                    <p className="text-[15px] font-medium truncate" style={{ color: "var(--color-text-primary)" }}>
                      {item.title}
                    </p>
                    <p className="text-[12px] truncate" style={{ color: "var(--color-text-secondary)" }}>
                      {item.subtitle}
                    </p>
                  </div>
                  <div className="flex-shrink-0 text-right">
                    <p className="text-[13px] font-medium whitespace-nowrap" style={{ color: "var(--color-text-secondary)" }}>
                      {item.time}
                    </p>
                    <span
                      className="inline-block text-[11px] font-medium px-2 py-0.5 rounded-full whitespace-nowrap"
                      style={{
                        backgroundColor: item.type === "会议" ? "var(--lifeflow-brand-50)" : "var(--lifeflow-muted)",
                        color: item.type === "会议" ? "var(--lifeflow-primary)" : "var(--color-text-secondary)",
                      }}
                    >
                      {item.type}
                    </span>
                  </div>
                </motion.div>
              ))}
            </div>
          </motion.div>
        </div>
      )}
    </div>
  );
}
