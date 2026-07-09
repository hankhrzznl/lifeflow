"use client";

import { useState, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  ArrowLeft, Moon, Dumbbell, Sparkles,
  GraduationCap, BookOpen, Sprout, Repeat,
  Target, TrendingUp, TrendingDown, Minus,
  CheckCheck, ListTodo, Flame, Wallet,
  BarChart3,
} from "lucide-react";
import {
  getWeeklyTaskStats, getActiveSchedulableTasks, getMonthlyTaskStats, getMonthlyHabitStats, getMonthlyFinanceStats,
  initBuiltInPlugins, getAllProjectsV2,
  createReviewRecord, getReviewRecordByKey,
} from "@/lib/db";
import { showToast } from "@/components/ui/Toast";
import type { ProjectV2, ReviewRecord, Task } from "@/lib/types";
import { db } from "@/lib/db";
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer, Legend,
} from "recharts";

// ==================== 类型 ====================

type TimeGranularity = "day" | "week" | "month" | "quarter";
type CompareMode = "time" | "goal";
type ChartDataPoint = Record<string, number | string>;

interface ProjectMetrics {
  line1Key: string;
  line1Label: string;
  line1Color: string;
  line2Key: string;
  line2Label: string;
  line2Color: string;
  goal1?: number;
  goal2?: number;
}

interface CompareRow {
  label: string;
  thisPeriod: number;
  lastPeriod: number;
  change: number;
  unit: string;
  isBetterUp: boolean;
}

// ==================== 工具函数 ====================

function getTodayStr(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function formatDate(ts: number): string {
  const d = new Date(ts);
  return `${d.getMonth() + 1}/${d.getDate()}`;
}

function formatDateFull(ts: number): string {
  const d = new Date(ts);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function getDaysInRange(start: number, end: number): string[] {
  const days: string[] = [];
  const cur = new Date(start);
  while (cur.getTime() <= end) {
    days.push(formatDateFull(cur.getTime()));
    cur.setDate(cur.getDate() + 1);
  }
  return days;
}

// ==================== 子模块指标配置 ====================

function getProjectMetrics(project: ProjectV2): ProjectMetrics {
  switch (project.name) {
    case "睡眠":
      return {
        line1Key: "duration", line1Label: "睡眠时长(h)", line1Color: "#8b5cf6",
        line2Key: "quality", line2Label: "睡眠质量", line2Color: "#f59e0b",
        goal1: 8, goal2: 8,
      };
    case "体态":
      return {
        line1Key: "weight", line1Label: "体重(kg)", line1Color: "#10b981",
        line2Key: "bodyFat", line2Label: "体脂率(%)", line2Color: "#ef4444",
        goal1: undefined, goal2: undefined,
      };
    case "运动":
      return {
        line1Key: "count", line1Label: "运动次数", line1Color: "#3b82f6",
        line2Key: "duration", line2Label: "运动时长(min)", line2Color: "#f59e0b",
        goal1: undefined, goal2: undefined,
      };
    case "考公":
      return {
        line1Key: "studyMin", line1Label: "学习时长(h)", line1Color: "#6366f1",
        line2Key: "tasksDone", line2Label: "完成任务", line2Color: "#f97316",
        goal1: 4, goal2: undefined,
      };
    case "毕业":
      return {
        line1Key: "tasksDone", line1Label: "论文任务", line1Color: "#8b5cf6",
        line2Key: "focusMin", line2Label: "专注时长(h)", line2Color: "#10b981",
        goal1: undefined, goal2: undefined,
      };
    case "习惯":
      return {
        line1Key: "checkins", line1Label: "打卡次数", line1Color: "#ec4899",
        line2Key: "completionRate", line2Label: "完成率(%)", line2Color: "#14b8a6",
        goal1: undefined, goal2: 100,
      };
    case "规划":
      return {
        line1Key: "activeProjects", line1Label: "活跃项目", line1Color: "#f43f5e",
        line2Key: "tasksDone", line2Label: "完成任务", line2Color: "#6366f1",
        goal1: undefined, goal2: undefined,
      };
    case "成长":
      return {
        line1Key: "journalCount", line1Label: "日记篇数", line1Color: "#a855f7",
        line2Key: "mood", line2Label: "心情指数", line2Color: "#eab308",
        goal1: undefined, goal2: 7,
      };
    default:
      return {
        line1Key: "v1", line1Label: "指标1", line1Color: "#6366f1",
        line2Key: "v2", line2Label: "指标2", line2Color: "#f97316",
      };
  }
}

// ==================== 数据加载函数 ====================

async function loadSleepData(granularity: TimeGranularity): Promise<{ chart: ChartDataPoint[]; compare: CompareRow[] }> {
  const now = Date.now();
  const days = granularity === "day" ? 30 : granularity === "week" ? 90 : granularity === "month" ? 365 : 730;
  const start = now - days * 24 * 60 * 60 * 1000;

  const records = await db.sleepRecords
    .where("timestamp")
    .between(start, now)
    .toArray();

  const dailyMap: Record<string, { durations: number[]; qualities: number[] }> = {};
  for (const r of records) {
    const d = formatDateFull(r.timestamp || 0);
    if (!dailyMap[d]) dailyMap[d] = { durations: [], qualities: [] };
    dailyMap[d].durations.push(r.sleepDuration ? Math.round(r.sleepDuration / 60) : 0);
    dailyMap[d].qualities.push(r.sleepQuality || 0);
  }

  const chart = aggregateChartData(dailyMap, granularity, now, days,
    (v) => v.durations.length > 0 ? v.durations.reduce((a, b) => a + b, 0) / v.durations.length : 0,
    (v) => v.qualities.length > 0 ? v.qualities.reduce((a, b) => a + b, 0) / v.qualities.length : 0,
  );

  const compare = buildCompareRows(dailyMap, granularity, now, days,
    (v) => v.durations.length > 0 ? v.durations.reduce((a, b) => a + b, 0) / v.durations.length : 0,
    (v) => v.qualities.length > 0 ? v.qualities.reduce((a, b) => a + b, 0) / v.qualities.length : 0,
    [
      { label: "平均睡眠时长", unit: "小时", isBetterUp: false },
      { label: "平均睡眠质量", unit: "分", isBetterUp: true },
    ],
  );

  return { chart, compare };
}

async function loadBodyMetricData(granularity: TimeGranularity): Promise<{ chart: ChartDataPoint[]; compare: CompareRow[] }> {
  const now = Date.now();
  const days = granularity === "day" ? 30 : granularity === "week" ? 90 : granularity === "month" ? 365 : 730;
  const start = now - days * 24 * 60 * 60 * 1000;

  const weightRecords = await db.bodyMetricRecords
    .where("timestamp")
    .between(start, now)
    .filter((r) => r.type === "weight")
    .toArray();

  const fatRecords = await db.bodyMetricRecords
    .where("timestamp")
    .between(start, now)
    .filter((r) => r.type === "bodyFat")
    .toArray();

  const dailyMap: Record<string, { weights: number[]; fats: number[] }> = {};
  for (const r of weightRecords) {
    const d = formatDateFull(r.timestamp || 0);
    if (!dailyMap[d]) dailyMap[d] = { weights: [], fats: [] };
    dailyMap[d].weights.push(r.value);
  }
  for (const r of fatRecords) {
    const d = formatDateFull(r.timestamp || 0);
    if (!dailyMap[d]) dailyMap[d] = { weights: [], fats: [] };
    dailyMap[d].fats.push(r.secondaryValue || r.value);
  }

  const chart = aggregateChartData(dailyMap, granularity, now, days,
    (v) => v.weights.length > 0 ? v.weights.reduce((a, b) => a + b, 0) / v.weights.length : 0,
    (v) => v.fats.length > 0 ? v.fats.reduce((a, b) => a + b, 0) / v.fats.length : 0,
  );

  const compare = buildCompareRows(dailyMap, granularity, now, days,
    (v) => v.weights.length > 0 ? v.weights.reduce((a, b) => a + b, 0) / v.weights.length : 0,
    (v) => v.fats.length > 0 ? v.fats.reduce((a, b) => a + b, 0) / v.fats.length : 0,
    [
      { label: "平均体重", unit: "kg", isBetterUp: false },
      { label: "平均体脂率", unit: "%", isBetterUp: false },
    ],
  );

  return { chart, compare };
}

async function loadWorkoutData(granularity: TimeGranularity): Promise<{ chart: ChartDataPoint[]; compare: CompareRow[] }> {
  const now = Date.now();
  const days = granularity === "day" ? 30 : granularity === "week" ? 90 : granularity === "month" ? 365 : 730;
  const start = now - days * 24 * 60 * 60 * 1000;

  const records = await db.workouts
    .where("startTime")
    .between(start, now)
    .toArray();

  const dailyMap: Record<string, { counts: number[]; durations: number[] }> = {};
  for (const r of records) {
    const d = formatDateFull(r.startTime || 0);
    if (!dailyMap[d]) dailyMap[d] = { counts: [], durations: [] };
    dailyMap[d].counts.push(1);
    dailyMap[d].durations.push(r.duration || 0);
  }

  const chart = aggregateChartData(dailyMap, granularity, now, days,
    (v) => v.counts.reduce((a, b) => a + b, 0),
    (v) => Math.round(v.durations.reduce((a, b) => a + b, 0) / 60),
  );

  const compare = buildCompareRows(dailyMap, granularity, now, days,
    (v) => v.counts.reduce((a, b) => a + b, 0),
    (v) => Math.round(v.durations.reduce((a, b) => a + b, 0) / 60),
    [
      { label: "运动次数", unit: "次", isBetterUp: true },
      { label: "运动总时长", unit: "分钟", isBetterUp: true },
    ],
  );

  return { chart, compare };
}

async function loadKaogongData(granularity: TimeGranularity): Promise<{ chart: ChartDataPoint[]; compare: CompareRow[] }> {
  const now = Date.now();
  const days = granularity === "day" ? 30 : granularity === "week" ? 90 : granularity === "month" ? 365 : 730;
  const start = now - days * 24 * 60 * 60 * 1000;

  const tasks = await db.tasks
    .filter((t) => !!(t.tags && t.tags.includes("考公")))
    .toArray();

  const focusLogs = await db.focusLogs
    .where("startTime")
    .between(start, now)
    .toArray();

  // 找出考公相关任务的 ID
  const kaogongTaskIds = new Set(tasks.map((t) => t.id).filter(Boolean) as number[]);
  const relevantFocusLogs = focusLogs.filter((f) => kaogongTaskIds.has(f.eventId));

  const dailyMap: Record<string, { studyMin: number[]; tasksDone: number[] }> = {};

  for (const f of relevantFocusLogs) {
    const d = formatDateFull(f.startTime || 0);
    if (!dailyMap[d]) dailyMap[d] = { studyMin: [], tasksDone: [] };
    dailyMap[d].studyMin.push(Math.round((f.duration || 0) / 60));
  }

  for (const t of tasks) {
    if (t.status === "done") {
      const d = formatDateFull(t.updatedAt || 0);
      if (!dailyMap[d]) dailyMap[d] = { studyMin: [], tasksDone: [] };
      dailyMap[d].tasksDone.push(1);
    }
  }

  const chart = aggregateChartData(dailyMap, granularity, now, days,
    (v) => v.studyMin.reduce((a, b) => a + b, 0) / 60,
    (v) => v.tasksDone.reduce((a, b) => a + b, 0),
  );

  const compare = buildCompareRows(dailyMap, granularity, now, days,
    (v) => v.studyMin.reduce((a, b) => a + b, 0) / 60,
    (v) => v.tasksDone.reduce((a, b) => a + b, 0),
    [
      { label: "学习时长", unit: "小时", isBetterUp: true },
      { label: "完成任务", unit: "个", isBetterUp: true },
    ],
  );

  return { chart, compare };
}

async function loadGraduationData(granularity: TimeGranularity): Promise<{ chart: ChartDataPoint[]; compare: CompareRow[] }> {
  const now = Date.now();
  const days = granularity === "day" ? 30 : granularity === "week" ? 90 : granularity === "month" ? 365 : 730;
  const start = now - days * 24 * 60 * 60 * 1000;

  const tasks = await db.tasks
    .filter((t) => !!(t.tags && t.tags.includes("毕业")))
    .toArray();

  const focusLogs = await db.focusLogs
    .where("startTime")
    .between(start, now)
    .toArray();

  const graduationTaskIds = new Set(tasks.map((t) => t.id).filter(Boolean) as number[]);
  const relevantFocusLogs = focusLogs.filter((f) => graduationTaskIds.has(f.eventId));

  const dailyMap: Record<string, { tasksDone: number[]; focusMin: number[] }> = {};

  for (const f of relevantFocusLogs) {
    const d = formatDateFull(f.startTime || 0);
    if (!dailyMap[d]) dailyMap[d] = { tasksDone: [], focusMin: [] };
    dailyMap[d].focusMin.push(Math.round((f.duration || 0) / 60));
  }

  for (const t of tasks) {
    if (t.status === "done") {
      const d = formatDateFull(t.updatedAt || 0);
      if (!dailyMap[d]) dailyMap[d] = { tasksDone: [], focusMin: [] };
      dailyMap[d].tasksDone.push(1);
    }
  }

  const chart = aggregateChartData(dailyMap, granularity, now, days,
    (v) => v.tasksDone.reduce((a, b) => a + b, 0),
    (v) => v.focusMin.reduce((a, b) => a + b, 0) / 60,
  );

  const compare = buildCompareRows(dailyMap, granularity, now, days,
    (v) => v.tasksDone.reduce((a, b) => a + b, 0),
    (v) => v.focusMin.reduce((a, b) => a + b, 0) / 60,
    [
      { label: "论文任务", unit: "个", isBetterUp: true },
      { label: "专注时长", unit: "小时", isBetterUp: true },
    ],
  );

  return { chart, compare };
}

async function loadHabitData(granularity: TimeGranularity): Promise<{ chart: ChartDataPoint[]; compare: CompareRow[] }> {
  const now = new Date();
  const days = granularity === "day" ? 30 : granularity === "week" ? 90 : granularity === "month" ? 365 : 730;
  const start = new Date(now.getTime() - days * 24 * 60 * 60 * 1000);

  const logs = await db.habit_logs.toArray();
  const allHabits = await db.tasks.where("type").equals("habit").count();

  const dailyMap: Record<string, { checkins: number[] }> = {};

  for (const log of logs) {
    const d = log.date;
    if (!dailyMap[d]) dailyMap[d] = { checkins: [] };
    dailyMap[d].checkins.push(log.count || 1);
  }

  const chart = aggregateChartData(dailyMap, granularity, now.getTime(), days,
    (v) => v.checkins.reduce((a, b) => a + b, 0),
    (v) => allHabits > 0 ? Math.round((v.checkins.reduce((a, b) => a + b, 0) / allHabits) * 100) : 0,
  );

  const compare = buildCompareRows(dailyMap, granularity, now.getTime(), days,
    (v) => v.checkins.reduce((a, b) => a + b, 0),
    (v) => allHabits > 0 ? Math.round((v.checkins.reduce((a, b) => a + b, 0) / allHabits) * 100) : 0,
    [
      { label: "打卡次数", unit: "次", isBetterUp: true },
      { label: "完成率", unit: "%", isBetterUp: true },
    ],
  );

  return { chart, compare };
}

async function loadPlanningData(granularity: TimeGranularity): Promise<{ chart: ChartDataPoint[]; compare: CompareRow[] }> {
  const now = Date.now();
  const days = granularity === "day" ? 30 : granularity === "week" ? 90 : granularity === "month" ? 365 : 730;
  const start = now - days * 24 * 60 * 60 * 1000;

  const projects = await db.projectV2s.toArray();
  const tasks = await db.tasks.toArray();

  const dailyMap: Record<string, { activeProjects: number[]; tasksDone: number[] }> = {};

  for (const t of tasks) {
    if (t.status === "done" && t.updatedAt) {
      const d = formatDateFull(t.updatedAt);
      if (!dailyMap[d]) dailyMap[d] = { activeProjects: [], tasksDone: [] };
      dailyMap[d].tasksDone.push(1);
    }
  }

  const chart = aggregateChartData(dailyMap, granularity, now, days,
    () => projects.length,
    (v) => v.tasksDone.reduce((a, b) => a + b, 0),
  );

  const compare = buildCompareRows(dailyMap, granularity, now, days,
    () => projects.length,
    (v) => v.tasksDone.reduce((a, b) => a + b, 0),
    [
      { label: "活跃项目", unit: "个", isBetterUp: true },
      { label: "完成任务", unit: "个", isBetterUp: true },
    ],
  );

  return { chart, compare };
}

async function loadGrowthData(granularity: TimeGranularity): Promise<{ chart: ChartDataPoint[]; compare: CompareRow[] }> {
  const now = Date.now();
  const days = granularity === "day" ? 30 : granularity === "week" ? 90 : granularity === "month" ? 365 : 730;
  const start = now - days * 24 * 60 * 60 * 1000;

  const journalEntries = await db.journalEntries
    .where("timestamp")
    .between(start, now)
    .toArray();

  const healthRecords = await db.healthRecords
    .where("timestamp")
    .between(start, now)
    .filter((r) => r.metricType === "mood")
    .toArray();

  const dailyMap: Record<string, { journalCount: number[]; moods: number[] }> = {};

  for (const j of journalEntries) {
    const d = formatDateFull(j.timestamp || 0);
    if (!dailyMap[d]) dailyMap[d] = { journalCount: [], moods: [] };
    dailyMap[d].journalCount.push(1);
  }

  for (const h of healthRecords) {
    const d = h.date;
    if (!dailyMap[d]) dailyMap[d] = { journalCount: [], moods: [] };
    dailyMap[d].moods.push(h.value);
  }

  const chart = aggregateChartData(dailyMap, granularity, now, days,
    (v) => v.journalCount.reduce((a, b) => a + b, 0),
    (v) => v.moods.length > 0 ? v.moods.reduce((a, b) => a + b, 0) / v.moods.length : 0,
  );

  const compare = buildCompareRows(dailyMap, granularity, now, days,
    (v) => v.journalCount.reduce((a, b) => a + b, 0),
    (v) => v.moods.length > 0 ? v.moods.reduce((a, b) => a + b, 0) / v.moods.length : 0,
    [
      { label: "日记篇数", unit: "篇", isBetterUp: true },
      { label: "平均心情", unit: "分", isBetterUp: true },
    ],
  );

  return { chart, compare };
}

// ==================== 数据聚合工具 ====================

function aggregateChartData<T>(
  dailyMap: Record<string, T>,
  granularity: TimeGranularity,
  now: number,
  totalDays: number,
  extractV1: (v: T) => number,
  extractV2: (v: T) => number,
): ChartDataPoint[] {
  if (granularity === "day") {
    const days = getDaysInRange(now - totalDays * 24 * 60 * 60 * 1000, now);
    return days.map((d) => {
      const v = dailyMap[d];
      return {
        date: d.slice(5),
        v1: v ? Math.round(extractV1(v) * 10) / 10 : 0,
        v2: v ? Math.round(extractV2(v) * 10) / 10 : 0,
      };
    }).slice(-30);
  }

  if (granularity === "week") {
    const weeks: Record<string, T[]> = {};
    for (const [date, val] of Object.entries(dailyMap)) {
      const d = new Date(date);
      const weekStart = new Date(d);
      weekStart.setDate(d.getDate() - d.getDay());
      const key = formatDateFull(weekStart.getTime());
      if (!weeks[key]) weeks[key] = [];
      weeks[key].push(val);
    }
    return Object.entries(weeks)
      .sort(([a], [b]) => a.localeCompare(b))
      .slice(-12)
      .map(([key, vals]) => ({
        date: key.slice(5),
        v1: Math.round((vals.reduce((s: number, v: T) => s + extractV1(v), 0) / vals.length) * 10) / 10,
        v2: Math.round((vals.reduce((s: number, v: T) => s + extractV2(v), 0) / vals.length) * 10) / 10,
      }));
  }

  if (granularity === "month") {
    const months: Record<string, T[]> = {};
    for (const [date, val] of Object.entries(dailyMap)) {
      const key = date.slice(0, 7);
      if (!months[key]) months[key] = [];
      months[key].push(val);
    }
    return Object.entries(months)
      .sort(([a], [b]) => a.localeCompare(b))
      .slice(-12)
      .map(([key, vals]) => ({
        date: key,
        v1: Math.round((vals.reduce((s: number, v: T) => s + extractV1(v), 0) / vals.length) * 10) / 10,
        v2: Math.round((vals.reduce((s: number, v: T) => s + extractV2(v), 0) / vals.length) * 10) / 10,
      }));
  }

  // quarter
  const quarters: Record<string, T[]> = {};
  for (const [date, val] of Object.entries(dailyMap)) {
    const d = new Date(date);
    const q = Math.floor(d.getMonth() / 3) + 1;
    const key = `${d.getFullYear()}-Q${q}`;
    if (!quarters[key]) quarters[key] = [];
    quarters[key].push(val);
  }
  return Object.entries(quarters)
    .sort(([a], [b]) => a.localeCompare(b))
    .slice(-8)
    .map(([key, vals]) => ({
      date: key,
      v1: Math.round((vals.reduce((s: number, v: T) => s + extractV1(v), 0) / vals.length) * 10) / 10,
      v2: Math.round((vals.reduce((s: number, v: T) => s + extractV2(v), 0) / vals.length) * 10) / 10,
    }));
}

function buildCompareRows<T>(
  dailyMap: Record<string, T>,
  _granularity: TimeGranularity,
  now: number,
  totalDays: number,
  extractV1: (v: T) => number,
  extractV2: (v: T) => number,
  rowDefs: { label: string; unit: string; isBetterUp: boolean }[],
): CompareRow[] {
  const halfDays = Math.floor(totalDays / 2);
  const mid = now - halfDays * 24 * 60 * 60 * 1000;

  const thisPeriod: string[] = [];
  const lastPeriod: string[] = [];
  for (const date of Object.keys(dailyMap)) {
    const ts = new Date(date).getTime();
    if (ts >= mid) thisPeriod.push(date);
    else lastPeriod.push(date);
  }

  const thisVals1 = thisPeriod.map((d) => extractV1(dailyMap[d]));
  const lastVals1 = lastPeriod.map((d) => extractV1(dailyMap[d]));
  const thisVals2 = thisPeriod.map((d) => extractV2(dailyMap[d]));
  const lastVals2 = lastPeriod.map((d) => extractV2(dailyMap[d]));

  const avg = (arr: number[]) => arr.length > 0 ? arr.reduce((a: number, b: number) => a + b, 0) / arr.length : 0;

  const this1 = Math.round(avg(thisVals1) * 10) / 10;
  const last1 = Math.round(avg(lastVals1) * 10) / 10;
  const this2 = Math.round(avg(thisVals2) * 10) / 10;
  const last2 = Math.round(avg(lastVals2) * 10) / 10;

  const change1 = last1 > 0 ? Math.round(((this1 - last1) / last1) * 100) : 0;
  const change2 = last2 > 0 ? Math.round(((this2 - last2) / last2) * 100) : 0;

  return [
    {
      label: rowDefs[0].label,
      thisPeriod: this1,
      lastPeriod: last1,
      change: change1,
      unit: rowDefs[0].unit,
      isBetterUp: rowDefs[0].isBetterUp,
    },
    {
      label: rowDefs[1].label,
      thisPeriod: this2,
      lastPeriod: last2,
      change: change2,
      unit: rowDefs[1].unit,
      isBetterUp: rowDefs[1].isBetterUp,
    },
  ];
}

// ==================== 数据加载调度 ====================

async function loadProjectData(
  project: ProjectV2,
  granularity: TimeGranularity,
): Promise<{ chart: ChartDataPoint[]; compare: CompareRow[] } | null> {
  try {
    switch (project.name) {
      case "睡眠": return loadSleepData(granularity);
      case "体态": return loadBodyMetricData(granularity);
      case "运动": return loadWorkoutData(granularity);
      case "考公": return loadKaogongData(granularity);
      case "毕业": return loadGraduationData(granularity);
      case "习惯": return loadHabitData(granularity);
      case "规划": return loadPlanningData(granularity);
      case "成长": return loadGrowthData(granularity);
      default: return null;
    }
  } catch (err) {
    console.error(`Failed to load data for ${project.name}:`, err);
    return null;
  }
}

// ==================== 子组件 ====================

function ChangeBadge({ change, isBetterUp }: { change: number; isBetterUp: boolean }) {
  const isPositive = change > 0;
  const isBetter = isBetterUp ? isPositive : !isPositive;
  const color = change === 0 ? "text-gray-400" : isBetter ? "text-emerald-500" : "text-red-500";
  const Icon = change > 0 ? TrendingUp : change < 0 ? TrendingDown : Minus;

  return (
    <span className={`inline-flex items-center gap-0.5 text-xs font-medium ${color}`}>
      <Icon className="w-3 h-3" />
      {change > 0 ? "+" : ""}{change}%
    </span>
  );
}

function CompareTable({
  rows,
  compareMode,
  metrics,
}: {
  rows: CompareRow[];
  compareMode: CompareMode;
  metrics: ProjectMetrics;
}) {
  if (compareMode === "goal") {
    return (
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4">
        <h3 className="text-sm font-semibold text-gray-700 mb-3">目标对比</h3>
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-xs text-gray-500">{metrics.line1Label}</span>
            <div className="flex items-center gap-2">
              <span className="text-sm font-bold text-gray-900">{rows[0]?.thisPeriod ?? "-"}</span>
              {metrics.goal1 !== undefined && (
                <>
                  <span className="text-xs text-gray-400">/</span>
                  <span className="text-xs text-gray-400">目标 {metrics.goal1}</span>
                  <span className={`text-xs font-medium ${(rows[0]?.thisPeriod ?? 0) >= metrics.goal1 ? "text-emerald-500" : "text-amber-500"}`}>
                    {metrics.goal1 > 0 ? Math.round(((rows[0]?.thisPeriod ?? 0) / metrics.goal1) * 100) : 0}%
                  </span>
                </>
              )}
            </div>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-xs text-gray-500">{metrics.line2Label}</span>
            <div className="flex items-center gap-2">
              <span className="text-sm font-bold text-gray-900">{rows[1]?.thisPeriod ?? "-"}</span>
              {metrics.goal2 !== undefined && (
                <>
                  <span className="text-xs text-gray-400">/</span>
                  <span className="text-xs text-gray-400">目标 {metrics.goal2}</span>
                  <span className={`text-xs font-medium ${(rows[1]?.thisPeriod ?? 0) >= metrics.goal2 ? "text-emerald-500" : "text-amber-500"}`}>
                    {metrics.goal2 > 0 ? Math.round(((rows[1]?.thisPeriod ?? 0) / metrics.goal2) * 100) : 0}%
                  </span>
                </>
              )}
            </div>
          </div>
        </div>
        {metrics.goal1 === undefined && metrics.goal2 === undefined && (
          <p className="text-xs text-gray-400 mt-2">暂未设置目标值</p>
        )}
      </div>
    );
  }

  return (
    <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4">
      <h3 className="text-sm font-semibold text-gray-700 mb-3">本周 vs 上周</h3>
      <div className="overflow-x-auto">
        <table className="w-full text-xs">
          <thead>
            <tr className="text-gray-400">
              <th className="text-left font-normal pb-2">指标</th>
              <th className="text-right font-normal pb-2">本周</th>
              <th className="text-right font-normal pb-2">上周</th>
              <th className="text-right font-normal pb-2">变化</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row, i) => (
              <tr key={i} className="border-t border-gray-50">
                <td className="py-2.5 text-gray-600">{row.label}</td>
                <td className="py-2.5 text-right font-medium text-gray-900">{row.thisPeriod}{row.unit}</td>
                <td className="py-2.5 text-right text-gray-500">{row.lastPeriod}{row.unit}</td>
                <td className="py-2.5 text-right">
                  <ChangeBadge change={row.change} isBetterUp={row.isBetterUp} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function EmptyChart() {
  return (
    <div className="flex flex-col items-center justify-center py-16 text-gray-400">
      <BarChart3 className="w-10 h-10 mb-3 text-gray-300" strokeWidth={1.5} />
      <p className="text-sm font-medium">暂无数据</p>
      <p className="text-xs mt-1">该模块暂无历史数据，开始记录后将自动生成趋势图</p>
    </div>
  );
}

// ==================== 全部视图（聚合摘要） ====================

function AllSummaryView() {
  const [loading, setLoading] = useState(true);
  const [taskStats, setTaskStats] = useState({ completed: 0, active: 0, new: 0 });
  const [habitStats, setHabitStats] = useState({ completed: 0, total: 0, streak: 0 });
  const [financeStats, setFinanceStats] = useState({ income: 0, expense: 0, balance: 0 });
  const [weeklyDone, setWeeklyDone] = useState(0);
  const [weeklyPending, setWeeklyPending] = useState(0);
  const [pendingTasks, setPendingTasks] = useState<Task[]>([]);
  const [summary, setSummary] = useState("");
  const [savedRecord, setSavedRecord] = useState<ReviewRecord | null>(null);
  const [saving, setSaving] = useState(false);

  const now = new Date();
  const currentYear = now.getFullYear();
  const currentMonth = now.getMonth() + 1;

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      await initBuiltInPlugins();
      const [monthTasks, monthHabits, monthFinance, weekTasks, pending] =
        await Promise.all([
          getMonthlyTaskStats(currentYear, currentMonth),
          getMonthlyHabitStats(currentYear, currentMonth),
          getMonthlyFinanceStats(currentYear, currentMonth),
          getWeeklyTaskStats(),
          getActiveSchedulableTasks(),
        ]);
      setTaskStats(monthTasks);
      setHabitStats(monthHabits);
      setFinanceStats(monthFinance);
      setWeeklyDone(weekTasks.completed);
      setWeeklyPending(weekTasks.active);
      setPendingTasks(pending.slice(0, 10));

      const todayKey = getTodayStr();
      const existingDaily = await getReviewRecordByKey(todayKey);
      if (existingDaily) {
        setSavedRecord(existingDaily);
        setSummary(existingDaily.summary || "");
      }
    } catch { /* ignore */ }
    finally { setLoading(false); }
  }, [currentYear, currentMonth]);

  useEffect(() => { loadData(); }, [loadData]);

  const handleSave = async () => {
    setSaving(true);
    try {
      const key = getTodayStr();
      await createReviewRecord({
        type: "daily",
        dateKey: key,
        summary: summary || undefined,
        stats: {
          tasksDone: weeklyDone,
          tasksPending: weeklyPending,
          tasksOverdue: 0,
          habitStreaks: habitStats.completed,
          focusMinutes: 0,
          financeIncome: financeStats.income,
          financeExpense: financeStats.expense,
        },
      });
      showToast({ message: "回顾已保存", type: "success" });
      const r = await getReviewRecordByKey(key);
      if (r) setSavedRecord(r);
    } catch {
      showToast({ message: "保存失败", type: "error" });
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="space-y-3">
        {[1, 2, 3, 4].map((i) => (
          <div key={i} className="skeleton h-24 rounded-2xl" />
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3">
        <StatCard icon={<CheckCheck className="w-4 h-4" />} iconColor="text-emerald-500" label="本周完成" value={weeklyDone} />
        <StatCard icon={<ListTodo className="w-4 h-4" />} iconColor="text-amber-500" label="待办" value={weeklyPending} />
        <StatCard icon={<Flame className="w-4 h-4" />} iconColor="text-orange-500" label="习惯打卡" value={habitStats.completed} />
        <StatCard icon={<Wallet className="w-4 h-4" />} iconColor="text-blue-500" label="今日支出" value={financeStats.expense.toFixed(0)} valueColor="text-red-500" />
      </div>

      {pendingTasks.length > 0 && (
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4">
          <div className="flex items-center gap-2 mb-3">
            <Target className="w-4 h-4 text-indigo-500" />
            <h3 className="text-sm font-semibold text-gray-700">待办预览</h3>
          </div>
          <div className="space-y-1">
            {pendingTasks.slice(0, 5).map((t) => (
              <div key={t.id} className="text-xs text-gray-500 truncate pl-1 border-l-2 border-gray-200">{t.title}</div>
            ))}
          </div>
        </div>
      )}

      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4">
        <p className="text-sm font-semibold text-gray-700 mb-2">今日反思</p>
        <textarea
          value={summary}
          onChange={(e) => setSummary(e.target.value)}
          placeholder="今天完成了什么？有什么需要改进？"
          rows={4}
          className="w-full px-3 py-2 rounded-xl border border-gray-200 bg-gray-50 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
        />
        <button
          onClick={handleSave}
          disabled={saving}
          className="mt-2 w-full py-2.5 rounded-xl bg-indigo-600 text-white text-sm font-medium hover:bg-indigo-700 transition-colors disabled:opacity-50"
        >
          {saving ? "保存中..." : savedRecord ? "更新回顾" : "保存回顾"}
        </button>
      </div>
    </div>
  );
}

function StatCard({
  icon, iconColor, label, value, valueColor,
}: {
  icon: React.ReactNode;
  iconColor: string;
  label: string;
  value: string | number;
  valueColor?: string;
}) {
  return (
    <div className="bg-white rounded-2xl p-4 border border-gray-100 shadow-sm">
      <div className="flex items-center gap-2 mb-1">
        <span className={iconColor}>{icon}</span>
        <span className="text-xs text-gray-500">{label}</span>
      </div>
      <p className={`text-2xl font-bold ${valueColor || "text-gray-900"}`}>{value}</p>
    </div>
  );
}

// ==================== 主页面 ====================

export default function ReviewPage() {
  const [projects, setProjects] = useState<ProjectV2[]>([]);
  const [loading, setLoading] = useState(true);

  // 当前选中的项目（null = 全部）
  const [selectedName, setSelectedName] = useState<string | null>(null);

  // 粒度和对比模式
  const [granularity, setGranularity] = useState<TimeGranularity>("day");
  const [compareMode, setCompareMode] = useState<CompareMode>("time");

  // 图表数据
  const [chartData, setChartData] = useState<ChartDataPoint[]>([]);
  const [compareRows, setCompareRows] = useState<CompareRow[]>([]);
  const [dataLoading, setDataLoading] = useState(false);
  const [noData, setNoData] = useState(false);

  // 当前选中的项目对象
  const selectedProject = projects.find((p) => p.name === selectedName) ?? null;
  const metrics = selectedProject ? getProjectMetrics(selectedProject) : null;

  // 初始化
  useEffect(() => {
    const load = async () => {
      try {
        const all = await getAllProjectsV2();
        setProjects(all);
      } catch (err) {
        console.error("Failed to load projects:", err);
      } finally {
        setLoading(false);
      }
    };
    load();
  }, []);

  // 加载数据
  useEffect(() => {
    if (!selectedProject) {
      setChartData([]);
      setCompareRows([]);
      setNoData(false);
      return;
    }

    let cancelled = false;
    setDataLoading(true);
    setNoData(false);

    loadProjectData(selectedProject, granularity).then((result) => {
      if (cancelled) return;
      if (result && result.chart.length > 0) {
        setChartData(result.chart);
        setCompareRows(result.compare);
      } else {
        setChartData([]);
        setCompareRows([]);
        setNoData(true);
      }
      setDataLoading(false);
    });

    return () => { cancelled = true; };
  }, [selectedProject, granularity]);

  // 骨架屏
  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-slate-50 to-white dark:from-gray-950 dark:to-gray-900">
      <div className="mx-auto max-w-5xl px-5 pt-8 pb-24 md:px-8 md:pt-10">
        <div className="skeleton h-8 w-20 mb-2" />
        <div className="skeleton h-4 w-40 mb-4" />
        <div className="skeleton h-9 w-full rounded-xl mb-4" />
        <div className="skeleton h-9 w-48 rounded-xl mb-4" />
        <div className="skeleton h-64 rounded-2xl mb-4" />
        <div className="skeleton h-40 rounded-2xl" />
      </div>
      </div>
    );
  }

  const tabOptions: { key: TimeGranularity; label: string }[] = [
    { key: "day", label: "日" },
    { key: "week", label: "周" },
    { key: "month", label: "月" },
    { key: "quarter", label: "季" },
  ];

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-50 to-white dark:from-gray-950 dark:to-gray-900 text-slate-900 dark:text-white">
      <div className="mx-auto max-w-5xl px-5 pt-8 pb-24 md:px-8 md:pt-10">
      {/* 标题 */}
      <h1 className="text-xl font-bold text-gray-900 mb-1">回顾</h1>
      <p className="text-sm text-gray-500 mb-5">查看历史数据，对比分析，调整计划</p>

      {/* 项目文字选项行 */}
      <div className="flex gap-2 overflow-x-auto pb-2 mb-4 scrollbar-hide">
        <button
          onClick={() => setSelectedName(null)}
          className={`shrink-0 px-4 py-2 text-sm font-medium rounded-xl transition-all ${
            selectedName === null
              ? "bg-orange-500 text-white shadow-sm"
              : "bg-gray-100 text-gray-700 hover:bg-gray-200"
          }`}
        >
          全部
        </button>
        {projects.map((p) => (
          <button
            key={p.id}
            onClick={() => setSelectedName(p.name)}
            className={`shrink-0 px-4 py-2 text-sm font-medium rounded-xl transition-all ${
              selectedName === p.name
                ? "bg-orange-500 text-white shadow-sm"
                : "bg-gray-100 text-gray-700 hover:bg-gray-200"
            }`}
          >
            {p.name}
          </button>
        ))}
      </div>

      {/* 全部视图 */}
      {selectedName === null ? (
        <AllSummaryView />
      ) : (
        <>
          {/* 时间范围 Tab + 对比模式切换 */}
          <div className="flex items-center justify-between mb-4">
            <div className="flex gap-1 bg-gray-100 rounded-lg p-1">
              {tabOptions.map(({ key, label }) => (
                <button
                  key={key}
                  onClick={() => setGranularity(key)}
                  className={`px-3 py-1.5 text-xs font-medium rounded-md transition-all ${
                    granularity === key
                      ? "bg-white text-gray-900 shadow-sm"
                      : "text-gray-500 hover:text-gray-700"
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>

            <div className="flex gap-1 bg-gray-100 rounded-lg p-1">
              <button
                onClick={() => setCompareMode("time")}
                className={`px-3 py-1.5 text-xs font-medium rounded-md transition-all ${
                  compareMode === "time"
                    ? "bg-white text-gray-900 shadow-sm"
                    : "text-gray-500 hover:text-gray-700"
                }`}
              >
                时间对比
              </button>
              <button
                onClick={() => setCompareMode("goal")}
                className={`px-3 py-1.5 text-xs font-medium rounded-md transition-all ${
                  compareMode === "goal"
                    ? "bg-white text-gray-900 shadow-sm"
                    : "text-gray-500 hover:text-gray-700"
                }`}
              >
                目标对比
              </button>
            </div>
          </div>

          {/* 图表区 */}
          {dataLoading ? (
            <div className="flex items-center justify-center py-16">
              <div className="w-5 h-5 border-2 border-gray-300 border-t-gray-600 rounded-full animate-spin" />
            </div>
          ) : noData ? (
            <EmptyChart />
          ) : (
            <AnimatePresence mode="wait">
              <motion.div
                key={`${selectedProject?.name}-${granularity}`}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.2 }}
                className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4 mb-4"
              >
                <p className="text-xs text-gray-500 mb-3">
                  {metrics?.line1Label} & {metrics?.line2Label} 趋势
                </p>
                <ResponsiveContainer width="100%" height={260}>
                  <LineChart data={chartData}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                    <XAxis dataKey="date" tick={{ fontSize: 11, fill: "#9ca3af" }} tickLine={false} />
                    <YAxis tick={{ fontSize: 11, fill: "#9ca3af" }} tickLine={false} />
                    <Tooltip
                      contentStyle={{ borderRadius: 12, border: "1px solid #e5e7eb", fontSize: 13 }}
                      formatter={(value, name) => [value, name] as [number, string]}
                    />
                    <Legend
                      wrapperStyle={{ fontSize: 11 }}
                    />
                    {metrics && (
                      <>
                        <Line
                          type="monotone"
                          dataKey="v1"
                          name={metrics.line1Label}
                          stroke={metrics.line1Color}
                          strokeWidth={2}
                          dot={{ fill: metrics.line1Color, r: 2 }}
                          activeDot={{ r: 4 }}
                        />
                        <Line
                          type="monotone"
                          dataKey="v2"
                          name={metrics.line2Label}
                          stroke={metrics.line2Color}
                          strokeWidth={2}
                          dot={{ fill: metrics.line2Color, r: 2 }}
                          activeDot={{ r: 4 }}
                        />
                      </>
                    )}
                  </LineChart>
                </ResponsiveContainer>
              </motion.div>
            </AnimatePresence>
          )}

          {/* 对比表 */}
          {!dataLoading && !noData && metrics && (
            <CompareTable rows={compareRows} compareMode={compareMode} metrics={metrics} />
          )}
        </>
      )}
    </div>
    </div>
  );
}
