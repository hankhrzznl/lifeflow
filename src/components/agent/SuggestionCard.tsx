"use client";

import { useState } from "react";
import { Check, Pencil, X, Save } from "lucide-react";
import type { SuggestionCardData } from "@/lib/agent-state";

interface SuggestionCardProps {
  suggestion: SuggestionCardData;
  onAccept?: () => void;
  onModify?: (title: string) => void;
  onReject?: () => void;
}

function formatTimeRange(start: number, end: number): string {
  const format = (ts: number) =>
    new Date(ts).toLocaleTimeString("zh-CN", { hour: "2-digit", minute: "2-digit" });
  return `${format(start)} - ${format(end)}`;
}

export function SuggestionCard({
  suggestion,
  onAccept,
  onModify,
  onReject,
}: SuggestionCardProps) {
  const [editing, setEditing] = useState(false);
  const [editTitle, setEditTitle] = useState(suggestion.title);
  const [accepting, setAccepting] = useState(false);

  const handleAccept = async () => {
    setAccepting(true);
    await onAccept?.();
    setAccepting(false);
  };

  const handleSaveEdit = () => {
    if (editTitle.trim()) {
      onModify?.(editTitle.trim());
      setEditing(false);
    }
  };

  if (editing) {
    return (
      <div className="p-3 rounded-xl border border-violet-200 dark:border-violet-800 bg-violet-50 dark:bg-violet-900/20">
        <label className="text-[10px] text-zinc-500 dark:text-zinc-400 mb-1 block">
          修改标题
        </label>
        <input
          type="text"
          value={editTitle}
          onChange={(e) => setEditTitle(e.target.value)}
          className="w-full px-3 py-2 rounded-lg border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-sm text-zinc-800 dark:text-zinc-200 focus:outline-none focus:border-violet-400"
          autoFocus
          onKeyDown={(e) => {
            if (e.key === "Enter") handleSaveEdit();
            if (e.key === "Escape") setEditing(false);
          }}
        />
        <div className="flex gap-2 mt-2">
          <button
            onClick={handleSaveEdit}
            className="flex-1 px-3 py-1.5 rounded-lg bg-violet-600 text-white text-xs font-medium hover:bg-violet-700 transition-colors flex items-center justify-center gap-1"
          >
            <Save className="w-3 h-3" />
            保存
          </button>
          <button
            onClick={() => {
              setEditTitle(suggestion.title);
              setEditing(false);
            }}
            className="flex-1 px-3 py-1.5 rounded-lg bg-white dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 text-zinc-600 dark:text-zinc-400 text-xs font-medium hover:bg-zinc-50 dark:hover:bg-zinc-700 transition-colors"
          >
            取消
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="p-3 rounded-xl border border-violet-200 dark:border-violet-800 bg-violet-50 dark:bg-violet-900/20">
      <p className="font-medium text-sm text-zinc-800 dark:text-zinc-200 mb-1">
        {suggestion.title}
      </p>
      <p className="text-xs text-zinc-500 dark:text-zinc-400 mb-2">
        {formatTimeRange(suggestion.proposedStartTime, suggestion.proposedEndTime)}
      </p>
      {suggestion.tags.length > 0 && (
        <div className="flex flex-wrap gap-1 mb-2">
          {suggestion.tags.map((tag) => (
            <span
              key={tag}
              className="px-2 py-0.5 rounded-full bg-violet-100 dark:bg-violet-800/50 text-violet-600 dark:text-violet-300 text-[10px] font-medium"
            >
              {tag}
            </span>
          ))}
        </div>
      )}
      <div className="flex gap-2">
        <button
          onClick={handleAccept}
          disabled={accepting}
          className="flex-1 px-3 py-1.5 rounded-lg bg-violet-600 text-white text-xs font-medium hover:bg-violet-700 disabled:opacity-50 transition-colors flex items-center justify-center gap-1 active:scale-[0.98]"
        >
          <Check className="w-3 h-3" />
          {accepting ? "采纳中..." : "采纳"}
        </button>
        <button
          onClick={() => setEditing(true)}
          className="px-3 py-1.5 rounded-lg bg-white dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 text-zinc-600 dark:text-zinc-400 text-xs font-medium hover:bg-zinc-50 dark:hover:bg-zinc-700 transition-colors flex items-center gap-1"
        >
          <Pencil className="w-3 h-3" />
          修改
        </button>
        <button
          onClick={onReject}
          className="px-3 py-1.5 rounded-lg bg-white dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 text-zinc-600 dark:text-zinc-400 text-xs font-medium hover:bg-zinc-50 dark:hover:bg-zinc-700 transition-colors"
        >
          <X className="w-3 h-3" />
        </button>
      </div>
    </div>
  );
}
