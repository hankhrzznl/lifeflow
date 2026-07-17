"use client";

import { useState } from "react";
import { motion } from "framer-motion";
import { CheckCircle2, Target, Zap, TrendingUp } from "lucide-react";

const periods = ["本周", "本月"];

const stubStats = {
  completionRate: 78,
  totalTasks: 42,
  streaks: 5,
  focusHours: 18.5,
};

const stubReviewItems = [
  { id: "1", title: "项目A里程碑完成", date: "07-15", type: "achievement", color: "text-sys-green" },
  { id: "2", title: "学习进度落后计划", date: "07-14", type: "warning", color: "text-sys-orange" },
  { id: "3", title: "本周专注时长提升20%", date: "07-13", type: "improvement", color: "text-sys-blue" },
  { id: "4", title: "会议时间过多需优化", date: "07-12", type: "note", color: "text-sys-gray" },
];

export default function ReviewPage() {
  const [period, setPeriod] = useState("本周");

  return (
    <div className="min-h-screen bg-[#F5F5F7] pb-24">
      <div className="max-w-2xl mx-auto px-5 pt-8">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">复盘</h1>
            <p className="text-sm text-gray-500 mt-0.5">回顾过去, 更好前行</p>
          </div>
        </div>

        {/* Period Selector */}
        <div className="flex gap-2 mb-6">
          {periods.map((p) => (
            <button
              key={p}
              onClick={() => setPeriod(p)}
              className={`px-5 py-2 rounded-full text-sm font-medium transition-colors ${
                period === p
                  ? "bg-indigo-500 text-white"
                  : "bg-white text-gray-600 border border-gray-200 hover:bg-gray-50"
              }`}
            >
              {p}
            </button>
          ))}
        </div>

        {/* Stats Grid */}
        <div className="grid grid-cols-2 gap-3 mb-6">
          {[
            { label: "完成率", value: `${stubStats.completionRate}%`, icon: CheckCircle2, color: "text-sys-green", bg: "bg-green-50" },
            { label: "总任务", value: stubStats.totalTasks, icon: Target, color: "text-sys-indigo", bg: "bg-indigo-50" },
            { label: "连续天数", value: `${stubStats.streaks}天`, icon: Zap, color: "text-sys-orange", bg: "bg-orange-50" },
            { label: "专注时长", value: `${stubStats.focusHours}h`, icon: TrendingUp, color: "text-sys-blue", bg: "bg-blue-50" },
          ].map((stat, i) => (
            <motion.div
              key={stat.label}
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.06 }}
              className="bg-white rounded-2xl shadow-sm p-4"
            >
              <div className={`w-9 h-9 rounded-xl ${stat.bg} flex items-center justify-center mb-2`}>
                <stat.icon className={`w-5 h-5 ${stat.color}`} />
              </div>
              <div className="text-xl font-bold text-gray-900">{stat.value}</div>
              <div className="text-xs text-gray-500">{stat.label}</div>
            </motion.div>
          ))}
        </div>

        {/* Review Items */}
        <div className="bg-white rounded-2xl shadow-sm p-4">
          <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-3">回顾记录</h2>
          <div className="space-y-3">
            {stubReviewItems.map((item, i) => (
              <motion.div
                key={item.id}
                initial={{ opacity: 0, x: -12 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.1 + i * 0.06 }}
                className="flex items-center gap-3 p-3 rounded-xl bg-gray-50"
              >
                <div className={`w-2 h-2 rounded-full ${item.color.replace("text", "bg")}`} />
                <div className="flex-1">
                  <div className="text-sm font-medium text-gray-900">{item.title}</div>
                  <div className="text-xs text-gray-400 mt-0.5">{item.date}</div>
                </div>
              </motion.div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
