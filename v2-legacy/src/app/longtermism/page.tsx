"use client";

import { useState, useEffect } from "react";
import {
  ChevronDown, ChevronUp, TrendingUp,
} from "lucide-react";
import { reviewerBrain } from "@/lib/brains/reviewer";
import type { ReviewResult, ReviewPeriod } from "@/lib/brains/reviewer";

// ─── 工具函数 ────────────────────────────────────────────────

// T20-3：长期主义复盘仅保留周/月粒度（原日/周/月/年 4 粒度，日/年已收敛）
const REVIEW_PERIODS: ReviewPeriod[] = ["weekly", "monthly"];

const PERIOD_LABELS: Record<ReviewPeriod, string> = {
  daily: "日",
  weekly: "周",
  monthly: "月",
  yearly: "年",
};

const PERIOD_FULL_LABELS: Record<ReviewPeriod, string> = {
  daily: "昨日",
  weekly: "本周",
  monthly: "本月",
  yearly: "今年",
};

// ─── 主页面 ──────────────────────────────────────────────────

export default function LongTermismPage() {
  // ─── 复盘状态 ──────────────────────────────────────────────

  const [reviewPeriod, setReviewPeriod] = useState<ReviewPeriod>("weekly");
  const [currentReview, setCurrentReview] = useState<ReviewResult | null>(null);
  const [historicalReviews, setHistoricalReviews] = useState<ReviewResult[]>([]);
  const [reviewLoading, setReviewLoading] = useState(true);
  const [showHistory, setShowHistory] = useState(false);

  useEffect(() => {
    setReviewLoading(true);
    Promise.all([
      reviewerBrain.generateReview(reviewPeriod, 0),
      reviewerBrain.getHistoricalReviews(reviewPeriod, 4),
    ]).then(([current, history]) => {
      setCurrentReview(current);
      setHistoricalReviews(history.slice(1)); // 排除当前，只保留历史
      setReviewLoading(false);
    }).catch(() => setReviewLoading(false));
  }, [reviewPeriod]);

  const hasReviewData = currentReview?.hasData ?? false;

  return (
    <div
      className="min-h-screen"
      style={{
        maxWidth: 430,
        margin: "0 auto",
        background: "var(--lifeflow-background)",
        paddingBottom: 120,
      }}
    >
      {/* ─── Header ────────────────────────────────────────── */}
      <div className="px-5 pt-[var(--safe-area-top)] pb-4">
        <h1 className="text-[22px] font-bold" style={{ color: "var(--color-text-primary)" }}>
          长期主义
        </h1>
        <p className="text-[13px] mt-0.5" style={{ color: "var(--color-text-disabled)" }}>
          每日坚持，时间看得见
        </p>
      </div>

      {/* ─── 复盘区域（数据叙事风） ──────────────────────────── */}
      <div className="px-4 mb-5">
        <div
          className="rounded-[16px] overflow-hidden"
          style={{
            background: "var(--color-surface-card)",
            boxShadow: "var(--shadow-card)",
          }}
        >
          {/* 标题行 + 周期切换 */}
          <div className="flex items-center justify-between px-4 pt-3.5 pb-2">
            <div className="flex items-center gap-2">
              <TrendingUp className="w-4 h-4" style={{ color: "var(--lifeflow-primary)" }} />
              <span className="text-[13px] font-semibold" style={{ color: "var(--color-text-primary)" }}>
                复盘
              </span>
            </div>
            <div className="flex gap-1">
              {REVIEW_PERIODS.map((key) => (
                <button
                  key={key}
                  onClick={() => setReviewPeriod(key)}
                  className="px-2.5 py-1 rounded-lg text-[12px] font-medium transition-colors"
                  style={{
                    background: reviewPeriod === key ? "var(--lifeflow-primary)" : "var(--lifeflow-muted)",
                    color: reviewPeriod === key ? "#fff" : "var(--color-text-secondary)",
                  }}
                >
                  {PERIOD_LABELS[key]}
                </button>
              ))}
            </div>
          </div>

          {/* 加载态 */}
          {reviewLoading && (
            <div className="px-4 py-4 space-y-3">
              <div className="h-6 rounded-lg animate-pulse" style={{ background: "var(--lifeflow-muted)", width: "60%" }} />
              <div className="h-16 rounded-xl animate-pulse" style={{ background: "var(--lifeflow-muted)" }} />
              <div className="h-16 rounded-xl animate-pulse" style={{ background: "var(--lifeflow-muted)" }} />
            </div>
          )}

          {/* 无数据态 */}
          {!reviewLoading && !hasReviewData && (
            <div className="px-4 py-4">
              <p className="text-[13px]" style={{ color: "var(--color-text-secondary)" }}>
                {PERIOD_FULL_LABELS[reviewPeriod]}暂无数据。开始记录，复盘自动生成。
              </p>
            </div>
          )}

          {/* 有数据 → 数据叙事 */}
          {!reviewLoading && hasReviewData && currentReview && (
            <div className="px-4 pb-4">
              {/* Hero 区 */}
              <div className="pb-3 mb-3" style={{ borderBottom: "1px solid var(--lifeflow-border)" }}>
                <h2 className="text-[20px] font-bold leading-tight" style={{ color: "var(--color-text-primary)" }}>
                  {currentReview.headline}
                </h2>
                <p className="text-[13px] mt-1.5 leading-relaxed" style={{ color: "var(--color-text-secondary)" }}>
                  {currentReview.overviewText}
                </p>
              </div>

              {/* 模块级洞察卡片 */}
              <div className="space-y-3">
                {currentReview.insights.slice(0, 6).map((insight) => (
                  <div
                    key={insight.module}
                    className="rounded-[14px] p-3.5"
                    style={{ background: "var(--lifeflow-muted)" }}
                  >
                    <div className="flex items-start gap-3">
                      {/* 模块色条 */}
                      <div
                        className="w-[3px] rounded-full shrink-0 mt-0.5"
                        style={{ background: insight.color, minHeight: 36 }}
                      />

                      <div className="flex-1 min-w-0">
                        {/* 标题行 */}
                        <div className="flex items-center justify-between mb-0.5">
                          <span className="text-[11px] font-semibold uppercase tracking-[0.03em]" style={{ color: insight.color }}>
                            {insight.moduleLabel}
                          </span>
                          <span
                            className="text-[13px] font-bold"
                            style={{
                              color: insight.trend === "up" ? "#34C759" : insight.trend === "down" ? "#FF3B30" : "#8E8E93",
                            }}
                          >
                            {insight.trend === "up" ? "↑" : insight.trend === "down" ? "↓" : "→"}
                          </span>
                        </div>

                        {/* 主发现 */}
                        <p className="text-[14px] font-semibold leading-snug" style={{ color: "var(--color-text-primary)" }}>
                          {insight.headline.replace(/ [↑↓→]$/, "")}
                        </p>

                        {/* 所有次发现 */}
                        {insight.findings.slice(1).map((finding) => (
                          <p
                            key={finding.id}
                            className="text-[12px] mt-1 leading-relaxed"
                            style={{ color: "var(--color-text-secondary)" }}
                          >
                            {finding.title}：{finding.description}
                          </p>
                        ))}
                      </div>
                    </div>
                  </div>
                ))}
              </div>

              {/* 行动建议 */}
              {currentReview.suggestions.length > 0 && (
                <div className="mt-4 pt-3" style={{ borderTop: "1px solid var(--lifeflow-border)" }}>
                  <p className="text-[11px] font-medium mb-2" style={{ color: "var(--color-text-secondary)" }}>
                    行动建议
                  </p>
                  <div className="space-y-1.5">
                    {currentReview.suggestions.map((s, i) => (
                      <div key={i} className="flex items-start gap-2">
                        <span className="text-[11px] mt-0.5 text-[#34C759] shrink-0">●</span>
                        <span className="text-[12px] leading-relaxed" style={{ color: "var(--color-text-secondary)" }}>
                          {s}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* 历史复盘折叠 */}
          {!reviewLoading && historicalReviews.length > 0 && (
            <>
              <div className="mx-4 border-t" style={{ borderColor: "var(--lifeflow-border)" }} />
              <button
                onClick={() => setShowHistory(v => !v)}
                className="w-full flex items-center justify-between px-4 py-2.5 text-[12px] font-medium"
                style={{ color: "var(--color-text-secondary)" }}
              >
                <span>历史复盘</span>
                {showHistory ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
              </button>
              {showHistory && (
                <div className="px-4 pb-3 space-y-2">
                  {historicalReviews.map((hr, idx) => (
                    <div key={idx} className="p-3 rounded-xl" style={{ background: "var(--lifeflow-muted)" }}>
                      <p className="text-[11px] font-semibold mb-1" style={{ color: "var(--color-text-disabled)" }}>
                        {hr.dateRange.start} ~ {hr.dateRange.end}
                      </p>
                      <p className="text-[13px] font-semibold leading-snug" style={{ color: "var(--color-text-primary)" }}>
                        {hr.headline}
                      </p>
                      <p className="text-[11px] mt-1 leading-relaxed" style={{ color: "var(--color-text-secondary)" }}>
                        {hr.overviewText}
                      </p>
                    </div>
                  ))}
                </div>
              )}
            </>
          )}
        </div>
      </div>

    </div>
  );
}
