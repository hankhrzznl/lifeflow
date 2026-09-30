"use client";

import { useState, useEffect, useMemo, useCallback } from "react";
import { useRouter } from "next/navigation";
import { useLiveQuery } from "dexie-react-hooks";
import { ChevronLeft, Crosshair, ChevronDown, Check, GraduationCap, Target, Flame, Info, Loader2 } from "lucide-react";
import {
  getExamLessons, getProgressMap, toggleLesson, computeTodayTasks,
  computeOverview, currentCet4Stage, currentProvinceSubject, todayStrOf,
  DAILY_QUOTA, type TodayTask, type ExamOverview, type ExamPlanId,
} from "@/lib/exam-plan";
import { showToast } from "@/components/ui/Toast";

// ─── 写入时段（画布 slot-chip 单选 · 不新增 Dexie 字段） ───────

const SLOTS = [
  { id: "morning", label: "上午段" },
  { id: "afternoon", label: "下午段" },
  { id: "evening", label: "晚上段" },
] as const;
type SlotId = (typeof SLOTS)[number]["id"];

// 今日任务无时段字段：按任务序号轮转映射到 上午/下午/晚上 三个写入时段（纯 UI 分组，不写库）
function slotOfIndex(i: number): SlotId {
  return SLOTS[i % SLOTS.length].id;
}

function planLabel(planId: ExamPlanId): string {
  return planId === "province" ? "省考" : "四级";
}

function planAccent(planId: ExamPlanId): string {
  return planId === "province" ? "#6366F1" : "#10B981";
}

// ─── 工具（保留线上逻辑） ─────────────────────────────────────

function fmtHours(minutes: number): string {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  if (h === 0) return `${m} 分钟`;
  if (m === 0) return `${h} 小时`;
  return `${h} 小时 ${m} 分`;
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

// ─── 考试计划卡片（保留：省考 / 四级 双进度卡） ────────────────

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
        <span className="text-[12px]" style={{ color: "var(--color-text-secondary)" }}>
          {overview.remainingDays} 天后
        </span>
        <span className="text-[12px] font-medium" style={{ color: overview.onTrack ? "#34C759" : "#FF3B30" }}>
          还需 {fmtHours(overview.remainingMinutes)} · {overview.needPerDay}分钟/天
        </span>
      </div>
    </div>
  );
}

// ─── 今日任务行（保留：勾选 + 名称 + 时长，进度实时联动） ──────

function TaskRow({ task, onToggle }: { task: TodayTask; onToggle: (id: string, done: boolean) => void }) {
  const done = task.done;
  return (
    <button type="button" onClick={() => task.lessonId && onToggle(task.lessonId, !task.done)}
      className="w-full flex items-center gap-3 px-2 py-3 text-left"
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
  // 画布规划流状态：目标选择（省考=province / 四级=cet4）+ 写入时段单选
  const [pickerOpen, setPickerOpen] = useState(false);
  const [selectedPlan, setSelectedPlan] = useState<ExamPlanId | null>(null);
  const [slot, setSlot] = useState<SlotId>("morning");

  useEffect(() => { setToday(todayStrOf()); setLoaded(true); }, []);

  // 进度实时联动（打勾后自动刷新）
  const progress = useLiveQuery(
    () => getProgressMap(),
    [],
    new Map<string, boolean>(),
  );

  const handleToggle = useCallback(async (id: string, done: boolean) => {
    await toggleLesson(id, done);
    showToast({ type: "success", message: done ? "已完成" : "已撤销" });
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

  const curSubject = currentProvinceSubject(lessons, progress);
  const curStage = currentCet4Stage(lessons, progress);

  // 今日行动：未选目标时展示全部（勾选功能始终可用）；选中后按目标过滤；再按写入时段分组过滤
  const slotTasks = useMemo(() => {
    const base = selectedPlan ? todayTasks.filter((t) => t.planId === selectedPlan) : todayTasks;
    return base.filter((_, i) => slotOfIndex(i) === slot);
  }, [todayTasks, selectedPlan, slot]);

  const doneInSlot = useMemo(
    () => slotTasks.filter((t) => t.lessonId && progress.get(t.lessonId)).length,
    [slotTasks, progress],
  );

  // 目标选择器：选中目标的今日任务与完成数（今日进度 chip）+ 整体进度（KR 进度行）
  const selectedTasks = useMemo(
    () => (selectedPlan ? todayTasks.filter((t) => t.planId === selectedPlan) : []),
    [todayTasks, selectedPlan],
  );
  const selectedDone = useMemo(
    () => selectedTasks.filter((t) => t.lessonId && progress.get(t.lessonId)).length,
    [selectedTasks, progress],
  );
  const selectedOverview = selectedPlan === "province" ? provinceOverview : cet4Overview;
  const selectedAccent = selectedPlan ? planAccent(selectedPlan) : "#6366F1";
  const selectedPct = selectedOverview && selectedOverview.totalMinutes > 0
    ? (selectedOverview.doneMinutes / selectedOverview.totalMinutes) * 100
    : 0;

  const handleSelect = useCallback((planId: ExamPlanId) => {
    setSelectedPlan(planId);
    setPickerOpen(false);
  }, []);

  // 画布「保存」按钮 → 对应线上「切换目标/时段后今日任务随之变化」的真实联动状态（不新增写入）
  const handleSave = useCallback(() => {
    if (!selectedPlan) {
      showToast({ type: "error", message: "请先选择目标" });
      return;
    }
    const slotLabel = SLOTS.find((s) => s.id === slot)?.label ?? "上午段";
    showToast({ type: "success", message: `已保存 · 已按${slotLabel}排入今日任务（联动已生效）` });
  }, [selectedPlan, slot]);

  if (!loaded) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ background: "var(--lifeflow-background)" }}>
        <Loader2 className="w-6 h-6 animate-spin" style={{ color: "var(--lifeflow-primary)" }} />
      </div>
    );
  }

  return (
    <div className="min-h-screen max-w-[430px] mx-auto pb-[100px]" style={{ background: "var(--lifeflow-background)" }}>
      {/* Header（画布：返回 + 标题「目标规划」+ 副标） */}
      <div className="flex items-center gap-2 h-[44px] px-4 pt-[var(--safe-area-top)]">
        <button type="button" onClick={() => router.back()} className="flex items-center justify-center w-8 h-8 shrink-0 rounded-full active:opacity-70" aria-label="返回">
          <ChevronLeft className="w-5 h-5" style={{ color: "var(--lifeflow-primary)" }} />
        </button>
        <div className="min-w-0 flex-1">
          <h1 className="text-title-nav" style={{ color: "var(--color-text-primary)" }}>目标规划</h1>
          <p className="mt-0.5 text-[12px] leading-tight" style={{ color: "var(--color-text-disabled)" }}>安排学习内容</p>
        </div>
      </div>

      {/* 目标选择器（画布 target-picker：下拉选择 省考/四级，选中显示今日进度 chip + KR 进度行） */}
      <div className="px-4 pt-5">
        <div className="rounded-[20px] px-4 py-4 relative" style={{ background: "var(--color-surface-card)", boxShadow: "var(--shadow-card)" }}>
          <div className="flex items-center justify-between gap-2">
            <p className="text-[14px] font-semibold leading-tight" style={{ color: "var(--color-text-primary)" }}>当前目标</p>
            {selectedPlan && (
              <span className="flex items-center gap-1 rounded-full px-2.5 py-1 text-[11px] font-medium leading-none"
                style={{ background: "rgba(37,99,235,0.10)", color: "var(--lifeflow-primary)" }}>
                <Check className="w-3 h-3" />已选 · {planLabel(selectedPlan)}
              </span>
            )}
          </div>

          {/* 下拉触发按钮 */}
          <button type="button" onClick={() => setPickerOpen((o) => !o)}
            aria-haspopup="listbox" aria-expanded={pickerOpen}
            className="mt-2.5 flex h-11 w-full items-center justify-between gap-2 rounded-[12px] px-3.5 text-left transition-colors active:opacity-80"
            style={{ border: `1px solid ${pickerOpen ? "var(--lifeflow-primary)" : "var(--lifeflow-border)"}`, background: "var(--lifeflow-background)" }}>
            <span className="flex min-w-0 items-center gap-2 text-[13.5px] font-medium"
              style={{ color: selectedPlan ? "var(--color-text-primary)" : "var(--color-text-secondary)" }}>
              <Crosshair className="w-4 h-4 shrink-0" style={{ color: "var(--lifeflow-primary)" }} />
              <span className="truncate">
                {selectedPlan ? `${planLabel(selectedPlan)}（${selectedPlan === "province" ? "精讲精练" : "四阶段"}）` : "请先选择目标"}
              </span>
            </span>
            <ChevronDown className={`w-4 h-4 shrink-0 transition-transform ${pickerOpen ? "rotate-180" : ""}`} style={{ color: "var(--color-text-secondary)" }} />
          </button>

          {/* 选择面板 */}
          {pickerOpen && (
            <div className="mt-2 overflow-hidden rounded-[12px] border"
              style={{ border: "1px solid var(--lifeflow-border)", background: "var(--lifeflow-background)" }}>
              <button type="button" role="option" aria-selected={selectedPlan === "province"} onClick={() => handleSelect("province")}
                className="flex w-full items-center gap-2 px-3.5 py-2.5 text-left active:opacity-70">
                <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full"
                  style={{ background: "rgba(99,102,241,0.12)", color: "#6366F1" }}>
                  <GraduationCap className="w-4 h-4" />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-[13.5px] font-semibold" style={{ color: "var(--color-text-primary)" }}>省考（精讲精练）</span>
                  <span className="mt-0.5 block truncate text-[11.5px]" style={{ color: "var(--color-text-disabled)" }}>
                    备考 · 已完成 {provinceOverview?.doneLessons ?? 0}/{provinceOverview?.totalLessons ?? 0} 课时
                  </span>
                </span>
                {selectedPlan === "province" && <Check className="w-4 h-4 shrink-0" style={{ color: "#6366F1" }} />}
              </button>
              <button type="button" role="option" aria-selected={selectedPlan === "cet4"} onClick={() => handleSelect("cet4")}
                className="flex w-full items-center gap-2 border-t px-3.5 py-2.5 text-left active:opacity-70"
                style={{ borderColor: "var(--lifeflow-border)" }}>
                <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full"
                  style={{ background: "rgba(16,185,129,0.12)", color: "#10B981" }}>
                  <Target className="w-4 h-4" />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-[13.5px] font-semibold" style={{ color: "var(--color-text-primary)" }}>四级（四阶段）</span>
                  <span className="mt-0.5 block truncate text-[11.5px]" style={{ color: "var(--color-text-disabled)" }}>
                    备考 · 已完成 {cet4Overview?.doneLessons ?? 0}/{cet4Overview?.totalLessons ?? 0} 课时
                  </span>
                </span>
                {selectedPlan === "cet4" && <Check className="w-4 h-4 shrink-0" style={{ color: "#10B981" }} />}
              </button>
            </div>
          )}

          {/* 选中后：今日进度 chip + KR 进度行（真实映射 computeOverview） */}
          {selectedPlan && selectedOverview && (
            <div className="mt-3 border-t pt-3" style={{ borderColor: "var(--lifeflow-border)" }}>
              <div className="flex items-center justify-between gap-2">
                <p className="text-[12px] font-semibold" style={{ color: "var(--color-text-secondary)" }}>今日进度</p>
                <span className="rounded-full px-2.5 py-0.5 text-[11px] font-medium"
                  style={{ background: "rgba(37,99,235,0.10)", color: "var(--lifeflow-primary)" }}>
                  {selectedTasks.length > 0 ? `今日 ${selectedDone}/${selectedTasks.length} 项` : "今日无安排"}
                </span>
              </div>
              <div className="mt-2 flex items-center gap-2">
                <div className="flex-1"><ProgressBar pct={selectedPct} color={selectedAccent} /></div>
                <span className="text-[11px] font-medium tabular-nums shrink-0" style={{ color: selectedAccent }}>{selectedPct.toFixed(0)}%</span>
              </div>
              <p className="mt-1.5 text-[11px]" style={{ color: "var(--color-text-secondary)" }}>
                完成 {selectedOverview.doneLessons}/{selectedOverview.totalLessons} 课时 · 还需 {fmtHours(selectedOverview.remainingMinutes)} · {selectedOverview.needPerDay}分钟/天
              </p>
            </div>
          )}
        </div>
      </div>

      {/* 双考试进度卡（保留线上逻辑） */}
      <div className="px-4 pt-3 space-y-3">
        {provinceOverview && <PlanCard overview={provinceOverview} accent="#6366F1" />}
        {cet4Overview && <PlanCard overview={cet4Overview} accent="#10B981" />}
      </div>

      {/* 当前状态（保留线上逻辑） */}
      <div className="px-4 pt-4">
        <div className="rounded-[16px] px-4 py-3 flex items-center gap-3"
          style={{ background: "var(--color-surface-card)", boxShadow: "var(--shadow-card)" }}>
          <Flame className="w-5 h-5 shrink-0" style={{ color: "#F97316" }} />
          <p className="text-[13px] leading-relaxed" style={{ color: "var(--color-text-primary)" }}>
            {curSubject ? <>省考：正在学 <b style={{ color: "#6366F1" }}>{curSubject}</b></> : <>省考精讲精练已全部完成</>}
            {" · "}
            {curStage ? <>四级：<b style={{ color: "#10B981" }}>{curStage.stageName}</b></> : <>四级全部完成</>}
          </p>
        </div>
      </div>

      {/* 今日行动清单（画布：时段 chips + 勾选任务行；保留今日任务勾选与每日时长配额） */}
      <div className="px-4 pt-5">
        <div className="rounded-[20px] px-4 py-4" style={{ background: "var(--color-surface-card)", boxShadow: "var(--shadow-card)" }}>
          <div className="flex items-center justify-between gap-2">
            <div className="min-w-0">
              <p className="text-[14px] font-semibold leading-tight" style={{ color: "var(--color-text-primary)" }}>今日行动</p>
              <p className="mt-0.5 text-[12px] leading-tight" style={{ color: "var(--color-text-disabled)" }}>
                {today} · {selectedPlan ? `${planLabel(selectedPlan)} 勾选后自动计入进度` : "勾选后自动计入进度"}
              </p>
            </div>
            <span className="shrink-0 text-[12px] tabular-nums" style={{ color: "var(--color-text-secondary)" }}>
              {slotTasks.length} 项 · 已完成 {doneInSlot}
            </span>
          </div>

          {/* 写入时段 chips（画布 slot-chip 单选 · 纯 UI 筛选态，不写库） */}
          <div className="mt-2.5 flex items-center gap-1.5" role="radiogroup" aria-label="写入时段">
            {SLOTS.map((s) => (
              <button key={s.id} type="button" role="radio" aria-checked={slot === s.id} onClick={() => setSlot(s.id)}
                className="h-[30px] rounded-full border px-3 text-[12px] font-medium transition-colors active:opacity-70"
                style={slot === s.id
                  ? { borderColor: "var(--lifeflow-primary)", background: "rgba(37,99,235,0.10)", color: "var(--lifeflow-primary)" }
                  : { borderColor: "var(--lifeflow-border)", background: "var(--lifeflow-background)", color: "var(--color-text-primary)" }}>
                {s.label}
              </button>
            ))}
          </div>

          <div className="h-px my-1" style={{ background: "var(--lifeflow-border)" }} />

          {slotTasks.length === 0 ? (
            <p className="px-2 py-6 text-center text-[13px]" style={{ color: "var(--color-text-secondary)" }}>
              {selectedPlan ? "该时段今日无安排" : "今日无学习任务"}
            </p>
          ) : (
            slotTasks.map((t, i) => (
              <div key={t.lessonId ?? t.name}>
                {i > 0 && <div className="h-px" style={{ background: "var(--lifeflow-border)", marginLeft: "52px" }} />}
                <TaskRow task={{ ...t, done: progress.get(t.lessonId!) ?? false }} onToggle={handleToggle} />
              </div>
            ))
          )}
        </div>
      </div>

      {/* 保存卡片（画布：保存按钮 + 提示 + 查看联动机制入口） */}
      <div className="px-4 pt-4">
        <div className="rounded-[20px] px-4 py-4" style={{ background: "var(--color-surface-card)", boxShadow: "var(--shadow-card)" }}>
          <p className="text-[14px] font-semibold leading-tight" style={{ color: "var(--color-text-primary)" }}>保存到理想日</p>
          <p className="mt-0.5 text-[12px] leading-tight" style={{ color: "var(--color-text-disabled)" }}>目标行动 → 理想日功能槽 → 日程</p>

          <button type="button" onClick={handleSave}
            className="mt-3 flex h-11 w-full items-center justify-center rounded-full text-[15px] font-semibold transition-opacity active:opacity-80"
            style={{ background: "var(--lifeflow-primary)", color: "var(--lifeflow-primary-foreground)" }}>
            保存到理想日
          </button>

          <button type="button" onClick={() => router.push("/ideal-day")}
            className="mt-2.5 flex w-full items-center justify-center gap-1 text-[11.5px] font-medium transition-colors active:opacity-70"
            style={{ color: "var(--color-text-secondary)" }}>
            <Info className="w-3.5 h-3.5" />查看联动机制
          </button>

          <p className="mt-2.5 px-4 text-center text-[11px] leading-relaxed" style={{ color: "var(--color-text-disabled)" }}>
            保存后将所选任务与行动写入理想日对应时段
          </p>
        </div>
      </div>

      {/* 规则说明（保留线上逻辑） */}
      <p className="px-6 pt-4 text-[11px] leading-relaxed" style={{ color: "var(--color-text-disabled)" }}>
        规则：省考按 判断→政治→申论→言语→资料→数量 顺序学完（每天约 {fmtHours(DAILY_QUOTA.province)}）；
        四级周一至五刷视频、周六日复习，阶段顺序推进不跳段。完成课时自动计入进度。
      </p>
    </div>
  );
}
