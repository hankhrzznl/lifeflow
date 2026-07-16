"use client";

import { motion } from "framer-motion";

// ============================================================
// 类型
// ============================================================

type MascotState = "waiting" | "knitting" | "completed" | "confused" | "celebrating";

interface MascotIllustrationProps {
  state?: MascotState;
  size?: number;
  className?: string;
}

// ============================================================
// 组件 — 纯 CSS 手绘小狐狸
// ============================================================

export default function MascotIllustration({
  state = "waiting",
  size = 120,
  className = "",
}: MascotIllustrationProps) {
  const s = size;
  const primaryColor = "#E88D67";
  const secondaryColor = "#8B6F5E";

  return (
    <motion.div
      animate={state === "knitting" ? { y: [0, -3, 0] } : {}}
      transition={{ duration: 1.5, repeat: state === "knitting" ? Infinity : 0, ease: "easeInOut" }}
      className={`relative inline-block ${className}`}
      style={{ width: s, height: s }}
    >
      <svg width={s} height={s} viewBox="0 0 120 120" fill="none" xmlns="http://www.w3.org/2000/svg">
        {/* 身体 */}
        <ellipse cx="60" cy="80" rx="28" ry="22" fill={primaryColor} opacity="0.15" />
        <ellipse cx="60" cy="78" rx="26" ry="20" stroke={secondaryColor} strokeWidth="2" fill="none"
          strokeDasharray="3 2" opacity="0.6" />

        {/* 头部 */}
        <circle cx="60" cy="48" r="22" fill={primaryColor} opacity="0.12" />
        <circle
          cx="60" cy="48" r="20"
          stroke={secondaryColor} strokeWidth="2" fill="none"
          strokeDasharray="4 2" opacity="0.7"
          style={{ transform: state === "waiting" ? "rotate(10deg)" : undefined, transformOrigin: "60px 48px" }}
        />

        {/* 耳朵 */}
        <polygon points="40,30 34,12 48,25" fill={primaryColor} opacity="0.18" />
        <polygon points="40,30 34,12 48,25" stroke={secondaryColor} strokeWidth="2" fill="none" strokeDasharray="2 2" opacity="0.6" />
        <polygon points="80,30 86,12 72,25" fill={primaryColor} opacity="0.18" />
        <polygon points="80,30 86,12 72,25" stroke={secondaryColor} strokeWidth="2" fill="none" strokeDasharray="2 2" opacity="0.6" />

        {/* 眼睛 */}
        <circle cx="53" cy="45" r="3" fill={secondaryColor} opacity="0.8" />
        <circle cx="67" cy="45" r="3" fill={secondaryColor} opacity="0.8" />
        <circle cx="52" cy="44" r="1" fill="white" opacity="0.7" />
        <circle cx="66" cy="44" r="1" fill="white" opacity="0.7" />

        {/* 鼻子 */}
        <ellipse cx="60" cy="51" rx="3" ry="2" fill={primaryColor} />

        {/* 嘴巴 */}
        {state === "confused" ? (
          <path d="M55 54 Q60 52 65 54" stroke={secondaryColor} strokeWidth="1.5" fill="none" opacity="0.7" />
        ) : state === "celebrating" ? (
          <path d="M55 53 Q60 57 65 53" stroke={secondaryColor} strokeWidth="1.5" fill="none" opacity="0.7" />
        ) : (
          <path d="M56 53 Q60 55 64 53" stroke={secondaryColor} strokeWidth="1.5" fill="none" opacity="0.7" />
        )}

        {/* 毛线针手臂 */}
        <motion.g
          animate={state === "knitting" ? { rotate: [0, 5, -5, 0] } : {}}
          transition={{ duration: 1, repeat: state === "knitting" ? Infinity : 0 }}
        >
          <line x1="40" y1="62" x2="55" y2="70" stroke={secondaryColor} strokeWidth="2.5" strokeLinecap="round" />
          <line x1="80" y1="62" x2="65" y2="70" stroke={secondaryColor} strokeWidth="2.5" strokeLinecap="round" />
        </motion.g>

        {/* 毛线 */}
        {state === "knitting" && (
          <>
            <motion.path d="M38 60 Q30 75 45 78 Q55 80 50 65" stroke="#F5C542" strokeWidth="2" fill="none" strokeDasharray="3 2"
              animate={{ pathLength: [0.3, 0.7, 0.3] }} transition={{ duration: 2, repeat: Infinity }} />
            <motion.path d="M82 60 Q90 75 75 78 Q65 80 70 65" stroke="#E88D67" strokeWidth="2" fill="none" strokeDasharray="3 2"
              animate={{ pathLength: [0.7, 0.3, 0.7] }} transition={{ duration: 2, repeat: Infinity, delay: 0.5 }} />
          </>
        )}

        {/* waiting: 缠绕线条 */}
        {state === "waiting" && (
          <>
            <motion.path d="M35 75 Q40 60 55 70 Q70 80 55 88 Q40 82 45 72"
              stroke={secondaryColor} strokeWidth="1.5" fill="none" strokeDasharray="2 2" opacity="0.5"
              animate={{ rotate: [0, 10, -10, 0] }} transition={{ duration: 3, repeat: Infinity }} />
          </>
        )}

        {/* 毛线团 */}
        <motion.circle cx="30" cy="85" r="6" fill={primaryColor} opacity="0.2"
          stroke={primaryColor} strokeWidth="2" strokeDasharray="2 2"
          animate={{ rotate: 360 }} transition={{ duration: 6, repeat: Infinity, ease: "linear" }} />

        {/* completed: 举起的花布 */}
        {state === "completed" && (
          <motion.g initial={{ scale: 0 }} animate={{ scale: 1 }} transition={{ type: "spring" }}>
            <rect x="48" y="28" width="24" height="16" rx="2" fill="#7CA982" opacity="0.3"
              stroke="#7CA982" strokeWidth="1.5" strokeDasharray="3 2" transform="rotate(-5 60 36)" />
            <text x="53" y="41" fontSize="8" fill="#7CA982" fontFamily="var(--font-display)" opacity="0.8">✓</text>
          </motion.g>
        )}

        {/* celebrating: 彩带 */}
        {state === "celebrating" && (
          <>
            {[0, 1, 2, 3, 4].map((i) => (
              <motion.circle key={i}
                r={2 + Math.random() * 2}
                fill={["#E88D67", "#7CA982", "#F5C542", "#7BA3C7", "#D4736E"][i]}
                initial={{ x: 35 + i * 12, y: 10, opacity: 0 }}
                animate={{ y: [10, 30, 50], opacity: [1, 1, 0], x: [35 + i * 12, 40 + i * 10, 45 + i * 8] }}
                transition={{ duration: 1.5, delay: i * 0.2, repeat: Infinity, repeatDelay: 0.5 }} />
            ))}
          </>
        )}

        {/* confused: 挠头 + 断线 */}
        {state === "confused" && (
          <>
            <line x1="40" y1="30" x2="45" y2="22" stroke={secondaryColor} strokeWidth="2.5" strokeLinecap="round" />
            <path d="M68 64 L68 68" stroke={secondaryColor} strokeWidth="1.5" strokeDasharray="2 2" />
            <text x="62" y="74" fontSize="8" fill={secondaryColor} opacity="0.6" fontFamily="var(--font-display)">?</text>
          </>
        )}
      </svg>
    </motion.div>
  );
}

export type { MascotState, MascotIllustrationProps };
