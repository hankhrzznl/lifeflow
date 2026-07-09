"use client";

import { useState, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  CalendarDays, Clock, Plus, Pencil, Trash2,
  X, CheckCircle, Circle, ChevronLeft,
} from "lucide-react";
import {
  getAllTemplates, createTemplate, updateTemplate, deleteTemplate,
  getEventsByTemplate, createScheduleEvent, deleteEventsByTemplate,
  ensureDefaultTemplate, getAllDaySchedules,
} from "@/lib/db";
import TodayTimeline from "@/components/schedule/TodayTimeline";
import type { ScheduleTemplate, ScheduleEvent, DaySchedule, DayScheduleEvent, DateRange } from "@/lib/types";
import { showToast } from "@/components/ui/Toast";

// ==================== 工具 ====================

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

// ==================== 模板列表 ====================

function TemplateList({
  templates,
  onEdit,
  onDelete,
  onCreate,
  loading,
}: {
  templates: ScheduleTemplate[];
  onEdit: (t: ScheduleTemplate) => void;
  onDelete: (id: number) => void;
  onCreate: () => void;
  loading: boolean;
}) {
  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <p className="text-sm text-gray-500">设计标准日模板，在有效期内自动应用</p>
        <motion.button whileTap={{ scale: 0.95 }} onClick={onCreate}
          className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-gray-900 text-white text-sm font-medium hover:bg-gray-800 transition-colors">
          <Plus className="w-4 h-4" />新建模板
        </motion.button>
      </div>

      {loading ? (
        <div className="space-y-3">
          {[1, 2].map((i) => <div key={i} className="skeleton h-20 rounded-2xl" />)}
        </div>
      ) : templates.length === 0 ? (
        <div className="text-center py-16">
          <CalendarDays className="w-10 h-10 text-gray-300 mx-auto mb-3" strokeWidth={1.5} />
          <p className="text-sm text-gray-500">暂无模板，点击上方新建</p>
        </div>
      ) : (
        <div className="space-y-2">
          {templates.map((t) => (
            <div key={t.id}
              className="bg-white border border-gray-100 rounded-2xl p-4 shadow-sm flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-indigo-100 flex items-center justify-center flex-shrink-0">
                <CalendarDays className="w-5 h-5 text-indigo-600" strokeWidth={1.5} />
              </div>
              <div className="flex-1 min-w-0">
                <h4 className="text-sm font-semibold text-gray-900">{t.name}</h4>
                <p className="text-xs text-gray-400 mt-0.5">{getRangeLabel(t.dateRanges)}</p>
              </div>
              <button onClick={() => onEdit(t)}
                className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-gray-100">
                <Pencil className="w-4 h-4 text-gray-400" />
              </button>
              <button onClick={() => onDelete(t.id!)}
                className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-red-50">
                <Trash2 className="w-4 h-4 text-red-400" />
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ==================== 模板编辑 Modal ====================

function TemplateModal({
  open,
  template,
  onClose,
  onSave,
}: {
  open: boolean;
  template: ScheduleTemplate | null;
  onClose: () => void;
  onSave: () => void;
}) {
  const [name, setName] = useState("");
  const [dateRanges, setDateRanges] = useState<DateRange[]>([]);
  const [events, setEvents] = useState<ScheduleEvent[]>([]);
  const [eventTitle, setEventTitle] = useState("");
  const [eventStart, setEventStart] = useState("08:00");
  const [eventEnd, setEventEnd] = useState("10:00");
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open) return;
    if (template) {
      setName(template.name);
      setDateRanges(template.dateRanges.length > 0 ? template.dateRanges : [{ from: "", to: "" }]);
      setLoading(true);
      getEventsByTemplate(template.id!).then((list) => {
        setEvents(list);
        setLoading(false);
      });
    } else {
      setName("");
      setDateRanges([{ from: "", to: "" }]);
      setEvents([]);
    }
  }, [open, template]);

  const handleSaveTemplate = async () => {
    if (!name.trim()) return;
    setSaving(true);
    try {
      const ranges = dateRanges.filter((r) => r.from && r.to);
      if (ranges.length === 0) {
        showToast({ message: "请至少设置一个有效的日期段", type: "warning" });
        setSaving(false);
        return;
      }
      if (template?.id) {
        await updateTemplate(template.id, { name: name.trim(), dateRanges: ranges });
        await deleteEventsByTemplate(template.id);
        for (let i = 0; i < events.length; i++) {
          const { id, templateId: _, createdAt, updatedAt, ...rest } = events[i] as any;
          await createScheduleEvent({ templateId: template.id, ...rest, order: i });
        }
      } else {
        const newId = await createTemplate({ name: name.trim(), dateRanges: ranges });
        for (let i = 0; i < events.length; i++) {
          await createScheduleEvent({ templateId: newId, title: events[i].title, startTime: events[i].startTime, endTime: events[i].endTime, note: events[i].note, order: i });
        }
      }
      showToast({ message: "模板已保存", type: "success" });
      onSave();
      onClose();
    } catch (err) {
      console.error(err);
      showToast({ message: "保存失败", type: "error" });
    } finally {
      setSaving(false);
    }
  };

  const addEvent = () => {
    if (!eventTitle.trim()) return;
    setEvents((prev) => [...prev, {
      templateId: template?.id ?? 0,
      title: eventTitle.trim(),
      startTime: eventStart,
      endTime: eventEnd,
      order: prev.length,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    }]);
    setEventTitle("");
  };

  const removeEvent = (idx: number) => {
    setEvents((prev) => prev.filter((_, i) => i !== idx));
  };

  return (
    <AnimatePresence>
      {open && (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
          className="fixed inset-0 z-50 flex items-start justify-center bg-black/40 pt-[6vh] px-4 overflow-y-auto"
          onClick={onClose}>
          <motion.div initial={{ scale: 0.95, opacity: 0, y: 20 }} animate={{ scale: 1, opacity: 1, y: 0 }} exit={{ scale: 0.95, opacity: 0, y: 20 }}
            onClick={(e) => e.stopPropagation()}
            className="bg-white rounded-3xl p-6 max-w-lg w-full shadow-xl max-h-[85vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-5">
              <h2 className="text-lg font-bold text-gray-900">
                {template ? "编辑模板" : "新建模板"}
              </h2>
              <button onClick={onClose} className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-gray-100">
                <X className="w-5 h-5 text-gray-400" />
              </button>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">模板名称</label>
                <input value={name} onChange={(e) => setName(e.target.value)}
                  placeholder="例：暑假计划"
                  className="w-full px-4 py-2.5 rounded-xl bg-gray-50 border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">生效日期</label>
                <div className="space-y-2 mb-2">
                  {dateRanges.map((range, i) => (
                    <div key={i} className="flex items-center gap-2">
                      <input type="date" value={range.from}
                        onChange={(e) => { const next = [...dateRanges]; next[i] = { ...next[i], from: e.target.value }; setDateRanges(next); }}
                        className="flex-1 px-3 py-2 rounded-xl bg-gray-50 border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500" />
                      <span className="text-gray-400 text-sm">—</span>
                      <input type="date" value={range.to}
                        onChange={(e) => { const next = [...dateRanges]; next[i] = { ...next[i], to: e.target.value }; setDateRanges(next); }}
                        className="flex-1 px-3 py-2 rounded-xl bg-gray-50 border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500" />
                      {dateRanges.length > 1 && (
                        <button onClick={() => setDateRanges((prev) => prev.filter((_, j) => j !== i))}
                          className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-red-50 flex-shrink-0">
                          <X className="w-4 h-4 text-red-400" />
                        </button>
                      )}
                    </div>
                  ))}
                </div>
                <button onClick={() => setDateRanges((prev) => [...prev, { from: "", to: "" }])}
                  className="flex items-center gap-1.5 text-xs font-medium text-indigo-600 hover:text-indigo-700 transition-colors">
                  <Plus className="w-3.5 h-3.5" />添加日期段
                </button>
              </div>

              {/* 事件设计 */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">时间块设计（24小时模板）</label>
                {loading ? (
                  <div className="skeleton h-20 rounded-xl" />
                ) : (
                  <div className="space-y-2 mb-3 max-h-48 overflow-y-auto">
                    {events.map((ev, i) => (
                      <div key={i} className="flex items-center gap-2 bg-gray-50 rounded-xl p-2.5 text-sm">
                        <span className="text-xs font-mono text-gray-500 w-20 flex-shrink-0">{ev.startTime}-{ev.endTime}</span>
                        <span className="flex-1 text-gray-900 truncate">{ev.title}</span>
                        <button onClick={() => removeEvent(i)}
                          className="w-6 h-6 flex items-center justify-center rounded hover:bg-red-50 flex-shrink-0">
                          <X className="w-3.5 h-3.5 text-red-400" />
                        </button>
                      </div>
                    ))}
                    {events.length === 0 && (
                      <p className="text-xs text-gray-400 text-center py-3">暂无事件，在下方添加</p>
                    )}
                  </div>
                )}

                <div className="flex items-center gap-2">
                  <input value={eventTitle} onChange={(e) => setEventTitle(e.target.value)}
                    placeholder="事件名称" className="flex-1 px-3 py-2 rounded-xl bg-gray-50 border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500" />
                  <input type="time" value={eventStart} onChange={(e) => setEventStart(e.target.value)}
                    className="w-24 px-2 py-2 rounded-xl bg-gray-50 border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500" />
                  <input type="time" value={eventEnd} onChange={(e) => setEventEnd(e.target.value)}
                    className="w-24 px-2 py-2 rounded-xl bg-gray-50 border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500" />
                  <motion.button whileTap={{ scale: 0.9 }} onClick={addEvent}
                    className="w-9 h-9 flex items-center justify-center rounded-xl bg-indigo-600 text-white flex-shrink-0">
                    <Plus className="w-4 h-4" />
                  </motion.button>
                </div>
              </div>
            </div>

            <div className="flex gap-3 mt-6">
              <button onClick={onClose}
                className="flex-1 py-2.5 rounded-xl border border-gray-200 text-gray-600 text-sm font-medium hover:bg-gray-50">取消</button>
              <motion.button whileTap={{ scale: 0.97 }} onClick={handleSaveTemplate} disabled={saving}
                className="flex-1 py-2.5 rounded-xl bg-gray-900 text-white text-sm font-medium hover:bg-gray-800 disabled:opacity-50">
                {saving ? "保存中..." : "保存模板"}
              </motion.button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

// ==================== 历史记录视图 ====================

function HistoryView() {
  const [schedules, setSchedules] = useState<DaySchedule[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const list = await getAllDaySchedules();
      setSchedules(list);
    } catch (err) {
      console.error("Failed to load history:", err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  if (loading) {
    return <div className="space-y-2">{[1,2,3,4].map((i) => <div key={i} className="skeleton h-16 rounded-2xl" />)}</div>;
  }

  if (schedules.length === 0) {
    return (
      <div className="text-center py-16">
        <Clock className="w-10 h-10 text-gray-300 mx-auto mb-3" strokeWidth={1.5} />
        <p className="text-sm text-gray-500">暂无历史记录</p>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {schedules.map((ds) => {
        const completed = ds.events.filter((e) => e.completed).length;
        return (
          <div key={ds.id} className="bg-white border border-gray-100 rounded-2xl p-4 shadow-sm">
            <div className="flex items-center justify-between mb-2">
              <h4 className="text-sm font-semibold text-gray-900">{formatDateFull(ds.date)}</h4>
              <span className="text-xs text-gray-400">
                {completed}/{ds.events.length} 完成
              </span>
            </div>
            <div className="space-y-1">
              {ds.events.slice(0, 5).map((ev, i) => (
                <div key={i} className="flex items-center gap-2 text-xs">
                  <span className={ev.completed ? "text-emerald-500" : "text-gray-300"}>
                    {ev.completed ? <CheckCircle className="w-3.5 h-3.5" /> : <Circle className="w-3.5 h-3.5" />}
                  </span>
                  <span className="text-gray-500 w-20 flex-shrink-0">{ev.startTime}-{ev.endTime}</span>
                  <span className={ev.completed ? "text-gray-400 line-through" : "text-gray-700"}>{ev.title}</span>
                  {ev.actualStartTime && (
                    <span className="text-amber-500 ml-auto">实际 {ev.actualStartTime}-{ev.actualEndTime}</span>
                  )}
                </div>
              ))}
              {ds.events.length > 5 && (
                <p className="text-xs text-gray-400 pl-6">...还有 {ds.events.length - 5} 项</p>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ==================== 主页面 ====================

export default function SchedulePage() {
  const [view, setView] = useState<"today" | "history" | "templates">("today");
  const [templates, setTemplates] = useState<ScheduleTemplate[]>([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [editTemplate, setEditTemplate] = useState<ScheduleTemplate | null>(null);

  const loadTemplates = useCallback(async () => {
    setLoading(true);
    try {
      await ensureDefaultTemplate();
      const list = await getAllTemplates();
      setTemplates(list);
    } catch (err) {
      console.error("Failed to load templates:", err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadTemplates(); }, [loadTemplates]);

  const handleDelete = async (id: number) => {
    if (!confirm("确定删除该模板？相关日程记录也会被删除。")) return;
    await deleteTemplate(id);
    await loadTemplates();
    showToast({ message: "模板已删除", type: "success" });
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-50 to-white dark:from-gray-950 dark:to-gray-900 text-slate-900 dark:text-white">
      <div className="mx-auto max-w-5xl w-full px-5 pt-8 pb-24 md:px-8 md:pt-10">
        {/* 顶部标题行 + 入口 */}
        <div className="flex items-center justify-between mb-1">
          <div className="flex items-center gap-2">
            {view !== "today" && (
              <button onClick={() => setView("today")}
                className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-gray-100 transition-colors">
                <ChevronLeft className="w-5 h-5 text-gray-400" />
              </button>
            )}
            <h1 className="text-xl font-bold text-gray-900">
              {view === "history" ? "历史记录" : view === "templates" ? "模板管理" : "日程"}
            </h1>
          </div>
          {view === "today" && (
            <div className="flex items-center gap-1">
              <button onClick={() => setView("history")}
                className="px-3 py-1.5 text-xs font-medium text-gray-500 hover:text-gray-900 hover:bg-gray-100 rounded-lg transition-colors">
                历史
              </button>
              <button onClick={() => setView("templates")}
                className="px-3 py-1.5 text-xs font-medium text-gray-500 hover:text-gray-900 hover:bg-gray-100 rounded-lg transition-colors">
                模板
              </button>
            </div>
          )}
        </div>
        {view === "today" && (
          <p className="text-sm text-gray-500 mb-4">标准日模板 · 每日时间线</p>
        )}

        {view === "templates" ? (
          <div className="mt-4">
            <TemplateList
              templates={templates}
              loading={loading}
              onEdit={(t) => { setEditTemplate(t); setModalOpen(true); }}
              onDelete={handleDelete}
              onCreate={() => { setEditTemplate(null); setModalOpen(true); }}
            />
          </div>
        ) : view === "history" ? (
          <div className="mt-4">
            <HistoryView />
          </div>
        ) : (
          <TodayTimeline />
        )}
      </div>

      <TemplateModal
        open={modalOpen}
        template={editTemplate}
        onClose={() => setModalOpen(false)}
        onSave={loadTemplates}
      />
    </div>
  );
}
