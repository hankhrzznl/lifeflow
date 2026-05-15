/** @deprecated Use Task interface instead (v2.1 unified model) */
export interface CaptureItem {
  id?: number;
  content: string;
  status: "inbox" | "planned" | "trash";
  tags: string[];
  createdAt: number;
  updatedAt: number;
}

/** @deprecated Use Task interface instead (v2.1 unified model) */
export interface CalendarEvent {
  id?: number;
  title: string;
  startTime: number;
  endTime: number;
  planned: boolean;
  projectId?: string;
  tags: string[];
  captureSourceId?: number;
  focusSessions: number[];
  notes?: string;
  createdAt: number;
  updatedAt: number;
  deleted?: boolean;
  deletedAt?: number;
}

export interface FocusLog {
  id?: number;
  eventId: number;
  startTime: number;
  duration: number;
  interruptions: number;
  completed: boolean;
  quality?: "perfect" | "great" | "good" | "interrupted";
  createdAt: number;
}

export interface Project {
  id: string;
  name: string;
  color: string;
}

export interface AgentMemory {
  id?: number;
  dateKey: string;
  summary: string;
}

export interface AgentChatMessage {
  role: "user" | "assistant" | "system";
  content: string;
  timestamp: number;
  toolCall?: string;
  isError?: boolean;
}

export interface AgentChatSession {
  id: string;
  messages: AgentChatMessage[];
  createdAt: number;
  updatedAt: number;
}

export interface StorageInfo {
  used: number;
  total: number;
  percentUsed: number;
  remaining: number;
  isWarning: boolean;
  isCritical: boolean;
}

export interface Suggestion {
  captureId: number;
  title: string;
  startTime: number;
  endTime: number;
  tags: string[];
  confidence: number;
}

export interface Task {
  id?: number;
  title: string;
  type: 'longterm' | 'shortterm' | 'daily' | 'habit';
  parentTaskId?: number;
  isMilestone?: boolean;
  note?: string;
  status: 'active' | 'done' | 'archived';
  planned?: boolean;
  startTime?: number;
  endTime?: number;
  projectId?: string;
  captureSourceId?: number;
  focusSessions?: number[];
  tags?: string[];
  priority?: 'low' | 'medium' | 'high';
  createdAt: number;
  updatedAt: number;
  order?: number;
}

export interface HabitLog {
  id?: number;
  taskId: number;
  date: string;
  count: number;
  createdAt: number;
}

export interface PluginRegistry {
  id: string;
  name: string;
  version: string;
  description?: string;
  status: 'installed' | 'active' | 'disabled' | 'error';
  config?: Record<string, unknown>;
  installedAt: number;
  updatedAt: number;
}

export type PageId = "dashboard" | "capture" | "planner" | "focus" | "review" | "projects" | "trash" | "settings" | "goals" | "today";


export interface TabItem {
  id: PageId;
  label: string;
  icon: string;
  path: string;
}

export type GoalViewType = 'longterm' | 'shortterm' | 'daily' | 'habits';
