"use client";

// ============================================================
// T21-5 坐姿健康：喝水 + 提肛 + 久坐休息 合并单一功能
// 数据保留：喝水写 waterLogs、提肛写 wellnessLogs（不删旧）
// ============================================================

import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import { ChevronLeft, Droplets, Timer, Heart, Footprints, Check } from "lucide-react";
import { usePostureHealth, SIT_INTERVALS, SIT_ACTIVE_END_H, SIT_ACTIVE_START_H } from "@/lib/posture-health";
import { showToast } from "@/components/ui/Toast";

const GREEN = "#10B981";
const BLUE = "#3B82F6";
const PINK = "#EC4899";

function ToggleSwitch({ checked, onChange, label }: { checked: boolean; onChange: () => void; label: string }) {
  return (
    <button type="button" role="switch" aria-checked={checked} aria-label={label} onClick={onChange}
      className="relative shrink-0 rounded-full cursor-pointer border-none outline-none"
      style={{ width: 51, height: 31, background: checked ? GREEN : "var(--lifeflow-border)", transition: "background 0.2s" }}>
      <div className="absolute rounded-full bg-white"
        style={{ width: 27, height: 27, top: 2, left: checked ? 22 : 2, boxShadow: "0 1px 3px rgba(0,0,0,0.15)", transition: "left 0.2s" }} />
    </button>
  );
}

export default function PostureHealthPage() {
  const router = useRouter();
  const ph = usePostureHealth();
  const waterPercent = Math.min(100, Math.round((ph.todayWaterMl / ph.waterGoalMl) * 100));

  return (
    <div className="min-h-screen max-w-[430px] mx-auto pb-[100px]" style={{ background: "var(--lifeflow-background)" }}>
      {/* Header */}
      <div className="flex items-center justify-center h-[44px] px-4 pt-[var(--safe-area-top)] relative">
        <button type="button" onClick={() => router.back()} className="absolute left-4 top-[calc(var(--safe-area-top)+4px)] p-1" aria-label="返回">
          <ChevronLeft className="w-6 h-6" style={{ color: "var(--lifeflow-primary)" }} />
        </button>
        <h1 className="text-title-nav" style={{ color: "var(--color-text-primary)" }}>坐姿健康</h1>
      </div>

      {/* 今日摘要 */}
      <div className="px-4 pt-5 pb-2">
        <div className="rounded-[20px] p-4" style={{ background: "var(--color-surface-card)", boxShadow: "var(--shadow-card)" }}>
          <p className="text-[13px] font-semibold mb-3" style={{ color: "var(--color-text-primary)" }}>今日健康</p>
          <div className="grid grid-cols-3 gap-2">
            <div className="rounded-[14px] p-3 text-center" style={{ background: "var(--lifeflow-background)" }}>
              <Droplets className="w-4 h-4 mx-auto mb-1.5" style={{ color: BLUE }} />
              <p className="text-[15px] font-bold tabular-nums" style={{ color: "var(--color-text-primary)" }}>{ph.todayWaterMl}<span className="text-[10px] font-medium" style={{ color: "var(--color-text-secondary)" }}>ml</span></p>
              <p className="text-[10px]" style={{ color: "var(--color-text-secondary)" }}>喝水 · 目标 {ph.waterGoalMl}</p>
            </div>
            <div className="rounded-[14px] p-3 text-center" style={{ background: "var(--lifeflow-background)" }}>
              <Heart className="w-4 h-4 mx-auto mb-1.5" style={{ color: PINK }} />
              <p className="text-[15px] font-bold tabular-nums" style={{ color: "var(--color-text-primary)" }}>{ph.tigangCountToday}<span className="text-[10px] font-medium" style={{ color: "var(--color-text-secondary)" }}>组</span></p>
              <p className="text-[10px]" style={{ color: "var(--color-text-secondary)" }}>提肛</p>
            </div>
            <div className="rounded-[14px] p-3 text-center" style={{ background: "var(--lifeflow-background)" }}>
              <Footprints className="w-4 h-4 mx-auto mb-1.5" style={{ color: GREEN }} />
              <p className="text-[15px] font-bold tabular-nums" style={{ color: "var(--color-text-primary)" }}>{ph.state.breakCount}<span className="text-[10px] font-medium" style={{ color: "var(--color-text-secondary)" }}>次</span></p>
              <p className="text-[10px]" style={{ color: "var(--color-text-secondary)" }}>久坐打断</p>
            </div>
          </div>
        </div>
      </div>

      {/* 坐姿周期提醒 */}
      <div className="px-4 pt-4 pb-2">
        <p className="text-[13px] font-medium px-5 pt-4 pb-2" style={{ color: "var(--color-text-secondary)" }}>坐姿周期提醒（每 30-60 分钟起身活动）</p>
        <div className="rounded-[20px] overflow-hidden" style={{ background: "var(--color-surface-card)", boxShadow: "var(--shadow-card)" }}>
          <div className="flex items-center justify-between w-full px-5 py-3.5">
            <div className="flex items-center gap-3 min-w-0">
              <div className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0" style={{ background: "#ECFDF5" }}>
                <Timer className="w-5 h-5" style={{ color: GREEN }} />
              </div>
              <div className="min-w-0">
                <p className="text-[16px] font-medium" style={{ color: "var(--color-text-primary)" }}>坐姿提醒</p>
                <p className="text-[12px] mt-0.5 tabular-nums" style={{ color: "var(--color-text-secondary)" }}>
                  {ph.enabled
                    ? ph.minutesLeft !== null ? `距下次提醒 ${ph.minutesLeft} 分钟` : "已开启"
                    : "开启后到点提醒起身活动"}
                </p>
              </div>
            </div>
            <ToggleSwitch checked={ph.enabled} onChange={() => ph.setEnabled(!ph.enabled)} label="坐姿提醒" />
          </div>

          <div className="h-px" style={{ background: "var(--lifeflow-border)", marginLeft: "52px" }} />
          <div className="flex items-center justify-between px-5 py-3.5">
            <span className="text-[15px]" style={{ color: "var(--color-text-primary)" }}>提醒间隔</span>
            <div className="flex gap-1.5">
              {SIT_INTERVALS.map((m) => (
                <button
                  key={m}
                  type="button"
                  onClick={() => ph.setInterval(m)}
                  className="px-3 py-1.5 rounded-full text-[13px] font-medium tabular-nums active:opacity-70"
                  style={{
                    background: ph.intervalMin === m ? GREEN : "var(--lifeflow-muted)",
                    color: ph.intervalMin === m ? "#fff" : "var(--color-text-secondary)",
                  }}
                >
                  {m}分
                </button>
              ))}
            </div>
          </div>

          <div className="h-px" style={{ background: "var(--lifeflow-border)", marginLeft: "52px" }} />
          <div className="px-5 py-3">
            <p className="text-[12px] leading-relaxed" style={{ color: "var(--color-text-disabled)" }}>
              提醒时段 {String(SIT_ACTIVE_START_H).padStart(2, "0")}:00-{SIT_ACTIVE_END_H}:00 · 到点推送通知 + 应用内提醒
            </p>
          </div>
        </div>
      </div>

      {/* 完成休息（久坐打断） */}
      <div className="px-4 pt-4 pb-2">
        <button
          type="button"
          onClick={ph.completeBreak}
          className="w-full py-4 rounded-[20px] text-[16px] font-semibold text-white active:opacity-90 flex items-center justify-center gap-2"
          style={{ background: GREEN, boxShadow: "var(--shadow-card)" }}
        >
          <Footprints className="w-5 h-5" />
          起身活动 · 完成一轮休息
        </button>
        <p className="text-[12px] mt-2 text-center" style={{ color: "var(--color-text-disabled)" }}>
          生成 5 分钟休息日程（可去日程页矫正），同时记一次久坐打断
        </p>
      </div>

      {/* 喝水 */}
      <div className="px-4 pt-4 pb-2">
        <p className="text-[13px] font-medium px-5 pt-4 pb-2" style={{ color: "var(--color-text-secondary)" }}>喝水</p>
        <div className="rounded-[20px] overflow-hidden" style={{ background: "var(--color-surface-card)", boxShadow: "var(--shadow-card)" }}>
          <div className="px-5 pt-4">
            <div className="flex items-end justify-between mb-2">
              <p className="text-[24px] font-bold tabular-nums" style={{ color: "var(--color-text-primary)" }}>
                {ph.todayWaterMl}<span className="text-[13px] font-medium" style={{ color: "var(--color-text-secondary)" }}> / {ph.waterGoalMl} ml</span>
              </p>
              <span className="text-[12px] font-medium tabular-nums" style={{ color: BLUE }}>{waterPercent}%</span>
            </div>
            <div className="h-2 rounded-full overflow-hidden" style={{ background: "var(--lifeflow-muted)" }}>
              <div className="h-full rounded-full transition-all duration-500" style={{ width: `${waterPercent}%`, background: BLUE }} />
            </div>
          </div>
          <div className="flex items-center justify-between px-5 py-3.5 mt-2" style={{ borderTop: "1px solid var(--lifeflow-border)", marginLeft: "20px" }}>
            <div className="flex items-center gap-2">
              <Droplets className="w-4 h-4" style={{ color: BLUE }} />
              <span className="text-[14px]" style={{ color: "var(--color-text-primary)" }}>刚喝了水？快速记一杯（{ph.cupSize}ml）</span>
            </div>
            <button
              type="button"
              onClick={ph.addWater}
              className="flex items-center gap-1 px-3 py-1.5 rounded-full text-[13px] font-semibold text-white active:opacity-80"
              style={{ background: BLUE }}
            >
              <Check className="w-3.5 h-3.5" /> +{ph.cupSize}ml
            </button>
          </div>
          <div className="px-5 py-3" style={{ borderTop: "1px solid var(--lifeflow-border)", marginLeft: "20px" }}>
            <button type="button" onClick={() => router.push("/more/water")} className="text-[12px] font-medium active:opacity-60"
              style={{ color: "var(--lifeflow-primary)" }}>
              完整饮水页：目标 · 时段统计 →
            </button>
          </div>
        </div>
      </div>

      {/* 提肛 */}
      <div className="px-4 pt-4 pb-2">
        <p className="text-[13px] font-medium px-5 pt-4 pb-2" style={{ color: "var(--color-text-secondary)" }}>提肛（凯格尔）</p>
        <div className="rounded-[20px] overflow-hidden" style={{ background: "var(--color-surface-card)", boxShadow: "var(--shadow-card)" }}>
          <div className="flex items-center justify-between px-5 py-4">
            <div className="flex items-center gap-3 min-w-0">
              <div className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0" style={{ background: "#FDF2F8" }}>
                <Heart className="w-5 h-5" style={{ color: PINK }} />
              </div>
              <div className="min-w-0">
                <p className="text-[16px] font-medium" style={{ color: "var(--color-text-primary)" }}>今日 {ph.tigangCountToday} 组</p>
                <p className="text-[12px] mt-0.5" style={{ color: "var(--color-text-secondary)" }}>建议每天 3-5 组，一组 10 次 · 可在坐姿提醒时顺带做</p>
              </div>
            </div>
            <button
              type="button"
              onClick={ph.addTigang}
              className="flex items-center gap-1 px-3 py-1.5 rounded-full text-[13px] font-semibold text-white active:opacity-80 shrink-0"
              style={{ background: PINK }}
            >
              <Check className="w-3.5 h-3.5" /> 完成一组
            </button>
          </div>
        </div>
      </div>

      {/* 规则说明 */}
      <div className="px-4 pt-4 pb-2">
        <div className="rounded-[16px] p-4" style={{ background: "var(--color-surface-card)", boxShadow: "var(--shadow-card)" }}>
          <p className="text-[13px] font-semibold mb-2" style={{ color: "var(--color-text-primary)" }}>为什么合并在一起？</p>
          <p className="text-[12px] leading-relaxed" style={{ color: "var(--color-text-secondary)" }}>
            久坐提醒、喝水、提肛其实是一件事：坐久了就该起身 —— 起身时顺手喝口水、做一组提肛，三个健康动作一次完成，不增加负担。
            原有喝水/训练数据完整保留，只是入口收敛到这里。
          </p>
        </div>
      </div>

      {/* 无权限提示 */}
      {ph.enabled && typeof window !== "undefined" && "Notification" in window && Notification.permission === "denied" && (
        <div className="px-4 pt-2 pb-2">
          <p className="text-[12px]" style={{ color: "#FF3B30" }}>
            通知权限已关闭，提醒只能在应用内显示。请在浏览器设置中允许通知。
          </p>
        </div>
      )}
    </div>
  );
}
