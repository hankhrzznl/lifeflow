"use client";

import Link from "next/link";
import { CalendarCheck, Timer, Clock, StickyNote, CalendarDays } from "lucide-react";

const modules = [
  { id: "habits", icon: CalendarCheck, label: "习惯打卡", desc: "每日坚持", color: "#AF52DE", href: "/more/habits" },
  { id: "focus", icon: Timer, label: "专注计时", desc: "番茄钟", color: "#FF9500", href: "/more/focus" },
  { id: "countdown", icon: Clock, label: "倒数日", desc: "重要日子", color: "#FF3B30", href: "/more/countdown" },
  { id: "notes", icon: StickyNote, label: "备忘录", desc: "灵感记录", color: "#34C759", href: "/more/notes" },
  { id: "calendar", icon: CalendarDays, label: "日历视图", desc: "日程一览", color: "#007AFF", href: "/more/calendar" },
];

export default function MorePage() {
  return (
    <div className="px-4 pt-5 pb-6">
      <h1 className="text-[34px] font-bold tracking-[-0.02em] leading-tight mb-1">更多</h1>
      <p className="text-[15px] mb-4" style={{ color: "#8E8E93" }}>全部功能入口</p>
      <div className="grid grid-cols-2 gap-3">
        {modules.map((m) => (
          <Link key={m.id} href={m.href}
            className="rounded-xl bg-white p-4 shadow-[0_1px_4px_rgba(0,0,0,0.04)]">
            <div className="w-10 h-10 rounded-xl flex items-center justify-center mb-2" style={{ background: `${m.color}16` }}>
              <m.icon className="w-5 h-5" style={{ color: m.color }} />
            </div>
            <div className="text-[15px] font-semibold">{m.label}</div>
            <div className="text-[13px] mt-0.5" style={{ color: "#8E8E93" }}>{m.desc}</div>
          </Link>
        ))}
      </div>
    </div>
  );
}
