"use client";

import { useState, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  ChevronLeft, ChevronRight, AlertCircle, Clock, CheckCircle, Circle, Target,
} from "lucide-react";
import {
  ensureDefaultTemplate, generateDaySchedule, updateDaySchedule, getAllTemplates,
} from "@/lib/db";
import type { ScheduleTemplate, DaySchedule, DayScheduleEvent, DateRange } from "@/lib/types";
import { showToast } from "@/components/ui/Toast";

// ==================== 工具 ====================

function getTodayStr(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function formatDateCN(date: string): string {
  const d = new Date(date + "T00:00:00");
  return `${d.getMonth() + 1}月${d.getDate()}日`;
}

function formatDateFull(date: string): string {
  const d = new Date(date + "T00:00:00");
  const weekdays = ["周日", "周一", "周二", "周三", "周四", "周五", "周六"];
  return `${d.getMonth() + 1}月${d.getDate()}日 ${weekdays[d.getDay()]}`;
}

function formatRange(range: DateRange): string {
  if (range.from === range.to) return formatDateCN(range.from);
  return `${formatDateCN(range.from)} - ${formatDateCN(range.to)}`;
}

function getRangeLabel(ranges: DateRange[]): string {
  if (ranges.length === 0) return "未设置";
  if (ranges.length === 1) return formatRange(ranges[0]);
  return `${formatRange(ranges[0])} 等${ranges.length}段`;
}

function shiftDate(dateStr: string, days: number): string {
  const d = new Date(dateStr + "T00:00:00");
  d.setDate(d.getDate() + days);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

const HOURS = Array.from({ length: 24 }, (_, i) => i);

// ==================== 校准弹窗 ====================

function CalibrateModal({
  open,
  event,
  onClose,
  onSave,
}: {
  open: boolean;
  event: DayScheduleEvent;
  onClose: () => void;
  onSave: (actualStart: string, actualEnd: string) => void;
}) {
  const [actualStart, setActualStart] = useState(event.actualStartTime || event.startTime);
  const [actualEnd, setActualEnd] = useState(event.actualEndTime || event.endTime);

  useEffect(() => {
    if (open) {
      setActualStart(event.actualStartTime || event.startTime);
      setActualEnd(event.actualEndTime || event.endTime);
    }
  }, [open, event]);

  return (
    <AnimatePresence>
      {open && (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-6"
          onClick={onClose}>
          <motion.div initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.9, opacity: 0 }}
            onClick={(e) => e.stopPropagation()}
            className="bg-white rounded-3xl p-6 max-w-sm w-full shadow-xl">
            <h3 className="text-lg font-bold text-gray-900 mb-1">校准时间</h3>
            <p className="text-sm text-gray-500 mb-4">
              计划：{event.startTime} — {event.endTime}
            </p>
            <div className="space-y-3">
              <div>
                <label className="block text-xs text-gray-500 mb-1">实际开始</label>
                <input type="time" value={actualStart} onChange={(e) => setActualStart(e.target.value)}
                  className="w-full px-4 py-2.5 rounded-xl bg-gray-50 border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500" />
              </div>
              <div>
                <label className="block text-xs text-gray-500 mb-1">实际结束</label>
                <input type="time" value={actualEnd} onChange={(e) => setActualEnd(e.target.value)}
                  className="w-full px-4 py-2.5 rounded-xl bg-gray-50 border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500" />
              </div>
            </div>
            <div className="flex gap-3 mt-5">
              <button onClick={onClose}
                className="flex-1 py-2.5 rounded-xl border border-gray-200 text-gray-600 text-sm font-medium hover:bg-gray-50">取消</button>
              <motion.button whileTap={{ scale: 0.97 }} onClick={() => onSave(actualStart, actualEnd)}
                className="flex-1 py-2.5 rounded-xl bg-indigo-600 text-white text-sm font-medium hover:bg-indigo-700">
                保存
              </motion.button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

// ==================== 今日日程视图 ====================

export default function TodayTimeline() {
  const [date, setDate] = useState(getTodayStr());
  const [schedule, setSchedule] = useState<DaySchedule | null>(null);
  const [loading, setLoading] = useState(true);
  const [template, setTemplate] = useState<ScheduleTemplate | null>(null);
  const [noTemplate, setNoTemplate] = useState(false);
  const [isLastDay, setIsLastDay] = useState(false);
  const [calibrateTarget, setCalibrateTarget] = useState<DayScheduleEvent | null>(null);
  const [calibrateIdx, setCalibrateIdx] = useState(-1);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      await ensureDefaultTemplate();
      const ds = await generateDaySchedule(date);
      setSchedule(ds);
      if (ds) {
        const tmpl = await import("@/lib/db").then((m) =>
          m.getAllTemplates().then((list) => list.find((t) => t.id === ds.templateId) ?? null)
        );
        setTemplate(tmpl);
        if (tmpl) {
          for (const range of tmpl.dateRanges) {
            if (range.to === date) { setIsLastDay(true); break; }
          }
        }
      } else {
        setNoTemplate(true);
      }
    } catch (err) {
      console.error("Failed to load schedule:", err);
    } finally {
      setLoading(false);
    }
  }, [date]);

  useEffect(() => { load(); }, [load]);

  const handleToggle = async (idx: number) => {
    if (!schedule) return;
    const newEvents = [...schedule.events];
    newEvents[idx] = { ...newEvents[idx], completed: !newEvents[idx].completed };
    setSchedule({ ...schedule, events: newEvents });
    await updateDaySchedule(schedule.id!, { events: newEvents });
  };

  const handleCalibrate = async (actualStart: string, actualEnd: string) => {
    if (!schedule || calibrateIdx < 0) return;
    const newEvents = [...schedule.events];
    newEvents[calibrateIdx] = { ...newEvents[calibrateIdx], actualStartTime: actualStart, actualEndTime: actualEnd };
    setSchedule({ ...schedule, events: newEvents });
    await updateDaySchedule(schedule.id!, { events: newEvents });
    setCalibrateTarget(null);
    setCalibrateIdx(-1);
    showToast({ message: "时间已校准", type: "success" });
  };

  const eventsByHour: Record<number, DayScheduleEvent[]> = {};
  if (schedule) {
    for (const ev of schedule.events) {
      const startH = parseInt(ev.startTime.split(":")[0]);
      if (!eventsByHour[startH]) eventsByHour[startH] = [];
      eventsByHour[startH].push(ev);
    }
  }

  if (loading) {
    return (
      <div className="space-y-1.5">
        {[1, 2, 3, 4, 5, 6].map((i) => (
          <div key={i} className="skeleton h-14 rounded-xl" />
        ))}
      </div>
    );
  }

  return (
    <div>
      {/* 日期选择器 */}
      <div className="flex items-center justify-between mb-3">
        <button onClick={() => setDate(shiftDate(date, -1))}
          className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-gray-100">
          <ChevronLeft className="w-5 h-5 text-gray-400" />
        </button>
        <div className="text-center">
          <h2 className="text-lg font-bold text-gray-900">{formatDateFull(date)}</h2>
          {date === getTodayStr() && (
            <span className="text-xs text-indigo-500 font-medium">今天</span>
          )}
        </div>
        <button onClick={() => setDate(shiftDate(date, 1))}
          className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-gray-100">
          <ChevronRight className="w-5 h-5 text-gray-400" />
        </button>
      </div>

      {/* 跳回今天 */}
      {date !== getTodayStr() && (
        <button onClick={() => setDate(getTodayStr())}
          className="w-full text-center text-xs text-indigo-500 mb-3 hover:text-indigo-700">
          回到今天
        </button>
      )}

      {noTemplate ? (
        <div className="text-center py-16">
          <AlertCircle className="w-10 h-10 text-gray-300 mx-auto mb-3" strokeWidth={1.5} />
          <p className="text-sm text-gray-500 mb-1">该日期没有生效的模板</p>
          <p className="text-xs text-gray-400">在"模板"标签页中设计并设置日期范围</p>
        </div>
      ) : (
        <>
          {/* 模板信息 + 到期提醒 */}
          {template && (
            <div className="mb-4 p-3 rounded-xl bg-indigo-50 border border-indigo-100">
              <p className="text-xs text-indigo-600 font-medium">
                当前模板：{template.name}
                <span className="text-indigo-400 ml-1">{getRangeLabel(template.dateRanges)}</span>
              </p>
              {isLastDay && (
                <p className="text-xs text-amber-600 mt-1 flex items-center gap-1">
                  <AlertCircle className="w-3 h-3" />今天是模板最后一天，请设置后续模板
                </p>
              )}
            </div>
          )}

          {!schedule || schedule.events.length === 0 ? (
            <div className="text-center py-12">
              <Clock className="w-10 h-10 text-gray-300 mx-auto mb-3" strokeWidth={1.5} />
              <p className="text-sm text-gray-500">当日日程为空</p>
            </div>
          ) : (
            <div className="space-y-1">
              {HOURS.map((hour) => {
                const hourEvents = eventsByHour[hour] || [];
                const hourStr = `${String(hour).padStart(2, "0")}:00`;
                return (
                  <div key={hour} className="flex items-start gap-2 min-h-[52px] py-1">
                    <span className="w-12 text-xs text-gray-400 pt-1 flex-shrink-0 text-right">{hourStr}</span>
                    <div className="flex-1 space-y-1">
                      {hourEvents.length === 0 ? (
                        <div className="h-10 rounded-lg border border-dashed border-gray-150" />
                      ) : (
                        hourEvents.map((ev) => {
                          const idx = schedule.events.indexOf(ev);
                          return (
                            <div key={idx}
                              className={`w-full rounded-xl text-left transition-colors ${
                                ev.completed ? "bg-emerald-50 border border-emerald-100" : "bg-white border border-gray-100"
                              }`}
                            >
                              <div className="flex items-center gap-3 px-3 py-2.5">
                                <motion.button whileTap={{ scale: 0.9 }} onClick={() => handleToggle(idx)}
                                  className="flex-shrink-0">
                                  {ev.completed ? (
                                    <CheckCircle className="w-5 h-5 text-emerald-500" strokeWidth={1.5} />
                                  ) : (
                                    <Circle className="w-5 h-5 text-gray-300" strokeWidth={1.5} />
                                  )}
                                </motion.button>
                                <div className="flex-1 min-w-0">
                                  <div className="flex items-center gap-2">
                                    <span className={`text-sm ${ev.completed ? "line-through text-gray-400" : "font-medium text-gray-900"}`}>
                                      {ev.title}
                                    </span>
                                    <span className="text-xs text-gray-400">{ev.startTime} - {ev.endTime}</span>
                                  </div>
                                  {/* 校准后的实际时间 */}
                                  {ev.actualStartTime && ev.actualEndTime && (
                                    <p className="text-xs text-amber-600 mt-0.5">
                                      实际：{ev.actualStartTime} — {ev.actualEndTime}
                                    </p>
                                  )}
                                </div>
                                {/* 校准按钮 */}
                                <motion.button whileTap={{ scale: 0.9 }}
                                  onClick={() => { setCalibrateTarget(ev); setCalibrateIdx(idx); }}
                                  className="w-7 h-7 flex items-center justify-center rounded-lg hover:bg-amber-50 flex-shrink-0"
                                  title="校准实际时间">
                                  <Target className="w-4 h-4 text-amber-500" strokeWidth={1.5} />
                                </motion.button>
                              </div>
                            </div>
                          );
                        })
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </>
      )}

      {/* 校准弹窗 */}
      {calibrateTarget && (
        <CalibrateModal
          open={!!calibrateTarget}
          event={calibrateTarget}
          onClose={() => { setCalibrateTarget(null); setCalibrateIdx(-1); }}
          onSave={handleCalibrate}
        />
      )}
    </div>
  );
}
