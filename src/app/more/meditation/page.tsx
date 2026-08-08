"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { ChevronLeft, Play, Pause, RotateCcw, Sparkles, Wind, ScanLine, Brain } from "lucide-react";
import { addMeditationSession, getTodayMeditationSessions } from "@/lib/db/life.db";
import type { MeditationSession } from "@/lib/db/life.db";
import { showToast } from "@/components/ui/Toast";

// T23.1：冥想模块 —— 正念 / 呼吸 / 身体扫描 / 引导式
const STYLE_OPTIONS: { key: MeditationSession["style"]; label: string; desc: string; icon: React.ComponentType<{ className?: string; style?: React.CSSProperties }>; color: string }[] = [
  { key: "mindfulness", label: "正念冥想", desc: "观察呼吸，回到当下", icon: Sparkles, color: "#8B5CF6" },
  { key: "breathing", label: "呼吸练习", desc: "4-7-8 呼吸法", icon: Wind, color: "#06B6D4" },
  { key: "body-scan", label: "身体扫描", desc: "从头到脚放松", icon: ScanLine, color: "#10B981" },
  { key: "guided", label: "引导冥想", desc: "跟随引导入睡", icon: Brain, color: "#6366F1" },
];
const DURATION_OPTIONS = [5, 10, 15, 20, 30];

function todayStr(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

export default function MeditationPage() {
  const router = useRouter();
  const [minutes, setMinutes] = useState(10);
  const [style, setStyle] = useState<MeditationSession["style"]>("mindfulness");
  const [seconds, setSeconds] = useState(minutes * 60);
  const [running, setRunning] = useState(false);
  const [sessions, setSessions] = useState<MeditationSession[]>([]);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    getTodayMeditationSessions(todayStr()).then(setSessions);
  }, []);

  useEffect(() => {
    setSeconds(minutes * 60);
    setRunning(false);
    if (intervalRef.current) clearInterval(intervalRef.current);
  }, [minutes, style]);

  const tick = useCallback(() => {
    setSeconds((s) => {
      if (s <= 1) {
        addMeditationSession({
          date: todayStr(),
          duration: minutes,
          style,
          completed: true,
          startedAt: Date.now() - minutes * 60000,
          endedAt: Date.now(),
        });
        if (intervalRef.current) clearInterval(intervalRef.current);
        getTodayMeditationSessions(todayStr()).then(setSessions);
        setRunning(false);
        showToast({ type: "success", message: "冥想完成，已记录 ✨" });
        return 0;
      }
      return s - 1;
    });
  }, [minutes, style]);

  const toggle = () => {
    if (running) {
      if (intervalRef.current) clearInterval(intervalRef.current);
      setRunning(false);
    } else {
      if (seconds === 0) setSeconds(minutes * 60);
      intervalRef.current = setInterval(tick, 1000);
      setRunning(true);
    }
  };

  const reset = () => {
    if (intervalRef.current) clearInterval(intervalRef.current);
    setSeconds(minutes * 60);
    setRunning(false);
  };

  const progress = 1 - seconds / (minutes * 60);
  const min = Math.floor(seconds / 60);
  const sec = seconds % 60;
  const activeStyle = STYLE_OPTIONS.find((s) => s.key === style)!;
  const todayMinutes = sessions.filter((s) => s.completed).reduce((sum, s) => sum + s.duration, 0);
  const todayCount = sessions.filter((s) => s.completed).length;

  return (
    <div className="mx-auto px-4 pt-4 pb-[100px] flex flex-col items-center" style={{ maxWidth: 430 }}>
      {/* Header */}
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
          <h1 className="min-w-0 flex-1 text-center truncate" style={{ fontSize: "17px", fontWeight: 600, color: "var(--color-text-primary)", letterSpacing: "-0.018em" }}>
            冥想放松
          </h1>
          <div className="w-9 shrink-0"></div>
        </div>
        {todayCount > 0 && (
          <p className="text-center mt-1 text-[12px]" style={{ color: "var(--color-text-secondary)" }}>
            今日已冥想 {todayCount} 次 · 共 {todayMinutes} 分钟
          </p>
        )}
      </header>

      {/* 引导卡 */}
      <div className="w-full rounded-[20px] p-4 mb-4 text-center" style={{ background: "linear-gradient(135deg, rgba(139,92,246,0.12), rgba(6,182,212,0.10))", border: "1px solid rgba(139,92,246,0.2)" }}>
        <p className="text-[13px] leading-relaxed" style={{ color: "var(--color-text-secondary)" }}>
          {running ? "放下手机，回到呼吸，觉察当下…" : "选一种冥想方式与时长，开始前请静坐片刻"}
        </p>
      </div>

      {/* 冥想方式 */}
      <section className="w-full mb-5">
        <p className="text-[13px] font-semibold mb-2" style={{ color: "var(--color-text-secondary)" }}>冥想方式</p>
        <div className="grid grid-cols-2 gap-2.5">
          {STYLE_OPTIONS.map((s) => {
            const active = style === s.key;
            return (
              <button
                key={s.key}
                type="button"
                onClick={() => setStyle(s.key)}
                className="flex items-center gap-2.5 rounded-[16px] px-3.5 py-3 text-left transition-all active:scale-[0.98]"
                style={{
                  background: active ? `${s.color}16` : "var(--color-surface-card)",
                  border: `1.5px solid ${active ? s.color : "var(--lifeflow-border)"}`,
                  boxShadow: "var(--shadow-card)",
                }}
              >
                <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full" style={{ background: `${s.color}18`, color: s.color }}>
                  <s.icon className="w-4 h-4" />
                </span>
                <span className="min-w-0">
                  <span className="block text-[13.5px] font-semibold leading-tight" style={{ color: "var(--color-text-primary)" }}>{s.label}</span>
                  <span className="block text-[11px] mt-0.5 truncate" style={{ color: "var(--color-text-secondary)" }}>{s.desc}</span>
                </span>
              </button>
            );
          })}
        </div>
      </section>

      {/* 时长选择 */}
      <section className="w-full mb-5">
        <p className="text-[13px] font-semibold mb-2" style={{ color: "var(--color-text-secondary)" }}>时长</p>
        <div className="flex gap-2">
          {DURATION_OPTIONS.map((d) => (
            <button
              key={d}
              type="button"
              onClick={() => setMinutes(d)}
              className="flex-1 h-10 rounded-full text-[13px] font-semibold tabular-nums transition-all active:scale-95"
              style={{
                background: minutes === d ? activeStyle.color : "var(--color-surface-card)",
                color: minutes === d ? "#fff" : "var(--color-text-secondary)",
                boxShadow: "var(--shadow-card)",
              }}
            >
              {d} 分钟
            </button>
          ))}
        </div>
      </section>

      {/* 计时环 */}
      <section className="card-standard p-6 mb-4 flex flex-col items-center w-full" style={{ background: "var(--color-surface-card)", borderRadius: 24, boxShadow: "var(--shadow-card)" }}>
        <div className="relative mb-4" style={{ width: 180, height: 180 }}>
          <svg width="180" height="180" viewBox="0 0 180 180" className="-rotate-90">
            <circle cx="90" cy="90" r="78" fill="none" stroke="var(--lifeflow-muted)" strokeWidth="8" />
            <circle
              cx="90" cy="90" r="78" fill="none"
              stroke={activeStyle.color}
              strokeWidth="8" strokeLinecap="round"
              strokeDasharray={2 * Math.PI * 78}
              strokeDashoffset={2 * Math.PI * 78 * (1 - progress)}
              style={{ transition: "stroke-dashoffset 0.3s linear" }}
            />
          </svg>
          <div className="absolute inset-0 flex flex-col items-center justify-center">
            <span className="text-[40px] font-bold tabular-nums leading-none" style={{ color: "var(--color-text-primary)" }}>
              {String(min).padStart(2, "0")}:{String(sec).padStart(2, "0")}
            </span>
            <span className="mt-1.5 text-[12px] font-medium" style={{ color: activeStyle.color }}>
              {activeStyle.label}
            </span>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={reset}
            className="h-11 w-11 rounded-full flex items-center justify-center active:scale-90 transition-transform"
            style={{ background: "var(--lifeflow-muted)", color: "var(--color-text-secondary)" }}
            aria-label="重置"
          >
            <RotateCcw className="w-5 h-5" />
          </button>
          <button
            type="button"
            onClick={toggle}
            className="h-14 w-14 rounded-full flex items-center justify-center text-white active:scale-90 transition-transform"
            style={{ background: activeStyle.color, boxShadow: `0 4px 16px ${activeStyle.color}44` }}
            aria-label={running ? "暂停" : "开始冥想"}
          >
            {running ? <Pause className="w-6 h-6" /> : <Play className="w-6 h-6 ml-0.5" />}
          </button>
        </div>
      </section>

      {/* 今日记录 */}
      <section className="w-full">
        <p className="text-[13px] font-semibold mb-2" style={{ color: "var(--color-text-secondary)" }}>今日记录</p>
        {sessions.length === 0 ? (
          <div className="rounded-[16px] py-6 text-center" style={{ background: "var(--color-surface-card)", boxShadow: "var(--shadow-card)" }}>
            <p className="text-[13px]" style={{ color: "var(--color-text-secondary)" }}>
              今天还没有冥想，给自己几分钟安静
            </p>
          </div>
        ) : (
          <div className="flex flex-col rounded-[16px] overflow-hidden" style={{ background: "var(--color-surface-card)", boxShadow: "var(--shadow-card)" }}>
            {sessions.map((s, i) => {
              const meta = STYLE_OPTIONS.find((x) => x.key === s.style)!;
              const t = new Date(s.startedAt);
              const hm = `${String(t.getHours()).padStart(2, "0")}:${String(t.getMinutes()).padStart(2, "0")}`;
              return (
                <div key={s.id} className="flex items-center gap-3 px-4 py-2.5" style={{ borderTop: i > 0 ? "0.5px solid var(--lifeflow-border)" : "none" }}>
                  <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full" style={{ background: `${meta.color}18`, color: meta.color }}>
                    <meta.icon className="w-3.5 h-3.5" />
                  </span>
                  <span className="flex-1 text-[13.5px] font-medium" style={{ color: "var(--color-text-primary)" }}>{meta.label}</span>
                  <span className="text-[12px] tabular-nums" style={{ color: "var(--color-text-secondary)" }}>{hm}</span>
                  <span className="text-[12px] font-semibold tabular-nums" style={{ color: meta.color }}>{s.duration} 分钟</span>
                </div>
              );
            })}
          </div>
        )}
      </section>
    </div>
  );
}
