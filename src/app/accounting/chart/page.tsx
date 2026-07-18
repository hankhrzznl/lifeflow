"use client";

import { useMemo, useState, useCallback } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useLiveQuery } from "dexie-react-hooks";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { getTransactionsByMonth, getAllCategories } from "@/lib/db/accounting.db";
import type { Transaction, Category } from "@/lib/db/accounting.db";
import { getIcon } from "@/components/accounting/CategoryIcon";
import { showToast } from "@/components/ui/Toast";

// ============================================================
// 设计稿基准: lifeflow-accounting/pages/monthly-bill.html
// 背景 #F2F2F7 / 支出红 #FF3B30 / 收入蓝 #007AFF
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

// ─── 月份拆分 7 段 ───────────────────────────────────────────

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

// ============================================================
// 页面
// ============================================================

export default function ChartPage() {
  const router = useRouter();

  const [currentYear, setCurrentYear] = useState(() => new Date().getFullYear());
  const [currentMonth, setCurrentMonth] = useState(() => new Date().getMonth() + 1);
  const [typeTab, setTypeTab] = useState<"expense" | "income">("expense");
  // chartType 仅记录 UI 切换：实际折线图未就绪，只保留柱状图
  const [chartType, setChartType] = useState<"bar" | "line">("bar");

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

  // ─── 数据（liveQuery） ──────────────────────────────────────

  const txs = useLiveQuery(
    () => getTransactionsByMonth(currentYear, currentMonth),
    [currentYear, currentMonth],
    [] as Transaction[],
  );

  const categories = useLiveQuery(() => getAllCategories(), [], [] as Category[]);

  // ─── 分类映射 ──────────────────────────────────────────────

  const categoryMap = useMemo(() => {
    const m = new Map<string, Category>();
    for (const c of categories) m.set(c.id, c);
    return m;
  }, [categories]);

  // ─── 类型筛选 ──────────────────────────────────────────────

  const filteredTxs = useMemo(
    () => (txs ?? []).filter((t) => t.type === typeTab),
    [txs, typeTab],
  );

  const oppositeTxs = useMemo(
    () => (txs ?? []).filter((t) => t.type === (typeTab === "expense" ? "income" : "expense")),
    [txs, typeTab],
  );

  // ─── 汇总 ──────────────────────────────────────────────────

  const totalAmount = useMemo(
    () => filteredTxs.reduce((s, t) => s + t.amount, 0),
    [filteredTxs],
  );
  const txCount = filteredTxs.length;

  const oppositeTotal = useMemo(
    () => oppositeTxs.reduce((s, t) => s + t.amount, 0),
    [oppositeTxs],
  );

  // 结余 = 收入合计 − 支出合计（全月口径）
  const totalIncome = useMemo(
    () => (txs ?? []).filter((t) => t.type === "income").reduce((s, t) => s + t.amount, 0),
    [txs],
  );
  const totalExpense = useMemo(
    () => (txs ?? []).filter((t) => t.type === "expense").reduce((s, t) => s + t.amount, 0),
    [txs],
  );
  const balance = totalIncome - totalExpense;

  // ─── 趋势分段 ──────────────────────────────────────────────

  const segments = useMemo(
    () => buildSegments(currentYear, currentMonth, txs ?? [], typeTab),
    [currentYear, currentMonth, txs, typeTab],
  );

  const maxSeg = Math.max(...segments.map((s) => s.amount), 0);
  const yMax = niceMax(maxSeg);
  const yLabels = useMemo(() => {
    const step = yMax / 5;
    return [yMax, yMax - step, yMax - step * 2, yMax - step * 3, yMax - step * 4].map((v) =>
      Math.round(v),
    );
  }, [yMax]);

  // 日平均（元）
  const daysInMonth = new Date(currentYear, currentMonth, 0).getDate();
  const dailyAvg = daysInMonth > 0 ? totalAmount / 100 / daysInMonth : 0;

  // ─── 类别排行榜 ────────────────────────────────────────────

  const categoryRanking = useMemo(() => {
    const map: Record<string, number> = {};
    for (const t of filteredTxs) {
      const cid = t.categoryId || "__unknown__";
      map[cid] = (map[cid] || 0) + t.amount;
    }
    return Object.entries(map)
      .map(([cid, amount]) => {
        const cat = cid === "__unknown__" ? null : categoryMap.get(cid);
        return {
          categoryId: cid,
          name: cat?.name || "其他",
          icon: cat?.icon || "help-circle",
          color: cat?.color || "#8E8E93",
          amount,
        };
      })
      .sort((a, b) => b.amount - a.amount);
  }, [filteredTxs, categoryMap]);

  const maxCatAmount = categoryRanking[0]?.amount ?? 1;

  // ─── 明细排行榜 ────────────────────────────────────────────

  const detailRanking = useMemo(() => {
    return [...filteredTxs].sort((a, b) => b.amount - a.amount).slice(0, 10);
  }, [filteredTxs]);

  // ─── 切换处理 ──────────────────────────────────────────────

  const handleYearTab = () => {
    showToast({ type: "info", message: "功能开发中" });
  };

  const handleLineTab = () => {
    showToast({ type: "info", message: "功能开发中" });
  };

  const isExpense = typeTab === "expense";
  const amountColor = isExpense ? EXPENSE : INCOME;
  const typeLabel = isExpense ? "支出" : "收入";
  const otherLabel = isExpense ? "收入" : "支出";
  const opponentCount = oppositeTxs.length;
  const opponentTotalFen = oppositeTotal;

  const isEmpty = filteredTxs.length === 0;

  // ============================================================
  // 渲染
  // ============================================================

  return (
    <div style={{ background: BG, minHeight: "100vh" }}>
      <div className="mx-auto" style={{ maxWidth: 430 }}>

        {/* ===== 1. 顶部导航条 52px ===== */}
        <div
          className="flex items-center relative"
          style={{ height: 52, padding: "0 8px" }}
        >
          {/* 返回 */}
          <Link
            href="/accounting"
            className="inline-flex items-center justify-center"
            style={{ width: 44, height: 44 }}
            aria-label="返回"
          >
            <ChevronLeft className="h-6 w-6" style={{ color: "#000000" }} />
          </Link>

          {/* 月账单 | 年账单 分段控件 160×36 */}
          <div
            className="absolute"
            style={{ left: "50%", top: "50%", transform: "translate(-50%, -50%)" }}
          >
            <div
              className="flex rounded-full"
              style={{
                width: 160,
                height: 36,
                background: BORDER,
                padding: 2,
              }}
            >
              <div
                className="flex-1 flex items-center justify-center rounded-full"
                style={{ background: "#FFFFFF" }}
              >
                <span style={{ fontSize: 15, fontWeight: 600, color: "#000000" }}>
                  月账单
                </span>
              </div>
              <button
                type="button"
                onClick={handleYearTab}
                className="flex-1 flex items-center justify-center rounded-full"
                style={{ background: "transparent" }}
              >
                <span style={{ fontSize: 15, fontWeight: 400, color: MUTED }}>
                  年账单
                </span>
              </button>
            </div>
          </div>
        </div>

        {/* ===== 2. 日期 + 筛选行 44px ===== */}
        <div
          className="flex items-center justify-between"
          style={{ height: 44, padding: "0 20px" }}
        >
          {/* 月份选择器 */}
          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={goPrevMonth}
              className="inline-flex items-center justify-center"
              style={{ width: 28, height: 28 }}
              aria-label="上一月"
            >
              <ChevronLeft className="h-4 w-4" style={{ color: MUTED }} />
            </button>
            <span
              style={{
                fontSize: 17,
                fontWeight: 600,
                color: "#000000",
                whiteSpace: "nowrap",
              }}
            >
              {currentYear}年{String(currentMonth).padStart(2, "0")}月
            </span>
            <button
              type="button"
              onClick={goNextMonth}
              className="inline-flex items-center justify-center"
              style={{ width: 28, height: 28 }}
              aria-label="下一月"
            >
              <ChevronRight className="h-4 w-4" style={{ color: MUTED }} />
            </button>
          </div>

          {/* 支出 | 收入 分段控件 120×32 */}
          <div
            className="flex rounded-full"
            style={{
              width: 120,
              height: 32,
              background: BORDER,
              padding: 2,
            }}
          >
            <button
              type="button"
              onClick={() => setTypeTab("expense")}
              className="flex-1 flex items-center justify-center rounded-full"
              style={{
                background: typeTab === "expense" ? "#FFFFFF" : "transparent",
              }}
            >
              <span
                style={{
                  fontSize: 15,
                  fontWeight: typeTab === "expense" ? 600 : 400,
                  color: typeTab === "expense" ? "#000000" : MUTED,
                }}
              >
                支出
              </span>
            </button>
            <button
              type="button"
              onClick={() => setTypeTab("income")}
              className="flex-1 flex items-center justify-center rounded-full"
              style={{
                background: typeTab === "income" ? "#FFFFFF" : "transparent",
              }}
            >
              <span
                style={{
                  fontSize: 15,
                  fontWeight: typeTab === "income" ? 600 : 400,
                  color: typeTab === "income" ? "#000000" : MUTED,
                }}
              >
                收入
              </span>
            </button>
          </div>
        </div>

        {/* ===== 3. 汇总卡片 140px ===== */}
        <div
          className="mx-4 flex flex-col justify-center"
          style={{
            height: 140,
            background: "#FFFFFF",
            borderRadius: 16,
            boxShadow: SHADOW_CARD,
            padding: 16,
          }}
        >
          <p style={{ fontSize: 15, color: MUTED, margin: "0 0 8px 0" }}>
            共{typeLabel} {txCount} 笔，合计
          </p>
          <p
            style={{
              fontSize: 34,
              fontWeight: 700,
              color: amountColor,
              margin: "0 0 12px 0",
              lineHeight: 1.2,
            }}
          >
            ¥{fmtCompact(totalAmount)}
          </p>
          <p style={{ fontSize: 15, color: MUTED, margin: 0 }}>
            {opponentCount} 笔{otherLabel}{" "}
            <span style={{ color: isExpense ? INCOME : EXPENSE }}>
              ¥{fmtCompact(opponentTotalFen)}
            </span>
            {"  |  结余 ¥"}
            {fmtCompact(balance)}
          </p>
        </div>

        {/* ===== 4. 趋势区标题行 44px ===== */}
        <div
          className="flex items-center justify-between mx-4"
          style={{ height: 44, marginTop: 16 }}
        >
          <span style={{ fontSize: 17, fontWeight: 600, color: "#000000" }}>
            {typeLabel}月趋势图
          </span>

          {/* 柱状图 | 折线图 分段控件 120×28 */}
          <div
            className="flex rounded-full"
            style={{
              width: 120,
              height: 28,
              background: BORDER,
              padding: 2,
            }}
          >
            <div
              className="flex-1 flex items-center justify-center rounded-full"
              style={{
                background: chartType === "bar" ? "#FFFFFF" : "transparent",
              }}
            >
              <span
                style={{
                  fontSize: 13,
                  fontWeight: chartType === "bar" ? 600 : 400,
                  color: chartType === "bar" ? "#000000" : MUTED,
                }}
              >
                柱状图
              </span>
            </div>
            <button
              type="button"
              onClick={handleLineTab}
              className="flex-1 flex items-center justify-center rounded-full"
              style={{ background: "transparent" }}
            >
              <span style={{ fontSize: 13, fontWeight: 400, color: MUTED }}>
                折线图
              </span>
            </button>
          </div>
        </div>

        {/* ===== 5. 图表卡片 280px ===== */}
        <div
          className="mx-4 flex flex-col"
          style={{
            height: 280,
            background: "#FFFFFF",
            borderRadius: 16,
            boxShadow: SHADOW_CARD,
            padding: 16,
          }}
        >
          {/* 日平均 */}
          <p style={{ fontSize: 13, color: MUTED, margin: "0 0 12px 0" }}>
            日平均 ¥{fmtCompact(Math.round(dailyAvg * 100))}
          </p>

          {/* 图表区 */}
          <div className="flex-1 flex flex-col" style={{ position: "relative" }}>
            {/* Grid + Bars 区域 */}
            <div
              className="flex-1 relative"
              style={{ paddingLeft: 36, paddingBottom: 28 }}
            >
              {/* 网格线 */}
              <div
                className="flex flex-col justify-between"
                style={{
                  position: "absolute",
                  left: 36,
                  right: 0,
                  top: 0,
                  bottom: 28,
                  pointerEvents: "none",
                }}
              >
                {[0, 1, 2, 3, 4].map((i) => (
                  <div key={i} style={{ height: 0.5, background: BORDER }} />
                ))}
              </div>

              {/* Y 轴标签 */}
              <div
                className="flex flex-col justify-between"
                style={{
                  position: "absolute",
                  left: 0,
                  right: 0,
                  top: 0,
                  bottom: 28,
                  pointerEvents: "none",
                }}
              >
                {yLabels.map((v, i) => (
                  <div key={i} style={{ textAlign: "right", paddingRight: 4 }}>
                    <span style={{ fontSize: 10, color: DISABLED }}>{v}</span>
                  </div>
                ))}
              </div>

              {/* 柱子 */}
              <div
                className="relative h-full"
                style={{ marginLeft: 4 }}
              >
                <div
                  className="absolute inset-x-0 bottom-0 flex items-end justify-around"
                  style={{ height: "100%" }}
                >
                  {segments.map((seg, i) => {
                    const pct = yMax > 0 ? (seg.amount / yMax) * 100 : 0;
                    const hasData = seg.amount > 0;
                    return (
                      <div
                        key={i}
                        style={{
                          width: 24,
                          height: `${pct}%`,
                          background: amountColor,
                          borderRadius: "4px 4px 0 0",
                          opacity: hasData ? 1 : 0.15,
                        }}
                      />
                    );
                  })}
                </div>
                {/* X 轴底线 */}
                <div
                  className="absolute inset-x-0"
                  style={{
                    bottom: -1,
                    height: 0.5,
                    background: BORDER,
                  }}
                />
              </div>
            </div>

            {/* X 轴标签 */}
            <div
              className="flex justify-around"
              style={{ paddingLeft: 40, height: 28 }}
            >
              {segments.map((seg, i) => (
                <span key={i} style={{ fontSize: 11, color: DISABLED }}>
                  {seg.label}
                </span>
              ))}
            </div>
          </div>
        </div>

        {/* ===== 6. 类别排行榜 ===== */}
        <div className="mx-4" style={{ marginTop: 12 }}>
          <span style={{ fontSize: 17, fontWeight: 600, color: "#000000" }}>
            {typeLabel}类别排行榜
          </span>
        </div>
        <div
          className="mx-4"
          style={{
            background: "#FFFFFF",
            borderRadius: 16,
            boxShadow: SHADOW_CARD,
            marginTop: 8,
          }}
        >
          {categoryRanking.length === 0 ? (
            <div
              className="flex items-center justify-center"
              style={{ height: 80 }}
            >
              <span style={{ fontSize: 17, color: DISABLED }}>没有数据</span>
            </div>
          ) : (
            <div className="flex flex-col" style={{ padding: 16, gap: 12 }}>
              {categoryRanking.map((item) => {
                const IconComp = getIcon(item.icon);
                const pct =
                  maxCatAmount > 0 ? (item.amount / maxCatAmount) * 100 : 0;
                return (
                  <div key={item.categoryId} className="flex items-center gap-3">
                    {/* 图标底 36×36 */}
                    <div
                      className="flex items-center justify-center rounded-full shrink-0"
                      style={{
                        width: 36,
                        height: 36,
                        background: `${item.color}18`,
                      }}
                    >
                      <IconComp
                        style={{ width: 16, height: 16, color: item.color }}
                      />
                    </div>
                    {/* 文字 + 进度条 */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between mb-1">
                        <span
                          className="truncate"
                          style={{
                            fontSize: 14,
                            fontWeight: 500,
                            color: "#000000",
                          }}
                        >
                          {item.name}
                        </span>
                        <span
                          className="shrink-0 ml-2"
                          style={{
                            fontSize: 14,
                            fontWeight: 600,
                            color: "#000000",
                          }}
                        >
                          ¥{fmtCompact(item.amount)}
                        </span>
                      </div>
                      {/* 进度条 */}
                      <div
                        className="rounded-full overflow-hidden"
                        style={{
                          height: 6,
                          background: "#F2F2F7",
                        }}
                      >
                        <div
                          className="h-full rounded-full"
                          style={{
                            width: `${pct}%`,
                            background: item.color,
                          }}
                        />
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* ===== 7. 明细排行榜 ===== */}
        <div className="mx-4" style={{ marginTop: 12 }}>
          <span style={{ fontSize: 17, fontWeight: 600, color: "#000000" }}>
            {typeLabel}明细排行榜（前10）
          </span>
        </div>
        <div
          className="mx-4"
          style={{
            background: "#FFFFFF",
            borderRadius: 16,
            boxShadow: SHADOW_CARD,
            marginTop: 8,
            marginBottom: 24,
          }}
        >
          {detailRanking.length === 0 ? (
            <div
              className="flex items-center justify-center"
              style={{ height: 80 }}
            >
              <span style={{ fontSize: 17, color: DISABLED }}>没有数据</span>
            </div>
          ) : (
            <div className="flex flex-col" style={{ padding: 16, gap: 8 }}>
              {detailRanking.map((tx, idx) => {
                const cat = tx.categoryId
                  ? categoryMap.get(tx.categoryId)
                  : undefined;
                const IconComp = getIcon(cat?.icon || "help-circle");
                const catColor = cat?.color || "#8E8E93";
                const displayName = tx.note || cat?.name || "未分类";
                return (
                  <div key={tx.id} className="flex items-center gap-3">
                    {/* 名次 */}
                    <span
                      className="shrink-0 text-center"
                      style={{
                        width: 20,
                        fontSize: 12,
                        fontWeight: 700,
                        color: DISABLED,
                      }}
                    >
                      {idx + 1}
                    </span>
                    {/* 图标底 32×32 */}
                    <div
                      className="flex items-center justify-center rounded-lg shrink-0"
                      style={{
                        width: 32,
                        height: 32,
                        background: `${catColor}18`,
                      }}
                    >
                      <IconComp
                        style={{ width: 16, height: 16, color: catColor }}
                      />
                    </div>
                    {/* 描述 */}
                    <span
                      className="flex-1 truncate"
                      style={{ fontSize: 14, color: "#000000" }}
                    >
                      {displayName}
                    </span>
                    {/* 金额 */}
                    <span
                      className="shrink-0"
                      style={{
                        fontSize: 14,
                        fontWeight: 600,
                        color: amountColor,
                      }}
                    >
                      ¥{fmtFull(tx.amount)}
                    </span>
                  </div>
                );
              })}
            </div>
          )}
        </div>

      </div>
    </div>
  );
}
