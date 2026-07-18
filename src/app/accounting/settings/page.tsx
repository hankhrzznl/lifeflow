"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { useLiveQuery } from "dexie-react-hooks";
import { getAllTransactions, getDefaultLedger, clearAllAccountingData } from "@/lib/db/accounting.db";
import type { Transaction } from "@/lib/db/accounting.db";
import { showToast } from "@/components/ui/Toast";
import Dialog from "@/components/ui/Dialog";

// ============================================================
// 设计令牌（Apple 简约风）
// ============================================================
const ACCENT = "#5865F2";
const INK = "#1D1D1F";
const MUTED = "#86868B";
const CHEVRON = "#C7C7CC";
const DANGER = "#FF3B30";
const BORDER_CARD = "#EBEBEB";
const BORDER_HEADER = "#E6E6E6";
const TOGGLE_OFF = "#EBEBEB";
const SKELETON = "#F5F5F5";

// ─── 货币映射 ────────────────────────────────────────────────
const CURRENCY_DISPLAY: Record<string, string> = {
  CNY: "CNY (¥)",
  USD: "USD ($)",
  EUR: "EUR (€)",
  JPY: "JPY (¥)",
};

function getCurrencyDisplay(code: string): string {
  return CURRENCY_DISPLAY[code] || code;
}

// ============================================================
// iOS 开关
// ============================================================
function ToggleSwitch({
  checked,
  onChange,
  label,
}: {
  checked: boolean;
  onChange: () => void;
  label: string;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      onClick={onChange}
      className="relative shrink-0 rounded-full cursor-pointer"
      style={{
        width: 51,
        height: 31,
        background: checked ? ACCENT : TOGGLE_OFF,
        transition: "background 0.2s",
      }}
    >
      <div
        className="absolute rounded-full bg-white"
        style={{
          width: 27,
          height: 27,
          top: 2,
          left: checked ? 22 : 2,
          boxShadow: "0 1px 3px rgba(0,0,0,0.2)",
          transition: "left 0.2s",
        }}
      />
    </button>
  );
}

// ============================================================
// 页面
// ============================================================
export default function SettingsPage() {
  const router = useRouter();

  const [hideZeroOn, setHideZeroOn] = useState(false);
  const [weeklyOn, setWeeklyOn] = useState(true);
  const [showClearDialog, setShowClearDialog] = useState(false);

  const allTxs = useLiveQuery(() => getAllTransactions(), []);
  const defaultLedger = useLiveQuery(() => getDefaultLedger(), []);

  const loaded = allTxs !== undefined;

  // ─── 统计数据 ──────────────────────────────────────────────
  const { totalCount, uniqueDays } = useMemo(() => {
    if (!allTxs) return { totalCount: 0, uniqueDays: 0 };
    const days = new Set(allTxs.map((t: Transaction) => t.date));
    return { totalCount: allTxs.length, uniqueDays: days.size };
  }, [allTxs]);

  const ledgerName = defaultLedger?.name ?? "日常账本";

  // ─── 开关处理 ──────────────────────────────────────────────
  const toggleHideZero = () => {
    setHideZeroOn((p) => !p);
    showToast({ type: "info", message: "功能开发中" });
  };

  const toggleWeekly = () => {
    setWeeklyOn((p) => !p);
    showToast({ type: "info", message: "功能开发中" });
  };

  const toastDev = () => showToast({ type: "info", message: "功能开发中" });

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
  // 渲染
  // ============================================================
  return (
    <div className="min-h-screen bg-[#FAFAFA]">
      {/* ===== 页头 ===== */}
      <div
        className="h-[56px] flex items-center relative px-4"
        style={{ background: "#FFFFFF", borderBottom: `1px solid ${BORDER_HEADER}` }}
      >
        <button
          type="button"
          onClick={() => router.back()}
          className="w-11 h-11 -ml-1 flex items-center justify-center active:opacity-50"
          aria-label="返回"
        >
          <ChevronLeft className="w-6 h-6" style={{ color: INK }} />
        </button>
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
          <span className="text-[17px] font-semibold" style={{ color: INK }}>设置</span>
        </div>
        {/* 右侧占位保证标题居中 */}
        <div className="w-11 h-11" />
      </div>

      {/* ===== 统计双卡 ===== */}
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.25 }}
        className="px-4 mt-4 flex gap-3"
      >
        {/* 左卡：总交易 */}
        <div
          className="flex-1 h-[104px] rounded-[20px] border p-4 flex flex-col justify-between"
          style={{ background: "#FFFFFF", borderColor: BORDER_CARD }}
        >
          <span className="text-[13px]" style={{ color: MUTED }}>总交易</span>
          <div className="flex items-baseline gap-1">
            {loaded ? (
              <>
                <span className="text-[34px] font-bold leading-none" style={{ color: INK }}>
                  {totalCount.toLocaleString("zh-CN")}
                </span>
                <span className="text-[17px] font-semibold" style={{ color: INK }}>笔</span>
              </>
            ) : (
              <div className="h-[34px] w-[80px] rounded-md animate-pulse" style={{ background: SKELETON }} />
            )}
          </div>
        </div>
        {/* 右卡：记账天数 */}
        <div
          className="flex-1 h-[104px] rounded-[20px] border p-4 flex flex-col justify-between"
          style={{ background: "#FFFFFF", borderColor: BORDER_CARD }}
        >
          <span className="text-[13px]" style={{ color: MUTED }}>记账天数</span>
          <div className="flex items-baseline gap-1">
            {loaded ? (
              <>
                <span className="text-[34px] font-bold leading-none" style={{ color: INK }}>
                  {uniqueDays.toLocaleString("zh-CN")}
                </span>
                <span className="text-[17px] font-semibold" style={{ color: INK }}>天</span>
              </>
            ) : (
              <div className="h-[34px] w-[80px] rounded-md animate-pulse" style={{ background: SKELETON }} />
            )}
          </div>
        </div>
      </motion.div>

      {/* ===== 通用分组卡 ===== */}
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.25, delay: 0.05 }}
        className="mx-4 mt-4"
      >
        <div
          className="rounded-[20px] border overflow-hidden"
          style={{ background: "#FFFFFF", borderColor: BORDER_CARD }}
        >
          {/* 组标签 */}
          <div className="px-4 pt-4 pb-1">
            <span className="text-[13px]" style={{ color: MUTED }}>通用</span>
          </div>

          {/* 默认账本 */}
          <button type="button" onClick={toastDev} className="h-[56px] flex items-center justify-between px-4 w-full active:opacity-50">
            <span className="text-[17px]" style={{ color: INK }}>默认账本</span>
            <div className="flex items-center gap-1">
              <span className="text-[15px]" style={{ color: MUTED }}>{ledgerName}</span>
              <ChevronRight className="w-5 h-5" style={{ color: CHEVRON }} />
            </div>
          </button>

          <div style={{ borderTop: `0.5px solid ${BORDER_CARD}` }} />

          {/* 货币单位 */}
          <button type="button" onClick={toastDev} className="h-[56px] flex items-center justify-between px-4 w-full active:opacity-50">
            <span className="text-[17px]" style={{ color: INK }}>货币单位</span>
            <div className="flex items-center gap-1">
              <span className="text-[15px]" style={{ color: MUTED }}>
                {getCurrencyDisplay(defaultLedger?.currency ?? "CNY")}
              </span>
              <ChevronRight className="w-5 h-5" style={{ color: CHEVRON }} />
            </div>
          </button>

          <div style={{ borderTop: `0.5px solid ${BORDER_CARD}` }} />

          {/* 分类管理 */}
          <button type="button" onClick={toastDev} className="h-[56px] flex items-center justify-between px-4 w-full active:opacity-50">
            <span className="text-[17px]" style={{ color: INK }}>分类管理</span>
            <ChevronRight className="w-5 h-5" style={{ color: CHEVRON }} />
          </button>
        </div>
      </motion.div>

      {/* ===== 显示分组卡 ===== */}
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.25, delay: 0.1 }}
        className="mx-4 mt-4"
      >
        <div
          className="rounded-[20px] border overflow-hidden"
          style={{ background: "#FFFFFF", borderColor: BORDER_CARD }}
        >
          {/* 组标签 */}
          <div className="px-4 pt-4 pb-1">
            <span className="text-[13px]" style={{ color: MUTED }}>显示</span>
          </div>

          {/* 隐藏零交易分类 */}
          <button type="button" onClick={toggleHideZero} className="h-[56px] flex items-center justify-between px-4 w-full active:opacity-50">
            <span className="text-[17px]" style={{ color: INK }}>隐藏零交易分类</span>
            <ToggleSwitch checked={hideZeroOn} onChange={toggleHideZero} label="隐藏零交易分类" />
          </button>

          <div style={{ borderTop: `0.5px solid ${BORDER_CARD}` }} />

          {/* 按周统计 */}
          <button type="button" onClick={toggleWeekly} className="h-[56px] flex items-center justify-between px-4 w-full active:opacity-50">
            <span className="text-[17px]" style={{ color: INK }}>按周统计</span>
            <ToggleSwitch checked={weeklyOn} onChange={toggleWeekly} label="按周统计" />
          </button>
        </div>
      </motion.div>

      {/* ===== 数据分组卡 ===== */}
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.25, delay: 0.15 }}
        className="mx-4 mt-4"
      >
        <div
          className="rounded-[20px] border overflow-hidden"
          style={{ background: "#FFFFFF", borderColor: BORDER_CARD }}
        >
          {/* 组标签 */}
          <div className="px-4 pt-4 pb-1">
            <span className="text-[13px]" style={{ color: MUTED }}>数据</span>
          </div>

          {/* 导出数据 */}
          <button type="button" onClick={toastDev} className="h-[56px] flex items-center justify-between px-4 w-full active:opacity-50">
            <span className="text-[17px]" style={{ color: INK }}>导出数据</span>
            <ChevronRight className="w-5 h-5" style={{ color: CHEVRON }} />
          </button>

          <div style={{ borderTop: `0.5px solid ${BORDER_CARD}` }} />

          {/* 清除所有数据 */}
          <button
            type="button"
            onClick={() => setShowClearDialog(true)}
            className="h-[56px] flex items-center justify-between px-4 w-full active:opacity-50"
          >
            <span className="text-[17px]" style={{ color: DANGER }}>清除所有数据</span>
            <ChevronRight className="w-5 h-5" style={{ color: CHEVRON }} />
          </button>
        </div>
      </motion.div>

      {/* ===== 底部版本号 ===== */}
      <p className="text-center mt-8 text-[13px] pb-10" style={{ color: MUTED }}>
        LifeFlow v1.0.0
      </p>

      {/* ===== 清除确认弹窗 ===== */}
      <Dialog
        open={showClearDialog}
        onClose={() => setShowClearDialog(false)}
        type="confirm"
        variant="danger"
        title="清除所有数据"
        description="将删除全部账本、账户、交易记录与分类，此操作无法恢复。"
        confirmLabel="确认清除"
        onConfirm={handleClearData}
      />
    </div>
  );
}
