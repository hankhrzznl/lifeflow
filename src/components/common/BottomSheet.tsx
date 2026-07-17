"use client";

import React from "react";
import { motion, AnimatePresence } from "framer-motion";

// ============================================================
// 类型
// ============================================================

export interface BottomSheetProps {
  open: boolean;
  onClose: () => void;
  title?: string;
  children: React.ReactNode;
  showHandle?: boolean;
}

// ============================================================
// 组件
// ============================================================

function BottomSheet({ open, onClose, title, children, showHandle = true }: BottomSheetProps) {
  return (
    <AnimatePresence>
      {open && (
        <>
          {/* 遮罩 */}
          <motion.div
            key="common-bottom-sheet-backdrop"
            className="fixed inset-0 z-40 bg-black/30"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
          />

          {/* 面板 */}
          <motion.div
            key="common-bottom-sheet"
            className="fixed inset-x-0 bottom-0 z-50"
            initial={{ y: "100%" }}
            animate={{ y: 0 }}
            exit={{ y: "100%" }}
            transition={{ type: "spring", damping: 30, stiffness: 300 }}
          >
            <div className="bg-white rounded-t-2xl shadow-modal flex flex-col max-h-[85vh]">
              {/* 拖拽手柄 */}
              {showHandle && (
                <div className="flex justify-center pt-3 pb-2">
                  <div className="w-9 h-1.5 rounded-full bg-[#E5E5EA]" />
                </div>
              )}

              {/* 标题 */}
              {title && (
                <div className="px-5 pb-3 text-center">
                  <h2 className="text-base font-semibold text-gray-900">{title}</h2>
                </div>
              )}

              {/* 内容 */}
              <div className="overflow-y-auto overscroll-contain px-5 pb-8">{children}</div>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}

// ============================================================
// 导出
// ============================================================

export default BottomSheet;
export { BottomSheet };
