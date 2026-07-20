"use client";

import { useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { ChevronLeft, Plus, Trash2, Clock, MapPin, Check, X } from "lucide-react";
import { useLiveQuery } from "dexie-react-hooks";
import { getCourses, addCourse, updateCourse, deleteCourse } from "@/lib/db/daylog.db";
import type { Course } from "@/lib/db/daylog.db";
import { showToast } from "@/components/ui/Toast";

const COLORS = ["#007AFF", "#34C759", "#FF9500", "#FF3B30", "#FF2D55", "#AF52DE", "#5AC8FA", "#FFCC00"];

const WEEKDAY_LABELS = ["日", "一", "二", "三", "四", "五", "六"];

function formatWeekdays(weekday: number[]): string {
  if (!weekday || weekday.length === 0) return "未设置";
  return weekday
    .sort((a, b) => a - b)
    .map((d) => WEEKDAY_LABELS[d])
    .join("\u00B7");
}

export default function CoursesPage() {
  const router = useRouter();

  const courses = useLiveQuery(() => getCourses(), [], [] as Course[]);

  const [editingId, setEditingId] = useState<string | null>(null);
  const [adding, setAdding] = useState(false);

  // Form state
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
    setFormWeekday((prev) =>
      prev.includes(day) ? prev.filter((d) => d !== day) : [...prev, day]
    );
  }, []);

  const buildWeeksArray = useCallback((): number[] => {
    const s = parseInt(formWeeksStart, 10);
    const e = parseInt(formWeeksEnd, 10);
    if (isNaN(s) || isNaN(e) || s > e) return [];
    return Array.from({ length: e - s + 1 }, (_, i) => s + i);
  }, [formWeeksStart, formWeeksEnd]);

  const handleSave = useCallback(async () => {
    if (!formName.trim()) {
      showToast({ type: "warning", message: "请输入课程名称" });
      return;
    }
    if (formWeekday.length === 0) {
      showToast({ type: "warning", message: "请选择上课日" });
      return;
    }

    const weeks = buildWeeksArray();
    const data = {
      name: formName.trim(),
      weekday: formWeekday,
      startTime: formStartTime,
      endTime: formEndTime,
      location: formLocation.trim(),
      color: formColor,
      icon: "GraduationCap",
      weeks,
    };

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
    window.scrollTo({ top: 0, behavior: "smooth" });
  }, [populateForm]);

  const handleDelete = useCallback(async (id: string) => {
    await deleteCourse(id);
    showToast({ type: "success", message: "课程已删除" });
    if (editingId === id) resetForm();
  }, [editingId, resetForm]);

  const handleCancelEdit = useCallback(() => {
    resetForm();
  }, [resetForm]);

  const showForm = adding || editingId !== null;

  return (
    <div className="px-4 pt-5 pb-6">
      {/* 页头 */}
      <div className="flex items-center gap-2 mb-4">
        <button
          type="button"
          onClick={() => router.push("/more")}
          className="w-8 h-8 -ml-1 flex items-center justify-center"
        >
          <ChevronLeft className="w-6 h-6" />
        </button>
        <h1 className="text-[34px] font-bold tracking-[-0.02em] leading-tight flex-1">
          课程表
        </h1>
      </div>
      <p className="text-[15px] mb-4" style={{ color: "#8E8E93" }}>
        管理每周课程安排
      </p>

      {/* 添加按钮 / 编辑表单 */}
      <AnimatePresence mode="wait">
        {showForm ? (
          <motion.div
            key="form"
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            className="rounded-xl bg-white p-4 mb-4 shadow-[0_1px_4px_rgba(0,0,0,0.04)] overflow-hidden"
          >
            {/* 课程名称 */}
            <input
              type="text"
              value={formName}
              onChange={(e) => setFormName(e.target.value)}
              placeholder="课程名称（如：高等数学）"
              autoFocus
              className="w-full text-[17px] outline-none mb-3 py-1"
            />

            {/* 星期多选 */}
            <div className="mb-3">
              <p className="text-[13px] mb-2" style={{ color: "#8E8E93" }}>
                上课日
              </p>
              <div className="flex gap-2 flex-wrap">
                {WEEKDAY_LABELS.map((label, idx) => {
                  const selected = formWeekday.includes(idx);
                  return (
                    <button
                      key={idx}
                      type="button"
                      onClick={() => toggleWeekday(idx)}
                      className="w-9 h-9 rounded-full text-[14px] font-medium transition-all border"
                      style={{
                        background: selected ? formColor : "transparent",
                        color: selected ? "#fff" : "#1D1D1F",
                        borderColor: selected ? formColor : "#E5E5E5",
                      }}
                    >
                      {label}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* 时间 */}
            <div className="mb-3">
              <p className="text-[13px] mb-2" style={{ color: "#8E8E93" }}>
                上课时间
              </p>
              <div className="flex items-center gap-2">
                <input
                  type="time"
                  value={formStartTime}
                  onChange={(e) => setFormStartTime(e.target.value)}
                  className="flex-1 h-10 rounded-lg px-3 text-[15px] outline-none border"
                  style={{ borderColor: "#E5E5E5" }}
                />
                <span className="text-[13px]" style={{ color: "#8E8E93" }}>
                  至
                </span>
                <input
                  type="time"
                  value={formEndTime}
                  onChange={(e) => setFormEndTime(e.target.value)}
                  className="flex-1 h-10 rounded-lg px-3 text-[15px] outline-none border"
                  style={{ borderColor: "#E5E5E5" }}
                />
              </div>
            </div>

            {/* 地点 */}
            <input
              type="text"
              value={formLocation}
              onChange={(e) => setFormLocation(e.target.value)}
              placeholder="上课地点（如：教学楼A201）"
              className="w-full h-10 rounded-lg px-3 text-[15px] outline-none border mb-3"
              style={{ borderColor: "#E5E5E5" }}
            />

            {/* 颜色选择 */}
            <div className="mb-3">
              <p className="text-[13px] mb-2" style={{ color: "#8E8E93" }}>
                课程颜色
              </p>
              <div className="flex gap-2.5 flex-wrap">
                {COLORS.map((c) => (
                  <button
                    key={c}
                    type="button"
                    onClick={() => setFormColor(c)}
                    className="w-7 h-7 rounded-full transition-all"
                    style={{
                      background: c,
                      boxShadow: formColor === c ? `0 0 0 3px ${c}40` : "none",
                      transform: formColor === c ? "scale(1.15)" : "scale(1)",
                    }}
                  />
                ))}
              </div>
            </div>

            {/* 周次 */}
            <div className="mb-3">
              <p className="text-[13px] mb-2" style={{ color: "#8E8E93" }}>
                起始周 - 结束周（可选）
              </p>
              <div className="flex items-center gap-2">
                <input
                  type="number"
                  value={formWeeksStart}
                  onChange={(e) => setFormWeeksStart(e.target.value)}
                  placeholder="起始周"
                  min={1}
                  className="flex-1 h-10 rounded-lg px-3 text-[15px] outline-none border"
                  style={{ borderColor: "#E5E5E5" }}
                />
                <span className="text-[13px]" style={{ color: "#8E8E93" }}>
                  至
                </span>
                <input
                  type="number"
                  value={formWeeksEnd}
                  onChange={(e) => setFormWeeksEnd(e.target.value)}
                  placeholder="结束周"
                  min={1}
                  className="flex-1 h-10 rounded-lg px-3 text-[15px] outline-none border"
                  style={{ borderColor: "#E5E5E5" }}
                />
              </div>
            </div>

            {/* 操作按钮 */}
            <div className="flex gap-2">
              <button
                onClick={handleCancelEdit}
                className="flex-1 h-10 rounded-lg text-[15px]"
                style={{ background: "#F2F2F7", color: "#8E8E93" }}
              >
                取消
              </button>
              <button
                onClick={handleSave}
                className="flex-1 h-10 rounded-lg text-[15px] font-semibold text-white"
                style={{ background: "#6366F1" }}
              >
                {editingId ? "更新" : "添加"}
              </button>
            </div>
          </motion.div>
        ) : (
          <button
            onClick={() => setAdding(true)}
            className="w-full h-11 flex items-center justify-center gap-2 rounded-xl mb-4 text-[15px] font-medium"
            style={{
              background: "#6366F110",
              color: "#6366F1",
              border: "1px dashed #6366F140",
            }}
          >
            <Plus className="w-4 h-4" />
            添加课程
          </button>
        )}
      </AnimatePresence>

      {/* 课程列表 */}
      <div className="flex flex-col gap-3">
        {(courses ?? []).map((c, i) => (
          <motion.div
            key={c.id}
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.04 }}
            onClick={() => handleEdit(c)}
            className="rounded-xl bg-white p-4 shadow-[0_1px_4px_rgba(0,0,0,0.04)] cursor-pointer active:scale-[0.98] transition-transform"
          >
            <div className="flex items-start gap-3">
              {/* 颜色条 */}
              <div
                className="w-1 self-stretch rounded-full flex-shrink-0"
                style={{ background: c.color, minHeight: 40 }}
              />

              <div className="flex-1 min-w-0">
                {/* 课程名 */}
                <div className="flex items-center justify-between">
                  <h3 className="text-[17px] font-semibold truncate">
                    {c.name}
                  </h3>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      handleDelete(c.id);
                    }}
                    className="w-7 h-7 flex items-center justify-center flex-shrink-0"
                  >
                    <Trash2 className="w-4 h-4" style={{ color: "#C7C7CC" }} />
                  </button>
                </div>

                {/* 星期 */}
                <p
                  className="text-[14px] mt-0.5"
                  style={{ color: c.color, fontWeight: 500 }}
                >
                  {formatWeekdays(c.weekday)}
                </p>

                {/* 时间 */}
                <div className="flex items-center gap-1 mt-1.5">
                  <Clock className="w-3.5 h-3.5" style={{ color: "#8E8E93" }} />
                  <span className="text-[13px]" style={{ color: "#8E8E93" }}>
                    {c.startTime} - {c.endTime}
                  </span>
                </div>

                {/* 地点 */}
                {c.location && (
                  <div className="flex items-center gap-1 mt-0.5">
                    <MapPin className="w-3.5 h-3.5" style={{ color: "#8E8E93" }} />
                    <span className="text-[13px]" style={{ color: "#8E8E93" }}>
                      {c.location}
                    </span>
                  </div>
                )}

                {/* 周次 */}
                {c.weeks && c.weeks.length > 0 && (
                  <p
                    className="text-[12px] mt-1"
                    style={{ color: "#AEAEB2" }}
                  >
                    第{c.weeks[0]}-{c.weeks[c.weeks.length - 1]}周
                  </p>
                )}
              </div>
            </div>
          </motion.div>
        ))}
      </div>

      {/* 空状态 */}
      {(courses ?? []).length === 0 && !showForm && (
        <div className="text-center py-12">
          <p className="text-[34px] mb-3">📚</p>
          <p className="text-[17px] font-semibold mb-1">还没有课程</p>
          <p className="text-[15px]" style={{ color: "#8E8E93" }}>
            添加新学期的课程表吧
          </p>
        </div>
      )}
    </div>
  );
}
