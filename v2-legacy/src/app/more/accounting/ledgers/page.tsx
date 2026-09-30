"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import { ChevronLeft, Plus, BookOpen, ChevronRight, Bookmark } from "lucide-react";
import { useLiveQuery } from "dexie-react-hooks";
import { getAllLedgers, getAllTransactions, updateLedger } from "@/lib/db/accounting.db";
import type { Ledger } from "@/lib/db/accounting.db";
import { showToast } from "@/components/ui/Toast";

// ============================================================
// 设计令牌
// ============================================================
const ACCENT = "#5865F2";
const TEXT_PRIMARY = "#1D1D1F";
const TEXT_SECONDARY = "#86868B";
const BORDER_NAV = "#E5E5E5";
const SHADOW_CARD = "0 1px 4px rgba(0,0,0,0.04)";

export const LEDGER_COVERS = ["#4677F5", "#F78611", "#13B997", "#F0447F", "#7C8BA1"];
function getCover(idx?: number): string {
  if (idx == null || idx < 0 || idx >= LEDGER_COVERS.length) return LEDGER_COVERS[0];
  return LEDGER_COVERS[idx];
}

// ============================================================
// 底部Sheet
// ============================================================
function BottomSheet({ open, onClose, children }: { open: boolean; onClose: () => void; children: React.ReactNode }) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center" onClick={onClose}>
      <div className="absolute inset-0 bg-black/30" />
      <motion.div initial={{ y: "100%" }} animate={{ y: 0 }} transition={{ type: "spring", damping: 30, stiffness: 400 }}
        className="relative w-full max-w-[430px] bg-white rounded-t-[20px] pb-[max(16px,env(safe-area-inset-bottom))]"
        onClick={(e) => e.stopPropagation()}>{children}</motion.div>
    </div>
  );
}

// ============================================================
// 页面
// ============================================================
export default function LedgersPage() {
  const router = useRouter();

  const ledgers = useLiveQuery(() => getAllLedgers(), [], [] as Ledger[]);
  const allTxs = useLiveQuery(() => getAllTransactions(), []);

  const [selectedLedger, setSelectedLedger] = useState<Ledger | null>(null);
  const [showDetail, setShowDetail] = useState(false);

  const defaultLedger = useMemo(() => {
    if (!ledgers || ledgers.length === 0) return null;
    // 优先 isDefault，其次 createdAt 最小
    const dl = ledgers.find((l) => l.isDefault);
    if (dl) return dl;
    return [...ledgers].sort((a, b) => a.createdAt - b.createdAt)[0];
  }, [ledgers]);

  const monthTxCountMap = useMemo(() => {
    const now = new Date();
    const prefix = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
    const map = new Map<string, number>();
    for (const tx of allTxs ?? []) {
      if (tx.date.startsWith(prefix)) map.set(tx.ledgerId, (map.get(tx.ledgerId) || 0) + 1);
    }
    return map;
  }, [allTxs]);

  // 总笔数
  const totalTxMap = useMemo(() => {
    const map = new Map<string, number>();
    for (const tx of allTxs ?? []) map.set(tx.ledgerId, (map.get(tx.ledgerId) || 0) + 1);
    return map;
  }, [allTxs]);

  const sortedLedgers = useMemo(() => [...ledgers].sort((a, b) => a.createdAt - b.createdAt), [ledgers]);

  // 非默认账本列表
  const otherLedgers = useMemo(() => {
    if (!defaultLedger) return sortedLedgers;
    return sortedLedgers.filter((l) => l.id !== defaultLedger.id);
  }, [sortedLedgers, defaultLedger]);

  const openDetail = (l: Ledger) => { setSelectedLedger(l); setShowDetail(true); };

  const handleSetDefault = async () => {
    if (!selectedLedger) return;
    for (const l of ledgers) { if (l.isDefault) await updateLedger(l.id, { isDefault: false }); }
    await updateLedger(selectedLedger.id, { isDefault: true });
    showToast({ type: "success", message: `已将「${selectedLedger.name}」设为默认` });
    setShowDetail(false);
  };

  return (
    <div className="min-h-screen flex flex-col" style={{ background: "var(--lifeflow-background)" }}>
      {/* ===== Header ===== */}
      <div className="h-[52px] flex items-center justify-between px-4 shrink-0" style={{ background: "var(--color-surface-card)" }}>
        <button type="button" onClick={() => router.back()} className="inline-flex items-center justify-center h-10 w-10">
          <ChevronLeft className="w-5 h-5" style={{ color: "var(--color-text-primary)" }} />
        </button>
        <span className="text-title-nav" style={{ color: "var(--color-text-primary)" }}>我的账本</span>
        <button type="button" onClick={() => router.push("/more/accounting/ledgers/new")}
          className="inline-flex items-center justify-center h-10 w-10">
          <Plus className="w-5 h-5" style={{ color: "var(--lifeflow-primary)" }} />
        </button>
      </div>

      {/* ===== 默认"总账本"卡片 ===== */}
      {defaultLedger && (
        <div className="px-4 mt-8">
          <button
            type="button"
            onClick={() => openDetail(defaultLedger)}
            className="w-full card-standard p-4 flex items-center gap-3 text-left"
          >
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl" style={{ background: "var(--lifeflow-brand-50)" }}>
              <BookOpen className="w-5 h-5" style={{ color: "var(--lifeflow-primary)" }} />
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-1.5">
                <span className="truncate text-[16px] font-semibold leading-snug" style={{ color: "var(--color-text-primary)" }}>
                  {defaultLedger.name}
                </span>
                <span className="inline-block h-2 w-2 shrink-0 rounded-full" style={{ background: "var(--lifeflow-primary)" }} />
              </div>
              <p className="truncate text-[13px] mt-0.5 leading-snug" style={{ color: "var(--color-text-secondary)" }}>
                默认账本，包含全部收支记录
              </p>
            </div>
            <ChevronRight className="w-4 h-4 shrink-0" style={{ color: "var(--color-text-disabled)" }} />
          </button>
        </div>
      )}

      {/* ===== 其他账本列表 / 空状态 ===== */}
      {otherLedgers.length > 0 ? (
        <div className="px-4 mt-6 flex flex-col gap-3 pb-8">
          {otherLedgers.map((ledger, i) => {
            const monthCount = monthTxCountMap.get(ledger.id) || 0;
            return (
              <motion.button key={ledger.id} type="button" whileTap={{ scale: 0.98 }}
                onClick={() => openDetail(ledger)}
                initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.08 + i * 0.06, duration: 0.25 }}
                className="w-full text-left rounded-[20px] overflow-hidden relative"
                style={{ background: "#FFFFFF", boxShadow: "var(--shadow-card)" }}>
                <div className="h-[68px] w-full" style={{ background: getCover(ledger.coverIndex) }} />
                <div className="flex items-center justify-between px-4 py-4">
                  <div className="min-w-0">
                    <p className="text-[17px] font-semibold truncate flex items-center gap-1" style={{ color: "var(--color-text-primary)" }}>
                      {ledger.name}
                    </p>
                    <p className="text-[13px]" style={{ color: "var(--color-text-secondary)" }}>{ledger.currency}</p>
                  </div>
                  <span className="text-[13px] shrink-0" style={{ color: "var(--color-text-secondary)" }}>本月 {monthCount} 笔</span>
                </div>
              </motion.button>
            );
          })}
        </div>
      ) : (
        /* 空状态 */
        <div className="flex flex-col items-center justify-center pt-14 pb-8">
          <div className="mb-5 flex h-16 w-16 items-center justify-center rounded-full" style={{ background: "var(--lifeflow-muted)" }}>
            <Bookmark className="h-7 w-7" style={{ color: "var(--color-text-disabled)" }} />
          </div>
          <p className="text-[15px] font-medium mb-6" style={{ color: "var(--color-text-secondary)" }}>还没有其他账本。创建一个分类管理收支？</p>
          <button
            type="button"
            onClick={() => router.push("/more/accounting/ledgers/new")}
            className="inline-flex items-center gap-1.5 rounded-full px-6 py-2.5 text-[15px] font-medium transition-opacity hover:opacity-90 active:opacity-80"
            style={{ background: "var(--lifeflow-primary)", color: "var(--lifeflow-primary-foreground)" }}
          >
            <Plus className="w-4 h-4" />
            新建账本
          </button>
        </div>
      )}

      {/* 账本详情 Sheet */}
      <BottomSheet open={showDetail} onClose={() => setShowDetail(false)}>
        {selectedLedger && (
          <>
            <div className="px-5 pt-5 pb-2 flex items-center justify-between">
              <span className="text-[17px] font-semibold" style={{ color: "var(--color-text-primary)" }}>{selectedLedger.name}</span>
              <button onClick={() => setShowDetail(false)} className="text-[15px]" style={{ color: "var(--color-text-secondary)" }}>关闭</button>
            </div>
            <div className="px-5 mt-3 space-y-3">
              <div className="flex justify-between">
                <span className="text-[15px]" style={{ color: "var(--color-text-secondary)" }}>货币</span>
                <span className="text-[15px]" style={{ color: "var(--color-text-primary)" }}>{selectedLedger.currency}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-[15px]" style={{ color: "var(--color-text-secondary)" }}>总交易</span>
                <span className="text-[15px]" style={{ color: "var(--color-text-primary)" }}>{totalTxMap.get(selectedLedger.id) || 0} 笔</span>
              </div>
              <div className="flex justify-between">
                <span className="text-[15px]" style={{ color: "var(--color-text-secondary)" }}>本月交易</span>
                <span className="text-[15px]" style={{ color: "var(--color-text-primary)" }}>{monthTxCountMap.get(selectedLedger.id) || 0} 笔</span>
              </div>
              {selectedLedger.note && (
                <div className="flex justify-between">
                  <span className="text-[15px]" style={{ color: "var(--color-text-secondary)" }}>备注</span>
                  <span className="text-[15px]" style={{ color: "var(--color-text-primary)" }}>{selectedLedger.note}</span>
                </div>
              )}
            </div>
            <div className="px-5 mt-6">
              <button type="button" onClick={handleSetDefault}
                className="w-full h-11 rounded-[12px] text-[15px] font-semibold text-white"
                style={{ background: "var(--lifeflow-primary)" }}>
                设为默认账本
              </button>
            </div>
            <div className="h-4" />
          </>
        )}
      </BottomSheet>
    </div>
  );
}
