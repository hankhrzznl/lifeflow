"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Home, Target, CheckSquare, CalendarDays, Package } from "lucide-react";

// ─── 全站统一底导 ────────────────────────────────────────────
// 5-tab：首页 / 效率 / 事项 / 日程 / 更多
// 全屏流程页隐藏

const FULLSCREEN_PREFIXES = [
  "/more/accounting/record",
  "/more/accounting/ledgers",
  "/more/accounting/search",
  "/efficiency/create",
];

const tabs = [
  { label: "首页", path: "/", icon: Home },
  { label: "目标", path: "/efficiency", icon: Target },
  { label: "事项", path: "/tasks", icon: CheckSquare },
  { label: "日程", path: "/efficiency/schedule", icon: CalendarDays },
  { label: "更多", path: "/more", icon: Package },
] as const;

export default function BottomTabBar() {
  const pathname = usePathname();

  if (FULLSCREEN_PREFIXES.some((p) => pathname.startsWith(p))) return null;

  const isActive = (path: string) => {
    if (path === "/") return pathname === "/";
    // 匹配同路径或明确子路径（如 /efficiency/schedule 不匹配 /efficiency）
    return pathname === path || pathname.startsWith(path + "/");
  };

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-50 bg-white border-t border-[#E5E5E5]">
      <div className="w-full max-w-[430px] mx-auto grid grid-cols-5 h-[49px]">
        {tabs.map((tab) => {
          const active = isActive(tab.path);
          return (
            <Link
              key={tab.path}
              href={tab.path}
              className="min-w-0 flex flex-col items-center justify-center gap-[3px] px-1 h-full"
            >
              <tab.icon
                className="w-6 h-6 shrink-0"
                style={{ color: active ? "#5865F2" : "#AEAEB2" }}
                strokeWidth={2}
              />
              <span
                className="text-[11px] font-medium leading-none whitespace-nowrap max-w-full truncate"
                style={{ color: active ? "#5865F2" : "#AEAEB2" }}
              >
                {tab.label}
              </span>
            </Link>
          );
        })}
      </div>
      <div style={{ height: "env(safe-area-inset-bottom)" }} />
    </nav>
  );
}
