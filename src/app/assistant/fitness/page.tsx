"use client";

import { ChevronLeft, Dumbbell } from "lucide-react";
import Link from "next/link";
import MusclePage from "@/app/health/components/MusclePage";

export default function FitnessPage() {
  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-50 to-white dark:from-gray-950 dark:to-gray-900 text-slate-900 dark:text-white">
      <div className="mx-auto max-w-5xl px-5 pt-8 pb-24 md:px-8 md:pt-10">
        <div className="flex items-center gap-2 mb-6">
          <Link href="/assistant" className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800">
            <ChevronLeft className="w-5 h-5 text-gray-400" />
          </Link>
          <div>
            <h1 className="text-xl font-bold text-gray-900 dark:text-white">健身</h1>
            <p className="text-xs text-gray-400">力量训练记录 · 趋势追踪</p>
          </div>
        </div>

        <MusclePage />
      </div>
    </div>
  );
}
