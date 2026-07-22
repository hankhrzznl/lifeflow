"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import { ChevronLeft, Bot, Trash2, Mic, X as XIcon } from "lucide-react";
import { useAgent } from "@/components/agent/AgentProvider";
import type { AgentMessage as AgentMsgType, SuggestionCardData } from "@/lib/agent-state";
import { AgentMessage } from "@/components/agent/AgentMessage";
import { TypingIndicator } from "@/components/agent/TypingIndicator";
import { AgentInput } from "@/components/agent/AgentInput";

// ─── 语音识别 Hook ────────────────────────────────────────────
function useVoice(onResult: (text: string) => void) {
  const [listening, setListening] = useState(false);
  const [supported, setSupported] = useState(false);
  const recognitionRef = useRef<any>(null);

  useEffect(() => {
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (SpeechRecognition) setSupported(true);
  }, []);

  const start = useCallback(() => {
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SpeechRecognition) return;
    const rec = new SpeechRecognition();
    rec.lang = "zh-CN";
    rec.interimResults = false;
    rec.continuous = false;
    rec.onresult = (e: any) => {
      const text = e.results[0][0].transcript;
      if (text) onResult(text);
    };
    rec.onerror = () => setListening(false);
    rec.onend = () => setListening(false);
    rec.start();
    setListening(true);
    recognitionRef.current = rec;
  }, [onResult]);

  const stop = useCallback(() => {
    recognitionRef.current?.stop();
    setListening(false);
  }, []);

  return { listening, supported, start, stop };
}

// ─── 时间格式化 ────────────────────────────────────────────────
function formatTime(ts: number) {
  const d = new Date(ts);
  return `${d.getHours().toString().padStart(2, "0")}:${d.getMinutes().toString().padStart(2, "0")}`;
}

// ─── 主组件 ────────────────────────────────────────────────────
export default function AssistantPage() {
  const router = useRouter();
  const { messages, state: stateCtx, closeChat } = useAgent();
  const [historyCleared, setHistoryCleared] = useState(false);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  // 语音识别
  const handleVoiceResult = useCallback((text: string) => {
    // Auto-send: need to access handleSubmit from AgentProvider
    // We'll use a global event approach - dispatch a custom event
    window.dispatchEvent(new CustomEvent("lifeflow:sendMessage", { detail: text }));
  }, []);

  const { listening, supported, start: startVoice, stop: stopVoice } = useVoice(handleVoiceResult);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, stateCtx.currentState]);

  const isProcessing =
    stateCtx.currentState === "sending" ||
    stateCtx.currentState === "tool_calling" ||
    stateCtx.currentState === "confirming";

  const showTyping = stateCtx.currentState === "tool_calling" || stateCtx.currentState === "waiting_llm";

  const displayMessages = historyCleared ? [] : messages;

  return (
    <div className="flex flex-col h-screen max-w-[430px] mx-auto" style={{ background: "var(--lifeflow-background)" }}>
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3" style={{ borderBottom: "1px solid var(--lifeflow-border)" }}>
        <div className="flex items-center gap-2.5">
          <button onClick={() => router.back()} className="flex items-center justify-center w-8 h-8 rounded-lg active:opacity-60" style={{ background: "var(--color-surface-card)", border: "1px solid var(--lifeflow-border)" }}>
            <ChevronLeft className="w-5 h-5" style={{ color: "var(--color-text-primary)" }} />
          </button>
          <div className="w-8 h-8 rounded-full flex items-center justify-center" style={{ background: "var(--lifeflow-primary)" }}>
            <Bot className="w-5 h-5 text-white" />
          </div>
          <div>
            <span className="text-[15px] font-semibold" style={{ color: "var(--color-text-primary)" }}>LifeFlow 助手</span>
            <div className="flex items-center gap-1">
              <span className="w-1.5 h-1.5 rounded-full" style={{ background: isProcessing ? "var(--state-warning)" : "#34C759" }} />
              <span className="text-[10px]" style={{ color: "var(--color-text-secondary)" }}>
                {isProcessing ? "处理中" : "在线"}
              </span>
            </div>
          </div>
        </div>
        <div className="flex items-center gap-1">
          {messages.length > 1 && (
            <button onClick={() => setHistoryCleared(true)} className="w-8 h-8 rounded-lg flex items-center justify-center active:opacity-60" style={{ color: "var(--color-text-secondary)" }} title="清除对话">
              <Trash2 className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-4 py-4 space-y-1">
        {displayMessages.length === 0 && (
          <div className="flex flex-col items-center justify-center h-full text-center px-6">
            <div className="w-16 h-16 rounded-2xl flex items-center justify-center mb-4" style={{ background: "var(--lifeflow-brand-50)" }}>
              <Bot className="w-8 h-8" style={{ color: "var(--lifeflow-primary)" }} />
            </div>
            <h2 className="text-[18px] font-semibold mb-2" style={{ color: "var(--color-text-primary)" }}>你好，我是 LifeFlow 助手</h2>
            <p className="text-[13px] leading-relaxed mb-6" style={{ color: "var(--color-text-secondary)" }}>
              一个入口，操作所有模块。试试对我说：
            </p>
            <div className="grid grid-cols-2 gap-2 w-full max-w-[320px]">
              {["今天有什么提醒？", "帮我排一下日程", "复盘一下这周", "记录喝水200ml"].map((q) => (
                <button
                  key={q}
                  onClick={() => window.dispatchEvent(new CustomEvent("lifeflow:sendMessage", { detail: q }))}
                  className="px-3 py-2 rounded-xl text-[12px] text-left active:opacity-70"
                  style={{ background: "var(--color-surface-card)", color: "var(--color-text-secondary)", boxShadow: "var(--shadow-card)" }}
                >
                  「{q}」
                </button>
              ))}
            </div>
          </div>
        )}

        {displayMessages.map((msg) => (
          <AgentMessage
            key={msg.id}
            role={msg.role}
            content={msg.content}
            timestamp={msg.timestamp}
            isError={msg.isError}
            suggestions={msg.suggestions}
            onAcceptSuggestion={() => {}}
            onModifySuggestion={() => {}}
            onRejectSuggestion={() => {}}
            isProcessing={isProcessing}
          />
        ))}
        {showTyping && <TypingIndicator />}
        <div ref={messagesEndRef} />
      </div>

      {/* Input Area */}
      <div style={{ borderTop: "1px solid var(--lifeflow-border)", padding: 12 }}>
        <AgentInput
          onSend={(text) => window.dispatchEvent(new CustomEvent("lifeflow:sendMessage", { detail: text }))}
          disabled={isProcessing}
          placeholder={listening ? "正在聆听..." : "输入你的需求，或点击麦克风语音输入..."}
        />
        <div className="flex items-center justify-between px-1 mt-2">
          <span className="text-[10px]" style={{ color: "var(--color-text-disabled)" }}>
            数据仅本地处理
          </span>
          {supported && (
            <button
              onClick={listening ? stopVoice : startVoice}
              className={`w-8 h-8 rounded-full flex items-center justify-center active:opacity-70 ${listening ? "animate-pulse" : ""}`}
              style={{ background: listening ? "var(--state-error)" : "var(--lifeflow-muted)", color: listening ? "#fff" : "var(--color-text-secondary)" }}
            >
              {listening ? <XIcon className="w-4 h-4" /> : <Mic className="w-4 h-4" />}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
