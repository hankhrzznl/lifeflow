"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Key, Download, Upload, Trash2, Eye, EyeOff, AlertTriangle,
  LayoutGrid, Plus, Pencil, X,
} from "lucide-react";
import { exportAllData, importAllData } from "@/lib/db";
import {
  getAllSubmodules, addSubmodule, updateSubmodule, deleteSubmodule,
  toggleSubmodule, initializeSubmodules, getProjectsWithSubmodules,
} from "@/lib/db";
import type { Submodule, ProjectV2 } from "@/lib/types";
import { showToast } from "@/components/ui/Toast";

const API_KEY_STORAGE_KEY = "lifeflow_api_key";

interface EditModalData {
  id?: number;
  projectId: number;
  name: string;
  description: string;
  enabled: boolean;
  order: number;
}

const EMPTY_FORM: EditModalData = {
  projectId: 0,
  name: "",
  description: "",
  enabled: true,
  order: 99,
};

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

  // ---- 模块管理 ----
  const [modules, setModules] = useState<Submodule[]>([]);
  const [projects, setProjects] = useState<ProjectV2[]>([]);
  const [modulesLoading, setModulesLoading] = useState(true);
  const [selectedProjectId, setSelectedProjectId] = useState<number | null>(null);
  const [showModal, setShowModal] = useState(false);
  const [showDeleteConfirm2, setShowDeleteConfirm2] = useState<number | null>(null);
  const [formData, setFormData] = useState<EditModalData>(EMPTY_FORM);

  const loadModules = useCallback(async () => {
    await initializeSubmodules();
    const projList = await getProjectsWithSubmodules();
    setProjects(projList);
    if (projList.length > 0 && selectedProjectId === null) {
      setSelectedProjectId(projList[0].id!);
    }
    const list = await getAllSubmodules();
    setModules(list);
    setModulesLoading(false);
  }, [selectedProjectId]);

  useEffect(() => { loadModules(); }, [loadModules]);

  const filteredModules = modules.filter((m) => m.projectId === selectedProjectId);

  const openCreate = () => {
    setFormData({ ...EMPTY_FORM, projectId: selectedProjectId ?? projects[0]?.id ?? 0 });
    setShowModal(true);
  };

  const openEdit = (s: Submodule) => {
    setFormData({
      id: s.id,
      projectId: s.projectId,
      name: s.name,
      description: s.description,
      enabled: s.enabled,
      order: s.order,
    });
    setShowModal(true);
  };

  const handleSave = async () => {
    if (!formData.name.trim()) return;
    if (formData.id) {
      await updateSubmodule(formData.id, formData);
    } else {
      await addSubmodule(formData);
    }
    setShowModal(false);
    await loadModules();
  };

  const handleDelete = async (id: number) => {
    await deleteSubmodule(id);
    setShowDeleteConfirm2(null);
    await loadModules();
  };

  const handleToggle = async (id: number) => {
    await toggleSubmodule(id);
    await loadModules();
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
      const data = await exportAllData();
      const json = JSON.stringify(data, null, 2);
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

  function handleFileSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      try {
        const text = ev.target?.result as string;
        const parsed = JSON.parse(text);
        if (!parsed.data || !parsed.exportedAt) {
          showToast({ message: "无效的备份文件格式", type: "error", duration: 3000 });
          return;
        }
        setImportFile({ name: file.name, data: text, exportedAt: parsed.exportedAt });
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
          API 密钥、模块管理与数据管理
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

        {/* === 模块管理（内联） === */}
        <div className="bg-white dark:bg-gray-900 rounded-2xl p-5 border border-gray-100 dark:border-gray-800">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-start gap-3">
              <div className="w-10 h-10 rounded-xl bg-gray-100 dark:bg-gray-800 flex items-center justify-center flex-shrink-0">
                <LayoutGrid className="w-5 h-5 text-gray-700 dark:text-gray-300" />
              </div>
              <div>
                <h3 className="text-base font-semibold text-gray-900 dark:text-white">模块管理</h3>
                <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5">
                  管理每个项目下的子模块
                </p>
              </div>
            </div>
            <motion.button whileTap={{ scale: 0.95 }} onClick={openCreate}
              disabled={!selectedProjectId}
              className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-gray-900 text-white text-sm font-medium hover:bg-gray-800 dark:bg-white dark:text-gray-900 dark:hover:bg-gray-100 transition-colors flex-shrink-0 disabled:opacity-50">
              <Plus className="w-4 h-4" />
              添加
            </motion.button>
          </div>

          {/* 项目选择 */}
          {projects.length > 0 && (
            <div className="flex gap-2 overflow-x-auto pb-2 mb-3 scrollbar-hide">
              {projects.map((proj) => (
                <button
                  key={proj.id}
                  onClick={() => setSelectedProjectId(proj.id!)}
                  className={`shrink-0 px-3 py-1.5 text-xs font-medium rounded-lg transition-all ${
                    selectedProjectId === proj.id
                      ? "bg-gray-900 text-white dark:bg-white dark:text-gray-900"
                      : "bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-700"
                  }`}
                >
                  {proj.name}
                </button>
              ))}
            </div>
          )}

          {modulesLoading ? (
            <div className="space-y-2">
              {[1,2,3].map(i => (
                <div key={i} className="skeleton h-16 rounded-2xl" />
              ))}
            </div>
          ) : projects.length === 0 ? (
            <p className="text-center text-sm text-gray-400 py-4">
              暂无项目，请先在规划页创建项目
            </p>
          ) : filteredModules.length === 0 ? (
            <p className="text-center text-sm text-gray-400 py-4">
              该项目下暂无子模块，点击"添加"创建
            </p>
          ) : (
            <div className="space-y-1.5">
              {filteredModules.map((mod) => (
                <div key={mod.id}
                  className={`bg-gray-50 dark:bg-gray-800/50 rounded-xl p-3 flex items-center gap-3 transition-opacity ${mod.enabled ? "" : "opacity-40"}`}>
                  <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-gray-400 to-gray-500 flex items-center justify-center flex-shrink-0">
                    <LayoutGrid className="w-5 h-5 text-white" strokeWidth={1.6} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <h4 className="text-sm font-medium text-gray-900 dark:text-white">{mod.name}</h4>
                    <p className="text-xs text-gray-400 truncate">{mod.description || "无描述"}</p>
                  </div>
                  <div className="flex items-center gap-0.5">
                    <button onClick={() => handleToggle(mod.id!)}
                      className={`relative w-9 h-5 rounded-full transition-colors ${mod.enabled ? "bg-gray-900 dark:bg-white" : "bg-gray-300 dark:bg-gray-600"}`}>
                      <motion.div className="absolute top-0.5 w-4 h-4 rounded-full bg-white shadow"
                        animate={{ left: mod.enabled ? 16 : 1 }}
                        transition={{ type: "spring", stiffness: 500, damping: 30 }} />
                    </button>
                    <button onClick={() => openEdit(mod)}
                      className="w-7 h-7 flex items-center justify-center rounded-lg hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors">
                      <Pencil className="w-3.5 h-3.5 text-gray-400" />
                    </button>
                    <button onClick={() => setShowDeleteConfirm2(mod.id!)}
                      className="w-7 h-7 flex items-center justify-center rounded-lg hover:bg-red-100 dark:hover:bg-red-900/20 transition-colors">
                      <Trash2 className="w-3.5 h-3.5 text-red-400" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

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

      {/* ==================== 模块编辑弹窗 ==================== */}
      <AnimatePresence>
        {showModal && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-start justify-center bg-black/40 pt-[10vh] px-4 overflow-y-auto"
            onClick={() => setShowModal(false)}>
            <motion.div initial={{ scale: 0.95, opacity: 0, y: 20 }} animate={{ scale: 1, opacity: 1, y: 0 }} exit={{ scale: 0.95, opacity: 0, y: 20 }}
              onClick={(e) => e.stopPropagation()}
              className="bg-white dark:bg-gray-900 rounded-3xl p-6 max-w-md w-full shadow-xl max-h-[80vh] overflow-y-auto">
              <div className="flex items-center justify-between mb-5">
                <h2 className="text-lg font-bold text-gray-900 dark:text-white">
                  {formData.id ? "编辑模块" : "添加子模块"}
                </h2>
                <button onClick={() => setShowModal(false)} className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800">
                  <X className="w-5 h-5 text-gray-400" />
                </button>
              </div>
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">所属项目</label>
                  <select
                    value={formData.projectId}
                    onChange={(e) => setFormData((p) => ({ ...p, projectId: Number(e.target.value) }))}
                    className="w-full px-4 py-2.5 rounded-xl bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 text-sm text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-gray-900/20"
                  >
                    {projects.map((p) => (
                      <option key={p.id} value={p.id}>{p.name}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">名称</label>
                  <input value={formData.name} onChange={(e) => setFormData((p) => ({ ...p, name: e.target.value }))}
                    placeholder="例如：行测刷题"
                    className="w-full px-4 py-2.5 rounded-xl bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 text-sm text-gray-900 dark:text-white placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-gray-900/20" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">描述</label>
                  <input value={formData.description} onChange={(e) => setFormData((p) => ({ ...p, description: e.target.value }))}
                    placeholder="简短的描述文字"
                    className="w-full px-4 py-2.5 rounded-xl bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 text-sm text-gray-900 dark:text-white placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-gray-900/20" />
                </div>
              </div>
              <div className="flex gap-3 mt-6">
                <button onClick={() => setShowModal(false)}
                  className="flex-1 py-2.5 rounded-xl border border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-400 text-sm font-medium hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors">取消</button>
                <motion.button whileTap={{ scale: 0.97 }} onClick={handleSave}
                  className="flex-1 py-2.5 rounded-xl bg-gray-900 text-white text-sm font-medium hover:bg-gray-800 dark:bg-white dark:text-gray-900 dark:hover:bg-gray-100 transition-colors">
                  {formData.id ? "保存" : "添加"}
                </motion.button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ==================== 模块删除确认弹窗 ==================== */}
      <AnimatePresence>
        {showDeleteConfirm2 !== null && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-6"
            onClick={() => setShowDeleteConfirm2(null)}>
            <motion.div initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.9, opacity: 0 }}
              onClick={(e) => e.stopPropagation()}
              className="bg-white dark:bg-gray-900 rounded-3xl p-6 max-w-sm w-full shadow-xl">
              <div className="flex flex-col items-center text-center gap-3">
                <div className="w-12 h-12 rounded-full bg-red-100 dark:bg-red-900/30 flex items-center justify-center">
                  <Trash2 className="w-6 h-6 text-red-500" />
                </div>
                <div>
                  <h3 className="text-lg font-semibold text-gray-900 dark:text-white">确认删除</h3>
                  <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">此操作将永久删除该子模块，不可撤销。</p>
                </div>
                <div className="flex gap-3 w-full mt-1">
                  <button onClick={() => setShowDeleteConfirm2(null)}
                    className="flex-1 px-4 py-2.5 rounded-xl text-sm font-medium border border-gray-200 dark:border-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors">取消</button>
                  <motion.button whileTap={{ scale: 0.97 }} onClick={() => handleDelete(showDeleteConfirm2)}
                    className="flex-1 px-4 py-2.5 rounded-xl text-sm font-medium bg-red-500 text-white hover:bg-red-600 transition-colors">确认删除</motion.button>
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

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
    </div>
  );
}
