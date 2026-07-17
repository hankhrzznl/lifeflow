"use client";

import { useState } from "react";
import { motion } from "framer-motion";
import { Plus, Wallet, CreditCard, PiggyBank, Building2 } from "lucide-react";

const iconMap: Record<string, React.ComponentType<{ className?: string }>> = {
  "wallet": Wallet,
  "card": CreditCard,
  "piggy": PiggyBank,
  "building": Building2,
};

const stubAccounts = [
  { id: "1", name: "现金", type: "wallet", balance: 2500.00, icon: "wallet" },
  { id: "2", name: "招商银行储蓄卡", type: "card", balance: 52680.50, icon: "card" },
  { id: "3", name: "支付宝余额宝", type: "piggy", balance: 15000.00, icon: "piggy" },
];

const totalNetWorth = stubAccounts.reduce((s, a) => s + a.balance, 0);

export default function AssetsPage() {
  return (
    <div className="min-h-screen bg-[#F5F5F7] pb-24">
      <div className="max-w-2xl mx-auto px-5 pt-8">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">资产管理</h1>
            <p className="text-sm text-gray-500 mt-0.5">你的净资产总览</p>
          </div>
        </div>

        {/* Net Worth Card */}
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-gradient-to-br from-sys-blue to-sys-indigo rounded-2xl shadow-md p-5 mb-6 text-white"
        >
          <div className="text-sm opacity-80 mb-1">净资产</div>
          <div className="text-3xl font-bold">￥{totalNetWorth.toLocaleString("zh-CN", { minimumFractionDigits: 2 })}</div>
          <div className="text-xs opacity-60 mt-2">{stubAccounts.length} 个账户</div>
        </motion.div>

        {/* Account List */}
        <div className="space-y-3">
          {stubAccounts.map((acc, i) => {
            const IconComp = iconMap[acc.icon] || Wallet;
            return (
              <motion.div
                key={acc.id}
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.08 + i * 0.06 }}
                className="bg-white rounded-2xl shadow-sm p-4 flex items-center gap-4"
              >
                <div className="w-11 h-11 rounded-xl bg-blue-50 flex items-center justify-center">
                  <IconComp className="w-5 h-5 text-sys-blue" />
                </div>
                <div className="flex-1">
                  <div className="text-sm font-semibold text-gray-900">{acc.name}</div>
                  <div className="text-xs text-gray-400 mt-0.5">{acc.type === "card" ? "借记卡" : acc.type === "piggy" ? "理财" : "现金"}</div>
                </div>
                <div className="text-right">
                  <div className="text-sm font-bold text-gray-900">￥{acc.balance.toLocaleString("zh-CN", { minimumFractionDigits: 2 })}</div>
                </div>
              </motion.div>
            );
          })}
        </div>

        {/* Add Account Button */}
        <motion.button
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
          className="w-full mt-4 py-3 rounded-2xl border-2 border-dashed border-gray-300 text-gray-500 font-medium text-sm flex items-center justify-center gap-2 hover:border-sys-blue hover:text-sys-blue transition-colors"
        >
          <Plus className="w-4 h-4" />
          添加账户
        </motion.button>
      </div>
    </div>
  );
}
