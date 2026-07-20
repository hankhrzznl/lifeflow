"use client";

import Link from "next/link";
import {
  GraduationCap,
  Clock,
  FolderKanban,
  Wallet,
  Droplets,
  Moon,
  Dumbbell,
  Pill,
  StretchHorizontal,
  CheckSquare,
  Timer,
  CalendarRange,
  StickyNote,
  Settings,
} from "lucide-react";

// ============================================================

interface FeatureCard {
  title: string;
  description: string;
  href: string;
  icon: React.ComponentType<{ className?: string; style?: React.CSSProperties }>;
}

// ============================================================

export default function MorePage() {
  const sections: { label: string; items: FeatureCard[] }[] = [
    {
      label: "日程管理",
      items: [
        { title: "课程表", description: "管理课程安排", href: "/more/schedule/courses", icon: GraduationCap },
        { title: "作息", description: "设定日常作息", href: "/more/schedule/routines", icon: Clock },
        { title: "项目管理", description: "跟踪项目进度", href: "/more/projects", icon: FolderKanban },
      ],
    },
    {
      label: "财务",
      items: [
        { title: "记账", description: "收支记录与统计", href: "/more/accounting", icon: Wallet },
      ],
    },
    {
      label: "健康",
      items: [
        { title: "饮水", description: "记录每日饮水", href: "/more/water", icon: Droplets },
        { title: "睡眠", description: "追踪睡眠质量", href: "/more/sleep", icon: Moon },
        { title: "训练", description: "记录训练数据", href: "/more/fitness", icon: Dumbbell },
        { title: "吃药", description: "用药提醒记录", href: "/more/medication", icon: Pill },
        { title: "体态拉伸", description: "拉伸放松指导", href: "/more/posture", icon: StretchHorizontal },
      ],
    },
    {
      label: "工具",
      items: [
        { title: "习惯打卡", description: "培养好习惯", href: "/more/habits", icon: CheckSquare },
        { title: "专注计时", description: "番茄钟计时", href: "/more/focus", icon: Timer },
        { title: "倒数日", description: "重要日期倒数", href: "/more/countdown", icon: CalendarRange },
        { title: "备忘录", description: "随手记录想法", href: "/more/notes", icon: StickyNote },
      ],
    },
    {
      label: "系统",
      items: [
        { title: "设置", description: "应用偏好设置", href: "/settings", icon: Settings },
      ],
    },
  ];

  return (
    <div className="min-h-screen max-w-[430px] mx-auto px-4 pt-14 pb-[100px]">
      <h1 className="text-[24px] font-bold tracking-[-0.018em] mb-6" style={{ color: "var(--color-text-primary)" }}>
        全部功能入口
      </h1>

      <div className="flex flex-col gap-6">
        {sections.map((section) => (
          <div key={section.label}>
            <h2 className="text-[13px] font-semibold uppercase tracking-wider mb-3" style={{ color: "var(--color-text-disabled)" }}>
              {section.label}
            </h2>
            <div className="grid grid-cols-2 gap-3">
              {section.items.map((item) => (
                <Link
                  key={item.title}
                  href={item.href}
                  className="rounded-[20px] p-4 flex items-start gap-3 active:opacity-70 transition-opacity"
                  style={{ background: "var(--color-surface-card)", boxShadow: "var(--shadow-card)" }}
                >
                  <div
                    className="w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0"
                    style={{ background: "var(--lifeflow-brand-50)" }}
                  >
                    <item.icon className="w-5 h-5" style={{ color: "var(--lifeflow-primary)" }} />
                  </div>
                  <div className="min-w-0">
                    <p className="text-[15px] font-medium" style={{ color: "var(--color-text-primary)" }}>
                      {item.title}
                    </p>
                    <p className="text-[12px] mt-0.5" style={{ color: "var(--color-text-secondary)" }}>
                      {item.description}
                    </p>
                  </div>
                </Link>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
