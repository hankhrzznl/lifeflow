"use client";

import { useState, useCallback, useMemo } from "react";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { GraduationCap, Dumbbell, Repeat, PiggyBank, ChevronRight, Eye, Loader2, Check } from "lucide-react";
import { GoalEngine } from "@/services/goal-engine";
import type { TemplateMeta } from "@/services/goal-engine";
import type { TemplateParams, GoalCategory } from "@/types/goal";
import { createMainGoalFromTemplate } from "@/lib/goalBridge";

// ============================================================
// 配置
// ============================================================

const ICON_MAP: Record<string, typeof GraduationCap> = {
  "graduation-cap": GraduationCap, dumbbell: Dumbbell, repeat: Repeat, "piggy-bank": PiggyBank,
};

const CATEGORY_NAMES: Record<string, string> = { exam: "备考", fitness: "运动", habit: "习惯", finance: "财务" };

const CATEGORY_ICONS: Record<string, string> = { exam: "graduation-cap", fitness: "dumbbell", habit: "repeat", finance: "piggy-bank" };

// ============================================================
// 参数表单子组件
// ============================================================

function FieldRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1.5">{label}</label>
      {children}
    </div>
  );
}

function TextInput({ value, onChange, placeholder }: { value: string; onChange: (v: string) => void; placeholder?: string }) {
  return (
    <input type="text" value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder}
      className="w-full px-3 py-2 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500" />
  );
}

function NumberInput({ value, onChange, min, max }: { value: number; onChange: (v: number) => void; min?: number; max?: number }) {
  return (
    <input type="number" value={value} onChange={(e) => onChange(Number(e.target.value))} min={min} max={max}
      className="w-full px-3 py-2 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500" />
  );
}

function DateInput({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  return (
    <input type="date" value={value} onChange={(e) => onChange(e.target.value)}
      className="w-full px-3 py-2 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500" />
  );
}

function SelectInput({ value, onChange, options }: { value: string; onChange: (v: string) => void; options: Array<{ value: string; label: string }> }) {
  return (
    <select value={value} onChange={(e) => onChange(e.target.value)}
      className="w-full px-3 py-2 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500">
      {options.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
    </select>
  );
}

function PreviewItem({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between items-center py-1.5">
      <span className="text-gray-500 dark:text-gray-400">{label}</span>
      <span className="font-medium text-gray-900 dark:text-white text-right max-w-[60%] truncate">{value}</span>
    </div>
  );
}

// ============================================================
// 主页面
// ============================================================

export default function NewGoalPage() {
  const router = useRouter();
  const templates = useMemo(() => GoalEngine.getTemplateMetas(), []);

  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [params, setParams] = useState<Record<string, unknown>>({});
  const [blueprint, setBlueprint] = useState<Awaited<ReturnType<typeof GoalEngine.generateTemplate>> | null>(null);
  const [showPreview, setShowPreview] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const selectedTemplate = useMemo(
    () => templates.find((t) => t.id === selectedId) ?? null, [templates, selectedId]
  );

  const handleSelectTemplate = useCallback((id: string) => {
    if (selectedId === id) { setSelectedId(null); setBlueprint(null); setShowPreview(false); return; }
    setSelectedId(id); setBlueprint(null); setShowPreview(false); setError(null);
    const defaults: Record<string, unknown> = {};
    if (id === "template_exam") {
      defaults.goalTitle = ""; defaults.goalDescription = ""; defaults.deadline = "";
      defaults.examSubject = ""; defaults.dailyStudyHours = 3; defaults.baseLevel = "beginner"; defaults.targetScore = 60;
    } else if (id === "template_fitness") {
      defaults.goalTitle = ""; defaults.goalDescription = ""; defaults.deadline = "";
      defaults.targetWeightKg = 0; defaults.weeklyWorkouts = 3; defaults.fitnessLevel = "beginner";
    } else if (id === "template_habit") {
      defaults.goalTitle = ""; defaults.goalDescription = ""; defaults.deadline = "";
      defaults.habitType = "daily"; defaults.cueDescription = "早餐后";
    } else if (id === "template_finance") {
      defaults.goalTitle = ""; defaults.goalDescription = ""; defaults.deadline = "";
      defaults.monthlyTarget = 1000;
    } else {
      defaults.goalTitle = ""; defaults.goalDescription = ""; defaults.deadline = "";
    }
    defaults.priority = "p2";
    setParams(defaults);
  }, [selectedId]);

  const handleParamChange = useCallback((key: string, value: unknown) => {
    setParams((prev) => ({ ...prev, [key]: value })); setBlueprint(null); setShowPreview(false);
  }, []);

  const getP = (k: string) => params[k];

  const handlePreview = useCallback(() => {
    if (!selectedId || !selectedTemplate) return;
    setError(null);
    try {
      const bp = GoalEngine.generateTemplate(selectedTemplate.category as GoalCategory, params as unknown as Parameters<typeof GoalEngine.generateTemplate>[1]);
      setBlueprint(bp); setShowPreview(true);
    } catch (e) { setError(e instanceof Error ? e.message : "预览失败"); }
  }, [selectedId, selectedTemplate, params]);

  const handleCreate = useCallback(async () => {
    if (!selectedId || !selectedTemplate) return;
    setLoading(true); setError(null);
    try {
      const mainGoalId = await createMainGoalFromTemplate(selectedTemplate.category, params as unknown as TemplateParams);
      router.push(`/goals/${mainGoalId}`);
    } catch (e) { setError(e instanceof Error ? e.message : "创建失败"); }
    finally { setLoading(false); }
  }, [selectedId, selectedTemplate, params, router]);

  return (
    <div className="max-w-2xl mx-auto px-4 py-6 space-y-6">
      <div>
        <h1 className="text-xl font-bold text-gray-900 dark:text-white">新建目标</h1>
        <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">选择模板快速创建四级拆解计划</p>
      </div>

      {!selectedId ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {templates.map((tpl) => {
            const Icon = ICON_MAP[CATEGORY_ICONS[tpl.category] ?? ""] ?? PiggyBank;
            return (
              <motion.button key={tpl.id} initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}
                onClick={() => handleSelectTemplate(tpl.id)}
                className="text-left p-5 rounded-2xl bg-white dark:bg-gray-900 border border-gray-100 dark:border-gray-800 shadow-sm hover:shadow-md hover:border-indigo-200 dark:hover:border-indigo-700 transition-all group">
                <div className="w-10 h-10 rounded-xl bg-indigo-50 dark:bg-indigo-900/30 flex items-center justify-center mb-3">
                  <Icon className="w-5 h-5 text-indigo-500" />
                </div>
                <h3 className="font-semibold text-gray-900 dark:text-white group-hover:text-indigo-600 transition-colors">{tpl.name}</h3>
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-1.5 line-clamp-2">{tpl.description}</p>
                <div className="flex items-center gap-1 mt-3">
                  <span className="text-xs px-2 py-0.5 rounded-md bg-gray-100 dark:bg-gray-800 text-gray-500">{CATEGORY_NAMES[tpl.category] ?? tpl.category}</span>
                  <ChevronRight className="w-4 h-4 text-gray-300 group-hover:text-indigo-400 ml-auto" />
                </div>
              </motion.button>
            );
          })}
        </div>
      ) : (
        <AnimatePresence mode="wait">
          <motion.div key={selectedId} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="space-y-5">
            <button onClick={() => handleSelectTemplate(selectedId)} className="text-sm text-gray-500 hover:text-indigo-600 transition-colors">← 返回选择模板</button>

            <div className="p-5 rounded-2xl bg-white dark:bg-gray-900 border border-gray-100 dark:border-gray-800 shadow-sm">
              <h2 className="font-bold text-lg text-gray-900 dark:text-white">{selectedTemplate?.name}</h2>
              <p className="text-sm text-gray-500 mt-1">{selectedTemplate?.description}</p>
            </div>

            <div className="p-5 rounded-2xl bg-white dark:bg-gray-900 border border-gray-100 dark:border-gray-800 shadow-sm space-y-4">
              <h3 className="font-semibold text-sm text-gray-700 dark:text-gray-300">参数配置</h3>

              <FieldRow label="目标名称"><TextInput value={(getP("goalTitle") as string) ?? ""} onChange={(v) => handleParamChange("goalTitle", v)} placeholder="例如：通过PMP考试" /></FieldRow>
              <FieldRow label="描述"><TextInput value={(getP("goalDescription") as string) ?? ""} onChange={(v) => handleParamChange("goalDescription", v)} placeholder="可选" /></FieldRow>
              <FieldRow label="截止日期"><DateInput value={(getP("deadline") as string) ?? ""} onChange={(v) => handleParamChange("deadline", v)} /></FieldRow>
              <FieldRow label="优先级">
                <SelectInput value={(getP("priority") as string) ?? "p2"} onChange={(v) => handleParamChange("priority", v)}
                  options={[{ value: "p1", label: "高" }, { value: "p2", label: "中" }, { value: "p3", label: "低" }]} />
              </FieldRow>

              {selectedId === "template_exam" && (
                <>
                  <FieldRow label="考试科目"><TextInput value={(getP("examSubject") as string) ?? ""} onChange={(v) => handleParamChange("examSubject", v)} placeholder="如：PMP、CPA" /></FieldRow>
                  <FieldRow label="每日学习时长(小时)"><NumberInput value={(getP("dailyStudyHours") as number) ?? 3} onChange={(v) => handleParamChange("dailyStudyHours", v)} min={1} max={12} /></FieldRow>
                  <FieldRow label="基础水平"><SelectInput value={(getP("baseLevel") as string) ?? "beginner"} onChange={(v) => handleParamChange("baseLevel", v)} options={[{ value: "beginner", label: "零基础" }, { value: "intermediate", label: "有一定基础" }, { value: "advanced", label: "强化冲刺" }]} /></FieldRow>
                  <FieldRow label="目标分数"><NumberInput value={(getP("targetScore") as number) ?? 60} onChange={(v) => handleParamChange("targetScore", v)} min={10} max={100} /></FieldRow>
                </>
              )}
              {selectedId === "template_fitness" && (
                <>
                  <FieldRow label="目标体重(kg)"><NumberInput value={(getP("targetWeightKg") as number) ?? 0} onChange={(v) => handleParamChange("targetWeightKg", v)} min={30} max={200} /></FieldRow>
                  <FieldRow label="每周训练次数"><NumberInput value={(getP("weeklyWorkouts") as number) ?? 3} onChange={(v) => handleParamChange("weeklyWorkouts", v)} min={1} max={7} /></FieldRow>
                  <FieldRow label="训练水平"><SelectInput value={(getP("fitnessLevel") as string) ?? "beginner"} onChange={(v) => handleParamChange("fitnessLevel", v)} options={[{ value: "beginner", label: "新手" }, { value: "intermediate", label: "有经验" }, { value: "advanced", label: "高手" }]} /></FieldRow>
                </>
              )}
              {selectedId === "template_habit" && (
                <>
                  <FieldRow label="习惯频率"><SelectInput value={(getP("habitType") as string) ?? "daily"} onChange={(v) => handleParamChange("habitType", v)} options={[{ value: "daily", label: "每天" }, { value: "workday", label: "仅工作日" }]} /></FieldRow>
                  <FieldRow label="触发提示"><TextInput value={(getP("cueDescription") as string) ?? "早餐后"} onChange={(v) => handleParamChange("cueDescription", v)} placeholder="如：早餐后、睡前" /></FieldRow>
                </>
              )}
              {selectedId === "template_finance" && (
                <FieldRow label="每月储蓄目标(元)"><NumberInput value={(getP("monthlyTarget") as number) ?? 1000} onChange={(v) => handleParamChange("monthlyTarget", v)} min={100} max={100000} /></FieldRow>
              )}
            </div>

            {error && <div className="p-3 rounded-xl bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 text-sm text-red-600">{error}</div>}

            <AnimatePresence>
              {showPreview && blueprint && (
                <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} exit={{ opacity: 0, height: 0 }} className="overflow-hidden">
                  <div className="p-5 rounded-2xl bg-white dark:bg-gray-900 border border-gray-100 dark:border-gray-800 shadow-sm">
                    <h3 className="font-semibold text-sm text-gray-700 dark:text-gray-300 mb-3">拆解预览</h3>
                    <div className="space-y-3 text-sm">
                      <PreviewItem label="目标" value={blueprint.goal.title} />
                      <PreviewItem label="里程碑" value={`${blueprint.milestones.length}个：${blueprint.milestones.map((m) => m.title).join("、")}`} />
                      <PreviewItem label="周任务" value={`${blueprint.weeklyTasks.length}个`} />
                      <PreviewItem label="原子项" value={`${blueprint.dailyAtoms.length}个`} />
                      <PreviewItem label="截止日期" value={blueprint.goal.deadline} />
                    </div>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

            <div className="flex gap-3">
              <button onClick={handlePreview} disabled={loading}
                className="flex items-center gap-2 px-5 py-2.5 rounded-xl border border-gray-200 dark:border-gray-700 text-sm font-medium text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-800 disabled:opacity-50 transition-colors">
                <Eye className="w-4 h-4" /> 预览拆解
              </button>
              <button onClick={handleCreate} disabled={loading}
                className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-indigo-600 text-white text-sm font-medium hover:bg-indigo-700 disabled:opacity-50 transition-colors ml-auto">
                {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
                {loading ? "创建中..." : "一键生成计划"}
              </button>
            </div>
          </motion.div>
        </AnimatePresence>
      )}
    </div>
  );
}
