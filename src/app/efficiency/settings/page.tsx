"use client";

import { useState } from "react";
import { motion } from "framer-motion";
import { Settings, Layers, Layout, Download, Upload, Trash2 } from "lucide-react";

const stubCategories = [
  { id: "1", name: "工作", color: "bg-sys-blue" },
  { id: "2", name: "学习", color: "bg-sys-indigo" },
  { id: "3", name: "健康", color: "bg-sys-green" },
  { id: "4", name: "个人", color: "bg-sys-orange" },
];

const viewOptions = ["列表", "看板", "日历"];

export default function EfficiencySettingsPage() {
  const [defaultView, setDefaultView] = useState("列表");

  return (
    <div className="min-h-screen bg-[#F5F5F7] pb-24">
      <div className="max-w-2xl mx-auto px-5 pt-8">
        {/* Header */}
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-gray-900">效率设置</h1>
          <p className="text-sm text-gray-500 mt-0.5">自定义你的效率工作台</p>
        </div>

        {/* Categories Management */}
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-white rounded-2xl shadow-sm p-4 mb-4"
        >
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide">分类管理</h2>
            <button className="text-sm text-indigo-500 font-medium hover:text-indigo-600">+ 添加</button>
          </div>
          <div className="space-y-2">
            {stubCategories.map((cat) => (
              <div key={cat.id} className="flex items-center justify-between py-2 px-3 rounded-xl bg-gray-50">
                <div className="flex items-center gap-3">
                  <div className={`w-3 h-3 rounded-full ${cat.color}`} />
                  <span className="text-sm font-medium text-gray-700">{cat.name}</span>
                </div>
                <button className="text-gray-400 hover:text-sys-red transition-colors">
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            ))}
          </div>
        </motion.div>

        {/* Default View */}
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.06 }}
          className="bg-white rounded-2xl shadow-sm p-4 mb-4"
        >
          <div className="flex items-center gap-2 mb-3">
            <Layout className="w-4 h-4 text-gray-500" />
            <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide">默认视图</h2>
          </div>
          <div className="flex gap-2">
            {viewOptions.map((opt) => (
              <button
                key={opt}
                onClick={() => setDefaultView(opt)}
                className={`flex-1 py-2 rounded-xl text-sm font-medium transition-colors ${
                  defaultView === opt
                    ? "bg-indigo-500 text-white"
                    : "bg-gray-100 text-gray-600 hover:bg-gray-200"
                }`}
              >
                {opt}
              </button>
            ))}
          </div>
        </motion.div>

        {/* Data Management */}
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.12 }}
          className="bg-white rounded-2xl shadow-sm p-4"
        >
          <div className="flex items-center gap-2 mb-3">
            <Layers className="w-4 h-4 text-gray-500" />
            <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide">数据管理</h2>
          </div>
          <div className="space-y-2">
            <button className="w-full flex items-center gap-3 py-3 px-3 rounded-xl bg-gray-50 hover:bg-gray-100 transition-colors">
              <Download className="w-4 h-4 text-sys-green" />
              <span className="text-sm font-medium text-gray-700">导出数据</span>
            </button>
            <button className="w-full flex items-center gap-3 py-3 px-3 rounded-xl bg-gray-50 hover:bg-gray-100 transition-colors">
              <Upload className="w-4 h-4 text-sys-blue" />
              <span className="text-sm font-medium text-gray-700">导入数据</span>
            </button>
          </div>
        </motion.div>
      </div>
    </div>
  );
}
