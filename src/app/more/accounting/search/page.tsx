"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import { Search, X } from "lucide-react";
import { useLiveQuery } from "dexie-react-hooks";
import { getAllTransactions, getAllCategories } from "@/lib/db/accounting.db";
import type { Transaction, Category } from "@/lib/db/accounting.db";

// ─── 星期映射 ────────────────────────────────────────────────
const DAY_NAMES = ["日", "一", "二", "三", "四", "五", "六"];

// ─── 格式化 ──────────────────────────────────────────────────
function fmtFull(fen: number): string {
  return (fen / 100).toLocaleString("zh-CN", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

function formatTime(ts?: number): string {
  if (ts == null || isNaN(ts as number)) return "--";
  const d = new Date(ts);
  if (isNaN(d.getTime())) return "--";
  return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
}

function formatDateLabel(dateStr: string): string {
  const [y, m, d] = dateStr.split("-").map(Number);
  const date = new Date(y, m - 1, d);
  const dayName = DAY_NAMES[date.getDay()];
  return `${m}月${d}日 周${dayName}`;
}

// ============================================================
// 页面
// ============================================================
export default function SearchPage() {
  const router = useRouter();

  const [keyword, setKeyword] = useState("");
  const kw = keyword.trim().toLowerCase();

  const allTxs = useLiveQuery(() => getAllTransactions(), [], [] as Transaction[]);
  const categories = useLiveQuery(() => getAllCategories(), [], [] as Category[]);

  // 分类映射
  const categoryMap = useMemo(() => {
    const m = new Map<string, Category>();
    for (const c of categories ?? []) m.set(c.id, c);
    return m;
  }, [categories]);

  // 全文检索
  const results = useMemo(() => {
    if (!kw) return [] as Transaction[];
    const numKw = Number(kw);

    const matchAmount = (amount: number): boolean => {
      if (isNaN(numKw)) return false;
      if (Math.round(amount / 100) === Math.round(numKw)) return true;
      const yuanStr = (amount / 100).toFixed(2);
      return yuanStr.startsWith(kw);
    };

    return (allTxs ?? [])
      .filter((t) => {
        if (t.note?.toLowerCase().includes(kw)) return true;
        const cat = t.categoryId ? categoryMap.get(t.categoryId) : undefined;
        if (cat?.name.toLowerCase().includes(kw)) return true;
        if (matchAmount(t.amount)) return true;
        return false;
      })
      .sort((a, b) =>
        a.date === b.date ? b.createdAt - a.createdAt : a.date < b.date ? 1 : -1,
      );
  }, [allTxs, categoryMap, kw]);

  // 按日期分组
  const groups = useMemo(() => {
    const out: { date: string; label: string; items: Transaction[] }[] = [];
    for (const t of results) {
      let g = out.find((x) => x.date === t.date);
      if (!g) {
        g = {
          date: t.date,
          label: formatDateLabel(t.date),
          items: [],
        };
        out.push(g);
      }
      g.items.push(t);
    }
    return out;
  }, [results]);

  const hasKeyword = kw.length > 0;
  const hasResults = results.length > 0;

  return (
    <div className="min-h-screen flex flex-col" style={{ background: "var(--color-surface-card)" }}>
      {/* ===== 搜索栏 ===== */}
      <div className="flex items-center gap-2 px-4 pt-3 pb-2">
        <div
          className="flex-1 flex items-center gap-2 px-4 h-10 rounded-[20px]"
          style={{ background: "var(--color-surface-secondary)" }}
        >
          <Search className="w-4 h-4 shrink-0" style={{ color: "var(--color-text-secondary)" }} />
          <input
            type="text"
            value={keyword}
            onChange={(e) => setKeyword(e.target.value)}
            placeholder="搜索收支记录"
            autoFocus
            className="flex-1 bg-transparent outline-none text-[17px]"
            style={{ color: "var(--color-text-primary)" }}
          />
          {hasKeyword && (
            <button
              type="button"
              onClick={() => setKeyword("")}
              className="w-8 h-8 -mr-1 grid place-items-center active:opacity-50"
              aria-label="清空"
            >
              <X className="w-[18px] h-[18px]" style={{ color: "var(--color-text-disabled)" }} />
            </button>
          )}
        </div>
        <button
          type="button"
          onClick={() => router.back()}
          className="text-[16px] font-medium shrink-0"
          style={{ color: "var(--lifeflow-primary)" }}
        >
          取消
        </button>
      </div>

      {/* ===== 内容区 ===== */}
      {!hasKeyword ? (
        /* 初始空态：最近搜索 */
        <div className="px-4 pt-5">
          <h3 className="text-[15px] font-semibold mb-4" style={{ color: "var(--color-text-primary)" }}>最近搜索</h3>
          <div className="flex flex-col items-center justify-center py-14">
            <div className="w-16 h-16 rounded-full flex items-center justify-center mb-4" style={{ background: "var(--color-surface-secondary)" }}>
              <Search className="w-8 h-8" style={{ color: "var(--color-text-disabled)" }} />
            </div>
            <p className="text-[15px]" style={{ color: "var(--color-text-secondary)" }}>暂无搜索记录</p>
            <p className="text-[13px] mt-1.5" style={{ color: "var(--color-text-disabled)" }}>搜索过的记录将显示在这里</p>
          </div>
        </div>
      ) : !hasResults ? (
        /* 无结果态 */
        <div className="flex justify-center pt-[120px]">
          <p className="text-center px-8 text-[15px]" style={{ color: "var(--color-text-disabled)" }}>
            没有找到相关的记账记录
          </p>
        </div>
      ) : (
        /* 结果列表 */
        <div className="px-4 mt-6 flex flex-col">
          {groups.map((g, gi) => (
            <div key={g.date} className={gi > 0 ? "mt-6" : ""}>
              {/* 分组日期标题 */}
              <p className="text-[13px] mb-2" style={{ color: "var(--color-text-disabled)" }}>
                {g.label}
              </p>

              {/* 列表行（无卡片） */}
              {g.items.map((t, i) => {
                const cat = t.categoryId ? categoryMap.get(t.categoryId) : undefined;
                const catName = cat?.name ?? "未分类";
                const isExpense = t.type === "expense";
                const note = t.note;
                const primaryText = note || catName;
                const showSecondary = !!note;

                return (
                  <motion.div
                    key={t.id}
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: i * 0.03, duration: 0.25 }}
                    className="flex items-center gap-3 py-3.5"
                    style={{
                      borderTop: i === 0 ? "none" : `1px solid var(--lifeflow-border)`,
                    }}
                  >
                    {/* 分类圆点 */}
                    <div
                      className="w-2 h-2 rounded-full shrink-0"
                      style={{ background: cat?.color ?? "var(--color-text-disabled)" }}
                    />

                    {/* 文字列 */}
                    <div className="flex-1 min-w-0">
                      <p className="text-[17px] font-medium truncate" style={{ color: "var(--color-text-primary)" }}>
                        {primaryText}
                      </p>
                      {showSecondary && (
                        <p className="text-[13px] mt-0.5 truncate" style={{ color: "var(--color-text-secondary)" }}>
                          {catName}
                        </p>
                      )}
                    </div>

                    {/* 金额列 */}
                    <div className="shrink-0 flex flex-col items-end">
                      <span
                        className="text-[17px] font-semibold tabular-nums"
                        style={{ color: "var(--color-text-primary)" }}
                      >
                        {isExpense ? "-" : "+"}¥{fmtFull(t.amount)}
                      </span>
                      <span className="text-[13px] mt-0.5" style={{ color: "var(--color-text-secondary)" }}>
                        {formatTime(t.createdAt)}
                      </span>
                    </div>
                  </motion.div>
                );
              })}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
