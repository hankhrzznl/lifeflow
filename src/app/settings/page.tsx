"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Key, Download, Upload, Trash2, Eye, EyeOff, AlertTriangle,
  Layers, RefreshCw, Calendar, Flag, Tag, Bookmark,
  Bot, Sparkles, Brain, BellRing, CalendarCheck, Settings2,
} from "lucide-react";
import { db, exportAllData, importAllData } from "@/lib/db";
import { showToast } from "@/components/ui/Toast";
import type { UserSettings, LinkageSettings, GoalTemplate } from "@/lib/types";

const API_KEY_STORAGE_KEY = "lifeflow_api_key";

function ToggleRow({
  icon, label, description, enabled, onToggle,
}: {
  icon: React.ReactNode;
  label: string;
  description: string;
  enabled: boolean;
  onToggle: () => void;
}) {
  return (
    <button
      onClick={onToggle}
      className="w-full flex items-center gap-3 p-3 rounded-xl hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors text-left"
    >
      <div className={`w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0 ${
        enabled ? "bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400" : "bg-gray-100 dark:bg-gray-800 text-gray-400"
      }`}>
        {icon}
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-gray-900 dark:text-white">{label}</p>
        <p className="text-xs text-gray-500 dark:text-gray-400">{description}</p>
      </div>
      <motion.div
        animate={{ scale: enabled ? 1 : 0.9 }}
        className={`w-10 h-6 rounded-full flex items-center p-0.5 transition-colors ${
          enabled ? "bg-blue-500" : "bg-gray-300 dark:bg-gray-700"
        }`}
      >
        <motion.div
          layout
          transition={{ type: "spring", stiffness: 500, damping: 30 }}
          className={`w-5 h-5 rounded-full bg-white shadow-sm`}
          animate={{ x: enabled ? 16 : 0 }}
        />
      </motion.div>
    </button>
  );
}

export default function SettingsPage() {
  // ---- API Key ----
  const [apiKey, setApiKey] = useState(() => {
    if (typeof window !== "undefined") {
      return localStorage.getItem(API_KEY_STORAGE_KEY) || "";
    }
    return "";
  });
  const [showApiKey, setShowApiKey] = useState(false);

  // ---- 数据管理 ----
  const [isExporting, setIsExporting] = useState(false);
  const [showClearConfirm, setShowClearConfirm] = useState(false);
  const [isImporting, setIsImporting] = useState(false);
  const [showImportConfirm, setShowImportConfirm] = useState(false);
  const [importFile, setImportFile] = useState<{ name: string; data: string; exportedAt: string } | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [linkageSettings, setLinkageSettings] = useState<LinkageSettings>({
    autoSyncStatus: true,
    autoSyncDate: true,
    autoInheritPriority: true,
    autoAppendTags: true,
  });
  const [linkageLoaded, setLinkageLoaded] = useState(false);
  const [templates, setTemplates] = useState<GoalTemplate[]>([]);
  const [showTemplateView, setShowTemplateView] = useState(false);
  const [viewingTemplate, setViewingTemplate] = useState<GoalTemplate | null>(null);

  const [aiSettings, setAiSettings] = useState<{ aiEnabled: boolean; aiGoalDecompose: boolean; aiReviewAnalyze: boolean; aiProgressWarning: boolean; autoWeeklyReview: boolean }>({
    aiEnabled: true, aiGoalDecompose: true, aiReviewAnalyze: true, aiProgressWarning: true, autoWeeklyReview: false,
  });

  const [layoutDensity, setLayoutDensity] = useState<string>(
    typeof window !== "undefined" ? localStorage.getItem("lifeflow_layout_density") || "normal" : "normal"
  );
  const [warnThreshold, setWarnThreshold] = useState<string>(
    typeof window !== "undefined" ? localStorage.getItem("lifeflow_warn_threshold") || "50" : "50"
  );
  const [dangerThreshold, setDangerThreshold] = useState<string>(
    typeof window !== "undefined" ? localStorage.getItem("lifeflow_danger_threshold") || "30" : "30"
  );
  const [autoArchiveDays, setAutoArchiveDays] = useState<string>(
    typeof window !== "undefined" ? localStorage.getItem("lifeflow_auto_archive_days") || "" : ""
  );
  const [backupReminder, setBackupReminder] = useState(
    typeof window !== "undefined" ? localStorage.getItem("lifeflow_backup_reminder") === "true" : false
  );

  useEffect(() => {
    const loadSettings = async () => {
      try {
        const settings = await db.userSettings.toArray();
        if (settings[0]?.linkageSettings) {
          setLinkageSettings(settings[0].linkageSettings);
        }
      } catch {} finally {
        setLinkageLoaded(true);
      }
      const aiEnabled = localStorage.getItem("lifeflow_ai_enabled") !== "false";
      const aiGoal = localStorage.getItem("lifeflow_ai_aiGoalDecompose") !== "false";
      const aiReview = localStorage.getItem("lifeflow_ai_aiReviewAnalyze") !== "false";
      const aiWarn = localStorage.getItem("lifeflow_ai_aiProgressWarning") !== "false";
      const aiAuto = localStorage.getItem("lifeflow_ai_autoWeeklyReview") === "true";
      setAiSettings({ aiEnabled, aiGoalDecompose: aiGoal, aiReviewAnalyze: aiReview, aiProgressWarning: aiWarn, autoWeeklyReview: aiAuto });
    };
    loadSettings();
  }, []);

  useEffect(() => {
    const loadTemplates = async () => {
      try {
        const all = await db.goalTemplates.toArray();
        setTemplates(all);
      } catch {}
    };
    loadTemplates();
  }, []);

  const handleToggleLinkage = async (key: keyof LinkageSettings) => {
    const newSettings = { ...linkageSettings, [key]: !linkageSettings[key] };
    setLinkageSettings(newSettings);
    try {
      const existing = await db.userSettings.toArray();
      if (existing[0]) {
        await db.userSettings.update(existing[0].id!, { linkageSettings: newSettings });
      } else {
        await db.userSettings.add({
          sleepTarget: 8,
          napTarget: 0.5,
          weight: 60,
          cupSizes: [200, 300, 500],
          linkageSettings: newSettings,
          createdAt: Date.now(),
        });
      }
      showToast({ message: "联动设置已更新", type: "success", duration: 1500 });
    } catch {
      showToast({ message: "保存失败", type: "error", duration: 2000 });
      setLinkageSettings(linkageSettings); // revert
    }
  };

  const handleToggleAi = (key: string) => {
    const newSettings = { ...aiSettings, [key]: !(aiSettings as any)[key] };
    setAiSettings(newSettings);
    localStorage.setItem(`lifeflow_ai_${key}`, String((newSettings as any)[key]));
    if (key === "aiEnabled") {
      localStorage.setItem("lifeflow_ai_enabled", String(newSettings.aiEnabled));
    }
    showToast({ message: "AI设置已更新", type: "success", duration: 1500 });
  };

  // ---- API Key handlers ----
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
      const json = await exportAllData();
      const blob = new Blob([json], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `lifeflow-backup-${new Date().toISOString().slice(0, 10)}.json`;
      a.click();
      URL.revokeObjectURL(url);
      showToast({ message: "数据导出成功", type: "success", duration: 3000 });
    } catch {
      showToast({ message: "导出失败，请重试", type: "error", duration: 3000 });
    } finally {
      setIsExporting(false);
    }
  }

  function handleClearData() {
    try {
      localStorage.clear();
      setShowClearConfirm(false);
      showToast({ message: "数据已清除，即将重新加载", type: "success", duration: 2000 });
      setTimeout(() => window.location.reload(), 800);
    } catch {
      showToast({ message: "清除失败，请重试", type: "error", duration: 3000 });
    }
  }

  async function handleDeleteTemplate(id: number) {
    await db.goalTemplates.delete(id);
    setTemplates(prev => prev.filter(t => t.id !== id));
    showToast({ message: "模板已删除", type: "success", duration: 2000 });
  }

  function handleFileSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      try {
        const text = ev.target?.result as string;
        const parsed = JSON.parse(text);
        // Accept both new wrapper format {version, exportedAt, data} and old plain format {table: rows}
        if (parsed.version && parsed.data) {
          setImportFile({ name: file.name, data: text, exportedAt: parsed.exportedAt });
        } else if (typeof parsed === "object" && parsed !== null && !Array.isArray(parsed)) {
          // Old format without wrapper — treat as valid
          setImportFile({ name: file.name, data: text, exportedAt: "未知" });
        } else {
          showToast({ message: "无效的备份文件格式", type: "error", duration: 3000 });
          return;
        }
        setShowImportConfirm(true);
      } catch {
        showToast({ message: "无法解析该文件，请检查是否为 JSON 格式", type: "error", duration: 3000 });
      }
    };
    reader.readAsText(file);
    e.target.value = "";
  }

  async function handleImport() {
    if (!importFile) return;
    setIsImporting(true);
    try {
      const parsed = JSON.parse(importFile.data);
      await importAllData(parsed);
      showToast({ message: "数据导入成功，即将刷新", type: "success", duration: 2000 });
      setShowImportConfirm(false);
      setImportFile(null);
      setTimeout(() => window.location.reload(), 800);
    } catch {
      showToast({ message: "导入失败，请检查文件内容", type: "error", duration: 3000 });
    } finally {
      setIsImporting(false);
    }
  }

  return (
    <div className="flex-1 flex flex-col h-full bg-gray-50 dark:bg-gray-950">
      <div className="px-5 pt-6 pb-3">
        <h1 className="text-xl font-bold text-gray-900 dark:text-white">设置</h1>
        <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
          API 密钥与数据管理
        </p>
      </div>

      <div className="flex-1 overflow-y-auto px-5 pb-24 space-y-4">
        {/* === API Key === */}
        <div className="bg-white dark:bg-gray-900 rounded-2xl p-5 border border-gray-100 dark:border-gray-800">
          <div className="flex items-start gap-3 mb-4">
            <div className="w-10 h-10 rounded-xl bg-gray-100 dark:bg-gray-800 flex items-center justify-center flex-shrink-0">
              <Key className="w-5 h-5 text-gray-700 dark:text-gray-300" />
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
              className="w-full px-4 py-2.5 rounded-xl bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 text-sm text-gray-900 dark:text-white placeholder:text-gray-400 pr-10 focus:outline-none focus:ring-2 focus:ring-gray-900/20"
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
            <motion.button whileTap={{ scale: 0.97 }} onClick={handleSaveApiKey}
              className="flex-1 py-2.5 rounded-xl bg-gray-900 text-white text-sm font-medium hover:bg-gray-800 dark:bg-white dark:text-gray-900 dark:hover:bg-gray-100 transition-colors">
              保存
            </motion.button>
            {apiKey && (
              <motion.button whileTap={{ scale: 0.97 }} onClick={handleClearApiKey}
                className="flex-1 py-2.5 rounded-xl bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400 text-sm font-medium hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors">
                清除
              </motion.button>
            )}
          </div>
        </div>

        {/* === 层级联动设置 === */}
        {linkageLoaded && (
          <div className="bg-white dark:bg-gray-900 rounded-2xl p-5 border border-gray-100 dark:border-gray-800">
            <div className="flex items-start gap-3 mb-4">
              <div className="w-10 h-10 rounded-xl bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center flex-shrink-0">
                <Layers className="w-5 h-5 text-blue-600 dark:text-blue-400" />
              </div>
              <div>
                <h3 className="text-base font-semibold text-gray-900 dark:text-white">层级联动设置</h3>
                <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5">
                  控制目标、计划、任务之间的自动同步行为
                </p>
              </div>
            </div>
            <div className="space-y-3">
              <ToggleRow
                icon={<RefreshCw className="w-4 h-4" />}
                label="自动同步状态"
                description="下层全部完成后自动更新上层状态"
                enabled={linkageSettings.autoSyncStatus}
                onToggle={() => handleToggleLinkage("autoSyncStatus")}
              />
              <ToggleRow
                icon={<Calendar className="w-4 h-4" />}
                label="自动同步日期"
                description="上层日期变更后自动偏移下层日期"
                enabled={linkageSettings.autoSyncDate}
                onToggle={() => handleToggleLinkage("autoSyncDate")}
              />
              <ToggleRow
                icon={<Flag className="w-4 h-4" />}
                label="优先级自动继承"
                description="目标优先级默认同步给下属计划与任务"
                enabled={linkageSettings.autoInheritPriority}
                onToggle={() => handleToggleLinkage("autoInheritPriority")}
              />
              <ToggleRow
                icon={<Tag className="w-4 h-4" />}
                label="标签自动追加"
                description="目标标签自动追加到下属计划与任务"
                enabled={linkageSettings.autoAppendTags}
                onToggle={() => handleToggleLinkage("autoAppendTags")}
              />
            </div>
          </div>
        )}

        {/* === 数据导出 === */}
        <div className="bg-white dark:bg-gray-900 rounded-2xl p-5 border border-gray-100 dark:border-gray-800">
          <div className="flex items-start gap-3 mb-4">
            <div className="w-10 h-10 rounded-xl bg-gray-100 dark:bg-gray-800 flex items-center justify-center flex-shrink-0">
              <Download className="w-5 h-5 text-gray-700 dark:text-gray-300" />
            </div>
            <div>
              <h3 className="text-base font-semibold text-gray-900 dark:text-white">数据导出</h3>
              <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5">
                将所有数据导出为 JSON 文件，用于备份或迁移到其他设备。
              </p>
            </div>
          </div>
          <motion.button whileTap={{ scale: 0.97 }} onClick={handleExport} disabled={isExporting}
            className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl bg-gray-900 text-white text-sm font-medium hover:bg-gray-800 dark:bg-white dark:text-gray-900 dark:hover:bg-gray-100 transition-colors disabled:opacity-50">
            <Download className="w-4 h-4" />
            {isExporting ? "导出中..." : "导出全部数据"}
          </motion.button>
        </div>

        {/* === 数据导入 === */}
        <div className="bg-white dark:bg-gray-900 rounded-2xl p-5 border border-gray-100 dark:border-gray-800">
          <div className="flex items-start gap-3 mb-4">
            <div className="w-10 h-10 rounded-xl bg-gray-100 dark:bg-gray-800 flex items-center justify-center flex-shrink-0">
              <Upload className="w-5 h-5 text-gray-700 dark:text-gray-300" />
            </div>
            <div>
              <h3 className="text-base font-semibold text-gray-900 dark:text-white">数据导入</h3>
              <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5">
                从之前导出的 JSON 备份文件恢复数据，导入将覆盖当前数据。
              </p>
            </div>
          </div>
          <input ref={fileInputRef} type="file" accept=".json" onChange={handleFileSelect} className="hidden" />
          <motion.button whileTap={{ scale: 0.97 }} onClick={() => fileInputRef.current?.click()}
            className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl bg-gray-900 text-white text-sm font-medium hover:bg-gray-800 dark:bg-white dark:text-gray-900 dark:hover:bg-gray-100 transition-colors">
            <Upload className="w-4 h-4" />
            选择备份文件并导入
          </motion.button>
        </div>

        {/* === 数据清除 === */}
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
          <motion.button whileTap={{ scale: 0.97 }} onClick={() => setShowClearConfirm(true)}
            className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl bg-red-500 text-white text-sm font-medium hover:bg-red-600 transition-colors">
            <Trash2 className="w-4 h-4" />
            清除全部数据
          </motion.button>
        </div>

        {/* === 我的模板 === */}
        <div className="bg-white dark:bg-gray-900 rounded-2xl p-5 border border-gray-100 dark:border-gray-800">
          <div className="flex items-start gap-3 mb-4">
            <div className="w-10 h-10 rounded-xl bg-amber-100 dark:bg-amber-900/30 flex items-center justify-center flex-shrink-0">
              <Bookmark className="w-5 h-5 text-amber-600 dark:text-amber-400" />
            </div>
            <div className="flex-1">
              <div className="flex items-center justify-between">
                <h3 className="text-base font-semibold text-gray-900 dark:text-white">我的模板</h3>
                <span className="text-xs text-gray-400">{templates.length} 个</span>
              </div>
              <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5">
                管理自定义的目标模板，内置模板不可删除
              </p>
            </div>
          </div>

          {templates.length > 0 ? (
            <div className="space-y-2">
              {templates.map(t => (
                <div key={t.id} className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-800 rounded-xl">
                  <div className="flex items-center gap-2 min-w-0">
                    <span className="text-lg">{t.icon}</span>
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-gray-900 dark:text-white truncate">{t.name}</p>
                      <p className="text-xs text-gray-400">{t.plans.length} 个阶段 · {t.category}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-1">
                    <button
                      onClick={() => { setViewingTemplate(t); setShowTemplateView(true); }}
                      className="p-1.5 text-gray-400 hover:text-gray-600 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-700"
                    >
                      <Eye className="w-4 h-4" />
                    </button>
                    {!t.isBuiltIn && (
                      <button
                        onClick={() => handleDeleteTemplate(t.id!)}
                        className="p-1.5 text-red-400 hover:text-red-600 rounded-lg hover:bg-red-50 dark:hover:bg-red-900/20"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-xs text-gray-400 text-center py-4">暂无模板，从目标详情页可将目标保存为模板</p>
          )}
        </div>

        {/* === AI 智能设置 === */}
        <div className="bg-white dark:bg-gray-900 rounded-2xl p-5 border border-gray-100 dark:border-gray-800">
          <div className="flex items-start gap-3 mb-4">
            <div className="w-10 h-10 rounded-xl bg-violet-100 dark:bg-violet-900/30 flex items-center justify-center flex-shrink-0">
              <Bot className="w-5 h-5 text-violet-600 dark:text-violet-400" />
            </div>
            <div>
              <h3 className="text-base font-semibold text-gray-900 dark:text-white">AI 智能功能</h3>
              <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5">开启AI辅助，提升目标管理效率（需联网）</p>
            </div>
          </div>
          
          <div className="space-y-3 mb-4">
            <ToggleRow icon={<Bot className="w-4 h-4" />} label="启用AI功能" description="总开关，关闭后所有AI入口隐藏" enabled={aiSettings.aiEnabled} onToggle={() => handleToggleAi("aiEnabled")} />
          </div>
          
          {aiSettings.aiEnabled && (
            <div className="space-y-3 pl-2 border-l-2 border-violet-200 dark:border-violet-800 ml-2">
              <ToggleRow icon={<Sparkles className="w-4 h-4" />} label="目标智能拆解" description="AI自动将目标拆解为计划与任务" enabled={aiSettings.aiGoalDecompose} onToggle={() => handleToggleAi("aiGoalDecompose")} />
              <ToggleRow icon={<Brain className="w-4 h-4" />} label="复盘智能分析" description="AI自动分析周期数据给出改进建议" enabled={aiSettings.aiReviewAnalyze} onToggle={() => handleToggleAi("aiReviewAnalyze")} />
              <ToggleRow icon={<AlertTriangle className="w-4 h-4" />} label="进度智能预警" description="自动检测进度滞后并给出调整建议" enabled={aiSettings.aiProgressWarning} onToggle={() => handleToggleAi("aiProgressWarning")} />
              <ToggleRow icon={<CalendarCheck className="w-4 h-4" />} label="自动周/月复盘" description="周期结束时自动生成AI分析" enabled={aiSettings.autoWeeklyReview} onToggle={() => handleToggleAi("autoWeeklyReview")} />
            </div>
          )}
        </div>

        {/* === 深度个性化 === */}
        <div className="bg-white dark:bg-gray-900 rounded-2xl p-5 border border-gray-100 dark:border-gray-800">
          <div className="flex items-start gap-3 mb-4">
            <div className="w-10 h-10 rounded-xl bg-teal-100 dark:bg-teal-900/30 flex items-center justify-center flex-shrink-0">
              <Settings2 className="w-5 h-5 text-teal-600 dark:text-teal-400" />
            </div>
            <div>
              <h3 className="text-base font-semibold text-gray-900 dark:text-white">个性化设置</h3>
              <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5">自定义提醒规则、自动归档与备份策略</p>
            </div>
          </div>
          
          <div className="space-y-4">
            {/* 布局密度 */}
            <div>
              <label className="text-xs font-medium text-gray-500 dark:text-gray-400 mb-1.5 block">布局密度</label>
              <div className="flex gap-2">
                {(["compact", "normal", "loose"] as const).map(d => (
                  <button key={d} onClick={() => { setLayoutDensity(d); localStorage.setItem("lifeflow_layout_density", d); }}
                    className={`flex-1 py-2 text-xs rounded-xl border transition-colors ${
                      layoutDensity === d ? "border-teal-500 bg-teal-50 dark:bg-teal-900/20 text-teal-700 dark:text-teal-400" : "border-gray-200 dark:border-gray-700 text-gray-500"
                    }`}>
                    {d === "compact" ? "紧凑" : d === "normal" ? "标准" : "宽松"}
                  </button>
                ))}
              </div>
            </div>
            
            {/* 进度提醒阈值 */}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs font-medium text-gray-500 dark:text-gray-400 mb-1 block">预警阈值 (%)</label>
                <input type="number" value={warnThreshold} onChange={(e) => { setWarnThreshold(e.target.value); localStorage.setItem("lifeflow_warn_threshold", e.target.value); }}
                  className="w-full px-3 py-2 text-sm rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-900 dark:text-white" />
              </div>
              <div>
                <label className="text-xs font-medium text-gray-500 dark:text-gray-400 mb-1 block">严重滞后阈值 (%)</label>
                <input type="number" value={dangerThreshold} onChange={(e) => { setDangerThreshold(e.target.value); localStorage.setItem("lifeflow_danger_threshold", e.target.value); }}
                  className="w-full px-3 py-2 text-sm rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-900 dark:text-white" />
              </div>
            </div>
            
            {/* 自动归档 */}
            <div>
              <label className="text-xs font-medium text-gray-500 dark:text-gray-400 mb-1 block">完成后自动归档天数 (留空关闭)</label>
              <input type="number" value={autoArchiveDays} onChange={(e) => { setAutoArchiveDays(e.target.value); localStorage.setItem("lifeflow_auto_archive_days", e.target.value); }}
                placeholder="如: 30" className="w-full px-3 py-2 text-sm rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-900 dark:text-white" />
            </div>
            
            {/* 备份提醒 */}
            <div className="flex items-center justify-between">
              <span className="text-xs text-gray-500 dark:text-gray-400">每月备份提醒</span>
              <button onClick={() => { setBackupReminder(!backupReminder); localStorage.setItem("lifeflow_backup_reminder", String(!backupReminder)); }}
                className={`w-10 h-6 rounded-full relative transition-colors ${backupReminder ? "bg-teal-500" : "bg-gray-300"}`}>
                <div className={`w-5 h-5 rounded-full bg-white absolute top-0.5 transition-transform ${backupReminder ? "translate-x-[18px]" : "translate-x-[2px]"}`} />
              </button>
            </div>
          </div>
        </div>

        {/* === 版本信息 === */}
        <div className="bg-white dark:bg-gray-900 rounded-2xl p-5 border border-gray-100 dark:border-gray-800">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-2xl bg-gray-900 dark:bg-white flex items-center justify-center flex-shrink-0 shadow-lg shadow-gray-900/10">
              <span className="text-white dark:text-gray-900 text-lg font-bold">L</span>
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

      {/* ==================== 数据导入确认弹窗 ==================== */}
      <AnimatePresence>
        {showImportConfirm && importFile && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-6"
            onClick={() => setShowImportConfirm(false)}>
            <motion.div initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.9, opacity: 0 }}
              onClick={(e) => e.stopPropagation()}
              className="bg-white dark:bg-gray-900 rounded-3xl p-6 max-w-sm w-full shadow-xl">
              <div className="flex flex-col items-center text-center gap-3">
                <div className="w-12 h-12 rounded-full bg-gray-100 dark:bg-gray-800 flex items-center justify-center">
                  <Upload className="w-6 h-6 text-gray-700 dark:text-gray-300" />
                </div>
                <div>
                  <h3 className="text-lg font-semibold text-gray-900 dark:text-white">确认导入数据</h3>
                  <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                    将用备份文件 <strong className="text-gray-700 dark:text-gray-300">{importFile.name}</strong>（导出于 {new Date(importFile.exportedAt).toLocaleString("zh-CN")}）覆盖当前所有数据。此操作不可撤销，确定要继续吗？
                  </p>
                </div>
                <div className="flex gap-3 w-full mt-1">
                  <button onClick={() => { setShowImportConfirm(false); setImportFile(null); }}
                    className="flex-1 px-4 py-2.5 rounded-xl text-sm font-medium border border-gray-200 dark:border-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors">取消</button>
                  <motion.button whileTap={{ scale: 0.97 }} onClick={handleImport} disabled={isImporting}
                    className="flex-1 px-4 py-2.5 rounded-xl text-sm font-medium bg-gray-900 text-white hover:bg-gray-800 dark:bg-white dark:text-gray-900 dark:hover:bg-gray-100 transition-colors disabled:opacity-50">
                    {isImporting ? "导入中..." : "确认导入"}
                  </motion.button>
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ==================== 数据清除确认弹窗 ==================== */}
      <AnimatePresence>
        {showClearConfirm && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-6"
            onClick={() => setShowClearConfirm(false)}>
            <motion.div initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.9, opacity: 0 }}
              onClick={(e) => e.stopPropagation()}
              className="bg-white dark:bg-gray-900 rounded-3xl p-6 max-w-sm w-full shadow-xl">
              <div className="flex flex-col items-center text-center gap-3">
                <div className="w-12 h-12 rounded-full bg-red-100 dark:bg-red-900/30 flex items-center justify-center">
                  <AlertTriangle className="w-6 h-6 text-red-500" />
                </div>
                <div>
                  <h3 className="text-lg font-semibold text-gray-900 dark:text-white">确认清除数据</h3>
                  <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                    这将清除所有本地存储的数据和缓存，包括任务、项目、设置等。此操作不可撤销，确定要继续吗？
                  </p>
                </div>
                <div className="flex gap-3 w-full mt-1">
                  <button onClick={() => setShowClearConfirm(false)}
                    className="flex-1 px-4 py-2.5 rounded-xl text-sm font-medium border border-gray-200 dark:border-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors">取消</button>
                  <motion.button whileTap={{ scale: 0.97 }} onClick={handleClearData}
                    className="flex-1 px-4 py-2.5 rounded-xl text-sm font-medium bg-red-500 text-white hover:bg-red-600 transition-colors">确认清除</motion.button>
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {showTemplateView && viewingTemplate && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-end justify-center bg-black/40"
            onClick={() => setShowTemplateView(false)}>
            <motion.div initial={{ y: "100%" }} animate={{ y: 0 }} exit={{ y: "100%" }}
              transition={{ type: "spring", stiffness: 400, damping: 40 }}
              onClick={(e) => e.stopPropagation()}
              className="w-full max-w-lg bg-white dark:bg-gray-900 rounded-t-2xl p-6 max-h-[70vh] overflow-y-auto">
              <div className="w-10 h-1 bg-gray-300 dark:bg-gray-700 rounded-full mx-auto mb-4" />
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-1">{viewingTemplate.name}</h3>
              <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">{viewingTemplate.description}</p>
              <div className="space-y-3">
                {viewingTemplate.plans.map((p, i) => (
                  <div key={i} className="p-3 bg-gray-50 dark:bg-gray-800 rounded-xl">
                    <p className="text-sm font-medium text-gray-700 dark:text-gray-300">{p.name}</p>
                    <div className="mt-2 space-y-1">
                      {p.tasks.map((t, j) => (
                        <div key={j} className="flex items-center gap-2 text-xs text-gray-500 dark:text-gray-400">
                          <span className="w-1 h-1 rounded-full bg-gray-400" />
                          {t.title}
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
              <button onClick={() => setShowTemplateView(false)}
                className="mt-4 w-full py-3 rounded-xl border border-gray-200 dark:border-gray-700 text-sm text-gray-500">
                关闭
              </button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
