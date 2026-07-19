"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import { ChevronRight } from "lucide-react";
import { addLedger } from "@/lib/db/accounting.db";
import { showToast } from "@/components/ui/Toast";
import { LEDGER_COVERS } from "../page";

// ============================================================
// 设计令牌（Apple 简约风）
// ============================================================
const ACCENT = "#6366F1";
const TEXT_PRIMARY = "#1D1D1F";
const TEXT_SECONDARY = "#86868B";
const TEXT_PLACEHOLDER = "#AEAEB2";
const TEXT_DISABLED = "#AEAEB2";
const BORDER_CARD = "#E5E5E5";
const BORDER_NAV = "#E5E5E5";
const BORDER_DIVIDER = "#F5F5F5";
const ARROW_COLOR = "#C7C7CC";

const CURRENCY_LABELS: Record<string, string> = {
  CNY: "CNY (¥)", USD: "USD ($)", EUR: "EUR (€)", JPY: "JPY (¥)",
};

const CURRENCIES = [
  { code: "CNY", label: "CNY (¥)" },
  { code: "USD", label: "USD ($)" },
  { code: "EUR", label: "EUR (€)" },
  { code: "JPY", label: "JPY (¥)" },
];

// ============================================================
// 页面
// ============================================================
export default function NewLedgerPage() {
  const router = useRouter();

  const [name, setName] = useState("");
  const [coverIndex, setCoverIndex] = useState(0);
  const [note, setNote] = useState("");
  const [currency, setCurrency] = useState("CNY");
  const [showCurrencyPicker, setShowCurrencyPicker] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const canSubmit = name.trim().length > 0 && !submitting;

  const handleCreate = async () => {
    if (!canSubmit) return;
    setSubmitting(true);
    try {
      await addLedger({
        name: name.trim(),
        type: "personal",
        currency: currency,
        coverIndex,
        note: note.trim() || undefined,
      });
      showToast({ type: "success", message: "已创建" });
      router.replace("/accounting/ledgers");
    } catch {
      showToast({ type: "error", message: "创建失败" });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#FAFAFA]">
      {/* ===== 导航条 ===== */}
      <div
        className="h-[52px] flex items-center justify-between px-4"
        style={{ background: "#FFFFFF", borderBottom: `1px solid ${BORDER_NAV}` }}
      >
        <button
          type="button"
          onClick={() => router.back()}
          className="inline-flex items-center justify-center h-full"
          aria-label="取消"
        >
          <span className="text-[17px]" style={{ color: TEXT_SECONDARY }}>取消</span>
        </button>
        <span className="text-[17px] font-semibold" style={{ color: TEXT_PRIMARY }}>
          新建账本
        </span>
        <button
          type="button"
          onClick={handleCreate}
          disabled={!canSubmit}
          className="inline-flex items-center justify-center h-full"
          aria-label="创建"
        >
          <span className="text-[17px] font-semibold" style={{ color: canSubmit ? ACCENT : TEXT_DISABLED }}>
            创建
          </span>
        </button>
      </div>

      {/* ===== 封面预览卡 ===== */}
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.25 }}
        className="mx-auto mt-8 w-[321px] aspect-[16/9] rounded-[20px]"
        style={{ background: LEDGER_COVERS[coverIndex] }}
      />

      {/* ===== 「选择封面」标签 ===== */}
      <p className="text-center mt-6 text-[13px]" style={{ color: TEXT_SECONDARY }}>
        选择封面
      </p>

      {/* ===== 封面色卡行 ===== */}
      <div className="mt-8 px-4 flex gap-4">
        {LEDGER_COVERS.map((color, i) => (
          <motion.button
            key={i}
            type="button"
            onClick={() => setCoverIndex(i)}
            whileTap={{ scale: 0.95 }}
            className="flex-1 h-[52px] rounded-[12px]"
            style={{
              background: color,
              boxShadow:
                coverIndex === i
                  ? "0 0 0 2px #FFFFFF, 0 0 0 4px #6366F1"
                  : undefined,
            }}
          />
        ))}
      </div>

      {/* ===== 表单卡一：名称 + 货币 ===== */}
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.25, delay: 0.05 }}
        className="mx-4 mt-8 bg-white rounded-[16px] border overflow-hidden"
        style={{ borderColor: BORDER_CARD }}
      >
        {/* 名称输入 */}
        <div className="h-[52px] px-4 flex items-center">
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="输入账本名称"
            className="flex-1 bg-transparent outline-none text-[15px]"
            style={{ color: TEXT_PRIMARY }}
            maxLength={20}
          />
        </div>
        {/* 分隔线 */}
        <div className="mx-4 border-t" style={{ borderColor: BORDER_DIVIDER }} />
        {/* 货币行 */}
        <button
          type="button"
          onClick={() => setShowCurrencyPicker(true)}
          className="h-[52px] px-4 flex items-center justify-between w-full text-left"
        >
          <span className="text-[15px]" style={{ color: TEXT_PRIMARY }}>货币</span>
          <div className="flex items-center gap-1">
            <span className="text-[15px]" style={{ color: TEXT_PRIMARY }}>{CURRENCY_LABELS[currency] || currency}</span>
            <ChevronRight className="w-4 h-4" style={{ color: ARROW_COLOR }} />
          </div>
        </button>
      </motion.div>

      {/* ===== 表单卡二：备注 ===== */}
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.25, delay: 0.1 }}
        className="mx-4 mt-6 bg-white rounded-[16px] border overflow-hidden"
        style={{ borderColor: BORDER_CARD }}
      >
        <textarea
          value={note}
          onChange={(e) => setNote(e.target.value)}
          placeholder="备注（选填）"
          className="w-full h-[88px] px-4 py-4 bg-transparent outline-none resize-none text-[15px]"
          style={{ color: TEXT_PRIMARY }}
        />
      </motion.div>

      {/* 底部安全区 */}
      <div className="pb-8" />

      {/* 货币选择器 */}
      {showCurrencyPicker && (
        <div className="fixed inset-0 z-50 flex items-end justify-center" onClick={() => setShowCurrencyPicker(false)}>
          <div className="absolute inset-0 bg-black/30" />
          <motion.div initial={{ y: "100%" }} animate={{ y: 0 }} transition={{ type: "spring", damping: 30, stiffness: 400 }}
            className="relative w-full max-w-[430px] bg-white rounded-t-[20px] pb-[max(16px,env(safe-area-inset-bottom))]"
            onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between px-5 pt-5 pb-2">
              <span className="text-[17px] font-semibold text-[#1D1D1F]">选择货币</span>
              <button onClick={() => setShowCurrencyPicker(false)} className="text-[15px] text-[#86868B]">取消</button>
            </div>
            <div className="max-h-[320px] overflow-y-auto">
              {CURRENCIES.map((c) => (
                <button key={c.code} type="button" onClick={() => { setCurrency(c.code); setShowCurrencyPicker(false); }}
                  className="w-full h-[52px] px-5 flex items-center justify-between active:bg-black/5">
                  <span className="text-[15px] text-[#1D1D1F]">{c.label}</span>
                  {currency === c.code && <div className="w-5 h-5 rounded-full bg-[#6366F1] flex items-center justify-center">
                    <svg width="12" height="12" viewBox="0 0 12 12"><path d="M2 6l3 3 5-6" stroke="#fff" strokeWidth="2" fill="none" strokeLinecap="round" strokeLinejoin="round"/></svg>
                  </div>}
                </button>
              ))}
            </div>
          </motion.div>
        </div>
      )}
    </div>
  );
}
