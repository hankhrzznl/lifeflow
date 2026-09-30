"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import { ChevronLeft, ChevronRight, Circle, CheckCircle2, CalendarCheck, Clock } from "lucide-react";
import { useLiveQuery } from "dexie-react-hooks";
import { getAllScheduleTasks } from "@/lib/db/efficiency.db";
import type { ScheduleTask } from "@/lib/db/efficiency.db";
import { getHabits } from "@/lib/db/life.db";
import type { Habit } from "@/lib/db/life.db";
import { getCountdowns } from "@/lib/db/life.db";
import type { Countdown } from "@/lib/db/life.db";

// ============================================================
// 工具
// ============================================================
function getMonthGrid(year: number, month: number): (string | null)[][] {
  const firstDay = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const startOffset = firstDay === 0 ? 6 : firstDay - 1;
  const cells: (string | null)[] = [];
  for (let i = 0; i < startOffset; i++) cells.push(null);
  for (let d = 1; d <= daysInMonth; d++) {
    cells.push(`${year}-${String(month + 1).padStart(2, "0")}-${String(d).padStart(2, "0")}`);
  }
  const grid: (string | null)[][] = [];
  for (let i = 0; i < cells.length; i += 7) grid.push(cells.slice(i, i + 7));
  return grid;
}

function todayStr(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

export default function CalendarPage() {
  const router = useRouter();
  const today = todayStr();
  const now = new Date();

  const [year, setYear] = useState(now.getFullYear());
  const [month, setMonth] = useState(now.getMonth());
  const [selectedDate, setSelectedDate] = useState<string | null>(null);

  const allTasks = useLiveQuery(() => getAllScheduleTasks(), [], [] as ScheduleTask[]);
  const habits = useLiveQuery(() => getHabits(), [], [] as Habit[]);
  const countdowns = useLiveQuery(() => getCountdowns(), [], [] as Countdown[]);

  const dateMap = useMemo(() => {
    const map = new Map<string, { tasks: ScheduleTask[]; habits: string[]; countdowns: Countdown[] }>();
    for (const t of allTasks ?? []) {
      if (t.date) {
        const entry = map.get(t.date) || { tasks: [], habits: [], countdowns: [] };
        entry.tasks.push(t);
        map.set(t.date, entry);
      }
      if (t.type === "multi_day" && t.startDate && t.endDate) {
        const start = new Date(t.startDate);
        const end = new Date(t.endDate);
        const cursor = new Date(start);
        while (cursor <= end) {
          const ds = `${cursor.getFullYear()}-${String(cursor.getMonth() + 1).padStart(2, "0")}-${String(cursor.getDate()).padStart(2, "0")}`;
          const entry = map.get(ds) || { tasks: [], habits: [], countdowns: [] };
          if (!entry.tasks.find((x) => x.id === t.id)) entry.tasks.push(t);
          map.set(ds, entry);
          cursor.setDate(cursor.getDate() + 1);
        }
      }
    }
    for (const h of habits ?? []) {
      for (const date of Object.keys(h.days)) {
        if (h.days[date]) {
          const entry = map.get(date) || { tasks: [], habits: [], countdowns: [] };
          entry.habits.push(h.name);
          map.set(date, entry);
        }
      }
    }
    for (const c of countdowns ?? []) {
      const entry = map.get(c.date) || { tasks: [], habits: [], countdowns: [] };
      entry.countdowns.push(c);
      map.set(c.date, entry);
    }
    return map;
  }, [allTasks, habits, countdowns]);

  const goPrev = () => {
    if (month === 0) { setYear((y) => y - 1); setMonth(11); }
    else setMonth((m) => m - 1);
  };
  const goNext = () => {
    if (month === 11) { setYear((y) => y + 1); setMonth(0); }
    else setMonth((m) => m + 1);
  };

  const grid = useMemo(() => getMonthGrid(year, month), [year, month]);
  const dayLabels = ["日", "一", "二", "三", "四", "五", "六"];

  return (
    <div className="pb-[100px]">
      {/* Header */}
      <div className="flex items-center px-4 pt-[var(--safe-area-top)] pb-2">
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
          日历
        </h1>
        <div className="w-8" />
      </div>

      <div className="px-4">
        {/* Month nav */}
        <div className="flex items-center justify-between mb-4">
          <button
            onClick={goPrev}
            className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-[var(--color-surface-secondary)]"
          >
            <ChevronLeft className="w-5 h-5" style={{ color: "var(--color-text-primary)" }} />
          </button>
          <span className="text-[18px] font-semibold" style={{ color: "var(--color-text-primary)" }}>
            {year}年{month + 1}月
          </span>
          <button
            onClick={goNext}
            className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-[var(--color-surface-secondary)]"
          >
            <ChevronRight className="w-5 h-5" style={{ color: "var(--color-text-primary)" }} />
          </button>
        </div>

        {/* Calendar card */}
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.35, ease: [0.32, 0.72, 0, 1] }}
          className="rounded-[20px] p-4"
          style={{
            background: "var(--color-surface-card)",
            boxShadow: "var(--shadow-card)",
          }}
        >
          {/* Weekday headers */}
          <div className="grid grid-cols-7 mb-1">
            {dayLabels.map((d) => (
              <div key={d} className="text-center text-[12px] font-medium py-1" style={{ color: "var(--color-text-secondary)" }}>
                {d}
              </div>
            ))}
          </div>

          {/* Date grid */}
          {grid.map((row, ri) => (
            <div
              key={ri}
              className="grid grid-cols-7"
              style={{ borderBottom: ri < grid.length - 1 ? "0.5px solid var(--lifeflow-border)" : "none" }}
            >
              {row.map((date, di) => {
                if (!date) return <div key={`empty-${ri}-${di}`} className="aspect-square" />;

                const entry = dateMap.get(date);
                const hasTask = entry && entry.tasks.length > 0;
                const hasHabit = entry && entry.habits.length > 0;
                const hasCountdown = entry && entry.countdowns.length > 0;
                const isToday = date === today;
                const isSelected = date === selectedDate;
                const day = parseInt(date.split("-")[2]);
                const completedTasks = entry ? entry.tasks.filter((t) => t.isCompleted).length : 0;
                const totalTasks = entry ? entry.tasks.length : 0;
                const allDone = totalTasks > 0 && completedTasks === totalTasks;
                const isCurrentMonth = new Date(date).getMonth() === month;

                return (
                  <button
                    key={date}
                    type="button"
                    onClick={() => setSelectedDate(isSelected ? null : date)}
                    className="aspect-square flex flex-col items-center justify-start pt-1 relative"
                    style={{
                      background: isSelected ? "var(--lifeflow-brand-50)" : "transparent",
                    }}
                  >
                    <span
                      className={`w-7 h-7 rounded-full flex items-center justify-center text-[14px] font-medium transition-colors ${
                        isToday ? "text-white" : ""
                      }`}
                      style={{
                        background: isToday ? "var(--lifeflow-primary)" : "transparent",
                        color: isToday ? "var(--color-text-inverse)" : isCurrentMonth ? "var(--color-text-primary)" : "var(--color-text-disabled)",
                      }}
                    >
                      {day}
                    </span>

                    {/* Dots */}
                    <div className="flex gap-0.5 mt-0.5">
                      {hasTask && (
                        <span
                          className="w-1.5 h-1.5 rounded-full"
                          style={{ background: allDone ? "var(--state-success)" : "var(--lifeflow-primary)" }}
                        />
                      )}
                      {hasHabit && (
                        <span
                          className="w-1.5 h-1.5 rounded-full"
                          style={{ background: "var(--state-warning)" }}
                        />
                      )}
                      {hasCountdown && (
                        <span
                          className="w-1.5 h-1.5 rounded-full"
                          style={{ background: "var(--state-error)" }}
                        />
                      )}
                    </div>
                  </button>
                );
              })}
            </div>
          ))}
        </motion.div>

        {/* Legend */}
        <div className="flex items-center gap-4 mt-3 mb-4 px-1">
          <div className="flex items-center gap-1">
            <span className="w-2 h-2 rounded-full" style={{ background: "var(--lifeflow-primary)" }} />
            <span className="text-[12px]" style={{ color: "var(--color-text-secondary)" }}>事项</span>
          </div>
          <div className="flex items-center gap-1">
            <span className="w-2 h-2 rounded-full" style={{ background: "var(--state-warning)" }} />
            <span className="text-[12px]" style={{ color: "var(--color-text-secondary)" }}>习惯</span>
          </div>
          <div className="flex items-center gap-1">
            <span className="w-2 h-2 rounded-full" style={{ background: "var(--state-error)" }} />
            <span className="text-[12px]" style={{ color: "var(--color-text-secondary)" }}>倒数日</span>
          </div>
        </div>

        {/* Selected date detail */}
        {selectedDate && (
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            className="rounded-[20px] p-4"
            style={{
              background: "var(--color-surface-card)",
              boxShadow: "var(--shadow-card)",
            }}
          >
            <div className="text-[17px] font-semibold mb-3" style={{ color: "var(--color-text-primary)" }}>
              {selectedDate} {selectedDate === today ? "(今天)" : ""}
            </div>

            {(() => {
              const entry = dateMap.get(selectedDate);
              if (!entry || (entry.tasks.length === 0 && entry.habits.length === 0 && entry.countdowns.length === 0)) {
                return (
                  <p className="text-[15px]" style={{ color: "var(--color-text-secondary)" }}>
                    这天没有记录
                  </p>
                );
              }
              return (
                <div className="flex flex-col gap-3">
                  {entry.tasks.length > 0 && (
                    <div>
                      <div className="flex items-center gap-1.5 mb-2">
                        <CalendarCheck className="w-4 h-4" style={{ color: "var(--lifeflow-primary)" }} />
                        <span className="text-[14px] font-semibold" style={{ color: "var(--color-text-primary)" }}>
                          事项 ({entry.tasks.length})
                        </span>
                      </div>
                      {entry.tasks.map((t) => (
                        <div key={t.id} className="flex items-center gap-2 py-1">
                          {t.isCompleted ? (
                            <CheckCircle2 className="w-4 h-4 shrink-0" style={{ color: "var(--state-success)" }} />
                          ) : (
                            <Circle className="w-4 h-4 shrink-0" style={{ color: "var(--color-text-secondary)" }} />
                          )}
                          <span
                            className={`text-[14px] ${t.isCompleted ? "line-through" : ""}`}
                            style={{ color: t.isCompleted ? "var(--color-text-disabled)" : "var(--color-text-primary)" }}
                          >
                            {t.title}
                          </span>
                          <span
                            className="text-[11px] px-1.5 py-0.5 rounded font-medium ml-auto"
                            style={{
                              background: `${getQuadrantColor(t.quadrant)}16`,
                              color: getQuadrantColor(t.quadrant),
                            }}
                          >
                            {getQuadrantLabel(t.quadrant)}
                          </span>
                        </div>
                      ))}
                    </div>
                  )}

                  {entry.habits.length > 0 && (
                    <div>
                      <div className="flex items-center gap-1.5 mb-2">
                        <CheckCircle2 className="w-4 h-4" style={{ color: "var(--state-warning)" }} />
                        <span className="text-[14px] font-semibold" style={{ color: "var(--color-text-primary)" }}>
                          习惯打卡 ({entry.habits.length})
                        </span>
                      </div>
                      <div className="flex flex-wrap gap-1.5">
                        {entry.habits.map((name, i) => (
                          <span
                            key={i}
                            className="text-[13px] px-2 py-0.5 rounded-md"
                            style={{
                              background: "#F59E0B16",
                              color: "var(--state-warning)",
                            }}
                          >
                            ✓ {name}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}

                  {entry.countdowns.length > 0 && (
                    <div>
                      <div className="flex items-center gap-1.5 mb-2">
                        <Clock className="w-4 h-4" style={{ color: "var(--state-error)" }} />
                        <span className="text-[14px] font-semibold" style={{ color: "var(--color-text-primary)" }}>
                          倒数日 ({entry.countdowns.length})
                        </span>
                      </div>
                      {entry.countdowns.map((c) => (
                        <div key={c.id} className="flex items-center gap-2 py-1">
                          <span className="text-lg">{c.icon}</span>
                          <span className="text-[14px]" style={{ color: "var(--color-text-primary)" }}>
                            {c.name}
                          </span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              );
            })()}
          </motion.div>
        )}
      </div>
    </div>
  );
}

function getQuadrantLabel(q?: string): string {
  switch (q) {
    case "q1": return "重要紧急";
    case "q2": return "重要不紧急";
    case "q3": return "不重要紧急";
    case "q4": return "不重要不紧急";
    default: return "未分类";
  }
}

function getQuadrantColor(q?: string): string {
  switch (q) {
    case "q1": return "#FF3B30";
    case "q2": return "#007AFF";
    case "q3": return "#FF9500";
    case "q4": return "#8E8E93";
    default: return "#8E8E93";
  }
}
