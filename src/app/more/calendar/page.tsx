"use client";

import { useMemo, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { ChevronLeft, ChevronRight, Circle, CheckCircle2, CalendarCheck, Clock } from "lucide-react";
import { useLiveQuery } from "dexie-react-hooks";
import { getAllScheduleTasks } from "@/lib/db/efficiency.db";
import type { ScheduleTask } from "@/lib/db/efficiency.db";
import { getHabits } from "@/lib/db/life.db";
import type { Habit } from "@/lib/db/life.db";
import { getCountdowns } from "@/lib/db/life.db";
import type { Countdown } from "@/lib/db/life.db";

// ─── 工具 ────────────────────────────────────────────────────

function getMonthGrid(year: number, month: number): (string | null)[][] {
  const firstDay = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const startOffset = firstDay === 0 ? 6 : firstDay - 1; // 周一开头
  const cells: (string | null)[] = [];
  for (let i = 0; i < startOffset; i++) cells.push(null);
  for (let d = 1; d <= daysInMonth; d++) {
    cells.push(`${year}-${String(month + 1).padStart(2, "0")}-${String(d).padStart(2, "0")}`);
  }
  const grid: (string | null)[][] = [];
  for (let i = 0; i < cells.length; i += 7) {
    grid.push(cells.slice(i, i + 7));
  }
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

  // ─── 数据 ──────────────────────────────────────────────────

  const allTasks = useLiveQuery(() => getAllScheduleTasks(), [], [] as ScheduleTask[]);
  const habits = useLiveQuery(() => getHabits(), [], [] as Habit[]);
  const countdowns = useLiveQuery(() => getCountdowns(), [], [] as Countdown[]);

  // ─── 按日期聚合 ────────────────────────────────────────────

  const dateMap = useMemo(() => {
    const map = new Map<string, { tasks: ScheduleTask[]; habits: string[]; countdowns: Countdown[] }>();

    for (const t of allTasks ?? []) {
      if (t.date) {
        const entry = map.get(t.date) || { tasks: [], habits: [], countdowns: [] };
        entry.tasks.push(t);
        map.set(t.date, entry);
      }
      // 多日任务
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

  // ─── 导航 ──────────────────────────────────────────────────

  const goPrev = () => {
    if (month === 0) { setYear(y => y - 1); setMonth(11); }
    else setMonth(m => m - 1);
  };
  const goNext = () => {
    if (month === 11) { setYear(y => y + 1); setMonth(0); }
    else setMonth(m => m + 1);
  };

  const grid = useMemo(() => getMonthGrid(year, month), [year, month]);
  const dayLabels = ["一", "二", "三", "四", "五", "六", "日"];

  // ════════════════════════════════════════════════════════════

  return (
    <div className="px-4 pt-5 pb-6">
      {/* 页头 */}
      <div className="flex items-center gap-2 mb-2">
        <button type="button" onClick={() => router.push("/more")} className="w-8 h-8 -ml-1 flex items-center justify-center">
          <ChevronLeft className="w-6 h-6 text-black" />
        </button>
        <h1 className="text-[34px] font-bold tracking-[-0.02em] leading-tight flex-1">日历</h1>
      </div>

      <p className="text-[15px] mb-4" style={{ color: "#8E8E93" }}>事项 · 习惯 · 倒数日</p>

      {/* 月份导航 */}
      <div className="flex items-center justify-between mb-4">
        <button onClick={goPrev} className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-[#F2F2F7]">
          <ChevronLeft className="w-5 h-5" />
        </button>
        <span className="text-[20px] font-semibold">{year}年{month + 1}月</span>
        <button onClick={goNext} className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-[#F2F2F7]">
          <ChevronRight className="w-5 h-5" />
        </button>
      </div>

      {/* 星期头 */}
      <div className="grid grid-cols-7 mb-1">
        {dayLabels.map((d) => (
          <div key={d} className="text-center text-[12px] font-medium py-1" style={{ color: "#8E8E93" }}>{d}</div>
        ))}
      </div>

      {/* 日期网格 */}
      <div className="rounded-xl bg-white shadow-[0_1px_4px_rgba(0,0,0,0.04)] overflow-hidden">
        {grid.map((row, ri) => (
          <div key={ri} className="grid grid-cols-7" style={{ borderBottom: ri < grid.length - 1 ? "0.5px solid #E5E5EA" : "none" }}>
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

              return (
                <button
                  key={date}
                  type="button"
                  onClick={() => setSelectedDate(isSelected ? null : date)}
                  className="aspect-square flex flex-col items-center justify-start pt-1.5 relative"
                  style={{ background: isSelected ? "#6366F108" : "transparent" }}
                >
                  {/* 今日圆 */}
                  <span
                    className={`w-7 h-7 rounded-full flex items-center justify-center text-[15px] font-medium ${
                      isToday ? "bg-[#6366F1] text-white" : "text-black"
                    }`}
                  >
                    {day}
                  </span>

                  {/* 指示点 */}
                  <div className="flex gap-0.5 mt-0.5">
                    {hasTask && (
                      <span className="w-1.5 h-1.5 rounded-full"
                        style={{ background: allDone ? "#34C759" : "#6366F1" }} />
                    )}
                    {hasHabit && (
                      <span className="w-1.5 h-1.5 rounded-full" style={{ background: "#FF9500" }} />
                    )}
                    {hasCountdown && (
                      <span className="w-1.5 h-1.5 rounded-full" style={{ background: "#FF3B30" }} />
                    )}
                  </div>
                </button>
              );
            })}
          </div>
        ))}
      </div>

      {/* 图例 */}
      <div className="flex items-center gap-4 mt-3 mb-4">
        <div className="flex items-center gap-1">
          <span className="w-2 h-2 rounded-full" style={{ background: "#6366F1" }} />
          <span className="text-[12px]" style={{ color: "#8E8E93" }}>事项</span>
        </div>
        <div className="flex items-center gap-1">
          <span className="w-2 h-2 rounded-full" style={{ background: "#FF9500" }} />
          <span className="text-[12px]" style={{ color: "#8E8E93" }}>习惯</span>
        </div>
        <div className="flex items-center gap-1">
          <span className="w-2 h-2 rounded-full" style={{ background: "#FF3B30" }} />
          <span className="text-[12px]" style={{ color: "#8E8E93" }}>倒数日</span>
        </div>
      </div>

      {/* 选中日详情 */}
      {selectedDate && (
        <div className="rounded-xl bg-white p-4 shadow-[0_1px_4px_rgba(0,0,0,0.04)]">
          <div className="text-[17px] font-semibold mb-3">
            {selectedDate} {selectedDate === today ? "(今天)" : ""}
          </div>

          {(() => {
            const entry = dateMap.get(selectedDate);
            if (!entry || (entry.tasks.length === 0 && entry.habits.length === 0 && entry.countdowns.length === 0)) {
              return <p className="text-[15px]" style={{ color: "#8E8E93" }}>这天没有记录</p>;
            }

            return (
              <div className="flex flex-col gap-3">
                {entry.tasks.length > 0 && (
                  <div>
                    <div className="flex items-center gap-1.5 mb-2">
                      <CalendarCheck className="w-4 h-4" style={{ color: "#6366F1" }} />
                      <span className="text-[14px] font-semibold">事项 ({entry.tasks.length})</span>
                    </div>
                    {entry.tasks.map((t) => (
                      <div key={t.id} className="flex items-center gap-2 py-1">
                        {t.isCompleted
                          ? <CheckCircle2 className="w-4 h-4 shrink-0" style={{ color: "#34C759" }} />
                          : <Circle className="w-4 h-4 shrink-0" style={{ color: "#8E8E93" }} />}
                        <span className={`text-[14px] ${t.isCompleted ? "line-through" : ""}`}
                          style={{ color: t.isCompleted ? "#C7C7CC" : "#000" }}>
                          {t.title}
                        </span>
                        <span className="text-[11px] px-1.5 py-0.5 rounded font-medium ml-auto"
                          style={{
                            background: getQuadrantBg(t.quadrant),
                            color: getQuadrantColor(t.quadrant),
                          }}>
                          {getQuadrantLabel(t.quadrant)}
                        </span>
                      </div>
                    ))}
                  </div>
                )}

                {entry.habits.length > 0 && (
                  <div>
                    <div className="flex items-center gap-1.5 mb-2">
                      <CheckCircle2 className="w-4 h-4" style={{ color: "#FF9500" }} />
                      <span className="text-[14px] font-semibold">习惯打卡 ({entry.habits.length})</span>
                    </div>
                    <div className="flex flex-wrap gap-1.5">
                      {entry.habits.map((name, i) => (
                        <span key={i} className="text-[13px] px-2 py-0.5 rounded-md"
                          style={{ background: "#FF950010", color: "#FF9500" }}>✓ {name}</span>
                      ))}
                    </div>
                  </div>
                )}

                {entry.countdowns.length > 0 && (
                  <div>
                    <div className="flex items-center gap-1.5 mb-2">
                      <Clock className="w-4 h-4" style={{ color: "#FF3B30" }} />
                      <span className="text-[14px] font-semibold">倒数日 ({entry.countdowns.length})</span>
                    </div>
                    {entry.countdowns.map((c) => (
                      <div key={c.id} className="flex items-center gap-2 py-1">
                        <span className="text-lg">{c.icon}</span>
                        <span className="text-[14px]">{c.name}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            );
          })()}
        </div>
      )}
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

function getQuadrantBg(q?: string): string {
  return `${getQuadrantColor(q)}16`;
}
