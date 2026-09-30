"use client";

import { useEffect, useRef } from "react";
import { X, Trash2 } from "lucide-react";
import type { AgentMessage as AgentMessageType } from "@/lib/agent-state";
import { AgentMessage } from "./AgentMessage";
import { TypingIndicator } from "./TypingIndicator";
import { AgentInput } from "./AgentInput";
import type { SuggestionCardData } from "@/lib/agent-state";

interface AgentChatProps {
  open: boolean;
  onClose: () => void;
  messages: AgentMessageType[];
  state: string;
  onSubmit: (text: string) => void;
  onAcceptSuggestion: (suggestion: SuggestionCardData) => void;
  onModifySuggestion: (suggestion: SuggestionCardData, newTitle: string) => void;
  onRejectSuggestion: (suggestion: SuggestionCardData) => void;
  onClearHistory: () => void;
  onRetry: () => void;
  hasHistory: boolean;
}

export function AgentChat({
  open,
  onClose,
  messages,
  state,
  onSubmit,
  onAcceptSuggestion,
  onModifySuggestion,
  onRejectSuggestion,
  onClearHistory,
  onRetry,
  hasHistory,
}: AgentChatProps) {
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, state]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape" && open) {
        onClose();
      }
    };
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [open, onClose]);

  const isProcessing =
    state === "sending" ||
    state === "waiting_llm" ||
    state === "streaming" ||
    state === "tool_calling" ||
    state === "confirming" ||
    state === "executing";

  const showTyping =
    state === "waiting_llm" || state === "streaming" || state === "tool_calling";

  const inputDisabled = isProcessing;

  const chatContent = (
    <div className="flex flex-col h-full">
      <div className="flex items-center justify-between px-4 py-3 border-b border-zinc-200 dark:border-zinc-700">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-full flex items-center justify-center" style={{ background: "var(--lifeflow-primary)" }}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M12 2L9.7 8.5L3 9.7L8.3 14.7L7 21L12 17.5L17 21L15.7 14.7L21 9.7L14.3 8.5L12 2Z" fill="white" />
            </svg>
          </div>
          <div>
            <span className="text-sm font-semibold text-zinc-800 dark:text-zinc-200">
              LifeFlow 助手
            </span>
            <div className="flex items-center gap-1">
              <span className="w-1.5 h-1.5 rounded-full bg-green-400" />
              <span className="text-[10px] text-zinc-400">在线</span>
            </div>
          </div>
        </div>
        <div className="flex items-center gap-1">
          {hasHistory && (
            <button
              onClick={onClearHistory}
              className="w-8 h-8 rounded-lg hover:bg-zinc-100 dark:hover:bg-zinc-700 flex items-center justify-center text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-300 transition-colors"
              title="清除对话"
            >
              <Trash2 className="w-4 h-4" />
            </button>
          )}
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-lg hover:bg-zinc-100 dark:hover:bg-zinc-700 flex items-center justify-center text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-300 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto px-3 py-4">
        {messages.map((msg) => (
          <AgentMessage
            key={msg.id}
            role={msg.role}
            content={msg.content}
            timestamp={msg.timestamp}
            isError={msg.isError}
            suggestions={msg.suggestions}
            onAcceptSuggestion={onAcceptSuggestion}
            onModifySuggestion={(sugg, newTitle) =>
              onModifySuggestion(sugg, newTitle)
            }
            onRejectSuggestion={onRejectSuggestion}
            isProcessing={isProcessing}
          />
        ))}
        {showTyping && <TypingIndicator />}
        {state?.startsWith("error") && (
          <div className="flex justify-center mb-4">
            <button
              onClick={onRetry}
              className="px-4 py-2 rounded-xl bg-zinc-100 dark:bg-zinc-800 text-sm text-zinc-600 dark:text-zinc-400 hover:bg-zinc-200 dark:hover:bg-zinc-700 transition-colors"
            >
              重试
            </button>
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      <AgentInput
        onSend={onSubmit}
        disabled={inputDisabled}
        placeholder="输入你的需求..."
      />
    </div>
  );

  if (!open) return null;

  return (
    <>
      <div
        className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 md:hidden"
        onClick={onClose}
      />

      <div className="fixed inset-x-0 bottom-0 z-50 md:inset-auto md:bottom-20 md:right-4 md:w-[400px] md:h-[600px] md:rounded-2xl md:border md:border-zinc-200 md:dark:border-zinc-700 md:shadow-2xl md:shadow-black/20 bg-white dark:bg-zinc-900 h-[85vh] rounded-t-2xl md:rounded-2xl overflow-hidden">
        <div className="flex justify-center pt-2 pb-1 md:hidden">
          <div className="w-10 h-1 rounded-full bg-zinc-300 dark:bg-zinc-600" />
        </div>
        {chatContent}
      </div>
    </>
  );
}
