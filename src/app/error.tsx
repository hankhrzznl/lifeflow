"use client";

import { useEffect } from "react";
import { motion } from "framer-motion";
import { AlertTriangle, RefreshCw, Home } from "lucide-react";
import Link from "next/link";

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("Route error:", error);
  }, [error]);

  return (
    <div className="flex items-center justify-center min-h-[60vh] p-4">
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3 }}
        className="flex flex-col items-center text-center max-w-sm"
      >
        <div className="w-16 h-16 rounded-2xl bg-red-100 dark:bg-red-900/30 flex items-center justify-center mb-4">
          <AlertTriangle className="w-8 h-8 text-red-500" />
        </div>

        <h2 className="text-lg font-semibold text-[var(--foreground)] mb-2">
          页面加载出错
        </h2>
        <p className="text-sm text-[var(--muted-foreground)] mb-6">
          {error.message || "发生了一些意外错误，请稍后重试"}
        </p>

        <div className="flex items-center gap-3">
          <button
            onClick={reset}
            className="inline-flex items-center gap-2 bg-indigo-500 text-white px-5 py-2.5 rounded-xl text-sm font-medium hover:bg-indigo-600 transition-colors active:scale-95"
          >
            <RefreshCw className="w-4 h-4" />
            重试
          </button>
          <Link
            href="/"
            className="inline-flex items-center gap-2 bg-gray-100 dark:bg-gray-800 text-[var(--foreground)] px-5 py-2.5 rounded-xl text-sm font-medium hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors"
          >
            <Home className="w-4 h-4" />
            回首页
          </Link>
        </div>
      </motion.div>
    </div>
  );
}
