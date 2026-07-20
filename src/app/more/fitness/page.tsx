"use client";

import { useState, useEffect, useMemo, useCallback, useRef } from "react";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { ChevronLeft, Minus, Plus, Trash2, Dumbbell, RotateCw, Zap } from "lucide-react";
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

const DOT_COLORS = ["#D97706", "#2563EB", "#E11D48", "#059669"];

const RPE_OPTIONS = [6, 7, 8, 9, 10] as const;

const EXERCISE_CARDS = [
  {
    name: "农夫行走",
    tags: "核心 · 握力 · 全身",
    icon: Dumbbell,
  },
  {
    name: "负重旋转",
    tags: "核心 · 抗旋 · 稳定性",
    icon: RotateCw,
  },
  {
    name: "爆发",
    tags: "爆发力 · 速度 · 垂直跳",
    icon: Zap,
  },
] as const;

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

  /* ─── Today stats ─── */

  const todayStats = useMemo(() => {
    const today = localTodayStr();
    const todaySessions = workoutSessions.filter((s) => s.date === today);
    const exerciseNames = new Set<string>();
    let totalWeight = 0;
    let totalRpe = 0;
    let rpeCount = 0;

    for (const s of todaySessions) {
      for (const ex of s.exercises) {
        exerciseNames.add(ex.exerciseName);
        for (const set of ex.sets) {
          totalWeight += set.weight * set.reps;
          totalRpe += set.rpe;
          rpeCount++;
        }
      }
    }

    return {
      exerciseCount: exerciseNames.size,
      totalWeight,
      avgRpe: rpeCount > 0 ? +(totalRpe / rpeCount).toFixed(1) : 0,
      totalSets: todaySessions.reduce((s, sess) => s + sess.exercises.reduce((t, e) => t + e.sets.length, 0), 0),
    };
  }, [workoutSessions]);

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
      <div className="min-h-screen" style={{ background: "var(--lifeflow-background)" }}>
        <header className="flex items-center gap-3 px-4 py-3" style={{ background: "var(--lifeflow-background)" }}>
          <div className="inline-flex h-8 w-8 items-center justify-center rounded-lg" style={{ background: "var(--color-surface-card)", border: "1px solid var(--lifeflow-border)" }} />
        </header>
        <div className="px-4 pt-1 pb-10 space-y-4">
          {[1, 2, 3].map((i) => (
            <div key={i} className="animate-pulse p-5" style={{ background: "var(--color-surface-card)", borderRadius: "20px", boxShadow: "var(--shadow-card)" }}>
              <div className="h-6 w-1/4 rounded" style={{ background: "var(--lifeflow-muted)" }} />
              <div className="h-10 w-2/3 mt-3 rounded" style={{ background: "var(--lifeflow-muted)" }} />
            </div>
          ))}
        </div>
      </div>
    );
  }

  /* ────────── Render ────────── */

  return (
    <div className="min-h-screen pb-10" style={{ background: "var(--lifeflow-background)" }}>
      {/* ─── Header ─── */}
      <header className="flex items-center gap-3 px-4 py-3" style={{ background: "var(--lifeflow-background)" }}>
        <button
          onClick={() => router.push("/more")}
          className="inline-flex h-8 w-8 items-center justify-center rounded-lg shrink-0"
          style={{ background: "var(--color-surface-card)", border: "1px solid var(--lifeflow-border)" }}
          aria-label="返回"
        >
          <ChevronLeft className="h-5 w-5" style={{ color: "var(--color-text-primary)" }} />
        </button>
        <h1 className="text-[17px] font-semibold tracking-[-0.018em] truncate" style={{ color: "var(--color-text-primary)" }}>
          训练
        </h1>
      </header>

      <div className="px-4 pt-4 pb-10 space-y-4">
        {/* ─── Today Summary Card ─── */}
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.35, ease: [0.32, 0.72, 0, 1] }}
          className="p-5"
          style={{ background: "var(--color-surface-card)", borderRadius: "20px", boxShadow: "var(--shadow-card)" }}
        >
          <p className="text-center mb-4 text-[17px] font-semibold" style={{ color: "var(--color-text-primary)" }}>
            今日训练 · {todayStats.totalSets} 组
          </p>
          <div className="flex items-center justify-center" style={{ gap: 24 }}>
            <div className="flex flex-col items-center flex-1" style={{ minWidth: 0 }}>
              <span className="text-[20px] font-bold tracking-[-0.018em]" style={{ color: "var(--color-text-primary)" }}>
                {todayStats.exerciseCount}
              </span>
              <span className="text-[13px] font-medium truncate" style={{ color: "var(--color-text-secondary)", letterSpacing: "-0.01em" }}>动作</span>
            </div>
            <div style={{ width: 1, height: 32, background: "var(--lifeflow-border)", flexShrink: 0 }} />
            <div className="flex flex-col items-center flex-1" style={{ minWidth: 0 }}>
              <span className="text-[20px] font-bold tracking-[-0.018em]" style={{ color: "var(--color-text-primary)" }}>
                {todayStats.totalWeight}<span style={{ fontSize: 14, fontWeight: 500 }}>kg</span>
              </span>
              <span className="text-[13px] font-medium truncate" style={{ color: "var(--color-text-secondary)", letterSpacing: "-0.01em" }}>总负重</span>
            </div>
            <div style={{ width: 1, height: 32, background: "var(--lifeflow-border)", flexShrink: 0 }} />
            <div className="flex flex-col items-center flex-1" style={{ minWidth: 0 }}>
              <span className="text-[20px] font-bold tracking-[-0.018em]" style={{ color: "var(--color-text-primary)" }}>
                {todayStats.avgRpe || 0}
              </span>
              <span className="text-[13px] font-medium truncate" style={{ color: "var(--color-text-secondary)", letterSpacing: "-0.01em" }}>RPE 均</span>
            </div>
          </div>
        </motion.div>

        {/* ─── Record Training Button ─── */}
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.05, duration: 0.35, ease: [0.32, 0.72, 0, 1] }}
        >
          <button
            type="button"
            onClick={openRecordSheet}
            className="w-full py-3.5 rounded-full text-white text-base font-semibold tracking-[-0.018em] active:opacity-90 transition-opacity"
            style={{ background: "var(--lifeflow-primary)" }}
          >
            记录训练
          </button>
        </motion.div>

        {/* ─── Three Exercise Categories ─── */}
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1, duration: 0.35, ease: [0.32, 0.72, 0, 1] }}
        >
          <h2 className="mb-3 px-1 text-[17px] font-semibold" style={{ color: "var(--color-text-primary)" }}>三大项训练</h2>
          <div className="flex flex-col" style={{ gap: 12 }}>
            {EXERCISE_CARDS.map((card) => {
              const Icon = card.icon;
              return (
                <div
                  key={card.name}
                  className="p-4"
                  style={{ background: "var(--color-surface-card)", borderRadius: "20px", boxShadow: "var(--shadow-card)" }}
                >
                  <div className="flex items-start justify-between mb-3">
                    <div className="flex items-center gap-3 min-w-0 flex-1">
                      <div className="flex-shrink-0 flex h-10 w-10 items-center justify-center rounded-xl" style={{ background: "var(--lifeflow-brand-50)" }}>
                        <Icon className="h-5 w-5" style={{ color: "var(--lifeflow-primary)" }} />
                      </div>
                      <div className="min-w-0">
                        <p className="truncate text-[16px] font-semibold" style={{ color: "var(--color-text-primary)" }}>{card.name}</p>
                        <p className="truncate text-[13px]" style={{ color: "var(--color-text-secondary)" }}>{card.tags}</p>
                      </div>
                    </div>
                    <span className="flex-shrink-0 text-[13px] font-medium whitespace-nowrap" style={{ color: "var(--color-text-secondary)" }}>最佳: —</span>
                  </div>
                  <div className="flex justify-end">
                    <button
                      type="button"
                      onClick={openRecordSheet}
                      className="inline-flex items-center rounded-lg px-3 py-1.5 text-[13px] font-medium transition-opacity hover:opacity-90"
                      style={{ background: "var(--lifeflow-brand-50)", color: "var(--lifeflow-primary)" }}
                    >
                      <Plus className="h-3.5 w-3.5 mr-1" />
                      记录训练
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </motion.div>

        {/* ─── Week Stats Card ─── */}
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.12, duration: 0.35, ease: [0.32, 0.72, 0, 1] }}
          className="p-5"
          style={{ background: "var(--color-surface-card)", borderRadius: "20px", boxShadow: "var(--shadow-card)" }}
        >
          <div className="flex items-center justify-between">
            <h2 className="text-[17px] font-semibold" style={{ color: "var(--color-text-primary)" }}>本周</h2>
            <span className="text-[13px]" style={{ color: "var(--color-text-secondary)" }}>{weekRange}</span>
          </div>

          <div className="mt-4 flex">
            {[
              { label: "训练天数", value: weekStats.days, unit: "天" },
              { label: "总组数", value: weekStats.totalSets, unit: "组" },
              { label: "动作数", value: weekStats.totalExercises, unit: "个" },
            ].map((stat, i) => (
              <div key={stat.label} className="flex flex-col items-center flex-1">
                <span className="text-[24px] font-bold tabular-nums leading-none" style={{ color: "var(--color-text-primary)" }}>
                  {stat.value}
                </span>
                <span className="text-[12px] mt-1" style={{ color: "var(--color-text-secondary)" }}>{stat.label}</span>
              </div>
            ))}
          </div>
        </motion.div>

        {/* ─── Muscle Groups Card ─── */}
        {activeMuscleGroups.length > 0 && (
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.14, duration: 0.35, ease: [0.32, 0.72, 0, 1] }}
            className="p-5"
            style={{ background: "var(--color-surface-card)", borderRadius: "20px", boxShadow: "var(--shadow-card)" }}
          >
            <h2 className="text-[17px] font-semibold mb-4" style={{ color: "var(--color-text-primary)" }}>肌群</h2>

            <div className="grid grid-cols-2 gap-[10px]">
              {activeMuscleGroups.map((g) => (
                <div
                  key={g.id}
                  className="rounded-[12px] h-[76px] flex flex-col items-center justify-center"
                  style={{ background: "var(--lifeflow-muted)" }}
                >
                  <span className="text-[12px]" style={{ color: "var(--color-text-secondary)" }}>{g.name}</span>
                  <span className="text-[20px] font-bold mt-0.5" style={{ color: "var(--color-text-primary)" }}>
                    {muscleGroupCounts.get(g.id) ?? 0}
                    <span className="text-[14px] font-normal" style={{ color: "var(--color-text-secondary)" }}>次</span>
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
            transition={{ delay: 0.16, duration: 0.35, ease: [0.32, 0.72, 0, 1] }}
            className="p-5"
            style={{ background: "var(--color-surface-card)", borderRadius: "20px", boxShadow: "var(--shadow-card)" }}
          >
            <h2 className="text-[17px] font-semibold mb-4" style={{ color: "var(--color-text-primary)" }}>最近训练</h2>

            {recentGroups.map((group) => (
              <div key={group.date} className="mb-4 last:mb-0">
                <span className="text-[13px] block mb-1" style={{ color: "var(--color-text-secondary)" }}>
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
                            borderBottom:
                              ei < session.exercises.length - 1
                                ? "0.5px solid var(--lifeflow-border)"
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
                            <div className="text-[16px] font-semibold truncate" style={{ color: "var(--color-text-primary)" }}>
                              {ex.exerciseName}
                            </div>
                            <div className="text-[15px] mt-0.5" style={{ color: "var(--color-text-secondary)" }}>
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
                              <div className="rounded-[12px] p-3 mb-2" style={{ background: "var(--lifeflow-muted)" }}>
                                {ex.sets.map((set, si) => (
                                  <div
                                    key={set.id}
                                    className="flex items-center gap-1.5 text-[13px] py-0.5"
                                    style={{ color: "var(--color-text-secondary)" }}
                                  >
                                    <span style={{ color: "var(--color-text-primary)", fontWeight: 500 }}>
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
                                  className="mt-2 flex items-center gap-1.5 text-[13px]"
                                  style={{ color: "var(--color-text-secondary)" }}
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

        {/* ─── Empty state guide ─── */}
        {workoutSessions.length === 0 && (
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1, duration: 0.35, ease: [0.32, 0.72, 0, 1] }}
            className="border-[1.5px] border-dashed rounded-[20px] h-[104px] flex flex-col items-center justify-center"
            style={{ borderColor: "var(--color-text-disabled)" }}
          >
            <span className="text-[14px]" style={{ color: "var(--color-text-disabled)" }}>
              点击「记录训练」开始
            </span>
            <span className="text-[13px] mt-1" style={{ color: "var(--color-text-disabled)" }}>
              记录动作 · 组数 · 重量 · RPE
            </span>
          </motion.div>
        )}
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
              className="fixed bottom-0 left-0 right-0 z-50 rounded-t-[20px] px-5 pt-6 pb-10 max-h-[85vh] overflow-y-auto"
              style={{ maxWidth: 430, margin: "0 auto", background: "var(--color-surface-card)" }}
            >
              <div className="w-9 h-1 rounded-full mx-auto mb-5" style={{ background: "var(--lifeflow-muted)" }} />
              <h3 className="text-[17px] font-semibold mb-5" style={{ color: "var(--color-text-primary)" }}>记录训练</h3>

              {/* Exercise name */}
              <label className="text-[13px] mb-1.5 block" style={{ color: "var(--color-text-secondary)" }}>动作名称</label>
              <div className="relative">
                <input
                  ref={nameInputRef}
                  type="text"
                  placeholder="卧推、深蹲、硬拉…"
                  value={exerciseName}
                  onChange={(e) => setExerciseName(e.target.value)}
                  className="w-full h-11 px-4 rounded-[12px] text-[16px] outline-none mb-1 transition-colors"
                  style={{
                    border: "1px solid var(--lifeflow-border)",
                    color: "var(--color-text-primary)",
                    background: "var(--lifeflow-input)",
                  }}
                />
                {/* Suggestions */}
                {suggestions.length > 0 && (
                  <div
                    className="absolute top-full left-0 right-0 rounded-[12px] overflow-hidden z-10 shadow-lg"
                    style={{ background: "var(--color-surface-card)", border: "1px solid var(--lifeflow-border)" }}
                  >
                    {suggestions.map((s) => (
                      <button
                        key={s}
                        type="button"
                        className="w-full text-left px-4 py-2.5 text-[15px] hover:opacity-80"
                        style={{ color: "var(--color-text-primary)" }}
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
                <label className="text-[13px] mb-1.5 block" style={{ color: "var(--color-text-secondary)" }}>组数</label>
                <div className="flex items-center gap-4">
                  <button
                    type="button"
                    onClick={() => setSets(clamp(sets - 1, 1, 20))}
                    className="w-8 h-8 rounded-full border-2 flex items-center justify-center shrink-0"
                    style={{ borderColor: "var(--lifeflow-primary)", background: "var(--color-surface-card)" }}
                  >
                    <Minus className="w-4 h-4" style={{ color: "var(--lifeflow-primary)" }} />
                  </button>
                  <span className="flex-1 text-center text-[24px] font-bold tabular-nums" style={{ color: "var(--color-text-primary)" }}>
                    {sets}
                  </span>
                  <button
                    type="button"
                    onClick={() => setSets(clamp(sets + 1, 1, 20))}
                    className="w-8 h-8 rounded-full border-2 flex items-center justify-center shrink-0"
                    style={{ borderColor: "var(--lifeflow-primary)", background: "var(--color-surface-card)" }}
                  >
                    <Plus className="w-4 h-4" style={{ color: "var(--lifeflow-primary)" }} />
                  </button>
                </div>
              </div>

              {/* Reps stepper */}
              <div className="mt-4">
                <label className="text-[13px] mb-1.5 block" style={{ color: "var(--color-text-secondary)" }}>次数</label>
                <div className="flex items-center gap-4">
                  <button
                    type="button"
                    onClick={() => setReps(clamp(reps - 1, 1, 100))}
                    className="w-8 h-8 rounded-full border-2 flex items-center justify-center shrink-0"
                    style={{ borderColor: "var(--lifeflow-primary)", background: "var(--color-surface-card)" }}
                  >
                    <Minus className="w-4 h-4" style={{ color: "var(--lifeflow-primary)" }} />
                  </button>
                  <span className="flex-1 text-center text-[24px] font-bold tabular-nums" style={{ color: "var(--color-text-primary)" }}>
                    {reps}
                  </span>
                  <button
                    type="button"
                    onClick={() => setReps(clamp(reps + 1, 1, 100))}
                    className="w-8 h-8 rounded-full border-2 flex items-center justify-center shrink-0"
                    style={{ borderColor: "var(--lifeflow-primary)", background: "var(--color-surface-card)" }}
                  >
                    <Plus className="w-4 h-4" style={{ color: "var(--lifeflow-primary)" }} />
                  </button>
                </div>
              </div>

              {/* Weight stepper */}
              <div className="mt-4">
                <label className="text-[13px] mb-1.5 block" style={{ color: "var(--color-text-secondary)" }}>重量 (kg)</label>
                <div className="flex items-center gap-4">
                  <button
                    type="button"
                    onClick={() => setWeight(clamp(+(weight - 2.5).toFixed(1), 0, 500))}
                    className="w-8 h-8 rounded-full border-2 flex items-center justify-center shrink-0"
                    style={{ borderColor: "var(--lifeflow-primary)", background: "var(--color-surface-card)" }}
                  >
                    <Minus className="w-4 h-4" style={{ color: "var(--lifeflow-primary)" }} />
                  </button>
                  <span className="flex-1 text-center text-[24px] font-bold tabular-nums" style={{ color: "var(--color-text-primary)" }}>
                    {weight}
                  </span>
                  <button
                    type="button"
                    onClick={() => setWeight(clamp(+(weight + 2.5).toFixed(1), 0, 500))}
                    className="w-8 h-8 rounded-full border-2 flex items-center justify-center shrink-0"
                    style={{ borderColor: "var(--lifeflow-primary)", background: "var(--color-surface-card)" }}
                  >
                    <Plus className="w-4 h-4" style={{ color: "var(--lifeflow-primary)" }} />
                  </button>
                </div>
              </div>

              {/* RPE pills */}
              <div className="mt-4">
                <label className="text-[13px] mb-1.5 block" style={{ color: "var(--color-text-secondary)" }}>RPE</label>
                <div className="flex gap-2">
                  {RPE_OPTIONS.map((val) => (
                    <button
                      key={val}
                      type="button"
                      onClick={() => setRpe(val)}
                      className="flex-1 h-9 rounded-full text-[13px] font-medium transition-colors"
                      style={{
                        background: rpe === val ? "var(--lifeflow-brand-50)" : "var(--lifeflow-muted)",
                        color: rpe === val ? "var(--lifeflow-primary)" : "var(--color-text-secondary)",
                      }}
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
                className="w-full h-11 rounded-full text-white text-[16px] font-medium mt-6 disabled:opacity-50"
                style={{ background: "var(--lifeflow-primary)" }}
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
