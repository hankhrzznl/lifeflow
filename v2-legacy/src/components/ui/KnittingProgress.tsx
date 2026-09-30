"use client";

import { motion } from "framer-motion";

// ============================================================
// 类型
// ============================================================

interface AppleProgressProps {
  progress: number; // 0-100
  color?: string;
  size?: "sm" | "md" | "lg";
  showPercentage?: boolean;
  variant?: "linear" | "ring";
  className?: string;
}

// ============================================================
// 常量
// ============================================================

const defaultColor = "#5856D6";
const trackColor = "#E9E9EB";

const linearSizeMap: Record<NonNullable<AppleProgressProps["size"]>, number> = {
  sm: 3,
  md: 4,
  lg: 6,
};

const ringSizeMap: Record<NonNullable<AppleProgressProps["size"]>, number> = {
  sm: 24,
  md: 40,
  lg: 60,
};

const ringStrokeWidth = 8;

// ============================================================
// 子组件
// ============================================================

function LinearProgress({
  progress,
  color,
  size,
}: {
  progress: number;
  color: string;
  size: "sm" | "md" | "lg";
}) {
  const h = linearSizeMap[size];

  return (
    <div
      className="flex-1 rounded-full overflow-hidden"
      style={{ height: h, backgroundColor: trackColor }}
    >
      <motion.div
        initial={{ width: 0 }}
        animate={{ width: `${progress}%` }}
        transition={{ duration: 0.4, ease: [0.25, 0.1, 0.25, 1] }}
        className="h-full rounded-full"
        style={{ backgroundColor: color }}
      />
    </div>
  );
}

function RingProgress({
  progress,
  color,
  size,
}: {
  progress: number;
  color: string;
  size: "sm" | "md" | "lg";
}) {
  const dim = ringSizeMap[size];
  const radius = (dim - ringStrokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (progress / 100) * circumference;

  return (
    <svg
      width={dim}
      height={dim}
      viewBox={`0 0 ${dim} ${dim}`}
      className="flex-shrink-0"
      style={{ transform: "rotate(-90deg)" }}
    >
      {/* 背景圆 */}
      <circle
        cx={dim / 2}
        cy={dim / 2}
        r={radius}
        fill="none"
        stroke={trackColor}
        strokeWidth={ringStrokeWidth}
      />
      {/* 进度圆 */}
      <motion.circle
        cx={dim / 2}
        cy={dim / 2}
        r={radius}
        fill="none"
        stroke={color}
        strokeWidth={ringStrokeWidth}
        strokeLinecap="round"
        strokeDasharray={circumference}
        initial={{ strokeDashoffset: circumference }}
        animate={{ strokeDashoffset: offset }}
        transition={{ duration: 0.6, ease: [0.25, 0.1, 0.25, 1] }}
      />
    </svg>
  );
}

// ============================================================
// 主组件
// ============================================================

function AppleProgress({
  progress,
  color = defaultColor,
  size = "md",
  showPercentage = true,
  variant = "linear",
  className = "",
}: AppleProgressProps) {
  const clamped = Math.min(100, Math.max(0, progress));

  if (variant === "ring") {
    return (
      <div className={`inline-flex items-center gap-2 ${className}`}>
        <RingProgress progress={clamped} color={color} size={size} />
        {showPercentage && (
          <span className="text-sm font-semibold tabular-nums text-neutral-700">
            {clamped}%
          </span>
        )}
      </div>
    );
  }

  return (
    <div className={`flex items-center gap-2 ${className}`}>
      <LinearProgress progress={clamped} color={color} size={size} />
      {showPercentage && (
        <span className="text-xs font-semibold tabular-nums w-10 text-right flex-shrink-0 text-neutral-500">
          {clamped}%
        </span>
      )}
    </div>
  );
}

// ============================================================
// 导出
// ============================================================

export default AppleProgress;
export { AppleProgress, AppleProgress as KnittingProgress };
export type { AppleProgressProps };
