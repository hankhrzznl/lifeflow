"use client";

import { motion } from "framer-motion";

// ============================================================
// 类型
// ============================================================

type KnitStatus = "in-progress" | "partial" | "completed" | "overdue";

interface KnittingProgressProps {
  progress: number; // 0-100
  status?: KnitStatus;
  showLabel?: boolean;
  showYarnBall?: boolean;
  className?: string;
  height?: number;
}

// ============================================================
// 状态颜色
// ============================================================

const statusColors: Record<KnitStatus, string> = {
  "in-progress": "var(--color-knit-thread)",
  partial: "var(--color-knit-partial)",
  completed: "var(--color-knit-done)",
  overdue: "var(--color-warning)",
};

// ============================================================
// 组件
// ============================================================

export default function KnittingProgress({
  progress,
  status = "in-progress",
  showLabel = true,
  showYarnBall = true,
  className = "",
  height = 24,
}: KnittingProgressProps) {
  const clampedProgress = Math.min(100, Math.max(0, progress));
  const isComplete = status === "completed" || clampedProgress >= 100;
  const isOverdue = status === "overdue";
  const displayStatus: KnitStatus = isComplete ? "completed" : isOverdue ? "overdue" : status;

  return (
    <div className={`flex items-center gap-2 ${className}`}>
      {/* 进度条容器 */}
      <div
        className="relative flex-1 overflow-hidden rounded-sm"
        style={{
          height: `${height}px`,
          backgroundColor: "var(--color-knit-bg)",
          backgroundImage: `
            repeating-linear-gradient(
              0deg,
              transparent,
              transparent ${height / 6 - 1}px,
              var(--color-knit-grid) ${height / 6 - 1}px,
              var(--color-knit-grid) ${height / 6}px
            ),
            repeating-linear-gradient(
              90deg,
              transparent,
              transparent ${height / 6 - 1}px,
              var(--color-knit-grid) ${height / 6 - 1}px,
              var(--color-knit-grid) ${height / 6}px
            )
          `,
        }}
      >
        {/* 毛线填充 */}
        <motion.div
          initial={{ width: 0 }}
          animate={{ width: `${clampedProgress}%` }}
          transition={{ duration: 0.6, ease: [0.4, 0, 0.2, 1] }}
          className="absolute inset-y-0 left-0 rounded-sm"
          style={{
            backgroundColor: statusColors[displayStatus],
            backgroundImage: `
              repeating-linear-gradient(
                90deg,
                transparent,
                transparent 2px,
                rgba(255,255,255,0.15) 2px,
                rgba(255,255,255,0.15) 3px
              )
            `,
          }}
        />

        {/* 毛线头 (Yarn Ball) */}
        {showYarnBall && !isComplete && clampedProgress > 0 && (
          <motion.div
            animate={{ y: [0, -2, 0] }}
            transition={{ duration: 2, repeat: Infinity, ease: "easeInOut" }}
            className="absolute top-1/2 -translate-y-1/2 rounded-full border-2 border-white/30 shadow-sm"
            style={{
              width: `${height * 0.5}px`,
              height: `${height * 0.5}px`,
              left: `${clampedProgress}%`,
              marginLeft: `-${height * 0.25}px`,
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
            完成
          </motion.div>
        )}
      </div>

      {/* 百分比 */}
      {showLabel && (
        <span
          className="text-xs font-bold tabular-nums w-10 text-right flex-shrink-0"
          style={{
            fontFamily: "var(--font-display)",
            color: statusColors[displayStatus],
          }}
        >
          {clampedProgress}%
        </span>
      )}
    </div>
  );
}
