"use client";

import { useMemo, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import { ChevronLeft, Plus, Trash2, Flame, CircleCheckBig } from "lucide-react";
import { useLiveQuery } from "dexie-react-hooks";
import { getHabits, addHabit, deleteHabit, toggleHabitDay } from "@/lib/db/life.db";
import type { Habit } from "@/lib/db/life.db";
import { showToast } from "@/components/ui/Toast";

const COLORS = ["#6366F1", "#FF9500", "#34C759", "#007AFF", "#FF3B30", "#AF52DE", "#FF6B8A", "#5AC8FA"];
const ICONS = ["BookOpen", "Footprints", "Droplets", "Sunrise", "Dumbbell", "Brain", "Pencil", "Music"];

function todayStr(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function getWeekDates(): string[] {
  const today = new Date();
  const dayOfWeek = today.getDay();
  const monday = new Date(today);
  monday.setDate(today.getDate() - (dayOfWeek === 0 ? 6 : dayOfWeek - 1));
  return Array.from({ length: 7 }, (_, i) => {
    const d = new Date(monday); d.setDate(monday.getDate() + i);
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  });
}

export default function HabitsPage() {
  const router = useRouter();
  const today = todayStr();
  const weekDates = useMemo(() => getWeekDates(), []);

  const habits = useLiveQuery(() => getHabits(), [], [] as Habit[]);

  const [showAdd, setShowAdd] = useState(false);
  const [newName, setNewName] = useState("");
  const [adding, setAdding] = useState(false);

  const toggleHabit = useCallback(async (habit: Habit) => {
    await toggleHabitDay(habit.id, today);
  }, [today]);

  const handleAdd = useCallback(async () => {
    if (!newName.trim() || adding) return;
    setAdding(true);
    await addHabit({ name: newName.trim(), icon: ICONS[Math.floor(Math.random() * ICONS.length)], color: COLORS[Math.floor(Math.random() * COLORS.length)], days: {}, streak: 0 });
    showToast({ type: "success", message: "已添加" });
    setNewName("");
    setShowAdd(false);
    setAdding(false);
  }, [newName, adding]);

  const handleDelete = useCallback(async (id: string) => {
    await deleteHabit(id);
  }, []);

  const dayLabels = ["一", "二", "三", "四", "五", "六", "日"];

  return (
    <div className="mx-auto px-4 pt-5 pb-[100px]" style={{ maxWidth: 430 }}>
      {/* 页头 */}
      <div className="flex items-center gap-2 mb-4">
        <button type="button" onClick={() => router.push("/more")} className="w-8 h-8 -ml-1 flex items-center justify-center">
          <ChevronLeft className="w-6 h-6" style={{ color: "var(--color-text-primary)" }} />
        </button>
        <h1 className="text-[28px] font-bold tracking-[-0.02em] leading-tight flex-1" style={{ color: "var(--color-text-primary)" }}>习惯打卡</h1>
      </div>
      <p className="text-[15px] mb-4" style={{ color: "var(--color-text-secondary)" }}>每日坚持 · 持续打卡</p>

      {/* 添加 */}
      {showAdd ? (
        <div
          className="rounded-[20px] p-4 mb-4"
          style={{
            backgroundColor: "var(--color-surface-card)",
            boxShadow: "var(--shadow-card)",
          }}
        >
          <input
            type="text"
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            placeholder="习惯名称（如：早起6:30）"
            autoFocus
            className="w-full text-[17px] outline-none mb-3 bg-transparent"
            style={{ color: "var(--color-text-primary)" }}
            onKeyDown={(e) => { if (e.key === "Enter") handleAdd(); }}
          />
          <div className="flex gap-2">
            <button
              onClick={() => { setShowAdd(false); setNewName(""); }}
              className="flex-1 h-10 rounded-lg text-[15px]"
              style={{ backgroundColor: "var(--lifeflow-background)", color: "var(--color-text-secondary)" }}
            >
              取消
            </button>
            <button
              onClick={handleAdd}
              disabled={!newName.trim()}
              className="flex-1 h-10 rounded-lg text-[15px] font-semibold text-white"
              style={{ backgroundColor: "var(--lifeflow-primary)", opacity: newName.trim() ? 1 : 0.5 }}
            >
              添加
            </button>
          </div>
        </div>
      ) : (
        <button
          onClick={() => setShowAdd(true)}
          className="w-full h-11 flex items-center justify-center gap-2 rounded-xl mb-4 text-[15px] font-medium"
          style={{
            backgroundColor: "var(--lifeflow-brand-50)",
            color: "var(--lifeflow-primary)",
            border: "1px dashed var(--lifeflow-primary)",
          }}
        >
          <Plus className="w-4 h-4" />添加习惯
        </button>
      )}

      {/* 习惯列表 */}
      <div className="flex flex-col gap-3">
        {(habits ?? []).map((h, i) => (
          <motion.div
            key={h.id}
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.04 }}
            className="rounded-[20px] p-4"
            style={{
              backgroundColor: "var(--color-surface-card)",
              boxShadow: "var(--shadow-card)",
            }}
          >
            {/* 标题行 */}
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-3">
                <div
                  className="w-10 h-10 rounded-full flex items-center justify-center text-lg"
                  style={{ backgroundColor: "var(--lifeflow-brand-50)" }}
                >
                  <span>{getEmoji(h.name)}</span>
                </div>
                <div>
                  <div className="text-[17px] font-semibold" style={{ color: "var(--color-text-primary)" }}>{h.name}</div>
                  <div
                    className="flex items-center gap-1 text-[13px]"
                    style={{ color: h.streak > 0 ? "#FF9500" : "var(--color-text-secondary)" }}
                  >
                    <Flame className="w-3.5 h-3.5" />
                    连续 {h.streak} 天
                  </div>
                </div>
              </div>
              <button onClick={() => handleDelete(h.id)} className="w-7 h-7 flex items-center justify-center">
                <Trash2 className="w-4 h-4" style={{ color: "var(--color-text-disabled)" }} />
              </button>
            </div>

            {/* 本周热力图 */}
            <div className="flex gap-1.5">
              {weekDates.map((date, di) => {
                const done = h.days[date];
                const isToday = date === today;
                return (
                  <button key={date} onClick={() => toggleHabitDay(h.id, date)}
                    className="flex-1 flex flex-col items-center gap-1">
                    <div
                      className="w-full aspect-square rounded-md transition-colors"
                      style={{
                        backgroundColor: done ? h.color : "var(--lifeflow-background)",
                        boxShadow: isToday ? `0 0 0 2px var(--lifeflow-primary)` : undefined,
                      }}
                    />
                    <span
                      className="text-[10px]"
                      style={{ color: isToday ? "var(--lifeflow-primary)" : "var(--color-text-secondary)" }}
                    >
                      {dayLabels[di]}
                    </span>
                  </button>
                );
              })}
            </div>
          </motion.div>
        ))}
      </div>

      {/* 空状态 */}
      {(habits ?? []).length === 0 && (
        <div className="text-center py-16">
          <CircleCheckBig className="w-12 h-12 mx-auto mb-4" style={{ color: "var(--color-text-disabled)" }} />
          <p className="text-[17px] font-semibold mb-1" style={{ color: "var(--color-text-primary)" }}>暂无习惯</p>
          <p className="text-[15px] mb-6" style={{ color: "var(--color-text-secondary)" }}>创建一个习惯开始打卡吧</p>
          <button
            onClick={() => setShowAdd(true)}
            className="inline-flex items-center gap-2 h-10 px-5 rounded-full text-[15px] font-semibold text-white"
            style={{ backgroundColor: "var(--lifeflow-primary)" }}
          >
            <Plus className="w-4 h-4" />创建习惯
          </button>
        </div>
      )}
    </div>
  );
}

function getEmoji(name: string): string {
  const m: Record<string, string> = {
    "早起6:30": "🌅", "阅读30分钟": "📖", "运动": "🏃", "冥想10分钟": "🧘", "喝水8杯": "💧",
  };
  return m[name] || "✅";
}
