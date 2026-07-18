"use client";

import { useEffect, useState, useMemo, useCallback } from "react";
import { motion } from "framer-motion";
import {
  ChevronLeft, Droplets, Moon, Plus, Trash2, ArrowRight,
} from "lucide-react";
import { useRouter } from "next/navigation";
import { useHealthStore } from "@/lib/store/healthStore";
import { showToast } from "@/components/ui/Toast";

// ============================================================
// 设计稿基准: lifeflow-health/pages/water.html
// 品牌橙 #FF9500
// ============================================================

const BRAND = "#FF9500";
const BG = "#F2F2F7";
const CARD_BG = "#FFFFFF";
const MUTED = "#8E8E93";
const BORDER = "#E5E5EA";
const INPUT_BG = "#F2F2F7";
const INFO = "#007AFF";
const NIGHT_INDIGO = "#5856D6";
const TAG_BG = "#F2F2F7";
const TAG_TEXT = "#8E8E93";
const PROGRESS_TRACK = "#E5E5EA";

const QUICK_AMOUNTS = [200, 300, 500] as const;
const REMINDER_OPTIONS = [
  { label: "30分钟", value: 30 },
  { label: "60分钟", value: 60 },
  { label: "90分钟", value: 90 },
  { label: "120分钟", value: 120 },
  { label: "关闭", value: 0 },
] as const;

// ─── 格式化时间 ──────────────────────────────────────────────

function formatTimestamp(ts: number): string {
  const d = new Date(ts);
  return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
}

// ─── iOS 开关 ────────────────────────────────────────────────

function ToggleSwitch({
  checked,
  onChange,
}: {
  checked: boolean;
  onChange: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onChange}
      className="relative shrink-0 rounded-full cursor-pointer"
      style={{
        width: 51,
        height: 31,
        background: checked ? BRAND : "#D1D5DB",
        transition: "background 0.2s",
      }}
    >
      <motion.div
        className="absolute rounded-full bg-white"
        animate={{ x: checked ? 22 : 2 }}
        transition={{ type: "spring", stiffness: 500, damping: 30 }}
        style={{ width: 27, height: 27, top: 2, boxShadow: "0 1px 3px rgba(0,0,0,0.2)" }}
      />
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

  // 本地状态
  const [goalInput, setGoalInput] = useState(2000);
  const [addingMap, setAddingMap] = useState<Record<number, boolean>>({});
  const [pageLoading, setPageLoading] = useState(true);

  const dailyTarget = waterGoal?.dailyTarget ?? 2000;
  const reminderInterval = waterGoal?.reminderInterval ?? 0;
  const nightMode = waterGoal?.nightMode ?? false;

  // 初始化同步 goalInput
  useEffect(() => {
    if (!pageLoading) setGoalInput(dailyTarget);
  }, [dailyTarget, pageLoading]);

  // 加载数据
  useEffect(() => {
    (async () => {
      setPageLoading(true);
      await loadWaterData();
      setPageLoading(false);
    })();
  }, [loadWaterData]);

  // 进度
  const percent = useMemo(() => {
    if (dailyTarget <= 0) return 0;
    return Math.min(100, Math.round((todayWaterTotal / dailyTarget) * 100));
  }, [todayWaterTotal, dailyTarget]);

  // 按时间倒序
  const sortedLogs = useMemo(
    () => [...waterLogs].sort((a, b) => b.timestamp - a.timestamp),
    [waterLogs],
  );

  // ─── 操作 ──────────────────────────────────────────────────

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

  const handleDelete = useCallback(
    async (id: string) => {
      await deleteWaterLogAction(id);
    },
    [deleteWaterLogAction],
  );

  const handleSaveGoal = useCallback(() => {
    const v = Math.max(100, Math.min(10000, Math.round(goalInput)));
    setGoalInput(v);
    updateWaterGoalAction({ dailyTarget: v });
    showToast({ type: "success", message: "已保存" });
  }, [goalInput, updateWaterGoalAction]);

  const handleReminder = useCallback(
    (value: number) => {
      updateWaterGoalAction({ reminderInterval: value });
    },
    [updateWaterGoalAction],
  );

  const handleNightMode = useCallback(() => {
    updateWaterGoalAction({ nightMode: !nightMode });
  }, [nightMode, updateWaterGoalAction]);

  const showStatsToast = () => showToast({ type: "info", message: "功能开发中" });

  // ════════════════════════════════════════════════════════════

  return (
    <div>
      {/* ===== 1. 页头 ===== */}
      <header
        className="px-4 pt-12 pb-3 flex flex-col gap-0.5"
        style={{ backgroundColor: BG }}
      >
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => router.push("/health")}
            className="inline-flex items-center justify-center w-8 h-8 -ml-1"
            aria-label="返回"
          >
            <ChevronLeft className="w-6 h-6" style={{ color: "#000000" }} />
          </button>
          <span className="text-[18px] font-semibold truncate" style={{ color: "#000000" }}>
            喝水提醒
          </span>
        </div>
        <p className="text-[13px] pl-10" style={{ color: MUTED }}>
          定时推送·一键喝水
        </p>
      </header>

      {/* ===== 2. 提示条 ===== */}
      {pageLoading && (
        <div className="px-4 pb-3">
          <p className="text-center text-[13px]" style={{ color: MUTED }}>
            暂无饮水目标，在项目中创建以追踪饮水进度
          </p>
        </div>
      )}

      {/* ===== 3. 卡片组 ===== */}
      <div className="px-4 flex flex-col gap-3 pb-3">
        {/* 卡片 1 · 今日饮水进度 */}
        <motion.section
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          className="rounded-[12px] border p-4 flex flex-col gap-3"
          style={{
            background: CARD_BG,
            borderColor: BORDER,
            borderWidth: 1,
          }}
        >
          <div className="flex items-center gap-2">
            <Droplets className="w-5 h-5 shrink-0" style={{ color: INFO }} />
            <h2 className="text-[17px] font-semibold truncate" style={{ color: "#000000" }}>
              今日饮水进度
            </h2>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-[13px]" style={{ color: MUTED }}>
              已完成 {percent}%
            </span>
            <span className="text-[13px]" style={{ color: MUTED }}>
              {todayWaterTotal}/{dailyTarget} ml
            </span>
          </div>
          <div className="h-2 rounded-[4px] w-full" style={{ background: PROGRESS_TRACK }}>
            <motion.div
              className="h-2 rounded-[4px]"
              initial={{ width: 0 }}
              animate={{ width: `${percent}%` }}
              transition={{ duration: 0.5, ease: "easeOut" }}
              style={{ background: BRAND }}
            />
          </div>
          <span className="text-[13px]" style={{ color: MUTED }}>
            已喝 {waterLogs.length} 次
          </span>
        </motion.section>

        {/* 卡片 2 · 每日饮水目标 */}
        <motion.section
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.05 }}
          className="rounded-[12px] border p-4 flex flex-col gap-3"
          style={{
            background: CARD_BG,
            borderColor: BORDER,
            borderWidth: 1,
          }}
        >
          <h2 className="text-[17px] font-semibold truncate" style={{ color: "#000000" }}>
            每日饮水目标
          </h2>
          <div className="flex items-center gap-2">
            <div
              className="flex items-center flex-1 min-w-0 rounded-[8px] px-3 h-10"
              style={{ backgroundColor: INPUT_BG }}
            >
              <input
                type="number"
                value={goalInput}
                onChange={(e) => setGoalInput(Math.max(0, parseInt(e.target.value) || 0))}
                className="flex-1 min-w-0 bg-transparent text-[17px] outline-none border-none"
                style={{ color: "#000000" }}
              />
            </div>
            <span className="text-[15px] shrink-0" style={{ color: MUTED }}>ml</span>
            <button
              type="button"
              onClick={handleSaveGoal}
              className="shrink-0 h-10 px-5 rounded-[22px] text-[15px] font-medium"
              style={{ backgroundColor: BRAND, color: "#FFFFFF" }}
            >
              保存
            </button>
          </div>
        </motion.section>

        {/* 卡片 3 · 定时提醒 */}
        <motion.section
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="rounded-[12px] border p-4 flex flex-col gap-3"
          style={{
            background: CARD_BG,
            borderColor: BORDER,
            borderWidth: 1,
          }}
        >
          <div className="flex items-center gap-2">
            <Droplets className="w-5 h-5 shrink-0" style={{ color: INFO }} />
            <h2 className="text-[17px] font-semibold truncate" style={{ color: "#000000" }}>
              定时提醒
            </h2>
            <span
              className="shrink-0 inline-flex items-center h-[22px] px-2 rounded-[13px] text-[12px]"
              style={{ backgroundColor: TAG_BG, color: TAG_TEXT }}
            >
              {reminderInterval > 0 ? "已开启" : "已关闭"}
            </span>
          </div>
          <p className="text-[13px]" style={{ color: MUTED }}>
            {reminderInterval > 0
              ? `每 ${reminderInterval} 分钟提醒一次`
              : "提醒已关闭"}
          </p>
          <div
            className="border-b"
            style={{ borderColor: BORDER, borderWidth: "0.5px" }}
          />
          <span className="text-[13px]" style={{ color: MUTED }}>
            提醒间隔
          </span>
          <div className="flex flex-nowrap gap-2 overflow-x-auto" style={{ scrollbarWidth: "none" }}>
            <style>{`.overflow-x-auto::-webkit-scrollbar{display:none}`}</style>
            {REMINDER_OPTIONS.map((opt) => {
              const active = reminderInterval === opt.value;
              return (
                <button
                  key={opt.value}
                  type="button"
                  onClick={() => handleReminder(opt.value)}
                  className="shrink-0 inline-flex items-center justify-center h-8 px-4 rounded-[16px] text-[14px] whitespace-nowrap"
                  style={{
                    backgroundColor: active ? BRAND : INPUT_BG,
                    color: active ? "#FFFFFF" : "#000000",
                    fontWeight: active ? 500 : 400,
                  }}
                >
                  {opt.label}
                </button>
              );
            })}
          </div>
        </motion.section>

        {/* 卡片 4 · 夜间免打扰 */}
        <motion.section
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.15 }}
          className="rounded-[12px] border p-4 flex flex-col gap-2"
          style={{
            background: CARD_BG,
            borderColor: BORDER,
            borderWidth: 1,
          }}
        >
          <div className="flex items-center gap-2">
            <Moon className="w-5 h-5 shrink-0" style={{ color: NIGHT_INDIGO }} />
            <h2 className="text-[17px] font-semibold truncate flex-1" style={{ color: "#000000" }}>
              夜间免打扰
            </h2>
            <span
              className="shrink-0 inline-flex items-center h-[22px] px-2 rounded-[13px] text-[12px] mr-2"
              style={{ backgroundColor: TAG_BG, color: TAG_TEXT }}
            >
              {nightMode ? "已开启" : "已关闭"}
            </span>
            <ToggleSwitch checked={nightMode} onChange={handleNightMode} />
          </div>
          <p className="text-[13px]" style={{ color: MUTED }}>
            {nightMode ? "22:00–08:00 不推送提醒" : "已关闭"}
          </p>
        </motion.section>

        {/* 卡片 5 · 快捷喝水 */}
        <motion.section
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="rounded-[12px] border p-4 flex flex-col gap-3"
          style={{
            background: CARD_BG,
            borderColor: BORDER,
            borderWidth: 1,
          }}
        >
          <h2 className="text-[17px] font-semibold truncate" style={{ color: "#000000" }}>
            快捷喝水
          </h2>
          <p className="text-[13px]" style={{ color: MUTED }}>
            与主页人物框共享水杯预设值
          </p>
          <div className="flex flex-nowrap gap-2 overflow-x-auto" style={{ scrollbarWidth: "none" }}>
            {QUICK_AMOUNTS.map((amount) => (
              <button
                key={amount}
                type="button"
                onClick={() => handleAdd(amount)}
                disabled={addingMap[amount]}
                className="shrink-0 inline-flex items-center gap-1 h-9 px-4 rounded-[18px] text-[15px]"
                style={{
                  backgroundColor: INPUT_BG,
                  color: "#000000",
                  opacity: addingMap[amount] ? 0.5 : 1,
                }}
              >
                <Plus className="w-[14px] h-[14px] shrink-0" />
                <span className="whitespace-nowrap">{amount}ml</span>
              </button>
            ))}
          </div>
        </motion.section>

        {/* 卡片 6 · 今日饮水明细 */}
        <motion.section
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.25 }}
          className="rounded-[12px] border p-4 flex flex-col gap-2"
          style={{
            background: CARD_BG,
            borderColor: BORDER,
            borderWidth: 1,
          }}
        >
          <h2 className="text-[17px] font-semibold truncate" style={{ color: "#000000" }}>
            今日饮水明细
          </h2>
          {sortedLogs.length === 0 ? (
            <div className="flex items-center justify-center py-6">
              <span className="text-[13px]" style={{ color: MUTED }}>
                今日暂无饮水记录
              </span>
            </div>
          ) : (
            sortedLogs.map((entry, i) => (
              <div
                key={entry.id}
                className="flex items-center justify-between py-2"
                style={{
                  borderBottom:
                    i < sortedLogs.length - 1
                      ? "0.5px solid #E5E5EA"
                      : "none",
                }}
              >
                <div className="flex items-center gap-2">
                  <Droplets className="w-4 h-4" style={{ color: INFO }} />
                  <span className="text-[13px]" style={{ color: "#000000" }}>
                    {formatTimestamp(entry.timestamp)}
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <span
                    className="text-[13px] font-medium"
                    style={{ color: "#000000" }}
                  >
                    {entry.amount} ml
                  </span>
                  <button
                    type="button"
                    onClick={() => handleDelete(entry.id)}
                    className="inline-flex items-center justify-center"
                    aria-label="删除"
                  >
                    <Trash2 className="w-4 h-4" style={{ color: "#C7C7CC" }} />
                  </button>
                </div>
              </div>
            ))
          )}
        </motion.section>

        {/* ===== 底部链接 ===== */}
        <div className="flex items-center justify-center py-1">
          <button
            type="button"
            onClick={showStatsToast}
            className="inline-flex items-center gap-1 text-[15px] font-medium"
            style={{ color: BRAND }}
          >
            <span>查看饮水完整统计</span>
            <ArrowRight className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );
}
