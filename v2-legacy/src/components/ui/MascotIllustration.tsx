"use client";

import { motion } from "framer-motion";
import { Clock, Loader, Check, AlertCircle, Sparkles } from "lucide-react";
import type { LucideIcon } from "lucide-react";

// ============================================================
// 类型
// ============================================================

type MascotState = "waiting" | "knitting" | "completed" | "confused" | "celebrating";

interface AppAvatarProps {
  state?: MascotState;
  size?: number;
  className?: string;
  color?: string;
  icon?: string;
}

// ============================================================
// 映射
// ============================================================

const stateIconMap: Record<MascotState, LucideIcon> = {
  waiting: Clock,
  knitting: Loader,
  completed: Check,
  confused: AlertCircle,
  celebrating: Sparkles,
};

function lighterColor(hex: string): string {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  const t = 0.6;
  const rr = Math.round(r + (255 - r) * t);
  const gg = Math.round(g + (255 - g) * t);
  const bb = Math.round(b + (255 - b) * t);
  return `rgb(${rr},${gg},${bb})`;
}

// ============================================================
// AppAvatar
// ============================================================

export function AppAvatar({
  state = "waiting",
  size = 120,
  className = "",
  color = "#5856D6",
  icon: _icon,
}: AppAvatarProps) {
  const Icon = stateIconMap[state];
  const gradient = `linear-gradient(135deg, ${color}, ${lighterColor(color)})`;
  const iconSize = Math.round(size * 0.45);

  return (
    <motion.div
      initial={{ scale: 0, opacity: 0 }}
      animate={{ scale: 1, opacity: 1 }}
      transition={{ type: "spring", stiffness: 260, damping: 20 }}
      className={className}
      style={{
        width: size,
        height: size,
        borderRadius: "50%",
        background: gradient,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      {state === "knitting" ? (
        <motion.div
          animate={{ rotate: 360 }}
          transition={{ duration: 1.5, repeat: Infinity, ease: "linear" }}
          style={{ display: "flex" }}
        >
          <Icon size={iconSize} color="white" />
        </motion.div>
      ) : (
        <Icon size={iconSize} color="white" />
      )}
    </motion.div>
  );
}

// ============================================================
// MascotIllustration — 保持向后兼容
// ============================================================

export default function MascotIllustration(props: AppAvatarProps) {
  return <AppAvatar {...props} />;
}

export type { MascotState, AppAvatarProps as MascotIllustrationProps };
