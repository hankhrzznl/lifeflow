// ============================================================
// 理想日模板引擎（T22.1）：5 大段（睡眠+上午/中午/下午/晚上）· 多模板 · 独立时间槽 · L2 规划层
// ============================================================

import { getUserSettings, saveUserSettings } from "@/lib/db";
import type {
  IdealDayConfig,
  IdealDayFeature,
  IdealDayPlanItem,
  IdealDayTemplate,
  IdealDayTemplateBlock,
  IdealDayBlockGroup,
} from "@/lib/types";

// ─── 固定功能元数据（图标名 = lucide icon name，路由 = 跳转目标） ───

export interface IdealDayFeatureMeta {
  key: IdealDayFeature;
  label: string;
  icon: string;          // lucide icon name
  route: string;         // 跳转路由；'' = 无跳转
  color: string;
}

export const FEATURE_META: Record<IdealDayFeature, IdealDayFeatureMeta> = {
  sleep:      { key: 'sleep',      label: '睡眠',     icon: 'Moon',         route: '/more/sleep',                   color: '#5856D6' },
  study:      { key: 'study',      label: '学习',     icon: 'Target',       route: '/more/exam-plan',               color: '#6366F1' },
  workout:    { key: 'workout',    label: '训练',     icon: 'Dumbbell',     route: '/more/fitness',                 color: '#F97316' },
  posture:    { key: 'posture',    label: '体态拉伸', icon: 'PersonStanding', route: '/more/fitness?tab=posture',     color: '#10B981' },
  wellness:   { key: 'wellness',   label: '功法养生', icon: 'Sprout',       route: '/more/fitness?tab=wellness',     color: '#34C759' },
  water:      { key: 'water',      label: '饮水',     icon: 'Droplets',     route: '/more/water',                    color: '#0EA5E9' },
  diet:       { key: 'diet',       label: '饮食',     icon: 'Utensils',     route: '/more/diet',                     color: '#FF9500' },
  focus:      { key: 'focus',      label: '专注',     icon: 'Timer',        route: '/more/focus',                    color: '#8B5CF6' },
  leisure:    { key: 'leisure',    label: '留白',     icon: 'Coffee',       route: '',                               color: '#8E8E93' },
  notes:      { key: 'notes',      label: '备忘',     icon: 'StickyNote',   route: '/more/notes',                    color: '#007AFF' },
  routine:    { key: 'routine',    label: '作息',     icon: 'Clock',        route: '/more/schedule/routines',        color: '#FF2D55' },
  medication: { key: 'medication', label: '吃药',     icon: 'Pill',         route: '/more/medication',               color: '#FF3B30' },
};

export const FEATURE_ORDER: IdealDayFeature[] = [
  'sleep', 'study', 'workout', 'posture', 'wellness', 'water',
  'diet', 'focus', 'leisure', 'notes', 'routine', 'medication',
];

export function getFeatureMeta(key: IdealDayFeature): IdealDayFeatureMeta {
  return FEATURE_META[key];
}

/** 固定图标选择面板：全部可选功能（medication 由调用方按维修模式过滤） */
export function getAllFeatures(): IdealDayFeature[] {
  return [...FEATURE_ORDER];
}

// ─── 5 大段元数据（默认边界可调 + 8+8+8 推荐配额提示） ───

export interface IdealDaySegmentMeta {
  key: IdealDayBlockGroup;
  label: string;         // 段名
  icon: string;          // lucide icon name
  color: string;
  defaultStart: string;  // 默认边界（可调）
  defaultEnd: string;
  quotaHint: string;     // 8+8+8 推荐配额文案（Step 1 展示）
  special?: 'sleep';     // 独特睡眠段：仅睡眠功能、不可追加、不可删段
}

export const SEGMENT_ORDER: IdealDayBlockGroup[] = ['sleep', 'morning', 'noon', 'afternoon', 'evening'];

export const SEGMENT_META: Record<IdealDayBlockGroup, IdealDaySegmentMeta> = {
  sleep:    { key: 'sleep',    label: '睡眠',   icon: 'Moon',       color: '#5856D6', defaultStart: '22:30', defaultEnd: '06:00', quotaHint: '8h（夜间 7.5h + 午睡 0.5h）', special: 'sleep' },
  morning:  { key: 'morning',  label: '上午',   icon: 'Sunrise',    color: '#F59E0B', defaultStart: '06:00', defaultEnd: '12:00', quotaHint: '生活 2h + 目标 3h' },
  noon:     { key: 'noon',     label: '中午',   icon: 'Coffee',     color: '#10B981', defaultStart: '12:00', defaultEnd: '14:00', quotaHint: '午餐午休（生活补充）' },
  afternoon:{ key: 'afternoon',label: '下午',   icon: 'CloudSun',   color: '#6366F1', defaultStart: '14:00', defaultEnd: '18:00', quotaHint: '生活 2h + 目标 3h' },
  evening:  { key: 'evening',  label: '晚上',   icon: 'MoonStar',   color: '#8B5CF6', defaultStart: '18:00', defaultEnd: '22:30', quotaHint: '生活 4h + 目标 2h' },
};

/** 8+8+8 总览：睡眠 8h / 目标 8h / 生活 8h（推荐语义，仅作提示） */
export const EIGHT_EIGHT_EIGHT_HINT = "8+8+8 推荐：睡眠 8h（22:30-06:00 + 12:30-13:00 午睡）· 目标 8h（上午3+下午3+晚上2）· 生活 8h（上午2+下午2+晚上4）";

// ─── 默认模板（5 段 · 独立时间槽 · 槽=功能×1 次） ───

function block(id: string, label: string, start: string, end: string, group: IdealDayBlockGroup, features: IdealDayFeature[]): IdealDayTemplateBlock {
  return { id, label, start, end, group, features };
}

/** 默认工作日模板：5 大段 · 槽位与 8+8+8 配额吻合（可调） */
export function defaultWorkdayTemplate(): IdealDayTemplate {
  return {
    id: 'workday',
    name: '工作日',
    daysOfWeek: [1, 2, 3, 4, 5], // 周一~周五自动匹配
    blocks: [
      // 睡眠段（独特段：仅睡眠功能，夜间 + 午睡）
      block('sleep-night',   '夜间睡眠',    '22:30', '06:00', 'sleep',    ['sleep']),
      block('sleep-nap',     '午睡',        '12:30', '13:00', 'sleep',    ['sleep']),
      // 上午（生活 2h + 目标 3h）
      block('morning-life',  '起床洗漱',    '06:00', '08:00', 'morning',  ['routine', 'diet', 'water']),
      block('morning-study', '主目标学习',  '09:00', '12:00', 'morning',  ['study', 'focus', 'water']),
      // 中午（午餐午休）
      block('noon-lunch',    '午餐',        '12:00', '12:30', 'noon',     ['diet', 'water']),
      // 下午（目标 3h + 生活 2h）
      block('afternoon-study', '次目标学习','14:00', '17:00', 'afternoon',['study', 'focus', 'water']),
      block('afternoon-life',  '下午活动',  '17:00', '18:00', 'afternoon',['leisure', 'water']),
      // 晚上（生活 4h + 目标 2h）
      block('evening-dinner',   '晚餐',     '18:00', '19:00', 'evening',  ['diet', 'water']),
      block('evening-study',    '晚自习',   '19:00', '21:00', 'evening',  ['study', 'focus']),
      block('evening-winddown', '拉伸养生', '21:00', '21:30', 'evening',  ['posture', 'wellness']),
      block('evening-leisure',  '自由时间', '21:30', '22:30', 'evening',  ['leisure', 'notes']),
    ],
  };
}

/** 默认周末模板：训练加量、学习适量、留白更多 */
export function defaultWeekendTemplate(): IdealDayTemplate {
  return {
    id: 'weekend',
    name: '周末',
    daysOfWeek: [0, 6], // 周六~周日自动匹配
    blocks: [
      block('sleep-night',   '夜间睡眠',    '23:00', '07:00', 'sleep',    ['sleep']),
      block('sleep-nap',     '午睡',        '13:00', '13:30', 'sleep',    ['sleep']),
      block('morning-life',  '起床洗漱',    '07:00', '08:00', 'morning',  ['routine', 'diet', 'water']),
      block('morning-workout','晨间训练',   '08:00', '09:30', 'morning',  ['workout', 'posture']),
      block('morning-study', '主目标学习',  '09:30', '12:00', 'morning',  ['study', 'focus', 'water']),
      block('noon-lunch',    '午餐午休',    '12:00', '13:00', 'noon',     ['diet', 'water']),
      block('afternoon-study','次目标学习', '14:00', '17:00', 'afternoon',['study', 'focus']),
      block('afternoon-life', '自由活动',   '17:00', '18:00', 'afternoon',['leisure', 'notes', 'diet']),
      block('evening-dinner', '晚餐',       '18:00', '19:00', 'evening',  ['diet', 'water']),
      block('evening-study',  '晚间复盘',   '19:00', '20:30', 'evening',  ['study', 'focus']),
      block('evening-winddown','拉伸养生',  '20:30', '21:00', 'evening',  ['posture', 'wellness']),
      block('evening-leisure', '自由时间',  '21:00', '23:00', 'evening',  ['leisure', 'notes']),
    ],
  };
}

/** 旧 3 组（sleep/fight/life）→ 5 段迁移映射：按块 start 时间归属段（group 运行时可能为旧字符串） */
export function migrateGroup(group: string, start: string): IdealDayBlockGroup {
  if (group === 'sleep') return 'sleep';
  if (start >= '06:00' && start < '12:00') return 'morning';
  if (start >= '12:00' && start < '14:00') return 'noon';
  if (start >= '14:00' && start < '18:00') return 'afternoon';
  return 'evening'; // 18:00~次日 06:00（跨午夜兜底）
}

/** 迁移旧模板块：group 重映射；睡眠段只保留 sleep 功能（其余功能按原时间归属迁移） */
function migrateBlock(b: IdealDayTemplateBlock): IdealDayTemplateBlock {
  const g = migrateGroup(b.group as string, b.start);
  // 睡眠段锁定：仅允许 sleep 功能（旧配置若有其他功能落入睡眠段，剔除）
  const features = g === 'sleep' ? b.features.filter((f) => f === 'sleep') : b.features;
  const label = g === 'sleep' && features.length === 0 ? '睡眠' : b.label;
  return { ...b, group: g, features: features.length > 0 ? features : (g === 'sleep' ? ['sleep'] : b.features), label };
}

/**
 * 确保配置含模板（旧配置缺省时派生并回填；旧 3 组模板自动迁移到 5 段；不改 enabled）
 */
export function ensureTemplates(config: IdealDayConfig): { config: IdealDayConfig; templates: IdealDayTemplate[] } {
  if (config.templates && config.templates.length > 0) {
    // 检测是否含旧 3 组（fight/life）→ 迁移（运行时旧数据 group 为旧字符串）
    const hasLegacy = config.templates.some((t) => t.blocks.some((b) => (b.group as string) === 'fight' || (b.group as string) === 'life'));
    const templates = hasLegacy
      ? config.templates.map((t) => ({ ...t, blocks: t.blocks.map(migrateBlock) }))
      : config.templates;
    const activeId = config.activeTemplateId && templates.some((t) => t.id === config.activeTemplateId)
      ? config.activeTemplateId
      : templates[0].id;
    return { config: { ...config, activeTemplateId: activeId }, templates };
  }
  const templates = deriveDefaultTemplates(config);
  return { config: { ...config, templates, activeTemplateId: 'workday' }, templates };
}

/** 从旧字段派生默认模板集（向后兼容：旧配置无 templates 时使用） */
export function deriveDefaultTemplates(config: IdealDayConfig): IdealDayTemplate[] {
  const workday = defaultWorkdayTemplate();
  const weekend = defaultWeekendTemplate();
  // 若用户旧配置了训练时段，同步进工作日晨间训练块
  if (config.workoutStart && config.workoutEnd) {
    workday.blocks = workday.blocks.map((b) =>
      b.id === 'morning-study' ? { ...b, start: config.workoutEnd } : b,
    );
  }
  return [workday, weekend];
}

/** 按日期选择模板：优先手动激活模板；若激活模板无自动匹配，则匹配该星期的模板；否则回退手动 */
export function selectTemplate(config: IdealDayConfig, dateStr: string): IdealDayTemplate {
  const { templates } = ensureTemplates(config);
  const active = templates.find((t) => t.id === config.activeTemplateId) ?? templates[0];
  if (!active?.daysOfWeek?.length) return active;
  const dow = new Date(dateStr + 'T00:00:00').getDay();
  if (active.daysOfWeek.includes(dow)) return active;
  // 激活模板不匹配当天 → 找自动匹配的模板；无则回退激活模板
  const matched = templates.find((t) => t.daysOfWeek?.includes(dow));
  return matched ?? active;
}

// ─── L2 规划层（userSettings.idealDayPlans，不新建表） ───

function todayStr(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

/** 读取某日规划（无则空数组） */
export async function getIdealDayPlans(dateStr: string): Promise<IdealDayPlanItem[]> {
  const settings = await getUserSettings();
  return settings.idealDayPlans?.[dateStr] ?? [];
}

/** 保存某日规划（整体覆盖该日期） */
export async function saveIdealDayPlans(dateStr: string, items: IdealDayPlanItem[]): Promise<void> {
  const settings = await getUserSettings();
  const plans = { ...(settings.idealDayPlans ?? {}) };
  plans[dateStr] = items;
  await saveUserSettings({ idealDayPlans: plans });
}

/** 勾选/取消勾选某规划项 */
export async function toggleIdealDayPlan(dateStr: string, blockId: string, feature: IdealDayFeature): Promise<void> {
  const items = await getIdealDayPlans(dateStr);
  const next = items.map((p) =>
    p.blockId === blockId && p.feature === feature ? { ...p, isCompleted: !p.isCompleted } : p,
  );
  await saveIdealDayPlans(dateStr, next);
}

/** 删除某日某块某功能的规划项（供规划页覆盖保存时使用） */
export function upsertIdealDayPlan(existing: IdealDayPlanItem[], item: IdealDayPlanItem): IdealDayPlanItem[] {
  const idx = existing.findIndex((p) => p.blockId === item.blockId && p.feature === item.feature);
  if (idx >= 0) {
    const next = [...existing];
    next[idx] = { ...existing[idx], ...item, isCompleted: existing[idx].isCompleted };
    return next;
  }
  return [...existing, item];
}

export { todayStr };
