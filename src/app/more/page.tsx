"use client";

import Link from "next/link";
import { Wallet, Droplets, Moon, Dumbbell, CalendarCheck, Timer, Clock, StickyNote, CalendarDays } from "lucide-react";

// ============================================================
// 更多 — 分组卡片入口
// ============================================================

const groups = [
  {
    title: "财务",
    items: [
      { icon: Wallet, label: "记账", desc: "明细·图表·资产·账本", href: "/more/accounting", color: "#6366F1" },
    ],
  },
  {
    title: "健康",
    items: [
      { icon: Droplets, label: "饮水", desc: "喝水追踪", href: "/more/water", color: "#007AFF" },
      { icon: Moon, label: "睡眠", desc: "早睡分析", href: "/more/sleep", color: "#5856D6" },
      { icon: Dumbbell, label: "训练", desc: "力量训练记录", href: "/more/fitness", color: "#FF9500" },
    ],
  },
  {
    title: "工具",
    items: [
      { icon: CalendarCheck, label: "习惯打卡", desc: "每日坚持", href: "/more/habits", color: "#AF52DE" },
      { icon: Timer, label: "专注计时", desc: "番茄钟", href: "/more/focus", color: "#FF9500" },
      { icon: Clock, label: "倒数日", desc: "重要日子", href: "/more/countdown", color: "#FF3B30" },
      { icon: StickyNote, label: "备忘录", desc: "灵感记录", href: "/more/notes", color: "#34C759" },
      { icon: CalendarDays, label: "日历", desc: "日程一览", href: "/more/calendar", color: "#007AFF" },
    ],
  },
];

export default function MorePage() {
  return (
    <div className="px-4 pt-5 pb-6">
      <h1 className="text-[34px] font-bold tracking-[-0.02em] leading-tight mb-1">更多</h1>
      <p className="text-[15px] mb-4" style={{ color: "#8E8E93" }}>全部功能入口</p>

      <div className="flex flex-col gap-4">
        {groups.map((group) => (
          <div key={group.title}>
            <h2 className="text-[13px] font-medium mb-2 uppercase" style={{ color: "#8E8E93" }}>{group.title}</h2>
            <div className="grid grid-cols-2 gap-3">
              {group.items.map((item) => (
                <Link key={item.href} href={item.href}
                  className="rounded-xl bg-white p-4 shadow-[0_1px_4px_rgba(0,0,0,0.04)]">
                  <div className="w-10 h-10 rounded-xl flex items-center justify-center mb-2"
                    style={{ background: `${item.color}16` }}>
                    <item.icon className="w-5 h-5" style={{ color: item.color }} />
                  </div>
                  <div className="text-[15px] font-semibold">{item.label}</div>
                  <div className="text-[13px] mt-0.5" style={{ color: "#8E8E93" }}>{item.desc}</div>
                </Link>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
