"use client";

import { useState, useEffect, useCallback } from "react";
import { motion } from "framer-motion";
import { ChevronLeft, ChevronRight, TrendingUp, Target, BarChart3 } from "lucide-react";
import Link from "next/link";
import {
  ResponsiveContainer, BarChart as ReBarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
} from "recharts";
import WaterStats from "./components/WaterStats";
import FinanceStats from "./components/FinanceStats";
import FitnessStats from "./components/FitnessStats";
import SleepStats from "./components/SleepStats";
import { db, getAllGoals, getAllProjectsV2 } from "@/lib/db";
import type { Goal, ProjectV2 } from "@/lib/types";

type PeriodType = "week" | "month";

function PeriodSwitcher({
  periodType, setPeriodType, periodOffset, setPeriodOffset, range,
}: {
  periodType: PeriodType;
  setPeriodType: (t: PeriodType) => void;
  periodOffset: number;
  setPeriodOffset: (o: number) => void;
  range: { label: string };
}) {
  return (
    <div className="flex items-center gap-3">
      <div className="relative flex bg-gray-100 dark:bg-gray-800 rounded-xl p-1">
        <motion.div
          layoutId="stats-period-indicator"
          className="absolute top-1 bottom-1 rounded-lg bg-white dark:bg-gray-700 shadow-sm"
          style={{ width: "calc(50% - 4px)" }}
          animate={{ left: periodType === "week" ? "4px" : "calc(50% + 0px)" }}
          transition={{ duration: 0.25, ease: [0.4, 0, 0.2, 1] }}
        />
        {(["week", "month"] as PeriodType[]).map((t) => (
          <button
            key={t}
            onClick={() => {
              setPeriodType(t);
              setPeriodOffset(0);
            }}
            className={`relative z-10 px-4 py-2 text-sm font-medium rounded-lg transition-colors ${
              periodType === t
                ? "text-gray-900 dark:text-white font-semibold"
                : "text-gray-500 dark:text-gray-400 hover:text-gray-700"
            }`}
          >
            {t === "week" ? "周度" : "月度"}
          </button>
        ))}
      </div>
      <button
        onClick={() => setPeriodOffset(periodOffset - 1)}
        className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
      >
        <ChevronLeft className="w-4 h-4 text-gray-500" />
      </button>
      <span className="text-sm font-semibold text-gray-700 dark:text-gray-300 min-w-[120px] text-center">
        {range.label}
      </span>
      <button
        onClick={() => setPeriodOffset(periodOffset + 1)}
        className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
      >
        <ChevronRight className="w-4 h-4 text-gray-500" />
      </button>
      {periodOffset !== 0 && (
        <button
          onClick={() => setPeriodOffset(0)}
          className="px-3 py-1.5 text-xs font-medium bg-indigo-100 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400 rounded-lg hover:bg-indigo-200 dark:hover:bg-indigo-900/50 transition-colors"
        >
          今天
        </button>
      )}
    </div>
  );
}

function getPeriodLabel(periodType: PeriodType, offset: number): string {
  const now = new Date();
  if (periodType === "week") {
    const dayOfWeek = now.getDay();
    const mondayOffset = dayOfWeek === 0 ? -6 : 1 - dayOfWeek;
    const monday = new Date(now.getFullYear(), now.getMonth(), now.getDate() + mondayOffset + offset * 7);
    const sunday = new Date(monday);
    sunday.setDate(sunday.getDate() + 6);
    return `${monday.getMonth() + 1}/${monday.getDate()} - ${sunday.getMonth() + 1}/${sunday.getDate()}`;
  } else {
    const y = now.getFullYear();
    const m = now.getMonth() + 1 + offset;
    const realMonth = ((m - 1) % 12 + 12) % 12 + 1;
    const realYear = y + Math.floor((m - 1) / 12);
    return `${realYear}年${realMonth}月`;
  }
}

export default function StatsPage() {
  const [periodType, setPeriodType] = useState<PeriodType>("week");
  const [periodOffset, setPeriodOffset] = useState(0);
  const [goals, setGoals] = useState<Goal[]>([]);
  const [projects, setProjects] = useState<ProjectV2[]>([]);
  const [goalFilterType, setGoalFilterType] = useState<string>("all");

  const range = { label: getPeriodLabel(periodType, periodOffset) };

  useEffect(() => {
    const load = async () => {
      const [allGoals, allProjects] = await Promise.all([getAllGoals(), getAllProjectsV2()]);
      setGoals(allGoals.filter(g => g.status !== "archived"));
      setProjects(allProjects);
    };
    load();
  }, []);

  const filteredGoals = goalFilterType === "all"
    ? goals
    : goals.filter(g => g.type === goalFilterType);

  const goalChartData = (() => {
    const map = new Map<string, { name: string; progress: number; project: string }>();
    for (const g of filteredGoals) {
      const proj = projects.find(p => p.id === g.projectId);
      const key = proj?.name || "未分类";
      const existing = map.get(key);
      if (!existing || g.progress > existing.progress) {
        map.set(key, { name: g.name, progress: g.progress, project: key });
      }
    }
    return Array.from(map.entries()).map(([project, val]) => ({
      project,
      name: val.name,
      progress: val.progress,
      count: filteredGoals.filter(g => {
        const p = projects.find(p2 => p2.id === g.projectId);
        return (p?.name || "未分类") === project;
      }).length,
    }));
  })();

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-50 to-white dark:from-gray-950 dark:to-gray-900 text-slate-900 dark:text-white">
      <div className="mx-auto max-w-3xl px-5 pt-8 pb-24 md:px-8 md:pt-10 space-y-5">
        {/* 标题 */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-xl font-bold text-gray-900 dark:text-white">数据统计</h1>
            <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">全局复盘，持续优化</p>
          </div>
          <Link
            href="/review"
            className="flex items-center gap-1 text-xs font-medium text-indigo-600 dark:text-indigo-400 hover:underline"
          >
            <TrendingUp className="w-4 h-4" />
            查看效率复盘
          </Link>
        </div>

        {/* 全局周期切换器 */}
        <PeriodSwitcher
          periodType={periodType}
          setPeriodType={setPeriodType}
          periodOffset={periodOffset}
          setPeriodOffset={setPeriodOffset}
          range={range}
        />

        {/* 目标进度总览 */}
        {goals.length > 0 && (
          <section className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-100 dark:border-gray-800 shadow-sm p-5 space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Target className="w-5 h-5 text-indigo-500" />
                <h2 className="text-base font-bold text-gray-900 dark:text-white">目标进度总览</h2>
              </div>
              <select
                value={goalFilterType}
                onChange={(e) => setGoalFilterType(e.target.value)}
                className="text-xs bg-gray-100 dark:bg-gray-800 rounded-lg px-2 py-1.5 border-0 focus:ring-2 focus:ring-indigo-500"
              >
                <option value="all">全部类型</option>
                <option value="task">任务型</option>
                <option value="fitness">健身</option>
                <option value="finance">财务</option>
                <option value="sleep">睡眠</option>
                <option value="water">饮水</option>
              </select>
            </div>

            <div className="grid grid-cols-4 gap-3">
              <div className="text-center bg-gray-50 dark:bg-gray-800 rounded-xl p-3">
                <p className="text-xs text-gray-400">活跃目标</p>
                <p className="text-lg font-bold text-gray-900 dark:text-white">{filteredGoals.filter(g => g.status === "active").length}</p>
              </div>
              <div className="text-center bg-gray-50 dark:bg-gray-800 rounded-xl p-3">
                <p className="text-xs text-gray-400">已完成</p>
                <p className="text-lg font-bold text-emerald-500">{filteredGoals.filter(g => g.status === "completed").length}</p>
              </div>
              <div className="text-center bg-gray-50 dark:bg-gray-800 rounded-xl p-3">
                <p className="text-xs text-gray-400">已暂停</p>
                <p className="text-lg font-bold text-amber-500">{filteredGoals.filter(g => g.status === "paused").length}</p>
              </div>
              <div className="text-center bg-gray-50 dark:bg-gray-800 rounded-xl p-3">
                <p className="text-xs text-gray-400">达成率</p>
                <p className="text-lg font-bold text-blue-500">
                  {filteredGoals.length > 0 ? Math.round((filteredGoals.filter(g => g.status === "completed").length / filteredGoals.length) * 100) : 0}%
                </p>
              </div>
            </div>

            {goalChartData.length > 0 && (
              <div>
                <h3 className="text-sm font-semibold text-gray-500 dark:text-gray-400 mb-3">各项目目标进度</h3>
                <ResponsiveContainer width="100%" height={220}>
                  <ReBarChart data={goalChartData} layout="vertical">
                    <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                    <XAxis type="number" domain={[0, 100]} tick={{ fontSize: 10 }} stroke="#9ca3af" />
                    <YAxis type="category" dataKey="project" width={80} tick={{ fontSize: 10 }} stroke="#9ca3af" />
                    <Tooltip formatter={(v, _, props) => [`${v}%`, (props?.payload as any)?.name || "进度"]} />
                    <Bar dataKey="progress" fill="#6366F1" radius={[0, 4, 4, 0]} label={false} />
                  </ReBarChart>
                </ResponsiveContainer>
              </div>
            )}
          </section>
        )}

        {/* 四板块垂直排列 */}
        <WaterStats periodType={periodType} periodOffset={periodOffset} />
        <FinanceStats periodType={periodType} periodOffset={periodOffset} />
        <FitnessStats periodType={periodType} periodOffset={periodOffset} />
        <SleepStats periodType={periodType} periodOffset={periodOffset} />
      </div>
    </div>
  );
}
