"use client";

import { useEffect, useState, useMemo, useCallback } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { useLiveQuery } from "dexie-react-hooks";
import {
  Check, Plus, X, Moon, Droplets, Repeat, Timer, Wallet,
  Ellipsis, ArrowRight, TrendingUp,
} from "lucide-react";
import { addManualItem } from "@/lib/db/daylog.db";
import { getTotalFocusMinutes, getHabits } from "@/lib/db/life.db";

import { showToast } from "@/components/ui/Toast";
import OnboardingCard from "@/components/ui/OnboardingCard";
import SleepRitualCard from "@/components/dashboard/SleepRitualCard";
import { useThreeThings } from "@/lib/three-things";
import { getWaterGoal, healthDB, getSleepLogByDate } from "@/lib/db/health.db";
import { reviewerBrain } from "@/lib/brains/reviewer";
import { useTodayExecution } from "@/lib/today-execution";

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

function greeting(): string {
  const h = new Date().getHours();
  if (h < 6) return "夜深了";
  if (h < 9) return "早上好";
  if (h < 12) return "上午好";
  if (h < 14) return "中午好";
  if (h < 18) return "下午好";
  return "晚上好";
}

function formatMinutes(min: number): string {
  const h = Math.floor(min / 60);
  const m = Math.round(min % 60);
  return h > 0 ? `${h}h${String(m).padStart(2, "0")}m` : `${m}m`;
}

const PRESET_COLORS = ["#6366F1", "#FF9500", "#34C759", "#FF3B30", "#007AFF", "#5856D6", "#FF2D55", "#00C7BE"];

// ============================================================
// 进度环
// ============================================================
function ProgressRing({ percent }: { percent: number }) {
  const pct = Math.min(100, Math.max(0, percent));
  const R = 38;
  const CIRC = 2 * Math.PI * R;
  const offset = CIRC - (pct / 100) * CIRC;
  return (
    <div className="relative h-[84px] w-[84px] shrink-0" aria-hidden="true">
      <svg className="h-full w-full -rotate-90" viewBox="0 0 84 84">
        <circle cx="42" cy="42" r={R} fill="none" stroke="#E9E9EB" strokeWidth="8" />
        <circle
          cx="42" cy="42" r={R} fill="none"
          stroke="var(--lifeflow-primary)" strokeWidth="8" strokeLinecap="round"
          strokeDasharray={CIRC} strokeDashoffset={offset}
          style={{ transition: "stroke-dashoffset 0.5s ease-in-out" }}
        />
      </svg>
      <span
        className="absolute inset-0 flex items-center justify-center text-[26px] leading-none tabular-nums"
        style={{ color: "var(--color-text-primary)", fontWeight: 700 }}
      >
        {Math.round(pct)}%
      </span>
    </div>
  );
}

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

  // ── 今日执行（与目标页共用单一数据源） ──
  const { mergedActions, total, done, uncorrected, toggle, isDone } = useTodayExecution();

  // ── 今日三件事 ──
  const { store: threeThings, toggle: toggleThree } = useThreeThings();
  const threeItems = threeThings?.items ?? [];

  // ── 健康概览条：睡眠 ──
  const yesterday = useMemo(() => {
    const d = new Date();
    d.setDate(d.getDate() - 1);
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  }, []);
  const lastSleep = useLiveQuery(() => getSleepLogByDate(yesterday), [yesterday], undefined);

  // ── 健康概览条：饮水 ──
  const [waterSettings, setWaterSettings] = useState({ dailyTarget: 2000 });
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
    getWaterGoal().then((g) => {
      setWaterSettings({ dailyTarget: g.dailyTarget || 2000 });
    }).catch(() => {});
  }, [today]);

  // ── 健康概览条：习惯 ──
  const habits = useLiveQuery(() => getHabits(), [], []);
  const habitDone = useMemo(
    () => (habits ?? []).filter((h) => h.days[today]).length,
    [habits, today],
  );
  const habitTotal = (habits ?? []).length;

  // ── 健康概览条：专注 ──
  const focusMinutes = useLiveQuery(() => getTotalFocusMinutes(today), [today], 0);

  // ── 复盘一句话入口（长期主义唯一复盘入口） ──
  const [reviewSnippet, setReviewSnippet] = useState("");
  useEffect(() => {
    let cancelled = false;
    reviewerBrain.generateReview("daily", 0).then((r) => {
      if (!cancelled && r?.headline) setReviewSnippet(r.headline);
    }).catch(() => {});
    return () => { cancelled = true; };
  }, []);

  // ── 都矫正完了 ──
  const [correctingAll, setCorrectingAll] = useState(false);
  const handleMarkAllCorrected = useCallback(async () => {
    if (correctingAll) return;
    setCorrectingAll(true);
    try {
      const { updateItem } = await import("@/lib/db/daylog.db");
      for (const item of uncorrected) {
        await updateItem(item.id, { isCorrected: true });
      }
      showToast({ type: "success", message: "已全部标记为矫正完毕" });
    } catch {
      showToast({ type: "error", message: "操作失败，请再试一次" });
    } finally {
      setCorrectingAll(false);
    }
  }, [uncorrected, correctingAll]);

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
    const n = new Date();
    const start = `${String(n.getHours()).padStart(2, "0")}:${String(n.getMinutes()).padStart(2, "0")}`;
    const later = new Date(n.getTime() + 30 * 60000);
    const end = `${String(later.getHours()).padStart(2, "0")}:${String(later.getMinutes()).padStart(2, "0")}`;
    setCreateForm({ title: "", plannedStart: start, plannedEnd: end, note: "", color: PRESET_COLORS[0] });
  };
  const [submitting, setSubmitting] = useState(false);
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

  // ── 晚间睡前仪式显示时机：21:00 之后 ──
  const showNightRitual = nowTime >= "21:00";

  // 展示用合并流（前 8 条，更多去日程页）
  const displayActions = mergedActions.slice(0, 8);
  const hasMore = mergedActions.length > 8;

  return (
    <div className="min-h-screen pb-[110px] relative">
      {/* ===== 顶部导航 ===== */}
      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.35, ease: "easeOut" }}
        className="px-4 pt-[var(--safe-area-top)] pb-2 flex items-start justify-between gap-3"
      >
        <div className="min-w-0 flex-1">
          <h1 className="text-[28px] font-bold leading-tight" style={{ color: "var(--color-text-primary)", letterSpacing: "-0.02em" }}>
            {greeting()}
          </h1>
          <p className="mt-1 text-[13px]" style={{ color: "var(--color-text-secondary)" }}>
            {formatDateChinese(now)} · 今天也一起织
          </p>
        </div>
        <Link
          href="/more"
          aria-label="更多功能"
          className="mt-0.5 h-10 w-10 shrink-0 flex items-center justify-center rounded-full active:opacity-60"
          style={{ background: "var(--color-surface-card)", boxShadow: "var(--shadow-card)" }}
        >
          <Ellipsis className="w-5 h-5" style={{ color: "var(--color-text-secondary)" }} />
        </Link>
      </motion.div>

      {/* ===== 新用户引导 ===== */}
      <OnboardingCard />

      {/* ===== ① 今日待办单卡（三件事 + 执行流 + 矫正提醒） ===== */}
      <div className="px-4 mb-3">
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3, ease: "easeOut" }}
          className="rounded-[20px] px-4 pt-4 pb-3"
          style={{ background: "var(--color-surface-card)", boxShadow: "var(--shadow-card)" }}
        >
          {/* 卡头 */}
          <div className="flex items-center justify-between gap-3">
            <h2 className="text-[20px] font-bold leading-tight min-w-0 flex-1 truncate" style={{ color: "var(--color-text-primary)" }}>
              今日待办
            </h2>
            <span
              className="shrink-0 rounded-md px-2.5 py-1 text-[12px] font-semibold tabular-nums"
              style={{ background: "var(--lifeflow-brand-50)", color: "var(--lifeflow-primary)" }}
            >
              {done}/{total} 已完成
            </span>
          </div>

          {/* 进度环 + 三件事 */}
          <div className="mt-4 flex items-center gap-4">
            <ProgressRing percent={total > 0 ? (done / total) * 100 : 0} />
            <div className="min-w-0 flex-1">
              <p className="text-[12px]" style={{ color: "var(--color-text-secondary)" }}>今日三件事 · 最重要</p>
              <ul className="mt-2 space-y-2">
                {threeItems.length === 0 && (
                  <li className="text-[13px]" style={{ color: "var(--color-text-disabled)" }}>还没有三件事，点击下方添加</li>
                )}
                {threeItems.slice(0, 3).map((item) => (
                  <li key={item.id} className="flex items-start gap-2">
                    <button
                      type="button"
                      aria-label={item.done ? `取消完成：${item.text}` : `标记完成：${item.text}`}
                      onClick={() => toggleThree(item.id)}
                      className="mt-[7px] h-[6px] w-[6px] shrink-0 rounded-full active:scale-125 transition-transform"
                      style={{ background: item.done ? "#34C759" : "var(--lifeflow-primary)" }}
                    />
                    <span
                      className="text-[14px] font-semibold leading-snug truncate"
                      style={{
                        color: item.done ? "var(--color-text-disabled)" : "var(--color-text-primary)",
                        textDecoration: item.done ? "line-through" : "none",
                      }}
                    >
                      {item.text || "点击 ✎ 添加最重要的一件事…"}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          </div>

          {/* 执行流（单一数据源，与目标页焦点一致） */}
          <ul className="mt-3" style={{ borderTop: "1px solid var(--lifeflow-border)" }}>
            {displayActions.length === 0 && (
              <li className="flex flex-col items-center py-5 text-center">
                <p className="text-[15px] font-semibold" style={{ color: "var(--color-text-primary)" }}>
                  从这里开始你的一天
                </p>
                <p className="text-[12px] mt-1" style={{ color: "var(--color-text-secondary)" }}>
                  新建事项，或到「目标」页拆解今日行动
                </p>
              </li>
            )}
            {displayActions.map((act) => {
              const isDoneRow = isDone(act);
              return (
                <li
                  key={act.key}
                  className="flex items-center gap-3 py-2.5"
                  style={{ borderTop: "1px solid var(--lifeflow-border)" }}
                >
                  <button
                    type="button"
                    aria-label={isDoneRow ? `取消完成：${act.title}` : `标记完成：${act.title}`}
                    onClick={() => toggle(act)}
                    className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full transition-transform active:scale-90"
                    style={{
                      background: isDoneRow ? "var(--state-success)" : "transparent",
                      border: isDoneRow ? "none" : `2px dashed var(--lifeflow-border)`,
                    }}
                  >
                    {isDoneRow && <Check className="h-3.5 w-3.5" style={{ color: "#fff" }} strokeWidth={3} />}
                  </button>
                  <div className="min-w-0 flex-1">
                    <p
                      className="truncate text-[14px] font-medium"
                      style={{
                        color: isDoneRow ? "var(--color-text-secondary)" : "var(--color-text-primary)",
                        textDecoration: isDoneRow ? "line-through" : "none",
                      }}
                    >
                      {act.title}
                    </p>
                    <p className="text-[12px] tabular-nums" style={{ color: "var(--color-text-secondary)" }}>
                      {act.time}
                    </p>
                  </div>
                  {act.tag && (
                    <span
                      className="shrink-0 rounded-[6px] px-1.5 py-0.5 text-[11px]"
                      style={{ background: "var(--lifeflow-brand-50)", color: "var(--lifeflow-primary)" }}
                    >
                      {act.tag}
                    </span>
                  )}
                </li>
              );
            })}
          </ul>

          {hasMore && (
            <Link
              href="/efficiency/schedule"
              className="flex items-center justify-center gap-1 py-2 text-[12px] font-medium active:opacity-60"
              style={{ color: "var(--lifeflow-primary)" }}
            >
              查看全部 {total} 项 <ArrowRight className="w-3.5 h-3.5" />
            </Link>
          )}

          {/* 矫正提醒（内嵌） */}
          {uncorrected.length > 0 && (
            <div
              className="mt-2 flex items-center justify-between gap-3 rounded-md px-3 py-2.5"
              style={{ background: "var(--lifeflow-brand-50)" }}
            >
              <p className="text-[13px] text-[var(--color-text-primary)]">还有 {uncorrected.length} 个事项待矫正</p>
              <div className="flex items-center gap-3 shrink-0">
                <button
                  type="button"
                  onClick={handleMarkAllCorrected}
                  disabled={correctingAll}
                  className="text-[13px] font-medium active:opacity-60 disabled:opacity-50"
                  style={{ color: "var(--color-text-secondary)" }}
                >
                  {correctingAll ? "处理中…" : "都矫正完了"}
                </button>
                <button
                  type="button"
                  onClick={() => router.push("/efficiency/schedule")}
                  className="text-[13px] font-semibold active:opacity-60"
                  style={{ color: "var(--lifeflow-primary)" }}
                >
                  去矫正
                </button>
              </div>
            </div>
          )}
        </motion.div>
      </div>

      {/* ===== ② 健康概览条（睡眠/饮水/习惯/专注） ===== */}
      <div className="px-4 mb-3">
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.04, duration: 0.3, ease: "easeOut" }}
          className="rounded-[20px] px-1 py-3.5 flex items-stretch"
          style={{ background: "var(--color-surface-card)", boxShadow: "var(--shadow-card)" }}
        >
          <button type="button" onClick={() => router.push("/more/sleep")} aria-label="打卡：查看睡眠"
            className="flex min-w-0 flex-1 flex-col items-center gap-1.5 px-1 active:opacity-70">
            <Moon className="h-5 w-5" style={{ color: "#3B82F6" }} />
            <span className="text-[13px] font-semibold leading-none tabular-nums" style={{ color: "var(--color-text-primary)" }}>
              {lastSleep ? lastSleep.actualTime.slice(0, 5) : "--:--"}
            </span>
            <span className="text-[11px] leading-none" style={{ color: "var(--color-text-secondary)" }}>
              {lastSleep ? (lastSleep.isOnTime ? "按时入睡" : "昨晚入睡") : "记录睡眠"}
            </span>
          </button>
          <span className="w-px shrink-0" style={{ background: "var(--lifeflow-border)" }} />
          <button type="button" onClick={() => router.push("/more/water")} aria-label="打卡：记录饮水"
            className="flex min-w-0 flex-1 flex-col items-center gap-1.5 px-1 active:opacity-70">
            <Droplets className="h-5 w-5" style={{ color: "#3B82F6" }} />
            <span className="text-[13px] font-semibold leading-none tabular-nums" style={{ color: "var(--color-text-primary)" }}>
              {todayWaterMl}/{waterSettings.dailyTarget}
            </span>
            <span className="text-[11px] leading-none" style={{ color: "var(--color-text-secondary)" }}>已饮水 · ml</span>
          </button>
          <span className="w-px shrink-0" style={{ background: "var(--lifeflow-border)" }} />
          <button type="button" onClick={() => router.push("/more/habits")} aria-label="打卡：习惯进度"
            className="flex min-w-0 flex-1 flex-col items-center gap-1.5 px-1 active:opacity-70">
            <Repeat className="h-5 w-5" style={{ color: "#34C759" }} />
            <span className="text-[13px] font-semibold leading-none tabular-nums" style={{ color: "var(--color-text-primary)" }}>
              {habitDone}/{habitTotal}
            </span>
            <span className="text-[11px] leading-none" style={{ color: "var(--color-text-secondary)" }}>习惯完成</span>
          </button>
          <span className="w-px shrink-0" style={{ background: "var(--lifeflow-border)" }} />
          <button type="button" onClick={() => router.push("/more/focus")} aria-label="打卡：查看专注"
            className="flex min-w-0 flex-1 flex-col items-center gap-1.5 px-1 active:opacity-70">
            <Timer className="h-5 w-5" style={{ color: "var(--lifeflow-primary)" }} />
            <span className="text-[13px] font-semibold leading-none tabular-nums" style={{ color: "var(--color-text-primary)" }}>
              {formatMinutes(focusMinutes ?? 0)}
            </span>
            <span className="text-[11px] leading-none" style={{ color: "var(--color-text-secondary)" }}>已专注</span>
          </button>
        </motion.div>
      </div>

      {/* ===== ③ 晚间睡前仪式（21:00 后显示） ===== */}
      {showNightRitual && <SleepRitualCard />}

      {/* ===== ④ 复盘一句话入口（长期主义唯一复盘入口） ===== */}
      <div className="px-4 mb-3">
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.08, duration: 0.3, ease: "easeOut" }}
        >
          <Link
            href="/longtermism"
            className="flex items-center gap-2.5 rounded-[20px] px-4 py-3.5 active:opacity-70"
            style={{ background: "var(--color-surface-card)", boxShadow: "var(--shadow-card)" }}
          >
            <TrendingUp className="h-4 w-4 shrink-0" style={{ color: "var(--lifeflow-primary)" }} />
            <span className="shrink-0 text-[15px] font-bold leading-none" style={{ color: "var(--color-text-primary)" }}>
              今日一句话
            </span>
            <p className="min-w-0 flex-1 truncate text-[13px]" style={{ color: "var(--color-text-secondary)" }}>
              {reviewSnippet || "三件事按时完成，专注再久一点"}
            </p>
            <span className="flex shrink-0 items-center whitespace-nowrap text-[12px] font-semibold" style={{ color: "var(--lifeflow-primary)" }}>
              长期主义<ArrowRight className="ml-0.5 inline h-3 w-3" />
            </span>
          </Link>
        </motion.div>
      </div>

      {/* ===== ⑤ 快捷录入（悬浮组） ===== */}
      <div className="fixed bottom-[84px] right-4 z-40 flex flex-col items-center gap-2">
        <button
          type="button"
          aria-label="记一笔"
          onClick={() => router.push("/more/accounting")}
          className="flex h-10 w-10 items-center justify-center rounded-full active:scale-90 transition-transform"
          style={{ background: "var(--color-surface-card)", boxShadow: "var(--shadow-card)", color: "var(--lifeflow-primary)" }}
        >
          <Wallet className="h-5 w-5" />
        </button>
        <button
          type="button"
          aria-label="打卡"
          onClick={() => router.push("/more/habits")}
          className="flex h-10 w-10 items-center justify-center rounded-full active:scale-90 transition-transform"
          style={{ background: "var(--color-surface-card)", boxShadow: "var(--shadow-card)", color: "var(--lifeflow-primary)" }}
        >
          <Check className="h-5 w-5" />
        </button>
        <button
          type="button"
          aria-label="新建事项"
          onClick={() => { resetForm(); setShowCreate(true); }}
          className="flex h-14 w-14 items-center justify-center rounded-full active:scale-95 transition-transform"
          style={{ background: "var(--lifeflow-primary)", boxShadow: "var(--shadow-card)" }}
        >
          <Plus className="h-6 w-6" style={{ color: "#fff" }} strokeWidth={2.5} />
        </button>
      </div>

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

