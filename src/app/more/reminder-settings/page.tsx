"use client";

import { useState, useEffect, useCallback } from "react";
import { motion } from "framer-motion";
import { ArrowLeft, Bell, Clock } from "lucide-react";
import Link from "next/link";
import { showToast } from "@/components/ui/Toast";
import { getReminderDefaults, setReminderDefaults, type ReminderDefaultsMap } from "@/lib/reminderDefaults";
import type { SourceType } from "@/lib/db/daylog.db";

const LABELS: Record<string, string> = {
  routine: "作息模板",
  course: "课程",
  water: "饮水",
  manual: "手动事项",
  habit: "习惯",
  task: "任务事项",
};

const MINUTES_OPTIONS = [0, 5, 10, 15, 30];

export default function ReminderSettingsPage() {
  const [config, setConfig] = useState<ReminderDefaultsMap>({});

  useEffect(() => {
    setConfig(getReminderDefaults());
  }, []);

  const handleToggle = useCallback((type: string) => {
    setConfig((prev) => {
      const current = prev[type] ?? { enabled: false, minutes: 0 };
      return { ...prev, [type]: { ...current, enabled: !current.enabled } };
    });
  }, []);

  const handleMinutes = useCallback((type: string, minutes: number) => {
    setConfig((prev) => {
      const current = prev[type] ?? { enabled: false, minutes: 0 };
      return { ...prev, [type]: { ...current, minutes } };
    });
  }, []);

  const handleSave = useCallback(() => {
    setReminderDefaults(config);
    showToast({ type: "success", message: "默认提醒已保存" });
  }, [config]);

  return (
    <div className="flex flex-col h-full max-w-2xl mx-auto px-4 pt-6 pb-24">
      <div className="flex items-center gap-3 mb-6">
        <Link
          href="/more"
          className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800"
        >
          <ArrowLeft className="w-5 h-5 text-gray-500" />
        </Link>
        <div className="flex items-center gap-2">
          <Bell className="w-6 h-6 text-blue-500" />
          <h1 className="text-xl font-bold text-gray-900 dark:text-white">默认提醒设置</h1>
        </div>
      </div>

      <p className="text-xs text-gray-400 mb-4">
        设置每种类型事项的默认提醒方式。新的事项将自动应用此配置，已手动设置过的事项不受影响。
      </p>

      <div className="space-y-3">
        {Object.entries(LABELS).map(([type, label]) => {
          const itemConfig = config[type] ?? { enabled: false, minutes: 0 };
          return (
            <motion.div
              key={type}
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-100 dark:border-gray-800 p-4"
            >
              <div className="flex items-center justify-between mb-3">
                <span className="text-sm font-medium text-gray-700 dark:text-gray-300">{label}</span>
                <button
                  type="button"
                  onClick={() => handleToggle(type)}
                  className="relative inline-flex h-6 w-10 items-center rounded-full transition-colors flex-shrink-0"
                  style={{
                    background: itemConfig.enabled ? "#34C759" : "#E5E5EA",
                  }}
                >
                  <span
                    className="inline-block h-4 w-4 rounded-full bg-white shadow-sm transition-transform"
                    style={{
                      transform: itemConfig.enabled ? "translateX(22px)" : "translateX(2px)",
                    }}
                  />
                </button>
              </div>
              {itemConfig.enabled && (
                <div className="flex items-center gap-2 pt-2 border-t border-gray-100 dark:border-gray-800">
                  <Clock className="w-4 h-4 text-gray-400" />
                  <span className="text-xs text-gray-500 mr-2">提前</span>
                  <div className="flex gap-1.5 flex-wrap">
                    {MINUTES_OPTIONS.map((m) => (
                      <button
                        key={m}
                        type="button"
                        onClick={() => handleMinutes(type, m)}
                        className="px-2.5 py-1 rounded-lg text-[11px] font-medium transition-all active:scale-90"
                        style={{
                          background: itemConfig.minutes === m ? "#34C759" : "#F2F2F7",
                          color: itemConfig.minutes === m ? "#FFFFFF" : "#3C3C43",
                        }}
                      >
                        {m === 0 ? "到点" : `${m}分钟`}
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </motion.div>
          );
        })}
      </div>

      <button
        type="button"
        onClick={handleSave}
        className="mt-6 py-3 rounded-xl bg-blue-500 text-white text-sm font-medium hover:bg-blue-600 transition-colors active:scale-[0.98]"
      >
        保存设置
      </button>
    </div>
  );
}
