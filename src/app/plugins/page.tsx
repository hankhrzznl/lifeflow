"use client";

import { useState, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useRouter } from "next/navigation";
import { Puzzle, Power, PowerOff, Trash2, Plus, Code2, Info, RotateCcw, ExternalLink } from "lucide-react";
import { initBuiltInPlugins, getAllPluginsMeta, updatePluginMetaStatus } from "@/lib/db";
import { showToast } from "@/components/ui/Toast";
import type { PluginMetadata } from "@/lib/types";

function validatePluginCode(code: string): { valid: boolean; error?: string } {
  if (!code || typeof code !== "string" || !code.trim()) {
    return { valid: false, error: "插件代码不能为空" };
  }
  if (code.trim().length > 50000) {
    return { valid: false, error: "插件代码过长（最大 50000 字符）" };
  }
  try {
    new Function(`"use strict";\n${code.trim()}`);
  } catch {
    return { valid: false, error: "插件代码存在语法错误，请检查" };
  }
  return { valid: true };
}

export default function PluginsPage() {
  const router = useRouter();
  const [builtIn, setBuiltIn] = useState<PluginMetadata[]>([]);
  const [thirdParty, setThirdParty] = useState<PluginMetadata[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showInstall, setShowInstall] = useState(false);
  const [pluginCode, setPluginCode] = useState("");
  const [pluginName, setPluginName] = useState("");
  const [pluginDesc, setPluginDesc] = useState("");
  const [pluginVersion, setPluginVersion] = useState("1.0.0");
  const [isInstalling, setIsInstalling] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState<number | null>(null);

  const loadPlugins = useCallback(async () => {
    try {
      await initBuiltInPlugins();
      const all = await getAllPluginsMeta();
      setBuiltIn(all.filter((p) => p.isBuiltIn));
      setThirdParty(all.filter((p) => !p.isBuiltIn));
      setError(null);
    } catch {
      setError("加载插件列表失败，请重试");
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    const load = async () => { await loadPlugins(); };
    load();
  }, [loadPlugins]);

  async function handleToggleStatus(plugin: PluginMetadata) {
    if (plugin.id == null) return;
    const newStatus: PluginMetadata["status"] =
      plugin.status === "active" ? "disabled" : "active";
    try {
      await updatePluginMetaStatus(plugin.id, newStatus);
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

  async function handleUninstall(pluginId: number) {
    try {
      const { db } = await import("@/lib/db");
      await db.pluginsMeta.delete(pluginId);
      showToast({ message: "插件已卸载", type: "success", duration: 2000 });
      setConfirmDelete(null);
      await loadPlugins();
    } catch {
      showToast({ message: "卸载失败，请重试", type: "error", duration: 3000 });
    }
  }

  async function handleInstall() {
    if (!pluginName.trim()) {
      showToast({ message: "请输入插件名称", type: "error", duration: 3000 });
      return;
    }

    const validation = validatePluginCode(pluginCode);
    if (!validation.valid) {
      showToast({ message: validation.error || "插件代码无效", type: "error", duration: 3000 });
      return;
    }

    setIsInstalling(true);
    try {
      const { db } = await import("@/lib/db");
      await db.pluginsMeta.add({
        name: pluginName.trim(),
        version: pluginVersion.trim() || "1.0.0",
        description: pluginDesc.trim() || undefined,
        status: "installed",
        isBuiltIn: false,
        code: pluginCode.trim(),
        installedAt: Date.now(),
        updatedAt: Date.now(),
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

  function getPluginPath(name: string): string | null {
    const paths: Record<string, string> = {
      timeline: "/plugins/timeline",
      "focus-timer": "/plugins/focus-timer",
      finance: "/plugins/finance",
    };
    return paths[name] || null;
  }

  function renderPluginCard(plugin: PluginMetadata) {
    const isActive = plugin.status === "active";
    const pluginPath = getPluginPath(plugin.name);

    return (
      <div key={plugin.id} className="bg-white dark:bg-gray-900 rounded-2xl p-5 border border-gray-100 dark:border-gray-800">
        <div className="flex items-start gap-3">
          <div className="w-10 h-10 rounded-xl bg-violet-100 dark:bg-violet-900/30 flex items-center justify-center flex-shrink-0">
            <Puzzle className="w-5 h-5 text-violet-500" />
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <h3 className="text-base font-semibold text-gray-900 dark:text-white truncate">
                {plugin.name}
              </h3>
              <span className="text-xs text-gray-400 dark:text-gray-500">v{plugin.version}</span>
            </div>
            {plugin.description && (
              <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5 line-clamp-1">
                {plugin.description}
              </p>
            )}
            <div className="flex items-center gap-3 mt-2">
              <span
                className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${
                  isActive
                    ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400"
                    : plugin.status === "error"
                      ? "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400"
                      : "bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400"
                }`}
              >
                <span
                  className={`w-1.5 h-1.5 rounded-full ${
                    isActive ? "bg-emerald-500" : plugin.status === "error" ? "bg-red-500" : "bg-gray-400"
                  }`}
                />
                {plugin.status === "active"
                  ? "运行中"
                  : plugin.status === "error"
                    ? "错误"
                    : plugin.status === "disabled"
                      ? "已禁用"
                      : "已安装"}
              </span>
            </div>
          </div>
          <div className="flex items-center gap-1 flex-shrink-0">
            {pluginPath && (
              <motion.button
                whileTap={{ scale: 0.9 }}
                onClick={() => router.push(pluginPath)}
                className="w-8 h-8 rounded-lg flex items-center justify-center hover:bg-blue-50 dark:hover:bg-blue-900/20 text-blue-500 transition-colors"
                aria-label={`打开 ${plugin.name}`}
              >
                <ExternalLink className="w-4 h-4" />
              </motion.button>
            )}
            <motion.button
              whileTap={{ scale: 0.9 }}
              onClick={() => handleToggleStatus(plugin)}
              className={`w-8 h-8 rounded-lg flex items-center justify-center transition-colors ${
                isActive
                  ? "hover:bg-amber-50 dark:hover:bg-amber-900/20 text-amber-500"
                  : "hover:bg-emerald-50 dark:hover:bg-emerald-900/20 text-emerald-500"
              }`}
              aria-label={isActive ? "禁用插件" : "激活插件"}
            >
              {isActive ? <PowerOff className="w-4 h-4" /> : <Power className="w-4 h-4" />}
            </motion.button>
            {!plugin.isBuiltIn && (
              <motion.button
                whileTap={{ scale: 0.9 }}
                onClick={() => plugin.id != null && setConfirmDelete(plugin.id)}
                className="w-8 h-8 rounded-lg flex items-center justify-center hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors"
                aria-label="卸载插件"
              >
                <Trash2 className="w-4 h-4 text-red-400" />
              </motion.button>
            )}
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex-1 flex flex-col h-full bg-gray-50 dark:bg-gray-950">
        <div className="px-5 pt-6 pb-3">
          <h1 className="text-xl font-bold text-gray-900 dark:text-white">插件中心</h1>
        </div>
        <div className="flex-1 flex items-center justify-center px-5">
          <div className="flex flex-col items-center gap-3 text-center">
            <Info className="w-10 h-10 text-red-400" />
            <p className="text-sm text-red-500">{error}</p>
            <motion.button
              whileTap={{ scale: 0.97 }}
              onClick={() => {
                setIsLoading(true);
                setError(null);
                loadPlugins();
              }}
              className="flex items-center gap-2 px-4 py-2 rounded-xl bg-indigo-500 text-white text-sm font-medium"
            >
              <RotateCcw className="w-4 h-4" />
              重试
            </motion.button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 flex flex-col h-full bg-gray-50 dark:bg-gray-950">
      <div className="px-5 pt-6 pb-3 flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-gray-900 dark:text-white">插件中心</h1>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
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

      <div className="flex-1 overflow-y-auto px-5 pb-24 space-y-5">
        <AnimatePresence>
          {showInstall && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: "auto" }}
              exit={{ opacity: 0, height: 0 }}
              className="overflow-hidden"
            >
              <div className="bg-white dark:bg-gray-900 rounded-2xl p-5 border border-gray-100 dark:border-gray-800 space-y-4">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-violet-100 dark:bg-violet-900/30 flex items-center justify-center flex-shrink-0">
                    <Code2 className="w-5 h-5 text-violet-500" />
                  </div>
                  <div>
                    <h3 className="text-base font-semibold text-gray-900 dark:text-white">
                      安装新插件
                    </h3>
                    <p className="text-sm text-gray-500 dark:text-gray-400">
                      粘贴插件代码并填写基本信息
                    </p>
                  </div>
                </div>

                <div className="space-y-3">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                      插件名称
                    </label>
                    <input
                      type="text"
                      value={pluginName}
                      onChange={(e) => setPluginName(e.target.value)}
                      placeholder="例如：番茄钟计时器"
                      className="w-full px-4 py-2.5 rounded-xl bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 text-sm text-gray-900 dark:text-white placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-indigo-500/30"
                    />
                  </div>

                  <div className="flex gap-3">
                    <div className="flex-1">
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                        版本号
                      </label>
                      <input
                        type="text"
                        value={pluginVersion}
                        onChange={(e) => setPluginVersion(e.target.value)}
                        placeholder="1.0.0"
                        className="w-full px-4 py-2.5 rounded-xl bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 text-sm text-gray-900 dark:text-white placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-indigo-500/30"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                      描述（可选）
                    </label>
                    <input
                      type="text"
                      value={pluginDesc}
                      onChange={(e) => setPluginDesc(e.target.value)}
                      placeholder="简要描述插件功能"
                      className="w-full px-4 py-2.5 rounded-xl bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 text-sm text-gray-900 dark:text-white placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-indigo-500/30"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                      插件代码
                    </label>
                    <textarea
                      value={pluginCode}
                      onChange={(e) => setPluginCode(e.target.value)}
                      placeholder={`// 插件代码示例\n// 导出一个 activate 函数\n\nexport function activate(api) {\n  api.log("插件已激活");\n}`}
                      rows={10}
                      className="w-full px-4 py-3 rounded-xl bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 text-sm text-gray-900 dark:text-white placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-indigo-500/30 font-mono resize-y"
                    />
                  </div>
                </div>

                <motion.button
                  whileTap={{ scale: 0.97 }}
                  onClick={handleInstall}
                  disabled={isInstalling}
                  className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl bg-violet-500 text-white text-sm font-medium hover:bg-violet-600 transition-colors disabled:opacity-50"
                >
                  <Plus className="w-4 h-4" />
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
        ) : builtIn.length === 0 && thirdParty.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 px-4 text-center">
            <div className="w-16 h-16 rounded-2xl bg-violet-50 dark:bg-violet-900/30 flex items-center justify-center mb-4">
              <Puzzle className="w-8 h-8 text-violet-400" />
            </div>
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-1">
              暂无插件
            </h3>
            <p className="text-sm text-gray-500 dark:text-gray-400 max-w-xs mb-6">
              点击上方「安装插件」按钮来安装你的第一个插件
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
          <>
            {builtIn.length > 0 && (
              <div>
                <h2 className="text-sm font-semibold text-gray-400 dark:text-gray-500 uppercase tracking-wide mb-3 px-1">
                  预置插件
                </h2>
                <div className="space-y-3">
                  {builtIn.map(renderPluginCard)}
                </div>
              </div>
            )}

            {thirdParty.length > 0 && (
              <div>
                <h2 className="text-sm font-semibold text-gray-400 dark:text-gray-500 uppercase tracking-wide mb-3 px-1">
                  第三方插件
                </h2>
                <div className="space-y-3">
                  {thirdParty.map(renderPluginCard)}
                </div>
              </div>
            )}
          </>
        )}
      </div>

      <AnimatePresence>
        {confirmDelete != null && (
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
              className="bg-white dark:bg-gray-900 rounded-3xl p-6 max-w-sm w-full shadow-xl"
            >
              <div className="flex flex-col items-center text-center gap-3">
                <div className="w-12 h-12 rounded-full bg-red-100 dark:bg-red-900/30 flex items-center justify-center">
                  <Trash2 className="w-6 h-6 text-red-500" />
                </div>
                <div>
                  <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
                    确认卸载插件
                  </h3>
                  <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                    卸载后插件将被永久删除，此操作不可撤销。确定要继续吗？
                  </p>
                </div>

                <div className="flex gap-3 w-full mt-1">
                  <button
                    onClick={() => setConfirmDelete(null)}
                    className="flex-1 px-4 py-2.5 rounded-xl text-sm font-medium border border-gray-200 dark:border-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors"
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
