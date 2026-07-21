"use client";

import { useMemo, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { useLiveQuery } from "dexie-react-hooks";
import { motion } from "framer-motion";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { getTransactionsByMonth, getTransactionsByYear, getTransactionsByDate, getAllCategories } from "@/lib/db/accounting.db";
import type { Transaction, Category } from "@/lib/db/accounting.db";

// ============================================================
// 设计令牌（CSS 变量）
// ============================================================

function fmtCompact(fen: number): string {
  const yuan = fen / 100;
  return yuan.toLocaleString("zh-CN", {
    minimumFractionDigits: fen % 100 === 0 ? 0 : 2,
    maximumFractionDigits: 2,
  });
}
function todayStr(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

// ─── 年视图 12 月桶 ─────────────────────────────────────────
function buildMonthlyBuckets(year: number, txs: Transaction[]): number[] {
  const buckets: number[] = new Array(12).fill(0);
  for (const t of txs) {
    if (t.type !== "expense") continue;
    const m = parseInt(t.date.slice(5, 7), 10) - 1;
    if (m >= 0 && m < 12) buckets[m] += t.amount;
  }
  return buckets.map((fen) => fen / 100);
}

// ============================================================
// 页面
// ============================================================
export default function ChartPage() {
  const router = useRouter();
  const [viewMode, setViewMode] = useState<"month" | "year">("month");
  const [currentYear, setCurrentYear] = useState(() => new Date().getFullYear());
  const [currentMonth, setCurrentMonth] = useState(() => new Date().getMonth() + 1);
  const [yearViewYear, setYearViewYear] = useState(() => new Date().getFullYear());

  const isMonth = viewMode === "month";
  const nowYear = new Date().getFullYear();
  const nowMonth = new Date().getMonth() + 1;

  const handleTabChange = useCallback((mode: "month" | "year") => {
    if (mode === "year" && viewMode === "month") {
      setYearViewYear(new Date().getFullYear());
    } else if (mode === "month" && viewMode === "year") {
      setCurrentYear(new Date().getFullYear());
      setCurrentMonth(new Date().getMonth() + 1);
    }
    setViewMode(mode);
  }, [viewMode]);

  const goPrevMonth = () => {
    if (currentMonth === 1) { setCurrentYear((y) => y - 1); setCurrentMonth(12); }
    else setCurrentMonth((m) => m - 1);
  };
  const goNextMonth = () => {
    if (currentMonth === 12) { setCurrentYear((y) => y + 1); setCurrentMonth(1); }
    else setCurrentMonth((m) => m + 1);
  };
  const goPrevYear = () => setYearViewYear((y) => y - 1);
  const goNextYear = () => { if (yearViewYear < nowYear) setYearViewYear((y) => y + 1); };

  // ─── 数据 ──────────────────────────────────────────────────
  const monthTxs = useLiveQuery(() => getTransactionsByMonth(currentYear, currentMonth), [currentYear, currentMonth], [] as Transaction[]);
  const yearTxs = useLiveQuery(() => getTransactionsByYear(yearViewYear), [yearViewYear], [] as Transaction[]);
  const categories = useLiveQuery(() => getAllCategories(), [], [] as Category[]);

  const categoryMap = useMemo(() => {
    const m = new Map<string, Category>();
    for (const c of categories) m.set(c.id, c);
    return m;
  }, [categories]);

  // ─── 近 7 日（不跨天缓存） ────────────────────────────────
  const last7Days = useMemo(() => {
    const days: string[] = [];
    for (let i = 6; i >= 0; i--) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      days.push(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`);
    }
    return days;
  }, []);
  const weekTxs = useLiveQuery(() => Promise.all(last7Days.map((d) => getTransactionsByDate(d))), [last7Days.join(",")], [] as Transaction[][]);

  const weekExpenses = useMemo(() => {
    return (weekTxs ?? []).map((txs) => txs.filter((t) => t.type === "expense").reduce((s, t) => s + t.amount, 0));
  }, [weekTxs]);
  const weekMax = Math.max(...weekExpenses, 0);
  const today = todayStr();

  // ─── 月视图计算 ────────────────────────────────────────────
  const monthExpense = useMemo(() => (monthTxs ?? []).filter((t) => t.type === "expense").reduce((s, t) => s + t.amount, 0), [monthTxs]);
  const monthIncome = useMemo(() => (monthTxs ?? []).filter((t) => t.type === "income").reduce((s, t) => s + t.amount, 0), [monthTxs]);

  const monthCatRanking = useMemo(() => {
    const map: Record<string, number> = {};
    for (const t of (monthTxs ?? [])) {
      if (t.type !== "expense") continue;
      const cid = t.categoryId || "__unknown__";
      map[cid] = (map[cid] || 0) + t.amount;
    }
    return Object.entries(map).map(([cid, amount]) => {
      const cat = cid === "__unknown__" ? null : categoryMap.get(cid);
      return { categoryId: cid, name: cat?.name || "未分类", color: cat?.color || "#AEAEB2", amount };
    }).sort((a, b) => b.amount - a.amount);
  }, [monthTxs, categoryMap]);

  const monthTop10 = useMemo(
    () => (monthTxs ?? []).filter((t) => t.type === "expense").sort((a, b) => b.amount - a.amount).slice(0, 10),
    [monthTxs],
  );

  // ─── 年视图计算 ────────────────────────────────────────────
  const yearExpense = useMemo(() => (yearTxs ?? []).filter((t) => t.type === "expense").reduce((s, t) => s + t.amount, 0), [yearTxs]);
  const yearIncome = useMemo(() => (yearTxs ?? []).filter((t) => t.type === "income").reduce((s, t) => s + t.amount, 0), [yearTxs]);
  const monthlyBuckets = useMemo(() => buildMonthlyBuckets(yearViewYear, yearTxs ?? []), [yearViewYear, yearTxs]);
  const yearMaxBucket = Math.max(...monthlyBuckets, 0);

  const yearCatRanking = useMemo(() => {
    const map: Record<string, number> = {};
    for (const t of (yearTxs ?? [])) {
      if (t.type !== "expense") continue;
      const cid = t.categoryId || "__unknown__";
      map[cid] = (map[cid] || 0) + t.amount;
    }
    return Object.entries(map).map(([cid, amount]) => {
      const cat = cid === "__unknown__" ? null : categoryMap.get(cid);
      return { categoryId: cid, name: cat?.name || "未分类", color: cat?.color || "#AEAEB2", amount };
    }).sort((a, b) => b.amount - a.amount);
  }, [yearTxs, categoryMap]);

  // ============================================================
  // 渲染
  // ============================================================
  return (
    <div className="min-h-screen" style={{ background: "var(--lifeflow-background)" }}>
      {/* ===== 页头 ===== */}
      <div className="flex items-center justify-center relative h-14 px-4">
        <button type="button" onClick={() => router.push("/more/accounting")}
          className="absolute left-4 inline-flex h-8 w-8 items-center justify-center rounded-lg"
          style={{ border: "1px solid var(--lifeflow-border)", background: "var(--color-surface-card)" }}>
          <ChevronLeft className="h-4 w-4" style={{ color: "var(--color-text-primary)" }} />
        </button>
        <span className="text-[17px] font-semibold" style={{ color: "var(--color-text-primary)" }}>图表</span>
        <div className="w-8" aria-hidden="true" />
      </div>

      {/* ═══════ 月/年 pill 切换 ═══════ */}
      <div className="flex justify-center mt-3">
        <div className="inline-flex rounded-full p-1" style={{ background: "var(--lifeflow-muted)" }}>
          <button
            type="button"
            onClick={() => handleTabChange("month")}
            className="px-5 py-1.5 rounded-full text-[15px] leading-none transition-all duration-200"
            style={{
              background: isMonth ? "var(--lifeflow-brand)" : "transparent",
              color: isMonth ? "var(--lifeflow-primary-foreground)" : "var(--color-text-secondary)",
              fontWeight: isMonth ? 600 : 400,
              boxShadow: isMonth ? "var(--shadow-tab-center)" : "none",
            }}
          >
            月
          </button>
          <button
            type="button"
            onClick={() => handleTabChange("year")}
            className="px-5 py-1.5 rounded-full text-[15px] leading-none transition-all duration-200"
            style={{
              background: !isMonth ? "var(--lifeflow-brand)" : "transparent",
              color: !isMonth ? "var(--lifeflow-primary-foreground)" : "var(--color-text-secondary)",
              fontWeight: !isMonth ? 600 : 400,
              boxShadow: !isMonth ? "var(--shadow-tab-center)" : "none",
            }}
          >
            年
          </button>
        </div>
      </div>

      {/* ═══════ 月视图 ═══════ */}
      {isMonth && (
        <motion.div key="month" initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.25 }}>
          {/* 月份选择行 */}
          <div className="flex items-center justify-center gap-4 py-4">
            <button type="button" onClick={goPrevMonth} className="w-8 h-8 flex items-center justify-center">
              <ChevronLeft className="w-5 h-5" style={{ color: "var(--color-text-disabled)" }} />
            </button>
            <span className="text-[20px] font-semibold" style={{ color: "var(--color-text-primary)" }}>{currentYear}年{currentMonth}月</span>
            <button type="button" onClick={goNextMonth} className="w-8 h-8 flex items-center justify-center">
              <ChevronRight className="w-5 h-5" style={{ color: "var(--color-text-disabled)" }} />
            </button>
          </div>

          {/* 汇总卡 */}
          <div className="mx-4 rounded-[20px] p-5" style={{ background: "var(--color-surface-card)", boxShadow: "var(--shadow-card)" }}>
            <div className="flex justify-between items-center py-1">
              <span className="text-[15px] font-medium" style={{ color: "var(--color-text-secondary)" }}>支出</span>
              <span className="text-[17px] font-semibold" style={{ color: "var(--color-expense)" }}>¥{fmtCompact(monthExpense)}</span>
            </div>
            <div className="flex justify-between items-center py-1">
              <span className="text-[15px] font-medium" style={{ color: "var(--color-text-secondary)" }}>收入</span>
              <span className="text-[17px] font-semibold" style={{ color: "var(--color-income)" }}>¥{fmtCompact(monthIncome)}</span>
            </div>
            <div className="flex justify-between items-center py-1">
              <span className="text-[15px] font-medium" style={{ color: "var(--color-text-secondary)" }}>结余</span>
              <span className="text-[17px] font-semibold" style={{ color: "var(--color-text-secondary)" }}>¥{fmtCompact(monthIncome - monthExpense)}</span>
            </div>
          </div>

          {/* 分类分布占位 */}
          <div className="mx-4 mt-3 rounded-[20px] p-6 text-center" style={{ background: "var(--color-surface-card)", boxShadow: "var(--shadow-card)" }}>
            <h3 className="text-[15px] font-semibold mb-2" style={{ color: "var(--color-text-primary)" }}>分类分布</h3>
            <p className="text-[13px]" style={{ color: "var(--color-text-disabled)" }}>暂无数据</p>
          </div>

          {/* 趋势占位 */}
          <div className="mx-4 mt-3 mb-6 rounded-[20px] p-6 text-center" style={{ background: "var(--color-surface-card)", boxShadow: "var(--shadow-card)" }}>
            <h3 className="text-[15px] font-semibold mb-2" style={{ color: "var(--color-text-primary)" }}>月度趋势</h3>
            <p className="text-[13px]" style={{ color: "var(--color-text-disabled)" }}>暂无数据</p>
          </div>
        </motion.div>
      )}

      {/* ═══════ 年视图 ═══════ */}
      {!isMonth && (
        <motion.div key="year" initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.25 }}>
          {/* 年份选择行 */}
          <div className="flex items-center justify-center gap-4 py-4">
            <button type="button" onClick={goPrevYear} className="w-8 h-8 flex items-center justify-center">
              <ChevronLeft className="w-5 h-5" style={{ color: "var(--color-text-disabled)" }} />
            </button>
            <span className="text-[20px] font-semibold" style={{ color: "var(--color-text-primary)" }}>{yearViewYear}年</span>
            <button type="button" onClick={goNextYear} disabled={yearViewYear >= nowYear}
              className={`w-8 h-8 flex items-center justify-center ${yearViewYear >= nowYear ? "opacity-0" : ""}`}>
              <ChevronRight className="w-5 h-5" style={{ color: "var(--color-text-disabled)" }} />
            </button>
          </div>

          {/* 汇总卡 */}
          <div className="mx-4 rounded-[20px] p-5" style={{ background: "var(--color-surface-card)", boxShadow: "var(--shadow-card)" }}>
            <div className="flex justify-between items-center py-1">
              <span className="text-[15px] font-medium" style={{ color: "var(--color-text-secondary)" }}>支出</span>
              <span className="text-[17px] font-semibold" style={{ color: "var(--color-expense)" }}>¥{fmtCompact(yearExpense)}</span>
            </div>
            <div className="flex justify-between items-center py-1">
              <span className="text-[15px] font-medium" style={{ color: "var(--color-text-secondary)" }}>收入</span>
              <span className="text-[17px] font-semibold" style={{ color: "var(--color-income)" }}>¥{fmtCompact(yearIncome)}</span>
            </div>
            <div className="flex justify-between items-center py-1">
              <span className="text-[15px] font-medium" style={{ color: "var(--color-text-secondary)" }}>结余</span>
              <span className="text-[17px] font-semibold" style={{ color: "var(--color-text-secondary)" }}>¥{fmtCompact(yearIncome - yearExpense)}</span>
            </div>
          </div>

          {/* 分类分布占位 */}
          <div className="mx-4 mt-3 rounded-[20px] p-6 text-center" style={{ background: "var(--color-surface-card)", boxShadow: "var(--shadow-card)" }}>
            <h3 className="text-[15px] font-semibold mb-2" style={{ color: "var(--color-text-primary)" }}>分类分布</h3>
            <p className="text-[13px]" style={{ color: "var(--color-text-disabled)" }}>暂无数据</p>
          </div>

          {/* 趋势占位 */}
          <div className="mx-4 mt-3 mb-6 rounded-[20px] p-6 text-center" style={{ background: "var(--color-surface-card)", boxShadow: "var(--shadow-card)" }}>
            <h3 className="text-[15px] font-semibold mb-2" style={{ color: "var(--color-text-primary)" }}>年度趋势</h3>
            <p className="text-[13px]" style={{ color: "var(--color-text-disabled)" }}>暂无数据</p>
          </div>
        </motion.div>
      )}
    </div>
  );
}
