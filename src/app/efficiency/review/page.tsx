"use client";

import { useState, useMemo } from "react";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import { ChevronLeft } from "lucide-react";
import ReviewDaily from "./ReviewDaily";
import ReviewWeekly from "./ReviewWeekly";
import ReviewMonthly from "./ReviewMonthly";
import ReviewYearly from "./ReviewYearly";

// ============================================================
// 工具
// ============================================================
function todayStr(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function getWeekRange(offset: number = 0): { start: string; end: string } {
  const now = new Date();
  const day = now.getDay();
  const diffToMon = day === 0 ? 6 : day - 1;
  const mon = new Date(now);
  mon.setDate(now.getDate() - diffToMon + offset * 7);
  const sun = new Date(mon);
  sun.setDate(mon.getDate() + 6);
  return {
    start: fmtDate(mon),
    end: fmtDate(sun),
  };
}

function fmtDate(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

const PERIOD_TABS = [
  { key: "daily", label: "日" },
  { key: "weekly", label: "周" },
  { key: "monthly", label: "月" },
  { key: "yearly", label: "年" },
] as const;

type Period = (typeof PERIOD_TABS)[number]["key"];

// ============================================================
// 主组件
// ============================================================
export default function ReviewPage() {
  const router = useRouter();
  const [period, setPeriod] = useState<Period>("daily");
  const today = todayStr();
  const now = new Date();

  // 周范围
  const weekRange = useMemo(() => getWeekRange(0), []);

  // 月/年
  const currentYear = now.getFullYear();
  const currentMonth = now.getMonth() + 1;

  return (
    <div
      className="mx-auto pb-[120px]"
      style={{
        maxWidth: 430,
        minHeight: "100vh",
        background: "var(--lifeflow-background)",
      }}
    >
      {/* Header */}
      <div
        className="px-5 pt-[var(--safe-area-top)] pb-3 flex items-center justify-between"
      >
        <div className="flex items-center gap-2">
          <button
            onClick={() => router.back()}
            className="w-8 h-8 -ml-1 flex items-center justify-center"
          >
            <ChevronLeft
              className="w-6 h-6"
              style={{ color: "var(--color-text-primary)" }}
            />
          </button>
          <h1
            className="text-[28px] font-bold font-['SF_Pro_Display',_-apple-system] leading-tight"
            style={{
              color: "var(--color-text-primary)",
              letterSpacing: "-0.022em",
            }}
          >
            复盘
          </h1>
        </div>
      </div>

      {/* Period Tabs */}
      <div className="px-4 mb-4">
        <div
          className="flex rounded-full p-1"
          style={{ background: "var(--color-surface-secondary)" }}
        >
          {PERIOD_TABS.map((tab) => (
            <button
              key={tab.key}
              onClick={() => setPeriod(tab.key)}
              className="flex-1 py-2 rounded-full text-[14px] font-medium transition-all"
              style={{
                background:
                  period === tab.key
                    ? "var(--color-surface-card)"
                    : "transparent",
                color:
                  period === tab.key
                    ? "var(--color-text-primary)"
                    : "var(--color-text-disabled)",
                boxShadow:
                  period === tab.key ? "var(--shadow-card)" : "none",
              }}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* Content */}
      <motion.div
        key={period}
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.2 }}
      >
        {period === "daily" && <ReviewDaily date={today} />}
        {period === "weekly" && (
          <ReviewWeekly
            startDate={weekRange.start}
            endDate={weekRange.end}
          />
        )}
        {period === "monthly" && (
          <ReviewMonthly year={currentYear} month={currentMonth} />
        )}
        {period === "yearly" && <ReviewYearly year={currentYear} />}
      </motion.div>

      {/* AI Insight placeholder */}
      <div className="px-4 mt-4">
        <div
          className="p-4 rounded-[20px] flex items-center gap-3"
          style={{
            background: "var(--color-surface-card)",
            boxShadow: "var(--shadow-card)",
            border: "1px dashed var(--lifeflow-border)",
          }}
        >
          <div
            className="w-8 h-8 rounded-full flex items-center justify-center"
            style={{ background: "var(--lifeflow-brand-50)" }}
          >
            <span className="text-[16px]">✨</span>
          </div>
          <div>
            <p
              className="text-[13px] font-medium"
              style={{ color: "var(--color-text-secondary)" }}
            >
              AI 分析即将上线
            </p>
            <p
              className="text-[11px]"
              style={{ color: "var(--color-text-disabled)" }}
            >
              未来会自动分析你的数据，给出个性化的行动建议
            </p>
          </div>
        </div>
      </div>

      <div className="h-4" />
    </div>
  );
}
