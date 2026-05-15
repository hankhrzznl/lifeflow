"use client";

import { useState, useEffect, useMemo, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { BarChart as BarChartIcon, Flame, Timer, Target, Zap } from "lucide-react";
import Link from "next/link";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  Cell,
} from "recharts";
import { getFocusLogsByTimeRange } from "@/lib/db";
import EmptyState from "@/components/ui/EmptyState";
import { Skeleton } from "@/components/ui/Skeleton";
import WeeklyReport from "@/components/review/WeeklyReport";

type Period = "week" | "month";

const HEATMAP_HOURS = Array.from({ length: 24 }, (_, i) => i);
const HEATMAP_DAYS = ["一", "二", "三", "四", "五", "六", "日"];

const HEATMAP_GRADIENT = [
  "fill-gray-100 dark:fill-gray-800",
  "fill-indigo-50 dark:fill-indigo-950",
  "fill-indigo-100 dark:fill-indigo-900",
  "fill-indigo-200 dark:fill-indigo-800",
  "fill-indigo-300 dark:fill-indigo-700",
  "fill-indigo-500 dark:fill-indigo-500",
];

interface DayData {
  date: string;
  minutes: number;
  sessions: number;
}

interface PeriodStats {
  dailyFocus: DayData[];
  totalMinutes: number;
  totalSessions: number;
  completedSessions: number;
  averageMinutesPerSession: number;
  completionRate: number;
  hourlyDistribution: number[][];
}

function getWeekRange(date: Date) {
  const d = new Date(date);
  const day = d.getDay();
  const diff = d.getDate() - day + (day === 0 ? -6 : 1);
  const monday = new Date(d.setDate(diff));
  monday.setHours(0, 0, 0, 0);
  const sunday = new Date(monday);
  sunday.setDate(sunday.getDate() + 6);
  sunday.setHours(23, 59, 59, 999);
  return { start: monday.getTime(), end: sunday.getTime() };
}

function getMonthRange(date: Date) {
  const start = new Date(date.getFullYear(), date.getMonth(), 1);
  start.setHours(0, 0, 0, 0);
  const end = new Date(date.getFullYear(), date.getMonth() + 1, 0);
  end.setHours(23, 59, 59, 999);
  return { start: start.getTime(), end: end.getTime() };
}

function formatPeriodLabel(period: Period, currentDate: Date) {
  if (period === "week") {
    const { start, end } = getWeekRange(currentDate);
    const s = new Date(start);
    const e = new Date(end);
    return `${s.getMonth() + 1}月${s.getDate()}日 - ${e.getMonth() + 1}月${e.getDate()}日`;
  }
  return `${currentDate.getFullYear()}年${currentDate.getMonth() + 1}月`;
}

function getHeatIntensity(value: number, maxValue: number): number {
  if (maxValue === 0 || value === 0) return 0;
  const ratio = value / maxValue;
  if (ratio < 0.1) return 1;
  if (ratio < 0.3) return 2;
  if (ratio < 0.5) return 3;
  if (ratio < 0.75) return 4;
  return 5;
}

function FocusHeatmap({ data }: { data: number[][] }) {
  const maxValue = Math.max(...data.flat(), 1);

  return (
    <div className="bg-[var(--card-bg)] rounded-2xl border border-[var(--card-border)] p-4 md:p-6">
      <h3 className="text-sm font-semibold text-[var(--foreground)] mb-4 flex items-center gap-2">
        <Flame className="w-4 h-4 text-orange-400" />
        专注时段热力图
      </h3>

      <div className="w-full overflow-x-auto" style={{ minWidth: 280 }}>
        <svg
          viewBox="0 0 350 220"
          className="w-full h-auto"
          style={{ maxWidth: 700 }}
        >
          {HEATMAP_DAYS.map((d, i) => (
            <text
              key={`day-${i}`}
              x={22}
              y={28 + i * 26}
              textAnchor="middle"
              fontSize={11}
              fill="currentColor"
              className="fill-gray-500 dark:fill-gray-400"
            >
              {d}
            </text>
          ))}

          {HEATMAP_HOURS.map((h) => (
            <text
              key={`hour-${h}`}
              x={40 + h * 12.5}
              y={16}
              textAnchor="middle"
              fontSize={9}
              fill="currentColor"
              className="fill-gray-400 dark:fill-gray-500"
            >
              {h % 3 === 0 ? `${h}` : ""}
            </text>
          ))}

          {data.map((day, dayIdx) =>
            day.map((value, hour) => {
              const intensity = getHeatIntensity(value, maxValue);
              return (
                <rect
                  key={`${dayIdx}-${hour}`}
                  x={30 + hour * 12.5}
                  y={18 + dayIdx * 26}
                  width={11.5}
                  height={24}
                  rx={3}
                  className={
                    HEATMAP_GRADIENT[intensity] || HEATMAP_GRADIENT[0]
                  }
                />
              );
            })
          )}
        </svg>
      </div>

      <div className="flex items-center gap-2 mt-4 justify-end">
        <span className="text-[10px] text-gray-400">少</span>
        {HEATMAP_GRADIENT.map((fill, i) => (
          <div key={i} className={`w-3 h-3 rounded-sm ${fill}`} />
        ))}
        <span className="text-[10px] text-gray-400">多</span>
      </div>
    </div>
  );
}

const cardVariants = {
  hidden: { opacity: 0, y: 12 },
  visible: (i: number) => ({
    opacity: 1,
    y: 0,
    transition: { delay: i * 0.08, duration: 0.35 },
  }),
};

const statCardConfigs = [
  {
    key: "totalMinutes",
    label: "总专注",
    unit: "分钟",
    icon: Timer,
    iconColor: "text-indigo-500",
    bgColor: "bg-indigo-50 dark:bg-indigo-950",
  },
  {
    key: "totalSessions",
    label: "专注次数",
    unit: "次",
    icon: Flame,
    iconColor: "text-orange-500",
    bgColor: "bg-orange-50 dark:bg-orange-950",
  },
  {
    key: "averageMinutesPerSession",
    label: "平均每次",
    unit: "分钟",
    icon: Target,
    iconColor: "text-emerald-500",
    bgColor: "bg-emerald-50 dark:bg-emerald-950",
  },
  {
    key: "completionRate",
    label: "完成率",
    unit: "%",
    icon: Zap,
    iconColor: "text-blue-500",
    bgColor: "bg-blue-50 dark:bg-blue-950",
  },
];

export default function ReviewPage() {
  const [period, setPeriod] = useState<Period>("week");
  const [currentDate, setCurrentDate] = useState(new Date());
  const [stats, setStats] = useState<PeriodStats | null>(null);
  const [loading, setLoading] = useState(true);

  const dateRange = useMemo(() => {
    return period === "week"
      ? getWeekRange(currentDate)
      : getMonthRange(currentDate);
  }, [period, currentDate]);

  const fetchStats = useCallback(async () => {
    setLoading(true);
    try {
      const logs = await getFocusLogsByTimeRange(
        dateRange.start,
        dateRange.end
      );

      const dailyMap = new Map<
        string,
        { minutes: number; sessions: number }
      >();

      const hourlyDistribution: number[][] = Array.from({ length: 7 }, () =>
        Array(24).fill(0)
      );

      let totalMinutes = 0;
      const totalSessions = logs.length;
      let completedSessions = 0;

      for (const log of logs) {
        totalMinutes += Math.round(log.duration / 60);
        if (log.completed) completedSessions++;

        const logDate = new Date(log.startTime);
        const dateStr = `${logDate.getFullYear()}-${String(logDate.getMonth() + 1).padStart(2, "0")}-${String(logDate.getDate()).padStart(2, "0")}`;

        if (!dailyMap.has(dateStr)) {
          dailyMap.set(dateStr, { minutes: 0, sessions: 0 });
        }
        const dayEntry = dailyMap.get(dateStr)!;
        dayEntry.minutes += Math.round(log.duration / 60);
        dayEntry.sessions++;

        let dayOfWeek = logDate.getDay();
        dayOfWeek = dayOfWeek === 0 ? 6 : dayOfWeek - 1;
        const hour = logDate.getHours();
        if (dayOfWeek >= 0 && dayOfWeek < 7 && hour >= 0 && hour < 24) {
          hourlyDistribution[dayOfWeek][hour] += Math.round(log.duration / 60);
        }
      }

      const dailyFocus: DayData[] = [];
      const sorted = Array.from(dailyMap.entries()).sort(
        ([a], [b]) => a.localeCompare(b)
      );

      if (period === "week") {
        const { start } = dateRange;
        const monday = new Date(start);
        for (let i = 0; i < 7; i++) {
          const d = new Date(monday);
          d.setDate(d.getDate() + i);
          const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
          const entry = dailyMap.get(key);
          dailyFocus.push({
            date: key,
            minutes: entry?.minutes ?? 0,
            sessions: entry?.sessions ?? 0,
          });
        }
      } else {
        for (const [key, entry] of sorted) {
          dailyFocus.push({
            date: key,
            minutes: entry.minutes,
            sessions: entry.sessions,
          });
        }
      }

      const avgMinutesPerSession =
        totalSessions > 0
          ? Math.round((totalMinutes / totalSessions) * 10) / 10
          : 0;
      const completionRate =
        totalSessions > 0
          ? Math.round((completedSessions / totalSessions) * 100)
          : 0;

      setStats({
        dailyFocus,
        totalMinutes,
        totalSessions,
        completedSessions,
        averageMinutesPerSession: avgMinutesPerSession,
        completionRate,
        hourlyDistribution,
      });
    } finally {
      setLoading(false);
    }
  }, [dateRange, period]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    fetchStats();
  }, [fetchStats]);

  function navigatePeriod(direction: -1 | 1) {
    setCurrentDate((prev) => {
      const d = new Date(prev);
      if (period === "week") {
        d.setDate(d.getDate() + direction * 7);
      } else {
        d.setMonth(d.getMonth() + direction);
      }
      return d;
    });
  }

  const statCards = useMemo(() => {
    if (!stats) return statCardConfigs.map((c) => ({ ...c, value: "--" }));
    return statCardConfigs.map((c) => ({
      ...c,
      value: String(stats[c.key as keyof PeriodStats] ?? "--"),
    }));
  }, [stats]);

  const reportPayload = useMemo(() => {
    if (!stats) return null;

    let bestDay: { date: string; minutes: number } | null = null;
    let hourlyPeak: { hour: number; minutes: number } | null = null;

    for (const d of stats.dailyFocus) {
      if (!bestDay || d.minutes > bestDay.minutes) {
        bestDay = { date: d.date, minutes: d.minutes };
      }
    }

    if (bestDay && bestDay.minutes === 0) {
      bestDay = null;
    }

    let peakHour = 0;
    let peakMinutes = 0;
    for (let h = 0; h < 24; h++) {
      let total = 0;
      for (let d = 0; d < 7; d++) {
        total += stats.hourlyDistribution[d]?.[h] ?? 0;
      }
      if (total > peakMinutes) {
        peakMinutes = total;
        peakHour = h;
      }
    }

    if (peakMinutes > 0) {
      hourlyPeak = { hour: peakHour, minutes: peakMinutes };
    }

    return {
      period: {
        start: new Date(dateRange.start).toISOString(),
        end: new Date(dateRange.end).toISOString(),
        type: period,
      },
      stats: {
        totalMinutes: stats.totalMinutes,
        totalSessions: stats.totalSessions,
        completedSessions: stats.completedSessions,
        averageSessionMinutes: stats.averageMinutesPerSession,
        completionRate: stats.completionRate,
        bestDay,
        dailyBreakdown: stats.dailyFocus,
        hourlyPeak,
      },
    };
  }, [stats, dateRange, period]);

  const hasData =
    stats && stats.totalSessions > 0;

  const barChartData = useMemo(() => {
    if (!stats) return [];
    return stats.dailyFocus.map((d) => ({
      name: d.date.slice(5),
      date: d.date,
      minutes: d.minutes,
      sessions: d.sessions,
    }));
  }, [stats]);

  return (
    <div className="flex flex-col h-full">
      <header className="flex-shrink-0 flex items-center justify-between px-4 py-3 border-b border-[var(--card-border)] bg-[var(--card-bg)]">
        <div className="flex items-center gap-2">
          <BarChartIcon className="w-5 h-5 text-primary-500" />
          <h1 className="text-lg font-semibold text-[var(--foreground)]">回顾</h1>
        </div>
      </header>

      <div className="flex-1 overflow-y-auto">
        <div className="px-4 py-4 flex flex-col gap-4">
          <div className="sticky top-0 z-10 py-2 bg-[var(--background)]/80 backdrop-blur-md">
            <div className="flex items-center justify-between">
              <button
                onClick={() => navigatePeriod(-1)}
                className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
              >
                <svg
                  width="16"
                  height="16"
                  viewBox="0 0 16 16"
                  fill="none"
                  className="text-[var(--foreground)]"
                >
                  <path
                    d="M10 4L6 8L10 12"
                    stroke="currentColor"
                    strokeWidth="1.5"
                    strokeLinecap="round"
                  />
                </svg>
              </button>

              <div className="flex bg-gray-100 dark:bg-gray-800 rounded-lg p-0.5">
                {(["week", "month"] as Period[]).map((p) => (
                  <button
                    key={p}
                    onClick={() => setPeriod(p)}
                    className={`px-4 py-1.5 rounded-md text-sm font-medium transition-colors ${
                      period === p
                        ? "bg-white dark:bg-gray-700 text-[var(--foreground)] shadow-sm"
                        : "text-[var(--muted-foreground)]"
                    }`}
                  >
                    {p === "week" ? "周" : "月"}
                  </button>
                ))}
              </div>

              <button
                onClick={() => navigatePeriod(1)}
                className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
              >
                <svg
                  width="16"
                  height="16"
                  viewBox="0 0 16 16"
                  fill="none"
                  className="text-[var(--foreground)]"
                >
                  <path
                    d="M6 4L10 8L6 12"
                    stroke="currentColor"
                    strokeWidth="1.5"
                    strokeLinecap="round"
                  />
                </svg>
              </button>
            </div>

            <p className="text-center text-xs text-[var(--muted-foreground)] mt-2">
              {formatPeriodLabel(period, currentDate)}
            </p>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <AnimatePresence mode="wait">
              {loading ? (
                <div
                  key="loading-cards"
                  className="contents"
                >
                  {Array.from({ length: 4 }).map((_, i) => (
                    <Skeleton key={i} className="h-24 rounded-2xl" />
                  ))}
                </div>
              ) : (
                statCards.map((card, i) => (
                  <motion.div
                    key={`${card.key}-${card.value}`}
                    className="bg-[var(--card-bg)] rounded-2xl border border-[var(--card-border)] p-4"
                    custom={i}
                    variants={cardVariants}
                    initial="hidden"
                    animate="visible"
                  >
                    <div
                      className={`w-8 h-8 rounded-lg ${card.bgColor} flex items-center justify-center mb-3`}
                    >
                      <card.icon
                        className={`w-4 h-4 ${card.iconColor}`}
                      />
                    </div>
                    <p className="text-xs text-[var(--muted-foreground)] mb-0.5">
                      {card.label}
                    </p>
                    <p className="text-xl font-bold text-[var(--foreground)] tracking-tight">
                      {card.value}
                      <span className="text-xs font-normal text-[var(--muted-foreground)] ml-0.5">
                        {card.unit}
                      </span>
                    </p>
                  </motion.div>
                ))
              )}
            </AnimatePresence>
          </div>

          {loading ? (
            <Skeleton className="h-64 rounded-2xl" />
          ) : hasData ? (
            <div className="bg-[var(--card-bg)] rounded-2xl border border-[var(--card-border)] p-4 md:p-6">
              <h3 className="text-sm font-semibold text-[var(--foreground)] mb-4 flex items-center gap-2">
                <BarChartIcon className="w-4 h-4 text-indigo-500" />
                每日专注时长
              </h3>

              <ResponsiveContainer width="100%" height={250}>
                <BarChart data={barChartData}>
                  <XAxis
                    dataKey="name"
                    axisLine={false}
                    tickLine={false}
                    tick={{ fill: "#6b7280", fontSize: 12 }}
                  />
                  <YAxis
                    tickFormatter={(v) => `${v}m`}
                    axisLine={false}
                    tickLine={false}
                    tick={{ fill: "#6b7280", fontSize: 12 }}
                  />
                  <Tooltip
                    formatter={(value) => {
                      const v = Number(value) || 0;
                      return [`${Math.floor(v / 60)}h ${v % 60}m`, "专注时长"];
                    }}
                    labelFormatter={(label) => String(label || "")}
                    contentStyle={{
                      borderRadius: 12,
                      border: "none",
                      boxShadow: "0 4px 12px rgba(0,0,0,0.1)",
                      fontSize: 13,
                    }}
                  />
                  <Bar
                    dataKey="minutes"
                    radius={[4, 4, 0, 0]}
                    maxBarSize={48}
                  >
                    {barChartData.map((entry, index) => (
                      <Cell
                        key={`cell-${index}`}
                        fill="#6366f1"
                        fillOpacity={entry.minutes > 0 ? 1 : 0.15}
                      />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          ) : (
            <div className="bg-[var(--card-bg)] rounded-2xl border border-[var(--card-border)] p-4 md:p-6">
              <h3 className="text-sm font-semibold text-[var(--foreground)] mb-4 flex items-center gap-2">
                <BarChartIcon className="w-4 h-4 text-indigo-500" />
                每日专注时长
              </h3>
              <EmptyState
                icon={
                  <BarChartIcon className="w-10 h-10 text-gray-300 dark:text-gray-600" />
                }
                title="暂无数据"
                description="选中周期内没有专注记录"
              />
            </div>
          )}

          {loading ? (
            <Skeleton className="h-56 rounded-2xl" />
          ) : hasData ? (
            <FocusHeatmap
              data={stats?.hourlyDistribution ?? Array.from({ length: 7 }, () => Array(24).fill(0))}
            />
          ) : (
            <div className="bg-[var(--card-bg)] rounded-2xl border border-[var(--card-border)] p-4 md:p-6">
              <h3 className="text-sm font-semibold text-[var(--foreground)] mb-4 flex items-center gap-2">
                <Flame className="w-4 h-4 text-orange-400" />
                专注时段热力图
              </h3>
              <EmptyState
                icon={
                  <Flame className="w-10 h-10 text-gray-300 dark:text-gray-600" />
                }
                title="暂无数据"
                description="开始专注后将在此显示热力图"
              />
            </div>
          )}

          {!loading && reportPayload && (
            <WeeklyReport
              period={reportPayload.period}
              stats={reportPayload.stats}
              hasData={hasData ?? false}
            />
          )}

          {!loading && !hasData && (
            <div className="bg-[var(--card-bg)] rounded-2xl border border-[var(--card-border)] p-6 text-center">
              <p className="text-sm text-[var(--muted-foreground)] mb-4">
                没有任何专注数据？去开始第一段专注吧
              </p>
              <Link
                href="/plugins/focus-timer"
                className="inline-flex items-center gap-1.5 bg-indigo-500 text-white px-4 py-2 rounded-xl text-sm font-medium hover:bg-indigo-600 transition-colors"
              >
                <Timer className="w-4 h-4" />
                开始专注
              </Link>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
