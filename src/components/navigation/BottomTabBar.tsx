"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  Inbox,
  Calendar,
  Timer,
  BarChart3,
  Target,
  FolderKanban,
  Trash2,
  Settings2,
} from "lucide-react";
import type { TabItem } from "@/lib/types";

const tabs: TabItem[] = [
  { id: "dashboard", label: "今天", icon: "LayoutDashboard", path: "/" },
  { id: "capture", label: "捕捉", icon: "Inbox", path: "/capture" },
  { id: "planner", label: "规划", icon: "Calendar", path: "/planner" },
  { id: "focus", label: "专注", icon: "Timer", path: "/focus" },
  { id: "review", label: "回顾", icon: "BarChart3", path: "/review" },
  { id: "goals", label: "目标", icon: "Target", path: "/goals" },
  { id: "projects", label: "项目", icon: "FolderKanban", path: "/projects" },
  { id: "trash", label: "回收站", icon: "Trash2", path: "/trash" },
  { id: "settings", label: "设置", icon: "Settings2", path: "/settings" },
];

const iconMap: Record<string, React.ComponentType<{ className?: string }>> = {
  LayoutDashboard,
  Inbox,
  Calendar,
  Timer,
  BarChart3,
  Target,
  FolderKanban,
  Trash2,
  Settings2,
};

const mobileTabs = tabs.filter((t) => t.id !== "projects" && t.id !== "trash" && t.id !== "settings");

export default function BottomTabBar() {
  const pathname = usePathname();

  const isActive = (tab: TabItem) => {
    if (tab.path === "/") return pathname === "/";
    return pathname.startsWith(tab.path);
  };

  return (
    <nav className="md:hidden fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 safe-bottom z-40">
      <div className="flex items-center justify-around h-16">
        {mobileTabs.map((tab) => {
          const Icon = iconMap[tab.icon];
          const active = isActive(tab);
          return (
            <Link
              key={tab.id}
              href={tab.path}
              className={`flex flex-col items-center justify-center gap-0.5 min-w-[44px] min-h-[44px] transition-colors ${
                active ? "text-indigo-600" : "text-gray-400"
              }`}
            >
              {Icon && <Icon className="w-6 h-6" />}
              <span className="text-[11px] font-medium">{tab.label}</span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
