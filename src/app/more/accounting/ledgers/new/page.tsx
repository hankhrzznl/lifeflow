"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import { X, Wallet, PiggyBank, Banknote, CreditCard, Landmark, Receipt, Goal, ShoppingBag, TrendingUp } from "lucide-react";
import { addLedger } from "@/lib/db/accounting.db";
import { showToast } from "@/components/ui/Toast";

// ============================================================
// 图标选项
// ============================================================
const ICON_OPTIONS = [
  { icon: Wallet },
  { icon: PiggyBank },
  { icon: Banknote },
  { icon: CreditCard },
  { icon: Landmark },
  { icon: Receipt },
  { icon: Goal },
  { icon: ShoppingBag },
  { icon: TrendingUp },
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
      router.replace("/more/accounting/ledgers");
    } catch {
      showToast({ type: "error", message: "创建失败" });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen" style={{ background: "var(--lifeflow-background)" }}>
      {/* ===== Header ===== */}
      <div className="h-[52px] flex items-center justify-between px-4 shrink-0" style={{ background: "var(--color-surface-card)" }}>
        <button
          type="button"
          onClick={() => router.back()}
          className="inline-flex items-center justify-center h-10 w-10"
          aria-label="关闭"
        >
          <X className="w-5 h-5" style={{ color: "var(--color-text-primary)" }} />
        </button>
        <span className="text-title-nav" style={{ color: "var(--color-text-primary)" }}>新增账本</span>
        <button
          type="button"
          onClick={handleCreate}
          disabled={!canSubmit}
          className="inline-flex items-center justify-center h-10 px-5 rounded-[20px] text-[15px] font-semibold transition-opacity hover:opacity-90 active:opacity-80"
          style={{
            background: canSubmit ? "var(--lifeflow-primary)" : "var(--color-text-disabled)",
            color: "#FFFFFF",
          }}
        >
          确认
        </button>
      </div>

      {/* ===== 表单卡片 ===== */}
      <div className="px-4 pt-4">
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.25 }}
          className="card-standard p-5 flex flex-col gap-5"
        >
          {/* 名称输入 */}
          <div>
            <label className="block mb-2 text-label">账本名称</label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="请输入账本名称"
              className="w-full text-[16px] border-none outline-none bg-transparent"
              style={{ color: "var(--color-text-primary)" }}
              maxLength={20}
            />
          </div>

          {/* 分隔线 */}
          <div className="divider" />

          {/* 图标选择 */}
          <div>
            <label className="block mb-3 text-label">账本图标</label>
            <div className="grid grid-cols-3 gap-3">
              {ICON_OPTIONS.map((item, i) => {
                const Icon = item.icon;
                const isSelected = coverIndex === i;
                return (
                  <button
                    key={i}
                    type="button"
                    onClick={() => setCoverIndex(i)}
                    className="flex items-center justify-center w-12 h-12 rounded-2xl transition-all"
                    style={{
                      background: isSelected ? "var(--lifeflow-brand-50)" : "var(--color-surface-secondary)",
                      outline: isSelected ? `2px solid var(--lifeflow-primary)` : "none",
                    }}
                  >
                    <Icon className="w-5 h-5" style={{ color: isSelected ? "var(--lifeflow-primary)" : "var(--color-text-secondary)" }} />
                  </button>
                );
              })}
            </div>
          </div>

          {/* 分隔线 */}
          <div className="divider" />

          {/* 描述输入 */}
          <div>
            <label className="block mb-2 text-label">账本描述</label>
            <textarea
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="添加描述..."
              className="w-full h-24 rounded-[12px] p-3 text-[15px] border-none outline-none resize-none"
              style={{ background: "var(--color-surface-secondary)", color: "var(--color-text-primary)" }}
              maxLength={100}
            />
          </div>
        </motion.div>
      </div>

      {/* 底部安全区 */}
      <div className="pb-8" />
    </div>
  );
}
