"use client";

import { useState, useMemo } from "react";
import Link from "next/link";
import { motion } from "framer-motion";
import {
  ChevronLeft, ChevronRight, Droplets, Moon, Dumbbell, Utensils,
  Pill, Timer, Wallet, StickyNote,
  Bell, Settings, Compass, ClipboardCheck, Sun, Repeat, Clock,
  BookOpen, Target, Brain, PersonStanding, Star, Hourglass, CalendarDays,
  Search, SearchX, X,
} from "lucide-react";
import { useRouter } from "next/navigation";
import { useMedicineMode } from "@/lib/use-medicine-mode";

// ============================================================
// 功能目录（四组 · iOS 分组列表）
// 计划与复盘 / 身体养护 / 生活 / 系统
// 长期主义已从底导移入「计划与复盘」；提醒设置合并进「提醒中心」
// ============================================================

interface ModuleEntry {
  label: string;
  path: string;
  icon: React.ReactNode;
  color: string;
  bgColor: string;
  desc?: string;
  repair?: boolean; // 维修模式条目（条件激活，平时隐藏）
}

const MODULE_GROUPS: { title: string; items: ModuleEntry[] }[] = [
  {
    title: "计划与复盘",
    items: [
      { label: "长期主义", path: "/longtermism", icon: <Compass className="h-5 w-5" />, color: "var(--lifeflow-primary)", bgColor: "var(--lifeflow-brand-50)", desc: "目标回顾与复盘" },
      { label: "复盘总览", path: "/more/review", icon: <ClipboardCheck className="h-5 w-5" />, color: "var(--lifeflow-primary)", bgColor: "var(--lifeflow-brand-50)", desc: "日/周复盘记录" },
      { label: "目标拆解", path: "/efficiency-v2", icon: <Brain className="h-5 w-5" />, color: "var(--lifeflow-primary)", bgColor: "var(--lifeflow-brand-50)", desc: "五层目标 · 今日焦点" },
      { label: "理想日蓝图", path: "/ideal-day", icon: <Sun className="h-5 w-5" />, color: "var(--lifeflow-primary)", bgColor: "var(--lifeflow-brand-50)", desc: "8+8+8 时间轴模板" },
      { label: "习惯打卡", path: "/more/habits", icon: <Repeat className="h-5 w-5" />, color: "var(--lifeflow-primary)", bgColor: "var(--lifeflow-brand-50)", desc: "每日习惯追踪" },
      { label: "作息模板", path: "/more/schedule/routines", icon: <Clock className="h-5 w-5" />, color: "var(--lifeflow-primary)", bgColor: "var(--lifeflow-brand-50)", desc: "起床/就寝固定时间" },
      { label: "课程表", path: "/more/schedule/courses", icon: <BookOpen className="h-5 w-5" />, color: "var(--lifeflow-primary)", bgColor: "var(--lifeflow-brand-50)", desc: "上课时间安排" },
      { label: "备考目标", path: "/more/exam-plan", icon: <Target className="h-5 w-5" />, color: "var(--lifeflow-primary)", bgColor: "var(--lifeflow-brand-50)", desc: "省考 · 四级目标与课时" },
      { label: "记忆复习", path: "/more/ebbinghaus", icon: <Brain className="h-5 w-5" />, color: "var(--lifeflow-primary)", bgColor: "var(--lifeflow-brand-50)", desc: "艾宾浩斯记忆" },
      { label: "专注计时", path: "/more/focus", icon: <Timer className="h-5 w-5" />, color: "var(--lifeflow-primary)", bgColor: "var(--lifeflow-brand-50)", desc: "番茄专注" },
    ],
  },
  {
    title: "身体养护",
    items: [
      { label: "睡眠", path: "/more/sleep", icon: <Moon className="h-5 w-5" />, color: "#34C759", bgColor: "rgba(52,199,89,0.12)", desc: "入睡打卡与统计" },
      { label: "饮水", path: "/more/water", icon: <Droplets className="h-5 w-5" />, color: "#34C759", bgColor: "rgba(52,199,89,0.12)", desc: "饮水记录与目标" },
      { label: "训练中心", path: "/more/fitness", icon: <Dumbbell className="h-5 w-5" />, color: "#34C759", bgColor: "rgba(52,199,89,0.12)", desc: "训练打卡 · 坐姿 · 养生" },
      { label: "饮食", path: "/more/diet", icon: <Utensils className="h-5 w-5" />, color: "#34C759", bgColor: "rgba(52,199,89,0.12)", desc: "三餐记录" },
      { label: "坐姿健康", path: "/more/posture-health", icon: <PersonStanding className="h-5 w-5" />, color: "#34C759", bgColor: "rgba(52,199,89,0.12)", desc: "坐姿矫正与拉伸" },
      { label: "吃药提醒", path: "/more/medication", icon: <Pill className="h-5 w-5" />, color: "#34C759", bgColor: "rgba(52,199,89,0.12)", desc: "服药计划与提醒", repair: true },
    ],
  },
  {
    title: "生活",
    items: [
      { label: "记账", path: "/more/accounting", icon: <Wallet className="h-5 w-5" />, color: "#007AFF", bgColor: "rgba(0,122,255,0.12)", desc: "收支账本" },
      { label: "备忘录", path: "/more/notes", icon: <StickyNote className="h-5 w-5" />, color: "#007AFF", bgColor: "rgba(0,122,255,0.12)", desc: "随手记" },
      { label: "心愿", path: "/more/wishes", icon: <Star className="h-5 w-5" />, color: "#007AFF", bgColor: "rgba(0,122,255,0.12)", desc: "心愿清单" },
      { label: "倒数日", path: "/more/countdown", icon: <Hourglass className="h-5 w-5" />, color: "#007AFF", bgColor: "rgba(0,122,255,0.12)", desc: "重要日子倒数" },
      { label: "日历", path: "/more/calendar", icon: <CalendarDays className="h-5 w-5" />, color: "#007AFF", bgColor: "rgba(0,122,255,0.12)", desc: "月视图总览" },
    ],
  },
  {
    title: "系统",
    items: [
      { label: "提醒中心", path: "/reminders", icon: <Bell className="h-5 w-5" />, color: "var(--color-text-secondary)", bgColor: "var(--lifeflow-muted)", desc: "提醒与默认设置" },
      { label: "设置", path: "/settings", icon: <Settings className="h-5 w-5" />, color: "var(--color-text-secondary)", bgColor: "var(--lifeflow-muted)", desc: "应用设置与数据" },
    ],
  },
];

// ============================================================
// 页面
// ============================================================

export default function MorePage() {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const { active: medicineActive } = useMedicineMode();

  // 维修模式为条目级——吃药提醒仅在条件满足时展示
  const visibleGroups = useMemo(() => (
    MODULE_GROUPS
      .map((g) => ({ ...g, items: g.items.filter((it) => !it.repair || medicineActive) }))
      .filter((g) => g.items.length > 0)
  ), [medicineActive]);

  // 搜索：按模块名 / 路径 / 分组名模糊匹配
  const normalized = query.trim().toLowerCase();
  const searchResults = useMemo(() => {
    if (!normalized) return null;
    return visibleGroups.map((group) => ({
      ...group,
      items: group.items.filter(
        (item) =>
          item.label.toLowerCase().includes(normalized) ||
          item.path.toLowerCase().includes(normalized) ||
          group.title.toLowerCase().includes(normalized),
      ),
    })).filter((g) => g.items.length > 0);
  }, [normalized, visibleGroups]);

  const renderGroup = (group: (typeof visibleGroups)[number], gi: number) => (
    <section key={group.title} className="mb-5 space-y-2">
      <h2 className="px-4 text-[13px] font-medium leading-none" style={{ color: "var(--color-text-secondary)" }}>
        {group.title}
      </h2>
      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: gi * 0.04, duration: 0.25 }}
        className="rounded-xl overflow-hidden"
        style={{ background: "var(--color-surface-card)", boxShadow: "var(--shadow-card)" }}
      >
        {group.items.map((item, i) => (
          <Link
            key={item.path}
            href={item.path}
            className="flex min-w-0 items-center gap-3 px-4 py-3 active:opacity-70 no-underline"
            style={{ borderTop: i > 0 ? "1px solid var(--lifeflow-border-light)" : "none" }}
          >
            <span
              className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg"
              style={{ background: item.bgColor, color: item.color }}
            >
              {item.icon}
            </span>
            <span className="min-w-0 flex-1">
              <span className="block truncate text-[15px] font-medium leading-snug" style={{ color: "var(--color-text-primary)" }}>
                {item.label}
              </span>
              {item.desc && (
                <span className="mt-0.5 block truncate text-[12px] leading-none" style={{ color: "var(--color-text-tertiary)" }}>
                  {item.desc}
                </span>
              )}
            </span>
            <ChevronRight className="h-4 w-4 shrink-0" style={{ color: "var(--color-text-tertiary)" }} />
          </Link>
        ))}
      </motion.div>
    </section>
  );

  return (
    <div className="pb-[100px]">
      {/* Header */}
      <div className="flex items-center justify-between px-4 pt-[var(--safe-area-top)] pb-2">
        <button
          type="button" onClick={() => router.push("/")}
          className="inline-flex h-8 w-8 items-center justify-center rounded-lg"
          style={{ background: "var(--color-surface-secondary)" }}
        >
          <ChevronLeft className="w-5 h-5" style={{ color: "var(--color-text-primary)" }} />
        </button>
        <h1 className="text-[20px] font-bold mx-2 truncate" style={{ color: "var(--color-text-primary)" }}>更多</h1>
        <div className="w-8" />
      </div>

      {/* 搜索框 */}
      <div className="px-4 pb-3">
        <div
          className="flex items-center gap-2 h-10 px-3 rounded-[14px]"
          style={{ background: "var(--color-surface-card)", border: "1px solid var(--lifeflow-border)" }}
        >
          <Search className="w-4 h-4 shrink-0" style={{ color: "var(--color-text-disabled)" }} />
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="搜索功能模块…"
            className="flex-1 min-w-0 bg-transparent outline-none text-[15px] placeholder:text-[13px]"
            style={{ color: "var(--color-text-primary)" }}
          />
          {query && (
            <button
              type="button"
              onClick={() => setQuery("")}
              aria-label="清空搜索"
              className="w-5 h-5 flex items-center justify-center rounded-full shrink-0 active:opacity-60"
              style={{ background: "var(--lifeflow-muted)" }}
            >
              <X className="w-3 h-3" style={{ color: "var(--color-text-secondary)" }} />
            </button>
          )}
        </div>
      </div>

      <div className="px-4">
        {searchResults ? (
          searchResults.length === 0 ? (
            <div className="flex flex-col items-center pt-16 text-center">
              <SearchX className="w-9 h-9 mb-3" style={{ color: "var(--color-text-disabled)" }} />
              <p className="text-[15px] font-medium" style={{ color: "var(--color-text-primary)" }}>未找到相关模块</p>
              <p className="text-[13px] mt-1" style={{ color: "var(--color-text-secondary)" }}>试试输入其他关键词</p>
            </div>
          ) : (
            searchResults.map((group, gi) => renderGroup(group, gi))
          )
        ) : (
          visibleGroups.map((group, gi) => renderGroup(group, gi))
        )}
      </div>
    </div>
  );
}

