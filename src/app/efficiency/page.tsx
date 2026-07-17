"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import {
  Plus, Target, TrendingUp, CheckCircle2, PauseCircle,
  Inbox, MoreHorizontal, Check, Pause, Play, Edit3, Copy, Trash2,
} from "lucide-react";
import { useEfficiencyStore } from "@/lib/store/efficiencyStore";
import { showToast } from "@/components/ui/Toast";
import BottomSheet from "@/components/common/BottomSheet";
import type { Goal } from "@/lib/db/efficiency.db";

// ─── 常量 ────────────────────────────────────────────────────

type FilterKey = "全部" | "进行中" | "已完成" | "已暂停";
const FILTERS: FilterKey[] = ["全部", "进行中", "已完成", "已暂停"];
const STATUS_MAP: Record<FilterKey, Goal["status"] | null> = {
  全部: null, 进行中: "active", 已完成: "completed", 已暂停: "paused",
};

const STATUS_LABEL: Record<string, string> = {
  active: "进行中", completed: "已完成", paused: "已暂停", archived: "已归档",
};

// ─── 骨架屏 ──────────────────────────────────────────────────

function SkeletonCard() {
  return (
    <div className="bg-white rounded-2xl shadow-sm p-4 animate-pulse">
      <div className="flex gap-3">
        <div className="w-1 flex-shrink-0 rounded-full bg-gray-200" />
        <div className="flex-1 space-y-2">
          <div className="h-5 bg-gray-200 rounded w-3/5" />
          <div className="h-2 bg-gray-100 rounded-full" />
          <div className="h-4 bg-gray-100 rounded w-2/5" />
        </div>
      </div>
    </div>
  );
}

// ─── 主组件 ──────────────────────────────────────────────────

export default function EfficiencyPage() {
  const router = useRouter();
  const { goals, loading, loadGoals, addGoal, updateGoalStatus, deleteGoal } = useEfficiencyStore();

  const [filter, setFilter] = useState<FilterKey>("全部");
  const [sheetOpen, setSheetOpen] = useState(false);
  const [selectedGoal, setSelectedGoal] = useState<Goal | null>(null);
  const [menuOpen, setMenuOpen] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);

  // ─── 加载 ──────────────────────────────────────────────────

  useEffect(() => { loadGoals(); }, [loadGoals]);

  // ─── 过滤与统计 ────────────────────────────────────────────

  const filteredGoals = (() => {
    const s = STATUS_MAP[filter];
    return s === null ? goals : goals.filter((g) => g.status === s);
  })();

  const activeCount = goals.filter((g) => g.status === "active").length;
  const completedCount = goals.filter((g) => g.status === "completed").length;
  const pausedCount = goals.filter((g) => g.status === "paused").length;

  const summaryCards = [
    { label: "总数", value: goals.length, icon: Target, color: "text-indigo-500", bg: "bg-indigo-50" },
    { label: "进行中", value: activeCount, icon: TrendingUp, color: "text-sky-500", bg: "bg-sky-50" },
    { label: "已完成", value: completedCount, icon: CheckCircle2, color: "text-emerald-500", bg: "bg-emerald-50" },
    { label: "已暂停", value: pausedCount, icon: PauseCircle, color: "text-orange-500", bg: "bg-orange-50" },
  ];

  // ─── 操作 ──────────────────────────────────────────────────

  const openSheet = useCallback((goal: Goal) => {
    setSelectedGoal(goal);
    setConfirmDelete(false);
    setSheetOpen(true);
  }, []);

  const closeSheet = useCallback(() => {
    setSheetOpen(false);
    setSelectedGoal(null);
    setConfirmDelete(false);
  }, []);

  const handleAction = useCallback(async (action: string) => {
    if (!selectedGoal?.id) return;

    switch (action) {
      case "complete":
        await updateGoalStatus(selectedGoal.id, "completed");
        showToast({ message: "已标记完成", type: "success" });
        break;
      case "pause":
        await updateGoalStatus(selectedGoal.id, "paused");
        showToast({ message: "已暂停", type: "info" });
        break;
      case "resume":
        await updateGoalStatus(selectedGoal.id, "active");
        showToast({ message: "已恢复", type: "success" });
        break;
      case "edit":
        router.push(`/efficiency/create?id=${selectedGoal.id}`);
        closeSheet();
        return;
      case "copy": {
        const { id, createdAt, ...rest } = selectedGoal;
        await addGoal({ ...rest, title: `${rest.title} (副本)`, status: "active" });
        showToast({ message: "已复制", type: "success" });
        break;
      }
      case "delete":
        if (!confirmDelete) { setConfirmDelete(true); return; }
        await deleteGoal(selectedGoal.id);
        showToast({ message: "已删除", type: "success" });
        break;
    }
    await loadGoals();
    closeSheet();
  }, [selectedGoal, confirmDelete, loadGoals, closeSheet, router, addGoal, updateGoalStatus, deleteGoal]);

  const handleMenuAction = useCallback((action: string) => {
    setMenuOpen(false);
    if (action === "completed") setFilter("已完成");
    else if (action === "deleted") showToast({ message: "功能开发中", type: "info" });
  }, []);

  // ─── 渲染 ──────────────────────────────────────────────────

  return (
    <div className="min-h-screen bg-[#F5F5F7] pb-24">
      <div className="max-w-2xl mx-auto px-5 pt-8">

        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">我的目标</h1>
            <p className="text-sm text-gray-500 mt-0.5">追踪你的每一个进步</p>
          </div>
          <div className="relative">
            <button onClick={() => setMenuOpen((p) => !p)}
              className="w-10 h-10 rounded-full hover:bg-gray-200/60 flex items-center justify-center transition-colors">
              <MoreHorizontal className="w-5 h-5 text-gray-700" />
            </button>
            <AnimatePresence>
              {menuOpen && (
                <>
                  <div className="fixed inset-0 z-30" onClick={() => setMenuOpen(false)} />
                  <motion.div
                    initial={{ opacity: 0, scale: 0.9, y: -4 }}
                    animate={{ opacity: 1, scale: 1, y: 0 }}
                    exit={{ opacity: 0, scale: 0.9, y: -4 }}
                    className="absolute right-0 top-12 z-40 w-40 bg-white rounded-xl shadow-lg border border-gray-100 py-1.5"
                  >
                    <button onClick={() => handleMenuAction("completed")}
                      className="w-full text-left px-4 py-2.5 text-sm text-gray-700 hover:bg-gray-50 flex items-center gap-2">
                      <CheckCircle2 className="w-4 h-4 text-emerald-500" />已达成目标
                    </button>
                    <button onClick={() => handleMenuAction("deleted")}
                      className="w-full text-left px-4 py-2.5 text-sm text-gray-500 hover:bg-gray-50 flex items-center gap-2">
                      <Trash2 className="w-4 h-4" />最近删除
                    </button>
                  </motion.div>
                </>
              )}
            </AnimatePresence>
          </div>
        </div>

        {/* Summary Cards */}
        {loading ? (
          <div className="grid grid-cols-4 gap-3 mb-6">
            {[0, 1, 2, 3].map((i) => (
              <div key={i} className="bg-white rounded-2xl shadow-sm p-3 animate-pulse">
                <div className="w-8 h-8 rounded-xl bg-gray-200 mx-auto mb-1.5" />
                <div className="h-5 bg-gray-200 rounded w-6 mx-auto mb-1" />
                <div className="h-3 bg-gray-100 rounded w-10 mx-auto" />
              </div>
            ))}
          </div>
        ) : (
          <div className="grid grid-cols-4 gap-3 mb-6">
            {summaryCards.map((card, i) => (
              <motion.div key={card.label} initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.06 }}
                className="bg-white rounded-2xl shadow-sm p-3 text-center">
                <div className={`w-8 h-8 rounded-xl ${card.bg} flex items-center justify-center mx-auto mb-1.5`}>
                  <card.icon className={`w-4 h-4 ${card.color}`} />
                </div>
                <div className="text-lg font-bold text-gray-900">{card.value}</div>
                <div className="text-xs text-gray-500">{card.label}</div>
              </motion.div>
            ))}
          </div>
        )}

        {/* Filter Chips */}
        <div className="flex gap-2 mb-5 overflow-x-auto pb-1">
          {FILTERS.map((f) => (
            <button key={f} onClick={() => setFilter(f)}
              className={`px-4 py-1.5 rounded-full text-sm font-medium transition-colors flex-shrink-0 ${
                filter === f ? "bg-indigo-500 text-white" : "bg-white text-gray-600 border border-gray-200 hover:bg-gray-50"
              }`}>{f}</button>
          ))}
        </div>

        {/* Goal Cards */}
        {loading ? (
          <div className="space-y-3">{[0, 1, 2].map((i) => <SkeletonCard key={i} />)}</div>
        ) : filteredGoals.length === 0 ? (
          <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }}
            className="flex flex-col items-center justify-center py-20">
            <div className="w-20 h-20 rounded-full bg-gray-100 flex items-center justify-center mb-5">
              <Inbox className="w-9 h-9 text-gray-400" />
            </div>
            <p className="text-gray-500 text-base mb-6">还没有目标，开始创建吧！</p>
            <button onClick={() => router.push("/efficiency/create")}
              className="px-6 py-2.5 bg-indigo-500 text-white rounded-full text-sm font-medium shadow-lg shadow-indigo-500/20 hover:bg-indigo-600 transition-colors">
              创建目标
            </button>
          </motion.div>
        ) : (
          <div className="space-y-3">
            {filteredGoals.map((goal, i) => {
              const colorHex = goal.color || "#5856D6";
              return (
                <motion.div key={goal.id}
                  initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: i * 0.06, duration: 0.3 }}
                  className="bg-white rounded-2xl shadow-sm overflow-hidden cursor-pointer active:scale-[0.98] transition-transform"
                  onClick={() => openSheet(goal)}>
                  <div className="flex">
                    {/* 左侧颜色条 */}
                    <div className="w-1 flex-shrink-0" style={{ backgroundColor: colorHex }} />
                    <div className="flex-1 p-4">
                      <div className="flex items-start justify-between mb-2">
                        <h3 className="font-semibold text-gray-900 pr-2 leading-snug">{goal.title}</h3>
                        <span className={`px-2 py-0.5 rounded-full text-xs font-medium flex-shrink-0 ${
                          goal.status === "active" ? "bg-emerald-50 text-emerald-600"
                          : goal.status === "completed" ? "bg-indigo-50 text-indigo-600"
                          : goal.status === "paused" ? "bg-orange-50 text-orange-600"
                          : "bg-gray-100 text-gray-500"
                        }`}>{STATUS_LABEL[goal.status]}</span>
                      </div>
                      {/* 进度条 */}
                      <div className="flex items-center gap-3 mb-1.5">
                        <div className="flex-1 h-2 bg-gray-100 rounded-full overflow-hidden">
                          <motion.div
                            className="h-2 bg-gradient-to-r from-indigo-500 to-violet-500 rounded-full"
                            initial={{ width: 0 }}
                            animate={{ width: `${goal.progress}%` }}
                            transition={{ delay: 0.2 + i * 0.06, duration: 0.6, ease: "easeOut" }}
                          />
                        </div>
                        <span className="text-sm font-medium text-gray-500 w-9 text-right">{goal.progress}%</span>
                      </div>
                      <div className="text-xs text-gray-400 mt-1">
                        截止: {goal.deadline || "无截止日期"}
                      </div>
                    </div>
                  </div>
                </motion.div>
              );
            })}
          </div>
        )}
      </div>

      {/* FAB */}
      <motion.button onClick={() => router.push("/efficiency/create")}
        className="fixed bottom-24 right-5 w-14 h-14 rounded-2xl shadow-lg flex items-center justify-center text-white z-40"
        style={{ background: "linear-gradient(135deg, #5856D6, #7B79E0)" }}
        whileTap={{ scale: 0.9 }}
        whileHover={{ scale: 1.05, boxShadow: "0 8px 30px rgba(88, 86, 214, 0.4)" }}>
        <Plus className="w-6 h-6" />
      </motion.button>

      {/* BottomSheet */}
      <BottomSheet open={sheetOpen} onClose={closeSheet} title={selectedGoal?.title ?? ""}>
        <div className="flex flex-col gap-1">
          {selectedGoal?.status === "active" && (
            <SheetAction icon={Check} color="emerald" label="标记完成" desc="将此目标设为已完成"
              onClick={() => handleAction("complete")} />
          )}
          {selectedGoal?.status === "active" && (
            <SheetAction icon={Pause} color="orange" label="暂停" desc="暂时暂停此目标的追踪"
              onClick={() => handleAction("pause")} />
          )}
          {selectedGoal?.status === "paused" && (
            <SheetAction icon={Play} color="blue" label="恢复" desc="重新开始追踪此目标"
              onClick={() => handleAction("resume")} />
          )}
          <SheetAction icon={Edit3} color="gray" label="编辑" desc="修改目标名称和详情"
            onClick={() => handleAction("edit")} />
          <SheetAction icon={Copy} color="gray" label="复制" desc="创建一个副本目标"
            onClick={() => handleAction("copy")} />
          <button onClick={() => handleAction("delete")}
            className={`flex items-center gap-3 px-3 py-3 rounded-xl transition-colors w-full text-left ${
              confirmDelete ? "bg-red-50 hover:bg-red-100" : "hover:bg-gray-50"
            }`}>
            <div className="w-9 h-9 rounded-full bg-red-100 flex items-center justify-center">
              <Trash2 className="w-5 h-5 text-red-500" />
            </div>
            <div>
              <div className={`text-sm font-medium ${confirmDelete ? "text-red-600" : "text-gray-900"}`}>
                {confirmDelete ? "确认删除？" : "删除"}
              </div>
              <div className="text-xs text-gray-400">
                {confirmDelete ? "再次点击确认删除" : "永久删除此目标"}
              </div>
            </div>
          </button>
        </div>
      </BottomSheet>
    </div>
  );
}

// ─── Sheet 操作按钮 ──────────────────────────────────────────

const ACTION_COLORS: Record<string, string> = {
  emerald: "bg-emerald-100 text-emerald-600",
  orange: "bg-orange-100 text-orange-600",
  blue: "bg-blue-100 text-blue-600",
  gray: "bg-gray-100 text-gray-600",
};

function SheetAction({ icon: Icon, color, label, desc, onClick }: {
  icon: React.ComponentType<{ className?: string }>;
  color: string;
  label: string;
  desc: string;
  onClick: () => void;
}) {
  return (
    <button onClick={onClick}
      className="flex items-center gap-3 px-3 py-3 rounded-xl hover:bg-gray-50 transition-colors w-full text-left">
      <div className={`w-9 h-9 rounded-full flex items-center justify-center ${ACTION_COLORS[color] ?? ""}`}>
        <Icon className="w-5 h-5" />
      </div>
      <div>
        <div className="text-sm font-medium text-gray-900">{label}</div>
        <div className="text-xs text-gray-400">{desc}</div>
      </div>
    </button>
  );
}
