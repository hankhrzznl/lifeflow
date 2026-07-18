"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Home, Target, Wallet, Heart } from "lucide-react";

// ─── 新架构：主站导航 ─────────────────────────────────────────
// 主站(/) + 三子站入口。子站路由下自动隐藏（子站有自己的导航栏）。

const SUBSITE_PREFIXES = ["/efficiency", "/accounting", "/health"];

const tabs = [
  { label: "首页", path: "/", icon: Home },
  { label: "效率", path: "/efficiency", icon: Target },
  { label: "记账", path: "/accounting", icon: Wallet },
  { label: "健康", path: "/health", icon: Heart },
] as const;

export default function BottomTabBar() {
  const pathname = usePathname();

  // 子站页面由子站 layout 渲染自己的导航，这里直接隐藏
  if (SUBSITE_PREFIXES.some((p) => pathname.startsWith(p))) return null;

  const isActive = (path: string) =>
    path === "/" ? pathname === "/" : pathname.startsWith(path);

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-50 bg-white border-t border-[#E5E5E5]">
      <div className="w-full max-w-[430px] mx-auto grid grid-cols-4 h-[49px]">
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
      {/* 底部安全区 */}
      <div style={{ height: "env(safe-area-inset-bottom)" }} />
    </nav>
  );
}
