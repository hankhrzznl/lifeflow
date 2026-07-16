"use client";

import { motion } from "framer-motion";
import MascotIllustration from "./MascotIllustration";
import type { MascotState } from "./MascotIllustration";

// ============================================================
// 类型
// ============================================================

interface EmptyStateProps {
  title: string;
  description?: string;
  actionLabel?: string;
  onAction?: () => void;
  mascotState?: MascotState;
  illustration?: React.ReactNode;
  className?: string;
}

// ============================================================
// 组件
// ============================================================

export default function EmptyState({
  title,
  description,
  actionLabel,
  onAction,
  mascotState = "idle",
  illustration,
  className = "",
}: EmptyStateProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, ease: "easeOut" }}
      className={`flex flex-col items-center justify-center py-16 px-6 text-center ${className}`}
    >
      {/* 插画 */}
      {illustration ?? (
        <div className="mb-4">
          <MascotIllustration state={mascotState} size={120} />
        </div>
      )}

      {/* 手写标题 */}
      <h3
        className="text-lg font-bold mb-1.5 text-[var(--color-text-primary)]"
        style={{ fontFamily: "var(--font-display)" }}
      >
        {title}
      </h3>

      {/* 正文 */}
      {description && (
        <p className="text-sm text-[var(--color-text-secondary)] max-w-xs mb-6 leading-relaxed">
          {description}
        </p>
      )}

      {/* 操作按钮 */}
      {actionLabel && onAction && (
        <button
          onClick={onAction}
          className="px-6 py-2.5 rounded-[var(--radius-md)] text-sm font-medium transition-all duration-150 active:scale-[0.97]"
          style={{
            backgroundColor: "var(--color-brand-primary)",
            color: "var(--color-text-inverse)",
          }}
        >
          {actionLabel}
        </button>
      )}
    </motion.div>
  );
}
