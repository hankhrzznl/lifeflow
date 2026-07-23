"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import { ChevronLeft, Timer } from "lucide-react";

const PRESETS = [25, 45, 60] as const;

export default function FocusPage() {
  const router = useRouter();
  const [selectedMins, setSelectedMins] = useState<number>(25);

  return (
    <div className="pb-[100px]">
      {/* Header */}
      <div className="flex items-center px-4 pt-[var(--safe-area-top)] pb-2">
        <button
          type="button"
          onClick={() => router.push("/more")}
          className="inline-flex h-8 w-8 items-center justify-center rounded-lg"
          style={{
            background: "var(--color-surface-card)",
            border: "1px solid var(--lifeflow-border)",
          }}
        >
          <ChevronLeft className="w-4 h-4" style={{ color: "var(--color-text-primary)" }} />
        </button>
        <h1 className="text-title-nav flex-1 text-center" style={{ color: "var(--color-text-primary)" }}>
          专注计时
        </h1>
        <div className="w-8" />
      </div>

      <div className="px-4 pt-5 flex flex-col items-center gap-6">
        {/* Timer Card */}
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.35, ease: [0.32, 0.72, 0, 1] }}
          className="card-standard p-6 flex flex-col items-center w-full"
        >
          {/* Timer circle */}
          <div
            className="rounded-full flex items-center justify-center flex-col"
            style={{
              width: 180,
              height: 180,
              border: "4px solid var(--lifeflow-primary)",
            }}
          >
            <Timer className="w-7 h-7" style={{ color: "var(--lifeflow-primary)" }} />
            <span
              className="text-[40px] font-bold mt-1 tabular-nums"
              style={{ color: "var(--color-text-primary)" }}
            >
              25:00
            </span>
          </div>

          {/* Label */}
          <p className="text-[15px] mt-3 font-medium" style={{ color: "var(--color-text-secondary)" }}>
            番茄钟
          </p>

          {/* Duration pills */}
          <div className="flex gap-2.5 mt-5">
            {PRESETS.map((mins) => (
              <button
                key={mins}
                type="button"
                onClick={() => setSelectedMins(mins)}
                className="h-9 px-5 rounded-full text-[14px] font-medium transition-colors"
                style={{
                  background:
                    selectedMins === mins
                      ? "var(--lifeflow-brand-50)"
                      : "var(--color-surface-secondary)",
                  color:
                    selectedMins === mins
                      ? "var(--lifeflow-primary)"
                      : "var(--color-text-secondary)",
                }}
              >
                {mins}分钟
              </button>
            ))}
          </div>

          {/* Start button */}
          <button
            type="button"
            className="mt-6 py-[14px] px-[48px] rounded-full text-[16px] font-semibold text-white"
            style={{ background: "var(--lifeflow-primary)" }}
          >
            开始专注
          </button>
        </motion.div>
      </div>
    </div>
  );
}
