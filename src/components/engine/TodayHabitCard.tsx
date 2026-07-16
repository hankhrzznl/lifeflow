"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import { motion } from "framer-motion";
import { Flame, Check, ChevronDown, ChevronUp } from "lucide-react";
import { dailyAtomService } from "@/lib/engine/DailyAtomService";
import { goalService } from "@/lib/engine/GoalService";
import type { EngineDailyAtom, EngineGoal } from "@/lib/engine/types";

// ============================================================
// 类型
// ============================================================

interface TodayHabitCardProps {
  goalId: string;
  onQuickCheckIn: (atomId: string) => void;
  onOpenDetail: (atomId: string, atom: EngineDailyAtom) => void;
}

// ============================================================
// 辅助：计算连续打卡天数
// ============================================================

async function calculateStreak(atoms: EngineDailyAtom[]): Promise<number> {
  if (atoms.length === 0) return 0;

  // 收集已完成日期的集合
  const completedDates = new Set(
    atoms.filter((a) => a.isCompleted).map((a) => a.scheduledDate)
  );

  // 从今天往前数
  let count = 0;
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  for (let i = 0; i < 365; i++) {
    const d = new Date(today);
    d.setDate(d.getDate() - i);
    const dateStr = d.toISOString().slice(0, 10);
    if (completedDates.has(dateStr)) {
      count++;
    } else if (i === 0) {
      // 今天还没打卡，不算断签，继续从昨天开始算
      continue;
    } else {
      break;
    }
  }

  return count;
}

// ============================================================
// 组件
// ============================================================

export default function TodayHabitCard({
  goalId,
  onQuickCheckIn,
  onOpenDetail,
}: TodayHabitCardProps) {
  const [goal, setGoal] = useState<EngineGoal | null>(null);
  const [todayAtoms, setTodayAtoms] = useState<EngineDailyAtom[]>([]);
  const [streak, setStreak] = useState(0);
  const [expanded, setExpanded] = useState(false);
  const [loading, setLoading] = useState(true);
  const [checkingId, setCheckingId] = useState<string | null>(null);

  // 今天日期
  const today = useMemo(() => new Date().toISOString().slice(0, 10), []);

  const loadData = useCallback(async () => {
    try {
      const [g, allGoalAtoms] = await Promise.all([
        goalService.getById(goalId),
        // 加载该目标下所有原子项（用于计算连续天数）
        (async () => {
          // 通过 milestones → weeklyTasks → atoms 获取
          const { milestoneService } = await import("@/lib/engine/MilestoneService");
          const { weeklyTaskService } = await import("@/lib/engine/WeeklyTaskService");
          const mss = await milestoneService.listByGoal(goalId);
          const allAtoms: EngineDailyAtom[] = [];
          for (const ms of mss) {
            const wts = await weeklyTaskService.listByMilestone(ms.id);
            for (const wt of wts) {
              const atoms = await dailyAtomService.listByWeeklyTask(wt.id);
              allAtoms.push(...atoms);
            }
          }
          return allAtoms;
        })(),
      ]);
      setGoal(g ?? null);

      // 筛选今天的原子项
      const todayList = allGoalAtoms.filter((a) => a.scheduledDate === today);
      setTodayAtoms(todayList);

      // 计算连续天数
      const st = await calculateStreak(allGoalAtoms);
      setStreak(st);
    } catch (err) {
      console.error("[TodayHabitCard] 加载失败:", err);
    } finally {
      setLoading(false);
    }
  }, [goalId, today]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const completedCount = todayAtoms.filter((a) => a.isCompleted).length;
  const totalCount = todayAtoms.length;
  const completionRate = totalCount > 0 ? Math.round((completedCount / totalCount) * 100) : 0;
  const allDone = totalCount > 0 && completedCount === totalCount;

  const handleQuickCheck = async (atomId: string) => {
    setCheckingId(atomId);
    try {
      onQuickCheckIn(atomId);
    } finally {
      setTimeout(() => {
        setCheckingId(null);
        loadData();
      }, 500);
    }
  };

  if (loading) {
    return <div className="skeleton h-28 rounded-2xl flex-shrink-0 w-64" />;
  }

  if (!goal || totalCount === 0) return null;

  // 进度环 SVG
  const radius = 28;
  const circumference = 2 * Math.PI * radius;
  const strokeDashoffset = circumference * (1 - completionRate / 100);

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      className={`relative flex-shrink-0 w-72 rounded-2xl border overflow-hidden ${
        allDone
          ? "bg-emerald-50 dark:bg-emerald-900/10 border-emerald-200 dark:border-emerald-800"
          : "bg-white dark:bg-gray-900 border-gray-100 dark:border-gray-800 shadow-sm"
      }`}
    >
      <div className="p-4">
        <div className="flex items-start gap-3">
          {/* 进度环 */}
          <div className="relative flex-shrink-0">
            <svg width={64} height={64} className="-rotate-90">
              <circle
                cx={32} cy={32} r={radius}
                fill="none"
                stroke="currentColor"
                className="text-gray-100 dark:text-gray-800"
                strokeWidth={5}
              />
              <motion.circle
                cx={32} cy={32} r={radius}
                fill="none"
                stroke={allDone ? "#10B981" : "#6366F1"}
                strokeWidth={5}
                strokeLinecap="round"
                strokeDasharray={circumference}
                initial={{ strokeDashoffset: circumference }}
                animate={{ strokeDashoffset }}
                transition={{ duration: 0.8, ease: "easeOut" }}
              />
            </svg>
            <div className="absolute inset-0 flex items-center justify-center">
              <span className="text-xs font-bold text-gray-700 dark:text-gray-300">
                {completionRate}%
              </span>
            </div>
          </div>

          {/* 内容 */}
          <div className="flex-1 min-w-0">
            <h3 className="font-semibold text-sm text-gray-900 dark:text-white truncate">
              {goal.title}
            </h3>
            <div className="flex items-center gap-1 mt-1">
              {streak > 0 && (
                <span className={`flex items-center gap-0.5 text-xs font-medium ${
                  streak >= 30 ? "text-orange-500" :
                  streak >= 7 ? "text-amber-500" : "text-gray-500"
                }`}>
                  <Flame className="w-3.5 h-3.5" fill="currentColor" />
                  {streak}天
                </span>
              )}
              <span className="text-xs text-gray-400">
                {completedCount}/{totalCount}
              </span>
            </div>
          </div>
        </div>

        {/* 原子项列表（展开时） */}
        <AnimatedExpand expanded={expanded}>
          <div className="space-y-1 mt-3 pt-3 border-t border-gray-100 dark:border-gray-800">
            {todayAtoms.map((atom) => (
              <div
                key={atom.id}
                className={`flex items-center gap-2 px-2 py-1.5 rounded-lg text-xs ${
                  atom.isCompleted
                    ? "bg-emerald-50/60 dark:bg-emerald-900/10 text-gray-400"
                    : "hover:bg-gray-50 dark:hover:bg-gray-800/30 text-gray-600 dark:text-gray-400"
                }`}
              >
                {atom.isCompleted ? (
                  <Check className="w-3.5 h-3.5 text-emerald-500 flex-shrink-0" />
                ) : (
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      handleQuickCheck(atom.id);
                    }}
                    disabled={checkingId === atom.id}
                    className="w-4 h-4 rounded border border-gray-300 dark:border-gray-600 flex-shrink-0 hover:border-indigo-400 transition-colors"
                  />
                )}
                <span className={atom.isCompleted ? "line-through flex-1 truncate" : "flex-1 truncate"}>
                  {atom.title}
                </span>
                {atom.isCompleted && atom.score && (
                  <span className="text-amber-500 flex-shrink-0">
                    {atom.score}/10
                  </span>
                )}
                {!atom.isCompleted && (
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      onOpenDetail(atom.id, atom);
                    }}
                    className="text-xs text-indigo-500 hover:text-indigo-600 flex-shrink-0"
                  >
                    详细
                  </button>
                )}
              </div>
            ))}
          </div>
        </AnimatedExpand>
      </div>

      {/* 展开/折叠按钮 */}
      {todayAtoms.length > 0 && (
        <button
          onClick={() => setExpanded((v) => !v)}
          className="w-full py-1.5 flex items-center justify-center text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors"
        >
          {expanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
        </button>
      )}
    </motion.div>
  );
}

// ============================================================
// 展开动画辅助
// ============================================================

function AnimatedExpand({ expanded, children }: { expanded: boolean; children: React.ReactNode }) {
  return (
    <motion.div
      initial={false}
      animate={{
        height: expanded ? "auto" : 0,
        opacity: expanded ? 1 : 0,
      }}
      transition={{ duration: 0.2 }}
      className="overflow-hidden"
    >
      {children}
    </motion.div>
  );
}
