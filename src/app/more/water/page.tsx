"use client";

import { useEffect, useState, useMemo, useCallback } from "react";
import { useRouter } from "next/navigation";
import { useLiveQuery } from "dexie-react-hooks";
import { motion } from "framer-motion";
import { ChevronLeft, Droplets, Plus, Minus, RefreshCw, Check } from "lucide-react";
import { daylogDB, ensureModuleItem, updateItem, getRoutines } from "@/lib/db/daylog.db";
import { syncItemReminder } from "@/lib/reminderDefaults";
import type { Item } from "@/lib/db/daylog.db";
import { healthDB, getWaterGoal, updateWaterGoal } from "@/lib/db/health.db";
import { sendNotification } from "@/lib/notificationService";

/* ────────── Helpers ────────── */

function todayStr(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function addMinutes(time: string, mins: number): string {
  const [h, m] = time.split(":").map(Number);
  const total = h * 60 + m + mins;
  const nh = Math.floor(total / 60) % 24;
  const nm = total % 60;
  return `${String(nh).padStart(2, "0")}:${String(nm).padStart(2, "0")}`;
}

function dateAddDays(dateStr: string, days: number): string {
  const d = new Date(dateStr + "T00:00:00");
  d.setDate(d.getDate() + days);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function isNapHour(hour: number, napStart: string, napEnd: string): boolean {
  if (!napStart || !napEnd) return false;
  const ns = parseInt(napStart.split(":")[0]);
  const ne = parseInt(napEnd.split(":")[0]);
  if (isNaN(ns) || isNaN(ne)) return false;
  return hour >= ns && hour < ne;
}

function generateWaterSourceId(date: string, timeStr: string): string {
  return `water_${date}_${timeStr}`;
}

/* ────────── Settings type ────────── */

interface WaterSettings {
  wakeStart: string;
  wakeEnd: string;
  dailyTarget: number;
}

const DEFAULT_SETTINGS: WaterSettings = {
  wakeStart: "08:00",
  wakeEnd: "22:00",
  dailyTarget: 2000,
};

/* ────────── Component ────────── */

export default function WaterPage() {
  const router = useRouter();
  const today = todayStr();

  const [settings, setSettings] = useState<WaterSettings>(DEFAULT_SETTINGS);
  const [settingsLoaded, setSettingsLoaded] = useState(false);
  const [generating, setGenerating] = useState(false);

  /* ─── Nap time from routines ─── */
  const [napStart, setNapStart] = useState("");
  const [napEnd, setNapEnd] = useState("");
  const [hasNap, setHasNap] = useState(false);

  /* ─── Load settings from WaterGoal + nap from routines ─── */

  useEffect(() => {
    (async () => {
      try {
        const goal = await getWaterGoal();
        setSettings({
          wakeStart: goal.wakeStart || DEFAULT_SETTINGS.wakeStart,
          wakeEnd: goal.wakeEnd || DEFAULT_SETTINGS.wakeEnd,
          dailyTarget: goal.dailyTarget || DEFAULT_SETTINGS.dailyTarget,
        });

        // Read nap time from routines (type='nap', isActive)
        const allRoutines = await getRoutines();
        const napRoutine = allRoutines.find(r => r.type === 'nap' && r.isActive);
        if (napRoutine) {
          setNapStart(napRoutine.startTime);
          setNapEnd(napRoutine.endTime);
          setHasNap(true);
        }
      } catch {
        // Use defaults on error
      }
      setSettingsLoaded(true);
    })();
  }, []);

  /* ─── Auto-generate items for next 7 days when settings load ─── */

  useEffect(() => {
    if (!settingsLoaded) return;
    generateItemsForNext7Days();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [settingsLoaded]);

  /* ─── Live query: today's water items ─── */

  const todayItems = useLiveQuery(
    () =>
      daylogDB.items
        .where("date")
        .equals(today)
        .filter((item) => item.sourceType === "water")
        .sortBy("plannedStart"),
    [today],
  );

  /* ─── Core: generate water items ─── */

  const generateItemsForNext7Days = useCallback(async () => {
    setGenerating(true);
    try {
      const startH = parseInt(settings.wakeStart.split(":")[0]);
      const endH = parseInt(settings.wakeEnd.split(":")[0]);
      const stopH = endH - 2; // 2 hours before sleep

      for (let d = 0; d < 7; d++) {
        const date = dateAddDays(today, d);

        for (let h = startH; h < stopH; h++) {
          // Skip nap hours (from routines)
          if (hasNap && isNapHour(h, napStart, napEnd)) continue;

          const timeStr = `${String(h).padStart(2, "0")}:30`;
          const endTime = addMinutes(timeStr, 5);
          const sourceId = generateWaterSourceId(date, timeStr);

          const itemId = await ensureModuleItem({
            date,
            sourceType: "water",
            sourceId,
            title: "喝口水然后动一动不要久坐",
            plannedStart: timeStr,
            plannedEnd: endTime,
            color: "#0EA5E9",
            icon: "Droplets",
            isCompleted: false,
          });
          if (itemId) {
            await syncItemReminder({
              id: itemId,
              sourceType: "water",
              sourceId,
              date,
              title: "喝口水然后动一动不要久坐",
              plannedStart: timeStr,
              plannedEnd: endTime,
              actualStart: timeStr,
              actualEnd: endTime,
              isCorrected: false,
              isCompleted: false,
              sortOrder: 1,
              createdAt: Date.now(),
              updatedAt: Date.now(),
            } as Item);
          }
        }
      }
      sendNotification("💧 今天的喝水提醒已就绪", "", "water-reminder");
    } finally {
      setGenerating(false);
    }
  }, [settings, today]);

  /* ─── Regenerate: clear + recreate ─── */

  const handleRegenerate = useCallback(async () => {
    setGenerating(true);
    try {
      // Clear all water items for next 7 days
      for (let d = 0; d < 7; d++) {
        const date = dateAddDays(today, d);
        await daylogDB.items
          .where("date")
          .equals(date)
          .filter((item) => item.sourceType === "water")
          .delete();
      }
      // Recreate
      await generateItemsForNext7Days();
    } finally {
      setGenerating(false);
    }
  }, [today, generateItemsForNext7Days]);

  /* ─── Toggle item completion ─── */

  const handleToggle = useCallback(async (id: string, current: boolean) => {
    await updateItem(id, { isCompleted: !current });
  }, []);

  /* ─── Save settings to WaterGoal ─── */

  const handleSaveSettings = useCallback(
    async (updates: Partial<WaterSettings>) => {
      const merged = { ...settings, ...updates };
      setSettings(merged);
      try {
        await updateWaterGoal({
          dailyTarget: merged.dailyTarget,
          wakeStart: merged.wakeStart,
          wakeEnd: merged.wakeEnd,
        });
      } catch {
        // Silently fail
      }
    },
    [settings],
  );

  /* ─── Derived stats ─── */

  const completedCount = useMemo(
    () => todayItems?.filter((i) => i.isCompleted).length ?? 0,
    [todayItems],
  );
  const totalCount = todayItems?.length ?? 0;
  const totalWaterMl = totalCount * 100; // 100ml per item

  const percent = settings.dailyTarget > 0
    ? Math.min(100, Math.round((totalWaterMl / settings.dailyTarget) * 100))
    : 0;

  /* ─── SVG Ring measurements ─── */

  const ringSize = 196;
  const ringStroke = 10;
  const ringRadius = (ringSize - ringStroke) / 2;
  const circumference = 2 * Math.PI * ringRadius;
  const dashOffset = circumference * (1 - percent / 100);

  /* ─── Loading state ─── */

  if (!settingsLoaded || todayItems === undefined) {
    return (
      <div className="min-h-screen" style={{ background: "var(--lifeflow-background)" }}>
        <header className="flex items-center h-11 px-4">
          <div
            className="inline-flex h-8 w-8 items-center justify-center rounded-lg"
            style={{
              background: "var(--color-surface-card)",
              border: "1px solid var(--lifeflow-border)",
            }}
          />
        </header>
        <div className="px-4 pt-4 flex flex-col gap-4">
          <div
            className="animate-pulse h-48 rounded-[20px]"
            style={{ background: "var(--lifeflow-muted)" }}
          />
          <div
            className="animate-pulse h-32 rounded-[20px]"
            style={{ background: "var(--lifeflow-muted)" }}
          />
          <div
            className="animate-pulse h-40 rounded-[20px]"
            style={{ background: "var(--lifeflow-muted)" }}
          />
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
          style={{
            background: "var(--color-surface-card)",
            border: "1px solid var(--lifeflow-border)",
          }}
          aria-label="返回"
        >
          <ChevronLeft className="h-5 w-5" style={{ color: "var(--color-text-primary)" }} />
        </button>
        <h1
          className="flex-1 text-center text-[17px] font-semibold tracking-[-0.018em]"
          style={{ color: "var(--color-text-primary)" }}
        >
          饮水
        </h1>
        <div className="w-8" />
      </header>

      {/* ─── Progress Ring Card ─── */}
      <div className="px-4 pt-4">
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.35, ease: [0.32, 0.72, 0, 1] }}
          className="flex flex-col items-center p-6"
          style={{
            background: "var(--color-surface-card)",
            borderRadius: "20px",
            boxShadow: "var(--shadow-card)",
          }}
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
                style={{
                  transition: "stroke-dashoffset 0.6s cubic-bezier(0.32, 0.72, 0, 1)",
                }}
              />
            </svg>
            <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
              <Droplets className="h-9 w-9" style={{ color: "var(--lifeflow-primary)" }} />
              <span
                className="text-[28px] font-bold mt-1 tracking-[-0.022em]"
                style={{ color: "var(--color-text-primary)" }}
              >
                {completedCount}/{totalCount}
              </span>
              <span
                className="text-[13px] font-medium"
                style={{ color: "var(--color-text-secondary)" }}
              >
                {totalWaterMl} / {settings.dailyTarget} ml
              </span>
            </div>
          </div>
        </motion.div>
      </div>

      {/* ─── Settings Card ─── */}
      <div className="px-4 pt-4">
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.05, duration: 0.35, ease: [0.32, 0.72, 0, 1] }}
          className="p-4"
          style={{
            background: "var(--color-surface-card)",
            borderRadius: "20px",
            boxShadow: "var(--shadow-card)",
          }}
        >
          <h2
            className="text-[17px] font-semibold mb-3"
            style={{ color: "var(--color-text-primary)" }}
          >
            时间设置
          </h2>

          {/* Wake Start */}
          <div className="flex items-center justify-between h-10">
            <span className="text-[15px]" style={{ color: "var(--color-text-primary)" }}>
              起床时间
            </span>
            <input
              type="time"
              value={settings.wakeStart}
              onChange={(e) => handleSaveSettings({ wakeStart: e.target.value })}
              className="h-8 px-3 rounded-lg text-[14px] font-medium outline-none"
              style={{
                background: "var(--lifeflow-muted)",
                color: "var(--color-text-primary)",
                border: "1px solid var(--lifeflow-border)",
              }}
            />
          </div>

          {/* Wake End */}
          <div className="flex items-center justify-between h-10 mt-1">
            <span className="text-[15px]" style={{ color: "var(--color-text-primary)" }}>
              入睡时间
            </span>
            <input
              type="time"
              value={settings.wakeEnd}
              onChange={(e) => handleSaveSettings({ wakeEnd: e.target.value })}
              className="h-8 px-3 rounded-lg text-[14px] font-medium outline-none"
              style={{
                background: "var(--lifeflow-muted)",
                color: "var(--color-text-primary)",
                border: "1px solid var(--lifeflow-border)",
              }}
            />
          </div>

          <div
            className="my-3"
            style={{ height: "0.5px", background: "var(--lifeflow-border)" }}
          />

          {/* Nap Time (read-only from routines) */}
          <div className="flex items-center justify-between h-10">
            <span className="text-[15px]" style={{ color: "var(--color-text-primary)" }}>
              午睡时间
            </span>
            <span className="text-[14px] font-medium" style={{ color: "var(--color-text-secondary)" }}>
              {hasNap ? `${napStart} - ${napEnd}` : "未设置"}
            </span>
          </div>
          <p className="text-[11px] mt-0.5" style={{ color: "var(--color-text-disabled)" }}>
            午睡时间来自作息模板，如需修改请前往作息设置
          </p>

          <div
            className="my-3"
            style={{ height: "0.5px", background: "var(--lifeflow-border)" }}
          />

          {/* Daily Target Stepper */}
          <div className="flex items-center justify-between h-10">
            <span className="text-[15px]" style={{ color: "var(--color-text-primary)" }}>
              每日目标
            </span>
            <div className="flex items-center gap-4">
              <motion.button
                type="button"
                whileTap={{ scale: 0.9 }}
                onClick={() =>
                  handleSaveSettings({ dailyTarget: Math.max(100, settings.dailyTarget - 100) })
                }
                className="w-7 h-7 rounded-full border-[1.5px] flex items-center justify-center"
                style={{
                  borderColor: "var(--lifeflow-primary)",
                  background: "var(--color-surface-card)",
                }}
              >
                <Minus className="w-3.5 h-3.5" style={{ color: "var(--lifeflow-primary)" }} />
              </motion.button>
              <span
                className="text-[16px] font-bold min-w-[60px] text-center"
                style={{ color: "var(--color-text-primary)" }}
              >
                {settings.dailyTarget}ml
              </span>
              <motion.button
                type="button"
                whileTap={{ scale: 0.9 }}
                onClick={() =>
                  handleSaveSettings({ dailyTarget: settings.dailyTarget + 100 })
                }
                className="w-7 h-7 rounded-full border-[1.5px] flex items-center justify-center"
                style={{
                  borderColor: "var(--lifeflow-primary)",
                  background: "var(--color-surface-card)",
                }}
              >
                <Plus className="w-3.5 h-3.5" style={{ color: "var(--lifeflow-primary)" }} />
              </motion.button>
            </div>
          </div>

          <div
            className="my-3"
            style={{ height: "0.5px", background: "var(--lifeflow-border)" }}
          />

          {/* Regenerate Button */}
          <motion.button
            type="button"
            whileTap={{ scale: 0.96 }}
            disabled={generating}
            onClick={handleRegenerate}
            className="w-full h-10 rounded-full text-[15px] font-semibold flex items-center justify-center gap-2 disabled:opacity-50"
            style={{
              background: "var(--lifeflow-brand-50)",
              color: "var(--lifeflow-primary)",
            }}
          >
            <RefreshCw className={`w-4 h-4 ${generating ? "animate-spin" : ""}`} />
            重新生成事项
          </motion.button>
        </motion.div>
      </div>

      {/* ─── Today's Items Preview Card ─── */}
      <div className="px-4 pt-4">
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1, duration: 0.35, ease: [0.32, 0.72, 0, 1] }}
          className="p-4"
          style={{
            background: "var(--color-surface-card)",
            borderRadius: "20px",
            boxShadow: "var(--shadow-card)",
          }}
        >
          <div className="flex items-center justify-between mb-3">
            <h2
              className="text-[17px] font-semibold"
              style={{ color: "var(--color-text-primary)" }}
            >
              今日事项
            </h2>
            <span
              className="text-[13px] font-medium"
              style={{ color: "var(--color-text-secondary)" }}
            >
              {completedCount}/{totalCount} 杯
            </span>
          </div>

          {totalCount === 0 ? (
            <div className="flex flex-col items-center justify-center py-8">
              <Droplets className="h-10 w-10" style={{ color: "var(--color-text-disabled)" }} />
              <p
                className="text-[13px] font-medium mt-3 text-center"
                style={{ color: "var(--color-text-secondary)" }}
              >
                还没有今天的饮水事项
                <br />
                请确认时间设置后点击「重新生成事项」
              </p>
            </div>
          ) : (
            <div className="flex flex-col gap-0.5">
              {todayItems!.map((item) => (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => handleToggle(item.id, item.isCompleted)}
                  className="flex items-center gap-3 h-[46px] px-3 rounded-xl transition-colors w-full text-left"
                  style={{ background: "transparent" }}
                >
                  {/* Custom Checkbox */}
                  <div
                    className="w-5 h-5 rounded-md border-2 flex items-center justify-center shrink-0 transition-colors"
                    style={{
                      borderColor: item.isCompleted
                        ? "var(--lifeflow-primary)"
                        : "var(--lifeflow-border)",
                      background: item.isCompleted
                        ? "var(--lifeflow-primary)"
                        : "transparent",
                    }}
                  >
                    {item.isCompleted && <Check className="w-3 h-3 text-white" />}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div
                      className="text-[14px] font-medium truncate"
                      style={{
                        color: item.isCompleted
                          ? "var(--color-text-disabled)"
                          : "var(--color-text-primary)",
                        textDecoration: item.isCompleted ? "line-through" : "none",
                      }}
                    >
                      喝口水然后动一动不要久坐
                    </div>
                    <div
                      className="text-[12px]"
                      style={{ color: "var(--color-text-secondary)" }}
                    >
                      {item.plannedStart} - {item.plannedEnd} · 100ml
                    </div>
                  </div>
                </button>
              ))}
            </div>
          )}
        </motion.div>
      </div>

      {/* ─── Stats Card ─── */}
      <div className="px-4 pt-4">
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.15, duration: 0.35, ease: [0.32, 0.72, 0, 1] }}
          className="p-4"
          style={{
            background: "var(--color-surface-card)",
            borderRadius: "20px",
            boxShadow: "var(--shadow-card)",
          }}
        >
          <h2
            className="text-[17px] font-semibold mb-3"
            style={{ color: "var(--color-text-primary)" }}
          >
            今日统计
          </h2>
          <div className="grid grid-cols-3 gap-3">
            <div
              className="text-center p-3 rounded-xl"
              style={{ background: "var(--lifeflow-muted)" }}
            >
              <div
                className="text-[22px] font-bold"
                style={{ color: "var(--lifeflow-primary)" }}
              >
                {completedCount}
              </div>
              <div
                className="text-[12px] font-medium mt-0.5"
                style={{ color: "var(--color-text-secondary)" }}
              >
                已完成
              </div>
            </div>
            <div
              className="text-center p-3 rounded-xl"
              style={{ background: "var(--lifeflow-muted)" }}
            >
              <div
                className="text-[22px] font-bold"
                style={{ color: "var(--color-text-primary)" }}
              >
                {totalCount}
              </div>
              <div
                className="text-[12px] font-medium mt-0.5"
                style={{ color: "var(--color-text-secondary)" }}
              >
                总杯数
              </div>
            </div>
            <div
              className="text-center p-3 rounded-xl"
              style={{ background: "var(--lifeflow-muted)" }}
            >
              <div
                className="text-[22px] font-bold"
                style={{ color: totalWaterMl >= settings.dailyTarget ? "var(--lifeflow-primary)" : "var(--color-text-primary)" }}
              >
                {totalWaterMl}ml
              </div>
              <div
                className="text-[12px] font-medium mt-0.5"
                style={{ color: "var(--color-text-secondary)" }}
              >
                已饮水
              </div>
            </div>
          </div>
        </motion.div>
      </div>
    </div>
  );
}
