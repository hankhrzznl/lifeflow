"use client";

import { useEffect, useState, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  ArrowRight, FolderKanban, ChevronLeft, ChevronDown,
  CheckCircle, Circle, Layers, Clock,
  CalendarDays, Plus, Pencil, Trash2, X,
} from "lucide-react";
import type { ProjectV2, Board, Section, Task, ScheduleTemplate, ScheduleEvent, DaySchedule, DayScheduleEvent, DateRange } from "@/lib/types";
import {
  getAllProjectsV2, getBoardsByProject, getSectionsByBoard, getTasksBySection,
  getAllTemplates, createTemplate, updateTemplate, deleteTemplate,
  getEventsByTemplate, createScheduleEvent, deleteEventsByTemplate,
  ensureDefaultTemplate, getAllDaySchedules,
} from "@/lib/db";
import { db } from "@/lib/db";
import { showToast } from "@/components/ui/Toast";
import OverviewHeader from "@/components/layout/OverviewHeader";
import QuickCaptureBar from "@/components/layout/QuickCaptureBar";
import CaptureInbox from "@/components/layout/CaptureInbox";
import TodayTimeline from "@/components/schedule/TodayTimeline";
import CharacterFrame from "@/components/CharacterFrame";

// ==================== 工具 ====================

const PROJECT_GRADIENTS = [
  "from-indigo-400 via-violet-400 to-purple-500",
  "from-emerald-400 via-teal-400 to-cyan-500",
  "from-rose-400 via-pink-400 to-fuchsia-500",
  "from-sky-400 via-cyan-400 to-blue-500",
  "from-amber-400 via-orange-400 to-red-500",
  "from-teal-400 via-green-400 to-emerald-500",
  "from-fuchsia-400 via-purple-400 to-violet-500",
  "from-blue-400 via-indigo-400 to-violet-500",
];

const PROJECT_COLORS = [
  "#6366f1", "#10b981", "#f43f5e", "#0ea5e9", "#f59e0b",
  "#14b8a6", "#a855f7", "#3b82f6",
];

function getProjectGradient(index: number): string {
  return PROJECT_GRADIENTS[index % PROJECT_GRADIENTS.length];
}
function getProjectColor(index: number): string {
  return PROJECT_COLORS[index % PROJECT_COLORS.length];
}

// ==================== 日程工具函数 ====================

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
  if (!ranges || ranges.length === 0) return "无日期范围";
  if (ranges.length === 1) return formatRange(ranges[0]);
  return `${formatRange(ranges[0])} 等${ranges.length}段`;
}

// ==================== 项目卡片 ====================

function ProjectCard({
  project, index, boardCount, boardNames, onClick,
}: {
  project: ProjectV2; index: number; boardCount: number; boardNames: string[]; onClick: () => void;
}) {
  const gradient = getProjectGradient(index);
  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.08, duration: 0.4, ease: "easeOut" }}
      onClick={onClick}
      className={`group relative overflow-hidden rounded-3xl bg-gradient-to-br ${gradient} p-6 md:p-7 text-white shadow-lg shadow-slate-200/60 min-h-[200px] md:min-h-[240px] flex flex-col cursor-pointer hover:scale-[1.02] transition-transform`}
    >
      <div className="absolute -top-12 -right-12 w-44 h-44 rounded-full bg-white/15 blur-2xl pointer-events-none" />
      <div className="absolute top-0 right-0 w-32 h-32 bg-gradient-to-bl from-white/20 to-transparent rounded-bl-full pointer-events-none" />
      <div className="relative z-10 flex flex-col h-full">
        <div className="w-12 h-12 md:w-14 md:h-14 rounded-2xl bg-white/25 backdrop-blur-sm flex items-center justify-center mb-5">
          <FolderKanban className="w-6 h-6 md:w-7 md:h-7 text-white" strokeWidth={1.8} />
        </div>
        <h2 className="text-2xl md:text-3xl font-bold mb-1.5">{project.name}</h2>
        <p className="text-white/80 text-sm md:text-base mb-4">
          {boardCount > 0 ? `${boardCount} 个大模块` : "暂无大模块"}
        </p>
        {boardNames.length > 0 && (
          <div className="flex flex-wrap gap-2 mb-5">
            {boardNames.slice(0, 4).map((name) => (
              <span key={name} className="px-3 py-1 rounded-full text-xs font-medium bg-white/20 backdrop-blur-sm border border-white/20">
                {name}
              </span>
            ))}
            {boardNames.length > 4 && (
              <span className="px-3 py-1 rounded-full text-xs font-medium bg-white/20 backdrop-blur-sm border border-white/20">
                +{boardNames.length - 4}
              </span>
            )}
          </div>
        )}
        <div className="mt-auto flex items-center gap-1.5 text-sm font-medium text-white/90">
          <span>点击查看大模块</span>
          <ArrowRight className="w-4 h-4" strokeWidth={2} />
        </div>
      </div>
    </motion.div>
  );
}

// ==================== 大模块列表 ====================

function BoardListView({
  project, boards, onBack, onBoardClick,
}: {
  project: ProjectV2; boards: Board[]; onBack: () => void; onBoardClick: (board: Board) => void;
}) {
  return (
    <div>
      <button onClick={onBack} className="flex items-center gap-2 text-sm text-gray-500 hover:text-gray-700 dark:hover:text-gray-300 transition-colors mb-3">
        <ChevronLeft className="w-4 h-4" />
        <span>返回项目列表</span>
      </button>
      <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-4">{project.name}</h2>
      {boards.length === 0 ? (
        <div className="text-center py-12">
          <FolderKanban className="w-8 h-8 text-gray-300 mx-auto mb-2" strokeWidth={1.5} />
          <p className="text-sm text-gray-400">暂无大模块</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {boards.map((board, i) => (
            <motion.div
              key={board.id}
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.05, duration: 0.35 }}
              onClick={() => onBoardClick(board)}
              className="bg-white dark:bg-gray-900 border border-gray-100 dark:border-gray-800 rounded-2xl p-5 cursor-pointer hover:shadow-md hover:border-indigo-200 dark:hover:border-indigo-800 transition-all"
            >
              <div>
                <h3 className="text-lg font-bold text-gray-900 dark:text-white">{board.name}</h3>
                {board.stages && board.stages.length > 0 && (
                  <p className="text-xs text-gray-400 mt-1">{board.stages.length} 个阶段</p>
                )}
              </div>
            </motion.div>
          ))}
        </div>
      )}
    </div>
  );
}

// ==================== 模块详情（子模块+任务） ====================

function BoardDetailView({
  board, project, projectIndex, onBack,
}: {
  board: Board; project: ProjectV2; projectIndex: number; onBack: () => void;
}) {
  const [sections, setSections] = useState<Section[]>([]);
  const [tasksBySection, setTasksBySection] = useState<Map<number, Task[]>>(new Map());
  const [loading, setLoading] = useState(true);
  const [expandedStages, setExpandedStages] = useState<Set<number>>(new Set());
  const projectColor = getProjectColor(projectIndex);

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      try {
        const secs = await getSectionsByBoard(board.id!);
        setSections(secs);
        const taskMap = new Map<number, Task[]>();
        for (const sec of secs) {
          const tasks = await getTasksBySection(sec.id!);
          tasks.sort((a, b) => {
            if (a.status === "done" && b.status !== "done") return 1;
            if (a.status !== "done" && b.status === "done") return -1;
            return (b.createdAt || 0) - (a.createdAt || 0);
          });
          taskMap.set(sec.id!, tasks);
        }
        setTasksBySection(taskMap);
        const stages = board.stages || [];
        if (stages.length > 0) setExpandedStages(new Set([0]));
      } catch (err) {
        console.error("Failed to load board detail:", err);
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [board.id]);

  const handleToggleTask = useCallback(async (task: Task) => {
    if (!task.id) return;
    const newStatus: Task["status"] = task.status === "done" ? "active" : "done";
    await db.tasks.update(task.id, { status: newStatus, updatedAt: Date.now() });
    showToast({
      message: newStatus === "done" ? "任务已完成" : "任务已恢复",
      type: newStatus === "done" ? "success" : "info",
    });
    setTasksBySection((prev) => {
      const next = new Map(prev);
      for (const [sid, taskList] of next) {
        next.set(sid, taskList.map((t) => (t.id === task.id ? { ...t, status: newStatus } : t)));
      }
      return next;
    });
  }, []);

  const toggleStage = (stageIdx: number) => {
    setExpandedStages((prev) => {
      const next = new Set(prev);
      if (next.has(stageIdx)) next.delete(stageIdx);
      else next.add(stageIdx);
      return next;
    });
  };

  const stages = board.stages || [];
  const hasStages = stages.length > 0;
  let totalTasks = 0;
  for (const taskList of tasksBySection.values()) totalTasks += taskList.length;

  const detailCounts = `${sections.length} 个子模块 · ${totalTasks} 个任务`;

  return (
    <div>
      <button onClick={onBack} className="flex items-center gap-2 text-sm text-gray-500 hover:text-gray-700 dark:hover:text-gray-300 transition-colors mb-4">
        <ChevronLeft className="w-4 h-4" />
        <span>返回大模块列表</span>
      </button>
      <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-1">{board.name}</h2>
      <p className="text-xs text-gray-400 mb-5">{project.name} · {detailCounts}</p>

      {loading ? (
        <div className="space-y-3">
          {[1, 2, 3].map((i) => <div key={i} className="skeleton h-16 rounded-2xl" />)}
        </div>
      ) : hasStages ? (
        <div className="space-y-4">
          {stages.map((stage, stageIdx) => {
            const stageSections = sections.filter((s) => (s.stageIndex ?? 0) === stageIdx);
            const isExpanded = expandedStages.has(stageIdx);
            return (
              <div key={stageIdx} className="rounded-2xl bg-white dark:bg-gray-900 border border-gray-100 dark:border-gray-800 overflow-hidden">
                <button
                  onClick={() => toggleStage(stageIdx)}
                  className="w-full flex items-center gap-3 px-4 py-3 hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors"
                >
                  <ChevronDown className={`w-4 h-4 text-gray-400 flex-shrink-0 transition-transform ${isExpanded ? "" : "-rotate-90"}`} />
                  <div className="w-3 h-3 rounded-full flex-shrink-0" style={{ backgroundColor: projectColor }} />
                  <span className="flex-1 text-sm font-semibold text-gray-900 dark:text-white text-left">{stage.name}</span>
                  <span className="text-xs text-gray-400">{stageSections.length} 子模块</span>
                </button>
                <AnimatePresence>
                  {isExpanded && (
                    <motion.div
                      initial={{ height: 0 }} animate={{ height: "auto" }} exit={{ height: 0 }}
                      className="overflow-hidden"
                    >
                      {stage.achievements.length > 0 && (
                        <div className="px-4 pb-2 space-y-0.5">
                          {stage.achievements.map((ach, ai) => (
                            <div key={ai} className="flex items-center gap-2 pl-8 text-xs text-indigo-500 dark:text-indigo-400">
                              <CheckCircle className="w-3.5 h-3.5 flex-shrink-0" />
                              {ach}
                            </div>
                          ))}
                        </div>
                      )}
                      {stageSections.length === 0 ? (
                        <p className="px-4 pb-3 pl-12 text-xs text-gray-400">暂无子模块</p>
                      ) : (
                        <div className="border-t border-gray-50 dark:border-gray-800">
                          {stageSections.map((section) => {
                            const sectionTasks = tasksBySection.get(section.id!) || [];
                            return (
                              <div key={section.id} className="border-b border-gray-50 dark:border-gray-800 last:border-0">
                                <div className="flex items-center gap-3 px-4 py-2.5 pl-12 bg-gray-50/50 dark:bg-gray-800/30">
                                  <Layers className="w-3.5 h-3.5 text-amber-400 flex-shrink-0" />
                                  <span className="text-xs font-medium text-gray-700 dark:text-gray-300">{section.name}</span>
                                  <span className="text-xs text-gray-400">{sectionTasks.length} 任务</span>
                                </div>
                                {sectionTasks.length > 0 && (
                                  <div className="pb-1">
                                    {sectionTasks.map((task) => (
                                      <motion.button
                                        key={task.id}
                                        whileTap={{ scale: 0.98 }}
                                        onClick={() => handleToggleTask(task)}
                                        className={`w-full flex items-center gap-3 px-4 py-2 pl-16 text-left transition-colors ${
                                          task.status === "done" ? "text-gray-400 dark:text-gray-500" : "hover:bg-gray-50 dark:hover:bg-gray-800/50"
                                        }`}
                                      >
                                        {task.status === "done" ? (
                                          <CheckCircle className="w-4 h-4 text-emerald-500 flex-shrink-0" strokeWidth={1.5} />
                                        ) : (
                                          <Circle className="w-4 h-4 text-gray-300 dark:text-gray-600 flex-shrink-0" strokeWidth={1.5} />
                                        )}
                                        <span className={`flex-1 text-xs ${task.status === "done" ? "line-through" : "text-gray-700 dark:text-gray-300"}`}>
                                          {task.title}
                                        </span>
                                      </motion.button>
                                    ))}
                                  </div>
                                )}
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            );
          })}
        </div>
      ) : (
        <div className="space-y-2">
          {sections.length === 0 ? (
            <p className="text-center text-sm text-gray-400 py-8">暂无子模块和任务</p>
          ) : (
            sections.map((section) => {
              const sectionTasks = tasksBySection.get(section.id!) || [];
              return (
                <div key={section.id} className="rounded-xl bg-white dark:bg-gray-900 border border-gray-100 dark:border-gray-800 overflow-hidden">
                  <div className="flex items-center gap-3 px-4 py-2.5 bg-gray-50/50 dark:bg-gray-800/30">
                    <Layers className="w-3.5 h-3.5 text-amber-400 flex-shrink-0" />
                    <span className="text-xs font-medium text-gray-700 dark:text-gray-300">{section.name}</span>
                    <span className="text-xs text-gray-400">{sectionTasks.length} 任务</span>
                  </div>
                  {sectionTasks.length > 0 && (
                    <div>
                      {sectionTasks.map((task) => (
                        <motion.button
                          key={task.id}
                          whileTap={{ scale: 0.98 }}
                          onClick={() => handleToggleTask(task)}
                          className={`w-full flex items-center gap-3 px-4 py-2 pl-12 text-left transition-colors ${
                            task.status === "done" ? "text-gray-400 dark:text-gray-500" : "hover:bg-gray-50 dark:hover:bg-gray-800/50"
                          }`}
                        >
                          {task.status === "done" ? (
                            <CheckCircle className="w-4 h-4 text-emerald-500 flex-shrink-0" strokeWidth={1.5} />
                          ) : (
                            <Circle className="w-4 h-4 text-gray-300 dark:text-gray-600 flex-shrink-0" strokeWidth={1.5} />
                          )}
                          <span className={`flex-1 text-xs ${task.status === "done" ? "line-through" : "text-gray-700 dark:text-gray-300"}`}>
                            {task.title}
                          </span>
                        </motion.button>
                      ))}
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>
      )}
    </div>
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
          <div key={ds.id} className="bg-white dark:bg-gray-900 border border-gray-100 dark:border-gray-800 rounded-2xl p-4 shadow-sm">
            <div className="flex items-center justify-between mb-2">
              <h4 className="text-sm font-semibold text-gray-900 dark:text-white">{formatDateFull(ds.date)}</h4>
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
                  <span className={ev.completed ? "text-gray-400 line-through" : "text-gray-700 dark:text-gray-300"}>{ev.title}</span>
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

// ==================== 模板列表 ====================

function TemplateList({
  templates, onEdit, onDelete, onCreate, loading,
}: {
  templates: ScheduleTemplate[]; onEdit: (t: ScheduleTemplate) => void;
  onDelete: (id: number) => void; onCreate: () => void; loading: boolean;
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
              className="bg-white dark:bg-gray-900 border border-gray-100 dark:border-gray-800 rounded-2xl p-4 shadow-sm flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-indigo-100 dark:bg-indigo-900/30 flex items-center justify-center flex-shrink-0">
                <CalendarDays className="w-5 h-5 text-indigo-600 dark:text-indigo-400" strokeWidth={1.5} />
              </div>
              <div className="flex-1 min-w-0">
                <h4 className="text-sm font-semibold text-gray-900 dark:text-white">{t.name}</h4>
                <p className="text-xs text-gray-400 mt-0.5">{getRangeLabel(t.dateRanges)}</p>
              </div>
              <button onClick={() => onEdit(t)}
                className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800">
                <Pencil className="w-4 h-4 text-gray-400" />
              </button>
              <button onClick={() => onDelete(t.id!)}
                className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-red-50 dark:hover:bg-red-900/20">
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
  open, template, onClose, onSave,
}: {
  open: boolean; template: ScheduleTemplate | null; onClose: () => void; onSave: () => void;
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
            className="bg-white dark:bg-gray-900 rounded-3xl p-6 max-w-lg w-full shadow-xl max-h-[85vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-5">
              <h2 className="text-lg font-bold text-gray-900 dark:text-white">
                {template ? "编辑模板" : "新建模板"}
              </h2>
              <button onClick={onClose} className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800">
                <X className="w-5 h-5 text-gray-400" />
              </button>
            </div>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">模板名称</label>
                <input value={name} onChange={(e) => setName(e.target.value)}
                  placeholder="例：暑假计划"
                  className="w-full px-4 py-2.5 rounded-xl bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">生效日期</label>
                <div className="space-y-2 mb-2">
                  {dateRanges.map((range, i) => (
                    <div key={i} className="flex items-center gap-2">
                      <input type="date" value={range.from}
                        onChange={(e) => { const next = [...dateRanges]; next[i] = { ...next[i], from: e.target.value }; setDateRanges(next); }}
                        className="flex-1 px-3 py-2 rounded-xl bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500" />
                      <span className="text-gray-400 text-sm">—</span>
                      <input type="date" value={range.to}
                        onChange={(e) => { const next = [...dateRanges]; next[i] = { ...next[i], to: e.target.value }; setDateRanges(next); }}
                        className="flex-1 px-3 py-2 rounded-xl bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500" />
                      {dateRanges.length > 1 && (
                        <button onClick={() => setDateRanges((prev) => prev.filter((_, j) => j !== i))}
                          className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-red-50 dark:hover:bg-red-900/20 flex-shrink-0">
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
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">时间块设计（24小时模板）</label>
                {loading ? (
                  <div className="skeleton h-20 rounded-xl" />
                ) : (
                  <div className="space-y-2 mb-3 max-h-48 overflow-y-auto">
                    {events.map((ev, i) => (
                      <div key={i} className="flex items-center gap-2 bg-gray-50 dark:bg-gray-800 rounded-xl p-2.5 text-sm">
                        <span className="text-xs font-mono text-gray-500 w-20 flex-shrink-0">{ev.startTime}-{ev.endTime}</span>
                        <span className="flex-1 text-gray-900 dark:text-gray-200 truncate">{ev.title}</span>
                        <button onClick={() => removeEvent(i)}
                          className="w-6 h-6 flex items-center justify-center rounded hover:bg-red-50 dark:hover:bg-red-900/20 flex-shrink-0">
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
                    placeholder="事件名称" className="flex-1 px-3 py-2 rounded-xl bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500" />
                  <input type="time" value={eventStart} onChange={(e) => setEventStart(e.target.value)}
                    className="w-24 px-2 py-2 rounded-xl bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500" />
                  <input type="time" value={eventEnd} onChange={(e) => setEventEnd(e.target.value)}
                    className="w-24 px-2 py-2 rounded-xl bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500" />
                  <motion.button whileTap={{ scale: 0.9 }} onClick={addEvent}
                    className="w-9 h-9 flex items-center justify-center rounded-xl bg-indigo-600 text-white flex-shrink-0">
                    <Plus className="w-4 h-4" />
                  </motion.button>
                </div>
              </div>
            </div>
            <div className="flex gap-3 mt-6">
              <button onClick={onClose}
                className="flex-1 py-2.5 rounded-xl border border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-400 text-sm font-medium hover:bg-gray-50 dark:hover:bg-gray-800">取消</button>
              <motion.button whileTap={{ scale: 0.97 }} onClick={handleSaveTemplate} disabled={saving}
                className="flex-1 py-2.5 rounded-xl bg-gray-900 dark:bg-gray-100 dark:text-gray-900 text-white text-sm font-medium hover:bg-gray-800 dark:hover:bg-gray-200 disabled:opacity-50">
                {saving ? "保存中..." : "保存模板"}
              </motion.button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

// ==================== 主页面 ====================

export default function HomePage() {
  const [projects, setProjects] = useState<ProjectV2[]>([]);
  const [projectBoards, setProjectBoards] = useState<Record<number, Board[]>>({});
  const [loading, setLoading] = useState(true);
  const [inboxExpanded, setInboxExpanded] = useState(false);

  // 日程视图状态
  const [scheduleView, setScheduleView] = useState<"today" | "history" | "templates">("today");
  const [templateLoading, setTemplateLoading] = useState(false);
  const [templates, setTemplates] = useState<ScheduleTemplate[]>([]);
  const [modalOpen, setModalOpen] = useState(false);
  const [editTemplate, setEditTemplate] = useState<ScheduleTemplate | null>(null);

  // drill-down state
  const [view, setView] = useState<"projects" | "boards" | "detail">("projects");
  const [selectedProject, setSelectedProject] = useState<ProjectV2 | null>(null);
  const [selectedProjectIndex, setSelectedProjectIndex] = useState(0);
  const [selectedBoard, setSelectedBoard] = useState<Board | null>(null);

  useEffect(() => {
    const load = async () => {
      try {
        const list = await getAllProjectsV2();
        setProjects(list);
        const map: Record<number, Board[]> = {};
        for (const proj of list) {
          const bds = await getBoardsByProject(proj.id!);
          map[proj.id!] = bds;
        }
        setProjectBoards(map);
      } catch (err) {
        console.error("Failed to load projects:", err);
      } finally {
        setLoading(false);
      }
    };
    load();
  }, []);

  const loadTemplates = useCallback(async () => {
    setTemplateLoading(true);
    try {
      await ensureDefaultTemplate();
      const list = await getAllTemplates();
      setTemplates(list);
    } catch (err) {
      console.error("Failed to load templates:", err);
    } finally {
      setTemplateLoading(false);
    }
  }, []);

  useEffect(() => { loadTemplates(); }, [loadTemplates]);

  const handleDeleteTemplate = async (id: number) => {
    if (!confirm("确定删除该模板？相关日程记录也会被删除。")) return;
    await deleteTemplate(id);
    await loadTemplates();
    showToast({ message: "模板已删除", type: "success" });
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-50 to-white dark:from-gray-950 dark:to-gray-900 text-slate-900 dark:text-white">
      <div className="mx-auto max-w-5xl px-5 pt-8 pb-24 md:px-8 md:pt-10">
        <OverviewHeader />

        {/* 人物框 */}
        <div className="mt-6 mb-6">
          <CharacterFrame />
        </div>

        {/* === 视图切换 === */}
        {view === "projects" && (
          <>
            {loading ? (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-5 md:gap-6">
                {[1, 2, 3, 4].map((i) => <div key={i} className="skeleton h-[240px] rounded-3xl" />)}
              </div>
            ) : projects.length === 0 ? (
              <div className="text-center py-16">
                <FolderKanban className="w-10 h-10 text-gray-300 mx-auto mb-3" strokeWidth={1.5} />
                <p className="text-sm text-gray-500 mb-1">暂无项目</p>
                <p className="text-xs text-gray-400">在规划页中创建项目，它们将自动显示在这里</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-5 md:gap-6">
                {projects.map((proj, i) => {
                  const boards = projectBoards[proj.id!] || [];
                  return (
                    <ProjectCard
                      key={proj.id}
                      project={proj}
                      index={i}
                      boardCount={boards.length}
                      boardNames={boards.map((b) => b.name)}
                      onClick={() => { setSelectedProject(proj); setSelectedProjectIndex(i); setView("boards"); }}
                    />
                  );
                })}
              </div>
            )}
          </>
        )}

        {view === "boards" && selectedProject && (
          <BoardListView
            project={selectedProject}
            boards={projectBoards[selectedProject.id!] || []}
            onBack={() => setView("projects")}
            onBoardClick={(board) => { setSelectedBoard(board); setView("detail"); }}
          />
        )}

        {view === "detail" && selectedBoard && selectedProject && (
          <BoardDetailView
            board={selectedBoard}
            project={selectedProject}
            projectIndex={selectedProjectIndex}
            onBack={() => setView("boards")}
          />
        )}

        {/* 快速捕捉栏 */}
        <div className="mt-8">
          <QuickCaptureBar inboxExpanded={inboxExpanded} onToggleInbox={() => setInboxExpanded((v) => !v)} />
          <CaptureInbox visible={inboxExpanded} />
        </div>

        {/* 日程时间线 */}
        <div className="mt-8">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              {scheduleView !== "today" && (
                <button onClick={() => setScheduleView("today")}
                  className="w-6 h-6 flex items-center justify-center rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800">
                  <ChevronLeft className="w-4 h-4 text-gray-400" />
                </button>
              )}
              <Clock className="w-4 h-4 text-gray-400" />
              <h2 className="text-lg font-bold text-gray-900 dark:text-white">
                {scheduleView === "history" ? "历史记录" : scheduleView === "templates" ? "模板管理" : "今日日程"}
              </h2>
            </div>
            {scheduleView === "today" && (
              <div className="flex items-center gap-1">
                <button onClick={() => setScheduleView("history")}
                  className="px-2.5 py-1 text-xs font-medium text-gray-500 hover:text-gray-900 hover:bg-gray-100 dark:hover:text-gray-300 dark:hover:bg-gray-800 rounded-lg transition-colors">
                  历史
                </button>
                <button onClick={() => setScheduleView("templates")}
                  className="px-2.5 py-1 text-xs font-medium text-gray-500 hover:text-gray-900 hover:bg-gray-100 dark:hover:text-gray-300 dark:hover:bg-gray-800 rounded-lg transition-colors">
                  模板
                </button>
              </div>
            )}
          </div>
          {scheduleView === "templates" ? (
            <TemplateList
              templates={templates}
              loading={templateLoading}
              onEdit={(t) => { setEditTemplate(t); setModalOpen(true); }}
              onDelete={handleDeleteTemplate}
              onCreate={() => { setEditTemplate(null); setModalOpen(true); }}
            />
          ) : scheduleView === "history" ? (
            <HistoryView />
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
    </div>
  );
}
