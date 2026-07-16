"use client";

import type { ReactNode } from "react";
import MascotIllustration from "./MascotIllustration";
import type { MascotState } from "./MascotIllustration";

// ============================================================
// 类型
// ============================================================

interface EmptyStateProps {
  state?: "waiting" | "completed" | "confused";
  title?: string;
  description?: string;
  actionLabel?: string;
  onAction?: () => void;
  children?: ReactNode;
}

// ============================================================
// 默认文案
// ============================================================

const defaults = {
  waiting: { title: "还没开始织呢", desc: "点击下方的线团，开始你的第一块布料吧" },
  completed: { title: "太棒了！", desc: "这块布料织完了，开始下一块吧" },
  confused: { title: "线缠住了...", desc: "出了点小问题，刷新试试" },
};

// ============================================================
// 组件
// ============================================================

export default function EmptyState({
  state = "waiting",
  title,
  description,
  actionLabel,
  onAction,
  children,
}: EmptyStateProps) {
  const d = defaults[state];
  const t = title ?? d.title;
  const desc = description ?? d.desc;

  return (
    <div className="flex flex-col items-center justify-center py-16 px-6 text-center">
      <div className="mb-4">
        <MascotIllustration state={state} size={120} />
      </div>
      <h3
        className="text-lg font-bold mb-1.5"
        style={{ fontFamily: "var(--font-display)", color: "var(--text-primary)" }}
      >
        {t}
      </h3>
      <p
        className="text-sm max-w-xs mb-6 leading-relaxed"
        style={{ color: "var(--text-secondary)" }}
      >
        {desc}
      </p>
      {actionLabel && onAction && (
        <button
          onClick={onAction}
          className="px-6 py-2.5 rounded-md text-sm font-medium transition-all active:scale-[0.97]"
          style={{ backgroundColor: "var(--brand-primary)", color: "var(--text-inverse)" }}
        >
          {actionLabel}
        </button>
      )}
      {children}
    </div>
  );
}
