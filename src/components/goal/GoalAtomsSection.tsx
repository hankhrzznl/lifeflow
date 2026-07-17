"use client";

import { useState, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Check, Target, ChevronRight, Edit3, X, Plus,
  Sparkles, BookOpen, Dumbbell, Sprout, PiggyBank, Flag,
} from "lucide-react";
import { GoalEngine } from "@/services/goal-engine";
import { createCheckInForAtom, removeCheckInForAtom, writeBackGoalProgress, createMainGoalFromTemplate } from "@/lib/goalBridge";
import type {
  GoalCategory, Milestone, WeeklyTask, DailyAtom,
} from "@/types/goal";
import type { Goal } from "@/lib/types";

// ============================================================
// 工具函数
// ============================================================

/** 目标类别对应的图标和颜色 */
const CATEGORY_CONFIG: Record<string, { icon: typeof Target; color: string; bg: string; label: string }> = {
  exam:    { icon: BookOpen,   color: "text-orange-600",  bg: "bg-orange-100 dark:bg-orange-900/30", label: "备考" },
  fitness: { icon: Dumbbell,   color: "text-pink-600",    bg: "bg-pink-100 dark:bg-pink-900/30",     label: "运动" },
  habit:   { icon: Sprout,     color: "text-emerald-600", bg: "bg-emerald-100 dark:bg-emerald-900/30", label: "习惯" },
  finance: { icon: PiggyBank,  color: "text-amber-600",   bg: "bg-amber-100 dark:bg-amber-900/30",    label: "财务" },
  custom:  { icon: Flag,       color: "text-indigo-600",  bg: "bg-indigo-100 dark:bg-indigo-900/30",  label: "自定义" },
};

function getCategoryConfig(category: string) {
  return CATEGORY_CONFIG[category] ?? CATEGORY_CONFIG.custom;
}

/** 主库 GoalType → 图标映射 */
const TYPE_CONFIG: Record<string, { icon: typeof Target; color: string; bg: string; label: string }> = {
  task:    { icon: Target,     color: "text-indigo-600",  bg: "bg-indigo-100 dark:bg-indigo-900/30",  label: "任务" },
  fitness: { icon: Dumbbell,   color: "text-pink-600",    bg: "bg-pink-100 dark:bg-pink-900/30",      label: "运动" },
  finance: { icon: PiggyBank,  color: "text-amber-600",   bg: "bg-amber-100 dark:bg-amber-900/30",     label: "财务" },
  sleep:   { icon: Sparkles,   color: "text-purple-600",  bg: "bg-purple-100 dark:bg-purple-900/30",   label: "睡眠" },
  water:   { icon: Sprout,     color: "text-blue-600",    bg: "bg-blue-100 dark:bg-blue-900/30",       label: "饮水" },
};

function getTypeConfig(type: string) {
  return TYPE_CONFIG[type] ?? TYPE_CONFIG.task;
}

interface AtomWithContext {
  goal: Goal;
  milestone: Milestone;
  weeklyTask: WeeklyTask;
  atom: DailyAtom;
}

// ============================================================
// 单个原子项（支持就地编辑）
// ============================================================

function AtomItem({
  atom,
  weeklyTask,
  onToggle,
  onEdit,
  isCompleted,
}: {
  atom: DailyAtom;
  weeklyTask: WeeklyTask;
  onToggle: (atom: DailyAtom) => void;
  onEdit: (atomId: string, updates: Partial<Pick<DailyAtom, "title" | "quantity" | "actualQuantity">>) => Promise<void>;
  isCompleted: boolean;
}) {
  const [animating, setAnimating] = useState(false);
  const [editing, setEditing] = useState(false);
  const [editTitle, setEditTitle] = useState(atom.title);
  const [editQty, setEditQty] = useState(atom.quantity);

  const handleToggle = async () => {
    if (animating) return;
    setAnimating(true);
    try {
      await onToggle(atom);
    } finally {
      setAnimating(false);
    }
  };

  const handleStartEdit = () => {
    setEditTitle(atom.title);
    setEditQty(atom.quantity);
    setEditing(true);
  };

  const handleSaveEdit = async () => {
    if (!editTitle.trim()) return;
    try {
      await onEdit(atom.id, { title: editTitle.trim(), quantity: editQty });
      setEditing(false);
    } catch {
      // 编辑失败保持编辑模式
    }
  };

  const handleCancelEdit = () => {
    setEditing(false);
  };

  if (editing) {
    return (
      <motion.div
        initial={{ opacity: 0, height: 0 }}
        animate={{ opacity: 1, height: "auto" }}
        className="py-2.5 px-3 rounded-xl bg-gray-50 dark:bg-gray-800/50"
      >
        <div className="space-y-2">
          <input
            type="text"
            value={editTitle}
            onChange={(e) => setEditTitle(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter") handleSaveEdit(); if (e.key === "Escape") handleCancelEdit(); }}
            placeholder="原子项标题"
            className="w-full px-3 py-2 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
            autoFocus
          />
          <div className="flex items-center gap-2">
            <label className="text-xs text-gray-500 flex-shrink-0">计划量</label>
            <input
              type="number"
              min={0}
              step={1}
              value={editQty}
              onChange={(e) => setEditQty(Math.max(0, parseInt(e.target.value) || 0))}
              className="w-20 px-2 py-1.5 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-sm text-center focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
            {weeklyTask.quantityUnit && (
              <span className="text-xs text-gray-400">{weeklyTask.quantityUnit}</span>
            )}
            <div className="flex-1" />
            <button
              onClick={handleCancelEdit}
              className="p-1.5 text-gray-400 hover:text-gray-600 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-700"
            >
              <X className="w-4 h-4" />
            </button>
            <button
              onClick={handleSaveEdit}
              className="px-3 py-1.5 text-xs font-medium bg-indigo-500 text-white rounded-lg hover:bg-indigo-600 transition-colors"
            >
              保存
            </button>
          </div>
        </div>
      </motion.div>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0, x: -8 }}
      animate={{ opacity: 1, x: 0 }}
      className={`flex items-center gap-3 py-2.5 px-3 rounded-xl transition-colors group ${
        isCompleted
          ? "bg-emerald-50/50 dark:bg-emerald-900/10"
          : "hover:bg-gray-50 dark:hover:bg-gray-800/50"
      }`}
    >
      {/* 完成按钮 */}
      <button
        onClick={handleToggle}
        disabled={animating}
        className={`w-5 h-5 rounded-full border-2 flex items-center justify-center flex-shrink-0 transition-all ${
          isCompleted
            ? "bg-emerald-500 border-emerald-500 scale-100"
            : "border-gray-300 dark:border-gray-600 hover:border-emerald-400 hover:scale-110"
        } ${animating ? "opacity-50" : ""}`}
      >
        {isCompleted && <Check className="w-3 h-3 text-white" strokeWidth={3} />}
      </button>

      {/* 内容 */}
      <div className="flex-1 min-w-0">
        <p className={`text-sm ${isCompleted ? "line-through text-gray-400" : "text-gray-900 dark:text-gray-100"}`}>
          {atom.title}
        </p>
        {weeklyTask.quantityUnit && weeklyTask.quantityTarget > 0 && (
          <p className="text-xs text-gray-400 mt-0.5">
            {atom.actualQuantity ?? atom.quantity}/{weeklyTask.quantityTarget} {weeklyTask.quantityUnit}
          </p>
        )}
      </div>

      {/* 预估时长 */}
      {atom.estimatedDuration && (
        <span className="text-xs text-gray-400 flex-shrink-0">{atom.estimatedDuration}分钟</span>
      )}

      {/* 编辑按钮 */}
      {!isCompleted && (
        <button
          onClick={handleStartEdit}
          className="w-7 h-7 flex items-center justify-center rounded-lg text-gray-400 hover:text-indigo-500 hover:bg-indigo-50 dark:hover:bg-indigo-900/20 transition-colors opacity-0 group-hover:opacity-100"
          title="编辑"
        >
          <Edit3 className="w-3.5 h-3.5" />
        </button>
      )}
    </motion.div>
  );
}

// ============================================================
// 目标卡片
// ============================================================

function GoalCard({
  goal,
  atoms,
  onAtomToggle,
  onAtomEdit,
  defaultExpanded,
}: {
  goal: Goal;
  atoms: AtomWithContext[];
  onAtomToggle: (atom: DailyAtom) => Promise<void>;
  onAtomEdit: (atomId: string, updates: Partial<Pick<DailyAtom, "title" | "quantity" | "actualQuantity">>) => Promise<void>;
  defaultExpanded: boolean;
}) {
  const [expanded, setExpanded] = useState(defaultExpanded);
  const config = getTypeConfig(goal.type);
  const CategoryIcon = config.icon;

  const completedCount = atoms.filter((a) => a.atom.isCompleted).length;
  const totalCount = atoms.length;

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-100 dark:border-gray-800 shadow-sm overflow-hidden"
    >
      {/* 目标头部 */}
      <button
        onClick={() => setExpanded((v) => !v)}
        className="w-full flex items-center gap-3 p-4 hover:bg-gray-50 dark:hover:bg-gray-800/30 transition-colors text-left"
      >
        {/* 类别图标 */}
        <div className={`w-9 h-9 rounded-xl ${config.bg} flex items-center justify-center flex-shrink-0`}>
          <CategoryIcon className={`w-5 h-5 ${config.color}`} strokeWidth={1.5} />
        </div>

        {/* 目标信息 */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <h3 className="text-sm font-semibold text-gray-900 dark:text-white truncate">
              {goal.name}
            </h3>
            <span className={`text-xs px-1.5 py-0.5 rounded-md font-medium flex-shrink-0 ${config.bg} ${config.color}`}>
              {config.label}
            </span>
          </div>
          {/* 进度条 */}
          <div className="flex items-center gap-2 mt-1.5">
            <div className="flex-1 h-1.5 bg-gray-100 dark:bg-gray-800 rounded-full overflow-hidden">
              <motion.div
                initial={{ width: 0 }}
                animate={{ width: `${goal.progress}%` }}
                transition={{ duration: 0.5, ease: "easeOut" }}
                className={`h-full rounded-full ${
                  goal.progress >= 100 ? "bg-emerald-500" :
                  goal.progress >= 60 ? "bg-blue-500" :
                  goal.progress >= 30 ? "bg-amber-500" : "bg-red-400"
                }`}
              />
            </div>
            <span className="text-xs font-mono text-gray-500 flex-shrink-0">{goal.progress}%</span>
          </div>
        </div>

        {/* 今日统计 + 展开按钮 */}
        <div className="flex items-center gap-2 flex-shrink-0">
          <span className="text-xs text-gray-400">{completedCount}/{totalCount}</span>
          <motion.div animate={{ rotate: expanded ? 90 : 0 }} transition={{ duration: 0.2 }}>
            <ChevronRight className="w-4 h-4 text-gray-400" />
          </motion.div>
        </div>
      </button>

      {/* 原子项列表 */}
      <AnimatePresence initial={false}>
        {expanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.25, ease: [0.4, 0, 0.2, 1] }}
            className="overflow-hidden"
          >
            <div className="border-t border-gray-100 dark:border-gray-800 px-3 py-2 space-y-0.5">
              {atoms.map(({ atom: a, weeklyTask: wt }) => (
                <AtomItem
                  key={a.id}
                  atom={a}
                  weeklyTask={wt}
                  isCompleted={a.isCompleted}
                  onToggle={onAtomToggle}
                  onEdit={onAtomEdit}
                />
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}

// ============================================================
// 主组件
// ============================================================

export default function GoalAtomsSection() {
  const [items, setItems] = useState<AtomWithContext[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  // 快速创建目标状态
  const [showQuickCreate, setShowQuickCreate] = useState(false);
  const [newGoalTitle, setNewGoalTitle] = useState("");
  const [newGoalCategory, setNewGoalCategory] = useState<GoalCategory>("exam");
  const [newGoalDeadline, setNewGoalDeadline] = useState(
    (() => { const d = new Date(); d.setDate(d.getDate() + 30); return d.toISOString().slice(0,10); })()
  );
  const [creating, setCreating] = useState(false);

  const loadData = useCallback(async () => {
    try {
      const data = await GoalEngine.getTodayAtomsWithContext();
      setItems(data);
      setError(null);
    } catch (err) {
      console.error("[GoalAtoms] 加载失败:", err);
      setError("加载失败");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const handleAtomToggle = useCallback(async (atom: DailyAtom) => {
    // 找到对应的上下文以获取主库 goalId
    const contextItem = items.find((item) => item.atom.id === atom.id);
    const mainGoalId = contextItem?.goal.id;

    setRefreshing(true);
    try {
      if (atom.isCompleted) {
        await GoalEngine.uncompleteAtom(atom.id);
        await removeCheckInForAtom(atom.id);
      } else {
        await GoalEngine.completeAtom(atom.id);
        await createCheckInForAtom(atom.id);
      }
      await loadData();
      if (mainGoalId != null) {
        await writeBackGoalProgress(mainGoalId);
      }
    } catch (err) {
      console.error("[GoalAtoms] 操作失败:", err);
      setRefreshing(false);
    }
  }, [loadData, items]);

  const handleAtomEdit = useCallback(async (
    atomId: string,
    updates: Partial<Pick<DailyAtom, "title" | "quantity" | "actualQuantity">>
  ) => {
    await GoalEngine.updateDailyAtom(atomId, updates);
    await loadData();
  }, [loadData]);

  const handleQuickCreate = async () => {
    if (!newGoalTitle.trim()) return;
    setCreating(true);
    try {
      await createMainGoalFromTemplate(newGoalCategory, {
        goalTitle: newGoalTitle.trim(),
        deadline: newGoalDeadline,
        priority: "p2",
      });
      setShowQuickCreate(false);
      setNewGoalTitle("");
      await loadData();
    } catch (err) {
      console.error("[GoalAtoms] 创建目标失败:", err);
    } finally {
      setCreating(false);
    }
  };

  // 按目标分组
  const grouped = new Map<number, AtomWithContext[]>();
  for (const item of items) {
    const list = grouped.get(item.goal.id!) ?? [];
    list.push(item);
    grouped.set(item.goal.id!, list);
  }

  // 获取每个目标的第一个 item（用于卡片头部）
  const goalEntries = Array.from(grouped.entries()).map(([goalId, atoms]) => ({
    goal: atoms[0].goal,
    atoms,
  }));

  if (loading) {
    return (
      <div className="space-y-3">
        {[1, 2].map((i) => (
          <div key={i} className="skeleton h-20 rounded-2xl" />
        ))}
      </div>
    );
  }

  if (error && items.length === 0) {
    return (
      <div className="text-center py-8">
        <Target className="w-10 h-10 text-gray-300 mx-auto mb-2" strokeWidth={1.5} />
        <p className="text-sm text-gray-400">{error}</p>
      </div>
    );
  }

  if (items.length === 0) {
    return (
      <div className="text-center py-10">
        <div className="w-14 h-14 rounded-2xl bg-indigo-50 dark:bg-indigo-900/20 flex items-center justify-center mx-auto mb-3">
          <Sparkles className="w-7 h-7 text-indigo-400" strokeWidth={1.5} />
        </div>
        <p className="text-sm font-medium text-gray-600 dark:text-gray-400">今日暂无目标任务</p>
        <p className="text-xs text-gray-400 mt-1">使用模板快速创建一个目标并开始拆解</p>

        {!showQuickCreate ? (
          <button
            onClick={() => setShowQuickCreate(true)}
            className="mt-4 inline-flex items-center gap-1.5 px-4 py-2.5 rounded-xl bg-indigo-600 text-white text-sm font-medium hover:bg-indigo-700 transition-colors"
          >
            <Plus className="w-4 h-4" />
            创建目标
          </button>
        ) : (
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            className="mt-4 mx-auto max-w-sm bg-white dark:bg-gray-900 rounded-2xl border border-gray-100 dark:border-gray-800 p-4 text-left shadow-sm"
          >
            <div className="space-y-3">
              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1">目标名称</label>
                <input
                  type="text"
                  value={newGoalTitle}
                  onChange={(e) => setNewGoalTitle(e.target.value)}
                  onKeyDown={(e) => { if (e.key === "Enter") handleQuickCreate(); }}
                  placeholder="例如：考研数学120分"
                  className="w-full px-3 py-2 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  autoFocus
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1">模板类别</label>
                <div className="grid grid-cols-2 gap-2">
                  {(["exam", "fitness", "habit", "finance"] as GoalCategory[]).map((cat) => {
                    const cfg = getCategoryConfig(cat);
                    const CatIcon = cfg.icon;
                    return (
                      <button
                        key={cat}
                        onClick={() => setNewGoalCategory(cat)}
                        className={`flex items-center gap-2 px-3 py-2 rounded-xl text-xs font-medium transition-colors ${
                          newGoalCategory === cat
                            ? `${cfg.bg} ${cfg.color} ring-2 ring-current`
                            : "bg-gray-50 dark:bg-gray-800 text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-700"
                        }`}
                      >
                        <CatIcon className="w-4 h-4" />
                        {cfg.label}
                      </button>
                    );
                  })}
                </div>
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1">截止日期</label>
                <input
                  type="date"
                  value={newGoalDeadline}
                  onChange={(e) => setNewGoalDeadline(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>
              <div className="flex gap-2 pt-1">
                <button
                  onClick={() => setShowQuickCreate(false)}
                  className="flex-1 py-2 rounded-xl border border-gray-200 dark:border-gray-700 text-sm text-gray-500 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors"
                >
                  取消
                </button>
                <button
                  onClick={handleQuickCreate}
                  disabled={creating || !newGoalTitle.trim()}
                  className="flex-1 py-2 rounded-xl bg-indigo-600 text-white text-sm font-medium hover:bg-indigo-700 disabled:opacity-50 transition-colors"
                >
                  {creating ? "创建中..." : "创建"}
                </button>
              </div>
            </div>
          </motion.div>
        )}
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {goalEntries.map(({ goal, atoms }, idx) => (
        <GoalCard
          key={goal.id}
          goal={goal}
          atoms={atoms}
          onAtomToggle={handleAtomToggle}
          onAtomEdit={handleAtomEdit}
          defaultExpanded={idx === 0}
        />
      ))}

      {refreshing && (
        <div className="flex justify-center py-2">
          <div className="w-5 h-5 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin" />
        </div>
      )}
    </div>
  );
}
