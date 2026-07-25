"use client";

import { useEffect, useState } from "react";
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, BarChart, Bar, PieChart, Pie, Cell,
} from "recharts";
import {
  TrendingUp, CheckCircle2, CalendarDays, Target,
  Moon, Droplets, Dumbbell, PieChartIcon, Goal, Flag,
} from "lucide-react";
import { daylogDB, type Item } from "@/lib/db/daylog.db";
import { efficiencyDB, type Project, type Goal as EffGoal } from "@/lib/db/efficiency.db";
import { healthDB, type WaterLog, type SleepLog, type MedicineLog } from "@/lib/db/health.db";
import { accountingDB, type Transaction } from "@/lib/db/accounting.db";

// ─── helpers ──────────────────────────────────────────────────

function getDatesForMonth(year: number, month: number): string[] {
  const dates: string[] = [];
  const start = new Date(year, month - 1, 1);
  const end = new Date(year, month, 0);
  const current = new Date(start);
  while (current <= end) {
    dates.push(current.toISOString().slice(0, 10));
    current.setDate(current.getDate() + 1);
  }
  return dates;
}

function weekdayLabel(dateStr: string): string {
  const d = new Date(dateStr + "T00:00:00");
  const weekdays = ["周日", "周一", "周二", "周三", "周四", "周五", "周六"];
  return weekdays[d.getDay()];
}

function getWeekOfMonth(dateStr: string, year: number, month: number): number {
  const d = new Date(dateStr + "T00:00:00");
  const firstDay = new Date(year, month - 1, 1);
  const firstDayWeekday = firstDay.getDay();
  const dayOfMonth = d.getDate();
  return Math.ceil((dayOfMonth + firstDayWeekday) / 7);
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

// ─── Props ────────────────────────────────────────────────────

interface ReviewMonthlyProps {
  year: number;
  month: number;
}

// ─── Component ────────────────────────────────────────────────

export default function ReviewMonthly({ year, month }: ReviewMonthlyProps) {
  const dates = getDatesForMonth(year, month);
  const startDate = dates[0];
  const endDate = dates[dates.length - 1];

  const [items, setItems] = useState<Item[]>([]);
  const [waterLogs, setWaterLogs] = useState<WaterLog[]>([]);
  const [sleepLogs, setSleepLogs] = useState<SleepLog[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [goals, setGoals] = useState<EffGoal[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      setLoading(true);
      try {
        const [
          allItems, allWaterLogs, allSleepLogs, allProjects, allGoals,
        ] = await Promise.all([
          daylogDB.items
            .where("date")
            .between(startDate, endDate, true, true)
            .toArray(),
          healthDB.waterLogs
            .where("date")
            .between(startDate, endDate, true, true)
            .toArray(),
          healthDB.sleepLogs
            .where("date")
            .between(startDate, endDate, true, true)
            .toArray(),
          efficiencyDB.projects.toArray(),
          efficiencyDB.goals.toArray(),
        ]);
        setItems(allItems);
        setWaterLogs(allWaterLogs);
        setSleepLogs(allSleepLogs);
        setProjects(allProjects);
        setGoals(allGoals);
      } catch (e) {
        console.error("ReviewMonthly load error:", e);
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [year, month, startDate, endDate]);

  if (loading) {
    return (
      <div className="space-y-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="skeleton h-40 rounded-2xl" />
        ))}
      </div>
    );
  }

  // ── week grouping ───────────────────────────────────────────
  const weekMap = new Map<number, string[]>();
  for (const d of dates) {
    const w = getWeekOfMonth(d, year, month);
    if (!weekMap.has(w)) weekMap.set(w, []);
    weekMap.get(w)!.push(d);
  }
  const weeks = Array.from(weekMap.entries()).sort((a, b) => a[0] - b[0]);

  const totalItems = items.length;
  const completionRate = totalItems > 0
    ? Math.round((items.filter((i) => i.isCompleted).length / totalItems) * 100)
    : 0;
  const activeDays = dates.filter((d) =>
    items.filter((it) => it.date === d).length > 0
  ).length;

  // ── 4-week completion rate ─────────────────────────────────
  const weekCompletion = weeks.map(([w, ds]) => {
    const weekItems = items.filter((it) => ds.includes(it.date));
    const done = weekItems.filter((i) => i.isCompleted).length;
    return {
      week: `第${w}周`,
      rate: weekItems.length > 0 ? Math.round((done / weekItems.length) * 100) : 0,
      total: weekItems.length,
    };
  });

  // ── continuous items (>=3 weeks) ────────────────────────────
  const itemWeekMap = new Map<string, Map<number, number>>();
  for (const it of items) {
    const w = getWeekOfMonth(it.date, year, month);
    if (!itemWeekMap.has(it.title)) {
      itemWeekMap.set(it.title, new Map());
    }
    const entry = itemWeekMap.get(it.title)!;
    const mins = it.plannedStart && it.plannedEnd
      ? Math.max(0,
          (parseInt(it.plannedEnd.split(":")[0]) * 60 + parseInt(it.plannedEnd.split(":")[1])) -
          (parseInt(it.plannedStart.split(":")[0]) * 60 + parseInt(it.plannedStart.split(":")[1])))
      : 0;
    entry.set(w, (entry.get(w) || 0) + mins);
  }
  const continuousItems = Array.from(itemWeekMap.entries())
    .filter(([, wm]) => wm.size >= 3)
    .map(([title, wm]) => ({
      title,
      weeks: weeks.map(([w]) => ({
        week: `第${w}周`,
        minutes: wm.get(w) || 0,
        avg: wm.size > 0 ? (Array.from(wm.values()).reduce((a, b) => a + b, 0) / wm.size) : 0,
      })),
      avgMinutes: wm.size > 0 ? Math.round(Array.from(wm.values()).reduce((a, b) => a + b, 0) / wm.size) : 0,
    }));

  // ── module trends ──────────────────────────────────────────
  const moduleTrends = weeks.map(([w, ds]) => {
    const sleepLogsInWeek = sleepLogs.filter((s) => ds.includes(s.date));
    const waterInWeek = waterLogs.filter((wl) => ds.includes(wl.date));
    const exerciseInWeek = items.filter(
      (it) => ds.includes(it.date) && it.sourceType === "fitness"
    );
    return {
      week: `第${w}周`,
      sleepAvg: sleepLogsInWeek.length > 0
        ? `${sleepLogsInWeek.filter((s) => s.isOnTime).length}/${sleepLogsInWeek.length}`
        : "-",
      waterAvg: waterInWeek.length > 0
        ? Math.round(waterInWeek.reduce((s, wl) => s + wl.amount, 0) / ds.length)
        : 0,
      exerciseCount: exerciseInWeek.length,
    };
  });

  // ── goal progress ──────────────────────────────────────────
  const monthGoals = goals.filter((g) => {
    if (g.status === "archived") return false;
    if (g.status === "completed" && g.completedAt) {
      const cd = new Date(g.completedAt);
      const cm = cd.getMonth() + 1;
      const cy = cd.getFullYear();
      return cy === year && cm === month;
    }
    return g.status === "active" || g.status === "paused";
  });

  // ── project pie ────────────────────────────────────────────
  const projectTime = new Map<string, number>();
  for (const it of items) {
    const pid = it.projectId || "none";
    const p = projects.find((pr) => pr.id === pid);
    const name = p?.name || "无项目";
    const mins = it.plannedStart && it.plannedEnd
      ? Math.max(0,
          (parseInt(it.plannedEnd.split(":")[0]) * 60 + parseInt(it.plannedEnd.split(":")[1])) -
          (parseInt(it.plannedStart.split(":")[0]) * 60 + parseInt(it.plannedStart.split(":")[1])))
      : 0;
    projectTime.set(name, (projectTime.get(name) || 0) + mins);
  }
  const projectPieData = Array.from(projectTime.entries())
    .map(([name, value]) => ({ name, value: value / 60 }))
    .sort((a, b) => b.value - a.value);

  return (
    <div className="space-y-4">
      {/* ── Stats Row ────────────────────────────────────────── */}
      <div className="grid grid-cols-3 gap-3">
        <StatCard
          icon={CheckCircle2}
          label="完成率"
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
          icon={TrendingUp}
          label="活跃天数"
          value={`${activeDays}`}
          color="text-[var(--state-warning)]"
          bg="bg-orange-50 dark:bg-orange-950/30"
        />
      </div>

      {/* ── Week Completion Bar Chart ────────────────────────── */}
      <SectionCard icon={BarChartIcon} title="各周完成率">
        <ResponsiveContainer width="100%" height={180}>
          <BarChart data={weekCompletion} margin={{ top: 8, right: 8, left: -20, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
            <XAxis dataKey="week" tick={{ fontSize: 12, fill: "var(--muted-foreground)" }} />
            <YAxis domain={[0, 100]} tick={{ fontSize: 12, fill: "var(--muted-foreground)" }} />
            <Tooltip
              contentStyle={{
                borderRadius: 12, border: "1px solid var(--border)",
                background: "var(--card-bg)", fontSize: 13,
              }}
              formatter={(_value: any) => [`${Number(_value)}%`, "完成率"]}
            />
            <Bar dataKey="rate" radius={[8, 8, 0, 0]} fill="#2563EB" />
          </BarChart>
        </ResponsiveContainer>
      </SectionCard>

      {/* ── Continuous Items ─────────────────────────────────── */}
      {continuousItems.length > 0 && (
        <SectionCard icon={ActivityIcon} title="持续事项（>=3周）">
          <div className="space-y-4">
            {continuousItems.map((ci) => (
              <div key={ci.title}>
                <div className="flex items-center justify-between mb-2">
                  <p className="text-sm font-medium text-[var(--foreground)]">{ci.title}</p>
                  <span className="text-xs text-[var(--muted-foreground)]">
                    周均 {ci.avgMinutes}min
                  </span>
                </div>
                <ResponsiveContainer width="100%" height={50}>
                  <BarChart data={ci.weeks} margin={{ top: 0, right: 0, left: 0, bottom: 0 }}>
                    <Bar dataKey="minutes" radius={[4, 4, 0, 0]} fill="#8B5CF6" />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            ))}
          </div>
        </SectionCard>
      )}

      {/* ── Module Trends ────────────────────────────────────── */}
      <SectionCard icon={Droplets} title="模块趋势">
        <div className="grid grid-cols-3 gap-3">
          {moduleTrends.map((mt) => (
            <div
              key={mt.week}
              className="bg-[var(--muted)] rounded-xl p-3 text-center"
            >
              <p className="text-xs font-semibold text-[var(--foreground)] mb-2">{mt.week}</p>
              <div className="space-y-1.5">
                <div>
                  <p className="text-[10px] text-[var(--muted-foreground)] flex items-center justify-center gap-1">
                    <Moon className="w-2.5 h-2.5" /> 睡眠准时
                  </p>
                  <p className="text-xs font-medium text-[var(--foreground)]">{mt.sleepAvg}</p>
                </div>
                <div>
                  <p className="text-[10px] text-[var(--muted-foreground)] flex items-center justify-center gap-1">
                    <Droplets className="w-2.5 h-2.5" /> 饮水日均(ml)
                  </p>
                  <p className="text-xs font-medium text-[var(--foreground)]">{mt.waterAvg}</p>
                </div>
                <div>
                  <p className="text-[10px] text-[var(--muted-foreground)] flex items-center justify-center gap-1">
                    <Dumbbell className="w-2.5 h-2.5" /> 运动次数
                  </p>
                  <p className="text-xs font-medium text-[var(--foreground)]">{mt.exerciseCount}次</p>
                </div>
              </div>
            </div>
          ))}
        </div>
      </SectionCard>

      {/* ── Goal Progress ────────────────────────────────────── */}
      {monthGoals.length > 0 && (
        <SectionCard icon={Flag} title="目标进展">
          <div className="space-y-3">
            {monthGoals.map((g) => (
              <div key={g.id}>
                <div className="flex items-center justify-between mb-1.5">
                  <span className="text-sm font-medium text-[var(--foreground)]">
                    {g.title}
                  </span>
                  <span className="text-xs text-[var(--muted-foreground)]">
                    {g.progress}%
                  </span>
                </div>
                <div className="w-full h-2 bg-[var(--muted)] rounded-full overflow-hidden">
                  <div
                    className="h-full rounded-full transition-all duration-500"
                    style={{
                      width: `${g.progress}%`,
                      background: g.status === "completed"
                        ? "var(--state-success)"
                        : "var(--lifeflow-primary)",
                    }}
                  />
                </div>
              </div>
            ))}
          </div>
        </SectionCard>
      )}

      {/* ── Project Time Pie ─────────────────────────────────── */}
      {projectPieData.length > 0 && (
        <SectionCard icon={PieChartIcon} title="项目时间分布">
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

      {/* ── Range Info ────────────────────────────────────────── */}
      <div className="text-center text-xs text-[var(--muted-foreground)] pb-4">
        {year}年{month}月 ({toDateStr(startDate)} - {toDateStr(endDate)})
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

// ─── local icon alias ────────────────────────────────────────

function BarChartIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <line x1="18" y1="20" x2="18" y2="10" />
      <line x1="12" y1="20" x2="12" y2="4" />
      <line x1="6" y1="20" x2="6" y2="14" />
    </svg>
  );
}

function ActivityIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="22 12 18 12 15 21 9 3 6 12 2 12" />
    </svg>
  );
}
