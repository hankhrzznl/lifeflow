"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Home, Layers, BarChart2, Bot, TrendingUp } from "lucide-react";
import { showToast } from "@/components/ui/Toast";

// ============================================================
// 设计稿基准: lifeflow-health/pages/dashboard.html (底部导航契约)
// 品牌橙 #FF9500
// ============================================================

const BRAND = "#FF9500";
const INACTIVE = "#8E8E93";
const BG = "#F2F2F7";

interface TabItem {
  key: string;
  label: string;
  path: string;
  icon: React.ComponentType<{ className?: string; style?: React.CSSProperties }>;
}

const tabs: TabItem[] = [
  { key: "home", label: "主页", path: "/health", icon: Home },
  { key: "plan", label: "规划", path: "", icon: Layers },
  { key: "review", label: "回顾", path: "", icon: BarChart2 },
  { key: "assistant", label: "助手", path: "", icon: Bot },
  { key: "stats", label: "统计", path: "", icon: TrendingUp },
];

function HealthTabBar() {
  const pathname = usePathname();
  const isHome = pathname === "/health";

  return (
    <nav
      data-mobile-nav="health"
      className="fixed bottom-0 left-0 right-0 z-50 bg-white border-t border-[#E5E5EA]"
      style={{ height: 83, paddingBottom: "max(20px, env(safe-area-inset-bottom))" }}
    >
      <div className="w-full max-w-[430px] mx-auto grid grid-cols-5" style={{ height: 63, paddingTop: 4 }}>
        {tabs.map((tab) => {
          const active = tab.key === "home" && isHome;
          const content = (
            <div
              key={tab.key}
              className="flex flex-col items-center justify-center gap-0.5"
            >
              <tab.icon
                className="w-6 h-6"
                style={{ color: active ? BRAND : INACTIVE }}
              />
              <span
                className="text-[10px] leading-none whitespace-nowrap"
                style={{ color: active ? BRAND : INACTIVE, fontWeight: active ? 500 : 400 }}
              >
                {tab.label}
              </span>
            </div>
          );

          if (tab.key === "home") {
            return (
              <Link
                key={tab.key}
                href="/health"
                data-nav-key={tab.key}
                data-active={active || undefined}
                className="min-w-0 flex flex-col items-center justify-center gap-0.5 px-1"
              >
                {content}
              </Link>
            );
          }
          return (
            <button
              key={tab.key}
              type="button"
              data-nav-key={tab.key}
              onClick={() => showToast({ type: "info", message: "功能开发中" })}
              className="min-w-0 flex flex-col items-center justify-center gap-0.5 px-1"
            >
              {content}
            </button>
          );
        })}
      </div>
    </nav>
  );
}

export default function HealthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen" style={{ background: BG }}>
      <main className="w-full max-w-[430px] mx-auto pb-[95px]">
        {children}
      </main>
      <HealthTabBar />
    </div>
  );
}
