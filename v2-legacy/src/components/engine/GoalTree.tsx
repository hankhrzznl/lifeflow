"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { ChevronRight, Pencil, Pause, Trash2, Check } from "lucide-react";
import { GoalEngine } from "@/services/goal-engine";
import type {
  DailyAtom,
  Milestone,
  WeeklyTask,
} from "@/types/goal";
import type { Goal } from "@/lib/types";
import { PRIORITY_CONFIG } from "@/lib/types";
import { PRIORITY_LABELS } from "@/types/goal";
import { mainGoalKey } from "@/lib/goalMapping";
import KnittingProgress from "@/components/ui/KnittingProgress";
import EmptyState from "@/components/ui/EmptyState";

// ============================================================
// 类型
// ============================================================

interface GoalTreeProps {
  goalId: number;
  expandedByDefault?: boolean;
  showProgress?: boolean;
  onAtomCheck?: (atomId: string, checked: boolean) => void;
  onEditGoal?: (goalId: number) => void;
  onPauseGoal?: (goalId: number) => void;
  onDeleteGoal?: (goalId: number) => void;
  onDragEnd?: (result: { sourceId: string; targetId: string }) => void;
}

interface TreeMilestone extends Milestone {
  weeklyTasks: TreeWeeklyTask[];
}
interface TreeWeeklyTask extends WeeklyTask {
  dailyAtoms: DailyAtom[];
}

// ============================================================
// 工具函数
// ============================================================

const categoryLabels: Record<string, string> = {
  exam: "备考", fitness: "运动", habit: "习惯", finance: "财务", custom: "自定义",
};

const categoryColors: Record<string, { bg: string; text: string }> = {
  exam:    { bg: "var(--info-light)", text: "var(--info)" },
  fitness: { bg: "var(--success-light)", text: "var(--success)" },
  habit:   { bg: "var(--brand-primary-light)", text: "var(--brand-primary)" },
  finance: { bg: "var(--warning-light)", text: "var(--warning)" },
  custom:  { bg: "var(--brand-primary-light)", text: "var(--brand-primary)" },
};

function getPriorityConfig(priority: string) {
  return PRIORITY_LABELS[priority as keyof typeof PRIORITY_LABELS] ?? PRIORITY_LABELS.p4;
}

// ============================================================
// L4 原子项节点 — checkbox
// ============================================================

function DailyAtomNode({
  atom, isExpanded, onCheck,
}: {
  atom: DailyAtom;
  isExpanded: boolean;
  onCheck?: (atomId: string, checked: boolean) => void;
}) {
  const qty = atom.actualQuantity ?? 0;
  const isPartial = qty > 0 && !atom.isCompleted;

  return (
    <AnimatePresence>
      {isExpanded && (
        <motion.div
          initial={{ opacity: 0, x: -10 }}
          animate={{ opacity: 1, x: 0 }}
          exit={{ opacity: 0, x: -10 }}
          transition={{ duration: 0.2 }}
          className="pl-18 border-l border-dashed border-knit-grid overflow-hidden"
        >
          <div
            className="flex items-center gap-2.5 py-1.5 px-2 rounded-lg text-xs transition-colors"
            style={{
              backgroundColor: atom.isCompleted ? "rgba(124,169,130,0.06)" :
                              isPartial ? "rgba(245,197,66,0.06)" : "transparent",
            }}
          >
            {/* checkbox */}
            <button
              onClick={(e) => {
                e.stopPropagation();
                onCheck?.(atom.id, !atom.isCompleted);
              }}
              className="w-5 h-5 rounded border-2 flex items-center justify-center flex-shrink-0 transition-all active:scale-90"
              style={{
                borderColor: atom.isCompleted ? "var(--success)" :
                             isPartial ? "var(--knit-thread-partial)" : "var(--knit-grid)",
                backgroundColor: atom.isCompleted ? "var(--success)" :
                                 isPartial ? "var(--knit-thread-partial)" : "var(--knit-bg)",
              }}
            >
              {atom.isCompleted && <Check className="w-3 h-3 text-[var(--text-inverse)]" strokeWidth={3} />}
              {isPartial && <span className="text-[9px] font-bold text-[var(--text-inverse)]">{qty}</span>}
            </button>

            <span
              className="flex-1 truncate"
              style={{
                color: atom.isCompleted ? "var(--text-tertiary)" : "var(--text-primary)",
                textDecoration: atom.isCompleted ? "line-through" : "none",
              }}
            >
              {atom.title}
            </span>

            {atom.scheduledDate && (
              <span className="text-[10px] flex-shrink-0" style={{ color: "var(--text-tertiary)" }}>
                {atom.scheduledDate.slice(5)}
              </span>
            )}

            <span
              className="px-1.5 py-0.5 rounded text-[10px] font-medium flex-shrink-0"
              style={{
                color: atom.isCompleted ? "var(--success)" :
                       atom.status === "overdue" ? "var(--warning)" : "var(--text-tertiary)",
                backgroundColor: atom.isCompleted ? "var(--success-light)" :
                                 atom.status === "overdue" ? "var(--warning-light)" : "var(--knit-bg)",
              }}
            >
              {atom.isCompleted ? "完成" : atom.status === "overdue" ? "逾期" : "待办"}
            </span>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

// ============================================================
// L3 周任务节点
// ============================================================

function WeeklyTaskNode({
  task, defaultExpanded, onAtomCheck, index,
}: {
  task: TreeWeeklyTask;
  defaultExpanded: boolean;
  onAtomCheck?: (atomId: string, checked: boolean) => void;
  index: number;
}) {
  const [expanded, setExpanded] = useState(defaultExpanded);
  const completedCount = task.dailyAtoms.filter((a) => a.isCompleted).length;
  const allDone = completedCount >= task.quantityTarget && task.quantityTarget > 0;

  return (
    <motion.div
      initial={{ opacity: 0, x: -10 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ duration: 0.2, delay: index * 0.03 }}
    >
      <div className="pl-12 border-l border-dashed border-knit-grid">
        <button
          onClick={() => setExpanded((v) => !v)}
          className="w-full flex items-center gap-2 py-2 px-2 rounded-lg text-xs hover:bg-surface-fabric-hover/50 transition-colors text-left group"
        >
          <motion.div
            animate={{ rotate: expanded ? 90 : 0 }}
            transition={{ duration: 0.15 }}
            className="text-text-tertiary"
          >
            <ChevronRight className="w-3.5 h-3.5" />
          </motion.div>
          <span className="flex-1 font-medium truncate" style={{ color: "var(--text-primary)" }}>
            {task.title}
          </span>
          {task.quantityTarget > 0 && (
            <span className="flex-shrink-0 text-xs" style={{
              color: allDone ? "var(--success)" :
                     completedCount > 0 ? "var(--knit-thread)" : "var(--text-tertiary)",
            }}>
              {completedCount}/{task.quantityTarget}{task.quantityUnit ? ` ${task.quantityUnit}` : ""}
              {allDone && " ✓"}
            </span>
          )}
          <KnittingProgress progress={task.progress} size="sm" showPercentage={false} />
        </button>

        {task.dailyAtoms.map((atom) => (
          <DailyAtomNode key={atom.id} atom={atom} isExpanded={expanded} onCheck={onAtomCheck} />
        ))}
      </div>
    </motion.div>
  );
}

// ============================================================
// L2 里程碑节点
// ============================================================

function MilestoneNode({
  milestone, defaultExpanded, onAtomCheck, index,
}: {
  milestone: TreeMilestone;
  defaultExpanded: boolean;
  onAtomCheck?: (atomId: string, checked: boolean) => void;
  index: number;
}) {
  const [expanded, setExpanded] = useState(defaultExpanded);

  const statusDot = {
    pending:    { bg: "var(--knit-grid)" },
    active:     { bg: "var(--brand-primary)" },
    completed:  { bg: "var(--success)" },
    overdue:    { bg: "var(--warning)" },
  }[milestone.status] ?? { bg: "var(--knit-grid)" };

  return (
    <motion.div
      initial={{ opacity: 0, x: -10 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ duration: 0.2, delay: index * 0.04 }}
    >
      <div className="pl-6 border-l-2 border-dashed border-knit-grid ml-3">
        <button
          onClick={() => setExpanded((v) => !v)}
          className="w-full flex items-center gap-2 py-2.5 rounded-lg text-sm hover:bg-surface-fabric-hover/50 transition-colors text-left group"
        >
          <motion.div
            animate={{ rotate: expanded ? 90 : 0 }}
            transition={{ duration: 0.15 }}
            className="text-text-tertiary"
          >
            <ChevronRight className="w-4 h-4" />
          </motion.div>

          {/* weight badge */}
          <span
            className="w-8 h-8 rounded-full flex items-center justify-center text-[11px] font-bold flex-shrink-0"
            style={{ backgroundColor: "var(--brand-secondary)", color: "var(--text-inverse)" }}
          >
            {milestone.weight}%
          </span>

          <span className="flex-1 font-medium truncate" style={{ color: "var(--text-primary)" }}>
            {milestone.title}
          </span>

          {/* status dot */}
          <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ backgroundColor: statusDot.bg }} />

          {milestone.status === "completed" && <Check className="w-4 h-4 flex-shrink-0" style={{ color: "var(--success)" }} />}
        </button>

        <AnimatePresence>
          {expanded && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: "auto" }}
              exit={{ opacity: 0, height: 0 }}
              className="overflow-hidden"
            >
              <div className="py-1 space-y-0.5">
                {milestone.weeklyTasks.map((task, i) => (
                  <WeeklyTaskNode
                    key={task.id}
                    task={task}
                    defaultExpanded={false}
                    onAtomCheck={onAtomCheck}
                    index={i}
                  />
                ))}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </motion.div>
  );
}

// ============================================================
// L1 目标节点
// ============================================================

function GoalNode({
  goal, milestones, onAtomCheck, onEditGoal, onPauseGoal, onDeleteGoal,
}: {
  goal: Goal;
  milestones: TreeMilestone[];
  onAtomCheck?: (atomId: string, checked: boolean) => void;
  onEditGoal?: (goalId: number) => void;
  onPauseGoal?: (goalId: number) => void;
  onDeleteGoal?: (goalId: number) => void;
}) {
  const [expanded, setExpanded] = useState(true);
  const priorityCfg = PRIORITY_CONFIG.find(p => p.key === goal.priority) ?? PRIORITY_CONFIG[3];
  const totalAtoms = milestones.reduce(
    (sum, ms) => sum + ms.weeklyTasks.reduce((s, wt) => s + wt.dailyAtoms.length, 0), 0
  );
  const typeKey = goal.type as string;
  const cat = categoryColors[typeKey] ?? categoryColors.custom;

  return (
    <div
      className="rounded-fabric overflow-hidden"
      style={{
        backgroundColor: "var(--surface-fabric)",
        boxShadow: "var(--shadow-knit)",
      }}
    >
      {/* 目标头部 */}
      <div className="p-4">
        <button
          onClick={() => setExpanded((v) => !v)}
          className="w-full flex items-center gap-3 text-left mb-3"
        >
          <motion.div
            animate={{ rotate: expanded ? 90 : 0 }}
            transition={{ duration: 0.15 }}
            className="text-text-tertiary"
          >
            <ChevronRight className="w-4 h-4" />
          </motion.div>
          <div className="flex-1 min-w-0">
            <h3
              className="text-lg font-bold truncate"
              style={{ fontFamily: "var(--font-display)", color: "var(--text-primary)" }}
            >
              {goal.name}
            </h3>
            <div className="flex items-center gap-2 mt-1 flex-wrap">
              <span
                className="text-[10px] px-2 py-0.5 rounded-full font-medium"
                style={{ backgroundColor: cat.bg, color: cat.text }}
              >
                {categoryLabels[typeKey] ?? typeKey}
              </span>
              <span
                className="text-[10px] px-2 py-0.5 rounded-full font-medium"
                style={{
                  color: priorityCfg.color,
                  backgroundColor: priorityCfg.color + "18",
                }}
              >
                {priorityCfg.label}
              </span>
              {goal.deadline && (
                <span className="text-[10px]" style={{ color: "var(--text-tertiary)" }}>
                  ⏱ {new Date(goal.deadline).toISOString().slice(0, 10)}
                </span>
              )}
            </div>
          </div>
        </button>

        {/* KnittingProgress 替代旧进度条 */}
        <div className="flex items-center gap-2 mb-3">
          <KnittingProgress progress={goal.progress} size="md" />
          <span className="text-xs" style={{ color: "var(--text-tertiary)" }}>
            {milestones.length}阶段 · {totalAtoms}针
          </span>
        </div>

        {/* 操作栏 */}
        <div className="flex items-center gap-1 border-t border-dashed border-knit-grid pt-2">
          <button
            onClick={(e) => { e.stopPropagation(); onEditGoal?.(goal.id!); }}
            className="w-8 h-8 rounded-lg flex items-center justify-center transition-colors hover:bg-surface-fabric-hover"
            style={{ color: "var(--text-tertiary)" }}
          >
            <Pencil className="w-3.5 h-3.5" />
          </button>
          <button
            onClick={(e) => { e.stopPropagation(); onPauseGoal?.(goal.id!); }}
            className="w-8 h-8 rounded-lg flex items-center justify-center transition-colors hover:bg-surface-fabric-hover"
            style={{ color: "var(--text-tertiary)" }}
          >
            <Pause className="w-3.5 h-3.5" />
          </button>
          <button
            onClick={(e) => { e.stopPropagation(); onDeleteGoal?.(goal.id!); }}
            className="w-8 h-8 rounded-lg flex items-center justify-center transition-colors hover:bg-warning-light ml-auto"
            style={{ color: "var(--text-tertiary)" }}
          >
            <Trash2 className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* 里程碑列表 */}
      <AnimatePresence>
        {expanded && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            className="overflow-hidden"
          >
            <div className="px-2 py-2 space-y-1" style={{ borderTop: "1px solid var(--border-light)" }}>
              {milestones.length === 0 ? (
                <p className="text-center text-xs py-4" style={{ color: "var(--text-tertiary)" }}>
                  还没有里程碑，去编辑页面添加吧
                </p>
              ) : (
                milestones.map((ms, i) => (
                  <MilestoneNode
                    key={ms.id}
                    milestone={ms}
                    defaultExpanded={false}
                    onAtomCheck={onAtomCheck}
                    index={i}
                  />
                ))
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

// ============================================================
// 主组件
// ============================================================

export default function GoalTree({
  goalId,
  expandedByDefault = false,
  showProgress = true,
  onAtomCheck,
  onEditGoal,
  onPauseGoal,
  onDeleteGoal,
  onDragEnd,
}: GoalTreeProps) {
  const [goal, setGoal] = useState<Goal | null>(null);
  const [milestones, setMilestones] = useState<TreeMilestone[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const engineGoalId = useMemo(() => mainGoalKey(goalId), [goalId]);

  const loadTree = useCallback(async () => {
    setLoading(true);
    try {
      const goalData = await GoalEngine.getGoal(goalId);
      if (!goalData) { setError("目标不存在"); return; }
      setGoal(goalData);

      const msList = await GoalEngine.getMilestones(engineGoalId);
      const tree: TreeMilestone[] = [];
      for (const ms of msList) {
        const tasks = await GoalEngine.getWeeklyTasks(ms.id);
        const tasksWithAtoms: TreeWeeklyTask[] = [];
        for (const task of tasks) {
          const atoms = await GoalEngine.getDailyAtoms(task.id);
          tasksWithAtoms.push({ ...task, dailyAtoms: atoms });
        }
        tree.push({ ...ms, weeklyTasks: tasksWithAtoms });
      }
      setMilestones(tree);
    } catch (err) {
      setError("加载失败");
      console.error("[GoalTree] 加载失败:", err);
    } finally {
      setLoading(false);
    }
  }, [engineGoalId]);

  useEffect(() => { loadTree(); }, [loadTree]);

  if (loading) {
    return (
      <div className="space-y-3 p-4">
        <div className="skeleton h-24 rounded-fabric" />
        <div className="skeleton h-12 rounded-fabric ml-6" />
        <div className="skeleton h-12 rounded-fabric ml-6" />
      </div>
    );
  }

  if (error || !goal) {
    return (
      <EmptyState
        state="waiting"
        title="还没有目标"
        description="开始创建你的第一个目标吧"
        actionLabel="开始创建"
        onAction={() => window.location.href = "/goals/new"}
      />
    );
  }

  return (
    <div className="space-y-3">
      <GoalNode
        goal={goal}
        milestones={milestones}
        onAtomCheck={onAtomCheck}
        onEditGoal={onEditGoal}
        onPauseGoal={onPauseGoal}
        onDeleteGoal={onDeleteGoal}
      />
    </div>
  );
}
