"use client";

import { useState, useRef, useCallback, Suspense, lazy, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Clock, CalendarCheck, LayoutGrid } from "lucide-react";
import { useSearchParams } from "next/navigation";
import { getTasksByType } from "@/lib/db";
import TodayTab from "./TodayTab";

const PendingPage = lazy(() => import("@/app/pending/page").then((mod) => ({ default: mod.default })));
const ProjectsPage = lazy(() => import("@/app/projects/page").then((mod) => ({ default: mod.default })));

// ==================== Tab 定义 ====================

type PlannerTab = "today" | "pending" | "projects";

const PLANNER_TABS: { key: PlannerTab; label: string; desc: string; icon: typeof Clock }[] = [
  { key: "today", label: "今日", desc: "今天要做的事", icon: Clock },
  { key: "pending", label: "安排", desc: "捕捉的想法，分类到项目", icon: CalendarCheck },
  { key: "projects", label: "项目", desc: "管理项目、子模块和任务", icon: LayoutGrid },
];

const TAB_COUNT = PLANNER_TABS.length;

// ==================== 滑动指示器 ====================

function SlidingTabBar({
  tabs,
  activeTab,
  onTabChange,
  pendingCount = 0,
}: {
  tabs: typeof PLANNER_TABS;
  activeTab: PlannerTab;
  onTabChange: (key: PlannerTab) => void;
  pendingCount?: number;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const activeIndex = tabs.findIndex((t) => t.key === activeTab);

  return (
    <div
      ref={containerRef}
      className="relative grid grid-cols-3 gap-1 bg-gray-100 rounded-xl p-1"
    >
      {/* 滑动指示器 */}
      <motion.div
        layoutId="planner-tab-indicator"
        className="absolute top-1 bottom-1 rounded-lg bg-white shadow-sm z-0"
        style={{ width: `calc((100% - ${(TAB_COUNT - 1) * 4}px) / ${TAB_COUNT})` }}
        animate={{
          left: `calc(${activeIndex * (100 / TAB_COUNT)}% + ${activeIndex * 4 / TAB_COUNT}px)`,
        }}
        transition={{ duration: 0.25, ease: [0.4, 0, 0.2, 1] }}
      />

      {tabs.map((tab) => {
        const active = activeTab === tab.key;
        return (
          <button
            key={tab.key}
            onClick={() => onTabChange(tab.key)}
            className={`relative z-10 flex flex-col items-center justify-center py-2 px-3 rounded-lg text-sm transition-colors duration-200 ${
              active
                ? "text-gray-900"
                : "text-gray-500 hover:text-gray-700"
            }`}
          >
            <div className="flex items-center gap-1.5">
              <tab.icon className="w-[18px] h-[18px]" strokeWidth={2} />
              <span className={active ? "font-semibold" : "font-medium"}>{tab.label}</span>
              {tab.key === "pending" && pendingCount > 0 && (
                <span className="inline-flex items-center justify-center min-w-[18px] h-[18px] px-1 text-[10px] font-bold text-white bg-violet-500 rounded-full">
                  {pendingCount > 99 ? "99+" : pendingCount}
                </span>
              )}
            </div>
            {active && (
              <span className="text-[10px] text-gray-400 mt-0.5">{tab.desc}</span>
            )}
          </button>
        );
      })}
    </div>
  );
}

// ==================== 入场动画容器 ====================

function FadeInUp({
  children,
  delay = 0,
  className,
}: {
  children: React.ReactNode;
  delay?: number;
  className?: string;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{
        duration: 0.4,
        delay,
        ease: [0.25, 0.46, 0.45, 0.94],
      }}
      className={className}
    >
      {children}
    </motion.div>
  );
}

// ==================== 主组件 ====================

export default function PlannerPage() {
  const searchParams = useSearchParams();
  const [activeTab, setActiveTab] = useState<PlannerTab>("today");
  const [todayKey, setTodayKey] = useState(0);
  const [pendingCount, setPendingCount] = useState(0);

  // 从 URL 参数读取 tab
  useEffect(() => {
    const tab = searchParams.get("tab");
    if (tab && ["today", "pending", "projects"].includes(tab)) {
      setActiveTab(tab as PlannerTab);
    }
  }, [searchParams]);

  // 加载待安排数量
  useEffect(() => {
    getTasksByType("daily").then((tasks) => {
      setPendingCount(tasks.filter((t) => t.status === "active").length);
    });
  }, [activeTab]);

  const handleTodayUpdate = useCallback(() => {
    setTodayKey((k) => k + 1);
  }, []);

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-50 to-white dark:from-gray-950 dark:to-gray-900">
      <div className="mx-auto max-w-5xl px-5 py-8 pb-24 md:px-8 md:py-10">
        {/* 标题区域 */}
        <FadeInUp delay={0} className="mb-6">
          <h1 className="text-2xl font-bold text-gray-900">规划</h1>
          <p className="text-sm text-gray-500 mt-1">
            捕捉 → 安排 → 项目 · 清晰的规划流程
          </p>
        </FadeInUp>

        {/* Tab 栏 */}
        <FadeInUp delay={0.08} className="mb-6 sticky top-0 z-10 bg-gray-50 pb-2">
          <SlidingTabBar
            tabs={PLANNER_TABS}
            activeTab={activeTab}
            onTabChange={setActiveTab}
            pendingCount={pendingCount}
          />
        </FadeInUp>

        {/* 内容区 */}
        <FadeInUp delay={0.16}>
          <AnimatePresence mode="wait">
            <motion.div
              key={activeTab}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.25, ease: "easeOut" }}
            >
              <Suspense
                fallback={
                  <div className="flex items-center justify-center py-20">
                    <div className="w-8 h-8 border-2 border-gray-300 border-t-gray-600 rounded-full animate-spin" />
                  </div>
                }
              >
                {activeTab === "today" && (
                  <TodayTab key={todayKey} onUpdate={handleTodayUpdate} />
                )}
                {activeTab === "pending" && <PendingPage />}
                {activeTab === "projects" && <ProjectsPage />}
              </Suspense>
            </motion.div>
          </AnimatePresence>
        </FadeInUp>
      </div>
    </div>
  );
}
