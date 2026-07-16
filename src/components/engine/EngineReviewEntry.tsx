"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import { motion } from "framer-motion";
import {
  Calendar, TrendingUp, Clock, Activity,
  ChevronLeft, ChevronRight, Play, BarChart3,
  CheckCircle, Target, Layers,
} from "lucide-react";
import { dailyAtomService } from "@/lib/engine/DailyAtomService";
import { goalService } from "@/lib/engine/GoalService";
import { engineDB } from "@/lib/engine/db";
import type { EngineProgressSnapshot } from "@/lib/engine/types";

// ============================================================
// 工具函数
// ============================================================

function getMonday(date: Date): Date {
  const d = new Date(date);
  const day = d.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  d.setDate(d.getDate() + diff);
  d.setHours(0, 0, 0, 0);
  return d;
}

function toDateStr(d: Date): string {
  return d.toISOString().slice(0, 10);
}

function addDays(dateStr: string, days: number): string {
  const d = new Date(dateStr + "T00:00:00");
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
}

// ============================================================
// 类型
// ============================================================

type PeriodType = "week" | "month" | "quarter";

interface WeekStatus {
  label: string;
  start: string;
  end: string;
  completionRate: number;
  totalAtoms: number;
  completedAtoms: number;
  progressChange: number;
  health: "green" | "yellow" | "red";
  estimatedMinutes: number;
}

// ============================================================
// 组件
// ============================================================

export default function EngineReviewEntry({
  onStartReview,
}: {
  onStartReview: (weekStart: string, weekEnd: string) => void;
}) {
  const [periodType, setPeriodType] = useState<PeriodType>("week");
  const [periodOffset, setPeriodOffset] = useState(0);
  const [status, setStatus] = useState<WeekStatus | null>(null);
  const [loading, setLoading] = useState(true);

  // 计算当前周期范围
  const periodRange = useMemo(() => {
    const now = new Date();
    if (periodType === "week") {
      const monday = getMonday(now);
      monday.setDate(monday.getDate() + periodOffset * 7);
      const sunday = new Date(monday);
      sunday.setDate(sunday.getDate() + 6);
      const sm = monday.getMonth() + 1;
      const em = sunday.getMonth() + 1;
      return {
        start: toDateStr(monday),
        end: toDateStr(sunday),
        label: `${sm}/${monday.getDate()} - ${em}/${sunday.getDate()}`,
      };
    } else {
      const y = now.getFullYear();
      const m = now.getMonth() + 1 + periodOffset;
      const realM = ((m - 1) % 12 + 12) % 12 + 1;
      const realY = y + Math.floor((m - 1) / 12);
      const start = `${realY}-${String(realM).padStart(2, "0")}-01`;
      const endDate = new Date(realY, realM, 0);
      const end = toDateStr(endDate);
      return { start, end, label: `${realY}年${realM}月` };
    }
  }, [periodType, periodOffset]);

  // 加载本周数据
  const loadStatus = useCallback(async () => {
    setLoading(true);
    try {
      const atoms = await dailyAtomService.listByDateRange(periodRange.start, periodRange.end);
      const completed = atoms.filter((a) => a.isCompleted).length;
      const total = atoms.length;

      // 估算时间投入
      const totalMin = atoms
        .filter((a) => a.isCompleted)
        .reduce((s, a) => s + (a.estimatedDuration ?? 0), 0);

      // 健康度判断
      const rate = total > 0 ? Math.round((completed / total) * 100) : 0;
      let health: "green" | "yellow" | "red" = "green";
      if (rate < 40) health = "red";
      else if (rate < 70) health = "yellow";

      setStatus({
        label: periodRange.label,
        start: periodRange.start,
        end: periodRange.end,
        completionRate: rate,
        totalAtoms: total,
        completedAtoms: completed,
        progressChange: 0, // 需要上周数据才能算
        health,
        estimatedMinutes: totalMin,
      });
    } catch (err) {
      console.error("[ReviewEntry] 加载失败:", err);
    } finally {
      setLoading(false);
    }
  }, [periodRange]);

  useEffect(() => { loadStatus(); }, [loadStatus]);

  const isCurrentPeriod = periodOffset === 0 && periodType === "week";

  return (
    <div className="space-y-4">
      {/* 周期切换 */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-1 rounded-xl p-1"
          style={{ backgroundColor: "var(--surface-fabric)" }}>
          {(["week", "month"] as PeriodType[]).map((t) => (
            <button
              key={t}
              onClick={() => { setPeriodType(t); setPeriodOffset(0); }}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                periodType === t
                  ? "bg-white dark:bg-gray-700 text-gray-900 dark:text-white shadow-sm"
                  : "text-gray-500 hover:text-gray-700 dark:hover:text-gray-300"
              }`}
            >
              {t === "week" ? "周复盘" : "月复盘"}
            </button>
          ))}
        </div>

        <div className="flex items-center gap-1">
          <button
            onClick={() => setPeriodOffset((o) => o - 1)}
            className="w-7 h-7 flex items-center justify-center rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
          >
            <ChevronLeft className="w-4 h-4 text-gray-500" />
          </button>
          <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
            {periodRange.label}
          </span>
          <button
            onClick={() => setPeriodOffset((o) => o + 1)}
            disabled={periodOffset >= 0}
            className="w-7 h-7 flex items-center justify-center rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors disabled:opacity-30"
          >
            <ChevronRight className="w-4 h-4 text-gray-500" />
          </button>
        </div>
      </div>

      {/* 状态卡片 */}
      {loading ? (
        <div className="grid grid-cols-2 gap-2">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="skeleton h-20 rounded-2xl" />
          ))}
        </div>
      ) : status ? (
        <div className="grid grid-cols-2 gap-2">
          <StatusCard
            icon={CheckCircle}
            label="完成率"
            value={`${status.completionRate}%`}
            sub={`${status.completedAtoms}/${status.totalAtoms}`}
            color="text-emerald-600"
            bg="bg-emerald-50 dark:bg-emerald-900/20"
          />
          <StatusCard
            icon={TrendingUp}
            label="进度变化"
            value={status.progressChange !== 0 ? `${status.progressChange > 0 ? "+" : ""}${status.progressChange}%` : "-"}
            sub="较上期"
            color="text-blue-600"
            bg="bg-blue-50 dark:bg-blue-900/20"
          />
          <StatusCard
            icon={Clock}
            label="时间投入"
            value={`${Math.round(status.estimatedMinutes / 60)}h`}
            sub={`≈${status.estimatedMinutes}分钟`}
            color="text-purple-600"
            bg="bg-purple-50 dark:bg-purple-900/20"
          />
          <StatusCard
            icon={Activity}
            label="健康度"
            value={status.health === "green" ? "良好" : status.health === "yellow" ? "注意" : "危险"}
            sub={status.health === "green" ? "节奏正常" : status.health === "yellow" ? "需关注" : "需干预"}
            color={
              status.health === "green" ? "text-emerald-600" :
              status.health === "yellow" ? "text-amber-600" : "text-red-600"
            }
            bg={
              status.health === "green" ? "bg-emerald-50 dark:bg-emerald-900/20" :
              status.health === "yellow" ? "bg-amber-50 dark:bg-amber-900/20" :
              "bg-red-50 dark:bg-red-900/20"
            }
          />
        </div>
      ) : null}

      {/* 开始复盘 CTA */}
      {isCurrentPeriod && status && (
        <motion.button
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          onClick={() => onStartReview(periodRange.start, periodRange.end)}
          className="w-full py-3.5 rounded-fabric font-semibold text-sm transition-all active:scale-[0.98] flex items-center justify-center gap-2"
          style={{ backgroundColor: "var(--brand-primary)", color: "var(--text-inverse)", fontFamily: "var(--font-display)" }}
        >
          <Play className="w-4 h-4" fill="white" />
          {status.completedAtoms > 0 ? "开始复盘" : "开始新周期复盘"}
        </motion.button>
      )}

      {/* 往期列表 */}
      <div>
        <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">
          往期复盘
        </h3>
        <PastReviewList limit={8} />
      </div>
    </div>
  );
}

// ============================================================
// 子组件
// ============================================================

function StatusCard({
  icon: Icon, label, value, sub, color, bg,
}: {
  icon: typeof Target; label: string; value: string; sub: string;
  color: string; bg: string;
}) {
  return (
    <div className="p-3 rounded-2xl bg-white dark:bg-gray-900 border border-gray-100 dark:border-gray-800 shadow-sm">
      <div className="flex items-center gap-1.5 mb-1.5">
        <div className={`w-6 h-6 rounded-lg ${bg} flex items-center justify-center`}>
          <Icon className={`w-3.5 h-3.5 ${color}`} />
        </div>
        <span className="text-xs text-gray-500">{label}</span>
      </div>
      <p className="text-lg font-bold text-gray-900 dark:text-white">{value}</p>
      <p className="text-[10px] text-gray-400">{sub}</p>
    </div>
  );
}

function PastReviewList({ limit }: { limit: number }) {
  const [reviews, setReviews] = useState<EngineProgressSnapshot[]>([]);

  useEffect(() => {
    engineDB.progressSnapshots
      .orderBy("snapshotDate")
      .reverse()
      .limit(limit)
      .toArray()
      .then(setReviews)
      .catch(() => {});
  }, [limit]);

  if (reviews.length === 0) {
    return <p className="text-xs text-gray-400 py-4 text-center">暂无往期复盘</p>;
  }

  return (
    <div className="space-y-1">
      {reviews.map((r) => (
        <div
          key={r.id}
          className="flex items-center gap-3 px-3 py-2 rounded-xl bg-white dark:bg-gray-900 border border-gray-100 dark:border-gray-800 text-sm"
        >
          <Calendar className="w-3.5 h-3.5 text-gray-400" />
          <span className="flex-1 text-gray-700 dark:text-gray-300">
            第{r.weekNumber}周 ({r.year})
          </span>
          <span className="text-xs text-gray-400">
            {r.completedAtoms}/{r.totalAtoms} ({r.progress}%)
          </span>
          <span className={`w-2 h-2 rounded-full ${
            r.progress >= 70 ? "bg-emerald-500" :
            r.progress >= 40 ? "bg-amber-500" : "bg-red-500"
          }`} />
        </div>
      ))}
    </div>
  );
}
