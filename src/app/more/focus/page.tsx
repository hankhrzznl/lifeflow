"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { ChevronLeft, Play, Pause, RotateCcw, Timer } from "lucide-react";
import { addFocusSession, getTodayFocusSessions } from "@/lib/db/life.db";
import type { FocusSession } from "@/lib/db/life.db";

const BREAK_MIN = 5;
const FOCUS_OPTIONS = [25, 45, 60];

function todayStr(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

export default function FocusPage() {
  const router = useRouter();

  const [focusMin, setFocusMin] = useState(25);
  const [mode, setMode] = useState<"focus" | "break">("focus");
  const [seconds, setSeconds] = useState(focusMin * 60);
  const [running, setRunning] = useState(false);
  const [sessions, setSessions] = useState<FocusSession[]>([]);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const totalMin = mode === "focus" ? focusMin : BREAK_MIN;

  useEffect(() => {
    getTodayFocusSessions(todayStr()).then(setSessions);
  }, []);

  useEffect(() => {
    setSeconds(totalMin * 60);
    setRunning(false);
    if (intervalRef.current) clearInterval(intervalRef.current);
  }, [mode, totalMin]);

  const tick = useCallback(() => {
    setSeconds((s) => {
      if (s <= 1) {
        if (mode === "focus") {
          addFocusSession({ date: todayStr(), duration: focusMin, type: "focus", completed: true, startedAt: Date.now() - focusMin * 60000, endedAt: Date.now() });
        }
        if (intervalRef.current) clearInterval(intervalRef.current);
        getTodayFocusSessions(todayStr()).then(setSessions);
        setRunning(false);
        return 0;
      }
      return s - 1;
    });
  }, [mode, focusMin]);

  const toggle = () => {
    if (running) {
      if (intervalRef.current) clearInterval(intervalRef.current);
      setRunning(false);
    } else {
      if (seconds === 0) setSeconds(totalMin * 60);
      intervalRef.current = setInterval(tick, 1000);
      setRunning(true);
    }
  };

  const reset = () => {
    if (intervalRef.current) clearInterval(intervalRef.current);
    setSeconds(totalMin * 60);
    setRunning(false);
  };

  const progress = 1 - seconds / (totalMin * 60);
  const min = Math.floor(seconds / 60);
  const sec = seconds % 60;

  const completedFocus = sessions.filter((s) => s.type === "focus" && s.completed).length;
  const totalFocusMin = sessions.filter((s) => s.type === "focus" && s.completed).reduce((sum, s) => sum + s.duration, 0);

  return (
    <div className="mx-auto px-4 pt-5 pb-[100px] flex flex-col items-center" style={{ maxWidth: 430 }}>
      {/* 页头 */}
      <div className="flex items-center gap-2 mb-3 w-full">
        <button type="button" onClick={() => router.push("/more")} className="w-8 h-8 -ml-1 flex items-center justify-center">
          <ChevronLeft className="w-6 h-6" style={{ color: "var(--color-text-primary)" }} />
        </button>
        <h1 className="text-[28px] font-bold tracking-[-0.02em] leading-tight flex-1" style={{ color: "var(--color-text-primary)" }}>专注计时</h1>
      </div>
      <p className="text-[15px] mb-5 w-full text-left" style={{ color: "var(--color-text-secondary)" }}>番茄工作法 · 保持专注</p>

      {/* 时长选择 pills */}
      <div className="flex rounded-full p-1 mb-8" style={{ backgroundColor: "var(--lifeflow-background)" }}>
        {FOCUS_OPTIONS.map((opt) => (
          <button
            key={opt}
            onClick={() => { if (!running) { setFocusMin(opt); setMode("focus"); } }}
            className="px-6 py-2 rounded-full text-[15px] font-medium transition-colors"
            style={{
              backgroundColor: mode === "focus" && focusMin === opt ? "var(--lifeflow-primary)" : "transparent",
              color: mode === "focus" && focusMin === opt ? "#FFFFFF" : "var(--color-text-secondary)",
            }}
          >
            {opt} min
          </button>
        ))}
      </div>

      {/* 计时环 180x180 */}
      <div className="relative mb-8" style={{ width: 180, height: 180 }}>
        <svg viewBox="0 0 200 200" className="w-full h-full -rotate-90">
          <circle cx="100" cy="100" r="90" fill="none" stroke="var(--lifeflow-background)" strokeWidth="8" />
          <circle cx="100" cy="100" r="90" fill="none" stroke="var(--lifeflow-primary)" strokeWidth="8"
            strokeLinecap="round" strokeDasharray={`${progress * 565} 565`}
            style={{ transition: "stroke-dashoffset 1s linear" }} />
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span
            className="text-[42px] font-bold tabular-nums"
            style={{ color: running ? "var(--lifeflow-primary)" : "var(--color-text-primary)" }}
          >
            {String(min).padStart(2, "0")}:{String(sec).padStart(2, "0")}
          </span>
          <span className="text-[13px] mt-1" style={{ color: "var(--color-text-secondary)" }}>
            {mode === "focus" ? "专注中" : "休息中"}
          </span>
        </div>
      </div>

      {/* 控制按钮 */}
      <div className="flex items-center gap-6 mb-8">
        <button onClick={reset}
          className="w-11 h-11 rounded-full flex items-center justify-center"
          style={{ backgroundColor: "var(--lifeflow-background)" }}>
          <RotateCcw className="w-5 h-5" style={{ color: "var(--color-text-secondary)" }} />
        </button>
        <button onClick={toggle}
          className="w-[64px] h-[64px] rounded-full flex items-center justify-center text-white"
          style={{
            backgroundColor: "var(--lifeflow-primary)",
            boxShadow: "0 4px 16px rgba(37, 99, 235, 0.35)",
          }}>
          {running ? <Pause className="w-7 h-7" /> : <Play className="w-7 h-7 ml-1" />}
        </button>
        <button
          onClick={() => setMode(mode === "focus" ? "break" : "focus")}
          disabled={running}
          className="text-[13px] font-medium"
          style={{ color: running ? "var(--color-text-disabled)" : "var(--color-text-secondary)" }}
        >
          {mode === "focus" ? `休息 ${BREAK_MIN}min` : `专注 ${focusMin}min`}
        </button>
      </div>

      {/* 今日统计 */}
      <div
        className="rounded-[20px] p-4 w-full"
        style={{
          backgroundColor: "var(--color-surface-card)",
          boxShadow: "var(--shadow-card)",
        }}
      >
        <div className="flex items-center gap-2 mb-3">
          <Timer className="w-5 h-5" style={{ color: "var(--lifeflow-primary)" }} />
          <span className="text-[17px] font-semibold" style={{ color: "var(--color-text-primary)" }}>今日统计</span>
        </div>
        <div className="flex gap-4">
          <div className="flex-1 text-center py-2 rounded-lg" style={{ backgroundColor: "var(--lifeflow-brand-50)" }}>
            <div className="text-[24px] font-bold" style={{ color: "var(--lifeflow-primary)" }}>{completedFocus}</div>
            <div className="text-[13px]" style={{ color: "var(--color-text-secondary)" }}>番茄数</div>
          </div>
          <div className="flex-1 text-center py-2 rounded-lg" style={{ backgroundColor: "var(--lifeflow-brand-50)" }}>
            <div className="text-[24px] font-bold" style={{ color: "var(--lifeflow-primary)" }}>{totalFocusMin}min</div>
            <div className="text-[13px]" style={{ color: "var(--color-text-secondary)" }}>总专注</div>
          </div>
        </div>
      </div>
    </div>
  );
}
