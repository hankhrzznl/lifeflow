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

const RPE_OPTIONS = [6, 7, 8, 9, 10] as const;

const QUICK_EXERCISES = [
  { name: "杠铃卧推", tags: "胸部 · 推类", icon: Dumbbell },
  { name: "杠铃深蹲", tags: "腿部 · 蹲类", icon: Dumbbell },
  { name: "杠铃硬拉", tags: "背部 · 拉类", icon: Dumbbell },
  { name: "引体向上", tags: "背部 · 自重", icon: RotateCw },
  { name: "农夫行走", tags: "核心 · 握力", icon: Dumbbell },
  { name: "爆发训练", tags: "爆发力 · 速度", icon: Zap },
] as const;

/* ────────── Component ────────── */

export default function FitnessPage() {
  const router = useRouter();

  const {
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

  /* ─── Recent records ─── */

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

  /* ─── Top exercises this week (for action cards) ─── */

  const topExercises = useMemo(() => {
    const weekSessions = workoutSessions.filter((s) => isDateInWeek(s.date));
    const nameCount = new Map<string, number>();
    for (const s of weekSessions) {
      for (const ex of s.exercises) {
        nameCount.set(ex.exerciseName, (nameCount.get(ex.exerciseName) || 0) + 1);
      }
    }
    return [...nameCount.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, 4)
      .map(([name]) => name);
  }, [workoutSessions]);

  /* ─── Format date ─── */

  const formatDateGroup = (dateStr: string) => {
    const d = new Date(dateStr + "T00:00:00");
    const weeks = ["日", "一", "二", "三", "四", "五", "六"];
    return `${d.getMonth() + 1}月${d.getDate()}日 周${weeks[d.getDay()]}`;
  };

  /* ─── Submit record ─── */

  const handleSubmit = useCallback(async () => {
    if (!exerciseName.trim()) return;
    setSubmitting(true);
    try {
      const exId = crypto.randomUUID();
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
  }, [exerciseName, sets, reps, weight, rpe, addWorkoutSessionV2]);

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

  const openRecordForExercise = useCallback((name: string) => {
    setExerciseName(name);
    setSets(3);
    setReps(10);
    setWeight(20);
    setRpe(7);
    setShowRecord(true);
  }, []);

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

        {/* ─── Quick Exercise Cards ─── */}
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1, duration: 0.35, ease: [0.32, 0.72, 0, 1] }}
        >
          <h2 className="mb-3 px-1 text-[17px] font-semibold" style={{ color: "var(--color-text-primary)" }}>常用动作</h2>
          <div className="flex flex-col" style={{ gap: 12 }}>
            {QUICK_EXERCISES.map((card) => {
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
                      onClick={() => openRecordForExercise(card.name)}
                      className="inline-flex items-center rounded-lg px-3 py-1.5 text-[13px] font-medium transition-opacity hover:opacity-90"
                      style={{ background: "var(--lifeflow-brand-50)", color: "var(--lifeflow-primary)" }}
                    >
                      <Plus className="h-3.5 w-3.5 mr-1" />
                      记录
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </motion.div>

        {/* ─── Top exercises this week ─── */}
        {topExercises.length > 0 && (
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.12, duration: 0.35, ease: [0.32, 0.72, 0, 1] }}
            className="p-5"
            style={{ background: "var(--color-surface-card)", borderRadius: "20px", boxShadow: "var(--shadow-card)" }}
          >
            <h2 className="text-[17px] font-semibold mb-4" style={{ color: "var(--color-text-primary)" }}>本周热门动作</h2>
            <div className="grid grid-cols-2 gap-[10px]">
              {topExercises.map((name, i) => (
                <div
                  key={name}
                  className="rounded-[12px] h-[76px] flex flex-col items-center justify-center cursor-pointer active:opacity-70"
                  style={{ background: "var(--lifeflow-muted)" }}
                  onClick={() => openRecordForExercise(name)}
                >
                  <span className="text-[12px]" style={{ color: "var(--color-text-secondary)" }}>{name}</span>
                  <span className="text-[13px] font-medium mt-1" style={{ color: "var(--lifeflow-primary)" }}>
                    + 再练一次
                  </span>
                </div>
              ))}
            </div>
          </motion.div>
        )}

        {/* ─── Week Stats Card ─── */}
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.14, duration: 0.35, ease: [0.32, 0.72, 0, 1] }}
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
            ].map((stat) => (
              <div key={stat.label} className="flex flex-col items-center flex-1">
                <span className="text-[24px] font-bold tabular-nums leading-none" style={{ color: "var(--color-text-primary)" }}>
                  {stat.value}
                </span>
                <span className="text-[12px] mt-1" style={{ color: "var(--color-text-secondary)" }}>{stat.label}</span>
              </div>
            ))}
          </div>
        </motion.div>

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
                <div className="space-y-2">
                  {group.sessions.map((s) => {
                    const isExpanded = expandedSession === s.id;
                    return (
                      <div
                        key={s.id}
                        className="rounded-xl overflow-hidden"
                        style={{ background: "var(--lifeflow-muted)" }}
                      >
                        <button
                          type="button"
                          className="w-full flex items-center justify-between p-3 text-left"
                          onClick={() => setExpandedSession(isExpanded ? null : s.id!)
                          }
                        >
                          <span className="text-[14px] font-medium" style={{ color: "var(--color-text-primary)" }}>
                            {s.exercises.map((e) => e.exerciseName).join(" · ")}
                          </span>
                          <span className="text-[12px]" style={{ color: "var(--color-text-secondary)" }}>
                            {s.exercises.reduce((t, e) => t + e.sets.length, 0)} 组
                          </span>
                        </button>
                        <AnimatePresence>
                          {isExpanded && (
                            <motion.div
                              initial={{ height: 0, opacity: 0 }}
                              animate={{ height: "auto", opacity: 1 }}
                              exit={{ height: 0, opacity: 0 }}
                              transition={{ duration: 0.2 }}
                              className="overflow-hidden"
                            >
                              <div className="px-3 pb-3 space-y-2">
                                {s.exercises.map((ex, ei) => (
                                  <div key={ei}>
                                    <span className="text-[13px] font-medium" style={{ color: "var(--color-text-primary)" }}>
                                      {ex.exerciseName}
                                    </span>
                                    <div className="mt-1 flex flex-wrap gap-1.5">
                                      {ex.sets.map((set, si) => (
                                        <span
                                          key={si}
                                          className="inline-flex items-center px-2 py-0.5 rounded-md text-[11px]"
                                          style={{ background: "var(--color-surface-card)", color: "var(--color-text-secondary)" }}
                                        >
                                          {set.reps}×{set.weight}kg RPE{set.rpe}
                                        </span>
                                      ))}
                                    </div>
                                  </div>
                                ))}
                                <button
                                  type="button"
                                  onClick={() => handleDelete(s.id!)}
                                  className="inline-flex items-center gap-1 text-[12px] mt-1 active:opacity-70"
                                  style={{ color: "var(--color-expense)" }}
                                >
                                  <Trash2 className="w-3 h-3" />删除
                                </button>
                              </div>
                            </motion.div>
                          )}
                        </AnimatePresence>
                      </div>
                    );
                  })}
                </div>
              </div>
            ))}
          </motion.div>
        )}

        {recentGroups.length === 0 && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="text-center py-12"
          >
            <div className="w-16 h-16 rounded-2xl flex items-center justify-center mx-auto mb-4" style={{ background: "var(--lifeflow-brand-50)" }}>
              <Dumbbell className="w-8 h-8" style={{ color: "var(--lifeflow-muted-foreground)" }} />
            </div>
            <p className="text-[15px] font-medium" style={{ color: "var(--color-text-primary)" }}>还没有训练记录</p>
            <p className="text-[13px] mt-1" style={{ color: "var(--color-text-secondary)" }}>点击「记录训练」开始记录吧</p>
          </motion.div>
        )}
      </div>

      {/* ─── Record Bottom Sheet ─── */}
      <AnimatePresence>
        {showRecord && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 z-50"
              style={{ background: "rgba(0,0,0,0.3)" }}
              onClick={() => setShowRecord(false)}
            />
            <motion.div
              initial={{ y: "100%" }}
              animate={{ y: 0 }}
              exit={{ y: "100%" }}
              transition={{ type: "spring", damping: 28, stiffness: 300 }}
              className="fixed bottom-0 left-0 right-0 z-50 rounded-t-[24px] px-5 pt-5 pb-8"
              style={{ background: "var(--color-surface-card)", maxHeight: "85vh", overflowY: "auto" }}
            >
              <div className="flex items-center justify-between mb-5">
                <h2 className="text-[17px] font-semibold" style={{ color: "var(--color-text-primary)" }}>记录训练</h2>
                <button onClick={() => setShowRecord(false)} className="text-[15px] font-medium" style={{ color: "var(--lifeflow-primary)" }}>取消</button>
              </div>

              {/* Exercise Name */}
              <div className="mb-5">
                <label className="text-[13px] font-medium mb-1.5 block" style={{ color: "var(--color-text-secondary)" }}>动作名称</label>
                <input
                  ref={nameInputRef}
                  type="text"
                  value={exerciseName}
                  onChange={(e) => setExerciseName(e.target.value)}
                  placeholder="输入动作名，如：杠铃卧推"
                  className="w-full h-11 px-4 rounded-xl text-[15px] outline-none"
                  style={{ background: "var(--lifeflow-muted)", color: "var(--color-text-primary)", border: "1px solid transparent" }}
                  autoFocus
                />
              </div>

              {/* Sets / Reps / Weight */}
              <div className="grid grid-cols-3 gap-3 mb-5">
                {[
                  { label: "组数", value: sets, min: 1, max: 20, set: setSets },
                  { label: "次数", value: reps, min: 1, max: 50, set: setReps },
                  { label: "重量(kg)", value: weight, min: 0, max: 500, set: setWeight },
                ].map((field) => (
                  <div key={field.label}>
                    <label className="text-[13px] font-medium mb-1.5 block" style={{ color: "var(--color-text-secondary)" }}>{field.label}</label>
                    <div className="flex items-center rounded-xl overflow-hidden" style={{ background: "var(--lifeflow-muted)" }}>
                      <button
                        onClick={() => field.set(clamp(field.value - (field.label === "重量(kg)" ? 5 : 1), field.min, field.max))}
                        className="w-9 h-9 flex items-center justify-center active:opacity-60"
                      >
                        <Minus className="w-4 h-4" style={{ color: "var(--color-text-secondary)" }} />
                      </button>
                      <span className="flex-1 text-center text-[15px] font-semibold" style={{ color: "var(--color-text-primary)" }}>
                        {field.value}
                      </span>
                      <button
                        onClick={() => field.set(clamp(field.value + (field.label === "重量(kg)" ? 5 : 1), field.min, field.max))}
                        className="w-9 h-9 flex items-center justify-center active:opacity-60"
                      >
                        <Plus className="w-4 h-4" style={{ color: "var(--color-text-secondary)" }} />
                      </button>
                    </div>
                  </div>
                ))}
              </div>

              {/* RPE */}
              <div className="mb-6">
                <label className="text-[13px] font-medium mb-1.5 block" style={{ color: "var(--color-text-secondary)" }}>RPE（自觉强度 1-10）</label>
                <div className="flex gap-2">
                  {RPE_OPTIONS.map((r) => (
                    <button
                      key={r}
                      onClick={() => setRpe(r)}
                      className="flex-1 h-10 rounded-xl text-[14px] font-medium transition-colors"
                      style={{
                        background: rpe === r ? "var(--lifeflow-primary)" : "var(--lifeflow-muted)",
                        color: rpe === r ? "#fff" : "var(--color-text-secondary)",
                      }}
                    >
                      {r}
                    </button>
                  ))}
                </div>
              </div>

              {/* Submit */}
              <button
                onClick={handleSubmit}
                disabled={submitting || !exerciseName.trim()}
                className="w-full py-3.5 rounded-full text-white text-base font-semibold tracking-[-0.018em] active:opacity-90 transition-opacity disabled:opacity-50"
                style={{ background: "var(--lifeflow-primary)" }}
              >
                {submitting ? "记录中..." : "保存记录"}
              </button>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  );
}
