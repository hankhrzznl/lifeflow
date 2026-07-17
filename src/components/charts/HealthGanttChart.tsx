"use client";

import { useState, useEffect } from "react";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from "recharts";

// ============================================================
// 健康度变化甘特图（12周横向条带）
// ============================================================

interface HealthGanttChartProps {
  goalId: string;
  className?: string;
}

const STATUS_COLORS: Record<string, string> = {
  green: "var(--success)",
  yellow: "var(--knit-thread-partial)",
  red: "var(--warning)",
};

export function HealthGanttChart({ goalId, className = "" }: HealthGanttChartProps) {
  const [data, setData] = useState<Array<{ week: string; rate: number; status: string }>>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      try {
        const { goalDB } = await import("@/services/goal-engine/schema");
        const { GoalEngine } = await import("@/services/goal-engine");
        const now = new Date();
        const points: Array<{ week: string; rate: number; status: string }> = [];

        for (let i = 11; i >= 0; i--) {
          const d = new Date(now);
          d.setDate(d.getDate() - i * 7);
          const monday = new Date(d);
          monday.setDate(monday.getDate() - (monday.getDay() + 6) % 7);
          const sunday = new Date(monday);
          sunday.setDate(sunday.getDate() + 6);

          const start = monday.toISOString().slice(0, 10);
          const end = sunday.toISOString().slice(0, 10);

          // 计算该周完成率
          const milestones = await goalDB.milestones.where('goalId').equals(goalId).toArray();
          let total = 0, completed = 0;
          for (const ms of milestones) {
            const tasks = await goalDB.weeklyTasks.where('milestoneId').equals(ms.id).toArray();
            for (const task of tasks) {
              const atoms = await goalDB.dailyAtoms
                .where('weeklyTaskId').equals(task.id)
                .filter((a) => a.scheduledDate >= start && a.scheduledDate <= end)
                .toArray();
              total += atoms.length;
              completed += atoms.filter((a) => a.isCompleted).length;
            }
          }

          const rate = total > 0 ? Math.round((completed / total) * 100) : 0;
          const overdue = await goalDB.dailyAtoms
            .filter((a) => {
              return a.status === 'overdue' && !a.isCompleted &&
                a.scheduledDate >= start && a.scheduledDate <= end;
            }).count();

          // 判定健康度
          let status: string;
          if (rate >= 80 && overdue === 0) status = 'green';
          else if (rate >= 50 && overdue <= 3) status = 'yellow';
          else status = 'red';

          points.push({
            week: `${monday.getMonth() + 1}/${monday.getDate()}`,
            rate,
            status,
          });
        }

        if (!cancelled) setData(points);
      } catch (err) {
        console.error('[HealthGanttChart] 加载失败:', err);
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    load();
    return () => { cancelled = true; };
  }, [goalId]);

  if (loading) return <div className={`skeleton h-32 rounded-fabric ${className}`} />;
  if (data.length === 0) return null;

  return (
    <div className={`rounded-fabric p-4 ${className}`}
      style={{ backgroundColor: "var(--surface-fabric)", boxShadow: "var(--shadow-knit)" }}>
      <h4 className="text-sm font-medium mb-3" style={{ fontFamily: "var(--font-display)", color: "var(--text-primary)" }}>
        12周健康度变化
      </h4>
      <ResponsiveContainer width="100%" height={80}>
        <BarChart data={data} layout="vertical" barCategoryGap={2}>
          <CartesianGrid stroke="transparent" />
          <XAxis type="number" domain={[0, 100]} hide />
          <YAxis type="category" dataKey="week" hide />
          <Tooltip
            contentStyle={{
              backgroundColor: "var(--surface-fabric)",
              border: "none",
              borderRadius: 12,
              boxShadow: "var(--shadow-card)",
              fontSize: 12,
              color: "var(--text-primary)",
            }}
            formatter={(_value, _name, props: unknown) => {
              const p = props as { payload: { rate: number; status: string } };
              const statusLabel = p.payload.status === 'green' ? '良好' :
                p.payload.status === 'yellow' ? '注意' : '危险';
              return [`${p.payload.rate}% (${statusLabel})`, '完成率'];
            }}
          />
          <Bar dataKey="rate" radius={[2, 2, 2, 2]}>
            {data.map((entry, index) => (
              <Cell key={index} fill={STATUS_COLORS[entry.status] ?? "var(--knit-grid)"} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
      {/* 图例 */}
      <div className="flex items-center gap-4 mt-2 text-xs" style={{ color: "var(--text-tertiary)" }}>
        <span className="flex items-center gap-1">
          <span className="w-3 h-2 rounded-sm" style={{ backgroundColor: "var(--success)" }} />
          良好
        </span>
        <span className="flex items-center gap-1">
          <span className="w-3 h-2 rounded-sm" style={{ backgroundColor: "var(--knit-thread-partial)" }} />
          注意
        </span>
        <span className="flex items-center gap-1">
          <span className="w-3 h-2 rounded-sm" style={{ backgroundColor: "var(--warning)" }} />
          危险
        </span>
      </div>
    </div>
  );
}
