"use client";

import { useMemo, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { ChevronLeft, Target, ListTodo as ListIcon, CheckCircle2 } from "lucide-react";
import { useLiveQuery } from "dexie-react-hooks";
import { efficiencyDB, getAllGoals, type Goal, type ScheduleTask } from "@/lib/db/efficiency.db";
import { getScheduleTasksByDate, updateScheduleTask } from "@/lib/db/efficiency.db";
import { showToast } from "@/components/ui/Toast";

// ============================================================
// 分类视图 · 目标 / 习惯 / 琐事
// ============================================================

const QUADRANT_COLORS: Record<string, string> = {
  q1: "var(--state-error)",
  q2: "var(--lifeflow-primary)",
  q3: "var(--state-warning)",
  q4: "var(--color-text-disabled)",
};

const QUADRANT_LABELS: Record<string, string> = {
  q1: "重要且紧急",
  q2: "重要不紧急",
  q3: "不重要紧急",
  q4: "不重要不紧急",
};

const CATEGORIES = [
  { key: "task", label: "目标", icon: Target, color: "var(--lifeflow-primary)" },
  { key: "chore", label: "琐事", icon: ListIcon, color: "var(--state-warning)" },
] as const;

function todayStr(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

export default function CategoryPage() {
  const router = useRouter();

  // Data sources
  const goals = useLiveQuery(() => efficiencyDB.goals.where("status").notEqual("archived").toArray(), [], [] as Goal[]);
  const allScheduleTasks = useLiveQuery(() => efficiencyDB.scheduleTasks.toArray(), [], [] as ScheduleTask[]);
  const today = todayStr();

  // Goals grouped by category (task=all goals, chore=loose scheduleTasks)
  const categorized = useMemo(() => {
    const map: Record<string, { goal: Goal | null; tasks: ScheduleTask[] }[]> = {
      task: [],
      chore: [],
    };

    // 1. Goals → "task" category (includes goalType='count' and 'habit')
    const activeGoals = (goals ?? []).filter(g => g.status === "active" || g.status === "paused");
    for (const goal of activeGoals) {
      const tasks = (allScheduleTasks ?? []).filter(t => t.goalId === goal.id);
      map.task.push({ goal, tasks });
    }

    // 2. Chores → "chore" category
    const choreTasks = (allScheduleTasks ?? []).filter(t => t.category === "chore");
    for (const t of choreTasks) {
      map.chore.push({ goal: null, tasks: [t] });
    }

    return map;
  }, [goals, allScheduleTasks]);

  const toggleTask = useCallback(async (task: ScheduleTask) => {
    await updateScheduleTask(task.id, { isCompleted: !task.isCompleted });
  }, []);

  const changeGoalQuadrant = useCallback(async (goal: Goal, quadrant: string) => {
    await efficiencyDB.goals.update(goal.id, { quadrant: quadrant as Goal["quadrant"] });
    showToast({ type: "success", message: `已移至「${QUADRANT_LABELS[quadrant]}」` });
  }, []);

  return (
    <div className="mx-auto px-4 pt-8 pb-[100px]" style={{ maxWidth: 430 }}>
      {/* Header */}
      <div className="flex items-center gap-2.5 mb-4">
        <button onClick={() => router.back()} className="flex items-center justify-center w-8 h-8 rounded-lg active:opacity-60" style={{ background: "var(--color-surface-card)", border: "1px solid var(--lifeflow-border)" }}>
          <ChevronLeft className="w-5 h-5" style={{ color: "var(--color-text-primary)" }} />
        </button>
        <div>
          <h1 className="text-[22px] font-bold tracking-[-0.022em]" style={{ color: "var(--color-text-primary)" }}>
            分类视图
          </h1>
          <p className="text-[12px] font-medium mt-0.5" style={{ color: "var(--color-text-secondary)" }}>
            目标 · 琐事
          </p>
        </div>
      </div>

      {/* Category sections */}
      {CATEGORIES.map((cat) => {
        const items = categorized[cat.key];
        if (items.length === 0) return null;

        return (
          <div key={cat.key} className="mb-6">
            {/* Category header */}
            <div className="flex items-center gap-2 mb-3 px-1">
              <cat.icon className="w-4 h-4" style={{ color: cat.color }} />
              <h2 className="text-[15px] font-semibold" style={{ color: "var(--color-text-primary)" }}>
                {cat.label}
              </h2>
              <span className="text-[12px]" style={{ color: "var(--color-text-disabled)" }}>
                {items.length} 项
              </span>
            </div>

            {/* Items grouped by quadrant */}
            {(["q1", "q2", "q3", "q4"] as const).map((q) => {
              const qItems = items.filter((item) => {
                if (cat.key === "task") return item.goal?.quadrant === q || (!item.goal?.quadrant && q === "q2");
                if (cat.key === "chore") return item.tasks[0]?.quadrant === q || (!item.tasks[0]?.quadrant && q === "q2");
                return false;
              });
              if (qItems.length === 0) return null;

              return (
                <div key={q} className="mb-3">
                  {/* Quadrant sub-header */}
                  <div className="flex items-center gap-2 px-2 mb-2">
                    <div className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: QUADRANT_COLORS[q] }} />
                    <span className="text-[11px] font-medium" style={{ color: QUADRANT_COLORS[q] }}>
                      {QUADRANT_LABELS[q]}
                    </span>
                  </div>

                  {/* Items */}
                  <div className="flex flex-col gap-2">
                    {qItems.map((item) => {
                      const isGoal = cat.key === "task" && item.goal;
                      const tasks = item.tasks;

                      if (isGoal) {
                        const goal = item.goal!;
                        const isHabit = goal.goalType === "habit";
                        const totalTasks = tasks.length;
                        const doneTasks = tasks.filter(t => t.isCompleted).length;
                        const pct = isHabit
                          ? (goal.streak ? Math.min(100, Math.round((goal.streak / (goal.targetCount || 30)) * 100)) : 0)
                          : totalTasks > 0 ? Math.round((doneTasks / totalTasks) * 100) : goal.progress;

                        return (
                          <motion.div
                            key={goal.id}
                            whileTap={{ scale: 0.98 }}
                            onClick={() => router.push(`/efficiency/create?id=${goal.id}`)}
                            className="rounded-[16px] p-3.5 flex items-center gap-3 cursor-pointer"
                            style={{
                              backgroundColor: "var(--color-surface-card)",
                              boxShadow: "var(--shadow-card)",
                              borderLeft: `3px solid ${goal.color || QUADRANT_COLORS[q]}`,
                            }}
                          >
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2">
                                <div className="text-[14px] font-semibold truncate" style={{ color: "var(--color-text-primary)" }}>
                                  {goal.title}
                                </div>
                                {isHabit && (
                                  <span className="text-[10px] px-1.5 py-0.5 rounded-full font-medium" style={{ background: "rgba(16,185,129,0.12)", color: "#10B981" }}>习惯</span>
                                )}
                              </div>
                              <div className="text-[11px] mt-0.5" style={{ color: "var(--color-text-secondary)" }}>
                                {isHabit
                                  ? `连续 ${goal.streak || 0} 天 · 目标 ${goal.targetCount || 30} 天`
                                  : tasks.length > 0 ? `${doneTasks}/${totalTasks} 项完成` : "暂无任务"}
                              </div>
                            </div>
                            <div className="w-9 h-9 rounded-full flex items-center justify-center text-[11px] font-bold flex-shrink-0" style={{ background: pct === 100 ? "rgba(52,199,89,0.15)" : "var(--lifeflow-muted)", color: pct === 100 ? "#34C759" : "var(--color-text-secondary)" }}>
                              {pct}%
                            </div>
                          </motion.div>
                        );
                      }

                      // Habit / Chore items
                      return tasks.map((task) => (
                        <motion.div
                          key={task.id}
                          whileTap={{ scale: 0.98 }}
                          onClick={() => toggleTask(task)}
                          className={`rounded-[16px] p-3.5 flex items-center gap-3 cursor-pointer ${task.isCompleted ? "opacity-50" : ""}`}
                          style={{
                            backgroundColor: "var(--color-surface-card)",
                            boxShadow: "var(--shadow-card)",
                          }}
                        >
                          <div
                            className={`w-5 h-5 rounded-full border-2 flex items-center justify-center flex-shrink-0 ${task.isCompleted ? "" : ""}`}
                            style={{
                              borderColor: task.isCompleted ? "#34C759" : "var(--lifeflow-border)",
                              background: task.isCompleted ? "#34C759" : "transparent",
                            }}
                          >
                            {task.isCompleted && <CheckCircle2 className="w-4 h-4 text-white" />}
                          </div>
                          <div className="flex-1 min-w-0">
                            <div
                              className="text-[14px] font-medium truncate"
                              style={{
                                color: "var(--color-text-primary)",
                                textDecoration: task.isCompleted ? "line-through" : "none",
                              }}
                            >
                              {task.title}
                            </div>
                            {task.note && (
                              <div className="text-[11px] mt-0.5 truncate" style={{ color: "var(--color-text-disabled)" }}>
                                {task.note}
                              </div>
                            )}
                          </div>
                          <span className="w-6 h-6 rounded-full flex items-center justify-center text-[9px] font-bold flex-shrink-0" style={{ background: `${QUADRANT_COLORS[q]}15`, color: QUADRANT_COLORS[q] }}>
                            {q.toUpperCase()}
                          </span>
                        </motion.div>
                      ));
                    })}
                  </div>
                </div>
              );
            })}
          </div>
        );
      })}

      {/* Empty state */}
      {Object.values(categorized).every(v => v.length === 0) && (
        <div className="flex flex-col items-center justify-center py-16 text-center">
          <div className="w-16 h-16 rounded-2xl flex items-center justify-center mb-4" style={{ background: "var(--lifeflow-brand-50)" }}>
            <Target className="w-8 h-8" style={{ color: "var(--lifeflow-primary)" }} />
          </div>
          <h3 className="text-[16px] font-semibold mb-1" style={{ color: "var(--color-text-primary)" }}>暂无分类内容</h3>
          <p className="text-[13px]" style={{ color: "var(--color-text-secondary)" }}>
            创建目标或习惯后，这里会自动分组展示
          </p>
        </div>
      )}
    </div>
  );
}
