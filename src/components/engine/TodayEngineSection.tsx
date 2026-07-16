"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Check, Edit3, Target, Flame, Award, PartyPopper } from "lucide-react";
import { dailyAtomService } from "@/lib/engine/DailyAtomService";
import CheckInModal from "@/components/engine/CheckInModal";
import TodayHabitCard from "@/components/engine/TodayHabitCard";
import { useCheckIn } from "@/components/engine/useCheckIn";
import KnittingProgress from "@/components/ui/KnittingProgress";
import EmptyState from "@/components/ui/EmptyState";
import type { EngineDailyAtom } from "@/lib/engine/types";

// ============================================================
// 组件
// ============================================================

export default function TodayEngineSection() {
  const today = useMemo(() => new Date().toISOString().slice(0, 10), []);
  const todayDisplay = useMemo(() => {
    const d = new Date();
    const days = ["日", "一", "二", "三", "四", "五", "六"];
    return `${d.getFullYear()}年${d.getMonth() + 1}月${d.getDate()}日 星期${days[d.getDay()]}`;
  }, []);

  const [allAtoms, setAllAtoms] = useState<EngineDailyAtom[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editTitle, setEditTitle] = useState("");
  const [modalOpen, setModalOpen] = useState(false);
  const [selectedAtom, setSelectedAtom] = useState<EngineDailyAtom | null>(null);

  const { checkIn, loading: checkInLoading, milestones, clearError } = useCheckIn();

  const loadAtoms = useCallback(async () => {
    setLoading(true);
    try {
      const atoms = await dailyAtomService.listByDate(today);
      const enriched: EngineDailyAtom[] = [];
      for (const atom of atoms) {
        enriched.push(atom);
      }
      setAllAtoms(enriched);
    } catch (err) {
      console.error("[TodayEngine] 加载失败:", err);
    } finally { setLoading(false); }
  }, [today]);

  useEffect(() => { loadAtoms(); }, [loadAtoms]);

  const stats = useMemo(() => {
    const completed = allAtoms.filter((a) => a.isCompleted).length;
    const total = allAtoms.length;
    const overdue = allAtoms.filter((a) => !a.isCompleted && a.status === "overdue").length;
    return { completed, total, overdue, rate: total > 0 ? Math.round((completed / total) * 100) : 0 };
  }, [allAtoms]);

  const handleQuickCheckIn = useCallback(async (atomId: string) => {
    try { await checkIn(atomId, { score: 7 }); await loadAtoms(); } catch {}
  }, [checkIn, loadAtoms]);

  const handleOpenModal = useCallback((atom: EngineDailyAtom) => {
    setSelectedAtom(atom);
    setModalOpen(true);
  }, []);

  const handleCheckInSubmit = useCallback(async (data: {
    score: number; actualQuantity: number; note?: string; checkInTime?: string;
  }) => {
    if (!selectedAtom) return;
    try { await checkIn(selectedAtom.id, data); setModalOpen(false); setSelectedAtom(null); await loadAtoms(); } catch {}
  }, [selectedAtom, checkIn, loadAtoms]);

  const handleStartEdit = useCallback((atom: EngineDailyAtom) => {
    setEditingId(atom.id); setEditTitle(atom.title);
  }, []);

  const handleSaveEdit = useCallback(async () => {
    if (!editingId || !editTitle.trim()) { setEditingId(null); return; }
    await dailyAtomService.update(editingId, { title: editTitle.trim() });
    setEditingId(null); loadAtoms();
  }, [editingId, editTitle, loadAtoms]);

  const showConfetti = milestones.length > 0;

  return (
    <div className="space-y-5">
      {/* 成就动画 */}
      <AnimatePresence>
        {showConfetti && (
          <motion.div
            initial={{ opacity: 0, y: -20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
            className="p-4 rounded-fabric text-center"
            style={{ backgroundColor: "var(--brand-primary-light)", border: "1px solid var(--brand-primary-light)" }}
          >
            <div className="flex items-center justify-center gap-2 mb-1">
              {milestones.some((m) => m.threshold === 100) ? (
                <PartyPopper className="w-5 h-5" style={{ color: "var(--brand-primary)" }} />
              ) : (
                <Award className="w-5 h-5" style={{ color: "var(--brand-primary)" }} />
              )}
              <span className="font-bold text-sm" style={{ color: "var(--brand-secondary)" }}>
                {milestones.some((m) => m.threshold === 100)
                  ? `目标 "${milestones[0].goalTitle}" 已达成 100%！`
                  : milestones.map((m) => `${m.goalTitle} 进度达 ${m.threshold}%！`).join("，")}
              </span>
            </div>
            <p className="text-xs" style={{ color: "var(--brand-secondary)" }}>继续保持，加油！</p>
            <button onClick={() => clearError()} className="mt-2 text-xs underline" style={{ color: "var(--brand-primary)" }}>
              知道了
            </button>
          </motion.div>
        )}
      </AnimatePresence>

      {/* 顶部概览 */}
      <div>
        <h1 className="font-hand font-bold" style={{ fontSize: "var(--text-display)", color: "var(--text-primary)" }}>
          今日任务
        </h1>
        <p className="text-sm mt-0.5" style={{ color: "var(--text-secondary)" }}>{todayDisplay}</p>
      </div>

      {/* 完成度卡片 */}
      <div className="rounded-fabric p-4"
        style={{ backgroundColor: "var(--surface-fabric)", boxShadow: "var(--shadow-knit)" }}>
        <div className="flex items-center justify-between mb-2">
          <span className="text-sm font-medium" style={{ color: "var(--text-secondary)" }}>今日已织</span>
          <span className="text-sm font-bold tabular-nums" style={{ fontFamily: "var(--font-display)", color: "var(--brand-primary)" }}>
            {stats.completed}/{stats.total} 针
          </span>
        </div>
        <KnittingProgress progress={stats.rate} />
        {stats.overdue > 0 && (
          <p className="text-xs mt-1.5" style={{ color: "var(--warning)" }}>{stats.overdue}项逾期</p>
        )}
      </div>

      {/* 原子项列表 */}
      <div>
        <h2 className="text-sm font-semibold mb-2" style={{ color: "var(--text-secondary)" }}>待办事项</h2>
        {loading ? (
          <div className="space-y-2">{[1, 2, 3].map((i) => (<div key={i} className="skeleton h-12 rounded-xl" />))}</div>
        ) : allAtoms.length === 0 ? (
          <EmptyState
            state="waiting"
            title="今天没有要织的任务"
            description="去规划页面安排今天的任务吧"
          />
        ) : (
          <div className="space-y-1">
            {allAtoms.map((atom) => {
              const isPartial = (atom.actualQuantity ?? 0) > 0 && !atom.isCompleted;
              return (
                <div
                  key={atom.id}
                  className="flex items-center gap-3 px-3 py-2.5 rounded-xl transition-colors"
                  style={{
                    backgroundColor: atom.isCompleted ? "rgba(124,169,130,0.06)" :
                                     isPartial ? "rgba(245,197,66,0.06)" : "var(--surface-fabric-hover)",
                    border: atom.isCompleted ? "none" : "1px solid var(--border-light)",
                  }}
                >
                  <button
                    onClick={() => { if (atom.isCompleted) return; handleOpenModal(atom); }}
                    className="w-5 h-5 rounded-md border-2 flex items-center justify-center flex-shrink-0 transition-all active:scale-90"
                    style={{
                      borderColor: atom.isCompleted ? "var(--success)" :
                                   isPartial ? "var(--knit-thread-partial)" : "var(--knit-grid)",
                      backgroundColor: atom.isCompleted ? "var(--success)" : "var(--knit-bg)",
                    }}
                  >
                    {atom.isCompleted && <Check className="w-3 h-3 text-[var(--text-inverse)]" strokeWidth={3} />}
                    {isPartial && <span className="text-[9px] font-bold text-[var(--text-inverse)]">{atom.actualQuantity}</span>}
                  </button>

                  <div className="flex-1 min-w-0">
                    {editingId === atom.id ? (
                      <input type="text" value={editTitle} onChange={(e) => setEditTitle(e.target.value)}
                        onBlur={handleSaveEdit} onKeyDown={(e) => {
                          if (e.key === "Enter") handleSaveEdit();
                          if (e.key === "Escape") setEditingId(null);
                        }}
                        className="w-full text-sm px-2 py-0.5 rounded border focus:outline-none focus:ring-1"
                        style={{ borderColor: "var(--brand-primary)", backgroundColor: "var(--card-bg)", color: "var(--text-primary)" }}
                        autoFocus />
                    ) : (
                      <div className="flex items-center gap-2">
                        <span
                          className="text-sm truncate block"
                          style={{
                            color: atom.isCompleted ? "var(--text-tertiary)" : "var(--text-primary)",
                            textDecoration: atom.isCompleted ? "line-through" : "none",
                          }}
                          onDoubleClick={() => { if (!atom.isCompleted) handleStartEdit(atom); }}
                        >
                          {atom.title}
                        </span>
                        {!atom.isCompleted && (
                          <button onClick={() => handleStartEdit(atom)}>
                            <Edit3 className="w-3 h-3" style={{ color: "var(--text-tertiary)" }} />
                          </button>
                        )}
                      </div>
                    )}
                  </div>

                  {atom.quantity > 1 && (
                    <div className="flex items-center gap-1.5 flex-shrink-0">
                      {atom.isCompleted && (
                        <span className="text-xs font-mono font-medium" style={{
                          color: (atom.actualQuantity ?? 0) >= atom.quantity ? "var(--success)" : "var(--knit-thread-partial)",
                        }}>
                          {atom.actualQuantity ?? 0}/{atom.quantity}
                          {(atom.actualQuantity ?? 0) > atom.quantity && " ↑"}
                        </span>
                      )}
                      <div className="w-12 h-1 rounded-full overflow-hidden" style={{ backgroundColor: "var(--knit-bg)" }}>
                        <div
                          className="h-full rounded-full"
                          style={{
                            width: atom.isCompleted ? `${Math.min(100, ((atom.actualQuantity ?? 1) / atom.quantity) * 100)}%` : "0%",
                            backgroundColor: atom.isCompleted ? ((atom.actualQuantity ?? 0) > atom.quantity ? "var(--success)" : "var(--knit-thread-partial)") : "transparent",
                          }}
                        />
                      </div>
                    </div>
                  )}

                  {atom.isCompleted && atom.score && (
                    <span className="text-xs font-medium flex-shrink-0" style={{ color: "var(--warning)" }}>{atom.score}/10</span>
                  )}

                  <span className="text-[10px] px-1.5 py-0.5 rounded font-medium flex-shrink-0" style={{
                    color: atom.isCompleted ? "var(--success)" : atom.status === "overdue" ? "var(--warning)" : "var(--text-tertiary)",
                    backgroundColor: atom.isCompleted ? "var(--success-light)" : atom.status === "overdue" ? "var(--warning-light)" : "var(--knit-bg)",
                  }}>
                    {atom.isCompleted ? "织完" : atom.status === "overdue" ? "逾期" : "待织"}
                  </span>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* 底部汇总 */}
      {allAtoms.length > 0 && (
        <p className="text-sm text-center py-4" style={{ color: "var(--text-tertiary)" }}>
          今日还有 {stats.total - stats.completed} 针待织
        </p>
      )}

      <CheckInModal open={modalOpen} atomId={selectedAtom?.id ?? ""}
        atomTitle={selectedAtom?.title ?? ""} targetQuantity={selectedAtom?.quantity ?? 1} quantityUnit="次"
        defaultScore={selectedAtom?.score ?? 7} lastNote={selectedAtom?.note}
        onCheckIn={handleCheckInSubmit} onClose={() => { setModalOpen(false); setSelectedAtom(null); }}
        loading={checkInLoading} />
    </div>
  );
}
