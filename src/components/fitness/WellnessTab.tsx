"use client";

// ─── T15b：功法养生 Tab（由 /more/wellness 页面抽取，去掉独立 header，嵌入训练中心） ───
// 视觉升级：对齐 lifeflow-home-redesign-v2/pages/wellness.html 画布
// （清单行 完成勾选/名称/分钟 stepper/删除、今日摘要 module-habit 绿点缀、
//  展开式添加表单、空态、保存区摘要预览 + 完成态、本周统计 6px 细进度条 + 连续达标）
// 数据读写与线上逻辑不变：addWellnessLog / ensureModuleItem / deleteWellnessLog /
// removeModuleItems / 提肛快速记录 / 删除确认弹层 / Toast 反馈。

import { useEffect, useState, useCallback, useMemo, type CSSProperties } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Flower2,
  Activity,
  Heart,
  X,
  Plus,
  Minus,
  Check,
  Trash2,
  Sprout,
  Timer,
  Save,
  TrendingUp,
  Leaf,
  CalendarDays,
} from "lucide-react";
import {
  addWellnessLog,
  deleteWellnessLog,
  getWellnessLogsByDateRange,
} from "@/lib/db/life.db";
import type { WellnessLog } from "@/lib/db/life.db";
import { showToast } from "@/components/ui/Toast";
import { ensureModuleItem, removeModuleItems } from "@/lib/db/daylog.db";

// ============================================================
// Helpers
// ============================================================

function todayStr(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

const GONGFA_PRESETS = [
  { name: "八段锦", duration: 15 },
  { name: "太极拳", duration: 20 },
  { name: "五禽戏", duration: 15 },
  { name: "易筋经", duration: 20 },
  { name: "站桩", duration: 10 },
];

const TYPE_LABEL: Record<WellnessLog["type"], string> = {
  gongfa: "功法",
  tigang: "提肛",
};

const DAYS_TO_LOAD = 14;

/* 画布 module-habit 绿（与主页面力量/有氧配色惯例一致） */
const HABIT_GREEN = "#10B981";
const HABIT_GREEN_LIGHT = "rgba(16,185,129,0.14)";

/* 今日功法清单草稿持久化（画布 store 模拟：detail JSON + content 摘要 + savedAt；跨 Tab 切换不丢，跨天重置） */
const DRAFT_KEY = "lifeflow-wellness-draft-v1";

interface DraftRow {
  name: string;
  minutes: number;
  done: boolean;
}

interface WellnessDraft {
  date: string;
  rows: DraftRow[];
  savedAt?: number;
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

/* 分钟 stepper：1 分钟步进，1~60 钳制 */
function clampMin(n: number): number {
  return Math.min(60, Math.max(1, Math.round(n)));
}

const CARD_STYLE: CSSProperties = {
  background: "var(--color-surface-card)",
  borderRadius: 16,
  boxShadow: "var(--shadow-card)",
};

// ============================================================
// Component
// ============================================================

export default function WellnessTab() {
  const [logs, setLogs] = useState<WellnessLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);

  /* ─── 今日功法清单（草稿，画布交互模型） ─── */
  const [draftRows, setDraftRows] = useState<DraftRow[]>(() =>
    GONGFA_PRESETS.map((p) => ({ name: p.name, minutes: p.duration, done: false })),
  );
  const [savedAt, setSavedAt] = useState<number | null>(null);
  const [adding, setAdding] = useState(false);
  const [addName, setAddName] = useState("");
  const [addMinutes, setAddMinutes] = useState(10);
  const [touchTick, setTouchTick] = useState<Record<number, number>>({});
  const [draftReady, setDraftReady] = useState(false);

  /* delete confirm */
  const [deleteTarget, setDeleteTarget] = useState<number | null>(null);

  /* ─── 草稿持久化（本地草稿，不影响线上数据读写） ─── */
  useEffect(() => {
    try {
      const raw = localStorage.getItem(DRAFT_KEY);
      if (raw) {
        const d = JSON.parse(raw) as WellnessDraft;
        if (d && d.date === todayStr() && Array.isArray(d.rows)) {
          setDraftRows(
            d.rows.map((r) => ({
              name: String(r.name || ""),
              minutes: clampMin(r.minutes),
              done: !!r.done,
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
      const payload: WellnessDraft = { date: todayStr(), rows: draftRows };
      if (savedAt !== null) payload.savedAt = savedAt;
      localStorage.setItem(DRAFT_KEY, JSON.stringify(payload));
    } catch {
      // ignore
    }
  }, [draftRows, savedAt]);

  /* ─── Load ─── */
  const loadLogs = useCallback(async () => {
    try {
      const today = new Date();
      const end = todayStr();
      const start = new Date(today);
      start.setDate(start.getDate() - DAYS_TO_LOAD + 1);
      const startStr = `${start.getFullYear()}-${String(start.getMonth() + 1).padStart(2, "0")}-${String(start.getDate()).padStart(2, "0")}`;
      const data = await getWellnessLogsByDateRange(startStr, end);
      setLogs(data);
    } catch {
      // ignore
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadLogs();
  }, [loadLogs]);

  /* ─── 未保存回退：任何修改后回到「未保存」 ─── */
  const markDirty = useCallback(() => {
    setSavedAt(null);
  }, []);

  const touch = useCallback((i: number) => {
    setTouchTick((t) => ({ ...t, [i]: (t[i] ?? 0) + 1 }));
  }, []);

  /* ─── Add tigang（线上逻辑原样保留） ─── */
  const handleAddTigang = useCallback(async () => {
    setIsSaving(true);
    try {
      const logId = await addWellnessLog({
        name: "提肛",
        type: "tigang",
        date: todayStr(),
      });
      await ensureModuleItem({
        date: todayStr(),
        sourceType: "wellness",
        sourceId: `wellness_${logId}`,
        title: "提肛",
        plannedStart: "07:00",
        plannedEnd: "07:05",
        color: "#84CC16",
        icon: "Flower2",
      });
      showToast({ type: "success", message: "已记录" });
      await loadLogs();
    } catch {
      showToast({ type: "error", message: "记录失败" });
    } finally {
      setIsSaving(false);
    }
  }, [loadLogs]);

  /* ─── Delete（线上逻辑原样保留） ─── */
  const handleDelete = useCallback(async () => {
    if (deleteTarget === null) return;
    try {
      await deleteWellnessLog(deleteTarget);
      await removeModuleItems(todayStr(), "wellness", `wellness_${deleteTarget}`);
      showToast({ type: "success", message: "已删除" });
      setDeleteTarget(null);
      await loadLogs();
    } catch {
      showToast({ type: "error", message: "删除失败" });
    }
  }, [deleteTarget, loadLogs]);

  /* ─── 清单行操作（仅草稿 UI 状态，保存时才写入数据库） ─── */
  const toggleDone = useCallback((i: number) => {
    setDraftRows((rs) => rs.map((r, idx) => (idx === i ? { ...r, done: !r.done } : r)));
    touch(i);
  }, [touch]);

  const bumpMinutes = useCallback((i: number, delta: number) => {
    setDraftRows((rs) =>
      rs.map((r, idx) => (idx === i ? { ...r, minutes: clampMin(r.minutes + delta) } : r)),
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
      showToast({ type: "info", message: "请输入功法名称" });
      return;
    }
    setDraftRows((rs) => [...rs, { name, minutes: addMinutes, done: false }]);
    setAddName("");
    setAddMinutes(10);
    setAdding(false);
    markDirty();
    showToast({ type: "success", message: `已添加 · ${name}` });
  }, [addName, addMinutes, markDirty]);

  /* ─── 保存今日功法：逐行走线上 addWellnessLog + ensureModuleItem 写入路径 ─── */
  const saveToday = useCallback(async () => {
    if (isSaving) return;
    if (draftRows.length === 0) {
      showToast({ type: "info", message: "还没有功法" });
      return;
    }
    setIsSaving(true);
    try {
      const date = todayStr();
      for (const row of draftRows) {
        const logId = await addWellnessLog({
          name: row.name,
          type: "gongfa",
          duration: row.minutes,
          date,
        });
        await ensureModuleItem({
          date,
          sourceType: "wellness",
          sourceId: `wellness_${logId}`,
          title: row.name,
          plannedStart: "07:30",
          plannedEnd: "08:00",
          color: "#84CC16",
          icon: "Flower2",
        });
      }
      setSavedAt(Date.now());
      showToast({ type: "success", message: `已保存 · ${draftRows.length} 个功法` });
      await loadLogs();
    } catch {
      showToast({ type: "error", message: "记录失败" });
    } finally {
      setIsSaving(false);
    }
  }, [draftRows, isSaving, loadLogs]);

  /* ─── Group by date（线上逻辑原样保留） ─── */
  const groupedLogs = useMemo(() => {
    const map = new Map<string, WellnessLog[]>();
    for (const log of logs) {
      const arr = map.get(log.date) || [];
      arr.push(log);
      map.set(log.date, arr);
    }
    const entries = [...map.entries()].sort((a, b) => b[0].localeCompare(a[0]));
    return entries.map(([date, items]) => ({
      date,
      items: items.sort((a, b) => b.createdAt - a.createdAt),
    }));
  }, [logs]);

  /* ─── Format date（线上逻辑原样保留） ─── */
  function formatDate(dateStr: string): string {
    const today = todayStr();
    if (dateStr === today) return "今天";
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    const ys = `${yesterday.getFullYear()}-${String(yesterday.getMonth() + 1).padStart(2, "0")}-${String(yesterday.getDate()).padStart(2, "0")}`;
    if (dateStr === ys) return "昨天";
    const [y, m, d] = dateStr.split("-");
    return `${parseInt(m)}月${parseInt(d)}日`;
  }

  /* ─── 本周统计（N/7 细进度条 + 连续达标） ─── */
  const weekStats = useMemo(() => {
    const week = logs.filter((l) => isDateInWeek(l.date));
    const days = new Set(week.map((l) => l.date)).size;
    const weekMinutes = week.reduce((s, l) => s + (l.duration ?? 0), 0);
    const dates = new Set(logs.map((l) => l.date));
    return { days, weekMinutes, streak: calcStreak(dates) };
  }, [logs]);

  /* ─── 草稿派生 ─── */
  const totalMinutes = useMemo(
    () => draftRows.reduce((s, r) => s + r.minutes, 0),
    [draftRows],
  );
  const previewText = useMemo(
    () => (draftRows.length ? draftRows.map((r) => `${r.name} · ${r.minutes}分钟`).join(" · ") : ""),
    [draftRows],
  );
  const doneCount = useMemo(() => draftRows.filter((r) => r.done).length, [draftRows]);
  const progressPct = draftRows.length ? Math.round((doneCount / draftRows.length) * 100) : 0;

  /* ─── Loading ─── */
  if (loading || !draftReady) {
    return (
      <div className="px-4 pt-0 space-y-4">
        <div className="h-36 rounded-[20px] animate-pulse" style={{ background: "var(--lifeflow-muted)" }} />
        <div className="h-40 rounded-[20px] animate-pulse" style={{ background: "var(--lifeflow-muted)" }} />
      </div>
    );
  }

  /* ────────── Render ────────── */
  return (
    <div className="px-4 pt-0 pb-10 space-y-4">
      <style>{`
        @keyframes lf-pop { 0% { transform: scale(1); } 40% { transform: scale(1.12); } 100% { transform: scale(1); } }
        .lf-pop { animation: lf-pop 0.3s ease-out; }
        @keyframes lf-bump { 0% { transform: scale(1); } 40% { transform: scale(1.18); } 100% { transform: scale(1); } }
        .lf-bump { animation: lf-bump 0.3s ease-out; }
        @media (prefers-reduced-motion: reduce) { .lf-pop, .lf-bump { animation: none !important; } }
      `}</style>

      {/* 1 今日摘要行（module-habit 绿点缀，保存后完成态徽标） */}
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
            <Sprout className="h-5 w-5" />
          </span>
          <div className="min-w-0 flex-1">
            <p className="mb-1 text-[12px] font-semibold leading-none" style={{ color: HABIT_GREEN }}>
              今日已练
            </p>
            <p className="flex items-baseline gap-1">
              <span
                className="font-mono tabular-nums text-[22px] font-bold leading-none tracking-[-0.02em]"
                style={{ color: HABIT_GREEN }}
              >
                {totalMinutes}
              </span>
              <span className="text-[13px] font-medium" style={{ color: "var(--color-text-secondary)" }}>
                分钟
              </span>
            </p>
          </div>
          {savedAt !== null && (
            <motion.span
              initial={{ scale: 0.8, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={{ type: "spring", stiffness: 500, damping: 28 }}
              className="inline-flex shrink-0 items-center gap-1 rounded-md px-2 py-1 text-[12px] font-semibold whitespace-nowrap"
              style={{ background: "var(--state-success)", color: "#fff" }}
            >
              <Check className="h-3 w-3" />
              已完成
            </motion.span>
          )}
        </div>
      </motion.div>

      {/* 2 功法清单卡（预设行 + stepper + 删除 + 展开式添加 + 空态） */}
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
                <Activity className="h-4 w-4" />
              </span>
              功法清单
            </h2>
            <span
              className="shrink-0 text-[12px] font-medium tabular-nums"
              style={{ color: "var(--color-text-secondary)" }}
            >
              {draftRows.length} 项 · 共 {totalMinutes} 分钟
            </span>
          </div>
          <p className="mb-3 text-[12px]" style={{ color: "var(--color-text-secondary)" }}>
            逐项勾选完成，时长 1 分钟步进可调
          </p>

          {/* 完成进度细条 */}
          <div
            className="relative h-[6px] w-full overflow-hidden rounded-full"
            style={{ background: "var(--lifeflow-knit-bg)" }}
            role="progressbar"
            aria-valuemin={0}
            aria-valuemax={draftRows.length}
            aria-valuenow={doneCount}
            aria-label="今日功法完成进度"
          >
            <div
              className="absolute left-0 top-0 h-full rounded-full transition-all duration-500"
              style={{ width: `${progressPct}%`, background: "var(--lifeflow-primary)" }}
            />
          </div>
          <p
            className="mb-2 mt-1 text-right text-[11px] font-medium tabular-nums"
            style={{ color: "var(--color-text-secondary)" }}
          >
            {doneCount}/{draftRows.length} 完成
          </p>

          <ul className="mt-1">
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
                  className={`flex h-[26px] w-[26px] shrink-0 items-center justify-center rounded-full border-[1.5px] ${
                    touchTick[i] !== undefined ? "lf-pop" : ""
                  }`}
                  style={{
                    borderColor: row.done ? "var(--state-success)" : "var(--lifeflow-border)",
                    background: row.done ? "var(--state-success)" : "var(--color-surface-card)",
                    color: row.done ? "#fff" : "transparent",
                  }}
                  aria-label={row.done ? `取消完成：${row.name}` : `标记完成：${row.name}`}
                  aria-pressed={row.done}
                >
                  <Check className="h-[14px] w-[14px]" />
                </motion.button>

                {/* 功法名称 */}
                <div className="min-w-0 flex-1">
                  <p
                    className="truncate text-[15px] font-semibold"
                    style={{
                      color: row.done ? "var(--color-text-disabled)" : "var(--color-text-primary)",
                      textDecoration: row.done ? "line-through" : "none",
                      textDecorationColor: "var(--color-text-disabled)",
                    }}
                  >
                    {row.name}
                  </p>
                </div>

                {/* 分钟 stepper：1 分钟步进，1~60 钳制 */}
                <span
                  className="flex shrink-0 items-center gap-[2px] rounded-[10px] p-[2px]"
                  style={{ background: "var(--lifeflow-muted)" }}
                  role="group"
                  aria-label={`${row.name} 时长`}
                >
                  <button
                    type="button"
                    onClick={() => bumpMinutes(i, -1)}
                    disabled={row.minutes <= 1}
                    aria-disabled={row.minutes <= 1}
                    aria-label="减少 1 分钟"
                    className="flex h-[28px] w-[28px] items-center justify-center rounded-[8px] disabled:opacity-35"
                    style={{
                      background: "var(--color-surface-card)",
                      color: row.minutes <= 1 ? "var(--color-text-disabled)" : "var(--color-text-secondary)",
                    }}
                  >
                    <Minus className="h-[14px] w-[14px]" />
                  </button>
                  <span
                    key={`v-${i}-${row.minutes}-${touchTick[i] ?? 0}`}
                    className={`font-mono tabular-nums min-w-[38px] text-center text-[14px] font-semibold ${
                      touchTick[i] !== undefined ? "lf-bump" : ""
                    }`}
                    style={{ color: "var(--color-text-primary)" }}
                  >
                    {row.minutes}
                  </span>
                  <button
                    type="button"
                    onClick={() => bumpMinutes(i, 1)}
                    disabled={row.minutes >= 60}
                    aria-disabled={row.minutes >= 60}
                    aria-label="增加 1 分钟"
                    className="flex h-[28px] w-[28px] items-center justify-center rounded-[8px] disabled:opacity-35"
                    style={{
                      background: "var(--color-surface-card)",
                      color: row.minutes >= 60 ? "var(--color-text-disabled)" : "var(--color-text-secondary)",
                    }}
                  >
                    <Plus className="h-[14px] w-[14px]" />
                  </button>
                </span>

                {/* 删除 */}
                <motion.button
                  type="button"
                  whileTap={{ scale: 0.85 }}
                  onClick={() => deleteRow(i)}
                  aria-label={`删除 ${row.name}`}
                  className="flex h-[30px] w-[30px] shrink-0 items-center justify-center rounded-full"
                  style={{ color: "var(--color-text-disabled)" }}
                >
                  <Trash2 className="h-4 w-4" />
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
              暂无功法，点击下方「添加功法」开始记录
            </div>
          )}

          {/* 展开式添加表单 */}
          {!adding ? (
            <motion.button
              type="button"
              whileTap={{ scale: 0.98 }}
              onClick={() => setAdding(true)}
              aria-expanded={false}
              className="mt-3 flex h-[42px] w-full items-center justify-center gap-1.5 rounded-[10px] border-[1.5px] border-dashed text-[14px] font-semibold"
              style={{ borderColor: "var(--lifeflow-border)", background: "var(--color-surface-card)", color: HABIT_GREEN }}
            >
              <Plus className="h-4 w-4" />
              添加功法
            </motion.button>
          ) : (
            <div className="mt-3 flex items-center gap-2 pt-3" style={{ borderTop: "1px solid var(--lifeflow-border)" }}>
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
                placeholder="输入功法名称"
                autoComplete="off"
                className="h-[38px] min-w-0 flex-1 rounded-[10px] px-3 text-[15px] outline-none"
                style={{
                  border: "1px solid var(--lifeflow-border)",
                  background: "var(--lifeflow-input)",
                  color: "var(--color-text-primary)",
                }}
              />
              <span
                className="flex shrink-0 items-center gap-[2px] rounded-[10px] p-[2px]"
                style={{ background: "var(--lifeflow-muted)" }}
                role="group"
                aria-label="新功法默认时长"
              >
                <button
                  type="button"
                  onClick={() => setAddMinutes((m) => clampMin(m - 1))}
                  disabled={addMinutes <= 1}
                  aria-disabled={addMinutes <= 1}
                  aria-label="减少默认时长"
                  className="flex h-[28px] w-[28px] items-center justify-center rounded-[8px] disabled:opacity-35"
                  style={{ background: "var(--color-surface-card)", color: "var(--color-text-secondary)" }}
                >
                  <Minus className="h-[14px] w-[14px]" />
                </button>
                <span
                  className="font-mono tabular-nums min-w-[34px] text-center text-[14px] font-semibold"
                  style={{ color: "var(--color-text-primary)" }}
                >
                  {addMinutes}
                </span>
                <button
                  type="button"
                  onClick={() => setAddMinutes((m) => clampMin(m + 1))}
                  disabled={addMinutes >= 60}
                  aria-disabled={addMinutes >= 60}
                  aria-label="增加默认时长"
                  className="flex h-[28px] w-[28px] items-center justify-center rounded-[8px] disabled:opacity-35"
                  style={{ background: "var(--color-surface-card)", color: "var(--color-text-secondary)" }}
                >
                  <Plus className="h-[14px] w-[14px]" />
                </button>
              </span>
              <button
                type="button"
                onClick={addRow}
                className="flex h-[38px] shrink-0 items-center gap-1 rounded-[10px] px-4 text-[14px] font-semibold text-white"
                style={{ background: HABIT_GREEN }}
              >
                <Check className="h-[15px] w-[15px]" />
                确认
              </button>
            </div>
          )}
        </div>
      </motion.div>

      {/* 3 提肛练习（线上功能保留） */}
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1, duration: 0.35, ease: [0.32, 0.72, 0, 1] }}
      >
        <div style={CARD_STYLE} className="p-4">
          <div className="flex items-center justify-between gap-3">
            <div className="flex min-w-0 items-center gap-2.5">
              <span
                className="flex h-8 w-8 shrink-0 items-center justify-center rounded-[10px]"
                style={{ background: HABIT_GREEN_LIGHT, color: HABIT_GREEN }}
              >
                <Heart className="h-4 w-4" />
              </span>
              <div className="min-w-0">
                <p className="text-[14px] font-semibold" style={{ color: "var(--color-text-primary)" }}>
                  提肛练习
                </p>
                <p className="text-[12px]" style={{ color: "var(--color-text-secondary)" }}>
                  一次只需几秒，随时可做
                </p>
              </div>
            </div>
            <motion.button
              type="button"
              whileTap={{ scale: 0.95 }}
              onClick={handleAddTigang}
              disabled={isSaving}
              className="shrink-0 rounded-full px-5 py-2 text-[14px] font-semibold text-white disabled:opacity-50"
              style={{ background: "var(--lifeflow-primary)" }}
            >
              完成一次
            </motion.button>
          </div>
        </div>
      </motion.div>

      {/* 4 保存区（动态摘要预览 + 保存 CTA，修改后回退未保存态） */}
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.12, duration: 0.35, ease: [0.32, 0.72, 0, 1] }}
      >
        <div style={CARD_STYLE} className="p-4">
          <div className="mb-1 flex items-center justify-between gap-2">
            <h2
              className="text-[17px] font-bold tracking-[-0.01em]"
              style={{ color: "var(--color-text-primary)" }}
            >
              今日功法摘要
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
            保存后计入今日记录
          </p>
          <p
            className="mt-3 min-h-[40px] text-[13px] leading-[1.55] break-words line-clamp-2"
            style={{ color: previewText ? "var(--color-text-secondary)" : "var(--color-text-disabled)" }}
          >
            {previewText || "暂无功法，添加后即可保存"}
          </p>
          <button
            type="button"
            onClick={saveToday}
            disabled={isSaving || savedAt !== null}
            className="mt-3 flex h-[46px] w-full items-center justify-center gap-2 rounded-[12px] text-[15px] font-semibold text-white transition-opacity disabled:opacity-60"
            style={{ background: savedAt !== null ? "var(--state-success)" : HABIT_GREEN }}
          >
            {savedAt !== null ? (
              <>
                <Check className="h-4 w-4" />
                已完成 · {draftRows.length} 个功法
              </>
            ) : (
              <>
                <Save className="h-4 w-4" />
                保存今日功法
              </>
            )}
          </button>
        </div>
      </motion.div>

      {/* 5 本周统计（6px 胶囊细进度条 + 累计分钟 + 连续达标） */}
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.15, duration: 0.35, ease: [0.32, 0.72, 0, 1] }}
      >
        <div style={CARD_STYLE} className="p-4">
          <div className="flex items-center justify-between gap-2">
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
              本周统计
            </h2>
            <span
              className="shrink-0 rounded-md px-2 py-1 text-[12px] font-semibold tabular-nums"
              style={{ background: HABIT_GREEN_LIGHT, color: HABIT_GREEN }}
            >
              {weekStats.days}/7 天
            </span>
          </div>
          <div
            className="relative mt-3 h-[6px] w-full overflow-hidden rounded-full"
            style={{ background: "var(--lifeflow-knit-bg)" }}
            role="progressbar"
            aria-valuemin={0}
            aria-valuemax={7}
            aria-valuenow={weekStats.days}
            aria-label="本周已练天数"
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
                {weekStats.weekMinutes}
              </span>
              <span className="text-[11px] whitespace-nowrap" style={{ color: "var(--color-text-secondary)" }}>
                累计分钟
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

      {/* 6 历史记录（线上功能保留） */}
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.18, duration: 0.35, ease: [0.32, 0.72, 0, 1] }}
      >
        <div style={CARD_STYLE} className="p-4">
          <h2
            className="mb-1 flex items-center gap-2 text-[17px] font-bold tracking-[-0.01em]"
            style={{ color: "var(--color-text-primary)" }}
          >
            <span
              className="flex h-7 w-7 items-center justify-center rounded-[10px]"
              style={{ background: HABIT_GREEN_LIGHT, color: HABIT_GREEN }}
            >
              <CalendarDays className="h-4 w-4" />
            </span>
            历史记录
          </h2>
          {groupedLogs.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-8">
              <Flower2 className="mb-3 h-10 w-10" style={{ color: "var(--color-text-disabled)" }} />
              <p className="text-[15px] font-medium" style={{ color: "var(--color-text-secondary)" }}>
                还没有养生记录。完成一次练习就出现了。
              </p>
            </div>
          ) : (
            groupedLogs.map(({ date, items }) => (
              <div key={date} className="mt-3 first:mt-1">
                <span className="mb-1.5 block text-[13px] font-semibold" style={{ color: "var(--color-text-secondary)" }}>
                  {formatDate(date)}
                </span>
                {items.map((item) => (
                  <div
                    key={item.id}
                    className="flex items-center justify-between py-2.5"
                    style={{ borderBottom: "1px solid var(--lifeflow-border)" }}
                  >
                    <div className="flex min-w-0 items-center gap-2.5">
                      <span
                        className="shrink-0 rounded-md px-2 py-0.5 text-[12px] font-medium"
                        style={{
                          background: item.type === "gongfa" ? HABIT_GREEN_LIGHT : "#FEF3C7",
                          color: item.type === "gongfa" ? HABIT_GREEN : "#D97706",
                        }}
                      >
                        {TYPE_LABEL[item.type]}
                      </span>
                      <span className="truncate text-[15px] font-medium" style={{ color: "var(--color-text-primary)" }}>
                        {item.name}
                      </span>
                      {item.duration !== undefined && (
                        <span className="shrink-0 font-mono tabular-nums text-[13px]" style={{ color: "var(--color-text-secondary)" }}>
                          {item.duration}分钟
                        </span>
                      )}
                    </div>
                    <button
                      type="button"
                      onClick={() => setDeleteTarget(item.id ?? null)}
                      className="ml-3 shrink-0"
                      aria-label="删除"
                    >
                      <X className="h-4 w-4" style={{ color: "var(--color-text-disabled)" }} />
                    </button>
                  </div>
                ))}
              </div>
            ))
          )}
        </div>
      </motion.div>

      {/* ─── Delete Confirm Modal（线上逻辑保留） ─── */}
      <AnimatePresence>
        {deleteTarget !== null && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/30"
            onClick={() => setDeleteTarget(null)}
          >
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="mx-8 w-full max-w-[280px] p-5"
              style={{ background: "var(--color-surface-card)", borderRadius: 20, boxShadow: "var(--shadow-card-elevated)" }}
              onClick={(e) => e.stopPropagation()}
            >
              <p className="text-center text-[15px] font-semibold" style={{ color: "var(--color-text-primary)" }}>
                确定删除这条养生记录？
              </p>
              <div className="mt-4 flex gap-3">
                <motion.button
                  type="button"
                  whileTap={{ scale: 0.95 }}
                  onClick={() => setDeleteTarget(null)}
                  className="h-10 flex-1 rounded-full text-[15px] font-medium"
                  style={{ background: "var(--lifeflow-muted)", color: "var(--color-text-primary)" }}
                >
                  取消
                </motion.button>
                <motion.button
                  type="button"
                  whileTap={{ scale: 0.95 }}
                  onClick={handleDelete}
                  className="h-10 flex-1 rounded-full text-[15px] font-medium text-white"
                  style={{ background: "#FF3B30" }}
                >
                  删除
                </motion.button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
