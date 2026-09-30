"use client";

import type { ReactNode } from "react";

// ============================================================
// WovenCard — 编织纹理卡片
// ============================================================

interface WovenCardProps {
  children: ReactNode;
  className?: string;
  onClick?: () => void;
  hoverable?: boolean;
}

export function WovenCard({ children, className = "", onClick, hoverable = false }: WovenCardProps) {
  return (
    <div
      onClick={onClick}
      className={[
        "rounded-2xl border-0 p-4 transition-all duration-200",
        "bg-[var(--card-bg)]",
        "shadow-[0_2px_0_#C4B5A5]",
        hoverable
          ? "cursor-pointer hover:shadow-[0_4px_0_#C4B5A5] hover:-translate-y-0.5 active:translate-y-0 active:shadow-[0_1px_0_#C4B5A5]"
          : "",
        className,
      ].join(" ")}
    >
      {children}
    </div>
  );
}

// ============================================================
// StatCard
// ============================================================

interface StatCardProps {
  icon: ReactNode;
  label: string;
  value: string | number;
  sub?: string;
  color?: string;
  className?: string;
}

export function StatCard({
  icon,
  label,
  value,
  sub,
  color = "var(--color-brand-primary)",
  className = "",
}: StatCardProps) {
  return (
    <div
      className={`rounded-2xl border-0 p-4 shadow-[0_2px_0_#C4B5A5] ${className}`}
      style={{ backgroundColor: "var(--card-bg)" }}
    >
      <div className="flex items-center gap-2 mb-2">
        <div
          className="w-8 h-8 rounded-lg flex items-center justify-center"
          style={{ backgroundColor: `${color}18` }}
        >
          <div style={{ color }} className="w-4 h-4 flex items-center justify-center">
            {icon}
          </div>
        </div>
        <span className="text-xs text-[var(--color-text-secondary)]">{label}</span>
      </div>
      <p
        className="text-2xl font-bold"
        style={{ fontFamily: "var(--font-display)", color: "var(--color-text-primary)" }}
      >
        {value}
      </p>
      {sub && <p className="text-[10px] text-[var(--color-text-tertiary)] mt-0.5">{sub}</p>}
    </div>
  );
}
