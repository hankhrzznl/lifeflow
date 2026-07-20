"use client";

import { useRouter } from "next/navigation";
import { ChevronLeft, Circle, Pill, Plus } from "lucide-react";

// ============================================================
// 吃药 — 用药提醒
// ============================================================

const MEDICATION_SLOTS = [
  { label: "早晨", time: "08:00" },
  { label: "中午", time: "12:00" },
  { label: "晚上", time: "18:00" },
  { label: "睡前", time: "22:00" },
];

export default function MedicationPage() {
  const router = useRouter();

  return (
    <div className="px-4 pt-4 pb-16">
      {/* Header */}
      <header className="mb-6 flex items-center gap-3">
        <button
          onClick={() => router.back()}
          className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-xl"
          style={{ background: "var(--lifeflow-muted)" }}
          aria-label="返回"
        >
          <ChevronLeft className="h-5 w-5" style={{ color: "var(--lifeflow-foreground)" }} />
        </button>
        <h1
          className="text-[17px] font-semibold leading-[1.3] tracking-[-0.018em] truncate"
          style={{ color: "var(--lifeflow-foreground)" }}
        >
          吃药
        </h1>
      </header>

      {/* Today Section Card */}
      <section
        className="mb-4 p-5"
        style={{
          background: "var(--color-surface-card)",
          borderRadius: "var(--lifeflow-radius-medium)",
          boxShadow: "var(--shadow-card)",
        }}
      >
        <div className="mb-4 flex items-center gap-2.5">
          <Pill className="h-5 w-5 shrink-0" style={{ color: "var(--lifeflow-primary)" }} />
          <h2 style={{ fontSize: 16, fontWeight: 600, color: "var(--lifeflow-foreground)" }}>
            今日用药
          </h2>
        </div>

        {MEDICATION_SLOTS.map((slot, i) => (
          <div key={slot.label}>
            {i > 0 && (
              <div
                className="h-[0.5px]"
                style={{ background: "var(--lifeflow-border)" }}
              />
            )}
            <div className="flex items-center py-3.5">
              <Circle
                className="h-5 w-5 shrink-0"
                style={{ color: "var(--lifeflow-border)" }}
              />
              <span
                className="ml-3.5 min-w-0 truncate"
                style={{ fontSize: 15, fontWeight: 500, color: "var(--lifeflow-foreground)" }}
              >
                {slot.label}
              </span>
              <span
                className="ml-2 shrink-0"
                style={{ fontSize: 13, color: "var(--lifeflow-muted-foreground)" }}
              >
                {slot.time}
              </span>
              <span
                className="ml-auto shrink-0 text-[13px] font-medium tracking-[-0.01em]"
                style={{ color: "var(--color-text-secondary)" }}
              >
                未完成
              </span>
            </div>
          </div>
        ))}
      </section>

      {/* Quick Add Button */}
      <div className="mb-4">
        <button
          className="flex w-full items-center justify-center gap-2 rounded-full py-3.5"
          style={{
            background: "var(--lifeflow-primary)",
            color: "var(--lifeflow-primary-foreground)",
            fontSize: 16,
            fontWeight: 600,
          }}
        >
          <Plus className="h-5 w-5" />
          <span>添加药品</span>
        </button>
      </div>

      {/* Empty State Card */}
      <section
        className="flex flex-col items-center justify-center p-8"
        style={{
          background: "var(--color-surface-card)",
          borderRadius: "var(--lifeflow-radius-medium)",
          boxShadow: "var(--shadow-card)",
        }}
      >
        <Pill
          className="mb-3 h-10 w-10"
          style={{ color: "var(--lifeflow-muted-foreground)" }}
        />
        <p style={{ fontSize: 15, color: "var(--lifeflow-muted-foreground)" }}>
          暂无药品记录
        </p>
      </section>
    </div>
  );
}
