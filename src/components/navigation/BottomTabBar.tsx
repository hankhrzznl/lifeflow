"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Home, Target, CheckSquare, Calendar, Bot, Grid3x3 } from "lucide-react";

// 全站统一 6-tab 底部导航：首页/目标/事项/日程/助手/更多
// 仅全屏流程页隐藏底导

const FULLSCREEN_PREFIXES = [
  "/more/accounting/ledgers",
  "/efficiency/create",
];

const tabs = [
  { label: "首页", path: "/", icon: Home },
  { label: "目标", path: "/efficiency", icon: Target },
  { label: "事项", path: "/tasks", icon: CheckSquare },
  { label: "日程", path: "/efficiency/schedule", icon: Calendar },
  { label: "助手", path: "/assistant", icon: Bot },
  { label: "更多", path: "/more", icon: Grid3x3 },
] as const;

export default function BottomTabBar() {
  const pathname = usePathname();

  if (FULLSCREEN_PREFIXES.some((p) => pathname.startsWith(p))) return null;

  const isActive = (path: string) => {
    if (path === "/") return pathname === "/";
    if (path === "/efficiency") return pathname === "/efficiency" || pathname.startsWith("/efficiency/") && pathname !== "/efficiency/schedule" && !pathname.startsWith("/efficiency/schedule/");
    if (path === "/efficiency/schedule") return pathname === "/efficiency/schedule" || pathname.startsWith("/efficiency/schedule/");
    if (path === "/assistant") return pathname.startsWith("/assistant");
    if (path === "/more") return pathname === "/more" || (pathname.startsWith("/more/") && !pathname.startsWith("/more/accounting"));
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
