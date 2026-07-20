"use client";

// ============================================================
// 设计基准
//   - iOS 日历风格垂直时间轴：左侧 48px 时间标尺 + 右侧事件块区域
//   - 每小时高度 60px，canvas 总高 24*60 = 1440px
//   - 事件 top = timeToMinutes(start)，height = max(24, durationMinutes)
//   - 事件块左侧 3px 竖线（color），内部 icon+title+time
//   - isCorrected 且 actual!=planned 时显示灰色删除线计划 + 实际
//   - 编辑：点击事件块 → inline expand 编辑 actual/planned/标题/花费/备注
//   - FAB 添加 Item；习惯联动 generateHabitItems；花费联动 addTransaction
// ============================================================

import { useState, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  ChevronLeft, ChevronRight, Plus, X, Trash2,
  Clock, CheckSquare, GraduationCap, Moon, ListTodo, Activity,
} from "lucide-react";
import {
  getItemsByDate, addItem, updateItem, deleteItem,
  generateCourseItems, generateRoutineItems, generateHabitItems,
} from "@/lib/db/daylog.db";
import type { Item, SourceType } from "@/lib/db/daylog.db";
import { getHabits } from "@/lib/db/life.db";
import type { Habit } from "@/lib/db/life.db";
import { showToast } from "@/components/ui/Toast";
import {
  addTransaction, getTransactionsByDate, updateTransaction,
  getDefaultLedger, getAllCategories, addCategory,
} from "@/lib/db/accounting.db";

// ─── 工具 ────────────────────────────────────────────────────

const HOURS = Array.from({ length: 24 }, (_, i) => i);
const HOUR_HEIGHT = 60;
const CANVAS_H = 24 * HOUR_HEIGHT;

function toDateStr(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function shiftDate(dateStr: string, days: number): string {
  const d = new Date(dateStr + "T00:00:00");
  d.setDate(d.getDate() + days);
  return toDateStr(d);
}

function formatDateFull(dateStr: string): string {
  const d = new Date(dateStr + "T00:00:00");
  const wd = ["周日", "周一", "周二", "周三", "周四", "周五", "周六"];
  return `${d.getMonth() + 1}月${d.getDate()}日 ${wd[d.getDay()]}`;
}

function timeToMinutes(t: string): number {
  const [h, m] = t.split(":").map(Number);
  return h * 60 + (m || 0);
}

function fmtTime(t: string): string {
  const [h, m] = t.split(":");
  return `${h}:${m}`;
}

const SOURCE_LABELS: Record<SourceType, string> = {
  course: "课程", routine: "作息", task: "任务", habit: "习惯",
};

const SOURCE_ICONS: Record<SourceType, React.FC<{ size?: number }>> = {
  course: GraduationCap, routine: Moon, task: ListTodo, habit: CheckSquare,
};

// ─── 动态图标（从 lucide 字符串渲染）─────────────────────────

function renderIcon(name: string, color: string, size = 14) {
  const safeName = name || "Circle";
  // 安全映射到核心图标
  const map: Record<string, React.ReactNode> = {
    GraduationCap: <GraduationCap size={size} color={color} />,
    Moon: <Moon size={size} color={color} />,
    CheckSquare: <CheckSquare size={size} color={color} />,
    ListTodo: <ListTodo size={size} color={color} />,
    Activity: <Activity size={size} color={color} />,
    Clock: <Clock size={size} color={color} />,
  };
  return map[safeName] ?? <Circle size={size} color={color} />;
}

// 兜底 Circle
function Circle({ size = 14, color = "#999" }: { size?: number; color?: string }) {
  return (
    <div
      style={{ width: size, height: size, borderRadius: "50%", background: color, flexShrink: 0 }}
    />
  );
}

// ─── 获取或创建"日程消费"分类 ─────────────────────────────────

let _scheduleCategoryId: string | null = null;

async function ensureScheduleCategory(): Promise<string> {
  if (_scheduleCategoryId) return _scheduleCategoryId;
  const cats = await getAllCategories();
  const found = cats.find((c) => c.name === "日程消费" && c.type === "expense");
  if (found) {
    _scheduleCategoryId = found.id;
    return found.id;
  }
  const ledger = await getDefaultLedger();
  if (!ledger) throw new Error("No ledger found");
  const newId = await addCategory({
    name: "日程消费", type: "expense", icon: "calendar-clock",
    color: "#5856D6", ledgerId: ledger.id,
  });
  _scheduleCategoryId = newId;
  return newId;
}

// ─── 花费同步 ─────────────────────────────────────────────────

async function syncCostTransaction(dateStr: string, itemId: string, amount: number) {
  if (amount <= 0) return;
  try {
    const categoryId = await ensureScheduleCategory();
    const ledger = await getDefaultLedger();
    if (!ledger) return;
    const txs = await getTransactionsByDate(dateStr);
    const existing = txs.find((tx) => tx.note === `schedule:${itemId}`);
    if (existing) {
      if (existing.amount !== amount) {
        await updateTransaction(existing.id, { amount });
      }
    } else {
      await addTransaction({
        ledgerId: ledger.id, type: "expense", amount, date: dateStr,
        categoryId, note: `schedule:${itemId}`,
      });
    }
  } catch {
    // 静默失败
  }
}

// ============================================================
// 主页面
// ============================================================

export default function SchedulePage() {
  const todayStr = toDateStr(new Date());
  const [date, setDate] = useState(todayStr);
  const [items, setItems] = useState<Item[]>([]);
  const [loading, setLoading] = useState(true);
  const [editItem, setEditItem] = useState<Item | null>(null);
  const [showAddForm, setShowAddForm] = useState(false);

  // 新增表单
  const [newSource, setNewSource] = useState<SourceType>("task");
  const [newTitle, setNewTitle] = useState("");
  const [newStart, setNewStart] = useState("08:00");
  const [newEnd, setNewEnd] = useState("09:00");

  // 编辑状态
  const [editTitle, setEditTitle] = useState("");
  const [editActualStart, setEditActualStart] = useState("");
  const [editActualEnd, setEditActualEnd] = useState("");
  const [editCost, setEditCost] = useState("");
  const [editNote, setEditNote] = useState("");

  // ─── 加载 & 自动生成 & 习惯联动 ────────────────────────────

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      try {
        await generateCourseItems(date);
        await generateRoutineItems(date);
        const habits: Habit[] = await getHabits();
        const currentItems = await getItemsByDate(date);
        for (const h of habits) {
          if (h.days?.[date]) {
            await generateHabitItems(date, h.name, h.color, h.id, currentItems);
          }
        }
        if (!cancelled) {
          const list = await getItemsByDate(date);
          setItems(list);
        }
      } catch (err) {
        console.error("[Schedule] auto-generate:", err);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [date]);

  // ─── 操作 ─────────────────────────────────────────────────

  const reloadItems = useCallback(async () => {
    try {
      const list = await getItemsByDate(date);
      setItems(list);
    } catch { /* 静默 */ }
  }, [date]);

  const openEdit = useCallback((item: Item) => {
    setEditItem(item);
    setEditTitle(item.title);
    setEditActualStart(item.actualStart);
    setEditActualEnd(item.actualEnd);
    setEditCost(item.cost != null ? String(item.cost / 100) : "");
    setEditNote(item.note || "");
  }, []);

  const closeEdit = useCallback(() => {
    setEditItem(null);
  }, []);

  const handleSave = useCallback(async () => {
    if (!editItem) return;
    const costFen = editCost ? Math.round(parseFloat(editCost) * 100) : 0;
    const isCorrected =
      editActualStart !== editItem.plannedStart ||
      editActualEnd !== editItem.plannedEnd;

    await updateItem(editItem.id, {
      title: editTitle,
      actualStart: editActualStart,
      actualEnd: editActualEnd,
      cost: costFen > 0 ? costFen : undefined,
      note: editNote || undefined,
      isCorrected,
      updatedAt: Date.now(),
    });
    showToast({ message: "已保存", type: "success" });
    if (costFen > 0) await syncCostTransaction(date, editItem.id, costFen);
    setEditItem(null);
    await reloadItems();
  }, [editItem, editTitle, editActualStart, editActualEnd, editCost, editNote, date, reloadItems]);

  const handleDelete = useCallback(async () => {
    if (!editItem) return;
    await deleteItem(editItem.id);
    showToast({ message: "已删除", type: "success" });
    setEditItem(null);
    await reloadItems();
  }, [editItem, reloadItems]);

  const handleAdd = useCallback(async () => {
    if (!newTitle.trim()) return;
    await addItem({
      date,
      sourceType: newSource,
      sourceId: crypto.randomUUID(),
      title: newTitle.trim(),
      color: "#5865F2",
      icon: "ListTodo",
      plannedStart: newStart,
      plannedEnd: newEnd,
      actualStart: newStart,
      actualEnd: newEnd,
      isCorrected: false,
      isCompleted: false,
      sortOrder: timeToMinutes(newStart),
    });
    showToast({ message: "已添加", type: "success" });
    setShowAddForm(false);
    setNewTitle("");
    await reloadItems();
  }, [newTitle, newSource, newStart, newEnd, date, reloadItems]);

  // ─── 当前位置指示线 ─────────────────────────────────────────

  const nowMinutes = new Date().getHours() * 60 + new Date().getMinutes();
  const isToday = date === todayStr;

  // ─── 渲染 ─────────────────────────────────────────────────

  return (
    <div className="min-h-screen bg-[var(--color-bg-page)] text-[var(--color-text-primary)] font-sans">
      <div className="mx-auto max-w-2xl px-4 pt-6 pb-32">
        {/* 页头 */}
        <h1 className="text-[34px] font-bold leading-tight tracking-tight">日程</h1>
        <p className="text-sm text-[var(--color-text-secondary)] mt-1 mb-5">
          时间轴 · 一日一览
        </p>

        {/* 日期导航 */}
        <div className="flex items-center justify-between mb-5">
          <button
            onClick={() => setDate(shiftDate(date, -1))}
            className="w-9 h-9 flex items-center justify-center rounded-xl hover:bg-gray-100 active:scale-95 transition-all"
          >
            <ChevronLeft size={20} className="text-[var(--color-text-secondary)]" />
          </button>
          <div className="flex items-center gap-2">
            <span className="text-base font-semibold">{formatDateFull(date)}</span>
            {isToday && (
              <span className="text-xs text-[var(--color-accent)] font-medium bg-[var(--color-bg-fill)] px-2 py-0.5 rounded-full">
                今天
              </span>
            )}
          </div>
          <button
            onClick={() => setDate(shiftDate(date, 1))}
            className="w-9 h-9 flex items-center justify-center rounded-xl hover:bg-gray-100 active:scale-95 transition-all"
          >
            <ChevronRight size={20} className="text-[var(--color-text-secondary)]" />
          </button>
        </div>

        {!isToday && (
          <button
            onClick={() => setDate(todayStr)}
            className="mb-4 text-xs text-[var(--color-accent)] hover:underline"
          >
            回到今天
          </button>
        )}

        {/* 时间轴 */}
        {loading ? (
          <div className="space-y-3 mt-4">
            {[1, 2, 3, 4, 5].map((i) => (
              <div key={i} className="skeleton h-12 rounded-xl" />
            ))}
          </div>
        ) : items.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 text-center">
            <Clock size={40} className="text-[var(--color-text-tertiary)] mb-3" />
            <p className="text-sm text-[var(--color-text-secondary)]">当天暂无日程</p>
            <p className="text-xs text-[var(--color-text-tertiary)] mt-1">
              点击右下角 + 添加，或前往课程/作息模板配置自动生成
            </p>
          </div>
        ) : (
          <div className="relative bg-white rounded-2xl border border-[var(--color-border)] shadow-sm overflow-hidden">
            {/* canvas */}
            <div className="relative" style={{ height: CANVAS_H }}>
              {/* 时间标尺 */}
              {HOURS.map((h) => (
                <div
                  key={h}
                  className="absolute left-0 w-[48px] flex items-start justify-end pr-2 pointer-events-none"
                  style={{ top: h * HOUR_HEIGHT }}
                >
                  <span className="text-[11px] text-[var(--color-text-tertiary)] font-mono leading-none mt-[-6px]">
                    {String(h).padStart(2, "0")}:00
                  </span>
                </div>
              ))}

              {/* 当前时间指示线 */}
              {isToday && (
                <div
                  className="absolute left-[48px] right-0 z-20 pointer-events-none"
                  style={{ top: nowMinutes }}
                >
                  <div className="flex items-center">
                    <div className="w-2 h-2 rounded-full bg-red-500 -ml-1" />
                    <div className="flex-1 h-px bg-red-500" />
                  </div>
                </div>
              )}

              {/* 小时分隔线 */}
              {HOURS.map((h) => (
                <div
                  key={`line-${h}`}
                  className="absolute left-[48px] right-0 border-t border-[var(--color-separator)] pointer-events-none"
                  style={{ top: h * HOUR_HEIGHT }}
                />
              ))}

              {/* 事件块 */}
              {items.map((item) => {
                const startMin = timeToMinutes(item.actualStart);
                const endMin = timeToMinutes(item.actualEnd);
                const duration = Math.max(endMin - startMin, 15);
                const top = startMin;
                const height = Math.max(duration, 24);
                const isEdited =
                  item.isCorrected &&
                  (item.actualStart !== item.plannedStart ||
                    item.actualEnd !== item.plannedEnd);

                return (
                  <motion.button
                    key={item.id}
                    layout
                    onClick={() => openEdit(item)}
                    className="absolute left-[48px] right-2 rounded-lg overflow-hidden text-left z-10 group"
                    style={{
                      top,
                      height,
                      background: `${item.color}14`,
                    }}
                    whileTap={{ scale: 0.98 }}
                  >
                    {/* 左侧色条 */}
                    <div
                      className="absolute left-0 top-1 bottom-1 w-[3px] rounded-full"
                      style={{ background: item.color }}
                    />
                    <div className="pl-2.5 pr-2 h-full flex flex-col justify-center min-w-0">
                      <div className="flex items-center gap-1.5">
                        <span className="flex-shrink-0">{renderIcon(item.icon, item.color, 13)}</span>
                        <span className="text-xs font-medium truncate text-[var(--color-text-primary)]">
                          {item.title}
                        </span>
                      </div>
                      <div className="flex items-center gap-1.5 mt-0.5 ml-[18px]">
                        {isEdited ? (
                          <>
                            <span className="text-[10px] text-[var(--color-text-tertiary)] line-through">
                              {fmtTime(item.plannedStart)}-{fmtTime(item.plannedEnd)}
                            </span>
                            <span className="text-[10px] text-[var(--color-accent)] font-medium">
                              {fmtTime(item.actualStart)}-{fmtTime(item.actualEnd)}
                            </span>
                          </>
                        ) : (
                          <span className="text-[10px] text-[var(--color-text-tertiary)]">
                            {fmtTime(item.actualStart)}-{fmtTime(item.actualEnd)}
                          </span>
                        )}
                        {item.cost != null && item.cost > 0 && (
                          <span className="text-[10px] text-[var(--color-text-tertiary)] ml-auto">
                            -{item.cost / 100}元
                          </span>
                        )}
                      </div>
                    </div>
                  </motion.button>
                );
              })}
            </div>
          </div>
        )}
      </div>

      {/* ─── 编辑面板 ────────────────────────────────────────── */}
      <AnimatePresence>
        {editItem && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-40 flex items-end justify-center bg-black/30"
            onClick={closeEdit}
          >
            <motion.div
              initial={{ y: "100%" }}
              animate={{ y: 0 }}
              exit={{ y: "100%" }}
              transition={{ type: "spring", damping: 28, stiffness: 300 }}
              onClick={(e) => e.stopPropagation()}
              className="bg-white w-full max-w-2xl rounded-t-3xl p-6 pb-10 shadow-[var(--shadow-modal)] max-h-[85vh] overflow-y-auto"
            >
              <div className="flex items-center justify-between mb-5">
                <h3 className="text-lg font-bold">编辑日程</h3>
                <button
                  onClick={closeEdit}
                  className="w-8 h-8 flex items-center justify-center rounded-xl hover:bg-gray-100"
                >
                  <X size={18} className="text-[var(--color-text-secondary)]" />
                </button>
              </div>

              <div className="space-y-4">
                {/* 标题 */}
                <div>
                  <label className="block text-xs font-medium text-[var(--color-text-secondary)] mb-1">
                    标题
                  </label>
                  <input
                    value={editTitle}
                    onChange={(e) => setEditTitle(e.target.value)}
                    className="w-full px-4 py-2.5 rounded-xl bg-gray-50 border border-[var(--color-border)] text-sm focus:outline-none focus:ring-2 focus:ring-[var(--color-accent)]/30"
                  />
                </div>

                {/* 计划时间（只读） */}
                <div className="flex items-center gap-2 text-xs text-[var(--color-text-tertiary)]">
                  <Clock size={13} />
                  <span>
                    计划：{fmtTime(editItem.plannedStart)} — {fmtTime(editItem.plannedEnd)}
                  </span>
                </div>

                {/* 实际时间 */}
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-medium text-[var(--color-text-secondary)] mb-1">
                      实际开始
                    </label>
                    <input
                      type="time"
                      value={editActualStart}
                      onChange={(e) => setEditActualStart(e.target.value)}
                      className="w-full px-3 py-2.5 rounded-xl bg-gray-50 border border-[var(--color-border)] text-sm focus:outline-none focus:ring-2 focus:ring-[var(--color-accent)]/30"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-[var(--color-text-secondary)] mb-1">
                      实际结束
                    </label>
                    <input
                      type="time"
                      value={editActualEnd}
                      onChange={(e) => setEditActualEnd(e.target.value)}
                      className="w-full px-3 py-2.5 rounded-xl bg-gray-50 border border-[var(--color-border)] text-sm focus:outline-none focus:ring-2 focus:ring-[var(--color-accent)]/30"
                    />
                  </div>
                </div>

                {/* 花费 */}
                <div>
                  <label className="block text-xs font-medium text-[var(--color-text-secondary)] mb-1">
                    花费（元）
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    value={editCost}
                    onChange={(e) => setEditCost(e.target.value)}
                    placeholder="0.00"
                    className="w-full px-4 py-2.5 rounded-xl bg-gray-50 border border-[var(--color-border)] text-sm focus:outline-none focus:ring-2 focus:ring-[var(--color-accent)]/30"
                  />
                </div>

                {/* 备注 */}
                <div>
                  <label className="block text-xs font-medium text-[var(--color-text-secondary)] mb-1">
                    备注
                  </label>
                  <input
                    value={editNote}
                    onChange={(e) => setEditNote(e.target.value)}
                    placeholder="备注内容…"
                    className="w-full px-4 py-2.5 rounded-xl bg-gray-50 border border-[var(--color-border)] text-sm focus:outline-none focus:ring-2 focus:ring-[var(--color-accent)]/30"
                  />
                </div>
              </div>

              {/* 操作按钮 */}
              <div className="flex gap-3 mt-6">
                <motion.button
                  whileTap={{ scale: 0.96 }}
                  onClick={handleDelete}
                  className="flex items-center justify-center gap-1.5 px-4 py-2.5 rounded-xl border border-red-200 text-red-500 text-sm font-medium hover:bg-red-50"
                >
                  <Trash2 size={15} />删除
                </motion.button>
                <motion.button
                  whileTap={{ scale: 0.96 }}
                  onClick={handleSave}
                  className="flex-1 py-2.5 rounded-xl bg-[var(--color-accent)] text-white text-sm font-semibold hover:opacity-90 transition-opacity"
                >
                  保存
                </motion.button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ─── 新增表单 ────────────────────────────────────────── */}
      <AnimatePresence>
        {showAddForm && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-40 flex items-end justify-center bg-black/30"
            onClick={() => setShowAddForm(false)}
          >
            <motion.div
              initial={{ y: "100%" }}
              animate={{ y: 0 }}
              exit={{ y: "100%" }}
              transition={{ type: "spring", damping: 28, stiffness: 300 }}
              onClick={(e) => e.stopPropagation()}
              className="bg-white w-full max-w-2xl rounded-t-3xl p-6 pb-10 shadow-[var(--shadow-modal)]"
            >
              <div className="flex items-center justify-between mb-5">
                <h3 className="text-lg font-bold">添加日程</h3>
                <button
                  onClick={() => setShowAddForm(false)}
                  className="w-8 h-8 flex items-center justify-center rounded-xl hover:bg-gray-100"
                >
                  <X size={18} className="text-[var(--color-text-secondary)]" />
                </button>
              </div>

              <div className="space-y-4">
                {/* 来源类型 */}
                <div>
                  <label className="block text-xs font-medium text-[var(--color-text-secondary)] mb-1.5">
                    类型
                  </label>
                  <div className="grid grid-cols-4 gap-2">
                    {(Object.keys(SOURCE_LABELS) as SourceType[]).map((s) => {
                      const Icon = SOURCE_ICONS[s];
                      return (
                        <button
                          key={s}
                          onClick={() => setNewSource(s)}
                          className={`flex flex-col items-center gap-1 py-2.5 rounded-xl text-xs font-medium transition-colors ${
                            newSource === s
                              ? "bg-[var(--color-bg-fill)] text-[var(--color-accent)]"
                              : "bg-gray-50 text-[var(--color-text-secondary)] hover:bg-gray-100"
                          }`}
                        >
                          <Icon size={18} />
                          {SOURCE_LABELS[s]}
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* 标题 */}
                <div>
                  <label className="block text-xs font-medium text-[var(--color-text-secondary)] mb-1">
                    标题
                  </label>
                  <input
                    value={newTitle}
                    onChange={(e) => setNewTitle(e.target.value)}
                    placeholder="日程标题"
                    className="w-full px-4 py-2.5 rounded-xl bg-gray-50 border border-[var(--color-border)] text-sm focus:outline-none focus:ring-2 focus:ring-[var(--color-accent)]/30"
                  />
                </div>

                {/* 时间 */}
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-medium text-[var(--color-text-secondary)] mb-1">
                      开始时间
                    </label>
                    <input
                      type="time"
                      value={newStart}
                      onChange={(e) => setNewStart(e.target.value)}
                      className="w-full px-3 py-2.5 rounded-xl bg-gray-50 border border-[var(--color-border)] text-sm focus:outline-none focus:ring-2 focus:ring-[var(--color-accent)]/30"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-[var(--color-text-secondary)] mb-1">
                      结束时间
                    </label>
                    <input
                      type="time"
                      value={newEnd}
                      onChange={(e) => setNewEnd(e.target.value)}
                      className="w-full px-3 py-2.5 rounded-xl bg-gray-50 border border-[var(--color-border)] text-sm focus:outline-none focus:ring-2 focus:ring-[var(--color-accent)]/30"
                    />
                  </div>
                </div>
              </div>

              <motion.button
                whileTap={{ scale: 0.96 }}
                onClick={handleAdd}
                disabled={!newTitle.trim()}
                className="w-full mt-6 py-2.5 rounded-xl bg-[var(--color-accent)] text-white text-sm font-semibold hover:opacity-90 disabled:opacity-40 transition-opacity"
              >
                创建日程
              </motion.button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ─── FAB ─────────────────────────────────────────────── */}
      <motion.button
        whileTap={{ scale: 0.9 }}
        onClick={() => setShowAddForm(true)}
        className="fixed bottom-24 right-5 z-30 w-14 h-14 rounded-2xl bg-[var(--color-accent)] text-white shadow-lg flex items-center justify-center hover:opacity-90 transition-opacity"
      >
        <Plus size={26} />
      </motion.button>
    </div>
  );
}
