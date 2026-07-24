"use client";

import { useEffect, useState, useMemo, useCallback, useRef } from "react";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import { ChevronLeft, Droplets, Plus, Minus } from "lucide-react";
import { useHealthStore } from "@/lib/store/healthStore";
import { runPerceptionCheck } from "@/lib/perception-engine";

/* ────────── Constants ────────── */

const QUICK_AMOUNTS = [100, 200, 300, 500] as const;
const INTERVAL_OPTIONS = [
  { label: "30分钟", value: 30 },
  { label: "1小时", value: 60 },
  { label: "2小时", value: 120 },
] as const;
const CUP_OPTIONS = [200, 300, 500] as const;

/* ────────── Component ────────── */

export default function WaterPage() {
  const router = useRouter();

  const waterLogs = useHealthStore((s) => s.waterLogs);
  const todayWaterTotal = useHealthStore((s) => s.todayWaterTotal);
  const waterGoal = useHealthStore((s) => s.waterGoal);
  const loadWaterData = useHealthStore((s) => s.loadWaterData);
  const addWaterAction = useHealthStore((s) => s.addWater);
  const deleteWaterLogAction = useHealthStore((s) => s.deleteWaterLog);
  const updateWaterGoalAction = useHealthStore((s) => s.updateWaterGoal);

  const [addingMap, setAddingMap] = useState<Record<number, boolean>>({});
  const [pageLoading, setPageLoading] = useState(true);
  const [deleteTarget, setDeleteTarget] = useState<string | null>(null);
  const pressTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const dailyTarget = waterGoal?.dailyTarget ?? 2000;

  /* ─── Load ─── */

  useEffect(() => {
    (async () => {
      setPageLoading(true);
      await loadWaterData();
      setPageLoading(false);
    })();
  }, [loadWaterData]);

  /* ─── Derived ─── */

  const percent = useMemo(() => {
    if (dailyTarget <= 0) return 0;
    return Math.min(100, Math.round((todayWaterTotal / dailyTarget) * 100));
  }, [todayWaterTotal, dailyTarget]);

  const remaining = Math.max(0, dailyTarget - todayWaterTotal);
  const cupSize = waterGoal?.cupSize ?? 200;
  const cupsRemaining = Math.ceil(remaining / Math.max(cupSize, 1));

  const sortedLogs = useMemo(
    () => [...waterLogs].sort((a, b) => b.timestamp - a.timestamp),
    [waterLogs],
  );

  /* ─── SVG Ring ─── */

  const ringSize = 196;
  const ringStroke = 10;
  const ringRadius = (ringSize - ringStroke) / 2;
  const circumference = 2 * Math.PI * ringRadius;
  const dashOffset = circumference * (1 - percent / 100);

  /* ─── Actions ─── */

  const handleAdd = useCallback(
    async (amount: number) => {
      if (addingMap[amount]) return;
      setAddingMap((p) => ({ ...p, [amount]: true }));
      try {
        await addWaterAction(amount);
        runPerceptionCheck().then(cards => {
          sessionStorage.setItem("perception_cards", JSON.stringify(cards));
        }).catch(() => {});
      } finally {
        setAddingMap((p) => ({ ...p, [amount]: false }));
      }
    },
    [addWaterAction, addingMap],
  );

  const handleStepperChange = useCallback(
    (delta: number) => {
      const next = clamp(dailyTarget + delta * 100, 100, 10000);
      updateWaterGoalAction({ dailyTarget: next });
    },
    [dailyTarget, updateWaterGoalAction],
  );

  const handleCupSizeChange = useCallback(
    (size: number) => {
      updateWaterGoalAction({ cupSize: size });
    },
    [updateWaterGoalAction],
  );

  const handleIntervalChange = useCallback(
    (interval: number) => {
      updateWaterGoalAction({ reminderInterval: interval });
    },
    [updateWaterGoalAction],
  );

  const handleNightModeToggle = useCallback(() => {
    updateWaterGoalAction({ nightMode: !waterGoal?.nightMode });
  }, [waterGoal?.nightMode, updateWaterGoalAction]);

  /* ─── Long press delete ─── */

  const handlePressStart = useCallback((id: string) => {
    pressTimer.current = setTimeout(() => {
      setDeleteTarget(id);
    }, 500);
  }, []);

  const handlePressEnd = useCallback(() => {
    if (pressTimer.current) {
      clearTimeout(pressTimer.current);
      pressTimer.current = null;
    }
  }, []);

  const handleConfirmDelete = useCallback(async () => {
    if (!deleteTarget) return;
    await deleteWaterLogAction(deleteTarget);
    setDeleteTarget(null);
  }, [deleteTarget, deleteWaterLogAction]);

  /* ─── Helpers ─── */

  function formatTimestamp(ts: number): string {
    const d = new Date(ts);
    return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
  }

  /* ─── Loading ─── */

  if (pageLoading) {
    return (
      <div className="min-h-screen" style={{ background: "var(--lifeflow-background)" }}>
        <header className="flex items-center h-11 px-4">
          <div className="inline-flex h-8 w-8 items-center justify-center rounded-lg" style={{ background: "var(--color-surface-card)", border: "1px solid var(--lifeflow-border)" }} />
        </header>
        <div className="px-4 pt-4 flex flex-col items-center gap-5">
          <div className="w-48 h-48 rounded-full animate-pulse" style={{ background: "var(--lifeflow-muted)" }} />
        </div>
      </div>
    );
  }

  /* ────────── Render ────────── */

  return (
    <div className="min-h-screen pb-12" style={{ background: "var(--lifeflow-background)" }}>
      {/* ─── Header ─── */}
      <header className="flex items-center h-11 px-4">
        <button
          type="button"
          onClick={() => router.push("/more")}
          className="inline-flex h-8 w-8 items-center justify-center rounded-lg shrink-0"
          style={{ background: "var(--color-surface-card)", border: "1px solid var(--lifeflow-border)" }}
          aria-label="返回"
        >
          <ChevronLeft className="h-5 w-5" style={{ color: "var(--color-text-primary)" }} />
        </button>
        <h1 className="flex-1 text-center text-[17px] font-semibold tracking-[-0.018em]" style={{ color: "var(--color-text-primary)" }}>
          饮水
        </h1>
        <div className="w-8" />
      </header>

      {/* ─── Circular Progress Card ─── */}
      <div className="px-4 pt-4">
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.35, ease: [0.32, 0.72, 0, 1] }}
          className="flex flex-col items-center p-6"
          style={{ background: "var(--color-surface-card)", borderRadius: "20px", boxShadow: "var(--shadow-card)" }}
        >
          <div className="relative flex items-center justify-center" style={{ width: 196, height: 196 }}>
            <svg
              width="196"
              height="196"
              viewBox="0 0 196 196"
              style={{ transform: "rotate(-90deg)" }}
            >
              {/* Track */}
              <circle
                cx="98"
                cy="98"
                r="86"
                fill="none"
                stroke="var(--lifeflow-muted)"
                strokeWidth="10"
              />
              {/* Progress */}
              <circle
                cx="98"
                cy="98"
                r="86"
                fill="none"
                stroke="var(--lifeflow-primary)"
                strokeWidth="10"
                strokeDasharray={circumference}
                strokeDashoffset={dashOffset}
                strokeLinecap="round"
                style={{ transition: "stroke-dashoffset 0.6s cubic-bezier(0.32, 0.72, 0, 1)" }}
              />
            </svg>
            <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
              <Droplets className="h-9 w-9" style={{ color: "var(--lifeflow-primary)" }} />
              <span className="text-[28px] font-bold mt-1 tracking-[-0.022em]" style={{ color: "var(--color-text-primary)" }}>
                {todayWaterTotal} ml
              </span>
            </div>
          </div>
          <p className="text-[13px] font-medium mt-2" style={{ color: "var(--color-text-secondary)", letterSpacing: "-0.01em" }}>
            今日目标 {dailyTarget} ml
          </p>
        </motion.div>
      </div>

      {/* ─── Quick-add Buttons ─── */}
      <div className="px-4 pt-5">
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.05, duration: 0.35, ease: [0.32, 0.72, 0, 1] }}
          className="grid grid-cols-4 gap-3"
        >
          {QUICK_AMOUNTS.map((amount) => {
            const isAccent = amount === 500;
            return (
              <motion.button
                key={amount}
                type="button"
                whileTap={{ scale: 0.96 }}
                disabled={addingMap[amount]}
                onClick={() => handleAdd(amount)}
                className="inline-flex items-center justify-center py-2.5 rounded-full text-sm font-semibold tracking-[-0.018em] whitespace-nowrap disabled:opacity-50"
                style={{
                  background: isAccent ? "var(--lifeflow-primary)" : "var(--lifeflow-brand-50)",
                  color: isAccent ? "var(--lifeflow-primary-foreground)" : "var(--lifeflow-primary)",
                }}
              >
                +{amount} ml
              </motion.button>
            );
          })}
        </motion.div>
      </div>

      {/* ─── Today's Log ─── */}
      <div className="px-4 pt-5">
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1, duration: 0.35, ease: [0.32, 0.72, 0, 1] }}
          className="p-4"
          style={{ background: "var(--color-surface-card)", borderRadius: "20px", boxShadow: "var(--shadow-card)" }}
        >
          <div className="flex items-center justify-between">
            <h2 className="text-base font-semibold" style={{ color: "var(--color-text-primary)" }}>今日记录</h2>
            <span className="text-[13px] font-medium" style={{ color: "var(--color-text-secondary)", letterSpacing: "-0.01em" }}>
              共 {sortedLogs.length} 次
            </span>
          </div>

          {sortedLogs.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-10">
              <Droplets className="h-10 w-10" style={{ color: "var(--color-text-disabled)" }} />
              <p className="text-[13px] font-medium mt-3" style={{ color: "var(--color-text-secondary)" }}>今天还没有喝水记录。现在喝一杯？</p>
            </div>
          ) : (
            <div className="mt-2">
              {sortedLogs.map((entry, i) => (
                <div
                  key={entry.id}
                  className="flex items-center justify-between h-[42px]"
                  style={{ borderTop: i > 0 ? "1px solid var(--lifeflow-border)" : undefined }}
                  onMouseDown={() => handlePressStart(entry.id)}
                  onMouseUp={handlePressEnd}
                  onMouseLeave={handlePressEnd}
                  onTouchStart={() => handlePressStart(entry.id)}
                  onTouchEnd={handlePressEnd}
                >
                  <span className="text-[13px]" style={{ color: "var(--color-text-secondary)" }}>
                    {formatTimestamp(entry.timestamp)}
                  </span>
                  <span className="text-[15px] font-semibold" style={{ color: "var(--color-text-primary)" }}>
                    +{entry.amount}ml
                  </span>
                </div>
              ))}
            </div>
          )}
        </motion.div>
      </div>

      {/* ─── Goal Settings Card ─── */}
      <div className="px-4 pt-4">
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.15, duration: 0.35, ease: [0.32, 0.72, 0, 1] }}
          className="p-4"
          style={{ background: "var(--color-surface-card)", borderRadius: "20px", boxShadow: "var(--shadow-card)" }}
        >
          <h2 className="text-[17px] font-semibold" style={{ color: "var(--color-text-primary)" }}>目标设置</h2>

          {/* Daily target stepper */}
          <div className="mt-3 flex items-center justify-center gap-6">
            <motion.button
              type="button"
              whileTap={{ scale: 0.9 }}
              onClick={() => handleStepperChange(-1)}
              className="w-7 h-7 rounded-full border-[1.5px] flex items-center justify-center"
              style={{ borderColor: "var(--lifeflow-primary)", background: "var(--color-surface-card)" }}
            >
              <Minus className="w-3.5 h-3.5" style={{ color: "var(--lifeflow-primary)" }} />
            </motion.button>
            <span className="text-[20px] font-bold min-w-[80px] text-center" style={{ color: "var(--color-text-primary)" }}>
              {dailyTarget}ml
            </span>
            <motion.button
              type="button"
              whileTap={{ scale: 0.9 }}
              onClick={() => handleStepperChange(1)}
              className="w-7 h-7 rounded-full border-[1.5px] flex items-center justify-center"
              style={{ borderColor: "var(--lifeflow-primary)", background: "var(--color-surface-card)" }}
            >
              <Plus className="w-3.5 h-3.5" style={{ color: "var(--lifeflow-primary)" }} />
            </motion.button>
          </div>

          {/* Divider */}
          <div className="my-3" style={{ height: "0.5px", background: "var(--lifeflow-border)" }} />

          {/* Cup size */}
          <div className="flex gap-2">
            {CUP_OPTIONS.map((size) => (
              <motion.button
                key={size}
                type="button"
                whileTap={{ scale: 0.95 }}
                onClick={() => handleCupSizeChange(size)}
                className="h-8 px-4 rounded-full text-[13px] font-medium transition-colors"
                style={{
                  background: cupSize === size ? "var(--lifeflow-brand-50)" : "transparent",
                  color: cupSize === size ? "var(--lifeflow-primary)" : "var(--color-text-secondary)",
                }}
              >
                {size}ml
              </motion.button>
            ))}
          </div>
        </motion.div>
      </div>

      {/* ─── Reminder Card ─── */}
      <div className="px-4 pt-4">
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2, duration: 0.35, ease: [0.32, 0.72, 0, 1] }}
          className="p-4"
          style={{ background: "var(--color-surface-card)", borderRadius: "20px", boxShadow: "var(--shadow-card)" }}
        >
          {/* Interval pills */}
          <div className="flex gap-2">
            {INTERVAL_OPTIONS.map((opt) => (
              <motion.button
                key={opt.value}
                type="button"
                whileTap={{ scale: 0.95 }}
                onClick={() => handleIntervalChange(opt.value)}
                className="h-8 px-4 rounded-full text-[13px] font-medium transition-colors"
                style={{
                  background: waterGoal?.reminderInterval === opt.value ? "var(--lifeflow-brand-50)" : "transparent",
                  color: waterGoal?.reminderInterval === opt.value ? "var(--lifeflow-primary)" : "var(--color-text-secondary)",
                }}
              >
                {opt.label}
              </motion.button>
            ))}
          </div>

          {/* Divider */}
          <div className="my-3" style={{ height: "0.5px", background: "var(--lifeflow-border)" }} />

          {/* Night mode */}
          <div className="flex items-center justify-between">
            <div className="flex flex-col">
              <span className="text-[15px]" style={{ color: "var(--color-text-primary)" }}>夜间免打扰</span>
              <span className="text-[13px]" style={{ color: "var(--color-text-secondary)" }}>22:00 - 08:00</span>
            </div>
            <button
              type="button"
              onClick={handleNightModeToggle}
              className="relative cursor-pointer"
              style={{ width: 48, height: 30 }}
            >
              <motion.div
                className="absolute inset-0 rounded-full"
                animate={{
                  backgroundColor: waterGoal?.nightMode ? "var(--lifeflow-primary)" : "var(--lifeflow-border)",
                }}
                transition={{ duration: 0.2 }}
              />
              <motion.div
                className="absolute top-[2px] rounded-full bg-white shadow-sm"
                style={{ width: 26, height: 26 }}
                animate={{
                  left: waterGoal?.nightMode ? 20 : 2,
                }}
                transition={{ duration: 0.2 }}
              />
            </button>
          </div>
        </motion.div>
      </div>

      {/* ─── Delete confirm modal ─── */}
      {deleteTarget && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/30"
          onClick={() => setDeleteTarget(null)}
        >
          <motion.div
            initial={{ scale: 0.9, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            className="p-5 mx-8 w-full max-w-[280px]"
            style={{ background: "var(--color-surface-card)", borderRadius: "20px", boxShadow: "var(--shadow-card-elevated)" }}
            onClick={(e) => e.stopPropagation()}
          >
            <p className="text-[15px] font-semibold text-center" style={{ color: "var(--color-text-primary)" }}>
              确定删除这条饮水记录？
            </p>
            <div className="flex gap-3 mt-4">
              <motion.button
                type="button"
                whileTap={{ scale: 0.95 }}
                onClick={() => setDeleteTarget(null)}
                className="flex-1 h-10 rounded-full text-[15px] font-medium"
                style={{ background: "var(--lifeflow-muted)", color: "var(--color-text-primary)" }}
              >
                取消
              </motion.button>
              <motion.button
                type="button"
                whileTap={{ scale: 0.95 }}
                onClick={handleConfirmDelete}
                className="flex-1 h-10 rounded-full text-[15px] text-white font-medium"
                style={{ background: "#FF3B30" }}
              >
                删除
              </motion.button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </div>
  );
}

/* ────────── Local helper ────────── */

function clamp(v: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, v));
}
