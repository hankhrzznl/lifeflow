"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { ChevronLeft, Play, Pause, RotateCcw, Timer } from "lucide-react";
import { addFocusSession, getTodayFocusSessions } from "@/lib/db/life.db";
import type { FocusSession } from "@/lib/db/life.db";

const FOCUS_MIN = 25;
const BREAK_MIN = 5;

function todayStr(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

export default function FocusPage() {
  const router = useRouter();

  const [mode, setMode] = useState<"focus" | "break">("focus");
  const [seconds, setSeconds] = useState(FOCUS_MIN * 60);
  const [running, setRunning] = useState(false);
  const [sessions, setSessions] = useState<FocusSession[]>([]);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const totalMin = mode === "focus" ? FOCUS_MIN : BREAK_MIN;

  useEffect(() => {
    getTodayFocusSessions(todayStr()).then(setSessions);
  }, []);

  useEffect(() => {
    setSeconds(totalMin * 60);
    setRunning(false);
    if (intervalRef.current) clearInterval(intervalRef.current);
  }, [mode]);

  const tick = useCallback(() => {
    setSeconds((s) => {
      if (s <= 1) {
        if (mode === "focus") {
          addFocusSession({ date: todayStr(), duration: FOCUS_MIN, type: "focus", completed: true, startedAt: Date.now() - FOCUS_MIN * 60000, endedAt: Date.now() });
        }
        if (intervalRef.current) clearInterval(intervalRef.current);
        getTodayFocusSessions(todayStr()).then(setSessions);
        setRunning(false);
        return 0;
      }
      return s - 1;
    });
  }, [mode]);

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
    <div className="px-4 pt-5 pb-6 flex flex-col items-center">
      {/* 页头 */}
      <div className="flex items-center gap-2 mb-6 w-full">
        <button type="button" onClick={() => router.push("/more")} className="w-8 h-8 -ml-1 flex items-center justify-center">
          <ChevronLeft className="w-6 h-6 text-black" />
        </button>
        <h1 className="text-[34px] font-bold tracking-[-0.02em] leading-tight flex-1">专注计时</h1>
      </div>

      {/* 模式切换 */}
      <div className="flex rounded-full bg-[#F2F2F7] p-1 mb-8">
        {(["focus", "break"] as const).map((m) => (
          <button key={m} onClick={() => setMode(m)}
            className={`px-6 py-2 rounded-full text-[15px] font-medium transition-colors ${mode === m ? "bg-[#6366F1] text-white" : "text-[#8E8E93]"}`}>
            {m === "focus" ? "专注 25分钟" : "休息 5分钟"}
          </button>
        ))}
      </div>

      {/* 计时环 */}
      <div className="relative w-48 h-48 mb-8">
        <svg viewBox="0 0 200 200" className="w-full h-full -rotate-90">
          <circle cx="100" cy="100" r="90" fill="none" stroke="#F2F2F7" strokeWidth="8" />
          <circle cx="100" cy="100" r="90" fill="none" stroke="#6366F1" strokeWidth="8"
            strokeLinecap="round" strokeDasharray={`${progress * 565} 565`}
            style={{ transition: "stroke-dashoffset 1s linear" }} />
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span className="text-[42px] font-bold tabular-nums" style={{ color: running ? "#6366F1" : "#1D1D1F" }}>
            {String(min).padStart(2, "0")}:{String(sec).padStart(2, "0")}
          </span>
        </div>
      </div>

      {/* 控制按钮 */}
      <div className="flex gap-4 mb-8">
        <button onClick={reset}
          className="w-12 h-12 rounded-full bg-[#F2F2F7] flex items-center justify-center">
          <RotateCcw className="w-5 h-5 text-[#8E8E93]" />
        </button>
        <button onClick={toggle}
          className="w-16 h-16 rounded-full flex items-center justify-center text-white"
          style={{ background: "#6366F1", boxShadow: "0 4px 16px rgba(99,102,241,0.35)" }}>
          {running ? <Pause className="w-7 h-7" /> : <Play className="w-7 h-7 ml-1" />}
        </button>
      </div>

      {/* 今日统计 */}
      <div className="rounded-xl bg-white p-4 w-full shadow-[0_1px_4px_rgba(0,0,0,0.04)]">
        <div className="flex items-center gap-2 mb-3">
          <Timer className="w-5 h-5" style={{ color: "#6366F1" }} />
          <span className="text-[17px] font-semibold">今日统计</span>
        </div>
        <div className="flex gap-4">
          <div className="flex-1 text-center py-2 rounded-lg" style={{ background: "#6366F110" }}>
            <div className="text-[24px] font-bold" style={{ color: "#6366F1" }}>{completedFocus}</div>
            <div className="text-[13px]" style={{ color: "#8E8E93" }}>番茄数</div>
          </div>
          <div className="flex-1 text-center py-2 rounded-lg" style={{ background: "#6366F110" }}>
            <div className="text-[24px] font-bold" style={{ color: "#6366F1" }}>{totalFocusMin}min</div>
            <div className="text-[13px]" style={{ color: "#8E8E93" }}>总专注</div>
          </div>
        </div>
      </div>
    </div>
  );
}
