"use client";

import { useState, useEffect, useCallback, useMemo, useRef } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import {
  Check, Plus, ChevronLeft, ChevronRight, ChevronDown, ChevronUp, CalendarDays, Clock,
  X, Target, AlertCircle, Pencil, Moon, Ellipsis, Wallet, Droplets, Timer, StickyNote,
} from "lucide-react";
import { useLiveQuery } from "dexie-react-hooks";
import { getItemsByDateSorted, deleteItem, updateItem, addManualItem, generateRoutineItems, generateCourseItems, getItemsByScheduleDay, getWakeTime } from "@/lib/db/daylog.db";
import { getSleepGoal } from "@/lib/db/health.db";
import { addWaterLog } from "@/lib/db/health.db";
import type { Item } from "@/lib/db/daylog.db";
import { showToast } from "@/components/ui/Toast";
import { detectTimeConflicts } from "@/lib/conflict-detector";
import type { ConflictItem } from "@/lib/conflict-detector";

// ============================================================
// 常量
// ============================================================
const WEEK_DAYS = ["一", "二", "三", "四", "五", "六", "日"];

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
  if (h < 6) return (h + 24) * 60 + m;
  return h * 60 + m;
}

function timeDiff(start: string, end: string): number {
  return Math.max(0, timeToMinutes(end) - timeToMinutes(start));
}

function itemDurationInSlot(item: Item, hourLabel: string): number {
  const startM = timeToMinutes(item.plannedStart);
  const endM = timeToMinutes(item.plannedEnd);
  const hourM = timeToMinutes(hourLabel);
  const slotStart = Math.max(startM, hourM);
  const slotEnd = Math.min(endM, hourM + 60);
  return Math.max(0, slotEnd - slotStart);
}

function formatTimeHM(t: string): string {
  return t.slice(0, 5);
}

// ============================================================
// 主组件
// ============================================================
export default function SchedulePage() {
  const router = useRouter();
  const [selectedDate, setSelectedDate] = useState<string>("");
  const todayStr = toDateStr(new Date());

  useEffect(() => {
    setSelectedDate(todayStr);
  }, [todayStr]);

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

  // 起床时间
  const [wakeTime, setWakeTime] = useState("07:00");
  useEffect(() => { getWakeTime().then(setWakeTime).catch(() => {}); }, []);

  // ── 入睡提醒 ──
  const [sleepReminder, setSleepReminder] = useState<{
    targetTime: string;
    minutesLeft: number;
  } | null>(null);

  useEffect(() => {
    let intervalId: ReturnType<typeof setInterval>;

    const checkReminder = async () => {
      // 仅今天显示，历史日期不显示
      if (selectedDate !== todayStr) {
        setSleepReminder(null);
        return;
      }

      try {
        const goal = await getSleepGoal();
        if (!goal.reminderEnabled) {
          setSleepReminder(null);
          return;
        }

        const [targetH, targetM] = goal.targetTime.split(":").map(Number);
        const targetMinutes = targetH * 60 + targetM;
        const reminderStart = targetMinutes - goal.reminderAdvance;

        const now = new Date();
        const currentMinutes = now.getHours() * 60 + now.getMinutes();

        if (currentMinutes >= reminderStart && currentMinutes < targetMinutes) {
          setSleepReminder({
            targetTime: goal.targetTime,
            minutesLeft: targetMinutes - currentMinutes,
          });
        } else {
          setSleepReminder(null);
        }
      } catch {
        setSleepReminder(null);
      }
    };

    checkReminder();
    intervalId = setInterval(checkReminder, 30000);

    return () => clearInterval(intervalId);
  }, [selectedDate, todayStr]);

  // 当前日程日（按起床时间边界）
  const currentScheduleDay = nowTime >= wakeTime ? todayStr : toDateStr(addDays(new Date(), -1));

  // 是否为过去日期
  const isPastDate = selectedDate < currentScheduleDay;

  const isSelectedToday = selectedDate === currentScheduleDay;

  // 自动生成作息/课程事项
  useEffect(() => {
    if (!selectedDate) return;
    (async () => {
      await generateRoutineItems(selectedDate);
      await generateCourseItems(selectedDate);
    })();
  }, [selectedDate]);

  // Live data — 按起床时间边界查询
  const items = useLiveQuery(
    () => (selectedDate ? getItemsByScheduleDay(selectedDate, wakeTime) : Promise.resolve([] as Item[])),
    [selectedDate, wakeTime],
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

  // ── 时间轴范围 ──
  useEffect(() => {
    if (isSelectedToday && nowTime && timelineRef.current) {
      const range = timeToMinutes(nowTime);
      const startBase = 6 * 60;
      const scrollTarget = Math.max(0, range - startBase - 120);
      timelineRef.current.scrollTop = (scrollTarget / 60) * 72;
    }
  }, [items, isSelectedToday, nowTime]);

  const nowMinutes = nowTime ? timeToMinutes(nowTime) : 0;
  const axisStart = 6 * 60;
  const axisEnd = 26 * 60;
  const showNowLine = isSelectedToday && nowMinutes >= axisStart && nowMinutes <= axisEnd;

  // ── 时间冲突检测 ──
  const conflictItemIds = useMemo(() => {
    const conflictItems: ConflictItem[] = (items || []).map(i => ({
      id: i.id,
      date: selectedDate!,
      plannedStart: i.plannedStart,
      plannedEnd: i.plannedEnd,
      title: i.title,
    }));
    const conflicts = detectTimeConflicts(conflictItems);
    const ids = new Set<string>();
    for (const c of conflicts) {
      ids.add(c.a.id);
      ids.add(c.b.id);
    }
    return ids;
  }, [items, selectedDate]);

  // ── 小时块分组 ──
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

  // ── 小时块展开状态（可同时展开多个） ──
  const [expandedHours, setExpandedHours] = useState<Set<string>>(() => new Set());
  const toggleHourExpand = useCallback((hour: string) => {
    setExpandedHours(prev => {
      const next = new Set(prev);
      if (next.has(hour)) next.delete(hour);
      else next.add(hour);
      return next;
    });
  }, []);

  // ── 勾选切换（仅当天/未来） ──
  const handleToggle = useCallback(async (item: Item) => {
    if (isPastDate) return; // 历史不可勾选
    const newState = !item.isCompleted;
    await updateItem(item.id, { isCompleted: newState });
    if (item.sourceType === "goal" && item.sourceId) {
      // T14：目标来源事项反向回写 DailyAction，驱动 GoalV2 进度与复盘
      const { updateDailyActionV2, goalV2DB } = await import("@/lib/db/goal-v2.db");
      const { recalculateGoalProgress } = await import("@/lib/goal-v2-engine");
      await updateDailyActionV2(item.sourceId, { isCompleted: newState });
      const da = await goalV2DB.goalV2DailyActions.get(item.sourceId);
      if (da?.goalId) await recalculateGoalProgress(da.goalId);
    }
  }, [isPastDate]);

  // ── 删除（仅当天/未来） ──
  const [deleteTarget, setDeleteTarget] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);

  const handleDeleteConfirm = useCallback(async () => {
    if (!deleteTarget) return;
    await deleteItem(deleteTarget);
    showToast({ type: "success", message: "已删除" });
    setDeleteTarget(null);
    setConfirmDelete(false);
  }, [deleteTarget]);

  // ── 校准 ──
  const [calibrateId, setCalibrateId] = useState<string | null>(null);
  const [calibrateStart, setCalibrateStart] = useState("");
  const [calibrateEnd, setCalibrateEnd] = useState("");

  const openCalibrate = useCallback((item: Item) => {
    setCalibrateId(item.id);
    setCalibrateStart(item.actualStart || item.plannedStart);
    setCalibrateEnd(item.actualEnd || item.plannedEnd);
  }, []);

  const handleCalibrate = useCallback(async () => {
    if (!calibrateId) return;
    await updateItem(calibrateId, {
      actualStart: calibrateStart,
      actualEnd: calibrateEnd,
      isCorrected: true,
    });
    showToast({ type: "success", message: "时间已校准" });
    setCalibrateId(null);
  }, [calibrateId, calibrateStart, calibrateEnd]);

  // ── 复盘备注（历史日期） ──
  const [noteId, setNoteId] = useState<string | null>(null);
  const [noteText, setNoteText] = useState("");

  // ── 事项操作栏展开状态 ──
  const [expandedItemId, setExpandedItemId] = useState<string | null>(null);

  // ── 快捷饮水 ──
  const handleQuickWater = useCallback(async (item: Item) => {
    try {
      await addWaterLog({ date: item.date, amount: 200, timestamp: Date.now() } as any);
      showToast({ type: "success", message: "已记一杯水" });
    } catch { showToast({ type: "error", message: "记录失败" }); }
  }, []);

  // ── 快捷记账 ──
  const handleQuickAccounting = useCallback((item: Item) => {
    router.push(`/more/accounting?note=${encodeURIComponent(item.title)}`);
  }, [router]);

  // ── 快捷专注 ──
  const handleQuickFocus = useCallback((item: Item) => {
    router.push(`/more/focus?title=${encodeURIComponent(item.title)}&duration=${timeDiff(item.plannedStart, item.plannedEnd)}`);
  }, [router]);

  const openNote = useCallback((item: Item) => {
    setNoteId(item.id);
    setNoteText(item.note || "");
  }, []);

  const handleSaveNote = useCallback(async () => {
    if (!noteId) return;
    await updateItem(noteId, { note: noteText.trim() || undefined });
    showToast({ type: "success", message: "备注已保存" });
    setNoteId(null);
  }, [noteId, noteText]);

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
            href="/efficiency-v2"
            className="px-3 py-1.5 rounded-full text-[12px] font-medium flex items-center gap-1"
            style={{ background: "var(--lifeflow-brand-50)", color: "var(--lifeflow-primary)" }}
          >
            <Target className="w-3.5 h-3.5" />
            目标
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
        <div className="flex items-center gap-2">
          <span className="text-[16px] font-bold" style={{ color: "var(--color-text-primary)" }}>
            {formatDateChinese(selectedDateObj)}
          </span>
          {isPastDate && (
            <span className="text-[11px] px-2 py-0.5 rounded-full" style={{ background: "var(--lifeflow-muted)", color: "var(--color-text-secondary)" }}>
              历史记录
            </span>
          )}
        </div>
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

      {/* ===== 入睡提醒横幅 ===== */}
      {sleepReminder && (
        <div className="px-4 mb-2">
          <Link
            href="/more/sleep"
            className="flex items-center gap-2.5 px-4 rounded-xl transition-colors active:opacity-80"
            style={{
              height: 40,
              background: "linear-gradient(135deg, rgba(251,146,60,0.12), rgba(245,158,11,0.08))",
              border: "1px solid rgba(251,146,60,0.2)",
            }}
          >
            <Moon className="w-4 h-4 flex-shrink-0" style={{ color: "#F59E0B" }} />
            <span className="text-[13px] font-medium flex-1 truncate" style={{ color: "var(--color-text-primary)" }}>
              距离目标入睡（{sleepReminder.targetTime}）还有 {sleepReminder.minutesLeft} 分钟
            </span>
            <ChevronRight className="w-3.5 h-3.5 flex-shrink-0" style={{ color: "var(--color-text-disabled)" }} />
          </Link>
        </div>
      )}

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

          {/* 现在线（仅当天） */}
          {showNowLine && (
            <div
              className="absolute left-0 right-3 z-10 pointer-events-none"
              style={{ top: `${Math.max(0, Math.min((nowMinutes - axisStart) / 60 * 72, HOURS.length * 72))}px` }}
            >
              <div className="flex items-center gap-1">
                <div className="w-2 h-2 rounded-full bg-[#FF3B30] flex-shrink-0" />
                <div className="flex-1 h-px" style={{ background: "#FF3B30" }} />
              </div>
            </div>
          )}

          {/* 小时块 */}
          {hourBlocks.map((block, bi) => {
            return (
              <div
                key={block.hour}
                className="flex relative"
                style={{ minHeight: 72 }}
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

                  {/* 事项卡片（含饮水，折叠只显示第一个，展开显示全部） */}
                  {renderSlotItems({
                    items: block.slotItems,
                    hourLabel: block.hour,
                    isPastDate,
                    expanded: expandedHours.has(block.hour),
                    onToggleExpand: () => toggleHourExpand(block.hour),
                    onToggle: handleToggle,
                    onDelete: setDeleteTarget,
                    onCalibrate: openCalibrate,
                    onNote: openNote,
                    expandedItemId,
                    setExpandedItemId,
                    onWater: handleQuickWater,
                    onFocus: handleQuickFocus,
                    onAccounting: handleQuickAccounting,
                    conflictItemIds,
                  })}
                </div>
              </div>
            );
          })}

          {/* 无事项提示 */}
          {(!items || items.length === 0) && (
            <div className="flex flex-col items-center justify-center py-20">
              <div className="w-16 h-16 rounded-full flex items-center justify-center mb-4" style={{ backgroundColor: "var(--color-surface-secondary)" }}>
                <CalendarDays className="w-7 h-7" style={{ color: "var(--color-text-disabled)" }} />
              </div>
              <p className="text-[16px] font-medium" style={{ color: "var(--color-text-secondary)" }}>
                {isPastDate ? "当日无记录" : "当日暂无安排"}
              </p>
              {!isPastDate && (
                <p className="text-[13px] mt-2 text-center max-w-[260px] leading-relaxed" style={{ color: "var(--color-text-disabled)" }}>
                  点击右下角新建事项，或语音告诉助手，把今天要做的事排进时间轴
                </p>
              )}
            </div>
          )}
        </div>
      </div>

      {/* ===== 校准弹窗 ===== */}
      <AnimatePresence>
        {calibrateId && (
          <>
            <motion.div
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              onClick={() => setCalibrateId(null)}
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

              <div className="px-5 pb-6">
                <div className="flex items-center justify-between mb-5">
                  <h3 className="text-[20px] font-bold" style={{ color: "var(--color-text-primary)" }}>
                    校准时间
                  </h3>
                  <button
                    onClick={() => setCalibrateId(null)}
                    className="w-8 h-8 rounded-full flex items-center justify-center"
                    style={{ background: "var(--lifeflow-muted)" }}
                  >
                    <X className="w-4 h-4" style={{ color: "var(--color-text-secondary)" }} />
                  </button>
                </div>

                <p className="text-[13px] mb-4" style={{ color: "var(--color-text-secondary)" }}>
                  修改实际开始和结束时间，用于后续复盘
                </p>

                <div className="flex gap-3 mb-6">
                  <div className="flex-1">
                    <label className="text-[13px] font-medium mb-1.5 block" style={{ color: "var(--color-text-secondary)" }}>
                      实际开始
                    </label>
                    <input
                      type="time"
                      value={calibrateStart}
                      onChange={(e) => setCalibrateStart(e.target.value)}
                      className="w-full px-4 py-3 rounded-xl text-[15px] outline-none"
                      style={{ backgroundColor: "var(--lifeflow-background)", color: "var(--color-text-primary)" }}
                    />
                  </div>
                  <div className="flex-1">
                    <label className="text-[13px] font-medium mb-1.5 block" style={{ color: "var(--color-text-secondary)" }}>
                      实际结束
                    </label>
                    <input
                      type="time"
                      value={calibrateEnd}
                      onChange={(e) => setCalibrateEnd(e.target.value)}
                      className="w-full px-4 py-3 rounded-xl text-[15px] outline-none"
                      style={{ backgroundColor: "var(--lifeflow-background)", color: "var(--color-text-primary)" }}
                    />
                  </div>
                </div>

                <button
                  onClick={handleCalibrate}
                  className="w-full py-3.5 rounded-full text-white text-[16px] font-semibold active:opacity-90"
                  style={{ background: "var(--lifeflow-primary)" }}
                >
                  保存校准
                </button>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>

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

      {/* ===== 复盘备注弹窗（历史日期） ===== */}
      <AnimatePresence>
        {noteId && (
          <>
            <motion.div
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              onClick={() => setNoteId(null)}
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

              <div className="px-5 pb-6">
                <div className="flex items-center justify-between mb-5">
                  <h3 className="text-[20px] font-bold" style={{ color: "var(--color-text-primary)" }}>
                    复盘备注
                  </h3>
                  <button
                    onClick={() => setNoteId(null)}
                    className="w-8 h-8 rounded-full flex items-center justify-center"
                    style={{ background: "var(--lifeflow-muted)" }}
                  >
                    <X className="w-4 h-4" style={{ color: "var(--color-text-secondary)" }} />
                  </button>
                </div>

                <textarea
                  placeholder="记录对这件事的反思和总结..."
                  value={noteText}
                  onChange={(e) => setNoteText(e.target.value)}
                  className="w-full px-4 py-3 rounded-xl text-[15px] outline-none resize-none mb-5"
                  style={{
                    backgroundColor: "var(--lifeflow-background)",
                    color: "var(--color-text-primary)",
                    minHeight: 100,
                  }}
                  autoFocus
                />

                <button
                  onClick={handleSaveNote}
                  className="w-full py-3.5 rounded-full text-white text-[16px] font-semibold active:opacity-90"
                  style={{ background: "var(--lifeflow-primary)" }}
                >
                  保存备注
                </button>
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
// 渲染某个小时块内的事项卡片
// ============================================================
function renderSlotItems(args: {
  items: Item[];
  hourLabel: string;
  isPastDate: boolean;
  expanded: boolean;
  onToggleExpand: () => void;
  onToggle: (item: Item) => void;
  onDelete: (id: string) => void;
  onCalibrate: (item: Item) => void;
  onNote: (item: Item) => void;
  expandedItemId: string | null;
  setExpandedItemId: (id: string | null) => void;
  onWater: (item: Item) => void;
  onFocus: (item: Item) => void;
  onAccounting: (item: Item) => void;
  conflictItemIds: Set<string>;
}) {
  const { items, hourLabel, isPastDate, expanded, onToggleExpand, onToggle, onDelete, onCalibrate, onNote,
    expandedItemId, setExpandedItemId, onWater, onFocus, onAccounting, conflictItemIds } = args;
  if (items.length === 0) return null;

  const sorted = [...items].sort((a, b) => a.plannedStart.localeCompare(b.plannedStart));
  const hiddenCount = sorted.length - 1;

  return (
    <div className="flex flex-col gap-1">
      {sorted.map((item, idx) => {
        // 折叠状态只显示第一个事项
        if (!expanded && idx > 0) return null;
        return (
          <ItemCard
            key={item.id}
            item={item}
            hourLabel={hourLabel}
            isPastDate={isPastDate}
            onToggle={() => onToggle(item)}
            onLongPress={() => { if (!isPastDate) onDelete(item.id); }}
            onCalibrate={() => onCalibrate(item)}
            onNote={() => onNote(item)}
            expanded={expandedItemId === item.id}
            onExpandToggle={() => setExpandedItemId(expandedItemId === item.id ? null : item.id)}
            onWater={() => onWater(item)}
            onFocus={() => onFocus(item)}
            onAccounting={() => onAccounting(item)}
            hasConflict={conflictItemIds.has(item.id)}
          />
        );
      })}

      {/* 折叠：展开入口（该时间段有多个事项时） */}
      {!expanded && hiddenCount > 0 && (
        <button
          onClick={onToggleExpand}
          className="flex items-center gap-1.5 px-2 py-1.5 rounded-lg self-start text-[11px] font-medium active:opacity-70"
          style={{ color: "var(--lifeflow-primary)", background: "var(--lifeflow-brand-50)" }}
        >
          <span className="font-semibold">+{hiddenCount} 项</span>
          <span className="opacity-80">详情</span>
          <ChevronDown className="w-3.5 h-3.5" />
        </button>
      )}

      {/* 展开：收起按钮 */}
      {expanded && hiddenCount > 0 && (
        <button
          onClick={onToggleExpand}
          className="flex items-center gap-1.5 px-2 py-1.5 rounded-lg self-start text-[11px] font-medium active:opacity-70"
          style={{ color: "var(--color-text-disabled)", background: "var(--color-surface-secondary)" }}
        >
          <ChevronUp className="w-3.5 h-3.5" />
          收起
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
  isPastDate,
  onToggle,
  onLongPress,
  onCalibrate,
  onNote,
  expanded,
  onExpandToggle,
  onWater,
  onFocus,
  onAccounting,
  hasConflict,
}: {
  item: Item;
  hourLabel: string;
  isPastDate: boolean;
  onToggle: () => void;
  onLongPress: () => void;
  onCalibrate: () => void;
  onNote: () => void;
  expanded: boolean;
  onExpandToggle: () => void;
  onWater: () => void;
  onFocus: () => void;
  onAccounting: () => void;
  hasConflict?: boolean;
}) {
  const longPressTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const handleTouchStart = () => {
    if (isPastDate) return;
    longPressTimer.current = setTimeout(onLongPress, 500);
  };
  const handleTouchEnd = () => {
    if (longPressTimer.current) clearTimeout(longPressTimer.current);
  };

  const isMultiHour = timeToMinutes(item.plannedEnd) - timeToMinutes(item.plannedStart) > 60;
  const isWater = item.sourceType === "water";
  const isRoutine = item.sourceType === "routine";

  // 历史模式卡片行为
  const handleCardClick = () => {
    if (isPastDate) {
      // 历史未完成：点击跳备注
      if (!item.isCompleted) {
        onNote();
      }
    } else {
      // 当天/未来：勾选
      onToggle();
    }
  };

  // 卡片样式
  const isHistoryUncompleted = isPastDate && !item.isCompleted;

  // 显示时间信息
  const displayTime = () => {
    if (!isPastDate) {
      // 当天/未来：只显示计划时间
      return isMultiHour
        ? `${formatTimeHM(item.plannedStart)} - ${formatTimeHM(item.plannedEnd)}`
        : formatTimeHM(item.plannedStart);
    }
    // 历史：显示计划 vs 实际
    if (item.isCorrected) {
      return (
        <span className="flex flex-col gap-0.5">
          <span>计划 {formatTimeHM(item.plannedStart)} - {formatTimeHM(item.plannedEnd)}</span>
          <span>实际 {formatTimeHM(item.actualStart)} - {formatTimeHM(item.actualEnd)}</span>
        </span>
      );
    }
    return isMultiHour
      ? `${formatTimeHM(item.plannedStart)} - ${formatTimeHM(item.plannedEnd)}`
      : formatTimeHM(item.plannedStart);
  };

  return (
    <>
    <motion.div
      initial={{ opacity: 0, y: 4 }}
      animate={{ opacity: 1, y: 0 }}
      className="rounded-[12px] px-3 py-2 flex items-center gap-2 active:scale-[0.97] transition-transform cursor-pointer"
      style={{
        background: item.isCompleted
          ? "var(--color-surface-secondary)"
          : isWater
            ? "#E0F2FE"
            : isRoutine
              ? `${item.color}10`
              : `${item.color}15`,
        opacity: isHistoryUncompleted ? 0.85 : item.isCompleted ? 0.55 : 1,
        borderLeft: `3px solid ${isHistoryUncompleted ? "#FF3B30" : isWater ? "#0EA5E9" : item.color}`,
        boxShadow: hasConflict ? '0 0 0 1.5px #FF3B30' : undefined,
      }}
      onTouchStart={handleTouchStart}
      onTouchEnd={handleTouchEnd}
      onTouchMove={handleTouchEnd}
      onContextMenu={(e) => { if (!isPastDate) { e.preventDefault(); onLongPress(); } }}
      onClick={handleCardClick}
    >
      {/* 状态指示器 */}
      <div
        className="w-5 h-5 rounded-full flex items-center justify-center shrink-0"
        style={{
          background: item.isCompleted ? item.color : isHistoryUncompleted ? "#FF3B3040" : "transparent",
          border: item.isCompleted ? "none" : isHistoryUncompleted ? "1.5px solid #FF3B30" : `2px solid ${item.color}40`,
        }}
      >
        {item.isCompleted && <Check className="w-3 h-3 text-white" strokeWidth={3} />}
        {isHistoryUncompleted && <X className="w-2.5 h-2.5" style={{ color: "#FF3B30" }} strokeWidth={3} />}
      </div>

      {/* 内容 */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-1.5">
          <p
            className="text-[14px] font-medium truncate"
            style={{
              color: item.isCompleted ? "var(--color-text-disabled)" : "var(--color-text-primary)",
              textDecoration: item.isCompleted ? "line-through" : "none",
            }}
          >
            {isWater && <span className="mr-1">💧</span>}
            {isRoutine && <span className="mr-1">⏰</span>}
            {item.title}
          </p>
          {isHistoryUncompleted && (
            <span className="text-[10px] px-1.5 py-0.5 rounded-full flex-shrink-0" style={{ background: "#FF3B3020", color: "#FF3B30" }}>
              未完成
            </span>
          )}
        </div>
        <div className="flex items-center gap-1.5 mt-0.5">
          <Clock className="w-3 h-3 flex-shrink-0" style={{ color: "var(--color-text-disabled)" }} />
          <span className="text-[11px]" style={{ color: item.isCorrected ? "#FF9500" : "var(--color-text-disabled)" }}>
            {displayTime() as React.ReactNode}
          </span>
          {item.isCorrected && (
            <span className="text-[11px] font-medium" style={{ color: "#FF9500" }}>已校准</span>
          )}
        </div>
        {/* 备注预览（历史日期） */}
        {isPastDate && item.note && (
          <p className="text-[11px] truncate mt-0.5" style={{ color: "var(--color-text-disabled)" }}>
            {item.note}
          </p>
        )}
      </div>

      {/* 操作按钮 */}
      <div className="flex items-center gap-0.5 flex-shrink-0">
        <button
          onClick={(e) => { e.stopPropagation(); onCalibrate(); }}
          className="w-6 h-6 rounded-full flex items-center justify-center active:opacity-70"
          aria-label="校准时间"
        >
          <Target className="w-3.5 h-3.5" style={{ color: "var(--color-text-disabled)" }} />
        </button>
        {isHistoryUncompleted && (
          <button
            onClick={(e) => { e.stopPropagation(); onNote(); }}
            className="w-6 h-6 rounded-full flex items-center justify-center active:opacity-70"
            aria-label="备注"
          >
            <Pencil className="w-3.5 h-3.5" style={{ color: "#FF3B30" }} />
          </button>
        )}
        <button
          onClick={(e) => { e.stopPropagation(); onExpandToggle(); }}
          className="w-6 h-6 rounded-full flex items-center justify-center active:opacity-70"
          aria-label="更多操作"
        >
          <Ellipsis className="w-3.5 h-3.5" style={{ color: expanded ? "var(--lifeflow-primary)" : "var(--color-text-disabled)" }} />
        </button>
      </div>
    </motion.div>
    {/* 操作栏 */}
    <AnimatePresence>
      {expanded && (
        <motion.div
          initial={{ height: 0, opacity: 0 }}
          animate={{ height: "auto", opacity: 1 }}
          exit={{ height: 0, opacity: 0 }}
          transition={{ duration: 0.2 }}
          className="flex items-center gap-1.5 px-2 pb-2 overflow-hidden"
        >
          <ActionButton icon={<Wallet className="w-3.5 h-3.5" />} label="记账" onClick={onAccounting} color="var(--lifeflow-primary)" />
          <ActionButton icon={<Droplets className="w-3.5 h-3.5" />} label="饮水" onClick={onWater} color="#0EA5E9" />
          <ActionButton icon={<Timer className="w-3.5 h-3.5" />} label="专注" onClick={onFocus} color="#FF9500" />
          <ActionButton icon={<StickyNote className="w-3.5 h-3.5" />} label="备忘" onClick={onNote} color="#8B5CF6" />
        </motion.div>
      )}
    </AnimatePresence>
  </>
  );
}

/** 操作栏小按钮 */
function ActionButton({ icon, label, onClick, color }: { icon: React.ReactNode; label: string; onClick: () => void; color: string }) {
  return (
    <button
      onClick={(e) => { e.stopPropagation(); onClick(); }}
      className="flex items-center gap-1 px-2 py-1.5 rounded-lg text-[11px] font-medium active:scale-95 transition-transform"
      style={{ background: `${color}12`, color, border: `1px solid ${color}20` }}
    >
      {icon}
      {label}
    </button>
  );
}
