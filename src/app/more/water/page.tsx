"use client";

import { useEffect, useState, useMemo, useCallback, useRef } from "react";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import { ChevronLeft, Droplets, Plus, Minus } from "lucide-react";
import { useHealthStore } from "@/lib/store/healthStore";

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
      <div className="min-h-screen bg-[#FAFAFA] max-w-[430px] mx-auto pb-[100px]">
        <div className="bg-white border-b border-[#F5F5F5]">
          <div className="flex items-center px-4 h-11">
            <div className="w-8 h-8" />
          </div>
        </div>
        <div className="px-4 pt-5 flex flex-col items-center gap-5">
          <div className="w-48 h-48 rounded-full animate-pulse bg-[#F5F5F5]" />
        </div>
      </div>
    );
  }

  /* ────────── Render ────────── */

  return (
    <div className="min-h-screen bg-[#FAFAFA] max-w-[430px] mx-auto pb-[100px]">
      {/* Header */}
      <div className="bg-white h-11 border-b border-[#F5F5F5] relative flex items-center">
        <button
          type="button"
          onClick={() => router.push("/more")}
          className="ml-4 inline-flex items-center justify-center"
        >
          <ChevronLeft className="w-6 h-6 text-[#1D1D1F]" />
        </button>
        <h1 className="absolute left-1/2 -translate-x-1/2 text-[17px] font-semibold text-[#1D1D1F]">
          喝水
        </h1>
      </div>

      <div className="px-4 pt-5 flex flex-col gap-5">
        {/* ─── Hero Card ─── */}
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.35, ease: [0.32, 0.72, 0, 1] }}
          className="bg-white rounded-[16px] border border-[#E5E5E5] p-4 flex flex-col items-center"
        >
          <Droplets className="w-6 h-6 text-[#5865F2]" />

          <span className="text-[34px] font-bold text-[#1D1D1F] mt-2">
            {todayWaterTotal}ml
          </span>
          <span className="text-[13px] text-[#86868B] mt-0.5">
            目标 {dailyTarget}ml
          </span>

          {/* Progress bar */}
          <div className="w-full h-1 rounded-full bg-[#F5F5F5] mt-3 overflow-hidden">
            <motion.div
              className="h-1 rounded-full bg-[#5865F2]"
              initial={{ width: 0 }}
              animate={{ width: `${Math.min(100, percent)}%` }}
              transition={{ duration: 0.6, ease: [0.32, 0.72, 0, 1] }}
            />
          </div>

          <span className="text-[13px] text-[#86868B] mt-2">
            {remaining > 0
              ? `还差 ${remaining}ml · ${cupsRemaining} 杯`
              : "今日目标已达成"}
          </span>
        </motion.div>

        {/* ─── Quick Drink Pills ─── */}
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.05, duration: 0.35, ease: [0.32, 0.72, 0, 1] }}
          className="flex gap-2"
        >
          {QUICK_AMOUNTS.map((amount) => (
            <motion.button
              key={amount}
              type="button"
              whileTap={{ scale: 0.95 }}
              disabled={addingMap[amount]}
              onClick={() => handleAdd(amount)}
              className="flex-1 h-11 rounded-full bg-[#EEF2FF] text-[15px] font-medium text-[#5865F2] disabled:opacity-50"
            >
              +{amount}ml
            </motion.button>
          ))}
        </motion.div>

        {/* ─── Goal Settings Card ─── */}
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1, duration: 0.35, ease: [0.32, 0.72, 0, 1] }}
          className="bg-white rounded-[16px] border border-[#E5E5E5] p-4"
        >
          <h2 className="text-[17px] font-semibold text-[#1D1D1F]">目标设置</h2>

          {/* Daily target stepper */}
          <div className="mt-3 flex items-center justify-center gap-6">
            <motion.button
              type="button"
              whileTap={{ scale: 0.9 }}
              onClick={() => handleStepperChange(-1)}
              className="w-7 h-7 rounded-full border-[1.5px] border-[#5865F2] bg-white flex items-center justify-center"
            >
              <Minus className="w-3.5 h-3.5 text-[#5865F2]" />
            </motion.button>
            <span className="text-[20px] font-bold text-[#1D1D1F] min-w-[80px] text-center">
              {dailyTarget}ml
            </span>
            <motion.button
              type="button"
              whileTap={{ scale: 0.9 }}
              onClick={() => handleStepperChange(1)}
              className="w-7 h-7 rounded-full border-[1.5px] border-[#5865F2] bg-white flex items-center justify-center"
            >
              <Plus className="w-3.5 h-3.5 text-[#5865F2]" />
            </motion.button>
          </div>

          {/* Divider */}
          <div className="my-3 h-px bg-[#F5F5F5]" />

          {/* Cup size */}
          <div className="flex gap-2">
            {CUP_OPTIONS.map((size) => (
              <motion.button
                key={size}
                type="button"
                whileTap={{ scale: 0.95 }}
                onClick={() => handleCupSizeChange(size)}
                className={`h-8 px-4 rounded-full text-[13px] font-medium transition-colors ${
                  cupSize === size
                    ? "bg-[#EEF2FF] text-[#5865F2]"
                    : "bg-transparent text-[#86868B]"
                }`}
              >
                {size}ml
              </motion.button>
            ))}
          </div>
        </motion.div>

        {/* ─── Reminder Card ─── */}
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.15, duration: 0.35, ease: [0.32, 0.72, 0, 1] }}
          className="bg-white rounded-[16px] border border-[#E5E5E5] p-4"
        >
          {/* Interval pills */}
          <div className="flex gap-2">
            {INTERVAL_OPTIONS.map((opt) => (
              <motion.button
                key={opt.value}
                type="button"
                whileTap={{ scale: 0.95 }}
                onClick={() => handleIntervalChange(opt.value)}
                className={`h-8 px-4 rounded-full text-[13px] font-medium transition-colors ${
                  waterGoal?.reminderInterval === opt.value
                    ? "bg-[#EEF2FF] text-[#5865F2]"
                    : "bg-transparent text-[#86868B]"
                }`}
              >
                {opt.label}
              </motion.button>
            ))}
          </div>

          {/* Divider */}
          <div className="my-3 h-px bg-[#F5F5F5]" />

          {/* Night mode */}
          <div className="flex items-center justify-between">
            <div className="flex flex-col">
              <span className="text-[15px] text-[#1D1D1F]">夜间免打扰</span>
              <span className="text-[13px] text-[#86868B]">22:00 - 08:00</span>
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
                  backgroundColor: waterGoal?.nightMode ? "#5865F2" : "#E5E5E5",
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

        {/* ─── Today Records Card ─── */}
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2, duration: 0.35, ease: [0.32, 0.72, 0, 1] }}
          className="bg-white rounded-[16px] border border-[#E5E5E5] p-4"
        >
          <h2 className="text-[17px] font-semibold text-[#1D1D1F]">今日记录</h2>

          {sortedLogs.length === 0 ? (
            <p className="mt-3 text-[13px] text-[#86868B]">今日暂无饮水记录</p>
          ) : (
            <div className="mt-2">
              {sortedLogs.map((entry, i) => (
                <div
                  key={entry.id}
                  className="flex items-center justify-between h-[42px]"
                  style={{ borderTop: i > 0 ? "1px solid #F5F5F5" : undefined }}
                  onMouseDown={() => handlePressStart(entry.id)}
                  onMouseUp={handlePressEnd}
                  onMouseLeave={handlePressEnd}
                  onTouchStart={() => handlePressStart(entry.id)}
                  onTouchEnd={handlePressEnd}
                >
                  <span className="text-[13px] text-[#86868B]">
                    {formatTimestamp(entry.timestamp)}
                  </span>
                  <span className="text-[15px] font-semibold text-[#1D1D1F]">
                    +{entry.amount}ml
                  </span>
                </div>
              ))}
            </div>
          )}
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
            className="bg-white rounded-[16px] p-5 mx-8 w-full max-w-[280px]"
            onClick={(e) => e.stopPropagation()}
          >
            <p className="text-[15px] font-semibold text-[#1D1D1F] text-center">
              确定删除这条饮水记录？
            </p>
            <div className="flex gap-3 mt-4">
              <motion.button
                type="button"
                whileTap={{ scale: 0.95 }}
                onClick={() => setDeleteTarget(null)}
                className="flex-1 h-10 rounded-full bg-[#F5F5F5] text-[15px] text-[#1D1D1F] font-medium"
              >
                取消
              </motion.button>
              <motion.button
                type="button"
                whileTap={{ scale: 0.95 }}
                onClick={handleConfirmDelete}
                className="flex-1 h-10 rounded-full bg-[#FF3B30] text-[15px] text-white font-medium"
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
