"use client";

import { useState, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Download,
  Upload,
  AlertTriangle,
} from "lucide-react";
import { exportAllData, importAllData, type ExportData } from "@/lib/db";
import { showToast } from "@/components/ui/Toast";

const TABLE_LABELS: Record<string, string> = {
  capture: "捕捉",
  events: "事件",
  focusLogs: "专注记录",
  projects: "项目",
  agentMemory: "Agent 记忆",
  agentChats: "Agent 对话",
};

export default function SettingsPage() {
  const [isExporting, setIsExporting] = useState(false);
  const [isImporting, setIsImporting] = useState(false);
  const [importConfirm, setImportConfirm] = useState<ExportData | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

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

      const total =
        (data.data.capture?.length || 0) +
        (data.data.events?.length || 0) +
        (data.data.focusLogs?.length || 0) +
        (data.data.projects?.length || 0) +
        (data.data.agentMemory?.length || 0) +
        (data.data.agentChats?.length || 0);

      showToast({
        message: `已导出 ${total} 条数据`,
        type: "success",
        duration: 3000,
      });
    } catch (err) {
      console.error("Export failed:", err);
      showToast({
        message: "导出失败，请重试",
        type: "error",
        duration: 3000,
      });
    } finally {
      setIsExporting(false);
    }
  }

  function handleFileSelect() {
    fileInputRef.current?.click();
  }

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (ev) => {
      try {
        const data = JSON.parse(ev.target?.result as string) as ExportData;
        if (!data.version || !data.data) {
          throw new Error("Invalid backup file format");
        }
        setImportConfirm(data);
      } catch {
        showToast({
          message: "无效的备份文件，请检查文件格式",
          type: "error",
          duration: 4000,
        });
      }
    };
    reader.readAsText(file);

    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  }

  async function handleImport(data: ExportData) {
    setIsImporting(true);
    setImportConfirm(null);
    try {
      const result = await importAllData(data);
      const imported = Object.entries(result.imported)
        .filter(([, count]) => count > 0)
        .map(([table, count]) => `${TABLE_LABELS[table] || table} ${count} 条`)
        .join("、");

      showToast({
        message: `导入成功：${imported}`,
        type: "success",
        duration: 4000,
      });

      window.dispatchEvent(new Event("data-imported"));
    } catch (err) {
      console.error("Import failed:", err);
      showToast({
        message: "导入失败，请重试",
        type: "error",
        duration: 4000,
      });
    } finally {
      setIsImporting(false);
    }
  }

  return (
    <div className="flex-1 flex flex-col h-full bg-[var(--bg-primary)]">
      <div className="px-5 pt-6 pb-3">
        <h1 className="text-xl font-bold text-[var(--text-primary)]">设置</h1>
        <p className="text-sm text-[var(--text-secondary)] mt-1">
          数据备份与恢复
        </p>
      </div>

      <div className="flex-1 overflow-y-auto px-5 pb-24 space-y-4">
        <div className="rounded-2xl bg-[var(--bg-secondary)] p-5">
          <div className="flex items-start gap-3 mb-3">
            <div className="w-10 h-10 rounded-xl bg-emerald-100 dark:bg-emerald-900/30 flex items-center justify-center flex-shrink-0">
              <Download className="w-5 h-5 text-emerald-500" />
            </div>
            <div>
              <h3 className="text-base font-semibold text-[var(--text-primary)]">
                导出数据
              </h3>
              <p className="text-sm text-[var(--text-secondary)] mt-0.5">
                将所有数据导出为 JSON 文件，用于备份或迁移到其他设备。
                包括捕捉、事件、专注记录、项目、Agent 记忆和对话。
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

        <div className="rounded-2xl bg-[var(--bg-secondary)] p-5">
          <div className="flex items-start gap-3 mb-3">
            <div className="w-10 h-10 rounded-xl bg-indigo-100 dark:bg-indigo-900/30 flex items-center justify-center flex-shrink-0">
              <Upload className="w-5 h-5 text-indigo-500" />
            </div>
            <div>
              <h3 className="text-base font-semibold text-[var(--text-primary)]">
                导入数据
              </h3>
              <p className="text-sm text-[var(--text-secondary)] mt-0.5">
                从之前导出的 JSON 备份文件中恢复数据。
                导入将覆盖当前所有数据，请谨慎操作。
              </p>
            </div>
          </div>
          <input
            ref={fileInputRef}
            type="file"
            accept=".json"
            onChange={handleFileChange}
            className="hidden"
          />
          <motion.button
            whileTap={{ scale: 0.97 }}
            onClick={handleFileSelect}
            disabled={isImporting}
            className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl bg-indigo-500 text-white text-sm font-medium hover:bg-indigo-600 transition-colors disabled:opacity-50"
          >
            <Upload className="w-4 h-4" />
            {isImporting ? "导入中..." : "选择备份文件导入"}
          </motion.button>
        </div>
      </div>

      <AnimatePresence>
        {importConfirm && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-6"
            onClick={() => setImportConfirm(null)}
          >
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              onClick={(e) => e.stopPropagation()}
              className="bg-[var(--bg-primary)] rounded-3xl p-6 max-w-sm w-full shadow-xl"
            >
              <div className="flex flex-col items-center text-center gap-3">
                <div className="w-12 h-12 rounded-full bg-amber-100 dark:bg-amber-900/30 flex items-center justify-center">
                  <AlertTriangle className="w-6 h-6 text-amber-500" />
                </div>
                <div>
                  <h3 className="text-lg font-semibold text-[var(--text-primary)]">
                    确认导入数据
                  </h3>
                  <p className="text-sm text-[var(--text-secondary)] mt-1">
                    导入将覆盖当前所有数据。此操作不可撤销。
                  </p>
                </div>

                <div className="w-full bg-[var(--bg-secondary)] rounded-xl p-3 text-left text-sm text-[var(--text-secondary)]">
                  <p className="text-xs text-[var(--text-secondary)] mb-2">
                    备份时间：{new Date(importConfirm.exportedAt).toLocaleString("zh-CN")}
                  </p>
                  {Object.entries(importConfirm.data)
                    .filter(([, arr]) => Array.isArray(arr) && arr.length > 0)
                    .map(([table, arr]) => (
                      <div
                        key={table}
                        className="flex items-center justify-between py-1"
                      >
                        <span>{TABLE_LABELS[table] || table}</span>
                        <span className="text-[var(--text-primary)] font-medium">
                          {arr.length} 条
                        </span>
                      </div>
                    ))}
                </div>

                <div className="flex gap-3 w-full mt-1">
                  <button
                    onClick={() => setImportConfirm(null)}
                    className="flex-1 px-4 py-2.5 rounded-xl text-sm font-medium border border-[var(--card-border)] text-[var(--text-primary)] hover:bg-[var(--bg-secondary)] transition-colors"
                  >
                    取消
                  </button>
                  <motion.button
                    whileTap={{ scale: 0.97 }}
                    onClick={() => handleImport(importConfirm)}
                    className="flex-1 px-4 py-2.5 rounded-xl text-sm font-medium bg-indigo-500 text-white hover:bg-indigo-600 transition-colors"
                  >
                    确认导入
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
