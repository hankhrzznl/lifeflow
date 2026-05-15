"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { X, CheckCircle, XCircle, AlertTriangle, Info } from "lucide-react";

export interface ToastData {
  id: string;
  message: string;
  type: "success" | "error" | "warning" | "info";
  duration?: number;
  undoAction?: () => void;
  action?: {
    label: string;
    onClick: () => void;
  };
}

let addToastFn: ((toast: Omit<ToastData, "id">) => void) | null = null;

export function showToast(toast: Omit<ToastData, "id">) {
  addToastFn?.(toast);
}

export function ToastContainer() {
  const [toasts, setToasts] = useState<ToastData[]>([]);
  const durationsRef = useRef<Map<string, number>>(new Map());

  const addToast = useCallback((toast: Omit<ToastData, "id">) => {
    const id = Math.random().toString(36).slice(2);
    const duration = toast.duration ?? 5000;
    durationsRef.current.set(id, duration);
    setToasts((prev) => {
      const next = [...prev, { ...toast, id, duration }];
      if (next.length > 3) {
        const oldest = next[0];
        durationsRef.current.delete(oldest.id);
        return next.slice(-3);
      }
      return next;
    });

    if (duration !== 0) {
      setTimeout(() => {
        durationsRef.current.delete(id);
        setToasts((prev) => prev.filter((t) => t.id !== id));
      }, duration);
    }
  }, []);

  useEffect(() => {
    addToastFn = addToast;
    return () => {
      addToastFn = null;
    };
  }, [addToast]);

  const removeToast = (id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  };

  const typeStyles: Record<string, string> = {
    success: "bg-emerald-500 text-white",
    error: "bg-red-500 text-white",
    warning: "bg-amber-500 text-white",
    info: "bg-slate-800 text-white",
  };

  const typeIcons: Record<string, typeof CheckCircle> = {
    success: CheckCircle,
    error: XCircle,
    warning: AlertTriangle,
    info: Info,
  };

  return (
    <div className="fixed bottom-20 left-1/2 -translate-x-1/2 z-[100] flex flex-col gap-2 pointer-events-none">
      <AnimatePresence>
        {toasts.map((toast) => {
          const TypeIcon = typeIcons[toast.type] || Info;
          const duration = toast.duration ?? 5000;
          return (
          <motion.div
            key={toast.id}
            initial={{ opacity: 0, y: 20, scale: 0.9 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 20, scale: 0.9 }}
            transition={{ type: "spring", stiffness: 500, damping: 30 }}
            className={`${typeStyles[toast.type]} px-4 py-3 rounded-xl shadow-lg flex items-center gap-3 min-w-[280px] max-w-[360px] pointer-events-auto relative overflow-hidden`}
          >
            <TypeIcon className="w-4 h-4 flex-shrink-0 opacity-80" />
            <span className="text-sm flex-1">{toast.message}</span>
            {toast.undoAction && (
              <button
                onClick={() => {
                  toast.undoAction?.();
                  removeToast(toast.id);
                }}
                className="text-sm font-semibold underline underline-offset-2 flex-shrink-0"
              >
                撤销
              </button>
            )}
            {toast.action && (
              <button
                onClick={() => {
                  toast.action?.onClick();
                  removeToast(toast.id);
                }}
                className="text-sm font-semibold underline underline-offset-2 flex-shrink-0"
              >
                {toast.action.label}
              </button>
            )}
            <button onClick={() => removeToast(toast.id)} className="opacity-70 hover:opacity-100 flex-shrink-0">
              <X className="w-4 h-4" />
            </button>
            {duration > 0 && (
              <motion.div
                className="absolute bottom-0 left-0 h-[3px] bg-white/30"
                initial={{ width: "100%" }}
                animate={{ width: "0%" }}
                transition={{ duration: duration / 1000, ease: "linear" }}
              />
            )}
          </motion.div>
        )})}
      </AnimatePresence>
    </div>
  );
}
