"use client";

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useCallback, useState, useEffect } from 'react';
import { CalendarDays, Settings, BarChart3, Trash2, Puzzle, Heart, Target, List, Layers, ChevronDown, X, Bot } from 'lucide-react';
import { getPluginsForNavbar } from '@/lib/db';
import { getPluginConfig } from '@/lib/plugin-config';
import type { PluginMetadata } from '@/lib/types';

const planItems = [
  { label: '安排', href: '/pending', icon: List },
  { label: '项目', href: '/projects', icon: Layers },
  { label: '目标', href: '/goals', icon: Target },
];

const moreNav = [
  { label: '设置', href: '/settings', icon: Settings },
  { label: '回顾', href: '/review', icon: BarChart3 },
  { label: '回收站', href: '/trash', icon: Trash2 },
  { label: '插件', href: '/plugins', icon: Puzzle },
];

export default function DesktopSidebarV2() {
  const pathname = usePathname();
  const [showPlanMenu, setShowPlanMenu] = useState(false);
  const [pinnedPlugins, setPinnedPlugins] = useState<PluginMetadata[]>([]);
  const [loading, setLoading] = useState(true);

  const loadPinnedPlugins = useCallback(async () => {
    try {
      const plugins = await getPluginsForNavbar();
      const pinnedPlugins = plugins.filter(p => p.showInNavbar === true);
      setPinnedPlugins(pinnedPlugins);
    } catch (err) {
      console.error('Failed to load pinned plugins:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadPinnedPlugins();
    const interval = setInterval(loadPinnedPlugins, 3000);
    return () => clearInterval(interval);
  }, [loadPinnedPlugins]);

  const isActive = useCallback((href: string) => {
    return pathname.startsWith(href);
  }, [pathname]);

  return (
    <>
      <aside className="hidden lg:flex flex-col w-64 bg-white dark:bg-gray-950 border-r border-gray-200 dark:border-gray-800 h-full fixed left-0 top-0 bottom-0">
        <div className="flex items-center gap-3 px-6 h-16 border-b border-gray-100 dark:border-gray-800">
          <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-blue-500 to-blue-700 flex items-center justify-center">
            <span className="text-white font-bold text-lg">L</span>
          </div>
          <span className="font-semibold text-lg text-gray-900 dark:text-gray-100">LifeFlow</span>
        </div>

        <nav className="flex-1 px-4 py-4 space-y-1">
          <Link
            href="/"
            className={`flex items-center gap-3 px-3 py-2.5 rounded-xl transition-colors ${
              pathname === '/'
                ? 'bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400 font-medium'
                : 'text-gray-500 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-800'
            }`}
          >
            <CalendarDays className={`w-5 h-5 ${pathname === '/' ? 'fill-current text-blue-500' : 'text-gray-400'} stroke-[1.5]`} />
            <span className="text-sm">主页</span>
          </Link>

          <button
            onClick={() => setShowPlanMenu(true)}
            className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl transition-colors ${
              isActive('/pending') || isActive('/projects') || isActive('/goals')
                ? 'bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400 font-medium'
                : 'text-gray-500 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-800'
            }`}
          >
            <Layers className={`w-5 h-5 ${isActive('/pending') || isActive('/projects') || isActive('/goals') ? 'fill-current text-blue-500' : 'text-gray-400'} stroke-[1.5]`} />
            <span className="text-sm flex-1 text-left">规划</span>
            <ChevronDown className="w-4 h-4" />
          </button>

          <Link
            href="/health"
            className={`flex items-center gap-3 px-3 py-2.5 rounded-xl transition-colors ${
              isActive('/health')
                ? 'bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400 font-medium'
                : 'text-gray-500 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-800'
            }`}
          >
            <Heart className={`w-5 h-5 ${isActive('/health') ? 'fill-current text-blue-500' : 'text-gray-400'} stroke-[1.5]`} />
            <span className="text-sm">健康</span>
          </Link>

          <Link
            href="/assistant"
            className={`flex items-center gap-3 px-3 py-2.5 rounded-xl transition-colors ${
              isActive('/assistant')
                ? 'bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400 font-medium'
                : 'text-gray-500 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-800'
            }`}
          >
            <Bot className={`w-5 h-5 ${isActive('/assistant') ? 'fill-current text-blue-500' : 'text-gray-400'} stroke-[1.5]`} />
            <span className="text-sm">助手</span>
          </Link>

          <div className="mx-4 my-3 border-t border-gray-200 dark:border-gray-800" />

          {pinnedPlugins.length > 0 && (
            <>
              {pinnedPlugins.map((plugin) => {
                const config = getPluginConfig(plugin.name);
                if (!config) return null;
                return (
                  <Link
                    key={plugin.id}
                    href={config.path}
                    className={`flex items-center gap-3 px-3 py-2.5 rounded-xl transition-colors ${
                      isActive(config.path)
                        ? 'bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400 font-medium'
                        : 'text-gray-500 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-800'
                    }`}
                  >
                    <config.icon className={`w-5 h-5 ${isActive(config.path) ? 'fill-current text-blue-500' : 'text-gray-400'} stroke-[1.5]`} />
                    <span className="text-sm">{config.label}</span>
                  </Link>
                );
              })}
              <div className="mx-4 my-3 border-t border-gray-200 dark:border-gray-800" />
            </>
          )}

          {moreNav.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className={`flex items-center gap-3 px-3 py-2.5 rounded-xl transition-colors ${
                isActive(item.href)
                  ? 'bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400 font-medium'
                  : 'text-gray-500 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-800'
              }`}
            >
              <item.icon className="w-5 h-5 text-gray-400" strokeWidth={1.5} />
              <span className="text-sm">{item.label}</span>
            </Link>
          ))}
        </nav>

        <div className="px-4 py-4 border-t border-gray-100 dark:border-gray-800">
          <p className="text-xs text-gray-400 text-center">LifeFlow Core v2.2</p>
        </div>
      </aside>

      {showPlanMenu && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setShowPlanMenu(false)} />
          <div className="fixed left-64 top-16 z-50 w-56 bg-white dark:bg-gray-900 rounded-xl shadow-xl border border-gray-200 dark:border-gray-800 overflow-hidden">
            <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100 dark:border-gray-800">
              <span className="font-medium text-gray-900 dark:text-gray-100">规划</span>
              <button
                onClick={() => setShowPlanMenu(false)}
                className="w-6 h-6 flex items-center justify-center rounded hover:bg-gray-100 dark:hover:bg-gray-800"
              >
                <X className="w-4 h-4 text-gray-400" />
              </button>
            </div>
            <div className="py-2">
              {planItems.map((item) => (
                <Link
                  key={item.href}
                  href={item.href}
                  onClick={() => setShowPlanMenu(false)}
                  className="flex items-center gap-3 px-4 py-2.5 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors"
                >
                  <item.icon className="w-5 h-5 text-gray-400" />
                  <span className="text-sm">{item.label}</span>
                </Link>
              ))}
            </div>
          </div>
        </>
      )}
    </>
  );
}
