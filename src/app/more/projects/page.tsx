"use client";

import { useCallback, useMemo } from "react";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import {
  ChevronLeft, FolderKanban,
  GraduationCap, Heart, ClipboardList, Target, Gamepad2, FolderOpen,
  Clock, Wallet, Droplets, Moon, Dumbbell, Pill, StretchHorizontal,
  Utensils, Flower2, ExternalLink,
  Timer, CalendarRange, StickyNote, Settings, Gift, Bell,
} from "lucide-react";
import { useLiveQuery } from "dexie-react-hooks";
import { getAllProjects } from "@/lib/db/efficiency.db";
import type { Project } from "@/lib/db/efficiency.db";

const ICON_MAP: Record<string, React.ComponentType<{ className?: string; style?: React.CSSProperties }>> = {
  GraduationCap, Heart, ClipboardList, Target, Gamepad2, FolderOpen,
  Clock, Wallet, Droplets, Moon, Dumbbell, Pill, StretchHorizontal,
  Utensils, Flower2, FolderKanban,
};

export default function ProjectsPage() {
  const router = useRouter();

  const allProjects = useLiveQuery(() => getAllProjects(), [], [] as Project[]);

  const smallProjects = allProjects.filter(p => p.projectType === 'small');

  const navigateTo = useCallback((p: Project) => {
    if (p.moreRoute) router.push(p.moreRoute);
  }, [router]);

  const getIcon = (name: string) => ICON_MAP[name] || FolderKanban;

  const defaultSmall = useMemo(() => {
    return smallProjects.filter(p => p.isDefault);
  }, [smallProjects]);

  return (
    <div className="pb-[120px]">
      {/* Header */}
      <div className="flex items-center justify-between px-4 pt-[var(--safe-area-top)] pb-2">
        <button
          type="button" onClick={() => router.push("/")}
          className="inline-flex h-8 w-8 items-center justify-center rounded-lg"
          style={{ background: "var(--color-surface-secondary)" }}
        >
          <ChevronLeft className="w-5 h-5" style={{ color: "var(--color-text-primary)" }} />
        </button>
        <h1 className="text-title-nav mx-2 truncate" style={{ color: "var(--color-text-primary)" }}>全部功能</h1>
        <div className="w-8" />
      </div>

      <div className="px-4">
        {/* 功能模块 */}
        {defaultSmall.length > 0 && (
          <div className="mb-5">
            <p className="text-[12px] font-medium mb-2.5" style={{ color: "var(--color-text-disabled)" }}>功能模块</p>
            <div className="grid grid-cols-2 gap-2.5">
              {defaultSmall.map((p, i) => {
                const Icon = getIcon(p.icon);
                return (
                  <motion.button key={p.id} initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: i * 0.03 }}
                    onClick={() => navigateTo(p)}
                    className="p-3.5 rounded-[16px] flex items-center gap-3 text-left active:scale-[0.98] transition-transform"
                    style={{ background: "var(--color-surface-card)", boxShadow: "var(--shadow-card)" }}
                  >
                    <div className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0" style={{ background: `${p.color}20` }}>
                      <Icon className="w-5 h-5" style={{ color: p.color }} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="text-[14px] font-semibold truncate" style={{ color: "var(--color-text-primary)" }}>{p.name}</div>
                    </div>
                    <ExternalLink className="w-3.5 h-3.5 flex-shrink-0" style={{ color: "var(--color-text-disabled)" }} />
                  </motion.button>
                );
              })}
              {/* 提醒 */}
              <motion.button
                initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}
                transition={{ delay: defaultSmall.length * 0.03 + 0.03 }}
                onClick={() => router.push("/reminders")}
                className="p-3.5 rounded-[16px] flex items-center gap-3 text-left active:scale-[0.98] transition-transform"
                style={{ background: "var(--color-surface-card)", boxShadow: "var(--shadow-card)" }}
              >
                <div className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0" style={{ background: "#3B82F620" }}>
                  <Bell className="w-5 h-5" style={{ color: "#3B82F6" }} />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-[14px] font-semibold truncate" style={{ color: "var(--color-text-primary)" }}>提醒</div>
                </div>
                <ExternalLink className="w-3.5 h-3.5 flex-shrink-0" style={{ color: "var(--color-text-disabled)" }} />
              </motion.button>
              {/* 专注 */}
              <motion.button
                initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}
                transition={{ delay: defaultSmall.length * 0.03 + 0.06 }}
                onClick={() => router.push("/focus")}
                className="p-3.5 rounded-[16px] flex items-center gap-3 text-left active:scale-[0.98] transition-transform"
                style={{ background: "var(--color-surface-card)", boxShadow: "var(--shadow-card)" }}
              >
                <div className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0" style={{ background: "#6366F120" }}>
                  <Timer className="w-5 h-5" style={{ color: "#6366F1" }} />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-[14px] font-semibold truncate" style={{ color: "var(--color-text-primary)" }}>专注</div>
                </div>
                <ExternalLink className="w-3.5 h-3.5 flex-shrink-0" style={{ color: "var(--color-text-disabled)" }} />
              </motion.button>
              {/* 倒数日 */}
              <motion.button
                initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}
                transition={{ delay: defaultSmall.length * 0.03 + 0.09 }}
                onClick={() => router.push("/more/countdown")}
                className="p-3.5 rounded-[16px] flex items-center gap-3 text-left active:scale-[0.98] transition-transform"
                style={{ background: "var(--color-surface-card)", boxShadow: "var(--shadow-card)" }}
              >
                <div className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0" style={{ background: "#F59E0B20" }}>
                  <CalendarRange className="w-5 h-5" style={{ color: "#F59E0B" }} />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-[14px] font-semibold truncate" style={{ color: "var(--color-text-primary)" }}>倒数日</div>
                </div>
                <ExternalLink className="w-3.5 h-3.5 flex-shrink-0" style={{ color: "var(--color-text-disabled)" }} />
              </motion.button>
              {/* 备忘录 */}
              <motion.button
                initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}
                transition={{ delay: defaultSmall.length * 0.03 + 0.12 }}
                onClick={() => router.push("/more/notes")}
                className="p-3.5 rounded-[16px] flex items-center gap-3 text-left active:scale-[0.98] transition-transform"
                style={{ background: "var(--color-surface-card)", boxShadow: "var(--shadow-card)" }}
              >
                <div className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0" style={{ background: "#8B5CF620" }}>
                  <StickyNote className="w-5 h-5" style={{ color: "#8B5CF6" }} />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-[14px] font-semibold truncate" style={{ color: "var(--color-text-primary)" }}>备忘录</div>
                </div>
                <ExternalLink className="w-3.5 h-3.5 flex-shrink-0" style={{ color: "var(--color-text-disabled)" }} />
              </motion.button>
              {/* 设置 */}
              <motion.button
                initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}
                transition={{ delay: defaultSmall.length * 0.03 + 0.15 }}
                onClick={() => router.push("/settings")}
                className="p-3.5 rounded-[16px] flex items-center gap-3 text-left active:scale-[0.98] transition-transform"
                style={{ background: "var(--color-surface-card)", boxShadow: "var(--shadow-card)" }}
              >
                <div className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0" style={{ background: "#64748B20" }}>
                  <Settings className="w-5 h-5" style={{ color: "#64748B" }} />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-[14px] font-semibold truncate" style={{ color: "var(--color-text-primary)" }}>设置</div>
                </div>
                <ExternalLink className="w-3.5 h-3.5 flex-shrink-0" style={{ color: "var(--color-text-disabled)" }} />
              </motion.button>
              {/* 心愿 */}
              <motion.button
                initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}
                transition={{ delay: defaultSmall.length * 0.03 + 0.18 }}
                onClick={() => router.push("/more/wishes")}
                className="p-3.5 rounded-[16px] flex items-center gap-3 text-left active:scale-[0.98] transition-transform"
                style={{ background: "var(--color-surface-card)", boxShadow: "var(--shadow-card)" }}
              >
                <div className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0" style={{ background: "#FF2D5520" }}>
                  <Gift className="w-5 h-5" style={{ color: "#FF2D55" }} />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-[14px] font-semibold truncate" style={{ color: "var(--color-text-primary)" }}>心愿</div>
                </div>
                <ExternalLink className="w-3.5 h-3.5 flex-shrink-0" style={{ color: "var(--color-text-disabled)" }} />
              </motion.button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
