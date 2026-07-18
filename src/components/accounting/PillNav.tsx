"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { motion } from "framer-motion";

// ============================================================
// 记账子站 4 pill 二级导航（明细/图表/资产/我的）
// 新增理由：layout 层无法嵌入页面标题与内容之间，故抽为共享组件供各页复用
// ============================================================

const pills = [
  { label: "明细", path: "/accounting" },
  { label: "图表", path: "/accounting/chart" },
  { label: "资产", path: "/accounting/assets" },
  { label: "我的", path: "/accounting/settings" },
];

export default function PillNav() {
  const pathname = usePathname();
  return (
    <nav className="flex gap-2 px-4">
      {pills.map((p) => {
        const active =
          p.path === "/accounting"
            ? pathname === "/accounting"
            : pathname.startsWith(p.path);
        return (
          <Link key={p.path} href={p.path}>
            <motion.span
              whileTap={{ scale: 0.95 }}
              className={`h-8 px-4 rounded-full text-[13px] flex items-center justify-center flex-shrink-0 ${
                active
                  ? "bg-[#1D1D1F] text-white font-semibold"
                  : "bg-white border border-[#F0F0F0] text-[#86868B]"
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
