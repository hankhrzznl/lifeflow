"use client";

import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import {
  GraduationCap,
  Heart,
  Trees,
  LayoutGrid,
  Zap,
  Timer,
  BarChart3,
  Settings,
  ArrowRight,
} from "lucide-react";

const entrances = [
  {
    id: "learning",
    title: "学习",
    subtitle: "毕业 · 考公",
    icon: GraduationCap,
    from: "from-indigo-400",
    via: "via-violet-400",
    to: "to-purple-500",
    href: "/learning",
    tags: ["毕业", "考公"],
  },
  {
    id: "health",
    title: "健康",
    subtitle: "睡眠 · 体态 · 运动 · 追踪",
    icon: Heart,
    from: "from-emerald-400",
    via: "via-teal-400",
    to: "to-cyan-500",
    href: "/health",
    tags: ["睡眠", "体态", "运动", "追踪"],
  },
  {
    id: "growth",
    title: "长期主义",
    subtitle: "规划 · 习惯",
    icon: Trees,
    from: "from-rose-400",
    via: "via-pink-400",
    to: "to-fuchsia-500",
    href: "/growth",
    tags: ["规划", "习惯"],
  },
  {
    id: "overview",
    title: "全部",
    subtitle: "总览 · 所有模块",
    icon: LayoutGrid,
    from: "from-sky-400",
    via: "via-cyan-400",
    to: "to-blue-500",
    href: "/overview",
    tags: ["总览", "回顾"],
  },
];

const quickActions = [
  { id: "capture", label: "捕捉", icon: Zap, href: "/capture" },
  { id: "focus", label: "专注", icon: Timer, href: "/focus" },
  { id: "review", label: "回顾", icon: BarChart3, href: "/review" },
  { id: "settings", label: "设置", icon: Settings, href: "/settings" },
];

export default function HomePage() {
  const router = useRouter();

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-50 to-white text-slate-900">
      <div className="mx-auto max-w-5xl px-5 pt-8 pb-24 md:px-8 md:pt-10">
        {/* Header */}
        <div className="flex items-start justify-between gap-4 mb-10 md:mb-12">
          <div>
            <h1 className="text-3xl md:text-4xl font-bold tracking-tight text-slate-900">
              LifeFlow
            </h1>
          </div>

          {/* 右上 4 个小按钮 */}
          <div className="flex items-center gap-2 md:gap-3">
            {quickActions.map((action) => (
              <motion.button
                key={action.id}
                whileTap={{ scale: 0.92 }}
                onClick={() => router.push(action.href)}
                className="w-10 h-10 md:w-11 md:h-11 rounded-2xl bg-white border border-slate-200 shadow-sm flex items-center justify-center text-slate-600 hover:text-slate-900 hover:border-slate-300 transition-colors"
                aria-label={action.label}
              >
                <action.icon className="w-5 h-5" strokeWidth={1.6} />
              </motion.button>
            ))}
          </div>
        </div>

        {/* 4 张大卡片：移动端 1x4，桌面端 2x2 */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-5 md:gap-6">
          {entrances.map((card, index) => (
            <motion.button
              key={card.id}
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: index * 0.08, duration: 0.4, ease: "easeOut" }}
              whileTap={{ scale: 0.98 }}
              onClick={() => router.push(card.href)}
              className={`group relative overflow-hidden rounded-3xl bg-gradient-to-br ${card.from} ${card.via} ${card.to} p-6 md:p-7 text-left text-white shadow-lg shadow-slate-200/60 min-h-[200px] md:min-h-[240px] flex flex-col`}
            >
              {/* 右上角装饰光晕 */}
              <div className="absolute -top-12 -right-12 w-44 h-44 rounded-full bg-white/15 blur-2xl pointer-events-none" />
              <div className="absolute top-0 right-0 w-32 h-32 bg-gradient-to-bl from-white/20 to-transparent rounded-bl-full pointer-events-none" />

              <div className="relative z-10 flex flex-col h-full">
                {/* 图标方块 */}
                <div className="w-12 h-12 md:w-14 md:h-14 rounded-2xl bg-white/25 backdrop-blur-sm flex items-center justify-center mb-5">
                  <card.icon className="w-6 h-6 md:w-7 md:h-7 text-white" strokeWidth={1.8} />
                </div>

                <h2 className="text-2xl md:text-3xl font-bold mb-1.5">{card.title}</h2>
                <p className="text-white/80 text-sm md:text-base mb-4">{card.subtitle}</p>

                {/* 标签 */}
                <div className="flex flex-wrap gap-2 mb-5">
                  {card.tags.map((tag) => (
                    <span
                      key={tag}
                      className="px-3 py-1 rounded-full text-xs font-medium bg-white/20 backdrop-blur-sm border border-white/20"
                    >
                      {tag}
                    </span>
                  ))}
                </div>

                {/* 进入 */}
                <div className="mt-auto flex items-center gap-1.5 text-sm font-medium text-white/90 group-hover:translate-x-1 transition-transform">
                  <span>进入</span>
                  <ArrowRight className="w-4 h-4" strokeWidth={2} />
                </div>
              </div>
            </motion.button>
          ))}
        </div>

        {/* 底部提示 */}
        <p className="mt-10 text-center text-sm text-slate-400">
          选择一个中心，开始管理你的生活
        </p>
      </div>
    </div>
  );
}
