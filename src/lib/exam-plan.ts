// ============================================================
// 备考计划引擎（T21-1）：省考 60 课时顺序学完 + 四级四阶段推进
//
// 核心原则（GUIDE v2.11+ T21 约定）：
// 1. 省考：60 课时 127h 顺序学完制（判断→政治→申论→言语→资料→数量，不轮换），
//    每天 4h（240min），须 9/16 刷题巩固开课前完成（倒排硬约束）
// 2. 四级：四阶段顺序推进不跳段，周一至五刷视频（每天 2h=120min）、周六周日复习
// 3. 进度 = 课时打勾联动（LessonProgress 独立 Dexie 库，不动现有 DB）
// ============================================================

import Dexie, { type Table } from "dexie";

// ─── 类型 ────────────────────────────────────────────────────

export type ExamPlanId = "province" | "cet4";

export interface ExamLesson {
  id: string;            // "province-jd-1" / "cet4-c1-1"
  planId: ExamPlanId;
  stageId: string;       // 省考: "p1"; 四级: "c1"~"c4"
  stageName: string;     // 阶段名
  subject?: string;      // 省考科目名
  name: string;          // 课时名
  minutes: number;       // 课时分钟数
  order: number;         // 阶段内顺序
}

export interface LessonProgress {
  id: string;            // lessonId
  completed: boolean;
  completedAt?: number;
}

export interface TodayTask {
  lessonId: string | null;   // 复习任务无课时
  planId: ExamPlanId;
  stageId: string;
  stageName: string;
  subject?: string;
  name: string;
  minutes: number;
  type: "study" | "review";
  done: boolean;
}

export interface ExamOverview {
  planId: ExamPlanId;
  planName: string;
  examDate: string;          // 考试日 / 截止日
  todayStr: string;
  totalLessons: number;
  doneLessons: number;
  totalMinutes: number;
  doneMinutes: number;
  remainingMinutes: number;
  remainingDays: number;     // 到截止日
  dailyQuotaMinutes: number; // 每日配额
  needPerDay: number;        // 剩余分钟 ÷ 剩余学习日
  onTrack: boolean;          // needPerDay <= dailyQuota
}

// ─── 静态课表种子（硬数据，GUIDE 已登记） ─────────────────────

export const EXAM_DATE = {
  provinceDeadline: "2026-09-16", // 精讲精练须在刷题巩固开课前完成
  provinceExam: "2027-03-15",
  cet4Exam: "2026-12-12",
} as const;

const PROVINCE_SUBJECTS: { subject: string; count: number; perMinutes: number }[] = [
  { subject: "判断推理", count: 12, perMinutes: 150 }, // 12 × 2.5h = 30h
  { subject: "政治理论", count: 6, perMinutes: 120 },  // 6 × 2h = 12h
  { subject: "申论", count: 20, perMinutes: 90 },      // 20 × 1.5h = 30h
  { subject: "言语", count: 9, perMinutes: 150 },      // 9 × 2.5h = 22.5h
  { subject: "资料分析", count: 8, perMinutes: 150 },  // 8 × 2.5h = 20h
  { subject: "数量关系", count: 5, perMinutes: 150 },  // 5 × 2.5h = 12.5h
];

// 四级：阶段子类细分（c2 按 基础11/写作翻译9/听力11/阅读19；c3 按卷型）
const CET4_STAGES: { stageId: string; stageName: string; name: string; count: number; perMinutes: number }[] = [
  { stageId: "c1", stageName: "夯实基础", name: "《你还在背单词吗》", count: 45, perMinutes: 48 },   // 45 视频 ≈ 36h
  { stageId: "c2a", stageName: "专项突破·基础", name: "基础突破", count: 11, perMinutes: 38 },      // 11 天
  { stageId: "c2b", stageName: "专项突破·写作翻译", name: "写作+翻译", count: 9, perMinutes: 38 },  // 9 天
  { stageId: "c2c", stageName: "专项突破·听力", name: "听力专项", count: 11, perMinutes: 38 },      // 11 天
  { stageId: "c2d", stageName: "专项突破·阅读", name: "阅读专项", count: 19, perMinutes: 38 },      // 19 天
  { stageId: "c3", stageName: "提升能力", name: "真题精讲", count: 136, perMinutes: 15 },          // 136 视频 ≈ 34h（1自测+12真题+9冲刺+3模拟逐题精讲）
  { stageId: "c4", stageName: "考前冲刺", name: "急救课/核心词", count: 3, perMinutes: 60 },        // 急救班 3 视频 + 核心词速背
];

let _lessons: ExamLesson[] | null = null;

/** 生成静态课表（省考 60 课时 + 四级四阶段视频），惰性缓存 */
export function getExamLessons(): ExamLesson[] {
  if (_lessons) return _lessons;
  const lessons: ExamLesson[] = [];
  let order = 0;

  // 省考精讲精练：科目顺序学完制
  for (const sub of PROVINCE_SUBJECTS) {
    for (let i = 1; i <= sub.count; i++) {
      lessons.push({
        id: `province-${sub.subject}-${i}`,
        planId: "province",
        stageId: "p1",
        stageName: "精讲精练",
        subject: sub.subject,
        name: `${sub.subject} 第${i}讲`,
        minutes: sub.perMinutes,
        order: order++,
      });
    }
  }

  // 四级：四阶段顺序推进
  for (const st of CET4_STAGES) {
    for (let i = 1; i <= st.count; i++) {
      lessons.push({
        id: `cet4-${st.stageId}-${i}`,
        planId: "cet4",
        stageId: st.stageId,
        stageName: st.stageName,
        name: `${st.name} 第${i}节`,
        minutes: st.perMinutes,
        order: order++,
      });
    }
  }

  _lessons = lessons;
  return lessons;
}

// ─── 进度存储（独立 Dexie 库，不动现有 DB） ─────────────────

export class ExamDB extends Dexie {
  lessonProgress!: Table<LessonProgress, string>;

  constructor() {
    super("LifeFlowExam");
    this.version(1).stores({
      lessonProgress: "&id, completed",
    });
  }
}

export const examDB = new ExamDB();

export async function getProgressMap(): Promise<Map<string, boolean>> {
  const rows = await examDB.lessonProgress.toArray();
  return new Map(rows.map((r) => [r.id, r.completed]));
}

export async function toggleLesson(id: string, completed: boolean): Promise<void> {
  if (completed) {
    await examDB.lessonProgress.put({ id, completed, completedAt: Date.now() });
  } else {
    await examDB.lessonProgress.delete(id);
  }
}

// ─── 日期工具 ────────────────────────────────────────────────

export function todayStrOf(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function addDays(dateStr: string, days: number): string {
  const d = new Date(dateStr + "T00:00:00");
  d.setDate(d.getDate() + days);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

export function daysUntil(dateStr: string, from = todayStrOf()): number {
  const diff = new Date(dateStr + "T00:00:00").getTime() - new Date(from + "T00:00:00").getTime();
  return Math.max(0, Math.round(diff / 86400000));
}

/** 距离截止日剩余的学习日数（周六日四级复习、省考全年无休） */
export function studyDaysUntil(dateStr: string, planId: ExamPlanId, from = todayStrOf()): number {
  const days = daysUntil(dateStr, from);
  let count = 0;
  for (let i = 0; i < days; i++) {
    const d = new Date(addDays(from, i) + "T00:00:00").getDay();
    if (planId === "cet4" && (d === 0 || d === 6)) continue; // 四级周末复习不算视频日
    count++;
  }
  return Math.max(1, count);
}

// ─── 引擎：每日任务生成 ──────────────────────────────────────

export const DAILY_QUOTA = { province: 240, cet4: 120 } as const; // 4h / 2h

/**
 * 生成今日学习任务（纯计算，可测试）：
 * - 省考：顺序取未完成课时，累计 ≤ 240min（贪心装满）
 * - 四级：周一至五取未完成视频累计 ≤ 120min；周六日生成复习任务
 */
export function computeTodayTasks(
  lessons: ExamLesson[],
  progress: Map<string, boolean>,
  dateStr: string,
): TodayTask[] {
  const tasks: TodayTask[] = [];
  const dow = new Date(dateStr + "T00:00:00").getDay(); // 0=Sun

  // ── 省考：顺序学完制，累计 ≥ 配额即停（允许末课时超额，避免课时浪费导致 9/16 前学不完） ──
  const provincePending = lessons
    .filter((l) => l.planId === "province" && !progress.get(l.id))
    .sort((a, b) => a.order - b.order);
  let quotaLeft = DAILY_QUOTA.province;
  for (const l of provincePending) {
    if (tasks.length > 0 && quotaLeft <= 0) break; // 已装 ≥1 课时且累计达配额，今日结束
    tasks.push({
      lessonId: l.id, planId: "province", stageId: l.stageId, stageName: l.stageName,
      subject: l.subject, name: l.name, minutes: l.minutes, type: "study", done: false,
    });
    quotaLeft -= l.minutes;
  }

  // ── 四级：周一至五视频 / 周六日复习 ──
  if (dow === 0 || dow === 6) {
    tasks.push({
      lessonId: null, planId: "cet4", stageId: "review", stageName: "周末复习",
      name: "周复盘 + 词群导图查漏 + 回顾本周内容", minutes: 120, type: "review", done: false,
    });
  } else {
    const cet4Pending = lessons
      .filter((l) => l.planId === "cet4" && !progress.get(l.id))
      .sort((a, b) => a.order - b.order);
    let cet4Quota = DAILY_QUOTA.cet4;
    for (const l of cet4Pending) {
      if (l.minutes > cet4Quota) break;
      tasks.push({
        lessonId: l.id, planId: "cet4", stageId: l.stageId, stageName: l.stageName,
        name: l.name, minutes: l.minutes, type: "study", done: false,
      });
      cet4Quota -= l.minutes;
      if (cet4Quota <= 0) break;
    }
  }

  return tasks;
}

// ─── 引擎：总体进度概览 ──────────────────────────────────────

export function computeOverview(
  lessons: ExamLesson[],
  progress: Map<string, boolean>,
  planId: ExamPlanId,
  dateStr = todayStrOf(),
): ExamOverview {
  const list = lessons.filter((l) => l.planId === planId);
  const done = list.filter((l) => progress.get(l.id));
  const totalMinutes = list.reduce((s, l) => s + l.minutes, 0);
  const doneMinutes = done.reduce((s, l) => s + l.minutes, 0);
  const remainingMinutes = Math.max(0, totalMinutes - doneMinutes);
  const deadline = planId === "province" ? EXAM_DATE.provinceDeadline : EXAM_DATE.cet4Exam;
  const studyDays = studyDaysUntil(deadline, planId, dateStr);
  const needPerDay = Math.ceil(remainingMinutes / studyDays);
  const quota = DAILY_QUOTA[planId];
  return {
    planId,
    planName: planId === "province" ? "安徽省考（精讲精练）" : "英语四级",
    examDate: deadline,
    todayStr: dateStr,
    totalLessons: list.length,
    doneLessons: done.length,
    totalMinutes,
    doneMinutes,
    remainingMinutes,
    remainingDays: daysUntil(deadline, dateStr),
    dailyQuotaMinutes: quota,
    needPerDay,
    onTrack: needPerDay <= quota,
  };
}

/** 当前四级所处阶段（最后一个未完成视频所在阶段；全部完成返回最后一阶段） */
export function currentCet4Stage(lessons: ExamLesson[], progress: Map<string, boolean>): ExamLesson | null {
  const pending = lessons
    .filter((l) => l.planId === "cet4" && !progress.get(l.id))
    .sort((a, b) => a.order - b.order);
  return pending[0] ?? lessons.filter((l) => l.planId === "cet4").sort((a, b) => b.order - a.order)[0] ?? null;
}

/** 当前省考所处科目（第一个未完成课时所属科目） */
export function currentProvinceSubject(lessons: ExamLesson[], progress: Map<string, boolean>): string | null {
  const pending = lessons
    .filter((l) => l.planId === "province" && !progress.get(l.id))
    .sort((a, b) => a.order - b.order);
  return pending[0]?.subject ?? null;
}

// ─── 今日任务与进度完成联动 ──────────────────────────────────

/** 今日任务是否全部完成（省考课时全打勾） */
export function isTodayDone(tasks: TodayTask[], progress: Map<string, boolean>): boolean {
  const studyTasks = tasks.filter((t) => t.type === "study" && t.lessonId);
  if (studyTasks.length === 0) return true;
  return studyTasks.every((t) => progress.get(t.lessonId!));
}

/** 将某考试今日任务压缩为学习块标题文案（供理想日学习块接入，T21-2） */
export function formatTodayTaskSummary(planId: ExamPlanId, tasks: TodayTask[]): string {
  if (tasks.length === 0) return planId === "province" ? "省考学习" : "四级学习";
  if (planId === "cet4") {
    if (tasks[0].type === "review") return "四级 · 周末复习";
    const nums = tasks.map((t) => /第(\d+)节/.exec(t.name)?.[1]).filter(Boolean);
    return `四级 · ${tasks[0].stageName}${nums.length > 0 ? ` 第${nums.join("+")}节` : ""}`;
  }
  const first = tasks[0];
  if (first.subject && tasks.every((t) => t.subject === first.subject)) {
    const nums = tasks.map((t) => /第(\d+)讲/.exec(t.name)?.[1]).filter(Boolean);
    return `省考 · ${first.subject}${nums.length > 0 ? ` 第${nums.join("+")}讲` : ""}`;
  }
  return `省考 · ${tasks.map((t) => t.name).join(" + ")}`;
}
