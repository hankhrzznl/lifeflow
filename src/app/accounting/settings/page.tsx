"use client";

import { useState, useMemo } from "react";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import {
  ChevronLeft, Crown, X, Lock, Bell, Coins, Cloud, HardDrive,
  ChevronRight, Paintbrush, Image, LayoutGrid, Table, Download,
  CircleDollarSign, MessageCircle,
} from "lucide-react";
import { useLiveQuery } from "dexie-react-hooks";
import { getAllTransactions } from "@/lib/db/accounting.db";
import type { Transaction } from "@/lib/db/accounting.db";
import { showToast } from "@/components/ui/Toast";

// ============================================================
// 设计稿基准: lifeflow-accounting/pages/settings.html
// ============================================================

const BRAND = "#34C759";
const EXPENSE = "#FF3B30";
const INCOME = "#007AFF";
const MUTED = "#8E8E93";
const DISABLED = "#C7C7CC";
const BORDER = "#E5E5EA";
const BG = "#F2F2F7";
const SHADOW_CARD = "0 4px 16px rgba(0,0,0,0.08)";

// ─── 格式化 ──────────────────────────────────────────────────

function fmtCompact(fen: number): string {
  const yuan = fen / 100;
  return yuan.toLocaleString("zh-CN", {
    minimumFractionDigits: fen % 100 === 0 ? 0 : 2,
    maximumFractionDigits: 2,
  });
}

// ─── iOS 开关组件 ────────────────────────────────────────────

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
      className="relative flex-shrink-0 rounded-full cursor-pointer"
      style={{
        width: 51,
        height: 31,
        background: checked ? BRAND : BORDER,
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

// ─── 分隔线 ──────────────────────────────────────────────────

function RowDivider() {
  return (
    <div
      style={{ borderTop: "0.5px solid #E5E5EA", marginLeft: 56 }}
    />
  );
}

// ============================================================
// 页面
// ============================================================

export default function SettingsPage() {
  const router = useRouter();

  const [showBanner, setShowBanner] = useState(true);
  const [passwordOn, setPasswordOn] = useState(false);
  const [reminderOn, setReminderOn] = useState(false);

  const allTxs = useLiveQuery(() => getAllTransactions(), [], [] as Transaction[]);

  const { totalExpense, totalIncome, balance, totalCount } = useMemo(() => {
    let exp = 0;
    let inc = 0;
    for (const t of allTxs ?? []) {
      if (t.type === "expense") exp += t.amount;
      else inc += t.amount;
    }
    return { totalExpense: exp, totalIncome: inc, balance: inc - exp, totalCount: (allTxs ?? []).length };
  }, [allTxs]);

  const toastDev = () => showToast({ type: "info", message: "功能开发中" });

  const togglePassword = () => {
    setPasswordOn((p) => !p);
    showToast({ type: "info", message: "功能开发中" });
  };

  const toggleReminder = () => {
    setReminderOn((p) => !p);
    showToast({ type: "info", message: "功能开发中" });
  };

  // ════════════════════════════════════════════════════════════

  return (
    <div style={{ background: BG, minHeight: "100vh" }}>
      <div className="mx-auto" style={{ maxWidth: 430 }}>
        {/* ===== 1. 导航条 52px ===== */}
        <div className="h-[52px] flex items-center px-4">
          <button
            type="button"
            onClick={() => router.back()}
            className="flex items-center justify-center w-11 h-11 -ml-1"
            aria-label="返回"
          >
            <ChevronLeft className="w-6 h-6" style={{ color: "#000000" }} />
          </button>
          <div className="flex-1 text-center text-[17px] font-semibold" style={{ color: "#000000" }}>
            设置
          </div>
          <div
            className="w-[36px] h-[36px] rounded-full flex items-center justify-center"
            style={{ backgroundColor: BG }}
          />
        </div>

        {/* ===== 2. 会员横幅 48px ===== */}
        {showBanner && (
          <div
            className="h-[48px] flex items-center px-4 cursor-pointer"
            style={{ background: "linear-gradient(90deg, #F5D76E 0%, #F8C471 100%)" }}
            onClick={toastDev}
          >
            <Crown className="w-5 h-5 flex-shrink-0" style={{ color: "#000000" }} />
            <span className="ml-2 text-[15px] font-semibold whitespace-nowrap" style={{ color: "#000000" }}>
              永久会员 限时折扣
            </span>
            <div className="flex-1 min-w-0" />
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                setShowBanner(false);
              }}
              className="inline-flex items-center justify-center w-5 h-5 flex-shrink-0"
              aria-label="关闭"
            >
              <X className="w-5 h-5" style={{ color: "#000000" }} />
            </button>
          </div>
        )}

        {/* ===== 3. 统计双卡 80px ===== */}
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.25 }}
          className="px-4 mt-3 flex gap-3"
        >
          {/* 左卡 */}
          <div
            className="flex-1 h-[80px] rounded-[16px] flex items-center"
            style={{ background: "#FFFFFF", boxShadow: SHADOW_CARD }}
          >
            <div className="w-full px-4 flex justify-between items-center">
              <div className="flex flex-col items-start">
                <span className="text-[13px]" style={{ color: MUTED }}>总支出</span>
                <span className="text-[20px] font-bold mt-0.5" style={{ color: EXPENSE }}>
                  ¥{fmtCompact(totalExpense)}
                </span>
              </div>
              <div className="flex flex-col items-start">
                <span className="text-[13px]" style={{ color: MUTED }}>总收入</span>
                <span className="text-[20px] font-bold mt-0.5" style={{ color: INCOME }}>
                  ¥{fmtCompact(totalIncome)}
                </span>
              </div>
            </div>
          </div>
          {/* 右卡 */}
          <div
            className="flex-1 h-[80px] rounded-[16px] flex items-center"
            style={{ background: "#FFFFFF", boxShadow: SHADOW_CARD }}
          >
            <div className="w-full px-4">
              <div className="flex items-baseline gap-1">
                <span className="text-[13px]" style={{ color: MUTED }}>结余：</span>
                <span className="text-[20px] font-bold" style={{ color: "#000000" }}>
                  ¥{fmtCompact(balance)}
                </span>
              </div>
              <div className="text-[13px] mt-2" style={{ color: MUTED }}>
                总记账次数：{totalCount}
              </div>
            </div>
          </div>
        </motion.div>

        {/* ===== 4. 设置分组 1 ===== */}
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.05, duration: 0.25 }}
          className="mx-4 mt-4 rounded-[16px] overflow-hidden"
          style={{ background: "#FFFFFF", boxShadow: SHADOW_CARD }}
        >
          {/* 密码 */}
          <div className="h-[56px] flex items-center px-4">
            <Lock className="w-6 h-6 flex-shrink-0" style={{ color: "#000000" }} />
            <span className="ml-4 flex-1 min-w-0 text-[17px] truncate" style={{ color: "#000000" }}>
              密码
            </span>
            <ToggleSwitch checked={passwordOn} onChange={togglePassword} label="密码" />
          </div>
          <RowDivider />
          {/* 每日提醒 */}
          <div className="h-[56px] flex items-center px-4">
            <Bell className="w-6 h-6 flex-shrink-0" style={{ color: "#000000" }} />
            <span className="ml-4 flex-1 min-w-0 text-[17px] truncate" style={{ color: "#000000" }}>
              每日提醒
            </span>
            <ToggleSwitch checked={reminderOn} onChange={toggleReminder} label="每日提醒" />
          </div>
          <RowDivider />
          {/* 我的黄金 */}
          <button type="button" onClick={toastDev} className="h-[56px] flex items-center px-4 w-full active:opacity-50">
            <Coins className="w-6 h-6 flex-shrink-0" style={{ color: "#000000" }} />
            <span className="ml-4 flex-1 min-w-0 text-[17px] truncate text-left" style={{ color: "#000000" }}>
              我的黄金
            </span>
            <ChevronRight className="w-5 h-5 flex-shrink-0" style={{ color: MUTED }} />
          </button>
          <RowDivider />
          {/* iCloud */}
          <button type="button" onClick={toastDev} className="h-[56px] flex items-center px-4 w-full active:opacity-50">
            <Cloud className="w-6 h-6 flex-shrink-0" style={{ color: "#000000" }} />
            <span className="ml-4 text-[17px] truncate flex-shrink-0" style={{ color: "#000000" }}>
              iCloud
            </span>
            <div className="flex-1 min-w-0" />
            <span className="text-[13px] flex-shrink-0" style={{ color: MUTED }}>遇到问题</span>
            <ChevronRight className="w-5 h-5 flex-shrink-0 ml-1" style={{ color: MUTED }} />
          </button>
          <RowDivider />
          {/* 数据备份和恢复 */}
          <button type="button" onClick={toastDev} className="h-[56px] flex items-center px-4 w-full active:opacity-50">
            <HardDrive className="w-6 h-6 flex-shrink-0" style={{ color: "#000000" }} />
            <span className="ml-4 flex-1 min-w-0 text-[17px] truncate text-left" style={{ color: "#000000" }}>
              数据备份和恢复
            </span>
            <ChevronRight className="w-5 h-5 flex-shrink-0" style={{ color: MUTED }} />
          </button>
        </motion.div>

        {/* ===== 5. 设置分组 2 ===== */}
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1, duration: 0.25 }}
          className="mx-4 mt-4 rounded-[16px] overflow-hidden"
          style={{ background: "#FFFFFF", boxShadow: SHADOW_CARD }}
        >
          {/* 偏好设置 */}
          <button type="button" onClick={toastDev} className="h-[56px] flex items-center px-4 w-full active:opacity-50">
            <Paintbrush className="w-6 h-6 flex-shrink-0" style={{ color: "#000000" }} />
            <span className="ml-4 flex-1 min-w-0 text-[17px] truncate text-left" style={{ color: "#000000" }}>
              偏好设置
            </span>
            <ChevronRight className="w-5 h-5 flex-shrink-0" style={{ color: MUTED }} />
          </button>
          <RowDivider />
          {/* 背景样式 */}
          <button type="button" onClick={toastDev} className="h-[56px] flex items-center px-4 w-full active:opacity-50">
            <Image className="w-6 h-6 flex-shrink-0" style={{ color: "#000000" }} />
            <span className="ml-4 flex-1 min-w-0 text-[17px] truncate text-left" style={{ color: "#000000" }}>
              背景样式
            </span>
            <ChevronRight className="w-5 h-5 flex-shrink-0" style={{ color: MUTED }} />
          </button>
          <RowDivider />
          {/* 桌面小组件 */}
          <button type="button" onClick={toastDev} className="h-[56px] flex items-center px-4 w-full active:opacity-50">
            <LayoutGrid className="w-6 h-6 flex-shrink-0" style={{ color: "#000000" }} />
            <span className="ml-4 flex-1 min-w-0 text-[17px] truncate text-left" style={{ color: "#000000" }}>
              桌面小组件
            </span>
            <ChevronRight className="w-5 h-5 flex-shrink-0" style={{ color: MUTED }} />
          </button>
          <RowDivider />
          {/* 导出 CSV */}
          <button type="button" onClick={toastDev} className="h-[56px] flex items-center px-4 w-full active:opacity-50">
            <Table className="w-6 h-6 flex-shrink-0" style={{ color: "#000000" }} />
            <span className="ml-4 flex-1 min-w-0 text-[17px] truncate text-left" style={{ color: "#000000" }}>
              导出 CSV
            </span>
            <ChevronRight className="w-5 h-5 flex-shrink-0" style={{ color: MUTED }} />
          </button>
          <RowDivider />
          {/* 导入账单 */}
          <button type="button" onClick={toastDev} className="h-[56px] flex items-center px-4 w-full active:opacity-50">
            <Download className="w-6 h-6 flex-shrink-0" style={{ color: "#000000" }} />
            <span className="ml-4 flex-1 min-w-0 text-[17px] truncate text-left" style={{ color: "#000000" }}>
              导入账单
            </span>
            <ChevronRight className="w-5 h-5 flex-shrink-0" style={{ color: MUTED }} />
          </button>
          <RowDivider />
          {/* 默认货币 */}
          <button type="button" onClick={toastDev} className="h-[56px] flex items-center px-4 w-full active:opacity-50">
            <CircleDollarSign className="w-6 h-6 flex-shrink-0" style={{ color: "#000000" }} />
            <span className="ml-4 flex-1 min-w-0 text-[17px] truncate text-left" style={{ color: "#000000" }}>
              默认货币
            </span>
            <span className="text-[17px] flex-shrink-0" style={{ color: MUTED }}>¥</span>
            <ChevronRight className="w-5 h-5 flex-shrink-0 ml-1" style={{ color: MUTED }} />
          </button>
        </motion.div>

        {/* ===== 6. 设置分组 3 ===== */}
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.15, duration: 0.25 }}
          className="mx-4 mt-4 rounded-[16px] overflow-hidden"
          style={{ background: "#FFFFFF", boxShadow: SHADOW_CARD }}
        >
          <button type="button" onClick={toastDev} className="h-[56px] flex items-center px-4 w-full active:opacity-50">
            <MessageCircle className="w-6 h-6 flex-shrink-0" style={{ color: "#000000" }} />
            <span className="ml-4 flex-1 min-w-0 text-[17px] truncate text-left" style={{ color: "#000000" }}>
              交换意见（关注私信）
            </span>
            <ChevronRight className="w-5 h-5 flex-shrink-0" style={{ color: MUTED }} />
          </button>
        </motion.div>

        {/* ===== 底部留白 ===== */}
        <div className="h-[34px]" />
      </div>
    </div>
  );
}
