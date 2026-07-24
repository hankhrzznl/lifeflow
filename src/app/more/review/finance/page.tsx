"use client";

import { useEffect, useState, useMemo } from "react";
import { useRouter } from "next/navigation";
import { ChevronLeft, Wallet, TrendingUp, TrendingDown, ArrowUpDown, Receipt } from "lucide-react";
import { motion } from "framer-motion";
import { reviewerBrain } from "@/lib/brains/reviewer";
import type { ReviewModuleSummary, DateRange } from "@/lib/brains/reviewer";
import { accountingDB } from "@/lib/db/accounting.db";
import type { Transaction, Category } from "@/lib/db/accounting.db";

// ─── Date helpers ─────────────────────────────────────────────

function getWeekRange(): DateRange {
  const now = new Date();
  const day = now.getDay();
  const diff = day === 0 ? 6 : day - 1;
  const mon = new Date(now);
  mon.setDate(now.getDate() - diff);
  const sun = new Date(mon);
  sun.setDate(mon.getDate() + 6);
  return {
    start: fmtDate(mon),
    end: fmtDate(sun),
  };
}

function fmtDate(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function formatWeekdayLabel(dateStr: string): string {
  const d = new Date(dateStr + "T00:00:00");
  const days = ["周日", "周一", "周二", "周三", "周四", "周五", "周六"];
  return days[d.getDay()];
}

function formatShortDate(dateStr: string): string {
  const [, month, day] = dateStr.split("-");
  return `${parseInt(month)}/${parseInt(day)}`;
}

/** Generate all dates in a range (inclusive) */
function dateRangeDays(start: string, end: string): string[] {
  const days: string[] = [];
  const cur = new Date(start + "T00:00:00");
  const last = new Date(end + "T00:00:00");
  while (cur <= last) {
    days.push(fmtDate(cur));
    cur.setDate(cur.getDate() + 1);
  }
  return days;
}

// ─── Animation variants ──────────────────────────────────────

const containerVariants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: { staggerChildren: 0.06 },
  },
};

const cardVariants = {
  hidden: { opacity: 0, scale: 0.95 },
  visible: { opacity: 1, scale: 1 },
};

const itemVariants = {
  hidden: { opacity: 0, y: 12 },
  visible: { opacity: 1, y: 0 },
};

// ─── Types ────────────────────────────────────────────────────

interface DailyData {
  date: string;
  income: number;
  expense: number;
}

interface CatRank {
  name: string;
  amount: number;
  color: string;
  icon: string;
}

// ─── Page component ───────────────────────────────────────────

export default function FinanceReviewPage() {
  const router = useRouter();
  const [summary, setSummary] = useState<ReviewModuleSummary | null>(null);
  const [dailyData, setDailyData] = useState<DailyData[]>([]);
  const [catRanks, setCatRanks] = useState<CatRank[]>([]);
  const [loading, setLoading] = useState(true);

  const dateRange = useMemo(() => getWeekRange(), []);

  useEffect(() => {
    async function load() {
      try {
        // Fetch summary from reviewerBrain
        const s = await reviewerBrain.reviewFinance(dateRange);
        setSummary(s);

        // Fetch raw transactions for chart & categories
        const txns = await accountingDB.transactions
          .where("date")
          .between(dateRange.start, dateRange.end, true, true)
          .toArray();

        // --- Daily aggregation ---
        const allDays = dateRangeDays(dateRange.start, dateRange.end);
        const dayMap: Record<string, { income: number; expense: number }> = {};
        for (const d of allDays) {
          dayMap[d] = { income: 0, expense: 0 };
        }
        for (const t of txns) {
          if (!dayMap[t.date]) continue;
          if (t.type === "income") dayMap[t.date].income += t.amount;
          else dayMap[t.date].expense += t.amount;
        }
        const dData: DailyData[] = allDays.map((d) => ({
          date: d,
          income: dayMap[d].income,
          expense: dayMap[d].expense,
        }));
        setDailyData(dData);

        // --- Category ranking (expense only) ---
        const catMap: Record<string, { amount: number }> = {};
        const expenseTxns = txns.filter((t: Transaction) => t.type === "expense" && t.categoryId);
        for (const t of expenseTxns) {
          const cid = t.categoryId!;
          if (!catMap[cid]) catMap[cid] = { amount: 0 };
          catMap[cid].amount += t.amount;
        }

        const allCats = await accountingDB.categories.toArray();
        const catIndex: Record<string, Category> = {};
        for (const c of allCats) catIndex[c.id] = c;

        const sorted: CatRank[] = Object.entries(catMap)
          .map(([cid, v]) => {
            const cat = catIndex[cid];
            return {
              name: cat?.name || "其他",
              amount: v.amount,
              color: cat?.color || "#8E8E93",
              icon: cat?.icon || "help-circle",
            };
          })
          .sort((a, b) => b.amount - a.amount);
        setCatRanks(sorted);
      } catch {
        // silently fail
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [dateRange]);

  // Chart max for scaling
  const maxDailyExpense = useMemo(() => {
    return Math.max(1, ...dailyData.map((d) => d.expense));
  }, [dailyData]);

  // Category total for percentages
  const totalExpense = useMemo(() => {
    return catRanks.reduce((s, c) => s + c.amount, 0);
  }, [catRanks]);

  const hasData = summary && Object.keys(summary.stats).length > 0;

  return (
    <div className="min-h-screen max-w-[430px] mx-auto px-4 pt-6 pb-[100px]">
      {/* Header */}
      <header className="flex items-center gap-3 mb-6">
        <button
          onClick={() => router.push("/more/review")}
          className="inline-flex items-center justify-center w-9 h-9 rounded-lg"
          style={{ background: "var(--lifeflow-muted)" }}
          aria-label="返回"
        >
          <ChevronLeft className="w-5 h-5" style={{ color: "var(--lifeflow-foreground)" }} />
        </button>
        <div className="flex items-center gap-2">
          <Wallet className="w-6 h-6" style={{ color: "#10B981" }} />
          <h1 className="text-[17px] font-semibold" style={{ color: "var(--lifeflow-foreground)" }}>
            记账复盘
          </h1>
        </div>
      </header>

      {loading ? (
        <div className="space-y-3">
          {[1, 2, 3].map((i) => (
            <div
              key={i}
              className="h-24 rounded-[20px] animate-pulse"
              style={{ background: "var(--lifeflow-muted)" }}
            />
          ))}
        </div>
      ) : (
        <>
          {/* ─── Overview Cards ─────────────────────────── */}
          {hasData && (
            <motion.div
              variants={containerVariants}
              initial="hidden"
              animate="visible"
              className="grid grid-cols-2 gap-3 mb-6"
            >
              {/* 收入 */}
              <motion.div
                variants={cardVariants}
                className="rounded-[20px] p-4"
                style={{ background: "var(--color-surface-card)", boxShadow: "var(--shadow-card)" }}
              >
                <div className="flex items-center gap-2 mb-2">
                  <div
                    className="w-8 h-8 rounded-full flex items-center justify-center"
                    style={{ background: "#34C75915" }}
                  >
                    <TrendingUp className="w-4 h-4" style={{ color: "#34C759" }} />
                  </div>
                  <span className="text-[12px]" style={{ color: "var(--color-text-secondary)" }}>
                    收入
                  </span>
                </div>
                <p className="text-[28px] font-bold" style={{ color: "#34C759" }}>
                  {summary.stats["收入"] ?? "--"}
                </p>
              </motion.div>

              {/* 支出 */}
              <motion.div
                variants={cardVariants}
                className="rounded-[20px] p-4"
                style={{ background: "var(--color-surface-card)", boxShadow: "var(--shadow-card)" }}
              >
                <div className="flex items-center gap-2 mb-2">
                  <div
                    className="w-8 h-8 rounded-full flex items-center justify-center"
                    style={{ background: "#FF3B3015" }}
                  >
                    <TrendingDown className="w-4 h-4" style={{ color: "#FF3B30" }} />
                  </div>
                  <span className="text-[12px]" style={{ color: "var(--color-text-secondary)" }}>
                    支出
                  </span>
                </div>
                <p className="text-[28px] font-bold" style={{ color: "#FF3B30" }}>
                  {summary.stats["支出"] ?? "--"}
                </p>
              </motion.div>

              {/* 结余 */}
              <motion.div
                variants={cardVariants}
                className="rounded-[20px] p-4"
                style={{ background: "var(--color-surface-card)", boxShadow: "var(--shadow-card)" }}
              >
                <div className="flex items-center gap-2 mb-2">
                  <div
                    className="w-8 h-8 rounded-full flex items-center justify-center"
                    style={{ background: "#007AFF15" }}
                  >
                    <ArrowUpDown className="w-4 h-4" style={{ color: "#007AFF" }} />
                  </div>
                  <span className="text-[12px]" style={{ color: "var(--color-text-secondary)" }}>
                    结余
                  </span>
                </div>
                <p className="text-[28px] font-bold" style={{ color: "var(--color-text-primary)" }}>
                  {summary.stats["结余"] ?? "--"}
                </p>
              </motion.div>

              {/* 交易笔数 */}
              <motion.div
                variants={cardVariants}
                className="rounded-[20px] p-4"
                style={{ background: "var(--color-surface-card)", boxShadow: "var(--shadow-card)" }}
              >
                <div className="flex items-center gap-2 mb-2">
                  <div
                    className="w-8 h-8 rounded-full flex items-center justify-center"
                    style={{ background: "#FF950015" }}
                  >
                    <Receipt className="w-4 h-4" style={{ color: "#FF9500" }} />
                  </div>
                  <span className="text-[12px]" style={{ color: "var(--color-text-secondary)" }}>
                    交易笔数
                  </span>
                </div>
                <p className="text-[28px] font-bold" style={{ color: "var(--color-text-primary)" }}>
                  {summary.stats["交易笔数"] ?? "--"}
                </p>
              </motion.div>
            </motion.div>
          )}

          {/* ─── Daily Expense Chart ────────────────────── */}
          {dailyData.length > 0 && (
            <motion.div
              variants={containerVariants}
              initial="hidden"
              animate="visible"
              className="mb-6"
            >
              <h2
                className="text-[13px] font-semibold uppercase tracking-wider mb-3"
                style={{ color: "var(--color-text-disabled)" }}
              >
                本周每日支出
              </h2>
              <motion.div
                variants={cardVariants}
                className="rounded-[20px] p-4"
                style={{ background: "var(--color-surface-card)", boxShadow: "var(--shadow-card)" }}
              >
                <div className="flex items-end justify-between gap-1" style={{ height: 140 }}>
                  {dailyData.map((d) => {
                    const heightPct = maxDailyExpense > 0 ? (d.expense / maxDailyExpense) * 100 : 0;
                    const isToday =
                      d.date === fmtDate(new Date());
                    return (
                      <div key={d.date} className="flex-1 flex flex-col items-center gap-1.5 h-full justify-end">
                        <span
                          className="text-[10px] font-semibold"
                          style={{ color: isToday ? "#FF3B30" : "var(--color-text-secondary)" }}
                        >
                          {d.expense > 0 ? `¥${d.expense.toFixed(0)}` : ""}
                        </span>
                        <div
                          className="w-full rounded-t-md transition-all duration-500 ease-out"
                          style={{
                            height: `${Math.max(heightPct, 2)}%`,
                            background: isToday
                              ? "linear-gradient(180deg, #FF3B30 0%, #FF3B3033 100%)"
                              : "linear-gradient(180deg, #10B981 0%, #10B98133 100%)",
                            minHeight: d.expense > 0 ? 4 : 0,
                          }}
                        />
                        <span
                          className="text-[10px]"
                          style={{ color: isToday ? "#FF3B30" : "var(--color-text-disabled)" }}
                        >
                          {formatShortDate(d.date)}
                        </span>
                      </div>
                    );
                  })}
                </div>
                {/* Legend */}
                <div className="flex items-center justify-center gap-4 mt-3 pt-3 border-t" style={{ borderColor: "var(--lifeflow-border)" }}>
                  <div className="flex items-center gap-1.5">
                    <div className="w-3 h-3 rounded-sm" style={{ background: "#10B981" }} />
                    <span className="text-[11px]" style={{ color: "var(--color-text-disabled)" }}>
                      支出
                    </span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <div className="w-3 h-3 rounded-sm" style={{ background: "#FF3B30" }} />
                    <span className="text-[11px]" style={{ color: "var(--color-text-disabled)" }}>
                      今日
                    </span>
                  </div>
                </div>
              </motion.div>
            </motion.div>
          )}

          {/* ─── Category Ranking ──────────────────────── */}
          {catRanks.length > 0 && (
            <motion.div
              variants={containerVariants}
              initial="hidden"
              animate="visible"
              className="mb-6"
            >
              <h2
                className="text-[13px] font-semibold uppercase tracking-wider mb-3"
                style={{ color: "var(--color-text-disabled)" }}
              >
                支出分类排行
              </h2>
              <motion.div
                variants={cardVariants}
                className="rounded-[20px] p-4 flex flex-col gap-3"
                style={{ background: "var(--color-surface-card)", boxShadow: "var(--shadow-card)" }}
              >
                {catRanks.map((cat, idx) => {
                  const pct = totalExpense > 0 ? (cat.amount / totalExpense) * 100 : 0;
                  return (
                    <motion.div key={cat.name} variants={itemVariants} className="flex flex-col gap-1.5">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <span
                            className="text-[11px] font-bold w-5 text-center"
                            style={{ color: idx === 0 ? "#FF9500" : "var(--color-text-disabled)" }}
                          >
                            {idx + 1}
                          </span>
                          <div
                            className="w-6 h-6 rounded-lg flex items-center justify-center"
                            style={{ background: `${cat.color}18` }}
                          >
                            <span className="text-[11px]" style={{ color: cat.color }}>
                              {cat.icon ? cat.icon.slice(0, 2) : "?"}
                            </span>
                          </div>
                          <span className="text-[13px] font-medium" style={{ color: "var(--color-text-primary)" }}>
                            {cat.name}
                          </span>
                        </div>
                        <span className="text-[13px] font-semibold" style={{ color: "var(--color-text-primary)" }}>
                          ¥{cat.amount.toFixed(0)}
                        </span>
                      </div>
                      {/* Progress bar */}
                      <div className="flex items-center gap-2 pl-12">
                        <div
                          className="flex-1 h-1.5 rounded-full overflow-hidden"
                          style={{ background: "var(--lifeflow-muted)" }}
                        >
                          <div
                            className="h-full rounded-full transition-all duration-700 ease-out"
                            style={{
                              width: `${Math.min(pct, 100)}%`,
                              background: cat.color,
                            }}
                          />
                        </div>
                        <span className="text-[10px] w-9 text-right" style={{ color: "var(--color-text-disabled)" }}>
                          {pct.toFixed(0)}%
                        </span>
                      </div>
                    </motion.div>
                  );
                })}
              </motion.div>
            </motion.div>
          )}

          {/* ─── Empty state ────────────────────────────── */}
          {!hasData && !loading && (
            <div
              className="rounded-[20px] p-8 text-center"
              style={{ background: "var(--color-surface-card)", boxShadow: "var(--shadow-card)" }}
            >
              <div
                className="w-16 h-16 rounded-2xl flex items-center justify-center mx-auto mb-4"
                style={{ background: "#10B98115" }}
              >
                <Wallet className="w-8 h-8" style={{ color: "#10B981" }} />
              </div>
              <p className="text-[15px] font-semibold mb-2" style={{ color: "var(--color-text-primary)" }}>
                暂无记账数据
              </p>
              <p className="text-[13px]" style={{ color: "var(--color-text-secondary)" }}>
                本周还没有记账记录。开始记录收支后，这里会展示详细的复盘分析。
              </p>
            </div>
          )}
        </>
      )}
    </div>
  );
}
