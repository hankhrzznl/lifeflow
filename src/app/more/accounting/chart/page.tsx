"use client";

import { useMemo, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { useLiveQuery } from "dexie-react-hooks";
import { motion } from "framer-motion";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { getTransactionsByMonth, getTransactionsByYear, getTransactionsByDate, getAllCategories } from "@/lib/db/accounting.db";
import type { Transaction, Category } from "@/lib/db/accounting.db";

// ============================================================
// 设计令牌（Apple 简约风）
// ============================================================
const ACCENT = "#5865F2";
const BAR_LIGHT = "#C7D2FE";
const BAR_ZERO = "#E5E5E5";
const SHADOW_CARD = "0 1px 4px rgba(0,0,0,0.04)";

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

  const toggleView = () => {
    if (viewMode === "month") {
      setYearViewYear(new Date().getFullYear());
      setViewMode("year");
    } else {
      setCurrentYear(new Date().getFullYear());
      setCurrentMonth(new Date().getMonth() + 1);
      setViewMode("month");
    }
  };

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
    <div className="min-h-screen bg-[#FAFAFA]">
      {/* ===== 页头 ===== */}
      <div className="flex items-center relative h-14 px-2 border-b border-[#F5F5F5]">
        <button type="button" onClick={() => router.push("/more/accounting")}
          className="w-11 h-11 flex items-center justify-center">
          <ChevronLeft className="w-6 h-6 text-[#1D1D1F]" />
        </button>
        <span className="absolute left-1/2 -translate-x-1/2 text-[17px] font-semibold text-[#1D1D1F]">图表</span>
        <button type="button" onClick={toggleView}
          className="ml-auto h-8 px-4 rounded-full bg-[#5865F2] text-white text-[13px] font-semibold">
          {isMonth ? "月" : "年"}
        </button>
      </div>

      {/* ═══════ 月视图 ═══════ */}
      {isMonth && (
        <motion.div key="month" initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.25 }}>
          {/* 月份选择行 */}
          <div className="flex items-center justify-center gap-4 py-4">
            <button type="button" onClick={goPrevMonth} className="w-8 h-8 flex items-center justify-center">
              <ChevronLeft className="w-5 h-5 text-[#AEAEB2]" />
            </button>
            <span className="text-[20px] font-semibold text-[#1D1D1F]">{currentYear}年{currentMonth}月</span>
            <button type="button" onClick={goNextMonth} className="w-8 h-8 flex items-center justify-center">
              <ChevronRight className="w-5 h-5 text-[#AEAEB2]" />
            </button>
          </div>

          {/* 汇总双卡 */}
          <div className="flex gap-3 px-4">
            <div className="flex-1 h-[108px] rounded-xl bg-white flex flex-col items-center justify-center gap-1.5" style={{ boxShadow: SHADOW_CARD }}>
              <span className="text-[13px] text-[#86868B]">支出</span>
              <span className="text-[28px] font-bold leading-none text-[#1D1D1F]">¥{fmtCompact(monthExpense)}</span>
            </div>
            <div className="flex-1 h-[108px] rounded-xl bg-white flex flex-col items-center justify-center gap-1.5" style={{ boxShadow: SHADOW_CARD }}>
              <span className="text-[13px] text-[#86868B]">收入</span>
              <span className="text-[28px] font-bold leading-none text-[#1D1D1F]">¥{fmtCompact(monthIncome)}</span>
            </div>
          </div>

          {/* 每日支出·近7日 */}
          <div className="mx-4 mt-3 rounded-xl bg-white p-5" style={{ boxShadow: SHADOW_CARD }}>
            <h2 className="text-[17px] font-bold text-[#1D1D1F]">每日支出·近7日</h2>
            <div className="mt-4 h-[160px] flex items-end">
              {weekExpenses.map((val, i) => {
                const dateStr = last7Days[i];
                const isTodayCol = dateStr === today;
                const h = weekMax > 0 ? Math.max(6, Math.round((val / weekMax) * 140)) : 6;
                return (
                  <div key={i} className="flex-1 flex flex-col items-center justify-end">
                    <motion.div
                      initial={{ height: 0 }}
                      animate={{ height: h }}
                      transition={{ duration: 0.4, delay: i * 0.03 }}
                      className="w-4 rounded-full"
                      style={{
                        background: val > 0 ? (isTodayCol ? ACCENT : BAR_LIGHT) : BAR_ZERO,
                        boxShadow: isTodayCol ? "0 0 0 3px #FFFFFF, 0 0 0 5px #5865F2" : undefined,
                      }}
                    />
                    <span className={`mt-2 text-[11px] ${isTodayCol ? "text-[#5865F2] font-semibold" : "text-[#AEAEB2]"}`}>
                      {new Date(dateStr).getDate()}
                    </span>
                  </div>
                );
              })}
            </div>
            <div className="mt-3 pt-3 border-t border-[#F5F5F5] flex justify-between text-[11px] text-[#AEAEB2]">
              <span>{new Date(last7Days[0]).getMonth() + 1}/{new Date(last7Days[0]).getDate()}</span>
              <span>{new Date(last7Days[6]).getMonth() + 1}/{new Date(last7Days[6]).getDate()}</span>
            </div>
          </div>

          {/* 类别排行 */}
          <div className="mx-4 mt-3 rounded-xl bg-white p-5" style={{ boxShadow: SHADOW_CARD }}>
            <h2 className="text-[17px] font-bold text-[#1D1D1F]">类别排行</h2>
            {monthCatRanking.length === 0 ? (
              <div className="py-8 text-center text-[13px] text-[#AEAEB2]">当月暂无支出记录</div>
            ) : (
              <div className="mt-2">
                {monthCatRanking.map((item, i) => {
                  const pct = monthExpense > 0 ? Math.round((item.amount / monthExpense) * 100) : 0;
                  return (
                    <div key={item.categoryId} className={`flex items-center gap-3 py-3 ${i > 0 ? "border-t border-[#F5F5F5]" : ""}`}>
                      <div className="w-2 h-2 rounded-full shrink-0" style={{ background: item.color }} />
                      <span className="text-[15px] font-medium text-[#1D1D1F] shrink-0">{item.name}</span>
                      <span className="text-[13px] text-[#86868B] w-[42px] shrink-0">{pct}%</span>
                      <div className="flex-1 h-[6px] rounded-full bg-[#F5F5F5] overflow-hidden">
                        <motion.div
                          initial={{ width: 0 }}
                          animate={{ width: `${pct}%` }}
                          transition={{ duration: 0.5, delay: i * 0.03 }}
                          className="h-full rounded-full bg-[#5865F2]"
                        />
                      </div>
                      <span className="text-[15px] font-semibold text-[#1D1D1F] shrink-0">¥{fmtCompact(item.amount)}</span>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* 支出 Top 10 */}
          <div className="mx-4 mt-3 mb-6 rounded-xl bg-white p-5" style={{ boxShadow: SHADOW_CARD }}>
            <h2 className="text-[17px] font-bold text-[#1D1D1F]">支出 Top 10</h2>
            {monthTop10.length === 0 ? (
              <div className="py-8 text-center text-[13px] text-[#AEAEB2]">当月暂无支出记录</div>
            ) : (
              <div className="mt-2">
                {monthTop10.map((tx, i) => {
                  const cat = tx.categoryId ? categoryMap.get(tx.categoryId) : undefined;
                  return (
                    <div key={tx.id} className={`flex items-center gap-3 py-3 ${i > 0 ? "border-t border-[#F5F5F5]" : ""}`}>
                      <span className="w-6 text-center text-[13px] font-medium text-[#AEAEB2]">{i + 1}</span>
                      <div className="w-2 h-2 rounded-full shrink-0" style={{ background: cat?.color || "#AEAEB2" }} />
                      <span className="flex-1 truncate text-[15px] text-[#1D1D1F]">{tx.note || cat?.name || "未分类"}</span>
                      <span className="text-[15px] font-medium text-[#1D1D1F] shrink-0">-¥{fmtCompact(tx.amount)}</span>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </motion.div>
      )}

      {/* ═══════ 年视图 ═══════ */}
      {!isMonth && (
        <motion.div key="year" initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.25 }}>
          {/* 年份选择行 */}
          <div className="flex items-center justify-center gap-4 py-4">
            <button type="button" onClick={goPrevYear} className="w-8 h-8 flex items-center justify-center">
              <ChevronLeft className="w-5 h-5 text-[#AEAEB2]" />
            </button>
            <span className="text-[20px] font-semibold text-[#1D1D1F]">{yearViewYear}年</span>
            <button type="button" onClick={goNextYear} disabled={yearViewYear >= nowYear}
              className={`w-8 h-8 flex items-center justify-center ${yearViewYear >= nowYear ? "opacity-0" : ""}`}>
              <ChevronRight className="w-5 h-5 text-[#AEAEB2]" />
            </button>
          </div>

          {/* 汇总双卡 */}
          <div className="flex gap-3 px-4">
            <div className="flex-1 h-[108px] rounded-xl bg-white flex flex-col items-center justify-center gap-1.5" style={{ boxShadow: SHADOW_CARD }}>
              <span className="text-[13px] text-[#86868B]">支出</span>
              <span className="text-[28px] font-bold leading-none text-[#1D1D1F]">¥{fmtCompact(yearExpense)}</span>
            </div>
            <div className="flex-1 h-[108px] rounded-xl bg-white flex flex-col items-center justify-center gap-1.5" style={{ boxShadow: SHADOW_CARD }}>
              <span className="text-[13px] text-[#86868B]">收入</span>
              <span className="text-[28px] font-bold leading-none text-[#1D1D1F]">¥{fmtCompact(yearIncome)}</span>
            </div>
          </div>

          {/* 每月支出·{year}年（待设计补充后校准） */}
          <div className="mx-4 mt-3 rounded-xl bg-white p-5" style={{ boxShadow: SHADOW_CARD }}>
            <h2 className="text-[17px] font-bold text-[#1D1D1F]">每月支出·{yearViewYear}年</h2>
            <div className="mt-4 h-[160px] flex items-end">
              {monthlyBuckets.map((val, i) => {
                const isCurrentMonth = yearViewYear === nowYear && i === nowMonth - 1;
                const h = yearMaxBucket > 0 ? Math.max(6, Math.round((val / yearMaxBucket) * 140)) : 6;
                return (
                  <div key={i} className="flex-1 flex flex-col items-center justify-end">
                    <motion.div
                      initial={{ height: 0 }}
                      animate={{ height: h }}
                      transition={{ duration: 0.4, delay: i * 0.02 }}
                      className="w-3 rounded-full"
                      style={{ background: val > 0 ? (isCurrentMonth ? ACCENT : BAR_LIGHT) : BAR_ZERO }}
                    />
                    <span className={`mt-2 text-[10px] ${isCurrentMonth ? "text-[#5865F2]" : "text-[#AEAEB2]"}`}>
                      {i + 1}月
                    </span>
                  </div>
                );
              })}
            </div>
            <div className="mt-3 pt-3 border-t border-[#F5F5F5] flex justify-between text-[11px] text-[#AEAEB2]">
              <span>1月</span>
              <span>12月</span>
            </div>
          </div>

          {/* 类别排行 */}
          <div className="mx-4 mt-3 mb-6 rounded-xl bg-white p-5" style={{ boxShadow: SHADOW_CARD }}>
            <h2 className="text-[17px] font-bold text-[#1D1D1F]">类别排行</h2>
            {yearCatRanking.length === 0 ? (
              <div className="py-8 text-center text-[13px] text-[#AEAEB2]">全年暂无支出记录</div>
            ) : (
              <div className="mt-2">
                {yearCatRanking.map((item, i) => {
                  const pct = yearExpense > 0 ? Math.round((item.amount / yearExpense) * 100) : 0;
                  return (
                    <div key={item.categoryId} className={`flex items-center gap-3 py-3 ${i > 0 ? "border-t border-[#F5F5F5]" : ""}`}>
                      <div className="w-2 h-2 rounded-full shrink-0" style={{ background: item.color }} />
                      <span className="text-[15px] font-medium text-[#1D1D1F] shrink-0">{item.name}</span>
                      <span className="text-[13px] text-[#86868B] w-[42px] shrink-0">{pct}%</span>
                      <div className="flex-1 h-[6px] rounded-full bg-[#F5F5F5] overflow-hidden">
                        <motion.div
                          initial={{ width: 0 }}
                          animate={{ width: `${pct}%` }}
                          transition={{ duration: 0.5, delay: i * 0.03 }}
                          className="h-full rounded-full bg-[#5865F2]"
                        />
                      </div>
                      <span className="text-[15px] font-semibold text-[#1D1D1F] shrink-0">¥{fmtCompact(item.amount)}</span>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </motion.div>
      )}
    </div>
  );
}
