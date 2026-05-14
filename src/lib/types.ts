export interface CaptureItem {
  id?: number;
  content: string;
  status: "inbox" | "planned" | "trash";
  tags: string[];
  createdAt: number;
  updatedAt: number;
}

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

export type PageId = "dashboard" | "capture" | "planner" | "focus" | "review" | "projects" | "trash" | "settings";

export interface TabItem {
  id: PageId;
  label: string;
  icon: string;
  path: string;
}
