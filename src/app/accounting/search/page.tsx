"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import { Search, X } from "lucide-react";
import { useLiveQuery } from "dexie-react-hooks";
import { getAllTransactions, getAllCategories } from "@/lib/db/accounting.db";
import type { Transaction, Category } from "@/lib/db/accounting.db";
import { CategoryIcon } from "@/components/accounting/CategoryIcon";

// ============================================================
// 设计稿基准: lifeflow-accounting/pages/search.html
// ============================================================

const BRAND = "#34C759";
const EXPENSE = "#FF3B30";
const INCOME = "#007AFF";
const MUTED = "#8E8E93";
const BORDER = "#E5E5EA";
const SURFACE = "#F2F2F7";
const SHADOW_CARD = "0 4px 16px rgba(0,0,0,0.08)";

// ─── 格式化 ──────────────────────────────────────────────────

function fmtFull(fen: number): string {
  return (fen / 100).toLocaleString("zh-CN", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

// ─── 日期标签 ────────────────────────────────────────────────

function todayStr(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function yesterdayStr(): string {
  const d = new Date();
  d.setDate(d.getDate() - 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
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
      // 四舍五入到元后相等
      if (Math.round(amount / 100) === Math.round(numKw)) return true;
      // 以关键词开头（如输入 "12" 命中 12.00 / 12.50）
      const yuanStr = (amount / 100).toFixed(2);
      return yuanStr.startsWith(kw);
    };

    return (allTxs ?? [])
      .filter((t) => {
        // 备注匹配
        if (t.note?.toLowerCase().includes(kw)) return true;
        // 分类名匹配
        const cat = t.categoryId ? categoryMap.get(t.categoryId) : undefined;
        if (cat?.name.toLowerCase().includes(kw)) return true;
        // 金额匹配
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
    const today = todayStr();
    const yesterday = yesterdayStr();
    for (const t of results) {
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
  }, [results]);

  const hasKeyword = kw.length > 0;
  const hasResults = results.length > 0;

  return (
    <div className="min-h-screen" style={{ background: "#FFFFFF" }}>
      <div className="mx-auto" style={{ maxWidth: 430 }}>
        {/* ===== 顶部间距 ===== */}
        <div className="h-[44px] mt-3" />

        {/* ===== 搜索栏区 h-12 ===== */}
        <div className="h-12 flex items-center px-5" style={{ marginTop: 12 }}>
          {/* 输入框容器 */}
          <div
            className="flex items-center px-3 shrink-0"
            style={{
              width: 360,
              height: 36,
              background: SURFACE,
              borderRadius: 10,
            }}
          >
            <Search className="w-5 h-5 shrink-0" style={{ color: MUTED }} />
            <input
              type="text"
              value={keyword}
              onChange={(e) => setKeyword(e.target.value)}
              placeholder="搜索备注，分类或金额"
              autoFocus
              className="flex-1 bg-transparent outline-none border-none ml-2 text-[17px]"
              style={{
                color: "#000000",
                fontFamily: "inherit",
              }}
              // placeholder 样式用内联
            />
          </div>
          {/* 关闭按钮 */}
          <button
            type="button"
            onClick={() => router.back()}
            className="w-5 h-5 shrink-0 flex items-center justify-center ml-2 active:opacity-50"
            aria-label="关闭"
          >
            <X className="w-5 h-5" style={{ color: MUTED }} />
          </button>
        </div>

        {/* placeholder 样式注入 */}
        <style>{`
          input::placeholder {
            color: #8E8E93;
            font-size: 17px;
            opacity: 1;
          }
        `}</style>

        {/* ===== 空态 / 无结果 / 结果列表 ===== */}
        {!hasKeyword ? (
          /* 初始空态 */
          <div className="flex justify-center pt-[281px]">
            <p
              className="text-center px-8 text-[17px] leading-6"
              style={{ color: MUTED, maxWidth: 340 }}
            >
              搜索备注，分类或者金额的结果会显示在这里
            </p>
          </div>
        ) : !hasResults ? (
          /* 有关键词但无结果 */
          <div className="flex justify-center pt-[120px]">
            <p
              className="text-center px-8 text-[17px] leading-6"
              style={{ color: MUTED, maxWidth: 340 }}
            >
              没有找到相关的记账记录
            </p>
          </div>
        ) : (
          /* 结果列表 */
          <div className="px-5 mt-6 flex flex-col gap-5">
            {groups.map((g) => (
              <div key={g.date}>
                <p className="text-[13px] mb-2" style={{ color: MUTED }}>
                  {g.label}
                </p>
                <div
                  className="rounded-[16px] bg-white overflow-hidden"
                  style={{ boxShadow: SHADOW_CARD }}
                >
                  {g.items.map((t, idx) => {
                    const cat = t.categoryId
                      ? categoryMap.get(t.categoryId)
                      : undefined;
                    const isExpense = t.type === "expense";
                    return (
                      <motion.div
                        key={t.id}
                        initial={{ opacity: 0, y: 8 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: idx * 0.03, duration: 0.25 }}
                        className="flex items-center gap-3 px-4 h-[64px]"
                        style={{
                          borderTop: idx === 0 ? "none" : "0.5px solid #E5E5EA",
                        }}
                      >
                        <CategoryIcon
                          icon={cat?.icon ?? "help-circle"}
                          color={cat?.color ?? "#8E8E93"}
                          size={40}
                          iconSize={20}
                        />
                        <div className="flex-1 min-w-0">
                          <p className="text-[15px] text-black truncate">
                            {cat?.name ?? "未分类"}
                          </p>
                          {t.note && (
                            <p
                              className="text-[13px] truncate"
                              style={{ color: MUTED }}
                            >
                              {t.note}
                            </p>
                          )}
                        </div>
                        <span
                          className="text-[16px] font-semibold shrink-0"
                          style={{ color: isExpense ? EXPENSE : INCOME }}
                        >
                          {isExpense ? "-" : "+"}¥{fmtFull(t.amount)}
                        </span>
                      </motion.div>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
