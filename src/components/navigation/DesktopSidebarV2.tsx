"use client";

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Inbox, Calendar, Folder, Target, Settings, BarChart3, Trash2, Puzzle, ListTodo } from 'lucide-react';

const coreNav = [
  { label: '捕捉', href: '/capture', icon: Inbox },
  { label: '今日', href: '/today', icon: Calendar },
  { label: '安排', href: '/pending', icon: ListTodo },
  { label: '项目', href: '/projects', icon: Folder },
  { label: '目标', href: '/goals', icon: Target },
  { label: '设置', href: '/settings', icon: Settings },
];

const moreNav = [
  { label: '回顾', href: '/review', icon: BarChart3 },
  { label: '回收站', href: '/trash', icon: Trash2 },
  { label: '插件', href: '/plugins', icon: Puzzle },
];

export default function DesktopSidebarV2() {
  const pathname = usePathname();

  const isActive = (href: string) => {
    if (href === '/capture') return pathname.startsWith('/capture');
    if (href === '/today') return pathname === '/today' || pathname === '/planner' || pathname === '/focus';
    return pathname.startsWith(href);
  };

  return (
    <aside className="hidden lg:flex flex-col w-64 bg-white dark:bg-gray-950 border-r border-gray-200 dark:border-gray-800 h-full fixed left-0 top-0 bottom-0">
      <div className="flex items-center gap-3 px-6 h-16 border-b border-gray-100 dark:border-gray-800">
        <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-blue-500 to-blue-700 flex items-center justify-center">
          <span className="text-white font-bold text-lg">L</span>
        </div>
        <span className="font-semibold text-lg text-gray-900 dark:text-gray-100">LifeFlow</span>
      </div>

      <nav className="flex-1 px-4 py-4 space-y-1">
        {coreNav.map((item) => {
          const active = isActive(item.href);
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`flex items-center gap-3 px-3 py-2.5 rounded-xl transition-colors ${
                active
                  ? 'bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400 font-medium'
                  : 'text-gray-500 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-800'
              }`}
            >
              <item.icon className={`w-5 h-5 ${active ? 'fill-current text-blue-500' : 'text-gray-400'} stroke-[1.5]`} />
              <span className="text-sm">{item.label}</span>
            </Link>
          );
        })}

        <div className="mx-4 my-3 border-t border-gray-200 dark:border-gray-800" />

        {moreNav.map((item) => (
          <Link
            key={item.href}
            href={item.href}
            className={`flex items-center gap-3 px-3 py-2.5 rounded-xl transition-colors ${
              pathname.startsWith(item.href)
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
  );
}
