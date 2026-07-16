"use client";

import { motion } from "framer-motion";

// ============================================================
// 类型
// ============================================================

type KnitStatus = "active" | "partial" | "completed" | "overdue";

interface KnittingProgressProps {
  progress: number; // 0-100
  status?: KnitStatus;
  showPercentage?: boolean;
  size?: "sm" | "md" | "lg";
  className?: string;
}

// ============================================================
// 状态颜色
// ============================================================

const statusColors: Record<KnitStatus, string> = {
  active: "var(--knit-thread)",
  partial: "var(--knit-thread-partial)",
  completed: "var(--knit-thread-completed)",
  overdue: "var(--warning)",
};

const sizeMap: Record<NonNullable<KnittingProgressProps["size"]>, number> = {
  sm: 12,
  md: 20,
  lg: 28,
};

// ============================================================
// 组件
// ============================================================

export default function KnittingProgress({
  progress,
  status = "active",
  showPercentage = true,
  size = "md",
  className = "",
}: KnittingProgressProps) {
  const clamped = Math.min(100, Math.max(0, progress));
  const h = sizeMap[size];
  const isComplete = status === "completed" || clamped >= 100;
  const displayStatus: KnitStatus = isComplete ? "completed" : status;

  return (
    <div className={`flex items-center gap-2 ${className}`} style={{ height: h }}>
      {/* 编织网格底层 */}
      <div
        className="relative flex-1 rounded-md overflow-hidden"
        style={{
          height: h,
          background: `repeating-linear-gradient(
            90deg,
            var(--knit-bg) 0px,
            var(--knit-bg) 8px,
            var(--knit-grid) 8px,
            var(--knit-grid) 9px
          )`,
        }}
      >
        {/* 毛线填充 */}
        <motion.div
          initial={{ width: 0 }}
          animate={{ width: `${clamped}%` }}
          transition={{ duration: 0.5, ease: "easeInOut" }}
          className="absolute inset-y-0 left-0 rounded-md"
          style={{ backgroundColor: statusColors[displayStatus] }}
        />

        {/* 毛线头 */}
        {!isComplete && clamped > 0 && clamped < 100 && (
          <motion.div
            animate={{ y: ["-50%", "-60%", "-50%"] }}
            transition={{ duration: 1, repeat: Infinity, ease: "easeInOut" }}
            className="absolute top-1/2 rounded-full border border-white/30"
            style={{
              width: h * 0.55,
              height: h * 0.55,
              left: `${clamped}%`,
              marginLeft: `-${h * 0.27}px`,
              backgroundColor: statusColors[displayStatus],
            }}
          />
        )}

        {/* 完成印章 */}
        {isComplete && (
          <motion.div
            initial={{ scale: 0, rotate: -15 }}
            animate={{ scale: 1, rotate: 0 }}
            transition={{ type: "spring", duration: 0.5 }}
            className="absolute right-1 top-1/2 -translate-y-1/2 text-[10px] font-bold text-white/90 px-1.5 py-0.5 rounded-full border border-white/40"
            style={{ fontFamily: "var(--font-display)" }}
          >
            织完
          </motion.div>
        )}
      </div>

      {/* 百分比 */}
      {showPercentage && (
        <span
          className="text-xs font-bold tabular-nums w-10 text-right flex-shrink-0 font-hand"
          style={{ color: statusColors[displayStatus] }}
        >
          {clamped}%
        </span>
      )}
    </div>
  );
}

export type { KnitStatus, KnittingProgressProps };
