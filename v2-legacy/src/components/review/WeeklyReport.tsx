"use client";

import { useState, useCallback, useRef, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Sparkles, AlertCircle, RefreshCw } from "lucide-react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

interface WeeklyReportProps {
  period: { start: string; end: string; type: "week" | "month" };
  stats: {
    totalMinutes: number;
    totalSessions: number;
    completedSessions: number;
    averageSessionMinutes: number;
    completionRate: number;
    bestDay: { date: string; minutes: number } | null;
    dailyBreakdown: { date: string; minutes: number; sessions: number }[];
    hourlyPeak: { hour: number; minutes: number } | null;
  };
  hasData: boolean;
}

type ReportState = "idle" | "loading" | "streaming" | "done" | "error";

const LOADING_TEXTS = ["分析数据中...", "生成洞察...", "整理建议..."];

export default function WeeklyReport({
  period,
  stats,
  hasData,
}: WeeklyReportProps) {
  const [reportState, setReportState] = useState<ReportState>("idle");
  const [content, setContent] = useState("");
  const [loadingTextIdx, setLoadingTextIdx] = useState(0);
  const [retryCount, setRetryCount] = useState(0);
  const [errorMessage, setErrorMessage] = useState("");
  const abortRef = useRef<AbortController | null>(null);

  useEffect(() => {
    if (reportState !== "loading") return;

    const timer = setInterval(() => {
      setLoadingTextIdx((prev) => (prev + 1) % LOADING_TEXTS.length);
    }, 2000);

    return () => clearInterval(timer);
  }, [reportState]);

  const generateReport = useCallback(async () => {
    setErrorMessage("");
    setContent("");
    setReportState("loading");
    setRetryCount((prev) => prev + 1);

    const controller = new AbortController();
    abortRef.current = controller;

    const timeoutId = setTimeout(() => {
      controller.abort();
    }, 30000);

    try {
      const response = await fetch("/api/weekly-report", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ period, stats }),
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        throw new Error(`请求失败 (${response.status})`);
      }

      if (!response.body) {
        throw new Error("NO_STREAM");
      }

      setReportState("streaming");

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let result = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        result += decoder.decode(value, { stream: true });
        setContent(result);
      }

      setReportState("done");
    } catch (err: unknown) {
      clearTimeout(timeoutId);
      if (err instanceof DOMException && err.name === "AbortError") {
        setErrorMessage("请求超时，请检查网络后重试");
      } else if (err instanceof Error) {
        setErrorMessage(err.message || "生成失败，请重试");
      } else {
        setErrorMessage("生成失败，请重试");
      }
      setReportState("error");
    }
  }, [period, stats]);

  const resetReport = useCallback(() => {
    setReportState("idle");
    setContent("");
    setErrorMessage("");
  }, []);

  const periodLabel =
    period.type === "week" ? "本周" : "本月";

  return (
    <div className="bg-gradient-to-br from-indigo-50 to-violet-50 dark:from-indigo-950/30 dark:to-violet-950/30 rounded-2xl border border-indigo-200 dark:border-indigo-800/50 overflow-hidden">
      <div className="px-4 md:px-6 py-4 md:py-5">
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-indigo-500 flex items-center justify-center">
              <Sparkles className="w-4 h-4 text-white" />
            </div>
            <div>
              <h3 className="text-sm font-semibold text-indigo-700 dark:text-indigo-300">
                AI {periodLabel}报
              </h3>
              <p className="text-xs text-indigo-500/70 dark:text-indigo-400/70">
                基于{periodLabel}数据的智能分析与建议
              </p>
            </div>
          </div>
        </div>

        <AnimatePresence mode="wait">
          {reportState === "idle" && (
            <motion.div
              key="idle"
              initial={{ opacity: 0, y: 4 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -4 }}
            >
              <button
                onClick={generateReport}
                disabled={!hasData}
                className={`w-full h-12 rounded-xl text-sm font-medium transition-all flex items-center justify-center gap-2
                  ${
                    hasData
                      ? "bg-indigo-600 text-white hover:bg-indigo-700 active:scale-[0.98] shadow-lg shadow-indigo-500/25"
                      : "bg-gray-100 dark:bg-gray-800 text-gray-400 dark:text-gray-500 cursor-not-allowed"
                  }`}
              >
                <Sparkles className="w-4 h-4" />
                生成{periodLabel}报
              </button>
              {!hasData && (
                <p className="text-xs text-center text-[var(--muted-foreground)] mt-2">
                  暂无{periodLabel}专注数据，开始专注后可生成周报
                </p>
              )}
            </motion.div>
          )}

          {reportState === "loading" && (
            <motion.div
              key="loading"
              initial={{ opacity: 0, y: 4 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -4 }}
              className="flex flex-col items-center justify-center py-8 gap-4"
            >
              <div className="relative w-12 h-12">
                <div className="absolute inset-0 rounded-full border-2 border-indigo-200 dark:border-indigo-800" />
                <div className="absolute inset-0 rounded-full border-2 border-t-indigo-500 animate-spin" />
              </div>
              <motion.span
                key={loadingTextIdx}
                initial={{ opacity: 0, y: 4 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -4 }}
                className="text-sm font-medium text-indigo-600 dark:text-indigo-400"
              >
                {LOADING_TEXTS[loadingTextIdx]}
              </motion.span>
              <p className="text-xs text-[var(--muted-foreground)]">
                正在生成{periodLabel}报，请稍候...
              </p>
            </motion.div>
          )}

          {(reportState === "streaming" || reportState === "done") && (
            <motion.div
              key="streaming"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="overflow-hidden"
            >
              <div className="prose prose-sm prose-indigo dark:prose-invert max-w-none max-h-96 overflow-y-auto overscroll-contain mt-3">
                <ReactMarkdown remarkPlugins={[remarkGfm]}>
                  {content}
                </ReactMarkdown>
              </div>

              {reportState === "streaming" && (
                <div className="flex items-center gap-2 mt-3">
                  <div className="flex gap-1">
                    <span className="w-1.5 h-1.5 rounded-full bg-indigo-400 animate-bounce" />
                    <span
                      className="w-1.5 h-1.5 rounded-full bg-indigo-400 animate-bounce"
                      style={{ animationDelay: "0.15s" }}
                    />
                    <span
                      className="w-1.5 h-1.5 rounded-full bg-indigo-400 animate-bounce"
                      style={{ animationDelay: "0.3s" }}
                    />
                  </div>
                  <span className="text-xs text-indigo-400">生成中...</span>
                </div>
              )}

              {reportState === "done" && (
                <div className="flex items-center gap-2 mt-3">
                  <button
                    onClick={generateReport}
                    className="text-xs text-indigo-500 hover:text-indigo-600 transition-colors flex items-center gap-1"
                  >
                    <RefreshCw className="w-3 h-3" />
                    重新生成
                  </button>
                </div>
              )}
            </motion.div>
          )}

          {reportState === "error" && (
            <motion.div
              key="error"
              initial={{ opacity: 0, y: 4 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -4 }}
            >
              <div className="flex flex-col items-center justify-center py-6 gap-3">
                <div className="w-10 h-10 rounded-full bg-red-100 dark:bg-red-900/30 flex items-center justify-center">
                  <AlertCircle className="w-5 h-5 text-red-500" />
                </div>
                <p className="text-sm text-red-600 dark:text-red-400 text-center">
                  {errorMessage}
                </p>
                <div className="flex items-center gap-2">
                  {retryCount < 3 && (
                    <button
                      onClick={generateReport}
                      className="inline-flex items-center gap-1.5 bg-indigo-500 text-white px-4 py-2 rounded-xl text-sm font-medium hover:bg-indigo-600 transition-colors"
                    >
                      <RefreshCw className="w-3.5 h-3.5" />
                      重试
                    </button>
                  )}
                  <button
                    onClick={resetReport}
                    className="text-sm text-[var(--muted-foreground)] hover:text-[var(--foreground)] transition-colors"
                  >
                    取消
                  </button>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
