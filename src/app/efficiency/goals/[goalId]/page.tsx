"use client";

import { useEffect, useState, useMemo, useCallback } from "react";
import { useRouter, useParams } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import {
  ChevronLeft, Check, Plus, CheckCircle2, TrendingUp,
  Circle, AlertTriangle, X, Trash2, Pencil,
} from "lucide-react";
import { useLiveQuery } from "dexie-react-hooks";
import { useEfficiencyStore } from "@/lib/store/efficiencyStore";
import { efficiencyDB, type Goal, type ScheduleTask, type Project, getAllProjects, addScheduleTask } from "@/lib/db/efficiency.db";
import { showToast } from "@/components/ui/Toast";
import { parseBulkTasks, flattenTasks } from "@/lib/bulkTaskParser";

// ============================================================
// 设计令牌
// ============================================================
const ACCENT = "#6366F1";
const MUTED = "#86868B";
const BORDER = "#EBEBEB";
const STRONG = "#C7C7CC";
const GREEN = "#34C759";
const WARNING = "#FF9500";

// ============================================================
// 工具函数
// ============================================================
function calcProgress(current: number, target: number): number {
  if (!target || target <= 0) return 0;
  return Math.min(100, Math.max(0, Math.round((current / target) * 100)));
}

// ============================================================
// 主组件
// ============================================================
export default function GoalDetailPage() {
  const router = useRouter();
  const params = useParams();
  const goalId = params.goalId as string;

  const { goals, loadGoals, updateGoalStatus, toggleScheduleTask, removeScheduleTask } = useEfficiencyStore();

  // 从 live query 获取目标
  const goal = useLiveQuery(() => efficiencyDB.goals.get(goalId), [goalId]);
  const allScheduleTasks = useLiveQuery(() => efficiencyDB.scheduleTasks.toArray(), []);
  const projects = useLiveQuery(() => getAllProjects(), [], [] as Project[]);

  // 目标颜色：从所属项目继承，无项目则为白色
  const goalColor = useMemo(() => {
    if (!goal) return ACCENT;
    const p = projects.find((p) => p.id === goal.projectId);
    return p?.color || "#FFFFFF";
  }, [goal, projects]);

  // 按 goalId 过滤任务
  const tasks = useMemo(() => {
    if (!allScheduleTasks) return [];
    return allScheduleTasks.filter((t) => t.goalId === goalId);
  }, [allScheduleTasks, goalId]);

  // 分组
  const normalTasks = useMemo(() => tasks.filter((t) => t.progressType !== "progress"), [tasks]);
  const progressTasks = useMemo(() => tasks.filter((t) => t.progressType === "progress"), [tasks]);

  // 完成统计
  const taskStats = useMemo(() => {
    const total = tasks.length;
    const done = tasks.filter((t) => t.isCompleted).length;
    return { total, done };
  }, [tasks]);

  const allCompleted = taskStats.total > 0 && taskStats.done === taskStats.total;
  const goalProgress = taskStats.total > 0 ? Math.round((taskStats.done / taskStats.total) * 100) : 0;

  /* edit task sheet */
  const [editingTask, setEditingTask] = useState<ScheduleTask | null>(null);
  const [editTitle, setEditTitle] = useState("");
  const [editNote, setEditNote] = useState("");
  const [editGoalId, setEditGoalId] = useState<string>("");
  const [editReminderStr, setEditReminderStr] = useState("");

  const openEdit = useCallback((task: ScheduleTask) => {
    setEditingTask(task);
    setEditTitle(task.title);
    setEditNote(task.note || "");
    setEditGoalId(task.goalId || "");
    setEditReminderStr((task.reminderTimes || []).join(", "));
  }, []);

  const handleSaveEdit = useCallback(async () => {
    if (!editingTask) return;
    const reminders = editReminderStr
      .split(",").map(s => s.trim()).filter(Boolean);
    await useEfficiencyStore.getState().updateScheduleTask(editingTask.id, {
      title: editTitle,
      note: editNote,
      goalId: editGoalId || null,
      reminderTimes: reminders.length > 0 ? reminders : undefined,
    });
    showToast({ type: "success", message: "任务已更新" });
    setEditingTask(null);
  }, [editingTask, editTitle, editNote, editGoalId, editReminderStr]);

  /* bulk import */
  const [showBulkImport, setShowBulkImport] = useState(false);
  const [bulkText, setBulkText] = useState("");
  const [bulkLoading, setBulkLoading] = useState(false);

  const handleBulkImport = useCallback(async () => {
    if (!bulkText.trim()) return;
    setBulkLoading(true);
    try {
      const parsed = parseBulkTasks(bulkText);
      const flat = flattenTasks(parsed, goalId);
      for (const t of flat) {
        await addScheduleTask(t as any);
      }
      showToast({ type: "success", message: `已导入 ${flat.length} 条` });
      setShowBulkImport(false);
      setBulkText("");
    } catch {
      showToast({ type: "error", message: "格式有问题，检查一下？" });
    } finally {
      setBulkLoading(false);
    }
  }, [bulkText, goalId]);

  // 切换任务完成状态
  const handleToggleTask = useCallback(async (taskId: string) => {
    await toggleScheduleTask(taskId);
    // Sync progress back to goal
    const updated = allScheduleTasks?.map(t => t.id === taskId ? { ...t, isCompleted: !t.isCompleted } : t) ?? [];
    const goalTasks = updated.filter(t => t.goalId === goalId);
    const done = goalTasks.filter(t => t.isCompleted).length;
    const pct = goalTasks.length > 0 ? Math.round((done / goalTasks.length) * 100) : 0;
    await efficiencyDB.goals.update(goalId, { progress: pct } as any);
  }, [toggleScheduleTask, allScheduleTasks, goalId]);

  const handleDeleteTask = useCallback(async (taskId: string) => {
    await removeScheduleTask(taskId);
    showToast({ type: "success", message: "已删除" });
  }, [removeScheduleTask]);

  // 完成目标
  const handleCompleteGoal = useCallback(async () => {
    if (!goal || !allCompleted) return;
    await updateGoalStatus(goalId, "completed");
    showToast({ type: "success", message: "目标已完成" });
    router.push("/efficiency");
  }, [goal, goalId, allCompleted, updateGoalStatus, router]);

  // 加载
  useEffect(() => { loadGoals(); }, [loadGoals]);

  if (!goal) {
    return (
      <div className="min-h-screen bg-[#FAFAFA]" style={{ maxWidth: 430, margin: "0 auto" }}>
        <div className="flex items-center h-14 px-4" style={{ paddingTop: "var(--safe-area-top)" }}>
          <button onClick={() => router.push("/efficiency")} className="w-8 h-8 -ml-1 flex items-center justify-center">
            <ChevronLeft className="w-6 h-6 text-[#1D1D1F]" />
          </button>
        </div>
        <div className="flex flex-col items-center pt-20">
          <p className="text-[15px] text-[#86868B]">目标不存在</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#FAFAFA]" style={{ maxWidth: 430, margin: "0 auto" }}>
      {/* ===== 导航栏 ===== */}
      <div className="flex items-center h-14 px-4">
        <button onClick={() => router.push("/efficiency")} className="w-8 h-8 -ml-1 flex items-center justify-center">
          <ChevronLeft className="w-6 h-6 text-[#1D1D1F]" />
        </button>
        <span className="absolute left-1/2 -translate-x-1/2 text-[17px] font-semibold text-[#1D1D1F]">目标详情</span>
      </div>

      {/* ===== 目标卡片 ===== */}
      <div className="mx-4 mt-2 p-5 bg-white rounded-2xl border border-[#EBEBEB]">
        <div className="flex items-center gap-3">
          <div className="w-2 h-2 rounded-full flex-shrink-0" style={{ backgroundColor: goalColor }} />
          <h1 className="text-[20px] font-bold text-[#1D1D1F] truncate flex-1">{goal.title}</h1>
        </div>

        {/* 进度统计 */}
        <div className="mt-4 flex items-end justify-between">
          <div>
            <p className="text-[13px] text-[#86868B]">
              {taskStats.total > 0
                ? `${taskStats.done}/${taskStats.total} 项已完成`
                : "暂无任务"}
            </p>
          </div>
          <span className="text-[28px] font-bold text-[#1D1D1F] tabular-nums">{goalProgress}%</span>
        </div>

        {/* 进度条 */}
        <div className="mt-2 h-2 rounded-full bg-[#F5F5F5] overflow-hidden">
          <motion.div
            className="h-full rounded-full"
            style={{ backgroundColor: goalColor }}
            initial={{ width: 0 }}
            animate={{ width: `${goalProgress}%` }}
            transition={{ duration: 0.6, ease: "easeOut" }}
          />
        </div>

        {/* 剩余信息 */}
        {taskStats.total > 0 && !allCompleted && (
          <p className="mt-2 text-[13px] text-[#86868B]">
            还剩 {taskStats.total - taskStats.done} 项任务未完成
          </p>
        )}
        {allCompleted && taskStats.total > 0 && (
          <p className="mt-2 text-[13px] text-[#34C759]">所有任务已完成</p>
        )}

        {/* 备注 */}
        {goal.note && (
          <p className="mt-2 text-[13px] text-[#86868B]">{goal.note}</p>
        )}
      </div>

      {/* ===== 操作按钮区 ===== */}
      <div className="mx-4 mt-4 flex gap-3">
        <button
          type="button"
          onClick={() => router.push(`/efficiency/goals/${goalId}/tasks/new`)}
          className="flex-1 h-11 rounded-xl bg-[#6366F1] text-white text-[15px] font-semibold flex items-center justify-center gap-1.5"
        >
          <Plus className="w-4 h-4" />
          添加任务
        </button>
        <button
          type="button"
          onClick={() => setShowBulkImport(true)}
          className="flex-1 h-11 rounded-xl text-[15px] font-medium flex items-center justify-center gap-1.5"
          style={{ border: "1px solid var(--lifeflow-border)", color: "var(--color-text-secondary)" }}
        >
          <TrendingUp className="w-4 h-4" />
          批量导入
        </button>
        <button
          type="button"
          onClick={handleCompleteGoal}
          disabled={!allCompleted}
          className="flex-1 h-11 rounded-xl border text-[15px] font-semibold flex items-center justify-center gap-1.5 transition-all"
          style={{
            borderColor: allCompleted ? GREEN : BORDER,
            color: allCompleted ? GREEN : MUTED,
            background: allCompleted ? "rgba(52,199,89,0.06)" : "transparent",
            cursor: allCompleted ? "pointer" : "default",
          }}
        >
          <CheckCircle2 className="w-4 h-4" />
          完成目标
        </button>
      </div>

      {/* ===== 普通任务列表 ===== */}
      {normalTasks.length > 0 && (
        <div className="mx-4 mt-6">
          <h2 className="text-[15px] font-semibold text-[#86868B] mb-2">普通任务</h2>
          <div className="bg-white rounded-xl border border-[#EBEBEB] overflow-hidden">
            {normalTasks.map((task, i) => (
              <TaskRow
                key={task.id}
                task={task}
                onToggle={() => handleToggleTask(task.id)}
                onDelete={() => handleDeleteTask(task.id)}
                onEdit={() => openEdit(task)}
                showDivider={i < normalTasks.length - 1}
              />
            ))}
          </div>
        </div>
      )}

      {/* ===== 进度条任务列表 ===== */}
      {progressTasks.length > 0 && (
        <div className="mx-4 mt-6">
          <h2 className="text-[15px] font-semibold text-[#86868B] mb-2">进度条任务</h2>
          <div className="flex flex-col gap-2">
            {progressTasks.map((task) => (
              <ProgressTaskCard
                key={task.id}
                task={task}
                onToggle={() => handleToggleTask(task.id)}
              />
            ))}
          </div>
        </div>
      )}

      {/* ===== 空态 ===== */}
      {tasks.length === 0 && (
        <div className="flex flex-col items-center pt-12 px-8">
          <div className="w-16 h-16 rounded-2xl flex items-center justify-center mb-4" style={{ background: "var(--lifeflow-brand-50)" }}>
            <TrendingUp className="w-8 h-8" style={{ color: "var(--lifeflow-primary)" }} />
          </div>
          <p className="text-[16px] font-semibold" style={{ color: "var(--color-text-primary)" }}>拆解目标</p>
          <p className="text-[13px] text-center mt-1 mb-6" style={{ color: "var(--color-text-secondary)" }}>
            把目标拆成可执行的小任务，逐个击破
          </p>
          <div className="flex gap-3 w-full max-w-xs">
            <button
              onClick={() => router.push(`/efficiency/goals/${goalId}/tasks/new`)}
              className="flex-1 h-11 rounded-xl text-white text-[15px] font-semibold flex items-center justify-center gap-1.5"
              style={{ background: "var(--lifeflow-primary)" }}
            >
              <Plus className="w-4 h-4" />
              添加任务
            </button>
            <button
              onClick={() => setShowBulkImport(true)}
              className="flex-1 h-11 rounded-xl text-[15px] font-medium flex items-center justify-center gap-1.5"
              style={{ border: "1px solid var(--lifeflow-border)", color: "var(--color-text-secondary)" }}
            >
              <TrendingUp className="w-4 h-4" />
              批量导入
            </button>
          </div>
        </div>
      )}

      {/* ===== 底部安全区 ===== */}
      <div className="h-10" />

      {/* ===== 编辑任务弹层 ===== */}
      <AnimatePresence>
        {editingTask && (
          <>
            <motion.div
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              className="fixed inset-0 z-50" style={{ background: "rgba(0,0,0,0.3)" }}
              onClick={() => setEditingTask(null)}
            />
            <motion.div
              initial={{ y: "100%" }} animate={{ y: 0 }} exit={{ y: "100%" }}
              transition={{ type: "spring", damping: 30, stiffness: 300 }}
              className="fixed bottom-0 left-0 right-0 z-50 px-4 pb-8 pt-4 rounded-t-[24px]"
              style={{ background: "var(--color-surface-card)", boxShadow: "0 -4px 20px rgba(0,0,0,0.1)" }}
            >
              <div className="w-8 h-1 rounded-full mx-auto mb-4" style={{ background: "var(--lifeflow-border)" }} />
              <h3 className="text-[17px] font-bold mb-4" style={{ color: "var(--color-text-primary)" }}>编辑任务</h3>

              <input
                value={editTitle} onChange={e => setEditTitle(e.target.value)}
                className="w-full h-11 rounded-xl px-3 text-[15px] outline-none mb-3"
                style={{ background: "var(--color-surface-secondary)", border: "1px solid var(--lifeflow-border)" }}
                placeholder="任务名称"
              />
              <input
                value={editNote} onChange={e => setEditNote(e.target.value)}
                className="w-full h-11 rounded-xl px-3 text-[15px] outline-none mb-3"
                style={{ background: "var(--color-surface-secondary)", border: "1px solid var(--lifeflow-border)" }}
                placeholder="备注（可选）"
              />
              <input
                value={editReminderStr} onChange={e => setEditReminderStr(e.target.value)}
                className="w-full h-11 rounded-xl px-3 text-[15px] outline-none mb-3"
                style={{ background: "var(--color-surface-secondary)", border: "1px solid var(--lifeflow-border)" }}
                placeholder="提醒时间，逗号分隔（如 09:00, 18:00）"
              />

              {/* Goal selector */}
              <div className="mb-3">
                <p className="text-[12px] font-medium mb-2" style={{ color: "var(--color-text-secondary)" }}>所属目标</p>
                <select
                  value={editGoalId}
                  onChange={e => setEditGoalId(e.target.value)}
                  className="w-full h-11 rounded-xl px-3 text-[15px] outline-none"
                  style={{ background: "var(--color-surface-secondary)", border: "1px solid var(--lifeflow-border)", color: "var(--color-text-primary)" }}
                >
                  <option value="">无目标</option>
                  {(!!(globalThis as any).__goals ? (globalThis as any).__goals as Goal[] : goals).map((g: Goal) => (
                    <option key={g.id} value={g.id}>{g.title}</option>
                  ))}
                </select>
              </div>

              <div className="flex gap-2">
                <button
                  onClick={() => setEditingTask(null)}
                  className="flex-1 h-11 rounded-xl text-[15px] font-medium"
                  style={{ background: "var(--color-surface-secondary)", color: "var(--color-text-secondary)" }}
                >取消</button>
                <button
                  onClick={handleSaveEdit}
                  className="flex-1 h-11 rounded-xl text-[15px] font-semibold text-white"
                  style={{ background: "var(--lifeflow-primary)" }}
                >保存</button>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>

      {/* ===== 批量导入弹层 ===== */}
      <AnimatePresence>
        {showBulkImport && (
          <>
            <motion.div
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              className="fixed inset-0 z-50" style={{ background: "rgba(0,0,0,0.3)" }}
              onClick={() => setShowBulkImport(false)}
            />
            <motion.div
              initial={{ y: "100%" }} animate={{ y: 0 }} exit={{ y: "100%" }}
              transition={{ type: "spring", damping: 30, stiffness: 300 }}
              className="fixed bottom-0 left-0 right-0 z-50 px-4 pb-8 pt-4 rounded-t-[24px]"
              style={{ background: "var(--color-surface-card)", boxShadow: "0 -4px 20px rgba(0,0,0,0.1)" }}
            >
              <div className="w-8 h-1 rounded-full mx-auto mb-4" style={{ background: "var(--lifeflow-border)" }} />
              <h3 className="text-[17px] font-bold mb-4" style={{ color: "var(--color-text-primary)" }}>批量导入任务</h3>
              <p className="text-[12px] mb-3" style={{ color: "var(--color-text-disabled)" }}>
                每行一个任务，| 分隔字段，缩进表示子任务，# 开头为注释
              </p>
              <textarea
                value={bulkText}
                onChange={e => setBulkText(e.target.value)}
                className="w-full h-40 rounded-xl p-3 text-[14px] outline-none resize-none mb-3 font-mono"
                style={{ background: "var(--color-surface-secondary)", border: "1px solid var(--lifeflow-border)", color: "var(--color-text-primary)" }}
                placeholder={`设计阶段 | 日期:7/24~7/30\n  原型设计 | 备注:使用Figma\n  交互评审\n开发阶段\n  前端开发 | 日期:7/31`}
              />
              <div className="flex gap-2">
                <button onClick={() => setShowBulkImport(false)}
                  className="flex-1 h-11 rounded-xl text-[15px] font-medium"
                  style={{ background: "var(--color-surface-secondary)", color: "var(--color-text-secondary)" }}>
                  取消
                </button>
                <button onClick={handleBulkImport} disabled={bulkLoading}
                  className="flex-1 h-11 rounded-xl text-[15px] font-semibold text-white"
                  style={{ background: "var(--lifeflow-primary)" }}>
                  {bulkLoading ? "导入中..." : "导入"}
                </button>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  );
}

// ============================================================
// 普通任务行
// ============================================================
function TaskRow({ task, onToggle, onDelete, onEdit, showDivider }: { task: ScheduleTask; onToggle: () => void; onDelete: () => void; onEdit: () => void; showDivider: boolean }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      className="relative flex items-center gap-3 px-4 py-3 min-h-[52px] group"
    >
      {showDivider && (
        <div className="absolute left-[52px] right-0 top-0" style={{ borderTop: "0.5px solid #EBEBEB" }} />
      )}
      {/* 勾选圆 */}
      <button
        type="button"
        onClick={onToggle}
        className="w-6 h-6 rounded-full flex-shrink-0 flex items-center justify-center transition-colors"
        style={{
          border: task.isCompleted ? "none" : "2px solid #C7C7CC",
          background: task.isCompleted ? ACCENT : "#FFFFFF",
        }}
      >
        {task.isCompleted && <Check className="w-[14px] h-[14px] text-white" strokeWidth={3} />}
      </button>
      {/* 内容 */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-1.5">
          <p
            className="text-[17px] truncate"
            style={{
              color: task.isCompleted ? "#AEAEB2" : "#1D1D1F",
              textDecoration: task.isCompleted ? "line-through" : "none",
            }}
          >
            {task.title}
          </p>
          {task.isImportant && !task.isCompleted && (
            <span className="w-[6px] h-[6px] rounded-full flex-shrink-0 bg-[#6366F1]" />
          )}
        </div>
        {task.note && (
          <p className="text-[13px] text-[#86868B] truncate mt-0.5">{task.note}</p>
        )}
      </div>
      {/* Edit + Delete buttons */}
      <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
        <button
          type="button"
          onClick={(e) => { e.stopPropagation(); onEdit(); }}
          className="w-7 h-7 rounded-lg flex items-center justify-center"
          style={{ background: "rgba(99,102,241,0.1)" }}
        >
          <Pencil className="w-3.5 h-3.5" style={{ color: "#6366F1" }} />
        </button>
        <button
          type="button"
          onClick={(e) => { e.stopPropagation(); if (window.confirm('确定删除任务？')) onDelete(); }}
          className="w-7 h-7 rounded-lg flex items-center justify-center"
          style={{ background: "rgba(255,59,48,0.1)" }}
        >
          <X className="w-3.5 h-3.5" style={{ color: "#FF3B30" }} />
        </button>
      </div>
    </motion.div>
  );
}

// ============================================================
// 进度条任务卡片
// ============================================================
function ProgressTaskCard({ task, onToggle }: { task: ScheduleTask; onToggle: () => void }) {
  const current = task.progressCurrent ?? task.startValue ?? 0;
  const target = task.targetValue ?? 100;
  const pct = calcProgress(current, target);
  const unit = task.targetUnit || "";

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      className="bg-white rounded-xl border border-[#EBEBEB] p-4"
    >
      {/* 标题行 */}
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={onToggle}
          className="w-6 h-6 rounded-full flex-shrink-0 flex items-center justify-center transition-colors"
          style={{
            border: task.isCompleted ? "none" : "2px solid #C7C7CC",
            background: task.isCompleted ? ACCENT : "#FFFFFF",
          }}
        >
          {task.isCompleted && <Check className="w-[14px] h-[14px] text-white" strokeWidth={3} />}
        </button>
        <span
          className="text-[17px] font-medium truncate flex-1"
          style={{
            color: task.isCompleted ? "#AEAEB2" : "#1D1D1F",
            textDecoration: task.isCompleted ? "line-through" : "none",
          }}
        >
          {task.title}
        </span>
        {/* 状态点 */}
        <span
          className="w-2 h-2 rounded-full flex-shrink-0"
          style={{ backgroundColor: task.isCompleted ? GREEN : pct >= 100 ? GREEN : ACCENT }}
        />
      </div>

      {/* 进度信息 */}
      <div className="flex items-center justify-between mt-2">
        <span className="text-[13px] text-[#86868B]">
          {current} / {target} {unit}
        </span>
        <span className="text-[13px] font-semibold" style={{ color: ACCENT }}>
          {pct}%
        </span>
      </div>

      {/* 进度条 */}
      <div className="mt-1.5 h-1.5 rounded-full bg-[#F5F5F5] overflow-hidden">
        <motion.div
          className="h-full rounded-full"
          style={{ backgroundColor: task.isCompleted ? GREEN : ACCENT }}
          initial={{ width: 0 }}
          animate={{ width: `${pct}%` }}
          transition={{ duration: 0.6, ease: "easeOut" }}
        />
      </div>

      {/* 备注 */}
      {task.note && (
        <p className="mt-1.5 text-[13px] text-[#86868B] truncate">{task.note}</p>
      )}
    </motion.div>
  );
}
