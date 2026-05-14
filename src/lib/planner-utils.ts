import { db } from "./db";
import type { CalendarEvent } from "./types";

export const HOUR_HEIGHT = 128;
export const HOUR_COUNT = 24;
export const TOTAL_HEIGHT = HOUR_COUNT * HOUR_HEIGHT;

export function pixelToMinutes(offsetY: number): number {
  const clampedY = Math.max(0, Math.min(TOTAL_HEIGHT, offsetY));
  const minutes = (clampedY / TOTAL_HEIGHT) * 1440;
  return Math.max(0, Math.min(1439, Math.round(minutes / 15) * 15));
}

export function minutesToPixel(minutes: number): number {
  return (minutes / 1440) * TOTAL_HEIGHT;
}

export function getEventPosition(
  startTime: number,
  endTime: number,
  dayStart: number
) {
  const startMs = startTime - dayStart;
  const endMs = endTime - dayStart;
  const top = (startMs / (1000 * 60 * 60)) * HOUR_HEIGHT;
  const height = Math.max(
    ((endMs - startMs) / (1000 * 60 * 60)) * HOUR_HEIGHT,
    24
  );
  return { top, height };
}

export function formatTime(ts: number) {
  const d = new Date(ts);
  return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
}

export function getCurrentTimePosition() {
  const now = new Date();
  const hours = now.getHours();
  const minutes = now.getMinutes();
  return (hours + minutes / 60) * HOUR_HEIGHT;
}

export function getStartMinutes(startTime: number, dayStart: number): number {
  return Math.round((startTime - dayStart) / 60000);
}

export async function detectConflicts(
  newStart: number,
  newEnd: number,
  excludeEventId?: number
): Promise<CalendarEvent[]> {
  const dayStart = new Date(newStart);
  dayStart.setHours(0, 0, 0, 0);
  const dayEnd = new Date(newStart);
  dayEnd.setHours(23, 59, 59, 999);

  const dayEvents = await db.events
    .where("startTime")
    .between(dayStart.getTime(), dayEnd.getTime())
    .toArray();

  return dayEvents.filter((e) => {
    if (excludeEventId !== undefined && e.id === excludeEventId) return false;
    return newStart < e.endTime && newEnd > e.startTime;
  });
}

const TAG_COLORS = [
  "bg-primary-100 text-primary-700",
  "bg-secondary-100 text-secondary-700",
  "bg-success-100 text-success-600",
  "bg-warning-100 text-warning-600",
  "bg-danger-100 text-danger-600",
  "bg-indigo-100 text-indigo-700",
  "bg-violet-100 text-violet-700",
  "bg-pink-100 text-pink-700",
];

export function getTagColor(tag: string) {
  let hash = 0;
  for (let i = 0; i < tag.length; i++) {
    hash = tag.charCodeAt(i) + ((hash << 5) - hash);
  }
  return TAG_COLORS[Math.abs(hash) % TAG_COLORS.length];
}

export function getTodayRange() {
  const now = new Date();
  const start = new Date(
    now.getFullYear(),
    now.getMonth(),
    now.getDate(),
    0,
    0,
    0,
    0
  ).getTime();
  const end = new Date(
    now.getFullYear(),
    now.getMonth(),
    now.getDate(),
    23,
    59,
    59,
    999
  ).getTime();
  return { start, end };
}
