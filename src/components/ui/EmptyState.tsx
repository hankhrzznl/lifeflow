"use client";

import type { ReactNode } from "react";
import { Inbox, CheckCircle, AlertCircle } from "lucide-react";

// ============================================================
// 类型
// ============================================================

interface EmptyStateProps {
  icon?: React.ReactNode;
  state?: "waiting" | "completed" | "confused";
  title?: string;
  description?: string;
  actionLabel?: string;
  onAction?: () => void;
  children?: ReactNode;
}

// ============================================================
// 状态 → 默认图标映射
// ============================================================

function DefaultIcon({ state }: { state: "waiting" | "completed" | "confused" }) {
  const cls = "w-12 h-12";
  const c = "var(--color-text-quat, #C7C7CC)";
  switch (state) {
    case "waiting":
      return <Inbox className={cls} style={{ color: c }} strokeWidth={1.5} />;
    case "completed":
      return <CheckCircle className={cls} style={{ color: c }} strokeWidth={1.5} />;
    case "confused":
      return <AlertCircle className={cls} style={{ color: c }} strokeWidth={1.5} />;
  }
}

// ============================================================
// 默认文案
// ============================================================

const defaults = {
  waiting: { title: "暂无内容", desc: "点击下方按钮开始添加" },
  completed: { title: "全部完成", desc: "太棒了，继续加油" },
  confused: { title: "出了点问题", desc: "请刷新页面重试" },
};

// ============================================================
// 组件
// ============================================================

export default function EmptyState({
  icon,
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
      <div className="mb-5">
        {icon ?? <DefaultIcon state={state} />}
      </div>
      <h3
        className="text-lg font-semibold mb-1.5"
        style={{ color: "var(--text-primary)" }}
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
          className="rounded-full px-6 py-2.5 text-sm font-medium text-white transition-all active:scale-[0.97]"
          style={{ backgroundColor: "var(--color-sys-indigo)" }}
        >
          {actionLabel}
        </button>
      )}
      {children}
    </div>
  );
}
