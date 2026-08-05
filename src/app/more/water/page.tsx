"use client";

import { useEffect, useState, useMemo, useCallback, Fragment } from "react";
import { useRouter } from "next/navigation";
import { useLiveQuery } from "dexie-react-hooks";
import { motion } from "framer-motion";
import { ChevronLeft, Droplets, Check, ChevronRight, Settings } from "lucide-react";
import { daylogDB, ensureModuleItem } from "@/lib/db/daylog.db";
import type { Item } from "@/lib/db/daylog.db";
import { healthDB, getWaterGoal, updateWaterGoal, syncWaterLogOnToggle } from "@/lib/db/health.db";
import { syncItemReminder } from "@/lib/reminderDefaults";
import { requestPermission } from "@/lib/notificationService";
import { showToast } from "@/components/ui/Toast";

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

  /* ─── Live query: 今日实际饮水量（唯一流水源 waterLogs） ─── */

  const todayWaterLogs = useLiveQuery(
    () => healthDB.waterLogs.where("date").equals(today).toArray(),
    [today],
    [],
  );
  const todayWaterMl = useMemo(
    () => todayWaterLogs.reduce((s, l) => s + (l.amount || 0), 0),
    [todayWaterLogs],
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

  /* ─── 近 30 天实际饮水量（唯一流水源 waterLogs） ─── */

  const historyWaterLogs = useLiveQuery(
    () => healthDB.waterLogs.where("date").between(historyStart, today, true, true).toArray(),
    [today, historyStart],
    [],
  );
  const mlByDate = useMemo(() => {
    const map = new Map<string, number>();
    for (const l of historyWaterLogs) {
      map.set(l.date, (map.get(l.date) || 0) + (l.amount || 0));
    }
    return map;
  }, [historyWaterLogs]);

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
        items: items.sort((a, b) => a.plannedStart.localeCompare(b.plannedStart)),
        completed: items.filter(i => i.isCompleted).length,
        total: items.length,
        totalMl: mlByDate.get(date) || 0,
      }));
  }, [historyItems, mlByDate]);

  /* ─── 展开的历史日期 ─── */
  const [expandedDate, setExpandedDate] = useState<string | null>(null);

  /* ─── Toggle item completion ─── */

  const handleToggle = useCallback(async (id: string, current: boolean, date: string) => {
    const { updateItem } = await import("@/lib/db/daylog.db");
    await updateItem(id, { isCompleted: !current });
    await syncWaterLogOnToggle(date, !current);
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

  /* ─── 重新生成饮水提醒 ─── */

  const [generating, setGenerating] = useState(false);

  const handleGenerateReminders = useCallback(async () => {
    setGenerating(true);
    try {
      await requestPermission();

      const today = todayStr();
      const startH = parseInt(settings.wakeStart.split(":")[0]);
      const endH = parseInt(settings.wakeEnd.split(":")[0]);
      const stopH = endH - 2;
      const slots: { label: string }[] = [];
      for (let h = startH; h < stopH; h++) {
        slots.push({ label: `${String(h).padStart(2, "0")}:30` });
      }

      // 清理旧数据（未来 7 天）
      for (let d = 0; d < 7; d++) {
        const date = dateAddDays(today, d);
        const oldItems = await daylogDB.items
          .where("date").equals(date)
          .filter((item) => item.sourceType === "water")
          .toArray();
        const { db } = await import("@/lib/db");
        for (const item of oldItems) {
          const reminder = await db.reminders
            .where("moduleType").equals("item")
            .filter((r) => r.linkedModuleId === item.id)
            .first();
          if (reminder) await db.reminders.delete(reminder.id!);
        }
        await daylogDB.items
          .where("date").equals(date)
          .filter((item) => item.sourceType === "water")
          .delete();
      }

      // 生成新数据
      for (let d = 0; d < 7; d++) {
        const date = dateAddDays(today, d);
        for (const slot of slots) {
          const timeStr = slot.label;
          const endTime = (() => {
            const [h, m] = timeStr.split(":").map(Number);
            const total = h * 60 + m + 5;
            const nh = Math.floor(total / 60) % 24;
            const nm = total % 60;
            return `${String(nh).padStart(2, "0")}:${String(nm).padStart(2, "0")}`;
          })();
          const sourceId = `water_${date}_${timeStr}`;
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

      // 同步开关状态
      await updateWaterGoal({ reminderInterval: 60 }).catch(() => {});

      showToast({ type: "success", message: `饮水提醒已生成，每日 ${slots.length} 次` });
    } catch {
      showToast({ type: "error", message: "生成失败，请重试" });
    } finally {
      setGenerating(false);
    }
  }, [settings]);

  /* ─── Derived stats ─── */

  const totalWaterMl = todayWaterMl; // 唯一流水源：waterLogs

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
          <button
            type="button"
            onClick={handleGenerateReminders}
            disabled={generating}
            className="w-full mt-3 h-10 rounded-[10px] text-[14px] font-semibold text-white disabled:opacity-50"
            style={{ background: "var(--lifeflow-primary)" }}
          >
            {generating ? "生成中..." : "生成饮水提醒"}
          </button>
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
            <div className="flex flex-col max-h-[600px] overflow-y-auto">
              {historyByDay.map((day) => {
                const isExpanded = expandedDate === day.date;
                return (
                  <Fragment key={day.date}>
                    {/* 汇总行 */}
                    <div
                      className="flex items-center gap-3 px-3 py-2.5 rounded-xl cursor-pointer active:opacity-70"
                      style={{ background: day.date === today ? "var(--lifeflow-brand-50)" : "transparent" }}
                      onClick={() => setExpandedDate(isExpanded ? null : day.date)}
                    >
                      <span className="text-[13px] font-medium min-w-[72px]" style={{ color: "var(--color-text-primary)" }}>
                        {formatDate(day.date)}
                      </span>
                      <div className="flex-1 h-2 rounded-full overflow-hidden" style={{ background: "var(--lifeflow-muted)" }}>
                        <div
                          className="h-full rounded-full transition-all"
                          style={{
                            width: `${Math.min(100, (day.completed / (day.total || 1)) * 100)}%`,
                            background: "var(--lifeflow-primary)",
                            opacity: day.completed === 0 ? 0.3 : 0.7,
                          }}
                        />
                      </div>
                      <span className="text-[12px] font-medium min-w-[70px] text-right" style={{ color: "var(--color-text-secondary)" }}>
                        {day.completed}/{day.total} · {day.totalMl}ml
                      </span>
                      <motion.div
                        animate={{ rotate: isExpanded ? 90 : 0 }}
                        transition={{ duration: 0.2 }}
                      >
                        <ChevronRight className="w-3.5 h-3.5" style={{ color: "var(--color-text-disabled)" }} />
                      </motion.div>
                    </div>

                    {/* 展开详情 */}
                    {isExpanded && (
                      <motion.div
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: "auto", opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        transition={{ duration: 0.2, ease: "easeInOut" }}
                      >
                        <div className="flex flex-col gap-1 pb-2 pl-3">
                          {day.items.length === 0 ? (
                            <p className="text-[12px] py-2" style={{ color: "var(--color-text-disabled)" }}>
                              该日暂无饮水记录
                            </p>
                          ) : (
                            day.items.map((item) => (
                              <div
                                key={item.id}
                                className="flex items-center gap-2.5 py-2 px-3 rounded-xl"
                                style={{ background: "var(--lifeflow-muted)" }}
                              >
                                <button
                                  type="button"
                                  onClick={() => handleToggle(item.id!, item.isCompleted, day.date)}
                                  className="w-[18px] h-[18px] rounded-full border-2 flex items-center justify-center shrink-0 active:scale-90 transition-transform"
                                  style={{
                                    borderColor: item.isCompleted ? "var(--lifeflow-primary)" : "var(--lifeflow-border)",
                                    background: item.isCompleted ? "var(--lifeflow-primary)" : "transparent",
                                  }}
                                >
                                  {item.isCompleted && (
                                    <Check className="w-3 h-3 text-white" strokeWidth={3} />
                                  )}
                                </button>
                                <span
                                  className="text-[13px] flex-1"
                                  style={{
                                    color: item.isCompleted ? "var(--color-text-disabled)" : "var(--color-text-primary)",
                                    textDecoration: item.isCompleted ? "line-through" : "none",
                                  }}
                                >
                                  {item.title || "喝口水然后动一动不要久坐"}
                                </span>
                                <span className="text-[12px]" style={{ color: "var(--color-text-secondary)" }}>
                                  {item.plannedStart}
                                </span>
                              </div>
                            ))
                          )}
                        </div>
                      </motion.div>
                    )}
                  </Fragment>
                );
              })}
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
