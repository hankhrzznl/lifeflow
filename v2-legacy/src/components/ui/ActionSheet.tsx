"use client";

import { useEffect, type ReactNode } from "react";
import { AnimatePresence, motion } from "framer-motion";

export interface ActionSheetAction {
  label: string;
  icon?: ReactNode;
  danger?: boolean;
  onClick: () => void;
}

interface ActionSheetProps {
  open: boolean;
  onClose: () => void;
  title?: string;
  actions: ActionSheetAction[];
}

export default function ActionSheet({
  open,
  onClose,
  title,
  actions,
}: ActionSheetProps) {
  // 打开时锁定背景滚动，关闭/卸载时恢复
  useEffect(() => {
    if (!open) return;
    const originalOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = originalOverflow;
    };
  }, [open]);

  return (
    <AnimatePresence>
      {open && (
        <>
          <motion.div
            key="action-sheet-backdrop"
            className="fixed inset-0 z-50 bg-black/40 backdrop-blur-sm"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
          />

          <motion.div
            key="action-sheet"
            className="fixed inset-x-0 bottom-0 z-50"
            initial={{ y: "100%" }}
            animate={{ y: 0 }}
            exit={{ y: "100%" }}
            transition={{ type: "spring", damping: 30, stiffness: 300 }}
            role="dialog"
            aria-modal="true"
            aria-label={title}
          >
            <div className="mx-auto max-w-lg px-3 pb-[calc(env(safe-area-inset-bottom)+12px)]">
              <div className="bg-white dark:bg-gray-900 rounded-2xl shadow-2xl overflow-hidden">
                {title && (
                  <div className="px-4 pt-3.5 pb-2.5 text-center border-b border-gray-100 dark:border-gray-800">
                    <p className="text-sm text-gray-500 dark:text-gray-400 truncate">
                      {title}
                    </p>
                  </div>
                )}

                <div className="max-h-[60vh] overflow-y-auto overscroll-contain">
                  {actions.map((action, index) => (
                    <button
                      key={`${action.label}-${index}`}
                      type="button"
                      onClick={() => {
                        action.onClick();
                        onClose();
                      }}
                      className={`w-full min-h-12 px-4 flex items-center justify-center gap-2 text-base transition-colors active:bg-gray-100 dark:active:bg-gray-800 ${
                        index > 0
                          ? "border-t border-gray-100 dark:border-gray-800"
                          : ""
                      } ${
                        action.danger
                          ? "text-red-600 dark:text-red-400 font-medium"
                          : "text-gray-900 dark:text-gray-100"
                      }`}
                    >
                      {action.icon && (
                        <span className="flex-shrink-0 w-5 h-5 flex items-center justify-center">
                          {action.icon}
                        </span>
                      )}
                      <span>{action.label}</span>
                    </button>
                  ))}
                </div>
              </div>

              <button
                type="button"
                onClick={onClose}
                className="mt-2 w-full min-h-12 rounded-2xl bg-white dark:bg-gray-900 shadow-2xl text-base font-medium text-gray-700 dark:text-gray-300 transition-colors active:bg-gray-100 dark:active:bg-gray-800"
              >
                取消
              </button>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
