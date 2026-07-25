"use client";

import { useEffect, useState, useMemo, useCallback } from "react";
import { useRouter, useParams } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import {
  ChevronLeft, Check, Plus, CheckCircle2, TrendingUp, ChevronDown,
  Circle, AlertTriangle, X, Trash2, Pencil, Zap,
} from "lucide-react";
import { useLiveQuery } from "dexie-react-hooks";
import { useEfficiencyStore } from "@/lib/store/efficiencyStore";
import { efficiencyDB, type Goal, type ScheduleTask, type Project, getAllProjects, addScheduleTask } from "@/lib/db/efficiency.db";
import { addManualItem } from "@/lib/db/daylog.db";
import { showToast } from "@/components/ui/Toast";
import { parseBulkTasks, flattenTasks } from "@/lib/bulkTaskParser";
import { CreateTaskSheet } from "@/components/efficiency/CreateTaskSheet";

// ============================================================
// 设计令牌
// ============================================================
const ACCENT = "#6366F1";
const GREEN = "#34C759";
const PRESET_COLORS = ["#6366F1", "#FF9500", "#34C759", "#FF3B30", "#007AFF", "#5856D6"];

function todayStr(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

// ============================================================
// 主组件
// ============================================================
export default function GoalDetailPage() {
  const router = useRouter();
  const params = useParams();
  const goalId = params.goalId as string;

  const { goals, loadGoals, updateGoalStatus, toggleScheduleTask, removeScheduleTask } = useEfficiencyStore();

  const goal = useLiveQuery(() => efficiencyDB.goals.get(goalId), [goalId]);
  const allScheduleTasks = useLiveQuery(() => efficiencyDB.scheduleTasks.toArray(), []);
  const projects = useLiveQuery(() => getAllProjects(), [], [] as Project[]);

  const goalColor = useMemo(() => {
    if (!goal) return ACCENT;
    const p = projects.find((p) => p.id === goal.projectId);
    return p?.color || ACCENT;
  }, [goal, projects]);

  const tasks = useMemo(() => {
    if (!allScheduleTasks) return [];
    return allScheduleTasks.filter((t) => t.goalId === goalId);
  }, [allScheduleTasks, goalId]);

  const normalTasks = useMemo(() => tasks.filter((t) => t.progressType !== "progress"), [tasks]);
  const progressTasks = useMemo(() => tasks.filter((t) => t.progressType === "progress"), [tasks]);

  const taskStats = useMemo(() => {
    const total = tasks.length;
    const done = tasks.filter((t) => t.isCompleted).length;
    return { total, done };
  }, [tasks]);

  const allCompleted = taskStats.total > 0 && taskStats.done === taskStats.total;
  const goalProgress = taskStats.total > 0 ? Math.round((taskStats.done / taskStats.total) * 100) : 0;

  /* ── 任务 BottomSheet ── */
  const [showTaskSheet, setShowTaskSheet] = useState(false);
  const handleTaskSubmit = useCallback(async (task: Omit<ScheduleTask, "id" | "createdAt">) => {
    await addScheduleTask({ ...task, goalId } as any);
    showToast({ type: "success", message: "任务已添加" });
    setShowTaskSheet(false);
  }, [goalId]);

  /* ── 事项创建 ── */
  const [showItemSheet, setShowItemSheet] = useState(false);
  const [itemTitle, setItemTitle] = useState("");
  const [itemStart, setItemStart] = useState("09:00");
  const [itemEnd, setItemEnd] = useState("09:30");
  const [itemNote, setItemNote] = useState("");
  const [itemColor, setItemColor] = useState(goalColor || PRESET_COLORS[0]);
  const [itemSubmitting, setItemSubmitting] = useState(false);
  const [itemTaskId, setItemTaskId] = useState<string | null>(null);

  const openItemSheet = useCallback((taskId?: string) => {
    setItemTaskId(taskId || null);
    const now = new Date();
    const hh = String(now.getHours()).padStart(2, "0");
    const mm = String(now.getMinutes()).padStart(2, "0");
    const startTime = `${hh}:${String(Math.floor(Number(mm) / 5) * 5).padStart(2, "0")}`;
    const endH = Number(hh);
    const endM = Math.floor(Number(mm) / 5) * 5 + 30;
    const eh = endH + Math.floor(endM / 60);
    const em = endM % 60;
    const endTime = `${String(eh).padStart(2, "0")}:${String(em).padStart(2, "0")}`;
    setItemStart(startTime);
    setItemEnd(endTime);
    setItemTitle("");
    setItemNote("");
    setShowItemSheet(true);
  }, []);

  const handleCreateItem = useCallback(async () => {
    if (!itemTitle.trim()) { showToast({ type: "warning", message: "标题还没填" }); return; }
    setItemSubmitting(true);
    try {
      await addManualItem({
        date: todayStr(),
        plannedStart: itemStart,
        plannedEnd: itemEnd,
        title: itemTitle.trim(),
        note: itemNote || undefined,
        color: itemColor,
        projectId: goal?.projectId || undefined,
      });
      showToast({ type: "success", message: "已添加" });
      setShowItemSheet(false);
    } catch {
      showToast({ type: "error", message: "没有添加成功，再试一次？" });
    } finally {
      setItemSubmitting(false);
    }
  }, [itemTitle, itemStart, itemEnd, itemNote, itemColor, goal]);

  /* ── 任务编辑 ── */
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
    const reminders = editReminderStr.split(",").map(s => s.trim()).filter(Boolean);
    await useEfficiencyStore.getState().updateScheduleTask(editingTask.id, {
      title: editTitle,
      note: editNote,
      goalId: editGoalId || null,
      reminderTimes: reminders.length > 0 ? reminders : undefined,
    });
    showToast({ type: "success", message: "任务已更新" });
    setEditingTask(null);
  }, [editingTask, editTitle, editNote, editGoalId, editReminderStr]);

  /* ── 批量导入 ── */
  const [showBulkImport, setShowBulkImport] = useState(false);
  const [bulkText, setBulkText] = useState("");
  const [bulkLoading, setBulkLoading] = useState(false);
  const [detailTaskId, setDetailTaskId] = useState<string | null>(null);
  const detailTask = useMemo(
    () => (detailTaskId ? tasks.find((t) => t.id === detailTaskId) ?? null : null),
    [detailTaskId, tasks],
  );

  const handleBulkImport = useCallback(async () => {
    if (!bulkText.trim()) return;
    setBulkLoading(true);
    try {
      const parsed = parseBulkTasks(bulkText);
      const flat = flattenTasks(parsed, goalId);
      for (const t of flat) await addScheduleTask(t as any);
      showToast({ type: "success", message: `已导入 ${flat.length} 条` });
      setShowBulkImport(false);
      setBulkText("");
    } catch {
      showToast({ type: "error", message: "格式有问题，检查一下？" });
    } finally {
      setBulkLoading(false);
    }
  }, [bulkText, goalId]);

  const handleToggleTask = useCallback(async (taskId: string) => {
    await toggleScheduleTask(taskId);
    const updated = (allScheduleTasks ?? []).map((t) =>
      t.id === taskId ? { ...t, isCompleted: !t.isCompleted } : t,
    );
    const goalTasks = updated.filter((t) => t.goalId === goalId);
    const done = goalTasks.filter((t) => t.isCompleted).length;
    const pct = goalTasks.length > 0 ? Math.round((done / goalTasks.length) * 100) : 0;
    await efficiencyDB.goals.update(goalId, { progress: pct } as any);
  }, [toggleScheduleTask, allScheduleTasks, goalId]);

  const handleDeleteTask = useCallback(async (taskId: string) => {
    await removeScheduleTask(taskId);
    showToast({ type: "success", message: "已删除" });
  }, [removeScheduleTask]);

  const handleCompleteGoal = useCallback(async () => {
    if (!goal || !allCompleted) return;
    await updateGoalStatus(goalId, "completed");
    showToast({ type: "success", message: "目标已完成" });
    router.push("/efficiency");
  }, [goal, goalId, allCompleted, updateGoalStatus, router]);

  useEffect(() => { loadGoals(); }, [loadGoals]);

  if (!goal) {
    return (
      <div className="min-h-screen" style={{ maxWidth: 430, margin: "0 auto", background: "var(--lifeflow-background)" }}>
        <div className="flex items-center h-14 px-4" style={{ paddingTop: "var(--safe-area-top)" }}>
          <button onClick={() => router.push("/efficiency")} className="w-8 h-8 -ml-1 flex items-center justify-center">
            <ChevronLeft className="w-6 h-6" style={{ color: "var(--color-text-primary)" }} />
          </button>
        </div>
        <div className="flex flex-col items-center pt-20">
          <p className="text-[15px]" style={{ color: "var(--color-text-disabled)" }}>目标不存在</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen pb-[100px]" style={{ maxWidth: 430, margin: "0 auto", background: "var(--lifeflow-background)" }}>
      {/* ===== Header ===== */}
      <div className="px-5 pt-[var(--safe-area-top)] pb-2 flex items-center justify-between">
        <button onClick={() => router.push("/efficiency")} className="w-8 h-8 -ml-1 flex items-center justify-center">
          <ChevronLeft className="w-6 h-6" style={{ color: "var(--color-text-primary)" }} />
        </button>
        <h1 className="text-[17px] font-semibold" style={{ color: "var(--color-text-primary)" }}>目标详情</h1>
        <div className="w-8" />
      </div>

      {/* ===== 目标卡片 ===== */}
      <div className="mx-4 p-5 rounded-[20px]" style={{ background: "var(--color-surface-card)", boxShadow: "var(--shadow-card)" }}>
        <div className="flex items-center gap-3">
          <div className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ backgroundColor: goalColor }} />
          <h1 className="text-[20px] font-bold truncate flex-1" style={{ color: "var(--color-text-primary)" }}>{goal.title}</h1>
        </div>

        <div className="mt-4 flex items-end justify-between">
          <div>
            <p className="text-[13px]" style={{ color: "var(--color-text-secondary)" }}>
              {taskStats.total > 0 ? `${taskStats.done}/${taskStats.total} 项已完成` : "暂无任务"}
            </p>
          </div>
          <span className="text-[28px] font-bold tabular-nums" style={{ color: "var(--color-text-primary)" }}>{goalProgress}%</span>
        </div>

        <div className="mt-2 h-2 rounded-full overflow-hidden" style={{ background: "var(--lifeflow-muted)" }}>
          <motion.div
            className="h-full rounded-full"
            style={{ backgroundColor: goalColor }}
            initial={{ width: 0 }}
            animate={{ width: `${goalProgress}%` }}
            transition={{ duration: 0.6, ease: "easeOut" }}
          />
        </div>

        {taskStats.total > 0 && !allCompleted && (
          <p className="mt-2 text-[13px]" style={{ color: "var(--color-text-secondary)" }}>
            还剩 {taskStats.total - taskStats.done} 项任务未完成
          </p>
        )}
        {allCompleted && taskStats.total > 0 && (
          <p className="mt-2 text-[13px]" style={{ color: GREEN }}>所有任务已完成</p>
        )}
        {goal.note && (
          <p className="mt-2 text-[13px]" style={{ color: "var(--color-text-secondary)" }}>{goal.note}</p>
        )}
      </div>

      {/* ===== 快捷操作 ===== */}
      <div className="mx-4 mt-3 flex gap-2">
        <button
          onClick={() => openItemSheet()}
          className="flex-[2] h-11 rounded-xl text-white text-[15px] font-semibold flex items-center justify-center gap-1.5 active:opacity-90"
          style={{ background: goalColor }}
        >
          <Zap className="w-4 h-4" />
          添加事项
        </button>
        <button
          onClick={() => setShowTaskSheet(true)}
          className="flex-1 h-11 rounded-xl text-[15px] font-medium flex items-center justify-center gap-1.5"
          style={{ border: "1px solid var(--lifeflow-border)", color: "var(--color-text-secondary)", background: "var(--color-surface-card)" }}
        >
          <Plus className="w-4 h-4" />
          添加任务
        </button>
        <button
          onClick={() => setShowBulkImport(true)}
          className="w-11 h-11 rounded-xl flex items-center justify-center"
          style={{ border: "1px solid var(--lifeflow-border)", color: "var(--color-text-disabled)", background: "var(--color-surface-card)" }}
        >
          <TrendingUp className="w-4 h-4" />
        </button>
      </div>

      {/* ===== 任务列表 ===== */}
      {tasks.length > 0 && (
        <div className="mx-4 mt-5">
          <h2 className="text-[13px] font-semibold mb-2 px-1" style={{ color: "var(--color-text-disabled)" }}>
            任务列表
          </h2>
          <div className="rounded-[16px] overflow-hidden" style={{ background: "var(--color-surface-card)", boxShadow: "var(--shadow-card)" }}>
            {normalTasks.map((task, i) => (
              <TaskRow
                key={task.id}
                task={task}
                onToggle={() => handleToggleTask(task.id)}
                onDelete={() => handleDeleteTask(task.id)}
                onEdit={() => openEdit(task)}
                onClick={() => setDetailTaskId(detailTaskId === task.id ? null : task.id)}
                showDivider={i < normalTasks.length - 1}
              />
            ))}
          </div>

          {/* 任务展开详情 */}
          <AnimatePresence>
            {detailTask && (
              <motion.div
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: "auto", opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                transition={{ duration: 0.2 }}
                className="overflow-hidden"
              >
                <div
                  className="px-4 py-4 mt-2 rounded-[16px]"
                  style={{ background: "var(--color-surface-card)", boxShadow: "var(--shadow-card)" }}
                >
                  <div className="flex items-center justify-between mb-3">
                    <p className="text-[15px] font-semibold" style={{ color: "var(--color-text-primary)" }}>{detailTask.title}</p>
                    <button onClick={() => setDetailTaskId(null)} className="w-6 h-6 flex items-center justify-center rounded-full" style={{ background: "var(--lifeflow-muted)" }}>
                      <ChevronDown className="w-4 h-4" style={{ color: "var(--color-text-secondary)" }} />
                    </button>
                  </div>
                  {detailTask.note && (
                    <p className="text-[13px] mb-3" style={{ color: "var(--color-text-secondary)" }}>{detailTask.note}</p>
                  )}
                  <div className="flex items-center gap-2 text-[13px] mb-4" style={{ color: "var(--color-text-disabled)" }}>
                    {detailTask.startDate && <span>{detailTask.startDate} 起</span>}
                    {detailTask.progressType === "progress" && detailTask.targetValue !== undefined && (
                      <span>· 目标 {detailTask.targetValue}{detailTask.targetUnit || ""}</span>
                    )}
                  </div>
                  <button
                    onClick={() => openItemSheet(detailTask.id)}
                    className="inline-flex items-center gap-1.5 px-4 py-2 rounded-full text-[13px] font-medium active:opacity-70"
                    style={{ background: goalColor, color: "#fff" }}
                  >
                    <Plus className="w-3.5 h-3.5" />
                    创建事项
                  </button>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      )}

      {/* 进度条任务 */}
      {progressTasks.length > 0 && (
        <div className="mx-4 mt-5">
          <h2 className="text-[13px] font-semibold mb-2 px-1" style={{ color: "var(--color-text-disabled)" }}>
            进度条任务
          </h2>
          <div className="flex flex-col gap-2">
            {progressTasks.map((task) => (
              <ProgressTaskCard key={task.id} task={task} onToggle={() => handleToggleTask(task.id)} color={goalColor} />
            ))}
          </div>
        </div>
      )}

      {/* 空态 */}
      {tasks.length === 0 && (
        <div className="flex flex-col items-center pt-10 px-8">
          <div className="w-16 h-16 rounded-2xl flex items-center justify-center mb-4" style={{ background: "var(--lifeflow-brand-50)" }}>
            <TrendingUp className="w-8 h-8" style={{ color: "var(--lifeflow-primary)" }} />
          </div>
          <p className="text-[16px] font-semibold" style={{ color: "var(--color-text-primary)" }}>拆解目标</p>
          <p className="text-[13px] text-center mt-1 mb-6" style={{ color: "var(--color-text-secondary)" }}>
            把目标拆成可执行的小任务，逐个击破。也可以直接添加事项。
          </p>
          <div className="flex gap-2 w-full max-w-xs">
            <button
              onClick={() => openItemSheet()}
              className="flex-1 h-11 rounded-xl text-white text-[15px] font-semibold flex items-center justify-center gap-1.5"
              style={{ background: goalColor }}
            >
              <Zap className="w-4 h-4" />
              添加事项
            </button>
            <button
              onClick={() => setShowTaskSheet(true)}
              className="flex-1 h-11 rounded-xl text-[15px] font-medium flex items-center justify-center gap-1.5"
              style={{ border: "1px solid var(--lifeflow-border)", color: "var(--color-text-secondary)" }}
            >
              <Plus className="w-4 h-4" />
              添加任务
            </button>
          </div>
        </div>
      )}

      {/* ===== 底部"完成目标" ===== */}
      {tasks.length > 0 && (
        <div className="mx-4 mt-4">
          <button
            onClick={handleCompleteGoal}
            disabled={!allCompleted}
            className="w-full h-12 rounded-xl text-[15px] font-semibold flex items-center justify-center gap-1.5 transition-all"
            style={{
              border: allCompleted ? `1.5px solid ${GREEN}` : "1px solid var(--lifeflow-border)",
              color: allCompleted ? GREEN : "var(--color-text-disabled)",
              background: allCompleted ? `${GREEN}10` : "transparent",
            }}
          >
            <CheckCircle2 className="w-4 h-4" />
            完成目标
          </button>
        </div>
      )}

      {/* ===== 事项 BottomSheet ===== */}
      <AnimatePresence>
        {showItemSheet && (
          <>
            <motion.div
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              className="fixed inset-0 z-50 bg-black/40"
              onClick={() => setShowItemSheet(false)}
            />
            <motion.div
              initial={{ y: "100%" }} animate={{ y: 0 }} exit={{ y: "100%" }}
              transition={{ type: "spring", damping: 30, stiffness: 300 }}
              className="fixed left-0 right-0 bottom-0 z-[60] rounded-t-[24px] max-w-[430px] mx-auto px-4 pt-4"
              style={{ background: "var(--color-surface-card)", paddingBottom: "calc(24px + env(safe-area-inset-bottom))" }}
              onClick={(e) => e.stopPropagation()}
            >
              <div className="w-8 h-1 rounded-full mx-auto mb-4" style={{ background: "var(--lifeflow-border)" }} />
              <h3 className="text-[17px] font-bold mb-4" style={{ color: "var(--color-text-primary)" }}>
                添加事项 {itemTaskId ? `· ${tasks.find(t => t.id === itemTaskId)?.title || ""}` : ""}
              </h3>

              <input
                value={itemTitle}
                onChange={(e) => setItemTitle(e.target.value)}
                className="w-full h-11 rounded-xl px-3 text-[15px] outline-none mb-3"
                style={{ background: "var(--lifeflow-background)", border: "1px solid var(--lifeflow-border)", color: "var(--color-text-primary)" }}
                placeholder="事项名称"
                autoFocus
              />

              <div className="flex gap-3 mb-3">
                <div className="flex-1">
                  <label className="text-[13px] mb-1 block" style={{ color: "var(--color-text-secondary)" }}>开始</label>
                  <input
                    type="time" value={itemStart} onChange={(e) => setItemStart(e.target.value)}
                    className="w-full h-11 rounded-xl px-3 text-[15px] outline-none"
                    style={{ background: "var(--lifeflow-background)", border: "1px solid var(--lifeflow-border)", color: "var(--color-text-primary)" }}
                  />
                </div>
                <div className="flex-1">
                  <label className="text-[13px] mb-1 block" style={{ color: "var(--color-text-secondary)" }}>结束</label>
                  <input
                    type="time" value={itemEnd} onChange={(e) => setItemEnd(e.target.value)}
                    className="w-full h-11 rounded-xl px-3 text-[15px] outline-none"
                    style={{ background: "var(--lifeflow-background)", border: "1px solid var(--lifeflow-border)", color: "var(--color-text-primary)" }}
                  />
                </div>
              </div>

              <input
                value={itemNote} onChange={(e) => setItemNote(e.target.value)}
                className="w-full h-11 rounded-xl px-3 text-[15px] outline-none mb-3"
                style={{ background: "var(--lifeflow-background)", border: "1px solid var(--lifeflow-border)", color: "var(--color-text-primary)" }}
                placeholder="备注（可选）"
              />

              <div className="flex items-center gap-2 mb-4">
                <span className="text-[13px]" style={{ color: "var(--color-text-secondary)" }}>颜色</span>
                <div className="flex gap-1.5">
                  {PRESET_COLORS.map((c) => (
                    <button key={c} onClick={() => setItemColor(c)}
                      className="w-7 h-7 rounded-full transition-transform"
                      style={{
                        background: c,
                        transform: itemColor === c ? "scale(1.15)" : "scale(1)",
                        boxShadow: itemColor === c ? `0 0 0 2px var(--color-surface-card), 0 0 0 4px ${c}` : "none",
                      }}
                    />
                  ))}
                </div>
              </div>

              <button
                onClick={handleCreateItem}
                disabled={itemSubmitting}
                className="w-full py-3.5 rounded-full text-[16px] font-semibold text-white disabled:opacity-50 active:opacity-90"
                style={{ background: goalColor }}
              >
                {itemSubmitting ? "处理中..." : "添加事项"}
              </button>
            </motion.div>
          </>
        )}
      </AnimatePresence>

      {/* ===== 任务创建 BottomSheet（精简模式） ===== */}
      <CreateTaskSheet
        open={showTaskSheet}
        goalId={goalId}
        onClose={() => setShowTaskSheet(false)}
        onSubmit={handleTaskSubmit}
        lite
      />

      {/* ===== 编辑任务弹层 ===== */}
      <AnimatePresence>
        {editingTask && (
          <>
            <motion.div
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              className="fixed inset-0 z-50 bg-black/40"
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

              <input value={editTitle} onChange={(e) => setEditTitle(e.target.value)}
                className="w-full h-11 rounded-xl px-3 text-[15px] outline-none mb-3"
                style={{ background: "var(--lifeflow-background)", border: "1px solid var(--lifeflow-border)", color: "var(--color-text-primary)" }}
                placeholder="任务名称"
              />
              <input value={editNote} onChange={(e) => setEditNote(e.target.value)}
                className="w-full h-11 rounded-xl px-3 text-[15px] outline-none mb-3"
                style={{ background: "var(--lifeflow-background)", border: "1px solid var(--lifeflow-border)", color: "var(--color-text-primary)" }}
                placeholder="备注（可选）"
              />
              <input value={editReminderStr} onChange={(e) => setEditReminderStr(e.target.value)}
                className="w-full h-11 rounded-xl px-3 text-[15px] outline-none mb-3"
                style={{ background: "var(--lifeflow-background)", border: "1px solid var(--lifeflow-border)", color: "var(--color-text-primary)" }}
                placeholder="提醒时间，逗号分隔"
              />

              <div className="flex gap-2">
                <button onClick={() => setEditingTask(null)}
                  className="flex-1 h-11 rounded-xl text-[15px] font-medium"
                  style={{ background: "var(--lifeflow-background)", color: "var(--color-text-secondary)" }}
                >取消</button>
                <button onClick={handleSaveEdit}
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
              className="fixed inset-0 z-50 bg-black/40"
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
                value={bulkText} onChange={(e) => setBulkText(e.target.value)}
                className="w-full h-40 rounded-xl p-3 text-[14px] outline-none resize-none mb-3 font-mono"
                style={{ background: "var(--lifeflow-background)", border: "1px solid var(--lifeflow-border)", color: "var(--color-text-primary)" }}
                placeholder={`设计阶段 | 日期:7/24~7/30\n  原型设计 | 备注:使用Figma\n  交互评审\n开发阶段\n  前端开发 | 日期:7/31`}
              />
              <div className="flex gap-2">
                <button onClick={() => setShowBulkImport(false)}
                  className="flex-1 h-11 rounded-xl text-[15px] font-medium"
                  style={{ background: "var(--lifeflow-background)", color: "var(--color-text-secondary)" }}>
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
function TaskRow({ task, onToggle, onDelete, onEdit, showDivider, onClick }: {
  task: ScheduleTask;
  onToggle: () => void;
  onDelete: () => void;
  onEdit: () => void;
  showDivider: boolean;
  onClick?: () => void;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      onClick={onClick}
      className="relative flex items-center gap-3 px-4 py-3 min-h-[52px] group cursor-pointer"
    >
      {showDivider && (
        <div className="absolute left-[52px] right-0 top-0" style={{ borderTop: "0.5px solid var(--lifeflow-border)" }} />
      )}
      <button
        type="button" onClick={(e) => { e.stopPropagation(); onToggle(); }}
        className="w-6 h-6 rounded-full flex-shrink-0 flex items-center justify-center transition-colors"
        style={{
          border: task.isCompleted ? "none" : `2px solid ${"var(--color-text-disabled)"}`,
          background: task.isCompleted ? ACCENT : "transparent",
        }}
      >
        {task.isCompleted && <Check className="w-[14px] h-[14px] text-white" strokeWidth={3} />}
      </button>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-1.5">
          <p className="text-[17px] truncate" style={{
            color: task.isCompleted ? "var(--color-text-disabled)" : "var(--color-text-primary)",
            textDecoration: task.isCompleted ? "line-through" : "none",
          }}>
            {task.title}
          </p>
          {task.isImportant && !task.isCompleted && (
            <span className="w-[6px] h-[6px] rounded-full flex-shrink-0" style={{ background: ACCENT }} />
          )}
        </div>
        {task.note && <p className="text-[13px] truncate mt-0.5" style={{ color: "var(--color-text-disabled)" }}>{task.note}</p>}
      </div>
      <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
        <button
          type="button" onClick={(e) => { e.stopPropagation(); onEdit(); }}
          className="w-7 h-7 rounded-lg flex items-center justify-center"
          style={{ background: "var(--lifeflow-brand-50)" }}
        >
          <Pencil className="w-3.5 h-3.5" style={{ color: ACCENT }} />
        </button>
        <button
          type="button" onClick={(e) => { e.stopPropagation(); if (window.confirm("确定删除任务？")) onDelete(); }}
          className="w-7 h-7 rounded-lg flex items-center justify-center"
          style={{ background: "#FF3B3015" }}
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
function ProgressTaskCard({ task, onToggle, color }: { task: ScheduleTask; onToggle: () => void; color: string }) {
  const current = task.progressCurrent ?? task.startValue ?? 0;
  const target = task.targetValue ?? 100;
  const pct = Math.min(100, Math.max(0, Math.round((current / target) * 100)));
  const unit = task.targetUnit || "";

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
      className="p-4 rounded-[16px]"
      style={{ background: "var(--color-surface-card)", boxShadow: "var(--shadow-card)" }}
    >
      <div className="flex items-center gap-2">
        <button
          type="button" onClick={onToggle}
          className="w-6 h-6 rounded-full flex-shrink-0 flex items-center justify-center transition-colors"
          style={{
            border: task.isCompleted ? "none" : `2px solid ${"var(--color-text-disabled)"}`,
            background: task.isCompleted ? ACCENT : "transparent",
          }}
        >
          {task.isCompleted && <Check className="w-[14px] h-[14px] text-white" strokeWidth={3} />}
        </button>
        <span className="text-[17px] font-medium truncate flex-1" style={{
          color: task.isCompleted ? "var(--color-text-disabled)" : "var(--color-text-primary)",
          textDecoration: task.isCompleted ? "line-through" : "none",
        }}>
          {task.title}
        </span>
        <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ backgroundColor: task.isCompleted ? GREEN : pct >= 100 ? GREEN : color }} />
      </div>

      <div className="flex items-center justify-between mt-2">
        <span className="text-[13px]" style={{ color: "var(--color-text-secondary)" }}>
          {current} / {target} {unit}
        </span>
        <span className="text-[13px] font-semibold" style={{ color }}>{pct}%</span>
      </div>

      <div className="mt-1.5 h-1.5 rounded-full overflow-hidden" style={{ background: "var(--lifeflow-muted)" }}>
        <motion.div
          className="h-full rounded-full"
          style={{ backgroundColor: task.isCompleted ? GREEN : color }}
          initial={{ width: 0 }}
          animate={{ width: `${pct}%` }}
          transition={{ duration: 0.6, ease: "easeOut" }}
        />
      </div>

      {task.note && <p className="mt-1.5 text-[13px] truncate" style={{ color: "var(--color-text-secondary)" }}>{task.note}</p>}
    </motion.div>
  );
}
