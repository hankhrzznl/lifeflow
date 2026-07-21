"use client";

import { useEffect } from "react";
import { useAgent } from "@/components/agent/AgentProvider";
import {
  Bot,
  MessageSquare,
  Target,
  Wallet,
  Droplets,
  Moon,
  Dumbbell,
  Bell,
} from "lucide-react";

const QUICK_ACTIONS = [
  { icon: Wallet, label: "午餐花了30块", desc: "记账" },
  { icon: Droplets, label: "喝了200ml水", desc: "记录饮水" },
  { icon: Moon, label: "昨晚11点睡的", desc: "记录睡眠" },
  { icon: Dumbbell, label: "卧推3组10次40kg", desc: "记录训练" },
  { icon: Target, label: "创建跑步目标", desc: "目标管理" },
  { icon: Bell, label: "提醒我每天9点喝水", desc: "设置提醒" },
];

export default function AssistantPage() {
  const { openChat, open, messages } = useAgent();

  useEffect(() => {
    // Auto-open chat when navigating to the assistant page
    openChat();
  }, [openChat]);

  if (open) {
    // Chat panel is open as overlay, show a minimal backdrop
    return (
      <div className="min-h-screen max-w-[430px] mx-auto px-4 pt-14 pb-[100px]">
        <div className="flex flex-col items-center justify-center h-[60vh] text-center">
          <div
            className="w-20 h-20 rounded-full flex items-center justify-center mb-6"
            style={{ background: "var(--lifeflow-brand-50)" }}
          >
            <Bot className="w-10 h-10" style={{ color: "var(--lifeflow-primary)" }} />
          </div>
          <h2
            className="text-[17px] font-semibold mb-2"
            style={{ color: "var(--color-text-primary)" }}
          >
            LifeFlow 助手
          </h2>
          <p className="text-[13px] leading-relaxed max-w-[280px]" style={{ color: "var(--color-text-secondary)" }}>
            对话窗口已打开，直接说出你想要做的事情
          </p>
        </div>
      </div>
    );
  }

  // Fallback: chat is closed, show full guide
  return (
    <div className="min-h-screen max-w-[430px] mx-auto px-4 pt-14 pb-[100px]">
      <div className="flex items-center gap-3 mb-8">
        <div
          className="w-12 h-12 rounded-2xl flex items-center justify-center"
          style={{ background: "var(--lifeflow-brand-50)" }}
        >
          <Bot className="w-7 h-7" style={{ color: "var(--lifeflow-primary)" }} />
        </div>
        <div>
          <h1 className="text-[24px] font-bold tracking-[-0.018em]" style={{ color: "var(--color-text-primary)" }}>
            LifeFlow 助手
          </h1>
          <p className="text-[13px]" style={{ color: "var(--color-text-secondary)" }}>
            一个入口，操作所有模块
          </p>
        </div>
      </div>

      <div
        className="rounded-[20px] p-5 mb-8 cursor-pointer active:opacity-70 transition-opacity"
        style={{ background: "var(--color-surface-card)", boxShadow: "var(--shadow-card)" }}
        onClick={openChat}
      >
        <div className="flex items-center gap-3">
          <div
            className="w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0"
            style={{ background: "var(--lifeflow-primary)" }}
          >
            <MessageSquare className="w-5 h-5 text-white" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-[15px] font-medium" style={{ color: "var(--color-text-primary)" }}>
              开始对话
            </p>
            <p className="text-[12px]" style={{ color: "var(--color-text-secondary)" }}>
              点击这里打开助手对话窗口
            </p>
          </div>
        </div>
      </div>

      <h2 className="text-[13px] font-semibold uppercase tracking-wider mb-3" style={{ color: "var(--color-text-disabled)" }}>
        试试这样说
      </h2>
      <div className="flex flex-col gap-2.5">
        {QUICK_ACTIONS.map((action) => (
          <div
            key={action.label}
            className="rounded-[20px] p-4 flex items-center gap-3"
            style={{ background: "var(--color-surface-card)", boxShadow: "var(--shadow-card)" }}
          >
            <div
              className="w-9 h-9 rounded-full flex items-center justify-center flex-shrink-0"
              style={{ background: "var(--lifeflow-brand-50)" }}
            >
              <action.icon className="w-4.5 h-4.5" style={{ color: "var(--lifeflow-primary)" }} />
            </div>
            <div className="min-w-0">
              <p className="text-[14px] font-medium" style={{ color: "var(--color-text-primary)" }}>
                「{action.label}」
              </p>
              <p className="text-[11px] mt-0.5" style={{ color: "var(--color-text-secondary)" }}>
                {action.desc}
              </p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
