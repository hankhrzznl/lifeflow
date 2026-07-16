"use client";

import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X, Check } from "lucide-react";

// ============================================================
// 类型
// ============================================================

export interface CheckInModalProps {
  open: boolean;
  atomId: string;
  atomTitle: string;
  targetQuantity: number;
  quantityUnit?: string;
  defaultScore?: number;
  lastNote?: string;
  onCheckIn: (data: {
    score: number;
    actualQuantity: number;
    note?: string;
    checkInTime?: string;
  }) => void;
  onClose: () => void;
  loading?: boolean;
}

// ============================================================
// 编织风格评分按钮
// ============================================================

function KnitRatingButton({
  value,
  selected,
  onSelect,
}: {
  value: number;
  selected: boolean;
  onSelect: (v: number) => void;
}) {
  return (
    <button
      onClick={() => onSelect(value)}
      className="w-9 h-9 rounded-full border-2 flex items-center justify-center text-xs font-bold transition-all duration-150 active:scale-90"
      style={{
        borderColor: selected ? "var(--color-knit-thread)" : "var(--color-border)",
        backgroundColor: selected ? "var(--color-brand-primary-light)" : "transparent",
        color: selected ? "var(--color-brand-primary)" : "var(--color-text-tertiary)",
        boxShadow: selected ? "0 2px 0 var(--color-knit-grid)" : "none",
      }}
    >
      {value}
    </button>
  );
}

// ============================================================
// 组件
// ============================================================

export default function CheckInModal({
  open,
  atomId,
  atomTitle,
  targetQuantity,
  quantityUnit = "次",
  defaultScore,
  lastNote,
  onCheckIn,
  onClose,
  loading = false,
}: CheckInModalProps) {
  const [score, setScore] = useState(defaultScore ?? 7);
  const [actualQty, setActualQty] = useState(targetQuantity);
  const [note, setNote] = useState("");
  const [time, setTime] = useState("");

  useEffect(() => {
    if (open) {
      setScore(defaultScore ?? 7);
      setActualQty(targetQuantity);
      setNote("");
      const now = new Date();
      setTime(`${String(now.getHours()).padStart(2, "0")}:${String(now.getMinutes()).padStart(2, "0")}`);
    }
  }, [open, defaultScore, targetQuantity]);

  const handleSubmit = () => {
    const [h, m] = time.split(":").map(Number);
    const dt = new Date();
    dt.setHours(h || 0, m || 0, 0, 0);
    onCheckIn({ score, actualQuantity: actualQty, note: note.trim() || undefined, checkInTime: dt.toISOString() });
  };

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-50 flex items-center justify-center px-4"
          style={{ backgroundColor: "rgba(61, 52, 46, 0.4)" }}
          onClick={onClose}
        >
          <motion.div
            initial={{ scale: 0.95, opacity: 0, y: 20 }}
            animate={{ scale: 1, opacity: 1, y: 0 }}
            exit={{ scale: 0.95, opacity: 0, y: 20 }}
            transition={{ type: "spring", damping: 25 }}
            onClick={(e) => e.stopPropagation()}
            className="relative w-full max-w-sm max-h-[90dvh] overflow-y-auto rounded-2xl p-6"
            style={{
              backgroundColor: "var(--card-bg)",
              boxShadow: "var(--shadow-modal)",
            }}
          >
            {/* 透明胶带装饰 */}
            <div
              className="absolute -top-3 left-6 w-16 h-6 rounded-sm"
              style={{
                background: "linear-gradient(180deg, rgba(232,221,212,0.85), rgba(212,197,181,0.9))",
                transform: "rotate(-3deg)",
              }}
            />

            {/* 标题 */}
            <div className="flex items-center justify-between mb-5">
              <div>
                <h2
                  className="text-lg font-bold"
                  style={{ fontFamily: "var(--font-display)", color: "var(--color-text-primary)" }}
                >
                  今天织了哪一针？
                </h2>
                <p className="text-xs text-[var(--color-text-secondary)] mt-0.5 truncate max-w-[220px]">
                  {atomTitle}
                </p>
              </div>
              <button
                onClick={onClose}
                className="w-8 h-8 flex items-center justify-center rounded-lg transition-colors"
                style={{ color: "var(--color-text-tertiary)" }}
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* 心情评分 */}
            <div className="mb-5">
              <label className="block text-sm font-medium mb-2" style={{ color: "var(--color-text-secondary)" }}>
                完成感受
              </label>
              <div className="flex items-center gap-1">
                {Array.from({ length: 10 }, (_, i) => i + 1).map((s) => (
                  <KnitRatingButton key={s} value={s} selected={s <= score} onSelect={setScore} />
                ))}
              </div>
              <p className="text-xs mt-1.5" style={{ color: "var(--color-text-tertiary)" }}>
                {score <= 3 ? "还需要练习呢" : score <= 6 ? "中规中矩的一针" : score <= 8 ? "渐入佳境！" : "完美的一针！"}
                {" · "}{score}/10
              </p>
            </div>

            {/* 完成量 */}
            <div className="mb-5">
              <label className="block text-sm font-medium mb-2" style={{ color: "var(--color-text-secondary)" }}>
                完成量
              </label>
              <div className="flex items-center gap-2">
                <input
                  type="number"
                  value={actualQty}
                  onChange={(e) => setActualQty(Number(e.target.value))}
                  className="w-24 px-3 py-2 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[var(--color-brand-primary)]"
                  style={{
                    backgroundColor: "var(--color-surface-fabric)",
                    border: "1px solid var(--color-border)",
                    color: "var(--color-text-primary)",
                  }}
                  min={0}
                />
                <span className="text-sm" style={{ color: "var(--color-text-tertiary)" }}>
                  / {targetQuantity} {quantityUnit}
                </span>
                {actualQty >= targetQuantity && (
                  <span className="text-xs font-medium text-[var(--color-success)]">
                    {actualQty > targetQuantity ? "超额完成!" : "达标"}
                  </span>
                )}
              </div>
            </div>

            {/* 备注 */}
            <div className="mb-5">
              <label className="block text-sm font-medium mb-2" style={{ color: "var(--color-text-secondary)" }}>
                备注（可选）
              </label>
              <textarea
                value={note}
                onChange={(e) => setNote(e.target.value)}
                placeholder="今天织布的心情..."
                rows={2}
                className="w-full px-3 py-2 rounded-lg text-sm resize-none focus:outline-none focus:ring-2 focus:ring-[var(--color-brand-primary)]"
                style={{
                  backgroundColor: "var(--color-surface-fabric)",
                  border: "1px solid var(--color-border)",
                  color: "var(--color-text-primary)",
                }}
              />
            </div>

            {/* 时间 */}
            <div className="mb-6">
              <label className="block text-sm font-medium mb-2" style={{ color: "var(--color-text-secondary)" }}>
                完成时间
              </label>
              <input
                type="time"
                value={time}
                onChange={(e) => setTime(e.target.value)}
                className="w-full px-3 py-2 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[var(--color-brand-primary)]"
                style={{
                  backgroundColor: "var(--color-surface-fabric)",
                  border: "1px solid var(--color-border)",
                  color: "var(--color-text-primary)",
                }}
              />
            </div>

            {/* 按钮 */}
            <div className="flex gap-3">
              <button
                onClick={onClose}
                className="flex-1 py-2.5 rounded-lg border text-sm font-medium transition-colors"
                style={{
                  backgroundColor: "transparent",
                  borderColor: "var(--color-brand-secondary)",
                  color: "var(--color-brand-secondary)",
                }}
              >
                取消
              </button>
              <button
                onClick={handleSubmit}
                disabled={loading}
                className="flex-1 py-2.5 rounded-lg text-sm font-bold transition-all duration-150 active:scale-[0.97] flex items-center justify-center gap-1.5 disabled:opacity-50"
                style={{
                  backgroundColor: "var(--color-brand-primary)",
                  color: "var(--color-text-inverse)",
                  fontFamily: "var(--font-display)",
                }}
              >
                <Check className="w-4 h-4" />
                {loading ? "织布中..." : "织完这一针"}
              </button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
