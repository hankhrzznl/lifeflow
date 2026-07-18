"use client";

import { useMemo } from "react";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import { ChevronLeft, Plus } from "lucide-react";
import { useLiveQuery } from "dexie-react-hooks";
import { getAllLedgers, getAllTransactions } from "@/lib/db/accounting.db";
import type { Ledger } from "@/lib/db/accounting.db";
import { showToast } from "@/components/ui/Toast";

// ============================================================
// 设计令牌（Apple 简约风）
// ============================================================
const ACCENT = "#5865F2";
const TEXT_PRIMARY = "#1D1D1F";
const TEXT_SECONDARY = "#86868B";
const BORDER_NAV = "#E5E5E5";
const SHADOW_CARD = "0 1px 4px rgba(0,0,0,0.04)";

// ─── 封面 5 纯色（替换旧渐变） ────────────────────────────────
export const LEDGER_COVERS = [
  "#4677F5",
  "#F78611",
  "#13B997",
  "#F0447F",
  "#7C8BA1",
];

function getCover(idx?: number): string {
  if (idx == null || idx < 0 || idx >= LEDGER_COVERS.length) return LEDGER_COVERS[0];
  return LEDGER_COVERS[idx];
}

// ============================================================
// 页面
// ============================================================
export default function LedgersPage() {
  const router = useRouter();

  const ledgers = useLiveQuery(() => getAllLedgers(), [], [] as Ledger[]);
  const allTxs = useLiveQuery(() => getAllTransactions(), [], []);

  // 当前账本 = createdAt 最小
  const defaultLedger = useMemo(() => {
    if (!ledgers || ledgers.length === 0) return null;
    return [...ledgers].sort((a, b) => a.createdAt - b.createdAt)[0];
  }, [ledgers]);

  // 本月笔数 Map（按账本 + 当月过滤）
  const monthTxCountMap = useMemo(() => {
    const now = new Date();
    const prefix = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
    const map = new Map<string, number>();
    for (const tx of allTxs ?? []) {
      if (tx.date.startsWith(prefix)) {
        map.set(tx.ledgerId, (map.get(tx.ledgerId) || 0) + 1);
      }
    }
    return map;
  }, [allTxs]);

  // 排序（createdAt 升序，默认账本居首）
  const sortedLedgers = useMemo(() => {
    return [...(ledgers ?? [])].sort((a, b) => a.createdAt - b.createdAt);
  }, [ledgers]);

  return (
    <div className="min-h-screen flex flex-col bg-[#FAFAFA]">
      {/* ===== 导航条 ===== */}
      <div
        className="h-[52px] flex items-center justify-between px-4 shrink-0"
        style={{ background: "#FFFFFF", borderBottom: `1px solid ${BORDER_NAV}` }}
      >
        <button
          type="button"
          onClick={() => router.back()}
          className="inline-flex items-center justify-center w-8 h-8 -ml-2"
          aria-label="返回"
        >
          <ChevronLeft className="w-6 h-6" style={{ color: TEXT_PRIMARY }} />
        </button>
        <span className="text-[17px] font-semibold" style={{ color: TEXT_PRIMARY }}>
          账本
        </span>
        <button
          type="button"
          onClick={() => router.push("/accounting/ledgers/new")}
          className="inline-flex items-center justify-center w-8 h-8 -mr-2"
          aria-label="新建"
        >
          <Plus className="w-6 h-6" style={{ color: ACCENT }} />
        </button>
      </div>

      {/* ===== 空态 ===== */}
      {sortedLedgers.length === 0 && (
        <div className="flex-1 flex items-center justify-center">
          <div className="flex flex-col items-center gap-1">
            <span className="text-[15px]" style={{ color: TEXT_SECONDARY }}>还没有账本</span>
            <span className="text-[15px]" style={{ color: TEXT_SECONDARY }}>点击右上角新建吧</span>
          </div>
        </div>
      )}

      {/* ===== 非空内容 ===== */}
      {sortedLedgers.length > 0 && (
        <>
          {/* 「当前账本」行 */}
          {defaultLedger && (
            <div className="px-4 mt-8 flex items-center gap-2">
              <div className="w-2 h-2 rounded-full" style={{ background: ACCENT }} />
              <span className="text-[13px]" style={{ color: TEXT_SECONDARY }}>当前账本</span>
              <span className="text-[17px] font-bold" style={{ color: TEXT_PRIMARY }}>
                {defaultLedger.name} · {defaultLedger.currency}
              </span>
            </div>
          )}

          {/* 账本卡片列表 */}
          <div className="px-4 mt-10 flex flex-col gap-3 pb-8">
            {sortedLedgers.map((ledger, i) => {
              const monthCount = monthTxCountMap.get(ledger.id) || 0;
              return (
                <motion.button
                  key={ledger.id}
                  type="button"
                  onClick={() => showToast({ type: "info", message: "功能开发中" })}
                  initial={{ opacity: 0, y: 12 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.08 + i * 0.06, duration: 0.25 }}
                  whileTap={{ scale: 0.98 }}
                  className="w-full text-left bg-white rounded-[20px] overflow-hidden"
                  style={{ boxShadow: SHADOW_CARD }}
                >
                  {/* 封面色带 */}
                  <div
                    className="h-[68px] w-full"
                    style={{ background: getCover(ledger.coverIndex) }}
                  />
                  {/* 白区 */}
                  <div className="flex items-center justify-between px-4 py-4">
                    <div className="min-w-0">
                      <p className="text-[17px] font-semibold truncate" style={{ color: TEXT_PRIMARY }}>
                        {ledger.name}
                      </p>
                      <p className="text-[13px]" style={{ color: TEXT_SECONDARY }}>
                        {ledger.currency}
                      </p>
                    </div>
                    <span className="text-[13px] shrink-0" style={{ color: TEXT_SECONDARY }}>
                      本月 {monthCount} 笔
                    </span>
                  </div>
                </motion.button>
              );
            })}
          </div>
        </>
      )}
    </div>
  );
}
