"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { motion } from "framer-motion";
import { showToast } from "@/components/ui/Toast";

// ============================================================
// 健康子站骨架 + 5 pill 二级导航（仅总览页渲染）
// ============================================================

const pills = [
  { label: "总览", path: "/health" },
  { label: "规划", path: "" },
  { label: "回顾", path: "" },
  { label: "助手", path: "" },
  { label: "统计", path: "" },
];

function PillNav() {
  const pathname = usePathname();
  return (
    <nav className="mt-4 flex gap-2 overflow-x-auto scrollbar-hide">
      {pills.map((p) => {
        const isActive = p.path === "/health" && pathname === "/health";
        const isPlaceholder = p.path === "";
        return isPlaceholder ? (
          <motion.button
            key={p.label}
            type="button"
            whileTap={{ scale: 0.95 }}
            onClick={() => showToast({ type: "info", message: "功能开发中" })}
            className="h-8 px-4 rounded-full text-[13px] bg-[#F5F5F5] text-[#86868B] opacity-50 flex-shrink-0"
          >
            {p.label}
          </motion.button>
        ) : (
          <Link key={p.label} href={p.path}>
            <motion.span
              whileTap={{ scale: 0.95 }}
              className={`h-8 px-4 rounded-full text-[13px] flex-shrink-0 inline-flex items-center ${
                isActive
                  ? "bg-[#5865F2] text-white font-semibold"
                  : "bg-[#F5F5F5] text-[#86868B]"
              }`}
            >
              {p.label}
            </motion.span>
          </Link>
        );
      })}
    </nav>
  );
}

export default function HealthLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const isHome = pathname === "/health";

  return (
    <div className="min-h-screen bg-[#FAFAFA]">
      {/* 页头 + pill 导航仅总览页渲染 */}
      {isHome && (
        <header className="px-4 pt-9 pb-0">
          <div className="flex items-end justify-between">
            <h1 className="text-[32px] font-bold tracking-[-0.02em] text-[#1D1D1F]">健康</h1>
            <span className="text-[15px] text-[#86868B]">
              {(() => {
                const d = new Date();
                return `${d.getMonth() + 1}月${d.getDate()}日`;
              })()}
            </span>
          </div>
          <PillNav />
        </header>
      )}
      <main className="w-full max-w-[430px] mx-auto pb-[100px]">{children}</main>
    </div>
  );
}
