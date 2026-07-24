import { getItemsByDate } from "@/lib/db/daylog.db";
import type { Item } from "@/lib/db/daylog.db";
import { healthDB, getSleepLogByDate, getSleepLogs, getWaterLogsByDate, getWaterGoal, getSleepGoal } from "@/lib/db/health.db";
import type { SleepLog } from "@/lib/db/health.db";
import { getTransactionsByDate, getAllCategories, getAllLedgers, getAllAccounts } from "@/lib/db/accounting.db";
import { getAllProjects } from "@/lib/db/efficiency.db";

export interface PerceptionCard {
  id: string;
  ruleName: string;
  priority: number; // 1最高
  type: "insight" | "care" | "celebration" | "guidance";
  headline: string;
  body: string;
  action?: { label: string; path: string } | null;
}

function todayStr(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function yesterdayStr(): string {
  const d = new Date();
  d.setDate(d.getDate() - 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function daysAgo(n: number): string {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function nowHour(): number {
  return new Date().getHours();
}

function formatDuration(minutes: number): string {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  if (h === 0 && m === 0) return "不到1小时";
  if (h === 0) return `${m}分钟`;
  if (m === 0) return `${h}小时`;
  return `${h}小时${m}分钟`;
}

async function checkSleepInsufficient(): Promise<PerceptionCard | null> {
  try {
    const log = await getSleepLogByDate(yesterdayStr());
    if (!log) return null;

    if (log.isOnTime === false) {
      return {
        id: "sleep_insufficient",
        ruleName: "sleep_insufficient",
        priority: 1,
        type: "insight",
        headline: "昨晚睡得偏晚了",
        body: "今天把重要的事放在精力最好的时段，感觉会不一样。",
        action: { label: "看看日程", path: "/efficiency/schedule" },
      };
    }

    return null;
  } catch (e) {
    console.error("[Perception] checkSleepInsufficient 执行失败:", e);
    return null;
  }
}

async function checkSleepLateStreak(): Promise<PerceptionCard | null> {
  try {
    const logs = await getSleepLogs(5);
    if (!logs || logs.length === 0) return null;

    const sortedLogs = [...logs].sort((a, b) => {
      const dateA = typeof a.date === "string" ? a.date : "";
      const dateB = typeof b.date === "string" ? b.date : "";
      return dateB.localeCompare(dateA);
    });

    let streakCount = 0;
    for (const log of sortedLogs) {
      if (log.isOnTime === false) {
        streakCount++;
      } else {
        break;
      }
    }

    if (streakCount >= 3) {
      return {
        id: "sleep_late_streak",
        ruleName: "sleep_late_streak",
        priority: 2,
        type: "care",
        headline: `连续${streakCount}天睡得偏晚了`,
        body: "身体喜欢有规律的节奏。今晚试着比昨天早半小时放下手机？",
        action: { label: "看看睡眠", path: "/more/sleep" },
      };
    }

    return null;
  } catch (e) {
    console.error("[Perception] checkSleepLateStreak 执行失败:", e);
    return null;
  }
}

async function checkWaterLowAfternoon(): Promise<PerceptionCard | null> {
  try {
    if (nowHour() < 16) return null;

    const logs = await getWaterLogsByDate(todayStr());
    const goal = await getWaterGoal().catch(() => null);
    const dailyTarget = goal?.dailyTarget ?? 2000;
    const todayTotal = logs.reduce((sum, l) => sum + l.amount, 0);

    if (todayTotal < dailyTarget * 0.5) {
      return {
        id: "water_low_afternoon",
        ruleName: "water_low_afternoon",
        priority: 2,
        type: "care",
        headline: "今天喝的水不多，现在还来得及",
        body: "现在喝一杯，还来得及轻松达标。",
        action: { label: "记一杯", path: "/more/water" },
      };
    }

    return null;
  } catch (e) {
    console.error("[Perception] checkWaterLowAfternoon 执行失败:", e);
    return null;
  }
}

async function checkExpenseHighToday(): Promise<PerceptionCard | null> {
  try {
    const transactions = await getTransactionsByDate(todayStr());
    const todayExpense = transactions
      .filter((t) => t.type === "expense")
      .reduce((sum, t) => sum + t.amount, 0);

    if (todayExpense === 0) return null;

    if (todayExpense > 50000) {
      return {
        id: "expense_high_today",
        ruleName: "expense_high_today",
        priority: 2,
        type: "insight",
        headline: "今天有一笔不小的花销",
        body: `花了¥${(todayExpense / 100).toFixed(0)}。是计划内的吗？`,
        action: { label: "查看账单", path: "/more/accounting" },
      };
    }

    return null;
  } catch (e) {
    console.error("[Perception] checkExpenseHighToday 执行失败:", e);
    return null;
  }
}

async function checkScheduleOverload(): Promise<PerceptionCard | null> {
  try {
    if (nowHour() < 15) return null;

    const items = await getItemsByDate(todayStr());
    const unfinished = items.filter((i) => !i.isCompleted);

    if (unfinished.length > 5) {
      return {
        id: "schedule_overload",
        ruleName: "schedule_overload",
        priority: 1,
        type: "insight",
        headline: `今天排了${items.length}件事，还剩${unfinished.length}件`,
        body: "时间可能有点紧了。把其中一件挪到明天并不会怎样。",
        action: { label: "调整日程", path: "/efficiency/schedule" },
      };
    }

    return null;
  } catch (e) {
    console.error("[Perception] checkScheduleOverload 执行失败:", e);
    return null;
  }
}

async function checkDayComplete(): Promise<PerceptionCard | null> {
  try {
    const items = await getItemsByDate(todayStr());
    const unfinished = items.filter((i) => !i.isCompleted);

    if (items.length > 0 && unfinished.length === 0) {
      return {
        id: "day_complete",
        ruleName: "day_complete",
        priority: 3,
        type: "celebration",
        headline: "今天的事全部做完了",
        body: "全勤的一天，干得漂亮。",
        action: null,
      };
    }

    return null;
  } catch (e) {
    console.error("[Perception] checkDayComplete 执行失败:", e);
    return null;
  }
}

async function checkHabitNeglected(): Promise<PerceptionCard | null> {
  try {
    const projects = await getAllProjects();
    const defaultModules = projects.filter(
      (p) => p.isDefault === true && p.projectType === "small"
    );

    const yesterdayLogs: Record<string, unknown> = {};
    const todayLogs: Record<string, unknown> = {};

    for (const mod of defaultModules) {
      if (mod.name === "water" || mod.name === "饮水") {
        yesterdayLogs[mod.name] = await getWaterLogsByDate(yesterdayStr());
        todayLogs[mod.name] = await getWaterLogsByDate(todayStr());
      } else if (mod.name === "sleep" || mod.name === "睡眠") {
        yesterdayLogs[mod.name] = await getSleepLogByDate(yesterdayStr());
        todayLogs[mod.name] = await getSleepLogByDate(todayStr());
      }
    }

    for (const mod of defaultModules) {
      const yLog = yesterdayLogs[mod.name];
      const tLog = todayLogs[mod.name];

      const hasYesterday = Array.isArray(yLog) ? yLog.length > 0 : !!yLog;
      const hasToday = Array.isArray(tLog) ? tLog.length > 0 : !!tLog;

      if (!hasToday && !hasYesterday) {
        return {
          id: "habit_neglected",
          ruleName: "habit_neglected",
          priority: 3,
          type: "care",
          headline: `"${mod.name}"的记录空了两天`,
          body: "没关系，不需要有压力。需要帮你调整提醒时间吗？",
          action: { label: "调整提醒", path: "/settings" },
        };
      }
    }

    return null;
  } catch (e) {
    console.error("[Perception] checkHabitNeglected 执行失败:", e);
    return null;
  }
}

async function checkNewUserGuide(): Promise<PerceptionCard | null> {
  try {
    const items = await getItemsByDate(todayStr());
    const sleepLogs = await getSleepLogs(7);
    const transactions = await getTransactionsByDate(todayStr());

    if (items.length < 3 && sleepLogs.length === 0 && transactions.length === 0) {
      return {
        id: "new_user_guide",
        ruleName: "new_user_guide",
        priority: 1,
        type: "guidance",
        headline: "欢迎，我还在认识你",
        body: "你可以先新建一个今天要做的事项，或者用语音告诉助手你想做什么。",
        action: { label: "开始探索", path: "/more/projects" },
      };
    }

    return null;
  } catch (e) {
    console.error("[Perception] checkNewUserGuide 执行失败:", e);
    return null;
  }
}

export async function runPerceptionCheck(): Promise<PerceptionCard[]> {
  const rules: Array<() => Promise<PerceptionCard | null>> = [
    checkSleepInsufficient,
    checkSleepLateStreak,
    checkWaterLowAfternoon,
    checkExpenseHighToday,
    checkScheduleOverload,
    checkDayComplete,
    checkHabitNeglected,
    checkNewUserGuide,
  ];

  const results: PerceptionCard[] = [];
  for (const rule of rules) {
    try {
      const card = await rule();
      if (card) results.push(card);
    } catch (e) {
      console.error("[Perception] 规则执行失败:", e);
    }
  }

  return results.sort((a, b) => a.priority - b.priority);
}
