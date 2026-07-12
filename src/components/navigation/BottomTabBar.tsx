"use client";

import { useState, useCallback, useEffect } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { motion } from "framer-motion";
import {
  Layers, BarChart3, CalendarDays, Bot, TrendingUp,
} from "lucide-react";
import { getPluginsForNavbar } from "@/lib/db";
import { getPluginConfig } from "@/lib/plugin-config";
import type { PluginMetadata } from "@/lib/types";

export default function BottomTabBar() {
  const pathname = usePathname();
  const [pinnedPlugins, setPinnedPlugins] = useState<PluginMetadata[]>([]);
  const [entered, setEntered] = useState(false);

  const loadPinnedPlugins = useCallback(async () => {
    try {
      const plugins = await getPluginsForNavbar();
      const pinnedPlugins = plugins.filter((p) => p.showInNavbar === true);
      setPinnedPlugins(pinnedPlugins);
    } catch (err) {
      console.error("Failed to load pinned plugins:", err);
    }
  }, []);

  useEffect(() => {
    loadPinnedPlugins();
    const interval = setInterval(loadPinnedPlugins, 3000);
    return () => clearInterval(interval);
  }, [loadPinnedPlugins]);

  useEffect(() => {
    setEntered(true);
  }, []);

  const isActive = useCallback((path: string) => pathname.startsWith(path), [pathname]);

  const baseTabs = [
    {
      id: "today", label: "主页", icon: CalendarDays, path: "/",
      active: pathname === "/",
    },
    {
      id: "plan", label: "规划", icon: Layers, path: "/planner",
      active: isActive("/planner"),
    },
    {
      id: "review", label: "回顾", icon: BarChart3, path: "/review",
      active: isActive("/review"),
    },
    {
      id: "assistant", label: "助手", icon: Bot, path: "/assistant",
      active: isActive("/assistant"),
    },
    {
      id: "stats", label: "统计", icon: TrendingUp, path: "/stats",
      active: isActive("/stats"),
    },
  ];

  const pluginTabs = pinnedPlugins
    .map((plugin) => {
      const config = getPluginConfig(plugin.name);
      if (!config) return null;
      return {
        id: `plugin-${plugin.name}`,
        label: config.label,
        icon: config.icon,
        path: config.path,
        active: isActive(config.path),
      };
    })
    .filter(Boolean);

  const tabs = [...baseTabs, ...pluginTabs];

  return (
    <>
      {/* 底部导航栏 — 带入场动画 */}
      <motion.nav
        initial={{ y: "100%" }}
        animate={entered ? { y: 0 } : { y: "100%" }}
        transition={{ duration: 0.4, delay: 0.2, ease: [0.25, 0.46, 0.45, 0.94] }}
        className="fixed bottom-0 left-0 right-0 z-50 h-16 bg-white border-t border-gray-100 pb-[max(8px,env(safe-area-inset-bottom))]"
      >
        <div className="flex items-center justify-around h-full">
          {tabs.map((tab) => {
            if (!tab) return null;
            const active = tab.active;

            // 今日悬浮圆形按钮
            if (tab.id === "today") {
              return (
                <Link
                  key={tab.id}
                  href={tab.path!}
                  className="relative flex flex-col items-center justify-center min-w-[44px]"
                >
                  <motion.div
                    whileHover={{ scale: 1.08 }}
                    whileTap={{ scale: 0.92 }}
                    className={`w-14 h-14 rounded-full flex items-center justify-center shadow-lg -mt-6 transition-colors ${
                      active
                        ? "bg-violet-600 shadow-violet-500/40"
                        : "bg-violet-600 shadow-violet-500/20"
                    }`}
                  >
                    <tab.icon className="w-7 h-7 text-white" strokeWidth={1.5} />
                  </motion.div>
                  <span className={`text-[11px] font-medium mt-0.5 ${active ? "text-violet-600" : "text-gray-400"}`}>
                    {tab.label}
                  </span>
                </Link>
              );
            }

            if (tab.path) {
              return (
                <Link
                  key={tab.id}
                  href={tab.path}
                  className={`relative flex flex-col items-center justify-center gap-0.5 min-w-[44px] min-h-[44px] overflow-hidden ${
                    active ? "text-blue-500" : "text-gray-400"
                  }`}
                >
                  {/* 激活指示器小圆点 */}
                  {active && (
                    <motion.span
                      layoutId="nav-dot"
                      className="w-1 h-1 rounded-full bg-blue-500 mb-0.5"
                      transition={{ type: "spring", stiffness: 500, damping: 30 }}
                    />
                  )}
                  <tab.icon
                    className="w-6 h-6"
                    strokeWidth={1.5}
                  />
                  <span className="text-[11px] font-medium">{tab.label}</span>
                </Link>
              );
            }
            return null;
          })}
        </div>
      </motion.nav>
    </>
  );
}
