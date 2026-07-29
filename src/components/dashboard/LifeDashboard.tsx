"use client";

import { useState, useEffect, useMemo, useCallback } from "react";
import { useRouter } from "next/navigation";
import { TrendingUp } from "lucide-react";
import { getDashboardSummary } from "@/lib/dashboard-summary";
import type { DashboardSummary, ModuleMetric, SummaryPeriod } from "@/lib/dashboard-summary";

// ─── 模块路由映射 ────────────────────────────────────────────

const MODULE_ROUTES: Record<string, string> = {
  water: "/more/water",
  sleep: "/more/sleep",
  fitness: "/more/fitness",
  finance: "/more/accounting",
  diet: "/more/diet",
  wellness: "/more/wellness",
  posture: "/more/posture",
};

// ─── 周期标签 ────────────────────────────────────────────────

const PERIOD_OPTIONS: { key: SummaryPeriod; label: string }[] = [
  { key: "daily", label: "日" },
  { key: "weekly", label: "周" },
  { key: "monthly", label: "月" },
  { key: "yearly", label: "年" },
];

// ─── 模块颜色 ────────────────────────────────────────────────

const MODULE_COLORS: Record<string, string> = {
  water: "#3B82F6",
  sleep: "#6366F1",
  fitness: "#F97316",
  finance: "#10B981",
  diet: "#EC4899",
  wellness: "#EF4444",
  posture: "#8B5CF6",
};

// ============================================================
// 迷你健康条
// ============================================================

function HealthBarRow({ metric, router }: { metric: ModuleMetric; router: ReturnType<typeof useRouter> }) {
  const color = MODULE_COLORS[metric.key] || "#6B7280";

  // 进度条颜色
  let barColor = "#9CA3AF"; // 灰色=无数据
  if (metric.current > 0) {
    if (metric.rate !== undefined) {
      barColor = metric.rate >= 80 ? "#34C759" : metric.rate >= 50 ? "#F59E0B" : "#FF3B30";
    } else {
      barColor = color;
    }
  }

  const barWidth = metric.rate !== undefined ? Math.min(100, metric.rate) : (metric.current > 0 ? 100 : 0);

  return (
    <button
      onClick={() => router.push(MODULE_ROUTES[metric.key] || "/")}
      className="w-full flex items-center gap-3 py-2 active:opacity-60 text-left"
    >
      {/* 模块名 */}
      <span className="text-[11px] font-medium w-10 shrink-0" style={{ color: "var(--color-text-secondary)" }}>
        {metric.label}
      </span>

      {/* 进度条 */}
      <div className="flex-1 h-[6px] rounded-full" style={{ background: "var(--lifeflow-muted)" }}>
        <div
          className="h-full rounded-full transition-all duration-500"
          style={{
            width: `${barWidth}%`,
            background: barColor,
          }}
        />
      </div>

      {/* 数据 */}
      <span className="text-[12px] font-medium shrink-0 tabular-nums" style={{ color: "var(--color-text-primary)" }}>
        {metric.display}
      </span>
    </button>
  );
}

// ============================================================
// 主组件
// ============================================================

export default function LifeDashboard() {
  const router = useRouter();
  const [period, setPeriod] = useState<SummaryPeriod>("daily");
  const [summary, setSummary] = useState<DashboardSummary | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    getDashboardSummary(period).then((s) => {
      setSummary(s);
      setLoading(false);
    }).catch(() => setLoading(false));
  }, [period]);

  return (
    <div className="px-4 mb-4">
      <div
        className="rounded-[16px] overflow-hidden"
        style={{ background: "var(--color-surface-card)", boxShadow: "var(--shadow-card)" }}
      >
        {/* ── 标题行 + 周期切换 ── */}
        <div className="flex items-center justify-between px-4 pt-3.5 pb-2">
          <div className="flex items-center gap-2">
            <TrendingUp className="w-4 h-4" style={{ color: "var(--lifeflow-primary)" }} />
            <span className="text-[13px] font-semibold" style={{ color: "var(--color-text-primary)" }}>
              节奏
            </span>
          </div>
          <div className="flex gap-1">
            {PERIOD_OPTIONS.map((opt) => (
              <button
                key={opt.key}
                onClick={() => setPeriod(opt.key)}
                className="px-2.5 py-1 rounded-lg text-[12px] font-medium transition-colors"
                style={{
                  background: period === opt.key ? "var(--lifeflow-primary)" : "var(--lifeflow-muted)",
                  color: period === opt.key ? "#fff" : "var(--color-text-secondary)",
                }}
              >
                {opt.label}
              </button>
            ))}
          </div>
        </div>

        {/* ── 一类文案（摘要） ── */}
        {!loading && summary && (
          <div className="px-4 pb-2">
            <p className="text-[14px] font-semibold leading-relaxed" style={{ color: "var(--color-text-primary)" }}>
              {summary.headline}
            </p>
          </div>
        )}

        {/* ── 加载态 ── */}
        {loading && (
          <div className="px-4 py-3 space-y-2">
            <div className="h-3 rounded animate-pulse" style={{ background: "var(--lifeflow-muted)", width: "60%" }} />
            <div className="h-3 rounded animate-pulse" style={{ background: "var(--lifeflow-muted)", width: "40%" }} />
          </div>
        )}

        {/* ── 各模块健康条 ── */}
        {!loading && summary && summary.hasData && (
          <div className="px-4 pb-3">
            {summary.metrics.map((m) => (
              <HealthBarRow key={m.key} metric={m} router={router} />
            ))}
          </div>
        )}

        {/* ── 无数据态 ── */}
        {!loading && summary && !summary.hasData && (
          <div className="px-4 pb-3.5">
            <p className="text-[12px]" style={{ color: "var(--color-text-secondary)" }}>
              暂无数据，开始记录后这里会出现各模块的健康状态。
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
