"use client";

import { useState, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  X, Edit3, Check, Play, Trash2, Save,
  Mountain, CalendarDays, ClipboardList, Flame,
  Clock, Plus, Calendar, Target, Tag, FileText, Link2,
} from "lucide-react";
import { getTask, updateTask, deleteTask, restoreTask, getTimeSegments, addTimeSegment, deleteTimeSegment } from "@/lib/db";
import { PRIORITY_CONFIG } from "@/lib/types";
import { showToast } from "@/components/ui/Toast";
import type { Task, TimeSegment } from "@/lib/types";

const CLASSIFICATION_LABELS: Record<string, { label: string; icon: typeof Mountain; color: string }> = {
  "long-term": { label: "长期目标", icon: Mountain, color: "text-indigo-500" },
  "longterm": { label: "长期目标", icon: Mountain, color: "text-indigo-500" },
  "short-term": { label: "短期事件", icon: CalendarDays, color: "text-blue-500" },
  "shortterm": { label: "短期事件", icon: CalendarDays, color: "text-blue-500" },
  "daily-trivial": { label: "日常琐事", icon: ClipboardList, color: "text-green-500" },
  "daily": { label: "日常琐事", icon: ClipboardList, color: "text-green-500" },
  "habit": { label: "习惯", icon: Flame, color: "text-orange-500" },
  "habits": { label: "习惯", icon: Flame, color: "text-orange-500" },
};

function formatDate(ts: number | undefined): string {
  if (!ts) return "";
  return new Date(ts).toLocaleString("zh-CN", { year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit" });
}

function formatDateOnly(ts: number | undefined): string {
  if (!ts) return "";
  return new Date(ts).toLocaleDateString("zh-CN", { year: "numeric", month: "2-digit", day: "2-digit" });
}

interface TaskDetailProps {
  taskId: number;
  onClose: () => void;
  onUpdate?: () => void;
}

export default function TaskDetail({ taskId, onClose, onUpdate }: TaskDetailProps) {
  const [task, setTask] = useState<Task | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);

  const [draft, setDraft] = useState<Partial<Task>>({});
  const [draftTags, setDraftTags] = useState<string>("");

  const [segments, setSegments] = useState<TimeSegment[]>([]);
  const [addingSegment, setAddingSegment] = useState(false);
  const [newSegStart, setNewSegStart] = useState("");
  const [newSegEnd, setNewSegEnd] = useState("");

  const loadTask = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const t = await getTask(taskId);
      if (!t) { setError("任务不存在"); return; }
      setTask(t);
      const segs = await getTimeSegments(t.id!);
      setSegments(segs.sort((a, b) => a.startTime - b.startTime));
      setDraft({});
      setDraftTags("");
    } catch { setError("加载失败"); }
    finally { setLoading(false); }
  }, [taskId]);

  useEffect(() => { requestAnimationFrame(() => { loadTask(); }); }, [loadTask]);

  const handleStartEdit = () => {
    if (!task) return;
    setDraft({
      title: task.title,
      type: task.type,
      priority: task.priority,
      status: task.status,
      startTime: task.startTime,
      endTime: task.endTime,
      dueDate: task.dueDate,
      successCriteria: task.successCriteria,
      note: task.note,
    });
    setDraftTags((task.tags || []).join("、"));
    setEditing(true);
  };

  const handleCancelEdit = () => {
    setEditing(false);
    setDraft({});
    setDraftTags("");
  };

  const handleSave = async () => {
    if (!task || saving) return;
    setSaving(true);
    try {
      const updates: Partial<Task> = { ...draft };
      const tagsArr = draftTags.split(/[,，、]/).map((s) => s.trim()).filter(Boolean);
      if (tagsArr.length > 0) updates.tags = tagsArr;

      await updateTask(task.id!, updates);

      const segStartVal = newSegStart;
      const segEndVal = newSegEnd;
      if (addingSegment && segStartVal && segEndVal) {
        const start = new Date(segStartVal).getTime();
        const end = new Date(segEndVal).getTime();
        if (end <= start) {
          showToast({ message: "时间段未添加：结束时间必须晚于开始时间", type: "error" });
        } else {
          await addTimeSegment(task.id!, start, end);
        }
        setAddingSegment(false);
        setNewSegStart("");
        setNewSegEnd("");
      }

      showToast({ message: "已保存", type: "success" });
      setEditing(false);
      await loadTask();
      onUpdate?.();
    } catch { showToast({ message: "保存失败", type: "error" }); }
    finally { setSaving(false); }
  };

  const handleDelete = async () => {
    if (!task) return;
    try {
      await deleteTask(task.id!);
      showToast({ message: "已移入回收站", type: "info", undoAction: async () => { await restoreTask(task.id!); } });
      onClose();
      onUpdate?.();
    } catch { showToast({ message: "删除失败", type: "error" }); }
  };

  const handleToggleStatus = async () => {
    if (!task) return;
    const newStatus = task.status === "done" ? "active" : "done";
    try {
      await updateTask(task.id!, { status: newStatus });
      await loadTask();
      onUpdate?.();
    } catch { showToast({ message: "更新状态失败", type: "error" }); }
  };

  const handleAddSegment = async () => {
    if (!task || !newSegStart || !newSegEnd) return;
    const start = new Date(newSegStart).getTime();
    const end = new Date(newSegEnd).getTime();
    if (end <= start) { showToast({ message: "结束时间必须晚于开始时间", type: "error" }); return; }
    try {
      await addTimeSegment(task.id!, start, end);
      const segs = await getTimeSegments(task.id!);
      setSegments(segs.sort((a, b) => a.startTime - b.startTime));
      setAddingSegment(false);
      setNewSegStart(""); setNewSegEnd("");
    } catch { showToast({ message: "时间段添加失败", type: "error" }); }
  };

  const handleDeleteSegment = async (segId: number) => {
    try {
      await deleteTimeSegment(segId);
      setSegments((prev) => prev.filter((s) => s.id !== segId));
    } catch { showToast({ message: "删除时间段失败", type: "error" }); }
  };

  if (loading) {
    return (
      <div className="fixed inset-0 z-50 bg-black/40 flex items-end justify-center" onClick={onClose}>
        <div className="w-full max-w-lg bg-white dark:bg-gray-900 rounded-t-2xl p-6 h-64 flex items-center justify-center">
          <div className="w-6 h-6 border-2 border-gray-300 border-t-blue-500 rounded-full animate-spin" />
        </div>
      </div>
    );
  }

  if (error || !task) {
    return (
      <div className="fixed inset-0 z-50 bg-black/40 flex items-end justify-center" onClick={onClose}>
        <div className="w-full max-w-lg bg-white dark:bg-gray-900 rounded-t-2xl p-6">
          <p className="text-center text-gray-500 py-8">{error || "任务不存在"}</p>
        </div>
      </div>
    );
  }

  const cls = task.classification || task.type;
  const classInfo = CLASSIFICATION_LABELS[cls] || CLASSIFICATION_LABELS["daily"];
  const ClsIcon = classInfo.icon;
  const priorityInfo = PRIORITY_CONFIG.find((p) => p.key === task.priority);

  return (
    <AnimatePresence>
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-50 bg-black/40 backdrop-blur-sm flex items-end justify-center" onClick={onClose}>
        <motion.div initial={{ y: "100%" }} animate={{ y: 0 }} exit={{ y: "100%" }} transition={{ type: "spring", stiffness: 400, damping: 40 }} onClick={(e) => e.stopPropagation()} className="w-full max-w-lg bg-white dark:bg-gray-900 rounded-t-2xl max-h-[85vh] overflow-y-auto">
          <div className="w-10 h-1 bg-gray-300 dark:bg-gray-700 rounded-full mx-auto mt-3 mb-1" />
          <div className="px-6 pt-4 pb-6">

            {/* Header */}
            <div className="flex items-start justify-between mb-4">
              <div className="flex items-center gap-2.5 min-w-0 flex-1">
                <div className={`w-9 h-9 rounded-xl bg-gray-100 dark:bg-gray-800 flex items-center justify-center flex-shrink-0 ${classInfo.color}`}>
                  <ClsIcon className="w-5 h-5" />
                </div>
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <span className={`text-xs font-medium px-2 py-0.5 rounded-md ${classInfo.color} bg-opacity-10`}>
                      {classInfo.label}
                    </span>
                    {priorityInfo && (
                      <span className="flex items-center gap-1 text-xs text-gray-500">
                        <span className="w-2 h-2 rounded-full" style={{ backgroundColor: priorityInfo.hex }} />
                        {priorityInfo.label}
                      </span>
                    )}
                  </div>
                </div>
              </div>
              <button onClick={onClose} className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 text-gray-400 flex-shrink-0">
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Title */}
            {editing ? (
              <input
                type="text" value={draft.title || task.title}
                onChange={(e) => setDraft((d) => ({ ...d, title: e.target.value }))}
                className="w-full text-lg font-semibold text-gray-900 dark:text-gray-100 mb-4 px-3 py-2 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            ) : (
              <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-4 break-words">{task.title}</h2>
            )}

            {/* Quick actions row */}
            <div className="flex items-center gap-2 mb-5">
              <button
                onClick={handleToggleStatus}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium transition-colors ${
                  task.status === "done" ? "bg-emerald-100 text-emerald-700" : "bg-amber-100 text-amber-700"
                }`}
              >
                <Check className="w-3.5 h-3.5" />
                {task.status === "done" ? "已完成" : "进行中"}
              </button>

              {cls === "short-term" || cls === "shortterm" ? (
                <a
                  href={`/plugins/focus-timer?taskId=${task.id}`}
                  onClick={(e) => e.stopPropagation()}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-purple-100 text-purple-700 text-xs font-medium hover:bg-purple-200 transition-colors"
                >
                  <Play className="w-3.5 h-3.5" />
                  开始专注
                </a>
              ) : null}

              <div className="flex-1" />

              {!editing && (
                <button onClick={handleStartEdit} className="flex items-center gap-1 px-3 py-1.5 rounded-full bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400 text-xs font-medium hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors">
                  <Edit3 className="w-3.5 h-3.5" />
                  编辑
                </button>
              )}

              <button onClick={handleDelete} className="flex items-center gap-1 px-3 py-1.5 rounded-full bg-red-50 text-red-500 text-xs font-medium hover:bg-red-100 transition-colors">
                <Trash2 className="w-3.5 h-3.5" />
                删除
              </button>
            </div>

            {/* Divider */}
            <div className="border-t border-gray-100 dark:border-gray-800 my-3" />

            {/* Info sections */}
            <div className="space-y-3">

              {/* Priority (editing) */}
              {editing && (
                <InfoRow icon={<Target className="w-4 h-4 text-gray-400" />} label="优先级">
                  <div className="grid grid-cols-2 gap-1.5">
                    {PRIORITY_CONFIG.map((p) => (
                      <button
                        key={p.key}
                        onClick={() => setDraft((d) => ({ ...d, priority: p.key }))}
                        className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium border transition-all ${
                          (draft.priority || task.priority) === p.key ? `${p.bg} ${p.color} border-current` : "border-gray-200 dark:border-gray-700 text-gray-400"
                        }`}
                      >
                        <span className="w-2 h-2 rounded-full" style={{ backgroundColor: p.hex }} />
                        {p.label}
                      </button>
                    ))}
                  </div>
                </InfoRow>
              )}

              {/* Type selector */}
              {editing && (
                <InfoRow icon={<Target className="w-4 h-4 text-gray-400" />} label="类型">
                  <div className="grid grid-cols-2 gap-1.5">
                    {(["shortterm", "daily", "longterm", "habit"] as const).map((t) => (
                      <button
                        key={t}
                        onClick={() => setDraft((d) => ({ ...d, type: t }))}
                        className={`px-2.5 py-1.5 rounded-lg text-xs font-medium border transition-all ${
                          (draft.type || task.type) === t ? "bg-blue-50 dark:bg-blue-900/20 text-blue-600 border-blue-200 dark:border-blue-800" : "border-gray-200 dark:border-gray-700 text-gray-400"
                        }`}
                      >
                        {t === "shortterm" && "短期事件"}
                        {t === "daily" && "日常琐事"}
                        {t === "longterm" && "长期目标"}
                        {t === "habit" && "习惯"}
                      </button>
                    ))}
                  </div>
                </InfoRow>
              )}

              {/* Start time */}
              <InfoRow icon={<Clock className="w-4 h-4 text-gray-400" />} label="开始时间">
                {editing ? (
                  <input type="datetime-local" value={draft.startTime ? new Date(draft.startTime).toISOString().slice(0, 16) : ""} onChange={(e) => setDraft((d) => ({ ...d, startTime: e.target.value ? new Date(e.target.value).getTime() : undefined }))} className="w-full px-3 py-1.5 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-sm text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500" />
                ) : (
                  <span className="text-sm text-gray-700 dark:text-gray-300">{formatDate(task.startTime) || "未设置"}</span>
                )}
              </InfoRow>

              {/* End time */}
              <InfoRow icon={<Clock className="w-4 h-4 text-gray-400" />} label="结束时间">
                {editing ? (
                  <input type="datetime-local" value={draft.endTime ? new Date(draft.endTime).toISOString().slice(0, 16) : ""} onChange={(e) => setDraft((d) => ({ ...d, endTime: e.target.value ? new Date(e.target.value).getTime() : undefined }))} className="w-full px-3 py-1.5 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-sm text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500" />
                ) : (
                  <span className="text-sm text-gray-700 dark:text-gray-300">{formatDate(task.endTime) || "未设置"}</span>
                )}
              </InfoRow>

              {/* Due date */}
              <InfoRow icon={<Calendar className="w-4 h-4 text-gray-400" />} label="截止日期">
                {editing ? (
                  <input type="date" value={draft.dueDate ? new Date(draft.dueDate).toISOString().slice(0, 10) : ""} onChange={(e) => setDraft((d) => ({ ...d, dueDate: e.target.value ? new Date(e.target.value).getTime() : undefined }))} className="w-full px-3 py-1.5 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-sm text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500" />
                ) : (
                  <span className="text-sm text-gray-700 dark:text-gray-300">{formatDateOnly(task.dueDate) || "未设置"}</span>
                )}
              </InfoRow>

              {/* Success criteria */}
              <InfoRow icon={<Target className="w-4 h-4 text-gray-400" />} label="成功标准">
                {editing ? (
                  <textarea value={draft.successCriteria || task.successCriteria || ""} onChange={(e) => setDraft((d) => ({ ...d, successCriteria: e.target.value }))} rows={2} className="w-full px-3 py-2 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-sm text-gray-900 dark:text-gray-100 resize-none focus:outline-none focus:ring-2 focus:ring-blue-500" placeholder="如何判断已完成？" />
                ) : (
                  <span className="text-sm text-gray-700 dark:text-gray-300">{task.successCriteria || "未设置"}</span>
                )}
              </InfoRow>

              {/* Time segments */}
              <InfoRow icon={<Clock className="w-4 h-4 text-gray-400" />} label="时间段">
                {segments.length === 0 && !editing ? (
                  <span className="text-sm text-gray-400">未设置</span>
                ) : (
                  <div className="space-y-1.5">
                    {segments.map((seg) => {
                      const startStr = new Date(seg.startTime).toLocaleString("zh-CN", { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" });
                      const endStr = new Date(seg.endTime).toLocaleString("zh-CN", { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" });
                      return (
                        <div key={seg.id} className="flex items-center gap-2 text-sm text-gray-700 dark:text-gray-300">
                          <span>{startStr} → {endStr}</span>
                          {editing && (
                            <button onClick={() => handleDeleteSegment(seg.id!)} className="w-5 h-5 flex items-center justify-center rounded hover:bg-red-50 text-gray-400 hover:text-red-500"><X className="w-3 h-3" /></button>
                          )}
                        </div>
                      );
                    })}
                    {editing && !addingSegment && (
                      <button onClick={() => setAddingSegment(true)} className="flex items-center gap-1 text-xs text-blue-500 hover:text-blue-600 font-medium">
                        <Plus className="w-3.5 h-3.5" />添加时间段
                      </button>
                    )}
                    {addingSegment && (
                      <div className="space-y-1.5 mt-1">
                        <div className="flex items-center gap-2">
                          <input type="datetime-local" value={newSegStart} onChange={(e) => setNewSegStart(e.target.value)} className="flex-1 px-2 py-1 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-xs text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500" />
                          <span className="text-xs text-gray-400">→</span>
                          <input type="datetime-local" value={newSegEnd} onChange={(e) => setNewSegEnd(e.target.value)} className="flex-1 px-2 py-1 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-xs text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500" />
                        </div>
                        <div className="flex gap-2">
                          <button onClick={handleAddSegment} className="text-xs text-blue-600 font-medium">确定</button>
                          <button onClick={() => { setAddingSegment(false); setNewSegStart(""); setNewSegEnd(""); }} className="text-xs text-gray-400">取消</button>
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </InfoRow>

              {/* Notes */}
              <InfoRow icon={<FileText className="w-4 h-4 text-gray-400" />} label="备注">
                {editing ? (
                  <textarea value={draft.note || task.note || ""} onChange={(e) => setDraft((d) => ({ ...d, note: e.target.value }))} rows={3} className="w-full px-3 py-2 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-sm text-gray-900 dark:text-gray-100 resize-none focus:outline-none focus:ring-2 focus:ring-blue-500" placeholder="添加备注..." />
                ) : (
                  <span className="text-sm text-gray-700 dark:text-gray-300 whitespace-pre-wrap">{task.note || "无备注"}</span>
                )}
              </InfoRow>

              {/* Tags */}
              <InfoRow icon={<Tag className="w-4 h-4 text-gray-400" />} label="标签">
                {editing ? (
                  <input type="text" value={draftTags} onChange={(e) => setDraftTags(e.target.value)} placeholder="逗号分隔" className="w-full px-3 py-1.5 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-sm text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500" />
                ) : (
                  <span className="text-sm text-gray-700 dark:text-gray-300">{(task.tags || []).length > 0 ? (task.tags || []).join(" · ") : "无标签"}</span>
                )}
              </InfoRow>

              {/* Created time */}
              <InfoRow icon={<Clock className="w-4 h-4 text-gray-400" />} label="创建时间">
                <span className="text-sm text-gray-400">{formatDate(task.createdAt)}</span>
              </InfoRow>

              {/* Source */}
              {task.captureSourceId && (
                <InfoRow icon={<Link2 className="w-4 h-4 text-gray-400" />} label="来源">
                  <span className="text-sm text-indigo-500">来自捕捉箱</span>
                </InfoRow>
              )}

            </div>

            {/* Edit mode buttons */}
            {editing && (
              <div className="flex gap-3 mt-6 pt-3 border-t border-gray-100 dark:border-gray-800">
                <button onClick={handleCancelEdit} className="flex-1 py-3 rounded-xl border border-gray-200 dark:border-gray-700 text-sm font-medium text-gray-500 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors">
                  取消
                </button>
                <button onClick={handleSave} disabled={saving} className="flex-1 py-3 rounded-xl bg-blue-600 text-white text-sm font-medium hover:bg-blue-700 transition-colors disabled:opacity-40 flex items-center justify-center gap-1.5">
                  {saving ? <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" /> : <Save className="w-4 h-4" />}
                  保存
                </button>
              </div>
            )}
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}

function InfoRow({ icon, label, children }: { icon: React.ReactNode; label: string; children: React.ReactNode }) {
  return (
    <div className="flex gap-3">
      <div className="flex items-center gap-2 w-24 flex-shrink-0 pt-0.5">
        {icon}
        <span className="text-xs text-gray-400 dark:text-gray-500">{label}</span>
      </div>
      <div className="flex-1 min-w-0">{children}</div>
    </div>
  );
}
