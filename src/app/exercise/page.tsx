"use client";

import { useRouter } from "next/navigation";
import MusclePage from "@/app/health/components/MusclePage";

export default function ExercisePage() {
  const router = useRouter();

  return (
    <div className="min-h-screen bg-gradient-to-b from-gray-900 to-gray-950 text-white">
      <div className="mx-auto max-w-5xl px-5 pt-8 pb-24 md:px-8 md:pt-10">
        <div className="mb-8">
          <button
            onClick={() => router.push("/health")}
            className="text-sm text-gray-400 hover:text-gray-200 transition-colors mb-3"
          >
            ← 返回健康中心
          </button>
          <h1 className="text-3xl md:text-4xl font-bold tracking-tight text-white">运动</h1>
          <p className="text-gray-400 mt-1">训练计划 · 动作记录</p>
        </div>

        <MusclePage />
      </div>
    </div>
  );
}
