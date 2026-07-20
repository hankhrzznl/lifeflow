"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Receipt, BarChart3, Plus, Wallet, User } from "lucide-react";

// Accounting section 5-tab bottom nav: 明细/图表/记账/资产/我的
// 中央记账按钮为浮动大圆形

const tabs = [
  { label: "明细", path: "/more/accounting", icon: Receipt, isCenter: false as const },
  { label: "图表", path: "/more/accounting/chart", icon: BarChart3, isCenter: false as const },
  { label: "记账", path: "/more/accounting/record", icon: Plus, isCenter: true as const },
  { label: "资产", path: "/more/accounting/assets", icon: Wallet, isCenter: false as const },
  { label: "我的", path: "/more/accounting/settings", icon: User, isCenter: false as const },
] as const;

export default function AccountingTabBar() {
  const pathname = usePathname();

  const isActive = (path: string) => {
    if (path === "/more/accounting") return pathname === "/more/accounting" || pathname === "/more/accounting/record";
    if (path === "/more/accounting/record") return false; // center button, never highlighted
    return pathname === path || pathname.startsWith(path + "/");
  };

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-50 bg-[var(--color-surface-card)] border-t border-[var(--lifeflow-border)] h-[83px] pb-[34px]">
      <div className="w-full max-w-[430px] mx-auto grid grid-cols-5 h-full items-start pt-2">
        {tabs.map((tab) => {
          if (tab.isCenter) {
            // Center floating + button
            return (
              <Link
                key={tab.path}
                href={tab.path}
                className="min-w-0 flex flex-col items-center justify-center gap-0.5 px-1 relative"
              >
                <span className="w-16 h-16 rounded-full bg-[var(--lifeflow-primary)] shadow-[0_2px_8px_rgba(37,99,235,0.3)] flex items-center justify-center -mt-8">
                  <Plus className="w-6 h-6 text-white" strokeWidth={2.5} />
                </span>
                <span className="text-[11px] leading-none whitespace-nowrap truncate" style={{ color: "var(--color-text-secondary)" }}>
                  {tab.label}
                </span>
              </Link>
            );
          }

          const active = isActive(tab.path);
          return (
            <Link
              key={tab.path}
              href={tab.path}
              className="min-w-0 flex flex-col items-center justify-center gap-0.5 px-1"
            >
              <tab.icon
                className="w-6 h-6 shrink-0"
                style={{ color: active ? "var(--lifeflow-primary)" : "var(--color-text-secondary)" }}
                strokeWidth={2}
              />
              <span
                className="text-[11px] leading-none whitespace-nowrap truncate"
                style={{ color: active ? "var(--lifeflow-primary)" : "var(--color-text-secondary)", fontWeight: active ? 600 : 400 }}
              >
                {tab.label}
              </span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
