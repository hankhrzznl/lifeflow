"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import { ChevronLeft, ChevronRight, Moon, Download, Trash2, Info } from "lucide-react";
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
const ACCENT = "#5865F2";
const TOGGLE_OFF = "#EBEBEB";

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
          <span className="text-[17px] font-semibold" style={{ color: "var(--color-text-primary)" }}>{title}</span>
          <button onClick={onClose} className="text-[15px]" style={{ color: "var(--color-text-secondary)" }}>取消</button>
        </div>
        <div className="max-h-[320px] overflow-y-auto">
          {options.map((o) => (
            <button key={o.value} type="button" onClick={() => { onSelect(o.value); onClose(); }}
              className="w-full h-[52px] px-5 flex items-center justify-between active:bg-black/5">
              <span className="text-[15px]" style={{ color: "var(--color-text-primary)" }}>{o.label}</span>
              {o.selected && <div className="w-5 h-5 rounded-full" style={{ background: "var(--lifeflow-brand)" }}>...</div>}
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
// visual alignment complete
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
    <div className="min-h-screen" style={{ background: "var(--lifeflow-background)" }}>
      {/* ===== 页头 ===== */}
      <div className="flex items-center justify-center relative h-14 px-4">
        <button type="button" onClick={() => router.back()}
          className="absolute left-4 inline-flex h-8 w-8 items-center justify-center rounded-lg"
          style={{ border: "1px solid var(--lifeflow-border)", background: "var(--color-surface-card)" }}>
          <ChevronLeft className="h-4 w-4" style={{ color: "var(--color-text-primary)" }} />
        </button>
        <span className="text-[17px] font-semibold" style={{ color: "var(--color-text-primary)" }}>设置</span>
        <div className="w-8" aria-hidden="true" />
      </div>

      {/* ===== 外观组 ===== */}
      <div className="px-4 pt-4">
        <p className="text-[13px] font-medium px-5 pt-4 pb-2" style={{ color: "var(--color-text-secondary)" }}>外观</p>
        <div className="rounded-[20px] overflow-hidden" style={{ background: "var(--color-surface-card)", boxShadow: "var(--shadow-card)" }}>
          <div className="flex items-center justify-between w-full px-5 py-3.5">
            <div className="flex items-center gap-3 min-w-0">
              <Moon className="w-5 h-5 shrink-0" style={{ color: "var(--color-text-primary)" }} />
              <span className="text-[17px] truncate" style={{ color: "var(--color-text-primary)" }}>深色模式</span>
            </div>
            <ToggleSwitch
              checked={false}
              onChange={() => {}}
              label="深色模式"
            />
          </div>
        </div>
      </div>

      {/* ===== 数据组 ===== */}
      <div className="px-4 pt-4">
        <p className="text-[13px] font-medium px-5 pt-4 pb-2" style={{ color: "var(--color-text-secondary)" }}>数据</p>
        <div className="rounded-[20px] overflow-hidden" style={{ background: "var(--color-surface-card)", boxShadow: "var(--shadow-card)" }}>
          <button type="button" onClick={handleExport} className="flex items-center justify-between w-full px-5 py-3.5 active:opacity-50">
            <div className="flex items-center gap-3 min-w-0">
              <Download className="w-5 h-5 shrink-0" style={{ color: "var(--color-text-primary)" }} />
              <span className="text-[17px] truncate" style={{ color: "var(--color-text-primary)" }}>导出数据</span>
            </div>
            <ChevronRight className="w-5 h-5 shrink-0" style={{ color: "var(--color-text-disabled)" }} />
          </button>
          <div className="h-px" style={{ background: "var(--lifeflow-border)", marginLeft: "52px" }} />
          <button type="button" onClick={() => setShowClearDialog(true)} className="flex items-center justify-between w-full px-5 py-3.5 active:opacity-50">
            <div className="flex items-center gap-3 min-w-0">
              <Trash2 className="w-5 h-5 shrink-0" style={{ color: "var(--color-text-primary)" }} />
              <span className="text-[17px] truncate" style={{ color: "var(--color-text-primary)" }}>清除数据</span>
            </div>
            <ChevronRight className="w-5 h-5 shrink-0" style={{ color: "var(--color-text-disabled)" }} />
          </button>
        </div>
      </div>

      {/* ===== 关于组 ===== */}
      <div className="px-4 pt-4">
        <p className="text-[13px] font-medium px-5 pt-4 pb-2" style={{ color: "var(--color-text-secondary)" }}>关于</p>
        <div className="rounded-[20px] overflow-hidden" style={{ background: "var(--color-surface-card)", boxShadow: "var(--shadow-card)" }}>
          <div className="flex items-center justify-between w-full px-5 py-3.5">
            <div className="flex items-center gap-3 min-w-0">
              <Info className="w-5 h-5 shrink-0" style={{ color: "var(--color-text-primary)" }} />
              <span className="text-[17px] truncate" style={{ color: "var(--color-text-primary)" }}>版本</span>
            </div>
            <span className="text-[17px] shrink-0" style={{ color: "var(--color-text-secondary)" }}>1.0.0</span>
          </div>
        </div>
      </div>

      {/* ===== 退出登录 ===== */}
      <div className="px-5 mt-8">
        <button type="button"
          className="w-full h-12 rounded-[20px] text-[16px] font-semibold active:opacity-70"
          style={{ background: "var(--color-surface-card)", color: "var(--color-expense)", boxShadow: "var(--shadow-card)" }}>
          退出登录
        </button>
      </div>

      {/* ===== 底部内边距 ===== */}
      <div className="h-10" />

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
