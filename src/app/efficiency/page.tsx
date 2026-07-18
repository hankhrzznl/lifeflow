"use client";

import { useEffect, useState, useCallback, useMemo, useRef } from "react";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import {
  MoreHorizontal, Star, Trash2, Home, Trophy, Quote, Circle, Plus,
  CheckCircle2, Pause, Play, SquarePen, Copy, Pencil,
} from "lucide-react";
import { useLiveQuery } from "dexie-react-hooks";
import { useEfficiencyStore } from "@/lib/store/efficiencyStore";
import { efficiencyDB, type Goal } from "@/lib/db/efficiency.db";
import { showToast } from "@/components/ui/Toast";

// ─── 设计稿基准: lifeflow-goals/pages/goal-list.html ─────────
// Apple HIG Light / 品牌色 #5856D6 / 430px 居中 / pt 单位

const FONT =
  "-apple-system,BlinkMacSystemFont,'SF Pro Display','SF Pro Text','Segoe UI',sans-serif";
const BRAND = "#5856D6";
const MUTED = "#8E8E93";
const BORDER = "#E5E5EA";
const DANGER = "#FF3B30";
const CARD_SHADOW = "0 1px 2px rgba(0,0,0,0.04), 0 4px 8px rgba(0,0,0,0.02)";

// ─── 工具 ────────────────────────────────────────────────────

function deadlineBadge(goal: Goal): string {
  if (goal.status === "completed") return "已完成";
  if (goal.status === "paused") return "已暂停";
  if (!goal.deadline) return "无截止";
  const end = new Date(`${goal.deadline}T23:59:59`).getTime();
  const days = Math.ceil((end - Date.now()) / 86400000);
  if (days > 0) return `剩余 ${days}d`;
  if (days === 0) return "今天到期";
  return `已逾期 ${-days}d`;
}

const STATUS_ORDER: Record<Goal["status"], number> = {
  active: 0,
  paused: 1,
  completed: 2,
  archived: 3,
};

// ─── 主组件 ──────────────────────────────────────────────────

export default function EfficiencyPage() {
  const router = useRouter();
  const { goals, loading, loadGoals, addGoal, updateGoalStatus, deleteGoal } =
    useEfficiencyStore();

  const [showCompletedOnly, setShowCompletedOnly] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [sheetGoal, setSheetGoal] = useState<Goal | null>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);

  // ─── 长按快捷操作（设计稿 goal-quick-actions.html） ───
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

  // 每个目标关联的日程任务统计（x/y 任务已完成）
  const scheduleTasks = useLiveQuery(
    () => efficiencyDB.scheduleTasks.toArray(),
    [],
  );

  const taskStats = useMemo(() => {
    const map = new Map<string, { done: number; total: number }>();
    for (const t of scheduleTasks ?? []) {
      if (!t.goalId) continue;
      const s = map.get(t.goalId) ?? { done: 0, total: 0 };
      s.total += 1;
      if (t.isCompleted) s.done += 1;
      map.set(t.goalId, s);
    }
    return map;
  }, [scheduleTasks]);

  const visibleGoals = useMemo(() => {
    const list = goals.filter((g) => g.status !== "archived");
    const filtered = showCompletedOnly
      ? list.filter((g) => g.status === "completed")
      : list;
    return [...filtered].sort(
      (a, b) =>
        STATUS_ORDER[a.status] - STATUS_ORDER[b.status] ||
        b.createdAt - a.createdAt,
    );
  }, [goals, showCompletedOnly]);

  // ─── 操作 ──────────────────────────────────────────────────

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
          const { id, createdAt, ...rest } = sheetGoal;
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

  return (
    <div style={{ fontFamily: FONT }}>
      {/* ===== Header（设计稿: 60pt 高 / 22pt 大标题） ===== */}
      <header className="relative flex items-center justify-between h-[60pt] px-[16pt] pt-[10pt]">
        <h1 className="text-[22pt] font-bold leading-[28pt] tracking-[0.35pt] text-black">
          {showCompletedOnly ? "已达成目标" : "我的目标"}
        </h1>
        <button
          onClick={() => setMenuOpen((p) => !p)}
          className="w-[44pt] h-[44pt] flex items-center justify-center rounded-full"
          aria-label="菜单"
        >
          <MoreHorizontal
            className="w-[24pt] h-[24pt]"
            style={{ color: menuOpen ? BRAND : MUTED }}
          />
        </button>

        {/* 下拉菜单（设计稿 dropdown-menu.html） */}
        <AnimatePresence>
          {menuOpen && (
            <>
              <div
                className="fixed inset-0 z-40"
                onClick={() => setMenuOpen(false)}
              />
              <motion.div
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.95 }}
                transition={{ duration: 0.2, ease: "easeOut" }}
                className="absolute right-[16pt] top-[54pt] z-50 w-[180pt] bg-white overflow-hidden origin-top-right flex flex-col"
                style={{
                  borderRadius: "12pt",
                  boxShadow: "0 8px 24px rgba(0,0,0,0.12)",
                }}
              >
                <MenuItem
                  icon={Star}
                  label={showCompletedOnly ? "显示全部目标" : "已达成目标"}
                  onClick={() => {
                    setShowCompletedOnly((p) => !p);
                    setMenuOpen(false);
                  }}
                />
                <Divider />
                <MenuItem
                  icon={Trash2}
                  label="最近删除"
                  onClick={() => {
                    setMenuOpen(false);
                    showToast({ message: "功能开发中", type: "info" });
                  }}
                />
                <Divider />
                <MenuItem
                  icon={Home}
                  label="返回主页"
                  onClick={() => router.push("/")}
                />
              </motion.div>
            </>
          )}
        </AnimatePresence>
      </header>

      {/* ===== 内容区 ===== */}
      <div className="px-[16pt] flex flex-col gap-[16pt]">
        {/* 引言卡（设计稿固定文案） */}
        <div
          className="bg-white rounded-[16pt] h-[56pt] px-[16pt] flex items-center"
          style={{ boxShadow: CARD_SHADOW }}
        >
          <Trophy className="w-[24pt] h-[24pt] shrink-0 mr-[8pt]" style={{ color: BRAND }} />
          <span className="flex-1 text-[16pt] font-medium leading-[22pt] truncate" style={{ color: BRAND }}>
            是时候点燃自己的宇宙了！
          </span>
          <Quote className="w-[20pt] h-[20pt] shrink-0 ml-[8pt]" style={{ color: "#C7C7CC", opacity: 0.3 }} />
        </div>

        {/* 目标卡列表 */}
        {loading ? (
          <>
            <SkeletonCard />
            <SkeletonCard />
          </>
        ) : visibleGoals.length === 0 ? (
          <EmptyState
            hasAnyGoal={goals.length > 0}
            showCompletedOnly={showCompletedOnly}
            onCreate={() => router.push("/efficiency/create")}
          />
        ) : (
          visibleGoals.map((goal, i) => {
            const stats = taskStats.get(goal.id) ?? { done: 0, total: 0 };
            const pct =
              stats.total > 0
                ? (stats.done / stats.total) * 100
                : Math.min(100, Math.max(0, goal.progress));
            const color = goal.color || BRAND;
            const quickActive = quickGoalId === goal.id;
            return (
              <motion.div
                key={goal.id}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.05, duration: 0.4, ease: [0.32, 0.72, 0, 1] }}
                className="relative"
                style={{ zIndex: quickActive ? 40 : undefined }}
              >
                {/* 快捷操作按钮（设计稿 goal-quick-actions.html: 44pt 圆形按钮组） */}
                <AnimatePresence>
                  {quickActive && (
                    <div className="absolute flex flex-col items-center" style={{ right: "8pt", top: "50%", transform: "translateY(-50%)" }}>
                      {(goal.status === "active" || goal.status === "paused") && (
                        <>
                          <motion.button
                            type="button"
                            initial={{ opacity: 0, x: 12 }}
                            animate={{ opacity: 1, x: 0 }}
                            exit={{ opacity: 0, x: 12 }}
                            transition={{ duration: 0.2, ease: [0.32, 0.72, 0, 1] }}
                            onClick={(e) => { e.stopPropagation(); handleQuickAction(goal, "pause"); }}
                            aria-label={goal.status === "paused" ? "恢复" : "暂停"}
                            className="flex items-center justify-center"
                            style={{
                              width: "44pt", height: "44pt", borderRadius: "22pt",
                              background: "#F5F5F7", boxShadow: "0 2px 8px rgba(0,0,0,0.08)",
                            }}
                          >
                            {goal.status === "paused" ? (
                              <Play className="w-[20pt] h-[20pt]" style={{ color: "#000" }} />
                            ) : (
                              <Pause className="w-[20pt] h-[20pt]" style={{ color: "#000" }} />
                            )}
                          </motion.button>
                          <span className="text-[10pt] leading-[12pt] mt-[4pt]" style={{ color: MUTED }}>
                            {goal.status === "paused" ? "恢复" : "暂停"}
                          </span>
                        </>
                      )}
                      <motion.button
                        type="button"
                        initial={{ opacity: 0, x: 12 }}
                        animate={{ opacity: 1, x: 0 }}
                        exit={{ opacity: 0, x: 12 }}
                        transition={{ duration: 0.2, delay: 0.05, ease: [0.32, 0.72, 0, 1] }}
                        onClick={(e) => { e.stopPropagation(); handleQuickAction(goal, "edit"); }}
                        aria-label="编辑"
                        className="flex items-center justify-center"
                        style={{
                          width: "44pt", height: "44pt", borderRadius: "22pt",
                          background: "#FF9500", boxShadow: "0 2px 8px rgba(255,149,0,0.3)",
                          marginTop: goal.status === "active" || goal.status === "paused" ? "8pt" : 0,
                        }}
                      >
                        <Pencil className="w-[20pt] h-[20pt]" style={{ color: "#FFF" }} />
                      </motion.button>
                      <span className="text-[10pt] leading-[12pt] mt-[4pt]" style={{ color: MUTED }}>编辑</span>
                    </div>
                  )}
                </AnimatePresence>

                {/* 目标卡本体（快捷模式下左移+缩小，设计稿 scale 0.98 / opacity 0.9） */}
                <motion.div
                  animate={{
                    scale: quickActive ? 0.98 : 1,
                    opacity: quickActive ? 0.9 : 1,
                    x: quickActive ? "-70pt" : 0,
                  }}
                  transition={{ duration: 0.2, ease: [0.32, 0.72, 0, 1] }}
                  onPointerDown={() => startPress(goal)}
                  onPointerUp={cancelPress}
                  onPointerLeave={cancelPress}
                  onClick={() => handleCardClick(goal)}
                  className="bg-white rounded-[16pt] p-[16pt] cursor-pointer select-none"
                  style={{ boxShadow: CARD_SHADOW }}
                >
                {/* Row 1: 标题 + 徽章 */}
                <div className="flex items-center justify-between">
                  <h2 className="text-[17pt] font-bold text-black leading-[22pt] truncate pr-2">
                    {goal.title}
                  </h2>
                  <span className="text-[13pt] font-medium bg-[#F5F5F7] rounded-[8pt] px-[8pt] py-[4pt] leading-[18pt] shrink-0" style={{ color: MUTED }}>
                    {deadlineBadge(goal)}
                  </span>
                </div>

                {/* Row 2: 任务状态 */}
                <div className="flex items-center gap-[6pt] mt-[8pt]">
                  {stats.done === stats.total && stats.total > 0 ? (
                    <CheckCircle2 className="w-[20pt] h-[20pt] shrink-0" style={{ color }} />
                  ) : (
                    <Circle className="w-[20pt] h-[20pt] shrink-0" style={{ color: MUTED }} />
                  )}
                  <span className="text-[13pt] leading-[18pt]" style={{ color: MUTED }}>
                    {stats.done}/{stats.total} 任务已完成
                  </span>
                </div>

                {/* Row 3: 进度条 */}
                <div className="mt-[8pt]">
                  <div className="w-full h-[6pt] bg-[#F5F5F7] rounded-[3pt] overflow-hidden">
                    <motion.div
                      className="h-full rounded-[3pt]"
                      initial={{ width: 0 }}
                      animate={{ width: `${pct}%` }}
                      transition={{ duration: 0.4, ease: [0.32, 0.72, 0, 1] }}
                      style={{ backgroundColor: color }}
                    />
                  </div>
                  <p className="text-[12pt] leading-[16pt] mt-[4pt]" style={{ color: MUTED }}>
                    {pct.toFixed(1)}%
                  </p>
                </div>
                </motion.div>
              </motion.div>
            );
          })
        )}
      </div>

      {/* 快捷操作模式下的点击关闭层 */}
      {quickGoalId && (
        <div className="fixed inset-0 z-30" onClick={() => setQuickGoalId(null)} />
      )}

      {/* ===== FAB（设计稿: 56pt 渐变圆，bottom 100pt） ===== */}
      <button
        onClick={() => router.push("/efficiency/create")}
        aria-label="创建目标"
        className="fixed w-[56pt] h-[56pt] rounded-[28pt] flex items-center justify-center z-40"
        style={{
          right: "calc(50% - 215px + 16pt)",
          bottom: "100pt",
          background: "linear-gradient(135deg,#5856D6,#AF52DE)",
          boxShadow: "0 4px 16px rgba(88,86,214,0.35)",
        }}
      >
        <Plus className="w-[24pt] h-[24pt]" style={{ color: "#FFFFFF" }} />
      </button>

      {/* ===== 目标操作弹层（设计稿 goal-action-sheet.html） ===== */}
      <AnimatePresence>
        {sheetGoal && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={closeSheet}
              className="fixed inset-0 z-50"
              style={{ background: "rgba(0,0,0,0.4)" }}
            />
            <motion.div
              initial={{ y: "100%", x: "-50%" }}
              animate={{ y: 0, x: "-50%" }}
              exit={{ y: "100%", x: "-50%" }}
              transition={{ duration: 0.4, ease: [0.32, 0.72, 0, 1] }}
              className="fixed left-1/2 bottom-0 w-full max-w-[430px] bg-white z-[60]"
              style={{
                borderRadius: "32pt 32pt 0 0",
                boxShadow: "0 -4px 20px rgba(0,0,0,0.1)",
                paddingBottom: "max(16pt, env(safe-area-inset-bottom))",
              }}
            >
              {/* 拖拽把手 */}
              <div className="flex justify-center pt-[8pt] pb-[8pt]">
                <div className="w-[36pt] h-[4pt] bg-[#C7C7CC] rounded-[2pt]" />
              </div>

              {/* 目标名 */}
              <div className="px-[16pt] pb-[8pt]">
                <p className="text-[13pt] leading-[18pt] truncate" style={{ color: MUTED }}>
                  {sheetGoal.title}
                </p>
              </div>
              <Divider />

              {sheetGoal.status === "active" && (
                <>
                  <SheetItem icon={CheckCircle2} label="完成目标" onClick={() => handleAction("complete")} />
                  <Divider />
                  <SheetItem icon={Pause} label="暂停目标" onClick={() => handleAction("pause")} />
                  <Divider />
                </>
              )}
              {sheetGoal.status === "paused" && (
                <>
                  <SheetItem icon={Play} label="恢复目标" onClick={() => handleAction("resume")} />
                  <Divider />
                </>
              )}
              {sheetGoal.status === "completed" && (
                <>
                  <SheetItem icon={Play} label="重新激活" onClick={() => handleAction("resume")} />
                  <Divider />
                </>
              )}
              <SheetItem icon={SquarePen} label="编辑" onClick={() => handleAction("edit")} />
              <Divider />
              <SheetItem icon={Copy} label="复制目标" onClick={() => handleAction("copy")} />
              <Divider />
              <SheetItem
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

// ─── 下拉菜单项（设计稿: 48pt 高 / 17pt 文字） ───────────────

function MenuItem({
  icon: Icon,
  label,
  onClick,
}: {
  icon: React.ComponentType<{ className?: string; style?: React.CSSProperties }>;
  label: string;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className="flex items-center justify-between shrink-0 h-[48pt] px-[16pt] w-full text-left active:bg-black/5"
    >
      <span className="text-[17pt] font-normal leading-[22pt] text-black">{label}</span>
      <Icon className="w-[20pt] h-[20pt]" style={{ color: "#000000" }} />
    </button>
  );
}

// ─── 分隔线（设计稿: 0.5pt #E5E5EA） ─────────────────────────

function Divider() {
  return <div className="shrink-0 h-0 mx-[16pt]" style={{ borderBottom: `0.5pt solid ${BORDER}` }} />;
}

// ─── 操作弹层菜单项（设计稿: 56pt 高） ───────────────────────

function SheetItem({
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
      className="flex items-center h-[56pt] px-[16pt] w-full text-left active:bg-black/5"
    >
      <Icon
        className="w-[24pt] h-[24pt] mr-[12pt] shrink-0"
        style={{ color: danger ? DANGER : MUTED }}
      />
      <span
        className="text-[17pt] leading-[22pt]"
        style={{ color: danger ? DANGER : "#000000", fontWeight: danger ? 500 : 400 }}
      >
        {label}
      </span>
    </button>
  );
}

// ─── 骨架屏（卡片轮廓一致） ──────────────────────────────────

function SkeletonCard() {
  return (
    <div className="bg-white rounded-[16pt] p-[16pt] animate-pulse" style={{ boxShadow: CARD_SHADOW }}>
      <div className="flex items-center justify-between">
        <div className="h-[22pt] w-2/5 bg-[#F5F5F7] rounded-[8pt]" />
        <div className="h-[18pt] w-[64pt] bg-[#F5F5F7] rounded-[8pt]" />
      </div>
      <div className="h-[18pt] w-1/2 bg-[#F5F5F7] rounded-[8pt] mt-[8pt]" />
      <div className="w-full h-[6pt] bg-[#F5F5F7] rounded-[3pt] mt-[12pt]" />
    </div>
  );
}

// ─── 空状态（设计稿 empty-state.html） ───────────────────────

function EmptyState({
  hasAnyGoal,
  showCompletedOnly,
  onCreate,
}: {
  hasAnyGoal: boolean;
  showCompletedOnly: boolean;
  onCreate: () => void;
}) {
  if (hasAnyGoal && showCompletedOnly) {
    return (
      <div className="flex flex-col items-center justify-center py-[60pt]">
        <p className="text-[17pt] leading-[22pt]" style={{ color: MUTED }}>
          还没有已达成的目标
        </p>
      </div>
    );
  }
  return (
    <div className="flex flex-col items-center justify-center pt-[40pt]">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src="/assets/empty-state-illustration.jpg"
        alt="空状态插图"
        className="w-[200pt] h-[180pt] object-contain"
      />
      <p className="mt-[24pt] text-[17pt] leading-[22pt] tracking-[-0.41pt]" style={{ color: MUTED }}>
        开始创建一个目标吧！
      </p>
      <button
        onClick={onCreate}
        className="mt-[24pt] w-full h-[48pt] rounded-[12pt] text-white text-[17pt] font-medium leading-[22pt]"
        style={{
          background: "linear-gradient(to right, #5856D6, #AF52DE)",
          boxShadow: "0 4px 16px rgba(88,86,214,0.3)",
        }}
      >
        创建目标
      </button>
    </div>
  );
}
