"use client";

import { useEffect, useState, useCallback } from "react";
import {
  ChevronLeft, Droplets, Bell, BellOff, Plus,
  Moon, Trash2, Undo2, ArrowRight,
} from "lucide-react";
import Link from "next/link";
import {
  getUserSettings, saveUserSettings,
  getTodayWaterRecord, addWaterIntake, undoLastWaterIntake,
  db, getAllProjectsV2, getGoalsByProject,
} from "@/lib/db";
import { showToast } from "@/components/ui/Toast";
import type { DailyWaterRecord, UserSettings, Goal } from "@/lib/types";
import { notifyGoalProgressUpdate } from "@/lib/linkage";
import { useRouter } from "next/navigation";

function toMinSec(ms: number) {
  const m = Math.floor(ms / 60000);
  const s = Math.floor((ms % 60000) / 1000);
  return `${m}分${s}秒`;
}

function formatTime(ts: number) {
  const d = new Date(ts);
  const h = String(d.getHours()).padStart(2, "0");
  const min = String(d.getMinutes()).padStart(2, "0");
  return `${h}:${min}`;
}

function isInDndPeriod(start: string, end: string): boolean {
  const now = new Date();
  const currentMin = now.getHours() * 60 + now.getMinutes();
  const [sh, sm] = start.split(":").map(Number);
  const [eh, em] = end.split(":").map(Number);
  const startMin = sh * 60 + sm;
  const endMin = eh * 60 + em;
  // e.g. 23:00 - 07:00 crosses midnight
  if (startMin <= endMin) {
    return currentMin >= startMin && currentMin < endMin;
  }
  return currentMin >= startMin || currentMin < endMin;
}

export default function WaterPage() {
  // ---- 提醒相关 ----
  const [enabled, setEnabled] = useState(false);
  const [intervalMin, setIntervalMin] = useState(90);
  const [cupSizes, setCupSizes] = useState([200, 300, 500]);
  const [countdown, setCountdown] = useState(0);
  const [nextReminder, setNextReminder] = useState(0);

  // ---- 免打扰 ----
  const [dndEnabled, setDndEnabled] = useState(false);
  const [dndStart, setDndStart] = useState("23:00");
  const [dndEnd, setDndEnd] = useState("07:00");

  // ---- 饮水目标 & 今日记录 ----
  const [waterTarget, setWaterTarget] = useState(2000);
  const [todayRecord, setTodayRecord] = useState<DailyWaterRecord | null>(null);
  const [goals, setGoals] = useState<Goal[]>([]);
  const [selectedGoalId, setSelectedGoalId] = useState<number | null>(null);
  const router = useRouter();

  // ========== 加载设置 ==========
  useEffect(() => {
    const savedEnabled = localStorage.getItem("water_reminder_enabled");
    setEnabled(savedEnabled === "true");
    const savedInterval = localStorage.getItem("water_reminder_interval");
    if (savedInterval) setIntervalMin(Number(savedInterval));

    const savedDnd = localStorage.getItem("water_dnd_enabled");
    setDndEnabled(savedDnd === "true");
    const savedDndStart = localStorage.getItem("water_dnd_start");
    if (savedDndStart) setDndStart(savedDndStart);
    const savedDndEnd = localStorage.getItem("water_dnd_end");
    if (savedDndEnd) setDndEnd(savedDndEnd);

    getUserSettings().then((s) => {
      if (s.cupSizes) setCupSizes(s.cupSizes);
      const wt = (s as UserSettings & { waterTarget?: number }).waterTarget;
      if (wt) setWaterTarget(wt);
    });

    loadTodayRecord();

    // 恢复定时器
    const savedNext = localStorage.getItem("water_reminder_next");
    if (savedNext && savedEnabled === "true") {
      setNextReminder(Number(savedNext));
    }
  }, []);

  useEffect(() => {
    const loadGoals = async () => {
      try {
        const allProjects = await getAllProjectsV2();
        const allGoals: Goal[] = [];
        for (const p of allProjects) {
          const g = await getGoalsByProject(p.id!);
          allGoals.push(...g.filter(g => g.type === "water" && (g.status === "active" || g.status === "paused")));
        }
        setGoals(allGoals);
      } catch {}
    };
    loadGoals();
  }, []);

  const loadTodayRecord = useCallback(async () => {
    const rec = await getTodayWaterRecord();
    setTodayRecord(rec);
  }, []);

  // ========== 倒计时 ==========
  useEffect(() => {
    if (!enabled || nextReminder === 0) return;
    const tick = () => setCountdown(Math.max(0, nextReminder - Date.now()));
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [enabled, nextReminder]);

  // ========== 提醒触发 ==========
  useEffect(() => {
    if (!enabled || nextReminder === 0) return;
    const delay = nextReminder - Date.now();
    if (delay <= 0) {
      fireReminder();
      return;
    }
    const id = setTimeout(() => fireReminder(), delay);
    return () => clearTimeout(id);
  }, [enabled, nextReminder]);

  const fireReminder = () => {
    // 夜间免打扰检查
    if (dndEnabled && isInDndPeriod(dndStart, dndEnd)) {
      const next = Date.now() + intervalMin * 60 * 1000;
      setNextReminder(next);
      localStorage.setItem("water_reminder_next", String(next));
      return;
    }
    // 浏览器通知
    if ("Notification" in window && Notification.permission === "granted" && document.hidden) {
      new Notification("💧 该喝水了", {
        body: `已经${intervalMin}分钟没喝水了，记得补充水分`,
        icon: "/favicon.ico",
      });
    }
    // 应用内 toast
    showToast({
      message: `💧 该喝水了！已经${intervalMin}分钟了`,
      type: "info",
    });
    // 调度下一次
    const next = Date.now() + intervalMin * 60 * 1000;
    setNextReminder(next);
    localStorage.setItem("water_reminder_next", String(next));
  };

  // ========== 提醒开关 ==========
  const toggleReminder = () => {
    const next = !enabled;
    setEnabled(next);
    localStorage.setItem("water_reminder_enabled", String(next));

    if (next) {
      if ("Notification" in window) {
        Notification.requestPermission();
      }
      const nextTime = Date.now() + intervalMin * 60 * 1000;
      setNextReminder(nextTime);
      setCountdown(intervalMin * 60 * 1000);
      localStorage.setItem("water_reminder_next", String(nextTime));
      showToast({ message: "喝水提醒已开启", type: "success" });
    } else {
      setNextReminder(0);
      setCountdown(0);
      localStorage.removeItem("water_reminder_next");
      showToast({ message: "喝水提醒已关闭", type: "info" });
    }
  };

  // ========== 间隔切换 ==========
  const handleIntervalChange = (min: number) => {
    setIntervalMin(min);
    localStorage.setItem("water_reminder_interval", String(min));
    if (enabled) {
      const next = Date.now() + min * 60 * 1000;
      setNextReminder(next);
      setCountdown(min * 60 * 1000);
      localStorage.setItem("water_reminder_next", String(next));
    }
  };

  // ========== 饮水记录 ==========
  const handleDrink = async (ml: number) => {
    await addWaterIntake(ml, selectedGoalId ?? undefined);
    if (selectedGoalId) { notifyGoalProgressUpdate(selectedGoalId); }
    showToast({ message: `已记录喝水 ${ml}ml`, type: "success" });
    await loadTodayRecord();
  };

  const handleUndoLast = async () => {
    try {
      await undoLastWaterIntake();
      showToast({ message: "已撤销上次记录", type: "info" });
      await loadTodayRecord();
    } catch {
      showToast({ message: "没有可撤销的记录", type: "warning" });
    }
  };

  const handleDeleteEntry = async (index: number) => {
    if (!todayRecord) return;
    const entry = todayRecord.entries[index];
    const newEntries = todayRecord.entries.filter((_, i) => i !== index);
    await db.dailyWaterRecords.update(todayRecord.id!, {
      entries: newEntries,
      totalMl: Math.max(0, todayRecord.totalMl - entry.ml),
    });
    showToast({ message: `已删除 ${entry.ml}ml 记录`, type: "info" });
    await loadTodayRecord();
  };

  // ========== 免打扰 ==========
  const handleDndToggle = () => {
    const next = !dndEnabled;
    setDndEnabled(next);
    localStorage.setItem("water_dnd_enabled", String(next));
  };

  const handleDndTimeChange = (type: "start" | "end", value: string) => {
    if (type === "start") {
      setDndStart(value);
      localStorage.setItem("water_dnd_start", value);
    } else {
      setDndEnd(value);
      localStorage.setItem("water_dnd_end", value);
    }
  };

  // ========== 目标保存 ==========
  const handleTargetSave = async () => {
    try {
      await saveUserSettings({ waterTarget } as Partial<UserSettings>);
      showToast({ message: "饮水目标已保存", type: "success" });
    } catch {
      showToast({ message: "保存失败", type: "error" });
    }
  };

  // ========== 计算值 ==========
  const totalMl = todayRecord?.totalMl ?? 0;
  const entries = todayRecord?.entries ?? [];
  const progressPct = Math.min(100, Math.round((totalMl / waterTarget) * 100));
  const drinkCount = entries.length;

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-50 to-white dark:from-gray-950 dark:to-gray-900 text-slate-900 dark:text-white">
      <div className="mx-auto max-w-5xl px-5 pt-8 pb-24 md:px-8 md:pt-10">
        {/* ---- 顶部导航 ---- */}
        <div className="flex items-center gap-2 mb-6">
          <Link href="/assistant" className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800">
            <ChevronLeft className="w-5 h-5 text-gray-400" />
          </Link>
          <div>
            <h1 className="text-xl font-bold text-gray-900 dark:text-white">喝水提醒</h1>
            <p className="text-xs text-gray-400">定时推送 · 一键喝水</p>
          </div>
        </div>

        {/* 关联饮水目标 */}
        {goals.length > 0 && (
          <div className="mb-4 bg-cyan-50 dark:bg-cyan-900/20 rounded-xl p-3 mx-4">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-medium text-cyan-700 dark:text-cyan-300 flex items-center gap-1">
                <Droplets className="w-3.5 h-3.5" /> 关联饮水目标
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
        {goals.length === 0 && (
          <p className="text-xs text-gray-400 text-center mb-3">暂无饮水目标，在项目中创建以追踪饮水进度</p>
        )}

        {/* ---- 1. 今日饮水进度卡片 ---- */}
        <div
          className="bg-white dark:bg-gray-900 border border-gray-100 dark:border-gray-800 rounded-2xl p-5 mb-4"
          style={{ animation: "fadeIn 0.4s ease-out" }}
        >
          <h3 className="text-sm font-bold text-gray-900 dark:text-white flex items-center gap-2 mb-4">
            <Droplets className="w-4 h-4 text-blue-500" /> 今日饮水进度
          </h3>
          {/* 进度条 */}
          <div className="mb-3">
            <div className="flex justify-between text-xs text-gray-500 mb-1.5">
              <span>已完成 {progressPct}%</span>
              <span>
                {totalMl}
                {" / "}
                {waterTarget} ml
              </span>
            </div>
            <div className="w-full h-3 bg-gray-100 dark:bg-gray-800 rounded-full overflow-hidden">
              <div
                className="h-full rounded-full transition-all duration-500 ease-out"
                style={{
                  width: `${progressPct}%`,
                  background:
                    progressPct >= 100
                      ? "linear-gradient(90deg, #34D399, #10B981)"
                      : "linear-gradient(90deg, #60A5FA, #3B82F6)",
                }}
              />
            </div>
          </div>
          {/* 文字描述 */}
          <p className="text-xs text-gray-400">
            已喝{" "}
            <span className="font-semibold text-gray-700 dark:text-gray-300">
              {drinkCount}
            </span>{" "}
            次
            {progressPct >= 100 && (
              <span className="ml-2 text-emerald-500 font-medium">🎉 已达标！</span>
            )}
          </p>
        </div>

        {/* ---- 2. 自定义每日饮水目标 ---- */}
        <div
          className="bg-white dark:bg-gray-900 border border-gray-100 dark:border-gray-800 rounded-2xl p-5 mb-4"
          style={{ animation: "fadeIn 0.4s ease-out 0.05s both" }}
        >
          <h3 className="text-sm font-bold text-gray-900 dark:text-white mb-3">
            每日饮水目标
          </h3>
          <div className="flex items-center gap-3">
            <input
              type="number"
              value={waterTarget}
              onChange={(e) =>
                setWaterTarget(Math.max(100, Number(e.target.value)))
              }
              className="flex-1 px-4 py-2.5 rounded-xl border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 text-sm text-gray-900 dark:text-white outline-none focus:border-blue-400 transition-colors"
              placeholder="目标饮水量（ml）"
              min={100}
              step={100}
            />
            <span className="text-sm text-gray-400">ml</span>
            <button
              onClick={handleTargetSave}
              className="px-4 py-2.5 rounded-xl text-sm font-medium bg-blue-500 text-white hover:bg-blue-600 transition-colors active:scale-95"
            >
              保存
            </button>
          </div>
        </div>

        {/* ---- 3. 定时提醒开关 ---- */}
        <div
          className="bg-white dark:bg-gray-900 border border-gray-100 dark:border-gray-800 rounded-2xl p-5 mb-4"
          style={{ animation: "fadeIn 0.4s ease-out 0.1s both" }}
        >
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-sm font-bold text-gray-900 dark:text-white flex items-center gap-2">
                <Droplets className="w-4 h-4 text-blue-500" /> 定时提醒
              </h3>
              <p className="text-xs text-gray-400 mt-0.5">
                {enabled
                  ? countdown > 0
                    ? `下次提醒: ${toMinSec(countdown)}后`
                    : "即将提醒..."
                  : "提醒已关闭"}
              </p>
            </div>
            <button
              onClick={toggleReminder}
              className={`flex items-center gap-1.5 px-4 py-2 rounded-xl text-sm font-medium transition-colors ${
                enabled
                  ? "bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400"
                  : "bg-gray-100 dark:bg-gray-800 text-gray-500"
              }`}
            >
              {enabled ? <Bell className="w-4 h-4" /> : <BellOff className="w-4 h-4" />}
              {enabled ? "已开启" : "已关闭"}
            </button>
          </div>

          {/* 间隔选择 */}
          <div className="mt-4 pt-4 border-t border-gray-100 dark:border-gray-800">
            <label className="text-xs font-medium text-gray-500 mb-2 block">提醒间隔</label>
            <div className="flex gap-2 flex-wrap">
              {[30, 60, 90, 120].map((min) => (
                <button
                  key={min}
                  onClick={() => handleIntervalChange(min)}
                  className={`px-4 py-2 rounded-xl text-sm font-medium transition-colors ${
                    intervalMin === min
                      ? "bg-blue-500 text-white shadow-md"
                      : "bg-gray-50 dark:bg-gray-800 text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700"
                  }`}
                >
                  {min}分钟
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* ---- 4. 夜间免打扰 ---- */}
        <div
          className="bg-white dark:bg-gray-900 border border-gray-100 dark:border-gray-800 rounded-2xl p-5 mb-4"
          style={{ animation: "fadeIn 0.4s ease-out 0.15s both" }}
        >
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-sm font-bold text-gray-900 dark:text-white flex items-center gap-2">
                <Moon className="w-4 h-4 text-indigo-500" /> 夜间免打扰
              </h3>
              <p className="text-xs text-gray-400 mt-0.5">
                {dndEnabled ? `${dndStart} - ${dndEnd}` : "已关闭"}
              </p>
            </div>
            <button
              onClick={handleDndToggle}
              className={`flex items-center gap-1.5 px-4 py-2 rounded-xl text-sm font-medium transition-colors ${
                dndEnabled
                  ? "bg-indigo-50 dark:bg-indigo-900/20 text-indigo-600 dark:text-indigo-400"
                  : "bg-gray-100 dark:bg-gray-800 text-gray-500"
              }`}
            >
              {dndEnabled ? "已开启" : "已关闭"}
            </button>
          </div>

          {dndEnabled && (
            <div className="mt-4 pt-4 border-t border-gray-100 dark:border-gray-800">
              <label className="text-xs font-medium text-gray-500 mb-2 block">免打扰时段</label>
              <div className="flex items-center gap-2">
                <input
                  type="time"
                  value={dndStart}
                  onChange={(e) => handleDndTimeChange("start", e.target.value)}
                  className="px-3 py-2 rounded-xl border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 text-sm text-gray-900 dark:text-white outline-none focus:border-indigo-400 transition-colors"
                />
                <span className="text-gray-400 text-sm">至</span>
                <input
                  type="time"
                  value={dndEnd}
                  onChange={(e) => handleDndTimeChange("end", e.target.value)}
                  className="px-3 py-2 rounded-xl border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 text-sm text-gray-900 dark:text-white outline-none focus:border-indigo-400 transition-colors"
                />
              </div>
            </div>
          )}
        </div>

        {/* ---- 5. 快捷喝水 ---- */}
        <div
          className="bg-white dark:bg-gray-900 border border-gray-100 dark:border-gray-800 rounded-2xl p-5 mb-4"
          style={{ animation: "fadeIn 0.4s ease-out 0.2s both" }}
        >
          <h3 className="text-sm font-bold text-gray-900 dark:text-white mb-3">快捷喝水</h3>
          <p className="text-xs text-gray-400 mb-3">与主页人物框共享水杯预设值</p>
          <div className="flex gap-2 flex-wrap">
            {cupSizes.map((ml) => (
              <button
                key={ml}
                onClick={() => handleDrink(ml)}
                className="flex items-center gap-1.5 px-4 py-2.5 rounded-xl text-sm font-medium
                  bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400
                  hover:bg-blue-100 dark:hover:bg-blue-900/30 transition-colors active:scale-95"
              >
                <Plus className="w-4 h-4" />
                {ml}ml
              </button>
            ))}
          </div>
        </div>

        {/* ---- 6. 今日饮水明细 ---- */}
        <div
          className="bg-white dark:bg-gray-900 border border-gray-100 dark:border-gray-800 rounded-2xl p-5 mb-4"
          style={{ animation: "fadeIn 0.4s ease-out 0.25s both" }}
        >
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-sm font-bold text-gray-900 dark:text-white">今日饮水明细</h3>
            {entries.length > 0 && (
              <button
                onClick={handleUndoLast}
                className="flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-medium
                  bg-amber-50 dark:bg-amber-900/20 text-amber-600 dark:text-amber-400
                  hover:bg-amber-100 dark:hover:bg-amber-900/30 transition-colors active:scale-95"
              >
                <Undo2 className="w-3 h-3" />
                撤销上次
              </button>
            )}
          </div>

          {entries.length === 0 ? (
            <p className="text-xs text-gray-400 py-4 text-center">今日暂无饮水记录</p>
          ) : (
            <div className="space-y-2 max-h-64 overflow-y-auto">
              {[...entries].reverse().map((entry, i) => {
                const realIndex = entries.length - 1 - i;
                return (
                  <div
                    key={realIndex}
                    className="flex items-center justify-between px-3 py-2 rounded-xl bg-gray-50 dark:bg-gray-800/50"
                  >
                    <div className="flex items-center gap-2">
                      <Droplets className="w-3.5 h-3.5 text-blue-400" />
                      <span className="text-sm text-gray-700 dark:text-gray-300">
                        {entry.ml}ml
                      </span>
                    </div>
                    <div className="flex items-center gap-3">
                      <span className="text-xs text-gray-400">
                        {formatTime(entry.timestamp)}
                      </span>
                      <button
                        onClick={() => handleDeleteEntry(realIndex)}
                        className="p-1 rounded-lg hover:bg-red-50 dark:hover:bg-red-900/20 text-gray-400 hover:text-red-500 transition-colors"
                        title="删除此条"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* ---- 7. 底部统计入口 ---- */}
        <Link
          href="/stats#water"
          className="flex items-center justify-center gap-2 py-3 text-sm font-medium text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300 transition-colors"
          style={{ animation: "fadeIn 0.4s ease-out 0.3s both" }}
        >
          查看饮水完整统计 <ArrowRight className="w-4 h-4" />
        </Link>
      </div>

      {/* 渐入动画 keyframes */}
      <style>{`
        @keyframes fadeIn {
          from {
            opacity: 0;
            transform: translateY(8px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }
      `}</style>
    </div>
  );
}
