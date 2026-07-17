"use client";

import { useState } from "react";
import { motion } from "framer-motion";
import { Plus, BookOpen, MoreHorizontal } from "lucide-react";

const stubLedgers = [
  { id: "1", name: "日常账本", currency: "CNY", symbol: "￥", transactionCount: 128, color: "bg-sys-green" },
  { id: "2", name: "旅行基金", currency: "CNY", symbol: "￥", transactionCount: 35, color: "bg-sys-blue" },
];

export default function LedgersPage() {
  return (
    <div className="min-h-screen bg-[#F5F5F7] pb-24">
      <div className="max-w-2xl mx-auto px-5 pt-8">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">账本管理</h1>
            <p className="text-sm text-gray-500 mt-0.5">管理你的多账本</p>
          </div>
        </div>

        {/* Ledger List */}
        <div className="space-y-3">
          {stubLedgers.map((ledger, i) => (
            <motion.div
              key={ledger.id}
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.08 + i * 0.06 }}
              className="bg-white rounded-2xl shadow-sm p-4 flex items-center gap-4"
            >
              <div className={`w-11 h-11 rounded-xl ${ledger.color.replace("bg-", "bg-")} flex items-center justify-center bg-opacity-20`}>
                <BookOpen className={`w-5 h-5 ${ledger.color.replace("bg-", "text-")}`} />
              </div>
              <div className="flex-1">
                <div className="text-sm font-semibold text-gray-900">{ledger.name}</div>
                <div className="text-xs text-gray-400 mt-0.5">
                  {ledger.symbol} · {ledger.currency} · {ledger.transactionCount} 笔交易
                </div>
              </div>
              <button className="text-gray-400 hover:text-gray-600">
                <MoreHorizontal className="w-5 h-5" />
              </button>
            </motion.div>
          ))}
        </div>

        {/* Add Ledger Button */}
        <motion.button
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.25 }}
          className="w-full mt-4 py-3 rounded-2xl border-2 border-dashed border-gray-300 text-gray-500 font-medium text-sm flex items-center justify-center gap-2 hover:border-sys-green hover:text-sys-green transition-colors"
        >
          <Plus className="w-4 h-4" />
          添加账本
        </motion.button>
      </div>
    </div>
  );
}
