"use client";

import { useState, useMemo } from "react";
import Link from "next/link";
import { motion } from "framer-motion";
import {
  ChevronLeft, Droplets, Moon, Dumbbell, Utensils,
  Pill, Timer, Wallet, StickyNote,
  Brain, Bell, Settings, NotebookPen, FolderKanban, Clock,
  Search, SearchX, X, Sun, GraduationCap, Footprints,
} from "lucide-react";
import { useRouter } from "next/navigation";
import { useMedicineMode } from "@/lib/use-medicine-mode";

// ============================================================
// 模块目录（静态分类，全站功能单一入口）
// ============================================================

// T20-5：时间权重尺寸档位（卡片大小 = 模块日占时间的可视化映射）
// XL 大图块（8h 级）· L 标准大卡（1-5h 级）· M 小卡（轻量高频）· S 紧凑行（系统工具）
type ModuleSize = "xl" | "l" | "m" | "s";

interface ModuleEntry {
  label: string;
  path: string;
  icon: React.ReactNode;
  color: string;
  bgColor: string;
  size: ModuleSize;
  repair?: boolean; // T20-4：条目级维修模式（条件激活，平时隐藏）
}

// T20-4：8+8+8 时间观六组重构（替代原 E1-E4 能量金字塔 + 维修组）
// 睡觉 8h / 工作学习 8h / 生活 8h；身体养护·计划与复盘·系统为支撑层
const MODULE_GROUPS: { title: string; layer?: string; items: ModuleEntry[] }[] = [
  {
    title: "睡觉",
    layer: "8h 睡眠 · 睡够，才有精力",
    items: [
      { label: "睡眠", path: "/more/sleep", icon: <Moon className="w-5 h-5" />, color: "#6366F1", bgColor: "#EEF2FF", size: "xl" },
    ],
  },
  {
    title: "工作/学习",
    layer: "8h 工作学习 · 专注推进目标",
    items: [
      { label: "专注计时", path: "/more/focus", icon: <Timer className="w-5 h-5" />, color: "#6366F1", bgColor: "#EEF2FF", size: "l" },
      { label: "备考计划", path: "/more/exam-plan", icon: <GraduationCap className="w-5 h-5" />, color: "#F97316", bgColor: "#FFF7ED", size: "l" },
      { label: "记忆复习", path: "/more/ebbinghaus", icon: <Brain className="w-5 h-5" />, color: "#8B5CF6", bgColor: "#F5F3FF", size: "m" },
    ],
  },
  {
    title: "身体养护",
    layer: "作息与健康 · 身体是长期资产",
    items: [
      { label: "训练中心", path: "/more/fitness", icon: <Dumbbell className="w-5 h-5" />, color: "#F97316", bgColor: "#FFF7ED", size: "l" },
      { label: "饮食", path: "/more/diet", icon: <Utensils className="w-5 h-5" />, color: "#EC4899", bgColor: "#FDF2F8", size: "m" },
      { label: "作息模板", path: "/more/schedule/routines", icon: <Clock className="w-5 h-5" />, color: "#1E293B", bgColor: "#F1F5F9", size: "m" },
      { label: "饮水", path: "/more/water", icon: <Droplets className="w-5 h-5" />, color: "#3B82F6", bgColor: "#EFF6FF", size: "m" },
      { label: "坐姿健康", path: "/more/posture-health", icon: <Footprints className="w-5 h-5" />, color: "#10B981", bgColor: "#ECFDF5", size: "m" },
      { label: "吃药提醒", path: "/more/medication", icon: <Pill className="w-5 h-5" />, color: "#0EA5E9", bgColor: "#F0F9FF", size: "s", repair: true },
    ],
  },
  {
    title: "生活",
    layer: "8h 留给自己 · 运动/娱乐/社交",
    items: [
      { label: "记账", path: "/more/accounting", icon: <Wallet className="w-5 h-5" />, color: "#10B981", bgColor: "#ECFDF5", size: "m" },
      { label: "备忘录", path: "/more/notes", icon: <StickyNote className="w-5 h-5" />, color: "#8B5CF6", bgColor: "#F5F3FF", size: "s" },
    ],
  },
  {
    title: "计划与复盘",
    layer: "规划 · 习惯 · 回顾，让每一天更接近理想",
    items: [
      { label: "理想日蓝图", path: "/more/ideal-day", icon: <Sun className="w-5 h-5" />, color: "#F59E0B", bgColor: "#FFFBEB", size: "m" },
      { label: "习惯打卡", path: "/more/habits", icon: <Clock className="w-5 h-5" />, color: "#14B8A6", bgColor: "#F0FDFA", size: "m" },
      { label: "复盘总览", path: "/more/review", icon: <FolderKanban className="w-5 h-5" />, color: "#10B981", bgColor: "#ECFDF5", size: "m" },
    ],
  },
  {
    title: "系统",
    layer: "工具与数据",
    items: [
      { label: "提醒", path: "/reminders", icon: <Bell className="w-5 h-5" />, color: "#3B82F6", bgColor: "#EFF6FF", size: "s" },
      { label: "提醒设置", path: "/more/reminder-settings", icon: <NotebookPen className="w-5 h-5" />, color: "#64748B", bgColor: "#F8FAFC", size: "s" },
      { label: "设置", path: "/settings", icon: <Settings className="w-5 h-5" />, color: "#64748B", bgColor: "#F8FAFC", size: "s" },
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

  // T20-4：维修模式为条目级——吃药提醒仅在条件满足时展示，组内其余条目不受影响
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
  }, [normalized]);

  // T20-5：按档位分层渲染——XL/L 全宽大图块（时间权重高）→ M 两列标准卡 → S 三列紧凑行
  const renderGroup = (group: (typeof visibleGroups)[number], gi: number) => {
    const featured = group.items.filter((it) => it.size === "xl" || it.size === "l");
    const standard = group.items.filter((it) => it.size === "m");
    const compact = group.items.filter((it) => it.size === "s");
    const motionDelay = (base: number) => ({ delay: gi * 0.04 + base });

    // T20-5：按档位调整 icon 容器/标题字号/内边距，形成时间权重视觉层级
    const SIZE_STYLE: Record<ModuleSize, { box: string; icon: string; title: string; pad: string }> = {
      xl: { box: "w-12 h-12 rounded-2xl", icon: "w-6 h-6", title: "text-[17px] font-bold", pad: "p-4" },
      l: { box: "w-11 h-11 rounded-xl", icon: "w-5 h-5", title: "text-[15px] font-bold", pad: "p-4" },
      m: { box: "w-9 h-9 rounded-xl", icon: "w-5 h-5", title: "text-[14px] font-semibold", pad: "p-3.5" },
      s: { box: "w-8 h-8 rounded-lg", icon: "w-4 h-4", title: "text-[13px] font-medium", pad: "p-2.5" },
    };

    const Card = ({ item, base }: { item: ModuleEntry; base: number }) => {
      const st = SIZE_STYLE[item.size];
      return (
        <Link
          href={item.path}
          className={`${st.pad} rounded-[16px] flex items-center gap-3 text-left active:scale-[0.98] transition-transform no-underline`}
          style={{ background: "var(--color-surface-card)", boxShadow: "var(--shadow-card)" }}
        >
          <motion.div
            initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}
            transition={motionDelay(base)}
            className={`${st.box} flex-shrink-0 flex items-center justify-center`}
            style={{ background: item.bgColor }}
          >
            <span className={st.icon} style={{ color: item.color }}>{item.icon}</span>
          </motion.div>
          <div className="flex-1 min-w-0">
            <div className={`${st.title} truncate`} style={{ color: "var(--color-text-primary)" }}>{item.label}</div>
          </div>
        </Link>
      );
    };

    return (
      <div key={group.title} className="mb-5">
        <p className="text-[12px] font-medium mb-0.5" style={{ color: "var(--color-text-disabled)" }}>{group.title}</p>
        {group.layer && (
          <p className="text-[11px] mb-2.5" style={{ color: "var(--color-text-disabled)", opacity: 0.8 }}>{group.layer}</p>
        )}

        {/* XL / L：全宽大图块（icon 大、标题大，代表每天占据大量时间） */}
        {featured.length > 0 && (
          <div className="flex flex-col gap-2.5 mb-2.5">
            {featured.map((item, i) => (
              <Card key={item.path} item={item} base={i * 0.03} />
            ))}
          </div>
        )}

        {/* M：两列标准卡 */}
        {standard.length > 0 && (
          <div className="grid grid-cols-2 gap-2.5 mb-2.5">
            {standard.map((item, i) => (
              <Card key={item.path} item={item} base={featured.length * 0.03 + i * 0.02} />
            ))}
          </div>
        )}

        {/* S：三列紧凑行 */}
        {compact.length > 0 && (
          <div className="grid grid-cols-3 gap-2.5">
            {compact.map((item, i) => (
              <Card key={item.path} item={item} base={(featured.length + standard.length) * 0.03 + i * 0.02} />
            ))}
          </div>
        )}
      </div>
    );
  };

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
