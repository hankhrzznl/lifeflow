"use client";

import { useRef, useCallback, useState } from "react";
import type { SuggestionCardData } from "@/lib/agent-state";
import { SuggestionCard } from "./SuggestionCard";
import { motion, AnimatePresence } from "framer-motion";
import { Undo2, Pencil } from "lucide-react";

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
  /** Whether this is the last user message (eligible for undo/edit) */
  isLastUserMessage?: boolean;
  onUndo?: () => void;
  onEdit?: () => void;
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
  isLastUserMessage,
  onUndo,
  onEdit,
}: AgentMessageProps) {
  const [showActions, setShowActions] = useState(false);
  const [editing, setEditing] = useState(false);
  const [editText, setEditText] = useState(content);
  const pressTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const longPressed = useRef(false);

  const startPress = useCallback(() => {
    if (!isLastUserMessage || !onUndo || !onEdit) return;
    longPressed.current = false;
    pressTimer.current = setTimeout(() => {
      longPressed.current = true;
      setShowActions(true);
    }, 500);
  }, [isLastUserMessage, onUndo, onEdit]);

  const cancelPress = useCallback(() => {
    if (pressTimer.current) clearTimeout(pressTimer.current);
  }, []);

  const handleUndo = useCallback(() => {
    setShowActions(false);
    onUndo?.();
  }, [onUndo]);

  const startEdit = useCallback(() => {
    setShowActions(false);
    setEditText(content);
    setEditing(true);
  }, [content]);

  const confirmEdit = useCallback(() => {
    if (!editText.trim()) return;
    setEditing(false);
    onEdit?.();
    // Dispatch to re-send
    window.dispatchEvent(new CustomEvent("lifeflow:editMessage", { detail: editText.trim() }));
  }, [editText, onEdit]);

  if (role === "user") {
    return (
      <div className="flex justify-end mb-4 px-1">
        <div className="max-w-[85%] flex flex-col items-end relative">
          <button
            type="button"
            onPointerDown={startPress}
            onPointerUp={cancelPress}
            onPointerLeave={cancelPress}
            className="px-4 py-2.5 rounded-2xl rounded-br-sm text-white text-sm leading-relaxed text-left select-none"
            style={{ background: "var(--lifeflow-primary)" }}
          >
            {content}
          </button>

          {/* Action Sheet: Undo / Edit */}
          <AnimatePresence>
            {showActions && (
              <>
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  className="fixed inset-0 z-50 bg-black/20"
                  onClick={() => setShowActions(false)}
                />
                <motion.div
                  initial={{ opacity: 0, y: 60 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: 60 }}
                  transition={{ duration: 0.2 }}
                  className="fixed bottom-0 left-0 right-0 z-50 mx-auto max-w-[430px] p-4"
                  style={{ background: "var(--color-surface-card)", borderRadius: "20px 20px 0 0", boxShadow: "0 -4px 24px rgba(0,0,0,0.1)" }}
                >
                  <div className="w-8 h-1 rounded-full bg-zinc-300 dark:bg-zinc-600 mx-auto mb-4" />
                  <button
                    onClick={handleUndo}
                    className="w-full flex items-center gap-3 px-4 py-3 rounded-xl text-left active:bg-zinc-100 dark:active:bg-zinc-800"
                  >
                    <Undo2 className="w-5 h-5" style={{ color: "var(--state-error)" }} />
                    <span className="text-[15px] font-medium" style={{ color: "var(--state-error)" }}>撤回</span>
                  </button>
                  <button
                    onClick={startEdit}
                    className="w-full flex items-center gap-3 px-4 py-3 rounded-xl text-left active:bg-zinc-100 dark:active:bg-zinc-800"
                  >
                    <Pencil className="w-5 h-5" style={{ color: "var(--lifeflow-primary)" }} />
                    <span className="text-[15px] font-medium" style={{ color: "var(--color-text-primary)" }}>编辑</span>
                  </button>
                  <button
                    onClick={() => setShowActions(false)}
                    className="w-full flex items-center justify-center px-4 py-3 rounded-xl text-left mt-2 active:bg-zinc-100 dark:active:bg-zinc-800"
                  >
                    <span className="text-[14px]" style={{ color: "var(--color-text-secondary)" }}>取消</span>
                  </button>
                  <div style={{ height: "var(--bottom-nav-height, 83px)" }} />
                </motion.div>
              </>
            )}
          </AnimatePresence>

          {/* Edit Input */}
          <AnimatePresence>
            {editing && (
              <motion.div
                initial={{ opacity: 0, y: -8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -8 }}
                className="w-full mt-2 flex gap-2"
              >
                <input
                  autoFocus
                  value={editText}
                  onChange={(e) => setEditText(e.target.value)}
                  onKeyDown={(e) => { if (e.key === "Enter") confirmEdit(); if (e.key === "Escape") setEditing(false); }}
                  className="flex-1 px-3 py-2 rounded-xl text-sm border outline-none"
                  style={{
                    background: "var(--color-surface-card)",
                    borderColor: "var(--lifeflow-primary)",
                    color: "var(--color-text-primary)",
                  }}
                />
                <button
                  onClick={confirmEdit}
                  className="px-3 py-2 rounded-xl text-sm font-medium text-white"
                  style={{ background: "var(--lifeflow-primary)" }}
                >
                  发送
                </button>
              </motion.div>
            )}
          </AnimatePresence>

          <span className="text-[10px] text-zinc-400 mt-1">
            {formatTime(timestamp)}
          </span>
        </div>
      </div>
    );
  }

  return (
    <div className="flex items-start gap-2 mb-4 max-w-[85%] px-1">
      <div className="w-7 h-7 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5" style={{ background: "var(--lifeflow-primary)" }}>
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
