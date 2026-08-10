"use client";

// ─── T15b：体态拉伸 Tab（由 /more/posture 页面抽取，去掉独立 header，嵌入训练中心） ───
// 视觉升级：对齐 lifeflow-home-redesign-v2/pages/posture.html 画布
// （清单行 完成勾选/名称/秒数 stepper/删除、今日摘要 module-habit 绿点缀、
//  展开式添加表单、空态、保存区 detail JSON [{name, seconds}] + content 摘要预览 + 完成态、
//  本周统计 6px 细进度条 + 连续达标）
// 数据读写与线上逻辑不变：healthDB.stretchLogs 读取/写入/删除、postureSettings 设置、
// 记录表单（动作名/组数/次数/体态问题/备注）、Toast 反馈。
// 注意：今日拉伸清单为画布式草稿（detail JSON + content 摘要持久化到本地 store），
// health.db 的详细记录仍由「记录拉伸」表单写入，读写路径与线上完全一致。

import { useState, useEffect, useCallback, useMemo, type CSSProperties } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Plus,
  Minus,
  X,
  Settings,
  Check,
  Trash2,
  Save,
  PersonStanding,
  Timer,
  TrendingUp,
  Leaf,
  CalendarDays,
} from "lucide-react";
import { healthDB, getPostureSettings, updatePostureSettings } from "@/lib/db/health.db";
import type { StretchLog } from "@/lib/db/health.db";
import { showToast } from "@/components/ui/Toast";

const POSTURE_ISSUES = ["驼背", "圆肩", "骨盆前倾", "头部前倾", "脊柱侧弯"] as const;

const QUICK_STRETCHES = [
  { name: "猫式拉伸", desc: "脊柱灵活性" },
  { name: "下犬式", desc: "全身拉伸" },
  { name: "眼镜蛇式", desc: "改善驼背" },
  { name: "蝴蝶拉伸", desc: "髋部打开" },
  { name: "肩部拉伸", desc: "改善圆肩" },
  { name: "颈部放松", desc: "缓解头部前倾" },
  { name: "90-90呼吸", desc: "核心呼吸激活" },
];

/* 画布 module-habit 绿（与主页面力量/有氧配色惯例一致） */
const HABIT_GREEN = "#10B981";
const HABIT_GREEN_LIGHT = "rgba(16,185,129,0.14)";

/* 今日拉伸清单草稿持久化（画布 store 模拟：detail JSON + content 摘要 + savedAt；跨 Tab 切换不丢，跨天重置） */
const DRAFT_KEY = "lifeflow-posture-draft-v1";

interface DraftRow {
  name: string;
  seconds: number;
  done: boolean;
  desc?: string;
}

interface PostureDraft {
  date: string;
  rows: DraftRow[];
  savedAt?: number;
  detail?: string;
  content?: string;
  count?: number;
}

function localToday(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function isDateInWeek(dateStr: string): boolean {
  const d = new Date(dateStr + "T00:00:00");
  const now = new Date();
  const dow = now.getDay();
  const mon = new Date(now);
  mon.setDate(now.getDate() - (dow === 0 ? 6 : dow - 1));
  mon.setHours(0, 0, 0, 0);
  const sun = new Date(mon);
  sun.setDate(mon.getDate() + 6);
  sun.setHours(23, 59, 59, 999);
  return d.getTime() >= mon.getTime() && d.getTime() <= sun.getTime();
}

/* 连续达标天数：从今天（若今天无记录则从昨天）往回数连续有记录的天数 */
function calcStreak(dateSet: Set<string>): number {
  const fmt = (d: Date) =>
    `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  const cursor = new Date();
  if (!dateSet.has(fmt(cursor))) cursor.setDate(cursor.getDate() - 1);
  let streak = 0;
  while (dateSet.has(fmt(cursor))) {
    streak += 1;
    cursor.setDate(cursor.getDate() - 1);
  }
  return streak;
}

/* 秒数 stepper：5 秒步进，5~120 钳制 */
function clampSec(n: number): number {
  return Math.min(120, Math.max(5, Math.round(n / 5) * 5));
}

function fmtDate(d: string) {
  const date = new Date(d + "T00:00:00");
  const ws = ["日", "一", "二", "三", "四", "五", "六"];
  return `${date.getMonth() + 1}/${date.getDate()} 周${ws[date.getDay()]}`;
}

const CARD_STYLE: CSSProperties = {
  background: "var(--color-surface-card)",
  borderRadius: 16,
  boxShadow: "var(--shadow-card)",
};

export default function PostureTab() {
  const [logs, setLogs] = useState<StretchLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);

  // ─── Posture Settings State（线上原样保留） ───
  const [preSleepOffset, setPreSleepOffset] = useState(40);
  const [postWakeOffset, setPostWakeOffset] = useState(2);
  const [napExclude, setNapExclude] = useState(true);
  const [settingsLoading, setSettingsLoading] = useState(true);

  const [exName, setExName] = useState("");
  const [sets, setSets] = useState(1);
  const [reps, setReps] = useState(15);
  const [issue, setIssue] = useState("");
  const [note, setNote] = useState("");
  const [submitting, setSubmitting] = useState(false);

  /* ─── 今日拉伸清单（草稿，画布交互模型） ─── */
  const [draftRows, setDraftRows] = useState<DraftRow[]>(() =>
    QUICK_STRETCHES.map((s) => ({ name: s.name, seconds: 30, done: false, desc: s.desc })),
  );
  const [savedAt, setSavedAt] = useState<number | null>(null);
  const [adding, setAdding] = useState(false);
  const [addName, setAddName] = useState("");
  const [addSeconds, setAddSeconds] = useState(30);
  const [touchTick, setTouchTick] = useState<Record<number, number>>({});
  const [draftReady, setDraftReady] = useState(false);

  const loadLogs = useCallback(async () => {
    const all = await healthDB.stretchLogs.orderBy("date").reverse().limit(50).toArray();
    setLogs(all);
    setLoading(false);
  }, []);

  useEffect(() => { loadLogs(); }, [loadLogs]);

  // Load posture settings（线上原样保留）
  useEffect(() => {
    getPostureSettings().then(s => {
      setPreSleepOffset(s.preSleepOffset);
      setPostWakeOffset(s.postWakeOffset);
      setNapExclude(s.napExclude);
      setSettingsLoading(false);
    }).catch(() => setSettingsLoading(false));
  }, []);

  /* ─── 草稿持久化（本地草稿，不影响线上数据读写） ─── */
  useEffect(() => {
    try {
      const raw = localStorage.getItem(DRAFT_KEY);
      if (raw) {
        const d = JSON.parse(raw) as PostureDraft;
        if (d && d.date === localToday() && Array.isArray(d.rows)) {
          setDraftRows(
            d.rows.map((r) => ({
              name: String(r.name || ""),
              seconds: clampSec(r.seconds),
              done: !!r.done,
              desc: typeof r.desc === "string" ? r.desc : undefined,
            })),
          );
          if (d.savedAt) setSavedAt(d.savedAt);
        }
      }
    } catch {
      // ignore
    } finally {
      setDraftReady(true);
    }
  }, []);

  useEffect(() => {
    try {
      const payload: PostureDraft = { date: localToday(), rows: draftRows };
      if (savedAt !== null) {
        payload.savedAt = savedAt;
        payload.detail = JSON.stringify(draftRows.map((r) => ({ name: r.name, seconds: r.seconds })));
        payload.content = draftRows.map((r) => `${r.name} ${r.seconds}秒`).join(" · ");
        payload.count = draftRows.length;
      }
      localStorage.setItem(DRAFT_KEY, JSON.stringify(payload));
    } catch {
      // ignore
    }
  }, [draftRows, savedAt]);

  const weekStats = useMemo(() => {
    const week = logs.filter(l => isDateInWeek(l.date));
    const days = new Set(week.map(l => l.date)).size;
    const totalSets = week.reduce((s, l) => s + l.sets, 0);
    const dates = new Set(logs.map(l => l.date));
    return { days, count: week.length, totalSets, streak: calcStreak(dates) };
  }, [logs]);

  const recentByDate = useMemo(() => {
    const map = new Map<string, StretchLog[]>();
    for (const l of logs) {
      const list = map.get(l.date) || [];
      list.push(l);
      map.set(l.date, list);
    }
    return [...map.entries()].sort(([a], [b]) => b.localeCompare(a)).slice(0, 10);
  }, [logs]);

  /* ─── 未保存回退：任何修改后回到「未保存」 ─── */
  const markDirty = useCallback(() => {
    setSavedAt(null);
  }, []);

  const touch = useCallback((i: number) => {
    setTouchTick((t) => ({ ...t, [i]: (t[i] ?? 0) + 1 }));
  }, []);

  /* ─── 清单行操作（仅草稿 UI 状态；health.db 详细记录仍走表单） ─── */
  const toggleDone = useCallback((i: number) => {
    setDraftRows((rs) => rs.map((r, idx) => (idx === i ? { ...r, done: !r.done } : r)));
    touch(i);
  }, [touch]);

  const bumpSeconds = useCallback((i: number, delta: number) => {
    setDraftRows((rs) =>
      rs.map((r, idx) => (idx === i ? { ...r, seconds: clampSec(r.seconds + delta) } : r)),
    );
    markDirty();
    touch(i);
  }, [markDirty, touch]);

  const deleteRow = useCallback(
    (i: number) => {
      const name = draftRows[i]?.name ?? "";
      setDraftRows((rs) => rs.filter((_, idx) => idx !== i));
      markDirty();
      showToast({ type: "success", message: `已删除 · ${name}` });
    },
    [draftRows, markDirty],
  );

  const addRow = useCallback(() => {
    const name = addName.trim();
    if (!name) {
      showToast({ type: "info", message: "请输入动作名称" });
      return;
    }
    setDraftRows((rs) => [...rs, { name, seconds: addSeconds, done: false }]);
    setAddName("");
    setAddSeconds(30);
    setAdding(false);
    markDirty();
    showToast({ type: "success", message: `已添加 · ${name}` });
  }, [addName, addSeconds, markDirty]);

  /* ─── 保存今日拉伸（画布 store：detail JSON + content 摘要） ─── */
  const saveToday = useCallback(() => {
    if (draftRows.length === 0) {
      showToast({ type: "info", message: "暂无拉伸动作" });
      return;
    }
    const detail = draftRows.map((r) => ({ name: r.name, seconds: r.seconds }));
    const content = draftRows.map((r) => `${r.name} ${r.seconds}秒`).join(" · ");
    try {
      const payload: PostureDraft = {
        date: localToday(),
        rows: draftRows,
        detail: JSON.stringify(detail),
        content,
        count: detail.length,
        savedAt: Date.now(),
      };
      localStorage.setItem(DRAFT_KEY, JSON.stringify(payload));
    } catch {
      // ignore
    }
    setSavedAt(Date.now());
    showToast({ type: "success", message: `已保存 · ${detail.length} 个动作` });
  }, [draftRows]);

  /* ─── 记录表单提交（线上逻辑原样保留：healthDB.stretchLogs 写入） ─── */
  const handleSubmit = async () => {
    if (!exName.trim()) return;
    setSubmitting(true);
    try {
      await healthDB.stretchLogs.add({
        exerciseName: exName.trim(),
        sets, reps,
        postureIssue: issue || undefined,
        note: note || undefined,
        date: localToday(),
        createdAt: Date.now(),
      } as any);
      setExName(""); setSets(1); setReps(15); setIssue(""); setNote("");
      setShowForm(false);
      showToast({ type: "success", message: "拉伸已记录" });
      await loadLogs();
    } catch {
      showToast({ type: "error", message: "记录失败" });
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async (id: number) => {
    await healthDB.stretchLogs.delete(id);
    showToast({ type: "success", message: "已删除" });
    await loadLogs();
  };

  // ─── Settings handlers（线上原样保留） ───
  const handlePreSleepOffsetChange = async (val: number) => {
    const clamped = Math.max(1, Math.min(120, val));
    setPreSleepOffset(clamped);
    await updatePostureSettings({ preSleepOffset: clamped });
  };

  const handlePostWakeOffsetChange = async (val: number) => {
    const clamped = Math.max(1, Math.min(60, val));
    setPostWakeOffset(clamped);
    await updatePostureSettings({ postWakeOffset: clamped });
  };

  const handleNapExcludeToggle = async () => {
    const next = !napExclude;
    setNapExclude(next);
    await updatePostureSettings({ napExclude: next });
  };

  const quickFill = (name: string, relatedIssue?: string) => {
    setExName(name);
    setIssue(relatedIssue || "");
    setShowForm(true);
  };

  /* ─── 草稿派生 ─── */
  const previewText = useMemo(
    () => (draftRows.length ? draftRows.map((r) => `${r.name} ${r.seconds}秒`).join(" · ") : ""),
    [draftRows],
  );
  const doneCount = useMemo(() => draftRows.filter((r) => r.done).length, [draftRows]);
  const progressPct = draftRows.length ? Math.round((doneCount / draftRows.length) * 100) : 0;

  if (loading || !draftReady) {
    return (
      <div className="px-4 pt-0 pb-10 space-y-4">
        {[1, 2, 3].map(i => <div key={i} className="animate-pulse h-24 rounded-[20px]" style={{ background: "var(--lifeflow-muted)" }} />)}
      </div>
    );
  }

  return (
    <div className="px-4 pt-0 pb-10 space-y-4">
      <style>{`
        @keyframes lf-pop { 0% { transform: scale(1); } 40% { transform: scale(1.12); } 100% { transform: scale(1); } }
        .lf-pop { animation: lf-pop 0.3s ease-out; }
        @keyframes lf-bump { 0% { transform: scale(1); } 40% { transform: scale(1.18); } 100% { transform: scale(1); } }
        .lf-bump { animation: lf-bump 0.3s ease-out; }
        @media (prefers-reduced-motion: reduce) { .lf-pop, .lf-bump { animation: none !important; } }
      `}</style>

      {/* 1 今日摘要行（module-habit 绿点缀，勾选后有完成态徽标） */}
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.35, ease: [0.32, 0.72, 0, 1] }}
      >
        <div
          className="flex items-center gap-3"
          style={{ background: HABIT_GREEN_LIGHT, borderRadius: 16, padding: "12px 14px" }}
        >
          <span
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full"
            style={{ background: "var(--color-surface-card)", color: HABIT_GREEN }}
            aria-hidden="true"
          >
            <PersonStanding className="h-5 w-5" />
          </span>
          <div className="min-w-0 flex-1">
            <p className="mb-1 text-[12px] font-semibold leading-none" style={{ color: HABIT_GREEN }}>
              今日已做
            </p>
            <p className="flex items-baseline gap-1">
              <span
                className="font-mono tabular-nums text-[22px] font-bold leading-none tracking-[-0.02em]"
                style={{ color: HABIT_GREEN }}
              >
                {doneCount}
              </span>
              <span className="text-[13px] font-medium" style={{ color: "var(--color-text-secondary)" }}>
                次
              </span>
            </p>
          </div>
          <span
            className="shrink-0 rounded-md px-2 py-1 text-[12px] font-semibold whitespace-nowrap"
            style={
              doneCount > 0
                ? { background: "rgba(52,199,89,0.14)", color: "var(--state-success)" }
                : { background: "var(--color-surface-card)", color: "var(--color-text-secondary)" }
            }
          >
            {doneCount > 0 ? "已完成" : "未开始"}
          </span>
        </div>
      </motion.div>

      {/* 2 今日拉伸清单卡（预设行 + 秒 stepper + 删除 + 展开式添加 + 空态） */}
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.05, duration: 0.35, ease: [0.32, 0.72, 0, 1] }}
      >
        <div style={CARD_STYLE} className="p-4">
          <div className="mb-1 flex items-center justify-between gap-2">
            <h2
              className="flex items-center gap-2 text-[17px] font-bold tracking-[-0.01em]"
              style={{ color: "var(--color-text-primary)" }}
            >
              <span
                className="flex h-7 w-7 items-center justify-center rounded-[10px]"
                style={{ background: HABIT_GREEN_LIGHT, color: HABIT_GREEN }}
              >
                <PersonStanding className="h-4 w-4" />
              </span>
              今日拉伸清单
            </h2>
            <span
              className="shrink-0 rounded-md px-2 py-1 text-[12px] font-semibold tabular-nums"
              style={{ background: HABIT_GREEN_LIGHT, color: HABIT_GREEN }}
            >
              {doneCount}/{draftRows.length} 完成
            </span>
          </div>
          <p className="mb-3 text-[12px]" style={{ color: "var(--color-text-secondary)" }}>
            逐项勾选完成，时长 5 秒步进可调
          </p>

          {/* 完成进度细条 */}
          <div
            className="relative h-[6px] w-full overflow-hidden rounded-full"
            style={{ background: "var(--lifeflow-knit-bg)" }}
            role="progressbar"
            aria-valuemin={0}
            aria-valuemax={draftRows.length}
            aria-valuenow={doneCount}
            aria-label="今日拉伸完成进度"
          >
            <div
              className="absolute left-0 top-0 h-full rounded-full transition-all duration-500"
              style={{ width: `${progressPct}%`, background: "var(--lifeflow-primary)" }}
            />
          </div>

          <ul className="mt-2">
            {draftRows.map((row, i) => (
              <li
                key={`${row.name}-${i}`}
                className="flex items-center gap-2.5 py-[11px]"
                style={i > 0 ? { borderTop: "1px solid var(--lifeflow-border)" } : undefined}
              >
                {/* 完成勾选：变绿 + 划线 + pop */}
                <motion.button
                  key={`c-${i}-${String(row.done)}-${touchTick[i] ?? 0}`}
                  type="button"
                  whileTap={{ scale: 0.85 }}
                  onClick={() => toggleDone(i)}
                  className={`flex h-[24px] w-[24px] shrink-0 items-center justify-center rounded-full border-[1.5px] ${
                    touchTick[i] !== undefined ? "lf-pop" : ""
                  }`}
                  style={{
                    borderColor: row.done ? "var(--state-success)" : "var(--lifeflow-border)",
                    borderStyle: row.done ? "solid" : "dashed",
                    background: row.done ? "var(--state-success)" : "transparent",
                    color: row.done ? "#fff" : "transparent",
                  }}
                  aria-label={row.done ? `取消完成：${row.name}` : `标记完成：${row.name}`}
                  aria-pressed={row.done}
                >
                  <Check className="h-[13px] w-[13px]" />
                </motion.button>

                {/* 动作名称 + 说明 */}
                <div className="min-w-0 flex-1">
                  <p
                    className="truncate text-[14px] font-medium"
                    style={{
                      color: row.done ? "var(--color-text-disabled)" : "var(--color-text-primary)",
                      textDecoration: row.done ? "line-through" : "none",
                      textDecorationColor: "var(--color-text-disabled)",
                    }}
                  >
                    {row.name}
                  </p>
                  {row.desc && (
                    <p className="truncate text-[12px]" style={{ color: "var(--color-text-secondary)" }}>
                      {row.desc}
                    </p>
                  )}
                </div>

                {/* 秒数 stepper：5 秒步进，5~120 钳制 */}
                <span
                  className="flex shrink-0 items-center gap-[2px] rounded-full p-[2px]"
                  style={{ background: "var(--lifeflow-muted)" }}
                  role="group"
                  aria-label={`${row.name} 时长`}
                >
                  <button
                    type="button"
                    onClick={() => bumpSeconds(i, -5)}
                    disabled={row.seconds <= 5}
                    aria-disabled={row.seconds <= 5}
                    aria-label="减少 5 秒"
                    className="flex h-[26px] w-[26px] items-center justify-center rounded-full disabled:opacity-35"
                    style={{
                      background: "var(--color-surface-card)",
                      boxShadow: "var(--shadow-card)",
                      color: row.seconds <= 5 ? "var(--color-text-disabled)" : "var(--color-text-primary)",
                    }}
                  >
                    <Minus className="h-[13px] w-[13px]" />
                  </button>
                  <span
                    key={`v-${i}-${row.seconds}-${touchTick[i] ?? 0}`}
                    className={`font-mono tabular-nums min-w-[38px] text-center text-[12px] ${
                      touchTick[i] !== undefined ? "lf-bump" : ""
                    }`}
                    style={{ color: "var(--color-text-primary)" }}
                  >
                    {row.seconds}s
                  </span>
                  <button
                    type="button"
                    onClick={() => bumpSeconds(i, 5)}
                    disabled={row.seconds >= 120}
                    aria-disabled={row.seconds >= 120}
                    aria-label="增加 5 秒"
                    className="flex h-[26px] w-[26px] items-center justify-center rounded-full disabled:opacity-35"
                    style={{
                      background: "var(--color-surface-card)",
                      boxShadow: "var(--shadow-card)",
                      color: row.seconds >= 120 ? "var(--color-text-disabled)" : "var(--color-text-primary)",
                    }}
                  >
                    <Plus className="h-[13px] w-[13px]" />
                  </button>
                </span>

                {/* 删除 */}
                <motion.button
                  type="button"
                  whileTap={{ scale: 0.85 }}
                  onClick={() => deleteRow(i)}
                  aria-label={`删除 ${row.name}`}
                  className="flex h-[28px] w-[28px] shrink-0 items-center justify-center rounded-[10px]"
                  style={{ color: "var(--color-text-disabled)" }}
                >
                  <Trash2 className="h-[14px] w-[14px]" />
                </motion.button>
              </li>
            ))}
          </ul>

          {/* 空态：全删后提示 + 添加入口 */}
          {draftRows.length === 0 && (
            <div
              className="py-4 text-center text-[13px]"
              style={{ borderTop: "1px solid var(--lifeflow-border)", color: "var(--color-text-secondary)" }}
            >
              暂无拉伸动作，点击下方「添加动作」开始
            </div>
          )}

          {/* 展开式添加表单 */}
          {!adding ? (
            <motion.button
              type="button"
              whileTap={{ scale: 0.98 }}
              onClick={() => setAdding(true)}
              aria-expanded={false}
              className="mt-3 flex h-[40px] w-full items-center justify-center gap-1.5 rounded-[10px] border-[1.5px] border-dashed text-[13px] font-semibold"
              style={{ borderColor: "var(--lifeflow-border)", background: "var(--color-surface-card)", color: HABIT_GREEN }}
            >
              <Plus className="h-4 w-4" />
              添加动作
            </motion.button>
          ) : (
            <div className="mt-3 pt-3" style={{ borderTop: "1px solid var(--lifeflow-border)" }}>
              <input
                type="text"
                maxLength={12}
                value={addName}
                autoFocus
                onChange={(e) => setAddName(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    addRow();
                  }
                }}
                placeholder="输入动作名称（限 12 字）"
                autoComplete="off"
                className="h-[38px] w-full rounded-[10px] px-3 text-[14px] outline-none"
                style={{
                  border: "1px solid var(--lifeflow-border)",
                  background: "var(--lifeflow-input)",
                  color: "var(--color-text-primary)",
                }}
              />
              <div className="mt-2.5 flex items-center justify-between">
                <span
                  className="flex shrink-0 items-center gap-[2px] rounded-full p-[2px]"
                  style={{ background: "var(--lifeflow-muted)" }}
                  role="group"
                  aria-label="新动作默认时长"
                >
                  <button
                    type="button"
                    onClick={() => setAddSeconds((s) => clampSec(s - 5))}
                    disabled={addSeconds <= 5}
                    aria-disabled={addSeconds <= 5}
                    aria-label="减少默认秒数"
                    className="flex h-[26px] w-[26px] items-center justify-center rounded-full disabled:opacity-35"
                    style={{
                      background: "var(--color-surface-card)",
                      boxShadow: "var(--shadow-card)",
                      color: addSeconds <= 5 ? "var(--color-text-disabled)" : "var(--color-text-primary)",
                    }}
                  >
                    <Minus className="h-[13px] w-[13px]" />
                  </button>
                  <span
                    className="font-mono tabular-nums min-w-[38px] text-center text-[12px]"
                    style={{ color: "var(--color-text-primary)" }}
                  >
                    {addSeconds}s
                  </span>
                  <button
                    type="button"
                    onClick={() => setAddSeconds((s) => clampSec(s + 5))}
                    disabled={addSeconds >= 120}
                    aria-disabled={addSeconds >= 120}
                    aria-label="增加默认秒数"
                    className="flex h-[26px] w-[26px] items-center justify-center rounded-full disabled:opacity-35"
                    style={{
                      background: "var(--color-surface-card)",
                      boxShadow: "var(--shadow-card)",
                      color: addSeconds >= 120 ? "var(--color-text-disabled)" : "var(--color-text-primary)",
                    }}
                  >
                    <Plus className="h-[13px] w-[13px]" />
                  </button>
                </span>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setAdding(false)}
                    className="h-[34px] rounded-[10px] px-4 text-[13px] font-medium"
                    style={{ color: "var(--color-text-secondary)" }}
                  >
                    取消
                  </button>
                  <button
                    type="button"
                    onClick={addRow}
                    className="flex h-[34px] items-center gap-1 rounded-[10px] px-4 text-[13px] font-semibold text-white"
                    style={{ background: HABIT_GREEN }}
                  >
                    <Check className="h-[13px] w-[13px]" />
                    确认添加
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      </motion.div>

      {/* 3 保存区（动态摘要预览 + 保存 CTA，修改后回退未保存态） */}
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1, duration: 0.35, ease: [0.32, 0.72, 0, 1] }}
      >
        <div style={CARD_STYLE} className="p-4">
          <div className="mb-1 flex items-center justify-between gap-2">
            <h2
              className="text-[17px] font-bold tracking-[-0.01em]"
              style={{ color: "var(--color-text-primary)" }}
            >
              今日拉伸摘要
            </h2>
            <span
              className="shrink-0 rounded-md px-2 py-1 text-[12px] font-semibold tabular-nums"
              style={
                savedAt !== null
                  ? { background: "rgba(52,199,89,0.14)", color: "var(--state-success)" }
                  : { background: "var(--lifeflow-muted)", color: "var(--color-text-secondary)" }
              }
            >
              {savedAt !== null ? "已保存" : "未保存"}
            </span>
          </div>
          <p className="text-[12px]" style={{ color: "var(--color-text-secondary)" }}>
            保存后写入当日记录
          </p>
          <p
            className="mt-3 min-h-[40px] text-[13px] leading-[1.55] break-words line-clamp-2"
            style={{ color: previewText ? "var(--color-text-secondary)" : "var(--color-text-disabled)" }}
          >
            {previewText || "暂无拉伸动作，添加后即可保存"}
          </p>
          <button
            type="button"
            onClick={saveToday}
            className="mt-3 flex h-[44px] w-full items-center justify-center gap-2 rounded-full text-[15px] font-semibold text-white transition-opacity"
            style={{ background: savedAt !== null ? "var(--state-success)" : HABIT_GREEN }}
          >
            {savedAt !== null ? (
              <>
                <Check className="h-4 w-4" />
                已保存今日
              </>
            ) : (
              <>
                <Save className="h-4 w-4" />
                保存今日拉伸
              </>
            )}
          </button>
        </div>
      </motion.div>

      {/* 4 记录拉伸（线上表单流程保留：healthDB.stretchLogs 写入） */}
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.12, duration: 0.35, ease: [0.32, 0.72, 0, 1] }}
      >
        <button
          onClick={() => setShowForm(true)}
          className="flex h-12 w-full items-center justify-center gap-2 rounded-[12px] text-white text-[15px] font-semibold active:opacity-90 transition-opacity"
          style={{ background: "var(--lifeflow-primary)" }}
        >
          <Plus className="h-[18px] w-[18px]" />
          记录拉伸
        </button>
      </motion.div>

      {/* 5 本周统计（6px 胶囊细进度条 + 本周次数 + 连续达标） */}
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.14, duration: 0.35, ease: [0.32, 0.72, 0, 1] }}
      >
        <div style={CARD_STYLE} className="p-4">
          <div className="mb-1 flex items-center justify-between gap-2">
            <h2
              className="flex items-center gap-2 text-[17px] font-bold tracking-[-0.01em]"
              style={{ color: "var(--color-text-primary)" }}
            >
              <span
                className="flex h-7 w-7 items-center justify-center rounded-[10px]"
                style={{ background: HABIT_GREEN_LIGHT, color: HABIT_GREEN }}
              >
                <TrendingUp className="h-4 w-4" />
              </span>
              本周完成统计
            </h2>
            <span
              className="shrink-0 rounded-md px-2 py-1 text-[12px] font-semibold tabular-nums"
              style={{ background: HABIT_GREEN_LIGHT, color: HABIT_GREEN }}
            >
              {weekStats.days}/7 天
            </span>
          </div>
          <p className="text-[12px]" style={{ color: "var(--color-text-secondary)" }}>
            每一次拉伸，都是对身体的长期投资
          </p>
          <div
            className="relative mt-3 h-[6px] w-full overflow-hidden rounded-full"
            style={{ background: "var(--lifeflow-knit-bg)" }}
            role="progressbar"
            aria-valuemin={0}
            aria-valuemax={7}
            aria-valuenow={weekStats.days}
            aria-label="本周完成天数"
          >
            <div
              className="absolute left-0 top-0 h-full rounded-full transition-all duration-500"
              style={{ width: `${Math.round((weekStats.days / 7) * 100)}%`, background: "var(--lifeflow-primary)" }}
            />
          </div>
          <div className="mt-3 flex items-stretch">
            <div className="flex min-w-0 flex-1 flex-col items-center gap-1.5 py-1.5">
              <span
                className="flex h-8 w-8 items-center justify-center rounded-full"
                style={{ background: HABIT_GREEN_LIGHT, color: HABIT_GREEN }}
                aria-hidden="true"
              >
                <Timer className="h-4 w-4" />
              </span>
              <span
                className="font-mono tabular-nums text-[20px] font-bold leading-none tracking-[-0.02em]"
                style={{ color: "var(--color-text-primary)" }}
              >
                {weekStats.count}
              </span>
              <span className="text-[11px] whitespace-nowrap" style={{ color: "var(--color-text-secondary)" }}>
                本周拉伸次数
              </span>
            </div>
            <div style={{ width: 1, background: "var(--lifeflow-border)" }} aria-hidden="true" />
            <div className="flex min-w-0 flex-1 flex-col items-center gap-1.5 py-1.5">
              <span
                className="flex h-8 w-8 items-center justify-center rounded-full"
                style={{ background: HABIT_GREEN_LIGHT, color: HABIT_GREEN }}
                aria-hidden="true"
              >
                <Leaf className="h-4 w-4" />
              </span>
              <span
                className="font-mono tabular-nums text-[20px] font-bold leading-none tracking-[-0.02em]"
                style={{ color: "var(--color-text-primary)" }}
              >
                {weekStats.streak}
              </span>
              <span className="text-[11px] whitespace-nowrap" style={{ color: "var(--color-text-secondary)" }}>
                连续达标
              </span>
            </div>
          </div>
        </div>
      </motion.div>

      {/* 6 设置（线上逻辑原样保留） */}
      {!settingsLoading && (
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.16, duration: 0.35, ease: [0.32, 0.72, 0, 1] }}
        >
          <div style={CARD_STYLE} className="p-4">
            <div className="mb-4 flex items-center gap-2">
              <span
                className="flex h-7 w-7 items-center justify-center rounded-[10px]"
                style={{ background: "var(--lifeflow-brand-50)", color: "var(--lifeflow-primary)" }}
              >
                <Settings className="h-4 w-4" />
              </span>
              <h2 className="text-[17px] font-semibold" style={{ color: "var(--color-text-primary)" }}>
                设置
              </h2>
            </div>

            {/* 睡前拉伸 */}
            <div className="flex items-center justify-between py-2">
              <span className="text-[15px]" style={{ color: "var(--color-text-primary)" }}>睡前拉伸</span>
              <div className="flex items-center gap-2">
                <input
                  type="number"
                  min={1}
                  max={120}
                  value={preSleepOffset}
                  onChange={(e) => handlePreSleepOffsetChange(Number(e.target.value))}
                  className="h-9 w-16 rounded-lg text-center text-[15px] outline-none"
                  style={{ border: "1px solid var(--lifeflow-border)", color: "var(--color-text-primary)", background: "var(--lifeflow-input)" }}
                />
                <span className="text-[13px]" style={{ color: "var(--color-text-secondary)" }}>分钟前</span>
              </div>
            </div>

            {/* 睡醒拉伸 */}
            <div className="flex items-center justify-between py-2" style={{ borderTop: "1px solid var(--lifeflow-border)" }}>
              <span className="text-[15px]" style={{ color: "var(--color-text-primary)" }}>睡醒拉伸</span>
              <div className="flex items-center gap-2">
                <input
                  type="number"
                  min={1}
                  max={60}
                  value={postWakeOffset}
                  onChange={(e) => handlePostWakeOffsetChange(Number(e.target.value))}
                  className="h-9 w-16 rounded-lg text-center text-[15px] outline-none"
                  style={{ border: "1px solid var(--lifeflow-border)", color: "var(--color-text-primary)", background: "var(--lifeflow-input)" }}
                />
                <span className="text-[13px]" style={{ color: "var(--color-text-secondary)" }}>分钟后</span>
              </div>
            </div>

            {/* 午睡不触发 */}
            <div className="flex items-center justify-between py-2" style={{ borderTop: "1px solid var(--lifeflow-border)" }}>
              <span className="text-[15px]" style={{ color: "var(--color-text-primary)" }}>午睡不触发</span>
              <button
                type="button"
                onClick={handleNapExcludeToggle}
                className="relative w-[51px] h-[31px] rounded-full transition-colors"
                style={{ background: napExclude ? "var(--lifeflow-primary)" : "var(--color-text-disabled)" }}
                aria-pressed={napExclude}
                aria-label="午睡不触发睡前拉伸"
              >
                <motion.div
                  className="absolute top-[2px] w-[27px] h-[27px] rounded-full bg-white shadow-sm"
                  animate={{ left: napExclude ? 22 : 2 }}
                  transition={{ type: "spring", stiffness: 500, damping: 30 }}
                />
              </button>
            </div>
          </div>
        </motion.div>
      )}

      {/* 7 最近记录（线上逻辑原样保留） */}
      {recentByDate.length > 0 && (
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.18, duration: 0.35, ease: [0.32, 0.72, 0, 1] }}
        >
          <div style={CARD_STYLE} className="p-4">
            <h2
              className="mb-4 flex items-center gap-2 text-[17px] font-bold tracking-[-0.01em]"
              style={{ color: "var(--color-text-primary)" }}
            >
              <span
                className="flex h-7 w-7 items-center justify-center rounded-[10px]"
                style={{ background: HABIT_GREEN_LIGHT, color: HABIT_GREEN }}
              >
                <CalendarDays className="h-4 w-4" />
              </span>
              最近记录
            </h2>
            {recentByDate.map(([date, items]) => (
              <div key={date} className="mb-3 last:mb-0">
                <span className="mb-1.5 block text-[13px]" style={{ color: "var(--color-text-secondary)" }}>{fmtDate(date)}</span>
                <div className="space-y-2">
                  {items.map(l => (
                    <div key={l.id} className="flex items-center justify-between rounded-xl px-3 py-2" style={{ background: "var(--lifeflow-muted)" }}>
                      <div className="min-w-0">
                        <span className="text-[14px] font-medium" style={{ color: "var(--color-text-primary)" }}>{l.exerciseName}</span>
                        <span className="ml-2 font-mono tabular-nums text-[12px]" style={{ color: "var(--color-text-secondary)" }}>{l.sets}组×{l.reps}次</span>
                        {l.postureIssue && <span className="ml-2 text-[12px]" style={{ color: "var(--lifeflow-primary)" }}>改善{l.postureIssue}</span>}
                        {l.note && <span className="ml-2 text-[12px] opacity-60" style={{ color: "var(--color-text-secondary)" }}>{l.note}</span>}
                      </div>
                      <button onClick={() => l.id !== undefined && handleDelete(l.id)} className="active:opacity-60" aria-label="删除">
                        <X className="h-3.5 w-3.5" style={{ color: "var(--color-text-disabled)" }} />
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </motion.div>
      )}

      {/* ─── Record Form Sheet（线上逻辑保留：healthDB.stretchLogs 写入） ─── */}
      <AnimatePresence>
        {showForm && (
          <>
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-50" style={{ background: "rgba(0,0,0,0.3)" }} onClick={() => setShowForm(false)} />
            <motion.div initial={{ y: "100%" }} animate={{ y: 0 }} exit={{ y: "100%" }} transition={{ type: "spring", damping: 28, stiffness: 300 }} className="fixed bottom-0 left-0 right-0 z-50 rounded-t-[20px] px-5 pt-5 pb-8" style={{ background: "var(--color-surface-card)", maxHeight: "85vh", overflowY: "auto", paddingBottom: "calc(var(--bottom-nav-height, 83px) + 20px)" }}>
              <div className="flex items-center justify-between mb-5">
                <h2 className="text-[17px] font-semibold" style={{ color: "var(--color-text-primary)" }}>记录拉伸</h2>
                <button onClick={() => setShowForm(false)} className="text-[15px] font-medium" style={{ color: "var(--lifeflow-primary)" }}>取消</button>
              </div>

              <div className="mb-5">
                <label className="text-[13px] font-medium mb-1.5 block" style={{ color: "var(--color-text-secondary)" }}>动作名称</label>
                <input type="text" value={exName} onChange={e => setExName(e.target.value)} placeholder="输入拉伸动作名" className="w-full h-11 px-4 rounded-xl text-[15px] outline-none" style={{ background: "var(--lifeflow-muted)", color: "var(--color-text-primary)" }} autoFocus />
              </div>

              {/* 快速选择（线上 quickFill 保留入口） */}
              <div className="mb-5">
                <label className="text-[13px] font-medium mb-1.5 block" style={{ color: "var(--color-text-secondary)" }}>快速选择</label>
                <div className="flex flex-wrap gap-2">
                  {QUICK_STRETCHES.map(s => (
                    <button
                      key={s.name}
                      type="button"
                      onClick={() => quickFill(s.name)}
                      className="rounded-[10px] px-3 py-1.5 text-[12px] font-medium active:opacity-70 transition-opacity"
                      style={{ background: "var(--lifeflow-brand-50)", color: "var(--lifeflow-primary)" }}
                    >
                      {s.name}
                    </button>
                  ))}
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3 mb-5">
                <div>
                  <label className="text-[13px] font-medium mb-1.5 block" style={{ color: "var(--color-text-secondary)" }}>组数</label>
                  <div className="flex items-center rounded-xl overflow-hidden" style={{ background: "var(--lifeflow-muted)" }}>
                    <button onClick={() => setSets(Math.max(1, sets - 1))} className="w-9 h-9 flex items-center justify-center active:opacity-60"><Minus className="w-4 h-4" style={{ color: "var(--color-text-secondary)" }} /></button>
                    <span className="flex-1 text-center font-mono tabular-nums text-[15px] font-semibold" style={{ color: "var(--color-text-primary)" }}>{sets}</span>
                    <button onClick={() => setSets(Math.min(20, sets + 1))} className="w-9 h-9 flex items-center justify-center active:opacity-60"><Plus className="w-4 h-4" style={{ color: "var(--color-text-secondary)" }} /></button>
                  </div>
                </div>
                <div>
                  <label className="text-[13px] font-medium mb-1.5 block" style={{ color: "var(--color-text-secondary)" }}>次数</label>
                  <div className="flex items-center rounded-xl overflow-hidden" style={{ background: "var(--lifeflow-muted)" }}>
                    <button onClick={() => setReps(Math.max(1, reps - 5))} className="w-9 h-9 flex items-center justify-center active:opacity-60"><Minus className="w-4 h-4" style={{ color: "var(--color-text-secondary)" }} /></button>
                    <span className="flex-1 text-center font-mono tabular-nums text-[15px] font-semibold" style={{ color: "var(--color-text-primary)" }}>{reps}</span>
                    <button onClick={() => setReps(Math.min(100, reps + 5))} className="w-9 h-9 flex items-center justify-center active:opacity-60"><Plus className="w-4 h-4" style={{ color: "var(--color-text-secondary)" }} /></button>
                  </div>
                </div>
              </div>

              <div className="mb-5">
                <label className="text-[13px] font-medium mb-1.5 block" style={{ color: "var(--color-text-secondary)" }}>关联体态问题</label>
                <div className="flex flex-wrap gap-2">
                  <button onClick={() => setIssue("")} className="px-3 py-1.5 rounded-full text-[12px] font-medium" style={{ background: !issue ? "var(--lifeflow-primary)" : "var(--lifeflow-muted)", color: !issue ? "#fff" : "var(--color-text-secondary)" }}>无</button>
                  {POSTURE_ISSUES.map(p => (
                    <button key={p} onClick={() => setIssue(issue === p ? "" : p)} className="px-3 py-1.5 rounded-full text-[12px] font-medium transition-colors" style={{ background: issue === p ? "var(--lifeflow-primary)" : "var(--lifeflow-muted)", color: issue === p ? "#fff" : "var(--color-text-secondary)" }}>{p}</button>
                  ))}
                </div>
              </div>

              <div className="mb-6">
                <label className="text-[13px] font-medium mb-1.5 block" style={{ color: "var(--color-text-secondary)" }}>备注（可选）</label>
                <input type="text" value={note} onChange={e => setNote(e.target.value)} placeholder="如：肩部感觉好多了" className="w-full h-11 px-4 rounded-xl text-[15px] outline-none" style={{ background: "var(--lifeflow-muted)", color: "var(--color-text-primary)" }} />
              </div>

              <button onClick={handleSubmit} disabled={submitting || !exName.trim()} className="w-full py-3.5 rounded-full text-white text-base font-semibold active:opacity-90 disabled:opacity-50" style={{ background: "var(--lifeflow-primary)" }}>
                {submitting ? "记录中..." : "保存记录"}
              </button>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  );
}
