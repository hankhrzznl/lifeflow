"use client";

import { useState, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X } from "lucide-react";

// ============================================================
// ReminderToast — 监听 'lf-reminder' 事件
// ============================================================

interface ToastItem {
  id: string;
  title: string;
  message: string;
}

export default function ReminderToast() {
  const [toasts, setToasts] = useState<ToastItem[]>([]);

  const removeToast = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  useEffect(() => {
    const handler = (e: Event) => {
      const detail = (e as CustomEvent).detail as { title: string; message: string; id: string };
      const id = detail.id || crypto.randomUUID();
      setToasts((prev) => [...prev, { id, title: detail.title, message: detail.message }]);
      // 3秒后自动消失
      setTimeout(() => removeToast(id), 4000);
    };

    window.addEventListener('lf-reminder', handler);
    return () => window.removeEventListener('lf-reminder', handler);
  }, [removeToast]);

  return (
    <div className="fixed bottom-20 left-4 right-4 z-50 pointer-events-none flex flex-col gap-2">
      <AnimatePresence>
        {toasts.map((toast) => (
          <motion.div
            key={toast.id}
            initial={{ opacity: 0, y: 20, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -10, scale: 0.95 }}
            className="pointer-events-auto rounded-fabric p-4 shadow-modal max-w-sm mx-auto flex items-start gap-3"
            style={{ backgroundColor: "var(--surface-fabric)" }}
          >
            <span className="text-lg flex-shrink-0">🧶</span>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium" style={{ fontFamily: "var(--font-display)", color: "var(--text-primary)" }}>
                {toast.title}
              </p>
              <p className="text-xs mt-0.5" style={{ color: "var(--text-secondary)" }}>
                {toast.message}
              </p>
            </div>
            <button onClick={() => removeToast(toast.id)} className="flex-shrink-0" style={{ color: "var(--text-tertiary)" }}>
              <X className="w-4 h-4" />
            </button>
          </motion.div>
        ))}
      </AnimatePresence>
    </div>
  );
}
