"use client";

import { useEffect, useState, useMemo, useCallback } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { useLiveQuery } from "dexie-react-hooks";
import {
  FolderKanban, Zap, Check, Bell,
  Droplets, Moon, Dumbbell, Sunrise,
  Plus, X, Clock, ChevronDown, Clock9, Settings, Wallet, Brain, Star, CalendarDays,
  Repeat, Target,
} from "lucide-react";
import { getUpcomingItems, addManualItem, updateItem, getItemsByDate } from "@/lib/db/daylog.db";
import { useIdealDayGuidance } from "@/lib/ideal-day-guide";
import type { Item } from "@/lib/db/daylog.db";
import { updateDailyActionV2, goalV2DB } from "@/lib/db/goal-v2.db";
import { lifeDB } from "@/lib/db/life.db";
import { recalculateGoalProgress } from "@/lib/goal-v2-engine";

import { showToast } from "@/components/ui/Toast";
import HomeReview from "@/components/dashboard/HomeReview";
import OnboardingCard from "@/components/ui/OnboardingCard";
import SleepRitualCard from "@/components/dashboard/SleepRitualCard";
import ThreeThingsCard from "@/components/dashboard/ThreeThingsCard";
import { getWaterGoal, healthDB, getSleepLogByDate } from "@/lib/db/health.db";
import { getWakeTime } from "@/lib/db/daylog.db";

// ============================================================
// 工具函数
// ============================================================

function todayStr(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function nowTimeStr(): string {
  const d = new Date();
  return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
}

function formatDateChinese(date: Date): string {
  const weekDays = ["日", "一", "二", "三", "四", "五", "六"];
  return `${date.getMonth() + 1}月${date.getDate()}日 周${weekDays[date.getDay()]}`;
}

function itemDuration(item: Item): number {
  const [sh, sm] = item.plannedStart.split(":").map(Number);
  const [eh, em] = item.plannedEnd.split(":").map(Number);
  return (eh * 60 + em) - (sh * 60 + sm);
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



// ─── 预设颜色 ───
const PRESET_COLORS = ["#6366F1", "#FF9500", "#34C759", "#FF3B30", "#007AFF", "#5856D6", "#FF2D55", "#00C7BE"];

// ============================================================
// 首页
// ============================================================

export default function HomePage() {
  const router = useRouter();
  const today = todayStr();
  const now = new Date();


  // ── 当前时间（每分钟更新） ──
  const [nowTime, setNowTime] = useState(nowTimeStr);
  useEffect(() => {
    const update = () => setNowTime(nowTimeStr());
    const id = setInterval(update, 60000);
    return () => clearInterval(id);
  }, []);

  // ── 感知卡片已由 LifeDashboard 替代 ──

  // ── 数据源：当前时间往后的 6 个事项 ──
  const upcomingItems = useLiveQuery(
    () => (today && nowTime ? getUpcomingItems(today, nowTime, 6) : Promise.resolve([])),
    [today, nowTime],
    [] as Item[],
  );

  // ── 未矫正事项 ──
  const allTodayItems = useLiveQuery(
    () => getItemsByDate(today),
    [today],
    [] as Item[],
  );

  const uncorrectedItems = useMemo(() => {
    return (allTodayItems ?? []).filter(i => i.isCorrected === false && i.isCompleted === false);
  }, [allTodayItems]);

  // ── T19-3 执行引导：理想日块前提醒（首页轻量接入） ──
  const idealGuide = useIdealDayGuidance(today, allTodayItems ?? []);

  // ── 都矫正完了 handler ──
  const [correctingAll, setCorrectingAll] = useState(false);
  const handleMarkAllCorrected = useCallback(async () => {
    if (correctingAll) return;
    setCorrectingAll(true);
    try {
      for (const item of uncorrectedItems) {
        await updateItem(item.id, { isCorrected: true });
      }
      showToast({ type: "success", message: "已全部标记为矫正完毕" });
    } catch {
      showToast({ type: "error", message: "操作失败，请再试一次" });
    } finally {
      setCorrectingAll(false);
    }
  }, [uncorrectedItems, correctingAll]);

  // ── 缓存：返回时避免空白加载 ──
  const [cachedUpcoming, setCachedUpcoming] = useState<Item[]>(() => {
    try {
      const cached = sessionStorage.getItem("home_upcoming");
      return cached ? JSON.parse(cached) : [];
    } catch {
      return [];
    }
  });

  useEffect(() => {
    if (upcomingItems.length > 0) {
      setCachedUpcoming(upcomingItems);
      sessionStorage.setItem("home_upcoming", JSON.stringify(upcomingItems));
    }
  }, [upcomingItems]);

  const displayUpcoming = upcomingItems.length > 0 ? upcomingItems : cachedUpcoming;

  // ── 排序（展开全部待办用） ──
  const sortedItems = useMemo(() => {
    return [...(displayUpcoming ?? [])].sort((a, b) => {
      if (a.isCompleted !== b.isCompleted) return a.isCompleted ? 1 : -1;
      return a.plannedStart.localeCompare(b.plannedStart);
    });
  }, [displayUpcoming]);

  // ── 勾选切换（乐观更新 + 错误回退） ──
  const [optimisticCompleted, setOptimisticCompleted] = useState<Set<string>>(new Set());
  const handleToggle = useCallback(async (item: Item) => {
    if (!item.id) {
      showToast({ type: "error", message: "操作失败：无效的事项 ID" });
      return;
    }
    const newState = !item.isCompleted;
    // 乐观更新：立即标记为已操作
    setOptimisticCompleted(prev => { const next = new Set(prev); next.add(item.id!); return next; });
    try {
      await updateItem(item.id, { isCompleted: newState });
      // 目标来源事项：反向回写 DailyAction 完成状态，驱动 GoalV2 进度与复盘
      if (item.sourceType === "goal" && item.sourceId) {
        await updateDailyActionV2(item.sourceId, { isCompleted: newState });
        const da = await goalV2DB.goalV2DailyActions.get(item.sourceId);
        if (da?.goalId) await recalculateGoalProgress(da.goalId);
      }
    } catch {
      // 写入失败，清除乐观标记
      setOptimisticCompleted(prev => { const next = new Set(prev); next.delete(item.id!); return next; });
      showToast({ type: "error", message: "操作失败，请重试" });
    }
  }, []);

  // ── E2 合并流勾选：目标日行动直写 DA；日程待办走 Item ──
  const [optimisticGoal, setOptimisticGoal] = useState<Set<string>>(new Set());
  const handleToggleMerged = useCallback(async (act: { key: string; id: string; isGoal: boolean; title: string; time: string; endTime: string; isCompleted: boolean; color: string; sourceId: string }) => {
    const newState = !act.isCompleted;
    if (act.isGoal) {
      setOptimisticGoal(prev => { const next = new Set(prev); next.add(act.id); return next; });
      try {
        await updateDailyActionV2(act.id, { isCompleted: newState });
        const da = await goalV2DB.goalV2DailyActions.get(act.id);
        if (da?.goalId) await recalculateGoalProgress(da.goalId);
      } catch {
        setOptimisticGoal(prev => { const next = new Set(prev); next.delete(act.id); return next; });
        showToast({ type: "error", message: "操作失败，请重试" });
      }
    } else {
      const item = (allTodayItems ?? []).find(i => i.id === act.id);
      if (item) await handleToggle(item);
    }
  }, [allTodayItems, handleToggle]);

  // ── 创建弹窗 ──
  const [showCreate, setShowCreate] = useState(false);
  const [createForm, setCreateForm] = useState({
    title: "",
    plannedStart: "",
    plannedEnd: "",
    note: "",
    color: PRESET_COLORS[0],
  });

  const resetForm = () => {
    const now = new Date();
    const start = `${String(now.getHours()).padStart(2, "0")}:${String(now.getMinutes()).padStart(2, "0")}`;
    const later = new Date(now.getTime() + 30 * 60000);
    const end = `${String(later.getHours()).padStart(2, "0")}:${String(later.getMinutes()).padStart(2, "0")}`;
    setCreateForm({ title: "", plannedStart: start, plannedEnd: end, note: "", color: PRESET_COLORS[0] });
  };

  const [submitting, setSubmitting] = useState(false);
  const [taskListExpanded, setTaskListExpanded] = useState(false);

  // ── 饮水（T15：时段目标制，入口跳转饮水页） ──
  const [waterSettings, setWaterSettings] = useState({ wakeStart: "07:00", wakeEnd: "22:00", dailyTarget: 2000 });

  // 今日实际饮水量（唯一流水源 waterLogs，与长期主义/饮水页口径一致）
  const todayWaterLogs = useLiveQuery(
    () => healthDB.waterLogs.where("date").equals(today).toArray(),
    [today],
    [],
  );
  const todayWaterMl = useMemo(
    () => todayWaterLogs.reduce((s, l) => s + (l.amount || 0), 0),
    [todayWaterLogs],
  );

  useEffect(() => {
    getWaterGoal().then(g => {
      setWaterSettings({
        wakeStart: g.wakeStart || "07:00",
        wakeEnd: g.wakeEnd || "22:00",
        dailyTarget: g.dailyTarget || 2000,
      });
    }).catch(() => {});
  }, [today]);

  // ── E1 能量区：昨晚睡眠（T18-3 今日驾驶舱） ──
  const yesterday = useMemo(() => {
    const d = new Date();
    d.setDate(d.getDate() - 1);
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  }, []);

  const lastSleep = useLiveQuery(
    () => getSleepLogByDate(yesterday),
    [yesterday],
    undefined,
  );

  // ── E1 能量区：起床时间（作息模板） ──
  const wakeTime = useLiveQuery(() => getWakeTime(), [], "07:00");

  // ── T20-2 驾驶舱概览条：习惯数 / 目标数 ──
  const habitCount = useLiveQuery(() => lifeDB.habits.count(), [], 0);
  const activeGoalCount = useLiveQuery(
    async () => {
      const goals = await goalV2DB.goalV2Goals.toArray();
      return goals.filter(g => g.status === "active" || !g.status).length;
    },
    [],
    0,
  );

  // ── E2 今日执行：目标日行动（GoalV2 每日行动） ──
  const todayGoalActions = useLiveQuery(
    () => goalV2DB.goalV2DailyActions.where("date").equals(today).toArray(),
    [today],
    [],
  );
  // 目标日行动若已同步为日程 Item（sourceType='goal'），从待办合并流中排除避免重复
  const goalItemIds = useMemo(() => new Set((allTodayItems ?? []).map(i => i.id)), [allTodayItems]);
  // ── E2 今日执行合并流：目标日行动（未同步为 Item 的）+ 日程待办 ──
  const mergedActions = useMemo(() => {
    const goalActs = (todayGoalActions ?? [])
      .filter(a => !a.itemId || !goalItemIds.has(a.itemId))
      .map(a => ({
        key: `goal-${a.id}`,
        id: a.id,
        isGoal: true as const,
        title: a.title,
        time: a.time || "09:00",
        endTime: "",
        isCompleted: a.isCompleted,
        color: "#6366F1",
        sourceId: a.id,
      }));
    const items = (allTodayItems ?? []).map(i => ({
      key: `item-${i.id}`,
      id: i.id!,
      isGoal: false as const,
      title: i.title,
      time: i.plannedStart,
      endTime: i.plannedEnd,
      isCompleted: i.isCompleted,
      color: i.color,
      sourceId: i.sourceId,
    }));
    const merged = [...goalActs, ...items].sort((a, b) =>
      a.isCompleted !== b.isCompleted ? (a.isCompleted ? 1 : -1) : a.time.localeCompare(b.time),
    );
    return merged.slice(0, 12);
  }, [todayGoalActions, allTodayItems, goalItemIds]);

  // ── E2 今日执行统计 ──
  const execTotal = (allTodayItems ?? []).length;
  const execDone = (allTodayItems ?? []).filter(i => i.isCompleted).length;

  const handleCreate = useCallback(async () => {
    if (submitting) return;
    const title = createForm.title.trim();
    if (!title) { showToast({ type: "error", message: "请输入事项名称" }); return; }
    if (!createForm.plannedStart || !createForm.plannedEnd) { showToast({ type: "error", message: "请选择时间" }); return; }

    setSubmitting(true);
    try {
      await addManualItem({
        date: today,
        plannedStart: createForm.plannedStart,
        plannedEnd: createForm.plannedEnd,
        title,
        note: createForm.note || undefined,
        color: createForm.color,
      });

      showToast({ type: "success", message: "已添加" });
      setShowCreate(false);
      resetForm();
    } catch {
      showToast({ type: "error", message: "没有添加成功，再试一次？" });
    } finally {
      setSubmitting(false);
    }
  }, [createForm, today, submitting]);

  // ────────── Render ──────────

  return (
    <div className="min-h-screen pb-[90px] relative">
      {/* ===== Header ===== */}
      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.35, ease: "easeOut" }}
        className="px-4 pt-[var(--safe-area-top)] pb-2 flex items-center justify-between"
      >
        <p className="text-[13px] font-medium" style={{ color: "var(--color-text-secondary)" }}>
          {greeting()} · {formatDateChinese(now)}
        </p>
        <div className="flex items-center gap-1">
          <Link
            href="/reminders"
            className="h-7 flex items-center gap-1 px-2 rounded-lg active:opacity-60"
            style={{ background: "var(--color-surface-card)", border: "1px solid var(--lifeflow-border)" }}
          >
            <Bell className="w-3.5 h-3.5" style={{ color: "var(--color-text-secondary)" }} />
            <span className="text-[11px] font-medium" style={{ color: "var(--color-text-secondary)" }}>提醒</span>
          </Link>
          <Link
            href="/settings"
            className="h-7 flex items-center gap-1 px-2 rounded-lg active:opacity-60"
            style={{ background: "var(--color-surface-card)", border: "1px solid var(--lifeflow-border)" }}
          >
            <Settings className="w-3.5 h-3.5" style={{ color: "var(--color-text-secondary)" }} />
            <span className="text-[11px] font-medium" style={{ color: "var(--color-text-secondary)" }}>设置</span>
          </Link>
          <Link
            href="/more"
            className="h-7 flex items-center gap-1 px-2 rounded-lg active:opacity-60"
            style={{ background: "var(--color-surface-card)", border: "1px solid var(--lifeflow-border)" }}
          >
            <FolderKanban className="w-3.5 h-3.5" style={{ color: "var(--color-text-secondary)" }} />
            <span className="text-[11px] font-medium" style={{ color: "var(--color-text-secondary)" }}>功能模块</span>
          </Link>
        </div>
      </motion.div>

      {/* ===== 新用户引导（T10：主线路径 目标→日程→复盘） ===== */}
      <OnboardingCard />

      {/* ===== T20-2 驾驶舱概览条（习惯 X · 目标 Y） ===== */}
      <div className="px-4 mb-3">
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3, ease: "easeOut" }}
          className="flex items-center rounded-[16px] p-2.5"
          style={{ background: "var(--color-surface-card)", boxShadow: "var(--shadow-card)" }}
        >
          <Link
            href="/more/habits"
            className="flex-1 flex items-center gap-2.5 px-2 py-1.5 rounded-xl active:opacity-60 transition-opacity"
          >
            <div className="w-9 h-9 rounded-xl flex items-center justify-center" style={{ background: "#F0FDF4" }}>
              <Repeat className="w-[18px] h-[18px]" style={{ color: "#16A34A" }} />
            </div>
            <div>
              <p className="text-[18px] font-bold leading-tight tabular-nums" style={{ color: "var(--color-text-primary)" }}>
                {habitCount} <span className="text-[11px] font-medium" style={{ color: "var(--color-text-secondary)" }}>个习惯</span>
              </p>
              <p className="text-[11px] mt-0.5" style={{ color: "var(--color-text-secondary)" }}>每天一点，持续改变</p>
            </div>
          </Link>
          <div className="w-px self-stretch mx-1" style={{ background: "var(--lifeflow-border)" }} />
          <Link
            href="/efficiency-v2"
            className="flex-1 flex items-center gap-2.5 px-2 py-1.5 rounded-xl active:opacity-60 transition-opacity"
          >
            <div className="w-9 h-9 rounded-xl flex items-center justify-center" style={{ background: "#FFF7ED" }}>
              <Target className="w-[18px] h-[18px]" style={{ color: "#F97316" }} />
            </div>
            <div>
              <p className="text-[18px] font-bold leading-tight tabular-nums" style={{ color: "var(--color-text-primary)" }}>
                {activeGoalCount} <span className="text-[11px] font-medium" style={{ color: "var(--color-text-secondary)" }}>个目标</span>
              </p>
              <p className="text-[11px] mt-0.5" style={{ color: "var(--color-text-secondary)" }}>拆解到每天，稳步推进</p>
            </div>
          </Link>
        </motion.div>
      </div>

      {/* ===== T21-4 今日三件事（自动生成 + 手动可调 + 联动进度） ===== */}
      <ThreeThingsCard />

      {/* ===== T19-3 块前提醒横幅（理想日学习/训练块 10 分钟内） ===== */}
      {idealGuide.upcomingBlock && (
        <div className="px-4 mb-3">
          <motion.div
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            className="flex items-center gap-2.5 px-4 py-3 rounded-[16px]"
            style={{ background: "var(--color-surface-card)", boxShadow: "var(--shadow-card)", borderLeft: "3px solid #F59E0B" }}
          >
            <Bell className="w-4 h-4 flex-shrink-0" style={{ color: "#F59E0B" }} />
            <span className="text-[13px] font-medium flex-1 min-w-0 truncate" style={{ color: "var(--color-text-primary)" }}>
              即将开始：{idealGuide.upcomingBlock.item.title}
            </span>
            <span className="text-[12px] font-semibold tabular-nums shrink-0" style={{ color: "#F59E0B" }}>
              {idealGuide.upcomingBlock.minutesLeft > 0 ? `${idealGuide.upcomingBlock.minutesLeft} 分钟后` : "现在"} · {idealGuide.upcomingBlock.item.plannedStart}
            </span>
          </motion.div>
        </div>
      )}

      {/* ===== E1 能量区（T18-3 今日驾驶舱 · 三合一健康卡） ===== */}
      <div className="px-4 mb-4">
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3, ease: "easeOut" }}
          className="rounded-[20px] p-4"
          style={{ background: "var(--color-surface-card)", boxShadow: "var(--shadow-card)" }}
        >
          <div className="flex items-center gap-2 mb-3">
            <div className="w-7 h-7 rounded-lg flex items-center justify-center" style={{ background: "var(--lifeflow-brand-50)" }}>
              <Zap className="w-4 h-4" style={{ color: "var(--lifeflow-primary)" }} />
            </div>
            <span className="text-[13px] font-semibold" style={{ color: "var(--lifeflow-primary)" }}>能量底座</span>
            <span className="text-[11px] ml-auto" style={{ color: "var(--color-text-disabled)" }}>睡好 · 喝够 · 规律作息</span>
          </div>

          {/* 三合一：睡眠 / 饮水 / 作息 */}
          <div className="grid grid-cols-3 gap-2.5">
            {/* 睡眠 */}
            <button
              type="button"
              onClick={() => router.push("/more/sleep")}
              className="rounded-[14px] p-3 text-left active:opacity-70 transition-opacity"
              style={{ background: "var(--lifeflow-background)" }}
            >
              <div className="w-8 h-8 rounded-lg flex items-center justify-center mb-2" style={{ background: "#EEF2FF" }}>
                <Moon className="w-4 h-4" style={{ color: "#6366F1" }} />
              </div>
              <p className="text-[13px] font-bold tabular-nums" style={{ color: "var(--color-text-primary)" }}>
                {lastSleep ? lastSleep.actualTime.slice(0, 5) : "--"}
              </p>
              <p className="text-[10px] mt-0.5 truncate" style={{ color: "var(--color-text-secondary)" }}>
                昨晚{lastSleep ? (lastSleep.isOnTime ? "按时入睡" : "入睡") : "记录睡眠"}
              </p>
            </button>

            {/* 饮水 */}
            <button
              type="button"
              onClick={() => router.push("/more/water")}
              className="rounded-[14px] p-3 text-left active:opacity-70 transition-opacity"
              style={{ background: "var(--lifeflow-background)" }}
            >
              <div className="w-8 h-8 rounded-lg flex items-center justify-center mb-2" style={{ background: "#EFF6FF" }}>
                <Droplets className="w-4 h-4" style={{ color: "#3B82F6" }} />
              </div>
              <p className="text-[13px] font-bold tabular-nums" style={{ color: "var(--color-text-primary)" }}>
                {todayWaterMl}/{waterSettings.dailyTarget}
              </p>
              <p className="text-[10px] mt-0.5 truncate" style={{ color: "var(--color-text-secondary)" }}>
                饮水 ml · 目标 {waterSettings.dailyTarget}
              </p>
            </button>

            {/* 作息 */}
            <button
              type="button"
              onClick={() => router.push("/more/schedule/routines")}
              className="rounded-[14px] p-3 text-left active:opacity-70 transition-opacity"
              style={{ background: "var(--lifeflow-background)" }}
            >
              <div className="w-8 h-8 rounded-lg flex items-center justify-center mb-2" style={{ background: "#F1F5F9" }}>
                <Sunrise className="w-4 h-4" style={{ color: "#1E293B" }} />
              </div>
              <p className="text-[13px] font-bold tabular-nums" style={{ color: "var(--color-text-primary)" }}>
                {wakeTime || "--"}
              </p>
              <p className="text-[10px] mt-0.5 truncate" style={{ color: "var(--color-text-secondary)" }}>
                起床 · 作息模板
              </p>
            </button>
          </div>
        </motion.div>
      </div>

      {/* ===== E2 今日执行（目标日行动 + 日程待办合并流） ===== */}
      <div className="px-4 mb-4">
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.05, duration: 0.35, ease: "easeOut" }}
          className="p-5"
          style={{ background: "var(--color-surface-card)", borderRadius: "20px", boxShadow: "var(--shadow-card)" }}
        >
          <div className="flex items-center gap-2 mb-1">
            <div className="w-7 h-7 rounded-lg flex items-center justify-center" style={{ background: "var(--lifeflow-brand-50)" }}>
              <Zap className="w-4 h-4" style={{ color: "var(--lifeflow-primary)" }} />
            </div>
            <span className="text-[13px] font-semibold" style={{ color: "var(--lifeflow-primary)" }}>今日执行</span>
            {execTotal > 0 && (
              <span className="text-[11px] font-medium px-1.5 py-0.5 rounded-md ml-auto" style={{ background: "var(--lifeflow-brand-50)", color: "var(--lifeflow-primary)" }}>
                {execDone}/{execTotal} 已完成
              </span>
            )}
            <Link
              href="/efficiency/schedule"
              className="h-6 flex items-center gap-1 px-2 rounded-md ml-2 active:opacity-60"
              style={{ background: "var(--lifeflow-brand-50)", color: "var(--lifeflow-primary)" }}
            >
              <CalendarDays className="w-3.5 h-3.5" />
              <span className="text-[11px] font-medium">日程</span>
            </Link>
          </div>

          {mergedActions.length === 0 ? (
            <>
              <p className="text-[17px] font-semibold mb-1.5 mt-3" style={{ color: "var(--color-text-primary)" }}>
                从这里开始你的一天 👋
              </p>
              <p className="text-[13px] mb-4" style={{ color: "var(--color-text-secondary)" }}>
                可以新建一个目标，或者直接添加今天要做的事项
              </p>
              <div className="flex gap-2">
                <button
                  onClick={() => { resetForm(); setShowCreate(true); }}
                  className="flex-1 py-2.5 rounded-full text-center text-[14px] font-semibold text-white active:opacity-90"
                  style={{ background: "var(--lifeflow-primary)" }}
                >
                  新建事项
                </button>
                <Link
                  href="/efficiency-v2"
                  className="py-2.5 px-4 rounded-full text-[14px] font-medium active:opacity-70"
                  style={{ background: "var(--lifeflow-muted)", color: "var(--color-text-secondary)" }}
                >
                  目标
                </Link>
              </div>
            </>
          ) : (
            <div className="mt-3 flex flex-col">
              {mergedActions.map((act, i) => {
                const isDone = act.isCompleted || (act.isGoal ? optimisticGoal.has(act.id) : optimisticCompleted.has(act.id));
                return (
                  <button
                    key={act.key}
                    type="button"
                    onClick={() => handleToggleMerged(act)}
                    className="flex items-center gap-3 py-2.5 text-left active:opacity-70"
                    style={{ opacity: isDone ? 0.6 : 1, borderTop: i > 0 ? "1px solid var(--lifeflow-border)" : "none" }}
                  >
                    <span
                      className="w-[20px] h-[20px] rounded-full border-2 flex items-center justify-center flex-shrink-0"
                      style={{
                        borderColor: isDone ? "var(--color-text-disabled)" : act.color,
                        backgroundColor: isDone ? act.color : "transparent",
                      }}
                    >
                      {isDone && <Check className="w-[12px] h-[12px] text-white" strokeWidth={2.5} />}
                    </span>
                    <span className="flex-1 min-w-0">
                      <span
                        className="block text-[14px] font-medium truncate"
                        style={{
                          color: isDone ? "var(--color-text-disabled)" : "var(--color-text-primary)",
                          textDecoration: isDone ? "line-through" : "none",
                        }}
                      >
                        {act.title}
                      </span>
                      <span className="flex items-center gap-1.5 mt-0.5">
                        <Clock className="w-3 h-3" style={{ color: "var(--color-text-disabled)" }} />
                        <span className="text-[11px]" style={{ color: "var(--color-text-secondary)" }}>
                          {act.time}
                          {act.isGoal && " · 目标"}
                        </span>
                      </span>
                    </span>
                  </button>
                );
              })}
            </div>
          )}

          {/* ── 分割线 + 下拉展开今日全部待办 ── */}
          <div className="h-px my-4" style={{ background: "var(--lifeflow-border)" }} />
          <button
            onClick={() => setTaskListExpanded(!taskListExpanded)}
            className="w-full flex items-center justify-center gap-1 py-2.5 text-[12px] font-medium active:opacity-70 transition-opacity"
            style={{ color: "var(--color-text-secondary)" }}
          >
            <span>{taskListExpanded ? '收起全部待办' : `展开全部待办 (${execDone}/${execTotal})`}</span>
            <ChevronDown className={'w-4 h-4 transition-transform ' + (taskListExpanded ? 'rotate-180' : '')} />
          </button>

          {taskListExpanded && (
            <div className="mt-4 flex flex-col gap-3">
              <div className="flex items-center justify-between mb-1">
                <span className="text-[15px] font-semibold" style={{ color: "var(--color-text-primary)" }}>
                  全部待办
                </span>
                <Link href="/efficiency/schedule" className="text-[12px] font-medium" style={{ color: "var(--lifeflow-primary)" }}>
                  完整时间轴
                </Link>
              </div>
              {sortedItems.length === 0 ? (
                <p className="text-[13px] py-3 text-center" style={{ color: "var(--color-text-secondary)" }}>
                  今天还没有安排事项
                </p>
              ) : (
                sortedItems.map((item) => {
                  const isDone = item.isCompleted || optimisticCompleted.has(item.id!);
                  return (
                    <div
                      key={item.id}
                      className="flex items-center gap-3 py-1"
                      style={{ opacity: isDone ? 0.6 : 1 }}
                    >
                      <button
                        onClick={() => handleToggle(item)}
                        className="w-[20px] h-[20px] rounded-full border-2 flex items-center justify-center flex-shrink-0 active:scale-90 transition-transform"
                        style={{
                          borderColor: isDone ? "var(--color-text-disabled)" : item.color,
                          backgroundColor: isDone ? item.color : "transparent",
                        }}
                      >
                        {isDone && <Check className="w-[12px] h-[12px] text-white" strokeWidth={2.5} />}
                      </button>
                      <div className="flex-1 min-w-0">
                        <p
                          className="text-[13px] font-medium truncate"
                          style={{
                            color: isDone ? "var(--color-text-disabled)" : "var(--color-text-primary)",
                            textDecoration: isDone ? "line-through" : "none",
                          }}
                        >
                          {item.title}
                        </p>
                        <div className="flex items-center gap-1.5 mt-0.5">
                          <Clock className="w-3 h-3" style={{ color: "var(--color-text-disabled)" }} />
                          <span className="text-[11px]" style={{ color: "var(--color-text-secondary)" }}>
                            {item.plannedStart}
                            {itemDuration(item) > 0 && ' - ' + item.plannedEnd}
                          </span>
                        </div>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          )}
        </motion.div>
      </div>

      {/* ===== 矫正聚合提醒卡 ===== */}
      {uncorrectedItems.length > 0 && (
        <div className="px-4 mb-4">
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            className="rounded-[16px] p-4"
            style={{ background: "var(--color-surface-card)", boxShadow: "var(--shadow-card)", borderLeft: "3px solid #FF9500" }}
          >
            <div className="mb-2">
              <p className="text-[15px] font-semibold" style={{ color: "var(--color-text-primary)" }}>
                今日还有 {uncorrectedItems.length} 个事项未矫正
              </p>
              <p className="text-[13px] mt-0.5" style={{ color: "var(--color-text-secondary)" }}>
                点击去矫正或标记全部已矫正
              </p>
            </div>
            <div className="flex gap-2 mt-3">
              <button
                onClick={() => router.push("/efficiency/schedule")}
                className="flex-1 py-2.5 rounded-full text-[14px] font-semibold text-white active:opacity-90"
                style={{ background: "var(--lifeflow-primary)" }}
              >
                去矫正
              </button>
              <button
                onClick={handleMarkAllCorrected}
                disabled={correctingAll}
                className="flex-1 py-2.5 rounded-full text-[14px] font-medium active:opacity-70 disabled:opacity-50"
                style={{ background: "var(--lifeflow-muted)", color: "var(--color-text-secondary)" }}
              >
                {correctingAll ? "处理中..." : "都矫正完了"}
              </button>
            </div>
          </motion.div>
        </div>
      )}

      {/* ===== T21-3 睡前仪式（环境营造 → 倒计时 → 入睡打卡 + 渐进目标） ===== */}
      <SleepRitualCard />

      {/* ===== 复盘洞察（底部） ===== */}
      <HomeReview />

      {/* ===== E3/E4 入口行（小图标 · T18-3） ===== */}
      <div className="px-4 mt-4">
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.10, duration: 0.35, ease: "easeOut" }}
          className="flex items-center gap-3"
        >
          <Link href="/more/accounting" className="flex-1 flex flex-col items-center gap-1 py-2 rounded-xl active:opacity-60" style={{ background: "var(--color-surface-card)", boxShadow: "var(--shadow-card)" }}>
            <Wallet className="w-5 h-5" style={{ color: "#10B981" }} />
            <span className="text-[10px]" style={{ color: "var(--color-text-secondary)" }}>记账</span>
          </Link>
          <Link href="/more/fitness" className="flex-1 flex flex-col items-center gap-1 py-2 rounded-xl active:opacity-60" style={{ background: "var(--color-surface-card)", boxShadow: "var(--shadow-card)" }}>
            <Dumbbell className="w-5 h-5" style={{ color: "#F97316" }} />
            <span className="text-[10px]" style={{ color: "var(--color-text-secondary)" }}>训练</span>
          </Link>
          <Link href="/more/review" className="flex-1 flex flex-col items-center gap-1 py-2 rounded-xl active:opacity-60" style={{ background: "var(--color-surface-card)", boxShadow: "var(--shadow-card)" }}>
            <Brain className="w-5 h-5" style={{ color: "#10B981" }} />
            <span className="text-[10px]" style={{ color: "var(--color-text-secondary)" }}>复盘</span>
          </Link>
          <Link href="/more/ebbinghaus" className="flex-1 flex flex-col items-center gap-1 py-2 rounded-xl active:opacity-60" style={{ background: "var(--color-surface-card)", boxShadow: "var(--shadow-card)" }}>
            <Star className="w-5 h-5" style={{ color: "#8B5CF6" }} />
            <span className="text-[10px]" style={{ color: "var(--color-text-secondary)" }}>记忆</span>
          </Link>
          <Link href="/more/countdown" className="flex-1 flex flex-col items-center gap-1 py-2 rounded-xl active:opacity-60" style={{ background: "var(--color-surface-card)", boxShadow: "var(--shadow-card)" }}>
            <Clock9 className="w-5 h-5" style={{ color: "#F97316" }} />
            <span className="text-[10px]" style={{ color: "var(--color-text-secondary)" }}>倒数日</span>
          </Link>
          <Link href="/more" className="flex-1 flex flex-col items-center gap-1 py-2 rounded-xl active:opacity-60" style={{ background: "var(--color-surface-card)", boxShadow: "var(--shadow-card)" }}>
            <FolderKanban className="w-5 h-5" style={{ color: "var(--color-text-disabled)" }} />
            <span className="text-[10px]" style={{ color: "var(--color-text-secondary)" }}>更多</span>
          </Link>
        </motion.div>
      </div>

      {/* ===== 浮动创建按钮 ===== */}
      <motion.button
        initial={{ scale: 0 }}
        animate={{ scale: [1, 1.08, 1] }}
        transition={{
          delay: 0.5,
          scale: { repeat: Infinity, repeatDelay: 3, duration: 1.2, ease: "easeInOut" },
        }}
        onClick={() => { resetForm(); setShowCreate(true); }}
        className="absolute w-14 h-14 rounded-full flex items-center justify-center shadow-lg active:scale-90 transition-transform z-40"
        style={{
          background: "var(--lifeflow-primary)",
          bottom: 24,
          right: 24,
        }}
        aria-label="新建事项"
      >
        <Plus className="w-6 h-6 text-white" strokeWidth={2.5} />
      </motion.button>

      {/* ===== 创建事项弹窗 ===== */}
      <AnimatePresence>
        {showCreate && (
          <>
            <motion.div
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              onClick={() => setShowCreate(false)}
              className="fixed inset-0 z-50 bg-black/40"
            />
            <motion.div
              initial={{ y: "100%" }} animate={{ y: 0 }} exit={{ y: "100%" }}
              transition={{ duration: 0.4, ease: [0.32, 0.72, 0, 1] }}
              className="fixed left-0 right-0 bottom-0 z-[60] rounded-t-[20px] max-w-[430px] mx-auto"
              style={{
                backgroundColor: "var(--color-surface-card)",
                paddingBottom: "env(safe-area-inset-bottom)",
              }}
            >
              <div className="flex justify-center pt-2 pb-3">
                <div className="w-9 h-1 rounded-full bg-[#D4D4D4]" />
              </div>

              <div className="px-5 pb-6">
                <div className="flex items-center justify-between mb-5">
                  <h3 className="text-[20px] font-bold" style={{ color: "var(--color-text-primary)" }}>
                    新建事项
                  </h3>
                  <button
                    onClick={() => setShowCreate(false)}
                    className="w-8 h-8 rounded-full flex items-center justify-center"
                    style={{ background: "var(--lifeflow-muted)" }}
                  >
                    <X className="w-4 h-4" style={{ color: "var(--color-text-secondary)" }} />
                  </button>
                </div>

                {/* 标题 */}
                <div className="mb-4">
                  <label className="text-[13px] font-medium mb-1.5 block" style={{ color: "var(--color-text-secondary)" }}>
                    事项名称
                  </label>
                  <input
                    type="text"
                    placeholder="例如：写周报"
                    value={createForm.title}
                    onChange={(e) => setCreateForm((f) => ({ ...f, title: e.target.value }))}
                    className="w-full px-4 py-3 rounded-xl text-[15px] outline-none"
                    style={{ backgroundColor: "var(--lifeflow-background)", color: "var(--color-text-primary)" }}
                    autoFocus
                  />
                </div>

                {/* 时间 */}
                <div className="flex gap-3 mb-4">
                  <div className="flex-1">
                    <label className="text-[13px] font-medium mb-1.5 block" style={{ color: "var(--color-text-secondary)" }}>
                      开始
                    </label>
                    <input
                      type="time"
                      value={createForm.plannedStart}
                      onChange={(e) => setCreateForm((f) => ({ ...f, plannedStart: e.target.value }))}
                      className="w-full px-4 py-3 rounded-xl text-[15px] outline-none"
                      style={{ backgroundColor: "var(--lifeflow-background)", color: "var(--color-text-primary)" }}
                    />
                  </div>
                  <div className="flex-1">
                    <label className="text-[13px] font-medium mb-1.5 block" style={{ color: "var(--color-text-secondary)" }}>
                      结束
                    </label>
                    <input
                      type="time"
                      value={createForm.plannedEnd}
                      onChange={(e) => setCreateForm((f) => ({ ...f, plannedEnd: e.target.value }))}
                      className="w-full px-4 py-3 rounded-xl text-[15px] outline-none"
                      style={{ backgroundColor: "var(--lifeflow-background)", color: "var(--color-text-primary)" }}
                    />
                  </div>
                </div>

                {/* 备注 */}
                <div className="mb-6">
                  <label className="text-[13px] font-medium mb-1.5 block" style={{ color: "var(--color-text-secondary)" }}>
                    备注（可选）
                  </label>
                  <input
                    type="text"
                    placeholder="添加备注..."
                    value={createForm.note}
                    onChange={(e) => setCreateForm((f) => ({ ...f, note: e.target.value }))}
                    className="w-full px-4 py-3 rounded-xl text-[15px] outline-none"
                    style={{ backgroundColor: "var(--lifeflow-background)", color: "var(--color-text-primary)" }}
                  />
                </div>

                <button
                  onClick={handleCreate}
                  disabled={submitting}
                  className="w-full py-3.5 rounded-full text-white text-[16px] font-semibold active:opacity-90 disabled:opacity-50"
                  style={{ background: "var(--lifeflow-primary)" }}
                >
                  {submitting ? "处理中..." : "新建事项"}
                </button>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  );
}
