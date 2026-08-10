"use client";

import { useMemo, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { ChevronLeft, Plus, Trash2, CalendarHeart, Clock9 } from "lucide-react";
import { useLiveQuery } from "dexie-react-hooks";
import { getCountdowns, addCountdown, updateCountdown, deleteCountdown } from "@/lib/db/life.db";
import type { Countdown } from "@/lib/db/life.db";
import { showToast } from "@/components/ui/Toast";

/** 卡片主题色（对齐画布：蓝 / 橙 / 紫），写入 countdowns 的 icon 字段 */
const COLOR_KEYS = ["study", "training", "ideal"] as const;
type ColorKey = (typeof COLOR_KEYS)[number];

const COLOR_STYLE: Record<ColorKey, { label: string; dot: string; border: string; light: string; text: string; fill: string }> = {
  study: {
    label: "蓝",
    dot: "bg-blue-500",
    border: "border-blue-500",
    light: "bg-blue-50 dark:bg-blue-900/30",
    text: "text-blue-600 dark:text-blue-400",
    fill: "bg-blue-500",
  },
  training: {
    label: "橙",
    dot: "bg-orange-500",
    border: "border-orange-500",
    light: "bg-orange-50 dark:bg-orange-900/30",
    text: "text-orange-600 dark:text-orange-400",
    fill: "bg-orange-500",
  },
  ideal: {
    label: "紫",
    dot: "bg-purple-500",
    border: "border-purple-500",
    light: "bg-purple-50 dark:bg-purple-900/30",
    text: "text-purple-600 dark:text-purple-400",
    fill: "bg-purple-500",
  },
};

/** 旧数据 icon 为 emoji 时，按哈希确定性映射到一种主题色 */
function colorKeyFor(icon: string): ColorKey {
  if (COLOR_STYLE[icon as ColorKey]) return icon as ColorKey;
  let h = 0;
  for (let i = 0; i < icon.length; i++) h = (h * 31 + icon.charCodeAt(i)) >>> 0;
  return COLOR_KEYS[h % COLOR_KEYS.length];
}

function todayStr(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function daysBetween(d1: string, d2: string): number {
  return Math.ceil((new Date(d2).getTime() - new Date(d1).getTime()) / 86400000);
}

export default function CountdownPage() {
  const router = useRouter();
  const today = todayStr();

  const countdowns = useLiveQuery(() => getCountdowns(), [], [] as Countdown[]);

  const [showAdd, setShowAdd] = useState(false);
  const [newName, setNewName] = useState("");
  const [newDate, setNewDate] = useState("");
  const [selectedColor, setSelectedColor] = useState<ColorKey>("study");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [adding, setAdding] = useState(false);
  const [filter, setFilter] = useState<"all" | "30" | "100">("all");

  const handleSave = useCallback(async () => {
    if (!newName.trim() || !newDate || adding) return;
    setAdding(true);
    if (editingId) {
      await updateCountdown(editingId, { name: newName.trim(), date: newDate, icon: selectedColor });
      showToast({ type: "success", message: "已更新" });
    } else {
      await addCountdown({ name: newName.trim(), date: newDate, icon: selectedColor, type: "once" });
      showToast({ type: "success", message: "已添加" });
    }
    setNewName("");
    setNewDate("");
    setEditingId(null);
    setShowAdd(false);
    setAdding(false);
  }, [newName, newDate, selectedColor, editingId, adding]);

  const handleDelete = useCallback(async (id: string) => {
    await deleteCountdown(id);
    showToast({ type: "success", message: "已删除" });
  }, []);

  const openNew = () => {
    setEditingId(null);
    setNewName("");
    setNewDate("");
    setSelectedColor("study");
    setShowAdd(true);
  };

  const openEdit = (c: Countdown) => {
    setEditingId(c.id);
    setNewName(c.name);
    setNewDate(c.date);
    setSelectedColor(colorKeyFor(c.icon));
    setShowAdd(true);
  };

  const closeSheet = () => {
    setShowAdd(false);
    setEditingId(null);
    setNewName("");
    setNewDate("");
    setAdding(false);
  };

  const sorted = useMemo(() => {
    return [...(countdowns ?? [])].sort((a, b) => a.date.localeCompare(b.date));
  }, [countdowns]);

  const shown = useMemo(() => {
    if (filter === "all") return sorted;
    const max = parseInt(filter, 10);
    return sorted.filter((c) => {
      const d = daysBetween(today, c.date);
      return d >= 0 && d <= max;
    });
  }, [sorted, filter, today]);

  return (
    <div className="min-h-dvh max-w-md mx-auto px-4 pt-[var(--safe-area-top)] pb-[104px]">
      {/* 顶部：返回 + 标题 + 数量 */}
      <header className="flex items-center gap-2 py-2">
        <button
          type="button"
          onClick={() => router.push("/more")}
          aria-label="返回"
          className="w-9 h-9 shrink-0 flex items-center justify-center rounded-full bg-white dark:bg-gray-900 border border-gray-100 dark:border-gray-800 shadow-sm text-gray-500 dark:text-gray-400 hover:opacity-85 active:scale-90 transition"
        >
          <ChevronLeft className="w-5 h-5" />
        </button>
        <span className="w-8 h-8 shrink-0 rounded-[10px] bg-purple-50 dark:bg-purple-900/30 text-purple-500 dark:text-purple-400 flex items-center justify-center">
          <CalendarHeart className="w-[18px] h-[18px]" />
        </span>
        <h1 className="flex-1 min-w-0 text-[24px] font-bold text-gray-900 dark:text-white truncate">倒数日</h1>
        <span className="shrink-0 px-2.5 py-1 rounded-full bg-gray-100 dark:bg-gray-800 text-gray-500 dark:text-gray-400 text-xs font-semibold font-mono">
          {(countdowns ?? []).length} 个
        </span>
      </header>

      {/* 快捷筛选 */}
      <div className="flex gap-0.5 p-1 bg-gray-100 dark:bg-gray-800 rounded-[10px] mt-2">
        {(
          [
            { key: "all", label: "全部" },
            { key: "30", label: "30 天内" },
            { key: "100", label: "100 天内" },
          ] as const
        ).map((s) => (
          <button
            key={s.key}
            type="button"
            onClick={() => setFilter(s.key)}
            aria-pressed={filter === s.key}
            className={`flex-1 h-8 rounded-md text-[13px] transition active:scale-95 ${
              filter === s.key
                ? "bg-white dark:bg-gray-900 text-gray-900 dark:text-white font-semibold shadow-sm"
                : "text-gray-500 dark:text-gray-400 hover:text-gray-800 dark:hover:text-gray-200"
            }`}
          >
            {s.label}
          </button>
        ))}
      </div>

      {/* 列表 */}
      {(countdowns ?? []).length === 0 ? (
        /* 空态 */
        <section className="flex flex-col items-center justify-center pt-16">
          <div className="flex w-full max-w-sm flex-col items-center gap-6 p-10 rounded-[20px] bg-white dark:bg-gray-900 shadow-[var(--shadow-card)]">
            <div className="inline-flex h-16 w-16 items-center justify-center rounded-full bg-blue-50 dark:bg-blue-900/30">
              <Clock9 className="h-8 w-8 text-[var(--lifeflow-primary)]" />
            </div>
            <p className="text-[17px] text-center text-gray-500 dark:text-gray-400">
              还没有倒数日。添加一个值得期待的日子。
            </p>
            <button
              onClick={openNew}
              className="inline-flex items-center justify-center rounded-full px-6 py-2.5 text-[15px] font-semibold whitespace-nowrap text-white bg-[var(--lifeflow-primary)] hover:opacity-90 active:opacity-80 transition"
            >
              添加一个日子
            </button>
          </div>
        </section>
      ) : (
        <>
          <div className="flex flex-col gap-2.5 mt-3">
            {shown.map((c, i) => {
              const days = daysBetween(today, c.date);
              const isPast = days < 0;
              const isToday = days === 0;
              const key = colorKeyFor(c.icon);
              const style = COLOR_STYLE[key];
              return (
                <motion.div
                  key={c.id}
                  initial={{ opacity: 0, y: 12 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: Math.min(i * 0.05, 0.3) }}
                  className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-100 dark:border-gray-800 shadow-[var(--shadow-card)] px-4 pt-3.5 pb-2.5"
                >
                  <div className="flex items-center gap-2 min-w-0">
                    <span className={`w-2 h-2 rounded-full flex-shrink-0 ${style.dot}`} aria-hidden="true" />
                    <h2 className="flex-1 min-w-0 text-[15px] font-semibold text-gray-900 dark:text-white truncate">{c.name}</h2>
                    <span className="shrink-0 font-mono text-[11px] text-gray-500 dark:text-gray-400 bg-gray-100 dark:bg-gray-800 rounded px-2 py-0.5">
                      目标 {c.date}
                    </span>
                  </div>

                  <div className="flex items-center justify-between gap-3 mt-3">
                    <div className="flex items-baseline gap-1.5 min-w-0">
                      <span className="text-[11px] text-gray-400 shrink-0">
                        {isPast ? "已过" : isToday ? "今天" : "剩余"}
                      </span>
                      {isToday ? (
                        <span className="text-[26px] font-bold text-[var(--lifeflow-primary)] leading-none">今天</span>
                      ) : (
                        <>
                          <span className={`font-mono text-[30px] font-bold leading-none ${isPast ? "text-gray-400 dark:text-gray-500" : "text-gray-900 dark:text-white"}`}>
                            {Math.abs(days)}
                          </span>
                          <span className="text-xs text-gray-400">天</span>
                        </>
                      )}
                    </div>
                    <p className={`text-[11px] ${isPast ? "text-gray-400" : "text-gray-500 dark:text-gray-400"} truncate`}>
                      {isPast ? `目标已过去 ${Math.abs(days)} 天` : isToday ? "目标日就在今天" : `距离目标还有 ${days} 天`}
                    </p>
                  </div>

                  <div className="flex items-center justify-end gap-1 mt-3 pt-2.5 border-t border-gray-100 dark:border-gray-800">
                    <button
                      type="button"
                      onClick={() => openEdit(c)}
                      className="h-7 px-2.5 rounded-md text-xs font-semibold text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800 transition"
                    >
                      编辑
                    </button>
                    <button
                      type="button"
                      onClick={() => handleDelete(c.id)}
                      className="h-7 px-2.5 rounded-md text-xs font-semibold text-red-500 hover:bg-red-50 dark:hover:bg-red-900/30 transition"
                    >
                      <span className="inline-flex items-center gap-1">
                        <Trash2 className="w-3.5 h-3.5" />
                        删除
                      </span>
                    </button>
                  </div>
                </motion.div>
              );
            })}
          </div>
          {shown.length === 0 && (
            <p className="text-center text-[13px] text-gray-400 mt-8">该范围内暂无倒数日</p>
          )}
        </>
      )}

      {/* 新建 FAB */}
      <button
        type="button"
        onClick={openNew}
        aria-label="新建倒数日"
        className="fixed right-4 bottom-[180px] z-40 w-14 h-14 rounded-full bg-[var(--lifeflow-primary)] text-white shadow-[var(--shadow-modal)] flex items-center justify-center active:scale-90 transition"
      >
        <Plus className="w-6 h-6" />
      </button>

      {/* 新建/编辑 BottomSheet */}
      <AnimatePresence>
        {showAdd && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-end justify-center bg-black/40"
            onClick={closeSheet}
          >
            <motion.div
              initial={{ y: "100%" }}
              animate={{ y: 0 }}
              exit={{ y: "100%" }}
              transition={{ type: "spring", stiffness: 380, damping: 40 }}
              onClick={(e) => e.stopPropagation()}
              className="w-full max-w-md bg-white dark:bg-gray-900 rounded-t-3xl px-5 pt-3 pb-[calc(18px+env(safe-area-inset-bottom))]"
            >
              <div className="w-9 h-1 mx-auto rounded-full bg-gray-200 dark:bg-gray-700 mb-4" />
              <h3 className="text-center text-[17px] font-bold text-gray-900 dark:text-white">
                {editingId ? "编辑倒数日" : "新建倒数日"}
              </h3>
              <p className="text-center text-xs text-gray-400 mt-1">记下一个重要日子，慢慢倒计时</p>
              <input
                type="text"
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                placeholder="事件名称，如 考研初试"
                autoFocus
                autoComplete="off"
                aria-label="事件名称"
                className="block w-full mt-3.5 rounded-[10px] border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 px-3 py-3 text-[15px] text-gray-900 dark:text-white outline-none focus:border-blue-400 placeholder:text-gray-400"
              />
              <input
                type="date"
                value={newDate}
                onChange={(e) => setNewDate(e.target.value)}
                aria-label="目标日期"
                className="block w-full mt-3 rounded-[10px] border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 px-3 py-3 text-[15px] text-gray-900 dark:text-white outline-none focus:border-blue-400"
              />
              {/* 颜色选择 */}
              <div className="flex gap-2 mt-3">
                {COLOR_KEYS.map((k) => {
                  const s = COLOR_STYLE[k];
                  return (
                    <button
                      key={k}
                      type="button"
                      onClick={() => setSelectedColor(k)}
                      aria-pressed={selectedColor === k}
                      className={`flex-1 h-10 rounded-[10px] border text-[13px] font-semibold flex items-center justify-center gap-1.5 transition active:scale-95 ${
                        selectedColor === k
                          ? `${s.border} ${s.light} ${s.text}`
                          : "border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 text-gray-500 dark:text-gray-400"
                      }`}
                    >
                      <span className={`w-2.5 h-2.5 rounded-full ${s.dot}`} aria-hidden="true" />
                      {s.label}
                    </button>
                  );
                })}
              </div>
              <div className="flex gap-2.5 mt-4">
                <button
                  type="button"
                  onClick={closeSheet}
                  className="flex-1 h-11 rounded-[10px] text-[15px] font-semibold text-gray-900 dark:text-white bg-gray-100 dark:bg-gray-800 hover:opacity-85 transition"
                >
                  取消
                </button>
                <button
                  type="button"
                  onClick={handleSave}
                  disabled={!newName.trim() || !newDate}
                  className="flex-1 h-11 rounded-[10px] text-[15px] font-semibold text-white bg-[var(--lifeflow-primary)] transition hover:opacity-90 disabled:opacity-40"
                >
                  {editingId ? "保存" : "添加"}
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
