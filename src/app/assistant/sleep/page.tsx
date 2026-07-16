"use client";

import { useEffect, useState, useCallback } from "react";
import { ChevronLeft, Moon, Bell, BellOff, Award, Flame, TrendingUp } from "lucide-react";
import Link from "next/link";
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
} from "recharts";
import { getDaySchedule, getAllProjectsV2, getGoalsByProject, addSleepRecord, getRecentSleepRecords, updateSleepRecord } from "@/lib/db";
import { showToast } from "@/components/ui/Toast";
import { useRouter } from "next/navigation";
import { notifyGoalProgressUpdate } from "@/lib/linkage";
import type { Goal, SleepRecord } from "@/lib/types";

function getLocalDate(d: Date = new Date()): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function shiftDate(date: string, days: number): string {
  const d = new Date(date + "T00:00:00");
  d.setDate(d.getDate() + days);
  return getLocalDate(d);
}

function formatTime(minutes: number): string {
  const h = Math.floor(minutes / 60);
  const m = Math.round(minutes % 60);
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}

interface SleepLog {
  date: string;
  sleepTime: number; // minutes from midnight (e.g. 23:30 = 1410)
  label: string;
}

export default function SleepPage() {
  const [targetTime, setTargetTime] = useState("23:30");
  const [wakeTargetTime, setWakeTargetTime] = useState("07:00");
  const [reminderEnabled, setReminderEnabled] = useState(false);
  const [reminderAdvance, setReminderAdvance] = useState(15);
  const [sleepRecords, setSleepRecords] = useState<SleepRecord[]>([]);
  const [logs, setLogs] = useState<SleepLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [goals, setGoals] = useState<Goal[]>([]);
  const [selectedGoalId, setSelectedGoalId] = useState<number | null>(null);
  const router = useRouter();

  // ---- 本地设置加载 ----
  useEffect(() => {
    const saved = localStorage.getItem("sleep_target");
    if (saved) setTargetTime(saved);
    const savedWake = localStorage.getItem("sleep_wake_target");
    if (savedWake) setWakeTargetTime(savedWake);
    const savedRemind = localStorage.getItem("sleep_reminder_enabled");
    setReminderEnabled(savedRemind === "true");
    const savedAdvance = localStorage.getItem("sleep_reminder_advance");
    if (savedAdvance) setReminderAdvance(Number(savedAdvance));
  }, []);

  useEffect(() => {
    const loadGoals = async () => {
      try {
        const allProjects = await getAllProjectsV2();
        const allGoals: Goal[] = [];
        for (const p of allProjects) {
          const g = await getGoalsByProject(p.id!);
          allGoals.push(...g.filter(g => g.type === "sleep" && (g.status === "active" || g.status === "paused")));
        }
        setGoals(allGoals);
      } catch {}
    };
    loadGoals();
  }, []);

  const saveTarget = (val: string) => {
    setTargetTime(val);
    localStorage.setItem("sleep_target", val);
  };

  const saveWakeTarget = (val: string) => {
    setWakeTargetTime(val);
    localStorage.setItem("sleep_wake_target", val);
  };

  const saveAdvance = (val: number) => {
    setReminderAdvance(val);
    localStorage.setItem("sleep_reminder_advance", String(val));
  };

  // ---- 定时提醒 ----
  const scheduleReminder = useCallback((time: string, advance: number) => {
    const existingId = localStorage.getItem("sleep_reminder_timeout");
    if (existingId) clearTimeout(Number(existingId));

    const [h, m] = time.split(":").map(Number);
    const targetMin = h * 60 + m;
    const reminderMin = targetMin - advance;
    const now = new Date();
    const nowMin = now.getHours() * 60 + now.getMinutes();
    let delayMs = (reminderMin - nowMin) * 60 * 1000;
    if (delayMs <= 0) delayMs += 24 * 60 * 60 * 1000;

    const timeoutId = window.setTimeout(() => {
      if ("Notification" in window && Notification.permission === "granted") {
        new Notification("\u{1F319} 该睡觉了", {
          body: `距离目标入睡时间还有${advance}分钟，准备休息吧`,
          icon: "/favicon.ico",
        });
      }
      scheduleReminder(time, advance);
    }, delayMs);

    localStorage.setItem("sleep_reminder_timeout", String(timeoutId));
  }, []);

  const toggleReminder = () => {
    const next = !reminderEnabled;
    setReminderEnabled(next);
    localStorage.setItem("sleep_reminder_enabled", String(next));

    if (next && "Notification" in window) {
      Notification.requestPermission().then((perm) => {
        if (perm === "granted") {
          scheduleReminder(targetTime, reminderAdvance);
          showToast({ message: "入睡提醒已开启", type: "success" });
        } else {
          showToast({ message: "需要通知权限才能推送提醒", type: "warning" });
        }
      });
    } else if (!next) {
      showToast({ message: "入睡提醒已关闭", type: "info" });
    }
  };

  // 提醒提前量变化时重新调度
  useEffect(() => {
    if (reminderEnabled) scheduleReminder(targetTime, reminderAdvance);
  }, [reminderAdvance, targetTime, reminderEnabled, scheduleReminder]);

  // ---- 加载睡眠数据（从 Dexie sleepRecords 表） ----
  const loadSleepData = useCallback(async () => {
    setLoading(true);
    try {
      const records = await getRecentSleepRecords(30);
      setSleepRecords(records);

      // 转换为 SleepLog 格式供 UI 使用
      const results: SleepLog[] = [];
      for (const r of records) {
        const [sh, sm] = r.sleepTime.split(":").map(Number);
        const sleepMinutes = sh * 60 + sm;
        const d = new Date(r.date + "T00:00:00");
        const label = `${d.getMonth() + 1}/${d.getDate()}`;
        results.push({ date: r.date, sleepTime: sleepMinutes, label });
      }
      results.sort((a, b) => a.date.localeCompare(b.date));
      setLogs(results);
    } catch (err) {
      console.error("Failed to load sleep data:", err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadSleepData(); }, [loadSleepData]);

  // ---- 统计 ----
  const avgMin = logs.length > 0
    ? logs.reduce((sum, l) => sum + l.sleepTime, 0) / logs.length
    : 0;
  const avgLabel = formatTime(avgMin);

  // 今日入睡是否达标
  const today = getLocalDate();
  const [th, tm] = targetTime.split(":").map(Number);
  const targetMinutes = th * 60 + tm;
  const todayLog = logs.find((l) => l.date === today);
  const todayCompliant = todayLog ? todayLog.sleepTime <= targetMinutes : null;

  // 连续早睡天数
  const consecutiveDays = (() => {
    let count = 0;
    for (let i = 0; i < 365; i++) {
      const checkDate = shiftDate(today, -(i + 1));
      const entry = logs.find((l) => l.date === checkDate);
      if (!entry) break;
      if (entry.sleepTime > targetMinutes) break;
      count++;
    }
    return count;
  })();

  // 周趋势（最近7天，简易缩略用）
  const weekData = logs.slice(-7).map((l) => ({
    ...l,
    timeLabel: formatTime(l.sleepTime),
  }));

  // ---- 手动记录睡眠（写入 Dexie） ----
  const [calDate, setCalDate] = useState(today);
  const [calSleepTime, setCalSleepTime] = useState("23:00");
  const [calWakeTime, setCalWakeTime] = useState("07:00");
  const [calQuality, setCalQuality] = useState(3);
  const [calNote, setCalNote] = useState("");

  const addSleepEntry = async () => {
    const [sh, sm] = calSleepTime.split(":").map(Number);
    const [wh, wm] = calWakeTime.split(":").map(Number);
    const sleepMin = sh * 60 + sm;
    const wakeMin = wh * 60 + wm;
    const duration = wakeMin > sleepMin
      ? (wakeMin - sleepMin) / 60
      : (24 * 60 - sleepMin + wakeMin) / 60;

    await addSleepRecord({
      sleepDuration: Math.round(duration * 10) / 10,
      sleepTime: calSleepTime,
      wakeTime: calWakeTime,
      sleepQuality: calQuality,
      date: calDate,
      timestamp: Date.now(),
      notes: calNote || undefined,
      goalId: selectedGoalId ?? undefined,
    });

    showToast({ message: `已记录 ${calDate} 睡眠`, type: "success" });
    if (selectedGoalId) { notifyGoalProgressUpdate(selectedGoalId); }
    loadSleepData();
  };

  const deleteSleepEntry = async (recordId?: number) => {
    if (!recordId) return;
    const { deleteSleepRecord } = await import("@/lib/db");
    await deleteSleepRecord(recordId);
    showToast({ message: "已删除记录", type: "info" });
    loadSleepData();
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-50 to-white dark:from-gray-950 dark:to-gray-900 text-slate-900 dark:text-white">
      <div className="mx-auto max-w-5xl px-5 pt-8 pb-24 md:px-8 md:pt-10">
        {/* 头部 */}
        <div className="flex items-center gap-2 mb-6">
          <Link href="/assistant" className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800">
            <ChevronLeft className="w-5 h-5 text-gray-400" />
          </Link>
          <div>
            <h1 className="text-xl font-bold text-gray-900 dark:text-white">早睡分析</h1>
            <p className="text-xs text-gray-400">基于日程校准的入睡时间</p>
          </div>
        </div>

        {/* 关联睡眠目标 */}
        {goals.length > 0 && (
          <div className="mb-4 bg-indigo-50 dark:bg-indigo-900/20 rounded-xl p-3 mx-4">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-medium text-indigo-700 dark:text-indigo-300 flex items-center gap-1">
                <Moon className="w-3.5 h-3.5" /> 关联睡眠目标
              </span>
              <select
                value={selectedGoalId ?? ""}
                onChange={(e) => setSelectedGoalId(e.target.value ? Number(e.target.value) : null)}
                className="text-xs bg-white dark:bg-gray-800 rounded-lg px-2 py-1 border-0"
              >
                <option value="">不关联</option>
                {goals.map(g => (
                  <option key={g.id} value={g.id}>{g.name} ({g.progress}%)</option>
                ))}
              </select>
            </div>
            {selectedGoalId && (() => {
              const g = goals.find(g => g.id === selectedGoalId);
              if (!g) return null;
              return (
                <button onClick={() => router.push(`/goals/${g.id}`)} className="w-full text-left">
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-gray-700 dark:text-gray-300">{g.name}</span>
                    <span className="font-medium">{g.progress}%</span>
                  </div>
                  <div className="h-1.5 bg-gray-200 dark:bg-gray-700 rounded-full mt-1 overflow-hidden">
                    <div className={`h-full rounded-full transition-all ${g.progress >= 100 ? "bg-emerald-500" : g.progress >= 50 ? "bg-blue-500" : "bg-red-500"}`} style={{ width: `${Math.min(g.progress, 100)}%` }} />
                  </div>
                </button>
              );
            })()}
          </div>
        )}

        {/* 今日达标进度 + 连续早睡徽章 */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-4">
          {/* 进度条卡片 */}
          <div className="bg-white dark:bg-gray-900 border border-gray-100 dark:border-gray-800 rounded-2xl p-5">
            <h3 className="text-sm font-bold text-gray-900 dark:text-white flex items-center gap-2 mb-3">
              <Award className="w-4 h-4 text-indigo-500" /> 今日睡眠达标
            </h3>
            {loading ? (
              <div className="h-10 skeleton rounded-lg" />
            ) : todayCompliant === null ? (
              <div className="text-center py-2">
                <p className="text-sm text-gray-400">等待录入</p>
                <p className="text-xs text-gray-300 mt-0.5">当日暂无睡眠数据</p>
              </div>
            ) : (
              <>
                <div className="flex items-center justify-between text-xs mb-1.5">
                  <span className="text-gray-500">目标: {targetTime}</span>
                  <span className="text-gray-500">实际: {formatTime(todayLog!.sleepTime)}</span>
                </div>
                <div className="relative w-full h-3 bg-gray-100 dark:bg-gray-800 rounded-full overflow-hidden">
                  {/* 目标线标记 */}
                  <div className="absolute top-0 bottom-0 w-0.5 bg-indigo-500 z-10"
                    style={{ left: `${Math.min(100, Math.max(0, (targetMinutes / (26 * 60)) * 100))}%` }} />
                  {/* 实际入睡时间 */}
                  <div
                    className={`absolute top-0 bottom-0 rounded-full transition-all ${
                      todayCompliant ? "bg-emerald-400" : "bg-rose-400"
                    }`}
                    style={{ width: `${Math.min(100, Math.max(0, ((todayLog?.sleepTime || 0) / (26 * 60)) * 100))}%` }}
                  />
                </div>
                <div className="flex items-center gap-2 mt-2">
                  <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${
                    todayCompliant
                      ? "bg-emerald-50 dark:bg-emerald-900/20 text-emerald-600 dark:text-emerald-400"
                      : "bg-rose-50 dark:bg-rose-900/20 text-rose-600 dark:text-rose-400"
                  }`}>
                    {todayCompliant ? "✓ 已达标" : "✗ 未达标"}
                  </span>
                  <span className="text-xs text-gray-400">
                    {todayCompliant ? "比目标早" : "比目标晚"}
                    {" "}
                    {formatTime(Math.abs((todayLog?.sleepTime || 0) - targetMinutes))}
                  </span>
                </div>
              </>
            )}
          </div>

          {/* 连续早睡徽章 */}
          <div className="bg-white dark:bg-gray-900 border border-gray-100 dark:border-gray-800 rounded-2xl p-5">
            <h3 className="text-sm font-bold text-gray-900 dark:text-white flex items-center gap-2 mb-3">
              <Flame className="w-4 h-4 text-orange-500" /> 连续早睡
            </h3>
            <div className="flex items-end gap-3">
              <span className="text-4xl font-bold text-orange-500">{consecutiveDays}</span>
              <span className="text-sm text-gray-400 mb-1">天</span>
              {consecutiveDays >= 7 && (
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-orange-50 dark:bg-orange-900/20 text-orange-600 dark:text-orange-400 mb-1">
                  🔥 {consecutiveDays >= 30 ? "王者" : consecutiveDays >= 21 ? "钻石" : consecutiveDays >= 14 ? "黄金" : "白银"}
                </span>
              )}
            </div>
            <p className="text-xs text-gray-400 mt-1">
              {consecutiveDays === 0 ? "暂无连续早睡记录，从今天开始吧" : `已连续 ${consecutiveDays} 天早于目标入睡`}
            </p>
          </div>
        </div>

        {/* 设定入睡目标 + 起床目标 */}
        <div className="bg-white dark:bg-gray-900 border border-gray-100 dark:border-gray-800 rounded-2xl p-5 mb-4">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-sm font-bold text-gray-900 dark:text-white flex items-center gap-2">
              <Moon className="w-4 h-4 text-indigo-500" /> 睡眠目标
            </h3>
            <button
              onClick={toggleReminder}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                reminderEnabled
                  ? "bg-indigo-50 dark:bg-indigo-900/20 text-indigo-600 dark:text-indigo-400"
                  : "bg-gray-50 dark:bg-gray-800 text-gray-500"
              }`}
            >
              {reminderEnabled ? <Bell className="w-3.5 h-3.5" /> : <BellOff className="w-3.5 h-3.5" />}
              {reminderEnabled ? "提醒已开" : "提醒已关"}
            </button>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs text-gray-400">入睡目标</label>
              <input
                type="time"
                value={targetTime}
                onChange={(e) => { saveTarget(e.target.value); if (reminderEnabled) scheduleReminder(e.target.value, reminderAdvance); }}
                className="w-full mt-1 px-3 py-2 rounded-xl bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
            </div>
            <div>
              <label className="text-xs text-gray-400">起床目标</label>
              <input
                type="time"
                value={wakeTargetTime}
                onChange={(e) => saveWakeTarget(e.target.value)}
                className="w-full mt-1 px-3 py-2 rounded-xl bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
            </div>
          </div>

          {/* 提醒提前时长滑块 */}
          <div className="mt-4 pt-4 border-t border-gray-100 dark:border-gray-800">
            <div className="flex items-center justify-between mb-2">
              <label className="text-xs font-medium text-gray-500">提醒提前时长</label>
              <span className="text-xs font-bold text-indigo-500">{reminderAdvance} 分钟</span>
            </div>
            <input
              type="range"
              min="5"
              max="60"
              step="5"
              value={reminderAdvance}
              onChange={(e) => saveAdvance(Number(e.target.value))}
              className="w-full h-2 bg-gray-200 dark:bg-gray-700 rounded-lg appearance-none cursor-pointer accent-indigo-500"
            />
            <div className="flex justify-between text-[10px] text-gray-400 mt-1">
              <span>5分钟</span>
              <span>60分钟</span>
            </div>
          </div>
        </div>

        {/* 30天平均入睡时间（精简版） */}
        <div className="bg-white dark:bg-gray-900 border border-gray-100 dark:border-gray-800 rounded-2xl p-5 mb-4">
          <h3 className="text-sm font-bold text-gray-900 dark:text-white mb-2">30天平均入睡时间</h3>
          <div className="flex items-baseline gap-2">
            <span className="text-lg font-semibold text-indigo-500">{avgLabel}</span>
            <span className="text-xs text-gray-400">{logs.length} 天数据</span>
          </div>
        </div>

        {/* 7天简易缩略折线 */}
        <div className="bg-white dark:bg-gray-900 border border-gray-100 dark:border-gray-800 rounded-2xl p-5 mb-4">
          <h3 className="text-sm font-bold text-gray-900 dark:text-white mb-3">入睡时间趋势（最近7天）</h3>
          {loading ? (
            <div className="skeleton h-32 rounded-xl" />
          ) : weekData.length === 0 ? (
            <p className="text-xs text-gray-400 py-8 text-center">暂无数据</p>
          ) : (
            <ResponsiveContainer width="100%" height={140}>
              <LineChart data={weekData} margin={{ top: 5, right: 5, left: 0, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                <XAxis dataKey="label" tick={{ fontSize: 10 }} stroke="#9ca3af" axisLine={false} tickLine={false} />
                <YAxis
                  domain={[21 * 60, 26 * 60]}
                  tickFormatter={(v) => formatTime(v)}
                  tick={{ fontSize: 10 }}
                  stroke="#9ca3af"
                  axisLine={false}
                  tickLine={false}
                  width={40}
                />
                <Tooltip
                  formatter={(value: any) => [formatTime(Number(value)), "入睡"]}
                  labelFormatter={(label: any) => `${label}`}
                />
                <Line
                  type="monotone"
                  dataKey="sleepTime"
                  stroke="#6366f1"
                  strokeWidth={2}
                  dot={{ r: 3, fill: "#6366f1" }}
                  activeDot={{ r: 5 }}
                />
              </LineChart>
            </ResponsiveContainer>
          )}
        </div>

        {/* 手动记录睡眠（写入 Dexie sleepRecords） */}
        <div className="bg-white dark:bg-gray-900 border border-gray-100 dark:border-gray-800 rounded-2xl p-5 mb-4">
          <h3 className="text-sm font-bold text-gray-900 dark:text-white mb-3">记录睡眠</h3>
          <div className="grid grid-cols-2 gap-3 mb-3">
            <div>
              <label className="text-[10px] text-gray-400">日期</label>
              <input type="date" value={calDate} onChange={(e) => setCalDate(e.target.value)}
                className="w-full mt-0.5 px-3 py-2 rounded-xl bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 text-xs focus:outline-none focus:ring-2 focus:ring-indigo-500" />
            </div>
            <div>
              <label className="text-[10px] text-gray-400">入睡时间</label>
              <input type="time" value={calSleepTime} onChange={(e) => setCalSleepTime(e.target.value)}
                className="w-full mt-0.5 px-3 py-2 rounded-xl bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 text-xs focus:outline-none focus:ring-2 focus:ring-indigo-500" />
            </div>
            <div>
              <label className="text-[10px] text-gray-400">起床时间</label>
              <input type="time" value={calWakeTime} onChange={(e) => setCalWakeTime(e.target.value)}
                className="w-full mt-0.5 px-3 py-2 rounded-xl bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 text-xs focus:outline-none focus:ring-2 focus:ring-indigo-500" />
            </div>
            <div>
              <label className="text-[10px] text-gray-400">睡眠质量（1-5星）</label>
              <div className="flex gap-0.5 mt-1">
                {[1, 2, 3, 4, 5].map((s) => (
                  <button key={s} onClick={() => setCalQuality(s)}
                    className={`w-7 h-7 rounded text-xs ${s <= calQuality ? "text-amber-500" : "text-gray-300"}`}>
                    ★
                  </button>
                ))}
              </div>
            </div>
          </div>
          <input
            type="text" value={calNote} onChange={(e) => setCalNote(e.target.value)}
            placeholder="备注（可选）"
            className="w-full px-3 py-2 rounded-xl bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 text-xs focus:outline-none focus:ring-2 focus:ring-indigo-500 mb-3"
          />
          <button
            onClick={addSleepEntry}
            className="px-4 py-2 rounded-xl bg-indigo-500 hover:bg-indigo-600 text-white text-xs font-medium transition-colors"
          >
            保存记录
          </button>
        </div>

        {/* 最近记录列表 */}
        {sleepRecords.length > 0 && (
          <div className="bg-white dark:bg-gray-900 border border-gray-100 dark:border-gray-800 rounded-2xl p-5 mb-4">
            <h3 className="text-sm font-bold text-gray-900 dark:text-white mb-2">最近记录</h3>
            <div className="space-y-1.5">
              {sleepRecords.slice(0, 10).map((r) => (
                <div key={r.id} className="flex items-center gap-2 text-xs py-1">
                  <span className="text-gray-400 w-14">{r.date.slice(5)}</span>
                  <span className="text-gray-600 dark:text-gray-400">{r.sleepTime}→{r.wakeTime}</span>
                  <span className="text-gray-400">{r.sleepDuration}h</span>
                  <span className="text-amber-500">{'★'.repeat(r.sleepQuality)}</span>
                  {r.isPersonalBest && <span className="text-[10px] px-1 rounded bg-amber-100 text-amber-600">PB</span>}
                  <button onClick={() => deleteSleepEntry(r.id)} className="ml-auto text-gray-300 hover:text-red-500">×</button>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* 底部跳转按钮 */}
        <Link
          href="/stats#sleep"
          className="flex items-center justify-center gap-2 w-full py-3 rounded-2xl bg-white dark:bg-gray-900 border border-gray-100 dark:border-gray-800 text-sm font-medium text-indigo-500 hover:bg-indigo-50 dark:hover:bg-indigo-900/20 transition-colors"
        >
          <TrendingUp className="w-4 h-4" />
          查看完整睡眠作息统计 →
        </Link>
      </div>
    </div>
  );
}
