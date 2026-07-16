"use client";

import { useState, useEffect, useCallback } from "react";
import { motion } from "framer-motion";
import {
  ArrowRight, Wallet, TrendingUp, TrendingDown, DollarSign, PiggyBank, Target,
  PieChart as PieChartIcon,
} from "lucide-react";
import Link from "next/link";
import {
  ResponsiveContainer, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  PieChart, Pie, Cell, Legend,
} from "recharts";
import { getFinRecordsByRange, getFinanceStats, getMonthBudget } from "@/lib/financeStats";
import type { FinanceStats } from "@/lib/financeStats";
import { useRouter } from "next/navigation";
import { db } from "@/lib/db";
import type { Goal } from "@/lib/types";

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
      monthKey: `${realYear}-${String(realMonth).padStart(2, "0")}`,
    };
  }
}

export default function FinanceStats({ periodType, periodOffset }: { periodType: "week" | "month"; periodOffset: number }) {
  const [stats, setStats] = useState<FinanceStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [goals, setGoals] = useState<Goal[]>([]);
  const router = useRouter();

  const range = getPeriodRange(periodType, periodOffset);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const records = await getFinRecordsByRange(range.start, range.end);
      const budget = periodType === "month" && "monthKey" in range
        ? await getMonthBudget((range as { monthKey: string }).monthKey)
        : null;
      const s = await getFinanceStats(records, budget);
      setStats(s);

      const allGoals = await db.goals.where("type").equals("finance").toArray();
      setGoals(allGoals.filter(g => g.status === "active" || g.status === "paused"));
    } catch (err) {
      console.error("Failed to load finance stats:", err);
    } finally {
      setLoading(false);
    }
  }, [range.start, range.end, periodType]);

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

  return (
    <div id="finance" className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-100 dark:border-gray-800 shadow-sm p-5 space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Wallet className="w-5 h-5 text-emerald-500" />
          <h2 className="text-base font-bold text-gray-900 dark:text-white">财务统计</h2>
        </div>
        <Link
          href="/assistant/finance"
          className="flex items-center gap-1 text-xs text-emerald-600 dark:text-emerald-400 hover:underline"
        >
          前往录入页 <ArrowRight className="w-3 h-3" />
        </Link>
      </div>

      {/* 关联目标 */}
      {goals.length > 0 && (
        <div className="bg-emerald-50 dark:bg-emerald-900/20 rounded-xl p-3 space-y-2">
          <p className="text-xs font-medium text-emerald-600 dark:text-emerald-400 flex items-center gap-1">
            <Target className="w-3.5 h-3.5" /> 关联财务目标
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
                <span className="text-xs font-medium text-emerald-600 dark:text-emerald-400">{goal.progress}%</span>
              </div>
            </button>
          ))}
        </div>
      )}

      {/* 四宫格 */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <MetricCard icon={<TrendingUp className="w-4 h-4" />} color="text-green-600" bg="bg-green-100 dark:bg-green-900/30" label="周期收入" value={`+¥${stats.totalIncome.toFixed(2)}`} />
        <MetricCard icon={<TrendingDown className="w-4 h-4" />} color="text-red-600" bg="bg-red-100 dark:bg-red-900/30" label="周期支出" value={`-¥${stats.totalExpense.toFixed(2)}`} />
        <MetricCard icon={<DollarSign className="w-4 h-4" />} color={stats.balance >= 0 ? "text-blue-600" : "text-orange-600"} bg="bg-blue-100 dark:bg-blue-900/30" label="结余" value={`¥${stats.balance.toFixed(2)}`} />
        {stats.budgetTotal != null ? (
          <MetricCard icon={<PiggyBank className="w-4 h-4" />} color="text-purple-600" bg="bg-purple-100 dark:bg-purple-900/30" label="预算剩余" value={`¥${(stats.budgetRemaining || 0).toFixed(2)}`} sub={`预算 ¥${stats.budgetTotal}`} />
        ) : (
          <MetricCard icon={<TrendingDown className="w-4 h-4" />} color="text-gray-600" bg="bg-gray-100 dark:bg-gray-800" label="日均支出" value={`¥${stats.avgDailyExpense}`} />
        )}
      </div>

      {/* 收支趋势图 */}
      <div>
        <h3 className="text-sm font-semibold text-gray-500 dark:text-gray-400 mb-3">收支趋势</h3>
        {chartData.length > 0 ? (
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={chartData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
              <XAxis dataKey="displayDate" tick={{ fontSize: 10 }} stroke="#9ca3af" interval={periodType === "month" ? 4 : 0} />
              <YAxis tick={{ fontSize: 10 }} stroke="#9ca3af" />
              <Tooltip />
              <Bar dataKey="income" fill="#10B981" radius={[4,4,0,0]} name="收入" stackId="a" />
              <Bar dataKey="expense" fill="#EF4444" radius={[4,4,0,0]} name="支出" />
            </BarChart>
          </ResponsiveContainer>
        ) : (
          <p className="text-xs text-gray-400 text-center py-8">暂无收支记录</p>
        )}
      </div>

      {/* 支出分类占比 */}
      {stats.categoryBreakdown.length > 0 && (
        <div>
          <h3 className="text-sm font-semibold text-gray-500 dark:text-gray-400 mb-3">支出分类占比</h3>
          <div className="space-y-2">
            {stats.categoryBreakdown.slice(0, 8).map((cat) => {
              const pct = stats.totalExpense > 0 ? Math.round((cat.amount / stats.totalExpense) * 100) : 0;
              return (
                <div key={cat.key} className="flex items-center gap-2">
                  <span className="text-sm w-6 text-center">{cat.icon}</span>
                  <span className="text-xs text-gray-600 dark:text-gray-400 w-16 shrink-0">{cat.label}</span>
                  <div className="flex-1 h-2 bg-gray-100 dark:bg-gray-800 rounded-full overflow-hidden">
                    <motion.div
                      initial={{ width: 0 }}
                      animate={{ width: `${Math.min(pct, 100)}%` }}
                      style={{ backgroundColor: cat.color }}
                      className="h-full rounded-full"
                      transition={{ duration: 0.5 }}
                    />
                  </div>
                  <span className="text-xs text-gray-500 w-14 text-right">¥{cat.amount.toFixed(0)}</span>
                </div>
              );
            })}
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
