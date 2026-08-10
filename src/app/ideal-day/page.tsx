"use client";

import { useState, useEffect, useMemo, useCallback, useRef } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import * as Icons from "lucide-react";
import {
  ChevronDown, ChevronUp, Plus, Minus, Copy, Pencil, Check, X, Sparkles, Lock, RotateCcw,
  ChevronLeft, ChevronRight, Trash2, CalendarDays, SlidersHorizontal,
} from "lucide-react";
import { getIdealDayConfig, saveIdealDayConfig, applyIdealDayBlueprint } from "@/lib/ideal-day";
import {
  ensureTemplates, ensureDayTemplates, selectTemplateV2, DAY_LABELS, getFeatureMeta, getAllFeatures,
  getIdealDayPlans, SEGMENT_META, SEGMENT_ORDER,
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

// ─── 功能行（执行区：对齐画布 lf-fn-row —— 模块色圆 chip + 名称，点击跳规划/模块页） ──
function FeatureIconRow({ features, onFeatureClick, caption }: { features: IdealDayFeature[]; onFeatureClick: (f: IdealDayFeature) => void; caption?: string }) {
  return (
    <div className="flex items-center gap-2.5 flex-wrap">
      {caption && (
        <span className="flex-shrink-0 text-[10px]" style={{ color: "var(--color-text-secondary)" }}>{caption}</span>
      )}
      {features.map((f) => {
        const meta = getFeatureMeta(f);
        const IconComp = ICON_REGISTRY[meta.icon] ?? Icons.Circle;
        return (
          <button
            key={f}
            type="button"
            onClick={(e) => { e.stopPropagation(); onFeatureClick(f); }}
            aria-label={`进入${meta.label}`}
            className="flex flex-col items-center gap-1 flex-shrink-0 active:scale-90 transition-transform"
          >
            <span className="flex h-7 w-7 items-center justify-center rounded-full" style={{ background: `${meta.color}1A`, color: meta.color }}>
              <IconComp className="h-3.5 w-3.5" />
            </span>
            <span className="text-[10px] leading-none" style={{ color: "var(--color-text-secondary)" }}>{meta.label}</span>
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
        // 睡眠段锁定只读（locked 由调用方传入；清理旧恒失效条件 `f === 'sleep' && locked`）
        const isLocked = !!locked;
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
  return { gradient, labels, totalH: Math.round(total / 60), mins: [sleepMin, goalMin, lifeMin], totalMin: total };
}

/** 时长展示（画布 slot-dur 形态：0.5h / 1h / 1.5h） */
const fmtDur = (min: number) => {
  if (min <= 0) return "0h";
  const h = min / 60;
  return `${Number.isInteger(h) ? h : h.toFixed(1).replace(/\.0$/, "")}h`;
};

/** 画布 compactWeekdays：周索引数组（周一=0）→ 「周一至周五」「周一、周三」紧凑文案 */
const compactWeekdays = (indices: number[]): string => {
  const parts: string[] = [];
  let start = indices[0];
  let prev = indices[0];
  for (let i = 1; i <= indices.length; i++) {
    const cur = indices[i];
    if (cur === prev + 1) {
      prev = cur;
      continue;
    }
    parts.push(
      start === prev
        ? DAY_LABELS[start]
        : prev - start === 1
          ? `${DAY_LABELS[start]}、${DAY_LABELS[prev]}`
          : `${DAY_LABELS[start]}至${DAY_LABELS[prev]}`,
    );
    start = cur;
    prev = cur;
  }
  return parts.join("、");
};

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
  // T24 画布模板 v2 状态：按天模式当前天（0=周一，默认今天星期）/ 复制多选 / 内联重命名 / 月历 / 删除确认
  const [currentDay, setCurrentDay] = useState<number>(() => {
    const d = new Date();
    const dow = d.getDay();
    return dow === 0 ? 6 : dow - 1;
  });
  const [copyOpen, setCopyOpen] = useState(false);
  const [copySel, setCopySel] = useState<number[]>([]);
  const [renameOpen, setRenameOpen] = useState(false);
  const [renameValue, setRenameValue] = useState("");
  const [multiRenameOpen, setMultiRenameOpen] = useState(false);
  const [multiRenameValue, setMultiRenameValue] = useState("");
  const [calYear, setCalYear] = useState(() => new Date().getFullYear());
  const [calMonth, setCalMonth] = useState(() => new Date().getMonth()); // 0=1 月
  const [hintDate, setHintDate] = useState<number | null>(null);
  const [confirmDel, setConfirmDel] = useState(false);
  const [plans, setPlans] = useState<Awaited<ReturnType<typeof getIdealDayPlans>>>([]);
  const [sheet, setSheet] = useState<{ open: boolean; feature: IdealDayFeature; blockId: string; content: string; detail: string; actions: PlanAction[]; wellness: PlanWellnessItem[]; routine: PlanRoutineItem[]; posture: PlanPostureItem[] }>({ open: false, feature: 'workout', blockId: '', content: '', detail: '', actions: [], wellness: [], routine: [], posture: [] });
  const [sheetSaving, setSheetSaving] = useState(false);
  // 画布 resched-toast：模板切换/恢复自动后的 success 提示条（自动隐藏）
  const [resched, setResched] = useState<{ visible: boolean; text: string }>({ visible: false, text: "" });
  const reschedTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const showResched = useCallback((text: string) => {
    setResched({ visible: true, text });
    if (reschedTimer.current) clearTimeout(reschedTimer.current);
    reschedTimer.current = setTimeout(() => setResched({ visible: false, text: "" }), 3200);
  }, []);
  useEffect(() => () => { if (reschedTimer.current) clearTimeout(reschedTimer.current); }, []);

  const today = todayStr();
  const reload = useCallback(async () => {
    const c = await getIdealDayConfig();
    // T24：daily 模式首次加载时派生 dayTemplates[7] 并持久化（幂等迁移，并入加载流程避免独立 effect）
    if ((c.templateMode ?? "daily") === "daily" && (!c.dayTemplates || c.dayTemplates.length !== 7)) {
      const next = { ...c, dayTemplates: ensureDayTemplates(c) };
      setConfig(next);
      saveIdealDayConfig(next).catch(() => {});
    } else {
      setConfig(c);
    }
    setPlans(await getIdealDayPlans(today));
    setLoaded(true);
  }, [today]);

  useEffect(() => { reload(); }, [reload]);

  const derived = useMemo(() => (config ? ensureTemplates(config) : null), [config]);
  // T24：按天模板集（ensureDayTemplates 初始化 7 天，索引 0=周一）
  const dayTemplates = useMemo(() => (config ? ensureDayTemplates(config) : null), [config]);
  // 模板模式（T24 config.templateMode，缺省 daily）
  const mode = config?.templateMode ?? "daily";
  // multi 模式：面板选中模板（config.currentTplId，画布 activeTpl 语义：chips/日历/操作行跟随）
  const multiActive = derived?.templates?.find((t) => t.id === config?.currentTplId) ?? derived?.templates?.[0] ?? null;
  // 页面展示模板：编辑中 = 编辑对象；daily = 选中天模板（画布「选中天渲染该天模板的 5 大段」）；multi = T24 selectTemplateV2（锁定优先 / dates 匹配 / 兜底）
  const activeTemplate = useMemo(() => {
    if (!config) return null;
    if (editMode && editing) return editing;
    if ((config.templateMode ?? "daily") === "multi") {
      return selectTemplateV2(config, today, derived?.templates);
    }
    return dayTemplates?.[currentDay] ?? dayTemplates?.[0] ?? null;
  }, [config, editMode, editing, derived, dayTemplates, currentDay, today]);

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
      // T24：daily 写回 dayTemplates[7]（选中天）；multi 写回 templates + currentTplId
      const nextConfig: IdealDayConfig =
        (config.templateMode ?? "daily") === "daily"
          ? { ...config, dayTemplates: dayTemplates!.map((t, i) => (i === currentDay ? nextTpl : t)) }
          : {
              ...config,
              templates: derived!.templates.map((t) => (t.id === nextTpl.id ? nextTpl : t)),
              currentTplId: nextTpl.id,
              activeTemplateId: nextTpl.id, // 兼容旧 selectTemplate 链路
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

  // ── 模板管理（T24 画布 v2 双模式：按天模板 / 多模板日历） ──

  // 模式切换（画布 data-mode-tab）：持久化 templateMode；daily 初始化并持久化 dayTemplates；multi 初始化 currentTplId
  const switchMode = async (next: "daily" | "multi") => {
    if (!config || next === mode) return;
    setEditMode(false);
    setEditing(null);
    const nextConfig: IdealDayConfig = { ...config, templateMode: next };
    if (next === "daily") {
      // T24：ensureDayTemplates 初始化 dayTemplates[7] + saveIdealDayConfig 持久化
      nextConfig.dayTemplates = ensureDayTemplates(config);
    } else if (!nextConfig.currentTplId || !derived?.templates.some((t) => t.id === nextConfig.currentTplId)) {
      nextConfig.currentTplId = derived?.templates[0]?.id;
    }
    setConfig(nextConfig);
    await saveIdealDayConfig(nextConfig);
    setCopyOpen(false);
    setHintDate(null);
    showResched("已按新模板重排今日时间轴 · 规划内容不变");
  };

  // daily：选中天（画布 tpl-chip 点击；视图态，不持久化）
  const selectDay = (i: number) => {
    if (i === currentDay) return;
    setCurrentDay(i);
    setRenameOpen(false);
    showResched("已按新模板重排今日时间轴 · 规划内容不变");
  };

  // daily：复制当前天模板到其他天（多选 chips + 复制所选；持久化 dayTemplates[7]）
  const toggleCopySel = (i: number) => {
    setCopySel((prev) => (prev.includes(i) ? prev.filter((x) => x !== i) : [...prev, i]));
  };
  const doCopy = async () => {
    if (!config || !dayTemplates) return;
    if (copySel.length === 0) {
      showToast({ type: "error", message: "请先选择要复制到的日期" });
      return;
    }
    const src = dayTemplates[currentDay];
    const targets = [...copySel].sort((a, b) => a - b);
    const nextConfig: IdealDayConfig = {
      ...config,
      dayTemplates: dayTemplates.map((t, i) => (targets.includes(i) ? { ...src, id: `day-${i}` } : t)),
    };
    setConfig(nextConfig);
    await saveIdealDayConfig(nextConfig);
    showToast({ type: "success", message: `已复制 ${DAY_LABELS[currentDay]} → ${targets.map((i) => DAY_LABELS[i]).join("、")}` });
    setCopySel([]);
    setCopyOpen(false);
  };

  // 内联重命名（画布 tpl-rename：点击名称行 → 输入框 + 确定；回车保存 / Esc 取消）
  const startRename = () => {
    if (dayTemplates) {
      setRenameValue(dayTemplates[currentDay].name);
      setRenameOpen(true);
    }
  };
  const saveRename = async () => {
    if (!config || !dayTemplates) return;
    const val = renameValue.trim();
    if (val) {
      const nextConfig: IdealDayConfig = {
        ...config,
        dayTemplates: dayTemplates.map((t, i) => (i === currentDay ? { ...t, name: val } : t)),
      };
      setConfig(nextConfig);
      await saveIdealDayConfig(nextConfig);
      showToast({ type: "success", message: `已重命名：${val}` });
    }
    setRenameOpen(false);
  };

  // multi：模板 chips（激活态 = currentTplId，切换即持久化；画布 switchTpl）
  const switchTpl = async (id: string) => {
    if (!config || id === config.currentTplId) return;
    setMultiRenameOpen(false);
    setHintDate(null);
    const nextConfig: IdealDayConfig = { ...config, currentTplId: id };
    setConfig(nextConfig);
    await saveIdealDayConfig(nextConfig);
    showResched("已按新模板重排今日时间轴 · 规划内容不变");
  };
  // multi：新增模板（复制当前模板为副本，上限 5 个；画布 tpl-add）
  const tplIdRef = useRef(1000);
  const addTpl = async () => {
    if (!config || !multiActive) return;
    if (templates.length >= 5) {
      showToast({ type: "error", message: "最多 5 个模板" });
      return;
    }
    const t: IdealDayTemplate = { ...multiActive, id: `tpl-${tplIdRef.current++}`, name: `模板 ${templates.length + 1}` };
    const nextConfig: IdealDayConfig = { ...config, templates: [...templates, t], currentTplId: t.id };
    setConfig(nextConfig);
    await saveIdealDayConfig(nextConfig);
    setHintDate(null);
    showToast({ type: "success", message: `已新增模板「${t.name}」` });
  };
  // multi：删除模板（二次确认；至少保留 1 个；删除后激活前一个；画布 tpl-del）
  const deleteTpl = async () => {
    if (!config || !multiActive) return;
    if (templates.length <= 1) {
      showToast({ type: "error", message: "至少保留一个模板" });
      return;
    }
    const idx = templates.findIndex((t) => t.id === multiActive.id);
    const nextList = templates.filter((t) => t.id !== multiActive.id);
    const prev = nextList[Math.max(0, idx - 1)];
    const nextConfig: IdealDayConfig = { ...config, templates: nextList, currentTplId: prev.id };
    setConfig(nextConfig);
    await saveIdealDayConfig(nextConfig);
    setHintDate(null);
    setConfirmDel(false);
    showToast({ type: "success", message: `已删除模板「${multiActive.name}」` });
  };
  // multi：内联重命名（回车/失焦保存，Esc 取消；画布 tpl-rename-multi）
  const startMultiRename = () => {
    if (multiActive) {
      setMultiRenameValue(multiActive.name);
      setMultiRenameOpen(true);
    }
  };
  const saveMultiRename = async (save: boolean) => {
    if (!config || !multiActive || !multiRenameOpen) return;
    setMultiRenameOpen(false);
    if (save) {
      const val = multiRenameValue.trim();
      if (val) {
        const nextConfig: IdealDayConfig = {
          ...config,
          templates: templates.map((t) => (t.id === multiActive.id ? { ...t, name: val } : t)),
        };
        setConfig(nextConfig);
        await saveIdealDayConfig(nextConfig);
        showToast({ type: "success", message: `已重命名：${val}` });
      }
    }
  };

  // 月历（画布 tpl-cal）：T24 dates[] 使用 YYYY-MM-DD，周一为一周起点
  const calDim = () => new Date(calYear, calMonth + 1, 0).getDate();
  const calOffset = () => (new Date(calYear, calMonth, 1).getDay() + 6) % 7; // 周一=0
  const dayKey = (d: number) => `${calYear}-${String(calMonth + 1).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
  const shiftMonth = (delta: number) => {
    let y = calYear;
    let m = calMonth + delta;
    if (m < 0) { m = 11; y -= 1; }
    if (m > 11) { m = 0; y += 1; }
    setCalYear(y);
    setCalMonth(m);
    setHintDate(null);
  };
  // 点击切换该模板执行日期（画布 toggleTplDate：选中日高亮 + 提示行）
  const toggleDate = async (d: number) => {
    if (!config || !multiActive) return;
    const key = dayKey(d);
    const has = multiActive.dates?.includes(key) ?? false;
    const nextDates = has ? (multiActive.dates ?? []).filter((x) => x !== key) : [...(multiActive.dates ?? []), key];
    const nextConfig: IdealDayConfig = {
      ...config,
      templates: templates.map((t) => (t.id === multiActive.id ? { ...t, dates: nextDates } : t)),
    };
    setConfig(nextConfig);
    await saveIdealDayConfig(nextConfig);
    setHintDate(d);
  };

  // 共享控制：手动锁定（T24 config.locked：开 = 固定当前模板，不随日期切换；multi 模式记录 currentTplId）
  const toggleLock = async () => {
    if (!config || !activeTemplate) return;
    const locked = !config.locked;
    const nextConfig: IdealDayConfig = { ...config, locked };
    if (locked && mode === "multi" && multiActive) {
      nextConfig.currentTplId = multiActive.id;
    }
    setConfig(nextConfig);
    await saveIdealDayConfig(nextConfig);
    showToast({ type: "success", message: locked ? "已手动锁定模板" : "已解除手动锁定" });
  };
  // 恢复自动（画布 btn-restore：解除锁定，回自动排布）
  const handleRestoreAuto = async () => {
    if (!config) return;
    const nextConfig: IdealDayConfig = { ...config, locked: false, activeTemplateId: undefined };
    setConfig(nextConfig);
    await saveIdealDayConfig(nextConfig);
    showToast({ type: "success", message: "已恢复自动排布" });
    showResched("已恢复自动模式 · 时间轴将按使用日期自动重排");
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
    if (f === 'focus') {
      // T22.7：专注跳转带预填（标题/时长/块定位），完成后自动回写
      const block = activeTemplate!.blocks.find((b) => b.id === blockId);
      if (!block) return;
      const dur = Math.max(25, Math.round((toMin(block.end) - toMin(block.start)) / 60));
      router.push(`/more/focus?title=${encodeURIComponent(block.label)}&duration=${dur}&block=${blockId}&feature=focus`);
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

  // T22.2/T22.4：日程页 ?block= / 效率页 ?goal= 定位——滚动到目标段并短暂高亮
  // 注意：必须在加载守卫 return 之前调用（React hooks 规则，否则触发 #310）
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
  }, [searchParams, editMode, (editing ?? activeTemplate)?.id, loaded, plans]);

  if (!loaded || !config || !derived || !activeTemplate) {
    return <div className="min-h-screen flex items-center justify-center" style={{ background: "var(--lifeflow-background)" }}><p style={{ color: "var(--color-text-secondary)" }}>加载中…</p></div>;
  }

  const templates = derived.templates;
  const displayTemplate = editing ?? activeTemplate;
  // 目标事项跟随排布（画布 goal-card）：仅展示真实绑定目标（goalId）的今日规划项；无数据则不渲染（不伪造）
  const goalPlans = plans.filter((p) => p.goalId);
  // 状态提示行（画布 template-hint / LOCKED_HINT）
  const hintText = config.locked
    ? "已手动锁定 · 自动排布暂停，时段不会被模板覆盖"
    : mode === "multi"
      ? `当前模板：${multiActive?.name} · 日历选择执行日期`
      : `当前模板：${DAY_LABELS[currentDay]} · 独立排布`;
  // 已选统计（画布 cal-stats：X 天 · 本周执行 周一至周五；按当前月历视图统计）
  const calStats = (() => {
    const dates = multiActive?.dates ?? [];
    const dim = new Date(calYear, calMonth + 1, 0).getDate();
    let count = 0;
    const wd: number[] = [];
    for (let d = 1; d <= dim; d++) {
      if (dates.includes(dayKey(d))) {
        count += 1;
        const w = (new Date(calYear, calMonth, d).getDay() + 6) % 7;
        if (!wd.includes(w)) wd.push(w);
      }
    }
    wd.sort((a, b) => a - b);
    return { count, weekdays: wd.length ? compactWeekdays(wd) : "无" };
  })();

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

      {/* 8+8+8 三色环形（画布形态：三色弧 sleep 紫/study 蓝/rest 绿 + 中心数字 + 图例；数据计算保留） */}
      {(() => {
        const dist = computeDayDistribution(activeTemplate);
        const C = 2 * Math.PI * 50;
        const arcs = dist.mins.reduce<{ color: string; dash: string; offset: number }[]>((accArr, min, i) => {
          const frac = dist.totalMin > 0 ? Math.max(0, min / dist.totalMin) : 0;
          const acc = accArr.reduce((s, a) => s + parseFloat(a.dash.split(" ")[0]) / C, 0);
          return [
            ...accArr,
            {
              color: dist.labels[i].color,
              dash: `${(frac * C).toFixed(2)} ${(C - frac * C).toFixed(2)}`,
              offset: -acc * C,
            },
          ];
        }, []);
        return (
          <div className="px-4 mb-3">
            <div className="flex items-center gap-4 rounded-[20px] px-4 py-4" style={{ background: "var(--color-surface-card)", boxShadow: "var(--shadow-card)" }}>
              <div className="relative h-[124px] w-[124px] shrink-0">
                <svg className="block h-full w-full" viewBox="0 0 120 120" style={{ transform: "rotate(-90deg)" }} aria-hidden="true">
                  {arcs.map((a, i) => (
                    <circle key={i} cx="60" cy="60" r="50" fill="none" stroke={a.color} strokeWidth="11" strokeLinecap="round"
                      strokeDasharray={a.dash} strokeDashoffset={a.offset} />
                  ))}
                </svg>
                <div className="absolute inset-0 flex flex-col items-center justify-center gap-1">
                  <div className="flex items-baseline gap-0.5 text-[20px] font-bold tabular-nums leading-none" style={{ color: "var(--color-text-primary)" }}>
                    {dist.totalH}<span className="text-[11px] font-semibold">h</span>
                  </div>
                  <div className="text-[10px] leading-none" style={{ color: "var(--color-text-secondary)" }}>已安排 / 24h</div>
                </div>
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-1.5 pb-1">
                  <Sparkles className="h-3.5 w-3.5 shrink-0" style={{ color: "var(--lifeflow-primary)" }} />
                  <span className="text-[13px] font-bold" style={{ color: "var(--color-text-primary)" }}>8+8+8 理想分布</span>
                </div>
                <div className="flex flex-col gap-[7px]">
                  {dist.labels.map((l) => (
                    <div key={l.name} className="flex items-center gap-2 min-w-0">
                      <span className="h-2 w-2 rounded-full shrink-0" style={{ background: l.color }} />
                      <span className="min-w-0 truncate text-[12px] font-medium" style={{ color: "var(--color-text-primary)" }}>{l.name}</span>
                      <span className="ml-auto text-[11px] font-semibold tabular-nums" style={{ color: "var(--color-text-secondary)" }}>{l.text}</span>
                    </div>
                  ))}
                </div>
                <p className="pt-1 text-[10px] leading-relaxed" style={{ color: "var(--color-text-secondary)" }}>三色环形随模板安排实时计算</p>
              </div>
            </div>
          </div>
        );
      })()}

      {/* 模板切换与管理（画布 v2 双模式：segmented 按天模板 / 多模板日历 + 共享控制；T24 数据模型） */}
      {!editMode && (
        <div className="px-4 mb-3">
          <div className="rounded-[20px] px-4 py-3" style={{ background: "var(--color-surface-card)", boxShadow: "var(--shadow-card)" }}>
            {/* 3.1 模式切换（画布 lf-seg：按天模板 / 多模板日历，data-mode-tab 语义） */}
            <div className="grid grid-cols-2 gap-0.5 rounded-full p-0.5" style={{ background: "var(--lifeflow-muted)", border: "1px solid var(--lifeflow-border)" }} role="group" aria-label="模板模式切换">
              <button type="button" onClick={() => switchMode("daily")} aria-pressed={mode === "daily"}
                className="flex h-[30px] items-center justify-center rounded-full text-[13px] transition-colors"
                style={{ background: mode === "daily" ? "var(--color-surface-card)" : "transparent", color: mode === "daily" ? "var(--color-text-primary)" : "var(--color-text-secondary)", fontWeight: mode === "daily" ? 600 : 500, boxShadow: mode === "daily" ? "var(--shadow-card)" : "none" }}>
                按天模板
              </button>
              <button type="button" onClick={() => switchMode("multi")} aria-pressed={mode === "multi"}
                className="flex h-[30px] items-center justify-center rounded-full text-[13px] transition-colors"
                style={{ background: mode === "multi" ? "var(--color-surface-card)" : "transparent", color: mode === "multi" ? "var(--color-text-primary)" : "var(--color-text-secondary)", fontWeight: mode === "multi" ? 600 : 500, boxShadow: mode === "multi" ? "var(--shadow-card)" : "none" }}>
                多模板日历
              </button>
            </div>

            {/* 3.2 按天模板模式（画布 data-mode-panel="daily"）：7 天 chips + 复制到其他天 + 内联重命名 */}
            {mode === "daily" && (
              <div style={{ animation: "fade-in 0.18s ease" }}>
                <div className="flex items-center gap-2 overflow-x-auto no-scrollbar" style={{ scrollbarWidth: "none", padding: "10px 1px 2px" }} role="group" aria-label="选择每天独立模板">
                  {DAY_LABELS.map((label, i) => {
                    const on = currentDay === i;
                    return (
                      <button key={label} type="button" onClick={() => selectDay(i)} aria-pressed={on}
                        className="flex h-8 shrink-0 items-center justify-center rounded-full px-3.5 text-[13px] transition-all active:scale-95"
                        style={{ border: `1px solid ${on ? "var(--lifeflow-primary)" : "var(--lifeflow-border)"}`, background: on ? "var(--lifeflow-brand-50)" : "var(--color-surface-card)", color: on ? "var(--lifeflow-primary)" : "var(--color-text-secondary)", fontWeight: on ? 600 : 500 }}>
                        {label}
                      </button>
                    );
                  })}
                </div>

                {/* 复制到其他天（画布 tpl-copy-row + tpl-picker 展开面板） */}
                <div className="mt-2.5 flex items-center gap-2">
                  <button type="button" onClick={() => setCopyOpen((v) => !v)} aria-expanded={copyOpen}
                    className="flex h-[30px] items-center gap-1.5 rounded-full border px-3 text-[12px] font-medium transition-colors"
                    style={{ borderColor: "var(--lifeflow-border)", background: "var(--color-surface-card)", color: "var(--color-text-secondary)" }}>
                    <Copy className="h-3.5 w-3.5 shrink-0" /> 复制到其他天
                  </button>
                  <span className="min-w-0 text-[11px]" style={{ color: "var(--color-text-secondary)" }}>将该模板复制给其他天</span>
                </div>
                {copyOpen && (
                  <div style={{ paddingTop: 10, marginTop: 10, borderTop: "1px solid var(--lifeflow-border)" }}>
                    <div className="flex flex-wrap gap-2">
                      {DAY_LABELS.map((label, i) => {
                        if (i === currentDay) return null;
                        const picked = copySel.includes(i);
                        return (
                          <button key={label} type="button" onClick={() => toggleCopySel(i)} aria-pressed={picked}
                            className="flex h-8 items-center justify-center rounded-full px-3.5 text-[13px] transition-all active:scale-95"
                            style={{ border: `1px solid ${picked ? "var(--lifeflow-primary)" : "var(--lifeflow-border)"}`, background: picked ? "var(--lifeflow-brand-50)" : "var(--color-surface-card)", color: picked ? "var(--lifeflow-primary)" : "var(--color-text-secondary)", fontWeight: picked ? 600 : 500 }}>
                            {label}
                          </button>
                        );
                      })}
                    </div>
                    <div className="mt-2.5 flex items-center justify-between gap-2.5">
                      <span className="text-[11px]" style={{ color: "var(--color-text-secondary)" }}>可多选 · 复制模板与名称</span>
                      <button type="button" onClick={doCopy}
                        className="flex h-[30px] items-center gap-1 rounded-full px-3 text-[12px] font-semibold active:opacity-85"
                        style={{ background: "var(--lifeflow-primary)", color: "var(--lifeflow-primary-foreground)" }}>
                        <Check className="h-3.5 w-3.5 shrink-0" /> 复制所选
                      </button>
                    </div>
                  </div>
                )}

                {/* 名称行 + 内联重命名 + 编辑向导入口（画布 tpl-name-wrap） */}
                <div className="mt-2.5">
                  {!renameOpen ? (
                    <div className="flex items-center gap-2">
                      <button type="button" onClick={startRename} aria-label="重命名当前模板"
                        className="flex min-w-0 flex-1 cursor-pointer items-center gap-1.5 rounded-[10px] px-2.5 py-2 text-left transition-colors"
                        style={{ background: "var(--lifeflow-muted)", border: "1px solid var(--lifeflow-border)" }}>
                        <CalendarDays className="h-3.5 w-3.5 shrink-0" style={{ color: "var(--lifeflow-primary)" }} />
                        <span className="min-w-0 flex-1 truncate text-[13px] font-semibold" style={{ color: "var(--color-text-primary)" }}>{dayTemplates?.[currentDay]?.name}</span>
                        <span className="shrink-0 text-[11px]" style={{ color: "var(--color-text-secondary)" }}>点击起名</span>
                      </button>
                      <button type="button" onClick={() => startEdit(dayTemplates![currentDay])}
                        className="flex h-[34px] shrink-0 items-center gap-1 rounded-[10px] px-3 text-[12px] font-medium active:opacity-80"
                        style={{ background: "var(--lifeflow-brand-50)", color: "var(--lifeflow-primary)" }}>
                        <SlidersHorizontal className="h-3.5 w-3.5" /> 编辑模板
                      </button>
                    </div>
                  ) : (
                    <div className="flex items-center gap-2 rounded-[10px] p-1.5" style={{ background: "var(--lifeflow-muted)" }}>
                      <input
                        autoFocus
                        value={renameValue}
                        onChange={(e) => setRenameValue(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === "Enter") { e.preventDefault(); saveRename(); }
                          if (e.key === "Escape") setRenameOpen(false);
                        }}
                        maxLength={12}
                        placeholder={`为本周${DAY_LABELS[currentDay][1]}起名`}
                        aria-label="模板名称"
                        className="h-[34px] min-w-0 flex-1 rounded-lg px-2.5 text-[13px] outline-none"
                        style={{ border: "1px solid var(--lifeflow-primary)", background: "var(--color-surface-card)", color: "var(--color-text-primary)" }}
                      />
                      <button type="button" onClick={saveRename}
                        className="flex h-[30px] shrink-0 items-center gap-1 rounded-full px-3 text-[12px] font-semibold active:opacity-85"
                        style={{ background: "var(--lifeflow-primary)", color: "var(--lifeflow-primary-foreground)" }}>
                        <Check className="h-3.5 w-3.5 shrink-0" /> 确定
                      </button>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* 3.3 多模板日历模式（画布 data-mode-panel="multi"）：模板 chips + 操作行 + 月历卡 + 已选统计 */}
            {mode === "multi" && (
              <div style={{ animation: "fade-in 0.18s ease" }}>
                <div className="flex items-center gap-2 overflow-x-auto no-scrollbar" style={{ scrollbarWidth: "none", padding: "10px 1px 2px" }} role="group" aria-label="模板列表">
                  {templates.map((t) => {
                    const on = t.id === multiActive?.id;
                    return (
                      <button key={t.id} type="button" onClick={() => switchTpl(t.id)} aria-pressed={on}
                        className="flex h-8 shrink-0 items-center justify-center rounded-full px-3.5 text-[13px] transition-all active:scale-95"
                        style={{ border: `1px solid ${on ? "var(--lifeflow-primary)" : "var(--lifeflow-border)"}`, background: on ? "var(--lifeflow-brand-50)" : "var(--color-surface-card)", color: on ? "var(--lifeflow-primary)" : "var(--color-text-secondary)", fontWeight: on ? 600 : 500 }}>
                        {t.name}
                      </button>
                    );
                  })}
                  <button type="button" onClick={addTpl} aria-label="新增模板"
                    className="flex h-8 shrink-0 items-center justify-center gap-1 rounded-full border border-dashed px-3.5 text-[13px] font-medium transition-all active:scale-95"
                    style={{ borderColor: "var(--lifeflow-border)", color: "var(--color-text-secondary)", background: "transparent" }}>
                    <Plus className="h-3.5 w-3.5 shrink-0" /> 新增模板
                  </button>
                </div>

                {/* 操作行：重命名（点击名称/铅笔）+ 编辑 + 删除（画布 tpl-op-row） */}
                <div className="mt-2.5 flex items-center gap-2">
                  {!multiRenameOpen ? (
                    <>
                      <button type="button" onClick={startMultiRename} aria-label="重命名当前模板"
                        className="flex h-[34px] min-w-0 flex-1 cursor-pointer items-center gap-1.5 rounded-[10px] px-3 text-left text-[13px] font-semibold transition-colors"
                        style={{ background: "var(--lifeflow-muted)", border: "1px solid var(--lifeflow-border)", color: "var(--color-text-primary)" }}>
                        <span className="min-w-0 flex-1 truncate">{multiActive?.name}</span>
                        <Pencil className="h-3.5 w-3.5 shrink-0" style={{ color: "var(--lifeflow-primary)" }} />
                      </button>
                      <button type="button" onClick={() => startEdit(multiActive!)}
                        className="flex h-[34px] shrink-0 items-center gap-1 rounded-[10px] px-3 text-[12px] font-medium active:opacity-80"
                        style={{ background: "var(--lifeflow-brand-50)", color: "var(--lifeflow-primary)" }}>
                        <SlidersHorizontal className="h-3.5 w-3.5" /> 编辑
                      </button>
                      {!confirmDel ? (
                        <button type="button" onClick={() => setConfirmDel(true)}
                          className="flex h-[34px] shrink-0 items-center gap-1 rounded-[10px] border px-3 text-[12px] font-medium transition-colors active:scale-95"
                          style={{ borderColor: "var(--lifeflow-border)", background: "var(--color-surface-card)", color: "var(--state-error)" }}>
                          <Trash2 className="h-3.5 w-3.5" /> 删除
                        </button>
                      ) : (
                        <>
                          <button type="button" onClick={deleteTpl}
                            className="flex h-[34px] shrink-0 items-center gap-1 rounded-[10px] px-3 text-[12px] font-semibold active:opacity-85"
                            style={{ background: "var(--state-error)", color: "var(--lifeflow-primary-foreground)" }}>
                            <Trash2 className="h-3.5 w-3.5" /> 确认删除
                          </button>
                          <button type="button" onClick={() => setConfirmDel(false)} aria-label="取消删除"
                            className="flex h-[34px] shrink-0 items-center rounded-[10px] px-2 text-[12px] active:opacity-80"
                            style={{ background: "var(--lifeflow-muted)", color: "var(--color-text-secondary)" }}>
                            取消
                          </button>
                        </>
                      )}
                    </>
                  ) : (
                    <div className="flex min-w-0 flex-1 items-center gap-2 rounded-[10px] p-1.5" style={{ background: "var(--lifeflow-muted)" }}>
                      <input
                        autoFocus
                        value={multiRenameValue}
                        onChange={(e) => setMultiRenameValue(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === "Enter") { e.preventDefault(); saveMultiRename(true); }
                          if (e.key === "Escape") saveMultiRename(false);
                        }}
                        onBlur={() => saveMultiRename(true)}
                        maxLength={12}
                        placeholder="为模板起名"
                        aria-label="模板名称"
                        className="h-[34px] min-w-0 flex-1 rounded-lg px-2.5 text-[13px] outline-none"
                        style={{ border: "1px solid var(--lifeflow-primary)", background: "var(--color-surface-card)", color: "var(--color-text-primary)" }}
                      />
                      <button type="button" onMouseDown={(e) => e.preventDefault()} onClick={() => saveMultiRename(true)}
                        className="flex h-[30px] shrink-0 items-center gap-1 rounded-full px-3 text-[12px] font-semibold active:opacity-85"
                        style={{ background: "var(--lifeflow-primary)", color: "var(--lifeflow-primary-foreground)" }}>
                        <Check className="h-3.5 w-3.5 shrink-0" /> 确定
                      </button>
                    </div>
                  )}
                </div>

                {/* 月历卡（画布 tpl-cal：月切换 ←→ · 周一~周日表头 · 日期网格 · 选中日高亮 · 提示行） */}
                <div className="mt-2.5 rounded-xl p-3" style={{ border: "1px solid var(--lifeflow-border)", background: "var(--color-surface-card)" }}>
                  <div className="flex items-center justify-between gap-2">
                    <button type="button" onClick={() => shiftMonth(-1)} aria-label="上一个月"
                      className="flex h-[30px] w-[30px] items-center justify-center rounded-full transition-transform active:scale-90"
                      style={{ background: "var(--lifeflow-muted)", border: "1px solid var(--lifeflow-border)", color: "var(--color-text-secondary)" }}>
                      <ChevronLeft className="h-4 w-4" />
                    </button>
                    <div className="text-[14px] font-semibold tabular-nums" style={{ color: "var(--color-text-primary)" }}>{calYear} 年 {calMonth + 1} 月</div>
                    <button type="button" onClick={() => shiftMonth(1)} aria-label="下一个月"
                      className="flex h-[30px] w-[30px] items-center justify-center rounded-full transition-transform active:scale-90"
                      style={{ background: "var(--lifeflow-muted)", border: "1px solid var(--lifeflow-border)", color: "var(--color-text-secondary)" }}>
                      <ChevronRight className="h-4 w-4" />
                    </button>
                  </div>
                  <div className="mt-2.5 grid grid-cols-7 gap-0.5">
                    {DAY_LABELS.map((w) => (
                      <span key={w} className="text-center text-[10px] font-medium leading-[1.6]" style={{ color: "var(--color-text-secondary)" }}>{w}</span>
                    ))}
                  </div>
                  <div className="mt-1 grid grid-cols-7 gap-[3px]">
                    {Array.from({ length: calOffset() }).map((_, i) => <span key={`cal-blank-${i}`} />)}
                    {Array.from({ length: calDim() }, (_, i) => i + 1).map((d) => {
                      const key = dayKey(d);
                      const sel = multiActive?.dates?.includes(key) ?? false;
                      return (
                        <button key={d} type="button" onClick={() => toggleDate(d)} aria-pressed={sel}
                          className="flex w-full items-center justify-center rounded-full text-[12px] tabular-nums transition-all active:scale-90"
                          style={{ aspectRatio: "1 / 1", background: sel ? "var(--lifeflow-primary)" : "var(--lifeflow-muted)", color: sel ? "var(--lifeflow-primary-foreground)" : "var(--color-text-primary)", fontWeight: sel ? 600 : 400 }}>
                          {d}
                        </button>
                      );
                    })}
                  </div>
                  <p className="mt-2 text-[11px] leading-relaxed" style={{ color: "var(--color-text-secondary)" }}>
                    {hintDate !== null
                      ? `${calMonth + 1} 月 ${hintDate} 日 · ${(multiActive?.dates?.includes(dayKey(hintDate)) ?? false) ? `已选「${multiActive?.name}」` : "已取消选择"}`
                      : `该日将执行「${multiActive?.name}」`}
                  </p>
                </div>

                {/* 已选统计（画布 cal-stats：X 天 · 本周执行） */}
                <p className="mt-2 text-[12px] leading-relaxed" style={{ color: "var(--color-text-secondary)" }}>
                  已选 <span className="font-semibold tabular-nums">{calStats.count}</span> 天 · 本周执行 <span className="font-semibold tabular-nums">{calStats.weekdays}</span>
                </p>
              </div>
            )}

            {/* 3.4 共享控制：手动锁定 switch + 恢复自动（画布 tpl-controls） */}
            <div className="mt-3 flex items-center justify-between gap-2 pt-3" style={{ borderTop: "1px solid var(--lifeflow-border)" }}>
              <span className="flex min-w-0 shrink-0 items-center gap-1.5">
                <Lock className="h-3.5 w-3.5 shrink-0" style={{ color: "var(--color-text-secondary)" }} />
                <span className="text-[12px] font-medium" style={{ color: "var(--color-text-secondary)" }}>手动锁定</span>
                <ToggleSwitch checked={!!config.locked} onChange={toggleLock} label="手动锁定模板" />
              </span>
              <button type="button" onClick={handleRestoreAuto}
                className="flex h-8 shrink-0 items-center gap-1 rounded-full border px-3 text-[12px] font-medium transition-colors active:opacity-90"
                style={{ borderColor: "var(--lifeflow-border)", background: "var(--color-surface-card)", color: "var(--color-text-secondary)" }}>
                <RotateCcw className="h-3.5 w-3.5 shrink-0" /> 恢复自动
              </button>
            </div>

            {/* 3.5 重排反馈条（画布 resched-toast：切换模板 / 恢复自动时出现，3.2s 自动隐藏） */}
            {resched.visible && (
              <div role="status" className="mt-2 flex items-center gap-2 rounded-full px-3 py-2" style={{ background: "rgba(52,199,89,0.14)", border: "1px solid var(--state-success)", color: "var(--state-success)" }}>
                <RotateCcw className="h-3.5 w-3.5 shrink-0" />
                <span className="min-w-0 flex-1 text-[12px] font-medium leading-snug">{resched.text}</span>
                <button type="button" onClick={() => setResched((s) => ({ ...s, visible: false }))} aria-label="关闭重排提示"
                  className="flex h-6 shrink-0 items-center justify-center rounded-full px-2 text-[11px] font-semibold active:opacity-80"
                  style={{ background: "var(--state-success)", color: "var(--lifeflow-primary-foreground)" }}>
                  关闭
                </button>
              </div>
            )}

            {/* 状态提示行（画布 template-hint / LOCKED_HINT） */}
            <p className="mt-2.5 text-[12px] leading-relaxed" style={{ color: "var(--color-text-secondary)" }}>{hintText}</p>
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

      {/* 目标事项跟随排布（画布 goal-card：Sparkles + 时间 + 来源徽标；仅真实 goalId 数据，无则不渲染） */}
      {goalPlans.length > 0 && (
        <div className="px-4 mb-3">
          <div className="rounded-[20px] px-3.5 py-3" style={{ background: "var(--color-surface-card)", boxShadow: "var(--shadow-card)", borderTop: "3px solid #8B5CF6" }}>
            <div className="flex items-center gap-2">
              <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full" style={{ background: "rgba(139,92,246,0.14)", color: "#8B5CF6" }}>
                <Sparkles className="w-3.5 h-3.5" />
              </span>
              <div className="min-w-0">
                <h2 className="text-[14px] font-bold leading-tight" style={{ color: "var(--color-text-primary)" }}>目标事项跟随排布</h2>
                <p className="text-[11px] leading-snug" style={{ color: "var(--color-text-secondary)" }}>来自「目标」模块 · 已绑定今日理想日时段</p>
              </div>
            </div>
            <div className="flex flex-col gap-1.5 mt-2.5">
              {goalPlans.map((p) => (
                <div key={`${p.blockId}-${p.feature}`} className="flex items-center gap-2 px-2.5 py-2 rounded-[10px]" style={{ background: "rgba(139,92,246,0.14)" }}>
                  <Sparkles className="w-3.5 h-3.5 shrink-0" style={{ color: "#8B5CF6" }} />
                  <span className="min-w-0 flex-1 text-[13px] font-semibold truncate" style={{ color: "var(--color-text-primary)" }}>{p.content}</span>
                  <span className="shrink-0 text-[12px] tabular-nums" style={{ color: "var(--color-text-primary)" }}>{p.start}-{p.end}</span>
                  <span className="shrink-0 flex items-center h-[18px] px-1.5 rounded-md text-[10px] font-semibold" style={{ background: "#8B5CF6", color: "#fff" }}>来源 目标</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* ── 5 大段列表（画布 block-card：模块色 chip + 时间 + 功能行 + 完成勾选；编辑/完成逻辑保留） ── */}
      <div className="px-4">
        <div className="flex items-center justify-between gap-2 pb-2 pt-1">
          <h2 className="text-[13px] font-semibold" style={{ color: "var(--color-text-secondary)" }}>5 大段 · 点击整段标记完成</h2>
          <span className="text-[11px] tabular-nums" style={{ color: "var(--color-text-secondary)" }}>
            已排 {computeDayDistribution(activeTemplate).totalH}h · {new Date().getMonth() + 1}月{new Date().getDate()}日
          </span>
        </div>
        {displayTemplate.blocks.length === 0 ? (
          <p className="text-[13px] py-6 text-center" style={{ color: "var(--color-text-disabled)" }}>模板为空，去编辑添加时间段</p>
        ) : (
          <div className="flex flex-col gap-3">
            {[...blocksBySegment(displayTemplate).entries()].map(([g, blocks]) => {
              const meta = SEGMENT_META[g];
              const IconComp = ICON_REGISTRY[meta.icon] ?? Icons.Circle;
              const collapsed = collapsedGroups.has(g);
              const segMins = blocks.reduce((sum, b) => sum + Math.max(0, toMin(b.end) - toMin(b.start)), 0);
              const rangeStart = blocks.length > 0 ? blocks.reduce((min, b) => (b.start < min ? b.start : min), blocks[0].start) : meta.defaultStart;
              const rangeEnd = blocks.length > 0 ? blocks.reduce((max, b) => (b.end > max ? b.end : max), blocks[0].end) : meta.defaultEnd;
              return (
                <div key={g} className="rounded-[20px] overflow-hidden" style={{ background: "var(--color-surface-card)", boxShadow: "var(--shadow-card)" }}>
                  {/* 段头（画布 block-hd：模块色圆 chip + 标题 + 时间/时段数 + 折叠） */}
                  <button type="button" onClick={() => setCollapsedGroups((prev) => { const n = new Set(prev); if (n.has(g)) n.delete(g); else n.add(g); return n; })}
                    className="w-full flex items-center gap-3 px-4 pt-3.5 pb-2 text-left">
                    <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full" style={{ background: `${meta.color}1A`, color: meta.color }}>
                      <IconComp className="h-[18px] w-[18px]" />
                    </span>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <span className="text-[15px] font-bold leading-tight" style={{ color: "var(--color-text-primary)" }}>{meta.label}</span>
                        {g === 'sleep' && (
                          <span className="flex items-center gap-1 h-5 px-2 rounded-md text-[10px] font-semibold" style={{ background: `${meta.color}1A`, color: meta.color }}>
                            <Lock className="w-3 h-3" /> 仅 sleep 功能锁定
                          </span>
                        )}
                      </div>
                      <p className="text-[12px] mt-0.5 truncate tabular-nums" style={{ color: "var(--color-text-secondary)" }}>
                        {rangeStart}-{rangeEnd} · {blocks.length} 时段{g === 'sleep' ? ` · 共 ${fmtDur(segMins)}` : ""}
                      </p>
                    </div>
                    <span className="shrink-0">{collapsed ? <ChevronDown className="w-4 h-4" style={{ color: "var(--color-text-secondary)" }} /> : <ChevronUp className="w-4 h-4" style={{ color: "var(--color-text-secondary)" }} />}</span>
                  </button>

                  {!collapsed && (
                    <div className="pb-2">
                      {blocks.map((b) => {
                        const blockPlans = plans.filter((p) => p.blockId === b.id);
                        const allDone = blockPlans.length > 0 && blockPlans.every((p) => p.isCompleted);
                        const durMin = Math.max(0, toMin(b.end) - toMin(b.start));
                        return (
                          <div key={b.id} id={`ideal-block-${b.id}`}
                            className="transition-colors duration-500"
                            style={{ background: focusBlockId === b.id && focusFlash ? "var(--lifeflow-brand-50)" : "transparent", boxShadow: focusBlockId === b.id && focusFlash ? "0 0 0 2px rgba(99,102,241,0.35)" : "none" }}>
                            {/* 时段行（画布 slot-row：名称 + 时间 → 时长 + 完成勾选） */}
                            <button type="button" onClick={() => handleToggleBlock(b.id)}
                              className="w-full flex items-center gap-3 px-4 py-2.5 text-left active:opacity-70"
                              style={{ borderTop: "1px solid var(--lifeflow-border)", opacity: allDone ? 0.6 : 1 }}>
                              <span className="min-w-0 flex-1 text-[14px] font-semibold truncate" style={{ color: allDone ? "var(--color-text-secondary)" : "var(--color-text-primary)", textDecoration: allDone ? "line-through" : "none" }}>{b.label}</span>
                              <span className="flex items-center gap-2 shrink-0">
                                <span className="text-[12px] tabular-nums" style={{ color: "var(--color-text-primary)" }}>{b.start} → {b.end}</span>
                                <span className="flex items-center h-[18px] px-1.5 rounded-md text-[10px] tabular-nums" style={{ background: "var(--lifeflow-muted)", color: "var(--color-text-secondary)" }}>{fmtDur(durMin)}</span>
                              </span>
                              <span className="shrink-0 flex h-5 w-5 items-center justify-center rounded-full" style={{
                                background: allDone ? "var(--state-success)" : "transparent",
                                border: allDone ? "none" : "2px solid var(--lifeflow-border)",
                              }}>
                                {allDone && <Check className="h-3 w-3 text-white" strokeWidth={3} />}
                              </span>
                            </button>
                            {/* 功能行（画布 lf-fn-row：绑定功能 caption + 模块色 chip + 名称） */}
                            <div className="flex items-center gap-2.5 px-4 pb-2.5 pt-1 flex-wrap">
                              <FeatureIconRow features={b.features} onFeatureClick={(f) => handleFeatureClick(b.id, f)} caption={g === 'sleep' ? "锁定功能" : "绑定功能"} />
                              {blockPlans.length > 0 && (
                                <span className="ml-auto text-[11px] shrink-0" style={{ color: "var(--color-text-secondary)" }}>
                                  {blockPlans.filter((p) => !p.isCompleted).length}/{blockPlans.length} 已安排
                                </span>
                              )}
                            </div>
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
        <p className="text-[11px] mt-2 pb-1" style={{ color: "var(--color-text-secondary)" }}>
          点击功能图标安排该时段的具体内容 · 点击时间段整段标记完成
        </p>
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
