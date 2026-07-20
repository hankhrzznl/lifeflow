"use client";

import { usePathname } from "next/navigation";
import BottomTabBar from "./BottomTabBar";

// 在记账子站路由下隐藏全局 BottomTabBar（记账有自己的 AccountingTabBar）
const HIDDEN_PREFIXES = [
  "/more/accounting",
];

export function BottomNavController() {
  const pathname = usePathname();

  if (HIDDEN_PREFIXES.some((p) => pathname.startsWith(p))) return null;

  return <BottomTabBar />;
}
