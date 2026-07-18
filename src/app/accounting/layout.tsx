"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Receipt, BarChart3, Plus, Wallet, User } from "lucide-react";

// ─── 记账子站布局（按 lifeflow-accounting 设计稿 1:1）─────────
// 设计稿: lifeflow-accounting/pages/home.html
// 导航: 明细/图表/记账(中央凸起)/资产/我的，品牌绿 #34C759，83px

const BRAND = "#34C759";
const INACTIVE = "#8E8E93";

const leftTabs = [
  { key: "detail", label: "明细", path: "/accounting", icon: Receipt },
  { key: "chart", label: "图表", path: "/accounting/chart", icon: BarChart3 },
];
const rightTabs = [
  { key: "assets", label: "资产", path: "/accounting/assets", icon: Wallet },
  { key: "profile", label: "我的", path: "/accounting/settings", icon: User },
];

function AccountingTabBar() {
  const pathname = usePathname();

  const isActive = (path: string) =>
    path === "/accounting" ? pathname === "/accounting" : pathname.startsWith(path);

  const renderTab = (tab: (typeof leftTabs)[number]) => {
    const active = isActive(tab.path);
    return (
      <Link
        key={tab.key}
        href={tab.path}
        data-nav-key={tab.key}
        data-active={active || undefined}
        className="min-w-0 flex flex-col items-center justify-center gap-0.5 px-1"
        style={{ color: active ? BRAND : INACTIVE }}
      >
        <tab.icon className="w-6 h-6 shrink-0" strokeWidth={1.5} />
        <span
          className={`text-[11px] leading-none whitespace-nowrap max-w-full truncate ${active ? "font-semibold" : ""}`}
        >
          {tab.label}
        </span>
      </Link>
    );
  };

  return (
    <nav
      data-mobile-nav="accounting"
      className="fixed bottom-0 left-0 right-0 bg-white border-t border-[#E5E5EA] z-50"
      style={{ height: "83px", paddingBottom: "max(34px, env(safe-area-inset-bottom))" }}
    >
      <div className="w-full max-w-[430px] mx-auto grid grid-cols-5 h-full items-start pt-2">
        {leftTabs.map(renderTab)}

        {/* 中央记账按钮（设计稿: 80px 绿圆，-mt-9，绿色光晕） */}
        <Link
          href="/accounting/record"
          data-nav-key="record"
          className="min-w-0 flex flex-col items-center justify-center gap-0.5 px-1 relative"
        >
          <span
            className="w-20 h-20 rounded-full flex items-center justify-center -mt-9"
            style={{ background: BRAND, boxShadow: "0 4px 12px rgba(52,199,89,0.4)" }}
          >
            <Plus className="w-6 h-6 shrink-0 text-white" strokeWidth={2.5} />
          </span>
          <span className="text-[11px] leading-none whitespace-nowrap max-w-full truncate" style={{ color: INACTIVE }}>
            记账
          </span>
        </Link>

        {rightTabs.map(renderTab)}
      </div>
    </nav>
  );
}

export default function AccountingLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  // 记账页是全屏流程页，不显示底部导航
  const hideTabBar = pathname.startsWith("/accounting/record") || pathname.startsWith("/accounting/ledgers");

  return (
    <div className="min-h-screen bg-white">
      <main className={`w-full max-w-[430px] mx-auto ${hideTabBar ? "" : "pb-[83px]"}`}>
        {children}
      </main>
      {!hideTabBar && <AccountingTabBar />}
    </div>
  );
}
