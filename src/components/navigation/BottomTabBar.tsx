"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Inbox, Calendar, Folder, Target, Settings } from "lucide-react";

const tabs = [
  { id: "capture", label: "捕捉", icon: Inbox, path: "/capture" },
  { id: "today", label: "今日", icon: Calendar, path: "/today" },
  { id: "projects", label: "项目", icon: Folder, path: "/projects" },
  { id: "goals", label: "目标", icon: Target, path: "/goals" },
  { id: "settings", label: "设置", icon: Settings, path: "/settings" },
];

export default function BottomTabBar() {
  const pathname = usePathname();

  const isActive = (path: string) => {
    if (path === "/") return pathname === "/";
    return pathname.startsWith(path);
  };

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-40 h-16 bg-white/90 dark:bg-gray-950/90 backdrop-blur-xl border-t border-gray-200 dark:border-gray-800 pb-[max(8px,env(safe-area-inset-bottom))]">
      <div className="flex items-center justify-around h-full">
        {tabs.map((tab) => {
          const active = isActive(tab.path);
          return (
            <Link
              key={tab.id}
              href={tab.path}
              className={`flex flex-col items-center justify-center gap-0.5 min-w-[44px] min-h-[44px] transition-colors duration-150 ease-out ${
                active ? "text-blue-500" : "text-gray-400"
              }`}
            >
              <tab.icon
                className={`w-6 h-6 ${
                  active ? "fill-current stroke-[2.5]" : "stroke-[1.5]"
                }`}
              />
              <span className="text-[11px] font-medium">{tab.label}</span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
