"use client";

import { useState, useEffect, useCallback, useMemo, useRef } from "react";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence, type PanInfo } from "framer-motion";
import {
  ChevronLeft, ChevronRight, Plus, Check, Trash2, Clock, CalendarDays,
  AlertCircle, RefreshCw, TrendingUp,
} from "lucide-react";
import { useEfficiencyStore } from "@/lib/store/efficiencyStore";
import type { ScheduleTask } from "@/lib/db/efficiency.db";
import { getScheduleTasksByDate } from "@/lib/db/efficiency.db";
import { showToast } from "@/components/ui/Toast";
import {
  CreateTaskSheet,
} from "@/components/efficiency/CreateTaskSheet";

// ============================================================
// 设计令牌（Apple 简约风）
// ============================================================
const ACCENT = "#6366F1";
const MUTED = "#86868B";
const BORDER = "#EBEBEB";
const STRONG = "#C7C7CC";

// ── 周一起始 ──
const WEEK_DAYS = ["一", "二", "三", "四", "五", "六", "日"];

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
/** 获取周一 */
function getWeekMonday(baseDate: Date, weekOffset: number): Date {
  const dow = baseDate.getDay();
  const mondayOffset = dow === 0 ? -6 : 1 - dow;
  return addDays(addDays(baseDate, mondayOffset), weekOffset * 7);
}

// ============================================================
// 主组件
// ============================================================
export default function SchedulePage() {
  const router = useRouter();
  const scheduleTasks = useEfficiencyStore((s) => s.scheduleTasks);
  const selectedDate = useEfficiencyStore((s) => s.selectedDate);
  const storeLoading = useEfficiencyStore((s) => s.loading);
  const loadScheduleTasks = useEfficiencyStore((s) => s.loadScheduleTasks);
  const addScheduleTask = useEfficiencyStore((s) => s.addScheduleTask);
  const toggleScheduleTask = useEfficiencyStore((s) => s.toggleScheduleTask);
  const removeScheduleTask = useEfficiencyStore((s) => s.removeScheduleTask);
  const setSelectedDate = useEfficiencyStore((s) => s.setSelectedDate);

  const today = useMemo(() => new Date(), []);
  const todayStr = useMemo(() => toDateStr(today), [today]);

  const [weekOffset, setWeekOffset] = useState(0);
  const [sheetOpen, setSheetOpen] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<string | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  // 长按删除
  const pressTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const startLongPress = useCallback((taskId: string) => {
    if (pressTimer.current) clearTimeout(pressTimer.current);
    pressTimer.current = setTimeout(() => setDeleteTarget(taskId), 500);
  }, []);
  const cancelLongPress = useCallback(() => {
    if (pressTimer.current) clearTimeout(pressTimer.current);
  }, []);

  // ─── 周日历（周一起始）───
  const weekDates = useMemo(
    () => WEEK_DAYS.map((_, i) => addDays(getWeekMonday(today, weekOffset), i)),
    [today, weekOffset],
  );

  useEffect(() => { loadScheduleTasks(selectedDate); }, [selectedDate, loadScheduleTasks]);

  const sortedTasks = useMemo(() => {
    const copy = [...scheduleTasks];
    copy.sort((a, b) => {
      if (a.isCompleted !== b.isCompleted) return a.isCompleted ? 1 : -1;
      if (a.isImportant !== b.isImportant) return a.isImportant ? -1 : 1;
      return a.createdAt - b.createdAt;
    });
    return copy;
  }, [scheduleTasks]);

  const isToday = selectedDate === todayStr;

  // ── 「即将到来」数据 ──
  const [upcomingTasks, setUpcomingTasks] = useState<ScheduleTask[]>([]);
  const [upcomingDate, setUpcomingDate] = useState<string | null>(null);

  const refreshUpcoming = useCallback(async (fromDate: string) => {
    for (let i = 1; i <= 7; i++) {
      const d = addDays(new Date(fromDate + "T00:00:00"), i);
      const ds = toDateStr(d);
      const tasks = await getScheduleTasksByDate(ds);
      if (tasks.length > 0) {
        tasks.sort((a, b) => {
          if (a.isCompleted !== b.isCompleted) return a.isCompleted ? 1 : -1;
          if (a.isImportant !== b.isImportant) return a.isImportant ? -1 : 1;
          return a.createdAt - b.createdAt;
        });
        setUpcomingTasks(tasks.slice(0, 3));
        setUpcomingDate(ds);
        return;
      }
    }
    setUpcomingTasks([]);
    setUpcomingDate(null);
  }, []);

  useEffect(() => {
    refreshUpcoming(selectedDate);
  }, [selectedDate, refreshUpcoming, scheduleTasks]);

  // ─── 交互 ───
  const handleSelectDay = useCallback((d: Date) => {
    setSelectedDate(toDateStr(d));
  }, [setSelectedDate]);

  const goToday = useCallback(() => {
    setWeekOffset(0);
    setSelectedDate(todayStr);
  }, [setSelectedDate, todayStr]);

  const handleDragEnd = useCallback((_: unknown, info: PanInfo) => {
    if (info.offset.x < -60) setWeekOffset((w) => w + 1);
    else if (info.offset.x > 60) setWeekOffset((w) => w - 1);
  }, []);

  const handleToggle = useCallback(async (taskId: string) => {
    await toggleScheduleTask(taskId);
  }, [toggleScheduleTask]);

  const handleDelete = useCallback(async (taskId: string) => {
    setIsDeleting(true);
    try {
      await removeScheduleTask(taskId);
      setDeleteTarget(null);
      showToast({ type: "success", message: "任务已删除" });
    } catch {
      showToast({ type: "error", message: "删除失败" });
    } finally { setIsDeleting(false); }
  }, [removeScheduleTask]);

  const selectedDateObj = new Date(selectedDate + "T00:00:00");

  // ─── 渲染 ───
  return (
    <div className="min-h-screen bg-[#FAFAFA]">
      {/* ===== Header ===== */}
      <div className="flex items-center justify-between px-4 h-14">
        <button type="button" onClick={() => router.push("/efficiency")} className="w-8 h-8 -ml-1 flex items-center justify-center">
          <ChevronLeft className="w-6 h-6 text-[#1D1D1F]" />
        </button>
        <span className="text-[18px] font-semibold text-[#1D1D1F] absolute left-1/2 -translate-x-1/2">
          日程
        </span>
        <button type="button" onClick={() => setSheetOpen(true)} className="w-8 h-8 -mr-1 flex items-center justify-center">
          <Plus className="w-6 h-6 text-[#6366F1]" />
        </button>
      </div>

      {/* ===== 周条 ===== */}
      <div className="px-4">
        {/* 星期行 + 周切换 */}
        <div className="relative flex items-center h-7">
          <button onClick={() => setWeekOffset((w) => w - 1)} className="absolute left-0 w-8 h-8 flex items-center justify-center">
            <ChevronLeft className="w-4 h-4 text-[#AEAEB2]" />
          </button>
          <div className="grid grid-cols-7 w-full">
            {WEEK_DAYS.map((w) => (
              <div key={w} className="flex items-center justify-center">
                <span className="text-[13px] text-[#86868B]">{w}</span>
              </div>
            ))}
          </div>
          <button onClick={() => setWeekOffset((w) => w + 1)} className="absolute right-0 w-8 h-8 flex items-center justify-center">
            <ChevronRight className="w-4 h-4 text-[#AEAEB2]" />
          </button>
        </div>

        {/* 日期行 */}
        <motion.div
          className="grid grid-cols-7 h-[52px] cursor-grab active:cursor-grabbing"
          drag="x" dragConstraints={{ left: 0, right: 0 }} dragElastic={0.2} onDragEnd={handleDragEnd}
        >
          {weekDates.map((d) => {
            const ds = toDateStr(d);
            const isSel = ds === selectedDate;
            const isTdy = ds === todayStr;
            return (
              <div key={ds} className="flex items-center justify-center">
                <button
                  type="button" onClick={() => handleSelectDay(d)}
                  className="flex items-center justify-center"
                >
                  {isSel ? (
                    <span className="relative w-9 h-9 flex items-center justify-center">
                      <span className="absolute w-9 h-9 rounded-full bg-[#EEF2FF]" />
                      <span className="absolute w-7 h-7 rounded-full bg-[#6366F1] flex items-center justify-center">
                        <span className="text-[17px] font-medium text-white">{d.getDate()}</span>
                      </span>
                    </span>
                  ) : (
                    <span className="w-9 h-9 flex items-center justify-center">
                      <span className={`text-[17px] font-medium ${isTdy ? "text-[#6366F1]" : "text-[#1D1D1F]"}`}>
                        {d.getDate()}
                      </span>
                    </span>
                  )}
                </button>
              </div>
            );
          })}
        </motion.div>
      </div>

      {/* ===== 日期标题行 ===== */}
      <div className="flex items-center justify-between px-4 mt-5">
        <span className="text-[16px] font-bold text-[#1D1D1F]">
          {selectedDateObj.getMonth() + 1}月{selectedDateObj.getDate()}日 周{WEEK_DAYS[selectedDateObj.getDay() === 0 ? 6 : selectedDateObj.getDay() - 1]}
        </span>
        {(weekOffset !== 0 || !isToday) && (
          <button type="button" onClick={goToday} className="text-[13px] text-[#6366F1]">
            回到今天
          </button>
        )}
      </div>

      {/* ===== 当日任务卡 ===== */}
      <div className="mx-4 mt-3 bg-white rounded-2xl border border-[#F0F0F0] overflow-hidden">
        {storeLoading ? (
          <div className="p-4 space-y-3 animate-pulse">
            {[1, 2].map((i) => (
              <div key={i} className="flex items-center gap-3 min-h-[54px]">
                <div className="w-6 h-6 rounded-full bg-[#F5F5F5] flex-shrink-0" />
                <div className="flex-1"><div className="h-5 w-3/5 bg-[#F5F5F5] rounded" /></div>
              </div>
            ))}
          </div>
        ) : sortedTasks.length === 0 ? (
          <div className="flex flex-col items-center py-16">
            <CalendarDays className="w-10 h-10 text-[#E5E5E5]" />
            <p className="text-[15px] text-[#86868B] mt-3">
              {isToday ? "今天没有任务" : "这一天没有任务"}
            </p>
          </div>
        ) : (
          sortedTasks.map((task, i) => (
            <motion.div
              key={task.id}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.04, duration: 0.3 }}
              className="relative flex items-center gap-3 px-4 py-2 min-h-[54px]"
              onPointerDown={() => startLongPress(task.id)}
              onPointerUp={cancelLongPress}
              onPointerLeave={cancelLongPress}
              onContextMenu={(e) => { e.preventDefault(); setDeleteTarget(task.id); }}
            >
              {i > 0 && <div className="absolute left-[52px] right-0 top-0" style={{ borderTop: "0.5px solid #EBEBEB" }} />}
              {/* 勾选圆 */}
              <button
                type="button"
                onClick={(e) => { e.stopPropagation(); handleToggle(task.id); }}
                className="w-6 h-6 rounded-full flex-shrink-0 flex items-center justify-center transition-colors"
                style={{
                  border: task.isCompleted ? "none" : "2px solid #C7C7CC",
                  background: task.isCompleted ? ACCENT : "#FFFFFF",
                }}
              >
                {task.isCompleted && <Check className="w-[14px] h-[14px] text-white" strokeWidth={3} />}
              </button>
              {/* 内容 */}
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-1.5">
                  <p
                    className="text-[17px] truncate"
                    style={{
                      color: task.isCompleted ? "#AEAEB2" : "#1D1D1F",
                      textDecoration: task.isCompleted ? "line-through" : "none",
                    }}
                  >
                    {task.title}
                  </p>
                  {task.isImportant && !task.isCompleted && (
                    <span className="w-[6px] h-[6px] rounded-full flex-shrink-0 bg-[#6366F1]" />
                  )}
                </div>
                <div className="flex items-center gap-2 mt-1">
                  {task.plannedTime > 0 && (
                    <span className="inline-flex items-center gap-1 text-[11px] px-1.5 py-0.5 rounded-md bg-[#F5F5F5] text-[#86868B]">
                      <Clock className="w-3 h-3" />{task.plannedTime}分钟
                    </span>
                  )}
                  {task.progressType === "progress" && task.targetValue ? (
                    <span className="inline-flex items-center gap-1 text-[11px] px-1.5 py-0.5 rounded-md bg-[#EEF2FF] text-[#6366F1]">
                      <TrendingUp className="w-3 h-3" />目标 {task.targetValue}{task.targetUnit || ""}
                    </span>
                  ) : null}
                  {task.note && (
                    <p className="text-[13px] text-[#86868B] truncate">{task.note}</p>
                  )}
                </div>
              </div>
            </motion.div>
          ))
        )}
      </div>

      {/* ===== 「即将到来」区 ===== */}
      {upcomingDate && upcomingTasks.length > 0 && (
        <>
          <p className="px-4 mt-6 mb-2 text-[18px] font-semibold text-[#86868B]">即将到来</p>
          <div className="mx-4 bg-white rounded-2xl border border-[#F0F0F0] overflow-hidden">
            <div className="min-h-[44px] flex items-center px-4">
              <span className="text-[13px] text-[#86868B]">
                {(() => {
                  const d = new Date(upcomingDate + "T00:00:00");
                  return `${d.getMonth() + 1}月${d.getDate()}日 周${WEEK_DAYS[d.getDay() === 0 ? 6 : d.getDay() - 1]}`;
                })()}
              </span>
            </div>
            <div className="mx-4 h-0" style={{ borderTop: "0.5px solid #EBEBEB" }} />
            {upcomingTasks.map((task, i) => (
              <motion.div
                key={task.id}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.04, duration: 0.3 }}
                className="flex items-center gap-3 px-4 py-2 min-h-[54px]"
                onPointerDown={() => startLongPress(task.id)}
                onPointerUp={cancelLongPress}
                onPointerLeave={cancelLongPress}
                onContextMenu={(e) => { e.preventDefault(); setDeleteTarget(task.id); }}
              >
                {i > 0 && <div className="absolute left-0 right-0 h-0" />}
                <button
                  type="button"
                  onClick={(e) => { e.stopPropagation(); handleToggle(task.id); }}
                  className="w-6 h-6 rounded-full flex-shrink-0 flex items-center justify-center"
                  style={{
                    border: task.isCompleted ? "none" : "2px solid #C7C7CC",
                    background: task.isCompleted ? ACCENT : "#FFFFFF",
                  }}
                >
                  {task.isCompleted && <Check className="w-[14px] h-[14px] text-white" strokeWidth={3} />}
                </button>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-1.5">
                    <p className="text-[17px] truncate text-[#1D1D1F]">{task.title}</p>
                    {task.isImportant && (
                      <span className="w-[6px] h-[6px] rounded-full flex-shrink-0 bg-[#6366F1]" />
                    )}
                  </div>
                  <div className="flex items-center gap-2 mt-1">
                    {task.plannedTime > 0 && (
                      <span className="inline-flex items-center gap-1 text-[11px] px-1.5 py-0.5 rounded-md bg-[#F5F5F5] text-[#86868B]">
                        <Clock className="w-3 h-3" />{task.plannedTime}分钟
                      </span>
                    )}
                    {task.note && <p className="text-[13px] text-[#86868B] truncate">{task.note}</p>}
                  </div>
                </div>
              </motion.div>
            ))}
          </div>
        </>
      )}

      {/* ===== 删除确认弹窗 ===== */}
      <AnimatePresence>
        {deleteTarget && (
          <motion.div
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/40"
            onClick={() => setDeleteTarget(null)}
          >
            <motion.div
              initial={{ scale: 0.92, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.92, opacity: 0 }}
              onClick={(e) => e.stopPropagation()}
              className="bg-white w-[300px] p-6 rounded-2xl shadow-xl"
            >
              <div className="flex flex-col items-center text-center">
                <div className="w-12 h-12 rounded-full bg-red-50 flex items-center justify-center mb-3">
                  <AlertCircle className="w-6 h-6 text-red-400" />
                </div>
                <h3 className="text-[17px] font-semibold text-[#1D1D1F] mb-1">确认删除</h3>
                <p className="text-[13px] text-[#86868B] mb-5">删除后将无法恢复，确定要删除这个任务吗？</p>
                <div className="flex gap-3 w-full">
                  <button
                    onClick={() => setDeleteTarget(null)}
                    className="flex-1 h-9 rounded-[10px] border text-[15px] font-medium"
                    style={{ borderColor: BORDER, color: MUTED }}
                  >取消</button>
                  <button
                    onClick={() => handleDelete(deleteTarget)}
                    disabled={isDeleting}
                    className="flex-1 h-9 rounded-[10px] bg-[#FF3B30] text-[15px] font-medium text-white flex items-center justify-center gap-1.5 disabled:opacity-60"
                  >{isDeleting ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}删除</button>
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ===== 创建任务 Sheet ===== */}
      <CreateTaskSheet
        open={sheetOpen}
        selectedDate={selectedDate}
        onClose={() => setSheetOpen(false)}
        onSubmit={async (task) => {
          await addScheduleTask(task);
          showToast({ type: "success", message: "任务已保存" });
        }}
      />
    </div>
  );
}
