"use client";

import { useEffect, useState, useMemo, useCallback } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { useLiveQuery } from "dexie-react-hooks";
import {
  Check, Plus, X, Moon, Droplets, Repeat, Timer, Wallet, Sun,
  Ellipsis, ArrowRight, TrendingUp, Pencil, AlertCircle,
} from "lucide-react";
import { addManualItem, getItemsByDate } from "@/lib/db/daylog.db";
import { getTotalFocusMinutes, getHabits } from "@/lib/db/life.db";

import { showToast } from "@/components/ui/Toast";
import OnboardingCard from "@/components/ui/OnboardingCard";
import SleepRitualCard from "@/components/dashboard/SleepRitualCard";
import { useTheme } from "@/components/theme/ThemeProvider";
import { useThreeThings } from "@/lib/three-things";
import { getWaterGoal, healthDB, getSleepLogByDate } from "@/lib/db/health.db";
import { reviewerBrain } from "@/lib/brains/reviewer";
import { useTodayExecution } from "@/lib/today-execution";
import { getIdealDayPlans, getFeatureMeta } from "@/lib/ideal-day-templates";

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

/** 时间加法（HH:mm + 分钟，跨天取模 24h），用于时长 chips 自动计算结束时间 */
function addMinutesTime(time: string, mins: number): string {
  const [h, m] = time.split(":").map(Number);
  const total = h * 60 + m + mins;
  const nh = Math.floor(total / 60) % 24;
  const nm = total % 60;
  return `${String(nh).padStart(2, "0")}:${String(nm).padStart(2, "0")}`;
}

/** 画布 lf-dur-chip / lf-remind-offsets 的时长与提前量选项 */
const DURATION_CHIPS = [15, 30, 45, 60, 90] as const;
const REMIND_OFFSETS = [0, 5, 10, 15] as const;

const PRESET_COLORS = ["#6366F1", "#FF9500", "#34C759", "#FF3B30", "#007AFF", "#5856D6", "#FF2D55", "#00C7BE"];

// ============================================================
// 进度环（8+8+8 三色分段环：睡眠紫 / 学习蓝 / 休息绿）
// 三色常量对齐画布 token：--lifeflow-ring-sleep/study/rest，
// 双主题共用；各段 1/3 弧，按总体达成率填充，中心显示达成率
// ============================================================
const RING_SLEEP = "#5856D6";
const RING_STUDY = "#0A84FF";
const RING_REST = "#34C759";

function ProgressRing({ percent }: { percent: number }) {
  const pct = Math.min(100, Math.max(0, percent));
  const R = 38;
  const CIRC = 2 * Math.PI * R;
  const SEG = CIRC / 3; // 每段 1/3 弧长
  const fillOffset = SEG * (1 - pct / 100); // 每段按达成率填充
  const segments = [
    { color: RING_SLEEP, rotate: -90 }, // 顶部起 0°~120°
    { color: RING_STUDY, rotate: 30 },  // 120°~240°
    { color: RING_REST, rotate: 150 },  // 240°~360°
  ];
  return (
    <div className="relative h-[92px] w-[92px] shrink-0" aria-hidden="true">
      <svg className="h-full w-full" viewBox="0 0 84 84">
        <circle cx="42" cy="42" r={R} fill="none" stroke="var(--lifeflow-knit-bg)" strokeWidth="8" />
        {segments.map((seg) => (
          <circle
            key={seg.color}
            cx="42" cy="42" r={R} fill="none"
            stroke={seg.color} strokeWidth="8" strokeLinecap="round"
            strokeDasharray={`${SEG} ${CIRC - SEG}`}
            strokeDashoffset={fillOffset}
            transform={`rotate(${seg.rotate} 42 42)`}
            className="motion-reduce:transition-none"
            style={{ transition: "stroke-dashoffset 0.5s ease-in-out" }}
          />
        ))}
      </svg>
      <span className="absolute inset-0 flex flex-col items-center justify-center gap-[3px]">
        <span
          className="text-[21px] leading-none tabular-nums"
          style={{ color: "var(--color-text-primary)", fontWeight: 700 }}
        >
          {Math.round(pct)}%
        </span>
        <span className="text-[11px] leading-none font-semibold" style={{ color: "var(--color-text-disabled)" }}>
          8+8+8
        </span>
      </span>
    </div>
  );
}

// ============================================================
// 首页
// ============================================================

// ── 画布 lf-switch（iOS 风格，走项目 token）──
function LfSwitch({ checked, onChange, label }: { checked: boolean; onChange: (v: boolean) => void; label: string }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      onClick={() => onChange(!checked)}
      className="relative h-[30px] w-[50px] shrink-0 rounded-full transition-colors active:opacity-80"
      style={{ background: checked ? "var(--lifeflow-primary)" : "var(--lifeflow-border)" }}
    >
      <span
        className="absolute top-[2px] left-[2px] h-[26px] w-[26px] rounded-full transition-transform"
        style={{
          background: "var(--color-surface-card)",
          boxShadow: "var(--shadow-card)",
          transform: checked ? "translateX(20px)" : "translateX(0)",
        }}
      />
    </button>
  );
}

/** 画布 lf-chip-opt 单选态样式（时长 / 提前量共用） */
function chipStyle(active: boolean): React.CSSProperties {
  return {
    background: active ? "var(--lifeflow-primary)" : "var(--lifeflow-muted)",
    border: `1px solid ${active ? "var(--lifeflow-primary)" : "var(--lifeflow-border)"}`,
    color: active ? "var(--lifeflow-primary-foreground)" : "var(--color-text-secondary)",
  };
}

export default function HomePage() {
  const router = useRouter();
  const today = todayStr();
  const now = new Date();

  // ── 全局主题：首页右上角日间/夜间切换 ──
  const { resolvedTheme, setTheme } = useTheme();
  const toggleTheme = useCallback(() => {
    setTheme(resolvedTheme === "dark" ? "light" : "dark");
  }, [resolvedTheme, setTheme]);

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
  const { store: threeThings, toggle: toggleThree, updateText: updateThreeText } = useThreeThings();
  const threeItems = threeThings?.items ?? [];
  // 三件事编辑（T22.8 修复：占位行「点击 ✎」接入编辑入口）
  const [editingThree, setEditingThree] = useState<string | null>(null);
  const [draftThree, setDraftThree] = useState("");
  const startEditThree = (id: string, text: string) => {
    setEditingThree(id);
    setDraftThree(text);
  };
  const commitThree = (id: string) => {
    const text = draftThree.trim();
    if (text) updateThreeText(id, text);
    setEditingThree(null);
    setDraftThree("");
  };

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

  // ── 明日预告（晚间态卡片）：真实明日数据源 ──
  // 明日三件事：明日日程 Item；明日理想日：L2 规划（getIdealDayPlans 无则空态）
  const tomorrow = useMemo(() => {
    const d = new Date();
    d.setDate(d.getDate() + 1);
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  }, []);
  const tomorrowItems = useLiveQuery(() => getItemsByDate(tomorrow), [tomorrow], []);
  const tomorrowPlans = useLiveQuery(() => getIdealDayPlans(tomorrow), [tomorrow], []);

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

  // ── 创建弹窗（对齐画布 home-day-create-sheet：时长 chips + 按理想日安排 + 到时提醒） ──
  const [showCreate, setShowCreate] = useState(false);
  const [createForm, setCreateForm] = useState({
    title: "",
    plannedStart: "",
    plannedEnd: "",
    note: "",
    color: PRESET_COLORS[0],
  });
  // 画布 lf-dur-chip：时长单选（15/30/45/60/90/全天），默认 30
  const [createDur, setCreateDur] = useState<string>("30");
  // 画布 task-ideal-toggle：按理想日安排（开启后若有理想日模板则取模板时段）
  const [idealByPlan, setIdealByPlan] = useState(false);
  // 画布 task-remind-toggle + lf-remind-offsets：到时提醒 + 提前量（默认 10 分钟）
  const [remindEnabled, setRemindEnabled] = useState(false);
  const [remindOffset, setRemindOffset] = useState(10);
  const resetForm = () => {
    const n = new Date();
    const start = `${String(n.getHours()).padStart(2, "0")}:${String(n.getMinutes()).padStart(2, "0")}`;
    const later = new Date(n.getTime() + 30 * 60000);
    const end = `${String(later.getHours()).padStart(2, "0")}:${String(later.getMinutes()).padStart(2, "0")}`;
    setCreateForm({ title: "", plannedStart: start, plannedEnd: end, note: "", color: PRESET_COLORS[0] });
    setCreateDur("30");
    setIdealByPlan(false);
    setRemindEnabled(false);
    setRemindOffset(10);
  };
  /** 时长 chips 单选：结束时间 = 开始 + 时长；「全天」= 00:00-23:59 */
  const handlePickDuration = (dur: string) => {
    setCreateDur(dur);
    setCreateForm((f) => {
      if (dur === "all") return { ...f, plannedStart: "00:00", plannedEnd: "23:59" };
      return { ...f, plannedEnd: addMinutesTime(f.plannedStart, Number(dur)) };
    });
  };
  /** 按理想日安排：真实逻辑 = getIdealDayConfig 取模板对应时段；无模板（系统关闭）保持手动 */
  const handleIdealToggle = async (on: boolean) => {
    setIdealByPlan(on);
    if (!on) return;
    try {
      const { getIdealDayConfig } = await import("@/lib/ideal-day");
      const { selectTemplateV2 } = await import("@/lib/ideal-day-templates");
      const config = await getIdealDayConfig();
      if (!config.enabled) return; // 无理想日模板 → 保持手动
      const tpl = selectTemplateV2(config, today);
      const blocks = tpl?.blocks ?? [];
      const nowT = nowTimeStr();
      const block = blocks.find((b) => b.start <= nowT && nowT < b.end)
        ?? blocks.find((b) => b.start >= nowT)
        ?? blocks[0];
      if (block) {
        setCreateForm((f) => ({ ...f, plannedStart: block.start, plannedEnd: block.end }));
      }
    } catch { /* 读取失败保持手动 */ }
  };
  const [submitting, setSubmitting] = useState(false);
  const handleCreate = useCallback(async () => {
    if (submitting) return;
    const title = createForm.title.trim();
    if (!title) { showToast({ type: "error", message: "请输入事项名称" }); return; }
    if (!createForm.plannedStart || !createForm.plannedEnd) { showToast({ type: "error", message: "请选择时间" }); return; }
    setSubmitting(true);
    try {
      // 到时提醒：addManualItem 不支持提醒字段 → 按规则存到 note 后缀「⏰提前N分钟」，不新增 Dexie 字段
      const rawNote = createForm.note.trim();
      const note = remindEnabled
        ? rawNote ? `${rawNote} ⏰提前${remindOffset}分钟` : `⏰提前${remindOffset}分钟`
        : (rawNote || undefined);
      await addManualItem({
        date: today,
        plannedStart: createForm.plannedStart,
        plannedEnd: createForm.plannedEnd,
        title,
        note,
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
  }, [createForm, today, submitting, remindEnabled, remindOffset]);

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
            {showNightRitual ? "晚安，今天辛苦了" : greeting()}
          </h1>
          <p className="mt-1 text-[13px]" style={{ color: "var(--color-text-secondary)" }}>
            {showNightRitual ? formatDateChinese(now) : `${formatDateChinese(now)} · 今天也一起织`}
          </p>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <Link
            href="/more"
            aria-label="更多功能"
            className="mt-0.5 h-10 w-10 shrink-0 flex items-center justify-center rounded-full active:opacity-60"
            style={{ background: "var(--color-surface-card)", boxShadow: "var(--shadow-card)", border: "1px solid var(--lifeflow-border)" }}
          >
            <Ellipsis className="w-5 h-5" style={{ color: "var(--color-text-secondary)" }} />
          </Link>
          <button
            type="button"
            aria-label={resolvedTheme === "dark" ? "切换到白天形态" : "切换到晚间形态"}
            onClick={toggleTheme}
            className="mt-0.5 flex h-10 w-10 shrink-0 items-center justify-center rounded-full transition-transform active:scale-95 active:opacity-60"
            style={{ background: "var(--color-surface-card)", boxShadow: "var(--shadow-card)" }}
          >
            {resolvedTheme === "dark"
              ? <Sun className="w-5 h-5" style={{ color: "var(--color-text-secondary)" }} />
              : <Moon className="w-5 h-5" style={{ color: "var(--color-text-secondary)" }} />}
          </button>
        </div>
      </motion.div>

      {/* ===== 新用户引导 ===== */}
      <OnboardingCard />

      {/* ===== ① 今日待办单卡（三件事 + 执行流 + 矫正提醒） ===== */}
      <div className="px-4 mb-3">
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3, ease: "easeOut" }}
          className="rounded-[16px] px-4 pt-4 pb-3"
          style={{ background: "var(--color-surface-card)", boxShadow: "var(--shadow-card)" }}
        >
          {/* 卡头 */}
          <div className="flex items-center justify-between gap-3">
            <h2 className="text-[20px] font-bold leading-tight min-w-0 flex-1 truncate" style={{ color: "var(--color-text-primary)" }}>
              今日待办
            </h2>
            <span
              className="shrink-0 rounded-[6px] px-2.5 py-1 text-[12px] font-semibold tabular-nums"
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
                    {editingThree === item.id ? (
                      <input
                        value={draftThree}
                        onChange={(e) => setDraftThree(e.target.value)}
                        onBlur={() => commitThree(item.id)}
                        onKeyDown={(e) => { if (e.key === "Enter") commitThree(item.id); }}
                        placeholder="输入今天最重要的一件事…"
                        aria-label="编辑最重要的一件事"
                        autoFocus
                        className="min-w-0 flex-1 bg-transparent outline-none text-[14px] font-semibold"
                        style={{ color: "var(--color-text-primary)" }}
                      />
                    ) : (
                      <button
                        type="button"
                        onClick={() => startEditThree(item.id, item.text || "")}
                        className="min-w-0 flex-1 text-left active:opacity-60"
                        aria-label={item.text ? `编辑：${item.text}` : "添加最重要的一件事"}
                      >
                        <span
                          className="block text-[14px] font-semibold leading-snug truncate"
                          style={{
                            color: item.done ? "var(--color-text-disabled)" : item.text ? "var(--color-text-primary)" : "var(--color-text-tertiary)",
                            textDecoration: item.done ? "line-through" : "none",
                          }}
                        >
                          {item.text || "点击 ✎ 添加最重要的一件事…"}
                        </span>
                      </button>
                    )}
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
                      style={{
                        background: act.sourceType === "ideal" ? "rgba(99,102,241,0.14)" : "var(--lifeflow-brand-50)",
                        color: act.sourceType === "ideal" ? "#6366F1" : "var(--lifeflow-primary)",
                      }}
                    >
                      {act.tag}
                    </span>
                  )}
                  {/* T22.5：理想日规划项跳转定位 */}
                  {act.sourceType === "ideal" && act.blockId && (
                    <button
                      type="button"
                      aria-label={`理想日：${act.title}`}
                      onClick={(e) => { e.stopPropagation(); router.push(`/ideal-day?block=${act.blockId}`); }}
                      className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full active:scale-90 transition-transform"
                      style={{ background: "rgba(99,102,241,0.1)", color: "#6366F1" }}
                    >
                      <Sun className="h-3.5 w-3.5" />
                    </button>
                  )}
                  <button
                    type="button"
                    aria-label={`专注：${act.title}`}
                    onClick={(e) => { e.stopPropagation(); router.push("/more/focus"); }}
                    className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full active:scale-90 transition-transform"
                    style={{ background: "rgba(139,92,246,0.14)", color: "rgba(139,92,246,1)" }}
                  >
                    <Timer className="h-3.5 w-3.5" />
                  </button>
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

      {/* ===== ①b 晚间态 · 明日三件事草稿 + 明日理想日要点（21:00 后显示，对齐画布 4a/4b） ===== */}
      {showNightRitual && (
        <>
          {/* 明日三件事草稿（tomorrow-draft：编辑按钮 + 圆点/标题/mono 时间，真实明日 items） */}
          <div className="px-4 mb-3">
            <motion.div
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.06, duration: 0.3, ease: "easeOut" }}
              className="rounded-[16px] px-4 pt-4 pb-3"
              style={{ background: "var(--color-surface-card)", boxShadow: "var(--shadow-card)" }}
            >
              <div className="flex items-center justify-between gap-3">
                <h2 className="text-[20px] font-bold leading-tight min-w-0 flex-1 truncate" style={{ color: "var(--color-text-primary)" }}>
                  明日三件事
                </h2>
                <button
                  type="button"
                  aria-label="编辑明日三件事"
                  onClick={() => router.push("/ideal-day")}
                  className="flex shrink-0 items-center gap-1 rounded-md px-2.5 py-1 text-[12px] font-semibold active:opacity-70"
                  style={{ background: "rgba(99,102,241,0.14)", color: "#6366F1" }}
                >
                  <Pencil className="h-3.5 w-3.5" />编辑
                </button>
              </div>
              {tomorrowItems.length === 0 ? (
                <p className="mt-3 text-[13px] leading-relaxed" style={{ color: "var(--color-text-tertiary)" }}>
                  睡前记下明早最重要的事
                </p>
              ) : (
                <ul className="mt-3 space-y-2.5">
                  {tomorrowItems.slice(0, 3).map((item) => (
                    <li key={item.id} className="flex items-center gap-2">
                      <span className="h-[6px] w-[6px] shrink-0 rounded-full" style={{ background: "#6366F1" }} />
                      <span
                        className="min-w-0 flex-1 truncate text-[14px] font-medium"
                        style={{ color: item.isCompleted ? "var(--color-text-disabled)" : "var(--color-text-primary)" }}
                      >
                        {item.title}
                      </span>
                      <span className="shrink-0 text-[11px] tabular-nums" style={{ color: "var(--color-text-tertiary)" }}>
                        {item.plannedStart}
                      </span>
                    </li>
                  ))}
                </ul>
              )}
              <p className="mt-3 text-[12px]" style={{ borderTop: "1px solid var(--lifeflow-border)", paddingTop: 10, color: "var(--color-text-tertiary)" }}>
                草稿 · 睡前再过一遍，明早直接开始
              </p>
            </motion.div>
          </div>

          {/* 明日理想日要点（tomorrow-ideal：时间要点 chips + 一句提示，真实明日理想日规划） */}
          <div className="px-4 mb-3">
            <motion.div
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.08, duration: 0.3, ease: "easeOut" }}
              className="rounded-[16px] px-4 pt-4 pb-3"
              style={{ background: "var(--color-surface-card)", boxShadow: "var(--shadow-card)" }}
            >
              <div className="flex items-center justify-between gap-3">
                <h2 className="text-[20px] font-bold leading-tight min-w-0 flex-1 truncate" style={{ color: "var(--color-text-primary)" }}>
                  明日理想日
                </h2>
                <Sun className="h-4 w-4 shrink-0" style={{ color: "#6366F1" }} />
              </div>
              {tomorrowPlans.length === 0 ? (
                <p className="mt-3 text-[13px] leading-relaxed" style={{ color: "var(--color-text-tertiary)" }}>
                  明早到理想日页安排
                </p>
              ) : (
                <>
                  <div className="mt-3 flex flex-wrap gap-2">
                    {tomorrowPlans.slice(0, 4).map((p) => (
                      <span
                        key={`${p.blockId}-${p.feature}`}
                        className="inline-flex items-center rounded-md px-2.5 py-1.5 text-[12px] font-medium tabular-nums"
                        style={{ background: "rgba(99,102,241,0.14)", color: "#6366F1" }}
                      >
                        {p.start} {getFeatureMeta(p.feature).label}
                      </span>
                    ))}
                  </div>
                  <p className="mt-3 text-[12px]" style={{ color: "var(--color-text-secondary)" }}>
                    节奏比今天更从容，留 30 分钟缓冲
                  </p>
                </>
              )}
            </motion.div>
          </div>
        </>
      )}

      {/* ===== ② 健康概览条（睡眠/饮水/习惯/专注） ===== */}
      <div className="px-4 mb-3">
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.04, duration: 0.3, ease: "easeOut" }}
          className="rounded-[16px] px-1.5 py-3 flex items-stretch"
          style={{ background: "var(--color-surface-card)", boxShadow: "var(--shadow-card)" }}
        >
          <button type="button" onClick={() => router.push("/more/sleep")} aria-label="打卡：查看睡眠"
            className="flex min-w-0 flex-1 flex-col items-center gap-1.5 px-1 active:opacity-70">
            <span
              className="flex h-[34px] w-[34px] items-center justify-center rounded-full"
              style={{ background: "rgba(99,102,241,0.14)", color: "#6366F1" }}
            >
              <Moon className="h-4 w-4" />
            </span>
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
            <span
              className="flex h-[34px] w-[34px] items-center justify-center rounded-full"
              style={{ background: "rgba(59,130,246,0.14)", color: "#3B82F6" }}
            >
              <Droplets className="h-4 w-4" />
            </span>
            <span className="text-[13px] font-semibold leading-none tabular-nums" style={{ color: "var(--color-text-primary)" }}>
              {todayWaterMl}/{waterSettings.dailyTarget}
            </span>
            <span className="text-[11px] leading-none" style={{ color: "var(--color-text-secondary)" }}>已饮水 · ml</span>
          </button>
          <span className="w-px shrink-0" style={{ background: "var(--lifeflow-border)" }} />
          <button type="button" onClick={() => router.push("/more/habits")} aria-label="打卡：习惯进度"
            className="flex min-w-0 flex-1 flex-col items-center gap-1.5 px-1 active:opacity-70">
            <span
              className="flex h-[34px] w-[34px] items-center justify-center rounded-full"
              style={{ background: "rgba(16,185,129,0.14)", color: "#10B981" }}
            >
              <Repeat className="h-4 w-4" />
            </span>
            <span className="text-[13px] font-semibold leading-none tabular-nums" style={{ color: "var(--color-text-primary)" }}>
              {habitDone}/{habitTotal}
            </span>
            <span className="text-[11px] leading-none" style={{ color: "var(--color-text-secondary)" }}>习惯完成</span>
          </button>
          <span className="w-px shrink-0" style={{ background: "var(--lifeflow-border)" }} />
          <button type="button" onClick={() => router.push("/more/focus")} aria-label="打卡：查看专注"
            className="flex min-w-0 flex-1 flex-col items-center gap-1.5 px-1 active:opacity-70">
            <span
              className="flex h-[34px] w-[34px] items-center justify-center rounded-full"
              style={{ background: "rgba(139,92,246,0.14)", color: "#8B5CF6" }}
            >
              <Timer className="h-4 w-4" />
            </span>
            <span className="text-[13px] font-semibold leading-none tabular-nums" style={{ color: "var(--color-text-primary)" }}>
              {formatMinutes(focusMinutes ?? 0)}
            </span>
            <span className="text-[11px] leading-none" style={{ color: "var(--color-text-secondary)" }}>已专注</span>
          </button>
        </motion.div>
      </div>

      {/* ===== ③ 晚间睡前仪式（21:00 后显示） ===== */}
      {showNightRitual && <SleepRitualCard />}

      {/* ===== ③b 晚间态 · 今日复盘总结（review-night：完成率大数字 + knit 进度条 + 一句话；点卡跳长期主义） ===== */}
      {showNightRitual && (
        <div className="px-4 mb-3">
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.06, duration: 0.3, ease: "easeOut" }}
          >
            <Link
              href="/longtermism"
              className="block rounded-[16px] px-4 pt-4 pb-3 active:opacity-70"
              style={{ background: "var(--color-surface-card)", boxShadow: "var(--shadow-card)" }}
            >
              <div className="flex items-center justify-between gap-3">
                <h2 className="text-[20px] font-bold leading-tight min-w-0 flex-1 truncate" style={{ color: "var(--color-text-primary)" }}>
                  今日复盘
                </h2>
                <span className="flex shrink-0 items-center whitespace-nowrap text-[12px] font-semibold" style={{ color: "var(--lifeflow-primary)" }}>
                  长期主义<ArrowRight className="ml-0.5 inline h-3 w-3" />
                </span>
              </div>
              {total > 0 ? (
                <>
                  <div className="mt-4 flex items-end gap-2">
                    <span className="text-[34px] font-semibold leading-none tabular-nums" style={{ color: "var(--color-text-primary)" }}>
                      {Math.round((done / total) * 100)}%
                    </span>
                    <span className="mb-1 text-[12px]" style={{ color: "var(--color-text-tertiary)" }}>
                      今日完成率
                    </span>
                  </div>
                  <div
                    className="mt-3 h-[6px] overflow-hidden rounded-full"
                    role="progressbar"
                    aria-valuenow={Math.round((done / total) * 100)}
                    aria-valuemin={0}
                    aria-valuemax={100}
                    aria-label={`今日完成率 ${Math.round((done / total) * 100)}%`}
                    style={{ background: "var(--lifeflow-knit-bg)" }}
                  >
                    <div
                      className="h-full rounded-full"
                      style={{
                        width: `${Math.round((done / total) * 100)}%`,
                        background: "var(--lifeflow-primary)",
                        transition: "width 0.5s ease-in-out",
                      }}
                    />
                  </div>
                  <p className="mt-2 text-[13px] leading-relaxed" style={{ color: "var(--color-text-secondary)" }}>
                    {reviewSnippet || "三件事按时完成，专注再久一点"}
                  </p>
                </>
              ) : (
                <p className="mt-3 text-[13px] leading-relaxed" style={{ color: "var(--color-text-tertiary)" }}>
                  今天还没有安排事项，睡前记下几件最重要的事吧
                </p>
              )}
            </Link>
          </motion.div>
        </div>
      )}

      {/* ===== ④ 复盘一句话入口（长期主义唯一复盘入口） ===== */}
      <div className="px-4 mb-3">
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.08, duration: 0.3, ease: "easeOut" }}
        >
          <Link
            href="/longtermism"
            className="flex items-center gap-2.5 rounded-[16px] px-4 py-3.5 active:opacity-70"
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
                      onChange={(e) => {
                        const v = e.target.value;
                        setCreateForm((f) => ({
                          ...f,
                          plannedStart: v,
                          // 已选时长（非全天）→ 结束时间跟随 = 开始 + 时长
                          plannedEnd: createDur && createDur !== "all" ? addMinutesTime(v, Number(createDur)) : f.plannedEnd,
                        }));
                      }}
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

                {/* 时长 chips（画布 lf-dur-chip：15/30/45/60/90/全天 单选；选中自动算结束时间） */}
                <div className="mb-4">
                  <label className="flex items-center gap-1.5 text-[13px] font-medium mb-2 block" style={{ color: "var(--color-text-secondary)" }}>
                    <Timer className="h-3.5 w-3.5" />时长（分钟）
                  </label>
                  <div className="flex flex-wrap gap-2" role="group" aria-label="时长选择">
                    {DURATION_CHIPS.map((d) => (
                      <button
                        key={d}
                        type="button"
                        onClick={() => handlePickDuration(String(d))}
                        aria-pressed={createDur === String(d)}
                        className="inline-flex min-w-[50px] h-[34px] items-center justify-center rounded-full px-3 text-[13px] font-semibold tabular-nums active:scale-95 transition-transform"
                        style={chipStyle(createDur === String(d))}
                      >
                        {d}
                      </button>
                    ))}
                    <button
                      type="button"
                      onClick={() => handlePickDuration("all")}
                      aria-pressed={createDur === "all"}
                      className="inline-flex min-w-[50px] h-[34px] items-center justify-center rounded-full px-3 text-[13px] font-semibold active:scale-95 transition-transform"
                      style={chipStyle(createDur === "all")}
                    >
                      全天
                    </button>
                  </div>
                </div>

                {/* 按理想日安排 switch（画布 task-ideal-toggle；开启且有模板则取模板时段） */}
                <div className="flex items-center justify-between gap-3 mb-4">
                  <div className="flex min-w-0 flex-col gap-1">
                    <span className="flex items-center gap-1.5 text-[13px] font-medium" style={{ color: "var(--color-text-secondary)" }}>
                      <Sun className="h-3.5 w-3.5" />按理想日安排
                    </span>
                    {idealByPlan && (
                      <p className="text-[11px] leading-snug" style={{ color: "var(--color-text-tertiary)" }}>
                        将按理想日模板自动安排到对应时段
                      </p>
                    )}
                  </div>
                  <LfSwitch checked={idealByPlan} onChange={handleIdealToggle} label="按理想日安排" />
                </div>

                {/* 到时提醒 switch + 偏移 chips（画布 task-remind-toggle + lf-remind-offsets：0/5/10/15） */}
                <div className="mb-4">
                  <div className="flex items-center justify-between gap-3">
                    <span className="flex items-center gap-1.5 text-[13px] font-medium" style={{ color: "var(--color-text-secondary)" }}>
                      <AlertCircle className="h-3.5 w-3.5" />到时提醒
                    </span>
                    <LfSwitch checked={remindEnabled} onChange={setRemindEnabled} label="到时提醒" />
                  </div>
                  {remindEnabled && (
                    <div className="mt-3 flex flex-col items-start gap-2">
                      <span className="text-[12px]" style={{ color: "var(--color-text-secondary)" }}>提前提醒（分钟）</span>
                      <div className="flex flex-wrap gap-2" role="group" aria-label="提醒提前量">
                        {REMIND_OFFSETS.map((o) => (
                          <button
                            key={o}
                            type="button"
                            onClick={() => setRemindOffset(o)}
                            aria-pressed={remindOffset === o}
                            className="inline-flex min-w-[50px] h-[34px] items-center justify-center rounded-full px-3 text-[13px] font-semibold tabular-nums active:scale-95 transition-transform"
                            style={chipStyle(remindOffset === o)}
                          >
                            {o}
                          </button>
                        ))}
                      </div>
                    </div>
                  )}
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

