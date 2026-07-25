"use client";

import { useEffect, useState } from "react";
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, BarChart, Bar, PieChart, Pie, Cell,
  Legend,
} from "recharts";
import {
  TrendingUp, CheckCircle2, Target, Flag,
  PieChartIcon, Sparkles, BarChart3, CalendarDays,
} from "lucide-react";
import { daylogDB, type Item } from "@/lib/db/daylog.db";
import { efficiencyDB, type Project, type Goal as EffGoal } from "@/lib/db/efficiency.db";

// ─── helpers ──────────────────────────────────────────────────

const MONTH_LABELS = [
  "1月", "2月", "3月", "4月", "5月", "6月",
  "7月", "8月", "9月", "10月", "11月", "12月",
];

function getMonthRange(year: number, month: number): { start: string; end: string } {
  const start = `${year}-${String(month).padStart(2, "0")}-01`;
  const lastDay = new Date(year, month, 0).getDate();
  const end = `${year}-${String(month).padStart(2, "0")}-${String(lastDay).padStart(2, "0")}`;
  return { start, end };
}

function toDateStr(dateStr: string): string {
  const d = new Date(dateStr + "T00:00:00");
  const m = d.getMonth() + 1;
  const day = d.getDate();
  const weekdays = ["周日", "周一", "周二", "周三", "周四", "周五", "周六"];
  return `${m}月${day}日 ${weekdays[d.getDay()]}`;
}

// ─── colors ───────────────────────────────────────────────────

const PIE_COLORS = [
  "#2563EB", "#10B981", "#F59E0B", "#EF4444", "#8B5CF6",
  "#EC4899", "#06B6D4", "#84CC16", "#F97316", "#6366F1",
];

const STACK_COLORS = [
  "#2563EB", "#10B981", "#F59E0B", "#EF4444", "#8B5CF6",
];

// ─── Props ────────────────────────────────────────────────────

interface ReviewYearlyProps {
  year: number;
}

// ─── Component ────────────────────────────────────────────────

export default function ReviewYearly({ year }: ReviewYearlyProps) {
  const prefix = `${year}-`;

  const [items, setItems] = useState<Item[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [goals, setGoals] = useState<EffGoal[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      setLoading(true);
      try {
        const [allItems, allProjects, allGoals] = await Promise.all([
          daylogDB.items
            .filter((i) => i.date.startsWith(prefix))
            .toArray(),
          efficiencyDB.projects.toArray(),
          efficiencyDB.goals.toArray(),
        ]);
        setItems(allItems);
        setProjects(allProjects);
        setGoals(allGoals);
      } catch (e) {
        console.error("ReviewYearly load error:", e);
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [year, prefix]);

  if (loading) {
    return (
      <div className="space-y-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="skeleton h-40 rounded-2xl" />
        ))}
      </div>
    );
  }

  // ── annual overview ────────────────────────────────────────
  const totalItems = items.length;
  const completedItems = items.filter((i) => i.isCompleted).length;
  const completionRate = totalItems > 0
    ? Math.round((completedItems / totalItems) * 100)
    : 0;
  const goalsCompleted = goals.filter((g) => {
    if (g.status !== "completed" || !g.completedAt) return false;
    const d = new Date(g.completedAt);
    return d.getFullYear() === year;
  }).length;
  const totalGoals = goals.filter((g) => g.status !== "archived").length;

  // ── 12-month completion trend ──────────────────────────────
  const monthTrend = Array.from({ length: 12 }, (_, i) => {
    const month = i + 1;
    const monthStr = String(month).padStart(2, "0");
    const monthItems = items.filter((it) => it.date.startsWith(`${year}-${monthStr}`));
    const done = monthItems.filter((it) => it.isCompleted).length;
    return {
      month: MONTH_LABELS[i],
      rate: monthItems.length > 0 ? Math.round((done / monthItems.length) * 100) : null,
      total: monthItems.length,
    };
  });

  // ── project stacked bar: 12 months x top 5 projects ────────
  const projectTimeByMonth = new Map<string, Map<number, number>>();
  const projectSet = new Set<string>();
  for (const it of items) {
    const pid = it.projectId || "none";
    const p = projects.find((pr) => pr.id === pid);
    const name = p?.name || "无项目";
    projectSet.add(name);
    const month = parseInt(it.date.slice(5, 7));
    if (!projectTimeByMonth.has(name)) {
      projectTimeByMonth.set(name, new Map());
    }
    const mins = it.plannedStart && it.plannedEnd
      ? Math.max(0,
          (parseInt(it.plannedEnd.split(":")[0]) * 60 + parseInt(it.plannedEnd.split(":")[1])) -
          (parseInt(it.plannedStart.split(":")[0]) * 60 + parseInt(it.plannedStart.split(":")[1])))
      : 0;
    const pm = projectTimeByMonth.get(name)!;
    pm.set(month, (pm.get(month) || 0) + mins);
  }

  // Get top 5 projects by total time
  const projectTotals = Array.from(projectTimeByMonth.entries())
    .map(([name, months]) => ({
      name,
      total: Array.from(months.values()).reduce((a, b) => a + b, 0),
    }))
    .sort((a, b) => b.total - a.total);
  const topProjects = projectTotals.slice(0, 5).map((p) => p.name);

  const stackedData = Array.from({ length: 12 }, (_, i) => {
    const month = i + 1;
    const entry: Record<string, number | string> = { month: MONTH_LABELS[i] };
    for (const proj of topProjects) {
      const m = projectTimeByMonth.get(proj);
      entry[proj] = m ? (m.get(month) || 0) / 60 : 0;
    }
    return entry;
  });

  // ── monthly goals ──────────────────────────────────────────
  const goalsByMonth = Array.from({ length: 12 }, (_, i) => {
    const month = i + 1;
    const monthStr = String(month).padStart(2, "0");
    const created = goals.filter((g) => {
      const d = new Date(g.createdAt);
      return d.getFullYear() === year && d.getMonth() + 1 === month;
    }).length;
    const completed = goals.filter((g) => {
      if (g.status !== "completed" || !g.completedAt) return false;
      const d = new Date(g.completedAt);
      return d.getFullYear() === year && d.getMonth() + 1 === month;
    }).length;
    return { month: MONTH_LABELS[i], created, completed };
  });

  // ── annual project pie ─────────────────────────────────────
  const projectPieData = projectTotals
    .map(({ name, total }) => ({ name, value: total / 60 }))
    .slice(0, 10);

  return (
    <div className="space-y-4">
      {/* ── Annual Overview ──────────────────────────────────── */}
      <div className="grid grid-cols-2 gap-3">
        <StatCard
          icon={CheckCircle2}
          label="年度完成率"
          value={`${completionRate}%`}
          color="text-[var(--state-success)]"
          bg="bg-green-50 dark:bg-green-950/30"
        />
        <StatCard
          icon={CalendarDays}
          label="事项总数"
          value={`${totalItems}`}
          color="text-[var(--lifeflow-primary)]"
          bg="bg-blue-50 dark:bg-blue-950/30"
        />
        <StatCard
          icon={Flag}
          label="完成目标"
          value={`${goalsCompleted}`}
          color="text-[var(--state-warning)]"
          bg="bg-orange-50 dark:bg-orange-950/30"
        />
        <StatCard
          icon={Target}
          label="活跃目标"
          value={`${totalGoals}`}
          color="text-[var(--state-info)]"
          bg="bg-indigo-50 dark:bg-indigo-950/30"
        />
      </div>

      {/* ── 12-Month Completion Trend ────────────────────────── */}
      <SectionCard icon={TrendingUp} title="月度完成率趋势">
        <ResponsiveContainer width="100%" height={200}>
          <LineChart data={monthTrend} margin={{ top: 8, right: 8, left: -20, bottom: 0 }}>
            <defs>
              <linearGradient id="yearlyGradient" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#2563EB" stopOpacity={0.3} />
                <stop offset="100%" stopColor="#2563EB" stopOpacity={0.02} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
            <XAxis dataKey="month" tick={{ fontSize: 11, fill: "var(--muted-foreground)" }} />
            <YAxis domain={[0, 100]} tick={{ fontSize: 12, fill: "var(--muted-foreground)" }} />
            <Tooltip
              contentStyle={{
                borderRadius: 12, border: "1px solid var(--border)",
                background: "var(--card-bg)", fontSize: 13,
              }}
              formatter={(_value: any) => [_value != null ? `${Number(_value)}%` : "无数据", "完成率"]}
            />
            <Line
              type="monotone"
              dataKey="rate"
              stroke="#2563EB"
              strokeWidth={2.5}
              dot={{ r: 4, fill: "#2563EB", strokeWidth: 0 }}
              activeDot={{ r: 6 }}
              connectNulls={false}
              fill="url(#yearlyGradient)"
            />
          </LineChart>
        </ResponsiveContainer>
      </SectionCard>

      {/* ── Project Stacked Bar ──────────────────────────────── */}
      {topProjects.length > 0 && (
        <SectionCard icon={BarChart3} title="项目时间分布（Top 5）">
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={stackedData} margin={{ top: 8, right: 8, left: -20, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
              <XAxis dataKey="month" tick={{ fontSize: 11, fill: "var(--muted-foreground)" }} />
              <YAxis tick={{ fontSize: 12, fill: "var(--muted-foreground)" }} />
              <Tooltip
                contentStyle={{
                  borderRadius: 12, border: "1px solid var(--border)",
                  background: "var(--card-bg)", fontSize: 13,
                }}
                formatter={(_value: any) => [`${Number(_value).toFixed(1)}h`]}
              />
              <Legend
                wrapperStyle={{ fontSize: 12 }}
                iconType="circle"
                iconSize={8}
              />
              {topProjects.map((proj, idx) => (
                <Bar
                  key={proj}
                  dataKey={proj}
                  stackId="a"
                  fill={STACK_COLORS[idx % STACK_COLORS.length]}
                  radius={idx === topProjects.length - 1 ? [6, 6, 0, 0] : [0, 0, 0, 0]}
                />
              ))}
            </BarChart>
          </ResponsiveContainer>
        </SectionCard>
      )}

      {/* ── Monthly Goals ────────────────────────────────────── */}
      <SectionCard icon={Flag} title="月度目标">
        <ResponsiveContainer width="100%" height={200}>
          <BarChart data={goalsByMonth} margin={{ top: 8, right: 8, left: -20, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
            <XAxis dataKey="month" tick={{ fontSize: 11, fill: "var(--muted-foreground)" }} />
            <YAxis allowDecimals={false} tick={{ fontSize: 12, fill: "var(--muted-foreground)" }} />
            <Tooltip
              contentStyle={{
                borderRadius: 12, border: "1px solid var(--border)",
                background: "var(--card-bg)", fontSize: 13,
              }}
            />
            <Legend
              wrapperStyle={{ fontSize: 12 }}
              iconType="circle"
              iconSize={8}
            />
            <Bar dataKey="created" name="新建" fill="#2563EB" radius={[6, 6, 0, 0]} />
            <Bar dataKey="completed" name="完成" fill="#34C759" radius={[6, 6, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </SectionCard>

      {/* ── Annual Project Pie ───────────────────────────────── */}
      {projectPieData.length > 0 && (
        <SectionCard icon={PieChartIcon} title="年度项目时间占比">
          <ResponsiveContainer width="100%" height={200}>
            <PieChart>
              <Pie
                data={projectPieData}
                cx="50%" cy="50%"
                innerRadius={45} outerRadius={85}
                dataKey="value"
                paddingAngle={2}
              >
                {projectPieData.map((_, idx) => (
                  <Cell key={idx} fill={PIE_COLORS[idx % PIE_COLORS.length]} />
                ))}
              </Pie>
              <Tooltip
                contentStyle={{
                  borderRadius: 12, border: "1px solid var(--border)",
                  background: "var(--card-bg)", fontSize: 13,
                }}
                formatter={(_value: any) => [`${Number(_value).toFixed(1)}h`]}
              />
            </PieChart>
          </ResponsiveContainer>
          <div className="flex flex-wrap gap-x-4 gap-y-1 mt-2">
            {projectPieData.slice(0, 6).map((p, idx) => (
              <div key={p.name} className="flex items-center gap-1.5 text-xs">
                <span
                  className="w-2 h-2 rounded-full"
                  style={{ background: PIE_COLORS[idx % PIE_COLORS.length] }}
                />
                <span className="text-[var(--foreground)]">{p.name}</span>
                <span className="text-[var(--muted-foreground)]">{p.value.toFixed(1)}h</span>
              </div>
            ))}
          </div>
        </SectionCard>
      )}

      {/* ── AI Insight Placeholder ───────────────────────────── */}
      <div className="bg-[var(--card-bg)] rounded-2xl shadow-sm p-6 border border-dashed border-[var(--border)]">
        <div className="flex flex-col items-center justify-center text-center">
          <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-indigo-100 to-violet-100 dark:from-indigo-900/30 dark:to-violet-900/30 flex items-center justify-center mb-3">
            <Sparkles className="w-7 h-7 text-indigo-400" />
          </div>
          <h3 className="text-base font-semibold text-[var(--foreground)] mb-1">
            AI 年度分析
          </h3>
          <p className="text-sm text-[var(--muted-foreground)]">
            AI 分析即将上线
          </p>
          <p className="text-xs text-[var(--muted-foreground)] mt-1 opacity-60">
            基于一年的数据，智能生成年度复盘报告、趋势预测与成长建议
          </p>
        </div>
      </div>

      {/* ── Range Info ────────────────────────────────────────── */}
      <div className="text-center text-xs text-[var(--muted-foreground)] pb-4">
        {year}年 1月1日 - 12月31日
      </div>
    </div>
  );
}

// ─── Sub-components ─────────────────────────────────────────

function StatCard({
  icon: Icon, label, value, color, bg,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: string;
  color: string;
  bg: string;
}) {
  return (
    <div className="bg-[var(--card-bg)] rounded-2xl shadow-sm p-4">
      <div className={`w-9 h-9 rounded-xl ${bg} flex items-center justify-center mb-2`}>
        <Icon className={`w-5 h-5 ${color}`} />
      </div>
      <div className="text-xl font-bold text-[var(--foreground)]">{value}</div>
      <div className="text-xs text-[var(--muted-foreground)]">{label}</div>
    </div>
  );
}

function SectionCard({
  icon: Icon, title, children,
}: {
  icon: React.ComponentType<{ className?: string }>;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div className="bg-[var(--card-bg)] rounded-2xl shadow-sm p-4">
      <div className="flex items-center gap-2 mb-3">
        <Icon className="w-4 h-4 text-[var(--lifeflow-primary)]" />
        <h3 className="text-sm font-semibold text-[var(--foreground)]">{title}</h3>
      </div>
      {children}
    </div>
  );
}
