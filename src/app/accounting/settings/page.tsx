"use client";

import { useState } from "react";
import { motion } from "framer-motion";
import { Settings, BookOpen, DollarSign, Layers } from "lucide-react";

const stubLedgers = ["日常账本", "旅行基金"];
const currencies = ["CNY (￥)", "USD ($)", "EUR (€)", "JPY (¥)"];

const expenseCategories = [
  "餐饮", "购物", "交通", "居住", "娱乐", "医疗", "教育", "通讯", "其他",
];

export default function AccountingSettingsPage() {
  const [defaultLedger, setDefaultLedger] = useState("日常账本");
  const [currency, setCurrency] = useState("CNY (￥)");

  return (
    <div className="min-h-screen bg-[#F5F5F7] pb-24">
      <div className="max-w-2xl mx-auto px-5 pt-8">
        {/* Header */}
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-gray-900">记账设置</h1>
          <p className="text-sm text-gray-500 mt-0.5">管理你的财务偏好</p>
        </div>

        {/* Default Ledger */}
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-white rounded-2xl shadow-sm p-4 mb-4"
        >
          <div className="flex items-center gap-2 mb-3">
            <BookOpen className="w-4 h-4 text-gray-500" />
            <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide">默认账本</h2>
          </div>
          <div className="space-y-2">
            {stubLedgers.map((l) => (
              <button
                key={l}
                onClick={() => setDefaultLedger(l)}
                className={`w-full text-left px-3 py-2.5 rounded-xl text-sm font-medium transition-colors ${
                  defaultLedger === l
                    ? "bg-green-50 text-sys-green"
                    : "bg-gray-50 text-gray-700 hover:bg-gray-100"
                }`}
              >
                {l}
                {defaultLedger === l && <span className="float-right">✓</span>}
              </button>
            ))}
          </div>
        </motion.div>

        {/* Currency */}
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.06 }}
          className="bg-white rounded-2xl shadow-sm p-4 mb-4"
        >
          <div className="flex items-center gap-2 mb-3">
            <DollarSign className="w-4 h-4 text-gray-500" />
            <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide">货币</h2>
          </div>
          <div className="space-y-2">
            {currencies.map((c) => (
              <button
                key={c}
                onClick={() => setCurrency(c)}
                className={`w-full text-left px-3 py-2.5 rounded-xl text-sm font-medium transition-colors ${
                  currency === c
                    ? "bg-green-50 text-sys-green"
                    : "bg-gray-50 text-gray-700 hover:bg-gray-100"
                }`}
              >
                {c}
                {currency === c && <span className="float-right">✓</span>}
              </button>
            ))}
          </div>
        </motion.div>

        {/* Category Management */}
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.12 }}
          className="bg-white rounded-2xl shadow-sm p-4"
        >
          <div className="flex items-center gap-2 mb-3">
            <Layers className="w-4 h-4 text-gray-500" />
            <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide">支出分类</h2>
          </div>
          <div className="flex flex-wrap gap-2">
            {expenseCategories.map((cat) => (
              <span
                key={cat}
                className="px-3 py-1.5 rounded-full text-xs font-medium bg-gray-100 text-gray-600"
              >
                {cat}
              </span>
            ))}
          </div>
          <button className="text-sm text-sys-green font-medium mt-3 hover:text-green-600">
            + 添加分类
          </button>
        </motion.div>
      </div>
    </div>
  );
}
