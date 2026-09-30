"use client";

import { usePathname } from "next/navigation";
import BottomTabBar from "./BottomTabBar";

// 全屏流程页隐藏全局 BottomTabBar
const HIDDEN_PREFIXES: string[] = [];

export function BottomNavController() {
  const pathname = usePathname();

  if (HIDDEN_PREFIXES.some((p) => pathname.startsWith(p))) return null;

  return <BottomTabBar />;
}
