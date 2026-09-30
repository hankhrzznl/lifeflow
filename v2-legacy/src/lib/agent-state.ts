export type ChatState =
  | "idle"
  | "user_typing"
  | "sending"
  | "waiting_llm"
  | "streaming"
  | "tool_calling"
  | "confirming"
  | "executing"
  | "done"
  | "error_network"
  | "error_llm"
  | "error_tool";

export interface ToolCall {
  name: string;
  args: Record<string, unknown>;
}

export interface ChatStateContext {
  currentState: ChatState;
  previousState: ChatState | null;
  currentMessageId: string | null;
  currentToolCall: ToolCall | null;
  retryCount: number;
  lastError: Error | null;
  suggestions: SuggestionCardData[];
}

export interface SuggestionCardData {
  id: string;
  captureId?: number;
  title: string;
  proposedStartTime: number;
  proposedEndTime: number;
  tags: string[];
  confidence: number;
}

export interface AgentMessage {
  id: string;
  role: "user" | "assistant" | "system";
  content: string;
  timestamp: number;
  toolCall?: ToolCall;
  isError?: boolean;
  suggestions?: SuggestionCardData[];
  actionRef?: { action: string; sourceLogId?: string; sourceModule?: string; scheduleTaskId?: string };
}

const VALID_TRANSITIONS: Record<ChatState, ChatState[]> = {
  idle: ["user_typing"],
  user_typing: ["sending", "idle"],
  sending: ["waiting_llm", "error_network"],
  waiting_llm: ["streaming", "tool_calling", "error_network", "error_llm"],
  streaming: ["done", "error_llm"],
  tool_calling: ["confirming", "error_tool"],
  confirming: ["executing", "idle", "user_typing"],
  executing: ["done", "error_tool"],
  done: ["idle"],
  error_network: ["sending", "idle"],
  error_llm: ["sending", "idle"],
  error_tool: ["executing", "idle"],
};

export function createInitialContext(): ChatStateContext {
  return {
    currentState: "idle",
    previousState: null,
    currentMessageId: null,
    currentToolCall: null,
    retryCount: 0,
    lastError: null,
    suggestions: [],
  };
}

export function transitionState(
  ctx: ChatStateContext,
  to: ChatState,
  updates?: Partial<Omit<ChatStateContext, "currentState" | "previousState">>
): ChatStateContext {
  const allowed = VALID_TRANSITIONS[ctx.currentState];
  if (!allowed.includes(to)) {
    console.warn(
      `Invalid state transition: ${ctx.currentState} -> ${to}. Allowed: ${allowed.join(", ")}`
    );
  }

  return {
    ...ctx,
    ...updates,
    currentState: to,
    previousState: ctx.currentState,
    retryCount: to.includes("error") ? ctx.retryCount + 1 : ctx.retryCount,
  };
}

export function isTerminalState(state: ChatState): boolean {
  return state === "done" || state.startsWith("error");
}

export function isActiveState(state: ChatState): boolean {
  return !["idle", "user_typing", "done"].includes(state) && !state.startsWith("error");
}
