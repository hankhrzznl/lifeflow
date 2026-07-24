"use client";

import { useMemo, useState, useCallback } from "react";
import Link from "next/link";
import { motion, AnimatePresence } from "framer-motion";
import { useLiveQuery } from "dexie-react-hooks";
import { Plus, ChevronDown, Trash2, Wallet, Search, ChevronLeft, ChevronRight } from "lucide-react";
import { getTransactionsByMonth, getTransactionsByYear, getTransactionsByDate, deleteTransaction, getAllCategories, addTransaction, accountingDB, ensureDefaultLedger } from "@/lib/db/accounting.db";
import type { Transaction, Category, Ledger, Account } from "@/lib/db/accounting.db";
import { getIcon } from "@/components/accounting/CategoryIcon";
import { showToast } from "@/components/ui/Toast";

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
function fmtFull(fen: number): string {
  return (fen / 100).toLocaleString("zh-CN", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
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
// 主页面
// ============================================================
export default function AccountingPage() {
  // ─── Tab 状态 ──────────────────────────────────────────────
  const [mainTab, setActiveMainTab] = useState<"detail" | "chart">("detail");

  // ─── 明细页状态 ────────────────────────────────────────────
  const [monthOffset, setMonthOffset] = useState(0);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [monthPanelOpen, setMonthPanelOpen] = useState(false);
  const [keyword, setKeyword] = useState("");

  // ─── 图表页状态 ────────────────────────────────────────────
  const [chartPeriod, setChartPeriod] = useState<"month" | "year">("month");
  const [chartYear, setChartYear] = useState(() => new Date().getFullYear());
  const [chartMonth, setChartMonth] = useState(() => new Date().getMonth() + 1);
  const [yearViewYear, setYearViewYear] = useState(() => new Date().getFullYear());

  // ─── 记一笔 BottomSheet 状态 ──────────────────────────────
  const [showRecordSheet, setShowRecordSheet] = useState(false);
  const [recordType, setRecordType] = useState<"expense" | "income">("expense");
  const [recordAmount, setRecordAmount] = useState("");
  const [recordNote, setRecordNote] = useState("");
  const [selectedAccountId, setSelectedAccountId] = useState<string | null>(null);

  // ─── 日期计算 ──────────────────────────────────────────────
  const { year, month } = useMemo(() => {
    const d = new Date();
    d.setMonth(d.getMonth() + monthOffset);
    return { year: d.getFullYear(), month: d.getMonth() + 1 };
  }, [monthOffset]);

  const nowYear = new Date().getFullYear();
  const nowMonth = new Date().getMonth() + 1;

  // ─── DB 数据查询 ──────────────────────────────────────────
  const txs = useLiveQuery(
    () => getTransactionsByMonth(year, month),
    [year, month],
    [] as Transaction[],
  );
  const categories = useLiveQuery(() => getAllCategories(), [], [] as Category[]);
  const ledgers = useLiveQuery(() => accountingDB.ledgers.toArray(), [], [] as Ledger[]);
  const accounts = useLiveQuery(() => accountingDB.accounts.toArray(), [], [] as Account[]);

  // 图表数据
  const monthTxs = useLiveQuery(
    () => getTransactionsByMonth(chartYear, chartMonth),
    [chartYear, chartMonth],
    [] as Transaction[],
  );
  const yearTxs = useLiveQuery(
    () => getTransactionsByYear(yearViewYear),
    [yearViewYear],
    [] as Transaction[],
  );

  // 近 7 日（不跨天缓存）
  const last7Days = useMemo(() => {
    const days: string[] = [];
    for (let i = 6; i >= 0; i--) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      days.push(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`);
    }
    return days;
  }, []);
  const weekTxs = useLiveQuery(
    () => Promise.all(last7Days.map((d) => getTransactionsByDate(d))),
    [last7Days.join(",")],
    [] as Transaction[][],
  );

  // ─── 分类映射 ──────────────────────────────────────────────
  const categoryMap = useMemo(() => {
    const map = new Map<string, Category>();
    for (const c of categories ?? []) map.set(c.id, c);
    return map;
  }, [categories]);

  // ─── 明细计算 ──────────────────────────────────────────────
  const { monthExpense, monthIncome } = useMemo(() => {
    let expense = 0, income = 0;
    for (const t of txs ?? []) { if (t.type === "expense") expense += t.amount; else income += t.amount; }
    return { monthExpense: expense, monthIncome: income };
  }, [txs]);

  const topExpenseCats = useMemo(() => {
    const expenseTxs = (txs ?? []).filter((t) => t.type === "expense");
    const map = new Map<string, number>();
    for (const t of expenseTxs) {
      const key = t.categoryId || "__none__";
      map.set(key, (map.get(key) || 0) + t.amount);
    }
    return Array.from(map.entries())
      .sort(([, a], [, b]) => b - a)
      .slice(0, 3)
      .map(([cid, sum]) => ({ categoryId: cid, sum, cat: cid === "__none__" ? undefined : categoryMap.get(cid) }));
  }, [txs, categoryMap]);

  const todayStats = useMemo(() => {
    const today = todayStr();
    const todayTxs = (txs ?? []).filter((t) => t.date === today);
    const count = todayTxs.length;
    const expense = todayTxs.filter((t) => t.type === "expense").reduce((s, t) => s + t.amount, 0);
    return { count, expense };
  }, [txs]);

  const isEmpty = (txs ?? []).length === 0;

  // ─── 搜索过滤 ──────────────────────────────────────────────
  const kw = keyword.trim().toLowerCase();

  const filteredTxs = useMemo(() => {
    if (!kw) return txs;
    const numKw = Number(kw);
    return (txs ?? []).filter((t) => {
      if (t.note?.toLowerCase().includes(kw)) return true;
      const cat = t.categoryId ? categoryMap.get(t.categoryId) : undefined;
      if (cat?.name.toLowerCase().includes(kw)) return true;
      if (!isNaN(numKw)) {
        if (Math.round(t.amount / 100) === Math.round(numKw)) return true;
        const yuanStr = (t.amount / 100).toFixed(2);
        if (yuanStr.startsWith(kw)) return true;
      }
      return false;
    });
  }, [txs, kw, categoryMap]);

  // ─── 明细分组 ──────────────────────────────────────────────
  const groups = useMemo(() => {
    const sorted = [...(filteredTxs ?? [])].sort((a, b) =>
      a.date === b.date ? b.createdAt - a.createdAt : a.date < b.date ? 1 : -1,
    );
    const out: { date: string; label: string; isToday: boolean; items: Transaction[] }[] = [];
    const today = todayStr();
    for (const t of sorted) {
      let g = out.find((x) => x.date === t.date);
      if (!g) {
        const d = new Date(t.date + "T00:00:00");
        const weeks = ["日", "一", "二", "三", "四", "五", "六"];
        const isToday = t.date === today;
        g = { date: t.date, label: `${d.getMonth() + 1}月${d.getDate()}日 周${weeks[d.getDay()]}`, isToday, items: [] };
        out.push(g);
      }
      g.items.push(t);
    }
    return out;
  }, [filteredTxs]);

  // ─── 月选项 ──────────────────────────────────────────────
  const monthOptions = useMemo(() => {
    const now = new Date();
    const options: { year: number; month: number }[] = [];
    for (let i = 0; i < 12; i++) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      options.push({ year: d.getFullYear(), month: d.getMonth() + 1 });
    }
    return options;
  }, []);

  // ─── 删除 ──────────────────────────────────────────────
  const handleDelete = useCallback(async (id: string) => {
    if (confirmDeleteId !== id) {
      setConfirmDeleteId(id);
      setTimeout(() => setConfirmDeleteId((p) => (p === id ? null : p)), 2500);
      return;
    }
    await deleteTransaction(id);
    setConfirmDeleteId(null);
    showToast({ type: "success", message: "已删除" });
  }, [confirmDeleteId]);

  // ─── 图表 ─── 月/年切换 ──────────────────────────────────
  const handleChartPeriodChange = useCallback((mode: "month" | "year") => {
    if (mode === "year" && chartPeriod === "month") {
      setYearViewYear(new Date().getFullYear());
    } else if (mode === "month" && chartPeriod === "year") {
      setChartYear(new Date().getFullYear());
      setChartMonth(new Date().getMonth() + 1);
    }
    setChartPeriod(mode);
  }, [chartPeriod]);

  const goPrevMonth = () => {
    if (chartMonth === 1) { setChartYear((y) => y - 1); setChartMonth(12); }
    else setChartMonth((m) => m - 1);
  };
  const goNextMonth = () => {
    if (chartMonth === 12) { setChartYear((y) => y + 1); setChartMonth(1); }
    else setChartMonth((m) => m + 1);
  };
  const goPrevYear = () => setYearViewYear((y) => y - 1);
  const goNextYear = () => { if (yearViewYear < nowYear) setYearViewYear((y) => y + 1); };

  // ─── 图表 ─── 月视图计算 ──────────────────────────────────
  const chartMonthExpense = useMemo(
    () => (monthTxs ?? []).filter((t) => t.type === "expense").reduce((s, t) => s + t.amount, 0),
    [monthTxs],
  );
  const chartMonthIncome = useMemo(
    () => (monthTxs ?? []).filter((t) => t.type === "income").reduce((s, t) => s + t.amount, 0),
    [monthTxs],
  );

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

  // ─── 图表 ─── 年视图计算 ──────────────────────────────────
  const chartYearExpense = useMemo(
    () => (yearTxs ?? []).filter((t) => t.type === "expense").reduce((s, t) => s + t.amount, 0),
    [yearTxs],
  );
  const chartYearIncome = useMemo(
    () => (yearTxs ?? []).filter((t) => t.type === "income").reduce((s, t) => s + t.amount, 0),
    [yearTxs],
  );

  const monthlyBuckets = useMemo(
    () => buildMonthlyBuckets(yearViewYear, yearTxs ?? []),
    [yearViewYear, yearTxs],
  );
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

  // ─── 图表 ─── 周趋势 ──────────────────────────────────────
  const weekExpenses = useMemo(() => {
    return (weekTxs ?? []).map((txs) => txs.filter((t) => t.type === "expense").reduce((s, t) => s + t.amount, 0));
  }, [weekTxs]);
  const weekMax = Math.max(...weekExpenses, 0);
  const dayNames = ["日", "一", "二", "三", "四", "五", "六"];
  const todayDayIndex = new Date().getDay();

  // 切换记录类型
  const handleRecordTypeChange = (t: "expense" | "income") => {
    setRecordType(t);
  };

  // ─── 记一笔 ─── 保存 ──────────────────────────────────────
  const handleSaveRecord = useCallback(async () => {
    const amountFen = Math.round(parseFloat(recordAmount) * 100);
    if (isNaN(amountFen) || amountFen <= 0) {
      showToast({ type: "warning", message: "请输入有效金额" });
      return;
    }
    if (!selectedAccountId) {
      showToast({ type: "warning", message: "请选择账户" });
      return;
    }
    try {
      // 自愈：确保默认账本存在
      const ledgerId = await ensureDefaultLedger();
      await addTransaction({
        ledgerId,
        accountId: selectedAccountId,
        type: recordType,
        amount: amountFen,
        date: todayStr(),
        note: recordNote.trim() || undefined,
      });
      showToast({ type: "success", message: "已保存" });
      setShowRecordSheet(false);
      setRecordAmount("");
      setRecordNote("");
      setSelectedAccountId(null);
    } catch {
      showToast({ type: "error", message: "保存失败" });
    }
  }, [recordAmount, selectedAccountId, recordType, recordNote]);

  // ============================================================
  // 渲染
  // ============================================================
  return (
    <div className="pb-[100px]" style={{ background: "var(--lifeflow-background)" }}>
      {/* ===== Header ===== */}
      <div className="px-5 pt-[var(--safe-area-top)] pb-2 flex items-center justify-between">
        <h1 className="text-[34px] font-bold leading-tight" style={{ color: "var(--color-text-primary)", letterSpacing: "-0.022em" }}>记账</h1>
        <div className="flex items-center gap-1.5">
          <div className="relative">
            <button
              type="button"
              onClick={() => setMonthPanelOpen((v) => !v)}
              className="flex items-center gap-1.5 active:opacity-60"
            >
              <span className="text-[17px] font-semibold whitespace-nowrap" style={{ color: "var(--color-text-primary)" }}>{month}月</span>
            </button>
            <AnimatePresence>
              {monthPanelOpen && (
                <>
                  <div className="fixed inset-0 z-40" onClick={() => setMonthPanelOpen(false)} />
                  <motion.div
                    initial={{ opacity: 0, y: -4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -4 }}
                    transition={{ duration: 0.15 }}
                    className="absolute right-0 top-full mt-2 z-50 w-[160px] rounded-[12px] border border-[var(--lifeflow-border)] shadow-[0_4px_16px_rgba(0,0,0,0.08)] py-2 max-h-[320px] overflow-y-auto"
                    style={{ background: "var(--color-surface-card)" }}
                  >
                    {monthOptions.map((opt) => {
                      const active = opt.year === year && opt.month === month;
                      const now = new Date();
                      const targetOffset = -( (now.getFullYear() - opt.year) * 12 + (now.getMonth() + 1 - opt.month) );
                      return (
                        <button
                          key={`${opt.year}-${opt.month}`}
                          type="button"
                          onClick={() => { setMonthOffset(targetOffset); setMonthPanelOpen(false); }}
                          className="w-full h-9 px-4 text-[13px] flex items-center"
                          style={{
                            background: active ? "var(--lifeflow-brand-50)" : "transparent",
                            color: active ? "var(--lifeflow-primary)" : "var(--color-text-primary)",
                            fontWeight: active ? 500 : 400,
                          }}
                        >
                          {opt.year}年{opt.month}月
                        </button>
                      );
                    })}
                  </motion.div>
                </>
              )}
            </AnimatePresence>
          </div>
          <span className="w-[6px] h-[6px] rounded-full" style={{ background: "var(--lifeflow-border)" }} />
          <span className="flex items-center gap-1 px-2.5 py-1 text-[13px] font-medium whitespace-nowrap rounded-full" style={{ background: "var(--lifeflow-muted)", color: "var(--color-text-secondary)" }}>
            <span className="truncate max-w-[80px]">日常账本</span>
          </span>
          <Link href="/more/accounting/assets" className="flex items-center justify-center w-8 h-8 rounded-full" style={{ background: "var(--lifeflow-muted)" }}>
            <Wallet className="w-4 h-4" style={{ color: "var(--color-text-secondary)" }} />
          </Link>

        </div>
      </div>

      {/* ===== 搜索栏 ===== */}
      <div className="px-4 mt-4">
        <div className="flex items-center gap-3 px-4 py-3 rounded-[20px]" style={{ background: "var(--color-surface-card)", boxShadow: "var(--shadow-card)" }}>
          <Search className="w-5 h-5 shrink-0" style={{ color: "var(--color-text-secondary)" }} />
          <input
            type="text"
            placeholder="搜索收支记录..."
            value={keyword}
            onChange={(e) => setKeyword(e.target.value)}
            className="flex-1 bg-transparent border-none outline-none text-[15px]"
            style={{ color: "var(--color-text-primary)" }}
          />
          {keyword && (
            <button
              type="button"
              onClick={() => setKeyword("")}
              className="w-6 h-6 flex items-center justify-center active:opacity-50"
              aria-label="清空"
            >
              <span className="text-[13px]" style={{ color: "var(--color-text-secondary)" }}>✕</span>
            </button>
          )}
        </div>
      </div>

      {/* ===== 明细 | 图表 pill tab ===== */}
      <div className="px-4 mt-4">
        <div className="flex rounded-full p-1" style={{ background: "var(--lifeflow-muted)" }}>
          <button
            onClick={() => setActiveMainTab("detail")}
            className="flex-1 py-2.5 text-[15px] font-semibold rounded-full transition-all duration-200"
            style={mainTab === "detail"
              ? { background: "var(--lifeflow-primary)", color: "var(--lifeflow-primary-foreground)" }
              : { color: "var(--color-text-secondary)" }
            }
          >
            明细
          </button>
          <button
            onClick={() => setActiveMainTab("chart")}
            className="flex-1 py-2.5 text-[15px] font-semibold rounded-full transition-all duration-200"
            style={mainTab === "chart"
              ? { background: "var(--lifeflow-primary)", color: "var(--lifeflow-primary-foreground)" }
              : { color: "var(--color-text-secondary)" }
            }
          >
            图表
          </button>
        </div>
      </div>

      {/* ═══════════════════════════════════════════════════════
           明细 Tab
           ═══════════════════════════════════════════════════════ */}
      {mainTab === "detail" && (
        <motion.div
          key="detail"
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.2 }}
        >
          {/* ===== 月汇总卡片 ===== */}
          <motion.div
            initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}
            className="mx-4 mt-4 rounded-[20px] p-5"
            style={{ background: "var(--color-surface-card)", boxShadow: "var(--shadow-card)" }}
          >
            <div className="grid grid-cols-2">
              <div className="flex flex-col items-start gap-1 pr-3" style={{ borderRight: "0.5px solid var(--lifeflow-border)" }}>
                <span className="flex items-center gap-1.5 text-[13px] font-medium" style={{ color: "var(--color-text-secondary)" }}>
                  <span className="w-2 h-2 rounded-full shrink-0" style={{ background: "var(--color-expense)" }} />
                  本月支出
                </span>
                <span className="text-[20px] font-bold tracking-[-0.018em]" style={{ color: "var(--color-expense)" }}>¥{fmtCompact(monthExpense)}</span>
              </div>
              <div className="flex flex-col items-start gap-1 pl-3">
                <span className="flex items-center gap-1.5 text-[13px] font-medium" style={{ color: "var(--color-text-secondary)" }}>
                  <span className="w-2 h-2 rounded-full shrink-0" style={{ background: "var(--color-income)" }} />
                  本月收入
                </span>
                <span className="text-[20px] font-bold tracking-[-0.018em]" style={{ color: "var(--color-income)" }}>¥{fmtCompact(monthIncome)}</span>
              </div>
            </div>
          </motion.div>

          {/* ===== 今日空状态 ===== */}
          {todayStats.count === 0 && !isEmpty && (
            <section className="px-4 pb-6 mt-4">
              <h2 className="text-[17px] font-semibold px-1 mb-3" style={{ color: "var(--color-text-primary)" }}>今天</h2>
              <div className="rounded-[20px] py-10 flex flex-col items-center justify-center gap-3" style={{ background: "var(--color-surface-card)", boxShadow: "var(--shadow-card)" }}>
                <Wallet className="w-12 h-12 shrink-0" style={{ color: "var(--color-text-disabled)" }} strokeWidth={1.5} />
                <p className="text-[13px] font-medium" style={{ color: "var(--color-text-secondary)" }}>今日暂无收支记录</p>
              </div>
            </section>
          )}

          {/* ===== 记一笔按钮 ===== */}
          <div className="flex justify-center mt-4">
            <button
              onClick={() => setShowRecordSheet(true)}
              className="flex items-center gap-2 px-8 py-3 text-[16px] font-semibold rounded-full transition-all duration-200"
              style={{ background: "var(--lifeflow-primary)", color: "var(--lifeflow-primary-foreground)", boxShadow: "0 2px 8px rgba(37,99,235,0.3)" }}
            >
              <Plus className="w-5 h-5" strokeWidth={2.5} />
              记一笔
            </button>
          </div>

          {/* ===== 分类汇总 chips ===== */}
          {topExpenseCats.length > 0 && (
            <motion.div
              initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.05 }}
              className="mt-4 px-4 flex gap-3 overflow-x-auto no-scrollbar"
            >
              {topExpenseCats.map((item) => (
                <div key={item.categoryId}
                  className="h-[34px] px-4 rounded-full flex items-center gap-2 shrink-0"
                  style={{ background: "var(--lifeflow-muted)" }}
                >
                  <div className="w-2 h-2 rounded-full" style={{ background: item.cat?.color ?? "var(--color-text-disabled)" }} />
                  <span className="text-[15px]" style={{ color: "var(--color-text-primary)" }}>{item.cat?.name ?? "未分类"}</span>
                  <span className="text-[15px] font-medium" style={{ color: "var(--color-text-primary)" }}>¥{fmtCompact(item.sum)}</span>
                </div>
              ))}
            </motion.div>
          )}

          {/* ===== 明细区 ===== */}
          <motion.div
            initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className="mt-6 px-4 flex flex-col gap-6"
          >
            {!kw && todayStats.count > 0 && groups.length > 0 && (
              <div>
                <h2 className="text-[22px] font-bold" style={{ color: "var(--color-text-primary)" }}>今日明细</h2>
                <p className="text-[13px] mt-1" style={{ color: "var(--color-text-secondary)" }}>
                  {groups[0].label} · {todayStats.count} 笔 · 支出 ¥{fmtCompact(todayStats.expense)}
                </p>
              </div>
            )}

            {(filteredTxs ?? []).length === 0 ? (
              <div className="py-12 text-center text-[13px]" style={{ color: "var(--color-text-disabled)" }}>
                {kw ? "没有找到匹配的记录" : "本月暂无记录"}
              </div>
            ) : (
              groups.map((g, gi) => (
                <div key={g.date}>
                  {gi > 0 && (
                    <h2 className="text-[17px] font-semibold mb-3" style={{ color: "var(--color-text-primary)" }}>{g.label}</h2>
                  )}
                  <div className="rounded-[20px] overflow-hidden" style={{ background: "var(--color-surface-card)", boxShadow: "var(--shadow-card)" }}>
                    {g.items.map((t, idx) => {
                      const cat = t.categoryId ? categoryMap.get(t.categoryId) : undefined;
                      const isExpense = t.type === "expense";
                      const IconComp = getIcon(cat?.icon ?? "help-circle");
                      return (
                        <motion.div
                          key={t.id}
                          initial={{ opacity: 0, y: 8 }}
                          animate={{ opacity: 1, y: 0 }}
                          transition={{ delay: idx * 0.03, duration: 0.25 }}
                          className="flex items-center gap-3 px-4 min-h-[56px]"
                          style={{ borderTop: idx > 0 ? "0.5px solid var(--lifeflow-border)" : "none" }}
                        >
                          <div className="w-2 h-2 rounded-full shrink-0" style={{ background: cat?.color ?? "var(--color-text-disabled)" }} />
                          <IconComp className="w-5 h-5 shrink-0" style={{ color: "var(--color-text-disabled)" }} strokeWidth={1.5} />
                          <div className="flex-1 min-w-0">
                            <p className="text-[15px] font-medium truncate" style={{ color: "var(--color-text-primary)" }}>
                              {t.note || cat?.name || "未分类"}
                            </p>
                            <p className="text-[13px]" style={{ color: "var(--color-text-secondary)" }}>
                              {new Date(t.createdAt).toLocaleTimeString("zh-CN", { hour: "2-digit", minute: "2-digit" })}
                            </p>
                          </div>
                          <span className="text-[16px] font-semibold shrink-0 tabular-nums" style={{ color: "var(--color-text-primary)" }}>
                            {isExpense ? "-" : "+"}¥{fmtFull(t.amount)}
                          </span>
                          <button
                            type="button"
                            aria-label="删除"
                            onClick={() => handleDelete(t.id)}
                            className="w-7 h-7 rounded-lg flex items-center justify-center shrink-0 active:opacity-50"
                          >
                            <Trash2 className="w-4 h-4"
                              style={{ color: confirmDeleteId === t.id ? "var(--state-error)" : "var(--color-text-disabled)" }} />
                          </button>
                        </motion.div>
                      );
                    })}
                  </div>
                </div>
              ))
            )}
          </motion.div>
        </motion.div>
      )}

      {/* ═══════════════════════════════════════════════════════
           图表 Tab
           ═══════════════════════════════════════════════════════ */}
      {mainTab === "chart" && (
        <motion.div
          key="chart"
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.2 }}
        >
          {/* ─── 月/年 sub-tab ─── */}
          <div className="flex justify-center mt-4">
            <div className="inline-flex rounded-full p-1" style={{ background: "var(--lifeflow-muted)" }}>
              <button
                type="button"
                onClick={() => handleChartPeriodChange("month")}
                className="px-5 py-1.5 rounded-full text-[15px] leading-none transition-all duration-200"
                style={{
                  background: chartPeriod === "month" ? "var(--lifeflow-primary)" : "transparent",
                  color: chartPeriod === "month" ? "var(--lifeflow-primary-foreground)" : "var(--color-text-secondary)",
                  fontWeight: chartPeriod === "month" ? 600 : 400,
                  boxShadow: chartPeriod === "month" ? "0 2px 2px rgba(37,99,235,0.12), 0 4px 16px rgba(37,99,235,0.2)" : "none",
                }}
              >
                月
              </button>
              <button
                type="button"
                onClick={() => handleChartPeriodChange("year")}
                className="px-5 py-1.5 rounded-full text-[15px] leading-none transition-all duration-200"
                style={{
                  background: chartPeriod === "year" ? "var(--lifeflow-primary)" : "transparent",
                  color: chartPeriod === "year" ? "var(--lifeflow-primary-foreground)" : "var(--color-text-secondary)",
                  fontWeight: chartPeriod === "year" ? 600 : 400,
                  boxShadow: chartPeriod === "year" ? "0 2px 2px rgba(37,99,235,0.12), 0 4px 16px rgba(37,99,235,0.2)" : "none",
                }}
              >
                年
              </button>
            </div>
          </div>

          {/* ─── 月视图 ─── */}
          {chartPeriod === "month" && (
            <motion.div key="chart-month" initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.25 }}>
              {/* 月份选择行 */}
              <div className="flex items-center justify-center gap-4 py-4">
                <button type="button" onClick={goPrevMonth} className="w-8 h-8 flex items-center justify-center">
                  <ChevronLeft className="w-5 h-5" style={{ color: "var(--color-text-disabled)" }} />
                </button>
                <span className="text-[20px] font-semibold" style={{ color: "var(--color-text-primary)" }}>{chartYear}年{chartMonth}月</span>
                <button type="button" onClick={goNextMonth} className="w-8 h-8 flex items-center justify-center">
                  <ChevronRight className="w-5 h-5" style={{ color: "var(--color-text-disabled)" }} />
                </button>
              </div>

              {/* 汇总 3 列 */}
              <div className="mx-4 rounded-[20px] p-5" style={{ background: "var(--color-surface-card)", boxShadow: "var(--shadow-card)" }}>
                <div className="grid grid-cols-3" style={{ color: "var(--lifeflow-border)" }}>
                  <div className="flex flex-col items-center gap-1">
                    <span className="text-[12px] font-medium" style={{ color: "var(--color-text-secondary)" }}>支出</span>
                    <span className="text-[20px] font-bold tracking-[-0.018em]" style={{ color: "var(--color-expense)" }}>¥{fmtCompact(chartMonthExpense)}</span>
                  </div>
                  <div className="flex flex-col items-center gap-1">
                    <span className="text-[12px] font-medium" style={{ color: "var(--color-text-secondary)" }}>收入</span>
                    <span className="text-[20px] font-bold tracking-[-0.018em]" style={{ color: "var(--color-income)" }}>¥{fmtCompact(chartMonthIncome)}</span>
                  </div>
                  <div className="flex flex-col items-center gap-1">
                    <span className="text-[12px] font-medium" style={{ color: "var(--color-text-secondary)" }}>结余</span>
                    <span className="text-[20px] font-bold tracking-[-0.018em]" style={{ color: "var(--color-text-primary)" }}>¥{fmtCompact(chartMonthIncome - chartMonthExpense)}</span>
                  </div>
                </div>
              </div>

              {/* 支出分类 */}
              <div className="mx-4 mt-3 rounded-[20px] p-5" style={{ background: "var(--color-surface-card)", boxShadow: "var(--shadow-card)" }}>
                <h3 className="text-[17px] font-semibold mb-4" style={{ color: "var(--color-text-primary)" }}>支出分类</h3>
                {monthCatRanking.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-8">
                    <div className="w-16 h-16 rounded-full flex items-center justify-center mb-3" style={{ background: "var(--lifeflow-muted)" }}>
                      <span className="text-[24px]" style={{ color: "var(--color-text-disabled)" }}>📊</span>
                    </div>
                    <span className="text-[13px]" style={{ color: "var(--color-text-secondary)" }}>暂无数据</span>
                  </div>
                ) : (
                  <div className="flex flex-col gap-3">
                    {monthCatRanking.map((item) => {
                      const pct = chartMonthExpense > 0 ? (item.amount / chartMonthExpense * 100) : 0;
                      return (
                        <div key={item.categoryId}>
                          <div className="flex items-center justify-between mb-1.5">
                            <div className="flex items-center gap-2">
                              <div className="w-2.5 h-2.5 rounded-full" style={{ background: item.color }} />
                              <span className="text-[14px]" style={{ color: "var(--color-text-primary)" }}>{item.name}</span>
                            </div>
                            <span className="text-[14px] font-medium" style={{ color: "var(--color-text-primary)" }}>¥{fmtCompact(item.amount)}</span>
                          </div>
                          <div className="h-2 rounded-full" style={{ background: "var(--lifeflow-muted)" }}>
                            <div className="h-full rounded-full" style={{ width: `${Math.min(pct, 100)}%`, background: item.color }} />
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

              {/* 月度趋势（近 7 日） */}
              <div className="mx-4 mt-3 mb-6 rounded-[20px] p-5" style={{ background: "var(--color-surface-card)", boxShadow: "var(--shadow-card)" }}>
                <h3 className="text-[17px] font-semibold mb-4" style={{ color: "var(--color-text-primary)" }}>月度趋势</h3>
                {weekMax === 0 ? (
                  <div className="flex flex-col items-center justify-center py-8">
                    <div className="w-16 h-16 rounded-full flex items-center justify-center mb-3" style={{ background: "var(--lifeflow-muted)" }}>
                      <span className="text-[24px]" style={{ color: "var(--color-text-disabled)" }}>📈</span>
                    </div>
                    <span className="text-[13px]" style={{ color: "var(--color-text-secondary)" }}>暂无数据</span>
                  </div>
                ) : (
                  <div className="flex items-end justify-between gap-1 h-[140px] pt-2">
                    {weekExpenses.map((exp, i) => {
                      const height = weekMax > 0 ? (exp / weekMax * 100) : 0;
                      const dayIdx = (todayDayIndex - 6 + i + 7) % 7;
                      return (
                        <div key={i} className="flex flex-col items-center gap-1 flex-1 min-w-0">
                          {exp > 0 && (
                            <span className="text-[10px] font-medium" style={{ color: "var(--color-text-secondary)" }}>
                              ¥{fmtCompact(exp)}
                            </span>
                          )}
                          <div
                            className="w-full rounded-t-md transition-all duration-300"
                            style={{
                              height: `${Math.max(height, 4)}%`,
                              background: "var(--lifeflow-primary)",
                              opacity: i === 6 ? 1 : 0.35,
                              minHeight: exp > 0 ? 4 : 0,
                            }}
                          />
                          <span className="text-[11px]" style={{ color: "var(--color-text-disabled)" }}>周{dayNames[dayIdx]}</span>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </motion.div>
          )}

          {/* ─── 年视图 ─── */}
          {chartPeriod === "year" && (
            <motion.div key="chart-year" initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.25 }}>
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

              {/* 汇总 3 列 */}
              <div className="mx-4 rounded-[20px] p-5" style={{ background: "var(--color-surface-card)", boxShadow: "var(--shadow-card)" }}>
                <div className="grid grid-cols-3" style={{ color: "var(--lifeflow-border)" }}>
                  <div className="flex flex-col items-center gap-1">
                    <span className="text-[12px] font-medium" style={{ color: "var(--color-text-secondary)" }}>支出</span>
                    <span className="text-[20px] font-bold tracking-[-0.018em]" style={{ color: "var(--color-expense)" }}>¥{fmtCompact(chartYearExpense)}</span>
                  </div>
                  <div className="flex flex-col items-center gap-1">
                    <span className="text-[12px] font-medium" style={{ color: "var(--color-text-secondary)" }}>收入</span>
                    <span className="text-[20px] font-bold tracking-[-0.018em]" style={{ color: "var(--color-income)" }}>¥{fmtCompact(chartYearIncome)}</span>
                  </div>
                  <div className="flex flex-col items-center gap-1">
                    <span className="text-[12px] font-medium" style={{ color: "var(--color-text-secondary)" }}>结余</span>
                    <span className="text-[20px] font-bold tracking-[-0.018em]" style={{ color: "var(--color-text-primary)" }}>¥{fmtCompact(chartYearIncome - chartYearExpense)}</span>
                  </div>
                </div>
              </div>

              {/* 支出分类 */}
              <div className="mx-4 mt-3 rounded-[20px] p-5" style={{ background: "var(--color-surface-card)", boxShadow: "var(--shadow-card)" }}>
                <h3 className="text-[17px] font-semibold mb-4" style={{ color: "var(--color-text-primary)" }}>支出分类</h3>
                {yearCatRanking.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-8">
                    <div className="w-16 h-16 rounded-full flex items-center justify-center mb-3" style={{ background: "var(--lifeflow-muted)" }}>
                      <span className="text-[24px]" style={{ color: "var(--color-text-disabled)" }}>📊</span>
                    </div>
                    <span className="text-[13px]" style={{ color: "var(--color-text-secondary)" }}>暂无数据</span>
                  </div>
                ) : (
                  <div className="flex flex-col gap-3">
                    {yearCatRanking.map((item) => {
                      const pct = chartYearExpense > 0 ? (item.amount / chartYearExpense * 100) : 0;
                      return (
                        <div key={item.categoryId}>
                          <div className="flex items-center justify-between mb-1.5">
                            <div className="flex items-center gap-2">
                              <div className="w-2.5 h-2.5 rounded-full" style={{ background: item.color }} />
                              <span className="text-[14px]" style={{ color: "var(--color-text-primary)" }}>{item.name}</span>
                            </div>
                            <span className="text-[14px] font-medium" style={{ color: "var(--color-text-primary)" }}>¥{fmtCompact(item.amount)}</span>
                          </div>
                          <div className="h-2 rounded-full" style={{ background: "var(--lifeflow-muted)" }}>
                            <div className="h-full rounded-full" style={{ width: `${Math.min(pct, 100)}%`, background: item.color }} />
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

              {/* 月度趋势（12 月柱状图） */}
              <div className="mx-4 mt-3 mb-6 rounded-[20px] p-5" style={{ background: "var(--color-surface-card)", boxShadow: "var(--shadow-card)" }}>
                <h3 className="text-[17px] font-semibold mb-4" style={{ color: "var(--color-text-primary)" }}>月度趋势</h3>
                {yearMaxBucket === 0 ? (
                  <div className="flex flex-col items-center justify-center py-8">
                    <div className="w-16 h-16 rounded-full flex items-center justify-center mb-3" style={{ background: "var(--lifeflow-muted)" }}>
                      <span className="text-[24px]" style={{ color: "var(--color-text-disabled)" }}>📈</span>
                    </div>
                    <span className="text-[13px]" style={{ color: "var(--color-text-secondary)" }}>暂无数据</span>
                  </div>
                ) : (
                  <div className="flex items-end justify-between gap-1 h-[140px] pt-2">
                    {monthlyBuckets.map((val, i) => {
                      const height = yearMaxBucket > 0 ? (val / yearMaxBucket * 100) : 0;
                      return (
                        <div key={i} className="flex flex-col items-center gap-1 flex-1 min-w-0">
                          {val > 0 && (
                            <span className="text-[9px] font-medium" style={{ color: "var(--color-text-secondary)" }}>
                              ¥{fmtCompact(Math.round(val * 100))}
                            </span>
                          )}
                          <div
                            className="w-full rounded-t-md transition-all duration-300"
                            style={{
                              height: `${Math.max(height, 4)}%`,
                              background: "var(--lifeflow-primary)",
                              opacity: 0.35,
                              minHeight: val > 0 ? 4 : 0,
                            }}
                          />
                          <span className="text-[11px]" style={{ color: "var(--color-text-disabled)" }}>{i + 1}月</span>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </motion.div>
          )}
        </motion.div>
      )}



      {/* ═══════════════════════════════════════════════════════
           BottomSheet: 记一笔表单
           ═══════════════════════════════════════════════════════ */}
      <AnimatePresence>
        {showRecordSheet && (
          <motion.div
            className="fixed inset-0 z-[100]"
            style={{ background: "rgba(0,0,0,0.4)" }}
            onClick={() => setShowRecordSheet(false)}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          >
            <motion.div
              initial={{ y: "100%" }}
              animate={{ y: 0 }}
              exit={{ y: "100%" }}
              transition={{ type: "spring", damping: 30, stiffness: 300 }}
              className="absolute bottom-0 left-0 right-0 rounded-t-[24px] px-5 pt-6 pb-8 max-h-[85vh] overflow-y-auto"
              style={{ background: "var(--color-surface-card)" }}
              onClick={(e) => e.stopPropagation()}
            >
              {/* Sheet Handle */}
              <div className="flex justify-center mb-5">
                <div className="w-9 h-1 rounded-full" style={{ background: "var(--lifeflow-border)" }} />
              </div>

              <h2 className="text-[17px] font-semibold mb-5 text-center" style={{ color: "var(--color-text-primary)" }}>记一笔</h2>

              {/* Type Toggle */}
              <div className="flex rounded-full p-1 mb-5" style={{ background: "var(--lifeflow-muted)" }}>
                <button
                  onClick={() => handleRecordTypeChange("expense")}
                  className="flex-1 py-2.5 text-[15px] font-semibold rounded-full transition-all"
                  style={recordType === "expense"
                    ? { background: "var(--lifeflow-primary)", color: "var(--lifeflow-primary-foreground)" }
                    : { color: "var(--color-text-secondary)" }
                  }
                >
                  支出
                </button>
                <button
                  onClick={() => handleRecordTypeChange("income")}
                  className="flex-1 py-2.5 text-[15px] font-semibold rounded-full transition-all"
                  style={recordType === "income"
                    ? { background: "var(--lifeflow-primary)", color: "var(--lifeflow-primary-foreground)" }
                    : { color: "var(--color-text-secondary)" }
                  }
                >
                  收入
                </button>
              </div>

              {/* Amount Input */}
              <div className="mb-5">
                <label className="text-[13px] font-medium block mb-2" style={{ color: "var(--color-text-secondary)" }}>金额</label>
                <div className="flex items-center gap-1 px-4 py-3 rounded-2xl" style={{ background: "var(--lifeflow-muted)" }}>
                  <span className="text-[28px] font-bold" style={{ color: "var(--color-text-primary)" }}>¥</span>
                  <input
                    id="sheet-amount"
                    type="number"
                    placeholder="0.00"
                    value={recordAmount}
                    onChange={(e) => setRecordAmount(e.target.value)}
                    className="flex-1 bg-transparent border-none outline-none text-[28px] font-bold text-right"
                    style={{ color: "var(--color-text-primary)" }}
                    step="0.01"
                    min="0"
                  />
                </div>
              </div>

              {/* Account */}
              <div className="mb-5">
                <label className="text-[13px] font-medium block mb-2" style={{ color: "var(--color-text-secondary)" }}>账户</label>
                <div className="flex flex-col gap-2">
                  {(accounts ?? []).length === 0 ? (
                    <div className="py-4 text-center text-[13px]" style={{ color: "var(--color-text-disabled)" }}>
                      暂无资产账户，请先在资产页添加
                    </div>
                  ) : (
                    (accounts ?? []).map((acc) => {
                      const selected = selectedAccountId === acc.id;
                      const typeLabel: Record<string, string> = {
                        cash: "现金", bank: "银行卡", alipay: "支付宝", wechat: "微信",
                      };
                      const typeIcon: Record<string, string> = {
                        cash: "💵", bank: "🏦", alipay: "💳", wechat: "💬",
                      };
                      return (
                        <button
                          key={acc.id}
                          onClick={() => setSelectedAccountId(selected ? null : acc.id)}
                          className="flex items-center gap-3 px-4 py-3 rounded-2xl transition-all"
                          style={selected
                            ? { background: "var(--lifeflow-brand-50)", border: "1.5px solid var(--lifeflow-primary)" }
                            : { background: "var(--lifeflow-muted)", border: "1.5px solid transparent" }
                          }
                        >
                          <span className="text-xl">{typeIcon[acc.type] || "💰"}</span>
                          <div className="flex-1 text-left">
                            <span className="text-[14px] font-medium block" style={{ color: "var(--color-text-primary)" }}>{acc.name}</span>
                            <span className="text-[11px]" style={{ color: "var(--color-text-disabled)" }}>{typeLabel[acc.type] || acc.type} · ¥{(acc.balance / 100).toFixed(2)}</span>
                          </div>
                          {selected && (
                            <span className="w-5 h-5 rounded-full flex items-center justify-center" style={{ background: "var(--lifeflow-primary)" }}>
                              <span className="text-white text-[11px]">✓</span>
                            </span>
                          )}
                        </button>
                      );
                    })
                  )}
                </div>
              </div>

              {/* Note */}
              <div className="mb-6">
                <label className="text-[13px] font-medium block mb-2" style={{ color: "var(--color-text-secondary)" }}>备注</label>
                <input
                  type="text"
                  placeholder="添加备注..."
                  value={recordNote}
                  onChange={(e) => setRecordNote(e.target.value)}
                  className="w-full px-4 py-3 rounded-2xl border-none outline-none text-[15px]"
                  style={{ background: "var(--lifeflow-muted)", color: "var(--color-text-primary)" }}
                  maxLength={50}
                />
              </div>

              {/* Save */}
              <button
                onClick={handleSaveRecord}
                className="w-full py-3.5 rounded-2xl text-[16px] font-semibold"
                style={{ background: "var(--lifeflow-primary)", color: "var(--lifeflow-primary-foreground)" }}
              >
                保存记录
              </button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
