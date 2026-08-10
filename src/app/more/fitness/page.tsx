"use client";

import { useEffect, useState, useMemo, useCallback, useRef } from "react";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { ChevronLeft, ChevronDown, Minus, Plus, Check, Trash2, Dumbbell, Heart, Grip, RotateCw, Zap, Star, TrendingUp, CalendarDays, Target } from "lucide-react";
import { useHealthStore } from "@/lib/store/healthStore";
import type { WorkoutSession, TrainingType, TrainingPlan } from "@/lib/db/health.db";
import { showToast } from "@/components/ui/Toast";
import { initializeTrainingPlans, getActiveTrainingPlans, getMonthLabel } from "@/lib/training-plan-generator";
import { ensureModuleItem, removeModuleItems } from "@/lib/db/daylog.db";
import PostureTab from "@/components/fitness/PostureTab";
import WellnessTab from "@/components/fitness/WellnessTab";

/* ────────── Training Systems Definitions ────────── */

interface TrainingSystemDef {
  type: TrainingType;
  label: string;
  subtitle: string;
  group: 'strength' | 'cardio';  // T21-6：训练 4 Tab（力量/有氧/拉伸/养生）分组
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
    group: "strength",
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
    group: "cardio",
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
    group: "strength",
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
    group: "strength",
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
    group: "strength",
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
  const [subTab, setSubTab] = useState<'record' | 'plan'>('record');
  const [plans, setPlans] = useState<TrainingPlan[]>([]);

  /* ─── T21-6：顶层 4 Tab（力量 / 有氧 / 拉伸 / 养生）单入口 ─── */
  const [topTab, setTopTab] = useState<'strength' | 'cardio' | 'stretch' | 'wellness'>('strength');

  useEffect(() => {
    const p = new URLSearchParams(window.location.search).get('tab');
    if (p === 'posture' || p === 'stretch') setTopTab('stretch');  // 兼容旧 /more/fitness?tab=posture
    else if (p === 'cardio') setTopTab('cardio');
    else if (p === 'wellness') setTopTab('wellness');
  }, []);

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
  const [exerciseInputFocus, setExerciseInputFocus] = useState(false);

  /* ─── Current month primary ─── */
  const currentPrimary = useMemo(() => getCurrentMonthPrimary(), []);
  const currentPrimaryLabel = useMemo(() => getMonthPrimaryLabel(), []);
  const currentPrimaryColor = useMemo(
    () => TRAINING_SYSTEMS.find((s) => s.type === currentPrimary)?.color ?? "#2563EB",
    [currentPrimary],
  );

  /* ─── T21-6：按当前 Tab 分组过滤训练系统（力量/有氧） ─── */
  const visibleSystems = useMemo(
    () => TRAINING_SYSTEMS.filter((s) => s.group === (topTab === 'cardio' ? 'cardio' : 'strength')),
    [topTab],
  );

  // T21-6：切换 Tab 时，记录默认类型跟随当前分组（力量→gym_compound / 有氧→low_cardio）
  useEffect(() => {
    const first = visibleSystems[0];
    if (first && visibleSystems.some(s => s.type === selectedTrainingType) === false) {
      setSelectedTrainingType(first.type);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [topTab]);

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

  /* ─── Today stats（T21-6：按当前分组过滤；无类型旧数据归力量组） ─── */
  const groupSessions = useMemo(() => {
    const types = new Set(visibleSystems.map((s) => s.type));
    return workoutSessions.filter((s) => {
      if (!s.trainingType) return topTab !== 'cardio';
      return types.has(s.trainingType);
    });
  }, [workoutSessions, visibleSystems, topTab]);

  const todayStats = useMemo(() => {
    const today = localTodayStr();
    const todaySessions = groupSessions.filter((s) => s.date === today);
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
  }, [groupSessions]);

  /* ─── Week stats ─── */
  const weekStats = useMemo(() => {
    const weekSessions = groupSessions.filter((s) => isDateInWeek(s.date));
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
  }, [groupSessions]);

  const weekRange = useMemo(() => getWeekRangeStr(), []);

  /* ─── Recent records grouped by date（T21-6：按当前分组过滤） ─── */
  const recentGroups = useMemo(() => {
    const sorted = [...groupSessions]
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
      const sessionId = await addWorkoutSessionV2({
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

      // Auto-generate schedule item
      try {
        const trainingTypeLabel = TRAINING_SYSTEMS.find((s) => s.type === selectedTrainingType)?.label;
        const title = trainingTypeLabel || exerciseName.trim();
        await ensureModuleItem({
          date: localTodayStr(),
          sourceType: "fitness",
          sourceId: `fitness_${sessionId}`,
          title,
          plannedStart: "09:00",
          plannedEnd: "10:00",
          color: "#EF4444",
          icon: "Dumbbell",
        });
      } catch {
        // schedule generation failure is non-blocking
      }

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
    async (id: string, date: string) => {
      await deleteWorkoutSessionV2(id);
      // Remove corresponding schedule item
      try {
        await removeModuleItems(date, "fitness", `fitness_${id}`);
      } catch {
        // non-blocking
      }
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

  const fmtWeight = (w: number) => (Number.isInteger(w) ? String(w) : w.toFixed(1));

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
          {topTab === 'strength' ? '力量训练' : topTab === 'cardio' ? '有氧训练' : topTab === 'stretch' ? '体态拉伸' : '功法养生'}
        </h1>
        {/* Month primary badge（仅力量 Tab：月度轮换专项均属力量组） */}
        {topTab === 'strength' && (
        <div
          className="ml-auto flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[12px] font-semibold shrink-0"
          style={{
            background: `${TRAINING_SYSTEMS.find((s) => s.type === currentPrimary)?.color ?? "#2563EB"}15`,
            color: TRAINING_SYSTEMS.find((s) => s.type === currentPrimary)?.color ?? "#2563EB",
          }}
        >
          <Star className="h-3 w-3" />
          {new Date().getMonth() + 1}月主项: {currentPrimaryLabel}
        </div>
        )}
        {topTab !== 'strength' && <div className="ml-auto shrink-0" />}
      </header>

      {/* ─── T21-6：顶层 4 Tab（力量 / 有氧 / 拉伸 / 养生）单入口 ─── */}
      <div className="px-4 mb-4">
        <div className="flex rounded-full p-1" style={{ background: "var(--lifeflow-muted)" }}>
          {([
            { key: 'strength', label: '力量' },
            { key: 'cardio', label: '有氧' },
            { key: 'stretch', label: '拉伸' },
            { key: 'wellness', label: '养生' },
          ] as const).map(({ key, label }) => (
            <button
              key={key}
              onClick={() => setTopTab(key)}
              className="flex-1 py-1.5 rounded-full text-[13px] font-medium transition-all"
              style={{
                background: topTab === key ? "var(--color-surface-card)" : "transparent",
                color: topTab === key ? "var(--color-text-primary)" : "var(--color-text-secondary)",
                boxShadow: topTab === key ? "var(--shadow-card)" : "none",
              }}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      {/* ─── 拉伸 Tab（体态拉伸） ─── */}
      {topTab === 'stretch' && <PostureTab />}

      {/* ─── 养生 Tab（功法养生） ─── */}
      {topTab === 'wellness' && <WellnessTab />}

      {/* ─── 力量 / 有氧 Tab（内部 记录/计划） ─── */}
      {(topTab === 'strength' || topTab === 'cardio') && (
        <>
      {/* ─── Tabs ─── */}
      <div className="px-4 mb-4">
        <div className="flex rounded-full p-1" style={{ background: "var(--lifeflow-muted)" }}>
          {(['record', 'plan'] as const).map((t) => (
            <button
              key={t}
              onClick={() => setSubTab(t)}
              className="flex-1 py-1.5 rounded-full text-[13px] font-medium transition-all"
              style={{
                background: subTab === t ? "var(--color-surface-card)" : "transparent",
                color: subTab === t ? "var(--color-text-primary)" : "var(--color-text-secondary)",
                boxShadow: subTab === t ? "var(--shadow-card)" : "none",
              }}
            >
              {t === 'record' ? '记录' : '计划'}
            </button>
          ))}
        </div>
      </div>

      {/* ─── Plan View ─── */}
      {subTab === 'plan' && (
        <TrainingPlanView plans={plans} group={topTab} />
      )}

      {/* ─── Record View ─── */}
      {subTab === 'record' && (
      <div className="px-4 pt-0 pb-10 space-y-4">
        {/* ─── 当前计划提示（画布 plan-hint） ─── */}
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.35, ease: [0.32, 0.72, 0, 1] }}
        >
          <div className="flex items-center gap-2.5 p-3.5" style={{ background: "var(--color-surface-card)", borderRadius: "16px", boxShadow: "var(--shadow-card)" }}>
            <div
              className="flex-shrink-0 flex h-[34px] w-[34px] items-center justify-center rounded-[12px]"
              style={{
                background: topTab === 'cardio' ? "rgba(16,185,129,0.14)" : "var(--lifeflow-brand-50)",
                color: topTab === 'cardio' ? "#10B981" : "var(--lifeflow-primary)",
              }}
            >
              {topTab === 'cardio' ? <Heart className="h-[18px] w-[18px]" /> : <Dumbbell className="h-[18px] w-[18px]" />}
            </div>
            <div className="min-w-0 flex-1">
              <h2 className="text-[14px] font-semibold leading-[1.3]" style={{ color: "var(--color-text-primary)" }}>
                当前计划 · {topTab === 'cardio' ? '有氧' : '力量'}
              </h2>
              <p className="text-[12px] leading-[1.4] mt-0.5 truncate" style={{ color: "var(--color-text-secondary)" }}>
                {topTab === 'cardio' ? '每周 1-2 次 · 每次 30-60 分钟' : '每周 2-3 次 · 每次选 3-4 个动作'}
              </p>
            </div>
            {topTab === 'strength' && (
              <span
                className="shrink-0 px-2.5 py-1 rounded-full text-[11px] font-semibold whitespace-nowrap"
                style={{ background: `${currentPrimaryColor}15`, color: currentPrimaryColor }}
              >
                {new Date().getMonth() + 1}月主项 · {currentPrimaryLabel}
              </span>
            )}
          </div>
        </motion.div>

        {/* ─── Today Summary Card（画布 4 格） ─── */}
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.35, ease: [0.32, 0.72, 0, 1] }}
          className="p-4"
          style={{ background: "var(--color-surface-card)", borderRadius: "16px", boxShadow: "var(--shadow-card)" }}
        >
          <div className="flex items-center justify-between mb-4">
            <h2 className="flex items-center gap-1.5 text-[17px] font-bold tracking-[-0.01em]" style={{ color: "var(--color-text-primary)" }}>
              <Dumbbell className="h-4 w-4" style={{ color: "var(--lifeflow-primary)" }} />
              今日训练
            </h2>
            <span className="text-[12px] font-semibold px-[11px] py-1 rounded-full" style={{ background: "var(--lifeflow-brand-50)", color: "var(--lifeflow-primary)" }}>
              {todayStats.totalSets} 组
            </span>
          </div>
          <div className="grid grid-cols-4">
            {[
              { label: "训练次数", value: todayStats.sessionCount },
              { label: "动作数", value: todayStats.exerciseCount },
              { label: "总重量 kg", value: todayStats.totalWeight },
              { label: "平均 RPE", value: todayStats.avgRpe || "-" },
            ].map((st, i) => (
              <div
                key={st.label}
                className="flex min-w-0 flex-col items-center gap-[5px] px-1 py-1"
                style={i > 0 ? { borderLeft: "1px solid var(--lifeflow-border)" } : undefined}
              >
                <span className="max-w-full truncate font-mono text-[20px] font-bold leading-none tabular-nums tracking-[-0.02em]" style={{ color: "var(--color-text-primary)" }}>
                  {st.value}
                </span>
                <span className="whitespace-nowrap text-[11px] leading-none" style={{ color: "var(--color-text-secondary)" }}>
                  {st.label}
                </span>
              </div>
            ))}
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
            className="flex w-full h-12 items-center justify-center gap-2 text-white text-[15px] font-semibold active:opacity-90 transition-opacity rounded-[14px]"
            style={{ background: "var(--lifeflow-primary)" }}
          >
            <Plus className="h-[18px] w-[18px]" />
            记录训练
          </button>
        </motion.div>

        {/* ─── Training System Cards（画布体系卡） ─── */}
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1, duration: 0.35, ease: [0.32, 0.72, 0, 1] }}
        >
          <div className="flex items-center justify-between px-1 pb-0.5">
            <h2 className="flex items-center gap-1.5 text-[17px] font-bold tracking-[-0.01em]" style={{ color: "var(--color-text-primary)" }}>
              <Target className="h-4 w-4" style={{ color: "var(--lifeflow-primary)" }} />
              {topTab === 'cardio' ? '有氧体系' : '力量体系'}
            </h2>
          </div>
          <div className="flex flex-col mt-2.5" style={{ gap: 12 }}>
            {visibleSystems.map((sys) => {
              const Icon = sys.icon;
              const isPrimary = sys.type === currentPrimary;
              return (
                <div
                  key={sys.type}
                  className="relative overflow-hidden p-4"
                  style={{
                    background: "var(--color-surface-card)",
                    borderRadius: "16px",
                    border: `1.5px solid ${isPrimary ? sys.color : "var(--lifeflow-border)"}`,
                    boxShadow: isPrimary ? `0 0 0 2px ${sys.color}15, var(--shadow-card)` : "var(--shadow-card)",
                  }}
                >
                  {/* Primary badge */}
                  {isPrimary && (
                    <div
                      className="absolute top-0 right-0 flex items-center gap-1 px-2.5 py-[5px] text-[11px] font-semibold rounded-bl-[12px]"
                      style={{ background: sys.color, color: "#fff" }}
                    >
                      <Star className="h-3 w-3" />
                      本月主项
                    </div>
                  )}

                  {/* Head */}
                  <div className="flex items-center gap-2.5">
                    <div
                      className="flex-shrink-0 flex h-10 w-10 items-center justify-center rounded-[12px]"
                      style={{ background: `${sys.color}15` }}
                    >
                      <Icon className="h-5 w-5" style={{ color: sys.color }} />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-1.5 min-w-0">
                        <h3 className="text-[15px] font-semibold leading-[1.3] truncate" style={{ color: "var(--color-text-primary)" }}>
                          {sys.label}
                        </h3>
                        <span
                          className="shrink-0 text-[11px] font-semibold px-2 py-0.5 rounded-md"
                          style={{ background: `${sys.color}15`, color: sys.color }}
                        >
                          {sys.subtitle}
                        </span>
                      </div>
                      <p className="text-[12px] leading-[1.4] mt-[3px] truncate" style={{ color: "var(--color-text-secondary)" }}>
                        {sys.schedule}
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => openRecordSheet(sys.type)}
                      className="flex-shrink-0 inline-flex items-center gap-1 h-[34px] px-3.5 rounded-[10px] text-[13px] font-semibold active:opacity-90 transition-opacity"
                      style={{ background: sys.color, color: "#fff" }}
                    >
                      <Plus className="h-3.5 w-3.5" />
                      记录
                    </button>
                  </div>

                  {/* Notes */}
                  <p className="text-[12px] leading-[1.5] mt-2.5" style={{ color: "var(--color-text-secondary)" }}>
                    {sys.notes}
                  </p>

                  {/* Exercise quick-action chips */}
                  <div className="flex flex-wrap mt-3" style={{ gap: 8 }}>
                    {sys.exercises.map((ex) => (
                      <button
                        key={ex}
                        type="button"
                        onClick={() => openRecordSheet(sys.type, ex)}
                        className="inline-flex items-center gap-1 rounded-[10px] px-3 py-[7px] text-[13px] font-medium active:opacity-90 transition-opacity"
                        style={{ background: `${sys.color}15`, color: sys.color }}
                      >
                        <Plus className="h-[13px] w-[13px]" />
                        {ex}
                      </button>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        </motion.div>

        {/* ─── Week Stats Card（画布 4 格） ─── */}
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.14, duration: 0.35, ease: [0.32, 0.72, 0, 1] }}
          className="p-4"
          style={{ background: "var(--color-surface-card)", borderRadius: "16px", boxShadow: "var(--shadow-card)" }}
        >
          <div className="flex items-center justify-between mb-4">
            <h2 className="flex items-center gap-1.5 text-[17px] font-bold tracking-[-0.01em]" style={{ color: "var(--color-text-primary)" }}>
              <TrendingUp className="h-4 w-4" style={{ color: "var(--lifeflow-primary)" }} />
              本周统计
            </h2>
            <span className="text-[12px]" style={{ color: "var(--color-text-secondary)" }}>{weekRange}</span>
          </div>

          <div className="grid grid-cols-4">
            {[
              { label: "训练天数", value: weekStats.days },
              { label: "总组数", value: weekStats.totalSets },
              { label: "动作数", value: weekStats.totalExercises },
              { label: "次数", value: weekStats.sessionCount },
            ].map((stat, i) => (
              <div
                key={stat.label}
                className="flex min-w-0 flex-col items-center gap-[5px] px-1 py-1"
                style={i > 0 ? { borderLeft: "1px solid var(--lifeflow-border)" } : undefined}
              >
                <span className="max-w-full truncate font-mono text-[20px] font-bold leading-none tabular-nums tracking-[-0.02em]" style={{ color: "var(--color-text-primary)" }}>
                  {stat.value}
                </span>
                <span className="whitespace-nowrap text-[11px] leading-none" style={{ color: "var(--color-text-secondary)" }}>{stat.label}</span>
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

        {/* ─── Recent Training Card（画布按日分组） ─── */}
        {recentGroups.length > 0 && (
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.16, duration: 0.35, ease: [0.32, 0.72, 0, 1] }}
            className="p-4"
            style={{ background: "var(--color-surface-card)", borderRadius: "16px", boxShadow: "var(--shadow-card)" }}
          >
            <h2 className="flex items-center gap-1.5 text-[17px] font-bold tracking-[-0.01em] mb-1" style={{ color: "var(--color-text-primary)" }}>
              <CalendarDays className="h-4 w-4" style={{ color: "var(--lifeflow-primary)" }} />
              最近训练
            </h2>

            {recentGroups.map((group) => (
              <div key={group.date}>
                <span className="block text-[13px] font-semibold mt-3.5 mb-1.5 first:mt-1" style={{ color: "var(--color-text-secondary)" }}>
                  {formatDateGroup(group.date)}
                </span>
                <div className="space-y-2">
                  {group.sessions.map((s) => {
                    const isExpanded = expandedSession === s.id;
                    const ttColor = getTrainingTypeColor(s.trainingType);
                    const totalSets = s.exercises.reduce((t, e) => t + e.sets.length, 0);
                    const firstExercise = s.exercises[0];
                    const firstSet = firstExercise?.sets?.[0];
                    const sumText = `${totalSets}组 × ${firstSet?.reps ?? 0}次${firstSet && firstSet.weight > 0 ? ` × ${fmtWeight(firstSet.weight)}kg` : ""}`;
                    return (
                      <div
                        key={s.id}
                        className="rounded-xl overflow-hidden"
                        style={{ background: "var(--lifeflow-muted)" }}
                      >
                        <button
                          type="button"
                          className="w-full flex items-center gap-2 px-3 py-[11px] text-left active:opacity-80 transition-opacity"
                          onClick={() => setExpandedSession(isExpanded ? null : s.id!)}
                          aria-expanded={isExpanded}
                        >
                          <span className="shrink-0 w-2 h-2 rounded-full" style={{ background: ttColor }} />
                          <span className="flex-1 min-w-0 text-[14px] font-medium truncate" style={{ color: "var(--color-text-primary)" }}>
                            {s.exercises.map((e) => e.exerciseName).join(" · ")}
                          </span>
                          <span className="shrink-0 text-[12px] tabular-nums whitespace-nowrap" style={{ color: "var(--color-text-secondary)" }}>
                            {sumText}
                          </span>
                          {firstSet && firstSet.rpe > 0 && (
                            <span className="shrink-0 px-[7px] py-0.5 rounded-md text-[11px] font-semibold" style={{ background: "var(--color-surface-card)", color: ttColor }}>
                              RPE {firstSet.rpe}
                            </span>
                          )}
                          <ChevronDown
                            className="h-4 w-4 shrink-0 transition-transform duration-200"
                            style={{ color: "var(--color-text-disabled)", transform: isExpanded ? "rotate(180deg)" : "none" }}
                          />
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
                              <div className="px-3 pb-3 space-y-1.5">
                                {s.exercises.map((ex, ei) => (
                                  <div key={ei}>
                                    <span className="block text-[12px] font-medium mb-1" style={{ color: "var(--color-text-primary)" }}>
                                      {ex.exerciseName}
                                    </span>
                                    {ex.sets.map((set, si) => (
                                      <div
                                        key={si}
                                        className="flex items-center gap-2 px-2.5 py-[7px] mb-1.5 rounded-[10px] text-[12px] tabular-nums"
                                        style={{ background: "var(--color-surface-card)" }}
                                      >
                                        <span className="font-semibold" style={{ color: "var(--color-text-primary)" }}>第{set.setNumber}组</span>
                                        <span style={{ color: "var(--color-text-secondary)" }}>
                                          {set.reps}次 × {set.weight > 0 ? `${fmtWeight(set.weight)}kg` : "自重"}
                                        </span>
                                        {set.rpe > 0 && (
                                          <span className="ml-auto" style={{ color: "var(--color-text-disabled)" }}>RPE {set.rpe}</span>
                                        )}
                                        {set.isPR && (
                                          <span className="px-[7px] py-[1px] rounded-full text-[10px] font-bold" style={{ background: "#F59E0B15", color: "#F59E0B" }}>
                                            PR
                                          </span>
                                        )}
                                      </div>
                                    ))}
                                  </div>
                                ))}
                                <button
                                  type="button"
                                  onClick={() => handleDelete(s.id!, s.date)}
                                  className="inline-flex items-center gap-1 text-[12px] font-medium px-2.5 py-1.5 rounded-lg mt-1 active:opacity-70"
                                  style={{ color: "var(--color-expense)" }}
                                >
                                  <Trash2 className="w-[13px] h-[13px]" />删除
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
            className="flex flex-col items-center gap-3 py-7 px-4"
            style={{ background: "var(--color-surface-card)", borderRadius: "16px", boxShadow: "var(--shadow-card)" }}
          >
            <div className="w-14 h-14 rounded-[18px] flex items-center justify-center" style={{ background: "var(--lifeflow-brand-50)" }}>
              <Dumbbell className="w-7 h-7" style={{ color: "var(--lifeflow-primary)" }} />
            </div>
            <p className="text-[14px] leading-[1.5] text-center" style={{ color: "var(--color-text-secondary)" }}>还没有训练记录，开始你的第一次训练吧</p>
            <button
              type="button"
              onClick={() => openRecordSheet()}
              className="inline-flex items-center gap-1.5 h-10 px-5 rounded-[12px] text-white text-[14px] font-semibold active:opacity-90 transition-opacity"
              style={{ background: "var(--lifeflow-primary)" }}
            >
              <Plus className="h-4 w-4" />记录训练
            </button>
          </motion.div>
        )}
      </div>
      )}
        </>
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
              className="fixed bottom-0 left-0 right-0 z-50 rounded-t-[20px] px-5 pt-[18px] pb-8"
              style={{ background: "var(--color-surface-card)", maxHeight: "85vh", overflowY: "auto", paddingBottom: "calc(var(--bottom-nav-height, 83px) + 20px)" }}
            >
              <div className="flex items-center justify-between mb-5">
                <h2 className="text-[17px] font-bold tracking-[-0.01em]" style={{ color: "var(--color-text-primary)" }}>记录训练</h2>
                <button onClick={() => setShowRecord(false)} className="text-[15px] font-medium" style={{ color: "var(--lifeflow-primary)" }}>取消</button>
              </div>

              {/* Training Type Selector（T21-6：仅显示当前 Tab 分组） */}
              <div className="mb-5">
                <label className="text-[13px] font-medium mb-2 block" style={{ color: "var(--color-text-secondary)" }}>训练类型</label>
                <div className="flex flex-wrap gap-2">
                  {visibleSystems.map((sys) => (
                    <button
                      key={sys.type}
                      type="button"
                      onClick={() => {
                        setSelectedTrainingType(sys.type);
                        setExerciseName("");
                      }}
                      className="px-[13px] py-2 rounded-[10px] text-[13px] transition-all"
                      style={{
                        background: selectedTrainingType === sys.type ? sys.color : `${sys.color}15`,
                        color: selectedTrainingType === sys.type ? "#fff" : sys.color,
                        fontWeight: selectedTrainingType === sys.type ? 600 : 500,
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
                    onFocus={() => { setShowExerciseDropdown(true); setExerciseInputFocus(true); }}
                    onBlur={() => setExerciseInputFocus(false)}
                    placeholder="输入或选择动作名"
                    className="w-full h-11 px-3.5 rounded-[12px] text-[15px] outline-none transition-colors"
                    style={{
                      background: exerciseInputFocus ? "var(--color-surface-card)" : "var(--lifeflow-muted)",
                      color: "var(--color-text-primary)",
                      border: `1.5px solid ${exerciseInputFocus ? "var(--lifeflow-primary)" : "transparent"}`,
                    }}
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
                  { label: "重量 kg", value: weight, min: 0, max: 500, step: 5, set: setWeight },
                ].map((field) => (
                  <div key={field.label}>
                    <label className="text-[13px] font-medium mb-1.5 block" style={{ color: "var(--color-text-secondary)" }}>{field.label}</label>
                    <div className="flex items-center rounded-[12px] overflow-hidden" style={{ background: "var(--lifeflow-muted)" }}>
                      <button
                        onClick={() => field.set(clamp(field.value - field.step, field.min, field.max))}
                        className="w-9 h-10 flex items-center justify-center active:opacity-60"
                      >
                        <Minus className="w-4 h-4" style={{ color: "var(--color-text-secondary)" }} />
                      </button>
                      <span className="flex-1 text-center font-mono text-[15px] font-semibold tabular-nums" style={{ color: "var(--color-text-primary)" }}>
                        {field.value}
                      </span>
                      <button
                        onClick={() => field.set(clamp(field.value + field.step, field.min, field.max))}
                        className="w-9 h-10 flex items-center justify-center active:opacity-60"
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
                <div className="flex gap-[5px]">
                  {RPE_OPTIONS.map((r) => (
                    <button
                      key={r}
                      onClick={() => setRpe(rpe === r ? null : r)}
                      className="flex-1 min-w-0 h-9 rounded-[10px] text-[13px] tabular-nums transition-colors"
                      style={{
                        background: rpe === r ? "var(--lifeflow-primary)" : "var(--lifeflow-muted)",
                        color: rpe === r ? "#fff" : "var(--color-text-secondary)",
                        fontWeight: rpe === r ? 600 : 500,
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
                className="flex w-full h-12 items-center justify-center gap-2 mt-1.5 rounded-[12px] text-white text-[15px] font-semibold active:opacity-90 transition-opacity disabled:opacity-50"
                style={{ background: "var(--lifeflow-primary)" }}
              >
                <Check className="h-4 w-4" />
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

function TrainingPlanView({ plans, group }: { plans: TrainingPlan[]; group: 'strength' | 'cardio' }) {
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

  // T21-6：按当前 Tab 分组过滤计划（力量 Tab 只看力量类，有氧 Tab 只看有氧类）
  const groupPlans = useMemo(
    () => plans.filter(p => p.active && (TRAINING_SYSTEMS.find(s => s.type === p.trainingType)?.group ?? 'strength') === group),
    [plans, group],
  );
  const staple = groupPlans.filter(p => p.role === 'staple');
  const rotating = groupPlans.filter(p => p.role === 'rotating');

  if (groupPlans.length === 0) {
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
      {/* Monthly rotation summary（T21-6：仅力量组展示轮换专项） */}
      {group === 'strength' && (
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
      )}

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
