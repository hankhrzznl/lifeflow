"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { ChevronLeft, BarChart3, Wallet, Moon, Droplets, Dumbbell, Target, TrendingUp, Calendar, Pill } from "lucide-react";
import { reviewerBrain } from "@/lib/brains/reviewer";
import type { ReviewResult, ReviewModuleSummary } from "@/lib/brains/reviewer";

const REVIEW_MODULES: Record<string, { icon: React.ComponentType<any>; color: string; href: string; badge?: string }> = {
  goals: { icon: Target, color: "#6366F1", href: "/more/review/goals", badge: "即将推出" },
  finance: { icon: Wallet, color: "#10B981", href: "/more/review/finance" },
  sleep: { icon: Moon, color: "#8B5CF6", href: "/more/review/sleep", badge: "即将推出" },
  water: { icon: Droplets, color: "#3B82F6", href: "/more/review/water", badge: "即将推出" },
  fitness: { icon: Dumbbell, color: "#F59E0B", href: "/more/review/fitness", badge: "即将推出" },
  schedule: { icon: Calendar, color: "#FF9500", href: "/more/review/schedule" },
  medication: { icon: Pill, color: "#DC2626", href: "/more/review/medication" },
};

function ModuleCard({ summary }: { summary: ReviewModuleSummary }) {
  const router = useRouter();
  const config = REVIEW_MODULES[summary.module];
  if (!config || Object.keys(summary.stats).length === 0) return null;

  return (
    <div
      className="rounded-[20px] p-4 cursor-pointer active:opacity-70 transition-opacity relative"
      style={{ background: "var(--color-surface-card)", boxShadow: "var(--shadow-card)" }}
      onClick={() => router.push(config.href)}
    >
      {config.badge && (
        <span
          className="absolute top-3 right-3 text-[10px] font-medium px-2 py-0.5 rounded-full"
          style={{ background: "#EC4899", color: "#fff" }}
        >
          {config.badge}
        </span>
      )}
      <div className="flex items-center gap-3 mb-3">
        <div
          className="w-9 h-9 rounded-full flex items-center justify-center flex-shrink-0"
          style={{ background: `${config.color}15` }}
        >
          <config.icon className="w-5 h-5" style={{ color: config.color }} />
        </div>
        <p className="text-[15px] font-semibold" style={{ color: "var(--color-text-primary)" }}>
          {summary.label}
        </p>
      </div>
      <div className="grid grid-cols-2 gap-2">
        {Object.entries(summary.stats).map(([key, val]) => (
          <div key={key} className="flex justify-between px-2 py-1.5 rounded-xl" style={{ background: "var(--lifeflow-muted)" }}>
            <span className="text-[12px]" style={{ color: "var(--color-text-secondary)" }}>{key}</span>
            <span className="text-[13px] font-semibold" style={{ color: "var(--color-text-primary)" }}>{val}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

export default function ReviewPage() {
  const router = useRouter();
  const [review, setReview] = useState<ReviewResult | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    reviewerBrain.generateReview("weekly").then(r => {
      setReview(r);
      setLoading(false);
    }).catch(() => setLoading(false));
  }, []);

  const summariesWithData = review?.summaries.filter(s => Object.keys(s.stats).length > 0) || [];

  return (
    <div className="min-h-screen max-w-[430px] mx-auto px-4 pt-6 pb-[100px]">
      <header className="flex items-center gap-3 mb-6">
        <button
          onClick={() => router.back()}
          className="inline-flex items-center justify-center w-9 h-9 rounded-lg"
          style={{ background: "var(--lifeflow-muted)" }}
          aria-label="返回"
        >
          <ChevronLeft className="w-5 h-5" style={{ color: "var(--lifeflow-foreground)" }} />
        </button>
        <div className="flex items-center gap-2">
          <BarChart3 className="w-6 h-6" style={{ color: "var(--lifeflow-primary)" }} />
          <h1 className="text-[17px] font-semibold leading-[1.3] tracking-[-0.018em]" style={{ color: "var(--lifeflow-foreground)" }}>
            复盘总览
          </h1>
        </div>
      </header>

      {loading ? (
        <div className="space-y-3">
          {[1, 2, 3].map(i => (
            <div key={i} className="h-28 rounded-[20px] animate-pulse" style={{ background: "var(--lifeflow-muted)" }} />
          ))}
        </div>
      ) : (
        <>
          <div
            className="mb-6 p-5"
            style={{
              background: "var(--color-surface-card)",
              borderRadius: "var(--lifeflow-radius-medium)",
              boxShadow: "var(--shadow-card)",
            }}
          >
            <div className="flex items-center gap-2 mb-4">
              <TrendingUp className="w-5 h-5 flex-shrink-0" style={{ color: "var(--lifeflow-primary)" }} />
              <h2 className="text-[17px] font-semibold" style={{ color: "var(--lifeflow-foreground)" }}>
                {review?.period === "weekly" ? "本周" : "本月"}概览
              </h2>
            </div>
            {summariesWithData.length === 0 ? (
              <p className="text-center py-6" style={{ color: "var(--color-text-secondary)" }}>
                暂无数据。开始记录生活，下周就会有复盘啦！
              </p>
            ) : (
              <div className="grid grid-cols-3 gap-4 text-center">
                {summariesWithData.slice(0, 3).map((s, i) => {
                  const kv = Object.entries(s.stats)[0];
                  return (
                    <div key={i}>
                      <p className="text-[24px] font-bold" style={{ color: "var(--lifeflow-primary)" }}>
                        {kv?.[1] ?? "--"}
                      </p>
                      <p className="text-[11px] mt-1" style={{ color: "var(--color-text-secondary)" }}>
                        {kv?.[0] ?? s.label}
                      </p>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          <h2 className="text-[13px] font-semibold uppercase tracking-wider mb-3" style={{ color: "var(--color-text-disabled)" }}>
            各模块详情
          </h2>
          <div className="flex flex-col gap-3">
            {summariesWithData.map(s => (
              <ModuleCard key={s.module} summary={s} />
            ))}
            {summariesWithData.length === 0 && !loading && (
              <p className="text-center py-8 text-[13px]" style={{ color: "var(--color-text-secondary)" }}>
                暂无模块数据
              </p>
            )}
          </div>
        </>
      )}
    </div>
  );
}
