"use client";

import { useMemo, useState, useCallback } from "react";
import Link from "next/link";
import { useLiveQuery } from "dexie-react-hooks";
import { motion } from "framer-motion";
import { ChevronLeft, ChevronRight, BarChart3 } from "lucide-react";
import { getTransactionsByMonth, getTransactionsByYear, getAllCategories } from "@/lib/db/accounting.db";
import type { Transaction, Category } from "@/lib/db/accounting.db";
import { getIcon, CategoryIcon } from "@/components/accounting/CategoryIcon";
import { showToast } from "@/components/ui/Toast";

// ============================================================
// 设计令牌（monthly-bill.html + yearly-bill.html）
// ============================================================

const BRAND = "#34C759";
const EXPENSE = "#FF3B30";
const INCOME = "#007AFF";
const MUTED = "#8E8E93";
const DISABLED = "#C7C7CC";
const BORDER = "#E5E5EA";
const BG = "#F2F2F7";
const SHADOW_CARD = "0 4px 16px rgba(0,0,0,0.08)";

// ─── 格式化 ──────────────────────────────────────────────────

function fmtCompact(fen: number): string {
  const yuan = fen / 100;
  return yuan.toLocaleString("zh-CN", {
    minimumFractionDigits: fen % 100 === 0 ? 0 : 2,
    maximumFractionDigits: 2,
  });
}

function fmtFull(fen: number): string {
  return (fen / 100).toLocaleString("zh-CN", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

// ─── Y 轴刻度取整 ────────────────────────────────────────────

function niceMax(val: number): number {
  if (val <= 0) return 500;
  const exp = Math.floor(Math.log10(val));
  const mag = Math.pow(10, exp);
  const norm = val / mag;
  if (norm <= 1) return mag;
  if (norm <= 2) return 2 * mag;
  if (norm <= 5) return 5 * mag;
  return 10 * mag;
}

// ─── 月视图：月份拆分 7 段 ───────────────────────────────────

function buildSegments(year: number, month: number, txs: Transaction[], typeTab: "expense" | "income") {
  const days = new Date(year, month, 0).getDate();
  const baseSize = Math.floor(days / 7);
  const extra = days % 7;

  const segments: { start: number; end: number; label: string; amount: number }[] = [];
  let day = 1;

  for (let i = 0; i < 7; i++) {
    const segSize = baseSize + (i < extra ? 1 : 0);
    const end = Math.min(day + segSize - 1, days);

    let sum = 0;
    const prefix = `${year}-${String(month).padStart(2, "0")}`;
    for (const t of txs) {
      if (t.type !== typeTab) continue;
      const d = parseInt(t.date.slice(-2), 10);
      if (d >= day && d <= end) sum += t.amount;
    }

    segments.push({ start: day, end, label: `${month}.${day}`, amount: sum / 100 });
    day = end + 1;
  }

  return segments;
}

// ─── 年视图：12 月桶 ─────────────────────────────────────────

function buildMonthlyBuckets(year: number, txs: Transaction[], typeTab: "expense" | "income") {
  const buckets: number[] = new Array(12).fill(0);
  for (const t of txs) {
    if (t.type !== typeTab) continue;
    const m = parseInt(t.date.slice(5, 7), 10) - 1; // 0-indexed
    if (m >= 0 && m < 12) buckets[m] += t.amount;
  }
  return buckets.map((fen) => fen / 100); // 转为元
}

// ============================================================
// 页面
// ============================================================

export default function ChartPage() {
  // 视图模式
  const [viewMode, setViewMode] = useState<"month" | "year">("month");

  // 月视图状态
  const [currentYear, setCurrentYear] = useState(() => new Date().getFullYear());
  const [currentMonth, setCurrentMonth] = useState(() => new Date().getMonth() + 1);

  // 年视图状态
  const [yearViewYear, setYearViewYear] = useState(() => new Date().getFullYear());

  // 共用状态
  const [typeTab, setTypeTab] = useState<"expense" | "income">("expense");
  const [chartType, setChartType] = useState<"bar" | "line">("bar");

  const isMonth = viewMode === "month";

  // ─── 视图切换 ──────────────────────────────────────────────

  const switchToMonth = useCallback(() => {
    const now = new Date();
    setCurrentYear(now.getFullYear());
    setCurrentMonth(now.getMonth() + 1);
    setViewMode("month");
  }, []);

  const switchToYear = useCallback(() => {
    setYearViewYear(new Date().getFullYear());
    setViewMode("year");
  }, []);

  // ─── 月份切换 ──────────────────────────────────────────────

  const goPrevMonth = useCallback(() => {
    if (currentMonth === 1) {
      setCurrentYear((y) => y - 1);
      setCurrentMonth(12);
    } else {
      setCurrentMonth((m) => m - 1);
    }
  }, [currentMonth]);

  const goNextMonth = useCallback(() => {
    if (currentMonth === 12) {
      setCurrentYear((y) => y + 1);
      setCurrentMonth(1);
    } else {
      setCurrentMonth((m) => m + 1);
    }
  }, [currentMonth]);

  // ─── 年份切换 ──────────────────────────────────────────────

  const nowYear = new Date().getFullYear();
  const canGoNextYear = yearViewYear < nowYear;

  const goPrevYear = useCallback(() => {
    setYearViewYear((y) => y - 1);
  }, []);

  const goNextYear = useCallback(() => {
    if (canGoNextYear) setYearViewYear((y) => y + 1);
  }, [canGoNextYear]);

  // ─── 数据（liveQuery） ──────────────────────────────────────

  // 月数据
  const monthTxs = useLiveQuery(
    () => getTransactionsByMonth(currentYear, currentMonth),
    [currentYear, currentMonth],
    [] as Transaction[],
  );

  // 年数据
  const yearTxs = useLiveQuery(
    () => getTransactionsByYear(yearViewYear),
    [yearViewYear],
    [] as Transaction[],
  );

  // 分类
  const categories = useLiveQuery(() => getAllCategories(), [], [] as Category[]);

  const categoryMap = useMemo(() => {
    const m = new Map<string, Category>();
    for (const c of categories) m.set(c.id, c);
    return m;
  }, [categories]);

  // ────────── 月视图计算 ─────────────────────────────────────

  const monthFiltered = useMemo(
    () => (monthTxs ?? []).filter((t) => t.type === typeTab),
    [monthTxs, typeTab],
  );
  const monthOpposite = useMemo(
    () => (monthTxs ?? []).filter((t) => t.type === (typeTab === "expense" ? "income" : "expense")),
    [monthTxs, typeTab],
  );

  const monthTotal = useMemo(() => monthFiltered.reduce((s, t) => s + t.amount, 0), [monthFiltered]);
  const monthCount = monthFiltered.length;
  const monthOppTotal = useMemo(() => monthOpposite.reduce((s, t) => s + t.amount, 0), [monthOpposite]);

  const monthIncome = useMemo(() => (monthTxs ?? []).filter((t) => t.type === "income").reduce((s, t) => s + t.amount, 0), [monthTxs]);
  const monthExpense = useMemo(() => (monthTxs ?? []).filter((t) => t.type === "expense").reduce((s, t) => s + t.amount, 0), [monthTxs]);
  const monthBalance = monthIncome - monthExpense;

  const segments = useMemo(
    () => buildSegments(currentYear, currentMonth, monthTxs ?? [], typeTab),
    [currentYear, currentMonth, monthTxs, typeTab],
  );
  const maxSeg = Math.max(...segments.map((s) => s.amount), 0);
  const yMax = niceMax(maxSeg);
  const yLabels = useMemo(() => {
    const step = yMax / 5;
    return [yMax, yMax - step, yMax - step * 2, yMax - step * 3, yMax - step * 4].map((v) => Math.round(v));
  }, [yMax]);

  const daysInMonth = new Date(currentYear, currentMonth, 0).getDate();
  const dailyAvg = daysInMonth > 0 ? monthTotal / 100 / daysInMonth : 0;

  const monthCatRanking = useMemo(() => {
    const map: Record<string, number> = {};
    for (const t of monthFiltered) {
      const cid = t.categoryId || "__unknown__";
      map[cid] = (map[cid] || 0) + t.amount;
    }
    return Object.entries(map).map(([cid, amount]) => {
      const cat = cid === "__unknown__" ? null : categoryMap.get(cid);
      return { categoryId: cid, name: cat?.name || "其他", icon: cat?.icon || "help-circle", color: cat?.color || "#8E8E93", amount };
    }).sort((a, b) => b.amount - a.amount);
  }, [monthFiltered, categoryMap]);

  const monthMaxCat = monthCatRanking[0]?.amount ?? 1;

  const monthDetailRanking = useMemo(
    () => [...monthFiltered].sort((a, b) => b.amount - a.amount).slice(0, 10),
    [monthFiltered],
  );

  // ────────── 年视图计算 ─────────────────────────────────────

  const yearExpense = useMemo(
    () => (yearTxs ?? []).filter((t) => t.type === "expense").reduce((s, t) => s + t.amount, 0),
    [yearTxs],
  );
  const yearIncome = useMemo(
    () => (yearTxs ?? []).filter((t) => t.type === "income").reduce((s, t) => s + t.amount, 0),
    [yearTxs],
  );

  const monthlyBuckets = useMemo(
    () => buildMonthlyBuckets(yearViewYear, yearTxs ?? [], typeTab),
    [yearViewYear, yearTxs, typeTab],
  );

  const yearMaxBucket = Math.max(...monthlyBuckets, 0);
  const yearMonthlyAvg = typeTab === "expense" ? yearExpense / 12 : yearIncome / 12;

  const yearCatRanking = useMemo(() => {
    const map: Record<string, number> = {};
    const yearFiltered = (yearTxs ?? []).filter((t) => t.type === typeTab);
    for (const t of yearFiltered) {
      const cid = t.categoryId || "__unknown__";
      map[cid] = (map[cid] || 0) + t.amount;
    }
    return Object.entries(map).map(([cid, amount]) => {
      const cat = cid === "__unknown__" ? null : categoryMap.get(cid);
      return { categoryId: cid, name: cat?.name || "其他", icon: cat?.icon || "help-circle", color: cat?.color || "#8E8E93", amount };
    }).sort((a, b) => b.amount - a.amount);
  }, [yearTxs, typeTab, categoryMap]);

  const yearMaxCat = yearCatRanking[0]?.amount ?? 1;

  // ─── 共用 ──────────────────────────────────────────────────

  const handleLineTab = () => {
    showToast({ type: "info", message: "功能开发中" });
  };

  const isExpense = typeTab === "expense";
  const amountColor = isExpense ? EXPENSE : INCOME;
  const typeLabel = isExpense ? "支出" : "收入";
  const otherLabel = isExpense ? "收入" : "支出";

  // ============================================================
  // 渲染
  // ============================================================

  return (
    <div style={{ background: BG, minHeight: "100vh" }}>
      <div className="mx-auto" style={{ maxWidth: 430 }}>

        {/* ===== 1. 顶部导航条 52px ===== */}
        <div className="flex items-center relative" style={{ height: 52, padding: "0 8px" }}>
          <Link
            href="/accounting"
            className="inline-flex items-center justify-center"
            style={{ width: 44, height: 44 }}
            aria-label="返回"
          >
            <ChevronLeft className="h-6 w-6" style={{ color: "#000000" }} />
          </Link>

          {/* 月账单 | 年账单 分段控件 160×36 */}
          <div className="absolute" style={{ left: "50%", top: "50%", transform: "translate(-50%, -50%)" }}>
            <div className="flex rounded-full" style={{ width: 160, height: 36, background: BORDER, padding: 2 }}>
              <button
                type="button"
                onClick={switchToMonth}
                className="flex-1 flex items-center justify-center rounded-full"
                style={{ background: isMonth ? "#FFFFFF" : "transparent" }}
              >
                <span style={{ fontSize: 15, fontWeight: isMonth ? 600 : 400, color: isMonth ? "#000000" : MUTED }}>
                  月账单
                </span>
              </button>
              <button
                type="button"
                onClick={switchToYear}
                className="flex-1 flex items-center justify-center rounded-full"
                style={{ background: isMonth ? "transparent" : "#FFFFFF" }}
              >
                <span style={{ fontSize: 15, fontWeight: isMonth ? 400 : 600, color: isMonth ? MUTED : "#000000" }}>
                  年账单
                </span>
              </button>
            </div>
          </div>
        </div>

        {/* ════════════════════════════════════════════════════════════ */}
        {/* 月视图 */}
        {/* ════════════════════════════════════════════════════════════ */}
        {isMonth && (
          <motion.div
            key="month"
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.25 }}
          >
            {/* 日期 + 筛选行 */}
            <div className="flex items-center justify-between" style={{ height: 44, padding: "0 20px" }}>
              <div className="flex items-center gap-1">
                <button type="button" onClick={goPrevMonth} className="inline-flex items-center justify-center" style={{ width: 28, height: 28 }} aria-label="上一月">
                  <ChevronLeft className="h-4 w-4" style={{ color: MUTED }} />
                </button>
                <span style={{ fontSize: 17, fontWeight: 600, color: "#000000", whiteSpace: "nowrap" }}>
                  {currentYear}年{String(currentMonth).padStart(2, "0")}月
                </span>
                <button type="button" onClick={goNextMonth} className="inline-flex items-center justify-center" style={{ width: 28, height: 28 }} aria-label="下一月">
                  <ChevronRight className="h-4 w-4" style={{ color: MUTED }} />
                </button>
              </div>
              {/* 支出/收入 Pill */}
              <div className="flex rounded-full" style={{ width: 120, height: 32, background: BORDER, padding: 2 }}>
                <button type="button" onClick={() => setTypeTab("expense")}
                  className="flex-1 flex items-center justify-center rounded-full"
                  style={{ background: typeTab === "expense" ? "#FFFFFF" : "transparent" }}>
                  <span style={{ fontSize: 15, fontWeight: typeTab === "expense" ? 600 : 400, color: typeTab === "expense" ? "#000000" : MUTED }}>支出</span>
                </button>
                <button type="button" onClick={() => setTypeTab("income")}
                  className="flex-1 flex items-center justify-center rounded-full"
                  style={{ background: typeTab === "income" ? "#FFFFFF" : "transparent" }}>
                  <span style={{ fontSize: 15, fontWeight: typeTab === "income" ? 600 : 400, color: typeTab === "income" ? "#000000" : MUTED }}>收入</span>
                </button>
              </div>
            </div>

            {/* 汇总卡片 */}
            <div className="mx-4 flex flex-col justify-center" style={{ height: 140, background: "#FFFFFF", borderRadius: 16, boxShadow: SHADOW_CARD, padding: 16 }}>
              <p style={{ fontSize: 15, color: MUTED, margin: "0 0 8px 0" }}>共{typeLabel} {monthCount} 笔，合计</p>
              <p style={{ fontSize: 34, fontWeight: 700, color: amountColor, margin: "0 0 12px 0", lineHeight: 1.2 }}>¥{fmtCompact(monthTotal)}</p>
              <p style={{ fontSize: 15, color: MUTED, margin: 0 }}>
                {monthOpposite.length} 笔{otherLabel}{" "}
                <span style={{ color: isExpense ? INCOME : EXPENSE }}>¥{fmtCompact(monthOppTotal)}</span>
                {"  |  结余 ¥"}{fmtCompact(monthBalance)}
              </p>
            </div>

            {/* 趋势标题 */}
            <div className="flex items-center justify-between mx-4" style={{ height: 44, marginTop: 16 }}>
              <span style={{ fontSize: 17, fontWeight: 600, color: "#000000" }}>{typeLabel}月趋势图</span>
              <div className="flex rounded-full" style={{ width: 120, height: 28, background: BORDER, padding: 2 }}>
                <div className="flex-1 flex items-center justify-center rounded-full" style={{ background: chartType === "bar" ? "#FFFFFF" : "transparent" }}>
                  <span style={{ fontSize: 13, fontWeight: chartType === "bar" ? 600 : 400, color: chartType === "bar" ? "#000000" : MUTED }}>柱状图</span>
                </div>
                <button type="button" onClick={handleLineTab} className="flex-1 flex items-center justify-center rounded-full" style={{ background: "transparent" }}>
                  <span style={{ fontSize: 13, fontWeight: 400, color: MUTED }}>折线图</span>
                </button>
              </div>
            </div>

            {/* 图表卡片 */}
            <div className="mx-4 flex flex-col" style={{ height: 280, background: "#FFFFFF", borderRadius: 16, boxShadow: SHADOW_CARD, padding: 16 }}>
              <p style={{ fontSize: 13, color: MUTED, margin: "0 0 12px 0" }}>日平均 ¥{fmtCompact(Math.round(dailyAvg * 100))}</p>
              <div className="flex-1 flex flex-col" style={{ position: "relative" }}>
                <div className="flex-1 relative" style={{ paddingLeft: 36, paddingBottom: 28 }}>
                  <div className="flex flex-col justify-between" style={{ position: "absolute", left: 36, right: 0, top: 0, bottom: 28, pointerEvents: "none" }}>
                    {[0, 1, 2, 3, 4].map((i) => (<div key={i} style={{ height: 0.5, background: BORDER }} />))}
                  </div>
                  <div className="flex flex-col justify-between" style={{ position: "absolute", left: 0, right: 0, top: 0, bottom: 28, pointerEvents: "none" }}>
                    {yLabels.map((v, i) => (<div key={i} style={{ textAlign: "right", paddingRight: 4 }}><span style={{ fontSize: 10, color: DISABLED }}>{v}</span></div>))}
                  </div>
                  <div className="relative h-full" style={{ marginLeft: 4 }}>
                    <div className="absolute inset-x-0 bottom-0 flex items-end justify-around" style={{ height: "100%" }}>
                      {segments.map((seg, i) => {
                        const pct = yMax > 0 ? (seg.amount / yMax) * 100 : 0;
                        return (
                          <div key={i} style={{ width: 24, height: `${pct}%`, background: amountColor, borderRadius: "4px 4px 0 0", opacity: seg.amount > 0 ? 1 : 0.15 }} />
                        );
                      })}
                    </div>
                    <div className="absolute inset-x-0" style={{ bottom: -1, height: 0.5, background: BORDER }} />
                  </div>
                </div>
                <div className="flex justify-around" style={{ paddingLeft: 40, height: 28 }}>
                  {segments.map((seg, i) => (<span key={i} style={{ fontSize: 11, color: DISABLED }}>{seg.label}</span>))}
                </div>
              </div>
            </div>

            {/* 类别排行榜 */}
            <div className="mx-4" style={{ marginTop: 12 }}>
              <span style={{ fontSize: 17, fontWeight: 600, color: "#000000" }}>{typeLabel}类别排行榜</span>
            </div>
            <div className="mx-4" style={{ background: "#FFFFFF", borderRadius: 16, boxShadow: SHADOW_CARD, marginTop: 8 }}>
              {monthCatRanking.length === 0 ? (
                <div className="flex items-center justify-center" style={{ height: 80 }}>
                  <span style={{ fontSize: 17, color: DISABLED }}>没有数据</span>
                </div>
              ) : (
                <div className="flex flex-col" style={{ padding: 16, gap: 12 }}>
                  {monthCatRanking.map((item) => {
                    const IconComp = getIcon(item.icon);
                    const pct = monthMaxCat > 0 ? (item.amount / monthMaxCat) * 100 : 0;
                    return (
                      <div key={item.categoryId} className="flex items-center gap-3">
                        <div className="flex items-center justify-center rounded-full shrink-0" style={{ width: 36, height: 36, background: `${item.color}18` }}>
                          <IconComp style={{ width: 16, height: 16, color: item.color }} />
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center justify-between mb-1">
                            <span className="truncate" style={{ fontSize: 14, fontWeight: 500, color: "#000000" }}>{item.name}</span>
                            <span className="shrink-0 ml-2" style={{ fontSize: 14, fontWeight: 600, color: "#000000" }}>¥{fmtCompact(item.amount)}</span>
                          </div>
                          <div className="rounded-full overflow-hidden" style={{ height: 6, background: "#F2F2F7" }}>
                            <div className="h-full rounded-full" style={{ width: `${pct}%`, background: item.color }} />
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* 明细排行榜 */}
            <div className="mx-4" style={{ marginTop: 12 }}>
              <span style={{ fontSize: 17, fontWeight: 600, color: "#000000" }}>{typeLabel}明细排行榜（前10）</span>
            </div>
            <div className="mx-4" style={{ background: "#FFFFFF", borderRadius: 16, boxShadow: SHADOW_CARD, marginTop: 8, marginBottom: 24 }}>
              {monthDetailRanking.length === 0 ? (
                <div className="flex items-center justify-center" style={{ height: 80 }}>
                  <span style={{ fontSize: 17, color: DISABLED }}>没有数据</span>
                </div>
              ) : (
                <div className="flex flex-col" style={{ padding: 16, gap: 8 }}>
                  {monthDetailRanking.map((tx, idx) => {
                    const cat = tx.categoryId ? categoryMap.get(tx.categoryId) : undefined;
                    const IconComp = getIcon(cat?.icon || "help-circle");
                    const catColor = cat?.color || "#8E8E93";
                    return (
                      <div key={tx.id} className="flex items-center gap-3">
                        <span className="shrink-0 text-center" style={{ width: 20, fontSize: 12, fontWeight: 700, color: DISABLED }}>{idx + 1}</span>
                        <div className="flex items-center justify-center rounded-lg shrink-0" style={{ width: 32, height: 32, background: `${catColor}18` }}>
                          <IconComp style={{ width: 16, height: 16, color: catColor }} />
                        </div>
                        <span className="flex-1 truncate" style={{ fontSize: 14, color: "#000000" }}>{tx.note || cat?.name || "未分类"}</span>
                        <span className="shrink-0" style={{ fontSize: 14, fontWeight: 600, color: amountColor }}>¥{fmtFull(tx.amount)}</span>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </motion.div>
        )}

        {/* ════════════════════════════════════════════════════════════ */}
        {/* 年视图 */}
        {/* ════════════════════════════════════════════════════════════ */}
        {!isMonth && (
          <motion.div
            key="year"
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.25 }}
          >
            {/* 年份选择行 */}
            <div className="flex items-center justify-between" style={{ height: 44, padding: "0 20px" }}>
              <div className="flex items-center gap-1">
                <button type="button" onClick={goPrevYear} className="inline-flex items-center justify-center" style={{ width: 28, height: 28 }} aria-label="上一年">
                  <ChevronLeft className="h-4 w-4" style={{ color: MUTED }} />
                </button>
                <span style={{ fontSize: 17, fontWeight: 600, color: "#000000", whiteSpace: "nowrap" }}>
                  {yearViewYear}年
                </span>
                <button
                  type="button"
                  onClick={goNextYear}
                  disabled={!canGoNextYear}
                  className="inline-flex items-center justify-center"
                  style={{ width: 28, height: 28, opacity: canGoNextYear ? 1 : 0 }}
                  aria-label="下一年"
                >
                  <ChevronRight className="h-4 w-4" style={{ color: MUTED }} />
                </button>
              </div>
              {/* 支出/收入 Pill */}
              <div className="flex rounded-full" style={{ width: 120, height: 32, background: BORDER, padding: 2 }}>
                <button type="button" onClick={() => setTypeTab("expense")}
                  className="flex-1 flex items-center justify-center rounded-full"
                  style={{ background: typeTab === "expense" ? "#FFFFFF" : "transparent" }}>
                  <span style={{ fontSize: 15, fontWeight: typeTab === "expense" ? 600 : 400, color: typeTab === "expense" ? "#000000" : MUTED }}>支出</span>
                </button>
                <button type="button" onClick={() => setTypeTab("income")}
                  className="flex-1 flex items-center justify-center rounded-full"
                  style={{ background: typeTab === "income" ? "#FFFFFF" : "transparent" }}>
                  <span style={{ fontSize: 15, fontWeight: typeTab === "income" ? 600 : 400, color: typeTab === "income" ? "#000000" : MUTED }}>收入</span>
                </button>
              </div>
            </div>

            {/* 收支汇总双卡 */}
            <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.05 }}>
              <div className="flex gap-2 px-5 mt-[20px]">
                <div className="flex-1 h-[90px] rounded-[20px] flex flex-col items-center justify-center"
                  style={{ background: "#FFFFFF", boxShadow: SHADOW_CARD }}>
                  <span className="text-[28px] font-bold leading-none" style={{ color: EXPENSE }}>¥{fmtCompact(yearExpense)}</span>
                  <span className="text-[13px] mt-1.5" style={{ color: MUTED }}>支出</span>
                </div>
                <div className="flex-1 h-[90px] rounded-[20px] flex flex-col items-center justify-center"
                  style={{ background: "#FFFFFF", boxShadow: SHADOW_CARD }}>
                  <span className="text-[28px] font-bold leading-none" style={{ color: INCOME }}>¥{fmtCompact(yearIncome)}</span>
                  <span className="text-[13px] mt-1.5" style={{ color: MUTED }}>收入</span>
                </div>
              </div>
            </motion.div>

            {/* 趋势标题 */}
            <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}>
              <div className="px-5 mt-[32px]">
                <span className="text-[17px] font-semibold" style={{ color: "#000000" }}>{typeLabel}年趋势图</span>
              </div>
            </motion.div>

            {/* 年趋势柱图卡 */}
            <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.15 }}>
              <div className="mx-5 mt-[16px] rounded-[20px] p-5" style={{ background: "#FFFFFF", boxShadow: SHADOW_CARD }}>
                <div className="flex items-baseline gap-2 mb-[28px]">
                  <span className="text-[17px] font-semibold" style={{ color: "#000000" }}>月平均</span>
                  <span className="text-[13px]" style={{ color: MUTED }}>¥{fmtCompact(Math.round(yearMonthlyAvg))}</span>
                </div>

                {/* 纯 CSS 柱图 140px */}
                <div className="relative">
                  {/* 柱条区 */}
                  <div className="flex items-end justify-between gap-1 px-1" style={{ height: 140 }}>
                    {monthlyBuckets.map((val, i) => {
                      const barH = val > 0 ? Math.max(3, Math.round((val / yearMaxBucket) * 140)) : 3;
                      return (
                        <div key={i} className="flex flex-col items-center justify-end flex-1" style={{ height: "100%" }}>
                          <div
                            className="w-full rounded-[3px] transition-all duration-300"
                            style={{
                              maxWidth: 24,
                              height: barH,
                              background: BRAND,
                              opacity: val > 0 ? 1 : 0.3,
                              borderRadius: "3px 3px 0 0",
                            }}
                          />
                        </div>
                      );
                    })}
                  </div>

                  {/* 网格线（absolute，5 条，间距 35px） */}
                  <div className="absolute left-1 right-1 pointer-events-none" style={{ top: 0 }}>
                    {[0, 35, 70, 105, 140].map((top, i) => (
                      <div key={i} className="absolute left-0 right-0" style={{ top, borderTop: "0.5px solid #E5E5EA" }} />
                    ))}
                  </div>

                  {/* X 轴标签 */}
                  <div className="flex justify-between mt-[10px] px-1">
                    {["1月","2月","3月","4月","5月","6月","7月","8月","9月","10月","11月","12月"].map((m, i) => (
                      <span key={i} className="text-[11px] text-center" style={{ color: DISABLED, flex: 1, minWidth: 0 }}>{m}</span>
                    ))}
                  </div>
                </div>
              </div>
            </motion.div>

            {/* 排行标题 */}
            <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }}>
              <div className="px-5 mt-[32px]">
                <span className="text-[17px] font-semibold" style={{ color: "#000000" }}>{typeLabel}排行</span>
              </div>
            </motion.div>

            {/* 排行卡 */}
            <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.25 }}>
              <div className="mx-5 mt-[16px] rounded-[20px]" style={{ background: "#FFFFFF", boxShadow: SHADOW_CARD }}>
                {yearCatRanking.length === 0 ? (
                  <div className="p-6 flex flex-col items-center justify-center py-8">
                    <BarChart3 className="w-12 h-12" style={{ color: DISABLED }} />
                    <p className="text-[15px] mt-3" style={{ color: MUTED }}>暂无排行数据</p>
                    <p className="text-[13px] mt-1.5 text-center leading-relaxed" style={{ color: DISABLED }}>
                      {isExpense ? "开始记账后，将显示支出类别排行" : "开始记账后，将显示收入类别排行"}
                    </p>
                  </div>
                ) : (
                  <div className="flex flex-col p-5" style={{ gap: 16 }}>
                    {yearCatRanking.map((item) => {
                      const pct = yearMaxCat > 0 ? (item.amount / yearMaxCat) * 100 : 0;
                      return (
                        <div key={item.categoryId} className="flex items-center gap-3">
                          <CategoryIcon icon={item.icon} color={item.color} size={36} iconSize={18} />
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center justify-between">
                              <span className="text-[15px] truncate" style={{ color: "#000000" }}>{item.name}</span>
                              <span className="text-[15px] font-semibold shrink-0 ml-2" style={{ color: "#000000" }}>¥{fmtCompact(item.amount)}</span>
                            </div>
                            <div className="mt-1 rounded-full overflow-hidden" style={{ height: 6, background: "#F2F2F7" }}>
                              <div className="h-full rounded-full transition-all duration-500" style={{ width: `${pct}%`, background: item.color }} />
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </motion.div>

            {/* 底部留白 */}
            <div style={{ height: 20 }} />
          </motion.div>
        )}

      </div>
    </div>
  );
}
