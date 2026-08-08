"use client";

import { useState, useEffect, useMemo, useCallback } from "react";
import { useRouter, useParams } from "next/navigation";
import { motion } from "framer-motion";
import * as Icons from "lucide-react";
import { ChevronLeft, Check, Trash2, Lightbulb, ListChecks, Sparkles } from "lucide-react";
import { getIdealDayConfig } from "@/lib/ideal-day";
import { ensureTemplates, selectTemplate, getFeatureMeta, getIdealDayPlans, saveIdealDayPlans, upsertIdealDayPlan, SEGMENT_META } from "@/lib/ideal-day-templates";
import type { IdealDayFeature, IdealDayPlanItem, IdealDayTemplateBlock, IdealDayBlockGroup } from "@/lib/types";
import { showToast } from "@/components/ui/Toast";
import { generateIdealDayItems } from "@/lib/ideal-day";

type IconCompType = React.ComponentType<{ className?: string; style?: React.CSSProperties }>;
const ICON_REGISTRY = Icons as unknown as Record<string, IconCompType>;

// ─── 独立规划页功能（T22.2：仅保留 3 个；其余改底部表单或跳模块页） ───
const PLAN_PAGE_FEATURES: IdealDayFeature[] = ['study', 'sleep', 'medication'];

/** 页内详细引导：功能说明 + 规划步骤 + 典型示例（T22.1 一页一段） */
interface PlanGuide {
  desc: string;                       // 该功能在此时间段的意义
  steps: string[];                    // 1-2-3 规划步骤
  examples: string[];                 // 2-3 条典型示例
  placeholder: string;                // 内容输入框占位
}

const PLAN_GUIDE: Record<IdealDayFeature, PlanGuide> = {
  study: {
    desc: "为目标时段安排具体学习内容，内容来自你的目标拆解，保存后自动联动目标进度",
    steps: ["选择本次要推进的目标（省考/四级等）", "填入今日课时或练习内容", "补充备注（难点/目标）"],
    examples: ["判断推理 第1+2讲 · 4h 硬约束", "四级听力精听 Unit 4 · 1 小时", "申论大作文提纲 · 限时 50 分钟"],
    placeholder: "例如：判断推理 第1+2讲",
  },
  workout: {
    desc: "为训练时段安排具体动作，训练中心打卡联动",
    steps: ["确定今日训练部位/类型", "填写动作清单（组数×次数）", "补充备注（重量/状态）"],
    examples: ["杠铃卧推 3×12 · 高位下拉 3×12", "农夫行走 20m×3 组 · 负重旋转 3×10", "跳箱 3×8 · 壶铃摆荡 3×12"],
    placeholder: "例如：杠铃卧推 3×12 + 高位下拉 3×12",
  },
  sleep: {
    desc: "为睡眠时段安排睡前仪式与作息，护航深度睡眠；保存后同步睡眠记录",
    steps: ["设定本时段目标（就寝/起床/午睡）", "睡前环境检查：灯光 / 室温 / 手机放置", "填写睡前仪式并保存（自动写入睡眠记录）"],
    examples: ["22:30 上床 · 睡前 30 分钟放下手机 · 暖色灯光", "午睡 30 分钟 · 定 13:00 闹钟 · 遮光窗帘", "睡前拉伸 10 分钟 · 手机放客厅充电"],
    placeholder: "例如：睡前 30 分钟放下手机 · 22:30 上床 · 暖色灯光",
  },
  diet: {
    desc: "为用餐时段安排具体饮食，健康饮食一目了然",
    steps: ["确定该餐类型（早餐/午餐/晚餐）", "填写本餐内容清单", "补充备注（量/忌口）"],
    examples: ["燕麦 + 鸡蛋 + 牛奶", "杂粮饭 + 鸡胸肉 + 时蔬", "清淡为主 · 七分饱"],
    placeholder: "例如：燕麦 + 鸡蛋 + 牛奶",
  },
  water: {
    desc: "为饮水时段安排饮水目标，达成每日饮水总量",
    steps: ["确认该时段饮水目标（ml）", "填写具体饮水安排", "补充备注（提醒/杯量）"],
    examples: ["上午目标 700ml · 每 45 分钟喝一杯", "下午目标 800ml · 第 2 时段", "晚餐后温水 300ml"],
    placeholder: "例如：本时段饮水 700ml · 每 45 分钟一杯",
  },
  focus: {
    desc: "为专注时段安排番茄任务，高效进入心流",
    steps: ["确定该时段专注任务", "填写番茄轮次与时长", "补充备注（干扰处理）"],
    examples: ["番茄 4 轮 · 25 分钟学习 + 5 分钟休息", "番茄 3 轮 · 重点突破听力", "2 轮深度专注 · 手机放另一个房间"],
    placeholder: "例如：番茄 4 轮 · 25 分钟学习 + 5 分钟休息",
  },
  // 非一页一段功能（由理想日页直接跳模块页，类型占位）
  posture: {
    desc: "为体态拉伸时段安排拉伸动作",
    steps: ["确定拉伸部位", "填写动作清单", "补充备注"],
    examples: ["坐姿矫正 5 分钟 · 拉伸 15 分钟"],
    placeholder: "例如：肩颈拉伸 + 坐姿矫正",
  },
  wellness: {
    desc: "为功法养生时段安排养生内容",
    steps: ["确定养生功法", "填写具体内容", "补充备注"],
    examples: ["八段锦 1 遍 · 呼吸训练 10 分钟"],
    placeholder: "例如：八段锦 + 腹式呼吸",
  },
  leisure: {
    desc: "自由留白时段",
    steps: ["确认放松方式", "填写安排", "补充备注"],
    examples: ["散步 30 分钟 · 听播客"],
    placeholder: "例如：散步 + 轻音乐",
  },
  notes: {
    desc: "为备忘时段安排记录内容",
    steps: ["确定记录主题", "填写要点", "补充备注"],
    examples: ["今日灵感记录 · 待办整理"],
    placeholder: "例如：记录今日灵感与待办",
  },
  routine: {
    desc: "为作息时段安排例行事项",
    steps: ["确认例行内容", "填写安排", "补充备注"],
    examples: ["洗漱 + 早餐 · 整理书包"],
    placeholder: "例如：洗漱 + 早餐 + 出门准备",
  },
  medication: {
    desc: "为吃药时段安排用药，保存后自动写入用药记录，按时按量不遗漏",
    steps: ["确认药品与剂量", "填写用药内容", "保存（自动记录用药并联动提醒）"],
    examples: ["早饭后 1 粒 · 温水送服", "中午随餐 1 片 · 饭后服用", "睡前 1 粒 · 避免咖啡因"],
    placeholder: "例如：早饭后服药 1 粒",
  },
};

function todayStr(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

export default function IdealDayPlanPage() {
  const router = useRouter();
  const params = useParams<{ blockId: string; feature: string }>();
  const blockId = params?.blockId ?? '';
  const feature = (params?.feature ?? '') as IdealDayFeature;
  const today = todayStr();

  const [config, setConfig] = useState<Awaited<ReturnType<typeof getIdealDayConfig>> | null>(null);
  const [plans, setPlans] = useState<IdealDayPlanItem[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [content, setContent] = useState('');
  const [detail, setDetail] = useState('');
  const [saving, setSaving] = useState(false);
  const [goals, setGoals] = useState<{ id: string; title: string }[]>([]);
  const [goalId, setGoalId] = useState('');

  const reload = useCallback(async () => {
    const c = await getIdealDayConfig();
    setConfig(c);
    setPlans(await getIdealDayPlans(today));
    // 目标规划：加载目标列表（省考/四级等）
    if (feature === 'study') {
      try {
        const { getAllGoalsV2 } = await import("@/lib/db/efficiency.db");
        const list = await getAllGoalsV2();
        setGoals(list.map((g) => ({ id: g.id, title: g.title })));
      } catch { setGoals([]); }
    }
    setLoaded(true);
  }, [today, feature]);

  useEffect(() => { reload(); }, [reload]);

  // 当前规划块（从今日生效模板定位）
  const block = useMemo<IdealDayTemplateBlock | null>(() => {
    if (!config || !blockId) return null;
    const { config: cfg } = ensureTemplates(config);
    const tpl = selectTemplate(cfg, today);
    return tpl.blocks.find((b) => b.id === blockId) ?? null;
  }, [config, blockId, today]);

  const meta = getFeatureMeta(feature);
  const guide = PLAN_GUIDE[feature];

  // 已有规划回填
  useEffect(() => {
    if (!loaded || !blockId) return;
    const existing = plans.find((p) => p.blockId === blockId && p.feature === feature);
    if (existing) {
      setContent(existing.content ?? '');
      setDetail(existing.detail ?? '');
    }
  }, [loaded]); // eslint-disable-line react-hooks/exhaustive-deps

  if (!PLAN_PAGE_FEATURES.includes(feature) || !guide) {
    return null; // 非可规划功能：由理想日页直接跳模块页
  }

  const IconComp = ICON_REGISTRY[meta.icon] ?? Icons.Circle;
  const segMeta = block ? SEGMENT_META[block.group as IdealDayBlockGroup] : null;
  const existingPlan = loaded ? plans.find((p) => p.blockId === blockId && p.feature === feature) : undefined;

  const handleSave = async () => {
    if (saving || !block) return;
    setSaving(true);
    try {
      if (!content.trim()) {
        showToast({ type: "error", message: "请先填写具体内容" });
        return;
      }
      let merged = [...plans];
      merged = upsertIdealDayPlan(merged, {
        blockId,
        feature,
        content: content.trim(),
        detail: detail?.trim() || undefined,
        start: block.start,
        end: block.end,
        isCompleted: existingPlan?.isCompleted ?? false,
      });
      await saveIdealDayPlans(today, merged);
      setPlans(merged);
      await generateIdealDayItems(today);
      // T22.2 功能模块联动：睡眠→睡眠记录；吃药→用药记录
      if (feature === 'sleep') {
        const { addSleepLog } = await import("@/lib/db/health.db");
        const targetTime = block.start; // 就寝目标时间（该时段开始）
        await addSleepLog({
          date: today,
          targetTime,
          actualTime: '',
          isOnTime: false,
          minutesDiff: 0,
        });
      }
      if (feature === 'medication') {
        const { upsertMedicineLog } = await import("@/lib/db/health.db");
        const timeSlot = block.group === 'sleep' ? 'bedtime' : block.start < '12:00' ? 'morning' : block.start < '18:00' ? 'noon' : 'evening';
        await upsertMedicineLog({
          medicineId: `ideal-${block.id}`,
          date: today,
          timeSlot,
          taken: false,
          note: content.trim(),
        });
      }
      showToast({ type: "success", message: feature === 'sleep' ? "睡眠规划已保存，已写入睡眠记录" : feature === 'medication' ? "用药规划已保存，已写入用药记录" : `${meta.label}规划已保存，日程已更新` });
    } catch {
      showToast({ type: "error", message: "保存失败，请重试" });
    } finally {
      setSaving(false);
    }
  };

  const handleClear = async () => {
    const next = plans.filter((p) => !(p.blockId === blockId && p.feature === feature));
    await saveIdealDayPlans(today, next);
    setPlans(next);
    setContent('');
    setDetail('');
    showToast({ type: "success", message: "已清除该时段规划" });
  };

  return (
    <div className="min-h-screen max-w-[430px] mx-auto pb-[110px]" style={{ background: "var(--lifeflow-background)" }}>
      {/* Header */}
      <div className="flex items-center justify-center h-[52px] px-4 pt-[var(--safe-area-top)] relative">
        <button type="button" onClick={() => router.push('/ideal-day')} className="absolute left-4 top-[calc(var(--safe-area-top)+4px)] flex h-8 w-8 items-center justify-center rounded-full active:opacity-70" aria-label="返回理想日">
          <ChevronLeft className="w-5 h-5" style={{ color: "var(--lifeflow-primary)" }} />
        </button>
        <h1 className="flex items-center gap-1.5 text-[17px] font-bold tracking-tight" style={{ color: "var(--color-text-primary)" }}>
          <IconComp className="w-[18px] h-[18px]" style={{ color: meta.color }} />
          {feature === 'study' ? '目标规划' : `${meta.label}规划`}
        </h1>
        <div className="w-8" />
      </div>

      <div className="px-4 pt-3">
        {/* 时间段信息卡 */}
        {block && segMeta && (
          <div className="flex items-center gap-2.5 rounded-xl px-4 py-3 mb-3" style={{ background: "var(--lifeflow-card)", boxShadow: "var(--lifeflow-shadow-1)" }}>
            <span className="flex h-8 w-8 items-center justify-center rounded-lg" style={{ background: `${segMeta.color}14`, color: segMeta.color }}>
              {(() => { const C = ICON_REGISTRY[segMeta.icon] ?? Icons.Circle; return <C className="h-4 w-4" />; })()}
            </span>
            <div className="min-w-0 flex-1">
              <p className="text-[14px] font-semibold truncate" style={{ color: "var(--color-text-primary)" }}>{block.label}</p>
              <p className="text-[12px] tabular-nums mt-0.5" style={{ color: "var(--color-text-tertiary)" }}>
                {segMeta.label}段 · {block.start} - {block.end}
              </p>
            </div>
            {existingPlan && (
              <span className="shrink-0 text-[11px] px-2 py-0.5 rounded-full" style={{ background: "var(--state-success-light)", color: "var(--state-success)" }}>
                已安排
              </span>
            )}
          </div>
        )}

        {!block ? (
          <div className="rounded-[20px] py-10 text-center px-6" style={{ background: "var(--color-surface-card)", boxShadow: "var(--shadow-card)" }}>
            <p className="text-[15px] font-medium" style={{ color: "var(--color-text-primary)" }}>该时段不存在</p>
            <p className="text-[12px] mt-1" style={{ color: "var(--color-text-secondary)" }}>模板已变更，请返回理想日查看</p>
            <button type="button" onClick={() => router.push('/ideal-day')}
              className="mt-4 px-5 h-9 rounded-full text-[13px] font-medium text-white" style={{ background: "var(--lifeflow-primary)" }}>
              返回理想日
            </button>
          </div>
        ) : (
          <>
            {/* 功能说明区 */}
            <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
              className="rounded-[20px] p-4 mb-3" style={{ background: "var(--color-surface-card)", boxShadow: "var(--shadow-card)" }}>
              <div className="flex items-center gap-2 mb-2">
                <Lightbulb className="w-4 h-4" style={{ color: meta.color }} />
                <h2 className="text-[14px] font-semibold" style={{ color: "var(--color-text-primary)" }}>本时段说明</h2>
              </div>
              <p className="text-[13px] leading-relaxed" style={{ color: "var(--color-text-secondary)" }}>{guide.desc}</p>
            </motion.div>

            {/* 规划步骤区 */}
            <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.05 }}
              className="rounded-[20px] p-4 mb-3" style={{ background: "var(--color-surface-card)", boxShadow: "var(--shadow-card)" }}>
              <div className="flex items-center gap-2 mb-2.5">
                <ListChecks className="w-4 h-4" style={{ color: meta.color }} />
                <h2 className="text-[14px] font-semibold" style={{ color: "var(--color-text-primary)" }}>规划步骤</h2>
              </div>
              <div className="flex flex-col">
                {guide.steps.map((s, i) => (
                  <div key={i} className="flex items-center gap-2.5 py-1.5">
                    <span className="flex h-5 w-5 items-center justify-center rounded-full text-[11px] font-semibold shrink-0"
                      style={{ background: `${meta.color}1A`, color: meta.color }}>{i + 1}</span>
                    <span className="text-[13px]" style={{ color: "var(--color-text-primary)" }}>{s}</span>
                  </div>
                ))}
              </div>
            </motion.div>

            {/* 目标选择（目标规划专属，联动目标页面） */}
            {feature === 'study' && (
              <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.08 }}
                className="rounded-[20px] p-4 mb-3" style={{ background: "var(--color-surface-card)", boxShadow: "var(--shadow-card)" }}>
                <label className="block text-[14px] font-semibold mb-1.5" style={{ color: "var(--color-text-primary)" }}>
                  本次推进的目标 <span style={{ color: "var(--state-error)" }}>*</span>
                </label>
                {goals.length === 0 ? (
                  <p className="text-[12px]" style={{ color: "var(--color-text-tertiary)" }}>
                    暂无目标，先去「目标」页创建（省考/四级等）
                  </p>
                ) : (
                  <div className="flex flex-wrap gap-1.5">
                    {goals.map((g) => (
                      <button key={g.id} type="button"
                        onClick={() => { setGoalId(g.id); setContent((c) => (c.includes(g.title) ? c : `${g.title} · ${c}`.replace(" · ", c ? " · " : "").trim())); }}
                        className="flex items-center gap-1 px-3 h-8 rounded-full text-[12px] font-medium active:opacity-70"
                        style={{
                          background: goalId === g.id ? "rgba(99,102,241,0.16)" : "var(--lifeflow-background)",
                          border: `1px solid ${goalId === g.id ? "rgba(99,102,241,1)" : "transparent"}`,
                          color: goalId === g.id ? "rgba(99,102,241,1)" : "var(--color-text-primary)",
                        }}>
                        {g.title}
                      </button>
                    ))}
                  </div>
                )}
              </motion.div>
            )}

            {/* 填写区 */}
            <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}
              className="rounded-[20px] p-4 mb-3" style={{ background: "var(--color-surface-card)", boxShadow: "var(--shadow-card)" }}>
              <label className="block text-[14px] font-semibold mb-1.5" style={{ color: "var(--color-text-primary)" }}>
                {meta.label}内容 <span style={{ color: "var(--state-error)" }}>*</span>
              </label>
              <input
                value={content}
                onChange={(e) => setContent(e.target.value)}
                placeholder={guide.placeholder}
                aria-label={`${meta.label}内容`}
                className="w-full px-3.5 py-3 rounded-xl text-[14px] outline-none mb-3"
                style={{ background: "var(--lifeflow-background)", color: "var(--color-text-primary)" }}
              />
              <label className="block text-[14px] font-semibold mb-1.5" style={{ color: "var(--color-text-primary)" }}>
                补充说明 <span className="text-[12px] font-normal" style={{ color: "var(--color-text-tertiary)" }}>（可选）</span>
              </label>
              <input
                value={detail}
                onChange={(e) => setDetail(e.target.value)}
                placeholder="补充备注…"
                aria-label="补充说明"
                className="w-full px-3.5 py-2.5 rounded-xl text-[13px] outline-none"
                style={{ background: "var(--lifeflow-background)", color: "var(--color-text-secondary)" }}
              />
            </motion.div>

            {/* 示例区 */}
            <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.15 }}
              className="rounded-[20px] p-4 mb-3" style={{ background: "var(--color-surface-card)", boxShadow: "var(--shadow-card)" }}>
              <div className="flex items-center gap-2 mb-2.5">
                <Sparkles className="w-4 h-4" style={{ color: meta.color }} />
                <h2 className="text-[14px] font-semibold" style={{ color: "var(--color-text-primary)" }}>示例参考</h2>
              </div>
              <div className="flex flex-col gap-1.5">
                {guide.examples.map((ex, i) => (
                  <button key={i} type="button" onClick={() => setContent(ex)}
                    className="text-left px-3 py-2 rounded-xl active:opacity-70" style={{ background: "var(--lifeflow-background)" }}>
                    <span className="text-[12.5px] leading-relaxed" style={{ color: "var(--color-text-secondary)" }}>{ex}</span>
                  </button>
                ))}
              </div>
            </motion.div>

            {/* 操作区（flex 自然流） */}
            <div className="flex items-center gap-2">
              {existingPlan && (
                <button type="button" onClick={handleClear}
                  className="flex items-center gap-1 px-3 h-11 rounded-full text-[13px] font-medium" style={{ background: "var(--lifeflow-muted)", color: "var(--state-error)" }}>
                  <Trash2 className="w-3.5 h-3.5" /> 清除
                </button>
              )}
              <button type="button" onClick={handleSave} disabled={saving}
                className="flex-1 h-11 rounded-full text-white text-[15px] font-semibold active:opacity-90 disabled:opacity-50"
                style={{ background: "var(--lifeflow-primary)", boxShadow: "0 4px 16px rgba(37,99,235,0.3)" }}>
                {saving ? "保存中…" : "保存规划并更新日程"}
              </button>
            </div>
            <p className="text-[11px] text-center mt-2" style={{ color: "var(--color-text-tertiary)" }}>
              保存后打开「日程」页，该时段自动显示安排的具体内容
            </p>
          </>
        )}
      </div>
    </div>
  );
}
