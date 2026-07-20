"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import { ChevronLeft, Plus, TrendingUp, TrendingDown } from "lucide-react";
import { useLiveQuery } from "dexie-react-hooks";
import { getAllAccounts, getTransactionsByMonth, addAccount, updateAccount, deleteAccount, getDefaultLedger } from "@/lib/db/accounting.db";
import type { Account, Transaction } from "@/lib/db/accounting.db";
import { showToast } from "@/components/ui/Toast";
import Dialog from "@/components/ui/Dialog";

// ============================================================
// 设计令牌（CSS 变量）
// ============================================================

function fmt(fen: number): string {
  const absFen = Math.abs(fen);
  const yuan = absFen / 100;
  const formatted = yuan.toLocaleString("zh-CN", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  return fen < 0 ? `-¥ ${formatted}` : `¥ ${formatted}`;
}

const ACCOUNT_COLOR_MAP: Record<string, string> = {
  "微信钱包": "#5865F2", "支付宝": "#007AFF", "银行卡": "#5856D6", "现金": "#FF9500",
};
function getAccountColor(name: string): string { return ACCOUNT_COLOR_MAP[name] || "#86868B"; }
function getAccountFirstChar(name: string): string { return name.trim().charAt(0) || "钱"; }
function getAccountTypeLabel(type: string): string { return type === "liability" ? "负债账户" : "资产账户"; }

// ============================================================
// 底部Sheet
// ============================================================
function BottomSheet({ open, onClose, children }: { open: boolean; onClose: () => void; children: React.ReactNode }) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center" onClick={onClose}>
      <div className="absolute inset-0 bg-black/30" />
      <motion.div initial={{ y: "100%" }} animate={{ y: 0 }} transition={{ type: "spring", damping: 30, stiffness: 400 }}
        className="relative w-full max-w-[430px] bg-white rounded-t-[20px] pb-[calc(56px+max(16px,env(safe-area-inset-bottom)))]"
        onClick={(e) => e.stopPropagation()}>
        {children}
      </motion.div>
    </div>
  );
}

// ============================================================
// 页面
// ============================================================
export default function AssetsPage() {
  const router = useRouter();

  const accounts = useLiveQuery(() => getAllAccounts(), [], [] as Account[]);
  const monthTxs = useLiveQuery(() => {
    const now = new Date();
    return getTransactionsByMonth(now.getFullYear(), now.getMonth() + 1);
  }, []);

  // ─── 新增/编辑 Sheet 状态 ─────────────────────────────────
  const [showAddSheet, setShowAddSheet] = useState(false);
  const [editingAccount, setEditingAccount] = useState<Account | null>(null);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);

  const [formName, setFormName] = useState("");
  const [formType, setFormType] = useState<"asset" | "liability">("asset");
  const [formBalance, setFormBalance] = useState("");

  // ─── 汇总 ──────────────────────────────────────────────────
  const { totalAssets, totalLiabilities } = useMemo(() => {
    let assets = 0; let liabilities = 0;
    for (const a of accounts ?? []) {
      if (a.type === "liability") liabilities += a.balance;
      else assets += a.balance;
    }
    return { totalAssets: assets, totalLiabilities: liabilities };
  }, [accounts]);

  const netWorth = totalAssets - totalLiabilities;
  const hasAccounts = (accounts ?? []).length > 0;

  const monthNetFlow = useMemo(() => {
    let income = 0; let expense = 0;
    for (const t of (monthTxs ?? []) as Transaction[]) {
      if (t.type === "income") income += t.amount;
      else expense += t.amount;
    }
    return income - expense;
  }, [monthTxs]);

  const isFlowPositive = monthNetFlow > 0;
  const isFlowNegative = monthNetFlow < 0;
  const flowLabel = useMemo(() => {
    if (monthNetFlow === 0) return "较上月 ¥0";
    const sign = isFlowPositive ? "+" : "-";
    return `较上月 ${sign}${fmt(Math.abs(monthNetFlow)).replace("¥ ", "¥")}`;
  }, [monthNetFlow, isFlowPositive]);

  // ─── 打开新增 Sheet ────────────────────────────────────────
  const openAddSheet = () => {
    setFormName(""); setFormType("asset"); setFormBalance("");
    setEditingAccount(null); setShowAddSheet(true);
  };

  // ─── 打开编辑 Sheet ────────────────────────────────────────
  const openEditSheet = (acc: Account) => {
    setFormName(acc.name); setFormType(acc.type as "asset" | "liability");
    setFormBalance(String(Math.abs(acc.balance) / 100));
    setEditingAccount(acc); setShowAddSheet(true);
  };

  // ─── 保存（新增/编辑） ─────────────────────────────────────
  const handleSaveAccount = async () => {
    const name = formName.trim();
    if (!name) { showToast({ type: "warning", message: "请输入账户名称" }); return; }
    const balanceFen = Math.round((parseFloat(formBalance) || 0) * 100);
    const finalBalance = formType === "liability" ? -Math.abs(balanceFen) : balanceFen;

    try {
      const ledger = await getDefaultLedger();
      const ledgerId = ledger?.id ?? "default";
      if (editingAccount) {
        await updateAccount(editingAccount.id, { name, type: formType, balance: finalBalance });
        showToast({ type: "success", message: "已更新" });
      } else {
        await addAccount({ name, ledgerId, type: formType, balance: finalBalance, currency: "CNY" });
        showToast({ type: "success", message: "已添加" });
      }
      setShowAddSheet(false);
    } catch {
      showToast({ type: "error", message: "保存失败" });
    }
  };

  // ─── 删除 ──────────────────────────────────────────────────
  const handleDeleteAccount = async () => {
    if (!editingAccount) return;
    try {
      await deleteAccount(editingAccount.id);
      showToast({ type: "success", message: "已删除" });
      setShowDeleteDialog(false); setShowAddSheet(false);
    } catch {
      showToast({ type: "error", message: "删除失败" });
    }
  };

  // ============================================================
  return (
    <div className="min-h-screen">
      {/* 导航条 */}
      <div className="h-[44px] flex items-center px-4 mt-3">
        <button type="button" onClick={() => router.push("/more/accounting")}
          className="inline-flex items-center justify-center w-[44px] h-[44px] -ml-1">
          <ChevronLeft className="w-[28px] h-[28px]" style={{ color: "var(--color-text-primary)" }} />
        </button>
        <div className="flex-1 flex items-center justify-center">
          <span className="text-[17px] font-semibold" style={{ color: "var(--color-text-primary)" }}>资产</span>
        </div>
        <button type="button" onClick={openAddSheet}
          className="inline-flex items-center justify-center w-[44px] h-[44px] -mr-1">
          <Plus className="w-[24px] h-[24px]" style={{ color: "var(--lifeflow-primary)" }} />
        </button>
      </div>

      {/* 净资产卡 */}
      <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.25 }}
        className="mx-4 mt-[20px]">
        <div className="rounded-xl p-[24px] flex flex-col items-center" style={{ background: "var(--color-surface-card)", boxShadow: "var(--shadow-card)" }}>
          <span className="text-[13px]" style={{ color: "var(--color-text-secondary)" }}>净资产</span>
          <span className="text-[34px] font-bold leading-none mt-[8px]" style={{ color: "var(--color-text-primary)" }}>{fmt(netWorth)}</span>
          <div className="mt-[16px] h-[32px] px-4 rounded-full flex items-center justify-center gap-1" style={{ background: "var(--lifeflow-brand-50)" }}>
            {isFlowPositive && <TrendingUp className="w-[16px] h-[16px]" style={{ color: "var(--lifeflow-primary)" }} />}
            {isFlowNegative && <TrendingDown className="w-[16px] h-[16px]" style={{ color: "var(--lifeflow-primary)" }} />}
            <span className="text-[14px] font-medium" style={{ color: "var(--lifeflow-primary)" }}>{flowLabel}</span>
          </div>
        </div>
      </motion.div>

      {!hasAccounts && (
        <div className="py-[24px] text-center">
          <span className="text-[13px]" style={{ color: "var(--color-text-disabled)" }}>暂无账户，点击下方添加</span>
        </div>
      )}

      {/* 账户列表 */}
      {hasAccounts && (
        <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.25, delay: 0.05 }}
          className="mx-4 mt-[16px]">
          <div className="rounded-xl overflow-hidden" style={{ background: "var(--color-surface-card)", boxShadow: "var(--shadow-card)" }}>
            <div className="px-[20px] h-[56px] flex items-center justify-between" style={{ borderBottom: "0.5px solid var(--lifeflow-border)" }}>
              <span className="text-[17px] font-semibold" style={{ color: "var(--color-text-primary)" }}>账户</span>
              <span className="text-[13px]" style={{ color: "var(--color-text-secondary)" }}>共 {accounts!.length} 个账户</span>
            </div>
            {accounts!.map((acc) => {
              const color = getAccountColor(acc.name);
              const firstChar = getAccountFirstChar(acc.name);
              const isLiability = acc.type === "liability";
              const displayAmount = isLiability ? `-${fmt(Math.abs(acc.balance))}` : fmt(acc.balance);
              return (
                <motion.button key={acc.id} type="button" whileTap={{ scale: 0.98 }}
                  onClick={() => openEditSheet(acc)}
                  className="flex items-center gap-[12px] px-[20px] h-[72px] w-full text-left"
                  style={{ borderBottom: "0.5px solid var(--lifeflow-border)" }}>
                  <div className="w-[44px] h-[44px] rounded-[12px] flex items-center justify-center shrink-0" style={{ background: color }}>
                    <span className="text-[17px] font-semibold text-white">{firstChar}</span>
                  </div>
                  <div className="flex-1 min-w-0 flex flex-col gap-0.5">
                    <span className="text-[17px] font-semibold truncate" style={{ color: "var(--color-text-primary)" }}>{acc.name}</span>
                    <span className="text-[13px]" style={{ color: "var(--color-text-secondary)" }}>{getAccountTypeLabel(acc.type)}</span>
                  </div>
                  <span className="text-[17px] font-semibold shrink-0" style={{ color: "var(--color-text-primary)" }}>{displayAmount}</span>
                </motion.button>
              );
            })}
            <div className="px-[20px] py-[16px] flex justify-between" style={{ borderTop: "0.5px solid var(--lifeflow-border)" }}>
              <div className="flex flex-col gap-1 items-start">
                <span className="text-[13px]" style={{ color: "var(--color-text-secondary)" }}>总资产</span>
                <span className="text-[17px] font-bold" style={{ color: "var(--color-text-primary)" }}>{fmt(totalAssets)}</span>
              </div>
              <div className="flex flex-col gap-1 items-end">
                <span className="text-[13px]" style={{ color: "var(--color-text-secondary)" }}>总负债</span>
                <span className="text-[17px] font-bold" style={{ color: "var(--color-text-primary)" }}>-{fmt(Math.abs(totalLiabilities))}</span>
              </div>
            </div>
          </div>
        </motion.div>
      )}

      {/* 添加按钮 */}
      <div className="mx-4 mt-[16px] mb-[24px]">
        <motion.button type="button" whileTap={{ scale: 0.98 }} onClick={openAddSheet}
          className="h-[56px] rounded-[16px] w-full flex items-center justify-center gap-1"
          style={{ background: "var(--color-surface-card)", border: "1.5px dashed var(--lifeflow-border)" }}>
          <Plus className="w-[16px] h-[16px]" style={{ color: "var(--color-text-secondary)" }} />
          <span className="text-[15px]" style={{ color: "var(--color-text-secondary)" }}>添加账户</span>
        </motion.button>
      </div>

      {/* ===== 新增/编辑 Sheet ===== */}
      <BottomSheet open={showAddSheet} onClose={() => setShowAddSheet(false)}>
        <div className="px-5 pt-5 pb-2 flex items-center justify-between">
          <button onClick={() => setShowAddSheet(false)} className="text-[15px]" style={{ color: "var(--color-text-secondary)" }}>取消</button>
          <span className="text-[17px] font-semibold" style={{ color: "var(--color-text-primary)" }}>{editingAccount ? "编辑账户" : "添加账户"}</span>
          <button onClick={handleSaveAccount} className="text-[15px] font-semibold" style={{ color: "var(--lifeflow-primary)" }}>保存</button>
        </div>

        <div className="px-5 mt-4 space-y-4">
          {/* 名称 */}
          <div>
            <label className="text-[13px] block mb-1" style={{ color: "var(--color-text-secondary)" }}>账户名称</label>
            <input type="text" value={formName} onChange={(e) => setFormName(e.target.value)}
              placeholder="如 招商银行"
              className="w-full h-11 px-4 rounded-[12px] text-[15px] outline-none"
              style={{ background: "var(--lifeflow-border)", color: "var(--color-text-primary)" }} />
          </div>

          {/* 类型 */}
          <div>
            <label className="text-[13px] block mb-1" style={{ color: "var(--color-text-secondary)" }}>类型</label>
            <div className="flex gap-3">
              {(["asset", "liability"] as const).map((t) => (
                <button key={t} type="button" onClick={() => setFormType(t)}
                  className={`flex-1 h-11 rounded-[12px] text-[15px] font-medium ${
                    formType === t ? "text-white" : ""
                  }`}
                  style={{
                    background: formType === t ? "var(--lifeflow-primary)" : "var(--lifeflow-border)",
                    color: formType === t ? "#FFFFFF" : "var(--color-text-secondary)",
                  }}>
                  {t === "asset" ? "资产" : "负债"}
                </button>
              ))}
            </div>
          </div>

          {/* 余额 */}
          <div>
            <label className="text-[13px] block mb-1" style={{ color: "var(--color-text-secondary)" }}>
              {formType === "asset" ? "当前余额" : "负债金额"}
            </label>
            <input type="number" value={formBalance} onChange={(e) => setFormBalance(e.target.value)}
              placeholder="0.00" step="0.01"
              className="w-full h-11 px-4 rounded-[12px] text-[15px] outline-none"
              style={{ background: "var(--lifeflow-border)", color: "var(--color-text-primary)" }} />
          </div>

          {/* 编辑模式下显示删除 */}
          {editingAccount && (
            <button type="button" onClick={() => setShowDeleteDialog(true)}
              className="w-full h-11 rounded-[12px] text-[15px] font-medium mt-4"
              style={{ color: "var(--state-error)", background: "#FFF0F0" }}>
              删除账户
            </button>
          )}
        </div>

        <div className="h-4" />
      </BottomSheet>

      {/* 删除确认 */}
      <Dialog open={showDeleteDialog} onClose={() => setShowDeleteDialog(false)} type="confirm" variant="danger"
        title="删除账户" description={`确定要删除「${editingAccount?.name}」吗？此操作不可恢复。`}
        confirmLabel="删除" onConfirm={handleDeleteAccount} />
    </div>
  );
}
