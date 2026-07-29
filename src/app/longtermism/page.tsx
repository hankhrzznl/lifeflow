"use client";

import { useMemo } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import Link from "next/link";
import {
  Droplets, Moon, Wallet, Dumbbell, Utensils,
  Heart, StretchHorizontal, Star,
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

  // ─── 数据查询 ────────────────────────────────────────────────

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
  const workoutSessions = useLiveQuery(
    () => getWorkoutSessions(7),
    [], []
  );

  // 5. 饮食
  const dietLogs = useLiveQuery(
    () => getDietLogsByDate(today),
    [today], []
  );

  // 6. 养生
  const wellnessLogs = useLiveQuery(
    () => getWellnessLogsByDate(today),
    [today], []
  );

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

  // ─── 衍生数据 ──────────────────────────────────────────────

  const cardData = useMemo(() => {
    // 饮水
    const waterTotal = waterItems.length;
    const waterTarget = waterGoal ? Math.ceil(waterGoal.dailyTarget / 100) : 0;
    const waterPct = waterTarget > 0 ? Math.round((waterTotal / waterTarget) * 100) : 0;
    // 找出下一杯时间：从当前小时往后找最近的一个缺失时段
    const now = new Date();
    const currentHour = now.getHours();
    const currentMinute = now.getMinutes();
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
    let sleepStatus = "";
    if (sleepLog?.actualTime) {
      sleepTime = sleepLog.actualTime.slice(0, 5);
      sleepStatus = `昨晚 ${sleepTime} 入睡`;
    } else {
      sleepStatus = "暂无记录";
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
    const stretchTotalSets = stretchLogs.reduce((sum, s) => sum + s.sets, 0);
    const stretchTotalReps = stretchLogs.reduce((sum, s) => sum + s.reps, 0);

    // 心愿
    const pendingWishes = wishes.filter(w => !w.completed).length;
    const completedWishes = wishes.filter(w => w.completed).length;

    return [
      {
        key: "water",
        icon: <Droplets className="w-5 h-5" />,
        color: "#3B82F6",
        bgColor: "#EFF6FF",
        primary: waterTarget > 0 ? `${waterTotal} / ${waterTarget} 杯` : "--",
        guidance: waterTotal >= waterTarget && waterTarget > 0
          ? "今日目标已完成"
          : waterTotal > 0
            ? nextCupTime ? `下一杯 ${nextCupTime}` : "还差几杯"
            : "去记录",
      },
      {
        key: "sleep",
        icon: <Moon className="w-5 h-5" />,
        color: "#6366F1",
        bgColor: "#EEF2FF",
        primary: sleepTime || "--",
        guidance: sleepTime
          ? `${sleepStatus}`
          : "去记录",
      },
      {
        key: "accounting",
        icon: <Wallet className="w-5 h-5" />,
        color: "#10B981",
        bgColor: "#ECFDF5",
        primary: `本月 ${formatAmount(monthlyExpense)}`,
        guidance: monthlyIncome > 0 ? `收入 ${formatAmount(monthlyIncome)}` : "暂无收入记录",
      },
      {
        key: "fitness",
        icon: <Dumbbell className="w-5 h-5" />,
        color: "#F97316",
        bgColor: "#FFF7ED",
        primary: todaySessions.length > 0 ? `今日 ${todaySessions.length} 次训练` : weekSessions > 0 ? `本周 ${weekSessions} 次` : "--",
        guidance: todaySessions.length > 0
          ? weekSessions > 0 ? `本周累计 ${weekSessions} 次` : "继续加油"
          : "去记录",
      },
      {
        key: "diet",
        icon: <Utensils className="w-5 h-5" />,
        color: "#EC4899",
        bgColor: "#FDF2F8",
        primary: dietLogs.length > 0 ? `${mealCount} / 4 餐` : "--",
        guidance: dietLogs.length > 0
          ? mealCount < 4 ? "还有几餐没记录" : "今日三餐已记录"
          : "去记录",
      },
      {
        key: "wellness",
        icon: <Heart className="w-5 h-5" />,
        color: "#EF4444",
        bgColor: "#FEF2F2",
        primary: gongfaCount > 0 || tigangCount > 0
          ? `${gongfaCount > 0 ? `功法 ${gongfaCount}` : ""}${gongfaCount > 0 && tigangCount > 0 ? " · " : ""}${tigangCount > 0 ? `提肛 ${tigangCount}` : ""}`
          : "--",
        guidance: gongfaCount > 0 || tigangCount > 0 ? "今日打卡完成" : "去记录",
      },
      {
        key: "posture",
        icon: <StretchHorizontal className="w-5 h-5" />,
        color: "#8B5CF6",
        bgColor: "#F5F3FF",
        primary: stretchDays > 0 ? `本周 ${stretchDays} 天` : "--",
        guidance: stretchDays > 0
          ? `共 ${stretchTotalSets} 组 ${stretchTotalReps} 次`
          : "去记录",
      },
      {
        key: "wishes",
        icon: <Star className="w-5 h-5" />,
        color: "#F59E0B",
        bgColor: "#FFFBEB",
        primary: pendingWishes > 0 ? `${pendingWishes} 个待实现` : "全部完成",
        guidance: completedWishes > 0 ? `已完成 ${completedWishes} 个` : "添加新心愿",
      },
    ];
  }, [waterItems, waterGoal, sleepLog, monthTransactions, workoutSessions, dietLogs, wellnessLogs, stretchLogs, wishes, today, yesterday]);

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
      {/* Header */}
      <div className="px-5 pt-[var(--safe-area-top)] pb-4">
        <h1 className="text-[22px] font-bold" style={{ color: "var(--color-text-primary)" }}>
          长期主义
        </h1>
        <p className="text-[13px] mt-0.5" style={{ color: "var(--color-text-disabled)" }}>
          每日坚持，时间看得见
        </p>
      </div>

      {/* 卡片列表 */}
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
              {/* 左侧图标 */}
              <div
                className="flex items-center justify-center shrink-0"
                style={{
                  width: 44,
                  height: 44,
                  borderRadius: 14,
                  background: card.color + "1A",
                  color: card.color,
                }}
              >
                {card.icon}
              </div>

              {/* 右侧数据 */}
              <div className="flex-1 min-w-0">
                <div className="flex items-baseline gap-2">
                  <span className="text-[11px] font-semibold uppercase tracking-[0.05em]" style={{ color: card.color }}>
                    {mod.label}
                  </span>
                </div>
                <p
                  className="text-[17px] font-semibold mt-0.5 leading-tight truncate"
                  style={{ color: "var(--color-text-primary)" }}
                >
                  {card.primary}
                </p>
                <p
                  className="text-[12px] mt-0.5 truncate"
                  style={{ color: "var(--color-text-secondary)" }}
                >
                  {card.guidance}
                </p>
              </div>

              {/* 箭头 */}
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
