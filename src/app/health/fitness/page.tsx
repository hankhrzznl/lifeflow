"use client";

import { useState, useEffect, useMemo, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useRouter } from "next/navigation";
import { useHealthStore } from "@/lib/store/healthStore";
import type { MuscleGroupV2, ExerciseV2, WorkoutSession, WorkoutExercise, ExerciseSet } from "@/lib/db/health.db";
import { addExerciseV2 } from "@/lib/db/health.db";
import BottomSheet from "@/components/common/BottomSheet";
import { showToast } from "@/components/ui/Toast";
import {
  Plus,
  Dumbbell,
  Flame,
  Clock,
  ChevronLeft,
  Layers,
  Trophy,
  TrendingUp,
  Search,
  ChevronRight,
  ChevronDown,
  Trash2,
  X,
  Grip,
  Footprints,
  Triangle,
  Circle,
  PanelBottom,
  Armchair,
  Target,
  Minus,
  ArrowUp,
  ArrowDown,
} from "lucide-react";

// ============================================================
// 常量
// ============================================================

const MUSCLE_GROUP_ICONS: Record<string, React.ComponentType<{ className?: string }>> = {
  Armchair,
  PanelBottom,
  Footprints,
  Triangle,
  Grip,
  Circle,
};

const RPE_GRADIENT_STOPS = [
  { rpe: 1, color: "#007AFF", label: "很轻松" },
  { rpe: 3, color: "#007AFF", label: "很轻松" },
  { rpe: 4, color: "#34C759", label: "适中" },
  { rpe: 6, color: "#34C759", label: "适中" },
  { rpe: 7, color: "#FF9500", label: "困难" },
  { rpe: 8, color: "#FF9500", label: "困难" },
  { rpe: 9, color: "#FF3B30", label: "极限" },
  { rpe: 10, color: "#FF3B30", label: "极限" },
];

const RPE_DESCRIPTIONS: Record<number, string> = {
  1: "很轻松，几乎没有感觉",
  2: "很轻松，几乎没有感觉",
  3: "轻松，能持续很久",
  4: "轻松，能持续很久",
  5: "适中，能持续较长时间",
  6: "适中，能持续较长时间",
  7: "较重，还能做3次",
  8: "很重，还能做2次",
  9: "非常重，还能做1次",
  10: "极限，无法再做",
};

function getRPEColor(rpe: number): string {
  if (rpe <= 3) return "#007AFF";
  if (rpe <= 6) return "#34C759";
  if (rpe <= 8) return "#FF9500";
  return "#FF3B30";
}

const RPE_GRADIENT_CSS = `linear-gradient(to right, ${RPE_GRADIENT_STOPS
  .filter((s, i, arr) => i === 0 || s.rpe !== arr[i - 1].rpe)
  .map((s) => `${s.color} ${((s.rpe - 1) / 9) * 100}%`)
  .join(", ")})`;

// ============================================================
// 辅助函数
// ============================================================

const todayStr = () => new Date().toISOString().slice(0, 10);

function computeWorkoutSummary(session: WorkoutSession) {
  const exerciseCount = session.exercises.length;
  const totalSets = session.exercises.reduce((sum, e) => sum + e.sets.length, 0);
  return { exerciseCount, totalSets };
}

function getLastWorkoutForExercise(
  exerciseId: string,
  sessions: WorkoutSession[]
): WorkoutExercise | null {
  for (const s of sessions) {
    const found = s.exercises.find((e) => e.exerciseId === exerciseId);
    if (found) return found;
  }
  return null;
}

function computeWorkoutExerciseAvg(we: WorkoutExercise) {
  const sets = we.sets;
  if (sets.length === 0) return { avgReps: 0, avgWeight: 0, avgRpe: 0 };
  const avgReps = Math.round(sets.reduce((s, x) => s + x.reps, 0) / sets.length);
  const avgWeight = Math.round(sets.reduce((s, x) => s + x.weight, 0) / sets.length);
  const avgRpe = Math.round(sets.reduce((s, x) => s + x.rpe, 0) / sets.length);
  return { avgReps, avgWeight, avgRpe };
}

// ============================================================
// 页面主组件
// ============================================================

export default function FitnessPage() {
  const router = useRouter();

  const {
    muscleGroupsV2,
    exercisesV2,
    workoutSessions,
    weeklyStats,
    loadFitnessDataV2,
    addWorkoutSessionV2,
    deleteWorkoutSessionV2,
  } = useHealthStore();

  const [loading, setLoading] = useState(true);

  // UI state
  const [expandedMuscle, setExpandedMuscle] = useState<string | null>(null);
  const [expandedWorkout, setExpandedWorkout] = useState<string | null>(null);

  // Sheet state
  const [sheetOpen, setSheetOpen] = useState(false);
  const [sheetStep, setSheetStep] = useState<"select" | "record">("select");
  const [currentExercises, setCurrentExercises] = useState<WorkoutExercise[]>([]);
  const [selectedExerciseIdx, setSelectedExerciseIdx] = useState(0);
  const [addSheetOpen, setAddSheetOpen] = useState(false);
  const [newExerciseName, setNewExerciseName] = useState("");
  const [newExerciseGroupId, setNewExerciseGroupId] = useState("");

  // Search
  const [searchQuery, setSearchQuery] = useState("");

  // ─── 加载数据 ────────────────────────────────────────────

  useEffect(() => {
    loadFitnessDataV2().finally(() => setLoading(false));
  }, [loadFitnessDataV2]);

  // ─── 筛选后的肌群和动作 ──────────────────────────────────

  const filteredMuscleGroups = useMemo(() => {
    if (!searchQuery.trim()) return muscleGroupsV2;
    const q = searchQuery.toLowerCase();
    return muscleGroupsV2.filter((g) => {
      const exercisesInGroup = exercisesV2.filter((e) => e.muscleGroupId === g.id);
      const matchGroup = g.name.toLowerCase().includes(q);
      const matchSub = g.subMuscles.some((s) => s.toLowerCase().includes(q));
      const matchExercise = exercisesInGroup.some((e) => e.name.toLowerCase().includes(q));
      return matchGroup || matchSub || matchExercise;
    });
  }, [muscleGroupsV2, exercisesV2, searchQuery]);

  const getExercisesForGroup = useCallback(
    (groupId: string) => exercisesV2.filter((e) => e.muscleGroupId === groupId),
    [exercisesV2]
  );

  const getMuscleGroupById = useCallback(
    (id: string) => muscleGroupsV2.find((g) => g.id === id),
    [muscleGroupsV2]
  );

  // ─── 添加动作到当前训练 ────────────────────────────────

  const addExerciseToWorkout = useCallback(
    (exercise: ExerciseV2) => {
      setCurrentExercises((prev) => {
        const exists = prev.find((e) => e.exerciseId === exercise.id);
        if (exists) return prev;
        const group = getMuscleGroupById(exercise.muscleGroupId);
        return [
          ...prev,
          {
            exerciseId: exercise.id,
            exerciseName: exercise.name,
            muscleGroupName: group?.name ?? "",
            sets: [],
          },
        ];
      });
      setSelectedExerciseIdx(currentExercises.length);
      setSheetStep("record");
    },
    [currentExercises.length, getMuscleGroupById]
  );

  const removeCurrentExercise = useCallback((index: number) => {
    setCurrentExercises((prev) => prev.filter((_, i) => i !== index));
    setSelectedExerciseIdx((prev) => Math.max(0, prev - 1));
  }, []);

  const addSetToExercise = useCallback((index: number) => {
    setCurrentExercises((prev) =>
      prev.map((e, i) => {
        if (i !== index) return e;
        const setNumber = e.sets.length + 1;
        return {
          ...e,
          sets: [
            ...e.sets,
            {
              id: crypto.randomUUID(),
              setNumber,
              reps: 10,
              weight: 20,
              rpe: 5,
              isPR: false,
            },
          ],
        };
      })
    );
  }, []);

  const updateSet = useCallback(
    (exerciseIdx: number, setId: string, field: keyof ExerciseSet, value: number | boolean) => {
      setCurrentExercises((prev) =>
        prev.map((e, i) => {
          if (i !== exerciseIdx) return e;
          return {
            ...e,
            sets: e.sets.map((s) => (s.id === setId ? { ...s, [field]: value } : s)),
          };
        })
      );
    },
    []
  );

  const removeSet = useCallback((exerciseIdx: number, setId: string) => {
    setCurrentExercises((prev) =>
      prev.map((e, i) => {
        if (i !== exerciseIdx) return e;
        const newSets = e.sets.filter((s) => s.id !== setId);
        return {
          ...e,
          sets: newSets.map((s, idx) => ({ ...s, setNumber: idx + 1 })),
        };
      })
    );
  }, []);

  // ─── 保存训练 ────────────────────────────────────────────

  const handleSaveWorkout = useCallback(async () => {
    const validExercises = currentExercises.filter((e) => e.sets.length > 0);
    if (validExercises.length === 0) {
      showToast({ type: "warning", message: "请至少添加一组训练" });
      return;
    }

    await addWorkoutSessionV2({
      date: todayStr(),
      exercises: validExercises,
      notes: "",
    });

    showToast({ type: "success", message: "训练已保存" });
    setSheetOpen(false);
    setSheetStep("select");
    setCurrentExercises([]);
    setSelectedExerciseIdx(0);
    setSearchQuery("");
  }, [currentExercises, addWorkoutSessionV2]);

  // ─── 删除训练 ───────────────────────────────────────────

  const handleDeleteWorkout = useCallback(
    async (id: string) => {
      await deleteWorkoutSessionV2(id);
      showToast({ type: "success", message: "训练记录已删除" });
    },
    [deleteWorkoutSessionV2]
  );

  // ─── 添加自定义动作 ─────────────────────────────────────

  const handleAddCustomExercise = useCallback(async () => {
    if (!newExerciseName.trim() || !newExerciseGroupId) {
      showToast({ type: "warning", message: "请输入动作名称并选择肌群" });
      return;
    }
    await addExerciseV2({
      muscleGroupId: newExerciseGroupId,
      name: newExerciseName.trim(),
      isCustom: true,
    });
    showToast({ type: "success", message: "自定义动作已添加" });
    setNewExerciseName("");
    setAddSheetOpen(false);
    loadFitnessDataV2();
  }, [newExerciseName, newExerciseGroupId, loadFitnessDataV2]);

  // ─── 关闭 Sheet 重置 ─────────────────────────────────────

  const handleCloseSheet = useCallback(() => {
    setSheetOpen(false);
    setSheetStep("select");
    setCurrentExercises([]);
    setSelectedExerciseIdx(0);
    setSearchQuery("");
  }, []);

  // ─── 开始新训练 ─────────────────────────────────────────

  const handleStartWorkout = useCallback(() => {
    setCurrentExercises([]);
    setSelectedExerciseIdx(0);
    setSheetStep("select");
    setSearchQuery("");
    setSheetOpen(true);
  }, []);

  // ============================================================
  // 渲染
  // ============================================================

  if (loading) {
    return (
      <div className="min-h-screen bg-[#F5F5F7] flex items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <div className="w-8 h-8 border-2 border-[#FF9500] border-t-transparent rounded-full animate-spin" />
          <span className="text-sm text-gray-400">加载中...</span>
        </div>
      </div>
    );
  }

  const recentSessions = [...workoutSessions]
    .sort((a, b) => b.date.localeCompare(a.date))
    .slice(0, 20);

  return (
    <div className="min-h-screen bg-[#F5F5F7] pb-32">
      <div className="max-w-2xl mx-auto px-5 pt-8">
        {/* ======================================================== */}
        {/* Section 1: Header + Weekly Summary                       */}
        {/* ======================================================== */}

        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <button
              onClick={() => router.push("/health")}
              className="w-9 h-9 rounded-full bg-white shadow-sm flex items-center justify-center"
            >
              <ChevronLeft className="w-5 h-5 text-gray-500" />
            </button>
            <div>
              <h1 className="text-2xl font-bold text-gray-900">力量训练</h1>
              <p className="text-sm text-gray-500 mt-0.5">记录每一次训练</p>
            </div>
          </div>
        </div>

        {/* Action Pills */}
        <div className="flex items-center gap-2 mb-6">
          <button
            onClick={handleStartWorkout}
            className="flex items-center gap-1.5 px-4 py-2 rounded-full bg-[#FF9500] text-white text-sm font-medium shadow-sm"
          >
            <Plus className="w-4 h-4" />
            添加训练
          </button>
          <button
            onClick={() => router.push("/health/fitness/warmup")}
            className="flex items-center gap-1.5 px-4 py-2 rounded-full bg-white text-gray-700 text-sm font-medium shadow-sm border border-gray-200"
          >
            <Flame className="w-4 h-4" />
            热身拉伸
          </button>
          <button
            onClick={() => showToast({ type: "info", message: "功能开发中" })}
            className="flex items-center gap-1.5 px-4 py-2 rounded-full bg-white text-gray-700 text-sm font-medium shadow-sm border border-gray-200"
          >
            <Clock className="w-4 h-4" />
            创建计划
          </button>
        </div>

        {/* Weekly Summary Card */}
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-gradient-to-br from-[#FF9500] to-[#FF3B30] rounded-2xl shadow-md p-5 mb-6 text-white"
        >
          <div className="flex items-center gap-2 mb-4">
            <Target className="w-5 h-5" />
            <span className="text-sm font-medium opacity-90">本周概况</span>
          </div>
          <div className="grid grid-cols-4 gap-4">
            <div className="text-center">
              <Dumbbell className="w-5 h-5 mx-auto mb-1 opacity-80" />
              <div className="text-xl font-bold">{weeklyStats.sessions}</div>
              <div className="text-xs opacity-70 mt-0.5">训练次数</div>
            </div>
            <div className="text-center">
              <Layers className="w-5 h-5 mx-auto mb-1 opacity-80" />
              <div className="text-xl font-bold">{weeklyStats.muscles}</div>
              <div className="text-xs opacity-70 mt-0.5">覆盖肌群</div>
            </div>
            <div className="text-center">
              <Trophy className="w-5 h-5 mx-auto mb-1 opacity-80" />
              <div className="text-xl font-bold">{weeklyStats.prs}</div>
              <div className="text-xs opacity-70 mt-0.5">个人最佳</div>
            </div>
            <div className="text-center">
              <TrendingUp className="w-5 h-5 mx-auto mb-1 opacity-80" />
              <div className="text-xl font-bold">{weeklyStats.totalVolume}</div>
              <div className="text-xs opacity-70 mt-0.5">总训练量</div>
            </div>
          </div>
        </motion.div>

        {/* ======================================================== */}
        {/* Section 2: Muscle Groups List                            */}
        {/* ======================================================== */}

        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.06 }}
          className="bg-white rounded-2xl shadow-sm p-4 mb-6"
        >
          <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-3">
            肌群训练
          </h2>
          <div className="space-y-2">
            {muscleGroupsV2.map((group) => {
              const isExpanded = expandedMuscle === group.id;
              const IconComp = MUSCLE_GROUP_ICONS[group.icon] ?? Dumbbell;
              const groupExercises = getExercisesForGroup(group.id);

              return (
                <div
                  key={group.id}
                  className="rounded-xl overflow-hidden border border-gray-100"
                >
                  {/* Header */}
                  <button
                    onClick={() => setExpandedMuscle(isExpanded ? null : group.id)}
                    className="w-full flex items-center gap-3 p-3 bg-[#FFF9F2] hover:bg-[#FFF3E5] transition-colors"
                  >
                    <div className="w-8 h-8 rounded-lg bg-[#FF9500]/10 flex items-center justify-center">
                      <IconComp className="w-4 h-4 text-[#FF9500]" />
                    </div>
                    <div className="flex-1 text-left">
                      <div className="text-sm font-medium text-gray-900">{group.name}</div>
                      <div className="text-xs text-gray-400">
                        {group.subMuscles.length} 个子肌群
                      </div>
                    </div>
                    <motion.div
                      animate={{ rotate: isExpanded ? 180 : 0 }}
                      transition={{ duration: 0.2 }}
                    >
                      <ChevronDown className="w-4 h-4 text-gray-400" />
                    </motion.div>
                  </button>

                  {/* Expanded Content */}
                  <AnimatePresence>
                    {isExpanded && (
                      <motion.div
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: "auto", opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        transition={{ duration: 0.25 }}
                        className="overflow-hidden"
                      >
                        <div className="px-3 pb-3 pt-2">
                          {/* Sub-muscle tags */}
                          <div className="flex flex-wrap gap-1.5 mb-3">
                            {group.subMuscles.map((sub) => (
                              <span
                                key={sub}
                                className="text-xs px-2 py-0.5 rounded-full bg-[#FFF3E5] text-[#FF9500] font-medium"
                              >
                                {sub}
                              </span>
                            ))}
                          </div>

                          {/* Exercises */}
                          <div className="space-y-1">
                            {groupExercises.map((ex) => (
                              <div
                                key={ex.id}
                                className="flex items-center gap-2 py-2 px-2 rounded-lg hover:bg-gray-50 transition-colors"
                              >
                                <div className="w-1.5 h-1.5 rounded-full bg-[#FF9500]" />
                                <span className="text-sm text-gray-700">{ex.name}</span>
                                {ex.isCustom && (
                                  <span className="text-[10px] px-1.5 py-0.5 rounded bg-gray-100 text-gray-500">
                                    自定义
                                  </span>
                                )}
                              </div>
                            ))}
                          </div>

                          {/* Add custom exercise button */}
                          <button
                            onClick={() => {
                              setNewExerciseGroupId(group.id);
                              setAddSheetOpen(true);
                            }}
                            className="w-full mt-2 py-2 rounded-lg border border-dashed border-gray-200 text-gray-400 text-xs font-medium flex items-center justify-center gap-1.5 hover:border-[#FF9500] hover:text-[#FF9500] transition-colors"
                          >
                            <Plus className="w-3.5 h-3.5" />
                            添加自定义动作
                          </button>
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
              );
            })}
          </div>
        </motion.div>

        {/* ======================================================== */}
        {/* Section 3: Recent Workouts                               */}
        {/* ======================================================== */}

        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="bg-white rounded-2xl shadow-sm p-4 mb-6"
        >
          <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-3">
            最近训练
          </h2>

          {recentSessions.length === 0 ? (
            <div className="text-center py-8 text-gray-400 text-sm">
              <Dumbbell className="w-8 h-8 mx-auto mb-2 opacity-30" />
              暂无训练记录，开始你的第一次训练吧
            </div>
          ) : (
            <div className="space-y-2">
              {recentSessions.map((session) => {
                const isExpanded = expandedWorkout === session.id;
                const { exerciseCount, totalSets } = computeWorkoutSummary(session);

                return (
                  <div
                    key={session.id}
                    className="rounded-xl overflow-hidden border border-gray-100"
                  >
                    {/* Session card header */}
                    <button
                      onClick={() =>
                        setExpandedWorkout(isExpanded ? null : session.id!)
                      }
                      className="w-full flex items-center gap-3 p-3 hover:bg-gray-50 transition-colors"
                    >
                      <div className="w-8 h-8 rounded-lg bg-[#FFF3E5] flex items-center justify-center">
                        <Dumbbell className="w-4 h-4 text-[#FF9500]" />
                      </div>
                      <div className="flex-1 text-left">
                        <div className="text-sm font-medium text-gray-900">
                          {session.date}
                        </div>
                        <div className="text-xs text-gray-400">
                          {exerciseCount}个动作 · {totalSets}组
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            if (session.id) handleDeleteWorkout(session.id);
                          }}
                          className="w-7 h-7 rounded-full flex items-center justify-center text-gray-300 hover:text-red-400 hover:bg-red-50 transition-colors"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                        <motion.div
                          animate={{ rotate: isExpanded ? 90 : 0 }}
                          transition={{ duration: 0.2 }}
                        >
                          <ChevronRight className="w-4 h-4 text-gray-400" />
                        </motion.div>
                      </div>
                    </button>

                    {/* Expanded: exercises with sets */}
                    <AnimatePresence>
                      {isExpanded && (
                        <motion.div
                          initial={{ height: 0, opacity: 0 }}
                          animate={{ height: "auto", opacity: 1 }}
                          exit={{ height: 0, opacity: 0 }}
                          transition={{ duration: 0.25 }}
                          className="overflow-hidden"
                        >
                          <div className="px-3 pb-3 border-t border-gray-50">
                            {session.exercises.map((we, ei) => {
                              const avg = computeWorkoutExerciseAvg(we);
                              return (
                                <div
                                  key={ei}
                                  className="py-2 border-b border-gray-50 last:border-0"
                                >
                                  <div className="text-sm font-medium text-gray-800 mb-1.5">
                                    {we.exerciseName}
                                  </div>
                                  <div className="flex flex-wrap gap-1.5">
                                    {we.sets.map((s) => (
                                      <span
                                        key={s.id}
                                        className="text-xs px-2 py-0.5 rounded-md bg-gray-100 text-gray-600"
                                      >
                                        {s.reps}次×{s.weight}kg
                                        <span
                                          className="ml-1 font-medium"
                                          style={{ color: getRPEColor(s.rpe) }}
                                        >
                                          RPE{s.rpe}
                                        </span>
                                        {s.isPR && (
                                          <span className="ml-1 text-[#FF9500]">★</span>
                                        )}
                                      </span>
                                    ))}
                                  </div>
                                  <div className="flex items-center gap-3 mt-1 text-[11px] text-gray-400">
                                    <span>
                                      平均 {avg.avgReps}次 × {avg.avgWeight}kg
                                    </span>
                                    <span style={{ color: getRPEColor(avg.avgRpe) }}>
                                      平均RPE {avg.avgRpe}
                                    </span>
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </div>
                );
              })}
            </div>
          )}
        </motion.div>
      </div>

      {/* ============================================================ */}
      {/* Workout Recording BottomSheet                                */}
      {/* ============================================================ */}
      <BottomSheet
        open={sheetOpen}
        onClose={handleCloseSheet}
        title={sheetStep === "select" ? "记录训练" : "记录组数"}
      >
        {sheetStep === "select" ? (
          <SelectExerciseStep
            muscleGroupsV2={filteredMuscleGroups}
            exercisesV2={exercisesV2}
            searchQuery={searchQuery}
            onSearchChange={setSearchQuery}
            currentExercises={currentExercises}
            onAddExercise={addExerciseToWorkout}
            getExercisesForGroup={getExercisesForGroup}
          />
        ) : (
          <RecordSetsStep
            currentExercises={currentExercises}
            selectedExerciseIdx={selectedExerciseIdx}
            onSelectExercise={(idx) => {
              setSelectedExerciseIdx(idx);
            }}
            onAddSet={addSetToExercise}
            onUpdateSet={updateSet}
            onRemoveSet={removeSet}
            onRemoveExercise={removeCurrentExercise}
            onAddMoreExercises={() => setSheetStep("select")}
            onSave={handleSaveWorkout}
            workoutSessions={workoutSessions}
          />
        )}
      </BottomSheet>

      {/* ============================================================ */}
      {/* Add Custom Exercise Mini-Sheet                               */}
      {/* ============================================================ */}
      <BottomSheet
        open={addSheetOpen}
        onClose={() => setAddSheetOpen(false)}
        title="添加自定义动作"
      >
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">
              动作名称
            </label>
            <input
              type="text"
              value={newExerciseName}
              onChange={(e) => setNewExerciseName(e.target.value)}
              placeholder="例如：上斜哑铃卧推"
              className="w-full px-3 py-2.5 rounded-xl border border-gray-200 text-sm focus:outline-none focus:border-[#FF9500] focus:ring-1 focus:ring-[#FF9500]/20"
            />
          </div>
          <button
            onClick={handleAddCustomExercise}
            className="w-full py-3 rounded-xl bg-[#FF9500] text-white font-medium text-sm"
          >
            添加动作
          </button>
        </div>
      </BottomSheet>
    </div>
  );
}

// ============================================================
// Step 1: Select Exercise
// ============================================================

function SelectExerciseStep({
  muscleGroupsV2,
  exercisesV2,
  searchQuery,
  onSearchChange,
  currentExercises,
  onAddExercise,
  getExercisesForGroup,
}: {
  muscleGroupsV2: MuscleGroupV2[];
  exercisesV2: ExerciseV2[];
  searchQuery: string;
  onSearchChange: (q: string) => void;
  currentExercises: WorkoutExercise[];
  onAddExercise: (ex: ExerciseV2) => void;
  getExercisesForGroup: (groupId: string) => ExerciseV2[];
}) {
  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(() => {
    if (muscleGroupsV2.length > 0) return new Set([muscleGroupsV2[0].id]);
    return new Set();
  });

  const toggleGroup = (id: string) => {
    setExpandedGroups((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const addedIds = new Set(currentExercises.map((e) => e.exerciseId));

  return (
    <div className="flex flex-col" style={{ minHeight: "60vh" }}>
      {/* Search */}
      <div className="relative mb-4">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
        <input
          type="text"
          value={searchQuery}
          onChange={(e) => onSearchChange(e.target.value)}
          placeholder="搜索动作或肌群..."
          className="w-full pl-9 pr-4 py-2.5 rounded-xl border border-gray-200 text-sm focus:outline-none focus:border-[#FF9500] focus:ring-1 focus:ring-[#FF9500]/20"
        />
        {searchQuery && (
          <button
            onClick={() => onSearchChange("")}
            className="absolute right-3 top-1/2 -translate-y-1/2"
          >
            <X className="w-4 h-4 text-gray-400" />
          </button>
        )}
      </div>

      {/* Muscle groups list */}
      <div className="flex-1 overflow-y-auto space-y-1 -mx-5 px-5">
        {muscleGroupsV2.map((group) => {
          const IconComp = MUSCLE_GROUP_ICONS[group.icon] ?? Dumbbell;
          const isExpanded = expandedGroups.has(group.id);
          const groupExercises = getExercisesForGroup(group.id);

          return (
            <div key={group.id} className="rounded-xl overflow-hidden">
              <button
                onClick={() => toggleGroup(group.id)}
                className="w-full flex items-center gap-3 p-3 hover:bg-[#FFF9F2] transition-colors"
              >
                <div className="w-7 h-7 rounded-lg bg-[#FF9500]/10 flex items-center justify-center">
                  <IconComp className="w-3.5 h-3.5 text-[#FF9500]" />
                </div>
                <span className="text-sm font-medium text-gray-800 flex-1 text-left">
                  {group.name}
                </span>
                <span className="text-xs text-gray-400 mr-2">
                  {groupExercises.length}
                </span>
                <motion.div
                  animate={{ rotate: isExpanded ? 180 : 0 }}
                  transition={{ duration: 0.2 }}
                >
                  <ChevronDown className="w-4 h-4 text-gray-400" />
                </motion.div>
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
                    <div className="pb-2">
                      {groupExercises.map((ex) => {
                        const isAdded = addedIds.has(ex.id);
                        return (
                          <div
                            key={ex.id}
                            className="flex items-center gap-3 px-3 py-2 hover:bg-gray-50 transition-colors"
                          >
                            <div className="w-1.5 h-1.5 rounded-full bg-gray-300" />
                            <span className="text-sm text-gray-700 flex-1">
                              {ex.name}
                            </span>
                            <button
                              onClick={() => onAddExercise(ex)}
                              disabled={isAdded}
                              className={`w-7 h-7 rounded-full flex items-center justify-center transition-colors ${
                                isAdded
                                  ? "bg-[#34C759]/10 text-[#34C759]"
                                  : "bg-[#FF9500]/10 text-[#FF9500] hover:bg-[#FF9500] hover:text-white"
                              }`}
                            >
                              <Plus className="w-4 h-4" />
                            </button>
                          </div>
                        );
                      })}
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          );
        })}
      </div>

      {/* Bottom summary */}
      <div className="sticky bottom-0 -mx-5 px-5 pt-3 pb-1 bg-white border-t border-gray-100">
        <div className="flex items-center justify-between">
          <span className="text-sm text-gray-500">
            已选 <span className="font-semibold text-[#FF9500]">{currentExercises.length}</span> 个动作
          </span>
        </div>
      </div>
    </div>
  );
}

// ============================================================
// Step 2: Record Sets
// ============================================================

function RecordSetsStep({
  currentExercises,
  selectedExerciseIdx,
  onSelectExercise,
  onAddSet,
  onUpdateSet,
  onRemoveSet,
  onRemoveExercise,
  onAddMoreExercises,
  onSave,
  workoutSessions,
}: {
  currentExercises: WorkoutExercise[];
  selectedExerciseIdx: number;
  onSelectExercise: (idx: number) => void;
  onAddSet: (idx: number) => void;
  onUpdateSet: (exerciseIdx: number, setId: string, field: keyof ExerciseSet, value: number | boolean) => void;
  onRemoveSet: (exerciseIdx: number, setId: string) => void;
  onRemoveExercise: (idx: number) => void;
  onAddMoreExercises: () => void;
  onSave: () => void;
  workoutSessions: WorkoutSession[];
}) {
  const selectedExercise = currentExercises[selectedExerciseIdx];

  if (currentExercises.length === 0) {
    return (
      <div className="text-center py-12">
        <p className="text-gray-400 text-sm">请先添加至少一个动作</p>
        <button
          onClick={onAddMoreExercises}
          className="mt-3 px-4 py-2 rounded-xl bg-[#FF9500] text-white text-sm font-medium"
        >
          返回选择动作
        </button>
      </div>
    );
  }

  return (
    <div className="flex flex-col" style={{ minHeight: "60vh" }}>
      {/* Exercise tabs */}
      <div className="flex items-center gap-2 overflow-x-auto pb-3 mb-3 -mx-5 px-5 border-b border-gray-100">
        {currentExercises.map((we, idx) => (
          <button
            key={idx}
            onClick={() => onSelectExercise(idx)}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium whitespace-nowrap shrink-0 transition-colors ${
              idx === selectedExerciseIdx
                ? "bg-[#FF9500] text-white"
                : "bg-gray-100 text-gray-600"
            }`}
          >
            {we.exerciseName}
            {we.sets.length > 0 && (
              <span
                className={`w-4 h-4 rounded-full text-[10px] flex items-center justify-center ${
                  idx === selectedExerciseIdx
                    ? "bg-white/20 text-white"
                    : "bg-gray-200 text-gray-500"
                }`}
              >
                {we.sets.length}
              </span>
            )}
          </button>
        ))}
        <button
          onClick={onAddMoreExercises}
          className="shrink-0 w-7 h-7 rounded-full bg-gray-100 flex items-center justify-center text-gray-400 hover:bg-[#FFF3E5] hover:text-[#FF9500] transition-colors"
        >
          <Plus className="w-3.5 h-3.5" />
        </button>
      </div>

      {/* Selected exercise: sets recording */}
      {selectedExercise && (
        <>
          <div className="flex items-center justify-between mb-3">
            <div>
              <h3 className="text-sm font-semibold text-gray-900">
                {selectedExercise.exerciseName}
              </h3>
              <p className="text-xs text-gray-400">组数记录</p>
            </div>
            <button
              onClick={() => onRemoveExercise(selectedExerciseIdx)}
              className="w-7 h-7 rounded-full flex items-center justify-center text-gray-300 hover:text-red-400 hover:bg-red-50 transition-colors"
            >
              <Trash2 className="w-3.5 h-3.5" />
            </button>
          </div>

          {/* Set headers */}
          <div className="flex items-center gap-2 text-[10px] text-gray-400 font-medium mb-2 px-2">
            <div className="w-10">组次</div>
            <div className="flex-1 text-center">次数</div>
            <div className="flex-1 text-center">重量(kg)</div>
            <div className="flex-1 text-center">RPE</div>
            <div className="w-6" />
          </div>

          {/* Sets */}
          <div className="space-y-2 mb-4">
            {selectedExercise.sets.map((s) => (
              <motion.div
                key={s.id}
                initial={{ opacity: 0, x: -12 }}
                animate={{ opacity: 1, x: 0 }}
                className="flex items-center gap-2 p-2 rounded-xl bg-gray-50"
              >
                <span className="w-10 text-xs font-medium text-gray-500 text-center">
                  第{s.setNumber}组
                </span>

                {/* Reps */}
                <div className="flex-1 flex items-center">
                  <button
                    onClick={() => {
                      if (s.reps > 1)
                        onUpdateSet(selectedExerciseIdx, s.id, "reps", s.reps - 1);
                    }}
                    className="w-6 h-6 rounded-full bg-gray-200 flex items-center justify-center text-gray-500"
                  >
                    <Minus className="w-3 h-3" />
                  </button>
                  <input
                    type="number"
                    value={s.reps}
                    onChange={(e) =>
                      onUpdateSet(
                        selectedExerciseIdx,
                        s.id,
                        "reps",
                        parseInt(e.target.value) || 0
                      )
                    }
                    className="w-12 text-center text-sm font-medium bg-transparent outline-none [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                    min={0}
                  />
                  <button
                    onClick={() =>
                      onUpdateSet(selectedExerciseIdx, s.id, "reps", s.reps + 1)
                    }
                    className="w-6 h-6 rounded-full bg-gray-200 flex items-center justify-center text-gray-500"
                  >
                    <Plus className="w-3 h-3" />
                  </button>
                </div>

                {/* Weight */}
                <div className="flex-1 flex items-center">
                  <button
                    onClick={() => {
                      if (s.weight > 0)
                        onUpdateSet(
                          selectedExerciseIdx,
                          s.id,
                          "weight",
                          Math.max(0, s.weight - 2.5)
                        );
                    }}
                    className="w-6 h-6 rounded-full bg-gray-200 flex items-center justify-center text-gray-500"
                  >
                    <Minus className="w-3 h-3" />
                  </button>
                  <input
                    type="number"
                    value={s.weight}
                    onChange={(e) =>
                      onUpdateSet(
                        selectedExerciseIdx,
                        s.id,
                        "weight",
                        parseFloat(e.target.value) || 0
                      )
                    }
                    className="w-12 text-center text-sm font-medium bg-transparent outline-none [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                    step={2.5}
                    min={0}
                  />
                  <button
                    onClick={() =>
                      onUpdateSet(
                        selectedExerciseIdx,
                        s.id,
                        "weight",
                        s.weight + 2.5
                      )
                    }
                    className="w-6 h-6 rounded-full bg-gray-200 flex items-center justify-center text-gray-500"
                  >
                    <Plus className="w-3 h-3" />
                  </button>
                </div>

                {/* RPE */}
                <div className="flex-1">
                  <input
                    type="range"
                    min={1}
                    max={10}
                    step={1}
                    value={s.rpe}
                    onChange={(e) =>
                      onUpdateSet(
                        selectedExerciseIdx,
                        s.id,
                        "rpe",
                        parseInt(e.target.value)
                      )
                    }
                    className="w-full h-1.5 rounded-full appearance-none cursor-pointer"
                    style={{
                      background: RPE_GRADIENT_CSS,
                    }}
                  />
                  <div
                    className="text-[10px] font-semibold text-center mt-0.5"
                    style={{ color: getRPEColor(s.rpe) }}
                  >
                    {s.rpe}
                  </div>
                </div>

                {/* Delete set */}
                <button
                  onClick={() => onRemoveSet(selectedExerciseIdx, s.id)}
                  className="w-6 h-6 rounded-full flex items-center justify-center text-gray-300 hover:text-red-400"
                >
                  <X className="w-3 h-3" />
                </button>
              </motion.div>
            ))}
          </div>

          {/* RPE legend for selected exercise's last set */}
          {selectedExercise.sets.length > 0 && (
            <div className="mb-4 px-2 py-2 rounded-xl bg-gray-50">
              <div className="text-xs text-gray-500">
                RPE {selectedExercise.sets[selectedExercise.sets.length - 1].rpe}:{" "}
                {RPE_DESCRIPTIONS[selectedExercise.sets[selectedExercise.sets.length - 1].rpe] ?? ""}
              </div>
              <div className="flex items-center gap-1 mt-2 h-1.5 rounded-full overflow-hidden">
                {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((r) => (
                  <div
                    key={r}
                    className="flex-1 h-full"
                    style={{ backgroundColor: getRPEColor(r) }}
                  />
                ))}
              </div>
              <div className="flex justify-between mt-1">
                <span className="text-[9px] text-[#007AFF]">很轻松</span>
                <span className="text-[9px] text-[#34C759]">适中</span>
                <span className="text-[9px] text-[#FF9500]">困难</span>
                <span className="text-[9px] text-[#FF3B30]">极限</span>
              </div>
            </div>
          )}

          {/* Add set button */}
          <button
            onClick={() => onAddSet(selectedExerciseIdx)}
            className="w-full py-2.5 rounded-xl border border-dashed border-[#FF9500]/30 text-[#FF9500] text-sm font-medium flex items-center justify-center gap-1.5 mb-4 hover:bg-[#FFF9F2] transition-colors"
          >
            <Plus className="w-4 h-4" />
            添加一组
          </button>

          {/* ==================================================== */}
          {/* Step 3: History Comparison                            */}
          {/* ==================================================== */}
          {(() => {
            const last = getLastWorkoutForExercise(
              selectedExercise.exerciseId,
              workoutSessions
            );
            if (!last) return null;
            const lastAvg = computeWorkoutExerciseAvg(last);
            const curr = selectedExercise;
            const currAvg = computeWorkoutExerciseAvg(curr);

            return (
              <div className="mb-4 p-3 rounded-xl bg-blue-50 border border-blue-100">
                <div className="text-xs font-medium text-blue-700 mb-2">
                  上次训练对比
                </div>
                <div className="text-xs text-blue-600 mb-1">
                  上次：{last.sets.length}组×{lastAvg.avgReps}次×{lastAvg.avgWeight}kg，平均RPE {lastAvg.avgRpe}
                </div>
                <div className="text-xs text-blue-600">
                  本次：{curr.sets.length}组×{currAvg.avgReps}次×{currAvg.avgWeight}kg，平均RPE {currAvg.avgRpe}
                  <span className="ml-1">
                    {currAvg.avgWeight > lastAvg.avgWeight ? (
                      <ArrowUp className="inline w-3 h-3 text-[#34C759]" />
                    ) : currAvg.avgWeight < lastAvg.avgWeight ? (
                      <ArrowDown className="inline w-3 h-3 text-[#FF3B30]" />
                    ) : null}
                  </span>
                </div>
              </div>
            );
          })()}
        </>
      )}

      {/* Save button */}
      <button
        onClick={onSave}
        className="w-full py-3 rounded-xl bg-[#FF9500] text-white font-medium text-sm mt-auto"
      >
        保存训练
      </button>
    </div>
  );
}
