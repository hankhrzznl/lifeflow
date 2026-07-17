"use client";

import { useEffect, useState } from "react";
import { memoryEngine, type QuarterReport } from "@/lib/engine/MemoryEngine";
import MascotIllustration from "@/components/ui/MascotIllustration";
import { TrendingUp, TrendingDown, Minus, Star, AlertCircle } from "lucide-react";
import type { DailyAtom } from "@/types/goal";
import type { Goal } from "@/lib/types";

interface WeekSummary {
  weekStart: string; completionRate: number; totalAtoms: number; completedAtoms: number;
}

export function MemoryReport({ quarterData, atoms, goals }: {
  quarterData: WeekSummary[];
  atoms: DailyAtom[];
  goals: Goal[];
}) {
  const [report, setReport] = useState<QuarterReport | null>(null);

  useEffect(() => {
    const r = memoryEngine.generateQuarterReport(quarterData, atoms, goals);
    setReport(r);
  }, [quarterData, atoms, goals]);

  if (!report) return null;

  const TrendIcon = report.trend === "up" ? TrendingUp : report.trend === "down" ? TrendingDown : Minus;
  const trendColor = report.trend === "up" ? "var(--success)" : report.trend === "down" ? "var(--warning)" : "var(--text-secondary)";

  return (
    <div className="space-y-4">
      <div className="rounded-fabric p-4" style={{ backgroundColor: "var(--surface-fabric)", boxShadow: "var(--shadow-knit)" }}>
        <div className="flex items-center gap-3 mb-3">
          <div className="w-12 h-12"><MascotIllustration state="knitting" size={48} /></div>
          <div>
            <h3 className="text-base font-semibold" style={{ color: "var(--text-primary)" }}>季度成长报告</h3>
            <p className="text-xs" style={{ color: "var(--text-secondary)" }}>小织从数据中发现的规律</p>
          </div>
        </div>
        <p className="text-sm leading-relaxed" style={{ color: "var(--text-primary)" }}>{report.summary}</p>
      </div>

      <div className="grid grid-cols-3 gap-3">
        <div className="rounded-fabric p-3 text-center" style={{ backgroundColor: "var(--surface-fabric)", boxShadow: "var(--shadow-knit)" }}>
          <p className="text-xs" style={{ color: "var(--text-secondary)" }}>目标达成</p>
          <p className="text-xl font-semibold" style={{ color: "var(--brand-primary)" }}>{report.totalGoalsCompleted}</p>
        </div>
        <div className="rounded-fabric p-3 text-center" style={{ backgroundColor: "var(--surface-fabric)", boxShadow: "var(--shadow-knit)" }}>
          <p className="text-xs" style={{ color: "var(--text-secondary)" }}>平均完成率</p>
          <p className="text-xl font-semibold" style={{ color: "var(--brand-primary)" }}>{report.avgCompletionRate}%</p>
        </div>
        <div className="rounded-fabric p-3 text-center" style={{ backgroundColor: "var(--surface-fabric)", boxShadow: "var(--shadow-knit)" }}>
          <p className="text-xs" style={{ color: "var(--text-secondary)" }}>趋势</p>
          <TrendIcon className="w-6 h-6 mx-auto" style={{ color: trendColor }} />
        </div>
      </div>

      {report.patterns.length > 0 && (
        <div className="rounded-fabric p-4" style={{ backgroundColor: "var(--surface-fabric)", boxShadow: "var(--shadow-knit)" }}>
          <h4 className="text-sm font-semibold mb-3 flex items-center gap-2" style={{ color: "var(--text-primary)" }}>
            <Star className="w-4 h-4" style={{ color: "var(--brand-secondary)" }} /> 发现的模式
          </h4>
          <div className="space-y-2">
            {report.patterns.map((p, i) => (
              <div key={i} className="flex items-start gap-2">
                <span className="text-xs px-2 py-0.5 rounded" style={{
                  color: p.type === "high_day" ? "var(--success)" : p.type === "low_day" ? "var(--warning)" : "var(--brand-primary)" }}>
                  {p.type === "high_day" ? "高效" : p.type === "low_day" ? "低谷" : "规律"}
                </span>
                <p className="text-xs flex-1" style={{ color: "var(--text-primary)" }}>{p.description}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      {report.anomalies.length > 0 && (
        <div className="rounded-fabric p-4" style={{ backgroundColor: "var(--surface-fabric)", boxShadow: "var(--shadow-knit)" }}>
          <h4 className="text-sm font-semibold mb-3 flex items-center gap-2" style={{ color: "var(--text-primary)" }}>
            <AlertCircle className="w-4 h-4" style={{ color: "var(--brand-secondary)" }} /> 值得回味的周
          </h4>
          {report.anomalies.map((a, i) => (
            <p key={i} className="text-xs mb-1" style={{ color: a.type === "high" ? "var(--success)" : "var(--text-secondary)" }}>
              {a.description}
            </p>
          ))}
        </div>
      )}
    </div>
  );
}
