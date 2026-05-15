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
  Puzzle,
  Trash2,
  Settings2,
} from "lucide-react";
import type { TabItem } from "@/lib/types";

const tabs: TabItem[] = [
  { id: "today", label: "今天", icon: "LayoutDashboard", path: "/today" },
  { id: "capture", label: "捕捉", icon: "Inbox", path: "/capture" },
  { id: "planner", label: "规划", icon: "Calendar", path: "/planner" },
  { id: "focus", label: "专注", icon: "Timer", path: "/focus" },
  { id: "goals", label: "目标", icon: "Target", path: "/goals" },
  { id: "review", label: "回顾", icon: "BarChart3", path: "/review" },
  { id: "projects", label: "项目", icon: "FolderKanban", path: "/projects" },
  { id: "trash", label: "回收站", icon: "Trash2", path: "/trash" },
  { id: "plugins", label: "插件", icon: "Puzzle", path: "/plugins" },
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
  Puzzle,
  Trash2,
  Settings2,
};

export default function DesktopSidebar() {
  const pathname = usePathname();

  const isActive = (tab: TabItem) => {
    if (tab.path === "/") return pathname === "/";
    return pathname.startsWith(tab.path);
  };

  return (
    <aside className="hidden md:flex flex-col w-64 bg-white border-r border-gray-200 h-full">
      <div className="flex items-center gap-3 px-6 py-6 border-b border-gray-100">
        <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-indigo-500 to-violet-600 flex items-center justify-center">
          <span className="text-white font-bold text-lg">L</span>
        </div>
        <span className="font-semibold text-lg text-gray-900">LifeFlow</span>
      </div>

      <nav className="flex-1 px-3 py-4 space-y-1">
        {tabs.map((tab) => {
          const Icon = iconMap[tab.icon];
          const active = isActive(tab);
          return (
            <Link
              key={tab.id}
              href={tab.path}
              className={`flex items-center gap-3 px-3 py-2.5 rounded-xl transition-colors ${
                active
                  ? "bg-indigo-50 text-indigo-700 font-medium"
                  : "text-gray-600 hover:bg-gray-50"
              }`}
            >
              {Icon && <Icon className="w-5 h-5" />}
              <span className="text-sm">{tab.label}</span>
            </Link>
          );
        })}
      </nav>

      <div className="px-4 py-4 border-t border-gray-100">
        <p className="text-xs text-gray-400 text-center">LifeFlow Core v2.1</p>
      </div>
    </aside>
  );
}
