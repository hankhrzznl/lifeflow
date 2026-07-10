"use client";

import Link from "next/link";
import { motion } from "framer-motion";
import { Moon, Droplets, Wallet, Dumbbell, ArrowRight } from "lucide-react";

const cards = [
  {
    title: "早睡分析",
    desc: "设定入睡目标 + 定时提醒 + 入睡趋势图表",
    icon: Moon,
    href: "/assistant/sleep",
    color: "from-indigo-500 to-violet-600",
    bg: "bg-indigo-50 dark:bg-indigo-900/20",
    iconColor: "text-indigo-500",
  },
  {
    title: "喝水提醒",
    desc: "定时推送提醒 · 通知内一键喝水",
    icon: Droplets,
    href: "/assistant/water",
    color: "from-blue-500 to-cyan-600",
    bg: "bg-blue-50 dark:bg-blue-900/20",
    iconColor: "text-blue-500",
  },
  {
    title: "记账",
    desc: "多账户 · 预算 · 报表 · 月度统计",
    icon: Wallet,
    href: "/plugins/finance",
    color: "from-emerald-500 to-teal-600",
    bg: "bg-emerald-50 dark:bg-emerald-900/20",
    iconColor: "text-emerald-500",
  },
  {
    title: "健身",
    desc: "力量训练记录 · 趋势图表 · 肌群管理",
    icon: Dumbbell,
    href: "/assistant/fitness",
    color: "from-orange-500 to-red-600",
    bg: "bg-orange-50 dark:bg-orange-900/20",
    iconColor: "text-orange-500",
  },
];

export default function AssistantPage() {
  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-50 to-white dark:from-gray-950 dark:to-gray-900 text-slate-900 dark:text-white">
      <div className="mx-auto max-w-5xl px-5 pt-8 pb-24 md:px-8 md:pt-10">
        <h1 className="text-xl font-bold text-gray-900 dark:text-white mb-1">助手</h1>
        <p className="text-sm text-gray-500 mb-6">生活辅助工具</p>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {cards.map((card, i) => (
            <Link key={card.title} href={card.href}>
              <motion.div
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.06 }}
                className="bg-white dark:bg-gray-900 border border-gray-100 dark:border-gray-800 rounded-2xl p-5
                  hover:shadow-md hover:border-gray-200 dark:hover:border-gray-700 transition-all group cursor-pointer"
              >
                <div className={`w-10 h-10 rounded-xl ${card.bg} flex items-center justify-center mb-3`}>
                  <card.icon className={`w-5 h-5 ${card.iconColor}`} strokeWidth={1.5} />
                </div>
                <h3 className="text-sm font-bold text-gray-900 dark:text-white mb-1">{card.title}</h3>
                <p className="text-xs text-gray-400 mb-3">{card.desc}</p>
                <div className="flex items-center gap-1 text-xs text-gray-400 group-hover:text-gray-600 dark:group-hover:text-gray-300 transition-colors">
                  <span>进入</span>
                  <ArrowRight className="w-3 h-3" />
                </div>
              </motion.div>
            </Link>
          ))}
        </div>
      </div>
    </div>
  );
}
