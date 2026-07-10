"use client";

import { useEffect, useState } from "react";
import { ChevronLeft, Droplets, Bell, BellOff, Plus } from "lucide-react";
import Link from "next/link";
import { getUserSettings, addWaterIntake } from "@/lib/db";
import { showToast } from "@/components/ui/Toast";

function toMinSec(ms: number) {
  const m = Math.floor(ms / 60000);
  const s = Math.floor((ms % 60000) / 1000);
  return `${m}分${s}秒`;
}

export default function WaterPage() {
  const [enabled, setEnabled] = useState(false);
  const [intervalMin, setIntervalMin] = useState(90);
  const [cupSizes, setCupSizes] = useState([200, 300, 500]);
  const [countdown, setCountdown] = useState(0);
  const [nextReminder, setNextReminder] = useState(0);

  // 加载设置
  useEffect(() => {
    const saved = localStorage.getItem("water_reminder_enabled");
    setEnabled(saved === "true");
    const savedInterval = localStorage.getItem("water_reminder_interval");
    if (savedInterval) setIntervalMin(Number(savedInterval));

    getUserSettings().then((s) => {
      if (s.cupSizes) setCupSizes(s.cupSizes);
    });

    // 恢复定时器
    const savedNext = localStorage.getItem("water_reminder_next");
    if (savedNext && saved === "true") {
      setNextReminder(Number(savedNext));
    }
  }, []);

  // countdown tick
  useEffect(() => {
    if (!enabled || nextReminder === 0) return;
    const tick = () => setCountdown(Math.max(0, nextReminder - Date.now()));
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [enabled, nextReminder]);

  // 定时触发提醒
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
    // 播放通知
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

  const handleDrink = async (ml: number) => {
    await addWaterIntake(ml);
    showToast({ message: `已记录喝水 ${ml}ml`, type: "success" });
  };

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

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-50 to-white dark:from-gray-950 dark:to-gray-900 text-slate-900 dark:text-white">
      <div className="mx-auto max-w-5xl px-5 pt-8 pb-24 md:px-8 md:pt-10">
        <div className="flex items-center gap-2 mb-6">
          <Link href="/assistant" className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800">
            <ChevronLeft className="w-5 h-5 text-gray-400" />
          </Link>
          <div>
            <h1 className="text-xl font-bold text-gray-900 dark:text-white">喝水提醒</h1>
            <p className="text-xs text-gray-400">定时推送 · 一键喝水</p>
          </div>
        </div>

        {/* 开关 */}
        <div className="bg-white dark:bg-gray-900 border border-gray-100 dark:border-gray-800 rounded-2xl p-5 mb-4">
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

        {/* 快捷喝水 */}
        <div className="bg-white dark:bg-gray-900 border border-gray-100 dark:border-gray-800 rounded-2xl p-5">
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
      </div>
    </div>
  );
}
