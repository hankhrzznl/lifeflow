"use client";

import { useMemo, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import {
  ChevronLeft,
  Plus,
  Trash2,
  Flame,
  Check,
  CheckCircle,
  Repeat,
  Target,
  Clock,
  BookOpen,
  Footprints,
  Droplets,
  Sunrise,
  Dumbbell,
  Brain,
  Pencil,
  Music,
  type LucideIcon,
} from "lucide-react";
import { useLiveQuery } from "dexie-react-hooks";
import { getHabits, addHabit, deleteHabit, toggleHabitDay } from "@/lib/db/life.db";
import type { Habit } from "@/lib/db/life.db";
import { showToast } from "@/components/ui/Toast";
import { ensureModuleItem, removeModuleItems } from "@/lib/db/daylog.db";

const COLORS = ["#6366F1", "#FF9500", "#34C759", "#007AFF", "#FF3B30", "#AF52DE", "#FF6B8A", "#5AC8FA"];
const ICONS = ["BookOpen", "Footprints", "Droplets", "Sunrise", "Dumbbell", "Brain", "Pencil", "Music"];

/* 习惯图标映射（lucide 组件，替代原 emoji 方案） */
const HABIT_ICON_MAP: Record<string, LucideIcon> = {
  BookOpen,
  Footprints,
  Droplets,
  Sunrise,
  Dumbbell,
  Brain,
  Pencil,
  Music,
  Flame,
  Repeat,
  Target,
  Clock,
  CheckCircle,
};

function HabitIcon({ name, className, style }: { name: string; className?: string; style?: React.CSSProperties }) {
  const Icon = HABIT_ICON_MAP[name] ?? CheckCircle;
  return <Icon className={className} style={style} />;
}

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

  /* ─── 每日打卡（今日勾选 → toggleHabitDay；保持原有打卡写入路径） ─── */
  const toggleHabit = useCallback(async (habit: Habit) => {
    const wasChecked = habit.days[today];
    await toggleHabitDay(habit.id, today);
    if (!wasChecked) {
      await ensureModuleItem({
        date: today,
        sourceType: "habit",
        sourceId: `habit_${habit.id}`,
        title: habit.name,
        plannedStart: "07:00",
        plannedEnd: "07:15",
        color: habit.color,
        icon: habit.icon,
      });
    } else {
      await removeModuleItems(today, "habit", `habit_${habit.id}`);
    }
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

  /* ─── 统计派生 ─── */
  const todayDone = useMemo(() => habits.filter((h) => h.days[today]).length, [habits, today]);
  const progressPct = habits.length > 0 ? Math.round((todayDone / habits.length) * 100) : 0;

  const maxStreak = useMemo(() => habits.reduce((m, h) => Math.max(m, h.streak || 0), 0), [habits]);

  const weekDoneDays = useMemo(() => {
    if (habits.length === 0) return 0;
    return weekDates.filter((d) => habits.every((h) => h.days[d])).length;
  }, [habits, weekDates]);

  const monthRate = useMemo(() => {
    if (habits.length === 0) return 0;
    const now = new Date();
    const year = now.getFullYear();
    const month = now.getMonth() + 1;
    const daysElapsed = now.getDate();
    let done = 0;
    for (const h of habits) {
      for (const date of Object.keys(h.days || {})) {
        const [y, m] = date.split("-").map(Number);
        if (y === year && m === month) done++;
      }
    }
    return Math.min(100, Math.round((done / (habits.length * daysElapsed)) * 100));
  }, [habits]);

  const dayLabels = ["一", "二", "三", "四", "五", "六", "日"];

  return (
    <div className="mx-auto px-4 pt-4 pb-[100px]" style={{ maxWidth: 430, minHeight: "100vh", background: "var(--lifeflow-background)" }}>
      {/* Header（画布样式） */}
      <header className="flex items-center gap-1">
        <button
          type="button"
          onClick={() => router.push("/more")}
          className="inline-flex h-9 w-9 items-center justify-center rounded-full shrink-0"
          style={{ border: "1px solid var(--lifeflow-border)", background: "var(--color-surface-card)" }}
          aria-label="返回"
        >
          <ChevronLeft className="w-5 h-5" style={{ color: "var(--color-text-primary)" }} />
        </button>
        <h1 className="flex-1 text-center text-[17px] font-semibold tracking-[-0.018em]" style={{ color: "var(--color-text-primary)" }}>习惯</h1>
        <div className="w-9" aria-hidden="true" />
      </header>

      <div className="mt-3 flex flex-col gap-3">
        {/* ─── 今日打卡卡 ─── */}
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.35, ease: [0.32, 0.72, 0, 1] }}
          className="p-4"
          style={{
            backgroundColor: "var(--color-surface-card)",
            borderRadius: "20px",
            boxShadow: "var(--shadow-card)",
          }}
        >
          <div className="flex items-center justify-between">
            <h2 className="text-[17px] font-bold" style={{ color: "var(--color-text-primary)" }}>今日打卡</h2>
            <span className="text-[13px] font-semibold tabular-nums" style={{ color: "var(--state-success)" }}>
              {todayDone}/{habits.length} 完成
            </span>
          </div>
          <div className="mt-2.5 h-[6px] rounded-full overflow-hidden" style={{ background: "var(--lifeflow-knit-bg)" }}>
            <motion.div
              className="h-full rounded-full"
              style={{ background: "var(--state-success)" }}
              initial={{ width: 0 }}
              animate={{ width: `${progressPct}%` }}
              transition={{ duration: 0.5, ease: "easeOut" }}
            />
          </div>

          {/* 习惯行 */}
          <div className="mt-2 flex flex-col">
            {habits.map((h) => {
              const doneToday = !!h.days[today];
              return (
                <div
                  key={h.id}
                  className="py-3"
                  style={{ borderBottom: "1px solid var(--lifeflow-border)" }}
                >
                  {/* 行主体 */}
                  <div className="flex items-center gap-3">
                    <span
                      className="w-8 h-8 flex-none rounded-[10px] flex items-center justify-center"
                      style={{ background: `${h.color}1A`, color: h.color }}
                    >
                      <HabitIcon name={h.icon} className="w-4 h-4" />
                    </span>
                    <div className="flex-1 min-w-0">
                      <p
                        className="text-[15px] font-medium truncate transition-colors"
                        style={{
                          color: doneToday ? "var(--color-text-secondary)" : "var(--color-text-primary)",
                          textDecoration: doneToday ? "line-through" : "none",
                          textDecorationColor: "var(--state-success)",
                        }}
                      >
                        {h.name}
                      </p>
                      <p className="flex items-center gap-1 text-[11px] mt-0.5" style={{ color: h.streak > 0 ? "#FF9500" : "var(--color-text-disabled)" }}>
                        <Flame className="w-3 h-3" />
                        连续 {h.streak} 天
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => handleDelete(h.id)}
                      className="w-7 h-7 flex items-center justify-center shrink-0"
                      aria-label="删除习惯"
                    >
                      <Trash2 className="w-4 h-4" style={{ color: "var(--color-text-disabled)" }} />
                    </button>
                    <motion.button
                      type="button"
                      whileTap={{ scale: 0.85 }}
                      onClick={() => toggleHabitDay(h.id, today)}
                      aria-label={doneToday ? "取消今日打卡" : "今日打卡"}
                      aria-pressed={doneToday}
                      className="w-6 h-6 flex-none rounded-full flex items-center justify-center transition-colors"
                      style={
                        doneToday
                          ? { background: "var(--state-success)", border: "1.5px solid var(--state-success)", color: "#fff" }
                          : { border: "1.5px dashed var(--lifeflow-border)", color: "transparent" }
                      }
                    >
                      <Check className="w-3.5 h-3.5" strokeWidth={3} />
                    </motion.button>
                  </div>

                  {/* 本周热力点（保留逐日打卡/补卡能力） */}
                  <div className="mt-2.5 flex gap-1">
                    {weekDates.map((date, di) => {
                      const done = !!h.days[date];
                      const isToday = date === today;
                      return (
                        <button
                          key={date}
                          type="button"
                          onClick={() => toggleHabitDay(h.id, date)}
                          className="flex-1 flex flex-col items-center gap-1"
                          aria-label={`${dayLabels[di]}${done ? "已" : "未"}打卡`}
                        >
                          <span
                            className="w-5 h-5 rounded-full flex items-center justify-center transition-colors"
                            style={
                              done
                                ? { background: h.color, color: "#fff" }
                                : isToday
                                  ? { border: "1.5px solid var(--state-success)", background: "transparent" }
                                  : { background: "var(--lifeflow-muted)" }
                            }
                          >
                            {done && <Check className="w-3 h-3" strokeWidth={3} />}
                          </span>
                          <span className="text-[10px] leading-none" style={{ color: isToday ? "var(--state-success)" : "var(--color-text-disabled)", fontWeight: isToday ? 700 : 400 }}>
                            {dayLabels[di]}
                          </span>
                        </button>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>
        </motion.div>

        {/* ─── 习惯统计卡 ─── */}
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.08, duration: 0.35, ease: [0.32, 0.72, 0, 1] }}
          className="p-4"
          style={{
            backgroundColor: "var(--color-surface-card)",
            borderRadius: "20px",
            boxShadow: "var(--shadow-card)",
          }}
        >
          <div className="flex items-center justify-between">
            <h3 className="text-[15px] font-bold" style={{ color: "var(--color-text-primary)" }}>习惯统计</h3>
            <span className="text-[11px]" style={{ color: "var(--color-text-disabled)" }}>坚持，是最长情的自律</span>
          </div>
          <div className="mt-3 grid grid-cols-3 gap-2.5">
            <div className="flex flex-col items-center gap-1.5 py-3 rounded-xl" style={{ background: "var(--lifeflow-muted)" }}>
              <span className="w-7 h-7 rounded-full flex items-center justify-center" style={{ background: "var(--lifeflow-brand-50)", color: "var(--lifeflow-primary)" }}>
                <Flame className="w-3.5 h-3.5" />
              </span>
              <span className="text-[17px] font-bold leading-none tabular-nums" style={{ color: "var(--color-text-primary)" }}>{maxStreak}天</span>
              <span className="text-[11px] leading-none" style={{ color: "var(--color-text-disabled)" }}>连续打卡</span>
            </div>
            <div className="flex flex-col items-center gap-1.5 py-3 rounded-xl" style={{ background: "var(--lifeflow-muted)" }}>
              <span className="w-7 h-7 rounded-full flex items-center justify-center" style={{ background: "var(--lifeflow-brand-50)", color: "var(--lifeflow-primary)" }}>
                <Repeat className="w-3.5 h-3.5" />
              </span>
              <span className="text-[17px] font-bold leading-none tabular-nums" style={{ color: "var(--color-text-primary)" }}>{weekDoneDays}/7</span>
              <span className="text-[11px] leading-none" style={{ color: "var(--color-text-disabled)" }}>本周完成</span>
            </div>
            <div className="flex flex-col items-center gap-1.5 py-3 rounded-xl" style={{ background: "var(--lifeflow-muted)" }}>
              <span className="w-7 h-7 rounded-full flex items-center justify-center" style={{ background: "var(--lifeflow-brand-50)", color: "var(--lifeflow-primary)" }}>
                <Target className="w-3.5 h-3.5" />
              </span>
              <span className="text-[17px] font-bold leading-none tabular-nums" style={{ color: "var(--color-text-primary)" }}>{monthRate}%</span>
              <span className="text-[11px] leading-none" style={{ color: "var(--color-text-disabled)" }}>本月完成率</span>
            </div>
          </div>
        </motion.div>

        {/* ─── 新建习惯入口 ─── */}
        <motion.button
          type="button"
          whileTap={{ scale: 0.98 }}
          onClick={() => setShowAdd(true)}
          className="w-full h-12 flex items-center justify-center gap-2 rounded-xl text-[15px] font-semibold"
          style={{
            background: "var(--state-success)",
            color: "#fff",
            boxShadow: "var(--shadow-card)",
          }}
        >
          <Plus className="w-[18px] h-[18px]" />
          新建习惯
        </motion.button>

        {/* ─── 空状态 ─── */}
        {habits.length === 0 && (
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            className="flex flex-col items-center justify-center"
            style={{ minHeight: "calc(100vh - 320px)" }}
          >
            <div
              className="w-full flex flex-col items-center text-center px-8 py-10"
              style={{ maxWidth: 320, backgroundColor: "var(--color-surface-card)", borderRadius: 20, boxShadow: "var(--shadow-card)" }}
            >
              <div className="mb-5 flex h-16 w-16 items-center justify-center rounded-full" style={{ backgroundColor: "var(--lifeflow-brand-50)" }}>
                <CheckCircle className="w-8 h-8" style={{ color: "var(--lifeflow-primary)" }} />
              </div>
              <p className="text-[17px] mb-6" style={{ color: "var(--color-text-secondary)" }}>暂无习惯</p>
              <button
                type="button"
                onClick={() => setShowAdd(true)}
                className="inline-flex items-center gap-2 rounded-full px-6 py-2.5 text-[15px] font-medium transition-opacity hover:opacity-90"
                style={{ backgroundColor: "var(--state-success)", color: "#fff" }}
              >
                <Plus className="w-4 h-4" />
                <span>创建习惯</span>
              </button>
            </div>
          </motion.div>
        )}
      </div>

      {/* ─── 新建习惯 Bottom Sheet（画布样式） ─── */}
      <AnimatePresence>
        {showAdd && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 bg-black/30 z-40"
              onClick={() => { setShowAdd(false); setNewName(""); }}
            />
            <motion.div
              initial={{ y: "100%" }}
              animate={{ y: 0 }}
              exit={{ y: "100%" }}
              transition={{ type: "spring", stiffness: 400, damping: 40 }}
              className="fixed bottom-0 left-0 right-0 z-50 rounded-t-[20px] px-5 pt-3 pb-10"
              style={{ maxWidth: 430, margin: "0 auto", background: "var(--color-surface-card)" }}
              role="dialog"
              aria-modal="true"
              aria-label="新建习惯"
            >
              <div className="w-9 h-1 rounded-full mx-auto mb-4" style={{ background: "var(--lifeflow-muted)" }} />
              <h3 className="text-[17px] font-bold text-center" style={{ color: "var(--color-text-primary)" }}>新建习惯</h3>
              <p className="text-[12px] mt-1 text-center" style={{ color: "var(--color-text-disabled)" }}>设定一个想坚持的小动作</p>

              <label className="block text-[12px] font-semibold mt-5 mb-2" style={{ color: "var(--color-text-secondary)" }} htmlFor="habit-name-input">
                习惯名称
              </label>
              <input
                id="habit-name-input"
                type="text"
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                placeholder="如：晨间拉伸 10 分钟"
                maxLength={20}
                autoFocus
                onKeyDown={(e) => { if (e.key === "Enter") handleAdd(); }}
                className="w-full h-12 px-4 rounded-[10px] text-[15px] outline-none transition-shadow"
                style={{
                  background: "var(--lifeflow-input)",
                  border: "1px solid var(--lifeflow-border)",
                  color: "var(--color-text-primary)",
                }}
              />

              <div className="flex gap-2.5 mt-6">
                <button
                  type="button"
                  onClick={() => { setShowAdd(false); setNewName(""); }}
                  className="flex-1 h-11 rounded-[10px] text-[15px] font-semibold"
                  style={{ background: "var(--lifeflow-muted)", color: "var(--color-text-primary)" }}
                >
                  取消
                </button>
                <button
                  type="button"
                  onClick={handleAdd}
                  disabled={!newName.trim() || adding}
                  className="flex-1 h-11 rounded-[10px] text-[15px] font-semibold text-white disabled:opacity-50"
                  style={{ background: "var(--state-success)" }}
                >
                  保存
                </button>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  );
}
