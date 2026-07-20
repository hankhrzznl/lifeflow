"use client";

import { useEffect, useState, useMemo, useCallback } from "react";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import { ChevronLeft, Droplets } from "lucide-react";
import { useHealthStore } from "@/lib/store/healthStore";

const QUICK_AMOUNTS = [100, 200, 300, 500] as const;

export default function WaterPage() {
  const router = useRouter();

  const waterLogs = useHealthStore((s) => s.waterLogs);
  const todayWaterTotal = useHealthStore((s) => s.todayWaterTotal);
  const waterGoal = useHealthStore((s) => s.waterGoal);
  const loadWaterData = useHealthStore((s) => s.loadWaterData);
  const addWaterAction = useHealthStore((s) => s.addWater);

  const [addingMap, setAddingMap] = useState<Record<number, boolean>>({});
  const [pageLoading, setPageLoading] = useState(true);

  const dailyTarget = waterGoal?.dailyTarget ?? 2000;

  useEffect(() => {
    (async () => { setPageLoading(true); await loadWaterData(); setPageLoading(false); })();
  }, [loadWaterData]);

  const percent = useMemo(() => {
    if (dailyTarget <= 0) return 0;
    return Math.min(100, Math.round((todayWaterTotal / dailyTarget) * 100));
  }, [todayWaterTotal, dailyTarget]);

  const handleAdd = useCallback(
    async (amount: number) => {
      if (addingMap[amount]) return;
      setAddingMap((p) => ({ ...p, [amount]: true }));
      try {
        await addWaterAction(amount);
      } finally {
        setAddingMap((p) => ({ ...p, [amount]: false }));
      }
    },
    [addWaterAction, addingMap],
  );

  // SVG ring
  const SIZE = 196;
  const STROKE = 10;
  const RADIUS = (SIZE - STROKE) / 2;
  const CIRCUMFERENCE = 2 * Math.PI * RADIUS;
  const dashOffset = CIRCUMFERENCE * (1 - percent / 100);

  const sortedLogs = useMemo(
    () => [...waterLogs].sort((a, b) => b.timestamp - a.timestamp),
    [waterLogs],
  );

  function formatTimestamp(ts: number): string {
    const d = new Date(ts);
    return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
  }

  if (pageLoading) {
    return (
      <div>
        <div className="sticky top-0 z-20 bg-[var(--color-surface-card)] border-b border-[var(--lifeflow-border)]">
          <div className="flex items-center px-4 h-11"><div className="w-8 h-8" /></div>
        </div>
        <div className="px-4 pt-5 flex flex-col items-center gap-5">
          <div className="w-48 h-48 rounded-full animate-pulse" style={{ background: "var(--color-surface-secondary)" }} />
        </div>
      </div>
    );
  }

  return (
    <div className="pb-[100px]">
      {/* Header */}
      <div className="sticky top-0 z-20 bg-[var(--color-surface-card)] border-b border-[var(--lifeflow-border)]">
        <div className="flex items-center px-4 h-11">
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
            饮水
          </h1>
          <div className="w-8" />
        </div>
      </div>

      <div className="px-4 pt-5 flex flex-col items-center gap-5">
        {/* Circular Progress */}
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.35, ease: [0.32, 0.72, 0, 1] }}
          className="card-standard p-6 flex flex-col items-center"
        >
          <div className="relative" style={{ width: SIZE, height: SIZE }}>
            <svg
              width={SIZE}
              height={SIZE}
              className="-rotate-90"
              viewBox={`0 0 ${SIZE} ${SIZE}`}
            >
              {/* Track */}
              <circle
                cx={SIZE / 2}
                cy={SIZE / 2}
                r={RADIUS}
                fill="none"
                stroke="var(--lifeflow-brand-100)"
                strokeWidth={STROKE}
                strokeLinecap="round"
              />
              {/* Progress */}
              <motion.circle
                cx={SIZE / 2}
                cy={SIZE / 2}
                r={RADIUS}
                fill="none"
                stroke="var(--lifeflow-primary)"
                strokeWidth={STROKE}
                strokeLinecap="round"
                strokeDasharray={CIRCUMFERENCE}
                initial={{ strokeDashoffset: CIRCUMFERENCE }}
                animate={{ strokeDashoffset: dashOffset }}
                transition={{ duration: 0.8, ease: [0.32, 0.72, 0, 1] }}
              />
            </svg>
            {/* Center */}
            <div className="absolute inset-0 flex flex-col items-center justify-center">
              <Droplets className="w-7 h-7" style={{ color: "var(--lifeflow-primary)" }} />
              <motion.span
                className="text-[32px] font-bold mt-1"
                style={{ color: "var(--color-text-primary)" }}
                key={todayWaterTotal}
                initial={{ scale: 0.8, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                transition={{ duration: 0.3 }}
              >
                {todayWaterTotal.toLocaleString()} ml
              </motion.span>
            </div>
          </div>
          <p className="text-[13px] mt-4" style={{ color: "var(--color-text-secondary)" }}>
            今日目标 {dailyTarget.toLocaleString()} ml
          </p>
        </motion.div>

        {/* Quick-add buttons */}
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.05, duration: 0.35, ease: [0.32, 0.72, 0, 1] }}
          className="grid grid-cols-4 gap-3 w-full"
        >
          {QUICK_AMOUNTS.map((amount) => (
            <motion.button
              key={amount}
              type="button"
              whileTap={{ scale: 0.93 }}
              disabled={addingMap[amount]}
              onClick={() => handleAdd(amount)}
              className="py-3 rounded-full text-[15px] font-semibold disabled:opacity-50"
              style={{
                background:
                  amount === 500
                    ? "var(--lifeflow-primary)"
                    : "var(--lifeflow-brand-50)",
                color: amount === 500 ? "var(--color-text-inverse)" : "var(--lifeflow-primary)",
              }}
            >
              +{amount}ml
            </motion.button>
          ))}
        </motion.div>

        {/* Today's log */}
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1, duration: 0.35, ease: [0.32, 0.72, 0, 1] }}
          className="card-standard p-4 w-full"
        >
          <h2
            className="text-[15px] font-semibold mb-3"
            style={{ color: "var(--color-text-primary)" }}
          >
            今日记录
          </h2>
          {sortedLogs.length === 0 ? (
            <div className="py-6 text-center text-[13px]" style={{ color: "var(--color-text-secondary)" }}>
              暂无饮水记录
            </div>
          ) : (
            sortedLogs.map((entry, i) => (
              <div
                key={entry.id}
                className="flex items-center justify-between h-[42px]"
                style={{ borderTop: i > 0 ? "1px solid var(--lifeflow-border)" : undefined }}
              >
                <span className="text-[13px]" style={{ color: "var(--color-text-secondary)" }}>
                  {formatTimestamp(entry.timestamp)}
                </span>
                <span className="text-[15px] font-semibold" style={{ color: "var(--color-text-primary)" }}>
                  +{entry.amount}ml
                </span>
              </div>
            ))
          )}
        </motion.div>
      </div>
    </div>
  );
}
