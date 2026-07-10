"use client";

import { useEffect, useState, useCallback } from "react";
import { ChevronLeft, Moon, Bell, BellOff } from "lucide-react";
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
  const [logs, setLogs] = useState<SleepLog[]>([]);
  const [loading, setLoading] = useState(true);

  // 加载本地设置
  useEffect(() => {
    const saved = localStorage.getItem("sleep_target");
    if (saved) setTargetTime(saved);
    const savedRemind = localStorage.getItem("sleep_reminder_enabled");
    setReminderEnabled(savedRemind === "true");
  }, []);

  const saveTarget = (val: string) => {
    setTargetTime(val);
    localStorage.setItem("sleep_target", val);
  };

  const toggleReminder = () => {
    const next = !reminderEnabled;
    setReminderEnabled(next);
    localStorage.setItem("sleep_reminder_enabled", String(next));

    if (next && "Notification" in window) {
      Notification.requestPermission().then((perm) => {
        if (perm === "granted") {
          scheduleReminder(targetTime);
          showToast({ message: "入睡提醒已开启", type: "success" });
        } else {
          showToast({ message: "需要通知权限才能推送提醒", type: "warning" });
        }
      });
    } else if (!next) {
      showToast({ message: "入睡提醒已关闭", type: "info" });
    }
  };

  const scheduleReminder = useCallback((time: string) => {
    // 清除旧定时器
    const existingId = localStorage.getItem("sleep_reminder_timeout");
    if (existingId) clearTimeout(Number(existingId));

    const [h, m] = time.split(":").map(Number);
    const targetMin = h * 60 + m;
    const reminderMin = targetMin - 15; // 提前15分钟
    const now = new Date();
    const nowMin = now.getHours() * 60 + now.getMinutes();
    let delayMs = (reminderMin - nowMin) * 60 * 1000;
    if (delayMs <= 0) delayMs += 24 * 60 * 60 * 1000;

    const timeoutId = window.setTimeout(() => {
      if ("Notification" in window && Notification.permission === "granted") {
        new Notification("🌙 该睡觉了", {
          body: `距离目标入睡时间还有15分钟，准备休息吧`,
          icon: "/favicon.ico",
        });
      }
      // 重新调度明天的提醒
      scheduleReminder(time);
    }, delayMs);

    localStorage.setItem("sleep_reminder_timeout", String(timeoutId));
  }, []);

  // 加载睡眠数据
  useEffect(() => {
    const load = async () => {
      setLoading(true);
      try {
        const results: SleepLog[] = [];
        const today = getLocalDate();
        // 取过去30天
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
            // 晚上睡觉（>18:00）
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
        setLogs(results);
      } catch (err) {
        console.error("Failed to load sleep data:", err);
      } finally {
        setLoading(false);
      }
    };
    load();
  }, []);

  // 统计
  const avgMin = logs.length > 0
    ? logs.reduce((sum, l) => sum + l.sleepTime, 0) / logs.length
    : 0;
  const avgLabel = formatTime(avgMin);

  // 周趋势数据（最近7天）
  const weekData = logs.slice(-7).map((l) => ({
    ...l,
    timeLabel: formatTime(l.sleepTime),
  }));

  // 月度热力图数据（最近30天）
  const monthGrid: (SleepLog | null)[] = [];
  const today = getLocalDate();
  for (let i = 29; i >= 0; i--) {
    const date = shiftDate(today, -i);
    const found = logs.find((l) => l.date === date);
    monthGrid.push(found || null);
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-50 to-white dark:from-gray-950 dark:to-gray-900 text-slate-900 dark:text-white">
      <div className="mx-auto max-w-5xl px-5 pt-8 pb-24 md:px-8 md:pt-10">
        <div className="flex items-center gap-2 mb-6">
          <Link href="/assistant" className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800">
            <ChevronLeft className="w-5 h-5 text-gray-400" />
          </Link>
          <div>
            <h1 className="text-xl font-bold text-gray-900 dark:text-white">早睡分析</h1>
            <p className="text-xs text-gray-400">基于日程校准的入睡时间</p>
          </div>
        </div>

        {/* 设定目标 */}
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
              onChange={(e) => { saveTarget(e.target.value); if (reminderEnabled) scheduleReminder(e.target.value); }}
              className="px-4 py-2.5 rounded-xl bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 text-sm font-mono
                focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
            <div className="text-xs text-gray-400">
              <p>提前15分钟提醒</p>
              <p className="text-indigo-500 font-medium mt-0.5">
                {(() => {
                  const [h, m] = targetTime.split(":").map(Number);
                  let rm = (h * 60 + m) - 15;
                  if (rm < 0) rm += 24 * 60;
                  return `提醒时间: ${formatTime(rm)}`;
                })()}
              </p>
            </div>
          </div>
        </div>

        {/* 平均入睡时间 */}
        <div className="bg-white dark:bg-gray-900 border border-gray-100 dark:border-gray-800 rounded-2xl p-5 mb-4">
          <h3 className="text-sm font-bold text-gray-900 dark:text-white mb-2">30天平均入睡时间</h3>
          <p className="text-3xl font-bold text-indigo-500">{avgLabel}</p>
          <p className="text-xs text-gray-400 mt-1">{logs.length} 天数据</p>
        </div>

        {/* 周趋势图 */}
        <div className="bg-white dark:bg-gray-900 border border-gray-100 dark:border-gray-800 rounded-2xl p-5 mb-4">
          <h3 className="text-sm font-bold text-gray-900 dark:text-white mb-3">入睡时间趋势（最近7天）</h3>
          {loading ? (
            <div className="skeleton h-48 rounded-xl" />
          ) : weekData.length === 0 ? (
            <p className="text-xs text-gray-400 py-8 text-center">暂无数据</p>
          ) : (
            <ResponsiveContainer width="100%" height={200}>
              <LineChart data={weekData} margin={{ top: 5, right: 10, left: 0, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                <XAxis dataKey="label" tick={{ fontSize: 11 }} stroke="#9ca3af" />
                <YAxis
                  domain={[21 * 60, 26 * 60]}
                  tickFormatter={(v) => formatTime(v)}
                  tick={{ fontSize: 11 }}
                  stroke="#9ca3af"
                />
                <Tooltip
                  formatter={(value: any) => [formatTime(Number(value)), "入睡时间"]}
                  labelFormatter={(label: any) => `${label}`}
                />
                <Line
                  type="monotone"
                  dataKey="sleepTime"
                  stroke="#6366f1"
                  strokeWidth={2}
                  dot={{ r: 4, fill: "#6366f1" }}
                  activeDot={{ r: 6 }}
                />
              </LineChart>
            </ResponsiveContainer>
          )}
        </div>

        {/* 月度热力图 */}
        <div className="bg-white dark:bg-gray-900 border border-gray-100 dark:border-gray-800 rounded-2xl p-5">
          <h3 className="text-sm font-bold text-gray-900 dark:text-white mb-3">月度热力图</h3>
          {loading ? (
            <div className="skeleton h-24 rounded-xl" />
          ) : (
            <div className="grid grid-cols-7 gap-1.5">
              {monthGrid.map((item, i) => {
                if (!item) return <div key={i} className="aspect-square rounded-md bg-gray-100 dark:bg-gray-800" />;
                // 颜色深浅：越早（接近21:00）= 越绿，越晚（接近02:00）= 越红
                const minutes = item.sleepTime;
                const hue = Math.max(0, Math.min(120, 120 - ((minutes - 21 * 60) / (6 * 60)) * 120));
                return (
                  <div
                    key={i}
                    className="aspect-square rounded-md flex items-center justify-center text-[9px] font-medium text-white"
                    style={{ backgroundColor: `hsl(${hue}, 60%, 50%)` }}
                    title={`${item.label} ${formatTime(minutes)}`}
                  >
                    {new Date(item.date + "T00:00:00").getDate()}
                  </div>
                );
              })}
            </div>
          )}
          <div className="flex items-center justify-between mt-2 text-[10px] text-gray-400">
            <span>← 较早</span>
            <span>较晚 →</span>
          </div>
        </div>
      </div>
    </div>
  );
}
