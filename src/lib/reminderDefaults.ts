// ============================================================
// 事项提醒默认配置 & Item ↔ Reminder 联动
// ============================================================

import { db } from "@/lib/db";
import type { SourceType } from "@/lib/db/daylog.db";
import type { Item } from "@/lib/db/daylog.db";
import type { Reminder } from "@/lib/types";

const STORAGE_KEY = "lifeflow_reminder_defaults";

/** 每种 sourceType 的默认提醒配置 */
export interface DefaultReminderConfig {
  enabled: boolean;
  minutes: number;
}

export type ReminderDefaultsMap = Partial<Record<SourceType, DefaultReminderConfig>>;

/** 默认值 */
const DEFAULTS: ReminderDefaultsMap = {
  routine:  { enabled: true,  minutes: 5  },
  course:   { enabled: true,  minutes: 15 },
  water:    { enabled: true,  minutes: 0  },
  manual:   { enabled: false, minutes: 0  },
  habit:    { enabled: false, minutes: 0  },
  task:     { enabled: true,  minutes: 5  },
};

/** 获取所有默认配置 */
export function getReminderDefaults(): ReminderDefaultsMap {
  if (typeof window === "undefined") return DEFAULTS;
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) return { ...DEFAULTS, ...JSON.parse(raw) };
  } catch { /* ignore */ }
  return { ...DEFAULTS };
}

/** 保存默认配置 */
export function setReminderDefaults(map: ReminderDefaultsMap): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(map));
}

/** 获取某 sourceType 的默认配置 */
export function getDefaultForType(type: SourceType): DefaultReminderConfig {
  return getReminderDefaults()[type] ?? { enabled: false, minutes: 0 };
}

// ─── 时间戳工具 ──────────────────────────────────────────────

function timeToTimestamp(dateStr: string, timeStr: string): number {
  const [h, m] = timeStr.split(":").map(Number);
  const d = new Date(dateStr + "T00:00:00");
  d.setHours(h, m, 0, 0);
  return d.getTime();
}

// ─── Item ↔ Reminder 联动 ───────────────────────────────────

/** 为事项创建/更新 Reminder（写入 LifeFlowDB.reminders 表） */
export async function syncItemReminder(item: Item): Promise<void> {
  // 先查找已有 Reminder（moduleType='item', linkedModuleId=item.id）
  const existing = await db.reminders
    .where("moduleType")
    .equals("item")
    .filter((r) => r.linkedModuleId === item.id)
    .first();

  // 判断是否开启提醒：优先用 item 上的显式设置，回退到默认配置
  const defaults = getDefaultForType(item.sourceType);
  const enabled = item.reminderEnabled ?? defaults.enabled;

  // 未开启 → 删除已有 Reminder
  if (!enabled) {
    if (existing) {
      await db.reminders.delete(existing.id!);
    }
    return;
  }

  const minutes = item.reminderMinutes ?? defaults.minutes;
  const triggerTime = timeToTimestamp(item.date, item.plannedStart) - minutes * 60 * 1000;

  const reminderData: Omit<Reminder, "id" | "createdAt"> = {
    taskId: 0,  // Item 的 taskId 是 uuid，与 Reminder 的 auto-increment taskId 不兼容，填 0
    type: "event",
    triggerTime,
    message: item.title,
    status: "pending",
    moduleType: "item",
    linkedModuleId: item.id,
    updatedAt: Date.now(),
  };

  if (existing) {
    await db.reminders.update(existing.id!, { ...reminderData, updatedAt: Date.now() });
  } else {
    await db.reminders.add({
      ...reminderData,
      createdAt: Date.now(),
    });
  }
}

/** 删除事项关联的 Reminder */
export async function removeItemReminder(itemId: string): Promise<void> {
  const existing = await db.reminders
    .where("moduleType")
    .equals("item")
    .filter((r) => r.linkedModuleId === itemId)
    .first();
  if (existing) {
    await db.reminders.delete(existing.id!);
  }
}

/** 事项完成后自动标记 Reminder 完成 */
export async function completeItemReminders(itemId: string): Promise<void> {
  const existing = await db.reminders
    .where("moduleType")
    .equals("item")
    .filter((r) => r.linkedModuleId === itemId)
    .first();
  if (existing && existing.status === "pending") {
    await db.reminders.update(existing.id!, { status: "completed", updatedAt: Date.now() });
  }
}
