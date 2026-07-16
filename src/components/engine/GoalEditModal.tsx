"use client";

import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X, Save } from "lucide-react";
import type {
  EngineGoal,
  EngineGoalCategory,
  EngineGoalPriority,
} from "@/lib/engine/types";
import { ENGINE_PRIORITY_LABELS } from "@/lib/engine/types";

// ============================================================
// 配置
// ============================================================

const CATEGORY_OPTIONS: { value: EngineGoalCategory; label: string }[] = [
  { value: "exam", label: "备考" },
  { value: "fitness", label: "运动" },
  { value: "habit", label: "习惯" },
  { value: "finance", label: "财务" },
  { value: "custom", label: "自定义" },
];

const PRIORITY_OPTIONS: { value: EngineGoalPriority; label: string; color: string; bg: string }[] = [
  { value: "p1", label: "紧急重要", color: "#EF4444", bg: "rgba(239,68,68,0.1)" },
  { value: "p2", label: "重要不紧急", color: "#3B82F6", bg: "rgba(59,130,246,0.1)" },
  { value: "p3", label: "紧急不重要", color: "#F59E0B", bg: "rgba(245,158,11,0.1)" },
  { value: "p4", label: "不紧急不重要", color: "#9CA3AF", bg: "rgba(156,163,175,0.1)" },
];

// ============================================================
// 组件
// ============================================================

interface GoalEditModalProps {
  open: boolean;
  goal: EngineGoal | null; // null = 新建模式
  onSave: (data: {
    title: string;
    description: string;
    category: EngineGoalCategory;
    priority: EngineGoalPriority;
    deadline: string;
  }) => Promise<void>;
  onClose: () => void;
  onDelete?: () => void;
  saving?: boolean;
}

export default function GoalEditModal({
  open,
  goal,
  onSave,
  onClose,
  onDelete,
  saving = false,
}: GoalEditModalProps) {
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [category, setCategory] = useState<EngineGoalCategory>("custom");
  const [priority, setPriority] = useState<EngineGoalPriority>("p2");
  const [deadline, setDeadline] = useState("");
  const [localSaving, setLocalSaving] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  // 关闭时重置表单
  useEffect(() => {
    if (!open) return;

    if (goal) {
      setTitle(goal.title);
      setDescription(goal.description);
      setCategory(goal.category);
      setPriority(goal.priority);
      setDeadline(goal.deadline);
    } else {
      setTitle("");
      setDescription("");
      setCategory("custom");
      setPriority("p2");
      const d = new Date();
      d.setDate(d.getDate() + 30);
      setDeadline(d.toISOString().slice(0, 10));
    }
    setShowDeleteConfirm(false);
  }, [open, goal]);

  const handleSubmit = async () => {
    if (!title.trim()) return;
    setLocalSaving(true);
    try {
      await onSave({
        title: title.trim(),
        description: description.trim(),
        category,
        priority,
        deadline,
      });
    } finally {
      setLocalSaving(false);
    }
  };

  const isLoading = saving || localSaving;

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-50 flex items-start justify-center bg-black/40 pt-[8vh] px-4 overflow-y-auto"
          onClick={onClose}
        >
          <motion.div
            initial={{ scale: 0.95, opacity: 0, y: 20 }}
            animate={{ scale: 1, opacity: 1, y: 0 }}
            exit={{ scale: 0.95, opacity: 0, y: 20 }}
            onClick={(e) => e.stopPropagation()}
            className="bg-white dark:bg-gray-900 rounded-3xl p-6 max-w-md w-full shadow-xl"
          >
            {/* 标题栏 */}
            <div className="flex items-center justify-between mb-5">
              <h2 className="text-lg font-bold text-gray-900 dark:text-white">
                {goal ? "编辑目标" : "新建目标"}
              </h2>
              <button
                onClick={onClose}
                className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
              >
                <X className="w-5 h-5 text-gray-400" />
              </button>
            </div>

            {/* 表单 */}
            <div className="space-y-4">
              {/* 标题 */}
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">
                  标题
                </label>
                <input
                  type="text"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") handleSubmit();
                  }}
                  placeholder="输入目标标题"
                  className="w-full px-4 py-2.5 rounded-xl bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 text-sm text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  autoFocus
                />
              </div>

              {/* 描述 */}
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">
                  描述
                </label>
                <textarea
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="描述目标（可选）"
                  rows={3}
                  className="w-full px-4 py-2.5 rounded-xl bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 text-sm text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500 resize-none"
                />
              </div>

              {/* 分类 */}
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">
                  分类
                </label>
                <div className="grid grid-cols-5 gap-2">
                  {CATEGORY_OPTIONS.map((opt) => (
                    <button
                      key={opt.value}
                      onClick={() => setCategory(opt.value)}
                      className={`py-2 rounded-xl text-xs font-medium transition-colors ${
                        category === opt.value
                          ? "bg-indigo-600 text-white"
                          : "bg-gray-50 dark:bg-gray-800 text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700"
                      }`}
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* 优先级 */}
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">
                  优先级
                </label>
                <div className="grid grid-cols-2 gap-2">
                  {PRIORITY_OPTIONS.map((opt) => (
                    <button
                      key={opt.value}
                      onClick={() => setPriority(opt.value)}
                      className={`flex items-center gap-2 px-3 py-2 rounded-xl text-xs font-medium transition-colors ${
                        priority === opt.value
                          ? "ring-2 ring-current"
                          : "bg-gray-50 dark:bg-gray-800 text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700"
                      }`}
                      style={{
                        color: priority === opt.value ? opt.color : undefined,
                        background: priority === opt.value ? opt.bg : undefined,
                      }}
                    >
                      <span className="w-2 h-2 rounded-full" style={{ backgroundColor: opt.color }} />
                      {opt.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* 截止日期 */}
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">
                  截止日期
                </label>
                <input
                  type="date"
                  value={deadline}
                  onChange={(e) => setDeadline(e.target.value)}
                  className="w-full px-4 py-2.5 rounded-xl bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 text-sm text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>
            </div>

            {/* 操作按钮 */}
            <div className="flex gap-3 mt-6">
              {goal ? (
                <>
                  {showDeleteConfirm ? (
                    <>
                      <button
                        onClick={() => setShowDeleteConfirm(false)}
                        className="flex-1 py-2.5 rounded-xl border border-gray-200 dark:border-gray-700 text-sm text-gray-500 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors"
                      >
                        取消删除
                      </button>
                      <button
                        onClick={() => onDelete?.()}
                        className="flex-1 py-2.5 rounded-xl bg-red-600 text-white text-sm font-medium hover:bg-red-700 transition-colors"
                      >
                        确认删除
                      </button>
                    </>
                  ) : (
                    <>
                      <button
                        onClick={() => setShowDeleteConfirm(true)}
                        className="py-2.5 px-4 rounded-xl border border-red-200 dark:border-red-800 text-sm text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors"
                      >
                        删除
                      </button>
                      <button
                        onClick={onClose}
                        className="flex-1 py-2.5 rounded-xl border border-gray-200 dark:border-gray-700 text-sm text-gray-500 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors"
                      >
                        取消
                      </button>
                      <button
                        onClick={handleSubmit}
                        disabled={isLoading || !title.trim()}
                        className="flex-1 py-2.5 rounded-xl bg-indigo-600 text-white text-sm font-medium hover:bg-indigo-700 disabled:opacity-50 transition-colors flex items-center justify-center gap-1.5"
                      >
                        <Save className="w-4 h-4" />
                        {isLoading ? "保存中..." : "保存"}
                      </button>
                    </>
                  )}
                </>
              ) : (
                <>
                  <button
                    onClick={onClose}
                    className="flex-1 py-2.5 rounded-xl border border-gray-200 dark:border-gray-700 text-sm text-gray-500 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors"
                  >
                    取消
                  </button>
                  <button
                    onClick={handleSubmit}
                    disabled={isLoading || !title.trim()}
                    className="flex-1 py-2.5 rounded-xl bg-indigo-600 text-white text-sm font-medium hover:bg-indigo-700 disabled:opacity-50 transition-colors flex items-center justify-center gap-1.5"
                  >
                    <Save className="w-4 h-4" />
                    {isLoading ? "保存中..." : "创建"}
                  </button>
                </>
              )}
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
