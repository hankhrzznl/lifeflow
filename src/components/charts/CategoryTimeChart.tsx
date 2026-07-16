"use client";

import { useState, useEffect } from "react";
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, Legend,
} from "recharts";

// ============================================================
// 按类别时间投入堆叠面积图
// ============================================================

interface CategoryTimeChartProps {
  className?: string;
}

const CATEGORY_COLORS: Record<string, string> = {
  exam: "var(--info)",
  fitness: "var(--success)",
  habit: "var(--brand-primary)",
  finance: "var(--warning)",
  custom: "var(--brand-secondary)",
};

const CATEGORY_LABELS: Record<string, string> = {
  exam: "备考", fitness: "运动", habit: "习惯", finance: "理财", custom: "其他",
};

export function CategoryTimeChart({ className = "" }: CategoryTimeChartProps) {
  const [data, setData] = useState<Array<Record<string, number | string>>>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      try {
        const { engineDB } = await import("@/lib/engine/db");
        const now = new Date();
        const points: Array<Record<string, number | string>> = [];

        for (let i = 29; i >= 0; i--) {
          const d = new Date(now);
          d.setDate(d.getDate() - i);
          const dateStr = d.toISOString().slice(0, 10);

          const allGoals = await engineDB.goals.where('status').equals('active').toArray();
          const dayData: Record<string, number | string> = {
            date: `${d.getMonth() + 1}/${d.getDate()}`,
            exam: 0, fitness: 0, habit: 0, finance: 0, custom: 0,
          };

          for (const goal of allGoals) {
            const milestones = await engineDB.milestones.where('goalId').equals(goal.id).toArray();
            let mins = 0;
            for (const ms of milestones) {
              const tasks = await engineDB.weeklyTasks.where('milestoneId').equals(ms.id).toArray();
              for (const task of tasks) {
                const atoms = await engineDB.dailyAtoms
                  .where('weeklyTaskId').equals(task.id)
                  .filter((a) => a.scheduledDate === dateStr && a.isCompleted)
                  .toArray();
                mins += atoms.reduce((s, a) => s + (a.estimatedDuration ?? 0), 0);
              }
            }
            const cat = goal.category;
            if (cat && dayData[cat] !== undefined && mins > 0) {
              dayData[cat] = (dayData[cat] as number) + Math.round(mins / 60 * 10) / 10;
            }
          }

          points.push(dayData);
        }

        if (!cancelled) setData(points);
      } catch (err) {
        console.error('[CategoryTimeChart] 加载失败:', err);
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    load();
    return () => { cancelled = true; };
  }, []);

  const categories = ['exam', 'fitness', 'habit', 'finance', 'custom'];

  if (loading) return <div className={`skeleton h-48 rounded-fabric ${className}`} />;

  return (
    <div className={`rounded-fabric p-4 ${className}`}
      style={{ backgroundColor: "var(--surface-fabric)", boxShadow: "var(--shadow-knit)" }}>
      <h4 className="text-sm font-medium mb-3" style={{ fontFamily: "var(--font-display)", color: "var(--text-primary)" }}>
        时间投入（30天）
      </h4>
      <ResponsiveContainer width="100%" height={200}>
        <AreaChart data={data}>
          <CartesianGrid stroke="var(--knit-grid)" strokeDasharray="3 3" />
          <XAxis dataKey="date" tick={{ fontSize: 10, fill: "var(--text-tertiary)" }} interval="preserveStartEnd" />
          <YAxis tick={{ fontSize: 10, fill: "var(--text-tertiary)" }} />
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
          {categories.map((cat) => (
            <Area
              key={cat}
              type="monotone"
              dataKey={cat}
              stackId="1"
              stroke={CATEGORY_COLORS[cat] ?? "var(--knit-grid)"}
              fill={CATEGORY_COLORS[cat] ?? "var(--knit-grid)"}
              fillOpacity={0.4}
              strokeWidth={1}
              name={CATEGORY_LABELS[cat] ?? cat}
            />
          ))}
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}
