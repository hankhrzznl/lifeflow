"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import { ChevronLeft, Moon, BarChart3 } from "lucide-react";
import { useHealthStore } from "@/lib/store/healthStore";
import { getSleepLogByDate } from "@/lib/db/health.db";
import { showToast } from "@/components/ui/Toast";

function localTodayStr(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function timeToMinutes(t: string): number {
  const [h, m] = t.split(":").map(Number);
  return h * 60 + m;
}
function normalizeMinutes(t: string): number {
  const raw = timeToMinutes(t);
  return raw < 720 ? raw + 1440 : raw;
}

export default function SleepPage() {
  const router = useRouter();
  const { todaySleepLog, sleepGoalV2, loadSleepData, saveSleepLog } = useHealthStore();
  const [loading, setLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    (async () => { await loadSleepData(); setLoading(false); })();
  }, [loadSleepData]);

  const targetTime = sleepGoalV2?.targetTime || "23:00";
  const targetNorm = normalizeMinutes(targetTime);

  const handleLogSleep = useCallback(async () => {
    const now = new Date();
    const actualTime = `${String(now.getHours()).padStart(2, "0")}:${String(now.getMinutes()).padStart(2, "0")}`;
    const actualNorm = normalizeMinutes(actualTime);
    const diff = actualNorm - targetNorm;
    const isOnTime = diff <= 0;
    setIsSaving(true);
    try {
      const existing = await getSleepLogByDate(localTodayStr());
      await saveSleepLog({
        ...(existing ? { id: existing.id } : {}),
        date: localTodayStr(),
        targetTime,
        actualTime,
        isOnTime,
        minutesDiff: diff,
      });
      showToast({ type: "success", message: "已记录入睡时间" });
    } catch {
      showToast({ type: "error", message: "记录失败" });
    } finally {
      setIsSaving(false);
    }
  }, [saveSleepLog, targetNorm, targetTime]);

  if (loading) {
    return (
      <div>
        <div className="sticky top-0 z-20 bg-[var(--color-surface-card)] border-b border-[var(--lifeflow-border)]">
          <div className="flex items-center px-4 h-11">
            <div className="w-8 h-8 rounded-lg" style={{ background: "var(--color-surface-secondary)" }} />
          </div>
        </div>
        <div className="px-4 pt-5 flex flex-col gap-5">
          {[1, 2].map((i) => (
            <div key={i} className="card-standard p-5 animate-pulse">
              <div className="h-6 w-1/3 rounded" style={{ background: "var(--color-surface-secondary)" }} />
              <div className="h-10 w-2/3 mt-3 rounded" style={{ background: "var(--color-surface-secondary)" }} />
            </div>
          ))}
        </div>
      </div>
    );
  }

  const sleepText = todaySleepLog ? todaySleepLog.actualTime : "暂无记录";
  const diffText = todaySleepLog
    ? todaySleepLog.minutesDiff > 0
      ? `比目标晚 ${todaySleepLog.minutesDiff} 分钟`
      : todaySleepLog.minutesDiff < 0
        ? `比目标早 ${Math.abs(todaySleepLog.minutesDiff)} 分钟`
        : "正好达标"
    : "";

  return (
    <div className="pb-[100px]">
      {/* Sticky Header */}
      <div className="sticky top-0 z-20 bg-[var(--color-surface-card)] border-b border-[var(--lifeflow-border)]">
        <div className="flex items-center px-4 h-11">
          <button
            type="button"
            onClick={() => router.push("/more")}
            className="inline-flex h-8 w-8 items-center justify-center rounded-lg"
            style={{
              background: "var(--color-surface-card)",
              border: "1px solid var(--lifeflow-border)",
            }}
          >
            <ChevronLeft className="w-4 h-4" style={{ color: "var(--color-text-primary)" }} />
          </button>
          <h1 className="text-title-nav flex-1 text-center" style={{ color: "var(--color-text-primary)" }}>
            睡眠
          </h1>
          <div className="w-8" />
        </div>
      </div>

      <div className="px-4 pt-5 flex flex-col gap-5">
        {/* Sleep Stats Card */}
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.35, ease: [0.32, 0.72, 0, 1] }}
          className="card-standard p-5"
        >
          <div className="flex items-start justify-between">
            <div className="flex items-center gap-3">
              <div
                className="w-12 h-12 rounded-full flex items-center justify-center flex-shrink-0"
                style={{ background: "var(--lifeflow-brand-50)" }}
              >
                <Moon className="w-6 h-6" style={{ color: "var(--lifeflow-primary)" }} />
              </div>
              <div>
                <div className="text-[13px] font-medium" style={{ color: "var(--color-text-secondary)" }}>
                  昨晚睡眠
                </div>
                <div
                  className="text-[24px] font-bold mt-0.5"
                  style={{ color: todaySleepLog ? "var(--color-text-primary)" : "var(--color-text-disabled)" }}
                >
                  {sleepText}
                </div>
                {diffText && (
                  <div className="text-[13px] mt-0.5" style={{ color: "var(--color-text-secondary)" }}>
                    {diffText}
                  </div>
                )}
              </div>
            </div>
            <div className="text-right">
              <div className="text-[13px] font-medium" style={{ color: "var(--color-text-secondary)" }}>
                目标
              </div>
              <div className="text-[20px] font-bold mt-0.5" style={{ color: "var(--color-text-primary)" }}>
                {targetTime}
              </div>
            </div>
          </div>

          {!todaySleepLog && (
            <button
              type="button"
              onClick={handleLogSleep}
              disabled={isSaving}
              className="mt-4 w-full py-3.5 rounded-full text-[15px] font-semibold text-white"
              style={{ background: "var(--lifeflow-primary)" }}
            >
              {isSaving ? "记录中…" : "记录入睡"}
            </button>
          )}
        </motion.div>

        {/* 早睡分析 */}
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.05, duration: 0.35, ease: [0.32, 0.72, 0, 1] }}
        >
          <h2
            className="text-[15px] font-semibold mb-3"
            style={{ color: "var(--color-text-primary)" }}
          >
            早睡分析
          </h2>
          <div className="card-standard p-5 flex flex-col items-center py-10">
            <BarChart3 className="w-10 h-10" style={{ color: "var(--color-text-disabled)" }} />
            <p className="text-[15px] mt-3" style={{ color: "var(--color-text-secondary)" }}>
              暂无睡眠数据
            </p>
            <p className="text-[13px] mt-1" style={{ color: "var(--color-text-disabled)" }}>
              坚持记录即可查看早睡分析
            </p>
          </div>
        </motion.div>
      </div>
    </div>
  );
}
