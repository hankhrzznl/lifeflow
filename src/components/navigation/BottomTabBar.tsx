"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import {
  Inbox, Calendar, Layers, Menu, X,
  FolderKanban, Target, Settings, BarChart3, Trash2, Puzzle, ChevronRight, ListTodo, Flame, Bell,
} from "lucide-react";

const planItems = [
  { label: "安排事项", href: "/pending", icon: ListTodo, desc: "待安排与已安排的事务" },
  { label: "项目", href: "/projects", icon: FolderKanban, desc: "管理项目与大模块" },
  { label: "目标", href: "/goals", icon: Target, desc: "长期目标与日常习惯" },
];

const moreItems = [
  { label: "习惯", href: "/plugins/habit", icon: Flame },
  { label: "提醒", href: "/reminders", icon: Bell },
  { label: "设置", href: "/settings", icon: Settings },
  { label: "回顾", href: "/review", icon: BarChart3 },
  { label: "回收站", href: "/trash", icon: Trash2 },
  { label: "插件", href: "/plugins", icon: Puzzle },
];

export default function BottomTabBar() {
  const pathname = usePathname();
  const [openPanel, setOpenPanel] = useState<"plan" | "more" | null>(null);

  const isActive = (path: string) => pathname.startsWith(path);

  const tabs = [
    {
      id: "capture", label: "捕捉", icon: Inbox, path: "/capture",
      active: isActive("/capture"),
    },
    {
      id: "today", label: "今日", icon: Calendar, path: "/today",
      active: pathname === "/today" || pathname === "/planner" || pathname === "/focus",
    },
    {
      id: "plan", label: "规划", icon: Layers, path: null,
      active: pathname.startsWith("/projects") || pathname.startsWith("/goals") || pathname.startsWith("/pending"),
    },
    {
      id: "more", label: "更多", icon: Menu, path: null,
      active: pathname.startsWith("/settings") || pathname.startsWith("/review") || pathname.startsWith("/trash") || pathname.startsWith("/plugins") || pathname.startsWith("/plugins/habit") || pathname.startsWith("/reminders"),
    },
  ];

  const closePanel = () => setOpenPanel(null);

  return (
    <>
      <nav className="fixed bottom-0 left-0 right-0 z-40 h-16 bg-white/90 dark:bg-gray-950/90 backdrop-blur-xl border-t border-gray-200 dark:border-gray-800 pb-[max(8px,env(safe-area-inset-bottom))]">
        <div className="flex items-center justify-around h-full">
          {tabs.map((tab) => {
            const active = tab.active;
            if (tab.path) {
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
            }
            return (
              <button
                key={tab.id}
                onClick={() => setOpenPanel(tab.id as "plan" | "more")}
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
              </button>
            );
          })}
        </div>
      </nav>

      {openPanel && (
        <div
          className="fixed inset-0 bg-black/40 z-50"
          onClick={closePanel}
        />
      )}
      <AnimatePresence>
        {openPanel && (
          <motion.div
            initial={{ y: "100%" }}
            animate={{ y: 0 }}
            exit={{ y: "100%" }}
            transition={{ type: "spring", stiffness: 400, damping: 40 }}
            className="fixed bottom-0 left-0 right-0 z-50 bg-white dark:bg-gray-900 rounded-t-2xl pb-[max(24px,env(safe-area-inset-bottom))]"
          >
            <div className="flex items-center justify-between px-4 pt-4 pb-2">
              <h2 className="text-base font-semibold text-gray-900 dark:text-gray-100">
                {openPanel === "plan" ? "规划" : "更多"}
              </h2>
              <button
                onClick={closePanel}
                className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800"
              >
                <X className="w-5 h-5 text-gray-400" />
              </button>
            </div>

            <div className="px-2 pb-2">
              {(openPanel === "plan" ? planItems : moreItems).map((item) => (
                <Link
                  key={item.href}
                  href={item.href}
                  onClick={closePanel}
                  className="flex items-center gap-3 h-14 px-4 rounded-xl text-gray-900 dark:text-gray-100 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors active:scale-[0.98]"
                >
                  <item.icon className="w-5 h-5 text-gray-500 dark:text-gray-400" strokeWidth={1.5} />
                  <div className="flex-1 min-w-0">
                    <span className="text-sm">{item.label}</span>
                    {"desc" in item && (
                      <p className="text-xs text-gray-400 dark:text-gray-500 truncate">{(item as typeof planItems[number]).desc}</p>
                    )}
                  </div>
                  <ChevronRight className="w-4 h-4 text-gray-300 dark:text-gray-600" />
                </Link>
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
