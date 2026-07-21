"use client";

import { useState, useRef, useCallback, useEffect } from "react";
import { Send } from "lucide-react";

interface AgentInputProps {
  onSend: (text: string) => void;
  disabled?: boolean;
  placeholder?: string;
}

export function AgentInput({
  onSend,
  disabled = false,
  placeholder = "输入你的需求...",
}: AgentInputProps) {
  const [value, setValue] = useState("");
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const adjustHeight = useCallback(() => {
    const el = textareaRef.current;
    if (el) {
      el.style.height = "auto";
      el.style.height = `${Math.min(el.scrollHeight, 120)}px`;
    }
  }, []);

  useEffect(() => {
    adjustHeight();
  }, [value, adjustHeight]);

  useEffect(() => {
    if (!disabled) {
      textareaRef.current?.focus();
    }
  }, [disabled]);

  const handleSend = () => {
    const trimmed = value.trim();
    if (!trimmed || disabled) return;
    onSend(trimmed);
    setValue("");
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  return (
    <div className="border-t border-zinc-200 dark:border-zinc-700 p-3">
      <div className="flex items-end gap-2 bg-zinc-100 dark:bg-zinc-800 rounded-2xl px-3 py-2">
        <textarea
          ref={textareaRef}
          value={value}
          onChange={(e) => setValue(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder={placeholder}
          disabled={disabled}
          rows={1}
          className="flex-1 resize-none bg-transparent text-sm text-zinc-800 dark:text-zinc-200 placeholder-zinc-400 focus:outline-none max-h-[120px] disabled:opacity-50"
        />
        <button
          onClick={handleSend}
          disabled={disabled || !value.trim()}
          className="w-8 h-8 rounded-xl text-white flex items-center justify-center flex-shrink-0 hover:opacity-90 disabled:opacity-30 disabled:cursor-not-allowed transition-all"
          style={{ background: "var(--lifeflow-primary)" }}
        >
          <Send className="w-4 h-4" />
        </button>
      </div>
      <p className="text-center text-[10px] text-zinc-400 mt-2">
        AI 辅助本地处理，数据不会上传到云端
      </p>
    </div>
  );
}
