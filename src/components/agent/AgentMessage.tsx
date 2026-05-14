"use client";

import type { SuggestionCardData } from "@/lib/agent-state";
import { SuggestionCard } from "./SuggestionCard";

interface AgentMessageProps {
  role: "user" | "assistant" | "system";
  content: string;
  timestamp: number;
  isError?: boolean;
  suggestions?: SuggestionCardData[];
  onAcceptSuggestion?: (suggestion: SuggestionCardData) => void;
  onModifySuggestion?: (suggestion: SuggestionCardData, newTitle: string) => void;
  onRejectSuggestion?: (suggestion: SuggestionCardData) => void;
  isProcessing?: boolean;
}

function formatTime(ts: number): string {
  const d = new Date(ts);
  return d.toLocaleTimeString("zh-CN", { hour: "2-digit", minute: "2-digit" });
}

export function AgentMessage({
  role,
  content,
  timestamp,
  isError,
  suggestions,
  onAcceptSuggestion,
  onModifySuggestion,
  onRejectSuggestion,
  isProcessing,
}: AgentMessageProps) {
  if (role === "user") {
    return (
      <div className="flex justify-end mb-4 px-1">
        <div className="max-w-[85%] flex flex-col items-end">
          <div className="px-4 py-2.5 rounded-2xl rounded-br-sm bg-gradient-to-br from-violet-500 to-blue-600 text-white text-sm leading-relaxed">
            {content}
          </div>
          <span className="text-[10px] text-zinc-400 mt-1">
            {formatTime(timestamp)}
          </span>
        </div>
      </div>
    );
  }

  return (
    <div className="flex items-start gap-2 mb-4 max-w-[85%] px-1">
      <div className="w-7 h-7 rounded-full bg-gradient-to-br from-violet-400 to-blue-500 flex items-center justify-center flex-shrink-0 mt-0.5">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M12 2L9.7 8.5L3 9.7L8.3 14.7L7 21L12 17.5L17 21L15.7 14.7L21 9.7L14.3 8.5L12 2Z" fill="white" />
        </svg>
      </div>
      <div className="flex-1 min-w-0">
        <div
          className={`px-4 py-2.5 rounded-2xl rounded-tl-sm text-sm leading-relaxed ${
            isError
              ? "bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-300 border border-red-200 dark:border-red-800"
              : "bg-zinc-100 dark:bg-zinc-800 text-zinc-800 dark:text-zinc-200"
          }`}
        >
          {content}
        </div>
        {suggestions && suggestions.length > 0 && !isProcessing && (
          <div className="mt-2 space-y-2">
            {suggestions.map((sugg) => (
              <SuggestionCard
                key={sugg.id}
                suggestion={sugg}
                onAccept={() => onAcceptSuggestion?.(sugg)}
                onModify={(title: string) => onModifySuggestion?.(sugg, title)}
                onReject={() => onRejectSuggestion?.(sugg)}
              />
            ))}
          </div>
        )}
        <span className="text-[10px] text-zinc-400 ml-1">
          {formatTime(timestamp)}
        </span>
      </div>
    </div>
  );
}
