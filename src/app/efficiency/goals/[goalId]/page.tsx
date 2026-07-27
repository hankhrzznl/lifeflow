"use client";

import { useEffect, useState, useMemo, useCallback } from "react";
import { useRouter, useParams } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import {
  ChevronLeft, Check, Plus, CheckCircle2, TrendingUp, ChevronDown,
  Circle, X, Trash2, Pencil, Zap, RotateCcw,
} from "lucide-react";
import { useLiveQuery } from "dexie-react-hooks";
import { useEfficiencyStore } from "@/lib/store/efficiencyStore";
import { efficiencyDB, type Goal, type ScheduleTask, type Project, getAllProjects, addScheduleTask } from "@/lib/db/efficiency.db";
import { daylogDB, type Item, addItem, timeToSort } from "@/lib/db/daylog.db";
import { showToast } from "@/components/ui/Toast";
import { parseBulkTasks, flattenTasks } from "@/lib/bulkTaskParser";
import { CreateTaskSheet } from "@/components/efficiency/CreateTaskSheet";

// ============================================================
// 常量
// ============================================================
const ACCENT = "#6366F1";
const GREEN = "#34C759";

const TIME_SLOTS_MULTI = [
  { key: "morning", label: "早上", time: "08:00" },
  { key: "forenoon", label: "上午", time: "10:00" },
  { key: "noon", label: "中午", time: "12:00" },
  { key: "afternoon", label: "下午", time: "15:00" },
  { key: "evening", label: "晚上", time: "18:00" },
  { key: "night", label: "睡前", time: "22:00" },
] as const;

const REPEAT_OPTIONS = [
  { value: "none", label: "无" },
  { value: "daily", label: "每天" },
  { value: "weekdays", label: "工作日" },
  { value: "weekly", label: "每周" },
] as const;

function todayStr(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function addDays(dateStr: string, days: number): string {
  const d = new Date(dateStr + "T00:00:00");
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
}

function endTimeFrom(start: string): string {
  const [h, m] = start.split(":").map(Number);
  const total = h * 60 + m + 30;
  const eh = Math.floor(total / 60) % 24;
  const em = total % 60;
  return `${String(eh).padStart(2, "0")}:${String(em).padStart(2, "0")}`;
}

// ============================================================
// Item 分组类型
// ============================================================
interface ItemGroup {
  key: string;
  title: string;
  items: Item[];
  completedCount: number;
  totalCount: number;
}

function groupItems(items: Item[]): ItemGroup[] {
  const map = new Map<string, Item[]>();
  for (const item of items) {
    const key = item.repeatGroupId || item.title;
    if (!map.has(key)) map.set(key, []);
    map.get(key)!.push(item);
  }
  return Array.from(map.entries()).map(([key, groupItems]) => ({
    key,
    title: groupItems[0]?.title || key,
    items: groupItems,
    completedCount: groupItems.filter(i => i.isCompleted).length,
    totalCount: groupItems.length,
  }));
}

// ============================================================
// 主组件
// ============================================================
export default function GoalDetailPage() {
  const router = useRouter();
  const params = useParams();
  const goalId = params.goalId as string;

  const { loadGoals, updateGoalStatus, toggleScheduleTask, removeScheduleTask } = useEfficiencyStore();

  /* ── 数据 ── */
  const goal = useLiveQuery(() => efficiencyDB.goals.get(goalId), [goalId]);
  const allScheduleTasks = useLiveQuery(() => efficiencyDB.scheduleTasks.toArray(), []);
  const projects = useLiveQuery(() => getAllProjects(), [], [] as Project[]);
  const allItems = useLiveQuery(
    () => daylogDB.items.where("goalId").equals(goalId).toArray(),
    [goalId],
    [] as Item[],
  );

  const goalColor = useMemo(() => {
    if (!goal) return ACCENT;
    const p = projects.find((p) => p.id === goal.projectId);
    return p?.color || ACCENT;
  }, [goal, projects]);

  const tasks = useMemo(() => {
    if (!allScheduleTasks) return [];
    return allScheduleTasks.filter((t) => t.goalId === goalId);
  }, [allScheduleTasks, goalId]);

  const goalProgress = useMemo(() => {
    if (allItems.length === 0) return 0;
    return Math.round(allItems.filter(i => i.isCompleted).length / allItems.length * 100);
  }, [allItems]);

  const directItems = useMemo(() => allItems.filter(i => !i.taskId), [allItems]);
  const directGroups = useMemo(() => groupItems(directItems), [directItems]);

  const taskItemsMap = useMemo(() => {
    const map = new Map<string, Item[]>();
    for (const item of allItems) {
      if (!item.taskId) continue;
      if (!map.has(item.taskId)) map.set(item.taskId, []);
      map.get(item.taskId)!.push(item);
    }
    return map;
  }, [allItems]);

  const allCompleted = useMemo(() => {
    return allItems.length > 0 && allItems.every(i => i.isCompleted);
  }, [allItems]);

  /* ── 任务展开状态 ── */
  const [expandedTaskId, setExpandedTaskId] = useState<string | null>(null);

  /* ── 事项创建表单 ── */
  const [showItemSheet, setShowItemSheet] = useState(false);
  const [itemTitle, setItemTitle] = useState("");
  const [itemStart, setItemStart] = useState("09:00");
  const [itemEnd, setItemEnd] = useState("09:30");
  const [itemNote, setItemNote] = useState("");
  const [itemRepeat, setItemRepeat] = useState<"none" | "daily" | "weekdays" | "weekly">("none");
  const [itemDateFrom, setItemDateFrom] = useState(todayStr());
  const [itemDateTo, setItemDateTo] = useState(todayStr());
  const [itemTimeSlots, setItemTimeSlots] = useState<string[]>(["morning"]);
  const [itemTaskId, setItemTaskId] = useState<string | null>(null);
  const [itemSubmitting, setItemSubmitting] = useState(false);

  const openItemSheet = useCallback((taskId?: string) => {
    setItemTaskId(taskId || null);
    const td = todayStr();
    setItemDateFrom(td);
    setItemDateTo(td);
    setItemStart("09:00");
    setItemEnd("09:30");
    setItemTitle("");
    setItemNote("");
    setItemRepeat("none");
    setItemTimeSlots(["morning"]);
    setShowItemSheet(true);
  }, []);

  const handleCreateItem = useCallback(async () => {
    if (!itemTitle.trim()) { showToast({ type: "warning", message: "标题还没填" }); return; }
    setItemSubmitting(true);
    try {
      const repeatGroupId = crypto.randomUUID();
      const dates: string[] = [];
      let cursor = itemDateFrom;
      while (cursor <= itemDateTo) {
        dates.push(cursor);
        cursor = addDays(cursor, 1);
        if (dates.length > 365) break;
      }

      for (const date of dates) {
        for (const slotKey of itemTimeSlots) {
          const slot = TIME_SLOTS_MULTI.find(s => s.key === slotKey);
          const startTime = slot?.time || itemStart;
          await addItem({
            date,
            plannedStart: startTime,
            plannedEnd: itemEnd || endTimeFrom(startTime),
            actualStart: startTime,
            actualEnd: itemEnd || endTimeFrom(startTime),
            isCorrected: false,
            sourceType: "manual",
            sourceId: crypto.randomUUID(),
            title: itemTitle.trim(),
            color: goalColor,
            icon: "CheckSquare",
            note: itemNote || undefined,
            projectId: goal?.projectId || undefined,
            goalId,
            taskId: itemTaskId || undefined,
            isCompleted: false,
            repeat: itemRepeat === "none" ? undefined : itemRepeat,
            repeatGroupId,
            sortOrder: timeToSort(startTime),
          });
        }
      }
      showToast({ type: "success", message: `已添加 ${dates.length * itemTimeSlots.length} 条` });
      setShowItemSheet(false);
    } catch {
      showToast({ type: "error", message: "没有添加成功，再试一次？" });
    } finally {
      setItemSubmitting(false);
    }
  }, [itemTitle, itemStart, itemEnd, itemNote, itemRepeat, itemDateFrom, itemDateTo, itemTimeSlots, itemTaskId, goalColor, goal, goalId]);

  /* ── 事项 toggle ── */
  const handleToggleItem = useCallback(async (itemId: string) => {
    const item = await daylogDB.items.get(itemId);
    if (item) {
      await daylogDB.items.update(itemId, { isCompleted: !item.isCompleted });
    }
  }, []);

  /* ── 任务操作 ── */
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

  /* ── 任务编辑 ── */
  const [editingTask, setEditingTask] = useState<ScheduleTask | null>(null);
  const [editTitle, setEditTitle] = useState("");
  const [editNote, setEditNote] = useState("");
  const [editReminderStr, setEditReminderStr] = useState("");

  const openEdit = useCallback((task: ScheduleTask) => {
    setEditingTask(task);
    setEditTitle(task.title);
    setEditNote(task.note || "");
    setEditReminderStr((task.reminderTimes || []).join(", "));
  }, []);

  const handleSaveEdit = useCallback(async () => {
    if (!editingTask) return;
    const reminders = editReminderStr.split(",").map(s => s.trim()).filter(Boolean);
    await useEfficiencyStore.getState().updateScheduleTask(editingTask.id, {
      title: editTitle,
      note: editNote,
      reminderTimes: reminders.length > 0 ? reminders : undefined,
    });
    showToast({ type: "success", message: "任务已更新" });
    setEditingTask(null);
  }, [editingTask, editTitle, editNote, editReminderStr]);

  /* ── 批量导入 ── */
  const [showBulkImport, setShowBulkImport] = useState(false);
  const [bulkText, setBulkText] = useState("");
  const [bulkLoading, setBulkLoading] = useState(false);

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

  /* ── 完成目标 ── */
  const handleCompleteGoal = useCallback(async () => {
    if (!goal || !allCompleted) return;
    await updateGoalStatus(goalId, "completed");
    showToast({ type: "success", message: "目标已完成" });
    router.push("/efficiency");
  }, [goal, goalId, allCompleted, updateGoalStatus, router]);

  // ── 任务创建 ──
  const [showTaskSheet, setShowTaskSheet] = useState(false);
  const handleTaskSubmit = useCallback(async (task: Omit<ScheduleTask, "id" | "createdAt">) => {
    await addScheduleTask({ ...task, goalId } as any);
    showToast({ type: "success", message: "任务已添加" });
    setShowTaskSheet(false);
  }, [goalId]);

  useEffect(() => { loadGoals(); }, [loadGoals]);

  /* ── 渲染：目标不存在 ── */
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
              {allItems.length > 0
                ? `${allItems.filter(i => i.isCompleted).length}/${allItems.length} 事项`
                : "暂无事项"}
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

        {allItems.length > 0 && !allCompleted && (
          <p className="mt-2 text-[13px]" style={{ color: "var(--color-text-secondary)" }}>
            还剩 {allItems.length - allItems.filter(i => i.isCompleted).length} 项未完成
          </p>
        )}
        {allCompleted && allItems.length > 0 && (
          <p className="mt-2 text-[13px]" style={{ color: GREEN }}>所有事项已完成</p>
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

      {/* ===== 事项列表（直接事项，无 taskId） ===== */}
      {directGroups.length > 0 && (
        <div className="mx-4 mt-5">
          <h2 className="text-[13px] font-semibold mb-2 px-1" style={{ color: "var(--color-text-disabled)" }}>
            事项列表
          </h2>
          <div className="flex flex-col gap-2">
            {directGroups.map((group) => (
              <ItemGroupCard
                key={group.key}
                group={group}
                color={goalColor}
                onToggle={handleToggleItem}
              />
            ))}
          </div>
        </div>
      )}

      {/* ===== 任务列表 ===== */}
      {tasks.length > 0 && (
        <div className="mx-4 mt-5">
          <h2 className="text-[13px] font-semibold mb-2 px-1" style={{ color: "var(--color-text-disabled)" }}>
            任务列表
          </h2>
          <div className="flex flex-col gap-2">
            {tasks.map((task) => {
              const taskItems = taskItemsMap.get(task.id) || [];
              const itemGroups = groupItems(taskItems);
              const isExpanded = expandedTaskId === task.id;
              const itemDone = taskItems.filter(i => i.isCompleted).length;

              return (
                <div key={task.id}>
                  <TaskCard
                    task={task}
                    itemCount={taskItems.length}
                    itemDone={itemDone}
                    isExpanded={isExpanded}
                    onToggle={() => handleToggleTask(task.id)}
                    onDelete={() => handleDeleteTask(task.id)}
                    onEdit={() => openEdit(task)}
                    onExpand={() => setExpandedTaskId(isExpanded ? null : task.id)}
                    onCreateItem={() => openItemSheet(task.id)}
                    color={goalColor}
                  />

                  {/* 任务展开：关联事项 */}
                  <AnimatePresence>
                    {isExpanded && (
                      <motion.div
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: "auto", opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        transition={{ duration: 0.2 }}
                        className="overflow-hidden"
                      >
                        <div className="ml-3 mt-1 pl-3 border-l-2"
                          style={{ borderColor: goalColor }}
                        >
                          {itemGroups.length > 0 ? (
                            <div className="flex flex-col gap-1.5 py-1">
                              {itemGroups.map((group) => (
                                <ItemGroupCard
                                  key={group.key}
                                  group={group}
                                  color={goalColor}
                                  onToggle={handleToggleItem}
                                  compact
                                />
                              ))}
                            </div>
                          ) : (
                            <p className="text-[13px] py-2 px-2" style={{ color: "var(--color-text-disabled)" }}>
                              暂无事项
                            </p>
                          )}
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* 空态 */}
      {tasks.length === 0 && directGroups.length === 0 && (
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
              <Zap className="w-4 h-4" />添加事项
            </button>
            <button
              onClick={() => setShowTaskSheet(true)}
              className="flex-1 h-11 rounded-xl text-[15px] font-medium flex items-center justify-center gap-1.5"
              style={{ border: "1px solid var(--lifeflow-border)", color: "var(--color-text-secondary)" }}
            >
              <Plus className="w-4 h-4" />添加任务
            </button>
          </div>
        </div>
      )}

      {/* ===== 底部"完成目标" ===== */}
      {(tasks.length > 0 || allItems.length > 0) && (
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

      {/* ===== 事项创建 BottomSheet（新设计） ===== */}
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
              className="fixed left-0 right-0 bottom-0 z-[60] rounded-t-[24px] max-w-[430px] mx-auto px-4 pt-4 overflow-y-auto"
              style={{ background: "var(--color-surface-card)", paddingBottom: "calc(24px + env(safe-area-inset-bottom))", maxHeight: "90vh" }}
              onClick={(e) => e.stopPropagation()}
            >
              <div className="w-8 h-1 rounded-full mx-auto mb-4" style={{ background: "var(--lifeflow-border)" }} />
              <h3 className="text-[17px] font-bold mb-4" style={{ color: "var(--color-text-primary)" }}>
                添加事项 {itemTaskId ? `· ${tasks.find(t => t.id === itemTaskId)?.title || ""}` : ""}
              </h3>

              {/* Title */}
              <label className="text-[13px] mb-1 block" style={{ color: "var(--color-text-secondary)" }}>标题</label>
              <input
                value={itemTitle}
                onChange={(e) => setItemTitle(e.target.value)}
                className="w-full h-11 rounded-xl px-3 text-[15px] outline-none mb-3"
                style={{ background: "var(--lifeflow-background)", border: "1px solid var(--lifeflow-border)", color: "var(--color-text-primary)" }}
                placeholder="事项名称"
                autoFocus
              />

              {/* Date Range */}
              <label className="text-[13px] mb-1 block" style={{ color: "var(--color-text-secondary)" }}>日期范围</label>
              <div className="flex gap-3 mb-3">
                <input
                  type="date" value={itemDateFrom} onChange={(e) => setItemDateFrom(e.target.value)}
                  className="flex-1 h-11 rounded-xl px-3 text-[15px] outline-none"
                  style={{ background: "var(--lifeflow-background)", border: "1px solid var(--lifeflow-border)", color: "var(--color-text-primary)" }}
                />
                <span className="flex items-center text-[13px]" style={{ color: "var(--color-text-disabled)" }}>至</span>
                <input
                  type="date" value={itemDateTo} onChange={(e) => setItemDateTo(e.target.value)}
                  className="flex-1 h-11 rounded-xl px-3 text-[15px] outline-none"
                  style={{ background: "var(--lifeflow-background)", border: "1px solid var(--lifeflow-border)", color: "var(--color-text-primary)" }}
                />
              </div>

              {/* Time Slots */}
              <label className="text-[13px] mb-1 block" style={{ color: "var(--color-text-secondary)" }}>时段（可多选）</label>
              <div className="flex flex-wrap gap-2 mb-3">
                {TIME_SLOTS_MULTI.map((slot) => {
                  const active = itemTimeSlots.includes(slot.key);
                  return (
                    <button
                      key={slot.key}
                      onClick={() => {
                        setItemTimeSlots(prev =>
                          prev.includes(slot.key)
                            ? prev.filter(k => k !== slot.key)
                            : [...prev, slot.key]
                        );
                      }}
                      className="h-9 px-3 rounded-full text-[13px] font-medium transition-all"
                      style={{
                        background: active ? goalColor : "var(--lifeflow-background)",
                        color: active ? "#fff" : "var(--color-text-secondary)",
                        border: active ? "none" : "1px solid var(--lifeflow-border)",
                      }}
                    >
                      {slot.label} {slot.time}
                    </button>
                  );
                })}
              </div>

              {/* Time overrides */}
              <label className="text-[13px] mb-1 block" style={{ color: "var(--color-text-secondary)" }}>开始 / 结束时间</label>
              <div className="flex gap-3 mb-3">
                <input
                  type="time" value={itemStart} onChange={(e) => setItemStart(e.target.value)}
                  className="flex-1 h-11 rounded-xl px-3 text-[15px] outline-none"
                  style={{ background: "var(--lifeflow-background)", border: "1px solid var(--lifeflow-border)", color: "var(--color-text-primary)" }}
                />
                <input
                  type="time" value={itemEnd} onChange={(e) => setItemEnd(e.target.value)}
                  className="flex-1 h-11 rounded-xl px-3 text-[15px] outline-none"
                  style={{ background: "var(--lifeflow-background)", border: "1px solid var(--lifeflow-border)", color: "var(--color-text-primary)" }}
                />
              </div>

              {/* Repeat */}
              <label className="text-[13px] mb-1 block" style={{ color: "var(--color-text-secondary)" }}>重复</label>
              <div className="flex gap-2 mb-3">
                {REPEAT_OPTIONS.map((opt) => {
                  const active = itemRepeat === opt.value;
                  return (
                    <button
                      key={opt.value}
                      onClick={() => setItemRepeat(opt.value)}
                      className="flex-1 h-9 rounded-full text-[13px] font-medium transition-all"
                      style={{
                        background: active ? goalColor : "var(--lifeflow-background)",
                        color: active ? "#fff" : "var(--color-text-secondary)",
                        border: active ? "none" : "1px solid var(--lifeflow-border)",
                      }}
                    >
                      {opt.label}
                    </button>
                  );
                })}
              </div>

              {/* Note */}
              <label className="text-[13px] mb-1 block" style={{ color: "var(--color-text-secondary)" }}>备注（可选）</label>
              <input
                value={itemNote} onChange={(e) => setItemNote(e.target.value)}
                className="w-full h-11 rounded-xl px-3 text-[15px] outline-none mb-4"
                style={{ background: "var(--lifeflow-background)", border: "1px solid var(--lifeflow-border)", color: "var(--color-text-primary)" }}
                placeholder="备注"
              />

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

      {/* ===== 任务创建 BottomSheet ===== */}
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
// 任务卡片
// ============================================================
function TaskCard({ task, itemCount, itemDone, isExpanded, onToggle, onDelete, onEdit, onExpand, onCreateItem, color }: {
  task: ScheduleTask;
  itemCount: number;
  itemDone: number;
  isExpanded: boolean;
  onToggle: () => void;
  onDelete: () => void;
  onEdit: () => void;
  onExpand: () => void;
  onCreateItem: () => void;
  color: string;
}) {
  const progressPct = task.progressType === "progress" && task.targetValue
    ? Math.min(100, Math.max(0, Math.round((itemDone / task.targetValue) * 100)))
    : 0;

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
      className="rounded-[20px] overflow-hidden"
      style={{ background: "var(--color-surface-card)", boxShadow: "var(--shadow-card)" }}
    >
      <div className="flex items-center gap-3 px-4 py-3 min-h-[52px]">
        {/* Check */}
        <button
          type="button" onClick={(e) => { e.stopPropagation(); onToggle(); }}
          className="w-6 h-6 rounded-full flex-shrink-0 flex items-center justify-center"
          style={{
            border: task.isCompleted ? "none" : "2px solid var(--color-text-disabled)",
            background: task.isCompleted ? ACCENT : "transparent",
          }}
        >
          {task.isCompleted && <Check className="w-[14px] h-[14px] text-white" strokeWidth={3} />}
        </button>

        {/* Content */}
        <div className="flex-1 min-w-0" onClick={onExpand}>
          <div className="flex items-center gap-1.5">
            <p className="text-[17px] truncate" style={{
              color: task.isCompleted ? "var(--color-text-disabled)" : "var(--color-text-primary)",
              textDecoration: task.isCompleted ? "line-through" : "none",
            }}>{task.title}</p>
            {task.isImportant && !task.isCompleted && (
              <span className="w-[6px] h-[6px] rounded-full flex-shrink-0" style={{ background: ACCENT }} />
            )}
          </div>
          <div className="flex items-center gap-2 mt-0.5">
            {task.progressType === "progress" && task.targetValue && (
              <span className="text-[13px]" style={{ color: "var(--color-text-secondary)" }}>
                {itemDone}/{task.targetValue}{task.targetUnit || ""} ({progressPct}%)
              </span>
            )}
            {itemCount > 0 && (
              <span className="text-[13px]" style={{ color: "var(--color-text-disabled)" }}>
                {itemDone}/{itemCount} 事项
              </span>
            )}
          </div>
        </div>

        {/* Actions */}
        <div className="flex items-center gap-0.5">
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
          <button
            type="button" onClick={(e) => { e.stopPropagation(); onExpand(); }}
            className="w-7 h-7 rounded-lg flex items-center justify-center"
            style={{ background: "var(--lifeflow-muted)" }}
          >
            <ChevronDown className="w-4 h-4 transition-transform"
              style={{ color: "var(--color-text-secondary)", transform: isExpanded ? "rotate(180deg)" : "rotate(0deg)" }} />
          </button>
        </div>
      </div>

      {/* Progress bar for progress tasks */}
      {task.progressType === "progress" && task.targetValue && (
        <div className="px-4 pb-3">
          <div className="h-1.5 rounded-full overflow-hidden" style={{ background: "var(--lifeflow-muted)" }}>
            <motion.div
              className="h-full rounded-full"
              style={{ backgroundColor: color }}
              initial={{ width: 0 }}
              animate={{ width: `${progressPct}%` }}
              transition={{ duration: 0.6, ease: "easeOut" }}
            />
          </div>
        </div>
      )}
    </motion.div>
  );
}

// ============================================================
// 事项分组卡片（同名折叠）
// ============================================================
function ItemGroupCard({ group, color, onToggle, compact }: {
  group: ItemGroup;
  color: string;
  onToggle: (id: string) => void;
  compact?: boolean;
}) {
  const [expanded, setExpanded] = useState(false);
  const allDone = group.completedCount === group.totalCount;

  return (
    <div className="rounded-[20px] overflow-hidden" style={{ background: "var(--color-surface-card)", boxShadow: "var(--shadow-card)" }}>
      {/* Group header */}
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full flex items-center gap-3 px-4 py-3 text-left"
      >
        <div className="w-6 h-6 rounded-full flex-shrink-0 flex items-center justify-center"
          style={{
            border: allDone ? "none" : "2px solid var(--color-text-disabled)",
            background: allDone ? color : "transparent",
          }}
        >
          {allDone && <Check className="w-[14px] h-[14px] text-white" strokeWidth={3} />}
        </div>
        <span className="flex-1 text-[15px] font-medium truncate" style={{
          color: allDone ? "var(--color-text-disabled)" : "var(--color-text-primary)",
          textDecoration: allDone ? "line-through" : "none",
        }}>{group.title}</span>
        <span className="text-[13px] px-2 py-0.5 rounded-full"
          style={{ background: "var(--lifeflow-muted)", color: "var(--color-text-secondary)" }}>
          {group.completedCount}/{group.totalCount}
        </span>
        <ChevronDown className="w-4 h-4 transition-transform"
          style={{ color: "var(--color-text-disabled)", transform: expanded ? "rotate(180deg)" : "rotate(0deg)" }} />
      </button>

      {/* Expanded items */}
      <AnimatePresence>
        {expanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="overflow-hidden"
          >
            <div className="px-4 pb-3">
              <div style={{ borderTop: "0.5px solid var(--lifeflow-border)" }} className="pt-2">
                {group.items.map((item, i) => (
                  <div key={item.id} className="flex items-center gap-3 py-1.5">
                    <button
                      onClick={() => onToggle(item.id)}
                      className="w-5 h-5 rounded-full flex-shrink-0 flex items-center justify-center"
                      style={{
                        border: item.isCompleted ? "none" : "1.5px solid var(--color-text-disabled)",
                        background: item.isCompleted ? color : "transparent",
                      }}
                    >
                      {item.isCompleted && <Check className="w-[11px] h-[11px] text-white" strokeWidth={3} />}
                    </button>
                    <div className="flex-1 min-w-0 flex items-center gap-2">
                      <span className="text-[12px] tabular-nums" style={{ color: "var(--color-text-disabled)" }}>
                        {item.date.slice(5)}
                      </span>
                      <span className="text-[12px]" style={{ color: "var(--color-text-disabled)" }}>
                        {item.plannedStart}-{item.plannedEnd}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
