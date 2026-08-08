// ============================================================
// 理想日蓝图（T19）：配置读写 + 时间槽计算
// ============================================================

import { getUserSettings, saveUserSettings } from "@/lib/db";
import { defaultIdealDayConfig, defaultSchoolIdealDayConfig, type IdealDayConfig, type IdealDayMode, type IdealStudyConfig } from "@/lib/types";

/** T21-7：当前作息模式（暑假/开学），默认暑假 */
export async function getScheduleMode(): Promise<IdealDayMode> {
  const settings = await getUserSettings();
  return settings.idealDayMode ?? 'summer';
}

/** 读取指定模式的配置（无保存值时回退默认模板；summer 兼容旧 idealDayConfig 字段） */
export async function getIdealDayConfigByMode(mode: IdealDayMode): Promise<IdealDayConfig> {
  const settings = await getUserSettings();
  const raw = mode === 'school' ? settings.idealDaySchoolConfig : (settings.idealDaySummerConfig ?? settings.idealDayConfig);
  const base = mode === 'school' ? defaultSchoolIdealDayConfig() : defaultIdealDayConfig();
  if (raw) {
    // 合并默认值，兼容旧配置缺字段
    return { ...base, ...raw, study: { ...base.study, ...raw.study } };
  }
  return base;
}

/** 保存指定模式的配置（不改变当前模式） */
export async function saveIdealDayConfigByMode(mode: IdealDayMode, config: IdealDayConfig): Promise<void> {
  if (mode === 'school') {
    await saveUserSettings({ idealDaySchoolConfig: config });
  } else {
    await saveUserSettings({ idealDaySummerConfig: config });
  }
}

/** 读取当前生效模式的理想日蓝图（对外主入口，T19 旧调用兼容） */
export async function getIdealDayConfig(): Promise<IdealDayConfig> {
  return getIdealDayConfigByMode(await getScheduleMode());
}

/** 保存当前生效模式的理想日蓝图（对外主入口，T19 旧调用兼容） */
export async function saveIdealDayConfig(config: IdealDayConfig): Promise<void> {
  await saveIdealDayConfigByMode(await getScheduleMode(), config);
}

/**
 * T21-7：一键切换作息模式。
 * - 保留全局 enabled 开关（切换不改变系统启停）
 * - 目标模式无配置时自动用模板预置（开学模板：6:00 起、晚自习等）
 * - 切换后按新模式自动重排（作息模板同步 + 今日起 7 天蓝图事项刷新）
 */
export async function switchScheduleMode(mode: IdealDayMode): Promise<{ applied: boolean }> {
  const current = await getScheduleMode();
  if (current === mode) return { applied: false };

  const currentConfig = await getIdealDayConfigByMode(current);
  const target = await getIdealDayConfigByMode(mode);
  // 全局开关随切换保留，避免切换后整个理想日系统被关闭/误开
  const next = { ...target, enabled: currentConfig.enabled };
  await saveIdealDayConfigByMode(mode, next);
  await saveUserSettings({ idealDayMode: mode });

  await applyIdealDayBlueprint();
  return { applied: true };
}

/** 学习时段槽：按「主目标 ≥ 次目标 2 倍」从 studyStart 开始顺序切分，自动绕开午睡窗口（生成多个不重叠段） */
export interface StudySlot {
  label: string;
  goalName: string;
  start: string;
  end: string;
  minutes: number;
}

/**
 * 从 start 开始学习 minutes 分钟，输出一个或多个不跨越午睡窗口 [napStart, napEnd) 的段。
 * 例：08:30 起学 330min、午睡 12:30-13:00 → [08:30-12:30(240), 13:00-14:30(90)]
 */
function studySegments(
  start: string,
  minutes: number,
  napStart: string,
  napEnd: string,
): { start: string; end: string; minutes: number }[] {
  const segs: { start: string; end: string; minutes: number }[] = [];
  const napStartM = timeToMinutes(napStart);
  const napEndM = timeToMinutes(napEnd);
  let cursor = start;
  let remaining = minutes;

  while (remaining > 0) {
    const cursorM = timeToMinutes(cursor);
    // 已在午睡窗口内 → 直接跳到午睡结束，不产生学习段
    if (cursorM >= napStartM && cursorM < napEndM) {
      cursor = napEnd;
      continue;
    }
    const nextM = cursorM + remaining;
    // 整段在午睡前完成
    if (nextM <= napStartM) {
      segs.push({ start: cursor, end: addMinutes(cursor, remaining), minutes: remaining });
      break;
    }
    // 先学到午睡开始，剩余转午睡后继续
    if (cursorM < napStartM) {
      const untilNap = napStartM - cursorM;
      segs.push({ start: cursor, end: napStart, minutes: untilNap });
      remaining -= untilNap;
      cursor = napEnd;
      continue;
    }
    // 午睡结束后正常学习
    segs.push({ start: cursor, end: addMinutes(cursor, remaining), minutes: remaining });
    break;
  }
  return segs;
}

export function buildStudySlots(config: IdealDayConfig): StudySlot[] {
  const s: IdealStudyConfig = config.study;
  const totalMinutes = Math.round(s.totalHours * 60);
  const primaryMinutes = Math.round(s.primaryGoalHours * 60);
  const secondaryMinutes = Math.round(s.secondaryGoalHours * 60);
  // 防御：比例兜底 —— 主目标至少 2 倍，且不超过总时长
  const clampedPrimary = Math.min(totalMinutes, Math.max(primaryMinutes, secondaryMinutes * 2, totalMinutes / 2));
  const clampedSecondary = Math.max(0, Math.min(secondaryMinutes, totalMinutes - clampedPrimary));

  const napStart = config.napTime;
  const napEnd = addMinutes(config.napTime, config.napMinutes);

  const slots: StudySlot[] = [];
  // 主目标先排（上午黄金时段），次目标随后
  for (const goal of [s.primaryGoalName, s.secondaryGoalName] as const) {
    const isPrimary = goal === s.primaryGoalName;
    const minutes = isPrimary ? clampedPrimary : clampedSecondary;
    if (minutes <= 0) continue;
    const base = slots.length === 0 ? config.studyStart : slots[slots.length - 1].end;
    const label = isPrimary ? "主目标学习" : "次目标学习";
    for (const seg of studySegments(base, minutes, napStart, napEnd)) {
      slots.push({ label, goalName: goal, ...seg });
    }
  }
  return slots;
}

function timeToMinutes(time: string): number {
  const [h, m] = time.split(":").map(Number);
  return h * 60 + m;
}

/** "HH:MM" + minutes → "HH:MM" */
export function addMinutes(time: string, minutes: number): string {
  const [h, m] = time.split(":").map(Number);
  const total = h * 60 + m + minutes;
  const nh = ((Math.floor(total / 60) % 24) + 24) % 24;
  const nm = total % 60;
  return `${String(nh).padStart(2, "0")}:${String(nm).padStart(2, "0")}`;
}

/** 分钟数 → "Xh Ym" 展示 */
export function formatMinutes(minutes: number): string {
  if (minutes < 60) return `${minutes} 分钟`;
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return m > 0 ? `${h} 小时 ${m} 分` : `${h} 小时`;
}

/** 蓝图导出的全天时间槽总览（用于配置页预览与排程联动） */
export interface IdealDayPreview {
  sleepNight: string;   // 22:30 - 06:00
  nap: string;          // 12:30 - 13:00
  wakeRoutine: string;  // 06:00 - 07:00 洗漱早餐
  workout: string;      // 07:00 - 08:00 健身
  studySlots: StudySlot[];
  waterTargetMl: number;
  leisureMinutes: number;
}

export function buildIdealDayPreview(config: IdealDayConfig): IdealDayPreview {
  return {
    sleepNight: `${config.sleepBedTime} - ${config.sleepWakeTime}`,
    nap: `${config.napTime} - ${addMinutes(config.napTime, config.napMinutes)}`,
    wakeRoutine: `${config.sleepWakeTime} - ${config.wakeRoutineEnd} 洗漱早餐`,
    workout: `${config.workoutStart} - ${config.workoutEnd} 健身`,
    studySlots: buildStudySlots(config),
    waterTargetMl: config.waterTargetMl,
    leisureMinutes: config.leisureQuotaMinutes,
  };
}

// ============================================================
// T19-2 蓝图 → 自动排程
// 作息走模板链（复用 generateRoutineItems）；学习/训练/留白生成 sourceType='ideal' 专用事项
// ============================================================

function todayStr(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function addDays(dateStr: string, days: number): string {
  const d = new Date(dateStr + "T00:00:00");
  d.setDate(d.getDate() + days);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

/** 将蓝图作息写回启用中的作息模板（wake/nap/sleep），并刷新今日起未完成事项（已完成的保留，不丢数据） */
export async function syncIdealDayRoutines(config: IdealDayConfig): Promise<void> {
  const { getRoutines, updateRoutine, addRoutine, getRoutineGroups, generateRoutineItems, daylogDB } = await import("@/lib/db/daylog.db");
  const routines = await getRoutines();
  const groups = await getRoutineGroups();

  const targets: { type: "wake" | "nap" | "sleep"; start: string; end: string }[] = [
    { type: "wake", start: config.sleepWakeTime, end: config.wakeRoutineEnd },
    { type: "nap", start: config.napTime, end: addMinutes(config.napTime, config.napMinutes) },
    { type: "sleep", start: config.sleepBedTime, end: addMinutes(config.sleepBedTime, 30) },
  ];

  const syncedIds: string[] = [];
  for (const t of targets) {
    const existing = routines.filter((r) => r.type === t.type && r.isActive);
    if (existing.length > 0) {
      for (const r of existing) {
        if (r.startTime !== t.start || r.endTime !== t.end) {
          await updateRoutine(r.id, { startTime: t.start, endTime: t.end });
        }
        syncedIds.push(r.id);
      }
    } else if (groups.length > 0) {
      // 无启用模板时在第一个模板组创建，避免作息事项完全缺失
      const group = groups[0];
      const id = await addRoutine({
        type: t.type,
        templateId: group.id,
        name: t.type === "wake" ? "起床" : t.type === "nap" ? "午睡" : "入睡",
        startTime: t.start,
        endTime: t.end,
        color: t.type === "wake" ? "#FF9500" : t.type === "nap" ? "#5856D6" : "#1E293B",
        icon: t.type === "wake" ? "Sunrise" : t.type === "nap" ? "CloudSun" : "Moon",
        isActive: true,
        sortOrder: 0,
      });
      syncedIds.push(id);
    }
  }

  // 刷新：删除今日起未完成的作息事项后重新生成（保留已完成记录）
  if (syncedIds.length > 0) {
    const today = todayStr();
    const stale = await daylogDB.items
      .filter((item) => item.sourceType === "routine" && syncedIds.includes(item.sourceId) && item.date >= today && !item.isCompleted)
      .toArray();
    if (stale.length > 0) await daylogDB.items.bulkDelete(stale.map((i) => i.id));
  }
  for (let i = 0; i < 7; i++) {
    await generateRoutineItems(addDays(todayStr(), i));
  }
}

/** 判断某日期是否为训练日（与训练计划生成器 weeklyDays 对齐；无计划时回退周一/三/五） */
export async function isTrainingDay(dateStr: string): Promise<boolean> {
  const dow = new Date(dateStr + "T00:00:00").getDay();
  try {
    const { getActiveTrainingPlans } = await import("@/lib/training-plan-generator");
    const plans = await getActiveTrainingPlans();
    if (plans.length > 0) return plans.some((p) => p.weeklyDays?.includes(dow));
  } catch { /* 训练模块异常时走默认 */ }
  return [1, 3, 5].includes(dow);
}

/** 生成某日的理想日蓝图事项（幂等：作息走模板链；学习/训练/留白按 sourceId 去重） */
export async function generateIdealDayItems(dateStr: string): Promise<void> {
  const config = await getIdealDayConfig();
  if (!config.enabled) return;

  const { ensureModuleItem } = await import("@/lib/db/daylog.db");
  const { ensureTemplates, selectTemplate, getIdealDayPlans, getFeatureMeta } = await import("@/lib/ideal-day-templates");

  // T22：按激活模板的 8+8+8 时间段块生成（一对多功能）
  const { templates, config: cfg } = ensureTemplates(config);
  const template = selectTemplate(cfg, dateStr);
  const plans = await getIdealDayPlans(dateStr);

  // 1) 模板块级事项（sourceId 含模板+块 id，稳定去重）
  for (const b of template.blocks) {
    const planOfBlock = plans.filter((p) => p.blockId === b.id);
    const planTitles = planOfBlock.filter((p) => !p.isCompleted).map((p) => p.content).filter(Boolean);
    const icon = b.features.length > 0 ? getFeatureMeta(b.features[0]).icon : 'CalendarDays';
    await ensureModuleItem({
      date: dateStr,
      sourceType: "ideal",
      sourceId: `ideal-block-${template.id}-${b.id}`,
      title: planTitles.length > 0 ? `${b.label} · ${planTitles.join(" / ")}` : b.label,
      plannedStart: b.start,
      plannedEnd: b.end,
      color: "#6366F1",
      icon,
      isCompleted: false,
    });
  }

  // 2) 规划层具体事项（L3 执行层：日程页自动显示安排好的具体内容）
  for (const p of plans) {
    await ensureModuleItem({
      date: dateStr,
      sourceType: "ideal",
      sourceId: `ideal-plan-${p.blockId}-${p.feature}`,
      title: p.content || getFeatureMeta(p.feature).label,
      plannedStart: p.start,
      plannedEnd: p.end,
      color: getFeatureMeta(p.feature).color,
      icon: getFeatureMeta(p.feature).icon,
      isCompleted: p.isCompleted,
    });
  }
}

/** 删除今日之后的 ideal 专用事项（蓝图关闭或重排时清理，不含历史） */
export async function clearFutureIdealItems(): Promise<void> {
  const { daylogDB } = await import("@/lib/db/daylog.db");
  const today = todayStr();
  await daylogDB.items.where("sourceType").equals("ideal").filter((i) => i.date > today).delete();
}

/** 应用蓝图：同步作息模板 + 重排今日起 7 天；关闭时仅清理未来 ideal 事项 */
export async function applyIdealDayBlueprint(): Promise<void> {
  const config = await getIdealDayConfig();
  if (!config.enabled) {
    await clearFutureIdealItems();
    return;
  }
  await syncIdealDayRoutines(config);
  await clearFutureIdealItems();
  const today = todayStr();
  for (let i = 0; i < 7; i++) {
    await generateIdealDayItems(addDays(today, i));
  }
}
