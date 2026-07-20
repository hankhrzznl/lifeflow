"use client";

import Link from "next/link";
import { motion } from "framer-motion";
import {
  BookOpen, Clock, FolderKanban, Wallet, Droplets,
  Moon, Dumbbell, Pill, Move, CheckCircle, Timer, Clock9,
  StickyNote, CalendarDays, Settings,
} from "lucide-react";

// ============================================================
// 更多 — 全部功能入口
// ============================================================

const groups = [
  {
    title: "日程管理",
    items: [
      { icon: BookOpen, label: "课程表", desc: "每周课程安排", href: "/more/schedule/courses", span: false },
      { icon: Clock, label: "作息", desc: "日常作息模板", href: "/more/schedule/routines", span: false },
      { icon: FolderKanban, label: "项目管理", desc: "项目标签管理", href: "/more/projects", span: true },
    ],
  },
  {
    title: "财务",
    items: [
      { icon: Wallet, label: "记账", desc: "明细·图表·资产·账本", href: "/more/accounting", span: true },
    ],
  },
  {
    title: "健康",
    items: [
      { icon: Droplets, label: "饮水", desc: "喝水追踪", href: "/more/water", span: false },
      { icon: Moon, label: "睡眠", desc: "早睡分析", href: "/more/sleep", span: false },
      { icon: Dumbbell, label: "训练", desc: "力量训练记录", href: "/more/fitness", span: true },
      { icon: Pill, label: "吃药", desc: "用药提醒", href: "/more/medication", span: false },
      { icon: Move, label: "体态拉伸", desc: "矫正·放松", href: "/more/posture", span: false },
    ],
  },
  {
    title: "工具",
    items: [
      { icon: CheckCircle, label: "习惯打卡", desc: "每日坚持", href: "/more/habits", span: false },
      { icon: Timer, label: "专注计时", desc: "番茄钟", href: "/focus", span: false },
      { icon: Clock9, label: "倒数日", desc: "重要日子", href: "/more/countdown", span: false },
      { icon: StickyNote, label: "备忘录", desc: "灵感记录", href: "/more/notes", span: false },
      { icon: CalendarDays, label: "日历", desc: "日程一览", href: "/more/calendar", span: true },
    ],
  },
  {
    title: "系统",
    items: [
      { icon: Settings, label: "设置", desc: "偏好与数据", href: "/settings", span: false },
    ],
  },
];

export default function MorePage() {
  return (
    <div className="pb-[100px]">
      {/* Header */}
      <div className="px-4 pt-6 pb-2">
        <h1
          className="text-[24px] font-bold tracking-[-0.022em]"
          style={{ color: "var(--color-text-primary)" }}
        >
          全部功能入口
        </h1>
      </div>

      {/* Section Groups */}
      {groups.map((group, gi) => (
        <motion.div
          key={group.title}
          className="px-4 mb-5"
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: gi * 0.06, duration: 0.35, ease: [0.32, 0.72, 0, 1] }}
        >
          <h2
            className="text-[13px] font-semibold tracking-[0.01em] mb-3"
            style={{ color: "var(--color-text-secondary)" }}
          >
            {group.title}
          </h2>

          <div className={group.items.length === 1 ? "grid grid-cols-1 gap-2.5" : "grid grid-cols-2 gap-2.5"}>
            {group.items.map((item, ii) => (
              <Link
                key={item.href}
                href={item.href}
                className={item.span && group.items.length > 1 ? "col-span-2" : ""}
              >
                <motion.div
                  className="flex items-center gap-2.5 p-3 rounded-[20px]"
                  style={{
                    background: "var(--color-surface-card)",
                    boxShadow: "var(--shadow-card)",
                  }}
                  whileTap={{ scale: 0.97 }}
                  initial={{ opacity: 0, y: 12 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: gi * 0.06 + ii * 0.04, duration: 0.3, ease: [0.32, 0.72, 0, 1] }}
                >
                  {/* Left icon */}
                  <div
                    className="w-10 h-10 rounded-[12px] flex items-center justify-center flex-shrink-0"
                    style={{ background: "var(--lifeflow-brand-50)" }}
                  >
                    <item.icon
                      className="w-5 h-5"
                      style={{ color: "var(--lifeflow-primary)" }}
                    />
                  </div>

                  {/* Right text */}
                  <div className="min-w-0">
                    <div className="text-[15px] font-medium" style={{ color: "var(--color-text-primary)" }}>
                      {item.label}
                    </div>
                    <div className="text-[12px] mt-0.5" style={{ color: "var(--color-text-secondary)" }}>
                      {item.desc}
                    </div>
                  </div>
                </motion.div>
              </Link>
            ))}
          </div>
        </motion.div>
      ))}
    </div>
  );
}
