"use client";

import { usePathname } from "next/navigation";
import AccountingTabBar from "@/components/navigation/AccountingTabBar";

// ============================================================
// 记账子站容器 — 带专用底部 Tab 导航
// ============================================================

export default function AccountingLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const isFullscreen =
    pathname.startsWith("/more/accounting/record") ||
    pathname.startsWith("/more/accounting/ledgers") ||
    pathname.startsWith("/more/accounting/search");

  return (
    <div className="min-h-screen" style={{ background: "var(--lifeflow-background)" }}>
      <main className={`w-full max-w-[430px] mx-auto ${isFullscreen ? "" : "pb-[100px]"}`}>
        {children}
      </main>
      {!isFullscreen && <AccountingTabBar />}
    </div>
  );
}
