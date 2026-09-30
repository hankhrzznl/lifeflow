"use client";

import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Sparkles, X } from "lucide-react";

const UPGRADE_VERSION = 26;
const UPGRADE_BANNER_KEY = "lifeflow_upgrade_banner_26";

export default function UpgradeNotification() {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const dismissed = localStorage.getItem(UPGRADE_BANNER_KEY);
    if (!dismissed) {
      setVisible(true);
    }
  }, []);

  const handleDismiss = () => {
    localStorage.setItem(UPGRADE_BANNER_KEY, "true");
    setVisible(false);
  };

  return (
    <AnimatePresence>
      {visible && (
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -20 }}
          transition={{ duration: 0.3 }}
          className="fixed top-4 left-1/2 -translate-x-1/2 z-50 w-[calc(100%-2rem)] max-w-md"
        >
          <div className="bg-gradient-to-r from-indigo-600 to-purple-600 rounded-2xl p-4 shadow-xl shadow-indigo-500/25 text-white">
            <div className="flex items-start gap-3">
              <div className="w-10 h-10 rounded-xl bg-white/20 flex items-center justify-center shrink-0">
                <Sparkles className="w-5 h-5" />
              </div>
              <div className="flex-1 min-w-0">
                <h3 className="text-sm font-bold mb-1">LifeFlow 已升级到 v2.6</h3>
                <p className="text-xs text-white/80 leading-relaxed">
                  新增层级目标管理、自动进度同步、健身/睡眠/饮水/财务量化目标追踪。
                </p>
                <button
                  onClick={handleDismiss}
                  className="mt-2 px-4 py-1.5 bg-white/20 hover:bg-white/30 rounded-lg text-xs font-medium transition-colors"
                >
                  知道了
                </button>
              </div>
              <button
                onClick={handleDismiss}
                className="p-1.5 hover:bg-white/10 rounded-lg shrink-0"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
