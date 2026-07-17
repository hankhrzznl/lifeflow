"use client";

import { useEffect, useState, useMemo, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Droplets, Plus, ChevronLeft, Clock, Bell, Moon, Trash2 } from "lucide-react";
import Link from "next/link";
import { useHealthStore } from "@/lib/store/healthStore";
import { healthDB } from "@/lib/db/health.db";
import type { WaterGoal as WaterGoalType } from "@/lib/db/health.db";

// ─── Constants ───────────────────────────────────────────────

const BRAND = "#FF9500";
const TRACK_COLOR = "#F2F2F7";
const CIRCUMFERENCE = 2 * Math.PI * 90;
const QUICK_AMOUNTS = [200, 300, 500] as const;
const REMINDER_OPTIONS = [
  { label: "30分钟", value: 30 },
  { label: "60分钟", value: 60 },
  { label: "90分钟", value: 90 },
  { label: "120分钟", value: 120 },
  { label: "关闭", value: 0 },
] as const;
const WEEKDAY_LABELS = ["一", "二", "三", "四", "五", "六", "日"];

function getLocalDate(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}
function getDateNDaysAgo(n: number): string {
  const d = new Date(); d.setDate(d.getDate() - n); return getLocalDate(d);
}
function formatTimestamp(ts: number): string {
  const d = new Date(ts);
  return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
}

// ─── Skeleton ─────────────────────────────────────────────────

function Skeleton() {
  return (
    <div className="animate-pulse space-y-6">
      <div className="flex items-center gap-3">
        <div className="w-9 h-9 rounded-full bg-gray-200" />
        <div className="space-y-2"><div className="h-6 w-28 bg-gray-200 rounded" /><div className="h-4 w-40 bg-gray-200 rounded" /></div>
      </div>
      <div className="flex justify-center"><div className="w-48 h-48 rounded-full bg-gray-200" /></div>
      <div className="flex gap-3">
        <div className="flex-1 h-11 bg-gray-200 rounded-full" /><div className="flex-1 h-11 bg-gray-200 rounded-full" /><div className="flex-1 h-11 bg-gray-200 rounded-full" />
      </div>
      <div className="bg-white rounded-2xl p-4 space-y-2">
        <div className="h-4 w-20 bg-gray-200 rounded" />
        {[0, 1, 2].map(i => <div key={i} className="h-10 bg-gray-100 rounded-xl" />)}
      </div>
      <div className="h-28 bg-white rounded-2xl" /><div className="h-24 bg-white rounded-2xl" /><div className="h-20 bg-white rounded-2xl" />
      <div className="h-40 bg-white rounded-2xl" />
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────

export default function WaterPage() {
  // Store
  const waterLogs = useHealthStore((s) => s.waterLogs);
  const todayWaterTotal = useHealthStore((s) => s.todayWaterTotal);
  const waterGoal = useHealthStore((s) => s.waterGoal);
  const loadWaterData = useHealthStore((s) => s.loadWaterData);
  const addWaterAction = useHealthStore((s) => s.addWater);
  const updateWaterGoalAction = useHealthStore((s) => s.updateWaterGoal);

  // Local
  const dailyTarget = waterGoal?.dailyTarget ?? 2000;
  const [goalInput, setGoalInput] = useState(dailyTarget);
  const [reminderInterval, setReminderInterval] = useState(waterGoal?.reminderInterval ?? 0);
  const [nightMode, setNightMode] = useState(waterGoal?.nightMode ?? false);
  const [weekData, setWeekData] = useState<number[]>([]);
  const [addingMap, setAddingMap] = useState<Record<number, boolean>>({});
  const [pageLoading, setPageLoading] = useState(true);

  // Derived
  const percent = useMemo(() => {
    if (dailyTarget <= 0) return 0;
    return Math.min(100, Math.round((todayWaterTotal / dailyTarget) * 100));
  }, [todayWaterTotal, dailyTarget]);

  const strokeDash = (percent / 100) * CIRCUMFERENCE;
  const maxWeek = useMemo(() => Math.max(...weekData, dailyTarget), [weekData, dailyTarget]);
  const avgWeek = useMemo(() => weekData.length ? Math.round(weekData.reduce((a,b)=>a+b,0)/weekData.length) : 0, [weekData]);

  // Sort logs by timestamp desc
  const sortedLogs = useMemo(() => [...waterLogs].sort((a, b) => b.timestamp - a.timestamp), [waterLogs]);

  // Sync goalInput
  useEffect(() => { setGoalInput(dailyTarget); }, [dailyTarget]);
  useEffect(() => { setReminderInterval(waterGoal?.reminderInterval ?? 0); }, [waterGoal?.reminderInterval]);
  useEffect(() => { setNightMode(waterGoal?.nightMode ?? false); }, [waterGoal?.nightMode]);

  // Init
  useEffect(() => {
    (async () => { setPageLoading(true); await loadWaterData(); setPageLoading(false); })();
  }, [loadWaterData]);

  // 7-day
  useEffect(() => {
    (async () => {
      try {
        const today = getLocalDate(new Date());
        const start = getDateNDaysAgo(6);
        const logs = await healthDB.waterLogs.where("date").between(start, today, true, true).toArray();
        const map: Record<string, number> = {};
        for (const l of logs) map[l.date] = (map[l.date] || 0) + l.amount;
        const data: number[] = [];
        for (let i = 6; i >= 0; i--) data.push(map[getDateNDaysAgo(i)] || 0);
        setWeekData(data);
      } catch { setWeekData([0,0,0,0,0,0,0]); }
    })();
  }, [todayWaterTotal]);

  // Handlers
  const handleAdd = useCallback(async (amount: number) => {
    if (addingMap[amount]) return;
    setAddingMap(p => ({ ...p, [amount]: true }));
    try { await addWaterAction(amount); } finally { setAddingMap(p => ({ ...p, [amount]: false })); }
  }, [addWaterAction, addingMap]);

  const handleSaveGoal = useCallback(() => {
    const v = Math.max(100, Math.min(10000, goalInput));
    setGoalInput(v);
    updateWaterGoalAction({ dailyTarget: v });
  }, [goalInput, updateWaterGoalAction]);

  const handleReminder = useCallback((value: number) => {
    setReminderInterval(value);
    updateWaterGoalAction({ reminderInterval: value });
  }, [updateWaterGoalAction]);

  const handleNightMode = useCallback(() => {
    const next = !nightMode;
    setNightMode(next);
    updateWaterGoalAction({ nightMode: next });
  }, [nightMode, updateWaterGoalAction]);

  if (pageLoading) return <div className="min-h-screen bg-[#F5F5F7] pb-24"><div className="max-w-2xl mx-auto px-5 pt-8"><Skeleton /></div></div>;

  return (
    <div className="min-h-screen bg-[#F5F5F7] pb-24">
      <div className="max-w-2xl mx-auto px-5 pt-8">

        {/* Header */}
        <div className="flex items-center gap-3 mb-8">
          <Link href="/health"><button className="w-9 h-9 rounded-full bg-white shadow-sm flex items-center justify-center hover:bg-gray-50 transition-colors"><ChevronLeft className="w-5 h-5 text-gray-500" /></button></Link>
          <div><h1 className="text-2xl font-bold text-gray-900">饮水追踪</h1><p className="text-sm text-gray-500 mt-0.5">保持水分, 保持活力</p></div>
        </div>

        {/* Progress Circle */}
        <motion.div initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} transition={{ duration: 0.4 }} className="flex flex-col items-center mb-8">
          <div className="relative w-48 h-48">
            <svg viewBox="0 0 200 200" className="w-full h-full -rotate-90">
              <circle cx="100" cy="100" r="90" fill="none" stroke={TRACK_COLOR} strokeWidth="14" />
              <motion.circle cx="100" cy="100" r="90" fill="none" stroke="url(#waterGradient)" strokeWidth="14" strokeLinecap="round"
                strokeDasharray={`${strokeDash} ${CIRCUMFERENCE}`}
                initial={{ strokeDasharray: `0 ${CIRCUMFERENCE}` }}
                animate={{ strokeDasharray: `${strokeDash} ${CIRCUMFERENCE}` }}
                transition={{ duration: 0.8, ease: "easeOut" }}
              />
              <defs><linearGradient id="waterGradient" x1="0" y1="0" x2="1" y2="1"><stop offset="0%" stopColor="#FF9500" /><stop offset="100%" stopColor="#FFB84D" /></linearGradient></defs>
            </svg>
            <div className="absolute inset-0 flex flex-col items-center justify-center">
              <motion.span key={percent} initial={{ scale: 1.2, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} className="text-4xl font-bold text-gray-900">{percent}%</motion.span>
              <span className="text-sm text-gray-500 mt-1">{todayWaterTotal} / {dailyTarget} ml</span>
            </div>
          </div>
        </motion.div>

        {/* Quick Add */}
        <div className="flex gap-3 mb-6">
          {QUICK_AMOUNTS.map((amount) => (
            <motion.button key={amount} whileTap={{ scale: 0.95 }} onClick={() => handleAdd(amount)} disabled={addingMap[amount]}
              className="flex-1 py-3 rounded-full bg-white shadow-sm border border-gray-100 text-gray-700 font-medium text-sm flex items-center justify-center gap-1.5 hover:bg-orange-50 hover:border-orange-200 transition-colors disabled:opacity-50">
              <Plus className="w-4 h-4" />+{amount}ml
            </motion.button>
          ))}
        </div>

        {/* Today Log */}
        <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.05 }} className="bg-white rounded-2xl shadow-sm p-4 mb-4">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide">今日记录</h2>
            {sortedLogs.length > 0 && <span className="text-xs text-gray-400">已喝 {sortedLogs.length} 次</span>}
          </div>
          {sortedLogs.length === 0 ? (
            <div className="flex flex-col items-center py-6 text-gray-400"><Droplets className="w-10 h-10 mb-2 opacity-30" /><span className="text-sm">今日暂无饮水记录</span></div>
          ) : (
            <div className="space-y-2">
              {sortedLogs.map((entry, i) => (
                <motion.div key={entry.id} initial={{ opacity: 0, x: -8 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: i * 0.03 }}
                  className="flex items-center justify-between py-2 px-3 rounded-xl bg-orange-50/60">
                  <div className="flex items-center gap-2">
                    <Droplets className="w-4 h-4 text-[#FF9500]" />
                    <span className="text-sm text-gray-700">{formatTimestamp(entry.timestamp)}</span>
                  </div>
                  <span className="text-sm font-bold text-[#FF9500]">{entry.amount} ml</span>
                </motion.div>
              ))}
            </div>
          )}
        </motion.div>

        {/* Goal Settings */}
        <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.08 }} className="bg-white rounded-2xl shadow-sm p-4 mb-4">
          <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-3">每日饮水目标</h2>
          <div className="flex items-center gap-3">
            <input type="number" value={goalInput} onChange={(e) => setGoalInput(Math.max(0, parseInt(e.target.value) || 0))}
              min={100} max={10000} step={50}
              className="flex-1 px-4 py-2.5 rounded-xl bg-[#F2F2F7] text-gray-900 font-medium text-sm outline-none focus:ring-2 focus:ring-[#FF9500]/30 transition-all" />
            <span className="text-sm text-gray-400 font-medium">ml</span>
            <motion.button whileTap={{ scale: 0.95 }} onClick={handleSaveGoal}
              className="px-5 py-2.5 rounded-xl text-white text-sm font-semibold transition-colors" style={{ backgroundColor: BRAND }}>保存</motion.button>
          </div>
        </motion.div>

        {/* Reminder Settings */}
        <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }} className="bg-white rounded-2xl shadow-sm p-4 mb-4">
          <div className="flex items-center gap-2 mb-3"><Bell className="w-4 h-4 text-[#FF9500]" /><h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide">定时提醒</h2></div>
          <div className="flex flex-wrap gap-2">
            {REMINDER_OPTIONS.map((opt) => {
              const isActive = reminderInterval === opt.value;
              return (
                <motion.button key={opt.value} whileTap={{ scale: 0.95 }} onClick={() => handleReminder(opt.value)}
                  className="px-4 py-2 rounded-full text-sm font-medium transition-all"
                  style={{ backgroundColor: isActive ? BRAND : TRACK_COLOR, color: isActive ? "#FFFFFF" : "#374151" }}>{opt.label}</motion.button>
              );
            })}
          </div>
        </motion.div>

        {/* Night Mode */}
        <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.12 }} className="bg-white rounded-2xl shadow-sm p-4 mb-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2"><Moon className="w-4 h-4 text-[#FF9500]" /><span className="text-sm font-medium text-gray-700">夜间免打扰 (22:00-08:00)</span></div>
            <button onClick={handleNightMode} className="relative inline-flex items-center cursor-pointer">
              <div className="w-[51px] h-[31px] rounded-full transition-colors duration-300" style={{ backgroundColor: nightMode ? BRAND : "#D1D5DB" }}>
                <motion.div className="w-[27px] h-[27px] rounded-full bg-white shadow-md" animate={{ x: nightMode ? 22 : 2 }} transition={{ type: "spring", stiffness: 500, damping: 30 }} style={{ marginTop: 2 }} />
              </div>
            </button>
          </div>
        </motion.div>

        {/* 7-Day Chart */}
        <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.14 }} className="bg-white rounded-2xl shadow-sm p-4 mb-4">
          <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-4">近7天</h2>
          <div className="flex items-end gap-3 h-32">
            {weekData.map((val, i) => {
              const h = maxWeek > 0 ? (val / maxWeek) * 100 : 0;
              const isToday = i === weekData.length - 1;
              return (
                <div key={i} className="flex-1 flex flex-col items-center gap-1.5 h-full justify-end">
                  <motion.div initial={{ height: 0 }} animate={{ height: `${Math.max(h, 2)}%` }} transition={{ delay: 0.2 + i * 0.06, duration: 0.5 }}
                    className="w-full rounded-t-xl" style={{ backgroundColor: isToday ? BRAND : "#FFE0B2", minHeight: 4 }} />
                  <span className="text-[10px] text-gray-400">{WEEKDAY_LABELS[i]}</span>
                </div>
              );
            })}
          </div>
          <div className="mt-2 text-xs text-gray-400 text-center">日均 {avgWeek} ml · 目标 {dailyTarget} ml</div>
        </motion.div>

        {/* Bottom Link */}
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.18 }} className="text-center mb-8">
          <Link href="/health/water/stats" className="inline-flex items-center gap-1 text-sm font-medium transition-colors" style={{ color: BRAND }}>
            查看饮水完整统计 <ChevronLeft className="w-4 h-4 rotate-180" />
          </Link>
        </motion.div>

      </div>
    </div>
  );
}
