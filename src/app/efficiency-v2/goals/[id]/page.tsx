"use client";

import { useEffect, useState, useMemo, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import { useLiveQuery } from "dexie-react-hooks";
import { motion, AnimatePresence } from "framer-motion";
import { ArrowLeft, Plus, Minus, X, Check, ChevronDown, ChevronRight, Settings, Trash2 } from "lucide-react";
import type { GoalV2, KeyResultV2, StrategyV2, WeeklyTaskV2, DailyActionV2 } from "@/lib/db/goal-v2.db";
import {
  getGoalV2, updateGoalV2, deleteGoalV2,
  getKeyResultsV2, updateKeyResultV2, addKeyResultV2, deleteKeyResultV2,
  getStrategiesV2, updateStrategyV2, addStrategyV2, deleteStrategyV2,
  getWeeklyTasksV2, addWeeklyTaskV2, updateWeeklyTaskV2, deleteWeeklyTaskV2,
  addDailyActionV2, updateDailyActionV2, deleteDailyActionV2,
  getDailyActionsV2, getDailyActionsByDateV2, getWeeklyTasksByGoalV2,
  goalV2DB,
} from "@/lib/db/goal-v2.db";
import { recalculateGoalProgress, syncDailyActionToItem, syncAllDailyActionsForGoal, todayStr, getWeekStart } from "@/lib/goal-v2-engine";
import { showToast } from "@/components/ui/Toast";

// ─── 主题色 ─────────────────────────────────────────────────
const ACCENT = "#6366F1";
const DANGER = "#FF3B30";
const GREEN = "#34C759";

// ─── 工具函数 ────────────────────────────────────────────────
const today = todayStr();
const currentWeekStart = getWeekStart();

function fmtDate(ds: string): string {
  if (!ds) return "";
  const [, m, d] = ds.split("-");
  return `${parseInt(m)}/${parseInt(d)}`;
}

function formatWeekRange(weekStart: string): string {
  const d = new Date(weekStart + "T00:00:00");
  const end = new Date(d);
  end.setDate(end.getDate() + 6);
  return `${fmtDate(weekStart)}-${fmtDate(end.toISOString().slice(0, 10))}`;
}

// ============================================================
// 主页面组件
// ============================================================
export default function GoalDetailV2Page() {
  const router = useRouter();
  const params = useParams();
  const id = params.id as string;

  // ─── 数据查询（并行） ─────────────────────────────────────
  const goal = useLiveQuery(() => getGoalV2(id), [id]);
  const keyResults = useLiveQuery(() => getKeyResultsV2(id), [id], [] as KeyResultV2[]);
  const strategies = useLiveQuery(() => getStrategiesV2(id), [id], [] as StrategyV2[]);
  const weeklyTasks = useLiveQuery(() => getWeeklyTasksByGoalV2(id), [id], [] as WeeklyTaskV2[]);
  const dailyActions = useLiveQuery(() => goalV2DB.goalV2DailyActions.where("goalId").equals(id).toArray(), [id], [] as DailyActionV2[]);

  // ─── 状态 ─────────────────────────────────────────────────
  const [visionEditing, setVisionEditing] = useState(false);
  const [visionDraft, setVisionDraft] = useState("");
  const [expandedStrategies, setExpandedStrategies] = useState<Set<string>>(new Set(strategies.map((s) => s.id)));
  const [showAddKR, setShowAddKR] = useState(false);
  const [newKRDesc, setNewKRDesc] = useState("");
  const [newKRTarget, setNewKRTarget] = useState("");
  const [newKRUnit, setNewKRUnit] = useState("");
  const [newWeeklyTaskTitle, setNewWeeklyTaskTitle] = useState<Map<string, string>>(new Map());
  const [newDailyAction, setNewDailyAction] = useState<Map<string, { title: string; time: string }>>(new Map());
  const [editingKR, setEditingKR] = useState<string | null>(null);
  const [editingKRValue, setEditingKRValue] = useState("");

  // 同步 expandedStrategies 当 strategies 加载时
  useEffect(() => {
    setExpandedStrategies((prev) => {
      const next = new Set(prev);
      for (const s of strategies) {
        if (!next.has(s.id)) next.add(s.id);
      }
      return next;
    });
  }, [strategies]);

  // 历史数据补同步：将该目标所有 DA 同步为日程 Item（幂等，T9 迁移的历史 DA 一并补齐）
  useEffect(() => {
    if (!id) return;
    syncAllDailyActionsForGoal(id).catch(() => {});
  }, [id]);

  // T22.3：今日理想日推进（目标页 ← 理想日反向联动）
  const [idealTodayPlans, setIdealTodayPlans] = useState<{ blockId: string; content: string; start: string; end: string; isCompleted: boolean }[]>([]);
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const { getIdealDayPlans } = await import("@/lib/ideal-day-templates");
        const plans = await getIdealDayPlans(today);
        if (!cancelled) {
          setIdealTodayPlans(
            plans
              .filter((p) => p.goalId === id && p.feature === 'study')
              .map((p) => ({ blockId: p.blockId, content: p.content, start: p.start, end: p.end, isCompleted: p.isCompleted })),
          );
        }
      } catch { if (!cancelled) setIdealTodayPlans([]); }
    })();
    return () => { cancelled = true; };
  }, [id]);

  // ─── 衍生数据 ─────────────────────────────────────────────
  const weeklyTasksByStrategy = useMemo(() => {
    const map = new Map<string, WeeklyTaskV2[]>();
    for (const wt of weeklyTasks) {
      const list = map.get(wt.strategyId) ?? [];
      list.push(wt);
      map.set(wt.strategyId, list);
    }
    return map;
  }, [weeklyTasks]);

  const dailyActionsByStrategy = useMemo(() => {
    const map = new Map<string, DailyActionV2[]>();
    for (const da of dailyActions) {
      const list = map.get(da.strategyId) ?? [];
      list.push(da);
      map.set(da.strategyId, list);
    }
    return map;
  }, [dailyActions]);

  // ─── 样式常量 ─────────────────────────────────────────────
  const goalColor = goal?.color || ACCENT;
  const btnBase = { border: "1px solid var(--lifeflow-border)", color: "var(--color-text-secondary)", background: "var(--color-surface-card)" };
  const cs = { background: "var(--lifeflow-background)", border: "1px solid var(--lifeflow-border)", color: "var(--color-text-primary)" };

  // ─── 操作回调 ─────────────────────────────────────────────

  const handleSaveVision = useCallback(async () => {
    if (!visionDraft.trim()) return;
    await updateGoalV2(id, { vision: visionDraft.trim() });
    await recalculateGoalProgress(id);
    setVisionEditing(false);
    showToast({ type: "success", message: "愿景已更新" });
  }, [id, visionDraft]);

  const handleStartVisionEdit = useCallback(() => {
    setVisionDraft(goal?.vision || "");
    setVisionEditing(true);
  }, [goal?.vision]);

  const handleToggleKR = useCallback((kr: KeyResultV2) => {
    setEditingKR(kr.id);
    setEditingKRValue(String(kr.currentValue));
  }, []);

  const handleSaveKRValue = useCallback(async (krId: string, presetVal?: number) => {
    const val = presetVal ?? parseFloat(editingKRValue);
    if (isNaN(val) || val < 0) {
      showToast({ type: "warning", message: "请输入有效数值" });
      return;
    }
    await updateKeyResultV2(krId, { currentValue: val });
    await recalculateGoalProgress(id);
    setEditingKR(null);
    showToast({ type: "success", message: "已更新" });
  }, [id, editingKRValue]);

  const handleAddKR = useCallback(async () => {
    if (!newKRDesc.trim() || !newKRTarget.trim()) {
      showToast({ type: "warning", message: "请填写描述和目标值" });
      return;
    }
    const target = parseFloat(newKRTarget);
    if (isNaN(target) || target <= 0) {
      showToast({ type: "warning", message: "目标值必须为正数" });
      return;
    }
    const krId = await addKeyResultV2({
      goalId: id,
      description: newKRDesc.trim(),
      targetValue: target,
      currentValue: 0,
      unit: newKRUnit.trim() || "",
      deadline: "",
      sortOrder: keyResults.length,
    });
    if (krId) {
      await recalculateGoalProgress(id);
      setShowAddKR(false);
      setNewKRDesc("");
      setNewKRTarget("");
      setNewKRUnit("");
      showToast({ type: "success", message: "关键结果已添加" });
    }
  }, [id, newKRDesc, newKRTarget, newKRUnit, keyResults.length]);

  const handleDeleteKR = useCallback(async (krId: string) => {
    if (!window.confirm("确定删除这个关键结果？")) return;
    await deleteKeyResultV2(krId);
    await recalculateGoalProgress(id);
    showToast({ type: "success", message: "已删除" });
  }, [id]);

  const toggleStrategy = useCallback((sid: string) => {
    setExpandedStrategies((prev) => {
      const next = new Set(prev);
      if (next.has(sid)) next.delete(sid);
      else next.add(sid);
      return next;
    });
  }, []);

  const handleDeleteStrategy = useCallback(async (sid: string) => {
    if (!window.confirm("确定删除该策略？策略下的所有周任务和日行动也会被删除。")) return;
    await deleteStrategyV2(sid);
    await recalculateGoalProgress(id);
    showToast({ type: "success", message: "策略已删除" });
  }, [id]);

  // T22.7：策略内联添加入口（名称 + 描述 + 周期类型）
  const [showAddStrategy, setShowAddStrategy] = useState(false);
  const [newStrategyName, setNewStrategyName] = useState("");
  const [newStrategyDesc, setNewStrategyDesc] = useState("");
  const [newStrategyCycle, setNewStrategyCycle] = useState<StrategyV2["cycleType"]>("daily");
  const handleAddStrategy = useCallback(async () => {
    if (!newStrategyName.trim()) {
      showToast({ type: "warning", message: "请填写策略名称" });
      return;
    }
    await addStrategyV2({
      goalId: id,
      name: newStrategyName.trim(),
      description: newStrategyDesc.trim(),
      sortOrder: strategies.length,
      cycleType: newStrategyCycle,
    });
    await recalculateGoalProgress(id);
    setShowAddStrategy(false);
    setNewStrategyName("");
    setNewStrategyDesc("");
    showToast({ type: "success", message: "策略已添加" });
  }, [id, newStrategyName, newStrategyDesc, newStrategyCycle, strategies.length]);

  const handleAddWeeklyTask = useCallback(async (strategyId: string) => {
    const title = (newWeeklyTaskTitle.get(strategyId) || "").trim();
    if (!title) {
      showToast({ type: "warning", message: "请填写周任务标题" });
      return;
    }
    const list = weeklyTasksByStrategy.get(strategyId) || [];
    await addWeeklyTaskV2({
      strategyId,
      goalId: id,
      title,
      weekStart: currentWeekStart,
      deliverable: "",
      isCompleted: false,
      sortOrder: list.length,
    });
    setNewWeeklyTaskTitle((prev) => {
      const next = new Map(prev);
      next.set(strategyId, "");
      return next;
    });
    showToast({ type: "success", message: "周任务已添加" });
  }, [id, currentWeekStart, weeklyTasksByStrategy, newWeeklyTaskTitle]);

  const handleToggleWeeklyTask = useCallback(async (wt: WeeklyTaskV2) => {
    await updateWeeklyTaskV2(wt.id, { isCompleted: !wt.isCompleted });
    await recalculateGoalProgress(id);
  }, [id]);

  const handleDeleteWeeklyTask = useCallback(async (wtId: string) => {
    if (!window.confirm("确定删除该周任务？关联的日行动也会被删除。")) return;
    await deleteWeeklyTaskV2(wtId);
    await recalculateGoalProgress(id);
    showToast({ type: "success", message: "周任务已删除" });
  }, [id]);

  const handleAddDailyAction = useCallback(async (strategyId: string) => {
    const entry = newDailyAction.get(strategyId);
    if (!entry || !entry.title.trim()) {
      showToast({ type: "warning", message: "请填写日行动标题" });
      return;
    }
    // 找该策略下的第一个周任务来关联
    const tasks = weeklyTasksByStrategy.get(strategyId) || [];
    const weeklyTaskId = tasks.length > 0 ? tasks[0].id : "";
    if (!weeklyTaskId) {
      showToast({ type: "warning", message: "请先添加周任务" });
      return;
    }
    const strategyActions = dailyActionsByStrategy.get(strategyId) || [];
    const daId = await addDailyActionV2({
      weeklyTaskId,
      strategyId,
      goalId: id,
      date: today,
      title: entry.title.trim(),
      time: entry.time || "08:00",
      duration: 30,
      isCompleted: false,
      sortOrder: strategyActions.length,
    });
    // 计划即入日程：新 DA 立即同步为 Item
    if (daId) {
      const da = await goalV2DB.goalV2DailyActions.get(daId);
      if (da) await syncDailyActionToItem(da);
    }
    setNewDailyAction((prev) => {
      const next = new Map(prev);
      next.set(strategyId, { title: "", time: "08:00" });
      return next;
    });
    await recalculateGoalProgress(id);
    showToast({ type: "success", message: "日行动已添加" });
  }, [id, today, weeklyTasksByStrategy, dailyActionsByStrategy, newDailyAction]);

  const handleToggleDailyAction = useCallback(async (da: DailyActionV2) => {
    const updated = { isCompleted: !da.isCompleted };
    await updateDailyActionV2(da.id, updated);
    await syncDailyActionToItem({ ...da, ...updated });
    await recalculateGoalProgress(id);
  }, [id]);

  const handleDeleteDailyAction = useCallback(async (daId: string) => {
    if (!window.confirm("确定删除该日行动？")) return;
    await deleteDailyActionV2(daId);
    await recalculateGoalProgress(id);
    showToast({ type: "success", message: "日行动已删除" });
  }, [id]);

  // ─── 404 处理（置于所有 hooks 之后，避免 hooks 数量在渲染间变化） ───
  if (!goal) {
    return (
      <div className="min-h-screen" style={{ maxWidth: 430, margin: "0 auto", background: "var(--lifeflow-background)" }}>
        <div className="flex items-center h-14 px-4" style={{ paddingTop: "var(--safe-area-top)" }}>
          <button onClick={() => router.push("/efficiency-v2")} className="w-8 h-8 -ml-1 flex items-center justify-center">
            <ArrowLeft className="w-6 h-6" style={{ color: "var(--color-text-primary)" }} />
          </button>
        </div>
        <div className="flex flex-col items-center pt-20">
          <p className="text-[15px]" style={{ color: "var(--color-text-disabled)" }}>目标不存在</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen pb-[100px]" style={{ maxWidth: 430, margin: "0 auto", background: "var(--lifeflow-background)" }}>
      {/* ─── Header ─────────────────────────────────────────── */}
      <div className="px-5 pt-[var(--safe-area-top)] pb-2 flex items-center justify-between">
        <button onClick={() => router.push("/efficiency-v2")} className="w-8 h-8 -ml-1 flex items-center justify-center">
          <ArrowLeft className="w-6 h-6" style={{ color: "var(--color-text-primary)" }} />
        </button>
        <h1 className="text-[17px] font-semibold truncate mx-2" style={{ color: "var(--color-text-primary)" }}>
          {goal.title}
        </h1>
        <button onClick={async () => {
          if (!window.confirm("确定删除该目标？所有数据将被永久删除。")) return;
          await deleteGoalV2(id);
          showToast({ type: "success", message: "目标已删除" });
          router.push("/efficiency-v2");
        }} className="w-8 h-8 flex items-center justify-center active:opacity-60">
          <Trash2 className="w-4 h-4" style={{ color: DANGER }} />
        </button>
      </div>

      {/* ─── 愿景卡片 ───────────────────────────────────────── */}
      <div className="mx-4 p-4 rounded-[20px]" style={{ background: "var(--color-surface-card)", boxShadow: "var(--shadow-card)" }}>
        <div className="flex items-start justify-between gap-2">
          <div className="flex-1 min-w-0">
            <p className="text-[11px] font-semibold uppercase tracking-[0.08em] mb-1" style={{ color: "var(--color-text-disabled)" }}>
              愿景画面
            </p>
            {visionEditing ? (
              <div className="space-y-2">
                <textarea
                  value={visionDraft}
                  onChange={(e) => setVisionDraft(e.target.value)}
                  className="w-full rounded-xl p-3 text-[15px] outline-none resize-none"
                  style={cs}
                  rows={3}
                  autoFocus
                  placeholder="描述你想要的画面..."
                />
                <div className="flex gap-2">
                  <button
                    onClick={() => setVisionEditing(false)}
                    className="flex-1 h-9 rounded-xl text-[13px] font-medium"
                    style={{ background: "var(--lifeflow-background)", color: "var(--color-text-secondary)" }}
                  >
                    取消
                  </button>
                  <button
                    onClick={handleSaveVision}
                    className="flex-1 h-9 rounded-xl text-[13px] font-semibold text-white"
                    style={{ background: goalColor }}
                  >
                    保存
                  </button>
                </div>
              </div>
            ) : (
              <div className="flex items-center gap-2">
                <p className="text-[15px]" style={{ color: "var(--color-text-primary)" }}>
                  {goal.vision || "还没有设定愿景画面"}
                </p>
                <button onClick={handleStartVisionEdit} className="flex-shrink-0 w-7 h-7 rounded-lg flex items-center justify-center active:opacity-60" style={{ background: "var(--lifeflow-brand-50)" }}>
                  <Settings className="w-3.5 h-3.5" style={{ color: goalColor }} />
                </button>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* ─── 今日理想日推进（T22.3 目标页 ← 理想日反向联动） ─── */}
      {idealTodayPlans.length > 0 && (
        <div className="mx-4 mt-4 p-4 rounded-[20px]" style={{ background: "var(--color-surface-card)", boxShadow: "var(--shadow-card)" }}>
          <div className="flex items-center justify-between mb-2.5">
            <h2 className="text-[13px] font-semibold" style={{ color: "var(--color-text-disabled)" }}>
              今日理想日推进
            </h2>
            <button type="button" onClick={() => router.push("/ideal-day")}
              className="text-[11.5px] font-medium active:opacity-70" style={{ color: goalColor }}>
              去理想日 →
            </button>
          </div>
          <div className="flex flex-col">
            {idealTodayPlans.map((p) => (
              <button key={p.blockId} type="button"
                onClick={() => router.push(`/ideal-day?block=${p.blockId}`)}
                className="flex items-center gap-2.5 py-2 text-left active:opacity-70"
                style={{ borderBottom: "1px solid var(--lifeflow-border-light)" }}>
                <span className="flex h-6 w-6 items-center justify-center rounded-full shrink-0"
                  style={{ background: p.isCompleted ? "rgba(52,199,89,0.16)" : `${goalColor}1A`, color: p.isCompleted ? GREEN : goalColor }}>
                  {p.isCompleted ? <Check className="w-3.5 h-3.5" /> : <ChevronRight className="w-3.5 h-3.5" />}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="text-[12.5px] font-medium truncate" style={{ color: p.isCompleted ? "var(--color-text-tertiary)" : "var(--color-text-primary)", textDecoration: p.isCompleted ? "line-through" : "none" }}>
                    {p.content}
                  </p>
                  <p className="text-[11px] tabular-nums mt-0.5" style={{ color: "var(--color-text-tertiary)" }}>
                    {p.start} - {p.end} · 理想日学习时段
                  </p>
                </div>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* ─── 关键结果 ───────────────────────────────────────── */}
      <div className="mx-4 mt-4">
        <h2 className="text-[13px] font-semibold mb-2 px-1" style={{ color: "var(--color-text-disabled)" }}>
          关键结果
        </h2>
        <div className="flex flex-col gap-2">
          {keyResults.map((kr) => {
            const progress = kr.targetValue > 0 ? Math.min(100, Math.round((kr.currentValue / kr.targetValue) * 100)) : 0;
            const isEditingThis = editingKR === kr.id;

            return (
              <div
                key={kr.id}
                className="rounded-[20px] p-4"
                style={{ background: "var(--color-surface-card)", boxShadow: "var(--shadow-card)" }}
              >
                <div className="flex items-center justify-between mb-2">
                  <p className="text-[15px] font-medium truncate flex-1" style={{ color: "var(--color-text-primary)" }}>
                    {kr.description || "未命名关键结果"}
                  </p>
                  <div className="flex items-center gap-1 flex-shrink-0 ml-2">
                    <button onClick={() => handleDeleteKR(kr.id)} className="w-7 h-7 rounded-lg flex items-center justify-center" style={{ background: `${DANGER}15` }}>
                      <X className="w-3.5 h-3.5" style={{ color: DANGER }} />
                    </button>
                  </div>
                </div>
                <div className="flex items-end gap-2 mb-2">
                  {isEditingThis ? (
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <div className="flex items-center gap-1">
                        <button
                          type="button"
                          onClick={() => setEditingKRValue(String(Math.max(0, (parseFloat(editingKRValue) || 0) - 1)))}
                          className="w-8 h-9 rounded-lg flex items-center justify-center active:opacity-60"
                          style={{ background: "var(--lifeflow-background)", color: "var(--color-text-secondary)" }}
                          aria-label="减少 1"
                        >
                          <Minus className="w-3.5 h-3.5" />
                        </button>
                        <input
                          type="number"
                          value={editingKRValue}
                          onChange={(e) => setEditingKRValue(e.target.value)}
                          className="w-20 h-9 rounded-lg px-2 text-[15px] font-semibold tabular-nums outline-none text-center"
                          style={cs}
                          autoFocus
                          onKeyDown={(e) => {
                            if (e.key === "Enter") handleSaveKRValue(kr.id);
                            if (e.key === "Escape") setEditingKR(null);
                          }}
                        />
                        <button
                          type="button"
                          onClick={() => setEditingKRValue(String((parseFloat(editingKRValue) || 0) + 1))}
                          className="w-8 h-9 rounded-lg flex items-center justify-center active:opacity-60"
                          style={{ background: "var(--lifeflow-background)", color: "var(--color-text-secondary)" }}
                          aria-label="增加 1"
                        >
                          <Plus className="w-3.5 h-3.5" />
                        </button>
                        <span className="text-[13px]" style={{ color: "var(--color-text-secondary)" }}>{kr.unit}</span>
                      </div>
                      <div className="flex items-center gap-1.5">
                        <button onClick={() => handleSaveKRValue(kr.id)} className="w-7 h-7 rounded-lg flex items-center justify-center" style={{ background: `${GREEN}20` }}>
                          <Check className="w-3.5 h-3.5" style={{ color: GREEN }} />
                        </button>
                        <button
                          type="button"
                          onClick={() => handleSaveKRValue(kr.id, kr.targetValue)}
                          className="h-7 px-2.5 rounded-lg text-[11px] font-semibold"
                          style={{ background: `${goalColor}18`, color: goalColor }}
                        >
                          一键达标
                        </button>
                      </div>
                    </div>
                  ) : (
                    <button
                      onClick={() => handleToggleKR(kr)}
                      className="flex items-center gap-1 active:opacity-60"
                    >
                      <span className="text-[24px] font-bold tabular-nums" style={{ color: goalColor }}>
                        {kr.currentValue}
                      </span>
                      <span className="text-[13px]" style={{ color: "var(--color-text-secondary)" }}>{kr.unit}</span>
                      <span className="text-[13px] mx-1" style={{ color: "var(--color-text-disabled)" }}>/</span>
                      <span className="text-[15px]" style={{ color: "var(--color-text-disabled)" }}>{kr.targetValue}{kr.unit}</span>
                      <span className="ml-1 px-1.5 py-0.5 rounded-md text-[10.5px] font-semibold tabular-nums"
                        style={{ background: `${goalColor}14`, color: kr.currentValue >= kr.targetValue ? GREEN : goalColor }}>
                        {Math.min(100, Math.round((kr.currentValue / kr.targetValue) * 100))}%
                      </span>
                    </button>
                  )}
                </div>
                <div className="h-2 rounded-full overflow-hidden" style={{ background: "var(--lifeflow-muted)" }}>
                  <motion.div
                    className="h-full rounded-full"
                    style={{ backgroundColor: goalColor }}
                    initial={{ width: 0 }}
                    animate={{ width: `${progress}%` }}
                    transition={{ duration: 0.6, ease: "easeOut" }}
                  />
                </div>
              </div>
            );
          })}

          {/* 添加关键结果 */}
          <AnimatePresence>
            {showAddKR ? (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: "auto" }}
                exit={{ opacity: 0, height: 0 }}
                className="overflow-hidden rounded-[20px]"
                style={{ background: "var(--color-surface-card)", boxShadow: "var(--shadow-card)" }}
              >
                <div className="p-4 space-y-3">
                  <input
                    value={newKRDesc}
                    onChange={(e) => setNewKRDesc(e.target.value)}
                    className="w-full h-11 rounded-xl px-3 text-[15px] outline-none"
                    style={cs}
                    placeholder="描述（如：体脂率降至 22%）"
                    autoFocus
                  />
                  <div className="flex gap-2">
                    <input
                      type="number"
                      value={newKRTarget}
                      onChange={(e) => setNewKRTarget(e.target.value)}
                      className="flex-1 h-11 rounded-xl px-3 text-[15px] outline-none"
                      style={cs}
                      placeholder="目标值"
                    />
                    <input
                      value={newKRUnit}
                      onChange={(e) => setNewKRUnit(e.target.value)}
                      className="w-20 h-11 rounded-xl px-3 text-[15px] outline-none"
                      style={cs}
                      placeholder="单位"
                    />
                  </div>
                  <div className="flex gap-2">
                    <button
                      onClick={() => setShowAddKR(false)}
                      className="flex-1 h-10 rounded-xl text-[13px] font-medium"
                      style={{ background: "var(--lifeflow-background)", color: "var(--color-text-secondary)" }}
                    >
                      取消
                    </button>
                    <button
                      onClick={handleAddKR}
                      className="flex-1 h-10 rounded-xl text-[13px] font-semibold text-white"
                      style={{ background: goalColor }}
                    >
                      添加
                    </button>
                  </div>
                </div>
              </motion.div>
            ) : (
              <button
                onClick={() => setShowAddKR(true)}
                className="h-11 rounded-xl text-[14px] font-medium flex items-center justify-center gap-1.5 active:opacity-60"
                style={{ border: `1px dashed ${goalColor}40`, color: goalColor, background: `${goalColor}08` }}
              >
                <Plus className="w-4 h-4" />
                添加关键结果
              </button>
            )}
          </AnimatePresence>
        </div>
      </div>

      {/* ─── 策略列表 ───────────────────────────────────────── */}
      {(strategies.length > 0 || showAddStrategy) && (
        <div className="mx-4 mt-5">
          <div className="flex items-center justify-between mb-2 px-1">
            <h2 className="text-[13px] font-semibold" style={{ color: "var(--color-text-disabled)" }}>
              策略
            </h2>
            <button
              type="button"
              onClick={() => setShowAddStrategy((v) => !v)}
              className="flex items-center gap-1 text-[12px] font-medium active:opacity-70"
              style={{ color: goalColor }}
            >
              <Plus className="w-3.5 h-3.5" />
              添加策略
            </button>
          </div>

          {/* T22.7：策略内联添加表单 */}
          {showAddStrategy && (
            <div className="rounded-[20px] p-4 mb-3" style={{ background: "var(--color-surface-card)", boxShadow: "var(--shadow-card)" }}>
              <div className="space-y-2.5">
                <input
                  value={newStrategyName}
                  onChange={(e) => setNewStrategyName(e.target.value)}
                  className="w-full h-10 rounded-xl px-3 text-[14px] outline-none"
                  style={cs}
                  placeholder="策略名称（如：行测每日刷题）"
                  autoFocus
                  onKeyDown={(e) => { if (e.key === "Enter") handleAddStrategy(); }}
                />
                <input
                  value={newStrategyDesc}
                  onChange={(e) => setNewStrategyDesc(e.target.value)}
                  className="w-full h-10 rounded-xl px-3 text-[14px] outline-none"
                  style={cs}
                  placeholder="描述（可选，如：每天 2 小时专项训练）"
                />
                <div className="flex gap-2">
                  {([['daily', '每日固定'], ['weekly', '周循环']] as [StrategyV2["cycleType"], string][]).map(([k, label]) => (
                    <button
                      key={k}
                      type="button"
                      onClick={() => setNewStrategyCycle(k)}
                      className="flex-1 h-9 rounded-lg text-[13px] font-medium"
                      style={{
                        background: newStrategyCycle === k ? `${goalColor}18` : "var(--lifeflow-background)",
                        border: `1px solid ${newStrategyCycle === k ? goalColor : "var(--lifeflow-border)"}`,
                        color: newStrategyCycle === k ? goalColor : "var(--color-text-secondary)",
                      }}
                    >
                      {label}
                    </button>
                  ))}
                </div>
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => setShowAddStrategy(false)}
                    className="flex-1 h-10 rounded-xl text-[13px] font-medium"
                    style={{ background: "var(--lifeflow-background)", color: "var(--color-text-secondary)" }}
                  >
                    取消
                  </button>
                  <button
                    type="button"
                    onClick={handleAddStrategy}
                    className="flex-1 h-10 rounded-xl text-[13px] font-semibold text-white"
                    style={{ background: goalColor }}
                  >
                    添加
                  </button>
                </div>
              </div>
            </div>
          )}

          {strategies.length > 0 && (
          <div className="flex flex-col gap-3">
            {strategies.map((strategy) => {
              const isExpanded = expandedStrategies.has(strategy.id);
              const strategyWTs = weeklyTasksByStrategy.get(strategy.id) || [];
              const strategyDAs = dailyActionsByStrategy.get(strategy.id) || [];
              const todaysActions = strategyDAs.filter((da) => da.date === today);
              const thisWeekTasks = strategyWTs.filter((wt) => wt.weekStart === currentWeekStart);

              return (
                <div
                  key={strategy.id}
                  className="rounded-[20px] overflow-hidden"
                  style={{ background: "var(--color-surface-card)", boxShadow: "var(--shadow-card)" }}
                >
                  {/* 策略头部 */}
                  <div className="flex items-center gap-3 px-4 py-3 min-h-[52px]">
                    <button
                      type="button"
                      onClick={() => toggleStrategy(strategy.id)}
                      className="flex-1 min-w-0 text-left"
                    >
                      <div className="flex items-center gap-2">
                        <div className="w-2 h-2 rounded-full flex-shrink-0" style={{ backgroundColor: goalColor }} />
                        <p className="text-[17px] font-semibold truncate" style={{ color: "var(--color-text-primary)" }}>
                          {strategy.name}
                        </p>
                      </div>
                      {strategy.description && (
                        <p className="text-[13px] mt-0.5 ml-4" style={{ color: "var(--color-text-secondary)" }}>
                          {strategy.description}
                        </p>
                      )}
                      {/* 阶段信息 */}
                      <div className="flex items-center gap-2 ml-4 mt-1">
                        {strategy.startDate && strategy.endDate && (
                          <span className="text-[11px]" style={{ color: "var(--color-text-disabled)" }}>
                            {strategy.startDate.slice(5)} ~ {strategy.endDate.slice(5)}
                          </span>
                        )}
                        <span className="text-[11px] px-1.5 py-0.5 rounded-full" style={{
                          backgroundColor: `${strategy.cycleType === 'weekly' ? '#6366F1' : '#10B981'}15`,
                          color: strategy.cycleType === 'weekly' ? '#6366F1' : '#10B981',
                        }}>
                          {strategy.cycleType === 'weekly' ? '周循环' : '每日固定'}
                        </span>
                        {strategy.startDate && strategy.startDate <= today && (!strategy.endDate || strategy.endDate >= today) && (
                          <span className="text-[11px] px-1.5 py-0.5 rounded-full" style={{
                            backgroundColor: 'rgba(52,199,89,0.12)', color: '#34C759'
                          }}>
                            活跃中
                          </span>
                        )}
                        {strategy.endDate && strategy.endDate < today && (
                          <span className="text-[11px] px-1.5 py-0.5 rounded-full" style={{
                            backgroundColor: 'rgba(142,142,147,0.15)', color: '#8E8E93'
                          }}>
                            已结束
                          </span>
                        )}
                        {strategy.startDate && strategy.startDate > today && (
                          <span className="text-[11px] px-1.5 py-0.5 rounded-full" style={{
                            backgroundColor: 'rgba(255,149,0,0.12)', color: '#FF9500'
                          }}>
                            待开始
                          </span>
                        )}
                        {/* T22.7：本周任务 / 今日行动进度小结 */}
                        {(strategyWTs.length > 0 || todaysActions.length > 0) && (
                          <span className="text-[11px] tabular-nums" style={{ color: "var(--color-text-disabled)" }}>
                            本周 {strategyWTs.filter((w) => w.isCompleted).length}/{strategyWTs.length} · 今日 {todaysActions.filter((a) => a.isCompleted).length}/{todaysActions.length}
                          </span>
                        )}
                      </div>
                    </button>
                    <button
                      type="button"
                      onClick={() => handleDeleteStrategy(strategy.id)}
                      className="w-7 h-7 rounded-lg flex items-center justify-center"
                      style={{ background: `${DANGER}15` }}
                    >
                      <Trash2 className="w-3.5 h-3.5" style={{ color: DANGER }} />
                    </button>
                    <button
                      type="button"
                      onClick={() => toggleStrategy(strategy.id)}
                      className="w-7 h-7 rounded-lg flex items-center justify-center"
                      style={{ background: "var(--lifeflow-muted)" }}
                    >
                      <ChevronDown
                        className="w-4 h-4 transition-transform"
                        style={{
                          color: "var(--color-text-secondary)",
                          transform: isExpanded ? "rotate(180deg)" : "rotate(0deg)",
                        }}
                      />
                    </button>
                  </div>

                  {/* 策略展开内容 */}
                  <AnimatePresence>
                    {isExpanded && (
                      <motion.div
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: "auto", opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        transition={{ duration: 0.2 }}
                        className="overflow-hidden"
                      >
                        <div className="px-4 pb-4">
                          <div style={{ borderTop: "0.5px solid var(--lifeflow-border)" }} className="pt-3 space-y-4">
                            {/* ── 本周任务 ── */}
                            <div>
                              <p className="text-[13px] font-semibold mb-2" style={{ color: "var(--color-text-secondary)" }}>
                                ▸ 本周 ({formatWeekRange(currentWeekStart)})
                              </p>
                              <div className="space-y-1.5">
                                {thisWeekTasks.map((wt) => (
                                  <div key={wt.id} className="flex items-center gap-2 py-1.5">
                                    <button
                                      onClick={() => handleToggleWeeklyTask(wt)}
                                      className="w-5 h-5 rounded-full flex-shrink-0 flex items-center justify-center"
                                      style={{
                                        border: wt.isCompleted ? "none" : "2px solid var(--color-text-disabled)",
                                        background: wt.isCompleted ? goalColor : "transparent",
                                      }}
                                    >
                                      {wt.isCompleted && <Check className="w-[11px] h-[11px] text-white" strokeWidth={3} />}
                                    </button>
                                    <span
                                      className="flex-1 text-[14px] truncate"
                                      style={{
                                        color: wt.isCompleted ? "var(--color-text-disabled)" : "var(--color-text-primary)",
                                        textDecoration: wt.isCompleted ? "line-through" : "none",
                                      }}
                                    >
                                      {wt.title}
                                    </span>
                                    {wt.deliverable && (
                                      <span className="shrink-0 text-[11px] truncate max-w-[140px]" style={{ color: "var(--color-text-disabled)" }}>
                                        {wt.deliverable}
                                      </span>
                                    )}
                                    <button
                                      onClick={() => handleDeleteWeeklyTask(wt.id)}
                                      className="w-6 h-6 rounded-lg flex items-center justify-center active:opacity-60"
                                    >
                                      <X className="w-3 h-3" style={{ color: "var(--color-text-disabled)" }} />
                                    </button>
                                  </div>
                                ))}
                                {/* 添加周任务 */}
                                <div className="flex items-center gap-2">
                                  <input
                                    value={newWeeklyTaskTitle.get(strategy.id) || ""}
                                    onChange={(e) =>
                                      setNewWeeklyTaskTitle((prev) => {
                                        const next = new Map(prev);
                                        next.set(strategy.id, e.target.value);
                                        return next;
                                      })
                                    }
                                    className="flex-1 h-9 rounded-lg px-3 text-[13px] outline-none"
                                    style={cs}
                                    placeholder="添加周任务..."
                                    onKeyDown={(e) => {
                                      if (e.key === "Enter") handleAddWeeklyTask(strategy.id);
                                    }}
                                  />
                                  <button
                                    onClick={() => handleAddWeeklyTask(strategy.id)}
                                    className="h-9 px-3 rounded-lg text-[13px] font-medium flex items-center gap-1"
                                    style={{ border: `1px solid ${goalColor}`, color: goalColor }}
                                  >
                                    <Plus className="w-3.5 h-3.5" />
                                    添加
                                  </button>
                                </div>
                              </div>
                            </div>

                            {/* ── 今日行动 ── */}
                            <div>
                              <p className="text-[13px] font-semibold mb-2" style={{ color: "var(--color-text-secondary)" }}>
                                ▸ 今日行动（{fmtDate(today)}）
                              </p>
                              <div className="space-y-1.5">
                                {todaysActions.map((da) => (
                                  <div key={da.id} className="flex items-center gap-2 py-1.5">
                                    <button
                                      onClick={() => handleToggleDailyAction(da)}
                                      className="w-5 h-5 rounded-full flex-shrink-0 flex items-center justify-center"
                                      style={{
                                        border: da.isCompleted ? "none" : "2px solid var(--color-text-disabled)",
                                        background: da.isCompleted ? goalColor : "transparent",
                                      }}
                                    >
                                      {da.isCompleted && <Check className="w-[11px] h-[11px] text-white" strokeWidth={3} />}
                                    </button>
                                    <span className="text-[12px] tabular-nums flex-shrink-0" style={{ color: "var(--color-text-disabled)" }}>
                                      {da.time}
                                    </span>
                                    <span
                                      className="flex-1 text-[14px] truncate"
                                      style={{
                                        color: da.isCompleted ? "var(--color-text-disabled)" : "var(--color-text-primary)",
                                        textDecoration: da.isCompleted ? "line-through" : "none",
                                      }}
                                    >
                                      {da.title}
                                    </span>
                                    <button
                                      onClick={() => handleDeleteDailyAction(da.id)}
                                      className="w-6 h-6 rounded-lg flex items-center justify-center active:opacity-60"
                                    >
                                      <X className="w-3 h-3" style={{ color: "var(--color-text-disabled)" }} />
                                    </button>
                                  </div>
                                ))}
                                {/* 添加日行动 */}
                                <div className="flex items-center gap-2">
                                  <input
                                    value={newDailyAction.get(strategy.id)?.title || ""}
                                    onChange={(e) =>
                                      setNewDailyAction((prev) => {
                                        const next = new Map(prev);
                                        const cur = next.get(strategy.id) || { title: "", time: "08:00" };
                                        next.set(strategy.id, { ...cur, title: e.target.value });
                                        return next;
                                      })
                                    }
                                    className="flex-[3] h-9 rounded-lg px-3 text-[13px] outline-none"
                                    style={cs}
                                    placeholder="添加日行动..."
                                    onKeyDown={(e) => {
                                      if (e.key === "Enter") handleAddDailyAction(strategy.id);
                                    }}
                                  />
                                  <input
                                    type="time"
                                    value={newDailyAction.get(strategy.id)?.time || "08:00"}
                                    onChange={(e) =>
                                      setNewDailyAction((prev) => {
                                        const next = new Map(prev);
                                        const cur = next.get(strategy.id) || { title: "", time: "08:00" };
                                        next.set(strategy.id, { ...cur, time: e.target.value });
                                        return next;
                                      })
                                    }
                                    className="w-[80px] h-9 rounded-lg px-2 text-[13px] outline-none tabular-nums"
                                    style={cs}
                                  />
                                  <button
                                    onClick={() => handleAddDailyAction(strategy.id)}
                                    className="h-9 px-3 rounded-lg text-[13px] font-medium flex items-center gap-1"
                                    style={{ border: `1px solid ${goalColor}`, color: goalColor }}
                                  >
                                    <Plus className="w-3.5 h-3.5" />
                                    添加
                                  </button>
                                </div>
                              </div>
                            </div>

                            {/* 空状态 */}
                            {thisWeekTasks.length === 0 && todaysActions.length === 0 && (
                              <p className="text-[13px] text-center py-2" style={{ color: "var(--color-text-disabled)" }}>
                                暂无周任务和日行动，在上方添加
                              </p>
                            )}
                          </div>
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
              );
            })}
          </div>
          )}
        </div>
      )}

      {/* ─── 空目标状态 ─────────────────────────────────────── */}
      {strategies.length === 0 && !showAddStrategy && (
        <div className="flex flex-col items-center pt-12 px-8">
          <div className="w-16 h-16 rounded-2xl flex items-center justify-center mb-4" style={{ background: `${goalColor}15` }}>
            <Settings className="w-8 h-8" style={{ color: goalColor }} />
          </div>
          <p className="text-[16px] font-semibold" style={{ color: "var(--color-text-primary)" }}>
            开始拆解你的目标
          </p>
          <p className="text-[13px] text-center mt-1 mb-6" style={{ color: "var(--color-text-secondary)" }}>
            添加关键结果来衡量进展，添加策略来规划行动。
          </p>
          <button
            type="button"
            onClick={() => setShowAddStrategy(true)}
            className="flex items-center gap-1 px-5 h-10 rounded-full text-[13px] font-semibold text-white"
            style={{ background: goalColor }}
          >
            <Plus className="w-4 h-4" />
            添加第一个策略
          </button>
        </div>
      )}
    </div>
  );
}
