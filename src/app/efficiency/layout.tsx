"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Flag, Calendar, BarChart3, Settings } from "lucide-react";

// ─── 效率子站布局（按 lifeflow-goals 设计稿 1:1）─────────────
// 设计稿: lifeflow-goals/pages/goal-list.html
// 导航: 目标 / 日程 / 分析 / 设置（4-tab，430px 居中，白底 85% 毛玻璃）

const BRAND = "#5856D6";
const INACTIVE = "#8E8E93";

const tabs = [
  { key: "goals", label: "目标", path: "/efficiency", icon: Flag },
  { key: "schedule", label: "日程", path: "/efficiency/schedule", icon: Calendar },
  { key: "analytics", label: "分析", path: "/efficiency/review", icon: BarChart3 },
  { key: "settings", label: "设置", path: "/efficiency/settings", icon: Settings },
];

function EfficiencyTabBar() {
  const pathname = usePathname();

  const isActive = (path: string) => {
    if (path === "/efficiency") {
      // 目标 tab: 列表页 + 创建/编辑页
      return pathname === "/efficiency" || pathname === "/efficiency/create";
    }
    return pathname.startsWith(path);
  };

  return (
    <nav
      data-mobile-nav="efficiency"
      className="fixed bottom-0 left-0 right-0 z-50 bg-white/85 backdrop-blur-[12px] border-t border-[#E5E5EA]"
    >
      <div className="w-full max-w-[430px] mx-auto grid grid-cols-4 h-[49pt]">
        {tabs.map((tab) => {
          const active = isActive(tab.path);
          const color = active ? BRAND : INACTIVE;
          return (
            <Link
              key={tab.key}
              href={tab.path}
              data-nav-key={tab.key}
              data-active={active || undefined}
              className="min-w-0 flex flex-col items-center justify-center gap-1 px-1 h-full"
            >
              <tab.icon className="w-6 h-6 shrink-0" style={{ color }} strokeWidth={1.5} />
              <span
                className="text-[10pt] font-medium leading-none whitespace-nowrap max-w-full truncate"
                style={{ color }}
              >
                {tab.label}
              </span>
            </Link>
          );
        })}
      </div>
      {/* 底部安全区（设计稿总高 83px ≈ 49pt 内容 + 18px 安全区） */}
      <div className="h-[max(18px,env(safe-area-inset-bottom))]" />
    </nav>
  );
}

export default function EfficiencyLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-[#F5F5F7]">
      <main className="w-full max-w-[430px] mx-auto pb-[99pt]">{children}</main>
      <EfficiencyTabBar />
    </div>
  );
}
