"use client";

import { useState, useEffect, useCallback } from "react";
import { motion } from "framer-motion";
import {
  ArrowRight, Moon, Target, TrendingUp, CalendarCheck, AlertTriangle,
} from "lucide-react";
import Link from "next/link";
import {
  ResponsiveContainer, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip,
} from "recharts";
import { loadSleepLogs, getSleepStats, formatTime } from "@/lib/sleepStats";
import type { SleepStats, SleepLog } from "@/lib/sleepStats";
import { useRouter } from "next/navigation";
import { db } from "@/lib/db";
import type { Goal } from "@/lib/types";

export default function SleepStats({ periodType, periodOffset }: { periodType: "week" | "month"; periodOffset: number }) {
  const [stats, setStats] = useState<SleepStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [targetTime, setTargetTime] = useState("23:30");
  const [goals, setGoals] = useState<Goal[]>([]);
  const router = useRouter();

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const savedTarget = typeof window !== "undefined" ? localStorage.getItem("sleep_target") : null;
      const target = savedTarget || "23:30";
      setTargetTime(target);

      const logs = await loadSleepLogs(30);
      const s = await getSleepStats(logs, target);
      setStats(s);

      const allGoals = await db.goals.where("type").equals("sleep").toArray();
      setGoals(allGoals.filter(g => g.status === "active" || g.status === "paused"));
    } catch (err) {
      console.error("Failed to load sleep stats:", err);
    } finally {
      setLoading(false);
    }
  }, [periodType, periodOffset]);

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

  const lineData = [...stats.monthlyTimeline]
    .sort((a, b) => a.date.localeCompare(b.date))
    .slice(-14)
    .map(d => ({
      ...d,
      displayDate: d.date.split("-").slice(1).join("/"),
    }));

  return (
    <div id="sleep" className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-100 dark:border-gray-800 shadow-sm p-5 space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Moon className="w-5 h-5 text-indigo-500" />
          <h2 className="text-base font-bold text-gray-900 dark:text-white">睡眠作息统计</h2>
        </div>
        <Link
          href="/assistant/sleep"
          className="flex items-center gap-1 text-xs text-indigo-600 dark:text-indigo-400 hover:underline"
        >
          前往录入页 <ArrowRight className="w-3 h-3" />
        </Link>
      </div>

      {/* 关联目标 */}
      {goals.length > 0 && (
        <div className="bg-indigo-50 dark:bg-indigo-900/20 rounded-xl p-3 space-y-2">
          <p className="text-xs font-medium text-indigo-600 dark:text-indigo-400 flex items-center gap-1">
            <Target className="w-3.5 h-3.5" /> 关联睡眠目标
          </p>
          {goals.map(goal => (
            <button
              key={goal.id}
              onClick={() => router.push(`/goals/${goal.id}`)}
              className="w-full text-left flex items-center justify-between"
            >
              <span className="text-sm text-gray-700 dark:text-gray-300">{goal.name}</span>
              <div className="flex items-center gap-2">
                {goal.deadline && <span className="text-xs text-gray-400">截止 {new Date(goal.deadline).toLocaleDateString("zh-CN")}</span>}
                <span className="text-xs font-medium text-indigo-600 dark:text-indigo-400">{goal.progress}%</span>
              </div>
            </button>
          ))}
        </div>
      )}

      {/* 四宫格 */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <MetricCard icon={<Moon className="w-4 h-4" />} color="text-indigo-600" bg="bg-indigo-100 dark:bg-indigo-900/30" label="平均入睡" value={stats.avgSleepLabel} />
        <MetricCard icon={<Target className="w-4 h-4" />} color="text-emerald-600" bg="bg-emerald-100 dark:bg-emerald-900/30" label="早睡达标率" value={`${stats.targetMetRate}%`} sub={`${stats.targetMetDays}/${stats.totalDays}天 目标${targetTime}`} />
        <MetricCard icon={<CalendarCheck className="w-4 h-4" />} color="text-purple-600" bg="bg-purple-100 dark:bg-purple-900/30" label="最长连续早睡" value={`${stats.longestStreak}天`} />
        <MetricCard icon={<AlertTriangle className="w-4 h-4" />} color="text-amber-600" bg="bg-amber-100 dark:bg-amber-900/30" label="晚睡天数" value={`${stats.lateDays}天`} />
      </div>

      {/* 入睡时间趋势 */}
      <div>
        <h3 className="text-sm font-semibold text-gray-500 dark:text-gray-400 mb-3">入睡时间趋势</h3>
        {lineData.length > 0 ? (
          <ResponsiveContainer width="100%" height={220}>
            <LineChart data={lineData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
              <XAxis dataKey="displayDate" tick={{ fontSize: 10 }} stroke="#9ca3af" />
              <YAxis
                domain={[21 * 60, 26 * 60]}
                tickFormatter={(v) => formatTime(v)}
                tick={{ fontSize: 10 }}
                stroke="#9ca3af"
              />
              <Tooltip formatter={(v) => [formatTime(v as number), "入睡时间"]} />
              <Line type="monotone" dataKey="sleepTime" stroke="#6366F1" strokeWidth={2} dot={{ r: 3 }} />
            </LineChart>
          </ResponsiveContainer>
        ) : (
          <p className="text-xs text-gray-400 text-center py-8">暂无睡眠数据</p>
        )}
      </div>

      {/* 月度热力图 */}
      <div>
        <h3 className="text-sm font-semibold text-gray-500 dark:text-gray-400 mb-3">月度热力图</h3>
        <div className="grid grid-cols-7 gap-1.5">
          {stats.monthlyHeatmap.map((item, i) => {
            if (!item) return <div key={i} className="aspect-square rounded-md bg-gray-100 dark:bg-gray-800" />;
            const minutes = item.sleepTime;
            const hue = Math.max(0, Math.min(120, 120 - ((minutes - 21 * 60) / (6 * 60)) * 120));
            return (
              <div
                key={i}
                className="aspect-square rounded-md flex items-center justify-center text-[9px] font-medium text-white"
                style={{ backgroundColor: `hsl(${hue}, 60%, 50%)` }}
                title={`${item.label} ${formatTime(minutes)}`}
              >
                {new Date(item.date + "T00:00:00").getDate()}
              </div>
            );
          })}
        </div>
        <div className="flex items-center justify-between mt-2 text-[10px] text-gray-400">
          <span>← 较早</span>
          <span>较晚 →</span>
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
