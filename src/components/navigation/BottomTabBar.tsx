"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Home, Target, Leaf } from "lucide-react";

// 全站统一 3-tab 底部导航：首页/目标/长期主义（T20-1，日程 tab 已移除）
// — 更多入口在首页右上角
// — 日程页入口移至首页「今日执行」卡片右上角（/efficiency/schedule 路由保留）
// — AI 助手通过全局悬浮球访问（所有页面可见）
// — 仅全屏流程页隐藏底导

const FULLSCREEN_PREFIXES = [
  "/more/accounting/ledgers",
];

const tabs = [
  { label: "首页", path: "/", icon: Home },
  { label: "目标", path: "/efficiency-v2", icon: Target },
  { label: "长期主义", path: "/longtermism", icon: Leaf },
] as const;

export default function BottomTabBar() {
  const pathname = usePathname();

  if (FULLSCREEN_PREFIXES.some((p) => pathname.startsWith(p))) return null;

  const isActive = (path: string) => {
    if (path === "/") return pathname === "/";
    if (path === "/efficiency-v2") return pathname === "/efficiency-v2" || pathname.startsWith("/efficiency-v2/");
    if (path === "/longtermism") return pathname.startsWith("/longtermism");
    return pathname === path || pathname.startsWith(path + "/");
  };

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-50 bg-[var(--color-surface-card)] border-t border-[var(--lifeflow-border)] h-[83px] pb-[34px]">
      <div className="max-w-[430px] mx-auto flex items-start justify-around pt-2 px-4">
        {tabs.map((tab) => {
          const active = isActive(tab.path);
          return (
            <Link
              key={tab.path}
              href={tab.path}
              className="flex flex-col items-center gap-1 min-w-[44px] no-underline"
            >
              <tab.icon
                className="w-6 h-6"
                style={{ color: active ? "var(--lifeflow-primary)" : "var(--color-text-secondary)" }}
                strokeWidth={2}
              />
              <span
                className="text-[10px] font-medium"
                style={{ color: active ? "var(--lifeflow-primary)" : "var(--color-text-secondary)" }}
              >
                {tab.label}
              </span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
