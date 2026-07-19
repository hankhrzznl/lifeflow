"use client";

import { usePathname } from "next/navigation";

// ============================================================
// 记账子站容器
// 底部导航由 01 的全站 4-tab BottomTabBar 提供
// ============================================================

export default function AccountingLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const isFullscreen =
    pathname.startsWith("/accounting/record") ||
    pathname.startsWith("/accounting/ledgers") ||
    pathname.startsWith("/accounting/search");

  return (
    <div className="min-h-screen bg-[#FAFAFA]">
      <main className={`w-full max-w-[430px] mx-auto ${isFullscreen ? "" : "pb-[80px]"}`}>
        {children}
      </main>
    </div>
  );
}
