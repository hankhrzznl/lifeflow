"use client";

import { useState, useCallback, useMemo } from "react";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import {
  GraduationCap, Dumbbell, Repeat, PiggyBank,
  ChevronRight, Play, Eye, Loader2, Check,
} from "lucide-react";
import { templateEngine } from "@/lib/engine/TemplateEngine";
import type { TemplateDefinition, ParameterSchema, TemplateBlueprint } from "@/lib/engine/TemplateEngine";

// 确保模板已注册
import "@/lib/engine/templates";

// ============================================================
// 配置
// ============================================================

const ICON_MAP: Record<string, typeof GraduationCap> = {
  "graduation-cap": GraduationCap,
  dumbbell: Dumbbell,
  repeat: Repeat,
  "piggy-bank": PiggyBank,
};

const CATEGORY_NAMES: Record<string, string> = {
  exam: "备考",
  fitness: "运动",
  habit: "习惯",
  finance: "财务",
};

// ============================================================
// 组件
// ============================================================

export default function NewGoalPage() {
  const router = useRouter();
  const templates = useMemo(() => templateEngine.list(), []);

  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [params, setParams] = useState<Record<string, unknown>>({});
  const [blueprint, setBlueprint] = useState<TemplateBlueprint | null>(null);
  const [showPreview, setShowPreview] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const selectedTemplate = useMemo(
    () => templates.find((t) => t.id === selectedId) ?? null,
    [templates, selectedId]
  );

  // 选择模板时重置表单
  const handleSelectTemplate = useCallback((id: string) => {
    if (selectedId === id) {
      setSelectedId(null);
      setBlueprint(null);
      setShowPreview(false);
      return;
    }

    setSelectedId(id);
    setBlueprint(null);
    setShowPreview(false);
    setError(null);

    // 填充默认值
    const template = templateEngine.getTemplate(id);
    if (template) {
      const defaults: Record<string, unknown> = {};
      for (const param of template.parameters) {
        if (param.defaultValue !== undefined) {
          defaults[param.key] = param.defaultValue;
        }
      }
      setParams(defaults);
    }
  }, [selectedId]);

  // 更新参数
  const handleParamChange = useCallback((key: string, value: unknown) => {
    setParams((prev) => ({ ...prev, [key]: value }));
    setBlueprint(null);
    setShowPreview(false);
  }, []);

  // 预览
  const handlePreview = useCallback(() => {
    if (!selectedId) return;
    setError(null);

    try {
      const bp = templateEngine.generateBlueprint(selectedId, params);
      setBlueprint(bp);
      setShowPreview(true);
    } catch (e) {
      setError(e instanceof Error ? e.message : "预览失败");
    }
  }, [selectedId, params]);

  // 创建
  const handleCreate = useCallback(async () => {
    if (!selectedId) return;
    setLoading(true);
    setError(null);

    try {
      const result = await templateEngine.execute(selectedId, params);
      router.push(`/goals`);
    } catch (e) {
      setError(e instanceof Error ? e.message : "创建失败");
    } finally {
      setLoading(false);
    }
  }, [selectedId, params, router]);

  return (
    <div className="max-w-2xl mx-auto px-4 py-6 space-y-6">
      {/* 标题 */}
      <div>
        <h1 className="text-xl font-bold text-gray-900 dark:text-white">新建目标</h1>
        <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
          选择模板快速创建四级拆解计划
        </p>
      </div>

      {/* 模板卡片网格 */}
      {!selectedId ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {templates.map((tpl) => {
            const Icon = ICON_MAP[tpl.icon] ?? PiggyBank;
            return (
              <motion.button
                key={tpl.id}
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                onClick={() => handleSelectTemplate(tpl.id)}
                className="text-left p-5 rounded-2xl bg-white dark:bg-gray-900 border border-gray-100 dark:border-gray-800 shadow-sm hover:shadow-md hover:border-indigo-200 dark:hover:border-indigo-700 transition-all group"
              >
                <div className="w-10 h-10 rounded-xl bg-indigo-50 dark:bg-indigo-900/30 flex items-center justify-center mb-3">
                  <Icon className="w-5 h-5 text-indigo-500" />
                </div>
                <h3 className="font-semibold text-gray-900 dark:text-white group-hover:text-indigo-600 transition-colors">
                  {tpl.name}
                </h3>
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-1.5 line-clamp-2">
                  {tpl.description}
                </p>
                <div className="flex items-center gap-1 mt-3">
                  <span className="text-xs px-2 py-0.5 rounded-md bg-gray-100 dark:bg-gray-800 text-gray-500">
                    {CATEGORY_NAMES[tpl.category] ?? tpl.category}
                  </span>
                  <ChevronRight className="w-4 h-4 text-gray-300 group-hover:text-indigo-400 ml-auto" />
                </div>
              </motion.button>
            );
          })}
        </div>
      ) : (
        <AnimatePresence mode="wait">
          <motion.div
            key={selectedId}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="space-y-5"
          >
            {/* 返回选择 */}
            <button
              onClick={() => handleSelectTemplate(selectedId)}
              className="text-sm text-gray-500 hover:text-indigo-600 transition-colors"
            >
              ← 返回选择模板
            </button>

            {/* 模板信息 */}
            <div className="p-5 rounded-2xl bg-white dark:bg-gray-900 border border-gray-100 dark:border-gray-800 shadow-sm">
              <h2 className="font-bold text-lg text-gray-900 dark:text-white">
                {selectedTemplate?.name}
              </h2>
              <p className="text-sm text-gray-500 mt-1">{selectedTemplate?.description}</p>
            </div>

            {/* 参数表单 */}
            <div className="p-5 rounded-2xl bg-white dark:bg-gray-900 border border-gray-100 dark:border-gray-800 shadow-sm space-y-4">
              <h3 className="font-semibold text-sm text-gray-700 dark:text-gray-300">参数配置</h3>

              {selectedTemplate?.parameters.map((param) => (
                <ParamInput
                  key={param.key}
                  schema={param}
                  value={params[param.key] ?? param.defaultValue}
                  onChange={(v) => handleParamChange(param.key, v)}
                />
              ))}
            </div>

            {/* 错误 */}
            {error && (
              <div className="p-3 rounded-xl bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 text-sm text-red-600">
                {error}
              </div>
            )}

            {/* T7: 预览 */}
            <AnimatePresence>
              {showPreview && blueprint && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: "auto" }}
                  exit={{ opacity: 0, height: 0 }}
                  className="overflow-hidden"
                >
                  <div className="p-5 rounded-2xl bg-white dark:bg-gray-900 border border-gray-100 dark:border-gray-800 shadow-sm">
                    <h3 className="font-semibold text-sm text-gray-700 dark:text-gray-300 mb-3">
                      拆解预览
                    </h3>
                    <div className="space-y-3 text-sm">
                      <PreviewItem label="目标" value={blueprint.goal.title} />
                      <PreviewItem
                        label="里程碑"
                        value={`${blueprint.milestones.length}个：${blueprint.milestones.map((m) => m.title).join("、")}`}
                      />
                      <PreviewItem label="周任务" value={`${blueprint.weeklyTasks.length}个`} />
                      <PreviewItem
                        label="原子项"
                        value={`${blueprint.dailyAtoms.reduce((s, a) => s + a.length, 0)}个`}
                      />
                      <PreviewItem label="截止日期" value={blueprint.goal.deadline} />
                    </div>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

            {/* 操作按钮 */}
            <div className="flex gap-3">
              <button
                onClick={handlePreview}
                disabled={loading}
                className="flex items-center gap-2 px-5 py-2.5 rounded-xl border border-gray-200 dark:border-gray-700 text-sm font-medium text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-800 disabled:opacity-50 transition-colors"
              >
                <Eye className="w-4 h-4" />
                预览拆解
              </button>
              <button
                onClick={handleCreate}
                disabled={loading}
                className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-indigo-600 text-white text-sm font-medium hover:bg-indigo-700 disabled:opacity-50 transition-colors ml-auto"
              >
                {loading ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <Check className="w-4 h-4" />
                )}
                {loading ? "创建中..." : "创建目标"}
              </button>
            </div>
          </motion.div>
        </AnimatePresence>
      )}
    </div>
  );
}

// ============================================================
// 子组件
// ============================================================

function ParamInput({
  schema, value, onChange,
}: {
  schema: ParameterSchema;
  value: unknown;
  onChange: (v: unknown) => void;
}) {
  const id = `param-${schema.key}`;

  return (
    <div>
      <label htmlFor={id} className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">
        {schema.label}
        {schema.required && <span className="text-red-500 ml-0.5">*</span>}
      </label>

      {schema.type === "select" ? (
        <select
          id={id}
          value={String(value ?? schema.defaultValue ?? "")}
          onChange={(e) => onChange(e.target.value)}
          className="w-full px-3 py-2 rounded-xl bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 text-sm text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
        >
          {schema.options?.map((opt) => (
            <option key={opt.value} value={opt.value}>{opt.label}</option>
          ))}
        </select>
      ) : schema.type === "multi-select" ? (
        <MultiSelectInput
          id={id}
          options={schema.options ?? []}
          value={(value as string[]) ?? (schema.defaultValue as string[]) ?? []}
          onChange={onChange}
        />
      ) : schema.type === "number" ? (
        <input
          id={id}
          type="number"
          value={value !== undefined ? String(value) : ""}
          onChange={(e) => onChange(e.target.value ? Number(e.target.value) : undefined)}
          placeholder={schema.placeholder}
          className="w-full px-3 py-2 rounded-xl bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 text-sm text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
        />
      ) : schema.type === "date" ? (
        <input
          id={id}
          type="date"
          value={value ? String(value) : ""}
          onChange={(e) => onChange(e.target.value)}
          className="w-full px-3 py-2 rounded-xl bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 text-sm text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
        />
      ) : schema.type === "boolean" ? (
        <button
          onClick={() => onChange(!value)}
          className={`px-3 py-2 rounded-xl text-sm font-medium transition-colors ${
            value
              ? "bg-indigo-600 text-white"
              : "bg-gray-50 dark:bg-gray-800 text-gray-600 dark:text-gray-400 border border-gray-200 dark:border-gray-700"
          }`}
        >
          {value ? "是" : "否"}
        </button>
      ) : (
        <input
          id={id}
          type="text"
          value={value ? String(value) : ""}
          onChange={(e) => onChange(e.target.value)}
          placeholder={schema.placeholder}
          className="w-full px-3 py-2 rounded-xl bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 text-sm text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
        />
      )}

      {schema.hint && (
        <p className="text-[11px] text-gray-400 mt-0.5">{schema.hint}</p>
      )}
    </div>
  );
}

function MultiSelectInput({
  id, options, value, onChange,
}: {
  id: string;
  options: { value: string; label: string }[];
  value: string[];
  onChange: (v: string[]) => void;
}) {
  const selected = value ?? [];

  const toggle = (optValue: string) => {
    if (selected.includes(optValue)) {
      onChange(selected.filter((v) => v !== optValue));
    } else {
      onChange([...selected, optValue]);
    }
  };

  return (
    <div className="flex flex-wrap gap-1.5">
      {options.map((opt) => (
        <button
          key={opt.value}
          type="button"
          onClick={() => toggle(opt.value)}
          className={`px-2.5 py-1.5 rounded-lg text-xs font-medium transition-colors ${
            selected.includes(opt.value)
              ? "bg-indigo-600 text-white"
              : "bg-gray-50 dark:bg-gray-800 text-gray-600 dark:text-gray-400 border border-gray-200 dark:border-gray-700 hover:bg-gray-100 dark:hover:bg-gray-700"
          }`}
        >
          {opt.label}
        </button>
      ))}
    </div>
  );
}

function PreviewItem({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-start gap-3">
      <span className="text-xs font-medium text-gray-400 w-14 flex-shrink-0 mt-0.5">{label}</span>
      <span className="text-xs text-gray-700 dark:text-gray-300">{value}</span>
    </div>
  );
}
