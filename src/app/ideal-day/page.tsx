"use client";

import { useState, useEffect, useMemo, useCallback } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import * as Icons from "lucide-react";
import {
  ChevronDown, ChevronUp, Plus, Minus, Copy, Pencil, Check, X, Sparkles,
} from "lucide-react";
import { getIdealDayConfig, saveIdealDayConfig, applyIdealDayBlueprint } from "@/lib/ideal-day";
import {
  ensureTemplates, selectTemplate, getFeatureMeta, getAllFeatures, defaultWorkdayTemplate,
  defaultWeekendTemplate, getIdealDayPlans, SEGMENT_META, SEGMENT_ORDER,
} from "@/lib/ideal-day-templates";
import type {
  IdealDayConfig, IdealDayTemplate, IdealDayFeature, IdealDayBlockGroup,
} from "@/lib/types";
import { showToast } from "@/components/ui/Toast";
import { useMedicineMode } from "@/lib/use-medicine-mode";

// ─── Toggle ─────────────────────────────────────────────────
function ToggleSwitch({ checked, onChange, label }: { checked: boolean; onChange: () => void; label: string }) {
  return (
    <button type="button" role="switch" aria-checked={checked} aria-label={label} onClick={onChange}
      className="relative shrink-0 rounded-full cursor-pointer border-none outline-none"
      style={{ width: 51, height: 31, background: checked ? "var(--lifeflow-primary)" : "var(--lifeflow-border)", transition: "background 0.2s" }}>
      <div className="absolute rounded-full bg-white"
        style={{ width: 27, height: 27, top: 2, left: checked ? 22 : 2, boxShadow: "0 1px 3px rgba(0,0,0,0.15)", transition: "left 0.2s" }} />
    </button>
  );
}

type IconCompType = React.ComponentType<{ className?: string; style?: React.CSSProperties }>;
const ICON_REGISTRY = Icons as unknown as Record<string, IconCompType>;

// ─── 功能图标行（执行区：点击跳规划/模块页） ────────────────
function FeatureIconRow({ features, onFeatureClick }: { features: IdealDayFeature[]; onFeatureClick: (f: IdealDayFeature) => void }) {
  return (
    <div className="flex items-center gap-1.5 flex-wrap">
      {features.map((f) => {
        const meta = getFeatureMeta(f);
        const IconComp = ICON_REGISTRY[meta.icon] ?? Icons.Circle;
        return (
          <button
            key={f}
            type="button"
            onClick={(e) => { e.stopPropagation(); onFeatureClick(f); }}
            aria-label={`进入${meta.label}`}
            className="flex h-7 w-7 items-center justify-center rounded-full active:scale-90 transition-transform"
            style={{ background: `${meta.color}1A`, color: meta.color }}
          >
            <IconComp className="h-3.5 w-3.5" />
          </button>
        );
      })}
    </div>
  );
}

// ─── 功能多选面板（Step 1 用；睡眠段锁定只读） ──────────────
function FeaturePicker({ value, onChange, locked, medicineActive }: {
  value: IdealDayFeature[]; onChange: (v: IdealDayFeature[]) => void; locked?: boolean; medicineActive: boolean;
}) {
  const options = getAllFeatures().filter((f) => f !== 'medication' || medicineActive);
  return (
    <div className="flex flex-wrap gap-2 pt-1">
      {options.map((f) => {
        const meta = getFeatureMeta(f);
        const IconComp = ICON_REGISTRY[meta.icon] ?? Icons.Circle;
        const selected = value.includes(f);
        const isLocked = locked || f === 'sleep' && locked;
        return (
          <button
            key={f}
            type="button"
            disabled={isLocked}
            onClick={() => onChange(selected ? value.filter((x) => x !== f) : [...value, f])}
            className="flex flex-col items-center gap-1 rounded-xl px-2.5 py-2 active:opacity-70 transition-all disabled:opacity-50"
            style={{
              background: selected ? `${meta.color}1F` : "var(--lifeflow-muted)",
              border: `1px solid ${selected ? meta.color : "transparent"}`,
            }}
          >
            <IconComp className="h-4 w-4" style={{ color: selected ? meta.color : "var(--color-text-secondary)" }} />
            <span className="text-[10px] leading-none" style={{ color: selected ? "var(--color-text-primary)" : "var(--color-text-secondary)" }}>
              {meta.label}
            </span>
          </button>
        );
      })}
    </div>
  );
}

// ─── 编辑态：段配置 + 槽位 ─────────────────────────────────
interface SegmentEdit {
  group: IdealDayBlockGroup;
  start: string;
  end: string;
  features: IdealDayFeature[];
}

interface SlotEdit {
  id: string;
  group: IdealDayBlockGroup;
  feature: IdealDayFeature;
  label: string;
  start: string;
  end: string;
}

/** 功能推荐时长（分钟，Step 2 槽位默认时间来源，8+8+8 推荐语义） */
const SLOT_DURATION: Record<IdealDayFeature, number> = {
  sleep: 30, study: 90, workout: 60, posture: 30, wellness: 30,
  water: 10, diet: 30, focus: 45, leisure: 60, notes: 15, routine: 30, medication: 5,
};

function addMin(time: string, minutes: number): string {
  const [h, m] = time.split(":").map(Number);
  const total = h * 60 + m + minutes;
  const nh = ((Math.floor(total / 60) % 24) + 24) % 24;
  return `${String(nh).padStart(2, "0")}:${String(total % 60).padStart(2, "0")}`;
}

/** 睡眠段固定槽（夜间 + 午睡，不可增删，时间可改） */
const SLEEP_FIXED_SLOTS: SlotEdit[] = [
  { id: 'sleep-night', group: 'sleep', feature: 'sleep', label: '夜间睡眠', start: '22:30', end: '06:00' },
  { id: 'sleep-nap', group: 'sleep', feature: 'sleep', label: '午睡', start: '12:30', end: '13:00' },
];

/** 模板 → 段配置（Step 1 反向推导：段边界取 SEGMENT_META 默认；features 为段内功能并集） */
function segmentsFromTemplate(tpl: IdealDayTemplate): SegmentEdit[] {
  return SEGMENT_ORDER.map((g) => {
    const meta = SEGMENT_META[g];
    const blocks = tpl.blocks.filter((b) => b.group === g);
    return {
      group: g,
      start: meta.defaultStart,
      end: meta.defaultEnd,
      features: [...new Set(blocks.flatMap((b) => b.features))],
    };
  });
}

/** 模板 → 槽位（Step 2 反向推导：每块每功能展开为一槽） */
function slotsFromTemplate(tpl: IdealDayTemplate): SlotEdit[] {
  if (tpl.blocks.length === 0) return [];
  // 睡眠段：固定两槽（保留用户改过的时间）
  const sleepBlocks = tpl.blocks.filter((b) => b.group === 'sleep');
  const sleepSlots = sleepBlocks.length > 0
    ? sleepBlocks.map((b) => ({ id: b.id, group: 'sleep' as const, feature: 'sleep' as const, label: b.label, start: b.start, end: b.end }))
    : SLEEP_FIXED_SLOTS;
  const other = tpl.blocks
    .filter((b) => b.group !== 'sleep')
    .flatMap((b) => b.features.map((f) => ({ id: `${b.id}-${f}`, group: b.group, feature: f, label: b.label, start: b.start, end: b.end })));
  return [...sleepSlots, ...other];
}

/** 段配置 + 次数 → 槽位（Step 1 → Step 2 初次生成，按段起点 + 功能推荐时长顺序铺排） */
function slotsFromSegments(segments: SegmentEdit[]): SlotEdit[] {
  const slots: SlotEdit[] = [...SLEEP_FIXED_SLOTS];
  for (const seg of segments) {
    if (seg.group === 'sleep') continue;
    let cursor = seg.start;
    for (const f of seg.features) {
      const dur = SLOT_DURATION[f] ?? 30;
      const end = addMin(cursor, dur);
      slots.push({ id: `slot-${seg.group}-${f}-${slots.length}`, group: seg.group, feature: f, label: getFeatureMeta(f).label, start: cursor, end });
      cursor = end;
    }
  }
  return slots;
}

function todayStr(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

/** 内嵌底部表单占位（T22.2） */
const INLINE_SHEET_PLACEHOLDER: Partial<Record<IdealDayFeature, string>> = {
  workout: "例如：杠铃卧推 3×12 + 高位下拉 3×12",
  wellness: "例如：八段锦 1 遍 + 腹式呼吸 10 分钟",
  posture: "例如：肩颈拉伸 + 坐姿矫正",
  routine: "例如：洗漱 + 早餐 + 出门准备",
};

// ─── 结构化动作清单（T22.2 训练表单） ──────────────────────
interface PlanAction { name: string; sets: number; reps: number }
const ACTION_PRESETS = ["杠铃卧推", "高位下拉", "哑铃飞鸟", "深蹲", "硬拉", "跳箱", "壶铃摆荡", "平板支撑", "农夫行走", "引体向上"];
const serializeActions = (list: PlanAction[]) =>
  list.filter((a) => a.name.trim()).map((a) => `${a.name.trim()} ${a.sets}×${a.reps}`).join(" · ");
const parseActions = (s?: string): PlanAction[] => {
  if (!s) return [];
  try {
    const raw = JSON.parse(s);
    if (Array.isArray(raw)) return raw.filter((a) => a && typeof a.name === "string").map((a) => ({ name: a.name, sets: Number(a.sets) || 3, reps: Number(a.reps) || 12 }));
    return [];
  } catch {
    return s.split(/[·,，]/).map((x) => x.trim()).filter(Boolean).map((x) => ({ name: x, sets: 3, reps: 12 }));
  }
};

// ─── 功法养生动作模板（T22.2） ──────────────────────────────
interface PlanWellnessItem { name: string; minutes: number }
const WELLNESS_PRESETS: { name: string; minutes: number }[] = [
  { name: "八段锦", minutes: 12 }, { name: "五禽戏", minutes: 15 }, { name: "太极拳", minutes: 20 },
  { name: "站桩", minutes: 10 }, { name: "腹式呼吸", minutes: 5 }, { name: "冥想", minutes: 10 },
  { name: "经络拍打", minutes: 8 }, { name: "肩颈放松", minutes: 5 },
];
const serializeWellness = (list: PlanWellnessItem[]) =>
  list.filter((w) => w.name.trim()).map((w) => `${w.name.trim()} · ${w.minutes}分钟`).join(" · ");
const parseWellness = (s?: string): PlanWellnessItem[] => {
  if (!s) return [];
  try {
    const raw = JSON.parse(s);
    if (Array.isArray(raw)) return raw.filter((w) => w && typeof w.name === "string").map((w) => ({ name: w.name, minutes: Number(w.minutes) || 10 }));
    return [];
  } catch {
    return s.split(/[·,，]/).map((x) => x.trim()).filter(Boolean).map((x) => ({ name: x, minutes: 10 }));
  }
};

// ─── 作息例行清单分项（T22.2） ──────────────────────────────
interface PlanRoutineItem { name: string }
const ROUTINE_PRESETS = ["洗漱", "早餐", "整理书包", "出门准备", "午餐", "晚餐", "饭后散步", "睡前洗漱"];
const serializeRoutine = (list: PlanRoutineItem[]) => list.filter((r) => r.name.trim()).map((r) => r.name.trim()).join(" · ");
const parseRoutine = (s?: string): PlanRoutineItem[] => {
  if (!s) return [];
  try {
    const raw = JSON.parse(s);
    if (Array.isArray(raw)) return raw.filter((r) => r && typeof r.name === "string").map((r) => ({ name: r.name }));
    return [];
  } catch {
    return s.split(/[·,，]/).map((x) => x.trim()).filter(Boolean).map((x) => ({ name: x }));
  }
};

// ─── 体态拉伸结构化清单（T22.2） ─────────────────────────────
interface PlanPostureItem { name: string; seconds: number }
const POSTURE_PRESETS: { name: string; seconds: number }[] = [
  { name: "肩颈拉伸", seconds: 30 }, { name: "斜方肌拉伸", seconds: 30 }, { name: "猫式伸展", seconds: 60 },
  { name: "坐姿转体", seconds: 45 }, { name: "站立前屈", seconds: 60 }, { name: "蝴蝶式", seconds: 60 },
  { name: "小腿拉伸", seconds: 45 }, { name: "手腕放松", seconds: 30 },
];
const serializePosture = (list: PlanPostureItem[]) =>
  list.filter((p) => p.name.trim()).map((p) => `${p.name.trim()} ${p.seconds}秒`).join(" · ");
const parsePosture = (s?: string): PlanPostureItem[] => {
  if (!s) return [];
  try {
    const raw = JSON.parse(s);
    if (Array.isArray(raw)) return raw.filter((p) => p && typeof p.name === "string").map((p) => ({ name: p.name, seconds: Number(p.seconds) || 30 }));
    return [];
  } catch {
    return s.split(/[·,，]/).map((x) => x.trim()).filter(Boolean).map((x) => ({ name: x, seconds: 30 }));
  }
};

// ─── 三色环形表动态分布（T22.2：随理想日模板安排实时变化） ──
const toMin = (t: string) => { const [h, m] = t.split(":").map(Number); return (h || 0) * 60 + (m || 0); };
function computeDayDistribution(tpl: IdealDayTemplate) {
  let sleepMin = 0, goalMin = 0, lifeMin = 0;
  for (const b of tpl.blocks) {
    const dur = Math.max(0, toMin(b.end) - toMin(b.start));
    if (b.features.includes('sleep')) sleepMin += dur;
    else if (b.features.includes('study')) goalMin += dur;
    else lifeMin += dur;
  }
  const total = sleepMin + goalMin + lifeMin || 1;
  const seg = (min: number) => `${Math.round((min / total) * 360)}deg`;
  const fmtH = (min: number) => (min % 60 === 0 ? `${min / 60}h` : `${Math.floor(min / 60)}h${String(min % 60).padStart(2, "0")}m`);
  const labels: { name: string; color: string; text: string; blocks: string[] }[] = [
    { name: "睡眠", color: "#5856D6", text: fmtH(sleepMin), blocks: [] },
    { name: "目标", color: "#0A84FF", text: fmtH(goalMin), blocks: [] },
    { name: "生活", color: "#34C759", text: fmtH(lifeMin), blocks: [] },
  ];
  for (const b of tpl.blocks) {
    const key = b.features.includes('sleep') ? 0 : b.features.includes('study') ? 1 : 2;
    labels[key].blocks.push(b.label);
  }
  const gradient = `conic-gradient(${labels[0].color} 0deg ${seg(sleepMin)}, ${labels[1].color} ${seg(sleepMin)} ${seg(sleepMin + goalMin)}, ${labels[2].color} ${seg(sleepMin + goalMin)} 360deg)`;
  return { gradient, labels, totalH: Math.round(total / 60) };
}

// ─── 主页面 ─────────────────────────────────────────────────
export default function IdealDayHomePage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { active: medicineActive } = useMedicineMode();
  const [config, setConfig] = useState<IdealDayConfig | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [editMode, setEditMode] = useState(false);
  const [editing, setEditing] = useState<IdealDayTemplate | null>(null);
  const [step, setStep] = useState<1 | 2>(1);
  const [segments, setSegments] = useState<SegmentEdit[]>([]);
  const [slots, setSlots] = useState<SlotEdit[]>([]);
  const [saving, setSaving] = useState(false);
  // T22.2：日程页 ?block= 定位高亮
  const [focusBlockId, setFocusBlockId] = useState<string | null>(null);
  const [focusFlash, setFocusFlash] = useState(false);
  const [collapsedGroups, setCollapsedGroups] = useState<Set<IdealDayBlockGroup>>(new Set());
  const [plans, setPlans] = useState<Awaited<ReturnType<typeof getIdealDayPlans>>>([]);
  const [sheet, setSheet] = useState<{ open: boolean; feature: IdealDayFeature; blockId: string; content: string; detail: string; actions: PlanAction[]; wellness: PlanWellnessItem[]; routine: PlanRoutineItem[]; posture: PlanPostureItem[] }>({ open: false, feature: 'workout', blockId: '', content: '', detail: '', actions: [], wellness: [], routine: [], posture: [] });
  const [sheetSaving, setSheetSaving] = useState(false);

  const today = todayStr();
  const reload = useCallback(async () => {
    const c = await getIdealDayConfig();
    setConfig(c);
    setPlans(await getIdealDayPlans(today));
    setLoaded(true);
  }, [today]);

  useEffect(() => { reload(); }, [reload]);

  const derived = useMemo(() => (config ? ensureTemplates(config) : null), [config]);
  const activeTemplate = useMemo(() => (derived && config ? selectTemplate(derived.config, today) : null), [derived, config, today]);

  // ── 开始编辑 ──
  const startEdit = (tpl: IdealDayTemplate) => {
    setEditing(tpl);
    setSegments(segmentsFromTemplate(tpl));
    setSlots(slotsFromTemplate(tpl));
    setStep(1);
    setEditMode(true);
  };

  // ── Step 1：段配置 ──
  const updateSegment = (group: IdealDayBlockGroup, patch: Partial<SegmentEdit>) => {
    setSegments((prev) => prev.map((s) => (s.group === group ? { ...s, ...patch } : s)));
  };

  // ── Step 1 → Step 2 ──
  const goNext = () => {
    setSlots(slotsFromSegments(segments));
    setStep(2);
  };

  // ── Step 2：槽位操作 ──
  const updateSlot = (id: string, patch: Partial<SlotEdit>) => {
    setSlots((prev) => prev.map((s) => (s.id === id ? { ...s, ...patch } : s)));
  };
  const addSlot = (group: IdealDayBlockGroup, feature: IdealDayFeature) => {
    setSlots((prev) => {
      const groupSlots = prev.filter((s) => s.group === group);
      const last = groupSlots[groupSlots.length - 1];
      const start = last ? last.end : SEGMENT_META[group].defaultStart;
      const dur = SLOT_DURATION[feature] ?? 30;
      return [...prev, { id: `slot-${group}-${feature}-${Date.now()}`, group, feature, label: getFeatureMeta(feature).label, start, end: addMin(start, dur) }];
    });
  };
  const removeSlot = (id: string) => {
    setSlots((prev) => prev.filter((s) => s.id !== id));
  };

  // ── 保存（slots → blocks 扁平化） ──
  const handleSave = async () => {
    if (!config || !editing || saving) return;
    setSaving(true);
    try {
      // 睡眠段槽位固定（夜间/午睡），其余槽位按 feature 分组保留次数与独立时间
      const blocks = slots.map((s, i) => ({
        id: s.group === 'sleep' ? s.id : `${s.group}-${s.feature}-${i + 1}`,
        label: s.label,
        start: s.start,
        end: s.end,
        group: s.group,
        features: [s.feature] as IdealDayFeature[],
      }));
      const nextTpl: IdealDayTemplate = { ...editing, blocks };
      const nextConfig: IdealDayConfig = {
        ...config,
        templates: derived!.templates.map((t) => (t.id === nextTpl.id ? nextTpl : t)),
        activeTemplateId: nextTpl.id,
      };
      await saveIdealDayConfig(nextConfig);
      await applyIdealDayBlueprint();
      setConfig(nextConfig);
      setEditMode(false);
      setEditing(null);
      showToast({ type: "success", message: config.enabled ? "理想日已保存并重排" : "理想日已保存" });
    } catch {
      showToast({ type: "error", message: "保存失败，请重试" });
    } finally {
      setSaving(false);
    }
  };

  // ── 模板管理 ──
  const handleNewTemplate = () => {
    const t: IdealDayTemplate = {
      id: `custom-${Date.now()}`,
      name: "自定义副本",
      blocks: defaultWorkdayTemplate().blocks.map((b) => ({ ...b, id: `${b.id}-${Date.now()}` })),
    };
    startEdit(t);
  };
  const handleDuplicate = (tpl: IdealDayTemplate) => {
    const dup: IdealDayTemplate = { ...tpl, id: `${tpl.id}-copy-${Date.now()}`, name: `${tpl.name} 副本`, daysOfWeek: undefined };
    startEdit(dup);
  };
  const handleDelete = (id: string) => {
    if (!derived || !config) return;
    if (derived.templates.length <= 1) { showToast({ type: "error", message: "至少保留一个模板" }); return; }
    const next: IdealDayConfig = {
      ...config,
      templates: derived.templates.filter((t) => t.id !== id),
      activeTemplateId: derived.templates.find((t) => t.id !== id)?.id,
    };
    setConfig(next);
    showToast({ type: "success", message: "模板已删除" });
  };

  // ── 执行区 ──
  // T22.2 功能分发：独立规划页 / 页内底部表单 / 模块页跳转
  const INLINE_SHEET_FEATURES: IdealDayFeature[] = ['workout', 'wellness', 'posture', 'routine'];
  const PLAN_PAGE_FEATURES: IdealDayFeature[] = ['study', 'sleep', 'medication'];
  const MODULE_ROUTES: Partial<Record<IdealDayFeature, string>> = {
    water: '/more/water',
    diet: '/more/diet',
    focus: '/more/focus',
    notes: '/more/notes',
  };

  const handleFeatureClick = (blockId: string, f: IdealDayFeature) => {
    if (PLAN_PAGE_FEATURES.includes(f)) {
      router.push(`/ideal-day/plan/${blockId}/${f}`);
      return;
    }
    if (INLINE_SHEET_FEATURES.includes(f)) {
      const block = activeTemplate!.blocks.find((b) => b.id === blockId);
      if (!block) return;
      const existing = plans.find((p) => p.blockId === blockId && p.feature === f);
      // 结构化清单表单：从 detail 反序列化；历史单行内容兼容解析
      const actions = f === 'workout' ? parseActions(existing?.detail || existing?.content) : [];
      const wellness = f === 'wellness' ? parseWellness(existing?.detail || existing?.content) : [];
      const routine = f === 'routine' ? parseRoutine(existing?.detail || existing?.content) : [];
      const posture = f === 'posture' ? parsePosture(existing?.detail || existing?.content) : [];
      setSheet({ open: true, feature: f, blockId, content: existing?.content ?? '', detail: existing?.detail ?? '', actions, wellness, routine, posture });
      return;
    }
    if (f === 'leisure') {
      showToast({ type: "info", message: "留白 · 自由时间，什么都不安排" });
      return;
    }
    const route = MODULE_ROUTES[f] ?? getFeatureMeta(f).route;
    if (route) router.push(route);
  };

  // ── 内嵌底部表单保存 ──
  const handleSheetSave = async () => {
    if (sheetSaving) return;
    // 结构化清单表单：清单为空视为未填写
    const listContent =
      sheet.feature === 'workout' ? sheet.actions.some((a) => a.name.trim())
        : sheet.feature === 'wellness' ? sheet.wellness.some((w) => w.name.trim())
          : sheet.feature === 'routine' ? sheet.routine.some((r) => r.name.trim())
            : sheet.feature === 'posture' ? sheet.posture.some((p) => p.name.trim())
              : !!sheet.content.trim();
    if (!listContent) {
      const msg = sheet.feature === 'workout' ? "请至少添加一个动作"
        : sheet.feature === 'wellness' ? "请至少添加一个养生项目"
          : sheet.feature === 'routine' ? "请至少添加一个例行分项"
            : sheet.feature === 'posture' ? "请至少添加一个拉伸动作" : "请先填写具体内容";
      showToast({ type: "error", message: msg });
      return;
    }
    setSheetSaving(true);
    try {
      const block = activeTemplate!.blocks.find((b) => b.id === sheet.blockId);
      if (!block) return;
      const existing = plans.find((p) => p.blockId === sheet.blockId && p.feature === sheet.feature);
      const isWorkout = sheet.feature === 'workout';
      const isWellness = sheet.feature === 'wellness';
      const isRoutine = sheet.feature === 'routine';
      const isPosture = sheet.feature === 'posture';
      const content = isWorkout ? serializeActions(sheet.actions)
        : isWellness ? serializeWellness(sheet.wellness)
          : isRoutine ? serializeRoutine(sheet.routine)
            : isPosture ? serializePosture(sheet.posture)
              : sheet.content.trim();
      const detail = isWorkout ? (sheet.actions.some((a) => a.name.trim()) ? JSON.stringify(sheet.actions) : undefined)
        : isWellness ? (sheet.wellness.some((w) => w.name.trim()) ? JSON.stringify(sheet.wellness) : undefined)
          : isRoutine ? (sheet.routine.some((r) => r.name.trim()) ? JSON.stringify(sheet.routine) : undefined)
            : isPosture ? (sheet.posture.some((p) => p.name.trim()) ? JSON.stringify(sheet.posture) : undefined)
              : sheet.detail?.trim() || undefined;
      const item = {
        blockId: sheet.blockId,
        feature: sheet.feature,
        content,
        detail,
        start: block.start,
        end: block.end,
        isCompleted: existing?.isCompleted ?? false,
      };
      const { saveIdealDayPlans, upsertIdealDayPlan } = await import("@/lib/ideal-day-templates");
      const { generateIdealDayItems } = await import("@/lib/ideal-day");
      const merged = upsertIdealDayPlan(plans, item);
      await saveIdealDayPlans(today, merged);
      setPlans(merged);
      await generateIdealDayItems(today);
      setSheet((s) => ({ ...s, open: false }));
      showToast({ type: "success", message: `${getFeatureMeta(sheet.feature).label}规划已保存，日程已更新` });
    } catch {
      showToast({ type: "error", message: "保存失败，请重试" });
    } finally {
      setSheetSaving(false);
    }
  };
  const handleToggleBlock = async (blockId: string) => {
    const blockPlans = plans.filter((p) => p.blockId === blockId);
    if (blockPlans.length === 0) {
      showToast({ type: "info", message: "先点击功能图标安排具体内容" });
      return;
    }
    const allDone = blockPlans.every((p) => p.isCompleted);
    const next = blockPlans.map((p) => ({ ...p, isCompleted: !allDone }));
    const merged = plans.map((p) => {
      const nn = next.find((x) => x.blockId === p.blockId && x.feature === p.feature);
      return nn ?? p;
    });
    const { saveIdealDayPlans } = await import("@/lib/ideal-day-templates");
    await saveIdealDayPlans(today, merged);
    setPlans(merged);
    // T22.2：完成态同步到日程页
    const { generateIdealDayItems } = await import("@/lib/ideal-day");
    await generateIdealDayItems(today);
    showToast({ type: "success", message: allDone ? "已标记未完成" : "整段已完成，日程已同步" });
  };

  if (!loaded || !config || !derived || !activeTemplate) {
    return <div className="min-h-screen flex items-center justify-center" style={{ background: "var(--lifeflow-background)" }}><p style={{ color: "var(--color-text-secondary)" }}>加载中…</p></div>;
  }

  const templates = derived.templates;
  const displayTemplate = editing ?? activeTemplate;

  // T22.2/T22.4：日程页 ?block= / 效率页 ?goal= 定位——滚动到目标段并短暂高亮
  useEffect(() => {
    const targetBlock = searchParams?.get("block");
    const targetGoal = searchParams?.get("goal");
    if ((!targetBlock && !targetGoal) || editMode) return;
    let firstId: string | null = null;
    if (targetBlock) {
      firstId = targetBlock;
    } else if (targetGoal && plans.length > 0) {
      const ids = plans.filter((p) => p.goalId === targetGoal && p.feature === 'study').map((p) => p.blockId);
      if (ids.length > 0) firstId = ids[0];
    }
    if (!firstId) return;
    setFocusBlockId(firstId);
    setFocusFlash(true);
    const timer = setTimeout(() => {
      const el = document.getElementById(`ideal-block-${firstId}`);
      el?.scrollIntoView({ behavior: "smooth", block: "center" });
      setFocusFlash(false);
      const clear = setTimeout(() => setFocusBlockId(null), 1600);
      return () => clearTimeout(clear);
    }, 250);
    return () => clearTimeout(timer);
  }, [searchParams, editMode, displayTemplate?.id, loaded, plans]);

  // 执行区按 5 段分组
  const blocksBySegment = (tpl: IdealDayTemplate): Map<IdealDayBlockGroup, typeof tpl.blocks> => {
    const map = new Map<IdealDayBlockGroup, (typeof tpl.blocks)[number][]>();
    for (const g of SEGMENT_ORDER) map.set(g, []);
    for (const b of tpl.blocks) {
      const list = map.get(b.group) ?? [];
      list.push(b);
      map.set(b.group, list);
    }
    return map;
  };

  const slotsByGroup = (list: SlotEdit[]): Map<IdealDayBlockGroup, SlotEdit[]> => {
    const map = new Map<IdealDayBlockGroup, SlotEdit[]>();
    for (const g of SEGMENT_ORDER) map.set(g, []);
    for (const s of list) {
      const arr = map.get(s.group) ?? [];
      arr.push(s);
      map.set(s.group, arr);
    }
    return map;
  };

  return (
    <div className="min-h-screen max-w-[430px] mx-auto pb-[110px]" style={{ background: "var(--lifeflow-background)" }}>
      {/* Header */}
      <div className="px-4 pt-[var(--safe-area-top)] pb-3 flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <h1 className="text-[28px] font-bold leading-tight flex items-center gap-2" style={{ color: "var(--color-text-primary)", letterSpacing: "-0.02em" }}>
            理想日
          </h1>
          <p className="mt-1 text-[13px]" style={{ color: "var(--color-text-secondary)" }}>
            5 大段时间轴 · 每段功能独立规划
          </p>
        </div>
        <div className="flex items-center gap-2 shrink-0 mt-0.5">
          <ToggleSwitch checked={config.enabled} onChange={async () => {
            const next = { ...config, enabled: !config.enabled };
            setConfig(next);
            await saveIdealDayConfig(next);
            await applyIdealDayBlueprint();
            showToast({ type: "success", message: next.enabled ? "理想日已开启" : "理想日已关闭" });
          }} label="启用理想日" />
        </div>
      </div>

      {/* 三色环形表（T22.2：随当前模板安排动态变化） */}
      {(() => {
        const dist = computeDayDistribution(activeTemplate);
        return (
          <div className="px-4 mb-3">
            <div className="flex items-center gap-3 rounded-[20px] px-4 py-3.5" style={{ background: "var(--lifeflow-brand-50)" }}>
              <div className="relative h-16 w-16 shrink-0 rounded-full" style={{ background: dist.gradient }}>
                <div className="absolute left-1/2 top-1/2 h-10 w-10 -translate-x-1/2 -translate-y-1/2 rounded-full"
                  style={{ background: "var(--lifeflow-brand-50)" }} />
                <span className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 text-[11px] font-bold tabular-nums" style={{ color: "var(--color-text-primary)" }}>
                  {dist.totalH}h
                </span>
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-3 text-[12px] font-medium">
                  {dist.labels.map((l) => (
                    <span key={l.name} className="flex items-center gap-1">
                      <i className="h-2.5 w-2.5 rounded-full" style={{ background: l.color }} />
                      {l.name} {l.text}
                    </span>
                  ))}
                </div>
                <p className="text-[11px] leading-relaxed mt-1.5" style={{ color: "var(--color-text-secondary)" }}>
                  {dist.labels.map((l) => `${l.name} ${l.blocks.join(" + ") || "—"}`).join(" · ")}
                </p>
              </div>
            </div>
          </div>
        );
      })()}

      {/* 模板切换条 */}
      <div className="px-4 mb-3">
        <div className="flex items-center gap-2 overflow-x-auto no-scrollbar" style={{ scrollbarWidth: "none" }}>
          {templates.map((t) => (
            <button
              key={t.id}
              type="button"
              onClick={() => setEditMode(false)}
              className="flex items-center gap-1.5 shrink-0 px-3.5 h-9 rounded-full text-[13px] font-medium transition-all"
              style={{
                background: !editMode && t.id === activeTemplate.id ? "var(--lifeflow-primary)" : "var(--color-surface-card)",
                color: !editMode && t.id === activeTemplate.id ? "#fff" : "var(--color-text-primary)",
                boxShadow: "var(--shadow-card)",
              }}
            >
              {!editMode && t.id === activeTemplate.id && <Check className="w-3.5 h-3.5" />}
              {t.name}
              {t.daysOfWeek?.length ? <span className="text-[10px] opacity-70">{t.daysOfWeek.length} 天</span> : null}
            </button>
          ))}
          <button type="button" onClick={handleNewTemplate} aria-label="新建模板"
            className="flex items-center justify-center h-9 w-9 shrink-0 rounded-full" style={{ background: "var(--color-surface-card)", boxShadow: "var(--shadow-card)" }}>
            <Plus className="w-4 h-4" style={{ color: "var(--lifeflow-primary)" }} />
          </button>
        </div>
      </div>

      {/* 模板操作（非编辑态） */}
      {!editMode && (
        <div className="px-4 mb-3 flex items-center justify-between">
          <span className="text-[13px] font-medium" style={{ color: "var(--color-text-secondary)" }}>
            当前模板：{activeTemplate.name}
          </span>
          <div className="flex items-center gap-2">
            <button type="button" onClick={() => startEdit({ ...activeTemplate })}
              className="flex items-center gap-1 px-3 h-8 rounded-lg text-[12px] font-medium" style={{ background: "var(--lifeflow-brand-50)", color: "var(--lifeflow-primary)" }}>
              <Pencil className="w-3.5 h-3.5" /> 编辑模板
            </button>
            <button type="button" onClick={() => handleDuplicate(activeTemplate)}
              className="flex items-center gap-1 px-3 h-8 rounded-lg text-[12px] font-medium" style={{ background: "var(--lifeflow-muted)", color: "var(--color-text-secondary)" }}>
              <Copy className="w-3.5 h-3.5" /> 复制
            </button>
          </div>
        </div>
      )}

      {/* ── 编辑模式：两步向导 ── */}
      {editMode && editing && (
        <div className="px-4 space-y-3 mb-3">
          {/* 步骤指示 */}
          <div className="flex items-center gap-1.5">
            {[1, 2].map((s) => (
              <span key={s} className="flex items-center gap-1.5">
                <span className="flex h-5 w-5 items-center justify-center rounded-full text-[11px] font-semibold"
                  style={{ background: step === s ? "var(--lifeflow-primary)" : "var(--lifeflow-muted)", color: step === s ? "#fff" : "var(--color-text-secondary)" }}>
                  {s}
                </span>
                <span className="text-[12px]" style={{ color: step === s ? "var(--color-text-primary)" : "var(--color-text-tertiary)" }}>
                  {s === 1 ? "选择大段与功能" : "配置时间与次数"}
                </span>
                {s === 1 && <ChevronDown className="w-3.5 h-3.5 rotate-[-90deg]" style={{ color: "var(--color-text-tertiary)" }} />}
              </span>
            ))}
          </div>

          {step === 1 ? (
            <>
              <div className="flex items-center justify-between px-4">
                <input
                  value={editing.name}
                  onChange={(e) => setEditing({ ...editing, name: e.target.value })}
                  placeholder="模板名称"
                  className="flex-1 min-w-0 h-9 px-3 rounded-lg text-[14px] font-medium outline-none"
                  style={{ background: "var(--color-surface-card)", color: "var(--color-text-primary)" }}
                />
              </div>
              {/* 5 大段：睡眠锁定 + 4 段勾选 */}
              {SEGMENT_ORDER.map((g) => {
                const meta = SEGMENT_META[g];
                const IconComp = ICON_REGISTRY[meta.icon] ?? Icons.Circle;
                const seg = segments.find((s) => s.group === g)!;
                const isSleep = g === 'sleep';
                return (
                  <div key={g} className="rounded-[20px] overflow-hidden" style={{ background: "var(--color-surface-card)", boxShadow: "var(--shadow-card)" }}>
                    <div className="flex items-center gap-2.5 px-4 py-3">
                      <span className="flex h-8 w-8 items-center justify-center rounded-lg" style={{ background: `${meta.color}1A`, color: meta.color }}>
                        <IconComp className="h-4 w-4" />
                      </span>
                      <div className="min-w-0 flex-1">
                        <p className="text-[15px] font-semibold leading-tight" style={{ color: "var(--color-text-primary)" }}>
                          {meta.label}
                          {isSleep && <span className="ml-1.5 text-[10px] font-medium px-1.5 py-0.5 rounded-full align-middle" style={{ background: `${meta.color}1A`, color: meta.color }}>独特段</span>}
                        </p>
                        <p className="text-[11px] mt-0.5" style={{ color: "var(--color-text-tertiary)" }}>{meta.quotaHint}</p>
                      </div>
                      <div className="flex items-center gap-1 shrink-0">
                        <input type="time" value={seg.start} disabled={isSleep}
                          onChange={(e) => updateSegment(g, { start: e.target.value })}
                          className="bg-transparent outline-none text-[12px] tabular-nums w-[74px] text-right disabled:opacity-60" style={{ color: "var(--color-text-primary)" }} />
                        <span className="text-[12px]" style={{ color: "var(--color-text-tertiary)" }}>—</span>
                        <input type="time" value={seg.end} disabled={isSleep}
                          onChange={(e) => updateSegment(g, { end: e.target.value })}
                          className="bg-transparent outline-none text-[12px] tabular-nums w-[74px] disabled:opacity-60" style={{ color: "var(--color-text-primary)" }} />
                      </div>
                    </div>
                    <div className="px-4 pb-4">
                      {isSleep ? (
                        <p className="text-[12px]" style={{ color: "var(--color-text-tertiary)" }}>
                          夜间 22:30-06:00 + 午睡 12:30-13:00 · 仅睡眠功能
                        </p>
                      ) : (
                        <FeaturePicker
                          value={seg.features}
                          onChange={(v) => updateSegment(g, { features: v })}
                          medicineActive={medicineActive}
                        />
                      )}
                    </div>
                  </div>
                );
              })}
            </>
          ) : (
            <>
              {/* Step 2：每段功能次数 + 独立起止时间 */}
              {[...slotsByGroup(slots).entries()].map(([g, list]) => {
                const meta = SEGMENT_META[g];
                const IconComp = ICON_REGISTRY[meta.icon] ?? Icons.Circle;
                if (list.length === 0) return null;
                return (
                  <div key={g} className="rounded-[20px] overflow-hidden" style={{ background: "var(--color-surface-card)", boxShadow: "var(--shadow-card)" }}>
                    <div className="flex items-center gap-2 px-4 pt-3.5 pb-1">
                      <span className="flex h-7 w-7 items-center justify-center rounded-lg" style={{ background: `${meta.color}1A`, color: meta.color }}>
                        <IconComp className="h-3.5 w-3.5" />
                      </span>
                      <p className="text-[14px] font-semibold" style={{ color: "var(--color-text-primary)" }}>{meta.label} · {list.length} 个时段</p>
                    </div>
                    <div className="px-4 pb-4">
                      {list.map((s) => (
                        <div key={s.id} className="flex items-center gap-2 py-2.5" style={{ borderTop: "1px solid var(--lifeflow-border-light)" }}>
                          <div className="flex items-center gap-1.5 min-w-0 flex-1">
                            <span className="flex h-6 w-6 items-center justify-center rounded-full shrink-0" style={{ background: `${getFeatureMeta(s.feature).color}1A`, color: getFeatureMeta(s.feature).color }}>
                              {(() => { const C = ICON_REGISTRY[getFeatureMeta(s.feature).icon] ?? Icons.Circle; return <C className="h-3 w-3" />; })()}
                            </span>
                            <input
                              value={s.label}
                              onChange={(e) => updateSlot(s.id, { label: e.target.value })}
                              aria-label="时段名称"
                              placeholder={getFeatureMeta(s.feature).label}
                              className="min-w-0 flex-1 bg-transparent outline-none text-[13px] font-medium truncate"
                              style={{ color: "var(--color-text-primary)" }}
                            />
                          </div>
                          <input type="time" value={s.start} onChange={(e) => updateSlot(s.id, { start: e.target.value })}
                            className="bg-transparent outline-none text-[12px] tabular-nums w-[74px] text-right" style={{ color: "var(--color-text-primary)" }} />
                          <span className="text-[12px]" style={{ color: "var(--color-text-tertiary)" }}>—</span>
                          <input type="time" value={s.end} onChange={(e) => updateSlot(s.id, { end: e.target.value })}
                            className="bg-transparent outline-none text-[12px] tabular-nums w-[74px]" style={{ color: "var(--color-text-primary)" }} />
                          {g !== 'sleep' && (
                            <button type="button" onClick={() => removeSlot(s.id)} aria-label="删除该时段"
                              className="flex h-6 w-6 items-center justify-center rounded-full shrink-0 active:opacity-60" style={{ background: "var(--lifeflow-muted)" }}>
                              <X className="w-3 h-3" style={{ color: "#FF3B30" }} />
                            </button>
                          )}
                        </div>
                      ))}
                      {/* 次数快捷：每个已选功能 + 一次 */}
                      {g !== 'sleep' && (
                        <div className="flex items-center gap-1.5 pt-2 flex-wrap">
                          {[...new Set(list.map((s) => s.feature))].map((f) => (
                            <button key={f} type="button" onClick={() => addSlot(g, f)}
                              className="flex items-center gap-1 px-2.5 h-7 rounded-full text-[11px] font-medium active:opacity-70"
                              style={{ background: "var(--lifeflow-brand-50)", color: "var(--lifeflow-primary)" }}>
                              <Plus className="w-3 h-3" /> {getFeatureMeta(f).label} +1 次
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </>
          )}

          {/* 操作条（flex 自然流，避免 fixed 遮挡） */}
          <div className="flex items-center gap-2">
            {step === 2 && (
              <button type="button" onClick={() => setStep(1)}
                className="h-11 px-5 rounded-full text-[14px] font-medium" style={{ background: "var(--lifeflow-muted)", color: "var(--color-text-secondary)" }}>
                上一步
              </button>
            )}
            {step === 1 ? (
              <button type="button" onClick={goNext}
                className="flex-1 h-11 rounded-full text-white text-[15px] font-semibold active:opacity-90"
                style={{ background: "var(--lifeflow-primary)", boxShadow: "0 4px 16px rgba(37,99,235,0.3)" }}>
                下一步 · 配置时间与次数
              </button>
            ) : (
              <button type="button" onClick={handleSave} disabled={saving}
                className="flex-1 h-11 rounded-full text-white text-[15px] font-semibold active:opacity-90 disabled:opacity-50"
                style={{ background: "var(--lifeflow-primary)", boxShadow: "0 4px 16px rgba(37,99,235,0.3)" }}>
                {saving ? "保存中…" : "保存并生成时间轴"}
              </button>
            )}
            <button type="button" onClick={() => { setEditMode(false); setEditing(null); }}
              className="h-11 px-5 rounded-full text-[14px] font-medium" style={{ background: "var(--lifeflow-muted)", color: "var(--color-text-secondary)" }}>
              取消
            </button>
          </div>
        </div>
      )}

      {/* ── 今日执行时间轴（5 段分组） ── */}
      <div className="px-4">
        <div className="rounded-[20px] overflow-hidden" style={{ background: "var(--color-surface-card)", boxShadow: "var(--shadow-card)" }}>
          <div className="flex items-center gap-2 px-4 pt-4 pb-2">
            <Sparkles className="w-4 h-4" style={{ color: "var(--lifeflow-primary)" }} />
            <h2 className="text-[16px] font-bold" style={{ color: "var(--color-text-primary)" }}>今日执行 · {activeTemplate.name}</h2>
            <span className="ml-auto text-[11px]" style={{ color: "var(--color-text-tertiary)" }}>
              {new Date().getMonth() + 1}月{new Date().getDate()}日
            </span>
          </div>
          <div className="px-4 pb-4">
            {displayTemplate.blocks.length === 0 ? (
              <p className="text-[13px] py-6 text-center" style={{ color: "var(--color-text-disabled)" }}>模板为空，去编辑添加时间段</p>
            ) : (
              <div className="flex flex-col">
                {[...blocksBySegment(displayTemplate).entries()].map(([g, blocks]) => {
                  const meta = SEGMENT_META[g];
                  const IconComp = ICON_REGISTRY[meta.icon] ?? Icons.Circle;
                  const collapsed = collapsedGroups.has(g);
                  return (
                    <div key={g}>
                      <button type="button" onClick={() => setCollapsedGroups((prev) => { const n = new Set(prev); if (n.has(g)) n.delete(g); else n.add(g); return n; })}
                        className="w-full flex items-center gap-2 py-2 text-left">
                        <span className="flex h-6 w-6 items-center justify-center rounded-lg" style={{ background: `${meta.color}14`, color: meta.color }}>
                          <IconComp className="h-3.5 w-3.5" />
                        </span>
                        <span className="text-[13px] font-semibold" style={{ color: "var(--color-text-primary)" }}>{meta.label}</span>
                        <span className="text-[11px]" style={{ color: "var(--color-text-tertiary)" }}>{blocks.length} 时段</span>
                        <span className="ml-auto">{collapsed ? <ChevronDown className="w-4 h-4" style={{ color: "var(--color-text-tertiary)" }} /> : <ChevronUp className="w-4 h-4" style={{ color: "var(--color-text-tertiary)" }} />}</span>
                      </button>
                      {!collapsed && (
                        <div className="flex flex-col">
                          {blocks.map((b, i) => {
                            const blockPlans = plans.filter((p) => p.blockId === b.id);
                            const allDone = blockPlans.length > 0 && blockPlans.every((p) => p.isCompleted);
                            return (
                              <div key={b.id} id={`ideal-block-${b.id}`}
                                className="rounded-xl transition-colors duration-500"
                                style={{ background: focusBlockId === b.id && focusFlash ? "var(--lifeflow-brand-50)" : "transparent", boxShadow: focusBlockId === b.id && focusFlash ? "0 0 0 2px rgba(99,102,241,0.35)" : "none" }}>
                                <button
                                  type="button"
                                  onClick={() => handleToggleBlock(b.id)}
                                  className="w-full flex items-center gap-3 py-3 text-left active:opacity-70"
                                  style={{ borderTop: i > 0 ? "1px solid var(--lifeflow-border-light)" : "none", opacity: allDone ? 0.6 : 1 }}
                                >
                                  <div className="w-[64px] shrink-0">
                                    <p className="text-[12px] font-semibold tabular-nums leading-none" style={{ color: allDone ? "var(--color-text-tertiary)" : "var(--color-text-primary)" }}>{b.start}</p>
                                    <p className="text-[11px] tabular-nums leading-none mt-1" style={{ color: "var(--color-text-tertiary)" }}>{b.end}</p>
                                  </div>
                                  <div className="min-w-0 flex-1">
                                    <p className="text-[14px] font-semibold truncate" style={{ color: "var(--color-text-primary)", textDecoration: allDone ? "line-through" : "none" }}>{b.label}</p>
                                    <div className="mt-1 flex items-center gap-2">
                                      <FeatureIconRow features={b.features} onFeatureClick={(f) => handleFeatureClick(b.id, f)} />
                                      {blockPlans.length > 0 && (
                                        <span className="text-[11px] truncate" style={{ color: "var(--color-text-tertiary)" }}>
                                          {blockPlans.filter((p) => !p.isCompleted).length}/{blockPlans.length} 已安排
                                        </span>
                                      )}
                                    </div>
                                  </div>
                                  <span className="shrink-0 flex h-5 w-5 items-center justify-center rounded-full" style={{
                                    background: allDone ? "var(--state-success)" : "transparent",
                                    border: allDone ? "none" : "2px solid var(--lifeflow-border)",
                                  }}>
                                    {allDone && <Check className="h-3 w-3 text-white" strokeWidth={3} />}
                                  </span>
                                </button>
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
            <p className="text-[11px] mt-2" style={{ color: "var(--color-text-tertiary)" }}>
              点击功能图标安排该时段的具体内容 · 点击时间段整段标记完成
            </p>
          </div>
        </div>
      </div>

      {/* ── 内嵌底部表单（作息/训练/功法养生/体态拉伸，样式同功能模块） ── */}
      {sheet.open && (
        <>
          <div className="fixed inset-0 z-40 bg-black/40" style={{ animation: "fade-in 0.2s ease" }} onClick={() => setSheet((s) => ({ ...s, open: false }))} aria-hidden="true" />
          <div className="fixed inset-x-0 bottom-0 z-50 mx-auto max-w-[430px] rounded-t-[24px] bg-[var(--lifeflow-card)]"
            style={{ boxShadow: "0 -8px 32px rgba(0,0,0,0.12)", animation: "slide-in-from-bottom 0.28s cubic-bezier(0.32,0.72,0,1)" }}>
            <div className="flex items-center justify-between px-5 pt-4 pb-2">
              <div className="flex items-center gap-2 min-w-0">
                {(() => {
                  const m = getFeatureMeta(sheet.feature);
                  const C = ICON_REGISTRY[m.icon] ?? Icons.Circle;
                  return <span className="flex h-8 w-8 items-center justify-center rounded-full shrink-0" style={{ background: `${m.color}1A`, color: m.color }}><C className="h-4 w-4" /></span>;
                })()}
                <div className="min-w-0">
                  <p className="text-[15px] font-semibold truncate" style={{ color: "var(--color-text-primary)" }}>{getFeatureMeta(sheet.feature).label}规划</p>
                  <p className="text-[11px] truncate" style={{ color: "var(--color-text-tertiary)" }}>
                    {activeTemplate.blocks.find((b) => b.id === sheet.blockId)?.label} · {activeTemplate.blocks.find((b) => b.id === sheet.blockId)?.start} - {activeTemplate.blocks.find((b) => b.id === sheet.blockId)?.end}
                  </p>
                </div>
              </div>
              <button type="button" onClick={() => setSheet((s) => ({ ...s, open: false }))} aria-label="关闭"
                className="flex h-7 w-7 items-center justify-center rounded-full bg-[var(--lifeflow-muted)] active:opacity-70">
                <X className="w-3.5 h-3.5" style={{ color: "var(--color-text-secondary)" }} />
              </button>
            </div>
            <div className="px-5 pt-1 pb-5 space-y-3">
              {sheet.feature === 'workout' ? (
                /* ── 训练：结构化动作清单 ── */
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <span className="block text-[13px] font-semibold" style={{ color: "var(--color-text-primary)" }}>
                      动作清单 <span style={{ color: "var(--state-error)" }}>*</span>
                    </span>
                    <button type="button" onClick={() => setSheet((s) => ({ ...s, actions: [...s.actions, { name: "", sets: 3, reps: 12 }] }))}
                      className="flex items-center gap-1 text-[12px] font-semibold active:opacity-70"
                      style={{ color: "var(--lifeflow-primary)" }}>
                      <Plus className="w-3.5 h-3.5" /> 添加动作
                    </button>
                  </div>
                  {sheet.actions.length === 0 ? (
                    <div className="rounded-xl px-3.5 py-4 text-center" style={{ background: "var(--lifeflow-background)" }}>
                      <p className="text-[12px]" style={{ color: "var(--color-text-tertiary)" }}>点击「添加动作」开始规划，或从下方快捷动作选择</p>
                      <div className="flex flex-wrap gap-1.5 justify-center mt-2.5">
                        {ACTION_PRESETS.slice(0, 4).map((name) => (
                          <button key={name} type="button" onClick={() => setSheet((s) => ({ ...s, actions: [{ name, sets: 3, reps: 12 }] }))}
                            className="px-3 h-7 rounded-full text-[12px] font-medium active:opacity-70" style={{ background: "var(--lifeflow-muted)", color: "var(--color-text-primary)" }}>
                            {name}
                          </button>
                        ))}
                      </div>
                    </div>
                  ) : (
                    <div className="space-y-2">
                      {sheet.actions.map((a, i) => (
                        <div key={i} className="flex items-center gap-2 rounded-xl px-3 py-2.5" style={{ background: "var(--lifeflow-background)" }}>
                          <input
                            value={a.name}
                            onChange={(e) => setSheet((s) => ({ ...s, actions: s.actions.map((x, xi) => (xi === i ? { ...x, name: e.target.value } : x)) }))}
                            placeholder={`动作 ${i + 1}（如：杠铃卧推）`}
                            aria-label={`动作 ${i + 1} 名称`}
                            className="min-w-0 flex-1 bg-transparent outline-none text-[14px] font-medium"
                            style={{ color: "var(--color-text-primary)" }}
                          />
                          <div className="flex items-center gap-1 shrink-0">
                            <button type="button" aria-label="减少组数" onClick={() => setSheet((s) => ({ ...s, actions: s.actions.map((x, xi) => (xi === i ? { ...x, sets: Math.max(1, x.sets - 1) } : x)) }))}
                              className="w-6 h-6 rounded-md flex items-center justify-center active:opacity-60" style={{ background: "var(--lifeflow-card)" }}>
                              <Minus className="w-3 h-3" style={{ color: "var(--color-text-secondary)" }} />
                            </button>
                            <span className="w-8 text-center text-[12px] font-semibold tabular-nums" style={{ color: "var(--color-text-primary)" }}>{a.sets}×{a.reps}</span>
                            <button type="button" aria-label="增加组数" onClick={() => setSheet((s) => ({ ...s, actions: s.actions.map((x, xi) => (xi === i ? { ...x, sets: Math.min(20, x.sets + 1) } : x)) }))}
                              className="w-6 h-6 rounded-md flex items-center justify-center active:opacity-60" style={{ background: "var(--lifeflow-card)" }}>
                              <Plus className="w-3 h-3" style={{ color: "var(--color-text-secondary)" }} />
                            </button>
                          </div>
                          <button type="button" aria-label={`删除动作 ${a.name || i + 1}`} onClick={() => setSheet((s) => ({ ...s, actions: s.actions.filter((_, xi) => xi !== i) }))}
                            className="w-6 h-6 rounded-full flex items-center justify-center shrink-0 active:opacity-70" style={{ background: "var(--lifeflow-muted)", color: "var(--state-error)" }}>
                            <X className="w-3 h-3" />
                          </button>
                        </div>
                      ))}
                      <div className="flex flex-wrap gap-1.5 pt-0.5">
                        {ACTION_PRESETS.map((name) => (
                          <button key={name} type="button" disabled={sheet.actions.some((x) => x.name === name)} onClick={() => setSheet((s) => ({ ...s, actions: [...s.actions, { name, sets: 3, reps: 12 }] }))}
                            className="px-3 h-7 rounded-full text-[12px] font-medium active:opacity-70 disabled:opacity-30" style={{ background: "var(--lifeflow-muted)", color: "var(--color-text-primary)" }}>
                            +{name}
                          </button>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              ) : sheet.feature === 'wellness' ? (
                /* ── 功法养生：动作模板清单 ── */
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <span className="block text-[13px] font-semibold" style={{ color: "var(--color-text-primary)" }}>
                      养生安排 <span style={{ color: "var(--state-error)" }}>*</span>
                    </span>
                    <button type="button" onClick={() => setSheet((s) => ({ ...s, wellness: [...s.wellness, { name: "", minutes: 10 }] }))}
                      className="flex items-center gap-1 text-[12px] font-semibold active:opacity-70"
                      style={{ color: "var(--lifeflow-primary)" }}>
                      <Plus className="w-3.5 h-3.5" /> 添加项目
                    </button>
                  </div>
                  {sheet.wellness.length === 0 ? (
                    <div className="rounded-xl px-3.5 py-4 text-center" style={{ background: "var(--lifeflow-background)" }}>
                      <p className="text-[12px]" style={{ color: "var(--color-text-tertiary)" }}>点击「添加项目」或从模板快捷选择</p>
                      <div className="flex flex-wrap gap-1.5 justify-center mt-2.5">
                        {WELLNESS_PRESETS.slice(0, 4).map((w) => (
                          <button key={w.name} type="button" onClick={() => setSheet((s) => ({ ...s, wellness: [{ ...w }] }))}
                            className="px-3 h-7 rounded-full text-[12px] font-medium active:opacity-70" style={{ background: "var(--lifeflow-muted)", color: "var(--color-text-primary)" }}>
                            {w.name}
                          </button>
                        ))}
                      </div>
                    </div>
                  ) : (
                    <div className="space-y-2">
                      {sheet.wellness.map((w, i) => (
                        <div key={i} className="flex items-center gap-2 rounded-xl px-3 py-2.5" style={{ background: "var(--lifeflow-background)" }}>
                          <input
                            value={w.name}
                            onChange={(e) => setSheet((s) => ({ ...s, wellness: s.wellness.map((x, xi) => (xi === i ? { ...x, name: e.target.value } : x)) }))}
                            placeholder={`项目 ${i + 1}（如：八段锦）`}
                            aria-label={`养生项目 ${i + 1} 名称`}
                            className="min-w-0 flex-1 bg-transparent outline-none text-[14px] font-medium"
                            style={{ color: "var(--color-text-primary)" }}
                          />
                          <div className="flex items-center gap-1 shrink-0">
                            <button type="button" aria-label="减少时长" onClick={() => setSheet((s) => ({ ...s, wellness: s.wellness.map((x, xi) => (xi === i ? { ...x, minutes: Math.max(1, x.minutes - 1) } : x)) }))}
                              className="w-6 h-6 rounded-md flex items-center justify-center active:opacity-60" style={{ background: "var(--lifeflow-card)" }}>
                              <Minus className="w-3 h-3" style={{ color: "var(--color-text-secondary)" }} />
                            </button>
                            <span className="w-9 text-center text-[12px] font-semibold tabular-nums" style={{ color: "var(--color-text-primary)" }}>{w.minutes}分钟</span>
                            <button type="button" aria-label="增加时长" onClick={() => setSheet((s) => ({ ...s, wellness: s.wellness.map((x, xi) => (xi === i ? { ...x, minutes: Math.min(60, x.minutes + 1) } : x)) }))}
                              className="w-6 h-6 rounded-md flex items-center justify-center active:opacity-60" style={{ background: "var(--lifeflow-card)" }}>
                              <Plus className="w-3 h-3" style={{ color: "var(--color-text-secondary)" }} />
                            </button>
                          </div>
                          <button type="button" aria-label={`删除项目 ${w.name || i + 1}`} onClick={() => setSheet((s) => ({ ...s, wellness: s.wellness.filter((_, xi) => xi !== i) }))}
                            className="w-6 h-6 rounded-full flex items-center justify-center shrink-0 active:opacity-70" style={{ background: "var(--lifeflow-muted)", color: "var(--state-error)" }}>
                            <X className="w-3 h-3" />
                          </button>
                        </div>
                      ))}
                      <div className="flex flex-wrap gap-1.5 pt-0.5">
                        {WELLNESS_PRESETS.map((w) => (
                          <button key={w.name} type="button" disabled={sheet.wellness.some((x) => x.name === w.name)} onClick={() => setSheet((s) => ({ ...s, wellness: [...s.wellness, { ...w }] }))}
                            className="px-3 h-7 rounded-full text-[12px] font-medium active:opacity-70 disabled:opacity-30" style={{ background: "var(--lifeflow-muted)", color: "var(--color-text-primary)" }}>
                            +{w.name}
                          </button>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              ) : sheet.feature === 'routine' ? (
                /* ── 作息：例行清单分项 ── */
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <span className="block text-[13px] font-semibold" style={{ color: "var(--color-text-primary)" }}>
                      例行分项 <span style={{ color: "var(--state-error)" }}>*</span>
                    </span>
                    <button type="button" onClick={() => setSheet((s) => ({ ...s, routine: [...s.routine, { name: "" }] }))}
                      className="flex items-center gap-1 text-[12px] font-semibold active:opacity-70"
                      style={{ color: "var(--lifeflow-primary)" }}>
                      <Plus className="w-3.5 h-3.5" /> 添加分项
                    </button>
                  </div>
                  {sheet.routine.length === 0 ? (
                    <div className="rounded-xl px-3.5 py-4 text-center" style={{ background: "var(--lifeflow-background)" }}>
                      <p className="text-[12px]" style={{ color: "var(--color-text-tertiary)" }}>点击「添加分项」或从常用例行选择</p>
                      <div className="flex flex-wrap gap-1.5 justify-center mt-2.5">
                        {ROUTINE_PRESETS.slice(0, 4).map((name) => (
                          <button key={name} type="button" onClick={() => setSheet((s) => ({ ...s, routine: [{ name }] }))}
                            className="px-3 h-7 rounded-full text-[12px] font-medium active:opacity-70" style={{ background: "var(--lifeflow-muted)", color: "var(--color-text-primary)" }}>
                            {name}
                          </button>
                        ))}
                      </div>
                    </div>
                  ) : (
                    <div className="space-y-2">
                      {sheet.routine.map((r, i) => (
                        <div key={i} className="flex items-center gap-2 rounded-xl px-3 py-2.5" style={{ background: "var(--lifeflow-background)" }}>
                          <input
                            value={r.name}
                            onChange={(e) => setSheet((s) => ({ ...s, routine: s.routine.map((x, xi) => (xi === i ? { ...x, name: e.target.value } : x)) }))}
                            placeholder={`分项 ${i + 1}（如：洗漱）`}
                            aria-label={`例行分项 ${i + 1} 名称`}
                            className="min-w-0 flex-1 bg-transparent outline-none text-[14px] font-medium"
                            style={{ color: "var(--color-text-primary)" }}
                          />
                          <button type="button" aria-label={`删除分项 ${r.name || i + 1}`} onClick={() => setSheet((s) => ({ ...s, routine: s.routine.filter((_, xi) => xi !== i) }))}
                            className="w-6 h-6 rounded-full flex items-center justify-center shrink-0 active:opacity-70" style={{ background: "var(--lifeflow-muted)", color: "var(--state-error)" }}>
                            <X className="w-3 h-3" />
                          </button>
                        </div>
                      ))}
                      <div className="flex flex-wrap gap-1.5 pt-0.5">
                        {ROUTINE_PRESETS.map((name) => (
                          <button key={name} type="button" disabled={sheet.routine.some((x) => x.name === name)} onClick={() => setSheet((s) => ({ ...s, routine: [...s.routine, { name }] }))}
                            className="px-3 h-7 rounded-full text-[12px] font-medium active:opacity-70 disabled:opacity-30" style={{ background: "var(--lifeflow-muted)", color: "var(--color-text-primary)" }}>
                            +{name}
                          </button>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              ) : sheet.feature === 'posture' ? (
                /* ── 体态拉伸：结构化动作清单（秒数） ── */
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <span className="block text-[13px] font-semibold" style={{ color: "var(--color-text-primary)" }}>
                      拉伸动作 <span style={{ color: "var(--state-error)" }}>*</span>
                    </span>
                    <button type="button" onClick={() => setSheet((s) => ({ ...s, posture: [...s.posture, { name: "", seconds: 30 }] }))}
                      className="flex items-center gap-1 text-[12px] font-semibold active:opacity-70"
                      style={{ color: "var(--lifeflow-primary)" }}>
                      <Plus className="w-3.5 h-3.5" /> 添加动作
                    </button>
                  </div>
                  {sheet.posture.length === 0 ? (
                    <div className="rounded-xl px-3.5 py-4 text-center" style={{ background: "var(--lifeflow-background)" }}>
                      <p className="text-[12px]" style={{ color: "var(--color-text-tertiary)" }}>点击「添加动作」或从常用拉伸选择</p>
                      <div className="flex flex-wrap gap-1.5 justify-center mt-2.5">
                        {POSTURE_PRESETS.slice(0, 4).map((p) => (
                          <button key={p.name} type="button" onClick={() => setSheet((s) => ({ ...s, posture: [{ ...p }] }))}
                            className="px-3 h-7 rounded-full text-[12px] font-medium active:opacity-70" style={{ background: "var(--lifeflow-muted)", color: "var(--color-text-primary)" }}>
                            {p.name}
                          </button>
                        ))}
                      </div>
                    </div>
                  ) : (
                    <div className="space-y-2">
                      {sheet.posture.map((p, i) => (
                        <div key={i} className="flex items-center gap-2 rounded-xl px-3 py-2.5" style={{ background: "var(--lifeflow-background)" }}>
                          <input
                            value={p.name}
                            onChange={(e) => setSheet((s) => ({ ...s, posture: s.posture.map((x, xi) => (xi === i ? { ...x, name: e.target.value } : x)) }))}
                            placeholder={`动作 ${i + 1}（如：肩颈拉伸）`}
                            aria-label={`拉伸动作 ${i + 1} 名称`}
                            className="min-w-0 flex-1 bg-transparent outline-none text-[14px] font-medium"
                            style={{ color: "var(--color-text-primary)" }}
                          />
                          <div className="flex items-center gap-1 shrink-0">
                            <button type="button" aria-label="减少时长" onClick={() => setSheet((s) => ({ ...s, posture: s.posture.map((x, xi) => (xi === i ? { ...x, seconds: Math.max(5, x.seconds - 5) } : x)) }))}
                              className="w-6 h-6 rounded-md flex items-center justify-center active:opacity-60" style={{ background: "var(--lifeflow-card)" }}>
                              <Minus className="w-3 h-3" style={{ color: "var(--color-text-secondary)" }} />
                            </button>
                            <span className="w-10 text-center text-[12px] font-semibold tabular-nums" style={{ color: "var(--color-text-primary)" }}>{p.seconds}秒</span>
                            <button type="button" aria-label="增加时长" onClick={() => setSheet((s) => ({ ...s, posture: s.posture.map((x, xi) => (xi === i ? { ...x, seconds: Math.min(120, x.seconds + 5) } : x)) }))}
                              className="w-6 h-6 rounded-md flex items-center justify-center active:opacity-60" style={{ background: "var(--lifeflow-card)" }}>
                              <Plus className="w-3 h-3" style={{ color: "var(--color-text-secondary)" }} />
                            </button>
                          </div>
                          <button type="button" aria-label={`删除动作 ${p.name || i + 1}`} onClick={() => setSheet((s) => ({ ...s, posture: s.posture.filter((_, xi) => xi !== i) }))}
                            className="w-6 h-6 rounded-full flex items-center justify-center shrink-0 active:opacity-70" style={{ background: "var(--lifeflow-muted)", color: "var(--state-error)" }}>
                            <X className="w-3 h-3" />
                          </button>
                        </div>
                      ))}
                      <div className="flex flex-wrap gap-1.5 pt-0.5">
                        {POSTURE_PRESETS.map((p) => (
                          <button key={p.name} type="button" disabled={sheet.posture.some((x) => x.name === p.name)} onClick={() => setSheet((s) => ({ ...s, posture: [...s.posture, { ...p }] }))}
                            className="px-3 h-7 rounded-full text-[12px] font-medium active:opacity-70 disabled:opacity-30" style={{ background: "var(--lifeflow-muted)", color: "var(--color-text-primary)" }}>
                            +{p.name}
                          </button>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              ) : (
                <>
                  <label className="block">
                    <span className="block text-[13px] font-semibold mb-1" style={{ color: "var(--color-text-primary)" }}>
                      {getFeatureMeta(sheet.feature).label}内容 <span style={{ color: "var(--state-error)" }}>*</span>
                    </span>
                    <input
                      value={sheet.content}
                      onChange={(e) => setSheet((s) => ({ ...s, content: e.target.value }))}
                      placeholder={INLINE_SHEET_PLACEHOLDER[sheet.feature]}
                      aria-label={`${getFeatureMeta(sheet.feature).label}内容`}
                      className="w-full px-3.5 py-3 rounded-xl text-[14px] outline-none"
                      style={{ background: "var(--lifeflow-background)", color: "var(--color-text-primary)" }}
                    />
                  </label>
                  <label className="block">
                    <span className="block text-[13px] font-semibold mb-1" style={{ color: "var(--color-text-primary)" }}>
                      补充说明 <span className="text-[11px] font-normal" style={{ color: "var(--color-text-tertiary)" }}>（可选）</span>
                    </span>
                    <input
                      value={sheet.detail}
                      onChange={(e) => setSheet((s) => ({ ...s, detail: e.target.value }))}
                      placeholder="补充备注…"
                      aria-label="补充说明"
                      className="w-full px-3.5 py-2.5 rounded-xl text-[13px] outline-none"
                      style={{ background: "var(--lifeflow-background)", color: "var(--color-text-secondary)" }}
                    />
                  </label>
                </>
              )}
              <div className="flex items-center gap-2 pt-1">
                <button type="button" onClick={() => setSheet((s) => ({ ...s, open: false }))}
                  className="h-11 px-4 rounded-full text-[14px] font-medium shrink-0" style={{ background: "var(--lifeflow-muted)", color: "var(--color-text-secondary)" }}>
                  取消
                </button>
                <button type="button" onClick={handleSheetSave} disabled={sheetSaving}
                  className="flex-1 h-11 rounded-full text-white text-[15px] font-semibold active:opacity-90 disabled:opacity-50"
                  style={{ background: "var(--lifeflow-primary)", boxShadow: "0 4px 16px rgba(37,99,235,0.3)" }}>
                  {sheetSaving ? "保存中…" : "保存并更新日程"}
                </button>
              </div>
              <p className="text-[11px] text-center" style={{ color: "var(--color-text-tertiary)" }}>
                保存后打开「日程」页，该时段自动显示安排的具体内容
              </p>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
