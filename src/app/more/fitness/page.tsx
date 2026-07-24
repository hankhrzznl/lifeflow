"use client";

import { useEffect, useState, useMemo, useCallback, useRef } from "react";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { ChevronLeft, Minus, Plus, Trash2, Dumbbell, Heart, Grip, RotateCw, Zap, Star, TrendingUp, CalendarDays, Target } from "lucide-react";
import { useHealthStore } from "@/lib/store/healthStore";
import type { WorkoutSession, TrainingType, TrainingPlan } from "@/lib/db/health.db";
import { showToast } from "@/components/ui/Toast";
import { initializeTrainingPlans, getActiveTrainingPlans, getMonthLabel } from "@/lib/training-plan-generator";

/* ────────── Training Systems Definitions ────────── */

interface TrainingSystemDef {
  type: TrainingType;
  label: string;
  subtitle: string;
  icon: typeof Dumbbell;
  exercises: string[];
  color: string;          // accent color for card highlight
  schedule: string;
  notes: string;
}

const TRAINING_SYSTEMS: TrainingSystemDef[] = [
  {
    type: "gym_compound",
    label: "健身房复合力量",
    subtitle: "全年主食",
    icon: Dumbbell,
    exercises: ["杠铃卧推", "高位下拉", "高脚杯深蹲", "坐姿肩推", "杠铃硬拉"],
    color: "#2563EB",
    schedule: "每周 2-3 次",
    notes: "每次选 3-4 个动作 · 8-12 次/组 · 3-4 组",
  },
  {
    type: "low_cardio",
    label: "低强度有氧",
    subtitle: "全年主食",
    icon: Heart,
    exercises: ["快走", "游泳", "骑行", "划船机"],
    color: "#10B981",
    schedule: "每周 1-2 次",
    notes: "每次 30-60 分钟",
  },
  {
    type: "farmer_walk",
    label: "农夫行走",
    subtitle: "全年贯穿",
    icon: Grip,
    exercises: ["双手农夫行走", "单手农夫行走", "壶铃农夫行走", "哑铃农夫行走"],
    color: "#F59E0B",
    schedule: "主项月 3-4 次 · 辅项月收尾 3 组",
    notes: "双手/单手拎重壶铃或哑铃行走 20-40 米",
  },
  {
    type: "weighted_rotation",
    label: "负重旋转",
    subtitle: "专项训练",
    icon: RotateCw,
    exercises: ["壶铃旋转", "绳索旋转", "药球转体砸地"],
    color: "#8B5CF6",
    schedule: "主项月重点训练",
    notes: "强化核心旋转爆发力与抗旋能力",
  },
  {
    type: "power_training",
    label: "爆发力训练",
    subtitle: "专项训练",
    icon: Zap,
    exercises: ["跳箱", "壶铃摆荡", "短冲刺", "药球抛掷"],
    color: "#EF4444",
    schedule: "主项月重点训练",
    notes: "提升全身爆发力与运动表现",
  },
];

/* ────────── Monthly Rotation ────────── */

/**
 * 七月=农夫行走, 八月=负重旋转, 九月=爆发力, 十月起循环
 * 公式: ((month - 7 + 12) % 3) 映射到 farmer_walk / weighted_rotation / power_training
 */
const MONTHLY_PRIMARY_MAP: Record<number, TrainingType> = {
  0: "farmer_walk",
  1: "weighted_rotation",
  2: "power_training",
};

function getCurrentMonthPrimary(): TrainingType {
  const month = new Date().getMonth() + 1; // 1-12
  const idx = ((month - 7 + 12) % 3) as 0 | 1 | 2;
  return MONTHLY_PRIMARY_MAP[idx];
}

function getMonthPrimaryLabel(): string {
  const primary = getCurrentMonthPrimary();
  const sys = TRAINING_SYSTEMS.find((s) => s.type === primary);
  return sys?.label ?? "农夫行走";
}

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

const RPE_OPTIONS = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10] as const;

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
  const [tab, setTab] = useState<'record' | 'plan'>('record');
  const [plans, setPlans] = useState<TrainingPlan[]>([]);

  /* ─── Record sheet state ─── */
  const [showRecord, setShowRecord] = useState(false);
  const [selectedTrainingType, setSelectedTrainingType] = useState<TrainingType>("gym_compound");
  const [exerciseName, setExerciseName] = useState("");
  const [showExerciseDropdown, setShowExerciseDropdown] = useState(false);
  const [sets, setSets] = useState(3);
  const [reps, setReps] = useState(10);
  const [weight, setWeight] = useState(20);
  const [rpe, setRpe] = useState<number | null>(7);
  const [submitting, setSubmitting] = useState(false);

  const nameInputRef = useRef<HTMLInputElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);

  /* ─── Current month primary ─── */
  const currentPrimary = useMemo(() => getCurrentMonthPrimary(), []);
  const currentPrimaryLabel = useMemo(() => getMonthPrimaryLabel(), []);

  useEffect(() => {
    loadFitnessDataV2().finally(() => setLoading(false));
    // Initialize training plans
    initializeTrainingPlans().then(() => getActiveTrainingPlans().then(setPlans));
  }, [loadFitnessDataV2]);

  /* ─── Close exercise dropdown on outside click ─── */
  useEffect(() => {
    if (!showExerciseDropdown) return;
    const handler = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setShowExerciseDropdown(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [showExerciseDropdown]);

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
      sessionCount: todaySessions.length,
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

    // Count per training type
    const typeCount: Record<string, number> = {};
    for (const s of weekSessions) {
      const t = s.trainingType ?? "unknown";
      typeCount[t] = (typeCount[t] || 0) + 1;
    }

    return { days, totalSets, totalExercises, sessionCount: weekSessions.length, typeCount };
  }, [workoutSessions]);

  const weekRange = useMemo(() => getWeekRangeStr(), []);

  /* ─── Recent records grouped by date ─── */
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

  /* ─── Get training type label ─── */
  const getTrainingTypeLabel = (type?: TrainingType) => {
    return TRAINING_SYSTEMS.find((s) => s.type === type)?.label ?? "未知";
  };

  const getTrainingTypeColor = (type?: TrainingType) => {
    return TRAINING_SYSTEMS.find((s) => s.type === type)?.color ?? "#94A3B8";
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
              rpe: rpe ?? 0,
              isPR: false,
            })),
          },
        ],
        notes: "",
        trainingType: selectedTrainingType,
      });

      setExerciseName("");
      setSets(3);
      setReps(10);
      setWeight(20);
      setRpe(7);
      setSelectedTrainingType("gym_compound");
      setShowRecord(false);
      showToast({ type: "success", message: "已记录" });
    } catch {
      showToast({ type: "error", message: "没有记录成功，再试一次？" });
    } finally {
      setSubmitting(false);
    }
  }, [exerciseName, sets, reps, weight, rpe, selectedTrainingType, addWorkoutSessionV2]);

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
  const openRecordSheet = useCallback((trainingType?: TrainingType, exName?: string) => {
    if (trainingType) setSelectedTrainingType(trainingType);
    if (exName) {
      setExerciseName(exName);
    } else {
      setExerciseName("");
    }
    setSets(3);
    setReps(10);
    setWeight(20);
    setRpe(7);
    setShowRecord(true);
  }, []);

  const clamp = (v: number, min: number, max: number) => Math.max(min, Math.min(max, v));

  /* ─── Exercise suggestions based on selected training type ─── */
  const exerciseSuggestions = useMemo(() => {
    const sys = TRAINING_SYSTEMS.find((s) => s.type === selectedTrainingType);
    return sys?.exercises ?? [];
  }, [selectedTrainingType]);

  const rpeLabels: Record<number, string> = {
    1: "极轻", 2: "很轻", 3: "轻", 4: "中轻", 5: "中等",
    6: "中强", 7: "较强", 8: "强", 9: "很强", 10: "极限",
  };

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
        {/* Month primary badge */}
        <div
          className="ml-auto flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[12px] font-medium shrink-0"
          style={{
            background: `${TRAINING_SYSTEMS.find((s) => s.type === currentPrimary)?.color ?? "#2563EB"}15`,
            color: TRAINING_SYSTEMS.find((s) => s.type === currentPrimary)?.color ?? "#2563EB",
          }}
        >
          <Star className="h-3 w-3" />
          {new Date().getMonth() + 1}月主项: {currentPrimaryLabel}
        </div>
      </header>

      {/* ─── Tabs ─── */}
      <div className="px-4 mb-4">
        <div className="flex rounded-full p-1" style={{ background: "var(--lifeflow-muted)" }}>
          {(['record', 'plan'] as const).map((t) => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className="flex-1 py-1.5 rounded-full text-[13px] font-medium transition-all"
              style={{
                background: tab === t ? "var(--color-surface-card)" : "transparent",
                color: tab === t ? "var(--color-text-primary)" : "var(--color-text-secondary)",
                boxShadow: tab === t ? "var(--shadow-card)" : "none",
              }}
            >
              {t === 'record' ? '记录' : '计划'}
            </button>
          ))}
        </div>
      </div>

      {/* ─── Plan View ─── */}
      {tab === 'plan' && (
        <TrainingPlanView plans={plans} />
      )}

      {/* ─── Record View ─── */}
      {tab === 'record' && (
      <div className="px-4 pt-0 pb-10 space-y-4">
        {/* ─── Today Summary Card ─── */}
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.35, ease: [0.32, 0.72, 0, 1] }}
          className="p-5"
          style={{ background: "var(--color-surface-card)", borderRadius: "20px", boxShadow: "var(--shadow-card)" }}
        >
          <div className="flex items-center justify-between mb-4">
            <p className="text-[17px] font-semibold" style={{ color: "var(--color-text-primary)" }}>
              今日训练
            </p>
            <span className="text-[13px] font-medium px-2.5 py-1 rounded-full" style={{ background: "var(--lifeflow-brand-50)", color: "var(--lifeflow-primary)" }}>
              {todayStats.totalSets} 组
            </span>
          </div>
          <div className="flex items-center justify-center" style={{ gap: 24 }}>
            <div className="flex flex-col items-center flex-1" style={{ minWidth: 0 }}>
              <span className="text-[24px] font-bold tracking-[-0.018em]" style={{ color: "var(--color-text-primary)" }}>
                {todayStats.sessionCount}
              </span>
              <span className="text-[13px] font-medium truncate" style={{ color: "var(--color-text-secondary)", letterSpacing: "-0.01em" }}>训练次数</span>
            </div>
            <div style={{ width: 1, height: 32, background: "var(--lifeflow-border)", flexShrink: 0 }} />
            <div className="flex flex-col items-center flex-1" style={{ minWidth: 0 }}>
              <span className="text-[24px] font-bold tracking-[-0.018em]" style={{ color: "var(--color-text-primary)" }}>
                {todayStats.exerciseCount}
              </span>
              <span className="text-[13px] font-medium truncate" style={{ color: "var(--color-text-secondary)", letterSpacing: "-0.01em" }}>动作数</span>
            </div>
            <div style={{ width: 1, height: 32, background: "var(--lifeflow-border)", flexShrink: 0 }} />
            <div className="flex flex-col items-center flex-1" style={{ minWidth: 0 }}>
              <span className="text-[24px] font-bold tracking-[-0.018em]" style={{ color: "var(--color-text-primary)" }}>
                {todayStats.avgRpe || "-"}
              </span>
              <span className="text-[13px] font-medium truncate" style={{ color: "var(--color-text-secondary)", letterSpacing: "-0.01em" }}>RPE均</span>
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
            onClick={() => openRecordSheet()}
            className="w-full py-3.5 rounded-full text-white text-base font-semibold tracking-[-0.018em] active:opacity-90 transition-opacity"
            style={{ background: "var(--lifeflow-primary)" }}
          >
            记录训练
          </button>
        </motion.div>

        {/* ─── Training System Cards ─── */}
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1, duration: 0.35, ease: [0.32, 0.72, 0, 1] }}
        >
          <h2 className="mb-3 px-1 text-[17px] font-semibold" style={{ color: "var(--color-text-primary)" }}>训练体系</h2>
          <div className="flex flex-col" style={{ gap: 12 }}>
            {TRAINING_SYSTEMS.map((sys) => {
              const Icon = sys.icon;
              const isPrimary = sys.type === currentPrimary;
              return (
                <div
                  key={sys.type}
                  className="p-4 relative overflow-hidden"
                  style={{
                    background: "var(--color-surface-card)",
                    borderRadius: "20px",
                    boxShadow: isPrimary ? `0 0 0 2px ${sys.color}40, var(--shadow-card)` : "var(--shadow-card)",
                    border: isPrimary ? `1.5px solid ${sys.color}60` : "1.5px solid transparent",
                  }}
                >
                  {/* Primary badge */}
                  {isPrimary && (
                    <div
                      className="absolute top-0 right-0 px-2.5 py-1 text-[11px] font-semibold rounded-bl-xl"
                      style={{ background: sys.color, color: "#fff" }}
                    >
                      <Star className="h-3 w-3 inline mr-0.5" style={{ marginTop: -1 }} />
                      本月主项
                    </div>
                  )}

                  {/* Header */}
                  <div className="flex items-center gap-3 mb-3">
                    <div
                      className="flex-shrink-0 flex h-10 w-10 items-center justify-center rounded-xl"
                      style={{ background: `${sys.color}15` }}
                    >
                      <Icon className="h-5 w-5" style={{ color: sys.color }} />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <p className="text-[16px] font-semibold truncate" style={{ color: "var(--color-text-primary)" }}>
                          {sys.label}
                        </p>
                        <span
                          className="text-[11px] font-medium px-2 py-0.5 rounded-full shrink-0"
                          style={{ background: `${sys.color}12`, color: sys.color }}
                        >
                          {sys.subtitle}
                        </span>
                      </div>
                      <p className="text-[12px] mt-0.5 truncate" style={{ color: "var(--color-text-secondary)" }}>
                        {sys.schedule}
                      </p>
                    </div>
                  </div>

                  {/* Notes */}
                  <p className="text-[12px] mb-3 leading-relaxed" style={{ color: "var(--color-text-secondary)" }}>
                    {sys.notes}
                  </p>

                  {/* Exercise quick-action buttons */}
                  <div className="flex flex-wrap gap-2">
                    {sys.exercises.map((ex) => (
                      <button
                        key={ex}
                        type="button"
                        onClick={() => openRecordSheet(sys.type, ex)}
                        className="inline-flex items-center rounded-lg px-3 py-1.5 text-[13px] font-medium transition-opacity hover:opacity-90 active:opacity-70"
                        style={{ background: `${sys.color}12`, color: sys.color }}
                      >
                        <Plus className="h-3.5 w-3.5 mr-1" />
                        {ex}
                      </button>
                    ))}
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
          transition={{ delay: 0.14, duration: 0.35, ease: [0.32, 0.72, 0, 1] }}
          className="p-5"
          style={{ background: "var(--color-surface-card)", borderRadius: "20px", boxShadow: "var(--shadow-card)" }}
        >
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-[17px] font-semibold flex items-center gap-2" style={{ color: "var(--color-text-primary)" }}>
              <TrendingUp className="h-4 w-4" style={{ color: "var(--lifeflow-primary)" }} />
              本周统计
            </h2>
            <span className="text-[13px]" style={{ color: "var(--color-text-secondary)" }}>{weekRange}</span>
          </div>

          <div className="flex">
            {[
              { label: "训练天数", value: weekStats.days, unit: "天" },
              { label: "训练次数", value: weekStats.sessionCount, unit: "次" },
              { label: "动作总数", value: weekStats.totalExercises, unit: "个" },
              { label: "总组数", value: weekStats.totalSets, unit: "组" },
            ].map((stat) => (
              <div key={stat.label} className="flex flex-col items-center flex-1">
                <span className="text-[24px] font-bold tabular-nums leading-none" style={{ color: "var(--color-text-primary)" }}>
                  {stat.value}
                </span>
                <span className="text-[12px] mt-1" style={{ color: "var(--color-text-secondary)" }}>{stat.label}</span>
              </div>
            ))}
          </div>

          {/* Training type distribution */}
          {Object.keys(weekStats.typeCount).length > 0 && (
            <div className="mt-4 pt-4 flex flex-wrap gap-2" style={{ borderTop: `1px solid var(--lifeflow-border)` }}>
              {Object.entries(weekStats.typeCount)
                .sort(([, a], [, b]) => b - a)
                .map(([type, count]) => {
                  const label = type === "unknown" ? "其他" : getTrainingTypeLabel(type as TrainingType);
                  const color = type === "unknown" ? "#94A3B8" : getTrainingTypeColor(type as TrainingType);
                  return (
                    <span
                      key={type}
                      className="text-[12px] font-medium px-2.5 py-1 rounded-full"
                      style={{ background: `${color}15`, color }}
                    >
                      {label} {count}次
                    </span>
                  );
                })}
            </div>
          )}
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
                <span className="text-[13px] block mb-1 font-medium" style={{ color: "var(--color-text-secondary)" }}>
                  {formatDateGroup(group.date)}
                </span>
                <div className="space-y-2">
                  {group.sessions.map((s) => {
                    const isExpanded = expandedSession === s.id;
                    const ttColor = getTrainingTypeColor(s.trainingType);
                    const ttLabel = getTrainingTypeLabel(s.trainingType);
                    return (
                      <div
                        key={s.id}
                        className="rounded-xl overflow-hidden"
                        style={{ background: "var(--lifeflow-muted)" }}
                      >
                        <button
                          type="button"
                          className="w-full flex items-center justify-between p-3 text-left"
                          onClick={() => setExpandedSession(isExpanded ? null : s.id!)}
                        >
                          <div className="min-w-0 flex-1">
                            <div className="flex items-center gap-2">
                              <span className="text-[14px] font-medium truncate" style={{ color: "var(--color-text-primary)" }}>
                                {s.exercises.map((e) => e.exerciseName).join(" · ")}
                              </span>
                            </div>
                            {s.trainingType && (
                              <span
                                className="inline-block text-[11px] font-medium px-2 py-0.5 rounded-full mt-1"
                                style={{ background: `${ttColor}15`, color: ttColor }}
                              >
                                {ttLabel}
                              </span>
                            )}
                          </div>
                          <span className="text-[12px] shrink-0 ml-2" style={{ color: "var(--color-text-secondary)" }}>
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
                                          {set.reps}次×{set.weight}kg{set.rpe > 0 ? ` RPE${set.rpe}` : ""}
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
            <p className="text-[15px] font-medium" style={{ color: "var(--color-text-primary)" }}>还没有训练记录。点击上方开始记录。</p>
          </motion.div>
        )}
      </div>
      )}

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
              style={{ background: "var(--color-surface-card)", maxHeight: "85vh", overflowY: "auto", paddingBottom: "calc(var(--bottom-nav-height, 83px) + 20px)" }}
            >
              <div className="flex items-center justify-between mb-5">
                <h2 className="text-[17px] font-semibold" style={{ color: "var(--color-text-primary)" }}>记录训练</h2>
                <button onClick={() => setShowRecord(false)} className="text-[15px] font-medium" style={{ color: "var(--lifeflow-primary)" }}>取消</button>
              </div>

              {/* Training Type Selector */}
              <div className="mb-5">
                <label className="text-[13px] font-medium mb-2 block" style={{ color: "var(--color-text-secondary)" }}>训练类型</label>
                <div className="flex flex-wrap gap-2">
                  {TRAINING_SYSTEMS.map((sys) => (
                    <button
                      key={sys.type}
                      type="button"
                      onClick={() => {
                        setSelectedTrainingType(sys.type);
                        setExerciseName("");
                      }}
                      className="px-3 py-1.5 rounded-lg text-[13px] font-medium transition-all"
                      style={{
                        background: selectedTrainingType === sys.type ? sys.color : `${sys.color}10`,
                        color: selectedTrainingType === sys.type ? "#fff" : sys.color,
                        border: selectedTrainingType === sys.type ? `1.5px solid ${sys.color}` : "1.5px solid transparent",
                      }}
                    >
                      {sys.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Exercise Name with dropdown */}
              <div className="mb-5" ref={dropdownRef}>
                <label className="text-[13px] font-medium mb-1.5 block" style={{ color: "var(--color-text-secondary)" }}>动作名称</label>
                <div className="relative">
                  <input
                    ref={nameInputRef}
                    type="text"
                    value={exerciseName}
                    onChange={(e) => {
                      setExerciseName(e.target.value);
                      setShowExerciseDropdown(true);
                    }}
                    onFocus={() => setShowExerciseDropdown(true)}
                    placeholder="输入或选择动作名"
                    className="w-full h-11 px-4 rounded-xl text-[15px] outline-none"
                    style={{ background: "var(--lifeflow-muted)", color: "var(--color-text-primary)", border: "1px solid transparent" }}
                  />
                  {showExerciseDropdown && exerciseSuggestions.length > 0 && (
                    <div
                      className="absolute top-full left-0 right-0 mt-1 rounded-xl overflow-hidden z-10"
                      style={{ background: "var(--color-surface-card)", boxShadow: "var(--shadow-card)", border: "1px solid var(--lifeflow-border)" }}
                    >
                      {exerciseSuggestions
                        .filter((ex) => !exerciseName || ex.includes(exerciseName))
                        .map((ex) => (
                          <button
                            key={ex}
                            type="button"
                            onClick={() => {
                              setExerciseName(ex);
                              setShowExerciseDropdown(false);
                            }}
                            className="w-full text-left px-4 py-2.5 text-[14px] hover:opacity-80 transition-opacity"
                            style={{ color: "var(--color-text-primary)", borderBottom: "1px solid var(--lifeflow-border)" }}
                          >
                            {ex}
                          </button>
                        ))}
                      {exerciseSuggestions.filter((ex) => !exerciseName || ex.includes(exerciseName)).length === 0 && (
                        <div className="px-4 py-2.5 text-[13px]" style={{ color: "var(--color-text-secondary)" }}>
                          输入自定义动作
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </div>

              {/* Sets / Reps / Weight */}
              <div className="grid grid-cols-3 gap-3 mb-5">
                {[
                  { label: "组数", value: sets, min: 1, max: 20, step: 1, set: setSets },
                  { label: "次数", value: reps, min: 1, max: 50, step: 1, set: setReps },
                  { label: "重量(kg)", value: weight, min: 0, max: 500, step: 5, set: setWeight },
                ].map((field) => (
                  <div key={field.label}>
                    <label className="text-[13px] font-medium mb-1.5 block" style={{ color: "var(--color-text-secondary)" }}>{field.label}</label>
                    <div className="flex items-center rounded-xl overflow-hidden" style={{ background: "var(--lifeflow-muted)" }}>
                      <button
                        onClick={() => field.set(clamp(field.value - field.step, field.min, field.max))}
                        className="w-9 h-9 flex items-center justify-center active:opacity-60"
                      >
                        <Minus className="w-4 h-4" style={{ color: "var(--color-text-secondary)" }} />
                      </button>
                      <span className="flex-1 text-center text-[15px] font-semibold tabular-nums" style={{ color: "var(--color-text-primary)" }}>
                        {field.value}
                      </span>
                      <button
                        onClick={() => field.set(clamp(field.value + field.step, field.min, field.max))}
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
                <div className="flex items-center justify-between mb-1.5">
                  <label className="text-[13px] font-medium" style={{ color: "var(--color-text-secondary)" }}>
                    RPE（自觉强度 1-10，可选）
                  </label>
                  {rpe !== null && (
                    <span className="text-[12px] font-medium" style={{ color: "var(--lifeflow-primary)" }}>
                      {rpeLabels[rpe] ?? ""}
                    </span>
                  )}
                </div>
                <div className="flex gap-1.5 flex-wrap">
                  {RPE_OPTIONS.map((r) => (
                    <button
                      key={r}
                      onClick={() => setRpe(rpe === r ? null : r)}
                      className="flex-1 min-w-[28px] h-9 rounded-lg text-[13px] font-medium transition-colors"
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

/* ================================================================
 * Training Plan View Component
 * ================================================================ */

function TrainingPlanView({ plans }: { plans: TrainingPlan[] }) {
  const { primary, secondary } = useMemo(() => {
    const now = new Date();
    const startYear = 2026; const startMonth = 7;
    const totalMonths = (now.getFullYear() - startYear) * 12 + (now.getMonth() + 1 - startMonth);
    const idx = ((totalMonths % 3) + 3) % 3;
    const types: TrainingType[] = ["farmer_walk", "weighted_rotation", "power_training"];
    const p = types[idx];
    const s = types.filter((_, i) => i !== idx);
    return { primary: p, secondary: s };
  }, []);

  const staple = plans.filter(p => p.role === 'staple' && p.active);
  const rotating = plans.filter(p => p.role === 'rotating' && p.active);

  if (plans.length === 0) {
    return (
      <div className="px-4 pt-4 text-center">
        <div
          className="p-8 rounded-[20px] flex flex-col items-center gap-4"
          style={{ background: "var(--color-surface-card)", boxShadow: "var(--shadow-card)" }}
        >
          <CalendarDays className="w-10 h-10" style={{ color: "var(--color-text-disabled)" }} />
          <p className="text-[15px] font-medium" style={{ color: "var(--color-text-secondary)" }}>还没有训练计划</p>
          <p className="text-[13px]" style={{ color: "var(--color-text-disabled)" }}>刷新页面即可自动生成</p>
        </div>
      </div>
    );
  }

  return (
    <div className="px-4 pt-0 pb-10 space-y-4">
      {/* Monthly rotation summary */}
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        className="p-4 rounded-[20px]"
        style={{ background: "var(--color-surface-card)", boxShadow: "var(--shadow-card)" }}
      >
        <div className="flex items-center gap-2 mb-3">
          <Star className="w-4 h-4" style={{ color: "#F59E0B" }} />
          <span className="text-[14px] font-semibold" style={{ color: "var(--color-text-primary)" }}>
            {new Date().getMonth() + 1}月轮换
          </span>
        </div>
        <div className="flex items-center gap-3 text-[13px]">
          <span className="px-2.5 py-1 rounded-full font-medium text-white" style={{ background: TRAINING_SYSTEMS.find(s => s.type === primary)?.color }}>
            {TRAINING_SYSTEMS.find(s => s.type === primary)?.label} 主
          </span>
          {secondary.map(t => {
            const sys = TRAINING_SYSTEMS.find(s => s.type === t);
            return (
              <span key={t} className="px-2 py-1 rounded-full text-[12px]" style={{ background: `${sys?.color}15`, color: sys?.color }}>
                {sys?.label} 辅
              </span>
            );
          })}
        </div>
      </motion.div>

      {/* Staple plans */}
      {staple.length > 0 && (
        <div>
          <div className="flex items-center gap-2 mb-2 px-1">
            <Target className="w-4 h-4" style={{ color: "var(--lifeflow-primary)" }} />
            <h3 className="text-[14px] font-semibold" style={{ color: "var(--color-text-primary)" }}>全年主食</h3>
          </div>
          {staple.map(p => (
            <PlanCard key={p.id} plan={p} />
          ))}
        </div>
      )}

      {/* Rotating plans */}
      {rotating.length > 0 && (
        <div>
          <div className="flex items-center gap-2 mb-2 px-1">
            <RotateCw className="w-4 h-4" style={{ color: "#F59E0B" }} />
            <h3 className="text-[14px] font-semibold" style={{ color: "var(--color-text-primary)" }}>月度轮换</h3>
          </div>
          {rotating.map(p => {
            const isPrimary = p.trainingType === primary;
            return (
              <PlanCard key={p.id} plan={p} highlight={isPrimary} />
            );
          })}
        </div>
      )}
    </div>
  );
}

function PlanCard({ plan, highlight }: { plan: TrainingPlan; highlight?: boolean }) {
  const sys = TRAINING_SYSTEMS.find(s => s.type === plan.trainingType);
  const dayLabels = ["", "周一", "周二", "周三", "周四", "周五", "周六", "周日"];

  return (
    <motion.div
      whileTap={{ scale: 0.98 }}
      className="p-3.5 rounded-[16px] mb-2 flex items-center gap-3"
      style={{
        background: "var(--color-surface-card)",
        boxShadow: "var(--shadow-card)",
        borderLeft: `3px solid ${sys?.color || "#94A3B8"}`,
      }}
    >
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span className="text-[14px] font-semibold truncate" style={{ color: "var(--color-text-primary)" }}>{plan.name}</span>
          {highlight && (
            <span className="text-[10px] px-1.5 py-0.5 rounded-full font-medium" style={{ background: "rgba(245,158,11,0.12)", color: "#F59E0B" }}>本月主项</span>
          )}
          <span className="px-1.5 py-0.5 rounded text-[10px] font-medium" style={{ background: "var(--lifeflow-brand-50)", color: "var(--lifeflow-primary)" }}>
            {plan.role === 'staple' ? '主食' : '轮换'}
          </span>
        </div>
        <div className="text-[11px] mt-0.5" style={{ color: "var(--color-text-secondary)" }}>
          {plan.frequency === 'weekly' && plan.weeklyDays
            ? `${plan.weeklyDays?.map(d => dayLabels[d]).join('、')} · 每周${plan.weeklyDays.length}次`
            : `每月${plan.monthlyDays?.join('、')}号`}
        </div>
        <div className="text-[11px] mt-0.5 truncate" style={{ color: "var(--color-text-disabled)" }}>
          {plan.exercises.join('、')}
        </div>
      </div>
    </motion.div>
  );
}
