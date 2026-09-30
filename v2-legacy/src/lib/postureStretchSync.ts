/**
 * Posture stretch item generation — hooks into sleep recording
 * to create 睡前拉伸 / 睡醒拉伸 schedule items automatically.
 */

import { addItem } from "@/lib/db/daylog.db";
import { getPostureSettings } from "@/lib/db/health.db";
import { getWakeTime } from "@/lib/db/daylog.db";
import { sendNotification } from "@/lib/notificationService";

export function localTodayStr(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function timeToMinutes(t: string): number {
  const [h, m] = t.split(":").map(Number);
  return h * 60 + m;
}

function minutesToTime(m: number): string {
  const normalized = ((m % 1440) + 1440) % 1440;
  const h = Math.floor(normalized / 60);
  const min = normalized % 60;
  return `${String(h).padStart(2, "0")}:${String(min).padStart(2, "0")}`;
}

function isNapTime(sleepTime: string): boolean {
  const mins = timeToMinutes(sleepTime);
  // Afternoon range: 12:00 (720) ~ 17:59 (1079)
  return mins >= 720 && mins <= 1079;
}

function timeToSort(time: string): number {
  const [h, m] = time.split(":").map(Number);
  return h * 60 + m;
}

/** Determine the item date. If the computed stretch time wraps past midnight, the item belongs to the next day. */
function dateForTime(baseDate: string, baseTime: string, offsetMinutes: number): { date: string; plannedStart: string } {
  const baseMins = timeToMinutes(baseTime);
  const computedMins = baseMins + offsetMinutes;

  if (computedMins >= 1440) {
    // Wraps to next day
    const nextDate = new Date(baseDate + "T00:00:00");
    nextDate.setDate(nextDate.getDate() + 1);
    const ds = `${nextDate.getFullYear()}-${String(nextDate.getMonth() + 1).padStart(2, "0")}-${String(nextDate.getDate()).padStart(2, "0")}`;
    return { date: ds, plannedStart: minutesToTime(computedMins - 1440) };
  }
  if (computedMins < 0) {
    // Wraps to previous day
    const prevDate = new Date(baseDate + "T00:00:00");
    prevDate.setDate(prevDate.getDate() - 1);
    const ds = `${prevDate.getFullYear()}-${String(prevDate.getMonth() + 1).padStart(2, "0")}-${String(prevDate.getDate()).padStart(2, "0")}`;
    return { date: ds, plannedStart: minutesToTime(computedMins + 1440) };
  }
  return { date: baseDate, plannedStart: minutesToTime(computedMins) };
}

/**
 * Generate posture stretch items when a sleep record is created.
 * Should be called after sleep log save succeeds.
 *
 * @param sleepTime  - the actual bedtime (HH:mm)
 * @param sleepDate  - the date of the sleep record (YYYY-MM-DD)
 */
export async function generatePostureStretchItems(sleepTime: string, sleepDate?: string): Promise<void> {
  try {
    const settings = await getPostureSettings();
    const date = sleepDate || localTodayStr();
    const wakeTime = await getWakeTime();

    const postureColor = "#8B5CF6"; // posture module color
    const postureIcon = "Smile";
    const sourceId = `posture-stretch-${date}`;

    // ─── Pre-sleep stretch ───
    const isNap = isNapTime(sleepTime);
    const skipPreSleep = settings.napExclude && isNap;

    if (!skipPreSleep) {
      const preSleep = dateForTime(date, sleepTime, -settings.preSleepOffset);
      await addItem({
        date: preSleep.date,
        sourceType: "manual",
        sourceId: `${sourceId}-presleep`,
        title: "睡前拉伸",
        color: postureColor,
        icon: postureIcon,
        plannedStart: preSleep.plannedStart,
        plannedEnd: minutesToTime(timeToMinutes(preSleep.plannedStart) + 10),
        actualStart: preSleep.plannedStart,
        actualEnd: minutesToTime(timeToMinutes(preSleep.plannedStart) + 10),
        isCorrected: false,
        isCompleted: false,
        sortOrder: timeToSort(preSleep.plannedStart),
      });
    }

    // ─── Post-wake stretch ───
    const postWake = dateForTime(date, wakeTime, settings.postWakeOffset);
    await addItem({
      date: postWake.date,
      sourceType: "manual",
      sourceId: `${sourceId}-postwake`,
      title: "睡醒拉伸",
      color: postureColor,
      icon: postureIcon,
      plannedStart: postWake.plannedStart,
      plannedEnd: minutesToTime(timeToMinutes(postWake.plannedStart) + 10),
      actualStart: postWake.plannedStart,
      actualEnd: minutesToTime(timeToMinutes(postWake.plannedStart) + 10),
      isCorrected: false,
      isCompleted: false,
      sortOrder: timeToSort(postWake.plannedStart),
    });

    sendNotification("🧘 睡前拉伸已添加到日程", "", "posture-stretch");
  } catch (e) {
    console.error("[PostureStretch] 生成拉伸事项失败:", e);
  }
}
