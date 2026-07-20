"use client";

import { useState, useEffect, useMemo, useCallback, useRef } from "react";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import { ChevronLeft, Dumbbell, RotateCw, Zap, Plus, Trash2, Star } from "lucide-react";
import { useHealthStore } from "@/lib/store/healthStore";
import type { WorkoutSession } from "@/lib/db/health.db";

// ============================================================
// 训练 — 力量训练记录
// ============================================================

const formatLocalDate = (d: Date) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;

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

// ---- 三大项定义 ----
const BIG_THREE = [
  { key: "农夫行走", icon: Dumbbell, label: "农夫行走", desc: "核心 · 握力 · 全身" },
  { key: "负重旋转", icon: RotateCw, label: "负重旋转", desc: "核心 · 抗旋 · 稳定性" },
  { key: "爆发", icon: Zap, label: "爆发", desc: "爆发力 · 速度 · 垂直跳" },
];

export default function FitnessPage() {
  const router = useRouter();
  const { workoutSessions, loadFitnessDataV2, deleteWorkoutSessionV2, addWorkoutSessionV2 } = useHealthStore();

  const [loading, setLoading] = useState(true);
  const [expandedSession, setExpandedSession] = useState<string | null>(null);

  // ---- Form state ----
  const [exerciseName, setExerciseName] = useState("");
  const [sets, setSets] = useState("");
  const [reps, setReps] = useState("");
  const [weight, setWeight] = useState("");
  const [rpe, setRpe] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const nameInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    loadFitnessDataV2().finally(() => setLoading(false));
  }, [loadFitnessDataV2]);

  // ---- Today stats ----
  const todayStats = useMemo(() => {
    const today = formatLocalDate(new Date());
    const todaySessions = workoutSessions.filter((s) => s.date === today);
    const totalSets = todaySessions.reduce((sum, s) => sum + s.exercises.reduce((t, e) => t + e.sets.length, 0), 0);
    const totalExercises = todaySessions.reduce((sum, s) => sum + s.exercises.length, 0);
    const allSets = todaySessions.flatMap((s) => s.exercises.flatMap((e) => e.sets));
    const totalWeight = allSets.reduce((sum, set) => sum + set.weight * set.reps, 0);
    const avgRpe = allSets.length > 0 ? allSets.reduce((sum, set) => sum + set.rpe, 0) / allSets.length : 0;
    return { totalSets, totalExercises, totalWeight, avgRpe };
  }, [workoutSessions]);

  // ---- Week stats ----
  const weekStats = useMemo(() => {
    const weekSessions = workoutSessions.filter((s) => isDateInWeek(s.date));
    const days = new Set(weekSessions.map((s) => s.date)).size;
    const totalSets = weekSessions.reduce((s, sess) => s + sess.exercises.reduce((t, e) => t + e.sets.length, 0), 0);
    return { days, totalSets };
  }, [workoutSessions]);

  const weekRange = useMemo(() => getWeekRangeStr(), []);

  // ---- Recent groups ----
  const recentGroups = useMemo(() => {
    const sorted = [...workoutSessions]
      .sort((a, b) => b.createdAt - a.createdAt)
      .slice(0, 50);
    const map = new Map<string, WorkoutSession[]>();
    for (const s of sorted) {
      const list = map.get(s.date) || [];
      list.push(s);
      if (list.length === 1) map.set(s.date, list);
    }
    return Array.from(map.entries())
      .sort(([a], [b]) => b.localeCompare(a))
      .slice(0, 10)
      .map(([date, sessions]) => ({ date, sessions }));
  }, [workoutSessions]);

  // ---- 三大项 best records ----
  const bigThreeRecords = useMemo(() => {
    const result: Record<string, { sets: number; reps: number; weight: number; rpe: number } | null> = {
      "农夫行走": null,
      "负重旋转": null,
      "爆发": null,
    };
    for (const s of workoutSessions) {
      for (const ex of s.exercises) {
        const match = BIG_THREE.find((bt) => bt.key === ex.exerciseName);
        if (!match) continue;
        for (const set of ex.sets) {
          const existing = result[match.key];
          if (!existing || set.weight > existing.weight) {
            result[match.key] = { sets: s.exercises.length, reps: set.reps, weight: set.weight, rpe: set.rpe };
          }
        }
      }
    }
    return result;
  }, [workoutSessions]);

  // ---- Submit handler ----
  const handleSubmit = useCallback(async () => {
    if (!exerciseName.trim() || !sets || !reps) return;
    setSubmitting(true);
    try {
      const setCount = parseInt(sets, 10) || 1;
      const repCount = parseInt(reps, 10) || 1;
      const weightVal = parseFloat(weight) || 0;
      const rpeVal = parseInt(rpe, 10) || 0;

      await addWorkoutSessionV2({
        date: formatLocalDate(new Date()),
        exercises: [
          {
            exerciseId: crypto.randomUUID(),
            exerciseName: exerciseName.trim(),
            sets: Array.from({ length: setCount }, (_, i) => ({
              id: crypto.randomUUID(),
              setNumber: i + 1,
              reps: repCount,
              weight: weightVal,
              rpe: rpeVal,
              isPR: false,
            })),
          },
        ],
        notes: "",
      });

      // Reset form
      setExerciseName("");
      setSets("");
      setReps("");
      setWeight("");
      setRpe("");
      nameInputRef.current?.focus();
    } finally {
      setSubmitting(false);
    }
  }, [exerciseName, sets, reps, weight, rpe, addWorkoutSessionV2]);

  const handleDelete = useCallback(
    async (id: string) => {
      await deleteWorkoutSessionV2(id);
      setExpandedSession(null);
    },
    [deleteWorkoutSessionV2]
  );

  const handleBigThreeLog = useCallback(
    async (key: string) => {
      await addWorkoutSessionV2({
        date: formatLocalDate(new Date()),
        exercises: [
          {
            exerciseId: crypto.randomUUID(),
            exerciseName: key,
            sets: [
              {
                id: crypto.randomUUID(),
                setNumber: 1,
                reps: 0,
                weight: 0,
                rpe: 0,
                isPR: false,
              },
            ],
          },
        ],
        notes: "",
      });
    },
    [addWorkoutSessionV2]
  );

  // ---- Format date group ----
  const formatDateGroup = (dateStr: string) => {
    const d = new Date(dateStr + "T00:00:00");
    const weeks = ["日", "一", "二", "三", "四", "五", "六"];
    return `${d.getMonth() + 1}月${d.getDate()}日 周${weeks[d.getDay()]}`;
  };

  // ---- Loading state ----
  if (loading) {
    return (
      <div>
        <div className="flex items-center px-4 h-11">
          <div className="w-8 h-8 rounded-lg" style={{ background: "var(--color-surface-secondary)" }} />
        </div>
        <div className="px-4 pt-3 flex flex-col gap-3">
          {[1, 2].map((i) => (
            <div key={i} className="card-standard p-5 animate-pulse">
              <div className="h-6 w-1/3 rounded" style={{ background: "var(--color-surface-secondary)" }} />
              <div className="h-10 w-2/3 mt-3 rounded" style={{ background: "var(--color-surface-secondary)" }} />
            </div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="px-4 pt-4 pb-10" style={{ paddingBottom: 40 }}>
      {/* Header */}
      <header className="flex items-center gap-3 mb-5">
        <button
          onClick={() => router.push("/more")}
          className="inline-flex h-9 w-9 items-center justify-center rounded-xl border"
          style={{
            borderColor: "var(--lifeflow-border)",
            background: "var(--lifeflow-card)",
          }}
          aria-label="返回"
        >
          <ChevronLeft className="h-5 w-5" style={{ color: "var(--lifeflow-foreground)" }} />
        </button>
        <h1
          className="text-[17px] font-semibold leading-[1.3] tracking-[-0.018em] truncate"
          style={{ color: "var(--lifeflow-foreground)" }}
        >
          训练
        </h1>
      </header>

      {/* Today Summary Card */}
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        className="mb-4 p-5"
        style={{
          background: "var(--lifeflow-card)",
          borderRadius: "var(--lifeflow-radius-medium)",
          boxShadow: "var(--shadow-card)",
        }}
      >
        <p
          className="text-center mb-4"
          style={{ fontSize: 17, fontWeight: 600, color: "var(--lifeflow-foreground)" }}
        >
          今日训练 · {todayStats.totalSets} 组
        </p>
        <div className="flex items-center justify-center" style={{ gap: 24 }}>
          <div className="flex flex-col items-center" style={{ flex: 1, minWidth: 0 }}>
            <span
              className="text-[20px] font-bold tracking-[-0.018em]"
              style={{ color: "var(--lifeflow-foreground)" }}
            >
              {todayStats.totalExercises}
            </span>
            <span
              className="text-[13px] font-medium tracking-[-0.01em]"
              style={{ color: "var(--color-text-secondary)" }}
            >
              动作
            </span>
          </div>
          <div style={{ width: 1, height: 32, background: "var(--lifeflow-border)", flexShrink: 0 }} />
          <div className="flex flex-col items-center" style={{ flex: 1, minWidth: 0 }}>
            <span
              className="text-[20px] font-bold tracking-[-0.018em]"
              style={{ color: "var(--lifeflow-foreground)" }}
            >
              {todayStats.totalWeight}
              <span style={{ fontSize: 14, fontWeight: 500 }}>kg</span>
            </span>
            <span
              className="text-[13px] font-medium tracking-[-0.01em]"
              style={{ color: "var(--color-text-secondary)" }}
            >
              总负重
            </span>
          </div>
          <div style={{ width: 1, height: 32, background: "var(--lifeflow-border)", flexShrink: 0 }} />
          <div className="flex flex-col items-center" style={{ flex: 1, minWidth: 0 }}>
            <span
              className="text-[20px] font-bold tracking-[-0.018em]"
              style={{ color: "var(--lifeflow-foreground)" }}
            >
              {fmtAvg(todayStats.avgRpe)}
            </span>
            <span
              className="text-[13px] font-medium tracking-[-0.01em]"
              style={{ color: "var(--color-text-secondary)" }}
            >
              RPE 均
            </span>
          </div>
        </div>
      </motion.div>

      {/* Exercise Log Form */}
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.03 }}
        className="mb-4 p-5"
        style={{
          background: "var(--lifeflow-card)",
          borderRadius: "var(--lifeflow-radius-medium)",
          boxShadow: "var(--shadow-card)",
        }}
      >
        <h2
          className="mb-4"
          style={{ fontSize: 17, fontWeight: 600, color: "var(--lifeflow-foreground)" }}
        >
          记录训练
        </h2>
        <div className="flex flex-col" style={{ gap: 14 }}>
          {/* 动作名称 */}
          <div className="flex flex-col" style={{ gap: 6 }}>
            <label
              style={{ fontSize: 14, fontWeight: 500, color: "var(--color-text-primary)" }}
            >
              动作名称
            </label>
            <input
              ref={nameInputRef}
              type="text"
              placeholder="卧推、深蹲、硬拉..."
              value={exerciseName}
              onChange={(e) => setExerciseName(e.target.value)}
              className="w-full rounded-xl px-4 py-3 text-base outline-none"
              style={{
                fontSize: 16,
                background: "var(--lifeflow-input)",
                color: "var(--lifeflow-foreground)",
                border: "1.5px solid transparent",
              }}
              onFocus={(e) => (e.target.style.borderColor = "var(--lifeflow-primary)")}
              onBlur={(e) => (e.target.style.borderColor = "transparent")}
            />
          </div>

          {/* 组数 + 次数 */}
          <div className="flex" style={{ gap: 12 }}>
            <div className="flex flex-col flex-1" style={{ gap: 6, minWidth: 0 }}>
              <label style={{ fontSize: 14, fontWeight: 500, color: "var(--color-text-primary)" }}>
                组数
              </label>
              <input
                type="number"
                placeholder="5"
                value={sets}
                onChange={(e) => setSets(e.target.value)}
                className="w-full rounded-xl px-4 py-3 text-base outline-none"
                style={{
                  fontSize: 16,
                  background: "var(--lifeflow-input)",
                  color: "var(--lifeflow-foreground)",
                  border: "1.5px solid transparent",
                }}
                onFocus={(e) => (e.target.style.borderColor = "var(--lifeflow-primary)")}
                onBlur={(e) => (e.target.style.borderColor = "transparent")}
              />
            </div>
            <div className="flex flex-col flex-1" style={{ gap: 6, minWidth: 0 }}>
              <label style={{ fontSize: 14, fontWeight: 500, color: "var(--color-text-primary)" }}>
                次数
              </label>
              <input
                type="number"
                placeholder="10"
                value={reps}
                onChange={(e) => setReps(e.target.value)}
                className="w-full rounded-xl px-4 py-3 text-base outline-none"
                style={{
                  fontSize: 16,
                  background: "var(--lifeflow-input)",
                  color: "var(--lifeflow-foreground)",
                  border: "1.5px solid transparent",
                }}
                onFocus={(e) => (e.target.style.borderColor = "var(--lifeflow-primary)")}
                onBlur={(e) => (e.target.style.borderColor = "transparent")}
              />
            </div>
          </div>

          {/* 重量 + RPE */}
          <div className="flex" style={{ gap: 12 }}>
            <div className="flex flex-col flex-1" style={{ gap: 6, minWidth: 0 }}>
              <label style={{ fontSize: 14, fontWeight: 500, color: "var(--color-text-primary)" }}>
                重量 (kg)
              </label>
              <input
                type="number"
                placeholder="80"
                value={weight}
                onChange={(e) => setWeight(e.target.value)}
                className="w-full rounded-xl px-4 py-3 text-base outline-none"
                style={{
                  fontSize: 16,
                  background: "var(--lifeflow-input)",
                  color: "var(--lifeflow-foreground)",
                  border: "1.5px solid transparent",
                }}
                onFocus={(e) => (e.target.style.borderColor = "var(--lifeflow-primary)")}
                onBlur={(e) => (e.target.style.borderColor = "transparent")}
              />
            </div>
            <div className="flex flex-col flex-1" style={{ gap: 6, minWidth: 0 }}>
              <label style={{ fontSize: 14, fontWeight: 500, color: "var(--color-text-primary)" }}>
                RPE
              </label>
              <input
                type="number"
                min={1}
                max={10}
                placeholder="8"
                value={rpe}
                onChange={(e) => setRpe(e.target.value)}
                className="w-full rounded-xl px-4 py-3 text-base outline-none"
                style={{
                  fontSize: 16,
                  background: "var(--lifeflow-input)",
                  color: "var(--lifeflow-foreground)",
                  border: "1.5px solid transparent",
                }}
                onFocus={(e) => (e.target.style.borderColor = "var(--lifeflow-primary)")}
                onBlur={(e) => (e.target.style.borderColor = "transparent")}
              />
            </div>
          </div>
        </div>

        <button
          type="button"
          onClick={handleSubmit}
          disabled={submitting || !exerciseName.trim() || !sets || !reps}
          className="w-full mt-5 rounded-full py-3.5 text-center text-base font-semibold transition-opacity hover:opacity-90 disabled:opacity-50"
          style={{
            background: "var(--lifeflow-primary)",
            color: "var(--lifeflow-primary-foreground)",
            fontSize: 16,
          }}
        >
          {submitting ? "记录中..." : "记录训练"}
        </button>
      </motion.div>

      {/* 三大项训练 */}
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.06 }}
      >
        <h2
          className="mb-3 px-1"
          style={{ fontSize: 17, fontWeight: 600, color: "var(--lifeflow-foreground)" }}
        >
          三大项训练
        </h2>
        <div className="flex flex-col" style={{ gap: 12 }}>
          {BIG_THREE.map((item) => {
            const best = bigThreeRecords[item.key];
            return (
              <div
                key={item.key}
                className="p-4"
                style={{
                  background: "var(--lifeflow-card)",
                  borderRadius: "var(--lifeflow-radius-medium)",
                  boxShadow: "var(--shadow-card)",
                }}
              >
                <div className="flex items-start justify-between mb-3">
                  <div className="flex items-center gap-3 min-w-0 flex-1">
                    <div
                      className="flex-shrink-0 flex h-10 w-10 items-center justify-center rounded-xl"
                      style={{ background: "var(--lifeflow-brand-50)" }}
                    >
                      <item.icon className="h-5 w-5" style={{ color: "var(--lifeflow-primary)" }} />
                    </div>
                    <div className="min-w-0">
                      <p
                        className="truncate"
                        style={{ fontSize: 16, fontWeight: 600, color: "var(--lifeflow-foreground)" }}
                      >
                        {item.label}
                      </p>
                      <p
                        className="truncate"
                        style={{ fontSize: 13, color: "var(--color-text-secondary)" }}
                      >
                        {item.desc}
                      </p>
                    </div>
                  </div>
                  <span
                    className="flex-shrink-0 whitespace-nowrap text-[13px] font-medium tracking-[-0.01em]"
                    style={{ color: "var(--color-text-secondary)" }}
                  >
                    最佳: {best ? `${best.weight}kg × ${best.reps}` : "—"}
                  </span>
                </div>
                <div className="flex justify-end">
                  <button
                    type="button"
                    onClick={() => handleBigThreeLog(item.key)}
                    className="inline-flex items-center rounded-lg px-3 py-1.5 text-sm font-medium transition-opacity hover:opacity-90"
                    style={{ background: "var(--lifeflow-brand-50)", color: "var(--lifeflow-primary)", fontSize: 13 }}
                  >
                    <Plus className="h-3.5 w-3.5 mr-1" />记录训练
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      </motion.div>

      {/* ─── Week Stats + Recent Sessions ─── */}
      {workoutSessions.length > 0 && (
        <>
          {/* Week Stats */}
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className="mt-5"
            style={{
              background: "var(--lifeflow-card)",
              borderRadius: "var(--lifeflow-radius-medium)",
              boxShadow: "var(--shadow-card)",
              padding: 20,
            }}
          >
            <div className="flex items-baseline justify-between">
              <span
                className="text-[18px] font-bold"
                style={{ color: "var(--color-text-primary)" }}
              >
                本周
              </span>
              <span
                className="text-[13px]"
                style={{ color: "var(--color-text-secondary)" }}
              >
                {weekRange}
              </span>
            </div>
            <div className="mt-4 grid grid-cols-2">
              {[
                { label: "训练天数", value: weekStats.days, unit: "天" },
                { label: "总组数", value: weekStats.totalSets, unit: "组" },
              ].map((stat, i) => (
                <div key={stat.label} className="flex items-center gap-3">
                  {i > 0 && (
                    <div
                      className="w-px h-11"
                      style={{ background: "var(--lifeflow-border)" }}
                    />
                  )}
                  <div className="flex flex-col items-center flex-1">
                    <span
                      className="text-[12px]"
                      style={{ color: "var(--color-text-secondary)" }}
                    >
                      {stat.label}
                    </span>
                    <div className="flex items-baseline">
                      <span
                        className="text-[24px] font-bold tabular-nums"
                        style={{ color: "var(--color-text-primary)" }}
                      >
                        {stat.value}
                      </span>
                      <span
                        className="text-[15px] font-medium ml-0.5"
                        style={{ color: "var(--color-text-primary)" }}
                      >
                        {stat.unit}
                      </span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </motion.div>

          {/* Recent Sessions */}
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.12 }}
            className="mt-4"
            style={{
              background: "var(--lifeflow-card)",
              borderRadius: "var(--lifeflow-radius-medium)",
              boxShadow: "var(--shadow-card)",
              padding: 20,
            }}
          >
            <span
              className="text-[18px] font-bold"
              style={{ color: "var(--color-text-primary)" }}
            >
              最近训练
            </span>
            {recentGroups.map((group) => (
              <div key={group.date} className="mt-4 first:mt-3">
                <span
                  className="text-[13px] block mb-1"
                  style={{ color: "var(--color-text-secondary)" }}
                >
                  {formatDateGroup(group.date)}
                </span>
                {group.sessions.flatMap((session) =>
                  session.exercises.map((ex, ei) => {
                    const totalSets = ex.sets.length;
                    const avgWeight =
                      ex.sets.reduce((s, set) => s + set.weight, 0) / totalSets;
                    const avgRpe =
                      ex.sets.reduce((s, set) => s + set.rpe, 0) / totalSets;
                    const isExpanded = expandedSession === session.id;
                    return (
                      <div key={`${session.id}-${ei}`}>
                        <div
                          className="flex items-center gap-2.5 py-3 cursor-pointer select-none"
                          style={{
                            borderTop: ei > 0 ? "1px solid var(--lifeflow-border)" : "none",
                          }}
                          onClick={() =>
                            setExpandedSession(isExpanded ? null : session.id)
                          }
                        >
                          <div
                            className="w-2 h-2 rounded-full shrink-0"
                            style={{ background: "var(--lifeflow-primary)" }}
                          />
                          <div className="flex-1 min-w-0">
                            <div
                              className="text-[15px] font-semibold truncate"
                              style={{ color: "var(--color-text-primary)" }}
                            >
                              {ex.exerciseName}
                            </div>
                            <div
                              className="text-[13px]"
                              style={{ color: "var(--color-text-secondary)" }}
                            >
                              {totalSets}组 ×{" "}
                              {avgWeight === 0
                                ? "自重"
                                : `${fmtAvg(avgWeight)}kg`}{" "}
                              · RPE {fmtAvg(avgRpe)}
                            </div>
                          </div>
                        </div>
                        {isExpanded && (
                          <motion.div
                            initial={{ height: 0, opacity: 0 }}
                            animate={{ height: "auto", opacity: 1 }}
                            className="overflow-hidden"
                          >
                            <div
                              className="mt-1 rounded-[12px] p-3"
                              style={{ background: "var(--color-surface-secondary)" }}
                            >
                              {ex.sets.map((set, si) => (
                                <div
                                  key={set.id}
                                  className="flex items-center gap-2 text-[13px] py-0.5"
                                  style={{ color: "var(--color-text-secondary)" }}
                                >
                                  <span>第{si + 1}组</span>
                                  <span>·</span>
                                  <span>
                                    {set.weight}kg × {set.reps}次
                                  </span>
                                  <span>·</span>
                                  <span>RPE {set.rpe}</span>
                                  {set.isPR && (
                                    <Star
                                      className="w-3.5 h-3.5"
                                      style={{ color: "var(--lifeflow-primary)" }}
                                    />
                                  )}
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
                      </div>
                    );
                  })
                )}
              </div>
            ))}
          </motion.div>
        </>
      )}
    </div>
  );
}
