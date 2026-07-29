"use client";

import { useState, useCallback, useMemo } from "react";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import { Check, ChevronLeft, ChevronRight, Plus, Trash2 } from "lucide-react";
import { addGoalV2, addKeyResultV2, addStrategyV2, addWeeklyTaskV2, addDailyActionV2 } from "@/lib/db/goal-v2.db";
import { STRATEGY_TEMPLATES, recalculateGoalProgress, getWeekStart, todayStr } from "@/lib/goal-v2-engine";
import type { StrategyTemplate } from "@/lib/goal-v2-engine";

// ============================================================
// 常量与类型
// ============================================================

const STEPS = [1, 2, 3, 4, 5];

const TEMPLATE_CARDS = [
  { key: "fitness", label: "健身减脂", strategies: ["饮食控制", "力量训练", "有氧燃脂"] },
  { key: "skill", label: "技能学习", strategies: ["知识输入", "刻意练习", "输出检验"] },
  { key: "finance", label: "财务目标", strategies: ["开源增收", "支出管理", "投资理财"] },
  { key: "career", label: "职场晋升", strategies: ["专业深耕", "跨部门协作", "向上汇报"] },
  { key: "custom", label: "自定义", strategies: [] },
] as const;

const PRESET_COLORS = [
  "#6366F1", "#F97316", "#8B5CF6", "#3B82F6",
  "#10B981", "#EF4444", "#EC4899", "#14B8A6",
];

const UNIT_OPTIONS = ["%", "cm", "kg", "次", "分", "天", "个", "元"];

type TemplateKey = keyof typeof STRATEGY_TEMPLATES;

interface KeyResultFormItem {
  tempId: string;
  description: string;
  targetValue: number;
  unit: string;
  deadline: string;
}

interface StrategyFormItem {
  tempId: string;
  name: string;
  description: string;
  templateKey?: TemplateKey; // 记录来自哪个模板，用于自动生成
}

interface WeeklyTaskFormItem {
  tempId: string;
  strategyId: string;
  title: string;
  deliverable: string;
  isCompleted: boolean;
}

interface DailyActionFormItem {
  tempId: string;
  weeklyTaskId: string;
  strategyId: string;
  title: string;
  time: string;
  duration: number;
  date: string;
}

let _tempIdCounter = 0;
function genId(): string {
  _tempIdCounter += 1;
  return `tmp_${_tempIdCounter}_${Date.now()}`;
}

function defaultDeadline(): string {
  const d = new Date();
  d.setDate(d.getDate() + 30);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

// ============================================================
// 子组件 — 步骤指示器
// ============================================================

function StepIndicator({ current }: { current: number }) {
  return (
    <div className="flex items-center justify-center gap-1 py-4 px-4">
      {STEPS.map((s) => {
        const isCompleted = s < current;
        const isCurrent = s === current;
        let bg = "var(--lifeflow-border)";
        let fg = "var(--color-text-disabled)";
        let icon: React.ReactNode = <span style={{ fontSize: 13, lineHeight: 1 }}>{s}</span>;

        if (isCompleted) {
          bg = "var(--lifeflow-primary)";
          fg = "#fff";
          icon = <Check className="w-3.5 h-3.5" />;
        } else if (isCurrent) {
          bg = "var(--lifeflow-primary)";
          fg = "#fff";
        }

        return (
          <div key={s} className="flex items-center gap-1">
            {s > 1 && (
              <div
                style={{
                  width: s <= current ? 24 : 24,
                  height: 2,
                  borderRadius: 1,
                  backgroundColor: s <= current ? "var(--lifeflow-primary)" : "var(--lifeflow-border)",
                }}
              />
            )}
            <div
              className="flex items-center justify-center shrink-0"
              style={{
                width: 28,
                height: 28,
                borderRadius: "50%",
                backgroundColor: bg,
                color: fg,
                fontWeight: isCurrent ? 600 : 400,
                transition: "all 200ms",
              }}
            >
              {icon}
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ============================================================
// 主组件
// ============================================================

export default function NewGoalV2Page() {
  const router = useRouter();
  const [step, setStep] = useState(1);
  const [submitting, setSubmitting] = useState(false);

  // Step 1 — 愿景
  const [title, setTitle] = useState("");
  const [vision, setVision] = useState("");
  const [color, setColor] = useState(PRESET_COLORS[0]);

  // Step 2 — 关键结果
  const [keyResults, setKeyResults] = useState<KeyResultFormItem[]>([
    { tempId: genId(), description: "", targetValue: 0, unit: "%", deadline: defaultDeadline() },
  ]);

  // Step 3 — 策略
  const [selectedTemplate, setSelectedTemplate] = useState<TemplateKey | "custom" | null>(null);
  const [strategies, setStrategies] = useState<StrategyFormItem[]>([]);

  // Step 4 — 周任务
  const [weeklyTasks, setWeeklyTasks] = useState<WeeklyTaskFormItem[]>([]);

  // Step 5 — 每日行动
  const [dailyActions, setDailyActions] = useState<DailyActionFormItem[]>([]);

  // ============================================================
  // 模板策略名称映射
  // ============================================================
  const templateStrategyNames = useMemo(() => {
    const map: Record<string, string[]> = {};
    for (const [key, tpls] of Object.entries(STRATEGY_TEMPLATES)) {
      map[key] = tpls.map((t) => t.name);
    }
    return map;
  }, []);

  // ============================================================
  // 模板选择
  // ============================================================
  const handleSelectTemplate = useCallback((key: TemplateKey | "custom") => {
    setSelectedTemplate(key);
    if (key === "custom") {
      setStrategies([{ tempId: genId(), name: "", description: "" }]);
      return;
    }
    const tpls = STRATEGY_TEMPLATES[key];
    const items: StrategyFormItem[] = tpls.map((t) => ({
      tempId: genId(),
      name: t.name,
      description: t.description,
      templateKey: key as TemplateKey,
    }));
    setStrategies(items);
  }, []);

  // ============================================================
  // 策略增删改
  // ============================================================
  const addStrategy = useCallback(() => {
    setStrategies((prev) => [...prev, { tempId: genId(), name: "", description: "" }]);
  }, []);

  const updateStrategy = useCallback((tempId: string, field: keyof StrategyFormItem, value: string) => {
    setStrategies((prev) =>
      prev.map((s) => (s.tempId === tempId ? { ...s, [field]: value } : s))
    );
  }, []);

  const removeStrategy = useCallback((tempId: string) => {
    setStrategies((prev) => prev.filter((s) => s.tempId !== tempId));
  }, []);

  // ============================================================
  // 生成周任务（Step 3 → Step 4）
  // ============================================================
  const handleToStep4 = useCallback(() => {
    // 从当前策略自动生成周任务
    const tasks: WeeklyTaskFormItem[] = strategies.map((s, idx) => {
      let title = `${s.name} - 本周任务`;
      let deliverable = "";

      if (selectedTemplate && selectedTemplate !== "custom") {
        const tpls = STRATEGY_TEMPLATES[selectedTemplate];
        const match = tpls.find((t) => t.name === s.name);
        if (match) {
          title = match.weeklyTaskTitle;
          deliverable = match.weeklyTaskDeliverable;
        }
      }

      return {
        tempId: genId(),
        strategyId: s.tempId,
        title,
        deliverable,
        isCompleted: false,
      };
    });
    setWeeklyTasks(tasks);
    setStep(4);
  }, [strategies, selectedTemplate]);

  // ============================================================
  // 周任务增删改
  // ============================================================
  const addWeeklyTask = useCallback(() => {
    if (strategies.length === 0) return;
    const firstStrategyId = strategies[0].tempId;
    setWeeklyTasks((prev) => [
      ...prev,
      { tempId: genId(), strategyId: firstStrategyId, title: "", deliverable: "", isCompleted: false },
    ]);
  }, [strategies]);

  const updateWeeklyTask = useCallback((tempId: string, field: keyof WeeklyTaskFormItem, value: string | boolean) => {
    setWeeklyTasks((prev) =>
      prev.map((t) => (t.tempId === tempId ? { ...t, [field]: value } : t))
    );
  }, []);

  const removeWeeklyTask = useCallback((tempId: string) => {
    setWeeklyTasks((prev) => prev.filter((t) => t.tempId !== tempId));
  }, []);

  // ============================================================
  // 生成每日行动（Step 4 → Step 5）
  // ============================================================
  const handleToStep5 = useCallback(() => {
    const today = todayStr();
    const strategyMap = new Map(strategies.map((s) => [s.tempId, s]));
    const actions: DailyActionFormItem[] = weeklyTasks.map((wt) => {
      const strategy = strategyMap.get(wt.strategyId);
      let title = "";
      let time = "08:00";
      let duration = 30;

      // 尝试从模板中匹配
      if (selectedTemplate && selectedTemplate !== "custom" && strategy) {
        const tpls = STRATEGY_TEMPLATES[selectedTemplate];
        const match = tpls.find((t) => t.name === strategy.name);
        if (match) {
          title = match.dailyActionTitle;
          time = match.dailyActionTime;
          duration = match.dailyActionDuration;
        }
      }

      if (!title) {
        title = `${wt.title} - 执行`;
      }

      return {
        tempId: genId(),
        weeklyTaskId: wt.tempId,
        strategyId: wt.strategyId,
        title,
        time,
        duration,
        date: today,
      };
    });
    setDailyActions(actions);
    setStep(5);
  }, [weeklyTasks, strategies, selectedTemplate]);

  // ============================================================
  // 每日行动增删改
  // ============================================================
  const addDailyAction = useCallback(() => {
    if (weeklyTasks.length === 0) return;
    const firstWt = weeklyTasks[0];
    setDailyActions((prev) => [
      ...prev,
      {
        tempId: genId(),
        weeklyTaskId: firstWt.tempId,
        strategyId: firstWt.strategyId,
        title: "",
        time: "08:00",
        duration: 30,
        date: todayStr(),
      },
    ]);
  }, [weeklyTasks]);

  const updateDailyAction = useCallback(
    (tempId: string, field: keyof DailyActionFormItem, value: string | number) => {
      setDailyActions((prev) =>
        prev.map((a) => (a.tempId === tempId ? { ...a, [field]: value } : a))
      );
    },
    []
  );

  const removeDailyAction = useCallback((tempId: string) => {
    setDailyActions((prev) => prev.filter((a) => a.tempId !== tempId));
  }, []);

  // ============================================================
  // 提交
  // ============================================================
  const handleSubmit = useCallback(async () => {
    if (submitting) return;
    setSubmitting(true);
    try {
      // 1. 创建 Goal
      const goalId = await addGoalV2({
        title: title.trim(),
        vision,
        color,
        status: "active",
      });

      // 2. 创建 KeyResults
      for (let i = 0; i < keyResults.length; i++) {
        const kr = keyResults[i];
        if (!kr.description.trim()) continue;
        await addKeyResultV2({
          goalId,
          description: kr.description.trim(),
          targetValue: kr.targetValue,
          currentValue: 0,
          unit: kr.unit,
          deadline: kr.deadline,
          sortOrder: i,
        });
      }

      // 3. 创建 Strategies
      const strategyIdMap = new Map<string, string>(); // tempId → realId
      for (let i = 0; i < strategies.length; i++) {
        const s = strategies[i];
        if (!s.name.trim()) continue;
        const realId = await addStrategyV2({
          goalId,
          name: s.name.trim(),
          description: s.description.trim(),
          sortOrder: i,
        });
        strategyIdMap.set(s.tempId, realId);
      }

      // 4. 创建 WeeklyTasks
      const weeklyTaskIdMap = new Map<string, string>(); // tempId → realId
      const weekStart = getWeekStart(new Date());
      for (let i = 0; i < weeklyTasks.length; i++) {
        const wt = weeklyTasks[i];
        const realStrategyId = strategyIdMap.get(wt.strategyId) || "";
        if (!realStrategyId || !wt.title.trim()) continue;
        const realId = await addWeeklyTaskV2({
          strategyId: realStrategyId,
          goalId,
          title: wt.title.trim(),
          weekStart,
          deliverable: wt.deliverable.trim(),
          isCompleted: wt.isCompleted,
          sortOrder: i,
        });
        weeklyTaskIdMap.set(wt.tempId, realId);
      }

      // 5. 创建 DailyActions
      const strategyIdFromTemp = (tempId: string) => strategyIdMap.get(tempId) || "";
      const weeklyTaskIdFromTemp = (tempId: string) => weeklyTaskIdMap.get(tempId) || "";
      for (let i = 0; i < dailyActions.length; i++) {
        const da = dailyActions[i];
        const realWeeklyTaskId = weeklyTaskIdFromTemp(da.weeklyTaskId);
        const realStrategyId = strategyIdFromTemp(da.strategyId);
        if (!realWeeklyTaskId || !da.title.trim()) continue;
        await addDailyActionV2({
          weeklyTaskId: realWeeklyTaskId,
          strategyId: realStrategyId || goalId,
          goalId,
          date: da.date || todayStr(),
          title: da.title.trim(),
          time: da.time,
          duration: da.duration,
          isCompleted: false,
          sortOrder: i,
        });
      }

      // 6. 重算进度
      await recalculateGoalProgress(goalId);

      // 7. 跳转
      router.push(`/efficiency-v2/goals/${goalId}`);
    } catch (e) {
      console.error("创建目标失败:", e);
    } finally {
      setSubmitting(false);
    }
  }, [submitting, title, vision, color, keyResults, strategies, weeklyTasks, dailyActions, router]);

  // ============================================================
  // 步骤有效性
  // ============================================================
  const canProceedFromStep1 = title.trim().length > 0;
  const canProceedFromStep2 = keyResults.some((kr) => kr.description.trim().length > 0);
  const canProceedFromStep3 = strategies.length > 0 && strategies.some((s) => s.name.trim().length > 0);
  const canProceedFromStep4 = weeklyTasks.length > 0 && weeklyTasks.some((t) => t.title.trim().length > 0);
  const canSubmit = !submitting && dailyActions.length > 0 && dailyActions.some((a) => a.title.trim().length > 0);

  // ============================================================
  // 渲染各步骤
  // ============================================================

  const renderStep1 = () => (
    <motion.div
      key="step1"
      initial={{ opacity: 0, x: 20 }}
      animate={{ opacity: 1, x: 0 }}
      className="px-4 flex flex-col gap-4"
    >
      {/* 目标名称 */}
      <div
        className="rounded-[10px] p-4"
        style={{ backgroundColor: "var(--color-surface-card)", border: "1px solid var(--lifeflow-border)" }}
      >
        <p className="text-[13px] mb-2 font-medium" style={{ color: "var(--color-text-secondary)" }}>
          目标名称 <span style={{ color: "#EF4444" }}>*</span>
        </p>
        <input
          type="text"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="目标名称（如：6个月练出马甲线）"
          className="w-full rounded-[8px] px-3 py-2.5 text-[15px] outline-none placeholder-[var(--color-text-disabled)]"
          style={{
            color: "var(--color-text-primary)",
            backgroundColor: "var(--lifeflow-muted)",
            caretColor: "var(--lifeflow-primary)",
          }}
          autoFocus
        />
      </div>

      {/* 愿景 */}
      <div
        className="rounded-[10px] p-4"
        style={{ backgroundColor: "var(--color-surface-card)", border: "1px solid var(--lifeflow-border)" }}
      >
        <p className="text-[13px] mb-2 font-medium" style={{ color: "var(--color-text-secondary)" }}>
          描绘愿景
        </p>
        <textarea
          value={vision}
          onChange={(e) => setVision(e.target.value)}
          placeholder="闭上眼睛，想象目标实现那天的具体画面..."
          rows={5}
          className="w-full rounded-[8px] px-3 py-2.5 text-[14px] outline-none resize-none placeholder-[var(--color-text-disabled)] leading-relaxed"
          style={{
            color: "var(--color-text-primary)",
            backgroundColor: "var(--lifeflow-muted)",
            caretColor: "var(--lifeflow-primary)",
          }}
        />
      </div>
    </motion.div>
  );

  const renderStep2 = () => (
    <motion.div
      key="step2"
      initial={{ opacity: 0, x: 20 }}
      animate={{ opacity: 1, x: 0 }}
      className="px-4 flex flex-col gap-3"
    >
      <p className="text-[13px] px-1" style={{ color: "var(--color-text-secondary)" }}>
        定义可量化的关键结果，追踪目标完成进度
      </p>
      {keyResults.map((kr, idx) => (
        <div
          key={kr.tempId}
          className="rounded-[10px] p-4"
          style={{ backgroundColor: "var(--color-surface-card)", border: "1px solid var(--lifeflow-border)" }}
        >
          <div className="flex items-center justify-between mb-2">
            <span className="text-[12px] font-medium" style={{ color: "var(--lifeflow-primary)" }}>
              关键结果 {idx + 1}
            </span>
            {keyResults.length > 1 && (
              <button type="button" onClick={() => setKeyResults((prev) => prev.filter((k) => k.tempId !== kr.tempId))}>
                <Trash2 className="w-4 h-4" style={{ color: "var(--color-text-disabled)" }} />
              </button>
            )}
          </div>

          {/* 描述 */}
          <input
            type="text"
            value={kr.description}
            onChange={(e) =>
              setKeyResults((prev) =>
                prev.map((k) => (k.tempId === kr.tempId ? { ...k, description: e.target.value } : k))
              )
            }
            placeholder="如：体脂率降至 22% 以下"
            className="w-full rounded-[8px] px-3 py-2 text-[14px] outline-none mb-2 placeholder-[var(--color-text-disabled)]"
            style={{
              color: "var(--color-text-primary)",
              backgroundColor: "var(--lifeflow-muted)",
              caretColor: "var(--lifeflow-primary)",
            }}
          />

          {/* 指标行 */}
          <div className="flex gap-2">
            <div className="flex-1">
              <span className="text-[11px]" style={{ color: "var(--color-text-disabled)" }}>目标值</span>
              <input
                type="number"
                value={kr.targetValue || ""}
                onChange={(e) =>
                  setKeyResults((prev) =>
                    prev.map((k) =>
                      k.tempId === kr.tempId ? { ...k, targetValue: Number(e.target.value) || 0 } : k
                    )
                  )
                }
                placeholder="0"
                className="w-full rounded-[8px] px-3 py-2 text-[14px] outline-none mt-1"
                style={{
                  color: "var(--color-text-primary)",
                  backgroundColor: "var(--lifeflow-muted)",
                  caretColor: "var(--lifeflow-primary)",
                }}
              />
            </div>
            <div className="w-20">
              <span className="text-[11px]" style={{ color: "var(--color-text-disabled)" }}>单位</span>
              <select
                value={kr.unit}
                onChange={(e) =>
                  setKeyResults((prev) =>
                    prev.map((k) => (k.tempId === kr.tempId ? { ...k, unit: e.target.value } : k))
                  )
                }
                className="w-full rounded-[8px] px-2 py-2 text-[14px] outline-none mt-1"
                style={{
                  color: "var(--color-text-primary)",
                  backgroundColor: "var(--lifeflow-muted)",
                }}
              >
                {UNIT_OPTIONS.map((u) => (
                  <option key={u} value={u}>{u}</option>
                ))}
              </select>
            </div>
            <div className="flex-1">
              <span className="text-[11px]" style={{ color: "var(--color-text-disabled)" }}>截止日期</span>
              <input
                type="date"
                value={kr.deadline}
                onChange={(e) =>
                  setKeyResults((prev) =>
                    prev.map((k) =>
                      k.tempId === kr.tempId ? { ...k, deadline: e.target.value } : k
                    )
                  )
                }
                className="w-full rounded-[8px] px-3 py-2 text-[14px] outline-none mt-1"
                style={{
                  color: "var(--color-text-primary)",
                  backgroundColor: "var(--lifeflow-muted)",
                }}
              />
            </div>
          </div>
        </div>
      ))}

      {keyResults.length < 3 && (
        <button
          type="button"
          onClick={() =>
            setKeyResults((prev) => [
              ...prev,
              { tempId: genId(), description: "", targetValue: 0, unit: "%", deadline: defaultDeadline() },
            ])
          }
          className="flex items-center justify-center gap-1.5 py-2.5 rounded-[10px] text-[14px] font-medium"
          style={{
            color: "var(--lifeflow-primary)",
            border: "1px dashed var(--lifeflow-border)",
            backgroundColor: "var(--color-surface-card)",
          }}
        >
          <Plus className="w-4 h-4" /> 添加关键结果
        </button>
      )}
    </motion.div>
  );

  const renderStep3 = () => (
    <motion.div
      key="step3"
      initial={{ opacity: 0, x: 20 }}
      animate={{ opacity: 1, x: 0 }}
      className="px-4 flex flex-col gap-4"
    >
      {/* 模板选择 */}
      <p className="text-[13px] font-medium" style={{ color: "var(--color-text-secondary)" }}>
        选择策略模板
      </p>
      <div className="grid grid-cols-2 gap-3">
        {TEMPLATE_CARDS.map((card) => {
          const isSelected = selectedTemplate === card.key;
          const isCustom = card.key === "custom";
          return (
            <button
              key={card.key}
              type="button"
              onClick={() => handleSelectTemplate(card.key)}
              className="rounded-[10px] p-3.5 text-left transition-all"
              style={{
                backgroundColor: isSelected ? "var(--color-surface-card)" : "var(--lifeflow-muted)",
                border: isSelected
                  ? "2px solid var(--lifeflow-primary)"
                  : "1px solid var(--lifeflow-border)",
                boxShadow: isSelected ? "var(--shadow-card)" : "none",
              }}
            >
              <span className="text-[15px] font-semibold block mb-1" style={{ color: "var(--color-text-primary)" }}>
                {card.label}
              </span>
              {!isCustom && card.strategies.length > 0 && (
                <span className="text-[11px] leading-relaxed" style={{ color: "var(--color-text-secondary)" }}>
                  {card.strategies.join("、")}
                </span>
              )}
              {isCustom && (
                <span className="text-[11px]" style={{ color: "var(--color-text-disabled)" }}>
                  自由添加策略
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* 策略列表 */}
      {strategies.length > 0 && (
        <div className="flex flex-col gap-2">
          <p className="text-[13px] font-medium" style={{ color: "var(--color-text-secondary)" }}>
            策略详情
          </p>
          {strategies.map((s, idx) => (
            <div
              key={s.tempId}
              className="rounded-[10px] p-3.5"
              style={{ backgroundColor: "var(--color-surface-card)", border: "1px solid var(--lifeflow-border)" }}
            >
              <div className="flex items-center justify-between mb-1.5">
                <span className="text-[12px] font-medium" style={{ color: "var(--lifeflow-primary)" }}>
                  策略 {idx + 1}
                </span>
                {strategies.length > 1 && (
                  <button type="button" onClick={() => removeStrategy(s.tempId)}>
                    <Trash2 className="w-3.5 h-3.5" style={{ color: "var(--color-text-disabled)" }} />
                  </button>
                )}
              </div>
              <input
                type="text"
                value={s.name}
                onChange={(e) => updateStrategy(s.tempId, "name", e.target.value)}
                placeholder="策略名称（如：饮食控制）"
                className="w-full rounded-[8px] px-3 py-2 text-[14px] outline-none mb-1.5 placeholder-[var(--color-text-disabled)]"
                style={{
                  color: "var(--color-text-primary)",
                  backgroundColor: "var(--lifeflow-muted)",
                  caretColor: "var(--lifeflow-primary)",
                }}
              />
              <textarea
                value={s.description}
                onChange={(e) => updateStrategy(s.tempId, "description", e.target.value)}
                placeholder="策略描述（选填）"
                rows={2}
                className="w-full rounded-[8px] px-3 py-2 text-[13px] outline-none resize-none placeholder-[var(--color-text-disabled)]"
                style={{
                  color: "var(--color-text-secondary)",
                  backgroundColor: "var(--lifeflow-muted)",
                  caretColor: "var(--lifeflow-primary)",
                }}
              />
            </div>
          ))}
          <button
            type="button"
            onClick={addStrategy}
            className="flex items-center justify-center gap-1.5 py-2.5 rounded-[10px] text-[14px] font-medium"
            style={{
              color: "var(--lifeflow-primary)",
              border: "1px dashed var(--lifeflow-border)",
              backgroundColor: "var(--color-surface-card)",
            }}
          >
            <Plus className="w-4 h-4" /> 添加策略
          </button>
        </div>
      )}

      {/* 主题色 */}
      <div
        className="rounded-[10px] p-4"
        style={{ backgroundColor: "var(--color-surface-card)", border: "1px solid var(--lifeflow-border)" }}
      >
        <p className="text-[13px] mb-2.5 font-medium" style={{ color: "var(--color-text-secondary)" }}>
          主题色
        </p>
        <div className="flex flex-wrap gap-2.5">
          {PRESET_COLORS.map((c) => (
            <button
              key={c}
              type="button"
              onClick={() => setColor(c)}
              className="w-7 h-7 rounded-full flex items-center justify-center transition-transform"
              style={{
                backgroundColor: c,
                transform: color === c ? "scale(1.2)" : "scale(1)",
                boxShadow: color === c ? `0 0 0 2px var(--color-surface-card), 0 0 0 3px ${c}` : "none",
              }}
            >
              {color === c && <Check className="w-3.5 h-3.5 text-white" />}
            </button>
          ))}
          <label className="w-7 h-7 rounded-full flex items-center justify-center cursor-pointer overflow-hidden"
            style={{ border: "1px dashed var(--lifeflow-border)" }}>
            <input
              type="color"
              value={color}
              onChange={(e) => setColor(e.target.value)}
              className="w-7 h-7 cursor-pointer opacity-0 absolute"
            />
            <span className="text-[16px]" style={{ color: "var(--color-text-disabled)" }}>+</span>
          </label>
        </div>
      </div>
    </motion.div>
  );

  const renderStep4 = () => (
    <motion.div
      key="step4"
      initial={{ opacity: 0, x: 20 }}
      animate={{ opacity: 1, x: 0 }}
      className="px-4 flex flex-col gap-3"
    >
      <p className="text-[13px] px-1" style={{ color: "var(--color-text-secondary)" }}>
        为每个策略规划本周要完成的任务
      </p>
      {weeklyTasks.map((wt, idx) => {
        const strategy = strategies.find((s) => s.tempId === wt.strategyId);
        return (
          <div
            key={wt.tempId}
            className="rounded-[10px] p-4"
            style={{ backgroundColor: "var(--color-surface-card)", border: "1px solid var(--lifeflow-border)" }}
          >
            <div className="flex items-center justify-between mb-2">
              <span className="text-[12px] font-medium" style={{ color: "var(--lifeflow-primary)" }}>
                周任务 {idx + 1}
                {strategy && (
                  <span className="ml-1.5 font-normal" style={{ color: "var(--color-text-disabled)" }}>
                    · {strategy.name}
                  </span>
                )}
              </span>
              {weeklyTasks.length > 1 && (
                <button type="button" onClick={() => removeWeeklyTask(wt.tempId)}>
                  <Trash2 className="w-3.5 h-3.5" style={{ color: "var(--color-text-disabled)" }} />
                </button>
              )}
            </div>
            <input
              type="text"
              value={wt.title}
              onChange={(e) => updateWeeklyTask(wt.tempId, "title", e.target.value)}
              placeholder="任务标题"
              className="w-full rounded-[8px] px-3 py-2 text-[14px] outline-none mb-1.5 placeholder-[var(--color-text-disabled)]"
              style={{
                color: "var(--color-text-primary)",
                backgroundColor: "var(--lifeflow-muted)",
                caretColor: "var(--lifeflow-primary)",
              }}
            />
            <textarea
              value={wt.deliverable}
              onChange={(e) => updateWeeklyTask(wt.tempId, "deliverable", e.target.value)}
              placeholder="本周交付成果（选填）"
              rows={2}
              className="w-full rounded-[8px] px-3 py-2 text-[13px] outline-none resize-none placeholder-[var(--color-text-disabled)]"
              style={{
                color: "var(--color-text-secondary)",
                backgroundColor: "var(--lifeflow-muted)",
                caretColor: "var(--lifeflow-primary)",
              }}
            />
          </div>
        );
      })}
      <button
        type="button"
        onClick={addWeeklyTask}
        className="flex items-center justify-center gap-1.5 py-2.5 rounded-[10px] text-[14px] font-medium"
        style={{
          color: "var(--lifeflow-primary)",
          border: "1px dashed var(--lifeflow-border)",
          backgroundColor: "var(--color-surface-card)",
        }}
      >
        <Plus className="w-4 h-4" /> 添加周任务
      </button>
    </motion.div>
  );

  const renderStep5 = () => (
    <motion.div
      key="step5"
      initial={{ opacity: 0, x: 20 }}
      animate={{ opacity: 1, x: 0 }}
      className="px-4 flex flex-col gap-3"
    >
      <p className="text-[13px] px-1" style={{ color: "var(--color-text-secondary)" }}>
        将周任务拆解为每日具体行动
      </p>
      {dailyActions.map((da, idx) => {
        const wt = weeklyTasks.find((t) => t.tempId === da.weeklyTaskId);
        return (
          <div
            key={da.tempId}
            className="rounded-[10px] p-4"
            style={{ backgroundColor: "var(--color-surface-card)", border: "1px solid var(--lifeflow-border)" }}
          >
            <div className="flex items-center justify-between mb-2">
              <span className="text-[12px] font-medium" style={{ color: "var(--lifeflow-primary)" }}>
                每日行动 {idx + 1}
                {wt && (
                  <span className="ml-1.5 font-normal" style={{ color: "var(--color-text-disabled)" }}>
                    · {wt.title}
                  </span>
                )}
              </span>
              {dailyActions.length > 1 && (
                <button type="button" onClick={() => removeDailyAction(da.tempId)}>
                  <Trash2 className="w-3.5 h-3.5" style={{ color: "var(--color-text-disabled)" }} />
                </button>
              )}
            </div>
            <input
              type="text"
              value={da.title}
              onChange={(e) => updateDailyAction(da.tempId, "title", e.target.value)}
              placeholder="行动内容"
              className="w-full rounded-[8px] px-3 py-2 text-[14px] outline-none mb-2 placeholder-[var(--color-text-disabled)]"
              style={{
                color: "var(--color-text-primary)",
                backgroundColor: "var(--lifeflow-muted)",
                caretColor: "var(--lifeflow-primary)",
              }}
            />
            <div className="flex gap-2">
              <div className="flex-1">
                <span className="text-[11px]" style={{ color: "var(--color-text-disabled)" }}>时间</span>
                <input
                  type="time"
                  value={da.time}
                  onChange={(e) => updateDailyAction(da.tempId, "time", e.target.value)}
                  className="w-full rounded-[8px] px-3 py-2 text-[14px] outline-none mt-1"
                  style={{
                    color: "var(--color-text-primary)",
                    backgroundColor: "var(--lifeflow-muted)",
                  }}
                />
              </div>
              <div className="w-24">
                <span className="text-[11px]" style={{ color: "var(--color-text-disabled)" }}>时长（分）</span>
                <input
                  type="number"
                  value={da.duration || ""}
                  onChange={(e) => updateDailyAction(da.tempId, "duration", Number(e.target.value) || 0)}
                  placeholder="30"
                  className="w-full rounded-[8px] px-3 py-2 text-[14px] outline-none mt-1"
                  style={{
                    color: "var(--color-text-primary)",
                    backgroundColor: "var(--lifeflow-muted)",
                  }}
                />
              </div>
              <div className="flex-1">
                <span className="text-[11px]" style={{ color: "var(--color-text-disabled)" }}>日期</span>
                <input
                  type="date"
                  value={da.date}
                  onChange={(e) => updateDailyAction(da.tempId, "date", e.target.value)}
                  className="w-full rounded-[8px] px-3 py-2 text-[14px] outline-none mt-1"
                  style={{
                    color: "var(--color-text-primary)",
                    backgroundColor: "var(--lifeflow-muted)",
                  }}
                />
              </div>
            </div>
          </div>
        );
      })}
      <button
        type="button"
        onClick={addDailyAction}
        className="flex items-center justify-center gap-1.5 py-2.5 rounded-[10px] text-[14px] font-medium"
        style={{
          color: "var(--lifeflow-primary)",
          border: "1px dashed var(--lifeflow-border)",
          backgroundColor: "var(--color-surface-card)",
        }}
      >
        <Plus className="w-4 h-4" /> 添加每日行动
      </button>
    </motion.div>
  );

  // ============================================================
  // 渲染
  // ============================================================

  return (
    <div className="min-h-screen flex flex-col" style={{ backgroundColor: "var(--lifeflow-background)" }}>
      {/* ===== 头部 ===== */}
      <div
        style={{
          backgroundColor: "var(--color-surface-card)",
          borderBottom: "1px solid var(--lifeflow-border)",
        }}
      >
        <div
          className="h-[44px] px-4 flex items-center justify-between relative max-w-[430px] mx-auto"
          style={{ paddingTop: "var(--safe-area-top)" }}
        >
          <button
            type="button"
            onClick={() => {
              if (step > 1) {
                setStep((s) => s - 1);
              } else {
                router.back();
              }
            }}
            className="flex items-center gap-1 text-[15px]"
            style={{ color: "var(--color-text-secondary)" }}
          >
            {step > 1 ? <ChevronLeft className="w-5 h-5" /> : null}
            {step > 1 ? "上一步" : "取消"}
          </button>
          <span
            className="absolute left-1/2 -translate-x-1/2 text-[16px] font-semibold"
            style={{ color: "var(--color-text-primary)" }}
          >
            创建目标
          </span>
          <div className="w-12" />
        </div>

        {/* 步骤指示器 */}
        <StepIndicator current={step} />
      </div>

      {/* ===== 步骤标题 ===== */}
      <div className="max-w-[430px] mx-auto w-full pt-4 pb-2 px-4">
        <h2 className="text-[18px] font-bold" style={{ color: "var(--color-text-primary)" }}>
          {step === 1 && "描绘愿景"}
          {step === 2 && "定义关键结果"}
          {step === 3 && "选择策略模块"}
          {step === 4 && "预览周任务"}
          {step === 5 && "拆解每日行动"}
        </h2>
      </div>

      {/* ===== 步骤内容 ===== */}
      <div className="max-w-[430px] mx-auto w-full flex-1 overflow-y-auto">
        {step === 1 && renderStep1()}
        {step === 2 && renderStep2()}
        {step === 3 && renderStep3()}
        {step === 4 && renderStep4()}
        {step === 5 && renderStep5()}
      </div>

      {/* ===== 底部导航 ===== */}
      <div
        className="max-w-[430px] mx-auto w-full shrink-0"
        style={{
          backgroundColor: "var(--color-surface-card)",
          borderTop: "1px solid var(--lifeflow-border)",
        }}
      >
        <div className="px-4 py-3 flex gap-3">
          {step > 1 && (
            <button
              type="button"
              onClick={() => setStep((s) => s - 1)}
              className="flex-1 py-3 rounded-[10px] text-[15px] font-medium"
              style={{
                color: "var(--color-text-primary)",
                backgroundColor: "var(--lifeflow-muted)",
              }}
            >
              上一步
            </button>
          )}
          {step < 5 ? (
            <button
              type="button"
              onClick={() => {
                if (step === 3) {
                  handleToStep4();
                } else if (step === 4) {
                  handleToStep5();
                } else {
                  setStep((s) => s + 1);
                }
              }}
              disabled={
                (step === 1 && !canProceedFromStep1) ||
                (step === 2 && !canProceedFromStep2) ||
                (step === 3 && !canProceedFromStep3) ||
                (step === 4 && !canProceedFromStep4)
              }
              className={`flex-1 py-3 rounded-[10px] text-[15px] font-medium ${
                step > 1 ? "" : "flex-1"
              }`}
              style={{
                color: "#fff",
                backgroundColor:
                  ((step === 1 && !canProceedFromStep1) ||
                    (step === 2 && !canProceedFromStep2) ||
                    (step === 3 && !canProceedFromStep3) ||
                    (step === 4 && !canProceedFromStep4))
                    ? "var(--color-text-disabled)"
                    : "var(--lifeflow-primary)",
                opacity:
                  ((step === 1 && !canProceedFromStep1) ||
                    (step === 2 && !canProceedFromStep2) ||
                    (step === 3 && !canProceedFromStep3) ||
                    (step === 4 && !canProceedFromStep4))
                    ? 0.4
                    : 1,
              }}
            >
              下一步 <ChevronRight className="w-4 h-4 inline" />
            </button>
          ) : (
            <button
              type="button"
              onClick={handleSubmit}
              disabled={!canSubmit}
              className="flex-1 py-3 rounded-[10px] text-[15px] font-medium"
              style={{
                color: "#fff",
                backgroundColor: canSubmit ? "var(--lifeflow-primary)" : "var(--color-text-disabled)",
                opacity: canSubmit ? 1 : 0.4,
              }}
            >
              {submitting ? "创建中..." : `完成创建 (${strategies.length} 策略)`}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
