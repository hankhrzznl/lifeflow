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
    <div className="mx-auto px-4 pt-4 pb-[100px] flex flex-col items-center" style={{ maxWidth: 430 }}>
      {/* Header - bordered back button + centered title */}
      <header className="sticky top-0 z-20 w-full pb-3 mb-6" style={{ background: "var(--lifeflow-background)", paddingTop: "16px" }}>
        <div className="flex items-center">
          <button
            onClick={() => router.push("/more")}
            className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-lg"
            style={{ background: "var(--lifeflow-card)", border: "1px solid var(--lifeflow-border)" }}
            aria-label="返回"
          >
            <ChevronLeft className="h-5 w-5" style={{ color: "var(--color-text-primary)" }} />
          </button>
          <h1
            className="min-w-0 flex-1 text-center truncate"
            style={{ fontFamily: "var(--font-system)", fontSize: "17px", fontWeight: 600, color: "var(--color-text-primary)", letterSpacing: "-0.018em" }}
          >
            专注计时
          </h1>
          <div className="w-9 shrink-0"></div>
        </div>
      </header>

      {/* Timer Card */}
      <section className="card-standard p-6 mb-4 flex flex-col items-center w-full">
        {/* Circular Timer Display with SVG Progress Ring */}
        <div className="relative mb-4" style={{ width: 180, height: 180 }}>
          <svg viewBox="0 0 200 200" className="w-full h-full -rotate-90">
            <circle cx="100" cy="100" r="90" fill="none" stroke="var(--lifeflow-background)" strokeWidth="8" />
            <circle cx="100" cy="100" r="90" fill="none" stroke="var(--lifeflow-primary)" strokeWidth="8"
              strokeLinecap="round" strokeDasharray={`${progress * 565} 565`}
              style={{ transition: "stroke-dashoffset 1s linear" }} />
          </svg>
          <div className="absolute inset-0 flex flex-col items-center justify-center">
            <Timer className="h-8 w-8 mb-1" style={{ color: "var(--lifeflow-primary)" }} />
            <span
              className="text-[40px] font-bold tabular-nums"
              style={{ color: "var(--color-text-primary)", letterSpacing: "-0.022em" }}
            >
              {String(min).padStart(2, "0")}:{String(sec).padStart(2, "0")}
            </span>
          </div>
        </div>

        {/* Mode Label */}
        <span className="text-label mb-6">{mode === "focus" ? "番茄钟" : "休息"}</span>

        {/* Preset Duration Pills */}
        <div className="flex flex-wrap gap-2 justify-center mb-6">
          {FOCUS_OPTIONS.map((opt) => (
            <button
              key={opt}
              onClick={() => { if (!running) { setFocusMin(opt); setMode("focus"); } }}
              className="pill-button whitespace-nowrap inline-flex items-center h-9"
              style={{
                background: !running && mode === "focus" && focusMin === opt ? "var(--lifeflow-primary)" : "var(--color-surface-card)",
                color: !running && mode === "focus" && focusMin === opt ? "#FFFFFF" : "var(--color-text-primary)",
                borderColor: !running && mode === "focus" && focusMin === opt ? "var(--lifeflow-primary)" : "var(--lifeflow-border)",
              }}
            >
              {opt}分钟
            </button>
          ))}
        </div>

        {/* Start / Pause Button */}
        <button
          onClick={toggle}
          className="whitespace-nowrap inline-flex items-center justify-center gap-2"
          style={{
            background: "var(--lifeflow-primary)",
            color: "var(--lifeflow-primary-foreground)",
            borderRadius: "var(--lifeflow-radius-full)",
            padding: "14px 48px",
            fontSize: "17px",
            fontWeight: 600,
            fontFamily: "var(--font-system)",
            letterSpacing: "-0.018em",
            border: "none",
            cursor: "pointer",
          }}
        >
          {running ? <Pause className="w-5 h-5" /> : <Play className="w-5 h-5" />}
          {running ? "暂停" : "开始专注"}
        </button>

        {/* Reset & Mode Toggle */}
        <div className="flex items-center gap-5 mt-4">
          <button
            onClick={reset}
            className="flex items-center gap-1 text-[13px] font-medium"
            style={{ color: "var(--color-text-secondary)" }}
          >
            <RotateCcw className="w-4 h-4" />
            重置
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
      </section>

      {/* Today's Stats Card */}
      <section className="card-standard p-4 w-full">
        <div className="flex items-center justify-between">
          <span className="text-label truncate">今日专注</span>
          <span
            className="whitespace-nowrap"
            style={{ fontFamily: "var(--font-system)", fontSize: "20px", fontWeight: 700, color: "var(--color-text-primary)", letterSpacing: "-0.018em" }}
          >
            {totalFocusMin} 分钟
          </span>
        </div>
      </section>
    </div>
  );
}
