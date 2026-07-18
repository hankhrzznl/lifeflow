"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import { BookOpen, Search, Settings, ChevronLeft, ChevronRight, Trash2 } from "lucide-react";
import { useLiveQuery } from "dexie-react-hooks";
import {
  getTransactionsByMonth,
  deleteTransaction,
  getAllCategories,
} from "@/lib/db/accounting.db";
import type { Transaction, Category } from "@/lib/db/accounting.db";
import { CategoryIcon } from "@/components/accounting/CategoryIcon";
import { showToast } from "@/components/ui/Toast";

// ============================================================
// 设计稿基准: lifeflow-accounting/pages/home.html
// 白底 / 44px导航条 / 34px月份大标题 / 90px收支卡 / 绿色品牌
// ============================================================

const BRAND = "#34C759";
const EXPENSE = "#FF3B30";
const INCOME = "#007AFF";
const MUTED = "#8E8E93";
const DISABLED = "#C7C7CC";
const SHADOW_CARD = "0 4px 16px rgba(0,0,0,0.08)";

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

function todayStr(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

export default function AccountingPage() {
  const router = useRouter();
  const [monthOffset, setMonthOffset] = useState(0);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);

  // ─── 月份计算 ───
  const { year, month, label } = useMemo(() => {
    const d = new Date();
    d.setMonth(d.getMonth() + monthOffset);
    const y = d.getFullYear();
    const m = d.getMonth() + 1;
    const thisYear = new Date().getFullYear();
    const text =
      monthOffset === 0 ? "本月" : y === thisYear ? `${m}月` : `${y}年${m}月`;
    return { year: y, month: m, label: text };
  }, [monthOffset]);

  // ─── 数据（liveQuery 自动刷新） ───
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
    for (const t of txs ?? []) {
      if (t.type === "expense") expense += t.amount;
      else income += t.amount;
    }
    return { monthExpense: expense, monthIncome: income };
  }, [txs]);

  // ─── 按日期分组（新→旧） ───
  const groups = useMemo(() => {
    const sorted = [...(txs ?? [])].sort((a, b) =>
      a.date === b.date ? b.createdAt - a.createdAt : a.date < b.date ? 1 : -1,
    );
    const out: { date: string; label: string; items: Transaction[] }[] = [];
    const today = todayStr();
    const yesterday = (() => {
      const d = new Date();
      d.setDate(d.getDate() - 1);
      return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
    })();
    for (const t of sorted) {
      let g = out.find((x) => x.date === t.date);
      if (!g) {
        const [, m, d] = t.date.split("-").map(Number);
        g = {
          date: t.date,
          label: t.date === today ? "今天" : t.date === yesterday ? "昨天" : `${m}月${d}日`,
          items: [],
        };
        out.push(g);
      }
      g.items.push(t);
    }
    return out;
  }, [txs]);

  const handleDelete = async (id: string) => {
    if (confirmDeleteId !== id) {
      setConfirmDeleteId(id);
      setTimeout(() => setConfirmDeleteId((p) => (p === id ? null : p)), 2500);
      return;
    }
    await deleteTransaction(id);
    setConfirmDeleteId(null);
    showToast({ type: "success", message: "已删除" });
  };

  const isEmpty = (txs ?? []).length === 0;

  return (
    <div>
      {/* ===== 导航条（设计稿: 44px / 账本 + 搜索） ===== */}
      <div className="h-[44px] flex items-center justify-between px-4 mt-3">
        <button
          type="button"
          onClick={() => router.push("/accounting/ledgers")}
          aria-label="账本"
          className="w-8 h-8 flex items-center justify-center rounded-lg active:opacity-50"
        >
          <BookOpen className="w-6 h-6 text-black" strokeWidth={1.5} />
        </button>
        <button
          type="button"
          onClick={() => router.push("/accounting/search")}
          aria-label="搜索"
          className="w-8 h-8 flex items-center justify-center rounded-lg active:opacity-50"
        >
          <Search className="w-6 h-6 text-black" strokeWidth={1.5} />
        </button>
      </div>

      {/* ===== 月份标题（设计稿: 34px 居中；两侧切月） ===== */}
      <div className="relative flex items-center justify-center mt-[10px]">
        <button
          type="button"
          onClick={() => setMonthOffset((o) => o - 1)}
          aria-label="上一月"
          className="absolute left-5 w-8 h-8 flex items-center justify-center active:opacity-50"
        >
          <ChevronLeft className="w-5 h-5" style={{ color: DISABLED }} />
        </button>
        <h1 className="text-center text-[34px] font-bold text-black">{label}</h1>
        <button
          type="button"
          onClick={() => setMonthOffset((o) => Math.min(0, o + 1))}
          aria-label="下一月"
          disabled={monthOffset === 0}
          className="absolute right-5 w-8 h-8 flex items-center justify-center active:opacity-50 disabled:opacity-0"
        >
          <ChevronRight className="w-5 h-5" style={{ color: DISABLED }} />
        </button>
      </div>

      {/* ===== 收支汇总卡（设计稿: 90px / 20px圆角 / 28px金额） ===== */}
      <div className="flex gap-2 px-5 mt-6">
        <div className="flex-1 h-[90px] rounded-[20px] bg-white flex flex-col items-center justify-center" style={{ boxShadow: SHADOW_CARD }}>
          <span className="text-[28px] font-bold leading-none" style={{ color: EXPENSE }}>
            ¥{fmtCompact(monthExpense)}
          </span>
          <span className="text-[13px] mt-1.5" style={{ color: MUTED }}>支出</span>
        </div>
        <div className="flex-1 h-[90px] rounded-[20px] bg-white flex flex-col items-center justify-center" style={{ boxShadow: SHADOW_CARD }}>
          <span className="text-[28px] font-bold leading-none" style={{ color: INCOME }}>
            ¥{fmtCompact(monthIncome)}
          </span>
          <span className="text-[13px] mt-1.5" style={{ color: MUTED }}>收入</span>
        </div>
      </div>

      {/* ===== 明细列表 / 空状态 ===== */}
      {isEmpty ? (
        <>
          <div className="text-center mt-[120px] px-5">
            <p className="text-[15px] leading-relaxed" style={{ color: MUTED }}>Hi, 欢迎你 🎉</p>
            <p className="text-[13px] leading-relaxed mt-[35px]" style={{ color: MUTED }}>
              我们为坚持记录的小伙伴准备了一点小鼓励～
            </p>
            <p className="text-[13px] leading-relaxed mt-[35px]" style={{ color: MUTED }}>
              连续使用7天即可享受iCloud同步功能<span style={{ color: EXPENSE }}>永久免费</span>！
            </p>
          </div>
          <div className="text-center mt-[47px]">
            <Link
              href="/accounting/record"
              className="text-[16px] leading-none active:opacity-50"
              style={{ color: BRAND }}
            >
              + 开始记账
            </Link>
          </div>
          <div className="px-4 mt-[80px]">
            <button
              type="button"
              onClick={() => router.push("/accounting/settings")}
              aria-label="设置"
              className="w-8 h-8 flex items-center justify-center rounded-lg active:opacity-50"
            >
              <Settings className="w-6 h-6" style={{ color: MUTED }} strokeWidth={1.5} />
            </button>
          </div>
        </>
      ) : (
        <div className="px-5 mt-6 flex flex-col gap-5">
          {groups.map((g) => (
            <div key={g.date}>
              <p className="text-[13px] mb-2" style={{ color: MUTED }}>{g.label}</p>
              <div className="rounded-[16px] bg-white overflow-hidden" style={{ boxShadow: SHADOW_CARD }}>
                {g.items.map((t, idx) => {
                  const cat = t.categoryId ? categoryMap.get(t.categoryId) : undefined;
                  const isExpense = t.type === "expense";
                  return (
                    <motion.div
                      key={t.id}
                      initial={{ opacity: 0, y: 8 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: idx * 0.03, duration: 0.25 }}
                      className="flex items-center gap-3 px-4 h-[64px] group"
                      style={{ borderTop: idx === 0 ? "none" : "0.5px solid #E5E5EA" }}
                    >
                      <CategoryIcon
                        icon={cat?.icon ?? "help-circle"}
                        color={cat?.color ?? "#8E8E93"}
                        size={40}
                        iconSize={20}
                      />
                      <div className="flex-1 min-w-0">
                        <p className="text-[15px] text-black truncate">{cat?.name ?? "未分类"}</p>
                        {t.note && (
                          <p className="text-[13px] truncate" style={{ color: MUTED }}>{t.note}</p>
                        )}
                      </div>
                      <span
                        className="text-[16px] font-semibold shrink-0"
                        style={{ color: isExpense ? EXPENSE : INCOME }}
                      >
                        {isExpense ? "-" : "+"}¥{fmtFull(t.amount)}
                      </span>
                      <button
                        type="button"
                        aria-label="删除"
                        onClick={() => handleDelete(t.id)}
                        className="w-7 h-7 rounded-lg flex items-center justify-center shrink-0 active:opacity-50"
                      >
                        <Trash2
                          className="w-4 h-4"
                          style={{ color: confirmDeleteId === t.id ? EXPENSE : DISABLED }}
                        />
                      </button>
                    </motion.div>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
