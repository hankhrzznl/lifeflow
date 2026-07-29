"use client";

import { useState, useMemo, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Droplets, X, Plus, Minus, ChevronDown, ChevronUp } from "lucide-react";
import { daylogDB, ensureModuleItem, updateItem } from "@/lib/db/daylog.db";
import { syncItemReminder } from "@/lib/reminderDefaults";
import type { Item } from "@/lib/db/daylog.db";
import { db } from "@/lib/db";
import { requestPermission } from "@/lib/notificationService";
import { showToast } from "@/components/ui/Toast";
import { updateWaterGoal } from "@/lib/db/health.db";

/* ────────── Types ────────── */

interface TimeSlot {
  hour: number;
  label: string; // "07:30"
  enabled: boolean;
}

interface WaterReminderSheetProps {
  open: boolean;
  onClose: () => void;
  wakeStart: string;
  wakeEnd: string;
  dailyTarget: number;
  onStatusChange?: (active: boolean) => void;
}

/* ────────── Helpers ────────── */

function generateWaterSourceId(date: string, timeStr: string): string {
  return `water_${date}_${timeStr}`;
}

function addMinutes(time: string, mins: number): string {
  const [h, m] = time.split(":").map(Number);
  const total = h * 60 + m + mins;
  const nh = Math.floor(total / 60) % 24;
  const nm = total % 60;
  return `${String(nh).padStart(2, "0")}:${String(nm).padStart(2, "0")}`;
}

function todayStr(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function dateAddDays(dateStr: string, days: number): string {
  const d = new Date(dateStr + "T00:00:00");
  d.setDate(d.getDate() + days);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

/* ────────── Component ────────── */

export default function WaterReminderSheet({
  open, onClose, wakeStart, wakeEnd, dailyTarget, onStatusChange,
}: WaterReminderSheetProps) {
  const [step, setStep] = useState<"summary" | "edit">("summary");
  const [submitting, setSubmitting] = useState(false);

  // Build time slots from wakeStart to wakeEnd-2h
  const defaultSlots = useMemo(() => {
    const startH = parseInt(wakeStart.split(":")[0]);
    const endH = parseInt(wakeEnd.split(":")[0]);
    const stopH = endH - 2;
    const slots: TimeSlot[] = [];
    for (let h = startH; h < stopH; h++) {
      slots.push({ hour: h, label: `${String(h).padStart(2, "0")}:30`, enabled: true });
    }
    return slots;
  }, [wakeStart, wakeEnd]);

  const [slots, setSlots] = useState<TimeSlot[]>(defaultSlots);

  // Reset slots when sheet opens
  const handleOpen = useCallback(() => {
    setSlots(defaultSlots);
    setStep("summary");
  }, [defaultSlots]);

  const enabledCount = useMemo(() => slots.filter(s => s.enabled).length, [slots]);
  const totalWaterMl = enabledCount * 100;

  const toggleSlot = useCallback((hour: number) => {
    setSlots(prev => prev.map(s => s.hour === hour ? { ...s, enabled: !s.enabled } : s));
  }, []);

  const removeSlot = useCallback((hour: number) => {
    setSlots(prev => prev.filter(s => s.hour !== hour));
  }, []);

  const addSlot = useCallback(() => {
    // Find first missing hour in range
    const startH = parseInt(wakeStart.split(":")[0]);
    const endH = parseInt(wakeEnd.split(":")[0]);
    const stopH = endH - 2;
    const existingHours = new Set(slots.map(s => s.hour));
    for (let h = startH; h < stopH; h++) {
      if (!existingHours.has(h)) {
        setSlots(prev => [...prev, { hour: h, label: `${String(h).padStart(2, "0")}:30`, enabled: true }].sort((a, b) => a.hour - b.hour));
        return;
      }
    }
    showToast({ type: "info", message: "所有时段已添加" });
  }, [slots, wakeStart, wakeEnd]);

  const handleConfirm = useCallback(async () => {
    setSubmitting(true);
    try {
      // 请求通知权限
      await requestPermission();

      const today = todayStr();

      // 1. 清理旧数据：删除所有 water items + 对应 reminders 未来 7 天
      for (let d = 0; d < 7; d++) {
        const date = dateAddDays(today, d);

        // 先收集要删除的 item IDs
        const oldItems = await daylogDB.items
          .where("date").equals(date)
          .filter((item) => item.sourceType === "water")
          .toArray();

        // 删除 reminders
        for (const item of oldItems) {
          const reminder = await db.reminders
            .where("moduleType").equals("item")
            .filter((r) => r.linkedModuleId === item.id)
            .first();
          if (reminder) await db.reminders.delete(reminder.id!);
        }

        // 删除 items
        await daylogDB.items
          .where("date").equals(date)
          .filter((item) => item.sourceType === "water")
          .delete();
      }

      // 2. 生成新数据
      const enabledSlots = slots.filter(s => s.enabled);
      for (let d = 0; d < 7; d++) {
        const date = dateAddDays(today, d);

        for (const slot of enabledSlots) {
          const timeStr = slot.label;
          const endTime = addMinutes(timeStr, 5);
          const sourceId = generateWaterSourceId(date, timeStr);

          const itemId = await ensureModuleItem({
            date,
            sourceType: "water",
            sourceId,
            title: "喝口水然后动一动不要久坐",
            plannedStart: timeStr,
            plannedEnd: endTime,
            color: "#0EA5E9",
            icon: "Droplets",
            isCompleted: false,
          });
          if (itemId) {
            await syncItemReminder({
              id: itemId,
              sourceType: "water",
              sourceId,
              date,
              title: "喝口水然后动一动不要久坐",
              plannedStart: timeStr,
              plannedEnd: endTime,
              actualStart: timeStr,
              actualEnd: endTime,
              isCorrected: false,
              isCompleted: false,
              sortOrder: 1,
              createdAt: Date.now(),
              updatedAt: Date.now(),
            } as Item);
          }
        }
      }

      // 同步开关状态
      await updateWaterGoal({ reminderInterval: 60 }).catch(() => {});

      showToast({ type: "success", message: `已开启饮水提醒，今日 ${enabledCount} 次` });
      onStatusChange?.(true);
      onClose();
    } catch {
      showToast({ type: "error", message: "开启失败，请重试" });
    } finally {
      setSubmitting(false);
    }
  }, [slots, onClose, onStatusChange]);

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          className="fixed inset-0 z-50 flex items-end justify-center"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onKeyDown={() => {}}
          tabIndex={-1}
          role="dialog"
        >
          {/* Backdrop */}
          <div
            className="absolute inset-0 bg-black/40"
            onClick={() => { if (!submitting) onClose(); }}
          />

          {/* Sheet */}
          <motion.div
            className="relative w-full rounded-t-[24px] flex flex-col"
            style={{
              background: "var(--color-surface-card)",
              maxHeight: "80vh",
            }}
            initial={{ y: "100%" }}
            animate={{ y: 0 }}
            exit={{ y: "100%" }}
            transition={{ type: "spring", damping: 30, stiffness: 300 }}
          >
            {/* Handle */}
            <div className="flex justify-center pt-2 pb-1 shrink-0">
              <div className="w-9 h-1 rounded-full" style={{ background: "var(--lifeflow-border)" }} />
            </div>

            {/* Scrollable content area */}
            <div className="flex-1 overflow-y-auto px-6 pb-3">
              {/* Header */}
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-[17px] font-semibold" style={{ color: "var(--color-text-primary)" }}>
                  今日饮水提醒
                </h3>
                <button
                  onClick={() => { if (!submitting) onClose(); }}
                  className="w-8 h-8 flex items-center justify-center rounded-full"
                  style={{ background: "var(--lifeflow-muted)" }}
                >
                  <X className="w-4 h-4" style={{ color: "var(--color-text-secondary)" }} />
                </button>
              </div>

              {/* Summary View */}
              {step === "summary" && (
                <div>
                  <div className="flex flex-col items-center py-4 mb-4">
                    <div
                      className="w-16 h-16 rounded-full flex items-center justify-center mb-3"
                      style={{ background: "var(--lifeflow-brand-50)" }}
                    >
                      <Droplets className="w-8 h-8" style={{ color: "var(--lifeflow-primary)" }} />
                    </div>
                    <p className="text-[24px] font-bold" style={{ color: "var(--color-text-primary)" }}>
                      {enabledCount} 次/天
                    </p>
                    <p className="text-[13px] mt-1" style={{ color: "var(--color-text-secondary)" }}>
                      时段 {wakeStart} ~ {wakeEnd} · {totalWaterMl}ml
                    </p>
                  </div>

                  {/* Info rows */}
                  <div className="rounded-xl p-4" style={{ background: "var(--lifeflow-muted)" }}>
                    <InfoRow label="每日目标" value={`${dailyTarget}ml`} />
                    <InfoRow label="提醒次数" value={`${enabledCount} 次`} />
                    <InfoRow label="总水量" value={`${totalWaterMl}ml`} />
                    <InfoRow label="每次饮水量" value="100ml" />
                  </div>
                </div>
              )}

              {/* Edit View */}
              {step === "edit" && (
                <div>
                  <div className="flex items-center justify-between mb-3">
                    <p className="text-[15px] font-medium" style={{ color: "var(--color-text-primary)" }}>
                      时段调整（{enabledCount} 次）
                    </p>
                    <button
                      onClick={addSlot}
                      className="flex items-center gap-1 px-3 h-8 rounded-lg text-[13px] font-medium"
                      style={{ background: "var(--lifeflow-brand-50)", color: "var(--lifeflow-primary)" }}
                    >
                      <Plus className="w-3.5 h-3.5" />
                      添加
                    </button>
                  </div>

                  <div className="flex flex-col gap-1.5">
                    {slots
                      .sort((a, b) => a.hour - b.hour)
                      .map((slot) => (
                        <div
                          key={slot.hour}
                          className="flex items-center justify-between h-11 px-3 rounded-xl"
                          style={{ background: "var(--lifeflow-muted)" }}
                        >
                          <label className="flex items-center gap-3 flex-1 cursor-pointer">
                            <button
                              type="button"
                              onClick={() => toggleSlot(slot.hour)}
                              className={`w-5 h-5 rounded border-2 flex items-center justify-center transition-colors ${
                                slot.enabled ? "" : "opacity-40"
                              }`}
                              style={{
                                borderColor: slot.enabled ? "var(--lifeflow-primary)" : "var(--lifeflow-border)",
                                background: slot.enabled ? "var(--lifeflow-primary)" : "transparent",
                              }}
                            >
                              {slot.enabled && (
                                <svg className="w-3 h-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                                  <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                                </svg>
                              )}
                            </button>
                            <span
                              className="text-[14px] font-medium"
                              style={{
                                color: slot.enabled ? "var(--color-text-primary)" : "var(--color-text-disabled)",
                                textDecoration: slot.enabled ? "none" : "line-through",
                              }}
                            >
                              {slot.label}
                            </span>
                          </label>
                          <span className="text-[12px]" style={{ color: "var(--color-text-disabled)" }}>
                            100ml
                          </span>
                          <button
                            onClick={() => removeSlot(slot.hour)}
                            className="w-7 h-7 flex items-center justify-center ml-2 rounded-full active:opacity-60"
                            style={{ background: "var(--color-surface-card)" }}
                          >
                            <X className="w-3.5 h-3.5" style={{ color: "var(--color-text-disabled)" }} />
                          </button>
                        </div>
                      ))}
                  </div>
                </div>
              )}
            </div>

            {/* Fixed bottom button area */}
            <div className="px-6 pb-6 pt-3 shrink-0" style={{ borderTop: "1px solid var(--lifeflow-border)" }}>
              {step === "summary" && (
                <div className="flex gap-2">
                  <button
                    onClick={() => setStep("edit")}
                    disabled={submitting}
                    className="flex-1 h-11 rounded-xl text-[15px] font-medium disabled:opacity-50"
                    style={{
                      background: "var(--color-surface-secondary)",
                      color: "var(--color-text-secondary)",
                    }}
                  >
                    调整时段
                  </button>
                  <button
                    onClick={handleConfirm}
                    disabled={submitting}
                    className="flex-1 h-11 rounded-xl text-[15px] font-semibold text-white disabled:opacity-50"
                    style={{ background: "var(--lifeflow-primary)" }}
                  >
                    {submitting ? "生成中..." : "确认开启"}
                  </button>
                </div>
              )}
              {step === "edit" && (
                <div className="flex gap-2">
                  <button
                    onClick={() => setStep("summary")}
                    disabled={submitting}
                    className="flex-1 h-11 rounded-xl text-[15px] font-medium disabled:opacity-50"
                    style={{
                      background: "var(--color-surface-secondary)",
                      color: "var(--color-text-secondary)",
                    }}
                  >
                    返回
                  </button>
                  <button
                    onClick={handleConfirm}
                    disabled={submitting}
                    className="flex-1 h-11 rounded-xl text-[15px] font-semibold text-white disabled:opacity-50"
                    style={{ background: "var(--lifeflow-primary)" }}
                  >
                    {submitting ? "生成中..." : "确认开启"}
                  </button>
                </div>
              )}
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

/* ────────── Sub components ────────── */

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between h-8">
      <span className="text-[13px]" style={{ color: "var(--color-text-secondary)" }}>{label}</span>
      <span className="text-[14px] font-medium" style={{ color: "var(--color-text-primary)" }}>{value}</span>
    </div>
  );
}
