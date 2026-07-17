"use client";

import { useState, useEffect, useCallback } from "react";
import dynamic from "next/dynamic";
import { motion } from "framer-motion";
import { ChevronLeft, ChevronRight, TrendingUp, Target, BarChart3 } from "lucide-react";
import Link from "next/link";
import WaterStats from "./components/WaterStats";
import FinanceStats from "./components/FinanceStats";
import FitnessStats from "./components/FitnessStats";
import SleepStats from "./components/SleepStats";
import { getAllGoals } from "@/lib/db";
import KnittingProgress from "@/components/ui/KnittingProgress";
import MascotIllustration from "@/components/ui/MascotIllustration";
import type { Goal } from "@/lib/types";

// 动态导入图表
const DynamicBarChart = dynamic(
  () => import("recharts").then((mod) => {
    const { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip } = mod;
    return function GoalBarChart({ data }: {
      data: Array<{ project: string; name: string; progress: number; count: number }>;
    }) {
      return (
        <ResponsiveContainer width="100%" height={220}>
          <BarChart data={data} layout="vertical">
            <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
            <XAxis type="number" domain={[0, 100]} tick={{ fontSize: 10 }} stroke="#9ca3af" />
            <YAxis type="category" dataKey="project" width={80} tick={{ fontSize: 10 }} stroke="#9ca3af" />
            <Tooltip formatter={(v: unknown) => {
              const num = typeof v === "number" ? v : 0;
              return [`${num}%`, "进度"];
            }} />
            <Bar dataKey="progress" fill="#6366F1" radius={[0, 4, 4, 0]} />
          </BarChart>
        </ResponsiveContainer>
      );
    };
  }),
  { ssr: false, loading: () => <div className="h-[220px] flex items-center justify-center"><div className="w-6 h-6 border-2 border-[var(--border)] border-t-[var(--brand-primary)] rounded-full animate-spin" /></div> }
);

type PeriodType = "week" | "month";

function PeriodSwitcher(props: {
  periodType: PeriodType; setPeriodType: (t: PeriodType) => void;
  periodOffset: number; setPeriodOffset: (o: number) => void; range: { label: string };
}) {
  const { periodType, setPeriodType, periodOffset, setPeriodOffset, range } = props;
  return (
    <div className="flex items-center gap-3">
      <div className="relative flex rounded-xl p-1" style={{ backgroundColor: "var(--surface-fabric)" }}>
        <motion.div
          layoutId="stats-period-indicator"
          className="absolute top-1 bottom-1 rounded-lg bg-white shadow-sm"
          style={{ width: "calc(50% - 4px)" }}
          animate={{ left: periodType === "week" ? "4px" : "calc(50% + 0px)" }}
          transition={{ duration: 0.25, ease: [0.4, 0, 0.2, 1] }}
        />
        {(["week", "month"] as PeriodType[]).map((t) => (
          <button key={t} onClick={() => { setPeriodType(t); setPeriodOffset(0); }}
            className="relative z-10 px-4 py-2 text-sm font-medium rounded-lg transition-colors"
            style={{ color: periodType === t ? "var(--text-primary)" : "var(--text-tertiary)" }}>
            {t === "week" ? "周度" : "月度"}
          </button>
        ))}
      </div>
      <button onClick={() => setPeriodOffset(periodOffset - 1)} className="p-2 rounded-lg hover:bg-gray-100 transition-colors">
        <ChevronLeft className="w-4 h-4" style={{ color: "var(--text-tertiary)" }} />
      </button>
      <span className="text-sm font-semibold min-w-[120px] text-center" style={{ color: "var(--text-primary)" }}>
        {range.label}
      </span>
      <button onClick={() => setPeriodOffset(periodOffset + 1)} className="p-2 rounded-lg hover:bg-gray-100 transition-colors">
        <ChevronRight className="w-4 h-4" style={{ color: "var(--text-tertiary)" }} />
      </button>
      {periodOffset !== 0 && (
        <button onClick={() => setPeriodOffset(0)}
          className="px-3 py-1.5 text-xs font-medium rounded-lg transition-colors"
          style={{ backgroundColor: "var(--brand-primary-light)", color: "var(--brand-primary)" }}>
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
    const sunday = new Date(monday); sunday.setDate(sunday.getDate() + 6);
    return `${monday.getMonth() + 1}/${monday.getDate()} - ${sunday.getMonth() + 1}/${sunday.getDate()}`;
  } else {
    const y = now.getFullYear(); const m = now.getMonth() + 1 + offset;
    const realMonth = ((m - 1) % 12 + 12) % 12 + 1;
    const realYear = y + Math.floor((m - 1) / 12);
    return `${realYear}年${realMonth}月`;
  }
}

export default function StatsPage() {
  const [periodType, setPeriodType] = useState<PeriodType>("week");
  const [periodOffset, setPeriodOffset] = useState(0);
  const [goals, setGoals] = useState<Goal[]>([]);
  const [goalFilterCategory, setGoalFilterCategory] = useState<string>("all");
  const [loading, setLoading] = useState(true);

  const range = { label: getPeriodLabel(periodType, periodOffset) };

  useEffect(() => {
    const load = async () => {
      const allGoals = await getAllGoals();
      setGoals(allGoals.filter((g) => g.status !== "archived"));
      setLoading(false);
    }; load();
  }, []);

  const filteredGoals = goalFilterCategory === "all"
    ? goals : goals.filter((g) => g.type === goalFilterCategory);

  const goalChartData = (() => {
    const map = new Map<string, { name: string; progress: number; project: string }>();
    for (const g of filteredGoals) {
      const key = g.type || "未分类";
      const existing = map.get(key);
      if (!existing || g.progress > existing.progress) {
        map.set(key, { name: g.name, progress: g.progress, project: key });
      }
    }
    return Array.from(map.entries()).map(([project, val]) => ({
      project,
      name: val.name,
      progress: val.progress,
      count: filteredGoals.filter((g) => (g.type || "未分类") === project).length,
    }));
  })();

  const activeCount = filteredGoals.filter((g) => g.status === "active").length;
  const completedCount = filteredGoals.filter((g) => g.status === "completed").length;
  const pausedCount = filteredGoals.filter((g) => g.status === "paused").length;
  const avgProgress = filteredGoals.length > 0
    ? Math.round(filteredGoals.reduce((sum, g) => sum + g.progress, 0) / filteredGoals.length) : 0;

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ backgroundColor: "var(--surface-desk)" }}>
        <div className="w-8 h-8 border-2 border-[var(--border)] border-t-[var(--brand-primary)] rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-screen pb-20" style={{ backgroundColor: "var(--surface-desk)", color: "var(--text-primary)" }}>
      <div className="mx-auto max-w-3xl px-5 pt-8 pb-24 md:px-8 md:pt-10 space-y-5">
        {/* 标题 */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div>
              <h1 className="text-xl font-bold" style={{ fontFamily: "var(--font-display)", color: "var(--text-primary)" }}>
                编织日志
              </h1>
              <p className="text-sm mt-0.5" style={{ color: "var(--text-secondary)" }}>全局复盘，持续优化</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <Link href="/review" className="flex items-center gap-1 text-xs font-medium hover:underline"
              style={{ color: "var(--brand-primary)" }}>
              <TrendingUp className="w-4 h-4" /> 复盘
            </Link>
            <div className="w-10 h-10">
              <MascotIllustration state="waiting" size={40} />
            </div>
          </div>
        </div>

        {/* 全局周期切换器 */}
        <PeriodSwitcher {...{ periodType, setPeriodType, periodOffset, setPeriodOffset, range }} />

        {/* 目标进度总览 */}
        <section className="rounded-fabric p-5 space-y-4"
          style={{ backgroundColor: "var(--surface-fabric)", boxShadow: "var(--shadow-knit)" }}>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Target className="w-5 h-5" style={{ color: "var(--brand-primary)" }} />
              <h2 className="text-base font-bold" style={{ color: "var(--text-primary)" }}>目标进度总览</h2>
            </div>
            <select value={goalFilterCategory} onChange={(e) => setGoalFilterCategory(e.target.value)}
              className="text-xs rounded-lg px-2 py-1.5 border-0 focus:ring-2"
              style={{ backgroundColor: "var(--surface-desk-light)", color: "var(--text-primary)" }}>
              <option value="all">全部类型</option>
              <option value="study">学习</option>
              <option value="career">职业</option>
              <option value="health">健康</option>
              <option value="finance">财务</option>
              <option value="creative">创作</option>
              <option value="habit">习惯</option>
            </select>
          </div>

          <div className="grid grid-cols-4 gap-3">
            <div className="text-center rounded-xl p-3" style={{ backgroundColor: "var(--surface-desk-light)" }}>
              <p className="text-xs" style={{ color: "var(--text-tertiary)" }}>活跃目标</p>
              <p className="text-lg font-bold" style={{ color: "var(--text-primary)" }}>{activeCount}</p>
            </div>
            <div className="text-center rounded-xl p-3" style={{ backgroundColor: "var(--surface-desk-light)" }}>
              <p className="text-xs" style={{ color: "var(--text-tertiary)" }}>已完成</p>
              <p className="text-lg font-bold" style={{ color: "var(--success)" }}>{completedCount}</p>
            </div>
            <div className="text-center rounded-xl p-3" style={{ backgroundColor: "var(--surface-desk-light)" }}>
              <p className="text-xs" style={{ color: "var(--text-tertiary)" }}>已暂停</p>
              <p className="text-lg font-bold" style={{ color: "var(--warning)" }}>{pausedCount}</p>
            </div>
            <div className="text-center rounded-xl p-3" style={{ backgroundColor: "var(--surface-desk-light)" }}>
              <p className="text-xs" style={{ color: "var(--text-tertiary)" }}>平均进度</p>
              <p className="text-lg font-bold" style={{ color: "var(--brand-primary)" }}>{avgProgress}%</p>
            </div>
          </div>

          {/* 目标进度列表 */}
          {filteredGoals.length > 0 && (
            <div className="space-y-3">
              <h3 className="text-sm font-semibold" style={{ color: "var(--text-secondary)" }}>各目标进度</h3>
              {filteredGoals.slice(0, 6).map((goal) => (
                <div key={goal.id} className="flex items-center gap-3">
                  <span className="text-xs truncate flex-1" style={{ color: "var(--text-primary)" }}>{goal.name}</span>
                  <span className="text-xs flex-shrink-0" style={{ color: "var(--text-secondary)" }}>{goal.progress}%</span>
                  <div className="w-24 flex-shrink-0">
                    <KnittingProgress progress={goal.progress} size="sm" showPercentage={false} />
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* 图表 */}
          {goalChartData.length > 0 && (
            <div>
              <h3 className="text-sm font-semibold mb-3" style={{ color: "var(--text-secondary)" }}>分类进度对比</h3>
              <DynamicBarChart data={goalChartData} />
            </div>
          )}
        </section>

        {/* 四板块统计 */}
        <WaterStats periodType={periodType} periodOffset={periodOffset} />
        <FinanceStats periodType={periodType} periodOffset={periodOffset} />
        <FitnessStats periodType={periodType} periodOffset={periodOffset} />
        <SleepStats periodType={periodType} periodOffset={periodOffset} />
      </div>
    </div>
  );
}
