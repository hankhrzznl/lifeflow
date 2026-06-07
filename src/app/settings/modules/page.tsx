"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import {
  GraduationCap, BookOpen, Moon, Sparkles, Dumbbell,
  Target, Sprout, Repeat, Plus, Trash2, Pencil, X, Check,
  LayoutGrid, ArrowLeft,
} from "lucide-react";
import {
  getAllSubmodules, addSubmodule, updateSubmodule, deleteSubmodule,
  toggleSubmodule, initializeSubmodules,
} from "@/lib/db";
import type { Submodule, ParentModuleKey } from "@/lib/types";
import { PARENT_MODULE_LABELS, AVAILABLE_ICONS, ICON_GRADIENTS } from "@/lib/types";

const ICON_MAP: Record<string, React.ComponentType<{ className?: string; strokeWidth?: number }>> = {
  GraduationCap, BookOpen, Moon, Sparkles, Dumbbell,
  Target, Sprout, Repeat, LayoutGrid,
};

const PARENT_COLORS: Record<ParentModuleKey, string> = {
  learning: "text-indigo-500 bg-indigo-50 dark:bg-indigo-900/20",
  health: "text-emerald-500 bg-emerald-50 dark:bg-emerald-900/20",
  growth: "text-rose-500 bg-rose-50 dark:bg-rose-900/20",
};

interface EditModalData {
  id?: number;
  parentKey: ParentModuleKey;
  name: string;
  description: string;
  icon: string;
  from: string;
  via: string;
  to: string;
  href: string;
  enabled: boolean;
  order: number;
}

const EMPTY_FORM: EditModalData = {
  parentKey: "learning",
  name: "",
  description: "",
  icon: "Target",
  from: "from-indigo-400",
  via: "via-violet-400",
  to: "to-purple-500",
  href: "",
  enabled: true,
  order: 99,
};

export default function ModulesManagePage() {
  const router = useRouter();
  const [modules, setModules] = useState<Submodule[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState<number | null>(null);
  const [formData, setFormData] = useState<EditModalData>(EMPTY_FORM);
  const [selectedGradient, setSelectedGradient] = useState(0);

  const load = useCallback(async () => {
    await initializeSubmodules();
    const list = await getAllSubmodules();
    setModules(list);
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  const openCreate = () => {
    setFormData(EMPTY_FORM);
    setSelectedGradient(0);
    setShowModal(true);
  };

  const openEdit = (s: Submodule) => {
    setFormData({
      id: s.id,
      parentKey: s.parentKey,
      name: s.name,
      description: s.description,
      icon: s.icon,
      from: s.from,
      via: s.via,
      to: s.to,
      href: s.href,
      enabled: s.enabled,
      order: s.order,
    });
    const idx = ICON_GRADIENTS.findIndex(
      (g) => g.from === s.from && g.via === s.via && g.to === s.to
    );
    setSelectedGradient(idx >= 0 ? idx : 0);
    setShowModal(true);
  };

  const handleSave = async () => {
    if (!formData.name.trim() || !formData.href.trim()) return;
    if (formData.id) {
      await updateSubmodule(formData.id, formData);
    } else {
      await addSubmodule(formData);
    }
    setShowModal(false);
    await load();
  };

  const handleDelete = async (id: number) => {
    await deleteSubmodule(id);
    setShowDeleteConfirm(null);
    await load();
  };

  const handleToggle = async (id: number) => {
    await toggleSubmodule(id);
    await load();
  };

  const applyGradient = (idx: number) => {
    const g = ICON_GRADIENTS[idx];
    setFormData((prev) => ({ ...prev, from: g.from, via: g.via, to: g.to }));
    setSelectedGradient(idx);
  };

  const grouped = modules.reduce((acc, m) => {
    if (!acc[m.parentKey]) acc[m.parentKey] = [];
    acc[m.parentKey].push(m);
    return acc;
  }, {} as Record<string, Submodule[]>);

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-950 flex items-center justify-center">
        <div className="skeleton w-64 h-48 rounded-3xl" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-950">
      <div className="mx-auto max-w-3xl px-5 pt-6 pb-24">
        <div className="flex items-center justify-between mb-6">
          <div>
            <button
              onClick={() => router.push("/settings")}
              className="text-sm text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-colors mb-2 flex items-center gap-1"
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              返回设置
            </button>
            <h1 className="text-xl font-bold text-gray-900 dark:text-white">模块管理</h1>
            <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
              管理主页下各分类的子模块卡片
            </p>
          </div>
          <motion.button
            whileTap={{ scale: 0.95 }}
            onClick={openCreate}
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-purple-500 text-white text-sm font-medium hover:bg-purple-600 transition-colors"
          >
            <Plus className="w-4 h-4" />
            添加
          </motion.button>
        </div>

        {Object.entries(grouped).map(([key, items]) => (
          <div key={key} className="mb-5">
            <div className="flex items-center gap-2 mb-3">
              <span className={`px-2.5 py-0.5 rounded-lg text-xs font-semibold ${PARENT_COLORS[key as ParentModuleKey]}`}>
                {PARENT_MODULE_LABELS[key as ParentModuleKey]}
              </span>
              <span className="text-xs text-gray-400">{items.length} 个子模块</span>
            </div>

            <div className="space-y-2">
              {items.map((mod) => {
                const Icon = ICON_MAP[mod.icon] || LayoutGrid;
                return (
                  <div
                    key={mod.id}
                    className={`bg-white dark:bg-gray-900 rounded-2xl p-4 border border-gray-100 dark:border-gray-800 flex items-center gap-4 transition-opacity ${mod.enabled ? "" : "opacity-40"}`}
                  >
                    <div className={`w-12 h-12 rounded-2xl bg-gradient-to-br ${mod.from} ${mod.via} ${mod.to} flex items-center justify-center flex-shrink-0`}>
                      <Icon className="w-6 h-6 text-white" strokeWidth={1.8} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <h3 className="text-sm font-semibold text-gray-900 dark:text-white">{mod.name}</h3>
                      <p className="text-xs text-gray-500 dark:text-gray-400 truncate">{mod.description}</p>
                      <p className="text-[10px] text-gray-400 mt-0.5">{mod.href}</p>
                    </div>
                    <div className="flex items-center gap-1">
                      <button
                        onClick={() => handleToggle(mod.id!)}
                        className={`relative w-10 h-6 rounded-full transition-colors ${mod.enabled ? "bg-purple-500" : "bg-gray-300 dark:bg-gray-600"}`}
                      >
                        <motion.div
                          className="absolute top-0.5 w-5 h-5 rounded-full bg-white shadow"
                          animate={{ left: mod.enabled ? 18 : 2 }}
                          transition={{ type: "spring", stiffness: 500, damping: 30 }}
                        />
                      </button>
                      <button
                        onClick={() => openEdit(mod)}
                        className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
                      >
                        <Pencil className="w-4 h-4 text-gray-400" />
                      </button>
                      <button
                        onClick={() => setShowDeleteConfirm(mod.id!)}
                        className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors"
                      >
                        <Trash2 className="w-4 h-4 text-red-400" />
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        ))}

        <p className="text-center text-sm text-gray-400 mt-8">
          添加自定义子模块，自由构建你的管理系统
        </p>
      </div>

      {/* Edit/Create Modal */}
      <AnimatePresence>
        {showModal && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-start justify-center bg-black/40 pt-[10vh] px-4 overflow-y-auto"
            onClick={() => setShowModal(false)}
          >
            <motion.div
              initial={{ scale: 0.95, opacity: 0, y: 20 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.95, opacity: 0, y: 20 }}
              onClick={(e) => e.stopPropagation()}
              className="bg-white dark:bg-gray-900 rounded-3xl p-6 max-w-md w-full shadow-xl max-h-[80vh] overflow-y-auto"
            >
              <div className="flex items-center justify-between mb-5">
                <h2 className="text-lg font-bold text-gray-900 dark:text-white">
                  {formData.id ? "编辑模块" : "添加子模块"}
                </h2>
                <button
                  onClick={() => setShowModal(false)}
                  className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800"
                >
                  <X className="w-5 h-5 text-gray-400" />
                </button>
              </div>

              <div className="space-y-4">
                {/* 名称 */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">名称</label>
                  <input
                    value={formData.name}
                    onChange={(e) => setFormData((p) => ({ ...p, name: e.target.value }))}
                    placeholder="例如：毕业"
                    className="w-full px-4 py-2.5 rounded-xl bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 text-sm text-gray-900 dark:text-white placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-purple-500/30"
                  />
                </div>

                {/* 描述 */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">描述</label>
                  <input
                    value={formData.description}
                    onChange={(e) => setFormData((p) => ({ ...p, description: e.target.value }))}
                    placeholder="简短的描述文字"
                    className="w-full px-4 py-2.5 rounded-xl bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 text-sm text-gray-900 dark:text-white placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-purple-500/30"
                  />
                </div>

                {/* 父模块 */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">所属分类</label>
                  <div className="flex gap-2">
                    {(Object.keys(PARENT_MODULE_LABELS) as ParentModuleKey[]).map((key) => (
                      <button
                        key={key}
                        onClick={() => setFormData((p) => ({ ...p, parentKey: key }))}
                        className={`flex-1 py-2 px-3 rounded-xl text-sm font-medium transition-colors ${
                          formData.parentKey === key
                            ? `${PARENT_COLORS[key]} border-2 border-current`
                            : "bg-gray-50 dark:bg-gray-800 text-gray-500 border-2 border-transparent"
                        }`}
                      >
                        {PARENT_MODULE_LABELS[key]}
                      </button>
                    ))}
                  </div>
                </div>

                {/* 图标 */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">图标</label>
                  <div className="flex flex-wrap gap-2 max-h-28 overflow-y-auto">
                    {AVAILABLE_ICONS.map((name) => {
                      const Icon = ICON_MAP[name] || LayoutGrid;
                      return (
                        <button
                          key={name}
                          onClick={() => setFormData((p) => ({ ...p, icon: name }))}
                          className={`w-10 h-10 rounded-xl flex items-center justify-center transition-colors ${
                            formData.icon === name
                              ? "bg-purple-100 dark:bg-purple-900/30 text-purple-600 ring-2 ring-purple-400"
                              : "bg-gray-50 dark:bg-gray-800 text-gray-400 hover:text-gray-600"
                          }`}
                        >
                          <Icon className="w-5 h-5" strokeWidth={1.5} />
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* 渐变色 */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">卡片颜色</label>
                  <div className="flex flex-wrap gap-2">
                    {ICON_GRADIENTS.map((g, i) => (
                      <button
                        key={i}
                        onClick={() => applyGradient(i)}
                        className={`w-10 h-10 rounded-2xl bg-gradient-to-br ${g.from} ${g.via} ${g.to} transition-transform ${
                          selectedGradient === i ? "scale-110 ring-2 ring-offset-2 ring-purple-400" : ""
                        }`}
                      />
                    ))}
                  </div>
                </div>

                {/* 跳转路径 */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">跳转路径</label>
                  <input
                    value={formData.href}
                    onChange={(e) => setFormData((p) => ({ ...p, href: e.target.value }))}
                    placeholder="/example"
                    className="w-full px-4 py-2.5 rounded-xl bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 text-sm text-gray-900 dark:text-white placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-purple-500/30"
                  />
                </div>

                {/* Preview */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">预览</label>
                  <div className={`rounded-2xl bg-gradient-to-br ${formData.from} ${formData.via} ${formData.to} p-4 text-white`}>
                    <div className="flex items-center gap-3">
                      {(() => { const Icon = ICON_MAP[formData.icon] || LayoutGrid; return <Icon className="w-6 h-6" strokeWidth={1.5} />; })()}
                      <div>
                        <p className="font-bold text-sm">{formData.name || "未命名"}</p>
                        <p className="text-xs text-white/70">{formData.description || "无描述"}</p>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              <div className="flex gap-3 mt-6">
                <button
                  onClick={() => setShowModal(false)}
                  className="flex-1 py-2.5 rounded-xl border border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-400 text-sm font-medium hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors"
                >
                  取消
                </button>
                <motion.button
                  whileTap={{ scale: 0.97 }}
                  onClick={handleSave}
                  className="flex-1 py-2.5 rounded-xl bg-purple-500 text-white text-sm font-medium hover:bg-purple-600 transition-colors"
                >
                  {formData.id ? "保存" : "添加"}
                </motion.button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Delete confirmation */}
      <AnimatePresence>
        {showDeleteConfirm !== null && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-6"
            onClick={() => setShowDeleteConfirm(null)}
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
                  <h3 className="text-lg font-semibold text-gray-900 dark:text-white">确认删除</h3>
                  <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                    此操作将永久删除该子模块，不可撤销。
                  </p>
                </div>
                <div className="flex gap-3 w-full mt-1">
                  <button
                    onClick={() => setShowDeleteConfirm(null)}
                    className="flex-1 px-4 py-2.5 rounded-xl text-sm font-medium border border-gray-200 dark:border-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors"
                  >
                    取消
                  </button>
                  <motion.button
                    whileTap={{ scale: 0.97 }}
                    onClick={() => handleDelete(showDeleteConfirm)}
                    className="flex-1 px-4 py-2.5 rounded-xl text-sm font-medium bg-red-500 text-white hover:bg-red-600 transition-colors"
                  >
                    确认删除
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
