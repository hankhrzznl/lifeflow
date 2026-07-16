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
    { id: "today", label: "主页", icon: CalendarDays, path: "/", active: pathname === "/" },
    { id: "plan", label: "规划", icon: Layers, path: "/planner", active: isActive("/planner") },
    { id: "review", label: "回顾", icon: BarChart3, path: "/review", active: isActive("/review") },
    { id: "assistant", label: "助手", icon: Bot, path: "/assistant", active: isActive("/assistant") },
    { id: "stats", label: "统计", icon: TrendingUp, path: "/stats", active: isActive("/stats") },
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
      <motion.nav
        initial={{ y: "100%" }}
        animate={entered ? { y: 0 } : { y: "100%" }}
        transition={{ duration: 0.4, delay: 0.2, ease: [0.25, 0.46, 0.45, 0.94] }}
        className="fixed bottom-0 left-0 right-0 z-50 pb-[max(8px,env(safe-area-inset-bottom))]"
        style={{
          backgroundColor: "var(--surface-desk-light)",
          borderTop: "2px solid var(--color-knit-grid)",
        }}
      >
        <div className="flex items-center justify-around h-[60px]">
          {tabs.map((tab) => {
            if (!tab) return null;
            const active = tab.active;

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
                    className="w-14 h-14 rounded-full flex items-center justify-center shadow-lg -mt-7 transition-colors"
                    style={{
                      backgroundColor: active ? "var(--color-brand-primary-hover)" : "var(--color-brand-primary)",
                      boxShadow: active
                        ? "0 4px 12px rgba(217, 122, 84, 0.4)"
                        : "0 4px 12px rgba(232, 141, 103, 0.3)",
                    }}
                  >
                    <tab.icon className="w-7 h-7 text-[var(--color-text-inverse)]" strokeWidth={1.5} />
                  </motion.div>
                  <span
                    className="text-[11px] font-medium mt-0.5"
                    style={{
                      fontFamily: active ? "var(--font-display)" : undefined,
                      color: active ? "var(--color-brand-primary)" : "var(--color-text-tertiary)",
                    }}
                  >
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
                  className="relative flex flex-col items-center justify-center gap-0.5 min-w-[44px] min-h-[44px]"
                >
                  {active && (
                    <motion.span
                      layoutId="nav-dot"
                      className="w-1.5 h-1.5 rounded-full mb-0.5"
                      style={{ backgroundColor: "var(--color-brand-primary)" }}
                      transition={{ type: "spring", stiffness: 500, damping: 30 }}
                    />
                  )}
                  <tab.icon
                    className="w-6 h-6"
                    strokeWidth={1.5}
                    style={{ color: active ? "var(--color-brand-secondary)" : "var(--color-text-tertiary)" }}
                  />
                  <span
                    className="text-[11px] font-medium"
                    style={{
                      fontFamily: active ? "var(--font-display)" : undefined,
                      color: active ? "var(--color-brand-secondary)" : "var(--color-text-tertiary)",
                    }}
                  >
                    {tab.label}
                  </span>
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
