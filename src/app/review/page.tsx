"use client";

import { useState, useEffect, useCallback } from "react";
import { motion } from "framer-motion";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  CheckCheck, ListTodo, TrendingUp,
  AlertCircle, Target, Zap, BarChart3, Plus, Trash2,
  Save, Lightbulb, AlertTriangle, Rocket, ChevronLeft, ChevronRight,
  X, Check, Sparkles, ArrowRight, Activity, Bot,
} from "lucide-react";
import {
  getReviewRecordByPeriod, createOrUpdateReviewRecord,
  createTask, getAllGoals, getPlansByGoal,
} from "@/lib/db";
import { showToast } from "@/components/ui/Toast";
import type { ReviewRecord, Task, ProjectV2, HabitLog, Goal, Plan } from "@/lib/types";
import { PRIORITY_CONFIG } from "@/lib/types";
import { db } from "@/lib/db";
import { isAIEnabled, isOnline } from "@/lib/aiClient";
import { analyzeReview, adoptImprovements } from "@/lib/aiReviewAnalyzer";
import EngineReviewEntry from "@/components/engine/EngineReviewEntry";
import PDCAReviewFlow from "@/components/engine/PDCAReviewFlow";

// ==================== 工具函数 ====================

type PeriodType = "week" | "month";

function getDateStrLocal(y: number, m: number, d: number): string {
  return `${y}-${String(m).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
}

function getDateStr(ts: number): string {
  const d = new Date(ts);
  return getDateStrLocal(d.getFullYear(), d.getMonth() + 1, d.getDate());
}

function getPeriodRange(
  periodType: PeriodType,
  offset: number
): { start: number; end: number; label: string; dateKey: string } {
  const now = new Date();
  if (periodType === "week") {
    // Monday-based week
    const dayOfWeek = now.getDay();
    const mondayOffset = dayOfWeek === 0 ? -6 : 1 - dayOfWeek;
    const monday = new Date(now.getFullYear(), now.getMonth(), now.getDate() + mondayOffset + offset * 7);
    monday.setHours(0, 0, 0, 0);
    const sunday = new Date(monday);
    sunday.setDate(sunday.getDate() + 6);
    sunday.setHours(23, 59, 59, 999);

    const sm = monday.getMonth() + 1;
    const sd = monday.getDate();
    const em = sunday.getMonth() + 1;
    const ed = sunday.getDate();
    return {
      start: monday.getTime(),
      end: sunday.getTime(),
      label: `${sm}/${sd} - ${em}/${ed}`,
      dateKey: `week-${getDateStrLocal(monday.getFullYear(), sm, sd)}`,
    };
  } else {
    const year = now.getFullYear();
    const month = now.getMonth() + 1 + offset;
    const realMonth = ((month - 1) % 12 + 12) % 12 + 1;
    const realYear = year + Math.floor((month - 1) / 12);
    const start = new Date(realYear, realMonth - 1, 1, 0, 0, 0, 0);
    const end = new Date(realYear, realMonth, 0, 23, 59, 59, 999);
    return {
      start: start.getTime(),
      end: end.getTime(),
      label: `${realYear}年${realMonth}月`,
      dateKey: `${realYear}-${String(realMonth).padStart(2, "0")}`,
    };
  }
}

// ==================== 子组件 ====================

function PeriodSwitcher({
  periodType,
  setPeriodType,
  periodOffset,
  setPeriodOffset,
  range,
}: {
  periodType: PeriodType;
  setPeriodType: (t: PeriodType) => void;
  periodOffset: number;
  setPeriodOffset: (o: number) => void;
  range: { start: number; end: number; label: string };
}) {
  return (
    <div className="flex items-center gap-3">
      {/* 周/月切换 */}
      <div className="relative flex bg-gray-100 dark:bg-gray-800 rounded-xl p-1">
        <motion.div
          layoutId="review-period-indicator"
          className="absolute top-1 bottom-1 rounded-lg bg-white dark:bg-gray-700 shadow-sm z-0"
          style={{ width: "calc(50% - 4px)" }}
          animate={{ left: periodType === "week" ? "4px" : "calc(50% + 0px)" }}
          transition={{ duration: 0.25, ease: [0.4, 0, 0.2, 1] }}
        />
        {(["week", "month"] as PeriodType[]).map((t) => (
          <button
            key={t}
            onClick={() => {
              setPeriodType(t);
              setPeriodOffset(0);
            }}
            className={`relative z-10 px-4 py-2 text-sm font-medium rounded-lg transition-colors duration-200 ${
              periodType === t
                ? "text-gray-900 dark:text-white font-semibold"
                : "text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300"
            }`}
          >
            {t === "week" ? "周度" : "月度"}
          </button>
        ))}
      </div>

      {/* 前后导航 */}
      <button
        onClick={() => setPeriodOffset(periodOffset - 1)}
        className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 text-gray-500 dark:text-gray-400 transition-colors"
      >
        <ChevronLeft className="w-4 h-4" />
      </button>
      <span className="text-sm font-semibold text-gray-700 dark:text-gray-300 min-w-[120px] text-center">
        {range.label}
      </span>
      <button
        onClick={() => setPeriodOffset(periodOffset + 1)}
        className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 text-gray-500 dark:text-gray-400 transition-colors"
      >
        <ChevronRight className="w-4 h-4" />
      </button>

      {periodOffset !== 0 && (
        <button
          onClick={() => setPeriodOffset(0)}
          className="px-3 py-1.5 text-xs font-medium bg-indigo-100 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400 rounded-lg hover:bg-indigo-200 dark:hover:bg-indigo-900/50 transition-colors"
        >
          今天
        </button>
      )}
    </div>
  );
}

function OverviewCard({
  icon,
  iconColor,
  label,
  value,
  sub,
  iconBg,
}: {
  icon: React.ReactNode;
  iconColor: string;
  iconBg: string;
  label: string;
  value: string | number;
  sub?: string;
}) {
  return (
    <div className="bg-white dark:bg-gray-900 rounded-2xl p-4 border border-gray-100 dark:border-gray-800 shadow-sm">
      <div className="flex items-center gap-2 mb-2">
        <div className={`w-8 h-8 rounded-lg ${iconBg} flex items-center justify-center`}>
          <span className={iconColor}>{icon}</span>
        </div>
        <span className="text-xs text-gray-500 dark:text-gray-400">{label}</span>
      </div>
      <p className="text-2xl font-bold text-gray-900 dark:text-white">{value}</p>
      {sub && <p className="text-xs text-gray-400 dark:text-gray-500 mt-1">{sub}</p>}
    </div>
  );
}

function PriorityBar({
  label,
  count,
  total,
  color,
}: {
  label: string;
  count: number;
  total: number;
  color: string;
}) {
  const pct = total > 0 ? Math.round((count / total) * 100) : 0;
  return (
    <div className="flex items-center gap-2">
      <span className="text-xs text-gray-600 dark:text-gray-400 w-20 shrink-0">{label}</span>
      <div className="flex-1 h-2 bg-gray-100 dark:bg-gray-800 rounded-full overflow-hidden">
        <motion.div
          initial={{ width: 0 }}
          animate={{ width: `${Math.min(pct, 100)}%` }}
          className={`h-full rounded-full ${color}`}
          transition={{ duration: 0.5, ease: "easeOut" }}
        />
      </div>
      <span className="text-xs font-mono text-gray-500 dark:text-gray-400 w-16 text-right">
        {count} ({pct}%)
      </span>
    </div>
  );
}

function ProjectProgressBar({
  name,
  done,
  total,
  color,
}: {
  name: string;
  done: number;
  total: number;
  color: string;
}) {
  const pct = total > 0 ? Math.round((done / total) * 100) : 0;
  return (
    <div className="space-y-1">
      <div className="flex items-center justify-between">
        <span className="text-xs font-medium text-gray-700 dark:text-gray-300">{name}</span>
        <span className="text-xs text-gray-500 dark:text-gray-400">{done}/{total} ({pct}%)</span>
      </div>
      <div className="h-2 bg-gray-100 dark:bg-gray-800 rounded-full overflow-hidden">
        <motion.div
          initial={{ width: 0 }}
          animate={{ width: `${Math.min(pct, 100)}%` }}
          style={{ backgroundColor: color || "#6366F1" }}
          className="h-full rounded-full"
          transition={{ duration: 0.5, ease: "easeOut" }}
        />
      </div>
    </div>
  );
}

// ==================== 主页面 ====================

export default function ReviewPage() {
  const [mode, setMode] = useState<"engine" | "classic">("engine");
  const [pdcaWeek, setPdcaWeek] = useState<{ start: string; end: string } | null>(null);
  const [periodType, setPeriodType] = useState<PeriodType>("week");
  const [periodOffset, setPeriodOffset] = useState(0);
  const [loading, setLoading] = useState(true);
  const [allTasks, setAllTasks] = useState<Task[]>([]);
  const [projects, setProjects] = useState<ProjectV2[]>([]);
  const [habitLogs, setHabitLogs] = useState<HabitLog[]>([]);

  // 回顾记录编辑器状态
  const [highlights, setHighlights] = useState<string[]>([]);
  const [problems, setProblems] = useState<string[]>([]);
  const [improvements, setImprovements] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);
  const [existingRecord, setExistingRecord] = useState<ReviewRecord | null>(null);
  const [editingIndex, setEditingIndex] = useState<{ section: "h" | "p" | "i"; index: number } | null>(null);
  const [editValue, setEditValue] = useState("");
  const [goals, setGoals] = useState<Goal[]>([]);
  const [plans, setPlans] = useState<Plan[]>([]);
  const [showGoalPlans, setShowGoalPlans] = useState(false);
  const [genTaskGoalId, setGenTaskGoalId] = useState<number | null>(null);
  const [genTaskPlanId, setGenTaskPlanId] = useState<number | null>(null);
  const router = useRouter();

  const [aiAnalyzing, setAiAnalyzing] = useState(false);
  const [aiResult, setAiResult] = useState<{ summary: string; problems: string[]; improvements: string[] } | null>(null);

  const range = getPeriodRange(periodType, periodOffset);

  // 加载数据
  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const [tasks, projs, hLogs] = await Promise.all([
        db.tasks.toArray(),
        db.projectV2s.toArray(),
        db.habit_logs.toArray(),
      ]);
      setAllTasks(tasks);
      setProjects(projs);
      setHabitLogs(hLogs);

      const allGoals = await getAllGoals();
      setGoals(allGoals);

      // 加载该周期的回顾记录
      const record = await getReviewRecordByPeriod(
        periodType,
        range.start,
        range.end
      );
      if (record) {
        setExistingRecord(record);
        setHighlights(record.highlights || []);
        setProblems(record.problems || []);
        setImprovements(record.improvements || []);
      } else {
        setExistingRecord(null);
        setHighlights([]);
        setProblems([]);
        setImprovements([]);
      }
    } catch {
      // silent
    } finally {
      setLoading(false);
    }
  }, [periodType, periodOffset, range.start, range.end]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  useEffect(() => {
    if (genTaskGoalId) {
      getPlansByGoal(genTaskGoalId).then(setPlans).catch(() => setPlans([]));
    } else {
      setPlans([]);
    }
  }, [genTaskGoalId]);

  // ── 计算统计 ──

  // 该周期内的任务
  const periodTasks = allTasks.filter((t) => {
    // 按 startTime 或 createdAt 判断是否在周期内
    const refTime = t.startTime || t.createdAt;
    if (!refTime) return false;
    return refTime >= range.start && refTime <= range.end;
  });

  // 执行概况
  const completedCount = periodTasks.filter((t) => t.status === "done").length;
  const activeCount = periodTasks.filter((t) => t.status === "active").length;
  const totalInPeriod = completedCount + activeCount;
  const completionRate = totalInPeriod > 0 ? Math.round((completedCount / totalInPeriod) * 100) : 0;

  // 过期任务：有 dueDate 且已过期且未完成
  const now = Date.now();
  const overdueCount = allTasks.filter(
    (t) => t.dueDate && t.dueDate < now && t.status === "active"
  ).length;

  // 周期天数
  const periodDays = Math.ceil((range.end - range.start) / (1000 * 60 * 60 * 24)) + 1;
  const avgDaily = periodDays > 0 ? (completedCount / periodDays).toFixed(1) : "0";

  // 优先级分布
  const priorityCounts: Record<string, number> = {};
  for (const t of periodTasks) {
    const p = t.priority || "not-urgent-not-important";
    priorityCounts[p] = (priorityCounts[p] || 0) + 1;
  }
  const totalPriorityCount = Object.values(priorityCounts).reduce((a, b) => a + b, 0);

  // 短期事件
  const shortTermTasks = periodTasks.filter((t) => t.type === "shortterm" || t.classification === "short-term");
  const stCompleted = shortTermTasks.filter((t) => t.status === "done").length;
  const stTotal = shortTermTasks.length;
  const stRate = stTotal > 0 ? Math.round((stCompleted / stTotal) * 100) : 0;
  const stOverdue = shortTermTasks.filter(
    (t) => t.dueDate && t.dueDate < now && t.status === "active"
  ).length;

  // 截止日期分布（短期事件）
  const stWithDeadline = shortTermTasks.filter((t) => t.dueDate);
  const deadlineMet = stWithDeadline.filter(
    (t) => t.status === "done" && t.dueDate
  ).length;
  const deadlineTotal = stWithDeadline.length;

  // 每日习惯
  const habitTasks = periodTasks.filter((t) => t.type === "habit");
  const habitIds = new Set(habitTasks.map((t) => t.id).filter(Boolean) as number[]);
  const periodHabitLogs = habitLogs.filter((l) => {
    if (!habitIds.has(l.taskId)) return false;
    const dayTs = new Date(l.date + "T00:00:00").getTime();
    return dayTs >= range.start && dayTs <= range.end;
  });
  const habitCompleted = periodHabitLogs.length;
  const habitTotal = habitTasks.length * periodDays;
  const habitRate = habitTotal > 0 ? Math.round((habitCompleted / habitTotal) * 100) : 0;

  // 连续打卡天数（简单计算：从今天往前看连续的天数）
  const getConsecutiveDays = (): number => {
    if (habitTasks.length === 0) return 0;
    const logDates = new Set(periodHabitLogs.map((l) => l.date));
    let consecutive = 0;
    const today = new Date();
    while (true) {
      const d = getDateStrLocal(today.getFullYear(), today.getMonth() + 1, today.getDate() - consecutive);
      if (logDates.has(d)) {
        consecutive++;
      } else {
        break;
      }
    }
    return consecutive;
  };
  const consecutiveDays = getConsecutiveDays();

  // 中断次数（累计有几天没打卡任何习惯）
  const breakCount = (() => {
    let breaks = 0;
    const cur = new Date(range.start);
    while (cur.getTime() <= range.end) {
      const d = getDateStr(cur.getTime());
      const hasLog = periodHabitLogs.some((l) => l.date === d);
      if (!hasLog) breaks++;
      cur.setDate(cur.getDate() + 1);
    }
    return breaks;
  })();

  // 项目完成统计
  const projectStats = (() => {
    const map: Record<string, { name: string; color: string; done: number; total: number }> = {};
    for (const t of periodTasks) {
      if (!t.projectId) continue;
      const pidStr = String(t.projectId);
      const proj = projects.find((p) => p.id !== undefined && String(p.id) === pidStr);
      if (proj) {
        if (!map[pidStr]) map[pidStr] = { name: proj.name, color: proj.color || "#6366F1", done: 0, total: 0 };
        map[pidStr].total++;
        if (t.status === "done") map[pidStr].done++;
      }
    }
    return Object.values(map).sort((a, b) => b.total - a.total);
  })();

  // ── 保存回顾 ──

  const handleSave = async () => {
    setSaving(true);
    try {
      await createOrUpdateReviewRecord({
        type: periodType === "week" ? "weekly" : "monthly",
        dateKey: range.dateKey,
        stats: {
          tasksDone: completedCount,
          tasksPending: activeCount,
          tasksOverdue: overdueCount,
          habitStreaks: consecutiveDays,
          focusMinutes: 0,
          financeIncome: 0,
          financeExpense: 0,
        },
        highlights: highlights.filter(Boolean),
        problems: problems.filter(Boolean),
        improvements: improvements.filter(Boolean),
        periodType,
        periodStart: range.start,
        periodEnd: range.end,
        goalIds: goals.filter(g => g.status === "active" || g.status === "completed" || g.status === "paused").map(g => g.id!).filter(Boolean),
      });
      showToast({ message: "回顾已保存", type: "success" });
      loadData();
    } catch {
      showToast({ message: "保存失败", type: "error" });
    } finally {
      setSaving(false);
    }
  };

  // ── 生成本期待办 ──

  const handleGenerateTasks = async () => {
    const items = improvements.filter(Boolean);
    if (items.length === 0) {
      showToast({ message: "暂无改进项可生成", type: "warning" });
      return;
    }
    try {
      for (const item of improvements) {
        if (!item.trim()) continue;
        await createTask({
          title: `[改进] ${item.trim()}`,
          type: "shortterm",
          status: "active",
          priority: "not-urgent-important",
          tags: ["改进", "review"],
          goalId: genTaskGoalId ?? undefined,
          planId: genTaskPlanId ?? undefined,
        });
      }
      showToast({ message: `已生成 ${improvements.length} 个待办任务`, type: "success" });
    } catch {
      showToast({ message: "生成失败", type: "error" });
    }
  };

  // ── 编辑项辅助函数 ──

  const handleAddItem = (setter: React.Dispatch<React.SetStateAction<string[]>>) => {
    setter((prev) => [...prev, ""]);
  };

  const handleDeleteItem = (
    index: number,
    setter: React.Dispatch<React.SetStateAction<string[]>>
  ) => {
    setter((prev) => prev.filter((_, i) => i !== index));
    if (editingIndex?.index === index) setEditingIndex(null);
  };

  const startEdit = (section: "h" | "p" | "i", index: number, current: string) => {
    setEditingIndex({ section, index });
    setEditValue(current);
  };

  const commitEdit = (
    section: "h" | "p" | "i",
    index: number,
    setter: React.Dispatch<React.SetStateAction<string[]>>
  ) => {
    setter((prev) => {
      const next = [...prev];
      next[index] = editValue.trim();
      return next;
    });
    setEditingIndex(null);
  };

  // ── 渲染 ──

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-slate-50 to-white dark:from-gray-950 dark:to-gray-900">
        <div className="mx-auto max-w-3xl px-5 pt-8 pb-24 md:px-8 md:pt-10">
          <div className="skeleton h-8 w-20 mb-2" />
          <div className="skeleton h-4 w-40 mb-6" />
          <div className="skeleton h-9 w-full rounded-xl mb-6" />
          <div className="grid grid-cols-2 gap-3 mb-6">
            {[1, 2, 3, 4].map((i) => (
              <div key={i} className="skeleton h-24 rounded-2xl" />
            ))}
          </div>
          <div className="skeleton h-48 rounded-2xl mb-6" />
          <div className="skeleton h-64 rounded-2xl" />
        </div>
      </div>
    );
  }

  // 渲染编辑列表组件
  const renderEditableList = (
    title: string,
    icon: React.ReactNode,
    items: string[],
    setter: React.Dispatch<React.SetStateAction<string[]>>,
    section: "h" | "p" | "i",
    placeholder: string,
  ) => (
    <div className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-100 dark:border-gray-800 shadow-sm p-4">
      <div className="flex items-center gap-2 mb-3">
        {icon}
        <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300">{title}</h3>
        <span className="text-xs text-gray-400">({items.filter(Boolean).length} 项)</span>
      </div>
      <div className="space-y-2">
        {items.map((item, i) => (
          <div key={i} className="flex items-center gap-2 group">
            <span className="w-1.5 h-1.5 rounded-full bg-gray-300 dark:bg-gray-600 shrink-0" />
            {editingIndex?.section === section && editingIndex.index === i ? (
              <div className="flex-1 flex items-center gap-1">
                <input
                  type="text"
                  value={editValue}
                  onChange={(e) => setEditValue(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") commitEdit(section, i, setter);
                    if (e.key === "Escape") setEditingIndex(null);
                  }}
                  className="flex-1 px-2 py-1 text-sm rounded-lg border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  autoFocus
                />
                <button
                  onClick={() => commitEdit(section, i, setter)}
                  className="p-1 text-emerald-500 hover:bg-emerald-50 dark:hover:bg-emerald-900/20 rounded"
                >
                  <Check className="w-3.5 h-3.5" />
                </button>
                <button
                  onClick={() => setEditingIndex(null)}
                  className="p-1 text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800 rounded"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>
            ) : (
              <>
                <span
                  className="flex-1 text-sm text-gray-700 dark:text-gray-300 cursor-pointer hover:text-indigo-600 dark:hover:text-indigo-400"
                  onClick={() => startEdit(section, i, item)}
                >
                  {item || <span className="text-gray-400 italic">点击编辑...</span>}
                </span>
                <button
                  onClick={() => handleDeleteItem(i, setter)}
                  className="p-1 text-gray-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded opacity-0 group-hover:opacity-100 transition-opacity"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </>
            )}
          </div>
        ))}
      </div>
      <button
        onClick={() => handleAddItem(setter)}
        className="mt-3 flex items-center gap-1 text-xs font-medium text-indigo-600 dark:text-indigo-400 hover:text-indigo-700 dark:hover:text-indigo-300 transition-colors"
      >
        <Plus className="w-3.5 h-3.5" />
        添加{placeholder}
      </button>
    </div>
  );

  return (
    <div className="min-h-screen pb-24" style={{ backgroundColor: "var(--surface-desk)", color: "var(--text-primary)" }}>
      <div className="mx-auto max-w-3xl px-5 pt-8 pb-24 md:px-8 md:pt-10 space-y-5">
        {/* 标题 */}
        <div>
          <h1 className="font-hand font-bold" style={{ fontSize: "var(--text-display)", color: "var(--text-primary)" }}>编织日志</h1>
          <p className="text-sm mt-1" style={{ color: "var(--text-secondary)" }}>周期性复盘，持续改进</p>
        </div>

        {/* 模式切换 */}
        <div className="relative grid grid-cols-2 gap-1 rounded-xl p-1"
          style={{ backgroundColor: "var(--surface-fabric)" }}>
          <motion.div
            layoutId="review-mode-ind"
            className="absolute top-1 bottom-1 rounded-lg bg-white dark:bg-gray-700 shadow-sm z-0"
            style={{ width: "calc(50% - 4px)" }}
            animate={{ left: mode === "engine" ? "4px" : "calc(50% + 0px)" }}
            transition={{ duration: 0.25 }}
            />
            <button onClick={() => setMode("engine")}
            className={`relative z-10 py-2 text-sm font-medium rounded-lg ${mode === "engine" ? "text-gray-900 dark:text-white" : "text-gray-500"}`}>
            PDCA复盘
          </button>
          <button onClick={() => setMode("classic")}
            className={`relative z-10 py-2 text-sm font-medium rounded-lg ${mode === "classic" ? "text-gray-900 dark:text-white" : "text-gray-500"}`}>
            经典回顾
          </button>
        </div>

        {mode === "engine" ? (
          pdcaWeek ? (
            <PDCAReviewFlow
              weekStart={pdcaWeek.start}
              weekEnd={pdcaWeek.end}
              onComplete={() => setPdcaWeek(null)}
              onExit={() => setPdcaWeek(null)}
            />
          ) : (
            <EngineReviewEntry
              onStartReview={(start, end) => setPdcaWeek({ start, end })}
            />
          )
        ) : (<>
        {/* 周期切换 */}
        <PeriodSwitcher
          periodType={periodType}
          setPeriodType={setPeriodType}
          periodOffset={periodOffset}
          setPeriodOffset={setPeriodOffset}
          range={range}
        />

        {/* 执行概况 */}
        <section>
          <h2 className="text-sm font-semibold text-gray-500 dark:text-gray-400 mb-3 uppercase tracking-wide">
            执行概况
          </h2>
          <div className="grid grid-cols-2 gap-3">
            <OverviewCard
              icon={<CheckCheck className="w-4 h-4" />}
              iconColor="text-emerald-600"
              iconBg="bg-emerald-100 dark:bg-emerald-900/30"
              label="任务完成"
              value={completedCount}
              sub="本周期完成的任务数"
            />
            <OverviewCard
              icon={<TrendingUp className="w-4 h-4" />}
              iconColor="text-blue-600"
              iconBg="bg-blue-100 dark:bg-blue-900/30"
              label="完成率"
              value={`${completionRate}%`}
              sub={`${completedCount}/${totalInPeriod} 个任务`}
            />
            <OverviewCard
              icon={<AlertCircle className="w-4 h-4" />}
              iconColor="text-red-600"
              iconBg="bg-red-100 dark:bg-red-900/30"
              label="过期任务"
              value={overdueCount}
              sub="所有未完成的过期任务"
            />
            <OverviewCard
              icon={<BarChart3 className="w-4 h-4" />}
              iconColor="text-violet-600"
              iconBg="bg-violet-100 dark:bg-violet-900/30"
              label="日均完成"
              value={avgDaily}
              sub={`${periodDays} 天周期`}
            />
          </div>
        </section>

        {/* 优先级分布 */}
        <section className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-100 dark:border-gray-800 shadow-sm p-4">
          <h2 className="text-sm font-semibold text-gray-500 dark:text-gray-400 mb-4 uppercase tracking-wide">
            优先级分布
          </h2>
          <div className="space-y-3">
            {PRIORITY_CONFIG.map((p) => (
              <PriorityBar
                key={p.key}
                label={p.label}
                count={priorityCounts[p.key] || 0}
                total={totalPriorityCount}
                color={p.bg.replace("bg-", "bg-").replace("100", "500")}
              />
            ))}
          </div>
        </section>

        {/* 目标达成 */}
        <section className="space-y-3">
          <h2 className="text-sm font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide">
            目标达成
          </h2>

          {/* 短期事件 */}
          <div className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-100 dark:border-gray-800 shadow-sm p-4">
            <div className="flex items-center gap-2 mb-3">
              <Target className="w-4 h-4 text-amber-500" />
              <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300">短期事件</h3>
            </div>
            <div className="grid grid-cols-3 gap-4">
              <div>
                <p className="text-xs text-gray-400 dark:text-gray-500">完成率</p>
                <p className="text-lg font-bold text-gray-900 dark:text-white">{stRate}%</p>
                <p className="text-xs text-gray-400">{stCompleted}/{stTotal} 个</p>
              </div>
              <div>
                <p className="text-xs text-gray-400 dark:text-gray-500">过期率</p>
                <p className="text-lg font-bold text-red-500">
                  {stTotal > 0 ? Math.round((stOverdue / stTotal) * 100) : 0}%
                </p>
                <p className="text-xs text-gray-400">{stOverdue} 个过期</p>
              </div>
              <div>
                <p className="text-xs text-gray-400 dark:text-gray-500">截止日期</p>
                <p className="text-lg font-bold text-gray-900 dark:text-white">
                  {deadlineTotal > 0 ? Math.round((deadlineMet / deadlineTotal) * 100) : 0}%
                </p>
                <p className="text-xs text-gray-400">{deadlineMet}/{deadlineTotal} 达标</p>
              </div>
            </div>
          </div>

          {/* 每日习惯 */}
          <div className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-100 dark:border-gray-800 shadow-sm p-4">
            <div className="flex items-center gap-2 mb-3">
              <Sparkles className="w-4 h-4 text-purple-500" />
              <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300">每日习惯</h3>
            </div>
            <div className="grid grid-cols-3 gap-4">
              <div>
                <p className="text-xs text-gray-400 dark:text-gray-500">完成率</p>
                <p className="text-lg font-bold text-gray-900 dark:text-white">{habitRate}%</p>
                <p className="text-xs text-gray-400">{habitCompleted}/{habitTotal || "-"} 次</p>
              </div>
              <div>
                <p className="text-xs text-gray-400 dark:text-gray-500">连续打卡</p>
                <p className="text-lg font-bold text-emerald-500">{consecutiveDays}</p>
                <p className="text-xs text-gray-400">天</p>
              </div>
              <div>
                <p className="text-xs text-gray-400 dark:text-gray-500">中断次数</p>
                <p className="text-lg font-bold text-amber-500">{breakCount}</p>
                <p className="text-xs text-gray-400">{periodDays} 天中</p>
              </div>
            </div>
          </div>
        </section>

        {/* 项目完成 */}
        {projectStats.length > 0 && (
          <section className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-100 dark:border-gray-800 shadow-sm p-4">
            <h2 className="text-sm font-semibold text-gray-500 dark:text-gray-400 mb-4 uppercase tracking-wide">
              项目完成
            </h2>
            <div className="space-y-3">
              {projectStats.map((ps) => (
                <ProjectProgressBar
                  key={ps.name}
                  name={ps.name}
                  done={ps.done}
                  total={ps.total}
                  color={ps.color}
                />
              ))}
            </div>
          </section>
        )}

        {/* 目标达成分析 */}
        {goals.filter(g => g.status !== "archived").length > 0 && (
          <section className="space-y-3">
            <h2 className="text-sm font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide">
              目标达成分析
            </h2>

            {/* 概要卡片 */}
            <div className="grid grid-cols-2 gap-3">
              <OverviewCard
                icon={<Target className="w-4 h-4" />}
                iconColor="text-blue-600"
                iconBg="bg-blue-100 dark:bg-blue-900/30"
                label="活跃目标"
                value={goals.filter(g => g.status === "active").length}
                sub={`总计 ${goals.filter(g => g.status !== "archived").length} 个目标`}
              />
              <OverviewCard
                icon={<CheckCheck className="w-4 h-4" />}
                iconColor="text-emerald-600"
                iconBg="bg-emerald-100 dark:bg-emerald-900/30"
                label="已达成"
                value={goals.filter(g => g.status === "completed").length}
                sub={`达成率 ${goals.filter(g => g.status !== "archived").length > 0 ? Math.round((goals.filter(g => g.status === "completed").length / goals.filter(g => g.status !== "archived").length) * 100) : 0}%`}
              />
              <OverviewCard
                icon={<AlertCircle className="w-4 h-4" />}
                iconColor="text-red-600"
                iconBg="bg-red-100 dark:bg-red-900/30"
                label="进度滞后"
                value={goals.filter(g => {
                  if (g.status !== "active" || !g.deadline) return false;
                  const nowTs = Date.now();
                  const totalDuration = g.deadline - g.createdAt;
                  const elapsed = nowTs - g.createdAt;
                  const expectedProgress = totalDuration > 0 ? (elapsed / totalDuration) * 100 : 0;
                  return g.progress < 50 && g.progress < expectedProgress - 20;
                }).length}
                sub="进度低于预期20%以上"
              />
              <OverviewCard
                icon={<BarChart3 className="w-4 h-4" />}
                iconColor="text-violet-600"
                iconBg="bg-violet-100 dark:bg-violet-900/30"
                label="整体达成率"
                value={`${goals.filter(g => g.status !== "archived").length > 0 ? Math.round(goals.filter(g => g.status === "completed").length / goals.filter(g => g.status !== "archived").length * 100) : 0}%`}
                sub={`${goals.filter(g => g.status === "completed").length}/${goals.filter(g => g.status !== "archived").length}`}
              />
            </div>

            {/* 按项目分组的活跃目标列表 */}
            {projects.length > 0 && goals.filter(g => g.status === "active" || g.status === "paused").length > 0 && (
              <div className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-100 dark:border-gray-800 shadow-sm p-4">
                <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-3 flex items-center gap-2">
                  <Target className="w-4 h-4 text-indigo-500" />
                  活跃目标进度
                </h3>
                <div className="space-y-4">
                  {(() => {
                    const activeGoals = goals.filter(g => g.status === "active" || g.status === "paused");
                    const projectGoalMap: Record<string, Goal[]> = {};
                    for (const g of activeGoals) {
                      const pid = String(g.projectId);
                      if (!projectGoalMap[pid]) projectGoalMap[pid] = [];
                      projectGoalMap[pid].push(g);
                    }
                    return Object.entries(projectGoalMap).map(([pid, pgoals]) => {
                      const proj = projects.find(p => String(p.id) === pid);
                      return (
                        <div key={pid}>
                          {proj && <p className="text-xs font-semibold text-gray-500 dark:text-gray-400 mb-2">{proj.name}</p>}
                          <div className="space-y-2">
                            {pgoals.map(goal => (
                              <button
                                key={goal.id}
                                onClick={() => router.push(`/goals/${goal.id}`)}
                                className="w-full text-left"
                              >
                                <div className="space-y-1">
                                  <div className="flex items-center justify-between">
                                    <div className="flex items-center gap-2">
                                      <div 
                                        className="w-2 h-2 rounded-full" 
                                        style={{ backgroundColor: PRIORITY_CONFIG.find(p => p.key === goal.priority)?.hex || "#6B7280" }}
                                      />
                                      <span className="text-sm font-medium text-gray-700 dark:text-gray-300">{goal.name}</span>
                                      <span className={`text-xs px-1.5 py-0.5 rounded-full ${
                                        goal.status === "paused" ? "bg-gray-100 text-gray-500 dark:bg-gray-800 dark:text-gray-400" :
                                        goal.status === "completed" ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400" :
                                        "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400"
                                      }`}>
                                        {goal.status === "paused" ? "暂停" : goal.status === "completed" ? "完成" : "进行中"}
                                      </span>
                                    </div>
                                    <span className="text-xs text-gray-500">{goal.progress}%</span>
                                  </div>
                                  <div className="h-1.5 bg-gray-100 dark:bg-gray-800 rounded-full overflow-hidden">
                                    <motion.div
                                      initial={{ width: 0 }}
                                      animate={{ width: `${Math.min(goal.progress, 100)}%` }}
                                      className={`h-full rounded-full ${
                                        goal.progress >= 100 ? "bg-emerald-500" :
                                        goal.progress >= 60 ? "bg-blue-500" :
                                        goal.progress >= 30 ? "bg-amber-500" : "bg-red-500"
                                      }`}
                                      transition={{ duration: 0.5, ease: "easeOut" }}
                                    />
                                  </div>
                                  {goal.deadline && (
                                    <p className="text-xs text-gray-400">
                                      截止: {new Date(goal.deadline).toLocaleDateString("zh-CN")}
                                      {goal.progress < 50 && goal.deadline < Date.now() + 7 * 24 * 60 * 60 * 1000 && (
                                        <span className="text-red-500 ml-2">临近!</span>
                                      )}
                                    </p>
                                  )}
                                </div>
                              </button>
                            ))}
                          </div>
                        </div>
                      );
                    });
                  })()}
                </div>
              </div>
            )}
          </section>
        )}

        {/* 回顾记录编辑器 */}
        <section className="space-y-3">
          <h2 className="text-sm font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide">
            周期回顾
          </h2>

          {isAIEnabled() && isOnline() && !aiResult && (
            <button
              onClick={async () => {
                setAiAnalyzing(true);
                try {
                  const result = await analyzeReview(range.start, range.end, highlights, problems);
                  setAiResult(result);
                  showToast({ message: "AI分析完成", type: "success" });
                } catch (err: any) {
                  showToast({ message: err.message || "AI分析失败", type: "error" });
                } finally {
                  setAiAnalyzing(false);
                }
              }}
              disabled={aiAnalyzing}
              className="flex items-center gap-2 px-4 py-2 text-xs font-medium text-violet-600 bg-violet-50 dark:bg-violet-900/20 rounded-xl hover:bg-violet-100 transition-colors"
            >
              <Sparkles className={`w-3.5 h-3.5 ${aiAnalyzing ? "animate-spin" : ""}`} />
              {aiAnalyzing ? "AI分析中..." : "AI 智能分析"}
            </button>
          )}

          {aiResult && (
            <div className="bg-violet-50 dark:bg-violet-900/20 rounded-xl p-4 space-y-3 mt-3">
              <div className="flex items-center gap-2">
                <Bot className="w-4 h-4 text-violet-500" />
                <span className="text-sm font-medium text-violet-700 dark:text-violet-300">AI分析结果</span>
              </div>
              <p className="text-sm text-gray-700 dark:text-gray-300">{aiResult.summary}</p>
              {aiResult.problems.length > 0 && (
                <div>
                  <p className="text-xs font-medium text-gray-500 mb-1">识别的问题</p>
                  {aiResult.problems.map((p, i) => (
                    <p key={i} className="text-xs text-gray-600 dark:text-gray-400">· {p}</p>
                  ))}
                </div>
              )}
              {aiResult.improvements.length > 0 && (
                <div>
                  <p className="text-xs font-medium text-gray-500 mb-2">改进建议</p>
                  {aiResult.improvements.map((imp, i) => (
                    <div key={i} className="flex items-start gap-2 mb-1">
                      <span className="text-xs text-gray-600 dark:text-gray-400 flex-1">· {imp}</span>
                      <button
                        onClick={async () => {
                          try {
                            await adoptImprovements([{ text: imp }]);
                            showToast({ message: "已转为改进任务", type: "success" });
                          } catch { showToast({ message: "创建失败", type: "error" }); }
                        }}
                        className="text-xs px-2 py-0.5 bg-violet-200 dark:bg-violet-800 text-violet-700 dark:text-violet-300 rounded-lg shrink-0"
                      >
                        采纳
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {renderEditableList(
            "亮点",
            <Lightbulb className="w-4 h-4 text-amber-500" />,
            highlights,
            setHighlights,
            "h",
            "亮点项",
          )}
          {renderEditableList(
            "问题",
            <AlertTriangle className="w-4 h-4 text-red-500" />,
            problems,
            setProblems,
            "p",
            "问题项",
          )}
          {renderEditableList(
            "改进点",
            <Rocket className="w-4 h-4 text-indigo-500" />,
            improvements,
            setImprovements,
            "i",
            "改进点",
          )}

          {/* 保存按钮 */}
          <button
            onClick={handleSave}
            disabled={saving}
            className="w-full py-3 rounded-xl bg-indigo-600 text-white text-sm font-medium hover:bg-indigo-700 transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
          >
            <Save className="w-4 h-4" />
            {saving ? "保存中..." : existingRecord ? "更新回顾" : "保存回顾"}
          </button>
        </section>

        {/* 闭环操作 */}
        <section className="bg-gradient-to-r from-indigo-50 to-purple-50 dark:from-indigo-950/30 dark:to-purple-950/30 rounded-2xl border border-indigo-200 dark:border-indigo-800 p-4">
          <div className="flex items-center gap-2 mb-3">
            <Zap className="w-4 h-4 text-indigo-500" />
            <h2 className="text-sm font-semibold text-gray-700 dark:text-gray-300">闭环行动</h2>
          </div>
          <p className="text-xs text-gray-500 dark:text-gray-400 mb-3">
            将本期的改进点转化为待办任务，可关联目标与计划，确保改进落地执行。
          </p>
          
          {/* 目标/计划选择器 */}
          <div className="space-y-2 mb-3">
            {projects.length > 0 && (
              <select
                value={genTaskGoalId ?? ""}
                onChange={(e) => { 
                  const val = e.target.value ? Number(e.target.value) : null;
                  setGenTaskGoalId(val); 
                  setGenTaskPlanId(null);
                }}
                className="w-full px-3 py-2 rounded-xl border border-indigo-200 dark:border-indigo-800 bg-white dark:bg-gray-800 text-xs text-gray-700 dark:text-gray-300 focus:outline-none focus:ring-2 focus:ring-indigo-500"
              >
                <option value="">选择关联目标（可选）</option>
                {goals.filter(g => g.status === "active" || g.status === "paused").map(g => (
                  <option key={g.id} value={g.id}>{g.name}</option>
                ))}
              </select>
            )}
            {genTaskGoalId && (
              <select
                value={genTaskPlanId ?? ""}
                onChange={(e) => setGenTaskPlanId(e.target.value ? Number(e.target.value) : null)}
                className="w-full px-3 py-2 rounded-xl border border-indigo-200 dark:border-indigo-800 bg-white dark:bg-gray-800 text-xs text-gray-700 dark:text-gray-300 focus:outline-none focus:ring-2 focus:ring-indigo-500"
              >
                <option value="">选择关联计划（可选）</option>
                {(() => {
                  const goalPlans = plans.filter(p => p.goalId === genTaskGoalId);
                  return goalPlans.map(p => (
                    <option key={p.id} value={p.id}>{p.name}</option>
                  ));
                })()}
              </select>
            )}
          </div>
          
          <button
            onClick={handleGenerateTasks}
            disabled={improvements.filter(Boolean).length === 0}
            className="w-full py-2.5 rounded-xl bg-indigo-600 text-white text-sm font-medium hover:bg-indigo-700 transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
          >
            <ListTodo className="w-4 h-4" />
            生成本期待办 ({improvements.filter(Boolean).length} 项)
          </button>
        </section>

        {/* 跳转统计页 */}
        <section className="flex justify-center">
          <Link
            href="/stats"
            className="flex items-center gap-2 px-6 py-3 rounded-2xl bg-gradient-to-r from-emerald-50 to-blue-50 dark:from-emerald-950/30 dark:to-blue-950/30 border border-emerald-200 dark:border-emerald-800 text-sm font-medium text-emerald-700 dark:text-emerald-300 hover:shadow-md transition-shadow"
          >
            <Activity className="w-4 h-4" />
            查看健康/财务统计
            <ArrowRight className="w-4 h-4" />
          </Link>
        </section>
      </>)}
      </div>
    </div>
  );
}
