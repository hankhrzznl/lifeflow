"use client";

import { useState, useEffect, useCallback } from "react";
import { motion } from "framer-motion";
import {
  ArrowRight, Dumbbell, TrendingUp, Trophy, Target, Flame,
} from "lucide-react";
import Link from "next/link";
import {
  ResponsiveContainer, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  LineChart, Line,
} from "recharts";
import {
  getFitnessRecordsByRange, getFitnessStats,
} from "@/lib/fitnessStats";
import { getAllMuscleGroups, getAllSubMuscles } from "@/lib/db";
import type { FitnessStats } from "@/lib/fitnessStats";
import type { MuscleGroup, SubMuscle } from "@/lib/types";

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

export default function FitnessStats({ periodType, periodOffset }: { periodType: "week" | "month"; periodOffset: number }) {
  const [stats, setStats] = useState<FitnessStats | null>(null);
  const [loading, setLoading] = useState(true);

  const range = getPeriodRange(periodType, periodOffset);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [records, groups, subMuscles] = await Promise.all([
        getFitnessRecordsByRange(range.start, range.end),
        getAllMuscleGroups(),
        getAllSubMuscles(),
      ]);

      // 去重
      const uniqueGroups = Array.from(
        new Map(groups.map(g => [g.name, g])).values()
      );
      const seenSubKeys = new Set<string>();
      const uniqueSubMuscles = subMuscles.filter(s => {
        const key = `${s.muscleGroupId}-${s.name}`;
        if (seenSubKeys.has(key)) return false;
        seenSubKeys.add(key);
        return true;
      });

      const s = await getFitnessStats(records, uniqueGroups, uniqueSubMuscles);
      setStats(s);
    } catch (err) {
      console.error("Failed to load fitness stats:", err);
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

  const volumeChartData = stats.dailyVolume.map(d => ({
    ...d,
    displayDate: d.date.split("-").slice(1).join("/"),
  }));

  const ctlChartData = stats.ctlTrend.map(d => ({
    ...d,
    displayDate: d.date.split("-").slice(1).join("/"),
  }));

  return (
    <div id="fitness" className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-100 dark:border-gray-800 shadow-sm p-5 space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Dumbbell className="w-5 h-5 text-orange-500" />
          <h2 className="text-base font-bold text-gray-900 dark:text-white">健身训练统计</h2>
        </div>
        <Link
          href="/assistant/fitness"
          className="flex items-center gap-1 text-xs text-orange-600 dark:text-orange-400 hover:underline"
        >
          前往录入页 <ArrowRight className="w-3 h-3" />
        </Link>
      </div>

      {/* 四宫格 */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <MetricCard icon={<Flame className="w-4 h-4" />} color="text-orange-600" bg="bg-orange-100 dark:bg-orange-900/30" label="训练次数" value={`${stats.totalWorkouts}`} />
        <MetricCard icon={<TrendingUp className="w-4 h-4" />} color="text-red-600" bg="bg-red-100 dark:bg-red-900/30" label="总训练容量" value={`${stats.totalVolume.toLocaleString()}`} sub="重量×组数×次数" />
        <MetricCard icon={<Trophy className="w-4 h-4" />} color="text-yellow-600" bg="bg-yellow-100 dark:bg-yellow-900/30" label="个人最佳" value={`${stats.personalBests}次`} />
        <MetricCard icon={<Target className="w-4 h-4" />} color="text-purple-600" bg="bg-purple-100 dark:bg-purple-900/30" label="覆盖肌群" value={`${stats.muscleGroupsCovered}`} />
      </div>

      {/* 每日训练容量 */}
      <div>
        <h3 className="text-sm font-semibold text-gray-500 dark:text-gray-400 mb-3">每日训练容量</h3>
        {volumeChartData.length > 0 ? (
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={volumeChartData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
              <XAxis dataKey="displayDate" tick={{ fontSize: 10 }} stroke="#9ca3af" interval={periodType === "month" ? 4 : 0} />
              <YAxis tick={{ fontSize: 10 }} stroke="#9ca3af" />
              <Tooltip formatter={(v) => [(v as number)?.toLocaleString() ?? "0", "训练容量"]} />
              <Bar dataKey="volume" fill="#F97316" radius={[4,4,0,0]} name="训练容量" />
            </BarChart>
          </ResponsiveContainer>
        ) : (
          <p className="text-xs text-gray-400 text-center py-8">暂无训练记录</p>
        )}
      </div>

      {/* CTL 趋势 */}
      {ctlChartData.length > 1 && (
        <div>
          <h3 className="text-sm font-semibold text-gray-500 dark:text-gray-400 mb-3">训练负荷趋势 (CTL)</h3>
          <ResponsiveContainer width="100%" height={200}>
            <LineChart data={ctlChartData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
              <XAxis dataKey="displayDate" tick={{ fontSize: 10 }} stroke="#9ca3af" interval={periodType === "month" ? 4 : 0} />
              <YAxis tick={{ fontSize: 10 }} stroke="#9ca3af" />
              <Tooltip formatter={(v) => [(v as number)?.toLocaleString() ?? "0", "CTL"]} />
              <Line type="monotone" dataKey="ctl" stroke="#F97316" strokeWidth={2} dot={{ r: 3 }} name="CTL" />
            </LineChart>
          </ResponsiveContainer>
        </div>
      )}

      {/* 肌群负荷热力图 */}
      {stats.muscleGroupLoad.length > 0 && (
        <div>
          <h3 className="text-sm font-semibold text-gray-500 dark:text-gray-400 mb-3">肌群负荷分布</h3>
          <div className="space-y-2">
            {stats.muscleGroupLoad.map((mg) => (
              <div key={mg.name} className="flex items-center gap-2">
                <span className="text-xs text-gray-600 dark:text-gray-400 w-16 shrink-0">{mg.name}</span>
                <div className="flex-1 h-4 bg-gray-100 dark:bg-gray-800 rounded-full overflow-hidden">
                  <motion.div
                    initial={{ width: 0 }}
                    animate={{ width: `${Math.max(mg.pct, 2)}%` }}
                    style={{
                      backgroundColor: mg.color,
                      opacity: Math.max(0.3, mg.pct / 100),
                    }}
                    className="h-full rounded-full"
                    transition={{ duration: 0.5 }}
                  />
                </div>
                <span className="text-xs text-gray-500 w-16 text-right">{mg.pct}%</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 个人最佳记录 */}
      {stats.recentBests.length > 0 && (
        <div>
          <h3 className="text-sm font-semibold text-gray-500 dark:text-gray-400 mb-3">近期个人最佳</h3>
          <div className="space-y-2">
            {stats.recentBests.slice(0, 5).map((r) => (
              <div key={r.id} className="flex items-center justify-between p-2 bg-gray-50 dark:bg-gray-800 rounded-lg">
                <div className="flex items-center gap-2">
                  <Trophy className="w-4 h-4 text-yellow-500" />
                  <span className="text-sm font-medium text-gray-900 dark:text-white">{r.exerciseName}</span>
                </div>
                <span className="text-xs text-gray-500">
                  {r.weight}kg × {r.sets}×{r.reps} | {r.date}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
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
