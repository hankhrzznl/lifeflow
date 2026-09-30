"use client";

import { useMemo, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import { Plus, Target, Copy, Download, Trash2, Check, Sparkles, Sun, Timer } from "lucide-react";
import { useLiveQuery } from "dexie-react-hooks";
import {
  type GoalV2,
  getAllGoalsV2,
  goalV2DB,
  deleteGoalV2,
} from "@/lib/db/goal-v2.db";
import { GOAL_V2_AI_PROMPT_V2, parseImportedGoalV2, validateImportedGoalV2 } from "@/lib/goal-v2-import-parser";
import { showToast } from "@/components/ui/Toast";
import { useTodayExecution } from "@/lib/today-execution";

// ─── 画布对齐：模块语义色（与 lifeflow-home-redesign-v2 / goals-quick-create 一致，组件局部常量） ──
const MODULE = {
  ideal: "#8B5CF6",
  idealLight: "rgba(139,92,246,0.14)",
  study: "#3B82F6",
  studyLight: "rgba(59,130,246,0.14)",
  focus: "#8B5CF6",
  focusLight: "rgba(139,92,246,0.14)",
} as const;

// ─── 画布对齐：卡片圆角（rounded-xl） ──
const RADIUS_CARD = 16;

// ─── 判断 6 位 hex（目标色），用于生成 12% 透明度底 ═════════
const isHexColor = (v: string) => /^#[0-9a-fA-F]{6}$/.test(v);

// ─── 状态徽章 ──────────────────────────────────────────────
function StatusBadge({ status }: { status: GoalV2["status"] }) {
  const label: Record<GoalV2["status"], string> = {
    active: "进行中",
    completed: "已完成",
    paused: "已暂停",
  };
  const colors: Record<GoalV2["status"], { bg: string; fg: string }> = {
    active: { bg: "rgba(52, 199, 89, 0.12)", fg: "#34C759" },
    completed: { bg: "rgba(142, 142, 147, 0.15)", fg: "#8E8E93" },
    paused: { bg: "rgba(255, 149, 0, 0.12)", fg: "#FF9500" },
  };
  const c = colors[status];

  return (
    <span
      className="inline-flex items-center rounded-full px-2 h-6 text-[10.5px] font-medium leading-none"
      style={{ backgroundColor: c.bg, color: c.fg }}
    >
      {label[status]}
    </span>
  );
}

// ─── 进度环（画布 52px SVG 圆环） ─────────────────────────
function ProgressRing({ value, color }: { value: number; color: string }) {
  const clamped = Math.min(100, Math.max(0, value));
  const C = 2 * Math.PI * 24; // r=24 周长 ≈ 150.8
  const offset = C * (1 - clamped / 100);

  return (
    <span className="relative block w-[52px] h-[52px] flex-none">
      <svg viewBox="0 0 56 56" className="block w-full h-full -rotate-90" aria-hidden="true">
        <circle cx="28" cy="28" r="24" fill="none" stroke="var(--lifeflow-knit-bg)" strokeWidth={5} />
        <circle
          cx="28"
          cy="28"
          r="24"
          fill="none"
          stroke={color}
          strokeWidth={5}
          strokeLinecap="round"
          strokeDasharray={C}
          strokeDashoffset={offset}
        />
      </svg>
      <span className="absolute inset-0 flex items-center justify-center">
        <span className="font-mono text-[12px] font-bold leading-none" style={{ color: "var(--color-text-primary)" }}>
          {clamped}%
        </span>
      </span>
    </span>
  );
}

// ─── 主组件 ──────────────────────────────────────────────
export default function EfficiencyV2Page() {
  const router = useRouter();

  const goals = useLiveQuery(() => getAllGoalsV2(), [], [] as GoalV2[]);
  const allKeyResults = useLiveQuery(
    () => goalV2DB.goalV2KeyResults.toArray(),
    [],
    [],
  );

  // 导入对话框状态
  const [showImportDialog, setShowImportDialog] = useState(false);
  const [importText, setImportText] = useState("");
  const [importing, setImporting] = useState(false);
  const [importError, setImportError] = useState("");

  // ── ISO 周标题 + 日期（对齐画布 header） ──
  const now = new Date();
  // ISO 周数（周四归属周，与 T22.6 原算法一致）
  const thursday = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 3 - ((now.getDay() + 6) % 7));
  const jan1 = new Date(thursday.getFullYear(), 0, 1);
  const isoWeek = Math.ceil(((thursday.getTime() - jan1.getTime()) / 86400000 + 1) / 7);
  const isoYear = thursday.getFullYear();
  const weekLabel = `${isoYear}-W${String(isoWeek).padStart(2, "0")}`;
  const dateLabel = `${now.getMonth() + 1}/${now.getDate()}`;
  const weekdayLabel = ["周日", "周一", "周二", "周三", "周四", "周五", "周六"][now.getDay()];

  // 按 goalId 统计关键结果数量
  const krCountMap = useMemo(() => {
    const map = new Map<string, number>();
    for (const kr of allKeyResults ?? []) {
      map.set(kr.goalId, (map.get(kr.goalId) ?? 0) + 1);
    }
    return map;
  }, [allKeyResults]);

  // T22.4：今日理想日学习推进（效率页 ← 理想日联动）
  const idealTodayPlans = useLiveQuery(
    async () => {
      try {
        const { getIdealDayPlans } = await import("@/lib/ideal-day-templates");
        const d = new Date();
        const todayKey = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
        return await getIdealDayPlans(todayKey);
      } catch { return []; }
    },
    [],
    [],
  );
  const idealTodayMap = useMemo(() => {
    const map = new Map<string, { total: number; done: number }>();
    for (const p of idealTodayPlans ?? []) {
      if (p.feature !== 'study' || !p.goalId) continue;
      const st = map.get(p.goalId) ?? { total: 0, done: 0 };
      st.total += 1;
      if (p.isCompleted) st.done += 1;
      map.set(p.goalId, st);
    }
    return map;
  }, [idealTodayPlans]);

  const goalList = goals ?? [];

  // T22.6：目标状态过滤（全部 / 进行中 / 已暂停 / 已完成）
  const [goalFilter, setGoalFilter] = useState<'all' | GoalV2["status"]>('all');
  const filteredGoalList = useMemo(
    () => (goalFilter === 'all' ? goalList : goalList.filter((g) => g.status === goalFilter)),
    [goalList, goalFilter],
  );

  // 各状态计数（纯展示派生，供过滤 tabs 计数徽标使用）
  const countByStatus = useMemo(() => {
    const c: Record<GoalV2["status"], number> = { active: 0, paused: 0, completed: 0 };
    for (const g of goalList) c[g.status] += 1;
    return c;
  }, [goalList]);

  // ── 今日焦点（T18-5：与首页「今日待办」共用同一数据源） ──
  const { mergedActions, total: focusTotal, done: focusDone, toggle: toggleFocus, isDone: isFocusDone } = useTodayExecution();
  const focusActions = mergedActions.slice(0, 8);
  const focusPercent = focusTotal > 0 ? Math.round((focusDone / focusTotal) * 100) : 0;

  // ── KR 进度统计（每个目标的 KR 完成数与平均进度） ──
  const krStatsMap = useMemo(() => {
    const map = new Map<string, { done: number; total: number; sum: number }>();
    for (const kr of allKeyResults ?? []) {
      const st = map.get(kr.goalId) ?? { done: 0, total: 0, sum: 0 };
      st.total += 1;
      st.sum += kr.targetValue > 0 ? Math.min(100, (kr.currentValue / kr.targetValue) * 100) : 0;
      if (kr.targetValue > 0 && kr.currentValue >= kr.targetValue) st.done += 1;
      map.set(kr.goalId, st);
    }
    const out = new Map<string, { done: number; total: number; avg: number }>();
    for (const [gid, st] of map) {
      out.set(gid, { done: st.done, total: st.total, avg: st.total > 0 ? Math.round(st.sum / st.total) : 0 });
    }
    return out;
  }, [allKeyResults]);

  // ── 复制提示词（T25：V2 含理想日模板契约） ──
  const handleCopyPrompt = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(GOAL_V2_AI_PROMPT_V2);
      showToast({ type: "success", message: "提示词已复制，发送给 AI 获取「目标 + 理想日模板」导入包" });
    } catch {
      showToast({ type: "error", message: "复制失败，请手动复制" });
    }
  }, []);

  // ── 导入解析（T25：双结构兼容 — 目标 + 理想日模板） ──
  const handleImport = useCallback(async () => {
    setImportError("");
    setImporting(true);
    try {
      const bundle = parseImportedGoalV2(importText);
      const validation = validateImportedGoalV2(bundle);
      const errs: string[] = [];
      if (!validation.goalValid) errs.push(...validation.goalErrors);
      if (bundle.idealDayTemplate && !validation.templateValid) errs.push(...validation.templateErrors);
      if (errs.length > 0) {
        setImportError(errs.join("\n"));
        setImporting(false);
        return;
      }
      // 跳转到创建页面，通过 sessionStorage 传递数据（避免 URL 长度限制截断）
      sessionStorage.setItem('import_goal', JSON.stringify(bundle.goal));
      if (bundle.idealDayTemplate) {
        sessionStorage.setItem('import_ideal_template', JSON.stringify(bundle.idealDayTemplate));
      }
      window.location.href = '/efficiency-v2/new';
    } catch (e: any) {
      setImportError(`解析失败：${e.message || '格式错误，请检查 AI 返回的 JSON'}`);
      setImporting(false);
    }
  }, [importText, router]);

  // ── 删除目标 ──
  const handleDeleteGoal = useCallback(async (goalId: string, title: string) => {
    if (!window.confirm(`确定删除目标「${title}」？所有相关数据将被永久删除。`)) return;
    await deleteGoalV2(goalId);
    showToast({ type: "success", message: `已删除「${title}」` });
  }, []);

  // ─── 空状态 ──────────────────────────────────────────
  if (goalList.length === 0) {
    return (
      <div
        className="mx-auto relative flex flex-col items-center justify-center min-h-screen"
        style={{ maxWidth: 430, padding: "0 24px" }}
      >
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, ease: "easeOut" }}
          className="flex flex-col items-center text-center gap-6 w-full"
          style={{
            backgroundColor: "var(--color-surface-card)",
            borderRadius: RADIUS_CARD,
            boxShadow: "var(--shadow-card)",
            padding: "48px 24px",
          }}
        >
          <div
            className="w-20 h-20 rounded-full flex items-center justify-center"
            style={{ backgroundColor: "var(--color-surface-secondary)" }}
          >
            <Target
              className="w-10 h-10"
              style={{ color: "var(--color-text-disabled)" }}
              strokeWidth={2}
            />
          </div>
          <p
            className="text-[17px] font-medium"
            style={{
              color: "var(--color-text-secondary)",
              letterSpacing: "-0.022em",
            }}
          >
            还没有目标，开始创建你的第一个目标吧
          </p>
          <div className="flex flex-col gap-2.5 w-full">
            <button
              type="button"
              onClick={() => router.push("/efficiency-v2/new")}
              className="inline-flex items-center justify-center h-11 px-7 rounded-full text-[16px] font-semibold"
              style={{
                backgroundColor: "var(--lifeflow-primary)",
                color: "var(--color-text-inverse)",
                boxShadow: "var(--shadow-tab-center)",
              }}
            >
              新建目标
            </button>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={handleCopyPrompt}
                className="flex-1 h-10 rounded-lg text-[13px] font-medium"
                style={{ background: "var(--lifeflow-brand-50)", color: "var(--lifeflow-primary)" }}
              >
                复制提示词
              </button>
              <button
                type="button"
                onClick={() => setShowImportDialog(true)}
                className="flex-1 h-10 rounded-lg text-[13px] font-semibold text-white"
                style={{ background: "var(--lifeflow-primary)" }}
              >
                导入计划
              </button>
            </div>
          </div>
        </motion.div>

        {/* 空状态也需要导入对话框 */}
        <ImportDialog
          open={showImportDialog}
          importText={importText}
          setImportText={setImportText}
          importError={importError}
          setImportError={setImportError}
          importing={importing}
          onClose={() => setShowImportDialog(false)}
          onImport={handleImport}
        />
      </div>
    );
  }

  return (
    <div
      className="mx-auto relative"
      style={{ maxWidth: 430, minHeight: "100vh", paddingBottom: 100 }}
    >
      {/* ===== Header（对齐画布：ISO 周标题 + 日期） ===== */}
      <div
        className="px-5 pt-[var(--safe-area-top)] pb-4 flex items-end justify-between gap-3"
        style={{ paddingTop: "max(var(--safe-area-top), 16px)" }}
      >
        <div className="min-w-0 flex-1">
          <h1
            className="flex flex-wrap items-baseline gap-x-2 leading-tight"
            style={{ color: "var(--color-text-primary)", letterSpacing: "-0.02em" }}
          >
            <span className="font-mono text-[24px] font-bold tracking-tight">{weekLabel}</span>
            <span style={{ color: MODULE.ideal }}>·</span>
            <span className="text-[28px] font-bold">第 {isoWeek} 周</span>
          </h1>
          <p className="text-[13px] mt-1" style={{ color: "var(--color-text-secondary)" }}>
            <span className="font-mono text-[12.5px]">{dateLabel}</span> {weekdayLabel} · 稳步推进中
          </p>
        </div>
        <div className="flex items-center gap-2 shrink-0 mt-0.5">
          <button
            type="button"
            onClick={handleCopyPrompt}
            className="flex items-center gap-1 px-3 h-8 rounded-lg text-[12px] font-medium"
            style={{ background: "var(--lifeflow-brand-50)", color: "var(--lifeflow-primary)" }}
          >
            <Copy className="w-3.5 h-3.5" />
            复制提示词
          </button>
          <button
            type="button"
            onClick={() => setShowImportDialog(true)}
            className="flex items-center gap-1 px-3 h-8 rounded-lg text-[12px] font-medium"
            style={{ background: "var(--lifeflow-primary)", color: "#fff" }}
          >
            <Download className="w-3.5 h-3.5" />
            导入
          </button>
        </div>
      </div>

      {/* ===== 今日焦点（对齐画布：焦点卡 + 专注入口，保留线上 focus 逻辑） ===== */}
      <div className="px-4 mb-4">
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          className="px-4 pt-4 pb-3"
          style={{ borderRadius: RADIUS_CARD, background: "var(--color-surface-card)", boxShadow: "var(--shadow-card)" }}
        >
          <div className="flex items-center justify-between gap-3">
            <h2
              className="text-[20px] font-semibold leading-tight"
              style={{ color: "var(--color-text-primary)", letterSpacing: "-0.01em" }}
            >
              今日焦点
            </h2>
            <span
              className="shrink-0 rounded-md px-2.5 py-1 text-[12px] font-semibold leading-none tabular-nums"
              style={{ background: MODULE.focusLight, color: MODULE.focus }}
            >
              {focusDone}/{focusTotal} 完成
            </span>
          </div>

          {/* 今日日行动（可勾选，与首页联动） */}
          {focusActions.length > 0 ? (
            <div className="mt-3 flex flex-col rounded-lg px-3 py-1" style={{ background: "var(--lifeflow-muted)" }}>
              {focusActions.map((a, i) => {
                const done = isFocusDone(a);
                return (
                  <button
                    key={a.key}
                    type="button"
                    onClick={() => toggleFocus(a)}
                    className="flex items-center gap-3 py-2.5 text-left active:opacity-70"
                    style={{ borderTop: i > 0 ? "1px solid var(--lifeflow-border)" : "none" }}
                  >
                    <span
                      className="w-[22px] h-[22px] rounded-full flex items-center justify-center shrink-0 transition-transform active:scale-90"
                      style={{
                        background: done ? a.color : "transparent",
                        border: done ? "none" : `2px solid ${a.color}55`,
                      }}
                    >
                      {done && <Check className="w-[13px] h-[13px] text-white" strokeWidth={3} />}
                    </span>
                    <span className="flex-1 min-w-0">
                      <span
                        className="block text-[14.5px] font-semibold leading-snug truncate"
                        style={{
                          color: done ? "var(--color-text-secondary)" : "var(--color-text-primary)",
                          textDecoration: done ? "line-through" : "none",
                        }}
                      >
                        {a.title}
                      </span>
                      <span className="block text-[12px] mt-0.5" style={{ color: "var(--color-text-secondary)" }}>
                        <span className="font-mono text-[11.5px]">{a.time || "--"}</span>
                        {a.sourceType === "ideal" && (
                          <span className="ml-1.5 rounded-[6px] px-1.5 py-0.5 text-[11px] font-medium leading-none" style={{ background: MODULE.idealLight, color: MODULE.ideal }}>
                            理想日
                          </span>
                        )}
                        {a.tag && a.sourceType !== "ideal" && (
                          <span className="ml-1.5 rounded-[6px] px-1.5 py-0.5 text-[11px] font-medium leading-none" style={{ background: "var(--lifeflow-brand-50)", color: "var(--lifeflow-primary)" }}>
                            {a.tag}
                          </span>
                        )}
                      </span>
                    </span>
                    {/* T22.6：理想日规划项定位按钮 */}
                    {a.sourceType === "ideal" && a.blockId && (
                      <button
                        type="button"
                        aria-label={`理想日：${a.title}`}
                        onClick={(e) => { e.stopPropagation(); router.push(`/ideal-day?block=${a.blockId}`); }}
                        className="w-7 h-7 shrink-0 rounded-full flex items-center justify-center active:scale-90 transition-transform"
                        style={{ background: MODULE.idealLight, color: MODULE.ideal }}
                      >
                        <Sun className="w-3.5 h-3.5" />
                      </button>
                    )}
                    {/* T22.6：专注按钮（与首页待办一致） */}
                    <button
                      type="button"
                      aria-label={`专注：${a.title}`}
                      onClick={(e) => { e.stopPropagation(); router.push("/more/focus"); }}
                      className="w-7 h-7 shrink-0 rounded-full flex items-center justify-center active:scale-90 transition-transform"
                      style={{ background: MODULE.focusLight, color: MODULE.focus }}
                    >
                      <Timer className="w-3.5 h-3.5" />
                    </button>
                  </button>
                );
              })}
            </div>
          ) : (
            <div className="mt-3 rounded-lg py-5 text-center" style={{ background: "var(--lifeflow-muted)" }}>
              <p className="text-[13px]" style={{ color: "var(--color-text-secondary)" }}>
                今天还没有安排，去「目标」拆解或「日程」新建事项
              </p>
            </div>
          )}

          {/* 焦点进度（knit-track + mono 数字） */}
          <div className="mt-3 flex items-center gap-3">
            <div className="w-full h-[6px] rounded-full overflow-hidden" style={{ background: "var(--lifeflow-knit-bg)" }}>
              <motion.div
                className="h-full rounded-full"
                initial={{ width: 0 }}
                animate={{ width: `${focusPercent}%` }}
                transition={{ duration: 0.6, ease: "easeOut" }}
                style={{ backgroundColor: MODULE.focus }}
              />
            </div>
            <span className="shrink-0 font-mono text-[12px] font-semibold leading-none tabular-nums" style={{ color: "var(--color-text-primary)" }}>
              {focusDone}/{focusTotal}
            </span>
          </div>

          <p
            className="mt-2.5 border-t pt-2 text-[12px]"
            style={{ borderColor: "var(--lifeflow-border)", color: "var(--color-text-secondary)" }}
          >
            今日焦点来自目标日行动 · 与首页待办同步勾选
          </p>
        </motion.div>
      </div>

      {/* ===== 目标网格（对齐画布：标题行 + 状态过滤 tabs + 进度环卡） ===== */}
      <div className="px-4">
        {/* 标题行 */}
        <div className="flex items-center justify-between gap-3 px-1">
          <h2
            className="text-[20px] font-semibold leading-tight"
            style={{ color: "var(--color-text-primary)", letterSpacing: "-0.01em" }}
          >
            目标
          </h2>
          <span className="shrink-0 text-[13px]" style={{ color: "var(--color-text-secondary)" }}>
            共 <span className="font-mono">{goalList.length}</span> 个
          </span>
        </div>

        {/* T22.6：状态过滤 tabs（对齐画布：全部 / 进行中 / 已暂停 / 已完成 + 计数） */}
        <div className="flex items-center gap-1.5 mt-2.5 mb-3 overflow-x-auto no-scrollbar">
          {([
            { key: 'all', label: '全部', count: goalList.length },
            { key: 'active', label: '进行中', count: countByStatus.active },
            { key: 'paused', label: '已暂停', count: countByStatus.paused },
            { key: 'completed', label: '已完成', count: countByStatus.completed },
          ] as { key: 'all' | GoalV2["status"]; label: string; count: number }[]).map((t) => {
            const active = goalFilter === t.key;
            return (
              <button
                key={t.key}
                type="button"
                onClick={() => setGoalFilter(t.key)}
                className="shrink-0 flex items-center gap-1 px-3.5 h-8 rounded-full text-[12.5px] leading-none transition-all active:opacity-80"
                style={{
                  background: active ? "var(--lifeflow-brand-50)" : "var(--color-surface-card)",
                  color: active ? "var(--lifeflow-primary)" : "var(--color-text-secondary)",
                  fontWeight: active ? 600 : 500,
                  boxShadow: "var(--shadow-card)",
                }}
              >
                {t.label}
                <span className="font-mono tabular-nums">{t.count}</span>
              </button>
            );
          })}
        </div>

        <div className="grid grid-cols-2 gap-3">
        {[...filteredGoalList]
          .sort((a, b) => {
            const rank: Record<string, number> = { active: 0, paused: 1, completed: 2 };
            return (rank[a.status] ?? 3) - (rank[b.status] ?? 3);
          })
          .map((goal, i) => {
          const krCount = krCountMap.get(goal.id) ?? 0;
          const krStats = krStatsMap.get(goal.id);
          const krSummary = krStats && krStats.total > 0
            ? `KR ${krStats.done}/${krStats.total} · ${krStats.avg}%`
            : `${krCount} 个关键结果`;
          const hasHexColor = goal.color && isHexColor(goal.color);
          const accent = hasHexColor ? goal.color : MODULE.study;
          const accentLight = hasHexColor ? `${goal.color}1F` : MODULE.studyLight;

          return (
            <motion.div
              key={goal.id}
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{
                delay: i * 0.06,
                duration: 0.35,
                ease: "easeOut",
              }}
              className="relative flex flex-col p-3.5 pb-3 cursor-pointer active:scale-[0.97] transition-transform"
              style={{
                borderRadius: RADIUS_CARD,
                backgroundColor: "var(--color-surface-card)",
                boxShadow: "var(--shadow-card)",
              }}
              onClick={() => router.push(`/efficiency-v2/goals/${goal.id}`)}
            >
              {/* 删除按钮 — 始终可见（线上功能保留） */}
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  handleDeleteGoal(goal.id, goal.title);
                }}
                className="absolute top-2 right-2 w-7 h-7 rounded-full flex items-center justify-center z-10 active:scale-90 transition-transform"
                style={{ background: "rgba(0,0,0,0.28)" }}
                aria-label="删除目标"
              >
                <Trash2 className="w-3.5 h-3.5 text-white" />
              </button>

              {/* 进度环（画布 52px 圆环，环色 = 目标色） */}
              <div className="mt-1 flex-none">
                <ProgressRing value={goal.progress} color={accent} />
              </div>

              {/* 标题 */}
              <h3
                className="mt-3 truncate text-[15px] font-bold leading-snug"
                style={{ color: "var(--color-text-primary)" }}
              >
                {goal.title}
              </h3>

              {/* 描述行（对齐画布：两行摘要） */}
              <p
                className="mt-1 text-[12px] leading-snug line-clamp-2"
                style={{ color: "var(--color-text-secondary)", minHeight: 34 }}
              >
                {goal.vision || krSummary}
              </p>

              {/* 底部 chips：状态徽章 + KR 摘要 + 今日学习入口 */}
              <div className="mt-2.5 flex flex-wrap items-center gap-1.5">
                <StatusBadge status={goal.status} />
                {goal.vision && krStats && krStats.total > 0 && (
                  <span
                    className="inline-flex items-center rounded-full px-2 h-6 text-[10.5px] font-medium leading-none"
                    style={{ background: "var(--lifeflow-muted)", color: "var(--color-text-secondary)" }}
                  >
                    KR {krStats.done}/{krStats.total} · {krStats.avg}%
                  </span>
                )}
                {/* T22.4：今日理想日学习推进（点击跳理想日定位该目标） */}
                {idealTodayMap.get(goal.id) && (
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      router.push(`/ideal-day?goal=${goal.id}`);
                    }}
                    className="inline-flex items-center gap-1 rounded-full px-2 h-6 text-[10.5px] font-medium leading-none active:opacity-70"
                    style={{ background: accentLight, color: accent }}
                  >
                    <Sparkles className="w-3 h-3 shrink-0" />
                    今日学习 <span className="font-mono font-semibold">{idealTodayMap.get(goal.id)!.done}/{idealTodayMap.get(goal.id)!.total}</span>
                  </button>
                )}
              </div>
            </motion.div>
          );
        })}
        </div>
      </div>

      {/* ===== FAB 新建目标（对齐画布：56px 圆钮 + shadow-modal） ===== */}
      <button
        type="button"
        onClick={() => router.push("/efficiency-v2/new")}
        className="fixed right-4 bottom-[180px] z-40 flex items-center justify-center"
        style={{
          width: 56,
          height: 56,
          borderRadius: "50%",
          backgroundColor: "var(--lifeflow-primary)",
          boxShadow: "var(--shadow-modal)",
        }}
      >
        <Plus className="w-6 h-6 text-white" strokeWidth={2} />
      </button>

      {/* ===== 导入对话框 ===== */}
      <ImportDialog
        open={showImportDialog}
        importText={importText}
        setImportText={setImportText}
        importError={importError}
        setImportError={setImportError}
        importing={importing}
        onClose={() => setShowImportDialog(false)}
        onImport={handleImport}
      />
    </div>
  );
}

// ─── 导入对话框组件（token 对齐画布） ─────────────────────
function ImportDialog({
  open, importText, setImportText, importError, setImportError, importing, onClose, onImport,
}: {
  open: boolean;
  importText: string;
  setImportText: (v: string) => void;
  importError: string;
  setImportError: (v: string) => void;
  importing: boolean;
  onClose: () => void;
  onImport: () => void;
}) {
  if (!open) return null;
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-6"
      style={{ background: "rgba(0,0,0,0.5)" }}
      onClick={onClose}
    >
      <div
        className="w-full rounded-[20px] p-5 flex flex-col"
        style={{ maxWidth: 400, background: "var(--color-surface-card)", maxHeight: "80vh" }}
        onClick={(e) => e.stopPropagation()}
      >
        <h3 className="text-[17px] font-semibold mb-1" style={{ color: "var(--color-text-primary)" }}>
          导入 AI 计划
        </h3>
        <p className="text-[12px] mb-3" style={{ color: "var(--color-text-secondary)" }}>
          粘贴 AI 返回的 JSON 内容，一键创建目标
        </p>
        <textarea
          value={importText}
          onChange={(e) => { setImportText(e.target.value); setImportError(""); }}
          placeholder="请粘贴 AI 返回的 JSON 内容..."
          className="w-full rounded-[8px] p-3 text-[13px] outline-none resize-none"
          style={{
            color: "var(--color-text-primary)",
            background: "var(--lifeflow-muted)",
            border: importError ? "1px solid #FF3B30" : "1px solid var(--lifeflow-border)",
            minHeight: 200,
            fontFamily: "ui-monospace, SFMono-Regular, Menlo, Consolas, monospace",
          }}
        />
        {importError && (
          <p className="text-[12px] mt-1.5" style={{ color: "#FF3B30" }}>{importError}</p>
        )}
        <div className="flex gap-2 mt-3">
          <button
            type="button"
            onClick={onClose}
            className="flex-1 h-10 rounded-[8px] text-[14px] font-medium"
            style={{ background: "var(--lifeflow-muted)", color: "var(--color-text-secondary)" }}
          >
            取消
          </button>
          <button
            type="button"
            onClick={onImport}
            disabled={!importText.trim() || importing}
            className="flex-1 h-10 rounded-[8px] text-[14px] font-semibold text-white disabled:opacity-40"
            style={{ background: "var(--lifeflow-primary)" }}
          >
            {importing ? "解析中..." : "导入并创建"}
          </button>
        </div>
      </div>
    </div>
  );
}
