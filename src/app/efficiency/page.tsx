"use client";

import { useEffect, useState, useCallback, useMemo, useRef } from "react";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import {
  Plus, CheckCircle2, Pause, Play, SquarePen, Copy, Trash2, Pencil, Target,
} from "lucide-react";
import { useLiveQuery } from "dexie-react-hooks";
import { useEfficiencyStore } from "@/lib/store/efficiencyStore";
import { efficiencyDB, type Goal, getAllProjects } from "@/lib/db/efficiency.db";
import { showToast } from "@/components/ui/Toast";

// ─── 设计令牌 ────────────────────────────────────────────────
const DANGER = "#FF3B30";
const GREEN = "#34C759";

// ─── 分类筛选 ────────────────────────────────────────────────
const CATEGORIES = ["全部", "学习", "健康", "琐事", "长期主义", "娱乐"];

function todayStr(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

// ─── 迷你进度环（24px 外径，3px stroke） ────────────────────
function daysRemaining(deadline: string): number {
  const now = new Date();
  now.setHours(0, 0, 0, 0);
  const dl = new Date(deadline + "T00:00:00");
  return Math.ceil((dl.getTime() - now.getTime()) / 86400000);
}

function MiniRing({ pct }: { pct: number }) {
  const clamped = Math.min(100, Math.max(0, pct));
  const size = 24;
  const sw = 3;
  const r = (size - sw) / 2;
  const circ = 2 * Math.PI * r;

  return (
    <svg width={size} height={size} className="flex-shrink-0">
      <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="var(--lifeflow-border)" strokeWidth={sw} />
      <motion.circle
        cx={size / 2} cy={size / 2} r={r}
        fill="none" stroke="var(--lifeflow-primary)" strokeWidth={sw} strokeLinecap="round"
        strokeDasharray={circ}
        initial={{ strokeDashoffset: circ }}
        animate={{ strokeDashoffset: circ - (circ * clamped) / 100 }}
        transition={{ duration: 0.6, ease: "easeOut" }}
        style={{ transform: "rotate(-90deg)", transformOrigin: "center" }}
      />
    </svg>
  );
}

// ─── 分割线 ──────────────────────────────────────────────────
function Divider() {
  return <div className="mx-4" style={{ borderBottom: "0.5px solid var(--lifeflow-border)" }} />;
}

// ─── 主组件 ──────────────────────────────────────────────────

export default function EfficiencyPage() {
  const router = useRouter();
  const { goals, loading, loadGoals, addGoal, updateGoalStatus, deleteGoal } =
    useEfficiencyStore();

  const [sheetGoal, setSheetGoal] = useState<Goal | null>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [activeCategory, setActiveCategory] = useState("全部");

  // ─── Project 颜色映射 ──────────────────────────────────────
  const projects = useLiveQuery(() => getAllProjects(), [], []);

  const projectColorMap = useMemo(() => {
    const map = new Map<string, string>();
    for (const p of projects ?? []) {
      map.set(p.id, p.color);
    }
    return map;
  }, [projects]);

  // ─── 长按快捷操作 ──────────────────────────────────────────
  const [quickGoalId, setQuickGoalId] = useState<string | null>(null);
  const pressTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const longPressed = useRef(false);

  const startPress = useCallback((goal: Goal) => {
    longPressed.current = false;
    if (pressTimer.current) clearTimeout(pressTimer.current);
    pressTimer.current = setTimeout(() => {
      longPressed.current = true;
      setQuickGoalId(goal.id);
    }, 500);
  }, []);

  const cancelPress = useCallback(() => {
    if (pressTimer.current) clearTimeout(pressTimer.current);
  }, []);

  const handleCardClick = useCallback(
    (goal: Goal) => {
      if (longPressed.current) { longPressed.current = false; return; }
      if (quickGoalId) { setQuickGoalId(null); return; }
      router.push(`/efficiency/goals/${goal.id}`);
    },
    [router, quickGoalId],
  );

  const handleQuickAction = useCallback(
    async (goal: Goal, action: "delete" | "edit") => {
      setQuickGoalId(null);
      if (action === "edit") {
        router.push(`/efficiency/create?id=${goal.id}`);
        return;
      }
      await deleteGoal(goal.id);
      showToast({ message: "已删除", type: "success" });
    },
    [router, deleteGoal],
  );

  useEffect(() => { loadGoals(); }, [loadGoals]);

  // ─── 日程任务统计（仅今日任务） ────────────────────────────
  const scheduleTasks = useLiveQuery(
    () => efficiencyDB.scheduleTasks.toArray(),
    [],
  );

  const todayTaskStats = useMemo(() => {
    const today = todayStr();
    const map = new Map<string, { done: number; total: number }>();
    for (const t of scheduleTasks ?? []) {
      if (!t.goalId) continue;
      const isToday =
        t.date === today ||
        (t.type === "multi_day" && t.startDate && t.endDate && t.startDate <= today && t.endDate >= today);
      if (!isToday) continue;
      const s = map.get(t.goalId) ?? { done: 0, total: 0 };
      s.total += 1;
      if (t.isCompleted) s.done += 1;
      map.set(t.goalId, s);
    }
    return map;
  }, [scheduleTasks]);

  // ─── 分组 ──────────────────────────────────────────────────
  const { activeGoals, completedGoals } = useMemo(() => {
    const active = goals
      .filter((g) => g.status === "active" || g.status === "paused")
      .sort((a, b) => b.createdAt - a.createdAt);

    const completed = goals
      .filter((g) => g.status === "completed")
      .sort((a, b) => {
        const aTime = a.completedAt ?? 0;
        const bTime = b.completedAt ?? 0;
        if (bTime !== aTime) return bTime - aTime;
        return b.createdAt - a.createdAt;
      });

    return { activeGoals: active, completedGoals: completed };
  }, [goals]);

  // ─── 本月完成数 ────────────────────────────────────────────
  const monthlyCompleted = useMemo(() => {
    const now = new Date();
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).getTime();
    return goals.filter(
      (g) => g.status === "completed" && (g.completedAt ?? 0) >= monthStart,
    ).length;
  }, [goals]);

  // ─── 操作弹层 ──────────────────────────────────────────────
  const closeSheet = useCallback(() => {
    setSheetGoal(null);
    setConfirmDelete(false);
  }, []);

  const handleAction = useCallback(
    async (action: string) => {
      if (!sheetGoal) return;
      switch (action) {
        case "complete":
          await updateGoalStatus(sheetGoal.id, "completed");
          showToast({ message: "已标记完成", type: "success" });
          break;
        case "pause":
          await updateGoalStatus(sheetGoal.id, "paused");
          showToast({ message: "已暂停", type: "info" });
          break;
        case "resume":
          await updateGoalStatus(sheetGoal.id, "active");
          showToast({ message: "已恢复", type: "success" });
          break;
        case "edit":
          router.push(`/efficiency/create?id=${sheetGoal.id}`);
          closeSheet();
          return;
        case "copy": {
          const { id, createdAt, completedAt, ...rest } = sheetGoal;
          await addGoal({ ...rest, title: `${rest.title} (副本)`, status: "active" });
          showToast({ message: "已复制", type: "success" });
          break;
        }
        case "delete":
          if (!confirmDelete) { setConfirmDelete(true); return; }
          await deleteGoal(sheetGoal.id);
          showToast({ message: "已删除", type: "success" });
          break;
      }
      closeSheet();
    },
    [sheetGoal, confirmDelete, router, addGoal, updateGoalStatus, deleteGoal, closeSheet],
  );

  // ─── 渲染 ──────────────────────────────────────────────────

  const showEmpty = !loading && activeGoals.length === 0 && completedGoals.length === 0;

  return (
    <div className="mx-auto relative" style={{ maxWidth: 430, minHeight: "100vh", paddingBottom: 100 }}>
      {/* ===== Header ===== */}
      <div className="px-5 pt-[var(--safe-area-top)] pb-2">
        <div className="flex flex-col gap-1">
          <h1 className="text-title-large" style={{ color: "var(--color-text-primary)" }}>目标</h1>
          <p className="text-label" style={{ color: "var(--color-text-secondary)" }}>
            项目 · 目标 · 任务
          </p>
        </div>
      </div>

      {/* ===== Category Filter Pills ===== */}
      <div className="px-5 pt-3 pb-4">
        <div className="flex flex-nowrap overflow-x-auto gap-2 no-scrollbar">
          {CATEGORIES.map((cat) => {
            const isActive = activeCategory === cat;
            return (
              <button
                key={cat}
                type="button"
                onClick={() => setActiveCategory(cat)}
                className="shrink-0 inline-flex items-center justify-center whitespace-nowrap h-9 px-4 rounded-full text-[15px] font-medium transition-colors"
                style={{
                  backgroundColor: isActive ? "var(--lifeflow-primary)" : "var(--color-surface-card)",
                  color: isActive ? "var(--color-text-inverse)" : "var(--color-text-secondary)",
                  boxShadow: isActive ? "var(--shadow-tab-center)" : undefined,
                  border: isActive ? "none" : "1px solid var(--lifeflow-border)",
                }}
              >
                {cat}
              </button>
            );
          })}
        </div>
      </div>



      {/* ===== Loading Skeleton ===== */}
      {loading && (
        <div className="px-4 mt-[16px] flex flex-col gap-3">
          {[1, 2].map((i) => (
            <div
              key={i}
              className="rounded-[20px] p-4 flex items-center gap-[12px] animate-pulse"
              style={{
                backgroundColor: "var(--color-surface-card)",
                border: "1px solid var(--lifeflow-border)",
                boxShadow: "var(--shadow-card)",
              }}
            >
              <div className="w-[8px] h-[8px] rounded-full shrink-0" style={{ backgroundColor: "var(--lifeflow-border)" }} />
              <div className="flex-1 min-w-0 flex flex-col gap-[4px]">
                <div className="h-5 w-1/2 rounded" style={{ backgroundColor: "var(--lifeflow-background)" }} />
                <div className="h-[14px] w-1/3 rounded" style={{ backgroundColor: "var(--lifeflow-background)" }} />
              </div>
              <div className="w-6 h-6 rounded-full" style={{ backgroundColor: "var(--lifeflow-background)" }} />
            </div>
          ))}
        </div>
      )}

      {/* ===== Empty State ===== */}
      {showEmpty && (
        <section className="px-5 pt-8">
          <div
            className="p-8 flex flex-col items-center text-center gap-5"
            style={{
              backgroundColor: "var(--color-surface-card)",
              borderRadius: "var(--lifeflow-radius-medium)",
              boxShadow: "var(--shadow-card)",
            }}
          >
            <div
              className="w-20 h-20 rounded-full flex items-center justify-center"
              style={{ backgroundColor: "var(--color-surface-secondary)" }}
            >
              <Target className="w-10 h-10" style={{ color: "var(--color-text-disabled)" }} strokeWidth={2} />
            </div>
            <p
              className="text-[17px] font-medium"
              style={{ color: "var(--color-text-secondary)", letterSpacing: "-0.022em" }}
            >
              开始创建一个目标吧！
            </p>
            <p
              className="text-[14px] leading-relaxed"
              style={{ color: "var(--color-text-disabled)" }}
            >
              从项目开始，分解为目标和任务，让每一步都有迹可循
            </p>
            <button
              type="button"
              onClick={() => {
                const pid = activeCategory !== "全部"
                  ? (projects ?? []).find((p) => p.name === activeCategory)?.id
                  : undefined;
                router.push(pid ? `/efficiency/create?projectId=${pid}` : "/efficiency/create");
              }}
              className="inline-flex items-center justify-center whitespace-nowrap h-11 px-7 rounded-full text-[16px] font-semibold"
              style={{
                backgroundColor: "var(--lifeflow-primary)",
                color: "var(--color-text-inverse)",
                boxShadow: "var(--shadow-tab-center)",
              }}
            >
              创建目标
            </button>
          </div>
        </section>
      )}

      {/* ===== 进行中分组 ===== */}
      {activeGoals.length > 0 && (
        <>
          <h2
            className="px-4 mt-[32px] mb-[12px] text-[20px] font-bold"
            style={{ color: "var(--color-text-primary)" }}
          >
            进行中
          </h2>
          <div className="px-4 flex flex-col gap-3">
            {activeGoals.map((goal, i) => {
              const stats = todayTaskStats.get(goal.id) ?? { done: 0, total: 0 };
              const pct =
                stats.total > 0
                  ? Math.round((stats.done / stats.total) * 100)
                  : Math.min(100, Math.max(0, goal.progress));
              const dotColor =
                (goal as any).color ||
                projectColorMap.get(goal.projectId || "") ||
                "var(--lifeflow-primary)";
              const quickActive = quickGoalId === goal.id;

              return (
                <motion.div
                  key={goal.id}
                  initial={{ opacity: 0, y: 12 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: i * 0.05, duration: 0.35, ease: "easeOut" }}
                  className="relative overflow-hidden"
                  style={{ zIndex: quickActive ? 40 : undefined, borderRadius: "20px" }}
                >
                  {/* 滑出操作按钮（底部层） */}
                  <div
                    className="absolute right-2 top-0 bottom-0 flex items-center gap-2"
                    style={{ right: 8 }}
                  >
                    <motion.button
                      type="button"
                      initial={{ opacity: 0 }}
                      animate={{ opacity: quickActive ? 1 : 0 }}
                      transition={{ duration: 0.15 }}
                      onClick={(e) => { e.stopPropagation(); handleQuickAction(goal, "delete"); }}
                      aria-label="删除"
                      className="w-[44px] h-[44px] rounded-full flex items-center justify-center flex-shrink-0"
                      style={{ background: "rgba(239,68,68,0.1)" }}
                    >
                      <Trash2 className="w-5 h-5" style={{ color: "var(--state-error)" }} />
                    </motion.button>
                    <motion.button
                      type="button"
                      initial={{ opacity: 0 }}
                      animate={{ opacity: quickActive ? 1 : 0 }}
                      transition={{ duration: 0.15, delay: 0.03 }}
                      onClick={(e) => { e.stopPropagation(); handleQuickAction(goal, "edit"); }}
                      aria-label="编辑"
                      className="w-[44px] h-[44px] rounded-full flex items-center justify-center flex-shrink-0"
                      style={{ backgroundColor: "var(--lifeflow-primary)" }}
                    >
                      <Pencil className="w-5 h-5 text-white" />
                    </motion.button>
                  </div>

                  {/* 卡片本体（可拖拽层） */}
                  <motion.div
                    whileTap={{ scale: quickActive ? 0.98 : 0.98 }}
                    animate={{ x: quickActive ? -106 : 0, scale: 1, opacity: 1 }}
                    transition={{ duration: 0.25, ease: "easeOut" }}
                    drag="x"
                    dragConstraints={{ left: -120, right: 0 }}
                    dragElastic={0.1}
                    dragSnapToOrigin
                    onDragEnd={(_e, info) => {
                      if (info.offset.x < -60) {
                        setQuickGoalId(goal.id);
                      } else if (info.offset.x > 10) {
                        setQuickGoalId(null);
                      }
                    }}
                    onPointerDown={() => startPress(goal)}
                    onPointerUp={cancelPress}
                    onPointerLeave={cancelPress}
                    onClick={() => handleCardClick(goal)}
                    className="rounded-[20px] p-4 flex items-center gap-[12px] cursor-pointer select-none"
                    style={{
                      backgroundColor: "var(--color-surface-card)",
                      border: "1px solid var(--lifeflow-border)",
                      boxShadow: "var(--shadow-card)",
                      position: "relative",
                      zIndex: 1,
                    }}
                  >
                    <div
                      className="w-[8px] h-[8px] rounded-full shrink-0"
                      style={{ backgroundColor: dotColor }}
                    />
                    <div className="flex-1 min-w-0 flex flex-col gap-[4px]">
                      <span className="text-[17px] font-semibold truncate" style={{ color: "var(--color-text-primary)" }}>
                        {goal.title}
                      </span>
                      <span className="text-[13px]" style={{ color: "var(--color-text-secondary)" }}>
                        {stats.total > 0
                          ? `今日任务 · ${stats.done}/${stats.total} 项`
                          : "今日无任务"}
                      </span>
                      {/* Deadline counter */}
                      {goal.deadline && (
                        <span className="text-[11px] font-medium" style={{ color: daysRemaining(goal.deadline) < 0 ? "var(--state-error)" : "var(--color-text-disabled)" }}>
                          {daysRemaining(goal.deadline) < 0
                            ? `已过期 ${Math.abs(daysRemaining(goal.deadline))} 天`
                            : daysRemaining(goal.deadline) === 0
                              ? "今天截止"
                              : `还剩 ${daysRemaining(goal.deadline)} 天`}
                        </span>
                      )}
                    </div>
                    <MiniRing pct={pct} />
                  </motion.div>
                </motion.div>
              );
            })}
          </div>
        </>
      )}

      {/* ===== 已完成分组 ===== */}
      {completedGoals.length > 0 && (
        <>
          <h2
            className="px-4 mt-[32px] mb-[12px] text-[20px] font-bold"
            style={{ color: "var(--color-text-primary)" }}
          >
            已完成
          </h2>
          <div className="px-4 flex flex-col gap-3">
            {completedGoals.map((goal, i) => {
              const completeLabel = goal.completedAt
                ? (() => {
                    const d = new Date(goal.completedAt);
                    return `${d.getMonth() + 1} 月 ${d.getDate()} 日完成`;
                  })()
                : "已完成";

              return (
                <motion.div
                  key={goal.id}
                  initial={{ opacity: 0, y: 12 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: i * 0.05, duration: 0.35, ease: "easeOut" }}
                  className="rounded-[20px] p-4 flex items-center gap-[12px] cursor-pointer select-none"
                  style={{
                    backgroundColor: "var(--color-surface-card)",
                    border: "1px solid var(--lifeflow-border)",
                    boxShadow: "var(--shadow-card)",
                  }}
                  onClick={() => { setSheetGoal(goal); setConfirmDelete(false); }}
                >
                  <div className="w-[8px] h-[8px] rounded-full shrink-0" style={{ backgroundColor: "var(--color-text-disabled)" }} />
                  <div className="flex-1 min-w-0 flex flex-col gap-[4px]">
                    <span
                      className="text-[17px] font-medium line-through truncate"
                      style={{ color: "var(--color-text-disabled)" }}
                    >
                      {goal.title}
                    </span>
                    <span className="text-[13px]" style={{ color: "var(--color-text-disabled)" }}>
                      {completeLabel}
                    </span>
                  </div>
                  <CheckCircle2 className="w-[24px] h-[24px] shrink-0" style={{ color: GREEN }} strokeWidth={2} />
                </motion.div>
              );
            })}
          </div>
        </>
      )}

      {/* 快捷操作模式下的点击关闭层 */}
      {quickGoalId && (
        <div className="fixed inset-0 z-30" onClick={() => setQuickGoalId(null)} />
      )}

      {/* ===== FAB 按钮 ===== */}
      <button
        type="button"
        onClick={() => {
          const pid = activeCategory !== "全部"
            ? (projects ?? []).find((p) => p.name === activeCategory)?.id
            : undefined;
          router.push(pid ? `/efficiency/create?projectId=${pid}` : "/efficiency/create");
        }}
        className="fixed right-4 bottom-[170px] z-40 flex items-center justify-center"
        style={{
          width: 56,
          height: 56,
          borderRadius: "50%",
          backgroundColor: "var(--lifeflow-primary)",
          boxShadow: "0 2px 8px rgba(37, 99, 235, 0.3)",
        }}
      >
        <Plus className="w-6 h-6 text-white" strokeWidth={2} />
      </button>

      {/* ===== 目标操作弹层 ===== */}
      <AnimatePresence>
        {sheetGoal && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={closeSheet}
              className="fixed inset-0 z-50 bg-black/40"
            />
            <motion.div
              initial={{ y: "100%", x: "-50%" }}
              animate={{ y: 0, x: "-50%" }}
              exit={{ y: "100%", x: "-50%" }}
              transition={{ duration: 0.4, ease: [0.32, 0.72, 0, 1] }}
              className="fixed left-1/2 bottom-0 w-full max-w-[430px] z-[60]"
              style={{
                backgroundColor: "var(--color-surface-card)",
                borderRadius: "24px 24px 0 0",
                paddingBottom: "env(safe-area-inset-bottom)",
              }}
            >
              {/* 拖拽把手 */}
              <div className="flex justify-center pt-2 pb-2">
                <div className="w-9 h-1 rounded-full bg-[#D4D4D4]" />
              </div>

              {/* 目标名 */}
              <div className="px-4 pb-2">
                <p className="text-[13px] truncate" style={{ color: "var(--color-text-secondary)" }}>
                  {sheetGoal.title}
                </p>
              </div>
              <Divider />

              {sheetGoal.status === "active" && (
                <>
                  <ActionSheetItem icon={CheckCircle2} label="完成目标" onClick={() => handleAction("complete")} />
                  <Divider />
                  <ActionSheetItem icon={Trash2} label="删除目标" onClick={() => handleAction("delete")} />
                  <Divider />
                </>
              )}
              {sheetGoal.status === "paused" && (
                <>
                  <ActionSheetItem icon={Play} label="恢复目标" onClick={() => handleAction("resume")} />
                  <Divider />
                </>
              )}
              {sheetGoal.status === "completed" && (
                <>
                  <ActionSheetItem icon={Play} label="重新激活" onClick={() => handleAction("resume")} />
                  <Divider />
                </>
              )}
              <ActionSheetItem icon={SquarePen} label="编辑" onClick={() => handleAction("edit")} />
              <Divider />
              <ActionSheetItem icon={Copy} label="复制目标" onClick={() => handleAction("copy")} />
              <Divider />
              <ActionSheetItem
                icon={Trash2}
                label={confirmDelete ? "确认删除？" : "删除"}
                danger
                onClick={() => handleAction("delete")}
              />
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  );
}

// ─── 操作弹层菜单项 ──────────────────────────────────────────
function ActionSheetItem({
  icon: Icon,
  label,
  danger,
  onClick,
}: {
  icon: React.ComponentType<{ className?: string; style?: React.CSSProperties }>;
  label: string;
  danger?: boolean;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className="flex items-center h-[56px] px-4 w-full text-left active:bg-black/5"
    >
      <Icon
        className="w-[22px] h-[22px] mr-3 flex-shrink-0"
        style={{ color: danger ? DANGER : "var(--color-text-secondary)" }}
      />
      <span
        className="text-[15px]"
        style={{ color: danger ? DANGER : "var(--color-text-primary)" }}
      >
        {label}
      </span>
    </button>
  );
}
