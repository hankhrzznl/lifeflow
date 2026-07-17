"use client";

import { useState, useEffect } from "react";
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, ReferenceLine, Area, AreaChart,
} from "recharts";

// ============================================================
// 目标完成率 8 周趋势折线图
// ============================================================

interface GoalTrendChartProps {
  goalId: string;
  className?: string;
}

export function GoalTrendChart({ goalId, className = "" }: GoalTrendChartProps) {
  const [data, setData] = useState<Array<{ week: string; rate: number }>>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      try {
        const { goalDB } = await import("@/services/goal-engine/schema");
        const now = new Date();
        const points: Array<{ week: string; rate: number }> = [];

        for (let i = 7; i >= 0; i--) {
          const d = new Date(now);
          d.setDate(d.getDate() - i * 7);
          const monday = new Date(d);
          monday.setDate(monday.getDate() - (monday.getDay() + 6) % 7);
          const sunday = new Date(monday);
          sunday.setDate(sunday.getDate() + 6);

          const start = monday.toISOString().slice(0, 10);
          const end = sunday.toISOString().slice(0, 10);

          // 从 progressSnapshots 获取该周快照
          const snapshots = await goalDB.progressSnapshots
            .where('goalId').equals(goalId)
            .filter((s) => s.snapshotDate >= start && s.snapshotDate <= end)
            .toArray();

          const rate = snapshots.length > 0
            ? Math.round(snapshots.reduce((sum, s) => sum + s.progress, 0) / snapshots.length)
            : 0;

          points.push({
            week: `W${d.getMonth() + 1}/${d.getDate()}`,
            rate,
          });
        }

        if (!cancelled) setData(points);
      } catch (err) {
        console.error('[GoalTrendChart] 加载失败:', err);
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    load();
    return () => { cancelled = true; };
  }, [goalId]);

  if (loading) return <div className={`skeleton h-48 rounded-fabric ${className}`} />;
  if (data.length === 0) return null;

  return (
    <div className={`rounded-fabric p-4 ${className}`}
      style={{ backgroundColor: "var(--surface-fabric)", boxShadow: "var(--shadow-knit)" }}>
      <h4 className="text-sm font-medium mb-3" style={{ fontFamily: "var(--font-display)", color: "var(--text-primary)" }}>
        完成率趋势
      </h4>
      <ResponsiveContainer width="100%" height={200}>
        <AreaChart data={data}>
          <defs>
            <linearGradient id="goalTrendFill" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="var(--brand-primary)" stopOpacity={0.25} />
              <stop offset="100%" stopColor="var(--brand-primary)" stopOpacity={0} />
            </linearGradient>
          </defs>
          <CartesianGrid stroke="var(--knit-grid)" strokeDasharray="3 3" />
          <XAxis dataKey="week" tick={{ fontSize: 10, fill: "var(--text-tertiary)" }} />
          <YAxis domain={[0, 100]} tick={{ fontSize: 10, fill: "var(--text-tertiary)" }} />
          <Tooltip
            contentStyle={{
              backgroundColor: "var(--surface-fabric)",
              border: "none",
              borderRadius: 12,
              boxShadow: "var(--shadow-card)",
              fontSize: 12,
              color: "var(--text-primary)",
            }}
          />
          <ReferenceLine y={80} stroke="var(--success)" strokeDasharray="4 4" strokeWidth={1} />
          <Area type="monotone" dataKey="rate" stroke="var(--brand-primary)" strokeWidth={2}
            fill="url(#goalTrendFill)" dot={{ r: 3, fill: "var(--brand-primary)" }} />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}
