import Dexie, { type Table } from "dexie";
import type {
  CaptureItem,
  CalendarEvent,
  FocusLog,
  Project,
  AgentMemory,
  AgentChatSession,
  Task,
  HabitLog,
  PluginRegistry,
} from "./types";

export class LifeFlowDB extends Dexie {
  capture!: Table<CaptureItem, number>;
  events!: Table<CalendarEvent, number>;
  focusLogs!: Table<FocusLog, number>;
  projects!: Table<Project, string>;
  agentMemory!: Table<AgentMemory, number>;
  agentChats!: Table<AgentChatSession, string>;
  tasks!: Table<Task, number>;
  habit_logs!: Table<HabitLog, number>;
  plugin_registry!: Table<PluginRegistry, string>;

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

      console.log(
        `[LifeFlowDB v3 migration] Migrated ${captureMigrated} capture items and ${eventsMigrated} events to tasks table`
      );
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

export interface TaskTreeNode extends Task {
  children: TaskTreeNode[];
}

export async function getTaskTree(type: Task["type"]): Promise<TaskTreeNode[]> {
  const roots = await db.tasks
    .where("type")
    .equals(type)
    .filter((t) => !t.parentTaskId && t.status !== "archived")
    .toArray();

  async function buildChildren(parentId: number, depth: number): Promise<TaskTreeNode[]> {
    if (depth >= 3) return [];
    const children = await db.tasks
      .where("parentTaskId")
      .equals(parentId)
      .filter((t) => t.status !== "archived")
      .toArray();

    const result: TaskTreeNode[] = [];
    for (const child of children) {
      result.push({
        ...child,
        children: await buildChildren(child.id!, depth + 1),
      } as TaskTreeNode);
    }
    return result;
  }

  const tree: TaskTreeNode[] = [];
  for (const root of roots) {
    tree.push({
      ...root,
      children: await buildChildren(root.id!, 1),
    } as TaskTreeNode);
  }
  return tree;
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
    projects: Project[];
    agentMemory: AgentMemory[];
    agentChats: AgentChatSession[];
    tasks: Task[];
    habitLogs: HabitLog[];
    pluginRegistry: PluginRegistry[];
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
    }
  );

  return { imported };
}
