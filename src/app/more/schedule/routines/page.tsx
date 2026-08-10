"use client";

import { useState, useCallback, useMemo } from "react";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { ChevronLeft, Plus, Trash2, Clock, Pencil, Check, X, Sunrise, BedDouble, RefreshCw } from "lucide-react";
import { useLiveQuery } from "dexie-react-hooks";
import {
  getRoutines,
  addRoutine,
  updateRoutine,
  deleteRoutine,
  getRoutineGroups,
  addRoutineGroup,
  deleteRoutineGroup,
  getRoutinesForGroup,
  updateRoutineGroup,
  deleteRoutineItemsForGroup,
  deleteRoutineItemsForGroupDays,
  generateRoutineItems,
} from "@/lib/db/daylog.db";
import type { RoutineTemplate, RoutineTemplateGroup } from "@/lib/db/daylog.db";
import { showToast } from "@/components/ui/Toast";
import { syncRoutineToSchedule } from "@/lib/routineSync";

const WEEKDAY_LABELS = ["日", "一", "二", "三", "四", "五", "六"]; // 0=周日
const WEEK_DAYS = [1, 2, 3, 4, 5, 6, 0]; // 周视图列顺序：周一~周日

const COLORS = ["#5856D6", "#007AFF", "#34C759", "#FF9500", "#FF3B30", "#AF52DE", "#5AC8FA", "#FF2D55"];

export default function RoutinesPage() {
  const router = useRouter();

  const groups = useLiveQuery(() => getRoutineGroups(), [], [] as RoutineTemplateGroup[]);
  const allRoutines = useLiveQuery(() => getRoutines(), [], [] as RoutineTemplate[]);

  // Template list state
  const [expandedGroupId, setExpandedGroupId] = useState<string | null>(null);
  const [editingGroupName, setEditingGroupName] = useState<string | null>(null);
  const [editGroupNameValue, setEditGroupNameValue] = useState("");

  // Create template dialog
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [newTemplateName, setNewTemplateName] = useState("");

  // Inline child editing
  const [editingChildId, setEditingChildId] = useState<string | null>(null);
  const [addingChild, setAddingChild] = useState(false);
  const [childFormName, setChildFormName] = useState("");
  const [childFormStartTime, setChildFormStartTime] = useState("07:00");
  const [childFormEndTime, setChildFormEndTime] = useState("07:30");
  const [childFormColor, setChildFormColor] = useState(COLORS[0]);
  // T15：课堂节奏（45+5）类型
  const [childFormType, setChildFormType] = useState<RoutineTemplate["type"]>("custom");

  // Delete group confirm
  const [deletingGroupId, setDeletingGroupId] = useState<string | null>(null);

  // ─── Helpers ───────────────────────────────────────────────────

  const getActiveCount = useCallback(
    (groupId: string): number => {
      return allRoutines.filter((r) => r.templateId === groupId && r.isActive).length;
    },
    [allRoutines],
  );

  const getTotalCount = useCallback(
    (groupId: string): number => {
      return allRoutines.filter((r) => r.templateId === groupId).length;
    },
    [allRoutines],
  );

  const getRoutinesForGroupMemo = useCallback(
    (groupId: string): RoutineTemplate[] => {
      return allRoutines.filter((r) => r.templateId === groupId).sort((a, b) => a.sortOrder - b.sortOrder);
    },
    [allRoutines],
  );

  const resetChildForm = useCallback(() => {
    setChildFormName("");
    setChildFormStartTime("07:00");
    setChildFormEndTime("07:30");
    setChildFormColor(COLORS[0]);
    setChildFormType("custom");
    setEditingChildId(null);
    setAddingChild(false);
  }, []);

  const populateChildForm = useCallback((r: RoutineTemplate) => {
    setChildFormName(r.name);
    setChildFormStartTime(r.startTime);
    setChildFormEndTime(r.endTime);
    setChildFormColor(r.color);
    setChildFormType(r.type || "custom");
  }, []);

  // ─── Helper: format daysOfWeek display ────────────────────

  const formatDaysOfWeek = useCallback((days: number[]): string => {
    if (days.length === 0) return "未设置日期";
    if (days.length === 7) return "每天";
    const sorted = [...days].sort((a, b) => {
      // 把周日(0)排到最后
      if (a === 0) return 1;
      if (b === 0) return -1;
      return a - b;
    });
    return sorted.map(d => WEEKDAY_LABELS[d]).join("、");
  }, []);

  /** 格式化 Unix 时间戳为 YYYY-MM-DD */
  const formatCreateDate = useCallback((ts: number): string => {
    const d = new Date(ts);
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  }, []);

  // ─── Weekly view derived data (只读，不改写 DB) ────────────

  const enabledGroups = useMemo(() => groups.filter((g) => g.enabled), [groups]);

  const activeRoutines = useMemo(
    () => allRoutines.filter((r) => r.isActive && enabledGroups.some((g) => g.id === r.templateId)),
    [allRoutines, enabledGroups],
  );

  /** 起床时间：优先 type='wake'，否则最早开始时间 */
  const wakeRoutine = useMemo(
    () =>
      activeRoutines.find((r) => r.type === "wake") ??
      [...activeRoutines].sort((a, b) => a.startTime.localeCompare(b.startTime))[0],
    [activeRoutines],
  );

  /** 就寝时间：优先 type='sleep'，否则最晚结束时间 */
  const sleepRoutine = useMemo(
    () =>
      activeRoutines.find((r) => r.type === "sleep") ??
      [...activeRoutines].sort((a, b) => b.endTime.localeCompare(a.endTime))[0],
    [activeRoutines],
  );

  const groupColor = useCallback(
    (g: RoutineTemplateGroup): string => {
      const first = getRoutinesForGroupMemo(g.id)[0];
      if (first?.color) return first.color;
      const idx = groups.findIndex((x) => x.id === g.id);
      return COLORS[(idx >= 0 ? idx : 0) % COLORS.length];
    },
    [getRoutinesForGroupMemo, groups],
  );

  const todayIdx = new Date().getDay();

  // ─── Group-level Actions ──────────────────────────────────

  const handleToggleGroup = useCallback(async (group: RoutineTemplateGroup) => {
    const newEnabled = !group.enabled;
    await updateRoutineGroup(group.id, { enabled: newEnabled });

    if (!newEnabled) {
      // 关闭：删除今天及未来的事项 + 同步删除 ScheduleTask
      await deleteRoutineItemsForGroup(group.id);
      // 同步删除效率模块的 ScheduleTask
      const groupRoutines = allRoutines.filter(r => r.templateId === group.id);
      for (const r of groupRoutines) {
        await syncRoutineToSchedule({ ...r, isActive: false });
      }
      showToast({ type: "success", message: "模板已停用" });
    } else {
      // 开启：为未来 7 天生成事项 + 同步 ScheduleTask
      const today = new Date();
      for (let i = 0; i < 7; i++) {
        const d = new Date(today);
        d.setDate(d.getDate() + i);
        const dateStr = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
        await generateRoutineItems(dateStr);
      }
      // 同步 ScheduleTask
      const groupRoutines = allRoutines.filter(r => r.templateId === group.id && r.isActive);
      for (const r of groupRoutines) {
        await syncRoutineToSchedule(r);
      }
      showToast({ type: "success", message: "模板已启用" });
    }
  }, [allRoutines]);

  const handleToggleWeekday = useCallback(async (group: RoutineTemplateGroup, day: number) => {
    const current = group.daysOfWeek ?? [];
    const hasDay = current.includes(day);
    let newDays: number[];

    if (hasDay) {
      // 去掉该日
      newDays = current.filter(d => d !== day);
      // 清理今天及未来该星期几的事项
      if (newDays.length > 0) {
        await deleteRoutineItemsForGroupDays(group.id, [day]);
      }
    } else {
      newDays = [...current, day];
    }

    await updateRoutineGroup(group.id, { daysOfWeek: newDays });

    // 如果是新增的日期，生成当天及未来 7 天的事项
    if (!hasDay) {
      const today = new Date();
      for (let i = 0; i < 7; i++) {
        const d = new Date(today);
        d.setDate(d.getDate() + i);
        if (d.getDay() === day) {
          const dateStr = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
          await generateRoutineItems(dateStr);
        }
      }
    }

    showToast({ type: "success", message: hasDay ? "日期已移除" : "日期已添加" });
  }, []);

  // ─── Template Group Actions ────────────────────────────────────

  const handleCreateGroup = useCallback(async () => {
    if (!newTemplateName.trim()) {
      showToast({ type: "warning", message: "请输入模板名称" });
      return;
    }
    const id = await addRoutineGroup(newTemplateName.trim());
    showToast({ type: "success", message: "模板已创建" });
    setNewTemplateName("");
    setShowCreateDialog(false);
    setExpandedGroupId(id);
  }, [newTemplateName]);

  const handleDeleteGroup = useCallback(async (groupId: string) => {
    await deleteRoutineGroup(groupId);
    showToast({ type: "success", message: "模板已删除" });
    setDeletingGroupId(null);
    setExpandedGroupId(null);
  }, []);

  // ─── Child Routine Actions ─────────────────────────────────────

  const handleSaveChild = useCallback(async () => {
    if (!childFormName.trim()) {
      showToast({ type: "warning", message: "请输入作息名称" });
      return;
    }
    const groupId = expandedGroupId!;
    if (editingChildId) {
      const existing = allRoutines.find((r) => r.id === editingChildId);
      const updated = {
        ...existing!,
        name: childFormName.trim(),
        startTime: childFormStartTime,
        endTime: childFormEndTime,
        color: childFormColor,
        type: childFormType,
      };
      await updateRoutine(editingChildId, {
        name: childFormName.trim(),
        startTime: childFormStartTime,
        endTime: childFormEndTime,
        color: childFormColor,
        type: childFormType,
      });
      showToast({ type: "success", message: "作息已更新" });
      syncRoutineToSchedule(updated);
    } else {
      const data = {
        type: childFormType,
        templateId: groupId,
        name: childFormName.trim(),
        startTime: childFormStartTime,
        endTime: childFormEndTime,
        color: childFormColor,
        icon: childFormType === "focus" ? "Zap" : "Moon",
        isActive: true,
        sortOrder: allRoutines.filter((r) => r.templateId === groupId).length,
      };
      const id = await addRoutine(data);
      showToast({ type: "success", message: "作息已添加" });
      syncRoutineToSchedule({ ...data, id, createdAt: Date.now() });
    }
    resetChildForm();
  }, [
    childFormName,
    childFormStartTime,
    childFormEndTime,
    childFormColor,
    childFormType,
    editingChildId,
    expandedGroupId,
    allRoutines,
    resetChildForm,
  ]);

  const handleDeleteChild = useCallback(
    async (id: string) => {
      const routine = allRoutines.find(r => r.id === id);
      await deleteRoutine(id);
      // 删除该作息在未来 7 天已生成的日程事项
      if (routine) {
        try {
          const { daylogDB } = await import("@/lib/db/daylog.db");
          const today = new Date();
          for (let i = 0; i < 7; i++) {
            const d = new Date(today);
            d.setDate(d.getDate() + i);
            const dateStr = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
            await daylogDB.items
              .where("date").equals(dateStr)
              .filter((item: any) => item.sourceType === "routine" && (item.sourceId === id || item.sourceId.startsWith(id + "#")))
              .delete();
          }
        } catch { /* ignore */ }
      }
      showToast({ type: "success", message: "作息已删除" });
      if (editingChildId === id) resetChildForm();
    },
    [editingChildId, resetChildForm, allRoutines],
  );

  const handleToggleChild = useCallback(async (r: RoutineTemplate) => {
    const updated = { ...r, isActive: !r.isActive };
    await updateRoutine(r.id, { isActive: !r.isActive });
    showToast({ type: "success", message: r.isActive ? "已停用" : "已启用" });
    syncRoutineToSchedule(updated);
  }, []);

  const handleEditChild = useCallback(
    (r: RoutineTemplate) => {
      setEditingChildId(r.id);
      populateChildForm(r);
      setAddingChild(false);
    },
    [populateChildForm],
  );

  // ─── Compute ────────────────────────────────────────────────────

  const selectedGroup = groups.find((g) => g.id === expandedGroupId);
  const childRoutines = expandedGroupId ? getRoutinesForGroupMemo(expandedGroupId) : [];
  const showChildForm = addingChild || editingChildId !== null;

  return (
    <div className="pb-[100px]">
      {/* Header */}
      <div className="flex items-center justify-between px-4 pt-[var(--safe-area-top)] pb-2">
        <button
          type="button"
          onClick={() => {
            if (expandedGroupId) {
              setExpandedGroupId(null);
            } else {
              router.push("/more");
            }
          }}
          className="inline-flex h-10 w-10 items-center justify-center rounded-full"
          style={{
            background: "var(--color-surface-card)",
            boxShadow: "var(--shadow-card)",
          }}
        >
          <ChevronLeft className="w-5 h-5" style={{ color: "var(--color-text-primary)" }} />
        </button>
        <h1 className="text-title-nav" style={{ color: "var(--color-text-primary)" }}>
          作息表
        </h1>
        {!expandedGroupId ? (
          <button
            type="button"
            onClick={() => setShowCreateDialog(true)}
            className="inline-flex h-10 w-10 items-center justify-center"
          >
            <Plus className="w-6 h-6" style={{ color: "var(--lifeflow-primary)" }} />
          </button>
        ) : (
          <div className="w-10" />
        )}
      </div>

      <div className="px-4 pt-5">
        {/* ============================================================ */}
        {/* Create Template Dialog */}
        {/* ============================================================ */}
        <AnimatePresence>
          {showCreateDialog && (
            <motion.div
              className="fixed inset-0 z-50 flex items-end justify-center"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
            >
              <div
                className="absolute inset-0 bg-black/40"
                onClick={() => {
                  setShowCreateDialog(false);
                  setNewTemplateName("");
                }}
              />
              <motion.div
                className="relative w-full rounded-t-[24px] p-6 pb-8"
                style={{
                  background: "var(--color-surface-card)",
                }}
                initial={{ y: "100%" }}
                animate={{ y: 0 }}
                exit={{ y: "100%" }}
                transition={{ type: "spring", damping: 30, stiffness: 300 }}
              >
                <h3
                  className="text-[17px] font-semibold mb-5"
                  style={{ color: "var(--color-text-primary)" }}
                >
                  新建模板
                </h3>
                <input
                  type="text"
                  value={newTemplateName}
                  onChange={(e) => setNewTemplateName(e.target.value)}
                  placeholder="模板名称（如：工作日、周末）"
                  autoFocus
                  className="w-full h-11 rounded-xl px-4 text-[16px] outline-none border mb-4"
                  style={{
                    borderColor: "var(--lifeflow-border)",
                    background: "var(--color-surface-secondary)",
                    color: "var(--color-text-primary)",
                  }}
                />
                <div className="flex gap-2">
                  <button
                    onClick={() => {
                      setShowCreateDialog(false);
                      setNewTemplateName("");
                    }}
                    className="flex-1 h-11 rounded-xl text-[15px]"
                    style={{
                      background: "var(--color-surface-secondary)",
                      color: "var(--color-text-secondary)",
                    }}
                  >
                    取消
                  </button>
                  <button
                    onClick={handleCreateGroup}
                    className="flex-1 h-11 rounded-xl text-[15px] font-semibold text-white"
                    style={{ background: "var(--lifeflow-primary)" }}
                  >
                    创建
                  </button>
                </div>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* ============================================================ */}
        {/* Template List View (no group expanded) */}
        {/* ============================================================ */}
        {!expandedGroupId && (
          <div className="flex flex-col gap-3">
            {/* 每周作息：周视图网格 + 起床/就寝时间卡 + 与日程联动提示 */}
            <div className="card-standard p-4">
              <div className="flex items-center justify-between mb-3">
                <h2 className="text-[16px] font-semibold" style={{ color: "var(--color-text-primary)" }}>
                  每周作息
                </h2>
                <span className="text-[12px]" style={{ color: "var(--color-text-secondary)" }}>
                  {enabledGroups.length} 个模板生效
                </span>
              </div>

              {/* 起床 / 就寝 时间卡 */}
              <div className="grid grid-cols-2 gap-2.5 mb-4">
                <div
                  className="flex items-center gap-3 rounded-[16px] px-3 py-3 min-w-0"
                  style={{ background: "var(--color-surface-secondary)" }}
                >
                  <span
                    className="w-9 h-9 shrink-0 rounded-[10px] inline-flex items-center justify-center"
                    style={{ background: "var(--lifeflow-brand-50)", color: "var(--lifeflow-primary)" }}
                  >
                    <Sunrise className="w-5 h-5" />
                  </span>
                  <div className="min-w-0">
                    <p className="text-[11px]" style={{ color: "var(--color-text-secondary)" }}>起床</p>
                    <p
                      className="text-[17px] font-semibold tabular-nums leading-tight truncate"
                      style={{ color: "var(--color-text-primary)" }}
                    >
                      {wakeRoutine?.startTime ?? "--:--"}
                    </p>
                  </div>
                </div>
                <div
                  className="flex items-center gap-3 rounded-[16px] px-3 py-3 min-w-0"
                  style={{ background: "var(--color-surface-secondary)" }}
                >
                  <span
                    className="w-9 h-9 shrink-0 rounded-[10px] inline-flex items-center justify-center"
                    style={{ background: "var(--lifeflow-brand-50)", color: "#5856D6" }}
                  >
                    <BedDouble className="w-5 h-5" />
                  </span>
                  <div className="min-w-0">
                    <p className="text-[11px]" style={{ color: "var(--color-text-secondary)" }}>就寝</p>
                    <p
                      className="text-[17px] font-semibold tabular-nums leading-tight truncate"
                      style={{ color: "var(--color-text-primary)" }}
                    >
                      {sleepRoutine?.endTime ?? "--:--"}
                    </p>
                  </div>
                </div>
              </div>

              {/* 周视图网格：周一~周日 + 作息色块 */}
              <div className="grid grid-cols-7 gap-1.5">
                {WEEK_DAYS.map((d) => {
                  const covering = enabledGroups.filter((g) => (g.daysOfWeek ?? []).includes(d));
                  const isToday = d === todayIdx;
                  return (
                    <div
                      key={d}
                      className="flex flex-col items-center gap-1.5 rounded-[12px] px-0.5 py-2 min-w-0"
                      style={{
                        background: isToday ? "var(--lifeflow-brand-50)" : "var(--color-surface-secondary)",
                      }}
                    >
                      <span
                        className="text-[11px] font-medium"
                        style={{ color: isToday ? "var(--lifeflow-primary)" : "var(--color-text-secondary)" }}
                      >
                        {d === 0 ? "日" : WEEKDAY_LABELS[d]}
                      </span>
                      <div className="flex flex-col items-center gap-1 w-full px-1">
                        {covering.slice(0, 3).map((g) => (
                          <span
                            key={g.id}
                            className="block w-full h-1.5 rounded-full"
                            style={{ background: groupColor(g) }}
                          />
                        ))}
                        {covering.length > 3 && (
                          <span className="text-[10px] leading-none" style={{ color: "var(--color-text-secondary)" }}>
                            +{covering.length - 3}
                          </span>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* 与日程联动提示 */}
              <div
                className="mt-3.5 flex items-center gap-2 rounded-[12px] px-3 py-2.5"
                style={{ background: "var(--lifeflow-brand-50)" }}
              >
                <RefreshCw className="w-3.5 h-3.5 shrink-0" style={{ color: "var(--lifeflow-primary)" }} />
                <p className="text-[12px] leading-snug" style={{ color: "var(--lifeflow-primary)" }}>
                  与日程联动：启用模板后自动生成未来 7 天作息事项并同步至日程
                </p>
              </div>
            </div>

            {/* 作息模板 chips */}
            <div className="mt-1">
              <div className="flex items-center justify-between px-1 mb-2.5">
                <h2 className="text-[16px] font-semibold" style={{ color: "var(--color-text-primary)" }}>
                  作息模板
                </h2>
                {groups.length > 0 && (
                  <span className="text-[12px]" style={{ color: "var(--color-text-secondary)" }}>
                    {groups.length} 个模板
                  </span>
                )}
              </div>
              {groups.length > 0 && (
                <div className="flex flex-wrap gap-2">
                  {groups.map((group) => {
                    const active = group.enabled;
                    return (
                      <button
                        key={group.id}
                        type="button"
                        onClick={() => setExpandedGroupId(group.id)}
                        className="inline-flex items-center gap-2 h-9 px-3.5 rounded-full text-[13px] font-medium transition-all active:scale-95"
                        style={{
                          background: active ? "var(--lifeflow-primary)" : "var(--color-surface-card)",
                          color: active ? "#FFFFFF" : "var(--color-text-secondary)",
                          border: active ? "1px solid transparent" : "1px solid var(--lifeflow-border)",
                          boxShadow: active ? "var(--shadow-card)" : "none",
                        }}
                      >
                        <span
                          className="w-2 h-2 rounded-full shrink-0"
                          style={{ background: active ? "rgba(255,255,255,0.9)" : groupColor(group) }}
                        />
                        <span className="truncate max-w-[140px]">{group.name}</span>
                      </button>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Empty state */}
            {groups.length === 0 && (
              <motion.div
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                className="flex flex-1 flex-col items-center justify-center px-4"
              >
                <div
                  className="w-full max-w-sm flex flex-col items-center px-8 py-12"
                  style={{
                    backgroundColor: "var(--color-surface-card)",
                    borderRadius: 20,
                    boxShadow: "var(--shadow-card)",
                  }}
                >
                  <div
                    className="w-16 h-16 rounded-[16px] flex items-center justify-center mb-5"
                    style={{ backgroundColor: "var(--lifeflow-brand-50)" }}
                  >
                    <Clock className="w-8 h-8" style={{ color: "var(--lifeflow-primary)" }} />
                  </div>
                  <p
                    className="text-[15px] mb-5"
                    style={{ color: "var(--color-text-secondary)" }}
                  >
                    还没有作息模板。新建一个，每天自动生成作息事项。
                  </p>
                  <button
                    onClick={() => setShowCreateDialog(true)}
                    className="inline-flex items-center justify-center rounded-full px-6 py-2.5 text-[14px] font-medium"
                    style={{
                      backgroundColor: "var(--lifeflow-primary)",
                      color: "var(--lifeflow-primary-foreground)",
                    }}
                  >
                    创建模板
                  </button>
                </div>
              </motion.div>
            )}

            {/* "新建模板" button at bottom */}
            {groups.length > 0 && (
              <button
                type="button"
                onClick={() => setShowCreateDialog(true)}
                className="w-full h-11 flex items-center justify-center gap-2 rounded-[20px] text-[15px] font-medium mt-1"
                style={{
                  background: "var(--lifeflow-brand-50)",
                  color: "var(--lifeflow-primary)",
                  border: "1px dashed var(--lifeflow-brand-200)",
                }}
              >
                <Plus className="w-4 h-4" />
                新建模板
              </button>
            )}
          </div>
        )}

        {/* ============================================================ */}
        {/* Template Detail View (group expanded) */}
        {/* ============================================================ */}
        {expandedGroupId && selectedGroup && (
          <>
            {/* Detail header */}
            <div className="flex items-center justify-between mb-4">
              {editingGroupName === expandedGroupId ? (
                <div className="flex items-center gap-2 flex-1">
                  <input
                    type="text"
                    value={editGroupNameValue}
                    onChange={(e) => setEditGroupNameValue(e.target.value)}
                    className="flex-1 h-9 rounded-lg px-3 text-[16px] font-semibold outline-none border"
                    style={{
                      borderColor: "var(--lifeflow-border)",
                      background: "var(--color-surface-secondary)",
                      color: "var(--color-text-primary)",
                    }}
                    autoFocus
                  />
                  <button
                    onClick={async () => {
                      if (editGroupNameValue.trim()) {
                        await updateRoutineGroup(expandedGroupId, { name: editGroupNameValue.trim() });
                        showToast({ type: "success", message: "名称已更新" });
                      }
                      setEditingGroupName(null);
                    }}
                    className="w-8 h-8 flex items-center justify-center rounded-full"
                    style={{ background: "var(--lifeflow-primary)" }}
                  >
                    <Check className="w-4 h-4 text-white" />
                  </button>
                  <button
                    onClick={() => setEditingGroupName(null)}
                    className="w-8 h-8 flex items-center justify-center rounded-full"
                    style={{ background: "var(--color-surface-secondary)" }}
                  >
                    <X className="w-4 h-4" style={{ color: "var(--color-text-secondary)" }} />
                  </button>
                </div>
              ) : (
                <>
                  <h2
                    className="text-[18px] font-semibold flex-1"
                    style={{ color: "var(--color-text-primary)" }}
                  >
                    {selectedGroup.name}
                  </h2>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => {
                        setEditingGroupName(expandedGroupId);
                        setEditGroupNameValue(selectedGroup.name);
                      }}
                      className="w-9 h-9 flex items-center justify-center rounded-full"
                      style={{ background: "var(--color-surface-card)" }}
                    >
                      <Pencil className="w-4 h-4" style={{ color: "var(--lifeflow-primary)" }} />
                    </button>
                    <button
                      type="button"
                      onClick={() => setDeletingGroupId(expandedGroupId)}
                      className="w-9 h-9 flex items-center justify-center rounded-full"
                      style={{ background: "var(--color-surface-card)" }}
                    >
                      <Trash2 className="w-4 h-4" style={{ color: "#FF3B30" }} />
                    </button>
                  </div>
                </>
              )}
            </div>

            {/* Create time + 生效日期 */}
            <p className="text-[12px] mb-3 px-1" style={{ color: "var(--color-text-disabled)" }}>
              创建于 {formatCreateDate(selectedGroup.createdAt)} · {formatDaysOfWeek(selectedGroup.daysOfWeek ?? [])}
            </p>

            {/* Weekday selector + group toggle */}
            <div
              className="card-standard p-4 mb-3"
              style={{ opacity: selectedGroup.enabled ? 1 : 0.55 }}
            >
              <div className="flex items-center justify-between mb-3">
                <div>
                  <span className="text-[14px] font-medium" style={{ color: "var(--color-text-primary)" }}>
                    模板开关
                  </span>
                  <p className="text-[11px] mt-0.5" style={{ color: "var(--color-text-secondary)" }}>
                    {getActiveCount(expandedGroupId)}/{getTotalCount(expandedGroupId)} 项启用
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => handleToggleGroup(selectedGroup)}
                  className="relative inline-flex h-7 w-12 items-center rounded-full transition-colors flex-shrink-0"
                  style={{
                    background: selectedGroup.enabled
                      ? "var(--state-success)"
                      : "var(--lifeflow-border)",
                  }}
                >
                  <span
                    className="inline-block h-5 w-5 rounded-full bg-white shadow-sm transition-transform"
                    style={{
                      transform: selectedGroup.enabled
                        ? "translateX(26px)"
                        : "translateX(2px)",
                    }}
                  />
                </button>
              </div>
              <div>
                <p className="text-[13px] mb-2" style={{ color: "var(--color-text-secondary)" }}>
                  生效日期
                </p>
                <div className="flex gap-2">
                  {WEEKDAY_LABELS.map((label, idx) => {
                    const selected = (selectedGroup.daysOfWeek ?? []).includes(idx);
                    return (
                      <button
                        key={idx}
                        type="button"
                        onClick={() => handleToggleWeekday(selectedGroup, idx)}
                        className="w-9 h-9 rounded-full text-[14px] font-medium transition-all active:scale-90"
                        style={{
                          background: selected
                            ? "var(--lifeflow-primary)"
                            : "var(--color-surface-secondary)",
                          color: selected ? "#FFFFFF" : "var(--color-text-secondary)",
                        }}
                      >
                        {label}
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>

            {/* Child routines list */}
            <div className="flex flex-col gap-2">
              <AnimatePresence>
                {childRoutines.map((r, i) =>
                  editingChildId === r.id && showChildForm ? (
                    <motion.div
                      key={`edit-${r.id}`}
                      initial={{ opacity: 0, height: 0 }}
                      animate={{ opacity: 1, height: "auto" }}
                      exit={{ opacity: 0, height: 0 }}
                      className="card-standard p-4 overflow-hidden"
                    >
                      <input
                        type="text"
                        value={childFormName}
                        onChange={(e) => setChildFormName(e.target.value)}
                        placeholder="作息名称"
                        autoFocus
                        className="w-full text-[16px] outline-none bg-transparent mb-3"
                        style={{ color: "var(--color-text-primary)" }}
                      />
                      {/* T15：类型选择（普通 / 课堂节奏 45+5） */}
                      <div className="mb-3">
                        <p className="text-[13px] mb-2" style={{ color: "var(--color-text-secondary)" }}>
                          类型
                        </p>
                        <div className="flex gap-2">
                          <button
                            type="button"
                            onClick={() => setChildFormType("custom")}
                            className="flex-1 h-9 rounded-lg text-[13px] font-medium transition-colors"
                            style={{
                              background: childFormType === "custom" ? "var(--lifeflow-brand-50)" : "var(--color-surface-secondary)",
                              color: childFormType === "custom" ? "var(--lifeflow-primary)" : "var(--color-text-secondary)",
                            }}
                          >
                            普通作息
                          </button>
                          <button
                            type="button"
                            onClick={() => setChildFormType("focus")}
                            className="flex-1 h-9 rounded-lg text-[13px] font-medium transition-colors"
                            style={{
                              background: childFormType === "focus" ? "var(--lifeflow-brand-50)" : "var(--color-surface-secondary)",
                              color: childFormType === "focus" ? "var(--lifeflow-primary)" : "var(--color-text-secondary)",
                            }}
                          >
                            课堂节奏 · 45+5
                          </button>
                        </div>
                        {childFormType === "focus" && (
                          <p className="text-[11px] mt-1.5" style={{ color: "var(--color-text-secondary)" }}>
                            该时间段将自动切分为 45 分钟上课 + 5 分钟休息（起身活动 · 顺便喝水），防久坐
                          </p>
                        )}
                      </div>
                      <div className="mb-3">
                        <p className="text-[13px] mb-2" style={{ color: "var(--color-text-secondary)" }}>
                          时间段
                        </p>
                        <div className="flex items-center gap-2">
                          <input
                            type="time"
                            value={childFormStartTime}
                            onChange={(e) => setChildFormStartTime(e.target.value)}
                            className="flex-1 h-10 rounded-lg px-3 text-[15px] outline-none border"
                            style={{
                              borderColor: "var(--lifeflow-border)",
                              background: "var(--color-surface-secondary)",
                            }}
                          />
                          <span className="text-[13px]" style={{ color: "var(--color-text-secondary)" }}>
                            至
                          </span>
                          <input
                            type="time"
                            value={childFormEndTime}
                            onChange={(e) => setChildFormEndTime(e.target.value)}
                            className="flex-1 h-10 rounded-lg px-3 text-[15px] outline-none border"
                            style={{
                              borderColor: "var(--lifeflow-border)",
                              background: "var(--color-surface-secondary)",
                            }}
                          />
                        </div>
                      </div>
                      <div className="mb-3">
                        <p className="text-[13px] mb-2" style={{ color: "var(--color-text-secondary)" }}>
                          颜色
                        </p>
                        <div className="flex gap-2.5 flex-wrap">
                          {COLORS.map((c) => (
                            <button
                              key={c}
                              type="button"
                              onClick={() => setChildFormColor(c)}
                              className="w-7 h-7 rounded-full transition-all"
                              style={{
                                background: c,
                                boxShadow:
                                  childFormColor === c ? `0 0 0 3px ${c}40` : "none",
                                transform:
                                  childFormColor === c ? "scale(1.15)" : "scale(1)",
                              }}
                            />
                          ))}
                        </div>
                      </div>
                      <div className="flex gap-2">
                        <button
                          onClick={resetChildForm}
                          className="flex-1 h-10 rounded-lg text-[15px]"
                          style={{
                            background: "var(--color-surface-secondary)",
                            color: "var(--color-text-secondary)",
                          }}
                        >
                          取消
                        </button>
                        <button
                          onClick={handleSaveChild}
                          className="flex-1 h-10 rounded-lg text-[15px] font-semibold text-white"
                          style={{ background: "var(--lifeflow-primary)" }}
                        >
                          保存
                        </button>
                      </div>
                    </motion.div>
                  ) : (
                    <motion.div
                      key={r.id}
                      initial={{ opacity: 0, y: 8 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: i * 0.03 }}
                      className="card-standard p-3"
                      onClick={() => handleEditChild(r)}
                      style={{ cursor: "pointer" }}
                    >
                      <div className="flex items-center gap-3">
                        <div
                          className="w-1 h-10 rounded-full flex-shrink-0"
                          style={{ background: r.color }}
                        />
                        <div className="flex-1 min-w-0">
                          <h3
                            className="text-[15px] font-semibold truncate"
                            style={{ color: "var(--color-text-primary)" }}
                          >
                            {r.name}
                          </h3>
                          <div className="flex items-center gap-1 mt-0.5">
                            <Clock
                              className="w-3.5 h-3.5"
                              style={{ color: "var(--color-text-secondary)" }}
                            />
                            <span
                              className="text-[13px]"
                              style={{ color: "var(--color-text-secondary)" }}
                            >
                              {r.startTime} - {r.endTime}
                            </span>
                          </div>
                        </div>
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleToggleChild(r);
                          }}
                          className="relative inline-flex h-7 w-12 items-center rounded-full transition-colors flex-shrink-0"
                          style={{
                            background: r.isActive
                              ? "var(--state-success)"
                              : "var(--lifeflow-border)",
                          }}
                        >
                          <span
                            className="inline-block h-5 w-5 rounded-full bg-white shadow-sm transition-transform"
                            style={{
                              transform: r.isActive
                                ? "translateX(26px)"
                                : "translateX(2px)",
                            }}
                          />
                        </button>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            handleDeleteChild(r.id);
                          }}
                          className="w-7 h-7 flex items-center justify-center flex-shrink-0"
                        >
                          <Trash2
                            className="w-4 h-4"
                            style={{ color: "var(--color-text-disabled)" }}
                          />
                        </button>
                      </div>
                    </motion.div>
                  ),
                )}
              </AnimatePresence>
            </div>

            {/* Add child form */}
            <AnimatePresence mode="wait">
              {addingChild && !editingChildId ? (
                <motion.div
                  key="add-form"
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: "auto" }}
                  exit={{ opacity: 0, height: 0 }}
                  className="card-standard p-4 mt-3 overflow-hidden"
                >
                  <input
                    type="text"
                    value={childFormName}
                    onChange={(e) => setChildFormName(e.target.value)}
                    placeholder="作息名称（如：晨练、冥想）"
                    autoFocus
                    className="w-full text-[16px] outline-none bg-transparent mb-3"
                    style={{ color: "var(--color-text-primary)" }}
                  />
                  {/* T15：类型选择（普通 / 课堂节奏 45+5） */}
                  <div className="mb-3">
                    <p className="text-[13px] mb-2" style={{ color: "var(--color-text-secondary)" }}>
                      类型
                    </p>
                    <div className="flex gap-2">
                      <button
                        type="button"
                        onClick={() => setChildFormType("custom")}
                        className="flex-1 h-9 rounded-lg text-[13px] font-medium transition-colors"
                        style={{
                          background: childFormType === "custom" ? "var(--lifeflow-brand-50)" : "var(--color-surface-secondary)",
                          color: childFormType === "custom" ? "var(--lifeflow-primary)" : "var(--color-text-secondary)",
                        }}
                      >
                        普通作息
                      </button>
                      <button
                        type="button"
                        onClick={() => setChildFormType("focus")}
                        className="flex-1 h-9 rounded-lg text-[13px] font-medium transition-colors"
                        style={{
                          background: childFormType === "focus" ? "var(--lifeflow-brand-50)" : "var(--color-surface-secondary)",
                          color: childFormType === "focus" ? "var(--lifeflow-primary)" : "var(--color-text-secondary)",
                        }}
                      >
                        课堂节奏 · 45+5
                      </button>
                    </div>
                    {childFormType === "focus" && (
                      <p className="text-[11px] mt-1.5" style={{ color: "var(--color-text-secondary)" }}>
                        该时间段将自动切分为 45 分钟上课 + 5 分钟休息（起身活动 · 顺便喝水），防久坐
                      </p>
                    )}
                  </div>
                  <div className="mb-3">
                    <p className="text-[13px] mb-2" style={{ color: "var(--color-text-secondary)" }}>
                      时间段
                    </p>
                    <div className="flex items-center gap-2">
                      <input
                        type="time"
                        value={childFormStartTime}
                        onChange={(e) => setChildFormStartTime(e.target.value)}
                        className="flex-1 h-10 rounded-lg px-3 text-[15px] outline-none border"
                        style={{
                          borderColor: "var(--lifeflow-border)",
                          background: "var(--color-surface-secondary)",
                        }}
                      />
                      <span className="text-[13px]" style={{ color: "var(--color-text-secondary)" }}>
                        至
                      </span>
                      <input
                        type="time"
                        value={childFormEndTime}
                        onChange={(e) => setChildFormEndTime(e.target.value)}
                        className="flex-1 h-10 rounded-lg px-3 text-[15px] outline-none border"
                        style={{
                          borderColor: "var(--lifeflow-border)",
                          background: "var(--color-surface-secondary)",
                        }}
                      />
                    </div>
                  </div>
                  <div className="mb-3">
                    <p className="text-[13px] mb-2" style={{ color: "var(--color-text-secondary)" }}>
                      颜色
                    </p>
                    <div className="flex gap-2.5 flex-wrap">
                      {COLORS.map((c) => (
                        <button
                          key={c}
                          type="button"
                          onClick={() => setChildFormColor(c)}
                          className="w-7 h-7 rounded-full transition-all"
                          style={{
                            background: c,
                            boxShadow:
                              childFormColor === c ? `0 0 0 3px ${c}40` : "none",
                            transform:
                              childFormColor === c ? "scale(1.15)" : "scale(1)",
                          }}
                        />
                      ))}
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <button
                      onClick={resetChildForm}
                      className="flex-1 h-10 rounded-lg text-[15px]"
                      style={{
                        background: "var(--color-surface-secondary)",
                        color: "var(--color-text-secondary)",
                      }}
                    >
                      取消
                    </button>
                    <button
                      onClick={handleSaveChild}
                      className="flex-1 h-10 rounded-lg text-[15px] font-semibold text-white"
                      style={{ background: "var(--lifeflow-primary)" }}
                    >
                      添加
                    </button>
                  </div>
                </motion.div>
              ) : editingChildId ? null : (
                <button
                  onClick={() => {
                    setAddingChild(true);
                    resetChildForm();
                  }}
                  className="w-full h-11 flex items-center justify-center gap-2 rounded-[20px] mt-3 text-[15px] font-medium"
                  style={{
                    background: "var(--lifeflow-brand-50)",
                    color: "var(--lifeflow-primary)",
                    border: "1px dashed var(--lifeflow-brand-200)",
                  }}
                >
                  <Plus className="w-4 h-4" />
                  添加子项
                </button>
              )}
            </AnimatePresence>

            {/* Empty child state */}
            {childRoutines.length === 0 && !showChildForm && !addingChild && (
              <motion.div
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                className="flex flex-col items-center justify-center py-12"
              >
                <p
                  className="text-[15px] mb-5"
                  style={{ color: "var(--color-text-secondary)" }}
                >
                  该模板还没有作息项
                </p>
                <button
                  onClick={() => {
                    setAddingChild(true);
                    resetChildForm();
                  }}
                  className="inline-flex items-center justify-center rounded-full px-6 py-2.5 text-[14px] font-medium"
                  style={{
                    backgroundColor: "var(--lifeflow-primary)",
                    color: "var(--lifeflow-primary-foreground)",
                  }}
                >
                  添加子项
                </button>
              </motion.div>
            )}
          </>
        )}

        {/* Delete group confirm dialog */}
        <AnimatePresence>
          {deletingGroupId && (
            <motion.div
              className="fixed inset-0 z-50 flex items-center justify-center p-6"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
            >
              <div
                className="absolute inset-0 bg-black/40"
                onClick={() => setDeletingGroupId(null)}
              />
              <motion.div
                className="relative w-full max-w-sm rounded-[20px] p-6"
                style={{ background: "var(--color-surface-card)" }}
                initial={{ scale: 0.9, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                exit={{ scale: 0.9, opacity: 0 }}
              >
                <h3
                  className="text-[17px] font-semibold mb-2"
                  style={{ color: "var(--color-text-primary)" }}
                >
                  删除模板
                </h3>
                <p className="text-[14px] mb-5" style={{ color: "var(--color-text-secondary)" }}>
                  该模板下的所有作息项也会一并删除，确定要继续吗？
                </p>
                <div className="flex gap-2">
                  <button
                    onClick={() => setDeletingGroupId(null)}
                    className="flex-1 h-11 rounded-xl text-[15px]"
                    style={{
                      background: "var(--color-surface-secondary)",
                      color: "var(--color-text-secondary)",
                    }}
                  >
                    取消
                  </button>
                  <button
                    onClick={() => handleDeleteGroup(deletingGroupId)}
                    className="flex-1 h-11 rounded-xl text-[15px] font-semibold text-white"
                    style={{ background: "#FF3B30" }}
                  >
                    删除
                  </button>
                </div>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
