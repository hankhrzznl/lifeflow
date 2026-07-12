"use client";

import { useState } from "react";
import { motion } from "framer-motion";
import { ChevronLeft, ChevronRight, TrendingUp } from "lucide-react";
import Link from "next/link";
import WaterStats from "./components/WaterStats";
import FinanceStats from "./components/FinanceStats";
import FitnessStats from "./components/FitnessStats";
import SleepStats from "./components/SleepStats";

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

  const range = { label: getPeriodLabel(periodType, periodOffset) };

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

        {/* 四板块垂直排列 */}
        <WaterStats periodType={periodType} periodOffset={periodOffset} />
        <FinanceStats periodType={periodType} periodOffset={periodOffset} />
        <FitnessStats periodType={periodType} periodOffset={periodOffset} />
        <SleepStats periodType={periodType} periodOffset={periodOffset} />
      </div>
    </div>
  );
}
