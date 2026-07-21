"use client";

import { useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { ChevronLeft, Plus, Trash2, Clock, MapPin, BookOpen } from "lucide-react";
import { useLiveQuery } from "dexie-react-hooks";
import { getCourses, addCourse, updateCourse, deleteCourse } from "@/lib/db/daylog.db";
import type { Course } from "@/lib/db/daylog.db";
import { showToast } from "@/components/ui/Toast";

const COLORS = ["#007AFF", "#34C759", "#FF9500", "#FF3B30", "#FF2D55", "#AF52DE", "#5AC8FA", "#FFCC00"];
const WEEKDAY_LABELS = ["日", "一", "二", "三", "四", "五", "六"];

const WEEKS = [
  { key: "this", label: "本周" },
  { key: "last", label: "上周" },
  { key: "next", label: "下周" },
] as const;

function formatWeekdays(weekday: number[]): string {
  if (!weekday || weekday.length === 0) return "未设置";
  return weekday.sort((a, b) => a - b).map((d) => WEEKDAY_LABELS[d]).join("\u00B7");
}

export default function CoursesPage() {
  const router = useRouter();

  const courses = useLiveQuery(() => getCourses(), [], [] as Course[]);

  const [activeWeek, setActiveWeek] = useState("this");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [adding, setAdding] = useState(false);

  const [formName, setFormName] = useState("");
  const [formWeekday, setFormWeekday] = useState<number[]>([]);
  const [formStartTime, setFormStartTime] = useState("08:00");
  const [formEndTime, setFormEndTime] = useState("09:30");
  const [formLocation, setFormLocation] = useState("");
  const [formColor, setFormColor] = useState(COLORS[0]);
  const [formWeeksStart, setFormWeeksStart] = useState("");
  const [formWeeksEnd, setFormWeeksEnd] = useState("");

  const resetForm = useCallback(() => {
    setFormName("");
    setFormWeekday([]);
    setFormStartTime("08:00");
    setFormEndTime("09:30");
    setFormLocation("");
    setFormColor(COLORS[0]);
    setFormWeeksStart("");
    setFormWeeksEnd("");
    setEditingId(null);
    setAdding(false);
  }, []);

  const populateForm = useCallback((c: Course) => {
    setFormName(c.name);
    setFormWeekday([...c.weekday]);
    setFormStartTime(c.startTime);
    setFormEndTime(c.endTime);
    setFormLocation(c.location);
    setFormColor(c.color);
    if (c.weeks && c.weeks.length >= 2) {
      const sorted = [...c.weeks].sort((a, b) => a - b);
      setFormWeeksStart(String(sorted[0]));
      setFormWeeksEnd(String(sorted[sorted.length - 1]));
    } else {
      setFormWeeksStart("");
      setFormWeeksEnd("");
    }
  }, []);

  const toggleWeekday = useCallback((day: number) => {
    setFormWeekday((prev) => (prev.includes(day) ? prev.filter((d) => d !== day) : [...prev, day]));
  }, []);

  const buildWeeksArray = useCallback((): number[] => {
    const s = parseInt(formWeeksStart, 10);
    const e = parseInt(formWeeksEnd, 10);
    if (isNaN(s) || isNaN(e) || s > e) return [];
    return Array.from({ length: e - s + 1 }, (_, i) => s + i);
  }, [formWeeksStart, formWeeksEnd]);

  const handleSave = useCallback(async () => {
    if (!formName.trim()) { showToast({ type: "warning", message: "请输入课程名称" }); return; }
    if (formWeekday.length === 0) { showToast({ type: "warning", message: "请选择上课日" }); return; }
    const weeks = buildWeeksArray();
    const data = { name: formName.trim(), weekday: formWeekday, startTime: formStartTime, endTime: formEndTime, location: formLocation.trim(), color: formColor, icon: "GraduationCap", weeks };
    if (editingId) {
      await updateCourse(editingId, data);
      showToast({ type: "success", message: "课程已更新" });
    } else {
      await addCourse(data);
      showToast({ type: "success", message: "课程已添加" });
    }
    resetForm();
  }, [formName, formWeekday, formStartTime, formEndTime, formLocation, formColor, formWeeksStart, formWeeksEnd, editingId, buildWeeksArray, resetForm]);

  const handleEdit = useCallback((c: Course) => {
    setEditingId(c.id);
    populateForm(c);
    setAdding(false);
  }, [populateForm]);

  const handleDelete = useCallback(async (id: string) => {
    await deleteCourse(id);
    showToast({ type: "success", message: "课程已删除" });
    if (editingId === id) resetForm();
  }, [editingId, resetForm]);

  const showForm = adding || editingId !== null;

  return (
    <div className="pb-[100px]">
      {/* Header */}
      <div className="flex items-center px-4 pt-3 pb-2">
        <button
          type="button"
          onClick={() => router.push("/more")}
          className="inline-flex h-8 w-8 items-center justify-center rounded-lg"
          style={{
            background: "var(--color-surface-card)",
            border: "1px solid var(--lifeflow-border)",
          }}
        >
          <ChevronLeft className="w-4 h-4" style={{ color: "var(--color-text-primary)" }} />
        </button>
        <h1 className="text-title-nav flex-1 text-center" style={{ color: "var(--color-text-primary)" }}>
          课程表
        </h1>
        <div className="w-8" />
      </div>

      <div className="px-4 pt-5">
        {/* Week pills */}
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          className="flex gap-2 mb-4"
        >
          {WEEKS.map((w) => (
            <button
              key={w.key}
              type="button"
              onClick={() => setActiveWeek(w.key)}
              className="h-9 px-5 rounded-full text-[14px] font-medium transition-colors"
              style={{
                background: activeWeek === w.key ? "var(--lifeflow-primary)" : "var(--color-surface-secondary)",
                color: activeWeek === w.key ? "var(--lifeflow-primary-foreground)" : "var(--color-text-secondary)",
              }}
            >
              {w.label}
            </button>
          ))}
        </motion.div>

        {/* Days of Week Header Row */}
        <div className="grid grid-cols-7 gap-1 mb-4">
          {["周一","周二","周三","周四","周五","周六","周日"].map((label, i) => (
            <span
              key={label}
              className="text-center text-[13px] font-medium truncate"
              style={{ color: i >= 5 ? "var(--color-expense)" : "var(--color-text-secondary)" }}
            >
              {label}
            </span>
          ))}
        </div>

        {/* Add / Edit form */}
        <AnimatePresence mode="wait">
          {showForm ? (
            <motion.div
              key="form"
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: "auto" }}
              exit={{ opacity: 0, height: 0 }}
              className="card-standard p-4 mb-4 overflow-hidden"
            >
              <input
                type="text" value={formName} onChange={(e) => setFormName(e.target.value)}
                placeholder="课程名称（如：高等数学）" autoFocus
                className="w-full text-[16px] outline-none bg-transparent mb-3"
                style={{ color: "var(--color-text-primary)" }}
              />
              <div className="mb-3">
                <p className="text-[13px] mb-2" style={{ color: "var(--color-text-secondary)" }}>上课日</p>
                <div className="flex gap-2 flex-wrap">
                  {WEEKDAY_LABELS.map((label, idx) => {
                    const selected = formWeekday.includes(idx);
                    return (
                      <button
                        key={idx} type="button" onClick={() => toggleWeekday(idx)}
                        className="w-9 h-9 rounded-full text-[14px] font-medium transition-all border"
                        style={{
                          background: selected ? formColor : "transparent",
                          color: selected ? "#fff" : "var(--color-text-primary)",
                          borderColor: selected ? formColor : "var(--lifeflow-border)",
                        }}
                      >
                        {label}
                      </button>
                    );
                  })}
                </div>
              </div>
              <div className="mb-3">
                <p className="text-[13px] mb-2" style={{ color: "var(--color-text-secondary)" }}>上课时间</p>
                <div className="flex items-center gap-2">
                  <input type="time" value={formStartTime} onChange={(e) => setFormStartTime(e.target.value)}
                    className="flex-1 h-10 rounded-lg px-3 text-[15px] outline-none border"
                    style={{ borderColor: "var(--lifeflow-border)", background: "var(--color-surface-secondary)" }} />
                  <span className="text-[13px]" style={{ color: "var(--color-text-secondary)" }}>至</span>
                  <input type="time" value={formEndTime} onChange={(e) => setFormEndTime(e.target.value)}
                    className="flex-1 h-10 rounded-lg px-3 text-[15px] outline-none border"
                    style={{ borderColor: "var(--lifeflow-border)", background: "var(--color-surface-secondary)" }} />
                </div>
              </div>
              <input type="text" value={formLocation} onChange={(e) => setFormLocation(e.target.value)}
                placeholder="上课地点（如：教学楼A201）"
                className="w-full h-10 rounded-lg px-3 text-[15px] outline-none border mb-3"
                style={{ borderColor: "var(--lifeflow-border)", background: "var(--color-surface-secondary)" }} />
              <div className="mb-3">
                <p className="text-[13px] mb-2" style={{ color: "var(--color-text-secondary)" }}>课程颜色</p>
                <div className="flex gap-2.5 flex-wrap">
                  {COLORS.map((c) => (
                    <button key={c} type="button" onClick={() => setFormColor(c)}
                      className="w-7 h-7 rounded-full transition-all"
                      style={{ background: c, boxShadow: formColor === c ? `0 0 0 3px ${c}40` : "none", transform: formColor === c ? "scale(1.15)" : "scale(1)" }} />
                  ))}
                </div>
              </div>
              <div className="mb-3">
                <p className="text-[13px] mb-2" style={{ color: "var(--color-text-secondary)" }}>起始周 - 结束周（可选）</p>
                <div className="flex items-center gap-2">
                  <input type="number" value={formWeeksStart} onChange={(e) => setFormWeeksStart(e.target.value)} placeholder="起始周" min={1}
                    className="flex-1 h-10 rounded-lg px-3 text-[15px] outline-none border"
                    style={{ borderColor: "var(--lifeflow-border)", background: "var(--color-surface-secondary)" }} />
                  <span className="text-[13px]" style={{ color: "var(--color-text-secondary)" }}>至</span>
                  <input type="number" value={formWeeksEnd} onChange={(e) => setFormWeeksEnd(e.target.value)} placeholder="结束周" min={1}
                    className="flex-1 h-10 rounded-lg px-3 text-[15px] outline-none border"
                    style={{ borderColor: "var(--lifeflow-border)", background: "var(--color-surface-secondary)" }} />
                </div>
              </div>
              <div className="flex gap-2">
                <button onClick={resetForm}
                  className="flex-1 h-10 rounded-lg text-[15px]"
                  style={{ background: "var(--color-surface-secondary)", color: "var(--color-text-secondary)" }}>取消</button>
                <button onClick={handleSave}
                  className="flex-1 h-10 rounded-lg text-[15px] font-semibold text-white"
                  style={{ background: "var(--lifeflow-primary)" }}>{editingId ? "更新" : "添加"}</button>
              </div>
            </motion.div>
          ) : (
            <button
              onClick={() => setAdding(true)}
              className="w-full h-11 flex items-center justify-center gap-2 rounded-[20px] mb-4 text-[15px] font-medium"
              style={{ background: "var(--lifeflow-brand-50)", color: "var(--lifeflow-primary)", border: "1px dashed var(--lifeflow-brand-200)" }}
            >
              <Plus className="w-4 h-4" />添加课程
            </button>
          )}
        </AnimatePresence>

        {/* Course list */}
        <div className="flex flex-col gap-3">
          {(courses ?? []).map((c, i) => (
            <motion.div
              key={c.id}
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.04 }}
              onClick={() => handleEdit(c)}
              className="card-standard p-4 cursor-pointer active:scale-[0.98] transition-transform"
            >
              <div className="flex items-start gap-3">
                <div className="w-1 self-stretch rounded-full flex-shrink-0" style={{ background: c.color, minHeight: 40 }} />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between">
                    <h3 className="text-[16px] font-semibold truncate" style={{ color: "var(--color-text-primary)" }}>{c.name}</h3>
                    <button onClick={(e) => { e.stopPropagation(); handleDelete(c.id); }}
                      className="w-7 h-7 flex items-center justify-center flex-shrink-0">
                      <Trash2 className="w-4 h-4" style={{ color: "var(--color-text-disabled)" }} />
                    </button>
                  </div>
                  <p className="text-[14px] mt-0.5 font-medium" style={{ color: c.color }}>{formatWeekdays(c.weekday)}</p>
                  <div className="flex items-center gap-1 mt-1.5">
                    <Clock className="w-3.5 h-3.5" style={{ color: "var(--color-text-secondary)" }} />
                    <span className="text-[13px]" style={{ color: "var(--color-text-secondary)" }}>{c.startTime} - {c.endTime}</span>
                  </div>
                  {c.location && (
                    <div className="flex items-center gap-1 mt-0.5">
                      <MapPin className="w-3.5 h-3.5" style={{ color: "var(--color-text-secondary)" }} />
                      <span className="text-[13px]" style={{ color: "var(--color-text-secondary)" }}>{c.location}</span>
                    </div>
                  )}
                  {c.weeks && c.weeks.length > 0 && (
                    <p className="text-[12px] mt-1" style={{ color: "var(--color-text-disabled)" }}>
                      第{c.weeks[0]}-{c.weeks[c.weeks.length - 1]}周
                    </p>
                  )}
                </div>
              </div>
            </motion.div>
          ))}
        </div>

        {/* Empty state */}
        {(courses ?? []).length === 0 && !showForm && (
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            className="flex flex-1 flex-col items-center justify-center px-4"
          >
            <div
              className="w-full max-w-sm flex flex-col items-center px-6 py-12"
              style={{
                backgroundColor: "var(--color-surface-card)",
                borderRadius: 20,
                boxShadow: "var(--shadow-card)",
              }}
            >
              <div className="w-20 h-20 rounded-full flex items-center justify-center mb-5" style={{ backgroundColor: "var(--lifeflow-brand-50)" }}>
                <BookOpen className="w-10 h-10" style={{ color: "var(--lifeflow-primary)" }} />
              </div>
              <p className="text-[17px] font-semibold mb-2" style={{ color: "var(--color-text-primary)", letterSpacing: "-0.018em" }}>
                暂无课程安排
              </p>
              <p className="text-[14px] mb-7" style={{ color: "var(--color-text-secondary)", letterSpacing: "-0.01em" }}>
                本周还没有添加任何课程
              </p>
              <button
                onClick={() => setAdding(true)}
                className="inline-flex items-center gap-2 rounded-full px-6 py-2.5 text-[15px] font-medium"
                style={{
                  backgroundColor: "var(--lifeflow-primary)",
                  color: "var(--lifeflow-primary-foreground)",
                }}
              >
                <Plus className="w-4 h-4" />
                添加课程
              </button>
            </div>
          </motion.div>
        )}
      </div>
    </div>
  );
}
