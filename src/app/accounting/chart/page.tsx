"use client";

import { useState, useEffect, useMemo, useCallback } from "react";
import { motion } from "framer-motion";
import Link from "next/link";
import {
  ChevronLeft, ChevronRight, TrendingDown, TrendingUp,
  BarChart3, LineChart, ShoppingBag, Coffee, Home, Car, Gift, Package,
  Leaf, Apple, Candy, Dumbbell, Gamepad2, Smartphone, Shirt, Sparkles,
  Banknote, Trophy, HelpCircle, UtensilsCrossed,
} from "lucide-react";
import {
  BarChart, Bar, LineChart as ReLineChart, Line,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
} from "recharts";
import { accountingDB } from "@/lib/db/accounting.db";
import type { Transaction, Category } from "@/lib/db/accounting.db";
import { useAccountingStore } from "@/lib/store/accountingStore";

// ─── 图标映射 ────────────────────────────────────────────────

const ICON_MAP: Record<string, React.ComponentType<any>> = {
  "utensils-crossed": UtensilsCrossed,
  "shopping-bag": ShoppingBag,
  "package": Package,
  "car": Car,
  "leaf": Leaf,
  "apple": Apple,
  "candy": Candy,
  "dumbbell": Dumbbell,
  "gamepad-2": Gamepad2,
  "smartphone": Smartphone,
  "shirt": Shirt,
  "sparkles": Sparkles,
  "banknote": Banknote,
  "gift": Gift,
  "trending-up": TrendingUp,
  "trophy": Trophy,
  "home": Home,
  "help-circle": HelpCircle,
};

function getIcon(name: string) { return ICON_MAP[name] || HelpCircle; }

const MONTH_NAMES = ["1月", "2月", "3月", "4月", "5月", "6月", "7月", "8月", "9月", "10月", "11月", "12月"];

// ─── 格式化 ──────────────────────────────────────────────────

function fmtYuan(fen: number): string {
  return `￥${(fen / 100).toLocaleString("zh-CN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function fmtYuanShort(fen: number): string {
  return `${(fen / 100).toFixed(2)}`;
}

// ─── 页面主组件 ──────────────────────────────────────────────

export default function ChartPage() {
  const { categories: storeCategories } = useAccountingStore();

  // 视图状态
  const [viewMode, setViewMode] = useState<"month" | "year">("month");
  const [currentYear, setCurrentYear] = useState(() => new Date().getFullYear());
  const [currentMonth, setCurrentMonth] = useState(() => new Date().getMonth() + 1);
  const [typeTab, setTypeTab] = useState<"expense" | "income">("expense");
  const [chartType, setChartType] = useState<"bar" | "line">("bar");

  // 数据
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);

  // ─── 加载数据 ──────────────────────────────────────────────

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const cats = storeCategories.length > 0
        ? storeCategories
        : await accountingDB.categories.toArray();
      setCategories(cats);

      if (viewMode === "month") {
        const prefix = `${currentYear}-${String(currentMonth).padStart(2, "0")}`;
        const txs = await accountingDB.transactions
          .filter((t) => t.date.startsWith(prefix))
          .toArray();
        setTransactions(txs);
      } else {
        const prefix = `${currentYear}-`;
        const txs = await accountingDB.transactions
          .filter((t) => t.date.startsWith(prefix))
          .toArray();
        setTransactions(txs);
      }
    } catch {
      // ignore
    } finally {
      setLoading(false);
    }
  }, [viewMode, currentYear, currentMonth, storeCategories]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // ─── 当月/当年切换重置 ─────────────────────────────────────

  const switchViewMode = (m: "month" | "year") => {
    setViewMode(m);
    const now = new Date();
    setCurrentYear(now.getFullYear());
    setCurrentMonth(now.getMonth() + 1);
  };

  const goPrev = () => {
    if (viewMode === "month") {
      if (currentMonth === 1) {
        setCurrentYear((y) => y - 1);
        setCurrentMonth(12);
      } else {
        setCurrentMonth((m) => m - 1);
      }
    } else {
      setCurrentYear((y) => y - 1);
    }
  };

  const goNext = () => {
    if (viewMode === "month") {
      if (currentMonth === 12) {
        setCurrentYear((y) => y + 1);
        setCurrentMonth(1);
      } else {
        setCurrentMonth((m) => m + 1);
      }
    } else {
      setCurrentYear((y) => y + 1);
    }
  };

  // ─── 按类型筛选 ────────────────────────────────────────────

  const filteredTxs = useMemo(
    () => transactions.filter((t) => t.type === typeTab),
    [transactions, typeTab],
  );

  const oppositeTxs = useMemo(
    () => transactions.filter((t) => t.type === (typeTab === "expense" ? "income" : "expense")),
    [transactions, typeTab],
  );

  const totalAmount = useMemo(
    () => filteredTxs.reduce((s, t) => s + t.amount, 0),
    [filteredTxs],
  );
  const txCount = filteredTxs.length;

  const oppositeTotal = useMemo(
    () => oppositeTxs.reduce((s, t) => s + t.amount, 0),
    [oppositeTxs],
  );
  const balance = typeTab === "expense"
    ? oppositeTotal - totalAmount
    : totalAmount - oppositeTotal;

  // ─── 趋势图数据 ────────────────────────────────────────────

  const chartData = useMemo(() => {
    if (viewMode === "month") {
      const daysInMonth = new Date(currentYear, currentMonth, 0).getDate();
      const dailyMap: Record<string, number> = {};
      for (const t of filteredTxs) {
        const day = t.date.slice(-2);
        dailyMap[day] = (dailyMap[day] || 0) + t.amount;
      }
      const result = [];
      for (let d = 1; d <= daysInMonth; d++) {
        const key = String(d).padStart(2, "0");
        result.push({ label: `${d}日`, amount: (dailyMap[key] || 0) / 100 });
      }
      return result;
    } else {
      const monthlyMap: Record<string, number> = {};
      for (const t of filteredTxs) {
        const m = t.date.slice(5, 7);
        monthlyMap[m] = (monthlyMap[m] || 0) + t.amount;
      }
      const result = [];
      for (let m = 1; m <= 12; m++) {
        const key = String(m).padStart(2, "0");
        result.push({ label: `${m}月`, amount: (monthlyMap[key] || 0) / 100 });
      }
      return result;
    }
  }, [filteredTxs, viewMode, currentYear, currentMonth]);

  const avgAmount = useMemo(() => {
    if (chartData.length === 0) return 0;
    return chartData.reduce((s, d) => s + d.amount, 0) / chartData.length;
  }, [chartData]);

  // ─── 分类排行榜 ────────────────────────────────────────────

  const categoryRanking = useMemo(() => {
    const map: Record<string, number> = {};
    for (const t of filteredTxs) {
      const cid = t.categoryId || "unknown";
      map[cid] = (map[cid] || 0) + t.amount;
    }
    return Object.entries(map)
      .map(([cid, amount]) => {
        const cat = categories.find((c) => c.id === cid);
        return { categoryId: cid, name: cat?.name || "其他", icon: cat?.icon || "help-circle", color: cat?.color || "#8E8E93", amount };
      })
      .sort((a, b) => b.amount - a.amount);
  }, [filteredTxs, categories]);

  const maxCatAmount = categoryRanking[0]?.amount || 1;

  // ─── 明细排行榜 Top 10 ─────────────────────────────────────

  const detailRanking = useMemo(() => {
    return [...filteredTxs]
      .sort((a, b) => b.amount - a.amount)
      .slice(0, 10);
  }, [filteredTxs]);

  const getCategoryInfo = (cid: string | undefined) => {
    return categories.find((c) => c.id === cid);
  };

  // ─── Chart 颜色 ─────────────────────────────────────────────

  const chartColor = typeTab === "expense" ? "#FF3B30" : "#34C759";
  const isExpense = typeTab === "expense";

  // ─── X轴间隔显示 ───────────────────────────────────────────

  const xInterval = viewMode === "month" ? 4 : 0; // 月视图每5天显示一个，年视图全显示

  // ─── 渲染 ──────────────────────────────────────────────────

  return (
    <div className="min-h-screen bg-[#F5F5F7] pb-28">
      <div className="max-w-2xl mx-auto px-5 pt-8">
        {/* ===== 顶部导航 ===== */}
        <div className="flex items-center justify-between mb-5">
          {/* 返回 */}
          <Link href="/accounting" className="w-10 h-10 rounded-full bg-white shadow-sm flex items-center justify-center hover:bg-gray-50 transition-colors">
            <ChevronLeft className="w-5 h-5 text-gray-500" />
          </Link>

          {/* 月账单 / 年账单 */}
          <div className="flex bg-gray-100 rounded-full p-0.5">
            {(["month", "year"] as const).map((m) => (
              <button
                key={m}
                onClick={() => switchViewMode(m)}
                className={`px-5 py-1.5 rounded-full text-sm font-medium transition-all ${
                  viewMode === m ? "bg-white shadow-sm text-gray-900" : "text-gray-500"
                }`}
              >
                {m === "month" ? "月账单" : "年账单"}
              </button>
            ))}
          </div>

          {/* 月份/年份选择器 */}
          <div className="flex items-center gap-1">
            <button
              onClick={goPrev}
              className="w-8 h-8 rounded-full bg-white shadow-sm flex items-center justify-center hover:bg-gray-50"
            >
              <ChevronLeft className="w-4 h-4 text-gray-500" />
            </button>
            <span className="text-sm font-bold text-gray-900 min-w-[90px] text-center">
              {currentYear}年{viewMode === "month" ? `${String(currentMonth).padStart(2, "0")}月` : ""}
            </span>
            <button
              onClick={goNext}
              className="w-8 h-8 rounded-full bg-white shadow-sm flex items-center justify-center hover:bg-gray-50"
            >
              <ChevronRight className="w-4 h-4 text-gray-500" />
            </button>
          </div>
        </div>

        {/* ===== 统计摘要卡片 ===== */}
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-white rounded-2xl shadow-sm p-5 mb-5"
        >
          {/* 支出/收入 Tab */}
          <div className="flex justify-end mb-3">
            <div className="flex bg-gray-100 rounded-full p-0.5">
              <button
                onClick={() => setTypeTab("expense")}
                className={`px-4 py-1 rounded-full text-xs font-medium transition-all ${
                  typeTab === "expense" ? "bg-white shadow-sm text-[#FF3B30]" : "text-gray-500"
                }`}
              >
                支出
              </button>
              <button
                onClick={() => setTypeTab("income")}
                className={`px-4 py-1 rounded-full text-xs font-medium transition-all ${
                  typeTab === "income" ? "bg-white shadow-sm text-[#34C759]" : "text-gray-500"
                }`}
              >
                收入
              </button>
            </div>
          </div>

          {/* 合计金额 */}
          {loading ? (
            <div className="h-24 flex items-center justify-center">
              <div className="w-6 h-6 border-2 border-gray-300 border-t-gray-500 rounded-full animate-spin" />
            </div>
          ) : (
            <>
              <div className="text-center mb-4">
                <div className="text-sm text-gray-500">
                  共{typeTab === "expense" ? "支出" : "收入"} {txCount} 笔，合计
                </div>
                <div
                  className="text-4xl font-extrabold mt-1 tracking-tight"
                  style={{ color: chartColor }}
                >
                  {fmtYuan(totalAmount)}
                </div>
              </div>

              {/* 对方统计 + 结余 */}
              <div className="flex items-center justify-center gap-1 text-xs text-gray-500">
                <span>{oppositeTxs.length} 笔{typeTab === "expense" ? "收入" : "支出"}</span>
                <span className="font-medium text-gray-700">{fmtYuan(oppositeTotal)}</span>
                <span className="mx-1">|</span>
                <span>结余</span>
                <span
                  className="font-medium"
                  style={{ color: balance >= 0 ? "#34C759" : "#FF3B30" }}
                >
                  {fmtYuan(balance)}
                </span>
              </div>
            </>
          )}
        </motion.div>

        {/* ===== 趋势图 ===== */}
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.05 }}
          className="bg-white rounded-2xl shadow-sm p-5 mb-5"
        >
          {/* 标题行 */}
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-semibold text-gray-700">
              {typeTab === "expense" ? "支出" : "收入"}
              {viewMode === "month" ? "月" : "年"}趋势图
            </h3>
            {/* 柱/折线切换 */}
            <div className="flex bg-gray-100 rounded-full p-0.5">
              <button
                onClick={() => setChartType("bar")}
                className={`p-1.5 rounded-full transition-all ${
                  chartType === "bar" ? "bg-white shadow-sm text-gray-900" : "text-gray-400"
                }`}
              >
                <BarChart3 className="w-4 h-4" />
              </button>
              <button
                onClick={() => setChartType("line")}
                className={`p-1.5 rounded-full transition-all ${
                  chartType === "line" ? "bg-white shadow-sm text-gray-900" : "text-gray-400"
                }`}
              >
                <LineChart className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* 日均/月均 */}
          {chartData.length > 0 && chartData.some((d) => d.amount > 0) ? (
            <div className="text-xs text-gray-500 mb-3">
              {viewMode === "month" ? "日" : "月"}平均 {fmtYuanShort(avgAmount * 100)}
            </div>
          ) : null}

          {/* 图表 */}
          {chartData.length === 0 || chartData.every((d) => d.amount === 0) ? (
            <div className="h-48 flex items-center justify-center text-sm text-gray-400">
              没有数据
            </div>
          ) : (
            <div className="h-52">
              <ResponsiveContainer width="100%" height="100%">
                {chartType === "bar" ? (
                  <BarChart data={chartData} margin={{ top: 5, right: 5, left: -20, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#F2F2F7" />
                    <XAxis
                      dataKey="label"
                      tick={{ fontSize: 11, fill: "#8E8E93" }}
                      interval={xInterval}
                      axisLine={false}
                      tickLine={false}
                    />
                    <YAxis
                      tick={{ fontSize: 11, fill: "#8E8E93" }}
                      axisLine={false}
                      tickLine={false}
                      width={45}
                    />
                    <Tooltip
                      formatter={(val) => [`￥${Number(val).toFixed(2)}`, typeTab === "expense" ? "支出" : "收入"]}
                      contentStyle={{ borderRadius: 10, border: "none", boxShadow: "0 2px 12px rgba(0,0,0,0.1)", fontSize: 12 }}
                    />
                    <Bar dataKey="amount" fill={chartColor} radius={[4, 4, 0, 0]} maxBarSize={24} />
                  </BarChart>
                ) : (
                  <ReLineChart data={chartData} margin={{ top: 5, right: 5, left: -20, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#F2F2F7" />
                    <XAxis
                      dataKey="label"
                      tick={{ fontSize: 11, fill: "#8E8E93" }}
                      interval={xInterval}
                      axisLine={false}
                      tickLine={false}
                    />
                    <YAxis
                      tick={{ fontSize: 11, fill: "#8E8E93" }}
                      axisLine={false}
                      tickLine={false}
                      width={45}
                    />
                    <Tooltip
                      formatter={(val) => [`￥${Number(val).toFixed(2)}`, typeTab === "expense" ? "支出" : "收入"]}
                      contentStyle={{ borderRadius: 10, border: "none", boxShadow: "0 2px 12px rgba(0,0,0,0.1)", fontSize: 12 }}
                    />
                    <Line
                      type="monotone"
                      dataKey="amount"
                      stroke={chartColor}
                      strokeWidth={2}
                      dot={{ fill: chartColor, r: 3, strokeWidth: 0 }}
                      activeDot={{ r: 5 }}
                    />
                  </ReLineChart>
                )}
              </ResponsiveContainer>
            </div>
          )}
        </motion.div>

        {/* ===== 类别排行榜 ===== */}
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="bg-white rounded-2xl shadow-sm p-5 mb-5"
        >
          <h3 className="text-sm font-semibold text-gray-700 mb-4">
            {typeTab === "expense" ? "支出" : "收入"}类别排行榜
          </h3>

          {categoryRanking.length === 0 ? (
            <div className="py-8 text-center text-sm text-gray-400">没有数据</div>
          ) : (
            <div className="space-y-3">
              {categoryRanking.map((item) => {
                const IconComp = getIcon(item.icon);
                const pct = maxCatAmount > 0 ? (item.amount / maxCatAmount) * 100 : 0;
                return (
                  <div key={item.categoryId} className="flex items-center gap-3">
                    <div
                      className="w-9 h-9 rounded-full flex items-center justify-center flex-shrink-0"
                      style={{ backgroundColor: `${item.color}18` }}
                    >
                      <IconComp className="w-4 h-4" style={{ color: item.color }} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-sm font-medium text-gray-900">{item.name}</span>
                        <span className="text-sm font-semibold text-gray-900">{fmtYuan(item.amount)}</span>
                      </div>
                      <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
                        <div
                          className="h-full rounded-full transition-all duration-500"
                          style={{ width: `${pct}%`, backgroundColor: item.color }}
                        />
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </motion.div>

        {/* ===== 明细排行榜 Top 10 ===== */}
        {typeTab === "expense" && (
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.15 }}
            className="bg-white rounded-2xl shadow-sm p-5"
          >
            <h3 className="text-sm font-semibold text-gray-700 mb-4">
              支出明细排行榜（前10）
            </h3>

            {detailRanking.length === 0 ? (
              <div className="py-8 text-center text-sm text-gray-400">没有数据</div>
            ) : (
              <div className="space-y-2">
                {detailRanking.map((tx, idx) => {
                  const cat = getCategoryInfo(tx.categoryId);
                  const IconComp = getIcon(cat?.icon || "help-circle");
                  const catColor = cat?.color || "#8E8E93";
                  return (
                    <div key={tx.id} className="flex items-center gap-3 py-1.5">
                      <span className="text-xs font-bold text-gray-400 w-5 flex-shrink-0">
                        {idx + 1}
                      </span>
                      <div
                        className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0"
                        style={{ backgroundColor: `${catColor}18` }}
                      >
                        <IconComp className="w-4 h-4" style={{ color: catColor }} />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="text-sm text-gray-900 truncate">
                          {tx.note || cat?.name || "未分类"}
                        </div>
                      </div>
                      <span className="text-sm font-semibold text-[#FF3B30] flex-shrink-0">
                        {fmtYuan(tx.amount)}
                      </span>
                    </div>
                  );
                })}
              </div>
            )}
          </motion.div>
        )}
      </div>
    </div>
  );
}
