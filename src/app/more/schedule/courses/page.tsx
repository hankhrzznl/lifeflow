"use client";

import { useState, useCallback, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { ChevronLeft, Plus, Trash2, Clock, MapPin, BookOpen, GraduationCap, Pencil, Check } from "lucide-react";
import { useLiveQuery } from "dexie-react-hooks";
import { getCourses, addCourse, updateCourse, deleteCourse } from "@/lib/db/daylog.db";
import type { Course } from "@/lib/db/daylog.db";
import { showToast } from "@/components/ui/Toast";

const COLORS = ["#007AFF", "#34C759", "#FF9500", "#FF3B30", "#FF2D55", "#AF52DE", "#5AC8FA", "#FFCC00"];

const COLOR_NAMES: Record<string, string> = {
  "#007AFF": "蓝",
  "#34C759": "绿",
  "#FF9500": "橙",
  "#FF3B30": "红",
  "#FF2D55": "粉",
  "#AF52DE": "紫",
  "#5AC8FA": "青",
  "#FFCC00": "黄",
};

// 画布 8 色浅底（12%-20% 透明度），与课程卡同色描边配套
const COLOR_LIGHT: Record<string, string> = {
  "#007AFF": "rgba(0,122,255,0.12)",
  "#34C759": "rgba(52,199,89,0.14)",
  "#FF9500": "rgba(255,149,0,0.14)",
  "#FF3B30": "rgba(255,59,48,0.12)",
  "#FF2D55": "rgba(255,45,85,0.12)",
  "#AF52DE": "rgba(175,82,222,0.14)",
  "#5AC8FA": "rgba(90,200,250,0.18)",
  "#FFCC00": "rgba(255,204,0,0.20)",
};

const WEEKDAY_LABELS = ["日", "一", "二", "三", "四", "五", "六"];
const DAY_HEADERS = ["周一", "周二", "周三", "周四", "周五", "周六", "周日"];

const PERIODS = [
  { label: "第1-2节", start: "08:00", end: "09:40" },
  { label: "第3-4节", start: "10:00", end: "11:40" },
  { label: "第5-6节", start: "14:00", end: "15:40" },
  { label: "第7-8节", start: "16:00", end: "17:40" },
  { label: "第9-10节", start: "19:00", end: "20:40" },
];

const WEEKS = [
  { key: "last", label: "上周" },
  { key: "this", label: "本周" },
  { key: "next", label: "下周" },
] as const;

const inputStyle: {
  background: string;
  border: string;
  borderRadius: number;
  padding: string;
  fontSize: number;
  color: string;
  outline: string;
  width: string;
  boxSizing: "border-box";
} = {
  background: "var(--lifeflow-input)",
  border: "1px solid var(--lifeflow-border)",
  borderRadius: 10,
  padding: "12px",
  fontSize: 15,
  color: "var(--color-text-primary)",
  outline: "none",
  width: "100%",
  boxSizing: "border-box",
};

const fieldLabelStyle: { fontSize: number; fontWeight: number; color: string; marginTop: number } = {
  fontSize: 12,
  fontWeight: 600,
  color: "var(--color-text-secondary)",
  marginTop: 14,
};

/** 课程名缩写（画布规则：4 字取 1、3 位，其余取前 2 字） */
function abbrev(name: string): string {
  const n = String(name).trim();
  if (n.length === 4) return n.charAt(0) + n.charAt(2);
  return n.length <= 2 ? n : n.slice(0, 2);
}

/** 起课小时 → 节次行（0-4），与画布 periodIndexFromTime 一致 */
function periodIndexFromTime(t: string): number {
  const h = parseInt(String(t || "").split(":")[0], 10);
  if (isNaN(h)) return 0;
  if (h < 9) return 0;
  if (h < 12) return 1;
  if (h < 15) return 2;
  if (h < 17) return 3;
  return 4;
}

/** 星期（0=周日..6=周六）→ 网格列（周一=0..周日=6） */
function weekdayToCol(wd: number): number {
  return wd === 0 ? 6 : wd - 1;
}

/** 当前时刻所处节次（周末与课间演示兜底），与画布 currentPeriodIndex 一致 */
function currentPeriodIndex(): number {
  const d = new Date();
  const day = d.getDay();
  if (day === 0 || day === 6) return 1;
  const h = d.getHours();
  if (h >= 8 && h < 10) return 0;
  if (h >= 10 && h < 12) return 1;
  if (h >= 14 && h < 16) return 2;
  if (h >= 16 && h < 18) return 3;
  if (h >= 19 && h < 21) return 4;
  return 1;
}

function fmtDay(d: Date): string {
  return `${d.getMonth() + 1}月${d.getDate()}日`;
}

/** 当前周（周一为基准）± 7 天，得到所选周的起止日期 */
function getWeekRange(activeWeek: string): { start: Date; end: Date } {
  const now = new Date();
  const day = now.getDay();
  const monday = new Date(now.getFullYear(), now.getMonth(), now.getDate() - day + (day === 0 ? -6 : 1));
  monday.setDate(monday.getDate() + (activeWeek === "last" ? -7 : activeWeek === "next" ? 7 : 0));
  const end = new Date(monday);
  end.setDate(end.getDate() + 6);
  return { start: monday, end };
}

function colorLight(c: string): string {
  if (COLOR_LIGHT[c]) return COLOR_LIGHT[c];
  if (/^#[0-9a-fA-F]{6}$/.test(c)) return c + "24";
  return "transparent";
}

function colorName(c: string): string {
  return COLOR_NAMES[c] ?? "课";
}

export default function CoursesPage() {
  const router = useRouter();

  const courses = useLiveQuery(() => getCourses(), [], [] as Course[]);

  const [activeWeek, setActiveWeek] = useState("this");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [adding, setAdding] = useState(false);

  // 今日课程勾选（内存态，与画布 doneSet 一致；不写入 daylog.db）
  const [doneSet, setDoneSet] = useState<Record<string, boolean>>({});
  const [confirmDelete, setConfirmDelete] = useState(false);
  const confirmTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

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
    setConfirmDelete(false);
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
    setConfirmDelete(false);
  }, [populateForm]);

  const handleDelete = useCallback(async (id: string) => {
    await deleteCourse(id);
    showToast({ type: "success", message: "课程已删除" });
    setDoneSet((prev) => {
      if (!prev[id]) return prev;
      const next = { ...prev };
      delete next[id];
      return next;
    });
    if (editingId === id) resetForm();
  }, [editingId, resetForm]);

  /** 删除双段确认（画布：删除课程 → 确认删除？），确认后走原 handleDelete */
  const handleDeleteClick = useCallback(() => {
    if (!editingId) return;
    if (!confirmDelete) {
      setConfirmDelete(true);
      if (confirmTimer.current) clearTimeout(confirmTimer.current);
      confirmTimer.current = setTimeout(() => setConfirmDelete(false), 2600);
      return;
    }
    void handleDelete(editingId);
  }, [confirmDelete, editingId, handleDelete]);

  const toggleDone = useCallback((id: string) => {
    setDoneSet((prev) => {
      const next = { ...prev };
      if (next[id]) delete next[id];
      else next[id] = true;
      return next;
    });
  }, []);

  const openAdd = useCallback(() => {
    resetForm();
    setAdding(true);
  }, [resetForm]);

  useEffect(() => {
    return () => {
      if (confirmTimer.current) clearTimeout(confirmTimer.current);
    };
  }, []);

  // BottomSheet 打开时锁定页面滚动
  const showForm = adding || editingId !== null;
  useEffect(() => {
    if (!showForm) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [showForm]);

  // ── 派生数据 ──────────────────────────────────────────────
  const todayIdx = new Date().getDay();
  const curPeriod = currentPeriodIndex();
  const todayCol = weekdayToCol(todayIdx);

  const gridMap = new Map<string, Course[]>();
  const colorsUsed: string[] = [];
  let totalSlots = 0;
  (courses ?? []).forEach((c) => {
    if (!colorsUsed.includes(c.color)) colorsUsed.push(c.color);
    const p = periodIndexFromTime(c.startTime);
    c.weekday.forEach((wd) => {
      totalSlots++;
      const key = `${p}-${weekdayToCol(wd)}`;
      const arr = gridMap.get(key);
      if (arr) arr.push(c);
      else gridMap.set(key, [c]);
    });
  });

  const todayCourses = (courses ?? [])
    .filter((c) => c.weekday.includes(todayIdx))
    .sort((a, b) => a.startTime.localeCompare(b.startTime));

  const weekRange = getWeekRange(activeWeek);
  const weekTitle = activeWeek === "last" ? "上周课表" : activeWeek === "next" ? "下周课表" : "本周课表";
  const weekRangeLabel = `${fmtDay(weekRange.start)}-${fmtDay(weekRange.end)}`;
  const todayHint = `${fmtDay(new Date())} 周${WEEKDAY_LABELS[todayIdx]}`;

  return (
    <div className="pb-[100px]">
      <style>{`
        @keyframes lf-tt-in { from { opacity: 0; transform: translateY(4px); } to { opacity: 1; transform: translateY(0); } }
        .lf-in { animation: lf-tt-in 0.32s ease-out both; }
      `}</style>

      {/* Header */}
      <div className="flex items-center px-4 pt-[var(--safe-area-top)] pb-2">
        <button
          type="button"
          onClick={() => router.push("/more")}
          aria-label="返回更多"
          className="flex h-9 w-9 items-center justify-center rounded-full"
          style={{
            background: "var(--color-surface-card)",
            boxShadow: "var(--shadow-card)",
          }}
        >
          <ChevronLeft className="h-5 w-5" style={{ color: "var(--color-text-primary)" }} />
        </button>
        <h1 className="text-title-nav flex-1 text-center" style={{ color: "var(--color-text-primary)" }}>
          课程表
        </h1>
        <div className="w-9" />
      </div>

      <div className="flex flex-col gap-3 px-4 pt-4">
        {/* 0 周切换 segmented（上周 / 本周 / 下周） */}
        <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}>
          <div className="flex gap-1 rounded-[12px] p-1" style={{ background: "var(--lifeflow-muted)" }}>
            {WEEKS.map((w) => {
              const on = activeWeek === w.key;
              return (
                <button
                  key={w.key}
                  type="button"
                  onClick={() => setActiveWeek(w.key)}
                  className="h-[34px] flex-1 rounded-[10px] text-[13px] transition-all"
                  style={{
                    background: on ? "var(--color-surface-card)" : "transparent",
                    color: on ? "var(--lifeflow-primary)" : "var(--color-text-secondary)",
                    fontWeight: on ? 600 : 500,
                    boxShadow: on ? "var(--shadow-card)" : "none",
                  }}
                >
                  {w.label}
                </button>
              );
            })}
          </div>
        </motion.div>

        {/* 1 周课程表网格 */}
        <motion.section
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.05 }}
          className="card-standard p-3.5"
        >
          <div className="flex items-center gap-2">
            <span
              className="flex h-[30px] w-[30px] flex-none items-center justify-center rounded-[10px]"
              style={{ background: colorLight(COLORS[0]), color: COLORS[0] }}
            >
              <GraduationCap className="h-[15px] w-[15px]" />
            </span>
            <div className="min-w-0 flex-1">
              <h2 className="text-[17px] font-bold leading-tight" style={{ color: "var(--color-text-primary)" }}>
                {weekTitle}
              </h2>
              <p className="mt-0.5 text-[11px]" style={{ color: "var(--color-text-disabled)" }}>
                {weekRangeLabel}
              </p>
            </div>
            <span
              className="whitespace-nowrap rounded-md px-2.5 py-1 text-[12px] font-semibold"
              style={{ background: "var(--lifeflow-brand-50)", color: "var(--lifeflow-primary)" }}
            >
              {totalSlots} 节
            </span>
          </div>

          {(courses ?? []).length === 0 ? (
            /* 空态：无任何课程 */
            <div className="flex flex-col items-center py-10 text-center">
              <span
                className="flex h-[52px] w-[52px] items-center justify-center rounded-full"
                style={{ background: colorLight(COLORS[0]), color: COLORS[0] }}
              >
                <BookOpen className="h-[26px] w-[26px]" />
              </span>
              <p className="mt-3 text-[15px] font-semibold" style={{ color: "var(--color-text-primary)" }}>
                这周还没有课程安排
              </p>
              <p className="mt-1 text-[12px]" style={{ color: "var(--color-text-disabled)" }}>
                点击下方按钮，添加第一门课
              </p>
              <button
                type="button"
                onClick={openAdd}
                className="mt-3.5 inline-flex h-[42px] items-center gap-1.5 rounded-full px-5 text-[14px] font-semibold"
                style={{ background: "var(--lifeflow-primary)", color: "var(--lifeflow-primary-foreground)" }}
              >
                <Plus className="h-4 w-4" />
                添加课程
              </button>
            </div>
          ) : (
            <>
              {/* 7 日列 × 5 节次行网格 */}
              <div
                key={activeWeek}
                className="mt-2.5 grid"
                style={{ gridTemplateColumns: "44px repeat(7, minmax(0, 1fr))", gap: 3 }}
              >
                <div />
                {DAY_HEADERS.map((label, i) => (
                  <div
                    key={label}
                    className="whitespace-nowrap text-center leading-[1.2]"
                    style={{
                      fontSize: 11,
                      fontWeight: i === todayCol ? 700 : 600,
                      color: i === todayCol ? "var(--lifeflow-primary)" : "var(--color-text-secondary)",
                      padding: "4px 0 6px",
                    }}
                  >
                    {label}
                  </div>
                ))}

                {PERIODS.map((pd, pi) => {
                  const isNow = pi === curPeriod;
                  return (
                    <div key={pd.label} style={{ display: "contents" }}>
                      {/* 节次时间列 */}
                      <div
                        className="flex flex-col items-center justify-center gap-[2px] rounded-md"
                        style={{
                          padding: "2px 0",
                          background: isNow ? "var(--lifeflow-brand-50)" : "transparent",
                        }}
                      >
                        <span
                          className="whitespace-nowrap leading-[1.2]"
                          style={{
                            fontSize: 8.5,
                            fontWeight: 600,
                            color: isNow ? "var(--lifeflow-primary)" : "var(--color-text-secondary)",
                          }}
                        >
                          {pd.label}
                        </span>
                        <span className="leading-[1.25]" style={{ fontSize: 8.5, color: "var(--color-text-disabled)" }}>
                          {pd.start}
                        </span>
                        <span className="leading-[1.25]" style={{ fontSize: 8.5, color: "var(--color-text-disabled)" }}>
                          {pd.end}
                        </span>
                      </div>

                      {/* 7 日课程格 */}
                      {DAY_HEADERS.map((_, col) => {
                        const list = gridMap.get(`${pi}-${col}`) ?? [];
                        const isNowCell = isNow && col === todayCol;
                        return (
                          <div
                            key={col}
                            className="flex flex-col gap-[2px] rounded-md"
                            style={{
                              minHeight: 42,
                              padding: 2,
                              background: isNowCell ? "var(--lifeflow-muted)" : "transparent",
                            }}
                          >
                            {list.map((c, ci) => {
                              const isNowCard = isNowCell;
                              const delay = ((pi * 7 + col) * 3 + ci * 6) * 0.01;
                              return (
                                <button
                                  key={c.id}
                                  type="button"
                                  onClick={() => handleEdit(c)}
                                  aria-label={`编辑课程：${c.name}`}
                                  className="lf-in flex w-full min-h-[36px] flex-col items-center justify-center gap-[1px] overflow-hidden rounded-md text-center"
                                  style={{
                                    border: `1px solid ${c.color}`,
                                    background: colorLight(c.color),
                                    color: c.color,
                                    cursor: "pointer",
                                    padding: "2px 4px",
                                    boxSizing: "border-box",
                                    animationDelay: `${delay}s`,
                                    outline: isNowCard ? "1.5px solid var(--lifeflow-primary)" : "none",
                                    outlineOffset: "-1px",
                                  }}
                                >
                                  <span
                                    className="max-w-full overflow-hidden text-ellipsis whitespace-nowrap leading-[1.2]"
                                    style={{
                                      fontSize: 10,
                                      fontWeight: 600,
                                      color: isNowCard ? "var(--lifeflow-primary)" : c.color,
                                    }}
                                  >
                                    {abbrev(c.name)}
                                  </span>
                                  {c.location && (
                                    <span
                                      className="max-w-full overflow-hidden text-ellipsis whitespace-nowrap leading-[1.3]"
                                      style={{ fontSize: 8, opacity: 0.9 }}
                                    >
                                      {c.location}
                                    </span>
                                  )}
                                </button>
                              );
                            })}
                          </div>
                        );
                      })}
                    </div>
                  );
                })}
              </div>

              {/* 课程色图例 */}
              <div className="mt-2.5 flex flex-wrap gap-x-3 gap-y-1 px-0.5">
                {colorsUsed.map((c) => (
                  <span
                    key={c}
                    className="inline-flex items-center gap-1.5 text-[10px] leading-[1.2]"
                    style={{ color: "var(--color-text-disabled)" }}
                  >
                    <span className="h-[6px] w-[6px] flex-none rounded-full" style={{ background: c }} />
                    {colorName(c)}
                  </span>
                ))}
              </div>
            </>
          )}
        </motion.section>

        {/* 2 今日课程卡 */}
        <motion.section
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="card-standard p-4"
        >
          <div className="flex items-center gap-2">
            <span
              className="flex h-[30px] w-[30px] flex-none items-center justify-center rounded-[10px]"
              style={{ background: colorLight(COLORS[0]), color: COLORS[0] }}
            >
              <BookOpen className="h-[15px] w-[15px]" />
            </span>
            <div className="min-w-0 flex-1">
              <h2 className="text-[17px] font-bold leading-tight" style={{ color: "var(--color-text-primary)" }}>
                今日课程
              </h2>
              <p className="mt-0.5 text-[11px]" style={{ color: "var(--color-text-disabled)" }}>
                {todayHint}
              </p>
            </div>
            <span
              className="whitespace-nowrap rounded-md px-2.5 py-1 text-[12px] font-semibold"
              style={{ background: "var(--lifeflow-brand-50)", color: "var(--lifeflow-primary)" }}
            >
              {todayCourses.length} 节
            </span>
          </div>

          {todayCourses.length === 0 ? (
            <div className="flex flex-col items-center py-8 text-center">
              <span
                className="flex h-[52px] w-[52px] items-center justify-center rounded-full"
                style={{ background: colorLight(COLORS[0]), color: COLORS[0] }}
              >
                <BookOpen className="h-[26px] w-[26px]" />
              </span>
              <p className="mt-3 text-[15px] font-semibold" style={{ color: "var(--color-text-primary)" }}>
                今天还没有课程安排
              </p>
              <p className="mt-1 text-[12px]" style={{ color: "var(--color-text-disabled)" }}>
                享受没有课的轻松一天吧
              </p>
            </div>
          ) : (
            <div className="mt-3 flex flex-col gap-2">
              {todayCourses.map((c, i) => {
                const isDone = !!doneSet[c.id];
                const isCurrent = periodIndexFromTime(c.startTime) === curPeriod;
                return (
                  <div
                    key={c.id}
                    onClick={() => handleEdit(c)}
                    className="lf-in flex cursor-pointer items-center gap-2.5 rounded-[12px] border p-2.5"
                    style={{
                      borderColor: "var(--lifeflow-border)",
                      background: "var(--lifeflow-muted)",
                      opacity: isDone ? 0.72 : 1,
                      animationDelay: `${i * 0.05}s`,
                    }}
                  >
                    <button
                      type="button"
                      onClick={(e) => { e.stopPropagation(); toggleDone(c.id); }}
                      aria-label={isDone ? `取消完成：${c.name}` : `标记完成：${c.name}`}
                      className="flex h-6 w-6 flex-none items-center justify-center rounded-full"
                      style={{
                        border: `1.5px ${isDone ? "solid" : "dashed"} ${isDone ? "var(--color-income)" : "var(--lifeflow-border)"}`,
                        background: isDone ? "var(--color-income)" : "transparent",
                      }}
                    >
                      <Check className="h-3.5 w-3.5" style={{ color: "var(--color-text-inverse)", opacity: isDone ? 1 : 0 }} />
                    </button>
                    <span
                      className="flex h-[34px] w-[34px] flex-none items-center justify-center rounded-[10px]"
                      style={{ background: colorLight(c.color), color: c.color, opacity: isDone ? 0.55 : 1 }}
                    >
                      <BookOpen className="h-4 w-4" />
                    </span>
                    <div className="min-w-0 flex-1">
                      <p
                        className="truncate text-[14px] font-semibold leading-[1.3]"
                        style={{
                          color: isDone ? "var(--color-text-secondary)" : "var(--color-text-primary)",
                          textDecoration: isDone ? "line-through" : "none",
                          textDecorationColor: "var(--lifeflow-border)",
                        }}
                      >
                        {c.name}
                      </p>
                      <div className="mt-[3px] flex min-w-0 items-center gap-1.5">
                        {c.location && (
                          <span className="flex items-center gap-[3px] truncate text-[11px] whitespace-nowrap" style={{ color: "var(--color-text-disabled)" }}>
                            <MapPin className="h-2.5 w-2.5 flex-none" />
                            {c.location}
                          </span>
                        )}
                        {isCurrent && (
                          <span
                            className="flex-none rounded-md px-1.5 py-[2px] text-[11px] font-semibold leading-[1.4] whitespace-nowrap"
                            style={{ background: "var(--lifeflow-brand-50)", color: "var(--lifeflow-primary)" }}
                          >
                            进行中
                          </span>
                        )}
                      </div>
                    </div>
                    <div className="flex flex-none flex-col items-end gap-1.5">
                      <span className="flex items-center gap-1 text-[11px] leading-[1.2] whitespace-nowrap" style={{ color: "var(--color-text-secondary)" }}>
                        <Clock className="h-3 w-3 flex-none" />
                        {c.startTime}-{c.endTime}
                      </span>
                      <button
                        type="button"
                        onClick={(e) => { e.stopPropagation(); handleEdit(c); }}
                        aria-label={`编辑课程：${c.name}`}
                        className="flex h-7 w-7 items-center justify-center rounded-full"
                        style={{ color: "var(--color-text-disabled)" }}
                      >
                        <Pencil className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </motion.section>
      </div>

      {/* 3 添加课程 FAB */}
      <button
        type="button"
        onClick={openAdd}
        aria-label="添加课程"
        className="fixed right-4 z-40 flex h-[52px] w-[52px] items-center justify-center rounded-full"
        style={{
          background: "var(--lifeflow-primary)",
          color: "var(--lifeflow-primary-foreground)",
          boxShadow: "var(--shadow-card-elevated)",
          bottom: "calc(20px + env(safe-area-inset-bottom))",
        }}
      >
        <Plus className="h-6 w-6" />
      </button>

      {/* 4 添加 / 编辑 BottomSheet */}
      <AnimatePresence>
        {showForm && (
          <div key="sheet-wrap">
            <motion.div
              key="scrim"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.25 }}
              onClick={resetForm}
              className="fixed inset-0 z-[60]"
              style={{ background: "rgba(15,17,21,0.42)" }}
            />
            <motion.div
              key="sheet"
              initial={{ y: "105%" }}
              animate={{ y: 0 }}
              exit={{ y: "105%" }}
              transition={{ type: "tween", duration: 0.3, ease: [0.32, 0.72, 0, 1] }}
              className="fixed bottom-0 left-0 right-0 z-[61] mx-auto w-full max-w-md"
            >
              <div
                className="flex max-h-[88vh] flex-col rounded-t-[16px]"
                style={{ background: "var(--lifeflow-popover)", boxShadow: "var(--shadow-modal)" }}
              >
                <div className="flex-none px-4 pt-3">
                  <div className="mx-auto mb-3 h-1 w-9 rounded-full" style={{ background: "var(--lifeflow-border)" }} />
                  <span
                    className="mx-auto mb-2 flex h-9 w-9 items-center justify-center rounded-full"
                    style={{ background: colorLight(COLORS[0]), color: COLORS[0] }}
                  >
                    <Pencil className="h-4 w-4" />
                  </span>
                  <h3 className="text-center text-[17px] font-bold" style={{ color: "var(--color-text-primary)", letterSpacing: "-0.01em" }}>
                    {editingId ? "编辑课程" : "添加课程"}
                  </h3>
                  <p className="mt-1 text-center text-[12px]" style={{ color: "var(--color-text-disabled)" }}>
                    {editingId ? "修改后保存，或删除这门课" : "上课日可多选 · 周数范围可选"}
                  </p>
                </div>

                <div className="min-h-0 flex-1 overflow-y-auto px-4 pb-1">
                  <input
                    type="text"
                    value={formName}
                    onChange={(e) => setFormName(e.target.value)}
                    placeholder="课程名称，如 高等数学"
                    maxLength={20}
                    autoFocus
                    className="mt-3.5"
                    style={inputStyle}
                  />
                  <p style={fieldLabelStyle}>上课日 · 可多选</p>
                  <div className="mt-2 flex flex-wrap gap-2">
                    {WEEKDAY_LABELS.map((label, idx) => {
                      const selected = formWeekday.includes(idx);
                      return (
                        <button
                          key={idx}
                          type="button"
                          onClick={() => toggleWeekday(idx)}
                          aria-pressed={selected}
                          className="rounded-full px-3.5 py-[7px] text-[12px] leading-[1.2]"
                          style={{
                            border: `1px solid ${selected ? "var(--lifeflow-primary)" : "var(--lifeflow-border)"}`,
                            background: selected ? "var(--lifeflow-brand-50)" : "var(--color-surface-card)",
                            color: selected ? "var(--lifeflow-primary)" : "var(--color-text-secondary)",
                            fontWeight: selected ? 600 : 500,
                          }}
                        >
                          {idx === 0 ? "周日" : `周${label}`}
                        </button>
                      );
                    })}
                  </div>
                  <p style={fieldLabelStyle}>上课时间</p>
                  <div className="mt-2 flex items-center gap-2">
                    <input type="time" value={formStartTime} onChange={(e) => setFormStartTime(e.target.value)} className="min-w-0 flex-1" style={inputStyle} />
                    <span className="flex-none text-[12px]" style={{ color: "var(--color-text-disabled)" }}>至</span>
                    <input type="time" value={formEndTime} onChange={(e) => setFormEndTime(e.target.value)} className="min-w-0 flex-1" style={inputStyle} />
                  </div>
                  <input
                    type="text"
                    value={formLocation}
                    onChange={(e) => setFormLocation(e.target.value)}
                    placeholder="上课地点，如 教学楼A201"
                    maxLength={20}
                    className="mt-3.5"
                    style={inputStyle}
                  />
                  <p style={fieldLabelStyle}>课程颜色</p>
                  <div className="mt-2 flex flex-wrap gap-2">
                    {COLORS.map((c) => {
                      const selected = formColor === c;
                      return (
                        <button
                          key={c}
                          type="button"
                          onClick={() => setFormColor(c)}
                          aria-pressed={selected}
                          className="inline-flex items-center gap-1.5 rounded-full px-3 py-[7px] text-[12px] leading-[1.2]"
                          style={{
                            border: `1px solid ${selected ? c : "var(--lifeflow-border)"}`,
                            background: selected ? colorLight(c) : "var(--color-surface-card)",
                            color: selected ? c : "var(--color-text-secondary)",
                            fontWeight: selected ? 600 : 500,
                          }}
                        >
                          <span className="h-2 w-2 flex-none rounded-full" style={{ background: c }} />
                          {colorName(c)}
                        </button>
                      );
                    })}
                  </div>
                  <p style={fieldLabelStyle}>起始周 - 结束周（可选）</p>
                  <div className="mt-2 flex items-center gap-2">
                    <input
                      type="number"
                      value={formWeeksStart}
                      onChange={(e) => setFormWeeksStart(e.target.value)}
                      placeholder="第 1 周"
                      min={1}
                      max={18}
                      className="min-w-0 flex-1"
                      style={inputStyle}
                    />
                    <span className="flex-none text-[12px]" style={{ color: "var(--color-text-disabled)" }}>至</span>
                    <input
                      type="number"
                      value={formWeeksEnd}
                      onChange={(e) => setFormWeeksEnd(e.target.value)}
                      placeholder="第 18 周"
                      min={1}
                      max={18}
                      className="min-w-0 flex-1"
                      style={inputStyle}
                    />
                  </div>
                  <p className="mt-1 text-[11px]" style={{ color: "var(--color-text-disabled)" }}>
                    第 1-18 周，不填则每周都上
                  </p>
                </div>

                <div
                  className="flex flex-none gap-2.5 px-4 pt-4"
                  style={{ paddingBottom: "calc(18px + env(safe-area-inset-bottom))" }}
                >
                  {editingId && (
                    <button
                      type="button"
                      onClick={handleDeleteClick}
                      className="inline-flex h-[46px] flex-none items-center gap-1.5 rounded-[10px] px-4 text-[15px] font-semibold"
                      style={
                        confirmDelete
                          ? { background: "var(--color-expense)", color: "var(--color-text-inverse)" }
                          : { background: "rgba(255,59,48,0.12)", color: "var(--color-expense)" }
                      }
                    >
                      <Trash2 className="h-4 w-4" />
                      {confirmDelete ? "确认删除？" : "删除课程"}
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={resetForm}
                    className="h-[46px] flex-1 rounded-[10px] text-[15px] font-semibold"
                    style={{ background: "var(--lifeflow-muted)", color: "var(--color-text-primary)" }}
                  >
                    取消
                  </button>
                  <button
                    type="button"
                    onClick={handleSave}
                    className="h-[46px] flex-1 rounded-[10px] text-[15px] font-semibold"
                    style={{ background: "var(--lifeflow-primary)", color: "var(--lifeflow-primary-foreground)" }}
                  >
                    保存
                  </button>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
