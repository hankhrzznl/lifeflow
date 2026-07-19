"use client";

import { useEffect, useState, useMemo, useCallback } from "react";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import { ChevronLeft, Droplets, Minus, Plus } from "lucide-react";
import { useHealthStore } from "@/lib/store/healthStore";
import { showToast } from "@/components/ui/Toast";

// ============================================================
// 设计令牌
// ============================================================
const ACCENT = "#6366F1";
const ACCENT_LIGHT = "#EEF2FF";

const QUICK_AMOUNTS = [100, 200, 300, 500] as const;
const CUP_OPTIONS = [200, 300, 500] as const;
const REMINDER_OPTIONS = [
  { label: "30分钟", value: 30 },
  { label: "1小时", value: 60 },
  { label: "2小时", value: 120 },
] as const;

function formatTimestamp(ts: number): string {
  const d = new Date(ts);
  return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
}

// ============================================================
// iOS 开关
// ============================================================
function ToggleSwitch({ checked, onChange }: { checked: boolean; onChange: () => void }) {
  return (
    <button type="button" onClick={onChange} className="relative shrink-0 cursor-pointer"
      style={{ width: 48, height: 30, borderRadius: 15, background: checked ? ACCENT : "#E5E5E5", transition: "background 0.2s" }}>
      <motion.div className="absolute rounded-full bg-white"
        animate={{ x: checked ? 20 : 2 }}
        transition={{ type: "spring", stiffness: 500, damping: 30 }}
        style={{ width: 26, height: 26, top: 2, boxShadow: "0 1px 3px rgba(0,0,0,0.15)" }} />
    </button>
  );
}

// ============================================================
// 页面
// ============================================================
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

  const dailyTarget = waterGoal?.dailyTarget ?? 2000;
  const reminderInterval = waterGoal?.reminderInterval ?? 0;
  const nightMode = waterGoal?.nightMode ?? false;
  const cupSize = waterGoal?.cupSize ?? 200;

  useEffect(() => {
    (async () => { setPageLoading(true); await loadWaterData(); setPageLoading(false); })();
  }, [loadWaterData]);

  const percent = useMemo(() => {
    if (dailyTarget <= 0) return 0;
    return Math.min(100, Math.round((todayWaterTotal / dailyTarget) * 100));
  }, [todayWaterTotal, dailyTarget]);

  const remaining = Math.max(0, dailyTarget - todayWaterTotal);
  const cups = remaining > 0 ? Math.ceil(remaining / cupSize) : 0;

  const sortedLogs = useMemo(
    () => [...waterLogs].sort((a, b) => b.timestamp - a.timestamp),
    [waterLogs],
  );

  const handleAdd = useCallback(async (amount: number) => {
    if (addingMap[amount]) return;
    setAddingMap((p) => ({ ...p, [amount]: true }));
    try { await addWaterAction(amount); } finally {
      setAddingMap((p) => ({ ...p, [amount]: false }));
    }
  }, [addWaterAction, addingMap]);

  const handleDelete = useCallback(async (id: string) => {
    if (!window.confirm("确定删除这条饮水记录吗？")) return;
    await deleteWaterLogAction(id);
  }, [deleteWaterLogAction]);

  const handleTargetChange = useCallback((v: number) => {
    const clamped = Math.max(100, Math.min(10000, Math.round(v)));
    updateWaterGoalAction({ dailyTarget: clamped });
  }, [updateWaterGoalAction]);

  const handleCupSize = useCallback((v: number) => {
    updateWaterGoalAction({ cupSize: v });
  }, [updateWaterGoalAction]);

  const handleReminder = useCallback((v: number) => {
    updateWaterGoalAction({ reminderInterval: v });
  }, [updateWaterGoalAction]);

  const handleNightMode = useCallback(() => {
    updateWaterGoalAction({ nightMode: !nightMode });
  }, [nightMode, updateWaterGoalAction]);

  // ============================================================
  // 渲染
  // ============================================================
  if (pageLoading) {
    return (
      <div>
        <div className="bg-white border-b border-[#F5F5F5]">
          <div className="h-[44px] px-4 flex items-center relative max-w-[430px] mx-auto">
            <ChevronLeft className="w-6 h-6 text-[#1D1D1F]" />
          </div>
        </div>
        <div className="px-4 pt-5 pb-8 flex flex-col gap-5">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="bg-white rounded-[16px] border border-[#E5E5E5] p-4 animate-pulse">
              <div className="h-5 w-1/3 bg-[#F5F5F5] rounded mb-3" />
              <div className="h-8 w-2/3 bg-[#F5F5F5] rounded" />
            </div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div>
      {/* ===== 页头 ===== */}
      <div className="bg-white border-b border-[#F5F5F5]">
        <div className="h-[44px] px-4 flex items-center justify-center relative max-w-[430px] mx-auto">
          <button
            type="button" onClick={() => router.push("/health")}
            className="absolute left-4 w-10 h-10 -ml-2 flex items-center justify-center"
          >
            <ChevronLeft className="w-6 h-6 text-[#1D1D1F]" />
          </button>
          <span className="text-[17px] font-semibold text-[#1D1D1F]">喝水</span>
        </div>
      </div>

      {/* ===== 内容区 ===== */}
      <div className="px-4 pt-5 pb-8 flex flex-col gap-5">

        {/* 英雄卡 · 今日饮水 */}
        <motion.div
          initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}
          className="bg-white rounded-[16px] border border-[#E5E5E5] p-4 flex flex-col items-center"
        >
          <Droplets className="w-6 h-6 text-[#6366F1]" />
          <span className="mt-3 text-[34px] font-bold text-[#1D1D1F]">
            {todayWaterTotal.toLocaleString()}ml
          </span>
          <span className="mt-2 text-[13px] text-[#86868B]">
            目标 {dailyTarget.toLocaleString()}ml
          </span>
          <div className="mt-4 w-full h-1 rounded-full bg-[#F5F5F5] overflow-hidden">
            <motion.div
              initial={{ width: 0 }}
              animate={{ width: `${percent}%` }}
              transition={{ duration: 0.6, ease: "easeOut" }}
              className="h-1 rounded-full bg-[#6366F1]"
            />
          </div>
          <span className="mt-2.5 text-[13px] text-[#86868B]">
            {remaining > 0
              ? `还差 ${remaining.toLocaleString()}ml · ${cups} 杯`
              : "今日目标已达成"}
          </span>
        </motion.div>

        {/* 快捷喝水胶囊行 */}
        <motion.div
          initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.05 }}
          className="flex gap-2"
        >
          {QUICK_AMOUNTS.map((amount) => (
            <motion.button
              key={amount}
              type="button" whileTap={{ scale: 0.95 }}
              disabled={addingMap[amount]}
              onClick={() => handleAdd(amount)}
              className="flex-1 h-11 rounded-full inline-flex items-center justify-center text-[15px] font-medium bg-[#EEF2FF] text-[#6366F1] disabled:opacity-50"
            >
              +{amount}ml
            </motion.button>
          ))}
        </motion.div>

        {/* 卡片 · 目标设置 */}
        <motion.div
          initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="bg-white rounded-[16px] border border-[#E5E5E5] p-4 flex flex-col"
        >
          <h2 className="text-[17px] font-semibold text-[#1D1D1F] mb-3">目标设置</h2>

          {/* 每日目标行 */}
          <div className="flex items-center justify-between h-10">
            <span className="text-[15px] text-[#1D1D1F]">每日目标</span>
            <div className="flex items-center gap-3">
              <motion.button
                type="button" whileTap={{ scale: 0.9 }}
                onClick={() => handleTargetChange(dailyTarget - 100)}
                className="w-7 h-7 rounded-full border-[1.5px] border-[#6366F1] bg-white flex items-center justify-center"
              >
                <Minus className="w-[14px] h-[14px] text-[#6366F1]" />
              </motion.button>
              <span className="text-[15px] font-semibold text-[#1D1D1F] min-w-[64px] text-center">
                {dailyTarget}ml
              </span>
              <motion.button
                type="button" whileTap={{ scale: 0.9 }}
                onClick={() => handleTargetChange(dailyTarget + 100)}
                className="w-7 h-7 rounded-full border-[1.5px] border-[#6366F1] bg-white flex items-center justify-center"
              >
                <Plus className="w-[14px] h-[14px] text-[#6366F1]" />
              </motion.button>
            </div>
          </div>

          <div className="my-3 h-px bg-[#F5F5F5]" />

          {/* 杯量行 */}
          <div className="flex items-center justify-between">
            <span className="text-[15px] text-[#1D1D1F]">杯量</span>
            <div className="flex gap-2">
              {CUP_OPTIONS.map((v) => {
                const active = cupSize === v;
                return (
                  <button
                    key={v} type="button"
                    onClick={() => handleCupSize(v)}
                    className="h-8 px-4 rounded-full text-[13px] font-medium"
                    style={{
                      background: active ? ACCENT_LIGHT : "transparent",
                      color: active ? ACCENT : "#86868B",
                    }}
                  >{v}ml</button>
                );
              })}
            </div>
          </div>
        </motion.div>

        {/* 卡片 · 提醒 */}
        <motion.div
          initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.15 }}
          className="bg-white rounded-[16px] border border-[#E5E5E5] p-4 flex flex-col"
        >
          {/* 提醒间隔行 */}
          <div className="flex items-center justify-between">
            <span className="text-[15px] text-[#1D1D1F]">提醒间隔</span>
            <div className="flex gap-2">
              {REMINDER_OPTIONS.map((opt) => {
                const active = reminderInterval === opt.value;
                return (
                  <button
                    key={opt.value} type="button"
                    onClick={() => handleReminder(opt.value)}
                    className="h-8 px-4 rounded-full text-[13px]"
                    style={{
                      background: active ? ACCENT_LIGHT : "transparent",
                      color: active ? ACCENT : "#86868B",
                    }}
                  >{opt.label}</button>
                );
              })}
            </div>
          </div>

          <div className="my-3 h-px bg-[#F5F5F5]" />

          {/* 夜间免打扰行 */}
          <div className="flex items-center justify-between">
            <div className="flex flex-col">
              <span className="text-[15px] text-[#1D1D1F]">夜间免打扰</span>
              <span className="text-[12px] text-[#86868B]">22:00 - 08:00</span>
            </div>
            <ToggleSwitch checked={nightMode} onChange={handleNightMode} />
          </div>
        </motion.div>

        {/* 卡片 · 今日记录 */}
        <motion.div
          initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="bg-white rounded-[16px] border border-[#E5E5E5] p-4 flex flex-col"
        >
          <h2 className="text-[17px] font-semibold text-[#1D1D1F] mb-1">今日记录</h2>
          {sortedLogs.length === 0 ? (
            <div className="py-8 text-center text-[13px] text-[#86868B]">今日暂无饮水记录</div>
          ) : (
            sortedLogs.map((entry, i) => (
              <div
                key={entry.id}
                className="flex items-center justify-between h-[42px]"
                style={{ borderTop: i > 0 ? "1px solid #F5F5F5" : undefined }}
              >
                <span className="text-[13px] text-[#86868B]">{formatTimestamp(entry.timestamp)}</span>
                <div className="flex items-center gap-2">
                  <span className="text-[15px] font-semibold text-[#1D1D1F]">+{entry.amount}ml</span>
                  <button
                    type="button"
                    onClick={() => handleDelete(entry.id)}
                    className="text-[13px] text-[#86868B] underline"
                  >删除</button>
                </div>
              </div>
            ))
          )}
        </motion.div>

      </div>
    </div>
  );
}
