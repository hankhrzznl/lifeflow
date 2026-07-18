"use client";

import { useEffect, useState, useCallback, createContext, useContext, useRef } from "react";
import { usePathname } from "next/navigation";
import type {
  ChatStateContext,
  AgentMessage,
  SuggestionCardData,
} from "@/lib/agent-state";
import {
  createInitialContext,
  transitionState,
} from "@/lib/agent-state";
import {
  localParseCapture,
  localSuggestPlan,
  localGetTodayStats,
  getWelcomeMessage,
} from "@/lib/agent-core";
import {
  loadChatHistory,
  saveChatSession,
  clearChatHistory,
  getActiveChatSession,
  createEmptySession,
} from "@/lib/agent-db";
import { db, createEvent } from "@/lib/db";
import { AgentChat } from "./AgentChat";

interface AgentContextType {
  open: boolean;
  state: ChatStateContext;
  messages: AgentMessage[];
  toggleOpen: () => void;
  openChat: () => void;
  closeChat: () => void;
}

const AgentContext = createContext<AgentContextType | null>(null);

export function useAgent() {
  const ctx = useContext(AgentContext);
  if (!ctx) throw new Error("useAgent must be used within AgentProvider");
  return ctx;
}

const SESSION_ID = "default-agent-session";

function generateId(): string {
  return `msg-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

export function AgentProvider({ children }: { children: React.ReactNode }) {
  const [stateCtx, setStateCtx] = useState<ChatStateContext>(createInitialContext);
  const [messages, setMessages] = useState<AgentMessage[]>([]);
  const [open, setOpen] = useState(false);
  const pathname = usePathname();
  const processingRef = useRef(false);
  const doneTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const isHiddenPage =
    pathname === "/focus" || pathname.startsWith("/settings");

  useEffect(() => {
    if (isHiddenPage && open) {
      setOpen(false);
    }
  }, [pathname, isHiddenPage, open]);

  useEffect(() => {
    const init = async () => {
      const session = await getActiveChatSession();
      if (session && session.messages.length > 0) {
        setMessages(session.messages.map((m) => ({
          id: generateId(),
          role: m.role,
          content: m.content,
          timestamp: m.timestamp,
          isError: m.isError,
        })));
      } else {
        const welcome: AgentMessage = {
          id: generateId(),
          role: "assistant",
          content: getWelcomeMessage(),
          timestamp: Date.now(),
        };
        setMessages([welcome]);
      }
    };
    init();
  }, []);

  useEffect(() => {
    if (doneTimerRef.current) {
      clearTimeout(doneTimerRef.current);
    }
    if (stateCtx.currentState === "done") {
      doneTimerRef.current = setTimeout(() => {
        setStateCtx((prev) => ({ ...prev, currentState: "idle", previousState: "done" }));
      }, 2000);
    }
    return () => {
      if (doneTimerRef.current) clearTimeout(doneTimerRef.current);
    };
  }, [stateCtx.currentState]);

  const persistSession = useCallback(async (msgs: AgentMessage[]) => {
    const session = (await loadChatHistory(SESSION_ID)) || createEmptySession(SESSION_ID);
    session.messages = msgs.map((m) => ({
      role: m.role,
      content: m.content,
      timestamp: m.timestamp,
      toolCall: m.toolCall ? JSON.stringify(m.toolCall) : undefined,
      isError: m.isError,
    }));
    session.updatedAt = Date.now();
    await saveChatSession(session);
  }, []);

  const addAssistantMessage = useCallback(
    (content: string, suggestions?: SuggestionCardData[], isError?: boolean) => {
      const msg: AgentMessage = {
        id: generateId(),
        role: "assistant",
        content,
        timestamp: Date.now(),
        suggestions,
        isError,
      };
      setMessages((prev) => [...prev, msg]);
      return msg;
    },
    []
  );

  const handleSubmit = useCallback(
    async (text: string) => {
      if (processingRef.current) return;
      processingRef.current = true;

      const userMsg: AgentMessage = {
        id: generateId(),
        role: "user",
        content: text,
        timestamp: Date.now(),
      };

      setMessages((prev) => [...prev, userMsg]);
      setStateCtx((prev) =>
        transitionState(prev, "sending", { currentMessageId: userMsg.id })
      );

      setStateCtx((prev) => transitionState(prev, "waiting_llm"));

      const lowerText = text.toLowerCase();
      let toolName = "";

      if (
        lowerText.includes("统计") ||
        lowerText.includes("专注了") ||
        lowerText.includes("今天") ||
        lowerText.includes("进度") ||
        lowerText.includes("多久")
      ) {
        toolName = "get_today_stats";
      } else if (
        lowerText.includes("规划") ||
        lowerText.includes("安排") ||
        lowerText.includes("排程") ||
        lowerText.includes("计划") ||
        lowerText.includes("帮我")
      ) {
        toolName = "suggest_plan";
      } else if (
        /点|到|下午|上午|明天|后天|晚上|早上/.test(text)
      ) {
        toolName = "parse_capture";
      }

      try {
        if (toolName === "parse_capture") {
          setStateCtx((prev) => transitionState(prev, "tool_calling"));

          const parsed = localParseCapture(text);

          if (parsed.confidence < 0.4) {
            const msg = addAssistantMessage(
              parsed.title
                ? `我理解你想记录："${parsed.title}"，但无法确定具体时间。是想记到收件箱，还是让我建议一个时间？`
                : "没能理解你的意思。你可以试试这样说：\n• 「明天下午3点到5点写提案」\n• 「帮我规划今天」\n• 「我今天专注了多久」"
            );
            setStateCtx((prev) => transitionState(prev, "done"));
            processingRef.current = false;
            await persistSession([...messages, userMsg, msg]);
            return;
          }

          const suggestions: SuggestionCardData[] = [
            {
              id: `sugg-${Date.now()}`,
              title: parsed.title,
              proposedStartTime: parsed.startTime || Date.now(),
              proposedEndTime: parsed.endTime || Date.now() + 3600000,
              tags: parsed.tags,
              confidence: parsed.confidence,
            },
          ];

          setStateCtx((prev) =>
            transitionState(prev, "confirming", { suggestions })
          );

          addAssistantMessage(
            `已为你解析日程：\n\n📌 **${parsed.title}**\n🕐 ${
              parsed.startTime
                ? new Date(parsed.startTime).toLocaleTimeString("zh-CN", {
                    hour: "2-digit",
                    minute: "2-digit",
                  })
                : "待定"
            } - ${
              parsed.endTime
                ? new Date(parsed.endTime).toLocaleTimeString("zh-CN", {
                    hour: "2-digit",
                    minute: "2-digit",
                  })
                : "待定"
            }\n\n置信度: ${Math.round(parsed.confidence * 100)}%`,
            suggestions
          );
        } else if (toolName === "suggest_plan") {
          setStateCtx((prev) => transitionState(prev, "tool_calling"));

          const result = await localSuggestPlan();

          if (result.suggestions.length === 0) {
            const msg = addAssistantMessage(result.message);
            setStateCtx((prev) => transitionState(prev, "done"));
            processingRef.current = false;
            await persistSession([...messages, userMsg, msg]);
            return;
          }

          setStateCtx((prev) =>
            transitionState(prev, "confirming", { suggestions: result.suggestions })
          );

          addAssistantMessage(result.message, result.suggestions);
        } else if (toolName === "get_today_stats") {
          setStateCtx((prev) => transitionState(prev, "tool_calling"));

          const stats = await localGetTodayStats();
          const msg = addAssistantMessage(stats.message);
          setStateCtx((prev) => transitionState(prev, "done"));
          processingRef.current = false;
          await persistSession([...messages, userMsg, msg]);
          return;
        } else {
          const msg = addAssistantMessage(
            "你可以试试这样说：\n• 「明天下午3点到5点写提案」— 解析日程\n• 「帮我规划今天」— 智能排程\n• 「我今天专注了多久」— 查看进度\n\n需要我帮你做点什么？"
          );
          setStateCtx((prev) => transitionState(prev, "done"));
          processingRef.current = false;
          await persistSession([...messages, userMsg, msg]);
          return;
        }
      } catch (err) {
        const errorMsg =
          err instanceof Error ? err.message : "处理失败，请重试";
        const msg = addAssistantMessage(errorMsg, undefined, true);
        setStateCtx((prev) =>
          transitionState(prev, "error_tool", { lastError: err instanceof Error ? err : new Error(errorMsg) })
        );
        processingRef.current = false;
        await persistSession([...messages, userMsg, msg]);
        return;
      }

      processingRef.current = false;
    },
    [messages, addAssistantMessage, persistSession]
  );

  const handleAcceptSuggestion = useCallback(
    async (suggestion: SuggestionCardData) => {
      setStateCtx((prev) => transitionState(prev, "executing"));

      try {
        await db.transaction("rw", db.events, db.capture, async () => {
          await createEvent({
            title: suggestion.title,
            startTime: suggestion.proposedStartTime,
            endTime: suggestion.proposedEndTime,
            tags: suggestion.tags,
            planned: true,
            focusSessions: [],
          });

          if (suggestion.captureId) {
            await db.capture.update(suggestion.captureId, { status: "planned" });
          }
        });

        const msg = addAssistantMessage(`已将"${suggestion.title}"添加到规划！`);
        setStateCtx((prev) => transitionState(prev, "done"));
        await persistSession([
          ...messages,
          {
            id: generateId(),
            role: "user",
            content: `采纳建议: ${suggestion.title}`,
            timestamp: Date.now(),
          },
          msg,
        ]);
      } catch (err) {
        const errorMsg =
          err instanceof Error ? err.message : "保存失败，请重试";
        addAssistantMessage(errorMsg, undefined, true);
        setStateCtx((prev) =>
          transitionState(prev, "error_tool", {
            lastError: err instanceof Error ? err : new Error(errorMsg),
          })
        );
      }
    },
    [messages, addAssistantMessage, persistSession]
  );

  const handleModifySuggestion = useCallback(
    async (suggestion: SuggestionCardData, newTitle: string) => {
      setStateCtx((prev) => transitionState(prev, "executing"));

      try {
        await db.transaction("rw", db.events, db.capture, async () => {
          await createEvent({
            title: newTitle,
            startTime: suggestion.proposedStartTime,
            endTime: suggestion.proposedEndTime,
            tags: suggestion.tags,
            planned: true,
            focusSessions: [],
          });

          if (suggestion.captureId) {
            await db.capture.update(suggestion.captureId, { status: "planned" });
          }
        });

        const msg = addAssistantMessage(`已将"${newTitle}"添加到规划！`);
        setStateCtx((prev) => transitionState(prev, "done"));
        await persistSession([
          ...messages,
          {
            id: generateId(),
            role: "user",
            content: `修改并采纳: ${newTitle}`,
            timestamp: Date.now(),
          },
          msg,
        ]);
      } catch (err) {
        const errorMsg =
          err instanceof Error ? err.message : "保存失败，请重试";
        addAssistantMessage(errorMsg, undefined, true);
        setStateCtx((prev) =>
          transitionState(prev, "error_tool", {
            lastError: err instanceof Error ? err : new Error(errorMsg),
          })
        );
      }
    },
    [messages, addAssistantMessage, persistSession]
  );

  const handleRejectSuggestion = useCallback(
    async (suggestion: SuggestionCardData) => {
      const msg = addAssistantMessage("好的，如有需要随时告诉我。");
      setStateCtx((prev) => transitionState(prev, "done"));
      await persistSession([
        ...messages,
        {
          id: generateId(),
          role: "user",
          content: `拒绝建议: ${suggestion.title}`,
          timestamp: Date.now(),
        },
        msg,
      ]);
    },
    [messages, addAssistantMessage, persistSession]
  );

  const handleClearHistory = useCallback(async () => {
    await clearChatHistory(SESSION_ID);
    const welcome: AgentMessage = {
      id: generateId(),
      role: "assistant",
      content: getWelcomeMessage(),
      timestamp: Date.now(),
    };
    setMessages([welcome]);
    setStateCtx(createInitialContext());
  }, []);

  const handleRetry = useCallback(() => {
    if (messages.length >= 2) {
      const lastUserMsg = messages
        .slice()
        .reverse()
        .find((m) => m.role === "user");
      if (lastUserMsg) {
        setMessages((prev) => prev.filter((m) => !m.isError));
        setStateCtx(createInitialContext());
        handleSubmit(lastUserMsg.content);
      }
    }
  }, [messages, handleSubmit]);

  const value: AgentContextType = {
    open,
    state: stateCtx,
    messages,
    toggleOpen: () => setOpen((v) => !v),
    openChat: () => setOpen(true),
    closeChat: () => setOpen(false),
  };

  return (
    <AgentContext.Provider value={value}>
      {children}
      {!isHiddenPage && (
        <AgentChat
          open={open}
          onClose={() => setOpen(false)}
          messages={messages}
          state={stateCtx.currentState}
          onSubmit={handleSubmit}
          onAcceptSuggestion={handleAcceptSuggestion}
          onModifySuggestion={handleModifySuggestion}
          onRejectSuggestion={handleRejectSuggestion}
          onClearHistory={handleClearHistory}
          onRetry={handleRetry}
          hasHistory={messages.length > 1}
        />
      )}
    </AgentContext.Provider>
  );
}
