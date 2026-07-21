"use client";

import { useMemo, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import { ChevronLeft, Plus, Trash2, Flame, CheckCircle } from "lucide-react";
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
      {/* Header */}
      <div className="sticky top-0 z-30 -mx-4 mb-5 border-b" style={{
        backgroundColor: "var(--color-surface-card)",
        borderColor: "var(--lifeflow-border)",
        width: "calc(100% + 2rem)",
      }}>
        <div className="relative flex h-11 items-center px-4">
          <button
            type="button"
            onClick={() => router.push("/more")}
            className="absolute left-4 inline-flex h-8 w-8 items-center justify-center rounded-full"
            style={{ border: "1px solid var(--lifeflow-border)" }}
          >
            <ChevronLeft className="w-5 h-5" style={{ color: "var(--color-text-primary)" }} />
          </button>
          <h1 className="w-full text-center text-[17px] font-semibold tracking-[-0.018em]" style={{ color: "var(--color-text-primary)" }}>习惯打卡</h1>
        </div>
      </div>

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
        <div className="flex flex-col items-center justify-center" style={{ minHeight: "calc(100vh - 200px)" }}>
          <div
            className="w-full flex flex-col items-center text-center px-8 py-10"
            style={{ maxWidth: 320, backgroundColor: "var(--color-surface-card)", borderRadius: 20, boxShadow: "var(--shadow-card)" }}
          >
            <div className="mb-5 flex h-16 w-16 items-center justify-center rounded-full" style={{ backgroundColor: "var(--lifeflow-brand-50)" }}>
              <CheckCircle className="w-8 h-8" style={{ color: "var(--lifeflow-brand)" }} />
            </div>
            <p className="text-[17px] mb-6" style={{ color: "var(--color-text-secondary)" }}>暂无习惯</p>
            <button
              onClick={() => setShowAdd(true)}
              className="inline-flex items-center gap-2 rounded-full px-6 py-2.5 text-[15px] font-medium transition-opacity hover:opacity-90"
              style={{ backgroundColor: "var(--lifeflow-brand)", color: "var(--lifeflow-primary-foreground)" }}
            >
              <Plus className="w-4 h-4" />
              <span>创建习惯</span>
            </button>
          </div>
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
