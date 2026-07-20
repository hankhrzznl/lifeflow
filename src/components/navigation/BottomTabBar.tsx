"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Home, Target, CheckSquare, CalendarDays, LayoutGrid } from "lucide-react";

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
  { label: "更多", path: "/more", icon: LayoutGrid },
] as const;

export default function BottomTabBar() {
  const pathname = usePathname();

  if (FULLSCREEN_PREFIXES.some((p) => pathname.startsWith(p))) return null;

  const isActive = (path: string) => {
    if (path === "/") return pathname === "/";
    return pathname === path || pathname.startsWith(path + "/");
  };

  return (
    <nav
      className="fixed bottom-0 left-0 right-0 z-50 flex items-start justify-around pt-2 px-4"
      style={{
        background: "var(--color-surface-card)",
        borderTop: "1px solid var(--lifeflow-border)",
        height: "var(--tab-bar-height)",
        paddingBottom: "var(--safe-area-bottom)",
      }}
    >
      {tabs.map((tab) => {
        const active = isActive(tab.path);
        const color = active ? "var(--lifeflow-primary)" : "var(--color-text-secondary)";
        return (
          <Link
            key={tab.path}
            href={tab.path}
            className="flex flex-col items-center gap-1 min-w-[44px] no-underline"
          >
            <tab.icon className="w-6 h-6 shrink-0" style={{ color }} strokeWidth={2} />
            <span className="text-[10px] font-medium" style={{ color }}>
              {tab.label}
            </span>
          </Link>
        );
      })}
    </nav>
  );
}
