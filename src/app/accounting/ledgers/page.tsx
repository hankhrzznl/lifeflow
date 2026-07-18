"use client";

import { useMemo } from "react";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import { ChevronLeft, Plus, ChevronRight } from "lucide-react";
import { useLiveQuery } from "dexie-react-hooks";
import { getAllLedgers, getAllTransactions } from "@/lib/db/accounting.db";
import type { Ledger } from "@/lib/db/accounting.db";
import { showToast } from "@/components/ui/Toast";

// ============================================================
// 设计稿基准: lifeflow-accounting/pages/my-ledgers.html
// ============================================================

const BRAND = "#34C759";
const MUTED = "#8E8E93";
const DISABLED = "#C7C7CC";
const BORDER = "#E5E5EA";
const SHADOW_CARD = "0 4px 16px rgba(0,0,0,0.08)";

// ─── 封面渐变（与新增页共享的常量） ───────────────────────────

const LEDGER_COVERS = [
  "linear-gradient(180deg, #FF9500 0%, #AF52DE 100%)",
  "linear-gradient(180deg, #FF6B8A 0%, #FFB8C6 100%)",
  "linear-gradient(180deg, #5AC8FA 0%, #34C759 100%)",
  "linear-gradient(180deg, #007AFF 0%, #5AC8FA 100%)",
  "linear-gradient(180deg, #AF52DE 0%, #FF6B8A 100%)",
];

function getCover(idx?: number): string {
  if (idx == null || idx < 0 || idx >= LEDGER_COVERS.length) return LEDGER_COVERS[0];
  return LEDGER_COVERS[idx];
}

// ─── 货币符号映射 ────────────────────────────────────────────

const CURRENCY_SYMBOL: Record<string, string> = {
  CNY: "¥",
  USD: "$",
  EUR: "€",
  JPY: "¥",
};

function getSymbol(currency: string): string {
  return CURRENCY_SYMBOL[currency] || currency;
}

// ============================================================
// 页面
// ============================================================

export default function LedgersPage() {
  const router = useRouter();

  const ledgers = useLiveQuery(() => getAllLedgers(), [], [] as Ledger[]);
  const allTxs = useLiveQuery(() => getAllTransactions(), [], []);

  // 每账本交易笔数
  const txCountMap = useMemo(() => {
    const map = new Map<string, number>();
    for (const tx of allTxs ?? []) {
      map.set(tx.ledgerId, (map.get(tx.ledgerId) || 0) + 1);
    }
    return map;
  }, [allTxs]);

  return (
    <div className="min-h-screen flex flex-col">
      {/* ===== 导航条 56px ===== */}
      <div className="h-[56px] flex items-center justify-between px-4" style={{ marginTop: 8 }}>
        <button
          type="button"
          onClick={() => router.back()}
          className="inline-flex items-center justify-center w-8 h-8"
          aria-label="返回"
        >
          <ChevronLeft className="w-6 h-6" style={{ color: "#000000" }} />
        </button>
        <span className="text-[17px] font-semibold" style={{ color: "#000000" }}>
          我的账本
        </span>
        <button
          type="button"
          onClick={() => router.push("/accounting/ledgers/new")}
          className="inline-flex items-center justify-center w-8 h-8"
          aria-label="新建"
        >
          <Plus className="w-6 h-6" style={{ color: "#000000" }} />
        </button>
      </div>

      {/* ===== 内容 ===== */}
      {(ledgers ?? []).length === 0 ? (
        /* 空状态 */
        <div className="flex-1 flex items-center justify-center">
          <div className="flex flex-col items-center" style={{ width: 240 }}>
            <p style={{ fontSize: 17, lineHeight: "24px", color: MUTED, textAlign: "center", margin: 0 }}>
              还没有账本
            </p>
            <p style={{ fontSize: 17, lineHeight: "24px", color: MUTED, textAlign: "center", margin: "4px 0 0 0" }}>
              点击右上角新建吧
            </p>
          </div>
        </div>
      ) : (
        /* 非空列表 */
        <div className="px-4 mt-4 flex flex-col gap-3 pb-4">
          {[...(ledgers ?? [])].sort((a, b) => b.createdAt - a.createdAt).map((ledger, i) => {
            const txCount = txCountMap.get(ledger.id) || 0;
            const sym = getSymbol(ledger.currency);
            return (
              <motion.button
                key={ledger.id}
                type="button"
                onClick={() => showToast({ type: "info", message: "功能开发中" })}
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.08 + i * 0.06, ease: [0.32, 0.72, 0, 1] }}
                className="flex items-center gap-4 p-4 rounded-[16px] text-left w-full"
                style={{ background: "#FFFFFF", boxShadow: SHADOW_CARD }}
              >
                {/* 封面缩略 */}
                <div
                  className="shrink-0 w-[40px] h-[56px] rounded-[8px]"
                  style={{ background: getCover(ledger.coverIndex) }}
                />
                {/* 账本信息 */}
                <div className="flex-1 min-w-0">
                  <p className="text-[17px] font-semibold truncate" style={{ color: "#000000" }}>
                    {ledger.name}
                  </p>
                  <p className="text-[13px]" style={{ color: MUTED }}>
                    {sym} · {ledger.currency} · {txCount} 笔交易
                  </p>
                </div>
                {/* 箭头 */}
                <ChevronRight className="w-5 h-5 shrink-0" style={{ color: DISABLED }} />
              </motion.button>
            );
          })}
        </div>
      )}
    </div>
  );
}

// 导出封面常量供新增页使用
export { LEDGER_COVERS };
