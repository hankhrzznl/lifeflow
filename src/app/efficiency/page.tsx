"use client";

import { useEffect, useState, useCallback, useMemo, useRef } from "react";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import {
  Plus, CheckCircle2, Pause, Play, SquarePen, Copy, Trash2, Pencil,
} from "lucide-react";
import { useLiveQuery } from "dexie-react-hooks";
import { useEfficiencyStore } from "@/lib/store/efficiencyStore";
import { efficiencyDB, type Goal } from "@/lib/db/efficiency.db";
import { showToast } from "@/components/ui/Toast";

// ─── 设计令牌 ────────────────────────────────────────────────
const ACCENT = "#5865F2";
const DANGER = "#FF3B30";
const GREEN = "#34C759";

function todayStr(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

// ─── 迷你进度环（24px 外径，3px stroke） ────────────────────
function MiniRing({ pct }: { pct: number }) {
  const clamped = Math.min(100, Math.max(0, pct));
  const size = 24;
  const sw = 3;
  const r = (size - sw) / 2;
  const circ = 2 * Math.PI * r;

  return (
    <svg width={size} height={size} className="flex-shrink-0">
      <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="#E5E5E5" strokeWidth={sw} />
      <motion.circle
        cx={size / 2} cy={size / 2} r={r}
        fill="none" stroke={ACCENT} strokeWidth={sw} strokeLinecap="round"
        strokeDasharray={circ}
        initial={{ strokeDashoffset: circ }}
        animate={{ strokeDashoffset: circ - (circ * clamped) / 100 }}
        transition={{ duration: 0.6, ease: "easeOut" }}
        style={{ transform: "rotate(-90deg)", transformOrigin: "center" }}
      />
    </svg>
  );
}

// ─── 分隔线 ──────────────────────────────────────────────────
function Divider() {
  return <div className="mx-4" style={{ borderBottom: "0.5px solid #F5F5F5" }} />;
}

// ─── 主组件 ──────────────────────────────────────────────────

export default function EfficiencyPage() {
  const router = useRouter();
  const { goals, loading, loadGoals, addGoal, updateGoalStatus, deleteGoal } =
    useEfficiencyStore();

  const [sheetGoal, setSheetGoal] = useState<Goal | null>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);

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
      setSheetGoal(goal);
      setConfirmDelete(false);
    },
    [quickGoalId],
  );

  const handleQuickAction = useCallback(
    async (goal: Goal, action: "pause" | "edit") => {
      setQuickGoalId(null);
      if (action === "edit") {
        router.push(`/efficiency/create?id=${goal.id}`);
        return;
      }
      if (goal.status === "paused") {
        await updateGoalStatus(goal.id, "active");
        showToast({ message: "已恢复", type: "success" });
      } else {
        await updateGoalStatus(goal.id, "paused");
        showToast({ message: "已暂停", type: "info" });
      }
    },
    [router, updateGoalStatus],
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
  const { activeGoals, completedGoals, monthCompletedCount } = useMemo(() => {
    const now = new Date();
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).getTime();

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

    const monthCount = goals.filter(
      (g) => g.status === "completed" && g.completedAt && g.completedAt >= monthStart,
    ).length;

    return { activeGoals: active, completedGoals: completed, monthCompletedCount: monthCount };
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

  // 空态
  const showEmpty = !loading && activeGoals.length === 0 && completedGoals.length === 0;

  return (
    <div>
      {/* ===== Header ===== */}
      <div className="px-4 pt-[56px]">
        <h1 className="text-[34px] font-bold text-[#1D1D1F]">效率</h1>
      </div>

      {/* ===== 主操作行 ===== */}
      <div className="px-4 mt-[24px] flex items-center justify-between">
        <div className="text-[15px] text-[#86868B]">
          本月完成{" "}
          <span className="text-[17px] font-bold text-[#1D1D1F] tabular-nums">
            {monthCompletedCount}
          </span>{" "}
          个目标
        </div>
        <motion.button
          whileTap={{ scale: 0.95 }}
          onClick={() => router.push("/efficiency/create")}
          className="h-[40px] px-5 rounded-full bg-[#5865F2] text-white text-[15px] font-semibold flex items-center gap-1"
        >
          <Plus className="w-4 h-4" />
          新建目标
        </motion.button>
      </div>

      {/* ===== 骨架屏 ===== */}
      {loading && (
        <div className="px-4 mt-[32px] flex flex-col gap-3">
          <div className="h-8 w-20 bg-[#F5F5F5] rounded animate-pulse mb-1" />
          {[1, 2].map((i) => (
            <div
              key={i}
              className="bg-white rounded-[16px] border border-[#E5E5E5] p-4 flex items-center gap-3 animate-pulse"
            >
              <div className="w-2 h-2 rounded-full bg-[#F5F5F5]" />
              <div className="flex-1 flex flex-col gap-1">
                <div className="h-5 w-1/2 bg-[#F5F5F5] rounded" />
                <div className="h-[14px] w-1/3 bg-[#F5F5F5] rounded" />
              </div>
              <div className="w-6 h-6 rounded-full bg-[#F5F5F5]" />
            </div>
          ))}
        </div>
      )}

      {/* ===== 空态 ===== */}
      {showEmpty && (
        <div className="flex flex-col items-center pt-[80px]">
          <p className="text-[15px] text-[#AEAEB2]">开始创建一个目标吧！</p>
          <motion.button
            whileTap={{ scale: 0.95 }}
            onClick={() => router.push("/efficiency/create")}
            className="mt-[24px] h-[40px] px-5 rounded-full bg-[#5865F2] text-white text-[15px] font-semibold flex items-center gap-1"
          >
            <Plus className="w-4 h-4" />
            新建目标
          </motion.button>
        </div>
      )}

      {/* ===== 进行中分组 ===== */}
      {activeGoals.length > 0 && (
        <>
          <h2 className="px-4 mt-[32px] mb-[12px] text-[20px] font-bold text-[#1D1D1F]">进行中</h2>
          <div className="px-4 flex flex-col gap-3">
            {activeGoals.map((goal, i) => {
              const stats = todayTaskStats.get(goal.id) ?? { done: 0, total: 0 };
              const pct =
                stats.total > 0
                  ? Math.round((stats.done / stats.total) * 100)
                  : Math.min(100, Math.max(0, goal.progress));
              const color = goal.color || ACCENT;
              const quickActive = quickGoalId === goal.id;

              return (
                <motion.div
                  key={goal.id}
                  initial={{ opacity: 0, y: 12 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: i * 0.05, duration: 0.35, ease: "easeOut" }}
                  className="relative"
                  style={{ zIndex: quickActive ? 40 : undefined }}
                >
                  {/* 快捷操作按钮 */}
                  <AnimatePresence>
                    {quickActive && (
                      <div
                        className="absolute flex flex-col items-center"
                        style={{ right: 8, top: "50%", transform: "translateY(-50%)" }}
                      >
                        {(goal.status === "active" || goal.status === "paused") && (
                          <>
                            <motion.button
                              type="button"
                              initial={{ opacity: 0, x: 12 }}
                              animate={{ opacity: 1, x: 0 }}
                              exit={{ opacity: 0, x: 12 }}
                              transition={{ duration: 0.2, ease: "easeOut" }}
                              onClick={(e) => { e.stopPropagation(); handleQuickAction(goal, "pause"); }}
                              aria-label={goal.status === "paused" ? "恢复" : "暂停"}
                              className="w-[44px] h-[44px] rounded-full bg-white border border-[#E5E5E5] flex items-center justify-center"
                            >
                              {goal.status === "paused" ? (
                                <Play className="w-5 h-5 text-[#1D1D1F]" />
                              ) : (
                                <Pause className="w-5 h-5 text-[#1D1D1F]" />
                              )}
                            </motion.button>
                            <span className="text-[11px] text-[#86868B] mt-1">
                              {goal.status === "paused" ? "恢复" : "暂停"}
                            </span>
                          </>
                        )}
                        <motion.button
                          type="button"
                          initial={{ opacity: 0, x: 12 }}
                          animate={{ opacity: 1, x: 0 }}
                          exit={{ opacity: 0, x: 12 }}
                          transition={{ duration: 0.2, delay: 0.05, ease: "easeOut" }}
                          onClick={(e) => { e.stopPropagation(); handleQuickAction(goal, "edit"); }}
                          aria-label="编辑"
                          className="w-[44px] h-[44px] rounded-full bg-[#5865F2] flex items-center justify-center"
                          style={{ marginTop: goal.status === "active" || goal.status === "paused" ? 8 : 0 }}
                        >
                          <Pencil className="w-5 h-5 text-white" />
                        </motion.button>
                        <span className="text-[11px] text-[#86868B] mt-1">编辑</span>
                      </div>
                    )}
                  </AnimatePresence>

                  {/* 卡片本体 */}
                  <motion.div
                    animate={{
                      scale: quickActive ? 0.98 : 1,
                      opacity: quickActive ? 0.9 : 1,
                      x: quickActive ? -70 : 0,
                    }}
                    transition={{ duration: 0.2, ease: "easeOut" }}
                    onPointerDown={() => startPress(goal)}
                    onPointerUp={cancelPress}
                    onPointerLeave={cancelPress}
                    onClick={() => handleCardClick(goal)}
                    className="bg-white rounded-[16px] border border-[#E5E5E5] p-4 flex items-center gap-3 cursor-pointer select-none"
                  >
                    <div
                      className="w-2 h-2 rounded-full flex-shrink-0"
                      style={{ backgroundColor: color }}
                    />
                    <div className="flex-1 min-w-0 flex flex-col gap-1">
                      <span className="text-[17px] font-semibold text-[#1D1D1F] truncate">{goal.title}</span>
                      <span className="text-[13px] text-[#86868B]">
                        {stats.total > 0
                          ? `今日任务 · ${stats.done}/${stats.total} 项`
                          : "今日无任务"}
                      </span>
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
          <h2 className="px-4 mt-[32px] mb-[12px] text-[20px] font-bold text-[#1D1D1F]">已完成</h2>
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
                  className="bg-white rounded-[16px] border border-[#E5E5E5] p-4 flex items-center gap-3 cursor-pointer select-none"
                  onClick={() => { setSheetGoal(goal); setConfirmDelete(false); }}
                >
                  <div className="w-2 h-2 rounded-full flex-shrink-0 bg-[#AEAEB2]" />
                  <div className="flex-1 min-w-0 flex flex-col gap-1">
                    <span className="text-[17px] font-medium text-[#AEAEB2] line-through truncate">
                      {goal.title}
                    </span>
                    <span className="text-[13px] text-[#AEAEB2]">{completeLabel}</span>
                  </div>
                  <CheckCircle2 className="w-6 h-6 flex-shrink-0 text-[#34C759]" strokeWidth={2} />
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
              className="fixed left-1/2 bottom-0 w-full max-w-[430px] bg-white z-[60]"
              style={{
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
                <p className="text-[13px] text-[#86868B] truncate">{sheetGoal.title}</p>
              </div>
              <Divider />

              {sheetGoal.status === "active" && (
                <>
                  <ActionSheetItem icon={CheckCircle2} label="完成目标" onClick={() => handleAction("complete")} />
                  <Divider />
                  <ActionSheetItem icon={Pause} label="暂停目标" onClick={() => handleAction("pause")} />
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
        style={{ color: danger ? DANGER : "#86868B" }}
      />
      <span
        className="text-[15px]"
        style={{ color: danger ? DANGER : "#1D1D1F" }}
      >
        {label}
      </span>
    </button>
  );
}
