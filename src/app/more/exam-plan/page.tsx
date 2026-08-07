"use client";

import { useState, useEffect, useMemo, useCallback } from "react";
import { useRouter } from "next/navigation";
import { useLiveQuery } from "dexie-react-hooks";
import { ChevronLeft, BookOpen, Check, GraduationCap, CalendarDays, Flame, Loader2 } from "lucide-react";
import {
  getExamLessons, getProgressMap, toggleLesson, computeTodayTasks,
  computeOverview, currentCet4Stage, currentProvinceSubject, todayStrOf,
  DAILY_QUOTA, type TodayTask, type ExamOverview,
} from "@/lib/exam-plan";
import { showToast } from "@/components/ui/Toast";

// ─── 工具 ────────────────────────────────────────────────────

function fmtHours(minutes: number): string {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  if (h === 0) return `${m} 分钟`;
  if (m === 0) return `${h} 小时`;
  return `${h} 小时 ${m} 分`;
}

function isWeekend(dateStr: string): boolean {
  const d = new Date(dateStr + "T00:00:00").getDay();
  return d === 0 || d === 6;
}

// ─── 进度条 ──────────────────────────────────────────────────

function ProgressBar({ pct, color }: { pct: number; color: string }) {
  return (
    <div className="w-full h-[8px] rounded-full overflow-hidden" style={{ background: "var(--lifeflow-border)" }}>
      <div className="h-full rounded-full transition-all duration-500"
        style={{ width: `${Math.min(100, pct)}%`, background: color }} />
    </div>
  );
}

// ─── 考试计划卡片 ────────────────────────────────────────────

function PlanCard({ overview, accent }: { overview: ExamOverview; accent: string }) {
  const pct = overview.totalMinutes > 0 ? (overview.doneMinutes / overview.totalMinutes) * 100 : 0;
  return (
    <div className="rounded-[20px] p-5" style={{ background: "var(--color-surface-card)", boxShadow: "var(--shadow-card)" }}>
      <div className="flex items-center justify-between">
        <p className="text-[16px] font-semibold" style={{ color: "var(--color-text-primary)" }}>{overview.planName}</p>
        <span className="text-[12px] font-medium px-2 py-0.5 rounded-full"
          style={{ color: overview.onTrack ? "#34C759" : "#FF3B30", background: overview.onTrack ? "rgba(52,199,89,0.12)" : "rgba(255,59,48,0.12)" }}>
          {overview.onTrack ? "进度正常" : "进度告急"}
        </span>
      </div>

      <div className="mt-3">
        <ProgressBar pct={pct} color={accent} />
        <div className="flex items-center justify-between mt-2">
          <span className="text-[12px]" style={{ color: "var(--color-text-secondary)" }}>
            完成 {overview.doneLessons}/{overview.totalLessons} 课时 · {fmtHours(overview.doneMinutes)}/{fmtHours(overview.totalMinutes)}
          </span>
          <span className="text-[12px] font-medium" style={{ color: accent }}>{pct.toFixed(0)}%</span>
        </div>
      </div>

      <div className="flex items-center justify-between mt-3 pt-3" style={{ borderTop: "1px solid var(--lifeflow-border)" }}>
        <div className="flex items-center gap-1.5">
          <CalendarDays className="w-3.5 h-3.5" style={{ color: "var(--color-text-secondary)" }} />
          <span className="text-[12px]" style={{ color: "var(--color-text-secondary)" }}>
            {overview.remainingDays} 天后
          </span>
        </div>
        <span className="text-[12px] font-medium" style={{ color: overview.onTrack ? "#34C759" : "#FF3B30" }}>
          还需 {fmtHours(overview.remainingMinutes)} · {overview.needPerDay}分钟/天
        </span>
      </div>
    </div>
  );
}

// ─── 今日任务行 ──────────────────────────────────────────────

function TaskRow({ task, onToggle }: { task: TodayTask; onToggle: (id: string, done: boolean) => void }) {
  const done = task.type === "review" ? task.done : task.done;
  return (
    <button type="button" onClick={() => task.lessonId && onToggle(task.lessonId, !task.done)}
      className="w-full flex items-center gap-3 px-4 py-3 text-left"
      style={{ opacity: done ? 0.5 : 1 }}>
      <div className={`w-[22px] h-[22px] rounded-full border-2 flex items-center justify-center shrink-0 transition-colors`}
        style={{
          borderColor: task.planId === "province" ? "#6366F1" : "#10B981",
          background: done ? (task.planId === "province" ? "#6366F1" : "#10B981") : "transparent",
        }}>
        {done && <Check className="w-3.5 h-3.5 text-white" />}
      </div>
      <div className="min-w-0 flex-1">
        <p className="text-[14px] font-medium truncate" style={{ color: "var(--color-text-primary)", textDecoration: done ? "line-through" : "none" }}>
          {task.subject ? `${task.subject} · ` : ""}{task.name}
        </p>
        <p className="text-[11px] mt-0.5" style={{ color: "var(--color-text-secondary)" }}>
          {task.planId === "province" ? "省考" : "四级"} · {task.stageName} · {fmtHours(task.minutes)}
        </p>
      </div>
    </button>
  );
}

// ─── 主页面 ──────────────────────────────────────────────────

export default function ExamPlanPage() {
  const router = useRouter();
  const lessons = useMemo(() => getExamLessons(), []);
  const [today, setToday] = useState("");
  const [loaded, setLoaded] = useState(false);

  useEffect(() => { setToday(todayStrOf()); setLoaded(true); }, []);

  // 进度实时联动（打勾后自动刷新）
  const progress = useLiveQuery(
    () => getProgressMap(),
    [],
    new Map<string, boolean>(),
  );

  const handleToggle = useCallback(async (id: string, done: boolean) => {
    await toggleLesson(id, done);
    showToast({ type: "success", message: done ? "已完成 ✓" : "已撤销" });
  }, []);

  const provinceOverview = useMemo(
    () => (loaded ? computeOverview(lessons, progress, "province", today) : null),
    [lessons, progress, today, loaded],
  );
  const cet4Overview = useMemo(
    () => (loaded ? computeOverview(lessons, progress, "cet4", today) : null),
    [lessons, progress, today, loaded],
  );
  const todayTasks = useMemo(
    () => (loaded ? computeTodayTasks(lessons, progress, today) : []),
    [lessons, progress, today, loaded],
  );

  const provinceTasks = todayTasks.filter((t) => t.planId === "province");
  const cet4Tasks = todayTasks.filter((t) => t.planId === "cet4");
  const curSubject = currentProvinceSubject(lessons, progress);
  const curStage = currentCet4Stage(lessons, progress);

  if (!loaded) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ background: "var(--lifeflow-background)" }}>
        <Loader2 className="w-6 h-6 animate-spin" style={{ color: "var(--lifeflow-primary)" }} />
      </div>
    );
  }

  return (
    <div className="min-h-screen max-w-[430px] mx-auto pb-[100px]" style={{ background: "var(--lifeflow-background)" }}>
      {/* Header */}
      <div className="flex items-center justify-center h-[44px] px-4 pt-[var(--safe-area-top)] relative">
        <button type="button" onClick={() => router.back()} className="absolute left-4 top-[calc(var(--safe-area-top)+4px)] p-1" aria-label="返回">
          <ChevronLeft className="w-6 h-6" style={{ color: "var(--lifeflow-primary)" }} />
        </button>
        <h1 className="text-title-nav" style={{ color: "var(--color-text-primary)" }}>备考计划</h1>
      </div>

      {/* 双考试进度 */}
      <div className="px-4 pt-6 pb-2 space-y-3">
        {provinceOverview && <PlanCard overview={provinceOverview} accent="#6366F1" />}
        {cet4Overview && <PlanCard overview={cet4Overview} accent="#10B981" />}
      </div>

      {/* 当前状态 */}
      <div className="px-4 pt-4">
        <div className="rounded-[16px] px-4 py-3 flex items-center gap-3"
          style={{ background: "var(--color-surface-card)", boxShadow: "var(--shadow-card)" }}>
          <Flame className="w-5 h-5 shrink-0" style={{ color: "#F97316" }} />
          <p className="text-[13px] leading-relaxed" style={{ color: "var(--color-text-primary)" }}>
            {curSubject ? <>省考：正在学 <b style={{ color: "#6366F1" }}>{curSubject}</b></> : <>省考精讲精练已全部完成 🎉</>}
            {" · "}
            {curStage ? <>四级：<b style={{ color: "#10B981" }}>{curStage.stageName}</b></> : <>四级全部完成 🎉</>}
          </p>
        </div>
      </div>

      {/* 今日学习任务 */}
      <div className="px-4 pt-5">
        <p className="text-[13px] font-medium px-5 pt-2 pb-2" style={{ color: "var(--color-text-secondary)" }}>
          今日学习清单（{today}）
        </p>

        <div className="rounded-[20px] overflow-hidden" style={{ background: "var(--color-surface-card)", boxShadow: "var(--shadow-card)" }}>
          <div className="flex items-center gap-2 px-5 pt-4 pb-2">
            <GraduationCap className="w-4 h-4" style={{ color: "#6366F1" }} />
            <span className="text-[13px] font-semibold" style={{ color: "var(--color-text-primary)" }}>省考（目标 {fmtHours(DAILY_QUOTA.province)}/天）</span>
            <span className="ml-auto text-[12px]" style={{ color: "var(--color-text-secondary)" }}>
              今日安排 {provinceTasks.reduce((s, t) => s + t.minutes, 0)} 分钟
            </span>
          </div>
          <div className="h-px mx-5" style={{ background: "var(--lifeflow-border)" }} />
          {provinceTasks.length === 0 ? (
            <p className="px-5 py-6 text-center text-[13px]" style={{ color: "var(--color-text-secondary)" }}>省考精讲精练已完成 ✅</p>
          ) : (
            provinceTasks.map((t, i) => (
              <div key={t.lessonId} className={i > 0 ? "" : ""}>
                {i > 0 && <div className="h-px" style={{ background: "var(--lifeflow-border)", marginLeft: "52px" }} />}
                <TaskRow task={{ ...t, done: progress.get(t.lessonId!) ?? false }} onToggle={handleToggle} />
              </div>
            ))
          )}
        </div>

        <div className="rounded-[20px] overflow-hidden mt-3" style={{ background: "var(--color-surface-card)", boxShadow: "var(--shadow-card)" }}>
          <div className="flex items-center gap-2 px-5 pt-4 pb-2">
            <BookOpen className="w-4 h-4" style={{ color: "#10B981" }} />
            <span className="text-[13px] font-semibold" style={{ color: "var(--color-text-primary)" }}>
              四级（目标 {fmtHours(DAILY_QUOTA.cet4)}/天 · {isWeekend(today) ? "周末复习" : "刷视频"})
            </span>
          </div>
          <div className="h-px mx-5" style={{ background: "var(--lifeflow-border)" }} />
          {cet4Tasks.length === 0 ? (
            <p className="px-5 py-6 text-center text-[13px]" style={{ color: "var(--color-text-secondary)" }}>四级全部完成 ✅</p>
          ) : (
            cet4Tasks.map((t, i) => (
              <div key={t.lessonId ?? t.name}>
                {i > 0 && <div className="h-px" style={{ background: "var(--lifeflow-border)", marginLeft: "52px" }} />}
                <TaskRow task={t} onToggle={handleToggle} />
              </div>
            ))
          )}
        </div>
      </div>

      <p className="px-6 pt-4 text-[11px] leading-relaxed" style={{ color: "var(--color-text-disabled)" }}>
        规则：省考按 判断→政治→申论→言语→资料→数量 顺序学完（每天约 {fmtHours(DAILY_QUOTA.province)}）；
        四级周一至五刷视频、周六日复习，阶段顺序推进不跳段。完成课时自动计入进度。
      </p>
    </div>
  );
}
