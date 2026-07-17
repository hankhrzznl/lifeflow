"use client";

import { motion } from "framer-motion";

// ============================================================
// 类型
// ============================================================

export interface ProgressBarProps {
  value: number; // 0-100
  color?: string; // default "#5856D6"
  size?: "sm" | "md" | "lg"; // 3px/4px/6px height
  showLabel?: boolean;
  className?: string;
}

// ============================================================
// 尺寸映射
// ============================================================

const sizeMap: Record<"sm" | "md" | "lg", string> = {
  sm: "h-[3px]",
  md: "h-1",
  lg: "h-1.5",
};

// ============================================================
// 组件
// ============================================================

function ProgressBar({
  value,
  color = "#5856D6",
  size = "md",
  showLabel = false,
  className = "",
}: ProgressBarProps) {
  const clamped = Math.max(0, Math.min(100, value));

  return (
    <div className={`flex items-center gap-3 ${className}`}>
      {/* 轨道 */}
      <div className={`flex-1 rounded-full bg-[#E9E9EB] ${sizeMap[size]} overflow-hidden`}>
        <motion.div
          className={`h-full rounded-full`}
          style={{ backgroundColor: color }}
          initial={{ width: "0%" }}
          animate={{ width: `${clamped}%` }}
          transition={{ type: "spring", stiffness: 200, damping: 25, mass: 0.6 }}
        />
      </div>

      {/* 标签 */}
      {showLabel && (
        <span className="text-xs font-medium text-gray-500 min-w-[2.5rem] text-right">
          {Math.round(clamped)}%
        </span>
      )}
    </div>
  );
}

// ============================================================
// 导出
// ============================================================

export default ProgressBar;
export { ProgressBar };
