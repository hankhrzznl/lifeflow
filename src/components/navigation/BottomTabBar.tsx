"use client";

import { useState, useCallback, useEffect, useRef } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import {
  Home, Layers, Menu, X,
  Settings, BarChart3, Trash2, Puzzle, ChevronRight, Bell, Heart,
} from "lucide-react";
import { getPluginsForNavbar } from "@/lib/db";
import { getPluginConfig } from "@/lib/plugin-config";
import type { PluginMetadata } from "@/lib/types";

const moreItems = [
  { label: "健康", href: "/health", icon: Heart },
  { label: "提醒", href: "/reminders", icon: Bell },
  { label: "设置", href: "/settings", icon: Settings },
  { label: "回收站", href: "/trash", icon: Trash2 },
  { label: "插件", href: "/plugins", icon: Puzzle },
];

// ==================== 涟漪按钮 ====================

function RippleButton({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  const [ripples, setRipples] = useState<{ id: number; x: number; y: number }[]>([]);
  const idRef = useRef(0);

  const handleClick = (e: React.MouseEvent) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    const id = idRef.current++;
    setRipples((prev) => [...prev, { id, x, y }]);
    setTimeout(() => {
      setRipples((prev) => prev.filter((r) => r.id !== id));
    }, 400);
    onClick();
  };

  return (
    <motion.button
      whileTap={{ scale: 0.95 }}
      onClick={handleClick}
      className={`relative flex flex-col items-center justify-center gap-0.5 min-w-[44px] min-h-[44px] overflow-hidden ${
        active ? "text-blue-500" : "text-gray-400"
      }`}
    >
      {ripples.map((r) => (
        <span
          key={r.id}
          className="absolute rounded-full bg-blue-500/20 pointer-events-none animate-ripple"
          style={{
            left: r.x - 20,
            top: r.y - 20,
            width: 40,
            height: 40,
          }}
        />
      ))}
      {children}
    </motion.button>
  );
}

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

  const [openPanel, setOpenPanel] = useState<"more" | null>(null);

  const isActive = useCallback((path: string) => pathname.startsWith(path), [pathname]);

  const closePanel = () => setOpenPanel(null);

  const baseTabs = [
    {
      id: "home", label: "主页", icon: Home, path: "/",
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
      id: "more", label: "更多", icon: Menu, path: null,
      active: pathname.startsWith("/settings") || pathname.startsWith("/trash") || pathname.startsWith("/reminders") || pathname.startsWith("/plugins"),
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

            // "更多"按钮
            if (tab.id === "more") {
              return (
                <RippleButton
                  key={tab.id}
                  active={active}
                  onClick={() => setOpenPanel("more")}
                >
                  {/* 激活指示器小圆点 */}
                  {active && (
                    <span className="w-1 h-1 rounded-full bg-blue-500 mb-0.5" />
                  )}
                  <tab.icon
                    className="w-6 h-6"
                    strokeWidth={1.5}
                  />
                  <span className="text-[11px] font-medium">{tab.label}</span>
                </RippleButton>
              );
            }

            if (tab.path) {
              return (
                <Link
                  key={tab.id}
                  href={tab.path}
                  onClick={closePanel}
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

      {openPanel && (
        <div
          className="fixed inset-0 bg-black/40 z-50"
          onClick={closePanel}
        />
      )}
      <AnimatePresence>
        {openPanel === "more" && (
          <motion.div
            initial={{ y: "100%" }}
            animate={{ y: 0 }}
            exit={{ y: "100%" }}
            transition={{ type: "spring", stiffness: 400, damping: 40 }}
            className="fixed bottom-0 left-0 right-0 z-50 bg-white rounded-t-2xl pb-[max(24px,env(safe-area-inset-bottom))]"
          >
            <div className="flex items-center justify-between px-4 pt-4 pb-2">
              <h2 className="text-base font-semibold text-gray-900">
                更多
              </h2>
              <button
                onClick={closePanel}
                className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-gray-100"
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
                  className="flex items-center gap-3 h-14 px-4 rounded-xl text-gray-900 hover:bg-gray-50 transition-colors"
                >
                  <item.icon className="w-5 h-5 text-gray-500" strokeWidth={1.5} />
                  <span className="text-sm">{item.label}</span>
                  <ChevronRight className="w-4 h-4 text-gray-300 ml-auto" />
                </Link>
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
