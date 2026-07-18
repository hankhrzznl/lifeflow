"use client";

import { useState, useEffect, useMemo, useCallback } from "react";
import { motion } from "framer-motion";
import { useRouter } from "next/navigation";
import { useHealthStore } from "@/lib/store/healthStore";
import { addExerciseV2 } from "@/lib/db/health.db";
import type { MuscleGroupV2, ExerciseV2, WorkoutSession, WorkoutExercise, ExerciseSet } from "@/lib/db/health.db";
import BottomSheet from "@/components/common/BottomSheet";
import { showToast } from "@/components/ui/Toast";
import {
  ChevronLeft, Plus, Activity, PlusSquare, Flame, Dumbbell, Users, Trophy,
  ChevronRight, Pencil, Clock, Trash2, Sparkles, BarChart3, Calendar,
  Search, X, PenTool, History, HelpCircle, Check, Footprints, ArrowLeft, Target, TrendingUp, TrendingDown, ArrowUp,
} from "lucide-react";

// ============================================================
// 设计稿基准: lifeflow-health/pages/fitness.html + fitness-record.html
// 品牌橙 #FF9500
// ============================================================

const BRAND = "#FF9500";
const BG = "#F2F2F7";
const CARD = "#FFFFFF";
const MUTED = "#8E8E93";
const TERTIARY = "#C7C7CC";
const BORDER = "#E5E5EA";
const TINT = "#FFF3E0";
const SHADOW_CARD = "0 2px 8px rgba(0,0,0,0.08)";
const SHADOW_BTN = "0 2px 8px rgba(255,149,0,0.25)";
const SHADOW_FAB = "0 4px 16px rgba(255,149,0,0.35)";
const INFO = "#007AFF";
const SUCCESS = "#34C759";
const ERROR = "#FF3B30";

// ─── RPE 色阶 ────────────────────────────────────────────────

function getRPEColor(rpe: number): string {
  if (rpe <= 3) return INFO;
  if (rpe <= 6) return SUCCESS;
  if (rpe <= 8) return BRAND;
  return ERROR;
}

// ─── 肌群图标映射（硬编码设计稿规则） ─────────────────────────

const MUSCLE_ICONS: Record<string, React.ComponentType<{ className?: string; style?: React.CSSProperties }>> = {
  "胸部": Dumbbell,
  "背部": ArrowLeft,
  "腿部": Footprints,
  "肩部": Users,
  "手臂": Dumbbell,
  "核心": Target,
};

// ─── 记录视图本地类型（completed 仅本地 UI 状态，不落库，决策 5） ──

type RecordSet = ExerciseSet & { completed: boolean };
type RecordExercise = Omit<WorkoutExercise, "sets"> & { sets: RecordSet[] };

// ─── 日期工具 ────────────────────────────────────────────────

function localTodayStr(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function formatDateCn(d: Date): string {
  return `${d.getFullYear()}年${d.getMonth() + 1}月${d.getDate()}日`;
}

// ============================================================
// 页面
// ============================================================

export default function FitnessPage() {
  const router = useRouter();

  const {
    muscleGroupsV2, exercisesV2, workoutSessions, weeklyStats,
    loadFitnessDataV2, addWorkoutSessionV2, deleteWorkoutSessionV2,
  } = useHealthStore();

  const [loading, setLoading] = useState(true);

  // Sheet
  const [sheetOpen, setSheetOpen] = useState(false);
  const [sheetStep, setSheetStep] = useState<"select" | "record">("select");
  const [currentExercises, setCurrentExercises] = useState<RecordExercise[]>([]);
  const [searchQuery, setSearchQuery] = useState("");

  // 自定义动作
  const [customOpen, setCustomOpen] = useState(false);
  const [customName, setCustomName] = useState("");
  const [customGroupId, setCustomGroupId] = useState("");

  // 展开的 workout
  const [expandedWorkout, setExpandedWorkout] = useState<string | null>(null);

  useEffect(() => { loadFitnessDataV2().finally(() => setLoading(false)); }, [loadFitnessDataV2]);

  // ─── 主页数据 ──────────────────────────────────────────────

  const recentSessions = useMemo(
    () => [...workoutSessions].sort((a, b) => b.date.localeCompare(a.date)).slice(0, 20),
    [workoutSessions],
  );
  const hasRecent = recentSessions.length > 0;

  // B5. 历史对比：每个 exerciseId 最近一次含该动作的 session（按日期倒序取首次出现）
  const lastSessionByExercise = useMemo(() => {
    const map = new Map<string, { date: string; ex: WorkoutExercise }>();
    const sorted = [...workoutSessions].sort((a, b) => b.date.localeCompare(a.date) || b.createdAt - a.createdAt);
    for (const s of sorted) {
      for (const ex of s.exercises) {
        if (ex.sets.length > 0 && !map.has(ex.exerciseId)) map.set(ex.exerciseId, { date: s.date, ex });
      }
    }
    return map;
  }, [workoutSessions]);

  const fmtVolume = (v: number) => v >= 1000 ? `${(v / 1000).toFixed(1)}t` : `${v}`;
  // 均值显示：整数不带小数，否则保留 1 位（82.5 / 7.5）
  const fmtAvg = (n: number) => Number.isInteger(n) ? `${n}` : n.toFixed(1);

  // ─── 动作添加 ──────────────────────────────────────────────

  const addExercise = useCallback((ex: ExerciseV2) => {
    setCurrentExercises((prev) => {
      if (prev.find((e) => e.exerciseId === ex.id)) return prev;
      return [...prev, { exerciseId: ex.id, exerciseName: ex.name, sets: [] }];
    });
    setSheetStep("record");
  }, []);

  const removeExercise = useCallback((idx: number) => {
    setCurrentExercises((prev) => prev.filter((_, i) => i !== idx));
  }, []);

  const addSet = useCallback((exIdx: number) => {
    setCurrentExercises((prev) => prev.map((e, i) => {
      if (i !== exIdx) return e;
      const sn = e.sets.length + 1;
      const last = e.sets[e.sets.length - 1];
      return { ...e, sets: [...e.sets, { id: crypto.randomUUID(), setNumber: sn, reps: last?.reps ?? 10, weight: last?.weight ?? 20, rpe: last?.rpe ?? 7, isPR: false, completed: true }] };
    }));
  }, []);

  const updateSet = useCallback((exIdx: number, sid: string, field: keyof RecordSet, value: number | boolean) => {
    setCurrentExercises((prev) => prev.map((e, i) => {
      if (i !== exIdx) return e;
      return { ...e, sets: e.sets.map((s) => s.id === sid ? { ...s, [field]: value } : s) };
    }));
  }, []);

  const removeSet = useCallback((exIdx: number, sid: string) => {
    setCurrentExercises((prev) => prev.map((e, i) => {
      if (i !== exIdx) return e;
      const ns = e.sets.filter((s) => s.id !== sid);
      return { ...e, sets: ns.map((s, idx) => ({ ...s, setNumber: idx + 1 })) };
    }));
  }, []);

  const cycleRPE = useCallback((exIdx: number, sid: string, current: number) => {
    const next = current >= 10 ? 1 : current + 0.5;
    updateSet(exIdx, sid, "rpe", next);
  }, [updateSet]);

  // 完成勾选切换（决策 5：仅本地 UI 状态，不落库）
  const toggleCompleted = useCallback((exIdx: number, sid: string) => {
    setCurrentExercises((prev) => prev.map((e, i) => {
      if (i !== exIdx) return e;
      return { ...e, sets: e.sets.map((s) => s.id === sid ? { ...s, completed: !s.completed } : s) };
    }));
  }, []);

  // ─── 保存/删除 ────────────────────────────────────────────

  const handleSave = useCallback(async () => {
    const valid = currentExercises.filter((e) => e.sets.length > 0);
    if (valid.length === 0) { showToast({ type: "warning", message: "请至少添加一组训练" }); return; }
    // 剥离本地 completed 字段，落库为纯净 ExerciseSet
    const payload: WorkoutExercise[] = valid.map((e) => ({
      exerciseId: e.exerciseId,
      exerciseName: e.exerciseName,
      sets: e.sets.map((s) => ({ id: s.id, setNumber: s.setNumber, reps: s.reps, weight: s.weight, rpe: s.rpe, isPR: s.isPR })),
    }));
    // isPR判定（决策 7：无历史则全部 false）
    const allSessions = workoutSessions;
    for (const we of payload) {
      const history = allSessions.flatMap((s) => s.exercises.filter((e) => e.exerciseId === we.exerciseId));
      if (history.length === 0) continue;
      const maxHist = Math.max(...history.flatMap((e) => e.sets.map((s) => s.weight)));
      for (const s of we.sets) { if (s.weight > maxHist) s.isPR = true; }
    }
    await addWorkoutSessionV2({ date: localTodayStr(), exercises: payload, notes: "" });
    showToast({ type: "success", message: "训练已保存" });
    setSheetOpen(false);
    setCurrentExercises([]);
    setSearchQuery("");
  }, [currentExercises, addWorkoutSessionV2, workoutSessions]);

  const handleDelete = useCallback(async (id: string) => {
    await deleteWorkoutSessionV2(id);
    showToast({ type: "success", message: "训练记录已删除" });
  }, [deleteWorkoutSessionV2]);

  const handleCustomAdd = useCallback(async () => {
    if (!customName.trim() || !customGroupId) { showToast({ type: "warning", message: "请输入动作名称并选择肌群" }); return; }
    await addExerciseV2({ muscleGroupId: customGroupId, name: customName.trim(), isCustom: true });
    showToast({ type: "success", message: "自定义动作已添加" });
    setCustomName("");
    setCustomOpen(false);
    loadFitnessDataV2();
  }, [customName, customGroupId, loadFitnessDataV2]);

  // ─── 关闭 sheet ───────────────────────────────────────────

  const closeSheet = () => { setSheetOpen(false); setCurrentExercises([]); setSearchQuery(""); };

  // ============================================================
  // 渲染

  if (loading) return (
    <div className="flex items-center justify-center" style={{ minHeight: "60vh" }}>
      <div className="flex flex-col items-center gap-3">
        <div className="w-8 h-8 border-2 border-[#FF9500] border-t-transparent rounded-full animate-spin" />
        <span className="text-sm" style={{ color: TERTIARY }}>加载中...</span>
      </div>
    </div>
  );

  return (
    <div className="pb-8">
      {/* ===== A1. 页头 96px ===== */}
      <div className="flex flex-col pt-3 pb-4 px-4" style={{ height: 96 }}>
        <button type="button" onClick={() => router.push("/health")}
          className="inline-flex items-center justify-center w-8 h-8 -ml-1 mb-0.5" aria-label="返回">
          <ChevronLeft className="w-6 h-6" style={{ color: BRAND }} />
        </button>
        <h1 className="text-[34px] font-bold leading-tight tracking-[-0.02em] text-black">健身</h1>
        <p className="text-[15px] leading-snug mt-0.5" style={{ color: MUTED }}>力量训练记录 · 计划管理</p>
      </div>

      <div className="px-4">
        {/* ===== A2. 操作按钮行 ===== */}
        <div className="flex items-center gap-2 mb-3">
          <button type="button" onClick={() => { setCurrentExercises([]); setSheetStep("select"); setSearchQuery(""); setSheetOpen(true); }}
            className="inline-flex items-center justify-center gap-1.5 h-11 px-5 rounded-[22px] text-[16px] font-semibold text-white shrink-0"
            style={{ background: BRAND, boxShadow: SHADOW_BTN }}>
            <Plus className="w-[18px] h-[18px] shrink-0" />添加训练记录
          </button>
          <button type="button" onClick={() => showToast({ type: "info", message: "功能开发中" })}
            className="inline-flex items-center justify-center gap-1 h-11 px-3 rounded-[22px] text-[14px] font-medium text-black shrink-0" style={{ background: BG }}>
            <Activity className="w-4 h-4 shrink-0" />热身/拉伸
          </button>
          <button type="button" onClick={() => showToast({ type: "info", message: "功能开发中" })}
            className="inline-flex items-center justify-center gap-1 h-11 px-3 rounded-[22px] text-[14px] font-medium text-black shrink-0" style={{ background: BG }}>
            <PlusSquare className="w-4 h-4 shrink-0" />创建计划
          </button>
        </div>

        {/* ===== A3. 本周训练总结 ===== */}
        <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}
          className="rounded-2xl p-4 mb-3" style={{ background: CARD, boxShadow: SHADOW_CARD }}>
          <div className="flex items-center gap-1.5 mb-3">
            <Flame className="w-5 h-5 shrink-0" style={{ color: BRAND }} />
            <h2 className="text-[20px] font-semibold text-black leading-tight">本周训练总结</h2>
          </div>
          <div className="grid grid-cols-2 gap-3">
            {[
              { icon: Dumbbell, value: weeklyStats.sessions, label: "训练次数" },
              { icon: Users, value: weeklyStats.muscles, label: "覆盖肌群" },
              { icon: Trophy, value: weeklyStats.prs, label: "个人最佳" },
              { icon: BarChart3, value: fmtVolume(weeklyStats.totalVolume), label: "总训练量" },
            ].map((item, i) => (
              <div key={i} className="rounded-xl p-3 flex flex-col items-center justify-center min-h-[80px]" style={{ background: TINT }}>
                <item.icon className="w-5 h-5 mb-1" style={{ color: BRAND }} />
                <span className="text-[34px] font-bold leading-none tabular-nums" style={{ color: BRAND }}>{item.value}</span>
                <span className="text-[13px] leading-snug mt-1" style={{ color: MUTED }}>{item.label}</span>
              </div>
            ))}
          </div>
        </motion.div>

        {/* ===== A4. 肌肉群管理 ===== */}
        <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.05 }}
          className="rounded-2xl p-4 mb-3" style={{ background: CARD, boxShadow: SHADOW_CARD }}>
          <div className="flex items-center gap-1.5 mb-1">
            <Dumbbell className="w-5 h-5 shrink-0" style={{ color: BRAND }} />
            <h2 className="text-[20px] font-semibold text-black leading-tight">肌肉群管理</h2>
          </div>
          <div className="flex flex-col">
            {muscleGroupsV2.map((g, i) => {
              const IconComp = MUSCLE_ICONS[g.name] || Dumbbell;
              const subCount = g.subMuscles.length;
              return (
                <button key={g.id} type="button" onClick={() => showToast({ type: "info", message: "功能开发中" })}
                  className="flex items-center h-14 gap-3 w-full"
                  style={{ borderBottom: i < muscleGroupsV2.length - 1 ? "0.5px solid #E5E5EA" : "none" }}>
                  <div className="w-10 h-10 rounded-[10px] flex items-center justify-center shrink-0" style={{ background: TINT }}>
                    <IconComp className="w-5 h-5" style={{ color: BRAND }} />
                  </div>
                  <div className="flex-1 min-w-0 flex flex-col justify-center">
                    <span className="text-[17px] font-semibold text-black leading-tight truncate">{g.name}</span>
                    <span className="text-[13px] leading-tight truncate" style={{ color: MUTED }}>
                      {g.subMuscles.slice(0, 2).join("、")}
                    </span>
                  </div>
                  <span className="text-[12px] font-medium shrink-0" style={{ color: i === 0 ? BRAND : MUTED }}>{subCount}个小肌肉</span>
                  <Pencil className="w-[18px] h-[18px] shrink-0" style={{ color: TERTIARY }} />
                  <ChevronRight className="w-5 h-5 shrink-0" style={{ color: TERTIARY }} />
                </button>
              );
            })}
          </div>
        </motion.div>

        {/* ===== A5. 最近训练 ===== */}
        <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}
          className="rounded-2xl p-4 mb-3" style={{ background: CARD, boxShadow: SHADOW_CARD }}>
          <div className="flex items-center gap-1.5 mb-1">
            <Clock className="w-5 h-5 shrink-0" style={{ color: BRAND }} />
            <h2 className="text-[20px] font-semibold text-black leading-tight">最近训练</h2>
            <span className="text-[12px] ml-1" style={{ color: MUTED }}>{recentSessions.length}条记录</span>
            <span className="ml-auto text-[12px] font-medium px-2.5 py-1 rounded-[10px] shrink-0 cursor-pointer"
              style={{ background: TINT, color: BRAND }} onClick={() => showToast({ type: "info", message: "功能开发中" })}>批量管理</span>
          </div>
          {!hasRecent ? (
            <div className="flex flex-col items-center justify-center py-14">
              <Dumbbell className="w-12 h-12 mb-4" style={{ color: TERTIARY }} />
              <p className="text-[17px] font-medium mb-1" style={{ color: TERTIARY }}>暂无训练记录</p>
              <p className="text-[15px]" style={{ color: TERTIARY }}>开始记录你的力量训练吧</p>
            </div>
          ) : (
            <div className="flex flex-col">
              {recentSessions.map((s, si) => {
                const isExp = expandedWorkout === s.id;
                const exCount = s.exercises.length;
                const setCount = s.exercises.reduce((sum, e) => sum + e.sets.length, 0);
                const d = new Date(s.date);
                const today = localTodayStr();
                const yesterdayVal = new Date(); yesterdayVal.setDate(yesterdayVal.getDate() - 1);
                const yesterday = `${yesterdayVal.getFullYear()}-${String(yesterdayVal.getMonth()+1).padStart(2,"0")}-${String(yesterdayVal.getDate()).padStart(2,"0")}`;
                const dateLabel = s.date === today ? "今天" : s.date === yesterday ? "昨天" : `${d.getMonth()+1}月${d.getDate()}日`;
                return (
                  <div key={s.id} style={{ borderBottom: si < recentSessions.length - 1 ? "0.5px solid #E5E5EA" : "none" }}>
                    <button type="button" onClick={() => setExpandedWorkout(isExp ? null : s.id!)}
                      className="flex items-center gap-3 h-14 w-full">
                      <div className="w-10 h-10 rounded-[10px] flex items-center justify-center shrink-0" style={{ background: TINT }}>
                        <Dumbbell className="w-5 h-5" style={{ color: BRAND }} />
                      </div>
                      <div className="flex-1 min-w-0 text-left">
                        <span className="text-[17px] font-semibold text-black">{dateLabel}</span>
                        <span className="text-[13px] block" style={{ color: MUTED }}>{exCount}个动作 · {setCount}组</span>
                      </div>
                      <button type="button" onClick={(e) => { e.stopPropagation(); handleDelete(s.id!); }}
                        className="w-5 h-5 flex items-center justify-center"><Trash2 className="w-5 h-5" style={{ color: TERTIARY }} /></button>
                      <ChevronRight className="w-5 h-5" style={{ color: TERTIARY }} />
                    </button>
                    {isExp && (
                      <div className="pb-3 pl-[52px] flex flex-wrap gap-1.5">
                        {s.exercises.map((we) => we.sets.map((set) => (
                          <span key={set.id} className="inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-md" style={{ background: BG, color: "#000" }}>
                            {we.exerciseName} {set.weight}kg×{set.reps}
                            <span style={{ color: getRPEColor(set.rpe) }}>RPE{set.rpe}</span>
                            {set.isPR && <span style={{ color: BRAND }}>★</span>}
                          </span>
                        )))}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </motion.div>

        {/* ===== A6. 底部链接 ===== */}
        <button type="button" onClick={() => showToast({ type: "info", message: "功能开发中" })}
          className="block w-full rounded-xl p-4 text-center mb-3" style={{ background: CARD, boxShadow: SHADOW_CARD }}>
          <span className="text-[15px] font-medium" style={{ color: BRAND }}>查看完整训练数据统计 →</span>
        </button>
      </div>

      {/* ===== A7. FAB ===== */}
      <button type="button" onClick={() => showToast({ type: "info", message: "功能开发中" })}
        className="fixed w-14 h-14 rounded-full z-40 flex items-center justify-center"
        style={{ right: "max(16px, calc(50% - 215px + 16px))", bottom: 100, background: BRAND, boxShadow: SHADOW_FAB }} aria-label="智能助手">
        <Sparkles className="w-6 h-6 text-white" />
      </button>

      {/* ═══════════════════════════════════════ 记录训练 Sheet ═══ */}
      <BottomSheet open={sheetOpen} onClose={closeSheet}>
        {/* B1. Sheet 头部：取消 / 记录训练 / 保存 */}
        <div className="flex items-center justify-between h-14">
          <button type="button" onClick={closeSheet}
            className="text-[15px] font-normal whitespace-nowrap" style={{ color: MUTED }}>取消</button>
          <span className="text-xl font-semibold truncate text-black">记录训练</span>
          <button type="button" onClick={handleSave}
            className="text-base font-semibold whitespace-nowrap" style={{ color: BRAND }}>保存</button>
        </div>
        {sheetStep === "select" ? (
          /* 选择动作 */
          <div className="flex flex-col" style={{ minHeight: "50vh" }}>
            <div className="flex items-center gap-2 mb-3">
              <div className="flex-1 flex items-center rounded-[10px] h-11 px-3" style={{ background: BG }}>
                <Search className="w-4 h-4 shrink-0" style={{ color: MUTED }} />
                <input type="text" value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} placeholder="搜索动作或肌群..."
                  className="flex-1 bg-transparent outline-none text-[15px] ml-2" style={{ color: "#000" }} />
                {searchQuery && <button onClick={() => setSearchQuery("")}><X className="w-4 h-4" style={{ color: MUTED }} /></button>}
              </div>
            </div>
            <div className="flex-1 overflow-y-auto space-y-1">
              {muscleGroupsV2.filter((g) => {
                if (!searchQuery.trim()) return true;
                const q = searchQuery.toLowerCase();
                const exs = exercisesV2.filter((e) => e.muscleGroupId === g.id);
                return g.name.toLowerCase().includes(q) || g.subMuscles.some((s) => s.toLowerCase().includes(q)) || exs.some((e) => e.name.toLowerCase().includes(q));
              }).map((g) => {
                const IconComp = MUSCLE_ICONS[g.name] || Dumbbell;
                const gExs = exercisesV2.filter((e) => e.muscleGroupId === g.id);
                const addedIds = new Set(currentExercises.map((e) => e.exerciseId));
                return (
                  <div key={g.id} className="rounded-xl overflow-hidden">
                    <div className="flex items-center gap-3 p-3" style={{ background: TINT }}>
                      <div className="w-10 h-10 rounded-[10px] flex items-center justify-center shrink-0" style={{ background: CARD }}>
                        <IconComp className="w-5 h-5" style={{ color: BRAND }} />
                      </div>
                      <span className="flex-1 text-[17px] font-semibold text-black text-left">{g.name}</span>
                      <span className="text-[12px] font-medium" style={{ color: MUTED }}>{g.subMuscles.length}个小肌肉</span>
                    </div>
                    {gExs.map((ex) => {
                      const isAdded = addedIds.has(ex.id);
                      return (
                        <button key={ex.id} type="button" onClick={() => addExercise(ex)} disabled={isAdded}
                          className="flex items-center gap-3 w-full px-3 py-2.5" style={{ borderBottom: "0.5px solid #E5E5EA", opacity: isAdded ? 0.5 : 1 }}>
                          <span className="flex-1 text-left text-[15px] text-black">{ex.name}</span>
                          <span className={`w-6 h-6 rounded-full flex items-center justify-center ${isAdded ? "" : ""}`}
                            style={{ background: isAdded ? SUCCESS : "transparent", border: isAdded ? "none" : `1.5px solid ${BRAND}` }}>
                            {isAdded ? <Check className="w-3.5 h-3.5 text-white" /> : <Plus className="w-3.5 h-3.5" style={{ color: BRAND }} />}
                          </span>
                        </button>
                      );
                    })}
                  </div>
                );
              })}
            </div>
            <div className="sticky bottom-0 pt-3 pb-1 text-center text-sm" style={{ color: MUTED, background: CARD }}>
              已选 {currentExercises.length} 个动作
            </div>
          </div>
        ) : (
          /* 记录训练 */
          <div className="flex flex-col" style={{ minHeight: "50vh" }}>
            {/* B2. 日期条（决策 6：点击 toast 占位，保存恒写今天） */}
            <button type="button" onClick={() => showToast({ type: "info", message: "功能开发中" })}
              className="flex items-center gap-2 h-11 px-3 mb-4 rounded-[10px] w-full" style={{ background: BG }}>
              <Calendar className="w-4 h-4 shrink-0" style={{ color: BRAND }} />
              <span className="text-[17px] font-normal" style={{ color: "#000" }}>{formatDateCn(new Date())}</span>
            </button>
            {/* B3. 动作区（标题 → 添加动作 → 自定义动作 → 动作卡片） */}
            <div className="mb-3">
              <h3 className="text-[17px] font-semibold mb-3 text-black">动作</h3>
              <button type="button" onClick={() => setSheetStep("select")}
                className="w-full h-11 flex items-center justify-center gap-1.5 rounded-[10px] border mb-2 text-[17px]"
                style={{ borderColor: BRAND, color: BRAND }}>
                <Plus className="w-[18px] h-[18px] shrink-0" />添加动作
              </button>
              <button type="button" onClick={() => { setCustomGroupId(muscleGroupsV2[0]?.id || ""); setCustomOpen(true); }}
                className="flex items-center gap-1" style={{ color: MUTED }}>
                <PenTool className="w-3.5 h-3.5 shrink-0" /><span className="text-[13px]">创建自定义动作</span>
              </button>
            </div>
            {/* B4. 动作卡片列表 */}
            {currentExercises.map((we, exIdx) => {
              // B5. 历史对比数据：最近一次含该动作的 session 均值 vs 本次均值
              const hist = lastSessionByExercise.get(we.exerciseId);
              let comp: { date: string; prevStr: string; curStr: string; pct: number; width: number; up: boolean } | null = null;
              if (hist && we.sets.length > 0) {
                const avgOf = (sets: { weight: number; reps: number; rpe: number }[]) => ({
                  w: sets.reduce((a, s) => a + s.weight, 0) / sets.length,
                  r: sets.reduce((a, s) => a + s.reps, 0) / sets.length,
                  p: sets.reduce((a, s) => a + s.rpe, 0) / sets.length,
                });
                const prev = avgOf(hist.ex.sets);
                const cur = avgOf(we.sets);
                if (prev.w > 0) {
                  const pct = (cur.w / prev.w - 1) * 100;
                  comp = {
                    date: hist.date,
                    prevStr: `${fmtAvg(prev.w)}kg x ${fmtAvg(prev.r)} @RPE${fmtAvg(prev.p)}`,
                    curStr: `${fmtAvg(cur.w)}kg x ${fmtAvg(cur.r)} @RPE${fmtAvg(cur.p)}`,
                    pct,
                    width: Math.min(100, (cur.w / prev.w) * 50),
                    up: pct >= 0,
                  };
                }
              }
              return (
              <div key={exIdx} className="rounded-[12px] p-4 mb-3" style={{ background: CARD, boxShadow: SHADOW_CARD }}>
                <div className="flex items-center justify-between h-11">
                  <span className="text-[17px] font-semibold text-black truncate">{we.exerciseName}</span>
                  <div className="flex items-center gap-3 shrink-0">
                    <button type="button" onClick={() => showToast({ type: "info", message: "功能开发中" })}
                      className="flex items-center gap-0.5 whitespace-nowrap" style={{ color: BRAND }}>
                      <History className="w-4 h-4 shrink-0" /><span className="text-xs">历史</span>
                    </button>
                    <button type="button" onClick={() => removeExercise(exIdx)}><Trash2 className="w-5 h-5" style={{ color: TERTIARY }} /></button>
                  </div>
                </div>
                {/* RPE图例 */}
                <div className="flex items-center gap-2 py-2 mb-2 overflow-x-auto" style={{ scrollbarWidth: "none" }}>
                  {[["1-3 轻", INFO], ["4-6 中", SUCCESS], ["7-8 中高", BRAND], ["9-10 极限", ERROR]].map(([label, color]) => (
                    <div key={label as string} className="flex items-center gap-1 shrink-0">
                      <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ background: color as string }} />
                      <span className="text-[10px] whitespace-nowrap" style={{ color: MUTED }}>{label}</span>
                    </div>
                  ))}
                </div>
                {/* 组表头 */}
                <div className="flex items-center h-8 rounded-[8px]" style={{ background: BG }}>
                  <div className="w-10 text-center text-xs" style={{ color: MUTED }}>组</div>
                  <div className="w-20 text-center text-xs" style={{ color: MUTED }}>重量</div>
                  <div className="w-[60px] text-center text-xs" style={{ color: MUTED }}>次数</div>
                  <div className="w-20 text-center text-xs flex items-center justify-center gap-0.5" style={{ color: MUTED }}>
                    RPE
                    <button type="button" onClick={() => showToast({ type: "info", message: "功能开发中" })}
                      className="flex items-center justify-center" aria-label="RPE 说明">
                      <HelpCircle className="w-3 h-3" style={{ color: MUTED }} />
                    </button>
                  </div>
                  <div className="w-10 text-center text-xs" style={{ color: MUTED }}>完成</div>
                </div>
                {/* 组行 */}
                {we.sets.map((s) => (
                  <div key={s.id} className="flex items-center h-12 border-b" style={{ borderColor: BORDER }}>
                    <div className="w-10 text-center text-[17px]" style={{ color: "#000" }}>{s.setNumber}</div>
                    <div className="w-20 flex justify-center">
                      <input type="number" value={s.weight} onChange={(e) => updateSet(exIdx, s.id, "weight", parseFloat(e.target.value) || 0)}
                        className="w-[60px] h-9 rounded-[8px] text-[17px] text-center bg-transparent outline-none"
                        style={{ background: BG, color: "#000", MozAppearance: "textfield", WebkitAppearance: "none" }} step={2.5} />
                    </div>
                    <div className="w-[60px] flex justify-center">
                      <input type="number" value={s.reps} onChange={(e) => updateSet(exIdx, s.id, "reps", parseInt(e.target.value) || 0)}
                        className="w-11 h-9 rounded-[8px] text-[17px] text-center bg-transparent outline-none"
                        style={{ background: BG, color: "#000", MozAppearance: "textfield", WebkitAppearance: "none" }} />
                    </div>
                    <div className="w-20 flex items-center justify-center gap-1.5">
                      <span className="w-1 h-4 rounded-full shrink-0" style={{ background: getRPEColor(s.rpe) }} />
                      <button type="button" onClick={() => cycleRPE(exIdx, s.id, s.rpe)}
                        className="text-[17px] font-normal" style={{ color: "#000" }}>{s.rpe}</button>
                    </div>
                    <div className="w-10 flex justify-center">
                      <button type="button" onClick={() => toggleCompleted(exIdx, s.id)}
                        className="inline-flex items-center justify-center w-5 h-5 rounded-full"
                        style={s.completed ? { background: BRAND } : { background: CARD, border: `1px solid ${BORDER}` }}
                        aria-label={s.completed ? "标记未完成" : "标记完成"}>
                        {s.completed && <Check className="w-3.5 h-3.5 text-white" />}
                      </button>
                    </div>
                  </div>
                ))}
                {/* 添加组 */}
                <button type="button" onClick={() => addSet(exIdx)}
                  className="w-full flex items-center justify-center gap-1 h-10 border-t" style={{ borderColor: BORDER, color: BRAND }}>
                  <Plus className="w-3.5 h-3.5" /><span className="text-sm font-medium">添加组</span>
                </button>
                {/* B5. 历史对比卡（无历史记录时整卡不渲染） */}
                {comp && (
                  <div className="rounded-[8px] p-3 mt-3" style={{ background: TINT }}>
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-xs truncate min-w-0" style={{ color: MUTED }}>与上次对比 ({comp.date})</span>
                      <div className="flex items-center gap-0.5 shrink-0">
                        {comp.up
                          ? <TrendingUp className="w-3.5 h-3.5 shrink-0" style={{ color: SUCCESS }} />
                          : <TrendingDown className="w-3.5 h-3.5 shrink-0" style={{ color: ERROR }} />}
                        <span className="text-sm font-medium whitespace-nowrap" style={{ color: comp.up ? SUCCESS : ERROR }}>
                          {comp.up ? "+" : ""}{Math.round(comp.pct)}%
                        </span>
                      </div>
                    </div>
                    <div className="flex items-center gap-1.5 text-xs mb-2" style={{ color: MUTED }}>
                      <span className="line-through truncate">{comp.prevStr}</span>
                      <span className="shrink-0">→</span>
                      <span className="truncate" style={{ color: BRAND }}>{comp.curStr}</span>
                    </div>
                    <div className="h-1.5 rounded-full overflow-hidden" style={{ background: BORDER }}>
                      <div className="h-full rounded-full" style={{ width: `${comp.width}%`, background: BRAND }} />
                    </div>
                  </div>
                )}
              </div>
              );
            })}
          </div>
        )}
      </BottomSheet>

      {/* 自定义动作 mini sheet */}
      <BottomSheet open={customOpen} onClose={() => setCustomOpen(false)} title="创建自定义动作">
        <div className="flex flex-col gap-3">
          <input type="text" value={customName} onChange={(e) => setCustomName(e.target.value)} placeholder="动作名称"
            className="w-full h-10 rounded-[8px] px-3 text-[15px] outline-none border-0" style={{ background: BG, color: "#000" }} />
          <select value={customGroupId} onChange={(e) => setCustomGroupId(e.target.value)}
            className="w-full h-10 rounded-[8px] px-3 text-[15px] outline-none border-0" style={{ background: BG, color: "#000" }}>
            {muscleGroupsV2.map((g) => <option key={g.id} value={g.id}>{g.name}</option>)}
          </select>
          <button type="button" onClick={handleCustomAdd}
            className="w-full h-10 rounded-[22px] text-[15px] font-medium text-white" style={{ background: BRAND }}>添加</button>
        </div>
      </BottomSheet>
    </div>
  );
}
