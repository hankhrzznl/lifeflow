"use client";

import { useState, useEffect, useMemo, useCallback, useRef } from "react";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { ChevronLeft, Minus, Plus, Trash2 } from "lucide-react";
import { useHealthStore } from "@/lib/store/healthStore";
import type { WorkoutSession } from "@/lib/db/health.db";
import { showToast } from "@/components/ui/Toast";

/* ────────── Helpers ────────── */

function localTodayStr(): string {
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
  const t = d.getTime();
  return t >= mon.getTime() && t <= sun.getTime();
}

function getWeekRangeStr(): string {
  const now = new Date();
  const dow = now.getDay();
  const mon = new Date(now);
  mon.setDate(now.getDate() - (dow === 0 ? 6 : dow - 1));
  const sun = new Date(mon);
  sun.setDate(mon.getDate() + 6);
  return `${mon.getMonth() + 1}/${mon.getDate()} - ${sun.getMonth() + 1}/${sun.getDate()}`;
}

function fmtAvg(n: number) {
  return Number.isInteger(n) ? `${n}` : n.toFixed(1);
}

const DOT_COLORS = ["#D97706", "#5865F2", "#E11D48", "#059669"];

const RPE_OPTIONS = [6, 7, 8, 9, 10] as const;

/* ────────── Component ────────── */

export default function FitnessPage() {
  const router = useRouter();

  const {
    muscleGroupsV2,
    exercisesV2,
    workoutSessions,
    loadFitnessDataV2,
    addWorkoutSessionV2,
    deleteWorkoutSessionV2,
  } = useHealthStore();

  const [loading, setLoading] = useState(true);
  const [expandedSession, setExpandedSession] = useState<string | null>(null);

  /* recording bottom sheet */
  const [showRecord, setShowRecord] = useState(false);

  /* form state */
  const [exerciseName, setExerciseName] = useState("");
  const [sets, setSets] = useState(3);
  const [reps, setReps] = useState(10);
  const [weight, setWeight] = useState(20);
  const [rpe, setRpe] = useState(7);
  const [submitting, setSubmitting] = useState(false);

  const nameInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    loadFitnessDataV2().finally(() => setLoading(false));
  }, [loadFitnessDataV2]);

  /* ─── Week stats ─── */

  const weekStats = useMemo(() => {
    const weekSessions = workoutSessions.filter((s) => isDateInWeek(s.date));
    const days = new Set(weekSessions.map((s) => s.date)).size;
    const totalSets = weekSessions.reduce((s, sess) => s + sess.exercises.reduce((t, e) => t + e.sets.length, 0), 0);
    const totalExercises = weekSessions.reduce((s, sess) => s + sess.exercises.length, 0);
    return { days, totalSets, totalExercises };
  }, [workoutSessions]);

  const weekRange = useMemo(() => getWeekRangeStr(), []);

  /* ─── Muscle group counts ─── */

  const muscleGroupCounts = useMemo(() => {
    const map = new Map<string, number>();
    for (const s of workoutSessions) {
      for (const ex of s.exercises) {
        const mg = muscleGroupsV2.find((g) =>
          exercisesV2.some((ev) => ev.id === ex.exerciseId && ev.muscleGroupId === g.id)
        );
        if (mg) {
          map.set(mg.id, (map.get(mg.id) || 0) + 1);
        }
      }
    }
    return map;
  }, [workoutSessions, muscleGroupsV2, exercisesV2]);

  /* Only show groups that have exercises recorded */
  const activeMuscleGroups = useMemo(
    () => muscleGroupsV2.filter((g) => muscleGroupCounts.has(g.id)),
    [muscleGroupsV2, muscleGroupCounts],
  );

  /* ─── Recent groups ─── */

  const recentGroups = useMemo(() => {
    const sorted = [...workoutSessions]
      .sort((a, b) => b.createdAt - a.createdAt)
      .slice(0, 100);
    const map = new Map<string, WorkoutSession[]>();
    for (const s of sorted) {
      const list = map.get(s.date) || [];
      list.push(s);
      map.set(s.date, list);
    }
    return Array.from(map.entries())
      .sort(([a], [b]) => b.localeCompare(a))
      .slice(0, 10)
      .map(([date, sessions]) => ({ date, sessions }));
  }, [workoutSessions]);

  /* ─── Format date ─── */

  const formatDateGroup = (dateStr: string) => {
    const d = new Date(dateStr + "T00:00:00");
    const weeks = ["日", "一", "二", "三", "四", "五", "六"];
    return `${d.getMonth() + 1}月${d.getDate()}日 周${weeks[d.getDay()]}`;
  };

  /* ─── Exercise name suggestions ─── */

  const suggestions = useMemo(() => {
    if (!exerciseName.trim()) return [];
    const q = exerciseName.trim().toLowerCase();
    /* unique exercise names from the DB */
    const names = [...new Set(exercisesV2.map((e) => e.name))];
    return names.filter((n) => n.toLowerCase().includes(q)).slice(0, 5);
  }, [exerciseName, exercisesV2]);

  /* ─── Submit record ─── */

  const handleSubmit = useCallback(async () => {
    if (!exerciseName.trim()) return;
    setSubmitting(true);
    try {
      /* Find or create exercise */
      let exId = exercisesV2.find((e) => e.name === exerciseName.trim())?.id;
      if (!exId) {
        exId = crypto.randomUUID();
      }

      await addWorkoutSessionV2({
        date: localTodayStr(),
        exercises: [
          {
            exerciseId: exId,
            exerciseName: exerciseName.trim(),
            sets: Array.from({ length: sets }, (_, i) => ({
              id: crypto.randomUUID(),
              setNumber: i + 1,
              reps,
              weight,
              rpe,
              isPR: false,
            })),
          },
        ],
        notes: "",
      });

      /* reset */
      setExerciseName("");
      setSets(3);
      setReps(10);
      setWeight(20);
      setRpe(7);
      setShowRecord(false);
      showToast({ type: "success", message: "训练已记录" });
    } catch {
      showToast({ type: "error", message: "记录失败" });
    } finally {
      setSubmitting(false);
    }
  }, [exerciseName, sets, reps, weight, rpe, exercisesV2, addWorkoutSessionV2]);

  /* ─── Delete session ─── */

  const handleDelete = useCallback(
    async (id: string) => {
      await deleteWorkoutSessionV2(id);
      setExpandedSession(null);
      showToast({ type: "success", message: "已删除" });
    },
    [deleteWorkoutSessionV2],
  );

  /* ─── Open record sheet ─── */

  const openRecordSheet = useCallback(() => {
    setExerciseName("");
    setSets(3);
    setReps(10);
    setWeight(20);
    setRpe(7);
    setShowRecord(true);
  }, []);

  /* ─── Stepper helpers ─── */

  const clamp = (v: number, min: number, max: number) => Math.max(min, Math.min(max, v));

  /* ─── Loading skeleton ─── */

  if (loading) {
    return (
      <div className="min-h-screen bg-[#FAFAFA]">
        <header className="h-12 px-5 flex items-center justify-between bg-white border-b border-[#EBEBEB] relative">
          <button
            onClick={() => router.push("/more")}
            className="flex items-center justify-center"
          >
            <ChevronLeft className="w-[22px] h-[22px] text-[#1D1D1F]" />
          </button>
          <h1 className="absolute left-1/2 -translate-x-1/2 text-[20px] font-semibold text-[#1D1D1F]">
            训练
          </h1>
          <div className="w-[22px]" />
        </header>
        <div className="px-5 pt-4 flex flex-col gap-4">
          {[1, 2].map((i) => (
            <div key={i} className="bg-white rounded-[10px] border border-[#EBEBEB] p-5 animate-pulse">
              <div className="h-6 w-1/4 rounded bg-[#F5F5F7]" />
              <div className="h-10 w-2/3 mt-3 rounded bg-[#F5F5F7]" />
            </div>
          ))}
        </div>
      </div>
    );
  }

  /* ────────── Render ────────── */

  return (
    <div className="min-h-screen bg-[#FAFAFA] pb-10">
      {/* ─── Header ─── */}
      <header className="h-12 px-5 flex items-center justify-between bg-white border-b border-[#EBEBEB] relative">
        <button
          onClick={() => router.push("/more")}
          className="flex items-center justify-center"
          aria-label="返回"
        >
          <ChevronLeft className="w-[22px] h-[22px] text-[#1D1D1F]" />
        </button>
        <h1 className="absolute left-1/2 -translate-x-1/2 text-[20px] font-semibold text-[#1D1D1F]">
          训练
        </h1>
        <button
          onClick={openRecordSheet}
          className="text-[16px] font-medium text-[#5865F2]"
        >
          记录训练
        </button>
      </header>

      <div className="px-5 pt-4 flex flex-col gap-4">
        {/* ─── This Week Card ─── */}
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.35, ease: [0.32, 0.72, 0, 1] }}
          className="bg-white rounded-[10px] border border-[#EBEBEB] p-5"
        >
          <div className="flex items-center justify-between">
            <h2 className="text-[20px] font-bold text-[#1D1D1F]">本周</h2>
            <span className="text-[13px] text-[#86868B]">{weekRange}</span>
          </div>

          <div className="mt-4 flex">
            {[
              { label: "训练天数", value: weekStats.days, unit: "天" },
              { label: "总组数", value: weekStats.totalSets, unit: "组" },
              { label: "动作数", value: weekStats.totalExercises, unit: "个" },
            ].map((stat, i) => (
              <div key={stat.label} className="flex flex-col items-center flex-1">
                {i > 0 && <div className="w-px bg-[#EBEBEB] absolute" />}
                <span className="text-[24px] font-bold text-[#1D1D1F] tabular-nums leading-none">
                  {stat.value}
                </span>
                <span className="text-[12px] text-[#86868B] mt-1">{stat.label}</span>
              </div>
            ))}
          </div>
        </motion.div>

        {/* ─── Muscle Groups Card ─── */}
        {activeMuscleGroups.length > 0 && (
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.05, duration: 0.35, ease: [0.32, 0.72, 0, 1] }}
            className="bg-white rounded-[10px] border border-[#EBEBEB] p-5"
          >
            <h2 className="text-[20px] font-bold text-[#1D1D1F] mb-4">肌群</h2>

            <div className="grid grid-cols-2 gap-[10px]">
              {activeMuscleGroups.map((g) => (
                <div
                  key={g.id}
                  className="bg-[#F5F5F7] rounded-[10px] h-[76px] flex flex-col items-center justify-center"
                >
                  <span className="text-[12px] text-[#86868B]">{g.name}</span>
                  <span className="text-[20px] font-bold text-[#1D1D1F] mt-0.5">
                    {muscleGroupCounts.get(g.id) ?? 0}
                    <span className="text-[14px] font-normal text-[#86868B]">次</span>
                  </span>
                </div>
              ))}
            </div>
          </motion.div>
        )}

        {/* ─── Recent Training Card ─── */}
        {recentGroups.length > 0 && (
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1, duration: 0.35, ease: [0.32, 0.72, 0, 1] }}
            className="bg-white rounded-[10px] border border-[#EBEBEB] p-5"
          >
            <h2 className="text-[20px] font-bold text-[#1D1D1F] mb-4">最近训练</h2>

            {recentGroups.map((group) => (
              <div key={group.date} className="mb-4 last:mb-0">
                <span className="text-[13px] text-[#86868B] block mb-1">
                  {formatDateGroup(group.date)}
                </span>

                {group.sessions.flatMap((session) =>
                  session.exercises.map((ex, ei) => {
                    const totalSets = ex.sets.length;
                    const avgWeight =
                      totalSets > 0
                        ? ex.sets.reduce((s, set) => s + set.weight, 0) / totalSets
                        : 0;
                    const avgRpe =
                      totalSets > 0
                        ? ex.sets.reduce((s, set) => s + set.rpe, 0) / totalSets
                        : 0;
                    const isExpanded = expandedSession === session.id;
                    const dotColor = DOT_COLORS[ei % DOT_COLORS.length];

                    return (
                      <div key={`${session.id}-${ei}`}>
                        <div
                          className="flex items-center gap-3 py-3 cursor-pointer select-none"
                          style={{
                            borderTop: ei > 0 ? "none" : "none",
                            borderBottom:
                              ei < session.exercises.length - 1
                                ? "0.5px solid #EBEBEB"
                                : "none",
                          }}
                          onClick={() =>
                            setExpandedSession(isExpanded ? null : session.id)
                          }
                        >
                          <div
                            className="w-[8px] h-[8px] rounded-full shrink-0"
                            style={{ backgroundColor: dotColor }}
                          />
                          <div className="flex-1 min-w-0">
                            <div className="text-[16px] font-semibold text-[#1D1D1F] truncate">
                              {ex.exerciseName}
                            </div>
                            <div className="text-[15px] text-[#86868B] mt-0.5">
                              {totalSets}组 ×{" "}
                              {avgWeight === 0
                                ? "自重"
                                : `${fmtAvg(avgWeight)}kg`}{" "}
                              · RPE {fmtAvg(avgRpe)}
                            </div>
                          </div>
                        </div>

                        {/* Expanded detail */}
                        <AnimatePresence>
                          {isExpanded && (
                            <motion.div
                              initial={{ height: 0, opacity: 0 }}
                              animate={{ height: "auto", opacity: 1 }}
                              exit={{ height: 0, opacity: 0 }}
                              transition={{ duration: 0.2 }}
                              className="overflow-hidden"
                            >
                              <div className="rounded-[10px] bg-[#F5F5F7] p-3 mb-2">
                                {ex.sets.map((set, si) => (
                                  <div
                                    key={set.id}
                                    className="flex items-center gap-1.5 text-[13px] text-[#86868B] py-0.5"
                                  >
                                    <span className="text-[#1D1D1F] font-medium">
                                      第{si + 1}组
                                    </span>
                                    <span>·</span>
                                    <span>
                                      {set.weight > 0
                                        ? `${set.weight}kg`
                                        : "自重"}{" "}
                                      × {set.reps}次
                                    </span>
                                    <span>·</span>
                                    <span>RPE {set.rpe}</span>
                                  </div>
                                ))}
                                <button
                                  type="button"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    handleDelete(session.id);
                                  }}
                                  className="mt-2 flex items-center gap-1.5 text-[13px] text-[#86868B]"
                                >
                                  <Trash2 className="w-4 h-4" />
                                  删除此记录
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
            ))}
          </motion.div>
        )}

        {/* ─── Dashed Guide Box (always visible) ─── */}
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.15, duration: 0.35, ease: [0.32, 0.72, 0, 1] }}
          className="border-[1.5px] border-dashed border-[#D2D2D7] rounded-[10px] h-[104px] flex flex-col items-center justify-center"
        >
          <span className="text-[14px] text-[#AEAEB2]">
            点击右上角「记录训练」开始
          </span>
          <span className="text-[13px] text-[#AEAEB2] mt-1">
            记录动作 · 组数 · 重量 · RPE
          </span>
        </motion.div>
      </div>

      {/* ─── Recording Bottom Sheet ─── */}
      <AnimatePresence>
        {showRecord && (
          <>
            {/* Backdrop */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 bg-black/30 z-40"
              onClick={() => setShowRecord(false)}
            />
            {/* Sheet */}
            <motion.div
              initial={{ y: "100%" }}
              animate={{ y: 0 }}
              exit={{ y: "100%" }}
              transition={{ type: "spring", stiffness: 400, damping: 40 }}
              className="fixed bottom-0 left-0 right-0 z-50 bg-white rounded-t-[20px] px-5 pt-6 pb-10 max-h-[85vh] overflow-y-auto"
              style={{ maxWidth: 430, margin: "0 auto" }}
            >
              <div className="w-9 h-1 rounded-full bg-[#D2D2D7] mx-auto mb-5" />
              <h3 className="text-[18px] font-bold text-[#1D1D1F] mb-5">记录训练</h3>

              {/* Exercise name */}
              <label className="text-[13px] text-[#86868B] mb-1.5 block">动作名称</label>
              <div className="relative">
                <input
                  ref={nameInputRef}
                  type="text"
                  placeholder="卧推、深蹲、硬拉…"
                  value={exerciseName}
                  onChange={(e) => setExerciseName(e.target.value)}
                  className="w-full h-11 px-4 rounded-[10px] border border-[#EBEBEB] text-[16px] text-[#1D1D1F] bg-[#F5F5F7] outline-none focus:border-[#5865F2] mb-1"
                />
                {/* Suggestions */}
                {suggestions.length > 0 && (
                  <div className="absolute top-full left-0 right-0 bg-white border border-[#EBEBEB] rounded-[10px] overflow-hidden z-10 shadow-lg">
                    {suggestions.map((s) => (
                      <button
                        key={s}
                        type="button"
                        className="w-full text-left px-4 py-2.5 text-[15px] text-[#1D1D1F] hover:bg-[#F5F5F7]"
                        onClick={() => {
                          setExerciseName(s);
                        }}
                      >
                        {s}
                      </button>
                    ))}
                  </div>
                )}
              </div>

              {/* Sets stepper */}
              <div className="mt-4">
                <label className="text-[13px] text-[#86868B] mb-1.5 block">组数</label>
                <div className="flex items-center gap-4">
                  <button
                    type="button"
                    onClick={() => setSets(clamp(sets - 1, 1, 20))}
                    className="w-8 h-8 rounded-full border-2 border-[#5865F2] bg-white flex items-center justify-center shrink-0"
                  >
                    <Minus className="w-4 h-4 text-[#5865F2]" />
                  </button>
                  <span className="flex-1 text-center text-[24px] font-bold text-[#1D1D1F] tabular-nums">
                    {sets}
                  </span>
                  <button
                    type="button"
                    onClick={() => setSets(clamp(sets + 1, 1, 20))}
                    className="w-8 h-8 rounded-full border-2 border-[#5865F2] bg-white flex items-center justify-center shrink-0"
                  >
                    <Plus className="w-4 h-4 text-[#5865F2]" />
                  </button>
                </div>
              </div>

              {/* Reps stepper */}
              <div className="mt-4">
                <label className="text-[13px] text-[#86868B] mb-1.5 block">次数</label>
                <div className="flex items-center gap-4">
                  <button
                    type="button"
                    onClick={() => setReps(clamp(reps - 1, 1, 100))}
                    className="w-8 h-8 rounded-full border-2 border-[#5865F2] bg-white flex items-center justify-center shrink-0"
                  >
                    <Minus className="w-4 h-4 text-[#5865F2]" />
                  </button>
                  <span className="flex-1 text-center text-[24px] font-bold text-[#1D1D1F] tabular-nums">
                    {reps}
                  </span>
                  <button
                    type="button"
                    onClick={() => setReps(clamp(reps + 1, 1, 100))}
                    className="w-8 h-8 rounded-full border-2 border-[#5865F2] bg-white flex items-center justify-center shrink-0"
                  >
                    <Plus className="w-4 h-4 text-[#5865F2]" />
                  </button>
                </div>
              </div>

              {/* Weight stepper */}
              <div className="mt-4">
                <label className="text-[13px] text-[#86868B] mb-1.5 block">重量 (kg)</label>
                <div className="flex items-center gap-4">
                  <button
                    type="button"
                    onClick={() => setWeight(clamp(+(weight - 2.5).toFixed(1), 0, 500))}
                    className="w-8 h-8 rounded-full border-2 border-[#5865F2] bg-white flex items-center justify-center shrink-0"
                  >
                    <Minus className="w-4 h-4 text-[#5865F2]" />
                  </button>
                  <span className="flex-1 text-center text-[24px] font-bold text-[#1D1D1F] tabular-nums">
                    {weight}
                  </span>
                  <button
                    type="button"
                    onClick={() => setWeight(clamp(+(weight + 2.5).toFixed(1), 0, 500))}
                    className="w-8 h-8 rounded-full border-2 border-[#5865F2] bg-white flex items-center justify-center shrink-0"
                  >
                    <Plus className="w-4 h-4 text-[#5865F2]" />
                  </button>
                </div>
              </div>

              {/* RPE pills */}
              <div className="mt-4">
                <label className="text-[13px] text-[#86868B] mb-1.5 block">RPE</label>
                <div className="flex gap-2">
                  {RPE_OPTIONS.map((val) => (
                    <button
                      key={val}
                      type="button"
                      onClick={() => setRpe(val)}
                      className={`flex-1 h-9 rounded-full text-[13px] font-medium transition-colors ${
                        rpe === val
                          ? "bg-[#EEF0FF] text-[#5865F2]"
                          : "bg-[#F5F5F7] text-[#86868B]"
                      }`}
                    >
                      {val}
                    </button>
                  ))}
                </div>
              </div>

              {/* Save button */}
              <button
                type="button"
                onClick={handleSubmit}
                disabled={submitting || !exerciseName.trim()}
                className="w-full h-11 rounded-full bg-[#5865F2] text-white text-[16px] font-medium mt-6 disabled:opacity-50"
              >
                {submitting ? "记录中…" : "保存"}
              </button>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  );
}
