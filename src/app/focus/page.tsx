"use client";

import { useState, useEffect, useRef, useCallback, Suspense } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useSearchParams } from "next/navigation";
import { ArrowLeft, Play, Pause, Square, XCircle, Zap, Bell } from "lucide-react";
import Link from "next/link";
import { createFocusLog, updateFocusLog, getTasksByTimeRange } from "@/lib/db";
import { getTodayRange } from "@/lib/planner-utils";

const DURATION_PRESETS = [15, 25, 30, 45, 60];
const RADIUS = 120;
const STROKE = 8;
const CIRCUMFERENCE = 2 * Math.PI * RADIUS;

type TimerState = "idle" | "running" | "paused" | "completed";

const PARTICLE_CONFIG = {
  count: 80,
  colors: ["#BF5AF2", "#5856D6", "#32ADE6", "#FFD60A", "#FF9F0A", "#FFFFFF"],
  gravity: 0.15,
  friction: 0.98,
  initialVelocity: { min: 3, max: 12 },
  particleSize: { min: 2, max: 6 },
  decay: 0.015,
  duration: 2500,
  originY: 0.3,
};

interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  size: number;
  color: string;
  opacity: number;
  shape: "circle" | "star";
  rotation: number;
  rotationSpeed: number;
}

function calculateFocusQuality(
  plannedMin: number,
  actualMin: number,
  interruptions: number
): "perfect" | "great" | "good" | "interrupted" {
  const rate = actualMin / plannedMin;
  if (rate >= 0.95 && interruptions === 0) return "perfect";
  if (rate >= 0.8 && interruptions <= 1) return "great";
  if (rate >= 0.5) return "good";
  return "interrupted";
}

const QUALITY_LABELS: Record<
  string,
  { label: string; emoji: string; colorClass: string }
> = {
  perfect: { label: "完美专注", emoji: "🔥", colorClass: "text-amber-400" },
  great: { label: "非常出色", emoji: "✨", colorClass: "text-indigo-400" },
  good: { label: "完成目标", emoji: "👍", colorClass: "text-emerald-400" },
  interrupted: { label: "有中断", emoji: "💪", colorClass: "text-orange-400" },
};

function FocusPageInner() {
  const searchParams = useSearchParams();
  const eventParam = searchParams.get("event");

  const [timerState, setTimerState] = useState<TimerState>("idle");
  const [totalSeconds, setTotalSeconds] = useState(25 * 60);
  const [remainingSeconds, setRemainingSeconds] = useState(25 * 60);
  const [progress, setProgress] = useState(1);
  const [interruptions, setInterruptions] = useState(0);
  const [quality, setQuality] = useState<
    "perfect" | "great" | "good" | "interrupted" | null
  >(null);
  const [taskTitle, setTaskTitle] = useState("专注");
  const [plannedMinutes, setPlannedMinutes] = useState(25);
  const [showQuality, setShowQuality] = useState(false);
  const [showGiveUpConfirm, setShowGiveUpConfirm] = useState(false);
  const [showEarlyFinishConfirm, setShowEarlyFinishConfirm] = useState(false);
  const [longPauseWarning, setLongPauseWarning] = useState(false);
  const [particles, setParticles] = useState<Particle[]>([]);
  const [showNotificationPrompt, setShowNotificationPrompt] = useState(false);

  const focusLogIdRef = useRef<number | null>(null);
  const workerRef = useRef<Worker | null>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const animFrameRef = useRef<number>(0);
  const hasCompletedRef = useRef(false);
  const startTimeRef = useRef(0);
  const completedRef = useRef(false);
  const handleCompleteRef = useRef<(() => Promise<void>) | null>(null);
  const triggerParticlesRef = useRef<(() => void) | null>(null);
  const longPauseTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const initWorker = useCallback(() => {
    if (!workerRef.current) {
      try {
        workerRef.current = new Worker(
          new URL("@/lib/focus-timer.worker.ts", import.meta.url)
        );
        workerRef.current.onmessage = (e: MessageEvent) => {
          const { type, remaining } = e.data;
          if (type === "TICK") {
            setRemainingSeconds(Math.round(remaining));
            setProgress(remaining / totalSeconds);
          } else if (type === "COMPLETE") {
            handleCompleteRef.current?.();
          }
        };
      } catch {
        // Web Worker not available, fallback handled at usage site
      }
    }
    return workerRef.current;
  }, [totalSeconds]);

  const clearLongPauseTimer = useCallback(() => {
    if (longPauseTimerRef.current) {
      clearTimeout(longPauseTimerRef.current);
      longPauseTimerRef.current = null;
    }
  }, []);

  useEffect(() => {
    if (timerState === "paused") {
      longPauseTimerRef.current = setTimeout(() => {
        setLongPauseWarning(true);
      }, 30 * 60 * 1000);
    } else {
      queueMicrotask(() => setLongPauseWarning(false));
      clearLongPauseTimer();
    }
    return clearLongPauseTimer;
  }, [timerState, clearLongPauseTimer]);

  useEffect(() => {
    initWorker();
    return () => {
      if (workerRef.current) {
        workerRef.current.terminate();
        workerRef.current = null;
      }
    };
  }, [initWorker]);

  useEffect(() => {
    if (canvasRef.current && particles.length > 0) {
      const canvas = canvasRef.current;
      const ctx = canvas.getContext("2d");
      if (!ctx) return;

      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight;

      let localParticles = [...particles];
      const startTime = performance.now();

      const animate = (now: number) => {
        const elapsed = now - startTime;
        if (elapsed > PARTICLE_CONFIG.duration) {
          setParticles([]);
          return;
        }

        ctx.clearRect(0, 0, canvas.width, canvas.height);

        localParticles = localParticles.map((p) => ({
          ...p,
          x: p.x + p.vx,
          y: p.y + p.vy,
          vy: (p.vy + PARTICLE_CONFIG.gravity) * PARTICLE_CONFIG.friction,
          vx: p.vx * PARTICLE_CONFIG.friction,
          opacity: Math.max(0, p.opacity - PARTICLE_CONFIG.decay),
          rotation: p.rotation + p.rotationSpeed,
        }));

        for (const p of localParticles) {
          ctx.save();
          ctx.globalAlpha = p.opacity;
          ctx.translate(p.x, p.y);
          ctx.rotate((p.rotation * Math.PI) / 180);
          ctx.fillStyle = p.color;
          ctx.beginPath();

          if (p.shape === "star") {
            const spikes = 5;
            const outerRadius = p.size;
            const innerRadius = p.size * 0.4;
            for (let i = 0; i < spikes * 2; i++) {
              const radius = i % 2 === 0 ? outerRadius : innerRadius;
              const angle = (i * Math.PI) / spikes - Math.PI / 2;
              const x = Math.cos(angle) * radius;
              const y = Math.sin(angle) * radius;
              if (i === 0) ctx.moveTo(x, y);
              else ctx.lineTo(x, y);
            }
            ctx.closePath();
          } else {
            ctx.arc(0, 0, p.size, 0, Math.PI * 2);
          }

          ctx.fill();
          ctx.restore();
        }

        animFrameRef.current = requestAnimationFrame(animate);
      };

      animFrameRef.current = requestAnimationFrame(animate);

      return () => {
        cancelAnimationFrame(animFrameRef.current);
      };
    }
  }, [particles]);

  useEffect(() => {
    const stored = sessionStorage.getItem("focus_recovery");
    if (stored && timerState === "idle") {
      try {
        const recovery = JSON.parse(stored);
        if (recovery.state === "running" || recovery.state === "paused") {
          const userWantsRecovery = window.confirm(
            "检测到未完成的专注时段，是否恢复？"
          );
          if (userWantsRecovery) {
            focusLogIdRef.current = recovery.logId;
            startTimeRef.current = recovery.startTime;
            // eslint-disable-next-line react-hooks/set-state-in-effect
            setTotalSeconds(recovery.totalSeconds);
            setRemainingSeconds(recovery.remainingSeconds);
            setInterruptions(recovery.interruptions);
            setPlannedMinutes(Math.round(recovery.totalSeconds / 60));
            setTimerState(recovery.state);
            if (recovery.state === "running") {
              const worker = initWorker();
              worker?.postMessage({
                type: "RESUME",
                payload: {
                  totalSeconds: recovery.totalSeconds,
                  elapsedSeconds: recovery.totalSeconds - recovery.remainingSeconds,
                },
              });
            }
          }
        }
      } catch {
        sessionStorage.removeItem("focus_recovery");
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (timerState === "running" || timerState === "paused") {
      sessionStorage.setItem(
        "focus_recovery",
        JSON.stringify({
          logId: focusLogIdRef.current,
          startTime: startTimeRef.current,
          totalSeconds,
          remainingSeconds,
          interruptions,
          state: timerState,
        })
      );
    } else {
      sessionStorage.removeItem("focus_recovery");
    }
  }, [timerState, totalSeconds, remainingSeconds, interruptions]);

  useEffect(() => {
    const handleBeforeUnload = () => {
      if (timerState === "running" || timerState === "paused") {
        sessionStorage.setItem(
          "focus_recovery",
          JSON.stringify({
            logId: focusLogIdRef.current,
            startTime: startTimeRef.current,
            totalSeconds,
            remainingSeconds,
            interruptions,
            state: timerState,
          })
        );
      }
    };
    window.addEventListener("beforeunload", handleBeforeUnload);
    return () => window.removeEventListener("beforeunload", handleBeforeUnload);
  }, [timerState, totalSeconds, remainingSeconds, interruptions]);

  useEffect(() => {
    const handleVisibilityChange = () => {
      if (
        document.visibilityState === "visible" &&
        timerState === "running" &&
        workerRef.current
      ) {
        workerRef.current.postMessage({ type: "GET_STATUS" });
      }
    };
    document.addEventListener("visibilitychange", handleVisibilityChange);
    return () =>
      document.removeEventListener("visibilitychange", handleVisibilityChange);
  }, [timerState]);

  useEffect(() => {
    if (eventParam) {
      const loadEvent = async () => {
        const { start, end } = getTodayRange();
        const tasks = await getTasksByTimeRange(start, end);
        const found = tasks.find(
          (t) => t.id?.toString() === eventParam
        );
        if (found && found.startTime != null && found.endTime != null) {
          setTaskTitle(found.title);
          const duration =
            (found.endTime - found.startTime) / (1000 * 60);
          const preset = DURATION_PRESETS.find((p) => Math.abs(p - duration) <= 5);
          const mins = preset ?? Math.round(duration);
          setPlannedMinutes(mins);
          setTotalSeconds(mins * 60);
          setRemainingSeconds(mins * 60);
        } else if (found) {
          setTaskTitle(found.title);
        }
      };
      loadEvent();
    }
  }, [eventParam]);

  const completeTimer = useCallback(
    async (isGivingUp: boolean) => {
      if (completedRef.current) return;
      completedRef.current = true;

      workerRef.current?.postMessage({ type: "STOP" });
      setTimerState("completed");

      const actualSeconds =
        (Date.now() - startTimeRef.current) / 1000;
      const actualMinutes = Math.round(actualSeconds / 60);
      const q = calculateFocusQuality(
        plannedMinutes,
        actualMinutes,
        interruptions
      );
      setQuality(q);

      if (focusLogIdRef.current != null) {
        let retries = 3;
        while (retries > 0) {
          try {
            await updateFocusLog(focusLogIdRef.current, {
              completed: !isGivingUp,
              duration: Math.round(actualSeconds),
            });
            break;
          } catch {
            retries--;
            if (retries > 0) {
              await new Promise((r) => setTimeout(r, 500));
            }
          }
        }
      }

      if (!isGivingUp && q !== "interrupted") {
        triggerParticlesRef.current?.();
      }

      sessionStorage.removeItem("focus_recovery");

      try {
        if (
          "Notification" in window &&
          !isGivingUp &&
          q !== "interrupted"
        ) {
          const showViaServiceWorker = async () => {
            const title = "🎯 专注完成！";
            const body = `完成了 ${actualMinutes} 分钟专注`;
            const tag = "focus-complete";

            if (navigator.serviceWorker?.controller) {
              const reg = await navigator.serviceWorker.ready;
              reg.showNotification(title, {
                body,
                icon: "/icons/icon.svg",
                badge: "/icons/icon.svg",
                tag,
                requireInteraction: true,
                actions: [
                  { action: "open", title: "查看" },
                  { action: "dismiss", title: "忽略" },
                ],
              } as unknown as NotificationOptions);
              return;
            }
            if (Notification.permission === "granted") {
              new Notification(title, { body, tag });
            }
          };

          if (Notification.permission === "granted") {
            showViaServiceWorker();
          } else if (Notification.permission === "default") {
            const perm = await Notification.requestPermission();
            if (perm === "granted") {
              showViaServiceWorker();
            }
          }
        }
      } catch {
        // notifications not supported
      }

      setShowQuality(true);
    },
    [plannedMinutes, interruptions]
  );

  const handleComplete = useCallback(async () => {
    if (hasCompletedRef.current) return;
    hasCompletedRef.current = true;
    await completeTimer(false);
  }, [completeTimer]);

  function triggerParticles() {
    const particles: Particle[] = [];
    const centerX = window.innerWidth / 2;
    const originY = window.innerHeight * PARTICLE_CONFIG.originY;

    for (let i = 0; i < PARTICLE_CONFIG.count; i++) {
      const angle = (Math.PI * 2 * i) / PARTICLE_CONFIG.count + (Math.random() - 0.5) * 0.5;
      const speed =
        PARTICLE_CONFIG.initialVelocity.min +
        Math.random() *
          (PARTICLE_CONFIG.initialVelocity.max -
            PARTICLE_CONFIG.initialVelocity.min);
      particles.push({
        x: centerX,
        y: originY,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed * 0.3 - Math.random() * 6,
        size:
          PARTICLE_CONFIG.particleSize.min +
          Math.random() *
            (PARTICLE_CONFIG.particleSize.max -
              PARTICLE_CONFIG.particleSize.min),
        color:
          PARTICLE_CONFIG.colors[
            Math.floor(Math.random() * PARTICLE_CONFIG.colors.length)
          ],
        opacity: 1,
        shape: Math.random() > 0.5 ? "circle" : "star",
        rotation: Math.random() * 360,
        rotationSpeed: (Math.random() - 0.5) * 10,
      });
    }
    setParticles(particles);
  }

  useEffect(() => {
    handleCompleteRef.current = handleComplete;
    triggerParticlesRef.current = triggerParticles;
  });

  function handleStart() {
    if (
      typeof Notification !== "undefined" &&
      Notification.permission === "default"
    ) {
      setShowNotificationPrompt(true);
      return;
    }
    doStart();
  }

  async function handleAllowNotification() {
    setShowNotificationPrompt(false);
    try {
      const perm = await Notification.requestPermission();
      if (perm === "granted" && "serviceWorker" in navigator) {
        navigator.serviceWorker.ready.then((reg) => {
          reg.showNotification("🔔 通知已开启", {
            body: "专注完成时，我会在这里提醒你",
            icon: "/icons/icon.svg",
            tag: "notif-enabled",
          });
        });
      }
    } catch {
      // permission request failed silently
    }
    doStart();
  }

  function handleSkipNotification() {
    setShowNotificationPrompt(false);
    doStart();
  }

  function doStart() {
    hasCompletedRef.current = false;
    completedRef.current = false;
    startTimeRef.current = Date.now();
    setInterruptions(0);
    setQuality(null);
    setShowQuality(false);
    setTimerState("running");

    const worker = initWorker();
    worker?.postMessage({
      type: "START",
      payload: { totalSeconds },
    });

    createFocusLog(eventParam ? parseInt(eventParam) : undefined).then((id) => {
      focusLogIdRef.current = id as number;
    });
  }

  function handlePause() {
    workerRef.current?.postMessage({ type: "PAUSE" });
    setTimerState("paused");
    setInterruptions((i) => i + 1);
  }

  function handleResume() {
    workerRef.current?.postMessage({ type: "RESUME" });
    setTimerState("running");
  }

  function handleGiveUp() {
    setShowGiveUpConfirm(true);
  }

  function confirmGiveUp() {
    setShowGiveUpConfirm(false);
    completeTimer(true);
  }

  return (
    <div className="relative min-h-screen bg-slate-950 text-white overflow-hidden">
      <canvas
        ref={canvasRef}
        className="absolute inset-0 pointer-events-none z-50"
      />

      <div className="relative flex flex-col min-h-screen">
        <header className="flex items-center justify-between px-4 py-4">
          <Link
            href="/"
            className="w-12 h-12 flex items-center justify-center rounded-xl bg-white/10 hover:bg-white/15 transition-colors"
          >
            <ArrowLeft className="w-5 h-5 text-white" />
          </Link>
          <h1 className="text-lg font-semibold">{taskTitle}</h1>
          <div className="w-12" />
        </header>

        <AnimatePresence mode="wait">
          {timerState === "idle" && (
            <motion.div
              key="idle"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              className="flex-1 flex flex-col items-center justify-center px-6 gap-10"
            >
              <div className="text-center">
                <Zap className="w-12 h-12 text-indigo-400 mx-auto mb-4" />
                <p className="text-white/40 text-base">
                  选择一个专注时长开始吧
                </p>
              </div>

              <div className="flex flex-wrap justify-center gap-3">
                {DURATION_PRESETS.map((mins) => (
                  <button
                    key={mins}
                    onClick={() => {
                      setPlannedMinutes(mins);
                      setTotalSeconds(mins * 60);
                      setRemainingSeconds(mins * 60);
                      setProgress(1);
                    }}
                    className={`w-16 h-16 rounded-full flex items-center justify-center text-sm font-medium transition-all ${
                      plannedMinutes === mins
                        ? "bg-indigo-500 text-white shadow-lg shadow-indigo-500/30 scale-110"
                        : "bg-white/10 text-white/60 hover:bg-white/20 hover:text-white/80"
                    }`}
                  >
                    {mins}min
                  </button>
                ))}
              </div>

              <div className="w-full max-w-xs">
                <input
                  type="text"
                  value={taskTitle === "专注" ? "" : taskTitle}
                  onChange={(e) => setTaskTitle(e.target.value || "专注")}
                  placeholder="今天要专注什么？"
                  className="w-full bg-white/10 border border-white/20 rounded-xl px-4 py-3 text-center text-white placeholder:text-white/30 outline-none focus:border-indigo-400/50 focus:bg-white/15 transition-all"
                />
              </div>

              <button
                onClick={handleStart}
                className="w-full max-w-64 py-4 rounded-2xl bg-gradient-to-r from-indigo-500 to-violet-500 text-white text-lg font-semibold shadow-lg shadow-indigo-500/30 hover:shadow-indigo-500/40 transition-all active:scale-95"
              >
                开始专注
              </button>
            </motion.div>
          )}

          {(timerState === "running" || timerState === "paused") && (
            <motion.div
              key="running"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="flex-1 flex flex-col items-center justify-center gap-8 px-6"
            >
              <div className="relative">
                <svg
                  width={RADIUS * 2 + STROKE * 2}
                  height={RADIUS * 2 + STROKE * 2}
                  className="-rotate-90"
                  viewBox={`0 0 ${RADIUS * 2 + STROKE * 2} ${
                    RADIUS * 2 + STROKE * 2
                  }`}
                >
                  <defs>
                    <linearGradient id="progressGradient" x1="0%" y1="0%" x2="100%" y2="0%">
                      <stop offset="0%" stopColor="#6366f1" />
                      <stop offset="100%" stopColor="#8b5cf6" />
                    </linearGradient>
                  </defs>
                  <circle
                    cx={RADIUS + STROKE}
                    cy={RADIUS + STROKE}
                    r={RADIUS}
                    fill="none"
                    stroke="rgba(255,255,255,0.08)"
                    strokeWidth={STROKE}
                    strokeLinecap="round"
                  />
                  <motion.circle
                    cx={RADIUS + STROKE}
                    cy={RADIUS + STROKE}
                    r={RADIUS}
                    fill="none"
                    stroke="url(#progressGradient)"
                    strokeWidth={STROKE}
                    strokeLinecap="round"
                    strokeDasharray={CIRCUMFERENCE}
                    animate={{
                      strokeDashoffset: CIRCUMFERENCE * (1 - progress),
                    }}
                    transition={{ duration: 0.3 }}
                  />
                </svg>

                <div className="absolute inset-0 flex items-center justify-center">
                  <span className="font-mono text-6xl md:text-7xl font-extralight tabular-nums tracking-tight">
                    {String(Math.floor(remainingSeconds / 60)).padStart(2, "0")}
                    <span className="text-white/20">:</span>
                    {String(remainingSeconds % 60).padStart(2, "0")}
                  </span>
                </div>
              </div>

              <p className="text-white/40 text-lg">{taskTitle}</p>

              {timerState === "paused" && (
                <div className="flex flex-col items-center gap-2">
                  <div className="px-4 py-1.5 rounded-full bg-white/10 backdrop-blur-sm">
                    <span className="text-white/60 text-sm">已暂停</span>
                  </div>
                  {longPauseWarning && (
                    <p className="text-amber-400/80 text-xs">
                      已暂停较长时间，建议继续或结束本轮专注
                    </p>
                  )}
                </div>
              )}

              <div className="flex items-center gap-4">
                <button
                  onClick={handleGiveUp}
                  className="w-12 h-12 rounded-full bg-white/10 flex items-center justify-center hover:bg-white/20 transition-colors"
                >
                  <XCircle className="w-5 h-5 text-white/50" />
                </button>

                {timerState === "running" ? (
                  <button
                    onClick={handlePause}
                    className="w-16 h-16 rounded-full bg-white flex items-center justify-center hover:bg-white/90 transition-colors shadow-lg"
                  >
                    <Pause className="w-6 h-6 text-slate-900" />
                  </button>
                ) : (
                  <button
                    onClick={handleResume}
                    className="w-16 h-16 rounded-full bg-white flex items-center justify-center hover:bg-white/90 transition-colors shadow-lg"
                  >
                    <Play className="w-6 h-6 text-slate-900 ml-0.5" />
                  </button>
                )}

                <button
                  onClick={() => setShowEarlyFinishConfirm(true)}
                  className="w-12 h-12 rounded-full bg-white/10 flex items-center justify-center hover:bg-white/20 transition-colors"
                >
                  <Square className="w-5 h-5 text-white/50" />
                </button>
              </div>

              {interruptions > 0 && (
                <p className="text-white/30 text-xs">
                  已中断 {interruptions} 次
                </p>
              )}
            </motion.div>
          )}

          {timerState === "completed" && showQuality && quality && (
            <motion.div
              key="completed"
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ type: "spring", stiffness: 400, damping: 25 }}
              className="flex-1 flex flex-col items-center justify-center px-6 gap-6"
            >
              <motion.div
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                transition={{
                  type: "spring",
                  stiffness: 300,
                  damping: 20,
                  delay: 0.2,
                }}
                className="text-6xl"
              >
                {QUALITY_LABELS[quality].emoji}
              </motion.div>

              <h2
                className={`text-3xl font-bold ${QUALITY_LABELS[quality].colorClass}`}
              >
                {QUALITY_LABELS[quality].label}
              </h2>

              <div className="grid grid-cols-2 gap-4 w-full max-w-xs">
                <div className="bg-white/5 rounded-2xl p-4 text-center">
                  <p className="text-2xl font-semibold text-white">
                    {plannedMinutes}
                  </p>
                  <p className="text-xs text-white/40 mt-1">目标分钟</p>
                </div>
                <div className="bg-white/5 rounded-2xl p-4 text-center">
                  <p className="text-2xl font-semibold text-white">
                    {interruptions}
                  </p>
                  <p className="text-xs text-white/40 mt-1">中断次数</p>
                </div>
              </div>

              <Link
                href="/"
                className="w-56 py-3.5 rounded-xl bg-white/10 hover:bg-white/15 text-white text-base font-medium transition-colors text-center"
              >
                返回首页
              </Link>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      <AnimatePresence>
        {showEarlyFinishConfirm && (() => {
          const elapsedMin = Math.round(
            (totalSeconds - remainingSeconds) / 60
          );
          const completionRate = plannedMinutes > 0
            ? elapsedMin / plannedMinutes
            : 0;
          const isTooShort = elapsedMin < 5;
          const isNearComplete = completionRate >= 0.8;

          return (
            <motion.div
              className="absolute inset-0 flex items-center justify-center bg-black/60 backdrop-blur-sm z-40 px-6"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
            >
              <motion.div
                className="bg-slate-800 rounded-2xl p-6 w-full max-w-sm shadow-2xl"
                initial={{ scale: 0.9, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                exit={{ scale: 0.9, opacity: 0 }}
              >
                <h3 className="text-lg font-semibold text-white mb-2">
                  {isNearComplete ? "即将完成，确认结束？" : "提前完成？"}
                </h3>
                <p className="text-sm text-white/50 mb-1">
                  已专注 {elapsedMin} 分钟
                  {isNearComplete && (
                    <span className="text-indigo-400">
                      {" "}（已完成 {Math.round(completionRate * 100)}%）
                    </span>
                  )}
                </p>
                {isTooShort && (
                  <p className="text-sm text-amber-400/80 mb-4">
                    专注时间较短，确定要结束吗？
                  </p>
                )}
                {!isTooShort && <div className="mb-5" />}
                <div className="flex gap-3">
                  <button
                    onClick={() => setShowEarlyFinishConfirm(false)}
                    className="flex-1 py-2.5 rounded-xl bg-white/10 text-white text-sm font-medium hover:bg-white/15 transition-colors"
                  >
                    继续专注
                  </button>
                  <button
                    onClick={() => {
                      setShowEarlyFinishConfirm(false);
                      completeTimer(false);
                    }}
                    className="flex-1 py-2.5 rounded-xl bg-indigo-500 text-white text-sm font-medium hover:bg-indigo-600 transition-colors"
                  >
                    确认完成
                  </button>
                </div>
              </motion.div>
            </motion.div>
          );
        })()}

        {showNotificationPrompt && (
          <motion.div
            className="absolute inset-0 flex items-center justify-center bg-black/60 backdrop-blur-sm z-40 px-6"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          >
            <motion.div
              className="bg-slate-800 rounded-2xl p-6 w-full max-w-sm shadow-2xl"
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
            >
              <div className="flex flex-col items-center text-center mb-4">
                <div className="w-14 h-14 rounded-full bg-indigo-500/20 flex items-center justify-center mb-3">
                  <Bell className="w-7 h-7 text-indigo-400" />
                </div>
                <h3 className="text-lg font-semibold text-white mb-1">
                  开启通知提醒？
                </h3>
                <p className="text-sm text-white/50">
                  专注结束时，我们会在通知栏提醒你。
                  不会发送任何其他打扰。
                </p>
              </div>
              <div className="flex gap-3">
                <button
                  onClick={handleSkipNotification}
                  className="flex-1 py-2.5 rounded-xl bg-white/10 text-white text-sm font-medium hover:bg-white/15 transition-colors"
                >
                  跳过
                </button>
                <button
                  onClick={handleAllowNotification}
                  className="flex-1 py-2.5 rounded-xl bg-indigo-500 text-white text-sm font-medium hover:bg-indigo-600 transition-colors"
                >
                  允许通知
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}

        {showGiveUpConfirm && (
          <motion.div
            className="absolute inset-0 flex items-center justify-center bg-black/60 backdrop-blur-sm z-40 px-6"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          >
            <motion.div
              className="bg-slate-800 rounded-2xl p-6 w-full max-w-sm shadow-2xl"
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
            >
              <h3 className="text-lg font-semibold text-white mb-2">
                确定放弃？
              </h3>
              <p className="text-sm text-white/50 mb-1">
                这次专注将记为中断，不会计入统计
              </p>
              <p className="text-sm text-white/50 mb-6">
                没关系，下次会更好的 ✨
              </p>
              <div className="flex gap-3">
                <button
                  onClick={() => setShowGiveUpConfirm(false)}
                  className="flex-1 py-2.5 rounded-xl bg-white/10 text-white text-sm font-medium hover:bg-white/15 transition-colors"
                >
                  返回继续
                </button>
                <button
                  onClick={confirmGiveUp}
                  className="flex-1 py-2.5 rounded-xl bg-rose-600 text-white text-sm font-medium hover:bg-rose-700 transition-colors"
                >
                  确认放弃
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

export default function FocusPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-slate-950 flex items-center justify-center">
          <div className="w-8 h-8 border-2 border-indigo-400 border-t-transparent rounded-full animate-spin" />
        </div>
      }
    >
      <FocusPageInner />
    </Suspense>
  );
}
