"use client";

import { useState, useRef, useEffect, useCallback, useMemo } from "react";
import type { ComponentType, CSSProperties } from "react";
import { useRouter } from "next/navigation";
import {
  ChevronLeft, Play, Pause, RotateCcw,
  Flower2, Wind, ScanLine, Brain, Check,
  Clock, Sparkles, TrendingUp, Flame,
} from "lucide-react";
import { addMeditationSession, getTodayMeditationSessions, getRecentMeditationSessions } from "@/lib/db/life.db";
import type { MeditationSession } from "@/lib/db/life.db";
import { showToast } from "@/components/ui/Toast";

// T23.1：冥想模块 —— 正念 / 呼吸 / 身体扫描 / 引导式
const STYLE_OPTIONS: { key: MeditationSession["style"]; label: string; desc: string; icon: ComponentType<{ className?: string; style?: CSSProperties }>; color: string }[] = [
  { key: "mindfulness", label: "正念冥想", desc: "观察呼吸，回到当下", icon: Flower2, color: "#8B5CF6" },
  { key: "breathing", label: "呼吸练习", desc: "4-7-8 呼吸法", icon: Wind, color: "#3B82F6" },
  { key: "body-scan", label: "身体扫描", desc: "从头到脚放松", icon: ScanLine, color: "#10B981" },
  { key: "guided", label: "引导冥想", desc: "跟随引导入睡", icon: Brain, color: "#6366F1" },
];
const DURATION_OPTIONS = [5, 10, 15, 20, 30];

const BAR_KEYFRAMES = `
  @keyframes lf-bar-grow { from { transform: scaleY(0.06); } to { transform: scaleY(1); } }
  .lf-bar-anim { transform-origin: bottom; animation: lf-bar-grow 0.7s cubic-bezier(0.22, 1, 0.36, 1) both; }
  @media (prefers-reduced-motion: reduce) { .lf-bar-anim { animation: none; } }
`;

function toDateStr(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function todayStr(): string {
  return toDateStr(new Date());
}

export default function MeditationPage() {
  const router = useRouter();
  const [minutes, setMinutes] = useState(10);
  const [style, setStyle] = useState<MeditationSession["style"]>("mindfulness");
  const [seconds, setSeconds] = useState(minutes * 60);
  const [running, setRunning] = useState(false);
  const [sessions, setSessions] = useState<MeditationSession[]>([]);
  const [weekSessions, setWeekSessions] = useState<MeditationSession[]>([]);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    Promise.all([
      getTodayMeditationSessions(todayStr()),
      getRecentMeditationSessions(7),
    ]).then(([today, week]) => {
      setSessions(today);
      setWeekSessions(week);
    });
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
        getRecentMeditationSessions(7).then(setWeekSessions);
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

  // 近 7 天趋势（今天在前）+ 本周累计 + 连续天数（只读统计，不新增表、不改写 life.db）
  const weekDaily = useMemo(() => {
    const days = Array.from({ length: 7 }, (_, i) => {
      const d = new Date();
      d.setDate(d.getDate() - i);
      return toDateStr(d);
    });
    return days.map((date) => ({
      date,
      min: weekSessions.filter((s) => s.date === date && s.completed).reduce((a, s) => a + s.duration, 0),
    }));
  }, [weekSessions]);

  const weekMinutes = weekDaily.reduce((a, d) => a + d.min, 0);
  const maxWeekMin = Math.max(...weekDaily.map((d) => d.min), 1);

  const streakDays = useMemo(() => {
    const done = new Set(weekSessions.filter((s) => s.completed).map((s) => s.date));
    let streak = 0;
    const cursor = new Date();
    if (!done.has(toDateStr(cursor))) cursor.setDate(cursor.getDate() - 1);
    while (done.has(toDateStr(cursor)) && streak < 7) {
      streak += 1;
      cursor.setDate(cursor.getDate() - 1);
    }
    return streak;
  }, [weekSessions]);

  const statCards = [
    { icon: Clock, color: "#8B5CF6", label: "本次", value: `${minutes}`, unit: "分钟", sub: activeStyle.label },
    { icon: Sparkles, color: "#3B82F6", label: "今日累计", value: `${todayMinutes}`, unit: "分钟", sub: `${todayCount} 次` },
    { icon: TrendingUp, color: "#10B981", label: "本周累计", value: `${weekMinutes}`, unit: "分钟", sub: "近 7 天" },
    { icon: Flame, color: "#F97316", label: "连续坚持", value: `${streakDays}`, unit: "天", sub: "连续冥想" },
  ];

  return (
    <div className="mx-auto px-4 pt-4 pb-[100px] flex flex-col items-center" style={{ maxWidth: 430 }}>
      <style>{BAR_KEYFRAMES}</style>

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

      {/* 引导横幅（呼吸引导文案） */}
      <div className="flex w-full items-center gap-2.5 rounded-[16px] px-4 py-3" style={{ background: "linear-gradient(135deg, rgba(139,92,246,0.12), rgba(59,130,246,0.10))", border: "1px solid var(--lifeflow-border)" }}>
        <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full" style={{ background: "rgba(139,92,246,0.14)", color: "#8B5CF6" }}>
          <Flower2 className="h-4 w-4" />
        </span>
        <p className="min-w-0 flex-1 text-[13px] leading-relaxed" style={{ color: "var(--color-text-secondary)" }}>
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
                aria-pressed={active}
                className="relative flex items-center gap-2.5 rounded-[16px] px-3.5 py-3 text-left transition-all active:scale-[0.98]"
                style={{
                  background: active ? `${s.color}16` : "var(--color-surface-card)",
                  border: `1.5px solid ${active ? s.color : "var(--lifeflow-border)"}`,
                  boxShadow: "var(--shadow-card)",
                }}
              >
                {active && (
                  <span className="absolute top-2 right-2 flex h-[18px] w-[18px] items-center justify-center rounded-full" style={{ background: s.color, color: "#fff" }}>
                    <Check className="h-3 w-3" strokeWidth={3} />
                  </span>
                )}
                <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full" style={{ background: `${s.color}18`, color: s.color }}>
                  <s.icon className="h-4 w-4" />
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
        <div className="flex gap-2" role="group" aria-label="选择冥想时长">
          {DURATION_OPTIONS.map((d) => (
            <button
              key={d}
              type="button"
              onClick={() => setMinutes(d)}
              aria-pressed={minutes === d}
              className="flex-1 h-[38px] rounded-full text-[13px] font-semibold tabular-nums whitespace-nowrap transition-all active:scale-95"
              style={{
                background: minutes === d ? activeStyle.color : "var(--color-surface-card)",
                color: minutes === d ? "#fff" : "var(--color-text-secondary)",
                border: `1px solid ${minutes === d ? activeStyle.color : "var(--lifeflow-border)"}`,
                boxShadow: "var(--shadow-card)",
              }}
            >
              {d} 分钟
            </button>
          ))}
        </div>
      </section>

      {/* 计时环（大圆 + 进度环） */}
      <section className="w-full p-6 mb-5 flex flex-col items-center" style={{ background: "var(--color-surface-card)", borderRadius: 24, boxShadow: "var(--shadow-card)" }}>
        <div className="relative mb-4" style={{ width: 180, height: 180 }}>
          <svg width="180" height="180" viewBox="0 0 180 180" className="-rotate-90">
            <circle cx="90" cy="90" r="78" fill="none" stroke="var(--lifeflow-muted)" strokeWidth="8" />
            <circle
              cx="90" cy="90" r="78" fill="none"
              stroke={activeStyle.color}
              strokeWidth="8" strokeLinecap="round"
              strokeDasharray={2 * Math.PI * 78}
              strokeDashoffset={2 * Math.PI * 78 * (1 - progress)}
              style={{ transition: "stroke-dashoffset 1s linear" }}
            />
          </svg>
          <div className="absolute inset-0 flex flex-col items-center justify-center">
            <span className="text-[40px] font-bold tabular-nums leading-none" style={{ color: "var(--color-text-primary)" }}>
              {String(min).padStart(2, "0")}:{String(sec).padStart(2, "0")}
            </span>
            <span className="mt-2 text-[12px] font-medium" style={{ color: activeStyle.color }}>
              {activeStyle.label}
            </span>
          </div>
        </div>

        <div className="flex items-center gap-4">
          <button
            type="button"
            onClick={reset}
            className="h-11 w-11 rounded-full flex items-center justify-center active:scale-90 transition-transform"
            style={{ background: "var(--lifeflow-muted)", color: "var(--color-text-secondary)" }}
            aria-label="重置"
          >
            <RotateCcw className="h-5 w-5" />
          </button>
          <button
            type="button"
            onClick={toggle}
            className="h-14 w-14 rounded-full flex items-center justify-center text-white active:scale-90 transition-transform"
            style={{ background: activeStyle.color, boxShadow: `0 4px 16px ${activeStyle.color}44` }}
            aria-label={running ? "暂停" : "开始冥想"}
          >
            {running ? <Pause className="h-6 w-6" /> : <Play className="h-6 w-6 ml-0.5" />}
          </button>
        </div>
      </section>

      {/* 本次 / 累计统计 */}
      <section className="w-full mb-5" aria-label="冥想统计">
        <div className="grid grid-cols-2 gap-2.5">
          {statCards.map((c) => (
            <div key={c.label} className="rounded-[16px] p-3.5" style={{ background: "var(--color-surface-card)", boxShadow: "var(--shadow-card)" }}>
              <div className="mb-2 flex items-center gap-1.5">
                <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-[10px]" style={{ background: `${c.color}24`, color: c.color }}>
                  <c.icon className="h-3.5 w-3.5" />
                </span>
                <span className="text-[11.5px] font-medium" style={{ color: "var(--color-text-secondary)" }}>{c.label}</span>
              </div>
              <p className="text-[20px] font-semibold leading-tight tabular-nums" style={{ color: "var(--color-text-primary)" }}>
                {c.value}
                <span className="text-[12px] font-normal" style={{ color: "var(--color-text-tertiary)" }}> {c.unit}</span>
              </p>
              <p className="mt-1 text-[11px] truncate" style={{ color: "var(--color-text-tertiary)" }}>{c.sub}</p>
            </div>
          ))}
        </div>
      </section>

      {/* 周趋势条（近 7 天冥想分钟） */}
      <section className="w-full p-4 mb-5" style={{ background: "var(--color-surface-card)", boxShadow: "var(--shadow-card)" }} aria-label="本周冥想趋势">
        <div className="mb-3 flex items-center justify-between gap-2">
          <p className="text-[13px] font-semibold" style={{ color: "var(--color-text-primary)" }}>本周冥想趋势</p>
          <span className="text-[11px] tabular-nums" style={{ color: "var(--color-text-tertiary)" }}>{weekMinutes} 分钟 / 7 天</span>
        </div>
        <div className="flex items-end gap-1.5" style={{ height: 100 }}>
          {weekDaily.map((d, i) => (
            <div key={d.date} className="flex min-w-0 flex-1 flex-col items-center gap-1.5">
              <span className="text-[10px] leading-none tabular-nums" style={{ color: d.min > 0 ? "#8B5CF6" : "var(--color-text-disabled)" }}>
                {d.min > 0 ? `${d.min}m` : ""}
              </span>
              <div
                className="lf-bar-anim w-full"
                style={{
                  height: `${Math.max(6, (d.min / maxWeekMin) * 70)}px`,
                  borderRadius: "6px 6px 0 0",
                  background: d.min > 0 ? "linear-gradient(180deg,#8B5CF6,rgba(139,92,246,0.25))" : "var(--lifeflow-muted)",
                  animationDelay: `${0.05 + i * 0.05}s`,
                }}
              />
              <span className="text-[10px] leading-none tabular-nums" style={{ color: "var(--color-text-tertiary)" }}>
                {i === 0 ? "今天" : `${Number(d.date.slice(8))}日`}
              </span>
            </div>
          ))}
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
          <div className="flex flex-col overflow-hidden rounded-[16px]" style={{ background: "var(--color-surface-card)", boxShadow: "var(--shadow-card)" }}>
            {sessions.map((s, i) => {
              const meta = STYLE_OPTIONS.find((x) => x.key === s.style)!;
              const t = new Date(s.startedAt);
              const hm = `${String(t.getHours()).padStart(2, "0")}:${String(t.getMinutes()).padStart(2, "0")}`;
              return (
                <div key={s.id} className="flex items-center gap-3 px-4 py-2.5" style={{ borderTop: i > 0 ? "0.5px solid var(--lifeflow-border)" : "none" }}>
                  <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full" style={{ background: `${meta.color}18`, color: meta.color }}>
                    <meta.icon className="h-3.5 w-3.5" />
                  </span>
                  <div className="min-w-0 flex-1">
                    <span className="block truncate text-[13.5px] font-medium" style={{ color: "var(--color-text-primary)" }}>{meta.label}</span>
                    <span className="block text-[11px] tabular-nums" style={{ color: "var(--color-text-secondary)" }}>{s.duration} 分钟 · {hm}</span>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </section>
    </div>
  );
}
