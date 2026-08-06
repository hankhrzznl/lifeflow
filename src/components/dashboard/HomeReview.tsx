"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { TrendingUp } from "lucide-react";
import { reviewerBrain } from "@/lib/brains/reviewer";
import type { ReviewResult, ModuleInsight, ReviewPeriod } from "@/lib/brains/reviewer";

// ─── 周期标签 ────────────────────────────────────────────────

const PERIOD_OPTIONS: { key: ReviewPeriod; label: string }[] = [
  { key: "daily", label: "日" },
  { key: "weekly", label: "周" },
];

// ============================================================
// 模块路由
// ============================================================

const MODULE_ROUTES: Record<string, string> = {
  water: "/more/water",
  sleep: "/more/sleep",
  fitness: "/more/fitness",
  finance: "/more/accounting",
  diet: "/more/diet",
  wellness: "/more/fitness?tab=wellness",
  posture: "/more/fitness?tab=posture",
  schedule: "/efficiency/schedule",
  medication: "/more/medication",
  goals: "/efficiency-v2",
  ideal: "/more/ideal-day",
};

// ============================================================
// 洞察卡片
// ============================================================

function InsightCard({ insight, onClick }: { insight: ModuleInsight; onClick: () => void }) {
  const trendColor = insight.trend === "up" ? "#34C759" : insight.trend === "down" ? "#FF3B30" : "#8E8E93";
  const trendLabel = insight.trend === "up" ? "↑" : insight.trend === "down" ? "↓" : "→";

  return (
    <button
      onClick={onClick}
      className="w-full text-left active:scale-[0.98] transition-transform"
    >
      <div
        className="rounded-[14px] p-3.5"
        style={{ background: "var(--color-surface-card)" }}
      >
        <div className="flex items-start gap-3">
          {/* 模块色条 */}
          <div
            className="w-[3px] h-full rounded-full shrink-0 mt-0.5"
            style={{ background: insight.color, minHeight: 40 }}
          />

          <div className="flex-1 min-w-0">
            {/* 标题行 */}
            <div className="flex items-center justify-between mb-1">
              <span className="text-[12px] font-medium" style={{ color: "var(--color-text-secondary)" }}>
                {insight.moduleLabel}
              </span>
              <span className="text-[13px] font-semibold" style={{ color: trendColor }}>
                {trendLabel}
              </span>
            </div>

            {/* 内容 */}
            <p className="text-[14px] font-semibold leading-snug" style={{ color: "var(--color-text-primary)" }}>
              {insight.headline.replace(/ [↑↓→]$/, "")}
            </p>
            <p className="text-[12px] mt-1 leading-relaxed" style={{ color: "var(--color-text-secondary)" }}>
              {insight.detail}
            </p>
          </div>
        </div>
      </div>
    </button>
  );
}

// ============================================================
// 主组件
// ============================================================

export default function HomeReview() {
  const router = useRouter();
  const [period, setPeriod] = useState<ReviewPeriod>("daily");
  const [result, setResult] = useState<ReviewResult | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    reviewerBrain.generateReview(period, 0).then((r) => {
      if (!cancelled) {
        setResult(r);
        setLoading(false);
      }
    }).catch(() => {
      if (!cancelled) setLoading(false);
    });
    return () => { cancelled = true; };
  }, [period]);

  const topInsights = result?.insights?.slice(0, 4) || [];
  const hasData = result?.hasData ?? false;

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
              复盘
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

        {/* ── 加载态 ── */}
        {loading && (
          <div className="px-4 py-3 space-y-3">
            <div className="h-16 rounded-xl animate-pulse" style={{ background: "var(--lifeflow-muted)" }} />
            <div className="h-16 rounded-xl animate-pulse" style={{ background: "var(--lifeflow-muted)" }} />
          </div>
        )}

        {/* ── 洞察卡片流 ── */}
        {!loading && hasData && (
          <div className="px-4 pb-3 space-y-2.5">
            {/* 大标题 */}
            {result?.headline && (
              <p className="text-[15px] font-semibold leading-relaxed px-0.5 pb-1" style={{ color: "var(--color-text-primary)" }}>
                {result.headline}
              </p>
            )}

            {topInsights.map((insight) => (
              <InsightCard
                key={insight.module}
                insight={insight}
                onClick={() => {
                  const route = MODULE_ROUTES[insight.module];
                  if (route) router.push(route);
                }}
              />
            ))}

            {/* 行动建议 */}
            {result?.suggestions && result.suggestions.length > 0 && (
              <div className="pt-1">
                <p className="text-[11px] font-medium mb-1.5" style={{ color: "var(--color-text-secondary)" }}>
                  行动建议
                </p>
                <div className="space-y-1">
                  {result.suggestions.slice(0, 3).map((s, i) => (
                    <div key={i} className="flex items-start gap-2">
                      <span className="text-[11px] mt-0.5 text-[#34C759]">●</span>
                      <span className="text-[12px]" style={{ color: "var(--color-text-secondary)" }}>{s}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* 查看完整复盘 */}
            <button
              onClick={() => router.push("/longtermism")}
              className="w-full text-[12px] font-medium text-center pt-2 pb-0.5 active:opacity-60"
              style={{ color: "var(--lifeflow-primary)" }}
            >
              查看完整复盘 →
            </button>
          </div>
        )}

        {/* ── 无数据态 ── */}
        {!loading && !hasData && (
          <div className="px-4 pb-3.5 pt-1">
            <p className="text-[13px] font-medium" style={{ color: "var(--color-text-primary)" }}>
              暂无数据
            </p>
            <p className="text-[12px] mt-1" style={{ color: "var(--color-text-secondary)" }}>
              开始记录后，这里会生成你的生活洞察。
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
