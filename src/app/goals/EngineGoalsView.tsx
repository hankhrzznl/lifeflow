"use client";

import { useState, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Target, TrendingUp, CheckCircle, Pause, Play,
  ChevronRight, Plus, Edit3, Trash2, Layers,
} from "lucide-react";
import { useRouter } from "next/navigation";
import { goalService } from "@/lib/engine/GoalService";
import type { EngineGoal, EngineGoalCategory, EngineGoalPriority, EngineGoalStatus } from "@/lib/engine/types";
import { ENGINE_PRIORITY_LABELS } from "@/lib/engine/types";
import GoalTree from "@/components/engine/GoalTree";
import GoalEditModal from "@/components/engine/GoalEditModal";
import { StatCard } from "@/components/ui/woven/Card";
import EmptyState from "@/components/ui/EmptyState";
import KnittingProgress from "@/components/ui/KnittingProgress";
import { showToast } from "@/components/ui/Toast";

// ============================================================
// 工具
// ============================================================

const categoryLabels: Record<string, string> = {
  exam: "学习中", fitness: "运动中", habit: "习惯中", finance: "理财中", custom: "自定义",
};

const categoryColors: Record<string, { text: string }> = {
  exam: { text: "var(--info)" },
  fitness: { text: "var(--success)" },
  habit: { text: "var(--brand-primary)" },
  finance: { text: "var(--warning)" },
  custom: { text: "var(--brand-primary)" },
};

// ============================================================
// 目标卡片
// ============================================================

function GoalCard({
  goal, onClick, onEdit, onDelete, onTogglePause,
}: {
  goal: EngineGoal; onClick: () => void;
  onEdit: () => void; onDelete: () => void; onTogglePause: () => void;
}) {
  const priorityCfg = ENGINE_PRIORITY_LABELS[goal.priority] ?? ENGINE_PRIORITY_LABELS.p4;

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      className="rounded-fabric p-4 group cursor-pointer transition-all duration-200 hover:-translate-y-0.5 hover:shadow-card"
      style={{ backgroundColor: "var(--surface-fabric)", boxShadow: "var(--shadow-knit)" }}
    >
      <div className="flex items-start gap-3">
        <button onClick={onClick} className="flex-1 min-w-0 text-left">
          <h3
            className="font-bold truncate mb-1.5"
            style={{ fontFamily: "var(--font-display)", color: "var(--text-primary)" }}
          >
            {goal.title}
          </h3>
          <div className="flex items-center gap-1.5 flex-wrap mb-2">
            <span
              className="text-[10px] px-1.5 py-0.5 rounded-full font-medium"
              style={{ backgroundColor: "var(--brand-primary-light)", color: "var(--brand-primary)" }}
            >
              {categoryLabels[goal.category] ?? goal.category}
            </span>
            <span
              className="text-[10px] px-1.5 py-0.5 rounded-full font-medium"
              style={{ color: priorityCfg.color, backgroundColor: priorityCfg.color + "14" }}
            >
              {priorityCfg.label}
            </span>
            {goal.status !== "active" && (
              <span className="text-[10px] px-1.5 py-0.5 rounded-full font-medium" style={{
                color: goal.status === "completed" ? "var(--success)" :
                       goal.status === "paused" ? "var(--text-tertiary)" : "var(--warning)",
                backgroundColor: goal.status === "completed" ? "var(--success-light)" :
                                 goal.status === "paused" ? "var(--knit-bg)" : "var(--warning-light)",
              }}>
                {goal.status === "completed" ? "已完成" : goal.status === "paused" ? "已暂停" : "已归档"}
              </span>
            )}
          </div>
          <KnittingProgress progress={goal.progress} size="sm" showPercentage={true} />
        </button>

        {/* 操作按钮 */}
        <div className="flex items-center gap-0.5 flex-shrink-0 opacity-0 group-hover:opacity-100 transition-opacity">
          <button onClick={(e) => { e.stopPropagation(); onEdit(); }}
            className="w-7 h-7 flex items-center justify-center rounded-lg transition-colors hover:bg-surface-fabric-hover"
            style={{ color: "var(--text-tertiary)" }} title="编辑">
            <Edit3 className="w-3.5 h-3.5" />
          </button>
          <button onClick={(e) => { e.stopPropagation(); onTogglePause(); }}
            className="w-7 h-7 flex items-center justify-center rounded-lg transition-colors hover:bg-surface-fabric-hover"
            style={{ color: "var(--text-tertiary)" }} title={goal.status === "paused" ? "恢复" : "暂停"}>
            {goal.status === "paused" ? <Play className="w-3.5 h-3.5" /> : <Pause className="w-3.5 h-3.5" />}
          </button>
          <button onClick={(e) => { e.stopPropagation(); onDelete(); }}
            className="w-7 h-7 flex items-center justify-center rounded-lg transition-colors hover:bg-warning-light"
            style={{ color: "var(--text-tertiary)" }} title="删除">
            <Trash2 className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>
    </motion.div>
  );
}

// ============================================================
// 主组件
// ============================================================

export default function EngineGoalsView() {
  const [goals, setGoals] = useState<EngineGoal[]>([]);
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState({ total: 0, active: 0, completed: 0, paused: 0 });
  const [filterCategory, setFilterCategory] = useState<EngineGoalCategory | "all">("all");
  const [filterStatus, setFilterStatus] = useState<EngineGoalStatus | "all">("all");
  const [sortField, setSortField] = useState<"deadline" | "priority" | "progress" | "createdAt">("createdAt");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");
  const [selectedGoalId, setSelectedGoalId] = useState<string | null>(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [editingGoal, setEditingGoal] = useState<EngineGoal | null>(null);
  const [saving, setSaving] = useState(false);

  const loadGoals = useCallback(async () => {
    setLoading(true);
    try {
      const [list, s] = await Promise.all([
        goalService.list({
          filter: {
            category: filterCategory !== "all" ? filterCategory : undefined,
            status: filterStatus !== "all" ? filterStatus : undefined,
          },
          sort: { field: sortField, direction: sortDir },
        }),
        goalService.getStats(),
      ]);
      setGoals(list); setStats(s);
    } catch (err) {
      console.error("[EngineGoals] 加载失败:", err);
    } finally { setLoading(false); }
  }, [filterCategory, filterStatus, sortField, sortDir]);

  useEffect(() => { loadGoals(); }, [loadGoals]);

  const handleNewGoal = () => { setEditingGoal(null); setModalOpen(true); };
  const handleEditGoal = (goal: EngineGoal) => { setEditingGoal(goal); setModalOpen(true); };

  const handleSaveGoal = useCallback(async (data: {
    title: string; description: string; category: EngineGoalCategory; priority: EngineGoalPriority; deadline: string;
  }) => {
    setSaving(true);
    try {
      if (editingGoal) {
        await goalService.update(editingGoal.id, data);
        showToast({ message: "目标已更新", type: "success" });
      } else {
        const id = await goalService.create(data);
        showToast({ message: "目标已创建", type: "success" });
        const { milestoneService: ms } = await import("@/lib/engine/MilestoneService");
        const { weeklyTaskService: wts } = await import("@/lib/engine/WeeklyTaskService");
        const { dailyAtomService: das } = await import("@/lib/engine/DailyAtomService");
        const msId = await ms.create({ goalId: id, title: "第一阶段",
          startDate: new Date().toISOString().slice(0, 10), deadline: data.deadline, weight: 100, sortOrder: 0 });
        const today = new Date().toISOString().slice(0, 10);
        const wtId = await wts.create({ milestoneId: msId, title: "本周任务",
          plannedStart: today, plannedEnd: new Date(Date.now() + 7 * 86400000).toISOString().slice(0, 10),
          quantityTarget: 1, quantityUnit: "次", weight: 100, sortOrder: 0 });
        await das.create({ weeklyTaskId: wtId, title: data.title, scheduledDate: today, quantity: 1, estimatedDuration: 30, sortOrder: 0 });
      }
      setModalOpen(false); await loadGoals();
    } catch (err) {
      console.error("[EngineGoals] 保存失败:", err);
      showToast({ message: "保存失败", type: "error" });
    } finally { setSaving(false); }
  }, [editingGoal, loadGoals]);

  const handleDeleteGoal = useCallback(async () => {
    if (!editingGoal) return;
    try {
      await goalService.delete(editingGoal.id);
      showToast({ message: "目标已删除", type: "success" });
      setModalOpen(false); setSelectedGoalId(null); await loadGoals();
    } catch (err) {
      console.error("[EngineGoals] 删除失败:", err);
      showToast({ message: "删除失败", type: "error" });
    }
  }, [editingGoal, loadGoals]);

  const handleTogglePauseGoal = useCallback(async (goal: EngineGoal) => {
    try {
      const ns: EngineGoalStatus = goal.status === "paused" ? "active" : "paused";
      await goalService.update(goal.id, { status: ns });
      showToast({ message: ns === "paused" ? "已暂停" : "已恢复", type: "success" });
      await loadGoals();
    } catch (err) {
      console.error("[EngineGoals] 操作失败:", err);
      showToast({ message: "操作失败", type: "error" });
    }
  }, [loadGoals]);

  const selectStyle = "text-xs px-2.5 py-1.5 rounded-md focus:outline-none focus:ring-2 focus:ring-[var(--brand-primary)] border";
  const selectVars = { backgroundColor: "var(--surface-fabric)", borderColor: "var(--border)", color: "var(--text-secondary)" };

  return (
    <div className="px-4 py-4 space-y-4">
      {/* 统计卡片 */}
      <div className="grid grid-cols-4 gap-2">
        <StatCard icon={<Layers />} label="总数" value={stats.total} color="var(--brand-secondary)" />
        <StatCard icon={<TrendingUp />} label="进行中" value={stats.active} color="var(--brand-primary)" />
        <StatCard icon={<CheckCircle />} label="已完成" value={stats.completed} color="var(--success)" />
        <StatCard icon={<Pause />} label="已暂停" value={stats.paused} color="var(--text-tertiary)" />
      </div>

      {/* 筛选 & 排序 */}
      <div className="flex items-center gap-2 flex-wrap overflow-x-auto pb-1 scrollbar-hide">
        <select value={filterCategory} onChange={(e) => setFilterCategory(e.target.value as EngineGoalCategory | "all")}
          className={selectStyle} style={selectVars}>
          <option value="all">全部分类</option>
          <option value="exam">学习中</option>
          <option value="fitness">运动中</option>
          <option value="habit">习惯中</option>
          <option value="finance">理财中</option>
          <option value="custom">自定义</option>
        </select>
        <select value={filterStatus} onChange={(e) => setFilterStatus(e.target.value as EngineGoalStatus | "all")}
          className={selectStyle} style={selectVars}>
          <option value="all">全部状态</option>
          <option value="active">进行中</option>
          <option value="completed">已完成</option>
          <option value="paused">已暂停</option>
        </select>
        <select value={`${sortField}-${sortDir}`} onChange={(e) => {
          const [field, dir] = e.target.value.split("-") as [typeof sortField, typeof sortDir];
          setSortField(field); setSortDir(dir);
        }} className={selectStyle} style={selectVars}>
          <option value="createdAt-desc">最新创建</option>
          <option value="deadline-asc">截止日期↑</option>
          <option value="priority-asc">优先级↑</option>
          <option value="progress-desc">进度↓</option>
        </select>
        <div className="flex-1" />
        <button
          onClick={handleNewGoal}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-all active:scale-95"
          style={{ backgroundColor: "var(--brand-primary)", color: "var(--text-inverse)" }}
        >
          <Plus className="w-3.5 h-3.5" /> 新建目标
        </button>
      </div>

      {/* 目标列表 */}
      {loading ? (
        <div className="space-y-3">
          {[1, 2, 3].map((i) => (<div key={i} className="skeleton h-24 rounded-fabric" />))}
        </div>
      ) : goals.length === 0 ? (
        <EmptyState
          state="waiting"
          title="工作台上还没有布料"
          description="点击下方的线团，开始编织你的第一块目标吧"
          actionLabel="开始编织"
          onAction={handleNewGoal}
        />
      ) : (
        <div className="space-y-3">
          {goals.map((goal) => (
            <div key={goal.id}>
              <GoalCard {...{ goal }} onClick={() => setSelectedGoalId(selectedGoalId === goal.id ? null : goal.id)}
                onEdit={() => handleEditGoal(goal)}
                onDelete={() => { setEditingGoal(goal); setModalOpen(true); }}
                onTogglePause={() => handleTogglePauseGoal(goal)} />
              <AnimatePresence>
                {selectedGoalId === goal.id && (
                  <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} exit={{ opacity: 0, height: 0 }} className="overflow-hidden">
                    <div className="pt-2 pb-1"><GoalTree goalId={goal.id} /></div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          ))}
        </div>
      )}

      <GoalEditModal open={modalOpen} goal={editingGoal} onSave={handleSaveGoal}
        onClose={() => { setModalOpen(false); setEditingGoal(null); }}
        onDelete={editingGoal ? handleDeleteGoal : undefined} saving={saving} />
    </div>
  );
}
