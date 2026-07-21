"use client";

import { useMemo, useState, useCallback } from "react";
import Link from "next/link";
import { motion, AnimatePresence } from "framer-motion";
import { Plus, ChevronDown, Trash2, Wallet } from "lucide-react";
import { useLiveQuery } from "dexie-react-hooks";
import { getTransactionsByMonth, deleteTransaction, getAllCategories } from "@/lib/db/accounting.db";
import type { Transaction, Category } from "@/lib/db/accounting.db";
import { getIcon } from "@/components/accounting/CategoryIcon";
import { showToast } from "@/components/ui/Toast";
import PillNav from "@/components/accounting/PillNav";

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

// ============================================================

export default function AccountingPage() {
  const [monthOffset, setMonthOffset] = useState(0);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [monthPanelOpen, setMonthPanelOpen] = useState(false);

  const { year, month } = useMemo(() => {
    const d = new Date();
    d.setMonth(d.getMonth() + monthOffset);
    return { year: d.getFullYear(), month: d.getMonth() + 1 };
  }, [monthOffset]);

  const txs = useLiveQuery(
    () => getTransactionsByMonth(year, month),
    [year, month],
    [] as Transaction[],
  );
  const categories = useLiveQuery(() => getAllCategories(), [], [] as Category[]);

  const categoryMap = useMemo(() => {
    const map = new Map<string, Category>();
    for (const c of categories ?? []) map.set(c.id, c);
    return map;
  }, [categories]);

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

  const groups = useMemo(() => {
    const sorted = [...(txs ?? [])].sort((a, b) =>
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
  }, [txs]);

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

  const isEmpty = (txs ?? []).length === 0;

  const monthOptions = useMemo(() => {
    const now = new Date();
    const options: { year: number; month: number }[] = [];
    for (let i = 0; i < 12; i++) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      options.push({ year: d.getFullYear(), month: d.getMonth() + 1 });
    }
    return options;
  }, []);

  return (
    <div className="pb-6">
      {/* ===== Header ===== */}
      <div className="px-4 pt-5 flex items-center justify-between">
        <h1 className="text-[34px] font-bold leading-tight" style={{ color: "var(--color-text-primary)", letterSpacing: "-0.022em" }}>记账</h1>
        <div className="flex items-center gap-1.5">
          <div className="relative">
            <button
              type="button"
              onClick={() => setMonthPanelOpen((v) => !v)}
              className="flex items-center gap-1.5 active:opacity-60"
            >
              <span className="text-[13px] font-medium" style={{ color: "var(--color-text-secondary)" }}>{month}月</span>
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
          <span className="text-[13px] font-medium truncate max-w-[100px]" style={{ color: "var(--color-text-secondary)" }}>日常账本</span>
        </div>
      </div>

      {/* ===== pill 二级导航 ===== */}
      <div className="mt-4">
        <PillNav />
      </div>

      {/* ===== 月汇总卡片 ===== */}
      <motion.div
        initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}
        className="mx-4 mt-4 rounded-[20px] p-5"
        style={{ background: "var(--color-surface-card)", boxShadow: "var(--shadow-card)" }}
      >
        <div className="grid grid-cols-2">
          {/* 本月支出 */}
          <div className="flex flex-col items-start gap-1 pr-3" style={{ borderRight: "0.5px solid var(--lifeflow-border)" }}>
            <span className="flex items-center gap-1.5 text-[13px] font-medium" style={{ color: "var(--color-text-secondary)" }}>
              <span className="w-2 h-2 rounded-full shrink-0" style={{ background: "var(--color-expense)" }} />
              本月支出
            </span>
            <span className="text-[20px] font-bold tracking-[-0.018em]" style={{ color: "var(--color-expense)" }}>¥{fmtCompact(monthExpense)}</span>
          </div>
          {/* 本月收入 */}
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
      {todayStats.count === 0 && (
        <section className="px-4 pb-6 mt-4">
          <h2 className="text-[17px] font-semibold px-1 mb-3" style={{ color: "var(--color-text-primary)" }}>今天</h2>
          <div className="rounded-[20px] py-10 flex flex-col items-center justify-center gap-3" style={{ background: "var(--color-surface-card)", boxShadow: "var(--shadow-card)" }}>
            <Wallet className="w-12 h-12 shrink-0" style={{ color: "var(--color-text-disabled)" }} strokeWidth={1.5} />
            <p className="text-[13px] font-medium" style={{ color: "var(--color-text-secondary)" }}>今日暂无收支记录</p>
          </div>
        </section>
      )}

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

      {/* ===== 主操作行 ===== */}
      <motion.div
        initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1 }}
        className="mt-4 px-4 flex items-center justify-between"
      >
        <span className="text-[13px]" style={{ color: "var(--color-text-secondary)" }}>
          {todayStats.count > 0
            ? `今日 ${todayStats.count} 笔 · 支出 ¥${fmtCompact(todayStats.expense)}`
            : !isEmpty ? `本月共 ${txs.length} 笔` : "暂无记录"}
        </span>
        <Link href="/more/accounting/record">
          <motion.div
            whileTap={{ scale: 0.97 }}
            className="h-11 px-5 rounded-full text-white text-[15px] font-semibold flex items-center gap-1.5 cursor-pointer"
            style={{ background: "var(--lifeflow-primary)" }}
          >
            <Plus className="w-4 h-4" strokeWidth={2.5} />
            记一笔
          </motion.div>
        </Link>
      </motion.div>

      {/* ===== 明细区 ===== */}
      <motion.div
        initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.15 }}
        className="mt-8 px-4 flex flex-col gap-6"
      >
        {isEmpty ? (
          <div className="py-12 text-center text-[13px]" style={{ color: "var(--color-text-disabled)" }}>本月暂无记录</div>
        ) : (
          groups.map((g) => (
            <div key={g.date}>
              {g.isToday ? (
                <>
                  <h2 className="text-[22px] font-bold" style={{ color: "var(--color-text-primary)" }}>今日明细</h2>
                  <p className="text-[13px] mt-1" style={{ color: "var(--color-text-secondary)" }}>{g.label}</p>
                </>
              ) : (
                <h2 className="text-[17px] font-semibold" style={{ color: "var(--color-text-primary)" }}>{g.label}</h2>
              )}
              <div className="mt-3 rounded-[20px] overflow-hidden" style={{ background: "var(--color-surface-card)", boxShadow: "var(--shadow-card)" }}>
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
    </div>
  );
}
