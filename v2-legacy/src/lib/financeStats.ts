"use client";

import { db } from "@/lib/db";
import type { FinRecord } from "@/lib/types";
import { FIN_CATEGORIES } from "@/lib/types";

// ==================== 财务统计 ====================

export interface FinanceStats {
  totalIncome: number;
  totalExpense: number;
  balance: number;
  budgetRemaining: number | null;
  budgetTotal: number | null;
  dailyBreakdown: { date: string; income: number; expense: number }[];
  categoryBreakdown: { key: string; label: string; icon: string; amount: number; color: string }[];
  trend: "up" | "down" | "stable";
  avgDailyExpense: number;
}

/** 获取指定日期范围内的记账记录 */
export async function getFinRecordsByRange(start: string, end: string, accountId?: number): Promise<FinRecord[]> {
  let collection = db.finRecords.where("date").between(start, end, true, true);
  if (accountId !== undefined) {
    collection = collection.filter((r) => r.accountId === accountId);
  }
  return collection.toArray();
}

export async function getFinanceStats(
  records: FinRecord[],
  budgetTotal?: number | null
): Promise<FinanceStats> {
  const totalIncome = records
    .filter((r) => r.type === "income")
    .reduce((sum, r) => sum + r.amount, 0);

  const totalExpense = records
    .filter((r) => r.type === "expense")
    .reduce((sum, r) => sum + r.amount, 0);

  const balance = totalIncome - totalExpense;

  // 每日明细
  const dailyMap: Record<string, { income: number; expense: number }> = {};
  for (const r of records) {
    if (!dailyMap[r.date]) dailyMap[r.date] = { income: 0, expense: 0 };
    if (r.type === "income") dailyMap[r.date].income += r.amount;
    else dailyMap[r.date].expense += r.amount;
  }
  const dailyBreakdown = Object.entries(dailyMap)
    .map(([date, v]) => ({ date, ...v }))
    .sort((a, b) => a.date.localeCompare(b.date));

  // 分类占比（仅支出）
  const categoryMap: Record<string, number> = {};
  for (const r of records) {
    if (r.type === "expense") {
      categoryMap[r.category] = (categoryMap[r.category] || 0) + r.amount;
    }
  }
  const categoryBreakdown = Object.entries(categoryMap)
    .map(([key, amount]) => {
      const expCats = [...FIN_CATEGORIES.expense] as { key: string; label: string; icon: string; color: string }[];
      const incCats = [...FIN_CATEGORIES.income] as { key: string; label: string; icon: string; color: string }[];
      const cat = [...expCats, ...incCats].find((c) => c.key === key);
      return {
        key,
        label: cat?.label || key,
        icon: cat?.icon || "📋",
        amount,
        color: cat?.color || "#9CA3AF",
      };
    })
    .sort((a, b) => b.amount - a.amount);

  // 趋势判断（比较前后半段）
  const mid = Math.floor(records.length / 2);
  const firstHalf = records.slice(0, mid);
  const secondHalf = records.slice(mid);
  const firstExpense = firstHalf.filter((r) => r.type === "expense").reduce((sum, r) => sum + r.amount, 0);
  const secondExpense = secondHalf.filter((r) => r.type === "expense").reduce((sum, r) => sum + r.amount, 0);
  const trend: FinanceStats["trend"] =
    secondExpense > firstExpense * 1.05 ? "up" : secondExpense < firstExpense * 0.95 ? "down" : "stable";

  // 日均支出
  const days = dailyBreakdown.length || 1;
  const avgDailyExpense = Math.round(totalExpense / days);

  return {
    totalIncome,
    totalExpense,
    balance,
    budgetRemaining: budgetTotal != null ? budgetTotal - totalExpense : null,
    budgetTotal: budgetTotal ?? null,
    dailyBreakdown,
    categoryBreakdown,
    trend,
    avgDailyExpense,
  };
}

/** 获取月度预算 */
export async function getMonthBudget(monthKey: string): Promise<number | null> {
  try {
    const record = await db.finBudgets.where("monthKey").equals(monthKey).first();
    return record?.amount ?? null;
  } catch {
    return null;
  }
}

/** 设置月度预算 */
export async function setMonthBudget(monthKey: string, amount: number): Promise<void> {
  try {
    const existing = await db.finBudgets.where("monthKey").equals(monthKey).first();
    if (existing && existing.id !== undefined) {
      await db.finBudgets.update(existing.id, { amount, updatedAt: Date.now() });
    } else {
      await db.finBudgets.add({ monthKey, amount, createdAt: Date.now(), updatedAt: Date.now() });
    }
  } catch {}
}
