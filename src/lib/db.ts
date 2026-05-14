import Dexie, { type Table } from "dexie";
import type {
  CaptureItem,
  CalendarEvent,
  FocusLog,
  Project,
  AgentMemory,
  AgentChatSession,
} from "./types";

export class LifeFlowDB extends Dexie {
  capture!: Table<CaptureItem, number>;
  events!: Table<CalendarEvent, number>;
  focusLogs!: Table<FocusLog, number>;
  projects!: Table<Project, string>;
  agentMemory!: Table<AgentMemory, number>;
  agentChats!: Table<AgentChatSession, string>;

  constructor() {
    super("LifeFlowDB");

    this.version(1).stores({
      capture: "++id, status, createdAt",
      events: "++id, startTime, endTime, planned, projectId, captureSourceId, createdAt",
      focusLogs: "++id, eventId, startTime, createdAt",
      projects: "id, name",
      agentMemory: "++id, dateKey",
      agentChats: "id, updatedAt",
    });

    this.version(2).stores({
      events: "++id, startTime, endTime, planned, projectId, captureSourceId, createdAt, *tags",
    }).upgrade((tx) => {
      return tx.table("events").toCollection().modify((event) => {
        if (!event.tags) event.tags = [];
      });
    });
  }
}

export const db = new LifeFlowDB();

export async function executeTransaction<T>(
  stores: (Table | string)[],
  operation: () => Promise<T>,
  options: { maxRetries?: number; onRetry?: (attempt: number) => void } = {}
): Promise<T> {
  const { maxRetries = 3 } = options;
  let lastError: Error | null = null;

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      return await db.transaction("rw", stores, operation);
    } catch (err) {
      lastError = err as Error;

      if (
        (err as Error).name === "QuotaExceededError" ||
        (err as Error).name === "VersionError" ||
        (err as Error).name === "AbortError"
      ) {
        throw err;
      }

      if (attempt < maxRetries) {
        const delay = 100 * Math.pow(2, attempt - 1);
        options.onRetry?.(attempt);
        await new Promise((r) => setTimeout(r, delay));
      }
    }
  }

  throw lastError ?? new Error("TRANSACTION_FAILED");
}

// Capture CRUD
export async function addCapture(content: string, tags: string[] = []): Promise<number> {
  const now = Date.now();
  return db.capture.add({
    content,
    status: "inbox",
    tags,
    createdAt: now,
    updatedAt: now,
  });
}

export async function getInboxItems(
  limit = 200,
  beforeCreatedAt?: number
): Promise<CaptureItem[]> {
  let items: CaptureItem[];
  if (beforeCreatedAt) {
    items = await db.capture
      .where("status")
      .equals("inbox")
      .and((item) => item.createdAt < beforeCreatedAt)
      .reverse()
      .sortBy("createdAt");
  } else {
    items = await db.capture
      .where("status")
      .equals("inbox")
      .reverse()
      .sortBy("createdAt");
  }
  return items.slice(0, limit);
}

export async function getPaginatedInboxItems(
  pageSize: number,
  beforeCreatedAt?: number
): Promise<{ items: CaptureItem[]; hasMore: boolean }> {
  const all = await getInboxItems(200, beforeCreatedAt);
  const items = all.slice(0, pageSize);
  return {
    items,
    hasMore: all.length > pageSize,
  };
}

export async function getInboxCount(): Promise<number> {
  return db.capture.where("status").equals("inbox").count();
}

export async function updateCaptureStatus(
  id: number,
  status: CaptureItem["status"]
): Promise<void> {
  const updated = await db.capture.update(id, { status });
  if (updated === 0) throw new Error(`Capture item ${id} not found`);
}

export async function deleteCapture(id: number): Promise<void> {
  await db.capture.update(id, { status: "trash" });
}

export async function restoreCapture(id: number): Promise<void> {
  await db.capture.update(id, { status: "inbox" });
}

export async function purgeCapture(id: number): Promise<void> {
  await db.capture.delete(id);
}

export async function getTrashCaptures(): Promise<CaptureItem[]> {
  return db.capture.where("status").equals("trash").reverse().sortBy("createdAt");
}

export async function getTrashCaptureCount(): Promise<number> {
  return db.capture.where("status").equals("trash").count();
}

// Events CRUD
export async function createEvent(
  eventData: Omit<CalendarEvent, "id" | "createdAt" | "updatedAt">
): Promise<number> {
  const id = await db.events.add({
    ...eventData,
    createdAt: Date.now(),
    updatedAt: Date.now(),
  });
  return id;
}

export async function getEventsByTimeRange(
  start: number,
  end: number,
  limit = 500
): Promise<CalendarEvent[]> {
  const items = await db.events.where("startTime").between(start, end).toArray();
  return items.filter((e) => !e.deleted).slice(0, limit);
}

export async function updateEvent(
  id: number,
  updates: Partial<Omit<CalendarEvent, "id" | "createdAt">>
): Promise<void> {
  await db.events.update(id, { ...updates, updatedAt: Date.now() });
}

export async function deleteEvent(id: number): Promise<void> {
  await db.events.update(id, { deleted: true, deletedAt: Date.now(), updatedAt: Date.now() });
}

export async function restoreEvent(id: number): Promise<void> {
  await db.events.update(id, { deleted: false, updatedAt: Date.now() });
}

export async function purgeEvent(id: number): Promise<void> {
  await db.events.delete(id);
}

export async function getTrashEvents(): Promise<CalendarEvent[]> {
  return db.events.filter((e) => e.deleted === true).reverse().sortBy("createdAt");
}

export async function getTrashEventCount(): Promise<number> {
  return db.events.filter((e) => e.deleted === true).count();
}

// Focus Logs CRUD
export async function createFocusLog(eventId?: number): Promise<number> {
  const now = Date.now();
  return db.focusLogs.add({
    eventId: eventId ?? 0,
    startTime: now,
    duration: 0,
    interruptions: 0,
    completed: false,
    createdAt: now,
  });
}

export async function updateFocusLog(
  logId: number,
  updates: Partial<Pick<FocusLog, "duration" | "interruptions" | "completed" | "quality" | "eventId">>
): Promise<void> {
  await db.focusLogs.update(logId, updates as Record<string, unknown>);
}

export async function completeFocusLog(
  logId: number,
  duration: number,
  interruptions: number
): Promise<void> {
  await db.focusLogs.update(logId, { duration, interruptions, completed: true });
}

export async function getFocusLogsByTimeRange(
  start: number,
  end: number,
  limit = 500
): Promise<FocusLog[]> {
  const items = await db.focusLogs.where("startTime").between(start, end).toArray();
  return items.slice(0, limit);
}

// Projects CRUD
export async function createProject(name: string, color: string): Promise<string> {
  const id = crypto.randomUUID();
  await db.projects.add({ id, name, color });
  return id;
}

export async function getAllProjects(): Promise<Project[]> {
  return db.projects.toArray();
}

export async function getProject(id: string): Promise<Project | undefined> {
  return db.projects.get(id);
}

export async function updateProject(
  id: string,
  updates: Partial<Pick<Project, "name" | "color">>
): Promise<void> {
  await db.projects.update(id, { ...updates });
}

export async function deleteProject(id: string): Promise<void> {
  await db.transaction("rw", [db.projects, db.events], async () => {
    const events = await db.events.where("projectId").equals(id).toArray();
    for (const event of events) {
      await db.events.update(event.id!, { projectId: undefined, updatedAt: Date.now() });
    }
    await db.projects.delete(id);
  });
}

export async function getProjectEventCount(id: string): Promise<number> {
  return db.events.where("projectId").equals(id).and((e) => !e.deleted).count();
}

// Transactions
export async function convertCaptureToEvent(
  captureId: number,
  eventData: Omit<CalendarEvent, "id" | "captureSourceId">
): Promise<number> {
  return db.transaction("rw", [db.capture, db.events], async () => {
    const capture = await db.capture.get(captureId);
    if (!capture) throw new Error(`Capture ${captureId} not found`);
    if (capture.status !== "inbox") {
      throw new Error(`Capture ${captureId} is not in inbox status`);
    }

    const now = Date.now();
    const eventId = await db.events.add({
      ...eventData,
      captureSourceId: captureId,
      createdAt: now,
      updatedAt: now,
    });

    await db.capture.update(captureId, { status: "planned" });
    return eventId;
  });
}

export async function completeFocusSession(
  focusLogId: number,
  finalDuration: number,
  interruptions: number
): Promise<void> {
  return db.transaction("rw", [db.focusLogs, db.events], async () => {
    const focusLog = await db.focusLogs.get(focusLogId);
    if (!focusLog) throw new Error(`FocusLog ${focusLogId} not found`);

    await db.focusLogs.update(focusLogId, {
      duration: finalDuration,
      interruptions,
      completed: true,
    });

    const event = await db.events.get(focusLog.eventId);
    if (event) {
      const existingSessions = event.focusSessions ?? [];
      await db.events.update(event.id!, {
        focusSessions: [...existingSessions, focusLogId],
        updatedAt: Date.now(),
      });
    }
  });
}

export async function applySuggestedPlan(
  suggestions: Array<{
    captureId: number;
    title: string;
    startTime: number;
    endTime: number;
    tags: string[];
  }>
): Promise<number[]> {
  return db.transaction("rw", [db.capture, db.events], async () => {
    const eventIds: number[] = [];
    const now = Date.now();

    for (const sugg of suggestions) {
      const capture = await db.capture.get(sugg.captureId);
      if (!capture || capture.status !== "inbox") continue;

      const eventId = await db.events.add({
        title: sugg.title,
        startTime: sugg.startTime,
        endTime: sugg.endTime,
        planned: true,
        tags: sugg.tags,
        captureSourceId: sugg.captureId,
        createdAt: now,
        updatedAt: now,
        focusSessions: [],
      });
      eventIds.push(eventId);

      await db.capture.update(sugg.captureId, { status: "planned" });
    }

    return eventIds;
  });
}

// Storage check
export async function checkStorageSpace(): Promise<{
  used: number;
  total: number;
  percentUsed: number;
  remaining: number;
  isWarning: boolean;
  isCritical: boolean;
} | null> {
  if ("storage" in navigator && "estimate" in navigator.storage) {
    const estimate = await navigator.storage.estimate();
    const used = estimate.usage || 0;
    const total = estimate.quota || 0;
    const percentUsed = total > 0 ? (used / total) * 100 : 0;

    return {
      used,
      total,
      percentUsed,
      remaining: total - used,
      isWarning: percentUsed > 80,
      isCritical: percentUsed > 95,
    };
  }
  return null;
}

export interface ExportData {
  version: number;
  exportedAt: string;
  data: {
    capture: CaptureItem[];
    events: CalendarEvent[];
    focusLogs: FocusLog[];
    projects: Project[];
    agentMemory: AgentMemory[];
    agentChats: AgentChatSession[];
  };
}

export async function exportAllData(): Promise<ExportData> {
  const [capture, events, focusLogs, projects, agentMemory, agentChats] =
    await Promise.all([
      db.capture.toArray(),
      db.events.toArray(),
      db.focusLogs.toArray(),
      db.projects.toArray(),
      db.agentMemory.toArray(),
      db.agentChats.toArray(),
    ]);

  return {
    version: 1,
    exportedAt: new Date().toISOString(),
    data: { capture, events, focusLogs, projects, agentMemory, agentChats },
  };
}

export async function importAllData(
  importData: ExportData
): Promise<{ imported: Record<string, number> }> {
  const { data } = importData;
  const imported: Record<string, number> = {};

  await db.transaction("rw", [
    db.capture,
    db.events,
    db.focusLogs,
    db.projects,
    db.agentMemory,
    db.agentChats,
  ], async () => {
    await Promise.all([
      db.capture.clear(),
      db.events.clear(),
      db.focusLogs.clear(),
      db.projects.clear(),
      db.agentMemory.clear(),
      db.agentChats.clear(),
    ]);

    const results = await Promise.all([
      db.capture.bulkAdd(data.capture || []),
      db.events.bulkAdd(data.events || []),
      db.focusLogs.bulkAdd(data.focusLogs || []),
      db.projects.bulkAdd(data.projects || []),
      db.agentMemory.bulkAdd(data.agentMemory || []),
      db.agentChats.bulkAdd(data.agentChats || []),
    ]);

    imported.capture = data.capture?.length || 0;
    imported.events = data.events?.length || 0;
    imported.focusLogs = data.focusLogs?.length || 0;
    imported.projects = data.projects?.length || 0;
    imported.agentMemory = data.agentMemory?.length || 0;
    imported.agentChats = data.agentChats?.length || 0;

    return results;
  });

  return { imported };
}
