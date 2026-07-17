"use client";

import { useState } from "react";
import { motion } from "framer-motion";
import { Settings, Droplets, Moon, Dumbbell, ChevronLeft } from "lucide-react";
import Link from "next/link";

const waterGoalOptions = [1500, 2000, 2500, 3000];
const bedtimeOptions = ["22:00", "22:30", "23:00", "23:30", "00:00"];
const exerciseOptions = [
  { label: "轻度 (1-2次/周)", value: "light" },
  { label: "中度 (3-4次/周)", value: "moderate" },
  { label: "重度 (5+次/周)", value: "heavy" },
];

export default function HealthSettingsPage() {
  const [waterGoal, setWaterGoal] = useState(2000);
  const [bedtime, setBedtime] = useState("23:00");
  const [exercisePref, setExercisePref] = useState("moderate");

  return (
    <div className="min-h-screen bg-[#F5F5F7] pb-24">
      <div className="max-w-2xl mx-auto px-5 pt-8">
        {/* Header */}
        <div className="flex items-center gap-3 mb-6">
          <Link href="/health">
            <button className="w-9 h-9 rounded-full bg-white shadow-sm flex items-center justify-center">
              <ChevronLeft className="w-5 h-5 text-gray-500" />
            </button>
          </Link>
          <div>
            <h1 className="text-2xl font-bold text-gray-900">健康设置</h1>
            <p className="text-sm text-gray-500 mt-0.5">定制你的健康目标</p>
          </div>
        </div>

        {/* Daily Water Goal */}
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-white rounded-2xl shadow-sm p-4 mb-4"
        >
          <div className="flex items-center gap-2 mb-3">
            <Droplets className="w-4 h-4 text-sys-blue" />
            <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide">每日饮水目标</h2>
          </div>
          <div className="flex gap-2">
            {waterGoalOptions.map((opt) => (
              <button
                key={opt}
                onClick={() => setWaterGoal(opt)}
                className={`flex-1 py-2 rounded-xl text-sm font-medium transition-colors ${
                  waterGoal === opt
                    ? "bg-sys-blue text-white"
                    : "bg-gray-100 text-gray-600 hover:bg-gray-200"
                }`}
              >
                {opt}ml
              </button>
            ))}
          </div>
        </motion.div>

        {/* Bedtime Reminder */}
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.06 }}
          className="bg-white rounded-2xl shadow-sm p-4 mb-4"
        >
          <div className="flex items-center gap-2 mb-3">
            <Moon className="w-4 h-4 text-sys-indigo" />
            <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide">就寝提醒</h2>
          </div>
          <div className="flex gap-2 flex-wrap">
            {bedtimeOptions.map((opt) => (
              <button
                key={opt}
                onClick={() => setBedtime(opt)}
                className={`px-4 py-2 rounded-full text-sm font-medium transition-colors ${
                  bedtime === opt
                    ? "bg-sys-indigo text-white"
                    : "bg-gray-100 text-gray-600 hover:bg-gray-200"
                }`}
              >
                {opt}
              </button>
            ))}
          </div>
        </motion.div>

        {/* Exercise Preferences */}
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.12 }}
          className="bg-white rounded-2xl shadow-sm p-4"
        >
          <div className="flex items-center gap-2 mb-3">
            <Dumbbell className="w-4 h-4 text-sys-orange" />
            <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide">运动偏好</h2>
          </div>
          <div className="space-y-2">
            {exerciseOptions.map((opt) => (
              <button
                key={opt.value}
                onClick={() => setExercisePref(opt.value)}
                className={`w-full text-left px-3 py-2.5 rounded-xl text-sm font-medium transition-colors ${
                  exercisePref === opt.value
                    ? "bg-orange-50 text-sys-orange"
                    : "bg-gray-50 text-gray-700 hover:bg-gray-100"
                }`}
              >
                {opt.label}
                {exercisePref === opt.value && <span className="float-right">✓</span>}
              </button>
            ))}
          </div>
        </motion.div>
      </div>
    </div>
  );
}
