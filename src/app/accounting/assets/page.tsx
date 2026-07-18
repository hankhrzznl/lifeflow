"use client";

import { useMemo } from "react";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import { ChevronLeft, Plus, Smartphone, CreditCard, Banknote, Wallet } from "lucide-react";
import { useLiveQuery } from "dexie-react-hooks";
import { getAllAccounts } from "@/lib/db/accounting.db";
import type { Account } from "@/lib/db/accounting.db";
import { showToast } from "@/components/ui/Toast";

// ============================================================
// 设计稿基准: lifeflow-accounting/pages/assets.html
// ============================================================

const BRAND = "#34C759";
const MUTED = "#8E8E93";
const BORDER = "#E5E5EA";
const SHADOW_CARD = "0 4px 16px rgba(0,0,0,0.08)";

// ─── 格式化 ──────────────────────────────────────────────────

function fmtCompact(fen: number): string {
  const yuan = fen / 100;
  return yuan.toLocaleString("zh-CN", {
    minimumFractionDigits: fen % 100 === 0 ? 0 : 2,
    maximumFractionDigits: 2,
  });
}

// ─── 账户图标映射 ────────────────────────────────────────────

const ACCOUNT_ICON_MAP: Record<string, { icon: React.ComponentType<{ className?: string; style?: React.CSSProperties }>; color: string }> = {
  "微信钱包": { icon: Smartphone, color: "#34C759" },
  "支付宝": { icon: Smartphone, color: "#007AFF" },
  "银行卡": { icon: CreditCard, color: "#5856D6" },
  "现金": { icon: Banknote, color: "#FF9500" },
};

function getAccountIcon(name: string) {
  return ACCOUNT_ICON_MAP[name] || { icon: Wallet, color: "#8E8E93" };
}

/** 账户行图标（40px 圆底 + 白色 20px 图标，视觉同 CategoryIcon） */
function AccountIcon({ name }: { name: string }) {
  const { icon: IconComp, color } = getAccountIcon(name);
  return (
    <div
      className="flex items-center justify-center rounded-full shrink-0"
      style={{ width: 40, height: 40, background: color }}
    >
      <IconComp style={{ width: 20, height: 20, color: "#FFFFFF" }} />
    </div>
  );
}

// ============================================================
// 页面
// ============================================================

export default function AssetsPage() {
  const router = useRouter();

  const accounts = useLiveQuery(() => getAllAccounts(), [], [] as Account[]);

  // ─── 汇总 ──────────────────────────────────────────────────

  const { totalAssets, totalLiabilities } = useMemo(() => {
    let assets = 0;
    let liabilities = 0;
    for (const a of accounts ?? []) {
      if (a.type === "liability") liabilities += a.balance;
      else assets += a.balance;
    }
    return { totalAssets: assets, totalLiabilities: liabilities };
  }, [accounts]);

  const netWorth = totalAssets - totalLiabilities;
  const hasAccounts = (accounts ?? []).length > 0;

  // ─── 公共处理 ──────────────────────────────────────────────

  const handleAdd = () => {
    showToast({ type: "info", message: "功能开发中" });
  };

  const handleAccountTap = () => {
    showToast({ type: "info", message: "功能开发中" });
  };

  // ============================================================
  // 渲染
  // ============================================================

  return (
    <div>
      {/* ===== 导航条 44px ===== */}
      <div className="h-[44px] flex items-center px-[16px] mt-3">
        <button
          type="button"
          onClick={() => router.push("/accounting")}
          className="inline-flex items-center justify-center w-[44px] h-[44px] -ml-[4px]"
          aria-label="返回"
        >
          <ChevronLeft
            className="w-[28px] h-[28px]"
            style={{ color: "#000000", strokeWidth: 1.5 }}
          />
        </button>
        <div className="flex-1 flex items-center justify-center">
          <span
            className="text-[17px] font-semibold truncate"
            style={{ color: "#000000", wordBreak: "keep-all", overflowWrap: "break-word" }}
          >
            资产
          </span>
        </div>
        <button
          type="button"
          onClick={handleAdd}
          className="inline-flex items-center justify-center w-[44px] h-[44px] -mr-[4px]"
          aria-label="新增"
        >
          <Plus
            className="w-[24px] h-[24px]"
            style={{ color: "#000000", strokeWidth: 1.5 }}
          />
        </button>
      </div>

      {/* ===== 净资产卡 150px ===== */}
      <div className="mx-[16px] mt-[27px]">
        <div
          className="h-[150px] rounded-[24px] p-[20px]"
          style={{ background: "#FFFFFF", boxShadow: SHADOW_CARD }}
        >
          <p className="text-[13px] leading-none" style={{ color: MUTED }}>
            净资产
          </p>
          <p
            className="text-[34px] font-bold leading-none mt-[8px]"
            style={{ color: "#000000" }}
          >
            ¥{fmtCompact(netWorth)}
          </p>
          <div className="flex flex-row gap-[20px] mt-[58px]">
            <p
              className="text-[13px] leading-none truncate"
              style={{ color: MUTED, flex: 1, minWidth: 0 }}
            >
              总资产：¥{fmtCompact(totalAssets)}
            </p>
            <p
              className="text-[13px] leading-none truncate"
              style={{ color: MUTED, flex: 1, minWidth: 0 }}
            >
              总负债：¥{fmtCompact(totalLiabilities)}
            </p>
          </div>
        </div>
      </div>

      {/* ===== 账户列表卡 ===== */}
      {hasAccounts && (
        <div
          className="mx-[16px] mt-[16px] rounded-[16px] overflow-hidden"
          style={{ background: "#FFFFFF", boxShadow: SHADOW_CARD }}
        >
          {(accounts ?? []).map((acc, idx) => {
            return (
              <motion.button
                key={acc.id}
                type="button"
                onClick={handleAccountTap}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: idx * 0.03, duration: 0.25 }}
                className="flex items-center gap-3 px-4 h-[64px] w-full text-left"
                style={{
                  borderTop: idx === 0 ? "none" : "0.5px solid #E5E5EA",
                }}
              >
                <AccountIcon name={acc.name} />
                <span
                  className="flex-1 text-[15px] truncate"
                  style={{ color: "#000000" }}
                >
                  {acc.name}
                </span>
                <span
                  className="text-[16px] font-semibold shrink-0"
                  style={{ color: "#000000" }}
                >
                  ¥{fmtCompact(acc.balance)}
                </span>
              </motion.button>
            );
          })}
        </div>
      )}

      {/* ===== + 新增钱包账户 ===== */}
      <div
        className="flex justify-center"
        style={{ marginTop: hasAccounts ? 40 : 90 }}
      >
        <button
          type="button"
          onClick={handleAdd}
          className="inline-flex items-center justify-center text-[16px] font-normal whitespace-nowrap px-[4px] py-[2px]"
          style={{ color: BRAND }}
          aria-label="新增钱包账户"
        >
          + 新增钱包账户
        </button>
      </div>
    </div>
  );
}
