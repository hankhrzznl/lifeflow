"use client";

import { useState, useEffect, useCallback } from "react";
import { motion } from "framer-motion";
import {
  ArrowRight, Droplets, Target, Trophy, CalendarCheck, TrendingUp,
  BarChart3, PieChart as PieChartIcon, Award,
} from "lucide-react";
import Link from "next/link";
import {
  ResponsiveContainer, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  PieChart, Pie, Cell, Legend,
} from "recharts";
import { getWaterRecordsByRange, getWaterStats, getUserWaterTarget } from "@/lib/waterStats";
import type { WaterStats } from "@/lib/waterStats";
import { showToast } from "@/components/ui/Toast";

function getDateStrLocal(y: number, m: number, d: number): string {
  return `${y}-${String(m).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
}

function getPeriodRange(periodType: "week" | "month", offset: number) {
  const now = new Date();
  if (periodType === "week") {
    const dayOfWeek = now.getDay();
    const mondayOffset = dayOfWeek === 0 ? -6 : 1 - dayOfWeek;
    const monday = new Date(now.getFullYear(), now.getMonth(), now.getDate() + mondayOffset + offset * 7);
    const sunday = new Date(monday);
    sunday.setDate(sunday.getDate() + 6);
    return {
      start: getDateStrLocal(monday.getFullYear(), monday.getMonth() + 1, monday.getDate()),
      end: getDateStrLocal(sunday.getFullYear(), sunday.getMonth() + 1, sunday.getDate()),
    };
  } else {
    const y = now.getFullYear();
    const m = now.getMonth() + 1 + offset;
    const realMonth = ((m - 1) % 12 + 12) % 12 + 1;
    const realYear = y + Math.floor((m - 1) / 12);
    const lastDay = new Date(realYear, realMonth, 0).getDate();
    return {
      start: getDateStrLocal(realYear, realMonth, 1),
      end: getDateStrLocal(realYear, realMonth, lastDay),
    };
  }
}

const HOUR_LABELS = ["晨间", "", "", "", "", "", "", "上午", "", "", "", "中午", "", "", "", "", "下午", "", "", "", "", "", "晚间"];

export default function WaterStats({ periodType, periodOffset }: { periodType: "week" | "month"; periodOffset: number }) {
  const [stats, setStats] = useState<WaterStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [waterTarget, setWaterTarget] = useState(2000);

  const range = getPeriodRange(periodType, periodOffset);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [records, target] = await Promise.all([
        getWaterRecordsByRange(range.start, range.end),
        getUserWaterTarget(),
      ]);
      setWaterTarget(target);
      const s = await getWaterStats(records, target);
      setStats(s);
    } catch (err) {
      console.error("Failed to load water stats:", err);
    } finally {
      setLoading(false);
    }
  }, [range.start, range.end]);

  useEffect(() => { load(); }, [load]);

  if (loading) {
    return (
      <div className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-100 dark:border-gray-800 shadow-sm p-6 space-y-4">
        <div className="skeleton h-6 w-24" />
        <div className="grid grid-cols-2 gap-3">
          {[1,2,3,4].map(i => <div key={i} className="skeleton h-20 rounded-xl" />)}
        </div>
      </div>
    );
  }

  if (!stats) return null;

  const chartData = stats.dailyBreakdown.map(d => ({
    ...d,
    displayDate: d.date.split("-").slice(1).join("/"),
  }));

  const pieData = stats.hourlyDistribution
    .filter(h => h.ml > 0)
    .map(h => ({ name: `${h.hour}时`, value: h.ml }));

  const PIE_COLORS = ["#60A5FA", "#34D399", "#FBBF24", "#F87171", "#A78BFA", "#FB923C", "#2DD4BF", "#F472B6"];

  return (
    <div id="water" className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-100 dark:border-gray-800 shadow-sm p-5 space-y-4">
      {/* 板块头部 */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Droplets className="w-5 h-5 text-blue-500" />
          <h2 className="text-base font-bold text-gray-900 dark:text-white">饮水统计</h2>
        </div>
        <Link
          href="/assistant/water"
          className="flex items-center gap-1 text-xs text-blue-600 dark:text-blue-400 hover:underline"
        >
          前往录入页 <ArrowRight className="w-3 h-3" />
        </Link>
      </div>

      {/* 四宫格指标 */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <MetricCard icon={<Droplets className="w-4 h-4" />} color="text-blue-600" bg="bg-blue-100 dark:bg-blue-900/30" label="总饮水量" value={`${(stats.totalMl / 1000).toFixed(1)}L`} />
        <MetricCard icon={<TrendingUp className="w-4 h-4" />} color="text-emerald-600" bg="bg-emerald-100 dark:bg-emerald-900/30" label="日均饮水" value={`${stats.avgDailyMl}ml`} />
        <MetricCard icon={<Target className="w-4 h-4" />} color="text-amber-600" bg="bg-amber-100 dark:bg-amber-900/30" label="达标天数" value={`${stats.targetMilestones}`} sub={`目标${waterTarget}ml`} />
        <MetricCard icon={<CalendarCheck className="w-4 h-4" />} color="text-purple-600" bg="bg-purple-100 dark:bg-purple-900/30" label="最长连续达标" value={`${stats.longestStreak}天`} />
      </div>

      {/* 柱状趋势图 */}
      <div>
        <h3 className="text-sm font-semibold text-gray-500 dark:text-gray-400 mb-3">每日饮水量</h3>
        {chartData.length > 0 ? (
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={chartData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
              <XAxis dataKey="displayDate" tick={{ fontSize: 10 }} stroke="#9ca3af" interval={periodType === "month" ? 4 : 0} />
              <YAxis tick={{ fontSize: 10 }} stroke="#9ca3af" />
              <Tooltip formatter={(v) => [`${v}ml`, "饮水量"]} />
              <Bar dataKey="ml" fill="#60A5FA" radius={[4,4,0,0]} name="饮水量" />
            </BarChart>
          </ResponsiveContainer>
        ) : (
          <p className="text-xs text-gray-400 text-center py-8">暂无饮水记录</p>
        )}
      </div>

      {/* 时段分布饼图 */}
      {pieData.length > 0 && (
        <div>
          <h3 className="text-sm font-semibold text-gray-500 dark:text-gray-400 mb-3">饮水时段分布</h3>
          <ResponsiveContainer width="100%" height={200}>
            <PieChart>
              <Pie data={pieData} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={80} label={({ name }) => name}>
                {pieData.map((_, i) => (
                  <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />
                ))}
              </Pie>
              <Tooltip formatter={(v) => [`${v}ml`, "饮水量"]} />
            </PieChart>
          </ResponsiveContainer>
        </div>
      )}

      {/* 成就墙 */}
      <div>
        <h3 className="text-sm font-semibold text-gray-500 dark:text-gray-400 mb-3">饮水成就</h3>
        <div className="grid grid-cols-3 gap-2">
          {stats.achievements.map((a, i) => (
            <motion.div
              key={i}
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: i * 0.05 }}
              className={`flex items-center gap-2 px-3 py-2 rounded-xl text-xs font-medium ${
                a.unlocked
                  ? "bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-300"
                  : "bg-gray-50 dark:bg-gray-800 text-gray-400"
              }`}
            >
              <span className="text-lg">{a.icon}</span>
              <span>{a.label}</span>
              {a.unlocked && <Award className="w-3 h-3 ml-auto text-amber-500" />}
            </motion.div>
          ))}
        </div>
      </div>
    </div>
  );
}

function MetricCard({
  icon, color, bg, label, value, sub,
}: {
  icon: React.ReactNode;
  color: string;
  bg: string;
  label: string;
  value: string;
  sub?: string;
}) {
  return (
    <div className="bg-gray-50 dark:bg-gray-800 rounded-xl p-3">
      <div className={`w-8 h-8 rounded-lg ${bg} flex items-center justify-center mb-2`}>
        <span className={color}>{icon}</span>
      </div>
      <p className="text-xs text-gray-500 dark:text-gray-400">{label}</p>
      <p className="text-lg font-bold text-gray-900 dark:text-white">{value}</p>
      {sub && <p className="text-[10px] text-gray-400">{sub}</p>}
    </div>
  );
}
