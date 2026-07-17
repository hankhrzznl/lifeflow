"use client";

import { motion } from "framer-motion";
import { Droplets, Moon, Dumbbell, TrendingUp, ChevronRight } from "lucide-react";
import Link from "next/link";

const todayData = {
  water: { current: 1200, goal: 2000 },
  sleep: { duration: "7h 25m", quality: 4, bedTime: "23:15", wakeTime: "06:40" },
  fitness: { exercises: 3, duration: "45分钟", calories: 320 },
};

export default function HealthPage() {
  const waterPercent = Math.round((todayData.water.current / todayData.water.goal) * 100);

  return (
    <div className="min-h-screen bg-[#F5F5F7] pb-24">
      <div className="max-w-2xl mx-auto px-5 pt-8">
        {/* Header */}
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-gray-900">健康</h1>
          <p className="text-sm text-gray-500 mt-0.5">今日健康概览</p>
        </div>

        {/* Quick Access */}
        <div className="grid grid-cols-3 gap-3 mb-6">
          {[
            { label: "饮水", path: "/health/water", icon: "💧" },
            { label: "睡眠", path: "/health/sleep", icon: "🌙" },
            { label: "健身", path: "/health/fitness", icon: "🏋️" },
          ].map((item) => (
            <Link key={item.path} href={item.path}>
              <motion.div
                whileTap={{ scale: 0.96 }}
                className="bg-white rounded-2xl shadow-sm p-4 text-center hover:shadow-md transition-shadow"
              >
                <div className="text-2xl mb-1">{item.icon}</div>
                <div className="text-sm font-medium text-gray-700">{item.label}</div>
              </motion.div>
            </Link>
          ))}
        </div>

        {/* Water Card */}
        <Link href="/health/water">
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            className="bg-white rounded-2xl shadow-sm p-4 mb-4 hover:shadow-md transition-shadow"
          >
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-xl bg-blue-50 flex items-center justify-center">
                  <Droplets className="w-4 h-4 text-sys-blue" />
                </div>
                <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide">饮水</h2>
              </div>
              <ChevronRight className="w-4 h-4 text-gray-300" />
            </div>
            <div className="flex items-center gap-5">
              {/* Progress Ring */}
              <div className="relative w-16 h-16 shrink-0">
                <svg viewBox="0 0 80 80" className="w-full h-full -rotate-90">
                  <circle cx="40" cy="40" r="34" fill="none" stroke="#F2F2F7" strokeWidth="6" />
                  <circle
                    cx="40"
                    cy="40"
                    r="34"
                    fill="none"
                    stroke="#007AFF"
                    strokeWidth="6"
                    strokeLinecap="round"
                    strokeDasharray={`${(waterPercent / 100) * 214} 214`}
                  />
                </svg>
                <div className="absolute inset-0 flex items-center justify-center">
                  <span className="text-xs font-bold text-sys-blue">{waterPercent}%</span>
                </div>
              </div>
              <div>
                <div className="text-lg font-bold text-gray-900">{todayData.water.current} / {todayData.water.goal} ml</div>
                <div className="text-xs text-gray-400 mt-0.5">还剩 {todayData.water.goal - todayData.water.current} ml</div>
              </div>
            </div>
          </motion.div>
        </Link>

        {/* Sleep Card */}
        <Link href="/health/sleep">
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.06 }}
            className="bg-white rounded-2xl shadow-sm p-4 mb-4 hover:shadow-md transition-shadow"
          >
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-xl bg-indigo-50 flex items-center justify-center">
                  <Moon className="w-4 h-4 text-sys-indigo" />
                </div>
                <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide">睡眠</h2>
              </div>
              <ChevronRight className="w-4 h-4 text-gray-300" />
            </div>
            <div className="flex items-center justify-between">
              <div>
                <div className="text-xl font-bold text-gray-900">{todayData.sleep.duration}</div>
                <div className="text-xs text-gray-400 mt-0.5">
                  {todayData.sleep.bedTime} → {todayData.sleep.wakeTime}
                </div>
              </div>
              <div className="flex gap-0.5">
                {Array.from({ length: 5 }).map((_, i) => (
                  <span key={i} className={`text-lg ${i < todayData.sleep.quality ? "text-sys-yellow" : "text-gray-200"}`}>★</span>
                ))}
              </div>
            </div>
          </motion.div>
        </Link>

        {/* Fitness Card */}
        <Link href="/health/fitness">
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.12 }}
            className="bg-white rounded-2xl shadow-sm p-4 hover:shadow-md transition-shadow"
          >
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-xl bg-orange-50 flex items-center justify-center">
                  <Dumbbell className="w-4 h-4 text-sys-orange" />
                </div>
                <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide">健身</h2>
              </div>
              <ChevronRight className="w-4 h-4 text-gray-300" />
            </div>
            <div className="flex items-center gap-6">
              <div className="text-center">
                <div className="text-xl font-bold text-gray-900">{todayData.fitness.exercises}</div>
                <div className="text-xs text-gray-400">组动作</div>
              </div>
              <div className="text-center">
                <div className="text-xl font-bold text-gray-900">{todayData.fitness.duration}</div>
                <div className="text-xs text-gray-400">时长</div>
              </div>
              <div className="text-center">
                <div className="text-xl font-bold text-gray-900">{todayData.fitness.calories}</div>
                <div className="text-xs text-gray-400">千卡</div>
              </div>
            </div>
          </motion.div>
        </Link>

        {/* Settings link */}
        <Link href="/health/settings">
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.18 }}
            className="mt-4 bg-white rounded-2xl shadow-sm p-4 hover:shadow-md transition-shadow"
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="text-lg">⚙️</span>
                <span className="text-sm font-medium text-gray-700">健康设置</span>
              </div>
              <ChevronRight className="w-4 h-4 text-gray-300" />
            </div>
          </motion.div>
        </Link>
      </div>
    </div>
  );
}
