"use client";

import { useState, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Puzzle,
  Plus,
  Trash2,
  Power,
  PowerOff,
  AlertCircle,
  CheckCircle2,
  Circle,
  XCircle,
  Code2,
  ChevronDown,
  ChevronUp,
  Zap,
  Info,
} from "lucide-react";
import {
  getAllPlugins,
  registerPlugin,
  updatePluginStatus,
  uninstallPlugin,
} from "@/lib/db";
import type { PluginRegistry } from "@/lib/types";
import { showToast } from "@/components/ui/Toast";

const STATUS_ICONS: Record<PluginRegistry["status"], typeof CheckCircle2> = {
  installed: Circle,
  active: CheckCircle2,
  disabled: PowerOff,
  error: XCircle,
};

const STATUS_COLORS: Record<PluginRegistry["status"], string> = {
  installed: "text-gray-400",
  active: "text-emerald-500",
  disabled: "text-amber-500",
  error: "text-red-500",
};

const STATUS_LABELS: Record<PluginRegistry["status"], string> = {
  installed: "已安装",
  active: "运行中",
  disabled: "已禁用",
  error: "错误",
};

function validatePluginCode(code: string): { valid: boolean; error?: string } {
  if (!code || typeof code !== "string") {
    return { valid: false, error: "插件代码不能为空" };
  }

  const trimmed = code.trim();
  if (!trimmed) {
    return { valid: false, error: "插件代码不能为空" };
  }

  if (trimmed.length > 50000) {
    return { valid: false, error: "插件代码过长（最大 50000 字符）" };
  }

  try {
    new Function(`"use strict";\n${trimmed}`);
  } catch {
    return { valid: false, error: "插件代码存在语法错误，请检查" };
  }

  return { valid: true };
}

export default function PluginsPage() {
  const [plugins, setPlugins] = useState<PluginRegistry[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [showInstall, setShowInstall] = useState(false);
  const [pluginCode, setPluginCode] = useState("");
  const [pluginName, setPluginName] = useState("");
  const [pluginDesc, setPluginDesc] = useState("");
  const [pluginVersion, setPluginVersion] = useState("1.0.0");
  const [isInstalling, setIsInstalling] = useState(false);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);

  const loadPlugins = useCallback(async () => {
    try {
      const all = await getAllPlugins();
      setPlugins(all);
    } catch {
      showToast({ message: "加载插件列表失败", type: "error", duration: 3000 });
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    const load = async () => { await loadPlugins(); };
    load();
  }, [loadPlugins]);

  async function handleInstall() {
    if (!pluginName.trim()) {
      showToast({ message: "请输入插件名称", type: "error", duration: 3000 });
      return;
    }

    const validation = validatePluginCode(pluginCode);
    if (!validation.valid) {
      showToast({
        message: validation.error || "插件代码无效",
        type: "error",
        duration: 3000,
      });
      return;
    }

    setIsInstalling(true);
    try {
      const id = crypto.randomUUID();
      await registerPlugin({
        id,
        name: pluginName.trim(),
        version: pluginVersion.trim() || "1.0.0",
        description: pluginDesc.trim() || undefined,
        status: "installed",
        config: { code: pluginCode.trim() },
      });

      showToast({ message: `插件 "${pluginName}" 安装成功`, type: "success", duration: 3000 });

      setPluginCode("");
      setPluginName("");
      setPluginDesc("");
      setPluginVersion("1.0.0");
      setShowInstall(false);
      await loadPlugins();
    } catch {
      showToast({ message: "插件安装失败，请重试", type: "error", duration: 3000 });
    } finally {
      setIsInstalling(false);
    }
  }

  async function handleToggleStatus(plugin: PluginRegistry) {
    const newStatus: PluginRegistry["status"] =
      plugin.status === "active" ? "disabled" : "active";

    try {
      await updatePluginStatus(plugin.id, newStatus);
      showToast({
        message: newStatus === "active" ? `"${plugin.name}" 已激活` : `"${plugin.name}" 已禁用`,
        type: "success",
        duration: 2000,
      });
      await loadPlugins();
    } catch {
      showToast({ message: "状态切换失败", type: "error", duration: 3000 });
    }
  }

  async function handleUninstall(pluginId: string) {
    try {
      await uninstallPlugin(pluginId);
      showToast({ message: "插件已卸载", type: "success", duration: 2000 });
      setConfirmDelete(null);
      await loadPlugins();
    } catch {
      showToast({ message: "卸载失败，请重试", type: "error", duration: 3000 });
    }
  }

  function toggleExpand(pluginId: string) {
    setExpandedId((prev) => (prev === pluginId ? null : pluginId));
  }

  return (
    <div className="flex-1 flex flex-col h-full bg-[var(--bg-primary)]">
      <div className="px-5 pt-6 pb-3 flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-[var(--text-primary)]">插件中心</h1>
          <p className="text-sm text-[var(--text-secondary)] mt-1">
            安装和管理 LifeFlow 插件
          </p>
        </div>
        <motion.button
          whileTap={{ scale: 0.95 }}
          onClick={() => setShowInstall(!showInstall)}
          className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-indigo-500 text-white text-sm font-medium hover:bg-indigo-600 transition-colors"
        >
          <Plus className="w-4 h-4" />
          <span>安装插件</span>
        </motion.button>
      </div>

      <div className="flex-1 overflow-y-auto px-5 pb-24 space-y-4">
        <AnimatePresence>
          {showInstall && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: "auto" }}
              exit={{ opacity: 0, height: 0 }}
              className="overflow-hidden"
            >
              <div className="rounded-2xl bg-[var(--bg-secondary)] p-5 space-y-4">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-violet-100 dark:bg-violet-900/30 flex items-center justify-center flex-shrink-0">
                    <Code2 className="w-5 h-5 text-violet-500" />
                  </div>
                  <div>
                    <h3 className="text-base font-semibold text-[var(--text-primary)]">
                      安装新插件
                    </h3>
                    <p className="text-sm text-[var(--text-secondary)]">
                      粘贴插件代码并填写基本信息
                    </p>
                  </div>
                </div>

                <div className="space-y-3">
                  <div>
                    <label className="block text-sm font-medium text-[var(--text-primary)] mb-1">
                      插件名称
                    </label>
                    <input
                      type="text"
                      value={pluginName}
                      onChange={(e) => setPluginName(e.target.value)}
                      placeholder="例如：番茄钟计时器"
                      className="w-full px-4 py-2.5 rounded-xl bg-[var(--bg-primary)] border border-[var(--card-border)] text-sm text-[var(--text-primary)] placeholder:text-[var(--text-secondary)] focus:outline-none focus:ring-2 focus:ring-indigo-500/30"
                    />
                  </div>

                  <div className="flex gap-3">
                    <div className="flex-1">
                      <label className="block text-sm font-medium text-[var(--text-primary)] mb-1">
                        版本号
                      </label>
                      <input
                        type="text"
                        value={pluginVersion}
                        onChange={(e) => setPluginVersion(e.target.value)}
                        placeholder="1.0.0"
                        className="w-full px-4 py-2.5 rounded-xl bg-[var(--bg-primary)] border border-[var(--card-border)] text-sm text-[var(--text-primary)] placeholder:text-[var(--text-secondary)] focus:outline-none focus:ring-2 focus:ring-indigo-500/30"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-[var(--text-primary)] mb-1">
                      描述（可选）
                    </label>
                    <input
                      type="text"
                      value={pluginDesc}
                      onChange={(e) => setPluginDesc(e.target.value)}
                      placeholder="简要描述插件功能"
                      className="w-full px-4 py-2.5 rounded-xl bg-[var(--bg-primary)] border border-[var(--card-border)] text-sm text-[var(--text-primary)] placeholder:text-[var(--text-secondary)] focus:outline-none focus:ring-2 focus:ring-indigo-500/30"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-[var(--text-primary)] mb-1">
                      插件代码
                    </label>
                    <textarea
                      value={pluginCode}
                      onChange={(e) => setPluginCode(e.target.value)}
                      placeholder={`// 插件代码示例\n// 导出一个 activate 函数\n\nexport function activate(api) {\n  api.log("插件已激活");\n  \n  api.registerNavItem({\n    id: "my-plugin",\n    label: "我的插件",\n    icon: "Puzzle",\n    path: "/plugins/my-plugin",\n  });\n}`}
                      rows={10}
                      className="w-full px-4 py-3 rounded-xl bg-[var(--bg-primary)] border border-[var(--card-border)] text-sm text-[var(--text-primary)] placeholder:text-[var(--text-secondary)] focus:outline-none focus:ring-2 focus:ring-indigo-500/30 font-mono resize-y"
                    />
                  </div>
                </div>

                <motion.button
                  whileTap={{ scale: 0.97 }}
                  onClick={handleInstall}
                  disabled={isInstalling}
                  className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl bg-violet-500 text-white text-sm font-medium hover:bg-violet-600 transition-colors disabled:opacity-50"
                >
                  <Zap className="w-4 h-4" />
                  {isInstalling ? "安装中..." : "安装插件"}
                </motion.button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {isLoading ? (
          <div className="flex items-center justify-center py-20">
            <div className="w-8 h-8 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin" />
          </div>
        ) : plugins.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 px-4 text-center">
            <div className="w-16 h-16 rounded-2xl bg-violet-50 dark:bg-violet-900/30 flex items-center justify-center mb-4">
              <Puzzle className="w-8 h-8 text-violet-400" />
            </div>
            <h3 className="text-lg font-semibold text-[var(--text-primary)] mb-1">
              暂无插件
            </h3>
            <p className="text-sm text-[var(--text-secondary)] max-w-xs mb-6">
              点击上方「安装插件」按钮，粘贴插件代码来安装你的第一个插件
            </p>
            <button
              onClick={() => setShowInstall(true)}
              className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-violet-500 text-white text-sm font-medium hover:bg-violet-600 transition-colors"
            >
              <Plus className="w-4 h-4" />
              安装插件
            </button>
          </div>
        ) : (
          plugins.map((plugin) => {
            const StatusIcon = STATUS_ICONS[plugin.status];
            const isExpanded = expandedId === plugin.id;

            return (
              <div
                key={plugin.id}
                className="rounded-2xl bg-[var(--bg-secondary)] overflow-hidden"
              >
                <div
                  className="p-5 cursor-pointer"
                  onClick={() => toggleExpand(plugin.id)}
                >
                  <div className="flex items-start gap-3">
                    <div className="w-10 h-10 rounded-xl bg-violet-100 dark:bg-violet-900/30 flex items-center justify-center flex-shrink-0">
                      <Puzzle className="w-5 h-5 text-violet-500" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <h3 className="text-base font-semibold text-[var(--text-primary)] truncate">
                          {plugin.name}
                        </h3>
                        <span className="text-xs text-[var(--text-secondary)]">
                          v{plugin.version}
                        </span>
                      </div>
                      {plugin.description && (
                        <p className="text-sm text-[var(--text-secondary)] mt-0.5 line-clamp-1">
                          {plugin.description}
                        </p>
                      )}
                      <div className="flex items-center gap-2 mt-2">
                        <StatusIcon className={`w-4 h-4 ${STATUS_COLORS[plugin.status]}`} />
                        <span className={`text-xs font-medium ${STATUS_COLORS[plugin.status]}`}>
                          {STATUS_LABELS[plugin.status]}
                        </span>
                      </div>
                    </div>
                    <div className="flex items-center gap-1">
                      <motion.button
                        whileTap={{ scale: 0.9 }}
                        onClick={(e) => {
                          e.stopPropagation();
                          handleToggleStatus(plugin);
                        }}
                        className="w-8 h-8 rounded-lg flex items-center justify-center hover:bg-[var(--bg-primary)] transition-colors"
                        aria-label={plugin.status === "active" ? "禁用插件" : "激活插件"}
                      >
                        <Power className={`w-4 h-4 ${plugin.status === "active" ? "text-amber-500" : "text-emerald-500"}`} />
                      </motion.button>
                      <motion.button
                        whileTap={{ scale: 0.9 }}
                        onClick={(e) => {
                          e.stopPropagation();
                          setConfirmDelete(plugin.id);
                        }}
                        className="w-8 h-8 rounded-lg flex items-center justify-center hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors"
                        aria-label="卸载插件"
                      >
                        <Trash2 className="w-4 h-4 text-red-400" />
                      </motion.button>
                      {isExpanded ? (
                        <ChevronUp className="w-4 h-4 text-[var(--text-secondary)]" />
                      ) : (
                        <ChevronDown className="w-4 h-4 text-[var(--text-secondary)]" />
                      )}
                    </div>
                  </div>
                </div>

                <AnimatePresence>
                  {isExpanded && (
                    <motion.div
                      initial={{ opacity: 0, height: 0 }}
                      animate={{ opacity: 1, height: "auto" }}
                      exit={{ opacity: 0, height: 0 }}
                      className="overflow-hidden"
                    >
                      <div className="px-5 pb-5 space-y-3 border-t border-[var(--card-border)] pt-4">
                        <div className="flex items-center gap-2 text-xs text-[var(--text-secondary)]">
                          <Info className="w-3.5 h-3.5" />
                          <span>ID: {plugin.id}</span>
                        </div>
                        <div className="flex items-center gap-2 text-xs text-[var(--text-secondary)]">
                          <Info className="w-3.5 h-3.5" />
                          <span>
                            安装时间: {new Date(plugin.installedAt).toLocaleString("zh-CN")}
                          </span>
                        </div>
                        <div className="flex items-center gap-2 text-xs text-[var(--text-secondary)]">
                          <Info className="w-3.5 h-3.5" />
                          <span>
                            更新时间: {new Date(plugin.updatedAt).toLocaleString("zh-CN")}
                          </span>
                        </div>

                        {typeof plugin.config?.code === "string" && plugin.config.code.length > 0 && (
                          <div>
                            <p className="text-xs font-medium text-[var(--text-secondary)] mb-1.5">
                              插件代码预览
                            </p>
                            <pre className="text-xs font-mono text-[var(--text-secondary)] bg-[var(--bg-primary)] rounded-xl p-3 overflow-x-auto max-h-48 overflow-y-auto">
                              {String(plugin.config.code)}
                            </pre>
                          </div>
                        )}
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            );
          })
        )}
      </div>

      <AnimatePresence>
        {confirmDelete && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-6"
            onClick={() => setConfirmDelete(null)}
          >
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              onClick={(e) => e.stopPropagation()}
              className="bg-[var(--bg-primary)] rounded-3xl p-6 max-w-sm w-full shadow-xl"
            >
              <div className="flex flex-col items-center text-center gap-3">
                <div className="w-12 h-12 rounded-full bg-red-100 dark:bg-red-900/30 flex items-center justify-center">
                  <AlertCircle className="w-6 h-6 text-red-500" />
                </div>
                <div>
                  <h3 className="text-lg font-semibold text-[var(--text-primary)]">
                    确认卸载插件
                  </h3>
                  <p className="text-sm text-[var(--text-secondary)] mt-1">
                    卸载后插件将被永久删除，此操作不可撤销。确定要继续吗？
                  </p>
                </div>

                <div className="flex gap-3 w-full mt-1">
                  <button
                    onClick={() => setConfirmDelete(null)}
                    className="flex-1 px-4 py-2.5 rounded-xl text-sm font-medium border border-[var(--card-border)] text-[var(--text-primary)] hover:bg-[var(--bg-secondary)] transition-colors"
                  >
                    取消
                  </button>
                  <motion.button
                    whileTap={{ scale: 0.97 }}
                    onClick={() => handleUninstall(confirmDelete)}
                    className="flex-1 px-4 py-2.5 rounded-xl text-sm font-medium bg-red-500 text-white hover:bg-red-600 transition-colors"
                  >
                    确认卸载
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
