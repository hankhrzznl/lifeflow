"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Home, Target, Wallet, Heart } from "lucide-react";

// 全站统一 4-tab 底部导航：首页/效率/记账/健康
// 仅全屏流程页隐藏底导，其余所有路由一律显示

const FULLSCREEN_PREFIXES = [
  "/more/accounting/record",
  "/more/accounting/ledgers",
  "/more/accounting/search",
  "/efficiency/create",
];

const tabs = [
  { label: "首页", path: "/", icon: Home },
  { label: "效率", path: "/efficiency", icon: Target },
  { label: "记账", path: "/more/accounting", icon: Wallet },
  { label: "健康", path: "/more", icon: Heart },
] as const;

const ACTIVE_COLOR = "#5865F2";
const INACTIVE_COLOR = "#AEAEB2";

export default function BottomTabBar() {
  const pathname = usePathname();

  if (FULLSCREEN_PREFIXES.some((p) => pathname.startsWith(p))) return null;

  const isActive = (path: string) => {
    if (path === "/") return pathname === "/";
    if (path === "/more") return pathname === "/more" || (pathname.startsWith("/more/") && !pathname.startsWith("/more/accounting"));
    if (path === "/more/accounting") return pathname === "/more/accounting" || pathname.startsWith("/more/accounting/");
    return pathname === path || pathname.startsWith(path + "/");
  };

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-50 bg-white border-t border-[#E5E5E5]">
      <div className="max-w-[430px] mx-auto grid grid-cols-4 h-[49px]">
        {tabs.map((tab) => {
          const active = isActive(tab.path);
          const color = active ? ACTIVE_COLOR : INACTIVE_COLOR;
          return (
            <Link
              key={tab.path}
              href={tab.path}
              className="flex flex-col items-center justify-center gap-[3px] no-underline"
            >
              <tab.icon className="w-6 h-6 shrink-0" style={{ color }} strokeWidth={2} />
              <span className="text-[11px] font-medium leading-none" style={{ color }}>
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
