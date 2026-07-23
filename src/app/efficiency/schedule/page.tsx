"use client";

import { useState, useEffect, useCallback, useMemo, useRef } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import {
  Check, Plus, ChevronLeft, ChevronRight, CalendarDays, Clock,
  ListTodo, X, Circle,
} from "lucide-react";
import { useLiveQuery } from "dexie-react-hooks";
import { getItemsByDateSorted, deleteItem, updateItem, addManualItem } from "@/lib/db/daylog.db";
import type { Item } from "@/lib/db/daylog.db";
import { showToast } from "@/components/ui/Toast";

// ============================================================
// 常量
// ============================================================
const WEEK_DAYS = ["一", "二", "三", "四", "五", "六", "日"];

/** 时间轴范围 06:00 ~ 02:00（次日） */
const HOURS = Array.from({ length: 21 }, (_, i) => {
  const h = (6 + i) % 24;
  return `${String(h).padStart(2, "0")}:00`;
});

// ============================================================
// 工具函数
// ============================================================
function toDateStr(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}
function addDays(date: Date, days: number): Date {
  const d = new Date(date);
  d.setDate(d.getDate() + days);
  return d;
}
function getWeekMonday(baseDate: Date, weekOffset: number): Date {
  const dow = baseDate.getDay();
  const mondayOffset = dow === 0 ? -6 : 1 - dow;
  return addDays(addDays(baseDate, mondayOffset), weekOffset * 7);
}

function timeToMinutes(time: string): number {
  const [h, m] = time.split(":").map(Number);
  if (h < 6) return (h + 24) * 60 + m; // wrap past midnight
  return h * 60 + m;
}

/** 判断事项是否跨越了给定的小时 */
function spansHour(item: Item, hourLabel: string): boolean {
  const startM = timeToMinutes(item.plannedStart);
  const endM = timeToMinutes(item.plannedEnd);
  const hourM = timeToMinutes(hourLabel);
  const nextHourM = hourM + 60;
  return startM < nextHourM && endM > hourM;
}

/** 事项的实际可见分钟数（在该小时块内占多少） */
function itemDurationInSlot(item: Item, hourLabel: string): number {
  const startM = timeToMinutes(item.plannedStart);
  const endM = timeToMinutes(item.plannedEnd);
  const hourM = timeToMinutes(hourLabel);
  const slotStart = Math.max(startM, hourM);
  const slotEnd = Math.min(endM, hourM + 60);
  return Math.max(0, slotEnd - slotStart);
}

function formatTime(t: string): string {
  return t.slice(0, 5);
}

// ============================================================
// 主组件
// ============================================================
export default function SchedulePage() {
  const router = useRouter();
  const [selectedDate, setSelectedDate] = useState<string>("");
  const todayStr = toDateStr(new Date());

  // Load today on mount
  useEffect(() => {
    setSelectedDate(todayStr);
  }, [todayStr]);

  // Live data for selected date
  const items = useLiveQuery(
    () => (selectedDate ? getItemsByDateSorted(selectedDate) : Promise.resolve([] as Item[])),
    [selectedDate],
    [] as Item[],
  );

  // ── 周日历条 ──
  const [weekOffset, setWeekOffset] = useState(0);
  const weekDates = useMemo(() => {
    const mon = getWeekMonday(new Date(), weekOffset);
    return Array.from({ length: 7 }, (_, i) => addDays(mon, i));
  }, [weekOffset]);

  const handleSelectDay = useCallback((date: Date) => {
    setSelectedDate(toDateStr(date));
  }, []);

  const isSelectedToday = selectedDate === todayStr;

  // ── 当前时间线 ──
  const [nowTime, setNowTime] = useState("");
  const timelineRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const update = () => {
      const now = new Date();
      setNowTime(`${String(now.getHours()).padStart(2, "0")}:${String(now.getMinutes()).padStart(2, "0")}`);
    };
    update();
    const id = setInterval(update, 60000);
    return () => clearInterval(id);
  }, []);

  // Auto-scroll to now when mounted (only for today)
  useEffect(() => {
    if (isSelectedToday && nowTime && timelineRef.current) {
      const range = timeToMinutes(nowTime);
      const startBase = 6 * 60;
      const scrollTarget = Math.max(0, range - startBase - 120); // offset -2h for context
      timelineRef.current.scrollTop = (scrollTarget / 60) * 72;
    }
  }, [items, isSelectedToday, nowTime]);

  // ── 时间轴是否包含"现在" ──
  const nowMinutes = nowTime ? timeToMinutes(nowTime) : 0;
  const axisStart = 6 * 60;
  const axisEnd = 26 * 60; // 02:00 next day
  const showNowLine = isSelectedToday && nowMinutes >= axisStart && nowMinutes <= axisEnd;

  // ── 分组：每个小时块中有哪些事项 ──
  const hourBlocks = useMemo(() => {
    if (!items) return HOURS.map(h => ({ hour: h, slotItems: [] as Item[], carryOver: false }));

    return HOURS.map(hour => {
      const slotItems = items.filter(item => {
        const sm = timeToMinutes(item.plannedStart);
        const hm = timeToMinutes(hour);
        const nextHm = hm + 60;
        return sm < nextHm && sm >= hm;
      });
      const carryOver = items.some(item => {
        const sm = timeToMinutes(item.plannedStart);
        const em = timeToMinutes(item.plannedEnd);
        const hm = timeToMinutes(hour);
        return sm < hm && em > hm;
      });
      return { hour, slotItems, carryOver };
    });
  }, [items]);

  // ── 操作 ──
  const handleToggle = useCallback(async (item: Item) => {
    await updateItem(item.id, { isCompleted: !item.isCompleted });
  }, []);

  // ── 删除 ──
  const [deleteTarget, setDeleteTarget] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);

  const handleDeleteConfirm = useCallback(async () => {
    if (!deleteTarget) return;
    await deleteItem(deleteTarget);
    showToast({ type: "success", message: "已删除" });
    setDeleteTarget(null);
    setConfirmDelete(false);
  }, [deleteTarget]);

  // ── 格式 ──
  const formatDateChinese = (date: Date) => {
    const weekDays = ["日", "一", "二", "三", "四", "五", "六"];
    return `${date.getMonth() + 1}月${date.getDate()}日 周${weekDays[date.getDay()]}`;
  };

  const selectedDateObj = selectedDate ? new Date(selectedDate + "T00:00:00") : new Date();

  const monthLabel = useMemo(() => {
    const m = weekDates[0];
    return `${m.getFullYear()}年${m.getMonth() + 1}月`;
  }, [weekDates]);

  return (
    <div className="mx-auto" style={{ maxWidth: 430, minHeight: "100vh", backgroundColor: "var(--lifeflow-background)", paddingBottom: 100 }}>
      {/* ===== Header ===== */}
      <div className="px-5 pt-[var(--safe-area-top)] pb-2 flex items-center justify-between">
        <div>
          <h1 className="text-[34px] font-bold" style={{ color: "var(--color-text-primary)", letterSpacing: "-0.022em", lineHeight: 1.2 }}>
            日程
          </h1>
          <p className="text-[13px] font-medium mt-1" style={{ color: "var(--color-text-secondary)", letterSpacing: "-0.01em" }}>
            时间轴
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Link
            href="/tasks"
            className="px-3 py-1.5 rounded-full text-[12px] font-medium flex items-center gap-1"
            style={{ background: "var(--lifeflow-brand-50)", color: "var(--lifeflow-primary)" }}
          >
            <ListTodo className="w-3.5 h-3.5" />
            分类
          </Link>
        </div>
      </div>

      {/* ===== 周日历条 ===== */}
      <div className="px-5 mb-2 mt-2">
        <div
          className="p-4 overflow-hidden"
          style={{
            backgroundColor: "var(--color-surface-card)",
            borderRadius: 20,
            boxShadow: "var(--shadow-card)",
          }}
        >
          <div className="flex items-center justify-between mb-4">
            <span className="text-[15px] font-semibold" style={{ color: "var(--color-text-primary)", letterSpacing: "-0.018em" }}>
              {monthLabel}
            </span>
            <div className="flex items-center gap-1">
              <button
                type="button"
                onClick={() => setWeekOffset((o) => o - 1)}
                className="w-7 h-7 flex items-center justify-center rounded-lg"
                style={{ color: "var(--color-text-secondary)" }}
                aria-label="上一周"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
              <button
                type="button"
                onClick={() => setWeekOffset((o) => o + 1)}
                className="w-7 h-7 flex items-center justify-center rounded-lg"
                style={{ color: "var(--color-text-secondary)" }}
                aria-label="下一周"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>

          <div className="flex gap-0 overflow-x-auto no-scrollbar -mx-1 px-1">
            {weekDates.map((date) => {
              const ds = toDateStr(date);
              const isActive = ds === selectedDate;
              const isToday = ds === todayStr;
              return (
                <button
                  key={ds}
                  type="button"
                  onClick={() => handleSelectDay(date)}
                  className="flex flex-col items-center gap-1.5 shrink-0"
                  style={{ width: "calc(100% / 7)", minWidth: 44 }}
                >
                  <span className="text-[11px] font-medium" style={{ color: "var(--color-text-secondary)", letterSpacing: 0 }}>
                    {WEEK_DAYS[date.getDay() === 0 ? 6 : date.getDay() - 1]}
                  </span>
                  <div
                    className="w-9 h-9 rounded-full flex items-center justify-center"
                    style={{ backgroundColor: isActive ? "var(--lifeflow-primary)" : "transparent" }}
                  >
                    <span
                      className="text-[15px] leading-none"
                      style={{
                        fontWeight: isActive ? 600 : 500,
                        color: isActive ? "#FFFFFF" : "var(--color-text-primary)",
                      }}
                    >
                      {date.getDate()}
                    </span>
                  </div>
                  {isToday && !isActive && (
                    <div className="w-1 h-1 rounded-full" style={{ background: "var(--lifeflow-primary)" }} />
                  )}
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {/* ===== Date Row ===== */}
      <div className="flex items-center justify-between px-4 mt-4 mb-2">
        <span className="text-[16px] font-bold" style={{ color: "var(--color-text-primary)" }}>
          {formatDateChinese(selectedDateObj)}
        </span>
        {!isSelectedToday && (
          <button
            onClick={() => {
              setWeekOffset(0);
              setSelectedDate(todayStr);
            }}
            className="text-[13px]"
            style={{ color: "var(--lifeflow-primary)" }}
          >
            回到今天
          </button>
        )}
      </div>

      {/* ===== 时间轴 ===== */}
      <div
        ref={timelineRef}
        className="px-4 overflow-y-auto"
        style={{ maxHeight: "calc(100vh - 280px)", scrollBehavior: "smooth" }}
      >
        <div className="relative">
          {/* 时间轴竖线 */}
          <div
            className="absolute left-[52px] top-0 bottom-0 w-px z-0"
            style={{ background: "var(--lifeflow-border)" }}
          />

          {/* 现在线 */}
          {showNowLine && (
            <div
              className="absolute left-0 right-3 z-10 pointer-events-none"
              style={{
                top: `${Math.max(0, Math.min((nowMinutes - axisStart) / 60 * 72, HOURS.length * 72))}px`,
              }}
            >
              <div className="flex items-center gap-1">
                <div className="w-2 h-2 rounded-full bg-[#FF3B30] flex-shrink-0" />
                <div className="flex-1 h-px" style={{ background: "#FF3B30" }} />
              </div>
            </div>
          )}

          {/* 小时块 */}
          {hourBlocks.map((block, bi) => {
            const hourM = timeToMinutes(block.hour);
            const topPx = ((hourM - axisStart) / 60) * 72;

            return (
              <div
                key={block.hour}
                className="flex relative"
                style={{ minHeight: 72, marginTop: bi === 0 ? 0 : 0 }}
              >
                {/* 时间刻度 */}
                <div
                  className="w-12 shrink-0 pt-0.5 text-[12px] font-medium"
                  style={{ color: "var(--color-text-disabled)" }}
                >
                  {block.hour}
                </div>

                {/* 内容区 */}
                <div className="flex-1 ml-3 pb-1 relative">
                  {block.carryOver && (
                    <div className="h-5" />
                  )}

                  {block.slotItems.length === 0 && !block.carryOver && (
                    <div className="h-full flex items-start pt-1">
                      <span className="text-[11px]" style={{ color: "var(--color-text-disabled)" }} />
                    </div>
                  )}

                  {block.carryOver && (
                    <div className="flex items-center gap-2 px-2 py-0.5 mb-1 opacity-40 pointer-events-none">
                      <div className="w-1.5 h-1.5 rounded-full" style={{ background: "var(--color-text-disabled)" }} />
                      <span className="text-[11px] italic" style={{ color: "var(--color-text-disabled)" }}>延续</span>
                    </div>
                  )}

                  {/* 事项卡片 */}
                  {renderSlotItems(block.slotItems, block.hour, handleToggle, setDeleteTarget)}
                </div>
              </div>
            );
          })}

          {/* 无事项提示 */}
          {(!items || items.length === 0) && (
            <div className="flex flex-col items-center justify-center py-16">
              <div className="w-16 h-16 rounded-full flex items-center justify-center mb-4" style={{ backgroundColor: "var(--color-surface-secondary)" }}>
                <CalendarDays className="w-7 h-7" style={{ color: "var(--color-text-disabled)" }} />
              </div>
              <p className="text-[16px] font-medium" style={{ color: "var(--color-text-secondary)" }}>
                当日暂无安排
              </p>
              <p className="text-[12px] mt-1.5" style={{ color: "var(--color-text-disabled)" }}>
                在首页新建事项以开始规划
              </p>
            </div>
          )}
        </div>
      </div>

      {/* ===== 删除确认弹窗 ===== */}
      <AnimatePresence>
        {deleteTarget && (
          <>
            <motion.div
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              onClick={() => setDeleteTarget(null)}
              className="fixed inset-0 z-50 bg-black/40"
            />
            <motion.div
              initial={{ y: "100%" }} animate={{ y: 0 }} exit={{ y: "100%" }}
              transition={{ duration: 0.4, ease: [0.32, 0.72, 0, 1] }}
              className="fixed left-0 right-0 bottom-0 z-[60] rounded-t-[20px] max-w-[430px] mx-auto"
              style={{
                backgroundColor: "var(--color-surface-card)",
                paddingBottom: "env(safe-area-inset-bottom)",
              }}
            >
              <div className="flex justify-center pt-2 pb-3">
                <div className="w-9 h-1 rounded-full bg-[#D4D4D4]" />
              </div>
              <div className="px-4 pb-6">
                <p className="text-[17px] font-semibold mb-4" style={{ color: "var(--color-text-primary)" }}>
                  {confirmDelete ? "确认删除？" : "删除事项"}
                </p>
                {!confirmDelete ? (
                  <button
                    onClick={() => setConfirmDelete(true)}
                    className="w-full py-3 rounded-xl bg-[#FF3B30] text-white text-[15px] font-semibold"
                  >
                    删除
                  </button>
                ) : (
                  <div className="flex gap-3">
                    <button
                      onClick={() => setDeleteTarget(null)}
                      className="flex-1 py-3 rounded-xl text-[15px] font-medium"
                      style={{ backgroundColor: "var(--lifeflow-background)", color: "var(--color-text-secondary)" }}
                    >
                      取消
                    </button>
                    <button
                      onClick={handleDeleteConfirm}
                      className="flex-1 py-3 rounded-xl bg-[#FF3B30] text-white text-[15px] font-semibold"
                    >
                      确认删除
                    </button>
                  </div>
                )}
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>

      <div className="h-4" />
    </div>
  );
}

// ============================================================
// 渲染某个小时块内的事项卡片（堆叠，最多2 + "+N"折叠）
// ============================================================
function renderSlotItems(
  items: Item[],
  hourLabel: string,
  onToggle: (item: Item) => void,
  onDelete: (id: string) => void,
) {
  if (items.length === 0) return null;

  // Sort by plannedStart
  const sorted = [...items].sort((a, b) => a.plannedStart.localeCompare(b.plannedStart));
  const showItems = sorted.slice(0, 2);
  const hiddenCount = sorted.length - 2;

  return (
    <div className="flex flex-col gap-1">
      {showItems.map(item => (
        <ItemCard
          key={item.id}
          item={item}
          hourLabel={hourLabel}
          onToggle={() => onToggle(item)}
          onLongPress={() => onDelete(item.id)}
        />
      ))}
      {hiddenCount > 0 && (
        <button
          className="text-[11px] font-medium px-2 py-1 rounded-lg self-start"
          style={{ color: "var(--color-text-disabled)", background: "var(--color-surface-secondary)" }}
        >
          +{hiddenCount} 项
        </button>
      )}
    </div>
  );
}

// ============================================================
// 事项卡片
// ============================================================
function ItemCard({
  item,
  hourLabel,
  onToggle,
  onLongPress,
}: {
  item: Item;
  hourLabel: string;
  onToggle: () => void;
  onLongPress: () => void;
}) {
  const longPressTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const handleTouchStart = () => {
    longPressTimer.current = setTimeout(onLongPress, 500);
  };
  const handleTouchEnd = () => {
    if (longPressTimer.current) clearTimeout(longPressTimer.current);
  };

  const duration = itemDurationInSlot(item, hourLabel);
  const isMultiHour = timeToMinutes(item.plannedEnd) - timeToMinutes(item.plannedStart) > 60;

  return (
    <motion.div
      initial={{ opacity: 0, y: 4 }}
      animate={{ opacity: 1, y: 0 }}
      className="rounded-[12px] px-3 py-2 flex items-center gap-2 active:scale-[0.97] transition-transform cursor-pointer"
      style={{
        background: item.isCompleted ? "var(--color-surface-secondary)" : `${item.color}15`,
        opacity: item.isCompleted ? 0.55 : 1,
        borderLeft: `3px solid ${item.color}`,
      }}
      onTouchStart={handleTouchStart}
      onTouchEnd={handleTouchEnd}
      onTouchMove={handleTouchEnd}
      onContextMenu={(e) => { e.preventDefault(); onLongPress(); }}
      onClick={onToggle}
    >
      {/* 勾选 */}
      <div
        className="w-5 h-5 rounded-full flex items-center justify-center shrink-0"
        style={{
          background: item.isCompleted ? item.color : "transparent",
          border: item.isCompleted ? "none" : `2px solid ${item.color}40`,
        }}
      >
        {item.isCompleted && <Check className="w-3 h-3 text-white" strokeWidth={3} />}
      </div>

      {/* 内容 */}
      <div className="flex-1 min-w-0">
        <p
          className="text-[14px] font-medium truncate"
          style={{
            color: item.isCompleted ? "var(--color-text-disabled)" : "var(--color-text-primary)",
            textDecoration: item.isCompleted ? "line-through" : "none",
          }}
        >
          {item.title}
        </p>
        <div className="flex items-center gap-1.5 mt-0.5">
          <Clock className="w-3 h-3" style={{ color: "var(--color-text-disabled)" }} />
          <span className="text-[11px]" style={{ color: "var(--color-text-disabled)" }}>
            {formatTime(item.plannedStart)}
            {isMultiHour && ` - ${formatTime(item.plannedEnd)}`}
          </span>
        </div>
      </div>
    </motion.div>
  );
}
