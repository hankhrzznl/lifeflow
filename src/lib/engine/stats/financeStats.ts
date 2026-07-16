// ============================================================
// 统计计算 — 财务统计
// ============================================================

import { db } from '@/lib/db';
import type { FinRecord } from '@/lib/types';

export interface FinanceStats {
  totalIncome: number;
  totalExpense: number;
  balance: number;
  byCategory: Record<string, number>;
  budgetExecution: number;
  recordCount: number;
}

/**
 * 计算指定账本月度的财务统计
 */
export async function calculateFinanceStats(
  accountId: number,
  month: Date,
): Promise<FinanceStats> {
  const year = month.getFullYear();
  const m = month.getMonth();
  const startOfMonth = `${year}-${String(m + 1).padStart(2, '0')}-01`;
  const endDate = new Date(year, m + 1, 0);
  const endOfMonth = `${year}-${String(m + 1).padStart(2, '0')}-${String(endDate.getDate()).padStart(2, '0')}`;

  // 查询当月收支
  const allRecords = await db.finRecords
    .filter((r) => r.accountId === accountId)
    .toArray();

  const records = allRecords.filter((r) => r.date >= startOfMonth && r.date <= endOfMonth);

  const income = records.filter((r) => r.type === 'income').reduce((s, r) => s + r.amount, 0);
  const expense = records.filter((r) => r.type === 'expense').reduce((s, r) => s + r.amount, 0);

  const byCategory: Record<string, number> = {};
  for (const r of records) {
    if (r.type === 'expense') {
      byCategory[r.category] = (byCategory[r.category] || 0) + r.amount;
    }
  }

  // 预算执行率
  const monthKey = `${year}-${String(m + 1).padStart(2, '0')}`;
  const budgets = await db.finBudgets.filter((b) => b.monthKey === monthKey).toArray();
  const totalBudget = budgets.reduce((s, b) => s + b.amount, 0);
  const budgetExecution = totalBudget > 0 ? Math.round((expense / totalBudget) * 100) : 0;

  return {
    totalIncome: income,
    totalExpense: expense,
    balance: income - expense,
    byCategory,
    budgetExecution,
    recordCount: records.length,
  };
}
