"use client";

// ============================================================
// T21-3 睡前仪式卡片（首页 + 日程页复用）
// 环境营造提醒 → 倒计时 → 入睡打卡 + 渐进式目标
// ============================================================

import { motion } from "framer-motion";
import { Moon, Lamp, Timer, Check, TrendingDown } from "lucide-react";
import { useSleepRitual } from "@/lib/sleep-ritual";

const NIGHT = "#6366F1";

export default function SleepRitualCard({ className = "px-4 mb-4" }: { className?: string }) {
  const ritual = useSleepRitual();

  return (
    <div className={className}>
      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        className="rounded-[20px] p-4"
        style={{
          background: "var(--color-surface-card)",
          boxShadow: "var(--shadow-card)",
          borderLeft: ritual.stage === "late" ? "3px solid #FF3B30" : `3px solid ${NIGHT}`,
        }}
      >
        {/* 头部 */}
        <div className="flex items-center gap-2 mb-3">
          <div className="w-7 h-7 rounded-lg flex items-center justify-center" style={{ background: "#EEF2FF" }}>
            <Moon className="w-4 h-4" style={{ color: NIGHT }} />
          </div>
          <span className="text-[13px] font-semibold" style={{ color: "var(--color-text-primary)" }}>睡前仪式</span>
          <span className="ml-auto text-[11px] font-medium px-2 py-0.5 rounded-full tabular-nums"
            style={{
              color: ritual.stage === "late" ? "#FF3B30" : NIGHT,
              background: ritual.stage === "late" ? "rgba(255,59,48,0.12)" : "rgba(99,102,241,0.12)",
            }}>
            {stageBadge(ritual.stage)}
          </span>
        </div>

        {/* 分阶段内容 */}
        {ritual.stage === "done" && (
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-full flex items-center justify-center shrink-0" style={{ background: "rgba(52,199,89,0.15)" }}>
              <Check className="w-5 h-5" style={{ color: "#34C759" }} />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-[15px] font-semibold" style={{ color: "var(--color-text-primary)" }}>
                今晚已打卡 {ritual.store.lastCheckinTime}
              </p>
              <p className="text-[12px] mt-0.5" style={{ color: "var(--color-text-secondary)" }}>
                {ritual.store.lastResult === "onTime" ? "按时入睡 ✓ 保持住" : "比目标晚了一些，明天加油"}
              </p>
            </div>
          </div>
        )}

        {/* 环境营造提醒：仅当未关闭时展示（当天可关闭） */}
        {ritual.stage === "prepare" && ritual.showPrepareBanner && (
          <div>
            <div className="flex items-start gap-3">
              <div className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0" style={{ background: "#FFFBEB" }}>
                <Lamp className="w-5 h-5" style={{ color: "#F59E0B" }} />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-[15px] font-semibold" style={{ color: "var(--color-text-primary)" }}>
                  该营造睡眠环境了
                </p>
                <p className="text-[12px] mt-0.5 leading-relaxed" style={{ color: "var(--color-text-secondary)" }}>
                  开暖色灯 · 手机放客厅 · 拉上窗帘
                </p>
                <p className="text-[11px] mt-1" style={{ color: NIGHT }}>
                  目标就寝 {ritual.targetBedTime}（{ritual.prepareTime} 提醒）
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={ritual.dismissPrepare}
              className="mt-3 w-full py-2.5 rounded-full text-[13px] font-medium active:opacity-70"
              style={{ background: "var(--lifeflow-muted)", color: "var(--color-text-secondary)" }}
            >
              知道了，去准备
            </button>
          </div>
        )}

        {(ritual.stage === "countdown" || ritual.stage === "checkin" || ritual.stage === "late") && (
          <div>
            <div className="flex items-start gap-3">
              <div className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0"
                style={{ background: ritual.stage === "late" ? "rgba(255,59,48,0.12)" : "#EEF2FF" }}>
                <Timer className="w-5 h-5" style={{ color: ritual.stage === "late" ? "#FF3B30" : NIGHT }} />
              </div>
              <div className="flex-1 min-w-0">
                {ritual.stage === "countdown" ? (
                  <>
                    <p className="text-[15px] font-semibold tabular-nums" style={{ color: "var(--color-text-primary)" }}>
                      距离目标就寝还有 {ritual.countdownMinutes} 分钟
                    </p>
                    <p className="text-[12px] mt-0.5" style={{ color: "var(--color-text-secondary)" }}>
                      目标 {ritual.targetBedTime} · 倒数 30 分钟，放下手机准备洗漱
                    </p>
                  </>
                ) : (
                  <>
                    <p className="text-[15px] font-semibold" style={{ color: "var(--color-text-primary)" }}>
                      {ritual.stage === "late" ? "已过目标就寝时间" : "该睡了"}
                    </p>
                    <p className="text-[12px] mt-0.5" style={{ color: "var(--color-text-secondary)" }}>
                      目标 {ritual.targetBedTime} · 放下手机，上床打卡
                    </p>
                  </>
                )}
              </div>
            </div>
            <button
              type="button"
              onClick={ritual.checkIn}
              className="mt-3 w-full py-2.5 rounded-full text-[14px] font-semibold text-white active:opacity-90"
              style={{ background: ritual.stage === "late" ? "#FF3B30" : NIGHT }}
            >
              现在入睡 · 打卡
            </button>
          </div>
        )}

        {(ritual.stage === "idle" || (ritual.stage === "prepare" && !ritual.showPrepareBanner)) && (
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0" style={{ background: "#EEF2FF" }}>
              <Moon className="w-5 h-5" style={{ color: NIGHT }} />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-[15px] font-semibold" style={{ color: "var(--color-text-primary)" }}>
                今晚目标 {ritual.targetBedTime} 就寝
              </p>
              <p className="text-[12px] mt-0.5" style={{ color: "var(--color-text-secondary)" }}>
                环境提醒 {ritual.prepareTime} · 倒计时 {ritual.countdownTime}
              </p>
            </div>
          </div>
        )}

        {/* 渐进式目标进度（非已打卡时展示） */}
        {ritual.stage !== "done" && (
          <div className="mt-3 pt-3 flex items-center gap-2" style={{ borderTop: "1px solid var(--lifeflow-border)" }}>
            <TrendingDown className="w-3.5 h-3.5 shrink-0" style={{ color: "var(--color-text-disabled)" }} />
            <p className="text-[11px] leading-relaxed" style={{ color: "var(--color-text-disabled)" }}>
              {ritual.progressLabel}
            </p>
          </div>
        )}
      </motion.div>
    </div>
  );
}

function stageBadge(stage: string): string {
  switch (stage) {
    case "prepare": return "环境营造";
    case "countdown": return "倒计时";
    case "checkin": return "入睡打卡";
    case "late": return "晚睡提醒";
    case "done": return "已打卡";
    default: return "未开始";
  }
}
