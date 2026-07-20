"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { useLiveQuery } from "dexie-react-hooks";
import {
  getAllTransactions, getDefaultLedger, clearAllAccountingData,
  getAllLedgers, updateLedger,
} from "@/lib/db/accounting.db";
import type { Transaction, Ledger } from "@/lib/db/accounting.db";
import { showToast } from "@/components/ui/Toast";
import Dialog from "@/components/ui/Dialog";
import {
  getAccountingSetting, setAccountingSetting,
} from "@/lib/accountingSettings";

// ============================================================
// 设计令牌
// ============================================================
const ACCENT = "#6366F1";
const INK = "#1D1D1F";
const MUTED = "#86868B";
const CHEVRON = "#C7C7CC";
const DANGER = "#FF3B30";
const BORDER_CARD = "#EBEBEB";
const BORDER_HEADER = "#E6E6E6";
const TOGGLE_OFF = "#EBEBEB";
const SKELETON = "#F5F5F5";

// ─── 货币列表 ────────────────────────────────────────────────
const CURRENCIES = [
  { code: "CNY", label: "CNY (¥)" },
  { code: "USD", label: "USD ($)" },
  { code: "EUR", label: "EUR (€)" },
  { code: "JPY", label: "JPY (¥)" },
];

function getCurrencyLabel(code: string): string {
  return CURRENCIES.find((c) => c.code === code)?.label || code;
}

// ============================================================
// iOS 开关
// ============================================================
function ToggleSwitch({
  checked, onChange, label,
}: { checked: boolean; onChange: () => void; label: string }) {
  return (
    <button type="button" role="switch" aria-checked={checked} aria-label={label} onClick={onChange}
      className="relative shrink-0 rounded-full cursor-pointer"
      style={{ width: 51, height: 31, background: checked ? ACCENT : TOGGLE_OFF, transition: "background 0.2s" }}>
      <div className="absolute rounded-full bg-white"
        style={{ width: 27, height: 27, top: 2, left: checked ? 22 : 2, boxShadow: "0 1px 3px rgba(0,0,0,0.2)", transition: "left 0.2s" }} />
    </button>
  );
}

// ============================================================
// 底部选择器（ActionSheet）
// ============================================================
function ActionSheet({ open, onClose, title, options, onSelect }: {
  open: boolean; onClose: () => void; title: string;
  options: { label: string; value: string; selected?: boolean }[];
  onSelect: (value: string) => void;
}) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center" onClick={onClose}>
      <div className="absolute inset-0 bg-black/30" />
      <motion.div initial={{ y: "100%" }} animate={{ y: 0 }} exit={{ y: "100%" }} transition={{ type: "spring", damping: 30, stiffness: 400 }}
        className="relative w-full max-w-[430px] bg-white rounded-t-[20px] pb-[calc(56px+max(16px,env(safe-area-inset-bottom)))]"
        onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between px-5 pt-5 pb-2">
          <span className="text-[17px] font-semibold text-[#1D1D1F]">{title}</span>
          <button onClick={onClose} className="text-[15px] text-[#86868B]">取消</button>
        </div>
        <div className="max-h-[320px] overflow-y-auto">
          {options.map((o) => (
            <button key={o.value} type="button" onClick={() => { onSelect(o.value); onClose(); }}
              className="w-full h-[52px] px-5 flex items-center justify-between active:bg-black/5">
              <span className="text-[15px] text-[#1D1D1F]">{o.label}</span>
              {o.selected && <div className="w-5 h-5 rounded-full bg-[#6366F1] flex items-center justify-center">
                <svg width="12" height="12" viewBox="0 0 12 12"><path d="M2 6l3 3 5-6" stroke="#fff" strokeWidth="2" fill="none" strokeLinecap="round" strokeLinejoin="round"/></svg>
              </div>}
            </button>
          ))}
        </div>
      </motion.div>
    </div>
  );
}

// ============================================================
// 页面
// ============================================================
export default function SettingsPage() {
  const router = useRouter();

  const [hideZeroOn, setHideZeroOn] = useState(() => getAccountingSetting("hideZeroCategory"));
  const [weeklyOn, setWeeklyOn] = useState(() => getAccountingSetting("weeklyStats"));
  const [showClearDialog, setShowClearDialog] = useState(false);
  const [showLedgerPicker, setShowLedgerPicker] = useState(false);
  const [showCurrencyPicker, setShowCurrencyPicker] = useState(false);

  const allTxs = useLiveQuery(() => getAllTransactions(), []);
  const defaultLedger = useLiveQuery(() => getDefaultLedger(), []);
  const allLedgers = useLiveQuery(() => getAllLedgers(), []);

  const loaded = allTxs !== undefined;

  const { totalCount, uniqueDays } = useMemo(() => {
    if (!allTxs) return { totalCount: 0, uniqueDays: 0 };
    const days = new Set(allTxs.map((t: Transaction) => t.date));
    return { totalCount: allTxs.length, uniqueDays: days.size };
  }, [allTxs]);

  const ledgerName = defaultLedger?.name ?? "日常账本";
  const ledgerCurrency = defaultLedger?.currency ?? "CNY";

  // ─── 开关持久化 ────────────────────────────────────────────
  const toggleHideZero = () => {
    const next = !hideZeroOn;
    setHideZeroOn(next);
    setAccountingSetting("hideZeroCategory", next);
  };
  const toggleWeekly = () => {
    const next = !weeklyOn;
    setWeeklyOn(next);
    setAccountingSetting("weeklyStats", next);
  };

  // ─── 默认账本切换 ──────────────────────────────────────────
  const handleSelectLedger = async (id: string) => {
    if (!allLedgers) return;
    // 清除旧的 isDefault
    for (const l of allLedgers) {
      if (l.isDefault) await updateLedger(l.id, { isDefault: false });
    }
    await updateLedger(id, { isDefault: true });
    showToast({ type: "success", message: "已切换默认账本" });
  };

  // ─── 货币切换 ──────────────────────────────────────────────
  const handleSelectCurrency = async (code: string) => {
    if (defaultLedger?.id) {
      await updateLedger(defaultLedger.id, { currency: code });
      showToast({ type: "success", message: `已切换为 ${getCurrencyLabel(code)}` });
    }
  };

  // ─── 导出 CSV ──────────────────────────────────────────────
  const handleExport = async () => {
    if (!allTxs || allTxs.length === 0) {
      showToast({ type: "warning", message: "暂无数据可导出" });
      return;
    }
    try {
      const headers = ["日期", "类型", "金额(元)", "分类", "备注"];
      const rows = allTxs.map((t) => [
        t.date,
        t.type === "expense" ? "支出" : "收入",
        (t.amount / 100).toFixed(2),
        t.note || "",
        t.note || "",
      ].join(","));
      const csv = [headers.join(","), ...rows].join("\n");
      const blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `lifeflow_${new Date().toISOString().slice(0, 10)}.csv`;
      a.click();
      URL.revokeObjectURL(url);
      showToast({ type: "success", message: "导出成功" });
    } catch {
      showToast({ type: "error", message: "导出失败" });
    }
  };

  // ─── 清除数据 ──────────────────────────────────────────────
  const handleClearData = async () => {
    try {
      await clearAllAccountingData();
      showToast({ type: "success", message: "已清除所有数据" });
    } catch {
      showToast({ type: "error", message: "清除失败，请重试" });
    }
    setShowClearDialog(false);
  };

  // ============================================================
  return (
    <div className="min-h-screen bg-[#FAFAFA]">
      {/* 页头 */}
      <div className="h-[56px] flex items-center relative px-4" style={{ background: "#FFFFFF", borderBottom: `1px solid ${BORDER_HEADER}` }}>
        <button type="button" onClick={() => router.back()} className="w-11 h-11 -ml-1 flex items-center justify-center active:opacity-50">
          <ChevronLeft className="w-6 h-6" style={{ color: INK }} />
        </button>
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
          <span className="text-[17px] font-semibold" style={{ color: INK }}>设置</span>
        </div>
        <div className="w-11 h-11" />
      </div>

      {/* 统计双卡 */}
      <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.25 }}
        className="px-4 mt-4 flex gap-3">
        <div className="flex-1 h-[104px] rounded-xl p-4 flex flex-col justify-between" style={{ background: "#FFFFFF", boxShadow: "0 1px 4px rgba(0,0,0,0.04)" }}>
          <span className="text-[13px]" style={{ color: MUTED }}>总交易</span>
          <div className="flex items-baseline gap-1">
            {loaded ? (
              <><span className="text-[34px] font-bold leading-none" style={{ color: INK }}>{totalCount.toLocaleString("zh-CN")}</span>
              <span className="text-[17px] font-semibold" style={{ color: INK }}>笔</span></>
            ) : <div className="h-[34px] w-[80px] rounded-md animate-pulse" style={{ background: SKELETON }} />}
          </div>
        </div>
        <div className="flex-1 h-[104px] rounded-xl p-4 flex flex-col justify-between" style={{ background: "#FFFFFF", boxShadow: "0 1px 4px rgba(0,0,0,0.04)" }}>
          <span className="text-[13px]" style={{ color: MUTED }}>记账天数</span>
          <div className="flex items-baseline gap-1">
            {loaded ? (
              <><span className="text-[34px] font-bold leading-none" style={{ color: INK }}>{uniqueDays.toLocaleString("zh-CN")}</span>
              <span className="text-[17px] font-semibold" style={{ color: INK }}>天</span></>
            ) : <div className="h-[34px] w-[80px] rounded-md animate-pulse" style={{ background: SKELETON }} />}
          </div>
        </div>
      </motion.div>

      {/* 通用分组 */}
      <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.25, delay: 0.05 }}
        className="mx-4 mt-4">
        <div className="rounded-xl overflow-hidden" style={{ background: "#FFFFFF", boxShadow: "0 1px 4px rgba(0,0,0,0.04)" }}>
          <div className="px-4 pt-4 pb-1"><span className="text-[13px]" style={{ color: MUTED }}>通用</span></div>

          <button type="button" onClick={() => setShowLedgerPicker(true)} className="h-[56px] flex items-center justify-between px-4 w-full active:opacity-50">
            <span className="text-[17px]" style={{ color: INK }}>默认账本</span>
            <div className="flex items-center gap-1">
              <span className="text-[15px]" style={{ color: MUTED }}>{ledgerName}</span>
              <ChevronRight className="w-5 h-5" style={{ color: CHEVRON }} />
            </div>
          </button>
          <div style={{ borderTop: `0.5px solid ${BORDER_CARD}` }} />

          <button type="button" onClick={() => setShowCurrencyPicker(true)} className="h-[56px] flex items-center justify-between px-4 w-full active:opacity-50">
            <span className="text-[17px]" style={{ color: INK }}>货币单位</span>
            <div className="flex items-center gap-1">
              <span className="text-[15px]" style={{ color: MUTED }}>{getCurrencyLabel(ledgerCurrency)}</span>
              <ChevronRight className="w-5 h-5" style={{ color: CHEVRON }} />
            </div>
          </button>
          <div style={{ borderTop: `0.5px solid ${BORDER_CARD}` }} />

          <button type="button" onClick={() => router.push("/more/accounting/categories")}
            className="h-[56px] flex items-center justify-between px-4 w-full active:opacity-50">
            <span className="text-[17px]" style={{ color: INK }}>分类管理</span>
            <ChevronRight className="w-5 h-5" style={{ color: CHEVRON }} />
          </button>
        </div>
      </motion.div>

      {/* 显示分组 */}
      <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.25, delay: 0.1 }}
        className="mx-4 mt-4">
        <div className="rounded-xl overflow-hidden" style={{ background: "#FFFFFF", boxShadow: "0 1px 4px rgba(0,0,0,0.04)" }}>
          <div className="px-4 pt-4 pb-1"><span className="text-[13px]" style={{ color: MUTED }}>显示</span></div>
          <button type="button" onClick={toggleHideZero} className="h-[56px] flex items-center justify-between px-4 w-full active:opacity-50">
            <span className="text-[17px]" style={{ color: INK }}>隐藏零交易分类</span>
            <ToggleSwitch checked={hideZeroOn} onChange={toggleHideZero} label="隐藏零交易分类" />
          </button>
          <div style={{ borderTop: `0.5px solid ${BORDER_CARD}` }} />
          <button type="button" onClick={toggleWeekly} className="h-[56px] flex items-center justify-between px-4 w-full active:opacity-50">
            <span className="text-[17px]" style={{ color: INK }}>按周统计</span>
            <ToggleSwitch checked={weeklyOn} onChange={toggleWeekly} label="按周统计" />
          </button>
        </div>
      </motion.div>

      {/* 数据分组 */}
      <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.25, delay: 0.15 }}
        className="mx-4 mt-4">
        <div className="rounded-xl overflow-hidden" style={{ background: "#FFFFFF", boxShadow: "0 1px 4px rgba(0,0,0,0.04)" }}>
          <div className="px-4 pt-4 pb-1"><span className="text-[13px]" style={{ color: MUTED }}>数据</span></div>
          <button type="button" onClick={handleExport} className="h-[56px] flex items-center justify-between px-4 w-full active:opacity-50">
            <span className="text-[17px]" style={{ color: INK }}>导出数据</span>
            <ChevronRight className="w-5 h-5" style={{ color: CHEVRON }} />
          </button>
          <div style={{ borderTop: `0.5px solid ${BORDER_CARD}` }} />
          <button type="button" onClick={() => setShowClearDialog(true)} className="h-[56px] flex items-center justify-between px-4 w-full active:opacity-50">
            <span className="text-[17px]" style={{ color: DANGER }}>清除所有数据</span>
            <ChevronRight className="w-5 h-5" style={{ color: CHEVRON }} />
          </button>
        </div>
      </motion.div>

      <p className="text-center mt-8 text-[13px] pb-10" style={{ color: MUTED }}>LifeFlow v1.0.0</p>

      {/* 选择器 */}
      <ActionSheet open={showLedgerPicker} onClose={() => setShowLedgerPicker(false)} title="选择默认账本"
        options={(allLedgers ?? []).map((l) => ({ label: l.name, value: l.id, selected: l.id === defaultLedger?.id }))}
        onSelect={handleSelectLedger} />

      <ActionSheet open={showCurrencyPicker} onClose={() => setShowCurrencyPicker(false)} title="选择货币"
        options={CURRENCIES.map((c) => ({ label: c.label, value: c.code, selected: c.code === ledgerCurrency }))}
        onSelect={handleSelectCurrency} />

      <Dialog open={showClearDialog} onClose={() => setShowClearDialog(false)} type="confirm" variant="danger"
        title="清除所有数据" description="将删除全部账本、账户、交易记录与分类，此操作无法恢复。"
        confirmLabel="确认清除" onConfirm={handleClearData} />
    </div>
  );
}
