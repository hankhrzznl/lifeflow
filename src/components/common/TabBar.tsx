"use client";

import React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { motion } from "framer-motion";

// ============================================================
// 类型
// ============================================================

export interface TabBarProps {
  tabs: Array<{ path: string; label: string; icon: React.ComponentType<{ className?: string; strokeWidth?: number; style?: React.CSSProperties }> }>;
  brandColor: string; // e.g. "#5856D6"
  className?: string;
}

// ============================================================
// 组件
// ============================================================

function TabBar({ tabs, brandColor, className = "" }: TabBarProps) {
  const pathname = usePathname();

  return (
    <nav
      className={`fixed bottom-0 left-0 right-0 z-50 bg-white/85 backdrop-blur-xl border-t border-black/[0.05] pb-[max(8px,env(safe-area-inset-bottom))] ${className}`}
    >
      <div className="flex items-center justify-around h-[56px]">
        {tabs.map((tab) => {
          const isActive = pathname === tab.path || pathname.startsWith(tab.path + "/");
          const Icon = tab.icon;

          return (
            <Link
              key={tab.path}
              href={tab.path}
              className="relative flex flex-col items-center justify-center gap-0.5 min-w-[44px] min-h-[44px]"
            >
              {isActive && (
                <motion.span
                  layoutId="common-tab-dot"
                  className="w-1.5 h-1.5 rounded-full mb-0.5"
                  style={{ backgroundColor: brandColor }}
                  transition={{ type: "spring", stiffness: 500, damping: 30 }}
                />
              )}
              <Icon
                className="w-6 h-6"
                strokeWidth={1.5}
                style={{ color: isActive ? brandColor : "#8E8E93" }}
              />
              <span
                className="text-[11px] font-medium"
                style={{ color: isActive ? brandColor : "#8E8E93" }}
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

// ============================================================
// 导出
// ============================================================

export default TabBar;
export { TabBar };
