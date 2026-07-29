"use client";

import { useState, useEffect, useMemo, useCallback } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import Link from "next/link";
import {
  Droplets, Moon, Wallet, Dumbbell, Utensils,
  Heart, StretchHorizontal, Star, BarChart3,
  ChevronDown, ChevronUp, TrendingUp,
} from "lucide-react";
import { daylogDB } from "@/lib/db/daylog.db";
import {
  getWaterGoal, getSleepLogByDate, getWorkoutSessions,
  healthDB,
} from "@/lib/db/health.db";
import {
  getTransactionsByMonth,
} from "@/lib/db/accounting.db";
import {
  getDietLogsByDate, getWellnessLogsByDate, getWishes,
} from "@/lib/db/life.db";
import { reviewerBrain } from "@/lib/brains/reviewer";
import type { ReviewResult, ReviewPeriod, ReviewModuleSummary } from "@/lib/brains/reviewer";

// ─── 工具函数 ────────────────────────────────────────────────

function todayStr(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function yesterdayStr(): string {
  const d = new Date();
  d.setDate(d.getDate() - 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function monthStart(): { year: number; month: number } {
  const d = new Date();
  return { year: d.getFullYear(), month: d.getMonth() + 1 };
}

function weekStartDate(): Date {
  const d = new Date();
  const day = d.getDay();
  const diff = d.getDate() - day;
  d.setDate(diff);
  d.setHours(0, 0, 0, 0);
  return d;
}

function formatAmount(n: number): string {
  return n >= 0 ? `¥${n.toLocaleString()}` : `-¥${Math.abs(n).toLocaleString()}`;
}

const PERIOD_LABELS: Record<ReviewPeriod, string> = {
  daily: "日",
  weekly: "周",
  monthly: "月",
  yearly: "年",
};

const PERIOD_FULL_LABELS: Record<ReviewPeriod, string> = {
  daily: "昨日",
  weekly: "本周",
  monthly: "本月",
  yearly: "今年",
};

// ─── 卡片配置 ────────────────────────────────────────────────

interface ModuleCard {
  key: string;
  label: string;
  path: string;
  icon: React.ReactNode;
  color: string;
  bgColor: string;
}

const MODULES: ModuleCard[] = [
  { key: "water", label: "饮水", path: "/more/water", icon: <Droplets className="w-5 h-5" />, color: "#3B82F6", bgColor: "#EFF6FF" },
  { key: "sleep", label: "睡眠", path: "/more/sleep", icon: <Moon className="w-5 h-5" />, color: "#6366F1", bgColor: "#EEF2FF" },
  { key: "accounting", label: "记账", path: "/more/accounting", icon: <Wallet className="w-5 h-5" />, color: "#10B981", bgColor: "#ECFDF5" },
  { key: "fitness", label: "训练", path: "/more/fitness", icon: <Dumbbell className="w-5 h-5" />, color: "#F97316", bgColor: "#FFF7ED" },
  { key: "diet", label: "饮食", path: "/more/diet", icon: <Utensils className="w-5 h-5" />, color: "#EC4899", bgColor: "#FDF2F8" },
  { key: "wellness", label: "养生", path: "/more/wellness", icon: <Heart className="w-5 h-5" />, color: "#EF4444", bgColor: "#FEF2F2" },
  { key: "posture", label: "体态拉伸", path: "/more/posture", icon: <StretchHorizontal className="w-5 h-5" />, color: "#8B5CF6", bgColor: "#F5F3FF" },
  { key: "wishes", label: "心愿", path: "/more/wishes", icon: <Star className="w-5 h-5" />, color: "#F59E0B", bgColor: "#FFFBEB" },
];

// ─── 复盘摘要条 ──────────────────────────────────────────────

function ReviewSummaryRow({ summary }: { summary: ReviewModuleSummary }) {
  const entries = Object.entries(summary.stats).slice(0, 3); // 最多 3 个关键统计
  if (entries.length === 0) return null;

  return (
    <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1 text-[13px]">
      <span className="font-semibold shrink-0" style={{ color: "var(--color-text-primary)" }}>
        {summary.label}
      </span>
      {entries.map(([key, val]) => (
        <span key={key} style={{ color: "var(--color-text-secondary)" }}>
          {key} <span className="font-medium" style={{ color: "var(--color-text-primary)" }}>{val}</span>
        </span>
      ))}
    </div>
  );
}

// ─── 主页面 ──────────────────────────────────────────────────

export default function LongTermismPage() {
  const today = todayStr();
  const yesterday = yesterdayStr();
  const { year, month } = monthStart();
  const weekStart = weekStartDate();
  const weekStartStr = `${weekStart.getFullYear()}-${String(weekStart.getMonth() + 1).padStart(2, "0")}-${String(weekStart.getDate()).padStart(2, "0")}`;
  const nextWeekStart = new Date(weekStart);
  nextWeekStart.setDate(nextWeekStart.getDate() + 7);
  const weekEndStr = `${nextWeekStart.getFullYear()}-${String(nextWeekStart.getMonth() + 1).padStart(2, "0")}-${String(nextWeekStart.getDate()).padStart(2, "0")}`;

  // ─── 复盘状态 ──────────────────────────────────────────────

  const [reviewPeriod, setReviewPeriod] = useState<ReviewPeriod>("weekly");
  const [currentReview, setCurrentReview] = useState<ReviewResult | null>(null);
  const [historicalReviews, setHistoricalReviews] = useState<ReviewResult[]>([]);
  const [reviewLoading, setReviewLoading] = useState(true);
  const [showHistory, setShowHistory] = useState(false);

  useEffect(() => {
    setReviewLoading(true);
    Promise.all([
      reviewerBrain.generateReview(reviewPeriod, 0),
      reviewerBrain.getHistoricalReviews(reviewPeriod, 4),
    ]).then(([current, history]) => {
      setCurrentReview(current);
      setHistoricalReviews(history.slice(1)); // 排除当前，只保留历史
      setReviewLoading(false);
    }).catch(() => setReviewLoading(false));
  }, [reviewPeriod]);

  const summariesWithData = useMemo(
    () => currentReview?.summaries.filter(s => Object.keys(s.stats).length > 0) || [],
    [currentReview]
  );

  // ─── 模块数据查询 ──────────────────────────────────────────

  // 1. 饮水
  const waterItems = useLiveQuery(
    () => daylogDB.items.where("date").equals(today).filter(i => i.sourceType === "water").toArray(),
    [today], []
  );
  const waterGoal = useLiveQuery(() => getWaterGoal(), [], null);

  // 2. 睡眠
  const sleepLog = useLiveQuery(() => getSleepLogByDate(yesterday), [yesterday], undefined);

  // 3. 记账
  const monthTransactions = useLiveQuery(
    () => getTransactionsByMonth(year, month),
    [year, month], []
  );

  // 4. 训练
  const workoutSessions = useLiveQuery(() => getWorkoutSessions(7), [], []);

  // 5. 饮食
  const dietLogs = useLiveQuery(() => getDietLogsByDate(today), [today], []);

  // 6. 养生
  const wellnessLogs = useLiveQuery(() => getWellnessLogsByDate(today), [today], []);

  // 7. 体态拉伸
  const stretchLogs = useLiveQuery(
    () => healthDB.stretchLogs
      .where("date")
      .between(weekStartStr, weekEndStr, true, false)
      .toArray(),
    [weekStartStr, weekEndStr], []
  );

  // 8. 心愿
  const wishes = useLiveQuery(() => getWishes(), [], []);

  // ─── 卡片衍生数据 ──────────────────────────────────────────

  const cardData = useMemo(() => {
    // 饮水
    const waterTotal = waterItems.length;
    const waterTarget = waterGoal ? Math.ceil(waterGoal.dailyTarget / 100) : 0;
    const now = new Date();
    const currentHour = now.getHours();
    const existingHours = new Set(waterItems.map(i => {
      if (!i.plannedStart) return -1;
      const h = parseInt(i.plannedStart.split(":")[0]);
      return isNaN(h) ? -1 : h;
    }));
    let nextCupTime = "";
    for (let h = currentHour + 1; h <= 22; h++) {
      if (!existingHours.has(h)) {
        const displayHour = h > 12 ? h - 12 : h;
        const ampm = h >= 12 ? "下午" : "上午";
        nextCupTime = `${ampm} ${displayHour}:00`;
        break;
      }
    }
    if (!nextCupTime && waterTotal < waterTarget) nextCupTime = "今天";

    // 睡眠
    let sleepTime = "";
    if (sleepLog?.actualTime) {
      sleepTime = sleepLog.actualTime.slice(0, 5);
    }

    // 记账
    let monthlyIncome = 0;
    let monthlyExpense = 0;
    for (const t of monthTransactions) {
      if (t.type === "income") monthlyIncome += t.amount;
      else monthlyExpense += t.amount;
    }

    // 训练
    const todaySessions = workoutSessions.filter(s => s.date === today);
    const weekSessions = workoutSessions.length;

    // 饮食
    const mealTypes = new Set(dietLogs.map(d => d.mealType));
    const mealCount = mealTypes.size;

    // 养生
    const gongfaCount = wellnessLogs.filter(w => w.type === "gongfa").length;
    const tigangCount = wellnessLogs.filter(w => w.type === "tigang").length;

    // 体态拉伸
    const stretchDays = new Set(stretchLogs.map(s => s.date)).size;

    // 心愿
    const pendingWishes = wishes.filter(w => !w.completed).length;
    const completedWishes = wishes.filter(w => w.completed).length;

    return [
      {
        key: "water", icon: <Droplets className="w-5 h-5" />, color: "#3B82F6", bgColor: "#EFF6FF",
        primary: waterTarget > 0 ? `${waterTotal} / ${waterTarget} 杯` : "--",
        guidance: waterTotal >= waterTarget && waterTarget > 0 ? "今日目标已完成"
          : waterTotal > 0 ? (nextCupTime ? `下一杯 ${nextCupTime}` : "还差几杯") : "去记录",
      },
      {
        key: "sleep", icon: <Moon className="w-5 h-5" />, color: "#6366F1", bgColor: "#EEF2FF",
        primary: sleepTime || "--",
        guidance: sleepTime ? `昨晚 ${sleepTime} 入睡` : "去记录",
      },
      {
        key: "accounting", icon: <Wallet className="w-5 h-5" />, color: "#10B981", bgColor: "#ECFDF5",
        primary: `本月 ${formatAmount(monthlyExpense)}`,
        guidance: monthlyIncome > 0 ? `收入 ${formatAmount(monthlyIncome)}` : "暂无收入记录",
      },
      {
        key: "fitness", icon: <Dumbbell className="w-5 h-5" />, color: "#F97316", bgColor: "#FFF7ED",
        primary: todaySessions.length > 0 ? `今日 ${todaySessions.length} 次训练` : weekSessions > 0 ? `本周 ${weekSessions} 次` : "--",
        guidance: todaySessions.length > 0 ? `本周累计 ${weekSessions} 次` : "去记录",
      },
      {
        key: "diet", icon: <Utensils className="w-5 h-5" />, color: "#EC4899", bgColor: "#FDF2F8",
        primary: dietLogs.length > 0 ? `${mealCount} / 4 餐` : "--",
        guidance: dietLogs.length > 0 ? (mealCount < 4 ? "还有几餐没记录" : "今日三餐已记录") : "去记录",
      },
      {
        key: "wellness", icon: <Heart className="w-5 h-5" />, color: "#EF4444", bgColor: "#FEF2F2",
        primary: gongfaCount > 0 || tigangCount > 0
          ? `${gongfaCount > 0 ? `功法 ${gongfaCount}` : ""}${gongfaCount > 0 && tigangCount > 0 ? " · " : ""}${tigangCount > 0 ? `提肛 ${tigangCount}` : ""}`
          : "--",
        guidance: gongfaCount > 0 || tigangCount > 0 ? "今日打卡完成" : "去记录",
      },
      {
        key: "posture", icon: <StretchHorizontal className="w-5 h-5" />, color: "#8B5CF6", bgColor: "#F5F3FF",
        primary: stretchDays > 0 ? `本周 ${stretchDays} 天` : "--",
        guidance: stretchDays > 0 ? `共 ${stretchLogs.reduce((s, l) => s + l.sets, 0)} 组` : "去记录",
      },
      {
        key: "wishes", icon: <Star className="w-5 h-5" />, color: "#F59E0B", bgColor: "#FFFBEB",
        primary: pendingWishes > 0 ? `${pendingWishes} 个待实现` : "全部完成",
        guidance: completedWishes > 0 ? `已完成 ${completedWishes} 个` : "添加新心愿",
      },
    ];
  }, [waterItems, waterGoal, sleepLog, monthTransactions, workoutSessions, dietLogs, wellnessLogs, stretchLogs, wishes, today, yesterday]);

  const hasReviewData = summariesWithData.length > 0;

  return (
    <div
      className="min-h-screen"
      style={{
        maxWidth: 430,
        margin: "0 auto",
        background: "var(--lifeflow-background)",
        paddingBottom: 120,
      }}
    >
      {/* ─── Header ────────────────────────────────────────── */}
      <div className="px-5 pt-[var(--safe-area-top)] pb-4">
        <h1 className="text-[22px] font-bold" style={{ color: "var(--color-text-primary)" }}>
          长期主义
        </h1>
        <p className="text-[13px] mt-0.5" style={{ color: "var(--color-text-disabled)" }}>
          每日坚持，时间看得见
        </p>
      </div>

      {/* ─── 复盘时间轴区域 ─────────────────────────────────── */}
      <div className="px-4 mb-5">
        <div
          className="rounded-[16px] overflow-hidden"
          style={{
            background: "var(--color-surface-card)",
            boxShadow: "var(--shadow-card)",
          }}
        >
          {/* 标题行 + 周期切换 */}
          <div className="flex items-center justify-between px-4 pt-3.5 pb-2">
            <div className="flex items-center gap-2">
              <TrendingUp className="w-4 h-4" style={{ color: "var(--lifeflow-primary)" }} />
              <span className="text-[13px] font-semibold" style={{ color: "var(--color-text-primary)" }}>
                复盘
              </span>
            </div>
            <div className="flex gap-1">
              {(Object.entries(PERIOD_LABELS) as [ReviewPeriod, string][]).map(([key, label]) => (
                <button
                  key={key}
                  onClick={() => setReviewPeriod(key)}
                  className="px-2.5 py-1 rounded-lg text-[12px] font-medium transition-colors"
                  style={{
                    background: reviewPeriod === key ? "var(--lifeflow-primary)" : "var(--lifeflow-muted)",
                    color: reviewPeriod === key ? "#fff" : "var(--color-text-secondary)",
                  }}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>

          {/* 概览文案 */}
          {!reviewLoading && hasReviewData && (
            <div className="px-4 pb-1.5">
              <p className="text-[13px] leading-relaxed" style={{ color: "var(--color-text-secondary)" }}>
                {currentReview?.overviewText}
              </p>
            </div>
          )}

          {/* 加载态 */}
          {reviewLoading && (
            <div className="px-4 py-4 space-y-2">
              <div className="h-3 rounded animate-pulse" style={{ background: "var(--lifeflow-muted)", width: "70%" }} />
              <div className="h-3 rounded animate-pulse" style={{ background: "var(--lifeflow-muted)", width: "50%" }} />
            </div>
          )}

          {/* 无数据态 */}
          {!reviewLoading && !hasReviewData && (
            <div className="px-4 py-4">
              <p className="text-[13px]" style={{ color: "var(--color-text-secondary)" }}>
                {PERIOD_FULL_LABELS[reviewPeriod]}暂无数据。开始记录，复盘自动生成。
              </p>
            </div>
          )}

          {/* 各模块摘要行 */}
          {!reviewLoading && hasReviewData && (
            <div className="px-4 pb-3 space-y-2.5">
              {summariesWithData.map(s => (
                <ReviewSummaryRow key={s.module} summary={s} />
              ))}
            </div>
          )}

          {/* 历史复盘折叠 */}
          {!reviewLoading && historicalReviews.length > 0 && (
            <>
              <div className="mx-4 border-t" style={{ borderColor: "var(--lifeflow-border)" }} />
              <button
                onClick={() => setShowHistory(v => !v)}
                className="w-full flex items-center justify-between px-4 py-2.5 text-[12px] font-medium"
                style={{ color: "var(--color-text-secondary)" }}
              >
                <span>历史复盘</span>
                {showHistory ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
              </button>
              {showHistory && (
                <div className="px-4 pb-3 space-y-2">
                  {historicalReviews.map((hr, idx) => {
                    const prefix = reviewPeriod === "daily" ? "前日" :
                      reviewPeriod === "weekly" ? "上周" :
                      reviewPeriod === "monthly" ? "上月" : "去年";
                    return (
                      <div key={idx} className="p-2.5 rounded-xl" style={{ background: "var(--lifeflow-muted)" }}>
                        <p className="text-[12px] font-semibold mb-1" style={{ color: "var(--color-text-primary)" }}>
                          {hr.dateRange.start} ~ {hr.dateRange.end}
                        </p>
                        <p className="text-[11px] leading-relaxed" style={{ color: "var(--color-text-secondary)" }}>
                          {hr.overviewText}
                        </p>
                      </div>
                    );
                  })}
                </div>
              )}
            </>
          )}
        </div>
      </div>

      {/* ─── 8 张模块卡片 ───────────────────────────────────── */}
      <div className="px-4 space-y-3">
        {cardData.map((card) => {
          const mod = MODULES.find((m) => m.key === card.key)!;
          return (
            <Link
              key={card.key}
              href={mod.path}
              className="flex items-center gap-4 p-4 rounded-[16px] no-underline active:opacity-80 transition-opacity"
              style={{ background: card.bgColor }}
            >
              <div
                className="flex items-center justify-center shrink-0"
                style={{
                  width: 44, height: 44, borderRadius: 14,
                  background: card.color + "1A", color: card.color,
                }}
              >
                {card.icon}
              </div>
              <div className="flex-1 min-w-0">
                <span className="text-[11px] font-semibold uppercase tracking-[0.05em]" style={{ color: card.color }}>
                  {mod.label}
                </span>
                <p className="text-[17px] font-semibold mt-0.5 leading-tight truncate" style={{ color: "var(--color-text-primary)" }}>
                  {card.primary}
                </p>
                <p className="text-[12px] mt-0.5 truncate" style={{ color: "var(--color-text-secondary)" }}>
                  {card.guidance}
                </p>
              </div>
              <div style={{ color: "var(--color-text-disabled)" }} className="shrink-0">
                <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                  <path d="M6 4L10 8L6 12" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </div>
            </Link>
          );
        })}
      </div>
    </div>
  );
}
