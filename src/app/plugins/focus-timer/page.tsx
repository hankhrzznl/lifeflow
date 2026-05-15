"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { useSearchParams } from "next/navigation";
import { motion } from "framer-motion";
import { Play, Pause, RotateCcw, CheckCircle, ArrowLeft, Zap } from "lucide-react";
import Link from "next/link";
import { getPluginMeta } from "@/lib/db";

export default function FocusTimerPluginPage() {
  const searchParams = useSearchParams();
  const taskId = searchParams.get("taskId");
  const [active, setActive] = useState(false);
  const [seconds, setSeconds] = useState(25 * 60);
  const [isRunning, setIsRunning] = useState(false);
  const [taskTitle, setTaskTitle] = useState("专注");
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    getPluginMeta("focus-timer").then((p) => setActive(p?.status === "active"));
    if (taskId) {
      import("@/lib/db").then(({ getTask }) => {
        getTask(parseInt(taskId)).then((t) => {
          if (t) setTaskTitle(t.title);
        });
      });
    }
  }, [taskId]);

  const startTimer = useCallback(() => {
    setIsRunning(true);
    intervalRef.current = setInterval(() => {
      setSeconds((s) => {
        if (s <= 1) {
          setIsRunning(false);
          return 0;
        }
        return s - 1;
      });
    }, 1000);
  }, []);

  const pauseTimer = useCallback(() => {
    setIsRunning(false);
    if (intervalRef.current) clearInterval(intervalRef.current);
  }, []);

  const resetTimer = useCallback(() => {
    pauseTimer();
    setSeconds(25 * 60);
  }, [pauseTimer]);

  useEffect(() => {
    return () => { if (intervalRef.current) clearInterval(intervalRef.current); };
  }, []);

  const minutes = Math.floor(seconds / 60);
  const secs = seconds % 60;
  const progress = 1 - seconds / (25 * 60);

  if (!active) {
    return (
      <div className="flex flex-col items-center justify-center py-20 px-4 text-center">
        <Zap className="w-12 h-12 text-gray-400 mb-4" />
        <h2 className="text-lg font-semibold text-gray-700">专注计时器插件未启用</h2>
        <p className="text-sm text-gray-500 mt-1 mb-6">请在插件管理中启用此插件</p>
        <Link href="/plugins" className="text-indigo-600 text-sm font-medium">前往插件管理</Link>
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center justify-center h-full max-w-4xl mx-auto px-4 py-6">
      <div className="w-full flex items-center justify-between mb-8">
        <Link href="/plugins" className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-gray-100">
          <ArrowLeft className="w-5 h-5 text-gray-500" />
        </Link>
        <h1 className="text-lg font-semibold text-gray-900">专注计时器</h1>
        <div className="w-8" />
      </div>

      <p className="text-sm text-gray-500 mb-6">{taskTitle}</p>

      <div className="relative w-48 h-48 mb-8">
        <svg className="w-full h-full -rotate-90" viewBox="0 0 100 100">
          <circle cx="50" cy="50" r="45" fill="none" stroke="#E5E7EB" strokeWidth="6" />
          <circle
            cx="50" cy="50" r="45" fill="none" stroke="#6366F1" strokeWidth="6"
            strokeDasharray={`${progress * 283} 283`} strokeLinecap="round"
          />
        </svg>
        <div className="absolute inset-0 flex items-center justify-center">
          <span className="text-3xl font-bold text-gray-900 tabular-nums">
            {String(minutes).padStart(2, "0")}:{String(secs).padStart(2, "0")}
          </span>
        </div>
      </div>

      <div className="flex items-center gap-4">
        {isRunning ? (
          <button onClick={pauseTimer} className="w-14 h-14 rounded-full bg-amber-500 text-white flex items-center justify-center shadow-lg">
            <Pause className="w-6 h-6" />
          </button>
        ) : (
          <button onClick={startTimer} disabled={seconds === 0} className="w-14 h-14 rounded-full bg-indigo-600 text-white flex items-center justify-center shadow-lg disabled:opacity-40">
            <Play className="w-6 h-6" />
          </button>
        )}
        <button onClick={resetTimer} className="w-10 h-10 rounded-full bg-gray-100 flex items-center justify-center">
          <RotateCcw className="w-4 h-4 text-gray-500" />
        </button>
      </div>

      {seconds === 0 && (
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="mt-8 text-center">
          <CheckCircle className="w-10 h-10 text-emerald-500 mx-auto mb-2" />
          <p className="text-lg font-semibold text-gray-900">专注完成！</p>
        </motion.div>
      )}
    </div>
  );
}
