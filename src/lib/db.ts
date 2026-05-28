import Dexie, { type Table } from "dexie";
import type {
  CaptureItem,
  CalendarEvent,
  FocusLog,
  LegacyProject,
  AgentMemory,
  AgentChatSession,
  Task,
  HabitLog,
  PluginRegistry,
  ProjectV2,
  TrashItem,
  Board,
  Section,
  PluginMetadata,
  TimeSegment,
  FinRecord,
  FinAccount,
  ReviewRecord,
  Reminder,
  ReminderLog,
  HealthRecord,
} from "./types";

export class LifeFlowDB extends Dexie {
  capture!: Table<CaptureItem, number>;
  events!: Table<CalendarEvent, number>;
  focusLogs!: Table<FocusLog, number>;
  projects!: Table<LegacyProject, string>;
  agentMemory!: Table<AgentMemory, number>;
  agentChats!: Table<AgentChatSession, string>;
  tasks!: Table<Task, number>;
  habit_logs!: Table<HabitLog, number>;
  plugin_registry!: Table<PluginRegistry, string>;
  projectV2s!: Table<ProjectV2, number>;
  trashStore!: Table<TrashItem, number>;
  boards!: Table<Board, number>;
  sections!: Table<Section, number>;
  pluginsMeta!: Table<PluginMetadata, number>;
  timeSegments!: Table<TimeSegment, number>;
  finRecords!: Table<FinRecord, number>;
  finAccounts!: Table<FinAccount, number>;
  reviewRecords!: Table<ReviewRecord, number>;
  reminders!: Table<Reminder, number>;
  reminderLogs!: Table<ReminderLog, number>;
  healthRecords!: Table<HealthRecord, number>;

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

    this.version(3).stores({
      tasks: "++id, type, status, parentTaskId, startTime, projectId, createdAt, [type+status], *tags",
      habit_logs: "++id, taskId, date, [taskId+date], createdAt",
      plugin_registry: "id, status",
    }).upgrade(async (tx) => {
      const captures = await tx.table("capture").toArray();
      let captureMigrated = 0;
      for (const c of captures) {
        const taskStatus: Task["status"] = c.status === "trash" ? "archived" : "active";
        const taskPlanned = c.status === "planned" ? true : undefined;
        await tx.table("tasks").add({
          title: c.content,
          type: "daily" as const,
          status: taskStatus,
          planned: taskPlanned,
          tags: c.tags || [],
          createdAt: c.createdAt,
          updatedAt: c.updatedAt,
        });
        captureMigrated++;
      }

      const events = await tx.table("events").toArray();
      let eventsMigrated = 0;
      for (const e of events) {
        await tx.table("tasks").add({
          title: e.title,
          type: "shortterm" as const,
          status: e.deleted ? ("archived" as const) : ("active" as const),
          planned: e.planned,
          startTime: e.startTime,
          endTime: e.endTime,
          projectId: e.projectId,
          captureSourceId: e.captureSourceId,
          focusSessions: e.focusSessions || [],
          tags: e.tags || [],
          note: e.notes,
          createdAt: e.createdAt,
          updatedAt: e.updatedAt,
        });
        eventsMigrated++;
      }

      if (typeof window !== "undefined" && window.location.hostname === "localhost") {
        console.log(
          `[LifeFlowDB v3 migration] Migrated ${captureMigrated} capture items and ${eventsMigrated} events to tasks table`
        );
      }
    });

    this.version(4).stores({
      projectV2s: "++id, name, createdAt",
      trashStore: "++id, originalTable, deletedAt",
      boards: "++id, name, projectId, createdAt",
      sections: "++id, name, boardId, createdAt",
      pluginsMeta: "++id, name, status",
    }).upgrade(async (tx) => {
      if (typeof window !== "undefined" && window.location.hostname === "localhost") {
        console.log("[LifeFlowDB v4] Starting migration...");
      }

      try {
        const defaultProjectId = await tx.table("projectV2s").add({
          name: "默认项目",
          color: "#007AFF",
          createdAt: Date.now(),
        });

        const boardCount = await tx.table("boards").toCollection().modify((board: Record<string, unknown>) => {
          if (!board.projectId) board.projectId = defaultProjectId;
        });

        const taskCount = await tx.table("tasks").count();

        if (typeof window !== "undefined" && window.location.hostname === "localhost") {
          console.log(`[LifeFlowDB v4] Default project: ${defaultProjectId}, boards: ${boardCount}, tasks: ${taskCount}`);
        }
      } catch (err) {
        console.error("[LifeFlowDB v4] Migration failed:", err);
        throw err;
      }
    });

    this.version(5).stores({
      tasks: "++id, type, classification, status, parentTaskId, sectionId, boardId, startTime, projectId, createdAt, [type+status], *tags",
    }).upgrade(async () => {
      // Non-structural index addition only — no data migration needed
      if (typeof window !== "undefined" && window.location.hostname === "localhost") {
        console.log("[LifeFlowDB v5] Added sectionId, classification, boardId indexes");
      }
    });

    this.version(6).stores({
      timeSegments: "++id, taskId, startTime, [taskId+startTime]",
    }).upgrade(async () => {
      if (typeof window !== "undefined" && window.location.hostname === "localhost") {
        console.log("[LifeFlowDB v6] Added time_segments table");
      }
    });

    this.version(7).stores({
      sections: "++id, name, boardId, startTime, createdAt",
    }).upgrade(async () => {
      if (typeof window !== "undefined" && window.location.hostname === "localhost") {
        console.log("[LifeFlowDB v7] Added startTime index to sections");
      }
    });

    this.version(8).stores({
      finRecords: "++id, type, date, category, accountId, createdAt",
    }).upgrade(async () => {
      if (typeof window !== "undefined" && window.location.hostname === "localhost") {
        console.log("[LifeFlowDB v8] Added finRecords table");
      }
    });

    this.version(9).stores({
      finAccounts: "++id, name, createdAt",
    }).upgrade(async () => {
      if (typeof window !== "undefined" && window.location.hostname === "localhost") {
        console.log("[LifeFlowDB v9] Added finAccounts table");
      }
    });

    this.version(10).stores({
      reviewRecords: "++id, type, dateKey, createdAt",
    }).upgrade(async () => {
      if (typeof window !== "undefined" && window.location.hostname === "localhost") {
        console.log("[LifeFlowDB v10] Added reviewRecords table");
      }
    });

    this.version(11).stores({
      reminders: "++id, taskId, type, triggerTime, status, createdAt",
      reminderLogs: "++id, reminderId, action, timestamp",
    }).upgrade(async () => {
      if (typeof window !== "undefined" && window.location.hostname === "localhost") {
        console.log("[LifeFlowDB v11] Added reminders and reminderLogs tables");
      }
    });

    this.version(12).stores({
    pluginsMeta: "++id, name, status, showInNavbar",
  }).upgrade(async (tx) => {
    if (typeof window !== "undefined" && window.location.hostname === "localhost") {
      console.log("[LifeFlowDB v12] Added showInNavbar index to pluginsMeta table");
    }
    const plugins = await tx.table("pluginsMeta").toArray();
    for (const plugin of plugins) {
      if (plugin.showInNavbar === undefined) {
        await tx.table("pluginsMeta").update(plugin.id!, { showInNavbar: false });
      }
    }
  });

  this.version(13).stores({
    healthRecords: "++id, metricType, date, timestamp, createdAt",
  }).upgrade(async () => {
    if (typeof window !== "undefined" && window.location.hostname === "localhost") {
      console.log("[LifeFlowDB v13] Added healthRecords table");
    }
  });
  }
}

export const db = new LifeFlowDB();

function getLocalDateStr(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function getTodayRange(): { start: number; end: number } {
  const now = new Date();
  const start = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  const end = start + 24 * 60 * 60 * 1000;
  return { start, end };
}

// ─── Transaction ────────────────────────────────────────────

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

export async function writeWithRetry<T>(
  operation: () => Promise<T>,
  options: { maxRetries?: number; context?: string } = {}
): Promise<T> {
  const { maxRetries = 3, context = "" } = options;
  let lastError: Error | null = null;

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      return await operation();
    } catch (err) {
      lastError = err as Error;

      if (
        (err as Error).name === "QuotaExceededError" ||
        (err as Error).name === "VersionError"
      ) {
        throw err;
      }

      if (attempt < maxRetries) {
        const delay = 100 * Math.pow(2, attempt - 1);
        console.warn(`[DB] ${context} 第${attempt}次失败，${delay}ms后重试...`);
        await new Promise((r) => setTimeout(r, delay));
      }
    }
  }

  throw lastError ?? new Error("WRITE_FAILED");
}

// ─── Database Initialization ────────────────────────────────

export async function initializeDatabase(): Promise<{
  success: boolean;
  error?: string;
  recoverable?: boolean;
}> {
  try {
    await db.open();
    return { success: true };
  } catch (err) {
    const error = (err as Error).message;
    const name = (err as Error).name;
    const recoverable = !(
      name === "QuotaExceededError" ||
      name === "VersionError"
    );
    return { success: false, error, recoverable };
  }
}

// ─── Capture CRUD (backward compatible) ─────────────────────

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

// ─── Events CRUD (backward compatible) ──────────────────────

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

// ─── Focus Logs CRUD ────────────────────────────────────────

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

// ─── Projects CRUD ──────────────────────────────────────────

export async function createProject(name: string, color: string): Promise<string> {
  const id = crypto.randomUUID();
  await db.projects.add({ id, name, color });
  return id;
}

export async function getAllProjects(): Promise<LegacyProject[]> {
  return db.projects.toArray();
}

export async function getProject(id: string): Promise<LegacyProject | undefined> {
  return db.projects.get(id);
}

export async function updateProject(
  id: string,
  updates: Partial<Pick<LegacyProject, "name" | "color">>
): Promise<void> {
  await db.projects.update(id, { ...updates });
}

export async function deleteProject(id: string): Promise<void> {
  await db.transaction("rw", [db.projects, db.events, db.tasks], async () => {
    const events = await db.events.where("projectId").equals(id).toArray();
    for (const event of events) {
      await db.events.update(event.id!, { projectId: undefined, updatedAt: Date.now() });
    }

    const tasks = await db.tasks.where("projectId").equals(id).toArray();
    for (const task of tasks) {
      await db.tasks.update(task.id!, { projectId: undefined, updatedAt: Date.now() });
    }

    await db.projects.delete(id);
  });
}

/** @deprecated Use getProjectTaskCount instead */
export async function getProjectEventCount(id: string): Promise<number> {
  return db.events.where("projectId").equals(id).and((e) => !e.deleted).count();
}

export async function getProjectTaskCount(id: string): Promise<number> {
  return db.tasks.where("projectId").equals(id).and((t) => t.status !== "archived").count();
}

// ─── Task CRUD ──────────────────────────────────────────────

export async function createTask(
  data: Omit<Task, "id" | "createdAt" | "updatedAt">
): Promise<number> {
  const now = Date.now();
  return writeWithRetry(
    () => db.tasks.add({
      ...data,
      createdAt: now,
      updatedAt: now,
    }),
    { context: `createTask(${data.title})` }
  );
}

export async function updateTask(
  id: number,
  updates: Partial<Omit<Task, "id" | "createdAt">>
): Promise<void> {
  return writeWithRetry(
    async () => { await db.tasks.update(id, { ...updates, updatedAt: Date.now() }); },
    { context: `updateTask(${id})` }
  );
}

export async function getTask(id: number): Promise<Task | undefined> {
  return db.tasks.get(id);
}

export async function getTasksByType(
  type: Task["type"],
  limit?: number
): Promise<Task[]> {
  const collection = db.tasks.where("type").equals(type);
  if (limit !== undefined) {
    return collection.limit(limit).toArray();
  }
  return collection.toArray();
}

export async function getTasksByStatus(
  status: Task["status"],
  limit?: number
): Promise<Task[]> {
  const collection = db.tasks.where("status").equals(status);
  if (limit !== undefined) {
    return collection.limit(limit).toArray();
  }
  return collection.toArray();
}

export async function getTasksByTimeRange(
  start: number,
  end: number,
  type?: Task["type"]
): Promise<Task[]> {
  const collection = db.tasks.where("startTime").between(start, end);
  const items = await collection.toArray();
  if (type) {
    return items.filter((t) => t.type === type);
  }
  return items;
}

export async function getRootTasks(type: Task["type"]): Promise<Task[]> {
  return db.tasks
    .where("type")
    .equals(type)
    .filter((t) => !t.parentTaskId && t.status !== "archived")
    .toArray();
}

export async function getChildTasks(parentTaskId: number): Promise<Task[]> {
  return db.tasks
    .where("parentTaskId")
    .equals(parentTaskId)
    .filter((t) => t.status !== "archived")
    .toArray();
}

export async function deleteTask(id: number): Promise<void> {
  return writeWithRetry(
    async () => { await db.tasks.update(id, { status: "archived", updatedAt: Date.now() }); },
    { context: `deleteTask(${id})` }
  );
}

export async function restoreTask(id: number): Promise<void> {
  await db.tasks.update(id, { status: "active", updatedAt: Date.now() });
}

export async function purgeTask(id: number): Promise<void> {
  await db.tasks.delete(id);
}

export async function getTrashTasks(): Promise<Task[]> {
  return db.tasks
    .where("status")
    .equals("archived")
    .reverse()
    .sortBy("updatedAt");
}

export async function getTrashTaskCount(): Promise<number> {
  return db.tasks.where("status").equals("archived").count();
}

export async function moveTask(
  taskId: number,
  newParentId: number | null
): Promise<void> {
  if (newParentId === null) {
    await db.tasks.update(taskId, { parentTaskId: undefined, updatedAt: Date.now() });
    return;
  }

  if (newParentId === taskId) {
    throw new Error("Cannot move a task under itself");
  }

  let currentId: number | undefined = newParentId;
  while (currentId) {
    if (currentId === taskId) {
      throw new Error("Cannot move a task under its own descendant");
    }
    const parent: Task | undefined = await db.tasks.get(currentId);
    currentId = parent?.parentTaskId;
  }

  await db.tasks.update(taskId, { parentTaskId: newParentId, updatedAt: Date.now() });
}

export async function reorderTasks(taskIds: number[]): Promise<void> {
  await db.transaction("rw", db.tasks, async () => {
    for (let i = 0; i < taskIds.length; i++) {
      await db.tasks.update(taskIds[i], { order: i });
    }
  });
}

export async function getTasksByProject(
  projectId: string,
  limit?: number
): Promise<Task[]> {
  const collection = db.tasks
    .where("projectId")
    .equals(projectId)
    .filter((t) => t.status !== "archived");
  if (limit !== undefined) {
    return collection.limit(limit).toArray();
  }
  return collection.toArray();
}

export async function getTasksBySection(sectionId: number): Promise<Task[]> {
  return db.tasks.where("sectionId").equals(sectionId).toArray();
}

export async function getTodayTasks(): Promise<Task[]> {
  const { start, end } = getTodayRange();
  return db.tasks
    .where("startTime")
    .between(start, end, true, false)
    .filter((t) => t.status === "active")
    .toArray();
}

// ─── Habit CRUD ─────────────────────────────────────────────

export async function checkInHabit(taskId: number): Promise<{
  success: boolean;
  record?: HabitLog;
  message: string;
  alreadyCheckedIn?: boolean;
}> {
  const task = await db.tasks.get(taskId);
  if (!task) {
    return { success: false, message: "Task not found" };
  }
  if (task.type !== "habit") {
    return { success: false, message: "Task is not a habit" };
  }
  if (task.status !== "active") {
    return { success: false, message: "Habit is not active" };
  }

  const today = getLocalDateStr(new Date());

  const existing = await db.habit_logs
    .where("[taskId+date]")
    .equals([taskId, today])
    .first();

  if (existing) {
    return {
      success: false,
      record: existing,
      message: "Already checked in today",
      alreadyCheckedIn: true,
    };
  }

  const record: HabitLog = {
    taskId,
    date: today,
    count: 1,
    createdAt: Date.now(),
  };

  const id = await writeWithRetry(
    () => db.habit_logs.add(record),
    { context: `checkInHabit(${taskId})` }
  );
  record.id = id;

  return { success: true, record, message: "Check-in successful" };
}

export async function getStreak(taskId: number): Promise<number> {
  const logs = await db.habit_logs.where("taskId").equals(taskId).toArray();
  if (logs.length === 0) return 0;

  const dates = new Set(logs.map((l) => l.date));

  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const todayStr = getLocalDateStr(today);
  const yesterday = new Date(today.getTime() - 24 * 60 * 60 * 1000);
  const yesterdayStr = getLocalDateStr(yesterday);

  let startFrom: Date;
  if (dates.has(todayStr)) {
    startFrom = today;
  } else if (dates.has(yesterdayStr)) {
    startFrom = yesterday;
  } else {
    return 0;
  }

  let streak = 0;
  for (let i = 0; i < 365; i++) {
    const d = new Date(startFrom.getTime() - i * 24 * 60 * 60 * 1000);
    const dateStr = getLocalDateStr(d);
    if (dates.has(dateStr)) {
      streak++;
    } else {
      break;
    }
  }

  return streak;
}

export async function getHabitLogs(
  taskId: number,
  limit?: number
): Promise<HabitLog[]> {
  const collection = db.habit_logs
    .where("taskId")
    .equals(taskId)
    .reverse()
    .sortBy("date");
  const result = await collection;
  if (limit !== undefined) {
    return result.slice(0, limit);
  }
  return result;
}

export async function getHabitLogsByDateRange(
  taskId: number,
  startDate: string,
  endDate: string
): Promise<HabitLog[]> {
  return db.habit_logs
    .where("taskId")
    .equals(taskId)
    .filter((l) => l.date >= startDate && l.date <= endDate)
    .toArray();
}

export async function getAllHabits(): Promise<Task[]> {
  return db.tasks
    .where("[type+status]")
    .equals(["habit", "active"])
    .toArray();
}

export async function deleteHabitLog(taskId: number, date: string): Promise<void> {
  const existing = await db.habit_logs
    .where("[taskId+date]")
    .equals([taskId, date])
    .first();
  if (existing?.id != null) {
    await db.habit_logs.delete(existing.id);
  }
}

// ─── Plugin CRUD ────────────────────────────────────────────

export async function registerPlugin(
  data: Omit<PluginRegistry, "installedAt" | "updatedAt">
): Promise<void> {
  const now = Date.now();
  await db.plugin_registry.put({
    ...data,
    installedAt: now,
    updatedAt: now,
  });
}

export async function getPlugin(id: string): Promise<PluginRegistry | undefined> {
  return db.plugin_registry.get(id);
}

export async function getAllPlugins(): Promise<PluginRegistry[]> {
  return db.plugin_registry.toArray();
}

export async function updatePluginStatus(
  id: string,
  status: PluginRegistry["status"]
): Promise<void> {
  await db.plugin_registry.update(id, { status, updatedAt: Date.now() });
}

export async function updatePluginConfig(
  id: string,
  config: Record<string, unknown>
): Promise<void> {
  await db.plugin_registry.update(id, { config, updatedAt: Date.now() });
}

export async function uninstallPlugin(id: string): Promise<void> {
  await db.plugin_registry.delete(id);
}

// ─── Cross-model transactions ───────────────────────────────

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

/** Convert a capture item to a task (v2.1 unified model) */
export async function convertCaptureToTask(
  captureId: number,
  taskData: Omit<Task, "id" | "captureSourceId" | "createdAt" | "updatedAt">
): Promise<number> {
  return db.transaction("rw", [db.capture, db.tasks], async () => {
    const capture = await db.capture.get(captureId);
    if (!capture) throw new Error(`Capture ${captureId} not found`);
    if (capture.status !== "inbox") {
      throw new Error(`Capture ${captureId} is not in inbox status`);
    }

    const now = Date.now();
    const taskId = await db.tasks.add({
      ...taskData,
      captureSourceId: captureId,
      createdAt: now,
      updatedAt: now,
    });

    await db.capture.update(captureId, { status: "planned" });
    return taskId;
  });
}

export async function completeFocusSession(
  focusLogId: number,
  finalDuration: number,
  interruptions: number
): Promise<void> {
  return db.transaction("rw", [db.focusLogs, db.tasks, db.events], async () => {
    const focusLog = await db.focusLogs.get(focusLogId);
    if (!focusLog) throw new Error(`FocusLog ${focusLogId} not found`);

    await db.focusLogs.update(focusLogId, {
      duration: finalDuration,
      interruptions,
      completed: true,
    });

    const task = await db.tasks.get(focusLog.eventId);
    if (task) {
      const existingSessions = task.focusSessions ?? [];
      await db.tasks.update(task.id!, {
        focusSessions: [...existingSessions, focusLogId],
        updatedAt: Date.now(),
      });
      return;
    }

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

// ─── Storage check ──────────────────────────────────────────

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

// ─── Export / Import ────────────────────────────────────────

export interface ExportData {
  version: number;
  exportedAt: string;
  data: {
    capture: CaptureItem[];
    events: CalendarEvent[];
    focusLogs: FocusLog[];
    projects: LegacyProject[];
    agentMemory: AgentMemory[];
    agentChats: AgentChatSession[];
    tasks: Task[];
    habitLogs: HabitLog[];
    pluginRegistry: PluginRegistry[];
    projectV2s: ProjectV2[];
    boards: Board[];
    sections: Section[];
    pluginsMeta: PluginMetadata[];
    trashStore: TrashItem[];
    timeSegments: TimeSegment[];
    finRecords: FinRecord[];
    finAccounts: FinAccount[];
  };
}

export async function exportAllData(): Promise<ExportData> {
  const [
    capture,
    events,
    focusLogs,
    projects,
    agentMemory,
    agentChats,
    tasks,
    habitLogs,
    pluginRegistry,
    projectV2s,
    boards,
    sections,
    pluginsMeta,
    trashStore,
    timeSegments,
    finRecords,
    finAccounts,
  ] = await Promise.all([
    db.capture.toArray(),
    db.events.toArray(),
    db.focusLogs.toArray(),
    db.projects.toArray(),
    db.agentMemory.toArray(),
    db.agentChats.toArray(),
    db.tasks.toArray(),
    db.habit_logs.toArray(),
    db.plugin_registry.toArray(),
    db.projectV2s.toArray(),
    db.boards.toArray(),
    db.sections.toArray(),
    db.pluginsMeta.toArray(),
    db.trashStore.toArray(),
    db.timeSegments.toArray(),
    db.finRecords.toArray(),
    db.finAccounts.toArray(),
  ]);

  return {
    version: 1,
    exportedAt: new Date().toISOString(),
    data: {
      capture,
      events,
      focusLogs,
      projects,
      agentMemory,
      agentChats,
      tasks,
      habitLogs,
      pluginRegistry,
      projectV2s,
      boards,
      sections,
      pluginsMeta,
      trashStore,
      timeSegments,
      finRecords,
      finAccounts,
    },
  };
}

export async function importAllData(
  importData: ExportData
): Promise<{ imported: Record<string, number> }> {
  const { data } = importData;
  const imported: Record<string, number> = {};

  await db.transaction(
    "rw",
    [
      db.capture,
      db.events,
      db.focusLogs,
      db.projects,
      db.agentMemory,
      db.agentChats,
      db.tasks,
      db.habit_logs,
      db.plugin_registry,
      db.projectV2s,
      db.boards,
      db.sections,
      db.pluginsMeta,
      db.trashStore,
      db.timeSegments,
      db.finRecords,
      db.finAccounts,
    ],
    async () => {
      await Promise.all([
        db.capture.clear(),
        db.events.clear(),
        db.focusLogs.clear(),
        db.projects.clear(),
        db.agentMemory.clear(),
        db.agentChats.clear(),
        db.tasks.clear(),
        db.habit_logs.clear(),
        db.plugin_registry.clear(),
        db.projectV2s.clear(),
        db.boards.clear(),
        db.sections.clear(),
        db.pluginsMeta.clear(),
        db.trashStore.clear(),
        db.timeSegments.clear(),
        db.finRecords.clear(),
        db.finAccounts.clear(),
      ]);

      await Promise.all([
        db.capture.bulkAdd(data.capture || []),
        db.events.bulkAdd(data.events || []),
        db.focusLogs.bulkAdd(data.focusLogs || []),
        db.projects.bulkAdd(data.projects || []),
        db.agentMemory.bulkAdd(data.agentMemory || []),
        db.agentChats.bulkAdd(data.agentChats || []),
        db.tasks.bulkAdd(data.tasks || []),
        db.habit_logs.bulkAdd(data.habitLogs || []),
        db.plugin_registry.bulkAdd(data.pluginRegistry || []),
        db.projectV2s.bulkAdd(data.projectV2s || []),
        db.boards.bulkAdd(data.boards || []),
        db.sections.bulkAdd(data.sections || []),
        db.pluginsMeta.bulkAdd(data.pluginsMeta || []),
        db.trashStore.bulkAdd(data.trashStore || []),
        db.timeSegments.bulkAdd(data.timeSegments || []),
        db.finRecords.bulkAdd(data.finRecords || []),
        db.finAccounts.bulkAdd(data.finAccounts || []),
      ]);

      imported.capture = data.capture?.length || 0;
      imported.events = data.events?.length || 0;
      imported.focusLogs = data.focusLogs?.length || 0;
      imported.projects = data.projects?.length || 0;
      imported.agentMemory = data.agentMemory?.length || 0;
      imported.agentChats = data.agentChats?.length || 0;
      imported.tasks = data.tasks?.length || 0;
      imported.habitLogs = data.habitLogs?.length || 0;
      imported.pluginRegistry = data.pluginRegistry?.length || 0;
      imported.projectV2s = data.projectV2s?.length || 0;
      imported.boards = data.boards?.length || 0;
      imported.sections = data.sections?.length || 0;
      imported.pluginsMeta = data.pluginsMeta?.length || 0;
      imported.trashStore = data.trashStore?.length || 0;
      imported.timeSegments = data.timeSegments?.length || 0;
      imported.finRecords = data.finRecords?.length || 0;
      imported.finAccounts = data.finAccounts?.length || 0;
    }
  );

  return { imported };
}

// ─── ProjectV2 CRUD ─────────────────────────────────────────

export async function createProjectV2(name: string, color?: string): Promise<number> {
  return db.projectV2s.add({ name, color: color || "#007AFF", createdAt: Date.now() });
}

export async function getAllProjectsV2(): Promise<ProjectV2[]> {
  return db.projectV2s.toArray();
}

export async function getProjectV2(id: number): Promise<ProjectV2 | undefined> {
  return db.projectV2s.get(id);
}

export async function updateProjectV2(id: number, updates: Partial<Pick<ProjectV2, "name" | "color">>): Promise<void> {
  await db.projectV2s.update(id, updates);
}

export async function deleteProjectToTrash(id: number): Promise<void> {
  const project = await db.projectV2s.get(id);
  if (!project) throw new Error("PROJECT_NOT_FOUND");
  await db.transaction("rw", db.projectV2s, db.trashStore, async () => {
    await db.trashStore.add({
      originalTable: "projects",
      originalId: id,
      data: JSON.parse(JSON.stringify(project)),
      deletedAt: Date.now(),
    });
    await db.projectV2s.delete(id);
  });
}

// ─── Board CRUD ─────────────────────────────────────────────

export async function createBoard(name: string, projectId?: number): Promise<number> {
  return db.boards.add({ name, projectId, createdAt: Date.now() });
}

export async function getBoardsByProject(projectId: number): Promise<Board[]> {
  return db.boards.where("projectId").equals(projectId).toArray();
}

export async function getBoard(id: number): Promise<Board | undefined> {
  return db.boards.get(id);
}

export async function updateBoard(id: number, updates: Partial<Board>): Promise<void> {
  await db.boards.update(id, updates);
}

export async function deleteBoardToTrash(id: number): Promise<void> {
  const board = await db.boards.get(id);
  if (!board) throw new Error("BOARD_NOT_FOUND");
  await db.transaction("rw", db.boards, db.trashStore, async () => {
    await db.trashStore.add({ originalTable: "boards", originalId: id, data: JSON.parse(JSON.stringify(board)), deletedAt: Date.now() });
    await db.boards.delete(id);
  });
}

// ─── Section CRUD ───────────────────────────────────────────

export async function createSection(name: string, boardId?: number): Promise<number> {
  return db.sections.add({ name, boardId, createdAt: Date.now() });
}

export async function getSection(id: number): Promise<Section | undefined> {
  return db.sections.get(id);
}

export async function getSectionsByBoard(boardId: number): Promise<Section[]> {
  return db.sections.where("boardId").equals(boardId).toArray();
}

export async function updateSection(id: number, updates: Partial<Section>): Promise<void> {
  await db.sections.update(id, updates);
}

export async function deleteSectionToTrash(id: number): Promise<void> {
  const section = await db.sections.get(id);
  if (!section) throw new Error("SECTION_NOT_FOUND");
  await db.transaction("rw", db.sections, db.trashStore, async () => {
    await db.trashStore.add({ originalTable: "sections", originalId: id, data: JSON.parse(JSON.stringify(section)), deletedAt: Date.now() });
    await db.sections.delete(id);
  });
}

// ─── Trash CRUD ─────────────────────────────────────────────

export async function getTrashItems(): Promise<TrashItem[]> {
  return db.trashStore.orderBy("deletedAt").reverse().toArray();
}

export async function restoreFromTrash(trashId: number): Promise<void> {
  const item = await db.trashStore.get(trashId);
  if (!item) throw new Error("TRASH_ITEM_NOT_FOUND");

  const tableMap: Record<string, string> = {
    capture: "capture",
    tasks: "tasks",
    projects: "projectV2s",
    boards: "boards",
    sections: "sections",
  };

  const targetTable = tableMap[item.originalTable];
  if (!targetTable) throw new Error("UNKNOWN_TABLE");

  await db.transaction("rw", db.trashStore, async () => {
    const table = (db as unknown as Record<string, unknown>)[targetTable] as { add: (data: unknown) => Promise<unknown> };
    if (table && typeof table.add === "function") {
      await table.add(item.data);
    }
    await db.trashStore.delete(trashId);
  });
}

export async function purgeFromTrash(trashId: number): Promise<void> {
  await db.trashStore.delete(trashId);
}

export async function autoCleanupTrash(daysRetention = 30): Promise<number> {
  const threshold = Date.now() - daysRetention * 24 * 60 * 60 * 1000;
  const oldItems = await db.trashStore.where("deletedAt").below(threshold).toArray();
  for (const item of oldItems) {
    await db.trashStore.delete(item.id!);
  }
  return oldItems.length;
}

// ─── Plugin Metadata CRUD ───────────────────────────────────

export async function initBuiltInPlugins(): Promise<void> {
  const existing = await db.pluginsMeta.toArray();
  const names = new Set(existing.map((p) => p.name));

  if (!names.has("timeline")) {
    await db.pluginsMeta.add({
      name: "timeline",
      version: "1.0.0",
      description: "生命时间轴可视化",
      status: "active",
      isBuiltIn: true,
      showInNavbar: false,
      installedAt: Date.now(),
      updatedAt: Date.now(),
    });
  }
  if (!names.has("focus-timer")) {
    await db.pluginsMeta.add({
      name: "focus-timer",
      version: "1.0.0",
      description: "专注计时器",
      status: "active",
      isBuiltIn: true,
      showInNavbar: false,
      installedAt: Date.now(),
      updatedAt: Date.now(),
    });
  }
  if (!names.has("finance")) {
    await db.pluginsMeta.add({
      name: "finance",
      version: "1.0.0",
      description: "财务管理 · 收支记账",
      status: "active",
      isBuiltIn: true,
      showInNavbar: false,
      installedAt: Date.now(),
      updatedAt: Date.now(),
    });
  }
  if (!names.has("task-inbox")) {
    await db.pluginsMeta.add({
      name: "task-inbox",
      version: "1.0.0",
      description: "任务清单 · 按时间查看待办",
      status: "active",
      isBuiltIn: true,
      showInNavbar: false,
      installedAt: Date.now(),
      updatedAt: Date.now(),
    });
  }
  if (!names.has("habit")) {
    await db.pluginsMeta.add({
      name: "habit",
      version: "1.0.0",
      description: "习惯追踪 · 养成好习惯",
      status: "active",
      isBuiltIn: true,
      showInNavbar: false,
      installedAt: Date.now(),
      updatedAt: Date.now(),
    });
  }

  const accountCount = await db.finAccounts.count();
  if (accountCount === 0) {
    await db.finAccounts.bulkAdd([
      { name: "现金", initialBalance: 0, createdAt: Date.now() },
      { name: "银行卡", initialBalance: 0, createdAt: Date.now() + 1 },
      { name: "信用卡", initialBalance: 0, createdAt: Date.now() + 2 },
    ]);
  }
}

export async function getPluginMeta(name: string): Promise<PluginMetadata | undefined> {
  return db.pluginsMeta.where("name").equals(name).first();
}

export async function getAllPluginsMeta(): Promise<PluginMetadata[]> {
  return db.pluginsMeta.toArray();
}

export async function updatePluginMetaStatus(id: number, status: PluginMetadata["status"]): Promise<void> {
  await db.pluginsMeta.update(id, { status, updatedAt: Date.now() });
}

export async function updatePluginMetaShowInNavbar(id: number, showInNavbar: boolean): Promise<void> {
  await db.pluginsMeta.update(id, { showInNavbar, updatedAt: Date.now() });
}

export async function getPluginsForNavbar(): Promise<PluginMetadata[]> {
  const allPlugins = await db.pluginsMeta.toArray();
  return allPlugins.filter(p => p.showInNavbar === true);
}

export async function addTimeSegment(taskId: number, startTime: number, endTime: number): Promise<number> {
  return db.timeSegments.add({ taskId, startTime, endTime, createdAt: Date.now() });
}

export async function deleteTimeSegment(id: number): Promise<void> {
  await db.timeSegments.delete(id);
}

export async function getTimeSegments(taskId: number): Promise<TimeSegment[]> {
  return db.timeSegments.where("taskId").equals(taskId).toArray();
}

export async function addFinRecord(record: Omit<FinRecord, "id" | "createdAt">): Promise<number> {
  return db.finRecords.add({ ...record, createdAt: Date.now() });
}

export async function getFinRecordsByMonth(year: number, month: number, accountId?: number): Promise<FinRecord[]> {
  const prefix = `${year}-${String(month).padStart(2, "0")}`;
  let collection = db.finRecords.where("date").startsWith(prefix);
  if (accountId != null) {
    collection = collection.and((r) => r.accountId === accountId);
  }
  return collection.reverse().sortBy("createdAt");
}

export async function deleteFinRecord(id: number): Promise<void> {
  await db.finRecords.delete(id);
}

export async function createFinAccount(name: string, initialBalance: number): Promise<number> {
  return db.finAccounts.add({ name, initialBalance, createdAt: Date.now() });
}

export async function getFinAccounts(): Promise<FinAccount[]> {
  return db.finAccounts.orderBy("createdAt").toArray();
}

export async function deleteFinAccount(id: number): Promise<void> {
  await db.transaction("rw", [db.finAccounts, db.finRecords], async () => {
    await db.finRecords.where("accountId").equals(id).delete();
    await db.finAccounts.delete(id);
  });
}

export async function getAccountBalance(accountId: number): Promise<number> {
  const account = await db.finAccounts.get(accountId);
  if (!account) return 0;
  const records = await db.finRecords.where("accountId").equals(accountId).toArray();
  const net = records.reduce((s, r) => r.type === "income" ? s + r.amount : s - r.amount, 0);
  return account.initialBalance + net;
}

export async function getTasksForInbox(): Promise<Task[]> {
  const all = await db.tasks
    .where("startTime")
    .above(0)
    .filter((t) => (t.type === "shortterm" || t.type === "daily" || t.type === "habit") && t.status === "active")
    .toArray();
  return all.sort((a, b) => (a.startTime ?? 0) - (b.startTime ?? 0));
}

export async function getActiveSchedulableTasks(): Promise<Task[]> {
  const all = await db.tasks
    .filter((t) => (t.type === "shortterm" || t.type === "daily" || t.type === "habit") && t.status === "active")
    .toArray();
  return all.sort((a, b) => b.createdAt - a.createdAt);
}

export async function getTimeSegmentsByDateRange(rangeStart: number, rangeEnd: number): Promise<TimeSegment[]> {
  return db.timeSegments.where("startTime").between(rangeStart, rangeEnd).toArray();
}

export async function createReviewRecord(record: Omit<ReviewRecord, "id" | "createdAt">): Promise<number> {
  return db.reviewRecords.add({ ...record, createdAt: Date.now() });
}

export async function getReviewRecords(type: ReviewRecord["type"]): Promise<ReviewRecord[]> {
  return db.reviewRecords.where("type").equals(type).reverse().sortBy("createdAt");
}

export async function getReviewRecordByKey(dateKey: string): Promise<ReviewRecord | undefined> {
  return db.reviewRecords.where("dateKey").equals(dateKey).first();
}

export async function getMonthlyTaskStats(year: number, month: number): Promise<{ done: number; active: number; overdue: number }> {
  const prefix = `${year}-${String(month).padStart(2, "0")}`;
  const all = await db.tasks
    .filter((t) => (t.type === "shortterm" || t.type === "daily" || t.type === "habit"))
    .toArray();
  const inMonth = all.filter((t) => {
    const d = new Date(t.createdAt);
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}` === prefix;
  });
  return {
    done: inMonth.filter((t) => t.status === "done").length,
    active: inMonth.filter((t) => t.status === "active").length,
    overdue: inMonth.filter((t) => t.status === "active" && t.dueDate != null && t.dueDate < Date.now()).length,
  };
}

export async function getMonthlyHabitStats(year: number, month: number): Promise<{ total: number; totalChecks: number }> {
  const mStr = `${year}-${String(month).padStart(2, "0")}`;
  const logs = await db.habit_logs
    .filter((l) => l.date.startsWith(mStr))
    .toArray();
  const habits = await db.tasks.where("type").equals("habit").filter((t) => t.status === "active").toArray();
  return {
    total: habits.length,
    totalChecks: logs.length,
  };
}

export async function getMonthlyFinanceStats(year: number, month: number): Promise<{ income: number; expense: number }> {
  const prefix = `${year}-${String(month).padStart(2, "0")}`;
  const records = await db.finRecords
    .where("date")
    .startsWith(prefix)
    .toArray();
  return {
    income: records.filter((r) => r.type === "income").reduce((s, r) => s + r.amount, 0),
    expense: records.filter((r) => r.type === "expense").reduce((s, r) => s + r.amount, 0),
  };
}

export async function getWeeklyTaskStats(): Promise<{ done: number; pending: number }> {
  const now = new Date();
  const weekStart = new Date(now);
  weekStart.setDate(now.getDate() - now.getDay());
  weekStart.setHours(0, 0, 0, 0);
  const weekStartTs = weekStart.getTime();
  const all = await db.tasks
    .filter((t) => t.type === "shortterm" || t.type === "daily" || t.type === "habit")
    .toArray();
  return {
    done: all.filter((t) => t.status === "done" && t.updatedAt >= weekStartTs).length,
    pending: all.filter((t) => t.status === "active").length,
  };
}

export async function createReminder(reminder: Omit<Reminder, "id" | "createdAt" | "updatedAt">): Promise<number> {
  return db.reminders.add({
    ...reminder,
    createdAt: Date.now(),
    updatedAt: Date.now(),
  });
}

export async function getPendingReminders(): Promise<Reminder[]> {
  const now = Date.now();
  return db.reminders
    .where("status")
    .equals("pending")
    .filter((r) => r.triggerTime <= now)
    .toArray();
}

export async function getPendingRemindersByTime(endTime: number): Promise<Reminder[]> {
  return db.reminders
    .where("status")
    .equals("pending")
    .filter((r) => r.triggerTime <= endTime)
    .toArray();
}

export async function getRemindersByTask(taskId: number): Promise<Reminder[]> {
  return db.reminders.where("taskId").equals(taskId).toArray();
}

export async function updateReminderStatus(id: number, status: Reminder["status"], snoozeUntil?: number): Promise<void> {
  await db.reminders.update(id, {
    status,
    snoozeUntil,
    updatedAt: Date.now(),
  });
}

export async function deleteReminder(id: number): Promise<void> {
  await db.reminders.delete(id);
}

export async function addReminderLog(reminderId: number, action: ReminderLog["action"]): Promise<number> {
  return db.reminderLogs.add({
    reminderId,
    action,
    timestamp: Date.now(),
  });
}

export async function getReminderLogs(reminderId: number): Promise<ReminderLog[]> {
  return db.reminderLogs.where("reminderId").equals(reminderId).toArray();
}

export async function scheduleDeadlineReminders(taskId: number, dueDate: number, reminderDays: number): Promise<void> {
  const task = await db.tasks.get(taskId);
  if (!task) return;

  const reminders = await getRemindersByTask(taskId);
  for (const r of reminders) {
    if (r.type === "deadline") {
      await deleteReminder(r.id!);
    }
  }

  const reminderTimes: number[] = [];
  if (reminderDays >= 7) {
    reminderTimes.push(dueDate - 7 * 24 * 60 * 60 * 1000);
  }
  if (reminderDays >= 3) {
    reminderTimes.push(dueDate - 3 * 24 * 60 * 60 * 1000);
  }
  if (reminderDays >= 1) {
    reminderTimes.push(dueDate - 1 * 24 * 60 * 60 * 1000);
  }
  reminderTimes.push(dueDate);

  for (const triggerTime of reminderTimes) {
    if (triggerTime > Date.now()) {
      await createReminder({
        taskId,
        type: "deadline",
        triggerTime,
        message: `任务「${task.title}」即将截止`,
        status: "pending",
      });
    }
  }
}

export async function scheduleHabitReminder(taskId: number, hour: number = 9): Promise<void> {
  const task = await db.tasks.get(taskId);
  if (!task || task.type !== "habit") return;

  const existing = await db.reminders
    .where("taskId")
    .equals(taskId)
    .filter((r) => r.type === "habit")
    .first();

  if (existing) {
    await deleteReminder(existing.id!);
  }

  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  tomorrow.setHours(hour, 0, 0, 0);

  await createReminder({
    taskId,
    type: "habit",
    triggerTime: tomorrow.getTime(),
    message: `记得完成习惯「${task.title}」的打卡`,
    status: "pending",
  });
}

// ─── Health Records CRUD ─────────────────────────────────────

export async function addHealthRecord(record: Omit<HealthRecord, "id" | "createdAt">): Promise<number> {
  return db.healthRecords.add({
    ...record,
    createdAt: Date.now(),
  });
}

export async function bulkAddHealthRecords(records: Omit<HealthRecord, "id" | "createdAt">[]): Promise<void> {
  await db.healthRecords.bulkAdd(records.map(r => ({ ...r, createdAt: Date.now() })));
}

export async function getHealthRecordsByType(metricType: string): Promise<HealthRecord[]> {
  return db.healthRecords.where("metricType").equals(metricType).reverse().sortBy("timestamp");
}

export async function getHealthRecordsByDate(date: string): Promise<HealthRecord[]> {
  return db.healthRecords.where("date").equals(date).toArray();
}

export async function getHealthRecordsByDateRange(startDate: string, endDate: string): Promise<HealthRecord[]> {
  return db.healthRecords
    .where("date")
    .between(startDate, endDate)
    .toArray();
}

export async function getHealthRecordsByTypeAndDate(metricType: string, date: string): Promise<HealthRecord[]> {
  return db.healthRecords
    .where("metricType")
    .equals(metricType)
    .filter((r) => r.date === date)
    .toArray();
}

export async function getHealthRecord(id: number): Promise<HealthRecord | undefined> {
  return db.healthRecords.get(id);
}

export async function updateHealthRecord(id: number, updates: Partial<Omit<HealthRecord, "id" | "createdAt">>): Promise<void> {
  await db.healthRecords.update(id, updates);
}

export async function deleteHealthRecord(id: number): Promise<void> {
  await db.healthRecords.delete(id);
}

export async function getTodayHealthRecords(): Promise<HealthRecord[]> {
  const today = new Date();
  const dateStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}-${String(today.getDate()).padStart(2, "0")}`;
  return db.healthRecords.where("date").equals(dateStr).toArray();
}

export async function getDailyHealthSummary(date: string): Promise<{ [key: string]: number | undefined }> {
  const records = await getHealthRecordsByDate(date);
  const summary: Record<string, number> = {};
  
  for (const record of records) {
    if (summary[record.metricType] === undefined) {
      summary[record.metricType] = record.value;
    } else {
      summary[record.metricType] = (summary[record.metricType] || 0) + record.value;
    }
  }
  
  return summary;
}

export async function getWeeklyHealthSummary(): Promise<{ [key: string]: { avg: number; total: number; count: number } }> {
  const now = new Date();
  const weekStart = new Date(now);
  weekStart.setDate(now.getDate() - now.getDay());
  weekStart.setHours(0, 0, 0, 0);
  
  const startDateStr = `${weekStart.getFullYear()}-${String(weekStart.getMonth() + 1).padStart(2, "0")}-${String(weekStart.getDate()).padStart(2, "0")}`;
  const endDateStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
  
  const records = await getHealthRecordsByDateRange(startDateStr, endDateStr);
  const summary: Record<string, { values: number[]; total: number }> = {};
  
  for (const record of records) {
    if (!summary[record.metricType]) {
      summary[record.metricType] = { values: [], total: 0 };
    }
    summary[record.metricType].values.push(record.value);
    summary[record.metricType].total += record.value;
  }
  
  const result: Record<string, { avg: number; total: number; count: number }> = {};
  for (const [metric, data] of Object.entries(summary)) {
    result[metric] = {
      avg: data.values.length > 0 ? data.total / data.values.length : 0,
      total: data.total,
      count: data.values.length,
    };
  }
  
  return result;
}

export async function calculateHealthScore(summary: Record<string, number>): Promise<number> {
  let score = 0;
  let totalWeight = 0;
  
  const weights: Record<string, number> = {
    water_intake: 15,
    sleep_duration: 20,
    sleep_quality: 15,
    heart_rate: 15,
    steps: 15,
    mood: 20,
  };
  
  if (summary.water_intake !== undefined) {
    const waterScore = Math.min((summary.water_intake / 2000) * 100, 100);
    score += waterScore * (weights.water_intake / 100);
    totalWeight += weights.water_intake;
  }
  
  if (summary.sleep_duration !== undefined) {
    const sleepScore = summary.sleep_duration >= 7 ? 100 : summary.sleep_duration >= 6 ? 80 : summary.sleep_duration >= 5 ? 60 : 40;
    score += sleepScore * (weights.sleep_duration / 100);
    totalWeight += weights.sleep_duration;
  }
  
  if (summary.sleep_quality !== undefined) {
    score += summary.sleep_quality * (weights.sleep_quality / 100);
    totalWeight += weights.sleep_quality;
  }
  
  if (summary.heart_rate !== undefined) {
    let heartScore = 100;
    if (summary.heart_rate < 60 || summary.heart_rate > 100) heartScore = 70;
    if (summary.heart_rate < 50 || summary.heart_rate > 120) heartScore = 40;
    score += heartScore * (weights.heart_rate / 100);
    totalWeight += weights.heart_rate;
  }
  
  if (summary.steps !== undefined) {
    const stepsScore = Math.min((summary.steps / 10000) * 100, 100);
    score += stepsScore * (weights.steps / 100);
    totalWeight += weights.steps;
  }
  
  if (summary.mood !== undefined) {
    score += summary.mood * (weights.mood / 100);
    totalWeight += weights.mood;
  }
  
  if (totalWeight === 0) return 0;
  return Math.round((score / totalWeight) * 100);
}
