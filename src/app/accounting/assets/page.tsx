"use client";

import { useMemo } from "react";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import { ChevronLeft, Plus, TrendingUp, TrendingDown } from "lucide-react";
import { useLiveQuery } from "dexie-react-hooks";
import { getAllAccounts, getTransactionsByMonth } from "@/lib/db/accounting.db";
import type { Account } from "@/lib/db/accounting.db";
import { showToast } from "@/components/ui/Toast";

// ============================================================
// 设计令牌（Apple 简约风）
// ============================================================
const ACCENT = "#5865F2";
const TEXT_PRIMARY = "#1D1D1F";
const TEXT_SECONDARY = "#86868B";
const TEXT_TERTIARY = "#AEAEB2";
const BORDER_CARD = "#E5E5E5";
const BORDER_DIVIDER = "#F5F5F5";
const BADGE_BG = "#EEF2FF";

// ─── 格式化（¥ + 空格 + 两位小数） ────────────────────────────
function fmt(fen: number): string {
  const absFen = Math.abs(fen);
  const yuan = absFen / 100;
  const formatted = yuan.toLocaleString("zh-CN", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
  return fen < 0 ? `-¥ ${formatted}` : `¥ ${formatted}`;
}

// ─── 账户图标映射（颜色沿用旧实现，形态改首字符方块） ────────
const ACCOUNT_COLOR_MAP: Record<string, string> = {
  "微信钱包": "#34C759",
  "支付宝": "#007AFF",
  "银行卡": "#5856D6",
  "现金": "#FF9500",
};

function getAccountColor(name: string): string {
  return ACCOUNT_COLOR_MAP[name] || "#86868B";
}

function getAccountFirstChar(name: string): string {
  return name.trim().charAt(0) || "钱";
}

function getAccountTypeLabel(type: string): string {
  return type === "liability" ? "负债账户" : "资产账户";
}

// ============================================================
// 页面
// ============================================================
export default function AssetsPage() {
  const router = useRouter();

  const accounts = useLiveQuery(() => getAllAccounts(), [], [] as Account[]);

  // 本月交易（较上月徽标用）
  const now = new Date();
  const monthTxs = useLiveQuery(
    () => getTransactionsByMonth(now.getFullYear(), now.getMonth() + 1),
    [],
    []
  );

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

  // ─── 较上月（本月净收支） ──────────────────────────────────
  const monthNetFlow = useMemo(() => {
    let income = 0;
    let expense = 0;
    for (const t of monthTxs ?? []) {
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
    <div className="bg-white min-h-screen">
      {/* ===== 顶部导航条 44px ===== */}
      <div className="h-[44px] flex items-center px-4 mt-3">
        <button
          type="button"
          onClick={() => router.push("/accounting")}
          className="inline-flex items-center justify-center w-[44px] h-[44px] -ml-1"
          aria-label="返回"
        >
          <ChevronLeft className="w-[28px] h-[28px]" style={{ color: TEXT_PRIMARY }} />
        </button>
        <div className="flex-1 flex items-center justify-center">
          <span className="text-[17px] font-semibold" style={{ color: TEXT_PRIMARY }}>
            资产
          </span>
        </div>
        <button
          type="button"
          onClick={handleAdd}
          className="inline-flex items-center justify-center w-[44px] h-[44px] -mr-1"
          aria-label="新增"
        >
          <Plus className="w-[24px] h-[24px]" style={{ color: ACCENT }} />
        </button>
      </div>

      {/* ===== 净资产卡 ===== */}
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.25 }}
        className="mx-4 mt-[20px]"
      >
        <div
          className="rounded-[24px] border p-[24px] flex flex-col items-center"
          style={{ background: "#FFFFFF", borderColor: BORDER_CARD }}
        >
          <span className="text-[13px]" style={{ color: TEXT_SECONDARY }}>净资产</span>
          <span
            className="text-[34px] font-bold leading-none mt-[8px]"
            style={{ color: TEXT_PRIMARY }}
          >
            {fmt(netWorth)}
          </span>
          <div
            className="mt-[16px] h-[32px] px-4 rounded-full flex items-center justify-center gap-1"
            style={{ background: BADGE_BG }}
          >
            {isFlowPositive && <TrendingUp className="w-[16px] h-[16px]" style={{ color: ACCENT }} />}
            {isFlowNegative && <TrendingDown className="w-[16px] h-[16px]" style={{ color: ACCENT }} />}
            <span className="text-[14px] font-medium" style={{ color: ACCENT }}>
              {flowLabel}
            </span>
          </div>
        </div>
      </motion.div>

      {/* ===== 空态提示 ===== */}
      {!hasAccounts && (
        <div className="py-[24px] text-center">
          <span className="text-[13px]" style={{ color: TEXT_TERTIARY }}>
            暂无账户，点击下方添加
          </span>
        </div>
      )}

      {/* ===== 账户列表卡 ===== */}
      {hasAccounts && (
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.25, delay: 0.05 }}
          className="mx-4 mt-[16px]"
        >
          <div
            className="rounded-[16px] border overflow-hidden"
            style={{ background: "#FFFFFF", borderColor: BORDER_CARD }}
          >
            {/* 卡头 */}
            <div
              className="px-[20px] h-[56px] flex items-center justify-between"
              style={{ borderBottom: `0.5px solid ${BORDER_DIVIDER}` }}
            >
              <span className="text-[17px] font-semibold" style={{ color: TEXT_PRIMARY }}>
                账户
              </span>
              <span className="text-[13px]" style={{ color: TEXT_SECONDARY }}>
                共 {accounts!.length} 个账户
              </span>
            </div>

            {/* 账户行 */}
            {accounts!.map((acc) => {
              const color = getAccountColor(acc.name);
              const firstChar = getAccountFirstChar(acc.name);
              const isLiability = acc.type === "liability";
              const displayAmount = isLiability
                ? `-${fmt(Math.abs(acc.balance))}`
                : fmt(acc.balance);

              return (
                <motion.button
                  key={acc.id}
                  type="button"
                  onClick={handleAccountTap}
                  whileTap={{ scale: 0.98 }}
                  className="flex items-center gap-[12px] px-[20px] h-[72px] w-full text-left"
                  style={{ borderBottom: `0.5px solid ${BORDER_DIVIDER}` }}
                >
                  {/* 图标：彩色圆角方块 + 首字符 */}
                  <div
                    className="w-[44px] h-[44px] rounded-[12px] flex items-center justify-center shrink-0"
                    style={{ background: color }}
                  >
                    <span className="text-[17px] font-semibold" style={{ color: "#FFFFFF" }}>
                      {firstChar}
                    </span>
                  </div>

                  {/* 中部：名称 + 类型 */}
                  <div className="flex-1 min-w-0 flex flex-col gap-0.5">
                    <span
                      className="text-[17px] font-semibold truncate"
                      style={{ color: TEXT_PRIMARY }}
                    >
                      {acc.name}
                    </span>
                    <span className="text-[13px]" style={{ color: TEXT_SECONDARY }}>
                      {getAccountTypeLabel(acc.type)}
                    </span>
                  </div>

                  {/* 右侧金额 */}
                  <span
                    className="text-[17px] font-semibold shrink-0"
                    style={{ color: TEXT_PRIMARY }}
                  >
                    {displayAmount}
                  </span>
                </motion.button>
              );
            })}

            {/* 卡底汇总行 */}
            <div
              className="px-[20px] py-[16px] flex justify-between"
              style={{ borderTop: `0.5px solid ${BORDER_DIVIDER}` }}
            >
              <div className="flex flex-col gap-1 items-start">
                <span className="text-[13px]" style={{ color: TEXT_SECONDARY }}>总资产</span>
                <span className="text-[17px] font-bold" style={{ color: TEXT_PRIMARY }}>
                  {fmt(totalAssets)}
                </span>
              </div>
              <div className="flex flex-col gap-1 items-end">
                <span className="text-[13px]" style={{ color: TEXT_SECONDARY }}>总负债</span>
                <span className="text-[17px] font-bold" style={{ color: TEXT_PRIMARY }}>
                  -{fmt(Math.abs(totalLiabilities))}
                </span>
              </div>
            </div>
          </div>
        </motion.div>
      )}

      {/* ===== 添加账户（虚线按钮） ===== */}
      <div className="mx-4 mt-[16px] mb-[24px]">
        <motion.button
          type="button"
          onClick={handleAdd}
          whileTap={{ scale: 0.98 }}
          className="h-[56px] rounded-[16px] w-full flex items-center justify-center gap-1"
          style={{
            background: "#FFFFFF",
            border: `1.5px dashed ${BORDER_CARD}`,
          }}
        >
          <Plus className="w-[16px] h-[16px]" style={{ color: TEXT_SECONDARY }} />
          <span className="text-[15px]" style={{ color: TEXT_SECONDARY }}>添加账户</span>
        </motion.button>
      </div>
    </div>
  );
}
