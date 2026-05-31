"use client";

import { useState, useCallback, useEffect } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import {
  Layers, Menu, X, Inbox, Calendar, List, Target,
  Settings, BarChart3, Trash2, Puzzle, ChevronRight, Bell, Heart,
} from "lucide-react";
import { getPluginsForNavbar } from "@/lib/db";
import { getPluginConfig } from "@/lib/plugin-config";
import type { PluginMetadata } from "@/lib/types";

const planItems = [
  { label: "捕捉", href: "/capture", icon: Inbox },
  { label: "今日", href: "/today", icon: Calendar },
  { label: "安排", href: "/pending", icon: List },
  { label: "项目", href: "/projects", icon: Layers },
  { label: "目标", href: "/goals", icon: Target },
];

const moreItems = [
  { label: "健康", href: "/health", icon: Heart },
  { label: "提醒", href: "/reminders", icon: Bell },
  { label: "设置", href: "/settings", icon: Settings },
  { label: "回顾", href: "/review", icon: BarChart3 },
  { label: "回收站", href: "/trash", icon: Trash2 },
  { label: "插件", href: "/plugins", icon: Puzzle },
];

export default function BottomTabBar() {
  const pathname = usePathname();
  const [pinnedPlugins, setPinnedPlugins] = useState<PluginMetadata[]>([]);
  const [loading, setLoading] = useState(true);

  const loadPinnedPlugins = useCallback(async () => {
    try {
      const plugins = await getPluginsForNavbar();
      const activePlugins = plugins.filter(p => p.status === "active");
      setPinnedPlugins(activePlugins);
    } catch (err) {
      console.error("Failed to load pinned plugins:", err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadPinnedPlugins();
    const interval = setInterval(loadPinnedPlugins, 3000);
    return () => clearInterval(interval);
  }, [loadPinnedPlugins]);
  const [openPanel, setOpenPanel] = useState<"plan" | "more" | null>(null);

  const isActive = useCallback((path: string) => pathname.startsWith(path), [pathname]);

  const closePanel = () => setOpenPanel(null);

  const baseTabs = [
    {
      id: "plan", label: "规划", icon: Layers, path: null,
      active: pathname.startsWith("/capture") || pathname.startsWith("/today") || pathname.startsWith("/pending") || pathname.startsWith("/projects") || pathname.startsWith("/goals"),
    },
    {
      id: "health", label: "健康", icon: Heart, path: "/health",
      active: isActive("/health"),
    },
    {
      id: "more", label: "更多", icon: Menu, path: null,
      active: pathname.startsWith("/settings") || pathname.startsWith("/review") || pathname.startsWith("/trash") || pathname.startsWith("/reminders") || pathname.startsWith("/plugins"),
    },
  ];

  const pluginTabs = pinnedPlugins.map(plugin => {
    const config = getPluginConfig(plugin.name);
    if (!config) return null;
    return {
      id: `plugin-${plugin.name}`,
      label: config.label,
      icon: config.icon,
      path: config.path,
      active: isActive(config.path),
    };
  }).filter(Boolean);

  const tabs = [...baseTabs, ...pluginTabs];

  return (
    <>
      <nav className="fixed bottom-0 left-0 right-0 z-40 h-16 bg-white/90 dark:bg-gray-950/90 backdrop-blur-xl border-t border-gray-200 dark:border-gray-800 pb-[max(8px,env(safe-area-inset-bottom))]">
        <div className="flex items-center justify-around h-full">
          {tabs.map((tab) => {
            if (!tab) return null;
            const active = tab.active;
            if (tab.id === "plan") {
              return (
                <button
                  key={tab.id}
                  onClick={() => setOpenPanel("plan")}
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
            }
            if (tab.id === "more") {
              return (
                <button
                  key={tab.id}
                  onClick={() => setOpenPanel("more")}
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
            }
            if (tab.path) {
              return (
                <Link
                  key={tab.id}
                  href={tab.path}
                  onClick={closePanel}
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
        {openPanel === "plan" && (
          <motion.div
            initial={{ y: "100%" }}
            animate={{ y: 0 }}
            exit={{ y: "100%" }}
            transition={{ type: "spring", stiffness: 400, damping: 40 }}
            className="fixed bottom-0 left-0 right-0 z-50 bg-white dark:bg-gray-900 rounded-t-2xl pb-[max(24px,env(safe-area-inset-bottom))]"
          >
            <div className="flex items-center justify-between px-4 pt-4 pb-2">
              <h2 className="text-base font-semibold text-gray-900 dark:text-gray-100">
                规划
              </h2>
              <button
                onClick={closePanel}
                className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800"
              >
                <X className="w-5 h-5 text-gray-400" />
              </button>
            </div>

            <div className="px-2 pb-2">
              {planItems.map((item) => (
                <Link
                  key={item.href}
                  href={item.href}
                  onClick={closePanel}
                  className="flex items-center gap-3 h-14 px-4 rounded-xl text-gray-900 dark:text-gray-100 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors active:scale-[0.98]"
                >
                  <item.icon className="w-5 h-5 text-gray-500 dark:text-gray-400" strokeWidth={1.5} />
                  <span className="text-sm">{item.label}</span>
                  <ChevronRight className="w-4 h-4 text-gray-300 dark:text-gray-600 ml-auto" />
                </Link>
              ))}
            </div>
          </motion.div>
        )}
        {openPanel === "more" && (
          <motion.div
            initial={{ y: "100%" }}
            animate={{ y: 0 }}
            exit={{ y: "100%" }}
            transition={{ type: "spring", stiffness: 400, damping: 40 }}
            className="fixed bottom-0 left-0 right-0 z-50 bg-white dark:bg-gray-900 rounded-t-2xl pb-[max(24px,env(safe-area-inset-bottom))]"
          >
            <div className="flex items-center justify-between px-4 pt-4 pb-2">
              <h2 className="text-base font-semibold text-gray-900 dark:text-gray-100">
                更多
              </h2>
              <button
                onClick={closePanel}
                className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800"
              >
                <X className="w-5 h-5 text-gray-400" />
              </button>
            </div>

            <div className="px-2 pb-2">
              {moreItems.map((item) => (
                <Link
                  key={item.href}
                  href={item.href}
                  onClick={closePanel}
                  className="flex items-center gap-3 h-14 px-4 rounded-xl text-gray-900 dark:text-gray-100 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors active:scale-[0.98]"
                >
                  <item.icon className="w-5 h-5 text-gray-500 dark:text-gray-400" strokeWidth={1.5} />
                  <span className="text-sm">{item.label}</span>
                  <ChevronRight className="w-4 h-4 text-gray-300 dark:text-gray-600 ml-auto" />
                </Link>
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
