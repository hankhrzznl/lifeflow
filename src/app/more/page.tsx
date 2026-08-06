"use client";

import { useState, useMemo } from "react";
import Link from "next/link";
import { motion } from "framer-motion";
import {
  ChevronLeft, Droplets, Moon, Dumbbell, Utensils,
  Pill, Timer, Wallet, Star, CalendarRange, StickyNote, CalendarDays,
  Brain, Calendar, Bell, Settings, NotebookPen, FolderKanban, Clock,
  Search, SearchX, X, Sun,
} from "lucide-react";
import { useRouter } from "next/navigation";
import { useMedicineMode } from "@/lib/use-medicine-mode";

// ============================================================
// 模块目录（静态分类，全站功能单一入口）
// ============================================================

interface ModuleEntry {
  label: string;
  path: string;
  icon: React.ReactNode;
  color: string;
  bgColor: string;
}

const MODULE_GROUPS: { title: string; layer?: string; repair?: boolean; items: ModuleEntry[] }[] = [
  {
    title: "能量底座 E1",
    layer: "睡眠是一切地基 · 保证能量才能执行目标",
    items: [
      { label: "理想日蓝图", path: "/more/ideal-day", icon: <Sun className="w-5 h-5" />, color: "#F59E0B", bgColor: "#FFFBEB" },
      { label: "睡眠", path: "/more/sleep", icon: <Moon className="w-5 h-5" />, color: "#6366F1", bgColor: "#EEF2FF" },
      { label: "作息模板", path: "/more/schedule/routines", icon: <Clock className="w-5 h-5" />, color: "#1E293B", bgColor: "#F1F5F9" },
      { label: "饮水", path: "/more/water", icon: <Droplets className="w-5 h-5" />, color: "#3B82F6", bgColor: "#EFF6FF" },
      { label: "饮食", path: "/more/diet", icon: <Utensils className="w-5 h-5" />, color: "#EC4899", bgColor: "#FDF2F8" },
    ],
  },
  {
    title: "目标执行 E2",
    layer: "能量充足后，把目标落地为今日行动",
    items: [
      { label: "习惯打卡", path: "/more/habits", icon: <Clock className="w-5 h-5" />, color: "#14B8A6", bgColor: "#F0FDFA" },
      { label: "专注计时", path: "/more/focus", icon: <Timer className="w-5 h-5" />, color: "#6366F1", bgColor: "#EEF2FF" },
    ],
  },
  {
    title: "过程记录 E3",
    layer: "执行过程中的记录沉淀",
    items: [
      { label: "记账", path: "/more/accounting", icon: <Wallet className="w-5 h-5" />, color: "#10B981", bgColor: "#ECFDF5" },
      { label: "训练中心", path: "/more/fitness", icon: <Dumbbell className="w-5 h-5" />, color: "#F97316", bgColor: "#FFF7ED" },
    ],
  },
  {
    title: "成长储备 E4",
    layer: "长期资产，按需取用",
    items: [
      { label: "复盘总览", path: "/more/review", icon: <FolderKanban className="w-5 h-5" />, color: "#10B981", bgColor: "#ECFDF5" },
      { label: "记忆复习", path: "/more/ebbinghaus", icon: <Brain className="w-5 h-5" />, color: "#8B5CF6", bgColor: "#F5F3FF" },
      { label: "心愿", path: "/more/wishes", icon: <Star className="w-5 h-5" />, color: "#F59E0B", bgColor: "#FFFBEB" },
      { label: "备忘录", path: "/more/notes", icon: <StickyNote className="w-5 h-5" />, color: "#8B5CF6", bgColor: "#F5F3FF" },
      { label: "课程表", path: "/more/schedule/courses", icon: <Calendar className="w-5 h-5" />, color: "#007AFF", bgColor: "#EFF6FF" },
      { label: "倒数日", path: "/more/countdown", icon: <CalendarRange className="w-5 h-5" />, color: "#F97316", bgColor: "#FFF7ED" },
      { label: "日历", path: "/more/calendar", icon: <CalendarDays className="w-5 h-5" />, color: "#3B82F6", bgColor: "#EFF6FF" },
    ],
  },
  {
    title: "维修模式 ⚙",
    layer: "条件激活 · 平时隐藏，需要时才出现",
    repair: true, // T18-6：无用药计划且设置关闭时全站隐藏
    items: [
      { label: "吃药提醒", path: "/more/medication", icon: <Pill className="w-5 h-5" />, color: "#0EA5E9", bgColor: "#F0F9FF" },
    ],
  },
  {
    title: "系统",
    items: [
      { label: "提醒", path: "/reminders", icon: <Bell className="w-5 h-5" />, color: "#3B82F6", bgColor: "#EFF6FF" },
      { label: "提醒设置", path: "/more/reminder-settings", icon: <NotebookPen className="w-5 h-5" />, color: "#64748B", bgColor: "#F8FAFC" },
      { label: "设置", path: "/settings", icon: <Settings className="w-5 h-5" />, color: "#64748B", bgColor: "#F8FAFC" },
    ],
  },
];

// ============================================================
// 页面
// ============================================================

export default function MorePage() {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const { active: medicineActive } = useMedicineMode(); // T18-6：维修模式条件激活

  // 维修模式组仅在条件满足时展示
  const visibleGroups = useMemo(() => MODULE_GROUPS.filter(g => !g.repair || medicineActive), [medicineActive]);

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
  }, [normalized]);

  const renderGroup = (group: (typeof visibleGroups)[number], gi: number) => (
    <div key={group.title} className="mb-5">
      <p className="text-[12px] font-medium mb-0.5" style={{ color: "var(--color-text-disabled)" }}>{group.title}</p>
      {group.layer && (
        <p className="text-[11px] mb-2.5" style={{ color: "var(--color-text-disabled)", opacity: 0.8 }}>{group.layer}</p>
      )}
      <div className="grid grid-cols-2 gap-2.5">
        {group.items.map((item, i) => (
          <Link
            key={item.path}
            href={item.path}
            className="p-3.5 rounded-[16px] flex items-center gap-3 text-left active:scale-[0.98] transition-transform no-underline"
            style={{ background: "var(--color-surface-card)", boxShadow: "var(--shadow-card)" }}
          >
            <motion.div
              initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}
              transition={{ delay: gi * 0.04 + i * 0.02 }}
              className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0"
              style={{ background: item.bgColor }}
            >
              {item.icon && <span style={{ color: item.color }}>{item.icon}</span>}
            </motion.div>
            <div className="flex-1 min-w-0">
              <div className="text-[14px] font-semibold truncate" style={{ color: "var(--color-text-primary)" }}>{item.label}</div>
            </div>
          </Link>
        ))}
      </div>
    </div>
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
        <h1 className="text-[20px] font-bold mx-2 truncate" style={{ color: "var(--color-text-primary)" }}>全部功能</h1>
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
