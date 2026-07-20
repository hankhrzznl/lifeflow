"use client";

import { useRouter } from "next/navigation";
import { ChevronLeft, ChevronRight, Activity, Scan, Move, Zap } from "lucide-react";

// ============================================================
// 体态拉伸 — 矫正与放松
// ============================================================

const ASSESSMENT_ITEMS = [
  "头部前倾",
  "圆肩",
  "骨盆前倾",
  "驼背",
  "脊柱侧弯",
];

const STRETCH_ROUTINES = [
  { icon: Scan, title: "颈部放松", desc: "5分钟 · 3个动作" },
  { icon: Move, title: "肩部打开", desc: "8分钟 · 4个动作" },
  { icon: Activity, title: "腰部拉伸", desc: "10分钟 · 5个动作" },
  { icon: Zap, title: "全身流动", desc: "15分钟 · 8个动作" },
];

export default function PosturePage() {
  const router = useRouter();

  return (
    <div className="px-4 pt-4 pb-12">
      {/* Header */}
      <header className="flex items-center gap-3 mb-6">
        <button
          onClick={() => router.back()}
          className="inline-flex items-center justify-center w-9 h-9 rounded-lg"
          style={{ background: "var(--lifeflow-muted)" }}
          aria-label="返回"
        >
          <ChevronLeft className="w-5 h-5" style={{ color: "var(--lifeflow-foreground)" }} />
        </button>
        <h1
          className="text-[17px] font-semibold leading-[1.3] tracking-[-0.018em] truncate"
          style={{ color: "var(--lifeflow-foreground)" }}
        >
          体态拉伸
        </h1>
      </header>

      {/* Body Assessment Card */}
      <section
        className="mb-6 p-5"
        style={{
          background: "var(--lifeflow-card)",
          borderRadius: "var(--lifeflow-radius-medium)",
          boxShadow: "var(--shadow-card)",
        }}
      >
        <div className="flex items-center gap-2 mb-4">
          <Activity className="w-5 h-5 flex-shrink-0" style={{ color: "var(--lifeflow-primary)" }} />
          <h2
            className="truncate text-[17px] font-semibold leading-[1.3] tracking-[-0.018em]"
            style={{ color: "var(--lifeflow-foreground)" }}
          >
            今日体态评估
          </h2>
        </div>
        <div className="flex flex-col gap-3">
          {ASSESSMENT_ITEMS.map((item) => (
            <label key={item} className="flex items-center gap-3 cursor-pointer">
              <div
                className="w-5 h-5 rounded-full border-2 flex-shrink-0"
                style={{ borderColor: "var(--lifeflow-border)" }}
              />
              <span
                className="truncate text-[15px]"
                style={{ color: "var(--lifeflow-muted-foreground)" }}
              >
                {item}
              </span>
            </label>
          ))}
        </div>
      </section>

      {/* Section Header: 推荐拉伸 */}
      <h2
        className="truncate text-[17px] font-semibold leading-[1.3] tracking-[-0.018em] mb-4"
        style={{ color: "var(--lifeflow-foreground)" }}
      >
        推荐拉伸
      </h2>

      {/* Quick Routine Cards */}
      <div className="flex flex-col gap-3">
        {STRETCH_ROUTINES.map((routine) => (
          <div
            key={routine.title}
            className="flex items-center gap-4 px-5 py-4 cursor-pointer"
            style={{
              background: "var(--lifeflow-card)",
              borderRadius: "var(--lifeflow-radius-medium)",
              boxShadow: "var(--shadow-card)",
            }}
          >
            <div
              className="w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0"
              style={{ background: "var(--lifeflow-brand-50)" }}
            >
              <routine.icon className="w-5 h-5" style={{ color: "var(--lifeflow-primary)" }} />
            </div>
            <div className="flex-1 min-w-0">
              <h3
                className="truncate text-[16px] font-semibold"
                style={{ color: "var(--lifeflow-foreground)" }}
              >
                {routine.title}
              </h3>
              <p
                className="truncate text-[13px] font-medium tracking-[-0.01em]"
                style={{ color: "var(--color-text-secondary)" }}
              >
                {routine.desc}
              </p>
            </div>
            <ChevronRight className="w-5 h-5 flex-shrink-0" style={{ color: "var(--lifeflow-muted-foreground)" }} />
          </div>
        ))}
      </div>
    </div>
  );
}
