"use client";

import { useState, useEffect, useMemo, useCallback } from "react";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import { ChevronLeft, Dumbbell, Trash2, Star } from "lucide-react";
import { useHealthStore } from "@/lib/store/healthStore";
import type { WorkoutSession } from "@/lib/db/health.db";

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

function fmtAvg(n: number) { return Number.isInteger(n) ? `${n}` : n.toFixed(1); }

export default function FitnessPage() {
  const router = useRouter();
  const { workoutSessions, loadFitnessDataV2, deleteWorkoutSessionV2 } = useHealthStore();

  const [loading, setLoading] = useState(true);
  const [expandedSession, setExpandedSession] = useState<string | null>(null);

  useEffect(() => {
    loadFitnessDataV2().finally(() => setLoading(false));
  }, [loadFitnessDataV2]);

  const weekStats = useMemo(() => {
    const weekSessions = workoutSessions.filter((s) => isDateInWeek(s.date));
    const days = new Set(weekSessions.map((s) => s.date)).size;
    const totalSets = weekSessions.reduce((s, sess) => s + sess.exercises.reduce((t, e) => t + e.sets.length, 0), 0);
    return { days, totalSets };
  }, [workoutSessions]);

  const weekRange = useMemo(() => getWeekRangeStr(), []);

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

  const formatDateGroup = (dateStr: string) => {
    const d = new Date(dateStr + "T00:00:00");
    const weeks = ["日", "一", "二", "三", "四", "五", "六"];
    return `${d.getMonth() + 1}月${d.getDate()}日 周${weeks[d.getDay()]}`;
  };

  const handleDelete = useCallback(async (id: string) => {
    await deleteWorkoutSessionV2(id);
    setExpandedSession(null);
  }, [deleteWorkoutSessionV2]);

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

  const isEmpty = workoutSessions.length === 0;

  return (
    <div className="pb-[100px]">
      {/* Header */}
      <div className="flex items-center px-4 pt-3 pb-2">
        <button
          type="button"
          onClick={() => router.push("/more")}
          className="inline-flex h-8 w-8 items-center justify-center rounded-lg"
          style={{
            background: "var(--color-surface-card)",
            border: "1px solid var(--lifeflow-border)",
          }}
        >
          <ChevronLeft className="w-4 h-4" style={{ color: "var(--color-text-primary)" }} />
        </button>
        <h1 className="text-title-nav flex-1 text-center" style={{ color: "var(--color-text-primary)" }}>
          训练
        </h1>
        <div className="w-8" />
      </div>

      <div className="px-4 pt-5 flex flex-col gap-4">
        {/* Empty state */}
        {isEmpty ? (
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            className="card-standard p-10 flex flex-col items-center"
          >
            <div
              className="w-16 h-16 rounded-full flex items-center justify-center mb-4"
              style={{ background: "var(--lifeflow-brand-50)" }}
            >
              <Dumbbell className="w-8 h-8" style={{ color: "var(--lifeflow-primary)" }} />
            </div>
            <p className="text-[17px] font-semibold" style={{ color: "var(--color-text-primary)" }}>
              暂无训练记录
            </p>
            <p className="text-[14px] mt-1.5" style={{ color: "var(--color-text-secondary)" }}>
              开始记录你的训练吧
            </p>
            <button
              type="button"
              className="mt-5 h-10 px-6 rounded-full text-[15px] font-semibold text-white"
              style={{ background: "var(--lifeflow-primary)" }}
            >
              开始训练
            </button>
          </motion.div>
        ) : (
          <>
            {/* Week Stats */}
            <motion.div
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              className="card-standard p-5"
            >
              <div className="flex items-baseline justify-between">
                <span className="text-[18px] font-bold" style={{ color: "var(--color-text-primary)" }}>本周</span>
                <span className="text-[13px]" style={{ color: "var(--color-text-secondary)" }}>{weekRange}</span>
              </div>
              <div className="mt-4 grid grid-cols-2">
                {[
                  { label: "训练天数", value: weekStats.days, unit: "天" },
                  { label: "总组数", value: weekStats.totalSets, unit: "组" },
                ].map((item, i) => (
                  <div key={item.label} className="flex items-center gap-3">
                    {i > 0 && <div className="w-px h-11" style={{ background: "var(--lifeflow-border)" }} />}
                    <div className="flex flex-col items-center flex-1">
                      <span className="text-[12px]" style={{ color: "var(--color-text-secondary)" }}>{item.label}</span>
                      <div className="flex items-baseline">
                        <span className="text-[24px] font-bold tabular-nums" style={{ color: "var(--color-text-primary)" }}>{item.value}</span>
                        <span className="text-[15px] font-medium ml-0.5" style={{ color: "var(--color-text-primary)" }}>{item.unit}</span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </motion.div>

            {/* Recent */}
            <motion.div
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.05 }}
              className="card-standard p-5"
            >
              <span className="text-[18px] font-bold" style={{ color: "var(--color-text-primary)" }}>最近训练</span>
              {recentGroups.map((group) => (
                <div key={group.date} className="mt-4 first:mt-3">
                  <span className="text-[13px] block mb-1" style={{ color: "var(--color-text-secondary)" }}>
                    {formatDateGroup(group.date)}
                  </span>
                  {group.sessions.flatMap((session) =>
                    session.exercises.map((ex, ei) => {
                      const totalSets = ex.sets.length;
                      const avgWeight = ex.sets.reduce((s, set) => s + set.weight, 0) / totalSets;
                      const avgRpe = ex.sets.reduce((s, set) => s + set.rpe, 0) / totalSets;
                      const isExpanded = expandedSession === session.id;
                      return (
                        <div key={`${session.id}-${ei}`}>
                          <div
                            className="flex items-center gap-2.5 py-3 cursor-pointer select-none"
                            style={{ borderTop: ei > 0 ? "1px solid var(--lifeflow-border)" : "none" }}
                            onClick={() => setExpandedSession(isExpanded ? null : session.id)}
                          >
                            <div className="w-2 h-2 rounded-full shrink-0" style={{ background: "var(--lifeflow-primary)" }} />
                            <div className="flex-1 min-w-0">
                              <div className="text-[15px] font-semibold truncate" style={{ color: "var(--color-text-primary)" }}>
                                {ex.exerciseName}
                              </div>
                              <div className="text-[13px]" style={{ color: "var(--color-text-secondary)" }}>
                                {totalSets}组 × {avgWeight === 0 ? "自重" : `${fmtAvg(avgWeight)}kg`} · RPE {fmtAvg(avgRpe)}
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
                                    <span>{set.weight}kg × {set.reps}次</span>
                                    <span>·</span>
                                    <span>RPE {set.rpe}</span>
                                    {set.isPR && <Star className="w-3.5 h-3.5" style={{ color: "var(--lifeflow-primary)" }} />}
                                  </div>
                                ))}
                                <button
                                  type="button"
                                  onClick={(e) => { e.stopPropagation(); handleDelete(session.id); }}
                                  className="mt-2 flex items-center gap-1.5 text-[13px]"
                                  style={{ color: "var(--color-text-secondary)" }}
                                >
                                  <Trash2 className="w-4 h-4" />删除此记录
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
    </div>
  );
}
