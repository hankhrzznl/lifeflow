"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Key, Download, Trash2, Eye, EyeOff, AlertTriangle } from "lucide-react";
import { exportAllData } from "@/lib/db";
import { showToast } from "@/components/ui/Toast";

const API_KEY_STORAGE_KEY = "lifeflow_api_key";

export default function SettingsPage() {
  const [apiKey, setApiKey] = useState(() => {
    if (typeof window !== "undefined") {
      return localStorage.getItem(API_KEY_STORAGE_KEY) || "";
    }
    return "";
  });
  const [showApiKey, setShowApiKey] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  const [showClearConfirm, setShowClearConfirm] = useState(false);

  function handleSaveApiKey() {
    const trimmed = apiKey.trim();
    if (!trimmed) {
      showToast({ message: "请输入有效的 API Key", type: "warning", duration: 3000 });
      return;
    }
    if (trimmed.length < 4) {
      showToast({ message: "API Key 长度至少需要 4 个字符", type: "warning", duration: 3000 });
      return;
    }
    localStorage.setItem(API_KEY_STORAGE_KEY, trimmed);
    showToast({ message: "API Key 已保存", type: "success", duration: 2000 });
  }

  function handleClearApiKey() {
    localStorage.removeItem(API_KEY_STORAGE_KEY);
    setApiKey("");
    showToast({ message: "API Key 已清除", type: "success", duration: 2000 });
  }

  async function handleExport() {
    setIsExporting(true);
    try {
      const data = await exportAllData();
      const json = JSON.stringify(data, null, 2);
      const blob = new Blob([json], { type: "application/json" });
      const url = URL.createObjectURL(blob);

      const a = document.createElement("a");
      a.href = url;
      a.download = `lifeflow-backup-${new Date().toISOString().slice(0, 10)}.json`;
      a.click();
      URL.revokeObjectURL(url);

      showToast({
        message: "数据导出成功",
        type: "success",
        duration: 3000,
      });
    } catch {
      showToast({
        message: "导出失败，请重试",
        type: "error",
        duration: 3000,
      });
    } finally {
      setIsExporting(false);
    }
  }

  function handleClearData() {
    try {
      localStorage.clear();
      setShowClearConfirm(false);
      showToast({ message: "数据已清除，即将重新加载", type: "success", duration: 2000 });
      setTimeout(() => {
        window.location.reload();
      }, 800);
    } catch {
      showToast({ message: "清除失败，请重试", type: "error", duration: 3000 });
    }
  }

  return (
    <div className="flex-1 flex flex-col h-full bg-gray-50 dark:bg-gray-950">
      <div className="px-5 pt-6 pb-3">
        <h1 className="text-xl font-bold text-gray-900 dark:text-white">设置</h1>
        <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
          API 密钥、数据管理与应用信息
        </p>
      </div>

      <div className="flex-1 overflow-y-auto px-5 pb-24 space-y-4">
        <div className="bg-white dark:bg-gray-900 rounded-2xl p-5 border border-gray-100 dark:border-gray-800">
          <div className="flex items-start gap-3 mb-4">
            <div className="w-10 h-10 rounded-xl bg-amber-100 dark:bg-amber-900/30 flex items-center justify-center flex-shrink-0">
              <Key className="w-5 h-5 text-amber-500" />
            </div>
            <div>
              <h3 className="text-base font-semibold text-gray-900 dark:text-white">API Key</h3>
              <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5">
                配置 AI 服务的 API 密钥，密钥仅在本地存储
              </p>
            </div>
          </div>

          <div className="relative mb-3">
            <input
              type={showApiKey ? "text" : "password"}
              value={apiKey}
              onChange={(e) => setApiKey(e.target.value)}
              placeholder="sk-..."
              className="w-full px-4 py-2.5 rounded-xl bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 text-sm text-gray-900 dark:text-white placeholder:text-gray-400 pr-10 focus:outline-none focus:ring-2 focus:ring-amber-500/30"
            />
            <button
              onClick={() => setShowApiKey(!showApiKey)}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-colors"
              aria-label={showApiKey ? "隐藏" : "显示"}
            >
              {showApiKey ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
            </button>
          </div>

          <div className="flex gap-2">
            <motion.button
              whileTap={{ scale: 0.97 }}
              onClick={handleSaveApiKey}
              className="flex-1 py-2.5 rounded-xl bg-amber-500 text-white text-sm font-medium hover:bg-amber-600 transition-colors"
            >
              保存
            </motion.button>
            {apiKey && (
              <motion.button
                whileTap={{ scale: 0.97 }}
                onClick={handleClearApiKey}
                className="flex-1 py-2.5 rounded-xl bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400 text-sm font-medium hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors"
              >
                清除
              </motion.button>
            )}
          </div>
        </div>

        <div className="bg-white dark:bg-gray-900 rounded-2xl p-5 border border-gray-100 dark:border-gray-800">
          <div className="flex items-start gap-3 mb-4">
            <div className="w-10 h-10 rounded-xl bg-emerald-100 dark:bg-emerald-900/30 flex items-center justify-center flex-shrink-0">
              <Download className="w-5 h-5 text-emerald-500" />
            </div>
            <div>
              <h3 className="text-base font-semibold text-gray-900 dark:text-white">数据导出</h3>
              <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5">
                将所有数据导出为 JSON 文件，用于备份或迁移到其他设备。
              </p>
            </div>
          </div>

          <motion.button
            whileTap={{ scale: 0.97 }}
            onClick={handleExport}
            disabled={isExporting}
            className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl bg-emerald-500 text-white text-sm font-medium hover:bg-emerald-600 transition-colors disabled:opacity-50"
          >
            <Download className="w-4 h-4" />
            {isExporting ? "导出中..." : "导出全部数据"}
          </motion.button>
        </div>

        <div className="bg-white dark:bg-gray-900 rounded-2xl p-5 border border-gray-100 dark:border-gray-800">
          <div className="flex items-start gap-3 mb-4">
            <div className="w-10 h-10 rounded-xl bg-red-100 dark:bg-red-900/30 flex items-center justify-center flex-shrink-0">
              <Trash2 className="w-5 h-5 text-red-500" />
            </div>
            <div>
              <h3 className="text-base font-semibold text-gray-900 dark:text-white">数据清除</h3>
              <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5">
                清除所有本地数据和缓存，此操作不可撤销。
              </p>
            </div>
          </div>

          <motion.button
            whileTap={{ scale: 0.97 }}
            onClick={() => setShowClearConfirm(true)}
            className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl bg-red-500 text-white text-sm font-medium hover:bg-red-600 transition-colors"
          >
            <Trash2 className="w-4 h-4" />
            清除全部数据
          </motion.button>
        </div>

        <div className="bg-white dark:bg-gray-900 rounded-2xl p-5 border border-gray-100 dark:border-gray-800">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center flex-shrink-0 shadow-lg shadow-indigo-500/20">
              <span className="text-white text-lg font-bold">L</span>
            </div>
            <div>
              <h3 className="text-base font-semibold text-gray-900 dark:text-white">LifeFlow v2.2</h3>
              <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5">
                &copy; {new Date().getFullYear()} LifeFlow. All rights reserved.
              </p>
            </div>
          </div>
        </div>
      </div>

      <AnimatePresence>
        {showClearConfirm && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-6"
            onClick={() => setShowClearConfirm(false)}
          >
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              onClick={(e) => e.stopPropagation()}
              className="bg-white dark:bg-gray-900 rounded-3xl p-6 max-w-sm w-full shadow-xl"
            >
              <div className="flex flex-col items-center text-center gap-3">
                <div className="w-12 h-12 rounded-full bg-red-100 dark:bg-red-900/30 flex items-center justify-center">
                  <AlertTriangle className="w-6 h-6 text-red-500" />
                </div>
                <div>
                  <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
                    确认清除数据
                  </h3>
                  <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                    这将清除所有本地存储的数据和缓存，包括任务、项目、设置等。此操作不可撤销，确定要继续吗？
                  </p>
                </div>

                <div className="flex gap-3 w-full mt-1">
                  <button
                    onClick={() => setShowClearConfirm(false)}
                    className="flex-1 px-4 py-2.5 rounded-xl text-sm font-medium border border-gray-200 dark:border-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors"
                  >
                    取消
                  </button>
                  <motion.button
                    whileTap={{ scale: 0.97 }}
                    onClick={handleClearData}
                    className="flex-1 px-4 py-2.5 rounded-xl text-sm font-medium bg-red-500 text-white hover:bg-red-600 transition-colors"
                  >
                    确认清除
                  </motion.button>
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
