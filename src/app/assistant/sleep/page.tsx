"use client";

import { useEffect, useState, useCallback } from "react";
import { ChevronLeft, Moon, Bell, BellOff, Award, Flame, TrendingUp } from "lucide-react";
import Link from "next/link";
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
} from "recharts";
import { getDaySchedule } from "@/lib/db";
import { showToast } from "@/components/ui/Toast";

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
  const [reminderEnabled, setReminderEnabled] = useState(false);
  const [reminderAdvance, setReminderAdvance] = useState(15);
  const [calibrations, setCalibrations] = useState<Record<string, number>>({});
  const [logs, setLogs] = useState<SleepLog[]>([]);
  const [loading, setLoading] = useState(true);

  // ---- 本地设置加载 ----
  useEffect(() => {
    const saved = localStorage.getItem("sleep_target");
    if (saved) setTargetTime(saved);
    const savedRemind = localStorage.getItem("sleep_reminder_enabled");
    setReminderEnabled(savedRemind === "true");
    const savedAdvance = localStorage.getItem("sleep_reminder_advance");
    if (savedAdvance) setReminderAdvance(Number(savedAdvance));
    try {
      const savedCal = localStorage.getItem("sleep_calibrations");
      if (savedCal) setCalibrations(JSON.parse(savedCal));
    } catch { /* ignore parse errors */ }
  }, []);

  const saveTarget = (val: string) => {
    setTargetTime(val);
    localStorage.setItem("sleep_target", val);
  };

  const saveAdvance = (val: number) => {
    setReminderAdvance(val);
    localStorage.setItem("sleep_reminder_advance", String(val));
  };

  const saveCalibrations = (cal: Record<string, number>) => {
    setCalibrations(cal);
    localStorage.setItem("sleep_calibrations", JSON.stringify(cal));
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

  // ---- 加载睡眠数据 + 覆盖手动校准 ----
  useEffect(() => {
    const load = async () => {
      setLoading(true);
      try {
        const results: SleepLog[] = [];
        const today = getLocalDate();
        for (let i = 29; i >= 0; i--) {
          const date = shiftDate(today, -i);
          const ds = await getDaySchedule(date);
          if (!ds?.events) continue;

          let sleepMinutes = 0;
          let isNight = false;
          for (const ev of ds.events) {
            if (!ev.title?.includes("睡")) continue;
            const start = ev.actualStartTime || ev.startTime;
            if (!start) continue;
            const [sh, sm] = start.split(":").map(Number);
            const startMin = sh * 60 + sm;
            if (startMin >= 18 * 60 || startMin < 6 * 60) {
              sleepMinutes = startMin;
              isNight = true;
            }
          }
          if (isNight) {
            const d = new Date(date + "T00:00:00");
            const label = `${d.getMonth() + 1}/${d.getDate()}`;
            results.push({ date, sleepTime: sleepMinutes, label });
          }
        }

        // 覆盖手动校准数据
        const calRaw = localStorage.getItem("sleep_calibrations");
        if (calRaw) {
          try {
            const cal: Record<string, number> = JSON.parse(calRaw);
            for (const [date, minutes] of Object.entries(cal)) {
              const existing = results.find((r) => r.date === date);
              if (existing) {
                existing.sleepTime = minutes;
              } else {
                const d = new Date(date + "T00:00:00");
                const label = `${d.getMonth() + 1}/${d.getDate()}`;
                results.push({ date, sleepTime: minutes, label });
              }
            }
          } catch { /* ignore */ }
        }

        results.sort((a, b) => a.date.localeCompare(b.date));
        setLogs(results);
      } catch (err) {
        console.error("Failed to load sleep data:", err);
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [calibrations]);

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

  // ---- 手动校准 ----
  const [calDate, setCalDate] = useState(today);
  const [calTime, setCalTime] = useState("23:00");

  const addCalibration = () => {
    const [h, m] = calTime.split(":").map(Number);
    const minutes = h * 60 + m;
    const updated = { ...calibrations, [calDate]: minutes };
    saveCalibrations(updated);
    showToast({ message: `已校准 ${calDate} 入睡时间为 ${calTime}`, type: "success" });
  };

  const removeCalibration = (date: string) => {
    const updated = { ...calibrations };
    delete updated[date];
    saveCalibrations(updated);
    showToast({ message: `已移除 ${date} 的校准数据`, type: "info" });
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

        {/* 设定目标 + 提醒设置 */}
        <div className="bg-white dark:bg-gray-900 border border-gray-100 dark:border-gray-800 rounded-2xl p-5 mb-4">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-sm font-bold text-gray-900 dark:text-white flex items-center gap-2">
              <Moon className="w-4 h-4 text-indigo-500" /> 入睡目标
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
          <div className="flex items-center gap-4">
            <input
              type="time"
              value={targetTime}
              onChange={(e) => { saveTarget(e.target.value); if (reminderEnabled) scheduleReminder(e.target.value, reminderAdvance); }}
              className="px-4 py-2.5 rounded-xl bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 text-sm font-mono
                focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
            <div className="text-xs text-gray-400">
              <p>提前{reminderAdvance}分钟提醒</p>
              <p className="text-indigo-500 font-medium mt-0.5">
                {(() => {
                  const [h, m] = targetTime.split(":").map(Number);
                  let rm = (h * 60 + m) - reminderAdvance;
                  if (rm < 0) rm += 24 * 60;
                  return `提醒时间: ${formatTime(rm)}`;
                })()}
              </p>
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

        {/* 手动校准入睡时间 */}
        <div className="bg-white dark:bg-gray-900 border border-gray-100 dark:border-gray-800 rounded-2xl p-5 mb-4">
          <h3 className="text-sm font-bold text-gray-900 dark:text-white mb-3">手动校准入睡时间</h3>
          <p className="text-xs text-gray-400 mb-3">若某天日程未能准确反映实际入睡时间，可在此手动校准覆盖</p>

          <div className="flex flex-wrap items-end gap-3 mb-3">
            <div className="flex flex-col gap-1">
              <label className="text-[10px] text-gray-400">日期</label>
              <input
                type="date"
                value={calDate}
                onChange={(e) => setCalDate(e.target.value)}
                className="px-3 py-2 rounded-xl bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 text-xs font-mono
                  focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-[10px] text-gray-400">入睡时间</label>
              <input
                type="time"
                value={calTime}
                onChange={(e) => setCalTime(e.target.value)}
                className="px-3 py-2 rounded-xl bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 text-xs font-mono
                  focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
            </div>
            <button
              onClick={addCalibration}
              className="px-4 py-2 rounded-xl bg-indigo-500 hover:bg-indigo-600 text-white text-xs font-medium transition-colors"
            >
              保存校准
            </button>
          </div>

          {/* 已有校准列表 */}
          {Object.keys(calibrations).length > 0 && (
            <div>
              <p className="text-[10px] text-gray-400 mb-1.5">已有校准记录</p>
              <div className="flex flex-wrap gap-1.5">
                {Object.entries(calibrations)
                  .sort(([a], [b]) => b.localeCompare(a))
                  .map(([date, minutes]) => {
                    const d = new Date(date + "T00:00:00");
                    const label = `${d.getMonth() + 1}/${d.getDate()}`;
                    return (
                      <span
                        key={date}
                        className="inline-flex items-center gap-1.5 px-2 py-1 rounded-lg bg-indigo-50 dark:bg-indigo-900/20 text-xs text-indigo-600 dark:text-indigo-400"
                      >
                        {label} → {formatTime(minutes)}
                        <button
                          onClick={() => removeCalibration(date)}
                          className="ml-0.5 w-4 h-4 flex items-center justify-center rounded-full hover:bg-indigo-200 dark:hover:bg-indigo-800 text-indigo-400 hover:text-indigo-600 transition-colors"
                        >
                          ×
                        </button>
                      </span>
                    );
                  })}
              </div>
            </div>
          )}
        </div>

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
