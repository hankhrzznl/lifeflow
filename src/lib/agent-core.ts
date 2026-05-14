import type { CalendarEvent, CaptureItem } from "./types";
import { getInboxItems, getEventsByTimeRange, getFocusLogsByTimeRange } from "./db";
import type { SuggestionCardData } from "./agent-state";

const TIME_PATTERNS = [
  /(?:今天|明天|后天)\s*(上午|下午|晚上|早上|中午)?\s*(\d{1,2})[:：点](\d{0,2})?(?:分)?\s*(?:到|-|至)\s*(上午|下午|晚上|早上|中午)?\s*(\d{1,2})[:：点](\d{0,2})?(?:分)?/,
  /(?:今天|明天|后天)\s*(\d{1,2})[:：点](?:半)?\s*(?:到|-|至)\s*(\d{1,2})[:：点](?:半)?/,
  /(上午|下午|晚上|早上|中午)\s*(\d{1,2})[:：点]\s*(?:到|-|至)\s*(上午|下午|晚上|早上|中午)?\s*(\d{1,2})[:：点]/,
  /(\d{1,2})[:：点]\s*(?:到|-|至)\s*(\d{1,2})[:：点]/,
];

const DATE_WORDS: Record<string, number> = {
  "今天": 0,
  "明天": 1,
  "后天": 2,
};

function getDateBase(dateWord?: string): Date {
  const now = new Date();
  if (dateWord && DATE_WORDS[dateWord] !== undefined) {
    now.setDate(now.getDate() + DATE_WORDS[dateWord]);
  }
  return now;
}

function hourTo24(hour: number, period?: string): number {
  if (!period) return hour;
  if (period === "上午" || period === "早上") {
    return hour === 12 ? 0 : hour;
  }
  if (period === "下午" || period === "晚上") {
    return hour === 12 ? 12 : hour + 12;
  }
  if (period === "中午") {
    return hour < 3 ? hour + 12 : hour;
  }
  return hour;
}

function toTimestamp(date: Date, hour: number, minute: number): number {
  const d = new Date(date);
  d.setHours(hour, minute, 0, 0);
  return d.getTime();
}

export function localParseCapture(rawText: string): {
  title: string;
  startTime: number | null;
  endTime: number | null;
  tags: string[];
  confidence: number;
} {
  let dateWord: string | undefined;
  for (const word of Object.keys(DATE_WORDS)) {
    if (rawText.includes(word)) {
      dateWord = word;
      break;
    }
  }

  let match: RegExpMatchArray | null = null;

  for (const pattern of TIME_PATTERNS) {
    match = rawText.match(pattern);
    if (match) break;
  }

  let title = rawText.trim();
  let startTime: number | null = null;
  let endTime: number | null = null;
  let confidence = 0.4;

  if (match) {
    const dateBase = getDateBase(dateWord);

    if (match.length === 7) {
      const p1 = match[1] || match[4];
      const h1 = parseInt(match[2]);
      const m1 = parseInt(match[3] || "0");
      const p2 = match[4];
      const h2 = parseInt(match[5]);
      const m2 = parseInt(match[6] || "0");

      startTime = toTimestamp(dateBase, hourTo24(h1, p1), m1);
      endTime = toTimestamp(dateBase, hourTo24(h2, p2 || p1), m2);
      title = rawText.replace(match[0], "").trim();
      confidence = 0.7;
    } else if (match.length === 5) {
      const h1 = parseInt(match[1]);
      const h2 = parseInt(match[2]);
      startTime = toTimestamp(dateBase, hourTo24(h1), 0);
      endTime = toTimestamp(dateBase, hourTo24(h2), 0);
      title = rawText.replace(match[0], "").trim();
      confidence = 0.65;
    } else if (match.length === 3) {
      const h1 = parseInt(match[1]);
      const h2 = parseInt(match[2]);
      startTime = toTimestamp(dateBase, hourTo24(h1), 0);
      endTime = toTimestamp(dateBase, hourTo24(h2), 0);
      title = rawText.replace(match[0], "").trim();
      confidence = 0.6;
    }
  }

  title = title.replace(/^\s*(到|-|至)\s*/g, "").replace(/[,，。.!！?？\s]+$/, "");

  if (!title) {
    title = rawText;
    confidence = 0.2;
  }

  const tags: string[] = [];
  const tagPattern = /#(\S+)/g;
  let tagMatch;
  while ((tagMatch = tagPattern.exec(rawText)) !== null) {
    tags.push(tagMatch[1]);
  }

  return { title, startTime, endTime, tags, confidence };
}

export async function localSuggestPlan(): Promise<{
  suggestions: SuggestionCardData[];
  message: string;
}> {
  const todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0);
  const todayEnd = new Date();
  todayEnd.setHours(23, 59, 59, 999);

  const [inboxItems, events] = await Promise.all([
    getInboxItems(),
    getEventsByTimeRange(todayStart.getTime(), todayEnd.getTime()),
  ]);

  if (inboxItems.length === 0) {
    return { suggestions: [], message: "收件箱里没有待规划的事项。先去捕捉一些想法吧！" };
  }

  const occupiedRanges = events
    .filter((e) => e.planned)
    .map((e) => ({ start: e.startTime, end: e.endTime }))
    .sort((a, b) => a.start - b.start);

  const now = new Date();
  const workStart = new Date(now);
  workStart.setHours(8, 0, 0, 0);
  const workEnd = new Date(now);
  workEnd.setHours(22, 0, 0, 0);

  const freeSlots: Array<{ start: number; end: number }> = [];
  let cursor = Math.max(now.getTime(), workStart.getTime());

  for (const range of occupiedRanges) {
    if (range.start > cursor) {
      freeSlots.push({ start: cursor, end: range.start });
    }
    cursor = Math.max(cursor, range.end);
  }

  if (cursor < workEnd.getTime()) {
    freeSlots.push({ start: cursor, end: workEnd.getTime() });
  }

  const availableSlots = freeSlots.filter(
    (s) => s.end - s.start >= 15 * 60 * 1000
  );

  const suggestions: SuggestionCardData[] = [];
  let slotIndex = 0;

  for (const item of inboxItems) {
    if (slotIndex >= availableSlots.length) break;

    const duration = estimateDuration(item.content);
    const required = duration * 60 * 1000;

    let bestSlot: typeof availableSlots[0] | null = null;
    for (let i = slotIndex; i < availableSlots.length; i++) {
      if (availableSlots[i].end - availableSlots[i].start >= required) {
        bestSlot = availableSlots[i];
        slotIndex = i;
        break;
      }
    }

    if (!bestSlot) break;

    suggestions.push({
      id: `sugg-${Date.now()}-${item.id}`,
      captureId: item.id,
      title: item.content.slice(0, 50),
      proposedStartTime: bestSlot.start,
      proposedEndTime: bestSlot.start + required,
      tags: item.tags,
      confidence: 0.6,
    });

    bestSlot.start += required;
    if (bestSlot.end - bestSlot.start < 15 * 60 * 1000) {
      slotIndex++;
    }
  }

  if (suggestions.length === 0) {
    return {
      suggestions: [],
      message: "今天的时间已经排满了，没有空闲时段来安排新的任务。",
    };
  }

  return {
    suggestions,
    message: `找到了 ${suggestions.length} 个可安排的任务，共 ${availableSlots.length} 个空闲时段。`,
  };
}

function estimateDuration(content: string): number {
  const len = content.length;
  if (len <= 10) return 25;
  if (len <= 30) return 45;
  if (len <= 80) return 60;
  return 90;
}

export async function localGetTodayStats(): Promise<{
  totalFocusDuration: number;
  sessionCount: number;
  completedSessions: number;
  totalInterruptions: number;
  hourlyDistribution: number[];
  message: string;
}> {
  const todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0);
  const todayEnd = new Date();
  todayEnd.setHours(23, 59, 59, 999);

  const logs = await getFocusLogsByTimeRange(todayStart.getTime(), todayEnd.getTime());

  const totalFocusDuration = logs.reduce((sum, log) => sum + log.duration, 0);
  const sessionCount = logs.length;
  const completedSessions = logs.filter((l) => l.completed).length;
  const totalInterruptions = logs.reduce((sum, log) => sum + log.interruptions, 0);
  const hourlyDistribution = Array(24).fill(0);

  for (const log of logs) {
    const hour = new Date(log.startTime).getHours();
    hourlyDistribution[hour] += log.duration;
  }

  const hours = Math.floor(totalFocusDuration / 60);
  const minutes = totalFocusDuration % 60;
  let message = "";

  if (totalFocusDuration === 0) {
    message = "今天还没有专注记录。去专注页面开始一个番茄钟吧！";
  } else if (completedSessions >= 3) {
    message = `今天状态不错！你专注了${hours}小时${minutes}分钟，完成了${completedSessions}次专注时段`;
    if (totalInterruptions > 0) {
      message += `，有${totalInterruptions}次中断`;
    }
    message += "。继续加油！";
  } else {
    message = `你今天专注了${hours}小时${minutes}分钟，完成了${completedSessions}/${sessionCount}次专注`;
    if (totalInterruptions > 0) {
      message += `，被中断了${totalInterruptions}次`;
    }
    message += "。还可以再专注一会哦！";
  }

  return {
    totalFocusDuration,
    sessionCount,
    completedSessions,
    totalInterruptions,
    hourlyDistribution,
    message,
  };
}

export function sanitizeEventsForLLM(events: CalendarEvent[]): Array<{
  start: number;
  end: number;
  occupied: boolean;
}> {
  return events
    .filter((e) => e.planned)
    .map((e) => ({
      start: e.startTime,
      end: e.endTime,
      occupied: true,
    }));
}

export function sanitizeInboxForLLM(inboxItems: CaptureItem[]): {
  totalCount: number;
  items: Array<{
    id: number;
    wordCount: number;
    estimatedDurationMinutes: number;
  }>;
} {
  return {
    totalCount: inboxItems.length,
    items: inboxItems.map((item) => ({
      id: item.id!,
      wordCount: item.content.length,
      estimatedDurationMinutes: estimateDuration(item.content),
    })),
  };
}

const WELCOME_MESSAGE = `你好！我是 LifeFlow 助手 🌟

我可以帮你：
• **解析日程** — 输入"明天下午3点到5点写提案"，我会帮你整理好
• **规划今天** — 说"帮我规划今天"，我会根据空闲时段安排任务
• **查看进度** — 问我"今天专注了多久"

所有数据都在本地处理，不会上传到云端。试试看吧！`;

export function getWelcomeMessage(): string {
  return WELCOME_MESSAGE;
}
