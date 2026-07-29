"use client";

import { useEffect, useState, useMemo, useCallback } from "react";
import { useRouter } from "next/navigation";
import { useLiveQuery } from "dexie-react-hooks";
import { motion } from "framer-motion";
import { ChevronLeft, Droplets, Check, ChevronRight } from "lucide-react";
import { daylogDB } from "@/lib/db/daylog.db";
import type { Item } from "@/lib/db/daylog.db";
import { healthDB, getWaterGoal, updateWaterGoal } from "@/lib/db/health.db";

/* ────────── Helpers ────────── */

function todayStr(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function dateAddDays(dateStr: string, days: number): string {
  const d = new Date(dateStr + "T00:00:00");
  d.setDate(d.getDate() + days);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

const DAYS_HISTORY = 30;

/* ────────── Settings type ────────── */

interface WaterSettings {
  wakeStart: string;
  wakeEnd: string;
  dailyTarget: number;
}

const DEFAULT_SETTINGS: WaterSettings = {
  wakeStart: "07:00",
  wakeEnd: "22:00",
  dailyTarget: 2000,
};

/* ────────── Component ────────── */

export default function WaterPage() {
  const router = useRouter();
  const today = todayStr();

  const [settings, setSettings] = useState<WaterSettings>(DEFAULT_SETTINGS);
  const [settingsLoaded, setSettingsLoaded] = useState(false);

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
      } catch {
        // Use defaults on error
      }
      setSettingsLoaded(true);
    })();
  }, []);

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

  /* ─── Live query: last 30 days history ─── */

  const historyStart = dateAddDays(today, -DAYS_HISTORY + 1);
  const historyItems = useLiveQuery(
    () =>
      daylogDB.items
        .where("date")
        .between(historyStart, today, true, true)
        .filter((item) => item.sourceType === "water")
        .toArray(),
    [today, historyStart],
  );

  // ── Group history by date ──
  const historyByDay = useMemo(() => {
    if (!historyItems) return [];
    const grouped = new Map<string, Item[]>();
    for (const item of historyItems) {
      const list = grouped.get(item.date) ?? [];
      list.push(item);
      grouped.set(item.date, list);
    }
    // Sort descending by date
    return Array.from(grouped.entries())
      .sort(([a], [b]) => b.localeCompare(a))
      .map(([date, items]) => ({
        date,
        items,
        completed: items.filter(i => i.isCompleted).length,
        total: items.length,
        totalMl: items.filter(i => i.isCompleted).length * 100,
      }));
  }, [historyItems]);

  /* ─── Toggle item completion ─── */

  const handleToggle = useCallback(async (id: string, current: boolean) => {
    const { updateItem } = await import("@/lib/db/daylog.db");
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
  const totalWaterMl = completedCount * 100;

  const percent = settings.dailyTarget > 0
    ? Math.min(100, Math.round((totalWaterMl / settings.dailyTarget) * 100))
    : 0;

  /* ─── SVG Ring measurements ─── */

  const ringSize = 196;
  const ringStroke = 10;
  const ringRadius = (ringSize - ringStroke) / 2;
  const circumference = 2 * Math.PI * ringRadius;
  const dashOffset = circumference * (1 - percent / 100);

  /* ─── Format date for display ─── */

  const formatDate = (dateStr: string): string => {
    const d = new Date(dateStr + "T00:00:00");
    const weekDays = ["日", "一", "二", "三", "四", "五", "六"];
    if (dateStr === today) return "今天";
    const yesterday = dateAddDays(today, -1);
    if (dateStr === yesterday) return "昨天";
    return `${d.getMonth() + 1}/${d.getDate()} 周${weekDays[d.getDay()]}`;
  };

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
          <div className="animate-pulse h-48 rounded-[20px]" style={{ background: "var(--lifeflow-muted)" }} />
          <div className="animate-pulse h-32 rounded-[20px]" style={{ background: "var(--lifeflow-muted)" }} />
          <div className="animate-pulse h-40 rounded-[20px]" style={{ background: "var(--lifeflow-muted)" }} />
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
          onClick={() => router.push("/more/projects")}
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
              <circle
                cx="98" cy="98" r="86"
                fill="none" stroke="var(--lifeflow-muted)" strokeWidth="10"
              />
              <circle
                cx="98" cy="98" r="86"
                fill="none" stroke="var(--lifeflow-primary)" strokeWidth="10"
                strokeDasharray={circumference}
                strokeDashoffset={dashOffset}
                strokeLinecap="round"
                style={{ transition: "stroke-dashoffset 0.6s cubic-bezier(0.32, 0.72, 0, 1)" }}
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
              <span className="text-[13px] font-medium" style={{ color: "var(--color-text-secondary)" }}>
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
          <h2 className="text-[17px] font-semibold mb-3" style={{ color: "var(--color-text-primary)" }}>
            时间设置
          </h2>

          <div className="flex items-center justify-between h-10">
            <span className="text-[15px]" style={{ color: "var(--color-text-primary)" }}>起床时间</span>
            <input
              type="time"
              value={settings.wakeStart}
              onChange={(e) => handleSaveSettings({ wakeStart: e.target.value })}
              className="h-8 px-3 rounded-lg text-[14px] font-medium outline-none"
              style={{ background: "var(--lifeflow-muted)", color: "var(--color-text-primary)", border: "1px solid var(--lifeflow-border)" }}
            />
          </div>

          <div className="flex items-center justify-between h-10 mt-1">
            <span className="text-[15px]" style={{ color: "var(--color-text-primary)" }}>入睡时间</span>
            <input
              type="time"
              value={settings.wakeEnd}
              onChange={(e) => handleSaveSettings({ wakeEnd: e.target.value })}
              className="h-8 px-3 rounded-lg text-[14px] font-medium outline-none"
              style={{ background: "var(--lifeflow-muted)", color: "var(--color-text-primary)", border: "1px solid var(--lifeflow-border)" }}
            />
          </div>

          <div className="my-3" style={{ height: "0.5px", background: "var(--lifeflow-border)" }} />

          <div className="flex items-center justify-between h-10">
            <span className="text-[15px]" style={{ color: "var(--color-text-primary)" }}>每日目标</span>
            <div className="flex items-center gap-4">
              <motion.button
                type="button" whileTap={{ scale: 0.9 }}
                onClick={() => handleSaveSettings({ dailyTarget: Math.max(100, settings.dailyTarget - 100) })}
                className="w-7 h-7 rounded-full border-[1.5px] flex items-center justify-center"
                style={{ borderColor: "var(--lifeflow-primary)", background: "var(--color-surface-card)" }}
              >
                <MinusIcon className="w-3.5 h-3.5" style={{ color: "var(--lifeflow-primary)" }} />
              </motion.button>
              <span className="text-[16px] font-bold min-w-[60px] text-center" style={{ color: "var(--color-text-primary)" }}>
                {settings.dailyTarget}ml
              </span>
              <motion.button
                type="button" whileTap={{ scale: 0.9 }}
                onClick={() => handleSaveSettings({ dailyTarget: settings.dailyTarget + 100 })}
                className="w-7 h-7 rounded-full border-[1.5px] flex items-center justify-center"
                style={{ borderColor: "var(--lifeflow-primary)", background: "var(--color-surface-card)" }}
              >
                <PlusIcon className="w-3.5 h-3.5" style={{ color: "var(--lifeflow-primary)" }} />
              </motion.button>
            </div>
          </div>

          <p className="text-[11px] mt-2" style={{ color: "var(--color-text-disabled)" }}>
            饮水的时段和提醒次数请在首页「饮水提醒」中确认调整
          </p>
        </motion.div>
      </div>

      {/* ─── Today's Stats Card ─── */}
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
          <h2 className="text-[17px] font-semibold mb-3" style={{ color: "var(--color-text-primary)" }}>
            今日统计
          </h2>
          <div className="grid grid-cols-3 gap-3">
            <div className="text-center p-3 rounded-xl" style={{ background: "var(--lifeflow-muted)" }}>
              <div className="text-[22px] font-bold" style={{ color: "var(--lifeflow-primary)" }}>{completedCount}</div>
              <div className="text-[12px] font-medium mt-0.5" style={{ color: "var(--color-text-secondary)" }}>已完成</div>
            </div>
            <div className="text-center p-3 rounded-xl" style={{ background: "var(--lifeflow-muted)" }}>
              <div className="text-[22px] font-bold" style={{ color: "var(--color-text-primary)" }}>{totalCount}</div>
              <div className="text-[12px] font-medium mt-0.5" style={{ color: "var(--color-text-secondary)" }}>总杯数</div>
            </div>
            <div className="text-center p-3 rounded-xl" style={{ background: "var(--lifeflow-muted)" }}>
              <div className="text-[22px] font-bold" style={{ color: totalWaterMl >= settings.dailyTarget ? "var(--lifeflow-primary)" : "var(--color-text-primary)" }}>
                {totalWaterMl}ml
              </div>
              <div className="text-[12px] font-medium mt-0.5" style={{ color: "var(--color-text-secondary)" }}>已饮水</div>
            </div>
          </div>
        </motion.div>
      </div>

      {/* ─── 饮水历史记录 ─── */}
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
          <h2 className="text-[17px] font-semibold mb-3" style={{ color: "var(--color-text-primary)" }}>
            饮水历史（近 30 天）
          </h2>

          {historyByDay.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-8">
              <Droplets className="h-10 w-10" style={{ color: "var(--color-text-disabled)" }} />
              <p className="text-[13px] font-medium mt-3" style={{ color: "var(--color-text-secondary)" }}>
                还没有饮水记录
              </p>
              <p className="text-[12px] mt-1" style={{ color: "var(--color-text-disabled)" }}>
                请从首页「饮水提醒」开启
              </p>
            </div>
          ) : (
            <div className="flex flex-col gap-1 max-h-[400px] overflow-y-auto">
              {historyByDay.map((day) => (
                <div
                  key={day.date}
                  className="flex items-center gap-3 px-3 py-2.5 rounded-xl"
                  style={{ background: day.date === today ? "var(--lifeflow-brand-50)" : "transparent" }}
                >
                  <span className="text-[13px] font-medium min-w-[72px]" style={{ color: "var(--color-text-primary)" }}>
                    {formatDate(day.date)}
                  </span>
                  <div className="flex-1 h-2 rounded-full overflow-hidden" style={{ background: "var(--lifeflow-muted)" }}>
                    <div
                      className="h-full rounded-full transition-all"
                      style={{
                        width: `${Math.min(100, (day.completed / (day.total || 1)) * 100)}%`,
                        background: day.completed >= day.total ? "var(--lifeflow-primary)" : "var(--lifeflow-primary)",
                        opacity: day.completed === 0 ? 0.3 : 0.7,
                      }}
                    />
                  </div>
                  <span className="text-[12px] font-medium min-w-[70px] text-right" style={{ color: "var(--color-text-secondary)" }}>
                    {day.completed}/{day.total} · {day.totalMl}ml
                  </span>
                  {day.date === today && (
                    <ChevronRight className="w-3.5 h-3.5" style={{ color: "var(--color-text-disabled)" }} />
                  )}
                </div>
              ))}
            </div>
          )}
        </motion.div>
      </div>
    </div>
  );
}

/* ────────── Inline Icons ────────── */

function MinusIcon({ className, style }: { className?: string; style?: React.CSSProperties }) {
  return (
    <svg className={className} style={style} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M20 12H4" />
    </svg>
  );
}

function PlusIcon({ className, style }: { className?: string; style?: React.CSSProperties }) {
  return (
    <svg className={className} style={style} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
    </svg>
  );
}
