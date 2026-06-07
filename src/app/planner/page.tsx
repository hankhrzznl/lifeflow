"use client";

import { useState, useRef, useCallback, Suspense, lazy } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Clock, CalendarCheck, Flag, LayoutGrid } from "lucide-react";
import TodayTab from "./TodayTab";

const PendingPage = lazy(() => import("@/app/pending/page").then((mod) => ({ default: mod.default })));
const ProjectsPage = lazy(() => import("@/app/projects/page").then((mod) => ({ default: mod.default })));
const GoalsPage = lazy(() => import("@/app/goals/page").then((mod) => ({ default: mod.default })));

// ==================== Tab 定义 ====================

type PlannerTab = "today" | "pending" | "goals" | "projects";

const PLANNER_TABS: { key: PlannerTab; label: string; icon: typeof Clock }[] = [
  { key: "today", label: "今日", icon: Clock },
  { key: "pending", label: "安排", icon: CalendarCheck },
  { key: "goals", label: "目标", icon: Flag },
  { key: "projects", label: "项目", icon: LayoutGrid },
];

// ==================== 滑动指示器 ====================

function SlidingTabBar({
  tabs,
  activeTab,
  onTabChange,
}: {
  tabs: typeof PLANNER_TABS;
  activeTab: PlannerTab;
  onTabChange: (key: PlannerTab) => void;
}) {
  const containerRef = useRef<HTMLDivElement>(null);

  return (
    <div
      ref={containerRef}
      className="relative grid grid-cols-4 gap-1 bg-gray-100 rounded-xl p-1"
    >
      {/* 滑动指示器 (slide indicator) */}
      <motion.div
        layoutId="planner-tab-indicator"
        className="absolute top-1 bottom-1 rounded-lg bg-white shadow-sm z-0"
        style={{ width: `calc((100% - 8px) / 4)` }}
        animate={{
          left: `calc(${PLANNER_TABS.findIndex((t) => t.key === activeTab) * 25}% + 4px)`,
        }}
        transition={{ duration: 0.25, ease: [0.4, 0, 0.2, 1] }}
      />

      {tabs.map((tab) => {
        const active = activeTab === tab.key;
        return (
          <button
            key={tab.key}
            onClick={() => onTabChange(tab.key)}
            className={`relative z-10 flex items-center justify-center gap-1.5 py-2.5 px-3 rounded-lg text-sm font-medium transition-colors duration-200 ${
              active
                ? "text-gray-900 font-semibold"
                : "text-gray-500 hover:text-gray-700"
            }`}
          >
            <tab.icon className="w-[18px] h-[18px]" strokeWidth={2} />
            <span>{tab.label}</span>
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
  const [activeTab, setActiveTab] = useState<PlannerTab>("today");
  const [todayKey, setTodayKey] = useState(0);

  const handleTodayUpdate = useCallback(() => {
    setTodayKey((k) => k + 1);
  }, []);

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="mx-auto max-w-5xl px-4 py-6 pb-24 md:px-6 md:py-8">
        {/* 标题区域 — 入场动画 延迟 0ms */}
        <FadeInUp delay={0} className="mb-6">
          <h1 className="text-2xl font-bold text-gray-900">规划</h1>
          <p className="text-sm text-gray-500 mt-1">
            管理今日任务、安排待办、追踪目标与项目
          </p>
        </FadeInUp>

        {/* Tab 栏 — 入场动画 延迟 80ms + stagger */}
        <FadeInUp delay={0.08} className="mb-6 sticky top-0 z-10 bg-gray-50 pb-2">
          <SlidingTabBar
            tabs={PLANNER_TABS}
            activeTab={activeTab}
            onTabChange={setActiveTab}
          />
        </FadeInUp>

        {/* 内容区 — 入场动画 延迟 160ms */}
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
                {activeTab === "goals" && <GoalsPage />}
                {activeTab === "projects" && <ProjectsPage />}
              </Suspense>
            </motion.div>
          </AnimatePresence>
        </FadeInUp>
      </div>
    </div>
  );
}
