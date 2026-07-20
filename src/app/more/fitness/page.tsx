"use client";

import { useState, useEffect, useMemo, useCallback, useRef } from "react";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { useHealthStore } from "@/lib/store/healthStore";
import { addExerciseV2 } from "@/lib/db/health.db";
import type { MuscleGroupV2, ExerciseV2, WorkoutSession, WorkoutExercise, ExerciseSet } from "@/lib/db/health.db";
import BottomSheet from "@/components/common/BottomSheet";
import { showToast } from "@/components/ui/Toast";
import { ChevronLeft, Dumbbell, Minus, Plus, X, Trash2, Star } from "lucide-react";

// ============================================================
// 设计令牌
// ============================================================
const ACCENT = "#6366F1";
const INK = "#1D1D1F";
const MUTED = "#86868B";
const FAINT = "#AEAEB2";
const CARD = "#FFFFFF";
const CARD_BORDER = "#EBEBEB";
const FILL = "#F5F5F7";
const INPUT_BORDER = "#E2E2E4";
const DASH = "#D2D2D7";
const DOT_COLORS = ["#D97706", "#6366F1", "#E11D48", "#059669"];
const DANGER = "#FF3B30";

// ─── 工具 ──────────────────────────────────────────────────
function localTodayStr(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}
function fmtAvg(n: number) { return Number.isInteger(n) ? `${n}` : n.toFixed(1); }
function getWeekRangeStr(): string {
  const now = new Date();
  const dow = now.getDay();
  const mon = new Date(now);
  mon.setDate(now.getDate() - (dow === 0 ? 6 : dow - 1));
  const sun = new Date(mon);
  sun.setDate(mon.getDate() + 6);
  return `${mon.getMonth() + 1}/${mon.getDate()} - ${sun.getMonth() + 1}/${sun.getDate()}`;
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
  const t = d.getTime();
  return t >= mon.getTime() && t <= sun.getTime();
}

// ============================================================
// 主组件
// ============================================================
export default function FitnessPage() {
  const router = useRouter();
  const { muscleGroupsV2, exercisesV2, workoutSessions,
    loadFitnessDataV2, addWorkoutSessionV2, deleteWorkoutSessionV2 } = useHealthStore();

  const [loading, setLoading] = useState(true);
  const [recordOpen, setRecordOpen] = useState(false);

  // 自定义动作 sheet
  const [customOpen, setCustomOpen] = useState(false);
  const [customName, setCustomName] = useState("");
  const [customGroupId, setCustomGroupId] = useState("");

  // 行展开
  const [expandedSession, setExpandedSession] = useState<string | null>(null);

  useEffect(() => { loadFitnessDataV2().finally(() => setLoading(false)); }, [loadFitnessDataV2]);

  // ─── 本周统计 ────────────────────────────────────────────
  const weekStats = useMemo(() => {
    const weekSessions = workoutSessions.filter((s) => isDateInWeek(s.date));
    const days = new Set(weekSessions.map((s) => s.date)).size;
    const totalSets = weekSessions.reduce((s, sess) => s + sess.exercises.reduce((t, e) => t + e.sets.length, 0), 0);
    const exerciseIds = new Set(weekSessions.flatMap((s) => s.exercises.map((e) => e.exerciseId))).size;
    return { days, totalSets, exerciseIds };
  }, [workoutSessions]);
  const weekRange = useMemo(() => getWeekRangeStr(), []);

  // ─── 肌群计数 ────────────────────────────────────────────
  const muscleCounts = useMemo(() => {
    const weekSessions = workoutSessions.filter((s) => isDateInWeek(s.date));
    return muscleGroupsV2.map((g) => {
      const count = weekSessions.filter((s) =>
        s.exercises.some((e) => {
          const ex = exercisesV2.find((x) => x.id === e.exerciseId);
          return ex?.muscleGroupId === g.id;
        })
      ).length;
      return { ...g, count };
    });
  }, [workoutSessions, muscleGroupsV2, exercisesV2]);

  // ─── 最近训练 ────────────────────────────────────────────
  const recentGroups = useMemo(() => {
    const sorted = [...workoutSessions].sort((a, b) => {
      if (a.date !== b.date) return b.date.localeCompare(a.date);
      return b.createdAt - a.createdAt;
    }).slice(0, 30);
    // 按日期分组
    const map = new Map<string, WorkoutSession[]>();
    for (const s of sorted) {
      const list = map.get(s.date) || [];
      list.push(s);
      if (list.length === 1) map.set(s.date, list);
    }
    // 取最近10个日期
    return Array.from(map.entries())
      .sort(([a], [b]) => b.localeCompare(a))
      .slice(0, 10)
      .map(([date, sessions]) => ({ date, sessions }));
  }, [workoutSessions]);

  const formatDateGroup = (dateStr: string) => {
    const d = new Date(dateStr + "T00:00:00");
    const weeks = ["日", "一", "二", "三", "四", "五", "六"];
    return `${d.getMonth() + 1}月${d.getDate()}日 周${weeks[d.getDay()]}`;
  };

  // ─── 删除 ────────────────────────────────────────────────
  const handleDelete = useCallback(async (id: string) => {
    await deleteWorkoutSessionV2(id);
    showToast({ type: "success", message: "训练记录已删除" });
    setExpandedSession(null);
  }, [deleteWorkoutSessionV2]);

  // ─── 自定义动作 ──────────────────────────────────────────
  const handleCustomAdd = useCallback(async () => {
    if (!customName.trim() || !customGroupId) { showToast({ type: "warning", message: "请输入动作名称并选择肌群" }); return; }
    await addExerciseV2({ muscleGroupId: customGroupId, name: customName.trim(), isCustom: true });
    showToast({ type: "success", message: "自定义动作已添加" });
    setCustomName("");
    setCustomOpen(false);
    loadFitnessDataV2();
  }, [customName, customGroupId, loadFitnessDataV2]);

  // ════════════════════════════════════════════════════════════
  // 渲染
  // ════════════════════════════════════════════════════════════
  if (loading) {
    return (
      <div>
        <div className="h-12 px-5 flex items-center bg-white border-b border-[#EBEBEB]"><ChevronLeft className="w-[22px] h-[22px] text-[#1D1D1F]" /></div>
        <div className="px-4 pt-3 flex flex-col gap-3">
          {[1, 2, 3].map((i) => (
            <div key={i} className="bg-white rounded-xl p-5 animate-pulse" style={{ boxShadow: "0 1px 4px rgba(0,0,0,0.04)" }}>
              <div className="h-6 w-1/3 bg-[#F5F5F7] rounded mb-3" />
              <div className="h-8 w-2/3 bg-[#F5F5F7] rounded" />
            </div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="pb-8">
      {/* ===== 页头 ===== */}
      <div className="h-12 px-5 flex items-center justify-between bg-white border-b border-[#EBEBEB] sticky top-0 z-20">
        <button type="button" onClick={() => router.push("/more")}
          className="-ml-2 w-9 h-9 flex items-center justify-center">
          <ChevronLeft className="w-[22px] h-[22px] text-[#1D1D1F]" />
        </button>
        <span className="absolute left-1/2 -translate-x-1/2 text-[20px] font-semibold text-[#1D1D1F]">训练</span>
        <button type="button" onClick={() => setRecordOpen(true)}
          className="text-[16px] font-medium text-[#6366F1]">记录训练</button>
      </div>

      <div className="px-4 pt-3 flex flex-col gap-3">

        {/* ===== 本周卡 ===== */}
        <motion.div
          initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}
          className="bg-white rounded-xl p-5" style={{ boxShadow: "0 1px 4px rgba(0,0,0,0.04)" }}
        >
          <div className="flex items-baseline justify-between">
            <span className="text-[20px] font-bold text-[#1D1D1F]">本周</span>
            <span className="text-[13px] text-[#86868B]">{weekRange}</span>
          </div>
          <div className="mt-4 grid grid-cols-3">
            {[
              { label: "训练天数", value: weekStats.days, unit: "天" },
              { label: "总组数", value: weekStats.totalSets, unit: "组" },
              { label: "动作数", value: weekStats.exerciseIds, unit: "个" },
            ].map((item, i) => (
              <div key={item.label} className="flex items-center gap-3">
                {i > 0 && <div className="w-px h-11 bg-[#EBEBEB]" />}
                <div className="flex flex-col items-center flex-1">
                  <span className="text-[12px] text-[#86868B] mb-1.5">{item.label}</span>
                  <div className="flex items-baseline">
                    <span className="text-[24px] font-bold tabular-nums text-[#1D1D1F]">{item.value}</span>
                    <span className="text-[15px] font-medium ml-0.5 text-[#1D1D1F]">{item.unit}</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </motion.div>

        {/* ===== 肌群卡 ===== */}
        <motion.div
          initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.05 }}
          className="bg-white rounded-xl p-5" style={{ boxShadow: "0 1px 4px rgba(0,0,0,0.04)" }}
        >
          <span className="text-[20px] font-bold text-[#1D1D1F]">肌群</span>
          <div className="mt-4 grid grid-cols-2 gap-[10px]">
            {muscleCounts.map((g) => (
              <div key={g.id} className="bg-[#F5F5F7] rounded-[10px] h-[76px] flex flex-col items-center justify-center gap-1.5">
                <span className="text-[12px] text-[#86868B]">{g.name}</span>
                <div className="flex items-baseline">
                  <span className="text-[20px] font-bold tabular-nums text-[#1D1D1F]">{g.count}</span>
                  <span className="text-[13px] font-medium ml-0.5 text-[#1D1D1F]">次</span>
                </div>
              </div>
            ))}
          </div>
        </motion.div>

        {/* ===== 最近训练卡 ===== */}
        <motion.div
          initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="bg-white rounded-xl p-5" style={{ boxShadow: "0 1px 4px rgba(0,0,0,0.04)" }}
        >
          <span className="text-[20px] font-bold text-[#1D1D1F]">最近训练</span>

          {recentGroups.length === 0 ? (
            <div className="py-10 flex flex-col items-center gap-2">
              <Dumbbell className="w-10 h-10 text-[#D2D2D7]" />
              <span className="text-[13px] text-[#86868B]">暂无训练记录</span>
            </div>
          ) : (
            recentGroups.map((group) => (
              <div key={group.date} className="mt-5 first:mt-4">
                <span className="text-[13px] text-[#86868B] mb-1 block">{formatDateGroup(group.date)}</span>
                {group.sessions.flatMap((session) =>
                  session.exercises.map((ex, ei) => {
                    const totalSets = ex.sets.length;
                    const avgWeight = ex.sets.reduce((s, set) => s + set.weight, 0) / totalSets;
                    const avgRpe = ex.sets.reduce((s, set) => s + set.rpe, 0) / totalSets;
                    const isExpanded = expandedSession === session.id;
                    const dotColor = DOT_COLORS[ei % DOT_COLORS.length];
                    return (
                      <div key={`${session.id}-${ei}`}>
                        <div
                          className={`flex items-center gap-[10px] py-3 cursor-pointer select-none ${ei > 0 ? "border-t border-[#EBEBEB]" : ""}`}
                          onClick={() => setExpandedSession(isExpanded ? null : session.id)}
                        >
                          <div className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: dotColor }} />
                          <div className="flex-1 min-w-0">
                            <div className="text-[16px] font-semibold text-[#1D1D1F] truncate">{ex.exerciseName}</div>
                            <div className="text-[15px] text-[#86868B]">
                              {totalSets}组 × {avgWeight === 0 ? "自重" : `${fmtAvg(avgWeight)}kg`} · RPE {fmtAvg(avgRpe)}
                            </div>
                          </div>
                        </div>
                        {/* 展开明细 */}
                        <AnimatePresence>
                          {isExpanded && (
                            <motion.div
                              initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }}
                              exit={{ height: 0, opacity: 0 }}
                              transition={{ duration: 0.2 }}
                              className="overflow-hidden"
                            >
                              <div className="mt-1 rounded-[10px] bg-[#F5F5F7] p-3">
                                {ex.sets.map((set, si) => (
                                  <div key={set.id} className="flex items-center gap-2 text-[13px] text-[#86868B] py-0.5">
                                    <span>第{si + 1}组</span>
                                    <span>·</span>
                                    <span>{set.weight}kg × {set.reps}次</span>
                                    <span>·</span>
                                    <span>RPE {set.rpe}</span>
                                    {set.isPR && <Star className="w-3.5 h-3.5 text-[#6366F1]" />}
                                  </div>
                                ))}
                                <button
                                  type="button"
                                  onClick={(e) => { e.stopPropagation(); handleDelete(session.id); }}
                                  className="mt-2 flex items-center gap-1.5 text-[13px] text-[#86868B]"
                                >
                                  <Trash2 className="w-4 h-4" />删除此记录
                                </button>
                              </div>
                            </motion.div>
                          )}
                        </AnimatePresence>
                      </div>
                    );
                  })
                )}
              </div>
            ))
          )}
        </motion.div>

        {/* ===== 虚线引导框 ===== */}
        <motion.div
          initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.15 }}
          className="h-[104px] rounded-xl border-[1.5px] border-dashed border-[#D2D2D7] flex flex-col items-center justify-center gap-1.5 cursor-pointer"
          onClick={() => setRecordOpen(true)}
        >
          <span className="text-[14px] text-[#AEAEB2]">点击右上角「记录训练」开始</span>
          <span className="text-[13px] text-[#AEAEB2]">记录动作 · 组数 · 重量 · RPE</span>
        </motion.div>

      </div>

      {/* ===== 记录训练弹层 ===== */}
      <RecordSheet
        open={recordOpen}
        onClose={() => setRecordOpen(false)}
        exercisesV2={exercisesV2}
        muscleGroupsV2={muscleGroupsV2}
        workoutSessions={workoutSessions}
        addWorkoutSessionV2={addWorkoutSessionV2}
        loadFitnessDataV2={loadFitnessDataV2}
        showToast={showToast}
        customOpen={customOpen} setCustomOpen={setCustomOpen}
        customName={customName} setCustomName={setCustomName}
        customGroupId={customGroupId} setCustomGroupId={setCustomGroupId}
        handleCustomAdd={handleCustomAdd}
      />
    </div>
  );
}

// ============================================================
// 记录训练弹层
// ============================================================
function RecordSheet({
  open, onClose, exercisesV2, muscleGroupsV2, workoutSessions,
  addWorkoutSessionV2, loadFitnessDataV2, showToast,
  customOpen, setCustomOpen, customName, setCustomName,
  customGroupId, setCustomGroupId, handleCustomAdd,
}: any) {
  const [name, setName] = useState("");
  const [selectedId, setSelectedId] = useState("");
  const [sets, setSets] = useState(3);
  const [reps, setReps] = useState(10);
  const [weight, setWeight] = useState(20);
  const [rpe, setRpe] = useState(7);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (open) {
      setName("");
      setSelectedId("");
      setSets(3);
      setReps(10);
      setWeight(20);
      setRpe(7);
      setSaving(false);
    }
  }, [open]);

  // 动作名命中历史记录时预填
  const prefilled = useRef(false);
  useEffect(() => {
    if (!open || !name.trim()) return;
    const trimmed = name.trim();
    // 精确匹配已有动作
    const found = exercisesV2?.find((e: ExerciseV2) => e.name === trimmed);
    if (found && !prefilled.current) {
      setSelectedId(found.id);
      // 查最近一次该动作的数据
      const all = workoutSessions?.flatMap((s: WorkoutSession) => s.exercises) ?? [];
      const hist = all.filter((e: any) => e.exerciseId === found.id).pop();
      if (hist && hist.sets.length > 0) {
        const last = hist.sets[0];
        setReps(last.reps ?? 10);
        setWeight(last.weight ?? 20);
        setRpe(last.rpe ?? 7);
      }
      prefilled.current = true;
    }
  }, [name, exercisesV2, workoutSessions, open]);

  // 建议列表
  const suggestions = useMemo(() => {
    if (!name.trim() || !exercisesV2) return [];
    const q = name.trim().toLowerCase();
    return exercisesV2.filter((e: ExerciseV2) => e.name.toLowerCase().includes(q)).slice(0, 5);
  }, [name, exercisesV2]);

  const handleSelectSuggestion = (ex: ExerciseV2) => {
    setName(ex.name);
    setSelectedId(ex.id);
  };

  const handleSave = useCallback(async () => {
    const trimmed = name.trim();
    if (!trimmed) { showToast({ type: "warning", message: "请输入动作名称" }); return; }
    setSaving(true);

    let exId = selectedId;
    let exName = trimmed;

    // 查是否已有匹配动作
    const match = exercisesV2?.find((e: ExerciseV2) => e.name === trimmed);
    if (!match && !selectedId) {
      // 未命中 → 打开自定义动作 sheet
      setCustomName(trimmed);
      setCustomOpen(true);
      setSaving(false);
      return;
    }
    if (match) { exId = match.id; exName = match.name; }

    // 展开组
    const setList: ExerciseSet[] = Array.from({ length: sets }, (_, i) => ({
      id: crypto.randomUUID(), setNumber: i + 1, reps, weight, rpe, isPR: false,
    }));

    // isPR判定
    const history = workoutSessions?.flatMap((s: WorkoutSession) =>
      s.exercises.filter((e: WorkoutExercise) => e.exerciseId === exId)) ?? [];
    if (history.length > 0) {
      const maxHist = Math.max(...history.flatMap((e: WorkoutExercise) => e.sets.map((s) => s.weight)));
      for (const s of setList) { if (s.weight > maxHist) s.isPR = true; }
    }

    try {
      await addWorkoutSessionV2({
        date: localTodayStr(),
        exercises: [{ exerciseId: exId, exerciseName: exName, sets: setList }],
        notes: "",
      });
      showToast({ type: "success", message: "训练已保存" });
      onClose();
    } catch {
      showToast({ type: "error", message: "保存失败" });
    } finally { setSaving(false); }
  }, [name, selectedId, sets, reps, weight, rpe, exercisesV2, workoutSessions, addWorkoutSessionV2, onClose, showToast, setCustomName, setCustomOpen]);

  return (
    <BottomSheet open={open} onClose={onClose} title={undefined} showHandle={true}>
      <div className="p-5 flex flex-col">
        <div className="flex items-center justify-between mb-5">
          <span className="text-[20px] font-bold text-[#1D1D1F]">记录训练</span>
          <button type="button" onClick={onClose}
            className="w-9 h-9 rounded-full bg-[#F5F5F7] flex items-center justify-center">
            <X className="w-4 h-4 text-[#86868B]" />
          </button>
        </div>

        {/* 动作名称 */}
        <label className="text-[13px] font-semibold text-[#1D1D1F] mb-2 block">动作名称</label>
        <input type="text" value={name} onChange={(e) => { setName(e.target.value); prefilled.current = false; }}
          placeholder="例如：深蹲"
          className="h-11 rounded-[10px] bg-[#F5F5F7] border border-[#E2E2E4] px-[14px] text-[15px] text-[#1D1D1F] placeholder-[#86868B] outline-none w-full" />
        {suggestions.length > 0 && !selectedId && (
          <div className="mt-1 rounded-[10px] bg-[#F5F5F7] overflow-hidden">
            {suggestions.map((ex: ExerciseV2) => {
              const group = muscleGroupsV2?.find((g: MuscleGroupV2) => g.id === ex.muscleGroupId);
              return (
                <button key={ex.id} type="button"
                  onClick={() => handleSelectSuggestion(ex)}
                  className="w-full h-10 px-3 flex items-center justify-between text-left hover:bg-white/50">
                  <span className="text-[15px] text-[#1D1D1F]">{ex.name}</span>
                  <span className="text-[12px] text-[#86868B]">{group?.name || ""}</span>
                </button>
              );
            })}
          </div>
        )}

        {/* 组数 × 次数 */}
        <label className="text-[13px] font-semibold text-[#1D1D1F] mb-2 mt-5 block">组数 × 次数</label>
        <div className="flex gap-[10px]">
          <Stepper label="组" value={sets} onChange={setSets} min={1} max={20} />
          <Stepper label="次" value={reps} onChange={setReps} min={1} max={100} />
        </div>

        {/* 重量 */}
        <label className="text-[13px] font-semibold text-[#1D1D1F] mb-2 mt-4 block">重量 (kg)</label>
        <Stepper label="kg" value={weight} onChange={setWeight} min={0} max={500} step={2.5} fullWidth />

        {/* RPE */}
        <label className="text-[13px] font-semibold text-[#1D1D1F] mb-2 mt-4 block">RPE</label>
        <div className="flex gap-[10px]">
          {[6, 7, 8, 9, 10].map((v) => (
            <button key={v} type="button" onClick={() => setRpe(v)}
              className="flex-1 h-10 rounded-[10px] text-[16px] flex items-center justify-center"
              style={{
                background: rpe === v ? ACCENT : FILL,
                color: rpe === v ? "white" : INK,
                fontWeight: rpe === v ? 600 : 400,
              }}>{v}</button>
          ))}
        </div>

        {/* 保存 */}
        <button type="button" onClick={handleSave} disabled={saving}
          className="mt-6 w-full h-[50px] rounded-[10px] bg-[#6366F1] text-white text-[16px] font-semibold disabled:opacity-60">
          {saving ? "保存中…" : "保存"}
        </button>
      </div>

      {/* 自定义动作 sheet */}
      <BottomSheet open={customOpen} onClose={() => setCustomOpen(false)} title="创建自定义动作" showHandle={true}>
        <div className="p-5 flex flex-col">
          <input type="text" value={customName} onChange={(e) => setCustomName(e.target.value)}
            placeholder="动作名称" autoFocus
            className="h-11 rounded-[10px] bg-[#F5F5F7] border border-[#E2E2E4] px-[14px] text-[15px] text-[#1D1D1F] placeholder-[#86868B] outline-none w-full" />
          <select value={customGroupId} onChange={(e) => setCustomGroupId(e.target.value)}
            className="mt-3 h-11 rounded-[10px] bg-[#F5F5F7] border border-[#E2E2E4] px-[14px] text-[15px] text-[#1D1D1F] outline-none w-full">
            <option value="">选择肌群</option>
            {muscleGroupsV2?.map((g: MuscleGroupV2) => (
              <option key={g.id} value={g.id}>{g.name}</option>
            ))}
          </select>
          <button type="button" onClick={handleCustomAdd}
            className="mt-4 w-full h-[50px] rounded-[10px] bg-[#6366F1] text-white text-[16px] font-semibold">
            创建动作
          </button>
        </div>
      </BottomSheet>
    </BottomSheet>
  );
}

// ============================================================
// 步进器
// ============================================================
function Stepper({ label, value, onChange, min, max, step = 1, fullWidth }: {
  label: string; value: number; onChange: (v: number) => void;
  min: number; max: number; step?: number; fullWidth?: boolean;
}) {
  return (
    <div className={`${fullWidth ? "w-full" : "flex-1"} h-[50px] rounded-[10px] bg-[#F5F5F7] px-3 flex items-center`}>
      <span className="text-[12px] text-[#86868B] mr-auto">{label}</span>
      <button type="button"
        onClick={() => onChange(Math.max(min, value - step))}
        className="w-[30px] h-[30px] rounded-[8px] bg-white flex items-center justify-center">
        <Minus className="w-[14px] h-[14px] text-[#1D1D1F]" />
      </button>
      <span className="text-[18px] font-medium tabular-nums min-w-[28px] text-center text-[#1D1D1F]">
        {Number.isInteger(value) ? value : value.toFixed(1)}
      </span>
      <button type="button"
        onClick={() => onChange(Math.min(max, value + step))}
        className="w-[30px] h-[30px] rounded-[8px] bg-white flex items-center justify-center">
        <Plus className="w-[14px] h-[14px] text-[#1D1D1F]" />
      </button>
    </div>
  );
}
