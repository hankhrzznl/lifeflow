"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { motion } from "framer-motion";
import { ArrowLeft, Target, CalendarDays, BarChart3, Bot, Settings } from "lucide-react";

const BRAND = "#5856D6";
const INACTIVE = "#8E8E93";

interface Tab {
  label: string;
  path: string;
  icon: React.ComponentType<{ className?: string; style?: React.CSSProperties }>;
}

const tabs: Tab[] = [
  { label: "目标", path: "/efficiency", icon: Target },
  { label: "日程", path: "/efficiency/schedule", icon: CalendarDays },
  { label: "回顾", path: "/efficiency/review", icon: BarChart3 },
  { label: "助手", path: "/assistant", icon: Bot },
  { label: "设置", path: "/efficiency/settings", icon: Settings },
];

function StationTabBar({ tabs, brandColor }: { tabs: Tab[]; brandColor: string }) {
  const pathname = usePathname();

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-50 bg-white/85 backdrop-blur-xl border-t border-black/5 pb-[max(8px,env(safe-area-inset-bottom))]">
      <div className="flex justify-around items-center h-14">
        {tabs.map((tab) => {
          const isActive = pathname === tab.path || (tab.path !== "/efficiency" && pathname.startsWith(tab.path));
          return (
            <Link
              key={tab.path}
              href={tab.path}
              className="relative flex flex-col items-center gap-0.5 min-w-[44px]"
            >
              {isActive && (
                <motion.span
                  layoutId="efficiency-nav-indicator"
                  className="absolute -top-1 w-1 h-1 rounded-full"
                  style={{ backgroundColor: brandColor }}
                  transition={{ type: "spring", stiffness: 500, damping: 30 }}
                />
              )}
              <tab.icon
                className="w-6 h-6"
                style={{ color: isActive ? brandColor : INACTIVE }}
              />
              <span
                className="text-[10px]"
                style={{ color: isActive ? brandColor : INACTIVE, fontWeight: isActive ? 500 : 400 }}
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

export default function EfficiencyLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-[var(--bg-secondary)]" style={{ paddingBottom: "calc(56px + max(8px, env(safe-area-inset-bottom)))" }}>
      {/* Top Header */}
      <header className="sticky top-0 z-40 bg-white/85 backdrop-blur-xl border-b border-black/5">
        <div className="flex items-center h-12 px-4">
          <Link href="/" className="flex items-center gap-1 pr-3 -ml-1">
            <ArrowLeft className="w-5 h-5" style={{ color: BRAND }} />
          </Link>
          <h1 className="text-base font-semibold flex-1" style={{ color: BRAND }}>效率</h1>
        </div>
      </header>

      {/* Main Content */}
      <main className="pb-20">
        {children}
      </main>

      {/* Bottom TabBar */}
      <StationTabBar tabs={tabs} brandColor={BRAND} />
    </div>
  );
}
